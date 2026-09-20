/* =====================================================================
   One robot on a floor, under test.

   The whole mode is currently one sentence — "when I press D, it goes
   right" — so these are the tests that the sentence is true, and that
   the robot says why whenever it is not.

   Everything here drives the stage by hand with a plain Set of key
   codes: no screen, no keyboard, no clock. That is the point of bout.js
   having none of those.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');

const BOUT   = require('../public/bout.js');
const CODE   = require('../public/mechacode.js');
const ROBOTS = require('../public/robots.js');

/* ------------------------------------------------------------ helpers */
let uid = 0;
const id = () => 'b' + (++uid);

/* WHEN <key> IS PRESSED → <action>, which is the only shape there is */
const rule = (key, act) =>
  ({ type:'when', key, id:id(), body:[{ type:act, id:id() }] });

const stage = (program, opts) => new BOUT.Stage(
  Object.assign({ robot:'noisyboy', program:program||[] }, opts||{}));

const holding = (...keys) => new Set(keys);
const NOTHING = new Set();

function run(st, secs, held){
  const dt = 1/BOUT.RULES.hz;
  const out=[];
  for(let i=0;i<Math.round(secs/dt);i++) out.push(st.step(dt, held||NOTHING));
  return out;
}

/* ==================================================================== */
test('a robot with no rules does nothing, whatever you press', ()=>{
  const st = stage([]);
  run(st, 2, holding('KeyA','KeyD','ArrowLeft','ArrowRight','Space'));
  assert.equal(st.snapshot().x, 0);
  assert.equal(st.robot.steps, 0);
});

test('a key with a rule moves it, and a key without one does not', ()=>{
  const st = stage([ rule('KeyD','right') ]);
  run(st, 1, holding('KeyD'));
  assert.ok(st.snapshot().x > 0, 'D was programmed and it did not move');
  const at = st.snapshot().x;
  run(st, 1, holding('KeyA'));
  assert.equal(st.snapshot().x, at, 'A has no rule and it moved anyway');
});

test('left goes left and right goes right', ()=>{
  const l = stage([ rule('KeyA','left') ]);
  const r = stage([ rule('KeyD','right') ]);
  run(l, 1, holding('KeyA'));
  run(r, 1, holding('KeyD'));
  assert.ok(l.snapshot().x < 0, 'STEP LEFT went right');
  assert.ok(r.snapshot().x > 0, 'STEP RIGHT went left');
});

test('any key can be bound to any direction — nothing is wired in for you', ()=>{
  /* The arrow keys pointing the "wrong" way is a legal program. If this
     ever fails it means something is hard-coding the controls, which is
     the one thing this screen must never do. */
  const st = stage([ rule('ArrowLeft','right') ]);
  run(st, 1, holding('ArrowLeft'));
  assert.ok(st.snapshot().x > 0, 'the program was overridden by a built-in binding');
});

test('it stops the moment the key comes up', ()=>{
  const st = stage([ rule('KeyD','right') ]);
  run(st, 1, holding('KeyD'));
  const at = st.snapshot().x;
  run(st, 2, NOTHING);
  assert.equal(st.snapshot().x, at, 'it kept going after the key was released');
  assert.equal(st.snapshot().moving, false);
});

test('holding longer goes further, and a faster robot goes further still', ()=>{
  const short = stage([ rule('KeyD','right') ]);
  const long  = stage([ rule('KeyD','right') ]);
  run(short, 0.5, holding('KeyD'));
  run(long,  1.0, holding('KeyD'));
  assert.ok(long.snapshot().x > short.snapshot().x, 'time held made no difference');

  const quick = stage([ rule('KeyD','right') ], { robot:'noisyboy' });
  const slow  = stage([ rule('KeyD','right') ], { robot:'ambush' });
  run(quick, 1, holding('KeyD'));
  run(slow,  1, holding('KeyD'));
  assert.ok(quick.snapshot().x > slow.snapshot().x,
    'the robot with the higher speed did not cover more floor');
});

test('the first rule whose key is held is the one that runs', ()=>{
  const st = stage([ rule('KeyA','left'), rule('KeyD','right') ]);
  run(st, 1, holding('KeyA','KeyD'));       // both down at once
  assert.ok(st.snapshot().x < 0, 'the second rule won');

  const flipped = stage([ rule('KeyD','right'), rule('KeyA','left') ]);
  run(flipped, 1, holding('KeyA','KeyD'));
  assert.ok(flipped.snapshot().x > 0, 'moving a row up did not change which one wins');
});

test('it cannot walk off either end of the floor', ()=>{
  const F = BOUT.RULES.floor;
  const r = stage([ rule('KeyD','right') ]);
  const l = stage([ rule('KeyA','left') ]);
  run(r, 30, holding('KeyD'));
  run(l, 30, holding('KeyA'));
  assert.ok(r.snapshot().x <=  F + 0.001, 'it walked off the right-hand end');
  assert.ok(l.snapshot().x >= -F - 0.001, 'it walked off the left-hand end');
  assert.ok(r.snapshot().x >  F - 0.5, 'it stopped well short of the right-hand end');
});

test('it turns to face the way it is going, and stays facing that way', ()=>{
  const st = stage([ rule('KeyD','right'), rule('KeyA','left') ]);
  run(st, 1, holding('KeyD'));
  const right = st.snapshot().yaw;
  assert.ok(right > 0.1, 'it never turned to face right');
  run(st, 1, NOTHING);
  assert.ok(Math.abs(st.snapshot().yaw - right) < 0.01,
    'it turned back to the front as soon as it stopped');
  run(st, 1, holding('KeyA'));
  assert.ok(st.snapshot().yaw < -0.1, 'it did not turn round to go the other way');
});

