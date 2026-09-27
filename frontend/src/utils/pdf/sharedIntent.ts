/**
 * Shared-intent handler.
 *
 * When another app (WhatsApp, Files, Chrome, Drive, Gmail, Photos…) fires an
 * ACTION_VIEW or ACTION_SEND intent at DailyHub AI with a PDF or image URI,
 * Android delivers the intent's `data` URI through `expo-linking`.
 *
 * The catch: Expo Router treats that URI as a deep link. A raw
 * `content://com.whatsapp.provider.media/item/<id>` gets rewritten to
 * `dailyhubai://com.whatsapp.provider.media/item/<id>` and, since there's
 * no matching file-based route, users see the built-in "Unmatched Route"
 * error page.
 *
 * This module hooks into the app's very first navigation cycle and, when
 * it detects a shared PDF or image URI (in either the raw or rewritten
 * form), imports the file into app-private cache and redirects to the
 * correct toolkit screen.
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";

import { importPdfFromUri } from "@/src/utils/pdf/helpers";
import { importImageFromUri } from "@/src/utils/image/import";

const SCHEME = "dailyhubai://";

function looksLikeStrippedContentUri(url: string): boolean {
  if (!url.startsWith(SCHEME)) return false;
  const rest = url.slice(SCHEME.length);
  return (
    /^(com\.|org\.|net\.|io\.|in\.|media\/|docs\/|downloads\/|external\/|primary%3A|external_files|content_)/i.test(
      rest,
    )
  );
}

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
    // Try PDF first — `importPdfFromUri` validates the `%PDF-` magic header
    // so it silently returns null for non-PDF content.
    const pdf = await importPdfFromUri(uri);
    if (pdf) {
      router.replace({
        pathname: "/pdf-toolkit/reader",
        params: {
          sharedUri: pdf.uri,
          sharedName: pdf.name,
          sharedSize: String(pdf.size),
        },
      });
      return;
    }

    // Not a PDF? Try image — `importImageFromUri` checks JPEG/PNG/GIF/WEBP/BMP magics.
    const img = await importImageFromUri(uri);
    if (img) {
      router.replace({
        pathname: "/image-toolkit/view",
        params: {
          sharedUri: img.uri,
          sharedName: img.name,
          sharedSize: String(img.size),
        },
      });
      return;
    }

    // Unknown content type — bounce home so we don't show "Unmatched Route".
    router.replace("/(main)/home");
  } catch (e) {
    console.warn("[sharedIntent] processing failed:", e);
    router.replace("/(main)/home");
  }
}

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
