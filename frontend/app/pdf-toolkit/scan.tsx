/**
 * Camera document scanner → clean PDF.
 * Android uses Google's ML Kit scanner (auto edge detection, crop, filters,
 * multi-page) — no camera permission needed because Play services handles it.
 */
import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, Image, ScrollView, Platform, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState } from "@/src/components/toolkit/Primitives";
import { InstantOverlay } from "@/src/components/InstantOverlay";
import { getPdfSize } from "@/src/utils/pdf";
import { addRecent } from "@/src/utils/toolkit/recents";

let Scanner: any = null;
if (Platform.OS !== "web") {
  try { Scanner = require("react-native-document-scanner-plugin").default; } catch {}
}

export default function ScanToPdfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pages, setPages] = useState<string[]>([]); // data:image/jpeg;base64,...
  const [busy, setBusy] = useState(false);

  const scan = async () => {
    if (!Scanner) {
      Alert.alert("Not available here", "The camera scanner works in the installed Android app.");
      return;
    }
    try {
      const { scannedImages, status } = await Scanner.scanDocument({
        croppedImageQuality: 85,
        responseType: "base64",
      });
      if (status === "cancel" || !scannedImages?.length) return;
      setPages((p) => [...p, ...scannedImages.map((b: string) => (b.startsWith("data:") ? b : `data:image/jpeg;base64,${b}`))]);
    } catch (e) {
      Alert.alert("Scan failed", (e as Error)?.message || String(e));
    }
  };

  const build = async () => {
    if (!pages.length) return;
    setBusy(true);
    try {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
        @page { size: 210mm 297mm; margin: 0; }
        html, body { margin:0; padding:0; background:#fff; }
        .page { width:210mm; height:297mm; page-break-after:always; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .page:last-child { page-break-after:auto; }
        img { max-width:100%; max-height:100%; object-fit:contain; }
      </style></head><body>${pages.map((src) => `<div class="page"><img src="${src}"/></div>`).join("")}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const size = await getPdfSize(uri);
      const name = `Scan-${new Date().toISOString().slice(0, 10)}.pdf`;
      await addRecent({ kind: "pdf", uri, name, size, tool: "Scan Document" });
      router.replace({ pathname: "/pdf-toolkit/reader", params: { sharedUri: uri, sharedName: name, sharedSize: String(size) } });
    } catch (e) {
      Alert.alert("PDF failed", (e as Error)?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Scan Document" subtitle={pages.length ? `${pages.length} page${pages.length === 1 ? "" : "s"}` : "Camera → clean PDF"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }}>
        {!pages.length ? (
          <EmptyState
            icon="scan"
            title="Scan paper into PDF"
            subtitle="Edges are detected and cropped automatically. Scan many pages in one go."
            action={<PrimaryButton icon="camera" label="Start scanning" onPress={scan} />}
          />
        ) : (
          <>
            <View style={styles.grid}>
              {pages.map((src, i) => (
                <View key={i} style={styles.thumb}>
                  <Image source={{ uri: src }} style={styles.thumbImg} resizeMode="cover" />
                  <Text style={styles.thumbNum}>{i + 1}</Text>
                  <Pressable hitSlop={8} onPress={() => setPages((p) => p.filter((_, j) => j !== i))} style={styles.thumbDel}>
                    <Ionicons name="close" size={14} color={colors.onBrandPrimary} />
                  </Pressable>
                </View>
              ))}
            </View>
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              <PrimaryButton icon="document" label="Create PDF" onPress={build} loading={busy} />
              <SecondaryButton icon="add" label="Scan more pages" onPress={scan} />
            </View>
          </>
        )}
      </ScrollView>
      <InstantOverlay visible={busy} title="Creating PDF…" subtitle="Just a moment." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  thumb: {
    width: "31%", aspectRatio: 0.71, borderRadius: radius.sm, overflow: "hidden",
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  thumbImg: { width: "100%", height: "100%" },
  thumbNum: {
    position: "absolute", left: 6, bottom: 6, color: colors.onBrandPrimary, backgroundColor: colors.brandPrimary,
    fontSize: fontSize.xs, fontWeight: fontWeight.bold, paddingHorizontal: 6, borderRadius: radius.sm, overflow: "hidden",
  },
  thumbDel: {
    position: "absolute", right: 4, top: 4, width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.error, alignItems: "center", justifyContent: "center",
  },
});
