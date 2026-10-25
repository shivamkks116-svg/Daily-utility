/**
 * Reads the Google Play Install Referrer once per device and reports it to the
 * backend, which classifies it (Meta / Google Ads / organic) for the admin panel.
 */
import { Platform } from "react-native";
import * as Application from "expo-application";
import { api } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

const KEY = "install_source_reported";

export async function reportInstallSource() {
  if (Platform.OS !== "android") return;
  if (await storage.getItem<boolean>(KEY, false)) return;
  let referrer = "";
  try {
    referrer = await Application.getInstallReferrerAsync();
  } catch {}
  try {
    await api("/install-source", { method: "POST", body: { referrer: referrer || "" } });
    await storage.setItem(KEY, true);
  } catch {}
}
