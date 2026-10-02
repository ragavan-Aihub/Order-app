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
      'preparing',
      'out_for_delivery',
      'delivered',
      'cancelled'
    )
  );

alter table public.orders
  add column if not exists customer_address_id uuid references public.customer_addresses (id) on delete set null;

create index if not exists orders_customer_address_id_idx
  on public.orders (customer_address_id);

create unique index if not exists orders_one_open_per_address
  on public.orders (user_id, business_id, customer_address_id)
  where status in ('new', 'confirmed', 'preparing')
    and customer_address_id is not null;

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
      and status in ('new', 'confirmed', 'preparing')
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
      and status in ('new', 'confirmed', 'preparing')
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

create or replace function public.customer_cancel_order(p_order_id uuid, p_reason text default null)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.orders;
begin
  if auth.uid() is null then
    raise exception 'Sign in to cancel this order.';
  end if;

  update public.orders
  set
    status = 'cancelled',
    cancel_reason = coalesce(nullif(trim(p_reason), ''), 'Customer requested')
  where id = p_order_id
    and user_id = auth.uid()
    and status in ('new', 'confirmed', 'preparing')
  returning * into rec;

  if rec.id is null then
    raise exception 'This order cannot be cancelled.';
  end if;

  return rec;
end;
$$;

create or replace function public.customer_replace_order_items(p_order_id uuid, p_items jsonb)
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
  set total_amount = total
  where id = rec.id
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.find_open_customer_order(uuid, uuid, text, text) to authenticated;
grant execute on function public.customer_cancel_order(uuid, text) to authenticated;
grant execute on function public.customer_replace_order_items(uuid, jsonb) to authenticated;
