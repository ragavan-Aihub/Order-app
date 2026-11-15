-- Admin invoice (replace/revert lines) allowed through out_for_delivery.
-- Customer replace stays locked at OFD. Delivered and cancelled stay locked.

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
    and status in ('new', 'confirmed', 'out_for_delivery')
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
    and status in ('new', 'confirmed', 'out_for_delivery')
  for update;

  if rec.id is null then
    raise exception 'This order cannot be changed.';
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

revoke all on function public.admin_revert_order_to_placed(uuid, integer) from public, anon;
grant execute on function public.admin_revert_order_to_placed(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
