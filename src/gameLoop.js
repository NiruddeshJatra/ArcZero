import { DT } from './constants.js';
import { LEVELS } from './levels.js';
import { stepPhysics } from './physics.js';
import { processInput } from './input.js';
import { updateSpawner } from './spawner.js';
import {
  checkCollisions,
  checkMissileGroundHit,
  checkInterceptorBounds,
} from './collision.js';
import { render, updateHUD, showGameOver } from './renderer.js';
import { playGameOver } from './audio.js';

/**
 * Start the game loop. Returns a handle with stop().
 * onLevelComplete(level, health) is called when the player completes a level.
 */
export function startGameLoop(ctx, state, keys, onLevelComplete = () => {}) {
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

    while (accumulator >= DT) {
      if (!state.running) break;
      gameTick(state, keys, ctx);
      accumulator -= DT;
    }

    if (!state.running) {
      if (state.levelComplete) {
        onLevelComplete(state.level, state.health);
      } else {
        showGameOver(state.score);
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

  // 6. Cleanup — filter dead objects
  state.missiles = state.missiles.filter((m) => m.alive);
  state.interceptors = state.interceptors.filter((i) => i.alive);

  // 7. Update explosions
  for (const exp of state.explosions) exp.age += DT;
  state.explosions = state.explosions.filter((e) => e.age < e.maxAge);

  // 8. Survival scoring
  state.score += DT;

  // 9. Level advancement check
  const levelScore = state.score - state.levelStartScore;
  const config = LEVELS[state.level];
  if (levelScore >= config.scoreThreshold) {
    state.levelComplete = true;
    state.running = false;
    return;
  }

  // 10. Game over check
  if (state.health <= 0) {
    state.health = 0;
    state.running = false;
    playGameOver();
  }

  // 11. Render
  render(ctx, state);
  updateHUD(state);
}
