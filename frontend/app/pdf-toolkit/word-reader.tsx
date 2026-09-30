/**
 * Dedicated Word document reader.
 *
 * Displays a `.docx` / `.doc` as scrollable, selectable native text with
 * heading-aware typography. Also offers a "Convert to PDF" shortcut that
 * routes into the PDF Reader (so users get the pinch-zoom + share flow
 * on demand).
 *
 * Accepts route params `sharedUri` / `sharedName` / `sharedSize` when
 * launched from a system VIEW/SEND intent (see `src/utils/pdf/sharedIntent`).
 */

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import {
  ToolkitHeader,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  ProgressBanner,
} from "@/src/components/toolkit/Primitives";
import {
  pickDocx,
  docxRead,
  docxToPdf,
  type PickedDocx,
  type DocxBlock,
} from "@/src/utils/docx/helpers";
import { addRecent } from "@/src/utils/toolkit/recents";
import { humanBytes } from "@/src/utils/pdf/helpers";

/** Type-safe heading sizes. Level 1 is the biggest. */
const HEADING_SIZE: Record<number, number> = {
  1: 24,
  2: 20,
  3: 18,
  4: 16,
  5: 15,
  6: 14,
};

export default function WordReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    sharedUri?: string;
    sharedName?: string;
    sharedSize?: string;
  }>();

  const [file, setFile] = useState<PickedDocx | null>(null);
  const [blocks, setBlocks] = useState<DocxBlock[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  // Accept a shared file from Android VIEW/SEND intent.
  useEffect(() => {
    if (params.sharedUri && !file) {
      setFile({
        uri: String(params.sharedUri),
        name: String(params.sharedName || "Shared.docx"),
        size: Number(params.sharedSize || 0),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sharedUri]);

  // Auto-render when a file is present.
  useEffect(() => {
    if (file && blocks.length === 0 && !busy) {
      render();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const pick = async () => {
    try {
      const picked = await pickDocx();
      if (!picked) return;
      setFile(picked);
      setBlocks([]);
    } catch (e: unknown) {
      Alert.alert("Pick failed", (e as Error)?.message || String(e));
    }
  };

  const render = async () => {
    if (!file) return;
    setBusy(true);
    setStatus("Reading document…");
    try {
      const res = await docxRead(file.uri);
      setBlocks(res.blocks);
      setStatus(
        `${res.paragraphCount} paragraph${res.paragraphCount === 1 ? "" : "s"} · ${res.charCount.toLocaleString()} chars`,
      );
      addRecent({
        kind: "pdf", // recents store is PDF/image only right now; label instead:
        uri: file.uri,
        name: file.name,
        size: file.size,
        tool: "Word Reader",
      }).catch(() => {});
    } catch (e: unknown) {
      Alert.alert("Read failed", (e as Error)?.message || String(e));
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const openAsPdf = async () => {
    if (!file) return;
    setBusy(true);
    setStatus("Converting to PDF…");
    try {
      const pdf = await docxToPdf(file.uri, file.name);
      router.push({
        pathname: "/pdf-toolkit/reader",
        params: {
          sharedUri: pdf.uri,
          sharedName: pdf.name,
          sharedSize: String(pdf.size),
        },
      });
    } catch (e: unknown) {
      Alert.alert("Convert failed", (e as Error)?.message || String(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const reset = () => {
    setFile(null);
    setBlocks([]);
    setStatus("");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ToolkitHeader
        title="Word Reader"
        subtitle="Read .docx and .doc files"
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        }}
      >
        {!file ? (
          <EmptyState
            icon="document-text"
            title="Pick a Word document"
            subtitle="Open any .docx / .doc file for instant, selectable reading."
            action={<PrimaryButton icon="folder-open" label="Choose Word file" onPress={pick} />}
          />
        ) : (
          <>
            <View style={styles.fileCard}>
              <View style={styles.fileIcon}>
                <Ionicons name="document-text" size={22} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
                <Text style={styles.fileMeta}>
                  {file.size ? humanBytes(file.size) : "shared"}
                  {status ? ` · ${status}` : ""}
                </Text>
              </View>
              <Pressable onPress={reset} hitSlop={8} style={styles.remove}>
                <Ionicons name="close" size={18} color={colors.onSurfaceTertiary} />
              </Pressable>
            </View>

            {busy ? <ProgressBanner label={status} /> : null}

            {blocks.length > 0 ? (
              <>
                <View style={styles.actions}>
                  <SecondaryButton
                    icon="document"
                    label="Open as PDF"
                    onPress={openAsPdf}
                  />
                </View>
                <View style={styles.reader}>
                  {blocks.map((b, i) => {
                    if (!b.text) {
                      return <View key={i} style={{ height: spacing.md }} />;
                    }
                    if (b.level > 0) {
                      return (
                        <Text
                          key={i}
                          selectable
                          style={[
                            styles.heading,
                            {
                              fontSize: HEADING_SIZE[b.level] || 18,
                              marginTop: b.level === 1 ? spacing.lg : spacing.md,
                            },
                          ]}
                        >
                          {b.text}
                        </Text>
                      );
                    }
                    return (
                      <Text key={i} selectable style={styles.body}>
                        {b.text}
                      </Text>
                    );
                  })}
                </View>
              </>
            ) : !busy ? (
              <View style={{ marginTop: spacing.lg }}>
                <PrimaryButton icon="eye" label="Read document" onPress={render} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: {
    color: colors.onSurface,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  fileMeta: {
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  remove: { padding: spacing.xs },
  actions: {
    marginBottom: spacing.md,
  },
  reader: {
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: {
    color: colors.onSurface,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  body: {
    color: colors.onSurface,
    fontSize: fontSize.md,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
});
