import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, EmptyState } from "@/src/components/toolkit/Primitives";
import { pickSingleImage, shareImage, trackImageResult, type PickedImg } from "@/src/utils/image/helpers";
import { rotateImage, flipImage, getSize } from "@/src/utils/image";

export default function RotateFlipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [img, setImg] = useState<PickedImg | null>(null);
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const p = await pickSingleImage();
    if (p) { setImg(p); setCurrentUri(p.uri); }
  };

  const apply = async (op: "rot90" | "rot180" | "rot-90" | "flipH" | "flipV") => {
    if (!currentUri) return;
    setBusy(true);
    try {
      let outUri = currentUri;
      if (op === "rot90") outUri = await rotateImage(currentUri, 90);
      else if (op === "rot-90") outUri = await rotateImage(currentUri, -90);
      else if (op === "rot180") outUri = await rotateImage(currentUri, 180);
      else if (op === "flipH") outUri = await flipImage(currentUri, "horizontal");
      else if (op === "flipV") outUri = await flipImage(currentUri, "vertical");
      setCurrentUri(outUri);
    } catch (e: any) {
      Alert.alert("Operation failed", e?.message || "Unknown error");
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!currentUri || !img) return;
    try {
      const size = await getSize(currentUri);
      await trackImageResult(currentUri, `Edited.jpg`, `Rotate/Flip`, size);
      await shareImage(currentUri);
    } catch (e: any) { Alert.alert("Save failed", e?.message || "Unknown error"); }
  };

  const actions: { key: any; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { key: "rot-90", icon: "arrow-undo", label: "Rotate 90° L" },
    { key: "rot90", icon: "arrow-redo", label: "Rotate 90° R" },
    { key: "rot180", icon: "sync", label: "Rotate 180°" },
    { key: "flipH", icon: "swap-horizontal", label: "Flip H" },
    { key: "flipV", icon: "swap-vertical", label: "Flip V" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Rotate & Flip" subtitle={img?.name || "Pick an image"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {!img ? (
          <EmptyState icon="sync-outline" title="Rotate & Flip" subtitle="Non-destructive — every change creates a new file." actionLabel="Pick image" onAction={pick} />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <Image source={{ uri: currentUri || img.uri }} style={styles.preview} resizeMode="contain" />
            <View style={styles.grid}>
              {actions.map(a => (
                <Pressable key={a.key} onPress={() => apply(a.key)} disabled={busy} style={styles.action}>
                  <Ionicons name={a.icon} size={20} color={colors.brandPrimary} />
                  <Text style={styles.actionText}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
      {img ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <PrimaryButton icon="share-outline" label="Share / Save" onPress={save} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  preview: { width: "100%", height: 320, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  action: { flexBasis: "31%", flexGrow: 1, alignItems: "center", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, gap: 6 },
  actionText: { color: colors.onSurface, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textAlign: "center" },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
