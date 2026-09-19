// Type-only declaration for TypeScript / ESLint resolution.
// Metro will pick `index.native.ts` on native and `index.web.ts` on web at
// build time — this file is NEVER bundled (only .d.ts).
export * from "./index.web";
