-- Shop Profile can save a colour launcher icon and a white notification glyph.

alter table public.businesses
  add column if not exists app_icon_url text;

alter table public.businesses
  add column if not exists notification_icon_url text;
