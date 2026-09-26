/* =====================================================================
   PONG ON ITS OWN PAGE.

   public/pong.html is the Pong room without the game around it: no
   planet, no title screen, no sign-in, no server. It loads seven scripts
   instead of sixty and boots straight into a playable game.

   WHAT KEEPS BREAKING IT is not Pong. It is the things the full game
   happened to provide and this page does not, and both bugs found while
   building it had the same shape — silent, and nothing to do with where
   they hurt:

     coder.js reached for #objectives, #keys, #chat and #topbar, which
       belong to the game's HUD. Opening the editor threw halfway through
       show(), so it opened EMPTY and said nothing about why.

     `looks.say` calls uiFont(), which game.js defines. Every say threw a
       ReferenceError inside the VM; the scheduler catches a throwing
       script, kills that thread and carries on, so the symptom was that
       `say "YOU WIN"` went quiet and the `stop all` on the next line never
       ran. The game would not end, and nothing on screen said why.

   So these tests check the seam rather than the game: every file the page
   loads exists, every element the modules expect is on the page, and the
   globals game.js used to supply are supplied here. The game itself is
   covered by pong.test.js, which this page shares outright.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = f => fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const has  = f => fs.existsSync(path.join(__dirname,'..',f));
const PAGE = read('public/pong.html');
const INDEX = read('public/index.html');
const BOOT = read('public/pongboot.js');
const ids = src => new Set([...src.matchAll(/id="([A-Za-z][\w-]*)"/g)].map(m=>m[1]));

test('every script the page loads is a file that exists', ()=>{
  const srcs=[...PAGE.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]);
  assert.ok(srcs.length >= 5, 'the page has stopped loading its own code');
  srcs.forEach(s=>assert.ok(has('public/'+s), `pong.html loads ${s}, which is not there`));
});

test('it loads Pong and nothing that belongs to the planet', ()=>{
  const srcs=[...PAGE.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]);
  ['pong.js','blocks.js','vm.js','coder.js','pongboot.js'].forEach(f=>
    assert.ok(srcs.includes(f), `pong.html does not load ${f}`));
  /* the whole point is that it is small: game.js drags in the planet, the
     missions, sign-in and the rest of the engine */
  ['game.js','planet.js','menu.js','ring.js','stages.js','net.js'].forEach(f=>
    assert.ok(!srcs.includes(f), `pong.html loads ${f} — it is not standalone any more`));
  assert.ok(srcs.length <= 10, `${srcs.length} scripts is not a standalone page`);
});

test('every element the room and the editor need is on the page', ()=>{
  /* TAKEN FROM THE GAME'S OWN MARKUP rather than listed here, so a new
     panel added to either block is required of this page too instead of
     quietly missing. */
  const block = (src, start) => {
    const i = src.indexOf(start);
    assert.ok(i > 0, 'index.html no longer has '+start);
    return src.slice(i, src.indexOf('</div>', src.indexOf('\n</div>', i)) + 6);
  };
  const need = new Set([
    ...ids(block(INDEX, '<div id="coder" class="hidden">')),
    ...ids(block(INDEX, '<div id="pong" class="hidden">'))
  ]);
  const got = ids(PAGE);
  for(const id of need)
    assert.ok(got.has(id), `#${id} is in the game's markup and not in pong.html`);
  assert.ok(got.has('view'), 'there is no canvas to render into');
});

test('the globals game.js used to provide are provided here', ()=>{
  /* uiFont is the one that bit: say() calls it, the VM swallows the throw,
     and the game silently stops ending. */
  assert.match(BOOT, /window\.uiFont\s*=/, 'nothing defines uiFont, so every `say` throws');
  assert.match(BOOT, /window\.G\s*=/, 'nothing defines G');
  /* the fields pong.js and vm.js actually read off it */
  ['scene','camera','roomGroup','solids','hits','keys','pos','running','room']
    .forEach(k=>assert.ok(new RegExp('\\b'+k+'\\s*:').test(BOOT),
      `G has no ${k} — the module that reads it will throw or misbehave`));
});

