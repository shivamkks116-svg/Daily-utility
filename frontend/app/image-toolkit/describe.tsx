import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Image, Modal } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickSingleImage, type PickedImg } from "@/src/utils/image/helpers";
import { readImageBase64 } from "@/src/utils/image";
import { api } from "@/src/api/client";

export default function ImageDescribeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [img, setImg] = useState<PickedImg | null>(null);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [askConsent, setAskConsent] = useState(false);
  const [consented, setConsented] = useState(false);

  const pick = async () => {
    const p = await pickSingleImage();
    if (p) { setImg(p); setDesc(""); setStatus(""); }
  };

  const run = async () => {
    if (!img) return;
    if (!consented) { setAskConsent(true); return; }
    setBusy(true); setStatus("Describing image..."); setDesc("");
    try {
      const b64 = await readImageBase64(img.uri);
      const r = await api<{ description: string }>("/image/describe", { method: "POST", body: { image_base64: b64, mime: "image/jpeg" } });
      setDesc(r.description || "");
      setStatus("Done");
    } catch (e: any) {
      Alert.alert("Describe failed", e?.message || "Unknown error");
      setStatus("");
    } finally { setBusy(false); }
  };

  const copy = async () => {
    if (!desc) return;
    await Clipboard.setStringAsync(desc);
    Alert.alert("Copied", "Description copied to clipboard.");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Describe Image" subtitle={img?.name || "Pick an image"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {status ? <ProgressBanner label={status} done={!busy && !!desc} /> : null}
        {!img ? (
          <EmptyState icon="sparkles-outline" title="AI describes your image" subtitle="Great for alt-text, tagging & accessibility." actionLabel="Pick image" onAction={pick} />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <Image source={{ uri: img.uri }} style={styles.preview} resizeMode="contain" />
            {desc ? (
              <View style={styles.output}>
                <Text style={styles.outputText}>{desc}</Text>
                <SecondaryButton icon="copy" label="Copy description" onPress={copy} style={{ marginTop: spacing.md }} />
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
      {img ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <PrimaryButton icon="sparkles" label={busy ? "Working..." : desc ? "Re-run" : "Describe"} onPress={run} loading={busy} />
        </View>
      ) : null}

      <Modal visible={askConsent} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Ionicons name="shield-checkmark" size={30} color={colors.brandPrimary} />
            <Text style={styles.modalTitle}>AI processing consent</Text>
            <Text style={styles.modalBody}>Your image will be sent to Gemini via the Emergent LLM Gateway. Nothing is stored permanently.</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <SecondaryButton label="Cancel" onPress={() => setAskConsent(false)} style={{ flex: 1 }} />
              <PrimaryButton label="I understand" onPress={() => { setConsented(true); setAskConsent(false); setTimeout(run, 100); }} style={{ flex: 1 } as any} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  preview: { width: "100%", height: 240, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  output: { marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  outputText: { color: colors.onSurface, fontSize: fontSize.md, lineHeight: 22 },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.xl, padding: spacing.xl, width: "100%", maxWidth: 420 },
  modalTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: spacing.md, marginBottom: spacing.sm },
  modalBody: { color: colors.onSurfaceSecondary, fontSize: fontSize.md, lineHeight: 22 },
});
