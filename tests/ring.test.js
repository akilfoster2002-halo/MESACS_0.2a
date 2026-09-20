/* =====================================================================
   The ring's lobby, under test.

   Nobody's browser gets a vote on who won, so the things worth asserting
   here are about what the server does with two people and two programs:
   who waits, who is matched, what each of them is told, and what happens
   to the one left standing when the other closes their laptop.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');

const RING   = require('../server/ring.js');
const BOUT   = require('../public/bout.js');
const ROBOTS = require('../public/robots.js');

/* A stand-in for the sockets: it remembers everything said to everybody,
   which is the only thing any of these tests needs to look at. */
function post(){
  const sent=[], rooms=[];
  return {
    io:{ send:(id,msg)=>sent.push({id,msg}), room:(r,msg)=>rooms.push({room:r,msg}) },
    sent, rooms,
    to(id){ return sent.filter(x=>x.id===id).map(x=>x.msg); },
    op(id,op){ return this.to(id).filter(m=>m.op===op); }
  };
}
let n=0;
const bk = o => Object.assign({ id:'t'+(++n) }, o);
const punch = [ bk({ type:'when', ev:'always', body:[ bk({ type:'punch' }) ] }) ];
const block = [ bk({ type:'when', ev:'always', body:[ bk({ type:'block' }) ] }) ];
const player = (id, over) => Object.assign({
  id, name:'P'+id, robot:'noisyboy',
  programs:{ left_arm:punch, right_arm:block, legs:[] }
}, over||{});

/* ==================================================================== */
test('the first one in waits, and the second one starts a fight', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  assert.equal(r.join('lab', player(1)).status, 'waiting');
  assert.equal(r.running, 0);
  assert.equal(r.join('lab', player(2)).status, 'matched');
  assert.equal(r.running, 1);
  assert.equal(io.op(1,'start').length, 1);
  assert.equal(io.op(2,'start').length, 1);
});

test('each of them is told which side they are, and which robots are in', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  r.join('lab', player(1, { robot:'noisyboy' }));
  r.join('lab', player(2, { robot:'ambush' }));
  const a=io.op(1,'start')[0], b=io.op(2,'start')[0];
  assert.equal(a.you, 'A');
  assert.equal(b.you, 'B');
  assert.deepEqual(a.robots, { A:'noisyboy', B:'ambush' });
  assert.deepEqual(a.robots, b.robots, 'the two of them were told different fights');
  assert.ok(a.snapshot && a.snapshot.A && a.snapshot.B);
});

test('queueing twice replaces what you are holding, never fights you with yourself', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  r.join('lab', player(1));
  assert.equal(r.join('lab', player(1)).status, 'waiting');
  assert.equal(r.running, 0);
  assert.equal(r.waitingIn('lab').id, 1);
});

test('two rooms are two queues', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  r.join('lab', player(1));
  assert.equal(r.join('hall', player(2)).status, 'waiting');
  assert.equal(r.running, 0);
});

test('a program a part cannot carry out is refused, and costs nobody their place', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  r.join('lab', player(1));
  /* legs cannot punch, and the palette never offers it — so this is a
     browser that edited its own palette. */
  const bad = r.join('lab', player(2, {
    programs:{ legs:[ bk({ type:'when', ev:'always', body:[ bk({type:'punch'}) ] }) ] } }));
  assert.equal(bad.status, 'rejected');
  assert.ok(bad.errors.length);
  assert.equal(r.running, 0, 'a refused program still started a fight');
  assert.equal(r.waitingIn('lab').id, 1, 'the blameless one lost their place');
});

test('a loose block is refused with a sentence, not a stack trace', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  const bad = r.join('lab', player(1, { programs:{ left_arm:[ bk({type:'punch'}) ] } }));
  assert.equal(bad.status, 'rejected');
  assert.ok(bad.errors.every(e=>typeof e.msg==='string' && e.msg.length>8));
  assert.ok(bad.errors.every(e=>e.part));
});

test('a robot nobody has heard of is the first one on the list, not an error', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  r.join('lab', player(1, { robot:'gundam' }));
  assert.equal(r.waitingIn('lab').robot, ROBOTS.LIST[0].id);
});

