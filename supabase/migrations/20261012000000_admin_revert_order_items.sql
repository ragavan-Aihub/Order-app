-- Admin revert to originally placed lines; relaxed pricing for follow-up admin edits.

drop function if exists public.admin_replace_order_items(uuid, jsonb, text, integer);
drop function if exists public.order_lines_from_request(uuid, uuid, jsonb);

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
  placed_items jsonb;
  placed_total numeric(10, 2);
  prev_items jsonb;
  prev_total numeric(10, 2);
  new_total numeric(10, 2);
  new_items jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'You are not signed in as an admin.';
  end if;

  select m.previous_items, m.previous_total
    into placed_items, placed_total
  from public.order_modifications m
  where m.order_id = p_order_id
  order by m.created_at asc
  limit 1;

  if placed_items is null or jsonb_array_length(placed_items) < 1 then
    raise exception 'This order is already the original.';
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
  if prev_items = placed_items then
    raise exception 'This order is already the original.';
  end if;

  prev_total := rec.total_amount;
  new_total := public.order_apply_priced_lines(rec.id, placed_items);
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

revoke all on function public.admin_revert_order_to_placed(uuid, integer) from public, anon;
grant execute on function public.admin_revert_order_to_placed(uuid, integer) to authenticated;
