import { storage } from "@/src/utils/storage";

// Production backend URL (hardcoded fallback so shipped APKs always work,
// even if .env is missing during local Windows builds). In dev, EXPO_PUBLIC_BACKEND_URL
// from .env will override this.
const PROD_BACKEND_URL = "https://daily-utility-ai.emergent.host";
const ENV_BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const BACKEND = (ENV_BACKEND && ENV_BACKEND.trim().length > 0 ? ENV_BACKEND : PROD_BACKEND_URL) as string;
export const API_BASE = `${BACKEND}/api`;
export const AUTH_TOKEN_KEY = "dailyhub_session_token";

let _tokenCache: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (_tokenCache !== undefined) return _tokenCache;
  const t = await storage.secureGet<string>(AUTH_TOKEN_KEY, "");
  _tokenCache = t || null;
  return _tokenCache;
}

export async function setToken(token: string | null) {
  _tokenCache = token;
  if (token) await storage.secureSet(AUTH_TOKEN_KEY, token);
  else await storage.secureRemove(AUTH_TOKEN_KEY);
}

type Opts = { method?: string; body?: unknown; auth?: boolean };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const t = await getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    await setToken(null);
    throw new Error("Unauthorized");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return data as T;
}
