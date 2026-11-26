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
if (motion && !touch) {
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

if (params.get('still')) {
  // build-time helper: renders the static fallback images (see tests/render-stills.mjs)
  const which = params.get('still');
  import(which === 'globe' ? './globe.js' : './hero3d.js').then(async (m) => { window.__still = await m.renderStill(+params.get('w') || 1600, +params.get('h') || 1000); });
} else if (gl) {
  const afterLoad = (fn) => (document.readyState === 'complete' ? fn() : addEventListener('load', fn, { once: true })); // let the still paint first
  afterLoad(() => idle(() => import('./hero3d.js').then((m) => m.initHero(document.getElementById('hero-canvas'), { mobile: narrow(), getProgress: () => heroProgress, force, onFail: fallback, manual: params.has('rec') })).then((c) => { if (c) window.__hero = c; }).catch(fallback), 400));
  const globeEl = document.getElementById('globe');
  const gio = new IntersectionObserver((en) => {
    if (en.some((x) => x.isIntersecting)) {
      gio.disconnect();
      import('./globe.js').then((m) => m.initGlobe(globeEl, { mobile: narrow(), force, onFail: () => globeEl.classList.add('static') })).catch(() => {});
    }
  }, { rootMargin: '500px 0px' });
  gio.observe(globeEl);
}
