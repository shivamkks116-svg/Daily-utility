import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type PremiumState = { premium: boolean; plan: string | null; activated_at: string | null };

const FEATURES = [
  { icon: "sparkles", label: "Unlimited AI conversations", desc: "No caps on chat, translations, summaries" },
  { icon: "cloud-upload", label: "Cloud backup & sync", desc: "Your data safely mirrored across devices" },
  { icon: "close-circle", label: "Zero ads", desc: "A distraction-free, calm experience" },
  { icon: "color-palette", label: "Premium themes", desc: "Advanced Material You palettes" },
  { icon: "download", label: "Data export", desc: "Export notes, expenses, habits as CSV/PDF" },
  { icon: "rocket", label: "Priority AI access", desc: "Faster response times, priority queue" },
];

const PLANS = [
  { key: "monthly",  label: "Monthly",  price: "$4.99",   sub: "/month",  best: false },
  { key: "yearly",   label: "Yearly",   price: "$29.99",  sub: "/year (Save 50%)", best: true },
  { key: "lifetime", label: "Lifetime", price: "$79.99",  sub: "one-time", best: false },
];

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [status, setStatus] = useState<PremiumState | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [selected, setSelected] = useState("yearly");

  const load = useCallback(async () => {
    try {
      const r = await api<PremiumState>("/premium/status");
      setStatus(r);
    } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function purchase() {
    setPurchasing(selected);
    try {
      await api<PremiumState>("/premium/mock-purchase", { method: "POST", body: { plan: selected } });
      await load();
    } finally { setPurchasing(null); }
  }

  async function cancel() {
    await api("/premium/cancel", { method: "POST" });
    await load();
  }

  if (loading) {
    return <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  const isPremium = status?.premium;

  return (
    <View style={styles.root} testID="premium-screen">
      <LinearGradient
        colors={[colors.brandTertiary, colors.surface]}
        style={styles.gradient}
      />
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="premium-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <View style={styles.crown}>
            <Ionicons name="diamond" size={30} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.title}>DailyHub{"\n"}Premium.</Text>
          <Text style={styles.subtitle}>Unlock everything DailyHub AI can do — in one calm, ad-free experience.</Text>
        </View>

        {isPremium ? (
          <View style={styles.activeCard} testID="premium-active">
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>Premium active</Text>
              <Text style={styles.activeSub}>Plan: {status?.plan}</Text>
            </View>
            <Pressable testID="premium-cancel-btn" onPress={cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.features}>
          {FEATURES.map(f => (
            <View key={f.label} style={styles.featureRow}>
              <View style={styles.featureIcon}><Ionicons name={f.icon as any} size={16} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.label}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {!isPremium ? (
          <>
            <Text style={styles.pickTitle}>Choose your plan</Text>
            <View style={styles.plans}>
              {PLANS.map(p => {
                const active = selected === p.key;
                return (
                  <Pressable
                    key={p.key}
                    testID={`plan-${p.key}`}
                    onPress={() => setSelected(p.key)}
                    style={[styles.plan, active && styles.planActive]}
                  >
                    {p.best ? <View style={styles.bestBadge}><Text style={styles.bestText}>Best value</Text></View> : null}
                    <Text style={styles.planLabel}>{p.label}</Text>
                    <Text style={styles.planPrice}>{p.price}</Text>
                    <Text style={styles.planSub}>{p.sub}</Text>
                    <View style={[styles.planCheck, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                      {active ? <Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <View style={styles.disclaimer} testID="premium-mock-notice">
          <Ionicons name="information-circle" size={14} color={colors.onSurfaceTertiary} />
          <Text style={styles.disclaimerText}>
            Purchases are MOCKED in this preview. Real Play Billing v8 activates automatically after you deploy and generate an Android build.
          </Text>
        </View>
      </ScrollView>

      {!isPremium ? (
        <View style={[styles.buyBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable
            testID="premium-purchase-btn"
            onPress={purchase}
            disabled={purchasing !== null}
            style={({ pressed }) => [styles.buyBtn, pressed && { opacity: 0.9 }, purchasing && { opacity: 0.7 }]}
          >
            {purchasing ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Ionicons name="lock-open" size={20} color={colors.onBrandPrimary} />
                <Text style={styles.buyText}>Unlock Premium</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  gradient: { position: "absolute", top: 0, left: 0, right: 0, height: 400 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  top: { alignItems: "flex-start", paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },
  crown: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  title: {
    color: colors.onSurface,
    fontSize: 40, fontWeight: fontWeight.extrabold, letterSpacing: -1.5, lineHeight: 44,
  },
  subtitle: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 22 },
  activeCard: {
    marginHorizontal: spacing.xl, padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    flexDirection: "row", alignItems: "center", gap: spacing.md,
  },
  activeTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  activeSub: { color: colors.onBrandTertiary, fontSize: fontSize.sm, marginTop: 2 },
  cancelText: { color: colors.error, fontWeight: fontWeight.bold },
  features: { paddingHorizontal: spacing.xl, gap: spacing.md, marginTop: spacing.xl },
  featureRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  featureIcon: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginTop: 2 },
  featureTitle: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  featureDesc: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  pickTitle: {
    color: colors.onSurface,
    fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.3,
    paddingHorizontal: spacing.xl, marginTop: spacing.xxl, marginBottom: spacing.md,
  },
  plans: { paddingHorizontal: spacing.xl, gap: spacing.md },
  plan: {
    padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 2, borderColor: colors.border,
  },
  planActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  bestBadge: { position: "absolute", top: -10, right: spacing.md, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, height: 20, borderRadius: radius.pill, justifyContent: "center" },
  bestText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  planLabel: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  planPrice: { color: colors.onSurface, fontSize: 30, fontWeight: fontWeight.extrabold, letterSpacing: -0.5, marginTop: 4 },
  planSub: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  planCheck: {
    position: "absolute", right: spacing.lg, top: spacing.lg,
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center",
  },
  disclaimer: {
    marginHorizontal: spacing.xl, marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, flexDirection: "row", gap: spacing.sm, alignItems: "flex-start",
  },
  disclaimerText: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, flex: 1, lineHeight: 16 },
  buyBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  buyBtn: {
    height: 56, borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md,
  },
  buyText: { color: colors.onBrandPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
});
