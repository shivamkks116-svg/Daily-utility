/**
 * Image toolkit utilities — all operations use expo-image-manipulator (bundled
 * with Expo Go, no native module additions) so local Windows builds keep
 * compiling. Every function returns a file:// URI that lives in a private
 * cache dir the toolkit fully owns.
 */
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

const CACHE = FileSystem.cacheDirectory + "dailyhub-image/";

async function ensureCache() {
  const info = await FileSystem.getInfoAsync(CACHE);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE, { intermediates: true });
  }
}

function uniq(prefix: string, ext: string): string {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  return `${CACHE}${prefix}-${stamp}.${ext}`;
}

export async function getSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  return (info as any).size ?? 0;
}

async function persist(result: { uri: string }, prefix: string, format: "jpeg" | "png" | "webp"): Promise<string> {
  await ensureCache();
  const dest = uniq(prefix, format === "jpeg" ? "jpg" : format);
  await FileSystem.copyAsync({ from: result.uri, to: dest });
  return dest;
}

export type CompressLevel = "low" | "medium" | "high";

function qualityFor(level: CompressLevel): number {
  switch (level) {
    case "low": return 0.9;
    case "high": return 0.4;
    default: return 0.65;
  }
}

/** Compress a JPEG/PNG to the target quality level. */
export async function compressImage(uri: string, level: CompressLevel = "medium"): Promise<string> {
  const quality = qualityFor(level);
  const res = await ImageManipulator.manipulateAsync(uri, [], {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return persist(res, `compressed-${level}`, "jpeg");
}

export async function resizeImage(
  uri: string,
  opts: { width?: number; height?: number; percent?: number },
): Promise<string> {
  const meta = await ImageManipulator.manipulateAsync(uri, [], { base64: false });
  let width = opts.width;
  let height = opts.height;
  if (opts.percent && !width && !height) {
    width = Math.max(1, Math.round(meta.width * (opts.percent / 100)));
    height = Math.max(1, Math.round(meta.height * (opts.percent / 100)));
  }
  const actions: ImageManipulator.Action[] = [];
  if (width || height) {
    actions.push({ resize: { width, height } });
  }
  const res = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return persist(res, "resized", "jpeg");
}

export async function convertFormat(uri: string, format: "jpeg" | "png" | "webp"): Promise<string> {
  const target: ImageManipulator.SaveFormat = format === "png"
    ? ImageManipulator.SaveFormat.PNG
    : format === "webp"
      ? (ImageManipulator.SaveFormat as any).WEBP || ImageManipulator.SaveFormat.JPEG
      : ImageManipulator.SaveFormat.JPEG;
  const res = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 0.9,
    format: target,
  });
  return persist(res, `converted-${format}`, format);
}

export type CropRect = { originX: number; originY: number; width: number; height: number };

export async function cropImage(uri: string, rect: CropRect): Promise<string> {
  const res = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: rect }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
  );
  return persist(res, "cropped", "jpeg");
}

export async function rotateImage(uri: string, degrees: number): Promise<string> {
  const res = await ImageManipulator.manipulateAsync(
    uri,
    [{ rotate: degrees }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
  );
  return persist(res, "rotated", "jpeg");
}

export async function flipImage(uri: string, direction: "horizontal" | "vertical"): Promise<string> {
  const flip = direction === "horizontal"
    ? ImageManipulator.FlipType.Horizontal
    : ImageManipulator.FlipType.Vertical;
  const res = await ImageManipulator.manipulateAsync(
    uri,
    [{ flip }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
  );
  return persist(res, "flipped", "jpeg");
}

export async function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  const res = await ImageManipulator.manipulateAsync(uri, [], { base64: false });
  return { width: res.width, height: res.height };
}

export async function readImageBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

export { CACHE as IMAGE_CACHE_DIR };
