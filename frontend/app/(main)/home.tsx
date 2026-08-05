import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { api } from "@/src/api/client";
import { tap } from "@/src/utils/haptics";
import { storage } from "@/src/utils/storage";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { AdBanner } from "@/src/ads/AdBanner";

const HERO_BG =
  "https://images.unsplash.com/photo-1649861742672-20152f77c1f5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRhcmslMjBtb3NzJTIwZ3JlZW4lMjBlbWVyYWxkJTIwZ3JhZGllbnQlMjBiYWNrZ3JvdW5kJTIwYXRtb3NwaGVyaWN8ZW58MHx8fHwxNzg1NjU4MjEwfDA&ixlib=rb-4.1.0&q=85";

type Quick = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; route: string; testID: string };

const QUICK: Quick[] = [
  { key: "notes",  label: "Notes",     icon: "document-text", route: "/notes",  testID: "quick-notes"  },
  { key: "todos",  label: "To-Do",     icon: "checkbox",      route: "/todos",  testID: "quick-todos"  },
  { key: "habits", label: "Habits",    icon: "leaf",          route: "/habits", testID: "quick-habits" },
  { key: "focus",  label: "Focus",     icon: "timer",         route: "/focus",  testID: "quick-focus"  },
  { key: "chat",   label: "AI Chat",   icon: "sparkles",      route: "/ai/chat",testID: "quick-ai-chat"},
  { key: "expense",label: "Expenses",  icon: "wallet",        route: "/expenses",testID: "quick-expense"},
];

