import { test, expect } from '@playwright/test';

// These tests run only under the 'mobile-chrome' project (Pixel 5 viewport).
// Desktop Chrome skips via the isMobile guard.

test.describe('Mobile controls', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only');
    await page.goto('/');
  });

  test('mobile controls visible after game start', async ({ page }) => {
    await page.locator('#menu-campaign-btn').click();
    // Wait for level intro countdown
    await page.waitForTimeout(3500);
    const controls = page.locator('#mobile-controls');
    await expect(controls).toHaveClass(/visible/);
    await expect(page.locator('#mc-angle')).toBeVisible();
    await expect(page.locator('#mc-fire')).toBeVisible();
    await expect(page.locator('#mc-left')).toBeVisible();
    await expect(page.locator('#mc-right')).toBeVisible();
  });

  test('angle-up button increases hud-angle', async ({ page }) => {
    await page.locator('#menu-campaign-btn').click();
    await page.waitForTimeout(3500);
    const before = Number(await page.locator('#hud-angle').textContent());
    await page.locator('#mc-angle-up').dispatchEvent('touchstart', {});
    await page.waitForTimeout(300);
    await page.locator('#mc-angle-up').dispatchEvent('touchend', {});
    const after = Number(await page.locator('#hud-angle').textContent());
    expect(after).toBeGreaterThan(before);
  });

  test('angle-down button decreases hud-angle', async ({ page }) => {
    await page.locator('#menu-campaign-btn').click();
    await page.waitForTimeout(3500);
    // First push angle up so there's room to go down
    await page.locator('#mc-angle-up').dispatchEvent('touchstart', {});
    await page.waitForTimeout(500);
    await page.locator('#mc-angle-up').dispatchEvent('touchend', {});
    const before = Number(await page.locator('#hud-angle').textContent());
    await page.locator('#mc-angle-down').dispatchEvent('touchstart', {});
    await page.waitForTimeout(300);
    await page.locator('#mc-angle-down').dispatchEvent('touchend', {});
    const after = Number(await page.locator('#hud-angle').textContent());
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

  test('no mc-flip button exists', async ({ page }) => {
    await expect(page.locator('#mc-flip')).toHaveCount(0);
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
