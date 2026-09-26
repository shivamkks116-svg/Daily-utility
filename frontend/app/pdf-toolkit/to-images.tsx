import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, Alert, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickPdfs, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { pdfToImages } from "@/src/utils/pdf";
import { addRecent } from "@/src/utils/toolkit/recents";

/** PDF → Images (PNG / JPEG) — one file per page, sharable individually. */
export default function PdfToImagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [dpi, setDpi] = useState<150 | 200 | 300>(150);
  const [pages, setPages] = useState<{ page: number; uri: string; width: number; height: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const cellSize = (Dimensions.get("window").width - spacing.lg * 2 - spacing.sm) / 2;

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

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setStatus("Converting pages…");
    try {
      const imgs = await pdfToImages(file.uri, { dpi, format });
      setPages(imgs);
      setStatus(`${imgs.length} page${imgs.length === 1 ? "" : "s"} exported`);
      for (const p of imgs) {
        await addRecent({ kind: "image", uri: p.uri, name: `${file.name.replace(/\.pdf$/i, "")}-page-${p.page}.${format}`, tool: "PDF → Images" });
      }
    } catch (e: unknown) {
      Alert.alert("Convert failed", (e as Error)?.message || String(e));
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="PDF → Images" subtitle="Export every page as a picture" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }}>
        {!file ? (
          <EmptyState
            icon="images-outline"
            title="Pick a PDF"
            subtitle="Each page will become a shareable PNG or JPEG"
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

            <Text style={styles.sectionTitle}>Format</Text>
            <View style={styles.chips}>
              {(["png", "jpeg"] as const).map((f) => (
                <Pressable key={f} onPress={() => setFormat(f)} style={[styles.chip, format === f && styles.chipOn]}>
                  <Text style={[styles.chipText, format === f && styles.chipTextOn]}>{f.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Quality</Text>
            <View style={styles.chips}>
              {[150, 200, 300].map((d) => (
                <Pressable key={d} onPress={() => setDpi(d as 150)} style={[styles.chip, dpi === d && styles.chipOn]}>
                  <Text style={[styles.chipText, dpi === d && styles.chipTextOn]}>{d} DPI</Text>
                </Pressable>
              ))}
            </View>

            {busy ? <ProgressBanner label={status} /> : null}

            {pages.length > 0 ? (
              <View style={styles.gridWrap}>
                {pages.map((p) => (
                  <Pressable
                    key={p.page}
                    onPress={() => Sharing.isAvailableAsync().then((ok) => ok && Sharing.shareAsync(p.uri))}
                    style={[styles.gridCell, { width: cellSize }]}
                  >
                    <Image source={{ uri: p.uri }} style={{ width: cellSize, height: cellSize * 1.3 }} resizeMode="cover" />
                    <View style={styles.gridBadge}><Text style={styles.gridBadgeText}>Page {p.page}</Text></View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <PrimaryButton icon="download" label={pages.length ? "Re-export" : "Export pages"} onPress={convert} disabled={busy} />
            </View>
          </>
        )}
      </ScrollView>
      {busy ? <View style={styles.overlay}><ActivityIndicator size="large" color={colors.brandPrimary} /></View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  fileCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  fileName: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  fileMeta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  sectionTitle: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: spacing.lg, marginBottom: spacing.sm },
  chips: { flexDirection: "row", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  chipTextOn: { color: colors.onBrandPrimary },
  gridWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  gridCell: { borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, position: "relative" },
  gridBadge: { position: "absolute", bottom: 6, left: 6, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  gridBadgeText: { color: "#fff", fontSize: 10, fontWeight: fontWeight.bold },
  overlay: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.15)" },
});
