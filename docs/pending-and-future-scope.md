# Pending work and future scope

This is the single list of work that is not finished yet. Update it whenever an item is done, moved to a later phase, or dropped.

Status values:

- **Pending**: needs doing before go-live.
- **Phase 2**: built or designed, but deliberately switched off or postponed.
- **Idea**: worth discussing, not yet agreed.
- **Tech debt**: works today, but should be cleaned up.

Last updated: 5 Nov 2026 (home posters, shop status, search screen, voice ordering removed from the app).

## Must do before go-live

**Operator checklist:** [docs/go-live-checklist.md](go-live-checklist.md)  
**Migration audit table:** [docs/supabase-migration-checklist.md](supabase-migration-checklist.md)  
**Practice data wipe:** [supabase/scripts/go-live-reset.sql](../supabase/scripts/go-live-reset.sql)

### Run the database migrations

- **Status:** Pending
- **Why:** The apps already expect these changes. Until they are applied, modifying an open order uses an older fallback function, order lookups are slower, old orders can still be in the removed Preparing status, and saved addresses fail to load or save because the City column is missing.
- **How:** Run each file in the Supabase SQL editor, in this order:
  1. `supabase/migrations/20261002120000_replace_order_address.sql`
  2. `supabase/migrations/20261003000000_orders_lookup_indexes.sql`
  3. `supabase/migrations/20261003120000_remove_preparing_status.sql`
  4. `supabase/migrations/20261004000000_address_city.sql` (run this one first if you only run one today: the admin and the next app build read the new City column)
  5. `supabase/migrations/20261004010000_fix_address_community_trigger.sql` (fixes "function max(uuid) does not exist" when a customer adds an address in the app)
  6. `supabase/migrations/20261004020000_order_placed_via_update_limit.sql` (records cart or voice orders and limits each order to 5 customer updates; the app reads these columns)
  7. `supabase/migrations/20261004030000_order_update_limit_message.sql` (the limit error says "Modify limit reached" without showing customers the number of updates)
  8. `supabase/migrations/20261004040000_order_status_events_customer_read.sql` (lets customers read the status history of their own orders, so the app can show the date and time of each step; until it runs, the app shows only the placed time)
  9. `supabase/migrations/20261005000000_customer_cancel_rules.sql` (customers can cancel only while an order is Placed, at most 3 cancellations in 24 hours; the reason is always set on the server. The admin panel is not affected. Until it runs, the app hides Cancel for confirmed orders but the server still allows it)
  10. `supabase/migrations/20261005010000_security_hardening.sql` (run after step 9. Order prices and totals come from the product list instead of the app; customers cannot mark orders as paid or set other internal fields; the customer record links by the verified OTP phone; plus address, cancel, Partner API and storage limits. Works with the current app, no new build needed)
  11. Order modification stack (admin shop edits, customer block after shop modify, revert): `20261010000000_order_modifications.sql` through `20261014000000_admin_revert_pre_admin_snapshot.sql` — run in filename order on hosted Supabase if not already applied.
  12. **Push notifications:** `20261011010000_push_notifications.sql`, then `20261018000000_push_service_role_grants.sql` (required for Edge Function reads). Deploy `send-order-status-push`, set `SUPABASE_SERVICE_ROLE_KEY` on admin, install preview APK (not Expo Go). See `supabase/documentation/push-notifications.md`.
  13. **Notify me:** `20261019100000_product_notify_interests.sql`. Deploy `send-product-available-push` (same service role auth as order push). Admin triggers it when a product flips from Coming soon to Available.
  14. **UPI QR at delivery:** `20261027220000_business_upi_qr.sql` (`businesses.upi_qr_url`). Used by the delivery app upload and the customer order detail when out for delivery and unpaid.
  15. **Audit log:** `20261028210000_admin_audit_log.sql`. Required for admin **Audit log** page and for delivery-app rows in that report.
  16. **Shop status and home posters:** `20261105010000_shop_notice.sql`, `20261105020000_shop_banners.sql`, `20261105030000_shop_banner_focus.sql`, `20261105040000_shop_notice_hardening.sql`. Run in that order on a new database. The hosted project already has them. Do not use `supabase db push` for the whole history.

### Admin on HTTPS

