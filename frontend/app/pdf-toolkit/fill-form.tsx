import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Pressable,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import {
  ToolkitHeader,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  ProgressBanner,
} from "@/src/components/toolkit/Primitives";
import { pickPdfs, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { listPdfFields, fillPdfFields, type PDFField } from "@/src/utils/pdf";
import { addRecent } from "@/src/utils/toolkit/recents";

export default function FillFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [fields, setFields] = useState<PDFField[] | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [busy, setBusy] = useState<"detect" | "fill" | null>(null);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [filledCount, setFilledCount] = useState(0);

  const pick = async () => {
    try {
      const [picked] = await pickPdfs({ multiple: false });
      if (!picked) return;
      setFile(picked);
      setFields(null);
      setValues({});
      setResultUri(null);
    } catch (e: unknown) {
      Alert.alert("Pick failed", (e as Error)?.message || String(e));
    }
  };

  const detect = async () => {
    if (!file) return;
    setBusy("detect");
    try {
      const list = await listPdfFields(file.uri);
      setFields(list);
      const initial: Record<string, string | boolean> = {};
      for (const f of list) {
        initial[f.name] = f.type === "checkbox" ? Boolean(f.value) : f.value || "";
      }
      setValues(initial);
      if (list.length === 0) {
        Alert.alert("No form fields", "This PDF doesn't contain any fillable form fields.");
      }
    } catch (e: unknown) {
      Alert.alert("Detect failed", (e as Error)?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!file || !fields) return;
    setBusy("fill");
    try {
      const r = await fillPdfFields(file.uri, values);
      setResultUri(r.uri);
      setFilledCount(r.filled);
      await addRecent({
        kind: "pdf",
        uri: r.uri,
        name: file.name.replace(/\.pdf$/i, "-filled.pdf"),
        size: 0,
        tool: "Fill Form",
      });
    } catch (e: unknown) {
      Alert.alert("Fill failed", (e as Error)?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    if (!resultUri) return;
    try {
      const ok = await Sharing.isAvailableAsync();
      if (ok) await Sharing.shareAsync(resultUri, { mimeType: "application/pdf", dialogTitle: "Share filled PDF" });
    } catch (e: unknown) {
      Alert.alert("Share failed", (e as Error)?.message || String(e));
    }
  };

  const setValue = (name: string, v: string | boolean) => {
    setValues((prev) => ({ ...prev, [name]: v }));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Fill Form" subtitle="Detect form fields and type answers" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }}>
        {!file ? (
          <EmptyState
            icon="reader-outline"
            title="Pick a fillable PDF"
            subtitle="We'll detect text fields, checkboxes, and dropdowns automatically."
            action={<PrimaryButton icon="folder-open" label="Choose PDF" onPress={pick} />}
          />
        ) : (
          <>
            <View style={styles.card}>
              <Ionicons name="reader" size={22} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.meta}>{humanBytes(file.size)}</Text>
              </View>
              <Pressable onPress={pick}><Ionicons name="swap-horizontal" size={20} color={colors.onSurfaceTertiary} /></Pressable>
            </View>

            {busy === "detect" ? <ProgressBanner label="Detecting form fields…" /> : null}

            {!fields ? (
              <View style={{ marginTop: spacing.lg }}>
                <PrimaryButton icon="search" label="Detect form fields" onPress={detect} disabled={busy !== null} />
              </View>
            ) : fields.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="information-circle" size={20} color={colors.onSurfaceTertiary} />
                <Text style={styles.emptyText}>This PDF has no fillable form fields.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.fieldsHeader}>{fields.length} field{fields.length === 1 ? "" : "s"} detected</Text>
                {fields.map((f) => (
                  <View key={f.name} style={styles.fieldRow}>
                    <View style={styles.fieldHead}>
                      <Text style={styles.fieldLabel} numberOfLines={1}>
                        {f.label || f.name}{f.required ? " *" : ""}
                      </Text>
                      <View style={styles.fieldChip}>
                        <Text style={styles.fieldChipText}>Page {f.page} · {f.type}</Text>
                      </View>
                    </View>
                    {f.type === "checkbox" ? (
                      <Pressable
                        onPress={() => setValue(f.name, !values[f.name])}
                        style={[styles.checkbox, values[f.name] && styles.checkboxActive]}
                        testID={`fill-${f.name}`}
                      >
                        <Ionicons
                          name={values[f.name] ? "checkbox" : "square-outline"}
                          size={18}
                          color={values[f.name] ? colors.onBrandPrimary : colors.onSurfaceSecondary}
                        />
                        <Text style={[styles.checkboxText, values[f.name] && styles.checkboxTextActive]}>
                          {values[f.name] ? "Checked" : "Unchecked"}
                        </Text>
                      </Pressable>
                    ) : f.type === "listbox" || f.type === "combobox" || f.type === "radio" ? (
                      <View style={styles.optionsRow}>
                        {(f.options.length > 0 ? f.options : ["Yes", "No"]).map((opt) => (
                          <Pressable
                            key={opt}
                            onPress={() => setValue(f.name, opt)}
                            style={[styles.optionBtn, values[f.name] === opt && styles.optionBtnActive]}
                            testID={`fill-${f.name}-${opt}`}
                          >
                            <Text style={[styles.optionText, values[f.name] === opt && styles.optionTextActive]}>{opt}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : (
                      <TextInput
                        style={styles.input}
                        value={(values[f.name] as string) || ""}
                        onChangeText={(t) => setValue(f.name, t)}
                        placeholder={f.type === "signature" ? "Type name to represent signature" : `Enter ${f.label || f.name}`}
                        placeholderTextColor={colors.onSurfaceTertiary}
                        maxLength={f.max_len > 0 ? f.max_len : undefined}
                        testID={`fill-${f.name}`}
                      />
                    )}
                  </View>
                ))}

                {busy === "fill" ? <ProgressBanner label="Filling PDF…" /> : null}

                {resultUri ? (
                  <View style={styles.resultCard}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.brandPrimary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultTitle}>Filled PDF ready</Text>
                      <Text style={styles.resultSub}>{filledCount} field{filledCount === 1 ? "" : "s"} written</Text>
                    </View>
                  </View>
                ) : null}

                <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                  {resultUri ? <SecondaryButton icon="share-outline" label="Share filled PDF" onPress={share} /> : null}
                  <PrimaryButton icon="reader" label={resultUri ? "Re-fill" : "Fill PDF"} onPress={submit} disabled={busy !== null} />
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
      {busy ? <View style={styles.overlay}><ActivityIndicator size="large" color={colors.brandPrimary} /></View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  emptyBox: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, textAlign: "center" },
  fieldsHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  fieldRow: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  fieldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  fieldLabel: { flex: 1, color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  fieldChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  fieldChipText: { color: colors.onBrandTertiary, fontSize: 10, fontWeight: fontWeight.semibold },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.onSurface,
    fontSize: fontSize.md,
    backgroundColor: colors.surface,
  },
  checkbox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignSelf: "flex-start",
  },
  checkboxActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  checkboxText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm },
  checkboxTextActive: { color: colors.onBrandPrimary, fontWeight: fontWeight.semibold },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  optionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  optionText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: fontWeight.semibold },
  optionTextActive: { color: colors.onBrandPrimary },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brandSecondary,
  },
  resultTitle: { color: colors.onBrandTertiary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  resultSub: { color: colors.onSurfaceSecondary, fontSize: fontSize.xs, marginTop: 2 },
  overlay: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.15)" },
});
