# Admin Test mode and Go live wizard (planned — not built yet)

**Status:** Deferred. Implement after QA on order modifications and other go-live migrations.

**Purpose:** After testing, wipe QA data and start fresh for real customers without manual SQL. Admin shows **Test mode** until the owner runs **Go live** with step-by-step progress.

## Scope when implemented

### Keep

- `businesses` row (name, branding, logo)
- Admin `auth.users` and `profiles` (`role = admin`)
- Database schema (migrations)

### Remove on Go live

- All orders (cascades: `order_items`, `order_status_events`, `order_modifications`, `delivery_run_orders`)
- `delivery_runs`, `products`, `product_categories`, `product_info_requests`
- `communities`, `customers`, `order_counters`
- Storage folder `product-images/{business_id}/`
- All customer auth users for this shop (`profiles.role = customer` and matching `business_id`)
- Optional: test `api_keys` (checkbox in wizard)

### After wizard (manual)

- Remove Supabase **SMS Test OTP** numbers — see `supabase/documentation/phone-otp.md`
- Re-import products (`ProductImport` on admin Products page) and re-add communities
- Test phones: clear app storage or reinstall APK

### Fallback

- SQL script [`supabase/scripts/go-live-reset.sql`](../supabase/scripts/go-live-reset.sql) and [docs/go-live-checklist.md](go-live-checklist.md) (simple go-live path; wizard still optional)

## Technical design (summary)

1. **Migration:** `businesses.operational_mode` — `'test' | 'live'`, default `'test'` for new QA; `go_live_at` optional timestamp.
2. **RPC:** `admin_go_live_wipe_data(business_id)` — security definer, admin-only, only when `operational_mode = 'test'`, FK-safe deletes in one transaction, returns counts.
3. **RPC:** `admin_go_live_finalize(business_id)` — set `operational_mode = 'live'` after storage + auth steps succeed.
4. **Admin server:** `SUPABASE_SERVICE_ROLE_KEY` (server-only) for `auth.admin.deleteUser` and bulk storage delete — never expose to the client.
5. **UI:** Test mode banner in `AdminShell`; **Settings → Go live** with confirmation + progress steps: DB wipe → storage → auth users → finalize.
6. **Nav:** Expose Settings or a **Go live** link (today settings items are hidden behind `SHOW_LATER_PHASE_MENUS` in `AdminShell.tsx`).

## Wizard progress steps

| Step | User-facing label | Backend |
|------|-------------------|---------|
| `db` | Removing orders and shop data… | RPC wipe |
| `storage` | Clearing product images… | Service role storage API |
| `auth` | Removing customer app accounts… | Delete customer auth users |
| `finalize` | Switching to live mode… | RPC finalize + revalidate admin paths |

## Out of scope for v1

- Automating Twilio / Auth dashboard settings
- Mobile app blocking orders in test mode (admin-only indicator is enough unless added later)
- Reverting live → test

## Related docs

- Tracking entry: `docs/pending-and-future-scope.md` → Phase 2 → Admin Test mode and Go live wizard
- Detailed Cursor plan (if present): `.cursor/plans/go-live_test_data_cleanup_2cab9149.plan.md`