- **Status:** Done (Oct 2026)
- **What:** Admin deployed on **Vercel** (repo `Order-app`, root `admin`). Env: `NEXT_PUBLIC_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` for push from admin. Order + push smoke test passed on production URL (use **Visit** / Domains hostname, not an unassigned `*.vercel.app` guess).
- **Docs:** [vercel-admin-deploy.md](vercel-admin-deploy.md), [go-live-checklist.md](go-live-checklist.md) §C.

### Admin audit log

- **Status:** Done (code). **Pending:** run migration `20261028210000_admin_audit_log.sql` on hosted Supabase if the Audit log page errors.
- **What:** `/audit` with filters; merges `admin_audit_log` and admin order item edits. Delivery app logs status/payment with `[Delivery]` prefix.
- **Docs:** Business Guide §4.8; Technical Guide §11.2.

### Preview APK for demos

- **Status:** **Pending** — repo ready (`mobile` versionCode **23**, `delivery` version **1.1.0** / versionCode **4**, EAS projects linked). **Oct 2026:** Expo Free Android cloud quota exhausted until ~monthly reset; use Expo Go for QA until then, or `eas build --local`, or upgrade plan.
- **How:** Set `EXPO_PUBLIC_*` on each EAS **preview** environment (delivery project: `farm2flavour-delivery`). Then `npx eas-cli build -p android --profile preview` from `mobile/` and `delivery/`. Do not add a microphone permission. See [go-live-checklist.md](go-live-checklist.md) §D.

## After demo feedback (agreed, not all built)

**Summary for stakeholders:** `docs/post-demo-updates.md`

### Pending deliveries on the dashboard and orders list

- **Status:** Done (admin)
- **What:** Dashboard KPI **Pending deliveries** (placed + confirmed, not out for delivery) links to `/orders?view=pending_delivery`. Orders list has a **Pending delivery** tab with the same filter.
- **Files:** `admin/services/reports.ts`, `admin/app/(admin)/page.tsx`, `admin/components/OrdersBoard.tsx`, `admin/app/(admin)/orders/page.tsx`

### Customer modify alerts for admin (after confirm only)

- **Status:** Done (admin)
- **What:** No alert while **Placed**. After **Confirmed**, dashboard banner + orders filter tab + **Customer modified** badge (sky) vs **Shop modified** (amber). Order detail shows diff vs lines at confirm time.
- **Files:** `admin/lib/order-modification-state.ts`, `admin/services/order-modifications.ts`, `admin/app/(admin)/page.tsx`, `admin/components/OrdersBoard.tsx`, `admin/components/AdminOrderModifyPanel.tsx`

### App customer vs admin customer (addresses / orders)

- **Status:** Done (migration + admin)
- **What:** App saved addresses link to `customers` via trigger and `ensure_customer_profile` backfill. Admin customer list/detail counts app addresses and orders by `auth_user_id` when needed.
- **Migration:** `supabase/migrations/20261015000000_link_app_addresses_to_customer.sql`
- **Demo tip:** Reusing the same Supabase Test OTP phone reuses the same Auth user and saved receiver names — use a fresh test number or clear app data between demos.

### Create order — duplicate mobile dialog

- **Status:** Done (admin)
- **What:** **Use a different number** clears the mobile field instead of allowing the same number until save.

### Delivery app (staff) and UPI QR

- **Status:** Done (code). **Pending:** run UPI + audit migrations on hosted Supabase if not applied; install delivery preview APK when EAS quota allows.
- **What:** `delivery/` Expo app (1.1.0 / versionCode 4) with admin login, To deliver / Delivered today queues, swipe status, payment on deliver, UPI QR upload to `businesses.upi_qr_url`. After mark-delivered, staff can share an invoice PDF (shop profile, unit price) through the phone share sheet. If admin already marked **Delivered**, the app refreshes and offers **record payment only** (no duplicate deliver, no bill prompt). Conflicts with admin updates show an in-app notice instead of a generic error alert. Actions appear in admin **Audit log** with `[Delivery]`. Admin **Profile** stores the logo, phone, email, and address used on that bill.
- **Docs:** Business Guide §3.11; Technical Guide §7.4 and §11.1.

### Customer app — Your Orders and Home polish

