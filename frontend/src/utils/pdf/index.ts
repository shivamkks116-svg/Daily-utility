/**
 * Local PDF utilities (pure JS via pdf-lib) — safe for Windows local builds,
 * no native Kotlin dependencies. Every operation returns a file:// URI to a
 * fresh PDF written under expo-file-system's cache directory.
 */
import * as FileSystem from "expo-file-system/legacy";
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";

const CACHE = FileSystem.cacheDirectory + "dailyhub-pdf/";

async function ensureCache() {
  const info = await FileSystem.getInfoAsync(CACHE);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE, { intermediates: true });
  }
}

function uniqueName(prefix: string, ext: string = "pdf") {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}.${ext}`;
}

async function readAsBytes(uri: string): Promise<Uint8Array> {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  // Decode base64 -> Uint8Array
  const bin = globalThis.atob ? globalThis.atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function writeBytes(bytes: Uint8Array, name: string): Promise<string> {
  await ensureCache();
  const dest = CACHE + name;
  // Uint8Array -> base64
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  }
  const b64 = globalThis.btoa ? globalThis.btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
  return dest;
}

export async function readPdfBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

export async function getPdfSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  return (info as any).size ?? 0;
}

// --- Core operations ------------------------------------------------------

export async function mergePdfs(uris: string[], outName = "Merged"): Promise<string> {
  if (uris.length < 2) throw new Error("Select at least 2 PDFs to merge.");
  const out = await PDFDocument.create();
  for (const uri of uris) {
    const bytes = await readAsBytes(uri);
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(p => out.addPage(p));
  }
  const outBytes = await out.save();
  return writeBytes(outBytes, uniqueName(outName));
}

export type SplitRange = { from: number; to: number; label?: string };

/** Split a PDF into multiple PDFs by page ranges (1-indexed inclusive). */
export async function splitPdf(uri: string, ranges: SplitRange[]): Promise<string[]> {
  const bytes = await readAsBytes(uri);
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const outs: string[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    const from = Math.max(1, Math.min(total, Math.floor(r.from)));
    const to = Math.max(from, Math.min(total, Math.floor(r.to)));
    const indices: number[] = [];
    for (let p = from - 1; p <= to - 1; p++) indices.push(p);
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach(p => out.addPage(p));
    const outBytes = await out.save();
    const label = (r.label || `part-${i + 1}`).replace(/[^\w-]+/g, "_");
    outs.push(await writeBytes(outBytes, uniqueName(`Split-${label}`)));
  }
  return outs;
}

/** Extract selected pages (1-indexed) into ONE new PDF. */
export async function extractPages(uri: string, pageNumbers: number[]): Promise<string> {
  const bytes = await readAsBytes(uri);
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const indices = Array.from(new Set(pageNumbers))
    .map(n => Math.floor(n))
    .filter(n => n >= 1 && n <= total)
    .map(n => n - 1)
    .sort((a, b) => a - b);
  if (indices.length === 0) throw new Error("No valid pages selected.");
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach(p => out.addPage(p));
  return writeBytes(await out.save(), uniqueName("Extracted"));
}

/** Delete pages (1-indexed). Returns new PDF with remaining pages. */
export async function deletePages(uri: string, pageNumbers: number[]): Promise<string> {
  const bytes = await readAsBytes(uri);
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const dropSet = new Set(pageNumbers.map(n => Math.floor(n)));
  const keep: number[] = [];
  for (let i = 1; i <= total; i++) if (!dropSet.has(i)) keep.push(i - 1);
  if (keep.length === 0) throw new Error("Cannot delete every page — a PDF needs at least one page.");
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keep);
  pages.forEach(p => out.addPage(p));
  return writeBytes(await out.save(), uniqueName("Trimmed"));
}

/** Rotate specific pages by 90/180/270 degrees. If no pages given, rotates all. */
export async function rotatePages(uri: string, angle: 90 | 180 | 270, pageNumbers?: number[]): Promise<string> {
  const bytes = await readAsBytes(uri);
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const target = pageNumbers && pageNumbers.length > 0
    ? new Set(pageNumbers.map(n => Math.floor(n)))
    : new Set(Array.from({ length: total }, (_, i) => i + 1));
  for (let i = 0; i < total; i++) {
    if (!target.has(i + 1)) continue;
    const page = src.getPage(i);
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angle) % 360));
  }
  return writeBytes(await src.save(), uniqueName("Rotated"));
}

/** Reorder pages using an explicit permutation of 1-indexed page numbers. */
export async function reorderPages(uri: string, newOrder: number[]): Promise<string> {
  const bytes = await readAsBytes(uri);
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const indices = newOrder
    .map(n => Math.floor(n) - 1)
    .filter(n => n >= 0 && n < total);
  if (indices.length !== total) {
    throw new Error(`New order must contain every one of the ${total} pages exactly once.`);
  }
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach(p => out.addPage(p));
  return writeBytes(await out.save(), uniqueName("Reordered"));
}

export type WatermarkOpts = {
  text: string;
  opacity?: number;    // 0..1
  angle?: number;      // degrees
  color?: [number, number, number]; // rgb 0..1
  fontSize?: number;
};

/** Overlay a diagonal text watermark on every page. */
export async function addWatermark(uri: string, opts: WatermarkOpts): Promise<string> {
  const bytes = await readAsBytes(uri);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const [cr, cg, cb] = opts.color ?? [0.2, 0.55, 0.4];
  const opacity = Math.min(1, Math.max(0.05, opts.opacity ?? 0.22));
  const angle = opts.angle ?? -30;
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const size = opts.fontSize ?? Math.min(width, height) * 0.14;
    const textWidth = font.widthOfTextAtSize(opts.text, size);
    const cx = width / 2 - textWidth / 2;
    const cy = height / 2 - size / 2;
    page.drawText(opts.text, {
      x: cx,
      y: cy,
      size,
      font,
      color: rgb(cr, cg, cb),
      opacity,
      rotate: degrees(angle),
    });
  }
  return writeBytes(await doc.save(), uniqueName("Watermarked"));
}

export type PageNumOpts = {
  position?: "footer-center" | "footer-right" | "footer-left" | "header-center";
  startFrom?: number;
  format?: "n" | "n/total" | "Page n of total";
  fontSize?: number;
};

/** Draw page numbers on every page. */
export async function addPageNumbers(uri: string, opts: PageNumOpts = {}): Promise<string> {
  const bytes = await readAsBytes(uri);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  const start = opts.startFrom ?? 1;
  const pos = opts.position ?? "footer-center";
  const format = opts.format ?? "n/total";
  const size = opts.fontSize ?? 11;
  const margin = 18;
  pages.forEach((page, idx) => {
    const n = start + idx;
    const text = format === "n"
      ? String(n)
      : format === "n/total"
        ? `${n} / ${total}`
        : `Page ${n} of ${total}`;
    const w = font.widthOfTextAtSize(text, size);
    const { width, height } = page.getSize();
    let x = margin;
    let y = margin;
    if (pos === "footer-center") x = width / 2 - w / 2;
    else if (pos === "footer-right") x = width - margin - w;
    else if (pos === "header-center") { x = width / 2 - w / 2; y = height - margin - size; }
    page.drawText(text, { x, y, size, font, color: rgb(0.25, 0.25, 0.25) });
  });
  return writeBytes(await doc.save(), uniqueName("Numbered"));
}

export async function cleanCache(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE);
    if (info.exists) {
      await FileSystem.deleteAsync(CACHE, { idempotent: true });
    }
  } catch {}
}

export { CACHE as PDF_CACHE_DIR };


/* ============================================================
 * Server-backed operations (v7.3)
 * =========================================================== */

import { api } from "@/src/api/client";

/** Base64-encode a file:// URI and stream it to `/api/pdf/*`. */
async function callPdfApi<TReq extends object, TRes>(
  path: string,
  uri: string,
  extra: TReq | undefined,
): Promise<TRes> {
  const file_base64 = await readPdfBase64(uri);
  return api<TRes>(path, {
    method: "POST",
    body: { file_base64, ...(extra || {}) } as unknown as Record<string, unknown>,
  });
}

