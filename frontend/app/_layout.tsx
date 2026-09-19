import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "@/src/utils/keyboard";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/contexts/AuthContext";
import { AppLockGate } from "@/src/components/AppLockGate";
import { colors } from "@/src/theme";
import { initializeRevenueCat, SubscriptionProvider } from "@/src/subscription/RevenueCat";
import { AdStartup } from "@/src/ads/native";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

// Module-scope RevenueCat init — MUST run once per app launch BEFORE any component mounts.
try { initializeRevenueCat(); } catch (e) { console.warn("[RC] init failed:", e); }

function InnerLayout() {
  const { user } = useAuth();
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
          <StatusBar barStyle="light-content" backgroundColor={colors.surface} />
          <AuthProvider>
            <InnerLayout />
          </AuthProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
