-- Keep product.category_id on a category owned by the same business.

create or replace function public.enforce_product_category_business()
returns trigger
language plpgsql
as $$
begin
  if new.category_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.product_categories c
    where c.id = new.category_id
      and c.business_id = new.business_id
  ) then
    raise exception 'Category does not belong to this business';
  end if;

  return new;
end;
$$;

drop trigger if exists products_category_same_business on public.products;

create trigger products_category_same_business
before insert or update of category_id, business_id
on public.products
for each row
execute function public.enforce_product_category_business();
