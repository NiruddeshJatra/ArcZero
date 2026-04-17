import {
  LAUNCHER_SPEED,
  LAUNCHER_X_MIN,
  LAUNCHER_X_MAX,
  ANGLE_MIN,
  ANGLE_MAX,
  ANGLE_SPEED,
  POWER_MAX,
  POWER_START,
  POWER_CHARGE_RATE,
  FIRE_COOLDOWN,
  DT,
} from './constants.js';
import { createInterceptor } from './state.js';
import { playShoot } from './audio.js';

/**
 * Initialize keyboard listeners. Returns a keys object mutated live.
 * Call once at game start. Use keys.reset() on restart.
 */
export function initInput() {
  const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    space: false,
    spaceJustReleased: false,
  };

  function onKeyDown(e) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
      e.preventDefault();
    }
    switch (e.key) {
      case 'ArrowLeft':  keys.left  = true; break;
      case 'ArrowRight': keys.right = true; break;
      case 'ArrowUp':    keys.up    = true; break;
      case 'ArrowDown':  keys.down  = true; break;
      case ' ':          keys.space = true; break;
    }
  }

  function onKeyUp(e) {
    switch (e.key) {
      case 'ArrowLeft':  keys.left  = false; break;
      case 'ArrowRight': keys.right = false; break;
      case 'ArrowUp':    keys.up    = false; break;
      case 'ArrowDown':  keys.down  = false; break;
      case ' ':
        keys.space = false;
        keys.spaceJustReleased = true;
        break;
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  keys.reset = () => {
    keys.left = false;
    keys.right = false;
    keys.up = false;
    keys.down = false;
    keys.space = false;
    keys.spaceJustReleased = false;
  };

  return keys;
}

/**
 * Process input state into launcher mutations. Called first each tick.
 */
export function processInput(state, keys) {
  const { launcher } = state;

  // Lateral movement
  if (keys.left)  launcher.x -= LAUNCHER_SPEED * DT;
  if (keys.right) launcher.x += LAUNCHER_SPEED * DT;
  launcher.x = Math.max(LAUNCHER_X_MIN, Math.min(LAUNCHER_X_MAX, launcher.x));

  // Angle adjustment
  if (keys.up)   launcher.angle += ANGLE_SPEED * DT;
  if (keys.down) launcher.angle -= ANGLE_SPEED * DT;
  launcher.angle = Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, launcher.angle));

  // Tick down fire cooldown
  if (launcher.fireCooldown > 0) {
    launcher.fireCooldown = Math.max(0, launcher.fireCooldown - DT);
  }

  // Power charging while space held (only when cooldown clear)
  if (keys.space && launcher.fireCooldown === 0) {
    launcher.charging = true;
    launcher.power = Math.min(POWER_MAX, launcher.power + POWER_CHARGE_RATE * DT);
  }

  // Fire on space release
  if (keys.spaceJustReleased) {
    if (launcher.fireCooldown === 0) {
      const rad = (launcher.angle * Math.PI) / 180;
      const vx = launcher.power * Math.cos(rad);
      const vy = launcher.power * Math.sin(rad);
      state.interceptors.push(createInterceptor(launcher.x, vx, vy));
      playShoot();
      launcher.fireCooldown = FIRE_COOLDOWN;
    }
    launcher.charging = false;
    launcher.power = POWER_START;
    keys.spaceJustReleased = false;
  }
}
