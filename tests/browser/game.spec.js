import { test, expect } from '@playwright/test';

const ready = async page => {
  await page.goto('/?test');
  await page.waitForFunction(() => window.__smash?.scene?.dozer);
  await expect(page.locator('#play')).toBeEnabled();
};

test('menu, real keyboard ram, damage effects, persistence, settings, pause and replay', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await expect(page.locator('h1')).toContainText('SMASH');
  await page.screenshot({ path: '/tmp/smash-menu.png' });
  await page.click('#help');
  await expect(page.locator('#help-title')).toBeVisible();
  await page.click('#help-done');
  await page.click('#play');
  // The first shed is aligned with the initial bucket: this uses real input.
  await page.keyboard.press('Space');
  await expect(page.locator('#run-coins')).toHaveText('25');
  expect(await page.evaluate(() => window.__smash.sim.buildings[0].hp)).toBe(0);
  expect(await page.evaluate(() => window.__smash.scene.particles.filter(p => p.life > 0).length)).toBeGreaterThan(0);
  await page.waitForFunction(() => window.__smash.sim.player.ramTime <= 0);
  await page.keyboard.down('d');
  const before = await page.evaluate(() => ({ x: window.__smash.sim.player.x, y: window.__smash.sim.player.y }));
  await page.waitForTimeout(450);
  await page.keyboard.up('d');
  const after = await page.evaluate(() => ({ x: window.__smash.sim.player.x, y: window.__smash.sim.player.y }));
  expect(after.x).toBeGreaterThan(before.x);
  expect(after.y).toBeLessThan(before.y);
  await page.keyboard.press('Escape');
  const time = await page.evaluate(() => window.__smash.sim.timeLeft);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__smash.sim.timeLeft)).toBe(time);
  await page.click('#resume');
  await page.click('#settings');
  await page.uncheck('#sound-check');
  await page.uncheck('#effects-check');
  expect(await page.evaluate(() => window.__smash.settings)).toMatchObject({ sound: false, effects: false });
  await page.click('#settings-done');
  await page.screenshot({ path: '/tmp/smash-play.png' });
  // Time-expiry UI is exercised by advancing a controlled dev-only timer.
  await page.evaluate(() => window.__smash.sim.timeLeft = .02);
  await expect(page.locator('#result-title')).toHaveText('Время вышло');
  await page.click('#replay');
  expect(await page.evaluate(() => window.__smash.sim.destroyed)).toBe(0);
  expect(await page.evaluate(() => window.__smash.sim.balance)).toBe(25);
  expect(await page.evaluate(() => window.__smash.sim.buildings.every(b => b.hp === b.maxHp))).toBe(true);
  await page.reload();
  await page.waitForFunction(() => window.__smash?.scene?.dozer);
  await expect(page.locator('#balance')).toHaveText('25');
  await page.click('#settings');
  await expect(page.locator('#sound-check')).not.toBeChecked();
  await expect(page.locator('#effects-check')).not.toBeChecked();
  expect(errors).toEqual([]);
});

test('continuous in-browser mission through movement and collisions, results and stable replay resources', async ({ page }) => {
  await ready(page);
  await page.click('#play');
  const result = await page.evaluate(() => {
    const g = window.__smash, sim = g.sim, scene = g.scene;
    // Faster than wall-clock, but only the public movement/ram inputs are used.
    // Starting positions, durability and rewards are never edited.
    const frame = input => { sim.update(1 / 60, input); scene.handleEvents(sim.events); };
    const driveTo = (x, y) => {
      for (let n = 0; n < 1200 && sim.phase === 'playing'; n++) {
        const dx = x - sim.player.x, dy = y - sim.player.y, d = Math.hypot(dx, dy);
        if (d < 6) break;
        frame({ x: dx / d, y: dy / d });
      }
    };
    const demolish = b => {
      driveTo(b.x - 74, b.y);
      for (let n = 0; n < 1000 && b.hp > 0 && sim.phase === 'playing'; n++) frame({ x: 1, y: 0, ram: sim.player.ramCooldown <= 0 });
    };
    demolish(sim.buildings[0]);
    driveTo(290, 180);
    demolish(sim.buildings[1]);
    driveTo(510, 180);
    demolish(sim.buildings[2]);
    if (sim.phase === 'won') g.finish();
    return { phase: sim.phase, score: sim.score, destroyed: sim.destroyed, balance: sim.balance, elapsed: 90 - sim.timeLeft };
  });
  expect(result.phase).toBe('won');
  expect(result.score).toBeGreaterThanOrEqual(1000);
  expect(result.destroyed).toBe(3);
  await expect(page.locator('#result-title')).toHaveText('Уровень пройден!');
  await page.screenshot({ path: '/tmp/smash-win.png' });
  const count = await page.evaluate(() => ({ objects: window.__smash.scene.children.length, textures: window.__smash.game.textures.getTextureKeys().length }));
  for (let n = 0; n < 5; n++) await page.evaluate(() => { window.__smash.start(); window.__smash.menu(); });
  const after = await page.evaluate(() => ({ objects: window.__smash.scene.children.length, textures: window.__smash.game.textures.getTextureKeys().length }));
  expect(after).toEqual(count);
});

test('portrait and landscape mobile: real simultaneous joystick and ram touches', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await page.screenshot({ path: '/tmp/smash-mobile-menu.png' });
  await page.click('#play');
  await expect(page.locator('#joystick')).toBeVisible();
  const joystick = await page.locator('#joystick').boundingBox(), ram = await page.locator('#ram').boundingBox();
  const client = await context.newCDPSession(page);
  const points = [{ x: joystick.x + joystick.width * .76, y: joystick.y + joystick.height * .5, id: 1 }, { x: ram.x + ram.width / 2, y: ram.y + ram.height / 2, id: 2 }];
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__smash.controls.input.x)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__smash.controls.input.ram)).toBe(true);
  expect(await page.evaluate(() => window.__smash.sim.player.ramCooldown)).toBeGreaterThan(0);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => window.__smash.controls.input)).toEqual({ x: 0, y: 0, ram: false });
  await page.screenshot({ path: '/tmp/smash-mobile.png' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__smash.game.scale.width === innerWidth && window.__smash.game.scale.height === innerHeight);
  expect(await page.locator('#game canvas').evaluate(c => Math.round(c.getBoundingClientRect().width))).toBe(844);
  await page.screenshot({ path: '/tmp/smash-landscape.png' });
  const overlaps = await page.evaluate(() => {
    const a = document.querySelector('#ram').getBoundingClientRect(), b = document.querySelector('#joystick').getBoundingClientRect();
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  });
  expect(overlaps).toBe(false);
  expect(errors).toEqual([]);
  await context.close();
});
