import { describe, it, expect } from 'vitest';
import { seed, seedFromDateISO } from '../src/rng.js';
import { updateSpawner } from '../src/spawner.js';
import { createState } from '../src/state.js';
import { SPAWN_X_MIN, SPAWN_X_MAX } from '../src/constants.js';

// Tick the spawner until `count` warnings have been queued; return their {x, vy, vx, kind}.
// Tracks seen warning objects by identity so removals don't cause double-counting.
function collectWarnings(seedVal, count) {
  seed(seedVal);
  const state = createState(1, 100, 0);
  const seen = new Set();
  const result = [];

  for (let t = 0; result.length < count && t < count * 200; t++) {
    updateSpawner(state);
    for (const w of state.warnings) {
      if (!seen.has(w)) {
        seen.add(w);
        result.push({ x: w.x, vy: w.vy, vx: w.vx, kind: w.kind });
      }
    }
  }
  return result;
}

describe('determinism', () => {
  it('same seed produces identical first 20 spawns', () => {
    const FIXED_SEED = 0xDEADBEEF;
    const run1 = collectWarnings(FIXED_SEED, 20);
    const run2 = collectWarnings(FIXED_SEED, 20);
    expect(run1).toHaveLength(20);
    expect(run2).toEqual(run1);
  });

  it('seedFromDateISO produces identical spawn sequence for same ISO date', () => {
    const iso = '2026-01-15';
    const run1 = collectWarnings(seedFromDateISO(iso), 10);
    const run2 = collectWarnings(seedFromDateISO(iso), 10);
    expect(run1).toHaveLength(10);
    expect(run2).toEqual(run1);
  });

  it('different ISO dates produce different spawn sequences', () => {
    const run1 = collectWarnings(seedFromDateISO('2026-01-15'), 5);
    const run2 = collectWarnings(seedFromDateISO('2026-01-16'), 5);
    expect(run1).not.toEqual(run2);
  });

  it('desktop SPAWN_X: all spawned x in [SPAWN_X_MIN, SPAWN_X_MAX]', () => {
    // IS_PORTRAIT is false in jsdom (matchMedia not implemented) → desktop 200m world.
    // SPAWN_X_MIN = 30m (0.15 × 200), SPAWN_X_MAX = 180m (0.9 × 200).
    // Portrait range [15, 90] requires E2E mobile-chrome viewport (IS_PORTRAIT cannot be
    // forced in jsdom without a src/ change; canvas-sizing E2E test confirms IS_PORTRAIT
    // is active on Pixel 5).
    seed(0xABCD1234);
    const state = createState(1, 100, 0);
    const seen = new Set();
    const xs = [];

    for (let t = 0; xs.length < 30 && t < 6000; t++) {
      updateSpawner(state);
      for (const w of state.warnings) {
        if (!seen.has(w)) {
          seen.add(w);
          xs.push(w.x);
        }
      }
    }

    expect(xs.length).toBeGreaterThan(0);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(SPAWN_X_MIN);
      expect(x).toBeLessThanOrEqual(SPAWN_X_MAX);
    }
  });
});
