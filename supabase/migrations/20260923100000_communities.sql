-- Optional communities for admin operations. Customers never manage or select communities.
-- Mapping lives on customer_addresses.community_id (nullable). Orders snapshot community at place time.

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communities_name_len check (length(btrim(name)) >= 2)
);

create unique index communities_business_name_idx
  on public.communities (business_id, lower(btrim(name)));

create index communities_business_id_idx on public.communities (business_id);

create trigger communities_set_updated_at
before update on public.communities
for each row execute function public.set_updated_at();

alter table public.customer_addresses
  add column if not exists community_id uuid references public.communities (id) on delete set null;

create index if not exists customer_addresses_community_id_idx
  on public.customer_addresses (community_id);

alter table public.orders
  add column if not exists community_id uuid references public.communities (id) on delete set null;

alter table public.orders
  add column if not exists community_name text;

create index if not exists orders_community_id_idx on public.orders (community_id);

create table public.delivery_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index delivery_runs_business_id_idx on public.delivery_runs (business_id);
create index delivery_runs_community_id_idx on public.delivery_runs (community_id);

create table public.delivery_run_orders (
  run_id uuid not null references public.delivery_runs (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (run_id, order_id)
);

create unique index delivery_run_orders_order_id_idx on public.delivery_run_orders (order_id);

-- Customers cannot set or clear community mapping from the app.
create or replace function public.customer_addresses_protect_community()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.community_id := old.community_id;
    return new;
  end if;
  new.community_id := null;
  select max(a.community_id)
    into new.community_id
  from public.customer_addresses a
  where a.business_id = new.business_id
    and a.community_id is not null
    and (
      (new.customer_id is not null and a.customer_id = new.customer_id)
      or (new.user_id is not null and a.user_id = new.user_id)
    )
  having count(distinct a.community_id) = 1;
  return new;
end;
$$;

drop trigger if exists customer_addresses_protect_community on public.customer_addresses;
create trigger customer_addresses_protect_community
before insert or update on public.customer_addresses
for each row execute function public.customer_addresses_protect_community();

create or replace function public.orders_snapshot_community()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  if not public.is_admin() and new.community_id is not null then
    if new.user_id is null or not exists (
      select 1
      from public.customer_addresses a
      where a.community_id = new.community_id
        and a.business_id = new.business_id
        and a.user_id = new.user_id
    ) then
      new.community_id := null;
    end if;
  end if;

  if new.community_id is not null then
    select c.name
      into v_name
    from public.communities c
    where c.id = new.community_id
      and c.business_id = new.business_id;
    if v_name is null then
      new.community_id := null;
      new.community_name := null;
    else
      new.community_name := v_name;
    end if;
  else
    new.community_name := null;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_snapshot_community on public.orders;
create trigger orders_snapshot_community
before insert on public.orders
for each row execute function public.orders_snapshot_community();

alter table public.communities enable row level security;
alter table public.delivery_runs enable row level security;
alter table public.delivery_run_orders enable row level security;

create policy communities_admin_all
on public.communities for all
to authenticated
using (business_id = public.current_admin_business_id())
with check (business_id = public.current_admin_business_id() and public.is_admin());

create policy delivery_runs_admin_all
on public.delivery_runs for all
to authenticated
using (business_id = public.current_admin_business_id())
with check (business_id = public.current_admin_business_id() and public.is_admin());

create policy delivery_run_orders_admin_all
on public.delivery_run_orders for all
to authenticated
using (
  exists (
    select 1 from public.delivery_runs r
    where r.id = run_id and r.business_id = public.current_admin_business_id()
  )
)
with check (
  public.is_admin()
  and exists (
    select 1 from public.delivery_runs r
    where r.id = run_id and r.business_id = public.current_admin_business_id()
  )
  and exists (
    select 1 from public.orders o
    where o.id = order_id and o.business_id = public.current_admin_business_id()
  )
);

grant select, insert, update, delete on public.communities to authenticated;
grant select, insert, update, delete on public.delivery_runs to authenticated;
grant select, insert, update, delete on public.delivery_run_orders to authenticated;

notify pgrst, 'reload schema';
