// AWANA AIR static build: bundles JS/CSS with esbuild, generates icons, OG image, land-dot data and HTML.
// Usage: SITE_URL=https://awana-air.vercel.app node src/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = (process.env.SITE_URL || 'https://awana-air.vercel.app').replace(/\/$/, '');
const V = Date.now().toString(36);
const r = (...p) => path.join(ROOT, ...p);
const write = (p, s) => { fs.mkdirSync(path.dirname(r(p)), { recursive: true }); fs.writeFileSync(r(p), s); };

// ---------- brand mark (original wordmark glyph: an "A" crossed by a swept wing) ----------
const MARK_PATHS = `<path d="M9 41 L24 7 L39 41" fill="none" stroke="url(#awg)" stroke-width="4.2" stroke-linejoin="miter" stroke-linecap="square"/><path d="M3 31 C 16 25.5, 30 24, 46 18.5" fill="none" stroke="#f6efe2" stroke-width="2.6" stroke-linecap="round"/>`;
const GRAD = `<defs><linearGradient id="awg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d79b"/><stop offset="1" stop-color="#c39549"/></linearGradient></defs>`;
const MARK = `<svg class="brand-mark" viewBox="0 0 48 48" width="40" height="40" aria-hidden="true" focusable="false">${GRAD}${MARK_PATHS}</svg>`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${GRAD}<rect width="48" height="48" rx="11" fill="#081231"/>${MARK_PATHS}</svg>`;

// ---------- icons (simple original line icons) ----------
const ic = (body, cls = 'card-icon') => `<svg class="${cls}" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICONS = {
  ICON_JET: ic('<path d="M6 27 L42 21 C45 20.5 45 17 42 17.5 L30 19.5 L19 8 L15 8.6 L22 20.7 L11 22.5 L7 18 L4.5 18.4 L7 24 Z"/><path d="M14 34 L36 34" opacity=".55"/><path d="M20 39 L33 39" opacity=".35"/>'),
  ICON_HELI: ic('<path d="M6 10 H40"/><path d="M23 10 V15"/><path d="M12 22 C12 17.5 15.5 15 21 15 H27 C32 15 35 19 35 24 C35 28 32 30 28 30 H18 C14 30 12 27 12 22 Z"/><path d="M35 22 H44 L46 18"/><path d="M17 30 L15 36 M29 30 L31 36 M11 36 H35"/><path d="M27 16 V23 H35" opacity=".6"/>'),
  ICON_MED: ic('<path d="M24 5 C24 5 40 9 40 12 V24 C40 33 33 40 24 43 C15 40 8 33 8 24 V12 C8 9 24 5 24 5 Z"/><path d="M24 16 V32 M16 24 H32" stroke-width="2.6"/>'),
  ICON_ROUTE: ic('<circle cx="10" cy="36" r="4"/><circle cx="38" cy="12" r="4"/><path d="M13 33 C 20 26, 16 18, 24 16 S 31 14, 34.5 13.5" stroke-dasharray="3 3.5"/><path d="M33 31 L41 31 M37 27 L41 31 L37 35" />'),
  ICON_GLOBE: ic('<circle cx="24" cy="24" r="17"/><path d="M7 24 H41 M24 7 C 18 13, 18 35, 24 41 M24 7 C 30 13, 30 35, 24 41"/>', 'aud-svg'),
  ICON_STAR: ic('<path d="M24 6 L28.6 18.6 L42 19.2 L31.4 27.4 L35.2 40.4 L24 32.8 L12.8 40.4 L16.6 27.4 L6 19.2 L19.4 18.6 Z"/>', 'aud-svg'),
  ICON_KEY: ic('<path d="M10 40 V18 L24 8 L38 18 V40 Z"/><path d="M19 40 V29 H29 V40"/><path d="M17 20 H19 M23 20 H25 M29 20 H31"/>', 'aud-svg'),
  WA_ICON: `<svg class="i" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z"/></svg>`,
  PHONE_ICON: `<svg class="i" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z"/></svg>`,
  MAIL_ICON: `<svg class="i" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-13Zm1.7.5 7.3 5.1L19.3 6H4.7ZM20 7.7l-7.5 5.2a.9.9 0 0 1-1 0L4 7.7V18.5h16V7.7Z"/></svg>`,
  IG_ICON: `<svg class="i" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none"/></svg>`,
  FB_ICON: `<svg class="i" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z"/></svg>`,
};

