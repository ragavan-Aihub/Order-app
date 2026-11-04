-- Several home-screen posters per shop. The picture is the notice.
-- Customers read them through get_shop_banners. Admins manage their own rows.

create table if not exists public.shop_banners (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists shop_banners_business_order_idx
  on public.shop_banners (business_id, sort_order, created_at);

insert into public.shop_banners (business_id, image_url, sort_order)
select b.id, b.announcement_image_url, 0
from public.businesses b
where nullif(trim(b.announcement_image_url), '') is not null
  and not exists (
    select 1 from public.shop_banners existing where existing.business_id = b.id
  );

alter table public.shop_banners enable row level security;

drop policy if exists shop_banners_admin_all on public.shop_banners;
create policy shop_banners_admin_all
on public.shop_banners
for all
to authenticated
using (business_id = public.current_admin_business_id() and public.is_admin())
with check (business_id = public.current_admin_business_id() and public.is_admin());

grant select, insert, update, delete on public.shop_banners to authenticated;

create or replace function public.get_shop_banners(p_business_id uuid)
returns table (id uuid, image_url text, sort_order integer)
language sql
stable
security definer
set search_path = public
as $$
  select banner.id, banner.image_url, banner.sort_order
  from public.shop_banners banner
  join public.businesses shop on shop.id = banner.business_id
  where banner.business_id = p_business_id
    and shop.announcement_active
    and nullif(trim(banner.image_url), '') is not null
  order by banner.sort_order, banner.created_at;
$$;

revoke all on function public.get_shop_banners(uuid) from public;
grant execute on function public.get_shop_banners(uuid) to anon, authenticated;
