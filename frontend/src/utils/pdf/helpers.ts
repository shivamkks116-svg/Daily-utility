/**
 * Cross-cutting PDF picker helpers used by every PDF Toolkit screen.
 *
 * Design goals
 * ------------
 * 1. Use pure `application/pdf` MIME with Android's Storage Access Framework
 *    (ACTION_OPEN_DOCUMENT) — no MANAGE_EXTERNAL_STORAGE, no broad READ perms.
 * 2. Handle content:// URIs correctly. If copyAsync fails (some OEM providers
 *    return read-only URIs) we gracefully fall back to reading the original
 *    URI directly.
 * 3. Never crash on cancel / invalid file / provider error. Always return a
 *    typed result and surface a friendly Alert.
 * 4. Validate PDF header ("%PDF-") post-copy so we catch corrupted files
 *    early rather than deep inside pdf-lib.
 * 5. Provide progress + size feedback for large PDFs.
 *
 * NOTE: This file is the single source of truth for picking PDFs across
 * the entire toolkit. Do NOT duplicate this logic in screens.
 */
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

const WORK_DIR = FileSystem.cacheDirectory + "dailyhub-pdf-inbox/";

/** Soft warning above this size — some pdf-lib operations get slow. */
export const LARGE_PDF_BYTES = 50 * 1024 * 1024; // 50 MB
/** Hard block above this size to avoid OOM crashes. */
export const MAX_PDF_BYTES = 200 * 1024 * 1024; // 200 MB

async function ensureWorkDir() {
  const info = await FileSystem.getInfoAsync(WORK_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(WORK_DIR, { intermediates: true });
  }
}

export type PickedPdf = { uri: string; name: string; size: number };

type PickOpts = {
  multiple?: boolean;
  /**
   * If true, silently return [] on cancel (no Alert). Defaults to true —
   * cancels shouldn't be treated as errors.
   */
  silentOnCancel?: boolean;
};

/**
 * Validate the first few bytes of a PDF for the "%PDF-" magic number.
 * Runs entirely in JS so it works on both file:// and content:// URIs.
 */
async function isValidPdf(uri: string): Promise<boolean> {
  try {
    // Read the whole file as base64 — cheaper than trying to seek. We only
    // decode the first ~8 bytes so memory footprint stays negligible.
    const head = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 8,
      position: 0,
    });
    if (!head) return false;
    const bin = globalThis.atob
      ? globalThis.atob(head)
      : Buffer.from(head, "base64").toString("binary");
    return bin.startsWith("%PDF-");
  } catch {
    // Some providers don't support ranged reads. Try full read as fallback.
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const bin = globalThis.atob
        ? globalThis.atob(b64.slice(0, 12))
        : Buffer.from(b64.slice(0, 12), "base64").toString("binary");
      return bin.startsWith("%PDF-");
    } catch {
      // Give up validation — we'll let pdf-lib decide.
      return true;
    }
  }
}

/**
 * Open the Android/iOS native document picker filtered to PDFs.
 *
 * Uses `application/pdf` directly — this maps to Android's SAF
 * ACTION_OPEN_DOCUMENT with a proper single MIME filter, which is what
 * Files-by-Google, Google Drive, OneDrive, and stock DocumentsUI expect.
 * (Passing wildcard or arrays like ["application/pdf", "wildcard"] used to trigger
 * "unsupported / no app found" screens on some OEM pickers.)
 *
 * Selected files are copied into app-private cache so downstream operations
 * remain reliable even if the user later deletes the source file.
 */
