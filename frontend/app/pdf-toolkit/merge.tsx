import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickPdfs, sharePdf, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { mergePdfs, getPdfSize } from "@/src/utils/pdf";
import { addRecent } from "@/src/utils/toolkit/recents";

export default function MergePdfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [files, setFiles] = useState<PickedPdf[]>([]);
  const [busy, setBusy] = useState(false);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number>(0);
  const [status, setStatus] = useState<string>("");

  const add = async () => {
    try {
      const picked = await pickPdfs({ multiple: true });
      setFiles(prev => [...prev, ...picked]);
    } catch (e: any) {
      Alert.alert("Could not open picker", e?.message || "Unknown error");
    }
  };

  const move = (idx: number, dir: -1 | 1) => {
    setFiles(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const remove = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const doMerge = async () => {
    if (files.length < 2) {
      Alert.alert("Add more files", "Select at least 2 PDFs to merge.");
      return;
    }
    setBusy(true);
    setStatus("Merging PDFs...");
    setResultUri(null);
    try {
      const outUri = await mergePdfs(files.map(f => f.uri), "Merged");
      const size = await getPdfSize(outUri);
      setResultUri(outUri);
      setResultSize(size);
      setStatus("Done");
      await addRecent({ kind: "pdf", uri: outUri, name: `Merged.pdf`, size, tool: "Merge" });
    } catch (e: any) {
      Alert.alert("Merge failed", e?.message || "The PDFs may be encrypted or corrupted.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader
        title="Merge PDFs"
        subtitle={`${files.length} file${files.length === 1 ? "" : "s"} selected`}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {status ? <ProgressBanner label={status} done={!busy && !!resultUri} /> : null}

        {files.length === 0 ? (
          <EmptyState
            icon="git-merge-outline"
            title="Pick PDFs to merge"
            subtitle="Drag the arrows once you've added files to reorder them."
            actionLabel="Add PDFs"
            onAction={add}
          />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            {files.map((f, i) => (
              <View key={f.uri} style={styles.row}>
                <View style={styles.iconBox}>
                  <Text style={styles.iconTxt}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{f.name}</Text>
                  <Text style={styles.meta}>{humanBytes(f.size)}</Text>
                </View>
                <Pressable onPress={() => move(i, -1)} hitSlop={8} style={styles.rowBtn} disabled={i === 0}>
                  <Ionicons name="arrow-up" size={16} color={i === 0 ? colors.onSurfaceTertiary : colors.onSurface} />
                </Pressable>
                <Pressable onPress={() => move(i, 1)} hitSlop={8} style={styles.rowBtn} disabled={i === files.length - 1}>
                  <Ionicons name="arrow-down" size={16} color={i === files.length - 1 ? colors.onSurfaceTertiary : colors.onSurface} />
                </Pressable>
                <Pressable onPress={() => remove(i)} hitSlop={8} style={styles.rowBtn}>
                  <Ionicons name="close" size={18} color={colors.error} />
                </Pressable>
              </View>
            ))}
            <SecondaryButton icon="add" label="Add more PDFs" onPress={add} style={{ marginTop: spacing.md }} />
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {resultUri ? (
          <>
            <View style={styles.doneRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />
              <Text style={styles.doneText}>Merged PDF ready · {humanBytes(resultSize)}</Text>
            </View>
            <PrimaryButton icon="share-outline" label="Share / Save" onPress={() => resultUri && sharePdf(resultUri)} />
          </>
        ) : (
          <PrimaryButton
            icon="git-merge"
            label={files.length < 2 ? "Add at least 2 PDFs" : `Merge ${files.length} PDFs`}
            onPress={doMerge}
            disabled={files.length < 2}
            loading={busy}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  iconBox: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  iconTxt: { color: colors.onBrandTertiary, fontWeight: fontWeight.bold, fontSize: fontSize.md },
  name: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  rowBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  footer: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  doneRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  doneText: { color: colors.brandPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
