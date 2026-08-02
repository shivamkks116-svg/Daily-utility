import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { colors, fontSize, fontWeight, spacing } from "@/src/theme";

export default function GateScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/(main)/home");
    else router.replace("/login");
  }, [user, loading, router]);

  return (
    <View style={styles.container} testID="app-gate">
      <Text style={styles.brand}>DailyHub AI</Text>
      <ActivityIndicator size="large" color={colors.brandPrimary} style={{ marginTop: spacing.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: colors.brandPrimary,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -0.5,
  },
});
