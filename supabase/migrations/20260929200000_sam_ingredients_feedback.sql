-- Optional ingredients for Sam; customer product-info requests.

alter table public.products
  add column if not exists ingredients text;

create table if not exists public.product_info_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  transcript text not null,
  created_at timestamptz not null default now()
);

create index if not exists product_info_requests_business_idx
  on public.product_info_requests (business_id, created_at desc);

alter table public.product_info_requests enable row level security;

drop policy if exists product_info_requests_insert_own on public.product_info_requests;
create policy product_info_requests_insert_own
on public.product_info_requests for insert
to authenticated
with check (
  user_id = auth.uid()
  and business_id = public.current_customer_business_id()
);

drop policy if exists product_info_requests_select_own on public.product_info_requests;
create policy product_info_requests_select_own
on public.product_info_requests for select
to authenticated
using (user_id = auth.uid() and not public.is_admin());

drop policy if exists product_info_requests_admin_select on public.product_info_requests;
create policy product_info_requests_admin_select
on public.product_info_requests for select
to authenticated
using (business_id = public.current_admin_business_id());

create or replace function public.get_available_products(p_business_id uuid)
returns setof public.products
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.products
  where business_id = p_business_id and active = true
$$;

notify pgrst, 'reload schema';
