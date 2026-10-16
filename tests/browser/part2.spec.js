import { test, expect } from '@playwright/test';

const ready = async page => {
  await page.goto('/?test');
  await page.waitForFunction(() => window.__smash?.scene?.dozer && window.__smash?.progress);
  await expect(page.locator('#play')).toBeEnabled();
};

const legacySave = async (page, balance, corruptCurrent = false) => {
  await page.addInitScript(({ balance, corruptCurrent }) => {
    // Seed once: reload must read the save produced by the actual application.
    if (localStorage.getItem('smash-city-v1') === null && localStorage.getItem('smash-city-v2') === null) {
      localStorage.setItem('smash-city-v1', JSON.stringify({ balance, settings: { sound: false, effects: true } }));
      if (corruptCurrent) localStorage.setItem('smash-city-v2', '{broken-json');
    }
  }, { balance, corruptCurrent });
};

const inspect = page => page.evaluate(() => structuredClone(window.__smash.progress.state));
const preview = (page, vehicle) => page.locator(`#garage-list [data-vehicle="${vehicle}"]`).click();
const selectOwned = async (page, vehicle) => {
  await preview(page, vehicle);
  if ((await inspect(page)).selectedVehicle !== vehicle) await page.click('#vehicle-action');
  expect((await inspect(page)).selectedVehicle).toBe(vehicle);
};

test('legacy save, real garage purchases, ownership guards and selected machine survive reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await legacySave(page, 1000);
  await ready(page);
  expect(await inspect(page)).toMatchObject({ balance: 1000, selectedVehicle: 'dozer', ownedVehicles: ['dozer'], settings: { sound: false } });
  await page.click('#garage');
  await expect(page.locator('#garage-screen')).toBeVisible();
  await preview(page, 'excavator');
  await page.click('#vehicle-action');
  expect(await inspect(page)).toMatchObject({ balance: 700, ownedVehicles: ['dozer', 'excavator'] });
  await selectOwned(page, 'excavator');
  const repeated = await page.evaluate(() => {
    const g = window.__smash, before = g.progress.state.balance;
    return { result: g.progress.purchase('excavator'), before, after: g.progress.state.balance };
  });
  expect(repeated).toEqual({ result: { ok: false, reason: 'already-owned' }, before: 700, after: 700 });
  await page.screenshot({ path: '/tmp/smash-part2-garage.png' });
  await page.click('#garage-back');
  await page.reload();
  await page.waitForFunction(() => window.__smash?.scene?.dozer && window.__smash?.progress);
  expect(await inspect(page)).toMatchObject({ balance: 700, selectedVehicle: 'excavator', settings: { sound: false } });
  await page.click('#garage');
  await preview(page, 'wrecker');
  await page.click('#vehicle-action');
  expect(await inspect(page)).toMatchObject({ balance: 50, ownedVehicles: ['dozer', 'excavator', 'wrecker'] });
  await selectOwned(page, 'wrecker');
  await page.click('#garage-back');
  await page.click('#play');
  expect(await page.evaluate(() => window.__smash.sim.vehicleId)).toBe('wrecker');
  await expect(page.locator('#ram strong')).toHaveText('УДАР ШАРОМ');
  await page.reload();
  await page.waitForFunction(() => window.__smash?.scene?.dozer && window.__smash?.progress);
  expect(await inspect(page)).toMatchObject({ version: 2, balance: 50, selectedVehicle: 'wrecker', ownedVehicles: ['dozer', 'excavator', 'wrecker'] });
  expect(errors).toEqual([]);
});

