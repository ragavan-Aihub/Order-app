-- Admin preference shown in the customer app. Enforced in the app only, not on phone orders.
-- get_business_public returns setof businesses, so this column is public.

alter table public.businesses
  add column if not exists min_order_amount numeric(12, 2) not null default 0;

alter table public.businesses
  drop constraint if exists businesses_min_order_amount_nonneg;

alter table public.businesses
  add constraint businesses_min_order_amount_nonneg check (min_order_amount >= 0);
