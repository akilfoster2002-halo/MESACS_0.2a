/* Vertex colours onto an ALREADY RIGGED glb.

   The earlier painter wrote a fresh file with only position, normal and
   colour in it, which is fine for a statue and fatal for a character: it
   would drop JOINTS_0 and WEIGHTS_0 and the skeleton would drive nothing.
   This one is surgical. It keeps the whole document — nodes, skin,
   inverse bind matrices, every animation — and replaces only the mesh's
   attribute accessors.

   Splitting a vertex at a colour seam means splitting everything it
   carries, weights included, so attributes are copied BY ROW in their
   original component types rather than re-encoded. A joint index that
   went through a float would come back wrong. */
const fs=require('fs');
const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const CS={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};

function read(p){ const b=fs.readFileSync(p); let off=12,json=null,bin=null;
  while(off<b.length){const len=b.readUInt32LE(off),t=b.readUInt32LE(off+4);
    if(t===0x4E4F534A) json=JSON.parse(b.slice(off+8,off+8+len).toString('utf8'));
    else if(t===0x004E4942) bin=b.slice(off+8,off+8+len);
    off+=8+len; if(!len)break;} return {json,bin}; }

const IN=process.argv[2], OUT=process.argv[3];
const O=JSON.parse(process.argv[4]||'{}');
const B={ shoe:0.095, jeans:0.500, torso:0.800, neck:0.832, hair:0.900,
          sleeve:0.500, faceZ:0, faceX:0.16, neckX:0.105, ...O };
const C={ skin:'#b07a52', hair:'#241a16', jersey:'#202b4d',
          jeans:'#3b3e44', shoe:'#efefef', ...(O.C||{}) };
const rgb=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];

const {json:g,bin}=read(IN);
const prim=g.meshes[0].primitives[0];

/* one row of an accessor, as raw bytes, whatever its layout */
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
const I=floats(prim.indices);
const nv=P.length/3;
let ymin=Infinity,ymax=-Infinity,xmax=0;
for(let i=0;i<nv;i++){const y=P[i*3+1]; if(y<ymin)ymin=y; if(y>ymax)ymax=y;
  const ax=Math.abs(P[i*3]); if(ax>xmax)xmax=ax;}

function classify(x,y,z){
  const yN=(y-ymin)/(ymax-ymin), ax=Math.abs(x)/xmax;
  if(yN<B.shoe)  return 'shoe';
  if(yN<B.jeans) return 'jeans';
  if(yN<B.torso) return ax>B.sleeve ? 'skin' : 'jersey';
  /* The neck is a COLUMN, not a slice. As a plain height band it also
     caught the tops of both shoulders, which came out bare in any pose
     that lifted an arm — a jersey with two holes cut in it. */
  if(yN<B.neck)  return ax < B.neckX ? 'skin' : 'jersey';
  if(yN<B.hair)  return (z>B.faceZ && ax<B.faceX) ? 'skin' : 'hair';
  return 'hair';
}

/* which source vertex each new vertex came from, and its colour */
const key=new Map(), src=[], col=[], NI=[], tally={};
for(let f=0;f<I.length;f+=3){
  const t=[I[f],I[f+1],I[f+2]];
  const cx=(P[t[0]*3]+P[t[1]*3]+P[t[2]*3])/3;
  const cy=(P[t[0]*3+1]+P[t[1]*3+1]+P[t[2]*3+1])/3;
  const cz=(P[t[0]*3+2]+P[t[1]*3+2]+P[t[2]*3+2])/3;
  const part=classify(cx,cy,cz); tally[part]=(tally[part]||0)+1;
  const c=rgb(C[part]);
  for(const v of t){
    const k=v+'|'+part;
    let at=key.get(k);
    if(at===undefined){ at=src.length; key.set(k,at); src.push(v); col.push(c); }
    NI.push(at);
  }
}
const outV=src.length;

const chunks=[bin]; let cur=bin.length;
const pad=n=>(4-(n%4))%4;
const put=b=>{ const p=pad(cur); if(p){chunks.push(Buffer.alloc(p)); cur+=p;}
               const at=cur; chunks.push(b); cur+=b.length; return at; };
function addView(buf,target){ const off=put(buf);
  g.bufferViews.push({buffer:0, byteOffset:off, byteLength:buf.length, ...(target?{target}:{})});
  return g.bufferViews.length-1; }

/* every existing attribute, re-indexed by row */
for(const name of Object.keys(prim.attributes)){
  const r=rowOf(prim.attributes[name]);
  const buf=Buffer.alloc(outV*r.row);
  for(let i=0;i<outV;i++) r.get(src[i]).copy(buf, i*r.row);
  const bvi=addView(buf, 34962);
  const desc={ bufferView:bvi, byteOffset:0, componentType:r.a.componentType,
               count:outV, type:r.a.type };
  if(r.a.normalized) desc.normalized=true;
  if(name==='POSITION'){
    const mn=[Infinity,Infinity,Infinity], mx=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<outV;i++) for(let k=0;k<3;k++){
      const v=P[src[i]*3+k]; if(v<mn[k])mn[k]=v; if(v>mx[k])mx[k]=v; }
    desc.min=mn; desc.max=mx;
  }
  g.accessors.push(desc);
  prim.attributes[name]=g.accessors.length-1;
}
/* the colours themselves */
const cbuf=Buffer.alloc(outV*12);
for(let i=0;i<outV;i++){ cbuf.writeFloatLE(col[i][0],i*12);
  cbuf.writeFloatLE(col[i][1],i*12+4); cbuf.writeFloatLE(col[i][2],i*12+8); }
g.accessors.push({bufferView:addView(cbuf,34962), byteOffset:0,
                  componentType:5126, count:outV, type:'VEC3'});
prim.attributes.COLOR_0=g.accessors.length-1;
/* and the new index buffer */
const ibuf=Buffer.alloc(NI.length*4);
for(let i=0;i<NI.length;i++) ibuf.writeUInt32LE(NI[i], i*4);
g.accessors.push({bufferView:addView(ibuf,34963), byteOffset:0,
                  componentType:5125, count:NI.length, type:'SCALAR'});
prim.indices=g.accessors.length-1;

/* white base colour: glTF MULTIPLIES it by COLOR_0 */
const mat=g.materials[prim.material!==undefined?prim.material:0];
mat.pbrMetallicRoughness=Object.assign({}, mat.pbrMetallicRoughness,
  {baseColorFactor:[1,1,1,1], metallicFactor:0, roughnessFactor:0.9});

const BIN=Buffer.concat(chunks);
g.buffers=[{byteLength:BIN.length}];
let js=Buffer.from(JSON.stringify(g),'utf8');
if(js.length%4) js=Buffer.concat([js,Buffer.alloc(4-(js.length%4),0x20)]);
const head=Buffer.alloc(12); head.write('glTF',0);
head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+js.length+8+BIN.length,8);
const jh=Buffer.alloc(8); jh.writeUInt32LE(js.length,0); jh.writeUInt32LE(0x4E4F534A,4);
const bh=Buffer.alloc(8); bh.writeUInt32LE(BIN.length,0); bh.writeUInt32LE(0x004E4942,4);
fs.writeFileSync(OUT, Buffer.concat([head,jh,js,bh,BIN]));
console.log(OUT.split('/').pop(), (fs.statSync(OUT).size/1024).toFixed(0)+' KB',
  ' verts '+nv+'->'+outV, ' attrs:', Object.keys(prim.attributes).join(','),
  ' faces:', Object.entries(tally).map(([k,v])=>k+':'+v).join(' '));
