/* =====================================================================
   The fight, under test.

   These are not only regression tests. The arena's balance IS this file:
   "BLOCK beats PUNCH" is not a paragraph in a design document that
   drifts away from the code over a term, it is an assertion that fails
   the moment somebody edits a number and breaks it.

   Everything here drives the bout by hand — no screen, no sockets, no
   clock — which is the point of bout.js having none of those.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');

const BOUT   = require('../public/bout.js');
const ROBOTS = require('../public/robots.js');
const CODE   = require('../public/mechacode.js');

/* ------------------------------------------------------------ helpers */
let uid = 0;
const id = () => 'b' + (++uid);

/* WHEN <ev> → <action>, which is the smallest program that does a thing */
const always = act => [{ type:'when', ev:'always', id:id(), body:[{ type:act, id:id() }] }];
const when = (ev, act) => [{ type:'when', ev:ev, id:id(), body:[{ type:act, id:id() }] }];
const nothing = () => [];

/* A bout with whatever orders each side needs, and nothing else. */
function bout(opts){
  opts = opts || {};
  return new BOUT.Bout({
    names:{ A:'A', B:'B' },
    robots:{ A:opts.ra||'noisyboy', B:opts.rb||'noisyboy' },
    programs:{ A:opts.a||{}, B:opts.b||{} },
    rules:opts.rules
  });
}
/* Run it for `secs`, holding whatever the two drivers are holding. */
function run(m, secs, input){
  const dt = 1/BOUT.RULES.hz;
  const ev = [];
  const steps = Math.round(secs/dt);
  for(let i=0;i<steps && !m.over;i++){
    if(input) input(m, i*dt);
    const r = m.step(dt);
    r.events.forEach(e=>ev.push(e));
  }
  return ev;
}
/* Stand them at a fixed distance and keep them there, so a test about
   damage is not secretly a test about walking. */
function place(m, gap){
  const A=m.robots.A, B=m.robots.B;
  A.x=-gap/2; A.z=0; A.yaw=0;
  B.x= gap/2; B.z=0; B.yaw=Math.PI;
  A.vx=A.vz=B.vx=B.vz=0;
}
const core = r => r.parts.core;
const hits = ev => ev.filter(e=>e.kind==='hit');

/* ==================================================================== */
test('a program that never punches never damages anybody', ()=>{
  const m = bout({ a:{ left_arm:nothing() }, b:{ left_arm:nothing() } });
  const before = core(m.robots.B);
  run(m, 10);
  assert.equal(core(m.robots.B), before);
  assert.equal(core(m.robots.A), m.robots.A.spec.parts.core);
});

test('punches land on the core of somebody who never guards', ()=>{
  const m = bout({ a:{ left_arm:always('punch') } });
  place(m, 2);
  const ev = run(m, 4, mm=>place(mm,2));
  const h = hits(ev);
  assert.ok(h.length > 0, 'nothing landed at all');
  assert.ok(h.every(x=>x.part==='core'), 'an unguarded hit went somewhere other than the core');
  assert.ok(core(m.robots.B) < m.robots.B.spec.parts.core);
});

test('the driver has no punch key — input only ever moves you', ()=>{
  const m = bout({ a:{}, b:{} });        // no orders at all, on either side
  run(m, 6, mm=>{ mm.setInput('A',{fwd:1,side:1,run:true});
                  mm.setInput('B',{fwd:1,side:-1,run:true}); });
  assert.equal(core(m.robots.A), m.robots.A.spec.parts.core);
  assert.equal(core(m.robots.B), m.robots.B.spec.parts.core);
  assert.equal(m.robots.A.stats.punches, 0);
});

/* ------------------------------------------------------- the triangle */
test('BLOCK beats PUNCH — a guard takes most of it, and takes it on the arm', ()=>{
  const open  = bout({ a:{ left_arm:always('punch') }, b:{} });
  const guard = bout({ a:{ left_arm:always('punch') }, b:{ right_arm:always('block') } });
  place(open,2); place(guard,2);
  const eo = hits(run(open, 4, m=>place(m,2)));
  const eg = hits(run(guard,4, m=>place(m,2)));
  assert.ok(eg.length>0 && eo.length>0, 'one of them never connected');
  const stopped = eg.filter(x=>x.note==='blocked');
  assert.ok(stopped.length > eg.length/2, 'a raised guard stopped less than half of it');
  assert.ok(stopped.every(x=>x.part==='right_arm'), 'a blocked punch did not land on the arm');
  assert.ok(stopped.every(x=>x.dmg < eo[0].dmg), 'a blocked punch hurt as much as a clean one');
  assert.ok(core(guard.robots.B) > core(open.robots.B),
    'blocking saved no core at all');
});

