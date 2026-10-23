-- send-product-available-push reads products with the service role key (same pattern as orders push).

grant select on public.products to service_role;

notify pgrst, 'reload schema';
