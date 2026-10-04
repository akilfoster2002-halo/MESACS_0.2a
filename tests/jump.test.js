/* THE JUMP AND THE LINE (public/boots.js, techniques 'charge' and 'grapple').

   The jump is not chosen for you any more: hold SPACE and let go, and the
   longer the hold the higher she goes. Press it again as her feet touch and
   the next one is a tier higher, and the next, and the next; miss the beat
   and it starts again. And the line: a rope to a building, a pendulum on it,
   speed kept when you let go. Flown with no browser, like tests/boots.test.js. */
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
const flat = { solids:[], ground:()=>0 };
function run(B, b, secs, keys){
  const dt = 1/60, apexes = []; let held = false, up = false, top = 0, t = 0;
  const events = [];
  for(; t<secs; t+=dt){
    const k = keys(t, b) || {};
    const inp = { z:0, x:0, yaw:0, jump:!!k.space, jumpEdge:!!k.space && !held, shift:false };
    held = !!k.space;
    B.step(b, inp, dt, flat).forEach(e=>events.push(Object.assign({ t }, e)));
    if(!b.ground){ up = true; top = Math.max(top, b.y); }
    else if(up){ apexes.push(top); up = false; top = 0; }
  }
  return { apexes, events };
}

test('the height is how long SPACE was held, and she goes when it is let go', ()=>{
  const B = boots();
  const tap = run(B, B.body(), 2, t=>({ space:t < 0.04 }));
  const full = B.body(); let liftedWhileHeld = false;
  const f = run(B, full, 3, (t, b)=>{ if(t < 0.8 && b.y > 0.01) liftedWhileHeld = true; return { space:t < 0.8 }; });
  assert.ok(!liftedWhileHeld, 'she left the ground while SPACE was still held');
  assert.ok(tap.apexes[0] > 1 && tap.apexes[0] < 3, 'a tap is a hop, went ' + tap.apexes[0].toFixed(1));
  assert.ok(f.apexes[0] > 6 && f.apexes[0] < 11, 'a full charge goes 6–11 m, went ' + f.apexes[0].toFixed(1));
  const half = run(B, B.body(), 3, t=>({ space:t < 0.35 })).apexes[0];
  assert.ok(half > tap.apexes[0] && half < f.apexes[0], 'half a charge is in between');
});

test('jumps in time go higher and higher; a missed beat starts again', ()=>{
  const B = boots(), b = B.body();
  // the player: press as her feet touch, hold 0.3 s, let go. After the fourth jump, wait a second on the ground first.
  let jumps = 0, pressAt = 0, wasUp = false, waitUntil = -1;
  const r = run(B, b, 14, (t, bb)=>{
    if(!bb.ground) wasUp = true;
    if(bb.ground && wasUp){ wasUp = false; jumps++; pressAt = jumps === 4 ? t + 1.0 : t; }
    return { space: t >= pressAt && t - pressAt < 0.3 };
  });
  const tiers = r.events.filter(e=>e.name === 'jump' || e.name === 'jumpPerfect').map(e=>e.combo);
  assert.deepStrictEqual(tiers.slice(0, 4), [0, 1, 2, 3], 'four jumps in time climb the tiers, got ' + tiers);
  const a = r.apexes;
  assert.ok(a[1] > a[0]*1.3 && a[2] > a[1]*1.2 && a[3] > a[2]*1.2, 'each one higher: ' + a.slice(0, 4).map(x=>x.toFixed(1)));
  assert.strictEqual(tiers[4], 0, 'after a missed beat the next jump is back to the first tier, got ' + tiers);
});

test('the line holds her on a pendulum, and she swings through and up the far side', ()=>{
  const B = boots();
  const anchor = { x:0, y:40, z:0 };
  // hanging 20 m out from under the hook, at its height minus 20: let go of her and she swings
  const b = B.body({ x:0, y:40 - 20 - B.HAND, z:20, ground:false, state:'swing', vy:0, airT:1 });
  b.rope = { x:anchor.x, y:anchor.y, z:anchor.z, len:Math.hypot(20, 20), want:Math.hypot(20, 20) };
  let worst = 0, minZ = Infinity, fastest = 0;
  for(let i=0;i<240;i++){
    B.step(b, { z:0, x:0, yaw:0, jump:false, jumpEdge:false, shift:false }, 1/60, flat);
    const d = Math.hypot(b.x - anchor.x, b.y + B.HAND - anchor.y, b.z - anchor.z);
    worst = Math.max(worst, d - b.rope.len); minZ = Math.min(minZ, b.z); fastest = Math.max(fastest, Math.hypot(b.vx, b.vy, b.vz));
  }
  assert.ok(worst < 0.05, 'she drifted off the end of the line by ' + worst.toFixed(2) + ' m');
  assert.ok(minZ < -10, 'she did not swing through to the other side (got to z ' + minZ.toFixed(1) + ')');
  assert.ok(fastest > 15, 'the bottom of the swing is fast, got ' + fastest.toFixed(1) + ' m/s');
});

test('the game teaches the charged jump and the line, not the bound', ()=>{
  const B = boots();
  assert.ok(B.TECH.early.includes('charge') && B.TECH.early.includes('grapple'));
  assert.ok(!B.ALL.includes('bound'), 'the bound is still handed out');
  const tsh = fs.readFileSync(path.join(__dirname, '..', 'public', 'tsh.js'), 'utf8');
  assert.match(tsh, /id:'charge'/); assert.match(tsh, /id:'combo'/); assert.match(tsh, /id:'grapple'/);
  assert.ok(!/id:'bound'/.test(tsh), 'the lesson still teaches the bound');
});
