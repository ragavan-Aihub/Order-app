-- Security hardening for the customer app (anon key + customer session):
-- 1. Order prices and totals always come from the product list, never from the app.
-- 2. Customers cannot set payment, refund, channel, partner or bookkeeping fields on their orders.
-- 3. Customers can add items only to the order they just placed; later changes go through
--    customer_replace_order_items (modify limit, server-side prices).
-- 4. ensure_customer_profile links the customer record by the verified OTP phone, not by an
--    app-supplied number, and customers can no longer read the shop's customer record (notes).
-- 5. The account phone on profiles stays the verified OTP phone.
-- 6. Customers can only use their own saved addresses and customer record.
-- 7. Parallel cancels cannot beat the 3-per-day limit.
-- 8. Partner API skips inactive products, caps item counts, and finds digest() in Supabase.
-- 9. Internal functions are not callable by anon; image buckets only accept images up to 5 MB.

-- 1–2. Orders written by a signed-in customer for themselves.
create or replace function public.orders_customer_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin writes, partner orders (no session) and security-definer code acting for someone else
  -- are not customer writes.
  if auth.uid() is null or new.user_id is distinct from auth.uid() or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'new';
    new.payment_method := 'pending';
    new.refund_status := null;
    new.channel := 'app';
    new.external_id := null;
    new.cancel_reason := null;
    new.cancelled_by := null;
    new.update_count := 0;
    new.created_at := now();
    new.updated_at := now();
    new.placed_via := case when new.placed_via = 'voice' then 'voice' else 'app' end;
    new.customer_id := (
      select c.id
      from public.customers c
      where c.auth_user_id = auth.uid()
        and c.business_id = new.business_id
    );

    if length(coalesce(new.customer_name, '')) > 120
      or length(coalesce(new.mobile, '')) > 20
      or length(coalesce(new.delivery_address, '')) > 600
      or length(coalesce(new.pincode, '')) > 10 then
      raise exception 'Check the delivery details and try again.';
    end if;
  end if;

  if new.customer_address_id is not null
    and (tg_op = 'INSERT' or new.customer_address_id is distinct from old.customer_address_id)
    and not exists (
      select 1
      from public.customer_addresses a
      where a.id = new.customer_address_id
        and a.user_id = auth.uid()
        and a.business_id = new.business_id
    ) then
    raise exception 'Choose one of your saved addresses.';
  end if;

  return new;
end;
$$;

-- Name sorts before orders_snapshot_community so the community check sees the real customer_id.
drop trigger if exists orders_customer_guard on public.orders;
create trigger orders_customer_guard
before insert or update on public.orders
for each row execute function public.orders_customer_guard();

-- 1. Items a customer inserts directly are re-priced from the product list.
create or replace function public.order_items_customer_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_product public.products;
begin
  if auth.uid() is null
    or public.is_admin()
    or coalesce(current_setting('app.order_items_priced', true), '') = 'on' then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if v_order.id is null or v_order.user_id is distinct from auth.uid() then
    return new;
  end if;

  if new.quantity is null or new.quantity < 1 or new.quantity > 10 then
    raise exception 'Check item quantities.';
  end if;

  select * into v_product
  from public.products
  where id = new.product_id
    and business_id = v_order.business_id
    and available = true
    and active = true;

  if v_product.id is null then
    raise exception 'Some items are no longer available. Refresh and try again.';
  end if;

  new.product_name := v_product.name;
  new.product_price := v_product.price;
  new.subtotal := v_product.price * new.quantity;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists order_items_customer_guard on public.order_items;
create trigger order_items_customer_guard
before insert on public.order_items
for each row execute function public.order_items_customer_guard();

-- 1. After a customer adds items, the order total is the sum of the saved lines.
create or replace function public.order_items_customer_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return null;
  end if;

  update public.orders o
  set total_amount = coalesce((
    select sum(i.subtotal) from public.order_items i where i.order_id = o.id
  ), 0)
  where o.user_id = auth.uid()
    and o.id in (select distinct order_id from inserted_items);

  return null;
end;
$$;

drop trigger if exists order_items_customer_totals on public.order_items;
create trigger order_items_customer_totals
after insert on public.order_items
referencing new table as inserted_items
for each statement execute function public.order_items_customer_totals();

alter table public.order_items
  drop constraint if exists order_items_amounts_check;

