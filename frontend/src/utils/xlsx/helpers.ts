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
