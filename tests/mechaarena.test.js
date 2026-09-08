/* The live arena. Two things are being checked here and they matter for
   different reasons.

   The first is that the fight is FAIR AND FIXED: the same two programs,
   driven the same way, produce the same fight every time, because the
   server decides a match the two browsers then draw for themselves.

   The second is that the combat triangle is really there. Block beats
   punch, heavy beats block, and a dodge beats both but costs you. If any
   of those is not true, every student in the room writes the same
   program and the mode is over in a week. */
const test = require('node:test');
const assert = require('node:assert');
const ARENA = require('../public/mechaarena.js');
const CODE  = require('../public/mechacode.js');

let n = 1;
const B = o => Object.assign({ id:n++ }, o);
const when = (ev, body) => B({ type:'when', ev, body });
const iff  = (sensor, op, v, body, els) => B({ type:'if', sensor, op, n:v, body, else:els });
const act  = type => B({ type });

/* the programs the tests fight with */
const BRAWLER = {
  left_arm : [ when('always', [ iff('enemy_distance','<',5, [act('punch')]) ]) ],
  right_arm: [ when('always', [ iff('enemy_distance','<',5, [act('punch')]) ]) ]
};
const GUARD = {
  left_arm : [ when('incoming_attack', [ act('block') ]) ],
  right_arm: [ when('incoming_attack', [ act('block') ]) ]
};
const SLEDGE = {
  left_arm : [ when('always', [ iff('enemy_distance','<',5, [act('heavy')]) ]) ]
};
const DANCER = {
  legs: [ when('incoming_attack', [ act('dodge') ]) ]
};
const NOTHING = {};

/* A player who walks at the other one and keeps facing them — which is
   what a student does, and what two bots holding W forever do not. */
function chase(m, side, opts){
  opts=opts||{};
  const me=m.robots[side], foe=m.robots[side==='A'?'B':'A'];
  const yaw=Math.atan2(foe.x-me.x, foe.z-me.z);
  const d=Math.hypot(foe.x-me.x, foe.z-me.z);
  m.setInput(side, { fwd: d>(opts.hold||2.8) ? 1 : 0, yaw, run:!!opts.run });
}
const still = (m, side, yaw) => m.setInput(side, { fwd:0, yaw:yaw||0 });

/* Run one round's worth of ticks, driving both sides. */
function fight(m, seconds, drive){
  const ticks=Math.round((seconds||20)*m.rules.hz);
  const all=[];
  for(let i=0;i<ticks && !m.over;i++){
    (drive||(()=>{ chase(m,'A'); chase(m,'B'); }))(m, i);
    const r=m.step(1/m.rules.hz);
    r.events.forEach(e=>all.push(e));
  }
  return all;
}
const core = (m,side) => m.robots[side].parts.core;
const match = (a,b,names) => new ARENA.Match({ programs:{A:a,B:b},
  names:names||{A:'A',B:'B'} });

/* ------------------------------------------------------------ the basics */

test('a program that never punches never damages anybody', ()=>{
  const m=match(NOTHING, NOTHING);
  fight(m, 20);
  assert.equal(core(m,'A'), 200);
  assert.equal(core(m,'B'), 200);
});

test('punches land on the core of somebody who never guards', ()=>{
  const m=match(BRAWLER, NOTHING);
  fight(m, 20);
  assert.ok(core(m,'B') < 200, 'the brawler should have done damage');
  assert.equal(core(m,'A'), 200, 'and taken none back');
  assert.ok(m.robots.A.stats.landed > 5);
});

