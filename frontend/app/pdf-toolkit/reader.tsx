import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState } from "@/src/components/toolkit/Primitives";
import { pickPdfs, sharePdf, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { addRecent } from "@/src/utils/toolkit/recents";
import { PdfViewer } from "@/src/components/PdfViewer";

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
    if (file) {
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
            <Pressable onPress={pick} style={styles.iconBtn}>
              <Ionicons name="folder-open-outline" size={18} color={colors.onSurface} />
            </Pressable>
            <Pressable onPress={() => sharePdf(file.uri)} style={styles.iconBtn}>
              <Ionicons name="share-outline" size={18} color={colors.onSurface} />
            </Pressable>
          </View>

          <PdfViewer
            uri={file.uri}
            password={password}
            onLoad={onLoad}
            onPageChanged={(page) => setCurrentPage(page)}
            onError={onError}
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
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
