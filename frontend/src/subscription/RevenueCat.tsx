/**
 * RevenueCat wrapper — module-scope configure, provider, and useSubscription hook.
 * Falls back to a stubbed "not entitled" state on web / Expo Go so the UI never
 * crashes; real purchases only occur on native dev / store builds.
 *
 * Setup provisioned (see /app/memory/revenuecat.md):
 *   entitlement_lookup_key: pro
 *   packages: $rc_monthly (₹99/mo), $rc_annual (₹699/yr)
 */
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";

const isExpoGo = Constants.executionEnvironment === "storeClient";
const isWeb = Platform.OS === "web";

// Guarded require — do NOT run react-native-purchases inside Expo Go / web.
let RC: any = null;
let LOG_LEVEL: any = null;
if (!isExpoGo && !isWeb) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-purchases");
    RC = mod.default;
    LOG_LEVEL = mod.LOG_LEVEL;
  } catch (e) {
    console.warn("[RC] react-native-purchases unavailable in this build:", e);
  }
}

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "pro";
export const rcNativeAvailable = !!RC;

function getApiKey(): string | null {
  const env: any = (globalThis as any)?.process?.env ?? {};
  if (Platform.OS === "ios") return env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || null;
  if (Platform.OS === "android") return env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || null;
  return env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY || null;
}

let _configured = false;
export function initializeRevenueCat() {
  if (!RC || _configured) return;
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[RC] Public API key missing — subscriptions disabled.");
    return;
  }
  try {
    if (LOG_LEVEL) RC.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    RC.configure({ apiKey });
    _configured = true;
  } catch (e) {
    console.warn("[RC] configure failed:", e);
  }
}

export type RCPackage = any;

type Ctx = {
  isSubscribed: boolean;
  identityReady: boolean;
  offerings: any;
  packages: RCPackage[];
  customerInfo: any;
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  purchase: (pkg: RCPackage) => Promise<void>;
  restore: () => Promise<void>;
  refresh: () => Promise<void>;
  identityError: string | null;
};

const SubContext = createContext<Ctx | null>(null);

export function SubscriptionProvider({ userId, children }: { userId?: string | null; children: React.ReactNode }) {
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [offerings, setOfferings] = useState<any>(null);
  const [isLoading, setLoading] = useState(true);
  const [isPurchasing, setPurchasing] = useState(false);
  const [isRestoring, setRestoring] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const identityRef = useRef<string | null>(null);

  const refresh = async () => {
    if (!RC) { setLoading(false); return; }
    try {
      const [info, offs] = await Promise.all([RC.getCustomerInfo(), RC.getOfferings()]);
      setCustomerInfo(info);
      setOfferings(offs);
    } catch (e) {
      console.warn("[RC] refresh failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // Bind identity on every auth change
  useEffect(() => {
    (async () => {
      if (!RC) { setLoading(false); return; }
      try {
        if (userId && identityRef.current !== userId) {
          await RC.logIn(userId);
          identityRef.current = userId;
          setIdentityError(null);
        } else if (!userId && identityRef.current) {
          await RC.logOut();
          identityRef.current = null;
        }
        await refresh();
      } catch (e: any) {
        setIdentityError(String(e?.message || e));
        setLoading(false);
      }
    })();
  }, [userId]);

  // Reactive customer-info listener
  useEffect(() => {
    if (!RC) return;
    const listener = (info: any) => setCustomerInfo(info);
    RC.addCustomerInfoUpdateListener(listener);
    return () => { try { RC.removeCustomerInfoUpdateListener(listener); } catch {} };
  }, []);

  const purchase = async (pkg: RCPackage) => {
    if (!RC) throw new Error("Purchases unavailable in this environment. Install a development or release build.");
    setPurchasing(true);
    try {
      const id = (await RC.getCustomerInfo()).originalAppUserId;
      if (id?.startsWith?.("$RCAnonymousID:")) throw new Error("Identity not ready — please sign in first.");
      const { customerInfo: info } = await RC.purchasePackage(pkg);
      setCustomerInfo(info);
    } finally {
      setPurchasing(false);
    }
  };

  const restore = async () => {
    if (!RC) throw new Error("Purchases unavailable.");
    setRestoring(true);
    try {
      const info = await RC.restorePurchases();
      setCustomerInfo(info);
    } finally {
      setRestoring(false);
    }
  };

  const isSubscribed = !!customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
  const originalAppUserId = customerInfo?.originalAppUserId;
  const identityReady = !!originalAppUserId && !String(originalAppUserId).startsWith("$RCAnonymousID:");
  const packages: RCPackage[] = offerings?.current?.availablePackages || [];

  const value: Ctx = {
    isSubscribed, identityReady, offerings, packages, customerInfo,
    isLoading, isPurchasing, isRestoring, identityError,
    purchase, restore, refresh,
  };
  return <SubContext.Provider value={value}>{children}</SubContext.Provider>;
}

export function useSubscription(): Ctx {
  const c = useContext(SubContext);
  if (!c) throw new Error("useSubscription must be used within SubscriptionProvider");
  return c;
}
