import {
  DT,
  SHAKE_AMP_GAMEOVER,
  SHAKE_DUR_GAMEOVER,
  COMBO_DECAY_DUR_S,
  COMBO_MULT_CAP,
  WAVE_BUILD_DUR_S,
  WAVE_PEAK_DUR_S,
  WAVE_RELEASE_DUR_S,
  WAVE_BUILD_SPAWN_MULT,
  WAVE_PEAK_SPAWN_MULT,
  WAVE_RELEASE_SPAWN_MULT,
  PASSIVE_SCORE_RATE_V2,
  LEVEL_CLEAR_BONUS,
  DEFAULT_LEVEL_MIN_INTERCEPTS,
  DEFAULT_LEVEL_MIN_WAVES,
} from './constants.js';
import { LEVELS } from './levels.js';
import { stepPhysics } from './physics.js';
import { processInput } from './input.js';
import { updateSpawner } from './spawner.js';
import {
  checkCollisions,
  checkMissileGroundHit,
  checkInterceptorBounds,
} from './collision.js';
import { render, updateHUD, triggerShake } from './renderer.js';
import { playGameOver, playWaveWarning, playWaveStart, playLevelClear, startPeakBed, stopPeakBed } from './audio.js';
import { FLAGS } from './flags.js';
import { loadSave, updateBest } from './persistence.js';

const PHASE_DUR = { BUILD: WAVE_BUILD_DUR_S, PEAK: WAVE_PEAK_DUR_S, RELEASE: WAVE_RELEASE_DUR_S };
const NEXT_PHASE = { BUILD: 'PEAK', PEAK: 'RELEASE', RELEASE: 'BUILD' };
const SPAWN_MULT = { BUILD: WAVE_BUILD_SPAWN_MULT, PEAK: WAVE_PEAK_SPAWN_MULT, RELEASE: WAVE_RELEASE_SPAWN_MULT };

/**
 * Start the game loop. Returns a handle with stop().
 * onLevelComplete(level, health) is called when the player completes a level.
 */
/**
 * Build the run-result object passed to onGameOver.
 */
function buildRunResult(state) {
  return {
    score: Math.floor(state.score),
    level: state.level,
    longestChain: state.combo.best,
    closestMissM: state.stats.closestMissM,
    intercepts: state.stats.intercepts,
    survivedS: state.totalElapsedS,
    seed: state.mode === 'daily' ? state.seed : null,
    dateISO: state.dateISO ?? new Date().toISOString().slice(0, 10),
  };
}

/**
 * Start the game loop. Returns a handle with stop().
 * callbacks: { onLevelComplete(level, health), onGameOver(runResult) }
 */
export function startGameLoop(ctx, state, keys, callbacks = {}) {
  const onLevelComplete = callbacks.onLevelComplete ?? (() => {});
  const onGameOver      = callbacks.onGameOver      ?? (() => {});
  const onToast         = callbacks.onToast         ?? (() => {});

  let lastTime = null;
  let accumulator = 0;
  let animFrameId = null;
  let stopped = false;

  function tick(timestamp) {
    if (stopped) return;

    if (lastTime === null) lastTime = timestamp;
    const elapsed = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Cap accumulator — prevents spiral of death on tab switch
    accumulator += Math.min(elapsed, 0.25);

    // Pause gate: freeze sim + render paused overlay, but keep rAF alive so unpause is instant.
    if (state.paused) {
      accumulator = 0;
      lastTime = timestamp;
      render(ctx, state);
      animFrameId = requestAnimationFrame(tick);
      return;
    }

    while (accumulator >= DT) {
      if (!state.running) break;
      gameTick(state, keys, ctx);
      accumulator -= DT;
    }

    // Drain in-game milestone toasts
    while (state.pendingToasts.length > 0) {
      onToast(state.pendingToasts.shift());
    }

    if (!state.running) {
      if (state.levelComplete) {
        onLevelComplete(state.level, state.health);
      } else {
        // Persist best and notify
        const runResult = buildRunResult(state);
        const save = loadSave();
        updateBest(save, runResult);
        state.lastRun = runResult;
        onGameOver(runResult);
      }
      return;
    }

    animFrameId = requestAnimationFrame(tick);
  }

  animFrameId = requestAnimationFrame(tick);

  return {
    stop() {
      stopped = true;
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    },
  };
}

/**
 * One deterministic game tick. Strict order per spec.
 */
