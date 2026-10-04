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
 * The handler re-renders fresh JSX via `renderWidget(...)` using the
 * latest recents snapshot pulled from AsyncStorage.
 */
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import { QuickActionsWidget } from "./DailyHubQuickActionsWidget";
import { RecentsWidget } from "./DailyHubRecentsWidget";
import { WIDGET_NAMES, WIDGET_RECENTS_KEY, type WidgetRecent } from "./types";

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

const nameToWidget: Record<
  string,
  (recents: WidgetRecent[]) => React.JSX.Element
> = {
  [WIDGET_NAMES.QUICK]: () => <QuickActionsWidget />,
  [WIDGET_NAMES.RECENTS]: (recents) => <RecentsWidget recents={recents} />,
};

export async function widgetTaskHandler(
  props: WidgetTaskHandlerProps,
): Promise<void> {
  const { widgetInfo, widgetAction, renderWidget } = props;
  const builder = nameToWidget[widgetInfo.widgetName];
  if (!builder) return;

  switch (widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      const recents = await readRecents();
      renderWidget(builder(recents));
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
