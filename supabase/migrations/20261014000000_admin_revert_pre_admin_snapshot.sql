-- Revert shop edits to the snapshot before the first admin modification (keeps prior customer edits).

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
    and status in ('new', 'confirmed')
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
