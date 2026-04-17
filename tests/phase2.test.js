import { describe, it, expect } from 'vitest';
import { createState, createMissile } from '../src/state.js';
import { LEVELS } from '../src/levels.js';
import {
  COMBO_MULT_CAP,
  COMBO_WINDOW_S,
  COMBO_DECAY_DUR_S,
  COMBO_MULT_PER_HIT,
  SPAWN_TELEGRAPH_EASY_S,
  WAVE_BUILD_DUR_S,
  WAVE_PEAK_DUR_S,
  WAVE_RELEASE_DUR_S,
  DT,
} from '../src/constants.js';

// ---- LEVELS array ----
describe('LEVELS array', () => {
  it('has 10 levels + null at index 0', () => {
    expect(LEVELS[0]).toBeNull();
    expect(LEVELS.length).toBe(11);
  });

  it('score thresholds monotonically increase except L10 (Infinity)', () => {
    for (let i = 1; i < 9; i++) {
      expect(LEVELS[i].scoreThreshold).toBeLessThan(LEVELS[i + 1].scoreThreshold);
    }
    expect(LEVELS[10].scoreThreshold).toBe(Infinity);
  });

  it('L8 has forceTrajectoryOff', () => {
    expect(LEVELS[8].forceTrajectoryOff).toBe(true);
  });

  it('L10 has escalatesPeak', () => {
    expect(LEVELS[10].escalatesPeak).toBe(true);
  });

  it('all levels have required fields', () => {
    for (let i = 1; i <= 10; i++) {
      const l = LEVELS[i];
      expect(l.spawnInterval).toBeGreaterThan(0);
      expect(typeof l.scoreThreshold).toBe('number');
      expect(typeof l.tint).toBe('string');
      expect(typeof l.intro).toBe('string');
    }
  });
});

// ---- Combo multiplier ----
describe('combo multiplier', () => {
  it('caps at COMBO_MULT_CAP regardless of hit count', () => {
    const state = createState();
    // Simulate 100 hits
    for (let i = 0; i < 100; i++) {
      state.combo.count += 1;
      state.combo.multiplier = Math.min(1 + state.combo.count * COMBO_MULT_PER_HIT, COMBO_MULT_CAP);
    }
    expect(state.combo.multiplier).toBe(COMBO_MULT_CAP);
  });

  it('resets count and mult after decay completes', () => {
    const state = createState();
    state.combo.count = 5;
    state.combo.multiplier = 2.25;
    state.combo.decaying = true;

    const step = (COMBO_MULT_CAP - 1) / (COMBO_DECAY_DUR_S / DT);
    const stepsNeeded = Math.ceil((state.combo.multiplier - 1.0) / step) + 2;
    for (let i = 0; i < stepsNeeded; i++) {
      state.combo.multiplier = Math.max(1.0, state.combo.multiplier - step);
      if (state.combo.multiplier <= 1.0) {
        state.combo.count = 0;
        state.combo.decaying = false;
        break;
      }
    }
    expect(state.combo.count).toBe(0);
    expect(state.combo.multiplier).toBe(1.0);
    expect(state.combo.decaying).toBe(false);
  });
});

// ---- Wave phase cycle ----
describe('wave phase cycle', () => {
  it('cycles BUILD→PEAK→RELEASE→BUILD at correct thresholds', () => {
    const state = createState();
    expect(state.wave.phase).toBe('BUILD');

    // Advance through BUILD
    state.wave.elapsedS = WAVE_BUILD_DUR_S;
    if (state.wave.elapsedS >= WAVE_BUILD_DUR_S) {
      state.wave.elapsedS = 0;
      state.wave.phase = 'PEAK';
    }
    expect(state.wave.phase).toBe('PEAK');

    // Advance through PEAK
    state.wave.elapsedS = WAVE_PEAK_DUR_S;
    if (state.wave.elapsedS >= WAVE_PEAK_DUR_S) {
      state.wave.elapsedS = 0;
      state.wave.phase = 'RELEASE';
    }
    expect(state.wave.phase).toBe('RELEASE');

    // Advance through RELEASE
    state.wave.elapsedS = WAVE_RELEASE_DUR_S;
    if (state.wave.elapsedS >= WAVE_RELEASE_DUR_S) {
      state.wave.elapsedS = 0;
      state.wave.phase = 'BUILD';
      state.wave.index += 1;
    }
    expect(state.wave.phase).toBe('BUILD');
    expect(state.wave.index).toBe(1);
  });
});

// ---- Telegraph ----
describe('telegraph warnings', () => {
  it('warning resolves to missile after telegraph duration', () => {
    const state = createState();
    state.warnings = [{ x: 100, vx: 0, vy: -10, kind: 'standard', remainingS: SPAWN_TELEGRAPH_EASY_S, totalS: SPAWN_TELEGRAPH_EASY_S }];

    // Tick down until resolved
    let steps = Math.ceil(SPAWN_TELEGRAPH_EASY_S / DT) + 2;
    while (steps-- > 0 && state.warnings.length > 0) {
      for (const w of state.warnings) w.remainingS -= DT;
      const ready = state.warnings.filter(w => w.remainingS <= 0);
      for (const w of ready) {
        state.missiles.push(createMissile(w.x, w.vy, w.vx, w.kind));
      }
      state.warnings = state.warnings.filter(w => w.remainingS > 0);
    }

    expect(state.missiles.length).toBe(1);
    expect(state.missiles[0].x).toBe(100);
  });

  it('warning spawns missile at same x position', () => {
    const state = createState();
    state.warnings = [{ x: 77, vx: 5, vy: -8, kind: 'standard', remainingS: 0, totalS: 0.7 }];
    const ready = state.warnings.filter(w => w.remainingS <= 0);
    for (const w of ready) {
      state.missiles.push(createMissile(w.x, w.vy, w.vx, w.kind));
    }
    expect(state.missiles[0].x).toBe(77);
  });
});

// ---- Level complete only during RELEASE ----
describe('level advancement gating', () => {
  it('does not advance during BUILD or PEAK', () => {
    const state = createState();
    state.score = 9999;
    state.levelStartScore = 0;

    for (const phase of ['BUILD', 'PEAK']) {
      state.wave.phase = phase;
      const cfg = LEVELS[state.level];
      const levelScore = state.score - state.levelStartScore;
      const shouldAdvance = levelScore >= cfg.scoreThreshold && state.wave.phase === 'RELEASE';
      expect(shouldAdvance).toBe(false);
    }
  });

  it('advances during RELEASE when score threshold met', () => {
    const state = createState();
    state.score = 9999;
    state.levelStartScore = 0;
    state.wave.phase = 'RELEASE';
    const cfg = LEVELS[state.level];
    const levelScore = state.score - state.levelStartScore;
    const shouldAdvance = levelScore >= cfg.scoreThreshold && state.wave.phase === 'RELEASE';
    expect(shouldAdvance).toBe(true);
  });
});

// ---- State init ----
describe('createState', () => {
  it('initialises combo, wave, floaters, warnings', () => {
    const state = createState();
    expect(state.combo).toBeDefined();
    expect(state.combo.count).toBe(0);
    expect(state.wave.phase).toBe('BUILD');
    expect(Array.isArray(state.floaters)).toBe(true);
    expect(Array.isArray(state.warnings)).toBe(true);
  });

  it('currentSpawnInterval matches L1 spawnInterval', () => {
    const state = createState(1);
    expect(state.currentSpawnInterval).toBe(LEVELS[1].spawnInterval);
  });
});
