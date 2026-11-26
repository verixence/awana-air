// Pre-renders the static fallbacks from the real 3D scenes (headless WebGL via SwiftShader):
//   src/img/hero-still.webp (1920x1080), src/img/hero-still-mobile.webp (900x1600), src/img/globe-still.webp
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { serve } from './server.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { srv, url } = await serve(ROOT);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
const only = process.argv[2];
for (const [which, w, h, out, q] of [['jet', 1920, 1080, 'hero-still.webp', 74], ['jet', 828, 1466, 'hero-still-mobile.webp', 72], ['globe', 1100, 1100, 'globe-still.webp', 82]]) {
  if (only && !out.startsWith(only)) continue;
  await p.goto(`${url}/?still=${which}&w=${w}&h=${h}`);
  const data = await p.waitForFunction(() => window.__still, null, { timeout: 120000, polling: 500 }).then((x) => x.jsonValue());
  const buf = Buffer.from(data.split(',')[1], 'base64');
  const img = sharp(buf);
  await (which === 'globe' ? img.resize(900).webp({ quality: q, alphaQuality: 90 }) : img.webp({ quality: q })).toFile(path.join(ROOT, 'src/img', out));
  console.log(out, fs.statSync(path.join(ROOT, 'src/img', out)).size);
}
await b.close(); srv.close();
