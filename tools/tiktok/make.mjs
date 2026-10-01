/* ONE POST, start to finish: a plan, a stretch of song, the character, the
   filming, and a caption to go with it.

     node make.mjs --type montage --char kofi --seed 7 --out /tmp/p1
     node make.mjs --type arcade --char zuri --cab snake --out /tmp/p2 --sample

   Types: montage, showcase, arcade, intro, pov, tour (see RECIPES).
   Writes <out>/video.mp4 and <out>/post.json ({ caption, title, type, char }).
   Needs the game running under `npm run dev` on 8799. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { open, start, hold, clean, server, FFMPEG } from './rig.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SAMPLE = process.argv.includes('--sample');
const FPS = 30, DUR = 15;

// ------------------------------------------------------------- a seeded die
let seed = +arg('seed', Date.now() % 100000);
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ang = () => Math.floor(rnd() * 3);

// who can be filmed: the five you pick from, Robin from TSH, and the walk-ons from TSH's pavements
export const CHARS = { nia: 'Nia', sable: 'Sable', kofi: 'Kofi', theo: 'Theo', zuri: 'Zuri', robin: 'Robin', 'walk-s': null, 'walk-t': null, 'walk-u': null, 'walk-v': null };
export const CABS = { drop: 'BLOCK DROP', snake: 'SNAKE', breakout: 'BREAKOUT', maze: 'MAZE', hop: 'HOP' };
export const TYPES = ['montage', 'squad', 'mech', 'city', 'danceoff', 'showcase', 'arcade', 'intro', 'pov', 'tour'];

const type = arg('type', pick(TYPES));
const char = arg('char', pick(Object.keys(CHARS)));
const name = CHARS[char] || 'a player';
const OUT = path.resolve(arg('out', path.join(os.tmpdir(), 'koro-post')));
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.startsWith('sample-')) fs.rmSync(path.join(OUT, f));

// ------------------------------------------------------------- the song
/* The loudest fifteen seconds that start on a bar, give or take: every bar
   start is scored by how loud the fifteen seconds after it are, and one of
   the top few is taken, so the same song does not give the same cut twice. */
const songs = fs.readdirSync(path.join(here, 'songs')).filter((f) => f.endsWith('.mp3'));
const song = arg('song', pick(songs));
const map = JSON.parse(fs.readFileSync(path.join(here, 'songs', song.replace(/\.mp3$/, '.beats.json')), 'utf8'));
const bars = map.beats.map((b, i) => ({ ...b, i })).filter((b) => b.bar && b.t + DUR < map.duration - 0.3);
const score = (b) => { const w = map.beats.filter((x) => x.t >= b.t && x.t < b.t + DUR); return w.reduce((s, x) => s + x.loud, 0) / w.length; };
const ranked = bars.map((b) => ({ b, s: score(b) })).sort((x, y) => y.s - x.s);
const from = (arg('at') ? bars.find((b) => Math.abs(b.t - +arg('at')) < 0.3) : pick(ranked.slice(0, 4)).b);
const t0 = from.t;
const win = map.beats.filter((b) => b.t >= t0 - 1e-6 && b.t < t0 + DUR + 0.5);
const B = win.map((b) => b.t - t0), LOUD = win.map((b) => b.loud);
const N = B.filter((t) => t < DUR).length;          // beats in the clip
const CARD = N - Math.max(5, Math.round(2.2 / map.beat));

// ------------------------------------------------------------- the recipes
/* Each returns { shots: [{ shot, opts, n }], captions, caption, title } where
   n is how many beats the shot holds (the rest are shared out to fill), and
   captions are the words on screen, in beats. */