/* A guard is not a wall — it has a gap in it while the arm resets, and
   that gap is the whole reason to keep punching at somebody blocking. */
test('a guard has a gap in it while the arm resets', ()=>{
  const m = bout({ a:{ left_arm:always('punch') }, b:{ right_arm:always('block') } });
  place(m,2);
  const h = hits(run(m, 8, mm=>place(mm,2)));
  assert.ok(h.some(x=>x.note==='clean'),
    'nothing ever got through a guard that has to reset itself');
});

test('HEAVY beats BLOCK — it goes through the guard and finds the core', ()=>{
  const m = bout({ a:{ left_arm:always('heavy') }, b:{ right_arm:always('block') } });
  place(m,2);
  const h = hits(run(m, 6, mm=>place(mm,2)));
  assert.ok(h.length>0, 'the heavy never landed');
  assert.ok(h.every(x=>x.note==='through'), 'a heavy was stopped by a guard');
  assert.ok(h.every(x=>x.part==='core'), 'a heavy through a guard did not reach the core');
});

test('PUNCH beats HEAVY — winding up a heavy roots you where you stand', ()=>{
  const m = bout({ a:{ left_arm:always('heavy') } });
  place(m, 2);
  const A = m.robots.A;
  // hold forward: a robot that is not rooted would close the distance
  m.setInput('A', { fwd:1, side:0, run:true });
  m.step(1/20);                                  // the order is taken here
  assert.equal(A.limb.left_arm.act, 'heavy');
  const at = A.x;
  for(let i=0;i<5;i++) m.step(1/20);             // still inside the wind-up
  assert.equal(A.limb.left_arm.phase, 'wind');
  assert.ok(Math.abs(A.x-at) < 0.01, 'a rooted robot walked while winding up');
});

test('a DODGE makes the punch miss entirely', ()=>{
  const m = bout({ a:{ left_arm:always('punch') }, b:{ legs:always('dodge') } });
  place(m, 2);
  const ev = run(m, 4, mm=>{ /* let the dodge move them */ });
  const missed = ev.filter(e=>e.kind==='miss' && e.why==='dodged');
  assert.ok(missed.length>0, 'a dodging robot was never missed once');
});

/* ------------------------------------------------------- broken parts */
test('a destroyed arm stops carrying out its orders', ()=>{
  const m = bout({ a:{ left_arm:always('punch') } });
  place(m, 2);
  m.robots.A.parts.left_arm = 0;
  const ev = run(m, 4, mm=>place(mm,2));
  assert.equal(hits(ev).length, 0, 'a destroyed arm threw a punch');
  assert.equal(core(m.robots.B), m.robots.B.spec.parts.core);
});

test('a destroyed arm says why, rather than going quiet', ()=>{
  const m = bout({ a:{ left_arm:always('punch') } });
  m.robots.A.parts.left_arm = 0;
  const r = m.step(1/20);
  const line = r.traces.A.find(l=>l.part==='left_arm');
  assert.ok(line, 'the feed said nothing about the arm at all');
  assert.ok(line.steps.some(s=>s.kind==='stall' && /destroyed/i.test(s.why)));
});

test('a blind robot stops seeing the enemy at all', ()=>{
  const m = bout({ a:{ left_arm:[{ type:'when', ev:'enemy_detected', id:id(),
                                   body:[{ type:'punch', id:id() }] }] } });
  place(m, 2);
  m.robots.A.parts.sensor = 0;
  const ev = run(m, 4, mm=>place(mm,2));
  assert.equal(hits(ev).length, 0, 'a blind robot reacted to an enemy it cannot see');
});

test('wrecked legs slow you down and slow how fast you turn', ()=>{
  const fast = bout({}), slow = bout({});
  slow.robots.A.parts.legs = 0;
  [fast,slow].forEach(m=>{ m.robots.A.x=0; m.robots.A.z=0; m.robots.A.yaw=0;
                           m.robots.B.x=0; m.robots.B.z=12; });
  const go = m => { for(let i=0;i<20;i++){ m.setInput('A',{fwd:1,side:0,run:true}); m.step(1/20); } };
  const y0 = slow.robots.A.yaw;
  go(fast); go(slow);
  const moved = m => Math.hypot(m.robots.A.x, m.robots.A.z);
  assert.ok(moved(fast) > moved(slow), 'wrecked legs did not slow the walk');
  assert.ok(Math.abs(fast.robots.A.yaw) > Math.abs(slow.robots.A.yaw - y0) ||
            Math.abs(slow.robots.A.yaw) < Math.abs(fast.robots.A.yaw),
            'wrecked legs did not slow the turn');
});

