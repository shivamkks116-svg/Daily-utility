import React, { useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { api } from "@/src/api/client";
import { showRewardedAdResult } from "@/src/ads/rewarded";
import { ADS_ENABLED } from "@/src/ads/ids";
import { useAuth } from "@/src/contexts/AuthContext";

export type AILimitDialogProps = {
  visible: boolean;
  onClose: () => void;
  onGranted?: () => void; // called after successful reward grant
  /** "limit" = quota exhausted (default); "bonus" = voluntary top-up before running out. */
  mode?: "limit" | "bonus";
  remaining?: number;
};

export function AILimitDialog({ visible, onClose, onGranted, mode = "limit", remaining }: AILimitDialogProps) {
  const [loadingAd, setLoadingAd] = useState(false);
  const { user } = useAuth();
  const [err, setErr] = useState<string | null>(null);

  async function handleWatchAd() {
    setErr(null);
    if (!ADS_ENABLED) {
      setErr("Rewarded ads will be enabled in the next update. For now, please try again tomorrow.");
      return;
    }
    setLoadingAd(true);
    try {
      const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
      const result = await showRewardedAdResult(user?.user_id ? { userId: user.user_id, customData: nonce } : undefined);
      if (result !== "earned") {
        setLoadingAd(false);
        setErr(result === "unavailable"
          ? "No ad available right now. Please try again in a moment."
          : "Ad wasn't completed. Please watch the full ad to earn bonus requests.");
        return;
      }
      // Google's verification callback can take a few seconds to reach our server.
      let granted = false;
      for (let attempt = 0; attempt < 6 && !granted; attempt++) {
        try {
          await api("/ai/reward", { method: "POST", body: { nonce } });
          granted = true;
        } catch (e: any) {
          if (e?.status === 409 || e?.message === "reward_pending") {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          setLoadingAd(false);
          setErr(e?.message?.includes("bonus limit") ? "Daily bonus limit reached. Come back tomorrow." : "Couldn't grant bonus. Please try again in a moment.");
          return;
        }
      }
      if (!granted) {
        setLoadingAd(false);
        setErr("We couldn't confirm the ad yet. Please try again in a minute.");
        return;
      }
      setLoadingAd(false);
      onGranted?.();
      onClose();
    } catch {
      setLoadingAd(false);
      setErr("Something went wrong. Try again.");
    }
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="ai-limit-dialog">
          <View style={styles.icon}>
            <Ionicons name="flash" size={26} color={colors.onBrandPrimary} />
          </View>
          {mode === "bonus" ? (
            <>
              <Text style={styles.title}>Get 5 more{"\n"}AI requests</Text>
              <Text style={styles.subtitle}>
                You have {remaining ?? 0} free request{remaining === 1 ? "" : "s"} left today. Watch a
                short ad to add 5 more right now.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>You&apos;ve reached today&apos;s{"\n"}free AI limit.</Text>
              <Text style={styles.subtitle}>
                You get 5 free AI requests every day. Watch a short ad to unlock 5 more right now, or
                come back tomorrow for a fresh set.
              </Text>
            </>
          )}

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <Pressable
            testID="ai-limit-watch-ad"
            onPress={handleWatchAd}
            disabled={loadingAd}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }, loadingAd && { opacity: 0.7 }]}
          >
            {loadingAd ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Ionicons name="play-circle" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.primaryBtnText}>Watch Rewarded Ad</Text>
              </>
            )}
          </Pressable>

          <Pressable
            testID="ai-limit-try-tomorrow"
            onPress={onClose}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="time-outline" size={18} color={colors.onSurface} />
            <Text style={styles.secondaryBtnText}>{mode === "bonus" ? "Not Now" : "Try Again Tomorrow"}</Text>
          </Pressable>

          <View style={styles.comingSoonRow} testID="ai-limit-coming-soon">
            <Ionicons name="diamond-outline" size={16} color={colors.onSurfaceTertiary} />
            <Text style={styles.comingSoonText}>Coming Soon: Premium</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: "100%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
  },
  icon: {
    width: 56, height: 56, borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: {
    color: colors.onSurface,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -0.3,
    textAlign: "center",
    lineHeight: 26,
  },
  subtitle: {
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  err: {
    color: colors.error,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  primaryBtn: {
    width: "100%",
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  primaryBtnText: {
    color: colors.onBrandPrimary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  secondaryBtn: {
    width: "100%",
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryBtnText: {
    color: colors.onSurface,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  comingSoonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  comingSoonText: {
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
});
