import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickPdfs, sharePdf, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { addWatermark, getPdfSize } from "@/src/utils/pdf";
import { addRecent } from "@/src/utils/toolkit/recents";

export default function WatermarkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState<"light" | "medium" | "strong">("medium");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ uri: string; size: number } | null>(null);
  const [status, setStatus] = useState("");

  const pick = async () => {
    try {
      const picked = await pickPdfs();
      if (picked[0]) { setFile(picked[0]); setResult(null); setStatus(""); }
    } catch (e: any) { Alert.alert("Picker error", e?.message || "Unknown error"); }
  };

  const opacityValue = opacity === "light" ? 0.15 : opacity === "strong" ? 0.35 : 0.22;

  const run = async () => {
    if (!file) return;
    if (!text.trim()) { Alert.alert("Watermark text", "Please enter watermark text."); return; }
    setBusy(true);
    setStatus("Applying watermark...");
    setResult(null);
    try {
      const outUri = await addWatermark(file.uri, { text: text.trim(), opacity: opacityValue });
      const size = await getPdfSize(outUri);
      setResult({ uri: outUri, size });
      setStatus("Done");
      await addRecent({ kind: "pdf", uri: outUri, name: `Watermarked.pdf`, size, tool: "Watermark" });
    } catch (e: any) {
      Alert.alert("Watermark failed", e?.message || "Unknown error");
      setStatus("");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Add Watermark" subtitle={file?.name || "Pick a PDF"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {status ? <ProgressBanner label={status} done={!busy && !!result} /> : null}
        {!file ? (
          <EmptyState icon="water-outline" title="Watermark a PDF" subtitle="Adds a diagonal text watermark across every page." actionLabel="Pick PDF" onAction={pick} />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <View style={styles.fileBox}>
              <Ionicons name="document" size={18} color={colors.brandPrimary} />
              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              <Text style={styles.fileMeta}>{humanBytes(file.size)}</Text>
            </View>
            <Text style={styles.sectionTitle}>Watermark text</Text>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="e.g. CONFIDENTIAL"
              placeholderTextColor={colors.onSurfaceTertiary}
              maxLength={60}
            />
            <Text style={styles.sectionTitle}>Opacity</Text>
            <View style={styles.row}>
              {(["light", "medium", "strong"] as const).map(o => (
                <Pressable key={o} onPress={() => setOpacity(o)} style={[styles.chip, opacity === o && styles.chipOn]}>
                  <Text style={[styles.chipText, opacity === o && { color: colors.onBrandPrimary }]}>{o[0].toUpperCase() + o.slice(1)}</Text>
                </Pressable>
              ))}
            </View>

            {result ? (
              <View style={styles.resultBox}>
                <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />
                <Text style={styles.resultText}>Ready · {humanBytes(result.size)}</Text>
                <Pressable onPress={() => sharePdf(result.uri)} style={styles.shareBtn}>
                  <Ionicons name="share-outline" size={18} color={colors.onBrandPrimary} />
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
      {file ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <PrimaryButton icon="water" label="Add Watermark" onPress={run} loading={busy} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  fileBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  fileName: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold, flex: 1 },
  fileMeta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs },
  sectionTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: fontSize.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  resultBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  resultText: { flex: 1, color: colors.onBrandTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  shareBtn: { backgroundColor: colors.brandPrimary, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
