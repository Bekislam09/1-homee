import {test,expect} from '@playwright/test';
const ready=async page=>{await page.goto('/?test');await expect(page.locator('#play')).toBeEnabled();};
test('full English UI, manual language priority, settings and localization without layout overflow',async({browser})=>{
 const context=await browser.newContext({locale:'en-US',viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);await expect(page.locator('#play-label')).toHaveText('Play');await page.click('#garage');await expect(page.locator('.vehicle-details h3')).toHaveText('Bulldozer');expect(await page.locator('#garage-screen').innerText()).not.toMatch(/[А-Яа-яЁё]/);await page.click('#garage-back');await page.click('#levels');expect(await page.locator('#levels-screen').innerText()).not.toMatch(/[А-Яа-яЁё]/);await page.click('#levels-back');await page.click('#settings');await page.selectOption('#language','ru');await expect(page.locator('#settings-title')).toHaveText('Настройки');await page.selectOption('#quality','low');await page.uncheck('#shake-check');await page.click('#settings-done');await page.reload();await expect(page.locator('#play-label')).toHaveText('Играть');await page.click('#settings');await expect(page.locator('#language')).toHaveValue('ru');await expect(page.locator('#quality')).toHaveValue('low');await expect(page.locator('#shake-check')).not.toBeChecked();expect(errors).toEqual([]);await context.close();
});
test('achievements are real, daily reward is once per day, free mode has no permanent money and restores map',async({page})=>{
 await ready(page);await page.click('#daily');await page.click('#claim-daily');await expect(page.locator('#balance')).toHaveText('50');await expect(page.locator('#claim-daily')).toBeDisabled();await page.click('#close-final');await page.click('#free-play');await page.click('[data-free-district="town"]');await page.keyboard.press('Space');await expect(page.locator('#run-coins')).toHaveText('0');await expect.poll(()=>page.evaluate(()=>window.__smash.sim.destroyed)).toBe(1);await expect(page.locator('#timer')).toHaveText('∞');expect(await page.evaluate(()=>window.__smash.sim.balance)).toBe(50);expect(await page.evaluate(()=>window.__smash.progress.state.achievements)).toContain('first-hit');await page.click('#restore-map');expect(await page.evaluate(()=>window.__smash.sim.buildings.every(b=>b.hp===b.maxHp))).toBe(true);await page.click('#pause');await page.click('#pause-menu');await expect(page.locator('#restore-map')).toBeHidden();await page.click('#achievements');await expect(page.locator('.achievement.earned')).toHaveCount(1);await page.click('#close-final');await page.reload();await expect(page.locator('#play')).toBeEnabled();await page.click('#daily');await expect(page.locator('#claim-daily')).toBeDisabled();await expect(page.locator('#balance')).toHaveText('50');
});
test('confirmed reward callback doubles only once, ad lock mutes and pauses, visibility pause survives',async({page})=>{
 await ready(page);
 await page.evaluate(()=>{
  const g=window.__smash;g.start(1);g.sim.score=1000;g.sim.phase='won';g.finish();
  // Explicit test adapter: production builds contain no fixture or synthetic success.
  const listeners=[];g.setTestPlatform({ready:true,canRewarded:true,canInterstitial:false,gameplayStart(){},gameplayStop(){},getLanguage(){return'ru';},onStateChange(fn){listeners.push(fn);return()=>{};},showRewarded(){return new Promise(resolve=>window.__resolveTestAd=resolve);}});g.renderResult();
 });
 const before=await page.evaluate(()=>window.__smash.sim.balance);await expect(page.locator('#double-reward')).toBeVisible();await page.click('#double-reward');expect(await page.evaluate(()=>window.__smash.ads.busy)).toBe(true);expect(await page.evaluate(()=>window.__smash.controls.paused)).toBe(true);await page.evaluate(()=>{window.__smash.life.reason('focus',true);window.__resolveTestAd({available:true,shown:true,rewarded:true});});await expect(page.locator('#double-reward')).toHaveCount(0);expect(await page.evaluate(()=>window.__smash.sim.balance)).toBe(before+150);expect(await page.evaluate(()=>window.__smash.life.reasons.has('focus'))).toBe(true);await page.evaluate(()=>window.__smash.renderResult());expect(await page.evaluate(()=>window.__smash.sim.balance)).toBe(before+150);await page.reload();await expect(page.locator('#play')).toBeEnabled();expect(await page.evaluate(()=>window.__smash.progress.state.balance)).toBe(before+150);
});

test('ten complete missions in one session keep resources bounded and records consistent',async({page})=>{
 await ready(page);
 const stress=await page.evaluate(()=>{
  const g=window.__smash;g.game.loop.sleep();g.start(1);
  const baseline={objects:g.scene.children.length,textures:g.game.textures.getTextureKeys().length};
  const frame=input=>{Object.assign(g.controls.input,{x:0,y:0,ram:false},input);g.scene.update(0,1000/60+.0001);};
  const drive=(x,y)=>{for(let n=0;n<1200&&g.sim.phase==='playing';n++){const dx=x-g.sim.player.x,dy=y-g.sim.player.y,d=Math.hypot(dx,dy);if(d<6)break;frame({x:dx/d,y:dy/d});}};
  const destroy=b=>{drive(b.x-74,b.y);for(let n=0;n<1000&&b.hp>0&&g.sim.phase==='playing';n++)frame({x:1,ram:g.sim.player.ramCooldown<=0});};
  const phases=[];
  for(let n=0;n<10;n++){if(n)g.start(1);destroy(g.sim.buildings[0]);drive(290,180);destroy(g.sim.buildings[1]);drive(510,180);destroy(g.sim.buildings[2]);phases.push(g.sim.phase);}
  const result={phases,wins:g.progress.state.records[1]?.wins,total:g.progress.state.stats.destroyed,before:baseline,after:{objects:g.scene.children.length,textures:g.game.textures.getTextureKeys().length},pool:g.scene.particles.length,active:g.scene.particles.filter(p=>p.life>0).length};g.game.loop.wake();return result;
 });
 expect(stress.phases).toEqual(Array(10).fill('won'));expect(stress.wins).toBe(10);expect(stress.total).toBe(30);expect(stress.after).toEqual(stress.before);expect(stress.active).toBeLessThanOrEqual(stress.pool);
});
