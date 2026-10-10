/* A MOUTH THAT OPENS. Robin's lips were one surface, so opening her jaw stretched them. Here: the face is cut along
   the line where her lips meet (corners left joined), the jaw shape is made again so the lower lip moves away from
   the upper instead of dragging it, and behind the lips there is a mouth — dark inside, a row of teeth top and
   bottom — which moves with the jaw. node mouth.mjs <in.glb> <out.glb> */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, quantize } from '@gltf-transform/functions';
import * as THREE from '/Users/akilfoster/CSapps/0.2a/node_modules/three/build/three.module.js';
import fs from 'fs';
const [,, IN, OUT] = process.argv;
const HERS = JSON.parse(fs.readFileSync('/Users/akilfoster/CSapps/0.2a/glb files/face/robin.landmarks.json'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(IN);
await doc.transform(dequantize());
const root = doc.getRoot(), mesh = root.listMeshes()[0], prim = mesh.listPrimitives()[0], skin = root.listSkins()[0];
const names = mesh.getExtras().targetNames;
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a)/(b - a))); return k*k*(3 - 2*k); };

/* the file's frame to metres: quantizing folded a scale into the bind matrices, so a joint's rest world times its
   inverse bind is the same matrix for every joint — the one that takes these positions to where she stands */
const joints = skin.listJoints(), ibm = skin.getInverseBindMatrices();
const world = n => { const m = new THREE.Matrix4().compose(new THREE.Vector3(...n.getTranslation()), new THREE.Quaternion(...n.getRotation()), new THREE.Vector3(...n.getScale()));
  const p = n.getParentNode(); return p ? world(p).multiply(m) : m; };
const headJ = joints.findIndex(j=>j.getName() === 'mixamorig:Head');
const ib = new THREE.Matrix4().fromArray(ibm.getElement(headJ, []));
const Q = world(joints[headJ]).multiply(ib), Qi = Q.clone().invert(), Ql = new THREE.Matrix3().setFromMatrix4(Q), Qli = Ql.clone().invert();
const POS = prim.getAttribute('POSITION'), n0 = POS.getCount();
const R = []; for(let i = 0; i < n0; i++) R.push(new THREE.Vector3(...POS.getElement(i, [])).applyMatrix4(Q));
console.log('mouth at', HERS.mouthC, 'nearest vertex', Math.min(...R.map(p=>p.distanceTo(new THREE.Vector3(...HERS.mouthC)))).toFixed(4));

/* ---- 1. the cut. Her face is coarse here (a centimetre between points): the lips are painted on. So the triangles
   round her mouth are first sliced into narrow strips across it (so the opening can curve), then sliced along the
   line where her lips meet, and the two sides of that line are pulled apart — except the last few millimetres at
   each corner, which stay joined, the way a mouth's corners do. */
