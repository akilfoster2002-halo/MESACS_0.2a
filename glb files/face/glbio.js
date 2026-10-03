/* the smallest glb reader/writer the face work needs: json + one binary chunk, accessors as plain arrays */
const fs = require('fs');
const NC = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT4:16 };
function read(path){
  const b = fs.readFileSync(path); let off = 12, json = null, bin = null;
  while(off < b.length){ const len = b.readUInt32LE(off), t = b.readUInt32LE(off + 4);
    if(t === 0x4E4F534A) json = JSON.parse(b.slice(off + 8, off + 8 + len).toString('utf8')); else if(t === 0x004E4942) bin = b.slice(off + 8, off + 8 + len);
    off += 8 + len; if(!len) break; }
  return { json, bin };
}
const COMP = { 5126:[4, 'readFloatLE'], 5123:[2, 'readUInt16LE'], 5121:[1, 'readUInt8'], 5122:[2, 'readInt16LE'], 5120:[1, 'readInt8'], 5125:[4, 'readUInt32LE'] };
function acc(g, i){
  const a = g.json.accessors[i], n = NC[a.type], [sz, fn] = COMP[a.componentType], out = new Array(a.count);
  if(a.bufferView === undefined){ for(let k = 0; k < a.count; k++) out[k] = new Array(n).fill(0); return out; }
  const bv = g.json.bufferViews[a.bufferView], stride = bv.byteStride || n*sz, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const norm = a.normalized ? { 5121:255, 5123:65535, 5120:127, 5122:32767 }[a.componentType] : 0;
  for(let k = 0; k < a.count; k++){ const row = new Array(n); for(let c = 0; c < n; c++){ let v = g.bin[fn](base + k*stride + c*sz); if(norm) v = Math.max(v/norm, -1); row[c] = v; } out[k] = row; }
  return out;
}
/* add a float accessor (VEC3 etc.) at the end of the binary chunk; returns its index */
function addAccessor(g, rows, type, minmax){
  const n = NC[type], buf = Buffer.alloc(rows.length*n*4);
  rows.forEach((r, k)=>{ for(let c = 0; c < n; c++) buf.writeFloatLE(r[c], (k*n + c)*4); });
  const pad = (4 - (g.bin.length % 4)) % 4; const off = g.bin.length + pad;
  g.bin = Buffer.concat([g.bin, Buffer.alloc(pad), buf]);
  g.json.bufferViews.push({ buffer:0, byteOffset:off, byteLength:buf.length });
  const a = { bufferView:g.json.bufferViews.length - 1, componentType:5126, count:rows.length, type };
  if(minmax){ a.min = new Array(n).fill(Infinity); a.max = new Array(n).fill(-Infinity); rows.forEach(r=>{ for(let c = 0; c < n; c++){ a.min[c] = Math.min(a.min[c], r[c]); a.max[c] = Math.max(a.max[c], r[c]); } }); }
  g.json.accessors.push(a);
  return g.json.accessors.length - 1;
}
function write(g, path){
  g.json.buffers[0].byteLength = g.bin.length;
  let js = Buffer.from(JSON.stringify(g.json), 'utf8'); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const bin = Buffer.concat([g.bin, Buffer.alloc((4 - g.bin.length % 4) % 4)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4E4F534A, 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(path, Buffer.concat([head, c1, js, c2, bin]));
}
module.exports = { read, acc, addAccessor, write };
