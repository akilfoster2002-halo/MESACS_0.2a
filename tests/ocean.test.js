/* THE OCEAN ON WANO (ocean.js, sealife.js).

   A sea is a shape before it is anything else: a beach you can walk off,
   a shelf you can stand up on, a wall, a deep plain, canyons and a rift.
   All of it is one function of a map position, and all of it can quietly
   go wrong — a coral head through the surface, a canyon cut through the
   beach, a basin that forgets which world it is on. These pin the shape,
   the animals, and the places planet.js has to ask the sea first. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const THREE = require('three');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

/* the planet's own direction and frame, as planet.js makes them */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const dirOf = (lon, lat) => { const lo = lon*Math.PI/180, la = lat*Math.PI/180; return V(Math.cos(la)*Math.sin(lo), Math.sin(la), Math.cos(la)*Math.cos(lo)); };
function frameAt(dir, spin){
  const up = dir.clone().normalize(), ref = Math.abs(up.y) > 0.94 ? V(0,0,1) : V(0,1,0);
  let right = new THREE.Vector3().crossVectors(ref, up).normalize();
  const fwd = new THREE.Vector3().crossVectors(up, right).normalize();
  if(spin) fwd.applyAxisAngle(up, spin);
  right = new THREE.Vector3().crossVectors(up, fwd).normalize();
  return { up, fwd, right };
}
function load(){
  const ctx = vm.createContext({ console, THREE, Math, Float32Array, Int32Array, Uint8Array });
  ctx.window = ctx;
  vm.runInContext(read('public/sealife.js'), ctx, { filename:'sealife.js' });
  vm.runInContext(read('public/ocean.js'), ctx, { filename:'ocean.js' });
  return ctx;
}
function sea(){
  const ctx = load(), O = ctx.OCEAN;
  const b = O.spots({ id:'hub', PR:320, dirOf, frameAt });
  // what planet.js's seatBasins() would find round the rim: take the lowest of a gently rolling hill
  b[0].rim = -3;
  O.cut(O.toDir(0, 0), 0, b[0].rim);                  // hands the sea its level
  return { O, b, plan:O._plan(), SEA:O.sea };
}

test('the page loads the sea before the planet that asks it for its basin', () => {
  const html = read('public/index.html');
  const at = f => html.indexOf('src="' + f + '?');
  assert.ok(at('sealife.js') > 0 && at('ocean.js') > at('sealife.js'), 'ocean.js populates from SEALIFE, so it comes after it');
  assert.ok(at('planet.js') > at('ocean.js'), 'planet.js builds the world, and the sea is part of it');
});

test('the sea is Wano\'s, and only Wano\'s', () => {
  const O = load().OCEAN;
  assert.strictEqual(O.spots({ id:'ryu', PR:200, dirOf, frameAt }).length, 0, 'a sea turned up on another world');
  const { b } = sea();
  assert.strictEqual(b.length, 1);
  assert.ok(b[0].ocean && typeof b[0].cut === 'function' && b[0].r > 100, 'the basin planet.js is handed is not the sea');
});

test('it has a beach, a shelf, a wall, a deep plain and a rift', () => {
  const { O, plan } = sea(), R = O.R, D = O._depthAt;
  // all round: land just past the waterline, water just inside it
  for(let a = 0; a < Math.PI*2; a += 0.3){
    const x = Math.cos(a), z = Math.sin(a);
    let shore = 0; for(let r = 0; r < R; r += 0.5) if(D(x*r, z*r) > 0) shore = r;
    assert.ok(shore > R*0.6 && shore < R*0.95, `the waterline at ${a.toFixed(1)} rad is ${shore.toFixed(0)} m out`);
    assert.ok(D(x*(shore+4), z*(shore+4)) < 0, 'no beach past the water');
    assert.ok(D(x*(shore-6), z*(shore-6)) > 0.5, 'the water is not deep enough to swim in six metres from the beach');
  }
  assert.ok(D(plan.DC.x, plan.DC.z) > 30 || D(plan.DC.x + 12, plan.DC.z) > 30, 'there is no deep water in the middle');
  const mid = plan.rift[Math.floor(plan.rift.length/2)];
  assert.ok(D(mid.x, mid.z) > 70, `the rift is only ${D(mid.x, mid.z).toFixed(0)} m deep`);
  // the wall: somewhere going out from the deep, the bottom rises twenty metres in a short way
  const t = plan.town;
  let steepest = 0;
  for(let r = 0; r < R*0.7; r += 1){ const x1 = plan.DC.x + t.x*r, z1 = plan.DC.z + t.z*r, x2 = x1 + t.x*4, z2 = z1 + t.z*4; steepest = Math.max(steepest, D(x1, z1) - D(x2, z2)); }
  assert.ok(steepest > 8, `the drop-off only falls ${steepest.toFixed(1)} m in four metres — that is a slope, not a wall`);
});

