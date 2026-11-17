-- Google / email sign-in creates a customers row even without a verified phone,
-- so the admin directory lists them. Still never attach by email to someone else's
-- customer (only auth_user_id, or verified phone when present).

alter table public.customers
  alter column mobile drop not null;

alter table public.customers
  drop constraint if exists customers_mobile_key_len;

alter table public.customers
  add constraint customers_mobile_key_len
  check (mobile_key is null or length(mobile_key) = 10);

alter table public.customers
  add column if not exists email text;

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
  v_email text := nullif(lower(trim(coalesce(auth.jwt()->>'email', ''))), '');
  v_phone text := nullif(regexp_replace(coalesce(auth.jwt()->>'phone', ''), '\D', '', 'g'), '');
  v_mobile text;
  v_business uuid;
  v_customer_id uuid;
  v_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- p_mobile is kept for older app builds. The phone used for a customer row
  -- is only the phone claim on the verified session.
  v_mobile := case when v_phone is null then null else '+' || v_phone end;

  if v_name is null then
    v_name := nullif(trim(coalesce(
      auth.jwt() -> 'user_metadata' ->> 'full_name',
      auth.jwt() -> 'user_metadata' ->> 'name',
      ''
    )), '');
  end if;

  v_display_name := coalesce(
    v_name,
    nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
    'Customer'
  );
  if length(trim(v_display_name)) < 2 then
    v_display_name := 'Customer';
  end if;

  insert into public.profiles (id, email, mobile, name, role, business_id)
  values (auth.uid(), v_email, v_mobile, v_name, 'customer', p_business_id)
  on conflict (id) do update
    set
      email = coalesce(public.profiles.email, excluded.email),
      mobile = coalesce(excluded.mobile, public.profiles.mobile),
      name = coalesce(excluded.name, public.profiles.name),
      updated_at = now()
    where public.profiles.role = 'customer';

  select business_id
    into v_business
  from public.profiles
  where id = auth.uid() and role = 'customer';

  if v_business is null then
    return;
  end if;

  select c.id
    into v_customer_id
  from public.customers c
  where c.auth_user_id = auth.uid()
  limit 1;

  if v_mobile is not null and length(right(v_phone, 10)) = 10 then
    if v_customer_id is not null then
      begin
        update public.customers
        set
          mobile = case
            when mobile is null or right(regexp_replace(mobile, '\D', '', 'g'), 10) = right(v_phone, 10)
              then v_mobile
            else mobile
          end,
          email = coalesce(email, v_email),
          name = case
            when name is null or name = 'Customer' then v_display_name
            else name
          end,
          updated_at = now()
        where id = v_customer_id;
      exception
        when unique_violation then
          null;
      end;
    else
      begin
        insert into public.customers (business_id, name, mobile, email, source, auth_user_id)
        values (v_business, v_display_name, v_mobile, v_email, 'app', auth.uid())
        on conflict on constraint customers_business_mobile_key do update
          set
            auth_user_id = coalesce(public.customers.auth_user_id, excluded.auth_user_id),
            email = coalesce(public.customers.email, excluded.email),
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
    end if;
  elsif v_customer_id is null then
    begin
      insert into public.customers (business_id, name, mobile, email, source, auth_user_id)
      values (v_business, v_display_name, null, v_email, 'app', auth.uid())
      on conflict (auth_user_id) do update
        set
          email = coalesce(public.customers.email, excluded.email),
          name = case
            when public.customers.name is null or public.customers.name = 'Customer' then excluded.name
            else public.customers.name
          end,
          updated_at = now();
    exception
      when unique_violation then
        null;
    end;
  else
    update public.customers
    set
      email = coalesce(email, v_email),
      name = case
        when name is null or name = 'Customer' then v_display_name
        else name
      end,
      updated_at = now()
    where id = v_customer_id;
  end if;

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
end;
$$;

revoke all on function public.ensure_customer_profile(uuid, text, text) from public, anon;
grant execute on function public.ensure_customer_profile(uuid, text, text) to authenticated;

-- Existing Google / email profiles that never got a customers row.
insert into public.customers (business_id, name, mobile, email, source, auth_user_id)
select
  p.business_id,
  case
    when length(trim(coalesce(p.name, ''))) >= 2 then trim(p.name)
    when length(split_part(coalesce(p.email, ''), '@', 1)) >= 2 then split_part(p.email, '@', 1)
    else 'Customer'
  end,
  case
    when p.mobile is not null
      and length(right(regexp_replace(p.mobile, '\D', '', 'g'), 10)) = 10
      then p.mobile
    else null
  end,
  nullif(lower(trim(coalesce(p.email, ''))), ''),
  'app',
  p.id
from public.profiles p
where p.role = 'customer'
  and p.business_id is not null
  and not exists (
    select 1 from public.customers c where c.auth_user_id = p.id
  )
  and (
    p.mobile is null
    or length(right(regexp_replace(coalesce(p.mobile, ''), '\D', '', 'g'), 10)) <> 10
    or not exists (
      select 1
      from public.customers c
      where c.business_id = p.business_id
        and c.mobile_key = right(regexp_replace(p.mobile, '\D', '', 'g'), 10)
    )
  )
on conflict do nothing;

-- Prefer profile email on app customers that already exist without email.
update public.customers c
set email = nullif(lower(trim(p.email)), '')
from public.profiles p
where c.auth_user_id = p.id
  and c.email is null
  and p.email is not null
  and length(trim(p.email)) > 0;

notify pgrst, 'reload schema';
