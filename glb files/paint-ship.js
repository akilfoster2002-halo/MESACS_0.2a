/* Vertex colours for the ship. Same idea as the character painter — decide
   per TRIANGLE from its centroid so the edges stay hard, split vertices
   only where two parts meet, and shade creases from the geometry so a flat
   colour still reads as a surface.

   The regions are named off the reference art rather than off any data in
   the file: it arrives as one object with no materials and no UVs, so
   "this is the canopy" is a statement about where a triangle sits, not
   something the model knows about itself.

   NOSE IS +Z here, tail is -Z. The game's ships fly nose-first down -Z, so
   the model is turned half a circle when it is loaded, not here — the file
   stays as its author left it. */
const fs=require('fs');
const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const CS={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
function read(p){ const b=fs.readFileSync(p); let off=12,json=null,bin=null;
  while(off<b.length){const len=b.readUInt32LE(off),t=b.readUInt32LE(off+4);
    if(t===0x4E4F534A) json=JSON.parse(b.slice(off+8,off+8+len).toString('utf8'));
    else if(t===0x004E4942) bin=b.slice(off+8,off+8+len);
    off+=8+len; if(!len)break;} return {json,bin}; }

const IN=process.argv[2], OUT=process.argv[3];
const O=JSON.parse(process.argv[4]||'{}');
const B={ engine:0.14, canopyZ0:0.40, canopyZ1:0.90, canopyY:0.015, canopyX:0.20,
          glow:0.05, ...O };
const C={ hull:'#d9a52c', canopy:'#1e2a5e', glass:'#4a7fd4',
          engine:'#24242a', glow:'#3fd0f0', ...(O.C||{}) };
const SHADE={ hull:{dark:0.42,lift:0.26}, canopy:{dark:0.30,lift:0.40},
              glass:{dark:0.20,lift:0.50}, engine:{dark:0.55,lift:0.30},
              glow:{dark:0,lift:0}, ...(O.SHADE||{}) };
const rgb=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];

const {json:g,bin}=read(IN);
const prim=g.meshes[0].primitives[0];
function rowOf(ai){ const a=g.accessors[ai], bv=g.bufferViews[a.bufferView];
  const n=NC[a.type], sz=CS[a.componentType], row=n*sz;
  const stride=bv.byteStride||row, base=(bv.byteOffset||0)+(a.byteOffset||0);
  return { a, row, get(v){ return bin.slice(base+v*stride, base+v*stride+row); } }; }
function floats(ai){ const a=g.accessors[ai], bv=g.bufferViews[a.bufferView];
  const n=NC[a.type], sz=CS[a.componentType], row=n*sz;
  const stride=bv.byteStride||row, base=(bv.byteOffset||0)+(a.byteOffset||0);
  const out=new Float64Array(a.count*n);
  for(let v=0;v<a.count;v++) for(let c=0;c<n;c++){ const at=base+v*stride+c*sz;
    out[v*n+c] = a.componentType===5126 ? bin.readFloatLE(at)
      : a.componentType===5125 ? bin.readUInt32LE(at)
      : a.componentType===5123 ? bin.readUInt16LE(at) : bin.readUInt8(at); }
  return out; }

const P=floats(prim.attributes.POSITION), NRM=floats(prim.attributes.NORMAL);
const I=floats(prim.indices);
const nv=P.length/3;
let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
for(let i=0;i<nv;i++) for(let k=0;k<3;k++){const v=P[i*3+k]; if(v<mn[k])mn[k]=v; if(v>mx[k])mx[k]=v;}
const span=[mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]];

/* creases, from the mesh itself — see paint-rigged.js */
const cav=new Float32Array(nv);
{
  const sx=new Float64Array(nv), sy=new Float64Array(nv), sz=new Float64Array(nv);
  const cnt=new Uint32Array(nv), el=new Float64Array(nv);
  const edge=(a,b)=>{ sx[a]+=P[b*3]; sy[a]+=P[b*3+1]; sz[a]+=P[b*3+2]; cnt[a]++;
    el[a]+=Math.hypot(P[b*3]-P[a*3],P[b*3+1]-P[a*3+1],P[b*3+2]-P[a*3+2]); };
  for(let f=0;f<I.length;f+=3){ const a=I[f],b=I[f+1],c=I[f+2];
    edge(a,b);edge(b,a);edge(b,c);edge(c,b);edge(c,a);edge(a,c); }
  for(let v=0;v<nv;v++){ if(!cnt[v]) continue;
    const dx=sx[v]/cnt[v]-P[v*3], dy=sy[v]/cnt[v]-P[v*3+1], dz=sz[v]/cnt[v]-P[v*3+2];
    const d=dx*NRM[v*3]+dy*NRM[v*3+1]+dz*NRM[v*3+2];
    const L=el[v]/cnt[v]||1;
    cav[v]=Math.max(-1,Math.min(1,(d/L)*2.6)); }
}

