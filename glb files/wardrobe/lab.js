/* =====================================================================
   THE WARDROBE LAB — the browser half of glb files/wardrobe/lab.mjs.

   Everything that has to understand a character file runs here, in a real
   three.js: the game's characters are quantized, WebP-textured and skinned,
   and the loader, the skinning and the exporter that already handle all of
   that are three's own. Node drives it (lab.mjs) and keeps the files.

     render(url, view)          the body in its BIND POSE, square, orthographic,
                                on the plain grey a product shot has — the
                                picture Higgsfield is asked to redress
     ... and the steps that turn what Higgsfield sends back into a body, a
     garment, and a garment fitted to every body (below).
   ===================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const canvas = document.getElementById('c');
const R = new THREE.WebGLRenderer({ canvas, antialias:true, preserveDrawingBuffer:true });
R.outputColorSpace = THREE.SRGBColorSpace;
const BG = 0xc8ccd0, SIZE = 1024;

const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const load = url => new Promise((ok, no)=>loader.load(url, ok, undefined, no));

/* the one skinned mesh a character is, posed at bind */
function skinnedOf(scene){
  let sm = null; scene.traverse(o=>{ if(!sm && o.isSkinnedMesh) sm = o; });
  if(sm){ sm.skeleton.pose(); scene.updateMatrixWorld(true); }
  return sm;
}
/* every vertex of a mesh where it is drawn: skinned meshes through their bones */
function worldVerts(mesh){
  const P = mesh.geometry.attributes.position, out = new Float32Array(P.count*3), v = new THREE.Vector3();
  mesh.updateMatrixWorld(true);
  for(let i=0;i<P.count;i++){
    v.fromBufferAttribute(P, i);
    if(mesh.isSkinnedMesh) mesh.applyBoneTransform(i, v);       // into the mesh's own space, through its bones
    v.applyMatrix4(mesh.matrixWorld);
    out[i*3] = v.x; out[i*3+1] = v.y; out[i*3+2] = v.z;
  }
  return out;
}
function boxOf(arr){
  const b = new THREE.Box3(), v = new THREE.Vector3();
  for(let i=0;i<arr.length;i+=3){ v.set(arr[i], arr[i+1], arr[i+2]); b.expandByPoint(v); }
  return b;
}

