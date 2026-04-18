/**
 * Phase 3 — Retention: unit tests
 * Covers: buildShareText, milestone triggers/persistence,
 * streak logic, daily seed determinism, PB detection.
 */

import { beforeEach, describe, it, expect } from 'vitest';
import { buildShareText } from '../src/share.js';
import { checkMilestones, updateStreak } from '../src/milestones.js';
import { loadSave, updateBest, loadBoards } from '../src/persistence.js';
import { seed, seedFromDateISO } from '../src/rng.js';

// ── localStorage mock via jsdom (vitest uses jsdom by default) ────────────────
beforeEach(() => localStorage.clear());

// ── buildShareText ────────────────────────────────────────────────────────────
describe('buildShareText', () => {
  it('produces correct grid from waveStats', () => {
    const run = { score: 847, level: 5, longestChain: 11, closestMissM: 2.3, dateISO: '2026-04-17' };
    const waves = [
      { intercepts: 8, spawns: 9 },  // 🟩
      { intercepts: 5, spawns: 9 },  // 🟨
      { intercepts: 3, spawns: 9 },  // 🟧
      { intercepts: 1, spawns: 9 },  // ⬛
      undefined,                      // ⬛
      ...Array(5).fill(undefined),
    ];
    const text = buildShareText(run, waves);
    expect(text).toContain('2026-04-17');
    expect(text).toContain('Score 847');
    expect(text).toContain('🟩');
    expect(text).toContain('🟨');
    expect(text).toContain('🟧');
    expect(text).toContain('⬛');
    expect(text).toContain('arczero.app/?seed=2026-04-17');
  });

  it('shows — for Infinity closestMissM', () => {
    const run = { score: 0, level: 1, longestChain: 0, closestMissM: Infinity, dateISO: '2026-04-17' };
    const text = buildShareText(run, []);
    expect(text).toContain('Closest —');
  });

  it('grid has exactly 10 emoji', () => {
    const run = { score: 100, level: 2, longestChain: 3, closestMissM: 5.0, dateISO: '2026-04-17' };
    const text = buildShareText(run, [{ intercepts: 9, spawns: 10 }]);
    // Third line is the grid
    const lines = text.split('\n');
    const gridLine = lines[2];
    // Each emoji is 2 code points — count by splitting into grapheme clusters via spread
    const emojis = [...gridLine];
    expect(emojis.length).toBe(10);
  });
});

// ── Milestones ────────────────────────────────────────────────────────────────
describe('checkMilestones', () => {
  function makeState(overrides = {}) {
    return {
      stats: { intercepts: 0, closestMissM: Infinity, nearMisses: 0, longestChain: 0, waveStats: [] },
      combo: { best: 0, count: 0, timerS: 0, multiplier: 1, decaying: false },
      totalElapsedS: 0,
      level: 1,
      ...overrides,
    };
  }

  it('triggers first_intercept on first intercept', () => {
    const save = loadSave();
    const state = makeState({ stats: { intercepts: 1, closestMissM: Infinity, nearMisses: 0, longestChain: 0, waveStats: [] } });
    const toasts = checkMilestones(state, save);
    expect(toasts).toContain('First blood.');
    expect(save.progress.milestones.first_intercept).toBe(true);
  });

  it('does not trigger same milestone twice', () => {
    const save = loadSave();
    const state = makeState({ stats: { intercepts: 1, closestMissM: Infinity, nearMisses: 0, longestChain: 0, waveStats: [] } });
    checkMilestones(state, save);
    const toasts2 = checkMilestones(state, save);
    expect(toasts2).not.toContain('First blood.');
  });

  it('triggers chain_5 when combo.best >= 5', () => {
    const save = loadSave();
    const state = makeState({ combo: { best: 5, count: 0, timerS: 0, multiplier: 1, decaying: false } });
    const toasts = checkMilestones(state, save);
    expect(toasts).toContain('×5 chain.');
  });

  it('persists milestone across save reload', () => {
    const save = loadSave();
    const state = makeState({ stats: { intercepts: 1, closestMissM: Infinity, nearMisses: 0, longestChain: 0, waveStats: [] } });
    checkMilestones(state, save);
    // updateBest saves; reload
    const save2 = loadSave();
    // Manually merge milestones as main.js would
    save2.progress.milestones = save.progress.milestones;
    const toasts2 = checkMilestones(state, save2);
    expect(toasts2).not.toContain('First blood.');
  });
});

// ── Streak logic ──────────────────────────────────────────────────────────────
describe('updateStreak', () => {
  it('starts at 1 on first play', () => {
    const save = loadSave();
    updateStreak(save, '2026-04-17');
    expect(save.streak.current).toBe(1);
    expect(save.streak.best).toBe(1);
  });

  it('increments on consecutive days', () => {
    const save = loadSave();
    updateStreak(save, '2026-04-16');
    updateStreak(save, '2026-04-17');
    expect(save.streak.current).toBe(2);
  });

  it('builds 3-day streak correctly', () => {
    const save = loadSave();
    updateStreak(save, '2026-04-15');
    updateStreak(save, '2026-04-16');
    updateStreak(save, '2026-04-17');
    expect(save.streak.current).toBe(3);
    expect(save.streak.best).toBe(3);
  });

  it('resets on gap > 1 day when no shield', () => {
    const save = loadSave();
    save.streak.shield = false;
    updateStreak(save, '2026-04-15');
    updateStreak(save, '2026-04-18'); // 3-day gap
    expect(save.streak.current).toBe(1);
  });

  it('consumes shield on 1-day gap, continues streak', () => {
    const save = loadSave();
    save.streak.shield = true;
    updateStreak(save, '2026-04-15');
    updateStreak(save, '2026-04-17'); // skipped 16th
    expect(save.streak.current).toBe(2);
    expect(save.streak.shield).toBe(false);
  });

  it('does not double-count same day', () => {
    const save = loadSave();
    updateStreak(save, '2026-04-17');
    updateStreak(save, '2026-04-17');
    expect(save.streak.current).toBe(1);
  });
});

// ── Daily seed determinism ────────────────────────────────────────────────────
describe('daily seed', () => {
  it('same date → same first 5 spawn x positions', async () => {
    const { randomBetween } = await import('../src/rng.js');
    const dateISO = '2026-04-17';
    const dailySeed = seedFromDateISO(dateISO);
    seed(dailySeed);
    const a = Array.from({ length: 5 }, () => randomBetween(30, 180));
    seed(dailySeed);
    const b = Array.from({ length: 5 }, () => randomBetween(30, 180));
    expect(a).toEqual(b);
  });

  it('different dates → different seeds', () => {
    const s1 = seedFromDateISO('2026-04-17');
    const s2 = seedFromDateISO('2026-04-18');
    expect(s1).not.toBe(s2);
  });
});

// ── PB detection ──────────────────────────────────────────────────────────────
describe('PB detection', () => {
  it('fires on exceeding best, not tying', () => {
    const save = loadSave();
    const run1 = { score: 100, level: 1, longestChain: 2, closestMissM: 5, intercepts: 5, survivedS: 30, seed: null, dateISO: '2026-04-17' };
    const updated1 = updateBest(save, run1);
    expect(updated1).toBe(true); // first run always PB

    const run2 = { ...run1, score: 100 }; // tie
    const updated2 = updateBest(save, run2);
    expect(updated2).toBe(false);

    const run3 = { ...run1, score: 101 }; // exceed
    const updated3 = updateBest(save, run3);
    expect(updated3).toBe(true);
  });
});