function classify(x,y,z){
  const zN=(z-mn[2])/span[2];              // 0 = tail, 1 = nose
  const yN=(y-mn[1])/span[1];
  const ax=Math.abs(x)/(span[0]/2);
  if(zN < B.glow)   return 'glow';          // the very back of the engines
  if(zN < B.engine) return 'engine';        // intakes and nozzles
  /* THE CANOPY is the long bubble along the top of the forward half. It is
     found as "high up, near the centre line, forward of the wings" — three
     conditions, because any one of them alone also describes the spine. */
  if(zN > B.canopyZ0 && zN < B.canopyZ1 && y > B.canopyY && ax < B.canopyX)
    return (yN > 0.62) ? 'glass' : 'canopy';
  return 'hull';
}

const key=new Map(), src=[], col=[], NI=[], tally={};
for(let f=0;f<I.length;f+=3){
  const t=[I[f],I[f+1],I[f+2]];
  const cx=(P[t[0]*3]+P[t[1]*3]+P[t[2]*3])/3;
  const cy=(P[t[0]*3+1]+P[t[1]*3+1]+P[t[2]*3+1])/3;
  const cz=(P[t[0]*3+2]+P[t[1]*3+2]+P[t[2]*3+2])/3;
  const part=classify(cx,cy,cz); tally[part]=(tally[part]||0)+1;
  const base=rgb(C[part]), sh=SHADE[part];
  for(const v of t){
    const k=v+'|'+part;
    let at=key.get(k);
    if(at===undefined){
      at=src.length; key.set(k,at); src.push(v);
      const q=cav[v];
      const m = q>0 ? 1 - sh.dark*q : 1 + sh.lift*(-q);
      col.push(base.map(ch=>Math.max(0.03, Math.min(1, ch*m))));
    }
    NI.push(at);
  }
}
const outV=src.length;

const chunks=[bin]; let cur=bin.length;
const pad=n=>(4-(n%4))%4;
const put=b=>{ const p=pad(cur); if(p){chunks.push(Buffer.alloc(p)); cur+=p;}
               const at=cur; chunks.push(b); cur+=b.length; return at; };
const addView=(buf,target)=>{ const off=put(buf);
  g.bufferViews.push({buffer:0,byteOffset:off,byteLength:buf.length,...(target?{target}:{})});
  return g.bufferViews.length-1; };

for(const name of Object.keys(prim.attributes)){
  const r=rowOf(prim.attributes[name]);
  const buf=Buffer.alloc(outV*r.row);
  for(let i=0;i<outV;i++) r.get(src[i]).copy(buf, i*r.row);
  const desc={ bufferView:addView(buf,34962), byteOffset:0,
               componentType:r.a.componentType, count:outV, type:r.a.type };
  if(r.a.normalized) desc.normalized=true;
  if(name==='POSITION'){
    const a=[Infinity,Infinity,Infinity], b=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<outV;i++) for(let k=0;k<3;k++){
      const v=P[src[i]*3+k]; if(v<a[k])a[k]=v; if(v>b[k])b[k]=v; }
    desc.min=a; desc.max=b;
  }
  g.accessors.push(desc); prim.attributes[name]=g.accessors.length-1;
}
const cbuf=Buffer.alloc(outV*12);
for(let i=0;i<outV;i++){ cbuf.writeFloatLE(col[i][0],i*12);
  cbuf.writeFloatLE(col[i][1],i*12+4); cbuf.writeFloatLE(col[i][2],i*12+8); }
g.accessors.push({bufferView:addView(cbuf,34962),byteOffset:0,componentType:5126,count:outV,type:'VEC3'});
prim.attributes.COLOR_0=g.accessors.length-1;
const ibuf=Buffer.alloc(NI.length*4);
for(let i=0;i<NI.length;i++) ibuf.writeUInt32LE(NI[i],i*4);
g.accessors.push({bufferView:addView(ibuf,34963),byteOffset:0,componentType:5125,count:NI.length,type:'SCALAR'});
prim.indices=g.accessors.length-1;
const mat=g.materials[prim.material!==undefined?prim.material:0];
mat.pbrMetallicRoughness=Object.assign({},mat.pbrMetallicRoughness,
  {baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:0.75});

const BIN=Buffer.concat(chunks);
g.buffers=[{byteLength:BIN.length}];
let js=Buffer.from(JSON.stringify(g),'utf8');
if(js.length%4) js=Buffer.concat([js,Buffer.alloc(4-(js.length%4),0x20)]);
const head=Buffer.alloc(12); head.write('glTF',0);
head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+js.length+8+BIN.length,8);
const jh=Buffer.alloc(8); jh.writeUInt32LE(js.length,0); jh.writeUInt32LE(0x4E4F534A,4);
const bh=Buffer.alloc(8); bh.writeUInt32LE(BIN.length,0); bh.writeUInt32LE(0x004E4942,4);
fs.writeFileSync(OUT,Buffer.concat([head,jh,js,bh,BIN]));
console.log(OUT.split('/').pop(),(fs.statSync(OUT).size/1024).toFixed(0)+' KB',
  ' verts '+nv+'->'+outV,' faces:',Object.entries(tally).map(([k,v])=>k+':'+v).join(' '));