test('two mechas cannot walk through each other', ()=>{
  /* The head-on case: both holding forward, straight at each other, for
     a solid minute. Leaning on somebody and sliding round them is fine
     and is what two people in a doorway do. Ending up on the far side
     without ever having been apart is not: that is walking through.

     So the two things that must hold every single tick are that they
     never overlap, and that neither of them ever jumps further in one
     tick than a mecha can travel. */
  const m=match(NOTHING, NOTHING);
  const most=ARENA.RULES.run*0.05 + ARENA.RULES.bodyR;   // a step, plus a shove
  let closest=99, jump=0;
  for(let i=0;i<60*m.rules.hz && !m.over;i++){
    const was={ A:{x:m.robots.A.x,z:m.robots.A.z}, B:{x:m.robots.B.x,z:m.robots.B.z} };
    m.setInput('A',{fwd:1,yaw:Math.PI});
    m.setInput('B',{fwd:1,yaw:0});
    m.step(0.05);
    ['A','B'].forEach(s=>{
      jump=Math.max(jump, Math.hypot(m.robots[s].x-was[s].x, m.robots[s].z-was[s].z));
    });
    closest=Math.min(closest, Math.hypot(m.robots.B.x-m.robots.A.x, m.robots.B.z-m.robots.A.z));
  }
  assert.ok(closest >= ARENA.RULES.bodyR*2 - 0.01,
    'they overlapped: closest was '+closest.toFixed(3));
  assert.ok(jump <= most, 'somebody teleported '+jump.toFixed(2)+' in one tick');
});

test('nobody leaves the arena', ()=>{
  const m=match(NOTHING, NOTHING);
  for(let i=0;i<20*m.rules.hz;i++){
    m.setInput('A',{fwd:1,yaw:i*0.05});     // walking in circles, hard
    m.setInput('B',{fwd:1,yaw:-i*0.05});
    m.step(0.05);
    ['A','B'].forEach(s=>{
      const r=m.robots[s];
      assert.ok(Math.hypot(r.x,r.z) <= ARENA.RULES.radius+0.01, s+' walked out of the arena');
    });
  }
});

/* ------------------------------------------------------- the triangle */

test('BLOCK beats PUNCH — a guard takes a quarter of it, on the arm', ()=>{
  const open=match(BRAWLER, NOTHING);   fight(open, 20);
  const shut=match(BRAWLER, GUARD);     fight(shut, 20);
  assert.ok(core(shut,'B') > core(open,'B'),
    'guarding should leave more core than standing there');
  const armWear = 200 - (shut.robots.B.parts.left_arm + shut.robots.B.parts.right_arm);
  assert.ok(armWear > 0, 'the arms should wear down from stopping punches');
});

test('HEAVY beats BLOCK — it goes through the guard', ()=>{
  const vsGuard=match(SLEDGE, GUARD);   fight(vsGuard, 25);
  const punches=match(BRAWLER, GUARD);  fight(punches, 25);
  const heavyThrough = 200-core(vsGuard,'B');
  const punchThrough = 200-core(punches,'B');
  assert.ok(heavyThrough > punchThrough,
    'heavy ('+heavyThrough+') should get more through a guard than punches ('+punchThrough+')');
});

test('PUNCH beats HEAVY — winding up a heavy roots you', ()=>{
  /* Measured across a whole windup rather than one tick of it: the
     decision lands at the end of a tick, so the first tick of a swing is
     still the walk the player asked for. */
  const m=match(SLEDGE, NOTHING);
  let moved=0, ticks=0, swung=false;
  for(let i=0;i<20*m.rules.hz;i++){
    m.setInput('A',{fwd:1,yaw:Math.atan2(m.robots.B.x-m.robots.A.x, m.robots.B.z-m.robots.A.z)});
    m.setInput('B',{fwd:0,yaw:0});
    const before={x:m.robots.A.x,z:m.robots.A.z};
    m.step(0.05);
    const l=m.robots.A.arms.left_arm;
    if(l.state==='wind' && l.act==='heavy' && l.t>0.05){
      swung=true; ticks++;
      moved+=Math.hypot(m.robots.A.x-before.x, m.robots.A.z-before.z);
    }
  }
  assert.ok(swung, 'the sledge never threw a heavy');
  const perTick=moved/ticks;
  assert.ok(perTick < ARENA.RULES.walk*0.05*0.35,
    'a heavy windup should pin you nearly still, averaged '+perTick.toFixed(3)+' a tick');
});

test('a DODGE makes the punch miss entirely', ()=>{
  const flat  = match(BRAWLER, NOTHING); fight(flat, 20);
  const nimble= match(BRAWLER, DANCER);  fight(nimble, 20);
  assert.ok(core(nimble,'B') > core(flat,'B'), 'dodging should save core');
  assert.ok(nimble.robots.B.stats.dodges > 0, 'it never dodged');
});

