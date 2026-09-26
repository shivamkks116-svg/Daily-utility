#!/usr/bin/env node
/**
 * Defensive post-install fix for `react-native-google-mobile-ads` v17.0.0.
 *
 * The module ships two `promise.reject(nullableString, nullableString, err)`
 * calls that don't compile under Kotlin 2.x's strict null-safety used by
 * Expo SDK 54.  `patches/react-native-google-mobile-ads+17.0.0.patch`
 * fixes them via patch-package, but on Windows or when `--ignore-scripts`
 * is used the patch can silently be skipped.
 *
 * This script performs a direct string replace as a belt-and-braces
 * fallback — it is idempotent and safe to re-run after `yarn install`.
 * Runs AFTER patch-package in postinstall so it also handles the case
 * where patch-package failed.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(
  __dirname,
  "..",
  "node_modules",
  "react-native-google-mobile-ads",
  "android",
  "src",
  "main",
  "java",
  "io",
  "invertase",
  "googlemobileads",
  "ReactNativeGoogleMobileAdsNativeModule.kt",
);

const BAD = `promise.reject(error.getString("code"), error.getString("message"), error)`;
const GOOD = `promise.reject(error.getString("code") ?: "unknown", error.getString("message") ?: "unknown", error)`;

function tag(msg) {
  console.log(`[fix-admob-kotlin] ${msg}`);
}

function main() {
  if (!fs.existsSync(FILE)) {
    tag(`skip — file not found (${FILE})`);
    return;
  }
  let src;
  try {
    src = fs.readFileSync(FILE, "utf8");
  } catch (e) {
    tag(`skip — read failed: ${e.message}`);
    return;
  }
  if (src.includes(GOOD)) {
    tag("already patched ✔");
    return;
  }
  if (!src.includes(BAD)) {
    tag("skip — source does not match expected pattern (upstream may have changed)");
    return;
  }
  const patched = src.split(BAD).join(GOOD);
  try {
    fs.writeFileSync(FILE, patched, "utf8");
    tag(`patched ${FILE}`);
  } catch (e) {
    tag(`FAILED to write: ${e.message}`);
    process.exit(0); // don't fail install
  }
}

main();
