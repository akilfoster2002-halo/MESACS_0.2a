/* =====================================================================
   THE OCEAN ON WANO. A sea east of the town that you can wade into, swim
   across and dive to the bottom of.

   IT IS PART OF THE GROUND, not a room behind a door. Wano's terrain is
   one function — terrainH() in planet.js — that the collision, the
   shading, the grass and the tree planter all read, so the ocean is a
   BASIN in that function: planet.js asks spots() for it alongside the
   plunge pool, levels its rim the same way, and from then on nothing
   will plant a bamboo grove on the seabed or a panda in the surf, because
   everything that already stays out of the pool stays out of this.

   THE SEABED IS ITS OWN MESH. The planet is a sphere of eight-metre
   faces, which is fine for hills and useless for a canyon twelve metres
   wide; so the ball's triangles over the water are dropped (trimIndex)
   and a one-metre-grid seabed takes their place, sampled from the same
   depth grid the collision reads.

   ITS SHAPE, from the beach out:
     a beach, and a reef shelf a couple of metres to a dozen deep — sand,
       coral heads, a kelp forest on the side facing the town;
     THE WALL, where the shelf ends and drops thirty metres, the way a
       real reef does;
     the deep plain at forty metres;
     five CANYONS cut back into the shelf from the deep, steep-sided and
       winding, which is what "ravines" means underwater;
     and THE RIFT, a trench across the deep plain eighty metres down, with
       hot vents at the bottom and the things that live off them.
   The creatures live in sealife.js; this file is the water and the ground.

   THE MAP. Everything here is laid out in flat metres (x, z) around the
   middle of the sea and stood onto the ball through toWorld(): distance
   from the middle becomes an angle round the planet, so a creature that
   swims in a straight line on the map follows the curve of the sea.
   `y` is always altitude over the planet's radius, the same number
   terrainH() returns.
   ===================================================================== */
