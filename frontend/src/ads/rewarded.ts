// Rewarded ad stub — resolves false so callers gracefully degrade
// (AILimitDialog shows a friendly "Ads unavailable" message).
export function showRewardedAd(): Promise<boolean> {
  return Promise.resolve(false);
}
