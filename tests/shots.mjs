// Screenshots for the deliverables: screens/{desktop,mobile}-{hero,services,audience,partner,globe,process,cta,form,footer}.png
import { chromium } from 'playwright';
import path from 'node:path';
import { serve } from './server.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE = process.env.BASE_URL;
const { srv, url } = BASE ? { url: BASE } : await serve(ROOT);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const prefix = process.env.PREFIX || '';
for (const [n, o] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const ctx = await b.newContext(o); const p = await ctx.newPage();
  await p.goto(url + '/'); await p.mouse.move(400, 300).catch(() => {});
  await p.evaluate(() => window.dispatchEvent(new Event('scroll')));
  await p.waitForFunction(() => document.querySelector('#hero-canvas').classList.contains('ready'), null, { timeout: 25000 }).catch(() => console.log('hero not ready'));
  await sleep(2500);
  await p.screenshot({ path: `${ROOT}/screens/${prefix}${n}-hero.png` });
  // reveal everything
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } });
  const shot = async (sel, name, extra = 0) => {
    await p.evaluate(([s, e]) => { const el = document.querySelector(s); scrollTo(0, el.getBoundingClientRect().top + scrollY - 70 + e); }, [sel, extra]);
    await sleep(2200); await p.screenshot({ path: `${ROOT}/screens/${prefix}${n}-${name}.png` });
  };
  await shot('#services', 'services');
  await shot('#partners', 'audience');
  await shot('#why', 'partner');
  await shot('#network', 'globe', n === 'mobile' ? 240 : 0);
  await shot('#process', 'process');
  await shot('.cta-band', 'cta');
  await p.fill('#f-name', 'Asha Rao'); await p.fill('#f-business', 'Skyline Tours & Travels'); await p.selectOption('#f-type', 'Tour & travel agency');
  await p.fill('#f-city', 'Jaipur'); await p.selectOption('#f-service', 'Helicopter Charters');
  await p.click('#partner-form button[type=submit]'); // phone left empty to show validation
  await shot('#partner-form', 'form', n === 'mobile' ? 0 : -120);
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await sleep(1800);
  await p.screenshot({ path: `${ROOT}/screens/${prefix}${n}-footer.png` });
  await ctx.close();
}
await b.close(); srv?.close();
console.log('screens written');
