/* Vertex colours onto a rigged glb, decided by the SKELETON.

   paint-rigged.js paints in height bands, and for a character in one
   solid outfit that is the right amount of machinery: a number for where
   the shoes stop and another for where the hair starts. It cannot paint
   this one. A T-posed arm and the chest beside it are the same slice of
   the same body, so "sleeve or bare arm" is not a question a height has
   an answer to — the old file guesses with |x| and a bare shoulder is
   what you get when the guess is off by a centimetre.

   The rig already knows. Every vertex is weighted to the bones that move
   it, so the vertex that is on the upper arm says so, and no threshold
   has to be invented for it. Height still decides the things height
   genuinely decides — where a hem falls across a torso — and it is far
   more reliable once it is only ever asked about one limb at a time.

   Everything else it does is paint-rigged.js's: the same cavity term
   baked into the colour so a fold reads as a fold from every angle, the
   same surgical rewrite that keeps the skin, the skeleton and the
   animations and replaces only the mesh's attributes, and the same split
   of a vertex that lands on a colour seam — copied BY ROW in its
   original component type, because a joint index that goes through a
   float comes back wrong.
   ===================================================================== */
const fs=require('fs');
const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const CS={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};

function read(p){ const b=fs.readFileSync(p); let off=12,json=null,bin=null;
  while(off<b.length){const len=b.readUInt32LE(off),t=b.readUInt32LE(off+4);
    if(t===0x4E4F534A) json=JSON.parse(b.slice(off+8,off+8+len).toString('utf8'));
    else if(t===0x004E4942) bin=b.slice(off+8,off+8+len);
    off+=8+len; if(!len)break;} return {json,bin}; }

/* Which limb a bone belongs to. Mixamo names every rig the same way, so
   this is a lookup and not a heuristic; anything unrecognised falls back
   to 'torso', which is the safest thing to be wrong about. */
function limbOf(name){
  const n=String(name).replace(/^mixamorig:?/,'');
  if(/Toe|Foot/.test(n))        return 'foot';
  if(/UpLeg|Leg/.test(n))       return 'leg';
  if(/Hips/.test(n))            return 'hips';
  if(/Spine/.test(n))           return 'torso';
  if(/Shoulder/.test(n))        return 'shoulder';
  if(/ForeArm/.test(n))         return 'forearm';
  if(/Arm/.test(n))             return 'arm';
  if(/Hand|Thumb|Index|Middle|Ring|Pinky/.test(n)) return 'hand';
  if(/Neck/.test(n))            return 'neck';
  if(/Head/.test(n))            return 'head';
  return 'torso';
}

