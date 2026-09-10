/* THE MOTION PALETTE, AND WHETHER FLIGHT SCHOOL ACTUALLY TEACHES IT.

   The blocks in here are Scratch's Motion drawer, because that is the
   drawer these students have open in the other window: move, the two turn
   arrows, point in direction, go to, go to random position, glide with its
   seconds, point towards, and the four coordinate blocks. A block that
   exists and is never put in front of anybody is a block nobody has.

   So this checks three things and they are different things:

     that every block is DEFINED — it has a face, a colour and a help line;
     that every block RUNS — Flight School's step runner has a case for it,
       or pressing RUN silently skips it and the level is unwinnable;
     and that every block is TAUGHT — some level offers it and some level's
       worked example uses it. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

/* Scratch's Motion drawer, in the order it appears on screen, against the
   name this game gives each one. */
const MOTION = {
  move:    'move _ steps',
  turnR:   'turn ↻ _ degrees',
  turnL:   'turn ↺ _ degrees',
  goRnd:   'go to random position',
  goTo:    'go to x: _ y: _',
  glide:   'glide _ secs to x: _ y: _',
  point:   'point in direction _',
  pointAt: 'point towards _',
  addX:    'change x by _',
  setX:    'set x to _',
  addY:    'change y by _',
  setY:    'set y to _'
};

test('every Motion block is defined in the console', ()=>{
  const src = read('public/code.js');
  const def = src.slice(src.search(/const DEF\s*=/), src.indexOf('const BY_WORD'));
  for(const [id, scratch] of Object.entries(MOTION))
    assert.ok(new RegExp('\\b' + id + '\\s*:\\s*\\{').test(def),
      `no block for Scratch's "${scratch}" (expected DEF.${id})`);
});

test('every Motion block that carries a number has a range to carry it in', ()=>{
  const program = read('public/program.js');
  const code = read('public/code.js');
  const numblk = program.match(/const NUMBLK=\{([\s\S]*?)\};/);
  assert.ok(numblk, 'program.js still declares NUMBLK');
  const range = code.slice(code.indexOf('function numRange'),
                          code.indexOf('function numRange') + 900);
  for(const id of ['move','turnR','turnL','point']){
    assert.ok(numblk[1].includes(id + ':'),
      `${id} takes a number, so it belongs in NUMBLK`);
    /* numRange falls through to [0,0], which is not an error and not a
       warning: the block simply pins itself at zero and does nothing. */
    assert.ok(range.includes("'" + id + "'"),
      `numRange has no case for ${id} — its number would clamp to zero`);
  }
});

test('every Motion block runs in Flight School', ()=>{
  const src = read('public/school.js');
  const at = src.indexOf('function walk(steps, at)');
  assert.ok(at > 0, 'school.js still has a step runner');
  const runner = src.slice(at, src.indexOf('\n  }', at));
  for(const [id, scratch] of Object.entries(MOTION))
    assert.ok(runner.includes(`s.name==='${id}'`),
      `the runner has no case for ${id} ("${scratch}") — RUN would skip it`);
});

test('every Motion block is offered by a level and used by a worked example', ()=>{
  const src = read('public/school.js');
  const levels = src.slice(src.indexOf('const LEVELS=['), src.indexOf('\n  ];'));
  const offered = new Set(
    [...levels.matchAll(/pal:\[([^\]]*)\]/g)]
      .flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])));
  const worked = [...levels.matchAll(/code:'((?:[^'\\]|\\.)*)'/g)]
    .map(m => m[1].replace(/\\n/g, '\n')).join('\n');

  /* What each block looks like in a typed program — the same spelling the
     console's parser reads, so this cannot pass on a block the parser would
     reject. */
  const written = {
    move: /^move -?\d+ steps$/m,
    turnR: /^turn right -?\d+$/m,
    turnL: /^turn left -?\d+$/m,
    goRnd: /^go to random position$/m,
    goTo: /^goto -?\d+,-?\d+$/m,
    glide: /^glide \d+ secs to -?\d+,-?\d+$/m,
    point: /^point in direction -?\d+$/m,
    pointAt: /^point towards the star$/m,
    addX: /^change x by -?\d+$/m,
    addY: /^change y by -?\d+$/m,
    setX: /^set x to -?\d+$/m,
    setY: /^set y to -?\d+$/m
  };
  for(const [id, scratch] of Object.entries(MOTION)){
    assert.ok(offered.has(id),
      `no level puts "${scratch}" on the shelf`);
    assert.ok(written[id].test(worked),
      `no level's worked example writes "${scratch}"`);
  }
});

