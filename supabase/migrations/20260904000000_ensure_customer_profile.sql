-- Allow authenticated customers to create/update their own profile without changing role.
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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, email, mobile, name, role, business_id)
  values (auth.uid(), null, p_mobile, p_name, 'customer', p_business_id)
  on conflict (id) do update
    set
      mobile = coalesce(excluded.mobile, public.profiles.mobile),
      name = coalesce(excluded.name, public.profiles.name),
      updated_at = now()
    where public.profiles.role = 'customer';
end;
$$;

revoke all on function public.ensure_customer_profile(uuid, text, text) from public;
grant execute on function public.ensure_customer_profile(uuid, text, text) to authenticated;