// the Garden and the Stepping Stone are all trees: no camera gets a clean look at anyone on them
const ISLES = ['falls', 'spire'];
const POVS = [
  ['POV: your home planet has a mech in the garage', ['seraph', 'mechfight', 'mechfight']],
  ['POV: you finished your homework and logged into KORO', ['squad', 'hangout', 'arcade']],
  ['POV: the ocean in this game goes all the way down', ['swim', 'dive', 'dive']],
  ['POV: you found the arcade in the clouds', ['fly', 'neon', 'arcade']],
  ['POV: it is 2am and the whole squad is still online', ['hangout', 'squad', 'crew']],
  ['POV: you and your mech vs. the whole map', ['mechfight', 'seraph', 'mechfight']],
  ['POV: the new girl can climb anything', ['climb', 'climb', 'rooftop']],
  ['POV: your friends said meet on the roof', ['climb', 'rooftop', 'rooftop']],
  ['POV: someone said dance battle in chat', ['hangout', 'crew', 'crew']],
];
const RECIPES = {
  // any shots, in order: --shots squad,hangout,mechfight (for trying things out)
  custom() {
    return { shots: arg('shots').split(',').map((x) => { const [shot, a] = x.split(':'); return { shot, opts: { angle: +(a || 0), spot: +(a || 0) } }; }),
      captions: [], title: 'KORO', caption: 'KORO.' };
  },
  montage() {
    // one of each kind of thing, never the same twice, the arcade last before the card
    const pool = shuffle(['dive', 'mechfight', 'climb', 'rooftop', 'squad', 'hangout', 'crew', 'fly', 'island', 'seraph']).slice(0, 5);
    const shots = pool.map((s) => ({ shot: s, opts: { angle: ang(), spot: ang(), id: pick(ISLES), fly: rnd() < 0.4 } }));
    shots.push({ shot: 'neon' }, { shot: 'arcade', opts: { cab: pick(Object.keys(CABS)) } });
    return { shots, captions: [], title: `KORO: one night, everything`,
      caption: pick([`Mechs, rooftops, the reef, the arcade in the clouds, and your friends online for all of it. All real gameplay.`,
        `One night in KORO: climb the city, fight in a mech, dive the reef, then everybody meets in Neon.`,
        `Everything you can do in one night in KORO, with whoever is online.`]) };
  },
  squad() {
    const shots = [{ shot: 'squad', opts: { angle: ang(), spot: ang() } }, { shot: 'hangout', opts: { angle: ang(), spot: ang() } }, { shot: 'squad', opts: { angle: ang(), fly: true, spot: ang() } }, { shot: 'crew', opts: { angle: ang(), spot: ang() } }];
    return { shots, captions: [{ text: pick(['Bring your friends. All of them.', 'Nobody plays KORO alone', 'The squad when the server goes live']), b0: 0, b1: 8 }],
      title: 'KORO: the squad', caption: pick(['Run, fly and hang out with your friends on Wano. Everybody you see is somebody playing.', 'KORO is better with the squad: race to the Falls, talk trash, start a dance-off.']) };
  },
  mech() {
    const shots = [{ shot: 'mechfight', opts: { angle: 0, spot: ang() } }, { shot: 'mechfight', opts: { angle: 2, spot: ang() } }, { shot: 'seraph', opts: { angle: ang(), spot: ang() } }, { shot: 'mechfight', opts: { angle: pick([0, 2]), spot: ang() } }];
    return { shots, captions: [{ text: pick(['Vanguard vs Seraph', 'Mech fight at Kit\'s', 'Pick your mecha']), b0: 0, b1: 8 }],
      title: 'KORO: mech fight', caption: pick(['Buy a mecha from Kit, take it outside, and settle it. Vanguard or Seraph?', 'Mega jump. Ground slam. Every player can pilot one.']) };
  },
  city() {
    const shots = [{ shot: 'climb', opts: { spot: ang() } }, { shot: 'rooftop', opts: { spot: ang() } }, { shot: 'climb', opts: { spot: ang() + 1 } }, { shot: 'rooftop', opts: { spot: ang() + 1 } }];
    return { shots, captions: [{ text: pick(['Robin can climb anything', 'Gecko cuffs: on', 'The city is a playground']), b0: 0, b1: 8 }],
      title: 'KORO: TSH, the city', caption: pick(['Robin\'s Gecko cuffs climb any wall in the city. The roofs are the fast way home.', 'TSH: a whole city at night. Climb it, run the roofs, stay off the cameras.']) };
  },
  danceoff() {
    const shots = [{ shot: 'hangout', opts: { angle: ang(), talk: 4 } }, { shot: 'crew', opts: { angle: 0, move: 'dance' } }, { shot: 'crew', opts: { angle: 1, move: 'salsa' } }, { shot: 'crew', opts: { angle: 0, move: 'flip' } }];
    return { shots, captions: [{ text: pick(['Dance battle. Go.', 'Who won this?', 'Every emote, every character']), b0: 0, b1: 8 }],
      title: 'KORO: dance battle', caption: 'Somebody said dance battle in chat. Who won?' };
  },
  showcase() {
    const scene = pick(['seraph', 'dive', 'fly', 'seraph']);
    const hooks = { seraph: ['You get a mech. A real one.', 'Wait for the mech...'], dive: ['The sea goes down 80 metres', 'Nobody told me you could dive'], fly: ['You can just... fly', 'Flying in KORO hits different'] };
    const shots = [0, 1, 2].map((a) => ({ shot: scene, opts: { angle: a, spot: a, climb: a === 2 } }));
    return { shots, captions: [{ text: pick(hooks[scene]), b0: 0, b1: 8 }], title: `KORO: ${scene === 'seraph' ? 'the Seraph' : scene === 'dive' ? 'the deep' : 'flight'}`,
      caption: { seraph: `${name} and the Seraph. Every player can pilot one.`, dive: `${name} diving the reef on Wano. The ocean is a whole map of its own.`, fly: `${name} flying low over Wano. No loading screens, just take off.` }[scene] };
  },
  arcade() {
    const cab = arg('cab', pick(Object.keys(CABS)));
    return { shots: [{ shot: 'fly', opts: { angle: 1, climb: true }, n: 6 }, { shot: 'neon', n: 6 }, { shot: 'arcade', opts: { cab } }],
      captions: [{ text: 'There is an arcade in the clouds', b0: 0, b1: 12 }, { text: `${CABS[cab]}. Playable.`, b0: 12, b1: CARD }],
      title: `KORO: ${CABS[cab]} in Neon`,
      caption: `Fly up to Neon, walk in, play ${CABS[cab]}. Real cabinets, real high scores. ${name} is on the board.` };
  },
  intro() {
    if (!CHARS[char]) return RECIPES.squad();
    const shots = [{ shot: 'dance', opts: { angle: 0, move: 'dance' }, n: 8 }, { shot: 'sprint', opts: { angle: ang() } }, { shot: 'fly', opts: { angle: ang() } }, { shot: pick(['swim', 'dive', 'seraph']), opts: { angle: ang() } }, { shot: 'dance', opts: { angle: 2, move: pick(['salsa', 'flip', 'dance']) } }];
    return { shots, captions: [{ text: `Meet ${name}`, b0: 0, b1: 8 }], title: `Meet ${name}`,
      caption: `Meet ${name}. Who are you playing as in KORO?` };
  },
  pov() {
    const [hook, set] = pick(POVS);
    return { shots: set.map((s, a) => ({ shot: s, opts: { angle: (a + ang()) % 3, spot: a, cab: pick(Object.keys(CABS)), id: pick(ISLES) } })),
      captions: [{ text: hook, b0: 0, b1: CARD }], title: hook.replace('POV: ', ''), caption: `${hook} 🌌` };
  },
  tour() {
    const order = arg('isles') ? arg('isles').split(',') : shuffle(ISLES);
    const shots = [];
    order.forEach((id, k) => { shots.push({ shot: 'fly', opts: { angle: k % 3, climb: k === 0 } }); shots.push({ shot: 'island', opts: { id, angle: ang(), run: k % 2 === 1 } }); });
    const NAMES = { falls: 'The Falls', garden: 'The Garden', spire: 'The Spire', stone: 'The Stepping Stone' };
    return { shots, captions: [], islands: order.map((id) => NAMES[id]), title: 'KORO: the sky islands',
      caption: `${name} island-hopping over Wano: ${order.map((id) => NAMES[id]).join(', ')}. Every one is a place you can land.` };
  },
};

