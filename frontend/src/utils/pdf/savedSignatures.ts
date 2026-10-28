import { storage } from "@/src/utils/storage";

/** Up to 3 recently used signatures (transparent-friendly PNG base64), on-device only. */
const KEY = "saved_signatures_v1";
const MAX = 3;

export async function listSavedSignatures(): Promise<string[]> {
  const raw = await storage.getItem<string>(KEY, "");
  try {
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function saveSignature(b64: string): Promise<string[]> {
  const list = (await listSavedSignatures()).filter((s) => s !== b64);
  const next = [b64, ...list].slice(0, MAX);
  await storage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function deleteSignature(b64: string): Promise<string[]> {
  const next = (await listSavedSignatures()).filter((s) => s !== b64);
  await storage.setItem(KEY, JSON.stringify(next));
  return next;
}
