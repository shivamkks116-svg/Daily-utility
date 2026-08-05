// Web fallback: resolve false immediately so callers can gracefully degrade.
export function showRewardedAd(): Promise<boolean> {
  return Promise.resolve(false);
}
