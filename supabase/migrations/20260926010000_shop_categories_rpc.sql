-- Public shop categories for the customer app (only when the business has Categories enabled).

create or replace function public.get_shop_categories(p_business_id uuid)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name
  from public.product_categories c
  inner join public.businesses b on b.id = c.business_id
  where c.business_id = p_business_id
    and c.active = true
    and coalesce(b.categories_enabled, false) = true
  order by lower(btrim(c.name));
$$;

revoke all on function public.get_shop_categories(uuid) from public;
grant execute on function public.get_shop_categories(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
