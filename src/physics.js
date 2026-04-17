import { GRAVITY, DT, WORLD_HEIGHT, SCALE } from './constants.js';

/**
 * Apply one fixed timestep of physics to a single object.
 * Mutates obj in place.
 */
export function stepObject(obj) {
  obj.x += obj.vx * DT;
  obj.y += obj.vy * DT + 0.5 * GRAVITY * DT * DT;
  obj.vy += GRAVITY * DT;
  // vx unchanged — no air resistance
}

/**
 * Apply physics to all live missiles and interceptors.
 */
export function stepPhysics(state) {
  for (const missile of state.missiles) {
    if (missile.alive) stepObject(missile);
  }
  for (const interceptor of state.interceptors) {
    if (interceptor.alive) stepObject(interceptor);
  }
}

/**
 * Convert physics X (meters) to canvas X (pixels).
 */
export function toCanvasX(px) {
  return px * SCALE;
}

/**
 * Convert physics Y (meters, origin bottom) to canvas Y (pixels, origin top).
 */
export function toCanvasY(py) {
  return (WORLD_HEIGHT - py) * SCALE;
}
