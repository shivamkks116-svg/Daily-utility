import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

type UnitDef = { key: string; label: string; toBase: (v: number) => number; fromBase: (v: number) => number };
type Cat = { key: string; label: string; units: UnitDef[] };

const CATS: Cat[] = [
  {
    key: "length", label: "Length",
    units: [
      { key: "m",  label: "Meter",      toBase: v => v,        fromBase: v => v },
      { key: "km", label: "Kilometer",  toBase: v => v * 1000, fromBase: v => v / 1000 },
      { key: "cm", label: "Centimeter", toBase: v => v / 100,  fromBase: v => v * 100 },
      { key: "mm", label: "Millimeter", toBase: v => v / 1000, fromBase: v => v * 1000 },
      { key: "mi", label: "Mile",       toBase: v => v * 1609.344, fromBase: v => v / 1609.344 },
      { key: "yd", label: "Yard",       toBase: v => v * 0.9144, fromBase: v => v / 0.9144 },
      { key: "ft", label: "Foot",       toBase: v => v * 0.3048, fromBase: v => v / 0.3048 },
      { key: "in", label: "Inch",       toBase: v => v * 0.0254, fromBase: v => v / 0.0254 },
    ],
  },
  {
    key: "weight", label: "Weight",
    units: [
      { key: "kg", label: "Kilogram", toBase: v => v,          fromBase: v => v },
      { key: "g",  label: "Gram",     toBase: v => v / 1000,   fromBase: v => v * 1000 },
      { key: "mg", label: "Milligram",toBase: v => v / 1e6,    fromBase: v => v * 1e6 },
      { key: "lb", label: "Pound",    toBase: v => v * 0.45359237, fromBase: v => v / 0.45359237 },
      { key: "oz", label: "Ounce",    toBase: v => v * 0.0283495, fromBase: v => v / 0.0283495 },
    ],
  },
  {
    key: "temp", label: "Temperature",
    units: [
      { key: "c", label: "Celsius",    toBase: v => v,           fromBase: v => v },
      { key: "f", label: "Fahrenheit", toBase: v => (v - 32) * 5/9, fromBase: v => (v * 9/5) + 32 },
      { key: "k", label: "Kelvin",     toBase: v => v - 273.15,  fromBase: v => v + 273.15 },
    ],
  },
  {
    key: "time", label: "Time",
    units: [
      { key: "s",   label: "Second", toBase: v => v,        fromBase: v => v },
      { key: "min", label: "Minute", toBase: v => v * 60,   fromBase: v => v / 60 },
      { key: "h",   label: "Hour",   toBase: v => v * 3600, fromBase: v => v / 3600 },
      { key: "d",   label: "Day",    toBase: v => v * 86400,fromBase: v => v / 86400 },
    ],
  },
  {
    key: "data", label: "Data",
    units: [
      { key: "b",  label: "Byte",     toBase: v => v,        fromBase: v => v },
      { key: "kb", label: "Kilobyte", toBase: v => v * 1024, fromBase: v => v / 1024 },
      { key: "mb", label: "Megabyte", toBase: v => v * 1024**2, fromBase: v => v / 1024**2 },
      { key: "gb", label: "Gigabyte", toBase: v => v * 1024**3, fromBase: v => v / 1024**3 },
    ],
  },
];

export default function UnitConverter() {
  const router = useRouter();
  const [catKey, setCatKey] = useState("length");
  const cat = useMemo(() => CATS.find(c => c.key === catKey)!, [catKey]);
  const [from, setFrom] = useState(cat.units[0].key);
  const [to, setTo] = useState(cat.units[1].key);
  const [value, setValue] = useState("1");

  useEffect(() => {
    setFrom(cat.units[0].key);
    setTo(cat.units[1].key);
  }, [cat]);

  const result = useMemo(() => {
    const fromU = cat.units.find(u => u.key === from);
    const toU = cat.units.find(u => u.key === to);
    if (!fromU || !toU) return 0;
    const v = parseFloat(value) || 0;
    return toU.fromBase(fromU.toBase(v));
  }, [value, from, to, cat]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="unit-calc">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="calc-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Unit Converter</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.xl }}>
          {CATS.map(c => {
            const active = c.key === catKey;
            return (
              <Pressable
                key={c.key}
                testID={`cat-${c.key}`}
                onPress={() => setCatKey(c.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && { color: colors.onBrandPrimary }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.card}>
          <Text style={styles.label}>From</Text>
          <TextInput
            testID="unit-input"
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            style={styles.bigInput}
          />
          <UnitList units={cat.units} value={from} onChange={setFrom} prefix="from" />
        </View>

        <View style={styles.arrow}><Ionicons name="arrow-down" size={20} color={colors.brandPrimary} /></View>

        <View style={styles.card}>
          <Text style={styles.label}>To</Text>
          <Text style={styles.bigOut} testID="unit-result">
            {result.toLocaleString(undefined, { maximumFractionDigits: 6 })}
          </Text>
          <UnitList units={cat.units} value={to} onChange={setTo} prefix="to" />
        </View>
      </ScrollView>
    </View>
  );
}

function UnitList({ units, value, onChange, prefix }: { units: UnitDef[]; value: string; onChange: (s: string) => void; prefix: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.xl }}>
      {units.map(u => {
        const active = u.key === value;
        return (
          <Pressable
            key={u.key}
            testID={`${prefix}-${u.key}`}
            onPress={() => onChange(u.key)}
            style={[styles.uchip, active && styles.uchipActive]}
          >
            <Text style={[styles.uchipText, active && { color: colors.onBrandPrimary }]}>{u.label}</Text>
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
  chip: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  card: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  label: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1, textTransform: "uppercase" },
  bigInput: { color: colors.onSurface, fontSize: 40, fontWeight: fontWeight.extrabold, letterSpacing: -1, padding: 0, fontVariant: ["tabular-nums"] },
  bigOut: { color: colors.brandPrimary, fontSize: 40, fontWeight: fontWeight.extrabold, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  arrow: { alignItems: "center" },
  uchip: { height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  uchipActive: { backgroundColor: colors.brandPrimary },
  uchipText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
