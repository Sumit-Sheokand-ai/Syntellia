create table if not exists public.scans (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  site_name text not null,
  url text not null,
  scan_size text not null,
  login_mode text not null,
  focus_area text not null,
  page_limit integer not null check (page_limit > 0),
  status text not null check (status in ('Queued', 'Running', 'Completed', 'Failed')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  report jsonb
);
alter table public.scans add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists scans_created_at_idx on public.scans (created_at desc);
create index if not exists scans_status_idx on public.scans (status);
create index if not exists scans_user_id_idx on public.scans (user_id);
create index if not exists scans_user_created_at_idx on public.scans (user_id, created_at desc);

do $$
begin
  if not exists (select 1 from public.scans where user_id is null) then
    alter table public.scans alter column user_id set not null;
  end if;
end $$;

alter table public.scans enable row level security;

drop policy if exists scans_select_own on public.scans;
drop policy if exists scans_insert_own on public.scans;
drop policy if exists scans_update_own on public.scans;
drop policy if exists scans_delete_own on public.scans;

create policy scans_select_own on public.scans
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy scans_insert_own on public.scans
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy scans_update_own on public.scans
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy scans_delete_own on public.scans
  for delete
  to authenticated
  using (auth.uid() = user_id);
