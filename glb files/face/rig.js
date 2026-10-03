/* POSE A SKINNED GLB AND READ ITS VERTICES BACK, in node: the node tree, an animation sampled at a time,
   extra per-bone turns and shifts on top, and linear-blend skinning — enough to measure a face rig. */
const THREE = require('../../node_modules/three/build/three.cjs');
const io = require('./glbio');
function load(path){
  const g = io.read(path), J = g.json;
  const parent = {}; J.nodes.forEach((n, i)=>(n.children || []).forEach(c=>parent[c] = i));
  const rest = J.nodes.map(n=>{ const o = { t:new THREE.Vector3(...(n.translation || [0, 0, 0])), r:new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])), s:new THREE.Vector3(...(n.scale || [1, 1, 1])) };
    if(n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(o.t, o.r, o.s);            // a node given as a matrix is the same TRS
    return o; });
  const byName = {}; J.nodes.forEach((n, i)=>{ byName[n.name] = i; });
  const anim = (J.animations || [])[0];
  const ch = anim ? anim.channels.map(c=>{ const s = anim.samplers[c.sampler]; return { node:c.target.node, path:c.target.path, t:io.acc(g, s.input).map(r=>r[0]), v:io.acc(g, s.output) }; }) : [];
  const meshes = J.meshes.map((m, mi)=>{ const p = m.primitives[0]; const node = J.nodes.findIndex(n=>n.mesh === mi);
    return { name:m.name, node, skin:J.nodes[node].skin, pos:io.acc(g, p.attributes.POSITION), j:p.attributes.JOINTS_0 !== undefined ? io.acc(g, p.attributes.JOINTS_0) : null, w:p.attributes.WEIGHTS_0 !== undefined ? io.acc(g, p.attributes.WEIGHTS_0) : null, idx:p.indices !== undefined ? io.acc(g, p.indices).map(r=>r[0]) : null }; });
  const skins = (J.skins || []).map(s=>({ joints:s.joints, ibm:io.acc(g, s.inverseBindMatrices).map(r=>new THREE.Matrix4().fromArray(r)) }));
  const dur = ch.reduce((d, c)=>Math.max(d, c.t[c.t.length - 1]), 0);
  return { g, J, parent, rest, byName, ch, meshes, skins, dur };
}
function sample(c, time){
  const t = c.t; let i = 0; while(i < t.length - 1 && t[i + 1] <= time) i++;
  const j = Math.min(i + 1, t.length - 1), k = t[j] > t[i] ? Math.min(1, Math.max(0, (time - t[i])/(t[j] - t[i]))) : 0;
  if(c.path === 'rotation'){ const a = new THREE.Quaternion(...c.v[i]), b = new THREE.Quaternion(...c.v[j]); return a.slerp(b, k); }
  return new THREE.Vector3(...c.v[i]).lerp(new THREE.Vector3(...c.v[j]), k);
}
/* world matrices at `time` (null: the rest pose), with `extra[name] = { r:Quaternion (after), t:Vector3 (added, parent space) }` */
function pose(R, time, extra){
  const loc = R.rest.map(r=>({ t:r.t.clone(), r:r.r.clone(), s:r.s.clone() }));
  if(time !== null && time !== undefined) R.ch.forEach(c=>{ const v = sample(c, time); if(c.path === 'rotation') loc[c.node].r.copy(v); else if(c.path === 'translation') loc[c.node].t.copy(v); else if(c.path === 'scale') loc[c.node].s.copy(v); });
  for(const name in (extra || {})){ const i = R.byName[name]; if(i === undefined) throw new Error('no bone ' + name); const e = extra[name];
    if(e.r) loc[i].r.multiply(e.r); if(e.t) loc[i].t.add(e.t); }
  const world = new Array(R.rest.length);
  const get = i => { if(world[i]) return world[i]; const l = loc[i]; const m = new THREE.Matrix4().compose(l.t, l.r, l.s);
    world[i] = R.parent[i] !== undefined ? get(R.parent[i]).clone().multiply(m) : m; return world[i]; };
  R.rest.forEach((_, i)=>get(i));
  return world;
}
/* the mesh's vertices, skinned, in world space */
function skin(R, world, mi){
  const M = R.meshes[mi], out = new Array(M.pos.length);
  if(M.skin === undefined){ const m = world[M.node]; return M.pos.map(p=>new THREE.Vector3(...p).applyMatrix4(m)); }
  const S = R.skins[M.skin], bm = S.joints.map((j, k)=>world[j].clone().multiply(S.ibm[k]));
  const v = new THREE.Vector3(), acc = new THREE.Vector3();
  for(let k = 0; k < M.pos.length; k++){ acc.set(0, 0, 0); let ws = 0;
    for(let c = 0; c < 4; c++){ const w = M.w[k][c]; if(w <= 0) continue; v.set(...M.pos[k]).applyMatrix4(bm[M.j[k][c]]); acc.addScaledVector(v, w); ws += w; }
    out[k] = ws > 0 ? acc.clone().multiplyScalar(1/ws) : new THREE.Vector3(...M.pos[k]); }
  return out;
}
function bonePos(R, world, name){ return new THREE.Vector3().setFromMatrixPosition(world[R.byName[name]]); }
module.exports = { THREE, load, pose, skin, bonePos };
