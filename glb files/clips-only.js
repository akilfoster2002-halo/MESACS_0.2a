/* CLIPS ONLY. A character file's animations and the skeleton they move,
   with the mesh, skin, materials and pictures taken out — for moves a
   scene loads on top of a body the game already has (TSH's fight: Robin's
   punches are hers alone, and not every room should pay for them).

   The clips name their bones the way the body does, so the game adds
   them to the body's own rig (avatar.js rig.add) and they play on it.

     node clips-only.js <in.glb> <out.glb>        then: gltf-transform prune
*/
const fs = require('fs');
const [,, inPath, outPath] = process.argv;
const b = fs.readFileSync(inPath);
let off = 12, json = null, bin = null;
while(off < b.length){
  const len = b.readUInt32LE(off), t = b.readUInt32LE(off + 4);
  if(t === 0x4E4F534A) json = JSON.parse(b.slice(off + 8, off + 8 + len).toString('utf8'));
  else if(t === 0x004E4942) bin = b.slice(off + 8, off + 8 + len);
  off += 8 + len;
}
for(const n of json.nodes || []){ delete n.mesh; delete n.skin; }
for(const k of ['meshes', 'skins', 'materials', 'textures', 'images', 'samplers']) delete json[k];
for(const k of ['extensionsUsed', 'extensionsRequired']) if(json[k]){
  json[k] = json[k].filter(e=>!/^KHR_(texture|materials)|^EXT_texture/.test(e));
  if(!json[k].length) delete json[k];
}
let js = Buffer.from(JSON.stringify(json)); while(js.length % 4) js = Buffer.concat([js, Buffer.from(' ')]);
const pad = bin.length % 4 ? Buffer.concat([bin, Buffer.alloc(4 - bin.length % 4)]) : bin;
const h = Buffer.alloc(12); h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + js.length + 8 + pad.length, 8);
const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4E4F534A, 4);
const c2 = Buffer.alloc(8); c2.writeUInt32LE(pad.length, 0); c2.writeUInt32LE(0x004E4942, 4);
fs.writeFileSync(outPath, Buffer.concat([h, c1, js, c2, pad]));
console.log('clips-only', outPath, (json.animations || []).map(a=>a.name).join(','));
