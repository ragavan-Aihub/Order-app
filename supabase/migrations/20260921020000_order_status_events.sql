create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists order_status_events_order_id_idx
  on public.order_status_events (order_id, created_at);

create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_events (order_id, status, note, created_at)
    values (new.id, new.status, 'Order placed', new.created_at);
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.order_status_events (order_id, status, note)
    values (
      new.id,
      new.status,
      case
        when new.status = 'cancelled' then new.cancel_reason
        else 'Updated by admin'
      end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_log_status on public.orders;
create trigger orders_log_status
after insert or update of status on public.orders
for each row execute function public.log_order_status();

insert into public.order_status_events (order_id, status, note, created_at)
select id, 'new', 'Order placed', created_at
from public.orders o
where not exists (
  select 1 from public.order_status_events e where e.order_id = o.id
);

insert into public.order_status_events (order_id, status, note, created_at)
select id, status, cancel_reason, updated_at
from public.orders o
where o.status <> 'new'
  and not exists (
    select 1 from public.order_status_events e
    where e.order_id = o.id and e.status = o.status
  );

alter table public.order_status_events enable row level security;

create policy order_status_events_admin_select
on public.order_status_events for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.business_id = public.current_admin_business_id()
  )
);

grant select on public.order_status_events to authenticated;
