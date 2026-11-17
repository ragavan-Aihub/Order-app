-- Link orphan app addresses to customers, keep one default per customer,
-- and clear sibling defaults by customer_id (not only user_id).

update public.customer_addresses a
set customer_id = c.id
from public.customers c
where a.customer_id is null
  and a.user_id is not null
  and c.auth_user_id = a.user_id
  and c.business_id = a.business_id;

-- If a customer has addresses but none marked default, first saved becomes default.
with owners as (
  select
    business_id,
    customer_id,
    user_id
  from public.customer_addresses
  group by business_id, customer_id, user_id
  having bool_or(is_default) = false
),
first_addr as (
  select distinct on (a.business_id, a.customer_id, a.user_id)
    a.id
  from public.customer_addresses a
  inner join owners o
    on a.business_id = o.business_id
   and a.customer_id is not distinct from o.customer_id
   and a.user_id is not distinct from o.user_id
  order by a.business_id, a.customer_id, a.user_id, a.created_at asc, a.id asc
)
update public.customer_addresses a
set is_default = true
from first_addr f
where a.id = f.id;

create or replace function public.customer_addresses_before_write()
returns trigger
language plpgsql
as $$
declare
  address_count integer;
begin
  new.updated_at = now();

  if tg_op = 'INSERT' then
    if new.customer_id is not null then
      select count(*) into address_count
      from public.customer_addresses
      where customer_id = new.customer_id;
      if address_count >= 3 then
        raise exception 'You can save up to 3 addresses.';
      end if;
      if address_count = 0 then
        new.is_default = true;
      end if;
    elsif new.user_id is not null then
      select count(*) into address_count
      from public.customer_addresses
      where user_id = new.user_id;
      if address_count >= 3 then
        raise exception 'You can save up to 3 addresses.';
      end if;
      if address_count = 0 then
        new.is_default = true;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.customer_addresses_sync_default()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_default then
      if old.customer_id is not null then
        update public.customer_addresses
        set is_default = true
        where id = (
          select id
          from public.customer_addresses
          where customer_id = old.customer_id
          order by created_at asc, id asc
          limit 1
        );
      elsif old.user_id is not null then
        update public.customer_addresses
        set is_default = true
        where id = (
          select id
          from public.customer_addresses
          where user_id = old.user_id
          order by created_at asc, id asc
          limit 1
        );
      end if;
    end if;
    return old;
  end if;

  if new.is_default then
    if new.customer_id is not null then
      update public.customer_addresses
      set is_default = false
      where customer_id = new.customer_id
        and id <> new.id
        and is_default;
    end if;
    if new.user_id is not null then
      update public.customer_addresses
      set is_default = false
      where user_id = new.user_id
        and id <> new.id
        and is_default;
    end if;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
