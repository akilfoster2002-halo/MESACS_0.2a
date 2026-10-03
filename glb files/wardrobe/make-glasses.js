/* GLASSES (Maya's): round wire rims, clear lenses, a bridge and the arms — made, not modelled.
   Laid out like shades.glb: about one unit across the front, facing +z, the arms running back along -z;
   wardrobe.js sizes and seats it on the head (fit 'eyes').
     node wardrobe/make-glasses.js <out.glb> */
const THREE = require('../../node_modules/three/build/three.cjs');
const fs = require('fs');
const out = process.argv[2];
const R = 0.21, T = 0.013, CX = 0.255;
const frame = [], lens = [];
const add = (list, geo, m) => { geo = geo.toNonIndexed ? geo : geo; if(m) geo.applyMatrix4(m); list.push(geo); };
const M = (x, y, z, rx, ry, rz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(1, 1, 1));
[-1, 1].forEach(s=>{
  add(frame, new THREE.TorusGeometry(R, T, 8, 48), M(s*CX, 0, 0));                                          // the rim
  add(lens, new THREE.CircleGeometry(R - T*0.5, 40), M(s*CX, 0, -0.004));                                   // the lens
  add(frame, new THREE.CylinderGeometry(T*0.8, T*0.8, 0.05, 6), M(s*(CX + R + 0.02), 0.04, -0.02, 0, 0, Math.PI/2)); // the hinge
  add(frame, new THREE.CylinderGeometry(T*0.7, T*0.7, 0.92, 6), M(s*(CX + R + 0.045), 0.04, -0.48, Math.PI/2, 0, 0)); // the arm
  add(frame, new THREE.CylinderGeometry(T*0.7, T*0.7, 0.16, 6), M(s*(CX + R + 0.045), -0.02, -0.97, Math.PI/2 - 0.7, 0, 0)); // over the ear
});
add(frame, new THREE.TorusGeometry(0.075, T*0.85, 6, 16, Math.PI), M(0, 0.07, 0));                           // the bridge
function merge(list){
  const pos = [], nor = [], idx = []; let base = 0;
  list.forEach(g=>{ const p = g.attributes.position, n = g.attributes.normal; for(let i = 0; i < p.count; i++){ pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    const ix = g.index ? g.index.array : [...Array(p.count).keys()]; for(const i of ix) idx.push(i + base); base += p.count; });
  return { pos, nor, idx };
}
const parts = [merge(frame), merge(lens)];
const bufs = [], views = [], accs = []; let off = 0;
function push(arr, Type, target, type, comp, minmax){
  const b = Buffer.from(new Type(arr).buffer); const pad = (4 - (b.length % 4)) % 4;
  views.push({ buffer:0, byteOffset:off, byteLength:b.length, target }); bufs.push(b, Buffer.alloc(pad)); off += b.length + pad;
  const n = { VEC3:3, SCALAR:1 }[type], a = { bufferView:views.length - 1, componentType:comp, count:arr.length/n, type };
  if(minmax){ a.min = [0, 1, 2].map(c=>Math.min(...arr.filter((_, i)=>i % 3 === c))); a.max = [0, 1, 2].map(c=>Math.max(...arr.filter((_, i)=>i % 3 === c))); }
  accs.push(a); return accs.length - 1;
}
const prims = parts.map((p, i)=>({ attributes:{ POSITION:push(p.pos, Float32Array, 34962, 'VEC3', 5126, true), NORMAL:push(p.nor, Float32Array, 34962, 'VEC3', 5126) },
  indices:push(p.idx, Uint32Array, 34963, 'SCALAR', 5125), material:i }));
const json = { asset:{ version:'2.0', generator:'make-glasses.js' }, scene:0, scenes:[{ nodes:[0] }], nodes:[{ name:'glasses', mesh:0 }],
  meshes:[{ name:'glasses', primitives:prims }],
  materials:[{ name:'wire', pbrMetallicRoughness:{ baseColorFactor:[0.78, 0.74, 0.68, 1], metallicFactor:0.9, roughnessFactor:0.28 } },
             { name:'lens', alphaMode:'BLEND', doubleSided:true, pbrMetallicRoughness:{ baseColorFactor:[0.82, 0.9, 0.95, 0.14], metallicFactor:0, roughnessFactor:0.05 } }],
  accessors:accs, bufferViews:views, buffers:[{ byteLength:off }] };
const bin = Buffer.concat(bufs);
let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
const h = Buffer.alloc(12); h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4E4F534A, 4); const c2 = Buffer.alloc(8); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004E4942, 4);
fs.writeFileSync(out, Buffer.concat([h, c1, js, c2, bin]));
console.log('wrote', out, (fs.statSync(out).size/1024).toFixed(0) + ' KB');
