/**
 * Shared-intent handler.
 *
 * When another app (WhatsApp, Files, Chrome, Drive, Gmail, Photos, Word…)
 * fires an ACTION_VIEW or ACTION_SEND intent at DailyHub AI with a PDF /
 * image / DOCX URI, Android delivers that intent's `data` URI to us via
 * `expo-linking`.
 *
 * There are two historical gotchas this module solves:
 *
 *   1. **URI rewrite.** Expo Router treats incoming URIs as deep links,
 *      so a raw `content://com.whatsapp.provider.media/item/<id>` gets
 *      rewritten to `dailyhubai://com.whatsapp.provider.media/item/<id>`
 *      and lands on the "Unmatched Route" page. We detect the rewritten
 *      form and reconstruct the original `content://` URI.
 *
 *   2. **Cold-start navigation race.** The classic "file opens on the
 *      *second* try" bug was caused by `Linking.getInitialURL()`
 *      resolving *before* the Expo Router root navigator finished
 *      mounting. `router.replace(...)` fired against a half-mounted
 *      navigator was swallowed, and the initial `/login` or `/home`
 *      redirect overrode our intended destination.
 *
 *      The fix: capture every incoming URL into a module-level queue,
 *      *then* wait for `useRootNavigationState().key` to go truthy
 *      (the single source of truth for "the navigator is live") before
 *      flushing the queue. We also guard against processing the same
 *      URL twice (cold-start also fires the `url` listener once in
 *      some OEM ROMs).
 */
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { router, useRootNavigationState } from "expo-router";

import { importPdfFromUri } from "@/src/utils/pdf/helpers";
import { importImageFromUri } from "@/src/utils/image/import";
import { importDocxFromUri } from "@/src/utils/docx/helpers";

const SCHEME = "dailyhubai://";

function looksLikeStrippedContentUri(url: string): boolean {
  if (!url.startsWith(SCHEME)) return false;
  const rest = url.slice(SCHEME.length);
  return /^(com\.|org\.|net\.|io\.|in\.|media\/|docs\/|downloads\/|external\/|primary%3A|external_files|content_)/i.test(
    rest,
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

/**
 * Content URIs can be either:
 *   • PDF / DOCX / Image — route to the right reader.
 *   • Anything else — bounce home with a soft toast rather than
 *     dumping the user on "Unmatched Route".
 *
 * Each importer validates its own magic bytes (expo-file-system reads
 * the first few hundred bytes to sniff the type), so we can call them
 * in order and the first that returns a non-null result wins.
 */
async function routeSharedUri(uri: string): Promise<boolean> {
  // Try PDF first — magic header `%PDF-`.
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
    return true;
  }

  // Not a PDF? Try image — JPEG / PNG / GIF / WEBP / BMP magics.
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
    return true;
  }

  // Not an image either? Try Word document (DOCX / DOC magic bytes).
  const docx = await importDocxFromUri(uri);
  if (docx) {
    router.replace({
      pathname: "/pdf-toolkit/word-reader",
      params: {
        sharedUri: docx.uri,
        sharedName: docx.name,
        sharedSize: String(docx.size),
      },
    });
    return true;
  }

  return false;
}

/**
 * Pending URL queue — populated by the Linking listeners the moment
 * the app wakes up, drained by the hook once the root navigator is
 * ready. This decouples "when Android gives us the URL" from "when
 * expo-router can navigate".
 */
const pendingUrls: string[] = [];
const processedUrls = new Set<string>();

function enqueueUrl(url: string | null | undefined) {
  if (!url || Platform.OS !== "android") return;
  const uri = normalizeIncomingUrl(url);
  if (!uri) return;
  if (processedUrls.has(uri)) return;
  // Avoid stacking duplicates while the queue is still waiting on the
  // navigator — e.g. some OEM ROMs fire both getInitialURL *and* the
  // 'url' event for the same cold-start intent.
  if (pendingUrls[pendingUrls.length - 1] === uri) return;
  pendingUrls.push(uri);
}

async function flushQueue() {
  while (pendingUrls.length > 0) {
    const uri = pendingUrls.shift() as string;
    if (processedUrls.has(uri)) continue;
    processedUrls.add(uri);
    try {
      const handled = await routeSharedUri(uri);
      if (!handled) {
        // Unknown content type — route home with a soft reset so the
        // user isn't stranded on the "Unmatched Route" screen.
        router.replace("/(main)/home");
      }
    } catch (e) {
      console.warn("[sharedIntent] processing failed for", uri, e);
      router.replace("/(main)/home");
    }
  }
}

export function useSharedIntentHandler() {
  // `useRootNavigationState().key` is `undefined` until the navigator
  // is mounted and the initial route is rendered. The *moment* it goes
  // truthy, we drain the queue — guaranteeing the first file opens on
  // the first try instead of the historical "works on 2nd try" bug.
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  const flushingRef = useRef(false);

  // Capture URLs as early as possible — this effect runs on first render,
  // *before* the navigator has keyed in. We just queue; the navReady
  // effect below handles the actual routing.
  useEffect(() => {
    if (Platform.OS !== "android") return;

    let cancelled = false;

    Linking.getInitialURL().then((url) => {
      if (!cancelled) enqueueUrl(url);
      // Try an immediate flush in case the navigator is already ready
      // by the time Linking resolves (warm start).
      if (!cancelled && navReady) {
        void flushQueueOnce();
      }
    });

    const sub = Linking.addEventListener("url", (evt) => {
      if (cancelled) return;
      enqueueUrl(evt.url);
      // Warm-path flush — the navigator is definitely ready during
      // runtime URL events because the user is already in the app.
      void flushQueueOnce();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The second effect fires once the navigator is live, flushing any
  // URL that was captured during the cold-start window.
  useEffect(() => {
    if (!navReady) return;
    if (Platform.OS !== "android") return;
    void flushQueueOnce();
  }, [navReady]);

  async function flushQueueOnce() {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      await flushQueue();
    } finally {
      flushingRef.current = false;
    }
  }
}
