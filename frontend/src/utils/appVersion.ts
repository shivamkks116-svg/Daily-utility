/**
 * App-version helpers.
 *
 * We want a single source of truth for the version string shown on the
 * Profile screen so bumping `expo.version` in `app.json` (or the
 * `versionCode` for Android) automatically updates the UI on the next
 * launch — no code change needed.
 *
 * Preference order:
 *   1. `expo-application` — real on-device native build string, always
 *      wins because `expo prebuild` seeds it from `app.json`.
 *   2. `expo-constants` → `expoConfig.version` — works in Expo Go and web
 *      preview where `expo-application` returns null.
 *   3. Hard-coded fallback — only hits if both of the above fail (e.g. a
 *      bundler misconfig). Kept intentionally conservative.
 */

import Constants from "expo-constants";
import * as Application from "expo-application";
import { Platform } from "react-native";

const FALLBACK = "1.0.0";

/** Semver version string, e.g. `"1.0.2"`. */
export function getAppVersion(): string {
  const native = Application.nativeApplicationVersion;
  if (native && native.trim()) return native.trim();
  const configVersion = Constants.expoConfig?.version;
  if (configVersion && configVersion.trim()) return configVersion.trim();
  return FALLBACK;
}

/** Platform build number — Android `versionCode` or iOS CFBundleVersion. */
export function getAppBuild(): string | null {
  const native = Application.nativeBuildVersion;
  if (native && String(native).trim()) return String(native).trim();
  if (Platform.OS === "android") {
    const code = Constants.expoConfig?.android?.versionCode;
    if (typeof code === "number") return String(code);
  } else if (Platform.OS === "ios") {
    const buildNumber = Constants.expoConfig?.ios?.buildNumber;
    if (buildNumber) return String(buildNumber);
  }
  return null;
}

/**
 * Combined display label — `"1.0.2 (4)"` on Android, `"1.0.2"` where the
 * build isn't known. Suitable for the Profile → Version row.
 */
export function getAppVersionLabel(): string {
  const version = getAppVersion();
  const build = getAppBuild();
  if (build && build !== version) return `${version} (${build})`;
  return version;
}