function gameTick(state, keys, ctx) {
  // Shake decay
  if (state.shake.dur > 0) {
    state.shake.elapsed += DT;
    if (state.shake.elapsed >= state.shake.dur) state.shake = { amp: 0, dur: 0, elapsed: 0 };
  }
  // Flash decay
  if (state.flash.dur > 0) {
    state.flash.elapsed += DT;
    if (state.flash.elapsed >= state.flash.dur) state.flash = { color: null, dur: 0, elapsed: 0 };
  }
  // Hitstop gate: skip simulation, render only
  if (state.hitstopRemainingS > 0) {
    state.hitstopRemainingS = Math.max(0, state.hitstopRemainingS - DT);
    render(ctx, state);
    return;
  }

  // Combo decay
  if (state.combo.timerS > 0) {
    state.combo.timerS -= DT;
    if (state.combo.timerS <= 0) {
      state.combo.decaying = true;
      state.combo.timerS = 0;
    }
  } else if (state.combo.decaying) {
    const step = (COMBO_MULT_CAP - 1) / (COMBO_DECAY_DUR_S / DT);
    state.combo.multiplier = Math.max(1.0, state.combo.multiplier - step);
    if (state.combo.multiplier <= 1.0) {
      state.combo.count = 0;
      state.combo.decaying = false;
    }
  }

  // Floater aging
  for (const f of state.floaters) f.age += DT;
  state.floaters = state.floaters.filter(f => f.age < f.maxAge);

  // Wave tick
  state.wave.elapsedS += DT;
  const phaseDur = PHASE_DUR[state.wave.phase];
  if (state.wave.elapsedS >= phaseDur) {
    state.wave.elapsedS = 0;
    state.wave.phase = NEXT_PHASE[state.wave.phase];
    if (state.wave.phase === 'PEAK') { playWaveWarning(); playWaveStart(); startPeakBed(); }
    if (state.wave.phase === 'RELEASE') stopPeakBed();
    if (state.wave.phase === 'BUILD') {
      state.wave.index += 1;
      // L10 endless ramp: each completed wave escalates difficulty
      const lvlCfg = LEVELS[state.level];
      if (lvlCfg.escalatesPeak) {
        lvlCfg.missileVyMin = Math.max(-60, lvlCfg.missileVyMin - 1);
        lvlCfg.spawnInterval = Math.max(1.2, lvlCfg.spawnInterval - 0.02);
      }
    }
  }
  const baseInt = LEVELS[state.level].spawnInterval;
  state.currentSpawnInterval = baseInt * SPAWN_MULT[state.wave.phase];

  // 1. Input
  processInput(state, keys);

  // 2. Spawn
  updateSpawner(state);

  // 3. Physics
  stepPhysics(state);

  // 4. Ground/bounds checks
  checkMissileGroundHit(state);
  checkInterceptorBounds(state);

  // 5. Collision
  checkCollisions(state);
  checkInGameMilestones(state);

  // 6. Cleanup — filter dead objects
  state.missiles = state.missiles.filter((m) => m.alive);
  state.interceptors = state.interceptors.filter((i) => i.alive);

  // 7. Update explosions
  for (const exp of state.explosions) exp.age += DT;
  state.explosions = state.explosions.filter((e) => e.age < e.maxAge);

  // 8. Survival scoring (passive)
  const passiveRate = FLAGS.SCORE_REBALANCE ? PASSIVE_SCORE_RATE_V2 : 1.0;
  state.score += passiveRate * DT;
  state.totalElapsedS += DT;

  // 9. Level advancement — all gates must hold, and only during RELEASE wave phase.
  const config = LEVELS[state.level];
  const levelScore      = state.score - state.levelStartScore;
  const levelIntercepts = state.stats.intercepts - state.levelStartIntercepts;
  const wavesCompleted  = state.wave.index - state.levelStartWaveIndex;
  const minIntercepts   = config.minIntercepts ?? DEFAULT_LEVEL_MIN_INTERCEPTS;
  const minWaves        = config.minWaves      ?? DEFAULT_LEVEL_MIN_WAVES;
  const scoreDone       = levelScore >= config.scoreThreshold;
  const interceptsDone  = levelIntercepts >= minIntercepts;
  const wavesDone       = wavesCompleted >= minWaves;
  state.levelProgress = { scoreDone, interceptsDone, wavesDone, levelScore, levelIntercepts, wavesCompleted };
  if (scoreDone && interceptsDone && wavesDone && state.wave.phase === 'RELEASE') {
    if (FLAGS.SCORE_REBALANCE) {
      const bonus = LEVEL_CLEAR_BONUS * state.level;
      state.score += bonus;
      state.floaters.push({ x: 100, y: 75, text: `+${bonus} LEVEL CLEAR`, mult: 1, age: 0, maxAge: 1.5 });
    }
    playLevelClear();
    state.levelComplete = true;
    state.running = false;
    return;
  }

  // 10. Game over check
  if (state.health <= 0) {
    state.health = 0;
    state.running = false;
    triggerShake(state, SHAKE_AMP_GAMEOVER, SHAKE_DUR_GAMEOVER);
    playGameOver();
  }

  // 11. Render
  render(ctx, state);
  updateHUD(state);
}

// ── In-game (state-only) milestone check ─────────────────────────────────────
// These milestones can be evaluated from state alone — no save needed.
// Triggered toasts pushed to state.pendingToasts for main.js to drain.
const STATE_MILESTONES = [
  { id: 'first_intercept',  condition: (s) => s.stats.intercepts >= 1,  toast: 'First blood.' },
  { id: 'ten_intercepts',   condition: (s) => s.stats.intercepts >= 10, toast: '10 down.' },
  { id: 'minute_survived',  condition: (s) => s.totalElapsedS >= 60,    toast: 'One minute.' },
  { id: 'first_level_up',   condition: (s) => s.level >= 2,             toast: 'You climb.' },
  { id: 'chain_5',          condition: (s) => s.combo.best >= 5,        toast: '×5 chain.' },
  { id: 'chain_10',         condition: (s) => s.combo.best >= 10,       toast: '×10 chain. Machine.' },
];

function checkInGameMilestones(state) {
  state._triggeredMilestones = state._triggeredMilestones ?? new Set();
  for (const m of STATE_MILESTONES) {
    if (!state._triggeredMilestones.has(m.id) && m.condition(state)) {
      state._triggeredMilestones.add(m.id);
      state.pendingToasts.push(m.toast);
    }
  }
}
