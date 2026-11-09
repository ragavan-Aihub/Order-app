-- Price every insert unless the caller already priced the line (modify-order).
create or replace function public.apply_order_item_selling_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_product public.products;
  v_pack public.product_pack_options;
  v_type text;
  v_per_kg numeric(10, 2);
begin
  if coalesce(current_setting('app.order_items_priced', true), '') = 'on' then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if v_order.id is null then
    return new;
  end if;

  select * into v_product
  from public.products
  where id = new.product_id
    and business_id = v_order.business_id
    and available = true
    and active = true;

  if v_product.id is null then
    raise exception 'Some items are no longer available. Refresh and try again.';
  end if;

  v_type := coalesce(v_product.selling_type, 'quantity');
  new.product_name := v_product.name;
  new.selling_type := v_type;
  new.created_at := coalesce(new.created_at, now());

  if v_type = 'kg' then
    if new.weight_grams is null or new.weight_grams < 1 then
      raise exception 'Enter a weight greater than 0 Kg.';
    end if;
    if v_product.minimum_weight_grams is not null
      and new.weight_grams < v_product.minimum_weight_grams then
      raise exception 'Weight is below the minimum for this product.';
    end if;
    if v_product.maximum_weight_grams is not null
      and new.weight_grams > v_product.maximum_weight_grams then
      raise exception 'Weight is above the maximum for this product.';
    end if;
    v_per_kg := coalesce(v_product.price_per_kg, v_product.price);
    new.quantity := 1;
    new.product_price := v_per_kg;
    new.selling_unit := 'Kg';
    new.pack_option_id := null;
    new.pack_weight_grams := null;
    new.subtotal := round(v_per_kg * (new.weight_grams::numeric / 1000), 2);
    return new;
  end if;

  if v_type = 'fixed_pack' then
    if new.quantity is null or new.quantity < 1 or new.quantity > 10 then
      raise exception 'Check item quantities.';
    end if;
    select * into v_pack
    from public.product_pack_options
    where id = new.pack_option_id
      and product_id = v_product.id
      and is_active = true;
    if v_pack.id is null then
      raise exception 'Choose a pack size.';
    end if;
    new.product_price := v_pack.selling_price;
    new.selling_unit := 'pack';
    new.pack_weight_grams := v_pack.weight_grams;
    new.weight_grams := null;
    new.subtotal := round(v_pack.selling_price * new.quantity, 2);
    return new;
  end if;

  if new.quantity is null or new.quantity < 1 or new.quantity > 10 then
    raise exception 'Check item quantities.';
  end if;
  new.product_price := v_product.price;
  new.selling_unit := nullif(trim(coalesce(v_product.selling_unit, '')), '');
  new.pack_option_id := null;
  new.pack_weight_grams := null;
  new.weight_grams := null;
  new.subtotal := round(v_product.price * new.quantity, 2);
  return new;
end;
$$;
