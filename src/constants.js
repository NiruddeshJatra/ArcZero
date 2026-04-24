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
export const INTERCEPTOR_RADIUS = 2; // meters (collision only — art size is INTERCEPTOR_ART_SCALE)
export const COLLISION_RADIUS = 5; // MISSILE_RADIUS + INTERCEPTOR_RADIUS

// Interceptor drawing (px). Decoupled from INTERCEPTOR_RADIUS so art can scale
// without changing collision or explosion burst size.
export const INTERCEPTOR_ART_SCALE = 1.6;     // multiplies arrow dimensions
export const INTERCEPTOR_HALO_RADIUS_PX = 10; // glow radius

// Launcher
export const LAUNCHER_START_X = 100; // meters from left
export const LAUNCHER_SPEED = 55; // m/s lateral
export const LAUNCHER_X_MIN = 0;
export const LAUNCHER_X_MAX = 200;
export const ANGLE_MIN = 30; // degrees
export const ANGLE_MAX = 70; // degrees
export const ANGLE_START = 45; // degrees
export const ANGLE_SPEED = 30; // degrees/s

// Fire cooldown
export const FIRE_COOLDOWN = 1; // seconds between shots

// Power (charge)
export const POWER_MIN = 20; // m/s
export const POWER_MAX = 60; // m/s
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

// === Phase 0 foundation ===
export const PHYSICS_VERSION = 1;     // bump when physics changes; never during a daily season
export const SCHEMA_VERSION = 2;      // save file schema
export const GAME_NAME = 'ArcZero';

// === Phase 1 — feel ===
export const SHAKE_AMP_INTERCEPT = 4;       // px
export const SHAKE_DUR_INTERCEPT = 0.18;    // s
export const SHAKE_AMP_DAMAGE = 8;
export const SHAKE_DUR_DAMAGE = 0.30;
export const SHAKE_AMP_GAMEOVER = 14;
export const SHAKE_DUR_GAMEOVER = 0.60;
export const HITSTOP_INTERCEPT = 0.06;      // s
export const FLASH_INTERCEPT = 0.06;
export const FLASH_DAMAGE = 0.08;
export const FLASH_LEVELUP = 0.08;
export const NEAR_MISS_THRESHOLD = 10;      // meters
export const TRAJECTORY_PREVIEW_STEPS = 40; // sim steps for the preview arc
export const TRAJECTORY_PREVIEW_DT = 0.05;  // matches physics dt
export const MUZZLE_FLASH_DUR = 0.08;       // s
export const LAUNCHER_RECOIL_PX = 3;
export const LAUNCHER_RECOIL_DUR = 0.12;    // s

// === Phase 1 — launcher facing (flip) ===
export const FACING_RIGHT = 1;
export const FACING_LEFT = -1;
export const FLIP_KEY = 'z';                 // lowercase; check key.toLowerCase()
export const PAUSE_KEYS = ['p', 'escape'];   // lowercase; check key.toLowerCase()

// === Phase 1 — launcher art ===
export const LAUNCHER_BARREL_LEN = 18;      // px

// === Phase 2 — combo + scoring ===
export const STREAK_CALLOUTS = [
  { count: 2,  text: 'Double Blast!',    soundKey: 'streakHorn1' },
  { count: 3,  text: 'Triple Strike!',   soundKey: 'streakHorn2' },
  { count: 4,  text: 'Quad Blast!',      soundKey: 'streakHorn3' },
  { count: 5,  text: 'Overdrive!',       soundKey: 'streakSiren1' },
  { count: 6,  text: 'Destruction Mode!',soundKey: 'streakSiren2' },
  { count: 7,  text: 'Unstoppable!',     soundKey: 'streakFanfare1' },
  { count: 8,  text: 'ANNIHILATION!',    soundKey: 'streakFanfare2', flash: true },
  { count: 9,  text: 'Godlike!',         soundKey: 'streakGodlike' },
  { count: 10, text: 'LEGENDARY BLAST!', soundKey: 'streakLegendary', flash: true },
];

export const RANKING_MODES = Object.freeze({
  CAMPAIGN: 'campaign',
  LEVELRUN: 'levelrun',
  DAILY: 'daily',
  UNRANKED: 'unranked'
});

