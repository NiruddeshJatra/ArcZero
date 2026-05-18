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

  const left      = document.getElementById('mc-left');
  const right     = document.getElementById('mc-right');
  const angleUp   = document.getElementById('mc-angle-up');
  const angleDown = document.getElementById('mc-angle-down');
  const fire      = document.getElementById('mc-fire');

  left.addEventListener('touchstart',  (e) => { e.preventDefault(); keys.left = true; },  { passive: false });
  left.addEventListener('touchend',    (e) => { e.preventDefault(); keys.left = false; }, { passive: false });
  left.addEventListener('touchcancel', () => { keys.left = false; });

  right.addEventListener('touchstart',  (e) => { e.preventDefault(); keys.right = true; },  { passive: false });
  right.addEventListener('touchend',    (e) => { e.preventDefault(); keys.right = false; }, { passive: false });
  right.addEventListener('touchcancel', () => { keys.right = false; });

  angleUp.addEventListener('touchstart',  (e) => { e.preventDefault(); keys.up = true; },  { passive: false });
  angleUp.addEventListener('touchend',    (e) => { e.preventDefault(); keys.up = false; }, { passive: false });
  angleUp.addEventListener('touchcancel', () => { keys.up = false; });

  angleDown.addEventListener('touchstart',  (e) => { e.preventDefault(); keys.down = true; },  { passive: false });
  angleDown.addEventListener('touchend',    (e) => { e.preventDefault(); keys.down = false; }, { passive: false });
  angleDown.addEventListener('touchcancel', () => { keys.down = false; });

  fire.addEventListener('touchstart',  (e) => { e.preventDefault(); keys.space = true; }, { passive: false });
  fire.addEventListener('touchend',    (e) => {
    e.preventDefault();
    keys.space = false;
    keys.spaceJustReleased = true;
    const s = getActiveState?.();
    if (s) s.inputType = 'touch';
  }, { passive: false });
  fire.addEventListener('touchcancel', () => {
    keys.space = false;
    keys.spaceJustReleased = true;
  });
}

/** Returns true when touch input should be active based on settings. */
export function shouldUseTouchInput(settings) {
  const mode = settings?.mobileTouchMode ?? 'auto';
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return 'ontouchstart' in window;
}
