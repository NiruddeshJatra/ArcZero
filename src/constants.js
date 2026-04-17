// World dimensions (meters)
export const WORLD_WIDTH = 200;
export const WORLD_HEIGHT = 150;

// Canvas rendering
export const SCALE = 5; // px per meter
export const CANVAS_WIDTH = 1000; // WORLD_WIDTH * SCALE
export const CANVAS_HEIGHT = 750; // WORLD_HEIGHT * SCALE

// Physics
export const GRAVITY = -12; // m/s² (negative = downward)
export const DT = 0.05; // seconds per tick (fixed timestep)

// Objects
export const MISSILE_RADIUS = 3; // meters
export const INTERCEPTOR_RADIUS = 2; // meters
export const COLLISION_RADIUS = 5; // MISSILE_RADIUS + INTERCEPTOR_RADIUS

// Launcher
export const LAUNCHER_START_X = 100; // meters from left
export const LAUNCHER_SPEED = 50; // m/s lateral
export const LAUNCHER_X_MIN = 0;
export const LAUNCHER_X_MAX = 200;
export const ANGLE_MIN = 20; // degrees
export const ANGLE_MAX = 80; // degrees
export const ANGLE_START = 45; // degrees
export const ANGLE_SPEED = 30; // degrees/s

// Fire cooldown
export const FIRE_COOLDOWN = 1; // seconds between shots

// Power (charge)
export const POWER_MIN = 20; // m/s
export const POWER_MAX = 80; // m/s
export const POWER_START = 20; // m/s
export const POWER_CHARGE_RATE = 30; // m/s per second

// Spawning
export const SPAWN_INTERVAL = 4; // seconds between missiles
export const SPAWN_X_MIN = 30; // meters
export const SPAWN_X_MAX = 180; // meters

// Scoring & Health
export const INTERCEPT_SCORE = 15;
export const MISSILE_DAMAGE = 10;
export const BASE_HEALTH = 100;

// Interception rules
export const MIN_INTERCEPT_ALTITUDE = 20; // meters — no interception below this line (exploit prevention)

// Colors (dark space theme)
export const COLOR_BG = '#0a0a0f';
export const COLOR_MISSILE = '#ff4444';
export const COLOR_MISSILE_STROKE = '#ff6666';
export const COLOR_INTERCEPTOR = '#44aaff';
export const COLOR_INTERCEPTOR_STROKE = '#66ccff';
export const COLOR_LAUNCHER = '#888899';
export const COLOR_LAUNCHER_STROKE = '#aaaacc';
export const COLOR_GROUND = 'rgba(255,255,255,0.15)';
export const COLOR_TRAJECTORY = 'rgba(68,170,255,0.3)';
export const COLOR_EXPLOSION_INNER = '#ff6b35';
export const COLOR_EXPLOSION_OUTER = '#ff4444';

// Launcher visual size (meters)
export const LAUNCHER_DRAW_WIDTH_M = 6;
export const LAUNCHER_DRAW_HEIGHT_M = 4;
export const LAUNCHER_BARREL_LENGTH_M = 5;
