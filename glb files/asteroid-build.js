/* Turn a photogrammetry asteroid scan into a game rock.

   The source is a 1.19M-triangle Draco-compressed scan with nothing on it
   but positions — no normals, no UVs, no material.  Flight lays down
   dozens of rocks per wall, so it has to come down by three orders of
   magnitude, and it has to arrive with a colour baked into it because
   there is no texture to hang one on.

   decode -> weld -> cluster-decimate -> facet -> paint -> .glb

   Vertex clustering rather than edge collapse: a scan like this is full of
   non-manifold junk that stops a QEM simplifier dead, and clustering does
   not care.  It also lumps the silhouette in a way that suits a rock.

   node asteroid-build.js <in.gltf> <out.glb> [cells=26]
*/
const fs = require('fs'), path = require('path');
const draco3d = require('draco3d');

const IN = process.argv[2], OUT = process.argv[3], CELLS = +(process.argv[4] || 26);

/* ---------------------------------------------------------------- decode */
async function decode(file){
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bin = fs.readFileSync(path.join(path.dirname(file), j.buffers[0].uri));
  const dec = await draco3d.createDecoderModule({});
  const parts = [];
  for(const p of j.meshes[0].primitives){
    const dr = p.extensions && p.extensions.KHR_draco_mesh_compression;
    if(!dr) throw new Error('primitive is not draco; this script only reads draco');
    const bv = j.bufferViews[dr.bufferView];
    const buf = new Int8Array(bin.buffer, bin.byteOffset + (bv.byteOffset||0), bv.byteLength);

    const db = new dec.DecoderBuffer(); db.Init(buf, buf.length);
    const d = new dec.Decoder();
    const mesh = new dec.Mesh();
    const st = d.DecodeBufferToMesh(db, mesh);
    if(!st.ok()) throw new Error('draco decode failed: ' + st.error_msg());

    const attr = d.GetAttributeByUniqueId(mesh, dr.attributes.POSITION);
    const pa = new dec.DracoFloat32Array();
    d.GetAttributeFloatForAllPoints(mesh, attr, pa);
    const n = mesh.num_points();
    const pos = new Float32Array(n * 3);
    for(let i = 0; i < n * 3; i++) pos[i] = pa.GetValue(i);

    const nf = mesh.num_faces();
    const idx = new Uint32Array(nf * 3);
    const fa = new dec.DracoInt32Array();
    for(let f = 0; f < nf; f++){
      d.GetFaceFromMesh(mesh, f, fa);
      idx[f*3] = fa.GetValue(0); idx[f*3+1] = fa.GetValue(1); idx[f*3+2] = fa.GetValue(2);
    }
    parts.push({ pos, idx });
    dec.destroy(pa); dec.destroy(fa); dec.destroy(mesh); dec.destroy(d); dec.destroy(db);
  }
  // one mesh out of the primitives, indices shifted past the vertices before them
  let vn = 0, fn = 0;
  parts.forEach(p => { vn += p.pos.length/3; fn += p.idx.length/3; });
  const pos = new Float32Array(vn*3), idx = new Uint32Array(fn*3);
  let vo = 0, io = 0;
  for(const p of parts){
    pos.set(p.pos, vo*3);
    for(let i = 0; i < p.idx.length; i++) idx[io+i] = p.idx[i] + vo;
    vo += p.pos.length/3; io += p.idx.length;
  }
  return { pos, idx };
}

/* --------------------------------------------------------------- shrink */
/* Every vertex falls in one cell of a grid over the bounding box, and the
   cell's average position stands in for all of them.  Triangles whose
   corners end up in the same cell have collapsed to nothing and go. */
function cluster(pos, idx, cells){
  let mnx=1e9,mny=1e9,mnz=1e9,mxx=-1e9,mxy=-1e9,mxz=-1e9;
  for(let i=0;i<pos.length;i+=3){
    if(pos[i]<mnx)mnx=pos[i]; if(pos[i]>mxx)mxx=pos[i];
    if(pos[i+1]<mny)mny=pos[i+1]; if(pos[i+1]>mxy)mxy=pos[i+1];
    if(pos[i+2]<mnz)mnz=pos[i+2]; if(pos[i+2]>mxz)mxz=pos[i+2];
  }
  const sx=(mxx-mnx)||1, sy=(mxy-mny)||1, sz=(mxz-mnz)||1;
  const cellOf = i => {
    const cx=Math.min(cells-1, Math.floor((pos[i*3]-mnx)/sx*cells));
    const cy=Math.min(cells-1, Math.floor((pos[i*3+1]-mny)/sy*cells));
    const cz=Math.min(cells-1, Math.floor((pos[i*3+2]-mnz)/sz*cells));
    return (cx*cells + cy)*cells + cz;
  };
  const sum = new Map();                       // cell -> [x,y,z,count]
  const n = pos.length/3;
  const cellFor = new Int32Array(n);
  for(let i=0;i<n;i++){
    const c = cellOf(i); cellFor[i] = c;
    let s = sum.get(c); if(!s){ s=[0,0,0,0]; sum.set(c,s); }
    s[0]+=pos[i*3]; s[1]+=pos[i*3+1]; s[2]+=pos[i*3+2]; s[3]++;
  }
  const order = new Map(); const out = [];
  for(const [c,s] of sum){ order.set(c, out.length/3|0); out.push(s[0]/s[3], s[1]/s[3], s[2]/s[3]); }
  const tris = [];
  for(let f=0; f<idx.length; f+=3){
    const a=order.get(cellFor[idx[f]]), b=order.get(cellFor[idx[f+1]]), c=order.get(cellFor[idx[f+2]]);
    if(a===b || b===c || a===c) continue;       // collapsed into one cell
    tris.push(a,b,c);
  }
  return { pos: new Float32Array(out), idx: new Uint32Array(tris) };
}

