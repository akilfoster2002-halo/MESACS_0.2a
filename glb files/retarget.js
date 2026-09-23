/* =====================================================================
   RETARGET — the game's Mixamo clips onto a skeleton that is NOT Mixamo.

   merge-clips.js copies a clip across by bone name and nothing else, which
   is right when both files are Mixamo exports of the same rig: the same
   name means the same bone with the same rest orientation, so a local
   rotation means the same thing in both. A character rigged anywhere else
   — Higgsfield's image-to-3D auto-rig is the first — has bones in the same
   places with different names, different rest rotations and a different
   rest POSE (A, not T). Copy the rotations across and every limb twists.

   So this works in WORLD space. For each bone, at every key:

       target world = source world · reference⁻¹ · align · target rest

   `source world · reference⁻¹` is how far the clip has turned the bone
   from a real standing pose (the first frame of the idle — see below for
   why the files' own rest will not do). `align` is the one-off turn that points the
   target's bone the way the source's bone points at rest — which is what
   takes an A-pose arm up to the T the clips were authored from. Then back
   to local, parent first. The hips also carry the clip's travel, scaled by
   how much taller or shorter the target's legs are.

   Its bones are renamed to Mixamo's on the way out, so the result is an
   ordinary character to everything downstream: rig() finds its clips by
   name, buildSwim() finds 'mixamorig:LeftArm'.

     node retarget.js <character.glb> <out.glb> <map.json> \
       ref=rig/idle.glb idle=rig/idle.glb walk=rig/walk.glb ... \
       inplace=walk,sprint floor=idle,walk trim=jump:0.4166:1.2918

   map.json names each target bone's Mixamo equivalent ("Spine02":"Spine").
   ===================================================================== */
const fs=require('fs');
const THREE=require('../node_modules/three/build/three.cjs');
const { Quaternion:Q, Vector3:V3, Matrix4:M4 }=THREE;

const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function read(path){
  const b=fs.readFileSync(path); let off=12,json=null,bin=null;
  while(off<b.length){const len=b.readUInt32LE(off),t=b.readUInt32LE(off+4);
    if(t===0x4E4F534A) json=JSON.parse(b.slice(off+8,off+8+len).toString('utf8'));
    else if(t===0x004E4942) bin=b.slice(off+8,off+8+len);
    off+=8+len; if(!len)break;}
  return {g:json,bin};
}
function floats(f, i){
  const a=f.g.accessors[i], bv=f.g.bufferViews[a.bufferView], n=NC[a.type];
  if(a.componentType!==5126) throw new Error('only float accessors are read here');
  const stride=bv.byteStride||n*4, base=(bv.byteOffset||0)+(a.byteOffset||0), out=[];
  for(let k=0;k<a.count;k++){ const row=[]; for(let c=0;c<n;c++) row.push(f.bin.readFloatLE(base+k*stride+c*4)); out.push(row); }
  return out;
}

/* ------------------------------------------------------ a skeleton, posed */
function skeleton(f){
  const g=f.g, parent={};
  g.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parent[c]=i));
  const rest=g.nodes.map(n=>({
    t:new V3(...(n.translation||[0,0,0])), r:new Q(...(n.rotation||[0,0,0,1])), s:new V3(...(n.scale||[1,1,1])) }));
  const byName={}; g.nodes.forEach((n,i)=>{ if(n.name) byName[n.name]=i; });
  // every node's world matrix for a given set of local overrides
  function world(over){
    const W=[];
    const at=i=>{
      if(W[i]) return W[i];
      const L=over&&over[i]||rest[i];
      const m=new M4().compose(L.t, L.r, L.s);
      W[i]= parent[i]!==undefined ? at(parent[i]).clone().multiply(m) : m;
      return W[i];
    };
    g.nodes.forEach((_,i)=>at(i));
    return W;
  }
  return { g, parent, rest, byName, world };
}
const rotOf=m=>{ const p=new V3(), q=new Q(), s=new V3(); m.decompose(p,q,s); return q; };
const posOf=m=>new V3().setFromMatrixPosition(m);

