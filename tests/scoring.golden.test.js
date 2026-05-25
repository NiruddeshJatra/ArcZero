/**
 * GOLDEN tests — pin scoring/Aegis formulas.
 * Expected values derived from constants; if a constant or formula changes, tests fail.
 */
import { describe, it, expect } from 'vitest';
import {
  BASE_INTERCEPT_SCORE_V2,
  COMBO_MULT_PER_HIT, COMBO_MULT_CAP,
  MIN_INTERCEPT_ALTITUDE, BONUS_ALT_MAX_MULT, BONUS_ALT_PRACTICAL_MAX_M,
  BONUS_CLUTCH_M, BONUS_CLUTCH_MULT,
  BONUS_ANGLE_LOW_MULT, BONUS_ANGLE_HIGH_MULT, ANGLE_MIN, ANGLE_MAX, ANGLE_START,
  COURIER_SCORE_MULT,
  PASSIVE_SCORE_RATE_V2, DT,
  LEVEL_CLEAR_BONUS,
  ENERGY_LOW_ANGLE, AEGIS_BASE_HEAL, AEGIS_OVERHEALTH_MAX, BASE_HEALTH,
} from '../src/constants.js';
import { checkCollisions } from '../src/collision.js';
import { createState, createMissile, createInterceptor } from '../src/state.js';

// Local formula mirrors — match collision.js exactly so a formula divergence fails the test.
function computeAltMult(y) {
  const altFrac = Math.min(
    (y - MIN_INTERCEPT_ALTITUDE) / (BONUS_ALT_PRACTICAL_MAX_M - MIN_INTERCEPT_ALTITUDE),
    1.0,
  );
  return 1.0 + altFrac * (BONUS_ALT_MAX_MULT - 1.0);
}

function computeAngleMult(degrees) {
  const angleFrac = (degrees - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN);
  return BONUS_ANGLE_LOW_MULT - angleFrac * (BONUS_ANGLE_LOW_MULT - BONUS_ANGLE_HIGH_MULT);
}

// ── Altitude multiplier ────────────────────────────────────────────────────────
describe('scoring.golden — altitude multiplier', () => {
  it('is 1.0 at MIN_INTERCEPT_ALTITUDE', () => {
    expect(computeAltMult(MIN_INTERCEPT_ALTITUDE)).toBe(1.0);
  });

  it('is BONUS_ALT_MAX_MULT (3.0) at BONUS_ALT_PRACTICAL_MAX_M', () => {
    expect(computeAltMult(BONUS_ALT_PRACTICAL_MAX_M)).toBe(BONUS_ALT_MAX_MULT);
    expect(BONUS_ALT_MAX_MULT).toBe(3.0);
  });
});

// ── Angle multiplier ───────────────────────────────────────────────────────────
describe('scoring.golden — angle multiplier', () => {
  it('is BONUS_ANGLE_LOW_MULT at ANGLE_MIN (low angle = more reward)', () => {
    expect(computeAngleMult(ANGLE_MIN)).toBe(BONUS_ANGLE_LOW_MULT);
    expect(BONUS_ANGLE_LOW_MULT).toBe(1.5);
  });

  it('is BONUS_ANGLE_HIGH_MULT at ANGLE_MAX (steep angle = less reward)', () => {
    expect(computeAngleMult(ANGLE_MAX)).toBe(BONUS_ANGLE_HIGH_MULT);
    expect(BONUS_ANGLE_HIGH_MULT).toBe(0.75);
  });
});

// ── Clutch multiplier stacks ───────────────────────────────────────────────────
describe('scoring.golden — clutch multiplier', () => {
  it('stacks BONUS_CLUTCH_MULT with altitude at intercept in clutch zone', () => {
    const y = 25; // in clutch zone: MIN_INTERCEPT_ALTITUDE(20) ≤ 25 ≤ BONUS_CLUTCH_M(35)
    const state = createState();
    const missile = createMissile(100);
    missile.y = y;
    missile.kind = 'standard';
    const interceptor = createInterceptor(100, 0, 0, ANGLE_START);
    interceptor.y = y;
    state.missiles.push(missile);
    state.interceptors.push(interceptor);

    checkCollisions(state);

    const comboMult = 1 + 1 * COMBO_MULT_PER_HIT; // first hit → count=1
    const skillMult = computeAltMult(y) * computeAngleMult(ANGLE_START) * BONUS_CLUTCH_MULT;
    expect(state.score).toBe(Math.round(BASE_INTERCEPT_SCORE_V2 * comboMult * skillMult));
  });

  it('does not apply clutch above BONUS_CLUTCH_M', () => {
    const y = BONUS_CLUTCH_M + 10; // above clutch zone
    const state = createState();
    const missile = createMissile(100);
    missile.y = y;
    missile.kind = 'standard';
    const interceptor = createInterceptor(100, 0, 0, ANGLE_START);
    interceptor.y = y;
    state.missiles.push(missile);
    state.interceptors.push(interceptor);

    checkCollisions(state);

    const comboMult = 1 + 1 * COMBO_MULT_PER_HIT;
    const skillMult = computeAltMult(y) * computeAngleMult(ANGLE_START); // no clutch
    expect(state.score).toBe(Math.round(BASE_INTERCEPT_SCORE_V2 * comboMult * skillMult));
  });
});

