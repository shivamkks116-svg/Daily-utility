/**
 * Generic file converter screen: /pdf-toolkit/convert/[kind]
 *   ppt-to-pdf   → .pptx  → PDF (opens in Reader)
 *   pdf-to-excel → PDF    → .xlsx (share / save)
 */
import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState } from "@/src/components/toolkit/Primitives";
import { InstantOverlay } from "@/src/components/InstantOverlay";
import { api } from "@/src/api/client";
import { humanBytes } from "@/src/utils/pdf/helpers";
import { addRecent } from "@/src/utils/toolkit/recents";

type Kind = {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  mimes: string[];
  exts: RegExp;
  endpoint: string;
  outExt: string;
  outMime: string;
  hint: string;
};

const KINDS: Record<string, Kind> = {
  "ppt-to-pdf": {
    title: "PowerPoint → PDF",
    subtitle: "Turn .pptx slides into a PDF",
    icon: "easel-outline",
    mimes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    exts: /\.pptx$/i,
    endpoint: "/pptx/to-pdf",
    outExt: "pdf",
    outMime: "application/pdf",
    hint: "Each slide becomes one PDF page with its text, tables and pictures. Old .ppt files: save as .pptx first.",
  },
  "pdf-to-excel": {
    title: "PDF → Excel",
    subtitle: "Extract tables into an .xlsx file",
    icon: "grid-outline",
    mimes: ["application/pdf"],
    exts: /\.pdf$/i,
    endpoint: "/pdf/to-xlsx",
    outExt: "xlsx",
    outMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    hint: "Tables on each page become Excel sheets. Pages without tables are copied line by line.",
  },
};

type Picked = { uri: string; name: string; size: number };

export default function ConvertScreen() {
  const router = useRouter();
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const cfg = KINDS[String(kind)] || KINDS["ppt-to-pdf"];
  const [file, setFile] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: cfg.mimes, copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (!cfg.exts.test(a.name || "")) {
      Alert.alert("Unsupported file", `Please pick a ${cfg.exts.source.replace(/[\\$]/g, "").replace("i", "")} file.`);
      return;
    }
    if (a.size && a.size > 25 * 1024 * 1024) {
      Alert.alert("File too large", "Conversion is limited to 25 MB.");
      return;
    }
    setFile({ uri: a.uri, name: a.name, size: a.size ?? 0 });
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const file_base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      const res = await api<{ file_base64: string; size: number }>(cfg.endpoint, {
        method: "POST",
        body: { file_base64, title: file.name },
      });
      const outName = file.name.replace(/\.[^.]+$/, "") + "." + cfg.outExt;
      const dest = `${FileSystem.cacheDirectory}${Date.now()}-${outName}`;
      await FileSystem.writeAsStringAsync(dest, res.file_base64, { encoding: FileSystem.EncodingType.Base64 });
      if (cfg.outExt === "pdf") {
        await addRecent({ kind: "pdf", uri: dest, name: outName, size: res.size, tool: cfg.title });
        router.replace({ pathname: "/pdf-toolkit/reader", params: { sharedUri: dest, sharedName: outName, sharedSize: String(res.size) } });
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(dest, { mimeType: cfg.outMime, dialogTitle: "Save or share Excel file" });
        } else {
          Alert.alert("Converted", `${outName} is ready.`);
        }
      }
    } catch (e) {
      Alert.alert("Convert failed", (e as Error)?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <ToolkitHeader title={cfg.title} subtitle={cfg.subtitle} onBack={() => router.back()} />
      <View style={styles.body}>
        {!file ? (
          <EmptyState
            icon={cfg.icon}
            title="Pick a file"
            subtitle={cfg.hint}
            action={<PrimaryButton icon="folder-open" label="Choose file" onPress={pick} />}
          />
        ) : (
          <View style={styles.fileCard}>
            <View style={styles.fileHead}>
              <View style={styles.fileIcon}>
                <Ionicons name={cfg.icon} size={22} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.fileMeta}>{file.size ? humanBytes(file.size) : "Ready"}</Text>
              </View>
            </View>
            <Text style={styles.hint}>{cfg.hint}</Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <PrimaryButton icon="sync" label={`Convert to ${cfg.outExt.toUpperCase()}`} onPress={convert} loading={busy} />
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
  hint: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: spacing.md, lineHeight: 20 },
});
