# AWANA AIR: Flying Beyond The Boundaries

B2B aviation partnership website inviting tour & travel agencies, event planners and hoteliers to partner with AWANA AIR for private jet charters, helicopter charters, air ambulance services and regular charter services.

Static site. Built output (`index.html`, `assets/`, icons, `sitemap.xml` and so on) is committed and served as-is by Vercel.

## Develop
```bash
npm install
SITE_URL=https://awana-air.vercel.app npm run build   # bundles JS/CSS, generates icons, OG image, land dots, HTML
npm test                                              # Playwright: Chromium + WebKit, desktop + mobile, axe
node tests/shots.mjs                                  # screens/*.png
node tests/record.mjs                                 # screens/demo-*.mp4 (needs ffmpeg)
```

## Structure
- `src/index.html`: page template; `src/build.mjs`: build script
- `src/js/main.js`: Lenis, GSAP reveals, micro-interactions, partner form → WhatsApp, lazy 3D loaders
- `src/js/hero3d.js`: procedural jet + cloud parallax (Three.js), scroll-driven flight
- `src/js/globe.js`: dotted globe with illustrative route arcs
- `src/css/site.css`

## Performance guardrails
3D is lazy-loaded (hero boots on first interaction or after a short grace period; globe when near the viewport). DPR is capped at 1.5 (1.25 on phones), rendering pauses off-screen or in hidden tabs, phones get a lighter scene at about 30fps, and there is a static SVG fallback for no-WebGL, Save-Data or low-memory devices. `prefers-reduced-motion` disables Lenis, reveals, the marquee and the hero WebGL; the globe renders as a single still frame.

See `CREDITS.md` for licences.
