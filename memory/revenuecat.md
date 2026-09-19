# RevenueCat — integrated (2026-09-18)
This file is a memory for the agent when interacting with the user's RevenueCat
account via the Emergent integration-proxy. Never write SDK key values or the
Emergent bearer token here — those live only in `frontend/.env` and the proxy.

## Identifiers (from /setup response — copy verbatim)
- rc_project_id: proj93cd081e
- apple_app_id: app4d719bd705
- play_app_id: appabc5dc4ff8
- entitlement_lookup_key: pro
- offering_lookup_key: default
- Packages (package -> product_id, current price):
  - $rc_monthly -> prod927538ad58   (₹99 / P1M, trial: none)
  - $rc_annual  -> prodcef27f7c07   (₹699 / P1Y, trial: none)
- Dashboard: https://app.revenuecat.com/projects/proj93cd081e

## Check for project_state via the status endpoint
    AUTH='Authorization: Bearer sk-emergent-f5fBdAa4fEd7e3cDe3'
    curl -sS -H "$AUTH" "$INTEGRATION_PROXY_URL/internal/revenuecat/projects/9415d2bb-114b-4836-a277-0adcfa0a8576/status"

## Later updates to user's products (integration-proxy APIs only)
- Change price / duration / trial OR add a package (upsert):
    POST $INTEGRATION_PROXY_URL/internal/revenuecat/projects/9415d2bb-114b-4836-a277-0adcfa0a8576/products
    body: {"products":[{"package":"$rc_monthly","price":149,"currency":"INR",
           "period":"P1M","prices":[{"amount_micros":149000000,"currency":"INR"}]}]}
- Remove a package:
    DELETE $INTEGRATION_PROXY_URL/internal/revenuecat/projects/9415d2bb-114b-4836-a277-0adcfa0a8576/products/%24rc_monthly

## Store-side prerequisites (USER — required for REAL Play purchases)
1. Upload the Google Play service-account JSON to RevenueCat dashboard
   (Home → project → Apps → App name).
2. Set up a Play Console payments profile.
3. Create matching in-app subscription products in Play Console with the SAME
   product IDs shown in the RevenueCat dashboard (prod927538ad58 monthly,
   prodcef27f7c07 annual). Base plans should be named "monthly" / "annual".
4. Build a signed AAB, upload to Play Console Internal Testing, add test
   accounts, and verify subscription + restore flow.

## App code touch-points
- Module-scope init: `frontend/app/_layout.tsx` (`initializeRevenueCat()`)
- Provider: `SubscriptionProvider` wraps everything after auth resolves
- Hook: `useSubscription()` from `frontend/src/subscription/RevenueCat.tsx`
- Paywall UI: `frontend/app/premium/index.tsx`
- Ad gating: `frontend/src/ads/native.tsx` — `AdBanner` returns null when
  `isSubscribed`, `showInterstitial()` no-ops for subscribers.
