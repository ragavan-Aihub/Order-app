-- Extra order channels and customer sources used by admin manual orders.
-- Source (how the contact was acquired) stays on customers; channel (how this order arrived) stays on orders.

create or replace function public.ensure_order_channels()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_channels (id, label) values
    ('app', 'App'),
    ('api', 'Partner API'),
    ('whatsapp', 'WhatsApp'),
    ('web', 'Web'),
    ('phone', 'Phone'),
    ('direct', 'Direct'),
    ('admin', 'Admin')
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.ensure_order_channels() from public;
grant execute on function public.ensure_order_channels() to authenticated;

select public.ensure_order_channels();

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'customers'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%source%'
  loop
    execute format('alter table public.customers drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.customers
  add constraint customers_source_check
    check (source in ('app', 'whatsapp', 'walk_in', 'phone', 'web', 'other'));

notify pgrst, 'reload schema';
