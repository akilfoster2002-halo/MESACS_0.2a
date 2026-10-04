/* =====================================================================
   TSH — THE CITY. One district, one night: the part of town between the
   alley where Robin sells the rings and the building she lives in.

     N  ─────────────────── LANTERN LANE ───────────────────
        │ B1 │▒│ B3 │ │ B5 ║ MARKET ║ B7 ║ B8 │   CLUB   │
        │ B2 │▒│ B4 │ │    ║  ST    ║ B6 (the screen)   │
     ══════════════════════ NEON  AVENUE ════════════════════
        │ metro │ B19 │ │ B18 (Maya's roof) ║ B23 ║ │ B28 │ B29 │
        │       │ B20 │ │ B21 ║          ║ B24/25║ │ HOME│ high│
     S  ─────────────────── HARBOR  LANE ───────────────────
          ▒ = Dragon Alley, where the deal is

   Everything here is STATIC: it is built once and handed back as data —
   the solids the chase camera and the legs bump into, the platforms you
   can stand on (street, pavement, roof, dumpster lid), the ladders, the
   named spots the quest points at, the light sources the renderer picks
   from, and a navigation graph for everybody who is not you.

   IT IS DRAWN IN A FEW DOZEN MESHES, not a few thousand. Every box, quad
   and prop is poured into one buffer per material (Batch below) — the
   same lesson Wano learned about the garage: draw calls, not triangles,
   are what a lab machine runs out of.

   LIGHT IS A LIST, NOT A SCENE FULL OF LAMPS. A forward renderer pays for
   every point light on every lit pixel, so a street with sixty lanterns
   cannot have sixty lights. It has sixty SOURCES, and tsh.js keeps a
   dozen real lights that follow the camera, each borrowing the nearest
   source. What is not lit for real still glows: that is the bloom.
   ===================================================================== */
