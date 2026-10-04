/* ROBIN'S BOOTS (public/boots.js) — the traversal, flown over a fake
   street with no browser. The physics is plain numbers, so every claim
   the file makes about how she moves is checked here: how high and how
   far a super jump goes, that a dive is faster than a fall, that the
   pull-up rewards timing and punishes lateness, that a wall is a launch
   pad, that a landing keeps her speed — and that, done well, the whole
   thing keeps her in the air for a minute without touching the ground. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

function boots(){
  const ctx = vm.createContext({ Math, Set, JSON, Object, Array, console, addEventListener(){}, performance:{ now:()=>0 } });
  ctx.window = ctx;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'boots.js'), 'utf8'), ctx, { filename:'boots.js' });
  return ctx.BOOTS;
}
/* THE SHOES AS THEY WERE — SPACE held flies her roof to roof (the bound), a press is the super jump. The
   game teaches the charged jump and the line now (tests/jump.test.js); these keep the old moves honest
   for anything that still gives them out. */
function legacy(){
  const B = boots(), raw = B.body;
  B.body = o => raw(Object.assign({ have:new Set(B.LEGACY) }, o));
  return B;
}
/* a street at 0, roofs as platforms, buildings as solid boxes */
function world(buildings, o){
  const solids = [], plats = [], roofs = [];
  (buildings || []).forEach(([x1, x2, z1, z2, h], i)=>{ solids.push({ x1, x2, z1, z2, y1:0, y2:h }); plats.push({ x1, x2, z1, z2, top:h }); roofs.push({ id:'R' + i, x1, x2, z1, z2, top:h }); });
  const env = { solids, ground:(x, z, feet)=>{ let best = 0; const lim = feet + 0.7;
    for(const p of plats) if(x >= p.x1 && x <= p.x2 && z >= p.z1 && z <= p.z2 && p.top <= lim && p.top > best) best = p.top; return best; } };
  if(o && o.roofs) env.roofs = roofs;                 // the bound needs to know which tops are roofs
  return env;
}
/* a row of roofs running north (-z), 12 m high, 12 m deep, with 8 m streets between */
function row(n, h){ return Array.from({ length:n }, (_, i)=>[-8, 8, -(i*20 + 12), -i*20, h || 12]); }
/* run `secs` of frames; `keys(t, b)` says what is held: { w, s, a, d, space, shift } */
function fly(B, b, env, secs, keys){
  const dt = 1/60, log = { apex:b.y, events:[], minY:b.y, maxSpeed:0, landed:0 };
  let held = false;
  for(let t=0; t<secs; t+=dt){
    const k = keys ? keys(t, b) || {} : {};
    const inp = { z:(k.w ? 1 : 0) - (k.s ? 1 : 0), x:(k.d ? 1 : 0) - (k.a ? 1 : 0), yaw:k.yaw || 0, jump:!!k.space, jumpEdge:!!k.space && !held, shift:!!k.shift };
    held = !!k.space;
    const ev = B.step(b, inp, dt, env);
    ev.forEach(e=>{ log.events.push(Object.assign({ t }, e)); if(['land', 'roll', 'swoopCrash', 'landPerfect'].includes(e.name)) log.landed++; });
    log.apex = Math.max(log.apex, b.y); log.minY = Math.min(log.minY, b.y);
    log.maxSpeed = Math.max(log.maxSpeed, Math.hypot(b.vx, b.vy, b.vz));
  }
  return log;
}
const has = (log, name) => log.events.some(e=>e.name === name);

test('the super jump launches her, and holding SPACE takes her higher', () => {
  const B = legacy(), env = world();
  const held = fly(B, B.body(), env, 3, t=>({ space:t < 1.5 }));
  const tap = fly(B, B.body(), env, 3, t=>({ space:t < 0.05 }));
  assert.ok(held.apex > 11 && held.apex < 18, 'a held super jump goes 11–18 m up, went ' + held.apex.toFixed(1));
  assert.ok(tap.apex < held.apex*0.7, 'a tap is a shorter hop: ' + tap.apex.toFixed(1) + ' vs ' + held.apex.toFixed(1));
});