/* ------------------------------------------------------------ flanking */
test('a hit from behind lands harder and rattles the sensor', ()=>{
  const front = bout({ a:{ left_arm:always('punch') } });
  const back  = bout({ a:{ left_arm:always('punch') } });
  place(front,2); place(back,2);
  back.robots.B.yaw = Math.PI;                 // B facing away from A
  const hf = hits(run(front, 1.2, m=>place(m,2)));
  const hb = hits(run(back,  1.2, m=>{ const B=m.robots.B;
      m.robots.A.x=-1; m.robots.A.z=0; B.x=1; B.z=0; B.yaw=0;   // B's back to A
      m.robots.A.yaw=0; }));
  assert.ok(hf.length && hb.length, 'one of the two never connected');
  assert.ok(hb.every(x=>x.note==='behind'), 'a hit from behind was not read as one');
  assert.ok(hb[0].dmg > hf[0].dmg, 'a hit from behind was not worth more');
  assert.ok(back.robots.B.parts.sensor < back.robots.B.spec.parts.sensor,
    'a hit from behind left the sensor alone');
});

test('a robot turns to face its enemy without being aimed', ()=>{
  const m = bout({});
  const A=m.robots.A; A.x=0; A.z=0; A.yaw=Math.PI;   // looking the wrong way
  m.robots.B.x=8; m.robots.B.z=0;
  for(let i=0;i<40;i++){ m.setInput('A',{fwd:0,side:0}); m.step(1/20); }
  assert.ok(Math.abs(A.yaw) < 0.15, 'it never turned round to look at them');
});

/* --------------------------------------------------------- the feel */
test('a landed hit freezes BOTH robots where they stand', ()=>{
  const m = bout({ a:{ left_arm:always('punch') } });
  place(m,2);
  let froze=false;
  for(let i=0;i<40 && !froze;i++){
    const r=m.step(1/20); place(m,2);
    if(r.events.some(e=>e.kind==='hit')) froze = m.robots.A.stop>0 && m.robots.B.stop>0;
  }
  assert.ok(froze, 'a hit landed and neither robot was frozen by it');
});

test('being hit takes the steering away for a moment', ()=>{
  const m = bout({ a:{ left_arm:always('punch') } });
  place(m,2);
  let stunned=false;
  for(let i=0;i<40 && !stunned;i++){
    const r=m.step(1/20); place(m,2);
    if(r.events.some(e=>e.kind==='hit')) stunned = m.robots.B.stun>0;
  }
  assert.ok(stunned, 'the victim of a punch was not stunned by it');
});

test('a robot in hitstun takes no new orders', ()=>{
  const m = bout({ b:{ left_arm:always('punch') } });
  m.robots.B.stun = 1;
  const r = m.step(1/20);
  assert.equal(r.traces.B.length, 0, 'a stunned robot was still being asked');
  assert.equal(m.robots.B.limb.left_arm.act, null);
});

test('a punch throws them away from whoever threw it, and a heavy throws them further', ()=>{
  const soft = bout({ a:{ left_arm:always('punch') } });
  const hard = bout({ a:{ left_arm:always('heavy') } });
  const shove = m => {
    place(m,2);
    for(let i=0;i<40;i++){
      const r=m.step(1/20);
      const h=r.events.find(e=>e.kind==='hit');
      if(h) return Math.hypot(m.robots.B.vx, m.robots.B.vz);
      place(m,2);
    }
    return 0;
  };
  const s=shove(soft), h=shove(hard);
  assert.ok(s>0, 'a punch shoved nobody');
  assert.ok(h>s, 'a heavy did not throw them further than a punch');
});

test('the shove grows as the core goes', ()=>{
  const fresh = bout({ a:{ left_arm:always('punch') } });
  const hurt  = bout({ a:{ left_arm:always('punch') } });
  hurt.robots.B.parts.core = Math.round(hurt.robots.B.spec.parts.core*0.2);
  const shove = m => {
    place(m,2);
    for(let i=0;i<40;i++){
      const r=m.step(1/20);
      if(r.events.some(e=>e.kind==='hit')) return Math.hypot(m.robots.B.vx,m.robots.B.vz);
      place(m,2);
    }
    return 0;
  };
  assert.ok(shove(hurt) > shove(fresh), 'a nearly-dead robot was not thrown further');
});

