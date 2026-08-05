// AdMob unit IDs. Uses Google's TestIds during development.
// Before Play Store release, flip PRODUCTION_ADS to true and replace the
// PRODUCTION_* constants with the user's real AdMob unit IDs.
import { Platform } from "react-native";

// Set to true only for a production build with real ad-unit IDs below.
export const PRODUCTION_ADS = false;

// TEMPORARY placeholder production IDs. Replace before Play Store submission.
const PRODUCTION_BANNER_ANDROID = "ca-app-pub-0000000000000000/0000000000";
const PRODUCTION_INTERSTITIAL_ANDROID = "ca-app-pub-0000000000000000/0000000000";
const PRODUCTION_REWARDED_ANDROID = "ca-app-pub-0000000000000000/0000000000";

// Google-provided test IDs — safe for all builds.
// https://developers.google.com/admob/android/test-ads
const TEST_BANNER = "ca-app-pub-3940256099942544/6300978111";
const TEST_INTERSTITIAL = "ca-app-pub-3940256099942544/1033173712";
const TEST_REWARDED = "ca-app-pub-3940256099942544/5224354917";

export const AD_UNIT_IDS = {
  banner: PRODUCTION_ADS ? PRODUCTION_BANNER_ANDROID : TEST_BANNER,
  interstitial: PRODUCTION_ADS ? PRODUCTION_INTERSTITIAL_ANDROID : TEST_INTERSTITIAL,
  rewarded: PRODUCTION_ADS ? PRODUCTION_REWARDED_ANDROID : TEST_REWARDED,
};

// Ads render only on native Android/iOS. On web preview the module isn't loaded.
export const ADS_ENABLED = Platform.OS === "android" || Platform.OS === "ios";
