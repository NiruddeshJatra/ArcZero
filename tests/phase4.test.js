/**
 * Phase 4 — Event missiles + touch: unit tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { seed } from '../src/rng.js';
import { pickWeighted } from '../src/rng.js';
import { createMissile } from '../src/state.js';
import { stepPhysics } from '../src/physics.js';
import { MIRV_SPLIT_AFTER_S, DT, SPLITTER_SPLIT_Y, MIN_INTERCEPT_ALTITUDE, COURIER_VY_MIN, COURIER_VY_MAX } from '../src/constants.js';

beforeEach(() => seed(42));

// ── pickWeighted ──────────────────────────────────────────────────────────────
describe('pickWeighted', () => {
  it('distributes proportionally over many trials', () => {
    seed(999);
    const counts = { standard: 0, courier: 0 };
    for (let i = 0; i < 1000; i++) {
      const r = pickWeighted([['standard', 0.8], ['courier', 0.2]]);
      counts[r]++;
    }
    // courier should be roughly 200 ± 50
    expect(counts.courier).toBeGreaterThan(130);
    expect(counts.courier).toBeLessThan(270);
  });
});

// ── Courier ───────────────────────────────────────────────────────────────────
describe('courier vy range', () => {
  it('COURIER_VY constants are negative and fast', () => {
    expect(COURIER_VY_MIN).toBeLessThan(0);
    expect(COURIER_VY_MAX).toBeLessThan(0);
    expect(Math.abs(COURIER_VY_MIN)).toBeGreaterThan(30);
  });
});

// ── MIRV ──────────────────────────────────────────────────────────────────────
describe('MIRV split', () => {
  function makeState(missile) {
    return { missiles: [missile], interceptors: [], particles: [] };
  }

  it('splits at MIRV_SPLIT_AFTER_S into 3 children', () => {
    const m = createMissile(100, -20, 0, 'mirv');
    m.y = 100;
    const state = makeState(m);

    const ticks = Math.ceil(MIRV_SPLIT_AFTER_S / DT);
    for (let i = 0; i < ticks; i++) stepPhysics(state);

    // Parent dead, 3 children spawned
    expect(m.alive).toBe(false);
    expect(m.hasSplit).toBe(true);
    const alive = state.missiles.filter(x => x.alive);
    expect(alive.length).toBe(3);
  });

  it('does not split twice', () => {
    const m = createMissile(100, -20, 0, 'mirv');
    m.y = 100;
    const state = makeState(m);
    const ticks = Math.ceil(MIRV_SPLIT_AFTER_S / DT) + 5;
    for (let i = 0; i < ticks; i++) stepPhysics(state);
    const alive = state.missiles.filter(x => x.alive && x !== m);
    expect(alive.length).toBe(3); // exactly 3, no re-split
  });
});

// ── Splitter ──────────────────────────────────────────────────────────────────
describe('splitter split', () => {
  function makeState(missile) {
    return { missiles: [missile], interceptors: [], particles: [] };
  }

  it('splits once below SPLITTER_SPLIT_Y into 2 children', () => {
    const m = createMissile(100, -10, 0, 'splitter');
    m.y = SPLITTER_SPLIT_Y + 1; // start above threshold
    const state = makeState(m);

    // Run until y drops below SPLITTER_SPLIT_Y
    for (let i = 0; i < 200; i++) {
      stepPhysics(state);
      if (!m.alive) break;
    }

    expect(m.alive).toBe(false);
    expect(m.hasSplit).toBe(true);
    const children = state.missiles.filter(x => x !== m && x.alive);
    expect(children.length).toBe(2);
  });

  it('does not split in danger zone (below MIN_INTERCEPT_ALTITUDE)', () => {
    const m = createMissile(100, -5, 0, 'splitter');
    m.y = MIN_INTERCEPT_ALTITUDE - 1; // already in danger zone
    const state = makeState(m);
    stepPhysics(state);
    expect(m.hasSplit).toBeFalsy();
  });

  it('children have opposite vx', () => {
    const m = createMissile(100, -10, 0, 'splitter');
    m.y = SPLITTER_SPLIT_Y + 1;
    const state = makeState(m);
    for (let i = 0; i < 200; i++) {
      stepPhysics(state);
      if (!m.alive) break;
    }
    const children = state.missiles.filter(x => x !== m);
    expect(children[0].vx).toBe(-children[1].vx);
  });
});
