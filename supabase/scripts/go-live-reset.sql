-- Wipe QA / practice data for ONE business before real go-live.
-- Run in Supabase SQL editor. Edit v_business_id below.
--
-- KEEPS: businesses row (name, branding, logo, banner, upi_qr_url), admin auth user(s),
--        admin profiles, schema/migrations, api_keys (optional delete at bottom).
--
-- AFTER THIS SCRIPT (manual — see docs/go-live-checklist.md):
--   1. Storage: delete objects under product-images/{business_id}/ when re-importing images.
--   2. Auth: delete customer test users (Authentication → Users). Keep admin email accounts.
--   3. Remove Supabase SMS test OTP pairs; configure 2Factor.in Send SMS hook when ready.
--   4. Re-import products (admin CSV) and re-create communities if used.
--   5. Test phones: clear app storage or reinstall APK.

do $$
declare
  v_business_id uuid := '00000000-0000-4000-8000-000000000001'; -- EXPO_PUBLIC_BUSINESS_ID
begin
  delete from public.delivery_run_orders
  where run_id in (select id from public.delivery_runs where business_id = v_business_id);

  delete from public.delivery_runs where business_id = v_business_id;

  delete from public.orders where business_id = v_business_id;

  delete from public.product_notify_interests where business_id = v_business_id;

  delete from public.product_info_requests where business_id = v_business_id;

  delete from public.customer_addresses where business_id = v_business_id;

  delete from public.customers where business_id = v_business_id;

  delete from public.products where business_id = v_business_id;

  delete from public.product_categories where business_id = v_business_id;

  delete from public.communities where business_id = v_business_id;

  delete from public.profiles
  where business_id = v_business_id
    and role = 'customer';

  insert into public.order_counters (business_id, last_number)
  values (v_business_id, 100000)
  on conflict (business_id) do update set last_number = 100000;
end $$;

-- Optional: delete partner test keys
-- delete from public.api_keys where business_id = '00000000-0000-4000-8000-000000000001';
