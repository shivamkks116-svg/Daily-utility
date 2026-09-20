# DailyHub AI — Product Requirements (v3 UI Polish)

## Overview
DailyHub AI is a premium Expo React Native mobile app by Shivam Innovation. Combines productivity, AI, finance, health, device utilities, and file tools in one Material You-inspired app.

## v2 Scope (extends v1)

### v1 features (still present)
- Emergent Google Auth + Guest login
- Dashboard, Notes, To-Do, Habits, Focus/Pomodoro, AI Chat, AI Tools (Translator/Grammar/Summarizer/Email/Study)
- Profile with Premium upsell card, All Tools tab with category chips

### v2 features (NEW)
**Finance**
- **Expense Tracker**: income & expenses, categories, monthly income/expense/balance summary card, add/delete entries via bottom-sheet.
- **EMI Calculator**: monthly EMI, total payable, total interest.
- **SIP Calculator**: future value, invested amount, gains.
- **Currency Converter**: live rates (frankfurter.dev proxy via `/api/currency/rates`), 10 major currencies.

**Health**
- **Water Reminder** + **Medicine Reminder**: schedules with times array, per-time daily notifications via `expo-notifications`, toggle enable/disable, dose field for meds.

**Productivity**
- **Voice Notes**: record via `expo-audio`, save base64 to backend (exclude from list, include on GET/{id}), play/pause, delete.

**Device**
- **QR Scanner**: `expo-camera` with permission gate → settings redirect, type detection (URL/wifi/contact/email/phone/text), scan history persisted server-side.
- **Scientific Calculator**: full sci-calc with sin/cos/tan/log/ln/√/π/x²/parens/negation, live expression evaluation.
- **Unit Converter**: Length, Weight, Temperature, Time, Data — all with base conversions.

**Files**
- **Image → PDF**: multi-image picker (expo-image-picker), reorder, remove, generate PDF (expo-print), share (expo-sharing).

**Monetization**
- **Premium screen**: 3 plans (monthly / yearly / lifetime), features grid, mocked purchase, upsert entitlement, cancel.
- MOCKED: `POST /api/premium/mock-purchase` — real Play Billing v8 receipt verification requires native Android build and Google Play Developer API integration.

## Backend additions
- `/api/expenses` (GET/POST/DELETE)
- `/api/voice-notes` (GET list w/o payload, GET/{id} full, POST, DELETE)
- `/api/qr-scans` (GET/POST/DELETE)
- `/api/reminders` (GET/POST/PUT/DELETE)
- `/api/premium/status`, `/api/premium/mock-purchase`, `/api/premium/cancel`
- `/api/currency/rates?base=USD` — proxy to frankfurter.dev

Indexes added; auth guards; user isolation; no `_id` leakage.

## Design
- Same Material You Expressive Dark palette (moss/emerald).
- Permission gates for camera/mic follow contract (deny → request; permanent deny → open settings).
- All bottom-sheet modals mounted at top-level via `Modal`, keyboard-controller for input focus, no `Alert` — inline toasts / bottom sheets.

## Explicit non-goals (v2)
- **Home-screen widgets**: Requires native dev build + widget provider modules; documented as post-deploy feature.
- **Real Play Billing v8**: Requires native module; UI + entitlement server ready.
- **Expo Go limits**: Voice notes recording requires microphone permission (works on device/dev build). Local notifications work but scheduling accuracy varies on Android SDK 53+ in Expo Go.

## Testing
- v1: 24/24 backend tests pass (`/app/backend/tests/test_dailyhub_backend.py`).
- v2: 19/19 backend tests pass (`/app/backend/tests/test_dailyhub_v2_backend.py`).
- v2.1 (keyboard-controller refactor): 4/4 backend smoke + 12/12 frontend keyboard flows pass.
- v3 (UI polish): Home 10/10 + AI Chat 5/5 + Profile 18/18 + Regression 21/21 = 54/54 checks pass.

