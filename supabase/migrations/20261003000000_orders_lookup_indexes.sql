-- Fast customer lookups: open/undelivered order for an address, and recent order list.
create index if not exists orders_user_business_created_idx
  on public.orders (user_id, business_id, created_at desc);

create index if not exists orders_user_undelivered_address_idx
  on public.orders (user_id, business_id, customer_address_id, created_at desc)
  where status in ('new', 'confirmed', 'preparing', 'out_for_delivery');
