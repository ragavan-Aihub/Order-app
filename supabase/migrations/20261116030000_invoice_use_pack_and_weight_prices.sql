-- Invoice replace was using products.price (often 0 for pack items) and dropping
-- pack/weight/volume, so billed amount became ₹0. Keep option fields and price packs/kg/L.

update public.products p
set price = pack.lowest
from (
  select product_id, min(selling_price) as lowest
  from public.product_pack_options
  where is_active = true
  group by product_id
) pack
where p.id = pack.product_id
  and p.selling_type = 'fixed_pack'
  and (p.price is null or p.price = 0)
  and pack.lowest > 0;

create or replace function public.order_items_snapshot(p_order_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', i.product_id,
        'product_name', i.product_name,
        'product_price', i.product_price,
        'quantity', i.quantity,
        'subtotal', i.subtotal,
        'selling_type', i.selling_type,
        'selling_unit', i.selling_unit,
        'pack_option_id', i.pack_option_id,
        'pack_weight_grams', i.pack_weight_grams,
        'weight_grams', i.weight_grams,
        'volume_ml', i.volume_ml
      )
      order by i.created_at, i.id
    ),
    '[]'::jsonb
  )
  from public.order_items i
  where i.order_id = p_order_id;
$$;

create or replace function public.order_lines_from_request(
  p_business_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_relaxed boolean default false
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  lines jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Items are required.';
  end if;

  with wanted as (
    select
      t.ord,
      nullif(t.item->>'product_id', '')::uuid as product_id,
      trim(t.item->>'product_name') as product_name,
      round((t.item->>'quantity')::numeric, 2) as quantity
    from jsonb_array_elements(p_items) with ordinality as t(item, ord)
  ),
  previous as (
    select distinct on (coalesce(i.product_id::text, i.product_name))
      i.product_id,
      i.product_name,
      i.product_price,
      i.pack_option_id,
      i.weight_grams,
      i.volume_ml,
      i.selling_type
    from public.order_items i
    where i.order_id = p_order_id
    order by coalesce(i.product_id::text, i.product_name), i.created_at desc
  ),
  first_placed as (
    select m.previous_items
    from public.order_modifications m
    where m.order_id = p_order_id
    order by m.created_at asc
    limit 1
  ),
  placed as (
    select
      nullif(elem->>'product_id', '')::uuid as product_id,
      elem->>'product_name' as product_name,
      (elem->>'product_price')::numeric as product_price,
      nullif(elem->>'pack_option_id', '')::uuid as pack_option_id,
      nullif(elem->>'weight_grams', '')::integer as weight_grams,
      nullif(elem->>'volume_ml', '')::integer as volume_ml,
      elem->>'selling_type' as selling_type
    from first_placed fp
    cross join lateral jsonb_array_elements(fp.previous_items) as elem
  ),
  priced as (
    select
      w.ord,
      w.quantity,
      coalesce(p.id, prev.product_id, pl.product_id) as product_id,
      coalesce(p.name, prev.product_name, pl.product_name, w.product_name) as product_name,
      coalesce(p.selling_type, prev.selling_type, pl.selling_type, 'quantity') as selling_type,
      case coalesce(p.selling_type, prev.selling_type, pl.selling_type, 'quantity')
        when 'fixed_pack' then coalesce(pack.id, prev.pack_option_id, pl.pack_option_id)
        else null
      end as pack_option_id,
      case coalesce(p.selling_type, prev.selling_type, pl.selling_type, 'quantity')
        when 'fixed_pack' then coalesce(pack.weight_grams, prev_pack.weight_grams)
        else null
      end as pack_weight_grams,
      case coalesce(p.selling_type, prev.selling_type, pl.selling_type, 'quantity')
        when 'kg' then coalesce(wt.weight_grams, prev.weight_grams, pl.weight_grams)
        else null
      end as weight_grams,
      case coalesce(p.selling_type, prev.selling_type, pl.selling_type, 'quantity')
        when 'liter' then coalesce(vol.volume_ml, prev.volume_ml, pl.volume_ml)
        else null
      end as volume_ml,
      case coalesce(p.selling_type, prev.selling_type, pl.selling_type, 'quantity')
        when 'kg' then coalesce(p.price_per_kg, p.price, prev.product_price, case when p_relaxed then pl.product_price else null end)
        when 'liter' then coalesce(p.price_per_liter, p.price, prev.product_price, case when p_relaxed then pl.product_price else null end)
        when 'fixed_pack' then coalesce(pack.selling_price, prev.product_price, case when p_relaxed then pl.product_price else null end, p.price)
        else coalesce(p.price, prev.product_price, case when p_relaxed then pl.product_price else null end)
      end as product_price
    from wanted w
    left join public.products p
      on p.id = w.product_id
      and p.business_id = p_business_id
      and (p_relaxed or (p.available = true and p.active = true))
    left join lateral (
      select pr.product_id, pr.product_name, pr.product_price, pr.pack_option_id, pr.weight_grams, pr.volume_ml, pr.selling_type
      from previous pr
      where (w.product_id is not null and pr.product_id = w.product_id)
        or (pr.product_id is null and w.product_name is not null and pr.product_name = w.product_name)
      order by (pr.product_id is not null) desc
      limit 1
    ) prev on true
    left join lateral (
      select pl.product_id, pl.product_name, pl.product_price, pl.pack_option_id, pl.weight_grams, pl.volume_ml, pl.selling_type
      from placed pl
      where p_relaxed
        and (
          (w.product_id is not null and pl.product_id = w.product_id)
          or (pl.product_id is null and w.product_name is not null and pl.product_name = w.product_name)
        )
      limit 1
    ) pl on true
    left join lateral (
      select po.id, po.selling_price, po.weight_grams
      from public.product_pack_options po
      where po.product_id = coalesce(p.id, prev.product_id, pl.product_id)
        and po.is_active = true
      order by
        case
          when po.id = coalesce(prev.pack_option_id, pl.pack_option_id) then 0
          else 1
        end,
        po.display_order,
        po.weight_grams
      limit 1
    ) pack on coalesce(p.selling_type, prev.selling_type, pl.selling_type, 'quantity') = 'fixed_pack'
    left join public.product_pack_options prev_pack
      on prev_pack.id = coalesce(prev.pack_option_id, pl.pack_option_id)
    left join lateral (
      select wo.weight_grams
      from public.product_weight_options wo
      where wo.product_id = coalesce(p.id, prev.product_id, pl.product_id)
        and wo.is_active = true
      order by
        case
          when wo.weight_grams = coalesce(prev.weight_grams, pl.weight_grams) then 0
          else 1
        end,
        wo.display_order,
        wo.weight_grams
      limit 1
    ) wt on coalesce(p.selling_type, prev.selling_type, pl.selling_type, 'quantity') = 'kg'
    left join lateral (
      select vo.volume_ml
      from public.product_volume_options vo
      where vo.product_id = coalesce(p.id, prev.product_id, pl.product_id)
        and vo.is_active = true
      order by
        case
          when vo.volume_ml = coalesce(prev.volume_ml, pl.volume_ml) then 0
          else 1
        end,
        vo.display_order,
        vo.volume_ml
      limit 1
    ) vol on coalesce(p.selling_type, prev.selling_type, pl.selling_type, 'quantity') = 'liter'
  )
  select jsonb_agg(
    jsonb_build_object(
      'product_id', product_id,
      'product_name', product_name,
      'product_price', product_price,
      'quantity', quantity,
      'selling_type', selling_type,
      'selling_unit', case selling_type
        when 'kg' then 'Kg'
        when 'liter' then 'L'
        when 'fixed_pack' then 'pack'
        else null
      end,
      'pack_option_id', pack_option_id,
      'pack_weight_grams', pack_weight_grams,
      'weight_grams', weight_grams,
      'volume_ml', volume_ml,
      'subtotal', round(
        case selling_type
          when 'kg' then coalesce(product_price, 0) * (coalesce(weight_grams, 0)::numeric / 1000) * quantity
          when 'liter' then coalesce(product_price, 0) * (coalesce(volume_ml, 0)::numeric / 1000) * quantity
          else coalesce(product_price, 0) * quantity
        end,
        2
      )
    )
    order by ord
  )
  into lines
  from priced;

  if lines is null then
    raise exception 'Add at least one item.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(lines) as line
    where line->>'product_price' is null
      or nullif(trim(line->>'product_name'), '') is null
  ) then
    raise exception 'Some items are no longer available. Refresh and try again.';
  end if;

  return lines;
