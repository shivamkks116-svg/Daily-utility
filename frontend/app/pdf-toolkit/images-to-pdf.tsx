import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { sharePdf } from "@/src/utils/pdf/helpers";
import { getPdfSize } from "@/src/utils/pdf";
import { addRecent } from "@/src/utils/toolkit/recents";

type Img = { uri: string; base64: string; width: number; height: number };
type PageSize = "A4" | "Letter" | "Legal";
type Orientation = "portrait" | "landscape";

const SIZES: Record<PageSize, { w: number; h: number }> = {
  A4:     { w: 210,  h: 297 },
  Letter: { w: 216,  h: 279 },
  Legal:  { w: 216,  h: 356 },
};

export default function ImagesToPdfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [imgs, setImgs] = useState<Img[]>([]);
  const [size, setSize] = useState<PageSize>("A4");
  const [orient, setOrient] = useState<Orientation>("portrait");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ uri: string; size: number } | null>(null);
  const [status, setStatus] = useState("");

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      base64: true,
      selectionLimit: 30,
    });
    if (res.canceled) return;
    const newOnes: Img[] = (res.assets || [])
      .filter(a => a.base64 && a.uri)
      .map(a => ({
        uri: a.uri,
        base64: `data:image/jpeg;base64,${a.base64}`,
        width: a.width || 800,
        height: a.height || 1000,
      }));
    setImgs(prev => [...prev, ...newOnes]);
  };

  const remove = (idx: number) => setImgs(p => p.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => setImgs(p => {
    const next = [...p]; const t = idx + dir;
    if (t < 0 || t >= next.length) return p;
    [next[idx], next[t]] = [next[t], next[idx]];
    return next;
  });

  const build = async () => {
    if (imgs.length === 0) { Alert.alert("Add images", "Select at least one image."); return; }
    const dim = SIZES[size];
    const mm = orient === "portrait" ? dim : { w: dim.h, h: dim.w };
    setBusy(true); setStatus("Creating PDF..."); setResult(null);
    try {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
        @page { size: ${mm.w}mm ${mm.h}mm; margin: 0; }
        html, body { margin:0; padding:0; background:#fff; }
        .page { width:${mm.w}mm; height:${mm.h}mm; page-break-after:always; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .page:last-child { page-break-after:auto; }
        img { max-width:100%; max-height:100%; object-fit:contain; }
      </style></head><body>${imgs.map(i => `<div class="page"><img src="${i.base64}"/></div>`).join("")}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const s = await getPdfSize(uri);
      setResult({ uri, size: s });
      setStatus("Done");
      await addRecent({ kind: "pdf", uri, name: `Images-to-PDF.pdf`, size: s, tool: "Images → PDF" });
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Could not create PDF");
      setStatus("");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Images → PDF" subtitle={`${imgs.length} image${imgs.length === 1 ? "" : "s"}`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {status ? <ProgressBanner label={status} done={!busy && !!result} /> : null}

        <Text style={styles.sectionTitle}>Page size</Text>
        <View style={styles.row}>
          {(Object.keys(SIZES) as PageSize[]).map(s => (
            <Pressable key={s} onPress={() => setSize(s)} style={[styles.chip, size === s && styles.chipOn]}>
              <Text style={[styles.chipText, size === s && { color: colors.onBrandPrimary }]}>{s}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.sectionTitle}>Orientation</Text>
        <View style={styles.row}>
          {(["portrait", "landscape"] as Orientation[]).map(o => (
            <Pressable key={o} onPress={() => setOrient(o)} style={[styles.chip, orient === o && styles.chipOn]}>
              <Ionicons name={o === "portrait" ? "phone-portrait" : "phone-landscape"} size={14} color={orient === o ? colors.onBrandPrimary : colors.onSurface} />
              <Text style={[styles.chipText, orient === o && { color: colors.onBrandPrimary }, { marginLeft: 6 }]}>{o[0].toUpperCase() + o.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          {imgs.length === 0 ? (
            <EmptyState icon="images-outline" title="Add photos" subtitle="Pick 1-30 images. Reorder them freely before export." actionLabel="Pick images" onAction={pick} />
          ) : (
            <>
              <View style={styles.grid}>
                {imgs.map((im, i) => (
                  <View key={im.uri + i} style={styles.thumbBox}>
                    <Image source={{ uri: im.uri }} style={styles.thumb} />
                    <View style={styles.thumbActions}>
                      <Pressable onPress={() => move(i, -1)} style={styles.thumbBtn} disabled={i === 0}>
                        <Ionicons name="arrow-up" size={12} color={i === 0 ? colors.onSurfaceTertiary : colors.onSurface} />
                      </Pressable>
                      <Pressable onPress={() => move(i, 1)} style={styles.thumbBtn} disabled={i === imgs.length - 1}>
                        <Ionicons name="arrow-down" size={12} color={i === imgs.length - 1 ? colors.onSurfaceTertiary : colors.onSurface} />
                      </Pressable>
                      <Pressable onPress={() => remove(i)} style={styles.thumbBtn}>
                        <Ionicons name="close" size={12} color={colors.error} />
                      </Pressable>
                    </View>
                    <View style={styles.numBadge}><Text style={styles.numBadgeText}>{i + 1}</Text></View>
                  </View>
                ))}
              </View>
              <SecondaryButton icon="add" label="Add more images" onPress={pick} style={{ marginTop: spacing.md }} />
            </>
          )}
        </View>

        {result ? (
          <View style={styles.resultBox}>
            <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />
            <Text style={styles.resultText}>PDF ready · {(result.size / 1024).toFixed(0)} KB</Text>
            <Pressable onPress={() => sharePdf(result.uri)} style={styles.shareBtn}>
              <Ionicons name="share-outline" size={18} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <PrimaryButton icon="document-text" label={imgs.length === 0 ? "Add images first" : `Create PDF (${imgs.length} pages)`} onPress={build} loading={busy} disabled={imgs.length === 0} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  sectionTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: spacing.md, marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  thumbBox: { width: 100, height: 130, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden", position: "relative" },
  thumb: { width: "100%", height: "100%" },
  thumbActions: { position: "absolute", bottom: 4, right: 4, gap: 3, flexDirection: "row" },
  thumbBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  numBadge: { position: "absolute", top: 4, left: 4, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  numBadgeText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: fontWeight.bold },
  resultBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  resultText: { flex: 1, color: colors.onBrandTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  shareBtn: { backgroundColor: colors.brandPrimary, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