// ------------------------------------------------------------- the plan in beats
const R = RECIPES[type]();
const fixed = R.shots.reduce((s, x) => s + (x.n || 0), 0);
const free = R.shots.filter((x) => !x.n).length;
let each = free ? Math.max(2, Math.floor((CARD - fixed) / free)) : 0;
let b = 0;
const plan = R.shots.map((x, k) => {
  const n = x.n || each;
  const p = { shot: x.shot, opts: x.opts || {}, b0: b, b1: k === R.shots.length - 1 ? CARD : Math.min(CARD, b + n), flash: k ? 0.5 : 0, punch: k ? 0.6 : 0 };
  b = p.b1;
  return p;
}).filter((p) => p.b1 > p.b0);
plan.push({ shot: 'card', b0: CARD, b1: N + 1, flash: 0.7, punch: 0.6 });
// the tour names each island as it lands on it
if (R.islands) { let j = 0; for (const p of plan) if (p.shot === 'island') R.captions.push({ text: R.islands[j++], b0: p.b0, b1: p.b1 }); }
const look = { captions: R.captions, card: { b0: CARD, big: 'KORO', line1: 'FREE TO PLAY', line2: 'link in bio' }, pulse: 0.8 };
console.log(`${type} as ${name} on ${song} from ${t0.toFixed(2)} s, ${N} beats:`, plan.map((p) => `${p.shot}[${p.b0}-${p.b1}]`).join(' '));