function paint(IN, OUT, SPEC){
  const B={ shoeTop:0.078, waistTop:0.600, shirtHem:0.638, collarTop:0.800,
            sleeveEnd:0.280, faceY:0.878, faceR:[0.105,0.056], faceZ:0.020,
            throat:[0.845,0.050], hairBack:null,
            /* TWO THINGS A SECOND CHARACTER NEEDED AND THE FIRST DID NOT,
               both null by default so nobody already painted changes.

               shortsHem — below it the leg is BARE. The leg bones were
               unconditionally trousers, which is right for somebody in
               jeans and paints a bare calf denim blue.

               hatLine — above it the head is a HAT rather than hair. It
               sits above the hairline for the same reason the hairline
               sits above the face: each one is a lid on the last. */
            shortsHem:null, hatLine:null,
            /* A SOCK IS A BAND BETWEEN THE SHOE AND THE LEG, and a striped
               one is that band asking which stripe it is in. Height is all
               it takes: [top, stripe] where stripe is how tall one band of
               colour is, or 0 for a plain sock. At the size a character is
               on screen a three-pixel stripe still reads as pattern, which
               a flat colour does not.

               A SOLE IS THE SAME IDEA AT THE OTHER END. Nearly every shoe
               is two colours with a line across it, and painting a red
               high-top entirely red loses the one part of it that says
               shoe rather than foot. */
            sock:null, sole:null,
            watch:null, panel:null, emblem:null, ...(SPEC.B||{}) };
  const C={ skin:'#dda070', hair:'#1b100e', jersey:'#9c1521', panel:'#242b4a',
            emblem:'#141013', jeans:'#28313a', shoe:'#ded5cd', watch:'#b9bcc0',
            hat:'#e2d8c4', sock:'#a5222c', sock2:'#17171a', sole:'#efeae2',
            ...(SPEC.C||{}) };
  const SHADE={ jeans:{dark:0.62,lift:0.40}, jersey:{dark:0.50,lift:0.22},
                hat:{dark:0.42,lift:0.24}, sock:{dark:0.40,lift:0.22},
                sock2:{dark:0.34,lift:0.20}, sole:{dark:0.30,lift:0.22},
                panel:{dark:0.50,lift:0.22}, emblem:{dark:0.30,lift:0.14},
                hair:{dark:0.50,lift:0.16}, shoe:{dark:0.36,lift:0.24},
                watch:{dark:0.30,lift:0.30}, skin:{dark:0.24,lift:0.06},
                ...(SPEC.SHADE||{}) };
  const rgb=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];

  const {json:g,bin}=read(IN);
  const prim=g.meshes[0].primitives[0];
  function rowOf(ai){
    const a=g.accessors[ai], bv=g.bufferViews[a.bufferView];
    const n=NC[a.type], sz=CS[a.componentType], row=n*sz;
    const stride=bv.byteStride||row, base=(bv.byteOffset||0)+(a.byteOffset||0);
    return { a, row, get(v){ return bin.slice(base+v*stride, base+v*stride+row); } };
  }
  function nums(ai){
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

  const P=nums(prim.attributes.POSITION);
  const NRM=nums(prim.attributes.NORMAL);
  const I=nums(prim.indices);
  const JO=nums(prim.attributes.JOINTS_0), WE=nums(prim.attributes.WEIGHTS_0);
  const nv=P.length/3;

  /* the limb each JOINT drives, so a vertex only has to be asked which
     joint holds most of it */
  const jointLimb=g.skins[0].joints.map(n=>limbOf(g.nodes[n].name));
  const limb=new Array(nv);
  for(let v=0;v<nv;v++){
    let best=-1, bw=-1;
    for(let k=0;k<4;k++){ const w=WE[v*4+k]; if(w>bw){ bw=w; best=JO[v*4+k]; } }
    limb[v]=jointLimb[best]||'torso';
  }

  let ymin=Infinity,ymax=-Infinity,xmax=0;
  for(let i=0;i<nv;i++){ const y=P[i*3+1]; if(y<ymin)ymin=y; if(y>ymax)ymax=y;
    const ax=Math.abs(P[i*3]); if(ax>xmax)xmax=ax; }

  /* HOW WIDE THE BODY IS AT THIS HEIGHT, measured from the vertices the
     rig says are body rather than arm. The suit's side panels are a strip
     down the outside of the torso, and "outside" is a fraction of the
     local width — a fixed number would sit on the ribs at the chest and
     miss the waist entirely. */
  const NSL=64, halfW=new Float64Array(NSL);
  const slice=y=>Math.min(NSL-1, Math.floor(((y-ymin)/(ymax-ymin))*NSL));
  for(let v=0;v<nv;v++){
    if(!/^(hips|torso|neck|shoulder)$/.test(limb[v])) continue;
    const s=slice(P[v*3+1]), ax=Math.abs(P[v*3]);
    if(ax>halfW[s]) halfW[s]=ax;
  }
  for(let s=0;s<NSL;s++) if(!halfW[s]) halfW[s]=halfW[s-1]||halfW[s+1]||xmax*0.2;

  /* Behind the body and high up: hair on the back and shoulders. The two
     numbers are the back of the shirt and the point the hair stops, both
     read off the mesh — the shirt's own back never reaches the first. */
  function hairBehind(y,z){
    if(!B.hairBack) return false;
    const yN=(y-ymin)/(ymax-ymin), zN=z/(ymax-ymin);
    return zN < B.hairBack[0] && yN > B.hairBack[1];
  }
  function classify(x,y,z,L){
    /* EVERY NUMBER IN THE SPEC IS A FRACTION OF THE FIGURE, none of them a
       length. The same model is stored at a hundredth of life size to match
       the animation clips (see fbx2glb.js), and a spec written in metres
       would have had to be rewritten the day that changed — and would have
       silently painted a face-shaped patch a hundred times too big rather
       than failing. Height over height, width over reach, depth over
       height: all of it survives a scale. */
    const yN=(y-ymin)/(ymax-ymin), ax=Math.abs(x)/xmax, zN=z/(ymax-ymin);
    /* A boot rises past the ankle, so the top of it is a height and not a
       bone — and above that it is whatever the leg is wearing, which for
       somebody in shorts is their own leg. */
    if(L==='foot' || L==='leg'){
      if(yN<B.shoeTop) return (B.sole && yN<B.sole) ? 'sole' : 'shoe';
      /* Above the shoe and below the sock's top: which stripe. A period of
         zero is a plain sock, which is the same rule with the question
         never asked. */
      if(B.sock && yN<B.sock[0]){
        if(!B.sock[1]) return 'sock';
        return Math.floor((yN-B.shoeTop)/B.sock[1]) % 2 ? 'sock2' : 'sock';
      }
      return (B.shortsHem && yN<B.shortsHem) ? 'skin' : 'jeans';
    }
    if(L==='forearm'||L==='hand'){
      if(B.watch && ax>=B.watch[0] && ax<=B.watch[1] && x>0) return 'watch';
      return 'skin';
    }
    /* THE SLEEVE IS A LENGTH ALONG THE ARM, and in a T-pose that is a
       distance out from the middle — which is the one thing |x| is
       genuinely the right question for, now that it is only ever asked
       about a vertex the rig has already called an arm. */
    /* THE SLEEVE ENDS AT THE SAME PLACE ON BOTH BONES. The deltoid is
       weighted to the shoulder and the rest of the upper arm to the arm,
       and a sleeve that stopped at a bone boundary on one and a distance
       on the other left a red thumbprint on the shoulder cap. */
    if(L==='arm'||L==='shoulder'){
      if(ax>=B.sleeveEnd) return 'skin';
      if(hairBehind(y,z)) return 'hair';
      return 'jersey';
    }
    if(L==='head'||L==='neck'){
      /* HAIR HANGS PAST THE JAW, and past the collar, and lands on the
         shoulders — which is the whole silhouette of this character and
         is not something a height can be asked about: the back of her
         head and the front of her collarbone are the same slice of the
         same body. What tells them apart is that hair is BEHIND. */
      if(hairBehind(y,z)) return 'hair';
      if(yN<B.collarTop) return 'jersey';                 // the collar
      /* The face is a window in the hair, and an oval one. A box left
         corners of forehead showing through at the temples and cut the
         jaw off square — the shape of a face is the cheapest way to make
         a flat patch of skin read as one. */
      /* The hat goes on last and covers everything above its brim —
         including the fringe, which is the point of a hat. */
      if(B.hatLine && yN>B.hatLine) return 'hat';
      const fy=(yN-B.faceY)/B.faceR[1], fx=ax/B.faceR[0];
      if(zN>B.faceZ && fx*fx+fy*fy < 1) return 'skin';
      // and the throat below it, or she wears her hair over her windpipe
      if(zN>B.faceZ && yN<B.throat[0] && ax<B.throat[1]) return 'skin';
      return 'hair';
    }
    // hips and the spine: three garments stacked up one torso
    if(hairBehind(y,z)) return 'hair';
    if(yN<B.waistTop) return 'jeans';
    if(yN<B.shirtHem) return 'skin';                      // the bare midriff
    if(B.emblem && zN>0 && yN>B.emblem[0] && yN<B.emblem[1]){
      /* the spider, as the shape it actually is: a body down the sternum
         with the legs reaching out and up from it */
      const t=(yN-B.emblem[0])/(B.emblem[1]-B.emblem[0]);
      const wide=B.emblem[2]*Math.sin(Math.PI*Math.min(1,Math.max(0,t)))**0.6;
      if(ax<wide) return 'emblem';
    }
    if(B.panel){
      const w=halfW[slice(y)];
      if(Math.abs(x) > B.panel*w) return 'panel';
    }
    return 'jersey';
  }

  /* ------------------------------------------------------------ cavity */
  const cav=new Float32Array(nv);
  {
    const sx=new Float64Array(nv), sy=new Float64Array(nv), sz=new Float64Array(nv);
    const cnt=new Uint32Array(nv), elen=new Float64Array(nv);
    const edge=(a,b)=>{ sx[a]+=P[b*3]; sy[a]+=P[b*3+1]; sz[a]+=P[b*3+2]; cnt[a]++;
      elen[a]+=Math.hypot(P[b*3]-P[a*3],P[b*3+1]-P[a*3+1],P[b*3+2]-P[a*3+2]); };
    for(let f=0;f<I.length;f+=3){ const a=I[f],b=I[f+1],c=I[f+2];
      edge(a,b);edge(b,a);edge(b,c);edge(c,b);edge(c,a);edge(a,c); }
    for(let v=0;v<nv;v++){
      if(!cnt[v]) continue;
      const dx=sx[v]/cnt[v]-P[v*3], dy=sy[v]/cnt[v]-P[v*3+1], dz=sz[v]/cnt[v]-P[v*3+2];
      const d=dx*NRM[v*3]+dy*NRM[v*3+1]+dz*NRM[v*3+2];
      const L=elen[v]/cnt[v]||1;
      cav[v]=Math.max(-1,Math.min(1,(d/L)*2.6));
    }
  }

  /* --------------------------------------------- split at colour seams */
  const key=new Map(), src=[], col=[], NI=[], tally={};
  for(let f=0;f<I.length;f+=3){
    const t=[I[f],I[f+1],I[f+2]];
    const cx=(P[t[0]*3]+P[t[1]*3]+P[t[2]*3])/3;
    const cy=(P[t[0]*3+1]+P[t[1]*3+1]+P[t[2]*3+1])/3;
    const cz=(P[t[0]*3+2]+P[t[1]*3+2]+P[t[2]*3+2])/3;
    /* the triangle's limb is a vote, not the first corner's: a face that
       straddles the shoulder seam should take the side most of it is on */
    const votes={}; for(const v of t) votes[limb[v]]=(votes[limb[v]]||0)+1;
    const L=Object.entries(votes).sort((a,b)=>b[1]-a[1])[0][0];
    const part=classify(cx,cy,cz,L); tally[part]=(tally[part]||0)+1;
    const base=rgb(C[part]), sh=SHADE[part]||{dark:0.4,lift:0.15};
    for(const v of t){
      const k=v+'|'+part;
      let at=key.get(k);
      if(at===undefined){
        at=src.length; key.set(k,at); src.push(v);
        const q=cav[v];
        const m = q>0 ? 1-sh.dark*q : 1+sh.lift*(-q);
        col.push(base.map(ch=>Math.max(0.035,Math.min(1,ch*m))));
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
      const mn=[Infinity,Infinity,Infinity], mx=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<outV;i++) for(let k=0;k<3;k++){
        const v=P[src[i]*3+k]; if(v<mn[k])mn[k]=v; if(v>mx[k])mx[k]=v; }
      desc.min=mn; desc.max=mx;
    }
    g.accessors.push(desc);
    prim.attributes[name]=g.accessors.length-1;
  }
  const cbuf=Buffer.alloc(outV*12);
  for(let i=0;i<outV;i++){ cbuf.writeFloatLE(col[i][0],i*12);
    cbuf.writeFloatLE(col[i][1],i*12+4); cbuf.writeFloatLE(col[i][2],i*12+8); }
  g.accessors.push({bufferView:addView(cbuf,34962),byteOffset:0,
                    componentType:5126,count:outV,type:'VEC3'});
  prim.attributes.COLOR_0=g.accessors.length-1;
  const ibuf=Buffer.alloc(NI.length*4);
  for(let i=0;i<NI.length;i++) ibuf.writeUInt32LE(NI[i],i*4);
  g.accessors.push({bufferView:addView(ibuf,34963),byteOffset:0,
                    componentType:5125,count:NI.length,type:'SCALAR'});
  prim.indices=g.accessors.length-1;

  const mat=g.materials[prim.material!==undefined?prim.material:0];
  mat.pbrMetallicRoughness=Object.assign({},mat.pbrMetallicRoughness,
    {baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:0.9});

  const BIN=Buffer.concat(chunks);
  g.buffers=[{byteLength:BIN.length}];
  let js=Buffer.from(JSON.stringify(g),'utf8');
  if(js.length%4) js=Buffer.concat([js,Buffer.alloc(4-(js.length%4),0x20)]);
  const head=Buffer.alloc(12); head.write('glTF',0);
  head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+js.length+8+BIN.length,8);
  const jh=Buffer.alloc(8); jh.writeUInt32LE(js.length,0); jh.writeUInt32LE(0x4E4F534A,4);
  const bh=Buffer.alloc(8); bh.writeUInt32LE(BIN.length,0); bh.writeUInt32LE(0x004E4942,4);
  fs.writeFileSync(OUT,Buffer.concat([head,jh,js,bh,BIN]));
  console.log(OUT.split('/').pop(), (fs.statSync(OUT).size/1024).toFixed(0)+'KB',
    'verts '+nv+'->'+outV, '|', Object.entries(tally).sort((a,b)=>b[1]-a[1])
      .map(([k,v])=>k+':'+v).join(' '));
}

if(require.main===module){
  const spec=process.argv[4] ? JSON.parse(fs.readFileSync(process.argv[4],'utf8')) : {};
  paint(process.argv[2], process.argv[3], spec);
}
module.exports={paint};
