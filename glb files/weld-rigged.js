/* Weld a rigged glb by position, keeping the skin.

   weld-by-position.js does the same arithmetic but writes a bare mesh —
   fine for a statue on its way to Mixamo, fatal for a character coming
   back from it, because dropping JOINTS_0 and WEIGHTS_0 leaves a
   skeleton driving nothing.

   So this is surgical, like paint-rigged.js: the whole document survives
   and only the mesh's attribute accessors are replaced. Weights come from
   the first vertex of each merged group rather than being averaged —
   vertices that sit within a fifth of a millimetre of each other are the
   same point of the same limb, and averaging two identical things is a
   slower way of copying one. Normals ARE recomputed, because welding is
   exactly the operation that changes them. */
const fs=require('fs');
const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const CS={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};

function read(p){ const b=fs.readFileSync(p); let off=12,json=null,bin=null;
  while(off<b.length){const len=b.readUInt32LE(off),t=b.readUInt32LE(off+4);
    if(t===0x4E4F534A) json=JSON.parse(b.slice(off+8,off+8+len).toString('utf8'));
    else if(t===0x004E4942) bin=b.slice(off+8,off+8+len);
    off+=8+len; if(!len)break;} return {json,bin}; }

const IN=process.argv[2], OUT=process.argv[3], EPS=+(process.argv[4]||0.000002);
const {json:g,bin}=read(IN);
const prim=g.meshes[0].primitives[0];

function rowOf(ai){
  const a=g.accessors[ai], bv=g.bufferViews[a.bufferView];
  const n=NC[a.type], sz=CS[a.componentType], row=n*sz;
  const stride=bv.byteStride||row, base=(bv.byteOffset||0)+(a.byteOffset||0);
  return { a, row, get(v){ return bin.slice(base+v*stride, base+v*stride+row); } };
}
function floats(ai){
  const a=g.accessors[ai], bv=g.bufferViews[a.bufferView];
  const n=NC[a.type], sz=CS[a.componentType], row=n*sz;
  const stride=bv.byteStride||row, base=(bv.byteOffset||0)+(a.byteOffset||0);
  const out=new Float64Array(a.count*n);
  for(let v=0;v<a.count;v++) for(let c=0;c<n;c++){
    const at=base+v*stride+c*sz;
    out[v*n+c] = a.componentType===5126 ? bin.readFloatLE(at)
      : a.componentType===5125 ? bin.readUInt32LE(at)
      : a.componentType===5123 ? bin.readUInt16LE(at) : bin.readUInt8(at); }
  return out;
}

const P=floats(prim.attributes.POSITION);
const nv=P.length/3;
const I = prim.indices!==undefined ? floats(prim.indices)
        : Float64Array.from({length:nv},(_,i)=>i);   // unindexed: every three in a row

/* group coincident vertices */
const map=new Map(), rep=[], remap=new Uint32Array(nv);
const q=v=>Math.round(v/EPS);
for(let i=0;i<nv;i++){
  const k=q(P[i*3])+','+q(P[i*3+1])+','+q(P[i*3+2]);
  let at=map.get(k);
  if(at===undefined){ at=rep.length; map.set(k,at); rep.push(i); }
  remap[i]=at;
}
const outV=rep.length;

/* faces, minus the ones the weld collapsed */
const NI=[];
let degenerate=0;
for(let f=0;f<I.length;f+=3){
  const a=remap[I[f]], b=remap[I[f+1]], c=remap[I[f+2]];
  if(a===b||b===c||a===c){ degenerate++; continue; }
  NI.push(a,b,c);
}

/* normals, area-weighted, from the welded faces */
const NX=new Float64Array(outV), NY=new Float64Array(outV), NZ=new Float64Array(outV);
for(let f=0;f<NI.length;f+=3){
  const a=NI[f],b=NI[f+1],c=NI[f+2];
  const ax=P[rep[a]*3],ay=P[rep[a]*3+1],az=P[rep[a]*3+2];
  const ux=P[rep[b]*3]-ax, uy=P[rep[b]*3+1]-ay, uz=P[rep[b]*3+2]-az;
  const vx=P[rep[c]*3]-ax, vy=P[rep[c]*3+1]-ay, vz=P[rep[c]*3+2]-az;
  const cx=uy*vz-uz*vy, cy=uz*vx-ux*vz, cz=ux*vy-uy*vx;
  for(const t of [a,b,c]){ NX[t]+=cx; NY[t]+=cy; NZ[t]+=cz; }
}

