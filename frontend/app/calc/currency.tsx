import { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ActivityIndicator, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "CNY", "AUD", "CAD", "CHF", "SGD"];

export default function CurrencyCalc() {
  const router = useRouter();
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("EUR");
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadRates(base: string) {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ base: string; date: string; rates: Record<string, number> }>(`/currency/rates?base=${base}`);
      setRates({ ...r.rates, [r.base]: 1 });
      setDate(r.date);
    } catch (e: any) {
      setError(e?.message || "Failed to load rates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRates(from); }, [from]);

  const converted = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const rate = rates[to] || 0;
    return a * rate;
  }, [amount, rates, to]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="currency-calc">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="calc-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.title}>Currency</Text>
          {date ? <Text style={styles.subtitle}>{date}</Text> : null}
        </View>
        <Pressable onPress={() => loadRates(from)} style={styles.iconBtn} testID="currency-refresh">
          <Ionicons name="refresh" size={18} color={colors.onSurface} />
        </Pressable>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <View style={styles.card}>
          <View style={styles.rowHead}>
            <Text style={styles.label}>From</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>{from}</Text></View>
          </View>
          <TextInput
            testID="currency-amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={styles.bigInput}
          />
          <PickerRow options={CURRENCIES} value={from} onChange={setFrom} testPrefix="from" />
        </View>

        <View style={styles.arrow}>
          <Ionicons name="arrow-down" size={22} color={colors.brandPrimary} />
        </View>

        <View style={styles.card}>
          <View style={styles.rowHead}>
            <Text style={styles.label}>To</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>{to}</Text></View>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.md }} />
          ) : (
            <Text style={styles.bigOut} testID="currency-result">
              {converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </Text>
          )}
          <PickerRow options={CURRENCIES} value={to} onChange={setTo} testPrefix="to" />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

function PickerRow({ options, value, onChange, testPrefix }: { options: string[]; value: string; onChange: (s: string) => void; testPrefix: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.xl }}>
      {options.map((c) => {
        const active = c === value;
        return (
          <Pressable
            key={c}
            testID={`${testPrefix}-${c}`}
            onPress={() => onChange(c)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && { color: colors.onBrandPrimary }]}>{c}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2 },
  card: {
    padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    gap: spacing.md,
  },
  rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1, textTransform: "uppercase" },
  badge: { paddingHorizontal: spacing.md, height: 24, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, justifyContent: "center" },
  badgeText: { color: colors.onBrandPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  bigInput: {
    color: colors.onSurface, fontSize: 40, fontWeight: fontWeight.extrabold, letterSpacing: -1,
    padding: 0, fontVariant: ["tabular-nums"],
  },
  bigOut: { color: colors.brandPrimary, fontSize: 40, fontWeight: fontWeight.extrabold, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  arrow: { alignItems: "center" },
  chip: {
    height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  error: { color: colors.error, textAlign: "center" },
});