/* Clustering leaves the outer shell plus whatever interior the scan had.
   Only the shell is ever seen, so keep the biggest connected piece and drop
   the rest — it is free triangles back. */
function biggestShell(pos, idx){
  const n = pos.length/3;
  const adj = Array.from({length:n}, () => []);
  for(let f=0; f<idx.length; f+=3){
    const a=idx[f],b=idx[f+1],c=idx[f+2];
    adj[a].push(b,c); adj[b].push(a,c); adj[c].push(a,b);
  }
  const grp = new Int32Array(n).fill(-1);
  let g = 0, sizes = [];
  for(let s=0;s<n;s++){
    if(grp[s] !== -1) continue;
    let count = 0; const stack=[s]; grp[s]=g;
    while(stack.length){
      const v = stack.pop(); count++;
      for(const w of adj[v]) if(grp[w] === -1){ grp[w] = g; stack.push(w); }
    }
    sizes.push(count); g++;
  }
  let best = 0; for(let i=1;i<sizes.length;i++) if(sizes[i] > sizes[best]) best = i;
  if(sizes.length === 1) return { pos, idx };
  const map = new Int32Array(n).fill(-1); const out = [];
  for(let i=0;i<n;i++) if(grp[i] === best){ map[i] = out.length/3|0; out.push(pos[i*3],pos[i*3+1],pos[i*3+2]); }
  const tris = [];
  for(let f=0; f<idx.length; f+=3)
    if(map[idx[f]] !== -1) tris.push(map[idx[f]], map[idx[f+1]], map[idx[f+2]]);
  console.log(`  shells: ${sizes.length}, kept the one with ${sizes[best]} vertices`);
  return { pos: new Float32Array(out), idx: new Uint32Array(tris) };
}

/* Centre on the origin and scale so the rock is one unit across its widest
   axis — flight.js asks for a radius and expects to multiply by it. */
function normalise(pos){
  let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
  for(let i=0;i<pos.length;i+=3) for(let k=0;k<3;k++){
    if(pos[i+k]<mn[k]) mn[k]=pos[i+k];
    if(pos[i+k]>mx[k]) mx[k]=pos[i+k];
  }
  const c = mn.map((v,k)=>(v+mx[k])/2);
  const span = Math.max(mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]) || 1;
  const s = 2/span;                            // radius 1, so rock(r) scales by r
  for(let i=0;i<pos.length;i+=3) for(let k=0;k<3;k++) pos[i+k] = (pos[i+k]-c[k])*s;
}

/* ---------------------------------------------------------------- facets */
/* Three fresh vertices per triangle carrying the face's own normal: a rock
   wants hard facets, and hard facets cannot share vertices. */
function facet(pos, idx){
  const nf = idx.length/3;
  const P = new Float32Array(nf*9), N = new Float32Array(nf*9);
  for(let f=0; f<nf; f++){
    const a=idx[f*3]*3, b=idx[f*3+1]*3, c=idx[f*3+2]*3;
    const ax=pos[a],ay=pos[a+1],az=pos[a+2];
    const bx=pos[b],by=pos[b+1],bz=pos[b+2];
    const cx=pos[c],cy=pos[c+1],cz=pos[c+2];
    let nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay);
    let ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az);
    let nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
    const L=Math.hypot(nx,ny,nz)||1; nx/=L; ny/=L; nz/=L;
    const o=f*9;
    P[o]=ax;P[o+1]=ay;P[o+2]=az; P[o+3]=bx;P[o+4]=by;P[o+5]=bz; P[o+6]=cx;P[o+7]=cy;P[o+8]=cz;
    for(let k=0;k<3;k++){ N[o+k*3]=nx; N[o+k*3+1]=ny; N[o+k*3+2]=nz; }
  }
  return { pos:P, nrm:N };
}

