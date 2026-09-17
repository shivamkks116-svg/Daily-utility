import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickPdfs, sharePdf, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { addPageNumbers, getPdfSize } from "@/src/utils/pdf";
import { addRecent } from "@/src/utils/toolkit/recents";

type Position = "footer-center" | "footer-right" | "footer-left" | "header-center";
type Format = "n" | "n/total" | "Page n of total";

export default function PageNumbersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [position, setPosition] = useState<Position>("footer-center");
  const [format, setFormat] = useState<Format>("n/total");
  const [startFrom, setStartFrom] = useState("1");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ uri: string; size: number } | null>(null);
  const [status, setStatus] = useState("");

  const pick = async () => {
    const picked = await pickPdfs();
    if (picked[0]) { setFile(picked[0]); setResult(null); setStatus(""); }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setStatus("Adding page numbers...");
    setResult(null);
    try {
      const outUri = await addPageNumbers(file.uri, {
        position,
        format,
        startFrom: Math.max(1, parseInt(startFrom || "1", 10)),
      });
      const size = await getPdfSize(outUri);
      setResult({ uri: outUri, size });
      setStatus("Done");
      await addRecent({ kind: "pdf", uri: outUri, name: `Numbered.pdf`, size, tool: "Page Numbers" });
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Unknown error");
      setStatus("");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Page Numbers" subtitle={file?.name || "Pick a PDF"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {status ? <ProgressBanner label={status} done={!busy && !!result} /> : null}
        {!file ? (
          <EmptyState icon="list-outline" title="Number every page" subtitle="Choose the position and numbering style." actionLabel="Pick PDF" onAction={pick} />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <View style={styles.fileBox}>
              <Ionicons name="document" size={18} color={colors.brandPrimary} />
              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              <Text style={styles.fileMeta}>{humanBytes(file.size)}</Text>
            </View>

            <Text style={styles.sectionTitle}>Position</Text>
            <View style={styles.row}>
              {([
                { k: "footer-left", label: "Footer L" },
                { k: "footer-center", label: "Footer C" },
                { k: "footer-right", label: "Footer R" },
                { k: "header-center", label: "Header C" },
              ] as { k: Position; label: string }[]).map(p => (
                <Pressable key={p.k} onPress={() => setPosition(p.k)} style={[styles.chip, position === p.k && styles.chipOn]}>
                  <Text style={[styles.chipText, position === p.k && { color: colors.onBrandPrimary }]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Format</Text>
            <View style={styles.row}>
              {(["n", "n/total", "Page n of total"] as Format[]).map(f => (
                <Pressable key={f} onPress={() => setFormat(f)} style={[styles.chip, format === f && styles.chipOn]}>
                  <Text style={[styles.chipText, format === f && { color: colors.onBrandPrimary }]}>{f.replace("n", "1")}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Start from</Text>
            <TextInput
              style={styles.input}
              value={startFrom}
              onChangeText={v => setStartFrom(v.replace(/[^\d]/g, ""))}
              keyboardType="number-pad"
              placeholderTextColor={colors.onSurfaceTertiary}
            />

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
          <PrimaryButton icon="list" label="Number all pages" onPress={run} loading={busy} />
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
  row: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: fontSize.md, borderWidth: 1, borderColor: colors.border, width: 120, textAlign: "center" },
  resultBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  resultText: { flex: 1, color: colors.onBrandTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  shareBtn: { backgroundColor: colors.brandPrimary, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
