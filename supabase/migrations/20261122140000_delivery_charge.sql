-- Delivery charge + free delivery threshold (item subtotal >= X, inclusive).

alter table public.businesses
  add column if not exists delivery_charge numeric(12, 2) not null default 0;

alter table public.businesses
  add column if not exists free_delivery_min_order numeric(12, 2) not null default 0;

alter table public.businesses
  drop constraint if exists businesses_delivery_charge_nonneg;

alter table public.businesses
  add constraint businesses_delivery_charge_nonneg check (delivery_charge >= 0);

alter table public.businesses
  drop constraint if exists businesses_free_delivery_min_nonneg;

alter table public.businesses
  add constraint businesses_free_delivery_min_nonneg check (free_delivery_min_order >= 0);

alter table public.orders
  add column if not exists delivery_charge numeric(10, 2) not null default 0;

alter table public.orders
  add column if not exists delivery_charge_listed numeric(10, 2) not null default 0;

alter table public.orders
  drop constraint if exists orders_delivery_charge_nonneg;

alter table public.orders
  add constraint orders_delivery_charge_nonneg check (delivery_charge >= 0);

alter table public.orders
  drop constraint if exists orders_delivery_charge_listed_nonneg;

alter table public.orders
  add constraint orders_delivery_charge_listed_nonneg check (delivery_charge_listed >= 0);

create or replace function public.order_delivery_amount(
  p_business_id uuid,
  p_items_subtotal numeric
)
returns table (
  listed numeric,
  charged numeric
)
language sql
stable
set search_path = public
as $$
  select
    round(greatest(0, coalesce(b.delivery_charge, 0))::numeric, 2),
    round(
      case
        when greatest(0, coalesce(b.delivery_charge, 0)) = 0 then 0::numeric
        when coalesce(b.free_delivery_min_order, 0) > 0
          and coalesce(p_items_subtotal, 0) >= coalesce(b.free_delivery_min_order, 0)
        then 0::numeric
        else greatest(0, coalesce(b.delivery_charge, 0))::numeric
      end,
      2
    )
  from public.businesses b
  where b.id = p_business_id;
$$;

create or replace function public.order_apply_delivery_totals(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders;
  items numeric(10, 2);
  listed numeric(10, 2);
  charged numeric(10, 2);
begin
  select * into rec from public.orders where id = p_order_id;
  if rec.id is null then
    return;
  end if;

  select coalesce(sum(subtotal), 0)::numeric(10, 2)
    into items
  from public.order_items
  where order_id = p_order_id;

  select d.listed, d.charged
    into listed, charged
  from public.order_delivery_amount(rec.business_id, items) d;

  update public.orders
  set
    delivery_charge_listed = coalesce(listed, 0),
    delivery_charge = coalesce(charged, 0),
    total_amount = round(items + coalesce(charged, 0), 2)
  where id = p_order_id;
end;
$$;

create or replace function public.order_items_customer_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  if current_setting('app.order_items_priced', true) = 'on' then
    return null;
  end if;

  for v_order_id in
    select distinct order_id from inserted_items
  loop
    perform public.order_apply_delivery_totals(v_order_id);
  end loop;

  return null;
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
  v_min numeric(12, 2);
  v_bill numeric(10, 2);
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
  perform public.order_apply_priced_lines(rec.id, lines);
  perform public.order_apply_delivery_totals(rec.id);
  new_items := public.order_items_snapshot(rec.id);
  select total_amount into new_total from public.orders where id = rec.id;

  select coalesce(b.min_order_amount, 0)
    into v_min
  from public.businesses b
  where b.id = rec.business_id;

  if v_min > 0 and coalesce(rec.placed_via, 'app') = 'app' then
    v_bill := new_total;
    if v_bill + 1e-9 < v_min then
      raise exception 'Minimum order is not met.';
    end if;
  end if;

  update public.orders
  set
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

-- Admin invoice path: priced lines then delivery totals.
create or replace function public.admin_replace_order_items(
  p_order_id uuid,
  p_items jsonb,
  p_reason text default null,
  p_expected_items_revision integer default null,
  p_relaxed_validation boolean default false
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
  use_relaxed boolean;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'You are not signed in as an admin.';
  end if;

  item_count := jsonb_array_length(p_items);
  if item_count < 1 or item_count > 15 then
    raise exception 'You can add up to 15 items in one order.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item
    left join public.products p
      on p.id = nullif(item->>'product_id', '')::uuid
    where
      case
        when coalesce(p.selling_type, '') in ('kg', 'liter') then
          (item->>'quantity')::numeric is null
          or round((item->>'quantity')::numeric, 2) <> (item->>'quantity')::numeric
          or (item->>'quantity')::numeric < 0.01
          or (item->>'quantity')::numeric > 100
        else
          coalesce((item->>'quantity')::numeric, 0) <> trunc(coalesce((item->>'quantity')::numeric, 0))
          or coalesce((item->>'quantity')::integer, 0) < 1
          or coalesce((item->>'quantity')::integer, 0) > 10
      end
  ) then
    raise exception 'Check item quantities.';
  end if;

  select *
    into rec
  from public.orders
  where id = p_order_id
    and business_id = public.current_admin_business_id()
  for update;

  if rec.id is null then
    raise exception 'This order cannot be changed.';
  end if;

  if rec.status not in ('confirmed') then
    raise exception 'Confirm the order before preparing the invoice.';
  end if;

  if p_expected_items_revision is not null and rec.items_revision is distinct from p_expected_items_revision then
    raise exception 'ORDER_STALE';
  end if;

  use_relaxed := coalesce(p_relaxed_validation, false)
    or exists (
      select 1
      from public.order_modifications m
      where m.order_id = p_order_id
        and m.actor_type = 'admin'
    );

  prev_items := public.order_items_snapshot(rec.id);
  prev_total := rec.total_amount;

  lines := public.order_lines_from_request(rec.business_id, rec.id, p_items, use_relaxed);
  perform public.order_apply_priced_lines(rec.id, lines);
  perform public.order_apply_delivery_totals(rec.id);
  new_items := public.order_items_snapshot(rec.id);
  select total_amount into new_total from public.orders where id = rec.id;

  update public.orders
  set items_revision = rec.items_revision + 1
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
    'admin',
    auth.uid(),
    nullif(trim(p_reason), ''),
    prev_items,
    new_items,
    prev_total,
    new_total,
    rec.payment_method
  );

  return rec;