// ---------- static hero fallback (procedural SVG night sky + jet silhouette) ----------
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const rand = rng(7);
let stars = '';
for (let i = 0; i < 90; i++) stars += `<circle cx="${(rand() * 1600).toFixed(0)}" cy="${(rand() * 560).toFixed(0)}" r="${(rand() * 1.3 + 0.3).toFixed(2)}" opacity="${(rand() * 0.6 + 0.25).toFixed(2)}"/>`;
const cloud = (x, y, s, o) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}"><ellipse cx="0" cy="0" rx="220" ry="46"/><ellipse cx="-90" cy="-18" rx="110" ry="50"/><ellipse cx="70" cy="-30" rx="130" ry="62"/><ellipse cx="170" cy="-6" rx="90" ry="38"/></g>`;
const HERO_FALLBACK = `<svg class="hero-fallback" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="hsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#040817"/><stop offset=".55" stop-color="#0b1a44"/><stop offset=".85" stop-color="#2a2f5a"/><stop offset="1" stop-color="#6b5468"/></linearGradient>
<radialGradient id="hglow" cx=".72" cy=".9" r=".6"><stop offset="0" stop-color="#e9b872" stop-opacity=".55"/><stop offset="1" stop-color="#e9b872" stop-opacity="0"/></radialGradient>
<linearGradient id="hjet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9c3d8"/></linearGradient>
<filter id="hblur"><feGaussianBlur stdDeviation="14"/></filter>
</defs>
<rect width="1600" height="900" fill="url(#hsky)"/><rect width="1600" height="900" fill="url(#hglow)"/>
<g fill="#fff">${stars}</g>
<g fill="#c9cfe6" filter="url(#hblur)">${cloud(260, 760, 1.4, 0.22)}${cloud(1300, 820, 1.7, 0.25)}${cloud(820, 700, 1.0, 0.14)}</g>
<g transform="translate(1040 430) rotate(-9) scale(1.15)">
<path d="M-420 22 C -300 18, -200 14, -60 8" stroke="#f3d79b" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M-430 34 C -310 30, -210 26, -60 20" stroke="#f3d79b" stroke-opacity=".2" stroke-width="2" fill="none" stroke-linecap="round"/>
<path fill="url(#hjet)" d="M-80 6 C -40 -10, 120 -14, 210 -8 C 250 -5, 268 4, 250 10 C 200 20, 0 24, -70 18 Z"/>
<path fill="#d9dfeb" d="M40 4 L -30 70 L -5 70 L 110 6 Z"/>
<path fill="#c3cadb" d="M60 -6 L 10 -40 L 28 -40 L 112 -8 Z" opacity=".75"/>
<path fill="#e7ebf3" d="M-60 4 L -95 -52 L -75 -52 L -30 4 Z"/>
<path fill="#d9dfeb" d="M-100 -50 L -60 -50 L -66 -44 L -104 -44 Z"/>
<rect x="-50" y="-6" width="46" height="13" rx="6.5" fill="#cfd6e6"/>
<path d="M150 -6 L 200 -6" stroke="#0b1a44" stroke-width="3" stroke-dasharray="5 6"/>
<path d="M-60 12 L 230 4" stroke="#c39549" stroke-width="1.6"/>
</g>
</svg>`;

const GLOBE_FALLBACK = `<svg class="globe-fallback" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
<defs><radialGradient id="gfg" cx=".38" cy=".35" r=".75"><stop offset="0" stop-color="#1b3170"/><stop offset="1" stop-color="#060c1f"/></radialGradient></defs>
<circle cx="200" cy="200" r="190" fill="none" stroke="#e9c27f" stroke-opacity=".18" stroke-width="10"/>
<circle cx="200" cy="200" r="170" fill="url(#gfg)" stroke="#6f86c9" stroke-opacity=".5"/>
<g fill="none" stroke="#8aa0dc" stroke-opacity=".28"><ellipse cx="200" cy="200" rx="170" ry="60"/><ellipse cx="200" cy="200" rx="170" ry="120"/><ellipse cx="200" cy="200" rx="60" ry="170"/><ellipse cx="200" cy="200" rx="120" ry="170"/><path d="M30 200 H370 M200 30 V370"/></g>
<g fill="none" stroke="#f3d79b" stroke-width="2" stroke-linecap="round"><path d="M120 150 Q 200 60 290 140"/><path d="M150 260 Q 230 180 300 230"/><path d="M110 220 Q 150 120 230 110"/></g>
<g fill="#f3d79b"><circle cx="120" cy="150" r="4"/><circle cx="290" cy="140" r="4"/><circle cx="150" cy="260" r="4"/><circle cx="300" cy="230" r="4"/><circle cx="110" cy="220" r="4"/><circle cx="230" cy="110" r="4"/></g>
</svg>`;

