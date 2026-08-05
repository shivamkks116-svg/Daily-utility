import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export function tap() {
  if (Platform.OS === "web") return;
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
}
export function success() {
  if (Platform.OS === "web") return;
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
}
export function warn() {
  if (Platform.OS === "web") return;
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
}
