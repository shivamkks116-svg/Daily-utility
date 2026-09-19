/**
 * Web / Expo Go stubs — Metro selects this file over `native.native.tsx` when
 * bundling for platforms where `react-native-google-mobile-ads` cannot be
 * imported statically.
 */
import React from "react";

export const adsAvailable = false;
export const adUnitIds = { banner: undefined, interstitial: undefined, rewarded: undefined };

export async function initAds() { return false; }
export function AdStartup() { return null; }
export function AdBanner(_props: any) { return null; }
export async function showInterstitial(_isSubscribed = false) { return false; }
export function useRewardedAd(_onEarned?: () => void) {
  return { loaded: false, available: false, show: () => {} };
}
