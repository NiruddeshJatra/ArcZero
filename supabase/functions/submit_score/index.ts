import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Plausibility constants ────────────────────────────────────────────────────
// Tune these once real run data is available; defaults are generous to avoid
// rejecting legitimate runs. Mirror logic lives in src/net/plausibility.js.
const ABSOLUTE_CEILING   = 1_000_00;
const MIN_DURATION_MS    = 5_00;
const MAX_SCORE_PER_SEC  = 50;
const MAX_RUN_DURATION_MS = 30 * 60 * 1000; // 30 minutes

type Reason =
  | 'bad_token'
  | 'expired_token'
  | 'device_mismatch'
  | 'implausible_score'
  | 'implausible_duration'
  | 'bad_handle'
  | 'server_error';

function reject(reason: Reason, status = 400) {
  return new Response(JSON.stringify({ accepted: false, reason }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── HMAC helpers (mirrors start_run) ─────────────────────────────────────────
function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function hmacVerify(data: string, sig: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = base64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  return expected === sig;
}

function base64urlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + (4 - s.length % 4) % 4, '=');
  return atob(padded);
}

// ── Day key in UTC+6 (Bangladesh standard time) ───────────────────────────────
function dayKeyUTC6(nowMs: number): string {
  const d = new Date(nowMs + 6 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// ── Handle validation ─────────────────────────────────────────────────────────
// eslint-disable-next-line no-control-regex
const BAD_HANDLE_RE = /[\x00-\x1f\x7f\n\r]/;
function validateHandle(h: unknown): h is string {
  if (typeof h !== 'string') return false;
  if (h.length < 1 || h.length > 20) return false;
  if (BAD_HANDLE_RE.test(h)) return false;
  return true;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  const secret = Deno.env.get('RUN_TOKEN_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!secret || !supabaseUrl || !serviceKey) {
    return reject('server_error', 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reject('bad_token');
  }

  const { token, score, duration_ms, device, handle, seed } = body as Record<string, unknown>;

  // ── Token verification ──────────────────────────────────────────────────────
  if (typeof token !== 'string' || !token.includes('.')) return reject('bad_token');

  const dotIdx = token.lastIndexOf('.');
  const payloadB64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64urlDecode(payloadB64));
  } catch {
    return reject('bad_token');
  }

  const valid = await hmacVerify(payloadB64, sig, secret);
  if (!valid) return reject('bad_token');

  const now = Date.now();
  if (typeof payload.issued_at !== 'number' || now - payload.issued_at > MAX_RUN_DURATION_MS) {
    return reject('expired_token');
  }

  // ── Device consistency ──────────────────────────────────────────────────────
  if (payload.device !== device) return reject('device_mismatch');

  // ── Plausibility ────────────────────────────────────────────────────────────
  const sc = Number(score);
  const dur = Number(duration_ms);

  if (!Number.isInteger(sc) || sc < 0 || sc > ABSOLUTE_CEILING) return reject('implausible_score');
  if (!Number.isInteger(dur) || dur < MIN_DURATION_MS) return reject('implausible_duration');
  if (sc / (dur / 1000) > MAX_SCORE_PER_SEC) return reject('implausible_score');

  // ── Handle validation ───────────────────────────────────────────────────────
  if (!validateHandle(handle)) return reject('bad_handle');

  // ── Insert via service_role (bypasses RLS) ──────────────────────────────────
  const supabase = createClient(supabaseUrl, serviceKey);
  const playerId = String(payload.player_id ?? '');
  const dk = dayKeyUTC6(now);

  const { error: insertError } = await supabase.from('scores').insert({
    player_id: playerId,
    handle: handle as string,
    score: sc,
    device: String(device),
    duration_ms: dur,
    seed: String(seed ?? payload.seed ?? ''),
    day_key: dk,
    game_version: 'v1',
  });

  if (insertError) {
    return reject('server_error', 500);
  }

  // ── Rank lookup ─────────────────────────────────────────────────────────────
  const [dailyRes, allTimeRes] = await Promise.all([
    supabase
      .from('leaderboard_daily')
      .select('rank')
      .eq('day_key', dk)
      .eq('player_id', playerId)
      .order('rank', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('leaderboard_alltime')
      .select('rank')
      .eq('player_id', playerId)
      .order('rank', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return new Response(
    JSON.stringify({
      accepted: true,
      rank_daily: dailyRes.data?.rank ?? null,
      rank_alltime: allTimeRes.data?.rank ?? null,
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
