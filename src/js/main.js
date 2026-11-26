import Lenis from 'lenis';

const WA_NUMBER = '919540360060';
const root = document.documentElement;
const motion = root.classList.contains('motion');
const gl = root.classList.contains('gl');
const touch = matchMedia('(hover: none), (pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const narrow = () => matchMedia('(max-width: 760px)').matches;
const params = new URLSearchParams(location.search);

// ---------- header + menu (menu is a sibling of the header, so it always covers the viewport) ----------
const header = document.querySelector('.site-header');
let heroProgress = 0;
const hero = document.querySelector('.hero');
function onScroll() {
  header.classList.toggle('scrolled', scrollY > 24);
  const h = hero.offsetHeight || 1;
  heroProgress = Math.min(1, Math.max(0, scrollY / h));
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const menuBtn = document.querySelector('.menu-btn');
const menu = document.getElementById('menu');
function setMenu(open) {
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Open menu';
  menu.hidden = !open;
  document.body.classList.toggle('menu-open', open);
  header.classList.toggle('scrolled', open || scrollY > 24);
  if (lenis) open ? lenis.stop() : lenis.start();
}
menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
matchMedia('(max-width: 760px)').addEventListener('change', (e) => { if (!e.matches) setMenu(false); });

// ---------- smooth scroll: desktop mouse/trackpad only, never on touch devices ----------
let lenis = null;
if (motion && !touch && !params.has('rec')) {
  lenis = new Lenis({ duration: 1.05, smoothWheel: true, syncTouch: false });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  root.classList.add('lenis');
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: id === '#top' ? 0 : -(header.offsetHeight + 12) });
    history.replaceState(null, '', id);
  });
}

// ---------- reveals: class toggle only; transitions resolve to transform:none ----------
const reveal = [...document.querySelectorAll('[data-reveal]')];
if (motion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  reveal.forEach((el) => {
    if (el.closest('.hero')) return;
    io.observe(el);
  });
  // hero: staggered entrance on load
  document.querySelectorAll('.hero [data-reveal]').forEach((el, i) => { el.style.transitionDelay = `${0.1 + i * 0.12}s`; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in'))); el.addEventListener('transitionend', () => { el.style.transitionDelay = ''; }, { once: true }); });
} else reveal.forEach((el) => el.classList.add('in'));
root.classList.add('ready');

// ---------- partner form -> WhatsApp ----------
const form = document.getElementById('partner-form');
const status = document.getElementById('form-status');
const rules = {
  name: (v) => (v.length >= 2 ? '' : 'Please enter your name.'),
  business: (v) => (v.length >= 2 ? '' : 'Please enter your business name.'),
  type: (v) => (v ? '' : 'Please choose your business type.'),
  city: (v) => (v.length >= 2 ? '' : 'Please enter your city.'),
  phone: (v) => { const d = v.replace(/\D/g, ''); return /^[+\d][\d\s()-]*$/.test(v) && d.length >= 7 && d.length <= 15 ? '' : 'Please enter a valid phone number.'; },
  service: (v) => (v ? '' : 'Please choose a service.'),
};
function check(name) {
  const el = form.elements[name];
  const msg = rules[name](el.value.trim());
  el.closest('.field').classList.toggle('invalid', !!msg);
  el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  document.getElementById('e-' + name).textContent = msg;
  return !msg;
}
Object.keys(rules).forEach((n) => form.elements[n].addEventListener('blur', () => { if (form.elements[n].value || form.elements[n].getAttribute('aria-invalid')) check(n); }));
function buildWhatsAppUrl(d) {
  const lines = ["Hello AWANA AIR, I'd like to become a partner.", '', `Name: ${d.name}`, `Business name: ${d.business}`, `Business type: ${d.type}`, `City: ${d.city}`, `Phone: ${d.phone}`, `Service of interest: ${d.service}`];
  if (d.message) lines.push(`Message: ${d.message}`);
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
}
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const bad = Object.keys(rules).filter((n) => !check(n));
  if (bad.length) { status.classList.remove('ok'); status.textContent = 'Please fix the highlighted fields.'; form.elements[bad[0]].focus(); return; }
  const d = Object.fromEntries(['name', 'business', 'type', 'city', 'phone', 'service', 'message'].map((n) => [n, form.elements[n].value.trim()]));
  const url = buildWhatsAppUrl(d);
  form.dataset.waUrl = url;
  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
  status.classList.add('ok');
  status.innerHTML = 'Opening WhatsApp… If it did not open, <a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">tap here to send your enquiry</a>.';
});

