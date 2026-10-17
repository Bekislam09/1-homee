import {test,expect} from '@playwright/test';

test('site map follows real destruction and objectives distinguish score from required clearance',async({page})=>{
 await page.goto('/?test');await expect(page.locator('#play')).toBeEnabled();await page.click('#play');
 await expect(page.locator('#objective-label')).toHaveText('Score target');
 await expect(page.locator('#clearance-progress')).toHaveText('Clearance 0/23');
 await expect(page.locator('#map-remaining')).toHaveText('14 left');
 await page.keyboard.press('Space');await expect(page.locator('#map-remaining')).toHaveText('13 left');
 await expect(page.locator('#site-map')).toHaveAttribute('aria-label',/13 buildings remaining/);
 const position=await page.evaluate(async()=>{
  const {driveDistrict}=await import('/tests/helpers/drive.js');const g=window.__smash;g.game.loop.sleep();
  try{driveDistrict(g.sim,{tick:input=>{
   g.sim.update(1/60,input);g.scene.handleEvents(g.sim.events);
   if(g.sim.progress>=g.sim.goal)throw Error('target-reached');
  }});}catch(error){if(error.message!=='target-reached')throw error;}
  g.game.loop.wake();return {phase:g.sim.phase,destroyed:g.sim.destroyed,required:g.sim.mission.minDestroyed};
 });
 expect(position.phase).toBe('playing');expect(position.destroyed).toBeLessThan(position.required);
 await expect(page.locator('#objective-check')).toBeVisible();await expect(page.locator('#clearance-check')).toBeHidden();
 await expect(page.locator('#clearance-objective')).toBeVisible();
 await page.click('#pause');await page.click('#pause-menu');await page.click('#free-play');await page.click('[data-free-district="town"]');
 await expect(page.locator('#map-remaining')).toHaveText('14 left');await expect(page.locator('#objective-label')).toHaveText('Buildings cleared');
 await expect(page.locator('#clearance-objective')).toBeHidden();await expect(page.locator('#block-progress')).toHaveText('Free play');
});

test('mobile navigation instruments stay inside the screen and clear of touch controls',async({browser})=>{
 const context=await browser.newContext({viewport:{width:320,height:640},isMobile:true,hasTouch:true});const page=await context.newPage();
 await page.goto('/?test');await expect(page.locator('#play')).toBeEnabled();await page.click('#play');
 for(const size of [{width:320,height:640},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(size);await expect.poll(()=>page.evaluate(()=>window.__smash.game.scale.width)).toBe(size.width);
  for(const selector of ['#site-map','.goal-panel']){
   const bounds=await page.locator(selector).boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.y).toBeGreaterThanOrEqual(0);
   expect(bounds.x+bounds.width).toBeLessThanOrEqual(size.width);expect(bounds.y+bounds.height).toBeLessThanOrEqual(size.height);
   expect(await page.locator(selector).evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
  const map=await page.locator('#site-map').boundingBox(),ability=await page.locator('#ram').boundingBox();
  expect(map.y+map.height).toBeLessThanOrEqual(ability.y);
  await page.locator('#ram').click({trial:true});await page.locator('#joystick').click({trial:true});
 }
 await context.close();
});
