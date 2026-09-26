-- Shop should list active categories even if the enable flag is missing on an older client/cache.
-- The app still hides the Categories tab when the business has explicitly turned the feature off.

create or replace function public.get_shop_categories(p_business_id uuid)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name
  from public.product_categories c
  where c.business_id = p_business_id
    and c.active = true
  order by lower(btrim(c.name));
$$;

revoke all on function public.get_shop_categories(uuid) from public;
grant execute on function public.get_shop_categories(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