test('corrupt current save falls back safely; funds and locked-level guards prevent invalid actions', async ({ page }) => {
  await legacySave(page, 200, true);
  await ready(page);
  expect(await inspect(page)).toMatchObject({ balance: 200, selectedVehicle: 'dozer', completedLevels: [], unlockedDistricts: ['town'] });
  await page.click('#garage');
  await preview(page, 'excavator');
  await expect(page.locator('.funds-note')).toContainText('Не хватает 100 монет');
  await page.click('#vehicle-action');
  await expect(page.locator('#toast')).toContainText('Недостаточно монет');
  expect((await inspect(page)).ownedVehicles).toEqual(['dozer']);
  expect(await page.evaluate(() => window.__smash.progress.purchase('excavator'))).toEqual({ ok: false, reason: 'insufficient-funds' });
  expect((await inspect(page)).balance).toBe(200);
  await page.click('#garage-back');
  await page.click('#levels');
  await expect(page.locator('[data-start-mission="1"]')).toBeEnabled();
  await expect(page.locator('[data-start-mission="2"]')).toBeDisabled();
  // Locked districts can be previewed, while their actual missions stay gated.
  await page.click('[data-district="industrial"]');
  await expect(page.locator('[data-start-mission="3"]')).toBeDisabled();
  await expect(page.locator('[data-start-mission="4"]')).toBeDisabled();
  await page.evaluate(() => window.__smash.start(4));
  expect(await page.evaluate(() => window.__smash.controls.screen)).not.toBe('playing');
  expect((await inspect(page)).balance).toBe(200);
  await page.click('#levels-back');
  await page.click('#play');
  expect(await page.evaluate(() => window.__smash.sim.mission.id)).toBe(1);
});

test('real keyboard abilities: distinct machine textures, delayed contact frames, and area damage', async ({ page }) => {
  // Ownership is a fixture here; purchasing is exercised through the UI above.
  await page.addInitScript(() => localStorage.setItem('smash-city-v2', JSON.stringify({ version: 2, balance: 50, ownedVehicles: ['dozer', 'excavator', 'wrecker'], settings: { sound: false } })));
  await ready(page);
  for (const vehicleId of ['dozer', 'excavator', 'wrecker']) {
    await page.evaluate(vehicleId => {
      const g = window.__smash;
      g.progress.selectVehicle(vehicleId);
      g.start(1);
      // Control only the animation clock; input still enters via real key events.
      g.game.loop.sleep();
      g.scene.accumulator = 0;
    }, vehicleId);
    await page.keyboard.press('Space');
    const frames = await page.evaluate(() => {
      const g = window.__smash, frames = [];
      for (let n = 0; n < 72; n++) {
        g.scene.update(0, 1000 / 60 + .0001);
        frames.push({ elapsed: g.sim.player.abilityElapsed, hp: g.sim.buildings[0].hp, texture: g.scene.dozer.texture.key, cooldown: g.sim.player.ramCooldown,
          areaWidth: g.scene.attackArea.geom.width * g.scene.attackArea.scaleX,
          areaHeight: g.scene.attackArea.geom.height * g.scene.attackArea.scaleY });
      }
      return frames;
    });
    const hit = frames.find(frame => frame.hp < 1);
    expect(hit, `${vehicleId} must damage the actual initial shed`).toBeTruthy();
    expect(frames.some(frame => frame.texture.startsWith(`${vehicleId}-`))).toBe(true);
    expect(frames[0].cooldown).toBeGreaterThan(0);
    if (vehicleId !== 'dozer') {
      const impactAt = vehicleId === 'excavator' ? .4 : .55;
      const radius = vehicleId === 'excavator' ? 24 : 100;
      expect(frames[0].areaWidth).toBeCloseTo(2.449 * radius, 2);
      expect(frames[0].areaHeight).toBeCloseTo(1.414 * radius, 2);
      expect(frames.filter(frame => frame.elapsed < impactAt - .001).every(frame => frame.hp === 1)).toBe(true);
      expect(frames.filter(frame => frame.elapsed < impactAt - .001).every(frame => !frame.texture.endsWith('-attack-2'))).toBe(true);
      expect(hit.elapsed).toBeCloseTo(impactAt, 2);
      expect(hit.texture).toMatch(new RegExp(`^${vehicleId}-\\d-attack-2$`));
      expect(frames.some(frame => /attack-[01]$/.test(frame.texture))).toBe(true);
      expect(frames.some(frame => /attack-[34]$/.test(frame.texture))).toBe(true);
    }
    await page.evaluate(() => window.__smash.game.loop.wake());
  }
  await page.evaluate(() => {
    const g = window.__smash;
    g.start(1);
    g.game.loop.sleep();
    g.scene.accumulator = 0;
    // Targeted geometry fixture: two real buildings straddle the ball's area.
    // Their positions, HP and ability damage remain untouched.
    Object.assign(g.sim.player, { x: 290, y: 80, vx: 0, vy: 0, heading: Math.PI / 2 });
  });
  await page.keyboard.press('Space');
  const area = await page.evaluate(() => {
    const g = window.__smash;
    for (let n = 0; n < 34; n++) g.scene.update(0, 1000 / 60 + .0001);
    return g.sim.buildings.slice(0, 2).map(b => ({ hp: b.hp, maxHp: b.maxHp }));
  });
  expect(area.every(building => building.hp < building.maxHp)).toBe(true);
  await page.evaluate(() => window.__smash.game.loop.wake());
  await page.screenshot({ path: '/tmp/smash-part2-ball-area.png' });
});

