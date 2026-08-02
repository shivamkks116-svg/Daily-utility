# DailyHub AI — Product Requirements (v2)

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
