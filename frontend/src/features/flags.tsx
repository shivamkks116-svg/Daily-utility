/**
 * Public feature-flag provider.
 *
 * Fetches `/api/config/public` at app startup (no auth needed) and exposes a
 * tiny context so any screen can conditionally render premium / admin
 * surfaces. The flag is cached in AsyncStorage so cold starts are instant;
 * the server copy is re-fetched in the background on every mount.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/api/client";

const CACHE_KEY = "feature_flags_v1";
const DEFAULTS: FeatureFlags = {
  premium_enabled: false,
};

export type FeatureFlags = {
  premium_enabled: boolean;
};

type Ctx = {
  flags: FeatureFlags;
  loading: boolean;
  refresh: () => Promise<void>;
};

const FlagsContext = createContext<Ctx>({
  flags: DEFAULTS,
  loading: true,
  refresh: async () => {},
});

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const body = await api<Partial<FeatureFlags>>("/config/public", {
        method: "GET",
      });
      const merged: FeatureFlags = {
        premium_enabled: !!body.premium_enabled,
      };
      if (mounted.current) {
        setFlags(merged);
        await storage.setItem(CACHE_KEY, JSON.stringify(merged));
      }
    } catch {
      // Network error — keep whatever we had cached. Premium stays hidden
      // (DEFAULTS) until the first successful fetch.
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Fast path — hydrate from cache so there's no flash of hidden UI if
    // premium was enabled on the previous launch.
    (async () => {
      try {
        const cached = await storage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as Partial<FeatureFlags>;
          setFlags({
            premium_enabled: !!parsed.premium_enabled,
          });
        }
      } catch {
        // ignore malformed cache
      }
      refresh();
    })();

    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return (
    <FlagsContext.Provider value={{ flags, loading, refresh }}>
      {children}
    </FlagsContext.Provider>
  );
}

export function useFeatureFlags(): Ctx {
  return useContext(FlagsContext);
}

/** Shortcut hook for the single most-used flag. */
export function usePremiumEnabled(): boolean {
  return useContext(FlagsContext).flags.premium_enabled;
}
