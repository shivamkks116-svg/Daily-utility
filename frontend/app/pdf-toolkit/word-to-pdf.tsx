/**
 * Word → PDF tool. Pick a `.docx` / `.doc`, convert on the backend, open the
 * resulting PDF in the native Reader.
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { pickDocx, docxToPdf, type PickedDocx } from "@/src/utils/docx/helpers";
import { humanBytes } from "@/src/utils/pdf/helpers";
import { addRecent } from "@/src/utils/toolkit/recents";
import { Ionicons } from "@expo/vector-icons";

export default function WordToPdfScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sharedUri?: string; sharedName?: string; sharedSize?: string }>();
  const [file, setFile] = useState<PickedDocx | null>(() =>
    params.sharedUri
      ? {
          uri: String(params.sharedUri),
          name: String(params.sharedName || "Shared.docx"),
          size: Number(params.sharedSize || 0),
        }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const pick = async () => {
    try {
      const picked = await pickDocx();
      if (picked) setFile(picked);
    } catch (e) {
      Alert.alert("Pick failed", (e as Error)?.message || String(e));
    }
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setStatus("Converting…");
    try {
      const pdf = await docxToPdf(file.uri, file.name);
      await addRecent({
        kind: "pdf",
        uri: pdf.uri,
        name: pdf.name,
        size: pdf.size,
        tool: "Word → PDF",
      });
      router.replace({
        pathname: "/pdf-toolkit/reader",
        params: { sharedUri: pdf.uri, sharedName: pdf.name, sharedSize: String(pdf.size) },
      });
    } catch (e) {
      Alert.alert("Convert failed", (e as Error)?.message || String(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <ToolkitHeader title="Word → PDF" subtitle="Convert .docx / .doc into a PDF" onBack={() => router.back()} />
      <View style={styles.body}>
        {!file ? (
          <EmptyState
            icon="document-outline"
            title="Pick a Word file"
            subtitle="We support .docx and legacy .doc formats."
            action={<PrimaryButton icon="folder-open" label="Choose Word file" onPress={pick} />}
          />
        ) : (
          <View style={styles.fileCard}>
            <View style={styles.fileHead}>
              <View style={styles.fileIcon}>
                <Ionicons name="document-text" size={22} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.fileMeta}>{file.size ? humanBytes(file.size) : "Ready"}</Text>
              </View>
            </View>

            {busy ? <ProgressBanner label={status} /> : null}

            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <PrimaryButton icon="sync" label="Convert to PDF" onPress={convert} loading={busy} />
              <SecondaryButton icon="refresh" label="Pick another file" onPress={pick} />
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  fileCard: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  fileIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  fileName: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  fileMeta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
});
