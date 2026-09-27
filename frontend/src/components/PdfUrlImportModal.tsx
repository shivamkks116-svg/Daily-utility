/**
 * Modal for importing a PDF from a URL. Emits progress while downloading
 * and pipes the resulting file to the parent's `onImported` callback.
 */
import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { importPdfFromUrl } from "@/src/utils/pdf/importFromUrl";
import type { PickedPdf } from "@/src/utils/pdf/helpers";

export function PdfUrlImportModal({
  visible,
  onClose,
  onImported,
}: {
  visible: boolean;
  onClose: () => void;
  onImported: (pdf: PickedPdf) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const reset = () => {
    setUrl("");
    setBusy(false);
    setProgress(0);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const importIt = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setProgress(0);
    try {
      const pdf = await importPdfFromUrl(url, (b, t) =>
        setProgress(t > 0 ? b / t : 0),
      );
      onImported(pdf);
      reset();
      onClose();
    } catch (e) {
      Alert.alert("Couldn't import", (e as Error)?.message || "Unknown error");
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="link" size={18} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Import PDF from URL</Text>
              <Text style={styles.subtitle}>Paste any public PDF link.</Text>
            </View>
            <Pressable onPress={close} disabled={busy} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.onSurfaceTertiary} />
            </Pressable>
          </View>

          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://example.com/report.pdf"
            placeholderTextColor={colors.onSurfaceTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!busy}
            returnKeyType="go"
            onSubmitEditing={importIt}
          />

          {busy ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(2, progress * 100)}%` }]} />
              </View>
              <View style={styles.progressRow}>
                <ActivityIndicator size="small" color={colors.brandPrimary} />
                <Text style={styles.progressText}>
                  Downloading… {Math.round(progress * 100)}%
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={close}
              disabled={busy}
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && { opacity: 0.7 },
                busy && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={importIt}
              disabled={busy || !url.trim()}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                (!url.trim() || busy) && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="download-outline" size={16} color={colors.onBrandPrimary} />
              <Text style={styles.btnPrimaryText}>Import PDF</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.onSurface,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  progressWrap: { gap: spacing.xs },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.brandPrimary },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  progressText: {
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.xs,
    fontVariant: ["tabular-nums"],
  },
  actionsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  btnPrimary: { backgroundColor: colors.brandPrimary },
  btnPrimaryText: {
    color: colors.onBrandPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  btnSecondary: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  btnSecondaryText: {
    color: colors.onSurface,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
