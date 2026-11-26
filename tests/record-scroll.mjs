// Scroll-through recordings showing the jet flying through the whole site:
//   screens/v3/scroll-desktop.mp4 (1440x900, Chromium) and screens/v3/scroll-mobile.mp4 (iPhone 14, WebKit), ~24 s at 30 fps.
// The box has no GPU, so frames are rendered deterministically: ?rec puts the 3D in fixed-step mode, and each frame
// sets the scroll position, advances the scene by 1/30 s and takes a screenshot. Needs ffmpeg.
import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './server.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { srv, url } = await serve(ROOT);
const OUT = path.join(ROOT, 'screens/v3'); fs.mkdirSync(OUT, { recursive: true });
const SECS = +(process.env.SECS || 24), FPS = 30;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
for (const [n, type, opts] of [['desktop', chromium, { viewport: { width: 1440, height: 900 } }], ['mobile', webkit, { ...devices['iPhone 14'], deviceScaleFactor: 2 }]]) {
  if (process.argv[2] && process.argv[2] !== n) continue;
  const b = await type.launch(type === chromium ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});
  const p = await (await b.newContext(opts)).newPage();
  p.on('pageerror', (e) => console.log(n, 'pageerror', e.message));
  await p.goto(url + '/?3d=force&rec=1');
  await p.waitForFunction(() => window.__sky, null, { timeout: 60000 });
  await p.addStyleTag({ content: '.hero-sky,.hero-still{transition:none!important} [data-reveal]{transition-duration:.35s!important} *{caret-color:transparent}' });
  await p.waitForTimeout(1500);
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const dir = fs.mkdtempSync('/tmp/scrollfr-');
  const N = SECS * FPS, hold = 2.5 * FPS, tail = 2 * FPS;
  for (let i = 0; i < N; i++) {
    const t = Math.min(1, Math.max(0, (i - hold) / (N - hold - tail)));
    // a gentle, slightly stepped scroll: eased overall, with soft pauses so each section reads
    const k = 9, sstep = t + (0.8 * Math.sin(2 * Math.PI * k * t)) / (2 * Math.PI * k);   // monotonic, with soft pauses on each section
    const y = Math.round(max * ease(Math.min(1, Math.max(0, sstep))));
    await p.evaluate(([yy]) => { scrollTo(0, yy); window.dispatchEvent(new Event('scroll')); }, [Math.min(max, Math.max(0, y))]);
    const pointer = n === 'desktop' ? { x: Math.sin(i / FPS * 0.5) * 0.25, y: Math.sin(i / FPS * 0.31) * 0.18 } : null;
    await p.evaluate(([pt]) => window.__sky.step(1 / 30, pt), [pointer]);
    await p.screenshot({ path: `${dir}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
    if (i % 90 === 0) console.log(n, 'frame', i, '/', N);
  }
  await b.close();
  const mp4 = `${OUT}/scroll-${n}.mp4`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/f%04d.jpg`, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', mp4]);
  fs.rmSync(dir, { recursive: true });
  console.log(n, mp4, fs.statSync(mp4).size);
}
srv.close();
