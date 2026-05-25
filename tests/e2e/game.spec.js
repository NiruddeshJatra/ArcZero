import { test, expect } from '@playwright/test';

// Minimal save that skips the first-run name overlay and shows the menu immediately.
const BASE_SAVE = JSON.stringify({
  schemaVersion: 2,
  player: { anonId: 'az_e2etest000', createdAt: 0, displayName: 'Tester' },
  best: {
    allTime: { score: 0, level: 1, date: null, seed: null },
    perLevel: {}, longestChain: 0, closestMissM: null,
    totalIntercepts: 0, totalSurvivedS: 0,
  },
  progress: {
    highestLevelReached: 1, unlockedStartLevels: [1],
    sessionsPlayed: 0, lastSessionAt: null, milestones: {},
  },
  settings: {
    reduceMotion: false, soundVolume: 1.0, mobileTouchMode: 'auto',
    tapToFire: false, colorblindMode: 'off', showTrajectoryPreview: true,
    audioVolumes: { master: 1, sfx: 1, music: 1 },
  },
  streak: { current: 0, best: 0, lastPlayDateISO: null, shield: true },
  daily: { lastCompletedDateISO: null, lastScore: 0, lastSeed: null },
});

test.describe('ArcZero', () => {
  test.beforeEach(async ({ page }) => {
    // Pre-populate localStorage so the first-run overlay is skipped and the menu shows.
    await page.addInitScript((save) => {
      localStorage.setItem('arczero.save.v1', save);
    }, BASE_SAVE);
    await page.goto('/');
  });

  test('canvas renders on load', async ({ page, isMobile }) => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
    // Pixel 5 (mobile-chrome project) has pointer:coarse → IS_PORTRAIT=true → width=500.
    // Desktop chromium project → IS_PORTRAIT=false → width=1000.
    const expectedWidth = isMobile ? '500' : '1000';
    await expect(canvas).toHaveAttribute('width', expectedWidth);
    await expect(canvas).toHaveAttribute('height', '750');
  });

  test('HUD shows initial values', async ({ page }) => {
    await expect(page.locator('#hud-score')).toHaveText('0');
    await expect(page.locator('#hud-health')).toHaveText('100');
    await expect(page.locator('#hud-angle')).toHaveText('45°');
    await expect(page.locator('#hud-power')).toHaveText('20');
  });

  test('score increases over time', async ({ page }) => {
    // Click campaign → 3s countdown → game running; passive score accrues at 0.25/s.
    await page.locator('#menu-campaign-btn').click();
    await page.waitForTimeout(8000); // 3s countdown + 5s gameplay → ≥1 passive point
    const score = Number(await page.locator('#hud-score').textContent());
    expect(score).toBeGreaterThan(0);
  });

  test('arrow keys do not scroll page', async ({ page }) => {
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowRight');
    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(scrollAfter).toBe(scrollBefore);
  });

  test('space fires and resets power to 20', async ({ page }) => {
    await page.keyboard.down(' ');
    await page.waitForTimeout(500);
    await page.keyboard.up(' ');
    await page.waitForTimeout(150);
    await expect(page.locator('#hud-power')).toHaveText('20');
  });

  test('game-over overlay hidden initially', async ({ page }) => {
    const overlay = page.locator('#game-over-overlay');
    await expect(overlay).not.toHaveClass(/visible/);
  });

  test('restart button resets state', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      document.getElementById('game-over-overlay').classList.add('visible');
    });
    await page.locator('#restart-btn').click();
    await expect(page.locator('#hud-score')).toHaveText('0');
    await expect(page.locator('#hud-health')).toHaveText('100');
  });

  // ── Smoke flows ──────────────────────────────────────────────────────────────

  test('pause freezes score, unpause resumes it', async ({ page }) => {
    test.setTimeout(25000);
    await page.locator('#menu-campaign-btn').click();
    // 3s countdown + 5s gameplay → passive score = floor(5 × 0.25) = 1
    await page.waitForTimeout(8000);

    await page.keyboard.press('p');
    const scorePaused = Number(await page.locator('#hud-score').textContent());
    await page.waitForTimeout(2000);
    const scoreStill = Number(await page.locator('#hud-score').textContent());
    expect(scoreStill).toBe(scorePaused); // frozen while paused

    await page.keyboard.press('p'); // unpause
    // 5s more gameplay → score increases by floor(5 × 0.25) = 1
    await page.waitForTimeout(5000);
    const scoreRunning = Number(await page.locator('#hud-score').textContent());
    expect(scoreRunning).toBeGreaterThan(scoreStill); // resumed
  });

  test('daily replay shows unranked toast', async ({ page }) => {
    // Register a second initScript (runs on next navigation) that marks today's daily done.
    const todayISO = new Date().toISOString().slice(0, 10);
    await page.addInitScript((today) => {
      const raw = localStorage.getItem('arczero.save.v1');
      if (!raw) return;
      const save = JSON.parse(raw);
      save.daily.lastCompletedDateISO = today;
      save.daily.lastScore = 42;
      localStorage.setItem('arczero.save.v1', JSON.stringify(save));
    }, todayISO);
    await page.goto('/'); // both initScripts run; save now has today's date

    await page.locator('#menu-daily-btn').click();
    await expect(page.locator('#toast-container')).toContainText('unranked', { ignoreCase: true });
  });

  test('volume setting persists in localStorage', async ({ page }) => {
    // Register a second initScript that sets volume=0 (runs on next navigation).
    await page.addInitScript(() => {
      const raw = localStorage.getItem('arczero.save.v1');
      if (!raw) return;
      const save = JSON.parse(raw);
      save.settings.soundVolume = 0;
      save.settings.audioVolumes = { master: 0, sfx: 1, music: 1 };
      localStorage.setItem('arczero.save.v1', JSON.stringify(save));
    });
    await page.goto('/'); // reloads with volume=0 in save

    await page.locator('#menu-settings-btn').click();
    await expect(page.locator('#setting-volume')).toHaveValue('0');
  });

  test.fixme('campaign → game over → all-time leaderboard gains entry',
    // Game over requires ~70s of unattended gameplay (10 missiles × ~7s each to hit ground).
    // No health-injection path exists without a src/ change.
    async ({ page }) => {
      await page.locator('#menu-campaign-btn').click();
      // ... would need to wait for game over naturally (~70s) then verify leaderboard entry
    });

  test.fixme('level-select unlock: clear L1 criteria, die, L2 becomes available',
    // Requires game over after LEVELRUN criteria are cleared (≥12 intercepts, ≥2 waves, ≥200 score).
    // Same game-over problem: ~70s of gameplay + player must score 12 intercepts — impractical in E2E.
    async ({ page }) => {});
});
