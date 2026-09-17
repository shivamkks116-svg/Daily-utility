import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, fontSize, fontWeight, spacing } from "@/src/theme";
import { ToolkitHeader, ToolCard, EmptyState } from "@/src/components/toolkit/Primitives";
import { listFavorites, toggleFavorite } from "@/src/utils/toolkit/recents";

type IconName = keyof typeof Ionicons.glyphMap;

type Tool = { key: string; label: string; desc: string; icon: IconName; route?: string; soon?: boolean };

const CATEGORIES: { title: string; tools: Tool[] }[] = [
  {
    title: "Basics",
    tools: [
      { key: "img-compress", label: "Compress", desc: "Shrink size for sharing", icon: "leaf", route: "/image-toolkit/compress" },
      { key: "img-resize", label: "Resize", desc: "Custom width/height or %", icon: "resize", route: "/image-toolkit/resize" },
      { key: "img-convert", label: "Convert Format", desc: "JPG ↔ PNG ↔ WebP", icon: "swap-horizontal", route: "/image-toolkit/convert" },
    ],
  },
  {
    title: "Edit",
    tools: [
      { key: "img-crop", label: "Crop", desc: "Trim to any aspect ratio", icon: "crop", route: "/image-toolkit/crop" },
      { key: "img-rotate", label: "Rotate / Flip", desc: "90° · 180° · flip axis", icon: "sync", route: "/image-toolkit/rotate" },
      { key: "img-watermark", label: "Watermark", desc: "Add text overlay", icon: "water", route: "/image-toolkit/watermark" },
      { key: "img-collage", label: "Collage", desc: "Coming in v1.1", icon: "grid", soon: true },
    ],
  },
  {
    title: "AI",
    tools: [
      { key: "img-ocr", label: "Extract Text (OCR)", desc: "Read text from image", icon: "scan", route: "/image-toolkit/ocr" },
      { key: "img-describe", label: "Describe Image", desc: "AI-generated caption + tags", icon: "sparkles", route: "/image-toolkit/describe" },
      { key: "img-bgremove", label: "Remove Background", desc: "Coming in v1.1", icon: "cut", soon: true },
    ],
  },
  {
    title: "Convert to PDF",
    tools: [
      { key: "img-to-pdf", label: "Images → PDF", desc: "Combine into a PDF", icon: "document-text", route: "/pdf-toolkit/images-to-pdf" },
    ],
  },
];

export default function ImageToolkitHub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query] = useState("");
  const [favs, setFavs] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    setFavs(await listFavorites());
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES
      .map(c => ({ ...c, tools: c.tools.filter(t => t.label.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)) }))
      .filter(c => c.tools.length > 0);
  }, [query]);

  const onFav = useCallback(async (key: string) => setFavs(await toggleFavorite(key)), []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Image Toolkit" subtitle="Compress, edit, convert & extract" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} tintColor={colors.brandPrimary} />}
      >
        {filtered.length === 0 ? (
          <EmptyState icon="search-outline" title="No tools found" subtitle={`Nothing matched "${query}"`} />
        ) : filtered.map(cat => (
          <View key={cat.title} style={{ marginTop: spacing.lg }}>
            <Text style={styles.sectionTitle}>{cat.title}</Text>
            <View style={styles.grid}>
              {cat.tools.map(t => (
                <View key={t.key} style={styles.gridCell}>
                  <ToolCard
                    icon={t.icon}
                    label={t.label}
                    desc={t.desc}
                    soon={t.soon}
                    onPress={() => t.route && router.push(t.route as any)}
                    favorite={favs.includes(t.key)}
                    onFav={() => onFav(t.key)}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  sectionTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg - spacing.xs / 2 },
  gridCell: { width: "50%", paddingHorizontal: spacing.xs / 2, paddingVertical: spacing.xs / 2 },
});
