import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";

/** Safe expression evaluator (numbers, + - * / % . ( ) and unary minus). */
function evalExpr(expr: string): number | null {
  const cleaned = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/π/g, String(Math.PI));
  if (!/^[-+*/%.()0-9\sMathsincoquartlgexpEΠπ]+$/.test(cleaned)) return null;
  if (!/^[-+*/%.()0-9\s]+$/.test(cleaned)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${cleaned});`)();
    return typeof v === "number" && isFinite(v) ? v : null;
  } catch { return null; }
}

const BUTTONS: (string | { label: string; op: string; wide?: boolean; kind?: "op" | "fn" | "eq" | "clear" })[][] = [
  [ { label: "sin", op: "sin(", kind: "fn" }, { label: "cos", op: "cos(", kind: "fn" }, { label: "tan", op: "tan(", kind: "fn" }, { label: "π", op: "π", kind: "fn" } ],
  [ { label: "√", op: "sqrt(", kind: "fn" }, { label: "x²", op: "^2", kind: "fn" }, { label: "log", op: "log(", kind: "fn" }, { label: "ln", op: "ln(", kind: "fn" } ],
  [ { label: "C", op: "C", kind: "clear" }, { label: "( )", op: "()", kind: "op" }, { label: "%", op: "%", kind: "op" }, { label: "÷", op: "/", kind: "op" } ],
  [ "7", "8", "9", { label: "×", op: "*", kind: "op" } ],
  [ "4", "5", "6", { label: "−", op: "-", kind: "op" } ],
  [ "1", "2", "3", { label: "+", op: "+", kind: "op" } ],
  [ { label: "±", op: "±", kind: "op" }, "0", ".", { label: "=", op: "=", kind: "eq" } ],
];

function applyFn(expr: string, op: string): string {
  if (op === "sqrt(") return expr + "Math.sqrt(";
  if (op === "log(") return expr + "Math.log10(";
  if (op === "ln(") return expr + "Math.log(";
  if (op === "sin(") return expr + "Math.sin(";
  if (op === "cos(") return expr + "Math.cos(";
  if (op === "tan(") return expr + "Math.tan(";
  if (op === "π") return expr + String(Math.PI);
  if (op === "^2") return expr + "**2";
  return expr + op;
}

function niceEval(expr: string): number | null {
  // Prefer the sanitized 'Math.*' expressions
  const cleaned = expr
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, String(Math.PI))
    .replace(/−/g, "-");
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${cleaned});`)();
    return typeof v === "number" && isFinite(v) ? v : null;
  } catch { return null; }
}

export default function ScientificCalc() {
  const router = useRouter();
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState<string>("0");

  const displayExpr = useMemo(() => (
    expr
      .replace(/Math\.sqrt\(/g, "√(")
      .replace(/Math\.log10\(/g, "log(")
      .replace(/Math\.log\(/g, "ln(")
      .replace(/Math\.sin\(/g, "sin(")
      .replace(/Math\.cos\(/g, "cos(")
      .replace(/Math\.tan\(/g, "tan(")
      .replace(/\*\*2/g, "²")
      .replace(/\*/g, "×")
      .replace(/\//g, "÷")
  ), [expr]);

  function press(b: any) {
    if (typeof b === "string") {
      setExpr(e => e + b);
      liveEval(expr + b);
      return;
    }
    if (b.kind === "clear") { setExpr(""); setResult("0"); return; }
    if (b.kind === "eq") {
      const v = niceEval(expr);
      if (v !== null) { setResult(String(v)); setExpr(String(v)); }
      return;
    }
    if (b.op === "()") {
      const opens = (expr.match(/\(/g) || []).length;
      const closes = (expr.match(/\)/g) || []).length;
      const add = opens <= closes ? "(" : ")";
      setExpr(e => e + add);
      liveEval(expr + add);
      return;
    }
    if (b.op === "±") {
      // Toggle sign at end token
      setExpr(e => {
        const m = e.match(/(-?\d*\.?\d+)$/);
        if (!m) return e;
        const start = e.length - m[0].length;
        const inv = m[0].startsWith("-") ? m[0].slice(1) : "-" + m[0];
        return e.slice(0, start) + inv;
      });
      return;
    }
    if (b.kind === "fn") { setExpr(e => applyFn(e, b.op)); return; }
    setExpr(e => e + b.op);
    liveEval(expr + b.op);
  }
  function liveEval(s: string) {
    const v = niceEval(s);
    if (v !== null) setResult(String(v));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="scientific-calc">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable testID="calc-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Scientific</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <View style={styles.display}>
        <Text style={styles.expr} numberOfLines={2} adjustsFontSizeToFit>
          {displayExpr || "0"}
        </Text>
        <Text style={styles.result} testID="calc-result">= {result}</Text>
      </View>

      <View style={styles.pad}>
        {BUTTONS.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((b, i) => {
              const label = typeof b === "string" ? b : b.label;
              const isEq = typeof b !== "string" && b.kind === "eq";
              const isOp = typeof b !== "string" && (b.kind === "op" || b.kind === "fn");
              const isClear = typeof b !== "string" && b.kind === "clear";
              return (
                <Pressable
                  key={i}
                  testID={`btn-${label}`}
                  onPress={() => press(b)}
                  style={({ pressed }) => [
                    styles.btn,
                    isEq && { backgroundColor: colors.brandPrimary },
                    isOp && { backgroundColor: colors.brandTertiary },
                    isClear && { backgroundColor: "#3B0E0A" },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.btnText, isEq && { color: colors.onBrandPrimary }, isClear && { color: colors.error }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
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
  display: { padding: spacing.xl, minHeight: 160, justifyContent: "flex-end" },
  expr: { color: colors.onSurfaceTertiary, fontSize: fontSize.xl, textAlign: "right", fontVariant: ["tabular-nums"] },
  result: { color: colors.onSurface, fontSize: 40, fontWeight: fontWeight.extrabold, textAlign: "right", marginTop: spacing.sm, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  pad: { padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  btn: {
    flex: 1, aspectRatio: 1.35, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  btnText: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.semibold },
});