/* a clip's value for one channel at time t, linear (slerp for rotations) */
function sampler(f, anim, ch){
  const s=anim.samplers[ch.sampler];
  return { times:floats(f, s.input).map(r=>r[0]), vals:floats(f, s.output), path:ch.target.path, node:ch.target.node };
}
function at(sp, t){
  const T=sp.times; let i=0;
  while(i<T.length-1 && T[i+1]<t) i++;
  if(t<=T[0]) return sp.vals[0];
  if(i>=T.length-1) return sp.vals[T.length-1];
  const u=(t-T[i])/Math.max(1e-9, T[i+1]-T[i]), a=sp.vals[i], b=sp.vals[i+1];
  if(sp.path==='rotation'){ const q=new Q(...a).slerp(new Q(...b), u); return [q.x,q.y,q.z,q.w]; }
  return a.map((v,k)=>v+(b[k]-v)*u);
}

/* ------------------------------------------------------------- the args */
const [,, charPath, outPath, mapPath, ...rest]=process.argv;
if(!charPath || !outPath || !mapPath){ console.error('usage: node retarget.js <char.glb> <out.glb> <map.json> name=clip.glb ...'); process.exit(1); }
const MAP=JSON.parse(fs.readFileSync(mapPath,'utf8'));        // target name -> mixamo name (no prefix)
const clips=[]; let INPLACE=[], TRIM={}, REF=null, FLOOR=[];
for(const a of rest){
  const [k,v]=a.split('=');
  if(k==='ref'){ REF=v; continue; }
  if(k==='floor'){ FLOOR=v.split(','); continue; }
  if(k==='inplace'){ INPLACE=v.split(','); continue; }
  if(k==='trim'){ const [c,x,y]=v.split(':'); TRIM[c]=[+x,+y]; continue; }
  clips.push({ name:k, file:v });
}

const C=read(charPath), T=skeleton(C);
const tIdx={}; for(const [tn,mn] of Object.entries(MAP)){
  if(T.byName[tn]===undefined) throw new Error('character has no bone '+tn); tIdx[mn]=T.byName[tn]; }
const TW=T.world();
// parents before children, among the mapped bones
const order=Object.keys(tIdx).sort((a,b)=>{
  const depth=i=>{ let d=0; while(T.parent[i]!==undefined){ i=T.parent[i]; d++; } return d; };
  return depth(tIdx[a])-depth(tIdx[b]);
});
/* which bone a bone points at, for the alignment: its first mapped child,
   else the bone it hands over to (a hand points the way its forearm did) */
const AIM={ Hips:'Spine', Spine:'Spine1', Spine1:'Spine2', Spine2:'Neck', Neck:'Head', Head:'HeadTop_End',
  LeftShoulder:'LeftArm', LeftArm:'LeftForeArm', LeftForeArm:'LeftHand',
  RightShoulder:'RightArm', RightArm:'RightForeArm', RightForeArm:'RightHand',
  LeftUpLeg:'LeftLeg', LeftLeg:'LeftFoot', LeftFoot:'LeftToeBase',
  RightUpLeg:'RightLeg', RightLeg:'RightFoot', RightFoot:'RightToeBase' };
const BORROW={ LeftHand:'LeftForeArm', RightHand:'RightForeArm', LeftToeBase:'LeftFoot', RightToeBase:'RightFoot', HeadTop_End:'Head' };

const out=JSON.parse(JSON.stringify(C.g));
const chunks=[C.bin]; let cur=C.bin.length;
function addFloats(rows, type){
  const n=NC[type], buf=Buffer.alloc(rows.length*n*4);
  rows.forEach((r,i)=>r.forEach((v,c)=>buf.writeFloatLE(v,(i*n+c)*4)));
  const p=(4-(cur%4))%4; if(p){ chunks.push(Buffer.alloc(p)); cur+=p; }
  out.bufferViews.push({buffer:0, byteOffset:cur, byteLength:buf.length});
  chunks.push(buf); cur+=buf.length;
  const acc={bufferView:out.bufferViews.length-1, componentType:5126, count:rows.length, type};
  if(type==='SCALAR'){ acc.min=[Math.min(...rows.map(r=>r[0]))]; acc.max=[Math.max(...rows.map(r=>r[0]))]; }
  out.accessors.push(acc); return out.accessors.length-1;
}
out.animations=[];

