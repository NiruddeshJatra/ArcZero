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
} from './constants.js';
import { createExplosion } from './state.js';
import { playIntercept, playDamage } from './audio.js';
import { triggerShake, triggerFlash } from './renderer.js';

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
        state.score += INTERCEPT_SCORE;
        state.explosions.push(
          createExplosion(
            (interceptor.x + missile.x) / 2,
            (interceptor.y + missile.y) / 2
          )
        );
        playIntercept();
        triggerShake(state, SHAKE_AMP_INTERCEPT, SHAKE_DUR_INTERCEPT);
        triggerFlash(state, '#ffffff', FLASH_INTERCEPT);
        state.hitstopRemainingS = HITSTOP_INTERCEPT;
        state.stats.intercepts += 1;
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
