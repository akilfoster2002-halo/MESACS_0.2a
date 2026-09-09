/* The standalone site is a COPY, and a copy is a thing that goes stale.

   flightschool/vendor/ is filled by tools/build-flightschool.js out of
   public/. That is the design — one source of truth for the console, the
   compiler, the walkthrough and the mission — but it only holds if the copy
   in the repository is actually the copy the script would make. Fix a bug in
   public/code.js, forget to run the build, and the standalone site keeps the
   bug: same game everywhere except the one place a whole class is sitting.

   So this fails if anybody commits public/ without rebuilding. The fix it is
   asking for is always `npm run build:flightschool`. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const SRC    = path.join(ROOT, 'public');
const OUT    = path.join(ROOT, 'flightschool');
const VENDOR = path.join(OUT, 'vendor');

const REBUILD = 'run `npm run build:flightschool`';

/* the list the build script works from, read from the build script, so the
   two cannot disagree about what the site is made of */
function manifest(){
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'build-flightschool.js'), 'utf8');
  const grab = name => {
    const m = src.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];'));
    assert.ok(m, `the build script no longer declares ${name}`);
    return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  };
  return { scripts: grab('SCRIPTS'), assets: grab('ASSETS') };
}

test('every file the site is built from is still in public/', ()=>{
  const { scripts, assets } = manifest();
  scripts.concat(assets).forEach(f =>
    assert.ok(fs.existsSync(path.join(SRC, f)), `public/${f} is gone — the build would fail`));
});

test('the vendored scripts are what public/ says today', ()=>{
  manifest().scripts.forEach(f => {
    const to = path.join(VENDOR, f);
    assert.ok(fs.existsSync(to), `flightschool/vendor/${f} is missing — ${REBUILD}`);
    const copied = fs.readFileSync(to, 'utf8').replace(/^\/\* GENERATED[\s\S]*?\*\/\n/, '');
    assert.strictEqual(copied, fs.readFileSync(path.join(SRC, f), 'utf8'),
      `flightschool/vendor/${f} is behind public/${f} — ${REBUILD}`);
  });
});

test('the vendored assets are byte-for-byte the ones public/ ships', ()=>{
  manifest().assets.forEach(f => {
    const to = path.join(VENDOR, f);
    assert.ok(fs.existsSync(to), `flightschool/vendor/${f} is missing — ${REBUILD}`);
    assert.ok(fs.readFileSync(to).equals(fs.readFileSync(path.join(SRC, f))),
      `flightschool/vendor/${f} is behind public/${f} — ${REBUILD}`);
  });
});

test('the stylesheet is the game\'s own, whole', ()=>{
  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(m, 'public/index.html no longer has a <style> block');
  const css = fs.readFileSync(path.join(VENDOR, 'koro.css'), 'utf8')
    .replace(/^\/\* GENERATED[\s\S]*?\*\/\n/, '');
  assert.strictEqual(css.trim(), m[1].trim(),
    `flightschool/vendor/koro.css is behind public/index.html — ${REBUILD}`);
});

test('every tag on the page carries the same stamp', ()=>{
  const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  const vs = new Set([...html.matchAll(/\?v=([0-9a-f]+)/g)].map(m => m[1]));
  const assetv = html.match(/window\.ASSETV='([0-9a-f]+)'/);
  assert.ok(assetv, 'the page no longer sets ASSETV');
  vs.add(assetv[1]);
  assert.strictEqual(vs.size, 1,
    `mixed versions on the page (${[...vs].join(', ')}) — ${REBUILD}`);
});

test('the standalone site reaches for nothing outside its own folder', ()=>{
  /* It has to work off a USB stick and a school web share. One ../ or one
     https:// and it works here and nowhere else. */
  for(const f of ['index.html', 'app.js', 'ship.js']){
    const src = fs.readFileSync(path.join(OUT, f), 'utf8');
    for(const url of [...src.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])){
      assert.ok(!/^(https?:)?\/\//.test(url), `${f} loads ${url} off the network`);
      assert.ok(!url.startsWith('../'), `${f} reaches outside the folder for ${url}`);
    }
    assert.ok(!/['"]\.\.\//.test(src), `${f} reaches outside the folder`);
  }
});

test('the host fills in every hole school.js expects the game to fill', ()=>{
  const app = fs.readFileSync(path.join(OUT, 'app.js'), 'utf8');
  /* PROGRESS is the sharp one: school.js hands the LAST level to it, and
     falls through to "start the next level" when it is absent — and the
     level after the last one is the last one, forever. */
  for(const hole of ['window.G', 'window.keyHint', 'window.PROGRESS', 'CODE.onRun'])
    assert.ok(app.includes(hole), `app.js no longer provides ${hole}`);
  const ship = fs.readFileSync(path.join(OUT, 'ship.js'), 'utf8');
  assert.match(ship, /window\.SHOP\s*=/, 'school.js asks for SHOP.model()');
});