## v3 UI Polish (this iteration)
- Windows MAX_PATH permanent fix: removed `react-native-keyboard-controller`, added shim at `/app/frontend/src/utils/keyboard.tsx`.
- New Home: motivational quote card, Today's Progress card (overall % + streak + 3 bars), Continue Working section, Recently Used chips (persisted in local storage), 6-tile Quick Actions grid, pull-to-refresh.
- AI Chat: animated typing indicator (3 dots), Copy button on assistant messages, Regenerate button on last assistant message, `expo-haptics` on send/success.
- Profile: expanded with Preferences (App Lock), Sync & Storage (Backup Status, Storage Usage, Restore Purchases), Community (Rate, Share, Feedback, Help, Contact Support). Toast-based interactions.
- Haptics helper: `/app/frontend/src/utils/haptics.ts` (light tap, success, warning).
- Package name updated to `com.dailyutility.app` in `app.json` (both iOS bundleIdentifier + Android package).
- App icons, splash, feature graphic, Play Store screenshots (24 files, phone + 7"/10" tablets), brand kit generated in `/app/branding/`.

## v4 Play Store Release Prep (this iteration)

### Monetization — AdMob (Google Mobile Ads)
- Library: `react-native-google-mobile-ads` (installed via `expo install`).
- App IDs registered in `app.json` config plugin (currently Google test App IDs; replace with real IDs before Play Store submission — see `/app/frontend/src/ads/ids.ts` `PRODUCTION_ADS` flag).
- SDK initialized once on app start in `_layout.tsx` via `initAdsOnce()` (native only).
- Web fallback: `.web.ts` files export no-op stubs so bundler never loads the native module on web.

### Ad Placements
- **Banner Ads**: Home tab + Tools tab (bottom of scroll content, above tab bar). Uses `ANCHORED_ADAPTIVE_BANNER`.
- **Interstitial Ads**: shown every 3rd tool launch (excluding Notes and AI Chat), and after PDF-close back navigation. Min 45s gap between interstitials.
- **Rewarded Ads**: shown only inside AI Limit Dialog when user opts to earn +5 more AI requests.

### AI Free Tier — Rate Limit (5/day)
- New Mongo collection: `ai_quota`. Doc shape: `{ user_id, date: "YYYY-MM-DD", used, bonus }`.
- Enforced on every `/api/ai/*` endpoint via `_check_and_increment_quota`. Returns HTTP 429 with structured detail when exhausted.
- Rewarded ad flow: client watches ad → POST `/api/ai/reward` → server grants `+5` bonus (max 15/day = 3 ads).
- New endpoints:
  - `GET /api/ai/quota` → current usage snapshot.
  - `POST /api/ai/reward` → grant bonus after rewarded ad view.

### Premium — Converted to "Coming Soon"
- `/app/frontend/app/premium/index.tsx` fully rewritten as a "Coming Soon" landing page.
- Beautiful hero with "Coming Soon" badge + diamond icon.
- 6 feature preview cards preserved.
- Purchase button disabled with `Coming Soon` label + subtitle "Premium Membership will be available in a future update."
- No purchase API call is triggered.

### Profile Enhancements (fully functional)
- Theme picker (Dark / Light / System) — persisted via AsyncStorage.
- Language picker (English / हिन्दी) — persisted.
- Notifications toggle — persisted.
- App Lock toggle — opens PIN setup (4–6 digits) → Confirm PIN → optional biometric enrollment via `expo-local-authentication`.
- Storage Usage — real byte calculation across AsyncStorage keys.
- Rate DailyHub AI → opens Play Store (`market://` scheme with web fallback).
- Share App → native Share sheet with Play Store link.
- Send Feedback / Contact Support → open mailto: with correct subject.
- Help Center → opens `https://shivaminnovation.dev/help`.
- Privacy Policy → in-app screen at `/app/legal/privacy.tsx`.
- Terms & Conditions → in-app screen at `/app/legal/terms.tsx`.
- Developer → opens shivaminnovation.dev.
- Sign Out → clears session and redirects to /login.

