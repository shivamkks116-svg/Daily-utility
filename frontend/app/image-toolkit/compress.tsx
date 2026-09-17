import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickSingleImage, shareImage, trackImageResult, type PickedImg } from "@/src/utils/image/helpers";
import { compressImage, getSize, type CompressLevel } from "@/src/utils/image";
import { humanBytes } from "@/src/utils/pdf/helpers";

export default function CompressImageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [img, setImg] = useState<PickedImg | null>(null);
  const [level, setLevel] = useState<CompressLevel>("medium");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ uri: string; size: number } | null>(null);
  const [status, setStatus] = useState("");

  const pick = async () => {
    const p = await pickSingleImage();
    if (p) { setImg(p); setResult(null); setStatus(""); }
  };

  const run = async () => {
    if (!img) return;
    setBusy(true); setStatus("Compressing..."); setResult(null);
    try {
      const outUri = await compressImage(img.uri, level);
      const size = await getSize(outUri);
      setResult({ uri: outUri, size });
      setStatus("Done");
      await trackImageResult(outUri, `Compressed-${level}.jpg`, `Compress (${level})`, size);
    } catch (e: any) {
      Alert.alert("Compress failed", e?.message || "Unknown error");
      setStatus("");
    } finally { setBusy(false); }
  };

  const savedPct = img && result ? Math.max(0, Math.round((1 - result.size / img.size) * 100)) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Compress Image" subtitle={img?.name || "Pick an image"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {status ? <ProgressBanner label={status} done={!busy && !!result} /> : null}
        {!img ? (
          <EmptyState icon="leaf-outline" title="Shrink an image" subtitle="Great for chat sharing & email attachments." actionLabel="Pick image" onAction={pick} />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <Image source={{ uri: result?.uri || img.uri }} style={styles.preview} resizeMode="contain" />
            <View style={styles.info}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Original</Text>
                <Text style={styles.infoValue}>{humanBytes(img.size)}</Text>
                <Text style={styles.infoSub}>{img.width}×{img.height}</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.brandPrimary} />
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Compressed</Text>
                <Text style={[styles.infoValue, { color: colors.brandPrimary }]}>{result ? humanBytes(result.size) : "—"}</Text>
                <Text style={styles.infoSub}>{result ? `Saved ${savedPct}%` : "Run compress"}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Compression Level</Text>
            <View style={styles.row}>
              {(["low", "medium", "high"] as CompressLevel[]).map(l => (
                <Pressable key={l} onPress={() => setLevel(l)} style={[styles.chip, level === l && styles.chipOn]}>
                  <Text style={[styles.chipText, level === l && { color: colors.onBrandPrimary }]}>{l[0].toUpperCase() + l.slice(1)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>
              {level === "low" && "Barely visible loss — small size drop."}
              {level === "medium" && "Balanced — recommended for sharing."}
              {level === "high" && "Smallest file — some visible softening."}
            </Text>
          </View>
        )}
      </ScrollView>
      {img ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {result ? (
            <PrimaryButton icon="share-outline" label="Share / Save" onPress={() => shareImage(result.uri)} />
          ) : (
            <PrimaryButton icon="leaf" label="Compress" onPress={run} loading={busy} />
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  preview: { width: "100%", height: 260, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  info: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, marginTop: spacing.md },
  infoBox: { flex: 1, alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  infoLabel: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  infoValue: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: 2 },
  infoSub: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  sectionTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: spacing.md, marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  chip: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  hint: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 6 },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