window.TSHCITY = (function(){
  const V3 = THREE.Vector3, L = () => window.TSHLOOK;
  let rand = Math.random;
  function seed(s){ rand = TSHLOOK.seeded(s); }
  const rnd = (a, b) => a + rand()*(b-a);
  const pick = arr => arr[Math.floor(rand()*arr.length)];

  /* =============================================================== batch
     One vertex buffer per material. `box` is UV'd in METRES (so a texture
     tiles at the same size on a door and on a tower), `quad` takes four
     corners, `geo` pours in any geometry through a matrix. */
  function Batch(){
    const parts = new Map();
    const P = mat => { if(!parts.has(mat)) parts.set(mat, { p:[], n:[], u:[], i:[] }); return parts.get(mat); };
    const _m = new THREE.Matrix4(), _nm = new THREE.Matrix3(), _v = new V3();
    /* WHAT HANGS OVER YOUR HEAD, kept as boxes while it is poured in. The
       merged meshes cannot say where one sign ends, and the chase camera
       needs to know: it sat at 4.6 m — the height of the alley's canopy
       and every blade sign in the district — and filmed the back of them.
       Anything whose underside is above head height goes on this list;
       ceilingAt() below is how the camera reads it. */
    const over = [], props = [];
    const hang = (x1, x2, z1, z2, y1, y2) => {
      if(y1 > 1.9 && y1 < 60 && x2-x1 < 90 && z2-z1 < 90) over.push({ x1, x2, z1, z2, y1 });
      // and every smaller solid thing, for the lens: a lantern, a sign, a stall — not the buildings, which are walls
      if(y2 > 0.4 && y1 < 40 && (x2-x1 < 12 || z2-z1 < 12) && x2-x1 < 40 && z2-z1 < 40) props.push({ x1, x2, y1, y2, z1, z2 });
    };
    return {
      over, props,
      quad(mat, a, b, c, d, uv){        // a b c d anticlockwise, seen from the front
        const t = P(mat), base = t.p.length/3;
        const n = new V3().subVectors(b, a).cross(new V3().subVectors(d, a)).normalize();
        [a, b, c, d].forEach(v=>{ t.p.push(v.x, v.y, v.z); t.n.push(n.x, n.y, n.z); });
        const U = uv || [0,0, 1,0, 1,1, 0,1];
        t.u.push(...U);
        t.i.push(base, base+1, base+2, base, base+2, base+3);
      },
      /* A box, centre (x, y, z), size (w, h, d), turned `ry` about y.
         `s` metres per texture tile; `faces` a string of the faces to keep
         (px nx py ny pz nz), so a wall against another wall is not drawn. */
      box(mat, x, y, z, w, h, d, o){
        o = o||{};
        const s = o.s || 1, sv = o.sv || s, ry = o.ry || 0, faces = o.faces || 'px nx py ny pz nz';
        const cs = Math.cos(ry), sn = Math.sin(ry);
        const W = (lx, ly, lz) => new V3(x + lx*cs + lz*sn, y + ly, z - lx*sn + lz*cs);
        const hw = w/2, hh = h/2, hd = d/2;
        const ex = Math.abs(cs)*hw + Math.abs(sn)*hd, ez = Math.abs(sn)*hw + Math.abs(cs)*hd;
        hang(x-ex, x+ex, z-ez, z+ez, y-hh, y+hh);
        const U = (a, b) => [0,0, a/s,0, a/s,b/s, 0,b/s];
        const oy = o.v0 || 0;             // shift v, so a facade's windows start at the right floor
        const Uy = (a, b) => [0,oy/sv, a/s,oy/sv, a/s,(b+oy)/sv, 0,(b+oy)/sv];
        if(faces.includes('pz')) this.quad(mat, W(-hw,-hh,hd), W(hw,-hh,hd), W(hw,hh,hd), W(-hw,hh,hd), Uy(w,h));
        if(faces.includes('nz')) this.quad(mat, W(hw,-hh,-hd), W(-hw,-hh,-hd), W(-hw,hh,-hd), W(hw,hh,-hd), Uy(w,h));
        if(faces.includes('px')) this.quad(mat, W(hw,-hh,hd), W(hw,-hh,-hd), W(hw,hh,-hd), W(hw,hh,hd), Uy(d,h));
        if(faces.includes('nx')) this.quad(mat, W(-hw,-hh,-hd), W(-hw,-hh,hd), W(-hw,hh,hd), W(-hw,hh,-hd), Uy(d,h));
        if(faces.includes('py')) this.quad(o.top || mat, W(-hw,hh,hd), W(hw,hh,hd), W(hw,hh,-hd), W(-hw,hh,-hd), U(w,d));
        if(faces.includes('ny')) this.quad(mat, W(-hw,-hh,-hd), W(hw,-hh,-hd), W(hw,-hh,hd), W(-hw,-hh,hd), U(w,d));
      },
      geo(mat, g, pos, rot, scl){
        const t = P(mat), base = t.p.length/3;
        _m.compose(pos || new V3(), new THREE.Quaternion().setFromEuler(rot || new THREE.Euler()), scl || new V3(1,1,1));
        _nm.getNormalMatrix(_m);
        const gp = g.attributes.position, gn = g.attributes.normal, gu = g.attributes.uv;
        let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity, z1 = Infinity, z2 = -Infinity;
        for(let k=0;k<gp.count;k++){
          _v.fromBufferAttribute(gp, k).applyMatrix4(_m); t.p.push(_v.x, _v.y, _v.z);
          if(_v.x < x1) x1 = _v.x; if(_v.x > x2) x2 = _v.x; if(_v.y < y1) y1 = _v.y; if(_v.y > y2) y2 = _v.y; if(_v.z < z1) z1 = _v.z; if(_v.z > z2) z2 = _v.z;
          if(gn){ _v.fromBufferAttribute(gn, k).applyMatrix3(_nm).normalize(); t.n.push(_v.x, _v.y, _v.z); } else t.n.push(0,1,0);
          if(gu) t.u.push(gu.getX(k), gu.getY(k)); else t.u.push(0,0);
        }
        if(g.index) for(let k=0;k<g.index.count;k++) t.i.push(base + g.index.getX(k));
        else for(let k=0;k<gp.count;k++) t.i.push(base + k);
        hang(x1, x2, z1, z2, y1, y2);
      },
      build(group, o){
        const out = [];
        parts.forEach((t, mat)=>{
          if(!t.p.length) return;
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(t.p, 3));
          g.setAttribute('normal', new THREE.Float32BufferAttribute(t.n, 3));
          g.setAttribute('uv', new THREE.Float32BufferAttribute(t.u, 2));
          g.setIndex(t.i.length > 65535 ? new THREE.Uint32BufferAttribute(t.i, 1) : new THREE.Uint16BufferAttribute(t.i, 1));
          g.computeBoundingSphere();
          const m = new THREE.Mesh(g, mat);
          if(o && o.flat) m.userData.flat = true;
          if(mat.userData && mat.userData.flat) m.userData.flat = true;
          if(mat.userData && mat.userData.noShadow){ m.userData.flat = true; }
          group.add(m); out.push(m);
        });
        parts.clear();
        return out;
      }
    };
  }

  /* ========================================================== materials */
  let M = null;
  function mats(){
    const T = L();
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness:0.8, metalness:0 }, o));
    const glow = (hex, k, o) => { const m = new THREE.MeshBasicMaterial(Object.assign({ color:new THREE.Color(hex).multiplyScalar(k||1) }, o||{})); m.userData.flat = true; return m; };
    const road = T.asphalt({ puddles:16 }), alleyA = T.asphalt({ puddles:26, base:'#17201f', rough:0.7 }), roofA = T.asphalt({ puddles:8, base:'#262b29', rough:0.85, size:512 });
    const pave = T.paving();
    [road.map, road.rough, road.normal, alleyA.map, alleyA.rough, alleyA.normal].forEach(t=>{ t.wrapS = t.wrapT = THREE.RepeatWrapping; });
    [pave.map, pave.rough, roofA.map, roofA.rough, roofA.normal].forEach(t=>{ t.wrapS = t.wrapT = THREE.RepeatWrapping; });
    const wetStd = (m, k) => T.wet(m, k);
    M = {
      std, glow,
      road: wetStd(std({ map:road.map, roughnessMap:road.rough, normalMap:road.normal, normalScale:new THREE.Vector2(0.25,0.25), roughness:1, color:0xb8c4c0 }), 1.0),
      alley: wetStd(std({ map:alleyA.map, roughnessMap:alleyA.rough, normalMap:alleyA.normal, normalScale:new THREE.Vector2(0.3,0.3), roughness:1, color:0xb0bcb8 }), 1.15),
      pave: wetStd(std({ map:pave.map, roughnessMap:pave.rough, roughness:1, color:0xaab4b0 }), 0.7),
      roof: std({ map:roofA.map, roughnessMap:roofA.rough, roughness:1, color:0x9aa4a0 }),
      curb: std({ color:0x4a5451, roughness:0.7 }),
      metal: std({ color:0x2c3331, roughness:0.45, metalness:0.7 }),
      darkMetal: std({ color:0x181d1c, roughness:0.5, metalness:0.6 }),
      rust: std({ color:0x5a3a28, roughness:0.8, metalness:0.3 }),
      pipe: std({ color:0x3a4442, roughness:0.4, metalness:0.75 }),
      pipeRed: std({ color:0x6a2a20, roughness:0.5, metalness:0.5 }),
      cable: std({ color:0x0c0e0e, roughness:0.6 }),
      concrete: std({ color:0x5a6360, roughness:0.9 }),
      parapet: std({ color:0x3d4543, roughness:0.85 }),
      bag: std({ color:0x0c0e0e, roughness:0.3, metalness:0.1 }),
      bagW: std({ color:0x8a908c, roughness:0.35 }),
      card: std({ color:0x7a6a4a, roughness:0.9 }),
      dumpster: std({ color:0x2f4a3e, roughness:0.55, metalness:0.4 }),
      ac: std({ color:0x9aa39f, roughness:0.6, metalness:0.3 }),
      glass: std({ color:0x0a1614, roughness:0.08, metalness:0.9 }),
      tube: glow(0xc8ffe8, 3.4),
      tubeWarm: glow(0xffd8a8, 2.8),
      bulb: glow(0xfff0c0, 4),
      red: glow(0xff2a1a, 3.2), teal: glow(0x3affd8, 3.2), blue: glow(0x3a9aff, 3.2), amber: glow(0xffa030, 3.2),
      lantern: null, lanternB: null,
      water: wetStd(std({ color:0x0a100f, roughness:0.05, metalness:0.2 }), 1.4),
      line: new THREE.MeshStandardMaterial({ color:0x8a948e, roughness:0.6, transparent:true, opacity:0.4 }),
      tyre: std({ color:0x111111, roughness:0.9 }),
      frame: std({ color:0x7a2a24, roughness:0.4, metalness:0.6 }),
      wood: std({ color:0x5a3e2a, roughness:0.85 }),
      awning: std({ color:0x2a3a36, roughness:0.7 }),
      cloth: std({ color:0x6a1a1a, roughness:0.9, side:THREE.DoubleSide })
    };
    const lt = T.lanternTex(11), lt2 = T.lanternTex(29);
    M.lantern = new THREE.MeshStandardMaterial({ map:lt, emissiveMap:lt, emissive:new THREE.Color(1,1,1), emissiveIntensity:2.3, roughness:0.9 });
    M.lanternB = new THREE.MeshStandardMaterial({ map:lt2, emissiveMap:lt2, emissive:new THREE.Color(1,1,1), emissiveIntensity:2.3, roughness:0.9 });
    // facades: a handful of window walls, reused (and flipped) round the district
    const walls = ['#3a4643','#2f3a38','#46453e','#343a44','#3d3632','#2b3634','#44504a','#38403f'];
    M.facades = walls.map((w, i)=>{ const t = T.windows({ wall:w, seed:17+i*13, lit:0.22+((i*7)%5)*0.05, bays:4, floors:6 });
      t.map.wrapS = t.map.wrapT = THREE.RepeatWrapping; t.glow.wrapS = t.glow.wrapT = THREE.RepeatWrapping;
      return std({ map:t.map, emissiveMap:t.glow, emissive:new THREE.Color(1,1,1), emissiveIntensity:0.85, roughness:0.85 }); });
    // THE SCHOOL'S SKIN (B31), after 41 Cooper Square: perforated stainless-steel panels over glass — silver, in
    // vertical panels, the holes thicker in some than others so the glass and the floors behind come through
    { const c = T.cv(256, 256), x = c.getContext('2d');
      x.fillStyle = '#b4b8bb'; x.fillRect(0, 0, 256, 256);
      for(let p = 0; p < 4; p++){ const x0 = p*64, dens = [0.55, 0.85, 0.35, 0.7][p];
        x.fillStyle = `rgba(255,255,255,${0.05 + p*0.02})`; x.fillRect(x0, 0, 64, 256);
        for(let yy = 3; yy < 256; yy += 6) for(let xx = x0 + 3; xx < x0 + 62; xx += 6){ if(((xx*7 + yy*13) % 100)/100 > dens) continue; x.fillStyle = 'rgba(30,40,48,0.75)'; x.beginPath(); x.arc(xx, yy, 1.7, 0, 7); x.fill(); }
        x.fillStyle = 'rgba(40,44,48,0.6)'; x.fillRect(x0, 0, 2, 256); }
      x.fillStyle = 'rgba(40,44,48,0.5)'; x.fillRect(0, 0, 256, 2); x.fillRect(0, 128, 256, 2);
      const t = T.tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
      M.school = std({ map:t, roughness:0.32, metalness:0.75 });
      // the ground floor: glass, set back, its mullions
      const g = T.cv(256, 128), y = g.getContext('2d'), gr = y.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#3a4c58'); gr.addColorStop(1, '#1c262e');
      y.fillStyle = gr; y.fillRect(0, 0, 256, 128); y.fillStyle = 'rgba(255,240,210,0.18)'; for(let k = 0; k < 6; k++) y.fillRect(10 + k*42, 40, 24, 60);
      y.fillStyle = '#14181c'; for(let k = 0; k <= 4; k++) y.fillRect(k*64 - 2, 0, 4, 128); y.fillRect(0, 0, 256, 5);
      const gt = T.tex(g); gt.wrapS = gt.wrapT = THREE.RepeatWrapping;
      M.schoolBase = std({ map:gt, roughness:0.08, metalness:0.4 }); }
    M.plasters = ['#4a5550','#3f4a47','#5a4a40','#4a4a52','#3a4442'].map(c=>{ const t = T.plaster(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return std({ map:t, roughness:0.9 }); });
    M.shutters = [0,1,2,3,4,5].map(i=>{ const s = T.shutter(100+i*7, { base:['#667570','#5e6b69','#707a6a','#5a6660'][i%4], tag:['#c8322a','#d8402a','#b02a4a','#c83a2a'][i%4] });
      return std({ map:s.map, normalMap:s.normal, normalScale:new THREE.Vector2(0.8,0.8), roughness:0.55, metalness:0.45 }); });
    const insides = ['#ffcf8f','#9ff5d8','#ffb0c8','#c8e8ff','#ffe0a0','#a8ffcc'];
    M.shops = insides.map((c,i)=>{ const t = L().shopfront('', { inside:c, seed:40+i }); const m = glow(0xffffff, 0.8, { map:t }); return m; });
    M.vsigns = [];
    const vs = [['#c9a55a','#2a1208','#2a1a12'], ['#101010','#ff9a3a','#050505'], ['#a8b0a0','#10261c','#1a1a1a'], ['#2a0a08','#ffd070','#120404'], ['#0a1a18','#7affd8','#050a0a'], ['#b89070','#4a0c0c','#301008']];
    for(let i=0;i<10;i++){ const [bg, ink, fr] = vs[i%vs.length]; const t = L().vsign(300+i*11, { bg, ink, frame:fr, n:3+(i%3) });
      M.vsigns.push(glow(0xffffff, 1.25, { map:t })); }
    M.hsigns = [];
    const hs = [['COFFEE SHOP','#0f1a18','#bff5e0'], ['NOODLE BAR','#2a0a06','#ffb070'], ['PARTS 24H','#0a0a12','#8fd3ff'], ['KARAOKE','#1a0616','#ff8ad8'],
                ['PHARMACY','#062010','#7affa8'], ['GEAR / FIX','#101010','#ffd23d'], ['HOTEL','#1a1206','#ffd8a0'], ['DUMPLING','#200808','#ffe0b0']];
    hs.forEach(([t, bg, ink], i)=>{ const tx = L().hsign(t, 500+i*9, { bg, ink }); M.hsigns.push(glow(0xffffff, 1.2, { map:tx })); });
    M.ads = [0,1,2,3,4,5].map(i=>glow(0xffffff, 0.95, { map:L().fashionAd(i) }));
    M.neons = {};
    const add = (k, t) => { const m = new THREE.MeshBasicMaterial({ map:t, color:new THREE.Color(2.2,2.2,2.2), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }); m.userData.flat = true; M.neons[k] = m; };
    add('dragon', L().dragon('#38ffd0'));
    // drawn glyphs, not typed ones: see the note at the top of tshlook.js
    add('tokyo', L().neon((x, w, h)=>{ const lw = x.lineWidth; L().glyphs(x, 2, w*0.2, h/2, h*0.62, false, 77, x.strokeStyle, lw*0.6);
      x.font = 'bold '+(h*0.5|0)+'px '+(window.uiFont ? uiFont() : 'monospace'); x.textAlign = 'center'; x.textBaseline = 'middle'; x.strokeText('NIGHT', w*0.7, h/2+2); }, { w:512, h:160, col:'#38ffd0' }));
    add('pulse', L().neonText('PULSE', '#ff3fd0'));
    add('metro', L().neonText('M  METRO', '#3aaaff'));
    add('hotel', L().neonText('HOTEL', '#ff5a3a'));
    add('open', L().neonText('OPEN 24H', '#ffd23d'));
    add('wfc', L().wfcSign({ col:'#8ff0ff' }));
    add('wfcR', L().wfcSign({ col:'#ff4a4a' }));
    M.sky = new THREE.MeshBasicMaterial({ map:L().skyTex(), side:THREE.BackSide, fog:false, depthWrite:false });
    M.sky.userData.flat = true;
    return M;
  }

  /* ============================================================ the plan */
  /* Streets are rectangles of road with pavement either side; lanes are
     narrower and have none. x runs east, z south. */
  const AVE = { z1:-6, z2:6, walk:4 };          // Neon Avenue
  const MKT = { x1:-6, x2:6, walk:4 };          // Market Street
  const LANES = [                               // [axis, a1, a2]
    ['z', -52, -44, 'LANTERN LANE'], ['z', 44, 52, 'HARBOR LANE'],
    ['x', -62, -56, 'WELL STREET'], ['x', 56, 62, 'KILN STREET']];
  const EDGE = { x:110, z:85 };
  /* THE BUILDINGS. [id, x1, x2, z1, z2, height, facade]. Roofs at 16 m
     and over are "high": the night ends on one of them. */
  const BUILDINGS = [
    // north of the avenue, west of Market — Dragon Alley runs x -49…-31 (eighteen metres: room for the fight)
    ['B1', -56, -49, -44, -26, 10, 0], ['B2', -56, -49, -26, -10, 16, 1],
    ['B3', -31, -24, -44, -26,  9, 2], ['B4', -31, -24, -26, -10, 12, 3],
    ['B5', -21, -10, -44, -10, 12, 4],
    // north of the avenue, east of Market
    ['B6',  10,  34, -30, -10, 22, 5], ['B7',  10,  34, -44, -33, 10, 6], ['B8',  37,  56, -44, -10, 13, 7],
    // the outer ring, north
    ['B9', -110, -62, -85, -52, 24, 1], ['B10', -56, -30, -85, -52, 20, 2], ['B11', -30, -10, -85, -52, 15, 3],
    ['B12', 10, 56, -85, -52, 18, 4], ['B13', 62, 110, -85, -52, 26, 5],
    ['B14', -110, -62, -44, -27, 12, 6], ['B14b', -110, -62, -27, -10, 16, 7],
    ['B16', 62, 86, -44, -33, 9, 0], ['CLUB', 62, 86, -30, -10, 11, 1], ['B17', 86, 110, -44, -10, 19, 2],
    // south of the avenue
    ['B18', -30, -10, 10, 30, 18, 3], ['B21', -30, -10, 33, 44, 8, 4],
    ['B19', -56, -34, 10, 27, 11, 5], ['B20', -56, -34, 30, 44, 9, 6],
    ['B23', 10, 30, 10, 44, 14, 7], ['B24', 34, 56, 10, 26, 10, 0], ['B25', 34, 56, 29, 44, 12, 1],
    ['B26', -110, -62, 10, 44, 13, 2],
    ['B28', 62, 84, 10, 21, 9, 3], ['HOME', 62, 84, 24, 44, 12, 4], ['B29', 84, 110, 10, 44, 20, 5],
    // the outer ring, south
    ['B30', -110, -62, 52, 85, 15, 6], ['B31', -56, -10, 52, 85, 18, 7], ['B32', 10, 56, 52, 85, 14, 0], ['B33', 62, 110, 52, 85, 22, 1]
  ];
  const HIGH = 16;

  /* ============================================================== build */
  function build(root){
    seed(4242);
    const T = L(); mats();
    const B = Batch();
    /* the street and the flat are two groups, so whichever you are not
       in can simply not be drawn */
    const group = new THREE.Group(); root.add(group);
    const out = { solids:[], plats:[], ladders:[], spots:{}, lights:[], screens:[], anims:[], lanterns:[], nav:null,
                  roofs:[], zones:{}, doors:[], cans:[], covers:[], vents:[], M };
    const solid = (x1, x2, z1, z2, y1, y2, tag) => { const s = { x1, x2, z1, z2, y1, y2, tag }; out.solids.push(s); return s; };
    const plat = (x1, x2, z1, z2, top, tag) => { const p = { x1, x2, z1, z2, top, tag }; out.plats.push(p); return p; };
    const lightSrc = (x, y, z, col, k, d) => { out.lights.push({ x, y, z, col:new THREE.Color(col), k, d:d||12 }); };

    /* --------------------------------------------------------- the sky */
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), M.sky); sky.userData.flat = true; sky.userData.sky = true;
    sky.renderOrder = -10; group.add(sky); out.sky = sky;

    /* ------------------------------------------------------- the ground
       The road is one sheet under everything; pavements sit 15 cm on it;
       the alleys and lanes get the wetter tarmac. */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(EDGE.x*2+40, EDGE.z*2+40), M.road);
    ground.rotation.x = -Math.PI/2; ground.userData.flat = true; group.add(ground);
    const uvs = ground.geometry.attributes.uv; for(let i=0;i<uvs.count;i++) uvs.setXY(i, uvs.getX(i)*(EDGE.x*2+40)/14, uvs.getY(i)*(EDGE.z*2+40)/14);
    TSHLOOK.hideInMirror.push(ground);
    plat(-9999, 9999, -9999, 9999, 0, 'street');
    const walkway = (x1, x2, z1, z2) => {
      const w = x2-x1, d = z2-z1;
      B.box(M.pave, (x1+x2)/2, 0.075, (z1+z2)/2, w, 0.15, d, { s:4, faces:'py' });
      plat(x1, x2, z1, z2, 0.15, 'walk');
    };
    const curbs = [];
    // the avenue's pavements, broken where Market Street crosses
    [[-EDGE.x, MKT.x1-MKT.walk], [MKT.x2+MKT.walk, EDGE.x]].forEach(([a, b])=>{
      walkway(a, b, AVE.z1-AVE.walk, AVE.z1); walkway(a, b, AVE.z2, AVE.z2+AVE.walk);
      curbs.push([a, b, AVE.z1, 'x'], [a, b, AVE.z2, 'x']);
    });
    // Market Street's, broken where the avenue crosses
    [[-EDGE.z, AVE.z1-AVE.walk], [AVE.z2+AVE.walk, EDGE.z]].forEach(([a, b])=>{
      walkway(MKT.x1-MKT.walk, MKT.x1, a, b); walkway(MKT.x2, MKT.x2+MKT.walk, a, b);
      curbs.push([a, b, MKT.x1, 'z'], [a, b, MKT.x2, 'z']);
    });
    curbs.forEach(([a, b, at, axis])=>{
      if(axis==='x') B.box(M.curb, (a+b)/2, 0.08, at, b-a, 0.16, 0.22, { faces:'py pz nz' });
      else B.box(M.curb, at, 0.08, (a+b)/2, 0.22, 0.16, b-a, { faces:'py px nx' });
    });
    // painted lines: centre dashes and the crossing's zebra
    for(let x=-EDGE.x; x<EDGE.x; x+=7) if(Math.abs(x) > 16) B.box(M.line, x, 0.012, 0, 3.2, 0.01, 0.18, { faces:'py' });
    for(let z=-EDGE.z; z<EDGE.z; z+=7) if(Math.abs(z) > 16) B.box(M.line, 0, 0.012, z, 0.18, 0.01, 3.2, { faces:'py' });
    for(let k=-5;k<=5;k++){ B.box(M.line, k*1.1, 0.012, -8.5, 0.6, 0.01, 3, { faces:'py' }); B.box(M.line, k*1.1, 0.012, 8.5, 0.6, 0.01, 3, { faces:'py' });
                            B.box(M.line, -8.5, 0.012, k*1.1, 3, 0.01, 0.6, { faces:'py' }); B.box(M.line, 8.5, 0.012, k*1.1, 3, 0.01, 0.6, { faces:'py' }); }
    // the lanes and alleys: wetter tarmac laid a hair over the road
    const alleyFloor = (x1, x2, z1, z2) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x2-x1, z2-z1), M.alley); m.rotation.x = -Math.PI/2;
      m.position.set((x1+x2)/2, 0.004, (z1+z2)/2); m.userData.flat = true; group.add(m); TSHLOOK.hideInMirror.push(m);
      const u = m.geometry.attributes.uv; for(let i=0;i<u.count;i++) u.setXY(i, u.getX(i)*(x2-x1)/9, u.getY(i)*(z2-z1)/9);
    };
    LANES.forEach(([ax, a, b])=>{ if(ax==='z') alleyFloor(-EDGE.x, EDGE.x, a, b); else alleyFloor(a, b, -EDGE.z, EDGE.z); });
    alleyFloor(-49, -31, -44, -10);                          // Dragon Alley
    alleyFloor(-24, -21, -44, -10); alleyFloor(34, 37, -44, -10); alleyFloor(10, 34, -33, -30);
    alleyFloor(-34, -30, 10, 44); alleyFloor(30, 34, 10, 44); alleyFloor(84-22, 84, 21, 24);
    /* THE EDGE OF THE DISTRICT used to be a fence of hoardings across every
       street end. There are none now: the streets run on into Lower
       Manhattan (tshnyc.js), and Robin can follow them. */

    /* ------------------------------------------------------- buildings */
    const blds = BUILDINGS.map(([id, x1, x2, z1, z2, h, f])=>({ id, x1, x2, z1, z2, h, f }));
    const touching = (b, face) => blds.some(o=>o!==b && (
      face==='nz' ? Math.abs(o.z2-b.z1) < 0.5 && o.x1 < b.x2-1 && o.x2 > b.x1+1 :
      face==='pz' ? Math.abs(o.z1-b.z2) < 0.5 && o.x1 < b.x2-1 && o.x2 > b.x1+1 :
      face==='nx' ? Math.abs(o.x2-b.x1) < 0.5 && o.z1 < b.z2-1 && o.z2 > b.z1+1 :
                    Math.abs(o.x1-b.x2) < 0.5 && o.z1 < b.z2-1 && o.z2 > b.z1+1) && o.h >= b.h-0.5);
    blds.forEach(b=>{
      const w = b.x2-b.x1, d = b.z2-b.z1, cx = (b.x1+b.x2)/2, cz = (b.z1+b.z2)/2;
      const faces = ['px','nx','pz','nz'].filter(f=>!touching(b, f)).join(' ') + ' py';
      // the upper floors: windows from 4 m up; the ground floor is dressed separately
      const school = b.id === 'B31';
      B.box(school ? M.school : M.facades[b.f % M.facades.length], cx, (b.h+4)/2, cz, w, b.h-4, d, { s:school ? 6 : 12, sv:school ? 7 : 18, faces:faces.replace('py',''), v0:0 });
      B.box(school ? M.schoolBase : M.plasters[b.f % M.plasters.length], cx, 2, cz, w, 4, d, { s:6, faces:faces.replace('py','') });
      B.box(M.roof, cx, b.h, cz, w, 0.02, d, { s:8, faces:'py' });
      // a band between the shops and the flats, and a parapet round the roof
      B.box(M.concrete, cx, 4.05, cz, w+0.3, 0.3, d+0.3, { faces:'px nx pz nz ny' });
      const pp = 0.35;
      B.box(M.parapet, cx, b.h+0.35, b.z1+pp/2, w, 0.7, pp); B.box(M.parapet, cx, b.h+0.35, b.z2-pp/2, w, 0.7, pp);
      B.box(M.parapet, b.x1+pp/2, b.h+0.35, cz, pp, 0.7, d-2*pp); B.box(M.parapet, b.x2-pp/2, b.h+0.35, cz, pp, 0.7, d-2*pp);
      solid(b.x1, b.x2, b.z1, b.z2, -1, b.h, 'bld:'+b.id);
      plat(b.x1, b.x2, b.z1, b.z2, b.h, 'roof:'+b.id);
      out.roofs.push({ id:b.id, x1:b.x1, x2:b.x2, z1:b.z1, z2:b.z2, h:b.h, high:b.h >= HIGH });
      roofClutter(B, b, out, solid);
      dressGround(B, b, faces, out, lightSrc, solid);
    });

    /* --------------------------------------------------- the skyline
       Past the fence is Lower Manhattan now (tshnyc.js), loaded after
       this. What stays is the WFC tower on the axis of Market Street, so
       it is at the end of the view from almost anywhere and from every
       roof — the model is cut open round its footprint to make room. */
    // the boxes that stood here drew from the seed: draw the same numbers, so everything after them is where it was
    for(let i=0;i<46;i++){
      const a = i/46*Math.PI*2 + rnd(-0.05,0.05), r = rnd(170, 320); rnd(40, 150); rnd(18, 40);
      if(Math.abs(Math.cos(a)*r*1.2) < 30 && Math.sin(a)*r < -150) continue;
      rnd(0.7,1.3); rnd(0,1);
    }
    const TW = { x:0, z:-265, h:210 };
    B.box(M.facades[5], TW.x, TW.h/2, TW.z, 40, TW.h, 40, { s:10, sv:15, faces:'px nx pz nz' });
    solid(TW.x-20, TW.x+20, TW.z-20, TW.z+20, -1, TW.h, 'wfc');              // she can walk to it now, so it is in the way
    B.box(M.darkMetal, TW.x, TW.h+6, TW.z, 30, 12, 30);
    B.box(M.teal, TW.x, TW.h+12.2, TW.z, 30.2, 0.4, 30.2, { faces:'px nx pz nz' });
    for(let k=0;k<5;k++) B.box(M.tube, TW.x, 30+k*38, TW.z+20.1, 41, 0.35, 0.2, { faces:'pz' });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), M.neons.wfc); logo.position.set(TW.x, TW.h-20, TW.z+20.3); logo.userData.flat = true; group.add(logo);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), M.red); beacon.position.set(TW.x, TW.h+22, TW.z); group.add(beacon);
    out.anims.push(t=>{ beacon.visible = (t%1.6) < 0.8; });
    out.spots.tower = [TW.x, TW.z, TW.h];

    /* ------------------------------------------------ Neon Avenue dressing */
    // streetlights, alternating sides, teal-white
    for(let x=-100; x<=100; x+=26){
      if(Math.abs(x) < 14) continue;
      [[-1, 0], [1, 13]].forEach(([s, off])=>{
        const lx = x + off, lz = s*(AVE.z2+AVE.walk-0.6);
        if(lx > 106) return;
        B.box(M.darkMetal, lx, 3.6, lz, 0.18, 7.2, 0.18);
        B.box(M.darkMetal, lx, 7.1, lz - s*1.2, 0.14, 0.14, 2.4);
        B.box(M.tube, lx, 6.95, lz - s*2.1, 0.5, 0.08, 0.9, { faces:'ny' });
        lightSrc(lx, 6.7, lz - s*2.1, 0x9ff5e0, 26, 18);
        solid(lx-0.2, lx+0.2, lz-0.2, lz+0.2, -1, 7.2);
      });
    }
    // billboards and big screens on the avenue faces
    const adAt = (x, y, z, w, h, ry, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.ads[i % M.ads.length]); m.position.set(x, y, z); m.rotation.y = ry; m.userData.flat = true; group.add(m);
      B.box(M.darkMetal, x - Math.sin(ry)*0.15, y, z - Math.cos(ry)*0.15, w+0.5, h+0.5, 0.2, { ry });
      lightSrc(x + Math.sin(ry)*3, y, z + Math.cos(ry)*3, new THREE.Color(TSHLOOK.BRANDS[i % 6][3]).getHex(), 18, 16);
    };
    adAt(-50, 9, -10.02, 6, 11, 0, 0); adAt(-31.5, 8, -10.02, 6, 9, 0, 1); adAt(45, 9.5, -10.02, 7, 12, 0, 2);
    adAt(-20, 11, 10.02, 7, 13, Math.PI, 3); adAt(20, 8.5, 10.02, 6, 10, Math.PI, 4); adAt(-86, 8.5, 10.02, 7, 10, Math.PI, 5);
    adAt(98, 12, 10.02, 8, 14, Math.PI, 0); adAt(-78, 10, -10.02, 7, 12, 0, 3);
    // THE BIG SCREEN on B6's corner: the news, the Director, the adverts
    out.screens.push(screen(group, B, 22, 14.5, -10.05, 17, 9.6, 0, lightSrc));
    out.screens.push(screen(group, B, 74, 16, -10.05, 12, 6.8, 0, lightSrc));
    out.screens.push(screen(group, B, -66, 17, 10.05, 12, 6.8, Math.PI, lightSrc));
    // traffic lights at the crossing, blinking amber at this hour
    [[-7.5, -7.5], [7.5, 7.5], [-7.5, 7.5], [7.5, -7.5]].forEach(([x, z])=>{
      B.box(M.darkMetal, x, 2.5, z, 0.16, 5, 0.16); B.box(M.darkMetal, x, 5, z, 0.5, 1.2, 0.5);
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M.amber.clone()); a.position.set(x, 5.0, z + (z<0 ? 0.26 : -0.26)); group.add(a);
      out.anims.push(t=>{ a.visible = (t%1.2) < 0.6; });
      solid(x-0.2, x+0.2, z-0.2, z+0.2, -1, 5);
    });

    /* ===================================================== DRAGON ALLEY
       The reference, as near as boxes get: shutters with red graffiti,
       fluorescent tubes under a steel canopy, a tangle of pipes and cable
       overhead, paper lanterns, vertical signboards, a bike against the
       dumpster, bags of rubbish, and the dragon in neon at the far end —
       all of it standing in water. */
    alley(group, B, out, lightSrc, solid, plat);

    /* ---------------------------------------------- the other side alleys */
    sideAlley(B, out, -24, -21, -44, -10, 'x', lightSrc);
    sideAlley(B, out, 34, 37, -44, -10, 'x', lightSrc);
    sideAlley(B, out, -34, -30, 10, 44, 'x', lightSrc);
    sideAlley(B, out, 30, 34, 10, 44, 'x', lightSrc);
    // lanterns strung down the lanes, the length of the district
    for(let x=-104; x<=104; x+=9){ if(Math.abs(x) < 8) continue;
      lantern(B, group, out, x, 4.2, -48 + (x%2 ? 0.6 : -0.6), (x/9)|0);
      lantern(B, group, out, x+4.5, 4.4, 48 + (x%2 ? -0.6 : 0.6), ((x/9)|0)+3);
      if(((x+104)/9)%3===0){ lightSrc(x, 3.8, -48, 0xff6a2a, 10, 10); lightSrc(x+4.5, 4, 48, 0xff6a2a, 10, 10); }
    }
    // cables across the lanes
    for(let x=-100; x<=100; x+=14){ cable(B, new V3(x, 7.5, -52), new V3(x+rnd(-4,4), 7.2, -44), 1.2); cable(B, new V3(x, 7, 44), new V3(x+rnd(-4,4), 7.6, 52), 1.0); }

    /* ================================================ places the quest uses */
    placeMetro(group, B, out, 'west', -70, 8, lightSrc, solid);
    placeMetro(group, B, out, 'harbor', 46, 50.5, lightSrc, solid);
    placeVendor(group, B, out, -8.2, -27, lightSrc, solid);
    placeCheckpoint(group, B, out, lightSrc, solid);
    placeClub(group, B, out, lightSrc);
    placeHome(group, B, out, lightSrc, solid, plat);
    placeSchool(group, B, out, lightSrc);
    placeMayaRoof(group, B, out, solid);
    placeWfcPost(group, B, out, lightSrc, solid);
    noodleStand(group, B, out, 40, 8.6, Math.PI, lightSrc, solid);
    noodleStand(group, B, out, -64, -8.6, 0, lightSrc, solid);
    // parked scooters you can take
    out.scooters = [[-58, -8.4, 0], [12, 8.4, Math.PI], [50, -46.5, 0], [-12, 46, 0]].map(([x, z, ry])=>({ x, z, ry }));
    // the high roofs, and the ladders between the ones that meet
    ladders(B, out);

    /* ---------------------------------------------------- the apartment
       Built far off the map (x = 300), the way the game's interiors
       always are: its door is a fade, and the street is not drawn
       through its walls. */
    const ag = new THREE.Group(); root.add(ag);
    const BA = Batch();
    apartment(ag, BA, out, lightSrc, solid, plat);
    BA.build(ag);
    out.aptGroup = ag; out.cityGroup = group;

    out.ceilingAt = overhead(B.over);
    out.lens = lensTest(B.props);
    const meshes = B.build(group);
    out.meshes = meshes;
    out.nav = navGraph(out);
    out.blds = blds;
    return out;
  }

  /* THE UNDERSIDE OF THE CITY, for the chase camera (game.js reads it
     through G.ceiling). Given a spot and the level your feet are on, the
     lowest thing hanging well above your head near that spot — a sign, an
     awning, the alley's canopy, a pipe. A metre of margin, because what
     blinds a camera is not the sign it is inside but the one just in
     front of the lens. Bucketed in 4 m cells: it is asked every frame. */
  function overhead(list){
    const C = 4, M = 1.0, cells = new Map();
    const key = (i, j) => i*100003 + j;
    list.forEach(o=>{
      for(let i=Math.floor((o.x1-M)/C); i<=Math.floor((o.x2+M)/C); i++)
        for(let j=Math.floor((o.z1-M)/C); j<=Math.floor((o.z2+M)/C); j++){
          const k = key(i, j); if(!cells.has(k)) cells.set(k, []); cells.get(k).push(o);
        }
    });
    return (x, z, feet) => {
      const c = cells.get(key(Math.floor(x/C), Math.floor(z/C))); if(!c) return Infinity;
      let lid = Infinity;
      for(const o of c){
        // only what there is room to get under: a sign frame a hand above your hair is looked OVER, not ducked under
        if(o.y1 > feet + 2.55 && o.y1 < lid && x > o.x1-M && x < o.x2+M && z > o.z1-M && z < o.z2+M) lid = o.y1;
      }
      return lid;
    };
  }

  /* WHAT THE LENS CAN BUMP INTO. Every prop in the district as a box, in
     4 m cells: near() — is anything within r of this point; seg() — is
     anything between these two. The chase camera asks both before it
     settles anywhere (tsh.js, chaseCam). */
  function lensTest(list){
    const C = 4, cells = new Map(), key = (i, j) => i*100003 + j;
    list.forEach(o=>{
      for(let i=Math.floor(o.x1/C); i<=Math.floor(o.x2/C); i++)
        for(let j=Math.floor(o.z1/C); j<=Math.floor(o.z2/C); j++){ const k = key(i, j); if(!cells.has(k)) cells.set(k, []); cells.get(k).push(o); }
    });
    let stamp = 0;
    const near = (x, y, z, r) => {
      stamp++;
      for(let i=Math.floor((x-r)/C); i<=Math.floor((x+r)/C); i++) for(let j=Math.floor((z-r)/C); j<=Math.floor((z+r)/C); j++){
        const c = cells.get(key(i, j)); if(!c) continue;
        for(const o of c){
          if(o.s === stamp) continue; o.s = stamp;
          const dx = x < o.x1 ? o.x1 - x : x > o.x2 ? x - o.x2 : 0, dy = y < o.y1 ? o.y1 - y : y > o.y2 ? y - o.y2 : 0, dz = z < o.z1 ? o.z1 - z : z > o.z2 ? z - o.z2 : 0;
          if(dx*dx + dy*dy + dz*dz < r*r) return true;
        }
      }
      return false;
    };
    const slab = (a, d, lo, hi, t) => {                 // one axis of the slab test; t = [t0, t1]
      if(Math.abs(d) < 1e-9) return a >= lo && a <= hi;
      let u = (lo - a)/d, v = (hi - a)/d; if(u > v){ const w = u; u = v; v = w; }
      t[0] = Math.max(t[0], u); t[1] = Math.min(t[1], v); return t[0] <= t[1];
    };
    const seg = (ax, ay, az, bx, by, bz) => {
      stamp++;
      const dx = bx-ax, dy = by-ay, dz = bz-az;
      for(let i=Math.floor(Math.min(ax, bx)/C); i<=Math.floor(Math.max(ax, bx)/C); i++) for(let j=Math.floor(Math.min(az, bz)/C); j<=Math.floor(Math.max(az, bz)/C); j++){
        const c = cells.get(key(i, j)); if(!c) continue;
        for(const o of c){
          if(o.s === stamp) continue; o.s = stamp;
          const t = [0, 1];
          if(slab(ax, dx, o.x1, o.x2, t) && slab(ay, dy, o.y1, o.y2, t) && slab(az, dz, o.z1, o.z2, t)) return true;
        }
      }
      return false;
    };
    return { near, seg, count:list.length };
  }

  /* ------------------------------------------------------------ props */
  const G_ = {};                       // shared prop geometries
  function geo(){
    if(G_.ready) return G_;
    G_.lantern = new THREE.LatheGeometry([[0,-0.34],[0.16,-0.32],[0.24,-0.2],[0.27,0],[0.24,0.2],[0.16,0.32],[0,0.34]].map(([x,y])=>new THREE.Vector2(x,y)), 12);
    G_.cap = new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10);
    G_.bag = new THREE.SphereGeometry(0.38, 8, 6);
    G_.cyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false);
    G_.cylLo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
    G_.torus = new THREE.TorusGeometry(0.34, 0.035, 6, 18);
    G_.box = new THREE.BoxGeometry(1, 1, 1);
    G_.sphere = new THREE.SphereGeometry(1, 10, 8);
    G_.ready = true;
    return G_;
  }
  function lantern(B, group, out, x, y, z, i){
    const g = geo();
    B.geo(i%3 ? M.lantern : M.lanternB, g.lantern, new V3(x, y, z), null, new V3(1, 1, 1));
    B.geo(M.darkMetal, g.cap, new V3(x, y+0.36, z)); B.geo(M.darkMetal, g.cap, new V3(x, y-0.36, z));
    B.geo(M.cable, g.cylLo, new V3(x, y+0.7, z), null, new V3(0.01, 0.6, 0.01));
    B.geo(M.red, g.cylLo, new V3(x, y-0.55, z), null, new V3(0.03, 0.3, 0.03));
    out.lanterns.push([x, y, z]);
  }
  function cable(B, a, b, sag){
    const mid = a.clone().add(b).multiplyScalar(0.5); mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    B.geo(M.cable, new THREE.TubeGeometry(curve, 10, 0.025, 4, false));
  }
  function pipe(B, a, b, r, mat){
    const d = new V3().subVectors(b, a), len = d.length(), g = geo();
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0), d.clone().normalize());
    B.geo(mat || M.pipe, g.cyl, a.clone().add(b).multiplyScalar(0.5), new THREE.Euler().setFromQuaternion(q), new V3(r, len, r));
  }
  function acUnit(B, x, y, z, ry){
    B.box(M.ac, x, y, z, 0.9, 0.62, 0.42, { ry });
    B.box(M.darkMetal, x + Math.sin(ry)*0.215, y, z + Math.cos(ry)*0.215, 0.5, 0.5, 0.02, { ry });
    B.box(M.darkMetal, x - Math.sin(ry)*0.35, y-0.36, z - Math.cos(ry)*0.35, 0.8, 0.05, 0.4, { ry });
  }
  function trash(B, out, x, z, n){
    const g = geo();
    for(let i=0;i<n;i++){
      const s = rnd(0.55, 0.9);
      B.geo(rand()<0.8 ? M.bag : M.bagW, g.bag, new V3(x+rnd(-0.6,0.6), 0.26*s, z+rnd(-0.6,0.6)), new THREE.Euler(rnd(0,0.5), rnd(0,3), rnd(-0.2,0.2)), new V3(s, 0.7*s, s*0.85));
    }
    if(rand() < 0.6) B.box(M.card, x+rnd(-0.8,0.8), 0.25, z+rnd(-0.8,0.8), rnd(0.5,0.8), 0.5, rnd(0.4,0.6), { ry:rnd(0,1) });
    out.cans.push([x+rnd(-0.9,0.9), z+rnd(-0.9,0.9)]);
  }
  function bike(B, x, z, ry){
    const g = geo(), R = new THREE.Euler(0, ry, 0), c = Math.cos(ry), s = Math.sin(ry);
    const P = (lx, ly) => new V3(x + lx*c, ly, z - lx*s);
    B.geo(M.tyre, g.torus, P(-0.55, 0.36), new THREE.Euler(0, ry, 0)); B.geo(M.tyre, g.torus, P(0.55, 0.36), new THREE.Euler(0, ry, 0));
    pipe(B, P(-0.55, 0.36), P(0, 0.7), 0.02, M.frame); pipe(B, P(0.55, 0.36), P(0.35, 0.85), 0.02, M.frame);
    pipe(B, P(0, 0.7), P(0.35, 0.85), 0.02, M.frame); pipe(B, P(-0.05, 0.4), P(0, 0.7), 0.02, M.frame);
    pipe(B, P(-0.05, 0.4), P(-0.55, 0.36), 0.02, M.frame); pipe(B, P(0, 0.7), P(-0.1, 0.9), 0.02, M.frame);
    B.box(M.darkMetal, x - 0.1*c, 0.93, z + 0.1*s, 0.25, 0.05, 0.12, { ry });
    pipe(B, P(0.35, 0.85), P(0.38, 1.02), 0.02, M.darkMetal);
    B.box(M.darkMetal, x + 0.38*c, 1.02, z - 0.38*s, 0.08, 0.04, 0.55, { ry });
  }
  function dumpster(B, out, x, z, ry, solid, plat){
    B.box(M.dumpster, x, 0.62, z, 1.9, 1.24, 1.05, { ry });
    B.box(M.darkMetal, x, 1.28, z + 0.05, 2.0, 0.08, 1.15, { ry });
    const c = Math.abs(Math.cos(ry)), w = c > 0.5 ? 1.9 : 1.05, d = c > 0.5 ? 1.05 : 1.9;
    solid(x-w/2, x+w/2, z-d/2, z+d/2, -1, 1.3, 'dumpster'); plat(x-w/2, x+w/2, z-d/2, z+d/2, 1.32, 'dumpster');
    out.covers.push([x, z, 1.4]);
  }
  /* A CAR, parked along the west wall of Dragon Alley: somewhere in the
     fight to put one of the buyer's crew (tshfight.js throws a man at it,
     and it rocks and its alarm goes). The model is Higgsfield's — a photo
     of a tired old hatchback lifted into 3D by SAM 3D (tsh/alley/car.glb,
     200 KB) — and until it has come down a dark box stands in for it. */
  function parkedCar(group, out, x, z, solid, plat){
    const len = 3.7, wid = 1.86, h = 1.55;
    const car = { x, z, x1:x - wid/2, x2:x + wid/2, z1:z - len/2, z2:z + len/2, mesh:new THREE.Group() };
    car.mesh.position.set(x, 0, z); group.add(car.mesh);
    const stand = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color:0x15181b, roughness:0.45, metalness:0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.8, len), paint); body.position.y = 0.6; stand.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(wid*0.86, 0.6, len*0.55), paint); cab.position.set(0, 1.25, -0.2); stand.add(cab);
    car.mesh.add(stand);
    solid(car.x1, car.x2, car.z1, car.z2, -1, h, 'car'); plat(car.x1, car.x2, car.z1, car.z2, h, 'car');
    out.covers.push([x, z, h]);
    out.car = car;
    if(!THREE.GLTFLoader) return;
    const L = new THREE.GLTFLoader(); if(window.MeshoptDecoder) L.setMeshoptDecoder(window.MeshoptDecoder);
    L.load('tsh/alley/car.glb?v=' + (window.ASSETV || '1'), g=>{
      const m = g.scene;
      const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
      m.scale.setScalar(len/size.z); m.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
      m.position.set(-c.x, -b.min.y, -c.z);
      // SAM leaves glTF's fully-metal default, which with nothing to reflect is black: old paint, glass and rubber
      m.traverse(n=>{ if(!n.isMesh) return; n.castShadow = n.receiveShadow = true;
        const mt = n.material; if(mt){ mt.metalness = 0.15; mt.roughness = 0.55; if(mt.map) mt.map.colorSpace = THREE.SRGBColorSpace; mt.needsUpdate = true; } });
      car.mesh.add(m); car.mesh.remove(stand);
    }, undefined, ()=>{});
  }
  function vending(B, group, out, x, z, ry, col, lightSrc, solid){
    B.box(M.darkMetal, x, 0.95, z, 1.0, 1.9, 0.8, { ry });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.3), M.glow(col, 2.6)); m.position.set(x + Math.sin(ry)*0.41, 1.15, z + Math.cos(ry)*0.41); m.rotation.y = ry; group.add(m);
    lightSrc(x + Math.sin(ry)*1.2, 1.2, z + Math.cos(ry)*1.2, col, 5, 6);
    solid(x-0.55, x+0.55, z-0.5, z+0.5, -1, 1.9);
  }
  function screen(group, B, x, y, z, w, h, ry, lightSrc){
    const c = TSHLOOK.cv(512, 288), t = TSHLOOK.tex(c);
    const mat = new THREE.MeshBasicMaterial({ map:t, color:new THREE.Color(1.15, 1.15, 1.15) }); mat.userData.flat = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.userData.flat = true; group.add(m);
    B.box(M.darkMetal, x - Math.sin(ry)*0.25, y, z - Math.cos(ry)*0.25, w+0.8, h+0.8, 0.4, { ry });
    lightSrc(x + Math.sin(ry)*6, y - 2, z + Math.cos(ry)*6, 0x8fd8ff, 40, 30);
    return { mesh:m, canvas:c, tex:t, x, y, z, ry, w, h };
  }

  /* The ground floor, face by face: shutters, lit shops, doors, signs
     sticking out, AC units dripping onto the pavement, tubes under the
     awnings. Only faces that front a street or an alley. */
  function dressGround(B, b, faces, out, lightSrc, solid){
    const T = L();
    const list = faces.split(' ').filter(f=>f && f!=='py');
    list.forEach(f=>{
      const along = f==='pz'||f==='nz' ? 'x' : 'z';
      const a1 = along==='x' ? b.x1 : b.z1, a2 = along==='x' ? b.x2 : b.z2;
      const wallAt = f==='pz' ? b.z2 : f==='nz' ? b.z1 : f==='px' ? b.x2 : b.x1;
      const out_ = (f==='pz'||f==='px') ? 1 : -1;
      const ry = f==='pz' ? 0 : f==='nz' ? Math.PI : f==='px' ? Math.PI/2 : -Math.PI/2;
      const P = (a, up, off) => along==='x' ? new V3(a, up, wallAt + out_*off) : new V3(wallAt + out_*off, up, a);
      // outer-ring buildings face only the lanes; skip their far sides entirely
      if(Math.abs(wallAt) >= EDGE.x-1 || (along==='x' && Math.abs(wallAt) >= EDGE.z-1)) return;
      if(b.id === 'B31') return;                     // the school: no shops, no shutters (placeSchool dresses its front)
      const bay = 3.6, n = Math.floor((a2-a1)/bay);
      const start = a1 + ((a2-a1) - n*bay)/2;
      const busy = isBusy(b, f);
      for(let i=0;i<n;i++){
        const c = start + (i+0.5)*bay, r = rand();
        const kind = busy ? (r < 0.45 ? 'shop' : r < 0.85 ? 'shutter' : 'door') : (r < 0.55 ? 'shutter' : r < 0.7 ? 'shop' : r < 0.85 ? 'door' : 'blank');
        const pos = P(c, 1.7, 0.03);
        if(kind==='shutter'){
          const m = pick(M.shutters);
          B.box(m, pos.x, 1.6, pos.z, bay-0.3, 3.2, 0.06, { ry, s:3.4, faces:'pz' });
          B.box(M.darkMetal, pos.x, 3.35, pos.z, bay-0.1, 0.35, 0.3, { ry, faces:'pz py ny' });
        } else if(kind==='shop'){
          B.box(pick(M.shops), pos.x, 1.55, pos.z, bay-0.4, 2.9, 0.05, { ry, faces:'pz' });
          const s = P(c, 3.45, 0.18);
          B.box(pick(M.hsigns), s.x, 3.45, s.z, bay-0.2, 0.8, 0.12, { ry, faces:'pz' });
          // awning with a tube under it
          const aw = P(c, 3.0, 0.9);
          B.box(M.awning, aw.x, 3.0, aw.z, bay-0.1, 0.08, 1.7, { ry });
          const tb = P(c, 2.93, 1.4);
          B.box(M.tube, tb.x, 2.93, tb.z, bay*0.7, 0.05, 0.05, { ry });
          if(rand() < 0.5) lightSrc(tb.x, 2.6, tb.z, 0xc8ffe8, 7, 7);
        } else if(kind==='door'){
          B.box(M.darkMetal, pos.x, 1.15, pos.z, 1.2, 2.3, 0.08, { ry, faces:'pz' });
          const bl = P(c, 2.55, 0.12); B.box(M.bulb, bl.x, 2.55, bl.z, 0.18, 0.18, 0.18);
        }
        // signs that stick out from the wall, the way the reference is signed
        if(rand() < (busy ? 0.35 : 0.2)){
          const s = P(c+bay*0.45, 5.4, 0.55);
          const sm = pick(M.vsigns);
          B.box(M.darkMetal, s.x, 5.4, s.z, along==='x' ? 0.12 : 1.1, 2.3, along==='x' ? 1.1 : 0.12);
          const face1 = P(c+bay*0.45, 5.4, 0.55);
          if(along==='x'){ B.box(sm, face1.x+0.07, 5.4, face1.z, 0.02, 2.2, 1.0, { faces:'px' }); B.box(sm, face1.x-0.07, 5.4, face1.z, 0.02, 2.2, 1.0, { faces:'nx' }); }
          else { B.box(sm, face1.x, 5.4, face1.z+0.07, 1.0, 2.2, 0.02, { faces:'pz' }); B.box(sm, face1.x, 5.4, face1.z-0.07, 1.0, 2.2, 0.02, { faces:'nz' }); }
          lightSrc(face1.x + (along==='z' ? out_*0.8 : 0), 5.2, face1.z + (along==='x' ? out_*0.8 : 0), 0xffd8a0, 4, 6);
        }
        if(rand() < 0.4){ const a = P(c, 4.8+rnd(0,6), 0.25); acUnit(B, a.x, a.y, a.z, ry); }
        if(rand() < 0.3){ const p0 = P(c+bay*0.48, 0, 0.12); pipe(B, p0, new V3(p0.x, b.h, p0.z), 0.07, rand()<0.3 ? M.pipeRed : M.pipe); }
      }
    });
  }
  function isBusy(b, f){
    // faces on the avenue and Market Street are shops; lanes and alleys mostly shut
    if(f==='pz' && Math.abs(b.z2 - AVE.z1 + AVE.walk) < 1) return true;
    if(f==='nz' && Math.abs(b.z1 - AVE.z2 - AVE.walk) < 1) return true;
    if(f==='px' && Math.abs(b.x2 - MKT.x1 + MKT.walk) < 1) return true;
    if(f==='nx' && Math.abs(b.x1 - MKT.x2 - MKT.walk) < 1) return true;
    return false;
  }
  function roofClutter(B, b, out, solid){
    const w = b.x2-b.x1, d = b.z2-b.z1, n = Math.max(1, Math.floor(w*d/120));
    for(let i=0;i<n;i++){
      const x = rnd(b.x1+2, b.x2-2), z = rnd(b.z1+2, b.z2-2), r = rand();
      if(r < 0.35){ acUnit(B, x, b.h+0.35, z, rnd(0,3)); }
      else if(r < 0.55){                                  // a water tank on legs
        const g = geo(); B.geo(M.rust, g.cyl, new V3(x, b.h+2.4, z), null, new V3(1.2, 2.0, 1.2));
        [[-0.8,-0.8],[0.8,-0.8],[-0.8,0.8],[0.8,0.8]].forEach(([a,c])=>B.box(M.darkMetal, x+a, b.h+0.7, z+c, 0.12, 1.4, 0.12));
        solid(x-1.3, x+1.3, z-1.3, z+1.3, b.h-0.1, b.h+3.5);
      } else if(r < 0.75){                                // a stair hut with a lit door
        B.box(M.concrete, x, b.h+1.3, z, 2.6, 2.6, 2.2); B.box(M.tubeWarm, x, b.h+2.3, z+1.12, 0.6, 0.06, 0.06);
        solid(x-1.3, x+1.3, z-1.1, z+1.1, b.h-0.1, b.h+2.6);
      } else {                                            // an antenna and a vent
        pipe(B, new V3(x, b.h, z), new V3(x, b.h+rnd(3,7), z), 0.05, M.darkMetal);
        out.vents.push([x+0.6, b.h+0.8, z]); B.box(M.metal, x+0.6, b.h+0.4, z, 0.5, 0.8, 0.5);
      }
    }
  }
  function sideAlley(B, out, x1, x2, z1, z2, _ax, lightSrc){
    const cx = (x1+x2)/2;
    for(let z=z1+3; z<z2-2; z+=5.5){
      cable(B, new V3(x1, rnd(5,8), z), new V3(x2, rnd(5,8), z+rnd(-2,2)), 0.5);
      if(rand()<0.5) trash(B, out, x1+0.8, z+1, 3);
      if(rand()<0.35){ B.box(M.tube, x2-0.2, 3.2, z, 0.05, 0.05, 1.2); lightSrc(cx, 3, z, 0xb8ffe0, 5, 7); }
    }
    pipe(B, new V3(x1+0.2, 5, z1), new V3(x1+0.2, 5, z2), 0.12);
    pipe(B, new V3(x2-0.2, 6.2, z1), new V3(x2-0.2, 6.2, z2), 0.08, M.pipeRed);
    out.covers.push([cx, (z1+z2)/2, 1]);
  }

  /* ========================================================== the alley */
  function alley(group, B, out, lightSrc, solid, plat){
    const X1 = -49, X2 = -31, Z1 = -44, Z2 = -10, CX = (X1+X2)/2;
    // the canopy: a steel frame over the middle of it, grated, with tubes under
    for(let z=Z1+4; z<Z2-4; z+=3){
      B.box(M.darkMetal, CX, 4.4, z, X2-X1, 0.14, 0.14);
      if(z < -16){ B.box(M.darkMetal, CX, 4.5, z+1.5, X2-X1, 0.04, 2.9); }
    }
    B.box(M.darkMetal, X1+0.1, 4.4, (Z1+Z2)/2, 0.14, 0.14, Z2-Z1-8); B.box(M.darkMetal, X2-0.1, 4.4, (Z1+Z2)/2, 0.14, 0.14, Z2-Z1-8);
    [-38, -32, -26, -20].forEach(z=>{ B.box(M.tube, CX-0.8, 4.3, z, 0.06, 0.06, 1.8); B.box(M.tube, CX+1.2, 4.3, z+1.4, 1.6, 0.06, 0.06);
      // eighteen metres wide, to fight in: a light that reaches both walls (the city lends only a few real lights at once)
      lightSrc(CX, 3.6, z, 0xb8ffe0, 30, 16);
      [-3.4, 3.4].forEach(dx=>B.box(M.tube, CX+dx, 4.3, z+0.7, 0.06, 0.06, 1.8)); });
    // pipes along both walls and a few across, cables everywhere
    [[X1+0.18, 5.2, 0.14], [X1+0.18, 5.6, 0.08], [X2-0.18, 6.4, 0.16], [X2-0.18, 4.9, 0.07]].forEach(([x, y, r], i)=>pipe(B, new V3(x, y, Z1), new V3(x, y, Z2), r, i===2 ? M.pipeRed : M.pipe));
    for(let z=Z1+3; z<Z2-1; z+=4){ pipe(B, new V3(X1, 6.8+rnd(-0.3,0.4), z), new V3(X2, 6.8+rnd(-0.3,0.4), z+rnd(-1,1)), 0.06);
      for(let k=0;k<3;k++) cable(B, new V3(X1, rnd(5.5, 9), z+rnd(-2,2)), new V3(X2, rnd(5.5, 9), z+rnd(-2,2)), rnd(0.3, 1.2)); }
    // lanterns, in pairs down both walls
    for(let z=Z1+3; z<Z2-2; z+=4.2){ lantern(B, group, out, X1+0.7, 3.25, z, 7+z|0); lantern(B, group, out, X2-0.7, 3.4, z+2.1, 13+z|0);
      lightSrc(X1+1, 3.0, z, 0xff5a1a, 7, 7); }
    // vertical signs on the walls, lit
    [[X1+0.1, -35, 'nx'], [X2-0.1, -29, 'px'], [X1+0.1, -22, 'nx'], [X2-0.1, -16, 'px'], [X2-0.1, -40, 'px']].forEach(([x, z, f], i)=>{
      B.box(M.vsigns[(i*3)%M.vsigns.length], x + (f==='nx' ? 0.12 : -0.12), 3.6, z, 0.06, 2.4, 0.7, { faces:f==='nx' ? 'px' : 'nx' });
    });
    // the dragon, and a sign beside it, on the far wall of the bend
    const dr = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), M.neons.dragon); dr.position.set(X2-0.12, 4.2, -41); dr.rotation.y = -Math.PI/2; dr.userData.flat = true; group.add(dr);
    const tk = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.95), M.neons.tokyo); tk.position.set(X2-0.12, 6.3, -40.5); tk.rotation.y = -Math.PI/2; tk.userData.flat = true; group.add(tk);
    lightSrc(X2-1.2, 4.2, -41, 0x38ffd0, 16, 11);
    // the dumpster, the bike, the bags, a vending machine and the mailboxes
    dumpster(B, out, X1+1.1, -21, Math.PI/2, solid, plat);
    bike(B, X1+1.4, -17.6, Math.PI/2+0.25);
    trash(B, out, X1+0.9, -24.5, 5); trash(B, out, X2-0.9, -33, 4); trash(B, out, X1+0.9, -39, 3); trash(B, out, X2-0.8, -13, 3);
    vending(B, group, out, X2-0.55, -36.5, -Math.PI/2, 0x7affd8, lightSrc, solid);
    out.alleyBlocks = [{ x1:X1+0.58, x2:X1+1.62, z1:-21.95, z2:-20.05 }, { x1:X2-1.1, x2:X2, z1:-37, z2:-36 }];   // the dumpster and the vending machine, for the fight
    parkedCar(group, out, X1+1.02, -34.2, solid, plat);
    B.box(M.card, X2-0.6, 0.3, -24, 0.7, 0.6, 0.6, { ry:0.3 }); B.box(M.card, X2-0.7, 0.8, -24.2, 0.5, 0.4, 0.5, { ry:-0.2 });
    // the dead drop: a bank of mail slots on the east wall by the lane
    B.box(M.metal, X2-0.12, 1.5, -42.2, 0.2, 1.2, 1.4);
    for(let r=0;r<3;r++) for(let c=0;c<4;c++) B.box(M.darkMetal, X2-0.23, 1.1+r*0.36, -42.75+c*0.36, 0.02, 0.08, 0.26, { faces:'nx' });
    out.spots.drop = [X2-0.9, -42.2, 1.6];
    // steam from a grate, and a puddle you can see
    out.vents.push([CX+0.8, 0.1, -29.5]); B.box(M.darkMetal, CX+0.8, 0.02, -29.5, 1.0, 0.04, 0.6, { faces:'py' });
    out.zones.alley = { x1:X1, x2:X2, z1:Z1, z2:Z2 };
    out.spots.alleyMouth = [CX, -11, 0]; out.spots.alleyBack = [CX, -43, 0];
    out.spots.kai = [CX+0.4, -27.5, 0];
    out.spots.dealStand = [CX-0.2, -23.5, 0];
    out.covers.push([X1+0.7, -26, 1], [X2-0.7, -30, 1], [X1+0.8, -37, 1]);
  }

  /* ============================================================ places */
  function placeMetro(group, B, out, id, x, z, lightSrc, solid){
    // a stair head with a glowing sign; the stairs go down into the dark
    B.box(M.darkMetal, x, 1.1, z-1.6, 3.4, 1.1, 0.12); B.box(M.darkMetal, x-1.7, 0.55, z, 0.12, 1.1, 3.2); B.box(M.darkMetal, x+1.7, 0.55, z, 0.12, 1.1, 3.2);
    B.box(M.concrete, x, 0.02, z, 3.2, 0.04, 3.2, { faces:'py' });
    for(let k=0;k<5;k++) B.box(M.concrete, x, -0.2-k*0.3, z-1.2+k*0.55, 3.1, 0.3, 0.55);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.9), M.neons.metro); s.position.set(x, 2.6, z-1.6); s.userData.flat = true; group.add(s);
    B.box(M.darkMetal, x, 2.6, z-1.68, 3, 1, 0.1); B.box(M.darkMetal, x-1.4, 1.3, z-1.66, 0.1, 2.6, 0.1); B.box(M.darkMetal, x+1.4, 1.3, z-1.66, 0.1, 2.6, 0.1);
    // the gate camera: a little dome that sees faces
    const cam = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), M.red); cam.position.set(x+1.2, 3.1, z-1.5); group.add(cam);
    out.anims.push(t=>{ cam.visible = (t%2) < 1.4; });
    lightSrc(x, 2.2, z, 0x3aaaff, 10, 8);
    solid(x-1.8, x+1.8, z-1.7, z-1.5, -1, 1.2);
    out.spots['metro_'+id] = [x, z+1.8, 1.5];
  }
  function placeVendor(group, B, out, x, z, lightSrc, solid){
    B.box(M.wood, x, 0.5, z, 1.2, 1.0, 3.2); B.box(M.cloth, x-0.2, 2.7, z, 2.0, 0.06, 3.8);
    [[-1, -1.8], [-1, 1.8], [0.55, -1.8], [0.55, 1.8]].forEach(([a,b])=>B.box(M.darkMetal, x+a*0.8, 1.35, z+b, 0.06, 2.7, 0.06));
    // gloves and rings on the counter, glowing — knock-offs of Robin's
    for(let k=0;k<5;k++){ const g = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.3), M.teal); g.position.set(x+0.1, 1.05, z-1.2+k*0.6); group.add(g); }
    B.box(M.tubeWarm, x-0.2, 2.62, z, 0.05, 0.05, 3);
    lightSrc(x+1, 2.2, z, 0xffc070, 12, 8);
    solid(x-0.7, x+0.7, z-1.7, z+1.7, -1, 1.0);
    out.spots.vendor = [x+1.1, z, 2.4];
  }
  function placeCheckpoint(group, B, out, lightSrc, solid){
    const x = 30;
    out.checkpoint = { x, parts:[], z1:-10, z2:10, arches:[] };
    const g = new THREE.Group(); group.add(g); out.checkpoint.group = g;
    // barriers across the road, leaving the arches on the pavements as the way through
    for(let z=-5.5; z<=5.5; z+=2.2){
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 2.0), new THREE.MeshStandardMaterial({ color:0xd8d8d0, roughness:0.6 }));
      m.position.set(x, 0.5, z); g.add(m);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 2.02), M.red); st.position.set(x, 0.85, z); g.add(st);
    }
    [-8, 8].forEach(z=>{
      const a = new THREE.Group(); a.position.set(x, 0.15, z); g.add(a);
      const mk = (w, h, d, px, py, pz, m) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.position.set(px, py, pz); a.add(q); return q; };
      mk(0.3, 2.6, 0.3, 0, 1.3, -1.3, M.darkMetal); mk(0.3, 2.6, 0.3, 0, 1.3, 1.3, M.darkMetal); mk(0.3, 0.3, 2.9, 0, 2.6, 0, M.darkMetal);
      const beam = mk(0.05, 0.05, 2.5, 0, 2.4, 0, M.teal);
      out.checkpoint.arches.push({ x, z, beam, a });
    });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), M.neons.wfc); logo.position.set(x-0.35, 1.8, 0); logo.rotation.y = -Math.PI/2; logo.userData.flat = true; g.add(logo);
    out.checkpoint.solids = [{ x1:x-0.35, x2:x+0.35, z1:-6.6, z2:6.6, y1:-1, y2:1.0, tag:'checkpoint' }];
    out.checkpoint.light = [x-3, 3, 0, 0x8ff0ff, 20, 14];
  }
  function placeClub(group, B, out, lightSrc){
    const x = 72, z = -10.05;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), M.neons.pulse); s.position.set(x, 6, z-0.05); s.userData.flat = true; group.add(s);
    B.box(M.darkMetal, x, 1.4, z, 3, 2.8, 0.1, { faces:'pz' });
    B.box(M.glow(0xff3fd0, 3), x, 2.9, z+0.1, 3.2, 0.08, 0.08);
    // a rope line
    [-2.4, -0.8, 0.8, 2.4].forEach(k=>B.box(M.metal, x+k, 0.55, z+2.3, 0.1, 1.1, 0.1));
    B.box(M.glow(0xff2050, 2.2), x, 0.95, z+2.3, 4.8, 0.05, 0.05);
    lightSrc(x, 3, z+3, 0xff3fd0, 22, 14);
    out.spots.club = [x, z+3.5, 3];
  }
  function noodleStand(group, B, out, x, z, ry, lightSrc, solid){
    B.box(M.wood, x, 0.55, z, 2.6, 1.1, 1.0, { ry }); B.box(M.cloth, x, 2.5, z, 3.0, 0.06, 1.6, { ry });
    const c = Math.cos(ry), s = Math.sin(ry);
    lantern(B, group, out, x - 1.2*c, 2.1, z + 1.2*s, 3); lantern(B, group, out, x + 1.2*c, 2.1, z - 1.2*s, 4);
    lightSrc(x, 2, z, 0xff8a3a, 12, 8);
    solid(x-1.3, x+1.3, z-0.6, z+0.6, -1, 1.1);
    out.vents.push([x, 1.3, z]);
  }
  function placeWfcPost(group, B, out, lightSrc, solid){
    const x = 22, z = -50.5;
    B.box(M.darkMetal, x, 1.5, z, 5, 3, 3); B.box(M.glass, x, 1.7, z+1.52, 4, 1.4, 0.02, { faces:'pz' });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), M.neons.wfc); logo.position.set(x, 3.6, z+1.55); logo.userData.flat = true; group.add(logo);
    B.box(M.teal, x, 3.02, z, 5.1, 0.06, 3.1, { faces:'px nx pz nz' });
    lightSrc(x, 3, z+2.5, 0x8ff0ff, 12, 10);
    solid(x-2.5, x+2.5, z-1.5, z+1.5, -1, 3);
    out.spots.wfcPost = [x, z+3, 3];
  }
  function placeMayaRoof(group, B, out, solid){
    // Maya's building (B18): a water tower on the corner and a clear line down the avenue
    const x = -13.5, z = 12.5, h = 18, g = geo();
    B.geo(M.rust, g.cyl, new V3(x, h+3.4, z+3), null, new V3(1.5, 2.4, 1.5));
    B.geo(M.darkMetal, new THREE.ConeGeometry(1.6, 0.8, 10), new V3(x, h+5, z+3));
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,c])=>B.box(M.darkMetal, x+a, h+1.1, z+3+c, 0.12, 2.2, 0.12));
    solid(x-1.7, x+1.7, z+1.3, z+4.7, h-0.1, h+4.8);
    out.spots.maya = [-21, 10.8, h];               // where she stands, looking north
  }
  function placeHome(group, B, out, lightSrc, solid, plat){
    // HOME: Robin's building. Door on Harbor Lane; fire escape up the Kiln Street side.
    const dx = 73, dz = 44;
    B.box(M.metal, dx, 1.25, dz+0.06, 1.4, 2.5, 0.1, { faces:'pz' });
    B.box(M.tubeWarm, dx, 2.75, dz+0.25, 1.2, 0.05, 0.05);
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.35), M.glow(0xffffff, 1.6, { map:L().hsign('214', 9, { ink:'#ffd8a0', bg:'#1a1206', glyphs:0, w:256, h:96 }) }));
    num.position.set(dx, 3.1, dz+0.08); num.userData.flat = true; group.add(num);
    lightSrc(dx, 2.6, dz+1.2, 0xffd8a0, 8, 7);
    out.spots.home = [dx, dz+1.4, 2.8];
    // the fire escape: landings at 4 and 8 (the flat's window), zigzag stair rendered as a ladder
    const fx = 61.6;
    [8].forEach(y=>{
      B.box(M.darkMetal, fx-0.9, y, 34, 1.8, 0.08, 4.2);
      B.box(M.darkMetal, fx-1.75, y+0.5, 34, 0.05, 1.0, 4.2); B.box(M.darkMetal, fx-0.9, y+0.5, 31.95, 1.8, 1.0, 0.05, { faces:'pz nz' });
      B.box(M.darkMetal, fx-0.9, y+0.5, 36.05, 1.8, 1.0, 0.05, { faces:'pz nz' });
      plat(fx-1.8, fx, 31.9, 36.1, y+0.04, 'escape');
    });
    // the window of the flat, lit warm
    B.box(M.glow(0xffc27a, 1.4), 62-0.02, 9.3, 34, 0.02, 1.6, 1.4, { faces:'nx' });
    out.spots.homeWindow = [fx-0.9, 34, 8];
  }
  /* THE SCHOOL (B31, across Harbor Lane from B21's roof): where Robin is supposed to be at eight in the
     morning. A glass front with the revolving door in the middle of it, a canopy with the name on it,
     steps down to the pavement. Inside is off the map, like the flat (tshschool.js). */
  function placeSchool(group, B, out, lightSrc){
    const dx = -28, dz = 52, fr = M.darkMetal;          // the front is B31's north face (z = 52), on Harbor Lane: outside is z < 52
    B.box(M.glow(0x7fb4c4, 0.35), dx, 2.1, dz - 0.04, 10, 4.0, 0.06, { faces:'nz' });                 // the glass front
    for(let k = -5; k <= 5; k += 2.5) B.box(fr, dx + k, 2.1, dz - 0.06, 0.14, 4.2, 0.14);               // its mullions
    B.box(fr, dx, 4.15, dz - 0.06, 10.2, 0.16, 0.16); B.box(fr, dx, 0.05, dz - 0.06, 10.2, 0.1, 0.16);
    /* THE CUT (after 41 Cooper Square): up the front from over the doors to the roof, the steel skin is torn
       open in a leaning, widening slash — and through it the glass, the floors and the white lattice of the
       atrium behind. Its edges are the skin's own depth, half a metre of it. */
    const cut = [[-31.5, 4.4], [-24.5, 4.4], [-21.5, 8.2], [-17.5, 12.6], [-15.0, 18.0], [-23.5, 18.0], [-26.6, 12.8], [-29.8, 8.4]];
    { const xs = cut.map(p=>p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
      const c = L().cv(256, 512), x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 512);
      gr.addColorStop(0, '#5f7f96'); gr.addColorStop(1, '#22313c'); x.fillStyle = gr; x.fillRect(0, 0, 256, 512);
      // the lattice behind the glass, and the floors crossing it
      x.strokeStyle = 'rgba(240,240,236,0.5)'; x.lineWidth = 2; for(let k = -512; k < 768; k += 11){ x.beginPath(); x.moveTo(k, 512); x.lineTo(k + 512, 0); x.stroke(); x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 512, 512); x.stroke(); }
      for(let f = 1; f < 4; f++){ const yy = 512 - f*512*3.6/14; x.fillStyle = '#cfd2cc'; x.fillRect(0, yy - 5, 256, 10); x.fillStyle = 'rgba(255,236,200,0.35)'; x.fillRect(0, yy + 5, 256, 30); }
      x.fillStyle = 'rgba(255,255,255,0.12)'; for(let k = 0; k < 6; k++) x.fillRect(k*48, 0, 2, 512);
      const shape = new THREE.Shape(cut.map(([px, py])=>new THREE.Vector2(px, py)));
      const geo = new THREE.ShapeGeometry(shape), P = geo.attributes.position, U = geo.attributes.uv;
      for(let i = 0; i < P.count; i++) U.setXY(i, (P.getX(i) - x0)/(x1 - x0), (P.getY(i) - 4.4)/13.6);
      const glassCut = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map:L().tex(c), emissive:new THREE.Color(1, 1, 1), emissiveMap:L().tex(c), emissiveIntensity:0.35, roughness:0.08, metalness:0.3, side:THREE.DoubleSide }));
      glassCut.position.z = dz - 0.03; group.add(glassCut);
      // its edges: the skin's thickness, turned in
      cut.forEach((p, i)=>{ const q = cut[(i + 1) % cut.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const lip = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.6), M.school); lip.position.set((p[0] + q[0])/2, (p[1] + q[1])/2, dz - 0.3); lip.rotation.z = Math.atan2(q[1] - p[1], q[0] - p[0]); group.add(lip); });
      lightSrc(-23, 10, dz - 2, 0xfff0d8, 8, 12); }
    // the name, in steel letters on the skin
    { const c = L().cv(1024, 128), x = c.getContext('2d'); x.font = 'bold 74px ' + (window.uiFont ? uiFont() : 'sans-serif'); x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = 'rgba(20,24,28,0.6)'; x.fillText('HARBOR LANE HIGH SCHOOL', 516, 70); x.fillStyle = '#eef1f2'; x.fillText('HARBOR LANE HIGH SCHOOL', 512, 64);
      const t = L().tex(c), name = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.5), new THREE.MeshStandardMaterial({ map:t, transparent:true, roughness:0.3, metalness:0.8 }));
      name.position.set(-44, 5.6, dz - 0.05); name.rotation.y = Math.PI; group.add(name); }
    // the ground floor set back behind slanted columns, in pairs
    [-52, -45, -38, -18, -13].forEach(x=>[-1, 1].forEach(sd=>{ const col = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.4, 0.4), M.concrete); col.position.set(x + sd*0.5, 2.1, dz - 0.6); col.rotation.z = sd*0.2; group.add(col); }));
    B.box(M.concrete, dx, 0.11, dz - 1.3, 10, 0.22, 2.6, { faces:'py nz px nx' });                     // the step
    // the revolving door: a glass drum and four wings, turning slowly
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 2.6, 24, 1, true),
      new THREE.MeshStandardMaterial({ color:0xb8dce8, roughness:0.1, metalness:0.2, transparent:true, opacity:0.25, side:THREE.DoubleSide, depthWrite:false }));
    drum.position.set(dx, 1.3, dz - 0.4); group.add(drum);
    const wings = new THREE.Group(); wings.position.set(dx, 1.25, dz - 0.4); group.add(wings);
    for(let k = 0; k < 4; k++){ const w = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 0.04), new THREE.MeshStandardMaterial({ color:0xcfe8f0, roughness:0.1, transparent:true, opacity:0.35 }));
      w.position.set(Math.cos(k*Math.PI/2)*0.66, 0, Math.sin(k*Math.PI/2)*0.66); w.rotation.y = -k*Math.PI/2; wings.add(w); }
    B.box(fr, dx, 2.65, dz - 0.4, 2.9, 0.1, 2.9);
    out.anims.push(t=>{ wings.rotation.y = t*0.45; });
    lightSrc(dx, 4.2, dz - 1.6, 0xfff0d8, 7, 7);
    out.spots.schoolDoor = [dx, dz - 2.2, 0];
    out.spots.schoolOverlook = [-27.5, 42.6, 8];                 // B21's roof, at the corner over the lane: the whole front of the school
    out.zones.school = { x1:-56, x2:-10, z1:52, z2:85 };
  }
  /* LADDERS. [x, z, bottom, top, which way the wall faces]. A ladder is
     climbed with E at either end; the NPCs use them as links in the
     graph, which is how Kai follows you up. */
  function ladders(B, out){
    const L_ = [
      ['alleyEsc', -48.65, -31, 0, 10, 'px'],         // Dragon Alley, up B1
      ['b1b2', -50, -26.35, 10, 16, 'nz'],             // B1's roof to B2's (high)
      ['b3b4', -27.5, -26.35, 9, 12, 'nz'],              // B3 up to B4
      ['svc', -23.65, -18, 0, 12, 'px'],               // the service alley, up B4
      ['b7b8', 36.65, -38, 0, 13, 'nx'],               // B8 from its alley
      ['homeEsc', 59.9, 34, 0, 8, 'nx'],               // Kiln Street up to the flat's landing
      ['homeRoof', 61.65, 32.4, 8, 12, 'nx'],          // the landing up to Robin's roof
      ['homeN', 73, 23.65, 0, 12, 'nz'],               // the alley behind, straight up HOME
      ['homeHigh', 83.65, 30, 12, 20, 'nx'],           // HOME's roof up to B29 — the high one
      ['b28', 68, 21.35, 0, 9, 'pz'],                  // B28 from the same alley
      ['maya', -30.35, 20, 0, 18, 'nx'],               // B18, Maya's roof, from its alley
      ['b19', -33.65, 18, 0, 11, 'px']                 // B19 from the same alley
    ];
    L_.forEach(([id, x, z, y0, y1, face])=>{
      const nx = face==='px' ? 1 : face==='nx' ? -1 : 0, nz = face==='pz' ? 1 : face==='nz' ? -1 : 0;
      const along = nx ? 'z' : 'x';
      for(let y=y0+0.3; y<y1+1; y+=0.35) B.box(M.metal, x, y, z, along==='x' ? 0.6 : 0.04, 0.04, along==='z' ? 0.6 : 0.04);
      [-0.3, 0.3].forEach(k=>B.box(M.metal, x + (along==='x' ? k : 0), (y0+y1)/2+0.5, z + (along==='z' ? k : 0), 0.05, y1-y0+1, 0.05));
      out.ladders.push({ id, x, z, y0, y1, nx, nz,
        bottom:[x + nx*0.8, z + nz*0.8], top:[x - nx*1.1, z - nz*1.1] });
    });
  }

  /* ======================================================= the apartment
     Robin's studio: the bench and its lamp, the bed, the packed suitcase
     left open, the photo on the shelf, the switch by the door and the
     window onto the fire escape. Off the map at x = 300. */
  const APT = { x:300, z:0, w:11, d:8, h:3.2 };
  function apartment(group, B, out, lightSrc, solid, plat){
    const { x, z, w, d, h } = APT, x1 = x-w/2, x2 = x+w/2, z1 = z-d/2, z2 = z+d/2;
    const wall = M.std({ color:0x6a7470, roughness:0.9 });
    const floorM = M.std({ color:0x5a4636, roughness:0.6 });
    B.box(floorM, x, -0.05, z, w, 0.1, d, { faces:'py', s:2 });
    B.box(wall, x, h+0.1, z, w+2.4, 0.2, d+2.4, { faces:'ny' });
    const T = 1.2;
    B.box(wall, x, h/2, z1-T/2, w+2*T, h, T, { faces:'pz' }); B.box(wall, x, h/2, z2+T/2, w+2*T, h, T, { faces:'nz' });
    B.box(wall, x1-T/2, h/2, z, T, h, d, { faces:'px' }); B.box(wall, x2+T/2, h/2, z, T, h, d, { faces:'nx' });
    [[x1-T, x2+T, z1-T, z1], [x1-T, x2+T, z2, z2+T], [x1-T, x1, z1, z2], [x2, x2+T, z1, z2]].forEach(([a,b,c,e])=>solid(a, b, c, e, -1, h+1, 'apt'));
    plat(x1, x2, z1, z2, 0, 'apt');
    // the workbench along the north wall, with tools, a lamp and a half-built glove
    B.box(M.wood, x-2.5, 0.9, z1+0.55, 3.6, 0.08, 1.0); [-4.2, -0.8].forEach(k=>B.box(M.darkMetal, x+k, 0.45, z1+0.55, 0.08, 0.9, 0.9));
    solid(x-4.3, x-0.7, z1, z1+1.05, -1, 0.95, 'bench');
    for(let k=0;k<7;k++) B.box(M.metal, x-4+k*0.45, 1.3+((k*37)%3)*0.2, z1+0.12, 0.08, 0.5, 0.04);
    B.box(M.std({ color:0x1b2321, roughness:0.8 }), x-2.8, 0.97, z1+0.6, 0.25, 0.06, 0.32); B.box(M.teal, x-2.8, 1.003, z1+0.6, 0.012, 0.004, 0.28);   // the glove, half built: its seam lit B.box(M.metal, x-2.2, 0.99, z1+0.5, 0.4, 0.1, 0.25);
    B.box(M.darkMetal, x-1.5, 1.2, z1+0.4, 0.05, 0.6, 0.05);
    out.spots.bench = [x-2.5, z1+1.5, 1.4]; out.spots.lamp = [x-1.5, z1+0.4, 1.6];
    // the bed, along the south wall and clear of the door, and the suitcase open on the floor
    // (its own meshes, not batched: tshroom.js swaps the bed for a model and hides these)
    const part = (m, px, py, pz, w, h, d) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(px, py, pz); group.add(o); return o; };
    out.bedParts = [part(M.wood, x-1.4, 0.42, z2-1.3, 2.2, 0.16, 2.4), part(M.std({ color:0x2a3a5a, roughness:0.9 }), x-1.4, 0.6, z2-1.3, 2.1, 0.22, 2.3)];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, c])=>out.bedParts.push(part(M.wood, x-1.4 + a*1.02, 0.17, z2-1.3 + c*1.12, 0.1, 0.34, 0.1)));   // on legs: there is an under to it
    solid(x-2.5, x-0.3, z2-2.5, z2-0.1, -1, 0.72, 'bed');
    B.box(M.std({ color:0x3a2a22, roughness:0.7 }), x+1.2, 0.18, z2-1.2, 1.2, 0.36, 0.8);
    B.box(M.std({ color:0x3a2a22, roughness:0.7 }), x+1.2, 0.55, z2-1.62, 1.2, 0.8, 0.08);
    B.box(M.std({ color:0x6a5a8a, roughness:0.9 }), x+1.2, 0.34, z2-1.15, 1.0, 0.1, 0.6);
    out.spots.suitcase = [x+1.2, z2-2.1, 1];
    // the shelf with the photo, on the west wall
    B.box(M.wood, x1+0.2, 1.4, z-0.3, 0.35, 0.05, 1.6);
    out.spots.photo = [x1+0.9, z-0.3, 1.8]; out.photoAt = new V3(x1+0.25, 1.55, z-0.3);
    // the switch by the door, the door (south wall, east end), the window (west wall)
    out.spots.aptDoor = [x+3.8, z2-0.9, 2.4]; out.spots.aptSwitch = [x+2.8, z2-0.8, 1.5];
    B.box(M.metal, x+4.6, 1.1, z2-0.03, 1.1, 2.2, 0.06, { faces:'nz' });
    B.box(M.metal, x+3.2, 1.3, z2-0.04, 0.12, 0.18, 0.02, { faces:'nz' });
    out.spots.aptWindow = [x1+0.9, z+2.4, 1.8];
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.4), M.glow(0x2a6a70, 1.2)); win.position.set(x1+0.02, 1.7, z+2.4); win.rotation.y = Math.PI/2; group.add(win);
    B.box(M.darkMetal, x1+0.04, 1.7, z+2.4, 0.06, 1.55, 0.06); B.box(M.darkMetal, x1+0.04, 1.7, z+2.4, 0.06, 0.06, 1.55);
    // a kitchenette and a rug, so it is somebody's home
    B.box(M.std({ color:0xd8d4c8, roughness:0.5 }), x+4.8, 0.45, z1+1.2, 1.2, 0.9, 2.2); solid(x+4.2, x+5.5, z1, z1+2.3, -1, 0.9);
    B.box(M.std({ color:0x7a3a3a, roughness:1 }), x+0.5, 0.01, z+0.3, 3, 0.02, 2.2, { faces:'py' });
    out.apt = { x, z, x1, x2, z1, z2, h };
    // the sources the room is lit by; the lamp is switched from tsh.js
    out.aptLights = { lamp:[x-1.5, 1.7, z1+0.7, 0xffc890, 9, 7], neon:[x1+0.6, 1.8, z+2.4, 0x3affd8, 5, 6], ceiling:[x+1, 3, z, 0xfff0d8, 12, 10] };
    // and everything that makes it a sixteen-year-old's room (tshroom.js)
    if(window.TSHROOM) TSHROOM.dress(group, B, out, M, out.apt);
  }

  /* ============================================================= the graph
     Nodes where people walk: street corners, the pavement every twenty
     metres, the ends and middles of every alley, ladder feet and heads,
     roofs. Edges between any two on the same level with nothing solid
     between them, plus the ladders. */
  function navGraph(out){
    const nodes = [], add = (x, z, y, tag) => { nodes.push({ x, z, y:y||0, tag, e:[] }); return nodes.length-1; };
    // pavements and lanes
    for(let x=-104; x<=104; x+=12){ add(x, -8, 0.15); add(x, 8, 0.15); add(x, -48, 0); add(x, 48, 0); }
    for(let z=-80; z<=80; z+=12){ if(Math.abs(z) < 8) continue; add(-8, z, 0.15); add(8, z, 0.15); add(-59, z, 0); add(59, z, 0); }
    [[-41.5, -40], [-41.5, -33], [-41.5, -26], [-41.5, -19], [-41.5, -13], [-22.5, -40], [-22.5, -27], [-22.5, -14],
     [35.5, -40], [35.5, -27], [35.5, -14], [22, -31.5], [-32, 14], [-32, 27], [-32, 40], [32, 14], [32, 27], [32, 40], [73, 22.5], [66, 22.5], [80, 22.5]]
      .forEach(([x, z])=>add(x, z, 0));
    out.roofs.forEach(r=>{ if(r.x2-r.x1 > 60) return; add((r.x1+r.x2)/2, (r.z1+r.z2)/2, r.h, 'roof:'+r.id); });
    out.ladders.forEach(l=>{ l.nb = add(l.bottom[0], l.bottom[1], l.y0, 'lad'); l.nt = add(l.top[0], l.top[1], l.y1, 'lad'); });
    const blocked = (a, b) => out.solids.some(s=>{
      if(s.y2 < Math.max(a.y, b.y)+0.5 || s.y1 > Math.max(a.y, b.y)+1) return false;
      return segBox(a.x, a.z, b.x, b.z, s.x1-0.4, s.x2+0.4, s.z1-0.4, s.z2+0.4);
    });
    const onRoof = n => n.y > 1;
    for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){
      const a = nodes[i], b = nodes[j], d = Math.hypot(a.x-b.x, a.z-b.z);
      if(d > 26 || Math.abs(a.y-b.y) > 0.6) continue;
      if(onRoof(a) && !sameRoof(out, a, b)) continue;
      if(!onRoof(a) && blocked(a, b)) continue;
      a.e.push(j); b.e.push(i);
    }
    out.ladders.forEach(l=>{ nodes[l.nb].e.push(l.nt); nodes[l.nt].e.push(l.nb); nodes[l.nt].ladder = l; nodes[l.nb].ladder = l;
      // the head of a ladder is joined to its roof's middle
      out.roofs.forEach(r=>{ if(Math.abs(r.h - l.y1) < 0.6 && l.top[0] > r.x1-1 && l.top[0] < r.x2+1 && l.top[1] > r.z1-1 && l.top[1] < r.z2+1){
        const c = nodes.findIndex(n=>n.tag==='roof:'+r.id); if(c >= 0){ nodes[c].e.push(l.nt); nodes[l.nt].e.push(c); } } });
      out.roofs.forEach(r=>{ if(Math.abs(r.h - l.y0) < 0.6 && l.y0 > 1 && l.bottom[0] > r.x1-1 && l.bottom[0] < r.x2+1 && l.bottom[1] > r.z1-1 && l.bottom[1] < r.z2+1){
        const c = nodes.findIndex(n=>n.tag==='roof:'+r.id); if(c >= 0){ nodes[c].e.push(l.nb); nodes[l.nb].e.push(c); } } });
    });
    return { nodes };
  }
  function sameRoof(out, a, b){
    return out.roofs.some(r=>Math.abs(r.h-a.y) < 0.6 && [a, b].every(n=>n.x > r.x1-1.2 && n.x < r.x2+1.2 && n.z > r.z1-1.2 && n.z < r.z2+1.2));
  }
  /* does the segment (ax,az)-(bx,bz) cross the box? (slab test) */
  function segBox(ax, az, bx, bz, x1, x2, z1, z2){
    let t0 = 0, t1 = 1; const dx = bx-ax, dz = bz-az;
    const clip = (p, q) => { if(p === 0) return q >= 0; const r = q/p; if(p < 0){ if(r > t1) return false; if(r > t0) t0 = r; } else { if(r < t0) return false; if(r < t1) t1 = r; } return true; };
    return clip(-dx, ax-x1) && clip(dx, x2-ax) && clip(-dz, az-z1) && clip(dz, z2-az) && t0 <= t1;
  }

  return { build, segBox, overhead, lensTest, APT, BUILDINGS, HIGH, EDGE, AVE, MKT, LANES, get M(){ return M; } };
})();
