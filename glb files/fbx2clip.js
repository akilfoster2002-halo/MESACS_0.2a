/* An ANIMATION out of a Mixamo FBX and into a glb that merge-clips.js can
   read. No mesh, no skin — a Mixamo animation download has neither worth
   keeping, and merge-clips only ever asks a donor for two things: what its
   bones are called, and the animation.

   fbx2glb.js is the other half of this and deliberately ignores animation:
   a character export is a T-pose with a two-key "clip" in it that is not a
   clip. This is the opposite file — the clip with no character.

   THE ROTATION IS THE WHOLE JOB. FBX stores a bone's orientation as Euler
   angles in degrees, in a stated order, on top of a PRE-ROTATION that is
   not animated and lives only in the node's properties. Take the curve
   values alone and every joint with a pre-rotation is wrong by a fixed
   twist — which reads as a character whose arms are on backwards, playing
   an otherwise perfect walk. So the quaternion that comes out is
   qPre · qEuler, per bone, per key.

   AND IT COMES OUT AT A HUNDREDTH of FBX's units, because that is the
   scale every character here is stored at and a hips track means nothing
   against a skeleton measured differently. Rotations are scale-free; only
   the one translation track has to be divided.

   Checked against a clip the real FBX2glTF already converted — see
   tests/clips.test.js. */
const fs=require('fs');
const {parse,kid,kids}=require('./fbx-read.js');

const KTIME=46186158000;                 // FBX's own tick, per second
const D=Math.PI/180;

/* Euler XYZ in degrees to a quaternion. XYZ is FBX's default order and
   means X is applied first, so the product is qz·qy·qx. */
function quat(x,y,z){
  const hx=x*D/2, hy=y*D/2, hz=z*D/2;
  const cx=Math.cos(hx), sx=Math.sin(hx);
  const cy=Math.cos(hy), sy=Math.sin(hy);
  const cz=Math.cos(hz), sz=Math.sin(hz);
  return [ sx*cy*cz - cx*sy*sz,
           cx*sy*cz + sx*cy*sz,
           cx*cy*sz - sx*sy*cz,
           cx*cy*cz + sx*sy*sz ];
}
const qmul=(a,b)=>[
  a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
  a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
  a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
  a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];

