/**
 * Theme apply + reload helper.
 *
 * Toggling the in-app theme has to do two things in order:
 *
 *   1. Call `Appearance.setColorScheme(scheme)` so the native layer
 *      remembers the override. This value survives a JS reload, which
 *      means after the reload every `StyleSheet.create()` call reads
 *      the matching palette (see `src/theme/index.ts`).
 *   2. Reload the JS runtime so already-created stylesheets are
 *      rebuilt. Without a reload the current session keeps rendering
 *      with the old palette because RN freezes StyleSheet values at
 *      module load.
 *
 * We prefer `expo-updates` for the reload (native path) and gracefully
 * fall back to `location.reload()` on web / Expo Go where
 * `reloadAsync()` isn't available. If every path fails we at least
 * persisted the user's choice so the next cold start picks it up.
 */

import { Appearance, Platform } from "react-native";
import { setTheme, type ThemeMode } from "@/src/utils/settings";

type Scheme = "light" | "dark";

function resolveScheme(mode: ThemeMode): Scheme | null {
  if (mode === "light" || mode === "dark") return mode;
  // "system" clears the native override; `null` tells Appearance to fall
  // back to the OS setting.
  return null;
}

async function reloadRuntime() {
  // Web — just reload the browser tab.
  if (Platform.OS === "web") {
    try {
      // @ts-expect-error — `window` only exists on web.
      if (typeof window !== "undefined" && window.location?.reload) {
        // @ts-expect-error — same reason.
        window.location.reload();
        return;
      }
    } catch {
      // ignore and fall through
    }
    return;
  }

  // Native — try expo-updates first.
  try {
    const Updates = await import("expo-updates");
    if (Updates?.reloadAsync) {
      await Updates.reloadAsync();
      return;
    }
  } catch {
    // expo-updates not available in Expo Go; try DevSettings next.
  }

  // Expo Go / dev builds — DevSettings has a reload hook.
  try {
    const RN = await import("react-native");
    // Not typed on every RN version — accessed via `any`.
    const dev = (RN as unknown as { DevSettings?: { reload?: () => void } }).DevSettings;
    if (dev?.reload) {
      dev.reload();
      return;
    }
  } catch {
    // give up — the pref is still persisted and will apply on next launch.
  }
}

/**
 * Persist the theme choice, update the native color-scheme override, and
 * reload the JS runtime so every StyleSheet rebuilds with the matching
 * palette. Call this from the Theme chooser.
 */
export async function applyThemeAndReload(mode: ThemeMode): Promise<void> {
  await setTheme(mode);
  const scheme = resolveScheme(mode);
  try {
    // `setColorScheme` with `null` restores the OS default — perfect for
    // "system" mode.
    Appearance.setColorScheme(scheme);
  } catch {
    // Older RN or Expo Go may not expose setColorScheme — we still rely
    // on the pref + reload to apply on next start.
  }
  // Push the new palette into any pinned Android home-screen widgets
  // before the reload so the user sees them repaint instantly.
  if (Platform.OS === "android") {
    try {
      const { syncWidgetRecents } = await import("@/src/widgets/sync");
      await syncWidgetRecents();
    } catch {}
  }
  // Give the UI a tick to show the "Theme: Light" toast before reload.
  await new Promise<void>((r) => setTimeout(r, 300));
  await reloadRuntime();
}

/**
 * Boot-time hook: read the saved theme pref and seed the native color
 * scheme override before any screen renders. Call once from the root
 * layout. Returns `true` once bootstrap is complete.
 */
export async function bootstrapTheme(): Promise<void> {
  const { getTheme } = await import("@/src/utils/settings");
  try {
    const pref = await getTheme();
    const scheme = resolveScheme(pref);
    // On web the palette module reads localStorage synchronously at load
    // time, so by the time this hook runs the right palette is already
    // picked — no reload needed, no Appearance override to maintain.
    if (Platform.OS === "web") return;

    // "System" mode (scheme === null) means "defer to the OS". Clear any
    // leftover Appearance override so RN reads the device setting live,
    // but DO NOT reload — reloading on every bootstrap would create an
    // infinite loop because `Appearance.getColorScheme()` always returns
    // the OS value (never null) which would never equal `scheme`.
    if (scheme === null) {
      try {
        Appearance.setColorScheme(null);
      } catch {}
      return;
    }

    const current = Appearance.getColorScheme();
    // Only mutate + reload if the user has an explicit light/dark pref
    // and it differs from what's already active.
    if (current !== scheme) {
      Appearance.setColorScheme(scheme);
      await reloadRuntime();
    }
  } catch {
    // best-effort bootstrap; a missing storage entry just keeps dark.
  }
}
