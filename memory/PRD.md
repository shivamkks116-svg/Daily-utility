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
