/* A rigged character out of a binary FBX and into a glb.

   Kyle and Mia went through an external converter that is not in this
   repo, which meant a third character could not be added without it.
   This is the part of that job this game actually needs: one mesh, one
   skeleton, one skin. No materials, no textures, no cameras, no lights —
   the models here carry their colour in COLOR_0 (see paint-rigged.js)
   and there is nothing in an FBX's material block worth keeping.

   TWO THINGS IT DOES NOT TRUST THE FILE ABOUT.

   THE REST POSE IS TAKEN FROM THE CLUSTERS, not from the nodes. An FBX
   node's local transform is a nine-way product — offsets, pivots, a pre-
   and a post-rotation — and getting one term wrong puts an arm through a
   chest in a way that only shows up once something is animating. Every
   bone that skins anything carries TransformLink, which is that bone's
   WORLD matrix at bind time and is not a product of anything. Local is
   then parent⁻¹ · own, which is exact by construction and cannot
   disagree with the inverse bind matrices, because both come from the
   same numbers. Leaf bones skin nothing and have no cluster; those fall
   back to the node's own translation and pre-rotation, and being wrong
   about the tip of a toe bone costs nothing.

   AND THE NORMALS ARE COMPUTED. Mixamo writes none, and a mesh with no
   normals is a silhouette. Area-weighted across each vertex's faces,
   which is what makes a smooth limb smooth.

   IT COMES OUT AT THE SAME SCALE AS EVERY OTHER CHARACTER HERE, which is
   a hundredth of life size with a hundred on the scene root to put it
   back. That is not a taste: FBX2glTF — which is what Kyle and Mia went
   through — reads the FBX's centimetres and writes metres, so both of
   them are stored that way, and so is every Mixamo clip in rig/. The
   clips carry ONE translation track, the hips, and its numbers only mean
   anything against a skeleton stored in the same units. Come out at life
   size instead and the rotations still work, so the character walks —
   with the bob and the jump arc flattened to a hundredth, which reads as
   a glide and takes a while to notice. */
const fs=require('fs');
const {parse,kid,kids}=require('./fbx-read.js');

/* ------------------------------------------------------------ matrices
   Column-major, the way glTF wants them written out. */