test('the editor does not require a HUD that is not there', ()=>{
  /* It used to reach straight for the game's panels and throw on a page
     that has none, leaving the editor open and empty. */
  const coder=read('public/coder.js');
  ['#objectives','#keys','#chat','#topbar'].forEach(sel=>{
    const bad=new RegExp("\\$\\('"+sel+"'\\)\\.classList");
    assert.ok(!bad.test(coder),
      `coder.js still dereferences ${sel} — it throws on any page without one`);
  });
  assert.match(coder, /const put = \(sel, away\) =>/, 'the guarded helper is gone');
});

test('the page boots itself, with no game to start it', ()=>{
  assert.match(BOOT, /PONG\.start\(\)/,        'nothing starts Pong');
  assert.match(BOOT, /requestAnimationFrame/,  'there is no frame loop');
  assert.match(BOOT, /PONG\.tick\(/,           'the frame loop never ticks the room');
  assert.match(BOOT, /addEventListener\('keydown'/, 'the keyboard is never read');
  /* a key still held when the tab loses focus is a paddle that walks into
     the wall by itself */
  assert.match(BOOT, /addEventListener\('blur'/, 'held keys are never released');
});

test('the two pages share one stylesheet', ()=>{
  assert.ok(has('public/app.css'), 'app.css is gone');
  [['index.html', INDEX], ['pong.html', PAGE]].forEach(([name, src])=>
    assert.match(src, /<link rel="stylesheet" href="app\.css\?v=\d+">/,
      `${name} does not link the shared stylesheet`));
  /* and neither has quietly grown a copy of it back */
  const big=/<style[^>]*>([\s\S]*?)<\/style>/g;
  [...PAGE.matchAll(big)].forEach(m=>assert.ok(m[1].length < 4000,
    'pong.html has an inline stylesheet again — two copies will drift'));
});

test('both pages are versioned together', ()=>{
  /* bump.js writes every page. One left behind hands a browser a new
     stylesheet on one page and last week’s on the other. */
  const v = src => [...new Set([...src.matchAll(/\?v=(\d+)/g)].map(m=>m[1]))];
  const a = v(INDEX), b = v(PAGE);
  assert.strictEqual(a.length, 1, 'index.html has mixed versions: '+a.join(', '));
  assert.strictEqual(b.length, 1, 'pong.html has mixed versions: '+b.join(', '));
  assert.strictEqual(a[0], b[0],
    `index.html is at v=${a[0]} and pong.html at v=${b[0]} — bump.js is missing a page`);
  assert.match(read('tools/bump.js'), /'index\.html', 'pong\.html'/,
    'bump.js no longer knows about both pages');
});

test('the site serves the game at its root, and Pong at /pong', ()=>{
  /* THE ROOT USED TO BE PONG. It was a deliberate route — `routes` are
     evaluated ahead of the filesystem, which is the only way to put a page
     in front of public/index.html, which already sits at `/` — and it meant
     that somebody sent the site's address got a paddle game and no way to
     tell that the rest of it was there. The game is the site; Pong is a
     lesson in it, and lessons have their own address.

     STILL NOT A `rewrite`. A rewrite for a path a static file already
     occupies never fires, and routes may not be combined with rewrites at
     all — which is why /pong and the API forward are both routes. */
  const v=JSON.parse(read('vercel.json'));
  assert.ok(Array.isArray(v.routes), 'vercel.json has no routes');
  assert.ok(!v.routes.some(r=>r.src==='/'),
    'something is being served in front of the game at the root again');
  assert.deepStrictEqual(v.routes.find(r=>r.dest==='/pong.html'),
    { src:'/pong', dest:'/pong.html' }, 'Pong has no address of its own');
  assert.ok(!v.rewrites,
    'a rewrite for / cannot win against public/index.html, and routes may not '+
    'be combined with rewrites');
});

test('it needs no server, no database and no sign-in', ()=>{
  assert.ok(!/api\//.test(PAGE), 'the standalone page calls an API');
  /* the tutor is sign-in gated, so an Ask button here would only ever 401 */
  assert.ok(!/ask\.js/.test(PAGE), 'the page loads the tutor, which cannot work without accounts');
});
