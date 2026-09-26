import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickPdfs, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { pdfToDocxWithOcr } from "@/src/utils/pdf";
import { addRecent } from "@/src/utils/toolkit/recents";

export default function PdfToDocxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [result, setResult] = useState<{ uri: string; size: number; chars: number; usedOcr: boolean; ocrPages: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ocrMode, setOcrMode] = useState<"auto" | "force" | "off">("auto");

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
      const r = await pdfToDocxWithOcr(file.uri, ocrMode);
      setResult(r);
      await addRecent({ kind: "docx", uri: r.uri, name: `${file.name.replace(/\.pdf$/i, "")}.docx`, size: r.size, tool: "PDF → DOCX" });
    } catch (e: unknown) {
      Alert.alert("Convert failed", (e as Error)?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!result) return;
    try {
      const ok = await Sharing.isAvailableAsync();
      if (ok) await Sharing.shareAsync(result.uri, { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", dialogTitle: "Share DOCX" });
    } catch (e: unknown) {
      Alert.alert("Share failed", (e as Error)?.message || String(e));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="PDF → Word (DOCX)" subtitle="Extract text and package it as a .docx file" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }}>
        {!file ? (
          <EmptyState icon="document-text-outline" title="Pick a PDF" subtitle="Text-based PDFs work best. Scanned PDFs need OCR first."
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

            {busy ? <ProgressBanner label={ocrMode === "off" ? "Extracting text…" : "Extracting text (OCR on scans)…"} /> : null}

            {!result ? (
              <View style={styles.segmentBox}>
                <Text style={styles.segmentLabel}>Scan handling</Text>
                <View style={styles.segment}>
                  {(["auto", "force", "off"] as const).map((m) => (
                    <Pressable
                      key={m}
                      testID={`ocr-mode-${m}`}
                      onPress={() => setOcrMode(m)}
                      style={[styles.segmentBtn, ocrMode === m && styles.segmentBtnActive]}
                    >
                      <Text style={[styles.segmentText, ocrMode === m && styles.segmentTextActive]}>
                        {m === "auto" ? "Auto (recommended)" : m === "force" ? "Force OCR" : "Text only"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.segmentHint}>
                  {ocrMode === "auto"
                    ? "Uses OCR only for pages with no extractable text — best for mixed PDFs."
                    : ocrMode === "force"
                      ? "Runs OCR on every page — slower, but most accurate for scans."
                      : "Skips OCR — fastest, but empty on scanned PDFs."}
                </Text>
              </View>
            ) : null}

            {result ? (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>DOCX ready</Text>
                <View style={styles.resultRow}><Text style={styles.resultLabel}>Size</Text><Text style={styles.resultValue}>{humanBytes(result.size)}</Text></View>
                <View style={styles.resultRow}><Text style={styles.resultLabel}>Characters</Text><Text style={styles.resultValue}>{result.chars.toLocaleString()}</Text></View>
                {result.usedOcr ? (
                  <View style={styles.ocrBadge}>
                    <Ionicons name="scan" size={12} color={colors.onBrandPrimary} />
                    <Text style={styles.ocrBadgeText}>OCR used on {result.ocrPages} scanned page{result.ocrPages === 1 ? "" : "s"}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              {result ? (
                <SecondaryButton icon="share-outline" label="Share DOCX" onPress={share} />
              ) : null}
              <PrimaryButton icon="document-text" label={result ? "Re-convert" : "Convert to DOCX"} onPress={run} disabled={busy} />
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
  ocrBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  ocrBadgeText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: fontWeight.bold },
  segmentBox: { marginTop: spacing.lg, gap: 6 },
  segmentLabel: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  segment: { flexDirection: "row", gap: 6, backgroundColor: colors.surfaceSecondary, padding: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: "center" },
  segmentBtnActive: { backgroundColor: colors.brandPrimary },
  segmentText: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: fontWeight.semibold },
  segmentTextActive: { color: colors.onBrandPrimary },
  segmentHint: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 4 },
  overlay: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.15)" },
});
