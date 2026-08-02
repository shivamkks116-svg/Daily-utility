import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type Tool = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  category: string;
  route?: string;
  soon?: boolean;
};

const TOOLS: Tool[] = [
  // Productivity
  { key: "notes",    label: "Notes",        icon: "document-text", category: "Productivity", route: "/notes" },
  { key: "todos",    label: "To-Do",        icon: "checkbox",      category: "Productivity", route: "/todos" },
  { key: "habits",   label: "Habits",       icon: "leaf",          category: "Productivity", route: "/habits" },
  { key: "focus",    label: "Focus Timer",  icon: "timer",         category: "Productivity", route: "/focus" },
  { key: "voice",    label: "Voice Notes",  icon: "mic",           category: "Productivity", route: "/voice" },
  { key: "planner",  label: "Daily Planner",icon: "calendar",      category: "Productivity", soon: true },
  { key: "mood",     label: "Mood Tracker", icon: "happy",         category: "Productivity", soon: true },
  { key: "journal",  label: "Journal",      icon: "book",          category: "Productivity", soon: true },
  { key: "stopwatch",label: "Stopwatch",    icon: "stopwatch",     category: "Productivity", soon: true },

  // AI
  { key: "chat",       label: "AI Chat",       icon: "chatbubble-ellipses", category: "AI", route: "/ai/chat" },
  { key: "translator", label: "Translator",    icon: "language",            category: "AI", route: "/ai/tool/translator" },
  { key: "grammar",    label: "Grammar Fixer", icon: "create",              category: "AI", route: "/ai/tool/grammar" },
  { key: "summarize",  label: "Summarizer",    icon: "reader",              category: "AI", route: "/ai/tool/summarize" },
  { key: "email",      label: "Email Writer",  icon: "mail",                category: "AI", route: "/ai/tool/email" },
  { key: "study",      label: "Study Assistant",icon:"school",              category: "AI", route: "/ai/tool/study" },
  { key: "ocr",        label: "AI OCR",        icon: "scan",                category: "AI", soon: true },
  { key: "resume",     label: "Resume Builder",icon: "briefcase",           category: "AI", soon: true },

  // Finance
  { key: "expense", label: "Expense Tracker",icon: "wallet",         category: "Finance", route: "/expenses" },
  { key: "emi",     label: "EMI Calculator", icon: "calculator",     category: "Finance", route: "/calc/emi" },
  { key: "sip",     label: "SIP Calculator", icon: "trending-up",    category: "Finance", route: "/calc/sip" },
  { key: "currency",label: "Currency Convert",icon:"cash",           category: "Finance", route: "/calc/currency" },
  { key: "budget",  label: "Budget Planner", icon: "bar-chart",      category: "Finance", soon: true },

  // Health
  { key: "water", label: "Water Reminder",  icon: "water",   category: "Health", route: "/reminders?kind=water" },
  { key: "medicine", label: "Medicine Reminder", icon: "medkit", category: "Health", route: "/reminders?kind=medicine" },
  { key: "sleep", label: "Sleep Tracker",   icon: "moon",    category: "Health", soon: true },
  { key: "bmi",   label: "BMI Calculator",  icon: "fitness", category: "Health", soon: true },

  // Device
  { key: "qr",       label: "QR Scanner",   icon: "qr-code",     category: "Device", route: "/qr" },
  { key: "calc",     label: "Scientific Calc",icon: "calculator", category: "Device", route: "/calc/scientific" },
  { key: "unit",     label: "Unit Converter",icon: "swap-horizontal", category: "Device", route: "/calc/unit" },
  { key: "flash",    label: "Flashlight",   icon: "flashlight",  category: "Device", soon: true },
  { key: "compass",  label: "Compass",      icon: "compass",     category: "Device", soon: true },
  { key: "device",   label: "Device Info",  icon: "phone-portrait", category: "Device", soon: true },

  // Files
  { key: "pdf",     label: "Image → PDF",     icon: "document-attach", category: "Files", route: "/pdf" },
  { key: "zip",     label: "ZIP Extractor",   icon: "archive",         category: "Files", soon: true },
  { key: "imgconv", label: "Image Converter", icon: "image",           category: "Files", soon: true },
  { key: "vault",   label: "Secure Vault",    icon: "lock-closed",     category: "Files", soon: true },
];

const CATEGORIES = ["All", "Productivity", "AI", "Finance", "Health", "Device", "Files"] as const;

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return TOOLS.filter((t) => (cat === "All" || t.category === cat) && (!s || t.label.toLowerCase().includes(s)));
  }, [q, cat]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="tools-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Text style={styles.title}>All Tools</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            testID="tools-search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search everything..."
            placeholderTextColor={colors.onSurfaceTertiary}
            style={styles.searchInput}
          />
        </View>
      </SafeAreaView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        {CATEGORIES.map((c) => {
          const active = c === cat;
          return (
            <Pressable
              key={c}
              testID={`chip-${c.toLowerCase()}`}
              onPress={() => setCat(c)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: 96 + insets.bottom,
          paddingTop: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {filtered.map((t) => (
            <Pressable
              key={t.key}
              testID={`tool-${t.key}`}
              onPress={() => {
                if (t.soon) return;
                if (t.route) router.push(t.route as any);
              }}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.cardIcon}>
                <Ionicons name={t.icon} size={22} color={colors.brandPrimary} />
              </View>
              <Text style={styles.cardLabel}>{t.label}</Text>
              <View style={styles.badgeRow}>
                <Text style={styles.categoryTag}>{t.category}</Text>
                {t.soon ? (
                  <View style={styles.soon} testID={`soon-${t.key}`}>
                    <Text style={styles.soonText}>Soon</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          ))}
          {filtered.length === 0 ? (
            <View style={styles.empty} testID="tools-empty">
              <Ionicons name="search" size={40} color={colors.onSurfaceTertiary} />
              <Text style={styles.emptyText}>No tools found</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.surface },
  title: {
    color: colors.onSurface,
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -1,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    flex: 1,
    color: colors.onSurface,
    fontSize: fontSize.base,
    paddingVertical: 0,
  },
  chipsScroll: { maxHeight: 56, marginTop: spacing.sm },
  chipsRow: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    alignItems: "center",
  },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  chipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  chipText: {
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  chipTextActive: { color: colors.onBrandPrimary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: {
    width: "47.5%",
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 130,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  cardLabel: {
    color: colors.onSurface,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  badgeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  categoryTag: {
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  soon: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
  },
  soonText: { color: colors.onSurfaceSecondary, fontSize: 10, fontWeight: fontWeight.bold },
  empty: {
    width: "100%",
    alignItems: "center",
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: { color: colors.onSurfaceTertiary },
});
