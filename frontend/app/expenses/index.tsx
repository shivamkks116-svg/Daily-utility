import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardStickyView } from "@/src/utils/keyboard";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type Expense = {
  id: string;
  amount: number;
  kind: "expense" | "income";
  category: string;
  note?: string;
  date: string;
  created_at: string;
};

type ListResp = {
  items: Expense[];
  month: string;
  month_income: number;
  month_expense: number;
  month_balance: number;
};

const EXPENSE_CATEGORIES = ["Food", "Transport", "Bills", "Shopping", "Health", "Fun", "Other"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Gift", "Interest", "Other"];

function fmtMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  return `${sign}$${v.toFixed(2)}`;
}

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<ListResp>("/expenses");
      setData(r);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  async function submit() {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    setSaving(true);
    try {
      await api("/expenses", {
        method: "POST",
        body: { amount: amt, kind, category, note },
      });
      setAmount(""); setNote(""); setModal(false);
      load();
    } finally { setSaving(false); }
  }

  async function del(id: string) {
    await api(`/expenses/${id}`, { method: "DELETE" });
    load();
  }

  const cats = useMemo(() => (kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES), [kind]);
  useEffect(() => { setCategory(cats[0]); }, [cats]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="expenses-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="expenses-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Money</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>This month · {data?.month || ""}</Text>
        <Text style={styles.summaryBalance}>{fmtMoney(data?.month_balance ?? 0)}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryChip}>
            <Ionicons name="arrow-down" size={14} color={colors.success} />
            <Text style={styles.summaryChipText}>Income {fmtMoney(data?.month_income ?? 0)}</Text>
          </View>
          <View style={styles.summaryChip}>
            <Ionicons name="arrow-up" size={14} color={colors.error} />
            <Text style={styles.summaryChipText}>Spent {fmtMoney(data?.month_expense ?? 0)}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : (
        <FlatList
          data={data?.items || []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.sm, paddingBottom: insets.bottom + 120 }}
          ListEmptyComponent={
            <View style={styles.empty} testID="expenses-empty">
              <View style={styles.emptyIcon}>
                <Ionicons name="wallet-outline" size={30} color={colors.brandPrimary} />
              </View>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptySub}>Log your first expense or income with the + button.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row} testID={`expense-${item.id}`}>
              <View style={[styles.rowIcon, item.kind === "income" ? { backgroundColor: colors.brandTertiary } : { backgroundColor: "#3B0E0A" }]}>
                <Ionicons
                  name={item.kind === "income" ? "arrow-down" : "arrow-up"}
                  size={18}
                  color={item.kind === "income" ? colors.success : colors.error}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.category}</Text>
                {item.note ? <Text style={styles.rowSub}>{item.note}</Text> : null}
                <Text style={styles.rowDate}>{item.date}</Text>
              </View>
              <Text style={[styles.amount, item.kind === "income" ? { color: colors.success } : { color: colors.onSurface }]}>
                {item.kind === "income" ? "+" : "−"}{fmtMoney(item.amount)}
              </Text>
              <Pressable onPress={() => del(item.id)} hitSlop={8} testID={`expense-del-${item.id}`}>
                <Ionicons name="trash-outline" size={16} color={colors.onSurfaceTertiary} />
              </Pressable>
            </View>
          )}
        />
      )}

      <Pressable
        testID="expense-fab"
        onPress={() => setModal(true)}
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
      >
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModal(false)} />
          <KeyboardStickyView>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.tabs}>
                {(["expense", "income"] as const).map((k) => {
                  const active = k === kind;
                  return (
                    <Pressable
                      key={k}
                      testID={`expense-kind-${k}`}
                      onPress={() => setKind(k)}
                      style={[styles.tab, active && styles.tabActive]}
                    >
                      <Text style={[styles.tabText, active && { color: colors.onBrandPrimary }]}>
                        {k === "expense" ? "Expense" : "Income"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ marginTop: spacing.lg }}>
                <Text style={styles.label}>Amount</Text>
                <TextInput
                  testID="expense-amount"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.onSurfaceTertiary}
                  style={styles.amountInput}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.xl }}>
                {cats.map((c) => {
                  const active = c === category;
                  return (
                    <Pressable
                      key={c}
                      testID={`cat-${c}`}
                      onPress={() => setCategory(c)}
                      style={[styles.catChip, active && styles.catChipActive]}
                    >
                      <Text style={[styles.catText, active && { color: colors.onBrandPrimary }]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <TextInput
                testID="expense-note"
                value={note}
                onChangeText={setNote}
                placeholder="Note (optional)"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.noteInput}
              />
              <Pressable
                testID="expense-submit"
                onPress={submit}
                disabled={saving || !amount || isNaN(parseFloat(amount))}
                style={({ pressed }) => [
                  styles.submitBtn,
                  (saving || !amount || isNaN(parseFloat(amount))) && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
                  <Text style={styles.submitText}>Save entry</Text>
                )}
              </Pressable>
            </View>
          </KeyboardStickyView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  summary: {
    marginHorizontal: spacing.xl, marginBottom: spacing.md,
    padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
  },
  summaryLabel: { color: colors.onBrandTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  summaryBalance: {
    color: colors.onSurface, fontSize: 44, fontWeight: fontWeight.extrabold,
    letterSpacing: -1.5, marginTop: 4,
  },
  summaryRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  summaryChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.md, height: 30,
    borderRadius: radius.pill, backgroundColor: "rgba(17,20,18,0.5)",
  },
  summaryChipText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.md, marginTop: spacing.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  emptySub: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, textAlign: "center" },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  rowSub: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 2 },
  rowDate: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  amount: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
  fab: {
    position: "absolute", right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", elevation: 6,
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.xl, paddingBottom: spacing.xxxl,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.lg },
  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: {
    flex: 1, height: 44, borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center",
  },
  tabActive: { backgroundColor: colors.brandPrimary },
  tabText: { color: colors.onSurfaceSecondary, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  label: {
    color: colors.onSurfaceTertiary, fontSize: fontSize.xs,
    fontWeight: fontWeight.bold, letterSpacing: 1, textTransform: "uppercase",
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  amountInput: {
    color: colors.onSurface,
    fontSize: 44, fontWeight: fontWeight.extrabold, letterSpacing: -1,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  catChip: {
    height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  catChipActive: { backgroundColor: colors.brandPrimary },
  catText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  noteInput: {
    color: colors.onSurface, fontSize: fontSize.base,
    backgroundColor: colors.surfaceTertiary, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.lg,
  },
  submitBtn: {
    marginTop: spacing.xl, height: 52, borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
  },
  submitText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.lg },
});
