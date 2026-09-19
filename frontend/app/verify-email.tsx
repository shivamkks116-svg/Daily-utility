import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/src/contexts/AuthContext";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

/**
 * Verify-email screen — shown right after a fresh signup. Firebase auto-sends
 * a verification email. User taps the link in their inbox, comes back to the
 * app, taps "I've verified", which reloads Firebase user and re-syncs backend.
 */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const {
    user,
    refreshEmailVerification,
    resendEmailVerification,
    signOut,
    humanizeFirebaseError,
  } = useAuth();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // If already verified, skip to home
  useEffect(() => {
    if (user?.email_verified) router.replace("/(main)/home");
  }, [user, router]);

  async function handleCheck() {
    setError(null);
    setChecking(true);
    try {
      const ok = await refreshEmailVerification();
      if (ok) {
        router.replace("/(main)/home");
      } else {
        setError("Not verified yet. Click the link in your email, then try again.");
      }
    } catch (e) {
      setError(humanizeFirebaseError(e));
    } finally {
      setChecking(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    setResending(true);
    try {
      await resendEmailVerification();
      Alert.alert("Sent", "A new verification email is on its way.");
      setCooldown(60);
    } catch (e) {
      setError(humanizeFirebaseError(e));
    } finally {
      setResending(false);
    }
  }

  async function handleUseDifferent() {
    Alert.alert(
      "Sign out?",
      "You'll be taken back to the login screen.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: async () => { await signOut(); router.replace("/login"); } },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.brandTertiary, colors.surface]}
        style={styles.hero}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <Ionicons name="mail-unread-outline" size={44} color={colors.brandPrimary} />
          </View>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.body}>
            We&apos;ve sent a verification link to
          </Text>
          <Text style={styles.email}>{user?.email || "your inbox"}</Text>
          <Text style={styles.hint}>
            Tap the link in that email, then come back here and press{" "}
            <Text style={styles.hintStrong}>I&apos;ve verified</Text>.
          </Text>

          {error ? <Text style={styles.err}>{error}</Text> : null}

          <Pressable
            onPress={handleCheck}
            disabled={checking}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }, checking && { opacity: 0.7 }]}
            testID="verify-email-check"
          >
            {checking ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.primaryBtnText}>I&apos;ve verified</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handleResend}
            disabled={resending || cooldown > 0}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }, (resending || cooldown > 0) && { opacity: 0.6 }]}
            testID="verify-email-resend"
          >
            {resending ? (
              <ActivityIndicator color={colors.onSurface} />
            ) : (
              <Text style={styles.secondaryBtnText}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={handleUseDifferent} style={{ marginTop: spacing.md, alignItems: "center" }}>
            <Text style={styles.link}>Use a different email</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { position: "absolute", top: 0, left: 0, right: 0, height: 300 },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  card: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  iconBadge: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1, borderColor: colors.brandSecondary,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: fontWeight.extrabold, textAlign: "center" },
  body: { color: colors.onSurfaceSecondary, fontSize: fontSize.md, textAlign: "center" },
  email: { color: colors.brandPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold, textAlign: "center" },
  hint: {
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 20,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  hintStrong: { color: colors.onSurface, fontWeight: fontWeight.semibold },
  err: {
    color: colors.error, fontSize: fontSize.sm, textAlign: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  primaryBtn: {
    marginTop: spacing.lg,
    width: "100%",
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: spacing.sm,
  },
  primaryBtnText: { color: colors.onBrandPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  secondaryBtn: {
    marginTop: spacing.sm,
    width: "100%",
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.borderStrong,
    alignItems: "center", justifyContent: "center",
  },
  secondaryBtnText: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  link: { color: colors.brandPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textDecorationLine: "underline" },
});
