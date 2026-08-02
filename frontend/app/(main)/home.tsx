import { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

const HERO_BG =
  "https://images.unsplash.com/photo-1649861742672-20152f77c1f5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRhcmslMjBtb3NzJTIwZ3JlZW4lMjBlbWVyYWxkJTIwZ3JhZGllbnQlMjBiYWNrZ3JvdW5kJTIwYXRtb3NwaGVyaWN8ZW58MHx8fHwxNzg1NjU4MjEwfDA&ixlib=rb-4.1.0&q=85";

type Quick = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  testID: string;
};

const QUICK: Quick[] = [
  { key: "notes",  label: "Notes",   icon: "document-text", route: "/notes",  testID: "quick-notes"  },
  { key: "todos",  label: "To-Do",   icon: "checkbox",      route: "/todos",  testID: "quick-todos"  },
  { key: "habits", label: "Habits",  icon: "leaf",          route: "/habits", testID: "quick-habits" },
  { key: "focus",  label: "Focus",   icon: "timer",         route: "/focus",  testID: "quick-focus"  },
  { key: "chat",   label: "AI Chat", icon: "sparkles",      route: "/ai/chat",testID: "quick-ai-chat"},
  { key: "trans",  label: "Translate", icon: "language",    route: "/ai/tool/translator", testID: "quick-translate" },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="home-screen">
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 96 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
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
                onPress={() => router.push("/(main)/profile")}
                style={styles.avatar}
              >
                {user?.picture ? (
                  <Image source={{ uri: user.picture }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.insightCard} testID="daily-insight-card">
              <View style={styles.insightIcon}>
                <Ionicons name="sparkles" size={18} color={colors.onBrandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightLabel}>DAILY INSIGHT</Text>
                <Text style={styles.insightText} numberOfLines={2}>
                  Start with a 25-minute focus session — small consistent effort compounds.
                </Text>
              </View>
              <Pressable
                testID="start-focus-button"
                onPress={() => router.push("/focus")}
                style={styles.insightCta}
              >
                <Ionicons name="play" size={16} color={colors.onBrandPrimary} />
                <Text style={styles.insightCtaText}>Start</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
            <Pressable testID="see-all-tools" onPress={() => router.push("/(main)/tools")}>
              <Text style={styles.link}>See all</Text>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {QUICK.map((q) => (
              <Pressable
                key={q.key}
                testID={q.testID}
                onPress={() => router.push(q.route as any)}
                style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.tileIcon}>
                  <Ionicons name={q.icon} size={22} color={colors.brandPrimary} />
                </View>
                <Text style={styles.tileLabel}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today</Text>
          <View style={styles.statsRow}>
            <StatCard icon="timer-outline" value="0m" label="Focused" testID="stat-focus" />
            <StatCard icon="checkmark-done" value="0/0" label="Tasks" testID="stat-tasks" />
            <StatCard icon="flame" value="0" label="Streak" testID="stat-streak" />
          </View>
        </View>

        {/* Coming soon */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coming soon</Text>
          <View style={styles.comingWrap}>
            {[
              { icon: "wallet-outline", label: "Expense Tracker" },
              { icon: "water-outline", label: "Water Reminder" },
              { icon: "document-attach-outline", label: "PDF Tools" },
              { icon: "qr-code-outline", label: "QR Scanner" },
              { icon: "musical-notes-outline", label: "Voice Notes" },
              { icon: "medkit-outline", label: "Medicine Reminder" },
            ].map((c) => (
              <View key={c.label} style={styles.comingChip}>
                <Ionicons name={c.icon as any} size={14} color={colors.onBrandTertiary} />
                <Text style={styles.comingText}>{c.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({
  icon,
  value,
  label,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  testID: string;
}) {
  return (
    <View style={styles.statCard} testID={testID}>
      <Ionicons name={icon} size={18} color={colors.brandPrimary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const TILE_GAP = spacing.md;

const styles = StyleSheet.create({
  hero: { height: 300, backgroundColor: colors.surface, overflow: "hidden" },
  heroBg: { ...StyleSheet.absoluteFillObject, resizeMode: "cover" },
  heroInner: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  helloSmall: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginBottom: spacing.xs },
  helloBig: {
    color: colors.onSurface,
    fontSize: 30,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -1,
    lineHeight: 36,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.brandSecondary,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImg: { width: 44, height: 44 },
  avatarText: {
    color: colors.onBrandSecondary,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.lg,
  },
  insightCard: {
    marginTop: "auto",
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "rgba(27,34,30,0.85)",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  insightIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  insightLabel: {
    color: colors.brandPrimary, fontSize: 10,
    fontWeight: fontWeight.bold, letterSpacing: 1,
  },
  insightText: { color: colors.onSurface, fontSize: fontSize.base, marginTop: 2 },
  insightCta: {
    flexDirection: "row",
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    gap: spacing.xs,
  },
  insightCtaText: {
    color: colors.onBrandPrimary,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.sm,
  },
  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: {
    color: colors.onSurface,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  link: { color: colors.brandPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: TILE_GAP },
  tile: {
    width: "31.5%",
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  tileLabel: {
    color: colors.onSurface,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  statsRow: { flexDirection: "row", gap: spacing.md },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  statValue: {
    color: colors.onSurface,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -0.5,
  },
  statLabel: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  comingWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  comingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  comingText: { color: colors.onBrandTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
