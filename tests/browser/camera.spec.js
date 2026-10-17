import { test, expect } from '@playwright/test';

test('all machines stay below the HUD at spawn and the north edge across desktop and touch layouts', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/?test');
  await expect(page.locator('#play')).toBeEnabled();
  for (const size of [{ width: 1440, height: 900 }, { width: 320, height: 640 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await expect.poll(() => page.evaluate(() => window.__smash.game.scale.width)).toBe(size.width);
    const positions = await page.evaluate(() => {
      const game = window.__smash;
      const results = [];
      for (const vehicleId of ['dozer', 'excavator', 'wrecker', 'roller', 'drill']) {
        game.progress.state.selectedVehicle = vehicleId;
        game.start(1);
        game.game.loop.sleep();
        for (const edge of ['spawn', 'north']) {
          if (edge === 'north') game.sim.player.x = game.sim.player.y = 25;
          game.scene.layout();
          game.scene.update(0, 0);
          const camera = game.scene.cameras.main;
          camera.preRender();
          const vehicle = game.scene.dozer;
          const source = vehicle.texture.getSourceImage();
          const pixels = source.getContext('2d').getImageData(0, 0, source.width, source.height).data;
          let alphaTop = source.height;
          for (let y = 0; y < source.height && alphaTop === source.height; y++) {
            for (let x = 0; x < source.width; x++) {
              if (pixels[(y * source.width + x) * 4 + 3] >= 16) { alphaTop = y; break; }
            }
          }
          const top = (vehicle.y - vehicle.displayHeight + alphaTop * vehicle.scaleY - camera.worldView.y) * camera.zoom;
          results.push({ vehicleId, edge, top, panelBottom: document.querySelector('.goal-panel').getBoundingClientRect().bottom });
        }
      }
      game.game.loop.wake();
      return results;
    });
    for (const position of positions) {
      expect(position.top, `${size.width}×${size.height}: ${position.vehicleId} at ${position.edge}`).toBeGreaterThanOrEqual(position.panelBottom + 6);
      expect(position.top).toBeLessThan(size.height - 45);
    }
  }
  await context.close();
});
