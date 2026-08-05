import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  TextInput, Modal, Switch, Platform, Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardStickyView } from "@/src/utils/keyboard";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { api } from "@/src/api/client";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type Reminder = {
  id: string;
  kind: "water" | "medicine" | "custom";
  title: string;
  times: string[]; // "HH:MM"
  enabled: boolean;
  dose?: string | null;
  icon?: string | null;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function scheduleForReminder(r: Reminder) {
  if (Platform.OS === "web") return; // notifications APIs unavailable on web
  // Cancel prior ones with matching identifier prefix
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const s of all) {
    if (s.identifier.startsWith(`rmd_${r.id}_`)) {
      await Notifications.cancelScheduledNotificationAsync(s.identifier);
    }
  }
  if (!r.enabled) return;
  for (let i = 0; i < r.times.length; i++) {
    const t = r.times[i];
    const [hh, mm] = t.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `rmd_${r.id}_${i}`,
        content: {
          title: r.kind === "water" ? "💧 Water break" : r.kind === "medicine" ? "💊 Time for your medicine" : "🔔 Reminder",
          body: r.dose ? `${r.title} · ${r.dose}` : r.title,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hh, minute: mm } as any,
      });
    } catch (e) {
      // Local scheduling may fail on web; silently ignore
      console.warn("schedule", e);
    }
  }
}

