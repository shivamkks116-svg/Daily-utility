/**
 * Excel → PDF tool. Pick a .xlsx / .xls / .csv, convert on the backend
 * (every sheet as a table), then open the PDF in the Reader.
 */
import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState, ProgressBanner } from "@/src/components/toolkit/Primitives";
import { InstantOverlay } from "@/src/components/InstantOverlay";
import { pickSpreadsheet, spreadsheetToPdf, type PickedSheet } from "@/src/utils/xlsx/helpers";
import { humanBytes } from "@/src/utils/pdf/helpers";
import { addRecent } from "@/src/utils/toolkit/recents";
import { SheetPreview } from "@/src/components/SheetPreview";

export default function ExcelToPdfScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sharedUri?: string; sharedName?: string; sharedSize?: string }>();
  const [file, setFile] = useState<PickedSheet | null>(() =>
    params.sharedUri
      ? { uri: String(params.sharedUri), name: String(params.sharedName || "Shared.xlsx"), size: Number(params.sharedSize || 0) }
      : null,
  );
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    try {
      const picked = await pickSpreadsheet();
      if (picked) setFile(picked);
    } catch (e) {
      Alert.alert("Pick failed", (e as Error)?.message || String(e));
    }
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const pdf = await spreadsheetToPdf(file.uri, file.name);
      await addRecent({ kind: "pdf", uri: pdf.uri, name: pdf.name, size: pdf.size, tool: "Excel → PDF" });
      router.replace({
        pathname: "/pdf-toolkit/reader",
        params: { sharedUri: pdf.uri, sharedName: pdf.name, sharedSize: String(pdf.size) },
      });
    } catch (e) {
      Alert.alert("Convert failed", (e as Error)?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <ToolkitHeader title="Excel → PDF" subtitle="Convert .xlsx / .xls / .csv into a PDF" onBack={() => router.back()} />
      <View style={styles.body}>
        {!file ? (
          <EmptyState
            icon="grid-outline"
            title="Pick an Excel file"
            subtitle="Every sheet becomes a neat table. Supports .xlsx, .xls and .csv."
            action={<PrimaryButton icon="folder-open" label="Choose Excel file" onPress={pick} />}
          />
        ) : (
          <View style={styles.fileCard}>
            <View style={styles.fileHead}>
              <View style={styles.fileIcon}>
                <Ionicons name="grid" size={22} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.fileMeta}>{file.size ? humanBytes(file.size) : "Ready"}</Text>
              </View>
            </View>
            {busy ? <ProgressBanner label="Converting…" /> : null}
            <SheetPreview uri={file.uri} name={file.name} />
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <PrimaryButton icon="sync" label="Convert to PDF" onPress={convert} loading={busy} />
              <SecondaryButton icon="refresh" label="Pick another file" onPress={pick} />
            </View>
          </View>
        )}
      </View>
      <InstantOverlay visible={busy} title="Converting…" subtitle="Keep the app open — this takes just a moment." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  fileCard: {
    marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  fileHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  fileIcon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  fileName: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  fileMeta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
});
