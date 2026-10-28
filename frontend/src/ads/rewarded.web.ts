// Web stub — no rewarded ads on web / Expo Go.
export type RewardedResult = "earned" | "closed" | "unavailable";

export function showRewardedAdResult(_ssv?: { userId: string; customData: string }): Promise<RewardedResult> {
  return Promise.resolve("unavailable");
}

export function showRewardedAd(): Promise<boolean> {
  return Promise.resolve(false);
}
