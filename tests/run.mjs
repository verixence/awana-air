// AWANA AIR test suite (v3: persistent fixed 3D canvas): iPhone 14 / iPhone 15 Pro (WebKit), Pixel 7 (Chromium), desktop Chromium + WebKit.
// Layout-integrity checks at every scroll step (heading overlap, header occlusion, lingering transforms),
// fast fling, mobile menu, reduced motion, no-WebGL, plus form, links, SEO, axe, overflow and credit.
import { chromium, webkit, devices } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './server.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE = process.env.BASE_URL || null;
const SHOTS = process.env.SHOTS !== '0';
const { srv, url: local } = BASE ? { srv: null, url: null } : await serve(ROOT);
const URL0 = BASE || local;
const STEPDIR = path.join(ROOT, 'screens/v3/steps');
fs.mkdirSync(STEPDIR, { recursive: true });
const results = []; let failed = 0;
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info: String(info).slice(0, 600) }); if (!cond) { failed++; console.log('  FAIL', name, String(info).slice(0, 600)); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GLARGS = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };

const TARGETS = [
  { id: 'iphone14', type: webkit, opts: devices['iPhone 14'], mobile: true },
  { id: 'iphone15pro', type: webkit, opts: devices['iPhone 15 Pro'], mobile: true },
  { id: 'pixel7', type: chromium, opts: devices['Pixel 7'], mobile: true },
  { id: 'desktop-chromium', type: chromium, opts: { viewport: { width: 1440, height: 900 } }, mobile: false },
  { id: 'desktop-webkit', type: webkit, opts: { viewport: { width: 1440, height: 900 } }, mobile: false },
];
if (process.env.ONLY) TARGETS.splice(0, TARGETS.length, ...TARGETS.filter((t) => process.env.ONLY.split(',').includes(t.id)));
const SOCIAL = ['https://whatsapp.com/channel/0029Vb90dLhJJhzhRk4PIx06', 'https://www.instagram.com/awana_air', 'https://www.facebook.com/share/19qmNAzfaX/'];

// In-page layout probe: visible headings must not intersect each other; any heading under the fixed
// header must be fully hidden by it (opaque header on top), never drawn over/through it.
const PROBE = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= innerHeight) return null;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return null;
    }
    return r;
  };
  const header = document.querySelector('.site-header');
  const hr = header.getBoundingClientRect();
  const hbg = getComputedStyle(header).backgroundColor;
  const alpha = /rgba?\(([^)]+)\)/.exec(hbg); const a = alpha ? (alpha[1].split(',')[3] === undefined ? 1 : +alpha[1].split(',')[3]) : 0;
  const els = [...document.querySelectorAll('main h1, main h2, main h3, main .eyebrow')].filter((e) => !e.closest('.menu'));
  const boxes = els.map((e) => ({ e, r: vis(e) })).filter((x) => x.r);
  const name = (e) => (e.id || e.className || e.tagName) + ':' + e.textContent.trim().slice(0, 24);
  const inter = (p, q) => Math.max(0, Math.min(p.right, q.right) - Math.max(p.left, q.left)) * Math.max(0, Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top));
  const overlaps = [], headerHits = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (boxes[i].e.contains(boxes[j].e) || boxes[j].e.contains(boxes[i].e)) continue;
    if (inter(boxes[i].r, boxes[j].r) > 1) overlaps.push(name(boxes[i].e) + ' X ' + name(boxes[j].e));
  }
  for (const { e, r } of boxes) {
    if (inter(r, hr) > 1) {
      const x = Math.max(r.left, hr.left) + 2, y = (Math.max(r.top, hr.top) + Math.min(r.bottom, hr.bottom)) / 2;
      const top = document.elementFromPoint(Math.min(x, innerWidth - 1), y);
      const covered = a >= 0.99 && top && top.closest('.site-header');
      if (!covered) headerHits.push(name(e) + ` (header bg ${hbg})`);
    }
  }
  const menu = document.getElementById('menu');
  return { overlaps, headerHits, menuHidden: menu.hidden, y: Math.round(scrollY), n: boxes.length };
};
const TRANSFORMS = () => {
  const bad = [];
  document.querySelectorAll('main *, footer *, .site-header, .mobile-bar, .wa-bubble *').forEach((el) => {
    if (el.closest('canvas') || el.tagName === 'CANVAS' || el.closest('.sky')) return;
    const t = getComputedStyle(el).transform;
    if (t && t !== 'none') bad.push((el.className || el.tagName) + ' ' + t);
  });
  const hiddenReveal = [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity !== '1').map((e) => e.className || e.tagName);
  return { bad, hiddenReveal };
};

