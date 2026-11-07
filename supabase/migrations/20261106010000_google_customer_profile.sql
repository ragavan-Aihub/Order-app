-- Google sign-in stores a profile (name and email from the JWT) and does not
-- create or update a customer row unless the JWT has a verified phone.
-- Email and phone are never used to attach a Google user to someone else's orders.

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
  v_email text := nullif(trim(coalesce(auth.jwt()->>'email', '')), '');
  v_phone text := nullif(regexp_replace(coalesce(auth.jwt()->>'phone', ''), '\D', '', 'g'), '');
  v_mobile text;
  v_business uuid;
  v_customer_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- p_mobile is kept for older app builds. The phone used for a customer row
  -- is only the phone claim on the verified session.
  v_mobile := case when v_phone is null then null else '+' || v_phone end;

  if v_phone is null and v_name is null then
    v_name := nullif(trim(coalesce(
      auth.jwt() -> 'user_metadata' ->> 'full_name',
      auth.jwt() -> 'user_metadata' ->> 'name',
      ''
    )), '');
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

notify pgrst, 'reload schema';
