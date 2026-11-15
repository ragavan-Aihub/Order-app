-- Admin kg/liter lines may use quantity with 2 decimal places (e.g. 0.90 kg).
-- Packs and piece products stay whole numbers 1–10. Customer RPCs stay integer.

alter table public.order_items
  drop constraint if exists order_items_quantity_check;

alter table public.order_items
  alter column quantity type numeric(10, 2) using quantity::numeric(10, 2);

alter table public.order_items
  add constraint order_items_quantity_check check (quantity > 0);

drop function if exists public.order_line_stock_units(uuid, integer, integer, integer);

create function public.order_line_stock_units(
  p_product_id uuid,
  p_quantity numeric,
  p_weight_grams integer,
  p_volume_ml integer
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text;
  v_qty numeric;
begin
  v_qty := greatest(coalesce(p_quantity, 0), 0);
  if p_product_id is null or v_qty = 0 then
    return 0;
  end if;

  select selling_type into v_type from public.products where id = p_product_id;
  if v_type = 'kg' then
    return round(v_qty * greatest(coalesce(p_weight_grams, 0), 0));
  end if;
  if v_type = 'liter' then
    return round(v_qty * greatest(coalesce(p_volume_ml, 0), 0));
  end if;
  return trunc(v_qty);
end;
$$;

revoke all on function public.order_line_stock_units(uuid, numeric, integer, integer) from public, anon;
grant execute on function public.order_line_stock_units(uuid, numeric, integer, integer) to authenticated;

create or replace function public.apply_order_item_selling_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_product public.products;
  v_pack public.product_pack_options;
  v_type text;
  v_per_kg numeric(10, 2);
  v_per_l numeric(10, 2);
  v_admin boolean;
begin
  if coalesce(current_setting('app.order_items_priced', true), '') = 'on' then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if v_order.id is null then
    return new;
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

  v_type := coalesce(v_product.selling_type, 'quantity');
  v_admin := public.is_admin();
  new.product_name := v_product.name;
  new.selling_type := v_type;
  new.created_at := coalesce(new.created_at, now());

  if v_type = 'kg' then
    new.quantity := round(new.quantity::numeric, 2);
    if v_admin then
      if new.quantity is null or new.quantity < 0.01 or new.quantity > 100 then
        raise exception 'Check item quantities.';
      end if;
    elsif new.quantity is null or new.quantity <> trunc(new.quantity) or new.quantity < 1 or new.quantity > 10 then
      raise exception 'Check item quantities.';
    end if;
    if new.weight_grams is null or not exists (
      select 1 from public.product_weight_options o
      where o.product_id = v_product.id
        and o.weight_grams = new.weight_grams
        and o.is_active = true
    ) then
      raise exception 'Choose a weight option.';
    end if;
    v_per_kg := coalesce(v_product.price_per_kg, v_product.price);
    new.product_price := v_per_kg;
    new.selling_unit := 'Kg';
    new.pack_option_id := null;
    new.pack_weight_grams := null;
    new.volume_ml := null;
    new.subtotal := round(v_per_kg * (new.weight_grams::numeric / 1000) * new.quantity, 2);
    return new;
  end if;

  if v_type = 'liter' then
    new.quantity := round(new.quantity::numeric, 2);
    if v_admin then
      if new.quantity is null or new.quantity < 0.01 or new.quantity > 100 then
        raise exception 'Check item quantities.';
      end if;
    elsif new.quantity is null or new.quantity <> trunc(new.quantity) or new.quantity < 1 or new.quantity > 10 then
      raise exception 'Check item quantities.';
    end if;
    if new.volume_ml is null or not exists (
      select 1 from public.product_volume_options o
      where o.product_id = v_product.id
        and o.volume_ml = new.volume_ml
        and o.is_active = true
    ) then
      raise exception 'Choose a volume option.';
    end if;
    v_per_l := coalesce(v_product.price_per_liter, v_product.price);
    new.product_price := v_per_l;
    new.selling_unit := 'L';
    new.pack_option_id := null;
    new.pack_weight_grams := null;
    new.weight_grams := null;
    new.subtotal := round(v_per_l * (new.volume_ml::numeric / 1000) * new.quantity, 2);
    return new;
  end if;

  if v_type = 'fixed_pack' then
    if new.quantity is null or new.quantity <> trunc(new.quantity) or new.quantity < 1 or new.quantity > 10 then
      raise exception 'Check item quantities.';
    end if;
    select * into v_pack
    from public.product_pack_options
    where id = new.pack_option_id
      and product_id = v_product.id
      and is_active = true;
    if v_pack.id is null then
      raise exception 'Choose a pack size.';
    end if;
    new.product_price := v_pack.selling_price;
    new.selling_unit := 'pack';
    new.pack_weight_grams := v_pack.weight_grams;
    new.weight_grams := null;
    new.volume_ml := null;
    new.subtotal := round(v_pack.selling_price * new.quantity, 2);
    return new;
  end if;

  if new.quantity is null or new.quantity <> trunc(new.quantity) or new.quantity < 1 or new.quantity > 10 then
    raise exception 'Check item quantities.';
  end if;
  new.product_price := v_product.price;
  new.selling_unit := null;
  new.pack_option_id := null;
  new.pack_weight_grams := null;
  new.weight_grams := null;
  new.volume_ml := null;
  new.subtotal := round(v_product.price * new.quantity, 2);
  return new;
end;
$$;

create or replace function public.order_lines_from_request(
  p_business_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_relaxed boolean default false
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
      round((t.item->>'quantity')::numeric, 2) as quantity
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
  first_placed as (
    select m.previous_items
    from public.order_modifications m
    where m.order_id = p_order_id
    order by m.created_at asc
    limit 1
  ),
  placed as (
    select
      nullif(elem->>'product_id', '')::uuid as product_id,
      elem->>'product_name' as product_name,
      (elem->>'product_price')::numeric as product_price
    from first_placed fp
    cross join lateral jsonb_array_elements(fp.previous_items) as elem
  ),
  priced as (
    select
      w.ord,
      w.quantity,
      coalesce(p.id, prev.product_id, pl.product_id) as product_id,
      coalesce(p.name, prev.product_name, pl.product_name, w.product_name) as product_name,
      coalesce(p.price, prev.product_price, case when p_relaxed then pl.product_price else null end) as product_price
    from wanted w
    left join public.products p
      on p.id = w.product_id
      and p.business_id = p_business_id
      and (p_relaxed or (p.available = true and p.active = true))
    left join lateral (
      select pr.product_id, pr.product_name, pr.product_price
      from previous pr
      where (w.product_id is not null and pr.product_id = w.product_id)
        or (pr.product_id is null and w.product_name is not null and pr.product_name = w.product_name)
      order by (pr.product_id is not null) desc
      limit 1
    ) prev on true
    left join lateral (
      select pl.product_id, pl.product_name, pl.product_price
      from placed pl
      where p_relaxed
        and (
          (w.product_id is not null and pl.product_id = w.product_id)
          or (pl.product_id is null and w.product_name is not null and pl.product_name = w.product_name)
        )
      limit 1
    ) pl on true
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
    round((line->>'quantity')::numeric, 2),
    round(
      coalesce(
        nullif(line->>'subtotal', '')::numeric,
        (line->>'product_price')::numeric * (line->>'quantity')::numeric
      ),
      2
    )
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
    and status in ('new', 'confirmed')
  for update;

  if rec.id is null then
    raise exception 'This order cannot be changed.';
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

revoke all on function public.admin_replace_order_items(uuid, jsonb, text, integer, boolean) from public, anon;
grant execute on function public.admin_replace_order_items(uuid, jsonb, text, integer, boolean) to authenticated;

notify pgrst, 'reload schema';
