import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { addRecent } from "@/src/utils/toolkit/recents";

export type PickedImg = { uri: string; width: number; height: number; size: number; name: string };

/**
 * Ensure we have the right permission to launch the image library.
 *
 * On **Android 13+** `expo-image-picker` (v15+) delegates to the system
 * Photo Picker by default (`legacy: false`), which handles per-file
 * consent inline — no `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`
 * permission is needed, and Google Play policy actually forbids
 * requesting those broad permissions when the system picker is
 * sufficient. So we skip the check entirely on Android.
 *
 * On **iOS** we still need the user to approve "Photo Library" access
 * (full or limited) because iOS doesn't have an equivalent zero-perm
 * picker API — `requestMediaLibraryPermissionsAsync` triggers the
 * native prompt and respects the "Selected Photos" partial access mode.
 */
async function ensureLibraryPermission(): Promise<boolean> {
  if (Platform.OS === "android") return true;
  if (Platform.OS !== "ios") return true; // web / other → trust the browser prompt

  const { status, canAskAgain } = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (status === "granted" || status === "limited") return true;
  if (!canAskAgain) {
    Alert.alert(
      "Permission required",
      "Please enable Photos permission from Settings to pick images.",
    );
    return false;
  }
  const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return res.status === "granted" || res.status === "limited";
}

export async function pickSingleImage(): Promise<PickedImg | null> {
  const ok = await ensureLibraryPermission();
  if (!ok) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    quality: 1,
    // Explicit: use the Android 13+ system Photo Picker, not the legacy
    // storage-permission flow. This also enables the clean per-file
    // consent UI on Android 14+.
    legacy: false,
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