test('planting your feet takes the sting out of a shove', ()=>{
  const loose = bout({ a:{ left_arm:always('punch') }, b:{} });
  const set   = bout({ a:{ left_arm:always('punch') }, b:{ legs:always('brace') } });
  const shove = m => {
    place(m,2);
    for(let i=0;i<40;i++){
      const r=m.step(1/20);
      if(r.events.some(e=>e.kind==='hit')) return Math.hypot(m.robots.B.vx,m.robots.B.vz);
      place(m,2);
    }
    return 0;
  };
  assert.ok(shove(set) < shove(loose), 'bracing did nothing to the knockback');
});

/* ----------------------------------------------------------- the floor */
test('two robots cannot walk through each other', ()=>{
  const m = bout({});
  run(m, 8, mm=>{ mm.setInput('A',{fwd:1,side:0,run:true});
                  mm.setInput('B',{fwd:1,side:0,run:true}); });
  const d = Math.hypot(m.robots.A.x-m.robots.B.x, m.robots.A.z-m.robots.B.z);
  assert.ok(d >= m.robots.A.R + m.robots.B.R - 0.05, 'they ended up inside each other');
});

test('nobody leaves the floor', ()=>{
  const m = bout({ a:{ left_arm:always('heavy') } });
  run(m, 20, mm=>{ mm.setInput('A',{fwd:-1,side:1,run:true});
                   mm.setInput('B',{fwd:-1,side:-1,run:true}); });
  ['A','B'].forEach(s=>{
    const r=m.robots[s];
    assert.ok(Math.hypot(r.x,r.z) <= BOUT.RULES.radius+0.01, s+' walked off the arena');
  });
});

/* ---------------------------------------------------------- resources */
test('energy runs out, and the trace says so rather than going quiet', ()=>{
  /* Swinging at nothing, across the arena from each other, so this is a
     test about the price of an action and not about killing anybody. */
  const m = bout({ a:{ left_arm:always('heavy'), right_arm:always('heavy') } });
  let said=false;
  for(let i=0;i<400 && !said;i++){
    const r=m.step(1/20); place(m,14);
    said = r.traces.A.some(l=>l.steps.some(s=>s.kind==='stall' && /energy/i.test(s.why)));
  }
  assert.ok(said, 'it ran dry and the feed never mentioned energy');
  assert.ok(m.robots.A.stats.stalls>0);
  assert.ok(m.robots.A.stats.wasted>0, 'swinging at air cost it nothing');
});

test('two arms throwing the heaviest thing they have cannot keep it up', ()=>{
  /* Heavy-spam has to pay for itself. Two arms spend faster than the
     regen, so the answer to "why not always HEAVY?" is a number rather
     than a rule nobody told the student about. */
  const m = bout({ a:{ left_arm:always('heavy'), right_arm:always('heavy') } });
  for(let i=0;i<200;i++){ m.step(1/20); place(m,14); }
  assert.ok(m.robots.A.energy < 20, 'spamming the heavy never emptied the tank');
});

/* ------------------------------------------------------ the two robots */
test('NOISY BOY reaches further than AMBUSH does', ()=>{
  const far = id=>{
    const m = bout({ ra:id, rb:'ambush', a:{ left_arm:always('punch') } });
    for(let gap=1; gap<8; gap+=0.1){
      const t = bout({ ra:id, rb:'ambush', a:{ left_arm:always('punch') } });
      place(t, gap);
      const ev = run(t, 1.2, mm=>place(mm,gap));
      if(!hits(ev).length) return gap;
    }
    return 8;
  };
  assert.ok(far('noisyboy') > far('ambush'), 'the long-armed robot did not reach further');
});

test('AMBUSH keeps more of himself from the same punch', ()=>{
  const at = id=>{
    const m = bout({ ra:'noisyboy', rb:id, a:{ left_arm:always('punch') } });
    place(m,2);
    const h = hits(run(m, 1.2, mm=>place(mm,2)));
    return h.length ? h[0].dmg : 0;
  };
  const n=at('noisyboy'), a=at('ambush');
  assert.ok(n>0 && a>0, 'one of them was never hit');
  assert.ok(a < n, 'the thick-plated robot took just as much');
});