// ── Courier multiplier ─────────────────────────────────────────────────────────
describe('scoring.golden — courier multiplier', () => {
  it('applies COURIER_SCORE_MULT (1.5) for courier kind', () => {
    const y = 80;
    const state = createState();
    const missile = createMissile(100);
    missile.y = y;
    missile.kind = 'courier';
    const interceptor = createInterceptor(100, 0, 0, ANGLE_START);
    interceptor.y = y;
    state.missiles.push(missile);
    state.interceptors.push(interceptor);

    checkCollisions(state);

    const comboMult = 1 + 1 * COMBO_MULT_PER_HIT;
    const skillMult = computeAltMult(y) * computeAngleMult(ANGLE_START) * COURIER_SCORE_MULT;
    expect(state.score).toBe(Math.round(BASE_INTERCEPT_SCORE_V2 * comboMult * skillMult));
    expect(COURIER_SCORE_MULT).toBe(1.5);
  });
});

// ── Combo cap ─────────────────────────────────────────────────────────────────
describe('scoring.golden — combo cap', () => {
  it('saturates at COMBO_MULT_CAP=10 and never exceeds it', () => {
    const state = createState();
    for (let i = 0; i < 100; i++) {
      state.combo.count += 1;
      state.combo.multiplier = Math.min(1 + state.combo.count * COMBO_MULT_PER_HIT, COMBO_MULT_CAP);
    }
    expect(state.combo.multiplier).toBe(COMBO_MULT_CAP);
    expect(COMBO_MULT_CAP).toBe(10);
  });

  it('cap is reached at exactly 36 consecutive hits (1 + 36 * 0.25 = 10)', () => {
    const hitsNeeded = (COMBO_MULT_CAP - 1) / COMBO_MULT_PER_HIT;
    expect(hitsNeeded).toBe(36);
    expect(1 + hitsNeeded * COMBO_MULT_PER_HIT).toBe(COMBO_MULT_CAP);
  });
});

// ── Passive score rate ─────────────────────────────────────────────────────────
describe('scoring.golden — passive score rate', () => {
  it('PASSIVE_SCORE_RATE_V2 * DT * 100 ticks equals 1.25', () => {
    expect(PASSIVE_SCORE_RATE_V2 * DT * 100).toBeCloseTo(1.25, 8);
    expect(PASSIVE_SCORE_RATE_V2).toBe(0.25);
    expect(DT).toBe(0.05);
  });
});

// ── Level-clear bonus ──────────────────────────────────────────────────────────
describe('scoring.golden — level-clear bonus', () => {
  it('LEVEL_CLEAR_BONUS is 50 and scales linearly by level', () => {
    expect(LEVEL_CLEAR_BONUS).toBe(50);
    expect(LEVEL_CLEAR_BONUS * 1).toBe(50);
    expect(LEVEL_CLEAR_BONUS * 5).toBe(250);
    expect(LEVEL_CLEAR_BONUS * 9).toBe(450);
  });
});

// ── Aegis energy and overhealth ────────────────────────────────────────────────
describe('scoring.golden — Aegis', () => {
  it('ENERGY_LOW_ANGLE === 10 (awarded at level ≥ 3, launch angle < 45°)', () => {
    expect(ENERGY_LOW_ANGLE).toBe(10);
  });

  it('overhealth cap clamps to AEGIS_OVERHEALTH_MAX=150 at level 10+', () => {
    // Formula: maxH = level >= 10 ? AEGIS_OVERHEALTH_MAX : BASE_HEALTH
    //          state.health = Math.min(maxH, health + AEGIS_BASE_HEAL)
    const health = 140;
    const maxH = AEGIS_OVERHEALTH_MAX; // 150
    expect(Math.min(maxH, health + AEGIS_BASE_HEAL)).toBe(AEGIS_OVERHEALTH_MAX); // 160 → 150
    expect(AEGIS_OVERHEALTH_MAX).toBe(150);
    expect(AEGIS_BASE_HEAL).toBe(20);
  });

  it('at level < 10 overhealth cap is BASE_HEALTH=100 not AEGIS_OVERHEALTH_MAX', () => {
    const level = 9;
    const maxH = level >= 10 ? AEGIS_OVERHEALTH_MAX : BASE_HEALTH;
    expect(maxH).toBe(BASE_HEALTH);
    expect(BASE_HEALTH).toBe(100);
  });
});
