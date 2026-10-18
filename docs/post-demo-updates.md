# Updates after the demo (Oct 2026)

Short summary of what we changed based on demo feedback and issues seen during testing. All of this is on `master` (commit `01b57e1` and earlier post-demo work).

## New features (admin)

### Pending deliveries

- **Dashboard:** New **Pending deliveries** KPI — orders that are **Placed** or **Confirmed** and not yet out for delivery. Tap through to the filtered orders list.
- **Orders:** **Pending delivery** tab and filter (`/orders?view=pending_delivery`).
- **Why:** Staff needed one place to see what still needs confirming or packing, not only “waiting to confirm.”

### Customer modified orders (after confirm)

- **When it applies:** If the customer changes items **after** the shop has **Confirmed** the order. Changes while the order is still **Placed** do not trigger this alert.
- **How it looks:** **Customer modified** badge (blue) on dashboard banner, orders list, and order detail — separate from **Shop modified** (amber).
- **Order detail:** Item diff vs what the order looked like **at confirm time**.
- **Why:** Shop edits and customer self-serve edits are different workflows; alerts after confirm avoid noise on brand-new orders.

## Bug fixes

### App customers vs admin customer records

- **Problem:** Orders from the app showed delivery details, but **Customers** in admin often had **no addresses** and missing order history — app saved addresses under the login user, admin only looked at `customer_id`.
- **Fix:** Database migration links app addresses and orders to the right `customers` row; admin list and customer detail also follow the app login when needed.
- **Migration (run on Supabase):** `supabase/migrations/20261015000000_link_app_addresses_to_customer.sql` — **applied on hosted project.**

### Create order — duplicate mobile number

- **Problem:** When adding a new customer with a number that already exists, **Use a different number** closed the dialog but left the same number in the field, so staff could proceed until save failed.
- **Fix:** That action now **clears the mobile field** so a different number must be entered (or use **Load this customer**).

## Already shipped around the same time (mobile + admin)

These were in the tree before / alongside the post-demo admin batch; relevant if you compare to the **preview APK (v16)**:

- **Shop-modify UX (admin):** Clearer shop-only diff, undo shop changes without wiping earlier customer edits, removed lines visible in edit mode.
- **Mobile:** Block customer modify after a shop edit; **(Shop modified)** on orders; fix stale “modify order” session after admin cancels an order — **in repo from `91e3e7c`; needs a newer APK (e.g. v17) on device if not rebuilt yet.**

## Not done yet

- **Coming soon → Notify me** on unavailable products (interest list + admin view + optional push).

## Demo / test tips

- Supabase **Test OTP** numbers reuse the same login and saved addresses. For a clean walkthrough, use a **fresh test phone** or sign out and clear app data.
- Admin changes do not require a new customer APK except for mobile fixes above.

## Reference

- Tracking list: `docs/pending-and-future-scope.md` (section **After demo feedback**).
- Git: `01b57e1` — post-demo admin ops, customer linking migration, duplicate-mobile UX.
