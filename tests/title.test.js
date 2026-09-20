/* THE LANDING SCREEN, AND THE THINGS THAT WENT WITH IT.

   Three separate regressions live here, and none of them would fail a
   playthrough — they would just look wrong:

     the photograph   the first screen used to be a JPEG of blocky figures in
                      a meadow. Nothing in this game looks like that, and the
                      file is gone; what has to stay gone is the markup and
                      the CSS that referenced it, because a half-removed
                      backdrop is a black rectangle over the planet.

     the planet's name
                      KORO is the GAME. Senio is the planet you land on. They
                      were the same word for a long time, so every rename is
                      one somebody can undo by accident in either direction —
                      and the two live three lines apart in some files.

     the phantom gun  the first-person blaster hangs off the CAMERA, and the
                      camera draws every frame whether a menu is over it or
                      not. Its visibility used to be set inside step(), which
                      stops running the moment a mission ends, so it kept
                      whatever it had — and a blaster floated across the title
                      screen for the quarter-second a screen spends fading.
                      The fix is that exactly one place decides it, once a
                      frame. A second place deciding it is the bug coming
                      back.
*/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const exists = f => fs.existsSync(path.join(__dirname, '..', f));

/* ------------------------------------------------- the photo is gone */

test('the landing screen has no photograph left in it', ()=>{
  assert.ok(!exists('public/art/landing.jpg'),
    'the blocky-characters JPEG is back in public/art');
  const html=read('public/index.html');
  for(const ghost of ['landing.jpg','.bgphoto','class="glint"','class="shimmer',
                      'class="cloud c1"','id="heroView"','class="island"']){
    assert.ok(!html.includes(ghost),
      `index.html still carries "${ghost}" from the old photo backdrop`);
  }
});

