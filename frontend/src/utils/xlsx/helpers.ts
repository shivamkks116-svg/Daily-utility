/**
 * Excel / CSV helpers: pick a spreadsheet and convert it to PDF on the backend.
 */
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Alert } from "react-native";
import { api } from "@/src/api/client";

export type PickedSheet = { uri: string; name: string; size: number };

const SHEET_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/comma-separated-values",
];
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Import a shared content:// / file:// URI and decide if it's a spreadsheet.
 * XLSX and DOCX are both zips, so we look inside for `xl/workbook.xml`.
 * Legacy .xls / .csv are detected by file extension.
 */
export async function importSheetFromUri(rawUri: string): Promise<PickedSheet | null> {
  const rawName = decodeURIComponent((rawUri.split("/").pop() || "shared").split("?")[0]);
  const dest = `${FileSystem.cacheDirectory}shared-${Date.now()}-${rawName.replace(/[^\w.\-]/g, "_")}`;
  try {
    await FileSystem.copyAsync({ from: rawUri, to: dest });
  } catch {
    try {
      const b64 = await FileSystem.readAsStringAsync(rawUri, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
    } catch {
      return null;
    }
  }
  let name = rawName;
  if (!/\.(xlsx|xlsm|xls|csv)$/i.test(name)) {
    try {
      const head = await FileSystem.readAsStringAsync(dest, { encoding: FileSystem.EncodingType.Base64, length: 4, position: 0 });
      if (!head.startsWith("UEs")) return null; // not a zip → not xlsx
      const JSZip = (await import("jszip")).default;
      const b64 = await FileSystem.readAsStringAsync(dest, { encoding: FileSystem.EncodingType.Base64 });
      const zip = await JSZip.loadAsync(b64, { base64: true });
      if (!zip.file("xl/workbook.xml")) return null;
      name = `${name || "Spreadsheet"}.xlsx`;
    } catch {
      return null;
    }
  }
  const info = await FileSystem.getInfoAsync(dest);
  const size = info.exists && !info.isDirectory ? (info as { size: number }).size : 0;
  return { uri: dest, name, size };
}

export async function pickSpreadsheet(): Promise<PickedSheet | null> {
  let res: DocumentPicker.DocumentPickerResult;
  try {
    res = await DocumentPicker.getDocumentAsync({ type: SHEET_MIMES, multiple: false, copyToCacheDirectory: true });
  } catch {
    res = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: false, copyToCacheDirectory: true });
  }
  if (res.canceled) return null;
  const asset = res.assets?.[0];
  if (!asset) return null;
  const name = (asset.name || "sheet.xlsx").trim();
  if (!/\.(xlsx|xlsm|xls|csv)$/i.test(name)) {
    Alert.alert("Unsupported file", "Please pick an Excel (.xlsx, .xls) or CSV file.");
    return null;
  }
  if (asset.size && asset.size > MAX_BYTES) {
    Alert.alert("File too large", "Excel conversion is limited to 25 MB.");
    return null;
  }
  return { uri: asset.uri, name, size: asset.size ?? 0 };
}

export async function spreadsheetToPdf(uri: string, name: string): Promise<{ uri: string; size: number; name: string; pages: number }> {
  const file_base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const body = await api<{ file_base64: string; size: number; pages: number }>("/xlsx/to-pdf", {
    method: "POST",
    body: { file_base64, title: name },
  });
  const outName = name.replace(/\.(xlsx|xlsm|xls|csv)$/i, "") + ".pdf";
  const dest = `${FileSystem.cacheDirectory}${Date.now()}-${outName}`;
  await FileSystem.writeAsStringAsync(dest, body.file_base64, { encoding: FileSystem.EncodingType.Base64 });
  return { uri: dest, size: body.size, name: outName, pages: body.pages };
}
