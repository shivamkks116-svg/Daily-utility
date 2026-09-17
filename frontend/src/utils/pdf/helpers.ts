/**
 * Cross-cutting helpers used by every PDF Toolkit screen.
 */
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

const WORK_DIR = FileSystem.cacheDirectory + "dailyhub-pdf-inbox/";

async function ensureWorkDir() {
  const info = await FileSystem.getInfoAsync(WORK_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(WORK_DIR, { intermediates: true });
  }
}

export type PickedPdf = { uri: string; name: string; size: number };

/**
 * Pick one or more PDFs using the system Storage Access Framework so we don't
 * require broad READ_EXTERNAL_STORAGE. Files are copied to app-private cache
 * to keep operations reliable even if the user later deletes the source.
 */
export async function pickPdfs(opts: { multiple?: boolean } = {}): Promise<PickedPdf[]> {
  const res = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    multiple: !!opts.multiple,
    copyToCacheDirectory: true,
  });
  if (res.canceled) return [];
  const assets = res.assets || [];
  await ensureWorkDir();
  const out: PickedPdf[] = [];
  for (const a of assets) {
    const name = a.name || `document-${Date.now()}.pdf`;
    const dest = WORK_DIR + `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${name.replace(/[^\w.-]/g, "_")}`;
    try {
      await FileSystem.copyAsync({ from: a.uri, to: dest });
      const info = await FileSystem.getInfoAsync(dest, { size: true });
      out.push({ uri: dest, name, size: (info as any).size || a.size || 0 });
    } catch {
      out.push({ uri: a.uri, name, size: a.size || 0 });
    }
  }
  return out;
}

export async function sharePdf(uri: string, dialogTitle = "Share PDF") {
  try {
    const ok = await Sharing.isAvailableAsync();
    if (!ok) {
      Alert.alert("Sharing unavailable", "Your device does not support the share sheet.");
      return;
    }
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle, UTI: "com.adobe.pdf" });
  } catch (e: any) {
    Alert.alert("Could not share", e?.message || "Unknown error");
  }
}

export function humanBytes(n: number = 0): string {
  if (!n) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}
