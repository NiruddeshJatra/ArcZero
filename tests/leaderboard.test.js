import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock fetch before importing the module ───────────────────────────────────
const _fetchMock = vi.fn();
vi.stubGlobal('fetch', _fetchMock);

// Stub AbortController to avoid timer leaks
vi.stubGlobal('AbortController', class {
  signal = {};
  abort() {}
});

import { startRun, submitScore } from '../src/net/leaderboard.js';

function makeResponse(body, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  });
}

describe('leaderboard client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Prevent actual timer from running in tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startRun', () => {
    it('POSTs to start_run and returns token on success', async () => {
      _fetchMock.mockReturnValueOnce(makeResponse({ token: 'abc.def' }));

      const promise = startRun({ seed: 12345, device: 'desktop', playerId: 'player-uuid' });
      // Don't advance timers — the fetch resolves immediately via mock
      const result = await promise;

      expect(_fetchMock).toHaveBeenCalledOnce();
      const [url, opts] = _fetchMock.mock.calls[0];
      expect(url).toContain('/functions/v1/start_run');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.player_id).toBe('player-uuid');
      expect(body.device).toBe('desktop');
      expect(body.seed).toBe('12345');

      expect(result).toEqual({ ok: true, token: 'abc.def' });
    });

    it('returns ok:false on network error', async () => {
      _fetchMock.mockRejectedValueOnce(new Error('network error'));
      const result = await startRun({ seed: 0, device: 'desktop', playerId: 'uuid' });
      expect(result.ok).toBe(false);
    });

    it('returns ok:false when response has no token', async () => {
      _fetchMock.mockReturnValueOnce(makeResponse({ error: 'server_error' }));
      const result = await startRun({ seed: 0, device: 'desktop', playerId: 'uuid' });
      expect(result.ok).toBe(false);
    });
  });

  describe('submitScore', () => {
    it('POSTs to submit_score and returns accepted rank on success', async () => {
      _fetchMock.mockReturnValueOnce(makeResponse({
        accepted: true,
        rank_daily: 3,
        rank_alltime: 42,
      }));

      const result = await submitScore({
        score: 500,
        token: 'tok.sig',
        durationMs: 30_000,
        device: 'desktop',
        handle: 'AceWingman',
        seed: '12345',
        playerId: 'player-uuid',
      });

      expect(_fetchMock).toHaveBeenCalledOnce();
      const [url, opts] = _fetchMock.mock.calls[0];
      expect(url).toContain('/functions/v1/submit_score');
      const body = JSON.parse(opts.body);
      expect(body.score).toBe(500);
      expect(body.duration_ms).toBe(30_000);
      expect(body.handle).toBe('AceWingman');

      expect(result).toMatchObject({ ok: true, accepted: true, rank_daily: 3, rank_alltime: 42 });
    });

    it('forwards rejection reasons from the server', async () => {
      _fetchMock.mockReturnValueOnce(makeResponse({ accepted: false, reason: 'bad_token' }));

      const result = await submitScore({
        score: 100, token: 'bad', durationMs: 10_000,
        device: 'desktop', handle: 'X', seed: '0', playerId: 'uuid',
      });
      expect(result).toMatchObject({ ok: true, accepted: false, reason: 'bad_token' });
    });

    it('returns ok:false on network error', async () => {
      _fetchMock.mockRejectedValueOnce(new Error('timeout'));
      const result = await submitScore({
        score: 100, token: 't', durationMs: 10_000,
        device: 'desktop', handle: 'X', seed: '0', playerId: 'uuid',
      });
      expect(result.ok).toBe(false);
    });
  });
});
