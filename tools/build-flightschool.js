#!/usr/bin/env node
/* =====================================================================
   Assemble the standalone Flight School site.

   Flight School is a lesson, not a level: a teacher who wants twenty
   students on a coordinate grid for twenty minutes should not have to
   hand out a link to the whole of KORO — the planet, the shops, the
   multiplayer, the sign-in — and then tell everybody to walk to the
   right statue.

   So `flightschool/` is a folder you can drop on any static host and
   open. It has no server, no account, no network. But it must be the
   SAME game, and the surest way to guarantee that is to not have a
   second copy of it: everything shared is copied out of public/ by this
   script and lands in flightschool/vendor/, which nobody edits by hand.
   Fix a bug in the console and both sites get it.

   The stylesheet is lifted whole out of public/index.html rather than
   hand-picked, for the same reason. A curated subset is a subset that
   is wrong the first time somebody adds a rule.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT   = path.join(__dirname, '..');
const SRC    = path.join(ROOT, 'public');
const OUT    = path.join(ROOT, 'flightschool');
const VENDOR = path.join(OUT, 'vendor');

/* The whole dependency list, in load order. school.js needs a console,
   the console needs a compiler, and the walkthrough needs a place to
   draw — that is all of it. */
const SCRIPTS = [
  'lib/three.classic.js',
  'strings.js',
  'program.js',
  'code.js',
  'coach.js',
  'school.js'
];
const ASSETS = ['ships/ship.glb'];

const banner = f => `/* GENERATED — copied from public/${f} by tools/build-flightschool.js.
   Edit public/${f} and re-run \`npm run build:flightschool\`. */\n`;

function copyScript(rel){
  const to = path.join(VENDOR, rel);
  fs.mkdirSync(path.dirname(to), { recursive:true });
  fs.writeFileSync(to, banner(rel) + fs.readFileSync(path.join(SRC, rel), 'utf8'));
  return rel;
}
function copyAsset(rel){
  const to = path.join(VENDOR, rel);
  fs.mkdirSync(path.dirname(to), { recursive:true });
  fs.copyFileSync(path.join(SRC, rel), to);
  return rel;
}

/* The <style> block out of the game's page, verbatim. */
function css(){
  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  if(!m) throw new Error('public/index.html no longer has a <style> block');
  return `/* GENERATED — the <style> block of public/index.html, verbatim.
   Re-run \`npm run build:flightschool\` after changing it. */\n` + m[1].trim() + '\n';
}

/* One stamp on every tag, so a deploy is never half the old files and half
   the new. It is a hash of what went in rather than a clock or a counter:
   a checkout changes every mtime and a counter has to be remembered, and
   both of those make the site look changed when it is not. */
function stamp(paths){
  const h = crypto.createHash('sha1');
  paths.forEach(p => h.update(fs.readFileSync(p)));
  return h.digest('hex').slice(0, 10);
}

function main(){
  fs.rmSync(VENDOR, { recursive:true, force:true });
  fs.mkdirSync(VENDOR, { recursive:true });

  SCRIPTS.forEach(copyScript);
  ASSETS.forEach(copyAsset);
  fs.writeFileSync(path.join(VENDOR, 'koro.css'), css());

  /* Everything a browser could be holding a stale copy of: the files that
     came out of public/, and the two this folder writes itself. Without
     those last two, editing app.js alone leaves the stamp unmoved and the
     old file cached. */
  const v = stamp(SCRIPTS.concat(ASSETS, ['index.html']).map(f => path.join(SRC, f))
              .concat([path.join(OUT, 'app.js'), path.join(OUT, 'ship.js')]));
  const page = path.join(OUT, 'index.html');
  let html = fs.readFileSync(page, 'utf8');
  const before = html;
  html = html.replace(/\?v=[0-9a-f]+/g, '?v=' + v)
             .replace(/window\.ASSETV='[0-9a-f]+'/, `window.ASSETV='${v}'`);
  if(html !== before) fs.writeFileSync(page, html);

  console.log(`flightschool/ built — ${SCRIPTS.length} scripts, `
            + `${ASSETS.length} assets, stylesheet, v=${v}`);
}
main();