const chunks=[bin]; let cur=bin.length;
const pad=n=>(4-(n%4))%4;
const put=b=>{ const p=pad(cur); if(p){chunks.push(Buffer.alloc(p)); cur+=p;}
               const at=cur; chunks.push(b); cur+=b.length; return at; };
function addView(buf,target){ const off=put(buf);
  g.bufferViews.push({buffer:0, byteOffset:off, byteLength:buf.length, ...(target?{target}:{})});
  return g.bufferViews.length-1; }

for(const name of Object.keys(prim.attributes)){
  if(name==='NORMAL') continue;                    // rebuilt below
  const r=rowOf(prim.attributes[name]);
  const buf=Buffer.alloc(outV*r.row);
  for(let i=0;i<outV;i++) r.get(rep[i]).copy(buf, i*r.row);
  const desc={ bufferView:addView(buf,34962), byteOffset:0,
               componentType:r.a.componentType, count:outV, type:r.a.type };
  if(r.a.normalized) desc.normalized=true;
  if(name==='POSITION'){
    const mn=[Infinity,Infinity,Infinity], mx=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<outV;i++) for(let k=0;k<3;k++){
      const v=P[rep[i]*3+k]; if(v<mn[k])mn[k]=v; if(v>mx[k])mx[k]=v; }
    desc.min=mn; desc.max=mx;
  }
  g.accessors.push(desc);
  prim.attributes[name]=g.accessors.length-1;
}
const nbuf=Buffer.alloc(outV*12);
for(let i=0;i<outV;i++){
  const l=Math.hypot(NX[i],NY[i],NZ[i])||1;
  nbuf.writeFloatLE(NX[i]/l, i*12); nbuf.writeFloatLE(NY[i]/l, i*12+4);
  nbuf.writeFloatLE(NZ[i]/l, i*12+8);
}
g.accessors.push({bufferView:addView(nbuf,34962), byteOffset:0,
                  componentType:5126, count:outV, type:'VEC3'});
prim.attributes.NORMAL=g.accessors.length-1;

const ibuf=Buffer.alloc(NI.length*4);
for(let i=0;i<NI.length;i++) ibuf.writeUInt32LE(NI[i], i*4);
g.accessors.push({bufferView:addView(ibuf,34963), byteOffset:0,
                  componentType:5125, count:NI.length, type:'SCALAR'});
prim.indices=g.accessors.length-1;

const BIN=Buffer.concat(chunks);
g.buffers=[{byteLength:BIN.length}];
let js=Buffer.from(JSON.stringify(g),'utf8');
if(js.length%4) js=Buffer.concat([js,Buffer.alloc(4-(js.length%4),0x20)]);
const head=Buffer.alloc(12); head.write('glTF',0);
head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+js.length+8+BIN.length,8);
const jh=Buffer.alloc(8); jh.writeUInt32LE(js.length,0); jh.writeUInt32LE(0x4E4F534A,4);
const bh=Buffer.alloc(8); bh.writeUInt32LE(BIN.length,0); bh.writeUInt32LE(0x004E4942,4);
fs.writeFileSync(OUT, Buffer.concat([head,jh,js,bh,BIN]));
console.log('welded  verts '+nv.toLocaleString()+' -> '+outV.toLocaleString(),
  ' tris '+(I.length/3).toLocaleString()+' -> '+(NI.length/3).toLocaleString(),
  degenerate?('  ('+degenerate+' collapsed)'):'',
  ' ', (fs.statSync(IN).size/1048576).toFixed(1)+' MB -> '+(fs.statSync(OUT).size/1048576).toFixed(1)+' MB');
