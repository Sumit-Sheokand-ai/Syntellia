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
alter table public.scans add column if not exists share_token_expires_at timestamptz;
alter table public.scans add column if not exists share_revoked_at timestamptz;
alter table public.scans add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0);
alter table public.scans add column if not exists lease_expires_at timestamptz;
alter table public.scans add column if not exists next_retry_at timestamptz;
alter table public.scans add column if not exists last_error text;
alter table public.scans add column if not exists last_error_code text;
create unique index if not exists scans_share_token_unique_idx on public.scans (share_token) where share_token is not null;
create index if not exists scans_user_project_created_at_idx on public.scans (user_id, project_name, created_at desc);
create index if not exists scans_queue_ready_idx on public.scans (status, next_retry_at, lease_expires_at, created_at) where status = 'Queued';
create index if not exists scans_running_lease_idx on public.scans (status, lease_expires_at) where status = 'Running';

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

create table if not exists public.saved_history_views (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status_filter text not null check (status_filter in ('All', 'Queued', 'Running', 'Completed', 'Failed')),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_history_views_user_updated_idx on public.saved_history_views (user_id, updated_at desc, created_at desc);
create unique index if not exists saved_history_views_user_name_unique_idx on public.saved_history_views (user_id, lower(name));

alter table public.saved_history_views enable row level security;
drop policy if exists saved_history_views_select_own on public.saved_history_views;
drop policy if exists saved_history_views_insert_own on public.saved_history_views;
drop policy if exists saved_history_views_update_own on public.saved_history_views;
drop policy if exists saved_history_views_delete_own on public.saved_history_views;

create policy saved_history_views_select_own on public.saved_history_views
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy saved_history_views_insert_own on public.saved_history_views
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy saved_history_views_update_own on public.saved_history_views
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy saved_history_views_delete_own on public.saved_history_views
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

create table if not exists public.rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (bucket_key, window_start)
);
create index if not exists rate_limit_buckets_window_end_idx on public.rate_limit_buckets (window_end);

create or replace function public.take_rate_limit_token(
  p_bucket_key text,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_max_requests integer
)
returns table (
  allowed boolean,
  request_count integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_count integer;
begin
  if p_bucket_key is null or length(trim(p_bucket_key)) = 0 then
    raise exception 'p_bucket_key is required';
  end if;
  if p_max_requests is null or p_max_requests <= 0 then
    raise exception 'p_max_requests must be positive';
  end if;
  if p_window_end is null or p_window_start is null or p_window_end <= p_window_start then
    raise exception 'invalid rate-limit window range';
  end if;

  insert into public.rate_limit_buckets as bucket (
    bucket_key,
    window_start,
    window_end,
    request_count,
    updated_at
  ) values (
    p_bucket_key,
    p_window_start,
    p_window_end,
    1,
    now()
  )
  on conflict (bucket_key, window_start)
  do update
    set request_count = bucket.request_count + 1,
        updated_at = now(),
        window_end = excluded.window_end
  returning bucket.request_count into v_request_count;

  allowed := v_request_count <= p_max_requests;
  request_count := v_request_count;
  retry_after_seconds := greatest(1, ceil(extract(epoch from (p_window_end - now())))::integer);

  return next;
end;
$$;

revoke all on function public.take_rate_limit_token(text, timestamptz, timestamptz, integer) from public;
grant execute on function public.take_rate_limit_token(text, timestamptz, timestamptz, integer) to service_role;

create or replace function public.claim_next_scan(
  p_lease_seconds integer default 60
)
returns table (
  id text,
  user_id uuid,
  url text,
  scan_size text,
  login_mode text,
  focus_area text,
  created_at timestamptz,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_candidate as (
    select scan.id
    from public.scans as scan
    where scan.status = 'Queued'
      and (scan.next_retry_at is null or scan.next_retry_at <= now())
      and (scan.lease_expires_at is null or scan.lease_expires_at <= now())
    order by scan.created_at asc
    for update skip locked
    limit 1
  ),
  claimed as (
    update public.scans as scan
    set status = 'Running',
        started_at = coalesce(scan.started_at, now()),
        lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 60), 1)),
        attempt_count = coalesce(scan.attempt_count, 0) + 1,
        next_retry_at = null
    from next_candidate
    where scan.id = next_candidate.id
    returning scan.id, scan.user_id, scan.url, scan.scan_size, scan.login_mode, scan.focus_area, scan.created_at, scan.attempt_count
  )
  select * from claimed;
end;
$$;

revoke all on function public.claim_next_scan(integer) from public;
grant execute on function public.claim_next_scan(integer) to service_role;
