/* Merge Mixamo clips into one rigged .glb, and give them names.

   Mixamo hands back one FBX per animation, each carrying its own copy of
   the mesh and skeleton, and every clip inside is called "mixamo.com" —
   all of them, always. rig() in avatar.js looks a clip up by name, so a
   file full of identically-named clips animates exactly one thing.

   This takes the first file whole (mesh, skin, skeleton, materials) and
   copies only the ANIMATION out of the rest, re-pointing each channel at
   the base file's node indices. Safe because every Mixamo export of the
   same character shares one skeleton — which is checked, not assumed. */
const fs=require('fs');
const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const CS={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};

function read(path){
  const b=fs.readFileSync(path); let off=12,json=null,bin=null;
  while(off<b.length){const len=b.readUInt32LE(off),t=b.readUInt32LE(off+4);
    if(t===0x4E4F534A) json=JSON.parse(b.slice(off+8,off+8+len).toString('utf8'));
    else if(t===0x004E4942) bin=b.slice(off+8,off+8+len);
    off+=8+len; if(!len)break;}
  return {json,bin};
}
/* an accessor's bytes, tightly packed, whatever the source layout was */
function raw(g,bin,i){
  const a=g.accessors[i], bv=g.bufferViews[a.bufferView];
  const n=NC[a.type], sz=CS[a.componentType], row=n*sz;
  const stride=bv.byteStride||row;
  const base=(bv.byteOffset||0)+(a.byteOffset||0);
  const out=Buffer.alloc(a.count*row);
  for(let v=0;v<a.count;v++) bin.copy(out, v*row, base+v*stride, base+v*stride+row);
  return {buf:out, desc:{componentType:a.componentType, count:a.count, type:a.type,
                         ...(a.min?{min:a.min}:{}) , ...(a.max?{max:a.max}:{})}};
}

const base=process.argv[2], out=process.argv[3];
const extra=[];                       // name=file.glb, plus scale=N
let SCALE=1, INPLACE=[], TRIM={}, DROPBASE=false;
for(let i=4;i<process.argv.length;i++){
  const [name,file]=process.argv[i].split('=');
  if(name==='scale'){ SCALE=+file; continue; }
  if(name==='inplace'){ INPLACE=file.split(','); continue; }
  if(name==='trim'){ const [c,a,b]=file.split(':'); TRIM[c]=[+a,+b]; continue; }
  if(name==='dropbase'){ DROPBASE=true; continue; }
  extra.push({name,file});
}
const B=read(base);
const g=JSON.parse(JSON.stringify(B.json));
const chunks=[B.bin]; let cur=B.bin.length;
const pad=n=>(4-(n%4))%4;

function append(buf){
  const p=pad(cur); if(p){ chunks.push(Buffer.alloc(p)); cur+=p; }
  const at=cur; chunks.push(buf); cur+=buf.length; return at;
}
/* a sampler's times, as plain numbers */
function rawFloats(src,srcBin,idx){
  const {buf}=raw(src,srcBin,idx);
  const out=new Float32Array(buf.length/4);
  for(let i=0;i<out.length;i++) out[i]=buf.readFloatLE(i*4);
  return out;
}
/* a sampler's values, with the width of one keyframe */
function rawRows(src,srcBin,idx){
  const a=src.accessors[idx];
  const {buf}=raw(src,srcBin,idx);
  return { buf, row: buf.length/a.count };
}
/* park a buffer in the output and describe it as an accessor */
function addRaw(buf, desc){
  const off=append(buf);
  g.bufferViews.push({buffer:0, byteOffset:off, byteLength:buf.length});
  g.accessors.push({bufferView:g.bufferViews.length-1, byteOffset:0, ...desc});
  return g.accessors.length-1;
}
function addAccessor(src,srcBin,idx,target){
  const {buf,desc}=raw(src,srcBin,idx);
  const off=append(buf);
  g.bufferViews.push({buffer:0, byteOffset:off, byteLength:buf.length,
                      ...(target?{target}:{})});
  g.accessors.push({bufferView:g.bufferViews.length-1, byteOffset:0, ...desc});
  return g.accessors.length-1;
}

g.animations=g.animations||[];
/* The clip the base file arrived with. For a character exported straight
   out of the rigger that is whatever pose Mixamo happened to attach, and
   it is not an idle — so it can be thrown away and the real one taken
   from the donor along with everything else. */
if(DROPBASE) g.animations=[];
else if(g.animations[0]) g.animations[0].name=extra.length?process.env.BASE_NAME||'idle':'idle';

/* RETARGET BY NAME, NOT BY INDEX. Two characters rigged by the same
   auto-rigger do not necessarily come back with the same skeleton — one
   may have fingers and the other not — so matching channels by node
   number lines a hand up with a shin. Mixamo's bone NAMES are fixed
   though, so the name is the thing both skeletons agree on. A channel
   aimed at a bone this character has not got is dropped, which is the
   right answer: you cannot animate a finger that does not exist. */
const baseIx=new Map(); g.nodes.forEach((n,i)=>{ if(n.name) baseIx.set(n.name,i); });
const hipsName = g.nodes.map(n=>n.name).find(n=>/Hips$/.test(n||'')) || '';
const baseHips = (g.nodes[baseIx.get(hipsName)]||{}).translation || [0,0,0];

