// Central ad-unit config. Real IDs live in native.tsx (test IDs by default,
// EXPO_PUBLIC_ADMOB_* env vars for production). ADS_ENABLED flips to true now
// that react-native-google-mobile-ads is wired via the AdMob config plugin.
export { adUnitIds as AD_UNIT_IDS, adsAvailable } from "./native";
export const ADS_ENABLED = true;
export const PRODUCTION_ADS = process.env.EXPO_PUBLIC_ADMOB_USE_TEST_IDS !== "true";
