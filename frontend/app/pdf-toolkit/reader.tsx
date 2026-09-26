import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, Pressable, Alert, Dimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickPdfs, sharePdf, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { pdfToImages } from "@/src/utils/pdf";

/**
 * PDF Reader / Viewer — renders every page as an image server-side and
 * displays them in a scrollable list. Doubles as a shareable preview.
 */
export default function PdfReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [pages, setPages] = useState<{ page: number; uri: string; width: number; height: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const screenWidth = Dimensions.get("window").width - spacing.lg * 2;

  const pick = async () => {
    try {
      const [picked] = await pickPdfs({ multiple: false });
      if (!picked) return;
      setFile(picked);
      setPages([]);
    } catch (e: unknown) {
      Alert.alert("Pick failed", (e as Error)?.message || String(e));
    }
  };

  const render = async () => {
    if (!file) return;
    setBusy(true);
    setStatus("Rendering pages…");
    try {
      const imgs = await pdfToImages(file.uri, { dpi: 150, format: "png" });
      setPages(imgs);
      setStatus(`${imgs.length} pages loaded`);
    } catch (e: unknown) {
      Alert.alert("Render failed", (e as Error)?.message || String(e));
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (file && pages.length === 0) render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="PDF Reader" subtitle="View any PDF page-by-page" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }}>
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
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.fileMeta}>{humanBytes(file.size)}</Text>
              </View>
              <Pressable onPress={pick}><Ionicons name="swap-horizontal" size={20} color={colors.onSurfaceTertiary} /></Pressable>
            </View>

            {busy ? <ProgressBanner label={status} /> : null}

            {pages.map((p) => {
              const aspect = p.width && p.height ? p.width / p.height : 1;
              return (
                <View key={p.page} style={styles.pageWrap}>
                  <Image source={{ uri: p.uri }} style={{ width: screenWidth, height: screenWidth / aspect }} resizeMode="contain" />
                  <View style={styles.pageBadge}><Text style={styles.pageBadgeText}>Page {p.page}</Text></View>
                </View>
              );
            })}

            {pages.length > 0 ? (
              <View style={{ marginTop: spacing.lg }}>
                <SecondaryButton icon="share-outline" label="Share PDF" onPress={() => sharePdf(file.uri)} />
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
  fileCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.md,
  },
  fileName: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  fileMeta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  pageWrap: {
    marginTop: spacing.md, borderRadius: radius.md, overflow: "hidden",
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    position: "relative",
  },
  pageBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
  },
  pageBadgeText: { color: "#fff", fontSize: 11, fontWeight: fontWeight.bold },
  overlay: {
    position: "absolute", inset: 0, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
});