- **Status:** Done (code). Ship with the next preview APK.
- **What:** Orders tab title **Your Orders**; list cards without order number; status headline + product thumbs; payment pending below thumbs; Home category chips fixed under search; 2-column product grid with FlatList performance fixes.

### Coming soon → Notify me

- **Status:** Done (code). **Pending:** run migration `20261019100000_product_notify_interests.sql` on hosted Supabase; deploy Edge Function `send-product-available-push` (`--no-verify-jwt`); preview APK if you ship mobile-only.
- **What:** Customers tap **Notify me** on coming-soon products (one tap, optional Settings prompt if notifications off). Admin **Notify me demand** on Products lists name, mobile, and counts; flipping **Coming soon → Available** sends push and clears the wait list.
- **Docs:** `supabase/documentation/push-notifications.md` (product-available section).

## Phase 2

### Voice ordering

- **Status:** Out of scope. Not in the customer app.
- **What customers see:** no Order by Voice card. The old voice screen sends them to Home. The app does not ask for the microphone. Android builds block `RECORD_AUDIO`. `expo-speech-recognition` is not installed.
- **Not a switch:** `EXPO_PUBLIC_VOICE_ORDERING` is ignored. Putting voice back would be new work: the screen, the speech package, the microphone permission, and a privacy-policy change.
- **Leftover code:** `admin/lib/sam/`, `admin/app/api/sam/turn/route.ts`, `mobile/src/sam/`, `mobile/src/app/sam.tsx`. The turn route still requires a signed-in customer, but the app does not call it.

### Product detail page (hidden for now)

- **Status:** Phase 2
- **Why:** For this phase, tapping a product on Home or Buy again does nothing; the card shows the image, name, price and the Add button or quantity stepper. The detail page needs better content (description, sizes, related items) before it is worth opening.
- **To turn it back on:** pass `onPress={() => router.push(`/product/${product.id}`)}` to `ProductCard` in Home and Buy again. The screen itself is kept.
- **Files:** `mobile/src/app/product/[id].tsx`, `mobile/src/components/ProductCard.tsx`, `mobile/src/app/(shop)/home.tsx`, `mobile/src/app/(shop)/buy-again.tsx`

### Quick status actions on the orders list

- **Status:** Phase 2 (built, switched off)
- **What:** A next-step button ("Confirm order", "Mark out for delivery", "Mark as delivered") and a More menu (view details, cancel) on each order in the admin orders list, on both the desktop table and the phone cards.
- **Today:** Status changes happen only on the order detail page.
- **How to switch on:** Set `LIST_QUICK_ACTIONS = true` in `admin/components/OrdersBoard.tsx`.
- **Files:** `admin/components/OrdersBoard.tsx`, `admin/components/OrderWorkflow.tsx`

### Call and WhatsApp the customer from an order

- **Status:** Future (removed from the order More menu)
- **What:** "Call customer" and "WhatsApp customer" items in the order More menu.
- **If brought back:** Build the WhatsApp link from the last 10 digits plus `91`, as the rest of the app does, so numbers like `09876543210` work.
- **Files:** `admin/components/OrderWorkflow.tsx`

### New orders to an address that is out for delivery

- **Status:** Phase 2 (decision needed)
- **Question:** On the customer "Start another order" screen, should an address whose order is out for delivery keep the "Deliver a new order here" link? Today it does, because the database only blocks a second order while the first is Placed or Confirmed.
- **Files:** `mobile/src/sam/NewOrderAddressPicker.tsx`

### Next-step actions on the dashboard

- **Status:** Phase 2
- **What:** The same next-step button on the "Recent orders" table on the admin dashboard.
- **Files:** `admin/app/(admin)/page.tsx`

### Admin Test mode and Go live wizard

- **Status:** Phase 2 (designed, **not built** — do after QA)
- **Why:** During testing the database fills with orders, customers, and test products. Before real launch, the shop needs a one-click **Go live** flow that shows progress, wipes that data, resets order numbers to 100001, and switches the shop from **test** to **live** mode—without running SQL by hand.
- **What:** Test mode banner in admin; Settings → Go live with confirmation and steps (database wipe, product images in Storage, delete customer auth accounts, finalize). Keeps the business row and admin login. Manual checklist afterward: remove Supabase Test OTP, re-import catalog and communities, clear app data on test phones.
- **Spec:** `docs/go-live-wizard-plan.md`
- **Until built:** Use Supabase SQL editor / dashboard for cleanup, or add `supabase/scripts/go-live-reset.sql` when implementing the wizard.

