# DailyHub AI — Quick Reference Card (Play Console Copy-Paste)

**Print this or keep on second screen while filling Play Console.**

---

## 🎯 Essentials

| Field | Value |
|-------|-------|
| App name | **DailyHub AI: All-in-One Tools** |
| Package name | `com.dailyutility.app` |
| Version code | `1` |
| Version name | `1.0.0` |
| Category | **Productivity** |
| Content rating | **Everyone / 3+** |
| Contains ads | **No** (v1.0) |
| In-app purchases | **No** (v1.0) |
| Target audience age | **13+** |

---

## 🔗 Public URLs (LIVE after redeploy)

```
Privacy Policy:
https://daily-utility-ai.emergent.host/api/legal/privacy

Terms of Service:
https://daily-utility-ai.emergent.host/api/legal/terms

Website:
https://shivaminnovation.dev

Support Email:
support@shivaminnovation.dev
```

---

## 📝 Short description (80 chars max)

```
AI Chat, Notes, Todos, Focus, PDF, Calc & 30+ tools — Your daily productivity.
```

---

## 📊 Data Safety — Answers

**Data collected**: Email, Name, Photo (avatar URL), User content (notes/todos/chats), App interactions, Diagnostics

**Data shared**: NONE (with any third parties)

**Encrypted in transit**: YES (TLS 1.3)

**Data deletion**: YES — email support@shivaminnovation.dev

---

## 🎨 Assets Required

Upload from `/app/branding/`:

- **App icon** (512×512): `/icons/playstore-icon-512.png`
- **Feature graphic** (1024×500): `/feature/feature-graphic.png`
- **Phone screenshots** (min 2, max 8): `/play-store/phone/*.png`
- **7-inch tablet**: `/play-store/tablet-7/*.png` (optional)
- **10-inch tablet**: `/play-store/tablet-10/*.png` (optional)

---

## 🚀 Deployment Flow

```
1. Emergent → "Publish" button (top-right)
2. Wait for backend redeploy (2-3 mins)
3. Emergent → "Generate Android Build" → download .AAB
4. Play Console → Production → Upload .AAB
5. Fill in the details from this card
6. Submit for review
```

---

## ⚠️ Reviewer Common Rejects — Pre-empt

Play Console will often reject if:

- ❌ Privacy Policy URL 404s → **FIX**: Verify by opening privacy URL in browser BEFORE submitting
- ❌ Screenshots look promotional/overlays with fake stars/reviews → **We have clean screenshots** ✅
- ❌ Missing content rating certificate → Answer IARC questionnaire in Play Console
- ❌ Data Safety incomplete → Fill using values from full doc
- ❌ App crashes on Android 8 → Test on emulator with API 26 before submit

---

## 📞 If Rejected

1. Read the rejection reason carefully (email + Play Console dashboard)
2. Fix the issue (usually within 1 day)
3. Increment `versionCode` by 1 in `app.json` (2 → 3 → ...)
4. Rebuild AAB via Emergent Publish
5. Resubmit — usually goes through in second attempt

Full details in `PLAY-CONSOLE-SUBMISSION.md`.
