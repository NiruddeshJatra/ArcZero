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
  FLIP_KEY,
  FACING_RIGHT,
  FACING_LEFT,
  MUZZLE_FLASH_DUR,
  LAUNCHER_RECOIL_DUR,
  LAUNCHER_RECOIL_PX,
} from './constants.js';
import { createInterceptor } from './state.js';
import { playShoot, playDryClick } from './audio.js';

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
    spaceWasDown: false,
    flipJustPressed: false,
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
      default:
        if (e.key.toLowerCase() === FLIP_KEY) keys.flipJustPressed = true;
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
    keys.flipJustPressed = false;
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

  // Facing flip
  if (keys.flipJustPressed) {
    launcher.facing = launcher.facing === FACING_RIGHT ? FACING_LEFT : FACING_RIGHT;
    keys.flipJustPressed = false;
  }

  // Tick down fire cooldown and visual timers
  if (launcher.fireCooldown > 0) {
    launcher.fireCooldown = Math.max(0, launcher.fireCooldown - DT);
  }
  if (launcher.recoilTimer > 0) {
    launcher.recoilTimer = Math.max(0, launcher.recoilTimer - DT);
  }
  if (launcher.muzzleFlashTimer > 0) {
    launcher.muzzleFlashTimer = Math.max(0, launcher.muzzleFlashTimer - DT);
  }

  // Power charging while space held (only when cooldown clear)
  if (keys.space && launcher.fireCooldown === 0) {
    launcher.charging = true;
    launcher.power = Math.min(POWER_MAX, launcher.power + POWER_CHARGE_RATE * DT);
  }

  // Dry click when pressing space during cooldown (once per press)
  if (keys.space && launcher.fireCooldown > 0 && !keys.spaceWasDown) {
    playDryClick();
  }
  keys.spaceWasDown = keys.space;

  // Fire on space release
  if (keys.spaceJustReleased) {
    if (launcher.fireCooldown === 0) {
      const rad = (launcher.angle * Math.PI) / 180;
      const vx = launcher.facing * launcher.power * Math.cos(rad);
      const vy = launcher.power * Math.sin(rad);
      state.interceptors.push(createInterceptor(launcher.x, vx, vy));
      playShoot();
      launcher.fireCooldown = FIRE_COOLDOWN;
      launcher.recoilPx = LAUNCHER_RECOIL_PX;
      launcher.recoilTimer = LAUNCHER_RECOIL_DUR;
      launcher.muzzleFlashTimer = MUZZLE_FLASH_DUR;
      state.stats.shots += 1;
    }
    launcher.charging = false;
    launcher.power = POWER_START;
    keys.spaceJustReleased = false;
  }
}