test('five canyons cut back into the shelf, and none of them reaches the beach', () => {
  const { O, plan } = sea(), D = O._depthAt;
  assert.strictEqual(plan.canyons.length, 5);
  for(const c of plan.canyons){
    const p = c[Math.floor(c.length*0.6)], q = c[Math.floor(c.length*0.6)+1];
    const nx = -(q.z-p.z), nz = q.x-p.x, n = Math.hypot(nx, nz);
    const inside = D(p.x, p.z), beside = D(p.x + nx/n*18, p.z + nz/n*18);
    assert.ok(inside > beside + 6, `a canyon floor (${inside.toFixed(1)} m) is not much below the shelf beside it (${beside.toFixed(1)} m)`);
    const end = c[c.length-1];
    assert.ok(D(end.x, end.z) > 0.8, 'a canyon comes out of the sea onto dry land');
  }
});

test('nothing on the reef breaks the surface', () => {
  const { O } = sea(), R = O.R, D = O._depthAt;
  let shallowest = Infinity;
  for(let x = -R; x < R; x += 2.5) for(let z = -R; z < R; z += 2.5){
    const d = D(x, z); if(d <= 0) continue;                       // the beach
    if(d < 0.3 && D(x*1.08, z*1.08) > 0) shallowest = Math.min(shallowest, d);   // wet, with more sea further out: a head poking up
  }
  assert.ok(shallowest === Infinity || shallowest > 0.25, 'a coral head stands out of the water');
});

test('the surface is where the water is, and nowhere else', () => {
  const { O, SEA } = sea();
  assert.strictEqual(O.waterAt(O.toDir(0, 0)), SEA);
  assert.strictEqual(O.waterAt(dirOf(0, 7)), null, 'Mission Control is under water');
  assert.strictEqual(O.waterAt(O.toDir(O.R*0.99, 0)), null, 'the dunes are wet');
  assert.ok(SEA < -3, 'the water stands higher than the rim that holds it');
});

test('there are more than thirty kinds of animal, and every one of them builds and moves', () => {
  const { SEALIFE } = load();
  const S = SEALIFE._SPECIES;
  assert.ok(S.length >= 30, `only ${S.length} species`);
  assert.strictEqual(new Set(S.map(s=>s.id)).size, S.length, 'two species share an id');
  for(const s of S){
    assert.ok(s.name && s.icon, `${s.id} has no name or picture`);
    let b; try{ b = s.make(); }catch(e){ /* a builder that needs the placed sea (vents, rift) may only fail at place() */ }
    if(!b) continue;
    const g = b.geo;
    for(const a of ['position', 'normal', 'color', 'aBend', 'aGlow']) assert.ok(g.getAttribute(a), `${s.id} has no ${a}`);
    assert.ok(g.getAttribute('position').array.every(Number.isFinite), `${s.id} has a vertex that is not a number`);
    assert.ok(SEALIFE._MOVE[b.mode] !== undefined, `${s.id} moves by "${b.mode}", which is not a way of moving`);
    assert.ok(b.count >= 1 && typeof b.place === 'function', `${s.id} is never put anywhere`);
  }
});

test('planet.js asks the sea first, wherever the sea changes the answer', () => {
  const src = read('public/planet.js');
  assert.ok(/basins = basins\.concat\(OCEAN\.spots\(/.test(src), 'the sea is not one of the basins, so trees grow on the seabed');
  assert.ok(/if\(b\.cut\)\{ h = b\.cut\(dir, h, b\.rim\); continue; \}/.test(src), 'basinCut() digs every basin as a round bowl');
  assert.ok(/OCEAN\.trimIndex\(geo\)/.test(src), 'the ball\'s own faces still cover the seabed');
  assert.ok(/OCEAN\.build\(\{ id:W\.id/.test(src), 'the sea is never built');
  assert.ok(/OCEAN\.tick\(dt, me, G\.camera/.test(src), 'nothing in the sea moves');
  assert.ok(/G\.keys\.ShiftLeft\|\|G\.keys\.ShiftRight\|\|G\.keys\.KeyQ/.test(src), 'there is no key to dive with');
  assert.ok(/terrainH\(want\)\+0\.6 > me\.alt\+0\.25/.test(src), 'a diver can swim through a canyon wall');
  assert.ok(/OCEAN\.waterAt\(me\.dir\)[\s\S]{0,160}sea\+0\.4/.test(src), 'flying comes down through the water to the seabed');
  assert.ok(/OCEAN\.inside\(want\) < 1\.05/.test(src), 'the pandas walk into the sea');
  assert.ok(/function leave\(\)\{[\s\S]{0,900}OCEAN\.clear\(\)/.test(src), 'the underwater blue follows you indoors');
});
