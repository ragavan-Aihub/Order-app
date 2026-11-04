-- Vertical crop of each poster. 0 shows the top, 50 the middle, 100 the bottom.
-- The customer app uses the same value, so the admin preview matches the phone.

alter table public.shop_banners
  add column if not exists focus_y smallint not null default 50;

alter table public.shop_banners
  drop constraint if exists shop_banners_focus_y_range;

alter table public.shop_banners
  add constraint shop_banners_focus_y_range check (focus_y between 0 and 100);

drop function if exists public.get_shop_banners(uuid);

create function public.get_shop_banners(p_business_id uuid)
returns table (id uuid, image_url text, sort_order integer, focus_y smallint)
language sql
stable
security definer
set search_path = public
as $$
  select banner.id, banner.image_url, banner.sort_order, banner.focus_y
  from public.shop_banners banner
  join public.businesses shop on shop.id = banner.business_id
  where banner.business_id = p_business_id
    and shop.announcement_active
    and nullif(trim(banner.image_url), '') is not null
  order by banner.sort_order, banner.created_at;
$$;

revoke all on function public.get_shop_banners(uuid) from public;
grant execute on function public.get_shop_banners(uuid) to anon, authenticated;
