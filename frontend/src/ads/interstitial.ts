// Interstitial shim — forwards to the native adapter. Trigger throttling and
// premium suppression happen inside `showInterstitial`.
import { showInterstitial } from "./native";

export function preloadInterstitial() { /* loaded lazily inside native.tsx */ }

/**
 * Show an interstitial at a natural transition. Returns silently — never
 * throws — so call sites don't need try/catch.
 *   trigger: "tool-launch" | "pdf-close" | "manual"
 */
export function maybeShowInterstitial(_trigger?: "tool-launch" | "pdf-close" | "manual") {
  void showInterstitial(false);
}