test('industrial map, real collapse chain, records, stars, settlement guard and replay', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    const g = window.__smash;
    // Fixture only for reaching locked content. This does not claim to complete
    // missions 1–2; their uninterrupted gameplay is covered by simulation tests.
    g.progress.completeRun({ runId: 'browser-fixture-1', missionId: 1, won: true, score: 1000, destroyed: 3, bestCombo: 3, bestChain: 1, elapsed: 30 });
    g.progress.completeRun({ runId: 'browser-fixture-2', missionId: 2, won: true, score: 3000, destroyed: 8, bestCombo: 3, bestChain: 1, elapsed: 50 });
    localStorage.setItem('smash-city-v2', JSON.stringify(g.progress.state));
  });
  await page.reload();
  await page.waitForFunction(() => window.__smash?.scene?.dozer && window.__smash?.progress);
  await page.click('#levels');
  await page.click('[data-district="industrial"]');
  await expect(page.locator('[data-start-mission="3"]')).toBeEnabled();
  await expect(page.locator('[data-start-mission="4"]')).toBeDisabled();
  await page.screenshot({ path: '/tmp/smash-part2-levels.png' });
  await page.click('[data-start-mission="3"]');
  expect(await page.evaluate(() => window.__smash.scene.ground.texture.key)).toBe('smash-ground-industrial');
  expect(await page.evaluate(() => window.__smash.sim.buildings.slice(0, 3).map(b => b.type))).toEqual(['tower', 'warehouse', 'containers']);
  await page.screenshot({ path: '/tmp/smash-part2-industrial.png' });
  const run = await page.evaluate(() => {
    const g = window.__smash, chainEvents = [];
    g.game.loop.sleep();
    g.scene.accumulator = 0;
    // Accelerated controlled clock with public movement/ability input only.
    // The initial tower, all neighbouring HP, and rewards are unmodified.
    for (let n = 0; n < 1200 && g.sim.phase === 'playing'; n++) {
      Object.assign(g.controls.input, { x: 1, y: 0, ram: false });
      g.controls.ramQueued = g.sim.player.ramCooldown <= 0;
      g.scene.update(0, 1000 / 60 + .0001);
      chainEvents.push(...g.sim.events.filter(e => e.type === 'chain').map(e => e.count));
    }
    return { phase: g.sim.phase, chain: g.sim.bestChain, destroyed: g.sim.destroyed, chainEvents, balance: g.sim.balance, particles: g.scene.particles.filter(p => p.life > 0).length, pool: g.scene.particles.length };
  });
  expect(run.phase).toBe('won');
  expect(run.chain).toBeGreaterThanOrEqual(3);
  expect(run.destroyed).toBeGreaterThanOrEqual(3);
  expect(run.chainEvents).toContain(2);
  expect(run.chainEvents).toContain(3);
  expect(run.particles).toBeLessThanOrEqual(run.pool);
  await page.evaluate(() => window.__smash.game.loop.wake());
  await expect(page.locator('#result-title')).toHaveText('Уровень пройден!');
  await expect(page.locator('.result-stars .earned')).toHaveCount(3);
  const saved = await inspect(page);
  expect(saved.completedLevels).toEqual([1, 2, 3]);
  expect(saved.records[3]).toMatchObject({ wins: 1, stars: 3, bestChain: 3 });
  await page.evaluate(() => { window.__smash.finish(); window.__smash.finish(); });
  expect((await inspect(page)).balance).toBe(saved.balance);
  await page.screenshot({ path: '/tmp/smash-part2-chain-result.png' });
  await page.click('#replay');
  expect(await page.evaluate(() => ({ phase: window.__smash.sim.phase, destroyed: window.__smash.sim.destroyed, pristine: window.__smash.sim.buildings.every(b => b.hp === b.maxHp) }))).toEqual({ phase: 'playing', destroyed: 0, pristine: true });
  await page.evaluate(() => window.__smash.game.loop.wake());
  await page.click('#pause');
  await page.click('#pause-menu');
  await page.click('#garage');
  await expect(page.locator('#garage-screen')).toBeVisible();
  await page.click('#garage-back');
  await page.reload();
  await page.waitForFunction(() => window.__smash?.scene?.dozer && window.__smash?.progress);
  expect((await inspect(page)).records[3]).toEqual(saved.records[3]);
  await page.click('#levels');
  await page.click('[data-district="industrial"]');
  await expect(page.locator('[data-start-mission="4"]')).toBeEnabled();
  const resources = await page.evaluate(() => {
    const g = window.__smash;
    const count = () => ({ objects: g.scene.children.length, textures: g.game.textures.getTextureKeys().length });
    // Ground textures are generated on their first visit; warm both maps before
    // checking for accumulation across repeated transitions.
    g.start(3);
    g.menu();
    const before = count();
    for (let n = 0; n < 20; n++) {
      g.start(3); g.menu();
      g.start(1); g.menu();
    }
    return { before, after: count(), pool: g.scene.particles.length };
  });
  expect(resources.after).toEqual(resources.before);
  expect(resources.pool).toBeLessThanOrEqual(100);
});

