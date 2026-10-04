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
 *
 * The `scheme` prop lets the task handler re-render the widget in light
 * or dark palette on demand.
 */
import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

import type { WidgetRecent } from "./types";
import { paletteFor, type Scheme } from "./palette";

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

function TileView({ tile, scheme }: { tile: Tile; scheme: Scheme }) {
  const c = paletteFor(scheme);
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: tile.uri }}
      style={{
        flex: 1,
        height: 56,
        backgroundColor: c.surfaceTertiary,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <TextWidget text={tile.emoji} style={{ fontSize: 18, color: c.onSurface }} />
      <TextWidget
        text={tile.label}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 10, fontWeight: "600", color: c.onSurface, textAlign: "center" }}
      />
    </FlexWidget>
  );
}

function RecentRow({ item, scheme }: { item: WidgetRecent; scheme: Scheme }) {
  const c = paletteFor(scheme);
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
        backgroundColor: c.surfaceSecondary,
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
          backgroundColor: c.brandTile,
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
          style={{ fontSize: 12, fontWeight: "600", color: c.onSurface }}
        />
        <TextWidget
          text={`${item.tool ? item.tool + " · " : ""}${formatWhen(item.createdAt)}`}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 10, color: c.onSurfaceMuted, marginTop: 1 }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

function EmptyRecents({ scheme }: { scheme: Scheme }) {
  const c = paletteFor(scheme);
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: "dailyhubai:///pdf-toolkit/images-to-pdf" }}
      style={{
        flex: 1,
        marginTop: 6,
        borderRadius: 14,
        backgroundColor: c.surfaceSecondary,
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <TextWidget
        text="No recent files yet"
        style={{ fontSize: 12, fontWeight: "600", color: c.onSurface }}
      />
      <TextWidget
        text="Tap to scan your first PDF ›"
        style={{ fontSize: 11, color: c.brand, marginTop: 2 }}
      />
    </FlexWidget>
  );
}

export function RecentsWidget({
  recents,
  scheme = "dark",
}: {
  recents: WidgetRecent[];
  scheme?: Scheme;
}) {
  const c = paletteFor(scheme);
  const top = recents.slice(0, 3);

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
          style={{ fontSize: 13, fontWeight: "700", color: c.brand }}
        />
        <TextWidget text="Open ›" style={{ fontSize: 11, color: c.onSurfaceMuted }} />
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
            <TileView tile={t} scheme={scheme} />
            {i < TILES.length - 1 ? <FlexWidget style={{ width: 6 }} /> : null}
          </React.Fragment>
        ))}
      </FlexWidget>

      {/* Recents list / empty */}
      {top.length === 0 ? (
        <EmptyRecents scheme={scheme} />
      ) : (
        <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
          {top.map((r) => (
            <RecentRow key={r.id} item={r} scheme={scheme} />
          ))}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
