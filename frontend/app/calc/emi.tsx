import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

function fmt(n: number) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function EMICalc() {
  const router = useRouter();
  const [amount, setAmount] = useState("500000");
  const [rate, setRate] = useState("8.5");
  const [years, setYears] = useState("5");

  const result = useMemo(() => {
    const P = parseFloat(amount) || 0;
    const R = (parseFloat(rate) || 0) / 12 / 100;
    const N = (parseFloat(years) || 0) * 12;
    if (P <= 0 || R <= 0 || N <= 0) return { emi: 0, total: 0, interest: 0 };
    const emi = (P * R * Math.pow(1 + R, N)) / (Math.pow(1 + R, N) - 1);
    const total = emi * N;
    return { emi, total, interest: total - P };
  }, [amount, rate, years]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="emi-calc">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="calc-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>EMI Calculator</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <KeyboardAwareScrollView contentContainerStyle={styles.body} bottomOffset={20}>
        <Field label="Loan Amount ($)" value={amount} onChange={setAmount} testID="emi-amount" />
        <Field label="Annual Interest Rate (%)" value={rate} onChange={setRate} testID="emi-rate" />
        <Field label="Tenure (Years)" value={years} onChange={setYears} testID="emi-years" />

        <View style={styles.result}>
          <Text style={styles.resultLabel}>MONTHLY EMI</Text>
          <Text style={styles.resultBig} testID="emi-monthly">${fmt(result.emi)}</Text>
          <View style={styles.split}>
            <View><Text style={styles.splitLabel}>Total Payable</Text><Text style={styles.splitValue}>${fmt(result.total)}</Text></View>
            <View><Text style={styles.splitLabel}>Total Interest</Text><Text style={styles.splitValue}>${fmt(result.interest)}</Text></View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field({ label, value, onChange, testID }: { label: string; value: string; onChange: (s: string) => void; testID: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.onSurfaceTertiary}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  body: { padding: spacing.xl, gap: spacing.lg },
  field: { gap: spacing.sm },
  fieldLabel: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: "uppercase", letterSpacing: 1 },
  input: {
    color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.semibold,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  result: {
    marginTop: spacing.md, padding: spacing.xl,
    borderRadius: radius.lg, backgroundColor: colors.brandTertiary, gap: spacing.md,
  },
  resultLabel: { color: colors.brandPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  resultBig: { color: colors.onSurface, fontSize: 44, fontWeight: fontWeight.extrabold, letterSpacing: -1 },
  split: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  splitLabel: { color: colors.onBrandTertiary, fontSize: fontSize.xs, textTransform: "uppercase", letterSpacing: 0.5 },
  splitValue: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: 2 },
});
