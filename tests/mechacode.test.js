/* The standing-orders language. What matters most here is not that the
   right action comes out — it is that the TRACE says why, because the
   whole mode is a debugger with punching in it. */
const test = require('node:test');
const assert = require('node:assert');
const CODE = require('../public/mechacode.js');

let n = 1;
const B = o => Object.assign({ id:n++ }, o);
const when = (ev, body) => B({ type:'when', ev, body });
const iff  = (sensor, op, v, body, els) => B({ type:'if', sensor, op, n:v, body, else:els });
const act  = type => B({ type });

/* what a part can see this instant */
const world = (over) => ({
  read: Object.assign({ enemy_distance:10, enemy_health:100, my_health:100,
                        my_energy:100, my_heat:0, enemy_facing:1 }, (over||{}).read),
  events: Object.assign({ start:false, enemy_detected:true, incoming_attack:false,
                          hit:false, health_low:false, energy_low:false }, (over||{}).events)
});

test('an order under a WHEN that did not happen does not run', ()=>{
  const p=[ when('incoming_attack', [ act('block') ]) ];
  const d=CODE.decide(p, world());
  assert.equal(d.action, null);
  assert.equal(d.trace.length, 0, 'a rule that never fired should not be traced');
});

test('the event fires, the action comes out, and both are in the trace', ()=>{
  const p=[ when('enemy_detected', [ act('punch') ]) ];
  const d=CODE.decide(p, world());
  assert.equal(d.action.act, 'punch');
  assert.deepEqual(d.trace.map(s=>s.kind), ['event','action']);
});

test('a test writes down the reading it made and which way it went', ()=>{
  const p=[ when('always', [ iff('enemy_distance','<',5, [act('punch')]) ]) ];
  const far=CODE.decide(p, world({ read:{ enemy_distance:9 } }));
  assert.equal(far.action, null, 'nine is not under five');
  const t=far.trace.find(s=>s.kind==='test');
  assert.equal(t.value, 9);
  assert.equal(t.yes, false);
  const near=CODE.decide(p, world({ read:{ enemy_distance:3 } }));
  assert.equal(near.action.act, 'punch');
});

test('ELSE runs when the test says no', ()=>{
  const p=[ when('always', [ iff('enemy_distance','<',5, [act('punch')], [act('block')]) ]) ];
  assert.equal(CODE.decide(p, world({read:{enemy_distance:9}})).action.act, 'block');
  assert.equal(CODE.decide(p, world({read:{enemy_distance:2}})).action.act, 'punch');
});

test('the first action wins, so the order of the rules is the strategy', ()=>{
  const p=[ when('always', [ act('block'), act('punch') ]) ];
  assert.equal(CODE.decide(p, world()).action.act, 'block');
  const q=[ when('always', [ act('punch'), act('block') ]) ];
  assert.equal(CODE.decide(q, world()).action.act, 'punch');
});

test('a rule further down still gets its turn if the one above did nothing', ()=>{
  const p=[ when('always', [ iff('my_health','<',20, [act('block')]) ]),
            when('enemy_detected', [ act('punch') ]) ];
  const d=CODE.decide(p, world());
  assert.equal(d.action.act, 'punch');
  assert.equal(d.trace.filter(s=>s.kind==='event').length, 2, 'both rules should show up');
});

test('ALWAYS is checked even when nothing has happened', ()=>{
  const p=[ when('always', [ act('punch') ]) ];
  const quiet=world({ events:{ enemy_detected:false } });
  assert.equal(CODE.decide(p, quiet).action.act, 'punch');
});

test('equals on a measured distance means "near enough"', ()=>{
  const p=[ when('always', [ iff('enemy_distance','=',3, [act('punch')]) ]) ];
  assert.ok(CODE.decide(p, world({read:{enemy_distance:3.2}})).action, '3.2 is near enough to 3');
  assert.equal(CODE.decide(p, world({read:{enemy_distance:4.1}})).action, null);
});

/* ------------------------------------------------------- being told no */

test('a program with no WHEN around it is refused, and says why', ()=>{
  const r=CODE.validate([ act('punch') ]);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, 'loose-block');
  assert.match(r.errors[0].msg, /under a WHEN/);
});

test('an action the part cannot do is refused by name', ()=>{
  const r=CODE.validate([ when('always',[ act('dodge') ]) ], { allow:['punch','block'] });
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, 'not-allowed');
  assert.match(r.errors[0].msg, /DODGE/);
});

test('a sensor this mecha has not got is refused', ()=>{
  const r=CODE.validate([ when('always',[ iff('enemy_mood','<',5,[act('punch')]) ]) ]);
  assert.equal(r.errors[0].code, 'bad-sensor');
});

test('a WHEN inside a WHEN is refused rather than quietly ignored', ()=>{
  const r=CODE.validate([ when('always', [ when('hit', [act('punch')]) ]) ]);
  assert.ok(r.errors.some(e=>e.code==='nested-when'));
});

test('the block budget counts what is inside the ifs', ()=>{
  const p=[ when('always', [ iff('enemy_distance','<',5, [act('punch'), act('block')]) ]) ];
  assert.equal(CODE.countBlocks(p), 4);
  assert.equal(CODE.validate(p, { limit:3 }).ok, false);
  assert.equal(CODE.validate(p, { limit:4 }).ok, true);
});

test('every error names the block it is about, so the editor can point', ()=>{
  const bad=iff('enemy_mood','<',5,[act('punch')]);
  const r=CODE.validate([ when('always', [ bad ]) ]);
  assert.equal(r.errors[0].blockId, bad.id);
});

/* --------------------------------------------------------- readability */

test('the trace reads as English, because a student has to read it mid-fight', ()=>{
  const p=[ when('enemy_detected', [ iff('enemy_distance','<',5, [act('punch')]) ]) ];
  const d=CODE.decide(p, world({ read:{ enemy_distance:3.42 } }));
  const said=d.trace.map(CODE.say);
  assert.equal(said[0], 'WHEN ENEMY NEAR');
  assert.match(said[1], /ENEMY DISTANCE = 3.4/);
  assert.match(said[1], /IF ENEMY DISTANCE < 5/);
  assert.equal(said[2], 'PUNCH');
});

test('every action has an energy and a heat price on it', ()=>{
  Object.keys(CODE.ACTIONS).forEach(k=>{
    const a=CODE.ACTIONS[k];
    assert.ok(typeof a.energy==='number', k+' has no energy cost');
    assert.ok(typeof a.heat==='number', k+' has no heat cost');
    assert.ok(a.label && a.help, k+' has nothing said about it');
  });
});

test('arms are offered arm moves and legs are offered leg moves', ()=>{
  assert.deepEqual(CODE.partActions('arm').sort(), ['block','heavy','punch']);
  assert.deepEqual(CODE.partActions('legs').sort(), ['brace','dodge']);
});
