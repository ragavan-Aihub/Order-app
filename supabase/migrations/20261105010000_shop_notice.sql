-- Holiday notice and a closed switch on the shop profile.
-- get_business_public returns setof businesses, so these columns are public.

alter table public.businesses
  add column if not exists shop_closed boolean not null default false,
  add column if not exists shop_closed_message text,
  add column if not exists announcement_active boolean not null default false,
  add column if not exists announcement_title text,
  add column if not exists announcement_body text,
  add column if not exists announcement_image_url text;

create or replace function public.enforce_shop_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text;
begin
  if public.is_admin() then
    return new;
  end if;

  select nullif(trim(b.shop_closed_message), '')
  into v_message
  from public.businesses b
  where b.id = new.business_id
    and b.shop_closed;

  if found then
    raise exception '%', coalesce(v_message, 'The shop is closed and is not taking orders right now.');
  end if;

  return new;
end;
$$;

drop trigger if exists orders_block_when_shop_closed on public.orders;
create trigger orders_block_when_shop_closed
before insert on public.orders
for each row
execute function public.enforce_shop_open();
