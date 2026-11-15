-- Customers may cancel while Placed or Confirmed. Out for delivery and later cannot be cancelled in the app.

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

  if rec.status not in ('new', 'confirmed') then
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
