import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput, Modal } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickPdfs, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { readPdfBase64 } from "@/src/utils/pdf";
import { api } from "@/src/api/client";

type Mode = "summarize" | "ask" | "keypoints" | "translate";

const MODE_META: Record<Mode, { title: string; sub: string; icon: keyof typeof Ionicons.glyphMap; button: string }> = {
  summarize: { title: "Summarise PDF", sub: "Executive summary in seconds", icon: "sparkles", button: "Summarise" },
  ask:       { title: "Ask your PDF",  sub: "Chat with the document",    icon: "chatbubble-ellipses", button: "Ask" },
  keypoints: { title: "Key Points",    sub: "Main takeaways as bullets", icon: "bulb",     button: "Extract" },
  translate: { title: "Translate PDF", sub: "Convert to another language", icon: "language", button: "Translate" },
};

const LANGS = ["Hindi", "English", "Spanish", "French", "German", "Arabic", "Chinese (Simplified)", "Japanese"];

export default function PdfAiScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode: Mode = ["summarize", "ask", "keypoints", "translate"].includes(String(params.mode || ""))
    ? (params.mode as Mode) : "summarize";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [consented, setConsented] = useState(false);
  const [askConsent, setAskConsent] = useState(false);
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("");

  const meta = MODE_META[mode];

  const pick = async () => {
    try {
      const picked = await pickPdfs();
      if (picked[0]) { setFile(picked[0]); setOutput(""); setStatus(""); }
    } catch (e: any) { Alert.alert("Picker error", e?.message || "Unknown error"); }
  };

  const requireConsent = () => {
    if (consented) return true;
    setAskConsent(true);
    return false;
  };

  const run = async () => {
    if (!file) { Alert.alert("Pick a PDF first"); return; }
    if (mode === "ask" && !question.trim()) { Alert.alert("Type a question", "Enter what you want to ask about this PDF."); return; }
    if (!requireConsent()) return;
    setBusy(true);
    setStatus("Reading PDF...");
    setOutput("");
    try {
      const b64 = await readPdfBase64(file.uri);
      setStatus(mode === "translate" ? `Translating to ${language}...` : "Contacting AI...");
      let text = "";
      if (mode === "summarize") {
        const r = await api<{ summary: string }>("/pdf/summarize", { method: "POST", body: { file_base64: b64, filename: file.name } });
        text = r.summary;
      } else if (mode === "keypoints") {
        const r = await api<{ keypoints: string }>("/pdf/keypoints", { method: "POST", body: { file_base64: b64, filename: file.name } });
        text = r.keypoints;
      } else if (mode === "translate") {
        const r = await api<{ translation: string }>("/pdf/translate", { method: "POST", body: { file_base64: b64, target_language: language, filename: file.name } });
        text = r.translation;
      } else {
        const r = await api<{ answer: string }>("/pdf/ask", { method: "POST", body: { file_base64: b64, question: question.trim(), filename: file.name } });
        text = r.answer;
      }
      setOutput(text);
      setStatus("Done");
    } catch (e: any) {
      const msg = e?.message || "AI request failed";
      Alert.alert("AI error", msg);
      setStatus("");
    } finally { setBusy(false); }
  };

  const copyOut = async () => {
    await Clipboard.setStringAsync(output);
    Alert.alert("Copied", "Result copied to clipboard.");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="AI PDF Assistant" subtitle={meta.sub} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.lg }}>
        {/* Mode selector */}
        <View style={styles.modeRow}>
          {(Object.keys(MODE_META) as Mode[]).map(m => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.modeChip, mode === m && styles.modeChipOn]}>
              <Ionicons name={MODE_META[m].icon} size={16} color={mode === m ? colors.onBrandPrimary : colors.onSurface} />
              <Text style={[styles.modeChipText, mode === m && { color: colors.onBrandPrimary }]}>{MODE_META[m].title.replace("PDF", "").trim()}</Text>
            </Pressable>
          ))}
        </View>

        {status ? <ProgressBanner label={status} done={!busy && !!output} /> : null}

        {!file ? (
          <EmptyState icon={meta.icon} title={meta.title} subtitle={meta.sub} actionLabel="Pick a PDF" onAction={pick} />
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <View style={styles.fileBox}>
              <Ionicons name="document" size={18} color={colors.brandPrimary} />
              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              <Text style={styles.fileMeta}>{humanBytes(file.size)}</Text>
              <Pressable onPress={pick} hitSlop={10} style={styles.changeBtn}>
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            </View>

            {mode === "ask" ? (
              <>
                <Text style={styles.sectionTitle}>Your question</Text>
                <TextInput
                  style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                  placeholder="e.g. What is the deadline in this contract?"
                  placeholderTextColor={colors.onSurfaceTertiary}
                />
              </>
            ) : null}

            {mode === "translate" ? (
              <>
                <Text style={styles.sectionTitle}>Target language</Text>
                <View style={styles.langRow}>
                  {LANGS.map(l => (
                    <Pressable key={l} onPress={() => setLanguage(l)} style={[styles.langChip, language === l && styles.langChipOn]}>
                      <Text style={[styles.langChipText, language === l && { color: colors.onBrandPrimary }]}>{l}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {output ? (
              <View style={styles.output}>
                <Text style={styles.outputText}>{output}</Text>
                <View style={styles.outputActions}>
                  <SecondaryButton icon="copy" label="Copy" onPress={copyOut} />
                </View>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {file ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <PrimaryButton icon={meta.icon} label={busy ? "Working..." : meta.button} onPress={run} loading={busy} />
        </View>
      ) : null}

      {/* Consent modal */}
      <Modal visible={askConsent} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Ionicons name="shield-checkmark" size={30} color={colors.brandPrimary} />
            <Text style={styles.modalTitle}>AI processing consent</Text>
            <Text style={styles.modalBody}>
              To answer, your PDF&apos;s extracted text will be sent to our AI provider (Google Gemini via Emergent LLM). Nothing is stored permanently. Pages that are pure scanned images won&apos;t have text to extract.
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <SecondaryButton label="Cancel" onPress={() => setAskConsent(false)} style={{ flex: 1 }} />
              <PrimaryButton
                label="I understand"
                onPress={() => { setConsented(true); setAskConsent(false); setTimeout(() => run(), 100); }}
                style={{ flex: 1 } as any}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  modeRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.md },
  modeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  modeChipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  modeChipText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  fileBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  fileName: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold, flex: 1 },
  fileMeta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs },
  changeBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  changeText: { color: colors.brandPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  sectionTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: fontSize.md, borderWidth: 1, borderColor: colors.border },
  langRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  langChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  langChipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  langChipText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  output: { marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  outputText: { color: colors.onSurface, fontSize: fontSize.md, lineHeight: 22 },
  outputActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.xl, padding: spacing.xl, width: "100%", maxWidth: 420, alignItems: "flex-start" },
  modalTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: spacing.md, marginBottom: spacing.sm },
  modalBody: { color: colors.onSurfaceSecondary, fontSize: fontSize.md, lineHeight: 22 },
});
