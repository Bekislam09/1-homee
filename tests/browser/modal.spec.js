import { test, expect } from '@playwright/test';

const ready = async page => {
  await page.goto('/?test');
  await expect(page.locator('#play')).toBeEnabled();
};

test('modal keyboard focus stays inside, Escape closes, and focus returns to its trigger', async ({ page }) => {
  await ready(page);
  await page.click('#settings');
  await expect(page.locator('#close-settings')).toBeFocused();
  await page.locator('#settings-done').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#close-settings')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#settings-done')).toBeFocused();
  expect(await page.locator('.site-header').evaluate(element => element.inert)).toBe(true);
  await page.locator('#sound-check').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#dialog')).toBeHidden();
  await expect(page.locator('#settings')).toBeFocused();
  expect(await page.locator('.site-header').evaluate(element => element.inert)).toBe(false);
  for (const trigger of ['#help', '#daily', '#achievements', '#free-play']) {
    await page.click(trigger);
    expect(await page.evaluate(() => document.querySelector('#dialog').contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#dialog')).toBeHidden();
    await expect(page.locator(trigger)).toBeFocused();
  }
});

test('changing screens clears transient dialog pauses without dropping a platform lock', async ({ page }) => {
  await ready(page);
  await page.click('#play');
  await page.click('#settings');
  await page.evaluate(() => {
    const game = window.__smash;
    game.life.reason('platform', true);
    game.menu();
    game.start();
  });
  expect(await page.evaluate(() => [...window.__smash.life.reasons])).toEqual(['platform']);
  expect(await page.evaluate(() => window.__smash.controls.paused)).toBe(true);
  await page.evaluate(() => window.__smash.life.reason('platform', false));
  expect(await page.evaluate(() => window.__smash.controls.paused)).toBe(false);
  await page.keyboard.press('Space');
  await expect(page.locator('#run-coins')).toHaveText('25');
});

test('keyboard buttons keep native activation and pause resumes with game input focused', async ({ page }) => {
  await ready(page);
  await page.click('#play');
  await page.locator('#pause').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#pause-overlay')).toBeVisible();
  await expect(page.locator('#pause-overlay [role="dialog"]')).toHaveAttribute('aria-modal', 'true');
  expect(await page.evaluate(() => window.__smash.sim.destroyed)).toBe(0);
  await page.locator('#pause-menu').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#resume')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-overlay')).toBeHidden();
  await expect(page.locator('#game')).toBeFocused();
  await page.locator('#ram').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#run-coins')).toHaveText('25');
});
