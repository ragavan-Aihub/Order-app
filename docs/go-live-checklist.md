# Go-live checklist

Use this after QA on **test data** and **before** the first real customer. For the full dev sequence see the go-live plan in Cursor; technical detail is in [technical-guide.md](technical-guide.md).

## Current pending — 15 Nov 2026

What is still open before the first real customer. Check these off as they happen.

### 1. Ship the latest code

Work is in the repo (selling units, min order, Home polish, in-app inbox, Announcements with Poster + Inbox & phone, privacy text) but it is **not a go-live until it is on production**:

- [ ] Commit and push to GitHub (`Order-app`)
- [ ] Confirm **Vercel** admin rebuilds (Announcements menu, inbox send, service role for Expo phone alerts)
- [ ] New **customer preview/production APK** (repo `android.versionCode` is **24**). Expo Go is not enough for Play or for a store-style smoke test
- [ ] Delivery APK only if staff will use the delivery app on day one (still APK-only, not Play)

### 2. Hosted database

Confirm every file in [supabase-migration-checklist.md](supabase-migration-checklist.md) is applied, including **November 2026**:

- Shop status + home posters (`20261105*`)
- Google customer profile (`20261106010000`)
- Selling units / kg / liter / stock (`20261109*`, `20261111*`, `20261112*`)
- Min order (`20261112020000`)
- Customer inbox + service-role grants + keep latest **20** (`20261115140000` … `20261115170000`)

Inbox grants and keep-20 were applied on the linked project on 15 Nov 2026. Still confirm on the **go-live** project if it is a different one.

- [ ] `notify pgrst, 'reload schema';` after the last batch
- [ ] Admin **Inbox & phone** toast shows phone alerts sent (not Unauthorized)

### 3. QA on a real APK

Run P0 rows in [qa-test-cases.md](qa-test-cases.md) / [qa-test-cases.xlsx](qa-test-cases.xlsx), plus these newer flows:

- [ ] Google sign-in and email link on the **preview APK**
- [ ] Place → confirm → out for delivery → delivered + pay on delivery; customer sees progress
- [ ] Customer **modify** until Out for delivery; **cancel** only while Placed
- [ ] Shop **modify** for stock / **cancel** from admin
- [ ] Min order amount blocks checkout when under the shop minimum
- [ ] Kg / liter / pack products order with the right unit and price
- [ ] Home poster under categories; Shop status blocks new orders
- [ ] Bell + Notifications list (latest 20); order auto-messages; admin important message / offer
- [ ] Phone push for order status, Coming soon Notify me, poster (if turned on), inbox message
- [ ] Privacy Policy screen matches the live rules
- [ ] Reports + Audit log on hosted admin

### 4. Practice data → live shop

- [ ] Run [supabase/scripts/go-live-reset.sql](../supabase/scripts/go-live-reset.sql) with the real `v_business_id` (wipes orders, customers, inbox, catalog — keeps the business row and admin login)
- [ ] Delete test **customer** Auth users; keep admin
- [ ] Storage: clear `product-images/{business_id}/` if re-importing photos
- [ ] Re-import **real catalog**; set min order, UPI QR, shop open/closed, posters
- [ ] Order numbers start at **100001**
- [ ] Clear app data / reinstall APK on test phones

### 5. Sign-in (production)

- [ ] Supabase Auth: **Google** and **Email** on, **Phone** off
- [ ] Redirect `farm2flavour://auth/callback`
- [ ] Google Cloud: Web client (secret only in Supabase) + Android client `com.farm2flavour.app` + **Play App signing SHA-1** before a Play upload
- [ ] No custom SMTP unless you choose it later (testers see **Supabase Auth** mail)

### 6. Privacy and Google Play (customer app only)

- [ ] Business owner **approves** [privacy-policy-for-review.md](privacy-policy-for-review.md) (updated 15 Nov 2026: inbox, notify me, order change/cancel, Expo push)
- [ ] Publish the policy at a **public HTTPS URL**
- [ ] Fill Play **Data safety** to match that policy ([play-store-checklist.md](play-store-checklist.md))
- [ ] Play listing, content rating, internal testing AAB, then production when §H below is complete
- [ ] Delivery stays **APK-only**; admin stays on **Vercel**

### Not required for this go-live

Voice ordering, Partner API polish, admin “Go live wizard”, WhatsApp status messages, and other Phase 2 items in [pending-and-future-scope.md](pending-and-future-scope.md).

---

## A. Migrations on hosted Supabase

Run every file in `supabase/migrations/` **in filename order** that is not yet applied on your project. Track progress in [supabase-migration-checklist.md](supabase-migration-checklist.md).

Minimum for the current apps (Oct 2026): through `20261027220000_business_upi_qr.sql`, plus **`20261028210000_admin_audit_log.sql`** if you use **Audit log** in admin, plus **`20261030233000_customer_app_version.sql`** if the customer app should prompt for bug-fix or feature updates ([release-versions.md](release-versions.md)). Include push and notify-me migrations if you use those features.

After each batch that adds functions or columns:

```sql
notify pgrst, 'reload schema';
```

## B. Deploy push (optional but recommended)

1. Apply push migrations (see [supabase/documentation/push-notifications.md](../supabase/documentation/push-notifications.md)).
2. From repo root (Supabase CLI linked):

