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

test('a release in the gold throws her further than letting go on the way down', ()=>{
  const B = boots();
  const fly = (gold)=>{
    const b = B.body({ y:10, ground:false, state:'swing', vx:0, vz:-22, vy: gold ? 8 : -6, airT:1 });
    b.rope = { x:0, y:40, z:-10, len:30, want:30, t:1, gold, past: gold ? 0.6 : -0.2, fx:0, fz:-1 };
    // release() works on the attached body; this is the same arithmetic, flown to the ground
    const T = B.TUNE;
    if(gold){ b.vx *= T.perfectBoost; b.vz *= T.perfectBoost; b.vy = b.vy*T.perfectBoost + T.perfectUp; }
    b.rope = null; b.state = 'air'; b.hang = T.hangTime;
    let t = 0; const z0 = b.z;
    while(!b.ground && t < 10){ B.step(b, { z:0, x:0, yaw:0, jump:false, jumpEdge:false, shift:false }, 1/60, flat); t += 1/60; }
    return Math.abs(b.z - z0);
  };
  assert.ok(fly(true) > fly(false)*1.5, 'a gold release should carry much further');
});

test('the web swing is Spider-Man’s: found, not aimed; it chains while R is held; the clips are hers', ()=>{
  const tsh = fs.readFileSync(path.join(__dirname, '..', 'public', 'tsh.js'), 'utf8');
  assert.match(tsh, /function webAnchor\(\)/, 'the web is aimed again');
  assert.match(tsh, /HOLD R AND IT KEEPS SWINGING/);
  const boots_ = fs.readFileSync(path.join(__dirname, '..', 'public', 'boots.js'), 'utf8');
  assert.match(boots_, /THE SWING IS ALONG THE STREET, NOT ROUND THE WALL/, 'a side wall swings her round it like a tetherball');
  const b = fs.readFileSync(path.join(__dirname, '..', 'public/characters/swing/robin.glb'));
  const json = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const names = (json.animations || []).map(a=>a.name);
  ['web_swing', 'web_flip', 'web_start', 'hard_land'].forEach(n=>assert.ok(names.includes(n), 'swing/robin.glb has no ' + n));
  assert.ok(!json.meshes || !json.meshes.length, 'the swing file carries a body: it should be clips only');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.css'), 'utf8');
  assert.match(css, /#tsh \.tsh-obj\{display:none !important\}/, 'the objective panel is back');
});

test('off the web she flies: her speed holds her up, so she carries far further than a plain fall', ()=>{
  const B = boots();
  const go = fly=>{
    const b = B.body({ y:20, ground:false, state:'air', vx:0, vz:-35, vy:4, airT:1 });
    if(fly){ b.fly = b.flyMax = B.TUNE.flyTime*1.4; }
    let t = 0; const z0 = b.z;
    while(!b.ground && t < 12){ B.step(b, { z:0, x:0, yaw:0, jump:false, jumpEdge:false, shift:false }, 1/60, flat); t += 1/60; }
    return { d:Math.abs(b.z - z0), t };
  };
  const plain = go(false), flown = go(true);
  assert.ok(flown.t > plain.t*1.3, 'she should stay up much longer flying: ' + flown.t.toFixed(2) + ' s vs ' + plain.t.toFixed(2));
  assert.ok(flown.d > plain.d*1.3, 'and carry much further along her line: ' + flown.d.toFixed(0) + ' m vs ' + plain.d.toFixed(0));
});

test('down from a height she somersaults, and rolls on forward even off a straight drop', ()=>{
  const B = boots();
  const b = B.body({ y:12, ground:false, state:'air', vx:0, vz:0, vy:0, airT:1, faceY:Math.PI });   // facing -z
  const ev = []; let t = 0;
  while(t < 3){ B.step(b, { z:0, x:0, yaw:0, jump:false, jumpEdge:false, shift:false }, 1/60, flat).forEach(e=>ev.push(e)); t += 1/60; }
  const r = ev.find(e=>e.name === 'roll');
  assert.ok(r && r.somersault, 'a 12 m drop is not a somersault: ' + ev.map(e=>e.name).join(','));
  assert.ok(Math.abs(b.z) > 2, 'the somersault did not carry her forward');
  const low = B.body({ y:1.5, ground:false, state:'air', vy:0, airT:1 }); const ev2 = [];
  for(let i=0;i<90;i++) B.step(low, { z:0, x:0, yaw:0, jump:false, jumpEdge:false, shift:false }, 1/60, flat).forEach(e=>ev2.push(e));
  assert.ok(!ev2.some(e=>e.name === 'roll'), 'a hop off a kerb is not a somersault');
});

test('every move scores, the chain banks into XP that is kept, and the city has coins to collect', ()=>{
  const sc = fs.readFileSync(path.join(__dirname, '..', 'public', 'tshscore.js'), 'utf8');
  ['rope', 'releasePerfect', 'webJump', 'rebound', 'pull', 'dash', 'roll', 'coin', 'climb'].forEach(k=>assert.match(sc, new RegExp('\\b' + k + ':\\d+'), 'no points for ' + k));
  assert.match(sc, /localStorage\.setItem\(k, String\(v\)\)/, 'XP is not kept');
  assert.match(sc, /if\(n === 'swoopCrash'\) return lose\(\);/, 'a crash does not lose the chain');
  assert.match(sc, /function scatter\(W\)/);
  const tsh = fs.readFileSync(path.join(__dirname, '..', 'public', 'tsh.js'), 'utf8');
  assert.match(tsh, /TSHSCORE\.attach\(W\.cityGroup, W/); assert.match(tsh, /TSHSCORE\.trick\(e, b\)/); assert.match(tsh, /TSHSCORE\.detach\(\)/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.indexOf('tshscore.js') > html.indexOf('tshnyc.js'), 'tshscore.js must load after tshnyc.js');
});
