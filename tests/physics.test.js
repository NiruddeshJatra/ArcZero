import { describe, it, expect } from 'vitest';
import { stepObject } from '../src/physics.js';
import { DT, GRAVITY } from '../src/constants.js';

describe('stepObject', () => {
  it('applies x position update', () => {
    const obj = { x: 0, y: 100, vx: 10, vy: 0 };
    stepObject(obj);
    expect(obj.x).toBeCloseTo(10 * DT);
  });

  it('applies y position update with gravity term', () => {
    const obj = { x: 0, y: 100, vx: 0, vy: 0 };
    stepObject(obj);
    expect(obj.y).toBeCloseTo(100 + 0.5 * GRAVITY * DT * DT);
  });

  it('applies gravity to vy', () => {
    const obj = { x: 0, y: 100, vx: 0, vy: 0 };
    stepObject(obj);
    expect(obj.vy).toBeCloseTo(GRAVITY * DT);
  });

  it('does not change vx', () => {
    const obj = { x: 0, y: 100, vx: 30, vy: 0 };
    stepObject(obj);
    expect(obj.vx).toBe(30);
  });

  it('object falls over time', () => {
    const obj = { x: 0, y: 100, vx: 0, vy: 0 };
    for (let i = 0; i < 20; i++) stepObject(obj);
    expect(obj.y).toBeLessThan(100);
  });
});
