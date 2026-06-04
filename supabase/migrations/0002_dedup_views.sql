-- Migration: 0002_dedup_views.sql
-- Purpose: Deduplicate online leaderboard views to one row per player.
--
-- Problem: leaderboard_daily and leaderboard_alltime previously ranked every
-- row in scores, so a player with N submissions appeared N times. This crowded
-- the top-100 with repeat entries, made rank numbers meaningless, and caused
-- the submit_score Edge Function's .maybeSingle() rank lookup to receive a
-- PGRST116 (multiple-rows) error and return null, showing "#?" in the game-over
-- modal instead of a real rank.
--
-- Fix: Replace both views with CTE + DISTINCT ON variants that surface exactly
-- one row per player (per day for daily, ever for all-time). The row chosen is
-- the player's best-scoring run for the period; tie-break by earliest played_at
-- so the first player to reach a score keeps the better rank.
--
-- The base scores table is NOT touched. All history is preserved for the local
-- board, future v2 anti-cheat/replay validation, and analytics.
--
-- How to apply: open the Supabase SQL editor for your project, paste this file,
-- and click Run. The statements are idempotent (CREATE OR REPLACE VIEW).

-- ── leaderboard_daily ────────────────────────────────────────────────────────
create or replace view public.leaderboard_daily as
  with best_per_player_day as (
    select distinct on (player_id, day_key)
      player_id, handle, score, device, day_key, played_at
    from public.scores
    order by player_id, day_key, score desc, played_at asc
  )
  select
    row_number() over (partition by day_key order by score desc, played_at asc) as rank,
    player_id, handle, score, device, day_key, played_at
  from best_per_player_day;

-- ── leaderboard_alltime ───────────────────────────────────────────────────────
create or replace view public.leaderboard_alltime as
  with best_per_player as (
    select distinct on (player_id)
      player_id, handle, score, device, played_at
    from public.scores
    order by player_id, score desc, played_at asc
  )
  select
    row_number() over (order by score desc, played_at asc) as rank,
    player_id, handle, score, device, played_at
  from best_per_player;

-- Re-state grants (CREATE OR REPLACE VIEW preserves existing grants, but being
-- explicit is defensive against any future DROP + recreate path).
grant select on public.leaderboard_daily   to anon, authenticated;
grant select on public.leaderboard_alltime to anon, authenticated;
