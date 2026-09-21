/* =====================================================================
   2D OR 3D, ASKED FIRST.

   The room can be read two ways. From above, x runs across the screen and
   y runs up it — the two axes the blocks are named for, both flat to the
   camera, with the third one pointing at your face. From inside, it is a
   place with depth in it. Neither is a lesser version and the same blocks
   do the same things in both.

   It used to be a small button in the corner, `▢ 2D VIEW`, on a screen
   that was already carrying a stage card, an axis legend, two bars, a
   blocks button and a walkthrough. A student who never pressed it never
   knew the other view was there. So it is a question now, asked on the
   way in, on a screen with the two answers on it and nothing else —
   which is the part these tests are mostly about, because "nothing else"
   is a claim that quietly stops being true every time something new is
   added to the room.

   Source-level: the thing under test is an overlay over a renderer, and
   what these hold is that the rules are still written down. Both paths
   were walked in the browser through the real route — the pit, TAKE IT
   OUT, then each card — and both were checked to the camera. Comments are
   stripped first so the paragraphs above cannot make anything pass. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = f => fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const bare = s => s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
const RING = bare(read('public/ring.js'));
const HTML = read('public/index.html');
const CSS  = HTML.replace(/\/\*[\s\S]*?\*\//g,'');

const fn = name => {
  const m = new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n  \\}').exec(RING);
  assert.ok(m, name+'() is no longer where this can find it');
  return m[0];
};

test('the level asks before it starts', ()=>{
  const start = fn('start');
  assert.match(start, /askView\(\)/, 'entering a level no longer asks anything');
  /* and nothing that belongs to the level itself runs first */
  ['walk()','card()','hud()','hint()'].forEach(call=>{
    assert.ok(!start.includes('\n    '+call),
      'start() still runs '+call+' before the choice, so the slide is not the only thing on screen');
  });
});

test('the walkthrough and the room panels wait for the answer', ()=>{
  const took = fn('tookView');
  ['walk()','card()','hud()','hint()','legend()'].forEach(call=>
    assert.ok(took.includes(call), 'answering the question does not start '+call));
  assert.match(took, /flatten\(v==='2d'\)/,
    'the answer does not reach the camera');
});

test('the slide has two answers on it and nothing else', ()=>{
  const ask = fn('askView');
  const opts = [...ask.matchAll(/data-v="(\w+)"/g)].map(m=>m[1]);
  assert.deepStrictEqual(opts, ['2d','3d'], 'the two choices are not 2D and 3D');
  /* no third control, no skip, no back — the two cards are the whole screen */
  const buttons = (ask.match(/<button/g)||[]).length;
  assert.strictEqual(buttons, 2, 'something else has been put on the slide');
});

test('everything the room draws over itself stands down while it is up', ()=>{
  const ask = fn('askView');
  /* Every panel the ring shows has to be in this list, or it sits on the
     slide. The list is checked against the markup rather than against
     itself, so a new panel added to #ring and not added here fails. */
  const inRing = [...HTML.slice(HTML.indexOf('<div id="ring" class="hidden">'),
                               HTML.indexOf('<div id="mkSetup"'))
    .matchAll(/id="(ring[A-Za-z]*)"/g)].map(m=>m[1])
    .filter(id => id!=='ring' && id!=='ringPick' && id!=='ringA');
  inRing.forEach(id=>assert.ok(ask.includes("'#"+id+"'"),
    '#'+id+' is drawn over the room and is not hidden for the choice'));
  assert.ok(ask.includes("'#hud'"), 'the player HUD is left on the slide');
});

test('the frame cannot redraw those panels back over it', ()=>{
  /* tick() keeps running while the slide is up, and it calls both of
     these every frame. Without the guard the stage card reappears on the
     next frame and the slide is no longer bare. */
  assert.match(fn('card'), /if\(picking\) return;/, 'the stage card redraws over the slide');
  assert.match(fn('hud'),  /if\(picking\) return;/, 'the bars redraw over the slide');
});

test('the editor cannot be opened on top of it', ()=>{
  assert.match(RING, /get picking\(\)\{ return picking; \}/,
    'nothing outside the ring can tell that the question is up');
  const game = bare(read('public/game.js'));
  const key = /if\(e\.code==='KeyC' && window\.RING && RING\.active && window\.CODER\)\{[\s\S]*?\n      \}/.exec(game);
  assert.ok(key, 'the C key handler moved');
  assert.match(key[0], /if\(!RING\.picking\) CODER\.toggle\(\)/,
    'C still opens the blocks over the one screen meant to be bare');
});

test('choosing 2D restricts it to the top view', ()=>{
  /* The corner toggle is not shown again by anything. Choosing is how the
     view is decided, and walking out and back in is how it is changed —
     which is how everything else in this room is changed too. */
  const shown = RING.match(/ringFlat[\s\S]{0,120}?classList\.remove\('hidden'\)/g) || [];
  assert.deepStrictEqual(shown, [],
    'the 2D/3D toggle comes back after the choice, so neither view is restricted');
  assert.match(fn('askView'), /'#ringFlat'/, 'and it is not even hidden to begin with');
});

test('the top view is the orthographic stage camera, not a moved room camera', ()=>{
  /* Under perspective two robots the same distance apart are different
     distances apart depending where they stand, which is the one thing a
     flat game must not do. */
  assert.match(RING, /G\.camera=VM\.stageCam\(/, 'the flat view is not the stage camera');
  const vmsrc = bare(read('public/vm.js'));
  assert.match(vmsrc, /new THREE\.OrthographicCamera\(/, 'the stage camera is not orthographic');
});

test('leaving takes the question with it', ()=>{
  const stop = fn('stop');
  assert.match(stop, /picking=false/, 'the flag survives leaving the room');
  assert.match(stop, /#ringPick/, 'the slide is left on screen after leaving');
});

test('coding is the same in both', ()=>{
  /* The whole promise: the view is how you LOOK at the room, not a
     different game. Nothing in the editor may branch on it. */
  const coder = bare(read('public/coder.js'));
  assert.ok(!/RING\.flat|\bflat\b/.test(coder),
    'the editor behaves differently depending on the camera');
  const vmsrc = bare(read('public/vm.js'));
  const motion = vmsrc.slice(vmsrc.indexOf("case 'motion.move'"), vmsrc.indexOf("case 'looks.say'"));
  assert.ok(!/isFlat\(\)|P\.stage/.test(motion),
    'a motion block does something different in the top view');
});

test('the slide is styled, and readable on a small screen', ()=>{
  assert.match(CSS, /#ringPick\{[^}]*position:absolute/, 'the slide has no styling');
  assert.match(CSS, /#ringPick\{[^}]*pointer-events:auto/,
    'the cards cannot be clicked: #ring is pointer-events:none');
  assert.match(CSS, /@media \(max-width:620px\)\{ \.rp\{/,
    'two 210px cards side by side do not fit a phone');
});
