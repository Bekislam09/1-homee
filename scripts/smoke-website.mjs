import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://bekislam09.github.io';
const prefix = '/1-homee/';
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff': 'font/woff', '.txt': 'text/plain'};
const cases = [
  {source: 'root', entry: '', destination: 'docs/'},
  {source: 'root', entry: 'index.html?from=shared#city', destination: 'docs/?from=shared#city'},
  {source: 'root', entry: 'docs/', destination: 'docs/'},
  {source: 'docs', entry: '', destination: ''},
  {source: 'docs', entry: 'index.html?from=shared#city', destination: 'index.html?from=shared#city'},
];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
try {
  for (const scenario of cases) {
    const context = await browser.newContext({locale: 'ru-RU', viewport: {width: 1366, height: 768}, serviceWorkers: 'block'});
    const errors = [], missing = [];
    // Emulate Pages with local files. This never contacts the public host.
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      try {
        assert.equal(url.origin, origin, 'Unexpected external request');
        assert(url.pathname.startsWith(prefix), 'Asset escaped the repository subpath');
        const base = scenario.source === 'root' ? root : resolve(root, 'docs');
        let file = resolve(base, decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html');
        assert(file.startsWith(base + '/'), 'File escaped the fixture root');
        if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
        await route.fulfill({status: 200, contentType: mime[extname(file)] || 'application/octet-stream', body: await readFile(file)});
      } catch (error) {
        missing.push(`${url.pathname}: ${error.message}`);
        await route.fulfill({status: 404, body: 'Missing fixture resource'});
      }
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + prefix + scenario.entry);
    await page.waitForURL(origin + prefix + scenario.destination);
    await page.waitForSelector('#play:not([disabled])');
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => [...document.fonts].some(face=>face.family==='Fredoka'&&face.status==='loaded')), true);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('meta[name="smash-platform"]').getAttribute('content'), 'local');
    assert.equal(await page.evaluate(() => window.__smash === undefined), true);
    await page.click('#play');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.querySelector('#run-coins').textContent === '25');
    assert.deepEqual(errors, [], 'JavaScript errors');
    assert.deepEqual(missing, [], 'Missing or unexpected resources');
    console.log(`${scenario.source}/${scenario.entry || '(index)'} -> ${scenario.destination || '(index)'}: Play, destruction, 25 coins, English and assets passed`);
    await context.close();
  }
  console.log('Local Pages emulation passed. This does not verify the public deployment.');
} finally {
  await browser.close();
}
