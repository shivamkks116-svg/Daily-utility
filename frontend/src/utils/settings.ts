// User preferences persisted locally via AsyncStorage.
// Keep this file small & dependency-free so it can be imported anywhere.
import { storage } from "@/src/utils/storage";

export type ThemeMode = "dark" | "light" | "system";
export type LanguageCode = "en" | "hi";

export const SETTINGS_KEYS = {
  theme: "prefs.theme",
  language: "prefs.language",
  notifications: "prefs.notifications",
  appLock: "prefs.appLock",
} as const;

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: "English",
  hi: "हिन्दी (Hindi)",
};

export const THEME_LABELS: Record<ThemeMode, string> = {
  dark: "Dark (Material You)",
  light: "Light",
  system: "Match system",
};

export async function getTheme(): Promise<ThemeMode> {
  const v = await storage.getItem<string>(SETTINGS_KEYS.theme, "dark");
  return (v as ThemeMode) || "dark";
}

export async function setTheme(v: ThemeMode) {
  await storage.setItem(SETTINGS_KEYS.theme, v);
}

export async function getLanguage(): Promise<LanguageCode> {
  const v = await storage.getItem<string>(SETTINGS_KEYS.language, "en");
  return (v as LanguageCode) || "en";
}

export async function setLanguage(v: LanguageCode) {
  await storage.setItem(SETTINGS_KEYS.language, v);
}

export async function getNotifications(): Promise<boolean> {
  const v = await storage.getItem<boolean>(SETTINGS_KEYS.notifications, true);
  return v ?? true;
}

export async function setNotifications(v: boolean) {
  await storage.setItem(SETTINGS_KEYS.notifications, v);
}

export async function getAppLock(): Promise<boolean> {
  const v = await storage.getItem<boolean>(SETTINGS_KEYS.appLock, false);
  return v ?? false;
}

export async function setAppLock(v: boolean) {
  await storage.setItem(SETTINGS_KEYS.appLock, v);
}

// Roughly estimate local storage used by the app across AsyncStorage keys.
export async function getEstimatedStorageBytes(): Promise<number> {
  try {
    // Dynamic import so this file has zero side-effect imports.
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const keys = await AsyncStorage.getAllKeys();
    if (!keys.length) return 0;
    const entries = await AsyncStorage.multiGet(keys);
    let bytes = 0;
    for (const [k, v] of entries) {
      bytes += (k?.length || 0) + (v?.length || 0);
    }
    return bytes;
  } catch {
    return 0;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