export const COMBO_WINDOW_S = 3.0;
export const COMBO_MULT_PER_HIT = 0.25;      // +0.25x per intercept
export const COMBO_MULT_CAP = 10;
export const COMBO_DECAY_DUR_S = 1.0;
export const BASE_INTERCEPT_SCORE_V2 = 10;   // used when SCORE_REBALANCE is on
export const PASSIVE_SCORE_RATE_V2 = 0.25;   // per second when SCORE_REBALANCE is on
export const LEVEL_CLEAR_BONUS = 50;         // × level
// Continuous altitude multiplier: 1.0× at MIN_INTERCEPT_ALTITUDE, BONUS_ALT_MAX_MULT× at practical ceiling
export const BONUS_ALT_MAX_MULT = 3.0;
export const BONUS_ALT_PRACTICAL_MAX_M = 100; // realistic max intercept altitude; capped here
export const BONUS_CLUTCH_M = 35;            // intercept y below this (but above MIN_INTERCEPT_ALTITUDE)
export const BONUS_CLUTCH_MULT = 1.5;
export const BONUS_LONG_RANGE_M = 50;        // |impactX - launcherX|
export const BONUS_LONG_RANGE_MULT = 1.2;
// Angle multiplier: low angle (ANGLE_MIN 30°) gives MORE points; high angle (ANGLE_MAX 70°) gives fewer
// BONUS_ANGLE_LOW_MULT / BONUS_ANGLE_HIGH_MULT = 2 (30° scores 2× vs 70°)
export const BONUS_ANGLE_LOW_MULT  = 1.5;   // multiplier at ANGLE_MIN (30°)
export const BONUS_ANGLE_HIGH_MULT = 0.75;  // multiplier at ANGLE_MAX (70°)

// === Phase 2 — telegraph ===
export const SPAWN_TELEGRAPH_EASY_S = 0.7;   // L1-L3
export const SPAWN_TELEGRAPH_HARD_S = 0.5;   // L4+

// === Phase 2 — waves ===
export const WAVE_BUILD_DUR_S = 14;
export const WAVE_PEAK_DUR_S  = 8;
export const WAVE_RELEASE_DUR_S = 8;
export const WAVE_BUILD_SPAWN_MULT = 1.0;
export const WAVE_PEAK_SPAWN_MULT  = 0.6;
export const WAVE_RELEASE_SPAWN_MULT = 1.8;

// === Level completion gating ===
// All three must hold (plus phase === RELEASE) before a level completes:
//   levelScore >= scoreThreshold
//   intercepts  >= minIntercepts
//   wavesCompleted >= minWaves
// Defaults used if a level config omits minIntercepts / minWaves.
export const DEFAULT_LEVEL_MIN_INTERCEPTS = 10;
export const DEFAULT_LEVEL_MIN_WAVES = 2;

// === Phase 4 — event missiles ===
export const COURIER_VY_MIN = -50;
export const COURIER_VY_MAX = -35;
export const COURIER_SCORE_MULT = 1.5;
export const SPLITTER_SPLIT_Y = 60;          // when y < this and still alive, split
export const SPLITTER_CHILD_VX = 15;
export const SPLITTER_CHILD_VY = -5;
export const MIRV_SPLIT_AFTER_S = 1.5;
export const MIRV_SPREAD_DEG = 20;

// Missile visual
export const MISSILE_BODY_H = 22;
export const MISSILE_BODY_W = 8;
export const MISSILE_NOSE_H = 12;
export const MISSILE_FIN_W  = 7;
export const MISSILE_FIN_H  = 9;
export const MISSILE_DANGER_GLOW_START_M = 40;  // below this altitude, missile starts glowing red

// Per-kind color tables
export const MISSILE_COLORS = {
  standard: { body: '#c82828', stroke: '#ff5555', core: '#ff8844', trail: 'rgba(255,120,60,' },
  courier:  { body: '#e0a820', stroke: '#ffd755', core: '#fff1a0', trail: 'rgba(255,220,100,' },
  splitter: { body: '#8a2ad8', stroke: '#c670ff', core: '#ff88ff', trail: 'rgba(200,120,255,' },
  mirv:     { body: '#d8265a', stroke: '#ff6b9d', core: '#ffa8c0', trail: 'rgba(255,120,170,' },
  medic:    { body: '#2eb82e', stroke: '#33ff33', core: '#aaffaa', trail: 'rgba(100,255,100,' },
};

// === Phase 5 — Aegis Recovery Protocol ===
export const AEGIS_MAX = 100;
export const AEGIS_BASE_HEAL = 20;
export const AEGIS_OVERHEALTH_MAX = 150;
export const AEGIS_EMP_HEAL = 30;

export const ENERGY_LOW_ANGLE = 10;
export const ENERGY_HIGH_ALT = 5;
export const ENERGY_GRAZE = 5;
export const ENERGY_COURIER = 35;
export const ENERGY_SCRAP = 40;
export const ENERGY_MEDIC = 100;
export const ENERGY_COMBO_3 = 10;
export const ENERGY_COMBO_5 = 25;

export const COLOR_AEGIS_GAUGE = '#00ffff';
export const COLOR_AEGIS_FLASH = '#ffffff';
export const COLOR_GRID_SHIELD = 'rgba(68,170,255,0.4)';
export const COLOR_OVERHEALTH = '#ffd700';
