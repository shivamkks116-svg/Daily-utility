import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Modal,
  Switch,
  Share,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import {
  ThemeMode,
  LanguageCode,
  LANGUAGE_LABELS,
  THEME_LABELS,
  getAppLock,
  getLanguage,
  getNotifications,
  getTheme,
  setAppLock,
  setLanguage,
  setNotifications,
  setTheme,
  getEstimatedStorageBytes,
  formatBytes,
} from "@/src/utils/settings";

const APP_PACKAGE = "com.dailyutility.app";
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
const SUPPORT_EMAIL = "support@shivaminnovation.dev";
const FEEDBACK_EMAIL = "feedback@shivaminnovation.dev";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [toast, setToast] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [lang, setLang] = useState<LanguageCode>("en");
  const [notifOn, setNotifOn] = useState<boolean>(true);
  const [appLockOn, setAppLockOn] = useState<boolean>(false);
  const [storageStr, setStorageStr] = useState<string>("…");

  const [themeModal, setThemeModal] = useState(false);
  const [langModal, setLangModal] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  const loadPrefs = useCallback(async () => {
    const [t, l, n, a, b] = await Promise.all([
      getTheme(),
      getLanguage(),
      getNotifications(),
      getAppLock(),
      getEstimatedStorageBytes(),
    ]);
    setThemeMode(t);
    setLang(l);
    setNotifOn(n);
    setAppLockOn(a);
    setStorageStr(formatBytes(b));
  }, []);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  useFocusEffect(useCallback(() => {
    loadPrefs();
  }, [loadPrefs]));

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

  async function chooseTheme(v: ThemeMode) {
    setThemeMode(v);
    await setTheme(v);
    setThemeModal(false);
    showToast(`Theme: ${THEME_LABELS[v]}`);
  }

  async function chooseLanguage(v: LanguageCode) {
    setLang(v);
    await setLanguage(v);
    setLangModal(false);
    showToast(v === "hi" ? "भाषा: हिन्दी" : "Language: English");
  }

  async function toggleNotif(v: boolean) {
    setNotifOn(v);
    await setNotifications(v);
    showToast(v ? "Notifications enabled" : "Notifications disabled");
  }

  async function toggleAppLock(v: boolean) {
    setAppLockOn(v);
    await setAppLock(v);
    showToast(v ? "App Lock enabled" : "App Lock disabled");
  }

  async function onShare() {
    try {
      await Share.share({
        message:
          `Check out DailyHub AI — Notes, Todos, Habits, Focus Timer, Expenses, AI Chat & more, all in one beautiful app.\n\n${PLAY_STORE_URL}`,
      });
    } catch {
      showToast("Couldn't open share sheet.");
    }
  }

  async function onRate() {
    const marketUrl = `market://details?id=${APP_PACKAGE}`;
    try {
      const ok = await Linking.canOpenURL(marketUrl);
      await Linking.openURL(ok ? marketUrl : PLAY_STORE_URL);
    } catch {
      Linking.openURL(PLAY_STORE_URL).catch(() => showToast("Couldn't open Play Store."));
    }
  }

  async function openMail(email: string, subject: string) {
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else showToast(`Email: ${email}`);
    } catch {
      showToast(`Email: ${email}`);
    }
  }

  function confirmRestore() {
    Alert.alert(
      "Restore Purchases",
      "No active purchases were found on this Google account. If you recently subscribed, please wait a minute and try again.",
      [{ text: "OK" }],
    );
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
          <Row
            icon="moon"
            label="Theme"
            value={THEME_LABELS[themeMode]}
            testID="row-theme"
            onPress={() => setThemeModal(true)}
          />
          <ToggleRow
            icon="notifications-outline"
            label="Notifications"
            value={notifOn}
            onValueChange={toggleNotif}
            testID="row-notif"
          />
          <Row
            icon="language"
            label="Language"
            value={LANGUAGE_LABELS[lang]}
            testID="row-language"
            onPress={() => setLangModal(true)}
          />
          <ToggleRow
            icon="lock-closed-outline"
            label="App Lock"
            value={appLockOn}
            onValueChange={toggleAppLock}
            testID="row-app-lock"
          />
        </Section>

        <Section title="Sync & Storage">
          <Row
            icon="cloud-upload-outline"
            label="Backup Status"
            value={isGuest ? "Local only" : "Auto (Cloud)"}
            testID="row-backup"
            onPress={() => showToast(isGuest ? "Sign in with Google to enable cloud backup." : "Cloud backup is active.")}
          />
          <Row
            icon="server-outline"
            label="Storage Usage"
            value={storageStr}
            testID="row-storage"
            onPress={loadPrefs}
          />
          <Row
            icon="refresh-outline"
            label="Restore Purchases"
            testID="row-restore"
            onPress={confirmRestore}
          />
        </Section>

        <Section title="Community">
          <Row
            icon="star-outline"
            label="Rate DailyHub AI"
            testID="row-rate"
            onPress={onRate}
          />
          <Row
            icon="share-social-outline"
            label="Share App"
            testID="row-share"
            onPress={onShare}
          />
          <Row
            icon="chatbubble-ellipses-outline"
            label="Send Feedback"
            testID="row-feedback"
            onPress={() => openMail(FEEDBACK_EMAIL, "DailyHub AI — Feedback")}
          />
          <Row
            icon="help-circle-outline"
            label="Help Center"
            testID="row-help"
            onPress={() => Linking.openURL("https://shivaminnovation.dev/help").catch(() => showToast("Help: shivaminnovation.dev/help"))}
          />
          <Row
            icon="mail-outline"
            label="Contact Support"
            testID="row-support"
            onPress={() => openMail(SUPPORT_EMAIL, "DailyHub AI — Support")}
          />
        </Section>

        <Section title="Data & Privacy">
          <Row
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            testID="row-privacy"
            onPress={() => router.push("/legal/privacy")}
          />
          <Row
            icon="document-text-outline"
            label="Terms & Conditions"
            testID="row-terms"
            onPress={() => router.push("/legal/terms")}
          />
        </Section>

        <Section title="About">
          <Row icon="information-circle-outline" label="Version" value="1.0.0" testID="row-version" />
          <Row
            icon="business-outline"
            label="Developer"
            value="Shivam Innovation"
            testID="row-developer"
            onPress={() => Linking.openURL("https://shivaminnovation.dev").catch(() => showToast("shivaminnovation.dev"))}
          />
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

      {/* Theme picker */}
      <PickerModal
        visible={themeModal}
        title="Choose Theme"
        options={[
          { id: "dark", label: THEME_LABELS.dark, icon: "moon" },
          { id: "light", label: THEME_LABELS.light, icon: "sunny-outline" },
          { id: "system", label: THEME_LABELS.system, icon: "phone-portrait-outline" },
        ]}
        selected={themeMode}
        onSelect={(id) => chooseTheme(id as ThemeMode)}
        onClose={() => setThemeModal(false)}
      />

      {/* Language picker */}
      <PickerModal
        visible={langModal}
        title="Choose Language"
        options={[
          { id: "en", label: LANGUAGE_LABELS.en, icon: "language" },
          { id: "hi", label: LANGUAGE_LABELS.hi, icon: "language" },
        ]}
        selected={lang}
        onSelect={(id) => chooseLanguage(id as LanguageCode)}
        onClose={() => setLangModal(false)}
      />
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
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} /> : null}
    </View>
  );
  if (onPress) return <Pressable onPress={onPress} android_ripple={{ color: colors.borderStrong }}>{content}</Pressable>;
  return content;
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  testID: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <Ionicons name={icon} size={18} color={colors.onSurfaceSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.borderStrong, true: colors.brandPrimary }}
        thumbColor={value ? colors.onBrandPrimary : colors.onSurfaceTertiary}
      />
    </View>
  );
}

