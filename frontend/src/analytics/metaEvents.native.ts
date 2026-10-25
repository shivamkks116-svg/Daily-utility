/**
 * Meta (Facebook) App Events — native only.
 * App Install + Activate App are logged automatically by the SDK
 * (autoLogAppEventsEnabled in app.json); these helpers add custom events.
 */
import Constants from "expo-constants";
import { storage } from "@/src/utils/storage";

const isExpoGo = Constants.executionEnvironment === "storeClient";
let fb: any = null;
if (!isExpoGo) {
  try { fb = require("react-native-fbsdk-next"); } catch {}
}

let initialized = false;
export function initializeMetaEvents() {
  if (initialized || !fb) return;
  initialized = true;
  try { fb.Settings.initializeSDK(); } catch {}
}

/** Logged once per user per device. */
export async function logCompletedRegistration(userId: string, method: string) {
  if (!fb) return;
  const key = `meta_reg_logged:${userId}`;
  if (await storage.getItem<boolean>(key, false)) return;
  try {
    const { AppEventsLogger } = fb;
    AppEventsLogger.logEvent(AppEventsLogger.AppEvents.CompletedRegistration, {
      [AppEventsLogger.AppEventParams.RegistrationMethod]: method,
    });
    await storage.setItem(key, true);
  } catch {}
}

export function logPurchase(amount: number, currency: string) {
  if (!fb || !amount) return;
  try { fb.AppEventsLogger.logPurchase(amount, currency || "INR", { fb_content_type: "premium" }); } catch {}
}

export function logToolUsed(tool: string) {
  if (!fb) return;
  try { fb.AppEventsLogger.logEvent("ToolUsed", { tool }); } catch {}
}
