-- One order pipeline for app, partner API, WhatsApp, and later channels.
-- Partner REST uses these security-definer functions with a hashed API key (no service_role in apps).

create table public.order_channels (
  id text primary key,
  label text not null
);

insert into public.order_channels (id, label) values
  ('app', 'App'),
  ('api', 'Partner API'),
  ('whatsapp', 'WhatsApp')
on conflict (id) do nothing;

alter table public.orders
  alter column user_id drop not null;

alter table public.orders
  add column if not exists channel text not null default 'app';

alter table public.orders
  add column if not exists external_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_channel_fkey'
  ) then
    alter table public.orders
      add constraint orders_channel_fkey
      foreign key (channel) references public.order_channels (id);
  end if;
end
$$;

update public.orders
set channel = 'app'
where channel is null or channel = '';

create unique index if not exists orders_business_channel_external_id_idx
  on public.orders (business_id, channel, external_id)
  where external_id is not null;

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  key_prefix text not null unique,
  key_hash text not null unique,
  channel text not null default 'api' references public.order_channels (id),
  scopes text[] not null default array['catalog.read', 'orders.read', 'orders.write']::text[],
  active boolean not null default true,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint api_keys_channel_not_app check (channel <> 'app')
);

create index api_keys_business_id_idx on public.api_keys (business_id);

alter table public.api_keys enable row level security;
alter table public.order_channels enable row level security;

create policy order_channels_read
on public.order_channels for select
to authenticated
using (true);

create policy api_keys_admin_select
on public.api_keys for select
to authenticated
using (business_id = public.current_admin_business_id());

create policy api_keys_admin_insert
on public.api_keys for insert
to authenticated
with check (
  business_id = public.current_admin_business_id()
  and public.is_admin()
);

create policy api_keys_admin_update
on public.api_keys for update
to authenticated
using (business_id = public.current_admin_business_id())
with check (business_id = public.current_admin_business_id());

grant select on public.order_channels to authenticated, anon;
grant select, insert, update on public.api_keys to authenticated;

create or replace function public.partner_auth(p_api_key text, p_scope text)
returns public.api_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.api_keys;
  v_hash text;
begin
  if p_api_key is null or length(trim(p_api_key)) < 20 then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  v_hash := encode(digest(trim(p_api_key), 'sha256'), 'hex');

  select *
  into v_key
  from public.api_keys
  where key_hash = v_hash
    and active = true
    and revoked_at is null;

  if v_key.id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  if not (p_scope = any (v_key.scopes)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.api_keys
  set last_used_at = now()
  where id = v_key.id;

  return v_key;
end;
$$;

create or replace function public.partner_shop(p_api_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.api_keys;
  v_row public.businesses;
begin
  v_key := public.partner_auth(p_api_key, 'catalog.read');
  select * into v_row from public.businesses where id = v_key.business_id;
  if v_row.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'id', v_row.id,
    'name', v_row.business_name,
    'phone', v_row.phone,
    'email', v_row.email,
    'address', v_row.address,
    'description', v_row.description,
    'logo_url', v_row.logo_url,
    'banner_url', v_row.banner_url
  );
end;
$$;

create or replace function public.partner_products(p_api_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.api_keys;
begin
  v_key := public.partner_auth(p_api_key, 'catalog.read');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'description', p.description,
      'price', p.price,
      'image_url', p.image_url
    ) order by p.name)
    from public.products p
    where p.business_id = v_key.business_id and p.available = true
  ), '[]'::jsonb);
end;
$$;

create or replace function public.partner_product(p_api_key text, p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.api_keys;
  v_row public.products;
begin
  v_key := public.partner_auth(p_api_key, 'catalog.read');
  select * into v_row
  from public.products
  where id = p_product_id and business_id = v_key.business_id and available = true;
  if v_row.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'description', v_row.description,
    'price', v_row.price,
    'image_url', v_row.image_url
  );
end;
$$;

create or replace function public.partner_order_payload(p_order public.orders)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_order.id,
    'order_number', p_order.order_number,
    'channel', p_order.channel,
    'status', p_order.status,
    'external_id', p_order.external_id,
    'customer', jsonb_build_object(
      'name', p_order.customer_name,
      'mobile', p_order.mobile,
      'address', p_order.delivery_address,
      'pincode', p_order.pincode
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', i.product_id,
        'name', i.product_name,
        'price', i.product_price,
        'quantity', i.quantity,
        'subtotal', i.subtotal
      ) order by i.created_at)
      from public.order_items i
      where i.order_id = p_order.id
    ), '[]'::jsonb),
    'total_amount', p_order.total_amount,
    'created_at', p_order.created_at
  );
$$;

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

  if p_customer_name is null or length(trim(p_customer_name)) < 2 then
    raise exception 'INVALID_CUSTOMER' using errcode = '22023';
  end if;
  if p_mobile is null or length(regexp_replace(p_mobile, '\D', '', 'g')) < 10 then
    raise exception 'INVALID_MOBILE' using errcode = '22023';
  end if;
  if p_address is null or length(trim(p_address)) < 4 then
    raise exception 'INVALID_ADDRESS' using errcode = '22023';
  end if;
  if p_pincode is null or length(trim(p_pincode)) < 4 then
    raise exception 'INVALID_PINCODE' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty < 1 then
      raise exception 'INVALID_ITEMS' using errcode = '22023';
    end if;
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and business_id = v_key.business_id
      and available = true;
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

create or replace function public.partner_get_order(p_api_key text, p_order_ref text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.api_keys;
  v_order public.orders;
begin
  v_key := public.partner_auth(p_api_key, 'orders.read');
  select * into v_order
  from public.orders
  where business_id = v_key.business_id
    and (
      id::text = p_order_ref
      or order_number::text = p_order_ref
      or (external_id is not null and external_id = p_order_ref)
    )
  order by created_at desc
  limit 1;
  if v_order.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  return public.partner_order_payload(v_order);
end;
$$;

create or replace function public.partner_list_orders(p_api_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.api_keys;
begin
  v_key := public.partner_auth(p_api_key, 'orders.read');
  return coalesce((
    select jsonb_agg(public.partner_order_payload(o) order by o.created_at desc)
    from (
      select * from public.orders
      where business_id = v_key.business_id
      order by created_at desc
      limit 50
    ) o
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.partner_auth(text, text) from public;
revoke all on function public.partner_shop(text) from public;
revoke all on function public.partner_products(text) from public;
revoke all on function public.partner_product(text, uuid) from public;
revoke all on function public.partner_order_payload(public.orders) from public;
revoke all on function public.partner_place_order(text, text, text, text, text, jsonb, text) from public;
revoke all on function public.partner_get_order(text, text) from public;
revoke all on function public.partner_list_orders(text) from public;

grant execute on function public.partner_shop(text) to anon, authenticated;
grant execute on function public.partner_products(text) to anon, authenticated;
grant execute on function public.partner_product(text, uuid) to anon, authenticated;
grant execute on function public.partner_place_order(text, text, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.partner_get_order(text, text) to anon, authenticated;
grant execute on function public.partner_list_orders(text) to anon, authenticated;

notify pgrst, 'reload schema';
