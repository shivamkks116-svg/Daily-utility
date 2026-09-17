import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { sharePdf } from "@/src/utils/pdf/helpers";
import { getPdfSize } from "@/src/utils/pdf";
import { addRecent } from "@/src/utils/toolkit/recents";

type FontSizeOpt = "small" | "normal" | "large";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function TextToPdfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("Untitled Document");
  const [body, setBody] = useState("");
  const [size, setSize] = useState<FontSizeOpt>("normal");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ uri: string; size: number } | null>(null);
  const [status, setStatus] = useState("");

  const px = size === "small" ? 12 : size === "large" ? 18 : 14;

  const build = async () => {
    if (!body.trim()) { Alert.alert("Empty document", "Type or paste some text first."); return; }
    setBusy(true); setStatus("Creating PDF..."); setResult(null);
    try {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
        @page { size: A4; margin: 20mm; }
        body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color:#111; }
        h1 { font-size: 22px; margin: 0 0 16px 0; color:#0a3a24; border-bottom: 2px solid #5EBA8B; padding-bottom: 8px; }
        p, pre { font-size: ${px}px; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; margin: 0; }
      </style></head><body>
        <h1>${escapeHtml(title || "Untitled")}</h1>
        <pre>${escapeHtml(body)}</pre>
      </body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const s = await getPdfSize(uri);
      setResult({ uri, size: s });
      setStatus("Done");
      await addRecent({ kind: "pdf", uri, name: `${title || "Document"}.pdf`, size: s, tool: "Text → PDF" });
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Could not create PDF");
      setStatus("");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Text → PDF" subtitle="Type or paste, then export" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {status ? <ProgressBanner label={status} done={!busy && !!result} /> : null}

        <Text style={styles.sectionTitle}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Document title"
          placeholderTextColor={colors.onSurfaceTertiary}
          maxLength={100}
        />

        <Text style={styles.sectionTitle}>Body</Text>
        <TextInput
          style={[styles.input, { minHeight: 260, textAlignVertical: "top" }]}
          value={body}
          onChangeText={setBody}
          placeholder="Paste or type the content here..."
          placeholderTextColor={colors.onSurfaceTertiary}
          multiline
        />

        <Text style={styles.sectionTitle}>Font size</Text>
        <View style={styles.row}>
          {(["small", "normal", "large"] as FontSizeOpt[]).map(s => (
            <Pressable key={s} onPress={() => setSize(s)} style={[styles.chip, size === s && styles.chipOn]}>
              <Text style={[styles.chipText, size === s && { color: colors.onBrandPrimary }]}>{s[0].toUpperCase() + s.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        {result ? (
          <View style={styles.resultBox}>
            <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />
            <Text style={styles.resultText}>PDF ready</Text>
            <Pressable onPress={() => sharePdf(result.uri)} style={styles.shareBtn}>
              <Ionicons name="share-outline" size={18} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <PrimaryButton icon="document-text" label="Export PDF" onPress={build} loading={busy} disabled={!body.trim()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
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
