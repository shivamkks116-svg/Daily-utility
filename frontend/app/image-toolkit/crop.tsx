import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, EmptyState } from "@/src/components/toolkit/Primitives";
import { pickSingleImage, shareImage, trackImageResult, type PickedImg } from "@/src/utils/image/helpers";
import { cropImage, getSize } from "@/src/utils/image";

/** Aspect ratio presets — the crop is centered on the image. */
type Preset = { key: string; label: string; w: number; h: number };
const PRESETS: Preset[] = [
  { key: "square",  label: "1:1 Square",   w: 1, h: 1 },
  { key: "4x5",     label: "4:5 (IG)",     w: 4, h: 5 },
  { key: "3x4",     label: "3:4",          w: 3, h: 4 },
  { key: "9x16",    label: "9:16 Story",   w: 9, h: 16 },
  { key: "16x9",    label: "16:9 Landsc.", w: 16, h: 9 },
  { key: "3x2",     label: "3:2 DSLR",     w: 3, h: 2 },
];

export default function CropImageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [img, setImg] = useState<PickedImg | null>(null);
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ uri: string; size: number } | null>(null);

  const pick = async () => {
    const p = await pickSingleImage();
    if (p) { setImg(p); setResult(null); }
  };

  const run = async () => {
    if (!img) return;
    setBusy(true); setResult(null);
    try {
      const ratio = preset.w / preset.h;
      const iw = img.width;
      const ih = img.height;
      let cw = iw;
      let ch = Math.round(iw / ratio);
      if (ch > ih) {
        ch = ih;
        cw = Math.round(ih * ratio);
      }
      const originX = Math.max(0, Math.round((iw - cw) / 2));
      const originY = Math.max(0, Math.round((ih - ch) / 2));
      const outUri = await cropImage(img.uri, { originX, originY, width: cw, height: ch });
      const size = await getSize(outUri);
      setResult({ uri: outUri, size });
      await trackImageResult(outUri, `Cropped-${preset.key}.jpg`, `Crop ${preset.label}`, size);
    } catch (e: any) {
      Alert.alert("Crop failed", e?.message || "Unknown error");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Crop Image" subtitle={img?.name || "Pick an image"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {!img ? (
          <EmptyState icon="crop-outline" title="Crop to a ratio" subtitle="Select an aspect ratio — we center-crop for you." actionLabel="Pick image" onAction={pick} />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <Image source={{ uri: result?.uri || img.uri }} style={styles.preview} resizeMode="contain" />
            <Text style={styles.metaLine}>{img.width}×{img.height}px</Text>
            <Text style={styles.sectionTitle}>Aspect ratio</Text>
            <View style={styles.grid}>
              {PRESETS.map(p => (
                <Pressable key={p.key} onPress={() => setPreset(p)} style={[styles.cell, preset.key === p.key && styles.cellOn]}>
                  <View style={[styles.shape, { aspectRatio: p.w / p.h, borderColor: preset.key === p.key ? colors.onBrandPrimary : colors.onSurfaceTertiary }]} />
                  <Text style={[styles.cellText, preset.key === p.key && { color: colors.onBrandPrimary }]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
      {img ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {result ? (
            <PrimaryButton icon="share-outline" label="Share / Save" onPress={() => shareImage(result.uri)} />
          ) : (
            <PrimaryButton icon="crop" label={`Crop ${preset.label}`} onPress={run} loading={busy} />
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  preview: { width: "100%", height: 260, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  metaLine: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: spacing.sm, textAlign: "center" },
  sectionTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: spacing.md, marginBottom: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  cell: { flexBasis: "30%", flexGrow: 1, alignItems: "center", justifyContent: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: 6 },
  cellOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  shape: { width: 40, borderWidth: 2, borderRadius: 4 },
  cellText: { color: colors.onSurface, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
