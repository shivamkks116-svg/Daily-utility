/**
 * Native-safe AdMob adapter with production-grade placement rules:
 *
 *   • Ads are automatically HIDDEN when the user is subscribed (Premium).
 *   • Interstitial cooldown: 120s between shows.
 *   • Session cap: max 4 interstitials per app session.
 *   • Cold-start grace: no interstitials for first 45s after app open.
 *   • First-open grace: no interstitials on the user's very first day.
 *   • Robust preload with backoff on error.
 *
 * Falls back to no-op components on web / Expo Go so the app keeps working.
 */
import React, { useEffect, useRef, useState } from "react";
import { AppState, Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useSubscription } from "@/src/subscription/RevenueCat";

const isExpoGo = Constants.executionEnvironment === "storeClient";
const nativeAndroid = Platform.OS === "android" && !isExpoGo;

let admob: any = null;
if (nativeAndroid) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    admob = require("react-native-google-mobile-ads");
  } catch (e) {
    console.warn("[Ads] AdMob native module unavailable:", e);
  }
}

export const adsAvailable = !!admob;
const TestIds = admob?.TestIds;
// Direct access — Metro inlines `process.env.EXPO_PUBLIC_*` at bundle time.
const useTests =
  __DEV__ ||
  process.env.EXPO_PUBLIC_ADMOB_USE_TEST_IDS === "true" ||
  process.env.EXPO_PUBLIC_ADMOB_USE_TEST_IDS === undefined;

export const adUnitIds = {
  banner: useTests ? TestIds?.ADAPTIVE_BANNER : process.env.EXPO_PUBLIC_ADMOB_BANNER_ID,
  interstitial: useTests ? TestIds?.INTERSTITIAL : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID,
  rewarded: useTests ? TestIds?.REWARDED : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID,
};

/* ------------------------------------------------------------------ */
/*                            Placement rules                          */
/* ------------------------------------------------------------------ */

const APP_INSTALL_KEY = "@ads/install-ts";
const INTERSTITIAL_COOLDOWN_MS = 120 * 1000; // 2 min between shows
const SESSION_INTERSTITIAL_CAP = 4;          // per app session
const COLD_START_GRACE_MS = 45 * 1000;       // first 45s after app open
const FIRST_DAY_GRACE_MS = 24 * 60 * 60 * 1000; // 1st 24h after install

const _appStartAt = Date.now();
let _sessionShown = 0;
let _lastShownAt = 0;
let _installedAt: number | null = null;

async function loadInstallTs(): Promise<number> {
  if (_installedAt) return _installedAt;
  try {
    const raw = await AsyncStorage.getItem(APP_INSTALL_KEY);
    if (raw) {
      _installedAt = parseInt(raw, 10) || Date.now();
    } else {
      _installedAt = Date.now();
      await AsyncStorage.setItem(APP_INSTALL_KEY, String(_installedAt));
    }
  } catch {
    _installedAt = Date.now();
  }
  return _installedAt;
}

/* ------------------------------------------------------------------ */
/*                              Init                                   */
/* ------------------------------------------------------------------ */

let _initStarted = false;
export async function initAds(): Promise<boolean> {
  if (!admob || _initStarted) return adsAvailable;
  _initStarted = true;

  // Prime install-timestamp early so first-day grace works.
  loadInstallTs().catch(() => {});

  try {
    try {
      await admob.AdsConsent?.gatherConsent?.();
      const info = await admob.AdsConsent?.getConsentInfo?.();
      if (info && info.canRequestAds === false) return false;
    } catch {
      // UMP failure should not block ads outside EEA.
    }
    await admob.default().initialize();
    return true;
  } catch (e) {
    console.warn("[Ads] init failed:", e);
    return false;
  }
}

export function AdStartup() {
  useEffect(() => {
    void initAds();
    // Reset session counters when app comes back to foreground after a long
    // background period (>10 min).
    let lastBg = Date.now();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") lastBg = Date.now();
      if (state === "active") {
        const away = Date.now() - lastBg;
        if (away > 10 * 60 * 1000) {
          _sessionShown = 0;
          _lastShownAt = 0;
        }
      }
    });
    return () => sub.remove();
  }, []);
  return null;
}

/* ------------------------------------------------------------------ */
/*                              Banner                                 */
/* ------------------------------------------------------------------ */

