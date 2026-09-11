/* Make a Sketchfab car export behave like a game asset.

   The McLaren arrives as 88 nodes, 67 meshes and 48 materials with three
   things wrong with it for our purposes:

   EMISSIVE.  Twenty of the forty-eight materials carry an emissiveFactor
   equal to their own base colour — Sketchfab baking its viewer's shading
   into the file.  An emissive surface lights itself, so the car ignored
   the sun the rest of the planet is lit by, and no tint could touch it:
   set the body to red and it still glowed orange.

   METALNESS.  Fifteen materials leave metallicFactor undefined, which in
   glTF means 1.0 — fully metal.  A metal surface is nothing but its
   reflections, and this scene has no environment map to reflect, so the
   moment the emissive came off they would have gone black.

   UVs.  Every vertex carries a TEXCOORD_0 and the file contains no images
   at all.  That is 555 kB of a 3.2 MB download addressing textures that
   do not exist.

   And the paint is spread over five materials, so the shop would have had
   five things to tint instead of one.

   node car-build.js <in.glb> <out.glb>
*/
const fs = require('fs');

const IN = process.argv[2], OUT = process.argv[3];

/* the body, found by COLOUR rather than by name: Sketchfab numbers its
   duplicates (Paint, Paint.002, Paint.003) and files them under names that
   have nothing to do with what they are (the lower panels are called
   `vehiclelights128`), so the one thing that reliably says "this is the
   paint" is that it is painted the paint colour. */
const BODY = ['#ff5004', '#ff3d00'];
const BODY_NAME = 'body';
const BODY_DEFAULT = [0.94, 0.29, 0.02, 1];   // McLaren orange, for anything that does not tint

const hex = c => '#' + c.slice(0,3)
  .map(v => Math.round(Math.min(1, Math.max(0, v))*255).toString(16).padStart(2,'0')).join('');
const pad4 = n => (4 - (n % 4)) % 4;

function read(file){
  const b = fs.readFileSync(file);
  if(b.readUInt32LE(0) !== 0x46546C67) throw new Error('not a glb');
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  return { json, bin: b.slice(binStart, binStart + b.readUInt32LE(20 + jsonLen)) };
}

function write(file, json, bin){
  json.buffers = [{ byteLength: bin.length }];
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  js = Buffer.concat([js, Buffer.alloc(pad4(js.length), 0x20)]);
  const binPad = Buffer.concat([bin, Buffer.alloc(pad4(bin.length))]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + js.length + 8 + binPad.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0);      jh.writeUInt32LE(0x4E4F534A, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(binPad.length, 0);  bh.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, jh, js, bh, binPad]));
}

const { json: j, bin } = read(IN);

/* ------------------------------------------------------------- materials */
let bodyIdx = -1, folded = 0;
j.materials.forEach((m, i) => {
  const p = m.pbrMetallicRoughness = m.pbrMetallicRoughness || {};
  const base = p.baseColorFactor || [1,1,1,1];
  if(BODY.includes(hex(base))){
    if(bodyIdx < 0) bodyIdx = i; else folded++;
  }
});
if(bodyIdx < 0) throw new Error('found no body paint — has the model changed colour?');

const remap = new Map();                       // old material -> the one that replaces it
j.materials.forEach((m, i) => {
  const p = m.pbrMetallicRoughness;
  const base = p.baseColorFactor || [1,1,1,1];
  if(BODY.includes(hex(base))) remap.set(i, bodyIdx);

  /* Nothing on a car lights itself.  The headlamps had it too, but they
     had it at full white over the whole lens, which reads as a lamp that
     is on in daylight rather than as glass. */
  delete m.emissiveFactor;
  delete m.emissiveTexture;

  /* No environment map in this scene, so metal has nothing to reflect and
     renders black.  Everything is a dielectric here, and the shine is
     carried by roughness instead. */
  const wasMetal = p.metallicFactor === undefined || p.metallicFactor >= 0.5;
  p.metallicFactor = 0;
  const r = p.roughnessFactor;
  // a mirror-smooth 0 gives one pinprick highlight under a directional
  // light and reads as flat plastic; keep a floor under it
  p.roughnessFactor = (r === undefined || r < 0.25) ? 0.35 : r;

  /* A METAL'S COLOUR IS ITS REFLECTION, not its brightness.  The wheels
     were near-white at metallicFactor 1, which meant "mirror" — turn that
     into a dielectric at face value and you get white plastic wheels.
     Read down, they read as the brushed silver they were standing in for. */
  if(wasMetal && !BODY.includes(hex(base))){
    p.baseColorFactor = base.slice();
    for(let k = 0; k < 3; k++) p.baseColorFactor[k] = base[k] * 0.55;
    if(base.length > 3) p.baseColorFactor[3] = base[3];
  }
});

const body = j.materials[bodyIdx];
body.name = BODY_NAME;
body.pbrMetallicRoughness.baseColorFactor = BODY_DEFAULT.slice();
body.pbrMetallicRoughness.roughnessFactor = 0.30;   // car paint: a broad soft sheen
body.doubleSided = false;

