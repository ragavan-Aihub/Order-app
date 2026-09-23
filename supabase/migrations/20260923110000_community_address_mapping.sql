-- Allow each saved delivery address to belong to a different community.
drop trigger if exists customer_addresses_one_community on public.customer_addresses;
drop function if exists public.customer_addresses_one_community();