const DEFAULT_TIMES_WATER = ["08:00", "10:30", "13:00", "15:30", "18:00", "20:30"];
const DEFAULT_TIMES_MED = ["09:00", "21:00"];

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { kind: routeKind } = useLocalSearchParams<{ kind?: string }>();

  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [kind, setKind] = useState<"water" | "medicine" | "custom">((routeKind as any) || "water");
  const [title, setTitle] = useState("");
  const [dose, setDose] = useState("");
  const [times, setTimes] = useState<string[]>(DEFAULT_TIMES_WATER);
  const [newTime, setNewTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [notifPerm, setNotifPerm] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Reminder[] }>("/reminders");
      setItems(r.items);
    } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    (async () => {
      const p = await Notifications.getPermissionsAsync();
      let granted = p.granted;
      if (!granted && p.canAskAgain) {
        const r = await Notifications.requestPermissionsAsync();
        granted = r.granted;
      }
      setNotifPerm(granted);
      if (Platform.OS === "android") {
        try {
          await Notifications.setNotificationChannelAsync("reminders", {
            name: "Reminders",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#5EBA8B",
          });
        } catch {}
      }
    })();
  }, []);

  useEffect(() => {
    if (kind === "water") setTimes(DEFAULT_TIMES_WATER);
    else if (kind === "medicine") setTimes(DEFAULT_TIMES_MED);
    else setTimes([]);
    setTitle(kind === "water" ? "Drink a glass of water" : kind === "medicine" ? "Take medicine" : "");
    setDose("");
  }, [kind]);

  function openNew(k?: "water" | "medicine" | "custom") {
    if (k) setKind(k);
    setModal(true);
  }

  async function submit() {
    if (!title.trim() || times.length === 0) return;
    setSaving(true);
    try {
      const doc = await api<Reminder>("/reminders", {
        method: "POST",
        body: { kind, title: title.trim(), dose: dose || null, times, enabled: true },
      });
      await scheduleForReminder(doc);
      setModal(false);
      load();
    } finally { setSaving(false); }
  }

  async function toggleEnable(r: Reminder) {
    const next = { ...r, enabled: !r.enabled };
    setItems(prev => prev.map(x => x.id === r.id ? next : x));
    await api(`/reminders/${r.id}`, {
      method: "PUT",
      body: { kind: next.kind, title: next.title, times: next.times, dose: next.dose, enabled: next.enabled },
    });
    await scheduleForReminder(next);
  }

  async function del(r: Reminder) {
    setItems(prev => prev.filter(x => x.id !== r.id));
    await api(`/reminders/${r.id}`, { method: "DELETE" });
    const all = Platform.OS === "web" ? [] : await Notifications.getAllScheduledNotificationsAsync();
    for (const s of all) if (s.identifier.startsWith(`rmd_${r.id}_`)) await Notifications.cancelScheduledNotificationAsync(s.identifier);
  }

  function addTime() {
    const m = newTime.match(/^([0-9]{1,2}):([0-9]{2})$/);
    if (!m) return;
    const h = parseInt(m[1], 10), mm = parseInt(m[2], 10);
    if (h > 23 || mm > 59) return;
    const norm = `${h.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
    if (!times.includes(norm)) setTimes([...times, norm].sort());
    setNewTime("");
  }

  const water = items.filter(i => i.kind === "water");
  const medicine = items.filter(i => i.kind === "medicine");
  const custom = items.filter(i => i.kind === "custom");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="reminders-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="rmd-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Reminders</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {notifPerm === false ? (
          <View style={styles.warnCard} testID="rmd-perm-warn">
            <Ionicons name="notifications-off" size={18} color={colors.warning} />
            <Text style={styles.warnText}>Notifications disabled. </Text>
            <Pressable onPress={() => Linking.openSettings()}><Text style={styles.warnLink}>Enable</Text></Pressable>
          </View>
        ) : null}

        <View style={styles.quickRow}>
          <QuickTile icon="water" label="Water" onPress={() => openNew("water")} testID="new-water" />
          <QuickTile icon="medkit" label="Medicine" onPress={() => openNew("medicine")} testID="new-medicine" />
          <QuickTile icon="notifications" label="Custom" onPress={() => openNew("custom")} testID="new-custom" />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.lg }} />
        ) : (
          <>
            <Group title="Water" data={water} onToggle={toggleEnable} onDelete={del} />
            <Group title="Medicine" data={medicine} onToggle={toggleEnable} onDelete={del} />
            <Group title="Custom" data={custom} onToggle={toggleEnable} onDelete={del} />
          </>
        )}
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModal(false)} />
          <KeyboardStickyView>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>New {kind} reminder</Text>
              <TextInput
                testID="rmd-title"
                value={title} onChangeText={setTitle}
                placeholder="Reminder title"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.input}
              />
              {kind === "medicine" ? (
                <TextInput
                  testID="rmd-dose"
                  value={dose} onChangeText={setDose}
                  placeholder="Dose (e.g. 1 pill)"
                  placeholderTextColor={colors.onSurfaceTertiary}
                  style={[styles.input, { marginTop: spacing.md }]}
                />
              ) : null}

              <Text style={styles.label}>Times</Text>
              <View style={styles.timesWrap}>
                {times.map(t => (
                  <View key={t} style={styles.timePill} testID={`time-${t}`}>
                    <Text style={styles.timeText}>{t}</Text>
                    <Pressable onPress={() => setTimes(times.filter(x => x !== t))} hitSlop={8}>
                      <Ionicons name="close" size={14} color={colors.onSurfaceTertiary} />
                    </Pressable>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <TextInput
                  testID="rmd-time-input"
                  value={newTime}
                  onChangeText={setNewTime}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.onSurfaceTertiary}
                  style={[styles.input, { flex: 1 }]}
                  keyboardType="numbers-and-punctuation"
                />
                <Pressable testID="rmd-time-add" onPress={addTime} style={styles.addBtn}>
                  <Ionicons name="add" size={22} color={colors.onBrandPrimary} />
                </Pressable>
              </View>

              <Pressable
                testID="rmd-submit"
                onPress={submit}
                disabled={saving || !title.trim() || times.length === 0}
                style={({ pressed }) => [styles.submit, (saving || !title.trim() || times.length === 0) && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
              >
                {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.submitText}>Save reminder</Text>}
              </Pressable>
            </View>
          </KeyboardStickyView>
        </View>
      </Modal>
    </View>
  );
}

function QuickTile({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.qTile}>
      <View style={styles.qIcon}><Ionicons name={icon} size={22} color={colors.brandPrimary} /></View>
      <Text style={styles.qLabel}>{label}</Text>
    </Pressable>
  );
}

function Group({ title, data, onToggle, onDelete }: {
  title: string; data: Reminder[];
  onToggle: (r: Reminder) => void; onDelete: (r: Reminder) => void;
}) {
  if (data.length === 0) return null;
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={{ gap: spacing.sm }}>
        {data.map(r => (
          <View key={r.id} style={styles.rmdRow} testID={`rmd-${r.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rmdTitle}>{r.title}</Text>
              <Text style={styles.rmdTimes}>{r.times.join(" · ")}{r.dose ? ` · ${r.dose}` : ""}</Text>
            </View>
            <Switch
              testID={`rmd-toggle-${r.id}`}
              value={r.enabled}
              onValueChange={() => onToggle(r)}
              trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
              thumbColor={r.enabled ? colors.onBrandPrimary : colors.onSurfaceTertiary}
            />
            <Pressable testID={`rmd-del-${r.id}`} onPress={() => onDelete(r)} hitSlop={8}>
              <Ionicons name="trash-outline" size={16} color={colors.onSurfaceTertiary} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  warnCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: "#3B2F0A", marginBottom: spacing.lg },
  warnText: { color: colors.onSurface, flex: 1 },
  warnLink: { color: colors.brandPrimary, fontWeight: fontWeight.bold },
  quickRow: { flexDirection: "row", gap: spacing.md },
  qTile: {
    flex: 1, padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    alignItems: "flex-start", gap: spacing.sm,
  },
  qIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  qLabel: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  groupTitle: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.sm },
  rmdRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  rmdTitle: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  rmdTimes: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: spacing.xxxl },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.lg },
  sheetTitle: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: spacing.md, textTransform: "capitalize" },
  input: { color: colors.onSurface, fontSize: fontSize.base, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md },
  label: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1, textTransform: "uppercase", marginTop: spacing.lg, marginBottom: spacing.sm },
  timesWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  timePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: spacing.md, paddingRight: spacing.sm, height: 30, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  timeText: { color: colors.onSurface, fontVariant: ["tabular-nums"], fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  addBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  submit: { marginTop: spacing.xl, height: 52, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  submitText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.lg },
});
