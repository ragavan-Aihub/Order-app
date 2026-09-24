-- Optional Communities feature flag per business. Off until an admin enables it.
alter table public.businesses
  add column if not exists communities_enabled boolean not null default false;

update public.businesses b
set communities_enabled = true
where exists (
  select 1 from public.communities c where c.business_id = b.id
);

notify pgrst, 'reload schema';