/* THE REFERENCE POSE. These clip files do not keep a real rest: every bone
   rests pointing straight up and the pose lives in the animation (FBX
   pre-rotations, see README). Aligning to that "rest" gets directions right
   and twists wrong, and measuring a leg off it measures nothing. So one
   real pose — the first frame of the idle, standing, arms down — is the
   reference every clip is measured against, and it is also the pose the
   target's A is turned to meet: a short turn, so no twist is invented. */
function posed(file, t){
  const f=read(file), S=skeleton(f), a=S.g.animations[0], over={};
  for(const ch of a.channels){
    const sp=sampler(f, a, ch), v=at(sp, t), r=S.rest[sp.node];
    const o=over[sp.node]||(over[sp.node]={t:r.t.clone(), r:r.r.clone(), s:r.s.clone()});
    if(sp.path==='rotation') o.r.set(...v); else if(sp.path==='translation') o.t.set(...v); else if(sp.path==='scale') o.s.set(...v);
  }
  return { S, W:S.world(over), f };
}
const idxOf=S=>{ const ix={}; for(const mn of Object.keys(tIdx)){ const i=S.byName['mixamorig:'+mn]; if(i!==undefined) ix[mn]=i; } return ix; };
/* a leg's length, off the bone offsets alone — which no clip animates, so it
   is the same in every frame and says what units a file is in */
const chainOf=(S,ix)=>['LeftLeg','LeftFoot'].reduce((n,b)=>n+S.rest[ix[b]].t.length(),0);
if(!REF) throw new Error('ref=<clip.glb> is required: a clip whose first frame stands');
const R=posed(REF, 0), rIdx=idxOf(R.S);
const align={};
for(const mn of order){
  const aim=AIM[mn];
  if(aim && rIdx[mn]!==undefined && rIdx[aim]!==undefined && tIdx[aim]!==undefined){
    const dt=posOf(TW[tIdx[aim]]).sub(posOf(TW[tIdx[mn]])).normalize();
    const ds=posOf(R.W[rIdx[aim]]).sub(posOf(R.W[rIdx[mn]])).normalize();
    align[mn]=new Q().setFromUnitVectors(dt, ds);
  }
}
for(const mn of order) if(!align[mn]) align[mn]=(BORROW[mn]&&align[BORROW[mn]]||new Q()).clone();
const FEET=['LeftFoot','RightFoot','LeftToeBase','RightToeBase'];
const lowOf=(W,ix)=>Math.min(...FEET.filter(b=>ix[b]!==undefined).map(b=>posOf(W[ix[b]]).y));
// standing: hips over the lowest foot joint, in the reference and in the target
const rHip=posOf(R.W[rIdx.Hips]), rLow=lowOf(R.W,rIdx), rChain=chainOf(R.S,rIdx);
const tHip0=posOf(TW[tIdx.Hips]), tLow=lowOf(TW,tIdx);
const k=(tHip0.y-tLow)/Math.max(1e-12, rHip.y-rLow);
const hipParentInv=TW[T.parent[tIdx.Hips]].clone().invert();
const refRot={}; for(const mn of order) if(rIdx[mn]!==undefined) refRot[mn]=rotOf(R.W[rIdx[mn]]).invert();

