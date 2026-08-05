import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }
  const isGuest = !user || user?.is_guest;
  const nameEmoji = isGuest ? "🌱" : "👋";
  const displayName = user?.name || "Guest";
  const avatarChar = user?.name ? user.name.charAt(0).toUpperCase() : nameEmoji;

  async function handleLogout() {
    try {
      await signOut();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="profile-screen">
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: spacing.xl }}>
        <Text style={styles.title}>Profile</Text>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: 96 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.userCard} testID="profile-user-card">
          <View style={styles.avatar}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{avatarChar}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{nameEmoji}  {displayName}</Text>
            <Text style={styles.userEmail}>{isGuest ? "Guest account" : user?.email}</Text>
          </View>
          <View style={styles.providerBadge}>
            <Ionicons
              name={user?.provider === "google" ? "logo-google" : "person-outline"}
              size={12}
              color={colors.onBrandTertiary}
            />
            <Text style={styles.providerText}>{user?.provider === "google" ? "Google" : "Guest"}</Text>
          </View>
        </View>

        <View style={styles.premiumCard} testID="premium-card">
          <View style={styles.premiumIcon}>
            <Ionicons name="diamond" size={24} color={colors.onBrandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumTitle}>Go Premium</Text>
            <Text style={styles.premiumDesc}>
              No ads, unlimited AI, cloud backup and advanced themes.
            </Text>
          </View>
          <Pressable
            testID="premium-upgrade-btn"
            onPress={() => router.push("/premium")}
            style={styles.premiumBtn}
          >
            <Text style={styles.premiumBtnText}>Upgrade</Text>
          </Pressable>
        </View>

        <Section title="Preferences">
          <Row icon="moon" label="Theme" value="Dark (Material You)" testID="row-theme" />
          <Row icon="notifications-outline" label="Notifications" value="Enabled" testID="row-notif" />
          <Row icon="language" label="Language" value="English" testID="row-language" />
          <Row icon="lock-closed-outline" label="App Lock" value="Off" testID="row-app-lock" />
        </Section>

        <Section title="Sync & Storage">
          <Row icon="cloud-upload-outline" label="Backup Status" value={user?.is_guest ? "Local only" : "Auto (Cloud)"} testID="row-backup" />
          <Row icon="server-outline" label="Storage Usage" value="< 1 MB" testID="row-storage" />
          <Row icon="refresh-outline" label="Restore Purchases" testID="row-restore" onPress={() => showToast("Restore: no active purchases found.")} />
        </Section>

        <Section title="Community">
          <Row icon="star-outline" label="Rate DailyHub AI" testID="row-rate" onPress={() => showToast("Thanks! Rating opens on Play Store after publish.")} />
          <Row icon="share-social-outline" label="Share App" testID="row-share" onPress={() => showToast("Share sheet opens on device — coming to preview soon.")} />
          <Row icon="chatbubble-ellipses-outline" label="Send Feedback" testID="row-feedback" onPress={() => showToast("Feedback: feedback@shivaminnovation.dev")} />
          <Row icon="help-circle-outline" label="Help Center" testID="row-help" onPress={() => showToast("Help Center: opens in-app soon.")} />
          <Row icon="mail-outline" label="Contact Support" testID="row-support" onPress={() => showToast("Support: support@shivaminnovation.dev")} />
        </Section>

        <Section title="Data & Privacy">
          <Row icon="shield-checkmark-outline" label="Privacy Policy" testID="row-privacy" />
          <Row icon="document-text-outline" label="Terms & Conditions" testID="row-terms" />
        </Section>

        <Section title="About">
          <Row icon="information-circle-outline" label="Version" value="1.0.0" testID="row-version" />
          <Row icon="business-outline" label="Developer" value="Shivam Innovation" testID="row-developer" />
        </Section>

        <Pressable
          testID="logout-button"
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
      {toast ? (
        <View style={styles.toast} testID="profile-toast" pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  testID,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  testID: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.row} testID={testID}>
      <Ionicons name={icon} size={18} color={colors.onSurfaceSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />
    </View>
  );
  if (onPress) return <Pressable onPress={onPress} android_ripple={{ color: colors.borderStrong }}>{content}</Pressable>;
  return content;
}

const styles = StyleSheet.create({
  title: {
    color: colors.onSurface,
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -1,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  userCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.brandSecondary,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImg: { width: 56, height: 56 },
  avatarText: { color: colors.onBrandSecondary, fontWeight: fontWeight.bold, fontSize: fontSize.xl },
  userName: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  userEmail: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  providerBadge: {
    flexDirection: "row", gap: 4, alignItems: "center",
    backgroundColor: colors.brandTertiary,
    height: 26, paddingHorizontal: spacing.sm, borderRadius: radius.pill,
  },
  providerText: {
    color: colors.onBrandTertiary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  premiumCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    marginTop: spacing.md,
  },
  premiumIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  premiumTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  premiumDesc: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 2, lineHeight: 18 },
  premiumBtn: {
    backgroundColor: colors.brandPrimary,
    height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  premiumBtnText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  section: { marginTop: spacing.xl },
  sectionTitle: {
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  sectionCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.lg,
    height: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowLabel: { flex: 1, color: colors.onSurface, fontSize: fontSize.base },
  rowValue: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  logoutBtn: {
    marginTop: spacing.xl,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    height: 50,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutText: { color: colors.error, fontSize: fontSize.base, fontWeight: fontWeight.bold },
  toast: {
    position: "absolute",
    bottom: 120,
    left: spacing.xl,
    right: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
  },
  toastText: { color: colors.onBrandTertiary, fontWeight: fontWeight.semibold },
});
