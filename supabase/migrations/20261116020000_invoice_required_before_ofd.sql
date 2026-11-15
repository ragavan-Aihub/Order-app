-- Invoice must be saved before Out for delivery. Same billed qty still counts as prepared.

alter table public.orders
  add column if not exists invoice_prepared_at timestamptz;

comment on column public.orders.invoice_prepared_at is
  'Set when the shop saves the invoice (including billed qty matching the order). Required before out_for_delivery.';

update public.orders o
set invoice_prepared_at = m.prepared_at
from (
  select distinct on (order_id)
    order_id,
    created_at as prepared_at
  from public.order_modifications
  where actor_type = 'admin'
    and coalesce(reason, '') is distinct from 'reverted_to_placed'
  order by order_id, created_at desc
) m
where o.id = m.order_id
  and o.invoice_prepared_at is null;

update public.orders
set invoice_prepared_at = coalesce(updated_at, created_at)
where status in ('out_for_delivery', 'delivered')
  and invoice_prepared_at is null;

create or replace function public.order_invoice_is_prepared(p_order_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select invoice_prepared_at is not null
  from public.orders
  where id = p_order_id;
$$;

create or replace function public.orders_require_invoice_before_ofd()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('out_for_delivery', 'delivered')
    and old.status is distinct from new.status
    and old.status not in ('out_for_delivery', 'delivered')
    and new.invoice_prepared_at is null
  then
    raise exception 'Prepare and save the invoice before sending this order out.';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_require_invoice_before_ofd on public.orders;
create trigger orders_require_invoice_before_ofd
before update of status on public.orders
for each row
execute function public.orders_require_invoice_before_ofd();

create or replace function public.admin_mark_invoice_prepared(
  p_order_id uuid,
  p_expected_items_revision integer default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'You are not signed in as an admin.';
  end if;

  select *
    into rec
  from public.orders
  where id = p_order_id
    and business_id = public.current_admin_business_id()
    and status in ('new', 'confirmed', 'out_for_delivery')
  for update;

  if rec.id is null then
    raise exception 'This order cannot be changed.';
  end if;

  if p_expected_items_revision is not null and rec.items_revision is distinct from p_expected_items_revision then
    raise exception 'ORDER_STALE';
  end if;

  update public.orders
  set invoice_prepared_at = now()
  where id = rec.id
  returning * into rec;

  return rec;
end;
$$;

revoke all on function public.admin_mark_invoice_prepared(uuid, integer) from public, anon;
grant execute on function public.admin_mark_invoice_prepared(uuid, integer) to authenticated;

create or replace function public.order_modifications_touch_invoice_prepared()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.actor_type is distinct from 'admin' then
    return new;
  end if;
  if new.reason is not distinct from 'reverted_to_placed' then
    update public.orders set invoice_prepared_at = null where id = new.order_id;
  else
    update public.orders set invoice_prepared_at = now() where id = new.order_id;
  end if;
  return new;
end;
$$;

drop trigger if exists order_modifications_touch_invoice_prepared on public.order_modifications;
create trigger order_modifications_touch_invoice_prepared
after insert on public.order_modifications
for each row
execute function public.order_modifications_touch_invoice_prepared();

notify pgrst, 'reload schema';