/** Write a base64 payload to the cache and return its file:// URI. */
async function writeBase64(name: string, b64: string): Promise<string> {
  await ensureCache();
  const dest = CACHE + name;
  await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
  return dest;
}

/** Convert every page of a PDF to PNG/JPEG. Returns file:// URIs. */
export async function pdfToImages(
  uri: string,
  opts: { dpi?: number; format?: "png" | "jpeg" } = {},
): Promise<{ page: number; uri: string; width: number; height: number }[]> {
  const res = await callPdfApi<
    { dpi?: number; format?: string },
    { pages: { page: number; data: string; width: number; height: number; mime: string }[] }
  >("/pdf/to-images", uri, { dpi: opts.dpi ?? 150, format: opts.format ?? "png" });
  const out: { page: number; uri: string; width: number; height: number }[] = [];
  for (const p of res.pages) {
    const ext = p.mime === "image/jpeg" ? "jpg" : "png";
    const dest = await writeBase64(uniqueName(`page-${p.page}`, ext), p.data);
    out.push({ page: p.page, uri: dest, width: p.width, height: p.height });
  }
  return out;
}

/** Compress a PDF. Returns file:// URI + size stats. */
export async function compressPdf(uri: string): Promise<{
  uri: string;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savedPct: number;
}> {
  const res = await callPdfApi<
    Record<string, never>,
    { file_base64: string; original_size: number; compressed_size: number; saved_bytes: number; saved_pct: number }
  >("/pdf/compress", uri, undefined);
  const dest = await writeBase64(uniqueName("compressed"), res.file_base64);
  return {
    uri: dest,
    originalSize: res.original_size,
    compressedSize: res.compressed_size,
    savedBytes: res.saved_bytes,
    savedPct: res.saved_pct,
  };
}

