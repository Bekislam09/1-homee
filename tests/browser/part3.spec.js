import {test,expect} from '@playwright/test';
const ready=async page=>{await page.goto('/?test');await expect(page.locator('#play')).toBeEnabled();};
test('English-only edition ignores legacy Russian preference and retains settings without overflow',async({browser})=>{
 const context=await browser.newContext({locale:'ru-RU',viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(!localStorage.getItem('smash-city-v3'))localStorage.setItem('smash-city-v3',JSON.stringify({settings:{language:'ru'}}));});
 await ready(page);await expect(page.locator('#play-label')).toHaveText('Play');await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('[data-home-vehicle]')).toHaveCount(5);
 await page.click('#garage');await expect(page.locator('[data-vehicle]')).toHaveCount(5);expect(await page.locator('#garage-screen').innerText()).not.toMatch(/[А-Яа-яЁё]/);
 await page.click('#home-tab');await page.click('#levels');await expect(page.locator('[data-mission]')).toHaveCount(6);expect(await page.locator('#levels-screen').innerText()).not.toMatch(/[А-Яа-яЁё]/);
 await page.click('#home-tab');await page.click('#settings');await expect(page.locator('#language')).toBeDisabled();await expect(page.locator('#language')).toHaveValue('en');
 await page.selectOption('#quality','low');await page.uncheck('#shake-check');await page.click('#settings-done');await page.reload();await expect(page.locator('#play-label')).toHaveText('Play');
 await page.click('#settings');await expect(page.locator('#quality')).toHaveValue('low');await expect(page.locator('#shake-check')).not.toBeChecked();expect(errors).toEqual([]);await context.close();
});
test('achievements are real, daily reward is once per day, free mode has no permanent money and restores map',async({page})=>{
 await ready(page);await page.click('#daily');await page.click('#claim-daily');await expect(page.locator('#balance')).toHaveText('50');await expect(page.locator('#claim-daily')).toBeDisabled();await page.click('#close-final');await page.click('#free-play');await page.click('[data-free-district="town"]');await page.keyboard.press('Space');await expect(page.locator('#run-coins')).toHaveText('0');await expect.poll(()=>page.evaluate(()=>window.__smash.sim.destroyed)).toBe(1);await expect(page.locator('#timer')).toHaveText('∞');expect(await page.evaluate(()=>window.__smash.sim.balance)).toBe(50);expect(await page.evaluate(()=>window.__smash.progress.state.achievements)).toContain('first-hit');await page.click('#restore-map');expect(await page.evaluate(()=>window.__smash.sim.buildings.every(b=>b.hp===b.maxHp))).toBe(true);await page.click('#pause');await page.click('#pause-menu');await expect(page.locator('#restore-map')).toBeHidden();await page.click('#achievements');await expect(page.locator('.achievement.earned')).toHaveCount(1);await page.click('#close-final');await page.reload();await expect(page.locator('#play')).toBeEnabled();await page.click('#daily');await expect(page.locator('#claim-daily')).toBeDisabled();await expect(page.locator('#balance')).toHaveText('50');
});
test('confirmed reward callback doubles only once, ad lock mutes and pauses, visibility pause survives',async({page})=>{
 await ready(page);
 await page.evaluate(()=>{
  const g=window.__smash;g.start(1);g.sim.score=g.sim.mission.target;g.sim.destroyed=g.sim.mission.minDestroyed;g.sim.phase='won';g.finish();
  // Explicit test adapter: production builds contain no fixture or synthetic success.
  const listeners=[];g.setTestPlatform({ready:true,canRewarded:true,canInterstitial:false,gameplayStart(){},gameplayStop(){},getLanguage(){return'ru';},onStateChange(fn){listeners.push(fn);return()=>{};},showRewarded(){return new Promise(resolve=>window.__resolveTestAd=resolve);}});g.renderResult();
 });
 const before=await page.evaluate(()=>window.__smash.sim.balance);await expect(page.locator('#double-reward')).toBeVisible();await page.click('#double-reward');expect(await page.evaluate(()=>window.__smash.ads.busy)).toBe(true);expect(await page.evaluate(()=>window.__smash.controls.paused)).toBe(true);await page.evaluate(()=>{window.__smash.life.reason('focus',true);window.__resolveTestAd({available:true,shown:true,rewarded:true});});await expect(page.locator('#double-reward')).toHaveCount(0);expect(await page.evaluate(()=>window.__smash.sim.balance)).toBe(before+250);expect(await page.evaluate(()=>window.__smash.life.reasons.has('focus'))).toBe(true);await page.evaluate(()=>window.__smash.renderResult());expect(await page.evaluate(()=>window.__smash.sim.balance)).toBe(before+250);await page.reload();await expect(page.locator('#play')).toBeEnabled();expect(await page.evaluate(()=>window.__smash.progress.state.balance)).toBe(before+250);
});

test('ten complete missions in one session keep resources bounded and records consistent',async({page})=>{
 await ready(page);
 const stress=await page.evaluate(async()=>{
  const {driveDistrict}=await import('/tests/helpers/drive.js');
  const g=window.__smash;g.game.loop.sleep();g.start(1);g.scene.update(0,1000/60);
  const baseline={objects:g.scene.children.length,textures:g.game.textures.getTextureKeys().length};const phases=[];
  for(let n=0;n<10;n++){
    g.start(1);driveDistrict(g.sim,{tick:input=>{g.sim.update(1/60,input);g.scene.handleEvents(g.sim.events);}});g.finish();phases.push(g.sim.phase);
  }
  const result={phases,wins:g.progress.state.records[1]?.wins,total:g.progress.state.stats.destroyed,before:baseline,after:{objects:g.scene.children.length,textures:g.game.textures.getTextureKeys().length},pool:g.scene.particles.length,active:g.scene.particles.filter(p=>p.life>0).length};g.game.loop.wake();return result;
 });
 expect(stress.phases).toEqual(Array(10).fill('won'));expect(stress.wins).toBe(10);expect(stress.total).toBeGreaterThanOrEqual(230);expect(stress.after).toEqual(stress.before);expect(stress.active).toBeLessThanOrEqual(stress.pool);
});
