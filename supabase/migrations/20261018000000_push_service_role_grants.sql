-- send-order-status-push reads orders and push_tokens with the service role key.
-- Init grants only went to authenticated, so PostgREST returned "permission denied".

grant select on public.orders to service_role;
grant select on public.push_tokens to service_role;
