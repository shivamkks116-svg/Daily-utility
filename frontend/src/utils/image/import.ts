/**
 * Import a content:// or file:// image URI (typically from an Android SEND
 * intent) into app-private cache and return a `PickedImg`. Falls back to
 * base64 read+write when direct copy fails on read-only providers.
 */
import * as FileSystem from "expo-file-system/legacy";
import type { PickedImg } from "@/src/utils/image/helpers";

const WORK_DIR = FileSystem.cacheDirectory + "dailyhub-image-inbox/";
const IMG_MAGICS: { header: number[]; ext: string }[] = [
  { header: [0xff, 0xd8, 0xff], ext: "jpg" },                       // JPEG
  { header: [0x89, 0x50, 0x4e, 0x47], ext: "png" },                 // PNG
  { header: [0x47, 0x49, 0x46], ext: "gif" },                       // GIF
  { header: [0x52, 0x49, 0x46, 0x46], ext: "webp" },                // WEBP (RIFF)
  { header: [0x42, 0x4d], ext: "bmp" },                             // BMP
];

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(WORK_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(WORK_DIR, { intermediates: true });
  }
}

async function detectExt(uri: string): Promise<string | null> {
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 16,
      position: 0,
    });
    const bin = globalThis.atob
      ? globalThis.atob(b64)
      : Buffer.from(b64, "base64").toString("binary");
    const bytes = Array.from(bin).map((c) => c.charCodeAt(0));
    for (const m of IMG_MAGICS) {
      if (m.header.every((b, i) => bytes[i] === b)) return m.ext;
    }
    return null;
  } catch {
    return null;
  }
}

export async function importImageFromUri(
  uri: string,
  hintName?: string,
): Promise<PickedImg | null> {
  try {
    await ensureDir();
    const ext = (await detectExt(uri)) || "jpg";
    const safeHint = (hintName || "").replace(/[^\w.-]/g, "_");
    const base = safeHint
      ? safeHint.replace(/\.[a-z0-9]+$/i, "")
      : `shared-${Date.now()}`;
    const name = `${base}.${ext}`;
    const dest = WORK_DIR + `${Date.now()}-${name}`;

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

    // Verify it's actually an image by header, else abort.
    const verifiedExt = await detectExt(dest);
    if (!verifiedExt) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
      return null;
    }

    return {
      uri: dest,
      width: 0,
      height: 0,
      size,
      name,
    };
  } catch (e) {
    console.warn("[importImageFromUri] failed:", e);
    return null;
  }
}
