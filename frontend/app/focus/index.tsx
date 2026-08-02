import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

const MODES = {
  pomodoro: { label: "Focus", seconds: 25 * 60 },
  short_break: { label: "Short break", seconds: 5 * 60 },
  long_break: { label: "Long break", seconds: 15 * 60 },
} as const;
type Mode = keyof typeof MODES;

function format(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function FocusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("pomodoro");
  const [remaining, setRemaining] = useState(MODES.pomodoro.seconds);
  const [running, setRunning] = useState(false);
  const [todaySec, setTodaySec] = useState(0);
  const startedRef = useRef<number | null>(null);
  const durationRef = useRef(MODES.pomodoro.seconds);

  useEffect(() => {
    setRemaining(MODES[mode].seconds);
    durationRef.current = MODES[mode].seconds;
    setRunning(false);
    startedRef.current = null;
  }, [mode]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ today_seconds: number }>("/focus");
        setTodaySec(r.today_seconds || 0);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          finish(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  async function finish(completed: boolean) {
    setRunning(false);
    const durationSec = durationRef.current - remaining;
    if (durationSec > 0) {
      try {
        await api("/focus", {
          method: "POST",
          body: {
            mode,
            duration_seconds: durationSec,
            completed,
          },
        });
        setTodaySec((t) => t + durationSec);
      } catch {}
    }
    setRemaining(MODES[mode].seconds);
    durationRef.current = MODES[mode].seconds;
    startedRef.current = null;
  }

  function toggleRun() {
    if (running) {
      finish(false);
    } else {
      startedRef.current = Date.now();
      setRunning(true);
    }
  }

  function reset() {
    setRunning(false);
    setRemaining(MODES[mode].seconds);
    durationRef.current = MODES[mode].seconds;
  }

  const progress = 1 - remaining / MODES[mode].seconds;
  const size = 260;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="focus-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="focus-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Focus</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <View style={styles.modeRow}>
        {(Object.keys(MODES) as Mode[]).map((m) => {
          const active = m === mode;
          return (
            <Pressable
              key={m}
              testID={`mode-${m}`}
              onPress={() => setMode(m)}
              style={[styles.modeChip, active && styles.modeChipActive]}
            >
              <Text style={[styles.modeText, active && { color: colors.onBrandPrimary }]}>
                {MODES[m].label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.center}>
        <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
          <View style={[styles.ringBase, { width: size, height: size, borderRadius: size / 2 }]} />
          <View
            style={[
              styles.ringProgress,
              {
                width: size, height: size, borderRadius: size / 2,
                transform: [{ rotate: `${-90 + progress * 360}deg` }],
                opacity: running || progress > 0 ? 1 : 0.4,
              },
            ]}
          />
          <View style={styles.ringInner} testID="focus-timer-display">
            <Text style={styles.time}>{format(remaining)}</Text>
            <Text style={styles.modeLabel}>{MODES[mode].label}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Pressable testID="focus-reset-btn" onPress={reset} style={styles.secondaryBtn}>
          <Ionicons name="refresh" size={20} color={colors.onSurface} />
        </Pressable>
        <Pressable
          testID="focus-toggle-btn"
          onPress={toggleRun}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name={running ? "pause" : "play"} size={26} color={colors.onBrandPrimary} />
          <Text style={styles.primaryText}>{running ? "Pause" : "Start"}</Text>
        </Pressable>
        <View style={styles.secondaryBtn}>
          <Ionicons name="flame" size={14} color={colors.brandPrimary} />
          <Text style={styles.todayText}>{Math.round(todaySec / 60)}m</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  modeRow: {
    flexDirection: "row", gap: spacing.sm, justifyContent: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  modeChip: {
    height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    justifyContent: "center",
  },
  modeChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  modeText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  ringBase: {
    position: "absolute", borderWidth: 6, borderColor: colors.surfaceTertiary,
  },
  ringProgress: {
    position: "absolute", borderWidth: 6,
    borderColor: "transparent",
    borderTopColor: colors.brandPrimary,
    borderRightColor: colors.brandPrimary,
  },
  ringInner: {
    alignItems: "center", justifyContent: "center",
  },
  time: {
    color: colors.onSurface,
    fontSize: 72, fontWeight: fontWeight.extrabold, letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },
  modeLabel: { color: colors.onSurfaceTertiary, fontSize: fontSize.md, marginTop: spacing.sm, letterSpacing: 1, textTransform: "uppercase" },
  controls: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
  },
  secondaryBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", gap: 2,
    borderWidth: 1, borderColor: colors.border,
  },
  todayText: { color: colors.onSurface, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  primaryBtn: {
    flexDirection: "row", gap: spacing.md,
    paddingHorizontal: spacing.xxl, height: 60,
    borderRadius: radius.pill, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  primaryText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.xl },
});
