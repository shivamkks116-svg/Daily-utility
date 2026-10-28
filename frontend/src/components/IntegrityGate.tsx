/**
 * Full-screen block shown when Play Integrity says the app is modded /
 * re-signed / not installed from Google Play.
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { attestIntegrity, isIntegrityFailed, onIntegrityFailed } from "@/src/security/integrity";

const PLAY_URL = "market://details?id=com.dailyutility.app";
const PLAY_WEB = "https://play.google.com/store/apps/details?id=com.dailyutility.app";

export function IntegrityGate({ userId }: { userId?: string }) {
  const [blocked, setBlocked] = useState(isIntegrityFailed());

  useEffect(() => {
    const off = onIntegrityFailed(() => setBlocked(true));
    return () => { off(); };
  }, []);

  useEffect(() => {
    if (userId) void attestIntegrity();
  }, [userId]);

  if (!blocked) return null;
  return (
    <View style={styles.root} testID="integrity-block">
      <View style={styles.icon}>
        <Ionicons name="shield-outline" size={36} color={colors.onBrandPrimary} />
      </View>
      <Text style={styles.title}>This app is not genuine</Text>
      <Text style={styles.sub}>
        This copy of DailyHub was modified or not installed from Google Play. For your safety, please
        install the official app from the Play Store.
      </Text>
      <Pressable
        testID="integrity-open-play"
        onPress={() => Linking.openURL(PLAY_URL).catch(() => Linking.openURL(PLAY_WEB))}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="logo-google-playstore" size={20} color={colors.onBrandPrimary} />
        <Text style={styles.btnText}>Open Play Store</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject, zIndex: 9999, elevation: 9999, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl,
  },
  icon: {
    width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.error,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  title: { color: colors.onSurface, fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, textAlign: "center" },
  sub: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 22 },
  btn: {
    width: "100%", height: 52, borderRadius: radius.pill, backgroundColor: colors.brandPrimary,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
  },
  btnText: { color: colors.onBrandPrimary, fontSize: fontSize.base, fontWeight: fontWeight.bold },
});
