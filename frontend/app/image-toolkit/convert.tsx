import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickSingleImage, shareImage, trackImageResult, type PickedImg } from "@/src/utils/image/helpers";
import { convertFormat, getSize } from "@/src/utils/image";
import { humanBytes } from "@/src/utils/pdf/helpers";

type Fmt = "jpeg" | "png" | "webp";
const OPTIONS: { fmt: Fmt; label: string; note: string }[] = [
  { fmt: "jpeg", label: "JPG", note: "Small size, no transparency" },
  { fmt: "png",  label: "PNG", note: "Lossless, keeps transparency" },
  { fmt: "webp", label: "WebP", note: "Modern, smallest" },
];

export default function ConvertImageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [img, setImg] = useState<PickedImg | null>(null);
  const [fmt, setFmt] = useState<Fmt>("png");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ uri: string; size: number } | null>(null);
  const [status, setStatus] = useState("");

  const pick = async () => {
    const p = await pickSingleImage();
    if (p) { setImg(p); setResult(null); setStatus(""); }
  };

  const run = async () => {
    if (!img) return;
    setBusy(true); setStatus(`Converting to ${fmt.toUpperCase()}...`); setResult(null);
    try {
      const outUri = await convertFormat(img.uri, fmt);
      const size = await getSize(outUri);
      setResult({ uri: outUri, size });
      setStatus("Done");
      await trackImageResult(outUri, `Converted.${fmt === "jpeg" ? "jpg" : fmt}`, `Convert → ${fmt.toUpperCase()}`, size);
    } catch (e: any) {
      Alert.alert("Convert failed", e?.message || "Unknown error");
      setStatus("");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Convert Format" subtitle={img?.name || "Pick an image"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {status ? <ProgressBanner label={status} done={!busy && !!result} /> : null}
        {!img ? (
          <EmptyState icon="swap-horizontal-outline" title="Convert image format" subtitle="Switch between JPG, PNG and WebP." actionLabel="Pick image" onAction={pick} />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <Image source={{ uri: result?.uri || img.uri }} style={styles.preview} resizeMode="contain" />
            <Text style={styles.metaLine}>{humanBytes(img.size)}{result ? ` → ${humanBytes(result.size)}` : ""}</Text>
            <Text style={styles.sectionTitle}>Target format</Text>
            {OPTIONS.map(o => (
              <Pressable key={o.fmt} onPress={() => setFmt(o.fmt)} style={[styles.optRow, fmt === o.fmt && styles.optRowOn]}>
                <View style={[styles.optBadge, fmt === o.fmt && { backgroundColor: colors.brandPrimary }]}>
                  <Text style={[styles.optBadgeText, fmt === o.fmt && { color: colors.onBrandPrimary }]}>{o.label}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optLabel}>{o.label}</Text>
                  <Text style={styles.optNote}>{o.note}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      {img ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {result ? (
            <PrimaryButton icon="share-outline" label="Share / Save" onPress={() => shareImage(result.uri)} />
          ) : (
            <PrimaryButton icon="swap-horizontal" label={`Convert to ${fmt.toUpperCase()}`} onPress={run} loading={busy} />
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  preview: { width: "100%", height: 240, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  metaLine: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: spacing.sm, textAlign: "center" },
  sectionTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: spacing.md, marginBottom: spacing.sm },
  optRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  optRowOn: { borderColor: colors.brandPrimary },
  optBadge: { width: 52, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  optBadgeText: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  optLabel: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  optNote: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
