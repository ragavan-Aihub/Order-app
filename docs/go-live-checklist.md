# Go-live checklist

Use this after QA on **test data** and **before** the first real customer or production SMS. For the full dev sequence see the go-live plan in Cursor; technical detail is in [technical-guide.md](technical-guide.md).

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
- EAS **preview** env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_BUSINESS_ID`; leave voice ordering off
- `cd mobile && npx eas-cli build -p android --profile preview`

**Delivery** (`delivery/`):

- `android.versionCode` in repo (currently **3**)
- EAS project: [farm2flavour-delivery](https://expo.dev/accounts/ragavananthan/projects/farm2flavour-delivery) — set **preview** env vars (`EXPO_PUBLIC_SUPABASE_*`) before first cloud build
- Admin email/password on device (same as web admin)
- `cd delivery && npx eas-cli build -p android --profile preview`

**EAS Free plan:** Android cloud builds reset monthly. If quota is exhausted, wait for reset, upgrade Expo, or use `eas build --local`.

**QA loop:** place order → confirm → out for delivery → customer sees progress / UPI QR → delivered + payment → Reports outstanding clear.

**Test case sheet (share with testers):** [qa-test-cases.xlsx](qa-test-cases.xlsx) — sheet **How to use**, then **Test cases** in order from admin sign-in (Step 1). Columns include *Use case*, *What to do*, and *What you should see*. Run every **P0** row and Step 57 before launch ([qa-test-cases.md](qa-test-cases.md)).

## E. Practice data cleanup (simple)

1. Run [supabase/scripts/go-live-reset.sql](../supabase/scripts/go-live-reset.sql) after editing `v_business_id`.
2. **Storage:** Supabase → Storage → `product-images` → delete folder for your business id (and re-upload via import).
3. **Auth:** delete **customer** test users; keep admin.
4. Re-import catalog; re-add communities if used.
5. Test phones: clear app data or reinstall APK.

## F. Production SMS (2Factor.in)

Only after **E** is done.

Deploy the Send SMS hook and set secrets — [supabase/documentation/phone-otp.md](../supabase/documentation/phone-otp.md). Script: `supabase/scripts/deploy-auth-sms-hook.sh`. Disconnect Twilio in Supabase Phone settings. Keep one **test OTP** number for demos.

## G. Google Play (customer app only)

When the business Play account is ready, follow [play-store-checklist.md](play-store-checklist.md). Delivery stays **APK-only**; privacy draft: [privacy-policy-template.md](privacy-policy-template.md).

## H. Definition of done

Track detail in [pending-and-future-scope.md](pending-and-future-scope.md).

- [ ] All required migrations applied (checklist in [supabase-migration-checklist.md](supabase-migration-checklist.md))
- [x] Admin on HTTPS (Vercel, Oct 2026); service role set for push — **verified:** order + notification smoke test
- [ ] Customer + delivery **preview APKs** on real devices (or Expo Go until EAS quota)
- [ ] Practice data wiped; order numbers start at **100001**
- [ ] Real catalog live
- [ ] 2Factor.in SMS works for a non-test number (Send SMS hook)
- [ ] Customer app on Play (or internal testing) per [play-store-checklist.md](play-store-checklist.md)
