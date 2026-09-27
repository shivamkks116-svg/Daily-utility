/**
 * Cross-cutting helpers used by every PDF Toolkit screen.
 */
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

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
 *
 * Robust against Android providers that return non-PDF mimeTypes (some
 * file managers report `application/octet-stream` for perfectly valid PDFs).
 * Falls back to accepting any file whose name ends with `.pdf`.
 */
export async function pickPdfs(opts: { multiple?: boolean } = {}): Promise<PickedPdf[]> {
  let res: DocumentPicker.DocumentPickerResult;
  try {
    res = await DocumentPicker.getDocumentAsync({
      // Broader type accepts providers that misreport PDFs as octet-stream.
      // We enforce ".pdf" extension in the filter below.
      type: Platform.OS === "android" ? ["application/pdf", "application/octet-stream", "*/*"] : "application/pdf",
      multiple: !!opts.multiple,
      copyToCacheDirectory: true,
    });
  } catch (e) {
    const msg = (e as { message?: string })?.message || String(e);
    Alert.alert(
      "Couldn't open the file picker",
      `${msg}\n\nTry: 1) Grant storage permission in Settings → Apps → DailyHub AI.\n2) Update Files by Google.\n3) Restart the app.`,
    );
    return [];
  }
  if (res.canceled) return [];
  const rawAssets = res.assets || [];

  // Filter: require .pdf extension OR real pdf mime.
  const assets = rawAssets.filter((a) => {
    const name = (a.name || "").toLowerCase();
    const mime = (a.mimeType || "").toLowerCase();
    return name.endsWith(".pdf") || mime === "application/pdf" || mime === "application/x-pdf";
  });

  if (assets.length === 0 && rawAssets.length > 0) {
    Alert.alert("Not a PDF", "The file you picked isn't a PDF. Please choose a file ending in .pdf.");
    return [];
  }

  await ensureWorkDir();
  const out: PickedPdf[] = [];
  for (const a of assets) {
    const name = a.name || `document-${Date.now()}.pdf`;
    const safeName = name.replace(/[^\w.-]/g, "_");
    const dest = WORK_DIR + `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeName}`;
    try {
      await FileSystem.copyAsync({ from: a.uri, to: dest });
      const info = await FileSystem.getInfoAsync(dest, { size: true });
      out.push({ uri: dest, name, size: (info as { size?: number }).size || a.size || 0 });
    } catch (copyErr) {
      // Fallback: some providers return read-only URIs that copy fails on.
      // Return the original URI so caller can still read via SAF.
      console.warn("[pickPdfs] copy failed, using original URI:", copyErr);
      out.push({ uri: a.uri, name, size: a.size || 0 });
    }
  }
  return out;
}

/** Copy an external file:// or content:// PDF URI into the app-private cache
 *  and return a PickedPdf. Used by the shared-intent handler. */
export async function importPdfFromUri(uri: string, hintName?: string): Promise<PickedPdf | null> {
  try {
    await ensureWorkDir();
    const name = hintName || `shared-${Date.now()}.pdf`;
    const safeName = name.replace(/[^\w.-]/g, "_").replace(/(?<!\.pdf)$/i, "");
    const dest = WORK_DIR + `${Date.now()}-${safeName}${safeName.toLowerCase().endsWith(".pdf") ? "" : ".pdf"}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    const info = await FileSystem.getInfoAsync(dest, { size: true });
    return { uri: dest, name, size: (info as { size?: number }).size || 0 };
  } catch (e) {
    console.warn("[importPdfFromUri] failed:", e);
    return null;
  }
}

export async function sharePdf(uri: string, dialogTitle = "Share PDF") {
  try {
    const ok = await Sharing.isAvailableAsync();
    if (!ok) {
      Alert.alert("Sharing unavailable", "Your device does not support the share sheet.");
      return;
    }
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle, UTI: "com.adobe.pdf" });
  } catch (e) {
    const msg = (e as { message?: string })?.message || "Unknown error";
    Alert.alert("Could not share", msg);
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