const QUOTES = [
  "Small steps every day beat big leaps once a year.",
  "Progress, not perfection.",
  "The best time to start was yesterday. The next best is now.",
  "Focus is a superpower. Guard it.",
  "Consistency compounds.",
  "Discipline is choosing between what you want now and what you want most.",
  "A quiet mind gets more done.",
  "One thing well beats ten things half-done.",
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

type RecentTool = { key: string; ts: number };

async function loadRecent(): Promise<RecentTool[]> {
  const raw = await storage.getItem("dh_recent_tools", "[]");
  try { return JSON.parse(raw); } catch { return []; }
}
async function pushRecent(key: string) {
  const arr = await loadRecent();
  const next = [{ key, ts: Date.now() }, ...arr.filter(x => x.key !== key)].slice(0, 6);
  await storage.setItem("dh_recent_tools", JSON.stringify(next));
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const firstName = useMemo(() => (user?.name || "there").split(" ")[0], [user]);
  const today = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
    [],
  );
  const quote = useMemo(() => {
    const idx = Math.floor((Date.now() / (1000 * 60 * 60 * 24)) % QUOTES.length);
    return QUOTES[idx];
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const [todos, setTodos] = useState<any[]>([]);
  const [focusToday, setFocusToday] = useState(0);
  const [habitsDoneToday, setHabitsDoneToday] = useState(0);
  const [habitsTotal, setHabitsTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [recent, setRecent] = useState<RecentTool[]>([]);

  const load = useCallback(async () => {
    try {
      const [t, f, h, r] = await Promise.all([
        api<{ items: any[] }>("/todos").catch(() => ({ items: [] })),
        api<{ today_seconds: number }>("/focus").catch(() => ({ today_seconds: 0 })),
        api<{ items: any[] }>("/habits").catch(() => ({ items: [] })),
        loadRecent(),
      ]);
      setTodos(t.items || []);
      setFocusToday(Math.round((f.today_seconds || 0) / 60));
      const tk = todayKey();
      const done = (h.items || []).filter((x: any) => (x.logs || []).includes(tk)).length;
      setHabitsDoneToday(done);
      setHabitsTotal((h.items || []).length);
      // Streak: max current streak across habits
      let best = 0;
      for (const hb of h.items || []) {
        const set = new Set<string>(hb.logs || []);
        let s = 0;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        for (let i = 0; i < 365; i++) {
          const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
          if (set.has(d)) s++;
          else if (i > 0) break;
        }
        if (s > best) best = s;
      }
      setStreak(best);
      setRecent(r);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  const openTool = (q: Quick) => {
    tap();
    pushRecent(q.key);
    router.push(q.route as any);
  };

  const openRoute = (route: string, key?: string) => {
    tap();
    if (key) pushRecent(key);
    router.push(route as any);
  };

  const openTodos = todos.filter((t) => !t.completed).length;
  const doneTodos = todos.filter((t) => t.completed).length;
  const totalTodos = todos.length;
  const todoPct = totalTodos ? doneTodos / totalTodos : 0;
  const focusPct = Math.min(focusToday / 60, 1); // target 60 min/day
  const habitsPct = habitsTotal ? habitsDoneToday / habitsTotal : 0;
  const overall = ((todoPct + focusPct + habitsPct) / 3) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="home-screen">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.brandPrimary}
          />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Image source={{ uri: HERO_BG }} style={styles.heroBg} />
          <LinearGradient
            colors={["rgba(17,20,18,0.05)", "rgba(17,20,18,0.55)", colors.surface]}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={["top"]} style={styles.heroInner}>
            <View style={styles.topRow}>
              <View>
                <Text style={styles.helloSmall}>{today}</Text>
                <Text style={styles.helloBig}>
                  {greeting()},{"\n"}
                  <Text style={{ color: colors.brandPrimary }}>{firstName}.</Text>
                </Text>
              </View>
              <Pressable
                testID="profile-avatar-button"
                onPress={() => { tap(); router.push("/(main)/profile"); }}
                style={styles.avatar}
              >
                {user?.picture ? (
                  <Image source={{ uri: user.picture }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
                )}
              </Pressable>
            </View>

            {/* Motivational quote card */}
            <View style={styles.quoteCard} testID="quote-card">
              <View style={styles.quoteIcon}>
                <Ionicons name="sparkles" size={16} color={colors.onBrandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quoteLabel}>TODAY’S SPARK</Text>
                <Text style={styles.quoteText} numberOfLines={2}>“{quote}”</Text>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Today's Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today’s progress</Text>
          <View style={styles.progressCard} testID="progress-card">
            <View style={styles.progressHead}>
              <View>
                <Text style={styles.progressPct}>{Math.round(overall)}%</Text>
                <Text style={styles.progressLabel}>overall</Text>
              </View>
              <View style={styles.streakPill}>
                <Ionicons name="flame" size={14} color={colors.brandPrimary} />
                <Text style={styles.streakText}>{streak} day streak</Text>
              </View>
            </View>
            <View style={styles.barsWrap}>
              <ProgressBar label="Tasks"  value={todoPct}   right={`${doneTodos}/${totalTodos || 0}`} />
              <ProgressBar label="Focus"  value={focusPct}  right={`${focusToday} / 60m`} />
              <ProgressBar label="Habits" value={habitsPct} right={`${habitsDoneToday}/${habitsTotal || 0}`} />
            </View>
          </View>
        </View>

        {/* Continue Working */}
        {openTodos > 0 || focusToday > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continue working</Text>
            <View style={{ gap: spacing.md }}>
              {openTodos > 0 ? (
                <Pressable
                  testID="continue-todos"
                  onPress={() => openRoute("/todos", "todos")}
                  style={({ pressed }) => [styles.contRow, pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] }]}
                >
                  <View style={[styles.contIcon, { backgroundColor: colors.brandTertiary }]}>
                    <Ionicons name="checkbox" size={20} color={colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contTitle}>{openTodos} {openTodos === 1 ? "task" : "tasks"} to finish</Text>
                    <Text style={styles.contSub}>{todos.find(t => !t.completed)?.title || ""}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
                </Pressable>
              ) : null}
              <Pressable
                testID="continue-focus"
                onPress={() => openRoute("/focus", "focus")}
                style={({ pressed }) => [styles.contRow, pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] }]}
              >
                <View style={[styles.contIcon, { backgroundColor: colors.brandTertiary }]}>
                  <Ionicons name="timer" size={20} color={colors.brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contTitle}>Start a 25-minute focus</Text>
                  <Text style={styles.contSub}>{focusToday}m focused today · target 60m</Text>
                </View>
                <Ionicons name="play-circle" size={22} color={colors.brandPrimary} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Recently used */}
        {recent.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recently used</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.xl }}>
              {recent.map((r) => {
                const q = QUICK.find(x => x.key === r.key);
                if (!q) return null;
                return (
                  <Pressable
                    key={r.key}
                    testID={`recent-${r.key}`}
                    onPress={() => openTool(q)}
                    style={styles.recentChip}
                  >
                    <View style={styles.recentIcon}>
                      <Ionicons name={q.icon} size={18} color={colors.brandPrimary} />
                    </View>
                    <Text style={styles.recentLabel}>{q.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Quick actions */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
            <Pressable testID="see-all-tools" onPress={() => { tap(); router.push("/(main)/tools"); }}>
              <Text style={styles.link}>See all</Text>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {QUICK.map((q) => (
              <Pressable
                key={q.key}
                testID={q.testID}
                onPress={() => openTool(q)}
                style={({ pressed }) => [styles.tile, pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] }]}
              >
                <View style={styles.tileIcon}>
                  <Ionicons name={q.icon} size={22} color={colors.brandPrimary} />
                </View>
                <Text style={styles.tileLabel}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Coming soon */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coming soon</Text>
          <View style={styles.comingWrap}>
            {[
              { icon: "musical-notes-outline", label: "Voice Notes" },
              { icon: "qr-code-outline", label: "QR Scanner" },
              { icon: "medkit-outline", label: "Medicine Reminder" },
              { icon: "document-attach-outline", label: "PDF Tools" },
              { icon: "diamond-outline", label: "Premium" },
              { icon: "moon-outline", label: "Sleep Tracker" },
            ].map((c) => (
              <View key={c.label} style={styles.comingChip}>
                <Ionicons name={c.icon as any} size={14} color={colors.onBrandTertiary} />
                <Text style={styles.comingText}>{c.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <AdBanner testID="home-banner" />
        </View>
      </ScrollView>
    </View>
  );
}

function ProgressBar({ label, value, right }: { label: string; value: number; right: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={pbStyles.wrap}>
      <View style={pbStyles.head}>
        <Text style={pbStyles.label}>{label}</Text>
        <Text style={pbStyles.right}>{right}</Text>
      </View>
      <View style={pbStyles.track}>
        <View style={[pbStyles.fill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const pbStyles = StyleSheet.create({
  wrap: { gap: 6 },
  head: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  right: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, fontVariant: ["tabular-nums"] },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4, backgroundColor: colors.brandPrimary },
});

const TILE_GAP = spacing.md;

const styles = StyleSheet.create({
  hero: { height: 320, backgroundColor: colors.surface, overflow: "hidden" },
  heroBg: { ...StyleSheet.absoluteFillObject, resizeMode: "cover" },
  heroInner: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  helloSmall: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginBottom: spacing.xs },
  helloBig: {
    color: colors.onSurface, fontSize: 30, fontWeight: fontWeight.extrabold,
    letterSpacing: -1, lineHeight: 36,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.brandSecondary,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImg: { width: 44, height: 44 },
  avatarText: { color: colors.onBrandSecondary, fontWeight: fontWeight.bold, fontSize: fontSize.lg },
  quoteCard: {
    marginTop: "auto",
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: "rgba(27,34,30,0.9)",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  quoteIcon: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  quoteLabel: { color: colors.brandPrimary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
  quoteText: { color: colors.onSurface, fontSize: fontSize.sm, marginTop: 2, lineHeight: 20, fontStyle: "italic" },
  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: {
    color: colors.onSurface,
    fontSize: fontSize.xl, fontWeight: fontWeight.bold,
    letterSpacing: -0.3, marginBottom: spacing.md,
  },
  link: { color: colors.brandPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  progressCard: {
    padding: spacing.lg, borderRadius: radius.xl,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    gap: spacing.lg,
  },
  progressHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressPct: {
    color: colors.onSurface, fontSize: 44, fontWeight: fontWeight.extrabold, letterSpacing: -1.5,
    fontVariant: ["tabular-nums"], lineHeight: 48,
  },
  progressLabel: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  streakPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.md, height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  streakText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  barsWrap: { gap: spacing.md },
  contRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  contIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  contTitle: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  contSub: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  recentChip: {
    alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    minWidth: 92,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  recentIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  recentLabel: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: TILE_GAP },
  tile: {
    width: "31.5%", aspectRatio: 1,
    borderRadius: radius.xl, backgroundColor: colors.surfaceSecondary,
    padding: spacing.md, justifyContent: "space-between",
    borderWidth: 1, borderColor: colors.border,
  },
  tileIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  tileLabel: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  comingWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  comingChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  comingText: { color: colors.onBrandTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
