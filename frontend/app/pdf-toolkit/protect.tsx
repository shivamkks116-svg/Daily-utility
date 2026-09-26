import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickPdfs, sharePdf, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { protectPdf, unlockPdf } from "@/src/utils/pdf";
import { addRecent } from "@/src/utils/toolkit/recents";

/** Password Protect + Unlock PDF — single screen with a mode toggle. */
export default function ProtectPdfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"protect" | "unlock">("protect");
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultUri, setResultUri] = useState<string | null>(null);

  const pick = async () => {
    try {
      const [picked] = await pickPdfs({ multiple: false });
      if (!picked) return;
      setFile(picked);
      setResultUri(null);
    } catch (e: unknown) {
      Alert.alert("Pick failed", (e as Error)?.message || String(e));
    }
  };

  const run = async () => {
    if (!file) return;
    if (!password) { Alert.alert("Password required"); return; }
    if (mode === "protect" && password !== confirm) { Alert.alert("Passwords don't match"); return; }
    setBusy(true);
    try {
      const uri = mode === "protect"
        ? await protectPdf(file.uri, password)
        : await unlockPdf(file.uri, password);
      setResultUri(uri);
      const label = mode === "protect" ? "Password Protect" : "Unlock";
      const stem = file.name.replace(/\.pdf$/i, "");
      const suffix = mode === "protect" ? "locked" : "unlocked";
      await addRecent({ kind: "pdf", uri, name: `${stem}-${suffix}.pdf`, tool: label });
      setPassword("");
      setConfirm("");
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      const msg = err?.status === 401 ? "Incorrect password. Try again." : (err?.message || String(e));
      Alert.alert(mode === "protect" ? "Protect failed" : "Unlock failed", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader
        title={mode === "protect" ? "Password Protect" : "Unlock PDF"}
        subtitle={mode === "protect" ? "AES-256 encryption applied server-side" : "Remove password from a protected PDF"}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        {/* Mode toggle */}
        <View style={styles.segRow}>
          {(["protect", "unlock"] as const).map((m) => (
            <Pressable key={m} onPress={() => { setMode(m); setResultUri(null); setPassword(""); setConfirm(""); }} style={[styles.seg, mode === m && styles.segOn]}>
              <Ionicons name={m === "protect" ? "lock-closed" : "lock-open"} size={14} color={mode === m ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
              <Text style={[styles.segText, mode === m && styles.segTextOn]}>{m === "protect" ? "Protect" : "Unlock"}</Text>
            </Pressable>
          ))}
        </View>

        {!file ? (
          <EmptyState icon={mode === "protect" ? "lock-closed-outline" : "lock-open-outline"} title="Pick a PDF" subtitle={mode === "protect" ? "Choose a PDF to encrypt with a password" : "Choose a password-protected PDF to unlock"}
            action={<PrimaryButton icon="folder-open" label="Choose PDF" onPress={pick} />} />
        ) : (
          <>
            <View style={styles.card}>
              <Ionicons name="document" size={22} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.meta}>{humanBytes(file.size)}</Text>
              </View>
              <Pressable onPress={pick}><Ionicons name="swap-horizontal" size={20} color={colors.onSurfaceTertiary} /></Pressable>
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={mode === "protect" ? "Choose a strong password" : "Enter existing password"}
                placeholderTextColor={colors.onSurfaceTertiary}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable onPress={() => setShowPw((v) => !v)} style={styles.eye}>
                <Ionicons name={showPw ? "eye-off" : "eye"} size={18} color={colors.onSurfaceTertiary} />
              </Pressable>
            </View>

            {mode === "protect" ? (
              <>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.onSurfaceTertiary}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            ) : null}

            {busy ? <ProgressBanner label={mode === "protect" ? "Encrypting…" : "Unlocking…"} /> : null}

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              {resultUri ? (
                <SecondaryButton icon="share-outline" label={mode === "protect" ? "Share protected PDF" : "Share unlocked PDF"} onPress={() => sharePdf(resultUri)} />
              ) : null}
              <PrimaryButton icon={mode === "protect" ? "lock-closed" : "lock-open"} label={mode === "protect" ? "Protect PDF" : "Unlock PDF"} onPress={run} disabled={busy || !password} />
            </View>
          </>
        )}
      </ScrollView>
      {busy ? <View style={styles.overlay}><ActivityIndicator size="large" color={colors.brandPrimary} /></View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  segRow: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  seg: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: radius.pill },
  segOn: { backgroundColor: colors.brandPrimary },
  segText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  segTextOn: { color: colors.onBrandPrimary },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  name: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  label: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: spacing.lg, marginBottom: 6 },
  inputRow: { position: "relative" },
  input: {
    backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 14, color: colors.onSurface, fontSize: fontSize.md,
  },
  eye: { position: "absolute", right: spacing.md, top: 14, padding: 4 },
  overlay: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.15)" },
});