function convert(IN, OUT, opts){
  const S=(opts&&opts.scale)||100;
  const {root}=parse(IN);
  const objs=kid(root,'Objects');
  const byId=new Map();
  for(const o of objs.children) byId.set(o.props[0], o);
  const kindOf=id=>{ const o=byId.get(id); return o?o.name:null; };
  const nameOf=o=>String(o.props[1]).split('\0')[0];
  const prop=(o,which)=>{
    const p=kid(o,'Properties70'); if(!p) return null;
    const e=p.children.find(x=>x.props[0]===which);
    return e ? e.props.slice(4) : null;
  };

  /* OO builds the skeleton, OP hangs the curves on it. Both are needed and
     they mean different things — see fbx2glb.js on why they cannot share
     one map. */
  const parentOf=new Map(), childrenOf=new Map();
  const attach=[];                       // {curveNodeId, boneId, which}
  const curveOf=[];                      // {curveId, curveNodeId, axis}
  for(const c of kid(root,'Connections').children){
    const [kind, a, b, which]=c.props;
    if(kind==='OO'){
      if(!childrenOf.has(b)) childrenOf.set(b,[]);
      childrenOf.get(b).push(a);
      if(kindOf(a)==='Model' && kindOf(b)==='Model') parentOf.set(a,b);
    } else if(kind==='OP'){
      if(kindOf(a)==='AnimationCurveNode' && kindOf(b)==='Model')
        attach.push({ node:a, bone:b, which });
      else if(kindOf(a)==='AnimationCurve' && kindOf(b)==='AnimationCurveNode')
        curveOf.push({ curve:a, node:b, axis:which });
    }
  }

  const bones=kids(objs,'Model');
  const order=[];
  {
    const seen=new Set(), ids=new Set(bones.map(b=>b.props[0]));
    const visit=id=>{ if(seen.has(id)) return; seen.add(id); order.push(id);
      for(const c of (childrenOf.get(id)||[])) if(ids.has(c)) visit(c); };
    for(const b of bones) if(!ids.has(parentOf.get(b.props[0]))) visit(b.props[0]);
    for(const b of bones) visit(b.props[0]);
  }
  const index=new Map(); order.forEach((id,i)=>index.set(id,i));

  /* the curves belonging to one animation node, by axis */
  const axesOf=new Map();                // curveNodeId -> {X,Y,Z}
  for(const {curve,node,axis} of curveOf){
    const a=(axis||'').replace('d|','');
    if(!'XYZ'.includes(a)) continue;
    if(!axesOf.has(node)) axesOf.set(node,{});
    axesOf.get(node)[a]=byId.get(curve);
  }
  const track=c=>{
    if(!c) return null;
    const t=kid(c,'KeyTime'), v=kid(c,'KeyValueFloat');
    if(!t||!v) return null;
    return { t:Array.from(t.props[0], k=>Number(k)/KTIME), v:Array.from(v.props[0]) };
  };
  /* Linear read of one channel at a time. Mixamo bakes every frame so the
     three axes always share a key list — but "always" is doing work there,
     and a clip whose X curve is one key shorter than its Y should bend an
     elbow rather than throw. */
  const at=(tr,time,fallback)=>{
    if(!tr||!tr.t.length) return fallback;
    const T=tr.t;
    if(time<=T[0]) return tr.v[0];
    if(time>=T[T.length-1]) return tr.v[T.length-1];
    let i=0; while(i<T.length-2 && T[i+1]<time) i++;
    const u=(time-T[i])/(T[i+1]-T[i]);
    return tr.v[i]+(tr.v[i+1]-tr.v[i])*u;
  };

  /* what each bone has an animated curve for */
  const anim=new Map();                  // boneId -> {T:{X,Y,Z}, R:{X,Y,Z}}
  for(const {node,bone,which} of attach){
    const ax=axesOf.get(node); if(!ax) continue;
    const slot= which==='Lcl Translation' ? 'T' : which==='Lcl Rotation' ? 'R' : null;
    if(!slot) continue;
    if(!anim.has(bone)) anim.set(bone,{});
    anim.get(bone)[slot]={ X:track(ax.X), Y:track(ax.Y), Z:track(ax.Z) };
  }

  /* ONE TIME LINE FOR THE WHOLE CLIP. Every curve in a Mixamo export is
     baked on the same frame grid, so this is that grid — collected rather
     than assumed, and used to sample everything, which is also what makes
     a ragged curve harmless. */
  const times=new Set();
  for(const [,slots] of anim) for(const k of ['T','R']){
    const s=slots[k]; if(!s) continue;
    for(const a of ['X','Y','Z']) if(s[a]) s[a].t.forEach(v=>times.add(Math.round(v*1e6)/1e6));
  }
  const T=[...times].sort((a,b)=>a-b);
  if(T.length<2) throw new Error(IN+' has no animation in it (a T-pose is not a clip)');
  const t0=T[0], TIMES=T.map(v=>v-t0);

  /* -------------------------------------------------------- build the glTF */
  const nodes=order.map(id=>{
    const m=byId.get(id);
    const tr=prop(m,'Lcl Translation')||[0,0,0];
    const lr=prop(m,'Lcl Rotation')||[0,0,0];
    const pre=prop(m,'PreRotation');
    const q=pre ? qmul(quat(pre[0],pre[1],pre[2]), quat(lr[0],lr[1],lr[2]))
                : quat(lr[0],lr[1],lr[2]);
    return { name:nameOf(m), translation:[tr[0]/S,tr[1]/S,tr[2]/S], rotation:q };
  });
  order.forEach((id,i)=>{
    const ch=(childrenOf.get(id)||[]).filter(c=>index.has(c)).map(c=>index.get(c));
    if(ch.length) nodes[i].children=ch;
  });
  const roots=order.filter(id=>!index.has(parentOf.get(id))).map(id=>index.get(id));

  const chunks=[]; let cur=0;
  const g={ asset:{version:'2.0', generator:'fbx2clip.js'},
            scene:0, scenes:[{nodes:roots}], nodes,
            bufferViews:[], accessors:[], animations:[] };
  const put=b=>{ const p=(4-(cur%4))%4; if(p){chunks.push(Buffer.alloc(p)); cur+=p;}
                 const off=cur; chunks.push(b); cur+=b.length; return off; };
  const view=b=>{ const off=put(b);
    g.bufferViews.push({buffer:0, byteOffset:off, byteLength:b.length});
    return g.bufferViews.length-1; };
  const acc=d=>{ g.accessors.push(d); return g.accessors.length-1; };

  const tb=Buffer.alloc(TIMES.length*4);
  TIMES.forEach((v,i)=>tb.writeFloatLE(v,i*4));
  const timeAcc=acc({ bufferView:view(tb), componentType:5126, count:TIMES.length,
                      type:'SCALAR', min:[TIMES[0]], max:[TIMES[TIMES.length-1]] });

  const samplers=[], channels=[];
  for(const id of order){
    const slots=anim.get(id); if(!slots) continue;
    const m=byId.get(id), i=index.get(id);
    const pre=prop(m,'PreRotation');
    const qpre=pre?quat(pre[0],pre[1],pre[2]):null;
    const restT=prop(m,'Lcl Translation')||[0,0,0];
    const restR=prop(m,'Lcl Rotation')||[0,0,0];
    if(slots.T){
      const b=Buffer.alloc(TIMES.length*12);
      T.forEach((time,k)=>{
        b.writeFloatLE(at(slots.T.X,time,restT[0])/S, k*12);
        b.writeFloatLE(at(slots.T.Y,time,restT[1])/S, k*12+4);
        b.writeFloatLE(at(slots.T.Z,time,restT[2])/S, k*12+8);
      });
      samplers.push({ input:timeAcc, output:acc({ bufferView:view(b), componentType:5126,
                        count:TIMES.length, type:'VEC3' }), interpolation:'LINEAR' });
      channels.push({ sampler:samplers.length-1, target:{node:i, path:'translation'} });
    }
    if(slots.R){
      const b=Buffer.alloc(TIMES.length*16);
      let prev=null;
      T.forEach((time,k)=>{
        let q=quat(at(slots.R.X,time,restR[0]), at(slots.R.Y,time,restR[1]),
                   at(slots.R.Z,time,restR[2]));
        if(qpre) q=qmul(qpre,q);
        /* KEEP THE TRACK ON ONE SIDE OF THE HYPERSPHERE. q and −q are the
           same orientation, and Euler angles wrapping past 180° flip the
           sign of the quaternion they convert to. A player interpolating
           between two neighbouring keys that happen to be q and −q takes
           the long way round: the arm spins a full turn in one frame. */
        if(prev && (q[0]*prev[0]+q[1]*prev[1]+q[2]*prev[2]+q[3]*prev[3])<0)
          q=q.map(v=>-v);
        prev=q;
        for(let c=0;c<4;c++) b.writeFloatLE(q[c], k*16+c*4);
      });
      samplers.push({ input:timeAcc, output:acc({ bufferView:view(b), componentType:5126,
                        count:TIMES.length, type:'VEC4' }), interpolation:'LINEAR' });
      channels.push({ sampler:samplers.length-1, target:{node:i, path:'rotation'} });
    }
  }
  g.animations.push({ name:(opts&&opts.name)||'clip', samplers, channels });

  const BIN=Buffer.concat(chunks);
  g.buffers=[{byteLength:BIN.length}];
  let js=Buffer.from(JSON.stringify(g),'utf8');
  if(js.length%4) js=Buffer.concat([js, Buffer.alloc(4-(js.length%4), 0x20)]);
  const head=Buffer.alloc(12); head.write('glTF',0);
  head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+js.length+8+BIN.length,8);
  const jh=Buffer.alloc(8); jh.writeUInt32LE(js.length,0); jh.writeUInt32LE(0x4E4F534A,4);
  const bh=Buffer.alloc(8); bh.writeUInt32LE(BIN.length,0); bh.writeUInt32LE(0x004E4942,4);
  fs.writeFileSync(OUT, Buffer.concat([head,jh,js,bh,BIN]));
  console.log(OUT.split('/').pop(), (fs.statSync(OUT).size/1024).toFixed(0)+'KB',
    'bones', order.length, 'keys', TIMES.length,
    'dur', TIMES[TIMES.length-1].toFixed(2)+'s', 'channels', channels.length);
}

if(require.main===module)
  convert(process.argv[2], process.argv[3], { scale:+(process.argv[4]||100) });
module.exports={convert};
