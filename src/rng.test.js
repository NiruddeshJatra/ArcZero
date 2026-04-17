import { describe, it, expect } from 'vitest';
import { seed, random, randomBetween, seedFromString, seedFromDateISO } from './rng.js';

describe('rng', () => {
  it('is deterministic across seeds', () => {
    seed(42);
    const a = [random(), random(), random()];
    seed(42);
    const b = [random(), random(), random()];
    expect(a).toEqual(b);
  });
  it('produces different sequences for different seeds', () => {
    seed(1);
    const a = random();
    seed(2);
    const b = random();
    expect(a).not.toBe(b);
  });
  it('randomBetween stays in range', () => {
    seed(123);
    for (let i = 0; i < 1000; i++) {
      const v = randomBetween(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });
  it('seedFromString is stable', () => {
    expect(seedFromString('hello')).toBe(seedFromString('hello'));
    expect(seedFromString('a')).not.toBe(seedFromString('b'));
  });
  it('seedFromDateISO is stable', () => {
    expect(seedFromDateISO('2026-04-17')).toBe(seedFromDateISO('2026-04-17'));
  });
});
