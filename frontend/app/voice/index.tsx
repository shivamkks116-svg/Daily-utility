import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList, Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import {
  useAudioRecorder, RecordingPresets, AudioModule,
  createAudioPlayer, setAudioModeAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { api } from "@/src/api/client";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type Voice = { id: string; title: string; duration_ms: number; mime_type: string; created_at: string };

function fmtMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function VoiceNotesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permOk, setPermOk] = useState<boolean | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [recStart, setRecStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playerRef = useRef<any>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Voice[] }>("/voice-notes");
      setItems(r.items);
    } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    (async () => {
      const p = await AudioModule.getRecordingPermissionsAsync();
      setPermOk(p.status === "granted");
      setCanAskAgain(p.canAskAgain ?? true);
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (recStart === null) return;
    const t = setInterval(() => setElapsed(Date.now() - recStart), 200);
    return () => clearInterval(t);
  }, [recStart]);

  async function askPerm() {
    const p = await AudioModule.requestRecordingPermissionsAsync();
    setPermOk(p.status === "granted");
    setCanAskAgain(p.canAskAgain ?? true);
  }

  async function startRec() {
    if (!permOk) {
      await askPerm();
      return;
    }
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecStart(Date.now());
    } catch (e) {
      console.warn("record start", e);
    }
  }

  async function stopRec() {
    if (recStart === null) return;
    const dur = Date.now() - recStart;
    setRecStart(null);
    setElapsed(0);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) return;
      setSaving(true);
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      await api("/voice-notes", {
        method: "POST",
        body: {
          title: `Voice ${new Date().toLocaleTimeString()}`,
          duration_ms: dur,
          audio_base64: b64,
          mime_type: "audio/m4a",
        },
      });
      load();
    } catch (e) {
      console.warn("save voice", e);
    } finally { setSaving(false); }
  }

  async function play(id: string) {
    try {
      if (playerRef.current) {
        try { await playerRef.current.remove(); } catch {}
        playerRef.current = null;
      }
      if (playingId === id) { setPlayingId(null); return; }
      const full = await api<{ audio_base64: string; mime_type: string }>(`/voice-notes/${id}`);
      const dataUri = `data:${full.mime_type || "audio/m4a"};base64,${full.audio_base64}`;
      const player = createAudioPlayer({ uri: dataUri });
      playerRef.current = player;
      player.addListener("playbackStatusUpdate", (s: any) => {
        if (s.didJustFinish) { setPlayingId(null); }
      });
      player.play();
      setPlayingId(id);
    } catch (e) {
      console.warn("play", e);
    }
  }

  async function del(id: string) {
    await api(`/voice-notes/${id}`, { method: "DELETE" });
    if (playingId === id) setPlayingId(null);
    load();
  }

  const recording = recStart !== null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="voice-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="voice-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Voice Notes</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      {permOk === false ? (
        <View style={styles.permWrap}>
          <View style={styles.permIcon}><Ionicons name="mic" size={30} color={colors.brandPrimary} /></View>
          <Text style={styles.permTitle}>Microphone access needed</Text>
          <Text style={styles.permSub}>To record voice notes you need to grant microphone permission.</Text>
          {canAskAgain ? (
            <Pressable testID="voice-request-perm" onPress={askPerm} style={styles.permBtn}>
              <Text style={styles.permBtnText}>Allow microphone</Text>
            </Pressable>
          ) : (
            <Pressable testID="voice-settings" onPress={() => Linking.openSettings()} style={styles.permBtn}>
              <Text style={styles.permBtnText}>Open Settings</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          <View style={styles.recCard}>
            <Text style={styles.recTime}>{recording ? fmtMs(elapsed) : "0:00"}</Text>
            <Text style={styles.recLabel}>{recording ? "Recording…" : "Tap to record"}</Text>
            <Pressable
              testID="voice-record-btn"
              onPress={recording ? stopRec : startRec}
              disabled={saving}
              style={({ pressed }) => [
                styles.recBtn,
                recording ? { backgroundColor: colors.error } : { backgroundColor: colors.brandPrimary },
                pressed && { opacity: 0.85 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.onBrandPrimary} />
              ) : (
                <Ionicons name={recording ? "stop" : "mic"} size={30} color={colors.onBrandPrimary} />
              )}
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.brandPrimary} />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + 24 }}
              ListEmptyComponent={
                <View style={styles.empty} testID="voice-empty">
                  <Text style={styles.emptyText}>No voice notes yet</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.row} testID={`voice-${item.id}`}>
                  <Pressable
                    testID={`voice-play-${item.id}`}
                    onPress={() => play(item.id)}
                    style={styles.playBtn}
                  >
                    <Ionicons name={playingId === item.id ? "pause" : "play"} size={18} color={colors.onBrandPrimary} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowSub}>{fmtMs(item.duration_ms)} · {new Date(item.created_at).toLocaleString()}</Text>
                  </View>
                  <Pressable onPress={() => del(item.id)} hitSlop={8} testID={`voice-del-${item.id}`}>
                    <Ionicons name="trash-outline" size={16} color={colors.onSurfaceTertiary} />
                  </Pressable>
                </View>
              )}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  recCard: {
    margin: spacing.lg, padding: spacing.xl,
    borderRadius: radius.lg, backgroundColor: colors.brandTertiary,
    alignItems: "center", gap: spacing.md,
  },
  recTime: { color: colors.onSurface, fontSize: 48, fontWeight: fontWeight.extrabold, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  recLabel: { color: colors.onBrandTertiary, fontSize: fontSize.base },
  recBtn: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
    marginTop: spacing.sm,
  },
  empty: { alignItems: "center", padding: spacing.xxl },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: fontSize.base },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  rowSub: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  permWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  permIcon: { width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  permTitle: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginTop: spacing.md },
  permSub: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, textAlign: "center" },
  permBtn: { marginTop: spacing.lg, height: 52, paddingHorizontal: spacing.xxl, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  permBtnText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.lg },
});
