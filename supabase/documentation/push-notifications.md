# Order status push notifications

Customers get push notifications when the shop moves an order to:

- **Confirmed** (`confirmed`)
- **Out for delivery** (`out_for_delivery`)
- **Delivered** (`delivered`)

Placed (`new`) and cancelled orders do not send push.

## 1. Apply the migration

Run [`supabase/migrations/20261011010000_push_notifications.sql`](../migrations/20261011010000_push_notifications.sql) in the Supabase SQL editor (or via CLI).

## 2. Deploy the Edge Function

From the repo root (with [Supabase CLI](https://supabase.com/docs/guides/cli) linked to the project):

```bash
supabase functions deploy send-order-status-push --no-verify-jwt
```

The function validates the caller with `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.

Supabase injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into the function environment automatically.

## 3. Admin server (recommended trigger)

Add to **admin** `.env` (local) and your hosted admin environment:

```env
SUPABASE_SERVICE_ROLE_KEY=<service role key from Supabase → Project Settings → API>
```

When an admin changes order status in the panel, `updateOrderStatus` invokes the Edge Function. If the key is missing, status updates still work; push is skipped.

## 4. Optional: Database Webhook (backup path)

If status can change outside the admin app (Partner API, SQL), add a webhook:

1. Supabase Dashboard → **Database** → **Webhooks** → **Create**
2. Table: `orders`, event: **Update**
3. URL: `https://<project-ref>.supabase.co/functions/v1/send-order-status-push`
4. HTTP headers: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
5. Payload: include `record` and `old_record` (default)

The function ignores updates that are not one of the three notify statuses.

## 5. Mobile app

- Uses **Expo Push** (`expo-notifications`). Tokens are saved with RPC `upsert_push_token` after the customer grants notification permission (shop tabs, signed in).
- Tapping a notification opens the order detail screen.
- **New APK required** after adding the plugin (`android.versionCode` bumped). EAS configures FCM for preview/production builds.

## 6. Test

1. Install the new APK on a **physical** device (push does not work on emulators).
2. Sign in, accept notification permission when prompted.
3. Place a test order; in admin, **Confirm order** → customer should receive push.
4. Repeat for **Out for delivery** and **Delivered**.

Check Edge Function logs in Supabase Dashboard → **Edge Functions** → **send-order-status-push** if nothing arrives.

## 7. Troubleshooting

| Symptom | Check |
|---------|--------|
| No permission prompt | User must reach Home (shop tabs) while signed in |
| Token not saved | Migration applied; RPC `upsert_push_token` granted |
| Admin update, no push | `SUPABASE_SERVICE_ROLE_KEY` on admin server; function deployed |
| Function 401 | Authorization header uses service role key, not anon key |
| Expo errors in logs | Token expired; reinstall app and sign in again |