const lipY = x => HERS.mouthC[1] + 0.0004*Math.min(1, (x/0.022)**2);
const CORNER = Math.min(Math.abs(HERS.mouthR[0]), Math.abs(HERS.mouthL[0])) - 0.0025;
const IDX = prim.getIndices();
let idx = Array.from(IDX.getArray());
const sems = prim.listSemantics(), tgs = prim.listTargets();
const A = {}; sems.forEach(s=>{ const acc = prim.getAttribute(s); A[s] = { acc, sz:acc.getElementSize(), a:Array.from(acc.getArray()) }; });
const T = tgs.map(tg=>tg.listSemantics().map(s=>{ const acc = tg.getAttribute(s); return { acc, sz:acc.getElementSize(), a:Array.from(acc.getArray()) }; }));
const all = () => Object.values(A).concat(...T);
let count = n0;
function newVert(a, b, t){                                     // a point on the edge a→b, everything interpolated
  for(const L of all()){ for(let c = 0; c < L.sz; c++){ const va = L.a[a*L.sz + c], vb = L.a[b*L.sz + c];
    L.a.push(L === A.JOINTS_0 || L === A.WEIGHTS_0 ? (t < 0.5 ? va : vb) : va + (vb - va)*t); } }
  R.push(R[a].clone().lerp(R[b], t)); return count++;
}
const near = p => Math.abs(p.x) < 0.03 && Math.abs(p.y - lipY(p.x)) < 0.016 && p.z > HERS.mouthC[2] - 0.03;
function cut(f, region){
  const memo = new Map(), out = [];
  const at = (a, b) => { const k = a < b ? a + ',' + b : b + ',' + a; if(memo.has(k)) return memo.get(k);
    const fa = f(R[a]), fb = f(R[b]); const v = newVert(a, b, fa/(fa - fb)); memo.set(k, v); return v; };
  for(let t = 0; t < idx.length; t += 3){
    const tri = [idx[t], idx[t + 1], idx[t + 2]];
    if(!tri.some(v=>region(R[v]))){ out.push(...tri); continue; }
    const s = tri.map(v=>f(R[v]) >= 0);
    if(s[0] === s[1] && s[1] === s[2]){ out.push(...tri); continue; }
    const lone = s[0] !== s[1] && s[0] !== s[2] ? 0 : s[1] !== s[0] && s[1] !== s[2] ? 1 : 2;
    const L = tri[lone], O1 = tri[(lone + 1)%3], O2 = tri[(lone + 2)%3];
    const p1 = at(L, O1), p2 = at(L, O2);
    out.push(L, p1, p2, p1, O1, O2, p1, O2, p2);
  }
  idx = out;
}
// strips across the mouth, every 3 mm
for(let x = -0.027; x <= 0.0271; x += 0.003){ const x0 = x + 1e-5; cut(p=>p.x - x0, near); }
// and along the lips, plus a line just above and below it so each lip bends near the opening
cut(p=>p.y - lipY(p.x), near);
cut(p=>p.y - lipY(p.x) - 0.0035, near); cut(p=>p.y - lipY(p.x) + 0.0035, near);
const ON = v => Math.abs(R[v].y - lipY(R[v].x)) < 1e-5;
const lowerTri = [];
for(let t = 0; t < idx.length; t += 3){ const c = R[idx[t]].clone().add(R[idx[t + 1]]).add(R[idx[t + 2]]).multiplyScalar(1/3);
  if(near(c) && c.y < lipY(c.x) && [0, 1, 2].some(k=>ON(idx[t + k]))) lowerTri.push(t); }
const seam = [...new Set(lowerTri.flatMap(t=>[0, 1, 2].map(k=>idx[t + k])).filter(v=>ON(v) && Math.abs(R[v].x) < CORNER))];
const dup = new Map(); seam.forEach(v=>{ const k = count++; for(const L of all()) for(let c = 0; c < L.sz; c++) L.a.push(L.a[v*L.sz + c]); R.push(R[v].clone()); dup.set(v, k); });
for(const t of lowerTri) for(let k = 0; k < 3; k++){ const v = idx[t + k]; if(dup.has(v)) idx[t + k] = dup.get(v); }
for(const L of all()) L.acc.setArray(new (L.acc.getArray().constructor)(L.a));
const N = R.length;
const isLower = new Uint8Array(N); dup.forEach(k=>{ isLower[k] = 1; });
IDX.setArray(new Uint32Array(idx));
console.log('cut: seam', seam.length, 'vertices, body', n0, '->', N, 'triangles', idx.length/3);

/* ---- 2. the jaw, again: everything below the cut turns about a hinge under her ears, in full right up to the lips
   (only the corners, which stay joined, ease in); the upper lip lifts a hair */
