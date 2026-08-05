import React from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type Feature = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
};

const FEATURES: Feature[] = [
  { icon: "sparkles", label: "Unlimited AI conversations", desc: "No caps on chat, translations, summaries" },
  { icon: "cloud-upload", label: "Cloud backup & sync", desc: "Your data safely mirrored across devices" },
  { icon: "close-circle", label: "Zero ads", desc: "A distraction-free, calm experience" },
  { icon: "color-palette", label: "Premium themes", desc: "Advanced Material You palettes" },
  { icon: "download", label: "Data export", desc: "Export notes, expenses, habits as CSV/PDF" },
  { icon: "rocket", label: "Priority AI access", desc: "Faster response times, priority queue" },
];

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="premium-screen">
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            testID="premium-back"
            onPress={() => router.back()}
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Premium</Text>
          <View style={styles.iconBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={[colors.brandPrimary, colors.brandSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.badge}>
            <Ionicons name="time" size={14} color={colors.onBrandPrimary} />
            <Text style={styles.badgeText}>Coming Soon</Text>
          </View>
          <View style={styles.diamondWrap}>
            <Ionicons name="diamond" size={44} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.heroTitle}>DailyHub AI Premium</Text>
          <Text style={styles.heroSubtitle}>
            Premium Membership will be available in a future update.{"\n"}Stay tuned — the wait will
            be worth it.
          </Text>
        </LinearGradient>

        {/* Features preview */}
        <Text style={styles.sectionTitle}>What you&apos;ll unlock</Text>
        <View style={styles.featuresGrid}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.featureCard} testID={`feature-${f.icon}`}>
              <View style={styles.featureIconBg}>
                <Ionicons name={f.icon} size={20} color={colors.brandPrimary} />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>

        {/* Locked purchase card */}
        <View style={styles.lockCard} testID="premium-locked-cta">
          <View style={styles.lockRow}>
            <View style={styles.lockIcon}>
              <Ionicons name="lock-closed" size={22} color={colors.onBrandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lockTitle}>Purchases not yet available</Text>
              <Text style={styles.lockDesc}>
                We&apos;re polishing subscriptions carefully. You&apos;ll see plans and pricing right here
                as soon as they go live.
              </Text>
            </View>
          </View>
          <Pressable
            disabled
            testID="premium-disabled-btn"
            style={[styles.disabledBtn]}
          >
            <Ionicons name="hourglass-outline" size={18} color={colors.onSurfaceTertiary} />
            <Text style={styles.disabledBtnText}>Coming Soon</Text>
          </Pressable>
          <Text style={styles.notifyText}>
            💡 In the meantime, watch a Rewarded Ad in AI Chat to unlock extra free requests.
          </Text>
        </View>

        {/* Notify me */}
        <View style={styles.notifyCard} testID="premium-notify-card">
          <Ionicons name="notifications-outline" size={20} color={colors.onSurfaceSecondary} />
          <Text style={styles.notifyLabel}>
            We&apos;ll notify you via the app when Premium launches. No spam, we promise.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  headerTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold },

  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  badgeText: {
    color: colors.onBrandPrimary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  diamondWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md,
  },
  heroTitle: {
    color: colors.onBrandPrimary,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  heroSubtitle: {
    color: colors.onBrandPrimary,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    textAlign: "center",
    opacity: 0.9,
    lineHeight: 20,
  },

  sectionTitle: {
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  featureCard: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  featureIconBg: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.xs,
  },
  featureLabel: {
    color: colors.onSurface,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  featureDesc: {
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },

  lockCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  lockRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  lockIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  lockTitle: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: 2 },
  lockDesc: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  disabledBtn: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  disabledBtnText: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, fontWeight: fontWeight.bold },
  notifyText: {
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.xs,
    marginTop: spacing.md,
    textAlign: "center",
  },

  notifyCard: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    marginTop: spacing.sm,
  },
  notifyLabel: {
    flex: 1,
    color: colors.onBrandTertiary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