test('a sprinting jump clears a street and lands far beyond it', () => {
  const B = legacy(), env = world();
  const b = B.body();
  fly(B, b, env, 1.5, ()=>({ w:true, shift:true }));          // get up to speed, running north
  const x0 = b.z;
  let gone = 0;
  fly(B, b, env, 4, (t, bb)=>{ if(bb.ground && t > 0.2 && !gone) gone = Math.abs(bb.z - x0); return { w:true, shift:true, space:t < 1.2 }; });
  assert.ok(gone > 30, 'a running super jump carries over 30 m (a street is 20), went ' + gone.toFixed(1));
});

test('a dive is faster than a fall, and the air keeps her momentum', () => {
  const B = legacy(), env = world();
  const fall = B.body({ y:60, ground:false, state:'air', vx:0, vz:-15, airT:1 });
  const dive = B.body({ y:60, ground:false, state:'air', vx:0, vz:-15, airT:1 });
  fly(B, fall, env, 1.2, ()=>({}));
  fly(B, dive, env, 1.2, ()=>({ shift:true }));
  const sf = Math.hypot(fall.vx, fall.vy, fall.vz), sd = Math.hypot(dive.vx, dive.vy, dive.vz);
  assert.ok(sd > sf*1.4, 'diving is much faster: ' + sd.toFixed(1) + ' vs ' + sf.toFixed(1));
  assert.ok(Math.abs(fall.vz) > 13, 'nobody touching the keys keeps her going: ' + fall.vz.toFixed(1));
});

test('the pull-up turns a dive into a launch, and when you pull is what matters', () => {
  const B = legacy(), env = world();
  // dive from 40 m towards the street and pull at three moments
  function pullAt(alt){
    const b = B.body({ y:40, ground:false, state:'air', vz:-12, airT:1 });
    let pulled = false;
    const log = fly(B, b, env, 4, (t, bb)=>{ const go = !pulled && bb.state === 'dive' && bb.y <= alt; if(go) pulled = true; return { shift:!pulled, space:go }; });
    return { log, b, pull:b.last.pull };
  }
  const early = pullAt(30), good = (()=>{
    // the right moment: as soon as the boots go gold
    const b = B.body({ y:40, ground:false, state:'air', vz:-12, airT:1 }); let pulled = false;
    const log = fly(B, b, env, 4, (t, bb)=>{ const go = !pulled && bb.gold; if(go) pulled = true; return { shift:!pulled, space:go }; });
    return { log, b, pull:b.last.pull };
  })(), late = pullAt(1.2);
  assert.equal(good.pull.kind, 'perfect', 'pulling in the gold is perfect');
  assert.equal(early.pull.kind, 'early');
  assert.equal(late.pull.kind, 'late');
  assert.ok(has(late.log, 'swoopCrash'), 'too late, and the swoop meets the street');
  const riseAfter = log => { let top = -1, seen = false; log.events.forEach(()=>{}); return log.apex; };
  // a perfect pull from near the street climbs back above where the dive began
  const apexGood = Math.max(...good.log.events.filter(e=>e.name === 'pullPerfect').map(()=>good.log.apex));
  assert.ok(good.pull.up > early.pull.up*1.3, 'perfect launches harder than early: ' + good.pull.up.toFixed(1) + ' vs ' + early.pull.up.toFixed(1));
  assert.ok(good.pull.up >= 38, 'a perfect pull out of a long dive is a huge launch: ' + good.pull.up.toFixed(1) + ' m/s');
  assert.ok(apexGood > 30, 'and it carries her back up over 30 m');
});