/** Banner ad — hidden for premium users, no-op on web / Expo Go. */
export function AdBanner({ style, testID }: { style?: any; testID?: string }) {
  const { isSubscribed } = useSubscription();
  if (isSubscribed || !adsAvailable || !adUnitIds.banner) return null;
  const { BannerAd, BannerAdSize } = admob;
  return (
    <View style={style} testID={testID}>
      <BannerAd
        unitId={adUnitIds.banner}
        size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={(e: any) => console.warn("[Ads] banner failed:", e?.message || e)}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*                           Interstitial                              */
/* ------------------------------------------------------------------ */

let _interstitial: any = null;
let _interstitialLoaded = false;
let _errorBackoff = 0; // exponential backoff in ms

function ensureInterstitial() {
  if (!admob || !adUnitIds.interstitial || _interstitial) return;
  const { InterstitialAd, AdEventType } = admob;
  _interstitial = InterstitialAd.createForAdRequest(adUnitIds.interstitial);
  _interstitial.addAdEventListener(AdEventType.LOADED, () => {
    _interstitialLoaded = true;
    _errorBackoff = 0;
  });
  _interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    _interstitialLoaded = false;
    try { _interstitial.load(); } catch {}
  });
  _interstitial.addAdEventListener(AdEventType.ERROR, (err: any) => {
    _interstitialLoaded = false;
    // Backoff reload — avoid hammering AdMob on repeated fill failures.
    _errorBackoff = Math.min((_errorBackoff || 5_000) * 2, 5 * 60 * 1000);
    setTimeout(() => {
      try { _interstitial?.load(); } catch {}
    }, _errorBackoff);
    if (__DEV__) console.warn("[Ads] interstitial error:", err?.message || err);
  });
  try { _interstitial.load(); } catch {}
}

async function shouldSuppressInterstitial(isSubscribed: boolean): Promise<{ ok: boolean; reason?: string }> {
  if (isSubscribed || !adsAvailable) return { ok: false, reason: "subscribed_or_unavailable" };

  // Session cap
  if (_sessionShown >= SESSION_INTERSTITIAL_CAP) return { ok: false, reason: "session_cap" };

  // Cooldown between ads
  const now = Date.now();
  if (now - _lastShownAt < INTERSTITIAL_COOLDOWN_MS) return { ok: false, reason: "cooldown" };

  // Cold-start grace: no ads for first N seconds after app open
  if (now - _appStartAt < COLD_START_GRACE_MS) return { ok: false, reason: "cold_start" };

  // First-day grace: no ads within 24h of first install to protect UX
  const installedAt = await loadInstallTs();
  if (now - installedAt < FIRST_DAY_GRACE_MS) return { ok: false, reason: "first_day" };

  return { ok: true };
}

/**
 * Show an interstitial (respects all placement rules). Returns true if an ad
 * was actually shown.
 */
export async function showInterstitial(isSubscribed = false): Promise<boolean> {
  const gate = await shouldSuppressInterstitial(isSubscribed);
  if (!gate.ok) {
    if (__DEV__) console.log(`[Ads] interstitial suppressed: ${gate.reason}`);
    return false;
  }
  ensureInterstitial();
  if (!_interstitialLoaded) {
    try { _interstitial?.load(); } catch {}
    return false;
  }
  try {
    _lastShownAt = Date.now();
    _sessionShown += 1;
    _interstitial.show();
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*                            Rewarded                                 */
/* ------------------------------------------------------------------ */

/** Rewarded ad hook — resolves with `earned=true` once reward event fires. */
export function useRewardedAd(onEarned?: () => void) {
  const [loaded, setLoaded] = useState(false);
  const adRef = useRef<any>(null);
  const { isSubscribed } = useSubscription();

  useEffect(() => {
    if (!adsAvailable || !adUnitIds.rewarded || isSubscribed) return;
    const { RewardedAd, AdEventType, RewardedAdEventType } = admob;
    adRef.current = RewardedAd.createForAdRequest(adUnitIds.rewarded);
    const offLoad = adRef.current.addAdEventListener(RewardedAdEventType.LOADED, () => setLoaded(true));
    const offReward = adRef.current.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      onEarned?.();
    });
    const offClose = adRef.current.addAdEventListener(AdEventType.CLOSED, () => {
      setLoaded(false);
      try { adRef.current.load(); } catch {}
    });
    try { adRef.current.load(); } catch {}
    return () => { offLoad?.(); offReward?.(); offClose?.(); };
  }, [isSubscribed, onEarned]);

  return {
    loaded,
    available: adsAvailable && !isSubscribed,
    show: () => { try { adRef.current?.show(); } catch {} },
  };
}
