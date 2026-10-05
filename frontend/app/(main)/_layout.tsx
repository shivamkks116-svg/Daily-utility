import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activeThemeName, colors, fontSize, fontWeight, spacing } from "@/src/theme";

/**
 * Theme-aware tab bar background.
 *   • iOS → native BlurView whose `tint` matches the active theme.
 *   • Android/Web → opaque surface pulled from the theme palette so a
 *     light-mode user sees a light tab bar instead of the dark Moss
 *     tone we used to hardcode.
 */
function TabBarBg() {
  const tint = activeThemeName === "light" ? "light" : "dark";
  if (Platform.OS === "ios") {
    return <BlurView intensity={40} tint={tint} style={StyleSheet.absoluteFill} />;
  }
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSecondary }]}
    />
  );
}

export default function MainTabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarBackground: () => <TabBarBg />,
        tabBarStyle: {
          position: "absolute",
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          backgroundColor: "transparent",
          elevation: 0,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + spacing.xs,
          paddingTop: spacing.sm,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "Tools",
          tabBarIcon: ({ color, size }) => <Ionicons name="apps" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI",
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
