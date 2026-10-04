/**
 * Shared types for DailyHub AI Android home-screen widgets.
 */

export type WidgetRecent = {
  id: string;
  name: string;
  kind: "pdf" | "image";
  tool?: string;
  // Serialized epoch ms — widget JSX runs in a headless JS context and
  // Date formatting is deferred so the storage layer stays simple.
  createdAt: number;
};

export const WIDGET_RECENTS_KEY = "dailyhub_widget_recents_v1";
export const WIDGET_NAMES = {
  QUICK: "DailyHubQuickActions",
  RECENTS: "DailyHubRecents",
} as const;
