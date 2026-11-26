// Playwright test suite: Chromium + WebKit, desktop + mobile.
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './server.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE = process.env.BASE_URL || null;
const { srv, url: local } = BASE ? { srv: null, url: null } : await serve(ROOT);
const URL0 = BASE || local;
const results = []; let failed = 0;
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); if (!cond) { failed++; console.log('  FAIL', name, info); } };

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const EXPECT_LINKS = {
  'https://whatsapp.com/channel/0029Vb90dLhJJhzhRk4PIx06': 'WhatsApp channel',
  'https://www.instagram.com/awana_air': 'Instagram',
  'https://www.facebook.com/share/19qmNAzfaX/': 'Facebook',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y <= h; y += Math.round(innerHeight * 0.6)) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 160)); }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 1500));
  });
}

for (const [bname, btype] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await btype.launch(bname === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});
  for (const [vname, vopts] of Object.entries(VIEWPORTS)) {
    const tag = `${bname}/${vname}`;
    console.log('>>', tag);
    const ctx = await browser.newContext(vopts);
    await ctx.route(/^https:\/\/(wa\.me|whatsapp\.com|www\.instagram\.com|www\.facebook\.com|amersphere\.com)\//, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', (r) => { if (r.url().startsWith(URL0)) errors.push('requestfailed: ' + r.url()); });

    const resp = await page.goto(URL0 + '/', { waitUntil: 'load' });
    ok(`${tag} status 200`, resp.status() === 200, resp.status());
    await sleep(3500);
    await scrollThrough(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => document.querySelector('#hero-canvas').classList.contains('ready'), null, { timeout: 20000 }).catch(() => {});

    // 3D state
    const st = await page.evaluate(() => ({
      motion: document.documentElement.classList.contains('motion'),
      heroCanvas: !!document.querySelector('#hero-canvas canvas'), heroReady: document.querySelector('#hero-canvas').classList.contains('ready'),
      globeReady: document.getElementById('globe').classList.contains('ready'),
      dpr: (() => { const c = document.querySelector('#hero-canvas canvas'); return c ? c.width / c.clientWidth : null; })(),
    }));
    ok(`${tag} motion class`, st.motion);
    ok(`${tag} hero 3D rendered`, st.heroCanvas && st.heroReady, JSON.stringify(st));
    ok(`${tag} globe rendered`, st.globeReady);
    ok(`${tag} DPR capped at 1.5`, st.dpr === null || st.dpr <= 1.51, st.dpr);

    // overflow
    const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    ok(`${tag} no horizontal overflow`, ov.sw <= ov.iw, JSON.stringify(ov));

    // SEO
    const seo = await page.evaluate(() => {
      const m = (s) => document.querySelector(s)?.getAttribute('content') || document.querySelector(s)?.getAttribute('href');
      let ld = null; try { ld = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent); } catch {}
      return { title: document.title, desc: m('meta[name=description]'), canon: m('link[rel=canonical]'), og: m('meta[property="og:image"]'), tw: m('meta[name="twitter:card"]'), icon: m('link[rel=icon]'), ld };
    });
    ok(`${tag} title`, /AWANA AIR/.test(seo.title) && /Flying Beyond The Boundaries/.test(seo.title));
    ok(`${tag} meta/og/twitter/canonical/icon`, seo.desc && seo.canon && seo.og && seo.tw === 'summary_large_image' && seo.icon);
    ok(`${tag} JSON-LD Organization`, seo.ld && seo.ld['@type'] === 'Organization' && seo.ld.telephone === '+91-95403-60060' && Object.keys(EXPECT_LINKS).every((u) => seo.ld.sameAs.includes(u)));

    // links
    const links = await page.$$eval('a', (as) => as.map((a) => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel, text: a.textContent.trim(), label: a.getAttribute('aria-label') })));
    const ext = links.filter((l) => /^https?:/.test(l.href));
    ok(`${tag} external links open new tab with noopener`, ext.every((l) => l.target === '_blank' && /noopener/.test(l.rel)), JSON.stringify(ext.filter((l) => !(l.target === '_blank' && /noopener/.test(l.rel)))));
    ok(`${tag} tel links`, links.filter((l) => l.href?.startsWith('tel:')).every((l) => l.href === 'tel:+919540360060') && links.filter((l) => l.href?.startsWith('tel:')).length >= 3);
    ok(`${tag} wa.me links`, links.filter((l) => l.href?.includes('wa.me')).every((l) => l.href.startsWith('https://wa.me/919540360060')) && links.filter((l) => l.href?.includes('wa.me')).length >= 4);
    for (const u of Object.keys(EXPECT_LINKS)) ok(`${tag} social ${EXPECT_LINKS[u]}`, links.some((l) => l.href === u && l.target === '_blank' && /noopener/.test(l.rel)));
    const anchors = links.filter((l) => l.href?.startsWith('#')).map((l) => l.href);
    const missing = await page.evaluate((ids) => ids.filter((id) => id !== '#' && !document.querySelector(id)), [...new Set(anchors)]);
    ok(`${tag} in-page anchors resolve`, missing.length === 0, missing.join(','));
    const credit = await page.evaluate(() => { const p = document.querySelector('.footer-bottom .credit'); const a = p?.querySelector('a'); return p && a && { text: p.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), linkText: a.textContent.trim() }; });
    ok(`${tag} footer credit "Powered by Amersphere.com"`, credit && credit.text === 'Powered by Amersphere.com' && credit.linkText === 'Amersphere.com' && credit.href === 'https://amersphere.com' && credit.target === '_blank' && /\bnoopener\b/.test(credit.rel), JSON.stringify(credit));

    // floating WA + mobile bar
    const fixed = await page.evaluate(() => ({ wa: getComputedStyle(document.querySelector('.wa-float')).position, bar: getComputedStyle(document.querySelector('.mobile-bar')).display }));
    ok(`${tag} floating WhatsApp button`, fixed.wa === 'fixed');
    ok(`${tag} mobile bar ${vname === 'mobile' ? 'shown' : 'hidden'}`, vname === 'mobile' ? fixed.bar !== 'none' : fixed.bar === 'none');

    // form validation
    await page.locator('#partner').scrollIntoViewIfNeeded(); await sleep(800);
    let popups = 0; const onPopup = () => popups++; ctx.on('page', onPopup);
    await page.click('#partner-form button[type=submit]'); await sleep(400);
    const inv = await page.$$eval('#partner-form [aria-invalid=true]', (e) => e.map((x) => x.name));
    ok(`${tag} empty form blocked with 6 errors`, inv.length === 6 && popups === 0, inv.join(','));
    await page.fill('#f-name', 'Asha Rao'); await page.fill('#f-business', 'Skyline Tours & Travels'); await page.selectOption('#f-type', 'Tour & travel agency');
    await page.fill('#f-city', 'Jaipur'); await page.fill('#f-phone', '12ab'); await page.selectOption('#f-service', 'Helicopter Charters');
    await page.fill('#f-message', 'Group of 6 for a wedding, 3 days.');
    await page.click('#partner-form button[type=submit]'); await sleep(300);
    ok(`${tag} invalid phone blocked`, (await page.getAttribute('#f-phone', 'aria-invalid')) === 'true' && popups === 0);
    await page.fill('#f-phone', '+91 98765 43210');
    ctx.off('page', onPopup);
    const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }), page.click('#partner-form button[type=submit]')]);
    const pu = new URL(popup.url());
    const expected = "Hello AWANA AIR, I'd like to become a partner.\n\nName: Asha Rao\nBusiness name: Skyline Tours & Travels\nBusiness type: Tour & travel agency\nCity: Jaipur\nPhone: +91 98765 43210\nService of interest: Helicopter Charters\nMessage: Group of 6 for a wedding, 3 days.";
    ok(`${tag} form opens wa.me/919540360060`, pu.origin === 'https://wa.me' && pu.pathname === '/919540360060', popup.url());
    ok(`${tag} form text prefilled exactly`, pu.searchParams.get('text') === expected, JSON.stringify(pu.searchParams.get('text')));
    await popup.close();

    // axe
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(500);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
    ok(`${tag} axe: 0 violations`, axe.violations.length === 0, axe.violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`).join('; '));

    ok(`${tag} no console errors`, errors.length === 0, errors.join(' || '));
    await ctx.close();

    // reduced motion
    const rctx = await browser.newContext({ ...vopts, reducedMotion: 'reduce' });
    const rp = await rctx.newPage(); const rerr = [];
    rp.on('pageerror', (e) => rerr.push(e.message)); rp.on('console', (m) => m.type() === 'error' && rerr.push(m.text()));
    await rp.goto(URL0 + '/'); await sleep(2500); await scrollThrough(rp);
    const rs = await rp.evaluate(() => ({
      motion: document.documentElement.classList.contains('motion'), lenis: document.documentElement.classList.contains('lenis'),
      heroCanvas: !!document.querySelector('#hero-canvas canvas'), fallback: getComputedStyle(document.querySelector('.hero-fallback')).opacity,
      hidden: [...document.querySelectorAll('.reveal-up,.reveal-left,.reveal-card')].filter((e) => getComputedStyle(e).opacity !== '1').length,
      marquee: getComputedStyle(document.querySelector('.marquee-track')).animationName,
    }));
    ok(`${tag} reduced motion: no motion/lenis, no hero WebGL, static fallback, content visible, no marquee`, !rs.motion && !rs.lenis && !rs.heroCanvas && rs.fallback === '1' && rs.hidden === 0 && rs.marquee === 'none', JSON.stringify(rs));
    const raxe = await new AxeBuilder({ page: rp }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    ok(`${tag} reduced motion axe: 0 violations`, raxe.violations.length === 0, raxe.violations.map((v) => v.id).join(','));
    ok(`${tag} reduced motion no console errors`, rerr.length === 0, rerr.join(' || '));
    await rctx.close();

    // no-WebGL fallback
    const nctx = await browser.newContext(vopts);
    await nctx.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; });
    const np = await nctx.newPage(); const nerr = []; np.on('pageerror', (e) => nerr.push(e.message));
    await np.goto(URL0 + '/'); await sleep(4000); await scrollThrough(np);
    const ns = await np.evaluate(() => ({ hero: !!document.querySelector('#hero-canvas canvas'), globe: !!document.querySelector('#globe canvas'), fb: getComputedStyle(document.querySelector('.hero-fallback')).opacity, gfb: getComputedStyle(document.querySelector('.globe-fallback')).opacity }));
    ok(`${tag} no-WebGL: static hero + globe fallbacks, no errors`, !ns.hero && !ns.globe && ns.fb === '1' && ns.gfb === '1' && nerr.length === 0, JSON.stringify(ns) + nerr.join('|'));
    await nctx.close();
  }
  // 404 + static files (once per browser)
  const p = await browser.newPage();
  const r404 = await p.goto(URL0 + '/no-such-page');
  ok(`${bname} 404 page`, r404.status() === 404 && /flown off course/.test(await p.textContent('h1')));
  for (const f of ['robots.txt', 'sitemap.xml', 'favicon.svg', 'og-image.jpg', 'site.webmanifest', 'icon-512.png']) { const rr = await p.goto(URL0 + '/' + f); ok(`${bname} /${f} 200`, rr.status() === 200); }
  await browser.close();
}
srv?.close();
fs.writeFileSync(path.join(ROOT, 'tests/results.json'), JSON.stringify({ url: URL0, date: new Date().toISOString(), passed: results.length - failed, failed, results }, null, 2));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
