-- Run this in the SQL Editor if confirmation shows "undefined".
-- The order_number column exists; the API cache has not picked it up yet.

notify pgrst, 'reload schema';
