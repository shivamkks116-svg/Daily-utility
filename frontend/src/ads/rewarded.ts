// Rewarded ad — resolves with true if the reward was earned, false otherwise.
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
} from "react-native-google-mobile-ads";
import { AD_UNIT_IDS } from "./ids";

const LOAD_TIMEOUT_MS = 20_000;

export function showRewardedAd(): Promise<boolean> {
  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(AD_UNIT_IDS.rewarded, {
      requestNonPersonalizedAdsOnly: true,
    });
    let earned = false;
    let settled = false;

    const cleanup = () => {
      try {
        unsubLoaded();
        unsubEarned();
        unsubClosed();
        unsubError();
      } catch {
        // ignore
      }
    };

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ok);
    };

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      try {
        ad.show().catch(() => finish(false));
      } catch {
        finish(false);
      }
    });
    const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    });
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      finish(earned);
    });
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
      finish(false);
    });

    // Safety timeout so callers aren't stuck if nothing loads.
    setTimeout(() => finish(earned), LOAD_TIMEOUT_MS);

    try {
      ad.load();
    } catch {
      finish(false);
    }
  });
}
