/**
 * Expo config plugin: enforce Google Play's modern Photo & Video
 * permissions policy by hardening the merged AndroidManifest.
 *
 * ─── What this plugin does ────────────────────────────────────────────
 *
 * 1. HARD STRIP (Google Play auto-rejects these for note-taking apps):
 *      • android.permission.READ_MEDIA_IMAGES
 *      • android.permission.READ_MEDIA_VIDEO
 *      • android.permission.MANAGE_EXTERNAL_STORAGE
 *
 * 2. CAP AT API 32 (legacy storage permissions that libraries like
 *    expo-file-system, expo-image-picker, expo-media-library and
 *    react-native-blob-util still ship unconditionally. Google Play
 *    only flags them when they apply to Android 13+; adding
 *    `android:maxSdkVersion="32"` keeps the libraries functional on
 *    old devices without violating current policy):
 *      • android.permission.READ_EXTERNAL_STORAGE
 *      • android.permission.WRITE_EXTERNAL_STORAGE
 *
 * 3. PRESERVE (needed for the system Photo Picker on Android 14+):
 *      • android.permission.READ_MEDIA_VISUAL_USER_SELECTED
 *
 * ─── Why this plugin exists ───────────────────────────────────────────
 *
 * We've already removed `READ_MEDIA_IMAGES` and `READ_MEDIA_VIDEO`
 * from `app.json`, but library manifests get merged in at prebuild
 * time by AGP's manifest merger. A single dependency bump could
 * silently re-introduce them. This plugin is a hard guardrail that
 * runs on every `expo prebuild`, verifying the final declaration
 * is Google-Play compliant.
 *
 * The plugin runs AFTER all other manifest contributions have been
 * merged (that's how `withAndroidManifest` works in Expo config
 * plugins), so it has the final say over the manifest contents.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

const HARD_STRIP = new Set([
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.MANAGE_EXTERNAL_STORAGE",
]);

const CAP_AT_API_32 = new Set([
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
]);

const MAX_SDK_32 = "32";

module.exports = function withSystemPhotoPicker(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    if (!Array.isArray(manifest["uses-permission"])) return c;

    let stripped = 0;
    let capped = 0;

    manifest["uses-permission"] = manifest["uses-permission"]
      // 1. HARD STRIP — remove the Play-Store-flagged permissions outright.
      .filter((entry) => {
        const name = entry?.$?.["android:name"];
        if (HARD_STRIP.has(name)) {
          stripped++;
          return false;
        }
        return true;
      })
      // 2. CAP legacy storage permissions at API 32 so they don't apply
      //    on Android 13+ (where the Play Store policy enforcement kicks
      //    in). Idempotent: existing maxSdkVersion attributes are kept
      //    as-is unless they're higher than 32.
      .map((entry) => {
        const attrs = entry?.$;
        if (!attrs) return entry;
        const name = attrs["android:name"];
        if (!CAP_AT_API_32.has(name)) return entry;

        const current = attrs["android:maxSdkVersion"];
        const currentNum = current ? parseInt(current, 10) : Number.POSITIVE_INFINITY;
        if (currentNum <= 32) return entry; // already capped tightly enough
        attrs["android:maxSdkVersion"] = MAX_SDK_32;
        capped++;
        return entry;
      });

    // 3. Deduplicate — manifest merging can leave duplicate entries
    //    (same name, different maxSdkVersion). Prefer the tightest cap.
    const byName = new Map();
    for (const entry of manifest["uses-permission"]) {
      const name = entry?.$?.["android:name"];
      if (!name) continue;
      const existing = byName.get(name);
      if (!existing) {
        byName.set(name, entry);
        continue;
      }
      const existingMax = existing.$["android:maxSdkVersion"];
      const incomingMax = entry.$["android:maxSdkVersion"];
      if (!existingMax && incomingMax) continue; // keep broader (no cap)
      if (existingMax && !incomingMax) {
        byName.set(name, entry);
        continue;
      }
      if (
        existingMax &&
        incomingMax &&
        parseInt(incomingMax, 10) < parseInt(existingMax, 10)
      ) {
        byName.set(name, entry);
      }
    }
    manifest["uses-permission"] = Array.from(byName.values());

    if (stripped || capped) {
      console.log(
        `[system-photo-picker] stripped ${stripped} Play-flagged permission(s) and ` +
          `capped ${capped} legacy storage permission(s) at API 32. ` +
          `System picker handles per-file consent — no manifest permission required.`,
      );
    }
    return c;
  });
};
