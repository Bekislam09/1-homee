import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,extname} from 'node:path';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const root=process.cwd(),temp='/tmp/smash-archive-smoke';await mkdir(temp,{recursive:true});
const names=['crazygames-basic','crazygames-full'];
for(const name of names){const destination=`${temp}/${name}`;await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});const r=spawnSync('python3',['-c','import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',`releases/smash-city-${name}.zip`,destination]);assert.equal(r.status,0,`extract ${name}`);}
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://local').pathname);const base=path.startsWith('/local/')?resolve(root,'dist'):resolve(temp);const relative=path.startsWith('/local/')?path.slice(7):path.slice(1);let file=resolve(base,relative||'.');if(!file.startsWith(base+'/')&&file!==base)throw Error('path');if((await stat(file)).isDirectory())file=resolve(file,'index.html');const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime});res.end(await readFile(file));}catch{res.writeHead(404);res.end('missing');}});
await new Promise(resolve=>server.listen(4180,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});const results=[];
try{
 for(const name of names){const context=await browser.newContext({locale:'ru-RU',viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Test only SDK-unavailable recovery here; no synthetic success is injected.
  await page.route('**/sdk.js',r=>r.abort());await page.route('https://sdk.crazygames.com/**',r=>r.abort());
  await page.addInitScript(()=>localStorage.setItem('smash-city-v3',JSON.stringify({settings:{language:'ru'}})));
  await page.goto(`http://127.0.0.1:4180/${name}/`);await page.waitForSelector('#play:not([disabled])');assert.equal(await page.evaluate(()=>window.__smash===undefined),true);assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.match(await page.locator('#play').innerText(),/PLAY/i);await page.click('#play');await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('#run-coins').textContent==='25');assert.deepEqual(errors,[]);assert.equal(await page.locator('#double-reward').count(),0);results.push({target:name,source:'extracted ZIP',sdk:'unavailable (intentionally blocked)',play:true,realKeyboardDestruction:true,coins:25,productionHarnessAbsent:true,englishWithRussianBrowser:true,pageErrors:errors});await context.close();
 }
 await mkdir('releases/promo',{recursive:true});const page=await browser.newPage({locale:'en-US',viewport:{width:1920,height:1080}});await page.goto('http://127.0.0.1:4180/local/');await page.waitForSelector('#play:not([disabled])');await page.screenshot({path:'releases/promo/cover-1920x1080.png'});
 await page.setViewportSize({width:1080,height:1080});await page.waitForTimeout(150);await page.screenshot({path:'releases/promo/cover-1080x1080.png'});await page.setViewportSize({width:800,height:1200});await page.waitForTimeout(150);await page.screenshot({path:'releases/promo/cover-800x1200.png'});
 await page.setViewportSize({width:1920,height:1080});await page.click('#play');await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('#run-coins').textContent==='25');await page.screenshot({path:'releases/promo/gameplay-1920x1080.png'});await page.click('#pause');await page.click('#pause-menu');await page.click('#garage');await page.screenshot({path:'releases/promo/garage-1920x1080.png'});
 await writeFile('releases/http-smoke-report.json',JSON.stringify({checks:results,promotionalImages:'Real screenshots of the local production build; menu captures are covers, gameplay captures show the actual game.',unverified:['Real platform iframe/SDK initialization','Real advertising inventory or payment','Device FPS and platform upload limits']},null,2)+'\n');console.log(JSON.stringify(results,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
