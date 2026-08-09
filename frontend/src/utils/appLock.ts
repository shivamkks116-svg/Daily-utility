// App Lock helper — PIN (secure) + optional biometric.
// PIN is stored via SecureStore as a lightweight hash (djb2). We are not aiming for
// bank-grade security here — the goal is to prevent casual snooping when someone
// picks up an unlocked phone. Biometric prompt (when available) is preferred.
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
  types: number[];        // supported auth types (fingerprint = 1, facial = 2, iris = 3)
  hasFingerprint: boolean;
  hasFace: boolean;
  available: boolean;
};

export async function checkBiometrics(): Promise<BiometricSupport> {
  try {
    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
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

// Rich biometric prompt that surfaces the exact failure reason. Callers can
// display a helpful message and decide whether to auto-retry.
export async function biometricPrompt(reason = "Unlock DailyHub AI"): Promise<BiometricResult> {
  try {
    // On some Android OEMs (Xiaomi/OnePlus/Realme) `disableDeviceFallback: true`
    // causes the biometric sheet to close instantly if the user hasn't set a
    // device screen lock, or if the OEM's HAL has quirks. Leaving it false lets
    // Android show its native "Use PIN/pattern" fallback if biometric hardware
    // is temporarily unavailable — the app then falls back to our own PIN pad
    // via the `res.error` we surface below.
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Use PIN",
      fallbackLabel: "Use PIN",
      disableDeviceFallback: false,
      requireConfirmation: false,
    });
    if (res.success) return { success: true };
    // res.error values: "user_cancel", "system_cancel", "user_fallback", "lockout",
    // "app_cancel", "invalid_context", "not_enrolled", "not_available", "unknown"
    const err = (res as { error?: string; warning?: string }).error || "unknown";
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
      return "Fingerprint cancelled. Please enter your PIN instead.";
    case "lockout":
      return "Too many failed attempts. Please enter your PIN.";
    case "lockout_permanent":
      return "Fingerprint is locked. Please unlock your device with PIN.";
    case "not_enrolled":
      return "No fingerprint enrolled on this device. Please use PIN.";
    case "not_available":
      return "Fingerprint sensor not available. Please use PIN.";
    case "authentication_failed":
      return "Fingerprint didn't match. Try again or use PIN.";
    default:
      return "Fingerprint failed. Please use PIN.";
  }
}