end;
$$;

create or replace function public.order_apply_priced_lines(p_order_id uuid, p_lines jsonb)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  total numeric(10, 2);
begin
  delete from public.order_items where order_id = p_order_id;

  perform set_config('app.order_items_priced', 'on', true);

  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    product_price,
    quantity,
    subtotal,
    selling_type,
    selling_unit,
    pack_option_id,
    pack_weight_grams,
    weight_grams,
    volume_ml
  )
  select
    p_order_id,
    nullif(line->>'product_id', '')::uuid,
    line->>'product_name',
    (line->>'product_price')::numeric,
    round((line->>'quantity')::numeric, 2),
    round(
      coalesce(
        nullif(line->>'subtotal', '')::numeric,
        case line->>'selling_type'
          when 'kg' then
            (line->>'product_price')::numeric
            * (coalesce(nullif(line->>'weight_grams', '')::numeric, 0) / 1000)
            * (line->>'quantity')::numeric
          when 'liter' then
            (line->>'product_price')::numeric
            * (coalesce(nullif(line->>'volume_ml', '')::numeric, 0) / 1000)
            * (line->>'quantity')::numeric
          else (line->>'product_price')::numeric * (line->>'quantity')::numeric
        end
      ),
      2
    ),
    nullif(line->>'selling_type', ''),
    nullif(line->>'selling_unit', ''),
    nullif(line->>'pack_option_id', '')::uuid,
    nullif(line->>'pack_weight_grams', '')::integer,
    nullif(line->>'weight_grams', '')::integer,
    nullif(line->>'volume_ml', '')::integer
  from jsonb_array_elements(p_lines) as line;

  perform set_config('app.order_items_priced', 'off', true);

  select coalesce(sum(subtotal), 0) into total from public.order_items where order_id = p_order_id;
  return total;
end;
$$;

notify pgrst, 'reload schema';
