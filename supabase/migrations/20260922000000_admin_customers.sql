-- Directory of shop customers (app OTP, WhatsApp, walk-in, phone) without requiring auth.users.
-- Admin can CRUD customers, addresses, and place orders. Anon key + admin RLS only.

insert into public.order_channels (id, label) values
  ('admin', 'Admin')
on conflict (id) do nothing;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  mobile text not null,
  mobile_key text generated always as (right(regexp_replace(mobile, '\D', '', 'g'), 10)) stored,
  source text not null check (source in ('app', 'whatsapp', 'walk_in', 'phone', 'other')),
  notes text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_len check (length(trim(name)) >= 2),
  constraint customers_mobile_key_len check (length(mobile_key) = 10),
  constraint customers_business_mobile_key unique (business_id, mobile_key)
);

create index customers_business_id_idx on public.customers (business_id);

create or replace function public.customers_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_touch_updated_at
before update on public.customers
for each row execute function public.customers_touch_updated_at();

insert into public.customers (business_id, name, mobile, source, auth_user_id)
select distinct on (p.business_id, right(regexp_replace(p.mobile, '\D', '', 'g'), 10))
  p.business_id,
  coalesce(nullif(trim(p.name), ''), 'Customer'),
  p.mobile,
  'app',
  p.id
from public.profiles p
where p.role = 'customer'
  and p.business_id is not null
  and p.mobile is not null
  and length(right(regexp_replace(p.mobile, '\D', '', 'g'), 10)) = 10
order by p.business_id, right(regexp_replace(p.mobile, '\D', '', 'g'), 10), p.created_at;

alter table public.customer_addresses
  alter column user_id drop not null;

alter table public.customer_addresses
  add column if not exists customer_id uuid references public.customers (id) on delete cascade;

update public.customer_addresses a
set customer_id = c.id
from public.customers c
where a.customer_id is null
  and c.auth_user_id = a.user_id;

alter table public.customer_addresses
  drop constraint if exists customer_addresses_label_check;

alter table public.customer_addresses
  add constraint customer_addresses_label_check
  check (label in ('home', 'work', 'other'));

alter table public.customer_addresses
  add constraint customer_addresses_owner_present
  check (customer_id is not null or user_id is not null);

create index if not exists customer_addresses_customer_id_idx on public.customer_addresses (customer_id);

create or replace function public.customer_addresses_before_write()
returns trigger
language plpgsql
as $$
declare
  address_count integer;
begin
  new.updated_at = now();

  if new.customer_id is null and new.user_id is null then
    raise exception 'Address needs a customer.';
  end if;

  if tg_op = 'INSERT' then
    if new.customer_id is not null then
      select count(*) into address_count
      from public.customer_addresses
      where customer_id = new.customer_id;
    else
      select count(*) into address_count
      from public.customer_addresses
      where user_id = new.user_id;
    end if;

    if address_count >= 3 then
      raise exception 'You can save up to 3 addresses.';
    end if;

    if address_count = 0 then
      new.is_default = true;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.customer_addresses_sync_default()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_default then
      if old.customer_id is not null then
        update public.customer_addresses
        set is_default = true
        where id = (
          select id from public.customer_addresses
          where customer_id = old.customer_id
          order by created_at
          limit 1
        );
      elsif old.user_id is not null then
        update public.customer_addresses
        set is_default = true
        where id = (
          select id from public.customer_addresses
          where user_id = old.user_id
          order by created_at
          limit 1
        );
      end if;
    end if;
    return old;
  end if;

  if new.is_default then
    if new.customer_id is not null then
      update public.customer_addresses
      set is_default = false
      where customer_id = new.customer_id and id <> new.id and is_default;
    elsif new.user_id is not null then
      update public.customer_addresses
      set is_default = false
      where user_id = new.user_id and id <> new.id and is_default;
    end if;
  end if;
  return new;
end;
$$;

