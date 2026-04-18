import {
  COLLISION_RADIUS,
  MISSILE_DAMAGE,
  INTERCEPT_SCORE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  MIN_INTERCEPT_ALTITUDE,
  SHAKE_AMP_INTERCEPT,
  SHAKE_DUR_INTERCEPT,
  SHAKE_AMP_DAMAGE,
  SHAKE_DUR_DAMAGE,
  FLASH_INTERCEPT,
  FLASH_DAMAGE,
  HITSTOP_INTERCEPT,
  COMBO_WINDOW_S,
  COMBO_MULT_PER_HIT,
  COMBO_MULT_CAP,
  BASE_INTERCEPT_SCORE_V2,
  BONUS_ALT_MAX_MULT,
  BONUS_ALT_PRACTICAL_MAX_M,
  BONUS_CLUTCH_M,
  BONUS_CLUTCH_MULT,
  BONUS_LONG_RANGE_M,
  BONUS_LONG_RANGE_MULT,
  COURIER_SCORE_MULT,
  BONUS_ANGLE_LOW_MULT,
  BONUS_ANGLE_HIGH_MULT,
  ANGLE_MIN,
  ANGLE_MAX,
  ANGLE_START,
} from './constants.js';
import { createExplosion } from './state.js';
import { playIntercept, playDamage, playGraze, playComboUp, playComboPeak } from './audio.js';
import { NEAR_MISS_THRESHOLD } from './constants.js';
import { triggerShake, triggerFlash } from './renderer.js';
import { FLAGS } from './flags.js';

/**
 * Euclidean distance between two physics objects.
 */
export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check missile-interceptor collisions.
 * Marks alive=false on both, awards score, spawns explosion.
 */
export function checkCollisions(state) {
  for (const interceptor of state.interceptors) {
    if (!interceptor.alive) continue;
    for (const missile of state.missiles) {
      if (!missile.alive) continue;
      if (
        distance(interceptor, missile) <= COLLISION_RADIUS &&
        missile.y >= MIN_INTERCEPT_ALTITUDE
      ) {
        interceptor.alive = false;
        missile.alive = false;
        const midX = (interceptor.x + missile.x) / 2;
        const midY = (interceptor.y + missile.y) / 2;
        state.explosions.push(createExplosion(midX, midY));
        playIntercept();
        triggerShake(state, SHAKE_AMP_INTERCEPT, SHAKE_DUR_INTERCEPT);
        triggerFlash(state, '#ffffff', FLASH_INTERCEPT);
        state.hitstopRemainingS = HITSTOP_INTERCEPT;
        state.stats.intercepts += 1;

        if (FLAGS.SCORE_REBALANCE) {
          state.combo.count += 1;
          state.combo.timerS = COMBO_WINDOW_S;
          state.combo.decaying = false;
          state.combo.multiplier = Math.min(1 + state.combo.count * COMBO_MULT_PER_HIT, COMBO_MULT_CAP);
          if (state.combo.count > state.combo.best) state.combo.best = state.combo.count;
          if (state.combo.multiplier >= COMBO_MULT_CAP) playComboPeak();
          else if (state.combo.count > 1) playComboUp();

          // Continuous altitude multiplier: 1.0× at MIN_INTERCEPT_ALTITUDE → BONUS_ALT_MAX_MULT× at practical ceiling
          const altFrac = Math.min(
            (missile.y - MIN_INTERCEPT_ALTITUDE) / (BONUS_ALT_PRACTICAL_MAX_M - MIN_INTERCEPT_ALTITUDE), 1.0
          );
          let skillMult = 1.0 + altFrac * (BONUS_ALT_MAX_MULT - 1.0);

          // Angle multiplier: low angle → more points (BONUS_ANGLE_LOW_MULT), high angle → fewer (BONUS_ANGLE_HIGH_MULT)
          const launchAngle = interceptor.launchAngle ?? ANGLE_START;
          const angleFrac = (launchAngle - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN);
          skillMult *= BONUS_ANGLE_LOW_MULT - angleFrac * (BONUS_ANGLE_LOW_MULT - BONUS_ANGLE_HIGH_MULT);

          if (missile.y <= BONUS_CLUTCH_M && missile.y >= MIN_INTERCEPT_ALTITUDE) skillMult *= BONUS_CLUTCH_MULT;
          const horizDist = Math.abs(interceptor.x - state.launcher.x);
          if (horizDist >= BONUS_LONG_RANGE_M) skillMult *= BONUS_LONG_RANGE_MULT;
          if (missile.kind === 'courier') skillMult *= COURIER_SCORE_MULT;

          const finalScore = Math.round(BASE_INTERCEPT_SCORE_V2 * state.combo.multiplier * skillMult);
          state.score += finalScore;

          state.floaters.push({
            x: midX, y: midY,
            text: `+${finalScore}`,
            mult: state.combo.multiplier,
            age: 0, maxAge: 0.8,
          });
        } else {
          state.score += INTERCEPT_SCORE;
        }
      } else {
        // Near-miss detection
        const d = distance(interceptor, missile);
        if (d <= NEAR_MISS_THRESHOLD && missile.y >= MIN_INTERCEPT_ALTITUDE) {
          interceptor._grazes = interceptor._grazes ?? new Set();
          if (!interceptor._grazes.has(missile.id)) {
            interceptor._grazes.add(missile.id);
            state.stats.nearMisses += 1;
            if (d < state.stats.closestMissM) state.stats.closestMissM = d;
            playGraze();
            state.particles = state.particles ?? [];
            state.particles.push({
              x: (interceptor.x + missile.x) / 2,
              y: (interceptor.y + missile.y) / 2,
              vx: 0, vy: 0, age: 0, maxAge: 0.25,
              color: 'rgba(100,220,255,0.9)', kind: 'spark',
            });
          }
        }
      }
    }
  }
}

/**
 * Check if missiles hit the ground (y <= 0).
 * Marks alive=false and applies health damage.
 */
export function checkMissileGroundHit(state) {
  for (const missile of state.missiles) {
    if (!missile.alive) continue;
    if (missile.y <= 0) {
      missile.alive = false;
      state.health -= MISSILE_DAMAGE;
      playDamage();
      triggerShake(state, SHAKE_AMP_DAMAGE, SHAKE_DUR_DAMAGE);
      triggerFlash(state, '#ff3535', FLASH_DAMAGE);
    }
  }
}

/**
 * Check if interceptors are out of bounds.
 * Marks alive=false on out-of-bounds interceptors.
 */
export function checkInterceptorBounds(state) {
  for (const interceptor of state.interceptors) {
    if (!interceptor.alive) continue;
    if (
      interceptor.y <= 0 ||
      interceptor.y > WORLD_HEIGHT ||
      interceptor.x < 0 ||
      interceptor.x > WORLD_WIDTH
    ) {
      interceptor.alive = false;
    }
  }
}
