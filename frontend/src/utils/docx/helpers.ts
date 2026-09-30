/**
 * Word document (DOCX / DOC) helpers.
 *
 * `pickDocx()` — SAF picker filtered to Word MIME types with graceful fallbacks.
 * `docxToPdf()`  — POSTs a DOCX to the backend `/docx/to-pdf` endpoint and
 *                  writes the returned PDF to app-private cache.
 * `importDocxFromUri()` — mirrors `importPdfFromUri`; used by the shared-intent
 *                          handler when a `.docx` / `.doc` file is opened via
 *                          Android VIEW/SEND.
 */

import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Alert, Platform } from "react-native";
import { api } from "@/src/api/client";

// -------- Public types --------

export type PickedDocx = {
  uri: string;
  name: string;
  size: number;
};

// -------- Constants --------

const DOCX_MIMES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];
const MAX_DOCX_BYTES = 50 * 1024 * 1024; // 50 MB — DOCX text-only

// -------- Public API --------

/**
 * Open the Android SAF picker filtered to Word documents. Copies the picked
 * document to app-private cache so downstream reads never hit a stale URI.
 */
export async function pickDocx(
  opts: { silentOnCancel?: boolean } = {},
): Promise<PickedDocx | null> {
  let res: DocumentPicker.DocumentPickerResult;
  try {
    res = await DocumentPicker.getDocumentAsync({
      type: DOCX_MIMES,
      multiple: false,
      copyToCacheDirectory: true,
    });
  } catch (e) {
    // Fallback: some OEM SAF wrappers reject arrays — retry with the modern
    // OOXML MIME only.
    try {
      res = await DocumentPicker.getDocumentAsync({
        type: DOCX_MIMES[0],
        multiple: false,
        copyToCacheDirectory: true,
      });
    } catch (e2) {
      Alert.alert(
        "Could not open picker",
        "Your device doesn't have a Word-compatible file provider available.",
      );
      return null;
    }
  }
  if (res.canceled) {
    if (!opts.silentOnCancel) return null;
    return null;
  }
  const asset = res.assets?.[0];
  if (!asset) return null;

  const cleanName = (asset.name || "document.docx").trim();
  if (asset.size && asset.size > MAX_DOCX_BYTES) {
    Alert.alert(
      "File too large",
      `Word conversion is limited to 50 MB. This document is ${(asset.size / (1024 * 1024)).toFixed(1)} MB.`,
    );
    return null;
  }
  return { uri: asset.uri, name: cleanName, size: asset.size ?? 0 };
}

/**
 * Import a content:// / file:// URI (from a share intent) into cache and
 * validate it looks like a DOCX. Returns `null` if the bytes aren't Word.
 */
export async function importDocxFromUri(rawUri: string): Promise<PickedDocx | null> {
  const name = (rawUri.split("/").pop() || "shared.docx").split("?")[0];
  const dest = `${FileSystem.cacheDirectory}shared-${Date.now()}-${name}`;
  try {
    await FileSystem.copyAsync({ from: rawUri, to: dest });
  } catch {
    try {
      const b64 = await FileSystem.readAsStringAsync(rawUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(dest, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch {
      return null;
    }
  }
  // DOCX = zip file → magic bytes `PK` at offset 0.
  try {
    const head = await FileSystem.readAsStringAsync(dest, {
      encoding: FileSystem.EncodingType.Base64,
      length: 4,
      position: 0,
    });
    if (!head.startsWith("UEs") && !head.startsWith("0M8R")) {
      // DOCX (`UEs...` == b'PK') or legacy DOC (`0M8R...` == OLE compound).
      return null;
    }
  } catch {
    // If we cannot read the header, still return so the backend can attempt.
  }
  const info = await FileSystem.getInfoAsync(dest);
  const size = info.exists && !info.isDirectory ? (info as { size: number }).size : 0;
  return { uri: dest, name, size };
}

/**
 * Convert a DOCX to a PDF via the backend. Returns the local PDF file path.
 * Uses the shared `api` client so auth headers, base URL and error handling
 * stay consistent with every other backed-backed tool.
 */
export async function docxToPdf(
  uri: string,
  name: string,
): Promise<{ uri: string; size: number; name: string }> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const body = await api<{ file_base64: string; size: number; pages: number }>(
    "/docx/to-pdf",
    {
      method: "POST",
      body: { file_base64: base64, title: name } as unknown as Record<string, unknown>,
    },
  );
  const outName = name.replace(/\.docx?$/i, "") + ".pdf";
  const dest = `${FileSystem.cacheDirectory}${Date.now()}-${outName}`;
  await FileSystem.writeAsStringAsync(dest, body.file_base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri: dest, size: body.size, name: outName };
}

// -------- Word reader --------

export type DocxBlock = { text: string; level: number; bold: boolean };

/**
 * Ask the backend to extract structured blocks from a DOCX so we can render
 * them as native, selectable text in the in-app Word Reader.
 */
export async function docxRead(uri: string): Promise<{
  blocks: DocxBlock[];
  paragraphCount: number;
  charCount: number;
}> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const body = await api<{
    blocks: DocxBlock[];
    paragraph_count: number;
    char_count: number;
  }>("/docx/read", {
    method: "POST",
    body: { file_base64: base64 } as unknown as Record<string, unknown>,
  });
  return {
    blocks: body.blocks,
    paragraphCount: body.paragraph_count,
    charCount: body.char_count,
  };
}

// Keep Platform referenced to silence lint on unused import (used later).
void Platform;
