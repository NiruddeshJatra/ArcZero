import {
  WORLD_WIDTH, WORLD_HEIGHT,
  ANGLE_MIN, ANGLE_MAX,
  POWER_MIN, POWER_MAX,
  LAUNCHER_X_MIN, LAUNCHER_X_MAX,
  FACING_LEFT, FACING_RIGHT,
} from './constants.js';

/**
 * Attach touch controls to the canvas.
 * Touch-start: begin charging, auto-face.
 * Touch-move:  aim angle + power from drag distance.
 * Touch-end:   fire (simulate space release).
 */
export function initTouchInput(canvas, state, keys) {
  let dragging = false;
  let dragStart = null;

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      tx: (clientX - rect.left) / rect.width * WORLD_WIDTH,
      ty: (1 - (clientY - rect.top) / rect.height) * WORLD_HEIGHT,
    };
  }

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const { tx, ty } = toWorld(t.clientX, t.clientY);
    dragging = true;
    dragStart = { x: tx, y: ty };
    state.launcher.charging = true;
    state.launcher.facing = tx < state.launcher.x ? FACING_LEFT : FACING_RIGHT;
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    const t = e.touches[0];
    const { tx, ty } = toWorld(t.clientX, t.clientY);

    state.launcher.x = Math.max(LAUNCHER_X_MIN, Math.min(LAUNCHER_X_MAX, tx));
    state.launcher.facing = tx < dragStart.x ? FACING_LEFT : FACING_RIGHT;

    const dx = tx - dragStart.x;
    const dy = ty;
    const ang = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
    state.launcher.angle = Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, ang));

    const dragDist = Math.hypot(tx - dragStart.x, ty - dragStart.y);
    state.launcher.power = Math.max(POWER_MIN, Math.min(POWER_MAX, POWER_MIN + dragDist * 2));
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (!dragging) return;
    e.preventDefault();
    dragging = false;
    keys.spaceJustReleased = true;
    state.launcher.charging = false;
    state.inputType = 'touch';
  }, { passive: false });
}

/** Returns true when touch input should be active based on settings. */
export function shouldUseTouchInput(settings) {
  const mode = settings?.mobileTouchMode ?? 'auto';
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return 'ontouchstart' in window;
}
