import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="privacy-screen">
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="privacy-back">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Privacy Policy</Text>
          <View style={styles.iconBtn} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: June 2026</Text>

        <Section title="1. Overview">
          DailyHub AI (“we”, “us”, or “our”) is developed by Shivam Innovation. This Privacy Policy
          explains how we collect, use, and protect information when you use the app.
        </Section>

        <Section title="2. Information we collect">
          {`• Account info (email, name, profile picture) if you sign in with Google.\n• Content you create in the app: notes, todos, habits, focus sessions, expenses, AI chats.\n• Basic device info: OS version, model, language — used only for diagnostics.\n\nWe do NOT collect: contacts, SMS, calls, precise location, browsing history, or advertising IDs.`}
        </Section>

        <Section title="3. How we use your data">
          {`• Provide app functionality (sync, backup, AI features).\n• Improve stability & performance via aggregated anonymous analytics.\n• Respond to your support requests.`}
        </Section>

        <Section title="4. AI features">
          When you use AI Chat or AI Tools, the text you enter is sent to our secure backend and
          then to trusted LLM providers (OpenAI / Google Gemini / Anthropic) to generate a response.
          We do not use your chats to train models. Anonymized logs may be retained for up to 30 days
          for abuse prevention.
        </Section>

        <Section title="5. Data storage & security">
          Your app data is stored securely on our servers (encrypted in transit and at rest). Guest
          data lives only on your device unless you sign in with Google. You can delete your account
          any time from Profile → Sign out → Delete account (or email us).
        </Section>

        <Section title="6. Third-party services">
          Google Sign-In, OpenAI, Google Gemini, Anthropic Claude. Each provider has its own privacy
          policy; we recommend you review them.
        </Section>

        <Section title="7. Your rights">
          You have the right to access, correct, export, or delete your personal data. Contact us at
          support@shivaminnovation.dev for any request.
        </Section>

        <Section title="8. Children">
          The app is not intended for children under 13. We do not knowingly collect data from
          children under 13.
        </Section>

        <Section title="9. Changes">
          We may update this Privacy Policy from time to time. Material changes will be surfaced
          in-app. Continued use after an update means you accept the revised policy.
        </Section>

        <Section title="10. Contact">
          {`Shivam Innovation\nsupport@shivaminnovation.dev`}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  title: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  updated: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionTitle: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
  sectionBody: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, lineHeight: 22 },
});
