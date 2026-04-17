import { describe, it, expect } from 'vitest';
import { updateSpawner } from '../src/spawner.js';
import { randomBetween } from '../src/rng.js';
import { createState } from '../src/state.js';
import { DT, WORLD_HEIGHT, SPAWN_TELEGRAPH_EASY_S } from '../src/constants.js';
import { LEVELS } from '../src/levels.js';

const L1 = LEVELS[1];

// Helper: run spawner until a warning is queued
function tickUntilWarning(state) {
  for (let i = 0; i < 1000; i++) {
    updateSpawner(state);
    if (state.warnings.length > 0) return true;
  }
  return false;
}

// Helper: drain all pending warnings into missiles
function resolveWarnings(state) {
  for (const w of state.warnings) w.remainingS = 0;
  updateSpawner(state); // one more tick resolves them
}

describe('updateSpawner', () => {
  it('does not spawn before spawnInterval', () => {
    const state = createState();
    updateSpawner(state);
    expect(state.missiles).toHaveLength(0);
    expect(state.warnings).toHaveLength(0);
  });

  it('queues a warning when timer crosses spawnInterval', () => {
    const state = createState();
    state.spawnTimer = L1.spawnInterval - DT;
    updateSpawner(state);
    expect(state.warnings).toHaveLength(1);
  });

  it('warning resolves to missile after telegraph duration', () => {
    const state = createState();
    state.spawnTimer = L1.spawnInterval - DT;
    updateSpawner(state); // queues warning
    expect(state.warnings).toHaveLength(1);

    // Expire the warning
    resolveWarnings(state);
    expect(state.missiles).toHaveLength(1);
    expect(state.warnings).toHaveLength(0);
  });

  it('spawns missile at y=WORLD_HEIGHT', () => {
    const state = createState();
    state.spawnTimer = L1.spawnInterval - DT;
    updateSpawner(state);
    resolveWarnings(state);
    expect(state.missiles[0].y).toBe(WORLD_HEIGHT);
  });

  it('spawns missile with vx=0 (L1 has no x range)', () => {
    const state = createState();
    state.spawnTimer = L1.spawnInterval - DT;
    updateSpawner(state);
    resolveWarnings(state);
    expect(state.missiles[0].vx).toBe(0);
  });

  it('spawns missile with vy in L1 range', () => {
    const state = createState();
    state.spawnTimer = L1.spawnInterval - DT;
    updateSpawner(state);
    resolveWarnings(state);
    expect(state.missiles[0].vy).toBeGreaterThanOrEqual(L1.missileVyMin);
    expect(state.missiles[0].vy).toBeLessThanOrEqual(L1.missileVyMax);
  });

  it('warning has correct telegraphS duration for L1', () => {
    const state = createState();
    state.spawnTimer = L1.spawnInterval - DT;
    updateSpawner(state);
    expect(state.warnings[0].totalS).toBe(SPAWN_TELEGRAPH_EASY_S);
  });
});

describe('randomBetween', () => {
  it('always returns value in [min, max]', () => {
    for (let i = 0; i < 500; i++) {
      const v = randomBetween(30, 180);
      expect(v).toBeGreaterThanOrEqual(30);
      expect(v).toBeLessThanOrEqual(180);
    }
  });
});
