import { storage } from "@/src/utils/storage";

// Production backend URL (hardcoded fallback so shipped APKs always work,
// even if .env is missing during local Windows builds). In dev, EXPO_PUBLIC_BACKEND_URL
// from .env will override this.
const PROD_BACKEND_URL = "https://daily-utility-ai.emergent.host";
const ENV_BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const BACKEND = (ENV_BACKEND && ENV_BACKEND.trim().length > 0 ? ENV_BACKEND : PROD_BACKEND_URL) as string;
export const API_BASE = `${BACKEND}/api`;
export const AUTH_TOKEN_KEY = "dailyhub_session_token";
export const AUTH_PROVIDER_KEY = "dailyhub_auth_provider"; // "google" | "guest"

let _tokenCache: string | null | undefined;
let _providerCache: string | null | undefined;

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

export async function getProvider(): Promise<string | null> {
  if (_providerCache !== undefined) return _providerCache;
  const p = await storage.secureGet<string>(AUTH_PROVIDER_KEY, "");
  _providerCache = p || null;
  return _providerCache;
}

export async function setProvider(provider: "google" | "guest" | null) {
  _providerCache = provider;
  if (provider) await storage.secureSet(AUTH_PROVIDER_KEY, provider);
  else await storage.secureRemove(AUTH_PROVIDER_KEY);
}

type Opts = { method?: string; body?: unknown; auth?: boolean };

// Silent guest bootstrap: if we hit 401 anywhere and don't already have a valid
// session, transparently create a fresh guest session and retry the original
// request. This makes the app self-healing across backend redeploys and old
// session tokens that no longer exist in the new backend's DB.
let _bootstrapPromise: Promise<string | null> | null = null;
async function bootstrapGuestSession(): Promise<string | null> {
  if (_bootstrapPromise) return _bootstrapPromise;
  console.log("[Auth] bootstrapGuestSession INVOKED — creating new anonymous guest");
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
        await setProvider("guest");
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
  const initialToken = auth ? await getToken() : null;
  let token = initialToken;
  let res = await rawFetch(path, opts, token);

  // Self-healing: ONLY bootstrap a fresh guest session when the caller was
  // truly anonymous (no token in storage) and the backend rejected the call.
  // We must NEVER silently overwrite an existing signed-in session (Google or
  // guest) with a brand-new guest identity — that used to cause the bug where
  // clearing the app from recent apps changed the visible name to "Guest".
  //
  // Additionally, /auth/me is a pure identity probe: if it 401s we surface the
  // error so AuthContext can route the user to the login screen instead of
  // masking the failure with a new guest.
  const isAuthMe = path === "/auth/me";
  const canSelfHeal = auth && res.status === 401 && !initialToken && !isAuthMe;
  if (auth && res.status === 401) {
    console.log("[Auth] api() got 401 for", path, "initialToken?", !!initialToken, "canSelfHeal?", canSelfHeal);
  }
  if (canSelfHeal) {
    const fresh = await bootstrapGuestSession();
    if (fresh) {
      token = fresh;
      res = await rawFetch(path, opts, token);
    }
  }

  if (res.status === 401) {
    // Clear the (now-invalid) token so subsequent app boots don't keep hitting
    // the same dead session. Do NOT create a replacement session here.
    if (initialToken) {
      await setToken(null);
      await setProvider(null);
    }
    throw new Error("Unauthorized");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const rawDetail = data && (data.detail ?? data.message);
    const structured = rawDetail && typeof rawDetail === "object" ? rawDetail : null;
    const msg =
      (structured && (structured.message || structured.error)) ||
      (typeof rawDetail === "string" ? rawDetail : null) ||
      `HTTP ${res.status}`;
    const err = new Error(typeof msg === "string" ? msg : "Request failed") as Error & {
      status?: number;
      detail?: unknown;
    };
    err.status = res.status;
    err.detail = rawDetail;
    throw err;
  }
  return data as T;
}