const mul=(a,b)=>{                    // a·b
  const o=new Float64Array(16);
  for(let c=0;c<4;c++) for(let r=0;r<4;r++){
    let s=0; for(let k=0;k<4;k++) s+=a[k*4+r]*b[c*4+k];
    o[c*4+r]=s;
  }
  return o;
};
const ident=()=>new Float64Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
function invert(m){
  /* full 4x4 inverse: a bind matrix can carry scale, and dropping it
     because "bones are rigid" is how a model arrives at half size */
  const a=m, o=new Float64Array(16);
  // the cofactors, written out longhand rather than cleverly: this runs
  // once per bone and being able to read it matters more than being short
  const inv=[
    a[5]*a[10]*a[15]-a[5]*a[11]*a[14]-a[9]*a[6]*a[15]+a[9]*a[7]*a[14]+a[13]*a[6]*a[11]-a[13]*a[7]*a[10],
   -a[1]*a[10]*a[15]+a[1]*a[11]*a[14]+a[9]*a[2]*a[15]-a[9]*a[3]*a[14]-a[13]*a[2]*a[11]+a[13]*a[3]*a[10],
    a[1]*a[6]*a[15]-a[1]*a[7]*a[14]-a[5]*a[2]*a[15]+a[5]*a[3]*a[14]+a[13]*a[2]*a[7]-a[13]*a[3]*a[6],
   -a[1]*a[6]*a[11]+a[1]*a[7]*a[10]+a[5]*a[2]*a[11]-a[5]*a[3]*a[10]-a[9]*a[2]*a[7]+a[9]*a[3]*a[6],
   -a[4]*a[10]*a[15]+a[4]*a[11]*a[14]+a[8]*a[6]*a[15]-a[8]*a[7]*a[14]-a[12]*a[6]*a[11]+a[12]*a[7]*a[10],
    a[0]*a[10]*a[15]-a[0]*a[11]*a[14]-a[8]*a[2]*a[15]+a[8]*a[3]*a[14]+a[12]*a[2]*a[11]-a[12]*a[3]*a[10],
   -a[0]*a[6]*a[15]+a[0]*a[7]*a[14]+a[4]*a[2]*a[15]-a[4]*a[3]*a[14]-a[12]*a[2]*a[7]+a[12]*a[3]*a[6],
    a[0]*a[6]*a[11]-a[0]*a[7]*a[10]-a[4]*a[2]*a[11]+a[4]*a[3]*a[10]+a[8]*a[2]*a[7]-a[8]*a[3]*a[6],
    a[4]*a[9]*a[15]-a[4]*a[11]*a[13]-a[8]*a[5]*a[15]+a[8]*a[7]*a[13]+a[12]*a[5]*a[11]-a[12]*a[7]*a[9],
   -a[0]*a[9]*a[15]+a[0]*a[11]*a[13]+a[8]*a[1]*a[15]-a[8]*a[3]*a[13]-a[12]*a[1]*a[11]+a[12]*a[3]*a[9],
    a[0]*a[5]*a[15]-a[0]*a[7]*a[13]-a[4]*a[1]*a[15]+a[4]*a[3]*a[13]+a[12]*a[1]*a[7]-a[12]*a[3]*a[5],
   -a[0]*a[5]*a[11]+a[0]*a[7]*a[9]+a[4]*a[1]*a[11]-a[4]*a[3]*a[9]-a[8]*a[1]*a[7]+a[8]*a[3]*a[5],
   -a[4]*a[9]*a[14]+a[4]*a[10]*a[13]+a[8]*a[5]*a[14]-a[8]*a[6]*a[13]-a[12]*a[5]*a[10]+a[12]*a[6]*a[9],
    a[0]*a[9]*a[14]-a[0]*a[10]*a[13]-a[8]*a[1]*a[14]+a[8]*a[2]*a[13]+a[12]*a[1]*a[10]-a[12]*a[2]*a[9],
   -a[0]*a[5]*a[14]+a[0]*a[6]*a[13]+a[4]*a[1]*a[14]-a[4]*a[2]*a[13]-a[12]*a[1]*a[6]+a[12]*a[2]*a[5],
    a[0]*a[5]*a[10]-a[0]*a[6]*a[9]-a[4]*a[1]*a[10]+a[4]*a[2]*a[9]+a[8]*a[1]*a[6]-a[8]*a[2]*a[5]];
  let det=a[0]*inv[0]+a[1]*inv[4]+a[2]*inv[8]+a[3]*inv[12];
  if(!det) return ident();
  det=1/det;
  for(let i=0;i<16;i++) o[i]=inv[i]*det;
  return o;
}
/* Euler XYZ in degrees, the order FBX writes a PreRotation in */
function euler(x,y,z){
  const d=Math.PI/180; x*=d; y*=d; z*=d;
  const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
  const X=new Float64Array([1,0,0,0, 0,cx,sx,0, 0,-sx,cx,0, 0,0,0,1]);
  const Y=new Float64Array([cy,0,-sy,0, 0,1,0,0, sy,0,cy,0, 0,0,0,1]);
  const Z=new Float64Array([cz,sz,0,0, -sz,cz,0,0, 0,0,1,0, 0,0,0,1]);
  return mul(mul(Z,Y),X);            // FBX eEulerXYZ applies X, then Y, then Z
}
/* a matrix back into the translation / rotation / scale glTF stores */
function decompose(m){
  const t=[m[12],m[13],m[14]];
  const sx=Math.hypot(m[0],m[1],m[2]), sy=Math.hypot(m[4],m[5],m[6]), sz=Math.hypot(m[8],m[9],m[10]);
  const r=[m[0]/sx,m[1]/sx,m[2]/sx, m[4]/sy,m[5]/sy,m[6]/sy, m[8]/sz,m[9]/sz,m[10]/sz];
  const tr=r[0]+r[4]+r[8];
  let q;
  if(tr>0){ const s=Math.sqrt(tr+1)*2; q=[(r[5]-r[7])/s,(r[6]-r[2])/s,(r[1]-r[3])/s,0.25*s]; }
  else if(r[0]>r[4]&&r[0]>r[8]){ const s=Math.sqrt(1+r[0]-r[4]-r[8])*2;
    q=[0.25*s,(r[3]+r[1])/s,(r[6]+r[2])/s,(r[5]-r[7])/s]; }
  else if(r[4]>r[8]){ const s=Math.sqrt(1+r[4]-r[0]-r[8])*2;
    q=[(r[3]+r[1])/s,0.25*s,(r[7]+r[5])/s,(r[6]-r[2])/s]; }
  else { const s=Math.sqrt(1+r[8]-r[0]-r[4])*2;
    q=[(r[6]+r[2])/s,(r[7]+r[5])/s,0.25*s,(r[1]-r[3])/s]; }
  const n=Math.hypot(q[0],q[1],q[2],q[3])||1;
  return { t, r:[q[0]/n,q[1]/n,q[2]/n,q[3]/n], s:[sx,sy,sz] };
}

