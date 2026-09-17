import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image, TextInput } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickSingleImage, shareImage, trackImageResult, type PickedImg } from "@/src/utils/image/helpers";
import { readImageBase64, getSize, IMAGE_CACHE_DIR } from "@/src/utils/image";
import { humanBytes } from "@/src/utils/pdf/helpers";

/**
 * We rasterise a HTML canvas via expo-print to burn the watermark on top of
 * the image. This keeps us free of extra native canvas libraries. The result
 * is a fresh JPG saved into the image cache.
 */
type Position = "center" | "top" | "bottom";

async function ensureCache() {
  const info = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIR, { intermediates: true });
}

async function renderWatermarkedImage(imgUri: string, text: string, pos: Position, opacity: number, color: string): Promise<string> {
  const b64 = await readImageBase64(imgUri);
  const dataUrl = `data:image/jpeg;base64,${b64}`;
  const vertical = pos === "top" ? "flex-start" : pos === "bottom" ? "flex-end" : "center";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    @page { margin: 0; }
    html, body { margin: 0; padding: 0; }
    .wrap { position: relative; width: 100%; }
    img { display: block; width: 100%; }
    .overlay { position: absolute; inset: 0; display: flex; align-items: ${vertical}; justify-content: center; padding: 5% 3%; box-sizing: border-box; }
    .wm { font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;
          color: ${color}; opacity: ${opacity}; font-size: 7vw; text-shadow: 0 2px 8px rgba(0,0,0,0.4); }
  </style></head><body>
    <div class="wrap"><img src="${dataUrl}"/>
      <div class="overlay"><span class="wm">${text.replace(/</g, "&lt;")}</span></div>
    </div>
  </body></html>`;
  // print to PDF first (only reliable way in Expo), then let the caller share the PDF result.
  const pdf = await Print.printToFileAsync({ html, base64: false });
  return pdf.uri;
}

export default function ImageWatermarkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [img, setImg] = useState<PickedImg | null>(null);
  const [text, setText] = useState("SAMPLE");
  const [pos, setPos] = useState<Position>("center");
  const [opacity, setOpacity] = useState(0.6);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ uri: string; size: number } | null>(null);
  const [status, setStatus] = useState("");

  const pick = async () => {
    const p = await pickSingleImage();
    if (p) { setImg(p); setResult(null); setStatus(""); }
  };

  const run = async () => {
    if (!img) return;
    if (!text.trim()) { Alert.alert("Enter text", "Watermark text can't be empty."); return; }
    setBusy(true); setStatus("Rendering watermarked file..."); setResult(null);
    try {
      await ensureCache();
      // Produces a PDF wrapping the watermarked image (reliable across devices).
      const outUri = await renderWatermarkedImage(img.uri, text.trim(), pos, opacity, "#5EBA8B");
      const size = await getSize(outUri);
      setResult({ uri: outUri, size });
      setStatus("Done");
      await trackImageResult(outUri, "Watermarked.pdf", "Image Watermark", size);
    } catch (e: any) {
      Alert.alert("Watermark failed", e?.message || "Unknown error");
      setStatus("");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Image Watermark" subtitle={img?.name || "Pick an image"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {status ? <ProgressBanner label={status} done={!busy && !!result} /> : null}
        {!img ? (
          <EmptyState icon="water-outline" title="Overlay text on an image" subtitle="The output is a shareable PDF for pixel-perfect fidelity." actionLabel="Pick image" onAction={pick} />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <Image source={{ uri: img.uri }} style={styles.preview} resizeMode="contain" />
            <Text style={styles.metaLine}>{humanBytes(img.size)}</Text>
            <Text style={styles.sectionTitle}>Text</Text>
            <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="e.g. DRAFT" placeholderTextColor={colors.onSurfaceTertiary} maxLength={40} />
            <Text style={styles.sectionTitle}>Position</Text>
            <View style={styles.row}>
              {(["top", "center", "bottom"] as Position[]).map(p => (
                <Pressable key={p} onPress={() => setPos(p)} style={[styles.chip, pos === p && styles.chipOn]}>
                  <Text style={[styles.chipText, pos === p && { color: colors.onBrandPrimary }]}>{p[0].toUpperCase() + p.slice(1)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.sectionTitle}>Opacity</Text>
            <View style={styles.row}>
              {[0.3, 0.5, 0.7, 0.9].map(o => (
                <Pressable key={o} onPress={() => setOpacity(o)} style={[styles.chip, opacity === o && styles.chipOn]}>
                  <Text style={[styles.chipText, opacity === o && { color: colors.onBrandPrimary }]}>{Math.round(o * 100)}%</Text>
                </Pressable>
              ))}
            </View>
            {result ? (
              <View style={styles.resultBox}>
                <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />
                <Text style={styles.resultText}>PDF ready · {humanBytes(result.size)}</Text>
                <Pressable onPress={() => shareImage(result.uri)} style={styles.shareBtn}>
                  <Ionicons name="share-outline" size={18} color={colors.onBrandPrimary} />
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
      {img ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <PrimaryButton icon="water" label="Apply Watermark" onPress={run} loading={busy} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  preview: { width: "100%", height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  metaLine: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: spacing.sm, textAlign: "center" },
  sectionTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: fontSize.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, minWidth: 68 },
  chipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  resultBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  resultText: { flex: 1, color: colors.onBrandTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  shareBtn: { backgroundColor: colors.brandPrimary, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
