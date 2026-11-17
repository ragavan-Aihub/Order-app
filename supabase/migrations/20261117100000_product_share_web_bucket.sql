insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-share-web',
  'product-share-web',
  true,
  1048576,
  array['text/html']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = array['text/html'];

drop policy if exists product_share_web_public_read on storage.objects;

create policy product_share_web_public_read
on storage.objects for select
to public
using (bucket_id = 'product-share-web');
