// App Lock helper — PIN (secure) + optional biometric.
// PIN is stored via SecureStore as a lightweight hash (djb2). We are not aiming
// for bank-grade security here — the goal is to prevent casual snooping when
// someone picks up an unlocked phone. Biometric prompt (when available) is
// preferred, with our own PIN pad as a reliable fallback.
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";

const PIN_KEY = "applock.pin.hash.v1";

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

export async function isPinSet(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(PIN_KEY);
    return !!v;
  } catch {
    return false;
  }
}

export async function setPin(pin: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false;
  try {
    await SecureStore.setItemAsync(PIN_KEY, djb2(pin));
    return true;
  } catch {
    return false;
  }
}

export async function clearPin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PIN_KEY);
  } catch {
    // ignore
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const stored = await SecureStore.getItemAsync(PIN_KEY);
    if (!stored) return false;
    return stored === djb2(pin);
  } catch {
    return false;
  }
}

export type BiometricSupport = {
  hasHardware: boolean;
  isEnrolled: boolean;
  types: number[];
  hasFingerprint: boolean;
  hasFace: boolean;
  available: boolean;
};

export async function checkBiometrics(): Promise<BiometricSupport> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    let types: number[] = [];
    try {
      types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch {
      types = [];
    }
    const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    return {
      hasHardware,
      isEnrolled,
      types,
      hasFingerprint,
      hasFace,
      available: hasHardware && isEnrolled,
    };
  } catch {
    return { hasHardware: false, isEnrolled: false, types: [], hasFingerprint: false, hasFace: false, available: false };
  }
}

export type BiometricResult =
  | { success: true }
  | { success: false; error: string; canRetry: boolean };

// SIMPLE, defensive biometric prompt — no cancelAuthenticate calls (they crash
// on some OEMs), no fancy racing. Just a plain authenticateAsync wrapped in a
// try/catch that never throws. Returns a discriminated union so callers can
// display a friendly message.
export async function biometricPrompt(reason = "Unlock DailyHub AI"): Promise<BiometricResult> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Use PIN",
      fallbackLabel: "Use PIN",
      disableDeviceFallback: true,
    });
    if (res && res.success === true) return { success: true };
    const err = (res as { error?: string } | undefined)?.error || "unknown";
    const canRetry = !["lockout", "lockout_permanent", "not_enrolled", "not_available", "user_cancel", "user_fallback"].includes(err);
    return { success: false, error: err, canRetry };
  } catch (e: unknown) {
    const msg = (e as { message?: string } | null)?.message || "unknown";
    return { success: false, error: msg, canRetry: true };
  }
}

// Human-friendly error message for a biometric failure code.
export function biometricErrorMessage(err: string): string {
  switch (err) {
    case "user_cancel":
    case "user_fallback":
    case "app_cancel":
    case "system_cancel":
      return "Fingerprint cancelled. Enter your PIN below.";
    case "lockout":
      return "Too many failed attempts. Enter your PIN.";
    case "lockout_permanent":
      return "Fingerprint locked. Enter your PIN.";
    case "not_enrolled":
      return "No fingerprint enrolled. Enter your PIN.";
    case "not_available":
      return "Fingerprint sensor unavailable. Enter your PIN.";
    case "authentication_failed":
      return "Fingerprint didn't match. Try again or enter PIN.";
    default:
      return "Fingerprint failed. Enter your PIN below.";
  }
}
