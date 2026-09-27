/* =====================================================================
   THE LIFE IN WANO'S OCEAN (ocean.js is the water and the ground).

   Every animal here is made in code — no models, no downloads — out of
   stretched spheres, flat fins and a few cylinders, painted by where on
   the body a point is: a clownfish's white bands are "is z near a
   quarter of the length", a whale shark's spots are a hash of the grid.

   ONE DRAW CALL PER SPECIES. A species is one InstancedMesh, however many
   of it there are, and the swimming is done on the graphics card: every
   vertex carries how much it bends (aBend — nothing at the nose, all of
   it at the tail tip) and every animal carries its own phase, and the
   vertex shader waves the body. A fish wags side to side, a whale and a
   dolphin pump up and down, a manta flaps from the wing tips in, a
   jellyfish squeezes its bell and trails its tentacles, kelp and eels
   sway from the root up, a crab's legs step. The CPU only moves each
   animal along its path, which is cheap, and only while you are near.

   WHERE THINGS LIVE follows the real sea: reef fish round the coral
   heads on the shelf, seahorses in the kelp, turtles and rays over the
   sand, sharks and tuna and the whale shark in open water over the deep,
   whales further down, lanternfish and anglerfish and the giant squid in
   the rift, tube worms on the hot vents at the very bottom.

   FINDING THEM is the game: the first time you swim close to a species
   it is named on the screen with how many of the whole list you have
   found (kept in the progress bag under 'ocean').
   ===================================================================== */
