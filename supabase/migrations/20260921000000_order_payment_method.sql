-- COD payment tracking, independent of kitchen order status.
alter table public.orders
  add column if not exists payment_method text not null default 'pending';

alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('pending', 'cash', 'upi'));

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
    'payment_method', p_order.payment_method,
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
