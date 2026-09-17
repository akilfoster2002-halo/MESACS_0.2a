/* MISSION 8 — one mission, four levels, and the flags that already say so.

   It was always one entry in the course and it never counted anything. A
   student did four separate things across two worlds and three consoles,
   and the card said PLAY afterwards exactly as it had before, because
   nothing was keeping score. The progress existed the whole time — five
   flags spread across house.js and planet.js — and no one place could
   answer how far in somebody was. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const bare = src => src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

/* ion.js is a browser module, so it is read rather than required. The list
   is what matters and it is a literal. */
const ion = read('public/ion.js');
function levelKeys(){
  const block = ion.slice(ion.indexOf('const LEVELS'), ion.indexOf('const got'));
  return [...block.matchAll(/key:'([a-z0-9_]+)'/g)].map(m=>m[1]);
}

test('Mission 8 is one mission with four levels in it', ()=>{
  const keys=levelKeys();
  assert.strictEqual(keys.length, 4,
    `Mission 8 declares ${keys.length} levels: ${keys.join(', ')}`);
  /* IN THE ORDER THEY HAPPEN. "The level you got to" is a position in a
     sequence, so the list is ordered and at() walks it from the front. */
  assert.deepStrictEqual(keys,
    ['ion_fixed','ion_ship_cleared','ion_flown','ion_belt'],
    'the levels are not the four stages, in order');
  /* AND THE COURSE KNOWS. Without this the card cannot say which level it
     is about to hand you and the pause menu offers no way back. */
  assert.match(bare(read('public/game.js')),
    /const LEVELED=new Set\(\[[^\]]*'ion'[^\]]*\]\)/,
    "'ion' is not a leveled mission, so its four levels are invisible");
});

test('every level is the flag its own stage already writes', ()=>{
  /* NOT A SECOND RECORD OF THE SAME FACTS. The stages each wrote a flag
     long before there was a level list; the list names those flags rather
     than keeping a parallel count, so there is nothing to fall out of step
     with. A level whose flag nothing writes is a level nobody can finish. */
  const src = bare(read('public/planet.js')) + bare(read('public/house.js'));
  for(const key of levelKeys()){
    const written = new RegExp(`ION\\.pass\\((?:'${key}'|[A-Z_]+)\\)`).test(src)
                 || new RegExp(`PROGRESS\\.set\\('${key}'`).test(src);
    assert.ok(written, `nothing ever finishes the level filed under '${key}'`);
  }
  /* The three that go through a const have to resolve to these names. */
  const planet = read('public/planet.js');
  assert.match(planet, /const CLEARED='ion_ship_cleared'/, 'the pre-flight flag has been renamed');
  assert.match(planet, /const WORKED='ion_belt'/, 'the belt flag has been renamed');
  assert.match(read('public/house.js'), /const FIXED='ion_fixed'/, "Ion's console flag has been renamed");
  /* And the flight, which wrote nothing at all until it became a level. */
  assert.match(bare(planet), /ION\.pass\('ion_flown'\)/,
    'reaching the tower still records nothing, so it cannot be a level');
});

test('every level flag is forgotten when the mission starts over', ()=>{
  /* PROGRESS.restart('ion') forgets keys beginning with 'ion_'. A level
     filed anywhere else survives, and "start over" then skips the stage it
     guards — which is exactly what happened to the pre-flight when its
     flag was called 'ship_cleared'. */
  for(const key of levelKeys())
    assert.ok(key.startsWith('ion_'),
      `'${key}' is a level of Mission 8 but is not under the 'ion_' prefix`);
});

test('the level you are on is derived, never counted', ()=>{
  const src = bare(ion);
  /* A counter would have to be incremented at four call sites and would be
     wrong the first time anybody finished a stage twice, skipped one, or
     started over. The level is read off the flags every time it is asked
     for, and it stops at the first gap. */
  assert.match(src, /while\(i<LEVELS\.length && got\(LEVELS\[i\]\.key\)\) i\+\+/,
    'at() no longer walks the list from the front');
  assert.ok(!/at\s*\+\+|\+\+\s*at|at\s*=\s*at\s*\+/.test(src),
    'something increments a stored level instead of deriving it');
  assert.match(src, /PROGRESS\.reach\(MISSION, at\(\)\)/,
    'the derived level is never handed to PROGRESS');
});

test('Mission 8 has a card, and the pause menu knows which mission it is', ()=>{
  /* IT WAS NOT ON THE MENU AT ALL. The mission existed, was finishable and
     had a station on RYU, and the only way to reach it was to walk across
     a planet and find the door. */
  const menu = read('public/menu.js');
  assert.match(menu, /\{id:'ion',\s+g:'course'/, 'Mission 8 has no card in the course');
  assert.match(menu, /name:'Mission 8/, 'the card does not say which mission it is');

  /* AND IT SAYS WHICH MISSION IT IS WHILE YOU ARE IN IT. pauseOver() reads
     G.missionId to decide whether to offer a way back to level one, so a
     mission that leaves it null is a mission that cannot be restarted from
     inside however many levels it has. */
  assert.match(bare(read('public/house.js')), /G\.missionId='ion'/,
    "the house does not name its mission, so the pause menu cannot offer a restart");
  assert.match(bare(read('public/planet.js')),
    /G\.missionId = \(W && W\.id==='ryu'\) \? 'ion' : null/,
    'RYU does not name its mission, or names it on every other world too');
  /* ion.js is on the page, ahead of the stages that call it. */
  const html = read('public/index.html');
  assert.match(html, /<script src="ion\.js\?v=\d+"><\/script>/, 'ion.js is not on the page');
  assert.ok(html.indexOf('ion.js') < html.indexOf('house.js'),
    'ion.js loads after house.js, which calls it');
  assert.ok(html.indexOf('ion.js') < html.indexOf('planet.js'),
    'ion.js loads after planet.js, which calls it');
});
