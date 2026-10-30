# Create the first admin account

The business owner does not get access to Supabase, API keys, or this repository. The developer creates the admin user, then shares only the email and password for the Admin Web Panel.

## 1. Apply the migration

Run `supabase/migrations/20260903000000_init.sql` in the Supabase SQL editor.

For the customer contact book (saved addresses in Admin → Customers), also run `supabase/migrations/20260915000000_customer_addresses.sql`.

For payment tracking (Pending / Cash / UPI, separate from order status), run `supabase/migrations/20260921000000_order_payment_method.sql`.

For order status workflow (cancel reason), run `supabase/migrations/20260921010000_order_status_workflow.sql`.

For the order timeline on the admin order page, also run `supabase/migrations/20260921020000_order_status_events.sql`.

For refund tracking on paid cancelled orders, run `supabase/migrations/20260921030000_order_refund_status.sql`.

For admin-created customers (WhatsApp / walk-in) and placing orders from the admin panel, run `supabase/migrations/20260922000000_admin_customers.sql`.

## 2. Create the business

```sql
insert into public.businesses (business_name, phone, email, address, description)
values (
  'Farm2Flavour',
  null,
  null,
  null,
  null
)
returning id;
```

Copy the returned `id`. Put the same value in the mobile app as `EXPO_PUBLIC_BUSINESS_ID`.

## 3. Create the Auth user

In the Supabase dashboard: Authentication → Users → Add user.

- Email: the owner's login email
- Password: a temporary password you will share privately
- Auto-confirm the email so they can log in immediately

Copy the user's UUID.

## 4. Create the admin profile

```sql
insert into public.profiles (id, email, name, role, business_id)
values (
  'AUTH_USER_UUID',
  'owner@example.com',
  'Business Owner',
  'admin',
  'BUSINESS_UUID'
);
```

## 5. Share credentials

Send the email and password to the owner through a private channel. They sign in only at the Admin Web Panel.

Never share the service-role key, database password, or dashboard access.

## 6. Change admin login email

Login uses **Supabase Auth email + password** (same for the **delivery** app). There is no “change email” screen in the admin panel yet — update in Supabase, then keep `profiles` in sync.

### Option A — Dashboard (recommended)

1. Supabase → **Authentication** → **Users** → open the admin user.
2. **Edit** → set the new **Email** → save (auto-confirm if you tick confirm email, or the user confirms via link if your project requires it).
3. Run in the **SQL editor** (replace UUID and email):

```sql
update public.profiles
set email = 'new-owner@example.com'
where id = 'AUTH_USER_UUID' and role = 'admin';
```

4. Sign in on the admin panel and delivery app with the **new email** and the **same password** (unless you also reset password in step 2).

### Option B — New user

If you replace the Auth user (delete old + add new):

1. **Deleting** the old user also **deletes** their `profiles` row (`on delete cascade`).
2. Create the new user in Authentication (auto-confirm email).
3. **Required:** run step **4** again — `insert into public.profiles …` with the **new** user UUID and your existing `business_id`. Template: `supabase/scripts/create-admin-profile.sql`.

Without that insert, login succeeds in Auth but the app shows **This account is not authorized for the admin panel.**

### Change display name only

To change the label in `profiles.name` (not login email):

```sql
update public.profiles
set name = 'Shop manager name'
where id = 'AUTH_USER_UUID' and role = 'admin';
```

### Change password

Authentication → Users → admin user → **Send password recovery** or set a new password in the dashboard. Share the new password privately.

Template script: `supabase/scripts/change-admin-email.sql`.

## Apps

Use only the anon key in:

- `admin/.env` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `mobile/.env` → `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_BUSINESS_ID`

## Customer OTP

Phone login is configured in the dashboard, not in the apps. See `supabase/documentation/phone-otp.md`. Keep the test number; use the Send SMS hook with 2Factor.in for live SMS (not Twilio).