type Option = { id: string; label: string; icon: keyof typeof Ionicons.glyphMap };
function PickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Option[];
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>
          {options.map((opt) => {
            const active = opt.id === selected;
            return (
              <Pressable
                key={opt.id}
                onPress={() => onSelect(opt.id)}
                style={({ pressed }) => [styles.modalOption, pressed && { opacity: 0.8 }]}
                android_ripple={{ color: colors.borderStrong }}
                testID={`picker-option-${opt.id}`}
              >
                <Ionicons name={opt.icon} size={18} color={active ? colors.brandPrimary : colors.onSurfaceSecondary} />
                <Text style={[styles.modalOptionText, active && { color: colors.brandPrimary, fontWeight: fontWeight.bold }]}>
                  {opt.label}
                </Text>
                {active ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />
                ) : (
                  <View style={{ width: 20 }} />
                )}
              </Pressable>
            );
          })}
          <Pressable onPress={onClose} style={styles.modalClose} testID="picker-close">
            <Text style={styles.modalCloseText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
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
    minHeight: 52,
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

  // Picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.onSurface,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  modalOptionText: {
    flex: 1,
    color: colors.onSurface,
    fontSize: fontSize.base,
  },
  modalClose: {
    marginTop: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  modalCloseText: {
    color: colors.onSurface,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
});
