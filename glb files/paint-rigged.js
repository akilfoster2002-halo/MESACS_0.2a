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
          sleeve:0.500, faceZ:0, faceX:0.16, neckX:0.105,
          /* LONG HAIR IS NOT A HAT. Short hair is whatever sits above the
             face, and a height band finds it. Hair down to the waist is in
             the same slice of the body as the shirt, and the only thing
             that separates them is that it hangs BEHIND: set hairBackZ and
             anything further back than that, down to hairBackLow, is hair
             rather than clothing. Off unless a character needs it.

             It cannot catch the strands that fall down the front — those
             are in among the shirt and no rule of this kind will find
             them. They come out shirt-coloured and, at the size a
             character is on screen, nobody has noticed. */
          hairBackZ:null, hairBackLow:0.50, ...O };
const C={ skin:'#b07a52', hair:'#241a16', jersey:'#1e1e22',
          jeans:'#26252b', shoe:'#efefef', ...(O.C||{}) };
/* HOW HARD EACH PART TAKES THE CREASE SHADING, and how much its ridges
   catch the light back. Denim is the whole reason this exists: black
   trousers with one flat colour are a silhouette, and the sculpt already
   has the folds in it — darkening the creases and lifting the worn
   ridges is what turns that geometry back into fabric. Skin barely takes
   any, or it reads as dirt. */
const SHADE={ jeans:{dark:0.60, lift:0.34}, jersey:{dark:0.48, lift:0.20},
              hair:{dark:0.45, lift:0.12}, shoe:{dark:0.34, lift:0.22},
              skin:{dark:0.22, lift:0.05}, ...(O.SHADE||{}) };
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

/* ------------------------------------------------------------ cavity
   A crease term per vertex, worked out from the mesh alone: take the
   average of everything a vertex is joined to, and ask which side of the
   surface it sits on. Neighbours ahead of the normal means the vertex is
   down in a fold; behind it means it is riding a ridge. Divided by the
   local edge length so it means the same thing on a shoelace and on a
   trouser leg.

   This is not lighting — it is baked into the colour and stays put when
   the character turns round, which is what makes a fold look like a fold
   from every angle instead of only from the key light. */
const NRM=floats(prim.attributes.NORMAL);
const cav=new Float32Array(nv);
{
  const sumx=new Float64Array(nv), sumy=new Float64Array(nv), sumz=new Float64Array(nv);
  const cnt=new Uint32Array(nv), elen=new Float64Array(nv);
  const edge=(a,b)=>{
    sumx[a]+=P[b*3]; sumy[a]+=P[b*3+1]; sumz[a]+=P[b*3+2]; cnt[a]++;
    elen[a]+=Math.hypot(P[b*3]-P[a*3], P[b*3+1]-P[a*3+1], P[b*3+2]-P[a*3+2]);
  };
  for(let f=0;f<I.length;f+=3){
    const a=I[f], b=I[f+1], c=I[f+2];
    edge(a,b); edge(b,a); edge(b,c); edge(c,b); edge(c,a); edge(a,c);
  }
  for(let v=0;v<nv;v++){
    if(!cnt[v]) continue;
    const dx=sumx[v]/cnt[v]-P[v*3], dy=sumy[v]/cnt[v]-P[v*3+1], dz=sumz[v]/cnt[v]-P[v*3+2];
    const d=dx*NRM[v*3]+dy*NRM[v*3+1]+dz*NRM[v*3+2];
    const L=elen[v]/cnt[v] || 1;
    cav[v]=Math.max(-1, Math.min(1, (d/L)*2.6));   // + is a fold, − is a ridge
  }
}

/* which source vertex each new vertex came from, and its colour */
const key=new Map(), src=[], col=[], NI=[], tally={};
for(let f=0;f<I.length;f+=3){
  const t=[I[f],I[f+1],I[f+2]];
  const cx=(P[t[0]*3]+P[t[1]*3]+P[t[2]*3])/3;
  const cy=(P[t[0]*3+1]+P[t[1]*3+1]+P[t[2]*3+1])/3;
  const cz=(P[t[0]*3+2]+P[t[1]*3+2]+P[t[2]*3+2])/3;
  const part=classify(cx,cy,cz); tally[part]=(tally[part]||0)+1;
  const base=rgb(C[part]), sh=SHADE[part]||{dark:0.4,lift:0.15};
  for(const v of t){
    const k=v+'|'+part;
    let at=key.get(k);
    if(at===undefined){
      at=src.length; key.set(k,at); src.push(v);
      const q=cav[v];
      /* a fold darkens, a ridge lifts, and nothing is allowed all the way
         to black — a black trouser leg with black creases is a hole */
      const m = q>0 ? 1 - sh.dark*q : 1 + sh.lift*(-q);
      col.push(base.map(ch=>Math.max(0.035, Math.min(1, ch*m))));
    }
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
