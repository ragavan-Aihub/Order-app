-- Customer app version policy (bug fix vs new feature).
-- Safe to run more than once. The customer app reads these columns via get_business_public.
-- Leave the numbers at 0 until a Play or APK release should ask people to update.

alter table public.businesses
  add column if not exists customer_app_min_version_code integer not null default 0,
  add column if not exists customer_app_latest_version_code integer not null default 0,
  add column if not exists customer_app_latest_version text,
  add column if not exists customer_app_release_kind text not null default 'none',
  add column if not exists customer_app_release_notes text,
  add column if not exists customer_app_update_url text;

alter table public.businesses
  drop constraint if exists businesses_customer_app_release_kind_check;

alter table public.businesses
  add constraint businesses_customer_app_release_kind_check
  check (customer_app_release_kind in ('none', 'bugfix', 'feature'));

comment on column public.businesses.customer_app_min_version_code is
  'Android versionCode. Installed builds below this must update (critical fix). 0 = off.';
comment on column public.businesses.customer_app_latest_version_code is
  'Android versionCode of the newest customer build. Higher than the phone shows an optional update. 0 = off.';
comment on column public.businesses.customer_app_release_kind is
  'none = no special wording; bugfix = fix release; feature = new capability.';

notify pgrst, 'reload schema';
