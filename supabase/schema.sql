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
alter table public.scans add column if not exists project_name text not null default 'General';
alter table public.scans add column if not exists share_token text;
alter table public.scans add column if not exists shared_at timestamptz;
create unique index if not exists scans_share_token_unique_idx on public.scans (share_token) where share_token is not null;
create index if not exists scans_user_project_created_at_idx on public.scans (user_id, project_name, created_at desc);

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

create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_name text not null default 'free',
  monthly_scan_limit integer not null default 30 check (monthly_scan_limit > 0),
  monthly_scans_used integer not null default 0 check (monthly_scans_used >= 0),
  period_start timestamptz not null default date_trunc('month', now()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_entitlements_plan_name_idx on public.user_entitlements (plan_name);

alter table public.user_entitlements enable row level security;
drop policy if exists user_entitlements_select_own on public.user_entitlements;
drop policy if exists user_entitlements_insert_own on public.user_entitlements;
drop policy if exists user_entitlements_update_own on public.user_entitlements;

create policy user_entitlements_select_own on public.user_entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy user_entitlements_insert_own on public.user_entitlements
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy user_entitlements_update_own on public.user_entitlements
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  event_props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_user_created_at_idx on public.analytics_events (user_id, created_at desc);
create index if not exists analytics_events_name_created_at_idx on public.analytics_events (event_name, created_at desc);

alter table public.analytics_events enable row level security;
drop policy if exists analytics_events_select_own on public.analytics_events;
create policy analytics_events_select_own on public.analytics_events
  for select
  to authenticated
  using (auth.uid() = user_id);
