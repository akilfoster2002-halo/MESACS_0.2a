/* Weld a non-indexed GLB by position. gltf-transform's weld only merges
   bitwise-identical vertices, and this mesh shares almost none — so the
   simplifier saw 312k disconnected triangles and could collapse nothing.
   Merging by a small distance tolerance rebuilds the topology, after which
   meshoptimizer has edges to work with. Normals are recomputed from the
   welded faces rather than averaged from the originals. */
const fs=require('fs');
const IN=process.argv[2], OUT=process.argv[3], EPS=+(process.argv[4]||0.0002);

const b=fs.readFileSync(IN);
let off=12,g=null,bin=null;
while(off<b.length){const len=b.readUInt32LE(off),t=b.readUInt32LE(off+4);
  if(t===0x4E4F534A) g=JSON.parse(b.slice(off+8,off+8+len).toString('utf8'));
  else if(t===0x004E4942) bin=b.slice(off+8,off+8+len);
  off+=8+len; if(!len)break;}

const prim=g.meshes[0].primitives[0];
const acc=g.accessors[prim.attributes.POSITION], bv=g.bufferViews[acc.bufferView];
const start=(bv.byteOffset||0)+(acc.byteOffset||0);
const pos=new Float32Array(bin.buffer, bin.byteOffset+start, acc.count*3);

const map=new Map(), px=[], py=[], pz=[], idx=new Uint32Array(acc.count);
const q=v=>Math.round(v/EPS);
for(let i=0;i<acc.count;i++){
  const x=pos[i*3], y=pos[i*3+1], z=pos[i*3+2];
  const key=q(x)+','+q(y)+','+q(z);
  let at=map.get(key);
  if(at===undefined){ at=px.length; map.set(key,at); px.push(x); py.push(y); pz.push(z); }
  idx[i]=at;
}
const nv=px.length;

/* area-weighted face normals, accumulated per vertex */
const nx=new Float32Array(nv), ny=new Float32Array(nv), nz=new Float32Array(nv);
let degenerate=0;
for(let f=0;f<idx.length;f+=3){
  const a=idx[f], c=idx[f+1], d=idx[f+2];
  if(a===c||c===d||a===d){ degenerate++; continue; }
  const ux=px[c]-px[a], uy=py[c]-py[a], uz=pz[c]-pz[a];
  const vx=px[d]-px[a], vy=py[d]-py[a], vz=pz[d]-pz[a];
  const cx=uy*vz-uz*vy, cy=uz*vx-ux*vz, cz=ux*vy-uy*vx;
  for(const t of [a,c,d]){ nx[t]+=cx; ny[t]+=cy; nz[t]+=cz; }
}
for(let i=0;i<nv;i++){
  const l=Math.hypot(nx[i],ny[i],nz[i])||1;
  nx[i]/=l; ny[i]/=l; nz[i]/=l;
}
/* drop degenerate triangles the weld created */
const keep=[];
for(let f=0;f<idx.length;f+=3){
  const a=idx[f],c=idx[f+1],d=idx[f+2];
  if(a!==c&&c!==d&&a!==d) keep.push(a,c,d);
}
const tri=keep.length/3;

/* pack: POSITION, NORMAL, indices */
const P=Buffer.alloc(nv*12), N=Buffer.alloc(nv*12), I=Buffer.alloc(keep.length*4);
const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
for(let i=0;i<nv;i++){
  P.writeFloatLE(px[i],i*12); P.writeFloatLE(py[i],i*12+4); P.writeFloatLE(pz[i],i*12+8);
  N.writeFloatLE(nx[i],i*12); N.writeFloatLE(ny[i],i*12+4); N.writeFloatLE(nz[i],i*12+8);
  const v=[px[i],py[i],pz[i]];
  for(let k=0;k<3;k++){ if(v[k]<min[k])min[k]=v[k]; if(v[k]>max[k])max[k]=v[k]; }
}
for(let i=0;i<keep.length;i++) I.writeUInt32LE(keep[i], i*4);
const pad=n=>(4-(n%4))%4;
const parts=[P,N,I], offs=[]; let cur=0;
for(const p of parts){ offs.push(cur); cur+=p.length+pad(p.length); }
const BIN=Buffer.alloc(cur);
parts.forEach((p,i)=>p.copy(BIN, offs[i]));

const json={ asset:{version:'2.0', generator:'weld-by-position'},
  scene:0, scenes:[{nodes:[0]}], nodes:[{mesh:0, name:'holder'}],
  materials:g.materials||[{pbrMetallicRoughness:{metallicFactor:0,roughnessFactor:1}}],
  meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1}, indices:2, material:0, mode:4}]}],
  accessors:[
    {bufferView:0, componentType:5126, count:nv, type:'VEC3', min, max},
    {bufferView:1, componentType:5126, count:nv, type:'VEC3'},
    {bufferView:2, componentType:5125, count:keep.length, type:'SCALAR'}],
  bufferViews:[
    {buffer:0, byteOffset:offs[0], byteLength:P.length, target:34962},
    {buffer:0, byteOffset:offs[1], byteLength:N.length, target:34962},
    {buffer:0, byteOffset:offs[2], byteLength:I.length, target:34963}],
  buffers:[{byteLength:BIN.length}] };

let js=Buffer.from(JSON.stringify(json),'utf8');
if(js.length%4) js=Buffer.concat([js, Buffer.alloc(4-(js.length%4), 0x20)]);
const head=Buffer.alloc(12); head.write('glTF',0);
head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+js.length+8+BIN.length,8);
const jh=Buffer.alloc(8); jh.writeUInt32LE(js.length,0); jh.writeUInt32LE(0x4E4F534A,4);
const bh=Buffer.alloc(8); bh.writeUInt32LE(BIN.length,0); bh.writeUInt32LE(0x004E4942,4);
fs.writeFileSync(OUT, Buffer.concat([head,jh,js,bh,BIN]));

console.log('tolerance      ', EPS);
console.log('vertices  ', (935772).toLocaleString(), '->', nv.toLocaleString(),
            '('+(100-nv/9357.72).toFixed(1)+'% merged)');
console.log('triangles ', (311924).toLocaleString(), '->', tri.toLocaleString(),
            degenerate?('  ('+degenerate+' degenerate dropped)'):'');
console.log('size      ', (fs.statSync(IN).size/1048576).toFixed(2), 'MB ->',
            (fs.statSync(OUT).size/1048576).toFixed(2), 'MB');