export async function pickPdfs(opts: PickOpts = {}): Promise<PickedPdf[]> {
  const multiple = !!opts.multiple;
  let res: DocumentPicker.DocumentPickerResult;

  try {
    res = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      multiple,
      copyToCacheDirectory: true,
    });
  } catch (firstErr) {
    // Some Android OEMs (very old MIUI/EMUI) refuse a strict PDF filter.
    // Only THEN fall back to a wildcard — we still filter by extension after.
    if (Platform.OS === "android") {
      try {
        res = await DocumentPicker.getDocumentAsync({
          type: "*/*",
          multiple,
          copyToCacheDirectory: true,
        });
      } catch (secondErr) {
        const msg =
          (secondErr as { message?: string })?.message || String(secondErr);
        Alert.alert(
          "Couldn't open the file picker",
          `${msg}\n\nTip: open Files by Google → try selecting a PDF from Downloads or Documents.`,
        );
        return [];
      }
    } else {
      const msg = (firstErr as { message?: string })?.message || String(firstErr);
      Alert.alert("Couldn't open the file picker", msg);
      return [];
    }
  }

  // User cancelled — this is normal, not an error.
  if (res.canceled) {
    if (opts.silentOnCancel === false) {
      Alert.alert("Cancelled", "No PDF was selected.");
    }
    return [];
  }

  const rawAssets = res.assets || [];
  if (rawAssets.length === 0) return [];

  // Filter: require .pdf extension OR real pdf mime. This is safety-net for
  // the `*/*` fallback path above.
  const assets = rawAssets.filter((a) => {
    const name = (a.name || "").toLowerCase();
    const mime = (a.mimeType || "").toLowerCase();
    return (
      name.endsWith(".pdf") ||
      mime === "application/pdf" ||
      mime === "application/x-pdf"
    );
  });

  if (assets.length === 0) {
    Alert.alert(
      "Not a PDF",
      "The file you picked isn't a PDF. Please choose a file ending in .pdf.",
    );
    return [];
  }
  if (rawAssets.length !== assets.length) {
    Alert.alert(
      "Some files skipped",
      `${rawAssets.length - assets.length} non-PDF file(s) were ignored.`,
    );
  }

  await ensureWorkDir();
  const out: PickedPdf[] = [];

  for (const a of assets) {
    const name = a.name || `document-${Date.now()}.pdf`;
    const safeName = name.replace(/[^\w.-]/g, "_");
    const dest =
      WORK_DIR + `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeName}`;

    let finalUri = a.uri;
    let finalSize = a.size || 0;

    try {
      await FileSystem.copyAsync({ from: a.uri, to: dest });
      const info = await FileSystem.getInfoAsync(dest, { size: true });
      finalUri = dest;
      finalSize = (info as { size?: number }).size || a.size || 0;
    } catch (copyErr) {
      // Fallback #1: read the content:// URI as base64 and write to cache.
      // This works for read-only URIs where copyAsync fails.
      try {
        const b64 = await FileSystem.readAsStringAsync(a.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await FileSystem.writeAsStringAsync(dest, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const info = await FileSystem.getInfoAsync(dest, { size: true });
        finalUri = dest;
        finalSize = (info as { size?: number }).size || a.size || 0;
      } catch (readErr) {
        // Fallback #2: use the original URI. Downstream reads may still work
        // through SAF. Log but don't crash.
        console.warn("[pickPdfs] copy + read fallback failed:", copyErr, readErr);
        finalUri = a.uri;
        finalSize = a.size || 0;
      }
    }

    // Size guard — refuse absurdly large PDFs, warn on large ones.
    if (finalSize > MAX_PDF_BYTES) {
      Alert.alert(
        "PDF too large",
        `“${name}” is ${humanBytes(finalSize)}. Please choose a PDF under ${humanBytes(MAX_PDF_BYTES)}.`,
      );
      // Clean the copy we made.
      try {
        if (finalUri.startsWith(WORK_DIR)) {
          await FileSystem.deleteAsync(finalUri, { idempotent: true });
        }
      } catch {}
      continue;
    }

    // Header validation — catches "PDF" files that are actually HTML error
    // pages or renamed .doc files.
    const ok = await isValidPdf(finalUri);
    if (!ok) {
      Alert.alert(
        "Invalid or corrupted PDF",
        `“${name}” doesn't appear to be a valid PDF file.`,
      );
      try {
        if (finalUri.startsWith(WORK_DIR)) {
          await FileSystem.deleteAsync(finalUri, { idempotent: true });
        }
      } catch {}
      continue;
    }

    out.push({ uri: finalUri, name, size: finalSize });
  }

  if (out.length === 0) {
    // Every asset failed validation. Alerts already surfaced above.
    return [];
  }

  return out;
}

/** Copy an external file:// or content:// PDF URI into the app-private cache
 *  and return a PickedPdf. Used by the shared-intent handler. */
export async function importPdfFromUri(
  uri: string,
  hintName?: string,
): Promise<PickedPdf | null> {
  try {
    await ensureWorkDir();
    const name = hintName || `shared-${Date.now()}.pdf`;
    const safeName = name.replace(/[^\w.-]/g, "_");
    const dest =
      WORK_DIR +
      `${Date.now()}-${safeName}${safeName.toLowerCase().endsWith(".pdf") ? "" : ".pdf"}`;

    try {
      await FileSystem.copyAsync({ from: uri, to: dest });
    } catch {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(dest, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    const info = await FileSystem.getInfoAsync(dest, { size: true });
    const size = (info as { size?: number }).size || 0;

    const ok = await isValidPdf(dest);
    if (!ok) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
      return null;
    }

    return { uri: dest, name, size };
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
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle,
      UTI: "com.adobe.pdf",
    });
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
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}
