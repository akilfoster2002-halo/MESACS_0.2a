/* =====================================================================
   A FACE FOR A BODY THAT HAS NONE: morph targets (blendshapes) on Robin's
   head, carried over from a real facial rig on somebody else's.

   The rig is "Facial Rig test." by bayuitra (Sketchfab, CC-BY 4.0): a head
   with 143 face bones and a ten-second demo of what they do. Robin's body
   (Higgsfield, auto-rigged) has a Head bone and nothing in her face. So:

   1. HIS FACE IN EACH SHAPE. The jaw opened by turning his jaw bone; a
      smile, an "oo", a frown and the brows up and down taken from moments
      of his demo; each the movement of every point of his face from his
      neutral first frame. The brow shapes keep only the upper face, the
      mouth shapes only the lower.
   2. HIS FACE ONTO HERS. Twenty-one landmarks picked on both faces (eyes,
      brows, nose, mouth, chin, cheeks, jaw: face/*.landmarks.json) give a
      thin-plate spline that bends his face onto hers; each movement is
      carried through it (turned and stretched the way the bend is there).
   3. HERS FROM THE NEAREST OF HIS. Every point of her face takes the
      movement of the points of his bent face nearest to it, fading to
      nothing a centimetre and a half away — her hair, her ears, the back of
      her head do not move.
   BLINK is made on her face directly: her eyes are painted on, not
      eyeballs under lids like his, so his lids have nothing to land on. The
      band from her lower lid up past the upper lid closes down onto the
      lower lid line.

     node face/morphs.js <in.glb> <out.glb> [face/<who>.landmarks.json]
     (in: the body before quantize; landmarks default to Robin's)
   ===================================================================== */
const F = require('./rig'), io = require('./glbio'), T = F.THREE;
const [,, inPath, outPath, marksPath] = process.argv;
const HIS = require('./rigtest.landmarks.json'), HERS = require(marksPath ? require('path').resolve(marksPath) : './robin.landmarks.json');
const n = s => s + '_Rig_Facial';

/* ---------------------------------------------------------- 1. his shapes */
const R = F.load(__dirname + '/rig-test.glb');
const FACE = R.meshes.findIndex(m=>m.pos.length > 5000);            // the skin (the others are teeth and brows)
const N = F.skin(R, F.pose(R, 0), FACE);
const yNose = HIS.noseBase[1], yEye = HIS.eyeR[1];
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a)/(b - a))); return k*k*(3 - 2*k); };
const UPPER = v => smooth(yNose + 0.004, yEye - 0.008, v.y);          // eyes and brows
const LOWER = v => 1 - smooth(yNose - 0.004, yNose + 0.008, v.y);     // mouth, cheeks, jaw
const jaw = a => ({ [n('DEF-Jaw')]:{ r:new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), a) } });
const SHAPES = [
  { name:'smile',    at:1.0, mask:LOWER, gain:0.5 },          // his is a big cartoon grin; hers at full is a smile
  { name:'mouthO',   at:6.0, mask:LOWER },
  { name:'frown',    at:4.0, mask:LOWER, gain:0.5 },
  { name:'browUp',   at:7.6, mask:UPPER },
  { name:'browDown', at:2.8, mask:v=>UPPER(v)*(1 - smooth(yEye - 0.004, yEye + 0.004, v.y) + smooth(yEye + 0.008, yEye + 0.014, v.y)) }   // the brows, not his squint
];
/* relative to his head: the demo turns and tilts it as well, and a nod is not an expression */
const HEAD = R.byName[n('DEF-Head')], head0 = F.pose(R, 0)[HEAD].clone();
SHAPES.forEach(s=>{ const w = F.pose(R, s.at, s.extra), back = head0.clone().multiply(w[HEAD].clone().invert());
  const P = F.skin(R, w, FACE); s.d = P.map((p, i)=>p.clone().applyMatrix4(back).sub(N[i]).multiplyScalar(s.mask(N[i])*(s.gain || 1))); });
/* SYMMETRIC. The demo's smile is a smirk (his left corner up 13 mm, his right 4) and its jaw slides
   sideways; a face that only ever smiles on one side looks like a fault. Each shape keeps the side that
   moves more and mirrors it onto the other; down the middle, nothing goes sideways. */
