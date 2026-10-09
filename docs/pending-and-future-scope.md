# Pending work and future scope

This is the single list of work that is not finished yet. Update it whenever an item is done, moved to a later phase, or dropped.

Status values:

- **Pending**: needs doing before go-live.
- **Phase 2**: built or designed, but deliberately switched off or postponed.
- **Idea**: worth discussing, not yet agreed.
- **Tech debt**: works today, but should be cleaned up.

Last updated: 10 Oct 2026.

## Must do before go-live

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

### Build a new APK with the latest customer app changes

- **Status:** Pending
- **Why:** The last preview APK (version code 10) still shows the "Order by Voice" card, which only works on the developer's Wi-Fi. It also lacks the City field, the new-order screen, Modify opening the cart, the modify limit, and the Preparing status cleanup. Leave `EXPO_PUBLIC_VOICE_ORDERING` unset so voice stays hidden.
- **How:** Bump `android.versionCode` in `mobile/app.json`, then run `npx eas-cli build -p android --profile preview` from `mobile/`.

### Commit the current work

- **Status:** Pending
- **Why:** The voice fix and listening orb, the admin order workflow, the Preparing removal, the list quick-actions switch and this document are not committed yet.

## Phase 2

### Voice ordering (hidden for now)

- **Status:** Phase 2
- **Why:** Voice ordering only works on the developer's Wi-Fi: the app sends voice requests to the admin server on the Mac (`http://192.168.1.11:3000/api/sam/turn`). It also has no AI today (`OLLAMA_URL` is not set), so it runs on rules and fixed replies. It is hidden from customers until it can be hosted and improved. All the code is kept.
- **What is hidden:** the "Order by Voice" card on Home. Anything else that opens the voice screen (after login, after adding an address, old links) goes to Home instead.
- **To turn it back on:**
  1. Host the voice server publicly. The agreed direction is a Supabase Edge Function (free plan allows commercial use), moving `admin/lib/sam/` there.
  2. Set `EXPO_PUBLIC_SAM_API_URL` to the public address, and `EXPO_PUBLIC_VOICE_ORDERING=true`, in `mobile/.env` and the EAS `preview` environment.
  3. Rebuild the APK.
- **Later improvements discussed:** personal greeting and "your usual" order, tappable suggestions when it doesn't understand, animated listening screen and product cards, product tips from your own descriptions, order updates in chat, then a natural cloud voice and a hosted AI model on free tiers first. Measure voice use with the `placed_via` column on orders.
- **Files:** `mobile/src/config/env.ts`, `mobile/src/app/(shop)/home.tsx`, `mobile/src/app/sam.tsx`, `mobile/src/sam/`, `admin/lib/sam/`, `admin/app/api/sam/turn/route.ts`

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

- **Voice:** recognition that keeps working without internet or in the background, and better Tamil recognition.
- **Hands-free conversation mode:** after the assistant replies, reopen the mic automatically for the follow-up, until the customer taps X or stays quiet.
- **Wake word:** a "Hey …" wake word was tried and removed. Android speech recognition has to listen all the time for it, which costs battery and data, sends everything said near the phone for transcription, and only works on Android 13 or newer. If it comes back, use an on-device wake-word engine (for example Picovoice Porcupine) instead.
- **Status notifications (WhatsApp):** optional channel in addition to push (push for confirmed / out for delivery / delivered is implemented — see `supabase/documentation/push-notifications.md`; deploy migration, Edge Function, admin service role, new APK).
- **Help and contact screen** in the app (call or WhatsApp the shop). The business phone and email are already stored.
- **Delivery instructions** typed by the customer in the app.
- **Better voice:** a natural cloud voice, "your usual order" and product tips.
- **Delivery planning by community** (delivery runs). The `delivery_runs` tables exist, but no screen uses them yet.
- **Download from Reports.** Today, use Export on the Orders list.
- **Partner API limits:** rate limits and usage statistics, to protect against misuse.

## Documentation

- **Business Guide:** `docs/business-guide.md`. Written for the business owner and staff. It covers only what is live today: customer app, admin panel, business rules and FAQ. It does not cover the Partner API, WhatsApp, features that are switched off, dropped features or future ideas. Those live in the Technical Guide and in this file.
- **Technical Guide:** `docs/technical-guide.md`. Covers what is present in the code: architecture, setup, new business setup, database and migrations, app internals, order lifecycle, Partner API, voice, switched-off features, build and deploy, troubleshooting, tech debt. Future ideas live only in this file.
- **PDF:** run `npm run docs:pdf` from the repo root. Output goes to `docs/pdf/Business-Guide.pdf` and `docs/pdf/Technical-Guide.pdf`. Styling is in `docs/pdf-style.css`.
- **No brand name:** both guides are written for any business using this product. Keep them that way.
- **Keep them current:** when a feature, rule or migration changes, update the matching guide in the same change.
