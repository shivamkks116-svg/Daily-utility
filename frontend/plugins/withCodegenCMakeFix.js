/**
 * withCodegenCMakeFix — Config plugin that patches Android app/build.gradle to
 * force Codegen + prefab tasks to run BEFORE CMake configuration.
 *
 * WHY:
 *   Expo SDK 54 + New Architecture generates an Android-autolinking.cmake file
 *   that calls `add_subdirectory(.../build/generated/source/codegen/jni/)` on
 *   dozens of RN modules. Those directories are produced by the Gradle task
 *   `generateCodegenArtifactsFromSchema`, but on Windows (and sometimes with
 *   `--configure-on-demand`) CMake configuration can fire BEFORE codegen has
 *   finished, producing:
 *
 *     add_subdirectory given source ".../build/generated/source/codegen/jni/"
 *     which is not an existing directory.
 *     Cannot specify link libraries for target "react_codegen_<x>"
 *     which is not built by this project.
 *
 * This plugin appends an `afterEvaluate { … }` block to `android/app/build.gradle`
 * that wires `configureCMake*` / `buildCMake*` tasks to depend on every
 * subproject's `preBuild` and `prefab*Package` tasks. Result: codegen JNI
 * directories are guaranteed to exist before CMake configures.
 *
 * Safe & idempotent — the patch is fenced by a marker so re-runs won't stack.
 */
const { withAppBuildGradle } = require("@expo/config-plugins");

const MARKER = "// >>> DAILYHUB_CODEGEN_CMAKE_FIX <<<";

const PATCH = `
${MARKER}
// Force RN Codegen + prefab tasks to complete before CMake configuration.
// Fixes: "add_subdirectory given source .../generated/source/codegen/jni/ which is not an existing directory"
// on Windows / clean-build scenarios with New Architecture enabled.
afterEvaluate {
    def cmakeTasks = tasks.matching { it.name.startsWith("configureCMake") || it.name.startsWith("buildCMake") }
    rootProject.subprojects.each { sub ->
        if (sub == project) return
        sub.tasks.matching { it.name == "preBuild" }.all { preBuild ->
            cmakeTasks.configureEach { it.dependsOn(preBuild) }
        }
        sub.tasks.matching { it.name.startsWith("prefab") && it.name.endsWith("Package") }.all { prefabTask ->
            cmakeTasks.configureEach { it.dependsOn(prefabTask) }
        }
    }
}
// <<< DAILYHUB_CODEGEN_CMAKE_FIX >>>
`;

const withCodegenCMakeFix = (config) => {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      console.warn("[withCodegenCMakeFix] Skipping — app/build.gradle is not Groovy.");
      return cfg;
    }
    const src = cfg.modResults.contents;
    if (src.includes(MARKER)) {
      // Already patched — idempotent.
      return cfg;
    }
    cfg.modResults.contents = src + "\n" + PATCH + "\n";
    return cfg;
  });
};

module.exports = withCodegenCMakeFix;
