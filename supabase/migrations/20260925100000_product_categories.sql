-- Optional product categories per business. Products may have no category (nullable category_id).

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_name_len check (length(btrim(name)) >= 2)
);

create unique index product_categories_business_name_idx
  on public.product_categories (business_id, lower(btrim(name)));

create index product_categories_business_id_idx on public.product_categories (business_id);

create trigger product_categories_set_updated_at
before update on public.product_categories
for each row execute function public.set_updated_at();

alter table public.products
  add column if not exists category_id uuid references public.product_categories (id) on delete set null;

create index if not exists products_category_id_idx on public.products (category_id);

alter table public.businesses
  add column if not exists categories_enabled boolean not null default false;

update public.businesses b
set categories_enabled = true
where exists (
  select 1 from public.product_categories c where c.business_id = b.id
);

alter table public.product_categories enable row level security;

create policy product_categories_admin_all
on public.product_categories for all
to authenticated
using (business_id = public.current_admin_business_id())
with check (business_id = public.current_admin_business_id() and public.is_admin());

grant select, insert, update, delete on public.product_categories to authenticated;

notify pgrst, 'reload schema';
