import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

const CALCS = [
  { key: "scientific", label: "Scientific", desc: "Full scientific calculator.", icon: "calculator", route: "/calc/scientific" },
  { key: "emi",        label: "EMI",        desc: "Loan EMI, interest & total payable.", icon: "trending-down", route: "/calc/emi" },
  { key: "sip",        label: "SIP",        desc: "Systematic Investment Plan projections.", icon: "trending-up", route: "/calc/sip" },
  { key: "currency",   label: "Currency",   desc: "Live exchange rates.", icon: "cash", route: "/calc/currency" },
  { key: "unit",       label: "Unit Converter", desc: "Length, weight, temperature & more.", icon: "swap-horizontal", route: "/calc/unit" },
];

export default function CalcHub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="calc-hub">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="calc-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Calculators</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: insets.bottom + 40 }}>
        {CALCS.map((c) => (
          <Pressable
            key={c.key}
            testID={`calc-${c.key}`}
            onPress={() => router.push(c.route as any)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.icon}>
              <Ionicons name={c.icon as any} size={22} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{c.label}</Text>
              <Text style={styles.rowDesc}>{c.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  icon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  rowDesc: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
});
