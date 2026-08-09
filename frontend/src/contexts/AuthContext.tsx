import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api, setToken, getToken, setProvider } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

// Prevent auth session from being blocked on web
WebBrowser.maybeCompleteAuthSession();

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  provider: "google" | "guest";
  is_guest: boolean;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: (name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

const AUTH_ORIGIN = "https://auth.emergentagent.com";
// Cached user profile so cold-start doesn't flash "Guest" if /auth/me is slow
// or transiently unreachable. Persisted as a JSON string in AsyncStorage.
const USER_CACHE_KEY = "dailyhub_user_cache_v1";

async function saveUserCache(user: User | null) {
  try {
    if (user) await storage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else await storage.removeItem(USER_CACHE_KEY);
  } catch {}
}

async function loadUserCache(): Promise<User | null> {
  try {
    const raw = await storage.getItem<string>(USER_CACHE_KEY, "");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.user_id) return parsed as User;
    return null;
  } catch {
    return null;
  }
}

function extractSessionId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const processedIds = useRef<Set<string>>(new Set());

  // Verify the current session against the backend. This is the ONLY place we
  // are allowed to demote a signed-in user to null. It distinguishes between:
  //   * 401 (dead session) -> sign the user out
  //   * network / transient error -> keep the cached user visible
  const verifySession = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      await saveUserCache(null);
      return;
    }
    try {
      const res = await api<{ user: User }>("/auth/me");
      setUser(res.user);
      await saveUserCache(res.user);
      // Keep provider marker consistent with what backend reports.
      await setProvider(res.user.provider === "google" ? "google" : "guest");
    } catch (e: any) {
      // Only clear on definite auth failure. Network errors leave the cached
      // user intact so users don't see "Guest" flash on flaky connections /
      // cold starts.
      if (e && (e.status === 401 || e.message === "Unauthorized")) {
        await setToken(null);
        await setProvider(null);
        await saveUserCache(null);
        setUser(null);
      }
      // else: swallow, keep cached user
    }
  }, []);

  const exchangeSessionId = useCallback(async (sid: string) => {
    if (processedIds.current.has(sid)) return;
    processedIds.current.add(sid);
    const res = await api<{ session_token: string; user: User }>("/auth/session", {
      method: "POST",
      body: { session_id: sid },
      auth: false,
    });
    await setToken(res.session_token);
    await setProvider("google");
    await saveUserCache(res.user);
    setUser(res.user);
  }, []);

  // Cold start + hot links (mobile) + URL hash (web)
  useEffect(() => {
    let sub: ReturnType<typeof Linking.addEventListener> | undefined;
    (async () => {
      try {
        // 1) Optimistic hydration from local cache so the UI never flashes
        //    "Guest" while the network round-trip is in flight.
        const cached = await loadUserCache();
        if (cached) setUser(cached);

        // 2) Handle any OAuth callback session_id from cold-start URL.
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const href = window.location.href;
          const sid = extractSessionId(href);
          if (sid) {
            try {
              await exchangeSessionId(sid);
              // Clean session_id from URL
              const url = new URL(href);
              url.searchParams.delete("session_id");
              url.hash = url.hash.replace(/[?#&]?session_id=[^&#]+/, "");
              window.history.replaceState(window.history.state, "", url.toString());
            } catch (e) {
              console.warn("web session exchange failed", e);
            }
          }
        } else {
          const initial = await Linking.getInitialURL();
          if (initial) {
            const sid = extractSessionId(initial);
            if (sid) {
              try { await exchangeSessionId(sid); } catch (e) { console.warn(e); }
            }
          }
          sub = Linking.addEventListener("url", async ({ url }) => {
            const sid = extractSessionId(url);
            if (sid) {
              try { await exchangeSessionId(sid); } catch (e) { console.warn(e); }
            }
          });
        }

        // 3) Verify the session with backend. Network errors will not clobber
        //    the cached user; only a real 401 will demote to signed-out.
        await verifySession();
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      if (sub && "remove" in sub) sub.remove();
    };
  }, [exchangeSessionId, verifySession]);

  const signInWithGoogle = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin + "/"
        : Linking.createURL("");
    const authUrl = `${AUTH_ORIGIN}/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = authUrl;
      return;
    }

    // Register listener BEFORE opening
    let captured: string | null = null;
    const listener = Linking.addEventListener("url", ({ url }) => {
      if (!captured) captured = url;
    });

    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      let cbUrl: string | null = null;
      if (result.type === "success" && (result as any).url) {
        cbUrl = (result as any).url;
      }
      if (!cbUrl) cbUrl = captured;
      if (!cbUrl) cbUrl = await Linking.getInitialURL();
      if (cbUrl) {
        const sid = extractSessionId(cbUrl);
        if (sid) await exchangeSessionId(sid);
      }
    } finally {
      listener.remove();
    }
  }, [exchangeSessionId]);

  const signInAsGuest = useCallback(async (name?: string) => {
    const res = await api<{ session_token: string; user: User }>("/auth/guest", {
      method: "POST",
      body: { name: name || "Guest" },
      auth: false,
    });
    await setToken(res.session_token);
    await setProvider("guest");
    await saveUserCache(res.user);
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch {}
    await setToken(null);
    await setProvider(null);
    await saveUserCache(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signInWithGoogle, signInAsGuest, signOut, refresh: verifySession }),
    [user, loading, signInWithGoogle, signInAsGuest, signOut, verifySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
