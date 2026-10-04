/**
 * Expo config plugin: write a fast-build friendly `gradle.properties`.
 *
 * Windows Gradle builds on this project were taking ~4h for the user.
 * The two biggest contributors were:
 *   1. Default `-Xmx2g` heap — JVM thrashes on larger modules.
 *   2. Building 4 ABIs (arm, arm64, x86, x86_64) — pre-release testing
 *      only needs `arm64-v8a` (~95% of modern Android devices).
 *
 * We write these settings every time `expo prebuild` runs so the user
 * never has to edit `android/gradle.properties` manually.  Settings that
 * are already present in the file are left alone, so changes made by the
 * user win.
 */
const { withGradleProperties } = require("@expo/config-plugins");

const FAST_BUILD_PROPS = [
  // ---- Parallelism & daemon --------------------------------------------
  { key: "org.gradle.parallel", value: "true" },
  { key: "org.gradle.daemon", value: "true" },
  { key: "org.gradle.caching", value: "true" },
  { key: "org.gradle.configureondemand", value: "true" },

  // ---- JVM memory ------------------------------------------------------
  // 4 GB heap + G1 GC. Users with 8 GB+ RAM machines should bump to 6g.
  {
    key: "org.gradle.jvmargs",
    value:
      "-Xmx4g -XX:+UseG1GC -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8",
  },

  // ---- React Native specific ------------------------------------------
  // Only build ARM64 for local dev builds. Comment out before Play Store
  // release — Google requires at least arm64-v8a + armeabi-v7a.
  { key: "reactNativeArchitectures", value: "arm64-v8a" },

  // Skip the slow PNG crunch step for debug builds.
  { key: "android.enablePngCrunchInReleaseBuilds", value: "false" },

  // ---- Kotlin incremental compilation ---------------------------------
  { key: "kotlin.incremental", value: "true" },
  { key: "kotlin.incremental.useClasspathSnapshot", value: "true" },

  // ---- AndroidX / Jetifier (defaults set by Expo but re-asserted) -----
  { key: "android.useAndroidX", value: "true" },
  { key: "android.enableJetifier", value: "true" },
];

/** Set the given property only if it isn't already present. */
function setIfMissing(gradleProperties, key, value) {
  const existing = gradleProperties.find(
    (prop) => prop.type === "property" && prop.key === key,
  );
  if (existing) return;
  gradleProperties.push({ type: "property", key, value });
}

module.exports = function withFastGradleProperties(config) {
  return withGradleProperties(config, (c) => {
    for (const { key, value } of FAST_BUILD_PROPS) {
      setIfMissing(c.modResults, key, value);
    }
    return c;
  });
};