// ---------- JSON-LD ----------
const JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'AWANA AIR',
  slogan: 'Flying Beyond The Boundaries',
  url: SITE_URL + '/',
  logo: SITE_URL + '/icon-512.png',
  telephone: '+91-95403-60060',
  email: 'awanaair.official@gmail.com',
  contactPoint: [{ '@type': 'ContactPoint', telephone: '+91-95403-60060', contactType: 'sales', availableLanguage: ['en'] }],
  sameAs: ['https://www.instagram.com/awana_air', 'https://www.facebook.com/share/19qmNAzfaX/', 'https://whatsapp.com/channel/0029Vb90dLhJJhzhRk4PIx06'],
  makesOffer: ['Private Jet Charters', 'Helicopter Charters', 'Air Ambulance Services', 'Regular Charter Services'].map((n) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: n } })),
}).replace(/</g, '\\u003c');

// ---------- land dots for the globe (Natural Earth 1:110m land, public domain) ----------
function landDots() {
  const gj = JSON.parse(fs.readFileSync(r('src/data/ne_110m_land.geojson'), 'utf8'));
  const polys = [];
  for (const f of gj.features) {
    const g = f.geometry;
    const list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of list) {
      const ring = p[0]; let minX = 999, maxX = -999, minY = 999, maxY = -999;
      for (const [x, y] of ring) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      polys.push({ rings: p, minX, maxX, minY, maxY });
    }
  }
  const inRing = (x, y, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const isLand = (x, y) => polys.some((p) => x >= p.minX && x <= p.maxX && y >= p.minY && y <= p.maxY && inRing(x, y, p.rings[0]) && !p.rings.slice(1).some((h) => inRing(x, y, h)));
  const out = []; const step = 1.5;
  for (let lat = -58; lat <= 80; lat += step) {
    const n = Math.max(1, Math.round((360 * Math.cos((lat * Math.PI) / 180)) / step));
    for (let i = 0; i < n; i++) { const lng = -180 + (i * 360) / n; if (isLand(lng, lat)) out.push(Math.round(lat * 100), Math.round(lng * 100)); }
  }
  return new Int16Array(out);
}

// ---------- run ----------
fs.rmSync(r('assets'), { recursive: true, force: true });
fs.mkdirSync(r('assets/img'), { recursive: true });
for (const f of fs.existsSync(r('src/img')) ? fs.readdirSync(r('src/img')) : []) fs.copyFileSync(r('src/img', f), r('assets/img', f));
fs.mkdirSync(r('assets/models'), { recursive: true }); fs.mkdirSync(r('assets/env'), { recursive: true }); fs.mkdirSync(r('assets/vendor/basis'), { recursive: true });
for (const f of fs.readdirSync(r('src/models/opt'))) fs.copyFileSync(r('src/models/opt', f), r('assets/models', f));
fs.copyFileSync(r('src/env/golden-hour-1k.jpg'), r('assets/env/golden-hour-1k.jpg'));
for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) fs.copyFileSync(r('node_modules/three/examples/jsm/libs/basis', f), r('assets/vendor/basis', f));
const HEAD_JS = (await esbuild.transform(fs.readFileSync(r('src/js/head.js'), 'utf8'), { minify: true, target: 'es2017' })).code.trim();
fs.mkdirSync(r('assets/fonts'), { recursive: true });
fs.copyFileSync(r('node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2'), r('assets/fonts/outfit-latin-wght-normal.woff2'));
fs.copyFileSync(r('node_modules/@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-wght-normal.woff2'), r('assets/fonts/bodoni-moda-latin-wght-normal.woff2'));

const dots = landDots();
write('assets/data/land-dots.bin', Buffer.from(dots.buffer));