alter table public.orders
  add column if not exists customer_id uuid references public.customers (id) on delete set null;

create index if not exists orders_customer_id_idx on public.orders (customer_id);

update public.orders o
set customer_id = c.id
from public.customers c
where o.customer_id is null
  and c.auth_user_id is not null
  and c.auth_user_id = o.user_id;

create or replace function public.ensure_customer_profile(
  p_business_id uuid,
  p_name text,
  p_mobile text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_mobile text := nullif(trim(coalesce(p_mobile, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, email, mobile, name, role, business_id)
  values (auth.uid(), null, v_mobile, v_name, 'customer', p_business_id)
  on conflict (id) do update
    set
      mobile = coalesce(excluded.mobile, public.profiles.mobile),
      name = coalesce(excluded.name, public.profiles.name),
      updated_at = now()
    where public.profiles.role = 'customer';

  if p_business_id is not null
    and v_mobile is not null
    and length(right(regexp_replace(v_mobile, '\D', '', 'g'), 10)) = 10 then
    insert into public.customers (business_id, name, mobile, source, auth_user_id)
    values (
      p_business_id,
      coalesce(v_name, 'Customer'),
      v_mobile,
      'app',
      auth.uid()
    )
    on conflict on constraint customers_business_mobile_key do update
      set
        auth_user_id = coalesce(public.customers.auth_user_id, excluded.auth_user_id),
        name = case
          when public.customers.name is null or public.customers.name = 'Customer' then excluded.name
          else public.customers.name
        end,
        updated_at = now()
      where public.customers.auth_user_id is null
        or public.customers.auth_user_id = excluded.auth_user_id;
  end if;
end;
$$;

alter table public.customers enable row level security;

create policy customers_admin_select
on public.customers for select
to authenticated
using (business_id = public.current_admin_business_id());

create policy customers_admin_insert
on public.customers for insert
to authenticated
with check (business_id = public.current_admin_business_id() and public.is_admin());

create policy customers_admin_update
on public.customers for update
to authenticated
using (business_id = public.current_admin_business_id())
with check (business_id = public.current_admin_business_id());

create policy customers_admin_delete
on public.customers for delete
to authenticated
using (business_id = public.current_admin_business_id() and public.is_admin());

create policy customers_own_select
on public.customers for select
to authenticated
using (auth_user_id = auth.uid() and not public.is_admin());

create policy customer_addresses_admin_insert
on public.customer_addresses for insert
to authenticated
with check (business_id = public.current_admin_business_id() and public.is_admin());

create policy customer_addresses_admin_update
on public.customer_addresses for update
to authenticated
using (business_id = public.current_admin_business_id())
with check (business_id = public.current_admin_business_id());

create policy customer_addresses_admin_delete
on public.customer_addresses for delete
to authenticated
using (business_id = public.current_admin_business_id() and public.is_admin());

create policy orders_admin_insert
on public.orders for insert
to authenticated
with check (business_id = public.current_admin_business_id() and public.is_admin());

create policy order_items_admin_insert
on public.order_items for insert
to authenticated
with check (
  public.is_admin()
  and exists (
    select 1 from public.orders o
    where o.id = order_id and o.business_id = public.current_admin_business_id()
  )
);

create policy order_items_admin_delete
on public.order_items for delete
to authenticated
using (
  public.is_admin()
  and exists (
    select 1 from public.orders o
    where o.id = order_id and o.business_id = public.current_admin_business_id()
  )
);

create policy orders_admin_delete
on public.orders for delete
to authenticated
using (business_id = public.current_admin_business_id() and public.is_admin());

create policy profiles_admin_update_customers
on public.profiles for update
to authenticated
using (
  public.is_admin()
  and role = 'customer'
  and business_id = public.current_admin_business_id()
)
with check (
  public.is_admin()
  and role = 'customer'
  and business_id = public.current_admin_business_id()
);

grant select, insert, update, delete on public.customers to authenticated;

notify pgrst, 'reload schema';
