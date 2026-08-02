import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { colors, fontSize, fontWeight, spacing } from "@/src/theme";

type Note = {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  updated_at: string;
};

export default function NoteEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ items: Note[] }>("/notes");
        const n = res.items.find((x) => x.id === id);
        if (n) {
          setNote(n);
          setTitle(n.title);
          setContent(n.content);
          setPinned(n.pinned);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const persist = useCallback(async () => {
    if (!note) return;
    setSaving(true);
    try {
      await api(`/notes/${note.id}`, {
        method: "PUT",
        body: { title, content, color: note.color, pinned },
      });
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }, [note, title, content, pinned]);

  // Auto-save debounce
  useEffect(() => {
    if (!note) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { persist(); }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [title, content, pinned, note, persist]);

  async function del() {
    if (!note) return;
    await api(`/notes/${note.id}`, { method: "DELETE" });
    router.back();
  }

  if (loading || !note) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="note-editor">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="note-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={styles.savedIndicator}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.onSurfaceTertiary} />
          ) : savedAt ? (
            <>
              <Ionicons name="cloud-done" size={14} color={colors.brandPrimary} />
              <Text style={styles.savedText}>Saved</Text>
            </>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pressable
            testID="note-pin-btn"
            onPress={() => setPinned(p => !p)}
            style={styles.iconBtn}
          >
            <Ionicons
              name={pinned ? "bookmark" : "bookmark-outline"}
              size={20}
              color={pinned ? colors.brandPrimary : colors.onSurface}
            />
          </Pressable>
          <Pressable testID="note-delete-btn" onPress={del} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </Pressable>
        </View>
      </SafeAreaView>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        <TextInput
          testID="note-title-input"
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={colors.onSurfaceTertiary}
          style={styles.titleInput}
          multiline
        />
        <TextInput
          testID="note-content-input"
          value={content}
          onChangeText={setContent}
          placeholder="Start writing…"
          placeholderTextColor={colors.onSurfaceTertiary}
          style={styles.contentInput}
          multiline
          textAlignVertical="top"
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  savedIndicator: { flexDirection: "row", alignItems: "center", gap: 4 },
  savedText: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  titleInput: {
    color: colors.onSurface, fontSize: fontSize.xxxl,
    fontWeight: fontWeight.extrabold, letterSpacing: -1,
    minHeight: 48, padding: 0,
  },
  contentInput: {
    color: colors.onSurface, fontSize: fontSize.lg,
    marginTop: spacing.lg, minHeight: 300, padding: 0,
    lineHeight: 26,
  },
});
