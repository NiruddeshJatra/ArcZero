/**
 * Regression tests — guard against re-introducing fixed bugs.
 * Each test corresponds to a specific issue from the pre-production audit.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createState, initialEscalation } from '../src/state.js';
import { LEVELS } from '../src/levels.js';
import { updateSpawner } from '../src/spawner.js';
import { seed } from '../src/rng.js';
import { loadSave, saveBoards, loadBoards } from '../src/persistence.js';
import { DT } from '../src/constants.js';

beforeEach(() => localStorage.clear());

// ── BLOCKER 1: LEVELS[10] mutation ────────────────────────────────────────────
describe('L10 escalation isolation', () => {
  it('escalation stored in state, not in LEVELS[10]', () => {
    const originalVyMin = LEVELS[10].missileVyMin;
    const originalInterval = LEVELS[10].spawnInterval;

    const state = createState(10);
    // Simulate 5 wave escalation ticks
    for (let i = 0; i < 5; i++) {
      if (LEVELS[state.level].escalatesPeak) {
        state.escalation.vyMin = Math.max(-60, state.escalation.vyMin - 1);
        state.escalation.spawnInterval = Math.max(1.2, state.escalation.spawnInterval - 0.02);
      }
    }

    // LEVELS[10] must be untouched
    expect(LEVELS[10].missileVyMin).toBe(originalVyMin);
    expect(LEVELS[10].spawnInterval).toBe(originalInterval);
    // State escalation must have changed
    expect(state.escalation.vyMin).toBeLessThan(originalVyMin);
    expect(state.escalation.spawnInterval).toBeLessThan(originalInterval);
  });

  it('second run starts with fresh escalation', () => {
    const state1 = createState(10);
    // Escalate state1 significantly
    for (let i = 0; i < 20; i++) {
      state1.escalation.vyMin = Math.max(-60, state1.escalation.vyMin - 1);
    }

    // New run — fresh state
    const state2 = createState(10);
    expect(state2.escalation.vyMin).toBe(LEVELS[10].missileVyMin);
    expect(state2.escalation.spawnInterval).toBe(LEVELS[10].spawnInterval);
  });

  it('initialEscalation clones level values', () => {
    const esc = initialEscalation(10);
    esc.vyMin = -999;
    expect(LEVELS[10].missileVyMin).not.toBe(-999);
  });

  it('spawner uses state.escalation.vyMin for L10 vy', () => {
    seed(42);
    const state = createState(10);
    state.level = 10;
    // Force escalation floor
    state.escalation.vyMin = -60;
    state.spawnTimer = LEVELS[10].spawnInterval - DT;

    // Drain telegraph immediately
    updateSpawner(state);
    for (const w of state.warnings) w.remainingS = 0;
    updateSpawner(state);

    const missile = state.missiles[0];
    if (missile) {
      // vy must be >= escalated vyMin (-60), not original (-35)
      expect(missile.vy).toBeGreaterThanOrEqual(-60);
    }
  });

  it('escalation floor clamps at -60 vy and 1.2s interval', () => {
    const state = createState(10);
    // Escalate past floor
    for (let i = 0; i < 100; i++) {
      state.escalation.vyMin = Math.max(-60, state.escalation.vyMin - 1);
      state.escalation.spawnInterval = Math.max(1.2, state.escalation.spawnInterval - 0.02);
    }
    expect(state.escalation.vyMin).toBe(-60);
    expect(state.escalation.spawnInterval).toBeCloseTo(1.2, 5);
  });
});

// ── BLOCKER 3: saveBoards missing try/catch ───────────────────────────────────
describe('saveBoards graceful failure', () => {
  it('does not throw when localStorage is full', () => {
    // Simulate quota exceeded
    const original = localStorage.setItem.bind(localStorage);
    localStorage.setItem = vi.fn(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });

    const boards = loadBoards();
    // Should not throw — must swallow the error
    expect(() => saveBoards(boards)).not.toThrow();

    localStorage.setItem = original;
  });

  it('loadBoards returns empty structure when corrupt', () => {
    localStorage.setItem('arczero.localBoards.v1', '{invalid json}');
    const boards = loadBoards();
    expect(boards).toMatchObject({ daily: {}, allTime: [], levelRuns: {} });
  });
});

// ── createState — all required fields present ─────────────────────────────────
describe('createState completeness', () => {
  it('levelMedicSpawned initialised to false', () => {
    const state = createState(9);
    expect(state.levelMedicSpawned).toBe(false);
  });

  it('_triggeredMilestones initialised as Set', () => {
    const state = createState(1);
    expect(state._triggeredMilestones).toBeInstanceOf(Set);
    expect(state._triggeredMilestones.size).toBe(0);
  });

  it('escalation initialised from level config', () => {
    for (let lvl = 1; lvl <= 10; lvl++) {
      const state = createState(lvl);
      expect(state.escalation.vyMin).toBe(LEVELS[lvl].missileVyMin);
      expect(state.escalation.spawnInterval).toBe(LEVELS[lvl].spawnInterval);
    }
  });

  it('health resets to BASE_HEALTH on every createState', () => {
    const s1 = createState(1, 60); // carry 60
    expect(s1.health).toBe(60);
    const s2 = createState(2);     // fresh — default 100
    expect(s2.health).toBe(100);
  });
});

// ── Input — spaceWasDown reset ────────────────────────────────────────────────
describe('keys.reset clears spaceWasDown', () => {
  it('reset() zeros spaceWasDown', async () => {
    const { initInput } = await import('../src/input.js');
    const keys = initInput();
    keys.spaceWasDown = true;
    keys.reset();
    expect(keys.spaceWasDown).toBe(false);
  });
});

// ── Medic spawn gating ────────────────────────────────────────────────────────
describe('medic missile spawn', () => {
  it('spawns at most once per level on L9+ PEAK', () => {
    seed(1);
    const state = createState(9);
    state.wave = { phase: 'PEAK', elapsedS: 0, index: 0 };
    state.currentSpawnInterval = 0.1;

    // Force multiple spawns
    for (let i = 0; i < 20; i++) {
      state.spawnTimer = 0.1; // at threshold
      updateSpawner(state);
    }
    // Drain warnings
    for (const w of state.warnings) w.remainingS = 0;
    updateSpawner(state);

    const medics = state.missiles.filter(m => m.kind === 'medic');
    expect(medics.length).toBeLessThanOrEqual(1);
  });

  it('does not spawn medic on L8', () => {
    seed(1);
    const state = createState(8);
    state.wave = { phase: 'PEAK', elapsedS: 0, index: 0 };
    state.currentSpawnInterval = 0.1;

    for (let i = 0; i < 10; i++) {
      state.spawnTimer = 0.1;
      updateSpawner(state);
    }
    for (const w of state.warnings) w.remainingS = 0;
    updateSpawner(state);

    const medics = state.missiles.filter(m => m.kind === 'medic');
    expect(medics.length).toBe(0);
  });
});

// ── Persistence — loadSave graceful degradation ───────────────────────────────
describe('loadSave graceful degradation', () => {
  it('returns default save when localStorage is empty', () => {
    const save = loadSave();
    expect(save.progress.unlockedStartLevels).toContain(1);
    expect(save.best.allTime.score).toBe(0);
  });

  it('returns default save when localStorage is corrupt', () => {
    localStorage.setItem('arczero.save.v1', 'not-json');
    const save = loadSave();
    expect(save.progress.unlockedStartLevels).toContain(1);
  });

  it('forward-merges missing fields from default', () => {
    // Old save without audioVolumes
    const old = { schemaVersion: 2, player: { anonId: 'x', createdAt: 0, displayName: null }, best: { allTime: { score: 500, level: 3, date: null, seed: null }, perLevel: {}, longestChain: 3, closestMissM: 5, totalIntercepts: 10, totalSurvivedS: 120 }, progress: { highestLevelReached: 3, unlockedStartLevels: [1, 2, 3], sessionsPlayed: 5, lastSessionAt: null, milestones: {} }, settings: { reduceMotion: false, soundVolume: 0.8, mobileTouchMode: 'auto', tapToFire: false, colorblindMode: 'off', showTrajectoryPreview: true }, streak: { current: 1, best: 1, lastPlayDateISO: null, shield: true }, daily: { lastCompletedDateISO: null, lastScore: 0, lastSeed: null } };
    localStorage.setItem('arczero.save.v1', JSON.stringify(old));
    const save = loadSave();
    // audioVolumes should be merged from default
    expect(save.settings.audioVolumes).toBeDefined();
    expect(save.settings.audioVolumes.master).toBe(1);
  });
});
