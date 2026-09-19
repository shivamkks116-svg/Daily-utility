// Rewarded-ad shim — legacy call sites (AILimitDialog) call `showRewardedAd()`
// and expect a boolean promise. We resolve based on the reward event fired by
// the native module. If AdMob is unavailable (web / Expo Go) we return false.
import { adsAvailable, adUnitIds } from "./native";
import Constants from "expo-constants";
import { Platform } from "react-native";

const isExpoGo = Constants.executionEnvironment === "storeClient";
const nativeAndroid = Platform.OS === "android" && !isExpoGo;

let admob: any = null;
if (nativeAndroid) {
  try { admob = require("react-native-google-mobile-ads"); } catch {}
}

export function showRewardedAd(): Promise<boolean> {
  if (!adsAvailable || !admob || !adUnitIds.rewarded) return Promise.resolve(false);
  return new Promise((resolve) => {
    let earned = false;
    let settled = false;
    const { RewardedAd, AdEventType, RewardedAdEventType } = admob;
    const ad = RewardedAd.createForAdRequest(adUnitIds.rewarded);
    const offLoad = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      try { ad.show(); } catch { if (!settled) { settled = true; resolve(false); } }
    });
    const offReward = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
    const offClose = ad.addAdEventListener(AdEventType.CLOSED, () => {
      if (!settled) { settled = true; resolve(earned); }
      offLoad?.(); offReward?.(); offClose?.();
    });
    const offErr = ad.addAdEventListener(AdEventType.ERROR, () => {
      if (!settled) { settled = true; resolve(false); }
      offLoad?.(); offReward?.(); offClose?.(); offErr?.();
    });
    try { ad.load(); } catch { if (!settled) { settled = true; resolve(false); } }
  });
}
