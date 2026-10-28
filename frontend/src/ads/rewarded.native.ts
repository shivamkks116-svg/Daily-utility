// Rewarded-ad helper. `showRewardedAdResult()` resolves with:
//   "earned"      → user watched the full ad
//   "closed"      → user closed the ad early
//   "unavailable" → AdMob not available / no fill / load timeout
import { adsAvailable, adUnitIds } from "./native";
import Constants from "expo-constants";
import { Platform } from "react-native";

export type RewardedResult = "earned" | "closed" | "unavailable";

const isExpoGo = Constants.executionEnvironment === "storeClient";
const nativeAndroid = Platform.OS === "android" && !isExpoGo;
const LOAD_TIMEOUT_MS = 15_000;

let admob: any = null;
if (nativeAndroid) {
  try { admob = require("react-native-google-mobile-ads"); } catch {}
}

export function showRewardedAdResult(ssv?: { userId: string; customData: string }): Promise<RewardedResult> {
  if (!adsAvailable || !admob || !adUnitIds.rewarded) return Promise.resolve("unavailable");
  return new Promise((resolve) => {
    let earned = false;
    let shown = false;
    let settled = false;
    const { RewardedAd, AdEventType, RewardedAdEventType } = admob;
    const ad = RewardedAd.createForAdRequest(
      adUnitIds.rewarded,
      ssv ? { serverSideVerificationOptions: { userId: ssv.userId, customData: ssv.customData } } : undefined,
    );
    const offs: (() => void)[] = [];
    const finish = (r: RewardedResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      offs.forEach((off) => { try { off?.(); } catch {} });
      resolve(r);
    };
    const timer = setTimeout(() => { if (!shown) finish("unavailable"); }, LOAD_TIMEOUT_MS);
    offs.push(ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      shown = true;
      try { ad.show(); } catch { finish("unavailable"); }
    }));
    offs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; }));
    offs.push(ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned ? "earned" : "closed")));
    offs.push(ad.addAdEventListener(AdEventType.ERROR, () => finish(shown && earned ? "earned" : "unavailable")));
    try { ad.load(); } catch { finish("unavailable"); }
  });
}

export async function showRewardedAd(): Promise<boolean> {
  return (await showRewardedAdResult()) === "earned";
}
