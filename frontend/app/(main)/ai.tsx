import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

const AI_TOOLS = [
  { key: "chat",       label: "AI Chat",         icon: "chatbubble-ellipses" as const, desc: "Ask anything, get answers.",   route: "/ai/chat" },
  { key: "translator", label: "Translator",      icon: "language" as const,            desc: "Any language, instantly.",     route: "/ai/tool/translator" },
  { key: "grammar",    label: "Grammar Fixer",   icon: "create" as const,              desc: "Polish your writing.",         route: "/ai/tool/grammar" },
  { key: "summarize",  label: "Summarizer",      icon: "reader" as const,              desc: "TL;DR any text.",              route: "/ai/tool/summarize" },
  { key: "email",      label: "Email Writer",    icon: "mail" as const,                desc: "Draft the perfect email.",     route: "/ai/tool/email" },
  { key: "study",      label: "Study Assistant", icon: "school" as const,              desc: "Explain like I’m curious.",    route: "/ai/tool/study" },
];

export default function AITabScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="ai-tab-screen">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <LinearGradient
            colors={[colors.brandTertiary, colors.surface]}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={["top"]} style={styles.heroInner}>
            <View style={styles.badge}>
              <Ionicons name="sparkles" size={14} color={colors.onBrandPrimary} />
              <Text style={styles.badgeText}>Gemini 3 Flash</Text>
            </View>
            <Text style={styles.title}>AI at your{"\n"}fingertips.</Text>
            <Text style={styles.subtitle}>
              Powerful assistants to write, translate, summarize and learn — all in one place.
            </Text>
            <Pressable
              testID="open-ai-chat-cta"
              onPress={() => router.push("/ai/chat")}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="chatbubble-ellipses" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.ctaText}>Start a new chat</Text>
            </Pressable>
          </SafeAreaView>
        </View>

        {/* Tool cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Tools</Text>
          <View style={styles.list}>
            {AI_TOOLS.map((t) => (
              <Pressable
                key={t.key}
                testID={`ai-tool-${t.key}`}
                onPress={() => router.push(t.route as any)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={t.icon} size={22} color={colors.brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{t.label}</Text>
                  <Text style={styles.rowDesc}>{t.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 280 },
  heroInner: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.md, justifyContent: "flex-end", paddingBottom: spacing.lg },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    height: 26,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  badgeText: {
    color: colors.onBrandPrimary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },
  title: {
    color: colors.onSurface,
    fontSize: 36,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -1,
    lineHeight: 42,
  },
  subtitle: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 22 },
  cta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
  },
  ctaText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  sectionTitle: {
    color: colors.onSurface,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  list: { gap: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  rowTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  rowDesc: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
});
