/**
 * Push notification registration (Emergent managed push relay).
 * Native only — every function is a no-op on web.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

const ASKED_KEY = "push_preprompt_shown";

/** Register the native FCM/APNs token with the backend (requires granted permission). */
export async function registerDevice(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return false;
    const token = await Notifications.getDevicePushTokenAsync();
    await api("/register-push", {
      method: "POST",
      body: { platform: Platform.OS, device_token: String(token.data) },
    });
    return true;
  } catch (e) {
    console.warn("[Push] register failed:", e);
    return false;
  }
}

/** Ask for permission (system prompt) then register. Returns the final permission status. */
export async function requestAndRegister(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  if (Platform.OS === "web") return { granted: false, canAskAgain: false };
  let perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted" && perm.canAskAgain) {
    perm = await Notifications.requestPermissionsAsync();
  }
  const granted = perm.status === "granted";
  if (granted) await registerDevice();
  return { granted, canAskAgain: perm.canAskAgain };
}

export async function wasPrePromptShown(): Promise<boolean> {
  return !!(await storage.getItem<boolean>(ASKED_KEY, false));
}

export async function markPrePromptShown() {
  await storage.setItem(ASKED_KEY, true);
}

export async function getDailyReminderPref(): Promise<boolean> {
  try {
    const r = await api<{ daily_reminder: boolean }>("/push/prefs");
    return r.daily_reminder;
  } catch {
    return true;
  }
}

export async function setDailyReminderPref(v: boolean) {
  await api("/push/prefs", { method: "PUT", body: { daily_reminder: v } });
}