/* ----------------------------------------------------------------- paint */
/* No reference photo and no UVs, so the colour has to be derived.  The
   first attempt derived it from the shape — how far a facet sticks out and
   which way it faces — and on a body this round that is nearly the same
   number everywhere, so the rock came out a uniform pale beige.

   So the shape is the SECOND term now, and noise is the first: layered
   fBm for the mottling, craters punched in with bright rims for the
   landmarks, iron in the low ground.  The shape term only nudges what the
   noise already decided, which is enough to keep the shading agreeing with
   the silhouette instead of fighting it. */
const ROCK_LOW  = [0.115, 0.100, 0.098];       // the floor of a crater
const ROCK_MID  = [0.335, 0.305, 0.280];       // the body of it
const ROCK_HIGH = [0.640, 0.615, 0.570];       // dust on a lit ridge
const IRON      = [0.300, 0.190, 0.135];       // rust in the low ground

const mix = (a,b,t) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

// a fixed seed, so two runs of this script produce the same rock
let _s = 0x2f6e2b1;
function rnd(){ _s ^= _s<<13; _s ^= _s>>>17; _s ^= _s<<5; return ((_s>>>0)/4294967296); }

// cheap value noise; enough to mottle a rock, not worth a real simplex
function noise(x,y,z){
  return (Math.sin(x*1.7 + Math.cos(y*1.3)*2.1)
        * Math.sin(y*2.3 + Math.cos(z*1.9)*1.7)
        * Math.sin(z*1.1 + Math.cos(x*2.7)*1.3) + 1) / 2;
}
function fbm(x,y,z,oct){
  let v=0, amp=0.5, f=1, norm=0;
  for(let i=0;i<oct;i++){ v += noise(x*f, y*f, z*f)*amp; norm += amp; amp*=0.5; f*=2.17; }
  return v/norm;
}

/* Craters, scattered over the sphere of directions.  Each one darkens its
   floor and lifts a rim, which is what actually makes a grey ball read as
   a rock rather than as a pebble. */
function craters(n){
  const out=[];
  for(let i=0;i<n;i++){
    const z=rnd()*2-1, a=rnd()*Math.PI*2, s=Math.sqrt(1-z*z);
    out.push({ d:[s*Math.cos(a), s*Math.sin(a), z],
               // a few big ones and many small, the way real fields fall
               r: 0.13 + Math.pow(rnd(), 2.4)*0.42,
               deep: 0.45 + rnd()*0.5 });
  }
  return out;
}

function paint(P, N){
  const nv = P.length/3, C = new Float32Array(nv*4), nf = nv/3;

  // per-facet centre, normal and radius, plus the stats to judge them by
  const cen = new Float32Array(nf*3), rad = new Float32Array(nf);
  let mean = 0;
  for(let f=0; f<nf; f++){
    const o=f*9;
    const cx=(P[o]+P[o+3]+P[o+6])/3, cy=(P[o+1]+P[o+4]+P[o+7])/3, cz=(P[o+2]+P[o+5]+P[o+8])/3;
    cen[f*3]=cx; cen[f*3+1]=cy; cen[f*3+2]=cz;
    rad[f]=Math.hypot(cx,cy,cz); mean+=rad[f];
  }
  mean /= nf;
  let varr = 0;
  for(let f=0; f<nf; f++){ const d=rad[f]-mean; varr += d*d; }
  const sd = Math.sqrt(varr/nf) || 1;          // so "proud" means proud FOR THIS ROCK

  const pits = craters(16);

  for(let f=0; f<nf; f++){
    const o=f*9;
    const cx=cen[f*3], cy=cen[f*3+1], cz=cen[f*3+2], r=rad[f]||1;
    const nx=N[o], ny=N[o+1], nz=N[o+2];

    /* THE MOTTLE, and the frequency of it is the whole trick.  The rock is
       about thirty facets across, so noise with features finer than about
       four facets cannot be sampled — it aliases, and comes back as a
       checkerboard of light and dark triangles that reads as camouflage
       rather than as stone.  Three octaves off a low base stays under
       that limit; the fourth octave and the fine grit layer that used to
       be here were both entirely above it. */
    let e = fbm(cx*1.5, cy*1.5, cz*1.5, 3);
    e = 0.5 + (e-0.5)*1.7;                     // push it off the middle

    /* the shape, nudging: a facet standing proud of the mean radius and
       facing outward catches light; one tipped into a hollow does not */
    const outward = (cx*nx + cy*ny + cz*nz) / r;
    const proud = Math.max(-2, Math.min(2, (r-mean)/sd));
    e += proud*0.075 + (outward-1)*0.30;

    /* craters, cut after the mottle so they sit ON the rock */
    let rim = 0;
    for(const p of pits){
      const dot = (cx*p.d[0] + cy*p.d[1] + cz*p.d[2]) / r;
      const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
      if(ang > p.r) continue;
      const t = ang/p.r;                       // 0 at the centre, 1 at the lip
      e -= p.deep * (1-t*t) * 0.75;            // the floor drops away
      rim = Math.max(rim, Math.max(0, (t-0.72)/0.28) * p.deep);   // the lip catches
    }
    e += rim*0.5;
    e = clamp01(e);

    let col = e < 0.5 ? mix(ROCK_LOW, ROCK_MID, e*2) : mix(ROCK_MID, ROCK_HIGH, (e-0.5)*2);

    // a seam of iron in the low ground, patchy so it is not a stripe
    const rust = Math.max(0, fbm(cx*4.4, cy*4.4, cz*4.4, 2) - 0.52) * 2.6 * Math.max(0, 0.60-e);
    if(rust > 0) col = mix(col, IRON, Math.min(0.75, rust));

    // and a last slow wobble, off the grid the mottle uses, so the two
    // patterns do not line up into bands
    const j = 0.93 + noise(cx*2.9+11, cy*2.9, cz*2.9) * 0.14;
    for(let k=0;k<3;k++){
      const i=(f*3+k)*4;
      C[i]=clamp01(col[0]*j); C[i+1]=clamp01(col[1]*j); C[i+2]=clamp01(col[2]*j); C[i+3]=1;
    }
  }
  return C;
}

