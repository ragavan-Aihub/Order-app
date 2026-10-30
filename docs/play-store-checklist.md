# Google Play — customer app only

Use this when **Farm2Flavour** (business-owned Play developer account) is ready to publish the **customer** Android app. The **delivery** app is **not** on Play — distribute **preview APK** to staff only. The **admin** panel stays on the web (Vercel).

**Package name (fixed):** `com.farm2flavour.app` (`mobile/app.json`)

**Build output for Play:** AAB via EAS `production` profile (`mobile/eas.json`).

**Microphone / voice ordering:** Not used in production. The customer app manifest requests **notifications only** (no `RECORD_AUDIO`). Voice code remains in the repo for Phase 2 but is hidden unless `EXPO_PUBLIC_VOICE_ORDERING=true` and the speech plugin is re-enabled in `app.json`.

---

## Roles

| Who | Tasks |
|-----|--------|
| **Business owner** (Play account owner) | Create Play developer account, identity verification, invite developer, approve privacy policy, provide support email/phone |
| **Developer** (invited user) | Policy draft, store listing assets, production AAB, internal testing, release |

---

## Phase A — Play Console (business)

1. Sign up at [Google Play Console](https://play.google.com/console/signup) with a Google account the **business controls**.
2. Pay registration fee and complete **identity verification** (may take several days).
3. **Users and permissions** → invite the developer (Admin or Release manager on the customer app).
4. Create app → Android → name **Farm2Flavour** → package **`com.farm2flavour.app`**.

---

## Phase B — Privacy policy (required public URL)

Publish HTTPS page naming **Farm2Flavours** (legal business) as operator. Developer template: [privacy-policy-template.md](privacy-policy-template.md). **Share with business owner:** [pdf/Privacy-Policy-For-Review.pdf](pdf/Privacy-Policy-For-Review.pdf) (or `.html` / `.txt` in the same folder). Regenerate: `npm run docs:privacy-pdf`. **Open PDF in Preview or phone — not in Cursor** ([pdf/README.txt](pdf/README.txt)).

Must cover **customer app** data only (do not mention internal staff tools or other apps):

- Mobile number and SMS OTP (sign-in)
- Name, delivery addresses, orders, pay-on-delivery choice (cash/UPI)
- Push notifications (order updates; optional “notify me”)
- **No** microphone or voice recording (not collected)
- Service providers: Supabase (hosting/data/auth), 2Factor.in (OTP SMS), Google FCM (push via Expo)
- Contact, retention, deletion requests, not directed at children

**Data safety** answers in Play Console must match this policy.

---

## Phase C — Store listing

- Short description (≤80 chars) + full description (ordering, delivery, track order, notifications)
- App icon **512×512**, feature graphic **1024×500**
- **Phone screenshots** (2–8): Home, cart/checkout, order detail, notification example
- Category: Shopping or Food & Drink
- Privacy policy URL
- Contact email (business)

**App access:** Login required (OTP). Provide reviewer instructions: test phone number and how OTP is received (use **production SMS**, not Supabase Test OTP, before public launch).

---

## Phase D — Compliance

1. **Data safety** — see template checklist in [privacy-policy-template.md](privacy-policy-template.md#data-safety-play-console).
2. **Content rating** — IARC questionnaire (shopping/food; not a children’s app).
3. **Target audience** — not primarily under 13.

---

## Phase E — Production build (developer)

1. On [expo.dev](https://expo.dev) → customer project → **production** environment:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_BUSINESS_ID`
   - Leave `EXPO_PUBLIC_VOICE_ORDERING` **unset**
2. Bump the user-facing version and `android.versionCode` for every upload ([release-versions.md](release-versions.md)): bug fix `1.0.x`, feature `1.x.0`. After the build is on Play, set the Supabase version row so older installs see an update prompt.
3. Build:

```bash
cd mobile && npx eas-cli build -p android --profile production
```

4. Upload AAB to **Internal testing** first; smoke-test order → admin confirm → push on device.
5. **In-app Play review prompt (live check before wide promotion):** The customer app asks for a store rating after **2 successful new order placements** (not cart updates), once per install. Implementation: `mobile/src/services/store-review.ts` (`expo-store-review`). It does **not** run in dev/Expo Go — verify on an **Internal testing** or production install from Play: place two real orders, confirm the native review UI appears (Google may still choose not to show it). Do this **after publish**, before promoting to production or heavy marketing.
6. Promote to **Production** (staged rollout) when [go-live-checklist.md](go-live-checklist.md) is complete (migrations, real SMS, live catalog, admin HTTPS) and the live review prompt check above is satisfactory.

Optional: `eas submit -p android` after linking the Play app.

---

## Not on Play

| App | Distribution |
|-----|----------------|
| **Delivery** (`com.farm2flavour.delivery`) | `cd delivery && npx eas-cli build -p android --profile preview` → share APK securely |
| **Admin** | Browser — [vercel-admin-deploy.md](vercel-admin-deploy.md) |

---

## Suggested order

1. Business starts Play signup (parallel with policy draft).
2. Publish privacy policy URL; friend approves text.
3. Remove mic from customer build (done in repo — see `mobile/app.json`).
4. Production AAB → Internal testing.
5. Complete listing + Data safety + content rating.
6. Live smoke test on Play install (including 2-order review prompt if desired).
7. Production release after go-live backend checks.

---

## Related docs

- [go-live-checklist.md](go-live-checklist.md) — Supabase, admin HTTPS, APKs
- [technical-guide.md](technical-guide.md) §11.1 — EAS profiles
- [pending-and-future-scope.md](pending-and-future-scope.md) — voice ordering Phase 2
