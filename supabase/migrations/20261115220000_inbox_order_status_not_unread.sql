-- Order status rows stay in Notification Center but do not count as unread.

create or replace function public.my_inbox_unread_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.customer_inbox
  where user_id = auth.uid()
    and read_at is null
    and category <> 'orders';
$$;

create or replace function public.inbox_on_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
  v_label text;
begin
  if new.user_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  if new.status not in ('confirmed', 'out_for_delivery', 'delivered') then
    return new;
  end if;
  if exists (
    select 1
    from public.customer_inbox i
    where i.user_id = new.user_id
      and i.category = 'orders'
      and i.data->>'order_id' = new.id::text
      and i.data->>'status' = new.status
  ) then
    return new;
  end if;

  v_label := case when new.order_number is not null then 'Order #' || new.order_number::text else 'Your order' end;
  if new.status = 'confirmed' then
    v_title := 'Order confirmed';
    v_body := v_label || ' is confirmed. The shop is preparing it.';
  elsif new.status = 'out_for_delivery' then
    v_title := 'Out for delivery';
    v_body := v_label || ' is on its way to you.';
  else
    v_title := 'Delivered';
    v_body := v_label || ' has been delivered. Thank you!';
  end if;

  insert into public.customer_inbox (
    business_id, user_id, category, title, body, data, source, read_at
  ) values (
    new.business_id,
    new.user_id,
    'orders',
    v_title,
    v_body,
    jsonb_build_object('order_id', new.id::text, 'status', new.status),
    'auto',
    now()
  );
  perform public.trim_customer_inbox(new.user_id);
  return new;
end;
$$;

update public.customer_inbox
set read_at = now()
where category = 'orders'
  and read_at is null;

notify pgrst, 'reload schema';
