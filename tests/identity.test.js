import { describe, it, expect, beforeEach } from 'vitest';
import { getOrCreatePlayerId, getHandle, setHandle } from '../src/net/identity.js';

describe('identity', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getOrCreatePlayerId', () => {
    it('returns a UUID v4 string', () => {
      const id = getOrCreatePlayerId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('is stable across multiple calls', () => {
      const id1 = getOrCreatePlayerId();
      const id2 = getOrCreatePlayerId();
      expect(id1).toBe(id2);
    });

    it('persists in localStorage under arczero.player_id', () => {
      const id = getOrCreatePlayerId();
      expect(localStorage.getItem('arczero.player_id')).toBe(id);
    });

    it('re-reads the stored value on subsequent calls', () => {
      const id = getOrCreatePlayerId();
      // Simulate a fresh module call by directly reading storage
      const stored = localStorage.getItem('arczero.player_id');
      expect(stored).toBe(id);
      const id2 = getOrCreatePlayerId();
      expect(id2).toBe(id);
    });
  });

  describe('handle round-trip', () => {
    it('getHandle returns null when not set', () => {
      expect(getHandle()).toBeNull();
    });

    it('setHandle stores and getHandle retrieves', () => {
      setHandle('AceWingman');
      expect(getHandle()).toBe('AceWingman');
    });

    it('setHandle trims and caps at 20 chars', () => {
      setHandle('  ThisNameIsWayTooLongForAnyLeaderboard  ');
      const h = getHandle();
      expect(h.length).toBeLessThanOrEqual(20);
      expect(h).not.toMatch(/^\s|\s$/);
    });

    it('overwrites previous handle', () => {
      setHandle('First');
      setHandle('Second');
      expect(getHandle()).toBe('Second');
    });
  });
});
