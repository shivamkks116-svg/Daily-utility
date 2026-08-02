import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Linking, FlatList,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type Scan = { id: string; value: string; type: string; created_at: string };

function detectType(v: string): string {
  const s = v.trim();
  if (/^https?:\/\//i.test(s)) return "url";
  if (/^wifi:/i.test(s)) return "wifi";
  if (/^begin:vcard/i.test(s)) return "contact";
  if (/^mailto:/i.test(s)) return "email";
  if (/^tel:/i.test(s)) return "phone";
  return "text";
}

export default function QRScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [current, setCurrent] = useState<{ value: string; type: string } | null>(null);
  const [history, setHistory] = useState<Scan[]>([]);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const r = await api<{ items: Scan[] }>("/qr-scans");
      setHistory(r.items);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  const onBarcode = async ({ data }: { data: string }) => {
    if (!scanning || busy || !data) return;
    setBusy(true);
    setScanning(false);
    const type = detectType(data);
    setCurrent({ value: data, type });
    try {
      await api("/qr-scans", { method: "POST", body: { value: data, type } });
      loadHistory();
    } finally { setBusy(false); }
  };

  function resume() { setCurrent(null); setScanning(true); }
  async function openUrl(v: string) {
    try { await Linking.openURL(v); } catch {}
  }
  async function del(id: string) {
    await api(`/qr-scans/${id}`, { method: "DELETE" });
    loadHistory();
  }

  // Permission gate
  if (!permission) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.root} testID="qr-permission-gate">
        <SafeAreaView edges={["top"]} style={styles.header}>
          <Pressable testID="qr-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>QR Scanner</Text>
          <View style={{ width: 44 }} />
        </SafeAreaView>
        <View style={styles.permWrap}>
          <View style={styles.permIcon}>
            <Ionicons name="camera" size={30} color={colors.brandPrimary} />
          </View>
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permSub}>We use the camera only when scanning QR codes and barcodes. No footage is stored.</Text>
          {permission.canAskAgain ? (
            <Pressable testID="qr-request-perm" onPress={requestPermission} style={styles.permBtn}>
              <Text style={styles.permBtnText}>Allow camera</Text>
            </Pressable>
          ) : (
            <Pressable testID="qr-open-settings" onPress={() => Linking.openSettings()} style={styles.permBtn}>
              <Text style={styles.permBtnText}>Open Settings</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="qr-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="qr-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>QR Scanner</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <View style={styles.cameraWrap}>
        {scanning ? (
          <CameraView
            testID="qr-camera-view"
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={onBarcode}
            barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "upc_e", "upc_a", "code128", "code39", "pdf417"] }}
          />
        ) : null}
        <View style={styles.reticle} pointerEvents="none">
          <View style={styles.reticleCorner} />
        </View>
        <Text style={styles.hint}>{scanning ? "Point camera at a QR / barcode" : "Result below"}</Text>
      </View>

      {current ? (
        <View style={styles.result} testID="qr-result-card">
          <View style={styles.resultHead}>
            <View style={styles.typeBadge}><Text style={styles.typeText}>{current.type.toUpperCase()}</Text></View>
            <Pressable onPress={resume} testID="qr-resume"><Text style={styles.link}>Scan again</Text></Pressable>
          </View>
          <Text style={styles.resultText} selectable numberOfLines={3}>{current.value}</Text>
          {(current.type === "url" || current.type === "email" || current.type === "phone") ? (
            <Pressable testID="qr-open" onPress={() => openUrl(current.value)} style={styles.openBtn}>
              <Ionicons name="open-outline" size={16} color={colors.onBrandPrimary} />
              <Text style={styles.openText}>Open</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <FlatList
        data={history}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + 20 }}
        ListHeaderComponent={history.length ? <Text style={styles.historyLabel}>History</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.histRow} testID={`qr-hist-${item.id}`}>
            <View style={styles.histIcon}>
              <Ionicons name="qr-code" size={16} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.histVal} numberOfLines={1}>{item.value}</Text>
              <Text style={styles.histType}>{item.type} · {new Date(item.created_at).toLocaleString()}</Text>
            </View>
            <Pressable onPress={() => del(item.id)} hitSlop={8} testID={`qr-del-${item.id}`}>
              <Ionicons name="trash-outline" size={16} color={colors.onSurfaceTertiary} />
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  cameraWrap: {
    marginHorizontal: spacing.lg,
    height: 320, borderRadius: radius.xl, overflow: "hidden",
    backgroundColor: "#000",
    justifyContent: "flex-end", alignItems: "center", paddingBottom: spacing.md,
  },
  reticle: {
    position: "absolute",
    top: 60, left: 60, right: 60, bottom: 80,
    borderWidth: 2, borderColor: colors.brandPrimary, borderRadius: radius.lg,
    opacity: 0.9,
  },
  reticleCorner: {},
  hint: { color: colors.onSurface, fontSize: fontSize.sm, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  permWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  permIcon: { width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  permTitle: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginTop: spacing.md },
  permSub: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, textAlign: "center", paddingHorizontal: spacing.md },
  permBtn: { marginTop: spacing.lg, height: 52, paddingHorizontal: spacing.xxl, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  permBtnText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.lg },
  result: { margin: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brandTertiary, gap: spacing.sm },
  resultHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typeBadge: { paddingHorizontal: spacing.sm, height: 22, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, justifyContent: "center" },
  typeText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  link: { color: colors.brandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  resultText: { color: colors.onSurface, fontSize: fontSize.base, lineHeight: 22 },
  openBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, marginTop: spacing.xs },
  openText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  historyLabel: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.sm },
  histRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  histIcon: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  histVal: { color: colors.onSurface, fontSize: fontSize.base },
  histType: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
});