/** Password-protect a PDF with AES-256. */
export async function protectPdf(uri: string, password: string): Promise<string> {
  const res = await callPdfApi<{ password: string }, { file_base64: string }>(
    "/pdf/protect", uri, { password },
  );
  return writeBase64(uniqueName("locked"), res.file_base64);
}

/** Remove a PDF password (must be the correct password). */
export async function unlockPdf(uri: string, password: string): Promise<string> {
  const res = await callPdfApi<{ password: string }, { file_base64: string }>(
    "/pdf/unlock", uri, { password },
  );
  return writeBase64(uniqueName("unlocked"), res.file_base64);
}

/** Export a PDF's text to a downloadable .docx file. */
export async function pdfToDocx(uri: string): Promise<{ uri: string; size: number; chars: number }> {
  const res = await callPdfApi<Record<string, never>, { file_base64: string; size: number; chars: number }>(
    "/pdf/to-docx", uri, undefined,
  );
  const dest = await writeBase64(uniqueName("converted", "docx"), res.file_base64);
  return { uri: dest, size: res.size, chars: res.chars };
}


/** Export a PDF's text (with optional OCR for scanned pages) to a .docx. */
export async function pdfToDocxWithOcr(
  uri: string,
  useOcr: "auto" | "force" | "off" = "auto",
): Promise<{ uri: string; size: number; chars: number; usedOcr: boolean; ocrPages: number }> {
  const res = await callPdfApi<
    { use_ocr: string },
    { file_base64: string; size: number; chars: number; used_ocr: boolean; ocr_pages: number }
  >("/pdf/to-docx", uri, { use_ocr: useOcr });
  const dest = await writeBase64(uniqueName("converted", "docx"), res.file_base64);
  return { uri: dest, size: res.size, chars: res.chars, usedOcr: res.used_ocr, ocrPages: res.ocr_pages };
}

/** Stamp a signature image onto a specific PDF page. */
export async function signPdf(
  uri: string,
  signatureB64: string,
  opts: { page: number; xPct: number; yPct: number; widthPct?: number },
): Promise<string> {
  const res = await callPdfApi<
    { signature_base64: string; page: number; x_pct: number; y_pct: number; width_pct: number },
    { file_base64: string }
  >("/pdf/sign", uri, {
    signature_base64: signatureB64,
    page: opts.page,
    x_pct: opts.xPct,
    y_pct: opts.yPct,
    width_pct: opts.widthPct ?? 25,
  });
  return writeBase64(uniqueName("signed"), res.file_base64);
}

export type PDFField = {
  name: string;
  label: string;
  type: "text" | "checkbox" | "radio" | "listbox" | "combobox" | "signature" | "unknown";
  value: string;
  page: number;
  options: string[];
  required: boolean;
  max_len: number;
};

/** Enumerate PDF form fields. */
export async function listPdfFields(uri: string): Promise<PDFField[]> {
  const res = await callPdfApi<Record<string, never>, { fields: PDFField[] }>("/pdf/fields", uri, undefined);
  return res.fields;
}

/** Fill PDF form fields with values. */
export async function fillPdfFields(
  uri: string,
  values: Record<string, string | boolean>,
): Promise<{ uri: string; filled: number }> {
  const res = await callPdfApi<
    { values: Record<string, unknown> },
    { file_base64: string; filled: number }
  >("/pdf/fill", uri, { values });
  const dest = await writeBase64(uniqueName("filled"), res.file_base64);
  return { uri: dest, filled: res.filled };
}
