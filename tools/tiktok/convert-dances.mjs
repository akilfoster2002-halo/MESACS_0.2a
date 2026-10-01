/* Mixamo dance FBXs (animations/Dances, from ~/mixamo-mcp/tools/dances.py)
   into clip-only glbs the rig can play on any character, plus dances.json.

     node convert-dances.mjs

   Uses glb files/fbx2clip.js, the converter the game's own clips went
   through: no mesh, Mixamo bone names, a hundredth scale like every
   character. Already-converted files are skipped. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const SRC = path.join(root, 'animations/Dances'), OUT = path.join(here, 'dances');
fs.mkdirSync(OUT, { recursive: true });
const list = [];
for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith('.fbx')).sort()) {
  const out = path.join(OUT, f.replace(/\.fbx$/, '.glb'));
  let line = '';
  if (!fs.existsSync(out)) {
    try { line = execFileSync('node', [path.join(root, 'glb files/fbx2clip.js'), path.join(SRC, f), out], { cwd: path.join(root, 'glb files') }).toString(); }
    catch (e) { console.error('skip', f, e.message.split('\n')[0]); continue; }
  }
  const [, id, slug] = f.match(/^(\d+)-(.+)\.fbx$/) || [];
  const dur = +((line.match(/dur ([\d.]+)s/) || [])[1] || 0) || (list.find((x) => x.file === path.basename(out)) || {}).dur || 0;
  list.push({ file: path.basename(out), id, name: slug.replace(/-/g, ' '), dur });
}
fs.writeFileSync(path.join(OUT, 'dances.json'), JSON.stringify(list, null, 1));
console.log(`${list.length} dances in ${OUT}`);