for(const clip of clips){
  const S=skeleton(read(clip.file)), F={g:S.g, bin:read(clip.file).bin};
  const sIdx=idxOf(S);
  const unit=rChain/Math.max(1e-12, chainOf(S,sIdx));    // this file's units in the reference's
  const anim=S.g.animations[0];
  const sps=anim.channels.map(ch=>sampler(F, anim, ch));
  let times=sps.find(s=>s.node===sIdx.Hips && s.path==='rotation').times;
  if(TRIM[clip.name]){ const [a,b]=TRIM[clip.name]; times=times.filter(t=>t>=a-1e-6 && t<=b+1e-6); }
  const t0=times[0];

  const rot={}; order.forEach(mn=>rot[mn]=[]); const hipT=[];
  let firstD=null;
  for(const t of times){
    const over={};
    for(const sp of sps){
      const v=at(sp,t), r=S.rest[sp.node], o=over[sp.node]||(over[sp.node]={t:r.t.clone(), r:r.r.clone(), s:r.s.clone()});
      if(sp.path==='rotation') o.r.set(...v); else if(sp.path==='translation') o.t.set(...v); else if(sp.path==='scale') o.s.set(...v);
    }
    const SWt=S.world(over);
    const G={};
    for(const mn of order){
      const ti=tIdx[mn];
      const Gs=sIdx[mn]!==undefined && refRot[mn] ? rotOf(SWt[sIdx[mn]]).multiply(refRot[mn]) : new Q();
      G[mn]=Gs.multiply(align[mn]).multiply(rotOf(TW[ti]));
      const p=T.parent[ti];
      const pmn=Object.keys(tIdx).find(n=>tIdx[n]===p);
      const PG= pmn ? G[pmn] : rotOf(TW[p]);
      const L=PG.clone().invert().multiply(G[mn]);
      rot[mn].push([L.x,L.y,L.z,L.w]);
    }
    /* the hips' height over the floor the reference stands on, in the
       reference's units, then in the target's; x and z as offsets from
       where the clip starts, so a file with its origin elsewhere does not
       drag the body sideways */
    const P=posOf(SWt[sIdx.Hips]).multiplyScalar(unit);
    if(!firstD) firstD=P.clone();
    const D=new V3(P.x-firstD.x, P.y-rLow, P.z-firstD.z).multiplyScalar(k);
    if(INPLACE.includes(clip.name)){ D.x=0; D.z=0; }                     // the travel out, the bob kept
    hipT.push(new V3(tHip0.x+D.x, tLow+D.y, tHip0.z+D.z).applyMatrix4(hipParentInv).toArray());
  }
  /* FEET ON THE FLOOR. The clip files do not all stand on the same floor —
     the two talks came out thirteen centimetres up — so a clip named in
     floor= is posed on the target, its lowest foot over the whole clip
     found, and the hips dropped by however far that is off the target's
     own floor. The fly is not named: it is meant to be off the ground. */
  if(FLOOR.includes(clip.name)){
    let low=Infinity;
    for(let i=0;i<times.length;i++){
      const over={};
      for(const mn of order){ const r=T.rest[tIdx[mn]];
        over[tIdx[mn]]={t:r.t.clone(), r:new Q(...rot[mn][i]), s:r.s.clone()}; }
      over[tIdx.Hips].t=new V3(...hipT[i]);
      low=Math.min(low, lowOf(T.world(over), tIdx));
    }
    const drop=new V3(0, low-tLow, 0).applyMatrix4(new M4().extractRotation(hipParentInv));
    const s=new V3().setFromMatrixScale(hipParentInv);
    for(const h of hipT){ h[0]-=drop.x*s.x; h[1]-=drop.y*s.y; h[2]-=drop.z*s.z; }
  }
  const input=addFloats(times.map(t=>[t-t0]),'SCALAR');
  const a={ name:clip.name, samplers:[], channels:[] };
  for(const mn of order){
    a.samplers.push({input, output:addFloats(rot[mn],'VEC4'), interpolation:'LINEAR'});
    a.channels.push({sampler:a.samplers.length-1, target:{node:tIdx[mn], path:'rotation'}});
  }
  a.samplers.push({input, output:addFloats(hipT,'VEC3'), interpolation:'LINEAR'});
  a.channels.push({sampler:a.samplers.length-1, target:{node:tIdx.Hips, path:'translation'}});
  out.animations.push(a);
  console.log(clip.name.padEnd(7), times.length+' keys', (times[times.length-1]-t0).toFixed(2)+'s',
              Object.keys(sIdx).length+'/'+order.length+' bones');
}

// and the names downstream expects
for(const [tn,mn] of Object.entries(MAP)) out.nodes[T.byName[tn]].name='mixamorig:'+mn;

const BIN=Buffer.concat(chunks);
out.buffers=[{byteLength:BIN.length}];
let js=Buffer.from(JSON.stringify(out),'utf8');
if(js.length%4) js=Buffer.concat([js,Buffer.alloc(4-(js.length%4),0x20)]);
const head=Buffer.alloc(12); head.write('glTF',0);
head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+js.length+8+BIN.length,8);
const jh=Buffer.alloc(8); jh.writeUInt32LE(js.length,0); jh.writeUInt32LE(0x4E4F534A,4);
const bh=Buffer.alloc(8); bh.writeUInt32LE(BIN.length,0); bh.writeUInt32LE(0x004E4942,4);
fs.writeFileSync(outPath, Buffer.concat([head,jh,js,bh,BIN]));
console.log(outPath.split('/').pop(), (fs.statSync(outPath).size/1e6).toFixed(1)+' MB');
