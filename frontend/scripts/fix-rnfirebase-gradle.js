#!/usr/bin/env node
/**
 * Defensive post-install fix for `@react-native-firebase/app` v23–v26
 * on Gradle 8.14+ / AGP 8.6+.
 *
 * There are two separate failure modes inside the module's Android
 * project — this script patches each with the surgical fix it needs,
 * NOT with the same hammer:
 *
 * ─── Problem 1: `firebase-json.gradle` ───────────────────────────────
 *   The upstream script applies three bare `android { … }` blocks that
 *   only set the lazy `buildConfigField` property. Those blocks execute
 *   BEFORE the parent module applies the Android plugin, so Gradle
 *   8.14+ raises:
 *     Could not find method android() for arguments [firebase_json_*]
 *
 *   Fix: wrap each block in `afterEvaluate { android { … } }`. Safe
 *   because `buildConfigField` is a variant-time property that
 *   AGP reads lazily during the variant build phase.
 *
 * ─── Problem 2: `build.gradle` main `android { … }` block ───────────
 *   The module relies on the `io.invertase.gradle.build:1.5` plugin
 *   (declared via the modern `plugins { id "…" version "…" }` DSL) to
 *   apply `com.android.library` for it. On Gradle 8.14+ with Expo's
 *   generated settings.gradle, that plugin isn't guaranteed to have
 *   finished applying `com.android.library` before the main `android {
 *   … }` DSL block is evaluated. Same error, different line:
 *     Could not find method android() for arguments [build_*]
 *
 *   Fix (surgical): add an explicit `apply plugin: 'com.android.
 *   library'` immediately AFTER the `plugins { … }` block. Gradle's
 *   `pluginManager.apply` is idempotent, so if `io.invertase.gradle.
 *   build` later also applies it, there's no conflict. This leaves
 *   the main `android { … }` block at the top level where configure-
 *   phase-only properties like `namespace` work correctly — wrapping
 *   that block in `afterEvaluate { }` would break with
 *     "It is too late to set namespace"
 *   because AGP freezes the namespace during configure, long before
 *   afterEvaluate runs.
 */
const fs = require("fs");
const path = require("path");

const MODULE_ROOT = path.join(
  __dirname,
  "..",
  "node_modules",
  "@react-native-firebase",
  "app",
  "android",
);

const FIREBASE_JSON = path.join(MODULE_ROOT, "firebase-json.gradle");
const BUILD_GRADLE = path.join(MODULE_ROOT, "build.gradle");

const JSON_MARKER = "/* dailyhub-firebase-json-afterEvaluate-patch v1 */";
const BUILD_MARKER = "/* dailyhub-firebase-build-applyandroid-patch v2 */";
const OLD_BUILD_MARKER = "/* dailyhub-firebase-build-afterEvaluate-patch v1 */";

function tag(msg) {
  console.log(`[fix-rnfirebase-gradle] ${msg}`);
}

// ─── firebase-json.gradle helpers ──────────────────────────────────────
function findAndroidBlocks(src) {
  const blocks = [];
  const re = /([ \t]*)android \{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const start = m.index;
    const indent = m[1];
    let i = start + m[0].length;
    let depth = 1;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    if (depth !== 0) break;
    blocks.push({ start, end: i, indent });
    re.lastIndex = i;
  }
  return blocks;
}

function wrapAndroidBlocks(src) {
  const blocks = findAndroidBlocks(src);
  if (blocks.length === 0) return src;
  let out = src;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const { start, end, indent } = blocks[i];
    const original = out.slice(start, end);
    const inner = original
      .split("\n")
      .map((line, idx) => (idx === 0 ? line : "  " + line))
      .join("\n");
    const wrapped = `${indent}afterEvaluate {\n${indent}  ${inner.trimStart()}\n${indent}}`;
    out = out.slice(0, start) + wrapped + out.slice(end);
  }
  return out;
}

