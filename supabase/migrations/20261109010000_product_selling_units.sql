-- Product selling types: kg, fixed_pack, quantity. Additive; existing rows stay quantity.

alter table public.products
  add column if not exists selling_type text not null default 'quantity',
  add column if not exists selling_unit text,
  add column if not exists price_per_kg numeric(10, 2),
  add column if not exists minimum_weight_grams integer,
  add column if not exists maximum_weight_grams integer;

alter table public.products
  drop constraint if exists products_selling_type_check;
alter table public.products
  add constraint products_selling_type_check
  check (selling_type in ('kg', 'fixed_pack', 'quantity'));

alter table public.products
  drop constraint if exists products_weight_bounds_check;
alter table public.products
  add constraint products_weight_bounds_check
  check (
    (minimum_weight_grams is null or minimum_weight_grams > 0)
    and (maximum_weight_grams is null or maximum_weight_grams > 0)
    and (
      minimum_weight_grams is null
      or maximum_weight_grams is null
      or maximum_weight_grams >= minimum_weight_grams
    )
  );

create table if not exists public.product_pack_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  weight_grams integer not null check (weight_grams > 0),
  selling_price numeric(10, 2) not null check (selling_price >= 0),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_pack_options_product_weight unique (product_id, weight_grams)
);

drop trigger if exists product_pack_options_set_updated_at on public.product_pack_options;
create trigger product_pack_options_set_updated_at
before update on public.product_pack_options
for each row execute function public.set_updated_at();

create index if not exists product_pack_options_product_id_idx
  on public.product_pack_options (product_id, display_order);

alter table public.order_items
  add column if not exists selling_type text,
  add column if not exists selling_unit text,
  add column if not exists pack_option_id uuid references public.product_pack_options (id) on delete set null,
  add column if not exists pack_weight_grams integer,
  add column if not exists weight_grams integer;

alter table public.product_pack_options enable row level security;

drop policy if exists product_pack_options_select_catalog on public.product_pack_options;
create policy product_pack_options_select_catalog
on public.product_pack_options for select
to anon, authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_id
      and p.active = true
  )
);

drop policy if exists product_pack_options_admin_all on public.product_pack_options;
create policy product_pack_options_admin_all
on public.product_pack_options for all
to authenticated
using (
  public.is_admin()
  and exists (
    select 1 from public.products p
    where p.id = product_id
      and p.business_id = public.current_admin_business_id()
  )
)
with check (
  public.is_admin()
  and exists (
    select 1 from public.products p
    where p.id = product_id
      and p.business_id = public.current_admin_business_id()
  )
);

grant select on public.product_pack_options to anon, authenticated;
grant insert, update, delete on public.product_pack_options to authenticated;

create or replace function public.apply_order_item_selling_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_product public.products;
  v_pack public.product_pack_options;
  v_type text;
  v_per_kg numeric(10, 2);
begin
  if coalesce(current_setting('app.order_items_priced', true), '') = 'on' then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if v_order.id is null then
    return new;
  end if;

  if not public.is_admin() then
    if auth.uid() is null or v_order.user_id is distinct from auth.uid() then
      return new;
    end if;
  end if;

  select * into v_product
  from public.products
  where id = new.product_id
    and business_id = v_order.business_id
    and available = true
    and active = true;

  if v_product.id is null then
    raise exception 'Some items are no longer available. Refresh and try again.';
  end if;

  v_type := coalesce(v_product.selling_type, 'quantity');
  new.product_name := v_product.name;
  new.selling_type := v_type;
  new.created_at := coalesce(new.created_at, now());

  if v_type = 'kg' then
    if new.weight_grams is null or new.weight_grams < 1 then
      raise exception 'Enter a weight greater than 0 Kg.';
    end if;
    if v_product.minimum_weight_grams is not null
      and new.weight_grams < v_product.minimum_weight_grams then
      raise exception 'Weight is below the minimum for this product.';
    end if;
    if v_product.maximum_weight_grams is not null
      and new.weight_grams > v_product.maximum_weight_grams then
      raise exception 'Weight is above the maximum for this product.';
    end if;
    v_per_kg := coalesce(v_product.price_per_kg, v_product.price);
    new.quantity := 1;
    new.product_price := v_per_kg;
    new.selling_unit := 'Kg';
    new.pack_option_id := null;
    new.pack_weight_grams := null;
    new.subtotal := round(v_per_kg * (new.weight_grams::numeric / 1000), 2);
    return new;
  end if;

  if v_type = 'fixed_pack' then
    if new.quantity is null or new.quantity < 1 or new.quantity > 10 then
      raise exception 'Check item quantities.';
    end if;
    select * into v_pack
    from public.product_pack_options
    where id = new.pack_option_id
      and product_id = v_product.id
      and is_active = true;
    if v_pack.id is null then
      raise exception 'Choose a pack size.';
    end if;
    new.product_price := v_pack.selling_price;
    new.selling_unit := 'pack';
    new.pack_weight_grams := v_pack.weight_grams;
    new.weight_grams := null;
    new.subtotal := round(v_pack.selling_price * new.quantity, 2);
    return new;
  end if;

  if new.quantity is null or new.quantity < 1 or new.quantity > 10 then
    raise exception 'Check item quantities.';
  end if;
  new.product_price := v_product.price;
  new.selling_unit := nullif(trim(coalesce(v_product.selling_unit, '')), '');
  new.pack_option_id := null;
  new.pack_weight_grams := null;
  new.weight_grams := null;
  new.subtotal := round(v_product.price * new.quantity, 2);
  return new;
end;
$$;

drop trigger if exists order_items_customer_guard on public.order_items;
drop function if exists public.order_items_customer_guard();

drop trigger if exists order_items_selling_price on public.order_items;
create trigger order_items_selling_price
before insert on public.order_items
for each row execute function public.apply_order_item_selling_price();

notify pgrst, 'reload schema';
