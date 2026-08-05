import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "@/src/utils/keyboard";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { tap, success } from "@/src/utils/haptics";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type Msg = { id: string; role: "user" | "assistant"; content: string; created_at?: string };

const SESSION_ID = "default";

const STARTER_PROMPTS = [
  "Draft a plan for a productive week",
  "Explain quantum computing simply",
  "Give me 5 focus techniques",
  "Suggest a healthy morning routine",
];

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ items: Msg[] }>(`/ai/history/${SESSION_ID}`);
        setMessages(r.items || []);
      } catch {}
    })();
  }, []);

  const send = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    tap();
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const r = await api<{ reply: string }>("/ai/chat", {
        method: "POST",
        body: { session_id: SESSION_ID, message: text },
      });
      const assistantMsg: Msg = { id: `a-${Date.now()}`, role: "assistant", content: r.reply };
      setMessages((m) => [...m, assistantMsg]);
      success();
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { id: `err-${Date.now()}`, role: "assistant", content: `⚠️ ${e?.message || "AI error"}` },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [input, sending]);

  const regenerate = useCallback(async () => {
    // Find the last user message and re-send it
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || sending) return;
    // Drop the last assistant message
    setMessages((m) => {
      const idx = m.map(x => x.role).lastIndexOf("assistant");
      if (idx === -1) return m;
      return m.slice(0, idx);
    });
    await send(lastUser.content);
  }, [messages, sending, send]);

  const copyText = useCallback(async (text: string) => {
    tap();
    try { await Clipboard.setStringAsync(text); success(); } catch {}
  }, []);

  const empty = messages.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="ai-chat-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="chat-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.title}>AI Chat</Text>
          <View style={styles.modelBadge}>
            <Ionicons name="sparkles" size={10} color={colors.onBrandPrimary} />
            <Text style={styles.modelText}>Gemini 3 Flash</Text>
          </View>
        </View>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {empty ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="sparkles" size={26} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.emptyTitle}>How can I help?</Text>
            <Text style={styles.emptySub}>Ask anything — from work plans to quick answers.</Text>
            <View style={styles.suggWrap}>
              {STARTER_PROMPTS.map((p, i) => (
                <Pressable
                  key={i}
                  testID={`starter-${i}`}
                  onPress={() => send(p)}
                  style={({ pressed }) => [styles.suggChip, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.suggText}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}
            ListFooterComponent={sending ? <TypingIndicator /> : null}
            renderItem={({ item, index }) => (
              <View
                style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.aiBubble]}
                testID={`msg-${item.role}`}
              >
                {item.role === "assistant" ? (
                  <View style={styles.aiHead}>
                    <Ionicons name="sparkles" size={12} color={colors.brandPrimary} />
                    <Text style={styles.aiHeadText}>DailyHub AI</Text>
                  </View>
                ) : null}
                <Text style={item.role === "user" ? styles.userText : styles.aiText}>
                  {item.content}
                </Text>
                {item.role === "assistant" && !item.content.startsWith("⚠️") ? (
                  <View style={styles.msgActions}>
                    <Pressable
                      testID={`msg-copy-${item.id}`}
                      onPress={() => copyText(item.content)}
                      style={styles.msgActionBtn}
                      hitSlop={6}
                    >
                      <Ionicons name="copy-outline" size={14} color={colors.onSurfaceTertiary} />
                      <Text style={styles.msgActionText}>Copy</Text>
                    </Pressable>
                    {index === messages.length - 1 && !sending ? (
                      <Pressable
                        testID="msg-regenerate"
                        onPress={regenerate}
                        style={styles.msgActionBtn}
                        hitSlop={6}
                      >
                        <Ionicons name="refresh" size={14} color={colors.onSurfaceTertiary} />
                        <Text style={styles.msgActionText}>Regenerate</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )}
          />
        )}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <TextInput
            testID="chat-input"
            value={input}
            onChangeText={setInput}
            placeholder="Message DailyHub AI…"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={styles.input}
            multiline
            maxLength={2000}
          />
          <Pressable
            testID="chat-send-btn"
            disabled={!input.trim() || sending}
            onPress={() => send()}
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.onBrandPrimary} />
            ) : (
              <Ionicons name="arrow-up" size={20} color={colors.onBrandPrimary} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  title: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  modelBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 4, paddingHorizontal: spacing.sm, height: 20,
    borderRadius: radius.pill, backgroundColor: colors.brandPrimary,
  },
  modelText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: fontWeight.bold },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  emptyIcon: {
    width: 64, height: 64, borderRadius: radius.lg,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: {
    color: colors.onSurface,
    fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, letterSpacing: -0.5,
  },
  emptySub: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, textAlign: "center" },
  suggWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg, justifyContent: "center" },
  suggChip: {
    paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  suggText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  bubble: {
    maxWidth: "85%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.brandPrimary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceSecondary,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  aiHead: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  aiHeadText: {
    color: colors.brandPrimary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  userText: { color: colors.onBrandPrimary, fontSize: fontSize.base, lineHeight: 22 },
  aiText: { color: colors.onSurface, fontSize: fontSize.base, lineHeight: 22 },
  msgActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm, paddingTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  msgActionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  msgActionText: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  typingBubble: {
    alignSelf: "flex-start",
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    borderRadius: radius.lg, borderBottomLeftRadius: 4,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brandPrimary },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.onSurface, fontSize: fontSize.base,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: Platform.OS === "ios" ? spacing.md : spacing.sm,
    minHeight: 44, maxHeight: 120,
    borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
});

function TypingIndicator() {
  const dots = [0, 1, 2];
  return (
    <View style={styles.typingBubble} testID="typing-indicator">
      {dots.map((i) => (
        <AnimatedDot key={i} delay={i * 180} />
      ))}
    </View>
  );
}

function AnimatedDot({ delay }: { delay: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const start = Date.now() + delay;
    const t = setInterval(() => {
      if (!alive) return;
      setTick(Date.now() - start);
    }, 100);
    return () => { alive = false; clearInterval(t); };
  }, [delay]);
  const phase = (tick % 1000) / 1000;
  const opacity = 0.3 + 0.7 * Math.max(0, Math.sin(phase * Math.PI * 2));
  return <View style={[styles.typingDot, { opacity }]} />;
}
