import { requireOptionalNativeModule } from "expo-modules-core";

type PlayIntegrityNative = {
  prepare(cloudProjectNumber: number): Promise<void>;
  requestToken(requestHash: string): Promise<string>;
};

/** null on web / iOS / Expo Go (native module not linked). */
export default requireOptionalNativeModule<PlayIntegrityNative>("PlayIntegrity");
