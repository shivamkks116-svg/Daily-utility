/**
 * Custom entry point for DailyHub AI.
 *
 * Why not use `expo-router/entry` directly?
 *
 *   `react-native-android-widget` fires headless JS tasks for widget
 *   lifecycle events (ADDED / UPDATE / RESIZED / CLICK). Those tasks
 *   boot a lightweight JS context *without* mounting the normal app
 *   root, which means code inside React components never runs. The
 *   library requires `registerWidgetTaskHandler(...)` to run at module
 *   top level so the native side has a handler ready the moment it
 *   spins up the task context.
 *
 *   Registering first, then importing `expo-router/entry`, means:
 *     • Widget task context  → runs registration, handler fires, done.
 *     • Normal app launch    → runs registration (cheap no-op second
 *                              time) → mounts Expo Router → UI.
 *
 * Keep this file minimal. Any additional side-effect imports should go
 * inside the Expo Router tree (app/_layout.tsx), not here.
 */
import { Platform } from "react-native";

if (Platform.OS === "android") {
  // Register before expo-router boots so the headless task context
  // picks it up immediately.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerWidgetTaskHandler } = require("react-native-android-widget");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { widgetTaskHandler } = require("@/src/widgets/widgetTaskHandler");
  try {
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch (e) {
    // Non-fatal — widgets just won't update until the user relaunches.
    console.warn("[widgets] registerWidgetTaskHandler failed:", e);
  }
}

// Expo Router's own entry — mounts the <App /> tree on normal launches.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("expo-router/entry");
