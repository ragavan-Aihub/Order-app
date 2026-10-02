drop function if exists public.customer_replace_order_items(uuid, jsonb);

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
    and status in ('new', 'confirmed', 'preparing')
  for update;

  if rec.id is null then
    raise exception 'This order cannot be changed.';
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
    customer_address_id = coalesce(p_address_id, customer_address_id)
  where id = rec.id
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.customer_replace_order_items(uuid, jsonb, text, text, text, text, uuid) to authenticated;
