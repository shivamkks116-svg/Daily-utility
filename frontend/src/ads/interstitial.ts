// Interstitial ad manager for native platforms. Preloads once at app start and
// exposes a fire-and-forget `maybeShowInterstitial` that never blocks the caller.
import {
  AdEventType,
  InterstitialAd,
} from "react-native-google-mobile-ads";
import { AD_UNIT_IDS } from "./ids";

let interstitial: InterstitialAd | null = null;
let isLoaded = false;
let toolLaunchCount = 0;

// Show an interstitial on every Nth tool launch and after PDF close.
const TOOL_LAUNCH_INTERVAL = 3;
// Do not show more than one interstitial per this window.
const MIN_GAP_MS = 45_000;
let lastShownAt = 0;

function initAndLoad() {
  interstitial = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial, {
    requestNonPersonalizedAdsOnly: true,
  });
  isLoaded = false;
  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    isLoaded = true;
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    // Reload for next time.
    isLoaded = false;
    initAndLoad();
  });
  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    isLoaded = false;
    // Retry a bit later; avoid hot-loop.
    setTimeout(initAndLoad, 30_000);
  });
  try {
    interstitial.load();
  } catch {
    // ignore load throw; will retry on next preload
  }
}

export function preloadInterstitial() {
  if (!interstitial) initAndLoad();
}

export type InterstitialTrigger = "tool-launch" | "pdf-close" | "manual";

export function maybeShowInterstitial(trigger: InterstitialTrigger = "manual"): void {
  const now = Date.now();
  if (trigger === "tool-launch") {
    toolLaunchCount++;
    if (toolLaunchCount % TOOL_LAUNCH_INTERVAL !== 0) return;
  }
  if (now - lastShownAt < MIN_GAP_MS) return;
  if (!interstitial || !isLoaded) return;
  try {
    interstitial.show().catch(() => {});
    lastShownAt = now;
  } catch {
    // ignore
  }
}
