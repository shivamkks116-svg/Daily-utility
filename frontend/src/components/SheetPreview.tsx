/**
 * In-app spreadsheet preview: sheet tabs + scrollable table (first 200 rows × 30 cols).
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { api } from "@/src/api/client";

type Sheet = { name: string; total_rows: number; rows: string[][] };

export function SheetPreview({ uri, name }: { uri: string; name: string }) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [active, setActive] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSheets(null);
    setErr(null);
    (async () => {
      try {
        const file_base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const r = await api<{ sheets: Sheet[] }>("/xlsx/preview", { method: "POST", body: { file_base64, title: name } });
        if (!cancelled) { setSheets(r.sheets); setActive(0); }
      } catch (e) {
        if (!cancelled) setErr((e as Error)?.message || "Preview failed");
      }
    })();
    return () => { cancelled = true; };
  }, [uri, name]);

  if (err) return <Text style={styles.err}>{err}</Text>;
  if (!sheets) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brandPrimary} />
        <Text style={styles.meta}>Loading preview…</Text>
      </View>
    );
  }
  const sheet = sheets[active];
  const cols = Math.max(0, ...(sheet?.rows || []).map((r) => r.length));

  return (
    <View style={styles.wrap} testID="sheet-preview">
      {sheets.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {sheets.map((s, i) => (
            <Pressable key={s.name + i} onPress={() => setActive(i)} style={[styles.tab, i === active && styles.tabActive]}>
              <Text style={[styles.tabText, i === active && styles.tabTextActive]} numberOfLines={1}>{s.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <Text style={styles.meta}>
        {sheet ? `${sheet.total_rows} rows${sheet.total_rows > 200 ? " · showing first 200" : ""}` : "Empty"}
      </Text>
      <ScrollView style={styles.tableBox} nestedScrollEnabled>
        <ScrollView horizontal nestedScrollEnabled>
          <View>
            {(sheet?.rows || []).map((row, ri) => (
              <View key={ri} style={[styles.row, ri === 0 && styles.headRow]}>
                {Array.from({ length: cols }).map((_, ci) => (
                  <Text key={ci} style={[styles.cell, ri === 0 && styles.headCell]} numberOfLines={1}>
                    {row[ci] ?? ""}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, gap: spacing.sm },
  loading: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  tabs: { gap: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md, minHeight: 36, justifyContent: "center", borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, maxWidth: 160,
  },
  tabActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  tabText: { color: colors.onSurface, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  tabTextActive: { color: colors.onBrandPrimary },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs },
  err: { color: colors.error, fontSize: fontSize.sm, marginTop: spacing.md },
  tableBox: { maxHeight: 320, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  row: { flexDirection: "row" },
  headRow: { backgroundColor: colors.surfaceSecondary },
  cell: {
    width: 110, paddingHorizontal: 6, paddingVertical: 6, fontSize: fontSize.xs, color: colors.onSurface,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
  },
  headCell: { fontWeight: fontWeight.bold },
});
