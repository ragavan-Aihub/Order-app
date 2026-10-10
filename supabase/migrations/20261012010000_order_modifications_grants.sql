-- Required for admin + mobile apps to read order_modifications via PostgREST (RLS still applies).
grant select on public.order_modifications to authenticated;
