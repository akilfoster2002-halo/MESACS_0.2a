/* =====================================================================
   TSH — THE CITY AROUND THE CITY. Lower Manhattan, from the Battery up to
   the bridge ramps, round the district Robin lives in.

   The district is still the hand-built one (tshcity.js): every door, roof,
   ladder and alley the night is played on is there, at the size it was.
   What changed is what stands past the hoardings. It used to be a ring of
   grey boxes in the haze; now it is the real thing — a photographed model
   of the Financial District at full size, cut open where the district
   sits, so the streets you are fenced into run on into Manhattan and the
   towers over the end of every block are towers somebody built.

   A PHOTOGRAPH IS LIT FOR NOON. The capture was taken in daylight, and its
   shadows, sky and sun are painted into its one texture. Shown as it is
   at night it is a postcard pasted behind the set. So it is never shown as
   it is: it is drawn through the city's own look —
     · the colour is pulled down to almost nothing and pushed toward the
       teal of the haze, so it is lit by the same moon as everything else;
     · the walls get WINDOWS, a grid of them in world metres on every
       upright face, a third of them lit, warm or cold, bright enough for
       the bloom to take — which is what a tower at night actually is;
     · the haze is THICK AT THE STREET AND THIN HIGH UP. The district's fog
       swallows anything a hundred metres off; this fogs the bottom of a
       tower as hard and its top far less, so the towers rise out of the
       murk with their lit floors showing, instead of vanishing with it.
   By day (The Other Robin) it is the photograph, graded to match.

   THE GROUND IS THE GAME'S. The capture's own ground — painted cars, zebra
   crossings and noon shadows — is thrown away when the model is packed
   (tools/pack-nyc.py), and the land is laid in the district's wet road
   instead, puddles and mirror and all, with the harbour dark water round
   it. The rain is the district's rain, which follows the camera anyway.

   It is LOADED, not built: 300 thousand triangles and one texture, after
   the district is already standing, so the night does not wait for it.

   AND IT CAN BE WALKED. The hoardings are gone; Neon Avenue and Market
   Street are cut on through the model until they meet real streets, and
   Robin can go anywhere on the island. What stops her is read off the
   model from above when it is packed (tools/pack-nyc.py): thirty thousand
   boxes, one per patch of building at one height, each a wall she can
   grip and a roof she can stand on, and a kerb along the harbour. Thirty
   thousand is far too many for the lists the quest checks every frame —
   a dozen loops run over G.solids — so they live in a grid here, and only
   the ones within a few dozen metres of her are put into those lists, a
   few times a second as she moves (near()). The streets get lamps, a
   thousand of them, which go into the same list of light sources the
   district's lanterns are in, so the lights that follow her light
   Manhattan's pavements the way they light hers. The people of the night —
   Kai, WFC, the crowd — still live in the district.
   ===================================================================== */
