/**
 * DailyHub AI — "Recent Files" home-screen widget.
 *
 * Shows the user's quick action row + a vertical list of up to 3 most
 * recently created / opened PDFs or images. Tapping a row deep-links
 * directly into the appropriate reader screen.
 *
 * The recents snapshot is persisted as a plain JSON string under
 * `WIDGET_RECENTS_KEY` by `syncWidgetRecents` whenever the app's main
 * recents store changes. The task handler reads it synchronously via
 * AsyncStorage inside the headless widget process.
 */
import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

import type { WidgetRecent } from "./types";

const SURFACE = "#111412";
const SURFACE_SECONDARY = "#1B221E";
const SURFACE_TERTIARY = "#252D28";
const BRAND = "#5EBA8B";
const BRAND_TILE = "#1B3626";
const ON_SURFACE = "#E2E6E3";
const ON_SURFACE_MUTED = "#A0A5A1";

type Tile = { key: string; emoji: string; label: string; uri: string };

const TILES: Tile[] = [
  { key: "scan",  emoji: "📄", label: "Scan",   uri: "dailyhubai:///pdf-toolkit/images-to-pdf" },
  { key: "ai",    emoji: "🤖", label: "AI",     uri: "dailyhubai:///ai/chat" },
  { key: "note",  emoji: "📝", label: "Note",   uri: "dailyhubai:///notes" },
  { key: "qr",    emoji: "🔳", label: "QR",     uri: "dailyhubai:///qr" },
];

function formatWhen(ts: number): string {
  const now = Date.now();
  const diff = Math.max(0, now - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function TileView({ tile }: { tile: Tile }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: tile.uri }}
      style={{
        flex: 1,
        height: 56,
        backgroundColor: SURFACE_TERTIARY,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <TextWidget text={tile.emoji} style={{ fontSize: 18, color: ON_SURFACE }} />
      <TextWidget
        text={tile.label}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 10, fontWeight: "600", color: ON_SURFACE, textAlign: "center" }}
      />
    </FlexWidget>
  );
}

function RecentRow({ item }: { item: WidgetRecent }) {
  // Deep-link based on kind — PDF goes to reader, image to view screen.
  const uri =
    item.kind === "pdf"
      ? `dailyhubai:///pdf-toolkit/reader?widgetId=${encodeURIComponent(item.id)}`
      : `dailyhubai:///image-toolkit/view?widgetId=${encodeURIComponent(item.id)}`;
  const emoji = item.kind === "pdf" ? "📕" : "🖼️";

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: SURFACE_SECONDARY,
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginTop: 6,
      }}
    >
      <FlexWidget
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          backgroundColor: BRAND_TILE,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
        }}
      >
        <TextWidget text={emoji} style={{ fontSize: 16 }} />
      </FlexWidget>
      <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
        <TextWidget
          text={item.name || "Untitled"}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 12, fontWeight: "600", color: ON_SURFACE }}
        />
        <TextWidget
          text={`${item.tool ? item.tool + " · " : ""}${formatWhen(item.createdAt)}`}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 10, color: ON_SURFACE_MUTED, marginTop: 1 }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

function EmptyRecents() {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: "dailyhubai:///pdf-toolkit/images-to-pdf" }}
      style={{
        flex: 1,
        marginTop: 6,
        borderRadius: 14,
        backgroundColor: SURFACE_SECONDARY,
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <TextWidget
        text="No recent files yet"
        style={{ fontSize: 12, fontWeight: "600", color: ON_SURFACE }}
      />
      <TextWidget
        text="Tap to scan your first PDF ›"
        style={{ fontSize: 11, color: BRAND, marginTop: 2 }}
      />
    </FlexWidget>
  );
}

export function RecentsWidget({ recents }: { recents: WidgetRecent[] }) {
  const top = recents.slice(0, 3);

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
      {/* Header */}
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
        <TextWidget text="Open ›" style={{ fontSize: 11, color: ON_SURFACE_MUTED }} />
      </FlexWidget>

      {/* Quick tiles */}
      <FlexWidget
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          justifyContent: "space-between",
        }}
      >
        {TILES.map((t, i) => (
          <React.Fragment key={t.key}>
            <TileView tile={t} />
            {i < TILES.length - 1 ? <FlexWidget style={{ width: 6 }} /> : null}
          </React.Fragment>
        ))}
      </FlexWidget>

      {/* Recents list / empty */}
      {top.length === 0 ? (
        <EmptyRecents />
      ) : (
        <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
          {top.map((r) => (
            <RecentRow key={r.id} item={r} />
          ))}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
