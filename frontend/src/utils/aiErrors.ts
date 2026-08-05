export function isQuotaExceeded(err: unknown): boolean {
  const e = err as { status?: number; detail?: { error?: string } } | null;
  if (!e) return false;
  if (e.status === 429) return true;
  const detailErr = e.detail && typeof e.detail === "object" ? (e.detail.error || "") : "";
  return detailErr === "quota_exceeded";
}
