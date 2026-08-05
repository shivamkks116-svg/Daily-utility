import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "@/src/utils/keyboard";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type ToolKind = "translator" | "grammar" | "summarize" | "email" | "study";

const TOOL_CONFIG: Record<ToolKind, {
  title: string;
  desc: string;
  icon: keyof typeof import("@expo/vector-icons/Ionicons").glyphMap;
  placeholder: string;
  endpoint: string;
  extra?: "language";
  submit: string;
}> = {
  translator: {
    title: "Translator",
    desc: "Translate text to any language instantly.",
    icon: "language",
    placeholder: "Type or paste text to translate…",
    endpoint: "/ai/translate",
    extra: "language",
    submit: "Translate",
  },
  grammar: {
    title: "Grammar Fixer",
    desc: "Polish your writing with correct grammar and flow.",
    icon: "create",
    placeholder: "Paste your text to fix…",
    endpoint: "/ai/grammar",
    submit: "Fix grammar",
  },
  summarize: {
    title: "Summarizer",
    desc: "Condense any text into crisp bullet points.",
    icon: "reader",
    placeholder: "Paste the content you want summarized…",
    endpoint: "/ai/summarize",
    submit: "Summarize",
  },
  email: {
    title: "Email Writer",
    desc: "Describe your intent — AI drafts a polished email.",
    icon: "mail",
    placeholder: "e.g. Politely ask my manager for a day off next Friday…",
    endpoint: "/ai/email-writer",
    submit: "Write email",
  },
  study: {
    title: "Study Assistant",
    desc: "Explain any topic simply with examples and quiz.",
    icon: "school",
    placeholder: "e.g. Explain photosynthesis for a 10-year-old…",
    endpoint: "/ai/study",
    submit: "Explain",
  },
};

const LANGUAGES = ["English", "Spanish", "French", "German", "Japanese", "Hindi", "Chinese", "Arabic", "Portuguese"];

export default function AIToolScreen() {
  const { kind } = useLocalSearchParams<{ kind: ToolKind }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const config = useMemo(() => TOOL_CONFIG[kind] || TOOL_CONFIG.summarize, [kind]);

  const [text, setText] = useState("");
  const [lang, setLang] = useState("Spanish");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body: any = config.extra === "language"
        ? { text: text.trim(), target_language: lang }
        : { prompt: text.trim() };
      const r = await api<{ result: string }>(config.endpoint, { method: "POST", body });
      setResult(r.result);
    } catch (e: any) {
      setError(e?.message || "AI error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID={`ai-tool-${kind}-screen`}>
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="tool-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={styles.title}>{config.title}</Text>
        </View>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <KeyboardAwareScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.xxl,
        }}
        bottomOffset={20}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name={config.icon} size={22} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.desc}>{config.desc}</Text>
        </View>

        {config.extra === "language" ? (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={styles.label}>Target language</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {LANGUAGES.map((l) => {
                const active = l === lang;
                return (
                  <Pressable
                    key={l}
                    testID={`lang-${l}`}
                    onPress={() => setLang(l)}
                    style={[styles.langChip, active && styles.langChipActive]}
                  >
                    <Text style={[styles.langText, active && { color: colors.onBrandPrimary }]}>{l}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <Text style={styles.label}>Your input</Text>
        <TextInput
          testID="tool-input"
          value={text}
          onChangeText={setText}
          placeholder={config.placeholder}
          placeholderTextColor={colors.onSurfaceTertiary}
          style={styles.textArea}
          multiline
          textAlignVertical="top"
        />

        <Pressable
          testID="tool-submit-btn"
          onPress={submit}
          disabled={loading || !text.trim()}
          style={({ pressed }) => [
            styles.submit,
            (!text.trim() || loading) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.submitText}>{config.submit}</Text>
            </>
          )}
        </Pressable>

        {error ? (
          <View style={styles.errorCard} testID="tool-error">
            <Ionicons name="warning" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {result ? (
          <View style={styles.resultCard} testID="tool-result">
            <View style={styles.resultHead}>
              <Text style={styles.resultLabel}>RESULT</Text>
            </View>
            <Text style={styles.resultText} selectable>{result}</Text>
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  title: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  hero: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    marginBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  heroIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  desc: { color: colors.onSurface, fontSize: fontSize.base, flex: 1, lineHeight: 20 },
  label: {
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  langChip: {
    height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  langChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  langText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  textArea: {
    color: colors.onSurface, fontSize: fontSize.base, lineHeight: 22,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 140,
  },
  submit: {
    height: 54, borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: spacing.md,
    marginTop: spacing.lg,
  },
  submitText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.lg },
  errorCard: {
    marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: "#3B0E0A", flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  errorText: { color: colors.error, flex: 1 },
  resultCard: {
    marginTop: spacing.lg, padding: spacing.lg,
    borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.borderStrong,
  },
  resultHead: { marginBottom: spacing.sm },
  resultLabel: {
    color: colors.brandPrimary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1,
  },
  resultText: { color: colors.onSurface, fontSize: fontSize.base, lineHeight: 22 },
});