test('a novel instead of a program is refused before it is parsed', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  const huge=[]; for(let i=0;i<4000;i++) huge.push(bk({ type:'when', ev:'always', body:[] }));
  const bad = r.join('lab', player(1, { programs:{ left_arm:huge } }));
  assert.equal(bad.status, 'error');
});

test('you cannot queue while you are already in a fight', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  r.join('lab', player(1)); r.join('lab', player(2));
  assert.equal(r.join('lab', player(1)).status, 'error');
});

test('a fight is stepped, and both of them are sent the same snapshot', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  r.join('lab', player(1)); r.join('lab', player(2));
  r.tick(1/20);
  const a=io.op(1,'state'), b=io.op(2,'state');
  assert.equal(a.length, 1); assert.equal(b.length, 1);
  assert.deepEqual(a[0].s, b[0].s, 'the two of them were sent different fights');
});

test('you are sent your own reasoning and never theirs', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  r.join('lab', player(1)); r.join('lab', player(2));
  for(let i=0;i<5;i++) r.tick(1/20);
  const mine=io.op(1,'state').flatMap(m=>m.tr||[]);
  assert.ok(mine.length>0, 'nobody was told why their own robot did anything');
  /* The proof that it is one-sided: what A is sent is A's traces, and
     the message carries no field at all that could hold B's. */
  io.op(1,'state').forEach(m=>{
    assert.ok(Array.isArray(m.tr));
    assert.equal(m.trB, undefined);
    assert.equal(m.traces, undefined);
  });
});

test('a fight that ends tells both of them, with both sets of numbers', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  r.join('lab', player(1));
  /* No guard on the second one, or the punches land on a raised arm and
     nobody's core ever goes — which is the triangle doing its job, and
     not what this test is about. */
  r.join('lab', player(2, { programs:{ left_arm:[], right_arm:[], legs:[] } }));
  const live=r.live[0];
  /* Nobody is driving, so stand them within reach of each other and
     leave B one point of core: this is a test about what the lobby says
     when a fight ends, not about how long two idle robots take. */
  const A=live.bout.robots.A, B=live.bout.robots.B;
  A.x=-1; A.z=0; A.yaw=0; B.x=1; B.z=0; B.yaw=Math.PI;
  B.parts.core = 1;
  for(let i=0;i<60 && r.running;i++) r.tick(1/20);
  assert.equal(r.running, 0, 'the fight never ended');
  const a=io.op(1,'over')[0], b=io.op(2,'over')[0];
  assert.ok(a && b);
  assert.equal(a.result.winner, b.result.winner);
  assert.ok(a.stats.A && a.stats.B);
  assert.equal(io.rooms.filter(x=>x.msg.t==='ringbout').length, 1,
    'the room was not told how it went');
});

test('somebody closing their laptop hands the fight to whoever is left', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  r.join('lab', player(1)); r.join('lab', player(2));
  r.tick(1/20);
  assert.equal(r.leave(1), 'B');
  const b=io.op(2,'forfeit')[0];
  assert.ok(b, 'the one still standing was never told');
  assert.equal(b.result.winner, 'B');
  assert.equal(r.running, 0);
  assert.equal(r.leave(2), null, 'leaving a fight that is over did something');
});

test('leaving the queue takes you out of it', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  r.join('lab', player(1));
  assert.equal(r.cancel(1), true);
  assert.equal(r.waitingIn('lab'), null);
  assert.equal(r.cancel(1), false);
});

test('input from somebody who is not in a fight is dropped', ()=>{
  const io=post(), r=new RING.Ring(io.io);
  assert.doesNotThrow(()=>r.input(99, { fwd:1, side:1 }));
  r.join('lab', player(1));
  assert.doesNotThrow(()=>r.input(1, { fwd:1, side:1 }));
});

test('what the ring will run is what the pit will let you build', ()=>{
  /* The limit the server checks against and the limit the editor counts
     to have to be the same number, or a student builds something the
     ring then refuses. */
  assert.equal(RING.LIMIT, 24);
  const ok = RING.checkPrograms({ left_arm:punch, right_arm:block, legs:[] });
  assert.ok(ok.ok, JSON.stringify(ok.errors));
  assert.deepEqual(Object.keys(ok.programs).sort(), ['left_arm','legs','right_arm']);
});

test('the heartbeat the server runs is the one the fight is written for', ()=>{
  assert.equal(BOUT.RULES.hz, 20);
});