test('there are ten levels and each one can be finished', ()=>{
  const src = read('public/school.js');
  const levels = src.slice(src.indexOf('const LEVELS=['), src.indexOf('\n  ];'));
  const ids = [...levels.matchAll(/\{ id:'([a-z]+)'/g)].map(m => m[1]);
  assert.strictEqual(ids.length, 10, 'ten levels');
  assert.strictEqual(new Set(ids).size, 10, 'and ten different ids');

  /* Every level has to carry the four things a level IS: what it is called,
     what it is for, what it is asking, and how many blocks it may take. A
     budget of 0 is a level nobody can submit. */
  for(const block of levels.split(/\n\n(?=    \{ id:)/)){
    const id = (block.match(/id:'([a-z]+)'/)||[])[1];
    if(!id) continue;
    for(const field of ['name:', 'budget:', 'learn:', 'brief:', 'start:', 'goal:'])
      assert.ok(block.includes(field), `level '${id}' has no ${field}`);
    const budget = +(block.match(/budget:(\d+)/)||[])[1];
    const lines = ((block.match(/code:'((?:[^'\\]|\\.)*)'/)||[])[1]||'')
      .split('\\n').filter(Boolean).length;
    assert.ok(budget > 0, `level '${id}' has a budget of zero`);
    assert.ok(lines > 0 && lines <= budget,
      `level '${id}': its own worked example is ${lines} blocks against a budget of ${budget}`);
  }
});

test('the board is four quadrants, and the console can name a point in all of them', ()=>{
  const school = read('public/school.js');
  const code = read('public/code.js');
  assert.match(school, /const H=\d+/, 'the board has a half-width');
  assert.match(school, /const px = x => x\*CELL/, 'the origin is the origin');
  assert.match(school, /Math\.max\(-H, Math\.min\(H, v\)\)/,
    'a coordinate is clamped either side of zero, not at it');

  /* The two blocks that take a whole coordinate used to clamp it at zero
     and refuse to read a minus sign, which on a four-quadrant board is
     three quarters of the plane you cannot name. */
  assert.match(code, /glide \+to \+\(-\?\\d\+\)/.source ? /glide \+to \+\(-\?\\d\+\)/ : /x/,
    'the glide parser reads a signed coordinate');
  assert.ok(code.includes('const clampCol = n => Math.max(-GRID.col'),
    'and clamps it symmetrically');
});

test('no block comes off the shelf reading "undefined"', ()=>{
  const code = read('public/code.js');
  const program = read('public/program.js');

  /* Every block that carries a number needs a value the moment it is made.
     The four Motion blocks were added to NUMBLK and not to the chain of ifs
     that gave the others theirs, so `move` rendered as "move undefined
     steps" — not an error, not a warning, just the word in a box. */
  const numblk = (program.match(/const NUMBLK=\{([\s\S]*?)\};/)||[])[1];
  assert.ok(numblk, 'program.js still declares NUMBLK');
  const start = (code.match(/const START=\{([\s\S]*?)\};/)||[])[1];
  assert.ok(start, 'code.js declares what each numbered block starts at');

  for(const m of numblk.matchAll(/(\w+)\s*:/g))
    assert.ok(new RegExp('\\b' + m[1] + '\\s*:').test(start),
      `${m[1]} carries a number and has no starting value — it would render as "undefined"`);

  /* And the fallback, so the next block added cannot reintroduce it. */
  assert.match(code, /START\[type\]===undefined \? 0 : START\[type\]/,
    'a block missing from START still starts at a number');
});

test('a coordinate is typed, not clicked up and down one at a time', ()=>{
  const code = read('public/code.js');
  const at = code.indexOf("if(b.type==='goTo'||b.type==='glide')");
  const body = code.slice(at, at + 1800);
  assert.ok(!/data-act="\$\{what\}\+"/.test(body) && !/data-act="col\+"/.test(body),
    'go to and glide no longer use stepper arrows');
  assert.match(body, /class="numin"[\s\S]*data-field="\$\{field\}"/,
    'each of their numbers is a box you type in');
  /* Three fields, and each has to say which one it is or they all write to
     the same place. */
  for(const f of ["num('col'", "num('row'", "num('secs'"])
    assert.ok(body.includes(f), `${f} is missing`);
  assert.match(code, /const field = inp\.dataset\.field \|\| 'n'/,
    'the input handler reads which field it is editing');
});

test('an angle snaps to the mission\'s turn step, not always to a quarter', ()=>{
  const code = read('public/code.js');
  const at = code.indexOf("scriptEl.querySelectorAll('input[data-num]')");
  const body = code.slice(at, at + 1800);
  /* Hardcoding 90 here meant that on the one level whose whole point is
     that an angle is just a number, typing 45 into the box put 90 back. */
  assert.ok(!/v=Math\.round\(v\/90\)\*90/.test(body),
    'the blur handler must not round every angle to a quarter turn');
  assert.match(body, /NUMSTEP\[b\.type\]/,
    'it rounds to the step this mission set');
  assert.match(code, /const ANGLE=\{[^}]*turnR[^}]*\}/,
    'and it knows which blocks carry degrees');
});