test('every robot is a complete row, and its parts match the parts a program can be written for', ()=>{
  const named = CODE.PARTS.map(p=>p.id);
  ROBOTS.LIST.forEach(r=>{
    ['reach','power','armour','speed','swing','bulk','energy','cool'].forEach(k=>
      assert.equal(typeof r[k], 'number', r.id+' has no '+k));
    assert.ok(r.name && r.blurb && r.tag, r.id+' is missing its words');
    named.forEach(p=>assert.equal(typeof r.parts[p], 'number',
      r.id+' has no '+p));
    ['height','shoulder','arm','leg','chest','head'].forEach(k=>
      assert.equal(typeof r.rig[k], 'number', r.id+' has no '+k+' to draw'));
    ['plate','trim','glow','joint'].forEach(k=>
      assert.ok(/^#[0-9a-f]{6}$/i.test(r.skin[k]), r.id+'’s '+k+' is not a colour'));
  });
});

/* -------------------------------------------------------------- the end */
test('the core going is the end of it, and the one still standing takes it', ()=>{
  const m = bout({ a:{ left_arm:always('heavy'), right_arm:always('punch') } });
  place(m,2);
  m.robots.B.parts.core = 20;
  run(m, 10, mm=>{ if(!mm.over) place(mm,2); });
  assert.ok(m.over, 'the fight did not end when a core went');
  assert.equal(m.result.winner, 'A');
  assert.equal(m.result.why, 'core');
});

test('a fight the clock runs out on goes to whoever has more core left', ()=>{
  const m = bout({ rules:{ time:1 } });
  m.robots.B.parts.core = 50;
  run(m, 2);
  assert.ok(m.over);
  assert.equal(m.result.why, 'time');
  assert.equal(m.result.winner, 'A');
});

test('the same fight, driven the same way, comes out the same twice', ()=>{
  const one = ()=>{
    const m = bout({ ra:'noisyboy', rb:'ambush',
      a:{ left_arm:always('punch'), legs:when('incoming_attack','dodge') },
      b:{ right_arm:always('block'), left_arm:always('heavy') } });
    run(m, 30, (mm,t)=>{
      mm.setInput('A',{ fwd:Math.sin(t*1.7)>0?1:-1, side:Math.cos(t)>0?1:-1, run:true });
      mm.setInput('B',{ fwd:1, side:Math.sin(t*0.9)>0?-1:1, run:false });
    });
    return JSON.stringify(m.snapshot())+'|'+JSON.stringify(m.result);
  };
  assert.equal(one(), one());
});

test('the freeze and the stun are on the wire, so a client can predict through neither', ()=>{
  const m = bout({ a:{ left_arm:always('punch') } });
  place(m,2);
  const s = m.snapshot();
  ['A','B'].forEach(k=>{
    assert.equal(typeof s[k].fz, 'number', k+' does not send its freeze');
    assert.equal(typeof s[k].st, 'number', k+' does not send its stun');
    assert.equal(typeof s[k].r,  'string', k+' does not say which robot it is');
    assert.equal(typeof s[k].l.left_arm, 'object');
  });
});

test('a hit says how long the world stops for, so the picture can shake for exactly that long', ()=>{
  const m = bout({ a:{ left_arm:always('punch') } });
  place(m,2);
  const h = hits(run(m, 3, mm=>place(mm,2)));
  assert.ok(h.length>0);
  assert.ok(h.every(x=>typeof x.stop==='number' && x.stop>0));
  assert.ok(h.every(x=>typeof x.x==='number' && typeof x.z==='number'),
    'a hit does not say where it happened');
});

/* --------------------------------------------------- the block language */
test('every action a part can be given is one the fight knows how to carry out', ()=>{
  CODE.PARTS.filter(p=>p.kind!=='none').forEach(p=>{
    CODE.partActions(p.kind).forEach(a=>{
      assert.ok(BOUT.MOVES[a], p.id+' can be told to '+a+' and the fight has no such move');
      assert.equal(BOUT.MOVES[a].limb, p.kind,
        a+' is offered to the '+p.kind+' and belongs to the '+BOUT.MOVES[a].limb);
    });
  });
});

test('every action has a price, and nothing is free', ()=>{
  Object.keys(BOUT.MOVES).forEach(a=>{
    assert.ok(CODE.ACTIONS[a], a+' is a move with no block');
    assert.ok(CODE.ACTIONS[a].energy > 0, a+' costs nothing');
  });
});

test('there is no heat left anywhere — one resource, and it is energy', ()=>{
  assert.ok(!CODE.SENSOR_IDS.includes('my_heat'));
  Object.keys(CODE.ACTIONS).forEach(a=>
    assert.equal(CODE.ACTIONS[a].heat, undefined, a+' still has a heat price'));
  assert.ok(CODE.SENSOR_IDS.includes('my_energy'));
});
