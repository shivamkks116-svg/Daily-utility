/**
 * DailyHub AI — "Quick Actions" home-screen widget.
 *
 * 4 one-tap tiles that deep-link into the most used tools:
 *   • Scan PDF  → /pdf-toolkit/images-to-pdf
 *   • AI Chat   → /ai/chat
 *   • New Note  → /notes
 *   • Scan QR   → /qr
 *
 * Rendered via `react-native-android-widget` RemoteViews — this JSX only
 * runs inside the headless widget task process, never inside the app UI.
 *
 * The `scheme` prop lets the task handler re-render the widget in light
 * or dark palette on demand (see `widgetTaskHandler.tsx`).
 */
import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

import { paletteFor, type Scheme } from "./palette";

type Tile = {
  key: string;
  emoji: string;
  label: string;
  uri: string;
};

const TILES: Tile[] = [
  { key: "scan",  emoji: "📄", label: "Scan PDF", uri: "dailyhubai:///pdf-toolkit/images-to-pdf" },
  { key: "ai",    emoji: "🤖", label: "AI Chat",  uri: "dailyhubai:///ai/chat" },
  { key: "note",  emoji: "📝", label: "New Note", uri: "dailyhubai:///notes" },
  { key: "qr",    emoji: "🔳", label: "Scan QR",  uri: "dailyhubai:///qr" },
];

function TileView({ tile, scheme }: { tile: Tile; scheme: Scheme }) {
  const c = paletteFor(scheme);
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: tile.uri }}
      style={{
        flex: 1,
        height: "match_parent",
        backgroundColor: c.surfaceTertiary,
        borderRadius: 20,
        padding: 8,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <FlexWidget
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          backgroundColor: c.brandTile,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
        }}
      >
        <TextWidget
          text={tile.emoji}
          style={{ fontSize: 20, color: c.onSurface }}
        />
      </FlexWidget>
      <TextWidget
        text={tile.label}
        maxLines={1}
        truncate="END"
        style={{
          fontSize: 11,
          fontWeight: "600",
          color: c.onSurface,
          textAlign: "center",
        }}
      />
    </FlexWidget>
  );
}

export function QuickActionsWidget({ scheme = "dark" }: { scheme?: Scheme } = {}) {
  const c = paletteFor(scheme);
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: c.surface,
        borderRadius: 24,
        padding: 10,
        flexDirection: "column",
      }}
    >
      {/* Header row */}
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: "dailyhubai:///(main)/home" }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
          paddingHorizontal: 4,
        }}
      >
        <TextWidget
          text="DailyHub AI"
          style={{ fontSize: 13, fontWeight: "700", color: c.brand }}
        />
        <TextWidget
          text="Open ›"
          style={{ fontSize: 11, color: c.onSurfaceMuted }}
        />
      </FlexWidget>

      {/* Tiles row */}
      <FlexWidget
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "stretch",
          justifyContent: "space-between",
        }}
      >
        {TILES.map((t, i) => (
          <React.Fragment key={t.key}>
            <TileView tile={t} scheme={scheme} />
            {i < TILES.length - 1 ? (
              <FlexWidget style={{ width: 6 }} />
            ) : null}
          </React.Fragment>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
