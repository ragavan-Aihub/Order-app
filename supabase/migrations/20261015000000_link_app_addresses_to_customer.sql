-- Link app saved addresses (user_id) to the customers row (auth_user_id), and backfill existing rows.

create or replace function public.customer_addresses_link_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is null and new.user_id is not null and new.business_id is not null then
    new.customer_id := (
      select c.id
      from public.customers c
      where c.auth_user_id = new.user_id
        and c.business_id = new.business_id
      limit 1
    );
  end if;
  return new;
end;
$$;

drop trigger if exists customer_addresses_link_customer on public.customer_addresses;
create trigger customer_addresses_link_customer
before insert or update of user_id, business_id, customer_id on public.customer_addresses
for each row execute function public.customer_addresses_link_customer();

update public.customer_addresses a
set customer_id = c.id
from public.customers c
where a.customer_id is null
  and a.user_id is not null
  and c.auth_user_id = a.user_id
  and c.business_id = a.business_id;

update public.orders o
set customer_id = c.id
from public.customers c
where o.customer_id is null
  and o.user_id is not null
  and c.auth_user_id = o.user_id
  and c.business_id = o.business_id;

-- After OTP login, attach any app-only addresses to the linked customer record.
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
  v_phone text := nullif(regexp_replace(coalesce(auth.jwt()->>'phone', ''), '\D', '', 'g'), '');
  v_mobile text;
  v_business uuid;
  v_customer_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_mobile := case when v_phone is null then null else '+' || v_phone end;

  insert into public.profiles (id, email, mobile, name, role, business_id)
  values (auth.uid(), null, v_mobile, v_name, 'customer', p_business_id)
  on conflict (id) do update
    set
      mobile = coalesce(excluded.mobile, public.profiles.mobile),
      name = coalesce(excluded.name, public.profiles.name),
      updated_at = now()
    where public.profiles.role = 'customer';

  select business_id
    into v_business
  from public.profiles
  where id = auth.uid() and role = 'customer';

  if v_business is not null
    and v_mobile is not null
    and length(right(v_phone, 10)) = 10 then
    begin
      insert into public.customers (business_id, name, mobile, source, auth_user_id)
      values (v_business, coalesce(v_name, 'Customer'), v_mobile, 'app', auth.uid())
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
    exception
      when unique_violation then
        null;
    end;

    select c.id
      into v_customer_id
    from public.customers c
    where c.business_id = v_business
      and c.auth_user_id = auth.uid()
    limit 1;

    if v_customer_id is not null then
      update public.customer_addresses a
      set customer_id = v_customer_id
      where a.business_id = v_business
        and a.user_id = auth.uid()
        and a.customer_id is distinct from v_customer_id;

      update public.orders o
      set customer_id = v_customer_id
      where o.business_id = v_business
        and o.user_id = auth.uid()
        and o.customer_id is distinct from v_customer_id;
    end if;
  end if;
end;
$$;

revoke all on function public.ensure_customer_profile(uuid, text, text) from public, anon;
grant execute on function public.ensure_customer_profile(uuid, text, text) to authenticated;
