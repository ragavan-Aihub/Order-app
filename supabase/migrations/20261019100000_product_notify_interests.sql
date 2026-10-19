-- "Notify me" on coming-soon products (available = false).

create table if not exists public.product_notify_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint product_notify_interests_user_product unique (user_id, product_id)
);

create index if not exists product_notify_interests_product_id_idx
  on public.product_notify_interests (product_id);

create index if not exists product_notify_interests_business_id_idx
  on public.product_notify_interests (business_id);

alter table public.product_notify_interests enable row level security;

create policy product_notify_interests_select_own
on public.product_notify_interests for select
to authenticated
using (user_id = auth.uid() and not public.is_admin());

create policy product_notify_interests_delete_own
on public.product_notify_interests for delete
to authenticated
using (user_id = auth.uid() and not public.is_admin());

create policy product_notify_interests_admin_select
on public.product_notify_interests for select
to authenticated
using (business_id = public.current_admin_business_id());

grant select, delete on public.product_notify_interests to authenticated;
grant select, delete on public.product_notify_interests to service_role;

create or replace function public.upsert_product_notify_interest(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  if auth.uid() is null or public.is_admin() then
    raise exception 'Not authenticated';
  end if;

  select p.business_id
  into v_business_id
  from public.products p
  where p.id = p_product_id
    and p.active = true
    and p.available = false
    and p.business_id = public.current_customer_business_id();

  if v_business_id is null then
    raise exception 'This product is not available for notify requests.';
  end if;

  insert into public.product_notify_interests (user_id, product_id, business_id)
  values (auth.uid(), p_product_id, v_business_id)
  on conflict (user_id, product_id) do update
  set created_at = now();
end;
$$;

create or replace function public.remove_product_notify_interest(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    raise exception 'Not authenticated';
  end if;

  delete from public.product_notify_interests i
  where i.user_id = auth.uid()
    and i.product_id = p_product_id;
end;
$$;

create or replace function public.my_product_notify_interests()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select i.product_id
  from public.product_notify_interests i
  where i.user_id = auth.uid();
$$;

create or replace function public.admin_product_notify_demand()
returns table (
  product_id uuid,
  product_name text,
  product_available boolean,
  user_id uuid,
  customer_id uuid,
  customer_name text,
  customer_mobile text,
  interest_created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as product_id,
    p.name as product_name,
    p.available as product_available,
    i.user_id,
    c.id as customer_id,
    coalesce(c.name, pr.name, 'Customer') as customer_name,
    coalesce(c.mobile, pr.mobile) as customer_mobile,
    i.created_at as interest_created_at
  from public.product_notify_interests i
  join public.products p on p.id = i.product_id
  left join public.customers c
    on c.auth_user_id = i.user_id
   and c.business_id = i.business_id
  left join public.profiles pr on pr.id = i.user_id
  where public.is_admin()
    and i.business_id = public.current_admin_business_id()
  order by p.name, i.created_at desc;
$$;

create or replace function public.admin_product_notify_counts()
returns table (product_id uuid, notify_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i.product_id, count(*)::bigint as notify_count
  from public.product_notify_interests i
  where public.is_admin()
    and i.business_id = public.current_admin_business_id()
  group by i.product_id;
$$;

revoke all on function public.upsert_product_notify_interest(uuid) from public;
revoke all on function public.remove_product_notify_interest(uuid) from public;
revoke all on function public.my_product_notify_interests() from public;
revoke all on function public.admin_product_notify_demand() from public;
revoke all on function public.admin_product_notify_counts() from public;

grant execute on function public.upsert_product_notify_interest(uuid) to authenticated;
grant execute on function public.remove_product_notify_interest(uuid) to authenticated;
grant execute on function public.my_product_notify_interests() to authenticated;
grant execute on function public.admin_product_notify_demand() to authenticated;
grant execute on function public.admin_product_notify_counts() to authenticated;

notify pgrst, 'reload schema';
