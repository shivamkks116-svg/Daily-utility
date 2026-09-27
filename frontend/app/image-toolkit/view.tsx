/**
 * Shared-image viewer.
 *
 * Landing screen for images that arrive via an Android SEND intent
 * (WhatsApp, Drive, Photos…). Shows a large preview + quick actions
 * (Share, Save to gallery, Compress-and-share, Open editor).
 *
 * Users can jump into any Image Toolkit tool from here; the shared URI
 * stays available via app-private cache until the tool completes.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Pressable,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";

import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import {
  ToolkitHeader,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  ProgressBanner,
} from "@/src/components/toolkit/Primitives";
import { humanBytes } from "@/src/utils/pdf/helpers";
import { shareImage, trackImageResult } from "@/src/utils/image/helpers";
import { compressImage, getSize } from "@/src/utils/image";

type IconName = keyof typeof Ionicons.glyphMap;

export default function SharedImageViewer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    sharedUri?: string;
    sharedName?: string;
    sharedSize?: string;
  }>();

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const uri = params.sharedUri ? String(params.sharedUri) : null;
  const name = params.sharedName ? String(params.sharedName) : "Shared image";
  const size = params.sharedSize ? Number(params.sharedSize) : 0;

  const previewWidth = useMemo(
    () => Dimensions.get("window").width - spacing.lg * 2,
    [],
  );

  useEffect(() => {
    if (!uri) return;
    Image.getSize(
      uri,
      (w, h) => setNatural({ w, h }),
      () => setNatural(null),
    );
  }, [uri]);

  if (!uri) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ToolkitHeader
          title="Shared Image"
          subtitle="Nothing shared yet"
          onBack={() => router.back()}
        />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <EmptyState
            icon="image-outline"
            title="No image received"
            subtitle="Share an image from another app to open it here."
            action={
              <PrimaryButton
                icon="images"
                label="Open Image Toolkit"
                onPress={() => router.replace("/image-toolkit")}
              />
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  const share = async () => {
    setStatus("Preparing…");
    try {
      await shareImage(uri, `Share ${name}`);
      setStatus("");
    } catch (e) {
      setStatus("");
      Alert.alert("Share failed", (e as Error)?.message || "Unknown error");
    }
  };

  const saveToGallery = async () => {
    setBusy(true);
    setStatus("Saving to gallery…");
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.status !== "granted") {
        setStatus("");
        Alert.alert(
          "Permission required",
          "Please allow Photos access from Settings to save images.",
        );
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      setStatus("Saved to gallery");
    } catch (e) {
      setStatus("");
      Alert.alert("Save failed", (e as Error)?.message || "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const compressAndShare = async () => {
    setBusy(true);
    setStatus("Compressing…");
    try {
      const outUri = await compressImage(uri, "medium");
      const outSize = await getSize(outUri);
      await trackImageResult(outUri, `Compressed-${name}`, "Compress (shared)", outSize);
      setStatus(`Compressed to ${humanBytes(outSize)}`);
      await shareImage(outUri, "Share compressed image");
    } catch (e) {
      setStatus("");
      Alert.alert("Compress failed", (e as Error)?.message || "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const copyToDownloadsAndOpenToolkit = async () => {
    // Persist a stable copy under app documents so tool screens can re-open it.
    try {
      const target = `${FileSystem.documentDirectory}shared-${Date.now()}-${name}`;
      await FileSystem.copyAsync({ from: uri, to: target });
      router.replace("/image-toolkit");
    } catch {
      router.replace("/image-toolkit");
    }
  };

  const aspect = natural ? natural.w / natural.h : 1;
  const previewHeight = Math.min(
    previewWidth / (aspect || 1),
    Dimensions.get("window").height * 0.5,
  );

  const tools: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: "share-social", label: "Share", onPress: share },
    { icon: "save-outline", label: "Save", onPress: saveToGallery },
    { icon: "leaf", label: "Compress & Share", onPress: compressAndShare },
    { icon: "grid-outline", label: "Image Toolkit", onPress: copyToDownloadsAndOpenToolkit },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ToolkitHeader
        title="Shared Image"
        subtitle={name}
        onBack={() => router.replace("/(main)/home")}
      />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing.xxxl,
          paddingHorizontal: spacing.lg,
        }}
      >
        {status ? <ProgressBanner label={status} done={!busy && !!status} /> : null}

        <View style={[styles.previewWrap, { width: previewWidth, height: previewHeight }]}>
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.metaBytes}>
            {natural ? `${natural.w}×${natural.h} · ` : ""}
            {humanBytes(size)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.grid}>
          {tools.map((t) => (
            <Pressable
              key={t.label}
              onPress={t.onPress}
              disabled={busy}
              style={({ pressed }) => [
                styles.tile,
                pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] },
                busy && { opacity: 0.6 },
              ]}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={t.icon} size={22} color={colors.brandPrimary} />
              </View>
              <Text style={styles.tileLabel}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <SecondaryButton
            icon="close-circle-outline"
            label="Cancel"
            onPress={() => router.replace("/(main)/home")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  previewWrap: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    gap: spacing.md,
  },
  metaName: {
    color: colors.onSurface,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    flex: 1,
  },
  metaBytes: {
    color: colors.onSurfaceTertiary,
    fontSize: fontSize.xs,
  },
  sectionTitle: {
    color: colors.onSurface,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  tile: {
    width: "47%",
    aspectRatio: 1.5,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    color: colors.onSurface,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
});
