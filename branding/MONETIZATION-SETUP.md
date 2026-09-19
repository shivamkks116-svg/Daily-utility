# DailyHub AI — Monetization Setup Guide

## What's Wired
- ✅ RevenueCat (managed via Emergent integration-proxy) — Monthly ₹99 + Yearly ₹699
- ✅ Google AdMob (react-native-google-mobile-ads) — banner + interstitial + rewarded
- ✅ Premium paywall UI (`/premium`)
- ✅ Ads automatically hidden for Premium users
- ✅ Restore Purchases, Terms/Privacy links, subscription status display
- ✅ Web / Expo Go stubs (no crashes; real purchases only on native builds)

## Google AdMob Setup for Production

### 1. Create AdMob account & get IDs
- Sign in to https://apps.admob.com
- Add Android app → note the **App ID** (`ca-app-pub-XXXX~YYYY`)
- Create ad units: **Banner**, **Interstitial**, **Rewarded** → note each **Ad Unit ID** (`ca-app-pub-XXXX/ZZZZ`)

### 2. Replace test IDs (before Play Store release)

**A. `frontend/app.json` → find the AdMob plugin block:**
```json
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-YOUR_REAL_APP_ID~XXXX",
    "delayAppMeasurementInit": true
  }
]
```

**B. `frontend/.env` — add these for real ad units:**
```
EXPO_PUBLIC_ADMOB_USE_TEST_IDS=false
EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-YOUR_ID/BANNER
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=ca-app-pub-YOUR_ID/INTERSTITIAL
EXPO_PUBLIC_ADMOB_REWARDED_ID=ca-app-pub-YOUR_ID/REWARDED
```

### 3. UMP consent
Configure GDPR/EEA consent form in AdMob → Privacy & messaging → Publish. Users in EEA will see the consent prompt on first launch.

## Google Play Console Setup for Subscriptions

Emergent has already provisioned the RevenueCat side. YOU must:

### 1. Upload service-account credentials to RevenueCat
- Play Console → Setup → API access → **Create service account** with permission "Manage orders and subscriptions"
- Download the JSON key file
- Go to https://app.revenuecat.com/projects/proj93cd081e → **Project Settings → Apps → Android app** → upload JSON

### 2. Create subscription products in Play Console (Monetize → Subscriptions)

| Product ID (must match RevenueCat) | Base plan | Price |
|---|---|---|
| `prod927538ad58` | `monthly` (auto-renewing, 1 month) | ₹99 |
| `prodcef27f7c07` | `annual`  (auto-renewing, 1 year)  | ₹699 |

⚠️ Product IDs **must match exactly** what RevenueCat has (`prod927538ad58`, `prodcef27f7c07`). See dashboard.

### 3. Add test tracks + license testers
- Play Console → Testing → **Internal testing** → create track → add your Gmail to license testers
- Play Console → Setup → **License testing** → add tester Gmails

### 4. Upload signed AAB
- Build signed AAB (see below)
- Upload to Internal Testing track
- Publish → wait 15-30 min for propagation
- Install via Play Store opt-in link on a test device with a license-tester Gmail
- Open app → Premium screen → subscribe → should show real "Google Play" purchase dialog

## Build Commands

### Local Windows (fast: arm64 only, ~20 min)
Add to `android/gradle.properties`:
```
reactNativeArchitectures=arm64-v8a
```
Then:
```powershell
cd frontend
npx expo prebuild --clean --platform android
cd android
./gradlew bundleRelease   # AAB for Play Store
./gradlew assembleRelease # APK for sideload testing
```

### Emergent Cloud Build (recommended, 5-10 min)
Editor top-right → **Publish** → Android → Wait → Download AAB/APK

## File Reference

| File | Purpose |
|---|---|
| `src/subscription/RevenueCat.tsx` | Provider + `useSubscription()` hook |
| `src/ads/native.native.tsx` | AdMob adapter (banner, interstitial, rewarded) |
| `src/ads/native.web.tsx` | Web/Expo Go stubs |
| `app/premium/index.tsx` | Paywall UI |
| `app.json` (plugins) | AdMob App ID + native config |
| `.env` | RevenueCat SDK keys + AdMob env overrides |
| `/app/memory/revenuecat.md` | RevenueCat state (for future agent runs) |

## Testing Checklist

- [ ] Web preview: Premium screen loads with "unavailable" plans (expected — no native SDK)
- [ ] Local APK: Ads show test banner on Home/Tools
- [ ] Local APK: Premium screen shows Monthly ₹99 + Yearly ₹699 with "BEST VALUE" badge
- [ ] Internal testing: Real Google Play purchase dialog appears
- [ ] After purchase: Ads disappear, badge shows in Profile, Premium screen shows "Thanks" state
- [ ] Restore Purchases: Works on fresh install with same Google account
- [ ] Sign out / sign in: Entitlement follows the user id