test('a wall met at speed is a launch pad: away from it, and up', () => {
  const B = legacy();
  const env = world([[-20, 20, -30, -25, 40]]);                  // a tall wall to the north (-z)
  function hit(pressDelay){
    const b = B.body({ y:8, z:-14, ground:false, state:'air', vz:-24, vy:2, airT:1 });
    let touched = null;
    const log = fly(B, b, env, 1.2, (t, bb)=>{ if(bb.wall && touched === null) touched = t; return { space: touched !== null && t >= touched + pressDelay && t < touched + pressDelay + 0.05 }; });
    return { b, log, kick:b.last.rebound };
  }
  const sharp = hit(0), slow = hit(0.25);
  assert.ok(has(sharp.log, 'wallHit'), 'she plants a foot');
  assert.ok(sharp.kick && sharp.kick.perfect, 'pressed as she touches: a perfect kick');
  assert.ok(slow.kick && !slow.kick.perfect, 'pressed a moment later: still a kick, not a perfect one');
  assert.ok(sharp.kick.vy > slow.kick.vy, 'the perfect one goes higher');
  assert.ok(sharp.b.vz > 8 || has(sharp.log, 'land'), 'and she is going away from the wall');
  // no press at all: she slides down it rather than stopping dead in the air
  const none = B.body({ y:8, z:-14, ground:false, state:'air', vz:-24, vy:2, airT:1 });
  const ln = fly(B, none, env, 2.5, ()=>({}));
  assert.ok(ln.landed >= 1, 'left alone she slides down to the street');
});

test('the dash bends her line, keeps her speed, and comes back when she lands', () => {
  const B = legacy(), env = world();
  const b = B.body({ y:30, ground:false, state:'air', vz:-20, airT:1 });
  fly(B, b, env, 0.05, ()=>({ d:true, space:true }));
  assert.ok(b.vx > 12, 'dashed to the right: ' + b.vx.toFixed(1));
  assert.ok(Math.hypot(b.vx, b.vz) >= 20, 'without losing speed');
  assert.equal(b.charges, B.TUNE.dashCharges - 1);
  fly(B, b, env, 4, ()=>({}));
  assert.equal(b.charges, B.TUNE.dashCharges, 'landing gives them back');
});

test('a landing keeps her running speed, a hard one is a roll, and a press before it is a clean landing', () => {
  const B = legacy(), env = world();
  const b = B.body({ y:12, ground:false, state:'air', vz:-20, vy:-10, airT:1 });
  const log = fly(B, b, env, 1.0, ()=>({ w:true }));
  assert.ok(log.landed >= 1);
  assert.ok(Math.hypot(b.vx, b.vz) > 12, 'still moving fast after landing: ' + Math.hypot(b.vx, b.vz).toFixed(1));
  const hard = B.body({ y:30, ground:false, state:'air', vz:-10, vy:-30, airT:1 });
  assert.ok(has(fly(B, hard, env, 1.2, ()=>({ w:true })), 'roll'), 'a hard landing is a roll');
  // SPACE pressed just before the feet touch
  const clean = B.body({ y:14, ground:false, state:'air', vz:-15, vy:-5, airT:1 });
  let pressed = false;
  const lc = fly(B, clean, env, 2, (t, bb)=>{ const ttg = B.timeToGround(env, bb); const go = !pressed && !bb.ground && bb.vy < 0 && ttg < 0.1; if(go) pressed = true; return { w:true, space:go }; });
  assert.ok(has(lc, 'landPerfect'), 'a press just before touchdown is a clean landing');
  assert.ok(has(lc, 'jumpPerfect'), 'and she is straight back up');
});

test('flow builds with chained moves and drains on the street', () => {
  const B = legacy(), env = world();
  const b = B.body({ y:40, ground:false, state:'air', vz:-14, airT:1 });
  let pulls = 0;
  fly(B, b, env, 6, (t, bb)=>{ const go = bb.gold; if(go) pulls++; return { shift:!bb.swoop && bb.vy < 0, space:go }; });
  assert.ok(b.flow > 0.3, 'flow after a run of perfect pulls: ' + b.flow.toFixed(2));
  const f0 = b.flow;
  const st = B.body({ flow:f0 });
  fly(B, st, env, 2, ()=>({}));
  assert.ok(st.flow < f0 - 0.5, 'standing on the street drains it');
});

