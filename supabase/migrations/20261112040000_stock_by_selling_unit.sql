-- Kg/Liter stock is remaining grams/ml. Quantity and packs stay piece counts.
-- 1 Kg of stock allows ten 100 g lines.

create or replace function public.order_line_stock_units(
  p_product_id uuid,
  p_quantity integer,
  p_weight_grams integer,
  p_volume_ml integer
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text;
  v_qty integer;
begin
  v_qty := greatest(coalesce(p_quantity, 0), 0);
  if p_product_id is null or v_qty = 0 then
    return 0;
  end if;

  select selling_type into v_type from public.products where id = p_product_id;
  if v_type = 'kg' then
    return v_qty * greatest(coalesce(p_weight_grams, 0), 0);
  end if;
  if v_type = 'liter' then
    return v_qty * greatest(coalesce(p_volume_ml, 0), 0);
  end if;
  return v_qty;
end;
$$;

create or replace function public.product_adjust_stock(p_product_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_next integer;
  v_type text;
begin
  if p_product_id is null or p_delta = 0 then
    return;
  end if;

  select stock_qty, selling_type
    into v_stock, v_type
  from public.products
  where id = p_product_id
  for update;

  if not found or v_stock is null then
    return;
  end if;

  v_next := v_stock + p_delta;
  if v_next < 0 then
    if v_type = 'kg' then
      if v_stock >= 1000 and v_stock % 1000 = 0 then
        raise exception 'Only % Kg left of this item.', v_stock / 1000;
      end if;
      raise exception 'Only %g left of this item.', v_stock;
    elsif v_type = 'liter' then
      if v_stock >= 1000 and v_stock % 1000 = 0 then
        raise exception 'Only % L left of this item.', v_stock / 1000;
      end if;
      raise exception 'Only %ml left of this item.', v_stock;
    else
      raise exception 'Only % left of this item.', v_stock;
    end if;
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
  v_old integer;
  v_new integer;
begin
  if tg_op = 'INSERT' then
    select status into v_status from public.orders where id = new.order_id;
    if v_status is distinct from 'cancelled' then
      perform public.product_adjust_stock(
        new.product_id,
        -public.order_line_stock_units(new.product_id, new.quantity, new.weight_grams, new.volume_ml)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    select status into v_status from public.orders where id = new.order_id;
    if v_status is distinct from 'cancelled' then
      v_old := public.order_line_stock_units(old.product_id, old.quantity, old.weight_grams, old.volume_ml);
      v_new := public.order_line_stock_units(new.product_id, new.quantity, new.weight_grams, new.volume_ml);
      if old.product_id is not distinct from new.product_id then
        if v_new is distinct from v_old then
          perform public.product_adjust_stock(new.product_id, -(v_new - v_old));
        end if;
      else
        perform public.product_adjust_stock(old.product_id, v_old);
        perform public.product_adjust_stock(new.product_id, -v_new);
      end if;
    end if;
    return new;
  end if;

  select status into v_status from public.orders where id = old.order_id;
  if v_status is distinct from 'cancelled' then
    perform public.product_adjust_stock(
      old.product_id,
      public.order_line_stock_units(old.product_id, old.quantity, old.weight_grams, old.volume_ml)
    );
  end if;
  return old;
end;
$$;

create or replace function public.orders_release_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_units integer;
begin
  if old.status is distinct from 'cancelled' and new.status = 'cancelled' then
    for rec in
      select product_id, quantity, weight_grams, volume_ml
      from public.order_items
      where order_id = new.id
    loop
      v_units := public.order_line_stock_units(rec.product_id, rec.quantity, rec.weight_grams, rec.volume_ml);
      perform public.product_adjust_stock(rec.product_id, v_units);
    end loop;
  elsif old.status = 'cancelled' and new.status is distinct from 'cancelled' then
    for rec in
      select product_id, quantity, weight_grams, volume_ml
      from public.order_items
      where order_id = new.id
    loop
      v_units := public.order_line_stock_units(rec.product_id, rec.quantity, rec.weight_grams, rec.volume_ml);
      perform public.product_adjust_stock(rec.product_id, -v_units);
    end loop;
  end if;
  return new;
end;
$$;

comment on column public.products.stock_qty is
  'Remaining stock. Kg products: grams. Liter products: ml. Quantity and packs: piece count. Null means no limit.';

revoke all on function public.order_line_stock_units(uuid, integer, integer, integer) from public, anon;
grant execute on function public.order_line_stock_units(uuid, integer, integer, integer) to authenticated;
