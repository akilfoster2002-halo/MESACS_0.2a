/* Films shots.js out of the running game and cuts it to the song.

     node film.mjs --sample              # three stills per shot, to /tmp/film-*.jpg
     node film.mjs                       # the whole clip -> koro-landing/exports/koro-gameplay.mp4

   Needs `npm run dev` on 8799. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { open, start, hold, clean } from './rig.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const LANDING = '/Users/akilfoster/CSapps/koro-landing';
const SONG = path.join(LANDING, 'audios/2audio-15s.mp3');
const BEATS = JSON.parse(fs.readFileSync(path.join(LANDING, 'exports/2audio-15s.beats.json'), 'utf8'));
const OUT = path.join(LANDING, 'exports/koro-gameplay.mp4');
const FPS = 30, DUR = 15, SAMPLE = process.argv.includes('--sample');
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();
const frames = path.join(os.tmpdir(), 'koro-gameplay-frames');

const B = BEATS.beats.map((b) => b.t);
const bt = (i) => (i < B.length ? B[i] : B[B.length - 1] + (i - B.length + 1) * BEATS.beat);

const { browser, page } = await open();
try {
  await start(page);
  await page.evaluate(() => { for (let i = 0; i < 60; i++) window.__step(16.7); });
  await page.evaluate(() => { const s = [...document.querySelectorAll('a,button')].find((b) => /skip the walkthrough/i.test(b.textContent)); if (s) s.click(); });
  await hold(page);
  await clean(page);
  await page.addScriptTag({ content: fs.readFileSync(path.join(here, 'shots.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(here, 'fx.js'), 'utf8') });
  await page.evaluate((b) => FX.init(b), { beats: B, beat: BEATS.beat });

  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  const shots = await page.evaluate(() => SHOTS.map((s) => ({ name: s.name, b0: s.b0, b1: s.b1, pre: s.pre || 30, start: s.start || null, arcade: s.name === 'arcade' })));
  let f = 0;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const t0 = bt(s.b0), t1 = i === shots.length - 1 ? DUR : bt(s.b1);
    const f0 = Math.round(t0 * FPS), f1 = Math.round(t1 * FPS);
    if (ONLY && !ONLY.includes(s.name)) { f = f1; continue; }
    await page.evaluate((i) => FX.setup(i), i);
    await page.evaluate((n) => { for (let k = 0; k < n; k++) window.__step(1000 / 30); }, s.pre);
    if (s.start) { await page.keyboard.press(s.start); await page.evaluate(() => { for (let k = 0; k < 4; k++) window.__step(1000 / 30); }); await page.keyboard.press('Digit1'); }
    const want = SAMPLE ? new Set([f0, Math.round((f0 + f1) / 2), f1 - 1]) : null;
    for (f = f0; f < f1; f++) {
      const T = f / FPS;
      // the arcade is played with real keys: the cabinet listens to the window, not to G.keys
      if (s.arcade) { if (f === f0 || f % 20 === 0) await page.keyboard.press('Space'); const k = Math.floor(T * 6) % 2 ? 'ArrowLeft' : 'ArrowRight'; await page.keyboard.down(k); }
      await page.evaluate((i, u, T) => FX.frame(i, u, T), i, (f - f0) / (f1 - f0), T);
      if (s.arcade) { await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowRight'); }
      if (want && !want.has(f)) continue;
      const file = SAMPLE ? `/tmp/film-${String(i + 1)}-${s.name}-${T.toFixed(2)}.jpg` : path.join(frames, `${String(f).padStart(5, '0')}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: SAMPLE ? 70 : 92 });
    }
    console.log(`shot ${i + 1} ${s.name}: ${t0.toFixed(2)}-${t1.toFixed(2)} s`);
  }
} finally { await browser.close(); }

if (!SAMPLE && !ONLY) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'), '-i', SONG,
    '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
  console.log('done:', OUT);
}
