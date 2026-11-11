-- Optional remaining stock per product (null = unlimited). 1 cart quantity = 1 unit.
-- Enforced on every order line so app, phone, and admin orders cannot oversell.

alter table public.products
  add column if not exists stock_qty integer;

alter table public.products
  drop constraint if exists products_stock_qty_check;
alter table public.products
  add constraint products_stock_qty_check
  check (stock_qty is null or stock_qty >= 0);

comment on column public.products.stock_qty is
  'Remaining sellable units matching cart quantity. Null means no limit.';

create or replace function public.product_adjust_stock(p_product_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_next integer;
begin
  if p_product_id is null or p_delta = 0 then
    return;
  end if;

  select stock_qty
    into v_stock
  from public.products
  where id = p_product_id
  for update;

  if not found or v_stock is null then
    return;
  end if;

  v_next := v_stock + p_delta;
  if v_next < 0 then
    raise exception 'Only % left of this item.', v_stock;
  end if;

  update public.products
  set
    stock_qty = v_next,
    available = case
      when v_next = 0 then false
      when v_stock = 0 and v_next > 0 then true
      else available
    end
  where id = p_product_id;
end;
$$;

create or replace function public.order_items_apply_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if tg_op = 'INSERT' then
    select status into v_status from public.orders where id = new.order_id;
    if v_status is distinct from 'cancelled' then
      perform public.product_adjust_stock(new.product_id, -new.quantity);
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    select status into v_status from public.orders where id = new.order_id;
    if v_status is distinct from 'cancelled' then
      if new.product_id is not distinct from old.product_id then
        if new.quantity is distinct from old.quantity then
          perform public.product_adjust_stock(new.product_id, -(new.quantity - old.quantity));
        end if;
      else
        perform public.product_adjust_stock(old.product_id, old.quantity);
        perform public.product_adjust_stock(new.product_id, -new.quantity);
      end if;
    end if;
    return new;
  end if;

  select status into v_status from public.orders where id = old.order_id;
  if v_status is distinct from 'cancelled' then
    perform public.product_adjust_stock(old.product_id, old.quantity);
  end if;
  return old;
end;
$$;

drop trigger if exists order_items_apply_stock on public.order_items;
create trigger order_items_apply_stock
after insert or update or delete on public.order_items
for each row
execute function public.order_items_apply_stock();

create or replace function public.orders_release_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  if old.status is distinct from 'cancelled' and new.status = 'cancelled' then
    for rec in
      select product_id, quantity
      from public.order_items
      where order_id = new.id
    loop
      perform public.product_adjust_stock(rec.product_id, rec.quantity);
    end loop;
  elsif old.status = 'cancelled' and new.status is distinct from 'cancelled' then
    for rec in
      select product_id, quantity
      from public.order_items
      where order_id = new.id
    loop
      perform public.product_adjust_stock(rec.product_id, -rec.quantity);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_release_stock_on_cancel on public.orders;
create trigger orders_release_stock_on_cancel
after update of status on public.orders
for each row
execute function public.orders_release_stock_on_cancel();

revoke all on function public.product_adjust_stock(uuid, integer) from public, anon;
grant execute on function public.product_adjust_stock(uuid, integer) to authenticated;
