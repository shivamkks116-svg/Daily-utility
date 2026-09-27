/**
 * Catch-all fallback for any route Expo Router can't match.
 *
 * This exists specifically to gracefully handle Android VIEW/SEND intents
 * that carry a `content://<authority>/<path>` URI. `expo-linking` rewrites
 * such intents into `dailyhubai://<authority>/<path>`, which does not map
 * to any real screen. Our `useSharedIntentHandler` catches most of these
 * and redirects to the PDF Reader — but if the URI is malformed or times
 * out, this screen prevents the built-in "Unmatched Route" from showing.
 */
import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors } from "@/src/theme";

export default function NotFoundScreen() {
  useEffect(() => {
    // Give the shared-intent handler a beat to redirect first, then fall
    // back to the home screen.
    const t = setTimeout(() => {
      router.replace("/(main)/home");
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.brandPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
});
