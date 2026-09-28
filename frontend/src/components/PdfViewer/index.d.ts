/**
 * Public typings for the `PdfViewer` folder.
 *
 * Metro's platform-extension resolver picks:
 *   - `PdfViewer.native.tsx` on iOS / Android
 *   - `PdfViewer.web.tsx`    on web (stub)
 *
 * TypeScript needs a matching declaration file so IDE / lint stays happy.
 */

import type React from "react";

export interface PdfViewerProps {
  /** file:// or content:// URI. content:// is copied to cache before render. */
  uri: string;
  /** Password-protected PDFs. */
  password?: string;
  /** Called after the doc metadata loads. */
  onLoad?: (info: { numberOfPages: number; filePath: string }) => void;
  /** Called on every page change. Page is 1-indexed. */
  onPageChanged?: (page: number, numberOfPages: number) => void;
  onError?: (err: unknown) => void;
  /** Show default pinch-zoom + double-tap controls. */
  enablePaging?: boolean;
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
}

export const PdfViewer: React.FC<PdfViewerProps>;