const mcell = 0.002, mgrid = new Map(), mk = (x, y, z) => x + ',' + y + ',' + z;
N.forEach((p, i)=>{ const k = mk(Math.round(p.x/mcell), Math.round(p.y/mcell), Math.round(p.z/mcell)); if(!mgrid.has(k)) mgrid.set(k, []); mgrid.get(k).push(i); });
const mirror = N.map(p=>{ const q = new T.Vector3(-p.x, p.y, p.z), cx = Math.round(q.x/mcell), cy = Math.round(q.y/mcell), cz = Math.round(q.z/mcell); let best = -1, bd = 0.004;
  for(let a = -2; a <= 2; a++) for(let b = -2; b <= 2; b++) for(let c = -2; c <= 2; c++){ const l = mgrid.get(mk(cx + a, cy + b, cz + c)); if(l) l.forEach(j=>{ const d = N[j].distanceTo(q); if(d < bd){ bd = d; best = j; } }); }
  return best; });
SHAPES.forEach(s=>{ let pos = 0, neg = 0; s.d.forEach((d, i)=>{ if(N[i].x > 0.002) pos += d.length(); else if(N[i].x < -0.002) neg += d.length(); });
  const keep = pos >= neg ? 1 : -1;
  s.d = s.d.map((d, i)=>{ const x = N[i].x;
    if(Math.abs(x) <= 0.002){ const m = mirror[i] >= 0 ? s.d[mirror[i]] : d; return new T.Vector3(0, (d.y + m.y)/2, (d.z + m.z)/2); }
    if(Math.sign(x) === keep || mirror[i] < 0) return d;
    const m = s.d[mirror[i]]; return new T.Vector3(-m.x, m.y, m.z); }); });

