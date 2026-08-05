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
  if (!/^\d{4,6}$/.test(pin)) return false;
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
  available: boolean;
};

export async function checkBiometrics(): Promise<BiometricSupport> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return { hasHardware, isEnrolled, available: hasHardware && isEnrolled };
  } catch {
    return { hasHardware: false, isEnrolled: false, available: false };
  }
}

export async function biometricPrompt(reason = "Unlock DailyHub AI"): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Use PIN",
      disableDeviceFallback: true,
    });
    return res.success === true;
  } catch {
    return false;
  }
}
