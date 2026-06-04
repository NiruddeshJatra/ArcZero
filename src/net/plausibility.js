// Single source of truth: src/net/plausibility-constants.json
// Run `npm run sync-plausibility` after changing constants to update the Edge Function.
import CONSTANTS from './plausibility-constants.json';
export const PLAUSIBILITY = CONSTANTS;

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
