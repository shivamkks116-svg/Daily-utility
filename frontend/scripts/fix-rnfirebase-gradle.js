#!/usr/bin/env node
/**
 * Defensive post-install fix for `@react-native-firebase/app` v23–v26
 * on Gradle 8.14+ / AGP 8.x.
 *
 * There are TWO separate failure points inside the module's Android
 * project — this script patches both:
 *
 * ─── Problem 1: `firebase-json.gradle` ───────────────────────────────
 *   The upstream script applies three bare `android { ... }` blocks
 *   that execute BEFORE the parent module applies the Android Gradle
 *   plugin. Gradle 8.14+ raises:
 *     Could not find method android() for arguments [firebase_json_*]
 *
 * ─── Problem 2: `build.gradle` line 63 ───────────────────────────────
 *   The module relies on the `io.invertase.gradle.build:1.5` plugin to
 *   apply `com.android.library` for it. That plugin uses the modern
 *   `plugins { id "…" version "…" }` DSL which, in a sub-module build
 *   script resolved from an Expo-managed project, isn't guaranteed to
 *   finish applying `com.android.library` before the file's main
 *   `android { … }` DSL block is evaluated. Same error, different line:
 *     > Could not find method android() for arguments [build_*]
 *     at build.gradle line 63
 *
 * Fix for both: wrap every top-level `android { ... }` block in
 * `afterEvaluate { … }` so evaluation is deferred to Gradle's
 * configure-phase completion, by which point the Android DSL is
 * guaranteed to be installed on the project. Mirrors the pattern
 * used in `scripts/fix-admob-kotlin.js`; idempotent and safe to
 * re-run after every `yarn install`.
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

const TARGETS = [
  {
    file: path.join(MODULE_ROOT, "firebase-json.gradle"),
    marker: "/* dailyhub-firebase-json-afterEvaluate-patch v1 */",
    label: "firebase-json.gradle",
  },
  {
    file: path.join(MODULE_ROOT, "build.gradle"),
    marker: "/* dailyhub-firebase-build-afterEvaluate-patch v1 */",
    label: "build.gradle",
  },
];

function tag(msg) {
  console.log(`[fix-rnfirebase-gradle] ${msg}`);
}

/**
 * Find every top-level `android {` block (balanced-brace walk).
 */
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
  // Rewrite from END backwards so earlier offsets stay valid.
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

function patchOne({ file, marker, label }) {
  if (!fs.existsSync(file)) {
    tag(`skip ${label} — file not found`);
    return;
  }
  let src;
  try {
    src = fs.readFileSync(file, "utf8");
  } catch (e) {
    tag(`skip ${label} — read failed: ${e.message}`);
    return;
  }
  if (src.includes(marker)) {
    tag(`${label} already patched ✔`);
    return;
  }
  if (!/\bandroid \{/.test(src)) {
    tag(`skip ${label} — upstream pattern changed, no \`android {\` block found`);
    return;
  }
  const patched = `${marker}\n${wrapAndroidBlocks(src)}`;
  try {
    fs.writeFileSync(file, patched, "utf8");
    tag(`patched ${label} — android{} wrapped in afterEvaluate{}`);
  } catch (e) {
    tag(`FAILED to write ${label}: ${e.message}`);
    // don't fail install
  }
}

function main() {
  for (const t of TARGETS) patchOne(t);
}

main();
