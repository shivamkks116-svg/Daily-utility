/**
 * Shared UI primitives for the PDF & Image toolkits. Small, dependency-free
 * building blocks that stay 100% consistent with the existing DailyHub AI
 * "Moss/Emerald" Material You theme.
 */
import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fontSize, fontWeight } from "@/src/theme";
import { LinearGradient } from "expo-linear-gradient";

type IconName = keyof typeof Ionicons.glyphMap;

export function ToolkitHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={h.wrap}>
      {onBack ? (
        <Pressable onPress={onBack} style={h.iconBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
      ) : <View style={{ width: 40 }} />}
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={h.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={h.sub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={{ width: 40, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

const h = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary },
  title: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sub: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
});

export function ToolCard({
  icon,
  label,
  desc,
  onPress,
  tint,
  soon,
  favorite,
  onFav,
}: {
  icon: IconName;
  label: string;
  desc?: string;
  onPress?: () => void;
  tint?: string;
  soon?: boolean;
  favorite?: boolean;
  onFav?: () => void;
}) {
  const gradientEnd = tint || colors.brandTertiary;
  return (
    <Pressable
      onPress={soon ? undefined : onPress}
      style={({ pressed }) => [
        c.card,
        pressed && !soon ? { opacity: 0.8, transform: [{ scale: 0.98 }] } : null,
        soon ? { opacity: 0.55 } : null,
      ]}
    >
      <LinearGradient
        colors={[colors.surfaceSecondary, gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={c.icon}
      >
        <Ionicons name={icon} size={22} color={colors.brandPrimary} />
      </LinearGradient>
      <Text style={c.label} numberOfLines={1}>{label}</Text>
      {desc ? <Text style={c.desc} numberOfLines={2}>{desc}</Text> : null}
      {soon ? <View style={c.soonBadge}><Text style={c.soonTxt}>SOON</Text></View> : null}
      {!soon && onFav ? (
        <Pressable onPress={onFav} hitSlop={12} style={c.fav}>
          <Ionicons
            name={favorite ? "star" : "star-outline"}
            size={16}
            color={favorite ? colors.brandPrimary : colors.onSurfaceTertiary}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const c = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 118,
    justifyContent: "flex-start",
    position: "relative",
  },
  icon: {
    width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  label: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  desc: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 4, lineHeight: 17 },
  soonBadge: { position: "absolute", top: spacing.sm, right: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  soonTxt: { color: colors.onBrandTertiary, fontSize: 10, fontWeight: fontWeight.bold },
  fav: { position: "absolute", top: spacing.sm, right: spacing.sm, width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
});

export function EmptyState({
  icon = "documents-outline",
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={e.wrap}>
      <View style={e.iconWrap}>
        <Ionicons name={icon} size={32} color={colors.brandPrimary} />
      </View>
      <Text style={e.title}>{title}</Text>
      {subtitle ? <Text style={e.sub}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={({ pressed }) => [e.btn, pressed && { opacity: 0.8 }]}>
          <Text style={e.btnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const e = StyleSheet.create({
  wrap: { alignItems: "center", padding: spacing.xxl },
  iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: 4 },
  sub: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, textAlign: "center", lineHeight: 20, marginBottom: spacing.md },
  btn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.pill, marginTop: spacing.sm },
  btnText: { color: colors.onBrandPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
  loading,
  style,
}: {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        b.primary,
        style,
        (disabled || loading) && { opacity: 0.5 },
        pressed && !disabled && !loading ? { opacity: 0.85 } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onBrandPrimary} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={colors.onBrandPrimary} /> : null}
          <Text style={b.primaryText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  icon,
  onPress,
  style,
  textStyle,
}: {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [b.secondary, style, pressed && { opacity: 0.75 }]}
    >
      {icon ? <Ionicons name={icon} size={16} color={colors.onSurface} /> : null}
      <Text style={[b.secondaryText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const b = StyleSheet.create({
  primary: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 48,
  },
  primaryText: { color: colors.onBrandPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  secondary: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
  },
  secondaryText: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});

export function ProgressBanner({ label, done }: { label: string; done?: boolean }) {
  return (
    <View style={p.wrap}>
      {done ? (
        <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />
      ) : (
        <ActivityIndicator color={colors.brandPrimary} size="small" />
      )}
      <Text style={p.text}>{label}</Text>
    </View>
  );
}

const p = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandTertiary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  text: { color: colors.onBrandTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flex: 1 },
});