/* ------------------------------------------------------------- write glb */
function pad4(n){ return (4 - (n % 4)) % 4; }
function writeGLB(file, P, N, C){
  const bufs = [P, N, C].map(a => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  const views = []; const accs = []; let off = 0;
  const spec = [
    { a:P, comps:3, name:'POSITION' },
    { a:N, comps:3, name:'NORMAL'   },
    { a:C, comps:4, name:'COLOR_0'  }
  ];
  spec.forEach((s,i) => {
    views.push({ buffer:0, byteOffset:off, byteLength:bufs[i].length, target:34962 });
    const acc = { bufferView:i, componentType:5126, count:s.a.length/s.comps,
                  type: s.comps===3 ? 'VEC3' : 'VEC4' };
    if(s.name === 'POSITION'){                 // POSITION must carry its bounds
      const mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
      for(let k=0;k<s.a.length;k+=3) for(let t=0;t<3;t++){
        if(s.a[k+t]<mn[t]) mn[t]=s.a[k+t];
        if(s.a[k+t]>mx[t]) mx[t]=s.a[k+t];
      }
      acc.min=mn; acc.max=mx;
    }
    accs.push(acc);
    off += bufs[i].length + pad4(bufs[i].length);
  });
  const bin = Buffer.alloc(off); let p = 0;
  bufs.forEach(b => { b.copy(bin, p); p += b.length + pad4(b.length); });

  const json = {
    asset:{ version:'2.0', generator:'asteroid-build.js' },
    scene:0, scenes:[{ nodes:[0] }], nodes:[{ mesh:0, name:'Asteroid' }],
    meshes:[{ name:'Asteroid', primitives:[{ attributes:{ POSITION:0, NORMAL:1, COLOR_0:2 }, material:0 }] }],
    /* baseColorFactor white, because glTF multiplies it INTO the vertex
       colours and anything else would tint the paint. */
    materials:[{ name:'rock', pbrMetallicRoughness:{ baseColorFactor:[1,1,1,1],
                 metallicFactor:0, roughnessFactor:1 } }],
    accessors:accs, bufferViews:views, buffers:[{ byteLength:bin.length }]
  };
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  js = Buffer.concat([js, Buffer.alloc(pad4(js.length), 0x20)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0);  jh.writeUInt32LE(0x4E4F534A, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, jh, js, bh, bin]));
}

(async () => {
  const src = await decode(IN);
  console.log(`in:      ${src.pos.length/3} verts, ${src.idx.length/3} tris`);
  let m = cluster(src.pos, src.idx, CELLS);
  console.log(`cluster: ${m.pos.length/3} verts, ${m.idx.length/3} tris  (${CELLS}^3 grid)`);
  m = biggestShell(m.pos, m.idx);
  console.log(`shell:   ${m.pos.length/3} verts, ${m.idx.length/3} tris`);
  normalise(m.pos);
  const f = facet(m.pos, m.idx);
  const C = paint(f.pos, f.nrm);
  writeGLB(OUT, f.pos, f.nrm, C);
  const kb = (fs.statSync(OUT).size/1024).toFixed(1);
  console.log(`out:     ${OUT}  ${f.pos.length/9} tris, ${kb} kB`);
})();
