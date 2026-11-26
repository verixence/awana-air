# Credits & licences: AWANA AIR website

## Imagery and 3D
No stock photos, purchased assets or third-party 3D models are used.

| Asset | Source | Licence |
|---|---|---|
| Hero business jet (3D) | Built procedurally in `src/js/hero3d.js` from Three.js primitives (lathe, extrude, cylinder, sphere) | Original work for this site |
| Clouds, stars, engine glow and trails | Generated at runtime on `<canvas>` | Original work |
| Static hero/globe fallback illustrations, icons, OG image | Hand-written SVG in `src/build.mjs` | Original work |
| Globe land dots | Derived from [Natural Earth](https://www.naturalearthdata.com/) 1:110m Land (`ne_110m_land`) | Public domain |
| Brand mark and wordmark | Placeholder text wordmark and simple SVG glyph created for this site (no official logo was supplied) | Original work; replace with the client's official logo when available |

Globe routes are generic arcs between world cities. They are illustrative only and are labelled as such on the page.

## Libraries (bundled locally into `/assets/js`, no CDN)
| Library | Version | Licence |
|---|---|---|
| [three.js](https://threejs.org/) | 0.187.0 | MIT |
| [GSAP](https://gsap.com/) + ScrollTrigger | 3.15.1 | GSAP Standard "no charge" licence (https://gsap.com/standard-license) |
| [Lenis](https://github.com/darkroom-engineering/lenis) | 1.3.28 | MIT |

## Fonts (self-hosted in `/assets/fonts`)
| Font | Licence |
|---|---|
| Outfit (variable), via @fontsource-variable/outfit | SIL Open Font License 1.1 |
| Bodoni Moda (variable), via @fontsource-variable/bodoni-moda | SIL Open Font License 1.1 |

## Build and test tooling (not shipped)
esbuild (MIT), sharp (Apache-2.0), Playwright (Apache-2.0), axe-core and @axe-core/playwright (MPL-2.0).
