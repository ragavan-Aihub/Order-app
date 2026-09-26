-- Category images for admin + customer app.

alter table public.product_categories
  add column if not exists image_url text;

drop function if exists public.get_shop_categories(uuid);

create function public.get_shop_categories(p_business_id uuid)
returns table (id uuid, name text, image_url text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.image_url
  from public.product_categories c
  where c.business_id = p_business_id
    and c.active = true
  order by lower(btrim(c.name));
$$;

revoke all on function public.get_shop_categories(uuid) from public;
grant execute on function public.get_shop_categories(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
