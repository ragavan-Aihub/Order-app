-- Customer cancel rules:
-- 1. Customers can cancel only while the order is Placed (new). Once confirmed, they can still
--    modify it until it is out for delivery, but must contact the shop to cancel.
-- 2. At most 3 customer cancellations in 24 hours. Admin cancellations do not count.
-- 3. The cancel reason is always set on the server.

alter table public.orders
  add column if not exists cancelled_by text;

alter table public.orders
  drop constraint if exists orders_cancelled_by_check;

alter table public.orders
  add constraint orders_cancelled_by_check check (cancelled_by is null or cancelled_by = 'customer');

-- cancelled_by is only meaningful while the order is cancelled, so a status correction or an
-- admin cancel never keeps a stale customer marker.
create or replace function public.orders_reset_cancelled_by()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from 'cancelled' then
    new.cancelled_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_reset_cancelled_by on public.orders;
create trigger orders_reset_cancelled_by
before insert or update on public.orders
for each row execute function public.orders_reset_cancelled_by();

create or replace function public.customer_cancel_order(p_order_id uuid, p_reason text default null)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders;
  recent integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to cancel this order.';
  end if;

  select *
    into rec
  from public.orders
  where id = p_order_id
    and user_id = auth.uid()
  for update;

  if rec.id is null then
    raise exception 'This order cannot be cancelled.';
  end if;

  if rec.status = 'confirmed' then
    raise exception 'This order is confirmed, so it can no longer be cancelled. You can still modify it until it is out for delivery, or contact the shop.';
  end if;

  if rec.status is distinct from 'new' then
    raise exception 'This order cannot be cancelled.';
  end if;

  select count(*)
    into recent
  from public.order_status_events e
  join public.orders o on o.id = e.order_id
  where o.user_id = auth.uid()
    and o.cancelled_by = 'customer'
    and e.status = 'cancelled'
    and e.created_at > now() - interval '24 hours';

  if recent >= 3 then
    raise exception 'Cancel limit reached for today. Please contact the shop to cancel this order.';
  end if;

  update public.orders
  set
    status = 'cancelled',
    cancel_reason = 'Customer requested',
    cancelled_by = 'customer'
  where id = rec.id
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.customer_cancel_order(uuid, text) to authenticated;

-- Same as 20261004030000_order_update_limit_message.sql; the limit message mentions cancelling
-- only while the order can still be cancelled.
create or replace function public.customer_replace_order_items(
  p_order_id uuid,
  p_items jsonb,
  p_customer_name text default null,
  p_mobile text default null,
  p_delivery_address text default null,
  p_pincode text default null,
  p_address_id uuid default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders;
  item_count integer;
  total numeric(10, 2);
begin
  if auth.uid() is null then
    raise exception 'Sign in to change this order.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Items are required.';
  end if;

  item_count := jsonb_array_length(p_items);
  if item_count < 1 or item_count > 15 then
    raise exception 'You can add up to 15 items in one order.';
  end if;

  select *
    into rec
  from public.orders
  where id = p_order_id
    and user_id = auth.uid()
    and status in ('new', 'confirmed')
  for update;

  if rec.id is null then
    raise exception 'This order cannot be changed.';
  end if;

  if rec.update_count >= 5 then
    if rec.status = 'new' then
      raise exception 'Modify limit reached for this order. You can still cancel it.';
    end if;
    raise exception 'Modify limit reached for this order.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item
    where coalesce((item->>'quantity')::integer, 0) < 1
      or coalesce((item->>'quantity')::integer, 0) > 10
      or nullif(trim(item->>'product_name'), '') is null
  ) then
    raise exception 'Check item names and quantities.';
  end if;

  delete from public.order_items where order_id = rec.id;

  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    product_price,
    quantity,
    subtotal
  )
  select
    rec.id,
    nullif(item->>'product_id', '')::uuid,
    trim(item->>'product_name'),
    greatest(0, coalesce((item->>'product_price')::numeric, 0)),
    (item->>'quantity')::integer,
    greatest(0, coalesce((item->>'product_price')::numeric, 0)) * (item->>'quantity')::integer
  from jsonb_array_elements(p_items) as item;

  select coalesce(sum(subtotal), 0) into total from public.order_items where order_id = rec.id;

  update public.orders
  set
    total_amount = total,
    customer_name = coalesce(nullif(trim(p_customer_name), ''), customer_name),
    mobile = coalesce(nullif(trim(p_mobile), ''), mobile),
    delivery_address = coalesce(nullif(trim(p_delivery_address), ''), delivery_address),
    pincode = coalesce(nullif(trim(p_pincode), ''), pincode),
    customer_address_id = coalesce(p_address_id, customer_address_id),
    update_count = rec.update_count + 1
  where id = rec.id
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.customer_replace_order_items(uuid, jsonb, text, text, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
