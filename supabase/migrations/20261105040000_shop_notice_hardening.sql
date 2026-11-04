-- The closed-shop check runs as a trigger. It is not an API customers can call.

revoke all on function public.enforce_shop_open() from public, anon, authenticated;

notify pgrst, 'reload schema';
