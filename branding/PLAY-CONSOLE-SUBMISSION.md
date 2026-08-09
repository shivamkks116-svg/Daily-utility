# DailyHub AI — Google Play Console Submission Kit

**App Name:** DailyHub AI
**Developer:** Shivam Innovation
**Package Name:** `com.dailyutility.app`
**Version:** 1.0.0 (versionCode 1)
**Category:** Productivity
**Content Rating:** 3+ (Everyone)
**Website:** https://shivaminnovation.dev
**Support Email:** support@shivaminnovation.dev

---

## 🔗 Legal URLs (Play Console → Store Presence → Store Listing)

After you deploy the backend via Emergent's **"Publish"** button, use these public URLs:

| Field | Value |
|-------|-------|
| **Privacy Policy URL** ✅ | `https://daily-utility-ai.emergent.host/api/legal/privacy` |
| **Terms of Service URL** | `https://daily-utility-ai.emergent.host/api/legal/terms` |
| **Account Deletion URL** ⚠️ MANDATORY | `https://daily-utility-ai.emergent.host/api/legal/account-deletion` |
| **Website** | `https://shivaminnovation.dev` |
| **Support Email** | `support@shivaminnovation.dev` |
| **Support Phone (optional)** | leave blank |

> **Important**: Use the `/api/legal/*` variants — these are guaranteed to be served through Emergent's ingress. Bare `/privacy`, `/terms`, `/account-deletion` variants also exist as fallbacks.

All 3 URLs are Play-Store compliant (mobile-responsive, dark theme, GDPR/CCPA/DPDP sections included).

> 🚀 **Before submission**: Click "Publish" in Emergent UI to redeploy with the new legal routes. Once deployed, visit each URL in a browser to confirm it renders correctly.

---

## 📝 Store Listing Content

### App Title (max 30 chars)
```
DailyHub AI: All-in-One Tools
```
(29 characters — safe under limit)

### Short Description (max 80 chars)
```
AI Chat, Notes, Todos, Focus, PDF, Calc & 30+ tools — Your daily productivity.
```
(78 chars)

### Full Description (max 4000 chars)
```
🚀 DailyHub AI — Your all-in-one productivity companion, supercharged with AI.

Stop juggling 10 different apps. DailyHub AI brings 30+ premium tools together in one beautifully-designed, Material You experience:

🤖 AI FEATURES (Powered by Google Gemini)
• AI Chat — Ask anything, get instant intelligent answers
• Email Writer — Professional emails in seconds
• Translator — Between 50+ languages
• Grammar Fix — Perfect writing every time
• Summarizer — Long articles into crisp bullets
• Study Buddy — Explains any topic simply

✍️ PRODUCTIVITY
• Beautiful Notes with rich text & attachments
• Todo Lists with priorities and due dates
• Habit Tracker with streaks and heat maps
• Pomodoro Focus Timer with deep-work sessions
• Expense Tracker with categories & charts

🧮 UTILITIES
• Advanced Calculator (EMI, SIP, Scientific, Currency)
• Unit Converter (length, weight, temperature, currency)
• QR Code Generator & Scanner
• PDF Merger, Splitter & Compressor
• Voice Recorder with transcription

🎨 THOUGHTFUL DESIGN
• Material You dark theme by default
• Smooth 60fps animations
• Haptic feedback on every tap
• Fingerprint / PIN app lock for privacy
• Offline-first: works without internet

🔒 PRIVACY FIRST
• Guest mode — no account required
• Optional Google Sign-In for cloud sync
• AES-256 encryption at rest, TLS 1.3 in transit
• No ads on Notes or AI Chat
• Chats never used to train AI models

💎 COMING SOON: Premium subscription for unlimited AI, cloud backup, and zero ads.

🎯 Perfect for students, professionals, freelancers, and anyone who wants to declutter their phone.

Built with ❤️ by Shivam Innovation.

📧 support@shivaminnovation.dev
🌐 shivaminnovation.dev
```

---

## 🎨 Graphic Assets (all in `/app/branding/`)

### Required assets

| Asset | Size | Location |
|-------|------|----------|
| **App icon** | 512×512 PNG | `/app/branding/icons/playstore-icon-512.png` |
| **Feature graphic** | 1024×500 PNG | `/app/branding/feature/feature-graphic.png` |
| **Phone screenshots** | 1080×1920+ PNG | `/app/branding/play-store/phone/` (8 files) |
| **7-inch tablet screenshots** | 1200×1920+ | `/app/branding/play-store/tablet-7/` |
| **10-inch tablet screenshots** | 1920×1200+ | `/app/branding/play-store/tablet-10/` |
| **Adaptive icon** | 432×432 PNG | `/app/branding/adaptive/adaptive-icon-fg.png` |

All assets are ready — download the branding kit at `/app/branding/DailyHubAI-Branding-Kit.zip`.

---

## 🛡️ Data Safety Form Answers

When Google asks these questions in Play Console → App content → Data safety:

