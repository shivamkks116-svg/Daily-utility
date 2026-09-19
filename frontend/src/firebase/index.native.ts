/**
 * Firebase Authentication adapter (native builds only).
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

// Guard imports — never crash bundling on unsupported platforms.
// On the actual Android APK, Platform.OS is "android" and native modules
// are linked, so requires() succeed. On Expo Go, requires() throw and we
// fall back to unavailable. We deliberately don't check
// `Constants.executionEnvironment` here because some builds surface it as
// undefined / "bare" inconsistently.
const nativeReady = Platform.OS !== "web";

let auth: any = null;
let GoogleSignin: any = null;

if (nativeReady) {
  try {
    // The RNFirebase v22 API — default export is a function returning the auth module.
     
    auth = require("@react-native-firebase/auth").default;
  } catch (e) {
    console.warn("[Firebase] @react-native-firebase/auth unavailable:", e);
  }
  try {
     
    GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
  } catch (e) {
    console.warn("[Firebase] @react-native-google-signin unavailable:", e);
  }
}

export const firebaseNativeAvailable = !!auth;

/* ------------------------------------------------------------------ */
/*                            Configure                                */
/* ------------------------------------------------------------------ */

const env: Record<string, string | undefined> =
  ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env) ?? {};
const WEB_CLIENT_ID = env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID || "";

let _configured = false;
export function configureFirebaseAuth() {
  if (!nativeReady || !GoogleSignin || _configured) return;
  if (!WEB_CLIENT_ID) {
    console.warn("[Firebase] EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID missing — Google Sign-In disabled.");
    return;
  }
  try {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: false,
    });
    _configured = true;
  } catch (e) {
    console.warn("[Firebase] GoogleSignin.configure failed:", e);
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

/**
 * Safe dev-only logger.  Emits under the "DailyHubAuth" tag so it's trivial
 * to filter in adb logcat (`adb logcat -s "ReactNativeJS:*" | grep DailyHubAuth`).
 * NEVER logs tokens, credentials, or PII — only error codes / short messages.
 */
function authLog(event: string, data?: Record<string, unknown>) {
  if (!__DEV__ && !env.EXPO_PUBLIC_AUTH_DEBUG) return;
  const safe: Record<string, unknown> = { event };
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      // Explicitly redact anything token-shaped.
      if (/token|credential|password|secret|apikey|api_key/i.test(k)) {
        safe[k] = "[REDACTED]";
      } else if (typeof v === "string" && v.length > 120) {
        safe[k] = v.slice(0, 120) + "…";
      } else {
        safe[k] = v;
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log("[DailyHubAuth]", JSON.stringify(safe));
}

/** Map Google Sign-In error codes to human-actionable diagnostics. */
function diagnoseGoogleError(e: unknown): { code: string; hint: string } {
  const err = e as { code?: string | number; message?: string; nativeErrorCode?: string };
  const code = String(err?.code ?? err?.nativeErrorCode ?? "UNKNOWN");
  const map: Record<string, string> = {
    // react-native-google-signin string codes
    SIGN_IN_CANCELLED: "User cancelled the Google Sign-In sheet.",
    IN_PROGRESS: "Another Google Sign-In is already in progress.",
    PLAY_SERVICES_NOT_AVAILABLE: "Google Play Services is missing or outdated on this device.",
    SIGN_IN_REQUIRED: "User must sign in again.",
    // GoogleSignInStatusCodes numeric codes
    "10": "DEVELOPER_ERROR — SHA-1 fingerprint mismatch OR wrong Web Client ID. Check Firebase Console → Project settings → Your Android app → SHA certificate fingerprints, and confirm google-services.json was re-downloaded after adding SHA-1.",
    "12500": "SIGN_IN_FAILED — Generic Google client failure. Usually caused by Play Services or config mismatch.",
    "12501": "SIGN_IN_CANCELLED — User closed the picker.",
    "12502": "SIGN_IN_CURRENTLY_IN_PROGRESS — Another sign-in already running.",
    "7": "NETWORK_ERROR — No network reachable.",
    "8": "INTERNAL_ERROR — Google Play Services internal problem. Try restarting device.",
    "16": "API_UNAVAILABLE — Play Services unavailable for this API.",
    "17": "SIGN_IN_CANCELLED_BY_USER — User dismissed the Google account picker.",
  };
  return { code, hint: map[code] || err?.message || "Unknown Google Sign-In error." };
}

export async function getFreshIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth) return null;
  const u = auth().currentUser;
  if (!u) return null;
  try { return await u.getIdToken(forceRefresh); } catch { return null; }
}

