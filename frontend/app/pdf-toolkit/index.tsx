import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, TextInput } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, ToolCard, EmptyState } from "@/src/components/toolkit/Primitives";
import { listRecents, listFavorites, toggleFavorite, formatBytes, formatDate, type RecentEntry, removeRecent } from "@/src/utils/toolkit/recents";
import * as Sharing from "expo-sharing";

type IconName = keyof typeof Ionicons.glyphMap;

type Tool = {
  key: string;
  label: string;
  desc: string;
  icon: IconName;
  route?: string;
  soon?: boolean;
};

const CATEGORIES: { key: string; title: string; tools: Tool[] }[] = [
  {
    key: "create",
    title: "Create",
    tools: [
      { key: "images-to-pdf", label: "Images → PDF", desc: "Merge photos into one PDF", icon: "images", route: "/pdf-toolkit/images-to-pdf" },
      { key: "text-to-pdf", label: "Text → PDF", desc: "Type or paste text, get a PDF", icon: "document-text", route: "/pdf-toolkit/text-to-pdf" },
      { key: "scan-to-pdf", label: "Scan Document", desc: "Coming in v1.1 — camera scan", icon: "scan", soon: true },
    ],
  },
  {
    key: "read",
    title: "Read & Convert",
    tools: [
      { key: "reader", label: "PDF Reader", desc: "View any PDF page-by-page", icon: "eye", route: "/pdf-toolkit/reader" },
      { key: "to-images", label: "PDF → Images", desc: "Export each page as PNG or JPEG", icon: "image", route: "/pdf-toolkit/to-images" },
      { key: "to-docx", label: "PDF → Word", desc: "Extract text to a .docx file", icon: "document", route: "/pdf-toolkit/to-docx" },
    ],
  },
  {
    key: "organize",
    title: "Organize",
    tools: [
      { key: "merge", label: "Merge PDFs", desc: "Combine multiple PDFs in order", icon: "git-merge", route: "/pdf-toolkit/merge" },
      { key: "split", label: "Split PDF", desc: "Break a PDF into custom ranges", icon: "cut", route: "/pdf-toolkit/split" },
      { key: "organize", label: "Delete · Rotate · Extract", desc: "Reorder or drop pages", icon: "layers", route: "/pdf-toolkit/organize" },
    ],
  },
  {
    key: "optimize",
    title: "Optimize & Secure",
    tools: [
      { key: "compress", label: "Compress PDF", desc: "Shrink file size without opening it", icon: "archive", route: "/pdf-toolkit/compress" },
      { key: "protect", label: "Password Protect", desc: "Encrypt or unlock a PDF", icon: "lock-closed", route: "/pdf-toolkit/protect" },
    ],
  },
  {
    key: "edit",
    title: "Edit",
    tools: [
      { key: "watermark", label: "Add Watermark", desc: "Diagonal text over every page", icon: "water", route: "/pdf-toolkit/watermark" },
      { key: "pagenums", label: "Page Numbers", desc: "Header or footer numbering", icon: "list", route: "/pdf-toolkit/page-numbers" },
      { key: "sign", label: "Signature", desc: "Coming in v1.1", icon: "create", soon: true },
    ],
  },
  {
    key: "ai",
    title: "AI Assistant",
    tools: [
      { key: "ai-summary", label: "Summarise PDF", desc: "TL;DR + key points in seconds", icon: "sparkles", route: "/pdf-toolkit/ai?mode=summarize" },
      { key: "ai-ask", label: "Ask a Question", desc: "Chat with your document", icon: "chatbubble-ellipses", route: "/pdf-toolkit/ai?mode=ask" },
      { key: "ai-keypoints", label: "Key Points", desc: "Extract main takeaways", icon: "bulb", route: "/pdf-toolkit/ai?mode=keypoints" },
      { key: "ai-translate", label: "Translate", desc: "Convert document to another language", icon: "language", route: "/pdf-toolkit/ai?mode=translate" },
    ],
  },
];

export default function PdfToolkitHub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [favs, setFavs] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    const r = await listRecents();
    setRecents(r.filter(x => x.kind === "pdf").slice(0, 6));
    setFavs(await listFavorites());
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.map(cat => ({
      ...cat,
      tools: cat.tools.filter(t =>
        t.label.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q),
      ),
    })).filter(c => c.tools.length > 0);
  }, [query]);

  const onFav = useCallback(async (key: string) => {
    const next = await toggleFavorite(key);
    setFavs(next);
  }, []);

  const favTools = useMemo(() => {
    const all = CATEGORIES.flatMap(c => c.tools);
    return favs.map(k => all.find(t => t.key === k)).filter((t): t is Tool => !!t && !t.soon);
  }, [favs]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader
        title="PDF Toolkit"
        subtitle="All your PDF tools in one place"
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} tintColor={colors.brandPrimary} />}
      >
        {/* Search */}
        <View style={styles.searchWrap}>
          <View style={styles.search}>
            <Ionicons name="search" size={16} color={colors.onSurfaceTertiary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search tools..."
              placeholderTextColor={colors.onSurfaceTertiary}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Favorites */}
        {favTools.length > 0 && !query ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.sectionTitle}>⭐ Favorites</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favRow}>
              {favTools.map(t => (
                <Pressable key={t.key} onPress={() => t.route && router.push(t.route as any)} style={styles.favChip}>
                  <Ionicons name={t.icon} size={16} color={colors.brandPrimary} />
                  <Text style={styles.favChipText}>{t.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Recents */}
        {recents.length > 0 && !query ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.sectionTitle}>🕘 Recent PDFs</Text>
            {recents.map(r => (
              <RecentRow key={r.id} r={r} onOpen={() => Sharing.isAvailableAsync().then(ok => ok && Sharing.shareAsync(r.uri))} onDelete={async () => { await removeRecent(r.id); load(); }} />
            ))}
          </View>
        ) : null}

        {/* Tool categories */}
        {filtered.length === 0 ? (
          <EmptyState icon="search-outline" title="No tools found" subtitle={`No PDF tools matched "${query}"`} />
        ) : filtered.map(cat => (
          <View key={cat.key} style={{ marginTop: spacing.lg }}>
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

function RecentRow({ r, onOpen, onDelete }: { r: RecentEntry; onOpen: () => void; onDelete: () => void }) {
  return (
    <Pressable onPress={onOpen} style={styles.recentRow}>
      <View style={styles.recentIcon}>
        <Ionicons name="document" size={20} color={colors.brandPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.recentName} numberOfLines={1}>{r.name}</Text>
        <Text style={styles.recentMeta} numberOfLines={1}>
          {r.tool ? `${r.tool} · ` : ""}
          {r.size ? formatBytes(r.size) + " · " : ""}
          {formatDate(r.createdAt)}
        </Text>
      </View>
      <Pressable onPress={onDelete} hitSlop={10} style={styles.recentAction}>
        <Ionicons name="trash-outline" size={18} color={colors.onSurfaceTertiary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  searchWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  search: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { color: colors.onSurfaceTertiary, fontSize: fontSize.md, flex: 1 },
  sectionTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  favRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  favChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  favChipText: { color: colors.onBrandTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg - spacing.xs / 2 },
  gridCell: { width: "50%", paddingHorizontal: spacing.xs / 2, paddingVertical: spacing.xs / 2 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  recentIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  recentName: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  recentMeta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  recentAction: { padding: spacing.xs },
});