/* --------------------------------------------------- parts and damage */

test('a destroyed arm stops carrying out its orders', ()=>{
  const m=match(BRAWLER, NOTHING);
  m.robots.A.parts.left_arm=0;
  const before=m.robots.A.stats.punches;
  fight(m, 6);
  // the right arm still works, so punches happen — but the trace for the
  // dead one says why it is doing nothing
  let told=false;
  for(let i=0;i<20;i++){
    chase(m,'A'); chase(m,'B');
    const r=m.step(0.05);
    r.traces.A.forEach(line=>{
      if(line.part==='left_arm' && line.steps.some(s=>s.kind==='stall' && /destroyed/.test(s.why))) told=true;
    });
  }
  assert.ok(told, 'a dead arm should say it is dead rather than going quiet');
  assert.ok(m.robots.A.stats.punches > before, 'the other arm should still work');
});

test('a hit from behind lands harder and rattles the sensor', ()=>{
  const m=match(BRAWLER, NOTHING);
  // stand B with its back to A, close enough to reach
  m.robots.B.x=m.robots.A.x; m.robots.B.z=m.robots.A.z+2.8;
  const hits=[];
  for(let i=0;i<3*m.rules.hz;i++){
    m.setInput('A',{fwd:0,yaw:0});            // A looking at B's back
    m.setInput('B',{fwd:0,yaw:0});            // B looking away
    m.step(0.05).events.forEach(e=>{ if(e.kind==='hit') hits.push(e); });
  }
  assert.ok(hits.length, 'nothing landed at all');
  assert.equal(hits[0].note, 'from behind');
  assert.equal(hits[0].part, 'core');
  assert.ok(hits[0].dmg > ARENA.MOVES.punch.dmg, 'a hit from behind should hurt more');
  assert.ok(m.robots.B.parts.sensor < 100, 'the sensor should take a beating from behind');
});

test('a blind mecha stops seeing the enemy at all', ()=>{
  const m=match(BRAWLER, NOTHING);
  m.robots.A.parts.sensor=0;
  const s=ARENA.sensors(m.robots.A, m.robots.B, m.rules);
  assert.equal(s.read.enemy_distance, 99);
  assert.equal(s.events.enemy_detected, false);
  fight(m, 10);
  assert.equal(m.robots.A.stats.punches, 0, 'it should not have swung at anything');
});

test('wrecked legs slow you down', ()=>{
  const fast=match(NOTHING,NOTHING), slow=match(NOTHING,NOTHING);
  slow.robots.A.parts.legs=0;
  const walk=m=>{ const s=m.robots.A.z;
    for(let i=0;i<20;i++){ m.setInput('A',{fwd:1,yaw:Math.PI}); m.step(0.05); }
    return Math.abs(m.robots.A.z-s); };
  assert.ok(walk(slow) < walk(fast)*0.7, 'broken legs should cost real speed');
});

/* --------------------------------------------------- energy and heat */

test('energy runs out, and the trace says so rather than going quiet', ()=>{
  const m=match(BRAWLER, NOTHING);
  m.robots.B.x=m.robots.A.x; m.robots.B.z=m.robots.A.z+3;   // within reach
  let told=false;
  for(let i=0;i<10;i++){
    m.setInput('A',{fwd:0,yaw:0}); m.setInput('B',{fwd:0,yaw:0});
    m.robots.A.energy=2;                     // hold it empty
    const r=m.step(0.05);
    r.traces.A.forEach(l=>l.steps.forEach(s=>{
      if(s.kind==='stall' && /energy/.test(s.why)) told=true; }));
  }
  assert.ok(told, 'an empty tank should be stated, not silent');
  assert.ok(m.robots.A.stats.stalls > 0);
});

