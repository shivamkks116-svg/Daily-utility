/**
 * Firebase Authentication adapter (native builds only) — uses the MODULAR
 * API from `@react-native-firebase/auth` v22+.
 *
 *   • Google Sign-In via `@react-native-google-signin/google-signin`
 *   • Email/Password + password-reset + email-verification via
 *     `@react-native-firebase/auth`
 *
 * On web / Expo Go, `index.web.ts` is selected by Metro and returns stubbed
 * functions that throw a friendly "install a dev build" error so the UI never
 * crashes.
 */
import { Platform } from "react-native";

const nativeReady = Platform.OS !== "web";

// Load-time marker (visible in adb logcat under ReactNativeJS).
console.log("[DailyHubAuth]", JSON.stringify({
  event: "module_loaded",
  variant: "native",
  platform: Platform.OS,
  nativeReady,
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
let fbAuth: any = null;              // whole @react-native-firebase/auth module
let GoogleSignin: any = null;
let authLoadError: string | null = null;
let googleLoadError: string | null = null;

if (nativeReady) {
  try {
    // v22+ uses named exports — DO NOT use `.default`.
     
    fbAuth = require("@react-native-firebase/auth");
    // Force-load the app entry so RNFBAppModule registers before any call.
    try {  require("@react-native-firebase/app"); } catch { /* ok */ }
    console.log("[DailyHubAuth]", JSON.stringify({
      event: "require_ok",
      module: "@react-native-firebase/auth",
      hasGetAuth: typeof fbAuth?.getAuth === "function",
      hasProvider: typeof fbAuth?.GoogleAuthProvider !== "undefined",
      keys: Object.keys(fbAuth || {}).slice(0, 8),
    }));
  } catch (e) {
    const err = e as { message?: string; code?: string };
    authLoadError = err?.message || String(e);
    console.warn("[DailyHubAuth]", JSON.stringify({
      event: "require_fail",
      module: "@react-native-firebase/auth",
      code: err?.code,
      message: authLoadError,
    }));
  }

  try {
     
    GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
    console.log("[DailyHubAuth]", JSON.stringify({
      event: "require_ok",
      module: "@react-native-google-signin/google-signin",
      hasGoogleSignin: !!GoogleSignin,
    }));
  } catch (e) {
    const err = e as { message?: string; code?: string };
    googleLoadError = err?.message || String(e);
    console.warn("[DailyHubAuth]", JSON.stringify({
      event: "require_fail",
      module: "@react-native-google-signin/google-signin",
      code: err?.code,
      message: googleLoadError,
    }));
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Consider "linked" only if the modular API surface is present.
const authLinked =
  !!fbAuth && typeof fbAuth.getAuth === "function" && !!fbAuth.GoogleAuthProvider;

export const firebaseNativeAvailable = authLinked;

/** Detailed reason why native firebase is unavailable (for debug UI). */
export function getFirebaseUnavailableReason(): string | null {
  if (authLinked && GoogleSignin) return null;
  const parts: string[] = [];
  if (!fbAuth) parts.push(`auth-module: ${authLoadError || "not resolved"}`);
  else if (!authLinked) {
    parts.push(
      `auth-module: modular API missing (getAuth=${typeof fbAuth.getAuth}, GoogleAuthProvider=${typeof fbAuth.GoogleAuthProvider})`,
    );
  }
  if (!GoogleSignin) parts.push(`google-signin: ${googleLoadError || "not linked"}`);
  return parts.join(" | ");
}

/* ------------------------------------------------------------------ */
/*                            Configure                                */
/* ------------------------------------------------------------------ */

// Metro inlines `process.env.EXPO_PUBLIC_*` literals at bundle time — use
// DIRECT access here, not via a proxy variable, so the string is baked in.
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID || "";

// Load-time diagnostic — logs a length so we can confirm inlining without
// leaking the actual client-id.
console.log("[DailyHubAuth]", JSON.stringify({
  event: "env_check",
  webClientIdLength: WEB_CLIENT_ID.length,
  webClientIdSuffix: WEB_CLIENT_ID ? WEB_CLIENT_ID.slice(-14) : "",
}));

let _configured = false;
export function configureFirebaseAuth() {
  if (!nativeReady || !GoogleSignin) {
    console.warn("[DailyHubAuth]", JSON.stringify({
      event: "configure_skip",
      reason: !nativeReady ? "not_native" : "google_signin_null",
    }));
    return;
  }
  if (_configured) return;
  if (!WEB_CLIENT_ID) {
    console.warn("[DailyHubAuth]", JSON.stringify({
      event: "configure_fail",
      reason: "EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID not inlined — check .env and rebuild.",
    }));
    return;
  }
  try {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: false,
    });
    _configured = true;
    console.log("[DailyHubAuth]", JSON.stringify({ event: "configure_ok" }));
  } catch (e) {
    console.warn("[DailyHubAuth]", JSON.stringify({
      event: "configure_fail",
      message: (e as { message?: string })?.message || String(e),
    }));
  }
}

/* ------------------------------------------------------------------ */
/*                          Public helpers                             */
/* ------------------------------------------------------------------ */

export type FirebaseUserSlim = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
};

function slim(u: unknown): FirebaseUserSlim | null {
  const usr = u as { uid?: string; email?: string | null; displayName?: string | null;
                     photoURL?: string | null; emailVerified?: boolean } | null;
  if (!usr) return null;
  return {
    uid: usr.uid || "",
    email: usr.email ?? null,
    displayName: usr.displayName ?? null,
    photoURL: usr.photoURL ?? null,
    emailVerified: !!usr.emailVerified,
  };
}

/** Safe dev-only logger. Never logs tokens or credentials. */
function authLog(event: string, data?: Record<string, unknown>) {
  if (!__DEV__ && !process.env.EXPO_PUBLIC_AUTH_DEBUG) return;
  const safe: Record<string, unknown> = { event };
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      if (/token|credential|password|secret|apikey|api_key/i.test(k)) {
        safe[k] = "[REDACTED]";
      } else if (typeof v === "string" && v.length > 120) {
        safe[k] = v.slice(0, 120) + "…";
      } else {
        safe[k] = v;
      }
    }
  }
   
  console.log("[DailyHubAuth]", JSON.stringify(safe));
}

