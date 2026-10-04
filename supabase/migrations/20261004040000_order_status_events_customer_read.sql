drop policy if exists order_status_events_customer_select on public.order_status_events;

create policy order_status_events_customer_select
on public.order_status_events for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