/* --------------------------------------------- saying why, or why not */
test('every tick says what it decided, in the words the blocks use', ()=>{
  const st = stage([ rule('KeyD','right') ]);
  const [first] = run(st, 0.05, holding('KeyD'));
  assert.deepEqual(first.trace.map(CODE.say), ['WHEN D IS PRESSED', 'STEP RIGHT']);
  assert.equal(first.action.act, 'right');
});

test('a rule that fired with nothing under it says so rather than going quiet', ()=>{
  const empty = { type:'when', key:'KeyD', id:id(), body:[] };
  const st = stage([ empty, rule('KeyD','right') ]);
  const [tick] = run(st, 0.05, holding('KeyD'));
  assert.equal(tick.action, null, 'an empty rule fell through to the one below it');
  const stall = tick.trace.find(s=>s.kind==='stall');
  assert.ok(stall, 'nothing was said about the empty rule');
  assert.match(CODE.say(stall), /nothing to do/i);
});

test('pressing a key with no rule at all is silence, not an error', ()=>{
  const st = stage([ rule('KeyD','right') ]);
  const [tick] = run(st, 0.05, holding('KeyW'));
  assert.equal(tick.action, null);
  assert.equal(tick.trace.length, 0);
});

/* ------------------------------------------------------- being told no */
test('a loose block is refused, and says why', ()=>{
  const r = CODE.validate([ { type:'right', id:id() } ]);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, 'loose-block');
  assert.match(r.errors[0].msg, /under a WHEN/);
});

test('a key this robot does not watch is refused by name', ()=>{
  const bad = rule('KeyZ','left');
  const r = CODE.validate([ bad ]);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, 'bad-key');
  assert.equal(r.errors[0].blockId, bad.id);
});

test('an action that is not a block is refused', ()=>{
  const r = CODE.validate([ rule('KeyD','jump') ]);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e=>e.code==='unknown'));
});

test('two rules on one key is a warning, not a refusal', ()=>{
  const r = CODE.validate([ rule('KeyD','right'), rule('KeyD','left') ]);
  assert.equal(r.ok, true, 'a shadowed key stopped the program running');
  const w = r.errors.find(e=>e.code==='duplicate-key');
  assert.ok(w && w.warn, 'nothing was said about the shadowed key');
  assert.match(w.msg, /first one wins/);
});

test('the block budget is counted, and going over it is refused', ()=>{
  const many=CODE.KEY_IDS.map(k=>rule(k,'left'));
  assert.equal(CODE.countBlocks(many), many.length*2);
  assert.equal(CODE.validate(many, { limit:2 }).ok, false);
  assert.equal(CODE.validate(many, { limit:99 }).ok, true);
});

/* --------------------------------------------------------- the palette */
test('every key on the palette is a real KeyboardEvent.code', ()=>{
  /* A rule stores what the browser reports, so nothing has to be
     translated between the editor and the keyboard. */
  CODE.KEYS.forEach(k=>{
    assert.match(k.id, /^(Key[A-Z]|Arrow(Left|Right|Up|Down)|Space|Digit[0-9])$/,
      k.id+' is not a code the browser would ever report');
    assert.ok(k.label && k.label.length, k.id+' has nothing to call itself');
  });
});

test('every action the palette offers is one the floor knows how to carry out', ()=>{
  CODE.ACTION_IDS.forEach(a=>{
    const def=CODE.ACTIONS[a];
    assert.equal(typeof def.axis, 'number', a+' has no direction to move in');
    assert.ok(def.label && def.help, a+' has nothing said about it');
    const st = stage([ rule('KeyD', a) ]);
    run(st, 0.5, holding('KeyD'));
    assert.notEqual(st.snapshot().x, 0, a+' is on the palette and does nothing');
  });
});

test('the feet are the only thing wired up, and the language says so', ()=>{
  /* A guard on the pullback. When the arms come back this test needs
     changing, and that is exactly the moment to check the ring can
     actually carry them out rather than letting a dead block onto the
     palette. */
  assert.deepEqual(CODE.ACTION_IDS.slice().sort(), ['left','right']);
});

/* ------------------------------------------------------ the two robots */
test('every robot is a complete row, and points at a model that is really there', ()=>{
  const fs=require('node:fs'), path=require('node:path');
  ROBOTS.LIST.forEach(r=>{
    ['name','em','tag','blurb','model'].forEach(k=>
      assert.ok(r[k] && String(r[k]).length, r.id+' has no '+k));
    ['height','speed'].forEach(k=>
      assert.equal(typeof r[k], 'number', r.id+' has no '+k));
    ['trim','plate'].forEach(k=>
      assert.match(r.skin[k], /^#[0-9a-f]{6}$/i, r.id+'’s '+k+' is not a colour'));
    const file=path.join(__dirname,'..','public', r.model);
    assert.ok(fs.existsSync(file), r.id+' points at '+r.model+', which is not there');
  });
});

test('an unknown robot is the first one on the list, not a crash', ()=>{
  assert.equal(ROBOTS.get('gundam').id, ROBOTS.LIST[0].id);
  assert.equal(ROBOTS.get(undefined).id, ROBOTS.LIST[0].id);
});

test('the same keys held the same way come out the same twice', ()=>{
  const once = ()=>{
    const st = stage([ rule('KeyA','left'), rule('KeyD','right') ]);
    for(let i=0;i<200;i++)
      st.step(1/20, i%3===0 ? holding('KeyD') : i%3===1 ? holding('KeyA') : NOTHING);
    return JSON.stringify(st.snapshot());
  };
  assert.equal(once(), once());
});