/* ------------------------------------------------------------- render */
async function render(url, view, clip, at){
  const g = await load(url), sc = g.scene;
  let sm = skinnedOf(sc); sc.updateMatrixWorld(true);
  if(clip){
    const c = g.animations.find(a=>a.name === clip); if(!c) throw new Error('no clip ' + clip);
    const mx = new THREE.AnimationMixer(sc); mx.clipAction(c).play(); mx.setTime(at || 0); sc.updateMatrixWorld(true);
  }
  const box = sm ? boxOf(worldVerts(sm)) : new THREE.Box3().setFromObject(sc);
  if(clip) box.expandByScalar((box.max.y - box.min.y)*0.05);
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  let half = Math.max(s.y, s.x, s.z)*0.5*1.08;
  if(view === 'face'){ half = s.y*0.075; c.y = box.max.y - s.y*0.075; }      // the head, filling the frame
  const S = new THREE.Scene(); S.background = new THREE.Color(BG);
  S.add(new THREE.HemisphereLight(0xffffff, 0x9a9590, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(0.5, 1.2, 2); S.add(key);
  S.add(sc);
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 100);
  const side = view === 'side';
  cam.position.set(c.x + (side ? 10 : 0), c.y, c.z + (side ? 0 : 10)); cam.lookAt(c.x, c.y, c.z);
  R.setSize(SIZE, SIZE, false); R.render(S, cam);
  return { png:canvas.toDataURL('image/png'), frame:{ cx:side ? c.z : c.x, cy:c.y, half, view:view || 'front', box:[box.min.toArray(), box.max.toArray()] } };
}

/* ============================================================ geometry
   Plain arrays: positions (x y z …), and a grid for nearest-point lookups.
   Every body here is a few tens of thousands of vertices; a uniform grid is
   all the search structure that needs. */
function grid(P, cell){
  const map = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
  for(let i=0;i<P.length/3;i++){
    const k = key(Math.floor(P[i*3]/cell), Math.floor(P[i*3+1]/cell), Math.floor(P[i*3+2]/cell));
    let a = map.get(k); if(!a) map.set(k, a = []); a.push(i);
  }
  /* the nearest point to (x y z), optionally only among those `ok(i)` allows */
  function nearest(x, y, z, ok, maxR){
    const cx = Math.floor(x/cell), cy = Math.floor(y/cell), cz = Math.floor(z/cell);
    let best = -1, bd = Infinity;
    for(let r=0; r<=(maxR || 6); r++){
      for(let dx=-r; dx<=r; dx++) for(let dy=-r; dy<=r; dy++) for(let dz=-r; dz<=r; dz++){
        if(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
        const a = map.get(key(cx+dx, cy+dy, cz+dz)); if(!a) continue;
        for(const i of a){ if(ok && !ok(i)) continue; const ex = P[i*3]-x, ey = P[i*3+1]-y, ez = P[i*3+2]-z, d = ex*ex+ey*ey+ez*ez; if(d < bd){ bd = d; best = i; } }
      }
      if(best >= 0 && Math.sqrt(bd) < r*cell) break;
    }
    return { i:best, d:Math.sqrt(bd) };
  }
  return { nearest };
}
/* a mesh's raw arrays (its own space: for a skinned mesh, its bind space) */
function arrays(mesh){
  const g = mesh.geometry, P = g.attributes.position, out = { pos:new Float32Array(P.count*3), n:P.count };
  const v = new THREE.Vector3();
  for(let i=0;i<P.count;i++){ v.fromBufferAttribute(P, i); out.pos.set([v.x, v.y, v.z], i*3); }
  if(!g.attributes.normal) g.computeVertexNormals();
  const N = g.attributes.normal; out.nrm = new Float32Array(P.count*3);
  for(let i=0;i<P.count;i++){ v.fromBufferAttribute(N, i).normalize(); out.nrm.set([v.x, v.y, v.z], i*3); }
  if(g.attributes.skinIndex){ const SI = g.attributes.skinIndex, SW = g.attributes.skinWeight; out.si = new Uint16Array(P.count*4); out.sw = new Float32Array(P.count*4);
    for(let i=0;i<P.count;i++) for(let k=0;k<4;k++){ out.si[i*4+k] = SI.getComponent(i, k); out.sw[i*4+k] = SW.getComponent(i, k); } }
  return out;
}
function bbox(P){ const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for(let i=0;i<P.length;i+=3) for(let k=0;k<3;k++){ mn[k] = Math.min(mn[k], P[i+k]); mx[k] = Math.max(mx[k], P[i+k]); } return { mn, mx }; }
function applySim(P, T){ const o = new Float32Array(P.length), v = new THREE.Vector3(); for(let i=0;i<P.length;i+=3){ v.set(P[i], P[i+1], P[i+2]).applyMatrix4(T); o[i] = v.x; o[i+1] = v.y; o[i+2] = v.z; } return o; }
/* every nth point, for the alignment */
function sample(P, n){ const step = Math.max(1, Math.floor(P.length/3/n)), o = []; for(let i=0;i<P.length/3;i+=step) o.push(P[i*3], P[i*3+1], P[i*3+2]); return new Float32Array(o); }

/* ICP WITH SCALE. Lines `src` up on `dst`: a start from their boxes (same
   height, same middle), then rounds of — each source point to its nearest
   destination point, drop the worst fifth, solve the best rotation, scale
   and shift (Umeyama), apply. The bodies are the same person in the same
   pose, so it settles in a few dozen rounds. */
function icp(src, dst, rounds){
  const bs = bbox(src), bd = bbox(dst);
  const hs = bs.mx[1] - bs.mn[1], hd = bd.mx[1] - bd.mn[1], k = hd/hs;
  const cs = [0, 1, 2].map(i=>(bs.mn[i] + bs.mx[i])/2), cd = [0, 1, 2].map(i=>(bd.mn[i] + bd.mx[i])/2);
  let T = new THREE.Matrix4().makeTranslation(cd[0], cd[1], cd[2]).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(-cs[0], -cs[1], -cs[2]));
  const S = sample(src, 4000), G = grid(dst, hd/60);
  let err = 0;
  for(let r=0; r<(rounds || 40); r++){
    const A = applySim(S, T), pairs = [];
    for(let i=0;i<A.length;i+=3){ const n = G.nearest(A[i], A[i+1], A[i+2]); if(n.i >= 0) pairs.push([i, n.i, n.d]); }
    pairs.sort((a, b)=>a[2] - b[2]); const keep = pairs.slice(0, Math.floor(pairs.length*0.8));
    err = keep.reduce((s, p)=>s + p[2], 0)/keep.length;
    // Umeyama: the similarity that takes the kept A points onto their partners
    const n = keep.length, ma = [0, 0, 0], mb = [0, 0, 0];
    keep.forEach(([i, j])=>{ for(let c=0;c<3;c++){ ma[c] += A[i+c]/n; mb[c] += dst[j*3+c]/n; } });
    const H = [[0,0,0],[0,0,0],[0,0,0]]; let va = 0;
    keep.forEach(([i, j])=>{ for(let x=0;x<3;x++){ const ax = A[i+x] - ma[x]; va += ax*ax/n; for(let y=0;y<3;y++) H[x][y] += ax*(dst[j*3+y] - mb[y])/n; } });
    const { R, s } = umeyama(H, va);
    const M = new THREE.Matrix4().set(R[0][0]*s, R[0][1]*s, R[0][2]*s, 0, R[1][0]*s, R[1][1]*s, R[1][2]*s, 0, R[2][0]*s, R[2][1]*s, R[2][2]*s, 0, 0, 0, 0, 1);
    const t = new THREE.Vector3(...ma).applyMatrix4(M); M.setPosition(mb[0] - t.x, mb[1] - t.y, mb[2] - t.z);
    T = M.multiply(T);
  }
  return { T, err, height:hd };
}
/* the rotation and scale out of a 3x3 cross-covariance, by Jacobi SVD of H^T H */
function umeyama(H, va){
  // H = U S V^T ; R = V diag(1,1,d) U^T (mapping a -> b uses R = V U^T with H = sum a b^T)
  const Ht = [[H[0][0], H[1][0], H[2][0]], [H[0][1], H[1][1], H[2][1]], [H[0][2], H[1][2], H[2][2]]];
  const mul = (A, B) => A.map((r, i)=>[0, 1, 2].map(j=>r[0]*B[0][j] + r[1]*B[1][j] + r[2]*B[2][j]));
  const { V, d } = jacobi(mul(Ht, H));                       // H^T H = V D V^T
  const sv = d.map(x=>Math.sqrt(Math.max(0, x)));
  // U = H V S^-1
  const HV = mul(H, V), U = HV.map(r=>r.map((x, j)=>sv[j] > 1e-12 ? x/sv[j] : 0));
  const Vt = [[V[0][0], V[1][0], V[2][0]], [V[0][1], V[1][1], V[2][1]], [V[0][2], V[1][2], V[2][2]]];
  let Rm = mul(V, [[U[0][0], U[1][0], U[2][0]], [U[0][1], U[1][1], U[2][1]], [U[0][2], U[1][2], U[2][2]]]);   // V U^T
  const det = m => m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  let sv2 = sv.slice();
  if(det(Rm) < 0){ const k = sv.indexOf(Math.min(...sv)); const D = [[1,0,0],[0,1,0],[0,0,1]]; D[k][k] = -1; Rm = mul(mul(V, D), [[U[0][0], U[1][0], U[2][0]], [U[0][1], U[1][1], U[2][1]], [U[0][2], U[1][2], U[2][2]]]); sv2[k] = -sv2[k]; }
  const s = (sv2[0] + sv2[1] + sv2[2])/Math.max(1e-12, va);
  return { R:Rm, s };
}
function jacobi(A){
  const a = A.map(r=>r.slice()), V = [[1,0,0],[0,1,0],[0,0,1]];
  for(let sweep=0; sweep<50; sweep++){
    let off = 0; for(let i=0;i<3;i++) for(let j=i+1;j<3;j++) off += a[i][j]*a[i][j]; if(off < 1e-30) break;
    for(let p=0;p<3;p++) for(let q=p+1;q<3;q++){
      if(Math.abs(a[p][q]) < 1e-30) continue;
      const th = (a[q][q] - a[p][p])/(2*a[p][q]), t = Math.sign(th || 1)/(Math.abs(th) + Math.sqrt(th*th + 1)), c = 1/Math.sqrt(t*t + 1), s = t*c;
      for(let k=0;k<3;k++){ const akp = a[k][p], akq = a[k][q]; a[k][p] = c*akp - s*akq; a[k][q] = s*akp + c*akq; }
      for(let k=0;k<3;k++){ const apk = a[p][k], aqk = a[q][k]; a[p][k] = c*apk - s*aqk; a[q][k] = s*apk + c*aqk; }
      for(let k=0;k<3;k++){ const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c*vkp - s*vkq; V[k][q] = s*vkp + c*vkq; }
    }
  }
  return { V, d:[a[0][0], a[1][1], a[2][2]] };
}

/* WEIGHTS FROM A DONOR. Each vertex takes the bone weights of the nearest
   donor vertex that faces the same way (so an inner thigh does not take
   the other leg's), then everything is smoothed twice over the mesh's own
   edges so no seam appears between two donors. */
function transferWeights(P, N, index, D, names){
  const G = grid(D.pos, (bbox(D.pos).mx[1] - bbox(D.pos).mn[1])/80), n = P.length/3;
  // the donor's own regions: which bone moves each of its vertices most
  const dom = new Int16Array(D.n); for(let j=0;j<D.n;j++){ let b = 0, w = -1; for(let k=0;k<4;k++) if(D.sw[j*4+k] > w){ w = D.sw[j*4+k]; b = D.si[j*4+k]; } dom[j] = b; }
  const isTrunk = b => /^(Hips|Spine|Spine1|Spine2|Neck|Head|HeadTop_End|headfront)$/.test(names[b] || '');
  // the trunk's width and the plane through its middle: anything behind it and inside its width (long hair) belongs to the trunk
  let tx = 0, tz = 0, tn = 0; for(let j=0;j<D.n;j++) if(/^Spine/.test(names[dom[j]] || '')){ tx = Math.max(tx, Math.abs(D.pos[j*3])); tz += D.pos[j*3+2]; tn++; }
  tz /= Math.max(1, tn);
  const hips = (()=>{ let y = Infinity; for(let j=0;j<D.n;j++) if((names[dom[j]] || '') === 'Hips') y = Math.min(y, D.pos[j*3+1]); return y; })();
  const si = new Uint16Array(n*4), sw = new Float32Array(n*4);
  let acc = [];
  for(let i=0;i<n;i++){
    const x = P[i*3], y = P[i*3+1], z = P[i*3+2], nx = N[i*3], ny = N[i*3+1], nz = N[i*3+2];
    const back = z < tz && Math.abs(x) < tx*1.05 && y > hips;
    let r = G.nearest(x, y, z, j=>(!back || isTrunk(dom[j])) && D.nrm[j*3]*nx + D.nrm[j*3+1]*ny + D.nrm[j*3+2]*nz > 0.0, 8);
    if(r.i < 0 && back) r = G.nearest(x, y, z, j=>isTrunk(dom[j]), 12);
    if(r.i < 0) r = G.nearest(x, y, z, null, 12);
    const w = new Map(); for(let k=0;k<4;k++){ const b = D.si[r.i*4+k], ww = D.sw[r.i*4+k]; if(ww > 0) w.set(b, (w.get(b) || 0) + ww); }
    acc.push(w);
  }
  // two rounds of smoothing over the mesh's own edges
  const nb = Array.from({ length:n }, ()=>new Set());
  for(let t=0;t<index.length;t+=3){ const a = index[t], b = index[t+1], c = index[t+2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  for(let round=0; round<2; round++){
    acc = acc.map((w, i)=>{ const o = new Map(); w.forEach((v, b)=>o.set(b, v*2)); nb[i].forEach(j=>acc[j].forEach((v, b)=>o.set(b, (o.get(b) || 0) + v))); return o; });
  }
  for(let i=0;i<n;i++){
    const top = [...acc[i].entries()].sort((a, b)=>b[1] - a[1]).slice(0, 4), sum = top.reduce((s, e)=>s + e[1], 0) || 1;
    top.forEach(([b, v], k)=>{ si[i*4+k] = b; sw[i*4+k] = v/sum; });
  }
  return { si, sw };
}

/* the static mesh SAM sent: its arrays, its index, its material */
async function staticMesh(url){
  const g = await load(url); let m = null; g.scene.traverse(o=>{ if(!m && o.isMesh) m = o; });
  g.scene.updateMatrixWorld(true);
  const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld);
  if(!geo.index){ const idx = []; for(let i=0;i<geo.attributes.position.count;i++) idx.push(i); geo.setIndex(idx); }
  geo.computeVertexNormals();
  return { geo, material:m.material };
}

/* ---------------------------------------------------------- the base body
   SAM's base-outfit person, lined up on the character it was redrawn from,
   weighted from it, bound to its skeleton, with its clips — a character file
   the game loads like any other. `turn` corrects SAM's facing if it ever
   comes back looking the other way. */
async function base(samUrl, charUrl, outPath){
  const ch = await load(charUrl), donorMesh = (()=>{ let s = null; ch.scene.traverse(o=>{ if(!s && o.isSkinnedMesh) s = o; }); return s; })();
  const D = arrays(donorMesh);
  const S = await staticMesh(samUrl);
  const P0 = S.geo.attributes.position.array;
  const fit = icp(P0, D.pos, 45);
  S.geo.applyMatrix4(fit.T); S.geo.computeVertexNormals();
  const P = S.geo.attributes.position.array, N = S.geo.attributes.normal.array;
  const W = transferWeights(P, N, S.geo.index.array, D, donorMesh.skeleton.bones.map(b=>b.name.replace(/^mixamorig:?/, '')));
  S.geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(W.si, 4));
  S.geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(W.sw, 4));
  const mat = S.material; mat.metalness = 0; mat.roughness = 0.8;
  const body = new THREE.SkinnedMesh(S.geo, mat); body.name = 'char1';
  donorMesh.parent.add(body); body.position.copy(donorMesh.position); body.quaternion.copy(donorMesh.quaternion); body.scale.copy(donorMesh.scale);
  body.bind(donorMesh.skeleton, donorMesh.bindMatrix);
  donorMesh.parent.remove(donorMesh);
  const glb = await new Promise((ok, no)=>new GLTFExporter().parse(ch.scene, ok, no, { binary:true, animations:ch.animations }));
  await fetch(outPath, { method:'POST', body:glb });
  return { err:fit.err/fit.height, verts:P.length/3, tris:S.geo.index.count/3 };
}

