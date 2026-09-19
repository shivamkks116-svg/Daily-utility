// Type/lint resolution shim — Metro will pick `.native.ts` on native and
// `.web.ts` on web at build time. This file exists so TypeScript / ESLint can
// resolve `@/src/firebase` imports; the actual runtime exports come from the
// platform-specific variants.
export * from "./index.web";
