import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Pressable,
  ActivityIndicator,
  PanResponder,
  Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import Svg, { Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import {
  ToolkitHeader,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  ProgressBanner,
} from "@/src/components/toolkit/Primitives";
import { pickPdfs, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { signPdf } from "@/src/utils/pdf";
import { addRecent } from "@/src/utils/toolkit/recents";

type Mode = "draw" | "upload";
type Pos = "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br";

const PAD_W = 320;
const PAD_H = 140;

const POS_LABELS: { key: Pos; label: string; x: number; y: number }[] = [
  { key: "tl", label: "Top L", x: 5, y: 5 },
  { key: "tc", label: "Top C", x: 37, y: 5 },
  { key: "tr", label: "Top R", x: 70, y: 5 },
  { key: "ml", label: "Mid L", x: 5, y: 45 },
  { key: "mc", label: "Mid C", x: 37, y: 45 },
  { key: "mr", label: "Mid R", x: 70, y: 45 },
  { key: "bl", label: "Bot L", x: 5, y: 80 },
  { key: "bc", label: "Bot C", x: 37, y: 80 },
  { key: "br", label: "Bot R", x: 70, y: 80 },
];

export default function SignPdfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [mode, setMode] = useState<Mode>("draw");
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [uploadedUri, setUploadedUri] = useState<string | null>(null);
  const [page, setPage] = useState("1");
  const [pos, setPos] = useState<Pos>("br");
  const [widthPct, setWidthPct] = useState(25);
  const [busy, setBusy] = useState(false);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const padRef = useRef<View>(null);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        setCurrentPath(`M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        setCurrentPath((prev) => `${prev} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
      },
      onPanResponderRelease: () => {
        setPaths((prev) => (currentPath ? [...prev, currentPath] : prev));
        setCurrentPath("");
      },
    }),
  ).current;

  const clearPad = () => {
    setPaths([]);
    setCurrentPath("");
  };

  const pickPdf = async () => {
    try {
      const [picked] = await pickPdfs({ multiple: false });
      if (picked) {
        setFile(picked);
        setResultUri(null);
      }
    } catch (e: unknown) {
      Alert.alert("Pick failed", (e as Error)?.message || String(e));
    }
  };

  const pickImage = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (!r.canceled && r.assets?.[0]) setUploadedUri(r.assets[0].uri);
    } catch (e: unknown) {
      Alert.alert("Image pick failed", (e as Error)?.message || String(e));
    }
  };

  const captureSignature = async (): Promise<string> => {
    if (mode === "upload") {
      if (!uploadedUri) throw new Error("Upload a signature image first.");
      const b64 = await FileSystem.readAsStringAsync(uploadedUri, {
        encoding: "base64",
      });
      return b64;
    }
    if (paths.length === 0) throw new Error("Draw your signature first.");
    if (!padRef.current) throw new Error("Signature pad not ready.");
    const uri = await captureRef(padRef, {
      format: "png",
      quality: 1,
      result: "base64",
    });
    return uri;
  };

  const apply = async () => {
    if (!file) return;
    const p = parseInt(page, 10);
    if (!p || p < 1) {
      Alert.alert("Invalid page", "Enter a page number ≥ 1.");
      return;
    }
    setBusy(true);
    try {
      const sig = await captureSignature();
      const posSpec = POS_LABELS.find((x) => x.key === pos)!;
      const out = await signPdf(file.uri, sig, {
        page: p,
        xPct: posSpec.x,
        yPct: posSpec.y,
        widthPct,
      });
      setResultUri(out);
      await addRecent({
        kind: "pdf",
        uri: out,
        name: file.name.replace(/\.pdf$/i, "-signed.pdf"),
        size: 0,
        tool: "Sign PDF",
      });
    } catch (e: unknown) {
      Alert.alert("Sign failed", (e as Error)?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!resultUri) return;
    try {
      const ok = await Sharing.isAvailableAsync();
      if (ok) await Sharing.shareAsync(resultUri, { mimeType: "application/pdf", dialogTitle: "Share signed PDF" });
    } catch (e: unknown) {
      Alert.alert("Share failed", (e as Error)?.message || String(e));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader title="Sign PDF" subtitle="Draw or upload a signature and stamp it on any page" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }}>
        {!file ? (
          <EmptyState
            icon="create-outline"
            title="Pick a PDF to sign"
            subtitle="You can then draw or upload your signature."
            action={<PrimaryButton icon="folder-open" label="Choose PDF" onPress={pickPdf} />}
          />
        ) : (
          <>
            <View style={styles.card}>
              <Ionicons name="document" size={22} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.meta}>{humanBytes(file.size)}</Text>
              </View>
              <Pressable onPress={pickPdf}><Ionicons name="swap-horizontal" size={20} color={colors.onSurfaceTertiary} /></Pressable>
            </View>

            {/* Mode toggle */}
            <View style={styles.segment}>
              {(["draw", "upload"] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[styles.segmentBtn, mode === m && styles.segmentBtnActive]}
                  testID={`sign-mode-${m}`}
                >
                  <Ionicons name={m === "draw" ? "brush" : "cloud-upload"} size={14} color={mode === m ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
                  <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>{m === "draw" ? "Draw" : "Upload"}</Text>
                </Pressable>
              ))}
            </View>

            {/* Signature area */}
            {mode === "draw" ? (
              <View style={styles.padCard}>
                <View
                  ref={padRef}
                  collapsable={false}
                  style={styles.pad}
                  {...pan.panHandlers}
                >
                  <Svg width={PAD_W} height={PAD_H} style={{ backgroundColor: "#fff" }}>
                    {paths.map((d, i) => (
                      <Path key={i} d={d} stroke="#111" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                    {currentPath ? (
                      <Path d={currentPath} stroke="#111" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    ) : null}
                  </Svg>
                </View>
                <Pressable onPress={clearPad} style={styles.clearBtn}>
                  <Ionicons name="refresh" size={14} color={colors.onSurface} />
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.uploadCard}>
                {uploadedUri ? (
                  <Image source={{ uri: uploadedUri }} style={styles.uploadPreview} resizeMode="contain" />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Ionicons name="image" size={26} color={colors.onSurfaceTertiary} />
                    <Text style={styles.uploadHint}>Upload a signature PNG (transparent background works best)</Text>
                  </View>
                )}
                <SecondaryButton icon="cloud-upload" label={uploadedUri ? "Change image" : "Choose signature image"} onPress={pickImage} />
              </View>
            )}

            {/* Page number */}
            <Text style={styles.sectionLabel}>Page number</Text>
            <View style={styles.pageInputRow}>
              <Pressable onPress={() => setPage((p) => String(Math.max(1, parseInt(p, 10) - 1)))} style={styles.pageBtn}>
                <Ionicons name="remove" size={18} color={colors.onSurface} />
              </Pressable>
              <Text style={styles.pageValue}>{page}</Text>
              <Pressable onPress={() => setPage((p) => String((parseInt(p, 10) || 0) + 1))} style={styles.pageBtn}>
                <Ionicons name="add" size={18} color={colors.onSurface} />
              </Pressable>
            </View>

            {/* Position picker */}
            <Text style={styles.sectionLabel}>Position on page</Text>
            <View style={styles.grid}>
              {POS_LABELS.map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => setPos(p.key)}
                  style={[styles.posBtn, pos === p.key && styles.posBtnActive]}
                  testID={`sign-pos-${p.key}`}
                >
                  <Text style={[styles.posText, pos === p.key && styles.posTextActive]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Size picker */}
            <Text style={styles.sectionLabel}>Signature width</Text>
            <View style={styles.segment}>
              {[15, 25, 40].map((w) => (
                <Pressable
                  key={w}
                  onPress={() => setWidthPct(w)}
                  style={[styles.segmentBtn, widthPct === w && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentText, widthPct === w && styles.segmentTextActive]}>{w}%</Text>
                </Pressable>
              ))}
            </View>

            {busy ? <ProgressBanner label="Stamping signature onto PDF…" /> : null}

            {resultUri ? (
              <View style={styles.resultCard}>
                <Ionicons name="checkmark-circle" size={22} color={colors.brandPrimary} />
                <Text style={styles.resultTitle}>Signed PDF ready</Text>
              </View>
            ) : null}

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              {resultUri ? <SecondaryButton icon="share-outline" label="Share signed PDF" onPress={share} /> : null}
              <PrimaryButton icon="create" label={resultUri ? "Re-sign" : "Apply signature"} onPress={apply} disabled={busy} />
            </View>
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
  segment: {
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 8, borderRadius: radius.sm },
  segmentBtnActive: { backgroundColor: colors.brandPrimary },
  segmentText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: fontWeight.semibold },
  segmentTextActive: { color: colors.onBrandPrimary },
  padCard: { marginTop: spacing.md, alignItems: "center", gap: spacing.sm },
  pad: { width: PAD_W, height: PAD_H, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  clearText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  uploadCard: { marginTop: spacing.md, gap: spacing.sm },
  uploadPreview: { width: "100%", height: 160, backgroundColor: "#fff", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  uploadPlaceholder: { alignItems: "center", justifyContent: "center", padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  uploadHint: { color: colors.onSurfaceTertiary, fontSize: 11, textAlign: "center" },
  sectionLabel: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: spacing.lg, marginBottom: spacing.xs },
  pageInputRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md },
  pageBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  pageValue: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, minWidth: 60, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  posBtn: { width: "31.5%", paddingVertical: 10, alignItems: "center", borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  posBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  posText: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: fontWeight.semibold },
  posTextActive: { color: colors.onBrandPrimary },
  resultCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandSecondary },
  resultTitle: { color: colors.onBrandTertiary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  overlay: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.15)" },
});