window.OCEAN = (function(){
  const V = (x,y,z)=>new THREE.Vector3(x||0,y||0,z||0);
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp = (a,b,t)=>a+(b-a)*t;
  const smooth = (e0,e1,x)=>{ const t = clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); };

  /* WHERE. East of the town, far enough that the Mall's apron is dry and
     near enough that the shore is the next thing you reach walking east. */
  const SPEC = { lon:72, lat:2, R:156 };
  const SHORE_OUT = 0.10;            // metres of beach and dunes between the waterline and the untouched land, as a share of R

  const GRID = 1.25;                 // metres a cell of the depth grid
  let on = false, PR = 320, C = null, RT = null, FT = null, cosR = 1;
  let rim = null, SEA = -6;          // the water's altitude, set from the basin's rim
  let town = { x:-1, z:0 };          // which way the town is, as a unit vector on the map
  let grid = null;                   // depth below the surface, one metre a cell

  /* ------------------------------------------------------------ the map */
  function frame(ctx){
    PR = ctx.PR;
    C = ctx.dirOf(SPEC.lon, SPEC.lat).normalize();
    const f = ctx.frameAt(C, 0);
    RT = f.right.clone().normalize(); FT = f.fwd.clone().normalize();
    cosR = Math.cos(SPEC.R/PR);
    const t = toMap(ctx.dirOf(0, 0));
    const n = Math.hypot(t.x, t.z) || 1; town = { x:t.x/n, z:t.z/n };
  }
  function toMap(dir){
    const d = dir.clone().normalize();
    const a = Math.acos(clamp(d.dot(C), -1, 1)), px = d.dot(RT), pz = d.dot(FT), n = Math.hypot(px, pz);
    if(n < 1e-9) return { x:0, z:0, r:0 };
    const r = a*PR; return { x:px/n*r, z:pz/n*r, r };
  }
  /* the unit direction under map point (x, z) */
  function toDir(x, z, out){
    out = out || V();
    const r = Math.hypot(x, z);
    if(r < 1e-9) return out.copy(C);
    const a = r/PR, s = Math.sin(a)/r, c = Math.cos(a);
    return out.set(C.x*c + (RT.x*x + FT.x*z)*s, C.y*c + (RT.y*x + FT.y*z)*s, C.z*c + (RT.z*x + FT.z*z)*s);
  }
  function toWorld(x, y, z, out){ return toDir(x, z, out).multiplyScalar(PR + y); }

  /* --------------------------------------------------------- the shape
     A little seeded value noise, so the sea is the same sea every visit. */
  function hash(i, j){ let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + 1013904223;
    h = Math.imul(h ^ (h>>>13), 1274126177); return ((h ^ (h>>>16)) >>> 0) / 4294967295; }
  function noise(x, z){
    const xi = Math.floor(x), zi = Math.floor(z), xf = x-xi, zf = z-zi, u = xf*xf*(3-2*xf), v = zf*zf*(3-2*zf);
    return lerp(lerp(hash(xi,zi), hash(xi+1,zi), u), lerp(hash(xi,zi+1), hash(xi+1,zi+1), u), v);
  }
  let rng = 1;
  const rand = () => (rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296;

  /* The waterline is not a circle: it wanders in and out by a fifth. */
  const shoreR = th => SPEC.R*(0.8 + 0.05*Math.sin(3*th+1) + 0.035*Math.sin(5*th+2.3) + 0.015*Math.sin(11*th));
  let DC = { x:0, z:0 }, RD = 0.42*SPEC.R;       // the deep basin: centre and radius
  const deepR = th => RD*(1 + 0.12*Math.sin(4*th+0.5) + 0.05*Math.sin(9*th+2));
  let canyons = [], rift = null, zones = {};

  /* Five canyons from the deep out into the shelf, and one rift across
     the deep. Each is a winding line with a floor depth along it. */
  function plan(){
    rng = 20260927;
    DC = { x:-town.x*0.2*SPEC.R, z:-town.z*0.2*SPEC.R };
    const away = Math.atan2(-town.z, -town.x);
    canyons = [];
    /* WHERE THE SHELF IS WIDE ENOUGH TO CUT INTO. From the deep basin's
       edge, how far out each way until the shelf is nearly beach: a canyon
       goes where that run is long, five of them, spread round. */
    const runFrom = th => { const ux = Math.cos(th), uz = Math.sin(th), r0 = deepR(th)*0.85;
      let r = r0; while(r < SPEC.R*1.4){ const px2 = DC.x + ux*r, pz2 = DC.z + uz*r; if(Math.hypot(px2, pz2)/shoreR(Math.atan2(pz2, px2)) > 0.84) break; r += 1; }
      return { r0, r1:r, run:r - deepR(th)*1.1 }; };
    const cand = [];
    for(let i=0;i<72;i++){ const th = i/72*Math.PI*2; cand.push(Object.assign({ th }, runFrom(th))); }
    cand.sort((a, b)=>b.run - a.run);
    const picked = [];
    for(const c of cand){ if(picked.length >= 5) break;
      if(c.run < 14) break;
      if(picked.every(p=>Math.abs(Math.atan2(Math.sin(p.th-c.th), Math.cos(p.th-c.th))) > 0.8)) picked.push(c); }
    for(const c of picked){
      const th = c.th + (rand()-0.5)*0.1, ux = Math.cos(th), uz = Math.sin(th), px = -uz, pz = ux;
      const pts = [], wig = 4 + rand()*5, ph = rand()*6;
      for(let i=0;i<=16;i++){ const t = i/16, r = lerp(c.r0, c.r1, t), side = Math.sin(t*Math.PI*1.6 + ph)*wig*Math.sin(t*Math.PI);
        // deep where it leaves the basin, shallowing to a few metres under the shelf at its head
        pts.push({ x:DC.x + ux*r + px*side, z:DC.z + uz*r + pz*side, d:lerp(46, 9, Math.pow(t, 0.75)), w:lerp(9, 5, t) }); }
      canyons.push(pts);
    }
    // the rift: across the deep plain, square to the way the town is
    const ax = -town.z, az = town.x, pts = [];
    for(let i=0;i<=18;i++){ const t = i/18, s = lerp(-0.9, 0.9, t)*RD, side = Math.sin(t*Math.PI*2.2 + 1)*7;
      pts.push({ x:DC.x + ax*s + town.x*side, z:DC.z + az*s + town.z*side, d:78 + 6*Math.sin(t*Math.PI), w:8 }); }
    rift = pts;
    [...canyons, rift].forEach(line=>{
      let x0=Infinity, x1=-Infinity, z0=Infinity, z1=-Infinity;
      line.forEach(p=>{ x0=Math.min(x0,p.x-p.w*1.6); x1=Math.max(x1,p.x+p.w*1.6); z0=Math.min(z0,p.z-p.w*1.6); z1=Math.max(z1,p.z+p.w*1.6); });
      line.box = { x0, x1, z0, z1 };
    });
    // named places, for the life to settle in
    const kx = town.x*0.5*SPEC.R, kz = town.z*0.5*SPEC.R;
    zones = {
      kelp:  { x:kx + town.z*18, z:kz - town.x*18, r:26 },
      reef:  { x:town.x*0.56*SPEC.R - town.z*30, z:town.z*0.56*SPEC.R + town.x*30, r:34 },
      garden:{ x:town.x*0.5*SPEC.R + town.z*44, z:town.z*0.5*SPEC.R - town.x*44, r:10 },
      deep:  { x:DC.x, z:DC.z, r:RD*0.8 },
      rift:  { line:rift }
    };
  }
  /* distance from (x, z) to a line, and the depth and width there */
  function nearLine(line, x, z){
    const b = line.box; if(x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return null;
    let best = null;
    for(let i=0;i<line.length-1;i++){
      const a = line[i], c = line[i+1], ex = c.x-a.x, ez = c.z-a.z, L2 = ex*ex + ez*ez || 1;
      const t = clamp(((x-a.x)*ex + (z-a.z)*ez)/L2, 0, 1), dx = x-(a.x+ex*t), dz = z-(a.z+ez*t), d = Math.hypot(dx, dz);
      if(!best || d < best.dist) best = { dist:d, d:lerp(a.d, c.d, t), w:lerp(a.w, c.w, t), t:(i+t)/(line.length-1) };
    }
    return best;
  }
  /* DEPTH BELOW THE SURFACE at a map point: negative is land above it. */
  function depthAt(x, z){
    const r = Math.hypot(x, z), th = Math.atan2(z, x), sr = shoreR(th), s = r/sr;
    if(s >= 1) return -0.35 - (r-sr)*0.04;                     // the beach, rising out of the water
    let D = s > 0.9 ? 2.2*smooth(1, 0.9, s) : 2.2 + 9*smooth(0.9, 0.52, s);
    D += (noise(x/5, z/5)-0.5)*0.5;                            // ripples
    // coral heads on the shelf
    const reef = Math.max(0, noise(x/15+7, z/15+3)-0.52)*2.1;
    D -= 5.5*reef*smooth(0.95, 0.8, s)*smooth(0.45, 0.6, s);
    // THE WALL and the deep plain
    const dx = x-DC.x, dz = z-DC.z, dd = Math.hypot(dx, dz), dr = deepR(Math.atan2(dz, dx));
    const m = smooth(dr*1.1, dr*0.9, dd);
    const deep = 38 + 7*noise(x/40+11, z/40) + 3*noise(x/9, z/9+5);
    D = lerp(D, deep, m);
    // canyons and the rift, cut into whatever is there
    for(const line of canyons.concat([rift])){
      const n = nearLine(line, x, z); if(!n) continue;
      const u = n.dist/n.w; if(u >= 1.4) continue;
      const floor = n.d + 2*noise(x/6, z/6);
      D = Math.max(D, lerp(floor, D, smooth(0.5, 1.4, u)));
    }
    return Math.max(D, s > 0.97 ? D : 0.8);
  }
  /* The depth grid everything reads: the seabed mesh, the collision, the
     life. One metre a cell over the whole square the sea sits in. */
  function makeGrid(){
    const R = SPEC.R, S = GRID, N = Math.ceil(R*2/S)+3, g = new Float32Array(N*N), o = -R-S;
    for(let j=0;j<N;j++) for(let i=0;i<N;i++) g[j*N+i] = depthAt(o+i*S, o+j*S);
    grid = { g, N, o, S };
  }
  function depth(x, z){
    if(!grid) return depthAt(x, z);
    const { g, N, o, S } = grid, fx = (x-o)/S, fz = (z-o)/S, i = Math.floor(fx), j = Math.floor(fz);
    if(i < 0 || j < 0 || i >= N-1 || j >= N-1) return depthAt(x, z);
    const u = fx-i, v = fz-j, a = g[j*N+i], b = g[j*N+i+1], c = g[(j+1)*N+i], d = g[(j+1)*N+i+1];
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  /* The seabed's altitude under a map point, in terrainH's units. */
  const bed = (x, z) => SEA - depth(x, z);

  /* ======================================================== for planet.js */
  /* The sea as one of the world's basins. planet.js levels its rim, and
     every planter that stays out of a basin stays out of it. */
  function spots(ctx){
    if(!ctx || ctx.id!=='hub') { on = false; return []; }
    frame(ctx); plan(); grid = null; makeGrid();
    on = true;
    const b = { dir:C.clone(), r:SPEC.R, depth:0, ocean:true, cut };
    basin = b;
    return [b];
  }
  let basin = null;
  /* THE GROUND, under and round the sea. Outside the circle it is untouched.
     Inside it the land is eased down to the beach, and the beach into the
     seabed; the blend hands back to the hillside exactly at the circle. */
  function cut(dir, h, rimH){
    if(!on) return h;
    const k = dir.x*C.x + dir.y*C.y + dir.z*C.z;
    if(k <= cosR) return h;
    if(rimH !== undefined && rimH !== null && rim !== rimH){ rim = rimH; SEA = rim - 0.8; }
    const m = toMap(dir), u = m.r/SPEC.R, sr = shoreR(Math.atan2(m.z, m.x));
    const land = Math.max(h, SEA + 0.3);
    if(m.r > sr){
      // the dunes: from the beach at the waterline back up to the hill at the circle
      const t = smooth(sr, SPEC.R, m.r);
      return lerp(SEA + 0.35 + (m.r-sr)*0.03, land, t);
    }
    return bed(m.x, m.z);
  }
  /* Where the surface is, if this spot is sea: null anywhere else. */
  function waterAt(dir){
    if(!on || !C) return null;
    const k = dir.x*C.x + dir.y*C.y + dir.z*C.z;
    if(k <= cosR) return null;
    const m = toMap(dir);
    return depth(m.x, m.z) > 0.05 ? SEA : null;
  }
  /* How far out from the middle, as a share of the circle (0 middle, 1 rim). */
  function inside(dir){
    if(!on || !C) return 99;
    const k = dir.x*C.x + dir.y*C.y + dir.z*C.z;
    if(k <= cosR*0.98) return 99;
    return toMap(dir).r/SPEC.R;
  }
  /* THE BALL'S OWN TRIANGLES OVER THE SEA GO. A triangle whose three
     corners are all inside the circle is replaced by the seabed mesh; the
     ones across the edge stay, and the seabed tucks under them. */
  function trimIndex(geo){
    if(!on || !geo.index) return;
    const P = geo.attributes.position, I = geo.index.array, keep = [], d = V();
    const inAt = i => { d.set(P.getX(i), P.getY(i), P.getZ(i)).normalize(); return d.dot(C) > cosR && toMap(d).r < SPEC.R*0.985; };
    const inside = new Uint8Array(P.count);
    for(let i=0;i<P.count;i++) inside[i] = inAt(i) ? 1 : 0;
    for(let t=0;t<I.length;t+=3) if(!(inside[I[t]] && inside[I[t+1]] && inside[I[t+2]])) keep.push(I[t], I[t+1], I[t+2]);
    geo.setIndex(keep);
  }

  /* ========================================================== the meshes */
  let group = null, water = null, waterNrm = null, rays = null, snow = null, seabedMat = null, terrain = null, soil = null;
  const uTime = { value:0 };
  function build(ctx){
    clear();
    if(!on || !ctx || ctx.id!=='hub') return;
    if(basin && basin.rim!==undefined){ rim = basin.rim; SEA = rim - 0.8; }
    if(!grid) makeGrid();
    terrain = ctx.terrainH || null; soil = ctx.soil || null;
    group = new THREE.Group(); group.name = 'ocean'; ctx.group.add(group);
    seabed();
    surface();
    lightRays();
    marineSnow();
    signpost();
    if(window.SEALIFE) SEALIFE.populate(api());
    group.traverse(o=>{ if(o.isMesh || o.isPoints) o.userData.flat = true; });
  }
  /* What sealife.js is handed: the map, the ground, the zones, the group. */
  function api(){
    return { group, PR, SEA, R:SPEC.R, toWorld, toDir, toMap, bed, depth, zones, canyons, rift, town, DC, RD,
             shoreR, uTime, rand, noise };
  }

  /* THE SEABED: a one-metre-ish grid out to just past the circle, stood on
     the ball, coloured by what it is — beach, sand, reef, rock, the dark of
     the deep — and lit from above by caustics that fade with depth. */
  function seabed(){
    const R = SPEC.R + 6, S = 1.5, n = Math.ceil(2*R/S)+1, o = -R;
    const pos = [], col = [], idx = [], id = new Int32Array(n*n).fill(-1);
    const c = new THREE.Color(), tmp = V();
    const SAND = new THREE.Color(0xe6d3a3), WET = new THREE.Color(0xc9b484), REEF = new THREE.Color(0xb49a84),
          ROCK = new THREE.Color(0x6a7482), DEEP = new THREE.Color(0x3a4658), ABYSS = new THREE.Color(0x283244),
          GRASS = new THREE.Color(0x5f8d44);
    const TINTS = [0xff7aa8, 0xffa24a, 0xb07aff, 0x4ad7c0, 0xffd84a].map(h=>new THREE.Color(h));
    for(let j=0;j<n;j++) for(let i=0;i<n;i++){
      const x = o+i*S, z = o+j*S, r = Math.hypot(x, z);
      if(r > R) continue;
      const u = r/SPEC.R, dir = toDir(x, z, tmp);
      let y = terrain ? terrain(dir) : cut(dir, 0, rim);
      if(u > 0.93) y -= smooth(0.93, 1.0, u)*0.35;           // tucked under the ball's own edge
      id[j*n+i] = pos.length/3;
      const p = dir.multiplyScalar(PR + y); pos.push(p.x, p.y, p.z);
      // colour: by depth, by steepness, and a little coral where the reef is
      const D = depth(x, z), sl = Math.abs(depth(x+1, z)-depth(x-1, z)) + Math.abs(depth(x, z+1)-depth(x, z-1));
      if(D < 0){
        // sand at the water, the planet's own soil further up the beach, so there is no seam where the ball takes over
        const sr = shoreR(Math.atan2(z, x)), up = smooth(3, 14, r - sr);
        if(soil){ const g = soil(dir.clone().normalize()); GRASS.setRGB(g[0], g[1], g[2]); }
        c.copy(SAND).lerp(GRASS, Math.max(up, smooth(0.95, 1.0, u)));
      }
      else if(D < 1.2) c.copy(WET);
      else if(D < 13) c.copy(SAND).lerp(REEF, clamp(noise(x/15+7, z/15+3)*1.6-0.7, 0, 1));
      else if(D < 45) c.copy(DEEP);
      else c.copy(ABYSS);
      if(D > 1 && sl > 1.6) c.lerp(ROCK, clamp((sl-1.6)/3, 0, 0.85));
      if(D > 1.5 && D < 13){ const k = noise(x/4, z/4); if(k > 0.72) c.lerp(TINTS[Math.floor(noise(x/3+9, z/3)*5)%5], (k-0.72)*2.4); }
      const v = 0.9 + 0.2*noise(x*0.7, z*0.7); c.multiplyScalar(v);
      col.push(c.r, c.g, c.b);
    }
    for(let j=0;j<n-1;j++) for(let i=0;i<n-1;i++){
      const a = id[j*n+i], b = id[j*n+i+1], d = id[(j+1)*n+i], e = id[(j+1)*n+i+1];
      if(a<0 || b<0 || d<0 || e<0) continue;
      idx.push(a, d, b, b, d, e);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    // make the normals point up out of the ground, whichever way the grid wound them
    const N = geo.attributes.normal, P = geo.attributes.position;
    for(let i=0;i<N.count;i++){ tmp.set(P.getX(i), P.getY(i), P.getZ(i)); if(tmp.dot(V(N.getX(i), N.getY(i), N.getZ(i))) < 0){ N.setXYZ(i, -N.getX(i), -N.getY(i), -N.getZ(i)); } }
    seabedMat = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.92, metalness:0, side:THREE.DoubleSide });
    seabedMat.onBeforeCompile = sh=>{
      sh.uniforms.uTime = uTime; sh.uniforms.uSea = { value:PR+SEA };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWp = (modelMatrix*vec4(transformed,1.0)).xyz;');
      /* CAUSTICS: the rippling net of light under shallow water, made from
         a few crossed sines of the position and the clock, strongest just
         under the surface and gone by twenty metres. */
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform float uTime; uniform float uSea;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float dpt = uSea - length(vWp);
          if(dpt > 0.0){
            vec3 q = vWp*0.55;
            float cs = sin(q.x + uTime*0.9 + sin(q.z*1.3 + uTime*0.6)) * sin(q.z*1.1 - uTime*0.7 + sin(q.y*1.2 + uTime*0.5))
                     + 0.6*sin((q.x+q.y+q.z)*0.9 + uTime*1.1);
            cs = pow(clamp(cs*0.5+0.5, 0.0, 1.0), 4.0);
            totalEmissiveRadiance += vec3(0.55, 0.85, 1.0) * cs * 0.9 * exp(-dpt/10.0) * diffuseColor.rgb;
          }`);
    };
    const m = new THREE.Mesh(geo, seabedMat); m.name = 'seabed';
    group.add(m);
  }
  /* THE SURFACE: the sea at one altitude round the curve of the ball,
     turquoise over sand and navy over the deep (its vertex colours are the
     depth under them), foam where it meets the beach, and moving. */
  function surface(){
    const R = SPEC.R*0.93, S = 3, n = Math.ceil(2*R/S)+1, o = -R;
    const pos = [], col = [], uv = [], idx = [], id = new Int32Array(n*n).fill(-1), wet = [];
    const SHALLOW = new THREE.Color(0x48d6c8), MID = new THREE.Color(0x1f8fb8), DEEP = new THREE.Color(0x0d3f78), FOAM = new THREE.Color(0xe8fbff), c = new THREE.Color();
    for(let j=0;j<n;j++) for(let i=0;i<n;i++){
      const x = o+i*S, z = o+j*S; if(Math.hypot(x, z) > R) continue;
      const D = depth(x, z);
      id[j*n+i] = pos.length/3; wet.push(D > 0);
      const p = toWorld(x, SEA, z); pos.push(p.x, p.y, p.z); uv.push(x/14, z/14);
      if(D < 0.7) c.copy(FOAM).lerp(SHALLOW, clamp(D/0.7, 0, 1));
      else if(D < 8) c.copy(SHALLOW).lerp(MID, (D-0.7)/7.3);
      else c.copy(MID).lerp(DEEP, clamp((D-8)/30, 0, 1));
      col.push(c.r, c.g, c.b, D < 0.7 ? 0.85 : D < 8 ? lerp(0.5, 0.66, D/8) : lerp(0.66, 0.86, clamp((D-8)/30, 0, 1)));
    }
    for(let j=0;j<n-1;j++) for(let i=0;i<n-1;i++){
      const a = id[j*n+i], b = id[j*n+i+1], d = id[(j+1)*n+i], e = id[(j+1)*n+i+1];
      if(a<0 || b<0 || d<0 || e<0) continue;
      if(!(wet[a] || wet[b] || wet[d] || wet[e])) continue;
      idx.push(a, d, b, b, d, e);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const N = geo.attributes.normal, P = geo.attributes.position, t = V();
    for(let i=0;i<N.count;i++){ t.set(P.getX(i), P.getY(i), P.getZ(i)).normalize(); N.setXYZ(i, t.x, t.y, t.z); }
    waterNrm = rippleTexture();
    const mat = new THREE.MeshStandardMaterial({ vertexColors:true, transparent:true, roughness:0.12, metalness:0.05,
      normalMap:waterNrm, normalScale:new THREE.Vector2(0.55, 0.55), emissive:0x06303c, emissiveIntensity:0.6,
      side:THREE.DoubleSide, depthWrite:false });
    mat.onBeforeCompile = sh=>{
      sh.uniforms.uTime = uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 wp = position*0.35;
          float sw = sin(wp.x + uTime*1.1)*0.18 + sin(wp.z*1.3 - uTime*0.9)*0.14 + sin((wp.x+wp.y)*0.7 + uTime*0.6)*0.1;
          transformed += normalize(position) * sw;`);
    };
    water = new THREE.Mesh(geo, mat); water.name = 'sea'; water.renderOrder = 2;
    group.add(water);
  }
  /* THE WAY TO THE SEA. The planet curves the ocean out of sight of the
     town, so a post stands on the town side of the dunes with a wave on it
     and an arrow, facing the way people come from. */
  function signpost(){
    const g = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color:0x8a6040 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.2, 8), wood); post.position.y = 1.6; g.add(post);
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d'); x.fillStyle = '#1f6f9a'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#e8f8ff'; x.lineWidth = 6; x.strokeRect(6, 6, 244, 116);
    x.font = '64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🌊', 86, 66);
    x.fillStyle = '#e8f8ff'; x.font = 'bold 72px sans-serif'; x.fillText('↑', 180, 62);          // straight on
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.08), [wood, wood, wood, wood, new THREE.MeshLambertMaterial({ map:tex }), new THREE.MeshLambertMaterial({ map:tex })]);
    board.position.set(0, 2.7, 0); g.add(board);
    // on the town side, a little out from where the dunes start, facing the town
    const r = SPEC.R*1.12, px = town.x*r, pz = town.z*r, p = toWorld(px, 0, pz), up = p.clone().normalize();
    const y = terrain ? terrain(up) : 0;
    const towardSea = toWorld(0, 0, 0).sub(p); towardSea.addScaledVector(up, -towardSea.dot(up)).normalize();
    const face = towardSea.clone().negate(), side = new THREE.Vector3().crossVectors(up, face).normalize();   // the board looks at the town
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, face));
    g.position.copy(up).multiplyScalar(PR + y);
    group.add(g);
  }
  /* A tiling normal map of soft ripples, drawn once. */
  function rippleTexture(){
    const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), img = x.createImageData(S, S);
    const h = (i, j)=>{ let v = 0; for(let k=1;k<=3;k++) v += Math.sin((i*k*0.049 + Math.sin(j*0.098*k)*0.8)*Math.PI*2/k + k)*Math.cos((j*k*0.049 - Math.cos(i*0.049*k))*Math.PI*2/k)/k; return v; };
    for(let j=0;j<S;j++) for(let i=0;i<S;i++){
      const dx = h(i+1, j)-h(i-1, j), dz = h(i, j+1)-h(i, j-1), n = Math.hypot(dx, dz, 2.5);
      const o = (j*S+i)*4; img.data[o] = (dx/n*0.5+0.5)*255; img.data[o+1] = (dz/n*0.5+0.5)*255; img.data[o+2] = (2.5/n*0.5+0.5)*255; img.data[o+3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  /* LIGHT FROM ABOVE: soft shafts going down into the shallows, which only
     read from underneath — from the air they are lost in the surface. */
  function lightRays(){
    const geo = new THREE.CylinderGeometry(1.2, 3.2, 1, 12, 6, true); geo.translate(0, -0.5, 0);
    { const P = geo.attributes.position, col = []; for(let i=0;i<P.count;i++){ const k = Math.pow(1 + P.getY(i), 1.6); col.push(k, k, k); }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }       // bright at the top, nothing at the bottom
    const cnt = 26, mat = new THREE.MeshBasicMaterial({ color:0xbfefff, vertexColors:true, transparent:true, opacity:0.08, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:true });
    rays = new THREE.InstancedMesh(geo, mat, cnt); rays.frustumCulled = false;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V(), p = V(), up = V(0,1,0);
    rays.userData.spots = [];
    for(let i=0;i<cnt;i++){
      let x, z, D;
      for(let tries=0; tries<40; tries++){ const a = rand()*Math.PI*2, r = Math.sqrt(rand())*SPEC.R*0.75; x = Math.cos(a)*r; z = Math.sin(a)*r; D = depth(x, z); if(D > 3 && D < 20) break; }
      const len = Math.min(D, 26);
      toWorld(x, SEA, z, p); q.setFromUnitVectors(up, p.clone().normalize()); s.set(1 + rand(), len, 1 + rand());
      m.compose(p, q, s); rays.setMatrixAt(i, m);
      rays.userData.spots.push({ x, z, len });
    }
    rays.visible = false;
    group.add(rays);
  }
  /* MARINE SNOW: specks drifting in the water round you, the thing that
     makes water read as a medium rather than as blue air. */
  function marineSnow(){
    const n = 700, a = new Float32Array(n*3);
    for(let i=0;i<n;i++){ a[i*3] = (Math.random()-0.5)*40; a[i*3+1] = (Math.random()-0.5)*24; a[i*3+2] = (Math.random()-0.5)*40; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    snow = new THREE.Points(g, new THREE.PointsMaterial({ color:0xcfeaff, size:0.09, transparent:true, opacity:0.55, depthWrite:false }));
    snow.visible = false; snow.frustumCulled = false;
    group.add(snow);
  }

  /* ======================================================== underwater
     WHEN THE CAMERA GOES UNDER, the world goes blue. Fog the colour of the
     water at that depth, thicker the deeper you are, a background to
     match, and the fill lights lifted and tinted so the reef reads in
     colour — then all of it handed back the moment the camera surfaces. */
  let under = false, was = null;
  const FOG_SHALLOW = new THREE.Color(0x2a9cc0), FOG_DEEP = new THREE.Color(0x07203c), fogC = new THREE.Color();
  function goUnder(){
    was = { bg:G.scene.background, fog:G.scene.fog, exp:G.renderer.toneMappingExposure,
            hemi:G.hemi && [G.hemi.color.getHex(), G.hemi.groundColor.getHex(), G.hemi.intensity],
            amb:G.amb && [G.amb.color.getHex(), G.amb.intensity] };
    G.scene.fog = new THREE.FogExp2(0x2a9cc0, 0.03);
    G.scene.background = new THREE.Color(0x2a9cc0);
    if(G.hemi){ G.hemi.color.setHex(0x9fe8ff); G.hemi.groundColor.setHex(0x1a4a6a); G.hemi.intensity = 1.25; }
    if(G.amb){ G.amb.color.setHex(0x8fd8ff); G.amb.intensity = 0.45; }
    G.renderer.toneMappingExposure = 1.2;
    if(rays) rays.visible = true; if(snow) snow.visible = true;
    under = true;
  }
  function comeUp(){
    if(!under) return;
    under = false;
    if(was){
      G.scene.fog = was.fog; G.scene.background = was.bg; G.renderer.toneMappingExposure = was.exp;
      if(G.hemi && was.hemi){ G.hemi.color.setHex(was.hemi[0]); G.hemi.groundColor.setHex(was.hemi[1]); G.hemi.intensity = was.hemi[2]; }
      if(G.amb && was.amb){ G.amb.color.setHex(was.amb[0]); G.amb.intensity = was.amb[1]; }
    }
    was = null;
    if(rays) rays.visible = false; if(snow) snow.visible = false;
  }
  function underwaterLook(cam){
    const r = cam.position.length(), dir = cam.position.clone().normalize();
    const inSea = waterAt(dir) !== null && r < PR + SEA - 0.05;
    if(inSea && !under) goUnder(); else if(!inSea && under) comeUp();
    if(!under) return;
    const d = clamp((PR + SEA - r)/60, 0, 1);
    fogC.copy(FOG_SHALLOW).lerp(FOG_DEEP, Math.sqrt(d));
    G.scene.fog.color.copy(fogC); G.scene.fog.density = 0.026 + d*0.022;
    G.scene.background.copy(fogC);
    if(G.hemi) G.hemi.intensity = 1.25 - d*0.55;
    // the specks follow you, in your own frame
    snow.position.copy(cam.position); snow.quaternion.copy(cam.quaternion);
    const A = snow.geometry.attributes.position.array;
    for(let i=1;i<A.length;i+=3){ A[i] -= 0.004; if(A[i] < -12) A[i] += 24; }
    snow.geometry.attributes.position.needsUpdate = true;
  }

  /* ============================================================== HUD
     Two things, both pictures: how deep you are, and the two keys that
     take you up and down. */
  let hudEl = null;
  function hud(show, depthM){
    if(!hudEl){
      hudEl = document.createElement('div'); hudEl.id = 'oceanHud';
      hudEl.innerHTML = `<div class="oc-depth"><b id="ocDepth">0</b><small>m</small><i id="ocBar"></i></div>
        <div class="oc-keys"><span><kbd>SPACE</kbd>⬆</span><span><kbd>SHIFT</kbd>⬇</span></div>
        <div class="oc-found hidden" id="ocFound"></div>`;
      document.body.appendChild(hudEl);
    }
    hudEl.classList.toggle('hidden', !show);
    hudEl.querySelector('.oc-depth').style.display = depthM === null ? 'none' : '';
    if(show && depthM !== null){
      hudEl.querySelector('#ocDepth').textContent = Math.max(0, Math.round(depthM));
      hudEl.querySelector('#ocBar').style.height = clamp(depthM/85*100, 0, 100)+'%';
    }
  }
  /* A creature seen for the first time: its picture, its name, how many. */
  let foundT = 0;
  function found(icon, name, n, of){
    hud(true, null);
    const f = hudEl.querySelector('#ocFound');
    f.innerHTML = `<span>${icon}</span><b>${name}</b><small>${n} / ${of}</small>`;
    f.classList.remove('hidden'); f.classList.remove('pop'); void f.offsetWidth; f.classList.add('pop');
    foundT = 3.5;
  }

  /* ============================================================= frame */
  let t = 0;
  function tick(dt, me, cam, swimming){
    if(!group) return;
    t += dt; uTime.value = t;
    if(waterNrm){ waterNrm.offset.x = t*0.012; waterNrm.offset.y = t*0.008; }
    // nothing down here needs to move while you are nowhere near it
    const near = me && me.dir ? inside(me.dir) < 1.6 : false;
    if(window.SEALIFE) SEALIFE.tick(dt, near, cam, me);
    if(rays && rays.visible){ rays.material.opacity = 0.07 + 0.025*Math.sin(t*0.7); }
    underwaterLook(cam);
    const depthM = me && me.dir && swimming ? SEA - me.alt : null;
    if(foundT > 0){ foundT -= dt; if(foundT <= 0 && hudEl) hudEl.querySelector('#ocFound').classList.add('hidden'); }
    hud(!!swimming || foundT > 0, depthM);
    if(hudEl) hudEl.querySelector('.oc-keys').style.display = swimming ? '' : 'none';
  }
  function clear(){
    comeUp();
    if(window.SEALIFE) SEALIFE.clear();
    if(group && group.parent) group.parent.remove(group);
    group = null; water = null; rays = null; snow = null;
    if(hudEl) hudEl.classList.add('hidden');
  }

  return { spots, cut, waterAt, inside, trimIndex, build, tick, clear, found, toMap, toDir, toWorld, bedAt:(x,z)=>bed(x,z),
           get active(){ return on && !!group; }, get sea(){ return SEA; }, get under(){ return under; },
           get R(){ return SPEC.R; }, SPEC,
           /* for tests */ _depthAt:depthAt, _plan:()=>({ canyons, rift, DC, RD, zones, town }) };
})();