test('Flight School does not print the answer next to the question', ()=>{
  const school = read('public/school.js');
  const code = read('public/code.js');

  /* This mission SETS a problem. The console used to print the worked
     example beside the brief, which is right for the tutorial and the
     corridor — those are demonstrations, and copying the thing you are
     shown IS the exercise — and wrong here. */
  assert.match(school, /CODE\.setGuide\(Object\.assign\(\{ hint:true \}/,
    'Flight School asks for its worked example to be hidden');

  const guide = code.slice(code.indexOf('function drawGuide'),
                           code.indexOf('function drawGuide') + 2600);
  assert.match(guide, /const behind = !!guide\.hint/,
    'the console honours that flag');
  assert.match(guide, /hintAt===0/, 'and shows a button before it shows anything');
  /* Two goes, not one: the first block is usually the whole idea. */
  assert.match(guide, /lines\.slice\(0,1\)/, 'the first hint is the first block');

  /* And nothing is locked. A student who wants the answer gets the answer;
     the toll is asking. */
  assert.match(guide, /hintAt===1 \? lines\.slice\(0,1\) : lines/,
    'the second press gives the whole thing');
});

test('every other mission keeps its worked example on the card', ()=>{
  /* The flag is opt-in, so the demonstrations are untouched. If this ever
     fails it means the hint was made the default, which is a decision about
     five other missions and should be made on purpose. */
  const code = read('public/code.js');
  const guide = code.slice(code.indexOf('function drawGuide'),
                           code.indexOf('function drawGuide') + 2600);
  assert.match(guide, /if\(!behind\)\{[\s\S]{0,140}cg-code/,
    'a guide without the flag still prints its code');
  for(const f of ['nav.js', 'tutorial.js', 'race.js']){
    const src = read('public/' + f);
    assert.ok(/setGuide\(\{[\s\S]{0,200}code:/.test(src),
      `${f} still hands its worked example straight to the card`);
    assert.ok(!/hint:true/.test(src), `${f} has not been opted in by accident`);
  }
});

test('a hint stays given across a retry, and goes back for a new level', ()=>{
  const code = read('public/code.js');
  const set = code.slice(code.indexOf('function setGuide'),
                         code.indexOf('function setGuide') + 700);
  /* Every mission tears its guide down on the way out and sets it up again
     on the way in, so resetting whenever the guide changes at all made a
     retry charge you for the answer twice. */
  assert.match(set, /if\(g\)\{/, 'clearing the guide does not reset the hint');
  assert.match(set, /if\(key!==guideKey\)\{ guideKey=key; hintAt=0; \}/,
    'only a different question does');
});
