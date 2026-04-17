import { GRAVITY, DT, WORLD_HEIGHT, WORLD_WIDTH, SCALE, TRAJECTORY_PREVIEW_STEPS, TRAJECTORY_PREVIEW_DT } from './constants.js';

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
 * Simulate a projectile trajectory for preview rendering.
 * Returns array of {x, y} physics-space points.
 */
export function simulateTrajectory(startX, startY, vx, vy, maxSteps = TRAJECTORY_PREVIEW_STEPS) {
  const pts = [];
  let x = startX, y = startY, vyi = vy;
  const vxi = vx;
  for (let i = 0; i < maxSteps; i++) {
    x += vxi * TRAJECTORY_PREVIEW_DT;
    y += vyi * TRAJECTORY_PREVIEW_DT + 0.5 * GRAVITY * TRAJECTORY_PREVIEW_DT * TRAJECTORY_PREVIEW_DT;
    vyi += GRAVITY * TRAJECTORY_PREVIEW_DT;
    if (y <= 0 || x < 0 || x > WORLD_WIDTH) break;
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Collect trail particles for an interceptor.
 */
export function updateInterceptorTrail(interceptor) {
  interceptor.trail = interceptor.trail ?? [];
  interceptor.trail.push({ x: interceptor.x, y: interceptor.y, age: 0 });
  for (const pt of interceptor.trail) pt.age += DT;
  interceptor.trail = interceptor.trail.filter(pt => pt.age < 0.3);
  if (interceptor.trail.length > 10) interceptor.trail.shift();
}

/**
 * Collect trail particles for a missile.
 */
export function updateMissileTrail(missile) {
  missile.trail.push({ x: missile.x, y: missile.y, age: 0 });
  for (const pt of missile.trail) pt.age += DT;
  missile.trail = missile.trail.filter(pt => pt.age < 0.4);
  if (missile.trail.length > 12) missile.trail.shift();
}

/**
 * Apply physics to all live missiles and interceptors.
 */
export function stepPhysics(state) {
  for (const missile of state.missiles) {
    if (missile.alive) {
      stepObject(missile);
      updateMissileTrail(missile);
    }
  }
  for (const interceptor of state.interceptors) {
    if (interceptor.alive) {
      stepObject(interceptor);
      updateInterceptorTrail(interceptor);
    }
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
