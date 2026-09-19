import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

const HERO_BG =
  "https://images.unsplash.com/photo-1649861742672-20152f77c1f5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRhcmslMjBtb3NzJTIwZ3JlZW4lMjBlbWVyYWxkJTIwZ3JhZGllbnQlMjBiYWNrZ3JvdW5kJTIwYXRtb3NwaGVyaWN8ZW58MHx8fHwxNzg1NjU4MjEwfDA&ixlib=rb-4.1.0&q=85";

type EmailStep = "email" | "signin" | "signup" | "reset";

export default function LoginScreen() {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    fetchEmailSignInMethods,
    sendPasswordReset,
    signInAsGuest,
    firebaseNativeAvailable,
    humanizeFirebaseError,
  } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState<"google" | "guest" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<EmailStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [name, setName] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  function resetEmailModal() {
    setEmailStep("email");
    setEmail("");
    setPassword("");
    setPassword2("");
    setName("");
    setEmailErr(null);
    setEmailBusy(false);
  }

  function openEmailFlow() {
    resetEmailModal();
    setEmailOpen(true);
  }

  async function handleGoogle() {
    setError(null);
    if (!firebaseNativeAvailable) {
      setError(
        "Firebase native module unavailable. Rebuild the APK — ensure prebuild ran and google-services.json is present.",
      );
      return;
    }
    setLoading("google");
    try {
      await signInWithGoogle();
      router.replace("/(main)/home");
    } catch (e) {
      const err = e as { message?: string; code?: string };
      const codePart = err?.code ? ` (code: ${err.code})` : "";
      // Show the enriched Google/Firebase message + code, but never a token.
      setError(`${err?.message || humanizeFirebaseError(e)}${codePart}`);
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
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message || "Guest login failed");
    } finally {
      setLoading(null);
    }
  }

  /* ---------------------- Email flow handlers ---------------------- */

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  async function handleEmailContinue() {
    setEmailErr(null);
    if (!isValidEmail(email)) {
      setEmailErr("Please enter a valid email.");
      return;
    }
    if (!firebaseNativeAvailable) {
      setEmailErr("Email sign-in only works in the Android APK build.");
      return;
    }
    setEmailBusy(true);
    try {
      const methods = await fetchEmailSignInMethods(email);
      if (methods.length === 0) {
        setEmailStep("signup");
      } else if (methods.includes("password")) {
        setEmailStep("signin");
      } else {
        // Email exists but not password — likely Google-only
        setEmailErr(
          "This email is registered with Google. Tap 'Continue with Google' instead.",
        );
      }
    } catch (e) {
      setEmailErr(humanizeFirebaseError(e));
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleSignIn() {
    setEmailErr(null);
    if (password.length < 6) {
      setEmailErr("Password must be at least 6 characters.");
      return;
    }
    setEmailBusy(true);
    try {
      await signInWithEmail(email, password);
      setEmailOpen(false);
      router.replace("/(main)/home");
    } catch (e) {
      setEmailErr(humanizeFirebaseError(e));
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleSignUp() {
    setEmailErr(null);
    if (!name.trim()) {
      setEmailErr("Please enter your name.");
      return;
    }
    if (password.length < 6) {
      setEmailErr("Password must be at least 6 characters.");
      return;
    }
    if (password !== password2) {
      setEmailErr("Passwords do not match.");
      return;
    }
    setEmailBusy(true);
    try {
      await signUpWithEmail(email, password, name.trim());
      setEmailOpen(false);
      router.replace("/verify-email");
    } catch (e) {
      setEmailErr(humanizeFirebaseError(e));
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleResetSubmit() {
    setEmailErr(null);
    if (!isValidEmail(email)) {
      setEmailErr("Please enter a valid email.");
      return;
    }
    setEmailBusy(true);
    try {
      await sendPasswordReset(email);
      Alert.alert(
        "Reset email sent",
        `We sent a password reset link to ${email}. Check your inbox (and spam folder).`,
      );
      setEmailStep("signin");
    } catch (e) {
      setEmailErr(humanizeFirebaseError(e));
    } finally {
      setEmailBusy(false);
    }
  }

  /* ---------------------- Render ---------------------- */

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
            testID="login-email-button"
            onPress={openEmailFlow}
            disabled={loading !== null}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="mail-outline" size={18} color={colors.onSurface} />
            <Text style={styles.secondaryBtnText}>Continue with Email</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            testID="login-guest-button"
            onPress={handleGuest}
            disabled={loading !== null}
            style={({ pressed }) => [
              styles.ghostBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            {loading === "guest" ? (
              <ActivityIndicator color={colors.onSurfaceSecondary} />
            ) : (
              <>
                <Ionicons name="person-outline" size={18} color={colors.onSurfaceSecondary} />
                <Text style={styles.ghostBtnText}>Continue as Guest</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.terms}>
            By continuing you agree to our Terms & Privacy Policy.
          </Text>
        </View>
      </SafeAreaView>

      {/* Email modal */}
      <EmailModal
        visible={emailOpen}
        onClose={() => setEmailOpen(false)}
        step={emailStep}
        setStep={setEmailStep}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        password2={password2}
        setPassword2={setPassword2}
        name={name}
        setName={setName}
        busy={emailBusy}
        error={emailErr}
        onContinue={handleEmailContinue}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onResetSubmit={handleResetSubmit}
      />
    </View>
  );
}

/* --------------------------- Email Modal ---------------------------- */

type EmailModalProps = {
  visible: boolean;
  onClose: () => void;
  step: EmailStep;
  setStep: (s: EmailStep) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  password2: string;
  setPassword2: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  busy: boolean;
  error: string | null;
  onContinue: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onResetSubmit: () => void;
};

function EmailModal(p: EmailModalProps) {
  const title =
    p.step === "email" ? "Continue with Email"
    : p.step === "signin" ? "Welcome back"
    : p.step === "signup" ? "Create account"
    : "Reset password";

  const subtitle =
    p.step === "email" ? "We'll check if you have an account."
    : p.step === "signin" ? `Signing in as ${p.email}`
    : p.step === "signup" ? `New here? Let's set up ${p.email}`
    : "Enter your email and we'll send a reset link.";

  return (
    <Modal visible={p.visible} animationType="slide" transparent onRequestClose={p.onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{title}</Text>
                <Text style={styles.modalSubtitle}>{subtitle}</Text>
              </View>
              <Pressable onPress={p.onClose} style={styles.modalClose} testID="email-modal-close">
                <Ionicons name="close" size={20} color={colors.onSurface} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              keyboardShouldPersistTaps="handled"
            >
              {p.error ? <Text style={styles.formErr} testID="email-modal-error">{p.error}</Text> : null}

              {/* Email input (always shown, becomes read-only after continue) */}
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, p.step !== "email" && p.step !== "reset" && styles.inputReadonly]}
                  value={p.email}
                  onChangeText={p.setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder="you@example.com"
                  placeholderTextColor={colors.onSurfaceTertiary}
                  editable={p.step === "email" || p.step === "reset"}
                  testID="email-input"
                />
              </View>

              {/* Sign-Up: name + password + confirm */}
              {p.step === "signup" ? (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Your name</Text>
                    <TextInput
                      style={styles.input}
                      value={p.name}
                      onChangeText={p.setName}
                      placeholder="Full name"
                      placeholderTextColor={colors.onSurfaceTertiary}
                      autoCapitalize="words"
                      testID="signup-name"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                      style={styles.input}
                      value={p.password}
                      onChangeText={p.setPassword}
                      placeholder="At least 6 characters"
                      placeholderTextColor={colors.onSurfaceTertiary}
                      secureTextEntry
                      testID="signup-password"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Confirm password</Text>
                    <TextInput
                      style={styles.input}
                      value={p.password2}
                      onChangeText={p.setPassword2}
                      placeholder="Re-enter password"
                      placeholderTextColor={colors.onSurfaceTertiary}
                      secureTextEntry
                      testID="signup-password2"
                    />
                  </View>
                </>
              ) : null}

              {/* Sign-In: password + forgot */}
              {p.step === "signin" ? (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                      style={styles.input}
                      value={p.password}
                      onChangeText={p.setPassword}
                      placeholder="Your password"
                      placeholderTextColor={colors.onSurfaceTertiary}
                      secureTextEntry
                      testID="signin-password"
                    />
                  </View>
                  <Pressable onPress={() => p.setStep("reset")} style={{ paddingVertical: spacing.xs }}>
                    <Text style={styles.forgot}>Forgot password?</Text>
                  </Pressable>
                </>
              ) : null}

              {/* Primary CTA */}
              <Pressable
                onPress={
                  p.step === "email" ? p.onContinue
                  : p.step === "signin" ? p.onSignIn
                  : p.step === "signup" ? p.onSignUp
                  : p.onResetSubmit
                }
                disabled={p.busy}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { marginTop: spacing.md },
                  pressed && { opacity: 0.9 },
                  p.busy && { opacity: 0.7 },
                ]}
                testID="email-modal-submit"
              >
                {p.busy ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {p.step === "email" ? "Continue"
                    : p.step === "signin" ? "Sign In"
                    : p.step === "signup" ? "Create Account"
                    : "Send Reset Link"}
                  </Text>
                )}
              </Pressable>

              {p.step === "reset" ? (
                <Pressable onPress={() => p.setStep("signin")} style={{ marginTop: spacing.md, alignItems: "center" }}>
                  <Text style={styles.linkText}>Back to sign in</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ------------------------------- Styles ----------------------------- */

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
  brand: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, letterSpacing: -0.3 },
  byline: { color: colors.onSurfaceTertiary, marginTop: spacing.xs, fontSize: fontSize.sm },
  middle: { flex: 1, justifyContent: "flex-end", paddingBottom: spacing.xl },
  h1: { color: colors.onSurface, fontSize: 40, fontWeight: fontWeight.extrabold, letterSpacing: -1, lineHeight: 46 },
  sub: { color: colors.onSurfaceSecondary, marginTop: spacing.md, fontSize: fontSize.lg, lineHeight: 24 },
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
  primaryBtnText: { color: colors.onBrandPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
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
  secondaryBtnText: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.xs },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderStrong, opacity: 0.6 },
  dividerText: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, letterSpacing: 1 },
  ghostBtn: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    borderRadius: radius.pill,
  },
  ghostBtnText: { color: colors.onSurfaceSecondary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  terms: { color: colors.onSurfaceTertiary, textAlign: "center", fontSize: fontSize.xs, marginTop: spacing.sm },
  error: { color: colors.error, fontSize: fontSize.sm, textAlign: "center", marginBottom: spacing.sm },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    maxHeight: "88%",
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  modalHead: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.md },
  modalTitle: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
  modalSubtitle: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 4 },
  modalClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  field: { marginTop: spacing.md },
  label: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, marginBottom: 6, fontWeight: fontWeight.semibold },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.onSurface,
    fontSize: fontSize.md,
  },
  inputReadonly: { color: colors.onSurfaceTertiary },
  forgot: { color: colors.brandPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: "right", marginTop: 4 },
  formErr: {
    color: colors.error, fontSize: fontSize.sm,
    backgroundColor: "rgba(255,180,171,0.08)",
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,180,171,0.25)",
  },
  linkText: { color: colors.brandPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