test('heat has a ceiling and hitting it locks the arms', ()=>{
  const m=match(SLEDGE, NOTHING);
  m.robots.B.x=m.robots.A.x; m.robots.B.z=m.robots.A.z+3;   // within reach
  m.robots.A.heat=ARENA.RULES.heatMax-1;
  m.robots.A.energy=100;
  let locked=false;
  for(let i=0;i<3*m.rules.hz;i++){
    m.setInput('A',{fwd:0,yaw:0}); m.setInput('B',{fwd:0,yaw:0});
    m.step(0.05);
    if(m.robots.A.lock>0) locked=true;
    assert.ok(m.robots.A.heat<=ARENA.RULES.heatMax+0.001, 'heat went past the top');
  }
  assert.ok(locked, 'it should have overheated');
});

/* -------------------------------------------------- rounds and result */

test('a match is best of three and says who took it', ()=>{
  const m=match(BRAWLER, NOTHING);
  let guard=0;
  while(!m.over && guard++ < 400*m.rules.hz){ chase(m,'A'); chase(m,'B'); m.step(0.05); }
  assert.ok(m.over, 'the match never ended');
  assert.equal(m.result.winner, 'A');
  assert.ok(m.result.rounds.A >= 2, 'best of three needs two rounds');
  assert.match(m.result.text, /takes it/);
});

test('the same fight, driven the same way, comes out the same twice', ()=>{
  /* The whole reason the server can decide a match and let both
     browsers draw it: nothing in here is random and nothing reads a
     clock. */
  const play=()=>{
    const m=match(BRAWLER, GUARD);
    let i=0;
    while(!m.over && i++ < 400*m.rules.hz){
      chase(m,'A',{run:i%40<20}); chase(m,'B');
      m.step(0.05);
    }
    return { result:m.result, log:m.log, A:m.robots.A.stats, B:m.robots.B.stats };
  };
  assert.deepEqual(play(), play());
});

test('a round the timer runs out on goes to whoever has more core', ()=>{
  const m=match(BRAWLER, NOTHING);
  m.clock=0.05;
  const ev=fight(m, 0.2);
  const round=ev.find(e=>e.kind==='round');
  assert.ok(round, 'the round should have ended on the clock');
  assert.equal(round.why, 'time');
});

/* ------------------------------------------------------------- the feel
   Hitstop, hitstun and knockback are not effects — they are simulation
   state, they are on the wire, and both browsers have to agree on them.
   These are the tests that keep them honest. */

/* Put two mechas nose to nose and let one of them swing. Returns the tick
   the first hit landed on, so a test can look at what happened after it. */
function brawl(m, seconds, drive){
  const ticks=Math.round((seconds||6)*m.rules.hz);
  const log=[];
  for(let i=0;i<ticks && !m.over;i++){
    (drive||(()=>{ m.setInput('A',{fwd:0,yaw:0}); m.setInput('B',{fwd:0,yaw:Math.PI}); }))(m,i);
    const r=m.step(1/m.rules.hz);
    r.events.forEach(e=>log.push(Object.assign({tick:i},e)));
  }
  return log;
}
/* B stood in front of A, facing it, close enough to be hit — and both of
   them in the MIDDLE of the floor. Put them where they spawn and they are
   a metre from the wall, so every shove pins the victim against it and a
   test that thinks it is measuring knockback is measuring the wall. */
function faceOff(a, b){
  const m=match(a, b);
  m.robots.A.x=0; m.robots.A.z=-1.5;
  m.robots.B.x=0; m.robots.B.z= 1.5;
  return m;
}

test('a landed hit freezes BOTH mechas where they stand', ()=>{
  const m=faceOff(BRAWLER, NOTHING);
  let frozen=null;
  for(let i=0;i<6*m.rules.hz && !frozen;i++){
    m.setInput('A',{fwd:1,yaw:0}); m.setInput('B',{fwd:1,yaw:0});   // both driving hard
    const was={ A:{x:m.robots.A.x,z:m.robots.A.z}, B:{x:m.robots.B.x,z:m.robots.B.z} };
    const hit=m.step(0.05).events.some(e=>e.kind==='hit');
    if(hit){
      // the tick AFTER the hit is inside the freeze: nobody may move
      const before={ A:{x:m.robots.A.x,z:m.robots.A.z}, B:{x:m.robots.B.x,z:m.robots.B.z} };
      m.step(0.05);
      frozen={
        A:Math.hypot(m.robots.A.x-before.A.x, m.robots.A.z-before.A.z),
        B:Math.hypot(m.robots.B.x-before.B.x, m.robots.B.z-before.B.z)
      };
    }
  }
  assert.ok(frozen, 'nothing ever landed');
  assert.ok(frozen.A < 1e-9, 'the attacker kept walking through its own punch');
  assert.ok(frozen.B < 1e-9, 'the victim kept walking through being hit');
});