window.TSHNYC = (function(){
  const U = {
    uNight: { value:1 },
    uFogLo: { value:0.0155 },   // the street's haze…
    uFogHi: { value:0.0042 },   // …and what is left of it up where the tower tops are
    uFogC:  { value:new THREE.Color(0x0b2a26) },
    uTime:  { value:0 }
  };
  let group = null, mesh = null, land = null, water = null, waterMat = null, loading = null, lamps = null;
  /* WHAT STOPS HER: every box in a grid of GC-metre cells, and what is in the live lists now */
  const GC = 32, NEAR = 48, RADAR = 96;
  let grid = null, boxes = [], live = { s:[], p:[] }, at = { x:1e9, z:1e9, t:0 }, radarList = [];

  /* The capture's material. A plain MeshBasicMaterial underneath, so it
     goes through the same tone mapping and colour space as the rest of
     the frame; its colour, its windows and its fog are its own. */
  function material(){
    const m = new THREE.MeshBasicMaterial({ color:0xffffff });
    m.onBeforeCompile = sh=>{
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = `uniform float uNight, uFogLo, uFogHi, uTime; uniform vec3 uFogC; varying vec3 vWp;
        float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      ` + sh.fragmentShader
        .replace('#include <map_fragment>', `
          vec3 tex = texture2D(map, vMapUv).rgb;
          vec3 fn = normalize(cross(dFdx(vWp), dFdy(vWp)));
          float upright = 1.0 - smoothstep(0.25, 0.55, abs(fn.y));
          // night: the photograph's colour, all but put out, and tinted by the haze
          float lum = dot(tex, vec3(0.299, 0.587, 0.114));
          vec3 night = mix(vec3(lum), tex, 0.4) * vec3(0.5, 0.92, 0.88) * 0.45;
          night *= 0.75 + 0.25*smoothstep(0.0, 160.0, vWp.y);          // the street floors are a little darker
          night += vec3(0.004, 0.018, 0.016) * (1.0 - upright);         // roofs catch the sky
          night += vec3(0.022, 0.05, 0.045) * upright * (0.6 + 0.4*tex.g); // the street's teal light, on walls the lamps cannot reach
          // the windows, in world metres, on every upright face
          vec2 t2 = normalize(vec2(-fn.z, fn.x) + 1e-5);
          float along = dot(vWp.xz, t2);
          vec2 cell = vec2(floor(along/1.9), floor((vWp.y - 1.2)/3.6));
          vec2 f = vec2(fract(along/1.9), fract((vWp.y - 1.2)/3.6));
          float pane = smoothstep(0.14, 0.2, f.x)*smoothstep(0.86, 0.8, f.x)*smoothstep(0.26, 0.32, f.y)*smoothstep(0.84, 0.78, f.y);
          vec2 side = floor(fn.xz*3.0);
          float block = h21(floor(vec2(along/11.0, (vWp.y - 1.2)/(3.6*3.0))) + side);   // an office is a few floors, on or off together
          float r = h21(cell + side*17.0);
          float lit = step(0.8 - 0.35*block*block, r) * pane * upright * step(6.0, vWp.y);
          vec3 warm = vec3(1.0, 0.7, 0.4), cold = vec3(0.6, 0.88, 1.0), tv = vec3(0.45, 0.6, 1.0);
          float hue = h21(cell*1.7 + 3.1);
          vec3 win = (hue < 0.55 ? warm : hue < 0.93 ? cold : tv) * (0.25 + 1.1*pow(h21(cell + 9.2), 2.0));
          // a few go on and off while you watch
          lit *= step(0.03, fract(h21(cell + 4.4) + uTime*0.004*step(0.97, h21(cell + 7.7))));
          // the dark ones are still glass: a faint sheen of the haze in them
          vec3 glass = vec3(0.01, 0.03, 0.03) * pane * upright * step(6.0, vWp.y);
          // by day the photograph, a little softened toward the morning haze so it sits with the drawn street
          vec3 dayc = mix(tex, vec3(lum), 0.18) * vec3(0.95, 0.99, 1.0);
          diffuseColor.rgb = mix(dayc, night + glass + win*lit*1.4, uNight);
        `)
        .replace('#include <fog_fragment>', `
          float dz = length(vWp - cameraPosition);
          float k = mix(uFogLo, uFogHi, smoothstep(10.0, 140.0, vWp.y));
          float fogF = 1.0 - exp(-k*k*dz*dz);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogC, fogF);
        `);
    };
    m.customProgramCacheKey = ()=>'tshnyc';
    return m;
  }

  /* the packed model (tools/pack-nyc.py): quantised positions, uvs, indices, and the land as rectangles */
  function unpack(buf){
    const dv = new DataView(buf);
    if(String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'NYC1') throw new Error('not a city');
    const nv = dv.getUint32(4, true), ni = dv.getUint32(8, true), nr = dv.getUint32(12, true), q = dv.getFloat32(16, true);
    let o = 20;
    const qp = new Int16Array(buf, o, nv*3); o += nv*6;
    const qu = new Uint16Array(buf, o, nv*2); o += nv*4;
    o += (4 - o%4) % 4;
    const idx = new Uint32Array(buf, o, ni); o += ni*4;
    const rects = new Float32Array(buf, o, nr*4);
    const pos = new Float32Array(nv*3); for(let i=0;i<nv*3;i++) pos[i] = qp[i]*q;
    const uv = new Float32Array(nv*2); for(let i=0;i<nv*2;i++) uv[i] = qu[i]/65535;
    return { pos, uv, idx, rects };
  }

  /* The land, in the district's own road: one sheet of rectangles, UV'd
     in metres at the district's scale so the puddles are the same size
     either side of the hoardings. Under the district it is not drawn. */
  function landMesh(rects, mat, hole){
    const p = [], u = [], ix = [];
    for(let i=0;i<rects.length;i+=4){
      const x1 = rects[i], x2 = rects[i+1], z1 = rects[i+2], z2 = rects[i+3];
      if(x1 >= hole.x1 && x2 <= hole.x2 && z1 >= hole.z1 && z2 <= hole.z2) continue;
      const b = p.length/3;
      p.push(x1,0,z1, x1,0,z2, x2,0,z2, x2,0,z1);
      u.push(x1/14,-z1/14, x1/14,-z2/14, x2/14,-z2/14, x2/14,-z1/14);
      ix.push(b,b+1,b+2, b,b+2,b+3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(p.length).fill(0).map((_, i)=>i%3===1 ? 1 : 0), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    g.setIndex(ix);
    const m = new THREE.Mesh(g, mat); m.position.y = -0.05; m.receiveShadow = true; m.userData.flat = true;
    return m;
  }

  /* Hung on the district's group, so it goes when the district goes (into
     the flat, out of the quest) and its geometry is freed with it. */
  function attach(cityGroup, W){
    group = new THREE.Group(); group.name = 'nyc'; cityGroup.add(group);
    // the harbour: dark water under everything, a few metres down
    waterMat = new THREE.MeshStandardMaterial({ color:0x03100e, roughness:0.18, metalness:0.7 });
    water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), waterMat);
    water.rotation.x = -Math.PI/2; water.position.y = -2.5; water.userData.flat = true; group.add(water);
    if(window.TSHLOOK) TSHLOOK.hideInMirror.push(water);
    const v = '?v=' + (window.ASSETV || '1');
    const mine = group;
    loading = Promise.all([
      fetch('tsh/nyc/nyc.bin' + v).then(r=>r.ok ? r.arrayBuffer() : Promise.reject(r.status)),
      new Promise((ok, no)=>new THREE.TextureLoader().load('tsh/nyc/nyc.jpg' + v, ok, undefined, no)),
      fetch('tsh/nyc/nyc-solids.bin' + v).then(r=>r.ok ? r.arrayBuffer() : null).catch(()=>null)
    ]).then(([buf, tex, sol])=>{
      if(group !== mine) return;                      // left before it arrived
      const d = unpack(buf);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.flipY = true;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
      g.setIndex(new THREE.BufferAttribute(d.idx, 1));
      g.computeBoundingSphere();
      const m = material(); m.map = tex;
      m.side = THREE.DoubleSide;                        // where the model was cut open, its far walls read as walls, not as holes
      mesh = new THREE.Mesh(g, m); mesh.name = 'manhattan'; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      group.add(mesh);
      const road = W && W.M && W.M.road;
      if(road){ land = landMesh(d.rects, road, { x1:-131, x2:131, z1:-106, z2:106 }); group.add(land); if(window.TSHLOOK) TSHLOOK.hideInMirror.push(land); }
      if(sol) walkable(sol, W);
    }).catch(e=>console.warn('Manhattan did not load:', e));
    return group;
  }
  /* The boxes, the kerb and the lamps (tools/pack-nyc.py: nyc-solids.bin). */
  function walkable(buf, W){
    const dv = new DataView(buf);
    if(String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'NYS1') return;
    const nb = dv.getUint32(4, true), nl = dv.getUint32(8, true);
    const B = new Float32Array(buf, 12, nb*6), Lp = new Float32Array(buf, 12 + nb*24, nl*2);
    grid = new Map(); boxes = [];
    for(let i=0;i<nb;i++){
      const x1 = B[i*6], x2 = B[i*6+1], z1 = B[i*6+2], z2 = B[i*6+3], top = B[i*6+4], kerb = B[i*6+5] > 0.5;
      // a building is a wall she can grip ('bld:'), and its top a roof; the kerb is neither
      const b = { s:{ x1, x2, z1, z2, y1:-1, y2:top, tag:kerb ? 'kerb:nyc' : 'bld:nyc', nyc:true },
                  p:kerb ? null : { x1, x2, z1, z2, top, tag:'roof', nyc:true } };
      boxes.push(b);
      for(let gx = Math.floor(x1/GC); gx <= Math.floor(x2/GC); gx++)
        for(let gz = Math.floor(z1/GC); gz <= Math.floor(z2/GC); gz++){
          const k = gx + ',' + gz; let c = grid.get(k); if(!c) grid.set(k, c = []); c.push(b);
        }
    }
    lampsFrom(Lp, W);
    at.x = 1e9;                                          // whatever she is next to now is put in on the next tick
  }
  /* A lamp on every stretch of Manhattan's pavement: a post, an arm, a
     tube, as the district's own streetlights are made — two instanced
     meshes for all of them — and each one a light source. Most burn the
     district's teal-white; one in four is an old sodium lamp. */
  function lampsFrom(Lp, W){
    const n = Lp.length/2; if(!n || !W || !W.M) return;
    const post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 7.2, 0.18), W.M.darkMetal, n);
    const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.1, 0.9), W.M.tube, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    for(let i=0;i<n;i++){
      const x = Lp[i*2], z = Lp[i*2+1], ry = (i*2.399) % (Math.PI*2);
      q.setFromAxisAngle(up, ry);
      post.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 3.6, z), q, one));
      head.setMatrixAt(i, m4.compose(new THREE.Vector3(x + Math.sin(ry)*1.0, 6.95, z + Math.cos(ry)*1.0), q, one));
      const warm = i % 4 === 0;
      W.lights.push({ x:x + Math.sin(ry)*1.0, y:6.7, z:z + Math.cos(ry)*1.0, col:new THREE.Color(warm ? 0xffb066 : 0x9ff5e0), k:warm ? 22 : 24, d:18, nyc:true });
    }
    [post, head].forEach(m=>{ m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); group.add(m); });
    post.castShadow = false; head.userData.flat = true;
    lamps = { post, head };
  }
  /* THE LIVE LISTS. Out with the boxes put in last time, in with the ones
     near her now. Cheap enough to do whenever she has moved a few metres
     or half a second has gone. */
  function near(x, z, solids, plats, t){
    if(!grid) return;
    if(Math.hypot(x - at.x, z - at.z) < 5 && t - at.t < 0.5) return;
    at.x = x; at.z = z; at.t = t;
    const pick = new Set(), wide = new Set();
    const g0x = Math.floor((x - RADAR)/GC), g1x = Math.floor((x + RADAR)/GC), g0z = Math.floor((z - RADAR)/GC), g1z = Math.floor((z + RADAR)/GC);
    for(let gx = g0x; gx <= g1x; gx++) for(let gz = g0z; gz <= g1z; gz++){
      const c = grid.get(gx + ',' + gz); if(!c) continue;
      for(const b of c){
        const dx = Math.max(b.s.x1 - x, 0, x - b.s.x2), dz = Math.max(b.s.z1 - z, 0, z - b.s.z2);
        if(dx < RADAR && dz < RADAR) wide.add(b);
        if(dx < NEAR && dz < NEAR) pick.add(b);
      }
    }
    strip(solids); strip(plats);
    live = { s:[], p:[] };
    pick.forEach(b=>{ solids.push(b.s); live.s.push(b.s); if(b.p){ plats.push(b.p); live.p.push(b.p); } });
    radarList = [...wide].map(b=>b.s);
  }
  function strip(arr){ if(!arr) return; let j = 0; for(let i=0;i<arr.length;i++) if(!arr[i].nyc) arr[j++] = arr[i]; arr.length = j; }

  function detach(){
    if(!group) return;
    grid = null; boxes = []; radarList = []; at.x = 1e9;
    if(lamps){ lamps.post.geometry.dispose(); lamps.head.geometry.dispose(); lamps.post.dispose(); lamps.head.dispose(); lamps = null; }
    if(group.parent) group.parent.remove(group);
    [mesh, land, water].forEach(m=>{ if(m) m.geometry.dispose(); });
    if(waterMat) waterMat.dispose();
    if(mesh){ if(mesh.material.map) mesh.material.map.dispose(); mesh.material.dispose(); }
    group = mesh = land = water = waterMat = null;
  }
  /* The district's air, told to the towers: the colour of the haze, and
     night or morning. */
  function look(day, fogCol, fogD){
    U.uNight.value = day ? 0 : 1;
    U.uFogC.value.setHex(fogCol);
    U.uFogLo.value = fogD;
    U.uFogHi.value = day ? fogD*0.8 : 0.0042;
    if(waterMat) waterMat.color.setHex(day ? 0x2a4a52 : 0x03100e);
  }
  function tick(t){ U.uTime.value = t; }

  return { attach, detach, look, tick, near, get ready(){ return !!mesh; }, get walkable(){ return !!grid; }, get loading(){ return loading; },
           get radar(){ return radarList; }, get count(){ return boxes.length; }, _live:()=>live };
})();