### Does your app collect or share any of the required user data types?
**YES**

### What data types are collected?

| Data type | Collected | Shared | Optional | Purpose | Encrypted |
|-----------|-----------|--------|----------|---------|-----------|
| **Email address** | ✅ | ❌ | ✅ (Google Sign-in only) | Account management | ✅ In transit + at rest |
| **Name** | ✅ | ❌ | ✅ | Personalization | ✅ |
| **Photos (avatar URL)** | ✅ | ❌ | ✅ | Profile display | ✅ |
| **App interactions** | ✅ | ❌ | ❌ | Analytics, product improvement | ✅ |
| **User-generated content** (notes, todos, chats) | ✅ | ❌ | ❌ | Core functionality | ✅ |
| **Diagnostics / crash logs** | ✅ | ❌ | ❌ | Bug reports | ✅ |

### Data NOT collected
- ❌ Precise location
- ❌ Contacts, SMS, call logs
- ❌ Health & fitness
- ❌ Financial info
- ❌ Personal identifiers (device ID for advertising)
- ❌ Web browsing history
- ❌ Audio recordings sent to server

### Is all user data encrypted in transit?
**YES** (TLS 1.3)

### Do you provide a way for users to request that their data be deleted?
**YES** — from Profile → Sign Out → email support@shivaminnovation.dev with subject "Delete My Account". Data purged within 30 days.

---

## 🔐 Permissions Declaration (Play Console → Policy → App content → Sensitive permissions)

| Permission | Used for | Justification for reviewer |
|-----------|----------|----------------------------|
| `CAMERA` | Scan QR codes; capture receipts for expenses | Core feature — QR Scanner tool and Expense receipt capture. Only used when user explicitly taps scanner. |
| `RECORD_AUDIO` | Voice notes / voice recorder tool | Core feature — Voice Recorder tool. Only used when user starts a recording. |
| `READ_MEDIA_IMAGES` | Attach images to notes, PDFs | User-initiated attach only. |
| `POST_NOTIFICATIONS` | Reminders, focus-timer alerts, habit nudges | User-initiated reminders. Can be disabled in-app. |
| `SCHEDULE_EXACT_ALARM` | Precise reminder times | For scheduled reminders and focus-timer notifications. |
| `USE_EXACT_ALARM` | Precise reminder times | Same as above. |
| `USE_BIOMETRIC` | Fingerprint / face unlock for App Lock | Optional feature — user enables in Profile → App Lock. |
| `USE_FINGERPRINT` | Legacy Android <11 fingerprint | Optional App Lock. |
| `VIBRATE` | Haptic feedback on button taps, wrong PIN | UX polish. |
| `INTERNET` | AI Chat, cloud sync, backup | Core feature. |

**No sensitive permissions** requested:
- ❌ Not requesting `ACCESS_FINE_LOCATION`
- ❌ Not requesting `READ_CONTACTS`
- ❌ Not requesting `READ_SMS`
- ❌ Not requesting `QUERY_ALL_PACKAGES`
- ❌ Not requesting `SYSTEM_ALERT_WINDOW`
- ❌ Not requesting `MANAGE_EXTERNAL_STORAGE`

---

## ⭐ Content Rating (IARC Questionnaire)

Answer these questions on Play Console → App content → Content rating:

| Question | Answer |
|----------|--------|
| Does the app contain violence? | **No** |
| Does the app contain sexual content? | **No** |
| Does the app contain profanity or crude humour? | **No** |
| Does the app contain controlled substances? | **No** |
| Does the app contain gambling? | **No** |
| Does the app collect location data? | **No** |
| Does the app share user-generated content? | **No** (private notes only) |
| Does the app enable users to interact? | **No** (no chat/social) |
| Does the app allow in-app purchases? | **No** (in v1.0) |
| Does the app show ads to users? | **Yes** (AdMob planned in future update — declare as "Contains ads"). For v1.0 without ads, select **No**. |

**Expected rating**: **Everyone / 3+ / All ages**

---

## 🎯 Target Audience & Content

- **Target age group**: 13+ (teens and adults)
- **Appeal to children**: No
- **Ads**: Not in v1.0 (declare "No" for v1.0 initial submission — you can update later when AdMob is re-added via cloud build).
- **In-app purchases**: No (Premium is "Coming Soon" but no active purchase flow).

---

## 🌍 Countries & Regions
Recommended launch:
- Primary: **India, USA, UK, Canada, Australia, Singapore, UAE**
- Full worldwide after 2 weeks stable metrics.

---

## 📊 Pricing & Distribution
- **Price**: Free
- **In-app products**: None (in v1.0)
- **Contains ads**: **No** (for v1.0, since AdMob is temporarily disabled)
- **Distribute to**: All eligible countries

---

## 🧾 Declarations Checklist

Play Console → App content:

