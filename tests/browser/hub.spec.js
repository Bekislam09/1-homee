import {test,expect} from '@playwright/test';

test('one fixed navigation deck connects every hub and launches the selected machine directly',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('smash-city-v3',JSON.stringify({version:3,balance:5000,ownedVehicles:['dozer','excavator']})));
 await page.goto('/?test');await expect(page.locator('#play')).toBeEnabled();
 await expect(page.locator('#home-tab')).toHaveAttribute('aria-current','page');
 const home=await page.locator('#hub-nav').boundingBox();
 await page.click('#garage');await expect(page.locator('#garage')).toHaveAttribute('aria-current','page');
 await page.click('[data-vehicle="excavator"]');await page.click('#vehicle-action');
 await expect(page.locator('#launch-machine')).toHaveText('Excavator');
 await page.click('[data-vehicle="drill"]');await expect(page.locator('#launch-machine')).toHaveText('Excavator');
 await page.click('#levels');await expect(page.locator('#levels')).toHaveAttribute('aria-current','page');
 const levels=await page.locator('#hub-nav').boundingBox();expect(levels).toEqual(home);
 await page.keyboard.press('Escape');await expect(page.locator('#home-tab')).toHaveAttribute('aria-current','page');
 await page.click('#garage');await page.click('#play');
 expect(await page.evaluate(()=>window.__smash.sim.vehicleId)).toBe('excavator');
 await expect(page.locator('#hub-nav')).toBeHidden();
 await page.click('#pause');await page.click('#restart');
 expect(await page.evaluate(()=>window.__smash.controls.paused)).toBe(false);
 expect(await page.evaluate(()=>window.__smash.sim.vehicleId)).toBe('excavator');
 await page.click('#pause');await page.click('#pause-menu');
 await page.click('#free-play');await page.click('[data-free-district="town"]');await page.keyboard.press('Space');
 await page.click('#pause');await page.click('#restart');
 expect(await page.evaluate(()=>window.__smash.sim.freeMode)).toBe(true);expect(await page.evaluate(()=>window.__smash.sim.destroyed)).toBe(0);
});

test('chosen job survives hub transitions and results prioritise the next contract',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('smash-city-v3',JSON.stringify({version:3,completedLevels:[1,2]})));
 await page.goto('/?test');await expect(page.locator('#play')).toBeEnabled();await page.click('#levels');
 await page.click('[data-district="town"]');await page.click('[data-start-mission="2"]');
 await page.click('#pause');await page.click('#pause-menu');
 await expect(page.locator('#launch-mission')).toHaveText('Job 2: Block by Block');
 await page.click('#garage');await page.keyboard.press('Escape');await page.click('#play');
 expect(await page.evaluate(()=>window.__smash.sim.mission.id)).toBe(2);
 await page.evaluate(()=>{const g=window.__smash;g.sim.score=g.sim.mission.target;g.sim.destroyed=g.sim.mission.minDestroyed;g.sim.phase='won';g.finish();});
 await expect(page.locator('#next-contract')).toBeFocused();await expect(page.locator('#replay')).toHaveClass('secondary-button');
 await page.keyboard.press('Escape');await expect(page.locator('#launch-mission')).toHaveText('Job 3: Domino District');
 await expect(page.locator('#home-tab')).toBeFocused();
});

test('the same tabs and Play remain visible while scrolling a phone garage and job list',async({page})=>{
 await page.goto('/?test');await expect(page.locator('#play')).toBeEnabled();
 for(const size of [{width:320,height:640},{width:390,height:844},{width:800,height:1200},{width:844,height:390}]){
  await page.setViewportSize(size);await expect.poll(()=>page.evaluate(()=>window.__smash.game.scale.width)).toBe(size.width);
  for(const screen of ['home-tab','garage','levels']){
   await page.click('#'+screen);
   if(screen!=='home-tab')await page.locator(screen==='garage'?'#garage-screen':'#levels-screen').evaluate(el=>el.scrollTop=el.scrollHeight);
   for(const selector of ['#home-tab','#garage','#levels','#play']){
    const box=await page.locator(selector).boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(size.width);expect(box.y+box.height).toBeLessThanOrEqual(size.height);
    await page.locator(selector).click({trial:true});
   }
  }
 }
});


test('phone vehicle purchase and selection stay visible above the same Play deck',async({page})=>{
 await page.setViewportSize({width:320,height:640});
 await page.addInitScript(()=>localStorage.setItem('smash-city-v3',JSON.stringify({version:3,balance:2000})));
 await page.goto('/?test');await expect(page.locator('#play')).toBeEnabled();await page.click('#garage');await page.click('[data-vehicle="excavator"]');
 const action=await page.locator('#vehicle-action').boundingBox(),deck=await page.locator('#hub-nav').boundingBox();
 expect(action.y+action.height).toBeLessThan(deck.y);expect(action.x).toBeGreaterThanOrEqual(0);expect(action.x+action.width).toBeLessThanOrEqual(320);
 await expect(page.locator('#vehicle-action')).toHaveText(/Buy Excavator/);await page.click('#vehicle-action');
 await expect(page.locator('#launch-machine')).toHaveText('Excavator');await page.click('#play');
 expect(await page.evaluate(()=>window.__smash.sim.vehicleId)).toBe('excavator');
});
