import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type Todo = {
  id: string;
  title: string;
  notes?: string;
  due_date?: string | null;
  priority: string;
  completed: boolean;
  created_at: string;
};

export default function TodosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: Todo[] }>("/todos");
      setItems(res.items);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  async function toggle(t: Todo) {
    setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: !x.completed } : x)));
    try {
      await api(`/todos/${t.id}`, {
        method: "PUT",
        body: { ...t, completed: !t.completed },
      });
    } catch {}
  }

  async function del(t: Todo) {
    setItems((prev) => prev.filter((x) => x.id !== t.id));
    await api(`/todos/${t.id}`, { method: "DELETE" });
  }

  async function submit() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const t = await api<Todo>("/todos", {
        method: "POST",
        body: { title: newTitle.trim(), priority, completed: false },
      });
      setItems((prev) => [t, ...prev]);
      setNewTitle("");
      setPriority("normal");
      setModal(false);
    } finally {
      setSaving(false);
    }
  }

  const openCount = items.filter((i) => !i.completed).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="todos-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="todos-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View>
          <Text style={styles.title}>To-Do</Text>
          <Text style={styles.subtitle}>{openCount} open · {items.length - openCount} done</Text>
        </View>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.sm, paddingBottom: insets.bottom + 120 }}
          ListEmptyComponent={
            <View style={styles.empty} testID="todos-empty">
              <View style={styles.emptyIcon}>
                <Ionicons name="checkbox-outline" size={30} color={colors.brandPrimary} />
              </View>
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptySub}>Add your first task with the + button.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[styles.row, item.completed && { opacity: 0.55 }]}
              testID={`todo-${item.id}`}
            >
              <Pressable testID={`todo-toggle-${item.id}`} onPress={() => toggle(item)} style={styles.checkbox}>
                {item.completed ? (
                  <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} />
                ) : null}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.rowText,
                    item.completed && { textDecorationLine: "line-through", color: colors.onSurfaceTertiary },
                  ]}
                >
                  {item.title}
                </Text>
                <View style={styles.metaRow}>
                  <View style={[styles.pill, priorityColor(item.priority)]}>
                    <Text style={styles.pillText}>{item.priority}</Text>
                  </View>
                </View>
              </View>
              <Pressable
                testID={`todo-delete-${item.id}`}
                onPress={() => del(item)}
                style={styles.trashBtn}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={18} color={colors.onSurfaceTertiary} />
              </Pressable>
            </View>
          )}
        />
      )}

      <Pressable
        testID="todos-fab"
        onPress={() => setModal(true)}
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
      >
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>

      <Modal
        visible={modal}
        transparent
        animationType="slide"
        onRequestClose={() => setModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModal(false)} />
          <KeyboardStickyView>
            <View style={styles.sheet} testID="todo-add-sheet">
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>New task</Text>
              <TextInput
                testID="todo-title-input"
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="What needs to get done?"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.sheetInput}
                autoFocus
              />
              <View style={styles.priorityRow}>
                {(["low", "normal", "high"] as const).map((p) => {
                  const active = priority === p;
                  return (
                    <Pressable
                      key={p}
                      testID={`priority-${p}`}
                      onPress={() => setPriority(p)}
                      style={[styles.priorityChip, active && styles.priorityChipActive]}
                    >
                      <Text style={[styles.priorityText, active && { color: colors.onBrandPrimary }]}>
                        {p}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                testID="todo-submit-btn"
                onPress={submit}
                disabled={saving || !newTitle.trim()}
                style={({ pressed }) => [
                  styles.submitBtn,
                  (!newTitle.trim() || saving) && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.submitText}>Add task</Text>
                )}
              </Pressable>
            </View>
          </KeyboardStickyView>
        </View>
      </Modal>
    </View>
  );
}

function priorityColor(p: string) {
  if (p === "high") return { backgroundColor: "#3B0E0A" };
  if (p === "low") return { backgroundColor: colors.brandTertiary };
  return { backgroundColor: colors.surfaceTertiary };
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary,
  },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: "center" },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, textAlign: "center", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.md, marginTop: spacing.xxxl },
  emptyIcon: {
    width: 64, height: 64, borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  emptySub: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, textAlign: "center" },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
  },
  rowText: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  metaRow: { flexDirection: "row", gap: spacing.sm, marginTop: 6 },
  pill: { paddingHorizontal: spacing.sm, height: 22, borderRadius: radius.pill, justifyContent: "center" },
  pillText: { color: colors.onSurface, fontSize: 10, fontWeight: fontWeight.bold, textTransform: "uppercase" },
  trashBtn: { padding: spacing.xs },
  fab: {
    position: "absolute", right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
    elevation: 6, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  sheetHandle: {
    alignSelf: "center", width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.borderStrong, marginBottom: spacing.lg,
  },
  sheetTitle: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: spacing.md },
  sheetInput: {
    color: colors.onSurface, fontSize: fontSize.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  priorityRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  priorityChip: {
    flex: 1, height: 40, borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
  },
  priorityChipActive: { backgroundColor: colors.brandPrimary },
  priorityText: { color: colors.onSurfaceSecondary, fontWeight: fontWeight.bold, textTransform: "capitalize" },
  submitBtn: {
    marginTop: spacing.xl, height: 52, borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
  },
  submitText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.lg },
});
