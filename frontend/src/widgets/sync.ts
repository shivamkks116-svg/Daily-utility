/**
 * Keeps the DailyHub Android widgets in sync with the app's recents
 * store and theme preference.
 *
 *   • `syncWidgetRecents()`   — serialises the current recents list +
 *     resolved theme into a widget-friendly snapshot (AsyncStorage) and
 *     triggers a widget-wide refresh via `requestWidgetUpdate`.
 *   • `openWidgetRecent(id)`  — resolves a widget-click deep link back
 *     to the full recent entry so the reader screens can load the
 *     actual cached file.
 *   • `requestPinQuickActions()` — opens the launcher's native pin
 *     prompt (Android 8.0+ where supported).
 *
 * The entire module is Android-only — on web / iOS every function
 * becomes a no-op so Metro and iOS builds don't choke on the native
 * `react-native-android-widget` surface.
 */
import { Platform } from "react-native";

import { listRecents, type RecentEntry } from "@/src/utils/toolkit/recents";
import { storage } from "@/src/utils/storage";
import { WIDGET_NAMES, WIDGET_RECENTS_KEY, type WidgetRecent } from "./types";
import { resolveWidgetScheme } from "./palette";

// Native-only lazy import so the Metro web bundler never resolves the
// react-native-android-widget native module (its JS layer calls into
// TurboModules which don't exist on web).
async function nativeRequestUpdate(
  widgetName: string,
  renderBoth: () => Promise<any> | any,
) {
  if (Platform.OS !== "android") return;
  try {
    const mod = await import("react-native-android-widget");
    await mod.requestWidgetUpdate({
      widgetName,
      renderWidget: async () => await renderBoth(),
      widgetNotFound: () => {
        // No pinned widget of that name — silently ignore so the host
        // app doesn't spam logs when the user hasn't added a widget.
      },
    });
  } catch (e) {
    console.warn("[widgets] requestWidgetUpdate failed:", e);
  }
}

/**
 * Project a `RecentEntry` into the lightweight shape the widget needs.
 * The widget JSX runs in a headless process so we strip anything that
 * would make serialisation flaky (functions, large metadata blobs).
 */
function toWidgetRecent(r: RecentEntry): WidgetRecent {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    tool: r.tool,
    createdAt: r.createdAt,
  };
}

export async function syncWidgetRecents(): Promise<void> {
  try {
    const recents = (await listRecents()).slice(0, 10).map(toWidgetRecent);
    await storage.setItem(WIDGET_RECENTS_KEY, JSON.stringify(recents));

    if (Platform.OS !== "android") return;

    // Resolve the current theme once per sync so both widgets get the
    // same scheme. For "system" we emit the library's dual
    // representation so Android chooses based on the device UI mode.
    const [{ QuickActionsWidget }, { RecentsWidget }, React] = await Promise.all([
      import("./DailyHubQuickActionsWidget"),
      import("./DailyHubRecentsWidget"),
      import("react").then((m) => m.default),
    ]);

    // Read raw pref — we want to know if the user selected "system" so
    // we can send both variants rather than one.
    const { default: AsyncStorage } = await import(
      "@react-native-async-storage/async-storage"
    );
    const raw = await AsyncStorage.getItem("prefs.theme");
    let pref: "light" | "dark" | "system" = "system";
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed === "light" || parsed === "dark") pref = parsed;
    } catch {}

    const makeQuick = () => {
      if (pref === "system") {
        return {
          light: React.createElement(QuickActionsWidget, { scheme: "light" }),
          dark: React.createElement(QuickActionsWidget, { scheme: "dark" }),
        };
      }
      return React.createElement(QuickActionsWidget, { scheme: pref });
    };
    const makeRecents = () => {
      if (pref === "system") {
        return {
          light: React.createElement(RecentsWidget, { recents, scheme: "light" }),
          dark: React.createElement(RecentsWidget, { recents, scheme: "dark" }),
        };
      }
      return React.createElement(RecentsWidget, { recents, scheme: pref });
    };

    await Promise.all([
      nativeRequestUpdate(WIDGET_NAMES.QUICK, makeQuick),
      nativeRequestUpdate(WIDGET_NAMES.RECENTS, makeRecents),
    ]);
  } catch (e) {
    console.warn("[widgets] syncWidgetRecents failed:", e);
  }
}

/** Expose the resolver for other call sites (e.g. previews, tests). */
export { resolveWidgetScheme };

/** Resolve a widget deep-link `widgetId` param back to the stored URI. */
export async function openWidgetRecent(widgetId: string): Promise<RecentEntry | null> {
  if (!widgetId) return null;
  try {
    const all = await listRecents();
    return all.find((r) => r.id === widgetId) ?? null;
  } catch {
    return null;
  }
}

/**
 * Ask the user to pin the widget programmatically.
 *   Available only on Android 8.0+ launchers that implement the
 *   `requestPinAppWidget` system call.
 */
export async function requestPinQuickActions(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  try {
    const mod = await import("react-native-android-widget");
    return await mod.requestPinWidget({ widgetName: WIDGET_NAMES.QUICK });
  } catch (e) {
    console.warn("[widgets] requestPinWidget failed:", e);
    return false;
  }
}