function patchFirebaseJson() {
  if (!fs.existsSync(FIREBASE_JSON)) {
    tag("skip firebase-json.gradle — file not found");
    return;
  }
  let src = fs.readFileSync(FIREBASE_JSON, "utf8");
  if (src.includes(JSON_MARKER)) {
    tag("firebase-json.gradle already patched ✔");
    return;
  }
  if (!/\bandroid \{/.test(src)) {
    tag("skip firebase-json.gradle — upstream pattern changed");
    return;
  }
  const patched = `${JSON_MARKER}\n${wrapAndroidBlocks(src)}`;
  fs.writeFileSync(FIREBASE_JSON, patched, "utf8");
  tag("patched firebase-json.gradle — android{} wrapped in afterEvaluate{}");
}

// ─── build.gradle helpers ──────────────────────────────────────────────
/**
 * Revert a buggy earlier version of this script that wrapped the main
 * `android { … }` block in `afterEvaluate { }` — that broke namespace
 * assignment. If the file still has the v1 marker, un-wrap it.
 */
function revertOldAfterEvaluateIfPresent(src) {
  if (!src.includes(OLD_BUILD_MARKER)) return src;

  // Strip the marker line.
  let out = src.replace(OLD_BUILD_MARKER + "\n", "");

  // Un-wrap the single afterEvaluate { android { … } } block at the top
  // level. Walk forward from `afterEvaluate {` and find the matching
  // closing brace.
  const re = /(^|\n)([ \t]*)afterEvaluate \{\s*\n([ \t]*)android \{/;
  const m = out.match(re);
  if (!m) return out;
  const afterIdx = (m.index ?? 0) + m[1].length;
  const afterIndent = m[2];
  // Find matching close of outer afterEvaluate { }.
  let i = afterIdx + m[0].slice(m[1].length).length - "android {".length;
  // Walk from the position of outer `{`.
  const openBraceIdx = out.indexOf("{", afterIdx);
  let depth = 1;
  i = openBraceIdx + 1;
  while (i < out.length && depth > 0) {
    if (out[i] === "{") depth++;
    else if (out[i] === "}") depth--;
    i++;
  }
  if (depth !== 0) return out;
  const outerEnd = i; // position just past outer `}`
  const innerBlock = out.slice(openBraceIdx + 1, outerEnd - 1);
  // Dedent the inner block by 2 spaces (we had indented it when wrapping).
  const dedented = innerBlock
    .split("\n")
    .map((line) => (line.startsWith("  ") ? line.slice(2) : line))
    .join("\n")
    .replace(/^\s*\n/, "")
    .replace(/\n\s*$/, "");
  out = out.slice(0, afterIdx) + afterIndent + dedented.trim() + "\n" + out.slice(outerEnd);
  return out;
}

/**
 * Insert `apply plugin: 'com.android.library'` immediately after the
 * `plugins { … }` block so the android{} DSL is guaranteed available
 * by the time the module's main `android { … }` block is evaluated.
 */
function insertApplyAndroidLibrary(src) {
  if (/apply plugin:\s*['"]com\.android\.library['"]/.test(src)) return src;

  // Find the opening of the `plugins { … }` block.
  const pluginsIdx = src.search(/\n\s*plugins\s*\{/);
  if (pluginsIdx === -1) return src;

  // Walk forward from `{` to find the matching close.
  const openBrace = src.indexOf("{", pluginsIdx);
  let depth = 1;
  let i = openBrace + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    i++;
  }
  if (depth !== 0) return src;

  const insertAt = i; // just past the `}`
  const inserted =
    "\n\n// Explicit application of the Android library plugin so the main\n" +
    "// `android { … }` block below has its DSL available on Gradle 8.14+,\n" +
    "// where the `plugins { id \"io.invertase.gradle.build\" }` wrapper is\n" +
    "// not guaranteed to have finished applying `com.android.library` by\n" +
    "// the time the block is evaluated. Idempotent — if the invertase\n" +
    "// plugin has already applied `com.android.library`, Gradle's\n" +
    "// pluginManager.apply is a no-op on the second call.\n" +
    "apply plugin: 'com.android.library'";

  return src.slice(0, insertAt) + inserted + src.slice(insertAt);
}

function patchBuildGradle() {
  if (!fs.existsSync(BUILD_GRADLE)) {
    tag("skip build.gradle — file not found");
    return;
  }
  let src = fs.readFileSync(BUILD_GRADLE, "utf8");

  // Already on the v2 patch? Nothing to do.
  if (src.includes(BUILD_MARKER)) {
    tag("build.gradle already patched ✔");
    return;
  }

  // Revert the broken v1 wrap first if present.
  src = revertOldAfterEvaluateIfPresent(src);

  // Then inject the real fix.
  const patched = insertApplyAndroidLibrary(src);
  if (patched === src) {
    tag(
      "WARN build.gradle — could not locate plugins { } block to insert apply plugin",
    );
    return;
  }

  const finalSrc = `${BUILD_MARKER}\n${patched}`;
  fs.writeFileSync(BUILD_GRADLE, finalSrc, "utf8");
  tag(
    "patched build.gradle — apply plugin: 'com.android.library' inserted after plugins{} block",
  );
}

function main() {
  try {
    patchFirebaseJson();
  } catch (e) {
    tag(`firebase-json.gradle FAILED: ${e.message}`);
  }
  try {
    patchBuildGradle();
  } catch (e) {
    tag(`build.gradle FAILED: ${e.message}`);
  }
}

main();