// ------------------------------------------------------------- film it
const frames = path.join(OUT, 'frames');
fs.rmSync(frames, { recursive: true, force: true });
fs.mkdirSync(frames, { recursive: true });
const bt = (i) => (i < B.length ? B[i] : B[B.length - 1] + (i - B.length + 1) * map.beat);
const dev = await server();
const { browser, page } = await open();
try {
  await start(page);
  await page.evaluate(() => { for (let i = 0; i < 60; i++) window.__step(16.7); });
  await page.evaluate(() => { const s = [...document.querySelectorAll('a,button')].find((b) => /skip the walkthrough/i.test(b.textContent)); if (s) s.click(); });
  await hold(page);
  await clean(page);
  // who we are: the body is swapped in place and loads in the background
  // setCast, not pick: the dev server remembers whoever was picked last and puts them back
  await page.evaluate((c) => { window.__oldBody = AVATAR.body; window.__who = c; AVATAR.setCast(c); }, char);
  // keep the clock going while the new body downloads: attach() finishes on a frame
  for (let k = 0; k < 120; k++) {
    await page.evaluate(() => { for (let i = 0; i < 5; i++) window.__step(1000 / 30); });
    if (await page.evaluate(() => !!AVATAR.body && AVATAR.body !== window.__oldBody)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__step(1000 / 30); });
  await page.addScriptTag({ content: fs.readFileSync(path.join(here, 'lib.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(here, 'fx.js'), 'utf8') });
  const shots = await page.evaluate((p) => PLAN(p), plan);
  await page.evaluate((o) => FX.init(o), { beats: B, loud: LOUD, look });
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const f0 = Math.round(bt(s.b0) * FPS), f1 = i === shots.length - 1 ? DUR * FPS : Math.round(bt(s.b1) * FPS);
    await page.evaluate((i) => FX.setup(i), i);
    await page.evaluate((n) => { for (let k = 0; k < n; k++) window.__step(1000 / 30); }, s.pre);
    if (s.start) { await page.keyboard.press(s.start); await page.evaluate(() => { for (let k = 0; k < 4; k++) window.__step(1000 / 30); }); await page.keyboard.press('Digit1'); }
    const want = SAMPLE ? new Set([f0 + 3, Math.round((f0 + f1) / 2), f1 - 1]) : null;
    for (let f = f0; f < f1; f++) {
      const T = f / FPS;
      // cabinets listen to the window, not to G.keys: real keys, a new ball now and then, and the paddle moving
      if (s.arcade) { if (f === f0 || f % 20 === 0) await page.keyboard.press('Space'); await page.keyboard.down(pick(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])); }
      await page.evaluate((i, u, T) => FX.frame(i, u, T), i, (f - f0) / Math.max(1, f1 - f0), T);
      if (s.arcade) for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) await page.keyboard.up(k);
      if (want && !want.has(f)) continue;
      const file = SAMPLE ? path.join(OUT, `sample-${i + 1}-${s.name}-${T.toFixed(2)}.jpg`) : path.join(frames, `${String(f).padStart(5, '0')}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: SAMPLE ? 70 : 90 });
    }
  }
} finally { await browser.close(); if (dev) dev.kill(); }

// ------------------------------------------------------------- the file and the words
const TAGS = ['#KORO', '#gaming', '#gamedev', '#indiegame', '#indiedev', '#gameplay', '#openworld', '#fyp'];
const EXTRA = { custom: ['#gaming'], squad: ['#multiplayer', '#squad', '#friends'], mech: ['#mecha', '#robot', '#mechfight'], city: ['#parkour', '#cyberpunk', '#nightcity'], danceoff: ['#dancebattle', '#emotes', '#multiplayer'], montage: ['#mecha', '#arcade', '#metaverse'], showcase: ['#mecha', '#robot', '#gamingclips'], arcade: ['#arcade', '#retrogaming', '#highscore'],
  intro: ['#characterdesign', '#whoareyou', '#avatar'], pov: ['#pov', '#relatable', '#gamerlife'], tour: ['#floatingislands', '#exploration', '#cozygames'] };
const post = { type, char, song, at: +t0.toFixed(2), title: R.title.slice(0, 80),
  caption: `${R.caption}\nKORO is free to play. Waitlist in bio.\n\n${[...TAGS.slice(0, 5), ...EXTRA[type], ...TAGS.slice(5)].join(' ')}` };
fs.writeFileSync(path.join(OUT, 'post.json'), JSON.stringify(post, null, 1));
if (!SAMPLE) {
  const clip = path.join(OUT, 'song.mp3');
  execFileSync(FFMPEG, ['-y', '-v', 'error', '-ss', String(t0), '-t', String(DUR), '-i', path.join(here, 'songs', song), '-af', `afade=t=out:st=${DUR - 0.7}:d=0.7`, clip]);
  execFileSync(FFMPEG, ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'), '-i', clip,
    '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k',
    '-shortest', '-movflags', '+faststart', path.join(OUT, 'video.mp4')], { stdio: 'inherit' });
  fs.rmSync(frames, { recursive: true, force: true });
  fs.rmSync(clip, { force: true });
}
console.log('wrote', OUT);
