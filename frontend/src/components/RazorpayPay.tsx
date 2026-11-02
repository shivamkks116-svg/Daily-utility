/**
 * Razorpay (UPI / card) checkout — alternative to Google Play billing.
 * Opens our hosted checkout page in an in-app browser; the server verifies the
 * payment signature, grants Premium and emails a receipt.
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, fontWeight, radius, spacing } from "@/src/theme";
import { api, API_BASE } from "@/src/api/client";
import { useSubscription } from "@/src/subscription/RevenueCat";

type Plans = { enabled: boolean; plans: Record<string, { amount: number; label: string }> };

export function RazorpayPay() {
  const sub = useSubscription();
  const [cfg, setCfg] = useState<Plans | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<Plans>("/razorpay/plans").then(setCfg).catch(() => {});
  }, []);

  if (!cfg?.enabled || sub.isSubscribed) return null;

  const pay = async (plan: string) => {
    setBusy(plan);
    try {
      const { order_id } = await api<{ order_id: string }>("/razorpay/order", { method: "POST", body: { plan } });
      const res = await WebBrowser.openAuthSessionAsync(`${API_BASE}/razorpay/checkout/${order_id}`, "dailyhubai://pay");
      const status = res.type === "success" ? new URL(res.url).searchParams.get("status") : "closed";
      await sub.refresh();
      if (status === "success") Alert.alert("Welcome to Premium! 🎉", "Payment received. A receipt has been sent to your email.");
      else if (status === "failed") Alert.alert("Payment failed", "No money was taken. Please try again.");
      else if (status === "pending") Alert.alert("Confirming payment", "If money was deducted, Premium activates within a few minutes.");
    } catch (e: unknown) {
      Alert.alert("Payment", (e as Error)?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.card} testID="razorpay-card">
      <View style={styles.head}>
        <Ionicons name="card" size={18} color={colors.brandPrimary} />
        <Text style={styles.title}>Or pay with UPI / Card</Text>
      </View>
      <Text style={styles.sub}>Secure payment by Razorpay · GPay, PhonePe, Paytm, cards, net banking</Text>
      <View style={styles.row}>
        {Object.entries(cfg.plans).map(([key, p]) => (
          <Pressable
            key={key}
            testID={`razorpay-pay-${key}`}
            onPress={() => pay(key)}
            disabled={!!busy}
            style={({ pressed }) => [styles.btn, (pressed || busy === key) && { opacity: 0.8 }]}
          >
            {busy === key ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Text style={styles.btnLabel}>{p.label.replace("Premium ", "")}</Text>
                <Text style={styles.btnPrice}>₹{(p.amount / 100).toFixed(0)}</Text>
              </>
            )}
          </Pressable>
        ))}
      </View>
      <Text style={styles.note}>One-time payment, no auto-renew. Full refund within 7 days.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  sub: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs },
  row: { flexDirection: "row", gap: spacing.sm },
  btn: {
    flex: 1, minHeight: 56, borderRadius: radius.md, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  btnLabel: { color: colors.onBrandPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  btnPrice: { color: colors.onBrandPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  note: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, textAlign: "center" },
});
