import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickPdfs, sharePdf, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { compressPdf } from "@/src/utils/pdf";
import { addRecent } from "@/src/utils/toolkit/recents";

export default function CompressPdfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [result, setResult] = useState<{ uri: string; originalSize: number; compressedSize: number; savedBytes: number; savedPct: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    try {
      const [picked] = await pickPdfs({ multiple: false });
      if (!picked) return;
      setFile(picked);
      setResult(null);
    } catch (e: unknown) {
      Alert.alert("Pick failed", (e as Error)?.message || String(e));
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await compressPdf(file.uri);
      setResult(r);
      await addRecent({ kind: "pdf", uri: r.uri, name: `${file.name.replace(/\.pdf$/i, "")}-compressed.pdf`, size: r.compressedSize, tool: "Compress" });
    } catch (e: unknown) {
      Alert.alert("Compress failed", (e as Error)?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Compress PDF" subtitle="Shrink file size without opening the PDF" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }}>
        {!file ? (
          <EmptyState icon="archive-outline" title="Pick a PDF" subtitle="We'll strip duplicate objects and compress streams"
            action={<PrimaryButton icon="folder-open" label="Choose PDF" onPress={pick} />} />
        ) : (
          <>
            <View style={styles.card}>
              <Ionicons name="document" size={22} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.meta}>{humanBytes(file.size)}</Text>
              </View>
              <Pressable onPress={pick}><Ionicons name="swap-horizontal" size={20} color={colors.onSurfaceTertiary} /></Pressable>
            </View>

            {busy ? <ProgressBanner label="Compressing…" /> : null}

            {result ? (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Compression complete</Text>
                <View style={styles.resultRow}><Text style={styles.resultLabel}>Original</Text><Text style={styles.resultValue}>{humanBytes(result.originalSize)}</Text></View>
                <View style={styles.resultRow}><Text style={styles.resultLabel}>Compressed</Text><Text style={styles.resultValue}>{humanBytes(result.compressedSize)}</Text></View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Saved</Text>
                  <Text style={[styles.resultValue, { color: colors.brandPrimary }]}>{humanBytes(result.savedBytes)} · {result.savedPct}%</Text>
                </View>
              </View>
            ) : null}

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              {result ? (
                <SecondaryButton icon="share-outline" label="Share compressed PDF" onPress={() => sharePdf(result.uri)} />
              ) : null}
              <PrimaryButton icon="archive" label={result ? "Re-compress" : "Compress PDF"} onPress={run} disabled={busy} />
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
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  name: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  resultCard: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandSecondary, gap: 8 },
  resultTitle: { color: colors.onBrandTertiary, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: 4 },
  resultRow: { flexDirection: "row", justifyContent: "space-between" },
  resultLabel: { color: colors.onBrandTertiary, fontSize: fontSize.sm },
  resultValue: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  overlay: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.15)" },
});