const pivot = new THREE.Vector3(0, HERS.noseTip[1] + 0.004, HERS.jawR[2] - 0.07), ANG = 0.16, rq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ANG);
const halfW = Math.abs(HERS.jawL[0] - HERS.jawR[0])/2 + 0.022;
const jawAt = (p, lower) => {
  const lip = lipY(p.x);
  if(p.z < 0.02 || p.y < HERS.chin[1] - 0.035) return new THREE.Vector3();
  if(!lower && p.y >= lip){                                               // the upper lip: up a little, in the middle
    const w = (1 - smooth(0, 0.006, p.y - lip))*(1 - smooth(CORNER*0.5, CORNER, Math.abs(p.x)))*smooth(HERS.mouthC[2] - 0.012, HERS.mouthC[2] - 0.004, p.z);
    return new THREE.Vector3(0, 0.0012*w, 0); }
  const below = lip - p.y, corner = 1 - smooth(CORNER*0.35, CORNER + 0.001, Math.abs(p.x)), wide = 1 - smooth(halfW*0.75, halfW*1.15, Math.abs(p.x));
  const t = smooth(0, 0.012, below), wx = corner*(1 - t) + wide*t;
  const w = wx*(1 - smooth(HERS.chin[1] - 0.02, HERS.chin[1] - 0.035, p.y));
  return p.clone().sub(pivot).applyQuaternion(rq).add(pivot).sub(p).multiplyScalar(w);
};
const ti = n => names.indexOf(n), targets = prim.listTargets();
const oldJaw = targets[ti('jawOpen')].getAttribute('POSITION');
const newJaw = R.map((p, i)=>jawAt(p, !!isLower[i] || p.y < lipY(p.x) - 1e-5));
// the speech shapes had some of the old jaw in them: the same share of the new one instead
const SHARE = { jawOpen:1, mouthI:0.25, mouthE:0.55, mouthU:0.1 };
for(const [nm, k] of Object.entries(SHARE)){
  const acc = targets[ti(nm)].getAttribute('POSITION'), a = acc.getArray(), oj = oldJaw.getArray().slice();
  for(let i = 0; i < N; i++){ const o = new THREE.Vector3(oj[i*3], oj[i*3 + 1], oj[i*3 + 2]), nj = newJaw[i].clone().applyMatrix3(Qli);
    const cur = new THREE.Vector3(a[i*3], a[i*3 + 1], a[i*3 + 2]); if(nm === 'jawOpen') cur.set(0, 0, 0); else cur.addScaledVector(o, -k);
    cur.addScaledVector(nj, k); a[i*3] = cur.x; a[i*3 + 1] = cur.y; a[i*3 + 2] = cur.z; }
  acc.setArray(a);
}

/* ---- 3. inside: a dark mouth, its floor moving with the jaw, and teeth */
const skinTri = []; for(let t = 0; t < idx.length; t += 3) skinTri.push([idx[t], idx[t + 1], idx[t + 2]]);
const faceTri = skinTri.filter(([a])=>R[a].distanceTo(new THREE.Vector3(...HERS.mouthC)) < 0.08).map(([a, b, c])=>new THREE.Triangle(R[a], R[b], R[c]));
const tmp = new THREE.Vector3();
const gap = p => { let d = 1, best = null; for(const t of faceTri){ t.closestPointToPoint(p, tmp); const dd = tmp.distanceTo(p); if(dd < d){ d = dd; best = t; } }
  const nrm = best ? best.getNormal(new THREE.Vector3()) : new THREE.Vector3(0, 0, 1); best && best.closestPointToPoint(p, tmp); return { d, out:p.clone().sub(tmp).dot(nrm) }; };
