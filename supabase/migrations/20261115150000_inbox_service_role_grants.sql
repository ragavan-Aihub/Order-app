-- Admin server sends Expo alerts for important messages using the service role key.
grant select, update on public.inbox_broadcasts to service_role;
grant select on public.customer_inbox to service_role;
