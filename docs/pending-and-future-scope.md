# Pending work and future scope

This is the single list of work that is not finished yet. Update it whenever an item is done, moved to a later phase, or dropped.

Status values:

- **Pending**: needs doing before go-live.
- **Phase 2**: built or designed, but deliberately switched off or postponed.
- **Idea**: worth discussing, not yet agreed.
- **Tech debt**: works today, but should be cleaned up.

Last updated: 3 Oct 2026.

## Must do before go-live

### Run the database migrations

- **Status:** Pending
- **Why:** The apps already expect these changes. Until they are applied, modifying an open order uses an older fallback function, order lookups are slower, and old orders can still be in the removed Preparing status.
- **How:** Run each file in the Supabase SQL editor, in this order:
  1. `supabase/migrations/20261002120000_replace_order_address.sql`
  2. `supabase/migrations/20261003000000_orders_lookup_indexes.sql`
  3. `supabase/migrations/20261003120000_remove_preparing_status.sql`

### Give voice ordering a permanent server address

- **Status:** Pending
- **Why:** The customer app sends voice and chat requests to the admin server on the developer's Mac over Wi-Fi (`http://192.168.1.11:3000/api/sam/turn`). Voice ordering only works when the phone is on the same Wi-Fi, the admin server is running, and the Mac keeps that address.
- **How:** Deploy the admin app publicly (for example on Vercel). Set `EXPO_PUBLIC_SAM_API_URL` to the public `/api/sam/turn` URL in the EAS `preview` environment and in `mobile/.env`, then rebuild the APK.
- **Files:** `mobile/.env`, EAS environment variables, `mobile/src/config/env.ts`

### Build a new APK with the latest customer app changes

- **Status:** Pending
- **Why:** The last preview APK (version code 10) does not have tap-to-talk voice ordering, the removal of the "Sam" name (including the Android microphone prompt text), or the Preparing status cleanup in the customer app.
- **How:** Bump `android.versionCode` in `mobile/app.json`, then run `npx eas-cli build -p android --profile preview` from `mobile/`.

### Commit the current work

- **Status:** Pending
- **Why:** The voice fix and listening orb, the admin order workflow, the Preparing removal, the list quick-actions switch and this document are not committed yet.

## Phase 2

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

### Payment extras (decision needed)

- **Status:** Phase 2 (decision needed, changes business rules)
- **Mark as unpaid:** a More menu item to undo a payment saved by mistake. The server currently refuses to set payment back to pending (`updateOrderPayment` in `admin/services/order-actions.ts`).
- **Payment on delivery:** when marking an unpaid order delivered, ask "Payment collected? Cash / UPI / Not yet" in the same confirmation.
- **Files:** `admin/components/OrderPaymentForm.tsx`, `admin/components/OrderWorkflow.tsx`, `admin/services/order-actions.ts`

### Next-step actions on the dashboard

- **Status:** Phase 2
- **What:** The same next-step button on the "Recent orders" table on the admin dashboard.
- **Files:** `admin/app/(admin)/page.tsx`

## Known issues and tech debt

- **Development timing logs.** `mobile/src/services/supabase.ts` logs every request as `[supabase] METHOD path status ms`. These logs only appear in development builds, but can be removed once performance is settled.
- **Older admin type errors.** Two are in `admin/services/reports.ts` (a possibly undefined string) and one in `admin/services/storage.ts` (a `File` cast to `Buffer`). They do not stop the dev server, but `next build` may fail on them.
- **Admin lint error.** `admin/components/OrdersBoard.tsx` resets the page number inside an effect (`react-hooks/set-state-in-effect`).
- **Unused component.** `admin/components/OrderTimeline.tsx` is no longer used after the order workflow redesign.
- **Old SQL that mentions Preparing.** Older functions and indexes in `supabase/migrations/` still list `'preparing'`. This is harmless once the removal migration has run, because no order can have that status.
- **Boilerplate admin README.** `admin/README.md` is still the default create-next-app text.
- **Mobile eslint packages.** `mobile/package.json` gained `eslint` and `eslint-config-expo` as dev dependencies. Keep them to enable `npx expo lint`, or remove them.

## Future scope ideas

- **Voice:** recognition that keeps working without internet or in the background, and better Tamil recognition.
- **Hands-free conversation mode:** after the assistant replies, reopen the mic automatically for the follow-up, until the customer taps X or stays quiet.
- **Wake word:** a "Hey …" wake word was tried and removed. Android speech recognition has to listen all the time for it, which costs battery and data, sends everything said near the phone for transcription, and only works on Android 13 or newer. If it comes back, use an on-device wake-word engine (for example Picovoice Porcupine) instead.
- **Status notifications:** tell customers by push notification or WhatsApp when their order status changes.

## Documentation (after code freeze)

Once the code is frozen, write two sets of documents under `docs/`.

### Technical guide (`docs/technical/`)

- Architecture: customer app, admin app and Supabase, with a diagram
- Setup and environment variables
- Database schema, migrations and access rules
- Order lifecycle and status rules
- Voice and chat ordering pipeline (code still lives under `sam/`)
- Partner API v1
- Building the APK with EAS and deploying the admin app
- Troubleshooting

### Non-technical guide (`docs/user-guide/`)

- Business owner guide to the admin panel: orders, the status workflow, payments and refunds, products, customers, reports
- Customer app guide: ordering, voice ordering, modifying and cancelling orders, addresses
- FAQ
