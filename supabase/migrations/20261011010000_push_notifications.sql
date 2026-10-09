-- Store Expo push tokens per customer; server sends on order status updates.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text check (platform in ('ios', 'android', 'web', 'unknown')),
  updated_at timestamptz not null default now(),
  constraint push_tokens_token_len check (char_length(token) >= 10),
  constraint push_tokens_user_token unique (user_id, token)
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy push_tokens_select_own
on public.push_tokens for select
to authenticated
using (user_id = auth.uid());

create policy push_tokens_insert_own
on public.push_tokens for insert
to authenticated
with check (user_id = auth.uid());

create policy push_tokens_update_own
on public.push_tokens for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy push_tokens_delete_own
on public.push_tokens for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.push_tokens to authenticated;

create or replace function public.upsert_push_token(p_token text, p_platform text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform text := nullif(trim(coalesce(p_platform, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if nullif(trim(coalesce(p_token, '')), '') is null then
    raise exception 'Push token is required';
  end if;
  insert into public.push_tokens (user_id, token, platform, updated_at)
  values (
    auth.uid(),
    trim(p_token),
    case
      when v_platform in ('ios', 'android', 'web') then v_platform
      else 'unknown'
    end,
    now()
  )
  on conflict (user_id, token) do update
  set platform = excluded.platform,
      updated_at = now();
end;
$$;

revoke all on function public.upsert_push_token(text, text) from public;
grant execute on function public.upsert_push_token(text, text) to authenticated;
