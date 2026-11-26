# Credits & licences: AWANA AIR website

## 3D model, environment and imagery

| Asset | Author / source | Licence | Notes |
|---|---|---|---|
| **Business Jet v1** (hero aircraft), `assets/models/bizjet-lod0.glb`, `bizjet-lod1.glb` | tevy.dev, https://tevy.dev/models/business-jet (metadata: https://tevy.dev/models.json, `"license": "CC0-1.0"`; GLB `asset.copyright`: "CC0 1.0, https://tevy.dev") | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) (public domain dedication, no attribution required; credited here anyway) | A generic, unbranded design, not a specific manufacturer's aircraft. Modified for this site with gltf-transform (`src/optimize-model.mjs`): cabin interior, landing gear and airstair removed (never visible in flight), then pruned, welded, quantised and meshopt-compressed. Original files: `src/models/bizjet-lod0/1/2.glb`. |
| **Golden Hour sky v1** (image-based lighting), `assets/env/golden-hour-1k.jpg` | tevy.dev, https://tevy.dev/skies/golden-hour | CC0 1.0 | Used only for reflections/lighting. The visible sky is a custom shader. |
| Sky dome, clouds, contrails | Generated at runtime in `src/js/hero3d.js` (shaders + procedural fbm cloud atlas) | Original work | |
| Hero stills (`hero-still.webp`, `hero-still-mobile.webp`), globe still, OG image | Pre-rendered from the live WebGL scenes (`tests/render-stills.mjs`, headless SwiftShader) | Original work | Shown on no-WebGL, software-GL, reduced-motion, Save-Data and low-memory devices, and under the canvas while the 3D loads. |
| Globe land dots | Derived from [Natural Earth](https://www.naturalearthdata.com/) 1:110m Land | Public domain | |
| Brand mark and wordmark | Simple SVG glyph and text wordmark made for this site (no official logo was supplied) | Original work | Replace with the client's official logo when one is available. |

The globe routes are generic arcs between world cities. They are illustrative only and labelled as such on the page.

## Runtime libraries (bundled or vendored locally under `/assets`, no CDN)
| Library | Version | Licence |
|---|---|---|
| [three.js](https://threejs.org/), including examples/jsm GLTFLoader, KTX2Loader, UltraHDRLoader, EffectComposer, UnrealBloomPass and OutputPass | 0.187.0 | MIT |
| meshopt decoder (`three/examples/jsm/libs/meshopt_decoder.module.js`, from [meshoptimizer](https://github.com/zeux/meshoptimizer)) | bundled with three 0.187.0 | MIT |
| [Basis Universal](https://github.com/BinomialLLC/basis_universal) transcoder (`/assets/vendor/basis/`) | bundled with three 0.187.0 | Apache-2.0 |
| [Lenis](https://github.com/darkroom-engineering/lenis) smooth scroll (desktop pointer devices only) | 1.3.28 | MIT |

GSAP is no longer used by the site.

## Fonts (self-hosted in `/assets/fonts`)
| Font | Licence |
|---|---|
| Outfit (variable), via @fontsource-variable/outfit | SIL Open Font License 1.1 |
| Bodoni Moda (variable), via @fontsource-variable/bodoni-moda | SIL Open Font License 1.1 |

## Build and test tooling (not shipped)
gltf-transform 4.5.1 (MIT), meshoptimizer 1.3.0 (MIT), esbuild (MIT), sharp (Apache-2.0), Playwright (Apache-2.0), axe-core and @axe-core/playwright (MPL-2.0), Lighthouse (Apache-2.0).
