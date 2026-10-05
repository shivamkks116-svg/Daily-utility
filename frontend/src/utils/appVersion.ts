/**
 * App-version helpers.
 *
 * Single source of truth for the version + build strings shown on the
 * Profile screen. Bumping `expo.version` or `expo.android.versionCode`
 * (or `expo.ios.buildNumber`) in `app.json` is enough — the UI picks up
 * the new value on the very next launch, no code change needed.
 *
 * Resolution order:
 *   1. `expo-application` — real on-device native build value. Always
 *      wins on prebuilt APK/IPA because `expo prebuild` seeds these
 *      from `app.json`.
 *   2. `expo-constants` → `expoConfig` — works in Expo Go for the
 *      top-level `version` field.
 *   3. Direct `app.json` import — the universal fallback. Needed on
 *      web and in Expo Go because `expo-constants` strips platform-
 *      specific keys like `android.versionCode` / `ios.buildNumber`
 *      from the web manifest.
 *   4. Hard-coded fallback — only hits if the bundler is in a weird
 *      state.
 */

import Constants from "expo-constants";
import * as Application from "expo-application";
import { Platform } from "react-native";
// Importing the raw app.json gives us a bulletproof fallback: Metro
// inlines the JSON at bundle time so the values survive both web and
// Expo Go, even though `Constants.expoConfig` drops `android` / `ios`
// sections on web.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appJson: {
  expo?: {
    version?: string;
    android?: { versionCode?: number };
    ios?: { buildNumber?: string };
  };
} = require("../../app.json");

const FALLBACK_VERSION = "1.0.0";

/** Semver version string, e.g. `"1.0.2"`. */
export function getAppVersion(): string {
  const native = Application.nativeApplicationVersion;
  if (native && native.trim()) return native.trim();
  const configVersion = Constants.expoConfig?.version;
  if (configVersion && configVersion.trim()) return configVersion.trim();
  const jsonVersion = appJson?.expo?.version;
  if (jsonVersion && jsonVersion.trim()) return jsonVersion.trim();
  return FALLBACK_VERSION;
}

/**
 * Platform build identifier — Android `versionCode` or iOS
 * `CFBundleVersion`. Returns `null` only when the config truly doesn't
 * declare one.
 */
export function getAppBuild(): string | null {
  const native = Application.nativeBuildVersion;
  if (native && String(native).trim()) return String(native).trim();

  // `expo-constants` strips android/ios from the web manifest — read
  // them straight out of app.json instead.
  const androidCode =
    Constants.expoConfig?.android?.versionCode ??
    appJson?.expo?.android?.versionCode;
  const iosBuild =
    Constants.expoConfig?.ios?.buildNumber ??
    appJson?.expo?.ios?.buildNumber;

  if (Platform.OS === "ios") {
    if (iosBuild) return String(iosBuild);
    if (typeof androidCode === "number") return String(androidCode);
  } else {
    if (typeof androidCode === "number") return String(androidCode);
    if (iosBuild) return String(iosBuild);
  }
  return null;
}

/**
 * Combined display label — `"1.0.2 (4)"` when a build identifier is
 * known, otherwise just `"1.0.2"`.
 */
export function getAppVersionLabel(): string {
  const version = getAppVersion();
  const build = getAppBuild();
  if (build && build !== version) return `${version} (${build})`;
  return version;
}

/**
 * Short label for a dedicated "Build" row, e.g. `"4"` on Android or
 * `"42"` on iOS. Returns `null` when no build identifier is available
 * so the UI can hide the row.
 */
export function getAppBuildLabel(): string | null {
  return getAppBuild();
}