// Jet readability: the jet's projected footprint (from the scene) must not cover any paragraph or heading
// unless it is faded to <= 0.25 opacity.
const JETCHECK = () => {
  const s = window.__sky && window.__sky.state;
  if (!s || !document.documentElement.classList.contains('sky-live')) return { live: false };
  const b = s.bounds; if (!b) return { live: true, alpha: s.alpha, hits: [] };
  const range = document.createRange(); const hits = [];
  document.querySelectorAll('main p, main h1, main h2, main h3, footer p').forEach((el) => {
    range.selectNodeContents(el); const r = range.getBoundingClientRect();
    if (r.width < 1 || r.bottom < 0 || r.top > innerHeight) return;
    if (r.right > b.x0 && r.left < b.x1 && r.bottom > b.y0 && r.top < b.y1) hits.push(el.tagName + ':' + el.textContent.trim().slice(0, 20));
  });
  return { live: true, alpha: s.alpha, bounds: b, hits };
};
async function stepScroll(page, tag, shots) {
  const issues = [], jet = { steps: 0, live: 0, visible: 0, faded: 0, bad: [] };
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  let i = 0;
  for (let y = 0; y <= H; y += 400, i++) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(380);
    const pr = await page.evaluate(PROBE);
    if (pr.overlaps.length || pr.headerHits.length) issues.push(`y=${pr.y}: ${pr.overlaps.concat(pr.headerHits).join(' | ')}`);
    const jc = await page.evaluate(JETCHECK); jet.steps++;
    if (jc.live) { jet.live++; if (jc.bounds && jc.alpha > 0.25) jet.visible++; if (jc.hits && jc.hits.length) { if (jc.alpha <= 0.25) jet.faded++; else jet.bad.push(`y=${pr.y} a=${jc.alpha.toFixed(2)} ${jc.hits.join(',')}`); } }
    if (shots) await page.screenshot({ path: path.join(STEPDIR, `${tag}-${String(i).padStart(2, '0')}.png`) });
  }
  return { issues, jet };
}
async function fling(page, mobile) {
  if (mobile) {
    await page.evaluate(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y <= H; y += 1400) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 25)); } for (let y = H; y >= 0; y -= 2200) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 20)); } scrollTo(0, 1800); });
  } else {
    await page.mouse.move(700, 450);
    for (let k = 0; k < 14; k++) { await page.mouse.wheel(0, 1200); await sleep(25); }
    for (let k = 0; k < 8; k++) { await page.mouse.wheel(0, -1500); await sleep(25); }
  }
  await sleep(1600);
  const pr = await page.evaluate(PROBE);
  return pr.overlaps.concat(pr.headerHits);
}

