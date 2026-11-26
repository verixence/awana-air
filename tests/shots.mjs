// v2 deliverable screenshots:
//   screens/v2/mobile-<section>.png (iPhone 14, WebKit), screens/v2/android-<section>.png (Pixel 7, Chromium),
//   screens/v2/desktop-<section>.png (1440x900, Chromium), screens/v2/mobile-fullpage.png
// Section shots capture each whole section; the fixed header/bar are hidden for those so they don't cover content
// (the real-viewport captures with the fixed UI are in screens/v2/steps/ from tests/run.mjs).
import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './server.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE = process.env.BASE_URL;
const { srv, url } = BASE ? { url: BASE } : await serve(ROOT);
const OUT = path.join(ROOT, 'screens/v2'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SECTIONS = [['hero', '.hero'], ['intro', '.intro'], ['services', '#services'], ['partners', '#partners'], ['why', '#why'], ['globe', '#network'], ['process', '#process'], ['cta', '.cta-band'], ['form', '#partner'], ['footer', '.site-footer']];
const T = [['mobile', webkit, devices['iPhone 14']], ['android', chromium, devices['Pixel 7']], ['desktop', chromium, { viewport: { width: 1440, height: 900 } }]];
for (const [name, type, opts] of T) {
  const b = await type.launch(type === chromium ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});
  const ctx = await b.newContext(opts); const p = await ctx.newPage();
  await p.goto(url + '/?3d=force');
  await p.waitForFunction(() => document.querySelector('#hero-canvas').classList.contains('ready'), null, { timeout: 30000 }).catch(() => console.log(name, 'hero 3D not ready'));
  await sleep(2500);
  await p.screenshot({ path: `${OUT}/${name}-hero-viewport.png` });
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); } scrollTo(0, 0); });
  await sleep(1500);
  await p.addStyleTag({ content: '.site-header,.mobile-bar,.wa-bubble{visibility:hidden!important}' });
  for (const [s, sel] of SECTIONS) {
    if (s === 'form') { await p.fill('#f-name', 'Asha Rao'); await p.fill('#f-business', 'Skyline Tours & Travels'); await p.selectOption('#f-type', 'Tour & travel agency'); await p.fill('#f-city', 'Jaipur'); await p.selectOption('#f-service', 'Helicopter Charters'); await p.click('#partner-form button[type=submit]'); }
    const loc = p.locator(sel).first(); await loc.scrollIntoViewIfNeeded(); await sleep(s === 'globe' || s === 'hero' ? 2000 : 500);
    await loc.screenshot({ path: `${OUT}/${name}-${s}.png` });
  }
  if (name === 'mobile') { await p.evaluate(() => scrollTo(0, 0)); await sleep(1200); await p.screenshot({ path: `${OUT}/mobile-fullpage.png`, fullPage: true }); }
  await b.close();
}
srv?.close();
console.log('v2 screens written');