end;
$$;

create or replace function public.admin_revert_order_to_placed(
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
  target_items jsonb;
  prev_items jsonb;
  prev_total numeric(10, 2);
  new_total numeric(10, 2);
  new_items jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'You are not signed in as an admin.';
  end if;

  select m.previous_items
    into target_items
  from public.order_modifications m
  where m.order_id = p_order_id
    and m.actor_type = 'admin'
  order by m.created_at asc
  limit 1;

  if target_items is null or jsonb_array_length(target_items) < 1 then
    raise exception 'This order has no shop changes to undo.';
  end if;

  select *
    into rec
  from public.orders
  where id = p_order_id
    and business_id = public.current_admin_business_id()
  for update;

  if rec.id is null then
    raise exception 'This order cannot be changed.';
  end if;

  if rec.status not in ('confirmed') then
    raise exception 'Confirm the order before preparing the invoice.';
  end if;

  if p_expected_items_revision is not null and rec.items_revision is distinct from p_expected_items_revision then
    raise exception 'ORDER_STALE';
  end if;

  prev_items := public.order_items_snapshot(rec.id);
  if prev_items = target_items then
    raise exception 'Shop changes are already undone on this order.';
  end if;

  prev_total := rec.total_amount;
  perform public.order_apply_priced_lines(rec.id, target_items);
  perform public.order_apply_delivery_totals(rec.id);
  new_items := public.order_items_snapshot(rec.id);
  select total_amount into new_total from public.orders where id = rec.id;

  update public.orders
  set items_revision = rec.items_revision + 1
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
    'admin',
    auth.uid(),
    'reverted_to_placed',
    prev_items,
    new_items,
    prev_total,
    new_total,
    rec.payment_method
  );

  return rec;
end;
$$;

-- Partner API: apply delivery after lines are inserted.
create or replace function public.partner_place_order(
  p_api_key text,
  p_customer_name text,
  p_mobile text,
  p_address text,
  p_pincode text,
  p_items jsonb,
  p_external_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.api_keys;
  v_order public.orders;
  v_item jsonb;
  v_product public.products;
  v_qty integer;
  v_total numeric(10, 2) := 0;
  v_ext text;
begin
  v_key := public.partner_auth(p_api_key, 'orders.write');
  v_ext := nullif(trim(coalesce(p_external_id, '')), '');

  if v_ext is not null and length(v_ext) > 100 then
    raise exception 'INVALID_EXTERNAL_ID' using errcode = '22023';
  end if;

  if v_ext is not null then
    select * into v_order
    from public.orders
    where business_id = v_key.business_id
      and channel = v_key.channel
      and external_id = v_ext;
    if v_order.id is not null then
      return public.partner_order_payload(v_order);
    end if;
  end if;

  if p_customer_name is null or length(trim(p_customer_name)) < 2 or length(p_customer_name) > 120 then
    raise exception 'INVALID_CUSTOMER' using errcode = '22023';
  end if;
  if p_mobile is null
    or length(regexp_replace(p_mobile, '\D', '', 'g')) < 10
    or length(p_mobile) > 20 then
    raise exception 'INVALID_MOBILE' using errcode = '22023';
  end if;
  if p_address is null or length(trim(p_address)) < 4 or length(p_address) > 600 then
    raise exception 'INVALID_ADDRESS' using errcode = '22023';
  end if;
  if p_pincode is null or length(trim(p_pincode)) < 4 or length(trim(p_pincode)) > 10 then
    raise exception 'INVALID_PINCODE' using errcode = '22023';
  end if;
  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty < 1 or v_qty > 100 then
      raise exception 'INVALID_ITEMS' using errcode = '22023';
    end if;
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and business_id = v_key.business_id
      and available = true
      and active = true;
    if v_product.id is null then
      raise exception 'PRODUCT_UNAVAILABLE' using errcode = 'P0002';
    end if;
    v_total := v_total + (v_product.price * v_qty);
  end loop;

  insert into public.orders (
    business_id,
    user_id,
    customer_name,
    mobile,
    delivery_address,
    pincode,
    total_amount,
    status,
    channel,
    external_id
  ) values (
    v_key.business_id,
    null,
    trim(p_customer_name),
    regexp_replace(p_mobile, '\D', '', 'g'),
    trim(p_address),
    trim(p_pincode),
    v_total,
    'new',
    v_key.channel,
    v_ext
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid;
    insert into public.order_items (
      order_id, product_id, product_name, product_price, quantity, subtotal
    ) values (
      v_order.id,
      v_product.id,
      v_product.name,
      v_product.price,
      v_qty,
      v_product.price * v_qty
    );
  end loop;

  perform public.order_apply_delivery_totals(v_order.id);
  select * into v_order from public.orders where id = v_order.id;
  return public.partner_order_payload(v_order);
end;
$$;

grant execute on function public.order_apply_delivery_totals(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';