/* -------------------------------------------------------------- read it */
function convert(IN, OUT, opts){
  /* Everything is divided by this on the way out and it goes on the scene
     root instead, so the rendered size is unchanged and the stored numbers
     match the clips and the other characters. */
  const S=(opts&&opts.scale)||100;
  const {root}=parse(IN);
  const objs=kid(root,'Objects');
  const byId=new Map();
  for(const o of objs.children) byId.set(o.props[0], o);

  /* OO connections are child→parent. OP ones point at a property and are
     how animation is attached; nothing here needs them.

     A BONE HAS MORE THAN ONE PARENT IN THIS FILE, which is the trap. It
     is connected to the bone above it in the skeleton AND to the cluster
     that skins it — same kind of connection, opposite meanings. One map
     with the last writer winning gives every skinned bone a cluster for
     a parent and a skeleton thirty-three roots wide, which still loads,
     still draws, and falls apart the moment anything moves. So the
     skeleton link is the one where BOTH ends are Models, and it is kept
     apart from everything else. */
  const kindOf=id=>{ const o=byId.get(id); return o?o.name:null; };
  const parentOf=new Map(), childrenOf=new Map(), linkTo=new Map();
  for(const c of kid(root,'Connections').children){
    if(c.props[0]!=='OO') continue;
    const [,child,parent]=c.props;
    if(!childrenOf.has(parent)) childrenOf.set(parent,[]);
    childrenOf.get(parent).push(child);
    if(kindOf(child)==='Model' && kindOf(parent)==='Model') parentOf.set(child, parent);
    else linkTo.set(child, parent);          // a bone to its cluster, a cluster to its skin
  }
  const nameOf=o=>String(o.props[1]).split('\0')[0];
  const prop=(o,which)=>{
    const p=kid(o,'Properties70'); if(!p) return null;
    const e=p.children.find(x=>x.props[0]===which);
    return e ? e.props.slice(4) : null;
  };

  const geo=kids(objs,'Geometry')[0];
  const V=Float64Array.from(kid(geo,'Vertices').props[0], v=>v/S);
  const PVI=kid(geo,'PolygonVertexIndex').props[0];
  const nv=V.length/3;

  /* triangles. FBX ends each polygon by flipping the sign of its last
     index, so ~i is the real one. Anything that is not a triangle is
     fanned, which is right for the convex polygons an exporter emits. */
  const tris=[];
  let poly=[];
  for(let i=0;i<PVI.length;i++){
    let v=PVI[i], last=false;
    if(v<0){ v=~v; last=true; }
    poly.push(v);
    if(last){ for(let k=2;k<poly.length;k++) tris.push(poly[0],poly[k-1],poly[k]); poly=[]; }
  }

  /* ------------------------------------------------------------ normals
     Area-weighted: the cross product of two edges is already twice the
     face area, so not normalising it before it is added is the weighting. */
  const N=new Float64Array(nv*3);
  for(let f=0;f<tris.length;f+=3){
    const a=tris[f]*3,b=tris[f+1]*3,c=tris[f+2]*3;
    const ux=V[b]-V[a], uy=V[b+1]-V[a+1], uz=V[b+2]-V[a+2];
    const wx=V[c]-V[a], wy=V[c+1]-V[a+1], wz=V[c+2]-V[a+2];
    const nx=uy*wz-uz*wy, ny=uz*wx-ux*wz, nz=ux*wy-uy*wx;
    for(const at of [a,b,c]){ N[at]+=nx; N[at+1]+=ny; N[at+2]+=nz; }
  }
  for(let i=0;i<nv;i++){
    const L=Math.hypot(N[i*3],N[i*3+1],N[i*3+2])||1;
    N[i*3]/=L; N[i*3+1]/=L; N[i*3+2]/=L;
  }

  /* ------------------------------------------------------------- the rig */
  const bones=kids(objs,'Model').filter(m=>m.props[2]!=='Mesh');
  const meshModel=kids(objs,'Model').find(m=>m.props[2]==='Mesh');
  const clusters=kids(objs,'Deformer').filter(d=>d.props[2]==='Cluster');

  /* every cluster names the one bone it drives, and carries that bone's
     world matrix at bind time */
  const linkOf=new Map(), clusterBone=new Map();   // bone -> cluster, and back
  for(const cl of clusters){
    const boneId=(childrenOf.get(cl.props[0])||[]).find(id=>kindOf(id)==='Model');
    if(boneId!==undefined){ linkOf.set(boneId, cl); clusterBone.set(cl, boneId); }
  }
  const world=new Map();             // bone id -> world matrix at bind time
  for(const [id,cl] of linkOf){
    const tl=kid(cl,'TransformLink');
    if(!tl) continue;
    const m=new Float64Array(tl.props[0]);
    m[12]/=S; m[13]/=S; m[14]/=S;    // the mesh shrank; the skeleton with it
    world.set(id, m);
  }
  /* a bone with no cluster skins nothing; its own translation and
     pre-rotation are all anybody will ever ask of it */
  function ownLocal(m){
    const t=prop(m,'Lcl Translation')||[0,0,0];
    const pre=prop(m,'PreRotation');
    const M=pre?euler(pre[0],pre[1],pre[2]):ident();
    M[12]=t[0]/S; M[13]=t[1]/S; M[14]=t[2]/S;
    return M;
  }
  const order=[];                    // bones, parents before children
  {
    const seen=new Set();
    const boneIds=new Set(bones.map(b=>b.props[0]));
    const visit=id=>{
      if(seen.has(id)) return; seen.add(id);
      order.push(id);
      for(const c of (childrenOf.get(id)||[])) if(boneIds.has(c)) visit(c);
    };
    for(const b of bones){
      const p=parentOf.get(b.props[0]);
      if(!boneIds.has(p)) visit(b.props[0]);   // a root of the skeleton
    }
    for(const b of bones) visit(b.props[0]);   // anything left over
  }
  /* fill in the world matrix of every bone that has none, walking down */
  for(const id of order){
    if(world.has(id)) continue;
    const p=parentOf.get(id);
    const pw=world.get(p)||ident();
    world.set(id, mul(pw, ownLocal(byId.get(id))));
  }

  const boneIndex=new Map();
  order.forEach((id,i)=>boneIndex.set(id,i));

  /* ------------------------------------------------------------ weights
     Four influences is what a glTF vertex holds and what the game's
     shader reads; keeping the largest four and renormalising is the
     standard trade and is invisible at this size. */
  const infl=Array.from({length:nv},()=>[]);
  for(const cl of clusters){
    const boneId=clusterBone.get(cl);
    if(boneId===undefined) continue;
    const j=boneIndex.get(boneId);
    const ix=kid(cl,'Indexes'), wt=kid(cl,'Weights');
    if(!ix||!wt) continue;
    const I=ix.props[0], W=wt.props[0];
    for(let k=0;k<I.length;k++) if(W[k]>0) infl[I[k]].push([j,W[k]]);
  }
  const J=new Uint16Array(nv*4), Wt=new Float32Array(nv*4);
  let orphan=0;
  for(let v=0;v<nv;v++){
    const list=infl[v].sort((a,b)=>b[1]-a[1]).slice(0,4);
    if(!list.length){ orphan++; J[v*4]=0; Wt[v*4]=1; continue; }
    let sum=0; for(const [,w] of list) sum+=w;
    list.forEach(([j,w],k)=>{ J[v*4+k]=j; Wt[v*4+k]=w/sum; });
  }

  /* --------------------------------------------------------- write it out */
  const nodes=[], joints=[];
  order.forEach((id,i)=>{
    const p=parentOf.get(id);
    const local = boneIndex.has(p)
      ? mul(invert(world.get(p)), world.get(id))
      : world.get(id);
    const d=decompose(local);
    nodes.push({ name:nameOf(byId.get(id)),
                 translation:[...d.t], rotation:[...d.r], scale:[...d.s] });
    joints.push(i);
  });
  order.forEach((id,i)=>{
    const ch=(childrenOf.get(id)||[]).filter(c=>boneIndex.has(c)).map(c=>boneIndex.get(c));
    if(ch.length) nodes[i].children=ch;
  });
  const meshNode=nodes.length;
  /* `geometry_0` is what the other characters call theirs, and an FBX's
     own name for it is whatever the artist left in the outliner — this
     one says "unamed". Nothing reads the name, but a folder of models
     that agree on it is easier to look at than one that does not. */
  nodes.push({ name:'geometry_0', mesh:0, skin:0 });
  const roots=order.filter(id=>!boneIndex.has(parentOf.get(id))).map(id=>boneIndex.get(id));
  /* ONE ROOT OVER THE LOT, carrying the scale — the mesh node and the top
     of the skeleton both hang off it, which is what keeps skinning right
     while it is scaled: the vertices and the bones move together. */
  const rootNode=nodes.length;
  nodes.push({ name:'RootNode', scale:[S,S,S], children:[meshNode, ...roots] });

  /* inverse bind: the world matrix at bind time, undone */
  const IBM=new Float32Array(order.length*16);
  order.forEach((id,i)=>{ const inv=invert(world.get(id));
    for(let k=0;k<16;k++) IBM[i*16+k]=inv[k]; });

  const chunks=[]; let at=0;
  const put=(buf)=>{ const p=(4-(at%4))%4; if(p){ chunks.push(Buffer.alloc(p)); at+=p; }
                     const off=at; chunks.push(buf); at+=buf.length; return off; };
  const g={ asset:{version:'2.0', generator:'fbx2glb.js'},
            scene:0, scenes:[{nodes:[rootNode]}],
            nodes, bufferViews:[], accessors:[],
            materials:[{ name:'DefaultMaterial',
              pbrMetallicRoughness:{ baseColorFactor:[1,1,1,1], metallicFactor:0, roughnessFactor:0.9 } }],
            meshes:[{ primitives:[{ attributes:{}, indices:0, material:0 }] }],
            skins:[{ joints, skeleton:roots[0] }] };
  const view=(buf,target)=>{ const off=put(buf);
    g.bufferViews.push({buffer:0, byteOffset:off, byteLength:buf.length, ...(target?{target}:{})});
    return g.bufferViews.length-1; };
  const acc=(desc)=>{ g.accessors.push(desc); return g.accessors.length-1; };

  const ibuf=Buffer.alloc(tris.length*4);
  tris.forEach((v,i)=>ibuf.writeUInt32LE(v, i*4));
  g.meshes[0].primitives[0].indices=acc({ bufferView:view(ibuf,34963), componentType:5125,
                                          count:tris.length, type:'SCALAR' });
  const pbuf=Buffer.alloc(nv*12), nbuf=Buffer.alloc(nv*12);
  const mn=[Infinity,Infinity,Infinity], mx=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<nv;i++) for(let k=0;k<3;k++){
    const v=V[i*3+k]; pbuf.writeFloatLE(v, i*12+k*4); nbuf.writeFloatLE(N[i*3+k], i*12+k*4);
    if(v<mn[k])mn[k]=v; if(v>mx[k])mx[k]=v;
  }
  const A=g.meshes[0].primitives[0].attributes;
  A.POSITION=acc({ bufferView:view(pbuf,34962), componentType:5126, count:nv, type:'VEC3', min:mn, max:mx });
  A.NORMAL  =acc({ bufferView:view(nbuf,34962), componentType:5126, count:nv, type:'VEC3' });
  const jbuf=Buffer.alloc(nv*8), wbuf=Buffer.alloc(nv*16);
  for(let i=0;i<nv*4;i++){ jbuf.writeUInt16LE(J[i], i*2); wbuf.writeFloatLE(Wt[i], i*4); }
  A.JOINTS_0 =acc({ bufferView:view(jbuf,34962), componentType:5123, count:nv, type:'VEC4' });
  A.WEIGHTS_0=acc({ bufferView:view(wbuf,34962), componentType:5126, count:nv, type:'VEC4' });
  const mbuf=Buffer.alloc(order.length*64);
  for(let i=0;i<IBM.length;i++) mbuf.writeFloatLE(IBM[i], i*4);
  g.skins[0].inverseBindMatrices=acc({ bufferView:view(mbuf), componentType:5126,
                                       count:order.length, type:'MAT4' });

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
    'verts', nv, 'tris', tris.length/3, 'bones', order.length,
    'root scale', S, orphan?('UNWEIGHTED '+orphan):'all weighted');
}

if(require.main===module)
  convert(process.argv[2], process.argv[3], { scale:+(process.argv[4]||100) });
module.exports={convert};
