-- Packed: after invoice + shop packing, customer may place a new order; delivery sees packed orders.

do $$
declare
  constraint_name name;
begin
  alter table public.orders drop constraint if exists orders_status_check;
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'orders'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ~* 'status'
      and pg_get_constraintdef(con.oid) ~* 'new'
  loop
    execute format('alter table public.orders drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.orders
  add constraint orders_status_check check (
    status in (
      'new',
      'confirmed',
      'packed',
      'out_for_delivery',
      'delivered',
      'cancelled'
    )
  );

drop index if exists public.orders_one_open_per_address;
create unique index orders_one_open_per_address
  on public.orders (user_id, business_id, customer_address_id)
  where status in ('new', 'confirmed')
    and customer_address_id is not null;

drop index if exists public.orders_user_undelivered_address_idx;
create index orders_user_undelivered_address_idx
  on public.orders (user_id, business_id, customer_address_id, created_at desc)
  where status in ('new', 'confirmed', 'packed', 'out_for_delivery');

create or replace function public.find_open_customer_order(
  p_business_id uuid,
  p_address_id uuid default null,
  p_pincode text default null,
  p_address text default null
)
returns public.orders
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec public.orders;
  normalized text;
begin
  if auth.uid() is null then
    return null;
  end if;

  if p_address_id is not null then
    select *
      into rec
    from public.orders
    where user_id = auth.uid()
      and business_id = p_business_id
      and customer_address_id = p_address_id
      and status in ('new', 'confirmed')
    order by created_at desc
    limit 1;
    if found then
      return rec;
    end if;
  end if;

  normalized := lower(regexp_replace(coalesce(p_address, ''), '\s+', ' ', 'g'));
  if coalesce(trim(p_pincode), '') <> '' then
    select *
      into rec
    from public.orders
    where user_id = auth.uid()
      and business_id = p_business_id
      and status in ('new', 'confirmed')
      and pincode = trim(p_pincode)
      and (
        normalized = ''
        or lower(regexp_replace(delivery_address, '\s+', ' ', 'g')) = normalized
      )
    order by created_at desc
    limit 1;
    if found then
      return rec;
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.orders_require_invoice_before_ofd()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('packed', 'out_for_delivery', 'delivered')
    and old.status is distinct from new.status
    and old.status not in ('packed', 'out_for_delivery', 'delivered')
    and new.invoice_prepared_at is null
  then
    raise exception 'Prepare and save the invoice before marking this order packed.';
  end if;
  return new;
end;
$$;

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

  update public.orders
  set invoice_prepared_at = now()
  where id = rec.id
  returning * into rec;

  return rec;
end;
$$;

create or replace function public.inbox_on_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
  v_label text;
begin
  if new.user_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  if new.status not in ('confirmed', 'packed', 'out_for_delivery', 'delivered') then
    return new;
  end if;
  if exists (
    select 1
    from public.customer_inbox i
    where i.user_id = new.user_id
      and i.category = 'orders'
      and i.data->>'order_id' = new.id::text
      and i.data->>'status' = new.status
  ) then
    return new;
  end if;

  v_label := case when new.order_number is not null then 'Order #' || new.order_number::text else 'Your order' end;
  if new.status = 'confirmed' then
    v_title := 'Order confirmed';
    v_body := v_label || ' is confirmed. The shop is preparing it.';
  elsif new.status = 'packed' then
    v_title := 'Order packed';
    v_body := v_label || ' is packed and will go out for delivery soon.';
  elsif new.status = 'out_for_delivery' then
    v_title := 'Out for delivery';
    v_body := v_label || ' is on its way to you.';
  else
    v_title := 'Delivered';
    v_body := v_label || ' has been delivered. Thank you!';
  end if;

  insert into public.customer_inbox (
    business_id, user_id, category, title, body, data, source, read_at
  ) values (
    new.business_id,
    new.user_id,
    'orders',
    v_title,
    v_body,
    jsonb_build_object('order_id', new.id::text, 'status', new.status),
    'auto',
    now()
  );
  perform public.trim_customer_inbox(new.user_id);
  return new;
end;
$$;

-- Invoice edits only while confirmed (before packed).
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
  new_total := public.order_apply_priced_lines(rec.id, lines);
  new_items := public.order_items_snapshot(rec.id);

  update public.orders
  set
    total_amount = new_total,
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
  target_total numeric(10, 2);
  prev_items jsonb;
  prev_total numeric(10, 2);
  new_total numeric(10, 2);
  new_items jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'You are not signed in as an admin.';
  end if;

  select m.previous_items, m.previous_total
    into target_items, target_total
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
  new_total := public.order_apply_priced_lines(rec.id, target_items);
  new_items := public.order_items_snapshot(rec.id);

  update public.orders
  set
    total_amount = new_total,
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

notify pgrst, 'reload schema';