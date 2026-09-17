/**
 * Recent-files store — tracks the last handful of PDFs / images the user has
 * created or opened inside the Toolkit. Persisted via AsyncStorage.
 */
import { storage } from "@/src/utils/storage";

const KEY = "dailyhub_toolkit_recents_v1";
const MAX = 25;

export type RecentEntry = {
  id: string;
  kind: "pdf" | "image";
  uri: string;
  name: string;
  size?: number;
  createdAt: number; // epoch ms
  tool?: string;     // e.g. "merge", "compress"
  meta?: Record<string, any>;
};

export async function listRecents(): Promise<RecentEntry[]> {
  try {
    const raw = await storage.getItem<string>(KEY, "");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addRecent(entry: Omit<RecentEntry, "id" | "createdAt"> & Partial<Pick<RecentEntry, "id" | "createdAt">>): Promise<void> {
  const now = Date.now();
  const item: RecentEntry = {
    id: entry.id || `rec_${now}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: entry.createdAt || now,
    ...entry,
  } as RecentEntry;
  const cur = await listRecents();
  const filtered = cur.filter(r => r.uri !== item.uri);
  filtered.unshift(item);
  const trimmed = filtered.slice(0, MAX);
  await storage.setItem(KEY, JSON.stringify(trimmed));
}

export async function removeRecent(id: string): Promise<void> {
  const cur = await listRecents();
  await storage.setItem(KEY, JSON.stringify(cur.filter(r => r.id !== id)));
}

export async function clearRecents(): Promise<void> {
  await storage.removeItem(KEY);
}

const FAV_KEY = "dailyhub_toolkit_favs_v1";

export async function listFavorites(): Promise<string[]> {
  try {
    const raw = await storage.getItem<string>(FAV_KEY, "");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function toggleFavorite(toolKey: string): Promise<string[]> {
  const cur = await listFavorites();
  const set = new Set(cur);
  if (set.has(toolKey)) set.delete(toolKey);
  else set.add(toolKey);
  const next = Array.from(set);
  await storage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
}

export function formatBytes(bytes: number = 0): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }) + `, ${time}`;
}
