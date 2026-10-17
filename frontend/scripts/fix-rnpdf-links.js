#!/usr/bin/env node
/**
 * Post-install fix for `react-native-pdf` 7.0.x on Android.
 *
 * `io.legere:pdfiumandroid:1.0.32` has a regression where link annotations are
 * never detected, so tapping a website link inside a PDF does nothing
 * (`onPressLink` never fires). 1.0.34 fixes it.
 * See https://github.com/wonday/react-native-pdf/issues/983
 *
 * Idempotent — safe to re-run after every `yarn install`.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "node_modules", "react-native-pdf", "android", "build.gradle");

try {
  if (!fs.existsSync(FILE)) {
    console.log("[fix-rnpdf-links] react-native-pdf not installed — skipping");
    process.exit(0);
  }
  const src = fs.readFileSync(FILE, "utf8");
  const next = src.replace(/io\.legere:pdfiumandroid:1\.0\.(3[0-3]|[12]\d|\d)\b/, "io.legere:pdfiumandroid:1.0.34");
  if (next !== src) {
    fs.writeFileSync(FILE, next);
    console.log("[fix-rnpdf-links] pdfiumandroid bumped to 1.0.34 (PDF link taps fixed)");
  } else {
    console.log("[fix-rnpdf-links] already patched");
  }
} catch (e) {
  console.warn("[fix-rnpdf-links] skipped:", e && e.message);
}
