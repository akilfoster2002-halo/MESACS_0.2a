/* A DAY OF POSTS: fifteen, one an hour from 8am to 10pm New York, no two alike.

     node day.mjs --date 2026-09-30 --out /tmp/day    # plan and film all eight
     node day.mjs --date 2026-09-30 --plan            # print the plan only

   Every type at least once, two more on top; five characters shared out so
   nobody leads twice in a row; the two songs taken in turn; seeds from the
   date, so a rerun of a day makes the same day. Writes <out>/<n>/video.mp4,
   <out>/<n>/post.json, and <out>/day.json with a posting time for each. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const date = arg('date', new Date().toISOString().slice(0, 10));
const OUT = path.resolve(arg('out', `/tmp/koro-day-${date}`));
let seed = [...date].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const TYPES = ['montage', 'squad', 'mech', 'city', 'danceoff', 'showcase', 'arcade', 'intro', 'pov', 'tour'];
const CHARS = ['nia', 'sable', 'kofi', 'theo', 'zuri', 'robin', 'walk-s', 'walk-t', 'walk-u', 'walk-v'];
const CABS = ['drop', 'snake', 'breakout', 'maze', 'hop'];
const SONGS = fs.readdirSync(path.join(here, 'songs')).filter((f) => f.endsWith('.mp3'));
// posting times, New York: spread from breakfast to late night
const TIMES = Array.from({ length: 15 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`);

// FRIENDS IN EVERYTHING: the day is built from the types where other players
// are in the shot (squads, dance-offs, mech fights with a crowd, multiplayer
// POVs, montages), with one solo type a day for variety.
const FRIENDLY = ['squad', 'danceoff', 'mech', 'pov', 'montage', 'squad', 'danceoff', 'mech', 'pov', 'montage', 'squad', 'danceoff', 'city', 'montage'];
const types = shuffle([...FRIENDLY, shuffle(['arcade', 'tour', 'showcase', 'intro'])[0]]);
for (let i = 1; i < types.length; i++) if (types[i] === types[i - 1]) [types[i], types[(i + 2) % types.length]] = [types[(i + 2) % types.length], types[i]];
const chars = [...shuffle(CHARS), ...shuffle(CHARS)];
const cabs = shuffle(CABS);
const posts = types.map((type, n) => ({ n: n + 1, type, char: chars[n], song: SONGS[Math.floor(rnd() * SONGS.length)], cab: cabs[n % cabs.length], seed: Math.floor(rnd() * 1e6), time: TIMES[n] }));

posts.splice(+arg('count', posts.length));
// --slot n: only the nth post of the day (the cloud makes one per run)
if (arg('slot')) posts.splice(0, posts.length, ...posts.filter((p) => p.n === +arg('slot')));
if (process.argv.includes('--plan')) { console.table(posts); process.exit(0); }
fs.mkdirSync(OUT, { recursive: true });
const done = [];
for (const p of posts) {
  const dir = path.join(OUT, String(p.n));
  const t = Date.now();
  try {
    execFileSync('node', [path.join(here, 'make.mjs'), '--type', p.type, '--char', p.char, '--song', p.song, '--cab', p.cab, '--seed', String(p.seed), '--out', dir], { stdio: ['ignore', 'inherit', 'inherit'] });
    done.push({ ...p, ...JSON.parse(fs.readFileSync(path.join(dir, 'post.json'), 'utf8')), file: `${p.n}/video.mp4`, secs: Math.round((Date.now() - t) / 1000) });
  } catch (e) {
    console.error(`post ${p.n} (${p.type}) failed:`, e.message);
    done.push({ ...p, failed: true });
  }
  fs.writeFileSync(path.join(OUT, 'day.json'), JSON.stringify({ date, posts: done }, null, 1));
}
console.log(`day ${date}: ${done.filter((d) => !d.failed).length}/${posts.length} made, in ${OUT}`);
