import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

const WA_NUMBER = '919540360060';
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const mobile = matchMedia('(max-width: 760px)').matches;
const motion = !reduce;
if (motion) root.classList.add('motion');

// ---------- header, progress, nav ----------
const header = document.querySelector('.site-header');
const bar = document.querySelector('.progress');
function onScroll() {
  const y = window.scrollY;
  header.classList.toggle('scrolled', y > 40);
  const max = document.documentElement.scrollHeight - innerHeight;
  bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const toggle = document.querySelector('.nav-toggle');
const navList = document.getElementById('nav-list');
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  navList.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
});
navList.addEventListener('click', (e) => {
  if (e.target.closest('a') && toggle.getAttribute('aria-expanded') === 'true') toggle.click();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { toggle.click(); toggle.focus(); } });

// ---------- smooth scroll + scroll animations ----------
let lenis = null;
let heroProgress = 0;
if (motion) {
  gsap.registerPlugin(ScrollTrigger);
  if (!mobile) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    root.classList.add('lenis');
  }

  // split headings into words for a masked reveal
  document.querySelectorAll('.split').forEach((el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(document.createTextNode(part)); return; }
            const w = document.createElement('span'); w.className = 'w';
            const i = document.createElement('span'); i.textContent = part; w.append(i); frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    walk(el);
    el.setAttribute('aria-label', label);
    el.querySelectorAll('.w').forEach((w) => w.setAttribute('aria-hidden', 'true'));
    const inner = el.querySelectorAll('.w > span');
    const isHero = el.classList.contains('hero-title');
    gsap.to(inner, { y: 0, duration: isHero ? 1.1 : 0.9, ease: 'power4.out', stagger: isHero ? 0.08 : 0.04, delay: isHero ? 0.15 : 0,
      scrollTrigger: isHero ? undefined : { trigger: el, start: 'top 88%', once: true } });
  });

  gsap.utils.toArray('.reveal-up').forEach((el) => {
    const inHero = el.closest('.hero');
    gsap.fromTo(el, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: inHero ? 0.5 : 0,
      scrollTrigger: inHero ? undefined : { trigger: el, start: 'top 90%', once: true } });
  });
  gsap.utils.toArray('.reveal-left').forEach((el, i) => {
    gsap.fromTo(el, { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  ScrollTrigger.batch('.reveal-card', {
    start: 'top 90%', once: true,
    onEnter: (els) => gsap.fromTo(els, { y: 70, opacity: 0, rotateX: -18 }, { y: 0, opacity: 1, rotateX: 0, duration: 1.1, ease: 'power3.out', stagger: 0.12, clearProps: 'transform' }),
  });

  // why-partner progress line
  const line = document.querySelector('.why-line span');
  if (line) {
    line.style.setProperty('--wp', 0);
    ScrollTrigger.create({ trigger: '.why-list', start: 'top 70%', end: 'bottom 60%', scrub: true, onUpdate: (s) => line.style.setProperty('--wp', s.progress.toFixed(3)) });
  }

  // hero: content drifts and fades as the jet flies out
  gsap.to('.hero-content', { yPercent: -18, opacity: 0.15, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-fallback', { yPercent: 12, scale: 1.08, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true, onUpdate: (s) => { heroProgress = s.progress; } });

  // process path parallax
  gsap.fromTo('.steps-path path', { strokeDashoffset: 300 }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.process', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo('.cta-band h2', { scale: 0.94 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.cta-band', start: 'top bottom', end: 'center center', scrub: true } });
}

// in-page anchors go through Lenis when it is active
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const target = id === '#top' ? document.body : document.querySelector(id);
  if (!target) return;
  if (lenis) { e.preventDefault(); lenis.scrollTo(target, { offset: id === '#top' ? 0 : -80 }); history.replaceState(null, '', id); }
});

// ---------- micro-interactions (fine pointers only) ----------
if (motion && finePointer) {
  document.querySelectorAll('.tilt').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', ((px - 0.5) * 14).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((0.5 - py) * 12).toFixed(2) + 'deg');
      card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  });
  document.querySelectorAll('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * 0.25).toFixed(1) + 'px');
      el.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * 0.35).toFixed(1) + 'px');
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); });
  });
}

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
  const field = el.closest('.field');
  field.classList.toggle('invalid', !!msg);
  el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  document.getElementById('e-' + name).textContent = msg;
  return !msg;
}
Object.keys(rules).forEach((n) => form.elements[n].addEventListener('blur', () => { if (form.elements[n].value || form.elements[n].getAttribute('aria-invalid')) check(n); }));
export function buildWhatsAppUrl(d) {
  const lines = [
    "Hello AWANA AIR, I'd like to become a partner.",
    '',
    `Name: ${d.name}`,
    `Business name: ${d.business}`,
    `Business type: ${d.type}`,
    `City: ${d.city}`,
    `Phone: ${d.phone}`,
    `Service of interest: ${d.service}`,
  ];
  if (d.message) lines.push(`Message: ${d.message}`);
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
}
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const bad = Object.keys(rules).filter((n) => !check(n));
  if (bad.length) {
    status.classList.remove('ok');
    status.textContent = 'Please fix the highlighted fields.';
    form.elements[bad[0]].focus();
    return;
  }
  const d = Object.fromEntries(['name', 'business', 'type', 'city', 'phone', 'service', 'message'].map((n) => [n, form.elements[n].value.trim()]));
  const url = buildWhatsAppUrl(d);
  form.dataset.waUrl = url;
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
  status.classList.add('ok');
  status.innerHTML = 'Opening WhatsApp… If it did not open, <a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">tap here to send your enquiry</a>.';
});

// ---------- 3D: lazy, guarded ----------
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
const conn = navigator.connection || {};
const lowPower = conn.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
const can3D = webglOK() && !lowPower;
const idle = (fn, t = 1500) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: t }) : setTimeout(fn, t));

if (can3D && motion) {
  // The static sky is the first paint; the WebGL scene boots on the visitor's first interaction
  // (or after a short grace period) so it never competes with initial page load.
  let booted = false;
  const EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown'];
  const boot = () => {
    if (booted) return; booted = true;
    EVENTS.forEach((ev) => removeEventListener(ev, boot));
    idle(() => import('./hero3d.js').then((m) => m.initHero(document.getElementById('hero-canvas'), { mobile, getProgress: () => heroProgress })).catch(() => {}), 1200);
  };
  const arm = () => { EVENTS.forEach((ev) => addEventListener(ev, boot, { passive: true, once: true })); setTimeout(boot, mobile ? 12000 : 8000); };
  if (document.readyState === 'complete') arm(); else addEventListener('load', arm, { once: true });
}

const globeEl = document.getElementById('globe');
if (can3D && globeEl) {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((en) => en.isIntersecting)) {
      io.disconnect();
      import('./globe.js').then((m) => m.initGlobe(globeEl, { mobile, still: reduce })).catch(() => {});
    }
  }, { rootMargin: '400px 0px' });
  io.observe(globeEl);
}
