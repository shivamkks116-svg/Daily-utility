import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  AppState,
  AppStateStatus,
  Platform,
  Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { getAppLock } from "@/src/utils/settings";
import {
  biometricErrorMessage,
  biometricPrompt,
  checkBiometrics,
  isPinSet,
  verifyPin,
  type BiometricSupport,
} from "@/src/utils/appLock";

// Global helper used elsewhere (e.g., right after user enables App Lock) to skip
// the immediate lock prompt for the current session.
let SKIP_NEXT_LOCK = false;
export function skipNextLock() {
  SKIP_NEXT_LOCK = true;
}

// Lock after being backgrounded for more than this many ms
const LOCK_TIMEOUT_MS = 15_000;

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [pinBuf, setPinBuf] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [bio, setBio] = useState<BiometricSupport>({
    hasHardware: false, isEnrolled: false, types: [], hasFingerprint: false, hasFace: false, available: false,
  });
  const [shake, setShake] = useState(false);
  const [bioErr, setBioErr] = useState<string | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  const backgroundedAtRef = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const autoTriggeredRef = useRef<boolean>(false);
  const bioBusyRef = useRef<boolean>(false);

  // Minimal, bulletproof unlock — the SIMPLEST possible path so nothing else
  // in the codebase can accidentally re-lock the app.
  const commitUnlock = useCallback(() => {
    console.log("[AppLock] UNLOCK NOW");
    if (Platform.OS === "android") Vibration.vibrate(15);
    bioBusyRef.current = false;
    autoTriggeredRef.current = false;
    setLocked(false);
    setPinBuf("");
    setBioErr(null);
    setBioBusy(false);
  }, []);

  const maybeLock = useCallback(async () => {
    console.log("[AppLock] maybeLock() called");
    if (SKIP_NEXT_LOCK) {
      console.log("[AppLock] SKIP_NEXT_LOCK true, skipping lock");
      SKIP_NEXT_LOCK = false;
      return;
    }
    const enabled = await getAppLock();
    if (!enabled) {
      console.log("[AppLock] App Lock disabled in prefs — skipping");
      return;
    }
    const pinReady = await isPinSet();
    if (!pinReady) {
      console.log("[AppLock] No PIN set — skipping");
      return;
    }
    setHasPin(pinReady);
    const bioInfo = await checkBiometrics();
    console.log("[AppLock] Biometric support:", bioInfo);
    setBio(bioInfo);
    setBioErr(null);
    autoTriggeredRef.current = false;
    bioBusyRef.current = false;
    setLocked(true);
    setPinBuf("");
    console.log("[AppLock] setLocked(true) — showing lock screen");
  }, []);

  // Initial mount — attempt lock right away if enabled.
  useEffect(() => {
    maybeLock();
  }, [maybeLock]);

  // Listen for background/foreground transitions.
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      console.log("[AppLock] AppState:", prev, "->", next);
      if (next === "background" || next === "inactive") {
        backgroundedAtRef.current = Date.now();
      } else if (next === "active" && (prev === "background" || prev === "inactive")) {
        const bgAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        const elapsed = bgAt ? Date.now() - bgAt : 0;
        console.log("[AppLock] Resumed from", prev, "after", elapsed, "ms");
        if (bgAt && elapsed >= LOCK_TIMEOUT_MS) {
          maybeLock();
        }
      }
    });
    return () => sub.remove();
  }, [maybeLock]);

  const tryBiometric = useCallback(async () => {
    if (bioBusyRef.current) {
      console.log("[AppLock] tryBiometric: busy, skipping");
      return;
    }
    console.log("[AppLock] tryBiometric: starting biometric prompt");
    bioBusyRef.current = true;
    setBioBusy(true);
    setBioErr(null);
    const reason = bio.hasFace
      ? "Unlock DailyHub AI"
      : "Place your finger to unlock DailyHub AI";
    let res;
    try {
      res = await biometricPrompt(reason);
      console.log("[AppLock] biometricPrompt returned:", JSON.stringify(res));
    } catch (e) {
      console.log("[AppLock] biometricPrompt threw:", e);
      res = { success: false as const, error: "unknown", canRetry: true };
    }
    bioBusyRef.current = false;
    setBioBusy(false);
    if (res && res.success) {
      console.log("[AppLock] SUCCESS — calling commitUnlock");
      commitUnlock();
      return;
    }
    const errCode = res && !res.success ? res.error : "unknown";
    console.log("[AppLock] FAIL —", errCode);
    setBioErr(biometricErrorMessage(errCode));
  }, [bio.hasFace, commitUnlock]);

  // Auto-trigger biometric ONCE when lock screen appears (only if available).
  useEffect(() => {
    if (locked && bio.available && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      // Longer delay so the lock UI fully paints before native prompt opens.
      const t = setTimeout(() => {
        tryBiometric();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [locked, bio.available, tryBiometric]);

  const pressDigit = useCallback(
    async (d: string) => {
      if (!locked) return;
      const next = (pinBuf + d).slice(0, 4);
      setPinBuf(next);
      if (next.length >= 4) {
        const ok = await verifyPin(next);
        if (ok) {
          // Universal deferred unlock — same path as biometric success.
          commitUnlock();
        } else {
          // wrong 4-digit PIN — reset with feedback
          if (Platform.OS === "android") Vibration.vibrate(80);
          setShake(true);
          setTimeout(() => {
            setShake(false);
            setPinBuf("");
          }, 350);
        }
      }
    },
    [pinBuf, locked, commitUnlock],
  );

  const backspace = useCallback(() => setPinBuf((b) => b.slice(0, -1)), []);

  // Simplest possible render check — plain state.
  console.log("[AppLock] render: locked=", locked);
  if (!locked) return <>{children}</>;

  return (
    <View style={styles.root} testID="app-lock-screen">
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={styles.top}>
          <View style={styles.logoBox}>
            <Ionicons name="lock-closed" size={30} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.title}>DailyHub AI</Text>
          <Text style={styles.subtitle}>
            {!hasPin
              ? "App Lock not configured"
              : bio.available
              ? bio.hasFingerprint
                ? "Use your fingerprint or PIN to unlock"
                : bio.hasFace
                ? "Use face unlock or PIN"
                : "Use biometrics or PIN"
              : "Enter your PIN to unlock"}
          </Text>
        </View>

        <View style={styles.middle}>
          <View style={[styles.dots, shake && { transform: [{ translateX: -6 }] }]}> 
            {[0, 1, 2, 3].map((i) => {
              const filled = i < pinBuf.length;
              return <View key={i} style={[styles.dot, filled && styles.dotFilled]} />;
            })}
          </View>

          {bio.available ? (
            <Pressable
              onPress={tryBiometric}
              disabled={bioBusy}
              style={[styles.bioBtn, bioBusy && { opacity: 0.6 }]}
              testID="lock-biometric"
              accessibilityLabel="Use fingerprint to unlock"
            >
              <Ionicons
                name={bio.hasFace && !bio.hasFingerprint ? "scan-outline" : "finger-print"}
                size={20}
                color={colors.brandPrimary}
              />
              <Text style={styles.bioText}>
                {bioBusy
                  ? "Waiting for scan…"
                  : bio.hasFingerprint
                  ? "Use fingerprint"
                  : bio.hasFace
                  ? "Use face unlock"
                  : "Use biometrics"}
              </Text>
            </Pressable>
          ) : null}

          {bioErr ? (
            <Text style={styles.bioErr} testID="lock-bio-error">
              {bioErr}
            </Text>
          ) : null}
        </View>

        <View style={styles.pad}>
          {[
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            ["", "0", "⌫"],
          ].map((row, ri) => (
            <View key={ri} style={styles.padRow}>
              {row.map((k, ci) => {
                if (!k) return <View key={ci} style={styles.key} />;
                if (k === "⌫") {
                  return (
                    <Pressable
                      key={ci}
                      style={styles.key}
                      android_ripple={{ color: colors.borderStrong, borderless: true }}
                      onPress={backspace}
                      testID="lock-backspace"
                    >
                      <Ionicons name="backspace-outline" size={26} color={colors.onSurface} />
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    key={ci}
                    style={styles.key}
                    android_ripple={{ color: colors.borderStrong, borderless: true }}
                    onPress={() => pressDigit(k)}
                    testID={`lock-digit-${k}`}
                  >
                    <Text style={styles.keyText}>{k}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
    zIndex: 9999,
  },
  top: { alignItems: "center", paddingTop: spacing.xxxl },
  logoBox: {
    width: 64, height: 64, borderRadius: radius.lg,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.onSurface,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  middle: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xl },
  dots: {
    flexDirection: "row",
    gap: spacing.md,
  },
  dot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  dotFilled: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  bioBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  bioText: {
    color: colors.brandPrimary,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.sm,
  },
  bioErr: {
    color: colors.error,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  pad: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  padRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  key: {
    flex: 1,
    aspectRatio: 1.6,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  keyText: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: fontWeight.bold,
  },
});
