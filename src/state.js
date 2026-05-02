import {
  LAUNCHER_START_X,
  ANGLE_START,
  POWER_START,
  BASE_HEALTH,
  WORLD_HEIGHT,
  FACING_RIGHT,
  RANKING_MODES,
} from './constants.js';
import { LEVELS } from './levels.js';

/**
 * Return a fresh escalation snapshot for a level.
 * Mutable per-run so L10 endless ramp never touches the shared LEVELS array.
 */
export function initialEscalation(level) {
  const cfg = LEVELS[level];
  return {
    vyMin: cfg.missileVyMin,
    spawnInterval: cfg.spawnInterval,
  };
}

function normalizeRunTotals(totals) {
  const source = totals || {};
  return {
    intercepts: source.intercepts ?? 0,
    survivedS: source.survivedS ?? 0,
    longestChain: source.longestChain ?? 0,
    closestMissM: source.closestMissM ?? Infinity,
    waveStats: source.waveStats ?? [],
  };
}

export function collectRunTotals(state) {
  const carried = normalizeRunTotals(state.runTotals);
  return {
    intercepts: carried.intercepts + (state.stats?.intercepts ?? 0),
    survivedS: carried.survivedS + (state.totalElapsedS ?? 0),
    longestChain: Math.max(carried.longestChain, state.combo?.best ?? 0),
    closestMissM: Math.min(carried.closestMissM, state.stats?.closestMissM ?? Infinity),
    waveStats: [...carried.waveStats, ...(state.stats?.waveStats ?? [])],
  };
}

/**
 * Creates a fresh game state for the given level.
 * Pass carryHealth to preserve health across level transitions.
 */
export function createState(level = 1, carryHealth = BASE_HEALTH, carryScore = 0, carryAegis = null, carryRunTotals = null) {
  const safeLvl = Math.max(1, level);
  return {
    running: true,
    paused: false,
    tick: 0,
    score: carryScore,
    health: carryHealth,
    level: safeLvl,
    startLevel: 1,
    levelStartScore: carryScore,
    levelStartIntercepts: 0,
    levelStartWaveIndex: 0,
    levelComplete: false,
    advanceGraceRemaining: null, // null = not started; >0 = counting down to advance
    criteriaCleared: false,      // LEVELRUN: true once all 3 gates first met (unlocks next level at death)
    aegis: carryAegis ?? { energy: 0, activeShield: false, broken: false },
    // Per-run escalation snapshot — isolates L10 ramp from the shared LEVELS array.
    escalation: initialEscalation(safeLvl),
    levelMedicSpawned: false,
    _triggeredMilestones: new Set(),
    scrapOrbs: [],
    launcher: {
      x: LAUNCHER_START_X,
      y: 0,
      angle: ANGLE_START,
      power: POWER_START,
      charging: false,
      fireCooldown: 0,
      facing: FACING_RIGHT,   // -1 or +1; hooked up in Phase 1
      recoilPx: 0,            // Phase 1 visual
      recoilTimer: 0,         // Phase 1 visual
      muzzleFlashTimer: 0,    // Phase 1 visual
    },
    missiles: [],
    interceptors: [],
    spawnTimer: 0,
    explosions: [],
    shake: { amp: 0, dur: 0, elapsed: 0 },
    flash: { color: null, dur: 0, elapsed: 0 },
    hitstopRemainingS: 0,
    stats: { intercepts: 0, shots: 0, nearMisses: 0, closestMissM: Infinity, longestChain: 0, waveStats: [] },
    runTotals: normalizeRunTotals(carryRunTotals),
    settings: { reduceMotion: false, showTrajectoryPreview: true },
    combo: { count: 0, timerS: 0, multiplier: 1.0, best: 0, decaying: false, lastCalloutAt: 0 },
    floaters: [],
    warnings: [],
    wave: { phase: 'BUILD', elapsedS: 0, index: 0 },
    currentSpawnInterval: LEVELS[safeLvl].spawnInterval,
    totalElapsedS: 0,
    mode: RANKING_MODES.CAMPAIGN,
    seed: null,
    dateISO: null,
    rankingMode: RANKING_MODES.CAMPAIGN,
    dailyModifier: null,
    modifierOverrideTrajectory: false,
    inputType: 'kbd',
    menuOpen: true,
    menuScreen: 'main',
    lastRun: null,
    particles: [],
    pendingToasts: [],
  };
}

let _missileIdCounter = 0;

/**
 * Creates a new enemy missile at x, falling from top of world.
 * vy and vx default to 0 (pure free-fall) for Level 1 / backwards compat.
 */
export function createMissile(x, vy = 0, vx = 0, kind = 'standard') {
  return {
    id: ++_missileIdCounter,
    x,
    y: WORLD_HEIGHT,
    vx,
    vy,
    kind,
    alive: true,
    ageS: 0,
    hasSplit: false,
    trail: [],
    // eslint-disable-next-line no-restricted-properties -- visual seed only
    wobblePhase: Math.random() * Math.PI * 2,
  };
}

/**
 * Creates a new interceptor fired from launcher position.
 * launchAngle (degrees) is stored for scoring purposes.
 */
export function createInterceptor(x, vx, vy, launchAngle = ANGLE_START) {
  return {
    x,
    y: 0,
    vx,
    vy,
    alive: true,
    trail: [],
    launchAngle,
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
