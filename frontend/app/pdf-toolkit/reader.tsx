import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState } from "@/src/components/toolkit/Primitives";
import { pickPdfs, sharePdf, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { addRecent } from "@/src/utils/toolkit/recents";
import { PdfViewer } from "@/src/components/PdfViewer";
import { PdfSearchSheet } from "@/src/components/PdfSearchSheet";
import { highlightPdf } from "@/src/utils/pdf";
import { bookmarkDocKey, getLastPage, listBookmarks, setLastPage, setProgress, toggleBookmark } from "@/src/utils/pdf/bookmarks";

/**
 * Native PDF Reader.
 *
 * Renders the picked PDF via `react-native-pdf` — Android `PdfRenderer` + iOS
 * `PDFKit` under the hood. Pages appear in milliseconds regardless of size
 * (no server round-trip, no base64 payload), with built-in pinch-zoom, page
 * scrolling and password support.
 *
 * Accepts route params `sharedUri` / `sharedName` / `sharedSize` when the
 * screen is opened from an Android VIEW/SEND intent — see
 * `src/utils/pdf/sharedIntent`.
 */
export default function PdfReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sharedUri?: string; sharedName?: string; sharedSize?: string; widgetId?: string }>();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [searchTab, setSearchTab] = useState<"search" | "links" | "bookmarks" | null>(null);
  const [jumpTo, setJumpTo] = useState<{ page: number } | undefined>(undefined);
  // Highlighted copy of the PDF (null = show original file).
  const [highlight, setHighlight] = useState<{ uri: string; query: string; matches: number } | null>(null);
  const [highlighting, setHighlighting] = useState(false);
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const docKey = file && numPages ? bookmarkDocKey(file, numPages) : null;

  useEffect(() => {
    setHighlight(null);
  }, [file?.uri]);

  useEffect(() => {
    if (!docKey) { setBookmarks([]); return; }
    listBookmarks(docKey).then((l) => setBookmarks(l.map((b) => b.page))).catch(() => {});
  }, [docKey]);

  const onToggleBookmark = async (page: number) => {
    if (!docKey) return;
    const next = await toggleBookmark(docKey, page);
    setBookmarks(next.map((b) => b.page));
  };

  const onHighlight = async (query: string, page: number) => {
    if (!file) return;
    if (highlight?.query.toLowerCase() === query.toLowerCase()) {
      setJumpTo({ page });
      setCurrentPage(page);
      return;
    }
    setHighlighting(true);
    try {
      const res = await highlightPdf(file.uri, query);
      setPendingPage(page);
      setHighlight({ uri: res.uri, query, matches: res.matches });
    } catch (e: unknown) {
      // Fall back to a plain jump if highlighting fails.
      setJumpTo({ page });
      setCurrentPage(page);
      Alert.alert("Couldn't highlight", (e as Error)?.message || String(e));
    } finally {
      setHighlighting(false);
    }
  };

  const clearHighlight = () => {
    setPendingPage(currentPage);
    setHighlight(null);
  };

  // Load a PDF shared via an intent.
  useEffect(() => {
    if (params.sharedUri && !file) {
      setFile({
        uri: String(params.sharedUri),
        name: String(params.sharedName || "Shared.pdf"),
        size: Number(params.sharedSize || 0),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sharedUri]);

  // Load a PDF selected from the home-screen widget.
  useEffect(() => {
    if (!params.widgetId || file) return;
    (async () => {
      try {
        const { openWidgetRecent } = await import("@/src/widgets/sync");
        const entry = await openWidgetRecent(String(params.widgetId));
        if (entry && entry.kind === "pdf") {
          setFile({ uri: entry.uri, name: entry.name, size: entry.size || 0 });
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.widgetId]);

  const pick = async () => {
    try {
      const [picked] = await pickPdfs({ multiple: false });
      if (!picked) return;
      setFile(picked);
      setNumPages(0);
      setCurrentPage(1);
      setPassword(undefined);
    } catch (e: unknown) {
      Alert.alert("Pick failed", (e as Error)?.message || String(e));
    }
  };

  const onLoad = (info: { numberOfPages: number }) => {
    setNumPages(info.numberOfPages);
    if (pendingPage) {
      const p = pendingPage;
      setPendingPage(null);
      setTimeout(() => { setJumpTo({ page: p }); setCurrentPage(p); }, 150);
    }
    if (highlight) return;
    if (file) {
      const key = bookmarkDocKey(file, info.numberOfPages);
      getLastPage(key).then((p) => {
        if (p > 1 && p <= info.numberOfPages) {
          setTimeout(() => { setJumpTo({ page: p }); setCurrentPage(p); }, 150);
        }
      }).catch(() => {});
      addRecent({
        kind: "pdf",
        uri: file.uri,
        name: file.name,
        size: file.size,
        tool: "Reader",
      }).catch(() => {});
    }
  };

  const onError = (err: unknown) => {
    const msg = (err as Error)?.message || String(err);
    if (msg.toLowerCase().includes("password")) {
      Alert.prompt?.(
        "Password required",
        "This PDF is protected. Enter its password:",
        (text) => setPassword(text || undefined),
        "secure-text",
      );
      return;
    }
    Alert.alert("Could not open PDF", msg);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <ToolkitHeader title="PDF Reader" onBack={() => router.back()} />

      {!file ? (
        <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
          <EmptyState
            icon="document-outline"
            title="Pick a PDF to view"
            subtitle="Native viewer with pinch-zoom, fast paging, and text selection."
            action={<PrimaryButton icon="folder-open" label="Choose PDF" onPress={pick} />}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.metaBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaName} numberOfLines={1}>{file.name}</Text>
              <Text style={styles.metaSub}>
                {numPages ? `Page ${currentPage} of ${numPages}` : "Loading…"}
                {file.size ? `  ·  ${humanBytes(file.size)}` : ""}
              </Text>
            </View>
            <Pressable testID="pdf-reader-search" onPress={() => setSearchTab("search")} style={styles.iconBtn}>
              <Ionicons name="search" size={18} color={colors.onSurface} />
            </Pressable>
            <Pressable testID="pdf-reader-links" onPress={() => setSearchTab("links")} style={styles.iconBtn}>
              <Ionicons name="link" size={18} color={colors.onSurface} />
            </Pressable>
            <Pressable onPress={pick} style={styles.iconBtn}>
              <Ionicons name="folder-open-outline" size={18} color={colors.onSurface} />
            </Pressable>
            <Pressable
              testID="pdf-reader-bookmark"
              onPress={() => onToggleBookmark(currentPage)}
              onLongPress={() => setSearchTab("bookmarks")}
              disabled={!docKey}
              style={styles.iconBtn}
            >
              <Ionicons
                name={bookmarks.includes(currentPage) ? "bookmark" : "bookmark-outline"}
                size={18}
                color={bookmarks.includes(currentPage) ? colors.brandPrimary : colors.onSurface}
              />
            </Pressable>
          </View>

          {highlighting || highlight ? (
            <View style={styles.hlBar} testID="pdf-highlight-bar">
              {highlighting ? (
                <>
                  <ActivityIndicator size="small" color={colors.brandPrimary} />
                  <Text style={styles.hlText}>Highlighting matches…</Text>
                </>
              ) : highlight ? (
                <>
                  <Ionicons name="color-wand" size={16} color={colors.brandPrimary} />
                  <Text style={styles.hlText} numberOfLines={1}>
                    &quot;{highlight.query}&quot; · {highlight.matches} match{highlight.matches === 1 ? "" : "es"}
                  </Text>
                  <Pressable testID="pdf-highlight-clear" onPress={clearHighlight} hitSlop={8} style={styles.hlClear}>
                    <Text style={styles.hlClearText}>Clear</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}

          <PdfViewer
            uri={highlight?.uri || file.uri}
            password={password}
            onLoad={onLoad}
            onPageChanged={(page) => {
              setCurrentPage(page);
              if (docKey) void setLastPage(docKey, page);
              if (file) void setProgress(file.uri, page, numPages);
            }}
            onError={onError}
            jumpTo={jumpTo}
          />

          <PdfSearchSheet
            visible={searchTab !== null}
            uri={file.uri}
            numPages={numPages}
            initialTab={searchTab || "search"}
            onClose={() => setSearchTab(null)}
            onJump={(page) => { setJumpTo({ page }); setCurrentPage(page); }}
            onHighlight={onHighlight}
            bookmarks={bookmarks}
            onRemoveBookmark={onToggleBookmark}
          />

          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
            <SecondaryButton
              icon="share-outline"
              label="Share PDF"
              onPress={() => sharePdf(file.uri)}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  metaBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  metaName: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  metaSub: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hlBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hlText: { flex: 1, color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  hlClear: { minHeight: 32, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  hlClearText: { color: colors.onBrandPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
