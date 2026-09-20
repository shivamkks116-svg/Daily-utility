/**
 * RevenueCat wrapper — provider, hook, purchase/restore helpers.
 *
 * Google Play config expected (must match RevenueCat dashboard exactly):
 *   • Product ID     : dailyhub_premium
 *   • Base plan ID   : monthly
 *   • Entitlement    : premium
 *
 * Falls back to a stubbed "not entitled" state on web / Expo Go so the UI
 * never crashes; real purchases only occur on native dev / release builds.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";

const isExpoGo = Constants.executionEnvironment === "storeClient";
const isWeb = Platform.OS === "web";

/* eslint-disable @typescript-eslint/no-explicit-any */
let RC: any = null;
let LOG_LEVEL: any = null;
let PURCHASES_ERROR_CODE: any = null;
if (!isExpoGo && !isWeb) {
  try {
    const mod = require("react-native-purchases");
    RC = mod.default;
    LOG_LEVEL = mod.LOG_LEVEL;
    PURCHASES_ERROR_CODE = mod.PURCHASES_ERROR_CODE;
  } catch (e) {
    console.warn("[RC] react-native-purchases unavailable in this build:", e);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * MUST match the entitlement identifier configured in RevenueCat dashboard
 * (Settings → Entitlements). Products / packages attach to this entitlement.
 */
export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

/** Expected Google Play product ID (used as fallback lookup if offerings.current is empty). */
export const REVENUECAT_PRODUCT_ID = "dailyhub_premium";

export const rcNativeAvailable = !!RC;

function getApiKey(): string | null {
  // Direct access — Metro inlines `process.env.EXPO_PUBLIC_*` at bundle time.
  if (Platform.OS === "ios") return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || null;
  if (Platform.OS === "android") return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || null;
  return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY || null;
}

let _configured = false;
export function initializeRevenueCat() {
  if (!RC || _configured) return;
  const apiKey = getApiKey();
  console.log("[RC]", JSON.stringify({
    event: "init_attempt",
    hasKey: !!apiKey,
    keyLength: apiKey ? apiKey.length : 0,
    platform: Platform.OS,
  }));
  if (!apiKey) {
    console.warn("[RC] Public API key missing — check EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY in .env and rebuild.");
    return;
  }
  try {
    if (LOG_LEVEL) RC.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    RC.configure({ apiKey });
    _configured = true;
    console.log("[RC]", JSON.stringify({ event: "configure_ok", entitlement: REVENUECAT_ENTITLEMENT_IDENTIFIER }));
  } catch (e) {
    console.warn("[RC] configure failed:", e);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type RCPackage = any;
type RCOfferings = any;
type RCCustomerInfo = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

type Ctx = {
  isSubscribed: boolean;
  identityReady: boolean;
  offerings: RCOfferings | null;
  packages: RCPackage[];
  customerInfo: RCCustomerInfo | null;
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  identityError: string | null;
  offeringsError: string | null;
  purchase: (pkg: RCPackage) => Promise<void>;
  restore: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SubContext = createContext<Ctx | null>(null);

/** Extract packages from the current or default offering (with fallback lookup). */
function extractPackages(offs: RCOfferings): RCPackage[] {
  if (!offs) return [];
  const current = offs.current;
  if (current?.availablePackages?.length) return current.availablePackages;

  // Fallback: try common named offerings if `current` isn't set on the dashboard.
  const all = offs.all || {};
  for (const key of ["default", "premium", "dailyhub", "main"]) {
    if (all[key]?.availablePackages?.length) return all[key].availablePackages;
  }

  // Last resort: flatten every offering.
  const flat: RCPackage[] = [];
  for (const off of Object.values(all)) {
    const pkgs = (off as { availablePackages?: RCPackage[] })?.availablePackages;
    if (pkgs?.length) flat.push(...pkgs);
  }
  return flat;
}

/** Translate RevenueCat / Purchases errors to human-friendly copy. */
function humanizePurchasesError(e: unknown): { code: string; message: string; userCancelled: boolean } {
  const err = e as { code?: string | number; message?: string; userCancelled?: boolean; underlyingErrorMessage?: string };
  const code = String(err?.code ?? "UNKNOWN");
  const userCancelled = !!err?.userCancelled || code === "PURCHASE_CANCELLED";
  if (userCancelled) return { code, userCancelled, message: "Purchase cancelled." };

  const errorCodes = PURCHASES_ERROR_CODE || {};
  const map: Record<string, string> = {
    [errorCodes.NETWORK_ERROR || "NETWORK_ERROR"]:
      "Network error. Check your internet connection and try again.",
    [errorCodes.PURCHASE_NOT_ALLOWED_ERROR || "PURCHASE_NOT_ALLOWED"]:
      "Purchases are not allowed on this device. Check parental controls / Play Store settings.",
    [errorCodes.PURCHASE_INVALID_ERROR || "PURCHASE_INVALID"]:
      "This purchase can't be completed. Try a different Google account or update Play Store.",
    [errorCodes.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR || "PRODUCT_NOT_AVAILABLE"]:
      "This subscription is not available for your Google account or region.",
    [errorCodes.STORE_PROBLEM_ERROR || "STORE_PROBLEM"]:
      "Google Play temporarily unavailable. Please try again later.",
    [errorCodes.PAYMENT_PENDING_ERROR || "PAYMENT_PENDING"]:
      "Payment is pending confirmation from Google Play.",
    [errorCodes.RECEIPT_ALREADY_IN_USE_ERROR || "RECEIPT_ALREADY_IN_USE"]:
      "This subscription is already active on another Google account.",
    [errorCodes.INVALID_CREDENTIALS_ERROR || "INVALID_CREDENTIALS"]:
      "Invalid RevenueCat API key. Check .env configuration.",
  };
  const msg = map[code] || err?.message || err?.underlyingErrorMessage || String(e);
  return { code, userCancelled, message: msg };
}

export function SubscriptionProvider({ userId, children }: { userId?: string | null; children: React.ReactNode }) {
  const [customerInfo, setCustomerInfo] = useState<RCCustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<RCOfferings | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isPurchasing, setPurchasing] = useState(false);
  const [isRestoring, setRestoring] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const identityRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!RC) { setLoading(false); return; }
    try {
      const [info, offs] = await Promise.all([
        RC.getCustomerInfo().catch((e: unknown) => {
          console.warn("[RC] getCustomerInfo failed:", e);
          return null;
        }),
        RC.getOfferings().catch((e: unknown) => {
          const h = humanizePurchasesError(e);
          console.warn("[RC] getOfferings failed:", h.code, h.message);
          setOfferingsError(`${h.message} (code: ${h.code})`);
          return null;
        }),
      ]);
      if (info) setCustomerInfo(info);
      if (offs) {
        setOfferings(offs);
        const pkgs = extractPackages(offs);
        console.log("[RC]", JSON.stringify({
          event: "offerings_loaded",
          currentId: offs?.current?.identifier || null,
          currentPackageCount: offs?.current?.availablePackages?.length || 0,
          totalOfferings: Object.keys(offs?.all || {}).length,
          resolvedPackageCount: pkgs.length,
        }));
        if (pkgs.length > 0) setOfferingsError(null);
        else setOfferingsError("No subscription products found. Please ensure products are configured and active in RevenueCat + Google Play Console.");
      }
    } catch (e) {
      const h = humanizePurchasesError(e);
      console.warn("[RC] refresh failed:", h.code, h.message);
      setOfferingsError(`${h.message} (code: ${h.code})`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Bind identity on every auth change
  useEffect(() => {
    (async () => {
      if (!RC) { setLoading(false); return; }
      try {
        if (userId && identityRef.current !== userId) {
          await RC.logIn(userId);
          identityRef.current = userId;
          setIdentityError(null);
          console.log("[RC]", JSON.stringify({ event: "identity_bound", userId }));
        } else if (!userId && identityRef.current) {
          await RC.logOut();
          identityRef.current = null;
          console.log("[RC]", JSON.stringify({ event: "identity_cleared" }));
        }
        await refresh();
      } catch (e) {
        const h = humanizePurchasesError(e);
        setIdentityError(`${h.message} (code: ${h.code})`);
        setLoading(false);
      }
    })();
  }, [userId, refresh]);

  // Reactive customer-info listener (fires on background purchases too)
  useEffect(() => {
    if (!RC) return;
    const listener = (info: RCCustomerInfo) => {
      setCustomerInfo(info);
      console.log("[RC]", JSON.stringify({
        event: "customer_info_update",
        hasEntitlement: !!info?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER],
      }));
    };
    RC.addCustomerInfoUpdateListener(listener);
    return () => { try { RC.removeCustomerInfoUpdateListener(listener); } catch {} };
  }, []);

  // Refresh on foreground — ensures Premium status is up-to-date after a
  // purchase from Play Store, external subscription change, or renewal.
  useEffect(() => {
    if (!RC) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const purchase = useCallback(async (pkg: RCPackage) => {
    if (!RC) throw new Error("Purchases unavailable in this environment. Install an Android development or release build.");
    if (!pkg) throw new Error("Invalid package.");

    console.log("[RC]", JSON.stringify({
      event: "purchase_start",
      packageId: pkg?.identifier,
      productId: pkg?.product?.identifier,
    }));

    setPurchasing(true);
    try {
      const id = (await RC.getCustomerInfo()).originalAppUserId;
      if (id?.startsWith?.("$RCAnonymousID:")) {
        throw new Error("Please sign in with Google or Email before subscribing.");
      }
      const { customerInfo: info } = await RC.purchasePackage(pkg);
      setCustomerInfo(info);
      const active = !!info?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
      console.log("[RC]", JSON.stringify({ event: "purchase_success", entitlementActive: active }));
      if (!active) {
        // RC reported a success but no entitlement — likely a configuration mismatch.
        throw new Error(
          "Purchase completed but Premium entitlement is not active. Check RevenueCat dashboard: the product 'dailyhub_premium' must be attached to entitlement 'premium'.",
        );
      }
    } catch (e) {
      const h = humanizePurchasesError(e);
      console.warn("[RC] purchase failed:", h.code, h.message);
      if (h.userCancelled) {
        // Rethrow a marker for the UI to silently swallow
        const err = new Error(h.message);
        (err as { userCancelled?: boolean }).userCancelled = true;
        throw err;
      }
      throw new Error(`${h.message} (code: ${h.code})`);
    } finally {
      setPurchasing(false);
    }
  }, []);

  const restore = useCallback(async () => {
    if (!RC) throw new Error("Purchases unavailable in this environment.");
    setRestoring(true);
    try {
      const info = await RC.restorePurchases();
      setCustomerInfo(info);
      const active = !!info?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
      console.log("[RC]", JSON.stringify({ event: "restore_done", entitlementActive: active }));
    } catch (e) {
      const h = humanizePurchasesError(e);
      console.warn("[RC] restore failed:", h.code, h.message);
      throw new Error(`${h.message} (code: ${h.code})`);
    } finally {
      setRestoring(false);
    }
  }, []);

  // Premium status is derived ONLY from RevenueCat customerInfo — never from
  // local state, never faked. This is the single source of truth.
  const isSubscribed = !!customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
  const originalAppUserId = customerInfo?.originalAppUserId;
  const identityReady = !!originalAppUserId && !String(originalAppUserId).startsWith("$RCAnonymousID:");
  const packages: RCPackage[] = offerings ? extractPackages(offerings) : [];

  const value: Ctx = {
    isSubscribed, identityReady, offerings, packages, customerInfo,
    isLoading, isPurchasing, isRestoring, identityError, offeringsError,
    purchase, restore, refresh,
  };
  return <SubContext.Provider value={value}>{children}</SubContext.Provider>;
}

export function useSubscription(): Ctx {
  const c = useContext(SubContext);
  if (!c) throw new Error("useSubscription must be used within SubscriptionProvider");
  return c;
}

/** Convenience hook for gating premium features. */
export function useIsPremium(): boolean {
  const { isSubscribed } = useSubscription();
  return isSubscribed;
}
