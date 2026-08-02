/**
 * DailyHub AI theme tokens - Material You Expressive Dark (Moss/Emerald).
 * Reference: /app/design_guidelines.json
 */

export const colors = {
  surface: "#111412",
  onSurface: "#E2E6E3",
  surfaceSecondary: "#1B221E",
  onSurfaceSecondary: "#C4C8C5",
  surfaceTertiary: "#252D28",
  onSurfaceTertiary: "#A0A5A1",
  surfaceInverse: "#E2E6E3",
  onSurfaceInverse: "#111412",

  brand: "#428C66",
  brandPrimary: "#5EBA8B",
  onBrandPrimary: "#003820",
  brandSecondary: "#2E4F3E",
  onBrandSecondary: "#AEE5C6",
  brandTertiary: "#1B3626",
  onBrandTertiary: "#8FCCA9",

  success: "#6DD58C",
  onSuccess: "#00391C",
  warning: "#F2B8B5",
  onWarning: "#410002",
  error: "#FFB4AB",
  onError: "#690005",
  info: "#A8C7FA",
  onInfo: "#062E6F",

  border: "#252D28",
  borderStrong: "#3A4740",
  divider: "#1E2722",

  transparent: "transparent",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 44,
};

export const fontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
};

export const theme = { colors, spacing, radius, fontSize, fontWeight };
