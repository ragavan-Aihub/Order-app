# Create the first admin account

The business owner does not get access to Supabase, API keys, or this repository. The developer creates the admin user, then shares only the email and password for the Admin Web Panel.

## 1. Apply the migration

Run `supabase/migrations/20260903000000_init.sql` in the Supabase SQL editor.

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

## Apps

Use only the anon key in:

- `admin/.env` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `mobile/.env` → `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_BUSINESS_ID`
