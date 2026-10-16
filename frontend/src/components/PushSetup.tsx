/**
 * Push wiring mounted once inside the root layout:
 *  - notification tap handling (warm + cold start)
 *  - contextual pre-permission prompt on first sign-in
 *  - re-registers the device token on every app open
 *  - weekly "Open Settings" nudge when permission is permanently denied
 */
import { useEffect } from "react";
import { Alert, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { storage } from "@/src/utils/storage";
import { markPrePromptShown, registerDevice, requestAndRegister, wasPrePromptShown } from "@/src/utils/push";

const NUDGE_KEY = "pushNudgeAt";
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

function openTarget(router: ReturnType<typeof useRouter>, data: Record<string, unknown>) {
  const url = (data?.deeplink || data?.action_url) as string | undefined;
  if (!url) return;
  if (url.startsWith("http")) Linking.openURL(url).catch(() => {});
  else router.push(url as any);
}

export function PushSetup({ userId }: { userId?: string }) {
  const router = useRouter();

  // Tap handlers
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      openTarget(router, response.notification.request.content.data || {});
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openTarget(router, response.notification.request.content.data || {});
    });
    return () => sub.remove();
  }, [router]);

  // Permission + registration once a user is signed in
  useEffect(() => {
    if (Platform.OS === "web" || !userId) return;
    (async () => {
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status === "granted") {
        await registerDevice();
        return;
      }
      if (perm.canAskAgain) {
        if (await wasPrePromptShown()) return;
        await markPrePromptShown();
        Alert.alert(
          "Stay on track every day",
          "Get a 9 AM reminder for your plan and habits, plus important app updates.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Allow", onPress: () => { void requestAndRegister(); } },
          ],
        );
        return;
      }
      // Permanently denied → weekly nudge
      const last = await storage.getItem<string>(NUDGE_KEY, "");
      if (last && Date.now() - Number(last) <= ONE_WEEK) return;
      Alert.alert(
        "Notifications are off",
        "Turn on notifications in Settings to get daily reminders and app updates.",
        [
          { text: "Later", style: "cancel", onPress: () => { void storage.setItem(NUDGE_KEY, String(Date.now())); } },
          {
            text: "Open Settings",
            onPress: () => {
              void storage.setItem(NUDGE_KEY, String(Date.now()));
              Linking.openSettings();
            },
          },
        ],
      );
    })();
  }, [userId]);

  return null;
}
