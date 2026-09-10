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
