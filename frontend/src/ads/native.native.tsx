/**
 * Native-safe AdMob adapter with production-grade placement rules:
 *
 *   • Ads are automatically HIDDEN when the user is subscribed (Premium).
 *   • Interstitial cooldown: 60s between shows.
 *   • Session cap: max 8 interstitials per app session.
 *   • Cold-start grace: no interstitials for first 20s after app open.
 *   • First-open grace: no interstitials in the first 30 min after install.
 *   • Robust preload with backoff on error.
 *
 * Falls back to no-op components on web / Expo Go so the app keeps working.
 */
import React, { useEffect, useRef, useState } from "react";
import { AppState, Image, Platform, StyleSheet, Text, View } from "react-native";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
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
// Production IDs are the default because `.env` is not always shipped with
// cloud builds. Test IDs only in dev builds or when explicitly requested.
const PROD_IDS = {
  banner: "ca-app-pub-3735972538807236/6750087582",
  interstitial: "ca-app-pub-3735972538807236/4123924246",
  rewarded: "ca-app-pub-3735972538807236/9376336646",
  appOpen: "ca-app-pub-3735972538807236/7322091746",
  native: "ca-app-pub-3735972538807236/5621997269",
};
const useTests = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_USE_TEST_IDS === "true";

export const adUnitIds = {
  banner: useTests ? TestIds?.ADAPTIVE_BANNER : process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || PROD_IDS.banner,
  interstitial: useTests ? TestIds?.INTERSTITIAL : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || PROD_IDS.interstitial,
  rewarded: useTests ? TestIds?.REWARDED : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || PROD_IDS.rewarded,
  appOpen: useTests ? TestIds?.APP_OPEN : PROD_IDS.appOpen,
  native: useTests ? TestIds?.NATIVE : PROD_IDS.native,
};

/* ------------------------------------------------------------------ */
/*                            Placement rules                          */
/* ------------------------------------------------------------------ */

const APP_INSTALL_KEY = "@ads/install-ts";
const INTERSTITIAL_COOLDOWN_MS = 60 * 1000; // 1 min between shows
const SESSION_INTERSTITIAL_CAP = 8;          // per app session
const COLD_START_GRACE_MS = 20 * 1000;       // first 20s after app open
const FIRST_DAY_GRACE_MS = 30 * 60 * 1000;   // first 30 min after install

const _appStartAt = Date.now();
let _premium = false; // kept in sync by <AdStartup/>
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

/* ------------------------------------------------------------------ */
/*                              App Open                               */
/* ------------------------------------------------------------------ */

const APP_OPEN_AWAY_MS = 60 * 1000;      // only after 1+ min in background
const APP_OPEN_COLD_WINDOW_MS = 8 * 1000; // cold start: show only if ready fast
let _appOpen: any = null;
let _appOpenLoaded = false;
let _appOpenShowing = false;

function loadAppOpen(onReady?: () => void) {
  if (!admob || !adUnitIds.appOpen || _premium) return;
  const { AppOpenAd, AdEventType } = admob;
  if (!_appOpen) {
    _appOpen = AppOpenAd.createForAdRequest(adUnitIds.appOpen);
    _appOpen.addAdEventListener(AdEventType.CLOSED, () => {
      _appOpenShowing = false;
      _appOpenLoaded = false;
      _lastShownAt = Date.now(); // keep an interstitial from following right away
      try { _appOpen.load(); } catch {}
    });
    _appOpen.addAdEventListener(AdEventType.ERROR, () => { _appOpenLoaded = false; _appOpenShowing = false; });
  }
  const off = _appOpen.addAdEventListener(AdEventType.LOADED, () => {
    _appOpenLoaded = true;
    off?.();
    onReady?.();
  });
  try { _appOpen.load(); } catch {}
}

function showAppOpen() {
  if (_premium || !_appOpenLoaded || _appOpenShowing) return;
  // Never stack on top of an interstitial / rewarded that just closed.
  if (Date.now() - _lastShownAt < 30 * 1000) return;
  try { _appOpenShowing = true; _appOpen.show(); } catch { _appOpenShowing = false; }
}

export function AdStartup() {
  const { isSubscribed } = useSubscription();
  _premium = !!isSubscribed;
  useEffect(() => {
    void initAds().then((ok) => {
      if (!ok) return;
      // Cold start: show once if the ad is ready within a few seconds.
      loadAppOpen(() => { if (Date.now() - _appStartAt < APP_OPEN_COLD_WINDOW_MS) showAppOpen(); });
    });
    // Reset session counters when app comes back to foreground after a long
    // background period (>10 min).
    let lastBg = Date.now();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" && !_appOpenShowing) lastBg = Date.now();
      if (state === "active") {
        const away = Date.now() - lastBg;
        if (away > 10 * 60 * 1000) {
          _sessionShown = 0;
          _lastShownAt = 0;
        }
        if (away > APP_OPEN_AWAY_MS && !_appOpenShowing) {
          if (_appOpenLoaded) showAppOpen();
          else loadAppOpen();
        }
      }
    });
    return () => sub.remove();
  }, []);
  return null;
}

/* ------------------------------------------------------------------ */
/*                               Native                                */
/* ------------------------------------------------------------------ */

/** Native ad styled like a list row (used inside the Recent files list). */
export function NativeAdRow({ testID }: { testID?: string }) {
  const { isSubscribed } = useSubscription();
  const [ad, setAd] = useState<any>(null);

  useEffect(() => {
    if (isSubscribed || !adsAvailable || !adUnitIds.native) return;
    let alive = true;
    let loaded: any = null;
    admob.NativeAd.createForAdRequest(adUnitIds.native)
      .then((a: any) => { loaded = a; if (alive) setAd(a); else a.destroy?.(); })
      .catch(() => {});
    return () => { alive = false; loaded?.destroy?.(); };
  }, [isSubscribed]);

  if (!ad || isSubscribed) return null;
  const { NativeAdView, NativeAsset, NativeAssetType } = admob;
  return (
    <NativeAdView nativeAd={ad} style={nStyles.row} testID={testID}>
      {ad.icon?.url ? (
        <NativeAsset assetType={NativeAssetType.ICON}>
          <Image source={{ uri: ad.icon.url }} style={nStyles.icon} />
        </NativeAsset>
      ) : (
        <View style={[nStyles.icon, { backgroundColor: colors.surfaceSecondary }]} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={nStyles.badge}>Ad</Text>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={nStyles.title} numberOfLines={1}>{ad.headline}</Text>
          </NativeAsset>
        </View>
        {ad.body ? (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text style={nStyles.body} numberOfLines={1}>{ad.body}</Text>
          </NativeAsset>
        ) : null}
      </View>
      {ad.callToAction ? (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={nStyles.cta}>{ad.callToAction}</Text>
        </NativeAsset>
      ) : null}
    </NativeAdView>
  );
}

const nStyles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm,
    borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.sm, minHeight: 56,
  },
  icon: { width: 40, height: 40, borderRadius: radius.sm },
  badge: {
    fontSize: 10, fontWeight: fontWeight.bold, color: colors.onBrandPrimary, backgroundColor: colors.brandPrimary,
    paddingHorizontal: 4, borderRadius: 3, overflow: "hidden",
  },
  title: { flexShrink: 1, color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  body: { color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginTop: 2 },
  cta: {
    color: colors.onBrandPrimary, backgroundColor: colors.brandPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold,
    paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm, overflow: "hidden",
  },
});

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
  if (isSubscribed || _premium || !adsAvailable) return { ok: false, reason: "subscribed_or_unavailable" };

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
