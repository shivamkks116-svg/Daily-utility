import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickPdfs, sharePdf, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { splitPdf, getPdfSize, readPdfBase64 } from "@/src/utils/pdf";
import { api } from "@/src/api/client";
import { addRecent } from "@/src/utils/toolkit/recents";

type RangeInput = { from: string; to: string };

export default function SplitPdfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [pages, setPages] = useState<number>(0);
  const [ranges, setRanges] = useState<RangeInput[]>([{ from: "1", to: "1" }]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ uri: string; size: number }[]>([]);
  const [status, setStatus] = useState("");

  const pick = async () => {
    try {
      const picked = await pickPdfs();
      if (picked[0]) {
        setFile(picked[0]);
        setResults([]);
        setStatus("Reading PDF info...");
        const b64 = await readPdfBase64(picked[0].uri);
        try {
          const info = await api<{ pages: number; encrypted: boolean }>("/pdf/info", { method: "POST", body: { file_base64: b64 } });
          setPages(info.pages);
          setRanges([{ from: "1", to: String(info.pages) }]);
          setStatus("");
          if (info.encrypted) {
            Alert.alert("Encrypted PDF", "This PDF is password-protected — splitting will attempt to read it but may fail.");
          }
        } catch (e: any) {
          setStatus("");
          Alert.alert("Could not read PDF", e?.message || "Unknown error");
        }
      }
    } catch (e: any) {
      Alert.alert("Picker error", e?.message || "Unknown error");
    }
  };

  const addRange = () => setRanges(r => [...r, { from: "1", to: String(pages || 1) }]);
  const removeRange = (i: number) => setRanges(r => r.filter((_, idx) => idx !== i));
  const updateRange = (i: number, field: keyof RangeInput, val: string) => {
    setRanges(r => r.map((x, idx) => idx === i ? { ...x, [field]: val.replace(/[^\d]/g, "") } : x));
  };

  const doSplit = async () => {
    if (!file) return;
    const parsed = ranges.map(r => ({ from: parseInt(r.from || "1", 10), to: parseInt(r.to || "1", 10) }));
    for (const p of parsed) {
      if (!p.from || !p.to || p.from < 1 || p.to > pages || p.from > p.to) {
        Alert.alert("Invalid range", `Pages must be between 1 and ${pages}, with "from" ≤ "to".`);
        return;
      }
    }
    setBusy(true);
    setStatus("Splitting PDF...");
    setResults([]);
    try {
      const outs = await splitPdf(file.uri, parsed);
      const withSizes = await Promise.all(outs.map(async uri => ({ uri, size: await getPdfSize(uri) })));
      setResults(withSizes);
      setStatus("Done");
      for (let i = 0; i < withSizes.length; i++) {
        await addRecent({ kind: "pdf", uri: withSizes[i].uri, name: `Split-part-${i + 1}.pdf`, size: withSizes[i].size, tool: "Split" });
      }
    } catch (e: any) {
      Alert.alert("Split failed", e?.message || "Unknown error");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Split PDF" subtitle={file ? `${pages} pages` : "Pick a PDF"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {status ? <ProgressBanner label={status} done={!busy && results.length > 0} /> : null}
        {!file ? (
          <EmptyState icon="cut-outline" title="Choose a PDF to split" subtitle="Define one or more page ranges. Each range becomes a new PDF." actionLabel="Pick PDF" onAction={pick} />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <View style={styles.fileBox}>
              <Ionicons name="document" size={18} color={colors.brandPrimary} />
              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              <Text style={styles.fileMeta}>{humanBytes(file.size)} · {pages}p</Text>
            </View>

            <Text style={styles.sectionTitle}>Ranges (1-indexed, inclusive)</Text>
            {ranges.map((r, i) => (
              <View key={i} style={styles.rangeRow}>
                <TextInput
                  style={styles.input}
                  value={r.from}
                  onChangeText={v => updateRange(i, "from", v)}
                  keyboardType="number-pad"
                  placeholder="From"
                  placeholderTextColor={colors.onSurfaceTertiary}
                />
                <Text style={styles.dash}>→</Text>
                <TextInput
                  style={styles.input}
                  value={r.to}
                  onChangeText={v => updateRange(i, "to", v)}
                  keyboardType="number-pad"
                  placeholder="To"
                  placeholderTextColor={colors.onSurfaceTertiary}
                />
                {ranges.length > 1 ? (
                  <Pressable onPress={() => removeRange(i)} style={styles.iconBtn}>
                    <Ionicons name="close" size={18} color={colors.error} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            <SecondaryButton icon="add" label="Add another range" onPress={addRange} style={{ marginTop: spacing.sm }} />

            {results.length > 0 ? (
              <View style={{ marginTop: spacing.lg }}>
                <Text style={styles.sectionTitle}>Result</Text>
                {results.map((r, i) => (
                  <Pressable key={r.uri} onPress={() => sharePdf(r.uri)} style={styles.resultRow}>
                    <Ionicons name="document" size={18} color={colors.brandPrimary} />
                    <Text style={styles.resultText}>Part {i + 1} · {humanBytes(r.size)}</Text>
                    <Ionicons name="share-outline" size={18} color={colors.onSurface} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
      {file ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <PrimaryButton icon="cut" label={busy ? "Splitting..." : `Split into ${ranges.length} PDF${ranges.length > 1 ? "s" : ""}`} onPress={doSplit} loading={busy} />
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
  sectionTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: spacing.sm, marginTop: spacing.md },
  rangeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  input: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.onSurface, fontSize: fontSize.md, borderWidth: 1, borderColor: colors.border, textAlign: "center" },
  dash: { color: colors.onSurfaceTertiary, fontSize: fontSize.lg },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary },
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  resultText: { flex: 1, color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