/* ---------------------------------------------------------------- wheels
   The Circuit already turns the wheels of whatever it is driving, and it
   finds them by name: the Kenney kit called them wheelFrontLeft and so on,
   and race.js has looked for exactly that since it was written.  So the
   asset takes the game's names rather than the game learning Sketchfab's
   — the rig calls these DEF-Wheel.Ft.L_21, which is a fact about the
   Blender file it came out of and about nothing else. */
const WHEELS = {
  'DEF-Wheel.Ft.L_21':'wheelFrontLeft',  'DEF-Wheel.Ft.R_23':'wheelFrontRight',
  'DEF-Wheel.Bk.L_25':'wheelBackLeft',   'DEF-Wheel.Bk.R_27':'wheelBackRight'
};
let renamed = 0;
j.nodes.forEach(n => { if(WHEELS[n.name]){ n.name = WHEELS[n.name]; renamed++; } });
if(renamed !== 4) throw new Error('expected 4 wheel nodes, renamed ' + renamed);

/* ------------------------------------------------------------ attributes */
let uvsDropped = 0;
j.meshes.forEach(m => m.primitives.forEach(p => {
  Object.keys(p.attributes).forEach(a => {
    if(/^TEXCOORD_/.test(a)){ delete p.attributes[a]; uvsDropped++; }
  });
  if(remap.has(p.material)) p.material = remap.get(p.material);
}));

/* ---------------------------------------------- keep only what is used */
// accessors first: dropping the UVs orphans a third of them
const accUsed = new Set();
j.meshes.forEach(m => m.primitives.forEach(p => {
  Object.values(p.attributes).forEach(a => accUsed.add(a));
  if(p.indices !== undefined) accUsed.add(p.indices);
  (p.targets||[]).forEach(t => Object.values(t).forEach(a => accUsed.add(a)));
}));
(j.animations||[]).forEach(a => a.samplers.forEach(s => { accUsed.add(s.input); accUsed.add(s.output); }));
(j.skins||[]).forEach(s => { if(s.inverseBindMatrices !== undefined) accUsed.add(s.inverseBindMatrices); });

const accMap = new Map(); const accessors = [];
j.accessors.forEach((a, i) => { if(accUsed.has(i)){ accMap.set(i, accessors.length); accessors.push(a); } });

// then the bufferViews those accessors still point at, copied into a fresh bin
const bvUsed = new Set(accessors.map(a => a.bufferView).filter(v => v !== undefined));
const bvMap = new Map(); const views = []; const chunks = []; let off = 0;
j.bufferViews.forEach((v, i) => {
  if(!bvUsed.has(i)) return;
  const start = v.byteOffset || 0;
  chunks.push(bin.slice(start, start + v.byteLength), Buffer.alloc(pad4(v.byteLength)));
  const nv = { buffer:0, byteOffset:off, byteLength:v.byteLength };
  if(v.byteStride !== undefined) nv.byteStride = v.byteStride;
  if(v.target !== undefined) nv.target = v.target;
  bvMap.set(i, views.length); views.push(nv);
  off += v.byteLength + pad4(v.byteLength);
});
accessors.forEach(a => { if(a.bufferView !== undefined) a.bufferView = bvMap.get(a.bufferView); });
j.meshes.forEach(m => m.primitives.forEach(p => {
  Object.keys(p.attributes).forEach(k => p.attributes[k] = accMap.get(p.attributes[k]));
  if(p.indices !== undefined) p.indices = accMap.get(p.indices);
}));
(j.animations||[]).forEach(a => a.samplers.forEach(s => {
  s.input = accMap.get(s.input); s.output = accMap.get(s.output); }));
(j.skins||[]).forEach(s => { if(s.inverseBindMatrices !== undefined)
  s.inverseBindMatrices = accMap.get(s.inverseBindMatrices); });

j.accessors = accessors; j.bufferViews = views;
j.asset = Object.assign({}, j.asset, { generator: 'car-build.js (from ' + (j.asset&&j.asset.generator) + ')' });

const out = Buffer.concat(chunks);
write(OUT, j, out);

const before = fs.statSync(IN).size, after = fs.statSync(OUT).size;
let tris = 0;
j.meshes.forEach(m => m.primitives.forEach(p => {
  if(p.indices !== undefined) tris += j.accessors[p.indices].count/3; }));
console.log(`wheels:    ${renamed} renamed to the names race.js already looks for`);
console.log(`body:      ${folded + 1} materials folded into one named '${BODY_NAME}'`);
console.log(`emissive:  cleared on every material`);
console.log(`uvs:       ${uvsDropped} TEXCOORD_0 attributes dropped (the file has no images)`);
console.log(`buffers:   ${j.bufferViews.length} views kept of ${bvUsed.size + (3 - bvUsed.size)}`);
console.log(`size:      ${(before/1048576).toFixed(2)} MB -> ${(after/1048576).toFixed(2)} MB`);
console.log(`tris:      ${Math.round(tris)}`);
