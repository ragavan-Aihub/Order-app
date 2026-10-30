-- If you DELETED the old Auth user and created a NEW one, do NOT use this file alone —
-- use supabase/scripts/create-admin-profile.sql to insert a new admin profiles row.
--
-- After changing the admin email in Supabase Dashboard → Authentication → Users (same UUID),
-- run this so public.profiles.email matches (admin panel + delivery app login are unchanged otherwise).
--
-- Replace:
--   AUTH_USER_UUID  — admin user's id (same as auth.users.id)
--   new-email       — must match what you set in Authentication

-- update public.profiles
-- set email = 'new-email@example.com'
-- where id = 'AUTH_USER_UUID'::uuid and role = 'admin';

-- Optional: display name only (does not change login)
-- update public.profiles
-- set name = 'Display name'
-- where id = 'AUTH_USER_UUID'::uuid and role = 'admin';
