import {
  AEGIS_MAX, AEGIS_BASE_HEAL, AEGIS_OVERHEALTH_MAX, AEGIS_EMP_HEAL,
  BASE_HEALTH, COLOR_AEGIS_FLASH,
} from './constants.js';
import { playAegisTrigger, playEmp } from './audio.js';
import { triggerFlash, triggerShake } from './renderer.js';

/**
 * Add energy to the Aegis gauge. Returns false if the system is broken (offline).
 * Callers can use the return value to suppress action feedback when offline.
 */
export function addAegisEnergy(state, amount, reason) {
  if (state.aegis.broken) return false;

  state.aegis.energy += amount;

  if (reason) {
    state.pendingToasts.push(`${reason} +${amount}`);
  }

  if (state.aegis.energy >= AEGIS_MAX) {
    state.aegis.energy = 0;
    if (playAegisTrigger) playAegisTrigger();

    const maxH = state.level >= 10 ? AEGIS_OVERHEALTH_MAX : BASE_HEALTH;
    state.health = Math.min(maxH, state.health + AEGIS_BASE_HEAL);
    state.aegis.justHealed = true;

    state.floaters.push({
      x: state.launcher.x, y: 20,
      text: `+${AEGIS_BASE_HEAL} HP`,
      mult: 1, color: '#00ffff',
      age: 0, maxAge: 1.2,
    });

    if (state.level >= 7) {
      state.aegis.activeShield = true;
      state.pendingToasts.push({ text: 'DEFENSE GRID ONLINE', kind: 'aegis' });
    } else {
      state.pendingToasts.push({ text: `AEGIS DEPLOYED · +${AEGIS_BASE_HEAL} HP`, kind: 'aegis' });
    }

    triggerFlash(state, COLOR_AEGIS_FLASH, 0.4);
    triggerShake(state, 3, 0.25);
  }

  return true;
}

/**
 * EMP Last Stand: triggered when a lethal blow lands at Level 10+ with ≥50 energy.
 * Breaks the gauge permanently for the run.
 */
export function triggerAegisEmp(state) {
  state.health = AEGIS_EMP_HEAL;
  state.aegis.energy = 0;
  state.aegis.broken = true;
  if (playEmp) playEmp();
  triggerFlash(state, COLOR_AEGIS_FLASH, 0.5);
  for (const m of state.missiles) { m.alive = false; }
}
