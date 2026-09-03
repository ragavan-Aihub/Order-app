-- Farm2Flavour initial schema: businesses, profiles, products, orders, RLS, storage.
-- Apply in the Supabase SQL editor or with the CLI. Do not put service-role keys in apps.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  logo_url text,
  phone text,
  email text,
  address text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  mobile text,
  name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  business_id uuid references public.businesses (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_requires_business check (role <> 'admin' or business_id is not null)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  image_url text,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  customer_name text not null,
  mobile text not null,
  delivery_address text not null,
  pincode text not null,
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  status text not null default 'new' check (
    status in ('new', 'confirmed', 'preparing', 'delivered', 'cancelled')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  product_price numeric(10, 2) not null,
  quantity integer not null check (quantity > 0),
  subtotal numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index products_business_id_idx on public.products (business_id);
create index products_business_available_idx on public.products (business_id, available);
create index orders_business_id_idx on public.orders (business_id);
create index orders_user_id_idx on public.orders (user_id);
create index orders_created_at_idx on public.orders (created_at desc);
create index order_items_order_id_idx on public.order_items (order_id);
create index profiles_business_id_idx on public.profiles (business_id);

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and tg_op = 'UPDATE' and (
    new.role is distinct from old.role
    or new.business_id is distinct from old.business_id
  ) then
    raise exception 'Cannot change role or business assignment';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_privileges
before update on public.profiles
for each row execute function public.protect_profile_privileges();

create or replace function public.current_admin_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id
  from public.profiles
  where id = auth.uid() and role = 'admin'
$$;

create or replace function public.current_customer_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id
  from public.profiles
  where id = auth.uid() and role = 'customer'
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and business_id is not null
  )
$$;

revoke all on function public.current_admin_business_id() from public;
revoke all on function public.current_customer_business_id() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_admin_business_id() to authenticated;
grant execute on function public.current_customer_business_id() to authenticated;
grant execute on function public.is_admin() to authenticated;

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy businesses_admin_select
on public.businesses for select
to authenticated
using (id = public.current_admin_business_id());

create policy businesses_admin_update
on public.businesses for update
to authenticated
using (id = public.current_admin_business_id())
with check (id = public.current_admin_business_id());

create policy businesses_customer_select
on public.businesses for select
to authenticated
using (id = public.current_customer_business_id());

create policy profiles_select_own
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy products_admin_all
on public.products for all
to authenticated
using (business_id = public.current_admin_business_id())
with check (business_id = public.current_admin_business_id());

create policy products_customer_select_available
on public.products for select
to authenticated
using (
  available = true
  and business_id = public.current_customer_business_id()
);

create policy orders_customer_select
on public.orders for select
to authenticated
using (user_id = auth.uid() and not public.is_admin());

create policy orders_customer_insert
on public.orders for insert
to authenticated
with check (
  user_id = auth.uid()
  and business_id = public.current_customer_business_id()
  and status = 'new'
  and not public.is_admin()
);

create policy orders_admin_select
on public.orders for select
to authenticated
using (business_id = public.current_admin_business_id());

create policy orders_admin_update
on public.orders for update
to authenticated
using (business_id = public.current_admin_business_id())
with check (business_id = public.current_admin_business_id());

create policy order_items_customer_select
on public.order_items for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid()
  )
  and not public.is_admin()
);

create policy order_items_customer_insert
on public.order_items for insert
to authenticated
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.user_id = auth.uid()
      and o.business_id = public.current_customer_business_id()
  )
  and not public.is_admin()
);

create policy order_items_admin_select
on public.order_items for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.business_id = public.current_admin_business_id()
  )
);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('business-logos', 'business-logos', true)
on conflict (id) do nothing;

create policy product_images_public_read
on storage.objects for select
to public
using (bucket_id = 'product-images');

create policy product_images_admin_write
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_admin()
  and (storage.foldername(name))[1] = public.current_admin_business_id()::text
);

create policy product_images_admin_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin()
  and (storage.foldername(name))[1] = public.current_admin_business_id()::text
)
with check (
  bucket_id = 'product-images'
  and public.is_admin()
  and (storage.foldername(name))[1] = public.current_admin_business_id()::text
);

create policy business_logos_public_read
on storage.objects for select
to public
using (bucket_id = 'business-logos');

create policy business_logos_admin_write
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'business-logos'
  and public.is_admin()
  and (storage.foldername(name))[1] = public.current_admin_business_id()::text
);

create policy business_logos_admin_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'business-logos'
  and public.is_admin()
  and (storage.foldername(name))[1] = public.current_admin_business_id()::text
)
with check (
  bucket_id = 'business-logos'
  and public.is_admin()
  and (storage.foldername(name))[1] = public.current_admin_business_id()::text
);

create or replace function public.get_available_products(p_business_id uuid)
returns setof public.products
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.products
  where business_id = p_business_id and available = true
$$;

create or replace function public.get_business_public(p_business_id uuid)
returns setof public.businesses
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.businesses
  where id = p_business_id
$$;

grant execute on function public.get_available_products(uuid) to anon, authenticated;
grant execute on function public.get_business_public(uuid) to anon, authenticated;

grant select, insert, update, delete on public.businesses to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert on public.order_items to authenticated;
