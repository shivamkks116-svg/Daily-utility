/**
 * Admin control panel.
 *
 * - Only reachable at `/admin` by direct navigation (not in the main tabs).
 * - Backend gates every request behind `ADMIN_EMAILS` — a non-admin user
 *   hits a 403 and sees a clean "not authorised" state.
 * - Primary job today: toggle the `premium_enabled` feature flag on/off so
 *   the Premium surface stays hidden until RevenueCat / Play billing is
 *   fully live.
 * - Also surfaces lightweight user stats so you can tell at a glance how
 *   many users / guests / premium accounts exist.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { useFeatureFlags } from "@/src/features/flags";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type AdminConfig = {
  flags: { premium_enabled: boolean };
  meta: Record<string, { updated_at?: string; updated_by?: string }>;
};

type AdminStats = {
  users: {
    total: number;
    guests: number;
    premium: number;
    active_30d: number;
  };
};

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh: refreshFlags } = useFeatureFlags();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        api<AdminConfig>("/admin/config", { method: "GET" }),
        api<AdminStats>("/admin/stats", { method: "GET" }).catch(() => null),
      ]);
      setConfig(c);
      setStats(s);
      setForbidden(false);
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      if (err?.status === 403) {
        setForbidden(true);
      } else {
        Alert.alert("Admin load failed", err?.message || String(e));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const togglePremium = async (next: boolean) => {
    setBusy("premium");
    try {
      await api("/admin/config/premium", {
        method: "POST",
        body: { enabled: next } as unknown as Record<string, unknown>,
      });
      await load();
      await refreshFlags(); // let every mounted screen pick up the change
    } catch (e: unknown) {
      Alert.alert("Toggle failed", (e as Error)?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  if (forbidden) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={48} color={colors.onSurfaceTertiary} />
          <Text style={styles.titleBig}>Admin only</Text>
          <Text style={styles.sub}>
            This panel is restricted to administrators. If this is a mistake,
            ask the backend owner to add your email to{" "}
            <Text style={{ fontWeight: fontWeight.bold }}>ADMIN_EMAILS</Text>.
          </Text>
          <Pressable style={styles.btn} onPress={() => router.replace("/(main)/home")}>
            <Text style={styles.btnText}>Back to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const premiumEnabled = !!config?.flags.premium_enabled;
  const meta = config?.meta.premium_enabled;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Admin</Text>
          <Text style={styles.subtitle}>Feature flags · metrics</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brandPrimary}
          />
        }
      >
        {/* Stats block */}
        {stats ? (
          <View style={styles.statsRow}>
            <StatCard label="Total" value={stats.users.total} />
            <StatCard label="Guests" value={stats.users.guests} />
            <StatCard label="Premium" value={stats.users.premium} />
            <StatCard label="30d active" value={stats.users.active_30d} />
          </View>
        ) : null}

        {/* Premium toggle */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardIcon}>
              <Ionicons name="diamond" size={20} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Premium surface</Text>
              <Text style={styles.cardSub}>
                Hide "Go Premium" cards and block the /premium route until
                RevenueCat is live in Play Console.
              </Text>
            </View>
            {busy === "premium" ? (
              <ActivityIndicator color={colors.brandPrimary} />
            ) : (
              <Switch
                value={premiumEnabled}
                onValueChange={togglePremium}
                trackColor={{ false: colors.border, true: colors.brandPrimary }}
                thumbColor="#fff"
              />
            )}
          </View>
          {meta?.updated_at ? (
            <Text style={styles.metaText}>
              Last changed {formatTime(meta.updated_at)}
              {meta.updated_by ? ` by ${meta.updated_by}` : ""}
            </Text>
          ) : (
            <Text style={styles.metaText}>Never changed (using default)</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: spacing.xs },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  titleBig: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  sub: { color: colors.onSurfaceSecondary, fontSize: fontSize.md, textAlign: "center", lineHeight: 22 },
  btn: {
    marginTop: spacing.md,
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  btnText: { color: colors.onBrandPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 2,
  },
  statValue: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  statLabel: { color: colors.onSurfaceTertiary, fontSize: 11 },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  cardSub: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
  metaText: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs },
});
