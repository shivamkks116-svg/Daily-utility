/**
 * Native (iOS + Android) implementation of `PdfViewer`.
 *
 * Wraps `react-native-pdf` — a thin bridge over Android's built-in `PdfRenderer`
 * and iOS' `PDFKit`. Rendering is done entirely on-device so pages appear in
 * milliseconds regardless of document size — no server round-trip, no base64.
 */

import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Pdf from "react-native-pdf";
import { colors } from "@/src/theme";
import type { PdfViewerProps } from "./index.d";

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