// ---------- 3D (decided in <head>: html.gl = live WebGL, html.nogl = static renders) ----------
const idle = (fn, t) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: t }) : setTimeout(fn, 1));
const fallback = () => { root.classList.remove('gl'); root.classList.add('nogl'); };
const force = params.get('3d') === 'force';

// ---------- flight choreography: one keyframe per section, in screen terms ----------
// x, y: jet centre as a fraction of the viewport; w: jet width as a fraction of the viewport width;
// yaw: heading relative to the hero (0 = flying right, ~PI = flying left; +/- turns toward/away from the viewer).
const KEYS = {
  desktop: [
    ['.intro', { x: 0.86, y: 0.66, w: 0.15, yaw: 0.35 }],                 // descending out of the hero cloud deck
    ['#services', { x: 0.8, y: 0.24, w: 0.17, yaw: 2.85 }],              // banking across, beside the services heading
    ['#partners', { x: 0.84, y: 0.2, w: 0.12, yaw: 3.5 }],               // climbing away
    ['#why', { x: 0.2, y: 0.74, w: 0.17, yaw: 6.5 }],                    // sweeping back down the empty left column
    ['#network', { x: 0.52, y: 0.2, w: 0.11, yaw: 5.6 }],                // arcing over the globe
    ['#network', { x: 0.95, y: 0.62, w: 0.16, yaw: 7.0 }, 0.55],
    ['#process', { x: 0.82, y: 0.24, w: 0.15, yaw: 9.0 }],
    ['.cta-band', { x: 0.13, y: 0.5, w: 0.2, yaw: 6.6 }],                // flyby beside the CTA
    ['#partner', { x: 0.24, y: 0.86, w: 0.13, yaw: 6.4 }],
    ['#contact', { x: 0.86, y: 0.22, w: 0.12, yaw: 5.9 }],               // over the contact cards, in the right gutter
    ['END', { x: 0.7, y: 0.42, w: 0.09, yaw: 5.6 }],                     // graceful climb-out into the distance
  ],
  mobile: [
    ['.intro', { x: 0.8, y: 0.1, w: 0.34, yaw: 0.3 }],                    // climbs out of the hero above the text
    ['#services', { x: 0.8, y: 0.15, w: 0.3, yaw: 2.9 }],
    ['#partners', { x: 0.24, y: 0.86, w: 0.3, yaw: 6.5 }],
    ['#why', { x: 0.78, y: 0.14, w: 0.28, yaw: 9.0 }],
    ['#network', { x: 0.3, y: 0.15, w: 0.26, yaw: 12.0 }],
    ['#process', { x: 0.75, y: 0.86, w: 0.3, yaw: 9.5 }],
    ['.cta-band', { x: 0.5, y: 0.14, w: 0.36, yaw: 12.6 }],
    ['#partner', { x: 0.78, y: 0.12, w: 0.26, yaw: 15.5 }],
    ['#contact', { x: 0.8, y: 0.12, w: 0.24, yaw: 15.2 }],               // above the contact cards, clear of the mobile bar
    ['END', { x: 0.5, y: 0.4, w: 0.16, yaw: 12.2 }],
  ],
};
let sky3d = null, anchors = [], boundaries = [], textDoc = [];
const ease = (t) => t * t * (3 - 2 * t);
function heroZone() {                    // mobile: centre the jet in the free band between the header and the headline
  const hdr = header.offsetHeight, ey = document.querySelector('.hero .eyebrow').getBoundingClientRect().top + scrollY;
  const zoneH = Math.max(80, ey - hdr - 8), vh = innerHeight, vw = innerWidth;
  return { y: (hdr + 4 + zoneH / 2) / vh, w: Math.min(0.8, Math.max(0.55, (zoneH * 0.62) / 0.36 / vw)) };
}
function measure() {
  const mob = narrow(), vh = innerHeight, max = document.documentElement.scrollHeight - vh;
  const hero0 = sky3d.heroTrack(mob, mob ? heroZone() : null);
  anchors = [[0, hero0]];
  for (const [sel, k, frac = 0] of KEYS[mob ? 'mobile' : 'desktop']) {
    let y;
    if (sel === 'END') y = max;
    else { const el = document.querySelector(sel); y = el.getBoundingClientRect().top + scrollY - vh * 0.35 + el.offsetHeight * frac; }
    anchors.push([Math.min(max, Math.max(anchors[anchors.length - 1][0] + 1, y)), { sky: 0, cloud: 0, pitch: 0, ...k }]);
  }
  boundaries = mob ? [] : [...document.querySelectorAll('main > section')].slice(2).map((el) => el.getBoundingClientRect().top + scrollY);
  // text boxes (document coords) that the jet must never cover at full opacity
  const range = document.createRange();
  textDoc = [];
  document.querySelectorAll('main h1, main h2, main h3, main p, main li, main label, main .btn, main .link-arrow, main input, main select, main textarea, footer p, footer a, footer .footer-h').forEach((el) => {
    let r;
    if (/^(H1|H2|H3|P|LI|LABEL)$/.test(el.tagName)) { range.selectNodeContents(el); r = range.getBoundingClientRect(); } else r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) textDoc.push({ l: r.left, t: r.top + scrollY, r: r.right, b: r.bottom + scrollY });
  });
}
function track() {
  const y = scrollY, vh = innerHeight;
  let i = 0; while (i < anchors.length - 2 && y > anchors[i + 1][0]) i++;
  const [y0, a] = anchors[i], [y1, b] = anchors[Math.min(i + 1, anchors.length - 1)];
  const t = y1 > y0 ? ease(Math.min(1, Math.max(0, (y - y0) / (y1 - y0)))) : 0;
  const o = {}; for (const k of ['x', 'y', 'w', 'yaw', 'sky', 'cloud', 'pitch']) o[k] = a[k] + (b[k] - a[k]) * t;
  // wisps of cloud as the jet passes between sections (desktop)
  let bump = 0; for (const by of boundaries) { const d = (y + vh * 0.5 - by) / (vh * 0.14); bump = Math.max(bump, Math.exp(-d * d)); }
  o.cloud = Math.max(o.cloud, bump * 0.18);
  return o;
}
function textRects() {
  const y = scrollY, vh = innerHeight, out = [];
  for (const r of textDoc) if (r.b - y > -50 && r.t - y < vh + 50) out.push({ left: r.l, right: r.r, top: r.t - y, bottom: r.b - y });
  return out;
}

