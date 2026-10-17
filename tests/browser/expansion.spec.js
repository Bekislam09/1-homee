import {test,expect} from '@playwright/test';

test('home controls remain visible across desktop, portrait and landscape layouts',async({page})=>{
 await page.goto('/?test');await expect(page.locator('#play')).toBeEnabled();
 for(const size of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(size);
  await expect.poll(()=>page.evaluate(()=>window.__smash.game.scale.width)).toBe(size.width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(size.width);
  for(const selector of ['#play','#garage','#levels','[data-home-vehicle="drill"]']){
   const box=await page.locator(selector).boundingBox();expect(box).not.toBeNull();
   expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
   expect(box.x+box.width).toBeLessThanOrEqual(size.width+1);expect(box.y+box.height).toBeLessThanOrEqual(size.height+1);
   await page.locator(selector).click({trial:true});
  }
 }
});

test('all five machines render smooth turns using bounded reusable textures',async({page})=>{
 await page.goto('/?test');await expect(page.locator('#play')).toBeEnabled();
 const result=await page.evaluate(async()=>{
  const {vehiclePose}=await import('/src/smash/art.js');const g=window.__smash;g.game.loop.sleep();
  const ids=['dozer','excavator','wrecker','roller','drill'];
  for(const id of ids)vehiclePose(g.scene,id,0);
  const before=g.game.textures.getTextureKeys().length,poses={};
  for(let pass=0;pass<2;pass++)for(const id of ids){
   const stamps=new Set();
   for(let degree=0;degree<=90;degree+=3){const key=vehiclePose(g.scene,id,degree*Math.PI/180,0,null);stamps.add(g.game.textures.get(key).smashPose);}
   poses[id]=stamps.size;
  }
  const after=g.game.textures.getTextureKeys().length;g.game.loop.wake();return {before,after,poses};
 });
 expect(result.after).toBe(result.before);
 for(const count of Object.values(result.poses))expect(count).toBe(31);
});
