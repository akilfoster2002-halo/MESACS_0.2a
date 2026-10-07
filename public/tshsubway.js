/* =====================================================================
   TSH · HARBOR LANE STATION. Closed since before Robin was born: a stair
   down from the street, a dark concourse and platform, the barrier on to
   the tracks (worked by the old signal switch), the tunnel — where the
   wall has a crack in it that glows violet and hums — a hatch two and a
   half metres up a wall, a passage, a security door, and the old platform
   with a train stopped at it. And at the far end, the maintenance ladder
   back up to the street.

   Built off the map like the school (tshschool.js): at x 520, its own
   walls, its own lights (borrowed by the pool in tsh.js like any other
   source), its own ceiling for the camera. The gates are solids that
   switch off when they open.

   Local plan (x from the station's middle, z from the stair, going -z):
     stair + entry      x ±2.5   z 12 … 2      the shutter at z 2 (power)
     platform A         x -7…2   z 2 … -32     tracks x 2…7; the barrier at z -32 (switch)
     tunnel             x ±2.5   z -32 … -72   the Psi crack at z -46; the wall at z -72, a hatch high in it
     passage            x ±2     z -72 … -88   the security door at z -88
     platform B         x -9…3   z -88 … -128  tracks x 3…9, the train on them
     exit corridor      x -9…-5  z -128 … -146 the ladder at z -145
   ===================================================================== */
