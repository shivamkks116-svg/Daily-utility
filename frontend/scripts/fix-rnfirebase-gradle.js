#!/usr/bin/env node
/**
 * Defensive post-install fix for `@react-native-firebase/app` v23–v26
 * on Gradle 8.14+ / AGP 8.6+.
 *
 * Root cause:
 *   The module declares `plugins { id "io.invertase.gradle.build" }`
 *   and relies on that plugin to apply `com.android.library`. On
 *   Gradle 8.14+, the `plugins { … }` DSL block doesn't guarantee
 *   that the Android library plugin's `android { … }` extension is
 *   available by the time the module's own `android { … }` blocks
 *   are evaluated — same for the `apply from: './firebase-json.gradle'`
 *   script which also calls `android { buildConfigField … }`.
 *
 * The surgical fix:
 *   Inject a single explicit `apply plugin: 'com.android.library'`
 *   line immediately AFTER the `plugins { … }` block in
 *   `build.gradle`. Gradle's `pluginManager.apply` is idempotent, so
 *   if `io.invertase.gradle.build` also tries to apply it, there's no
 *   conflict. This one change makes:
 *     • the main `android { … }` block in build.gradle (line 63) work,
 *     • the three `android { buildConfigField … }` blocks inside
 *       `firebase-json.gradle` work (they execute AFTER the apply),
 *   without touching either file further.
 *
 * Earlier versions of this script wrapped both files' `android { … }`
 * blocks in `afterEvaluate { … }`. That was *wrong* for two separate
 * reasons:
 *   1. `namespace = …` in build.gradle must be set during configure
 *      phase, not afterEvaluate — AGP would raise "It is too late to
 *      set namespace".
 *   2. `buildConfigField` in firebase-json.gradle must register during
 *      configure phase, not afterEvaluate — AGP compiles BuildConfig
 *      *before* afterEvaluate hooks run, so the symbol never exists
 *      and `javac` fails with "cannot find symbol FIREBASE_JSON_RAW".
 *
 * The migration path below detects and REVERTS those earlier marker
 * wrappings so re-running yarn install cleanly rolls forward.
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

// Current patch markers
const BUILD_MARKER = "/* dailyhub-firebase-build-applyandroid-patch v3 */";
const FIREBASE_JSON_CLEAN_MARKER = "/* dailyhub-firebase-json-noop-patch v3 */";

// Historical markers we need to revert from
const OLD_BUILD_V1 = "/* dailyhub-firebase-build-afterEvaluate-patch v1 */";
const OLD_BUILD_V2 = "/* dailyhub-firebase-build-applyandroid-patch v2 */";
const OLD_JSON_V1 = "/* dailyhub-firebase-json-afterEvaluate-patch v1 */";

function tag(msg) {
  console.log(`[fix-rnfirebase-gradle] ${msg}`);
}

/**
 * Walk forward from a `{` at `openIdx` and return the index of its
 * matching `}` plus one (i.e. the end exclusive). Returns -1 on
 * mismatched braces.
 */
function matchBrace(src, openIdx) {
  let depth = 1;
  let i = openIdx + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    i++;
  }
  return depth === 0 ? i : -1;
}

/* ────────────── firebase-json.gradle ────────────── */

/**
 * Un-wrap any `afterEvaluate { android { … } }` block that an earlier
 * script version introduced. We detect by the top-level `afterEvaluate {`
 * followed by an inner `android {` and no other sibling statements —
 * the original file's blocks were ALL bare `android { … }`.
 */
