// Demo recordings -> screens/v2/demo-desktop.mp4 (Chromium 1280x720), screens/v2/demo-mobile.mp4 (iPhone 14, WebKit). Needs ffmpeg.
import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './server.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE = process.env.BASE_URL;
const { srv, url } = BASE ? { url: BASE } : await serve(ROOT);
const OUT = path.join(ROOT, 'screens/v2'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [n, type, opts] of [['desktop', chromium, { viewport: { width: 1280, height: 720 } }], ['mobile', webkit, { ...devices['iPhone 14'], deviceScaleFactor: 2 }]]) {
  const b = await type.launch(type === chromium ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});
  const dir = fs.mkdtempSync('/tmp/rec-');
  const size = n === 'desktop' ? opts.viewport : { width: 390, height: 664 };
  const ctx = await b.newContext({ ...opts, recordVideo: { dir, size } });
  const p = await ctx.newPage();
  const tStart = Date.now();
  await p.goto(url + '/?3d=force');
  await p.waitForFunction(() => document.querySelector('#hero-canvas').classList.contains('ready'), null, { timeout: 30000 }).catch(() => {});
  const lead = (Date.now() - tStart) / 1000;
  if (n === 'desktop') for (let i = 0; i < 10; i++) await p.mouse.move(640 + Math.sin(i / 2) * 260, 360 + Math.cos(i / 2) * 120, { steps: 8 });
  else await sleep(2500);
  const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const steps = 70;
  for (let i = 1; i <= steps; i++) {
    if (n === 'desktop') await p.mouse.wheel(0, H / steps); else await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), Math.round((H * i) / steps));
    await sleep(240);
  }
  if (n === 'mobile') { await p.evaluate(() => scrollTo(0, 0)); await sleep(600); await p.tap('.menu-btn'); await sleep(1200); await p.tap('.menu-btn'); }
  await sleep(1200);
  const v = p.video(); await ctx.close();
  const webm = await v.path();
  const mp4 = `${OUT}/demo-${n}.mp4`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, lead - 0.3)), '-i', webm, '-t', '29', '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', mp4]);
  console.log(n, mp4, fs.statSync(mp4).size, 'lead', lead.toFixed(1));
  await b.close();
}
srv?.close();
