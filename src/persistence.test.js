import { beforeEach, describe, it, expect } from 'vitest';
import { loadSave, updateBest, loadBoards, submitLocalScore } from './persistence.js';

beforeEach(() => localStorage.clear());

describe('persistence', () => {
  it('creates a fresh save on first load', () => {
    const s = loadSave();
    expect(s.schemaVersion).toBe(1);
    expect(s.player.anonId).toMatch(/^az_/);
  });

  it('returns the same save on subsequent loads', () => {
    const s1 = loadSave();
    const s2 = loadSave();
    expect(s2.player.anonId).toBe(s1.player.anonId);
  });

  it('updates best score only when higher', () => {
    const s = loadSave();
    updateBest(s, { score: 100, level: 1, longestChain: 3, closestMissM: 5, intercepts: 5, survivedS: 30, seed: null, dateISO: '2026-04-17' });
    expect(s.best.allTime.score).toBe(100);
    updateBest(s, { score: 50, level: 1, longestChain: 2, closestMissM: 10, intercepts: 2, survivedS: 10, seed: null, dateISO: '2026-04-17' });
    expect(s.best.allTime.score).toBe(100);
    expect(s.best.longestChain).toBe(3);
    expect(s.best.closestMissM).toBe(5);
  });

  it('accumulates intercepts and survivedS', () => {
    const s = loadSave();
    updateBest(s, { score: 10, level: 1, longestChain: 1, closestMissM: 20, intercepts: 3, survivedS: 15, seed: null, dateISO: '2026-04-17' });
    updateBest(s, { score: 5, level: 1, longestChain: 1, closestMissM: 20, intercepts: 2, survivedS: 10, seed: null, dateISO: '2026-04-17' });
    expect(s.best.totalIntercepts).toBe(5);
    expect(s.best.totalSurvivedS).toBe(25);
  });

  it('caps local boards at 20 entries sorted desc', () => {
    const boards = loadBoards();
    for (let i = 0; i < 30; i++) {
      submitLocalScore(boards, { anonId: 'x', name: 'x', score: i, level: 1, chainBest: 0, durationS: 10, seed: null, dateISO: '2026-04-17', inputType: 'kbd', modifiers: [] });
    }
    expect(boards.allTime.length).toBe(20);
    expect(boards.allTime[0].score).toBe(29);
  });
});