for (const T of TARGETS) {
  const browser = await T.type.launch(T.type === chromium ? GLARGS : {});
  for (const mode of ['default', 'force3d', 'reduced']) {
    const tag = `${T.id}/${mode}`;
    console.log('>>', tag);
    const ctx = await browser.newContext({ ...T.opts, reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
    await ctx.route(/^https:\/\/(wa\.me|whatsapp\.com|www\.instagram\.com|www\.facebook\.com|amersphere\.com)\//, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', (r) => { if (r.url().startsWith(URL0)) errors.push('requestfailed: ' + r.url()); });
    const t0 = Date.now();
    const resp = await page.goto(URL0 + '/' + (mode === 'force3d' ? '?3d=force' : ''), { waitUntil: 'load' });
    ok(`${tag} HTTP 200`, resp.status() === 200, resp.status());

    const cls = await page.evaluate(() => document.documentElement.className);
    if (mode === 'force3d') {
      const ready = await page.waitForFunction(() => document.documentElement.classList.contains('sky-live') && window.__sky, null, { timeout: 25000 }).then(() => true).catch(() => false);
      const tReady = Date.now() - t0;
      const dpr = await page.evaluate(() => { const c = document.querySelector('#sky canvas'); return c ? c.width / c.clientWidth : null; });
      ok(`${tag} site-wide 3D jet live without interaction (${tReady} ms on software GL)`, ready && /\bgl\b/.test(cls), cls);
      ok(`${tag} DPR capped (<=1.5)`, dpr !== null && dpr <= 1.51, dpr);
      const one = await page.evaluate(() => document.querySelectorAll('canvas').length);
      ok(`${tag} a single WebGL canvas on the page`, one === 1, one);
    } else if (mode === 'default') {
      // the box has no GPU: the head probe must pick the static render, never a blank hero
      const st = await page.evaluate(() => { const s = document.querySelector('.hero-still'); return { cls: document.documentElement.className, disp: getComputedStyle(s).display, bg: getComputedStyle(s).backgroundImage }; });
      ok(`${tag} no-GPU device gets the static jet render`, /nogl/.test(st.cls) ? st.disp === 'block' && /hero-still(-mobile)?\.webp/.test(st.bg) : true, JSON.stringify(st));
    } else {
      const st = await page.evaluate(() => ({ cls: document.documentElement.className, still: getComputedStyle(document.querySelector('.hero-still')).display, canvas: !!document.querySelector('canvas') }));
      ok(`${tag} reduced motion: no motion/lenis/WebGL, static render shown`, !/motion|lenis|\bgl\b/.test(st.cls.replace('nogl', '')) && st.still === 'block' && !st.canvas, JSON.stringify(st));
    }
    ok(`${tag} Lenis ${T.mobile ? 'off on touch' : 'only on desktop'}`, T.mobile ? !/lenis/.test(cls) : mode === 'reduced' ? !/lenis/.test(cls) : /lenis/.test(cls), cls);

    // contact affordances
    const ca = await page.evaluate(() => ({
      bubble: getComputedStyle(document.querySelector('.wa-bubble')).display !== 'none',
      bar: getComputedStyle(document.querySelector('.mobile-bar')).display !== 'none',
      heroCtas: document.querySelectorAll('.hero-content a, .hero-content button').length,
    }));
    ok(`${tag} one contact affordance (${T.mobile ? 'bar only' : 'bubble only'})`, T.mobile ? ca.bar && !ca.bubble : ca.bubble && !ca.bar, JSON.stringify(ca));
    ok(`${tag} hero has at most 2 CTAs`, ca.heroCtas <= 2, ca.heroCtas);

    // step scroll: overlap + header occlusion at every 400px step
    await sleep(1200);
    const { issues, jet } = await stepScroll(page, `${T.id}-${mode}`, SHOTS && mode !== 'reduced');
    ok(`${tag} step-scroll: no heading overlaps / no heading drawn over the header`, issues.length === 0, issues.join(' || '));
    ok(`${tag} jet never covers body text at full opacity (steps ${jet.steps}, live ${jet.live}, jet visible ${jet.visible}, faded over text ${jet.faded})`, jet.bad.length === 0, jet.bad.join(' || '));
    if (mode === 'force3d') ok(`${tag} jet actually flies through the page (visible at ${jet.visible} of ${jet.steps} steps)`, jet.live === jet.steps && jet.visible >= (T.mobile ? 1 : 3), JSON.stringify({ ...jet, bad: jet.bad.length }));
    // fixed canvas: below the content, never hit-testable; every CTA receives the click
    const hit = await page.evaluate(async () => {
      const sky = document.getElementById('sky'); const cs = getComputedStyle(sky);
      const cv = sky.querySelector('canvas');
      const info = { pos: cs.position, z: cs.zIndex, pe: cs.pointerEvents, cpe: cv ? getComputedStyle(cv).pointerEvents : 'n/a', first: sky.compareDocumentPosition(document.getElementById('main')) & Node.DOCUMENT_POSITION_FOLLOWING ? 'before-main' : 'after-main', misses: [], n: 0 };
      const sel = '.hero-ctas a, .header-actions a, .cta-actions a, .contact-list a, #partner-form button[type=submit], .socials a, .credit a, .footer-col a, .mobile-bar a, .wa-bubble a, .nav-desktop a';
      for (const el of document.querySelectorAll(sel)) {
        let r = el.getBoundingClientRect(); if (r.width < 1 || getComputedStyle(el).visibility === 'hidden') continue;
        const fixed = el.closest('.site-header, .mobile-bar, .wa-bubble');
        if (!fixed) { scrollTo({ top: r.top + scrollY - innerHeight / 2 + r.height / 2, behavior: 'instant' }); await new Promise((q) => setTimeout(q, 80)); }
        r = el.getClientRects()[0] || el.getBoundingClientRect();   // first line box (links can wrap)
        const x = r.left + r.width / 2, y = r.top + r.height / 2; info.n++;
        const top = document.elementFromPoint(x, y);
        if (!(top === el || el.contains(top))) info.misses.push((el.textContent || el.getAttribute('aria-label') || el.className).trim().slice(0, 24) + ' -> ' + (top ? top.tagName + '.' + top.className : 'null'));
      }
      return info;
    });
    ok(`${tag} fixed 3D layer: position fixed, z-index < 0, pointer-events none, before content`, hit.pos === 'fixed' && +hit.z < 0 && hit.pe === 'none' && hit.cpe !== 'auto' && hit.first === 'before-main', JSON.stringify(hit));
    ok(`${tag} every CTA/link is hit-testable at its centre (${hit.n} checked)`, hit.misses.length === 0 && hit.n >= 10, hit.misses.join(' | '));
    const tr = await page.evaluate(TRANSFORMS);
    ok(`${tag} no lingering transforms after reveal`, tr.bad.length === 0, tr.bad.join(' | '));
    ok(`${tag} all revealed content fully visible`, tr.hiddenReveal.length === 0, tr.hiddenReveal.join(','));
    const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    ok(`${tag} no horizontal overflow`, ov.sw <= ov.iw, JSON.stringify(ov));

    // fast fling
    await page.evaluate(() => scrollTo(0, 0)); await sleep(300);
    const fl = await fling(page, T.mobile);
    const tr2 = await page.evaluate(TRANSFORMS);
    ok(`${tag} after fast fling: no overlaps, no lingering transforms`, fl.length === 0 && tr2.bad.length === 0 && tr2.hiddenReveal.length === 0, fl.concat(tr2.bad, tr2.hiddenReveal).join(' | '));

    // mobile menu opened mid-page (the original iOS bug)
    if (T.mobile) {
      await page.evaluate(() => document.getElementById('services').scrollIntoView()); await sleep(700);
      await page.tap('.menu-btn');
      await sleep(300);
      const m = await page.evaluate(() => {
        const menu = document.getElementById('menu'); const r = menu.getBoundingClientRect();
        const pts = [[innerWidth / 2, innerHeight / 2], [20, innerHeight * 0.3], [innerWidth - 20, innerHeight * 0.75]];
        const onTop = pts.every(([x, y]) => { const el = document.elementFromPoint(x, y); return el && (el.closest('#menu') || el.closest('.site-header') || el.closest('.mobile-bar')); });
        return { hidden: menu.hidden, top: r.top, h: Math.round(r.height), vh: innerHeight, w: Math.round(r.width), vw: innerWidth, onTop, inHeader: !!menu.closest('.site-header') };
      });
      ok(`${tag} menu opened mid-page covers the full viewport`, !m.hidden && m.top === 0 && Math.abs(m.h - m.vh) <= 1 && m.w === m.vw && m.onTop && !m.inHeader, JSON.stringify(m));
      if (SHOTS && mode === 'default') await page.screenshot({ path: path.join(ROOT, `screens/v3/${T.id === 'pixel7' ? 'android' : T.id === 'iphone14' ? 'mobile' : T.id}-menu.png`) });
      await page.keyboard.press('Escape'); await sleep(200);
      ok(`${tag} menu closes with Escape`, await page.evaluate(() => document.getElementById('menu').hidden));
    }

    if (mode === 'default') {
      // SEO
      const seo = await page.evaluate(() => {
        const m = (s) => document.querySelector(s)?.getAttribute('content') || document.querySelector(s)?.getAttribute('href');
        let ld = null; try { ld = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent); } catch {}
        return { title: document.title, desc: m('meta[name=description]'), canon: m('link[rel=canonical]'), og: m('meta[property="og:image"]'), tw: m('meta[name="twitter:card"]'), icon: m('link[rel=icon]'), ld };
      });
      ok(`${tag} title + meta/og/twitter/canonical/icon`, /AWANA AIR/.test(seo.title) && seo.desc && seo.canon && seo.og && seo.tw === 'summary_large_image' && seo.icon);
      ok(`${tag} JSON-LD Organization (telephone + sameAs)`, seo.ld && seo.ld['@type'] === 'Organization' && seo.ld.telephone === '+91-95403-60060' && SOCIAL.every((u) => seo.ld.sameAs.includes(u)));
      // links
      const links = await page.$$eval('a', (as) => as.map((a) => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel })));
      const ext = links.filter((l) => /^https?:/.test(l.href));
      ok(`${tag} external links: new tab + noopener`, ext.every((l) => l.target === '_blank' && /noopener/.test(l.rel)));
      const tel = links.filter((l) => l.href?.startsWith('tel:'));
      ok(`${tag} tel links`, tel.length >= 3 && tel.every((l) => l.href === 'tel:+919540360060'));
      const wa = links.filter((l) => l.href?.includes('wa.me'));
      ok(`${tag} wa.me links`, wa.length >= 3 && wa.every((l) => l.href.startsWith('https://wa.me/919540360060')));
      for (const u of SOCIAL) ok(`${tag} social ${u}`, links.some((l) => l.href === u && l.target === '_blank' && /noopener/.test(l.rel)));
      const missing = await page.evaluate((ids) => ids.filter((id) => id !== '#' && !document.querySelector(id)), [...new Set(links.filter((l) => l.href?.startsWith('#')).map((l) => l.href))]);
      ok(`${tag} in-page anchors resolve`, missing.length === 0, missing.join(','));
      const credit = await page.evaluate(() => { const p = document.querySelector('.footer-bottom .credit'); const a = p?.querySelector('a'); return p && a && { text: p.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), linkText: a.textContent.trim() }; });
      ok(`${tag} footer credit "Powered by Amersphere.com"`, credit && credit.text === 'Powered by Amersphere.com' && credit.linkText === 'Amersphere.com' && credit.href === 'https://amersphere.com' && credit.target === '_blank' && /\bnoopener\b/.test(credit.rel), JSON.stringify(credit));
      // form
      await page.locator('#partner-form').scrollIntoViewIfNeeded(); await sleep(900);
      let popups = 0; const onPopup = () => popups++; ctx.on('page', onPopup);
      await page.click('#partner-form button[type=submit]'); await sleep(300);
      const inv = await page.$$eval('#partner-form [aria-invalid=true]', (e) => e.map((x) => x.name));
      ok(`${tag} empty form blocked (6 errors, no WhatsApp)`, inv.length === 6 && popups === 0, inv.join(','));
      await page.fill('#f-name', 'Asha Rao'); await page.fill('#f-business', 'Skyline Tours & Travels'); await page.selectOption('#f-type', 'Tour & travel agency');
      await page.fill('#f-city', 'Jaipur'); await page.fill('#f-phone', '12ab'); await page.selectOption('#f-service', 'Helicopter Charters');
      await page.fill('#f-message', 'Group of 6 for a wedding, 3 days.');
      await page.click('#partner-form button[type=submit]'); await sleep(300);
      ok(`${tag} invalid phone blocked`, (await page.getAttribute('#f-phone', 'aria-invalid')) === 'true' && popups === 0);
      await page.fill('#f-phone', '+91 98765 43210'); ctx.off('page', onPopup);
      const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }), page.click('#partner-form button[type=submit]')]);
      const pu = new URL(popup.url());
      const expected = "Hello AWANA AIR, I'd like to become a partner.\n\nName: Asha Rao\nBusiness name: Skyline Tours & Travels\nBusiness type: Tour & travel agency\nCity: Jaipur\nPhone: +91 98765 43210\nService of interest: Helicopter Charters\nMessage: Group of 6 for a wedding, 3 days.";
      ok(`${tag} form opens wa.me/919540360060 with exact prefilled text`, pu.origin === 'https://wa.me' && pu.pathname === '/919540360060' && pu.searchParams.get('text') === expected, popup.url());
      await popup.close();
    }
    // axe in every mode
    await page.evaluate(() => scrollTo(0, 0)); await sleep(400);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
    ok(`${tag} axe: 0 violations`, axe.violations.length === 0, axe.violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`).join('; '));
    ok(`${tag} no console errors`, errors.length === 0, errors.join(' || '));
    await ctx.close();
  }
  // no-WebGL fallback
  const nctx = await browser.newContext(T.opts);
  await nctx.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; });
  const np = await nctx.newPage(); const nerr = []; np.on('pageerror', (e) => nerr.push(e.message));
  await np.goto(URL0 + '/'); await sleep(1500);
  await np.evaluate(() => document.getElementById('network').scrollIntoView()); await sleep(1200);
  const ns = await np.evaluate(() => ({ cls: document.documentElement.className, hero: getComputedStyle(document.querySelector('.hero-still')).display, globe: getComputedStyle(document.querySelector('.globe-still')).display, canvases: document.querySelectorAll('canvas').length }));
  ok(`${T.id} no-WebGL: static jet + globe renders, no canvas, no errors`, /nogl/.test(ns.cls) && ns.hero === 'block' && ns.globe === 'block' && ns.canvases === 0 && nerr.length === 0, JSON.stringify(ns) + nerr.join('|'));
  await nctx.close();
  if (T.id === 'desktop-chromium' || T.id === 'iphone14') {
    const p = await browser.newPage();
    const r404 = await p.goto(URL0 + '/no-such-page');
    ok(`${T.id} 404 page`, r404.status() === 404);
    for (const f of ['robots.txt', 'sitemap.xml', 'favicon.svg', 'og-image.jpg', 'site.webmanifest', 'assets/img/hero-still.webp', 'assets/img/globe-still.webp', 'assets/img/hero-still-mobile.webp', 'assets/models/bizjet-lod0.glb', 'assets/models/bizjet-lod1.glb', 'assets/env/golden-hour-1k.jpg', 'assets/vendor/basis/basis_transcoder.js', 'assets/vendor/basis/basis_transcoder.wasm', 'CREDITS.md']) { const rr = await p.request.get(URL0 + '/' + f); ok(`${T.id} /${f} 200`, rr.status() === 200); }
    await p.close();
  }
  await browser.close();
}
srv?.close();
fs.writeFileSync(path.join(ROOT, 'tests/results.json'), JSON.stringify({ url: URL0, date: new Date().toISOString(), passed: results.length - failed, failed, results }, null, 2));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