## Known issues and tech debt

- **Development timing logs.** `mobile/src/services/supabase.ts` logs every request as `[supabase] METHOD path status ms`. These logs only appear in development builds, but can be removed once performance is settled.
- **Older admin type errors.** Two are in `admin/services/reports.ts` (a possibly undefined string) and one in `admin/services/storage.ts` (a `File` cast to `Buffer`). They do not stop the dev server, but `next build` may fail on them.
- **Admin lint error.** `admin/components/OrdersBoard.tsx` resets the page number inside an effect (`react-hooks/set-state-in-effect`).
- **Unused component.** `admin/components/OrderTimeline.tsx` is no longer used after the order workflow redesign.
- **Old SQL that mentions Preparing.** Older functions and indexes in `supabase/migrations/` still list `'preparing'`. This is harmless once the removal migration has run, because no order can have that status.
- **Boilerplate admin README.** `admin/README.md` is still the default create-next-app text.
- **Shop name fixed in code.** The app name, package, logos and voice replies still name the current shop (see "Setting up for a new business" in `docs/technical-guide.md`). Move them to environment variables or the `businesses` table before offering the product to another business.
- **Customer order prices come from the app.** Placing an order and `customer_replace_order_items` store the prices the app sends. Move both to a database function that reads prices from `products`.
- **Mobile eslint packages.** `mobile/package.json` gained `eslint` and `eslint-config-expo` as dev dependencies. Keep them to enable `npx expo lint`, or remove them.

## Future scope ideas

- **Voice, hands-free mode, and a wake word:** not scheduled. The current app does not use the microphone.
- **Status notifications (WhatsApp):** optional channel in addition to push (push for confirmed / out for delivery / delivered is implemented — see `supabase/documentation/push-notifications.md`; deploy migration, Edge Function, admin service role, new APK).
- **Help and contact screen** in the app (call or WhatsApp the shop). The business phone and email are already stored.
- **Delivery instructions** typed by the customer in the app.
- **Delivery planning by community** (delivery runs). The `delivery_runs` tables exist, but no screen uses them yet.
- **Download from Reports.** Today, use Export on the Orders list.
- **Partner API limits:** rate limits and usage statistics, to protect against misuse.

## Documentation

- **Business Guide:** `docs/business-guide.md`. Written for the business owner and staff. It covers only what is live today: customer app, admin panel, business rules and FAQ. It does not cover the Partner API, WhatsApp, features that are switched off, dropped features or future ideas. Those live in the Technical Guide and in this file.
- **Technical Guide:** `docs/technical-guide.md`. Covers what is present in the code: architecture, setup, new business setup, database and migrations, app internals, order lifecycle, Partner API, switched-off features, build and deploy, troubleshooting, tech debt. Voice ordering is recorded there as not in the app. Future ideas live only in this file.
- **Google Play (customer app):** [docs/play-store-checklist.md](play-store-checklist.md), privacy draft [docs/privacy-policy-template.md](privacy-policy-template.md), share PDF via `npm run docs:privacy-pdf` → [docs/pdf/Privacy-Policy-For-Review.pdf](pdf/Privacy-Policy-For-Review.pdf). Delivery app is APK-only, not Play.
- **PDF:** run `npm run docs:pdf` from the repo root. Output goes to `docs/pdf/Business-Guide.pdf` and `docs/pdf/Technical-Guide.pdf`. Styling is in `docs/pdf-style.css`.
- **Presentation:** `docs/presentation.md`. Run `npm run docs:presentation` to rebuild `docs/pdf/Project-Presentation.pptx` (PowerPoint or Keynote), plus the HTML and PDF. When a customer or shop-facing behaviour changes, update this deck in the same change.
- **No brand name:** both guides are written for any business using this product. Keep them that way. The presentation may name the current shop, because it is the talk track for this project.
- **Keep them current:** when a feature, rule or migration changes, update the matching guide and the presentation in the same change.
