import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform, StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "@/src/utils/keyboard";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/contexts/AuthContext";
import { AppLockGate } from "@/src/components/AppLockGate";
import { activeThemeName, colors } from "@/src/theme";
import { initializeRevenueCat, SubscriptionProvider } from "@/src/subscription/RevenueCat";
import { AdStartup } from "@/src/ads/native";
import { useSharedIntentHandler } from "@/src/utils/pdf/sharedIntent";
import { FeatureFlagsProvider } from "@/src/features/flags";
import { bootstrapTheme } from "@/src/theme/apply";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

// Kick off the theme bootstrap before the first render so a saved
// "light" preference flips the native color scheme + reloads the JS
// bundle exactly once. Fire-and-forget — the reload (if needed) will
// restart the whole runtime anyway.
bootstrapTheme();

// Module-scope RevenueCat init — MUST run once per app launch BEFORE any component mounts.
try { initializeRevenueCat(); } catch (e) { console.warn("[RC] init failed:", e); }

function InnerLayout() {
  const { user } = useAuth();
  useSharedIntentHandler();

  // Keep Android home-screen widgets in sync with the user's recents
  // store. Fires once per app launch and whenever the user ID flips
  // (sign-in / sign-out) so a fresh account doesn't show the previous
  // user's documents in their widget.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    (async () => {
      try {
        const { syncWidgetRecents } = await import("@/src/widgets/sync");
        await syncWidgetRecents();
      } catch {}
    })();
  }, [user?.user_id]);

  return (
    <SubscriptionProvider userId={user?.user_id}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <AdStartup />
        <AppLockGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.surface },
              animation: "slide_from_right",
            }}
          />
        </AppLockGate>
      </View>
    </SubscriptionProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <StatusBar
            barStyle={activeThemeName === "light" ? "dark-content" : "light-content"}
            backgroundColor={colors.surface}
          />
          <AuthProvider>
            <FeatureFlagsProvider>
              <InnerLayout />
            </FeatureFlagsProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
