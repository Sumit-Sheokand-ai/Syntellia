create table if not exists public.scans (
  id text primary key,
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

create index if not exists scans_created_at_idx on public.scans (created_at desc);
create index if not exists scans_status_idx on public.scans (status);
