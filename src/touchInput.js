import {
  WORLD_WIDTH, WORLD_HEIGHT,
  ANGLE_MIN, ANGLE_MAX,
  POWER_MIN, POWER_MAX,
  FACING_LEFT, FACING_RIGHT,
} from './constants.js';

/**
 * Attach touch controls to the canvas.
 * Canvas: tap-and-drag = aim direction + power. Release = fire.
 * Launcher movement and facing-flip are handled via on-screen buttons (see initMobileControls).
 */
export function initTouchInput(canvas, state, keys) {
  let dragging = false;

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      tx: (clientX - rect.left) / rect.width * WORLD_WIDTH,
      ty: (1 - (clientY - rect.top) / rect.height) * WORLD_HEIGHT,
    };
  }

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    dragging = true;
    state.launcher.charging = true;
    state.launcher.power = POWER_MIN;
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    const t = e.touches[0];
    const { tx, ty } = toWorld(t.clientX, t.clientY);

    const dx = Math.abs(tx - state.launcher.x);
    const dy = Math.max(0, ty);
    if (dx > 0.1) {
      const ang = Math.atan2(dy, dx) * 180 / Math.PI;
      state.launcher.angle = Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, ang));
    }

    const dragDist = Math.hypot(tx - state.launcher.x, ty);
    state.launcher.power = Math.max(POWER_MIN, Math.min(POWER_MAX, POWER_MIN + dragDist * 0.5));
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (!dragging) return;
    e.preventDefault();
    dragging = false;
    keys.spaceJustReleased = true;
    state.launcher.charging = false;
    state.inputType = 'touch';
  }, { passive: false });

  canvas.addEventListener('touchcancel', () => {
    dragging = false;
    state.launcher.charging = false;
  });
}

/**
 * Initialize on-screen mobile controls: movement buttons (◄ ►) and flip (⇄).
 */
export function initMobileControls(state, keys) {
  const controls = document.getElementById('mobile-controls');
  if (!controls) return;

  const left = document.getElementById('mc-left');
  const right = document.getElementById('mc-right');
  const flip = document.getElementById('mc-flip');

  left.addEventListener('touchstart', (e) => { e.preventDefault(); keys.left = true; }, { passive: false });
  left.addEventListener('touchend', (e) => { e.preventDefault(); keys.left = false; }, { passive: false });
  left.addEventListener('touchcancel', () => { keys.left = false; });

  right.addEventListener('touchstart', (e) => { e.preventDefault(); keys.right = true; }, { passive: false });
  right.addEventListener('touchend', (e) => { e.preventDefault(); keys.right = false; }, { passive: false });
  right.addEventListener('touchcancel', () => { keys.right = false; });

  flip.addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.launcher.facing = state.launcher.facing === FACING_RIGHT ? FACING_LEFT : FACING_RIGHT;
  }, { passive: false });
}

/** Returns true when touch input should be active based on settings. */
export function shouldUseTouchInput(settings) {
  const mode = settings?.mobileTouchMode ?? 'auto';
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return 'ontouchstart' in window;
}