test('a freeze stops the swing itself, not just the feet', ()=>{
  const m=faceOff(BRAWLER, NOTHING);
  let held=false;
  for(let i=0;i<6*m.rules.hz && !held;i++){
    m.setInput('A',{fwd:0,yaw:0}); m.setInput('B',{fwd:0,yaw:0});
    if(m.step(0.05).events.some(e=>e.kind==='hit')){
      const arm=m.robots.A.arms.left_arm.state, t=m.robots.A.arms.left_arm.t;
      m.step(0.05);
      held = m.robots.A.arms.left_arm.state===arm && m.robots.A.arms.left_arm.t===t;
    }
  }
  assert.ok(held, 'the arm carried on through the freeze');
});

test('being hit takes the steering away for a moment', ()=>{
  const m=faceOff(BRAWLER, NOTHING);
  let stunned=null;
  for(let i=0;i<6*m.rules.hz && !stunned;i++){
    m.setInput('A',{fwd:0,yaw:0});
    m.setInput('B',{fwd:1,yaw:Math.PI});          // B is trying to walk away
    if(m.step(0.05).events.some(e=>e.kind==='hit')) stunned=true;
  }
  assert.ok(stunned, 'nothing landed');
  // through the freeze and into the stun: B is going backwards, not forwards
  const start={x:m.robots.B.x,z:m.robots.B.z};
  for(let i=0;i<6;i++){ m.setInput('B',{fwd:1,yaw:Math.PI}); m.step(0.05); }
  const away=Math.hypot(m.robots.B.x-m.robots.A.x, m.robots.B.z-m.robots.A.z);
  const wasAway=Math.hypot(start.x-m.robots.A.x, start.z-m.robots.A.z);
  assert.ok(away>wasAway, 'the shove should have carried them, not their driving');
});

test('a mecha in hitstun takes no new orders', ()=>{
  const m=faceOff(BRAWLER, BRAWLER);
  let seen=false;
  for(let i=0;i<8*m.rules.hz && !seen;i++){
    m.setInput('A',{fwd:0,yaw:0}); m.setInput('B',{fwd:0,yaw:Math.PI});
    const r=m.step(0.05);
    if(m.robots.B.stun>0 && m.robots.B.stop<=0){
      // asked while stunned? nothing may come back with an action in it
      const acted=r.traces.B.some(l=>l.steps.some(s=>s.kind==='action'));
      assert.equal(acted, false, 'a stunned mecha started a new move');
      seen=true;
    }
  }
  assert.ok(seen, 'B was never caught in hitstun');
});

test('a punch throws them away from whoever threw it', ()=>{
  const m=faceOff(BRAWLER, NOTHING);
  let before=null, after=null;
  for(let i=0;i<6*m.rules.hz && !after;i++){
    m.setInput('A',{fwd:0,yaw:0}); m.setInput('B',{fwd:0,yaw:Math.PI});
    if(!before) before=Math.hypot(m.robots.B.x-m.robots.A.x, m.robots.B.z-m.robots.A.z);
    if(m.step(0.05).events.some(e=>e.kind==='hit')){
      for(let k=0;k<8;k++) m.step(0.05);
      after=Math.hypot(m.robots.B.x-m.robots.A.x, m.robots.B.z-m.robots.A.z);
    }
  }
  assert.ok(after>before+0.5, 'they should have been pushed back, '+before+' → '+after);
});

