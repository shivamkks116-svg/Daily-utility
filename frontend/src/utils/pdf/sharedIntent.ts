/**
 * Shared-intent handler.
 *
 * When another app (WhatsApp, Files, Chrome, Drive, Gmail…) fires an
 * ACTION_VIEW or ACTION_SEND intent at DailyHub AI with a PDF URI,
 * Android delivers the intent's `data` URI through `expo-linking`.
 *
 * The catch: Expo Router treats that URI as a deep link. A raw
 * `content://com.whatsapp.provider.media/item/<id>` gets rewritten to
 * `dailyhubai://com.whatsapp.provider.media/item/<id>` and, since there's
 * no matching file-based route, users see the built-in "Unmatched Route"
 * error page.
 *
 * This module hooks into the app's very first navigation cycle and, when
 * it detects a shared PDF/image URI (in either the raw or rewritten form),
 * imports the file into app-private cache and redirects to the correct
 * toolkit screen.
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";

import { importPdfFromUri } from "@/src/utils/pdf/helpers";

const SCHEME = "dailyhubai://";

/**
 * Detect if a URL looks like an Android content:// URI that was rewritten
 * with our app scheme. Every real Android content provider authority
 * uses reverse-DNS or a well-known SAF root, so we match those patterns.
 */
function looksLikeStrippedContentUri(url: string): boolean {
  if (!url.startsWith(SCHEME)) return false;
  const rest = url.slice(SCHEME.length);
  return (
    /^(com\.|org\.|net\.|io\.|in\.|media\/|docs\/|downloads\/|external\/|primary%3A|external_files|content_)/i.test(
      rest,
    )
  );
}

/**
 * Normalize whatever URL the OS gave us into either a usable file/content
 * URI, or null if it isn't a shared file at all.
 */
function normalizeIncomingUrl(url: string): string | null {
  if (!url) return null;
  if (url.startsWith("content://") || url.startsWith("file://")) return url;
  if (looksLikeStrippedContentUri(url)) {
    return "content://" + url.slice(SCHEME.length);
  }
  return null;
}

async function processSharedUrl(rawUrl: string | null) {
  if (!rawUrl || Platform.OS !== "android") return;
  const uri = normalizeIncomingUrl(rawUrl);
  if (!uri) return;

  try {
    // Try PDF first (validates %PDF- header inside importPdfFromUri).
    const pdf = await importPdfFromUri(uri);
    if (pdf) {
      router.replace({
        pathname: "/pdf-toolkit/reader",
        params: { sharedUri: pdf.uri, sharedName: pdf.name, sharedSize: String(pdf.size) },
      });
      return;
    }
    // Not a valid PDF — bounce user home so they don't see "Unmatched Route".
    router.replace("/(main)/home");
  } catch (e) {
    console.warn("[sharedIntent] processing failed:", e);
    router.replace("/(main)/home");
  }
}

/**
 * Install a listener that handles both cold-start intents
 * (`Linking.getInitialURL`) and warm-start intents (subsequent `url` events).
 *
 * Runs once at the app root. Safe to call from any layout.
 */
export function useSharedIntentHandler() {
  useEffect(() => {
    let cancelled = false;

    Linking.getInitialURL().then((url) => {
      if (!cancelled) processSharedUrl(url);
    });

    const sub = Linking.addEventListener("url", (evt) => {
      if (!cancelled) processSharedUrl(evt.url);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
