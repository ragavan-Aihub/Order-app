-- Home banner on the existing businesses table (no new tables).
-- Safe to run more than once. get_business_public already returns setof businesses.

alter table public.businesses
  add column if not exists banner_url text;

notify pgrst, 'reload schema';
