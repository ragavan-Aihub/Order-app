-- Snapshot community name on order update as well as insert, and backfill from mapped addresses.

create or replace function public.orders_snapshot_community()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  if not public.is_admin() and new.community_id is not null then
    if new.user_id is null or not exists (
      select 1
      from public.customer_addresses a
      where a.community_id = new.community_id
        and a.business_id = new.business_id
        and (
          a.user_id = new.user_id
          or (new.customer_id is not null and a.customer_id = new.customer_id)
        )
    ) then
      new.community_id := null;
    end if;
  end if;

  if new.community_id is not null then
    select c.name
      into v_name
    from public.communities c
    where c.id = new.community_id
      and c.business_id = new.business_id;
    if v_name is null then
      new.community_id := null;
      new.community_name := null;
    else
      new.community_name := v_name;
    end if;
  else
    new.community_name := null;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_snapshot_community on public.orders;
create trigger orders_snapshot_community
before insert or update on public.orders
for each row execute function public.orders_snapshot_community();

-- Existing orders placed before mapping still show Individual unless we copy the mapped address.
update public.orders o
set community_id = mapped.community_id
from (
  select
    a.business_id,
    a.community_id,
    a.customer_id,
    a.user_id,
    a.pincode,
    count(*) over (
      partition by a.business_id, coalesce(a.customer_id::text, ''), coalesce(a.user_id::text, '')
    ) as mapped_count
  from public.customer_addresses a
  where a.community_id is not null
) mapped
where o.community_id is null
  and o.business_id = mapped.business_id
  and (
    (mapped.customer_id is not null and o.customer_id = mapped.customer_id)
    or (mapped.user_id is not null and o.user_id = mapped.user_id)
  )
  and (
    o.pincode = mapped.pincode
    or mapped.mapped_count = 1
  );

notify pgrst, 'reload schema';
