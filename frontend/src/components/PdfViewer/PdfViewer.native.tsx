/**
 * Native (iOS + Android) implementation of `PdfViewer`.
 *
 * Wraps `react-native-pdf` — a thin bridge over Android's built-in `PdfRenderer`
 * and iOS' `PDFKit`. Rendering is done entirely on-device so pages appear in
 * milliseconds regardless of document size — no server round-trip, no base64.
 */

import React, { useMemo } from "react";
import { Alert, Linking, Platform, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Pdf from "react-native-pdf";
import { colors } from "@/src/theme";
import type { PdfViewerProps } from "./index.d";

/** Show the full link (and a warning for non-HTTPS sites) before opening it. */
function confirmOpenLink(link: string) {
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

export const PdfViewer: React.FC<PdfViewerProps> = ({
  uri,
  password,
  onLoad,
  onPageChanged,
  onError,
  enablePaging = false,
  style,
}) => {
  // `react-native-pdf` requires an `http://…` or `file://…` source. content://
  // URIs from Android SAF are copied to cache upstream (see importPdfFromUri).
  const source = useMemo(
    () => ({
      uri,
      cache: false,
    }),
    [uri],
  );

  return (
    <View style={[styles.wrap, style]}>
      <Pdf
        source={source}
        password={password}
        trustAllCerts={Platform.OS === "android"}
        enablePaging={enablePaging}
        enableAntialiasing
        enableAnnotationRendering
        spacing={8}
        style={styles.pdf}
        onLoadComplete={(numberOfPages, filePath) =>
          onLoad?.({ numberOfPages, filePath })
        }
        onPageChanged={(page, numberOfPages) =>
          onPageChanged?.(page, numberOfPages)
        }
        onError={onError}
        onPressLink={confirmOpenLink}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  pdf: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
});
