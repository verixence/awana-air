// Hero clips -> screens/v2/hero-desktop.mp4 (1440x810) and hero-mobile.mp4 (iPhone 14, WebKit), 12 s each at 30 fps.
// The box has no GPU, so frames are rendered deterministically (fixed 1/30 s steps via ?rec) and screenshotted,
// giving the same motion a real device renders in real time. Needs ffmpeg.
import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './server.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { srv, url } = await serve(ROOT);
const OUT = path.join(ROOT, 'screens/v2'); fs.mkdirSync(OUT, { recursive: true });
const SECS = +(process.env.SECS || 12), FPS = 30;
for (const [n, type, opts] of [['desktop', chromium, { viewport: { width: 1440, height: 810 } }], ['mobile', webkit, { ...devices['iPhone 14'], deviceScaleFactor: 2 }]]) {
  if (process.argv[2] && process.argv[2] !== n) continue;
  const b = await type.launch(type === chromium ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});
  const p = await (await b.newContext(opts)).newPage();
  p.on('pageerror', (e) => console.log(n, 'pageerror', e.message));
  await p.goto(url + '/?3d=force&rec=1');
  await p.waitForFunction(() => window.__hero, null, { timeout: 60000 });
  await p.addStyleTag({ content: '.hero-canvas{transition:none!important} *{caret-color:transparent}' });
  await p.waitForTimeout(1500);                          // hero text entrance settles
  const dir = fs.mkdtempSync('/tmp/herofr-');
  const N = SECS * FPS;
  for (let i = 0; i < N; i++) {
    const t = i / FPS;
    // desktop: a slow cursor drift across the hero (the jet responds to the pointer)
    const pointer = n === 'desktop' ? { x: Math.sin(t * 0.55) * 0.32, y: Math.sin(t * 0.37 + 1) * 0.22 } : null;
    await p.evaluate(([pt]) => window.__hero.step(1 / 30, pt), [pointer]);
    await p.screenshot({ path: `${dir}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
    if (i % 60 === 0) console.log(n, 'frame', i, '/', N);
  }
  await b.close();
  const mp4 = `${OUT}/hero-${n}.mp4`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/f%04d.jpg`, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', mp4]);
  fs.rmSync(dir, { recursive: true });
  console.log(n, mp4, fs.statSync(mp4).size);
}
srv.close();
