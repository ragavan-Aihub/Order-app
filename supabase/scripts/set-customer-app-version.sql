-- Tell the customer app that a new version is available.
-- 1. Edit v_business_id.
-- 2. Set the numbers to match mobile/app.json for the build you already uploaded.
-- 3. Run in the Supabase SQL editor, then: notify pgrst, 'reload schema';

-- Bug fix (people can tap Later, unless you also raise the minimum):
--   customer_app_release_kind = 'bugfix'
--   customer_app_latest_version = '1.0.1'
--   customer_app_latest_version_code = 24

-- New feature (same, kind = 'feature', version like 1.1.0):

-- Critical fix (old apps cannot continue until they update):
--   also set customer_app_min_version_code to that same versionCode

do $$
declare
  v_business_id uuid := '00000000-0000-0000-0000-000000000000'; -- replace
begin
  update public.businesses
  set
    customer_app_latest_version = '1.0.0',
    customer_app_latest_version_code = 23,
    customer_app_min_version_code = 0,
    customer_app_release_kind = 'none',
    customer_app_release_notes = null,
    customer_app_update_url = null
  where id = v_business_id;

  if not found then
    raise exception 'No business row for % — edit v_business_id', v_business_id;
  end if;
end $$;

notify pgrst, 'reload schema';
