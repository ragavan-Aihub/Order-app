-- Doorstep outcomes: delivered vs not delivered (reschedule or cancel). Status stays OFD on retry.

create table if not exists public.delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  outcome text not null check (outcome in ('delivered', 'not_delivered')),
  reason_code text,
  reason_text text not null,
  next_action text not null check (next_action in ('complete', 'reschedule', 'cancel')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists delivery_attempts_order_created_idx
  on public.delivery_attempts (order_id, created_at desc);

alter table public.delivery_attempts enable row level security;

drop policy if exists delivery_attempts_admin_all on public.delivery_attempts;
create policy delivery_attempts_admin_all
on public.delivery_attempts for all
to authenticated
using (business_id = public.current_admin_business_id())
with check (business_id = public.current_admin_business_id());

grant select, insert on public.delivery_attempts to authenticated;

comment on table public.delivery_attempts is
  'Rider doorstep result. Reschedule keeps the order out for delivery; cancel sets orders.status.';
