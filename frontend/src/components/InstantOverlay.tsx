/**
 * Full-screen "working" overlay for perceived-instant transitions.
 *
 * Many tools in DailyHub AI legitimately need a server round-trip (Word →
 * PDF, OCR, compress, …). Rather than freezing the current screen while
 * the request runs, we immediately navigate to a destination screen that
 * mounts this overlay with a title + optional progress message. The user
 * sees the app responding instantly even though the backend is still
 * crunching numbers in the background.
 *
 * Usage:
 *   <InstantOverlay
 *     visible={busy}
 *     title="Converting to PDF"
 *     subtitle="Preparing your document…"
 *   />
 */

import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, Modal } from "react-native";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

export function InstantOverlay({
  visible,
  title,
  subtitle,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Prevent Android back button from dismissing while work is in flight.
      onRequestClose={() => {}}
    >
      <View style={styles.scrim}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  card: {
    minWidth: 260,
    maxWidth: 360,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    alignItems: "center",
    gap: spacing.sm,
    // Subtle elevation on Android, shadow on iOS.
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  title: {
    color: colors.onSurface,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  sub: {
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
});