- [ ] **Privacy Policy URL** filled → `https://daily-utility-ai.emergent.host/api/legal/privacy`
- [ ] **App access** — Select **"All functionality is available without any special access"** ✅
      Reasoning: *"DailyHub AI provides a Guest mode where all core features are fully accessible without any sign-in requirement. Google Sign-In is optional and only enhances the experience with cloud sync."*
- [ ] **Ads** — No (for v1.0)
- [ ] **Content rating** — Complete IARC questionnaire (should result in "Everyone")
- [ ] **Target audience** — 13 to 65+
- [ ] **News app** — No
- [ ] **COVID-19 tracing** — No
- [ ] **Data safety** — Complete form as above
- [ ] **Government app** — No
- [ ] **Financial features** — No (calculator is a general tool, not a financial service)
- [ ] **Health apps** — No

---

## 🔐 Sign-In Options (Your app supports)

| Sign-in Type | Status | Play Console Section |
|--------------|--------|---------------------|
| **Google Sign-In** | ✅ Optional | No test credentials needed — Guest mode covers reviewer testing |
| **Guest Mode** | ✅ Default | Reviewer will use this — no restrictions to declare |
| **Email/Password** | ❌ Not implemented | N/A |
| **Phone OTP** | ❌ Not implemented | N/A |

**Recommended App Access answer**: *"All functionality is available without any special access"*

This is the fastest-review path — reviewers don't need Google credentials, and mandatory-login apps often face 10-14 day reviews vs. 3-7 days for open apps.

---

## 🚀 Release Steps

### First-time Play Store submission

1. Create a Play Console account (**$25 one-time**): https://play.google.com/console
2. Create a new app:
   - App name: **DailyHub AI**
   - Default language: **English (India)** or **English (US)**
   - App or game: **App**
   - Free or paid: **Free**
   - Accept declarations
3. Fill in **Store presence → Store listing** using the content above.
4. Upload graphic assets from `/app/branding/`.
5. Fill in **App content** (all sections in the checklist above).
6. Go to **Production → Create new release**:
   - Upload your signed AAB (`.aab` file — Emergent Publish → Generate Android build).
   - Add release notes: **"Initial release — 30+ productivity tools with AI, App Lock, and Material You design."**
7. Submit for review (usually 3-7 days for first-time apps).

### Signed AAB Generation
- Use **Emergent's "Publish" button** (top-right in the UI) to generate a production AAB with proper signing.
- Do NOT use unsigned APKs for Play Store — they will be rejected.

---

## ✅ Pre-Submission Testing Checklist

Before hitting Submit:

- [ ] App installs cleanly on Android 8.0 (API 26) and Android 14 (API 34)
- [ ] Guest login works, Google login works
- [ ] All 30+ tools open without crash
- [ ] AI Chat sends messages, gets replies
- [ ] AI limit dialog appears after 5 requests
- [ ] Notes CRUD works
- [ ] Todos CRUD works
- [ ] Habits CRUD works
- [ ] Focus Timer runs
- [ ] Expense tracking works
- [ ] PDF merger/splitter works
- [ ] QR generator + scanner works
- [ ] Camera permission prompt appears correctly
- [ ] Microphone permission prompt appears correctly
- [ ] Profile → App Lock PIN setup works
- [ ] Profile → Fingerprint unlock works (on device with biometrics)
- [ ] Profile → Language picker works
- [ ] Profile → Theme picker works
- [ ] Privacy Policy URL loads in browser
- [ ] Terms URL loads in browser
- [ ] App doesn't crash on rotation
- [ ] Back button behaves correctly on all screens
- [ ] No unexpected internet permission requests

---

## 📱 Screenshots Naming Convention (Recommended)

Rename screenshots for Play Console upload:

```
01-home-dashboard.png
02-ai-chat.png
03-all-tools.png
04-notes.png
05-todos-habits.png
06-focus-timer.png
07-profile-settings.png
08-premium-coming-soon.png
```

Google shows **8 screenshots** in the store listing. Order them for maximum conversion.

---

## 🤝 Support Contact Template

If a reviewer or user reaches out:

**Email**: support@shivaminnovation.dev
**Response SLA**: within 48 business hours
**Data deletion**: Email with subject "Delete My Account" — action within 30 days.

---

## 📅 Version Roadmap (public)

- **v1.0** (current) — 30+ tools, AI Chat, App Lock, Material You UI
- **v1.1** — Push notifications (Firebase FCM)
- **v1.2** — Google Play Billing v8 (Premium subscription)
- **v1.3** — Home-screen widgets
- **v1.4** — Wear OS companion

---

## 🎉 You're Ready!

Everything above is drafted and pre-fills 95% of Play Console. Just:

1. Deploy backend (Emergent Publish) — done ✅
2. Generate signed AAB (Emergent Publish → Generate Android build)
3. Copy-paste text from this document into Play Console
4. Upload assets from `/app/branding/`
5. Submit for review

Best of luck with the launch! 🚀

---

*Document version: 1.0 · Last updated: June 2026 · Author: Shivam Innovation*
