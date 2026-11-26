// Short demo recordings -> screens/demo-desktop.mp4, screens/demo-mobile.mp4 (needs ffmpeg)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './server.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE = process.env.BASE_URL;
const { srv, url } = BASE ? { url: BASE } : await serve(ROOT);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [n, o] of [['desktop', { viewport: { width: 1280, height: 720 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }]]) {
  const dir = fs.mkdtempSync('/tmp/rec-');
  const ctx = await b.newContext({ ...o, recordVideo: { dir, size: o.viewport } });
  const p = await ctx.newPage();
  await p.goto(url + '/'); await p.mouse.move(600, 300).catch(() => {});
  await p.evaluate(() => window.dispatchEvent(new Event('scroll')));
  await p.waitForFunction(() => document.querySelector('#hero-canvas').classList.contains('ready'), null, { timeout: 25000 }).catch(() => {});
  const t0 = Date.now();
  if (n === 'desktop') for (let i = 0; i < 12; i++) { await p.mouse.move(500 + Math.sin(i / 2) * 300, 300 + Math.cos(i / 2) * 150, { steps: 6 }); }
  await sleep(1500);
  const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const steps = 60;
  for (let i = 1; i <= steps; i++) {
    const y = Math.round((H * i) / steps);
    if (n === 'desktop') await p.mouse.wheel(0, H / steps); else await p.evaluate((yy) => scrollTo(0, yy), y);
    await sleep(260);
    if (Date.now() - t0 > 24000) break;
  }
  await sleep(1200);
  const v = p.video(); await ctx.close();
  const webm = await v.path();
  const mp4 = `${ROOT}/screens/demo-${n}.mp4`;
  // trim the loading wait at the start, cap at 28s
  const lead = Math.max(0, (await (async () => 0)()));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-sseof', '-28', '-i', webm, '-t', '28', '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-movflags', '+faststart', mp4]);
  console.log(n, mp4, fs.statSync(mp4).size, lead);
}
await b.close(); srv?.close();
