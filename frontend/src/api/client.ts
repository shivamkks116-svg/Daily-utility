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

// Silent guest bootstrap: if we hit 401 anywhere and don't already have a valid
// session, transparently create a fresh guest session and retry the original
// request. This makes the app self-healing across backend redeploys and old
// session tokens that no longer exist in the new backend's DB.
let _bootstrapPromise: Promise<string | null> | null = null;
async function bootstrapGuestSession(): Promise<string | null> {
  if (_bootstrapPromise) return _bootstrapPromise;
  _bootstrapPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Guest" }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const token = data?.session_token as string | undefined;
      if (token) {
        await setToken(token);
        return token;
      }
      return null;
    } catch {
      return null;
    } finally {
      // Clear the in-flight lock so future bootstraps (after signOut, etc.) can run.
      setTimeout(() => { _bootstrapPromise = null; }, 0);
    }
  })();
  return _bootstrapPromise;
}

async function rawFetch(path: string, opts: Opts, token: string | null) {
  const { method = "GET", body } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const { auth = true } = opts;
  let token = auth ? await getToken() : null;
  let res = await rawFetch(path, opts, token);

  // Self-healing: if 401 on an authenticated call, try to bootstrap a guest
  // session ONCE and retry the original request transparently.
  if (auth && res.status === 401) {
    await setToken(null);
    const fresh = await bootstrapGuestSession();
    if (fresh) {
      token = fresh;
      res = await rawFetch(path, opts, token);
    }
  }

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