function diagnoseGoogleError(e: unknown): { code: string; hint: string } {
  const err = e as { code?: string | number; message?: string; nativeErrorCode?: string };
  const code = String(err?.code ?? err?.nativeErrorCode ?? "UNKNOWN");
  const map: Record<string, string> = {
    SIGN_IN_CANCELLED: "User cancelled the Google Sign-In sheet.",
    IN_PROGRESS: "Another Google Sign-In is already in progress.",
    PLAY_SERVICES_NOT_AVAILABLE: "Google Play Services missing or outdated.",
    SIGN_IN_REQUIRED: "User must sign in again.",
    "10": "DEVELOPER_ERROR — SHA-1 fingerprint mismatch OR wrong Web Client ID.",
    "12500": "SIGN_IN_FAILED — Config mismatch or Play Services issue.",
    "12501": "SIGN_IN_CANCELLED — User closed the picker.",
    "12502": "SIGN_IN_CURRENTLY_IN_PROGRESS.",
    "7": "NETWORK_ERROR — no network reachable.",
    "8": "INTERNAL_ERROR — Play Services internal problem.",
    "16": "API_UNAVAILABLE — Play Services unavailable.",
    "17": "SIGN_IN_CANCELLED_BY_USER.",
  };
  return { code, hint: map[code] || err?.message || "Unknown Google Sign-In error." };
}

/* ---------- Auth helpers using MODULAR API ---------- */

function getAuthInstance() {
  return fbAuth.getAuth();
}

export async function getFreshIdToken(forceRefresh = false): Promise<string | null> {
  if (!authLinked) return null;
  const auth = getAuthInstance();
  const u = auth.currentUser;
  if (!u) return null;
  try { return await u.getIdToken(forceRefresh); } catch { return null; }
}

