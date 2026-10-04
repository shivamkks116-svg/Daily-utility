/**
 * Palette tokens for DailyHub Android home-screen widgets.
 *
 * Mirrors the Dark / Light palette from `src/theme/index.ts` but trimmed
 * down to just the colors the widget JSX actually consumes. Kept
 * separate because:
 *
 *   • Widget JSX runs in the headless task context — no React Native
 *     Appearance subscription is set up there, so colors must be
 *     resolved explicitly from a scheme string.
 *   • The main theme module freezes its palette at module load (see
 *     the "resolveScheme at module load" comment in src/theme/index.ts),
 *     so we can't just re-use its exported `colors` object inside the
 *     widget — we need both palettes available side-by-side so the
 *     task handler can pick one per update tick.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, Platform } from "react-native";

export type Scheme = "light" | "dark";

export type WidgetPalette = {
  surface: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  brand: string;
  brandTile: string;
  onSurface: string;
  onSurfaceMuted: string;
};

export const WIDGET_PALETTES: Record<Scheme, WidgetPalette> = {
  dark: {
    surface: "#111412",
    surfaceSecondary: "#1B221E",
    surfaceTertiary: "#252D28",
    brand: "#5EBA8B",
    brandTile: "#1B3626",
    onSurface: "#E2E6E3",
    onSurfaceMuted: "#A0A5A1",
  },
  light: {
    surface: "#F7FAF8",
    surfaceSecondary: "#FFFFFF",
    surfaceTertiary: "#E8EEE9",
    brand: "#1F5F3F",
    brandTile: "#D5EEDF",
    onSurface: "#111412",
    onSurfaceMuted: "#555D57",
  },
};

/**
 * Resolve the scheme the widget should render with.
 *
 * Priority:
 *   1. User-selected pref in AsyncStorage (`prefs.theme`). Stored as
 *      JSON-stringified `"light" | "dark" | "system"` by
 *      `src/utils/settings.ts`.
 *   2. If pref is "system" or missing → fall back to
 *      `Appearance.getColorScheme()` (works in headless RN JS context
 *      too; it reads from the native UIManager).
 *   3. Default to "dark" so a fresh install matches the app's original
 *      brand.
 */
export async function resolveWidgetScheme(): Promise<Scheme> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    // Headless web context never runs widgets, but keep this safe.
    return "dark";
  }
  try {
    const raw = await AsyncStorage.getItem("prefs.theme");
    if (raw) {
      // Value is JSON-stringified: `"\"light\""` → "light"
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
      if (parsed === "light" || parsed === "dark") return parsed;
    }
  } catch {
    // ignore and fall through
  }
  const sys = Appearance.getColorScheme();
  return sys === "light" ? "light" : "dark";
}

export function paletteFor(scheme: Scheme): WidgetPalette {
  return WIDGET_PALETTES[scheme] ?? WIDGET_PALETTES.dark;
}
