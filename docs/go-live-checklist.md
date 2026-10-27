# Go-live checklist

Use this after QA on **test data** and **before** the first real customer or production SMS. For the full dev sequence see the go-live plan in Cursor; technical detail is in [technical-guide.md](technical-guide.md).

## A. Migrations on hosted Supabase

Run every file in `supabase/migrations/` **in filename order** that is not yet applied on your project. Track progress in [supabase-migration-checklist.md](supabase-migration-checklist.md).

Minimum for the current apps (Oct 2026): through `20261027220000_business_upi_qr.sql`, including push and notify-me migrations if you use those features.

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

3. Set `SUPABASE_SERVICE_ROLE_KEY` on the **hosted admin** environment (never in mobile or delivery apps).

## C. Admin on HTTPS

1. Fix passes: `cd admin && npx tsc --noEmit && npm run build`
2. Deploy to Vercel (or similar) with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Smoke-test: login, order workflow, payment, product import.

## D. Preview APKs

**Customer** (`mobile/`):

- Bump `android.versionCode` in `app.json`
- EAS `preview` with `EXPO_PUBLIC_*` env; leave voice ordering off
- `cd mobile && npx eas-cli build -p android --profile preview`

**Delivery** (`delivery/`):

- Same Supabase env; admin test account on device
- `cd delivery && npx eas-cli build -p android --profile preview` (add `eas.json` if missing, copy from `mobile/eas.json`)

**QA loop:** place order → confirm → out for delivery → customer sees progress / UPI QR → delivered + payment → Reports outstanding clear.

## E. Practice data cleanup (simple)

1. Run [supabase/scripts/go-live-reset.sql](../supabase/scripts/go-live-reset.sql) after editing `v_business_id`.
2. **Storage:** Supabase → Storage → `product-images` → delete folder for your business id (and re-upload via import).
3. **Auth:** delete **customer** test users; keep admin.
4. Re-import catalog; re-add communities if used.
5. Test phones: clear app data or reinstall APK.

## F. Production SMS (Twilio)

Only after **E** is done.

Follow [supabase/documentation/phone-otp.md](../supabase/documentation/phone-otp.md). Keep one **test OTP** number for demos.

## G. Definition of done

- [ ] All required migrations applied
- [ ] Admin on HTTPS; service role set if using push from admin
- [ ] Customer + delivery APKs on real devices
- [ ] Practice data wiped; order numbers start at **100001**
- [ ] Real catalog live
- [ ] Twilio SMS works for a non-test number
- [ ] Update [pending-and-future-scope.md](pending-and-future-scope.md) with dates completed
