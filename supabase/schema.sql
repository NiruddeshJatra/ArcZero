-- ArcZero leaderboard v1
-- Run this in the Supabase SQL editor after creating your project.
-- See supabase/README.md for full setup steps.

create extension if not exists "pgcrypto";

create table public.scores (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null,
  handle        text not null check (char_length(handle) between 1 and 20),
  score         integer not null check (score >= 0),
  device        text not null check (device in ('mobile','desktop')),
  duration_ms   integer not null check (duration_ms >= 0),
  seed          text not null,
  day_key       text not null,   -- 'YYYY-MM-DD' in UTC+6, denormalized for cheap daily queries
  game_version  text not null default 'v1',
  played_at     timestamptz not null default now()
);

create index scores_day_score  on public.scores (day_key, score desc);
create index scores_score_desc on public.scores (score desc);

alter table public.scores enable row level security;

-- Inserts go ONLY through the submit_score Edge Function (service_role bypasses RLS).
-- anon role can only SELECT through the views defined below.
create policy "no direct anon insert" on public.scores
  for insert to anon
  with check (false);

create policy "no anon update" on public.scores
  for update to anon
  using (false);

create policy "no anon delete" on public.scores
  for delete to anon
  using (false);

-- ── Views ────────────────────────────────────────────────────────────────────
-- Expose only ranked rows; no PII beyond handle + device.

create or replace view public.leaderboard_daily as
  select
    row_number() over (partition by day_key order by score desc, played_at asc) as rank,
    player_id, handle, score, device, day_key, played_at
  from public.scores;

create or replace view public.leaderboard_alltime as
  select
    row_number() over (order by score desc, played_at asc) as rank,
    player_id, handle, score, device, played_at
  from public.scores;

grant select on public.leaderboard_daily   to anon;
grant select on public.leaderboard_alltime to anon;
