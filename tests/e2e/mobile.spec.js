import { test, expect } from '@playwright/test';

// These tests run only under the 'mobile-chrome' project (Pixel 5 viewport).
// Desktop Chrome skips via the isMobile guard.

// Minimal save that skips the first-run name overlay so the menu shows immediately.
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

test.describe('Mobile controls', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only');
    await page.addInitScript((save) => {
      localStorage.setItem('arczero.save.v1', save);
    }, BASE_SAVE);
    await page.goto('/');
  });

  test('mobile controls visible after game start', async ({ page }) => {
    await page.locator('#menu-campaign-btn').click();
    // Wait for level intro countdown
    await page.waitForTimeout(3500);
    const controls = page.locator('#mobile-controls');
    await expect(controls).toHaveClass(/visible/);
    // Note: #mc-angle does not exist; the correct selectors are #mc-angle-up / #mc-angle-down.
    await expect(page.locator('#mc-angle-up')).toBeVisible();
    await expect(page.locator('#mc-fire')).toBeVisible();
    await expect(page.locator('#mc-left')).toBeVisible();
    await expect(page.locator('#mc-right')).toBeVisible();
  });

  test('angle-up button increases hud-angle', async ({ page }) => {
    await page.locator('#menu-campaign-btn').click();
    await page.waitForTimeout(3500);
    const parseAngle = (text) => Number(text.replace('°', ''));
    const before = parseAngle(await page.locator('#hud-angle').textContent());
    await page.locator('#mc-angle-up').dispatchEvent('touchstart', {});
    await page.waitForTimeout(300);
    await page.locator('#mc-angle-up').dispatchEvent('touchend', {});
    const after = parseAngle(await page.locator('#hud-angle').textContent());
    expect(after).toBeGreaterThan(before);
  });

  test('angle-down button decreases hud-angle', async ({ page }) => {
    await page.locator('#menu-campaign-btn').click();
    await page.waitForTimeout(3500);
    // First push angle up so there's room to go down
    await page.locator('#mc-angle-up').dispatchEvent('touchstart', {});
    await page.waitForTimeout(500);
    await page.locator('#mc-angle-up').dispatchEvent('touchend', {});
    const parseAngle = (text) => Number(text.replace('°', ''));
    const before = parseAngle(await page.locator('#hud-angle').textContent());
    await page.locator('#mc-angle-down').dispatchEvent('touchstart', {});
    await page.waitForTimeout(300);
    await page.locator('#mc-angle-down').dispatchEvent('touchend', {});
    const after = parseAngle(await page.locator('#hud-angle').textContent());
    expect(after).toBeLessThan(before);
  });

  test('fire button hold charges power, release resets power', async ({ page }) => {
    await page.locator('#menu-campaign-btn').click();
    await page.waitForTimeout(3500);
    await page.locator('#mc-fire').dispatchEvent('touchstart', {});
    await page.waitForTimeout(600);
    const charged = Number(await page.locator('#hud-power').textContent());
    expect(charged).toBeGreaterThan(20);
    await page.locator('#mc-fire').dispatchEvent('touchend', {});
    await page.waitForTimeout(200);
    await expect(page.locator('#hud-power')).toHaveText('20');
  });

  test('mc-flip button is visible and can be tapped', async ({ page }) => {
    // Positive assertion replacing the old negative "mc-flip does not exist" check.
    // The flip button was re-added; verify it is present, enabled, and tappable.
    await page.locator('#menu-campaign-btn').click();
    await page.waitForTimeout(3500);
    await expect(page.locator('#mc-flip')).toBeVisible();
    await expect(page.locator('#mc-flip')).not.toBeDisabled();
    // Tap flip — toggles launcher facing (canvas-only effect; game must not crash).
    await page.locator('#mc-flip').dispatchEvent('touchstart', {});
    await page.locator('#mc-flip').dispatchEvent('touchend', {});
    // Game is still running: HUD score element remains visible.
    await expect(page.locator('#hud-score')).toBeVisible();
  });
});

test.describe('Desktop hides mobile controls', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only');
    await page.goto('/');
  });

  test('mobile-controls not visible on desktop pointer', async ({ page }) => {
    // The @media (hover:hover) and (pointer:fine) rule hides them
    const controls = page.locator('#mobile-controls');
    await expect(controls).not.toBeVisible();
  });
});

test.describe('Pause button', () => {
  test('pause button present in HUD', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#pause-btn')).toBeVisible();
  });
});
