/**
 * Web stub for `PdfViewer` — `react-native-pdf` cannot bundle for Metro's
 * web target (it depends on `react-native-blob-util` native code). We render
 * a friendly placeholder so the Metro bundler keeps working.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, fontWeight, spacing } from "@/src/theme";
import type { PdfViewerProps } from "./index.d";

export const PdfViewer: React.FC<PdfViewerProps> = ({ style }) => (
  <View style={[styles.wrap, style]}>
    <Ionicons name="document-text-outline" size={44} color={colors.brandPrimary} />
    <Text style={styles.title}>Native PDF viewer</Text>
    <Text style={styles.sub}>
      Available on the Android / iOS build only. Install the APK to preview PDFs
      instantly.
    </Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  title: {
    color: colors.onSurface,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  sub: {
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.sm,
    textAlign: "center",
    maxWidth: 280,
  },
});
