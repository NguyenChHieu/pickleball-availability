create table if not exists public.availability_cache (
  venue_id text primary key,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.availability_cache enable row level security;
