import { describe, it, expect } from 'vitest';
import { checkPlausibility, PLAUSIBILITY } from '../src/net/plausibility.js';

describe('checkPlausibility', () => {
  const goodParams = { score: 1000, duration_ms: 60_000 };

  it('accepts a normal run', () => {
    expect(checkPlausibility(goodParams)).toEqual({ ok: true });
  });

  // ── score boundary tests ────────────────────────────────────────────────────

  it('accepts score = 0', () => {
    expect(checkPlausibility({ score: 0, duration_ms: 60_000 })).toEqual({ ok: true });
  });

  it('rejects score < 0', () => {
    const r = checkPlausibility({ score: -1, duration_ms: 60_000 });
    expect(r).toEqual({ ok: false, reason: 'implausible_score' });
  });

  it('accepts score = ABSOLUTE_CEILING', () => {
    // duration must satisfy the rate check: score / (duration_ms / 1000) <= MAX_SCORE_PER_SEC
    const minDuration = (PLAUSIBILITY.ABSOLUTE_CEILING / PLAUSIBILITY.MAX_SCORE_PER_SEC) * 1000;
    expect(checkPlausibility({ score: PLAUSIBILITY.ABSOLUTE_CEILING, duration_ms: minDuration })).toEqual({ ok: true });
  });

  it('rejects score > ABSOLUTE_CEILING', () => {
    const minDuration = ((PLAUSIBILITY.ABSOLUTE_CEILING + 1) / PLAUSIBILITY.MAX_SCORE_PER_SEC) * 1000;
    const r = checkPlausibility({ score: PLAUSIBILITY.ABSOLUTE_CEILING + 1, duration_ms: minDuration });
    expect(r).toEqual({ ok: false, reason: 'implausible_score' });
  });

  it('rejects non-integer score', () => {
    const r = checkPlausibility({ score: 1000.5, duration_ms: 60_000 });
    expect(r).toEqual({ ok: false, reason: 'implausible_score' });
  });

  // ── duration boundary tests ─────────────────────────────────────────────────

  it('accepts duration_ms = MIN_DURATION_MS', () => {
    expect(checkPlausibility({ score: 10, duration_ms: PLAUSIBILITY.MIN_DURATION_MS })).toEqual({ ok: true });
  });

  it('rejects duration_ms < MIN_DURATION_MS', () => {
    const r = checkPlausibility({ score: 10, duration_ms: PLAUSIBILITY.MIN_DURATION_MS - 1 });
    expect(r).toEqual({ ok: false, reason: 'implausible_duration' });
  });

  it('rejects duration_ms = 0', () => {
    const r = checkPlausibility({ score: 0, duration_ms: 0 });
    expect(r).toEqual({ ok: false, reason: 'implausible_duration' });
  });

  it('rejects non-integer duration_ms', () => {
    const r = checkPlausibility({ score: 10, duration_ms: 5000.9 });
    expect(r).toEqual({ ok: false, reason: 'implausible_duration' });
  });

  // ── score-per-second rate tests ─────────────────────────────────────────────

  it('rejects score/sec just above MAX_SCORE_PER_SEC', () => {
    // Just above the rate limit
    const score = (PLAUSIBILITY.MAX_SCORE_PER_SEC + 1) * 10; // 10 seconds worth
    const r = checkPlausibility({ score, duration_ms: 10_000 });
    expect(r).toEqual({ ok: false, reason: 'implausible_score' });
  });

  it('accepts score/sec at exactly MAX_SCORE_PER_SEC', () => {
    const score = PLAUSIBILITY.MAX_SCORE_PER_SEC * 10; // 10 seconds at cap
    expect(checkPlausibility({ score, duration_ms: 10_000 })).toEqual({ ok: true });
  });

  it('accepts a large score over a very long run', () => {
    // 10k score over 1000 seconds = 10 pts/sec (under MAX_SCORE_PER_SEC)
    expect(checkPlausibility({ score: 10_000, duration_ms: 1_000_000 })).toEqual({ ok: true });
  });
});