export async function signInWithGoogle(): Promise<string> {
  if (!authLinked || !GoogleSignin) {
    throw new Error("Firebase native module unavailable (install a dev build).");
  }
  configureFirebaseAuth();
  authLog("google:start", { webClientIdConfigured: !!WEB_CLIENT_ID });

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    authLog("google:play_services_ok");
  } catch (e) {
    const d = diagnoseGoogleError(e);
    authLog("google:play_services_fail", { code: d.code, hint: d.hint });
    const err = new Error(`Google Play Services error [${d.code}]: ${d.hint}`);
    (err as { code?: string }).code = d.code;
    throw err;
  }

  let res: unknown;
  try {
    res = await GoogleSignin.signIn();
    authLog("google:picker_success");
  } catch (e) {
    const d = diagnoseGoogleError(e);
    authLog("google:picker_fail", { code: d.code, hint: d.hint });
    const err = new Error(`Google Sign-In error [${d.code}]: ${d.hint}`);
    (err as { code?: string }).code = d.code;
    throw err;
  }

  const r = res as { data?: { idToken?: string }; idToken?: string };
  const idToken = r?.data?.idToken || r?.idToken;
  if (!idToken) {
    authLog("google:no_id_token", { shape: Object.keys((r || {}) as object) });
    throw new Error("Google Sign-In returned no ID token. Check Web Client ID.");
  }
  authLog("google:got_id_token");

  try {
    const credential = fbAuth.GoogleAuthProvider.credential(idToken);
    const auth = getAuthInstance();
    const fbRes = await fbAuth.signInWithCredential(auth, credential);
    authLog("firebase:credential_ok", { uidPresent: !!fbRes?.user?.uid });
    const fbToken = await fbRes.user.getIdToken(true);
    authLog("firebase:id_token_minted");
    return fbToken;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    authLog("firebase:credential_fail", { code: err?.code, message: err?.message });
    throw new Error(`Firebase credential error [${err?.code || "?"}]: ${err?.message || String(e)}`);
  }
}

export async function fetchEmailSignInMethods(email: string): Promise<string[]> {
  if (!authLinked) throw new Error("Firebase unavailable.");
  try {
    const auth = getAuthInstance();
    const methods = await fbAuth.fetchSignInMethodsForEmail(auth, email.trim());
    return Array.isArray(methods) ? methods : [];
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code || "";
    if (code === "auth/invalid-email") throw new Error("Please enter a valid email address.");
    throw e as Error;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<string> {
  if (!authLinked) throw new Error("Firebase unavailable.");
  const auth = getAuthInstance();
  const res = await fbAuth.signInWithEmailAndPassword(auth, email.trim(), password);
  return await res.user.getIdToken(true);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<string> {
  if (!authLinked) throw new Error("Firebase unavailable.");
  const auth = getAuthInstance();
  const res = await fbAuth.createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName) {
    try { await fbAuth.updateProfile(res.user, { displayName }); } catch {}
  }
  try { await fbAuth.sendEmailVerification(res.user); } catch { /* non-fatal */ }
  return await res.user.getIdToken(true);
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!authLinked) throw new Error("Firebase unavailable.");
  const auth = getAuthInstance();
  await fbAuth.sendPasswordResetEmail(auth, email.trim());
}

export async function resendEmailVerification(): Promise<void> {
  if (!authLinked) throw new Error("Firebase unavailable.");
  const auth = getAuthInstance();
  const u = auth.currentUser;
  if (!u) throw new Error("No signed-in Firebase user.");
  await fbAuth.sendEmailVerification(u);
}

export async function reloadCurrentUser(): Promise<FirebaseUserSlim | null> {
  if (!authLinked) return null;
  const auth = getAuthInstance();
  const u = auth.currentUser;
  if (!u) return null;
  try { await u.reload(); } catch {}
  return slim(auth.currentUser);
}

export async function firebaseSignOut(): Promise<void> {
  if (!authLinked) return;
  try { await fbAuth.signOut(getAuthInstance()); } catch {}
  try {
    if (GoogleSignin) {
      const has = await GoogleSignin.hasPreviousSignIn?.();
      if (has) await GoogleSignin.signOut();
    }
  } catch {}
}

export function humanizeFirebaseError(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  const msg = (e as { message?: string })?.message || String(e);
  const map: Record<string, string> = {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-not-found": "No account found for this email. Try signing up.",
    "auth/wrong-password": "Incorrect password. Try again or reset your password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "This email is already registered. Try signing in.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please try again in a few minutes.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/operation-not-allowed": "Google/Email sign-in provider is disabled in Firebase Console.",
    "12501": "Google Sign-In was cancelled.",
    "SIGN_IN_CANCELLED": "Google Sign-In was cancelled.",
  };
  return map[code] || msg;
}
