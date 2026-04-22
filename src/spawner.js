import {
  SPAWN_X_MIN, SPAWN_X_MAX, DT, SPAWN_TELEGRAPH_EASY_S, SPAWN_TELEGRAPH_HARD_S,
  COURIER_VY_MIN, COURIER_VY_MAX,
} from './constants.js';
import { LEVELS } from './levels.js';
import { createMissile } from './state.js';
import { randomBetween, pickWeighted } from './rng.js';
import { FLAGS } from './flags.js';
import { playCourierAlert } from './audio.js';

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
  let interval = state.currentSpawnInterval ?? cfg.spawnInterval;
  if (state.dailyModifier === 'speedrun') interval /= 1.5;
  if (state.spawnTimer >= interval) {
    state.spawnTimer = 0;
    const x  = randomBetween(SPAWN_X_MIN, SPAWN_X_MAX);
    const vy = randomBetween(cfg.missileVyMin, cfg.missileVyMax);
    const vx = cfg.missileVxRange ? randomBetween(-cfg.missileVxRange, cfg.missileVxRange) : 0;
    const kind = FLAGS.EVENT_MISSILES ? pickMissileKind(cfg) : 'standard';
    const finalVy = kind === 'courier' ? randomBetween(COURIER_VY_MIN, COURIER_VY_MAX) : vy;
    const telegraphS = state.level >= 4 ? SPAWN_TELEGRAPH_HARD_S : SPAWN_TELEGRAPH_EASY_S;
    state.warnings.push({ x, vx, vy: finalVy, kind, remainingS: telegraphS, totalS: telegraphS });
    if (kind === 'courier') playCourierAlert();
  }
}

function pickMissileKind(cfg) {
  const weights = cfg.eventWeights ?? {};
  const standardWeight = 1 - Object.values(weights).reduce((a, b) => a + b, 0);
  const entries = [['standard', standardWeight]];
  for (const [kind, w] of Object.entries(weights)) entries.push([kind, w]);
  return pickWeighted(entries);
}

// Keep export for tests that import directly
export { randomBetween } from './rng.js';
