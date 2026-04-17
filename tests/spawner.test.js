import { describe, it, expect } from 'vitest';
import { updateSpawner } from '../src/spawner.js';
import { randomBetween } from '../src/rng.js';
import { createState } from '../src/state.js';
import { DT, WORLD_HEIGHT } from '../src/constants.js';
import { LEVELS } from '../src/levels.js';

const L1 = LEVELS[1];

describe('updateSpawner', () => {
  it('does not spawn before spawnInterval', () => {
    const state = createState();
    updateSpawner(state);
    expect(state.missiles).toHaveLength(0);
  });

  it('spawns one missile when timer crosses spawnInterval', () => {
    const state = createState();
    state.spawnTimer = L1.spawnInterval - DT;
    updateSpawner(state);
    expect(state.missiles).toHaveLength(1);
  });

  it('resets spawnTimer correctly on spawn', () => {
    const state = createState();
    state.spawnTimer = L1.spawnInterval - DT;
    updateSpawner(state);
    // spawnTimer should wrap: (spawnInterval - DT) + DT - spawnInterval = 0
    expect(state.spawnTimer).toBeCloseTo(0);
  });

  it('spawns missile at y=WORLD_HEIGHT', () => {
    const state = createState();
    state.spawnTimer = L1.spawnInterval - DT;
    updateSpawner(state);
    expect(state.missiles[0].y).toBe(WORLD_HEIGHT);
  });

  it('spawns missile with vx=0 (L1 has no x range)', () => {
    const state = createState();
    state.spawnTimer = L1.spawnInterval - DT;
    updateSpawner(state);
    expect(state.missiles[0].vx).toBe(0);
  });

  it('spawns missile with vy in L1 range', () => {
    const state = createState();
    state.spawnTimer = L1.spawnInterval - DT;
    updateSpawner(state);
    expect(state.missiles[0].vy).toBeGreaterThanOrEqual(L1.missileVyMin);
    expect(state.missiles[0].vy).toBeLessThanOrEqual(L1.missileVyMax);
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
