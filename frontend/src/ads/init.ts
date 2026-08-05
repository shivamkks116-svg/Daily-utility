// Native SDK bootstrap. Loaded lazily so the web bundle never touches it.
import mobileAds from "react-native-google-mobile-ads";
import { preloadInterstitial } from "@/src/ads/interstitial";

let started = false;

export async function initAdsOnce() {
  if (started) return;
  started = true;
  try {
    await mobileAds().initialize();
    preloadInterstitial();
  } catch {
    // ignore initialization errors — features that need ads will silently no-op.
  }
}
