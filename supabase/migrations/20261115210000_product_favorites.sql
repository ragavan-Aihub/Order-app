-- Customer hearts / favourites. One row per user + product.

create table if not exists public.product_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint product_favorites_user_product unique (user_id, product_id)
);

create index if not exists product_favorites_user_created_idx
  on public.product_favorites (user_id, created_at desc);

alter table public.product_favorites enable row level security;

drop policy if exists product_favorites_select_own on public.product_favorites;
create policy product_favorites_select_own
on public.product_favorites for select
to authenticated
using (user_id = auth.uid() and not public.is_admin());

drop policy if exists product_favorites_delete_own on public.product_favorites;
create policy product_favorites_delete_own
on public.product_favorites for delete
to authenticated
using (user_id = auth.uid() and not public.is_admin());

grant select, delete on public.product_favorites to authenticated;
grant select, delete on public.product_favorites to service_role;

create or replace function public.toggle_product_favorite(p_product_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_exists boolean;
begin
  if auth.uid() is null or public.is_admin() then
    raise exception 'Not authenticated';
  end if;

  select p.business_id
  into v_business_id
  from public.products p
  where p.id = p_product_id
    and p.active = true
    and p.business_id = public.current_customer_business_id();

  if v_business_id is null then
    raise exception 'This product cannot be saved.';
  end if;

  select exists (
    select 1
    from public.product_favorites f
    where f.user_id = auth.uid()
      and f.product_id = p_product_id
  )
  into v_exists;

  if v_exists then
    delete from public.product_favorites
    where user_id = auth.uid()
      and product_id = p_product_id;
    return false;
  end if;

  insert into public.product_favorites (user_id, product_id, business_id)
  values (auth.uid(), p_product_id, v_business_id);
  return true;
end;
$$;

create or replace function public.my_product_favorites()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select f.product_id
  from public.product_favorites f
  where f.user_id = auth.uid()
  order by f.created_at desc;
$$;

revoke all on function public.toggle_product_favorite(uuid) from public;
revoke all on function public.my_product_favorites() from public;
grant execute on function public.toggle_product_favorite(uuid) to authenticated;
grant execute on function public.my_product_favorites() to authenticated;

notify pgrst, 'reload schema';
