import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type Note = {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  updated_at: string;
};

export default function NotesListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api<{ items: Note[] }>("/notes");
      setItems(res.items);
    } catch (e: any) {
      setError(e?.message || "Failed to load notes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    load();
  }, [load]);

  async function createAndOpen() {
    try {
      const n = await api<Note>("/notes", { method: "POST", body: { title: "", content: "" } });
      router.push(`/notes/${n.id}`);
    } catch (e: any) {
      setError(e?.message || "Failed to create note");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="notes-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="notes-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Notes</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{
            padding: spacing.xl,
            paddingBottom: insets.bottom + 100,
            gap: spacing.md,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.brandPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty} testID="notes-empty">
              <View style={styles.emptyIcon}>
                <Ionicons name="document-text-outline" size={30} color={colors.brandPrimary} />
              </View>
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptySub}>Capture a thought — it takes 3 seconds.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`note-${item.id}`}
              onPress={() => router.push(`/notes/${item.id}`)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title || "Untitled"}
                </Text>
                {item.pinned ? (
                  <Ionicons name="bookmark" size={14} color={colors.brandPrimary} />
                ) : null}
              </View>
              <Text style={styles.cardBody} numberOfLines={3}>
                {item.content || "Empty note"}
              </Text>
              <Text style={styles.cardDate}>
                {new Date(item.updated_at).toLocaleDateString()}
              </Text>
            </Pressable>
          )}
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        testID="notes-new-fab"
        onPress={createAndOpen}
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
      >
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  title: {
    color: colors.onSurface, fontSize: fontSize.xl,
    fontWeight: fontWeight.bold, letterSpacing: -0.3,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.md, marginTop: spacing.xxxl },
  emptyIcon: {
    width: 64, height: 64, borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  emptySub: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, textAlign: "center" },
  card: {
    padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { flex: 1, color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  cardBody: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 },
  cardDate: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: spacing.xs },
  fab: {
    position: "absolute", right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  error: {
    color: colors.error, textAlign: "center", padding: spacing.md,
  },
});