alter table public.order_items
  add constraint order_items_amounts_check
  check (product_price >= 0 and subtotal >= 0) not valid;

-- 3. Direct item inserts only for the order just placed (the app inserts items right after the order).
drop policy if exists order_items_customer_insert on public.order_items;
create policy order_items_customer_insert
on public.order_items for insert
to authenticated
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.user_id = auth.uid()
      and o.business_id = public.current_customer_business_id()
      and o.status = 'new'
      and o.update_count = 0
      and o.created_at > now() - interval '15 minutes'
  )
  and not public.is_admin()
);

-- 1, 3, 6. Same as 20261005000000_customer_cancel_rules.sql, but prices come from the product list.
-- A product the shop has stopped selling can stay at the price already on this order.
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
  lines jsonb;
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

  if p_address_id is not null and not exists (
    select 1
    from public.customer_addresses a
    where a.id = p_address_id
      and a.user_id = auth.uid()
      and a.business_id = rec.business_id
  ) then
    raise exception 'Choose one of your saved addresses.';
  end if;

  with wanted as (
    select
      t.ord,
      nullif(t.item->>'product_id', '')::uuid as product_id,
      trim(t.item->>'product_name') as product_name,
      (t.item->>'quantity')::integer as quantity
    from jsonb_array_elements(p_items) with ordinality as t(item, ord)
  ),
  previous as (
    select distinct on (coalesce(i.product_id::text, i.product_name))
      i.product_id,
      i.product_name,
      i.product_price
    from public.order_items i
    where i.order_id = rec.id
    order by coalesce(i.product_id::text, i.product_name), i.created_at
  ),
  priced as (
    select
      w.ord,
      w.quantity,
      coalesce(p.id, prev.product_id) as product_id,
      coalesce(p.name, prev.product_name) as product_name,
      coalesce(p.price, prev.product_price) as product_price
    from wanted w
    left join public.products p
      on p.id = w.product_id
      and p.business_id = rec.business_id
      and p.available = true
      and p.active = true
    left join lateral (
      select pr.product_id, pr.product_name, pr.product_price
      from previous pr
      where (w.product_id is not null and pr.product_id = w.product_id)
        or (pr.product_id is null and pr.product_name = w.product_name)
      order by (pr.product_id is not null) desc
      limit 1
    ) prev on true
  )
  select jsonb_agg(
    jsonb_build_object(
      'product_id', product_id,
      'product_name', product_name,
      'product_price', product_price,
      'quantity', quantity
    )
    order by ord
  )
  into lines
  from priced;

  if exists (
    select 1 from jsonb_array_elements(lines) as line
    where line->>'product_price' is null
  ) then
    raise exception 'Some items are no longer available. Refresh and try again.';
  end if;

  delete from public.order_items where order_id = rec.id;

  perform set_config('app.order_items_priced', 'on', true);

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
    nullif(line->>'product_id', '')::uuid,
    line->>'product_name',
    (line->>'product_price')::numeric,
    (line->>'quantity')::integer,
    (line->>'product_price')::numeric * (line->>'quantity')::integer
  from jsonb_array_elements(lines) as line;

  perform set_config('app.order_items_priced', 'off', true);

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

revoke all on function public.customer_replace_order_items(uuid, jsonb, text, text, text, text, uuid) from public, anon;
grant execute on function public.customer_replace_order_items(uuid, jsonb, text, text, text, text, uuid) to authenticated;

-- 7. Same as 20261005000000_customer_cancel_rules.sql, plus a per-customer lock so parallel
-- cancels are counted one after another.
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

  perform pg_advisory_xact_lock(hashtext('customer_cancel_order'), hashtext(auth.uid()::text));

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

revoke all on function public.customer_cancel_order(uuid, text) from public, anon;
grant execute on function public.customer_cancel_order(uuid, text) to authenticated;

