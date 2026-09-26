-- Catalog presence (active) vs sellable (available / coming soon).

alter table public.products
  add column if not exists active boolean not null default true;

update public.products
set active = available
where active is distinct from available;

create index if not exists products_business_active_idx
  on public.products (business_id, active);

drop policy if exists products_customer_select_available on public.products;

create policy products_customer_select_shop
on public.products for select
to authenticated
using (
  active = true
  and business_id = public.current_customer_business_id()
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
  where business_id = p_business_id and active = true
$$;

create or replace function public.partner_products(p_api_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.api_keys;
begin
  v_key := public.partner_auth(p_api_key, 'catalog.read');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'description', p.description,
      'price', p.price,
      'image_url', p.image_url
    ) order by p.name)
    from public.products p
    where p.business_id = v_key.business_id
      and p.active = true
      and p.available = true
  ), '[]'::jsonb);
end;
$$;

create or replace function public.partner_product(p_api_key text, p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.api_keys;
  v_row public.products;
begin
  v_key := public.partner_auth(p_api_key, 'catalog.read');
  select * into v_row
  from public.products
  where id = p_product_id
    and business_id = v_key.business_id
    and active = true
    and available = true;
  if v_row.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'description', v_row.description,
    'price', v_row.price,
    'image_url', v_row.image_url
  );
end;
$$;

notify pgrst, 'reload schema';