await esbuild.build({ entryPoints: [r('src/js/main.js')], bundle: true, splitting: true, format: 'esm', minify: true, target: ['es2020', 'safari15'], outdir: r('assets/js'), chunkNames: 'chunks/[name]-[hash]', legalComments: 'none', logLevel: 'warning' });
await esbuild.build({ entryPoints: [r('src/css/site.css')], bundle: true, minify: true, outfile: r('assets/css/site.css'), external: ['/assets/fonts/*', '/assets/img/*'], logLevel: 'warning' });

write('favicon.svg', favicon);
for (const [name, size] of [['favicon-32.png', 32], ['favicon-48.png', 48], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) await sharp(Buffer.from(favicon), { density: 600 }).resize(size, size).png().toFile(r(name));

// OG image: dusk sky + the static jet render + type
const ogSky = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060c19"/><stop offset=".45" stop-color="#0b1630"/><stop offset=".75" stop-color="#2b3150"/><stop offset="1" stop-color="#5d4f5a"/></linearGradient><radialGradient id="g" cx=".75" cy=".78" r=".5"><stop offset="0" stop-color="#d6a068" stop-opacity=".45"/><stop offset="1" stop-color="#d6a068" stop-opacity="0"/></radialGradient><linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0a1222" stop-opacity=".92"/><stop offset=".55" stop-color="#0a1222" stop-opacity=".35"/><stop offset="1" stop-color="#0a1222" stop-opacity="0"/></linearGradient></defs><rect width="1200" height="630" fill="url(#s)"/><rect width="1200" height="630" fill="url(#g)"/></svg>`;
const ogType = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0a1222" stop-opacity=".9"/><stop offset=".5" stop-color="#0a1222" stop-opacity=".3"/><stop offset="1" stop-color="#0a1222" stop-opacity="0"/></linearGradient></defs><rect width="1200" height="630" fill="url(#l)"/>
<g transform="translate(80 86) scale(1.4)">${GRAD}${MARK_PATHS}</g>
<text x="160" y="128" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" letter-spacing="9" fill="#f4efe6">AWANA <tspan fill="#c9a96e">AIR</tspan></text>
<text x="80" y="330" font-family="DejaVu Serif, Georgia, serif" font-size="70" fill="#f4efe6">Flying Beyond</text>
<text x="80" y="412" font-family="DejaVu Serif, Georgia, serif" font-style="italic" font-size="70" fill="#e0c592">The Boundaries</text>
<text x="80" y="500" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" letter-spacing="3" fill="#c9cfdc">B2B AVIATION PARTNERSHIPS</text>
<text x="80" y="548" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" fill="#c9a96e">+91 95403 60060</text></svg>`;
const layers = [];
if (fs.existsSync(r('src/img/hero-still.webp'))) layers.push({ input: await sharp(r('src/img/hero-still.webp')).resize(1200, 630, { fit: 'cover', position: 'right' }).toBuffer(), left: 0, top: 0 });
layers.push({ input: Buffer.from(ogType), left: 0, top: 0 });
await sharp(Buffer.from(ogSky)).composite(layers).jpeg({ quality: 84, mozjpeg: true }).toFile(r('og-image.jpg'));

let html = fs.readFileSync(r('src/index.html'), 'utf8');
const tokens = { SITE_URL, V, JSONLD, MARK, HEAD_JS, ...ICONS };
html = html.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m));
html = html.replace(/<span id="year">\d+<\/span>/, `<span id="year">${new Date().getFullYear()}</span>`);
write('index.html', html);

write('404.html', `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found | AWANA AIR</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/css/site.css?v=${V}"></head><body class="nf"><main id="main" class="nf-main"><a class="brand" href="/" aria-label="AWANA AIR home">${MARK}<span class="brand-word">AWANA <em>AIR</em></span></a><h1>This page has flown off course</h1><p>The page you are looking for does not exist.</p><a class="btn btn-gold" href="/">Back to home</a></main></body></html>`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>\n</urlset>\n`);
write('site.webmanifest', JSON.stringify({ name: 'AWANA AIR', short_name: 'AWANA AIR', start_url: '/', display: 'standalone', background_color: '#060c1f', theme_color: '#060c1f', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2));
console.log(`built for ${SITE_URL}; land dots: ${dots.length / 2}`);
