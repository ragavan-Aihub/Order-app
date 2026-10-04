-- Reset the daily customer cancel limit (3 per 24 hours) for one customer.
-- Use for testing, or when the shop agrees to let a customer cancel again.
-- Run in the Supabase SQL editor. Orders stay cancelled and their history is unchanged.
-- Replace 9876543210 in both queries with the customer's phone (last 10 digits are enough).

-- 1. Check: customer cancellations counted in the last 24 hours
select count(*) as cancels_last_24h
from public.order_status_events e
join public.orders o on o.id = e.order_id
where o.cancelled_by = 'customer'
  and e.status = 'cancelled'
  and e.created_at > now() - interval '24 hours'
  and o.user_id = (select id from auth.users where phone like '%9876543210');

-- 2. Reset: these cancellations stop counting towards the limit
update public.orders
set cancelled_by = null
where cancelled_by = 'customer'
  and user_id = (select id from auth.users where phone like '%9876543210');