test('mobile garage and simultaneous real touch controls work for all three purchased machines', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await legacySave(page, 1000);
  await ready(page);
  await page.click('#garage');
  for (const vehicle of ['excavator', 'wrecker']) {
    await preview(page, vehicle);
    await page.click('#vehicle-action');
  }
  await page.screenshot({ path: '/tmp/smash-part2-mobile-garage.png' });
  const client = await context.newCDPSession(page);
  for (const vehicle of ['dozer', 'excavator', 'wrecker']) {
    await selectOwned(page, vehicle);
    await page.click('#garage-back');
    await page.click('#play');
    expect(await page.evaluate(() => window.__smash.sim.vehicleId)).toBe(vehicle);
    await expect(page.locator('#joystick')).toBeVisible();
    const joystick = await page.locator('#joystick').boundingBox(), ram = await page.locator('#ram').boundingBox();
    const points = [{ x: joystick.x + joystick.width * .76, y: joystick.y + joystick.height * .5, id: 1 }, { x: ram.x + ram.width / 2, y: ram.y + ram.height / 2, id: 2 }];
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__smash.controls.input.x)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__smash.controls.input.ram)).toBe(true);
    expect(await page.evaluate(() => window.__smash.sim.player.ramCooldown)).toBeGreaterThan(0);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(await page.evaluate(() => window.__smash.controls.input)).toEqual({ x: 0, y: 0, ram: false });
    await page.screenshot({ path: `/tmp/smash-part2-mobile-${vehicle}.png` });
    await page.click('#pause');
    await page.click('#pause-menu');
    await page.click('#garage');
  }
  await page.click('#garage-back');
  await page.click('#play');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__smash.game.scale.width === innerWidth && window.__smash.game.scale.height === innerHeight);
  expect(await page.locator('#game canvas').evaluate(c => Math.round(c.getBoundingClientRect().width))).toBe(844);
  expect(await page.evaluate(() => {
    const a = document.querySelector('#ram').getBoundingClientRect(), b = document.querySelector('#joystick').getBoundingClientRect();
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  })).toBe(false);
  await page.screenshot({ path: '/tmp/smash-part2-mobile-landscape.png' });
  expect(errors).toEqual([]);
  await context.close();
});
