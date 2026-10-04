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
 */
import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

const SURFACE = "#111412";
const SURFACE_TERTIARY = "#252D28";
const BRAND = "#5EBA8B";
const BRAND_TILE = "#1B3626";
const ON_SURFACE = "#E2E6E3";
const ON_SURFACE_MUTED = "#A0A5A1";

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

function TileView({ tile }: { tile: Tile }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: tile.uri }}
      style={{
        flex: 1,
        height: "match_parent",
        backgroundColor: SURFACE_TERTIARY,
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
          backgroundColor: BRAND_TILE,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
        }}
      >
        <TextWidget
          text={tile.emoji}
          style={{ fontSize: 20, color: ON_SURFACE }}
        />
      </FlexWidget>
      <TextWidget
        text={tile.label}
        maxLines={1}
        truncate="END"
        style={{
          fontSize: 11,
          fontWeight: "600",
          color: ON_SURFACE,
          textAlign: "center",
        }}
      />
    </FlexWidget>
  );
}

export function QuickActionsWidget() {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: SURFACE,
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
          style={{ fontSize: 13, fontWeight: "700", color: BRAND }}
        />
        <TextWidget
          text="Open ›"
          style={{ fontSize: 11, color: ON_SURFACE_MUTED }}
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
            <TileView tile={t} />
            {i < TILES.length - 1 ? (
              <FlexWidget style={{ width: 6 }} />
            ) : null}
          </React.Fragment>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
