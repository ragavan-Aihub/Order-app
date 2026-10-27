-- Shop UPI QR (shown in delivery app and customer order detail).
alter table public.businesses
  add column if not exists upi_qr_url text;

notify pgrst, 'reload schema';
