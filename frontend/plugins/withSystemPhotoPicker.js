/**
 * Expo config plugin: enforce the Android 13+ **System Photo Picker**
 * flow by stripping `READ_MEDIA_IMAGES` and `READ_MEDIA_VIDEO` from the
 * merged AndroidManifest.
 *
 * Why:
 *   Google Play policy (effective 2024, enforced hard in 2025) requires
 *   apps targeting Android 13+ (API 33+) to use the system photo
 *   picker instead of requesting the broad `READ_MEDIA_*` permissions,
 *   unless the picker is technically insufficient for a core use case
 *   (which doesn't apply to DailyHub — we only need per-file access
 *   when a user explicitly taps "Attach").
 *
 *   The Play Console blocks publishing with "Use alternative system
 *   pickers for photos / videos" when either permission is declared.
 *   `expo-image-picker` 15+ already uses the system picker by default
 *   (`legacy: false`), so the permissions were only there because
 *   `app.json` listed them. We've removed them from `app.json`, but a
 *   future dependency bump or dev-only library could re-introduce them
 *   silently via manifest merging — this plugin is a hard guardrail
 *   that runs on every `expo prebuild`.
 *
 *   We KEEP `READ_MEDIA_VISUAL_USER_SELECTED` — that's the per-file
 *   permission the system picker uses on Android 14+. It's safe and
 *   required for the picker to grant transient reads.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

const STRIPPED_PERMISSIONS = new Set([
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  // Intentionally NOT stripped:
  //   • READ_MEDIA_VISUAL_USER_SELECTED — needed by the system picker
  //     for the per-file "You selected 3 photos" flow on Android 14+.
  //   • READ_MEDIA_AUDIO — unused by DailyHub right now, but a future
  //     "attach voice note from library" feature would legitimately
  //     need it, so we don't blanket-strip it here.
]);

module.exports = function withSystemPhotoPicker(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    if (!Array.isArray(manifest["uses-permission"])) return c;

    const before = manifest["uses-permission"].length;
    manifest["uses-permission"] = manifest["uses-permission"].filter(
      (entry) => !STRIPPED_PERMISSIONS.has(entry?.$?.["android:name"]),
    );
    const removed = before - manifest["uses-permission"].length;
    if (removed > 0) {
      console.log(
        `[system-photo-picker] stripped ${removed} broad READ_MEDIA_* permission(s). ` +
          `System picker handles per-file consent — no manifest permission required.`,
      );
    }
    return c;
  });
};
