import { createState } from './state.js';
import { initInput } from './input.js';
import { startGameLoop } from './gameLoop.js';
import {
  hideGameOver,
  showLevelIntro,
  hideLevelIntro,
  updateCountdown,
} from './renderer.js';
import { initAudio, playLevelUp } from './audio.js';
import { LEVELS } from './levels.js';
import { BASE_HEALTH } from './constants.js';

let canvas, ctx, keys, loop;

function bootstrap() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  // Pre-warm AudioContext on first keydown (browser autoplay policy)
  document.addEventListener('keydown', () => initAudio(), { once: true });

  keys = initInput();

  document.getElementById('restart-btn').addEventListener('click', () => {
    loop.stop();
    hideGameOver();
    keys.reset();
    startLevel(1);
  });

  startLevel(1);
}

/**
 * Show level intro countdown, then start the game loop for that level.
 * carryHealth: health carried over from the previous level (defaults to full).
 */
function startLevel(level, carryHealth = BASE_HEALTH) {
  const safeLevel = Math.min(level, LEVELS.length - 1);
  showLevelIntro(safeLevel);

  let count = 3;

  const tick = () => {
    count--;
    if (count <= 0) {
      hideLevelIntro();
      const state = createState(safeLevel, carryHealth);
      loop = startGameLoop(ctx, state, keys, (completedLevel, finalHealth) => {
        loop.stop();
        keys.reset();
        playLevelUp();
        startLevel(completedLevel + 1, finalHealth);
      });
    } else {
      updateCountdown(count);
      setTimeout(tick, 1000);
    }
  };

  setTimeout(tick, 1000); // "3" shows for 1s, then 2, 1, start
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