window.SEALIFE = (function(){
  const V = (x,y,z)=>new THREE.Vector3(x||0,y||0,z||0);
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp = (a,b,t)=>a+(b-a)*t;
  let O = null, group = null, clock = 0;
  const kinds = [];                 // every species: { id, name, icon, mesh, items, update, near }
  const TAU = Math.PI*2;

  /* ============================================================ the kit
     A part is a geometry, a colour (a hex, or a function of the vertex),
     a glow and a bend. merge() bakes a list of parts into one geometry
     with position, normal, colour, aGlow and aBend. */
  const M = (x,y,z, rx,ry,rz, sx,sy,sz) => new THREE.Matrix4().compose(V(x,y,z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0, ry||0, rz||0)), V(sx??1, sy??sx??1, sz??sx??1));
  function merge(parts){
    const list = parts.map(p=>{ let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(); if(p.m) g.applyMatrix4(p.m);
      if(!g.attributes.normal) g.computeVertexNormals(); return [g, p]; });
    const n = list.reduce((s,[g])=>s + g.attributes.position.count, 0);
    const pos = new Float32Array(n*3), nor = new Float32Array(n*3), col = new Float32Array(n*3), glow = new Float32Array(n), bend = new Float32Array(n);
    const c = new THREE.Color(), v = V(); let o = 0;
    for(const [g, p] of list){
      const A = g.attributes.position, N = g.attributes.normal;
      for(let i=0;i<A.count;i++, o++){
        v.fromBufferAttribute(A, i);
        pos[o*3] = v.x; pos[o*3+1] = v.y; pos[o*3+2] = v.z;
        nor[o*3] = N.getX(i); nor[o*3+1] = N.getY(i); nor[o*3+2] = N.getZ(i);
        c.setHex(typeof p.color==='function' ? p.color(v) : (p.color ?? 0xffffff));
        col[o*3] = c.r; col[o*3+1] = c.g; col[o*3+2] = c.b;
        glow[o] = typeof p.glow==='function' ? p.glow(v) : (p.glow||0);
        bend[o] = typeof p.bend==='function' ? p.bend(v) : (p.bend||0);
      }
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
    geo.setAttribute('aBend', new THREE.BufferAttribute(bend, 1));
    geo.computeBoundingSphere();
    return geo;
  }
  /* a stretched sphere along z, thinning towards the tail by `taper` */
  function body(len, h, w, taper, seg, nose){
    const g = new THREE.SphereGeometry(1, seg||14, Math.max(6, Math.round((seg||14)*0.7)));
    const P = g.attributes.position;
    for(let i=0;i<P.count;i++){
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      const k = z < 0 ? 1 + z*(taper ?? 0.55) : 1 - z*z*(nose ?? 0.12);
      P.setXYZ(i, x*w/2*k, y*h/2*k, z*len/2);
    }
    g.computeVertexNormals(); return g;
  }
  /* a flat fin, both faces, as a fan from its first point */
  function fin(pts){
    const a = [];
    for(let i=1;i<pts.length-1;i++){ a.push(...pts[0], ...pts[i], ...pts[i+1], ...pts[0], ...pts[i+1], ...pts[i]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); g.computeVertexNormals(); return g;
  }
  const ball = (r, s) => new THREE.SphereGeometry(r, s||8, Math.max(5, Math.round((s||8)*0.7)));
  const cyl = (r1, r2, h, s) => new THREE.CylinderGeometry(r1, r2, h, s||8);
  const cone = (r, h, s) => new THREE.ConeGeometry(r, h, s||8);
  const hashf = (a, b) => { let h = Math.imul(Math.floor(a)|0, 374761393) + Math.imul(Math.floor(b)|0, 668265263); h = Math.imul(h ^ (h>>>13), 1274126177); return ((h ^ (h>>>16))>>>0)/4294967295; };
  /* the usual fish: body, forked tail, dorsal, anal and pectoral fins, eyes */
  function fishGeo(o){
    const L = o.len, H = o.h, W = o.w, parts = [];
    const bend = v => Math.pow(clamp((L*0.3 - v.z)/(L*0.95), 0, 1), 1.4);
    parts.push({ geo:body(L, H, W, o.taper, o.seg, o.nose), color:o.col, bend, glow:o.glow });
    const tz = -L*0.44, th = H*(o.tail ?? 0.6), tl = L*(o.tailLen ?? 0.26), fk = o.fork ?? 0.45;
    parts.push({ geo:fin([[0,0,tz+L*0.05],[0,th,tz-tl],[0,0,tz-tl*fk],[0,-th,tz-tl]]), color:o.finCol ?? o.col, bend });
    if(o.dorsal){ const a = o.dorsalAt ?? 0.12, dl = o.dorsalLen ?? 0.35;
      parts.push({ geo:fin([[0,H*0.4,L*a],[0,H*0.4+H*o.dorsal,L*(a-dl*0.35)],[0,H*0.3,L*(a-dl)]]), color:o.dorsalCol ?? o.finCol ?? o.col, bend }); }
    if(o.anal) parts.push({ geo:fin([[0,-H*0.38,-L*0.02],[0,-H*0.38-H*o.anal,-L*0.14],[0,-H*0.3,-L*0.3]]), color:o.finCol ?? o.col, bend });
    if(o.pect) [-1,1].forEach(s=>parts.push({ geo:fin([[s*W*0.4,-H*0.08,L*0.2],[s*(W*0.4+L*o.pect),-H*0.22,L*0.04],[s*W*0.38,-H*0.14,L*0.07]]), color:o.finCol ?? o.col, bend:0.08 }));
    const er = o.eye ?? Math.min(H, W)*0.16, es = L < 0.6 ? 5 : 8;          // small fish, small eyes: fewer faces
    [-1,1].forEach(s=>{ parts.push({ geo:ball(er*1.3, es), m:M(s*W*0.4, H*0.1, L*0.32), color:o.eyeRing ?? 0xf2f2e8 });
                        parts.push({ geo:ball(er*0.8, es), m:M(s*(W*0.4+er*0.8), H*0.1, L*0.32+er*0.3), color:0x0a0a0a }); });
    if(o.extra) o.extra(parts, bend);
    return merge(parts);
  }

  /* ============================================== the material
     MeshStandardMaterial with vertex colours, and a vertex shader that
     moves the body. `mode` picks how it moves. */
  const MOVE = {
    swim:   'transformed.x += sin(ph - position.z*uK) * uAmp * aBend;',
    swimV:  'transformed.y += sin(ph - position.z*uK) * uAmp * aBend;',
    flap:   'transformed.y += sin(ph - abs(position.x)*uK) * uAmp * aBend;',
    paddle: 'transformed.y += sin(ph + sign(position.x)*0.4) * uAmp * aBend; transformed.z += cos(ph) * uAmp * 0.7 * aBend;',
    pulse:  'float pp = 0.5 + 0.5*sin(ph); transformed.xz *= 1.0 - uAmp*pp*aBend;'
          + ' if(position.y < 0.0){ float d = -position.y; transformed.x += sin(ph*0.6 + d*uK)*0.18*d; transformed.z += cos(ph*0.5 + d*uK)*0.15*d; }',
    arms:   'transformed.y += sin(ph + length(position.xz)*uK) * uAmp * aBend; transformed.xz *= 1.0 + 0.1*sin(ph*0.5)*aBend;',
    squid:  'transformed.x += sin(ph + position.z*uK) * uAmp * aBend; transformed.y += cos(ph*0.9 + position.z*uK) * uAmp * 0.6 * aBend;',
    sway:   'transformed.x += sin(ph + position.y*uK) * uAmp * aBend; transformed.z += cos(ph*0.8 + position.y*uK*0.7) * uAmp * 0.7 * aBend;',
    crawl:  'transformed.y += max(0.0, sin(ph + position.x*9.0 + position.z*5.0)) * uAmp * aBend;',
    none:   ''
  };
  function seaMat(mode, o){
    o = o || {};
    const m = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:o.rough ?? 0.55, metalness:o.metal ?? 0.08,
      transparent:!!o.opacity, opacity:o.opacity ?? 1, depthWrite:!o.opacity, side:o.side ?? THREE.FrontSide });
    const u = { uTime:{ value:0 }, uAmp:{ value:o.amp ?? 0.1 }, uFreq:{ value:o.freq ?? 6 }, uK:{ value:o.k ?? 3 }, uGlow:{ value:o.glow ?? 1.6 } };
    m.userData.u = u;
    m.onBeforeCompile = sh=>{
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime, uAmp, uFreq, uK;\nattribute float aPhase;\nattribute float aGlow;\nattribute float aBend;\nvarying float vGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;\nfloat ph = uTime*uFreq + aPhase;\n' + (MOVE[mode] || ''));
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uGlow;\nvarying float vGlow;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * uGlow;');
    };
    m.customProgramCacheKey = () => 'sea:' + mode;
    return m;
  }

  /* ========================================================== placing
     An animal at map point (x, y, z), nose along (hx, hy, hz), at a size. */
  const _p = V(), _q = V(), _f = V(), _u = V(), _r = V(), _s = V(), _m = new THREE.Matrix4();
  function put(mesh, i, x, y, z, hx, hy, hz, s, roll, sy){
    O.toWorld(x, y, z, _p);
    O.toWorld(x + hx*0.5, y + hy*0.5, z + hz*0.5, _q); _f.subVectors(_q, _p);
    if(_f.lengthSq() < 1e-12) _f.set(1, 0, 0);
    _f.normalize();
    _u.copy(_p).normalize(); _u.addScaledVector(_f, -_u.dot(_f));
    if(_u.lengthSq() < 1e-8) _u.set(0, 1, 0); _u.normalize();
    if(roll) _u.applyAxisAngle(_f, roll);
    _r.crossVectors(_u, _f).normalize();
    _m.makeBasis(_r, _u, _f); _m.scale(_s.set(s, sy ?? s, s)); _m.setPosition(_p);
    mesh.setMatrixAt(i, _m);
  }
  function herd(spec, geo, count){
    const mat = seaMat(spec.mode, spec.mat);
    const ph = new Float32Array(count); for(let i=0;i<count;i++) ph[i] = Math.random()*50;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false; mesh.name = spec.id;
    if(spec.tints){ const c = new THREE.Color(); for(let i=0;i<count;i++){ c.setHex(spec.tints[i%spec.tints.length]); mesh.setColorAt(i, c); } }
    group.add(mesh);
    return mesh;
  }

  /* ======================================================== the ground
     Helpers for where things may go. */
  const R = () => O.R;
  function spotIn(test, tries){
    for(let k=0;k<(tries||400);k++){
      const a = O.rand()*TAU, r = Math.sqrt(O.rand())*R()*0.92, x = Math.cos(a)*r, z = Math.sin(a)*r;
      const D = O.depth(x, z);
      if(test(x, z, D)) return { x, z, D };
    }
    return null;
  }
  const nearZone = (zn, x, z, k) => Math.hypot(x-zn.x, z-zn.z) < zn.r*(k||1);
  function inRift(x, z){
    const line = O.rift; let best = 1e9;
    for(let i=0;i<line.length-1;i++){ const a = line[i], c = line[i+1], ex = c.x-a.x, ez = c.z-a.z, L2 = ex*ex+ez*ez;
      const t = clamp(((x-a.x)*ex + (z-a.z)*ez)/L2, 0, 1); best = Math.min(best, Math.hypot(x-(a.x+ex*t), z-(a.z+ez*t))); }
    return best;
  }
  /* A closed loop through open water in a zone, for things that cruise.
     Points are sorted round the zone's middle so the loop does not cross
     itself, and each is kept clear of the bottom and the surface. */
  function loop(cx, cz, rMin, rMax, dMin, dMax, n){
    const pts = [];
    for(let i=0;i<n;i++){
      const a = i/n*TAU + (O.rand()-0.5)*0.5, r = lerp(rMin, rMax, O.rand()), x = cx + Math.cos(a)*r, z = cz + Math.sin(a)*r;
      const floor = O.bed(x, z), d = lerp(dMin, dMax, O.rand());
      pts.push(V(x, clamp(O.SEA - d, floor + 3, O.SEA - 1.2), z));
    }
    return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  }
  /* keep a swimmer between the bottom and the top where it actually is */
  const keepIn = (x, y, z, clear, top) => clamp(y, O.bed(x, z) + (clear ?? 1), O.SEA - (top ?? 0.8));

  /* ======================================================== behaviours */
  /* CRUISE: spread along a loop, each at its own lane offset. */
  function cruise(k, curve, speed, opt){
    opt = opt || {};
    const len = curve.getLength(), n = k.mesh.count;
    k.items = Array.from({ length:n }, (_, i)=>({ t:i/n + O.rand()*0.02, off:V((O.rand()-0.5)*(opt.spread||0), (O.rand()-0.5)*(opt.spreadY||0), 0),
                                                   y:null, s:opt.scale ? opt.scale[i%opt.scale.length] : 1 }));
    const P = V(), T = V();
    k.update = dt=>{
      k.items.forEach((a, i)=>{
        a.t = (a.t + speed*dt/len) % 1;
        curve.getPointAt(a.t, P); curve.getTangentAt(a.t, T);
        const x = P.x + T.z*a.off.x, z = P.z - T.x*a.off.x;
        let y = P.y + a.off.y;
        if(opt.leap){ const l = Math.sin(clock*0.9 + i*1.7); if(l > 0.8) y = O.SEA - 0.8 + (l-0.8)*14; }
        const want = keepIn(x, y, z, opt.clear ?? 2, opt.leap ? -3 : opt.top);
        a.y = a.y===null ? want : a.y + (want-a.y)*Math.min(1, dt*2);
        put(k.mesh, i, x, a.y, z, T.x, T.y*0.6 + (want-a.y)*0.3, T.z, a.s, opt.roll ? Math.sin(clock*0.7+i)*opt.roll : 0);
      });
    };
    k.centre = ()=>{ curve.getPointAt(k.items[0].t, P); return P; };
  }
  /* SCHOOL: a centre that travels a loop, and every fish circling it on
     its own tilted ring — a bait ball when the rings are small and fast. */
  function school(k, curve, speed, ring, opt){
    opt = opt || {};
    const len = curve.getLength(), n = k.mesh.count, C = V(), T = V();
    k.items = Array.from({ length:n }, ()=>({ a:O.rand()*TAU, r:lerp(ring[0], ring[1], O.rand()), h:(O.rand()-0.5)*(opt.tall||3),
                                              w:(opt.spin||1.2)*(0.8+O.rand()*0.4)*(O.rand()<(opt.flip||0) ? -1 : 1), tilt:(O.rand()-0.5)*0.6 }));
    let t = O.rand();
    k.update = dt=>{
      t = (t + speed*dt/len) % 1; curve.getPointAt(t, C); curve.getTangentAt(t, T);
      k.items.forEach((f, i)=>{
        f.a += f.w*dt/Math.max(0.5, f.r);
        const ca = Math.cos(f.a), sa = Math.sin(f.a);
        const x = C.x + ca*f.r + T.x*opt.lead, z = C.z + sa*f.r + T.z*opt.lead, y = keepIn(x, C.y + f.h + Math.sin(f.a*2)*f.r*f.tilt, z, 1.2);
        const sgn = Math.sign(f.w);
        put(k.mesh, i, x, y, z, -sa*sgn + T.x*0.3, Math.cos(f.a*2)*f.tilt*0.5, ca*sgn + T.z*0.3, opt.size||1);
      });
    };
    k.centre = ()=>C;
    opt.lead = opt.lead || 0;
  }
  /* REEF: each fish on its own small figure-of-eight round a home on the
     coral, a metre or three off the bottom. */
  function reef(k, homes, size){
    const n = k.mesh.count;
    k.items = Array.from({ length:n }, (_, i)=>{ const h = homes[i%homes.length];
      return { x:h.x + (O.rand()-0.5)*3, z:h.z + (O.rand()-0.5)*3, rx:1.5+O.rand()*3, rz:1+O.rand()*2.5, w:0.25+O.rand()*0.35, p:O.rand()*TAU, up:0.8+O.rand()*2.5 }; });
    k.update = dt=>{
      k.items.forEach((f, i)=>{
        f.p += f.w*dt;
        const x = f.x + Math.sin(f.p)*f.rx, z = f.z + Math.sin(f.p*2)*f.rz*0.5;
        const hx = Math.cos(f.p)*f.rx, hz = Math.cos(f.p*2)*f.rz;
        const y = keepIn(x, O.bed(x, z) + f.up + Math.sin(f.p*3)*0.3, z, 0.4);
        put(k.mesh, i, x, y, z, hx, 0, hz, size||1);
      });
    };
    k.centre = ()=>V(k.items[0].x, 0, k.items[0].z);
  }
  /* BOTTOM: walking or gliding over the ground, turning now and then. */
  function bottom(k, starts, speed, lift, opt){
    opt = opt || {};
    const n = k.mesh.count;
    k.items = Array.from({ length:n }, (_, i)=>{ const s = starts[i%starts.length];
      return { x:s.x, z:s.z, hx:0, hz:1, a:O.rand()*TAU, turn:0, pause:O.rand()*3, home:s, s:opt.scale ? lerp(opt.scale[0], opt.scale[1], O.rand()) : 1 }; });
    k.update = dt=>{
      k.items.forEach((a, i)=>{
        if(a.pause > 0){ a.pause -= dt; }
        else {
          a.turn += (O.rand()-0.5)*dt*1.5; a.turn *= 0.98; a.a += a.turn*dt;
          const nx = a.x + Math.cos(a.a)*speed*dt, nz = a.z + Math.sin(a.a)*speed*dt;
          const D = O.depth(nx, nz);
          if(D < (opt.minD ?? 1) || D > (opt.maxD ?? 99) || Math.hypot(nx-a.home.x, nz-a.home.z) > (opt.roam ?? 10)){ a.a += Math.PI*0.6; }
          else { a.x = nx; a.z = nz; }
          if(O.rand() < dt*0.08) a.pause = 1 + O.rand()*3;
        }
        const y = O.bed(a.x, a.z) + lift*a.s;
        put(k.mesh, i, a.x, y, a.z, Math.cos(a.a), 0, Math.sin(a.a), a.s);
      });
    };
    k.centre = ()=>V(k.items[0].x, 0, k.items[0].z);
  }
  /* DRIFT: jellies, hanging in the water and rising and falling slowly. */
  function drift(k, homes, band){
    const n = k.mesh.count;
    k.items = Array.from({ length:n }, (_, i)=>{ const h = homes[i%homes.length];
      return { x:h.x + (O.rand()-0.5)*14, z:h.z + (O.rand()-0.5)*14, y:O.SEA - lerp(band[0], band[1], O.rand()), p:O.rand()*TAU, s:0.7+O.rand()*0.6 }; });
    k.update = dt=>{
      k.items.forEach((j, i)=>{
        j.p += dt*0.2; j.x += Math.cos(j.p*0.7)*dt*0.15; j.z += Math.sin(j.p*0.5)*dt*0.15;
        const y = keepIn(j.x, j.y + Math.sin(j.p)*1.5, j.z, 2, 1);
        put(k.mesh, i, j.x, y, j.z, Math.cos(j.p*0.3), 0, Math.sin(j.p*0.3), j.s);   // upright: the bell is the model's own +y
      });
    };
    k.centre = ()=>V(k.items[0].x, 0, k.items[0].z);
  }
  /* FIXED: sat on the ground, where they are put, once. */
  function fixed(k, spots, lift, scale){
    k.items = spots.map(s=>({ x:s.x, z:s.z, a:O.rand()*TAU, s:scale ? lerp(scale[0], scale[1], O.rand()) : 1 }));
    k.items.forEach((a, i)=>{ const y = O.bed(a.x, a.z) + lift*a.s; put(k.mesh, i, a.x, y, a.z, Math.cos(a.a), 0, Math.sin(a.a), a.s); });
    k.mesh.instanceMatrix.needsUpdate = true;
    k.still = true;
    k.centre = ()=>V(k.items[0].x, 0, k.items[0].z);
  }
  const many = (n, test, tries) => { const a = []; for(let i=0;i<n;i++){ const s = spotIn(test, tries); if(s) a.push(s); } return a; };

  /* ======================================================= the animals
     Each entry: what it is called, its picture, how it is built, how it
     moves, and where it lives. Sizes are metres. */
  const SPECIES = [];
  function sp(id, name, icon, make){ SPECIES.push({ id, name, icon, make }); }

  /* ---------------------------------------------------- reef fish */
  sp('clownfish', 'Clownfish', '🐠', ()=>{
    const L = 0.34, geo = fishGeo({ len:L, h:0.17, w:0.09, dorsal:0.35, anal:0.3, pect:0.12, tail:0.55, fork:0.9,
      col:v=>{ const z = v.z/L; return (Math.abs(z-0.2)<0.05 || Math.abs(z+0.04)<0.05 || Math.abs(z+0.33)<0.04) ? 0xffffff : 0xff6a10; },
      finCol:0xff7a20 });
    return { geo, mode:'swim', mat:{ amp:0.03, freq:14, k:18 }, count:18, place:k=>reef(k, anemones, 1) };
  });
  sp('bluetang', 'Blue tang', '🐟', ()=>{
    const L = 0.5, geo = fishGeo({ len:L, h:0.3, w:0.08, dorsal:0.2, dorsalLen:0.7, dorsalAt:0.25, anal:0.2, pect:0.12, tail:0.55, fork:0.6,
      col:v=>v.z < -L*0.34 ? 0xffd21f : (v.y > 0.02 && v.z > -L*0.25 && v.z < L*0.15 && Math.abs(v.y-0.06) < 0.035) ? 0x0b1440 : 0x1f5fe8,
      finCol:0x13307a, dorsalCol:0x13307a });
    return { geo, mode:'swim', mat:{ amp:0.04, freq:10, k:12 }, count:24, place:k=>reef(k, reefHomes, 1) };
  });
  sp('yellowtang', 'Yellow tang', '🐟', ()=>{
    const L = 0.42, geo = fishGeo({ len:L, h:0.3, w:0.07, dorsal:0.25, dorsalLen:0.7, dorsalAt:0.25, anal:0.25, pect:0.1, tail:0.5, fork:0.9,
      col:v=>v.z < -L*0.4 ? 0xfff3a0 : 0xffe01a, finCol:0xffd400 });
    return { geo, mode:'swim', mat:{ amp:0.04, freq:10, k:12 }, count:24, place:k=>reef(k, reefHomes, 1) };
  });
  sp('angelfish', 'Emperor angelfish', '🐠', ()=>{
    const L = 0.55, geo = fishGeo({ len:L, h:0.42, w:0.08, dorsal:0.25, dorsalLen:0.75, dorsalAt:0.2, anal:0.25, pect:0.1, tail:0.45, fork:0.95,
      col:v=>v.z > L*0.28 ? 0x0a1a40 : Math.sin(v.y*60 + v.z*20) > 0.2 ? 0xffe23a : 0x1a3fc0, finCol:0xffcc20 });
    return { geo, mode:'swim', mat:{ amp:0.03, freq:8, k:10 }, count:12, place:k=>reef(k, reefHomes, 1) };
  });
  sp('parrotfish', 'Parrotfish', '🐟', ()=>{
    const L = 0.85, geo = fishGeo({ len:L, h:0.32, w:0.16, dorsal:0.18, dorsalLen:0.7, anal:0.15, pect:0.14, tail:0.6, fork:0.7, nose:0.25,
      col:v=>v.z > L*0.38 ? 0xf5f0e0 : hashf(v.x*18+30, v.z*18+v.y*18) > 0.72 ? 0xff7ab8 : 0x2ad4a8, finCol:0x7ae070 });
    return { geo, mode:'swim', mat:{ amp:0.05, freq:7, k:7 }, count:10, place:k=>reef(k, reefHomes, 1) };
  });
  sp('butterflyfish', 'Butterflyfish', '🐠', ()=>{
    const L = 0.34, geo = fishGeo({ len:L, h:0.3, w:0.05, dorsal:0.25, dorsalLen:0.7, dorsalAt:0.15, anal:0.25, pect:0.1, tail:0.4, fork:0.95, nose:0.4,
      col:v=>(v.z > L*0.22 && v.z < L*0.3) ? 0x101010 : (v.y > 0.05 || v.z < -L*0.2) ? 0xffd21f : 0xf8f8f0, finCol:0xffd21f });
    return { geo, mode:'swim', mat:{ amp:0.03, freq:11, k:14 }, count:18, place:k=>reef(k, reefHomes, 1) };
  });
  sp('pufferfish', 'Pufferfish', '🐡', ()=>{
    const L = 0.55, geo = fishGeo({ len:L, h:0.4, w:0.38, taper:0.4, nose:0.05, pect:0.14, tail:0.4, fork:0.95, eye:0.07,
      col:v=>hashf(v.x*30+50, v.y*30+v.z*30) > 0.8 ? 0x3a2a10 : v.y < -0.05 ? 0xf5f0dc : 0xd8b860, finCol:0xe0c070,
      extra:(parts)=>{ for(let i=0;i<40;i++){ const a = i*2.4, b = Math.acos(1-2*(i+0.5)/40), d = V(Math.sin(b)*Math.cos(a), Math.cos(b), Math.sin(b)*Math.sin(a));
        if(d.z < -0.6) continue; parts.push({ geo:cone(0.012, 0.05, 4), m:new THREE.Matrix4().compose(V(d.x*0.19, d.y*0.2, d.z*0.27), new THREE.Quaternion().setFromUnitVectors(V(0,1,0), d), V(1,1,1)), color:0xf0e0a0 }); } } });
    return { geo, mode:'swim', mat:{ amp:0.03, freq:6, k:6 }, count:5, puffer:true, place:k=>reef(k, reefHomes.slice(0, 5), 1) };
  });

  /* ---------------------------------------------------- schooling fish */
  sp('sardine', 'Sardines', '🐟', ()=>{
    const L = 0.34, geo = fishGeo({ len:L, h:0.08, w:0.05, dorsal:0.3, pect:0.08, tail:0.6, seg:10,
      col:v=>v.y > 0.012 ? 0x2c5a8c : v.y > -0.006 ? 0x9fc4e8 : 0xe8f0f8, finCol:0x8aa0b8 });
    return { geo, mode:'swim', mat:{ amp:0.025, freq:16, k:20, metal:0.5, rough:0.3 }, count:170,
      place:k=>school(k, loop(O.DC.x, O.DC.z, O.RD*0.2, O.RD*0.55, 12, 20, 6), 1.2, [1.5, 6], { tall:5, spin:2.6, size:1 }) };
  });
  sp('tuna', 'Yellowfin tuna', '🐟', ()=>{
    const L = 1.8, geo = fishGeo({ len:L, h:0.42, w:0.32, dorsal:0.5, dorsalAt:0.05, dorsalLen:0.25, anal:0.5, pect:0.25, tail:0.95, tailLen:0.22, fork:0.2, taper:0.75,
      col:v=>v.y > 0.05 ? 0x10204a : Math.abs(v.y) < 0.03 && v.z < 0.3 ? 0xd8c040 : 0xd8e0ea, finCol:0xf0c830, dorsalCol:0xf0c830 });
    return { geo, mode:'swim', mat:{ amp:0.1, freq:9, k:2.5, metal:0.4, rough:0.3 }, count:16,
      place:k=>cruise(k, loop(O.DC.x, O.DC.z, O.RD*0.5, O.RD*0.75, 8, 14, 7), 7, { spread:9, spreadY:4 }) };
  });
  sp('barracuda', 'Barracuda', '🐟', ()=>{
    const L = 1.5, geo = fishGeo({ len:L, h:0.18, w:0.14, dorsal:0.6, dorsalAt:-0.05, dorsalLen:0.15, anal:0.5, pect:0.12, tail:0.9, fork:0.3, nose:0.02, taper:0.6,
      col:v=>v.y > 0 && Math.sin(v.z*16) > 0.55 ? 0x4a5868 : 0xc8d4de, finCol:0x6a7888 });
    return { geo, mode:'swim', mat:{ amp:0.05, freq:5, k:3, metal:0.5, rough:0.3 }, count:14,
      place:k=>{ const w = wallSpot(); school(k, loop(w.x, w.z, 2, 6, 10, 14, 4), 0.6, [1, 5], { tall:3, spin:0.7, flip:0 }); } };
  });
  sp('lanternfish', 'Lanternfish', '✨', ()=>{
    const L = 0.22, geo = fishGeo({ len:L, h:0.06, w:0.04, pect:0.08, tail:0.6, seg:8, eye:0.018,
      col:0x1a2433, finCol:0x223040,
      extra:parts=>{ for(let i=0;i<5;i++) parts.push({ geo:ball(0.008, 4), m:M(0, -0.024, L*(0.25-i*0.11)), color:0x6fe8ff, glow:1 }); } });
    return { geo, mode:'swim', mat:{ amp:0.02, freq:14, k:25, glow:3 }, count:90,
      place:k=>school(k, riftLoop(40, 55), 1.5, [2, 9], { tall:6, spin:1.2 }) };
  });

  /* ------------------------------------------------------ open water */
  sp('reefshark', 'Reef shark', '🦈', ()=>{
    const L = 2.4, geo = fishGeo({ len:L, h:0.42, w:0.4, dorsal:0.95, dorsalAt:0.08, dorsalLen:0.22, anal:0.3, pect:0.33, tail:1.1, tailLen:0.26, fork:0.25, taper:0.7, nose:0.35, eye:0.03,
      col:v=>v.y < -0.06 ? 0xe8ecef : 0x6f7c88, finCol:v=>v.y > 0.55 || v.y < -0.5 ? 0x202428 : 0x6f7c88 });
    return { geo, mode:'swim', mat:{ amp:0.14, freq:3, k:1.6 }, count:4,
      place:k=>cruise(k, loop(0, 0, O.R*0.45, O.R*0.62, 5, 9, 9), 3.2, { spread:14, spreadY:3, clear:2.5 }) };
  });
  sp('hammerhead', 'Hammerhead shark', '🦈', ()=>{
    const L = 3.5, geo = fishGeo({ len:L, h:0.55, w:0.5, dorsal:1.4, dorsalAt:0.1, dorsalLen:0.2, anal:0.35, pect:0.35, tail:1.1, tailLen:0.27, fork:0.25, taper:0.7, nose:0.4, eye:0.001,
      col:v=>v.y < -0.1 ? 0xe0e2e0 : 0x7c7f78, finCol:0x707368,
      extra:parts=>{ parts.push({ geo:new THREE.BoxGeometry(1.1, 0.1, 0.32), m:M(0, 0.03, L*0.5), color:0x7c7f78 });
                     [-1,1].forEach(s=>parts.push({ geo:ball(0.045, 6), m:M(s*0.56, 0.05, L*0.5), color:0x0a0a0a })); } });
    return { geo, mode:'swim', mat:{ amp:0.16, freq:2.4, k:1.1 }, count:3,
      place:k=>cruise(k, loop(O.DC.x, O.DC.z, O.RD*0.3, O.RD*0.7, 14, 24, 8), 3, { spread:10, spreadY:4 }) };
  });
  sp('whaleshark', 'Whale shark', '🦈', ()=>{
    const L = 10, geo = fishGeo({ len:L, h:1.7, w:2.0, dorsal:0.9, dorsalAt:-0.02, dorsalLen:0.16, anal:0.2, pect:0.26, tail:1.3, tailLen:0.24, fork:0.35, taper:0.72, nose:0.02, eye:0.07,
      col:v=>{ if(v.y < -0.3) return 0xe8eef2; const s = hashf(v.z*2.2+100, v.x*2.2 + v.y*2.2); return s > 0.86 ? 0xf0f4f8 : (Math.abs(Math.sin(v.z*1.6)) < 0.08 ? 0x9fb4c8 : 0x2b3f5a); },
      finCol:0x2b3f5a,
      extra:parts=>parts.push({ geo:new THREE.BoxGeometry(1.4, 0.08, 0.4), m:M(0, -0.25, L*0.49), color:0x101a28 }) });
    return { geo, mode:'swim', mat:{ amp:0.45, freq:0.9, k:0.45 }, count:1,
      place:k=>cruise(k, loop(O.DC.x, O.DC.z, O.RD*0.25, O.RD*0.55, 6, 12, 7), 1.4, { clear:5 }) };
  });
  sp('humpback', 'Humpback whale', '🐋', ()=>{
    const L = 14, parts = [];
    const bend = v => Math.pow(clamp((L*0.2 - v.z)/(L*0.85), 0, 1), 1.5);
    parts.push({ geo:body(L, 2.6, 2.9, 0.78, 18, 0.15), bend,
      col:v=>v.y < -0.4 ? (Math.sin(v.x*14) > 0.3 && v.z > 0 ? 0xc8ccd0 : 0xe8ecef) : hashf(v.x*3+7, v.z*3) > 0.95 ? 0xb8c0c8 : 0x1c2230 });
    parts.push({ geo:fin([[0,0,-L*0.42],[L*0.2,0.05,-L*0.6],[0,0,-L*0.53],[-L*0.2,0.05,-L*0.6]]), color:0x1c2230, bend });
    [-1,1].forEach(s=>parts.push({ geo:fin([[s*1.3,-0.5,L*0.22],[s*(1.3+L*0.3),-1.2,L*0.02],[s*(1.3+L*0.28),-1.1,-L*0.05],[s*1.2,-0.6,L*0.08]]), color:0xe0e4e8, bend:0.15 }));
    parts.push({ geo:fin([[0,1.1,-L*0.18],[0,1.6,-L*0.24],[0,1.05,-L*0.28]]), color:0x1c2230, bend });
    [-1,1].forEach(s=>parts.push({ geo:ball(0.1, 6), m:M(s*1.35, -0.1, L*0.36), color:0x050505 }));
    return { geo:merge(parts), mode:'swimV', mat:{ amp:0.8, freq:0.6, k:0.25 }, count:2, scale:[1, 0.45],
      place:k=>cruise(k, loop(O.DC.x, O.DC.z, O.RD*0.2, O.RD*0.5, 18, 28, 6), 1.8, { scale:[1, 0.45], spread:12, clear:6 }) };
  });
  sp('orca', 'Orca', '🐋', ()=>{
    const L = 6.5, parts = [];
    const bend = v => Math.pow(clamp((L*0.2 - v.z)/(L*0.85), 0, 1), 1.5);
    parts.push({ geo:body(L, 1.4, 1.5, 0.75, 16, 0.2), bend,
      col:v=>(v.y < -0.2 || (v.z > L*0.28 && v.z < L*0.38 && v.y > 0.05 && Math.abs(v.x) > 0.4)) ? 0xf6f6f6 : (v.z < 0 && v.z > -L*0.1 && v.y > 0.55) ? 0xa8b0b8 : 0x0c0c10 });
    parts.push({ geo:fin([[0,0,-L*0.42],[L*0.14,0.05,-L*0.58],[0,0,-L*0.52],[-L*0.14,0.05,-L*0.58]]), color:0x0c0c10, bend });
    parts.push({ geo:fin([[0,0.6,L*0.05],[0,2.0,-L*0.02],[0,0.6,-L*0.12]]), color:0x0c0c10, bend });
    [-1,1].forEach(s=>parts.push({ geo:fin([[s*0.6,-0.3,L*0.25],[s*1.6,-0.7,L*0.1],[s*0.6,-0.35,L*0.1]]), color:0x0c0c10, bend:0.1 }));
    return { geo:merge(parts), mode:'swimV', mat:{ amp:0.45, freq:1.4, k:0.5 }, count:2,
      place:k=>cruise(k, loop(O.DC.x, O.DC.z, O.RD*0.55, O.RD*0.8, 4, 8, 7), 5, { spread:6, clear:4 }) };
  });
  sp('dolphin', 'Dolphins', '🐬', ()=>{
    const L = 2.4, parts = [];
    const bend = v => Math.pow(clamp((L*0.2 - v.z)/(L*0.85), 0, 1), 1.4);
    parts.push({ geo:body(L, 0.5, 0.5, 0.75, 14, 0.2), bend, col:v=>v.y < -0.06 ? 0xe4eaf0 : v.y < 0.08 ? 0xa0b0c0 : 0x6a7c90 });
    parts.push({ geo:cyl(0.05, 0.1, 0.3, 8), m:M(0, -0.04, L*0.55, Math.PI/2), color:0x8a9aac });
    parts.push({ geo:fin([[0,0,-L*0.44],[L*0.18,0,-L*0.58],[0,0,-L*0.52],[-L*0.18,0,-L*0.58]]), color:0x6a7c90, bend });
    parts.push({ geo:fin([[0,0.22,L*0.02],[0,0.55,-L*0.12],[0,0.2,-L*0.18]]), color:0x5a6c80, bend });
    [-1,1].forEach(s=>parts.push({ geo:fin([[s*0.2,-0.1,L*0.22],[s*0.5,-0.25,L*0.08],[s*0.2,-0.12,L*0.1]]), color:0x6a7c90, bend:0.1 }));
    [-1,1].forEach(s=>parts.push({ geo:ball(0.03, 6), m:M(s*0.2, 0.05, L*0.36), color:0x050505 }));
    return { geo:merge(parts), mode:'swimV', mat:{ amp:0.12, freq:5, k:1.8 }, count:5,
      place:k=>cruise(k, loop(0, 0, O.R*0.35, O.R*0.6, 1.5, 3, 8), 7, { spread:5, spreadY:1, leap:true, clear:2 }) };
  });
  sp('swordfish', 'Swordfish', '🗡', ()=>{
    const L = 3, geo = fishGeo({ len:L, h:0.5, w:0.4, dorsal:1.3, dorsalAt:0.2, dorsalLen:0.18, anal:0.4, pect:0.25, tail:1.2, tailLen:0.22, fork:0.2, taper:0.75, nose:0.3, eye:0.05,
      col:v=>v.y < -0.05 ? 0xd8dee4 : 0x2a3a5a, finCol:0x2a3a5a,
      extra:parts=>parts.push({ geo:cone(0.05, 1.2, 6), m:M(0, 0, L*0.5+0.55, Math.PI/2), color:0x3a4a6a }) });
    return { geo, mode:'swim', mat:{ amp:0.12, freq:4, k:1.5 }, count:2,
      place:k=>cruise(k, loop(O.DC.x, O.DC.z, O.RD*0.4, O.RD*0.75, 10, 20, 6), 9, { spread:8, spreadY:5 }) };
  });
  sp('manta', 'Manta ray', '🐟', ()=>{
    const S = 5, parts = [];
    const wing = v => Math.pow(clamp(Math.abs(v.x)/(S/2), 0, 1), 1.5);
    const g = new THREE.SphereGeometry(1, 20, 8); const P = g.attributes.position;
    for(let i=0;i<P.count;i++){ const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ax = Math.abs(x);
      P.setXYZ(i, x*S/2, y*0.35*(1-ax*0.8), z*1.3*(1 - ax*0.55) - ax*ax*0.9); }
    g.computeVertexNormals();
    parts.push({ geo:g, bend:wing, col:v=>v.y < 0 ? 0xeef2f5 : (Math.abs(v.x) < 0.9 && v.z > 0.2 && v.y > 0.1 ? 0x2a2e36 : 0x14181e) });
    [-1,1].forEach(s=>parts.push({ geo:fin([[s*0.45,0,1.2],[s*0.35,-0.05,1.75],[s*0.6,0,1.25]]), color:0x14181e, bend:0.05 }));
    parts.push({ geo:cyl(0.03, 0.005, 2.2, 5), m:M(0, 0, -2.2, Math.PI/2), color:0x14181e, bend:0 });
    return { geo:merge(parts), mode:'flap', mat:{ amp:0.8, freq:1.5, k:0.8, side:THREE.DoubleSide }, count:3,
      place:k=>cruise(k, loop(0, 0, O.R*0.5, O.R*0.65, 4, 8, 8), 2.2, { spread:20, spreadY:2, roll:0.15, clear:2.5 }) };
  });
  sp('stingray', 'Blue-spotted stingray', '🐟', ()=>{
    const S = 1.3, parts = [];
    const g = new THREE.SphereGeometry(1, 16, 6); const P = g.attributes.position;
    for(let i=0;i<P.count;i++){ const x = P.getX(i), y = P.getY(i), z = P.getZ(i); P.setXYZ(i, x*S/2, y*0.09, z*S/2*0.9); }
    g.computeVertexNormals();
    parts.push({ geo:g, bend:v=>Math.pow(clamp(Math.abs(v.x)/(S/2), 0, 1), 2), col:v=>v.y < 0 ? 0xf0ece0 : hashf(v.x*16+40, v.z*16) > 0.82 ? 0x3ab4ff : 0xb8a07a });
    parts.push({ geo:cyl(0.03, 0.006, 1.2, 5), m:M(0, 0, -S*0.45-0.55, Math.PI/2), color:0x8a7050 });
    [-1,1].forEach(s=>parts.push({ geo:ball(0.03, 6), m:M(s*0.08, 0.07, S*0.25), color:0xffe060 }));
    return { geo:merge(parts), mode:'flap', mat:{ amp:0.1, freq:2.2, k:2 }, count:5,
      place:k=>bottom(k, many(5, (x,z,D)=>D > 2 && D < 10), 0.35, 0.15, { minD:1.5, maxD:14, roam:20 }) };
  });
  sp('turtle', 'Green sea turtle', '🐢', ()=>{
    const parts = [];
    const shell = new THREE.SphereGeometry(0.55, 14, 8, 0, TAU, 0, Math.PI/2); shell.scale(1, 0.55, 1.25);
    parts.push({ geo:shell, color:v=>{ const s = hashf(v.x*9+20, v.z*9); return s > 0.75 ? 0x9a7040 : 0x5a3c22; } });
    const belly = new THREE.CircleGeometry(0.55, 14); belly.rotateX(Math.PI/2); belly.scale(1, 1, 1.25);
    parts.push({ geo:belly, color:0xd8c89a });
    parts.push({ geo:ball(0.17, 10), m:M(0, 0.05, 0.78, 0, 0, 0, 1, 0.9, 1.3), color:0x8a8a4a });
    [-1,1].forEach(s=>parts.push({ geo:ball(0.025, 6), m:M(s*0.11, 0.1, 0.9), color:0x101010 }));
    [-1,1].forEach(s=>{
      parts.push({ geo:fin([[s*0.4,0,0.35],[s*1.15,-0.02,0.05],[s*1.05,-0.02,-0.05],[s*0.45,0,0.1]]), color:0x7a7a40, bend:v=>clamp((Math.abs(v.x)-0.4)/0.7, 0, 1) });
      parts.push({ geo:fin([[s*0.3,0,-0.5],[s*0.55,-0.02,-0.85],[s*0.35,0,-0.75]]), color:0x7a7a40, bend:0.3 });
    });
    return { geo:merge(parts), mode:'paddle', mat:{ amp:0.28, freq:2.2 }, count:4,
      place:k=>cruise(k, loop(0, 0, O.R*0.4, O.R*0.6, 2.5, 6, 9), 1.3, { spread:18, spreadY:2, clear:1.5 }) };
  });

  /* ---------------------------------------------------- on the bottom */
  sp('octopus', 'Octopus', '🐙', ()=>{
    const parts = [];
    parts.push({ geo:body(0.7, 0.55, 0.5, 0.2, 12, 0.3), m:M(0, 0.35, -0.12, -0.5), color:0xd8582a });
    [-1,1].forEach(s=>{ parts.push({ geo:ball(0.06, 8), m:M(s*0.14, 0.2, 0.12), color:0xf0e0b0 }); parts.push({ geo:ball(0.03, 6), m:M(s*0.15, 0.2, 0.17), color:0x101010 }); });
    for(let i=0;i<8;i++){
      const a = i/8*TAU + 0.2, g = cyl(0.06, 0.012, 1.1, 6); g.translate(0, 0.55, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0,1,0), V(Math.cos(a), -0.15, Math.sin(a)).normalize());
      parts.push({ geo:g, m:new THREE.Matrix4().compose(V(0, 0.1, 0), q, V(1,1,1)), color:v=>hashf(v.x*40, v.z*40) > 0.7 ? 0xf0b090 : 0xc84a22, bend:v=>clamp(Math.hypot(v.x, v.z)/1.1, 0, 1) });
    }
    return { geo:merge(parts), mode:'arms', mat:{ amp:0.18, freq:2, k:4 }, count:3,
      place:k=>bottom(k, many(3, (x,z,D)=>D > 4 && D < 14 && O.rand() < 0.5), 0.3, 0.05, { minD:2, maxD:20, roam:8 }) };
  });
  sp('crab', 'Red crab', '🦀', ()=>{
    const parts = [];
    parts.push({ geo:body(0.28, 0.12, 0.36, 0, 10, 0), color:0xe0402a });
    [-1,1].forEach(s=>{
      parts.push({ geo:ball(0.07, 8), m:M(s*0.2, 0.02, 0.2, 0, 0, 0, 1, 0.7, 1.2), color:0xf05030 });
      parts.push({ geo:cyl(0.008, 0.008, 0.08, 4), m:M(s*0.05, 0.08, 0.12), color:0xe0402a });
      parts.push({ geo:ball(0.018, 6), m:M(s*0.05, 0.12, 0.12), color:0x101010 });
      for(let l=0;l<3;l++) parts.push({ geo:cyl(0.012, 0.008, 0.22, 4), m:M(s*0.22, -0.03, 0.05-l*0.08, 0, 0, s*1.1), color:0xd83a22, bend:1 });
    });
    return { geo:merge(parts), mode:'crawl', mat:{ amp:0.03, freq:12 }, count:14,
      place:k=>bottom(k, many(14, (x,z,D)=>D > 0.8 && D < 12), 0.5, 0.09, { minD:0.6, maxD:14, roam:6 }) };
  });
  sp('lobster', 'Spiny lobster', '🦞', ()=>{
    const parts = [];
    parts.push({ geo:body(0.55, 0.14, 0.16, 0.4, 10, 0.2), color:v=>hashf(v.x*30+5, v.z*30) > 0.85 ? 0xf8f0d8 : 0xc0602a });
    [-1,1].forEach(s=>{
      parts.push({ geo:cyl(0.006, 0.003, 0.8, 4), m:M(s*0.05, 0.05, 0.62, Math.PI/2 - 0.3, s*0.35, 0), color:0xd8804a, bend:1 });
      for(let l=0;l<4;l++) parts.push({ geo:cyl(0.008, 0.005, 0.18, 4), m:M(s*0.1, -0.05, 0.1-l*0.07, 0, 0, s*1.1), color:0xa0502a, bend:1 });
    });
    parts.push({ geo:fin([[0,0,-0.27],[0.1,0,-0.38],[-0.1,0,-0.38]]), color:0xc0602a });
    return { geo:merge(parts), mode:'crawl', mat:{ amp:0.02, freq:8 }, count:6,
      place:k=>bottom(k, many(6, (x,z,D)=>D > 5 && D < 30), 0.15, 0.08, { minD:3, maxD:40, roam:5 }) };
  });
  sp('seacucumber', 'Sea cucumber', '🥒', ()=>{
    const geo = merge([{ geo:body(0.5, 0.12, 0.14, 0.1, 10, 0.1), color:v=>hashf(v.x*50, v.z*50+v.y*50) > 0.7 ? 0xd8b070 : 0x6a3a2a }]);
    return { geo, mode:'none', count:10, place:k=>bottom(k, many(10, (x,z,D)=>D > 3 && D < 40), 0.03, 0.05, { minD:2, maxD:45, roam:4 }) };
  });
  sp('starfish', 'Starfish', '⭐', ()=>{
    const parts = [];
    for(let i=0;i<5;i++){ const a = i/5*TAU, g = cone(0.05, 0.2, 5); g.rotateX(-Math.PI/2); g.translate(0, 0, 0.1);
      parts.push({ geo:g, m:M(0, 0, 0, 0, a, 0, 1, 0.4, 1), color:0xffffff }); }
    parts.push({ geo:ball(0.06, 8), m:M(0, 0, 0, 0, 0, 0, 1, 0.4, 1), color:0xffffff });
    return { geo:merge(parts), mode:'none', count:24, tints:[0xff7a2a, 0x9a4ad8, 0xff4a6a, 0xffc040],
      place:k=>fixed(k, many(24, (x,z,D)=>D > 1 && D < 16), 0.03, [0.8, 1.4]) };
  });
  sp('urchin', 'Sea urchin', '🟣', ()=>{
    const parts = [{ geo:ball(0.08, 10), color:0x2a102a }];
    for(let i=0;i<30;i++){ const a = i*2.4, b = Math.acos(1-2*(i+0.5)/30), d = V(Math.sin(b)*Math.cos(a), Math.cos(b), Math.sin(b)*Math.sin(a));
      if(d.y < -0.3) continue; parts.push({ geo:cyl(0.006, 0.001, 0.2, 3), m:new THREE.Matrix4().compose(d.clone().multiplyScalar(0.1), new THREE.Quaternion().setFromUnitVectors(V(0,1,0), d), V(1,1,1)), color:0x3a1a4a }); }
    return { geo:merge(parts), mode:'none', count:30, place:k=>fixed(k, many(30, (x,z,D)=>D > 1.5 && D < 22), 0.04, [0.8, 1.3]) };
  });
  sp('gardeneel', 'Garden eels', '🪱', ()=>{
    const parts = [];
    const g = cyl(0.025, 0.03, 0.7, 6); g.translate(0, 0.35, 0);
    parts.push({ geo:g, color:v=>hashf(v.y*40, v.x*80+9) > 0.75 ? 0x101010 : 0xf0f0e0, bend:v=>clamp(v.y/0.7, 0, 1) });
    parts.push({ geo:ball(0.035, 8), m:M(0, 0.71, 0.01, 0, 0, 0, 1, 1, 1.3), color:0xf0f0e0, bend:1 });
    parts.push({ geo:ball(0.01, 5), m:M(0.02, 0.72, 0.04), color:0x101010, bend:1 });
    return { geo:merge(parts), mode:'sway', mat:{ amp:0.08, freq:1.4, k:3 }, count:36, eels:true,
      place:k=>{
        /* a patch of open sand, clear of the kelp and the coral: eels do not live in a forest */
        const kz = O.zones.kelp, rz = O.zones.reef;
        const c = spotIn((x,z,D)=>D > 3 && D < 8 && Math.hypot(x-kz.x, z-kz.z) > kz.r+14 && Math.hypot(x-rz.x, z-rz.z) > rz.r+6 && O.noise(x/15+7, z/15+3) < 0.45, 3000) || O.zones.garden;
        O.zones.garden = { x:c.x, z:c.z, r:10 };
        fixed(k, Array.from({ length:36 }, ()=>({ x:c.x + (O.rand()-0.5)*16, z:c.z + (O.rand()-0.5)*16 })), -0.05, [0.9, 1.2]); } };
  });
  sp('moray', 'Moray eel', '🐍', ()=>{
    const parts = [];
    const g = body(1.6, 0.18, 0.14, 0.5, 10, 0.25); g.rotateX(-0.9); g.translate(0, 0.45, 0);
    parts.push({ geo:g, color:v=>hashf(v.x*30+3, v.y*30+v.z*30) > 0.6 ? 0x4a5a1a : 0x7a8a3a, bend:v=>clamp(v.y/1.1, 0, 1) });
    [-1,1].forEach(s=>parts.push({ geo:ball(0.025, 6), m:M(s*0.06, 1.0, 0.58), color:0xf0e060 }));
    return { geo:merge(parts), mode:'sway', mat:{ amp:0.06, freq:1.2, k:2 }, count:4,
      place:k=>fixed(k, many(4, (x,z,D)=>D > 4 && D < 30 && steep(x, z)), -0.2, [0.9, 1.2]) };
  });
  sp('seahorse', 'Seahorse', '🐴', ()=>{
    const parts = [];
    parts.push({ geo:body(0.16, 0.2, 0.08, 0.1, 8, 0.1), m:M(0, 0.12, 0, -1.2), color:0xffb02a });
    parts.push({ geo:body(0.12, 0.07, 0.06, 0, 8, 0.1), m:M(0, 0.27, 0.05, 0.2), color:0xffb02a });
    parts.push({ geo:cyl(0.012, 0.018, 0.08, 5), m:M(0, 0.26, 0.13, Math.PI/2), color:0xf09a20 });
    const tail = new THREE.TorusGeometry(0.05, 0.015, 5, 10, Math.PI*1.4); parts.push({ geo:tail, m:M(0, -0.03, -0.03, 0, Math.PI/2, 0), color:0xf09a20, bend:1 });
    parts.push({ geo:fin([[0,0.18,-0.04],[0,0.12,-0.1],[0,0.06,-0.05]]), color:0xffd070, bend:1 });
    return { geo:merge(parts), mode:'sway', mat:{ amp:0.03, freq:3, k:6 }, count:8,
      place:k=>{ const z = O.zones.kelp; drift(k, [z, z], [5, 9]); } };
  });
  sp('otter', 'Sea otter', '🦦', ()=>{
    const parts = [];
    parts.push({ geo:body(1.1, 0.34, 0.36, 0.4, 12, 0.1), color:v=>v.z > 0.3 ? 0xc8b8a0 : 0x6a4a32 });
    parts.push({ geo:ball(0.16, 10), m:M(0, 0.04, 0.62), color:0xc8b8a0 });
    [-1,1].forEach(s=>{ parts.push({ geo:ball(0.02, 5), m:M(s*0.06, 0.14, 0.72), color:0x101010 }); parts.push({ geo:ball(0.05, 6), m:M(s*0.18, 0.12, 0.32), color:0x5a3a28, bend:1 }); });
    parts.push({ geo:ball(0.03, 5), m:M(0, 0.12, 0.77), color:0x101010 });
    return { geo:merge(parts), mode:'paddle', mat:{ amp:0.05, freq:1.5 }, count:3,
      place:k=>{ const z = O.zones.kelp; const items = [0,1,2].map(i=>({ x:z.x + (i-1)*3, z:z.z + (i%2)*2, p:i*2 }));
        k.items = items; k.update = dt=>{ items.forEach((o, i)=>{ o.p += dt*0.3; const x = o.x + Math.sin(o.p)*2, zz = o.z + Math.cos(o.p*0.7)*2;
          put(k.mesh, i, x, O.SEA - 0.05 + Math.sin(clock*1.3 + i)*0.08, zz, Math.cos(o.p), 0, -Math.sin(o.p), 1, Math.PI); }); };
        k.centre = ()=>V(z.x, 0, z.z); } };
  });

  /* -------------------------------------------------- in the drift */
  sp('moonjelly', 'Moon jellyfish', '🪼', ()=>{
    const parts = [];
    const bell = new THREE.SphereGeometry(0.45, 16, 8, 0, TAU, 0, Math.PI*0.5); bell.scale(1, 0.55, 1);
    parts.push({ geo:bell, color:0xc8e4ff, glow:0.25, bend:v=>clamp(1 - v.y/0.25, 0, 1) });
    for(let i=0;i<4;i++){ const r = new THREE.TorusGeometry(0.08, 0.02, 5, 12); parts.push({ geo:r, m:M(Math.cos(i*TAU/4)*0.13, 0.12, Math.sin(i*TAU/4)*0.13, Math.PI/2), color:0xff9ad8, glow:0.6 }); }
    for(let i=0;i<14;i++){ const a = i/14*TAU, g = cyl(0.004, 0.002, 1.1, 3); g.translate(0, -0.55, 0);
      parts.push({ geo:g, m:M(Math.cos(a)*0.42, 0, Math.sin(a)*0.42), color:0xd8ecff, glow:0.4, bend:0 }); }
    return { geo:merge(parts), mode:'pulse', mat:{ amp:0.18, freq:2.2, k:2.5, opacity:0.7, glow:1.2, side:THREE.DoubleSide }, count:30,
      tints:[0xffffff, 0xd8e8ff, 0xffe0f4],
      place:k=>drift(k, [O.zones.deep, { x:0, z:0 }, O.zones.reef], [4, 20]) };
  });
  sp('deepjelly', 'Crown jellyfish', '🪼', ()=>{
    const parts = [];
    const bell = new THREE.SphereGeometry(0.4, 14, 8, 0, TAU, 0, Math.PI*0.55); bell.scale(1, 0.8, 1);
    parts.push({ geo:bell, color:0x8a1030, glow:0.5, bend:v=>clamp(1 - v.y/0.3, 0, 1) });
    const ring = new THREE.TorusGeometry(0.4, 0.035, 6, 20); parts.push({ geo:ring, m:M(0, 0.02, 0, Math.PI/2), color:0x40e0ff, glow:2 });
    for(let i=0;i<10;i++){ const a = i/10*TAU, g = cyl(0.006, 0.002, 1.6, 3); g.translate(0, -0.8, 0);
      parts.push({ geo:g, m:M(Math.cos(a)*0.36, 0, Math.sin(a)*0.36), color:0xff4a6a, glow:0.8 }); }
    return { geo:merge(parts), mode:'pulse', mat:{ amp:0.14, freq:1.6, k:2, opacity:0.85, glow:2.2, side:THREE.DoubleSide }, count:16,
      tints:[0xffffff, 0x8affff, 0xffa0ff],
      place:k=>drift(k, [riftMid(), O.zones.deep], [34, 60]) };
  });

  /* -------------------------------------------------------- the deep */
  sp('anglerfish', 'Anglerfish', '🎣', ()=>{
    const L = 0.8, geo = fishGeo({ len:L, h:0.55, w:0.5, taper:0.6, nose:0.02, pect:0.15, tail:0.4, fork:0.95, eye:0.03, eyeRing:0x303030,
      col:v=>v.y < -0.1 && v.z > L*0.35 ? 0x3a1a1a : 0x2a1e1a, finCol:0x201614,
      extra:parts=>{
        for(let i=0;i<9;i++){ const a = (i/8-0.5)*1.6; parts.push({ geo:cone(0.012, 0.07, 4), m:M(Math.sin(a)*0.2, -0.05, L*0.46, Math.PI, 0, 0), color:0xf8f8f0 }); }
        const stalk = new THREE.TorusGeometry(0.3, 0.008, 4, 12, Math.PI*0.8); parts.push({ geo:stalk, m:M(0, 0.28, L*0.3, 0, Math.PI/2, 0), color:0x3a2a22 });
        parts.push({ geo:ball(0.05, 8), m:M(0, 0.33, L*0.62), color:0x9fffe8, glow:3 }); } });
    return { geo, mode:'swim', mat:{ amp:0.05, freq:2, k:3, glow:2.5 }, count:4,
      place:k=>reef(k, riftHomes(4), 1) };
  });
  sp('giantsquid', 'Giant squid', '🦑', ()=>{
    const parts = [];
    parts.push({ geo:body(3.2, 0.7, 0.7, -0.4, 14, 0.5), m:M(0, 0, 1.3), color:0xb8302a });
    parts.push({ geo:fin([[0,0,2.7],[1.0,0,2.3],[0,0,1.9],[-1.0,0,2.3]]), color:0xa02824 });
    [-1,1].forEach(s=>{ parts.push({ geo:ball(0.16, 10), m:M(s*0.32, 0.05, -0.05), color:0xf0f0e0 }); parts.push({ geo:ball(0.09, 8), m:M(s*0.4, 0.05, 0.0), color:0x050505 }); });
    for(let i=0;i<10;i++){ const a = i/10*TAU, long = i < 2, len = long ? 6 : 2.6, g = cyl(0.07, 0.015, len, 5);
      g.rotateX(-Math.PI/2); g.translate(0, 0, -len/2);
      parts.push({ geo:g, m:M(Math.cos(a)*0.25, Math.sin(a)*0.25, -0.2), color:0xc8403a, bend:v=>clamp(-v.z/len, 0, 1) }); }
    return { geo:merge(parts), mode:'squid', mat:{ amp:0.35, freq:1.2, k:0.9 }, count:1,
      place:k=>cruise(k, riftLoop(55, 72), 1.1, { clear:3 }) };
  });
  sp('nautilus', 'Nautilus', '🐚', ()=>{
    const parts = [];
    const shell = new THREE.TorusGeometry(0.14, 0.1, 8, 16, Math.PI*1.7); parts.push({ geo:shell, m:M(0, 0.12, -0.05, 0, Math.PI/2, 0), color:v=>Math.sin(Math.atan2(v.y-0.12, v.z+0.05)*9) > 0.2 ? 0xc0602a : 0xf8f0e0 });
    parts.push({ geo:ball(0.1, 10), m:M(0, 0.12, 0.08), color:0xf8f0e0 });
    for(let i=0;i<10;i++){ const a = i/10*TAU, g = cyl(0.008, 0.004, 0.2, 3); g.rotateX(Math.PI/2); g.translate(0, 0, 0.1); parts.push({ geo:g, m:M(Math.cos(a)*0.04, 0.1+Math.sin(a)*0.04, 0.14), color:0xf0d0b0, bend:1 }); }
    return { geo:merge(parts), mode:'squid', mat:{ amp:0.03, freq:3, k:10 }, count:4,
      place:k=>reef(k, [wallSpot(), wallSpot()], 1) };
  });
  sp('tubeworm', 'Giant tube worms', '🪱', ()=>{
    const parts = [];
    for(let i=0;i<7;i++){ const a = i*2.3, r = i ? 0.14 : 0, h = 0.9 + (i%3)*0.3, g = cyl(0.035, 0.045, h, 6); g.translate(0, h/2, 0);
      parts.push({ geo:g, m:M(Math.cos(a)*r, 0, Math.sin(a)*r), color:0xf2eee4, bend:v=>clamp(v.y/h, 0, 1)*0.5 });
      parts.push({ geo:ball(0.06, 8), m:M(Math.cos(a)*r, h+0.03, Math.sin(a)*r, 0, 0, 0, 1, 1.5, 1), color:0xff2a3a, glow:0.6, bend:1 }); }
    return { geo:merge(parts), mode:'sway', mat:{ amp:0.05, freq:1, k:2, glow:1.5 }, count:18,
      place:k=>fixed(k, vents.flatMap(v=>[0,1,2,3].map(()=>({ x:v.x + (O.rand()-0.5)*5, z:v.z + (O.rand()-0.5)*5 }))).slice(0, 18), -0.05, [0.8, 1.3]) };
  });

  /* ============================================== the places they live */
  let anemones = [], reefHomes = [], vents = [];
  const steep = (x, z) => Math.abs(O.depth(x+1.5, z)-O.depth(x-1.5, z)) + Math.abs(O.depth(x, z+1.5)-O.depth(x, z-1.5)) > 4;
  function wallSpot(){ return spotIn((x,z,D)=>D > 12 && D < 30 && steep(x, z), 800) || { x:O.DC.x + O.RD, z:O.DC.z, D:20 }; }
  function riftMid(){ const r = O.rift; return r[Math.floor(r.length/2)]; }
  function riftHomes(n){ const r = O.rift; return Array.from({ length:n }, (_, i)=>r[Math.floor((i+1)/(n+1)*r.length)]); }
  function riftLoop(dMin, dMax){
    const r = O.rift, pts = [];
    for(let i=2;i<r.length-2;i+=2){ const p = r[i]; pts.push(V(p.x, O.SEA - lerp(dMin, dMax, O.rand()), p.z)); }
    for(let i=r.length-3;i>2;i-=3){ const p = r[i]; pts.push(V(p.x + 3, O.SEA - lerp(dMin, dMax, O.rand()), p.z + 3)); }
    pts.forEach(p=>{ p.y = clamp(p.y, O.bed(p.x, p.z) + 3, O.SEA - 5); });
    return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  }

  /* KELP: tall ribbons from the sand to near the surface, swaying. */
  function kelp(){
    const z = O.zones.kelp, parts = [];
    const stalk = new THREE.PlaneGeometry(0.08, 1, 1, 12); stalk.translate(0, 0.5, 0);
    parts.push({ geo:stalk, color:0x6a5a1a, bend:v=>v.y });
    for(let i=0;i<10;i++){ const y = 0.1 + i*0.09, s = i%2 ? 1 : -1;
      parts.push({ geo:fin([[0,y,0],[s*0.28,y+0.035,0.02],[s*0.3,y+0.07,0.01],[0,y+0.04,0]]), color:i%3 ? 0x8a9a2a : 0x6a8a22, bend:()=>y }); }
    const spots = many(150, (x,zz,D)=>D > 4 && D < 16 && Math.hypot(x-z.x, zz-z.z) < z.r, 2000);
    const geo = merge(parts);
    const k = { id:'kelp', name:'Giant kelp', icon:'🌿', habitat:true };
    // sway in the strand's own units: it is 1.6 wide and scaled only in height, so 0.5 is most of a metre at the tip
    k.mesh = herd({ id:'kelp', mode:'sway', mat:{ amp:0.5, freq:0.8, k:1.4, side:THREE.DoubleSide, rough:0.8 } }, geo, spots.length);
    k.items = spots;
    fixKelpScale(k.mesh, spots);
    k.still = true; k.centre = ()=>V(z.x, 0, z.z);
    kinds.push(k);
  }
  /* The strands are scaled by height in y only: rebuild their matrices so. */
  function fixKelpScale(mesh, spots){
    spots.forEach((s, i)=>{ const h = Math.max(3, s.D - 0.8 - (i%5)*0.4); O.toWorld(s.x, O.bed(s.x, s.z) - 0.1, s.z, _p);
      _u.copy(_p).normalize(); _f.set(1, 0, 0); _f.addScaledVector(_u, -_f.dot(_u)).normalize(); _r.crossVectors(_u, _f).normalize();
      _m.makeBasis(_r, _u, _f); _m.scale(_s.set(1.6, h, 1.6)); _m.setPosition(_p); mesh.setMatrixAt(i, _m); });
    mesh.instanceMatrix.needsUpdate = true;
  }
  /* SEA GRASS: a meadow on the sand in the shallows. */
  function seagrass(){
    const parts = [];
    for(let i=0;i<7;i++){ const a = i/7*TAU, r = 0.1, h = 0.4 + (i%3)*0.15;
      parts.push({ geo:fin([[Math.cos(a)*r-0.015, 0, Math.sin(a)*r],[Math.cos(a)*r+0.015, 0, Math.sin(a)*r],[Math.cos(a)*r*1.4, h, Math.sin(a)*r*1.4]]), color:v=>v.y > 0.3 ? 0x8ad04a : 0x4a8a2a, bend:v=>v.y/0.7 }); }
    const spots = many(260, (x,z,D)=>D > 0.8 && D < 6 && O.noise(x/12+40, z/12) > 0.45, 3000);
    placeHabitat('seagrass', 'Sea grass', '🌱', merge(parts), 'sway', { amp:0.08, freq:1.1, k:3, side:THREE.DoubleSide }, spots, 0, [0.8, 1.5]);
  }
  /* CORAL: four kinds, on the reef heads, and glowing kinds in the canyons. */
  function corals(){
    const onReef = (x,z,D)=>D > 1.2 && D < 13 && O.noise(x/15+7, z/15+3) > 0.5;
    // staghorn: branching sticks
    { const parts = []; const br = (x,y,z, rx,rz, len, r)=>{ const g = cyl(r*0.7, r, len, 5); g.translate(0, len/2, 0); parts.push({ geo:g, m:M(x,y,z, rx,0,rz), color:0xffffff }); };
      br(0,0,0, 0,0, 0.5, 0.05); for(let i=0;i<7;i++){ const a = i*0.9; br(Math.cos(a)*0.05, 0.2+i*0.04, Math.sin(a)*0.05, Math.sin(a)*0.7, Math.cos(a)*0.7, 0.35+(i%3)*0.12, 0.035); }
      placeHabitat('staghorn', 'Staghorn coral', '🪸', merge(parts), 'none', {}, many(120, onReef, 3000), 0, [0.8, 1.8], [0xff7aa8, 0xffa24a, 0xb07aff, 0xf0e8d0]); }
    // brain coral: a lumpy dome with grooves
    { const g = new THREE.SphereGeometry(0.5, 20, 12, 0, TAU, 0, Math.PI/2); const P = g.attributes.position;
      for(let i=0;i<P.count;i++){ const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = 1 + 0.05*Math.sin(x*28 + Math.sin(z*20)*2); P.setXYZ(i, x*k, y*0.7*k, z*k); }
      g.computeVertexNormals();
      placeHabitat('brain', 'Brain coral', '🧠', merge([{ geo:g, color:v=>Math.sin(v.x*28 + Math.sin(v.z*20)*2) > 0 ? 0xd8c070 : 0x9a8040 }]), 'none', {}, many(70, onReef, 3000), -0.05, [0.7, 2]); }
    // sea fans
    { const parts = []; for(let i=0;i<9;i++){ const a = (i/8-0.5)*1.8; parts.push({ geo:fin([[0,0,0],[Math.sin(a-0.1)*0.9, Math.cos(a-0.1)*0.9, 0],[Math.sin(a+0.1)*0.9, Math.cos(a+0.1)*0.9, 0]]), color:0xffffff, bend:v=>v.y }); }
      placeHabitat('seafan', 'Sea fan', '🪭', merge(parts), 'sway', { amp:0.04, freq:0.8, k:1, side:THREE.DoubleSide }, many(60, (x,z,D)=>D > 4 && D < 25 && (onReef(x,z,D) || steep(x,z)), 3000), 0, [0.8, 1.8], [0xb040ff, 0xff4a8a, 0xffa030]); }
    // table coral
    { const top = new THREE.CylinderGeometry(0.8, 0.7, 0.08, 16); top.translate(0, 0.5, 0); const stem = cyl(0.08, 0.12, 0.5, 6); stem.translate(0, 0.25, 0);
      placeHabitat('table', 'Table coral', '🍄', merge([{ geo:top, color:0x9ad0b0 }, { geo:stem, color:0x7aa090 }]), 'none', {}, many(35, onReef, 3000), 0, [0.7, 1.6], [0xffffff, 0xffd8c0, 0xc0e0ff]); }
    // anemones, each with clownfish at home in it
    { const parts = [{ geo:cyl(0.18, 0.22, 0.15, 10), m:M(0, 0.075, 0), color:0x7a3a8a }];
      for(let i=0;i<22;i++){ const a = i*2.4, r = 0.05 + (i%4)*0.04, g = cyl(0.02, 0.012, 0.35, 4); g.translate(0, 0.17, 0);
        parts.push({ geo:g, m:M(Math.cos(a)*r, 0.14, Math.sin(a)*r, Math.sin(a)*0.4, 0, Math.cos(a)*0.4), color:0xf0d8a0, glow:0.2, bend:v=>clamp((v.y-0.14)/0.35, 0, 1) }); }
      anemones = many(10, onReef, 3000);
      placeHabitat('anemone', 'Sea anemone', '🌺', merge(parts), 'sway', { amp:0.06, freq:1.6, k:8, glow:1 }, anemones, 0, [1.2, 1.8], [0xffffff, 0xff9ad8, 0x9affd8]); }
    // sponges
    { const parts = []; for(let i=0;i<4;i++){ const h = 0.4 + i*0.12, g = cyl(0.1, 0.07, h, 8, 1, true); g.translate(0, h/2, 0); parts.push({ geo:g, m:M((i%2-0.5)*0.2, 0, (i>>1)*0.18-0.09), color:0xffffff }); }
      placeHabitat('sponge', 'Tube sponge', '🧽', merge(parts), 'none', { side:THREE.DoubleSide }, many(50, (x,z,D)=>D > 6 && D < 35, 3000), 0, [0.8, 1.6], [0xffd030, 0xff7030, 0xb050ff]); }
    // glowing coral down the canyon walls
    { const parts = []; for(let i=0;i<6;i++){ const a = i*1.1, g = cyl(0.025, 0.04, 0.5, 5); g.translate(0, 0.25, 0); parts.push({ geo:g, m:M(Math.cos(a)*0.08, 0, Math.sin(a)*0.08, Math.sin(a)*0.5, 0, Math.cos(a)*0.5), color:0xffffff, glow:1 }); }
      placeHabitat('glowcoral', 'Glowing coral', '💡', merge(parts), 'none', { glow:2 }, many(90, (x,z,D)=>D > 18 && steep(x, z), 4000), 0, [0.8, 1.8], [0x40e0ff, 0xff40d0, 0x80ff60]); }
  }
  function placeHabitat(id, name, icon, geo, mode, mat, spots, lift, scale, tints){
    if(!spots.length) return;
    const k = { id, name, icon, habitat:true };
    k.mesh = herd({ id, mode, mat, tints }, geo, spots.length);
    fixed(k, spots, lift, scale);
    kinds.push(k);
  }
  /* ROCKS, scattered on the slopes and the floors of the canyons. */
  function rocks(){
    const g = new THREE.DodecahedronGeometry(1, 1), P = g.attributes.position;
    for(let i=0;i<P.count;i++){ const k = 0.75 + 0.5*hashf(P.getX(i)*9+3, P.getZ(i)*9+P.getY(i)*9); P.setXYZ(i, P.getX(i)*k, P.getY(i)*k*0.7, P.getZ(i)*k); }
    g.computeVertexNormals();
    const spots = many(160, (x,z,D)=>D > 3 && (steep(x, z) || D > 30), 4000);
    placeHabitat('rock', 'Rocks', '🪨', merge([{ geo:g, color:0x6a6a70 }]), 'none', { rough:0.95 }, spots, -0.2, [0.4, 2.2], [0x8a8a90, 0x6a707a, 0x7a6a60]);
  }
  /* THE VENTS at the bottom of the rift: black chimneys, shimmering water
     and a stream of bubbles, and tube worms round them. */
  let bubbles = null;
  function ventField(){
    vents = [3, 7, 11, 15].map(i=>{ const p = O.rift[i]; return { x:p.x + (O.rand()-0.5)*3, z:p.z + (O.rand()-0.5)*3 }; });
    const parts = [];
    for(let i=0;i<4;i++){ const g = cyl(0.35 - i*0.07, 0.5 - i*0.07, 0.9, 7); g.translate(0, 0.45 + i*0.85, 0); parts.push({ geo:g, color:i===3 ? 0x5a3a20 : 0x1a1a1e }); }
    parts.push({ geo:ball(0.2, 8), m:M(0, 3.5, 0), color:0xff6a20, glow:2 });
    placeHabitat('vent', 'Hydrothermal vent', '🌋', merge(parts), 'none', { glow:2 }, vents, -0.2, [1.2, 1.8]);
    const n = 240, a = new Float32Array(n*3), seeds = [];
    for(let i=0;i<n;i++){ seeds.push({ v:i%vents.length, h:Math.random()*30, s:0.8+Math.random()*1.2, w:Math.random()*TAU }); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(a, 3));
    bubbles = new THREE.Points(geo, new THREE.PointsMaterial({ color:0xd8f4ff, size:0.18, transparent:true, opacity:0.7, depthWrite:false }));
    bubbles.frustumCulled = false; bubbles.userData.seeds = seeds; group.add(bubbles);
  }
  function tickBubbles(dt){
    if(!bubbles) return;
    const A = bubbles.geometry.attributes.position.array, S = bubbles.userData.seeds;
    S.forEach((b, i)=>{ b.h += dt*b.s*2; const v = vents[b.v], top = O.SEA - O.bed(v.x, v.z);
      if(b.h > top) b.h = 3.5; b.w += dt;
      O.toWorld(v.x + Math.sin(b.w*2)*0.2*b.s, O.bed(v.x, v.z) + b.h, v.z + Math.cos(b.w*1.7)*0.2*b.s, _p);
      A[i*3] = _p.x; A[i*3+1] = _p.y; A[i*3+2] = _p.z; });
    bubbles.geometry.attributes.position.needsUpdate = true;
  }
  /* A WRECK on the deep plain at the foot of the wall: a hull on its side,
     a snapped mast, and fish that have moved in. */
  function wreck(){
    const w = spotIn((x,z,D)=>D > 34 && D < 44 && Math.hypot(x-O.DC.x, z-O.DC.z) > O.RD*0.55 && inRift(x, z) > 20, 2000);
    if(!w) return;
    const parts = [];
    const hull = new THREE.CylinderGeometry(1.8, 0.9, 14, 12, 4, true, 0, Math.PI); hull.rotateZ(Math.PI/2); hull.rotateY(Math.PI/2);
    parts.push({ geo:hull, color:v=>hashf(v.x*3+5, v.z*3) > 0.8 ? 0x4a6a5a : 0x5a4030 });
    parts.push({ geo:new THREE.BoxGeometry(3, 0.15, 13), m:M(0, 0.1, 0), color:0x6a5038 });
    parts.push({ geo:cyl(0.15, 0.18, 6, 6), m:M(0, 3, 1, 0.3, 0, 0), color:0x5a4030 });
    parts.push({ geo:cyl(0.1, 0.12, 2.5, 6), m:M(1.4, 0.4, -3, 0, 0, 1.4), color:0x5a4030 });
    parts.push({ geo:new THREE.BoxGeometry(2.4, 1.6, 3), m:M(0, 0.9, -4), color:0x4a3a2a });
    placeHabitat('wreck', 'Shipwreck', '⚓', merge(parts), 'none', { side:THREE.DoubleSide, rough:0.9 }, [w], 0.4, [1, 1]);
    const k = kinds[kinds.length-1]; k.items[0].a = O.rand()*TAU;
    // on its side, a little
    O.toWorld(w.x, O.bed(w.x, w.z) + 0.4, w.z, _p); _u.copy(_p).normalize(); _f.set(1,0,0).addScaledVector(_u, -_u.x).normalize();
    _u.applyAxisAngle(_f, 0.5); _r.crossVectors(_u, _f).normalize(); _m.makeBasis(_r, _u, _f); _m.setPosition(_p); k.mesh.setMatrixAt(0, _m); k.mesh.instanceMatrix.needsUpdate = true;
    zonesExtra.wreck = w;
  }
  const zonesExtra = {};

  /* =========================================================== populate */
  function populate(api){
    clear();
    O = api; group = new THREE.Group(); group.name = 'sealife'; O.group.add(group);
    // the reef's homes: coral heads on the shelf
    reefHomes = many(14, (x,z,D)=>D > 2 && D < 10 && O.noise(x/15+7, z/15+3) > 0.58, 4000);
    if(!reefHomes.length) reefHomes = [{ x:O.zones.reef.x, z:O.zones.reef.z }];
    corals(); seagrass(); kelp(); rocks(); ventField(); wreck();
    for(const s of SPECIES){
      try{
        const b = s.make();
        const k = { id:s.id, name:s.name, icon:s.icon, puffer:!!b.puffer, eels:!!b.eels };
        k.mesh = herd({ id:s.id, mode:b.mode, mat:b.mat, tints:b.tints }, b.geo, b.count);
        b.place(k);
        if(k.update) k.update(0);
        k.mesh.instanceMatrix.needsUpdate = true;
        kinds.push(k);
      }catch(e){ console.warn('sealife: could not make', s.id, e); }
    }
    loadSeen();
  }

  /* ============================================================== frame */
  let seen = {}, checkT = 0;
  function loadSeen(){ try{ seen = JSON.parse((window.PROGRESS && PROGRESS.get('ocean', null)) || '{}') || {}; }catch(e){ seen = {}; } }
  function saveSeen(){ try{ if(window.PROGRESS) PROGRESS.set('ocean', JSON.stringify(seen)); }catch(e){} }
  const _cm = new THREE.Matrix4(), _cp = V();
  function tick(dt, near, cam, me){
    if(!group) return;
    group.visible = near;
    if(!near) return;
    clock += dt;
    const camM = O.toMap(cam.position), camY = cam.position.length() - O.PR;
    for(const k of kinds){
      k.mesh.material.userData.u.uTime.value = clock;
      if(k.still && !k.eels) continue;
      if(k.update){
        // things far out of sight are not moved
        const c = k.centre ? k.centre() : null;
        if(c && Math.hypot(c.x-camM.x, c.z-camM.z) > 140) continue;
        k.update(dt);
      }
      if(k.puffer) puff(k, me, dt);
      if(k.eels) eelDuck(k, me, dt);
      k.mesh.instanceMatrix.needsUpdate = true;
    }
    tickBubbles(dt);
    // who has been met
    checkT -= dt;
    if(checkT <= 0 && me && me.dir){
      checkT = 0.5;
      const p = O.toMap(me.dir), y = me.alt;
      for(const k of kinds){
        if(k.habitat || seen[k.id] || !k.mesh) continue;
        const reach = Math.max(5, k.mesh.geometry.boundingSphere.radius*2.5);
        for(let i=0;i<Math.min(k.mesh.count, 12);i++){
          k.mesh.getMatrixAt(i, _cm); _cp.setFromMatrixPosition(_cm);
          const q = O.toMap(_cp), qy = _cp.length() - O.PR;
          if(Math.hypot(q.x-p.x, q.z-p.z, qy-y) < reach){ seen[k.id] = 1; saveSeen();
            const animals = kinds.filter(x=>!x.habitat), n = animals.filter(x=>seen[x.id]).length;
            if(window.OCEAN && OCEAN.found) OCEAN.found(k.icon, k.name, n, animals.length);
            break; }
        }
      }
    }
  }
  /* A PUFFERFISH puffs up when you come close, and goes down when you go. */
  function puff(k, me, dt){
    if(!me || !me.dir) return;
    const p = O.toMap(me.dir);
    k.items.forEach((f, i)=>{
      k.mesh.getMatrixAt(i, _cm); _cp.setFromMatrixPosition(_cm); const q = O.toMap(_cp);
      const d = Math.hypot(q.x-p.x, q.z-p.z), want = d < 4 ? 2.1 : 1;
      f.inflate = (f.inflate || 1) + (want - (f.inflate || 1))*Math.min(1, dt*3);
      if(f.inflate > 1.01){ const s = f.inflate; _cm.decompose(_p, _qq, _s); _s.set(s, s, s); _cm.compose(_p, _qq, _s); k.mesh.setMatrixAt(i, _cm); }
    });
  }
  const _qq = new THREE.Quaternion();
  /* GARDEN EELS pull back into the sand when something big comes near. */
  function eelDuck(k, me, dt){
    if(!me || !me.dir) return;
    const p = O.toMap(me.dir);
    k.items.forEach((e, i)=>{
      const d = Math.hypot(e.x-p.x, e.z-p.z), want = d < 5 ? 0.15 : 1;
      e.h = (e.h ?? 1) + (want - (e.h ?? 1))*Math.min(1, dt*(want < e.h ? 6 : 0.8));
      put(k.mesh, i, e.x, O.bed(e.x, e.z) - 0.05 - (1-e.h)*0.6*e.s, e.z, Math.cos(e.a), 0, Math.sin(e.a), e.s, 0, e.s*e.h);
    });
  }
  function clear(){
    kinds.forEach(k=>{ if(k.mesh){ k.mesh.geometry.dispose(); k.mesh.material.dispose(); } });
    kinds.length = 0;
    if(group && group.parent) group.parent.remove(group);
    group = null; bubbles = null;
  }

  return { populate, tick, clear,
           get species(){ return SPECIES.map(s=>({ id:s.id, name:s.name, icon:s.icon })); },
           get habitat(){ return kinds.filter(k=>k.habitat).map(k=>({ id:k.id, name:k.name, icon:k.icon, count:k.mesh.count })); },
           get counts(){ return kinds.filter(k=>!k.habitat).map(k=>({ id:k.id, count:k.mesh.count })); },
           get seen(){ return Object.assign({}, seen); },
           /* for tests */ _SPECIES:SPECIES, _MOVE:MOVE,
           _kinds:kinds };
})();