function revertFirebaseJsonAfterEvaluate(src) {
  if (!src.includes(OLD_JSON_V1)) return src;
  let out = src.replace(OLD_JSON_V1 + "\n", "");

  // Repeatedly find and un-wrap `afterEvaluate { android { … } }`
  // blocks until no more remain.
  while (true) {
    const re = /([ \t]*)afterEvaluate \{\s*\n[ \t]*android \{/;
    const m = out.match(re);
    if (!m) break;
    const indent = m[1];
    const outerStart = m.index;
    const outerOpen = out.indexOf("{", outerStart);
    const outerEnd = matchBrace(out, outerOpen);
    if (outerEnd === -1) break;

    // Walk inside to find the inner `android { … }`.
    const innerAndroidIdx = out.indexOf("android {", outerOpen + 1);
    if (innerAndroidIdx === -1 || innerAndroidIdx >= outerEnd) break;
    const innerOpen = out.indexOf("{", innerAndroidIdx);
    const innerEnd = matchBrace(out, innerOpen);
    if (innerEnd === -1) break;

    const innerBlock = out.slice(innerAndroidIdx, innerEnd);
    // Dedent the inner block by 2 spaces (we double-indented when wrapping).
    const dedented = innerBlock
      .split("\n")
      .map((line, idx) => (idx === 0 ? line : line.replace(/^ {2}/, "")))
      .join("\n");

    out = out.slice(0, outerStart) + indent + dedented + out.slice(outerEnd);
  }

  return out;
}

function patchFirebaseJson() {
  if (!fs.existsSync(FIREBASE_JSON)) {
    tag("skip firebase-json.gradle — file not found");
    return;
  }
  let src = fs.readFileSync(FIREBASE_JSON, "utf8");

  if (src.includes(FIREBASE_JSON_CLEAN_MARKER)) {
    tag("firebase-json.gradle already clean ✔");
    return;
  }

  const beforeRevert = src;
  src = revertFirebaseJsonAfterEvaluate(src);
  const reverted = src !== beforeRevert;

  const finalSrc = `${FIREBASE_JSON_CLEAN_MARKER}\n${src}`;
  fs.writeFileSync(FIREBASE_JSON, finalSrc, "utf8");
  tag(
    reverted
      ? "firebase-json.gradle reverted — afterEvaluate wrap removed, buildConfigField now runs at configure phase"
      : "firebase-json.gradle verified clean — no afterEvaluate wrap present",
  );
}

/* ────────────── build.gradle ────────────── */

/**
 * Revert the v1 wrap that put the main `android { … }` block inside
 * `afterEvaluate { … }`. Namespace etc. must be set at configure phase.
 */
function revertBuildGradleAfterEvaluate(src) {
  if (!src.includes(OLD_BUILD_V1)) return src;
  let out = src.replace(OLD_BUILD_V1 + "\n", "");

  const re = /([ \t]*)afterEvaluate \{\s*\n[ \t]*android \{/;
  const m = out.match(re);
  if (!m) return out;
  const indent = m[1];
  const outerStart = m.index;
  const outerOpen = out.indexOf("{", outerStart);
  const outerEnd = matchBrace(out, outerOpen);
  if (outerEnd === -1) return out;

  const innerAndroidIdx = out.indexOf("android {", outerOpen + 1);
  const innerOpen = out.indexOf("{", innerAndroidIdx);
  const innerEnd = matchBrace(out, innerOpen);
  if (innerEnd === -1) return out;

  const innerBlock = out.slice(innerAndroidIdx, innerEnd);
  const dedented = innerBlock
    .split("\n")
    .map((line, idx) => (idx === 0 ? line : line.replace(/^ {2}/, "")))
    .join("\n");

  return out.slice(0, outerStart) + indent + dedented + out.slice(outerEnd);
}

function insertApplyAndroidLibrary(src) {
  // Already present?
  if (/apply plugin:\s*['"]com\.android\.library['"]/.test(src)) return src;

  const pluginsIdx = src.search(/\n\s*plugins\s*\{/);
  if (pluginsIdx === -1) return src;

  const openBrace = src.indexOf("{", pluginsIdx);
  const closeIdx = matchBrace(src, openBrace);
  if (closeIdx === -1) return src;

  const inserted =
    "\n\n// Explicit application of the Android library plugin so the main\n" +
    "// `android { … }` block below has its DSL available on Gradle 8.14+,\n" +
    "// where the `plugins { id \"io.invertase.gradle.build\" }` wrapper is\n" +
    "// not guaranteed to have finished applying `com.android.library` by\n" +
    "// the time the block is evaluated. Idempotent — if the invertase\n" +
    "// plugin has already applied `com.android.library`, Gradle's\n" +
    "// pluginManager.apply is a no-op on the second call.\n" +
    "apply plugin: 'com.android.library'";

  return src.slice(0, closeIdx) + inserted + src.slice(closeIdx);
}

function patchBuildGradle() {
  if (!fs.existsSync(BUILD_GRADLE)) {
    tag("skip build.gradle — file not found");
    return;
  }
  let src = fs.readFileSync(BUILD_GRADLE, "utf8");

  if (src.includes(BUILD_MARKER)) {
    tag("build.gradle already patched ✔");
    return;
  }

  // Drop any older patch markers from previous script versions.
  src = src.replace(OLD_BUILD_V2 + "\n", "");

  // Revert v1's afterEvaluate wrap if present (keeps namespace at
  // configure phase).
  src = revertBuildGradleAfterEvaluate(src);

  const patched = insertApplyAndroidLibrary(src);
  if (patched === src && !/apply plugin:\s*['"]com\.android\.library['"]/.test(src)) {
    tag("WARN build.gradle — could not locate plugins { } block");
    return;
  }

  fs.writeFileSync(BUILD_GRADLE, `${BUILD_MARKER}\n${patched}`, "utf8");
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
