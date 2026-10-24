import { storage } from "@/src/utils/storage";

/** Per-document page bookmarks stored on-device. */
export type PdfBookmark = { page: number; addedAt: number };

const key = (docKey: string) => `pdf_bookmarks:${docKey}`;

/** Stable-ish key: shared files get random names, so prefer size + page count. */
export function bookmarkDocKey(file: { uri: string; size?: number }, numPages: number) {
  return file.size ? `${file.size}:${numPages}` : file.uri;
}

export async function listBookmarks(docKey: string): Promise<PdfBookmark[]> {
  const raw = await storage.getItem<string>(key(docKey), "");
  try {
    return raw ? (JSON.parse(raw) as PdfBookmark[]).sort((a, b) => a.page - b.page) : [];
  } catch {
    return [];
  }
}

export async function toggleBookmark(docKey: string, page: number): Promise<PdfBookmark[]> {
  const list = await listBookmarks(docKey);
  const next = list.some((b) => b.page === page)
    ? list.filter((b) => b.page !== page)
    : [...list, { page, addedAt: Date.now() }].sort((a, b) => a.page - b.page);
  await storage.setItem(key(docKey), JSON.stringify(next));
  return next;
}

// -------- Resume reading --------
const lastKey = (docKey: string) => `pdf_last_page:${docKey}`;

export async function getLastPage(docKey: string): Promise<number> {
  return Number(await storage.getItem<string>(lastKey(docKey), "0")) || 0;
}

export async function setLastPage(docKey: string, page: number) {
  await storage.setItem(lastKey(docKey), String(page));
}
