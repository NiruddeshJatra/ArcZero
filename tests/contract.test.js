/**
 * CONTRACT tests — pin data shapes for runResult, save schema, and SDK payload.
 * A field added or removed from any of these surfaces will fail a test here.
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { buildRunResult } from '../src/gameLoop.js';
import { createState } from '../src/state.js';
import { loadSave, saveSave } from '../src/persistence.js';
import { buildSubmitPayload } from '../src/crazygames.js';
import { PHYSICS_VERSION } from '../src/constants.js';

beforeEach(() => localStorage.clear());

// ── buildRunResult field set ───────────────────────────────────────────────────
describe('contract — buildRunResult shape', () => {
  const EXPECTED_KEYS = [
    'score', 'levelScore', 'level', 'startLevel', 'rankingMode',
    'longestChain', 'closestMissM', 'intercepts', 'survivedS',
    'waveStats', 'seed', 'dateISO', 'criteriaCleared',
  ].sort();

  it('returns exactly 13 fields — no more, no less', () => {
    const result = buildRunResult(createState(1));
    expect(Object.keys(result).sort()).toEqual(EXPECTED_KEYS);
  });

  it('does NOT include physicsVersion — REVIEW: PHYSICS_VERSION constant (value=1) exists but buildRunResult omits it', () => {
    const result = buildRunResult(createState(1));
    expect(result).not.toHaveProperty('physicsVersion');
    // Confirm the constant itself exists:
    expect(PHYSICS_VERSION).toBe(1);
  });

  it('closestMissM is null when no near-miss occurred (Infinity → null)', () => {
    const state = createState(1);
    // Fresh state: stats.closestMissM = Infinity, runTotals.closestMissM = Infinity
    const result = buildRunResult(state);
    expect(result.closestMissM).toBeNull();
  });

  it('closestMissM is a number when a near-miss distance was recorded', () => {
    const state = createState(1);
    state.stats.closestMissM = 7.5;
    const result = buildRunResult(state);
    expect(result.closestMissM).toBe(7.5);
  });

  it('criteriaCleared defaults to false on fresh state', () => {
    const result = buildRunResult(createState(1));
    expect(result.criteriaCleared).toBe(false);
  });

  it('seed is null for non-daily mode', () => {
    const result = buildRunResult(createState(1));
    expect(result.seed).toBeNull();
  });
});

// ── DEFAULT_SAVE / loadSave shape ──────────────────────────────────────────────
describe('contract — save schema shape', () => {
  const EXPECTED_TOP_KEYS = ['schemaVersion', 'player', 'best', 'progress', 'settings', 'streak', 'daily'].sort();
  const EXPECTED_BEST_KEYS = ['allTime', 'perLevel', 'longestChain', 'closestMissM', 'totalIntercepts', 'totalSurvivedS'].sort();

  it('fresh loadSave() has exactly the expected top-level keys', () => {
    const s = loadSave();
    expect(Object.keys(s).sort()).toEqual(EXPECTED_TOP_KEYS);
  });

  it('fresh loadSave().best has exactly the expected sub-keys', () => {
    const s = loadSave();
    expect(Object.keys(s.best).sort()).toEqual(EXPECTED_BEST_KEYS);
  });

  it('fresh save has closestMissM = Infinity (default before any run)', () => {
    const s = loadSave();
    expect(s.best.closestMissM).toBe(Infinity);
  });

  it('closestMissM Infinity round-trips to null (JSON.stringify converts Infinity→null)', () => {
    const s = loadSave();
    expect(s.best.closestMissM).toBe(Infinity); // default

    saveSave(s); // stringify: Infinity → null in JSON
    const s2 = loadSave(); // re-parse: null survives deepMerge

    // Lock current behavior: Infinity becomes null after round-trip.
    // If this test fails, someone changed how closestMissM is serialised.
    expect(s2.best.closestMissM).toBeNull();
  });

  it('schemaVersion is 2', () => {
    const s = loadSave();
    expect(s.schemaVersion).toBe(2);
  });
});

// ── SDK submit payload shape ───────────────────────────────────────────────────
describe('contract — CrazyGames SDK payload', () => {
  it('buildSubmitPayload returns {encryptedScore, score} with exactly those 2 keys', () => {
    const payload = buildSubmitPayload('enc_abc123', 500);
    expect(Object.keys(payload).sort()).toEqual(['encryptedScore', 'score'].sort());
    expect(payload.encryptedScore).toBe('enc_abc123');
    expect(payload.score).toBe(500);
  });

  it('score field in payload equals the numeric score passed in', () => {
    const payload = buildSubmitPayload('irrelevant', 1337);
    expect(payload.score).toBe(1337);
  });
});
