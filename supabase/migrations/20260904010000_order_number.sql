-- Human-readable 6-digit order numbers per business (100001–999999).
-- UUID remains the primary key; this is what customers and the kitchen see.

create table public.order_counters (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  last_number integer not null default 100000
    check (last_number >= 100000 and last_number < 1000000)
);

alter table public.order_counters enable row level security;

alter table public.orders
  add column order_number integer;

with numbered as (
  select
    id,
    100000 + row_number() over (partition by business_id order by created_at, id) as n
  from public.orders
)
update public.orders o
set order_number = numbered.n
from numbered
where o.id = numbered.id;

insert into public.order_counters (business_id, last_number)
select business_id, max(order_number)
from public.orders
where order_number is not null
group by business_id
on conflict (business_id) do update
set last_number = excluded.last_number;

alter table public.orders
  alter column order_number set not null;

alter table public.orders
  add constraint orders_order_number_range
  check (order_number >= 100001 and order_number <= 999999);

create unique index orders_business_order_number_idx
  on public.orders (business_id, order_number);

create or replace function public.assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  insert into public.order_counters (business_id, last_number)
  values (new.business_id, 100001)
  on conflict (business_id) do update
    set last_number = public.order_counters.last_number + 1
  returning last_number into next_number;

  if next_number > 999999 then
    raise exception 'Order numbers are full for this business.';
  end if;

  new.order_number := next_number;
  return new;
end;
$$;

create trigger orders_assign_order_number
before insert on public.orders
for each row
execute function public.assign_order_number();

notify pgrst, 'reload schema';
