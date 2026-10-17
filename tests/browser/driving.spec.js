import { test, expect } from '@playwright/test';

const position = page => page.evaluate(() => {
  const { x, y, heading, speed } = window.__smash.sim.player;
  return { x, y, heading, speed };
});

const frames = (page, count) => page.evaluate(count => {
  // Only the frame clock is controlled; all commands arrive through the real
  // keyboard/pointer handlers and CityScene's production input path.
  const game = window.__smash;
  for (let frame = 0; frame < count; frame++) game.scene.update(0, 1000 / 60 + .0001);
  const { x, y, heading, speed } = game.sim.player;
  return { x, y, heading, speed };
}, count);

const park = async (page, heading) => {
  await page.goto('/?test');
  await expect(page.locator('#play')).toBeEnabled();
  await page.click('#play');
  await page.evaluate(heading => {
    const game = window.__smash;
    game.game.loop.sleep();
    game.scene.accumulator = 0;
    // Initial fixture: a clear junction between actual buildings. There are no
    // later teleports, heading writes, removed obstacles or direct sim commands.
    Object.assign(game.sim.player, { x: 500, y: 290, vx: 0, vy: 0, speed: 0, heading });
  }, heading);
};

const assertStraight = (before, after, direction) => {
  const dx = after.x - before.x, dy = after.y - before.y;
  const along = dx * Math.cos(before.heading) + dy * Math.sin(before.heading);
  const sideways = dx * Math.sin(before.heading) - dy * Math.cos(before.heading);
  expect(along * direction).toBeGreaterThan(15);
  expect(Math.abs(sideways)).toBeLessThan(.00001);
  expect(after.heading).toBe(before.heading);
};

for (const heading of [.37, -1.1, 2.45]) {
  test(`keyboard forward and reverse keep heading ${heading}; only explicit steering changes it`, async ({ page }) => {
    await park(page, heading);
    const initial = await position(page);
    await page.keyboard.down('w');
    const forward = await frames(page, 24);
    await page.keyboard.up('w');
    assertStraight(initial, forward, 1);
    expect(await page.evaluate(() => window.__smash.controls.input)).toEqual({ throttle: 0, steer: 0, ram: false });

    await page.keyboard.down('s');
    const reverse = await frames(page, 50);
    await page.keyboard.up('s');
    assertStraight(forward, reverse, -1);
    await frames(page, 40);

    await page.keyboard.down('d');
    const turned = await frames(page, 10);
    await page.keyboard.up('d');
    expect(turned.heading).toBeGreaterThan(reverse.heading + .1);
    const afterRelease = await frames(page, 18);
    expect(afterRelease.heading).toBe(turned.heading);

    await page.keyboard.down('w');
    const newForward = await frames(page, 24);
    await page.keyboard.up('w');
    assertStraight(afterRelease, newForward, 1);

    await frames(page, 30);
    await page.keyboard.down('a');
    const left = await frames(page, 8);
    await page.keyboard.up('a');
    expect(left.heading).toBeLessThan(newForward.heading - .1);
    const stopped = await frames(page, 30);
    expect(stopped.heading).toBe(left.heading);
    expect(await page.evaluate(() => window.__smash.sim.destroyed)).toBe(0);
  });
}

test('vertical touch driving ignores sideways finger jitter and preserves forward/reverse heading', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await park(page, 1.13);
  const joystick = await page.locator('#joystick').boundingBox();
  const client = await context.newCDPSession(page);
  const touch = (type, x, y) => client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x: joystick.x + joystick.width * x, y: joystick.y + joystick.height * y, id: 1 }],
  });

  const initial = await position(page);
  await touch('touchStart', .525, .475);
  expect(await page.evaluate(() => window.__smash.controls.input)).toEqual({ throttle: 0, steer: 0, ram: false });
  const deadzone = await frames(page, 30);
  expect(deadzone).toEqual(initial);

  await touch('touchMove', .52, .21);
  expect(await page.evaluate(() => window.__smash.controls.input.steer)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__smash.controls.input.throttle)).toBeGreaterThan(.7);
  const forward = await frames(page, 24);
  assertStraight(initial, forward, 1);

  await touch('touchMove', .48, .79);
  expect(await page.evaluate(() => window.__smash.controls.input.steer)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__smash.controls.input.throttle)).toBeLessThan(-.7);
  const reverse = await frames(page, 50);
  assertStraight(forward, reverse, -1);
  await touch('touchEnd');
  expect(await page.evaluate(() => window.__smash.controls.input)).toEqual({ throttle: 0, steer: 0, ram: false });
  const released = await frames(page, 35);
  expect(released.heading).toBe(initial.heading);

  await touch('touchStart', .78, .5);
  expect(await page.evaluate(() => window.__smash.controls.input.steer)).toBeGreaterThan(.5);
  expect(await page.evaluate(() => window.__smash.controls.input.throttle)).toBe(0);
  const turn = await frames(page, 10);
  expect(turn.heading).toBeGreaterThan(released.heading + .1);
  await touch('touchEnd');
  const stopped = await frames(page, 20);
  expect(stopped.heading).toBe(turn.heading);
  expect(await page.evaluate(() => window.__smash.sim.destroyed)).toBe(0);
  await context.close();
});
