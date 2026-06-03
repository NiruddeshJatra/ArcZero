// Mirror of server-side constants in supabase/functions/submit_score/index.ts — keep in sync.
export const PLAUSIBILITY = {
  ABSOLUTE_CEILING:    1_000_000,
  MIN_DURATION_MS:     5_000,
  MAX_SCORE_PER_SEC:   50,
  MAX_RUN_DURATION_MS: 30 * 60 * 1000,
};

export function checkPlausibility({ score, duration_ms }) {
  if (!Number.isInteger(score) || score < 0 || score > PLAUSIBILITY.ABSOLUTE_CEILING) {
    return { ok: false, reason: 'implausible_score' };
  }
  if (!Number.isInteger(duration_ms) || duration_ms < PLAUSIBILITY.MIN_DURATION_MS) {
    return { ok: false, reason: 'implausible_duration' };
  }
  if (score / (duration_ms / 1000) > PLAUSIBILITY.MAX_SCORE_PER_SEC) {
    return { ok: false, reason: 'implausible_score' };
  }
  return { ok: true };
}