```bash
./supabase/scripts/deploy-push-functions.sh
```

   Edge functions `send-order-status-push` and `send-product-available-push` were deployed via CLI on 28 Oct 2026; redeploy after code changes.

3. Set `SUPABASE_SERVICE_ROLE_KEY` on the **hosted admin** environment (never in mobile or delivery apps). See `admin/.env.example`.

## C. Admin on HTTPS

1. Fix passes: `cd admin && npx tsc --noEmit && npm run build`
2. Deploy to **Vercel** — step-by-step: [vercel-admin-deploy.md](vercel-admin-deploy.md). Import GitHub repo **`Order-app`**, **Root Directory `admin`**, env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; order/product push from admin)
3. Use the **Visit** URL from the Vercel project (Domains tab). Do not assume `order-app.vercel.app` unless that hostname is listed on your project.
4. Smoke-test: login, place/update order, **push to customer device**, Reports, **Audit log** (after audit migration).

## D. Preview APKs

**Customer** (`mobile/`):

- `android.versionCode` in repo (currently **23** — bump before each store-style release)
- EAS **preview** env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_BUSINESS_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Do not add a microphone permission. Google Cloud needs an **Android** OAuth client (`com.farm2flavour.app` + the EAS keystore SHA-1) as well as the Web client.
- `cd mobile && npx eas-cli build -p android --profile preview`

**Delivery** (`delivery/`):

- `android.versionCode` in repo (currently **4**, app version **1.1.0** — bill PDF and loading screen)
- EAS project: [farm2flavour-delivery](https://expo.dev/accounts/ragavananthan/projects/farm2flavour-delivery) — set **preview** env vars (`EXPO_PUBLIC_SUPABASE_*`) before first cloud build
- Admin email/password on device (same as web admin)
- `cd delivery && npx eas-cli build -p android --profile preview`

**EAS Free plan:** Android cloud builds reset monthly. If quota is exhausted, wait for reset, upgrade Expo, or use `eas build --local`.

**QA loop:** Google sign-in and email link → place order → confirm → out for delivery → customer sees progress / UPI QR → delivered + payment → optional delivery bill PDF → Reports outstanding clear. Also check search (back arrow, categories still filter), a home poster under the categories, and Shop status blocking a new customer order while an existing order can still be updated. Create order: Coming soon products appear only when searched, grouped at the bottom. Selected payment fills the whole button. Profile logo, phone, and address print on the bill. The welcome photo is the sign-in picture, not the home poster. Use the **preview APK**, not a development client.

**Test case sheet (share with testers):** [qa-test-cases.xlsx](qa-test-cases.xlsx) — **How to use**, **Index**, then one sheet per module (add future Sign-up rows on **Sign-up**). Run every **P0** row on **All cases** and **TC-E2E-001** before launch ([qa-test-cases.md](qa-test-cases.md)).

## E. Practice data cleanup (simple)

1. Run [supabase/scripts/go-live-reset.sql](../supabase/scripts/go-live-reset.sql) after editing `v_business_id`.
2. **Storage:** Supabase → Storage → `product-images` → delete folder for your business id (and re-upload via import).
3. **Auth:** delete **customer** test users; keep admin.
4. Re-import catalog; re-add communities if used.
5. Test phones: clear app data or reinstall APK.

## F. Customer sign-in (Google and email)

SMS login is **off**. Do not turn Phone on in Supabase and do not buy SMTP until you choose that later.

1. Supabase → Authentication → Providers: **Google** and **Email** on, **Phone** off.
2. Redirect URLs include `farm2flavour://auth/callback`.
3. Google Cloud: Web client (secret only in Supabase, never in the app) plus Android client for package `com.farm2flavour.app` and the signing SHA-1.
4. Email mail stays the default Supabase template (no custom SMTP). Testers should expect **Supabase Auth** in the inbox.
5. Phone OTP code and `send-auth-sms` stay in the repo unused. See [supabase/documentation/phone-otp.md](../supabase/documentation/phone-otp.md) only if you later add a new SMS provider.

## G. Google Play (customer app only)

When the business Play account is ready, follow [play-store-checklist.md](play-store-checklist.md). Delivery stays **APK-only**; privacy draft: [privacy-policy-template.md](privacy-policy-template.md).

## H. Definition of done

Track detail in [pending-and-future-scope.md](pending-and-future-scope.md). Use the **Current pending** list at the top for 15 Nov 2026.

- [ ] All required migrations applied, including Nov 2026 selling units, min order, and inbox (checklist in [supabase-migration-checklist.md](supabase-migration-checklist.md))
- [x] Admin on HTTPS (Vercel, Oct 2026); service role set for push — **re-verify after the next deploy** (inbox phone alerts + Announcements tabs)
- [ ] Customer **preview or Play** APK on a real device with the 15 Nov features (inbox, selling units, privacy). Delivery APK if staff use it
- [ ] Practice data wiped; order numbers start at **100001**
- [ ] Real catalog live (units, stock, min order, posters)
- [ ] Google sign-in and email link work on that APK (not a development build)
- [ ] Privacy policy approved and published; Play Data safety matches
- [ ] Customer app on Play (or internal testing) per [play-store-checklist.md](play-store-checklist.md)