const C = new THREE.Vector3(0, HERS.mouthC[1] - 0.003, HERS.mouthC[2] - 0.026);
function shell(rx, ry, rz, segU, segV, inset){
  const V = [], I = [];
  for(let j = 0; j <= segV; j++){ const v = j/segV, phi = v*Math.PI;
    for(let i = 0; i <= segU; i++){ const th = i/segU*Math.PI*2;
      const p = new THREE.Vector3(Math.cos(th)*Math.sin(phi)*rx, Math.cos(phi)*ry, Math.sin(th)*Math.sin(phi)*rz).add(C);
      // never through her face: pulled toward the middle until it is under the skin by `inset`
      for(let it = 0; it < 30; it++){ const g = gap(p); if(g.out < -inset || g.d > 0.02) break; p.lerp(C, 0.06); }
      V.push(p); } }
  // only the back of it: the front would close over the teeth (seen from in front, it is the back wall that is dark)
  for(let j = 0; j < segV; j++) for(let i = 0; i < segU; i++){ const a = j*(segU + 1) + i, b = a + segU + 1;
    if(Math.sin((i + 0.5)/segU*Math.PI*2) > 0.25) continue;
    I.push(a, a + 1, b, b, a + 1, b + 1); }
  return { V, I };
}
const cav = shell(0.027, 0.019, 0.022, 32, 18, 0.0025);
// teeth: two short curved rows behind the lips, upper fixed to the head, lower with the jaw
function teeth(y0, y1, depth){
  const V = [], I = [], seg = 16, half = 0.0135;
  for(let i = 0; i <= seg; i++){ const x = -half + 2*half*i/seg, z = HERS.mouthC[2] - depth - 0.02*(x/half)**2;
    V.push(new THREE.Vector3(x, y0, z), new THREE.Vector3(x, y1, z)); }
  // never in front of her lips or cheeks: back until it is 2 mm under the skin
  V.forEach(p=>{ for(let it = 0; it < 40; it++){ const g = gap(p); if(g.out < -0.002 || g.d > 0.02) break; p.z -= 0.0008; } });
  for(let i = 0; i < seg; i++){ const a = i*2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  return { V, I };
}
const lipC = HERS.mouthC[1];
const up = teeth(lipC + 0.004, lipC - 0.0035, 0.0065), lo = teeth(lipC - 0.002, lipC - 0.008, 0.0078);
const parts = [
  { name:'mouthInside', geo:cav, color:[0.2, 0.06, 0.065], jaw:p=>smooth(lipC + 0.002, lipC - 0.006, p.y) },
  { name:'teethUpper',  geo:up,  color:[0.46, 0.43, 0.39], jaw:()=>0 },
  { name:'teethLower',  geo:lo,  color:[0.42, 0.39, 0.35], jaw:()=>1 } ];
const buf = root.listBuffers()[0], head = joints[headJ], armature = root.listNodes().find(n=>n.getName() === 'Armature') || root.listScenes()[0];
const jointsArr = (n, j) => { const a = new Uint16Array(n*4); for(let i = 0; i < n; i++) a[i*4] = j; return a; };
const weights = n => { const a = new Float32Array(n*4); for(let i = 0; i < n; i++) a[i*4] = 1; return a; };
// smooth normals, in the file's frame (the bind matrices undo the same transform the positions do)
function normalsOf(V, I){ const n = V.map(()=>new THREE.Vector3());
  for(let i = 0; i < I.length; i += 3){ const a = V[I[i]], b = V[I[i + 1]], c = V[I[i + 2]], f = b.clone().sub(a).cross(c.clone().sub(a)); [0, 1, 2].forEach(k=>n[I[i + k]].add(f)); }
  const nm = new THREE.Matrix3().getNormalMatrix(Qi), out = new Float32Array(V.length*3);
  n.forEach((v, i)=>{ v.normalize().applyMatrix3(nm).normalize(); out.set([v.x, v.y, v.z], i*3); }); return out; }
for(const p of parts){
  const V = p.geo.V, n = V.length;
  const pos = new Float32Array(n*3); V.forEach((v, i)=>{ const q = v.clone().applyMatrix4(Qi); pos.set([q.x, q.y, q.z], i*3); });
  const m = doc.createMaterial(p.name).setBaseColorFactor([...p.color, 1]).setRoughnessFactor(0.65).setMetallicFactor(0).setDoubleSided(true);
  const pr = doc.createPrimitive().setMaterial(m)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
    .setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(jointsArr(n, headJ)).setBuffer(buf))
    .setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(weights(n)).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normalsOf(V, p.geo.I)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(p.geo.I)).setBuffer(buf));
  // the jaw: the same turn as her lower face (and the speech shapes' share of it)
  const tn = Object.keys(SHARE);
  tn.forEach(nm=>{ const d = new Float32Array(n*3); V.forEach((v, i)=>{ const w = p.jaw(v)*SHARE[nm]; if(!w) return;
      const r = v.clone().sub(pivot).applyQuaternion(rq).add(pivot).sub(v).multiplyScalar(w).applyMatrix3(Qli); d.set([r.x, r.y, r.z], i*3); });
    pr.addTarget(doc.createPrimitiveTarget(nm).setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(d).setBuffer(buf))); });
  const me = doc.createMesh(p.name).addPrimitive(pr).setWeights(tn.map(()=>0)).setExtras({ targetNames:tn });
  const node = doc.createNode(p.name).setMesh(me).setSkin(skin);
  armature.addChild(node);
}
await io.write(OUT, doc);
console.log('wrote', OUT, 'body vertices', n0, '->', N);
