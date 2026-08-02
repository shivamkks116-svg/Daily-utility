import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api, setToken, getToken } from "@/src/api/client";

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

function extractSessionId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const processedIds = useRef<Set<string>>(new Set());

  const loadMe = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      return;
    }
    try {
      const res = await api<{ user: User }>("/auth/me");
      setUser(res.user);
    } catch {
      setUser(null);
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
    setUser(res.user);
  }, []);

  // Cold start + hot links (mobile) + URL hash (web)
  useEffect(() => {
    let sub: ReturnType<typeof Linking.addEventListener> | undefined;
    (async () => {
      try {
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

        await loadMe();
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      if (sub && "remove" in sub) sub.remove();
    };
  }, [exchangeSessionId, loadMe]);

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
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch {}
    await setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signInWithGoogle, signInAsGuest, signOut, refresh: loadMe }),
    [user, loading, signInWithGoogle, signInAsGuest, signOut, loadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
