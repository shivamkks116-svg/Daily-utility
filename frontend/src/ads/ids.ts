// Ad module stubs — AdMob is intentionally disabled for local Windows builds
// due to react-native-google-mobile-ads Kotlin toolchain conflicts on RN 0.81.
// The wrappers below preserve the API surface used elsewhere in the app so no
// call sites need to change. Real ads can be plugged back in later by building
// through Emergent's cloud publish pipeline (proper Kotlin toolchain there).
export const AD_UNIT_IDS = {
  banner: "",
  interstitial: "",
  rewarded: "",
};

// Reflect that ads are not available in the currently-shipped native binary.
export const ADS_ENABLED = false;
export const PRODUCTION_ADS = false;
