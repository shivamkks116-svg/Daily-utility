import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickPdfs, sharePdf, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { deletePages, rotatePages, extractPages, getPdfSize, readPdfBase64 } from "@/src/utils/pdf";
import { api } from "@/src/api/client";
import { addRecent } from "@/src/utils/toolkit/recents";

type Mode = "delete" | "rotate" | "extract";

function parsePages(input: string, total: number): number[] {
  // "1,3-5,7" -> [1,3,4,5,7]
  const out = new Set<number>();
  for (const chunk of input.split(",")) {
    const t = chunk.trim();
    if (!t) continue;
    if (t.includes("-")) {
      const [a, b] = t.split("-").map(x => parseInt(x, 10));
      if (isFinite(a) && isFinite(b)) {
        for (let i = Math.max(1, a); i <= Math.min(total, b); i++) out.add(i);
      }
    } else {
      const n = parseInt(t, 10);
      if (isFinite(n) && n >= 1 && n <= total) out.add(n);
    }
  }
  return Array.from(out).sort((a, b) => a - b);
}

export default function OrganizePdfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [pages, setPages] = useState(0);
  const [mode, setMode] = useState<Mode>("delete");
  const [selection, setSelection] = useState("");
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ uri: string; size: number } | null>(null);
  const [status, setStatus] = useState("");

  const pick = async () => {
    try {
      const picked = await pickPdfs();
      if (picked[0]) {
        setFile(picked[0]);
        setResult(null);
        setStatus("Reading PDF info...");
        const b64 = await readPdfBase64(picked[0].uri);
        try {
          const info = await api<{ pages: number }>("/pdf/info", { method: "POST", body: { file_base64: b64 } });
          setPages(info.pages);
          setStatus("");
        } catch (e: any) {
          setStatus("");
          Alert.alert("Could not read PDF", e?.message || "Unknown error");
        }
      }
    } catch (e: any) {
      Alert.alert("Picker error", e?.message || "Unknown error");
    }
  };

  const run = async () => {
    if (!file) return;
    const pageNums = parsePages(selection, pages);
    if (pageNums.length === 0) {
      Alert.alert("Select pages", `Enter valid page numbers between 1 and ${pages}. Example: 1,3-5,7`);
      return;
    }
    setBusy(true);
    setStatus(`Applying ${mode}...`);
    setResult(null);
    try {
      let outUri: string;
      let toolLabel = "Organized";
      if (mode === "delete") {
        outUri = await deletePages(file.uri, pageNums);
        toolLabel = "Deleted pages";
      } else if (mode === "rotate") {
        outUri = await rotatePages(file.uri, angle, pageNums);
        toolLabel = `Rotated ${angle}°`;
      } else {
        outUri = await extractPages(file.uri, pageNums);
        toolLabel = "Extracted pages";
      }
      const size = await getPdfSize(outUri);
      setResult({ uri: outUri, size });
      setStatus("Done");
      await addRecent({ kind: "pdf", uri: outUri, name: `${toolLabel}.pdf`, size, tool: toolLabel });
    } catch (e: any) {
      Alert.alert("Operation failed", e?.message || "Unknown error");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Organize PDF" subtitle={file ? `${pages} pages` : "Pick a PDF"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {status ? <ProgressBanner label={status} done={!busy && !!result} /> : null}
        {!file ? (
          <EmptyState icon="layers-outline" title="Delete · Rotate · Extract" subtitle="Pick a PDF then enter the pages you want to operate on. Example: 1,3-5,7" actionLabel="Pick PDF" onAction={pick} />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <View style={styles.fileBox}>
              <Ionicons name="document" size={18} color={colors.brandPrimary} />
              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              <Text style={styles.fileMeta}>{humanBytes(file.size)} · {pages}p</Text>
            </View>

            <Text style={styles.sectionTitle}>Mode</Text>
            <View style={styles.modeRow}>
              {(["delete", "rotate", "extract"] as Mode[]).map(m => (
                <Pressable key={m} onPress={() => setMode(m)} style={[styles.modeChip, mode === m && styles.modeChipOn]}>
                  <Ionicons name={m === "delete" ? "trash" : m === "rotate" ? "sync" : "download"} size={16} color={mode === m ? colors.onBrandPrimary : colors.onSurface} />
                  <Text style={[styles.modeChipText, mode === m && { color: colors.onBrandPrimary }]}>{m[0].toUpperCase() + m.slice(1)}</Text>
                </Pressable>
              ))}
            </View>

            {mode === "rotate" ? (
              <>
                <Text style={styles.sectionTitle}>Rotation</Text>
                <View style={styles.modeRow}>
                  {([90, 180, 270] as const).map(a => (
                    <Pressable key={a} onPress={() => setAngle(a)} style={[styles.modeChip, angle === a && styles.modeChipOn]}>
                      <Text style={[styles.modeChipText, angle === a && { color: colors.onBrandPrimary }]}>{a}°</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.sectionTitle}>Pages</Text>
            <TextInput
              style={styles.input}
              value={selection}
              onChangeText={setSelection}
              placeholder={`e.g. 1,3-5,7 (max page ${pages})`}
              placeholderTextColor={colors.onSurfaceTertiary}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.hint}>
              {mode === "delete" && "These pages will be removed. All remaining pages stay in order."}
              {mode === "rotate" && "Only the pages listed above will be rotated. Leave to rotate all? Enter 1-" + pages + "."}
              {mode === "extract" && "A new PDF containing only these pages will be created."}
            </Text>

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
          <PrimaryButton icon={mode === "delete" ? "trash" : mode === "rotate" ? "sync" : "download"} label={`Apply ${mode}`} onPress={run} loading={busy} disabled={!selection.trim()} />
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
  modeRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  modeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  modeChipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  modeChipText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: fontSize.md, borderWidth: 1, borderColor: colors.border },
  hint: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 6, lineHeight: 17 },
  resultBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  resultText: { flex: 1, color: colors.onBrandTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  shareBtn: { backgroundColor: colors.brandPrimary, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
