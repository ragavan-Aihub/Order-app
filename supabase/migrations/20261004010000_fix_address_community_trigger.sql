-- Postgres has no max(uuid), so customer address inserts from the app failed with
-- "function max(uuid) does not exist". Same rule as before: copy the community only
-- when all of the customer's mapped addresses share one community.
create or replace function public.customer_addresses_protect_community()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.community_id := old.community_id;
    return new;
  end if;
  new.community_id := null;
  select (min(a.community_id::text))::uuid
    into new.community_id
  from public.customer_addresses a
  where a.business_id = new.business_id
    and a.community_id is not null
    and (
      (new.customer_id is not null and a.customer_id = new.customer_id)
      or (new.user_id is not null and a.user_id = new.user_id)
    )
  having count(distinct a.community_id) = 1;
  return new;
end;
$$;
