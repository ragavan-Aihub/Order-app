update public.orders
set status = 'confirmed'
where status = 'preparing';

do $$
declare
  constraint_name name;
begin
  alter table public.orders drop constraint if exists orders_status_check;
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'orders'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ~* 'status'
      and pg_get_constraintdef(con.oid) ~* 'new'
  loop
    execute format('alter table public.orders drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.orders
  add constraint orders_status_check check (
    status in (
      'new',
      'confirmed',
      'out_for_delivery',
      'delivered',
      'cancelled'
    )
  );
