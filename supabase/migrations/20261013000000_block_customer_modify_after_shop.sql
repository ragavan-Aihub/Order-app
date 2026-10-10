-- Block customer item edits after the shop (admin) changed the order (unless admin reverted).

create or replace function public.order_item_snapshot_qty_maps_differ(a jsonb, b jsonb)
returns boolean
language sql
stable
set search_path = public
as $$
  with a_map as (
    select
      coalesce(nullif(trim(elem->>'product_id'), ''), lower(trim(elem->>'product_name'))) as line_key,
      coalesce((elem->>'quantity')::integer, 0) as quantity
    from jsonb_array_elements(coalesce(a, '[]'::jsonb)) as elem
  ),
  b_map as (
    select
      coalesce(nullif(trim(elem->>'product_id'), ''), lower(trim(elem->>'product_name'))) as line_key,
      coalesce((elem->>'quantity')::integer, 0) as quantity
    from jsonb_array_elements(coalesce(b, '[]'::jsonb)) as elem
  ),
  keys as (
    select line_key from a_map
    union
    select line_key from b_map
  )
  select exists (
    select 1
    from keys k
    left join a_map am on am.line_key = k.line_key
    left join b_map bm on bm.line_key = k.line_key
    where coalesce(am.quantity, 0) is distinct from coalesce(bm.quantity, 0)
  );
$$;

create or replace function public.order_shop_modified_blocks_customer_edit(p_order_id uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  placed jsonb;
  admin_end jsonb;
  latest_admin_reason text;
begin
  select m.previous_items
    into placed
  from public.order_modifications m
  where m.order_id = p_order_id
  order by m.created_at asc
  limit 1;

  if placed is null or placed = '[]'::jsonb then
    return false;
  end if;

  select m.reason
    into latest_admin_reason
  from public.order_modifications m
  where m.order_id = p_order_id
    and m.actor_type = 'admin'
  order by m.created_at desc
  limit 1;

  if latest_admin_reason is null then
    return false;
  end if;

  if latest_admin_reason = 'reverted_to_placed' then
    return false;
  end if;

  select m.new_items
    into admin_end
  from public.order_modifications m
  where m.order_id = p_order_id
    and m.actor_type = 'admin'
    and coalesce(m.reason, '') <> 'reverted_to_placed'
  order by m.created_at desc
  limit 1;

  if admin_end is null then
    return false;
  end if;

  return public.order_item_snapshot_qty_maps_differ(placed, admin_end);
end;
$$;

create or replace function public.customer_replace_order_items(
  p_order_id uuid,
  p_items jsonb,
  p_customer_name text default null,
  p_mobile text default null,
  p_delivery_address text default null,
  p_pincode text default null,
  p_address_id uuid default null,
  p_expected_items_revision integer default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders;
  item_count integer;
  lines jsonb;
  prev_items jsonb;
  prev_total numeric(10, 2);
  new_total numeric(10, 2);
  new_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to change this order.';
  end if;

  item_count := jsonb_array_length(p_items);
  if item_count < 1 or item_count > 15 then
    raise exception 'You can add up to 15 items in one order.';
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

  if p_expected_items_revision is not null and rec.items_revision is distinct from p_expected_items_revision then
    raise exception 'ORDER_STALE';
  end if;

  if public.order_shop_modified_blocks_customer_edit(p_order_id) then
    raise exception 'The shop updated this order. Contact the shop if you need changes.';
  end if;

  if rec.update_count >= 5 then
    if rec.status = 'new' then
      raise exception 'Modify limit reached for this order. You can still cancel it.';
    end if;
    raise exception 'Modify limit reached for this order.';
  end if;

  if p_address_id is not null and not exists (
    select 1
    from public.customer_addresses a
    where a.id = p_address_id
      and a.user_id = auth.uid()
      and a.business_id = rec.business_id
  ) then
    raise exception 'Choose one of your saved addresses.';
  end if;

  prev_items := public.order_items_snapshot(rec.id);
  prev_total := rec.total_amount;

  lines := public.order_lines_from_request(rec.business_id, rec.id, p_items);
  new_total := public.order_apply_priced_lines(rec.id, lines);
  new_items := public.order_items_snapshot(rec.id);

  update public.orders
  set
    total_amount = new_total,
    customer_name = coalesce(nullif(trim(p_customer_name), ''), customer_name),
    mobile = coalesce(nullif(trim(p_mobile), ''), mobile),
    delivery_address = coalesce(nullif(trim(p_delivery_address), ''), delivery_address),
    pincode = coalesce(nullif(trim(p_pincode), ''), pincode),
    customer_address_id = coalesce(p_address_id, customer_address_id),
    update_count = rec.update_count + 1,
    items_revision = rec.items_revision + 1
  where id = rec.id
  returning * into rec;

  insert into public.order_modifications (
    order_id,
    business_id,
    actor_type,
    actor_id,
    reason,
    previous_items,
    new_items,
    previous_total,
    new_total,
    payment_method
  )
  values (
    rec.id,
    rec.business_id,
    'customer',
    auth.uid(),
    null,
    prev_items,
    new_items,
    prev_total,
    new_total,
    rec.payment_method
  );

  return rec;
end;
$$;

revoke all on function public.customer_replace_order_items(uuid, jsonb, text, text, text, text, uuid, integer) from public, anon;
grant execute on function public.customer_replace_order_items(uuid, jsonb, text, text, text, text, uuid, integer) to authenticated;
