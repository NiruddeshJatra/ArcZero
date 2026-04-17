import {
  LAUNCHER_START_X,
  ANGLE_START,
  POWER_START,
  BASE_HEALTH,
  WORLD_HEIGHT,
} from './constants.js';

/**
 * Creates a fresh game state for the given level.
 * Pass carryHealth to preserve health across level transitions.
 */
export function createState(level = 1, carryHealth = BASE_HEALTH) {
  return {
    running: true,
    tick: 0,
    score: 0,
    health: carryHealth,
    level,
    levelStartScore: 0,
    levelComplete: false,
    launcher: {
      x: LAUNCHER_START_X,
      y: 0,
      angle: ANGLE_START,
      power: POWER_START,
      charging: false,
      fireCooldown: 0,
    },
    missiles: [],
    interceptors: [],
    spawnTimer: 0,
    explosions: [],
  };
}

/**
 * Creates a new enemy missile at x, falling from top of world.
 * vy and vx default to 0 (pure free-fall) for Level 1 / backwards compat.
 */
export function createMissile(x, vy = 0, vx = 0) {
  return {
    x,
    y: WORLD_HEIGHT,
    vx,
    vy,
    alive: true,
  };
}

/**
 * Creates a new interceptor fired from launcher position.
 */
export function createInterceptor(x, vx, vy) {
  return {
    x,
    y: 0,
    vx,
    vy,
    alive: true,
  };
}

/**
 * Creates a visual explosion at a physics position.
 */
export function createExplosion(x, y) {
  return {
    x,
    y,
    age: 0,
    maxAge: 0.5,
  };
}
