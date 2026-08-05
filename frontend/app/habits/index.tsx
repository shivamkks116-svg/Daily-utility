import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardStickyView } from "@/src/utils/keyboard";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type Habit = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  target_per_week: number;
  logs: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function lastNDays(n: number): string[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(ymd(new Date(now.getTime() - i * DAY_MS)));
  return out;
}

function currentStreak(logs: string[]): number {
  const set = new Set(logs);
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = ymd(new Date(today.getTime() - i * DAY_MS));
    if (set.has(d)) streak++;
    else if (i > 0) break;
    else {
      // today not logged yet — don't break streak, allow yesterday
      continue;
    }
  }
  return streak;
}

export default function HabitsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🌱");
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => lastNDays(14), []);
  const today = days[days.length - 1];

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: Habit[] }>("/habits");
      setItems(res.items);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  async function toggleLog(h: Habit, date: string) {
    const has = h.logs.includes(date);
    setItems((prev) => prev.map((x) => x.id === h.id ? {
      ...x, logs: has ? x.logs.filter(d => d !== date) : [...x.logs, date],
    } : x));
    try {
      await api(`/habits/${h.id}/log`, { method: "POST", body: { date } });
    } catch {}
  }

  async function del(h: Habit) {
    setItems((prev) => prev.filter((x) => x.id !== h.id));
    await api(`/habits/${h.id}`, { method: "DELETE" });
  }

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const h = await api<Habit>("/habits", {
        method: "POST",
        body: { name: name.trim(), emoji, color: colors.brandPrimary, target_per_week: 7 },
      });
      setItems((prev) => [...prev, h]);
      setName("");
      setEmoji("🌱");
      setModal(false);
    } finally { setSaving(false); }
  }

  const totalCompletedToday = items.filter(h => h.logs.includes(today)).length;
  const bestStreak = Math.max(0, ...items.map(h => currentStreak(h.logs)));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="habits-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="habits-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Habits</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summary} testID="habits-summary">
          <View style={{ flex: 1 }}>
            <Text style={styles.streakBig}>{bestStreak}</Text>
            <Text style={styles.streakLabel}>day best streak</Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryValue}>{totalCompletedToday}/{items.length || 0}</Text>
            <Text style={styles.summaryLabel}>done today</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
        ) : items.length === 0 ? (
          <View style={styles.empty} testID="habits-empty">
            <View style={styles.emptyIcon}>
              <Ionicons name="leaf-outline" size={30} color={colors.brandPrimary} />
            </View>
            <Text style={styles.emptyTitle}>Plant a new habit</Text>
            <Text style={styles.emptySub}>Small daily wins compound into lasting change.</Text>
          </View>
        ) : (
          items.map((h) => (
            <View key={h.id} style={styles.card} testID={`habit-${h.id}`}>
              <View style={styles.habitHead}>
                <View style={styles.habitEmoji}><Text style={{ fontSize: 22 }}>{h.emoji}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.habitName}>{h.name}</Text>
                  <Text style={styles.habitStreak}>
                    <Ionicons name="flame" size={12} color={colors.brandPrimary} />
                    {" "}
                    {currentStreak(h.logs)} day streak
                  </Text>
                </View>
                <Pressable onPress={() => del(h)} testID={`habit-delete-${h.id}`} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.onSurfaceTertiary} />
                </Pressable>
              </View>
              <View style={styles.heatmap}>
                {days.map((d) => {
                  const done = h.logs.includes(d);
                  const isToday = d === today;
                  return (
                    <Pressable
                      key={d}
                      testID={`habit-log-${h.id}-${d}`}
                      onPress={() => toggleLog(h, d)}
                      style={[
                        styles.heatCell,
                        done && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
                        !done && isToday && { borderColor: colors.brandPrimary },
                      ]}
                    />
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Pressable
        testID="habits-fab"
        onPress={() => setModal(true)}
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
      >
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModal(false)} />
          <KeyboardStickyView>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>New habit</Text>
              <TextInput
                testID="habit-name-input"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Read 10 pages"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.sheetInput}
                autoFocus
              />
              <Text style={styles.emojiLabel}>Choose icon</Text>
              <View style={styles.emojiRow}>
                {["🌱","💧","📚","🏃","🧘","🥗","💤","💻","🎯"].map((e) => {
                  const active = emoji === e;
                  return (
                    <Pressable
                      key={e}
                      testID={`emoji-${e}`}
                      onPress={() => setEmoji(e)}
                      style={[styles.emojiPick, active && styles.emojiPickActive]}
                    >
                      <Text style={{ fontSize: 22 }}>{e}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                testID="habit-submit-btn"
                onPress={submit}
                disabled={!name.trim() || saving}
                style={({ pressed }) => [
                  styles.submitBtn,
                  (!name.trim() || saving) && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.submitText}>Add habit</Text>
                )}
              </Pressable>
            </View>
          </KeyboardStickyView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  summary: {
    flexDirection: "row", padding: spacing.lg,
    borderRadius: radius.lg, backgroundColor: colors.brandTertiary,
    marginBottom: spacing.xl, alignItems: "center",
  },
  streakBig: {
    color: colors.onSurface,
    fontSize: 56, fontWeight: fontWeight.extrabold, letterSpacing: -2, lineHeight: 60,
  },
  streakLabel: { color: colors.onBrandTertiary, fontSize: fontSize.sm, marginTop: 4 },
  summaryRight: { alignItems: "flex-end" },
  summaryValue: { color: colors.onSurface, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  summaryLabel: { color: colors.onBrandTertiary, fontSize: fontSize.sm },
  center: { alignItems: "center", padding: spacing.xxl },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.md, marginTop: spacing.xl },
  emptyIcon: {
    width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  emptySub: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, textAlign: "center" },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md,
  },
  habitHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  habitEmoji: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  habitName: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  habitStreak: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  heatmap: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  heatCell: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surfaceTertiary,
  },
  fab: {
    position: "absolute", right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
    elevation: 6,
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.xl, paddingBottom: spacing.xxxl,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.lg },
  sheetTitle: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: spacing.md },
  sheetInput: {
    color: colors.onSurface, fontSize: fontSize.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  emojiLabel: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
  emojiRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  emojiPick: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "transparent",
  },
  emojiPickActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  submitBtn: {
    marginTop: spacing.xl, height: 52, borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
  },
  submitText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.lg },
});
