/* HAND THE DAY TO METRICOOL: today's videos go up to the public
   akilfoster2002-halo/koro-clips repo as one commit that replaces everything
   there (so the repo never grows), and each post in day.json gets the raw
   URL Metricool fetches from. Metricool copies the file when the post is
   scheduled, so tomorrow's run is free to wipe it.

     node publish.mjs --day /tmp/koro-day-2026-09-30 [--repo <checkout of koro-clips>]

   Without --repo it clones into a temp folder. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DAY = path.resolve(arg('day'));
const OWNER = 'akilfoster2002-halo', REPO = 'koro-clips';
const meta = JSON.parse(fs.readFileSync(path.join(DAY, 'day.json'), 'utf8'));
const git = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

let dir = arg('repo');
if (!dir) {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'koro-clips-'));
  execFileSync('git', ['clone', '--depth', '1', `https://github.com/${OWNER}/${REPO}.git`, dir], { stdio: 'inherit' });
}
// a fresh branch with nothing in it but today
git(dir, 'checkout', '--orphan', `day-${meta.date}`);
try { git(dir, 'rm', '-rf', '--quiet', '.'); } catch { /* empty already */ }
for (const f of fs.readdirSync(dir)) if (f !== '.git') fs.rmSync(path.join(dir, f), { recursive: true, force: true });
fs.writeFileSync(path.join(dir, 'README.md'), `# KORO clips, ${meta.date}\n\nToday's TikTok videos, handed to Metricool by URL. Replaced every day.\n`);
for (const p of meta.posts) {
  if (p.failed) continue;
  const name = `${meta.date}-${p.n}-${p.type}-${p.char}.mp4`;
  fs.copyFileSync(path.join(DAY, p.file), path.join(dir, name));
  p.url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${name}`;
}
git(dir, 'add', '-A');
git(dir, '-c', 'user.name=KORO clips', '-c', 'user.email=234659250+akilfoster2002-halo@users.noreply.github.com', 'commit', '-q', '-m', `Clips for ${meta.date}`);
git(dir, 'push', '-q', '-f', 'origin', `day-${meta.date}:main`);
fs.writeFileSync(path.join(DAY, 'day.json'), JSON.stringify(meta, null, 1));
// and check each one is really there before anybody schedules it
for (const p of meta.posts.filter((x) => x.url)) {
  let ok = false;
  for (let i = 0; i < 20 && !ok; i++) { ok = (await fetch(p.url, { method: 'HEAD' })).ok; if (!ok) await new Promise((r) => setTimeout(r, 3000)); }
  console.log(ok ? 'up  ' : 'MISSING', p.url);
}
