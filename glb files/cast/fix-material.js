/* THE MATERIAL HIGGSFIELD SHIPS IS WRONG FOR A LIT GAME. The colour texture
   comes back twice, as base colour AND as an emissive map at full strength,
   so the body glows at its own colour whatever the light does — flat, and
   the first thing that reads as washed out. Metalness is left unset, which
   glTF reads as fully metallic (dark without an environment map), and a
   specular factor of 2 on top. This keeps the base colour and makes it a
   plain matte cloth-and-skin surface.

     node cast/fix-material.js <in.glb> <out.glb>                          */
const fs=require('fs');
const [,, inPath, outPath]=process.argv;
const b=fs.readFileSync(inPath);
let off=12, json=null, bin=null;
while(off<b.length){
  const len=b.readUInt32LE(off), t=b.readUInt32LE(off+4);
  if(t===0x4E4F534A) json=JSON.parse(b.slice(off+8,off+8+len).toString('utf8'));
  else if(t===0x004E4942) bin=b.slice(off+8,off+8+len);
  off+=8+len;
}
for(const m of json.materials||[]){
  delete m.emissiveTexture; delete m.emissiveFactor;
  if(m.extensions){ delete m.extensions.KHR_materials_specular; delete m.extensions.KHR_materials_ior;
    if(!Object.keys(m.extensions).length) delete m.extensions; }
  m.pbrMetallicRoughness=Object.assign(m.pbrMetallicRoughness||{}, {metallicFactor:0, roughnessFactor:0.85});
}
const used=new Set(); for(const m of json.materials||[]) for(const k of Object.keys(m.extensions||{})) used.add(k);
for(const key of ['extensionsUsed','extensionsRequired']) if(json[key]){
  json[key]=json[key].filter(e=>!e.startsWith('KHR_materials_') || used.has(e));
  if(!json[key].length) delete json[key];
}
const pad=(buf,c)=>{ const p=(4-buf.length%4)%4; return p?Buffer.concat([buf,Buffer.alloc(p,c)]):buf; };
const J=pad(Buffer.from(JSON.stringify(json)),0x20), B=pad(bin,0);
const head=Buffer.alloc(12); head.writeUInt32LE(0x46546C67,0); head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+J.length+8+B.length,8);
const ch=(len,t)=>{ const h=Buffer.alloc(8); h.writeUInt32LE(len,0); h.writeUInt32LE(t,4); return h; };
fs.writeFileSync(outPath, Buffer.concat([head, ch(J.length,0x4E4F534A), J, ch(B.length,0x004E4942), B]));
console.log(outPath, (fs.statSync(outPath).size/1e6).toFixed(2)+' MB', (json.materials||[]).length, 'material(s) fixed');
