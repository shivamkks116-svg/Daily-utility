/**
 * Download a PDF from a remote URL into app-private cache and return a
 * `PickedPdf`. Validates the `%PDF-` magic header and size limits.
 */
import * as FileSystem from "expo-file-system/legacy";
import type { PickedPdf } from "@/src/utils/pdf/helpers";
import { MAX_PDF_BYTES } from "@/src/utils/pdf/helpers";

const WORK_DIR = FileSystem.cacheDirectory + "dailyhub-pdf-url/";

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(WORK_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(WORK_DIR, { intermediates: true });
  }
}

function guessName(url: string): string {
  try {
    const clean = url.split("?")[0].split("#")[0];
    const raw = decodeURIComponent(clean.split("/").pop() || "");
    if (raw && /\.[a-z0-9]+$/i.test(raw)) return raw;
    return `${raw || "downloaded"}.pdf`;
  } catch {
    return "downloaded.pdf";
  }
}

async function validateHeader(uri: string): Promise<boolean> {
  try {
    const head = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 8,
      position: 0,
    });
    const bin = globalThis.atob
      ? globalThis.atob(head)
      : Buffer.from(head, "base64").toString("binary");
    return bin.startsWith("%PDF-");
  } catch {
    return false;
  }
}

export type ImportFromUrlProgress = (bytes: number, total: number) => void;

/**
 * Download a PDF from `url` into the cache and return a PickedPdf.
 * Throws with a friendly message on network/validation errors.
 */
export async function importPdfFromUrl(
  url: string,
  onProgress?: ImportFromUrlProgress,
): Promise<PickedPdf> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Please enter a URL starting with http:// or https://.");
  }

  await ensureDir();
  const name = guessName(trimmed).replace(/[^\w.-]/g, "_");
  const safeName = name.toLowerCase().endsWith(".pdf") ? name : name + ".pdf";
  const dest = WORK_DIR + `${Date.now()}-${safeName}`;

  const task = FileSystem.createDownloadResumable(
    trimmed,
    dest,
    {},
    (p) => {
      if (onProgress && p.totalBytesExpectedToWrite > 0) {
        onProgress(p.totalBytesWritten, p.totalBytesExpectedToWrite);
      }
    },
  );

  let result;
  try {
    result = await task.downloadAsync();
  } catch (e) {
    throw new Error(
      (e as Error)?.message ||
        "Download failed. Check the URL and your internet connection.",
    );
  }
  if (!result) {
    throw new Error("Download was cancelled or failed.");
  }

  const status = result.status;
  if (status < 200 || status >= 300) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    throw new Error(`Server returned HTTP ${status}. The link may be private or expired.`);
  }

  const info = await FileSystem.getInfoAsync(dest, { size: true });
  const size = (info as { size?: number }).size || 0;
  if (size > MAX_PDF_BYTES) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    throw new Error(`PDF is too large (${Math.round(size / 1024 / 1024)} MB).`);
  }
  if (size === 0) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    throw new Error("The downloaded file is empty.");
  }

  const ok = await validateHeader(dest);
  if (!ok) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    throw new Error(
      "That link doesn't point to a valid PDF. Make sure the URL ends with .pdf and is publicly accessible.",
    );
  }

  return { uri: dest, name: safeName, size };
}
