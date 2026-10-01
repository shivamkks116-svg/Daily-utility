/**
 * On-device DOCX reader.
 *
 * A `.docx` is a ZIP archive — the real document content lives in
 * `word/document.xml`. We can parse this entirely on-device with `jszip`
 * (pure JS, no native deps) and return the same shape as the backend
 * `/docx/read` endpoint. This makes Word Reader instant: 50–100 ms for a
 * typical document vs 1–2 s round-trip to the server.
 *
 * We intentionally do NOT support legacy `.doc` (OLE compound format) —
 * that still needs the server endpoint.
 */

import JSZip from "jszip";
import * as FileSystem from "expo-file-system/legacy";

export type LocalDocxBlock = { text: string; level: number; bold: boolean };

export type LocalDocxResult = {
  blocks: LocalDocxBlock[];
  paragraphCount: number;
  charCount: number;
};

/**
 * Returns `true` if the magic bytes look like a modern DOCX (`PK\x03\x04`).
 * Legacy `.doc` (OLE compound `D0 CF 11 E0`) returns `false` so callers can
 * fall back to the server endpoint for those.
 */
export function isDocxZip(firstBytes: Uint8Array): boolean {
  return (
    firstBytes.length >= 4 &&
    firstBytes[0] === 0x50 && // 'P'
    firstBytes[1] === 0x4b && // 'K'
    firstBytes[2] === 0x03 &&
    firstBytes[3] === 0x04
  );
}

/**
 * Read a DOCX from a local URI, extract paragraph text and heading levels
 * entirely on-device.
 */
export async function readDocxLocal(uri: string): Promise<LocalDocxResult | null> {
  // 1. Load the file as base64 → convert to Uint8Array.
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToUint8Array(base64);

  // Reject non-DOCX early so callers can fall back to the server for `.doc`.
  if (!isDocxZip(bytes)) return null;

  // 2. Unzip in memory.
  const zip = await JSZip.loadAsync(bytes);
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) return null;
  const xml = await docXmlFile.async("string");

  // 3. Parse `<w:p>` paragraphs with regex. We avoid a full XML parser
  //    because the DOCX structure is simple enough and regex keeps the
  //    bundle lean (no `fast-xml-parser` etc.).
  //
  //    For every <w:p ...>...</w:p>:
  //      • Extract heading level from <w:pStyle w:val="Heading{N}"/>.
  //      • Join every <w:t ...>...</w:t> text run inside the paragraph.
  //      • Skip empty paragraphs (but preserve blank-line spacing).
  const paragraphRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  const headingRe = /<w:pStyle\s+w:val="Heading(\d)"\s*\/?>/i;
  const headingAltRe = /<w:pStyle\s+w:val="Title"\s*\/?>/i; // Treat "Title" as H1
  const runTextRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;

  const blocks: LocalDocxBlock[] = [];
  let charCount = 0;
  let m: RegExpExecArray | null;

  while ((m = paragraphRe.exec(xml)) !== null) {
    const inner = m[1];
    let level = 0;
    const headingMatch = inner.match(headingRe);
    if (headingMatch) {
      const n = parseInt(headingMatch[1], 10);
      level = Number.isFinite(n) && n >= 1 && n <= 6 ? n : 1;
    } else if (headingAltRe.test(inner)) {
      level = 1;
    }

    let text = "";
    let runMatch: RegExpExecArray | null;
    const re = new RegExp(runTextRe.source, "g");
    while ((runMatch = re.exec(inner)) !== null) {
      text += decodeXmlEntities(runMatch[1]);
    }
    text = text.replace(/\s+$/g, ""); // Trim trailing whitespace per paragraph.

    blocks.push({ text, level, bold: level > 0 });
    charCount += text.length;
  }

  return {
    blocks,
    paragraphCount: blocks.length,
    charCount,
  };
}

// -------- Internal helpers --------

/** Convert a base64 string to a raw Uint8Array (RN + browser compatible). */
function base64ToUint8Array(b64: string): Uint8Array {
  // atob is available in both React Native (Hermes) and Node 16+.
  // We decode in-place to avoid a Buffer dependency.
  const raw = globalThis.atob(b64);
  const len = raw.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = raw.charCodeAt(i) & 0xff;
  }
  return out;
}

/** Decode the five XML entities DOCX actually emits inside <w:t> runs. */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
