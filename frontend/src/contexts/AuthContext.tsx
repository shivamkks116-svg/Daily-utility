import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api, setToken, getToken, setProvider, getProvider } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import {
  configureFirebaseAuth,
  firebaseSignOut,
  signInWithGoogle as fbSignInWithGoogle,
  signInWithEmail as fbSignInWithEmail,
  signUpWithEmail as fbSignUpWithEmail,
  fetchEmailSignInMethods,
  sendPasswordReset,
  resendEmailVerification,
  reloadCurrentUser,
  getFreshIdToken,
  humanizeFirebaseError,
  firebaseNativeAvailable,
} from "@/src/firebase";

export type AuthProviderKind = "google" | "password" | "guest";

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  provider: AuthProviderKind | string;
  is_guest: boolean;
  email_verified?: boolean;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  firebaseNativeAvailable: boolean;

  // Firebase methods
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  fetchEmailSignInMethods: (email: string) => Promise<string[]>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendEmailVerification: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>; // reloads Firebase user and re-syncs backend

  // Legacy / anonymous
  signInAsGuest: (name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;

  humanizeFirebaseError: (e: unknown) => string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

// Cached user profile so cold-start doesn't flash "Guest" if /auth/me is slow
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

// Configure Google Sign-In once per app launch
try { configureFirebaseAuth(); } catch {}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const inflightRef = useRef(false);

  // Verify current app session vs backend. Only 401 demotes; network errors keep cache.
  const verifySession = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      await saveUserCache(null);
      await setProvider(null);
      return;
    }
    try {
      const res = await api<{ user: User }>("/auth/me");
      setUser(res.user);
      await saveUserCache(res.user);
      const p = res.user.provider;
      const marker: AuthProviderKind =
        p === "google" ? "google" : p === "password" ? "password" : "guest";
      await setProvider(marker as AuthProviderKind);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 401 || err.message === "Unauthorized") {
        await setToken(null);
        await setProvider(null);
        await saveUserCache(null);
        setUser(null);
      }
    }
  }, []);

  // Cold start
  useEffect(() => {
    (async () => {
      try {
        const cached = await loadUserCache();
        if (cached) setUser(cached);
        await verifySession();
      } finally {
        setLoading(false);
      }
    })();
  }, [verifySession]);

  /* ---------- Exchange helpers ---------- */

  const exchangeFirebaseIdToken = useCallback(async (idToken: string, provider: AuthProviderKind) => {
    const res = await api<{ session_token: string; user: User }>("/auth/firebase", {
      method: "POST",
      body: { id_token: idToken, provider },
      auth: false,
    });
    await setToken(res.session_token);
    await setProvider(provider);
    await saveUserCache(res.user);
    setUser(res.user);
  }, []);

  /* ---------- Public methods ---------- */

  const signInWithGoogle = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const idToken = await fbSignInWithGoogle();
      await exchangeFirebaseIdToken(idToken, "google");
    } finally {
      inflightRef.current = false;
    }
  }, [exchangeFirebaseIdToken]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const idToken = await fbSignInWithEmail(email, password);
      await exchangeFirebaseIdToken(idToken, "password");
    } finally {
      inflightRef.current = false;
    }
  }, [exchangeFirebaseIdToken]);

  const signUpWithEmail = useCallback(async (email: string, password: string, name?: string) => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const idToken = await fbSignUpWithEmail(email, password, name);
      await exchangeFirebaseIdToken(idToken, "password");
    } finally {
      inflightRef.current = false;
    }
  }, [exchangeFirebaseIdToken]);

  const refreshEmailVerification = useCallback(async () => {
    // Reload the Firebase user (they just clicked the verify link) and, if
    // now verified, re-mint a session so the backend flag flips too.
    const u = await reloadCurrentUser();
    if (!u) return false;
    if (u.emailVerified) {
      const idToken = await getFreshIdToken(true);
      if (idToken) await exchangeFirebaseIdToken(idToken, "password");
      return true;
    }
    return false;
  }, [exchangeFirebaseIdToken]);

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
    await firebaseSignOut();
    await setToken(null);
    await setProvider(null);
    await saveUserCache(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      firebaseNativeAvailable,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      fetchEmailSignInMethods,
      sendPasswordReset,
      resendEmailVerification,
      refreshEmailVerification,
      signInAsGuest,
      signOut,
      refresh: verifySession,
      humanizeFirebaseError,
    }),
    [user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail,
     refreshEmailVerification, signInAsGuest, signOut, verifySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Legacy helper for callers that still reference `AuthContext` directly
export { AuthContext };

// Legacy compatibility for getProvider (unchanged)
export { getProvider };