test('the landing screen is a live canvas, and it is wired up', ()=>{
  const html=read('public/index.html');
  assert.match(html, /<canvas id="titleView"/, 'no #titleView canvas on the start screen');
  assert.match(html, /src="title\.js/, 'title.js is not loaded by the page');
  /* The planet's lifecycle has to be the landing screen's lifecycle, or it
     keeps drawing a world nobody is looking at. */
  const menu=read('public/menu.js');
  assert.match(menu, /TITLE\.open\(\)/, 'nothing opens the title scene');
  assert.match(menu, /TITLE\.close\(\)/, 'nothing closes the title scene');
});

test('the island renderer went with the island', ()=>{
  const chars=read('public/chars.js');
  assert.ok(!/heroOpen|heroClose|heroStage|heroLoop/.test(chars),
    'chars.js still carries the landing-screen renderer it no longer owns');
  for(const f of ['public/menu.js','public/mech.js'])
    assert.ok(!/CHARS\.hero/.test(read(f)),
      `${f} still calls a CHARS.hero* function that no longer exists`);
});

/* --------------------------------------------- KORO is the game, Senio
   is the planet */

test('the planet is called Senio', ()=>{
  const planet=read('public/planet.js');
  assert.match(planet, /name:'Senio'/, "the hub world's name is not Senio");
  assert.ok(!/name:'KORO'/.test(planet), 'a world is still named KORO');
});

test('nothing tells a player they are flying to KORO', ()=>{
  /* The cruise between worlds prints its destination, and that is the
     planet's name — the one place where getting this wrong is visible in
     flight rather than in a comment. */
  const cruise=read('public/cruise.js');
  assert.ok(!/'KORO'/.test(cruise),
    'cruise.js still names KORO as a destination — that is the game, not the planet');
  assert.match(cruise, /'Senio'/, 'cruise.js does not name Senio as a destination');
  assert.match(read('public/strings.js'), /'Senio':'Senio'/,
    'Senio has no entry in strings.js, so t() will fall through untranslated');
});

test('KORO is still the name of the game', ()=>{
  /* The rename must not have eaten the logo. */
  assert.match(read('public/index.html'), /<h1 class="koro-xl">KORO<\/h1>/,
    'the game title on the landing screen is no longer KORO');
  assert.match(read('public/menu.js'), /textContent='KORO'/,
    'the menu header is no longer the game name');
});

/* ------------------------------------------------------ the phantom gun */

test('exactly one place decides whether the gun is on screen', ()=>{
  const game=read('public/game.js');
  assert.match(game, /carried\(on\)\{[^}]*g\.visible/,
    'GUN has no single carried() owner for its visibility');
  /* update() runs only while you are walking. If it sets visibility again,
     the stale-value bug is back for every screen that stops calling it. */
  const upd=game.slice(game.indexOf('    update(dt, moving){'));
  const body=upd.slice(0, upd.indexOf('\n    }'));
  assert.ok(!/g\.visible/.test(body),
    'GUN.update() sets visibility again — that is the phantom-gun bug returning');
});

test('the gun is put away whenever a full-screen card is up', ()=>{
  const game=read('public/game.js');
  assert.match(game, /GUN\.carried\(\s*G\.running && G\.firstPerson && !overlayUp\(\)\s*\)/,
    'the render loop does not decide the gun from the running/first-person/overlay state');
  assert.match(game, /function overlayUp\(\)/, 'no overlayUp() to ask about screens');
  /* and it must be asked BEFORE the draw, not after it */
  assert.ok(game.indexOf('GUN.carried(') < game.indexOf('G.renderer.render(G.scene,G.camera)'),
    'the gun is decided after the frame is drawn, which is one frame too late');
});

test('the modes that never hand you a gun still put it away', ()=>{
  /* These all used to call update(0,false) purely for the visibility side
     effect that no longer lives there. */
  for(const f of ['public/intro.js','public/mech.js','public/invaders.js',
                  'public/flight.js','public/ring.js']){
    const s=read(f);
    assert.ok(!/GUN\.update\(0,\s*false\)/.test(s),
      `${f} still calls GUN.update(0,false), which no longer hides anything`);
    assert.match(s, /GUN\.carried\(false\)/, `${f} never puts the gun away`);
  }
});

/* ------------------------------------------------------- the typefaces
   A game about writing code is lettered in code type, in three faces that
   each do one job. The ways that quietly breaks are all boring: a font file
   that did not get committed, an @font-face pointing at a name nobody
   renamed, a hand-written stack somewhere that beats the variable, or —
   worst — somebody "fixing" a loading delay by linking a font CDN, which
   would break the one promise this repo makes about running from a folder. */

const FACES = { 'Space Mono':'--font-disp', 'Ubuntu Mono':'--font',
                'JetBrains Mono':'--font-code' };

test('every font the stylesheet asks for is actually in the repo', ()=>{
  const html=read('public/index.html');
  const srcs=[...html.matchAll(/url\('(fonts\/[^']+)'\)/g)].map(m=>m[1]);
  assert.ok(srcs.length>=4, `only ${srcs.length} @font-face sources — expected the full set`);
  for(const rel of srcs){
    const f='public/'+rel;
    assert.ok(exists(f), `@font-face points at ${rel}, which is not in the repo`);
    /* A woff2 begins "wOF2". A LFS pointer or a 404 saved to disk does not,
       and both render as the fallback with no error anywhere. */
    const head=fs.readFileSync(path.join(__dirname,'..',f)).subarray(0,4).toString('latin1');
    assert.strictEqual(head, 'wOF2', `${rel} is not a woff2 file (starts "${head}")`);
  }
});

test('the fonts are served from the folder, never from a CDN', ()=>{
  /* The whole premise is "open index.html, no install, no network". */
  const html=read('public/index.html');
  for(const host of ['fonts.googleapis.com','fonts.gstatic.com','use.typekit',
                     'cdn.jsdelivr','//fonts.']){
    assert.ok(!html.includes(host),
      `index.html links ${host} — the game would lose its lettering offline`);
  }
});

test('the three roles are bound to the three faces', ()=>{
  const html=read('public/index.html');
  for(const [family, varname] of Object.entries(FACES)){
    assert.ok(new RegExp(`@font-face\\{font-family:'${family}'`).test(html),
      `no @font-face declares ${family}`);
    assert.ok(new RegExp(`${varname}:\\s*'${family}'`).test(html),
      `${varname} is not bound to ${family}`);
  }
  /* and every one of them falls back to a system mono, so a machine that
     cannot load the files still gets code type */
  assert.match(html, /--mono-fallback:\s*ui-monospace/, 'no system-mono fallback');
});

test('nothing is lettered in a proportional face any more', ()=>{
  const html=read('public/index.html');
  assert.ok(!/Trebuchet/.test(html.replace(/\/\*[\s\S]*?\*\//g,'')),
    'index.html still sets Trebuchet outside a comment');
  /* the signs hung in the 3D world are canvas text, and they used to name
     their own font by hand — eleven copies of one decision */
  for(const f of ['public/planet.js','public/game.js','public/menu.js','public/cruise.js',
                  'public/vm.js','public/owner.js','public/school.js']){
    const src=read(f).replace(/\/\*[\s\S]*?\*\//g,'');
    assert.ok(!/Trebuchet/.test(src), `${f} still paints canvas text in Trebuchet`);
  }
});

test('code is set in the code face wherever it appears', ()=>{
  /* Blocks, the text mirror, the tape and the worked answer are all the same
     thing — a program — and a hand-written stack in any one of them is that
     one drifting out of the set. */
  const html=read('public/index.html');
  const body=html.slice(html.indexOf('--mono-fallback'));
  const stray=body.match(/font-family:\s*ui-monospace/g)||[];
  assert.deepStrictEqual(stray, [],
    'a hardcoded ui-monospace stack is back — it will beat var(--font-code)');
});

test('a label too long for its sign shrinks instead of squashing', ()=>{
  /* fillText's maxWidth condenses the glyphs, which on a monospace face
     defeats the point of the face. Spanish is where it shows: "CONTROL DE
     MISIONES" against "MISSION CONTROL". */
  const game=read('public/game.js');
  assert.match(game, /function fitFont\(/, 'no shrink-to-fit helper');
  const planet=read('public/planet.js');
  assert.match(planet, /fitFont\(x, text, 42, 470\)/,
    'the building signs do not shrink to fit');
  assert.ok(!/fillText\(text, 256, 52, 470\)/.test(planet),
    'the building sign still hands fillText a maxWidth, which squashes it');
});