-- 4. Link by the phone verified at OTP sign-in. p_mobile is kept for app compatibility but ignored.
create or replace function public.ensure_customer_profile(
  p_business_id uuid,
  p_name text,
  p_mobile text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_phone text := nullif(regexp_replace(coalesce(auth.jwt()->>'phone', ''), '\D', '', 'g'), '');
  v_mobile text;
  v_business uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_mobile := case when v_phone is null then null else '+' || v_phone end;

  insert into public.profiles (id, email, mobile, name, role, business_id)
  values (auth.uid(), null, v_mobile, v_name, 'customer', p_business_id)
  on conflict (id) do update
    set
      mobile = coalesce(excluded.mobile, public.profiles.mobile),
      name = coalesce(excluded.name, public.profiles.name),
      updated_at = now()
    where public.profiles.role = 'customer';

  select business_id
    into v_business
  from public.profiles
  where id = auth.uid() and role = 'customer';

  if v_business is not null
    and v_mobile is not null
    and length(right(v_phone, 10)) = 10 then
    begin
      insert into public.customers (business_id, name, mobile, source, auth_user_id)
      values (v_business, coalesce(v_name, 'Customer'), v_mobile, 'app', auth.uid())
      on conflict on constraint customers_business_mobile_key do update
        set
          auth_user_id = coalesce(public.customers.auth_user_id, excluded.auth_user_id),
          name = case
            when public.customers.name is null or public.customers.name = 'Customer' then excluded.name
            else public.customers.name
          end,
          updated_at = now()
        where public.customers.auth_user_id is null
          or public.customers.auth_user_id = excluded.auth_user_id;
    exception
      when unique_violation then
        null;
    end;
  end if;
end;
$$;

revoke all on function public.ensure_customer_profile(uuid, text, text) from public, anon;
grant execute on function public.ensure_customer_profile(uuid, text, text) to authenticated;

-- 4. The app never reads customers; this policy exposed the shop's notes about the customer.
drop policy if exists customers_own_select on public.customers;

-- 5. Same as 20260903000000_init.sql, plus: a customer cannot change their own account phone
-- away from the phone they verified at sign-in (delivery phones live on addresses and orders).
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
as $$
declare
  v_phone text;
begin
  if auth.uid() is not null and tg_op = 'UPDATE' and (
    new.role is distinct from old.role
    or new.business_id is distinct from old.business_id
  ) then
    raise exception 'Cannot change role or business assignment';
  end if;

  if auth.uid() is not null
    and tg_op = 'UPDATE'
    and auth.uid() = old.id
    and new.mobile is distinct from old.mobile then
    v_phone := regexp_replace(coalesce(auth.jwt()->>'phone', ''), '\D', '', 'g');
    if length(v_phone) < 10
      or right(regexp_replace(coalesce(new.mobile, ''), '\D', '', 'g'), 10) <> right(v_phone, 10) then
      new.mobile := old.mobile;
    end if;
  end if;

  return new;
end;
$$;

-- 6. Customers can attach addresses only to their own customer record.
create or replace function public.customer_addresses_owner_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.customer_id is not null
    and (tg_op = 'INSERT' or new.customer_id is distinct from old.customer_id)
    and not exists (
      select 1
      from public.customers c
      where c.id = new.customer_id
        and c.auth_user_id = auth.uid()
        and c.business_id = new.business_id
    ) then
    raise exception 'This address cannot be saved.';
  end if;

  return new;
end;
$$;

drop trigger if exists customer_addresses_owner_guard on public.customer_addresses;
create trigger customer_addresses_owner_guard
before insert or update on public.customer_addresses
for each row execute function public.customer_addresses_owner_guard();

-- 8. pgcrypto lives in the extensions schema on Supabase.
alter function public.partner_auth(text, text) set search_path = public, extensions;

-- 8. Same as 20260912000000_order_channels_partner_api.sql, plus: inactive products are rejected,
-- at most 50 lines and 100 per line.
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

  select * into v_order from public.orders where id = v_order.id;
  return public.partner_order_payload(v_order);
end;
$$;

revoke all on function public.partner_place_order(text, text, text, text, text, jsonb, text) from public;
grant execute on function public.partner_place_order(text, text, text, text, text, jsonb, text) to anon, authenticated;

-- 9. Supabase grants EXECUTE to anon by default, so revoking from public alone is not enough.
do $$
declare
  fn text;
begin
  -- Only called from inside the partner_* functions.
  foreach fn in array array[
    'public.partner_auth(text, text)',
    'public.partner_order_payload(public.orders)'
  ]
  loop
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', fn);
    end if;
  end loop;

  -- Admin calls this while signed in.
  if to_regprocedure('public.ensure_order_channels()') is not null then
    revoke all on function public.ensure_order_channels() from public, anon;
  end if;
end
$$;

-- 9. Matches the admin upload checks (JPEG, PNG, GIF, WebP up to 5 MB).
update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
where id in ('product-images', 'business-logos');

notify pgrst, 'reload schema';
