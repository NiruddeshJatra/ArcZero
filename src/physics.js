import {
  GRAVITY, DT, WORLD_HEIGHT, WORLD_WIDTH, SCALE,
  TRAJECTORY_PREVIEW_STEPS, TRAJECTORY_PREVIEW_DT,
  MIRV_SPLIT_AFTER_S, MIRV_SPREAD_DEG,
  SPLITTER_SPLIT_Y, SPLITTER_CHILD_VX, SPLITTER_CHILD_VY,
  MIN_INTERCEPT_ALTITUDE,
} from './constants.js';
import { createMissile } from './state.js';

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
  const spawned = [];
  for (const missile of state.missiles) {
    if (!missile.alive) continue;
    missile.ageS = (missile.ageS ?? 0) + DT;
    stepObject(missile);
    updateMissileTrail(missile);

    // MIRV split after MIRV_SPLIT_AFTER_S seconds
    if (missile.kind === 'mirv' && !missile.hasSplit && missile.ageS >= MIRV_SPLIT_AFTER_S) {
      missile.hasSplit = true;
      const baseAng = Math.atan2(missile.vy, missile.vx);
      const speed = Math.hypot(missile.vx, missile.vy);
      for (const offsetDeg of [-MIRV_SPREAD_DEG, 0, +MIRV_SPREAD_DEG]) {
        const a = baseAng + offsetDeg * Math.PI / 180;
        spawned.push(createMissile(missile.x, missile.vy, missile.vx, 'standard'));
        // replace last with proper velocity
        const child = spawned[spawned.length - 1];
        child.vx = Math.cos(a) * speed;
        child.vy = Math.sin(a) * speed;
        child.x = missile.x;
        child.y = missile.y;
      }
      missile.alive = false;
    }

    // Splitter split when below SPLITTER_SPLIT_Y and above danger zone
    if (missile.kind === 'splitter' && !missile.hasSplit &&
        missile.y <= SPLITTER_SPLIT_Y && missile.y > MIN_INTERCEPT_ALTITUDE) {
      missile.hasSplit = true;
      spawned.push(createMissile(missile.x, SPLITTER_CHILD_VY, -SPLITTER_CHILD_VX, 'standard'));
      spawned.push(createMissile(missile.x, SPLITTER_CHILD_VY, +SPLITTER_CHILD_VX, 'standard'));
      const last2 = spawned.slice(-2);
      for (const c of last2) { c.y = missile.y; }
      missile.alive = false;
    }
  }
  for (const m of spawned) state.missiles.push(m);
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
