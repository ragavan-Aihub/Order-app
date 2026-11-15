-- In-app notification inbox: automated order alerts plus admin-sent important messages.

create table if not exists public.inbox_broadcasts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category text not null check (category in ('offers', 'updates')),
  title text not null,
  body text not null,
  created_by uuid references auth.users (id) on delete set null,
  recipient_count integer not null default 0,
  push_sent integer,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_inbox (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('orders', 'offers', 'updates')),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  source text not null default 'auto' check (source in ('auto', 'admin')),
  broadcast_id uuid references public.inbox_broadcasts (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customer_inbox_user_created_idx
  on public.customer_inbox (user_id, created_at desc);
create index if not exists customer_inbox_user_unread_idx
  on public.customer_inbox (user_id)
  where read_at is null;
create index if not exists inbox_broadcasts_business_created_idx
  on public.inbox_broadcasts (business_id, created_at desc);

alter table public.inbox_broadcasts enable row level security;
alter table public.customer_inbox enable row level security;

drop policy if exists inbox_broadcasts_admin_select on public.inbox_broadcasts;
drop policy if exists customer_inbox_select_own on public.customer_inbox;
drop policy if exists customer_inbox_admin_select on public.customer_inbox;

create policy inbox_broadcasts_admin_select
on public.inbox_broadcasts for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.business_id = inbox_broadcasts.business_id
  )
);

create policy customer_inbox_select_own
on public.customer_inbox for select
to authenticated
using (user_id = auth.uid());

create policy customer_inbox_admin_select
on public.customer_inbox for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.business_id = customer_inbox.business_id
  )
);

grant select on public.inbox_broadcasts to authenticated;
grant select on public.customer_inbox to authenticated;

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
    and read_at is null;
$$;

create or replace function public.mark_inbox_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update public.customer_inbox
  set read_at = coalesce(read_at, now())
  where id = p_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.mark_all_inbox_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update public.customer_inbox
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null;
end;
$$;

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

  return query select v_id, v_count;
end;
$$;

revoke all on function public.my_inbox_unread_count() from public;
revoke all on function public.mark_inbox_read(uuid) from public;
revoke all on function public.mark_all_inbox_read() from public;
revoke all on function public.admin_broadcast_inbox(text, text, text) from public;
grant execute on function public.my_inbox_unread_count() to authenticated;
grant execute on function public.mark_inbox_read(uuid) to authenticated;
grant execute on function public.mark_all_inbox_read() to authenticated;
grant execute on function public.admin_broadcast_inbox(text, text, text) to authenticated;

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
  return new;
end;
$$;

drop trigger if exists orders_inbox_status on public.orders;
create trigger orders_inbox_status
after insert or update of status on public.orders
for each row
execute function public.inbox_on_order_status();
