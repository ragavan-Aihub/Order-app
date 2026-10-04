-- City for saved addresses, filled from the pincode lookup in the admin and the customer app.
alter table public.customer_addresses
  add column if not exists city text;

notify pgrst, 'reload schema';
