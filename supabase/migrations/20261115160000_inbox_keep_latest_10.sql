-- Phone inbox keeps only the 10 newest rows per customer.

create or replace function public.trim_customer_inbox(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  delete from public.customer_inbox
  where user_id = p_user_id
    and id not in (
      select id
      from public.customer_inbox
      where user_id = p_user_id
      order by created_at desc, id desc
      limit 10
    );
end;
$$;

revoke all on function public.trim_customer_inbox(uuid) from public;

create or replace function public.admin_broadcast_inbox(
  p_title text,
  p_body text,
  p_category text
)
returns table (broadcast_id uuid, recipient_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_category text := lower(trim(coalesce(p_category, '')));
  v_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select business_id into v_business
  from public.profiles
  where id = auth.uid()
    and role = 'admin';
  if v_business is null then
    raise exception 'Not an admin';
  end if;
  if v_title is null or char_length(v_title) > 80 then
    raise exception 'Title is required (max 80 characters)';
  end if;
  if v_body is null or char_length(v_body) > 280 then
    raise exception 'Message is required (max 280 characters)';
  end if;
  if v_category not in ('offers', 'updates') then
    raise exception 'Category must be offers or updates';
  end if;

  insert into public.inbox_broadcasts (business_id, category, title, body, created_by)
  values (v_business, v_category, v_title, v_body, auth.uid())
  returning id into v_id;

  insert into public.customer_inbox (
    business_id, user_id, category, title, body, data, source, broadcast_id
  )
  select distinct v_business, recipients.user_id, v_category, v_title, v_body, '{}'::jsonb, 'admin', v_id
  from (
    select o.user_id
    from public.orders o
    where o.business_id = v_business
    union
    select p.id
    from public.profiles p
    where p.role = 'customer'
      and p.business_id = v_business
  ) recipients
  where recipients.user_id is not null;

  get diagnostics v_count = row_count;
  update public.inbox_broadcasts
  set recipient_count = v_count
  where id = v_id;

  delete from public.customer_inbox i
  using (
    select extra.id
    from (
      select ci.id,
        row_number() over (partition by ci.user_id order by ci.created_at desc, ci.id desc) as rn
      from public.customer_inbox ci
      where ci.user_id in (
        select distinct inbox.user_id
        from public.customer_inbox inbox
        where inbox.broadcast_id = v_id
      )
    ) extra
    where extra.rn > 10
  ) old_rows
  where i.id = old_rows.id;

  return query select v_id, v_count;
end;
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
    business_id, user_id, category, title, body, data, source
  ) values (
    new.business_id,
    new.user_id,
    'orders',
    v_title,
    v_body,
    jsonb_build_object('order_id', new.id::text, 'status', new.status),
    'auto'
  );
  perform public.trim_customer_inbox(new.user_id);
  return new;
end;
$$;

delete from public.customer_inbox i
using (
  select extra.id
  from (
    select ci.id,
      row_number() over (partition by ci.user_id order by ci.created_at desc, ci.id desc) as rn
    from public.customer_inbox ci
  ) extra
  where extra.rn > 10
) old_rows
where i.id = old_rows.id;