if (params.get('still')) {
  // build-time helper: renders the static fallback images (see tests/render-stills.mjs)
  const which = params.get('still');
  import(which === 'globe' ? './globe.js' : './sky3d.js').then(async (m) => { window.__still = await m.renderStill(+params.get('w') || 1600, +params.get('h') || 1000); });
} else if (gl) {
  const globeEl = document.getElementById('globe');
  const afterLoad = (fn) => (document.readyState === 'complete' ? fn() : addEventListener('load', fn, { once: true })); // let the still paint first
  afterLoad(() => idle(() => import('./sky3d.js').then(async (m) => {
    sky3d = m; measure();
    addEventListener('resize', measure); document.fonts && document.fonts.ready.then(measure); setInterval(measure, 1500);
    const c = await m.initSky(document.getElementById('sky'), { mobile: narrow(), getTrack: track, getTextRects: textRects, force, manual: params.has('rec'),
      onReady: () => root.classList.add('sky-live'), onFail: () => { root.classList.remove('sky-live'); root.classList.remove('gl'); root.classList.add('nogl'); } });
    if (!c) return;
    window.__sky = c;
    // the globe joins the same renderer when it comes near the viewport
    const gio = new IntersectionObserver((en) => {
      if (!en.some((x) => x.isIntersecting)) return;
      gio.disconnect();
      import('./globe.js').then((g) => g.createGlobeLayer(globeEl, { mobile: narrow() })).then((l) => { c.addLayer(l); globeEl.classList.add('ready', 'shared'); }).catch(() => globeEl.classList.add('static'));
    }, { rootMargin: '600px 0px' });
    gio.observe(globeEl);
  }).catch(() => { root.classList.remove('gl'); root.classList.add('nogl'); }), 400));
}
