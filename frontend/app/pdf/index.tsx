import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, Image, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { maybeShowInterstitial } from "@/src/ads/interstitial";

type ImgAsset = { uri: string; base64: string; width: number; height: number };

export default function PDFScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [imgs, setImgs] = useState<ImgAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
      selectionLimit: 20,
    });
    if (res.canceled) return;
    const newOnes: ImgAsset[] = (res.assets || [])
      .filter(a => a.base64 && a.uri)
      .map(a => ({
        uri: a.uri,
        base64: `data:image/jpeg;base64,${a.base64}`,
        width: a.width || 800,
        height: a.height || 1000,
      }));
    setImgs(prev => [...prev, ...newOnes]);
    setPdfUri(null);
  }

  function remove(i: number) {
    setImgs(prev => prev.filter((_, idx) => idx !== i));
    setPdfUri(null);
  }

  function move(i: number, dir: -1 | 1) {
    setImgs(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return next;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setPdfUri(null);
  }

  async function makePdf() {
    if (imgs.length === 0) return;
    setLoading(true);
    try {
      const pages = imgs.map(im => `
        <div style="page-break-after: always; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <img src="${im.base64}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
        </div>
      `).join("");
      const html = `<html><head><meta charset="utf-8"><style>body{margin:0;padding:0;}</style></head><body>${pages}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      setPdfUri(uri);
    } finally { setLoading(false); }
  }

  async function share() {
    if (!pdfUri) return;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(pdfUri, { mimeType: "application/pdf", dialogTitle: "Share PDF" });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="pdf-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="pdf-back" onPress={() => { maybeShowInterstitial("pdf-close"); router.back(); }} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Image → PDF</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <View style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="document-attach" size={22} color={colors.onBrandPrimary} /></View>
        <Text style={styles.heroText}>Pick images from your gallery, reorder them, and export a single PDF you can share anywhere.</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 120, gap: spacing.md }}>
        {imgs.length === 0 ? (
          <View style={styles.empty} testID="pdf-empty">
            <Ionicons name="images-outline" size={40} color={colors.onSurfaceTertiary} />
            <Text style={styles.emptyText}>No images added yet</Text>
          </View>
        ) : (
          imgs.map((im, i) => (
            <View key={im.uri + i} style={styles.card} testID={`pdf-img-${i}`}>
              <Image source={{ uri: im.uri }} style={styles.thumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pageLabel}>Page {i + 1}</Text>
                <Text style={styles.dim}>{im.width}×{im.height}</Text>
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6} testID={`pdf-up-${i}`}>
                  <Ionicons name="chevron-up" size={20} color={i === 0 ? colors.onSurfaceTertiary : colors.onSurface} />
                </Pressable>
                <Pressable onPress={() => move(i, 1)} disabled={i === imgs.length - 1} hitSlop={6} testID={`pdf-down-${i}`}>
                  <Ionicons name="chevron-down" size={20} color={i === imgs.length - 1 ? colors.onSurfaceTertiary : colors.onSurface} />
                </Pressable>
                <Pressable onPress={() => remove(i)} hitSlop={6} testID={`pdf-rm-${i}`}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable testID="pdf-add" onPress={pick} style={styles.secondaryBtn}>
          <Ionicons name="add" size={20} color={colors.onSurface} />
          <Text style={styles.secondaryText}>Add images</Text>
        </Pressable>
        {pdfUri ? (
          <Pressable testID="pdf-share" onPress={share} style={styles.primaryBtn}>
            <Ionicons name="share-outline" size={20} color={colors.onBrandPrimary} />
            <Text style={styles.primaryText}>Share PDF</Text>
          </Pressable>
        ) : (
          <Pressable
            testID="pdf-make"
            onPress={makePdf}
            disabled={imgs.length === 0 || loading}
            style={[styles.primaryBtn, (imgs.length === 0 || loading) && { opacity: 0.5 }]}
          >
            {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
              <>
                <Ionicons name="document" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.primaryText}>Create PDF</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  hero: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brandTertiary, flexDirection: "row", alignItems: "center", gap: spacing.md },
  heroIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  heroText: { color: colors.onSurface, fontSize: fontSize.sm, flex: 1, lineHeight: 20 },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.md, marginTop: spacing.xl },
  emptyText: { color: colors.onSurfaceTertiary },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  pageLabel: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  dim: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  actions: { flexDirection: "column", gap: 6, alignItems: "center" },
  bottomBar: {
    flexDirection: "row", gap: spacing.md, padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    height: 50, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  secondaryText: { color: colors.onSurface, fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  primaryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    height: 50, borderRadius: radius.pill, backgroundColor: colors.brandPrimary,
  },
  primaryText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.base },
});