/** Sign in with Google — returns a fresh ID token to send to /auth/firebase. */
export async function signInWithGoogle(): Promise<string> {
  if (!auth || !GoogleSignin) throw new Error("Firebase native module unavailable (install a dev build).");
  configureFirebaseAuth();

  authLog("google:start", { webClientIdConfigured: !!WEB_CLIENT_ID });

  // Ensure Play Services on Android (throws if missing).
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

  // Trigger native sign-in.
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

  // v14+ returns { data: { idToken, user } }, older returns { idToken }
  const r = res as { data?: { idToken?: string }; idToken?: string };
  const idToken = r?.data?.idToken || r?.idToken;
  if (!idToken) {
    authLog("google:no_id_token", { shape: Object.keys((r || {}) as object) });
    throw new Error("Google Sign-In returned no ID token. Check that Web Client ID matches the Firebase Web SDK config.");
  }
  authLog("google:got_id_token"); // NOTE: token itself never logged

  // Exchange with Firebase to bind identity.
  try {
    const GoogleAuthProvider = auth.GoogleAuthProvider;
    const credential = GoogleAuthProvider.credential(idToken);
    const fbRes = await auth().signInWithCredential(credential);
    authLog("firebase:credential_ok", { uidPresent: !!fbRes?.user?.uid });

    // Return the Firebase ID token (NOT the Google one) so backend can verify uniformly.
    const fbToken = await fbRes.user.getIdToken(true);
    authLog("firebase:id_token_minted");
    return fbToken;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    authLog("firebase:credential_fail", { code: err?.code, message: err?.message });
    throw new Error(`Firebase credential error [${err?.code || "?"}]: ${err?.message || String(e)}`);
  }
}

/** Check whether an email is already registered (to decide sign-in vs sign-up). */
export async function fetchEmailSignInMethods(email: string): Promise<string[]> {
  if (!auth) throw new Error("Firebase unavailable.");
  try {
    const methods = await auth().fetchSignInMethodsForEmail(email.trim());
    return Array.isArray(methods) ? methods : [];
  } catch (e: unknown) {
    // Rethrow with cleaner message
    const code = (e as { code?: string })?.code || "";
    if (code === "auth/invalid-email") throw new Error("Please enter a valid email address.");
    throw e as Error;
  }
}

/** Sign in with email/password — returns Firebase ID token. */
export async function signInWithEmail(email: string, password: string): Promise<string> {
  if (!auth) throw new Error("Firebase unavailable.");
  const res = await auth().signInWithEmailAndPassword(email.trim(), password);
  return await res.user.getIdToken(true);
}

/**
 * Sign up with email/password + displayName. Sends verification email
 * automatically. Returns Firebase ID token so backend can create the user.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<string> {
  if (!auth) throw new Error("Firebase unavailable.");
  const res = await auth().createUserWithEmailAndPassword(email.trim(), password);
  if (displayName) {
    try { await res.user.updateProfile({ displayName }); } catch {}
  }
  // Fire-and-forget verification email
  try { await res.user.sendEmailVerification(); } catch { /* non-fatal */ }
  return await res.user.getIdToken(true);
}

/** Send a password-reset email via Firebase (auto-templated). */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!auth) throw new Error("Firebase unavailable.");
  await auth().sendPasswordResetEmail(email.trim());
}

/** Resend the email-verification email for the current user. */
export async function resendEmailVerification(): Promise<void> {
  if (!auth) throw new Error("Firebase unavailable.");
  const u = auth().currentUser;
  if (!u) throw new Error("No signed-in Firebase user.");
  await u.sendEmailVerification();
}

/** Reload current user (used after they clicked the verification link). */
export async function reloadCurrentUser(): Promise<FirebaseUserSlim | null> {
  if (!auth) return null;
  const u = auth().currentUser;
  if (!u) return null;
  try { await u.reload(); } catch {}
  return slim(auth().currentUser);
}

/** Sign out from both Firebase and Google Sign-In (best-effort). */
export async function firebaseSignOut(): Promise<void> {
  if (!auth) return;
  try { await auth().signOut(); } catch {}
  try {
    if (GoogleSignin) {
      const has = await GoogleSignin.hasPreviousSignIn?.();
      if (has) await GoogleSignin.signOut();
    }
  } catch {}
}

/** Translate raw Firebase error codes into human-friendly messages. */
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
    "12501": "Google Sign-In was cancelled.",
    "SIGN_IN_CANCELLED": "Google Sign-In was cancelled.",
  };
  return map[code] || msg;
}