for(const {name,file} of extra){
  const S=read(file);
  const srcNames=S.json.nodes.map(n=>n.name);
  const anim=S.json.animations[0];
  const win=TRIM[name];
  /* THE ROOT IS THE ONE BONE WHOSE TRACK IS A PLACE RATHER THAN AN ANGLE.
     Rotations transfer between two Mixamo rigs untouched; hip POSITION
     does not, because it is measured from each character's own origin and
     they are not the same height. Copied raw, a taller donor drives a
     shorter character's hips through the floor. Shifting the whole track
     by the difference between the two bind poses keeps the motion — the
     bob, the jump arc — and leaves her standing at her own height. */
  const srcHipsIx=srcNames.findIndex(n=>/Hips$/.test(n||''));
  const srcHips=(S.json.nodes[srcHipsIx]||{}).translation || [0,0,0];
  const delta=[baseHips[0]-srcHips[0], baseHips[1]-srcHips[1], baseHips[2]-srcHips[2]];

  const samplers=[], channels=[];
  let dropped=0;
  for(const ch of anim.channels){
    const bone=srcNames[ch.target.node];
    const at=baseIx.get(bone);
    if(at===undefined){ dropped++; continue; }
    const s=anim.samplers[ch.sampler];
    const isRoot = ch.target.path==='translation' && /Hips$/.test(bone||'');
    samplers.push(makeSampler(S, s, win, isRoot?delta:null));
    channels.push({ sampler:samplers.length-1, target:{node:at, path:ch.target.path} });
  }
  g.animations.push({ name, samplers, channels });
  if(dropped) console.log('  '+name+': '+dropped+' channels dropped (bones this rig has not got)');
}

/* One sampler, optionally trimmed to a window and optionally shifted. */
function makeSampler(S, s, win, offset){
  const outA=S.json.accessors[s.output];
  let times=rawFloats(S.json,S.bin,s.input);
  let {buf,row}=rawRows(S.json,S.bin,s.output);
  let keep=times.map((_,i)=>i);
  if(win){
    keep=keep.filter(i=>times[i]>=win[0]-1e-6 && times[i]<=win[1]+1e-6);
    if(keep.length<2) throw new Error('trim window keeps <2 keys');
  }
  const t0=times[keep[0]];
  const tb=Buffer.alloc(keep.length*4);
  keep.forEach((k,i)=>tb.writeFloatLE(times[k]-t0, i*4));
  const ti=addRaw(tb, {componentType:5126, count:keep.length, type:'SCALAR',
                       min:[0], max:[times[keep[keep.length-1]]-t0]});
  const ob=Buffer.alloc(keep.length*row);
  keep.forEach((k,i)=>buf.copy(ob, i*row, k*row, k*row+row));
  if(offset){                       // VEC3 float translation only
    for(let i=0;i<keep.length;i++) for(let c=0;c<3;c++)
      ob.writeFloatLE(ob.readFloatLE(i*row+c*4)+offset[c], i*row+c*4);
  }
  const oi=addRaw(ob, {componentType:outA.componentType, count:keep.length, type:outA.type});
  return { input:ti, output:oi, interpolation:s.interpolation||'LINEAR' };
}

/* ROOT MOTION OUT. Mixamo's locomotion clips walk the hips forward, which
   is right for an engine that lets the animation drive the body and wrong
   for this one — here the program and the keys decide where the body is,
   and the clip only decides what it looks like while it gets there. Left
   in, the character slides away from its own position once per loop.

   Only x and z are flattened, to the value they hold on the first frame.
   The y bounce is the walk, and taking it out gives a mech-like glide. */
if(INPLACE.length){
  const hips=g.nodes.findIndex(n=>/Hips$/.test(n.name||''));
  for(const a of g.animations){
    if(INPLACE.indexOf(a.name)<0) continue;
    const ch=a.channels.find(c=>c.target.node===hips && c.target.path==='translation');
    if(!ch) continue;
    const acc=g.accessors[a.samplers[ch.sampler].output];
    const bv=g.bufferViews[acc.bufferView];
    const at=(bv.byteOffset||0)+(acc.byteOffset||0);
    const bytes=Buffer.concat(chunks);       // flatten what we have so far
    const x0=bytes.readFloatLE(at), z0=bytes.readFloatLE(at+8);
    for(let i=0;i<acc.count;i++){
      bytes.writeFloatLE(x0, at+i*12);
      bytes.writeFloatLE(z0, at+i*12+8);
    }
    chunks.length=0; chunks.push(bytes); cur=bytes.length;
  }
}

/* FBX carries its units, and FBX2glTF converts centimetres to metres on
   the way out — so a model that went to Mixamo one unit tall comes back
   one hundredth of that: mesh, bone translations and animation tracks all
   divided alike. Because it is uniform, one scale on the scene root puts
   every one of them right at once, and skinning stays correct because the
   bones and the mesh hang off that same root. */
if(SCALE!==1){
  const r=g.nodes[g.scenes[g.scene||0].nodes[0]];
  const s0=r.scale||[1,1,1];
  r.scale=[s0[0]*SCALE, s0[1]*SCALE, s0[2]*SCALE];
}

const BIN=Buffer.concat(chunks);
g.buffers=[{byteLength:BIN.length}];
let js=Buffer.from(JSON.stringify(g),'utf8');
if(js.length%4) js=Buffer.concat([js,Buffer.alloc(4-(js.length%4),0x20)]);
const head=Buffer.alloc(12); head.write('glTF',0);
head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+js.length+8+BIN.length,8);
const jh=Buffer.alloc(8); jh.writeUInt32LE(js.length,0); jh.writeUInt32LE(0x4E4F534A,4);
const bh=Buffer.alloc(8); bh.writeUInt32LE(BIN.length,0); bh.writeUInt32LE(0x004E4942,4);
fs.writeFileSync(out, Buffer.concat([head,jh,js,bh,BIN]));
console.log(out.split('/').pop(), (fs.statSync(out).size/1024).toFixed(0)+' KB  scale x'+SCALE+'  clips:',
  g.animations.map(a=>a.name+'('+a.channels.length+'ch)').join(' '));
