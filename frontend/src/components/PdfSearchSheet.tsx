/**
 * Search inside a PDF: find words (with page + snippet), jump to a page number,
 * and list every link in the document. Text is extracted once per file on the
 * server (/api/pdf/index) and searched locally.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal, View, Text, StyleSheet, Pressable, TextInput, FlatList, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { api } from "@/src/api/client";
import { readPdfBase64 } from "@/src/utils/pdf";
import { confirmOpenLink } from "@/src/utils/confirmLink";

type PdfIndex = { pages: { page: number; text: string }[]; links: { page: number; uri: string }[] };
type Tab = "search" | "links" | "bookmarks";
type Row =
  | { kind: "goto"; key: string; page: number }
  | { kind: "hit"; key: string; page: number; before: string; match: string; after: string }
  | { kind: "link"; key: string; page: number; uri: string }
  | { kind: "bookmark"; key: string; page: number };

const cache = new Map<string, PdfIndex>();
const MAX_HITS = 200;

export function PdfSearchSheet({
  visible, uri, numPages, initialTab = "search", onClose, onJump, onHighlight, bookmarks, onRemoveBookmark,
}: {
  visible: boolean;
  uri: string;
  numPages: number;
  initialTab?: Tab;
  onClose: () => void;
  onJump: (page: number) => void;
  /** Called when a search hit is tapped: highlight `query` and jump to `page`. */
  onHighlight: (query: string, page: number) => void;
  bookmarks: number[];
  onRemoveBookmark: (page: number) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<PdfIndex | null>(cache.get(uri) || null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (visible) setTab(initialTab); }, [visible, initialTab]);

  useEffect(() => {
    if (!visible || cache.has(uri)) { setIndex(cache.get(uri) || null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const file_base64 = await readPdfBase64(uri);
        const res = await api<PdfIndex>("/pdf/index", { method: "POST", body: { file_base64 } });
        cache.set(uri, res);
        if (!cancelled) setIndex(res);
      } catch (e: unknown) {
        if (!cancelled) setErr((e as Error)?.message || "Couldn't read this PDF's text.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, uri]);

  const rows = useMemo<Row[]>(() => {
    if (tab === "bookmarks") {
      return bookmarks.map((p) => ({ kind: "bookmark", key: `b${p}`, page: p }));
    }
    if (tab === "links") {
      return (index?.links || []).map((l, i) => ({ kind: "link", key: `l${i}`, page: l.page, uri: l.uri }));
    }
    const q = query.trim();
    if (!q) return [];
    const out: Row[] = [];
    if (/^\d+$/.test(q)) {
      const p = Number(q);
      if (p >= 1 && (!numPages || p <= numPages)) out.push({ kind: "goto", key: "goto", page: p });
    }
    if (q.length < 2 || !index) return out;
    const needle = q.toLowerCase();
    for (const pg of index.pages) {
      const text = pg.text.replace(/\s+/g, " ");
      const lower = text.toLowerCase();
      let from = 0;
      while (out.length < MAX_HITS) {
        const at = lower.indexOf(needle, from);
        if (at < 0) break;
        out.push({
          kind: "hit", key: `h${pg.page}-${at}`, page: pg.page,
          before: (at > 40 ? "…" : "") + text.slice(Math.max(0, at - 40), at),
          match: text.slice(at, at + q.length),
          after: text.slice(at + q.length, at + q.length + 60) + "…",
        });
        from = at + needle.length;
      }
    }
    return out;
  }, [tab, query, index, numPages, bookmarks]);

  const hitCount = rows.filter((r) => r.kind === "hit").length;

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === "goto") {
      return (
        <Pressable testID="pdf-search-goto" style={styles.row} onPress={() => { onJump(item.page); onClose(); }}>
          <Ionicons name="arrow-forward-circle" size={22} color={colors.brandPrimary} />
          <Text style={styles.rowTitle}>Go to page {item.page}</Text>
        </Pressable>
      );
    }
    if (item.kind === "bookmark") {
      return (
        <Pressable testID="pdf-bookmark-row" style={styles.row} onPress={() => { onJump(item.page); onClose(); }}>
          <Ionicons name="bookmark" size={20} color={colors.brandPrimary} />
          <Text style={[styles.rowTitle, { flex: 1 }]}>Page {item.page}</Text>
          <Pressable
            testID="pdf-bookmark-remove"
            hitSlop={8}
            onPress={() => onRemoveBookmark(item.page)}
            style={styles.pageBtn}
          >
            <Ionicons name="trash-outline" size={16} color={colors.onSurface} />
          </Pressable>
        </Pressable>
      );
    }
    if (item.kind === "link") {
      return (
        <Pressable testID="pdf-link-row" style={styles.row} onPress={() => confirmOpenLink(item.uri)}>
          <Ionicons name="link" size={20} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkText} numberOfLines={2}>{item.uri}</Text>
            <Text style={styles.pageTag}>Page {item.page}</Text>
          </View>
          <Pressable hitSlop={8} onPress={() => { onJump(item.page); onClose(); }} style={styles.pageBtn}>
            <Text style={styles.pageBtnText}>Go</Text>
          </Pressable>
        </Pressable>
      );
    }
    return (
      <Pressable testID="pdf-search-hit" style={styles.row} onPress={() => { onHighlight(query.trim(), item.page); onClose(); }}>
        <View style={styles.pageBadge}><Text style={styles.pageBadgeText}>{item.page}</Text></View>
        <Text style={styles.snippet} numberOfLines={2}>
          {item.before}<Text style={styles.match}>{item.match}</Text>{item.after}
        </Text>
      </Pressable>
    );
  };

  const empty = loading ? (
    <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /><Text style={styles.hint}>Reading PDF text…</Text></View>
  ) : err ? (
    <View style={styles.center}><Text style={styles.err}>{err}</Text></View>
  ) : tab === "bookmarks" ? (
    <View style={styles.center}><Text style={styles.hint}>No bookmarks yet. Tap the bookmark icon on any page to save it.</Text></View>
  ) : tab === "links" ? (
    <View style={styles.center}><Text style={styles.hint}>No links found in this PDF.</Text></View>
  ) : query.trim().length >= 2 ? (
    <View style={styles.center}>
      <Text style={styles.hint}>
        {index && index.pages.every((p) => !p.text.trim())
          ? "This PDF has no selectable text (it may be a scanned image)."
          : `No matches for "${query.trim()}".`}
      </Text>
    </View>
  ) : (
    <View style={styles.center}><Text style={styles.hint}>Type a word to search, or a page number to jump.</Text></View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="pdf-search-sheet">
        <View style={styles.header}>
          <View style={styles.inputWrap}>
            <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
            <TextInput
              testID="pdf-search-input"
              value={query}
              onChangeText={(t) => { setQuery(t); if (tab !== "search") setTab("search"); }}
              placeholder={`Search words or page (1-${numPages || "…"})`}
              placeholderTextColor={colors.onSurfaceTertiary}
              autoFocus={initialTab === "search"}
              returnKeyType="search"
              style={styles.input}
            />
            {query ? (
              <Pressable hitSlop={8} onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color={colors.onSurfaceTertiary} />
              </Pressable>
            ) : null}
          </View>
          <Pressable testID="pdf-search-close" onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {(["search", "links", "bookmarks"] as const).map((t) => (
            <Pressable
              key={t}
              testID={`pdf-tab-${t}`}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "search"
                  ? (query.trim().length >= 2 && index ? `Results (${hitCount})` : "Search")
                  : t === "links" ? `Links (${index?.links.length ?? 0})` : `Bookmarks (${bookmarks.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderRow}
          ListEmptyComponent={empty}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  inputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 48,
    paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, color: colors.onSurface, fontSize: fontSize.md, paddingVertical: spacing.sm },
  closeBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  closeText: { color: colors.brandPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md, minHeight: 36, justifyContent: "center", borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  tabText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  tabTextActive: { color: colors.onBrandPrimary },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 56,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  pageBadge: {
    minWidth: 36, height: 28, borderRadius: radius.sm, paddingHorizontal: 6,
    backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center",
  },
  pageBadgeText: { color: colors.onSurface, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  snippet: { flex: 1, color: colors.onSurfaceSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  match: { color: colors.onSurface, fontWeight: fontWeight.bold, backgroundColor: colors.brandPrimary + "33" },
  linkText: { color: colors.brandPrimary, fontSize: fontSize.sm, textDecorationLine: "underline" },
  pageTag: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  pageBtn: {
    minHeight: 36, paddingHorizontal: spacing.md, justifyContent: "center", borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  pageBtnText: { color: colors.onSurface, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  center: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  hint: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, textAlign: "center" },
  err: { color: colors.error, fontSize: fontSize.sm, textAlign: "center" },
});
