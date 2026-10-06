/**
 * Expo config plugin: enforce Google Play's modern Photo & Video
 * permissions policy by hardening the merged AndroidManifest.
 *
 * ─── Why the previous "filter + cap" approach wasn't enough ──────────
 *
 * Expo `withAndroidManifest` only sees the project's base manifest
 * (android/app/src/main/AndroidManifest.xml). Library manifests from
 * `expo-media-library`, `expo-image-picker`, `expo-image`, etc. are
 * merged by AGP's manifest merger during `assembleRelease`, which
 * runs AFTER every Expo config plugin. So stripping entries from the
 * base manifest did nothing — the AGP merger re-injected them from
 * the library AARs.
 *
 * The industry-standard fix is to tell the AGP manifest merger
 * explicitly: "I know this library wants to add permission X —
 * remove it anyway." That's what `tools:node="remove"` does.
 *
 * ─── What this plugin does ────────────────────────────────────────────
 *
 * 1. Ensures the `xmlns:tools="http://schemas.android.com/tools"`
 *    namespace is declared on the <manifest> element.
 *
 * 2. For every permission in HARD_STRIP, inserts (or upgrades) a
 *    `<uses-permission android:name="…" tools:node="remove"/>` entry.
 *    AGP's manifest merger honors this directive at build time and
 *    drops the permission from the merged output regardless of
 *    which library tried to add it.
 *
 * 3. Pre-emptively strips any plain (non-remove) entries that an
 *    older `app.json` still ships for the same permission.
 *
 * 4. Caps `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` at
 *    `maxSdkVersion="32"` — Play policy only enforces modern photo
 *    access on API 33+, so capping these keeps old devices working
 *    without triggering the compliance scanner.
 *
 * ─── Permission matrix ──────────────────────────────────────────────
 *
 * HARD_STRIP (removed via tools:node="remove"):
 *   • android.permission.READ_MEDIA_IMAGES
 *   • android.permission.READ_MEDIA_VIDEO
 *   • android.permission.MANAGE_EXTERNAL_STORAGE
 *
 * CAP_AT_API_32 (maxSdkVersion="32" injected if missing):
 *   • android.permission.READ_EXTERNAL_STORAGE
 *   • android.permission.WRITE_EXTERNAL_STORAGE
 *
 * PRESERVE (needed for the Android 14+ system Photo Picker):
 *   • android.permission.READ_MEDIA_VISUAL_USER_SELECTED
 */
const { withAndroidManifest } = require("@expo/config-plugins");

const TOOLS_NAMESPACE_URI = "http://schemas.android.com/tools";

const HARD_STRIP = [
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.MANAGE_EXTERNAL_STORAGE",
];

const CAP_AT_API_32 = new Set([
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
]);

const MAX_SDK_32 = "32";

function ensureToolsNamespace(manifest) {
  manifest.$ = manifest.$ || {};
  if (!manifest.$["xmlns:tools"]) {
    manifest.$["xmlns:tools"] = TOOLS_NAMESPACE_URI;
  }
}

function stripHardPermissions(manifest) {
  if (!Array.isArray(manifest["uses-permission"])) {
    manifest["uses-permission"] = [];
  }

  // 1. Delete any existing plain entries for the HARD_STRIP perms so
  //    the only line in the final manifest is the tools:node="remove"
  //    directive (not a plain declaration we're also trying to remove).
  manifest["uses-permission"] = manifest["uses-permission"].filter((entry) => {
    const name = entry?.$?.["android:name"];
    const node = entry?.$?.["tools:node"];
    if (!HARD_STRIP.includes(name)) return true;
    // Keep an existing remove-directive; drop everything else.
    return node === "remove";
  });

  // 2. Make sure every HARD_STRIP perm has exactly one remove-directive
  //    entry. AGP's manifest merger reads this and drops the permission
  //    from the merged output, no matter which library AAR declares it.
  for (const perm of HARD_STRIP) {
    const already = manifest["uses-permission"].some(
      (e) =>
        e?.$?.["android:name"] === perm && e?.$?.["tools:node"] === "remove",
    );
    if (already) continue;
    manifest["uses-permission"].push({
      $: {
        "android:name": perm,
        "tools:node": "remove",
      },
    });
  }
}

function capLegacyStoragePermissions(manifest) {
  if (!Array.isArray(manifest["uses-permission"])) return;
  for (const entry of manifest["uses-permission"]) {
    const attrs = entry?.$;
    if (!attrs) continue;
    const name = attrs["android:name"];
    if (!CAP_AT_API_32.has(name)) continue;

    const current = attrs["android:maxSdkVersion"];
    const currentNum = current
      ? parseInt(current, 10)
      : Number.POSITIVE_INFINITY;
    if (currentNum <= 32) continue;
    attrs["android:maxSdkVersion"] = MAX_SDK_32;
    // When we're overriding a looser cap coming from a library, we also
    // need `tools:replace="android:maxSdkVersion"` so the merger
    // respects our value instead of the library's broader one.
    const existingReplace = attrs["tools:replace"];
    const merged = existingReplace
      ? existingReplace
          .split(",")
          .map((s) => s.trim())
          .concat(["android:maxSdkVersion"])
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .join(",")
      : "android:maxSdkVersion";
    attrs["tools:replace"] = merged;
  }
}

function dedupe(manifest) {
  if (!Array.isArray(manifest["uses-permission"])) return;
  const byKey = new Map();
  for (const entry of manifest["uses-permission"]) {
    const name = entry?.$?.["android:name"];
    const node = entry?.$?.["tools:node"] || "";
    if (!name) continue;
    const key = `${name}::${node}`;
    byKey.set(key, entry);
  }
  manifest["uses-permission"] = Array.from(byKey.values());
}

module.exports = function withSystemPhotoPicker(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    if (!manifest) return c;

    ensureToolsNamespace(manifest);
    stripHardPermissions(manifest);
    capLegacyStoragePermissions(manifest);
    dedupe(manifest);

    console.log(
      `[system-photo-picker] base manifest hardened — ${HARD_STRIP.length} permission(s) marked tools:node="remove"; legacy storage perms capped at API 32. AGP manifest merger will drop them from the final AAB.`,
    );
    return c;
  });
};