/* ============================================================ a garment
   A garment Higgsfield drew ON the body's own reference picture (same
   pose, same framing) and SAM lifted out on its own, put on that body:

     1 the picture and the body line up: the person's outline in the
       reference picture is the body's outline at bind, seen from the front
       (glb files/wardrobe/README.md: the body is built FROM that picture);
     2 what changed between the reference and the garment picture is the
       garment, and where it is in the picture is where it goes on the body;
     3 SAM's mesh is scaled and moved onto that, centred in depth on the
       body underneath it, and pushed out wherever it has gone into the body;
     4 it takes the body's bone weights, and comes out in the body's own
       bind space, skinned to its skeleton — what wardrobe.js binds. */
async function pixels(url){
  const img = await new Promise((ok, no)=>{ const i = new Image(); i.onload = ()=>ok(i); i.onerror = no; i.src = url; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  return { w:img.width, h:img.height, d:x.getImageData(0, 0, img.width, img.height).data };
}
/* the box of what is not background (the colour in the corners) */
function outline(im){
  const bg = [0, 1, 2].map(k=>(im.d[k] + im.d[(im.w - 1)*4 + k] + im.d[(im.h - 1)*im.w*4 + k])/3);
  let u0 = im.w, u1 = 0, v0 = im.h, v1 = 0;
  for(let v=0; v<im.h; v++) for(let u=0; u<im.w; u++){ const i = (v*im.w + u)*4, d = Math.abs(im.d[i]-bg[0]) + Math.abs(im.d[i+1]-bg[1]) + Math.abs(im.d[i+2]-bg[2]);
    if(d > 60){ if(u < u0) u0 = u; if(u > u1) u1 = u; if(v < v0) v0 = v; if(v > v1) v1 = v; } }
  return { u0, u1, v0, v1 };
}
/* what changed between two pictures, cleaned: the biggest piece of it, and its box */
function changed(a, b){
  const n = a.w*a.h, m = new Uint8Array(n);
  for(let i=0;i<n;i++){ const d = Math.abs(a.d[i*4]-b.d[i*4]) + Math.abs(a.d[i*4+1]-b.d[i*4+1]) + Math.abs(a.d[i*4+2]-b.d[i*4+2]); m[i] = d > 70 ? 1 : 0; }
  // close small gaps, open specks: 2 px each way
  const morph = (src, grow) => { const o = new Uint8Array(n); for(let v=0; v<a.h; v++) for(let u=0; u<a.w; u++){ let any = 0, all = 1;
    for(let dv=-2; dv<=2; dv++) for(let du=-2; du<=2; du++){ const uu = u+du, vv = v+dv; const x = (uu < 0 || vv < 0 || uu >= a.w || vv >= a.h) ? 0 : src[vv*a.w + uu]; any |= x; all &= x; }
    o[v*a.w + u] = grow ? any : all; } return o; };
  let k = morph(morph(m, true), false); k = morph(morph(k, false), true);
  // the largest connected piece
  const lab = new Int32Array(n), sizes = [0]; let id = 0;
  for(let i=0;i<n;i++){ if(!k[i] || lab[i]) continue; id++; let sz = 0; const st = [i]; lab[i] = id;
    while(st.length){ const j = st.pop(); sz++; const u = j % a.w, v = (j/a.w)|0;
      for(const [du, dv] of [[1,0],[-1,0],[0,1],[0,-1]]){ const uu = u+du, vv = v+dv; if(uu < 0 || vv < 0 || uu >= a.w || vv >= a.h) continue; const q = vv*a.w + uu; if(k[q] && !lab[q]){ lab[q] = id; st.push(q); } } }
    sizes.push(sz); }
  const big = sizes.indexOf(Math.max(...sizes));
  let u0 = a.w, u1 = 0, v0 = a.h, v1 = 0;
  for(let i=0;i<n;i++) if(lab[i] === big){ const u = i % a.w, v = (i/a.w)|0; if(u < u0) u0 = u; if(u > u1) u1 = u; if(v < v0) v0 = v; if(v > v1) v1 = v; }
  return { u0, u1, v0, v1, px:sizes[big] };
}
async function garmentFit(samUrl, bodyUrl, refUrl, garUrl, outPath, o){
  o = o || {};
  const body = await load(bodyUrl), sm = skinnedOf(body.scene);              // at bind (skinnedOf poses it)
  const raw = arrays(sm), W = worldVerts(sm), Bb = boxOf(W), H = Bb.max.y - Bb.min.y;
  // world normals at bind: through the same affine as the positions (raw -> world)
  const A = affine(raw.pos, W);
  const Wn = new Float32Array(raw.nrm.length); for(let i=0;i<raw.n;i++){ const v = new THREE.Vector3(raw.nrm[i*3], raw.nrm[i*3+1], raw.nrm[i*3+2]).applyMatrix3(A.normal).normalize(); Wn.set([v.x, v.y, v.z], i*3); }
  // 1 the picture onto the body: the person's box in the reference is the body's front box
  const ref = await pixels(refUrl), gar = await pixels(garUrl), box = outline(ref);
  const toX = u => Bb.min.x + (u - box.u0)/(box.u1 - box.u0)*(Bb.max.x - Bb.min.x);
  const toY = v => Bb.max.y - (v - box.v0)/(box.v1 - box.v0)*(Bb.max.y - Bb.min.y);
  // 2 where the garment is
  const ch = changed(ref, gar);
  const gx0 = toX(ch.u0), gx1 = toX(ch.u1), gy0 = toY(ch.v1), gy1 = toY(ch.v0);
  // 3 SAM's mesh onto that box, its middle in depth at the body's middle there
  const S = await staticMesh(samUrl); const P = S.geo.attributes.position, sb = new THREE.Box3().setFromBufferAttribute(P), ss = sb.getSize(new THREE.Vector3()), sc = sb.getCenter(new THREE.Vector3());
  const k = ((gx1 - gx0)/ss.x + (gy1 - gy0)/ss.y)/2;
  // its middle in depth: the middle of the SKIN there (long hair down the back would drag it backwards into her)
  const skin = await skinMask(sm, raw);
  let zmin = Infinity, zmax = -Infinity; for(let i=0;i<raw.n;i++){ if(!skin[i]) continue; const y = W[i*3+1], x = W[i*3]; if(y > gy0 && y < gy1 && Math.abs(x - (gx0 + gx1)/2) < (gx1 - gx0)*0.18){ zmin = Math.min(zmin, W[i*3+2]); zmax = Math.max(zmax, W[i*3+2]); } }
  const zc = isFinite(zmin) ? (zmin + zmax)/2 : 0;
  const T = new THREE.Matrix4().makeTranslation((gx0 + gx1)/2, (gy0 + gy1)/2, zc).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(-sc.x, -sc.y, -sc.z));
  S.geo.applyMatrix4(T);
  dropFragments(S.geo, 0.015);                                                // SAM leaves crumbs: only the pieces that matter
  // pushes are only ever from SKIN (the mask above): a collar pushed out through long hair is what breaks into shards
  // pushed out of the skin: how far each point has to go, smoothed over the garment so neighbours move together
  const G = grid(W, H/90), gap = H*(o.gap || 0.006), Q = S.geo.attributes.position.array, nV = Q.length/3;
  const push = new Float32Array(Q.length); let pushed = 0;
  for(let i=0;i<nV;i++){
    const r = G.nearest(Q[i*3], Q[i*3+1], Q[i*3+2], j=>skin[j], 10); if(r.i < 0) continue;
    const j = r.i, nx = Wn[j*3], ny = Wn[j*3+1], nz = Wn[j*3+2];
    const d = (Q[i*3]-W[j*3])*nx + (Q[i*3+1]-W[j*3+1])*ny + (Q[i*3+2]-W[j*3+2])*nz;
    if(d < gap){ const m = gap - d; push[i*3] = nx*m; push[i*3+1] = ny*m; push[i*3+2] = nz*m; pushed++; }
  }
  const nb = neighbours(S.geo.index.array, nV);
  for(let round=0; round<4; round++){
    const next = new Float32Array(push.length);
    for(let i=0;i<nV;i++){ let sx = push[i*3]*2, sy = push[i*3+1]*2, sz = push[i*3+2]*2, c = 2;
      nb[i].forEach(j=>{ sx += push[j*3]; sy += push[j*3+1]; sz += push[j*3+2]; c++; });
      // never smoothed below what a point itself needs: smoothing spreads a push, it does not undo one
      const own = Math.hypot(push[i*3], push[i*3+1], push[i*3+2]), avg = [sx/c, sy/c, sz/c], al = Math.hypot(...avg) || 1;
      const k = Math.max(1, own/al); next[i*3] = avg[0]*k; next[i*3+1] = avg[1]*k; next[i*3+2] = avg[2]*k; }
    push.set(next);
  }
  for(let i=0;i<Q.length;i++) Q[i] += push[i];
  S.geo.attributes.position.needsUpdate = true; S.geo.computeVertexNormals();
  // 4 the body's weights, then back into the body's own bind space
  const D = { pos:W, nrm:Wn, si:raw.si, sw:raw.sw, n:raw.n };
  const Wt = transferWeights(Q, S.geo.attributes.normal.array, S.geo.index.array, D, sm.skeleton.bones.map(b=>b.name.replace(/^mixamorig:?/, '')));
  const inv = A.inverse; S.geo.applyMatrix4(inv); S.geo.computeVertexNormals();
  S.geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Wt.si, 4));
  S.geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Wt.sw, 4));
  const mat = S.material; mat.metalness = 0; mat.roughness = 0.85;
  const gm = new THREE.SkinnedMesh(S.geo, mat); gm.name = o.name || 'garment';
  sm.parent.add(gm); gm.position.copy(sm.position); gm.quaternion.copy(sm.quaternion); gm.scale.copy(sm.scale);
  gm.bind(sm.skeleton, sm.bindMatrix);
  sm.parent.remove(sm);
  const glb = await new Promise((ok, no)=>new GLTFExporter().parse(body.scene, ok, no, { binary:true }));
  await fetch(outPath, { method:'POST', body:glb });
  return { picture:ch, scale:k, pushed, verts:Q.length/3, tris:S.geo.index.count/3 };
}
/* each vertex's neighbours over the mesh's own edges */
function neighbours(idx, n){
  const nb = Array.from({ length:n }, ()=>new Set());
  for(let t=0;t<idx.length;t+=3){ const a = idx[t], b = idx[t+1], c = idx[t+2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  return nb;
}
/* keep only the connected pieces of a mesh with at least `frac` of its vertices (by shared position, not index) */
function dropFragments(geo, frac){
  const P = geo.attributes.position, n = P.count, idx = geo.index.array;
  // weld by position for connectivity
  const key = i => Math.round(P.getX(i)*1e5) + ',' + Math.round(P.getY(i)*1e5) + ',' + Math.round(P.getZ(i)*1e5);
  const rep = new Int32Array(n), seen = new Map(); for(let i=0;i<n;i++){ const k = key(i); if(!seen.has(k)) seen.set(k, i); rep[i] = seen.get(k); }
  const parent = new Int32Array(n).map((_, i)=>i), find = x => { while(parent[x] !== x){ parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const unite = (a, b) => { a = find(rep[a]); b = find(rep[b]); if(a !== b) parent[a] = b; };
  for(let t=0;t<idx.length;t+=3){ unite(idx[t], idx[t+1]); unite(idx[t+1], idx[t+2]); }
  const size = new Map(); for(let i=0;i<n;i++){ const r = find(rep[i]); size.set(r, (size.get(r) || 0) + 1); }
  const keep = []; for(let t=0;t<idx.length;t+=3){ if(size.get(find(rep[idx[t]])) >= n*frac) keep.push(idx[t], idx[t+1], idx[t+2]); }
  geo.setIndex(keep);
}
/* which of a body's vertices are skin or cloth rather than hair: hair is the near-black of its colour map */
async function skinMask(sm, raw){
  const out = new Uint8Array(raw.n).fill(1);
  const map = (Array.isArray(sm.material) ? sm.material[0] : sm.material).map, uv = sm.geometry.attributes.uv;
  if(!map || !map.image || !uv) return out;
  const img = map.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
  for(let i=0;i<raw.n;i++){
    let u = uv.getX(i), v = uv.getY(i); if(map.flipY !== false) v = 1 - v;   // three's glTF textures are flipY=false
    u = ((u % 1) + 1) % 1; v = ((v % 1) + 1) % 1;
    const px = Math.min(c.width - 1, Math.floor(u*c.width)), py = Math.min(c.height - 1, Math.floor(v*c.height)), k = (py*c.width + px)*4;
    const lum = 0.2126*d[k] + 0.7152*d[k+1] + 0.0722*d[k+2];
    if(lum < 28) out[i] = 0;
  }
  return out;
}
/* the affine that takes a body's raw (bind-space) points to where they are drawn, fitted on all of them */
function affine(R, W){
  // least squares: W = M * [R 1]; normal equations on 4x4
  const n = R.length/3, ATA = new Float64Array(16), ATB = [new Float64Array(4), new Float64Array(4), new Float64Array(4)];
  for(let i=0;i<n;i++){ const r = [R[i*3], R[i*3+1], R[i*3+2], 1];
    for(let a=0;a<4;a++){ for(let b=0;b<4;b++) ATA[a*4+b] += r[a]*r[b]; for(let c=0;c<3;c++) ATB[c][a] += r[a]*W[i*3+c]; } }
  const solve = (M, y) => { const m = Array.from({ length:4 }, (_, i)=>[M[i*4], M[i*4+1], M[i*4+2], M[i*4+3], y[i]]);
    for(let c=0;c<4;c++){ let p = c; for(let r=c+1;r<4;r++) if(Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r; [m[c], m[p]] = [m[p], m[c]];
      for(let r=0;r<4;r++){ if(r === c) continue; const f = m[r][c]/m[c][c]; for(let k=c;k<5;k++) m[r][k] -= f*m[c][k]; } }
    return m.map((row, i)=>row[4]/row[i]); };
  const rows = [0, 1, 2].map(c=>solve(ATA, ATB[c]));
  const M = new THREE.Matrix4().set(rows[0][0], rows[0][1], rows[0][2], rows[0][3], rows[1][0], rows[1][1], rows[1][2], rows[1][3], rows[2][0], rows[2][1], rows[2][2], rows[2][3], 0, 0, 0, 1);
  return { M, inverse:M.clone().invert(), normal:new THREE.Matrix3().getNormalMatrix(M) };
}

/* ======================================================= onto another body
   A garment made for body R, put on body B (another person, another shape):
     1 bone by bone: every point rides its bones from where they are in R to
       where they are in B (linear blend skinning from R's bind to B's) —
       which fits the garment to B's limbs, their lengths and their angles;
     2 then it hugs B as it hugged R: each point keeps its own distance from
       the skin under it, measured on R, now off B's skin — which fits it to
       B's girth (and keeps a loose hem loose);
     3 B's weights, B's bind space, B's skeleton. */
async function transfer(garUrl, rUrl, bUrl, outPath, o){
  o = o || {};
  const bodyR = await load(rUrl), smR = skinnedOf(bodyR.scene), rawR = arrays(smR), WR = worldVerts(smR), AR = affine(rawR.pos, WR);
  const bodyB = await load(bUrl), smB = skinnedOf(bodyB.scene), rawB = arrays(smB), WB = worldVerts(smB), AB = affine(rawB.pos, WB);
  const nrmW = (raw, A) => { const out = new Float32Array(raw.nrm.length); for(let i=0;i<raw.n;i++){ const v = new THREE.Vector3(raw.nrm[i*3], raw.nrm[i*3+1], raw.nrm[i*3+2]).applyMatrix3(A.normal).normalize(); out.set([v.x, v.y, v.z], i*3); } return out; };
  const NR = nrmW(rawR, AR), NB = nrmW(rawB, AB);
  const skinR = await skinMask(smR, rawR), skinB = await skinMask(smB, rawB);
  const HR = boxOf(WR).max.y - boxOf(WR).min.y, HB = boxOf(WB).max.y - boxOf(WB).min.y;
  // the garment, in R's world at bind
  const g = await load(garUrl); let gm = null; g.scene.traverse(x=>{ if(!gm && x.isSkinnedMesh) gm = x; });
  const geo = gm.geometry.clone(), P = geo.attributes.position, n = P.count, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const Q = new Float32Array(n*3), v = new THREE.Vector3();
  for(let i=0;i<n;i++){ v.fromBufferAttribute(P, i).applyMatrix4(AR.M); Q.set([v.x, v.y, v.z], i*3); }
  // 1 bone by bone, R's bind to B's
  const clean = s => String(s || '').replace(/^mixamorig:?/, '');
  const bonesR = new Map(smR.skeleton.bones.map(b=>[clean(b.name), b])), bonesB = new Map(smB.skeleton.bones.map(b=>[clean(b.name), b]));
  const gNames = gm.skeleton.bones.map(b=>clean(b.name));
  const X = gNames.map(nm=>{ const br = bonesR.get(nm), bb = bonesB.get(nm); if(!br || !bb) return null; return bb.matrixWorld.clone().multiply(br.matrixWorld.clone().invert()); });
  const QB = new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const p = new THREE.Vector3(Q[i*3], Q[i*3+1], Q[i*3+2]), acc = new THREE.Vector3(); let wsum = 0;
    for(let k=0;k<4;k++){ const w = SW.getComponent(i, k), b = SI.getComponent(i, k); if(w <= 0 || !X[b]) continue; acc.addScaledVector(p.clone().applyMatrix4(X[b]), w); wsum += w; }
    if(wsum > 0) acc.multiplyScalar(1/wsum); else acc.copy(p);
    QB.set([acc.x, acc.y, acc.z], i*3);
  }
  // 2 the same distance off B's skin as it had off R's
  const GR = grid(WR, HR/90), GB = grid(WB, HB/90), gapB = HB*0.005, reach = HR*0.03;
  const move = new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const r = GR.nearest(Q[i*3], Q[i*3+1], Q[i*3+2], j=>skinR[j], 10); if(r.i < 0) continue;
    const dR = (Q[i*3]-WR[r.i*3])*NR[r.i*3] + (Q[i*3+1]-WR[r.i*3+1])*NR[r.i*3+1] + (Q[i*3+2]-WR[r.i*3+2])*NR[r.i*3+2];
    if(dR > reach) continue;                                                  // loose cloth stays where its bones put it
    const b = GB.nearest(QB[i*3], QB[i*3+1], QB[i*3+2], j=>skinB[j], 10); if(b.i < 0) continue;
    const want = Math.max(dR*HB/HR, gapB);
    const dB = (QB[i*3]-WB[b.i*3])*NB[b.i*3] + (QB[i*3+1]-WB[b.i*3+1])*NB[b.i*3+1] + (QB[i*3+2]-WB[b.i*3+2])*NB[b.i*3+2];
    const m = want - dB; move[i*3] = NB[b.i*3]*m; move[i*3+1] = NB[b.i*3+1]*m; move[i*3+2] = NB[b.i*3+2]*m;
  }
  const nb = neighbours(geo.index.array, n);
  for(let round=0; round<5; round++){ const nx = new Float32Array(move.length);
    for(let i=0;i<n;i++){ let sx = move[i*3]*2, sy = move[i*3+1]*2, sz = move[i*3+2]*2, c = 2; nb[i].forEach(j=>{ sx += move[j*3]; sy += move[j*3+1]; sz += move[j*3+2]; c++; }); nx[i*3] = sx/c; nx[i*3+1] = sy/c; nx[i*3+2] = sz/c; }
    move.set(nx); }
  for(let i=0;i<n*3;i++) QB[i] += move[i];
  // nothing left inside B's skin
  for(let i=0;i<n;i++){ const b = GB.nearest(QB[i*3], QB[i*3+1], QB[i*3+2], j=>skinB[j], 10); if(b.i < 0) continue;
    const d = (QB[i*3]-WB[b.i*3])*NB[b.i*3] + (QB[i*3+1]-WB[b.i*3+1])*NB[b.i*3+1] + (QB[i*3+2]-WB[b.i*3+2])*NB[b.i*3+2];
    if(d < gapB){ const m = gapB - d; QB[i*3] += NB[b.i*3]*m; QB[i*3+1] += NB[b.i*3+1]*m; QB[i*3+2] += NB[b.i*3+2]*m; } }
  // 3 B's weights, B's space, B's skeleton
  for(let i=0;i<n;i++) P.setXYZ(i, QB[i*3], QB[i*3+1], QB[i*3+2]);
  geo.computeVertexNormals();
  const W = transferWeights(QB, geo.attributes.normal.array, geo.index.array, { pos:WB, nrm:NB, si:rawB.si, sw:rawB.sw, n:rawB.n }, smB.skeleton.bones.map(b=>clean(b.name)));
  geo.applyMatrix4(AB.inverse); geo.computeVertexNormals();
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(W.si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(W.sw, 4));
  const out = new THREE.SkinnedMesh(geo, gm.material); out.name = gm.name;
  smB.parent.add(out); out.position.copy(smB.position); out.quaternion.copy(smB.quaternion); out.scale.copy(smB.scale);
  out.bind(smB.skeleton, smB.bindMatrix); smB.parent.remove(smB);
  const glb = await new Promise((ok, no)=>new GLTFExporter().parse(bodyB.scene, ok, no, { binary:true }));
  await fetch(outPath, { method:'POST', body:glb });
  return { verts:n };
}

/* THE ROSTER CARD: 256 x 328, head to thigh, in the idle, on nothing (menu.js, chars.js and shop.js draw these) */
async function card(url){
  const g = await load(url), sc = g.scene;
  const c = g.animations.find(a=>a.name === 'idle'); if(c){ const mx = new THREE.AnimationMixer(sc); mx.clipAction(c).play(); mx.setTime(0.3); }
  sc.updateMatrixWorld(true);
  const sm = skinnedOf(sc); if(c){ const mx = new THREE.AnimationMixer(sc); mx.clipAction(c).play(); mx.setTime(0.3); sc.updateMatrixWorld(true); }
  const box = boxOf(worldVerts(sm)), s = box.getSize(new THREE.Vector3()), cx = (box.min.x + box.max.x)/2;
  const top = box.max.y + s.y*0.03, bottom = box.max.y - s.y*0.6, h = top - bottom, w = h*256/328;
  const S = new THREE.Scene();
  S.add(new THREE.HemisphereLight(0xffffff, 0xc3b4e6, 1.5)); const key = new THREE.DirectionalLight(0xfff3f8, 1.5); key.position.set(3, 6, 5); S.add(key);
  const rim = new THREE.DirectionalLight(0x9fb4ff, 0.8); rim.position.set(-4, 3, -4); S.add(rim);
  S.add(sc);
  const cam = new THREE.OrthographicCamera(-w/2, w/2, h/2, -h/2, 0.01, 100); cam.position.set(cx, bottom + h/2, (box.max.z + 10)); cam.lookAt(cx, bottom + h/2, 0);
  const R2 = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true }); R2.outputColorSpace = THREE.SRGBColorSpace; R2.setClearColor(0, 0);
  R2.setSize(256, 328, false); R2.render(S, cam);
  return R2.domElement.toDataURL('image/png');
}

window.LAB = { render, base, card, garment:garmentFit, transfer, ready:true };
