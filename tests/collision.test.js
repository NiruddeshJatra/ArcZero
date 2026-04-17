import { describe, it, expect } from 'vitest';
import {
  distance,
  checkCollisions,
  checkMissileGroundHit,
  checkInterceptorBounds,
} from '../src/collision.js';
import { createState, createMissile, createInterceptor } from '../src/state.js';
import { COLLISION_RADIUS, MISSILE_DAMAGE, INTERCEPT_SCORE } from '../src/constants.js';

describe('distance', () => {
  it('computes 3-4-5 triangle correctly', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });

  it('returns 0 for same position', () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe('checkCollisions', () => {
  it('destroys both and awards score within COLLISION_RADIUS', () => {
    const state = createState();
    const missile = createMissile(100);
    missile.y = 50;
    const interceptor = createInterceptor(100, 0, 0);
    interceptor.y = 50;
    state.missiles.push(missile);
    state.interceptors.push(interceptor);

    checkCollisions(state);

    expect(missile.alive).toBe(false);
    expect(interceptor.alive).toBe(false);
    expect(state.score).toBe(INTERCEPT_SCORE);
  });

  it('does not destroy when outside COLLISION_RADIUS', () => {
    const state = createState();
    const missile = createMissile(100);
    missile.y = 50;
    const interceptor = createInterceptor(100, 0, 0);
    interceptor.y = 50 + COLLISION_RADIUS + 1;
    state.missiles.push(missile);
    state.interceptors.push(interceptor);

    checkCollisions(state);
    expect(missile.alive).toBe(true);
    expect(interceptor.alive).toBe(true);
  });

  it('spawns explosion on collision', () => {
    const state = createState();
    const missile = createMissile(100);
    missile.y = 50;
    const interceptor = createInterceptor(100, 0, 0);
    interceptor.y = 50;
    state.missiles.push(missile);
    state.interceptors.push(interceptor);

    checkCollisions(state);
    expect(state.explosions).toHaveLength(1);
  });
});

describe('checkMissileGroundHit', () => {
  it('destroys missile and reduces health when y <= 0', () => {
    const state = createState();
    const missile = createMissile(100);
    missile.y = -0.01;
    state.missiles.push(missile);

    checkMissileGroundHit(state);
    expect(missile.alive).toBe(false);
    expect(state.health).toBe(100 - MISSILE_DAMAGE);
  });

  it('does not affect missile still in air', () => {
    const state = createState();
    const missile = createMissile(100);
    missile.y = 10;
    state.missiles.push(missile);

    checkMissileGroundHit(state);
    expect(missile.alive).toBe(true);
    expect(state.health).toBe(100);
  });
});

describe('checkInterceptorBounds', () => {
  it.each([
    { y: -1, x: 100, desc: 'below ground' },
    { y: 151, x: 100, desc: 'above world' },
    { y: 50, x: -1, desc: 'left of world' },
    { y: 50, x: 201, desc: 'right of world' },
  ])('kills interceptor when $desc', ({ x, y }) => {
    const state = createState();
    const interceptor = createInterceptor(x, 0, 0);
    interceptor.y = y;
    state.interceptors.push(interceptor);
    checkInterceptorBounds(state);
    expect(interceptor.alive).toBe(false);
  });

  it('keeps in-bounds interceptor alive', () => {
    const state = createState();
    const interceptor = createInterceptor(100, 0, 0);
    interceptor.y = 75;
    state.interceptors.push(interceptor);
    checkInterceptorBounds(state);
    expect(interceptor.alive).toBe(true);
  });
});
