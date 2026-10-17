import { Alert, Linking } from "react-native";
import * as Clipboard from "expo-clipboard";

/** Show the full link (and a warning for non-HTTPS sites) before opening it. */
export function confirmOpenLink(link: string) {
  const isWeb = /^https?:\/\//i.test(link);
  const domain = isWeb ? link.replace(/^https?:\/\//i, "").split(/[/?#]/)[0] : "";
  const insecure = /^http:\/\//i.test(link);
  const message = [
    domain ? `Website: ${domain}` : null,
    link,
    insecure ? "\n⚠️ This link is not secure (no HTTPS). Open only if you trust it." : null,
  ].filter(Boolean).join("\n");
  Alert.alert("Open this link?", message, [
    { text: "Cancel", style: "cancel" },
    { text: "Copy", onPress: () => { Clipboard.setStringAsync(link).catch(() => {}); } },
    { text: "Open", onPress: () => { Linking.openURL(link).catch(() => Alert.alert("Can't open link", link)); } },
  ]);
}