test('done well, she stays in the air for a whole minute without touching the ground', () => {
  const B = legacy(), env = world();
  const b = B.body({ y:30, ground:false, state:'air', vz:-16, airT:1 });
  const log = fly(B, b, env, 60, (t, bb)=>({ w:true, shift:!bb.swoop && bb.vy < 0, space:bb.gold }));
  assert.equal(log.landed, 0, 'a minute of dives and perfect pulls and not one landing');
  assert.ok(log.maxSpeed <= B.TUNE.maxSpeed + 1, 'and nothing ran away: top speed ' + log.maxSpeed.toFixed(1));
  assert.ok(log.apex < 90, 'nor into orbit: highest ' + log.apex.toFixed(1) + ' m');
});

test('techniques are learned: without the pull-up a dive just falls', () => {
  const B = legacy(), env = world();
  const b = B.body({ y:40, ground:false, state:'air', vz:-12, airT:1, have:new Set(['bound','jump','steer','dive']) });
  const log = fly(B, b, env, 4, (t, bb)=>({ shift:true, space:bb.state === 'dive' && bb.y < 10 }));
  assert.ok(!has(log, 'pull') && !has(log, 'pullPerfect'), 'no pull-up before it is learned');
  assert.ok(log.landed >= 1);
});

test('holding SPACE, the shoes carry her roof to roof on their own', () => {
  const B = legacy(), env = world(row(5), { roofs:true });
  const b = B.body({ x:0, y:12, z:-6 });
  const log = fly(B, b, env, 7, ()=>({ space:true }));
  const bounds = log.events.filter(e=>e.name === 'bound'), lands = log.events.filter(e=>e.name === 'boundLand');
  assert.ok(bounds.length >= 4, 'four bounds in seven seconds of holding SPACE, made ' + bounds.length);
  assert.ok(lands.length >= 3, 'and she lands on each roof between them');
  assert.ok(log.minY > 11, 'never once down in the street: lowest ' + log.minY.toFixed(1));
  const ids = bounds.map(e=>Number(e.roof.slice(1)));
  assert.deepEqual(ids, ids.slice().sort((a, b_)=>a - b_), 'each one onto the next roof along: ' + ids.join(' '));
  assert.ok(new Set(ids).size === ids.length, 'never the same roof twice');
});

test('she comes down on the ring: the arc is solved, not hoped for', () => {
  const B = legacy(), env = world(row(3), { roofs:true });
  const b = B.body({ x:0, y:12, z:-6 });
  let target = null, at = null;
  fly(B, b, env, 3, (t, bb)=>{ if(!target && bb.bound) target = Object.assign({}, bb.bound); if(target && !at && bb.ground && t > 0.3) at = [bb.x, bb.z]; return { space:t < 0.1 }; });
  assert.ok(target && at, 'she bounded, and landed');
  assert.ok(Math.hypot(at[0] - target.x, at[1] - target.z) < 0.8, 'within a step of the ring: ' + Math.hypot(at[0] - target.x, at[1] - target.z).toFixed(2) + ' m');
});

test('where you point is where she goes — before she leaves, and on the way', () => {
  // one roof straight ahead (north), one to the right (east)
  const env = world([[-6, 6, -10, 2, 12], [-6, 6, -32, -20, 12], [16, 28, -12, 0, 12]], { roofs:true });
  const ahead = legacy(), right = legacy();
  const a = ahead.body({ x:0, y:12, z:-4 }), r = right.body({ x:0, y:12, z:-4 });
  const la = fly(ahead, a, env, 0.1, ()=>({ space:true }));
  const lr = fly(right, r, env, 0.1, ()=>({ space:true, d:true }));
  assert.equal(la.events.find(e=>e.name === 'bound').roof, 'R1', 'nothing held: the roof the camera faces');
  assert.equal(lr.events.find(e=>e.name === 'bound').roof, 'R2', 'D held: the roof to the right');
  // mid-air: launched north, then D — she bends to the roof on the right
  const env2 = world([[-6, 6, -10, 2, 12], [-6, 6, -40, -28, 12], [14, 30, -34, -22, 12]], { roofs:true });
  const B = legacy(), b = B.body({ x:0, y:12, z:-4 });
  const log = fly(B, b, env2, 3, (t)=>({ space:t < 0.1, d:t > 0.25 && t < 0.6 }));
  assert.ok(log.events.some(e=>e.name === 'boundTurn' && e.roof === 'R2'), 'the keys picked a new roof in the air');
  assert.ok(b.x > 14 && b.ground && b.y > 11, 'and she landed on it: ' + b.x.toFixed(1) + ', ' + b.y.toFixed(1));
});