/* ---------------------------------------------------------- 2. the bend */
const keys = Object.keys(HIS).filter(k=>HERS[k]);
const src = keys.map(k=>new T.Vector3(...HIS[k])), dst = keys.map(k=>new T.Vector3(...HERS[k]));
function tps(src, dst){
  const m = src.length, A = [], B = [[], [], []];
  for(let i = 0; i < m + 4; i++) A.push(new Array(m + 4).fill(0));
  for(let i = 0; i < m; i++){ for(let j = 0; j < m; j++) A[i][j] = src[i].distanceTo(src[j]);
    A[i][m] = A[m][i] = 1; A[i][m + 1] = A[m + 1][i] = src[i].x; A[i][m + 2] = A[m + 2][i] = src[i].y; A[i][m + 3] = A[m + 3][i] = src[i].z; }
  for(let i = 0; i < m; i++){ B[0][i] = dst[i].x; B[1][i] = dst[i].y; B[2][i] = dst[i].z; }
  for(let c = 0; c < 3; c++) for(let i = m; i < m + 4; i++) B[c][i] = 0;
  const solve = (M, b) => { const n_ = b.length, a = M.map((r, i)=>r.concat([b[i]]));
    for(let c = 0; c < n_; c++){ let p = c; for(let r = c + 1; r < n_; r++) if(Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r; [a[c], a[p]] = [a[p], a[c]];
      for(let r = 0; r < n_; r++){ if(r === c) continue; const f = a[r][c]/a[c][c]; for(let k = c; k <= n_; k++) a[r][k] -= f*a[c][k]; } }
    return a.map((r, i)=>r[n_]/r[i]); };
  const W = B.map(b=>solve(A, b));
  return p => { const out = [0, 0, 0];
    for(let c = 0; c < 3; c++){ const w = W[c]; let v = w[m] + w[m + 1]*p.x + w[m + 2]*p.y + w[m + 3]*p.z; for(let i = 0; i < m; i++) v += w[i]*p.distanceTo(src[i]); out[c] = v; }
    return new T.Vector3(...out); };
}
const bend = tps(src, dst);
const e = 0.001, ex = new T.Vector3(e, 0, 0), ey = new T.Vector3(0, e, 0), ez = new T.Vector3(0, 0, e);
const Wp = N.map(p=>bend(p));
const moved = SHAPES.map(s=>s.d.map((d, i)=>{ if(d.lengthSq() < 1e-12) return d;
  const p = N[i], Jx = bend(p.clone().add(ex)).sub(bend(p.clone().sub(ex))).divideScalar(2*e), Jy = bend(p.clone().add(ey)).sub(bend(p.clone().sub(ey))).divideScalar(2*e), Jz = bend(p.clone().add(ez)).sub(bend(p.clone().sub(ez))).divideScalar(2*e);
  return Jx.multiplyScalar(d.x).add(Jy.multiplyScalar(d.y)).add(Jz.multiplyScalar(d.z)); }));

/* ---------------------------------------------------------- 3. onto her */
const g = io.read(inPath), J = g.json, prim = J.meshes[0].primitives[0];
const P = io.acc(g, prim.attributes.POSITION);
const cell = 0.006, grid = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
Wp.forEach((p, i)=>{ const k = key(Math.floor(p.x/cell), Math.floor(p.y/cell), Math.floor(p.z/cell)); if(!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
const NEAR = 0.006, FAR = 0.015;
const deltas = SHAPES.map(()=>P.map(()=>[0, 0, 0]));
/* the movement at a point of her face: from the four nearest points of his bent face, fading out with distance */
function lookup(v){
  const cx = Math.floor(v.x/cell), cy = Math.floor(v.y/cell), cz = Math.floor(v.z/cell), near = [];
  for(let a = -3; a <= 3; a++) for(let b = -3; b <= 3; b++) for(let c = -3; c <= 3; c++){ const l = grid.get(key(cx + a, cy + b, cz + c)); if(l) l.forEach(i=>near.push([Wp[i].distanceTo(v), i])); }
  if(!near.length) return null;
  near.sort((x, y)=>x[0] - y[0]);
  const k4 = near.slice(0, 4), d0 = k4[0][0]; if(d0 > FAR) return null;
  const fade = 1 - smooth(NEAR, FAR, d0); let ws = 0; k4.forEach(([d])=>{ ws += 1/(d + 0.0005); });
  return SHAPES.map((s, si)=>{ const o = new T.Vector3(); k4.forEach(([d, i])=>o.addScaledVector(moved[si][i], fade/(d + 0.0005)/ws)); return o; });
}
/* SYMMETRIC ON HER TOO: the bend from his face to hers is not quite even (the landmarks are picked by eye),
   so each point also reads the mirror of its mirror point, about the middle of her face, and keeps the average */
const MID = (HERS.eyeR[0] + HERS.eyeL[0] + HERS.mouthR[0] + HERS.mouthL[0])/4;
/* where her face is, from her landmarks: under the chin to above the forehead, and in front of the middle of her head */
const FACE_Y = [HERS.chin[1] - 0.03, HERS.forehead[1] + 0.045], FACE_Z = (HERS.eyeR[2] + HERS.eyeL[2])/2 - 0.075;
let touched = 0;
P.forEach((q, vi)=>{
  if(q[1] < FACE_Y[0] || q[1] > FACE_Y[1] || q[2] < FACE_Z) return;   // her face, from under the chin to the hairline, front half
  const a = lookup(new T.Vector3(...q)), b = lookup(new T.Vector3(2*MID - q[0], q[1], q[2]));
  if(!a && !b) return;
  SHAPES.forEach((s, si)=>{ const A = a ? a[si] : new T.Vector3(), B = b ? b[si].clone() : new T.Vector3(); B.x = -B.x;
    const o = A.add(B).multiplyScalar(0.5); deltas[si][vi] = [o.x, o.y, o.z]; });
  touched++;
});
/* JAW OPEN, made on her: her lips are one surface, so his moving lower lip and still upper lip, averaged
   onto it, smeared both. Her lower face turns about a hinge under her ears instead — fully from a little
   below the lip line down, not at all above it, and less toward the sides of the jaw. */
const jawD = P.map(()=>[0, 0, 0]);
{ const lip = HERS.mouthC[1], pivot = new T.Vector3(0, HERS.noseTip[1] + 0.004, HERS.jawR[2] - 0.07), q = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), 0.16);
  const halfW = Math.abs(HERS.jawL[0] - HERS.jawR[0])/2 + 0.022;
  P.forEach((p, vi)=>{ if(p[1] > lip + 0.001 || p[1] < HERS.chin[1] - 0.035 || p[2] < 0.02) return;
    const w = smooth(lip + 0.001, lip - 0.0035, p[1]) * (1 - smooth(halfW*0.75, halfW*1.15, Math.abs(p[0]))) * (1 - smooth(HERS.chin[1] - 0.02, HERS.chin[1] - 0.035, p[1]));
    if(w <= 0) return;
    const v = new T.Vector3(...p), r = v.clone().sub(pivot).applyQuaternion(q).add(pivot).sub(v).multiplyScalar(w);
    jawD[vi] = [r.x, r.y, r.z]; }); }
/* blink: each eye's band closes onto its lower lid */
const blink = P.map(()=>[0, 0, 0]);
[['eyeR', 'eyeRout', 'eyeRin'], ['eyeL', 'eyeLout', 'eyeLin']].forEach(([c, o, i_])=>{
  const C = HERS[c], half = Math.abs(HERS[o][0] - HERS[i_][0])/2 + 0.004, xc = (HERS[o][0] + HERS[i_][0])/2;
  // a painted eye is a thin band; a modelled cartoon eye (Canon's) is told how tall it is (landmarks.eyeHalf)
  const eh = HERS.eyeHalf || 0.004, low = C[1] - (HERS.eyeHalf ? eh*0.9 : 0.0035), up = C[1] + (HERS.eyeHalf ? eh : 0.0045), top = up + 0.007;
  P.forEach((q, vi)=>{ if(q[2] < C[2] - 0.02 || q[2] > C[2] + 0.008) return;     // not what is behind the eye, nor in front of it (glasses)
    const fx = 1 - smooth(0.7, 1, Math.abs(q[0] - xc)/half); if(fx <= 0 || q[1] < low || q[1] > top) return;
    const y = q[1], target = low + (y - low)*0.12, closeTo = y <= up ? target : y + (target - y)*(1 - smooth(up, top, y));
    blink[vi][1] += (closeTo - y)*fx; });
});
const names = ['jawOpen'].concat(SHAPES.map(s=>s.name), ['blink']), all = [jawD].concat(deltas, [blink]);
/* WHAT THE FACE DOES NOT MOVE: glasses (landmarks.freeze: [[y0, y1, z], …] — everything between those heights in
   front of that depth). A brow going up drags a frame along with it otherwise, and the eyes look as if they bulge. */
(HERS.freeze || []).forEach(([y0, y1, z])=>P.forEach((p, vi)=>{ if(p[1] >= y0 && p[1] <= y1 && p[2] > z) all.forEach(d=>{ d[vi] = [0, 0, 0]; }); }));
// or a whole piece of the mesh (landmarks.freezeAt: a point on it — the bridge of his glasses), found by what is joined to what
if(HERS.freezeAt){
  const idx = io.acc(g, prim.indices).map(r=>r[0]), par = P.map((_, i)=>i), root = i=>{ while(par[i] !== i){ par[i] = par[par[i]]; i = par[i]; } return i; };
  for(let i = 0; i < idx.length; i += 3){ const a = root(idx[i]), b = root(idx[i + 1]), c = root(idx[i + 2]); par[b] = a; par[root(c)] = a; }
  HERS.freezeAt.forEach(q=>{ let bi = 0, bd = 1e9; P.forEach((p, i)=>{ const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if(d < bd){ bd = d; bi = i; } });
    const r = root(bi); let n = 0; P.forEach((p, vi)=>{ if(root(vi) === r){ n++; all.forEach(d=>{ d[vi] = [0, 0, 0]; }); } });
    console.log('frozen: the piece at', q, '—', n, 'vertices'); });
}
prim.targets = all.map(d=>({ POSITION:io.addAccessor(g, d, 'VEC3', true) }));
J.meshes[0].weights = names.map(()=>0);
J.meshes[0].extras = Object.assign({}, J.meshes[0].extras, { targetNames:names });
io.write(g, outPath);
const mx = all.map(d=>Math.max(...d.map(r=>Math.hypot(...r))));
console.log('face: ' + touched + ' of ' + P.length + ' vertices; ' + names.map((nm, i)=>nm + ' ' + (mx[i]*1000).toFixed(1) + 'mm').join(', '));
