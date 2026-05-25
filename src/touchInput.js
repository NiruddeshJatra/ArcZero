import { FACING_LEFT, FACING_RIGHT } from './constants.js';

/**
 * Wire on-screen mobile controls to key flags.
 * Canvas touch is passive (display-only); all input flows through buttons.
 * Call once from bootstrap() — not per level — to avoid listener accumulation.
 *
 * @param {object} keys - shared key-state object from initInput()
 * @param {function} getActiveState - returns the current game state (or null when not in game)
 */
export function initMobileControls(keys, getActiveState) {
  const controls = document.getElementById('mobile-controls');
  if (!controls) return;

  function bindTouchButton(id, onDown, onUp) {
    const el = document.getElementById(id);
    el.addEventListener('touchstart',  (e) => { e.preventDefault(); onDown(); }, { passive: false });
    el.addEventListener('touchend',    (e) => { e.preventDefault(); onUp(); },   { passive: false });
    el.addEventListener('touchcancel', () => onUp());
  }

  bindTouchButton('mc-left',       () => { keys.left = true; },  () => { keys.left = false; });
  bindTouchButton('mc-right',      () => { keys.right = true; }, () => { keys.right = false; });
  bindTouchButton('mc-angle-up',   () => { keys.up = true; },    () => { keys.up = false; });
  bindTouchButton('mc-angle-down', () => { keys.down = true; },  () => { keys.down = false; });

  const fire = document.getElementById('mc-fire');
  fire.addEventListener('touchstart', (e) => { e.preventDefault(); keys.space = true; }, { passive: false });
  fire.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys.space = false;
    keys.spaceJustReleased = true;
    const s = getActiveState?.();
    if (s) s.inputType = 'touch';
  }, { passive: false });
  // touchcancel = OS-interrupted gesture; clear charge but don't fire
  fire.addEventListener('touchcancel', () => { keys.space = false; });

  const flip = document.getElementById('mc-flip');
  if (flip) {
    flip.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const s = getActiveState?.();
      if (s) s.launcher.facing = s.launcher.facing === FACING_RIGHT ? FACING_LEFT : FACING_RIGHT;
    }, { passive: false });
  }
}

/** Returns true when touch input should be active based on settings. */
export function shouldUseTouchInput(settings) {
  const mode = settings?.mobileTouchMode ?? 'auto';
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}
