-- Order item modifications: audit history, items_revision optimistic locking,
-- admin_replace_order_items, and customer_replace_order_items audit + revision.

alter table public.orders
  add column if not exists items_revision integer not null default 0;

alter table public.orders
  drop constraint if exists orders_items_revision_check;

alter table public.orders
  add constraint orders_items_revision_check check (items_revision >= 0);

create table if not exists public.order_modifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  actor_type text not null check (actor_type in ('customer', 'admin')),
  actor_id uuid,
  reason text,
  previous_items jsonb not null default '[]'::jsonb,
  new_items jsonb not null default '[]'::jsonb,
  previous_total numeric(10, 2) not null default 0,
  new_total numeric(10, 2) not null default 0,
  payment_method text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists order_modifications_order_id_created_at_idx
  on public.order_modifications (order_id, created_at desc);

create index if not exists order_modifications_business_id_created_at_idx
  on public.order_modifications (business_id, created_at desc);

alter table public.order_modifications enable row level security;

create policy order_modifications_customer_select
on public.order_modifications for select
to authenticated
using (
  not public.is_admin()
  and exists (
    select 1
    from public.orders o
    where o.id = order_modifications.order_id
      and o.user_id = auth.uid()
  )
);

create policy order_modifications_admin_select
on public.order_modifications for select
to authenticated
using (business_id = public.current_admin_business_id());

-- Snapshot current order_items as JSON for audit.
create or replace function public.order_items_snapshot(p_order_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', i.product_id,
        'product_name', i.product_name,
        'product_price', i.product_price,
        'quantity', i.quantity,
        'subtotal', i.subtotal
      )
      order by i.created_at, i.id
    ),
    '[]'::jsonb
  )
  from public.order_items i
  where i.order_id = p_order_id;
$$;

-- Price requested lines using live products or prior prices on this order.
create or replace function public.order_lines_from_request(
  p_business_id uuid,
  p_order_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  lines jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Items are required.';
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
    where i.order_id = p_order_id
    order by coalesce(i.product_id::text, i.product_name), i.created_at
  ),
  priced as (
    select
      w.ord,
      w.quantity,
      coalesce(p.id, prev.product_id) as product_id,
      coalesce(p.name, prev.product_name, w.product_name) as product_name,
      coalesce(p.price, prev.product_price) as product_price
    from wanted w
    left join public.products p
      on p.id = w.product_id
      and p.business_id = p_business_id
      and p.available = true
      and p.active = true
    left join lateral (
      select pr.product_id, pr.product_name, pr.product_price
      from previous pr
      where (w.product_id is not null and pr.product_id = w.product_id)
        or (pr.product_id is null and w.product_name is not null and pr.product_name = w.product_name)
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

  if lines is null then
    raise exception 'Add at least one item.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(lines) as line
    where line->>'product_price' is null
      or nullif(trim(line->>'product_name'), '') is null
  ) then
    raise exception 'Some items are no longer available. Refresh and try again.';
  end if;

  return lines;
end;
$$;

create or replace function public.order_apply_priced_lines(p_order_id uuid, p_lines jsonb)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  total numeric(10, 2);
begin
  delete from public.order_items where order_id = p_order_id;

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
    p_order_id,
    nullif(line->>'product_id', '')::uuid,
    line->>'product_name',
    (line->>'product_price')::numeric,
    (line->>'quantity')::integer,
    (line->>'product_price')::numeric * (line->>'quantity')::integer
  from jsonb_array_elements(p_lines) as line;

  perform set_config('app.order_items_priced', 'off', true);

  select coalesce(sum(subtotal), 0) into total from public.order_items where order_id = p_order_id;
  return total;
end;
$$;

create or replace function public.admin_replace_order_items(
  p_order_id uuid,
  p_items jsonb,
  p_reason text default null,
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
    where coalesce((item->>'quantity')::integer, 0) < 1
      or coalesce((item->>'quantity')::integer, 0) > 10
  ) then
    raise exception 'Check item quantities.';
  end if;

  select *
    into rec
  from public.orders
  where id = p_order_id
    and business_id = public.current_admin_business_id()
    and status in ('new', 'confirmed')
  for update;

  if rec.id is null then
    raise exception 'This order cannot be changed.';
  end if;

  if p_expected_items_revision is not null and rec.items_revision is distinct from p_expected_items_revision then
    raise exception 'ORDER_STALE';
  end if;

  prev_items := public.order_items_snapshot(rec.id);
  prev_total := rec.total_amount;

  lines := public.order_lines_from_request(rec.business_id, rec.id, p_items);
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

revoke all on function public.admin_replace_order_items(uuid, jsonb, text, integer) from public, anon;
grant execute on function public.admin_replace_order_items(uuid, jsonb, text, integer) to authenticated;

drop function if exists public.customer_replace_order_items(uuid, jsonb, text, text, text, text, uuid);

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
