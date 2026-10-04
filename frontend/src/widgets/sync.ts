/**
 * Keeps the DailyHub Android widgets in sync with the app's recents store.
 *
 *   • `syncWidgetRecents()`  — serialises the current recents list into a
 *     widget-friendly snapshot (AsyncStorage) and triggers a widget-wide
 *     refresh via `requestWidgetUpdate`.
 *   • `openWidgetRecent(id)` — resolves a widget-click deep link back to
 *     the full recent entry so the reader screens can load the actual
 *     cached file.
 *
 * The entire module is Android-only — on web / iOS every function
 * becomes a no-op so Metro and iOS builds don't choke on the native
 * `react-native-android-widget` surface.
 */
import { Platform } from "react-native";

import { listRecents, type RecentEntry } from "@/src/utils/toolkit/recents";
import { storage } from "@/src/utils/storage";
import { WIDGET_NAMES, WIDGET_RECENTS_KEY, type WidgetRecent } from "./types";

// Native-only lazy import so the Metro web bundler never resolves the
// react-native-android-widget native module (its JS layer calls into
// TurboModules which don't exist on web).
async function nativeRequestUpdate(widgetName: string, jsx: any) {
  if (Platform.OS !== "android") return;
  try {
    const mod = await import("react-native-android-widget");
    await mod.requestWidgetUpdate({
      widgetName,
      renderWidget: () => jsx,
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

    // Render fresh JSX for every pinned widget. We don't know which ones
    // the user has placed on their home screen, so blast both.
    const [{ QuickActionsWidget }, { RecentsWidget }] = await Promise.all([
      import("./DailyHubQuickActionsWidget"),
      import("./DailyHubRecentsWidget"),
    ]);
    const React = (await import("react")).default;

    await Promise.all([
      nativeRequestUpdate(WIDGET_NAMES.QUICK, React.createElement(QuickActionsWidget)),
      nativeRequestUpdate(
        WIDGET_NAMES.RECENTS,
        React.createElement(RecentsWidget, { recents }),
      ),
    ]);
  } catch (e) {
    console.warn("[widgets] syncWidgetRecents failed:", e);
  }
}

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
