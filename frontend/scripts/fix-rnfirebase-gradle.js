#!/usr/bin/env node
/**
 * Defensive post-install fix for `@react-native-firebase/app` v23–v26
 * on Gradle 8.14+ / AGP 8.x.
 *
 * The upstream `firebase-json.gradle` script applies three bare
 * `android { ... }` configuration blocks:
 *
 *     android {
 *       defaultConfig {
 *         buildConfigField 'String', 'FIREBASE_JSON_RAW', <jsonStr>
 *       }
 *     }
 *
 * The script is `apply from:`'d from the module's `build.gradle` on a
 * line that executes BEFORE the parent `android {}` DSL block, which
 * means the Android Gradle plugin's extension object isn't yet attached
 * to the Project. Older Gradle versions silently deferred this; Gradle
 * 8.14+ raises:
 *
 *   Could not find method android() for arguments [firebase_json_*]
 *
 * Fix: wrap each `android { ... }` block in `afterEvaluate { ... }` so
 * evaluation is deferred to Gradle's configure-phase completion, by
 * which point the Android DSL is live. Mirrors the pattern already
 * used in `scripts/fix-admob-kotlin.js` and is idempotent / safe to
 * re-run after every `yarn install`.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(
  __dirname,
  "..",
  "node_modules",
  "@react-native-firebase",
  "app",
  "android",
  "firebase-json.gradle",
);

const MARKER = "/* dailyhub-firebase-json-afterEvaluate-patch v1 */";

function tag(msg) {
  console.log(`[fix-rnfirebase-gradle] ${msg}`);
}

/**
 * Match any block that starts with `android {` (at any indent), tracks
 * nested braces, and returns the full matched substring. Called from
 * `wrapAndroidBlocks` which handles the actual rewrite.
 */
function findAndroidBlocks(src) {
  const blocks = [];
  const re = /([ \t]*)android \{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const start = m.index;
    const indent = m[1];
    // Walk forward from the opening brace to find the matching close.
    let i = start + m[0].length; // just past `{`
    let depth = 1;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    if (depth !== 0) break; // unbalanced — abort
    blocks.push({ start, end: i, indent });
    re.lastIndex = i;
  }
  return blocks;
}

function wrapAndroidBlocks(src) {
  const blocks = findAndroidBlocks(src);
  if (blocks.length === 0) return src;

  // Rewrite from the END backwards so earlier offsets stay valid while
  // we splice in the longer `afterEvaluate { ... }` wrappers.
  let out = src;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const { start, end, indent } = blocks[i];
    const original = out.slice(start, end);
    // Re-indent the inner block by two spaces so the resulting source
    // keeps readable indentation after wrapping.
    const inner = original
      .split("\n")
      .map((line, idx) => (idx === 0 ? line : "  " + line))
      .join("\n");
    const wrapped = `${indent}afterEvaluate {\n${indent}  ${inner.trimStart()}\n${indent}}`;
    out = out.slice(0, start) + wrapped + out.slice(end);
  }
  return out;
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
  if (src.includes(MARKER)) {
    tag("already patched ✔");
    return;
  }
  if (!/\bandroid \{/.test(src)) {
    tag("skip — upstream pattern changed, no `android {` blocks found");
    return;
  }
  const patched = `${MARKER}\n${wrapAndroidBlocks(src)}`;
  try {
    fs.writeFileSync(FILE, patched, "utf8");
    tag(`patched ${FILE} — android{} blocks wrapped in afterEvaluate{}`);
  } catch (e) {
    tag(`FAILED to write: ${e.message}`);
    process.exit(0); // don't fail install
  }
}

main();