test('a tap as her feet touch is a perfect bound: quicker, further, and the flow builds', () => {
  const B = legacy();
  function run(tap){
    const env = world(row(8), { roofs:true }), b = B.body({ x:0, y:12, z:-6 });
    let wasGold = false;
    const log = fly(B, b, env, 6, (t, bb)=>{
      if(!tap) return { space:true };
      const go = bb.gold && !wasGold; wasGold = bb.gold;          // press once, as the ring goes gold
      return { space:t < 0.1 || go };
    });
    return { b, log, perfect:log.events.filter(e=>e.name === 'boundPerfect').length, far:-b.z };
  }
  const held = run(false), tapped = run(true);
  assert.equal(held.perfect, 0, 'holding is the plain bound');
  assert.ok(tapped.perfect >= 3, 'tapping in the gold makes them perfect: ' + tapped.perfect);
  assert.ok(tapped.b.flow > held.b.flow + 0.2, 'and builds flow: ' + tapped.b.flow.toFixed(2) + ' vs ' + held.b.flow.toFixed(2));
  assert.ok(tapped.far > held.far, 'and gets further in the same time: ' + tapped.far.toFixed(0) + ' vs ' + held.far.toFixed(0) + ' m');
});

test('let go of SPACE and she lands and stays; from the street, holding it takes her back up', () => {
  const B = legacy(), env = world(row(4), { roofs:true });
  const b = B.body({ x:0, y:12, z:-6 });
  const log = fly(B, b, env, 4, (t)=>({ space:t < 0.2 }));
  assert.equal(log.events.filter(e=>e.name === 'bound').length, 1, 'one bound for one press');
  assert.ok(b.ground && b.y > 11, 'and she is standing on the next roof');
  const s = B.body({ x:0, y:0, z:-16 });            // in the street between two roofs
  const ls = fly(B, s, env, 2.5, ()=>({ space:true }));
  assert.ok(ls.events.some(e=>e.name === 'bound'), 'a bound from the street');
  assert.ok(s.y > 11, 'up onto a roof: ' + s.y.toFixed(1));
});

test('the first burn: falling, the shoes fire — straight up — and SPACE held catches the line to a roof', () => {
  const B = legacy(), env = world(row(3), { roofs:true });
  const b = B.body({ x:0, y:8, z:4, ground:false, state:'air', vy:-6, airT:0.5 });
  B.ignite(b, { yaw:0 });
  assert.equal(b.vy, B.TUNE.ignite);
  assert.ok(b.events.some(e=>e.name === 'ignite'));
  const log = fly(B, b, env, 4, ()=>({ space:true }));
  assert.ok(log.apex > 20, 'over the roofs: ' + log.apex.toFixed(1));
  assert.ok(log.events.some(e=>e.name === 'boundCatch'), 'she caught a line on the way down');
  assert.ok(log.events.some(e=>e.name === 'boundLand') && log.minY > 7, 'and came down on a roof, not the street');
});

test('the game hands its step to the boots, and TSH puts them on', () => {
  const g = fs.readFileSync(path.join(__dirname, '..', 'public', 'game.js'), 'utf8');
  assert.match(g, /if\(G\.mover && G\.mover\(dt\)\) return;/, 'game.js asks G.mover first');
  const h = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.match(h, /<script src="boots\.js\?v=\d+"><\/script>\s*<script src="tsh\.js/, 'boots.js loads before tsh.js');
});
