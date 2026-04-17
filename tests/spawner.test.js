import { describe, it, expect } from 'vitest';
import { updateSpawner } from '../src/spawner.js';
import { randomBetween } from '../src/rng.js';
import { createState } from '../src/state.js';
import { SPAWN_INTERVAL, DT, WORLD_HEIGHT } from '../src/constants.js';

describe('updateSpawner', () => {
  it('does not spawn before SPAWN_INTERVAL', () => {
    const state = createState();
    updateSpawner(state);
    expect(state.missiles).toHaveLength(0);
  });

  it('spawns one missile when timer crosses SPAWN_INTERVAL', () => {
    const state = createState();
    state.spawnTimer = SPAWN_INTERVAL - DT;
    updateSpawner(state);
    expect(state.missiles).toHaveLength(1);
  });

  it('resets spawnTimer to 0 on spawn', () => {
    const state = createState();
    state.spawnTimer = SPAWN_INTERVAL - DT;
    updateSpawner(state);
    expect(state.spawnTimer).toBe(0);
  });

  it('spawns missile at y=WORLD_HEIGHT', () => {
    const state = createState();
    state.spawnTimer = SPAWN_INTERVAL - DT;
    updateSpawner(state);
    expect(state.missiles[0].y).toBe(WORLD_HEIGHT);
  });

  it('spawns missile with vx=0 and vy=0', () => {
    const state = createState();
    state.spawnTimer = SPAWN_INTERVAL - DT;
    updateSpawner(state);
    expect(state.missiles[0].vx).toBe(0);
    expect(state.missiles[0].vy).toBe(0);
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
