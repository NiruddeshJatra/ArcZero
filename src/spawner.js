import { SPAWN_X_MIN, SPAWN_X_MAX, DT } from './constants.js';
import { LEVELS } from './levels.js';
import { createMissile } from './state.js';

/**
 * Advance spawn timer and spawn enemy missiles when due.
 * Spawn interval and missile velocity come from the current level config.
 */
export function updateSpawner(state) {
  const config = LEVELS[state.level];
  state.spawnTimer += DT;
  if (state.spawnTimer >= config.spawnInterval) {
    state.spawnTimer -= config.spawnInterval;

    // Respect max simultaneous missile cap
    if (state.missiles.length >= config.maxMissiles) return;

    const x = randomBetween(SPAWN_X_MIN, SPAWN_X_MAX);
    const vy = randomBetween(config.missileVyMin, config.missileVyMax);
    const vx = config.missileVxRange > 0
      ? randomBetween(-config.missileVxRange, config.missileVxRange)
      : 0;
    state.missiles.push(createMissile(x, vy, vx));
  }
}

/**
 * Uniform random float in [min, max].
 */
export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