test('a heavy throws them further than a punch does', ()=>{
  const push=(prog)=>{
    const m=faceOff(prog, NOTHING);
    let d=null;
    for(let i=0;i<8*m.rules.hz && d===null;i++){
      m.setInput('A',{fwd:0,yaw:0}); m.setInput('B',{fwd:0,yaw:Math.PI});
      if(m.step(0.05).events.some(e=>e.kind==='hit')){
        for(let k=0;k<10;k++) m.step(0.05);
        d=Math.hypot(m.robots.B.x-m.robots.A.x, m.robots.B.z-m.robots.A.z);
      }
    }
    return d;
  };
  const light=push(BRAWLER), heavy=push(SLEDGE);
  assert.ok(heavy!==null && light!==null, 'one of them never landed');
  assert.ok(heavy>light, 'a heavy ('+heavy.toFixed(1)+') should out-throw a punch ('+light.toFixed(1)+')');
});

test('a guard takes the sting out of the shove as well as the damage', ()=>{
  const push=(defence)=>{
    const m=faceOff(BRAWLER, defence);
    let d=null;
    for(let i=0;i<8*m.rules.hz && d===null;i++){
      m.setInput('A',{fwd:0,yaw:0}); m.setInput('B',{fwd:0,yaw:Math.PI});
      if(m.step(0.05).events.some(e=>e.kind==='hit')){
        for(let k=0;k<10;k++) m.step(0.05);
        d=Math.hypot(m.robots.B.x-m.robots.A.x, m.robots.B.z-m.robots.A.z);
      }
    }
    return d;
  };
  assert.ok(push(GUARD) < push(NOTHING), 'blocking should keep you closer than eating it');
});

test('the shove grows as the core goes', ()=>{
  const push=(core)=>{
    const m=faceOff(BRAWLER, NOTHING);
    m.robots.B.parts.core=core;
    let d=null;
    for(let i=0;i<8*m.rules.hz && d===null;i++){
      m.setInput('A',{fwd:0,yaw:0}); m.setInput('B',{fwd:0,yaw:Math.PI});
      if(m.step(0.05).events.some(e=>e.kind==='hit')){
        for(let k=0;k<10;k++) m.step(0.05);
        d=Math.hypot(m.robots.B.x-m.robots.A.x, m.robots.B.z-m.robots.A.z);
      }
    }
    return d;
  };
  assert.ok(push(30) > push(200), 'a nearly-dead mecha should be thrown further');
});

test('nobody is knocked out of the arena', ()=>{
  const m=faceOff(SLEDGE, NOTHING);
  // stand them both against the wall so every shove is aimed at the edge
  const R=ARENA.RULES.radius-ARENA.RULES.bodyR;
  m.robots.A.x=0; m.robots.A.z=R-4;
  m.robots.B.x=0; m.robots.B.z=R-1;
  for(let i=0;i<10*m.rules.hz;i++){
    m.setInput('A',{fwd:1,yaw:0}); m.setInput('B',{fwd:0,yaw:Math.PI});
    m.step(0.05);
    ['A','B'].forEach(s=>assert.ok(Math.hypot(m.robots[s].x,m.robots[s].z) <= ARENA.RULES.radius+0.01,
      s+' was thrown out of the arena'));
  }
});

test('the freeze and the stun are on the wire, or the client predicts through them', ()=>{
  const m=faceOff(BRAWLER, NOTHING);
  let snap=null;
  for(let i=0;i<6*m.rules.hz && !snap;i++){
    m.setInput('A',{fwd:0,yaw:0}); m.setInput('B',{fwd:0,yaw:Math.PI});
    if(m.step(0.05).events.some(e=>e.kind==='hit')) snap=m.snapshot();
  }
  assert.ok(snap, 'nothing landed');
  assert.ok(snap.A.fz > 0, 'the attacker\'s freeze is not in the snapshot');
  assert.ok(snap.B.fz > 0, 'the victim\'s freeze is not in the snapshot');
  assert.ok(snap.B.st > 0, 'the victim\'s stun is not in the snapshot');
});

test('a hit says how long the world stops for, so the picture can shake for exactly that long', ()=>{
  const m=faceOff(BRAWLER, NOTHING);
  const log=brawl(m, 6);
  const hit=log.find(e=>e.kind==='hit');
  assert.ok(hit, 'nothing landed');
  assert.ok(hit.stop > 0);
});
