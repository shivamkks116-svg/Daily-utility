import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { addRecent } from "@/src/utils/toolkit/recents";

export type PickedImg = { uri: string; width: number; height: number; size: number; name: string };

async function ensureLibraryPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (status === "granted") return true;
  if (!canAskAgain) {
    Alert.alert(
      "Permission required",
      "Please enable Photos permission from Settings to pick images.",
    );
    return false;
  }
  const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return res.status === "granted";
}

export async function pickSingleImage(): Promise<PickedImg | null> {
  const ok = await ensureLibraryPermission();
  if (!ok) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const info = await FileSystem.getInfoAsync(a.uri, { size: true });
  return {
    uri: a.uri,
    width: a.width || 0,
    height: a.height || 0,
    size: (info as any).size || 0,
    name: a.fileName || `image-${Date.now()}.jpg`,
  };
}

export async function shareImage(uri: string, dialogTitle = "Share image") {
  try {
    const ok = await Sharing.isAvailableAsync();
    if (!ok) { Alert.alert("Sharing unavailable"); return; }
    await Sharing.shareAsync(uri, { mimeType: "image/jpeg", dialogTitle });
  } catch (e: any) {
    Alert.alert("Share failed", e?.message || "Unknown error");
  }
}

export async function trackImageResult(uri: string, name: string, tool: string, size: number) {
  await addRecent({ kind: "image", uri, name, size, tool });
}
