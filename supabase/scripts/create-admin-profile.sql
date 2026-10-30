-- Run in Supabase SQL editor after Authentication → Users → Add user.
-- Without this row, admin + delivery login show: "This account is not authorized for the admin panel."
--
-- 1. Copy the new user's UUID from Authentication → Users.
-- 2. Copy your business id (same as EXPO_PUBLIC_BUSINESS_ID in mobile/.env), e.g.:
--      select id, business_name from public.businesses;
-- 3. Uncomment and fill in below, then Run.

-- insert into public.profiles (id, email, name, role, business_id)
-- values (
--   'PASTE_NEW_AUTH_USER_UUID'::uuid,
--   'owner@example.com',
--   'Farm2Flavours Admin',
--   'admin',
--   'PASTE_BUSINESS_UUID'::uuid
-- );

-- Verify:
-- select id, email, name, role, business_id from public.profiles where role = 'admin';
