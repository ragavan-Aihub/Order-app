# Order status push notifications

Customers get push notifications when the shop moves an order to:

- **Confirmed** (`confirmed`)
- **Out for delivery** (`out_for_delivery`)
- **Delivered** (`delivered`)

Placed (`new`) and cancelled orders do not send push.

## 1. Apply the migrations

Run in the Supabase SQL editor (or via CLI), in order:

1. [`20261011010000_push_notifications.sql`](../migrations/20261011010000_push_notifications.sql) — `push_tokens` table and `upsert_push_token` RPC
2. [`20261018000000_push_service_role_grants.sql`](../migrations/20261018000000_push_service_role_grants.sql) — lets the Edge Function read `orders` and `push_tokens` with the service role key (without this, invocations return **500** `permission denied for table orders`)
3. [`20261019100000_product_notify_interests.sql`](../migrations/20261019100000_product_notify_interests.sql) — **Notify me** wait list and admin demand RPCs (required for product-available push)
4. [`20261024100000_product_push_service_role_grants.sql`](../migrations/20261024100000_product_push_service_role_grants.sql) — lets `send-product-available-push` read `products` (without this, push is skipped or **500** `permission denied for table products`)

## 2. Deploy the Edge Functions

From the repo root (with [Supabase CLI](https://supabase.com/docs/guides/cli) linked to the project):

```bash
supabase functions deploy send-order-status-push --no-verify-jwt
supabase functions deploy send-product-available-push --no-verify-jwt
```

`send-order-status-push` accepts either:

- `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (admin server, webhooks), or
- a signed-in **admin** user JWT from the delivery app (must match the order’s business and current status).

`send-product-available-push` still requires the service role key.

Supabase injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into the function environment automatically.

## 3. Admin server (recommended trigger)

Add to **admin** `.env` (local) and your hosted admin environment:

```env
SUPABASE_SERVICE_ROLE_KEY=<service role key from Supabase → Project Settings → API>
```

When an admin changes order status in the panel, `updateOrderStatus` invokes `send-order-status-push`. The **delivery** app invokes the same function after a successful status update (admin session token). When a product goes from **Coming soon** to **Available**, `updateProductAvailability` invokes `send-product-available-push`. If the key is missing on admin, panel updates still work; push is skipped.

After changing auth on `send-order-status-push`, redeploy:

```bash
supabase functions deploy send-order-status-push --no-verify-jwt
```

## 4. Optional: Database Webhook (backup path)

If status can change outside the admin app (Partner API, SQL), add a webhook:

1. Supabase Dashboard → **Database** → **Webhooks** → **Create**
2. Table: `orders`, event: **Update**
3. URL: `https://<project-ref>.supabase.co/functions/v1/send-order-status-push`
4. HTTP headers: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
5. Payload: include `record` and `old_record` (default)

The function ignores updates that are not one of the three notify statuses.

## 5. Mobile app (Expo + Android FCM)

Firebase is **only** for Google’s push pipe on Android; Supabase remains your backend.

1. [Firebase Console](https://console.firebase.google.com/) — Android app `com.farm2flavour.app`.
2. Download **`google-services.json`** → save as `mobile/google-services.json` (already referenced in `app.json`).
3. **EAS FCM V1:** Firebase → Project settings → Service accounts → **Generate new private key** → upload in `eas credentials` → **Push Notifications (FCM V1)** (preview + production profiles). Do **not** commit that JSON; add to `.gitignore`.
4. Bump `android.versionCode`, rebuild preview APK, reinstall.

- Uses **Expo Push** (`expo-notifications`). Tokens are saved with RPC `upsert_push_token` after the customer grants notification permission (shop tabs, signed in).
- Tapping an **order** notification opens the order detail screen.
- Tapping a **product available** notification opens **Home**, scrolls to that product in the grid, and highlights it briefly (`data.productId`), including when the app was opened from a killed state.

### Notify me (coming soon products)

- On products with `available === false`, customers tap **Notify me** (one tap; interest is saved even if they decline the Settings prompt).
- RPCs: `upsert_product_notify_interest`, `remove_product_notify_interest`, `my_product_notify_interests`.
- When admin marks the product **Available**, interested customers get **Now available** push; rows in `product_notify_interests` for that product are deleted after send.
- Product pushes include the product photo when `image_url` is a public **https** URL (`richContent.image`). On **Android** it shows in the notification. The small left glyph is still the Farm2Flavour app icon unless you add a custom Android notification icon setup.

## 6. Test

1. Install the new APK on a **physical** device (push does not work on emulators).
2. Sign in, accept notification permission when prompted.
3. Place a test order; in admin, **Confirm order** → customer should receive push.
4. Repeat for **Out for delivery** and **Delivered**.
5. **Notify me:** Mark a product **Coming soon** in admin; in the app tap **Notify me**; flip to **Available** → push **Now available**; admin **Notify me demand** clears for that product.

Check Edge Function logs in Supabase Dashboard → **Edge Functions** if nothing arrives.

## 7. Troubleshooting

| Symptom | Check |
|---------|--------|
| No permission prompt | User must reach Home (shop tabs) while signed in |
| Token not saved | Migration applied; RPC `upsert_push_token` granted |
| Admin update, no push | `SUPABASE_SERVICE_ROLE_KEY` on admin server; function deployed |
| Function 401 | Authorization header uses service role key, not anon key; redeploy function after auth changes |
| Function 500 permission denied | Order push: `20261018000000_push_service_role_grants.sql`. Product push: also `20261024100000_product_push_service_role_grants.sql` |
| 200 `skipped` / `no_app_user` | Order was not placed by a signed-in app user (no `user_id`); push only for app orders |
| 200 `sent: 0` | No row in `push_tokens` — see below |
| `push_tokens` always empty | Signed in (OTP account, not browse-only skip); migration `20261011010000` applied; notifications **Allowed**; open Home after login; on Android preview builds, configure **FCM** in [Expo credentials](https://docs.expo.dev/push-notifications/fcm-credentials/) for the EAS project |
| Expo errors in logs | Token expired; reinstall app and sign in again |
| Expo `InvalidCredentials` / FCM server key | FCM **V1 service account** on [expo.dev](https://expo.dev) → project **farm2flavour** → Credentials → Android → **preview**, from the **same** Firebase project as `google-services.json` (`order-app-1b975`). Re-upload, wait ~1 min, test again (no new APK needed). |
| Notify me save fails | Migration `20261019100000` applied; product is active + coming soon |
| Product push, no recipients | Customer saved interest while signed in; has `push_tokens` row after granting permission |
