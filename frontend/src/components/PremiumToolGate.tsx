import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { useSubscription } from "@/src/subscription/RevenueCat";
import { useFeatureFlags } from "@/src/features/flags";
import { adsAvailable } from "@/src/ads/native";
import { showRewardedAdResult } from "@/src/ads/rewarded";
import { tap, success } from "@/src/utils/haptics";

/**
 * Wraps a premium tool screen. Free users watch one rewarded ad to unlock the
 * tool for a single visit. Premium users pass straight through. When ads are
 * unavailable (web / Expo Go) or AdMob has no fill, the tool unlocks anyway so
 * the user is never dead-ended.
 */
export function withPremiumGate<P extends object>(Screen: React.ComponentType<P>, toolLabel: string) {
  function Gated(props: P) {
    const { isSubscribed } = useSubscription();
    const [unlocked, setUnlocked] = useState(false);
    if (isSubscribed || unlocked) return <Screen {...props} />;
    return <LockScreen toolLabel={toolLabel} onUnlock={() => setUnlocked(true)} />;
  }
  Gated.displayName = `PremiumGate(${toolLabel})`;
  return Gated;
}

function LockScreen({ toolLabel, onUnlock }: { toolLabel: string; onUnlock: () => void }) {
  const router = useRouter();
  const { flags } = useFeatureFlags();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function watchAd() {
    tap();
    setErr(null);
    if (!adsAvailable) {
      success();
      onUnlock();
      return;
    }
    setLoading(true);
    const result = await showRewardedAdResult();
    setLoading(false);
    if (result === "earned" || result === "unavailable") {
      success();
      onUnlock();
    } else {
      setErr("Please watch the full ad to unlock this tool.");
    }
  }

  return (
    <View style={styles.root} testID="premium-gate">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="premium-gate-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{toolLabel}</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="lock-closed" size={28} color={colors.onBrandPrimary} />
        </View>
        <Text style={styles.badge}>PREMIUM TOOL</Text>
        <Text style={styles.title}>Unlock {toolLabel}</Text>
        <Text style={styles.subtitle}>
          Watch one short ad to use this tool once, completely free.
        </Text>

        {err ? <Text style={styles.err} testID="premium-gate-error">{err}</Text> : null}

        <Pressable
          testID="premium-gate-watch-ad"
          onPress={watchAd}
          disabled={loading}
          style={({ pressed }) => [styles.primaryBtn, (pressed || loading) && { opacity: 0.85 }]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Ionicons name="play-circle" size={20} color={colors.onBrandPrimary} />
              <Text style={styles.primaryText}>Watch Ad & Unlock</Text>
            </>
          )}
        </Pressable>

        {flags.premium_enabled ? (
          <Pressable
            testID="premium-gate-go-premium"
            onPress={() => router.push("/premium" as any)}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="diamond-outline" size={18} color={colors.onSurface} />
            <Text style={styles.secondaryText}>Go Premium · No Ads</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  headerTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  icon: {
    width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  badge: {
    color: colors.brandPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold,
    letterSpacing: 1, marginBottom: spacing.xs,
  },
  title: {
    color: colors.onSurface, fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold,
    textAlign: "center", letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.onSurfaceSecondary, fontSize: fontSize.base, textAlign: "center",
    marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 22,
  },
  err: { color: colors.error, fontSize: fontSize.sm, marginBottom: spacing.md, textAlign: "center" },
  primaryBtn: {
    width: "100%", height: 52, borderRadius: radius.pill, backgroundColor: colors.brandPrimary,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
  },
  primaryText: { color: colors.onBrandPrimary, fontSize: fontSize.base, fontWeight: fontWeight.bold },
  secondaryBtn: {
    width: "100%", height: 52, borderRadius: radius.pill, marginTop: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderStrong,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
  },
  secondaryText: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});