window.TSHSUB = (function(){
  const UX = 520;
  const X = v => UX + v;
  const std = o => new THREE.MeshStandardMaterial(o);
  const glowM = (col, k) => new THREE.MeshStandardMaterial({ color:0x000000, emissive:new THREE.Color(col), emissiveIntensity:k || 1, roughness:0.6 });
  let S = null;

  /* the tiles: white subway tile, grout, grime coming up from the floor */
  function tileTex(){
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#5a5e58'; x.fillRect(0, 0, 256, 256);
    for(let r = 0; r < 16; r++) for(let k = 0; k < 8; k++){
      const off = r % 2 ? 16 : 0, tx = k*32 + off - 16, ty = r*16;
      const g = 196 + Math.floor(Math.random()*30); x.fillStyle = `rgb(${g},${g - 4},${g - 14})`; x.fillRect(tx + 1, ty + 1, 30, 14);
    }
    const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(20,18,12,0)'); gr.addColorStop(0.7, 'rgba(30,26,18,0.25)'); gr.addColorStop(1, 'rgba(25,20,12,0.7)');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    for(let i = 0; i < 40; i++){ x.fillStyle = `rgba(40,30,20,${Math.random()*0.25})`; x.fillRect(Math.random()*256, Math.random()*256, 2 + Math.random()*5, 10 + Math.random()*60); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function concTex(){
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#3a3c3a'; x.fillRect(0, 0, 256, 256);
    for(let i = 0; i < 1400; i++){ const v = 40 + Math.random()*40; x.fillStyle = `rgba(${v},${v},${v - 4},0.5)`; x.fillRect(Math.random()*256, Math.random()*256, 2, 2); }
    for(let i = 0; i < 6; i++){ x.fillStyle = 'rgba(10,12,14,0.35)'; x.beginPath(); x.ellipse(Math.random()*256, Math.random()*256, 20 + Math.random()*40, 8 + Math.random()*20, Math.random()*3, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  /* the name band in mosaic: HARBOR LANE */
  function bandTex(text){
    const c = document.createElement('canvas'); c.width = 1024; c.height = 96; const x = c.getContext('2d');
    x.fillStyle = '#1c4a3a'; x.fillRect(0, 0, 1024, 96);
    x.strokeStyle = '#c8a24a'; x.lineWidth = 6; x.strokeRect(6, 6, 1012, 84);
    x.fillStyle = '#efe6cc'; x.font = 'bold 54px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 512, 52);
    for(let i = 0; i < 3000; i++){ x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect((i*37) % 1024, Math.floor(i/ 30)*3 % 96, 1, 1); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function signTex(text, bg, ink){
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = bg || '#111'; x.fillRect(0, 0, 512, 128); x.fillStyle = ink || '#eee'; x.font = 'bold 54px Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 66);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  function build(root, out){
    const g = new THREE.Group(); g.visible = false; root.add(g);
    const solids = [], lights = [], spots = {}, fixtures = [];
    const tex = tileTex(), conc = concTex();
    const tileM = (w, h) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(w/2, h/1); return std({ map:t, roughness:0.35, metalness:0.05 }); };
    // the floors are wet: seepage, puddles — they mirror the lamps, and whatever comes up out of the dark (TSHLOOK's reflection pass)
    const floorM = (w, d) => { const t = conc.clone(); t.needsUpdate = true; t.repeat.set(w/3, d/3);
      const m = std({ map:t, roughness:0.1, metalness:0.15, color:0x8a8c8c }); if(window.TSHLOOK && TSHLOOK.wet) TSHLOOK.wet(m, 0.95); return m; };
    const dark = std({ color:0x1a1c1e, roughness:0.8 }), ceilM = std({ color:0x2a2c2a, roughness:0.9 }), green = std({ color:0x2f5a44, roughness:0.5, metalness:0.5 });
    const steel = std({ color:0x8a8e92, roughness:0.35, metalness:0.9 }), rust = std({ color:0x5a3a28, roughness:0.85, metalness:0.3 }), black = std({ color:0x0c0d0e, roughness:0.7 });
    const box = (m, x, y, z, w, h, d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.receiveShadow = true; g.add(b); return b; };
    const solid = (x1, x2, z1, z2, y2, y1) => { const s = { x1:X(x1), x2:X(x2), z1, z2, y1:y1 === undefined ? -1 : y1, y2:y2 === undefined ? 60 : y2, tag:'sub' }; solids.push(s); return s; };
    // a wall: tiled on the side people see, solid
    const wall = (x1, x2, z1, z2, h) => { const w = x2 - x1, d = z2 - z1; box(tileM(Math.max(w, d), h), X((x1 + x2)/2), h/2, (z1 + z2)/2, w, h, d); solid(x1, x2, z1, z2); };
    const floor = (x1, x2, z1, z2, y) => box(floorM(x2 - x1, z2 - z1), X((x1 + x2)/2), (y || 0) - 0.05, (z1 + z2)/2, x2 - x1, 0.1, z2 - z1);
    const ceil = (x1, x2, z1, z2, h) => box(ceilM, X((x1 + x2)/2), h + 0.1, (z1 + z2)/2, x2 - x1, 0.2, z2 - z1);
    // a caged work light: a bulb, its cage, and a light source for the pool (mul is the power: 0 until it comes on)
    const lamp = (x, y, z, col, k, d, emerg) => {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), glowM(col, 0.0)); bulb.position.set(X(x), y, z); g.add(bulb);
      const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 8, 1, true), std({ color:0x222222, wireframe:true })); cage.position.copy(bulb.position); g.add(cage);
      const src = { x:X(x), y:y - 0.2, z, col:new THREE.Color(col), k, d, mul:emerg ? 1 : 0 };
      lights.push(src); fixtures.push({ bulb, src, emerg:!!emerg, z, on:emerg ? 1 : 0, glow:emerg ? 1.8 : 3 });
      if(emerg) bulb.material.emissiveIntensity = 1.8;
      return src;
    };
    // the third rail and the running rails, along a track bed
    const rails = (x1, x2, z1, z2, y) => { const mid = (x1 + x2)/2, len = z2 - z1;
      box(std({ color:0x2a2622, roughness:0.95 }), X(mid), y - 0.05, (z1 + z2)/2, x2 - x1, 0.1, len);
      for(let z = z1 + 0.4; z < z2; z += 0.7) box(rust, X(mid), y + 0.03, z, 2.4, 0.08, 0.22);
      [-0.72, 0.72].forEach(dx=>box(steel, X(mid + dx), y + 0.12, (z1 + z2)/2, 0.07, 0.1, len)); };

    /* ---- the stair and the entry */
    floor(-2.5, 2.5, 2, 12); ceil(-2.5, 2.5, 2, 12, 3.4);
    wall(-2.8, -2.5, 2, 12.3, 3.6); wall(2.5, 2.8, 2, 12.3, 3.6); wall(-2.8, 2.8, 12, 12.3, 6);
    for(let k = 0; k < 10; k++) box(dark, X(0), 0.15 + k*0.3, 6.6 + k*0.55, 5, 0.3, 0.55);   // the stair, going up toward the street
    box(glowM(0xfff2d8, 2.2), X(0), 4.4, 12.1, 4.6, 2.2, 0.05);                              // the daylight at the top of it
    lamp(0, 3.0, 9.5, 0xfff0d8, 2.2, 10, true);                                               // the day, coming down the stair
    { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map:signTex('HARBOR LANE', '#0f2a20', '#efe6cc') })); s.position.set(X(0), 2.9, 2.35); g.add(s); }
    // the breaker panel, on the west wall by the shutter
    const panel = box(std({ color:0x5a6066, roughness:0.5, metalness:0.6 }), X(-2.45), 1.4, 3.6, 0.1, 0.9, 0.6);
    const panelLed = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), glowM(0xff2a1a, 2)); panelLed.position.set(X(-2.38), 1.75, 3.4); g.add(panelLed);
    spots.panel = [X(-1.8), 3.6];
    lamp(-2.1, 2.6, 3.2, 0xff3020, 1.4, 7, true);                                             // the emergency lamp over it, red
    // the shutter: down, across the way on
    const shutter = new THREE.Group(); g.add(shutter);
    for(let k = 0; k < 12; k++) { const sl = box(std({ color:0x6a6e70, roughness:0.4, metalness:0.7 }), X(0), 0.15 + k*0.28, 2.1, 5, 0.26, 0.08); g.remove(sl); shutter.add(sl); }
    const shutterS = solid(-2.5, 2.5, 1.9, 2.3);
    spots.start = [X(0), 7.4]; spots.shutter = [X(0), 3.2];

    /* ---- platform A, and the tracks beside it */
    floor(-7, 2, -32, 2); ceil(-7, 7, -32, 2, 4.2);
    wall(-7.3, -7, -32, 2, 4.4); wall(-7, -2.5, 2, 2.3, 4.4); wall(2.5, 7.3, 2, 2.3, 4.4); wall(7, 7.3, -32, 2, 4.4);
    rails(2, 7, -32, 2, -1.1);
    box(std({ color:0xc8a24a, roughness:0.6 }), X(1.85), 0.005, -15, 0.3, 0.01, 34);                     // the yellow edge
    box(dark, X(2.05), -0.55, -15, 0.1, 1.1, 34);                                                        // the platform's face
    solid(2, 2.3, -32, 2, 3);                                                                            // nobody goes down on to the tracks
    for(let z = -2; z > -32; z -= 6){ box(green, X(1.0), 2.1, z, 0.28, 4.2, 0.28); solid(0.86, 1.14, z - 0.14, z + 0.14); }
    { const b = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.7), std({ map:bandTex('HARBOR LANE'), roughness:0.5 })); b.rotation.y = Math.PI/2; b.position.set(X(-6.98), 2.6, -15); g.add(b); }
    for(let z = -4; z > -32; z -= 7) lamp(-3, 3.9, z, 0xffd9a0, 3.4, 15);
    // benches, a dead turnstile, litter
    [-8, -20].forEach(z=>{ box(std({ color:0x6b4a2e, roughness:0.8 }), X(-6.4), 0.45, z, 0.5, 0.06, 2.2); box(steel, X(-6.4), 0.22, z, 0.4, 0.44, 0.06); });
    spots.walk1 = -6;
    // the barrier on to the tracks at the end of the platform, and the switch panel on the wall
    wall(-7, -2.5, -32.3, -32, 4.4); wall(2.5, 7, -32.3, -32, 4.4);
    const barrier = new THREE.Group(); g.add(barrier);
    for(let k = -2.3; k <= 2.3; k += 0.32){ const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 6), rust); b.position.set(X(k), 1.6, -32.1); barrier.add(b); }
    [0.3, 1.6, 2.9].forEach(y=>{ const r = new THREE.Mesh(new THREE.BoxGeometry(5, 0.08, 0.08), rust); r.position.set(X(0), y, -32.1); barrier.add(r); });
    const barrierS = solid(-2.5, 2.5, -32.3, -31.9);
    const sw = box(std({ color:0x3a4a44, roughness:0.5, metalness:0.6 }), X(-6.9), 1.3, -27, 0.2, 1.2, 0.9);
    const swLed = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), glowM(0xffa020, 2)); swLed.position.set(X(-6.78), 1.75, -26.7); g.add(swLed);
    { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map:signTex('SIGNAL 4', '#222', '#ffb030') })); s.rotation.y = Math.PI/2; s.position.set(X(-6.95), 2.15, -27); g.add(s); }
    spots.switch = [X(-6.2), -27];

    /* ---- the tunnel */
    floor(-2.5, 2.5, -72, -32); ceil(-2.5, 2.5, -72, -32, 4.5);
    wall(-2.8, -2.5, -72, -32, 4.6); wall(2.5, 2.8, -72, -32, 4.6);
    rails(-1.8, 1.8, -72, -32, 0.02);
    for(let z = -36; z > -72; z -= 8) lamp(z % 16 ? -2.3 : 2.3, 3.6, z, 0xffc888, 2.6, 12);
    for(let z = -34; z > -72; z -= 3) [-2.45, 2.45].forEach(x=>box(black, X(x), 3.2, z, 0.12, 0.12, 0.12));         // the cable hangers
    [-2.45, 2.45].forEach(x=>box(black, X(x), 3.25, -52, 0.06, 0.06, 40));
    // the crack in the wall that hums: Psi, seeping
    const psiM = new THREE.MeshBasicMaterial({ color:new THREE.Color(0.7, 0.35, 1.6), transparent:true, opacity:0.85, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false });
    const crack = new THREE.Group(); crack.position.set(X(-2.48), 1.4, -46); g.add(crack);
    { let y = -1.1, zz = 0; for(let k = 0; k < 9; k++){ const ny = y + 0.3, nz = zz + (Math.random() - 0.5)*0.35; const len = Math.hypot(ny - y, nz - zz);
        const seg = new THREE.Mesh(new THREE.PlaneGeometry(0.06 + Math.random()*0.05, len), psiM); seg.rotation.y = Math.PI/2; seg.position.set(0.01, (y + ny)/2, (zz + nz)/2); seg.rotation.x = Math.atan2(nz - zz, ny - y); crack.add(seg); y = ny; zz = nz; } }
    const motes = new THREE.Group(); g.add(motes);
    for(let i = 0; i < 40; i++){ const m = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 3), psiM); m.position.set(X(-2.3 + Math.random()*1.2), 0.3 + Math.random()*2.6, -46 + (Math.random() - 0.5)*3); m.userData.ph = Math.random()*7; motes.add(m); }
    const psiSrc = { x:X(-2.0), y:1.5, z:-46, col:new THREE.Color(0.65, 0.3, 1.0), k:1.4, d:6, mul:1 }; lights.push(psiSrc);
    spots.psi = [X(-0.6), -45];
    // the end of it: a wall, and two and a half metres up, a hatch
    wall(-2.8, 2.8, -72.3, -72, 4.6);
    const hatch = box(std({ color:0x4a4e50, roughness:0.5, metalness:0.7 }), X(0.8), 3.05, -71.95, 1.2, 0.9, 0.06);
    box(black, X(0.8), 3.05, -71.97, 1.0, 0.7, 0.04);
    box(rust, X(0.8), 2.55, -71.85, 1.4, 0.08, 0.3);                                                   // the ledge under it
    spots.hatch = [X(0.6), -70.6];

    /* ---- the passage */
    floor(-2, 2, -88, -72); ceil(-2, 2, -88, -72, 3.2);
    wall(-2.3, -2, -88, -72.3, 3.4); wall(2, 2.3, -88, -72.3, 3.4);
    lamp(0, 3.0, -76, 0xffd0a0, 2.0, 10); lamp(0, 3.0, -84, 0xffd0a0, 2.0, 10);
    spots.quiet = -80;
    // the security door
    const door = box(std({ color:0x50585e, roughness:0.35, metalness:0.85 }), X(0), 1.35, -88.1, 3.9, 2.7, 0.15);
    const doorS = solid(-2, 2, -88.3, -87.9);
    const keypad = box(std({ color:0x1a1e22, roughness:0.4 }), X(1.8), 1.3, -87.92, 0.2, 0.3, 0.06);
    const padLed = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), glowM(0xff2a1a, 2)); padLed.position.set(X(1.8), 1.48, -87.88); g.add(padLed);
    { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ map:signTex('NO ADMITTANCE · WFC', '#5a1010', '#fff') })); s.position.set(X(0), 2.95, -87.95); g.add(s); }
    spots.door = [X(1.2), -86.8];

    /* ---- the old platform, and the train stopped at it */
    floor(-9, 3, -128, -88); ceil(-9, 9, -128, -88, 8.5);          // high: the thing that comes up in here is bigger than a train
    wall(-9, -2, -88.3, -88, 8.7); wall(2, 9.3, -88.3, -88, 8.7); wall(-9.3, -9, -128, -88, 8.7); wall(9, 9.3, -128, -88, 8.7);
    box(tileM(4, 5.5), X(0), 3.2 + 5.5/2, -88.15, 4, 5.5, 0.3);          // over the door from the passage (above head height: not solid)
    wall(-5, 9.3, -128.3, -128, 8.7); box(tileM(4.3, 5.7), X(-7.15), 3.0 + 5.7/2, -128.15, 4.3, 5.7, 0.3);   // and over the way out to the ladder
    rails(3, 9, -128, -88, -1.1);
    box(std({ color:0xc8a24a, roughness:0.6 }), X(2.85), 0.005, -108, 0.3, 0.01, 40);
    solid(3, 3.3, -128, -88, 3);
    for(let z = -92; z > -128; z -= 7){ box(green, X(1.8), 4.25, z, 0.3, 8.5, 0.3); solid(1.65, 1.95, z - 0.15, z + 0.15); }
    { const b = new THREE.Mesh(new THREE.PlaneGeometry(16, 0.8), std({ map:bandTex('HARBOR LANE — UPTOWN'), roughness:0.5 })); b.rotation.y = Math.PI/2; b.position.set(X(-8.98), 3.0, -108); g.add(b); }
    for(let z = -94; z > -128; z -= 9) lamp(-4, 8.2, z, 0xbfd8ff, 3.6, 20);
    // the train: silver, a stripe, dark windows, one door open
    const car = new THREE.Group(); g.add(car);
    const shell = std({ color:0xa8acb0, roughness:0.3, metalness:0.85 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.2, 34), shell); body.position.set(X(6), 0.75, -108); car.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.42, 0.18, 34.02), std({ color:0x8a1a1a, roughness:0.5 })); stripe.position.set(X(6), 0.2, -108); car.add(stripe);
    for(let z = -123; z < -93; z += 2.4){ const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), std({ color:0x0b1018, roughness:0.05, metalness:0.6, emissive:new THREE.Color(0.04, 0.06, 0.08) }));
      w.rotation.y = -Math.PI/2; w.position.set(X(3.79), 1.45, z); car.add(w); }
    const doorGap = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.2), black); doorGap.rotation.y = -Math.PI/2; doorGap.position.set(X(3.78), 1.0, -104); car.add(doorGap);
    spots.trainDoor = [X(3.3), -104];
    spots.arena = { x1:X(-8.5), x2:X(2.6), z1:-126, z2:-90 };
    spots.meetR = [X(-2.6), -100]; spots.canon = [X(-1.6), -99.2]; spots.maya = [X(0.6), -105]; spots.kai = [X(-2.4), -106.5];
    // the way out: the corridor at the far end, and the ladder up
    floor(-9, -5, -146, -128); ceil(-9, -5, -146, -128, 3.0);
    wall(-9.3, -9, -146, -128, 3.2); wall(-5, -4.7, -146, -128.3, 3.2); wall(-9.3, -4.7, -146.3, -146, 3.2);
    lamp(-7, 2.8, -136, 0xff4a2a, 0.9, 8, true);
    for(let y = 0.3; y < 3.0; y += 0.3) box(steel, X(-7), y, -145.85, 0.7, 0.04, 0.04);
    [-7.35, -6.65].forEach(x=>box(steel, X(x), 1.5, -145.85, 0.05, 3.0, 0.05));
    box(glowM(0xfff0d0, 1.5), X(-7), 3.01, -145.5, 0.8, 0.02, 0.8);                                    // daylight through the manhole
    spots.ladder = [X(-7), -144.6];

    out.solids.push(...solids);
    const ceilingAt = (x, z) => z > 2 ? 3.4 : z > -32 ? 4.2 : z > -72 ? 4.5 : z > -88 ? 3.2 : z > -128 ? 8.5 : 3.0;
    let power = 0, t = 0;
    S = { group:g, solids, lights, spots, ceilingAt, X, UX,
      /* the gates */
      open(which){
        if(which === 'shutter'){ shutterS.off = true; S.anim.shutter = 0.001; }
        if(which === 'barrier'){ barrierS.off = true; S.anim.barrier = 0.001; swLed.material.emissive.setRGB(0.2, 1, 0.3); }
        if(which === 'door'){ doorS.off = true; S.anim.door = 0.001; padLed.material.emissive.setRGB(0.2, 1, 0.3); }
      },
      opened(which){ return which === 'shutter' ? !!shutterS.off : which === 'barrier' ? !!barrierS.off : !!doorS.off; },
      /* the power: the lights come on down the line, one after the other, with a flicker */
      power(on){ power = on ? 1 : 0; panelLed.material.emissive.setRGB(on ? 0.2 : 1, on ? 1 : 0.15, on ? 0.3 : 0.1); fixtures.forEach(f=>{ if(!f.emerg) f.at = on ? t + 0.25 + Math.max(0, 2 - f.z)*0.035 : null; if(!on && !f.emerg){ f.on = 0; f.src.mul = 0; f.bulb.material.emissiveIntensity = 0; } }); },
      get powered(){ return power > 0; },
      anim:{},
      tick(dt){
        if(!g.visible) return;
        t += dt;
        // the lights coming on: a stutter, then steady
        fixtures.forEach(f=>{ if(f.emerg || f.at == null || f.on >= 1) return; const k = t - f.at; if(k < 0) return;
          const v = k > 0.5 ? 1 : (Math.sin(k*70) > 0.2 ? 1 : 0.1); f.src.mul = v; f.bulb.material.emissiveIntensity = v*f.glow; if(k > 0.5){ f.on = 1; } });
        // the Psi: it breathes
        const br = 0.6 + 0.4*Math.sin(t*2.3) + (Math.random() < 0.03 ? 0.5 : 0);
        psiM.opacity = 0.5 + 0.4*br; psiSrc.mul = 0.6 + 0.6*br;
        motes.children.forEach(m=>{ m.userData.ph += dt; m.position.y += Math.sin(m.userData.ph*1.3)*0.002; m.position.x += Math.cos(m.userData.ph)*0.0015; });
        // the gates opening
        const A = S.anim;
        if(A.shutter){ A.shutter = Math.min(1, A.shutter + dt/2.2); shutter.position.y = A.shutter*3.2; shutter.scale.y = 1 - A.shutter*0.7; }
        if(A.barrier){ A.barrier = Math.min(1, A.barrier + dt/1.6); barrier.position.y = A.barrier*3.0; }
        if(A.door){ A.door = Math.min(1, A.door + dt/1.8); door.position.x = X(0) - A.door*3.8; }
      },
      /* back to how it was found, for a new run at it */
      reset(){ shutterS.off = barrierS.off = doorS.off = false; S.anim = {}; shutter.position.y = 0; shutter.scale.y = 1; barrier.position.y = 0; door.position.x = X(0);
        swLed.material.emissive.setRGB(1, 0.6, 0.1); padLed.material.emissive.setRGB(1, 0.15, 0.1); S.power(false); },
      /* skip ahead (a checkpoint): every gate before `n` already open */
      upTo(n){ if(n >= 1){ S.open('shutter'); S.anim.shutter = 1; S.power(true); } if(n >= 2){ S.open('barrier'); S.anim.barrier = 1; } if(n >= 4){ S.open('door'); S.anim.door = 1; } }
    };
    S.reset();
    return S;
  }
  return { build, X, UX };
})();
