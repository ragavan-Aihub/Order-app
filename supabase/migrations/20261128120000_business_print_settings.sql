-- Shop print preferences for admin receipts (A4 / thermal).
alter table public.businesses
  add column if not exists print_settings jsonb not null default '{}'::jsonb;

comment on column public.businesses.print_settings is
  'Admin receipt print prefs: defaultFormat, afterInvoiceSave, thermalWidthMm, and section field toggles (shop/customer/items/payment). Empty object uses app defaults.';
