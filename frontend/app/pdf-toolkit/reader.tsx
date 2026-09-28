import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  Alert,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import {
  ToolkitHeader,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  ProgressBanner,
} from "@/src/components/toolkit/Primitives";
import { pickPdfs, sharePdf, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { getPdfPageCount, pdfRenderPages } from "@/src/utils/pdf";
import { addRecent } from "@/src/utils/toolkit/recents";

/**
 * PDF Reader / Viewer — renders every page as an image server-side and
 * displays them in a scrollable list. Supports:
 *   • Fit Width (default) vs Fit Page modes
 *   • 1x / 1.5x / 2x zoom levels via toolbar
 *   • Horizontal pan when zoomed in
 *   • Live "Page X of N" indicator + prev/next jump
 *
 * Accepts route params `sharedUri` / `sharedName` / `sharedSize` when
 * launched from a shared intent (see `src/utils/pdf/sharedIntent`).
 */

type Fit = "width" | "page";
type PageImg = { page: number; uri: string; width: number; height: number; loaded: boolean };

const ZOOM_LEVELS = [1, 1.5, 2] as const;
const FIRST_BATCH = 2;   // pages fetched before showing anything
const CHUNK_SIZE = 4;    // pages fetched per background batch
const DEFAULT_ASPECT = 1 / 1.414; // A4 portrait fallback while a page is still loading

export default function PdfReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    sharedUri?: string;
    sharedName?: string;
    sharedSize?: string;
  }>();

  const [file, setFile] = useState<PickedPdf | null>(null);
  const [pages, setPages] = useState<PageImg[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [fit, setFit] = useState<Fit>("width");
  const [zoom, setZoom] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState(1);

  const scrollRef = useRef<ScrollView>(null);
  const pageOffsets = useRef<number[]>([]);

  const win = useMemo(() => Dimensions.get("window"), []);
  const contentWidth = win.width - spacing.lg * 2;
  const maxPageHeight = win.height - insets.top - insets.bottom - 220;

  // Load a PDF passed in via shared intent.
  useEffect(() => {
    if (params.sharedUri && !file) {
      setFile({
        uri: String(params.sharedUri),
        name: String(params.sharedName || "Shared.pdf"),
        size: Number(params.sharedSize || 0),
      });
      setPages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sharedUri]);

  const cancelRenderRef = useRef(false);

  const pick = async () => {
    try {
      const [picked] = await pickPdfs({ multiple: false });
      if (!picked) return;
      cancelRenderRef.current = true; // stop any in-flight background render
      setFile(picked);
      setPages([]);
      setCurrentPage(1);
      setZoom(1);
    } catch (e: unknown) {
      Alert.alert("Pick failed", (e as Error)?.message || String(e));
    }
  };

  /**
   * Progressive render:
   *   1. Ask the server for JUST the total page count → instantly know the
   *      shape of the document.
   *   2. Fetch the first `FIRST_BATCH` pages at 130 DPI JPEG → show them.
   *   3. In the background, walk through the rest in `CHUNK_SIZE` batches
   *      and stitch them in as they arrive.
   * The user sees page 1 in ~1-2 seconds instead of waiting for the whole
   * document to render.
   */
  const render = async () => {
    if (!file) return;
    cancelRenderRef.current = false;
    setBusy(true);
    setStatus("Opening PDF…");
    try {
      const total = await getPdfPageCount(file.uri);
      if (total <= 0) {
        Alert.alert("Empty PDF", "This document has no pages.");
        setStatus("");
        return;
      }
      // Seed the page list with placeholders so the UI can already render
      // page numbers, badges and scroll offsets.
      const placeholders: PageImg[] = Array.from({ length: total }, (_, i) => ({
        page: i + 1,
        uri: "",
        width: 1000,
        height: Math.round(1000 / DEFAULT_ASPECT),
        loaded: false,
      }));
      setPages(placeholders);

      const firstPages = Array.from(
        { length: Math.min(FIRST_BATCH, total) },
        (_, i) => i + 1,
      );
      setStatus(`Loading page 1 of ${total}…`);
      const firstImgs = await pdfRenderPages(file.uri, firstPages, {
        dpi: 130,
        format: "jpeg",
      });
      if (cancelRenderRef.current) return;
      setPages((prev) => {
        const next = prev.slice();
        for (const img of firstImgs) {
          next[img.page - 1] = { ...img, loaded: true };
        }
        return next;
      });
      setStatus(total > FIRST_BATCH ? `Loading page ${FIRST_BATCH + 1} of ${total}…` : "");
      setBusy(false); // Let the user start reading immediately.

      // Track opened doc.
      addRecent({
        kind: "pdf",
        uri: file.uri,
        name: file.name,
        size: file.size,
        tool: "Reader",
      }).catch(() => {});

      // Background: fetch the remaining pages in chunks.
      for (let start = FIRST_BATCH + 1; start <= total; start += CHUNK_SIZE) {
        if (cancelRenderRef.current) return;
        const end = Math.min(start + CHUNK_SIZE - 1, total);
        const chunk = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        setStatus(`Loading page ${start} of ${total}…`);
        try {
          const imgs = await pdfRenderPages(file.uri, chunk, {
            dpi: 130,
            format: "jpeg",
          });
          if (cancelRenderRef.current) return;
          setPages((prev) => {
            const next = prev.slice();
            for (const img of imgs) {
              next[img.page - 1] = { ...img, loaded: true };
            }
            return next;
          });
        } catch (e) {
          console.warn("[reader] chunk failed:", e);
          // Keep going — a single failed chunk shouldn't kill the whole load.
        }
      }
      if (!cancelRenderRef.current) {
        setStatus(`${total} pages loaded`);
      }
    } catch (e: unknown) {
      Alert.alert("Open failed", (e as Error)?.message || String(e));
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (file && pages.length === 0) render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Compute per-page dimensions given fit + zoom.
  const pageBox = (p: PageImg) => {
    const aspect = p.width && p.height ? p.width / p.height : 1;
    let baseW: number;
    let baseH: number;
    if (fit === "width") {
      baseW = contentWidth;
      baseH = baseW / aspect;
    } else {
      // Fit page height to viewport.
      baseH = maxPageHeight;
      baseW = baseH * aspect;
      if (baseW > contentWidth) {
        baseW = contentWidth;
        baseH = baseW / aspect;
      }
    }
    return {
      w: baseW * zoom,
      h: baseH * zoom,
      baseW,
      baseH,
    };
  };

  // Track current page index as user scrolls.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const offs = pageOffsets.current;
    let idx = 0;
    for (let i = 0; i < offs.length; i++) {
      if (y + 80 >= offs[i]) idx = i;
      else break;
    }
    const p = idx + 1;
    if (p !== currentPage) setCurrentPage(p);
  };

  const jumpTo = (targetPage: number) => {
    const idx = Math.max(0, Math.min(pages.length - 1, targetPage - 1));
    const y = pageOffsets.current[idx];
    if (typeof y === "number") {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
    }
  };

  const cycleZoom = () => {
    const i = ZOOM_LEVELS.indexOf(zoom as (typeof ZOOM_LEVELS)[number]);
    const next = ZOOM_LEVELS[(i + 1) % ZOOM_LEVELS.length];
    setZoom(next);
  };

  const resetZoom = () => {
    setZoom(1);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader
        title="PDF Reader"
        subtitle={file ? file.name : "View any PDF page-by-page"}
        onBack={() => router.back()}
      />

      {file && pages.some((p) => p.loaded) ? (
        <View style={styles.toolbar}>
          <Pressable
            onPress={() => setFit((f) => (f === "width" ? "page" : "width"))}
            style={styles.toolBtn}
          >
            <Ionicons
              name={fit === "width" ? "resize-outline" : "expand-outline"}
              size={16}
              color={colors.brandPrimary}
            />
            <Text style={styles.toolBtnText}>
              {fit === "width" ? "Fit Width" : "Fit Page"}
            </Text>
          </Pressable>

          <Pressable onPress={cycleZoom} style={styles.toolBtn}>
            <Ionicons name="search" size={14} color={colors.brandPrimary} />
            <Text style={styles.toolBtnText}>{Math.round(zoom * 100)}%</Text>
          </Pressable>

          {zoom !== 1 ? (
            <Pressable onPress={resetZoom} style={styles.toolBtnGhost} hitSlop={8}>
              <Ionicons name="refresh" size={14} color={colors.onSurfaceSecondary} />
            </Pressable>
          ) : null}

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={() => jumpTo(currentPage - 1)}
            disabled={currentPage <= 1}
            style={[styles.toolIconBtn, currentPage <= 1 && { opacity: 0.4 }]}
            hitSlop={8}
          >
            <Ionicons name="chevron-up" size={16} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.pageIndicator}>
            {currentPage} / {pages.length}
          </Text>
          <Pressable
            onPress={() => jumpTo(currentPage + 1)}
            disabled={currentPage >= pages.length}
            style={[styles.toolIconBtn, currentPage >= pages.length && { opacity: 0.4 }]}
            hitSlop={8}
          >
            <Ionicons name="chevron-down" size={16} color={colors.onSurface} />
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={64}
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing.xxl,
          paddingHorizontal: spacing.lg,
        }}
      >
        {!file ? (
          <EmptyState
            icon="document-outline"
            title="Pick a PDF to view"
            subtitle="We'll render every page for smooth in-app viewing"
            action={<PrimaryButton icon="folder-open" label="Choose PDF" onPress={pick} />}
          />
        ) : (
          <>
            <View style={styles.fileCard}>
              <Ionicons name="document" size={22} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={styles.fileMeta}>{humanBytes(file.size)}</Text>
              </View>
              <Pressable onPress={pick} hitSlop={8}>
                <Ionicons name="swap-horizontal" size={20} color={colors.onSurfaceTertiary} />
              </Pressable>
            </View>

            {busy || (status && pages.some(p => !p.loaded)) ? (
              <ProgressBanner label={status} />
            ) : null}

            {pages.map((p, i) => {
              const box = pageBox(p);
              const needsHScroll = box.w > contentWidth;
              const pageContent = (
                <View
                  style={[
                    styles.pageWrap,
                    { width: box.w, height: box.h },
                  ]}
                >
                  {p.loaded && p.uri ? (
                    <Image
                      source={{ uri: p.uri }}
                      style={{ width: box.w, height: box.h }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.pagePlaceholder}>
                      <ActivityIndicator size="small" color={colors.brandPrimary} />
                      <Text style={styles.pagePlaceholderText}>Rendering page {p.page}…</Text>
                    </View>
                  )}
                  <View style={styles.pageBadge}>
                    <Text style={styles.pageBadgeText}>Page {p.page}</Text>
                  </View>
                </View>
              );
              return (
                <View
                  key={p.page}
                  onLayout={(evt) => {
                    pageOffsets.current[i] = evt.nativeEvent.layout.y;
                  }}
                  style={{
                    marginTop: spacing.md,
                    alignItems: fit === "page" && !needsHScroll ? "center" : "flex-start",
                  }}
                >
                  {needsHScroll ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ minWidth: contentWidth }}
                    >
                      {pageContent}
                    </ScrollView>
                  ) : (
                    pageContent
                  )}
                </View>
              );
            })}

            {pages.some((p) => p.loaded) ? (
              <View style={{ marginTop: spacing.lg }}>
                <SecondaryButton
                  icon="share-outline"
                  label="Share PDF"
                  onPress={() => sharePdf(file.uri)}
                />
              </View>
            ) : !busy ? (
              <View style={{ marginTop: spacing.lg }}>
                <PrimaryButton icon="eye" label="Render pages" onPress={render} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      {busy ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.divider,
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  toolBtnText: {
    color: colors.onSurface,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  toolBtnGhost: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  toolIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  pageIndicator: {
    color: colors.onSurface,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    minWidth: 46,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  fileName: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  fileMeta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  pageWrap: {
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
  },
  pageBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pageBadgeText: { color: "#fff", fontSize: 11, fontWeight: fontWeight.bold },
  pagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  pagePlaceholderText: {
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.xs,
  },
  overlay: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
});
