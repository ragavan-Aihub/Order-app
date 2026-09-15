-- Customer address book (Amazon/Flipkart-style). Orders still snapshot delivery_address.
create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  label text not null default 'home' check (label in ('home', 'work')),
  name text not null,
  mobile text not null,
  alt_mobile text,
  house text,
  locality text,
  address text not null,
  pincode text not null,
  instructions text,
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_addresses_user_id_idx on public.customer_addresses (user_id);
create index customer_addresses_business_id_idx on public.customer_addresses (business_id);

create or replace function public.customer_addresses_before_write()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' then
    if (select count(*) from public.customer_addresses where user_id = new.user_id) >= 3 then
      raise exception 'You can save up to 3 addresses.';
    end if;
    if not exists (select 1 from public.customer_addresses where user_id = new.user_id) then
      new.is_default = true;
    end if;
  end if;
  return new;
end;
$$;

create trigger customer_addresses_before_write
before insert or update on public.customer_addresses
for each row execute function public.customer_addresses_before_write();

create or replace function public.customer_addresses_sync_default()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_default then
      update public.customer_addresses
      set is_default = true
      where id = (
        select id from public.customer_addresses
        where user_id = old.user_id
        order by created_at
        limit 1
      );
    end if;
    return old;
  end if;

  if new.is_default then
    update public.customer_addresses
    set is_default = false
    where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end;
$$;

create trigger customer_addresses_sync_default
after insert or update or delete on public.customer_addresses
for each row execute function public.customer_addresses_sync_default();

alter table public.customer_addresses enable row level security;

create policy customer_addresses_customer_select
on public.customer_addresses for select
to authenticated
using (user_id = auth.uid() and not public.is_admin());

create policy customer_addresses_customer_insert
on public.customer_addresses for insert
to authenticated
with check (
  user_id = auth.uid()
  and business_id = public.current_customer_business_id()
  and not public.is_admin()
);

create policy customer_addresses_customer_update
on public.customer_addresses for update
to authenticated
using (user_id = auth.uid() and not public.is_admin())
with check (
  user_id = auth.uid()
  and business_id = public.current_customer_business_id()
  and not public.is_admin()
);

create policy customer_addresses_customer_delete
on public.customer_addresses for delete
to authenticated
using (user_id = auth.uid() and not public.is_admin());

create policy customer_addresses_admin_select
on public.customer_addresses for select
to authenticated
using (business_id = public.current_admin_business_id());

create policy profiles_admin_select_customers
on public.profiles for select
to authenticated
using (
  public.is_admin()
  and role = 'customer'
  and business_id = public.current_admin_business_id()
);

grant select, insert, update, delete on public.customer_addresses to authenticated;
