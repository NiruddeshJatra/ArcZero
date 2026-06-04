/* global AbortController */
import { getSupabaseClient } from './supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, DEBUG_LEADERBOARD } from './config.js';

const TIMEOUT_MS = 5000;

// UTC+6 (Bangladesh) day boundary — matches the server's day_key derivation.
function dayKeyUTC6() {
  const d = new Date(Date.now() + 6 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function edgeFetch(path, body) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    return { ok: true, data };
  } catch (error) {
    clearTimeout(timer);
    return { ok: false, error };
  }
}

async function supabaseRead(queryFn) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const result = await queryFn();
    clearTimeout(timer);
    if (result.error) return { ok: false, error: result.error };
    return { ok: true, data: result.data };
  } catch (error) {
    clearTimeout(timer);
    return { ok: false, error };
  }
}

export async function startRun({ seed, device, playerId }) {
  const result = await edgeFetch('start_run', {
    player_id: playerId,
    seed: String(seed ?? 0),
    device,
  });
  if (!result.ok) return result;
  if (result.data?.token) return { ok: true, token: result.data.token };
  return { ok: false, error: result.data?.error ?? 'no token' };
}

// Goes through the Edge Function (not a direct insert) so plausibility check is server-side.
export async function submitScore({ score, token, durationMs, device, handle, seed, playerId }) {
  const result = await edgeFetch('submit_score', {
    score,
    token,
    duration_ms: durationMs,
    device,
    handle,
    seed: String(seed ?? 0),
    player_id: playerId,
  });
  if (!result.ok) {
    if (DEBUG_LEADERBOARD) console.warn('[leaderboard] submit failed (network):', result.error); // eslint-disable-line no-console
    return result;
  }
  if (DEBUG_LEADERBOARD && result.data && !result.data.accepted) {
    console.warn('[leaderboard] submit rejected:', result.data.reason); // eslint-disable-line no-console
  }
  return { ok: true, ...result.data };
}

export async function getDailyTop(limit = 100) {
  const supabase = getSupabaseClient();
  const result = await supabaseRead(() =>
    supabase
      .from('leaderboard_daily')
      .select('rank, player_id, handle, score, device, day_key, played_at')
      .eq('day_key', dayKeyUTC6())
      .order('rank', { ascending: true })
      .limit(limit),
  );
  return result.ok ? (result.data ?? []) : [];
}

export async function getAllTimeTop(limit = 100) {
  const supabase = getSupabaseClient();
  const result = await supabaseRead(() =>
    supabase
      .from('leaderboard_alltime')
      .select('rank, player_id, handle, score, device, played_at')
      .order('rank', { ascending: true })
      .limit(limit),
  );
  return result.ok ? (result.data ?? []) : [];
}

export async function getPlayerRankToday(playerId) {
  const supabase = getSupabaseClient();
  const result = await supabaseRead(() =>
    supabase
      .from('leaderboard_daily')
      .select('rank')
      .eq('day_key', dayKeyUTC6())
      .eq('player_id', playerId)
      .order('rank', { ascending: true })
      .limit(1)
      .maybeSingle(),
  );
  return result.ok && result.data ? result.data.rank : null;
}