### App Lock
- SecureStore-backed PIN (djb2-hashed) + biometric fallback via `expo-local-authentication`.
- `AppLockGate` component wraps the root Stack; auto-locks 15s+ after backgrounding.
- Auto-prompts biometric on unlock screen if enrolled; PIN pad shown otherwise; wrong PIN triggers vibration + reset.
- Android permissions added: `USE_BIOMETRIC`, `USE_FINGERPRINT`. iOS `NSFaceIDUsageDescription` added.

### Client resilience
- `/app/frontend/src/api/client.ts` gained self-healing 401 retry: on any authenticated 401, bootstrap a fresh guest session and retry the original request once. Also preserves structured `detail` + `status` on thrown errors so quota_exceeded detection works.
- Hardcoded PROD_BACKEND_URL fallback so shipped APKs work even if local `.env` is missing during Windows builds.

### Testing (v4)
- Backend: iteration_6.json — 6/6 quota tests PASS (`/app/backend/tests/test_ai_quota.py`).
- Frontend: iteration_7.json — 22/22 UI assertions PASS (Premium, AI Limit Dialog, Profile settings, Home/Tools).

### Release Checklist (v1.0)
- ✅ No crashes reported in test runs
- ✅ Stable navigation (all routes exercised)
- ✅ Responsive UI (390×844 phone tested)
- ✅ Android 8–16 support (via Expo SDK 53 default)
- ✅ Proper permissions declared in app.json
- ✅ Privacy Policy page
- ✅ Terms & Conditions page
- ✅ About / Developer info
- ✅ Feedback + Contact Support (mailto)
- ✅ Rate App (Play Store deep link)
- ✅ Share App (native share sheet)
- ✅ App Version (1.0.0)
- ✅ Coming Soon Premium messaging
- 🔲 Before submission: flip `PRODUCTION_ADS = true` in `/app/frontend/src/ads/ids.ts` and paste real AdMob unit IDs.

