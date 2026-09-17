import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image, TextInput } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickSingleImage, shareImage, trackImageResult, type PickedImg } from "@/src/utils/image/helpers";
import { resizeImage, getSize } from "@/src/utils/image";
import { humanBytes } from "@/src/utils/pdf/helpers";

type Mode = "percent" | "custom";

export default function ResizeImageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [img, setImg] = useState<PickedImg | null>(null);
  const [mode, setMode] = useState<Mode>("percent");
  const [percent, setPercent] = useState<number>(75);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepRatio, setKeepRatio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ uri: string; size: number } | null>(null);
  const [status, setStatus] = useState("");

  const pick = async () => {
    const p = await pickSingleImage();
    if (p) { setImg(p); setResult(null); setStatus(""); setWidth(String(p.width)); setHeight(String(p.height)); }
  };

  const onWidth = (v: string) => {
    const clean = v.replace(/[^\d]/g, "");
    setWidth(clean);
    if (keepRatio && img && clean) {
      const w = parseInt(clean, 10);
      if (isFinite(w) && w > 0) setHeight(String(Math.round(w * img.height / img.width)));
    }
  };
  const onHeight = (v: string) => {
    const clean = v.replace(/[^\d]/g, "");
    setHeight(clean);
    if (keepRatio && img && clean) {
      const h = parseInt(clean, 10);
      if (isFinite(h) && h > 0) setWidth(String(Math.round(h * img.width / img.height)));
    }
  };

  const run = async () => {
    if (!img) return;
    setBusy(true); setStatus("Resizing..."); setResult(null);
    try {
      let outUri: string;
      if (mode === "percent") {
        outUri = await resizeImage(img.uri, { percent });
      } else {
        const w = parseInt(width || "0", 10);
        const h = parseInt(height || "0", 10);
        if (!w && !h) { Alert.alert("Enter dimensions", "Provide at least width or height."); setBusy(false); setStatus(""); return; }
        outUri = await resizeImage(img.uri, { width: w || undefined, height: h || undefined });
      }
      const size = await getSize(outUri);
      setResult({ uri: outUri, size });
      setStatus("Done");
      await trackImageResult(outUri, `Resized.jpg`, `Resize`, size);
    } catch (e: any) {
      Alert.alert("Resize failed", e?.message || "Unknown error");
      setStatus("");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Resize Image" subtitle={img?.name || "Pick an image"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {status ? <ProgressBanner label={status} done={!busy && !!result} /> : null}
        {!img ? (
          <EmptyState icon="resize-outline" title="Resize an image" subtitle="Scale by percentage or set exact width/height." actionLabel="Pick image" onAction={pick} />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <Image source={{ uri: result?.uri || img.uri }} style={styles.preview} resizeMode="contain" />
            <Text style={styles.metaLine}>{img.width}×{img.height} · {humanBytes(img.size)}{result ? ` → ${humanBytes(result.size)}` : ""}</Text>

            <View style={styles.row}>
              {(["percent", "custom"] as Mode[]).map(m => (
                <Pressable key={m} onPress={() => setMode(m)} style={[styles.chip, mode === m && styles.chipOn]}>
                  <Text style={[styles.chipText, mode === m && { color: colors.onBrandPrimary }]}>{m === "percent" ? "By %" : "Custom"}</Text>
                </Pressable>
              ))}
            </View>

            {mode === "percent" ? (
              <View style={{ marginTop: spacing.md }}>
                <View style={styles.percentRow}>
                  {[25, 50, 75, 100].map(p => (
                    <Pressable key={p} onPress={() => setPercent(p)} style={[styles.pchip, percent === p && styles.pchipOn]}>
                      <Text style={[styles.pchipText, percent === p && { color: colors.onBrandPrimary }]}>{p}%</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.hint}>New dimensions: ~{Math.round(img.width * percent / 100)} × {Math.round(img.height * percent / 100)}</Text>
              </View>
            ) : (
              <View style={{ marginTop: spacing.md }}>
                <View style={styles.dimRow}>
                  <View style={styles.dimBox}>
                    <Text style={styles.dimLabel}>Width (px)</Text>
                    <TextInput style={styles.dimInput} value={width} onChangeText={onWidth} keyboardType="number-pad" placeholderTextColor={colors.onSurfaceTertiary} />
                  </View>
                  <View style={styles.dimBox}>
                    <Text style={styles.dimLabel}>Height (px)</Text>
                    <TextInput style={styles.dimInput} value={height} onChangeText={onHeight} keyboardType="number-pad" placeholderTextColor={colors.onSurfaceTertiary} />
                  </View>
                </View>
                <Pressable onPress={() => setKeepRatio(v => !v)} style={styles.ratioBtn}>
                  <Ionicons name={keepRatio ? "lock-closed" : "lock-open"} size={16} color={colors.brandPrimary} />
                  <Text style={styles.ratioText}>{keepRatio ? "Aspect ratio locked" : "Aspect ratio free"}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      {img ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {result ? (
            <PrimaryButton icon="share-outline" label="Share / Save" onPress={() => shareImage(result.uri)} />
          ) : (
            <PrimaryButton icon="resize" label="Resize" onPress={run} loading={busy} />
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
  row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  chip: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  percentRow: { flexDirection: "row", gap: spacing.sm },
  pchip: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  pchipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  pchipText: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  dimRow: { flexDirection: "row", gap: spacing.sm },
  dimBox: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  dimLabel: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginBottom: 4 },
  dimInput: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold, padding: 0 },
  ratioBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  ratioText: { color: colors.onBrandTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  hint: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: spacing.sm },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
