/**
 * Headless task handler for `react-native-android-widget`.
 *
 * This runs in a background JS context (not the app UI) whenever Android
 * fires one of the widget lifecycle events:
 *   • WIDGET_ADDED    — user drops a widget on the home screen
 *   • WIDGET_UPDATE   — scheduled refresh (updatePeriodMillis)
 *   • WIDGET_RESIZED  — user resizes an existing widget
 *   • WIDGET_DELETED  — widget removed from home screen
 *   • WIDGET_CLICK    — tap on an element whose `clickAction` isn't a
 *                       built-in like OPEN_URI (we rely on OPEN_URI, so
 *                       this is a no-op right now).
 *
 * Theme handling:
 *   • When the user has an explicit "light" / "dark" pref in the app we
 *     render a single JSX in that palette.
 *   • When the user is on "system" (or has no pref yet) we return the
 *     library's `{ light, dark }` dual representation — Android then
 *     picks the matching variant automatically based on the device's
 *     current UI mode. See:
 *       node_modules/react-native-android-widget/lib/typescript/api/types.d.ts
 */
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WidgetRepresentation, WidgetTaskHandlerProps } from "react-native-android-widget";

import { QuickActionsWidget } from "./DailyHubQuickActionsWidget";
import { RecentsWidget } from "./DailyHubRecentsWidget";
import { WIDGET_NAMES, WIDGET_RECENTS_KEY, type WidgetRecent } from "./types";
import type { Scheme } from "./palette";

async function readRecents(): Promise<WidgetRecent[]> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
}

/**
 * Read the user's in-app theme pref directly from AsyncStorage.
 * Returns:
 *   • "light" / "dark"  → explicit override; render that single palette
 *   • "system"          → tells the caller to emit a `{ light, dark }`
 *                         dual representation so Android chooses.
 */
async function readThemePref(): Promise<Scheme | "system"> {
  try {
    const raw = await AsyncStorage.getItem("prefs.theme");
    if (!raw) return "system";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
    if (parsed === "light" || parsed === "dark") return parsed;
    return "system";
  } catch {
    return "system";
  }
}

type Builder = (recents: WidgetRecent[], scheme: Scheme) => React.JSX.Element;

const nameToBuilder: Record<string, Builder> = {
  [WIDGET_NAMES.QUICK]: (_r, scheme) => <QuickActionsWidget scheme={scheme} />,
  [WIDGET_NAMES.RECENTS]: (recents, scheme) => (
    <RecentsWidget recents={recents} scheme={scheme} />
  ),
};

function buildRepresentation(
  build: Builder,
  recents: WidgetRecent[],
  pref: Scheme | "system",
): WidgetRepresentation {
  if (pref === "system") {
    return {
      light: build(recents, "light"),
      dark: build(recents, "dark"),
    };
  }
  return build(recents, pref);
}

export async function widgetTaskHandler(
  props: WidgetTaskHandlerProps,
): Promise<void> {
  const { widgetInfo, widgetAction, renderWidget } = props;
  const build = nameToBuilder[widgetInfo.widgetName];
  if (!build) return;

  switch (widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      const [recents, pref] = await Promise.all([readRecents(), readThemePref()]);
      renderWidget(buildRepresentation(build, recents, pref));
      break;
    }
    case "WIDGET_DELETED":
      // Nothing to clean up right now.
      break;
    case "WIDGET_CLICK":
      // All taps use OPEN_URI, handled natively.
      break;
    default:
      break;
  }
}