### Explicit non-goals (v4)
- Real Play Billing v8 (v5 feature).
- Push Notifications via FCM (requires user's google-services.json — v5 feature).
- Home-screen widgets (v6).


## v5 PDF & Image Toolkit + Guest-swap Bug Fix (this iteration)

### Guest-Swap Bug Fix (critical)
- **Bug:** When user cleared app from recent apps and reopened, Google account name silently changed to "Guest".
- **Root cause:** `api()` client's self-healing 401 handler was bootstrapping a NEW guest session even for signed-in users whose `/auth/me` returned 401.
- **Fix (2 files):**
  - `src/api/client.ts`: Self-heal only when `initialToken` is null AND path is not `/auth/me`. Added `AUTH_PROVIDER_KEY` (`google`/`guest`) to SecureStore for future safety guards. Clears provider marker on hard 401.
  - `src/contexts/AuthContext.tsx`: Added `USER_CACHE_KEY` (AsyncStorage) that caches the User profile. Cold-start now hydrates from cache instantly (no "Guest flash"), then verifies with `/auth/me` in the background. 401 → sign out. Network error → keep cached user. Also added legacy-session auto-repair (missing provider marker → force sign-out) and provider-downgrade guard (google→guest → sign-out).
- **Debug logging:** `[Auth]` prefix everywhere for adb logcat tracing.

### PDF Toolkit (`/(root)/pdf-toolkit`)
- **Hub screen** with categories, favorites, recents, search
- **Create:** Images→PDF (with page size/orientation), Text→PDF (formatted)
- **Organize:** Merge, Split (page ranges), Delete pages, Rotate pages, Extract pages
- **Edit:** Watermark (diagonal text overlay), Page Numbers (header/footer, multiple formats)
- **AI Assistant** (with explicit consent modal): Summarize, Ask Q&A, Extract Key Points, Translate
- Uses **`pdf-lib`** (pure JS) for all local operations — no Kotlin/native deps
- Uses **`expo-document-picker`** with SAF for file selection
- Uses **`expo-print`** for HTML→PDF rendering (Images→PDF, Text→PDF, Image watermark)
- Uses **`expo-sharing`** for share sheet output

### Image Toolkit (`/(root)/image-toolkit`)
- Hub screen with categories, favorites
- **Basics:** Compress (low/medium/high), Resize (%/custom), Convert Format (JPG/PNG/WebP)
- **Edit:** Crop (aspect ratio presets), Rotate/Flip (90/180/270 + horizontal/vertical), Watermark (text overlay)
- **AI:** Extract Text (OCR — Gemini vision), Describe Image (caption + tags)
- Uses **`expo-image-manipulator`** for all local ops
- Consent modals before uploading to AI

### Backend additions
- 8 new endpoints under `/api/pdf/*` and `/api/image/*`:
  - `pdf/info`, `pdf/extract-text` — free (no quota)
  - `pdf/summarize`, `pdf/keypoints`, `pdf/ask`, `pdf/translate` — consume AI quota (only AFTER successful text extraction)
  - `image/ocr`, `image/describe` — consume AI quota, Gemini vision via emergentintegrations
- Payload size cap: 40 MB base64 (≈30 MB raw)
- Uses **PyMuPDF (`fitz`)** for text extraction; never persists user documents
- `_gemini_vision` helper builds `LlmChat` + `ImageContent` for vision calls

### Tech stack changes (v5)
- Added: `pdf-lib@1.17.1`, `expo-document-picker@14.0.8`, `patch-package@8.0.1`, backend: `pymupdf==1.28.2`
- **tslib module-interop crash fixed** via patch-package (`patches/tslib+2.8.1.patch`) — Metro auto-applies on install (`postinstall: patch-package` in package.json). tslib pinned to 2.8.1 via `resolutions` field.

### Play Store Release Assets (v5)
- Full package generated at `/app/branding/play-store-v2/` and served at `/api/downloads/dailyhub-playstore-v2.zip` (3.3 MB, 32 files):
  - App icon 512×512 + 1024×1024
  - Feature graphic 1024×500
  - Phone screenshots (1080×1920) × 8
  - 7-inch tablet screenshots (1920×1080, 16:9) × 8
  - 10-inch tablet screenshots (2560×1440, 16:9) × 8
- Regen script: `/app/branding/regen_playstore_v2.py`

### Play Console updates for v5
- `targetSdkVersion` bumped to **36** (Android 16)
- `compileSdkVersion` bumped to **36**
- New Android permissions: `READ_MEDIA_VIDEO`, `READ_MEDIA_VISUAL_USER_SELECTED`
- iOS: `NSPhotoLibraryAddUsageDescription` added
- App version bumped **1.0.0 → 1.0.1** (`versionCode 1 → 2`)

### Testing (v5)
- **Backend:** iteration_19 — 28/28 tests PASS covering all 8 new endpoints (success paths, error paths, 401-without-auth, quota semantics, LLM output sanity).
- **Frontend:** Smoke-tested via web preview screenshots. Hub screens for PDF Toolkit and Image Toolkit render with correct dark green Material You theme.

### Explicit non-goals (v5)
- Full PDF renderer/preview (needs native lib — deferred to v6 with cloud build)
- OCR of scanned PDF pages (needs Tesseract or backend PyMuPDF-vision — v6)
- Password protection / encryption on PDFs (pdf-lib doesn't support — v6 via backend)
- Ghostscript-based aggressive PDF compression (v6)
- Draw/Highlight/Signature on PDFs (v6, needs canvas)
- Scan-to-PDF with document detection (v6)
- Image collage/grid maker (v6)
- Background remove (needs rembg/AI model — v6)



---

## v6 Scope — Monetization Polish (Paywall UX + AdMob rules)

### Paywall UI polish (`/app/frontend/app/premium/index.tsx`)
- Gradient hero (`expo-linear-gradient`) with brand badge, punchy CTA copy, and inline social proof strip ("Loved by 10,000+ productive users" + 5 stars).
- **Free vs Premium comparison table** (6 rows: AI chat / day, Ads, PDF size, Image OCR, Support priority, Premium badge).
- **Dynamic yearly savings** — computed from real RevenueCat monthly vs annual prices, plus `≈ ₹X/mo` monthly-equivalent hint.
- **Free trial detection** — if package has `introPrice` or `defaultOption.freePhase`, shows a "Start free trial" chip on the plan card, dedicated trial banner above the CTA, and swaps CTA copy to "Start free trial".
- **Testimonials carousel** (3 cards) and **collapsible FAQ** (4 Hindi/Hinglish Q&As) with `LayoutAnimation`.
- **Active-member screen** upgraded — gradient hero with plan chip (Monthly / Yearly / Lifetime), renewal date, benefit checklist, and "Manage subscription" deep-link to Play Store.

### AdMob placement rules (`/app/frontend/src/ads/native.native.tsx`)
- **Interstitial cooldown**: 120s minimum between shows.
- **Session cap**: max 4 interstitials per app session.
- **Cold-start grace**: no interstitials for the first 45s after app open.
- **First-day grace**: no interstitials within 24h of first install (persisted via `AsyncStorage` @ `@ads/install-ts`).
- **Exponential-backoff reload** on interstitial load errors (5s → capped at 5 min).
- **Session-reset** on app-foreground after >10 min in background.
- Premium users continue to get zero ads (banner + interstitial + rewarded).

### Testing (v6)
- Web preview verified — paywall renders end-to-end without Metro crashes (hero, comparison table, plans placeholder, sticky CTA).
- Interstitial suppression reasons are debug-logged (`cold_start`, `first_day`, `cooldown`, `session_cap`) for QA on native builds.

### Explicit non-goals (v6)
- Push Notifications (P1) — deferred, requires user's `google-services.json`.
- Home-screen Android widgets (P2) — deferred, needs native module.
- Wear OS companion (P2) — deferred.

---

## v7 Scope — Firebase Authentication (Google + Email/Password + Guest)

Replaces Emergent-managed Google Auth with the user's own Firebase project (`daily-hub-2077d`, package `com.dailyutility.app`).

### Frontend (`/app/frontend`)
- `src/firebase/index.native.ts` — wraps `@react-native-firebase/auth` (v26) + `@react-native-google-signin/google-signin` (v14+). Guarded `require()` so bundler never touches native modules on web / Expo Go.
- `src/firebase/index.web.ts` — stub throwing "install dev build" error; Metro auto-picks it on web.
- `src/firebase/index.ts` — TS/ESLint resolution shim re-exporting web stubs.
- `src/contexts/AuthContext.tsx` — rewritten to expose `signInWithGoogle`, `signInWithEmail`, `signUpWithEmail`, `fetchEmailSignInMethods`, `sendPasswordReset`, `resendEmailVerification`, `refreshEmailVerification`, `signInAsGuest`, `signOut`, plus a `humanizeFirebaseError` helper.
- `app/login.tsx` — redesigned with 3 methods:
  - **Continue with Google** — native Google Sign-In → Firebase credential → backend exchange.
  - **Continue with Email** — bottom-sheet modal with smart single-email step. `fetchSignInMethodsForEmail` decides between sign-in / sign-up flow. Sign-up asks for Name + Password + Confirm. Sign-in shows "Forgot password?" that opens the reset flow inline.
  - **Continue as Guest** — anonymous fallback preserved.
- `app/verify-email.tsx` — verification wait screen with "I've verified" (reloads Firebase user + re-syncs backend), "Resend email" (60s cooldown), and "Use a different email" (signs out).
- `app/index.tsx` — root gate now routes password-provider users with `email_verified === false` to `/verify-email` before letting them into the main app.
- `app.json` — `android.googleServicesFile: "./google-services.json"`, plugins `@react-native-firebase/app`, `@react-native-firebase/auth`, `@react-native-google-signin/google-signin`.
- `.env` — `EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID` for `GoogleSignin.configure()`.

### Backend (`/app/backend/server.py`)
- `firebase-admin==7.6.0` — initialized with `projectId` only (no service-account JSON required, uses Google's public JWKS to verify tokens).
- New endpoint `POST /api/auth/firebase` — accepts `{id_token, provider?}`, calls `_fb_auth.verify_id_token`, upserts user in Mongo by email (reuses `user_id` for existing accounts), stamps `firebase_uid`, `email_verified`, `provider` (`google` | `password`), then mints and returns the app's existing 7-day `session_token` scheme so downstream RevenueCat / notes / habits keep working unchanged.
- Legacy `/api/auth/session` (Emergent) kept for backward compatibility.
- `/api/auth/me`, `/api/auth/guest`, `/api/auth/logout` unchanged.
- `.env` — `FIREBASE_PROJECT_ID=daily-hub-2077d`, `FIREBASE_WEB_API_KEY=…`.

### Credentials & Console Setup
- `google-services.json` saved at `/app/frontend/google-services.json` (contains OAuth Web client ID entry).
- Firebase Console: Google + Email/Password providers enabled. SHA-1 fingerprint to be added by user on their local machine before first release build.

### Testing (v7)
- Backend: `POST /api/auth/firebase` with invalid token → **401** (`_fb_auth.verify_id_token` rejects). Confirms firebase-admin is initialized correctly without a service account.
- Frontend: Web preview renders login screen with 3 buttons + gradient hero. Email bottom-sheet opens with email input + "Continue" CTA. Google Sign-In & Email flows will only work on Android APK / dev build (as designed).
- Recorded in `/app/memory/test_credentials.md`.

### Explicit non-goals (v7)
- iOS Firebase setup (user chose Android-only).
- Phone number auth / OTP (deferred).
- Firestore / Cloud Storage (backend still uses Mongo).
- Firebase Admin service-account JSON (not needed for `verify_id_token`).


---

## v7.1 Scope — Home Screen Feature Cleanup + Premium Access Polish

### Home screen (`/app/frontend/app/(main)/home.tsx`)
- **Quick Actions expanded to 9 tiles** — added **PDF Tools** (`/pdf-toolkit`), **Image Tools** (`/image-toolkit`), and **QR Scanner** (`/qr`) to the 3-column grid. All these features are implemented; there is no reason for them to sit in Coming Soon.
- **New "Go Premium" promo card** rendered just above the Coming Soon section — shown ONLY to non-subscribed users (via `useSubscription().isSubscribed`). Uses a `LinearGradient` background matching the app's dark green palette and deep-links to `/premium` with haptic tap.
- **Coming Soon rewritten as `COMING_SOON` const** — filtered to genuinely unimplemented features only:
  - Sleep Tracker, BMI Calculator, Flashlight, Compass, ZIP Extractor, Resume Builder, Secure Vault, Budget Planner
- Removed misleading chips: PDF Tools, Premium, Voice Notes, QR Scanner, Medicine Reminder (all already implemented in the app).
- Comment left in code to keep list in sync with `soon: true` entries in `tools.tsx`.

### Premium screen (`/app/frontend/app/premium/index.tsx`)
- When `packages.length === 0`, replaced the flat "unavailable" state with a proper **"Coming soon" block**:
  - `hourglass-outline` icon in brand color
  - Bold title "Coming soon"
  - Explanatory copy: "We're finalising subscription products with Google Play. Premium plans will appear here as soon as they're live."
  - Optional debug detail line if `sub.identityError` is set
  - **Retry button** to re-invoke `sub.refresh()` (new `styles.retryBtn`)
- The main Premium feature card in profile / home remains a proper Upgrade CTA — the "not available" message only appears inside the subscription action, never on the feature card itself (per the Play Store review guideline).

### Testing (v7.1)
- Web preview verified: home screen now shows 9 quick tiles, Go Premium promo, and only the 8 genuine Coming Soon chips.
- Premium screen renders the new Coming Soon block with hourglass icon + Retry button when packages are empty.
- Navigation from Home → PDF Toolkit (`/pdf-toolkit`), Image Toolkit (`/image-toolkit`), QR Scanner (`/qr`), Premium (`/premium`) all resolved via existing routes; no duplicate screens created.

### Explicit non-goals (v7.1)
- No changes to Tools screen (`tools.tsx`) — the shared feature registry stays screen-local.
- No changes to authentication, guest mode, Google login, or Email login.
- Does not remove or modify any existing PDF/Image sub-tool.

