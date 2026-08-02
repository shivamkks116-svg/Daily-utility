import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

const HERO_BG =
  "https://images.unsplash.com/photo-1649861742672-20152f77c1f5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRhcmslMjBtb3NzJTIwZ3JlZW4lMjBlbWVyYWxkJTIwZ3JhZGllbnQlMjBiYWNrZ3JvdW5kJTIwYXRtb3NwaGVyaWN8ZW58MHx8fHwxNzg1NjU4MjEwfDA&ixlib=rb-4.1.0&q=85";

export default function LoginScreen() {
  const { signInWithGoogle, signInAsGuest } = useAuth();
  const [loading, setLoading] = useState<"google" | "guest" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleGoogle() {
    setError(null);
    setLoading("google");
    try {
      await signInWithGoogle();
      router.replace("/(main)/home");
    } catch (e: any) {
      setError(e?.message || "Google sign-in failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleGuest() {
    setError(null);
    setLoading("guest");
    try {
      await signInAsGuest();
      router.replace("/(main)/home");
    } catch (e: any) {
      setError(e?.message || "Guest login failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={styles.root} testID="login-screen">
      <Image source={{ uri: HERO_BG }} style={styles.heroBg} blurRadius={0} />
      <LinearGradient
        colors={["rgba(17,20,18,0.2)", "rgba(17,20,18,0.75)", colors.surface]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.top}>
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Ionicons name="sparkles" size={22} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.brand}>DailyHub AI</Text>
          </View>
          <Text style={styles.byline}>by Shivam Innovation</Text>
        </View>

        <View style={styles.middle}>
          <Text style={styles.h1}>Your all-in-one{"\n"}daily hub.</Text>
          <Text style={styles.sub}>
            Notes, habits, focus timers, and AI tools — beautifully unified in one calm space.
          </Text>
        </View>

        <View style={styles.bottom}>
          {error ? (
            <Text style={styles.error} testID="login-error">
              {error}
            </Text>
          ) : null}

          <Pressable
            testID="login-google-button"
            onPress={handleGoogle}
            disabled={loading !== null}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9 },
              loading === "google" && { opacity: 0.7 },
            ]}
          >
            {loading === "google" ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.primaryBtnText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          <Pressable
            testID="login-guest-button"
            onPress={handleGuest}
            disabled={loading !== null}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            {loading === "guest" ? (
              <ActivityIndicator color={colors.onSurface} />
            ) : (
              <>
                <Ionicons name="person-outline" size={18} color={colors.onSurface} />
                <Text style={styles.secondaryBtnText}>Continue as Guest</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.terms}>
            By continuing you agree to our Terms & Privacy Policy.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  heroBg: { ...StyleSheet.absoluteFillObject, resizeMode: "cover", opacity: 0.9 },
  safe: { flex: 1, paddingHorizontal: spacing.xl },
  top: { paddingTop: spacing.md },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  logoBox: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  brand: {
    color: colors.onSurface,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -0.3,
  },
  byline: {
    color: colors.onSurfaceTertiary,
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
  },
  middle: { flex: 1, justifyContent: "flex-end", paddingBottom: spacing.xl },
  h1: {
    color: colors.onSurface,
    fontSize: 40,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -1,
    lineHeight: 46,
  },
  sub: {
    color: colors.onSurfaceSecondary,
    marginTop: spacing.md,
    fontSize: fontSize.lg,
    lineHeight: 24,
  },
  bottom: { paddingBottom: spacing.lg, gap: spacing.md },
  primaryBtn: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  primaryBtnText: {
    color: colors.onBrandPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  secondaryBtn: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  secondaryBtnText: {
    color: colors.onSurface,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  terms: {
    color: colors.onSurfaceTertiary,
    textAlign: "center",
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.error,
    fontSize: fontSize.sm,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
});
