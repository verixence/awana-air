# AWANA AIR: Flying Beyond The Boundaries

B2B aviation partnership website inviting tour & travel agencies, event planners and hoteliers to partner with AWANA AIR for private jet charters, helicopter charters, air ambulance services and regular charter services.

Static site. Built output (`index.html`, `assets/`, icons, `sitemap.xml` and so on) is committed and served as-is by Vercel.

## Develop
```bash
npm install
node src/optimize-model.mjs                           # only when the source GLBs change: src/models → src/models/opt
SITE_URL=https://awana-air.vercel.app npm run build   # bundles JS/CSS, copies model/env/decoders, icons, OG image, land dots, HTML
node tests/render-stills.mjs                          # re-render the static hero/globe stills from the live scenes, then build again
node tests/run.mjs                                    # Playwright: iPhone 14 / 15 Pro (WebKit), Pixel 7, desktop Chromium + WebKit; overlap, transform, axe, form checks
node tests/shots.mjs && node tests/record.mjs         # screens/v2/*.png, demo and hero *.mp4 (needs ffmpeg)
```

## Structure
- `src/index.html`: page template; `src/build.mjs`: build script
- `src/js/head.js`: inline pre-paint probe (`js`, `motion`, `gl`/`nogl`; `?3d=force` or `?3d=off`), early model fetch
- `src/js/main.js`: header, mobile menu, IntersectionObserver reveals, Lenis (non-touch only), partner form → WhatsApp, lazy 3D loaders
- `src/js/hero3d.js`: GLTF business jet (CC0, see CREDITS.md), golden-hour IBL, sky shader, instanced clouds, contrails, critically damped flight model and camera follow, bloom
- `src/js/globe.js`: dotted globe with illustrative route arcs
- `src/optimize-model.mjs`: gltf-transform pipeline for the jet
- `src/css/site.css`

## Performance guardrails
- The pre-rendered still always paints first, and the live canvas fades in over it once the page is idle.
- The head script decides before first paint: software GL (SwiftShader/llvmpipe), Save-Data, low memory or reduced motion get the still and no WebGL.
- Phones: lighter LOD (about 0.5 MB), no shadows, bloom or clearcoat, DPR cap 1.6, about 30 fps. Desktop: DPR cap 1.5.
- Rendering pauses off-screen and in hidden tabs. An adaptive guard falls back to the still if frames are persistently slow.
- Lenis is disabled on touch devices. Nothing is pinned or sticky, and reveals only animate opacity and translate.

See `CREDITS.md` for licences.
