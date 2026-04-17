import { SPAWN_X_MIN, SPAWN_X_MAX, DT, SPAWN_TELEGRAPH_EASY_S, SPAWN_TELEGRAPH_HARD_S } from './constants.js';
import { LEVELS } from './levels.js';
import { createMissile } from './state.js';
import { randomBetween } from './rng.js';

/**
 * Advance spawn timer; manage telegraph warnings; spawn missiles when warnings resolve.
 */
export function updateSpawner(state) {
  const cfg = LEVELS[state.level];
  state.spawnTimer += DT;

  // --- Resolve elapsed warnings into live missiles ---
  state.warnings = state.warnings ?? [];
  for (const w of state.warnings) w.remainingS -= DT;
  const ready = state.warnings.filter(w => w.remainingS <= 0);
  for (const w of ready) {
    if (state.missiles.filter(m => m.alive).length < cfg.maxMissiles) {
      state.missiles.push(createMissile(w.x, w.vy, w.vx, w.kind));
    }
  }
  state.warnings = state.warnings.filter(w => w.remainingS > 0);

  // --- Queue new telegraph ---
  const interval = state.currentSpawnInterval ?? cfg.spawnInterval;
  if (state.spawnTimer >= interval) {
    state.spawnTimer = 0;
    const x  = randomBetween(SPAWN_X_MIN, SPAWN_X_MAX);
    const vy = randomBetween(cfg.missileVyMin, cfg.missileVyMax);
    const vx = cfg.missileVxRange ? randomBetween(-cfg.missileVxRange, cfg.missileVxRange) : 0;
    const telegraphS = state.level >= 4 ? SPAWN_TELEGRAPH_HARD_S : SPAWN_TELEGRAPH_EASY_S;
    state.warnings.push({ x, vx, vy, kind: 'standard', remainingS: telegraphS, totalS: telegraphS });
  }
}

// Keep export for tests that import directly
export { randomBetween } from './rng.js';
