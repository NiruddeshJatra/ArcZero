import { test, expect } from '@playwright/test';

test.describe('Missile Maniac', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('canvas renders on load', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('width', '1000');
    await expect(canvas).toHaveAttribute('height', '750');
  });

  test('HUD shows initial values', async ({ page }) => {
    await expect(page.locator('#hud-score')).toHaveText('0');
    await expect(page.locator('#hud-health')).toHaveText('100');
    await expect(page.locator('#hud-angle')).toHaveText('45°');
    await expect(page.locator('#hud-power')).toHaveText('20');
  });

  test('score increases over time', async ({ page }) => {
    await page.waitForTimeout(2000);
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
});
