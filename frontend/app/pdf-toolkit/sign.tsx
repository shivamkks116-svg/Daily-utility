import { withPremiumGate } from "@/src/components/PremiumToolGate";
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Alert, Pressable, ActivityIndicator, PanResponder, Image, TextInput,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useFonts } from "expo-font";
import Svg, { Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { ToolkitHeader, PrimaryButton, SecondaryButton, EmptyState } from "@/src/components/toolkit/Primitives";
import { pickPdfs, humanBytes, type PickedPdf } from "@/src/utils/pdf/helpers";
import { signPdf, readPdfBase64 } from "@/src/utils/pdf";
import { api } from "@/src/api/client";
import { addRecent } from "@/src/utils/toolkit/recents";
import { deleteSignature, listSavedSignatures, saveSignature } from "@/src/utils/pdf/savedSignatures";

type Mode = "draw" | "type" | "upload";
const PAD_H = 160;
const INK = "#111842";
const FONTS = [
  { key: "greatvibes", family: "GreatVibes", label: "Elegant" },
  { key: "dancing", family: "DancingScript", label: "Casual" },
] as const;

function SignPdfScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    GreatVibes: require("../../assets/fonts/GreatVibes-Regular.ttf"),
    DancingScript: require("../../assets/fonts/DancingScript.ttf"),
  });
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [mode, setMode] = useState<Mode>("draw");
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const curRef = useRef("");
  const [typed, setTyped] = useState("");
  const [font, setFont] = useState<(typeof FONTS)[number]["key"]>("greatvibes");
  const [uploadedUri, setUploadedUri] = useState<string | null>(null);
  const [scrollOn, setScrollOn] = useState(true);
  const padRef = useRef<View>(null);

  // Placement step
  const [sigB64, setSigB64] = useState<string | null>(null);
  const [sigAspect, setSigAspect] = useState(0.4);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [preview, setPreview] = useState<{ b64: string; w: number; h: number } | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [pos, setPos] = useState({ x: 0.6, y: 0.82 }); // fraction of page
  const [widthFrac, setWidthFrac] = useState(0.3);
  const posRef = useRef(pos);
  posRef.current = pos;
  const boxRef = useRef(box);
  boxRef.current = box;
  const dragStart = useRef({ x: 0, y: 0 });

  const [busy, setBusy] = useState<string | null>(null);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    listSavedSignatures().then(setSaved).catch(() => {});
  }, []);

  const applySaved = (b64: string) => {
    Image.getSize(`data:image/png;base64,${b64}`, (w, h) => setSigAspect(h / Math.max(1, w)), () => {});
    setSigB64(b64);
    setResultUri(null);
    saveSignature(b64).then(setSaved).catch(() => {});
  };

  const removeSaved = (b64: string) => {
    Alert.alert("Delete saved signature?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { deleteSignature(b64).then(setSaved).catch(() => {}); } },
    ]);
  };

  const drawPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        setScrollOn(false);
        const { locationX, locationY } = e.nativeEvent;
        curRef.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setCurrentPath(curRef.current);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        curRef.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setCurrentPath(curRef.current);
      },
      onPanResponderRelease: () => {
        const d = curRef.current;
        if (d) setPaths((prev) => [...prev, d]);
        curRef.current = "";
        setCurrentPath("");
        setScrollOn(true);
      },
      onPanResponderTerminate: () => setScrollOn(true),
    }),
  ).current;

  const dragPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setScrollOn(false);
        dragStart.current = { ...posRef.current };
      },
      onPanResponderMove: (_e, g) => {
        const { w, h } = boxRef.current;
        if (!w || !h) return;
        setPos({
          x: Math.min(0.98, Math.max(0, dragStart.current.x + g.dx / w)),
          y: Math.min(0.98, Math.max(0, dragStart.current.y + g.dy / h)),
        });
      },
      onPanResponderRelease: () => setScrollOn(true),
      onPanResponderTerminate: () => setScrollOn(true),
    }),
  ).current;

  const pickPdf = async () => {
    try {
      const [picked] = await pickPdfs({ multiple: false });
      if (picked) {
        setFile(picked);
        setResultUri(null);
        setSigB64(null);
        setPreview(null);
        setPage(1);
      }
    } catch (e: unknown) {
      Alert.alert("Pick failed", (e as Error)?.message || String(e));
    }
  };

  const pickImage = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, legacy: false });
      if (!r.canceled && r.assets?.[0]) setUploadedUri(r.assets[0].uri);
    } catch (e: unknown) {
      Alert.alert("Image pick failed", (e as Error)?.message || String(e));
    }
  };

  const loadPreview = async (p: number) => {
    if (!file) return;
    setBusy("Loading page…");
    try {
      const file_base64 = await readPdfBase64(file.uri);
      const r = await api<{ image_base64: string; width: number; height: number; page_count: number }>(
        "/pdf/page-preview", { method: "POST", body: { file_base64, page: p } },
      );
      setPreview({ b64: r.image_base64, w: r.width, h: r.height });
      setPageCount(r.page_count);
    } catch (e: unknown) {
      Alert.alert("Preview failed", (e as Error)?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (sigB64) void loadPreview(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sigB64 !== null]);

  /** Step 1 → 2: turn the drawn / typed / uploaded signature into a PNG. */
  const continueToPlace = async () => {
    setBusy("Preparing signature…");
    try {
      let b64: string;
      if (mode === "upload") {
        if (!uploadedUri) throw new Error("Upload a signature image first.");
        b64 = await FileSystem.readAsStringAsync(uploadedUri, { encoding: FileSystem.EncodingType.Base64 });
      } else if (mode === "type") {
        if (!typed.trim()) throw new Error("Type your name first.");
        const r = await api<{ png_base64: string }>("/signature/render", { method: "POST", body: { text: typed.trim(), font } });
        b64 = r.png_base64;
      } else {
        if (paths.length === 0) throw new Error("Draw your signature first.");
        b64 = await captureRef(padRef, { format: "png", quality: 1, result: "base64" });
      }
      Image.getSize(`data:image/png;base64,${b64}`, (w, h) => setSigAspect(h / Math.max(1, w)), () => {});
      setSigB64(b64);
      setResultUri(null);
      saveSignature(b64).then(setSaved).catch(() => {});
    } catch (e: unknown) {
      Alert.alert("Signature", (e as Error)?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    if (!file || !sigB64) return;
    setBusy("Signing PDF…");
    try {
      const out = await signPdf(file.uri, sigB64, {
        page,
        xPct: pos.x * 100,
        yPct: pos.y * 100,
        widthPct: widthFrac * 100,
      });
      setResultUri(out);
      await addRecent({ kind: "pdf", uri: out, name: file.name.replace(/\.pdf$/i, "-signed.pdf"), size: 0, tool: "Sign PDF" });
    } catch (e: unknown) {
      Alert.alert("Sign failed", (e as Error)?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    if (!resultUri) return;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(resultUri, { mimeType: "application/pdf", dialogTitle: "Share signed PDF" });
    }
  };

  const openResult = () => {
    if (!resultUri || !file) return;
    router.push({
      pathname: "/pdf-toolkit/reader",
      params: { sharedUri: resultUri, sharedName: file.name.replace(/\.pdf$/i, "-signed.pdf"), sharedSize: "0" },
    });
  };

  const onBoxLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const fontFamily = FONTS.find((f) => f.key === font)!.family;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader
        title="Sign PDF"
        subtitle={sigB64 ? "Drag the signature to where it belongs" : "Draw, type or upload your signature"}
        onBack={() => (sigB64 ? setSigB64(null) : router.back())}
      />
      <ScrollView
        scrollEnabled={scrollOn}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }}
      >
        {!file ? (
          <EmptyState
            icon="create-outline"
            title="Pick a PDF to sign"
            subtitle="Then draw, type or upload your signature and drag it into place."
            action={<PrimaryButton icon="folder-open" label="Choose PDF" onPress={pickPdf} />}
          />
        ) : !sigB64 ? (
          <>
            <View style={styles.card}>
              <Ionicons name="document" size={22} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.meta}>{humanBytes(file.size)}</Text>
              </View>
              <Pressable onPress={pickPdf} hitSlop={10}><Ionicons name="swap-horizontal" size={20} color={colors.onSurfaceTertiary} /></Pressable>
            </View>

            {saved.length ? (
              <>
                <Text style={styles.sectionLabel}>Saved signatures · tap to use</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                  {saved.map((b64, i) => (
                    <Pressable
                      key={i}
                      testID={`saved-signature-${i}`}
                      onPress={() => applySaved(b64)}
                      onLongPress={() => removeSaved(b64)}
                      style={styles.savedChip}
                    >
                      <Image source={{ uri: `data:image/png;base64,${b64}` }} style={styles.savedImg} resizeMode="contain" />
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.meta}>Long-press to delete. Or create a new one below.</Text>
              </>
            ) : null}

            <View style={styles.segment}>
              {(["draw", "type", "upload"] as const).map((m) => (
                <Pressable key={m} onPress={() => setMode(m)} style={[styles.segmentBtn, mode === m && styles.segmentBtnActive]} testID={`sign-mode-${m}`}>
                  <Ionicons
                    name={m === "draw" ? "brush" : m === "type" ? "text" : "cloud-upload"}
                    size={14}
                    color={mode === m ? colors.onBrandPrimary : colors.onSurfaceSecondary}
                  />
                  <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                    {m === "draw" ? "Draw" : m === "type" ? "Type" : "Upload"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {mode === "draw" ? (
              <View style={styles.padCard}>
                {/* Transparent capture view so the signature has no white box. */}
                <View ref={padRef} collapsable={false} style={styles.pad} {...drawPan.panHandlers}>
                  <Svg width="100%" height={PAD_H}>
                    {paths.map((d, i) => (
                      <Path key={i} d={d} stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                    {currentPath ? <Path d={currentPath} stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
                  </Svg>
                  {paths.length === 0 && !currentPath ? <Text style={styles.padHint} pointerEvents="none">Sign here with your finger</Text> : null}
                </View>
                <View style={styles.padLine} pointerEvents="none" />
                <Pressable onPress={() => { setPaths([]); setCurrentPath(""); }} style={styles.clearBtn}>
                  <Ionicons name="refresh" size={14} color={colors.onSurface} />
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              </View>
            ) : mode === "type" ? (
              <View style={styles.padCard}>
                <TextInput
                  testID="sign-type-input"
                  value={typed}
                  onChangeText={setTyped}
                  placeholder="Type your full name"
                  placeholderTextColor={colors.onSurfaceTertiary}
                  maxLength={60}
                  style={styles.typeInput}
                />
                <View style={styles.typePreview}>
                  <Text style={[styles.typePreviewText, fontsLoaded && { fontFamily }]} numberOfLines={1} adjustsFontSizeToFit>
                    {typed || "Your Name"}
                  </Text>
                </View>
                <View style={[styles.segment, { marginTop: spacing.sm }]}>
                  {FONTS.map((f) => (
                    <Pressable key={f.key} onPress={() => setFont(f.key)} style={[styles.segmentBtn, font === f.key && styles.segmentBtnActive]}>
                      <Text style={[styles.segmentText, font === f.key && styles.segmentTextActive, fontsLoaded && { fontFamily: f.family, fontSize: 18 }]}>
                        {f.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.padCard}>
                {uploadedUri ? (
                  <Image source={{ uri: uploadedUri }} style={styles.uploadPreview} resizeMode="contain" />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Ionicons name="image" size={26} color={colors.onSurfaceTertiary} />
                    <Text style={styles.uploadHint}>Sign on white paper and take a photo. The paper background is removed automatically.</Text>
                  </View>
                )}
                <SecondaryButton icon="cloud-upload" label={uploadedUri ? "Change image" : "Choose signature image"} onPress={pickImage} />
              </View>
            )}

            <View style={{ marginTop: spacing.lg }}>
              <PrimaryButton icon="arrow-forward" label="Next: place on page" onPress={continueToPlace} disabled={!!busy} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.pageRow}>
              <Pressable disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))} style={[styles.pageBtn, page <= 1 && { opacity: 0.4 }]}>
                <Ionicons name="chevron-back" size={18} color={colors.onSurface} />
              </Pressable>
              <Text style={styles.pageValue}>Page {page} / {pageCount}</Text>
              <Pressable disabled={page >= pageCount} onPress={() => setPage((p) => Math.min(pageCount, p + 1))} style={[styles.pageBtn, page >= pageCount && { opacity: 0.4 }]}>
                <Ionicons name="chevron-forward" size={18} color={colors.onSurface} />
              </Pressable>
            </View>

            {preview ? (
              <View
                testID="sign-page-preview"
                onLayout={onBoxLayout}
                style={[styles.pageBox, { aspectRatio: preview.w / preview.h }]}
              >
                <Image source={{ uri: `data:image/jpeg;base64,${preview.b64}` }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                {box.w ? (
                  <View
                    testID="sign-drag-handle"
                    {...dragPan.panHandlers}
                    style={[
                      styles.sigOverlay,
                      { left: pos.x * box.w, top: pos.y * box.h, width: widthFrac * box.w, height: widthFrac * box.w * sigAspect },
                    ]}
                  >
                    <Image source={{ uri: `data:image/png;base64,${sigB64}` }} style={styles.sigImg} resizeMode="contain" />
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={[styles.pageBox, styles.center]}><ActivityIndicator color={colors.brandPrimary} /></View>
            )}

            <Text style={styles.sectionLabel}>Signature size</Text>
            <View style={styles.pageRow}>
              <Pressable onPress={() => setWidthFrac((w) => Math.max(0.1, +(w - 0.05).toFixed(2)))} style={styles.pageBtn}>
                <Ionicons name="remove" size={18} color={colors.onSurface} />
              </Pressable>
              <Text style={styles.pageValue}>{Math.round(widthFrac * 100)}%</Text>
              <Pressable onPress={() => setWidthFrac((w) => Math.min(0.8, +(w + 0.05).toFixed(2)))} style={styles.pageBtn}>
                <Ionicons name="add" size={18} color={colors.onSurface} />
              </Pressable>
            </View>

            {resultUri ? (
              <View style={styles.resultCard}>
                <Ionicons name="checkmark-circle" size={22} color={colors.brandPrimary} />
                <Text style={styles.resultTitle}>Signed PDF ready</Text>
              </View>
            ) : null}

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              {resultUri ? <PrimaryButton icon="eye" label="Open & check signed PDF" onPress={openResult} /> : null}
              {resultUri ? <SecondaryButton icon="share-outline" label="Share signed PDF" onPress={share} /> : null}
              {resultUri ? (
                <SecondaryButton icon="create" label="Sign again" onPress={apply} disabled={!!busy} />
              ) : (
                <PrimaryButton icon="checkmark" label="Apply signature" onPress={apply} disabled={!!busy} />
              )}
              <SecondaryButton icon="brush" label="Change signature" onPress={() => setSigB64(null)} />
            </View>
          </>
        )}
      </ScrollView>
      {busy ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.overlayText}>{busy}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginTop: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  name: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  segment: {
    flexDirection: "row", gap: 4, padding: 4, marginTop: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  segmentBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, minHeight: 40, borderRadius: radius.sm },
  segmentBtnActive: { backgroundColor: colors.brandPrimary },
  segmentText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  segmentTextActive: { color: colors.onBrandPrimary },
  padCard: {
    marginTop: spacing.md, padding: spacing.md, gap: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  pad: { height: PAD_H, borderRadius: radius.sm, backgroundColor: "transparent", overflow: "hidden" },
  padHint: { position: "absolute", alignSelf: "center", top: PAD_H / 2 - 10, color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  padLine: { height: 1, backgroundColor: colors.borderStrong, marginTop: -40, marginHorizontal: spacing.lg, marginBottom: 32 },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", minHeight: 36, paddingHorizontal: spacing.md },
  clearText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  typeInput: {
    minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.sm, color: colors.onSurface, fontSize: fontSize.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  typePreview: { height: 90, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: radius.sm },
  typePreviewText: { color: INK, fontSize: 44, paddingHorizontal: spacing.md },
  uploadPreview: { width: "100%", height: 140, backgroundColor: "#FFFFFF", borderRadius: radius.sm },
  uploadPlaceholder: { height: 140, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  uploadHint: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, textAlign: "center" },
  sectionLabel: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginTop: spacing.lg, marginBottom: spacing.sm },
  pageRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg, marginTop: spacing.md },
  pageBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  pageValue: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold, minWidth: 90, textAlign: "center" },
  pageBox: {
    width: "100%", minHeight: 200, marginTop: spacing.md, backgroundColor: "#FFFFFF",
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  sigOverlay: { position: "absolute", borderWidth: 1, borderStyle: "dashed", borderColor: colors.brandPrimary },
  sigImg: { width: "100%", height: "100%" },
  resultCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg, padding: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.surfaceSecondary,
  },
  resultTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  savedChip: {
    width: 120, height: 60, borderRadius: radius.sm, padding: 6, backgroundColor: "#FFFFFF",
    borderWidth: 1, borderColor: colors.border,
  },
  savedImg: { width: "100%", height: "100%" },
  overlay: {
    ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.surface + "CC",
  },
  overlayText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});

export default withPremiumGate(SignPdfScreen, "Sign PDF");
