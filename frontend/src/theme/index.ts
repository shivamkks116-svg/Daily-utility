/**
 * DailyHub AI theme tokens.
 *
 * The palette picked at module load is driven by React Native's native
 * `Appearance` subsystem. User-level theme toggles call
 * `Appearance.setColorScheme(...)` and then reload the JS bundle so
 * every `StyleSheet.create()` re-runs with the freshly picked palette.
 *
 * This indirection keeps the ~60+ files that already `import { colors }`
 * working untouched while finally delivering a real theme-switch.
 */

import { Appearance } from "react-native";

// ---- Palettes --------------------------------------------------------------
// Dark palette (Material You Expressive — Moss / Emerald). Original design.
const DARK = {
  surface: "#111412",
  onSurface: "#E2E6E3",
  surfaceSecondary: "#1B221E",
  onSurfaceSecondary: "#C4C8C5",
  surfaceTertiary: "#252D28",
  onSurfaceTertiary: "#A0A5A1",
  surfaceInverse: "#E2E6E3",
  onSurfaceInverse: "#111412",

  brand: "#428C66",
  brandPrimary: "#5EBA8B",
  onBrandPrimary: "#003820",
  brandSecondary: "#2E4F3E",
  onBrandSecondary: "#AEE5C6",
  brandTertiary: "#1B3626",
  onBrandTertiary: "#8FCCA9",

  success: "#6DD58C",
  onSuccess: "#00391C",
  warning: "#F2B8B5",
  onWarning: "#410002",
  error: "#FFB4AB",
  onError: "#690005",
  info: "#A8C7FA",
  onInfo: "#062E6F",

  border: "#252D28",
  borderStrong: "#3A4740",
  divider: "#1E2722",

  transparent: "transparent",
} as const;

// Light palette — mirrored tokens tuned for the same Moss/Emerald brand.
const LIGHT: typeof DARK = {
  surface: "#F7FAF8",
  onSurface: "#111412",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1C211E",
  surfaceTertiary: "#E8EEE9",
  onSurfaceTertiary: "#555D57",
  surfaceInverse: "#111412",
  onSurfaceInverse: "#F7FAF8",

  brand: "#2F7A52",
  brandPrimary: "#1F5F3F",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#D5EEDF",
  onBrandSecondary: "#07321C",
  brandTertiary: "#E6F4EC",
  onBrandTertiary: "#07321C",

  success: "#15803D",
  onSuccess: "#FFFFFF",
  warning: "#B45309",
  onWarning: "#FFFFFF",
  error: "#B91C1C",
  onError: "#FFFFFF",
  info: "#1D4ED8",
  onInfo: "#FFFFFF",

  border: "#D8DED9",
  borderStrong: "#B5BEB7",
  divider: "#E8EEE9",

  transparent: "transparent",
};

// ---- Resolve palette at module load ---------------------------------------
// Priority:
//   1. On web, `window.localStorage` holds the saved pref synchronously
//      (AsyncStorage on react-native-web is a thin wrapper over
//      localStorage). We read it directly because `Appearance.setColorScheme`
//      doesn't survive `window.location.reload()` on web.
//   2. `Appearance.getColorScheme()` reflects whatever a previous session
//      pinned via `Appearance.setColorScheme(...)` on native (that
//      override persists across JS reloads in native memory).
//   3. Fall back to "dark" if nothing above resolves.
import { Platform } from "react-native";

function readSyncPref(): "light" | "dark" | null {
  if (Platform.OS !== "web") return null;
  try {
    // AsyncStorage on react-native-web stores JSON strings under the raw key.
    // `prefs.theme` is set by `src/utils/settings.ts` → `SETTINGS_KEYS.theme`.
    const g = globalThis as unknown as {
      localStorage?: { getItem(k: string): string | null };
    };
    const raw = g.localStorage?.getItem("prefs.theme");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed === "light" || parsed === "dark") return parsed;
    // "system" or anything else — defer to Appearance.
    return null;
  } catch {
    return null;
  }
}

function resolveScheme(): "light" | "dark" {
  const synced = readSyncPref();
  if (synced) return synced;
  return (Appearance.getColorScheme() ?? "dark") as "light" | "dark";
}

const SCHEME = resolveScheme();

export const colors = SCHEME === "light" ? LIGHT : DARK;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 44,
};

export const fontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
};

export const theme = { colors, spacing, radius, fontSize, fontWeight };

/**
 * Current resolved theme name — handy for one-off platform-specific
 * overrides without going through the hook.
 */
export const activeThemeName: "light" | "dark" = SCHEME;
