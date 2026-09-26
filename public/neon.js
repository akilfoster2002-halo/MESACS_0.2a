/* =====================================================================
   NEON — the arcade in the clouds, from the inside.

   islands.js stands a neon pagoda on a floating rock over Wano; planet.js
   use('neon') walks you through its door and into here. Inside it is the
   pagoda again: five floors, one genre each — CLASSICS, SHOOTERS,
   PLATFORM, FIGHTING, RACING & SPORTS — twenty cabinets in all (cabgames.js
   and cabgames2-4.js), lift pads between the floors, and a class score
   board on every floor for that floor's games.

   A FLOOR IS A FLAT ROOM IN game.js's ENGINE, the way chatroom.js is, and
   only the floor you are on is built: going up or down rebuilds it.

   TWO OF THE CABINETS ARE AGAINST SOMEBODY. VOLLEY and TANK can be played
   against the machine, or against whoever else is standing in NEON: press
   2 at the cabinet and the server (index.js, `t:'arc'`) pairs you with the
   next person to do the same. After that the server only relays — the host
   (side A) simulates and sends the state, the guest sends what it is
   pressing. See NEON.md for why.

   A GO COSTS COINS and a good go pays them back (see "the coins" below).
   ===================================================================== */
window.NEON = (function(){
  const V = (x,y,z)=>new THREE.Vector3(x,y,z);
  const $ = s=>document.querySelector(s);

  /* THE PAGODA, from the inside: five floors, one genre each, the way the
     building outside has five tiers. A floor is a square room of dark wood
     and red lacquer, narrower the higher you go, with paper lattice windows
     glowing warm, lanterns, neon along the ceiling the way it runs along
     the eaves outside, and the cabinets of its genre down both walls. Two
     lift pads at the back take you up and down; only the ground floor has
     the way out. */
  const FLOORS = [
    { genre:'classics', name:'CLASSICS',         col:'#ffd23d' },
    { genre:'shooters', name:'SHOOTERS',         col:'#ff8a3d' },
    { genre:'platform', name:'PLATFORM',         col:'#c86bff' },
    { genre:'fighting', name:'FIGHTING',         col:'#ff4d6d' },
    { genre:'racing',   name:'RACING & SPORTS',  col:'#3ddc84' }
  ];
  let lvl = 0;
  let W = 34, D = 34;
  const H = 8;
  const sizeOf = n => 34 - n*2;
  const CYAN = 0x27e8ff, PINK = 0xff3fd0, BLUE = 0x3a6bff, GOLD = 0xffc53d, RED = 0x8a1020;
  let pads = [];                  // the lift pads on this floor

  let on = false, server = null, group = null, clock = 0, sent = 0;
  let cabs = [];                  // { m (machine), g (holder), scr, tex, ctx, attract }
  let play = null;                // the game you are playing, and how
  let handy = null;
  let board = null, boardAt = 0;  // the high-score board, and when it was last asked for
  let scores = {};                // game id -> [{display, best}]
  let clouds = [];                // the window's view, drifting past
  const others = new Map();

  /* ============================================================== arriving */
  function enter(sv){
    server = sv || null;
    if(window.AVATAR){ AVATAR.posture(null); if(AVATAR.setCast) AVATAR.setCast(null); }
    if(window.MENU && MENU.hideAll) MENU.hideAll();
    on = true;
    play = null;
    lvl = 0;
    build();
    G.room = 'neon';
    G.running = true;
    G.firstPerson = false;
    G.camera.up.set(0,1,0);
    G.camera.near = 0.1; G.camera.far = 400; G.camera.updateProjectionMatrix();
    G.pos.set(0, 1.7, D/2 - 3);
    G.yaw = 0; G.pitch = 0;                          // facing -z: into the hall
    G.vel.set(0,0,0); G.onGround = true;
    if(window.AVATAR) AVATAR.attach();
    G.scene.updateMatrixWorld(true);
    $('#hud').classList.remove('hidden');
    const map = $('#mapwrap'); if(map) map.classList.add('hidden');
    hud();
    /* THE SAME SOCKET ROOM AS OUTSIDE. The arcade is part of Wano's room, so
       the queue at a cabinet is everybody who flew up here from the same
       server, and chat carries straight on. Only the handlers change. */
    if(window.NET && NET.signedIn && server){
      NET.connect(server, {
        players:list=>paint(list),
        objs:()=>{},
        chat:m=>CHAT.line(m.from, m.text, m.id),
        sys:s=>CHAT.sys(s),
        clear:q=>CHAT.clear(q),
        unsay:id=>CHAT.remove(id)
      });
      NET.onArc = heard;
      CHAT.show();
    }
    fetchScores();
    lockPointer($('#view'));
  }

  /* Out of the arch and back onto the island's apron, facing away from the
     door — not onto Wano's grass a hundred metres below it. */
  function leave(){
    if(!on) return;
    stopPlaying(true);
    on = false;
    if(window.NET) NET.onArc = null;
    others.forEach(o=>{ if(o.g.parent) o.g.parent.remove(o.g); });
    others.clear();
    cabs = []; clouds = []; board = null;
    G.scene.background = null; G.scene.fog = null;
    const sv = (window.NET && window.PLANET) ? PLANET.server : server;
    if(window.PLANET) PLANET.enter(sv, 'hub', { island:'neon' });
  }

  /* ============================================================= building */
  const glow = (hex, k)=> new THREE.MeshStandardMaterial({
    color:hex, emissive:hex, emissiveIntensity:k||2, roughness:0.4 });
  const flat = hex => new THREE.MeshLambertMaterial({ color:hex });
  function box(w, h, d, mat, x, y, z){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); group.add(m); return m;
  }
  /* A neon tube from a to b: a thin glowing box, which is all a tube is
     from further than a metre away. */
  function tube(a, b, hex, r){
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(r||0.07, r||0.07, len), glow(hex, 2.4));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.lookAt(b);
    group.add(m);
    return m;
  }
  function solid(x1, x2, z1, z2, y1, y2){
    G.solids.push({ x1, x2, z1, z2, y1:y1===undefined?-0.5:y1, y2:y2===undefined?H+1:y2 });
  }

  function build(){
    W = D = sizeOf(lvl);
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup = new THREE.Group();
    G.scene.add(G.roomGroup);
    G.solids = []; G.hits = []; G.selected = null; G.focused = null;
    G.vel.y = 0; G.onGround = true;
    group = G.roomGroup;
    cabs = []; clouds = []; pads = []; exitDoor = null;

    G.scene.background = new THREE.Color(0x07030a);
    G.scene.fog = null;
    lights();
    shell();
    windows();
    lifts();
    const here = CABGAMES.MACHINES.filter(m=>m.genre===FLOORS[lvl].genre);
    /* down both side walls, facing in, evenly spaced */
    const slots = [];
    const n = Math.ceil(here.length/2), span = D - 12;
    for(let i=0;i<n;i++){ const z = -span/2 + (n===1 ? span/2 : i*span/(n-1));
      slots.push([-W/2+1.9, z, Math.PI/2], [W/2-1.9, z, -Math.PI/2]); }
    here.forEach((m, i)=>cabinet(m, i, slots[i]));
    board = scoreBoard();
    G.ground = ()=>0;
    G.ceiling = ()=>H;
  }

  /* Lit warm by lanterns, with the neon doing the rest. */
  function lights(){
    if(G.sun){ G.sun.intensity = 0.12; G.sun.position.set(4, 20, 6);
               G.sun.target.position.set(0,0,0); G.sun.target.updateMatrixWorld(); }
    let amb = G.scene.children.find(c=>c.isAmbientLight);
    if(!amb){ amb = new THREE.AmbientLight(0xffffff, 0.5); G.scene.add(amb); }
    amb.userData.roomOwned = true;
    amb.color.setHex(0x6a3a4a); amb.intensity = 0.95;
    const col = new THREE.Color(FLOORS[lvl].col).getHex();
    [[-W/4, -D/4, 0xff6a3d], [W/4, -D/4, col], [-W/4, D/4, col], [W/4, D/4, 0xff6a3d], [0, 0, 0xffd0a0]].forEach(([x,z,c])=>{
      const l = new THREE.PointLight(c, 34, 30, 1.5); l.position.set(x, H-1.5, z); group.add(l);
    });
  }

  function planks(){
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    for(let i=0;i<8;i++){ x.fillStyle = i%2 ? '#2a1410' : '#321a12'; x.fillRect(0, i*32, 256, 32);
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, i*32, 256, 2);
      x.fillStyle = 'rgba(255,180,120,.05)'; x.fillRect((i*83)%256, i*32+8, 60, 2); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(W/6, D/6); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function shell(){
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({ map:planks(), roughness:0.55, metalness:0.05 }));
    floor.rotation.x = -Math.PI/2; group.add(floor);
    // a rug down the middle in the floor's colour
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(6, D-8),
      new THREE.MeshStandardMaterial({ color:0x5a0a14, roughness:0.9 }));
    rug.rotation.x = -Math.PI/2; rug.position.y = 0.01; group.add(rug);
    // edged in the floor's own colour
    const edge = new THREE.Color(FLOORS[lvl].col).getHex();
    tube(V(-3, 0.03, -(D-8)/2), V(-3, 0.03, (D-8)/2), edge, 0.08);
    tube(V( 3, 0.03, -(D-8)/2), V( 3, 0.03, (D-8)/2), edge, 0.08);

    const lacquer = flat(0x3a0a12), wood = flat(0x1e0c08);
    box(W, H, 0.5, lacquer, 0, H/2, -D/2);
    box(0.5, H, D, lacquer, -W/2, H/2, 0);
    box(0.5, H, D, lacquer,  W/2, H/2, 0);
    if(lvl===0){
      box(W/2-3, H, 0.5, lacquer, -(W/4+1.5), H/2, D/2);
      box(W/2-3, H, 0.5, lacquer,  (W/4+1.5), H/2, D/2);
      box(6, H-4.5, 0.5, lacquer, 0, 4.5+(H-4.5)/2, D/2);
    } else box(W, H, 0.5, lacquer, 0, H/2, D/2);
    solid(-W/2-1, W/2+1, -D/2-1, -D/2+0.3);
    solid(-W/2-1, -W/2+0.3, -D/2, D/2);
    solid( W/2-0.3, W/2+1, -D/2, D/2);
    solid(-W/2, W/2, D/2-0.3, D/2+1);
    // the ceiling: dark coffers edged in gold
    box(W, 0.3, D, wood, 0, H, 0);
    for(let i=-2;i<=2;i++){ box(W, 0.25, 0.25, flat(0x2a120a), 0, H-0.3, i*D/6); box(0.25, 0.25, D, flat(0x2a120a), i*W/6, H-0.3, 0); }
    // red pillars at the corners and down the walls, with gold caps
    const pil = flat(RED);
    for(const px of [-W/2+0.6, W/2-0.6]) for(let k=0;k<=4;k++){
      const pz = -D/2+0.6 + k*(D-1.2)/4;
      box(0.7, H, 0.7, pil, px, H/2, pz);
      box(0.9, 0.3, 0.9, glow(GOLD, 0.6), px, H-0.6, pz);
    }
    // neon along the ceiling edge, the way it runs along the eaves outside
    const y = H-0.9;
    tube(V(-W/2+0.4, y, -D/2+0.4), V(W/2-0.4, y, -D/2+0.4), PINK, 0.1);
    tube(V(-W/2+0.4, y, D/2-0.4), V(W/2-0.4, y, D/2-0.4), PINK, 0.1);
    tube(V(-W/2+0.4, y, -D/2+0.4), V(-W/2+0.4, y, D/2-0.4), PINK, 0.1);
    tube(V(W/2-0.4, y, -D/2+0.4), V(W/2-0.4, y, D/2-0.4), PINK, 0.1);
    tube(V(-W/2+0.4, 0.1, -D/2+0.4), V(W/2-0.4, 0.1, -D/2+0.4), CYAN, 0.06);
    // lanterns
    for(let i=-1;i<=1;i+=2) for(let j=-1;j<=1;j+=2){
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), glow(0xff3a2a, 1.6));
      l.scale.y = 1.3; l.position.set(i*W/5, H-2.2, j*D/5); group.add(l);
      box(0.04, 1.3, 0.04, flat(0x111111), i*W/5, H-0.9, j*D/5);
    }
    // the floor's name over the lifts
    const s = sign(FLOORS[lvl].name, FLOORS[lvl].col, 1024, 160, 'bold 110px ');
    s.position.set(0, H-1.8, -D/2+0.3); s.scale.set(9, 1.4, 1);
    const f = sign((lvl+1)+'F', '#ffffff', 256, 160, 'bold 110px ');
    f.position.set(-W/2+3, H-1.8, -D/2+0.3); f.scale.set(2.2, 1.4, 1);

    if(lvl===0){
      /* THE WAY OUT: the doorway you came in by, lit, and the thing E finds. */
      const arch = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 4.4),
        new THREE.MeshBasicMaterial({ color:0xff9ad0, transparent:true, opacity:0.3 }));
      arch.position.set(0, 2.2, D/2-0.3); arch.rotation.y = Math.PI; group.add(arch);
      tube(V(-2.9,0,D/2-0.35), V(-2.9,4.5,D/2-0.35), PINK, 0.14);
      tube(V( 2.9,0,D/2-0.35), V( 2.9,4.5,D/2-0.35), PINK, 0.14);
      tube(V(-2.9,4.5,D/2-0.35), V(2.9,4.5,D/2-0.35), PINK, 0.14);
      const door = new THREE.Group(); door.position.set(0, 0, D/2-0.6); group.add(door);
      door.userData = { roomThing:true, label:'The way out', verb:t('E — back out to the island') };
      arch.userData.owner = door;
      G.hits.push(arch);
      exitDoor = door;
      const n = sign('NEON', '#ff3fd0', 512, 128, 'bold 96px ');
      n.position.set(0, 6.2, D/2-0.4); n.rotation.y = Math.PI; n.scale.set(5, 1.25, 1);
    }
  }
  let exitDoor = null;

  /* A canvas of glowing words on a plane. */
  function sign(words, col, w, h, font){
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.font = font + uiFont(); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = col; x.shadowBlur = 24; x.fillStyle = col;
    x.fillText(words, w/2, h/2); x.fillText(words, w/2, h/2);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map:tex, transparent:true }));
    group.add(m);
    return m;
  }
  function rand(i){ const s = Math.sin(i*127.1 + 311.7)*43758.5453; return s - Math.floor(s); }

  /* PAPER LATTICE WINDOWS high on the side walls, glowing warm, and on the
     upper floors the front wall opens onto the sky with clouds going by —
     you are a hundred metres up and should be able to tell. */
  function lattice(){
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#ffd8a0'; x.fillRect(0,0,128,128);
    x.strokeStyle = '#3a0a0a'; x.lineWidth = 5;
    for(let i=0;i<=4;i++){ x.beginPath(); x.moveTo(i*32,0); x.lineTo(i*32,128); x.stroke(); x.beginPath(); x.moveTo(0,i*32); x.lineTo(128,i*32); x.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  function windows(){
    const tex = lattice();
    const mat = new THREE.MeshBasicMaterial({ map:tex, color:0xffb070 });
    for(const sx of [-1, 1]) for(let k=0;k<3;k++){
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.8), mat);
      m.position.set(sx*(W/2-0.3), 5.6, -D/3 + k*D/3); m.rotation.y = -sx*Math.PI/2; group.add(m);
    }
    if(lvl>0){
      // the front wall's view: a long window, sky and clouds beyond it
      const sky = document.createElement('canvas'); sky.width = 16; sky.height = 128;
      const x = sky.getContext('2d'), g = x.createLinearGradient(0,0,0,128);
      g.addColorStop(0, '#0a0628'); g.addColorStop(0.7, '#5a2a6a'); g.addColorStop(1, '#ff7aa8');
      x.fillStyle = g; x.fillRect(0,0,16,128);
      const st = new THREE.CanvasTexture(sky); st.colorSpace = THREE.SRGBColorSpace;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(W-6, 3.4), new THREE.MeshBasicMaterial({ map:st }));
      pane.position.set(0, 3.2, D/2-0.28); pane.rotation.y = Math.PI; group.add(pane);
      tube(V(-(W-6)/2, 1.5, D/2-0.35), V((W-6)/2, 1.5, D/2-0.35), CYAN, 0.08);
      tube(V(-(W-6)/2, 4.9, D/2-0.35), V((W-6)/2, 4.9, D/2-0.35), CYAN, 0.08);
      const puff = cloudTexture();
      for(let i=0;i<6;i++){
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:puff, transparent:true, opacity:0.7, depthWrite:false }));
        s.scale.set(4, 1.4, 1); s.position.set(-W/2 + rand(i)*W, 2.4 + rand(i*3)*2, D/2-0.2);
        s.userData.v = 0.4 + rand(i*11)*0.6; group.add(s); clouds.push(s);
      }
    }
  }
  function cloudTexture(){
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const x = c.getContext('2d');
    for(let i=0;i<7;i++){
      const g = x.createRadialGradient(20+i*15, 34, 0, 20+i*15, 34, 22);
      g.addColorStop(0, 'rgba(255,220,240,.9)'); g.addColorStop(1, 'rgba(255,220,240,0)');
      x.fillStyle = g; x.fillRect(0,0,128,64);
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* THE LIFTS: two glowing pads at the back, UP and DOWN. Stand on one and
     press E. A lift is a pad rather than a staircase because five flights
     of stairs is a walk between every game, and the point is the games. */
  function lifts(){
    const mk = (x, dir)=>{
      const to = lvl + dir;
      if(to < 0 || to >= FLOORS.length) return;
      const col = dir>0 ? CYAN : GOLD;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 32), glow(col, 1.4));
      disc.position.set(x, 0.05, -D/2+3.2); group.add(disc);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.06, 8, 40), glow(col, 2.5));
      ring.rotation.x = Math.PI/2; ring.position.set(x, 2.6, -D/2+3.2); group.add(ring);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 2.6, 32, 1, true),
        new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.12, side:THREE.DoubleSide, depthWrite:false }));
      beam.position.set(x, 1.3, -D/2+3.2); group.add(beam);
      const lab = sign((dir>0 ? 'UP  ' : 'DOWN  ') + FLOORS[to].name, dir>0 ? '#27e8ff' : '#ffc53d', 1024, 128, 'bold 72px ');
      lab.position.set(x, 3.3, -D/2+0.35); lab.scale.set(5.4, 0.7, 1);
      const pad = new THREE.Group(); pad.position.set(x, 0, -D/2+3.2); group.add(pad);
      pad.userData = { roomThing:true, label: dir>0 ? t('Lift up') : t('Lift down'),
                       verb: t('E — to {n}',{ n:(to+1)+'F '+FLOORS[to].name }), to };
      disc.userData.owner = pad; beam.userData.owner = pad; G.hits.push(disc, beam);
      pads.push(pad);
    };
    mk(-3.2, +1); mk(3.2, -1);
  }
  /* Up or down: the floor is rebuilt, and you arrive on the pad of the
     lift that would take you back. */
  function goFloor(n){
    prevLvl = lvl; lvl = n;
    others.forEach(o=>{ if(o.g.parent) o.g.parent.remove(o.g); });
    others.clear();
    build();
    const back = pads.find(p=>p.userData.to === (n > prevLvl ? n-1 : n+1)) || pads[0];
    G.pos.set(back ? back.position.x : 0, 1.7, (back ? back.position.z : 0) + 2.5);
    G.yaw = 0; G.vel.set(0,0,0);
    if(window.AVATAR) AVATAR.attach();
    G.scene.updateMatrixWorld(true);
    hud();
    fetchScores();
    if(window.CHAT && CHAT.sys) CHAT.sys(t('{f} — {n}',{ f:(n+1)+'F', n:FLOORS[n].name }));
  }
  let prevLvl = 0;

  /* ============================================================ cabinets
     Five in a row across the middle of the floor, screens to the door. The
     screen is the game's own 320x240 buffer on a canvas texture, running
     its attract loop until somebody plays it. */
  function cabinet(m, i, slot){
    const g = new THREE.Group();
    const [x, z, ry] = slot;
    g.position.set(x, 0, z); g.rotation.y = ry;
    g.scale.setScalar(1.5);                    // arcade-sized, in a room this big
    group.add(g);
    const accent = new THREE.Color(m.a).getHex();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.3, 1.1), flat(0x14142a));
    body.position.y = 1.15; g.add(body);
    // the screen, tipped back
    const c = document.createElement('canvas'); c.width = CABGAMES.W; c.height = CABGAMES.H;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.82), new THREE.MeshBasicMaterial({ map:tex }));
    scr.position.set(0, 1.62, 0.56); scr.rotation.x = -0.18; g.add(scr);
    // the control deck and the marquee
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.5), flat(0x20203e));
    deck.position.set(0, 1.05, 0.75); deck.rotation.x = -0.3; g.add(deck);
    const stick = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), glow(0xff4444, 1.5));
    stick.position.set(-0.3, 1.16, 0.78); g.add(stick);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), glow(accent, 1.8));
    btn.position.set(0.25, 1.14, 0.78); g.add(btn);
    const mq = sign(m.name, m.a, 512, 96, 'bold 64px ');
    group.remove(mq); g.add(mq);
    mq.position.set(0, 2.5, 0.57); mq.scale.set(1.4, 0.26, 1);
    // edges in the machine's own colour, and a pool of it on the floor
    [-0.71, 0.71].forEach(sx=> {
      const tb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.3, 0.05), glow(accent, 2.2));
      tb.position.set(sx, 1.15, 0.56); g.add(tb);
    });
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24),
      new THREE.MeshBasicMaterial({ color:accent, transparent:true, opacity:0.12 }));
    pool.rotation.x = -Math.PI/2; pool.position.set(0, 0.01, 0.9); g.add(pool);
    if(m.players===2){
      const tag = sign('2 PLAYER', '#ffc53d', 256, 64, 'bold 40px ');
      group.remove(tag); g.add(tag);
      tag.position.set(0, 2.78, 0.57); tag.scale.set(0.8, 0.2, 1);
    }

    solid(x-1.1, x+1.1, z-1.1, z+1.1, -0.5, 3.6);
    const front = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)).multiplyScalar(1.8).add(g.position);
    const cab = { m, g, scr, tex, ctx, i, game:null, frame:0, front };
    g.userData = { roomThing:true, label:m.name, verb:null, cab };
    body.userData.owner = g; scr.userData.owner = g;
    G.hits.push(body, scr);
    attractStart(cab);
    cabs.push(cab);
  }
  /* THE ATTRACT LOOP: the game on its first frame under its own name and a
     blinking INSERT COIN, which is what an arcade looks like from across
     the room. Redrawn a few times a second, not sixty. */
  function attractStart(cab){
    cab.game = CABGAMES.make(cab.m.id);
    cab.game.start(1234 + cab.i*77);
  }
  function attractDraw(cab){
    const x = cab.ctx, T = CABGAMES;
    cab.game.draw(x);
    if(CABGAMES.post) CABGAMES.post(x);
    x.fillStyle = 'rgba(5,6,15,.55)'; x.fillRect(0, T.H/2-30, T.W, 60);
    T.text(x, cab.m.name, T.W/2, T.H/2-22, 3, cab.m.a, 0.5);
    if(Math.floor(clock*2)%2) T.text(x, 'PRESS E TO PLAY', T.W/2, T.H/2+10, 1, '#fff', 0.5);
    T.text(x, COST+' COINS A GO', T.W/2, T.H-14, 1, '#ffc53d', 0.5);
    const best = (scores[cab.m.id]||[])[0];
    if(best) T.text(x, 'HI '+best.best+' '+best.display, T.W/2, T.H/2+20, 1, '#ffc53d', 0.5);
    cab.tex.needsUpdate = true;
  }

  /* THE BOARD over the way in: the class's best at this floor's solo games. */
  function scoreBoard(){
    const c = document.createElement('canvas'); c.width = 1024; c.height = 384;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.75), new THREE.MeshBasicMaterial({ map:tex }));
    /* on the front wall's inside, facing the lifts, over the way in */
    m.position.set(0, H-2.2, D/2-0.4); m.rotation.y = Math.PI; m.scale.set(0.8, 0.8, 1); group.add(m);
    const b = { c, x:c.getContext('2d'), tex };
    drawBoard(b);
    return b;
  }
  function drawBoard(b){
    if(!b) return;
    const x = b.x;
    x.fillStyle = '#07081a'; x.fillRect(0,0,1024,384);
    x.font = 'bold 44px ' + uiFont(); x.textAlign = 'center';
    x.fillStyle = '#ffc53d'; x.fillText(t('HIGH SCORES'), 512, 56);
    const solo = CABGAMES.MACHINES.filter(m=>m.players===1 && m.genre===FLOORS[lvl].genre).slice(0,5);
    solo.forEach((m, i)=>{
      const cx = 1024/(solo.length+1)*(i+1);
      x.font = 'bold 26px ' + uiFont(); x.fillStyle = m.a; x.fillText(m.name, cx, 118);
      const list = scores[m.id] || [];
      x.font = '22px ' + uiFont();
      if(!list.length){ x.fillStyle = '#6a6f9a'; x.fillText(t('nobody yet'), cx, 170); }
      list.slice(0,5).forEach((r, k)=>{
        x.fillStyle = k===0 ? '#fff' : '#b8bce0';
        x.fillText((k+1)+'. '+String(r.display).slice(0,12)+'  '+r.best, cx, 170 + k*40);
      });
    });
    b.tex.needsUpdate = true;
  }
  async function fetchScores(){
    boardAt = clock;
    try{
      const r = await fetch('/api/neon/scores', { credentials:'same-origin' });
      const j = await r.json();
      if(j && j.ok && j.scores) scores = j.scores;
    }catch(e){ /* no server: the board says nobody yet, the games still play */ }
    drawBoard(board);
  }
  /* A finished solo game. Your best goes in your bag whatever happens;
     the class board is asked only if it beats it. */
  async function record(id, score){
    if(!(score > 0)) return;
    const key = 'neon:'+id;
    const mine = window.PROGRESS && PROGRESS.get ? Number(PROGRESS.get(key, 0))||0 : 0;
    if(score > mine && window.PROGRESS && PROGRESS.set) PROGRESS.set(key, score);
    if(!(window.NET && NET.signedIn)) return;
    try{
      await fetch('/api/neon/score', { method:'POST', credentials:'same-origin',
        headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ game:id, score }) });
    }catch(e){}
    fetchScores();
  }
  const personalBest = id => (window.PROGRESS && PROGRESS.get) ? Number(PROGRESS.get('neon:'+id, 0))||0 : 0;

  /* ============================================================== playing
     The cabinet's game takes the whole window, drawn into one canvas with
     the pixels left square. Every key goes to it until Esc. */
  let overlay = null, pctx = null, pcanvas = null;
  function screen(){
    if(overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'neonPlay';
    overlay.innerHTML = '<canvas width="320" height="240"></canvas><div class="neon-foot"></div>';
    document.body.appendChild(overlay);
    pcanvas = overlay.querySelector('canvas');
    pctx = pcanvas.getContext('2d');
  }
  function foot(s){ if(overlay) overlay.querySelector('.neon-foot').textContent = s; }

  function startPlaying(cab){
    screen();
    overlay.classList.add('on');
    if(document.pointerLockElement) document.exitPointerLock();
    Object.keys(G.keys).forEach(k=>G.keys[k]=false);
    play = { cab, m:cab.m, game:null, mode:null, side:null, net:0, told:false, foe:'' };
    if(cab.m.players===2) choose();
    else begin(null, null);
    addEventListener('keydown', grab, true);
    addEventListener('keyup', grab, true);
  }
  /* ============================================================ the coins
     A go costs coins and a good go pays them back, in the same wallet the
     Wardrobe and the shop spend (wallet.js) — so an afternoon at SNAKE is
     a jacket, and a bad afternoon is a lesson about bad afternoons.

     Break-even is a decent game, not a great one: five coins in, and five
     back for 100 at SNAKE (ten pieces of food), 300 at BLOCK DROP or 500 at
     STAR SWARM. Head to head the winner takes twelve and the loser two, so
     playing somebody is never a straight loss. A go never pays more than
     forty, so no one game is worth farming. */
  const COST = 5, CAP = 40;
  const PAYS = {
    drop:  g => Math.floor(g.score/60),
    snake: g => Math.floor(g.score/20),
    swarm: g => Math.floor(g.score/100),
    // against the machine: a win pays double the go; VOLLEY pays a point each if you lose
    volley:g => g.winner==='A' ? 10 : Math.min(4, g.score),
    tank:  g => g.winner==='A' ? 10 : 0
  };
  const W_ = () => window.WALLET;
  const purse = () => W_() ? W_().coins() : 0;
  /* Take the coins for a go. No wallet (it failed to load) means free,
     rather than a cabinet nobody can use. */
  function pay(){
    if(!W_()) return true;
    return W_().spend(COST);
  }
  function refund(){ if(W_() && play && play.paid){ W_().award(t('NEON — money back'), 0, COST); play.paid = false; } }
  function broke(){
    play.mode = 'broke';
    foot(t('A go is {c} coins and you have {n}. Earn coins in missions, flying and the Gym. · Esc — walk away',
           { c:COST, n:purse() }));
  }
  /* What a finished go is worth. */
  function settle(){
    const g = play.game;
    if(!g || play.settled) return;
    play.settled = true;
    let won;
    if(play.mode==='versus') won = (g.winner===play.side) ? 12 : 2;
    else won = (play.m.pay || PAYS[play.m.id] || (()=>0))(g);
    won = Math.max(0, Math.min(CAP, won|0));
    play.won = won;
    if(won && W_()) W_().award(t('{g} — score {s}',{ g:play.m.name, s:g.score }), won, won);
    foot((won ? t('+{n} coins',{n:won}) : t('No coins this time')) + ' · '
         + t('you have {n}',{n:purse()}) + ' · '
         + t('SPACE — again ({c} coins)',{c:COST}) + ' · ' + t('Esc — walk away'));
  }

  /* A two-player cabinet asks first: the machine, or somebody here. */
  function choose(){
    play.mode = 'choose';
    const signed = window.NET && NET.signedIn && NET.live;
    foot((signed ? t('1 — against the machine · 2 — against somebody here · Esc — walk away')
                 : t('1 — against the machine · Esc — walk away (sign in to play somebody)'))
         + ' · ' + t('{c} coins a go, you have {n}',{ c:COST, n:purse() }));
  }
  /* `paid`: a match found after queueing was paid for when you queued. */
  function begin(seed, side, paid){
    if(!paid){
      if(!pay()) return broke();
      play.paid = true;
    }
    play.settled = false; play.won = 0; play.recorded = false;
    play.game = CABGAMES.make(play.m.id);
    play.game.start(seed===null ? (Math.random()*0xffffffff)>>>0 : seed, side||undefined);
    play.mode = side ? 'versus' : 'solo';
    play.side = side; play.told = false;
    const best = personalBest(play.m.id);
    foot((play.game.keys || t('arrows and SPACE')) + ' · ' + t('Esc — walk away')
         + (side ? ' · ' + t('against {n}',{n:play.foe}) : '')
         + (!side && play.m.players===1 && best ? ' · ' + t('your best {n}',{n:best}) : ''));
  }
  function stopPlaying(quiet){
    if(!play) return;
    if(play.mode==='waiting' || play.mode==='versus'){ if(window.NET && NET.arc) NET.arc({ op:'cancel' }); }
    if(play.mode==='waiting') refund();             // nobody came: that go was never played
    removeEventListener('keydown', grab, true);
    removeEventListener('keyup', grab, true);
    play = null;
    if(overlay) overlay.classList.remove('on');
    Object.keys(G.keys).forEach(k=>G.keys[k]=false);
    if(!quiet) lockPointer($('#view'));
  }
  /* EVERY KEY IS THE CABINET'S while you are at one — the capture listener
     runs before game.js's, and stops it, or SPACE would fire the game and
     jump the body you left standing in the hall at the same time. */
  function grab(e){
    if(!play) return;
    if(typingInField(e)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const down = e.type==='keydown';
    if(down && e.code==='Escape'){ stopPlaying(); return; }
    if(play.mode==='choose'){
      if(!down) return;
      if(e.code==='Digit1'){ begin(null, null); return; }
      if(e.code==='Digit2' && window.NET && NET.signedIn && NET.live){
        if(!pay()) return broke();
        play.paid = true;
        play.mode = 'waiting';
        NET.arc({ op:'queue', game:play.m.id });
        foot(t('Waiting for somebody to come and play… · Esc — stop waiting'));
      }
      return;
    }
    if(play.mode==='waiting' || play.mode==='gone' || play.mode==='broke') {
      if(down && play.mode==='gone' && e.code==='Space') choose();
      return;
    }
    if(!play.game) return;
    // over, and SPACE: again (solo), or back to the choice (versus)
    if(down && e.code==='Space' && play.game.over){
      if(play.mode==='versus'){ NET.arc({ op:'cancel' }); choose(); play.game = null; return; }
      begin(null, null); return;
    }
    if(e.repeat) return;
    play.game.key(e.code, down);
  }

  /* What the server says about a match. */
  function heard(m){
    if(!play) return;
    if(m.op==='match' && play.mode==='waiting' && m.game===play.m.id){
      play.foe = String(m.foe||'').slice(0,16);
      begin(m.seed>>>0, m.you==='B' ? 'B' : 'A', true);
      return;
    }
    if(m.op==='in' || m.op==='st'){
      if(play.mode==='versus' && play.game && play.game.net && m.d) play.game.net(m.d);
      return;
    }
    if(m.op==='gone' && (play.mode==='versus' || play.mode==='waiting')){
      if(play.game && play.game.over) return;        // they left after it finished
      /* walked out on you, or before it began: your go back, and the win
         if you were ahead is not something a disconnect should decide */
      if(play.mode==='waiting') refund();
      else if(play.game && !play.settled){ play.settled = true; refund(); }
      play.mode = 'gone';
      foot(t('{n} walked away. SPACE — back to the cabinet · Esc — leave it',{n:play.foe||t('They')}));
      return;
    }
    if(m.op==='error'){ foot(String(m.message||'')); play.mode='choose'; }
  }

  function playTick(dt){
    if(!play) return;
    const x = pctx, T = CABGAMES;
    if(play.mode==='choose' || play.mode==='waiting' || play.mode==='gone' || play.mode==='broke'){
      x.fillStyle = '#05060f'; x.fillRect(0,0,T.W,T.H);
      T.text(x, play.m.name, T.W/2, 50, 4, play.m.a, 0.5);
      const words = play.mode==='choose' ? ['1  VS THE MACHINE', (window.NET && NET.live) ? '2  VS SOMEBODY HERE' : '']
                  : play.mode==='waiting' ? ['WAITING FOR', 'A PLAYER' + '...'.slice(0, 1+Math.floor(clock*2)%3)]
                  : play.mode==='broke' ? ['NOT ENOUGH COINS', COST+' COINS A GO', 'YOU HAVE '+purse()]
                  : ['THEY LEFT', 'SPACE TO GO BACK'];
      words.forEach((w, k)=> w && T.text(x, w, T.W/2, 120 + k*22, 2, '#fff', 0.5));
      if(play.mode==='choose') T.text(x, COST+' COINS A GO   YOU HAVE '+purse(), T.W/2, 200, 1, '#ffc53d', 0.5);
      return;
    }
    const g = play.game;
    if(!g) return;
    const wasOver = g.over;
    g.tick(Math.min(dt, 0.05));
    g.draw(x);
    if(CABGAMES.post) CABGAMES.post(x);
    if(g.over){
      if(!play.settled) settle();
      // what it paid, over the game's own GAME OVER
      T.text(x, play.won ? '+'+play.won+' COINS' : 'NO COINS', T.W/2, T.H-26, 2, play.won ? '#ffc53d' : '#8a8fb8', 0.5);
    }
    if(play.mode==='versus'){
      /* twenty packets a second each way; the host's include "it is over",
         which is the only way the guest's copy ever finishes */
      play.net += dt;
      if(play.net >= 0.05){
        play.net = 0;
        const d = g.out();
        if(play.side==='A' && g.over) d.over = true;
        NET.arc({ op: play.side==='A' ? 'st' : 'in', d });
      }
      if(g.over && !play.told){
        play.told = true;
        if(play.side==='A') NET.arc({ op:'over', winner:g.winner||'' });
      }
    } else if(!play.recorded && g.over && play.m.players===1){
      play.recorded = true;
      record(play.m.id, g.score);
    }
  }

  /* ========================================================== the class
     Everybody else up here, drawn as who they chose, in room metres. */
  function paint(list){
    if(!on || !group) return;
    const seen = new Set();
    list.forEach(p=>{
      if(window.NET && NET.me && p.id===NET.me.id) return;
      if(p.at!=='arcade') return;
      if(Math.floor((+p.y||0)/100) !== lvl) return;
      p = Object.assign({}, p, { y:(+p.y||0) % 100 });
      seen.add(p.id);
      let o = others.get(p.id);
      if(!o){
        const g = new THREE.Group();
        g.add(nameTag(p.display));
        group.add(g);
        o = { g, char:null, model:null, x:p.x, y:p.y, z:p.z, tx:p.x, ty:p.y, tz:p.z,
              yaw:0, tyaw:0, speed:0, act:null };
        others.set(p.id, o);
      }
      const want = p.char && AVATAR.bodyOf(p.char);
      if(want && o.char!==want){
        o.char = want;
        AVATAR.load(want).then(m=>{ if(o.model) o.g.remove(o.model); o.model = m; o.g.add(m); })
                         .catch(()=>{});
      }
      o.tx = +p.x||0; o.ty = +p.y||0; o.tz = +p.z||0;
      o.tyaw = +p.yaw||0;
      o.act = p.act || null;
    });
    for(const [id,o] of others) if(!seen.has(id)){ group.remove(o.g); others.delete(id); }
    say();
  }
  function nameTag(name){
    const c = document.createElement('canvas'); c.width=256; c.height=64;
    const x = c.getContext('2d');
    x.fillStyle='rgba(29,23,48,.85)'; x.fillRect(0,14,256,36);
    x.fillStyle='#a8e6cf'; x.font='bold 24px '+uiFont(); x.textAlign='center';
    x.fillText(String(name||'').slice(0,16),128,42);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true}));
    s.scale.set(2.4,0.6,1); s.position.y=2.4; return s;
  }
  function smooth(dt){
    const k = 1 - Math.pow(0.0009, Math.min(dt, 0.1));
    for(const [,o] of others){
      const was = o.g.position.clone();
      o.x += (o.tx-o.x)*k; o.y += (o.ty-o.y)*k; o.z += (o.tz-o.z)*k;
      let d = o.tyaw - o.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      o.yaw += d*k;
      o.g.position.set(o.x, o.y, o.z);
      o.g.rotation.y = o.yaw;
      const v = was.distanceTo(o.g.position)/Math.max(dt, 0.001);
      o.speed += (v-o.speed)*Math.min(1, dt*8);
      if(o.model) AVATAR.animate(o.model, dt,
        (o.act && !{idle:1,walk:1,sprint:1}[o.act]) ? o.act : o.speed>7 ? 'sprint' : o.speed>0.4 ? 'walk' : 'idle');
    }
  }

  /* ========================================================== the frame */
  function nearestCab(){
    let best = null, bd = 2.8;
    cabs.forEach(c=>{
      const d = Math.hypot(G.pos.x-c.front.x, G.pos.z-c.front.z);
      if(d < bd){ bd = d; best = c; }
    });
    return best;
  }
  function usable(){
    if(play) return null;
    const f = G.focused;
    if(exitDoor && Math.hypot(G.pos.x, G.pos.z-(D/2)) < 4)
      return { on:exitDoor, verb:exitDoor.userData.verb, act:()=>leave() };
    for(const p of pads) if(Math.hypot(G.pos.x-p.position.x, G.pos.z-p.position.z) < 1.8)
      return { on:p, verb:p.userData.verb, act:()=>goFloor(p.userData.to) };
    const lookedCab = f && f.userData.cab;
    const c = (lookedCab && Math.hypot(G.pos.x-lookedCab.front.x, G.pos.z-lookedCab.front.z) < 3) ? lookedCab : nearestCab();
    if(!c) return null;
    return { on:c.g, verb: c.m.players===2 ? t('E — play (1 or 2 players)') : t('E — play'),
             act:()=>startPlaying(c) };
  }
  function tick(dt){
    if(!on) return;
    clock += dt;
    smooth(dt);
    clouds.forEach(s=>{
      s.position.x += s.userData.v*dt;
      if(s.position.x > W/2+3) s.position.x = -W/2-3;
    });
    // attract loops, a few frames a second, staggered
    cabs.forEach(c=>{
      if(play && play.cab===c) return;
      c.frame += dt;
      if(c.frame > 0.25 + c.i*0.01){ c.frame = 0; attractDraw(c); }
    });
    if(clock - boardAt > 30) fetchScores();
    if(play){
      playTick(dt);
      // the cabinet you are at shows what you see
      const c = play.cab;
      if(pcanvas){ c.ctx.drawImage(pcanvas, 0, 0); c.tex.needsUpdate = true; }
    }

    // what E does here, in the crosshair's own box (game.js focusScan)
    cabs.forEach(c=>c.g.userData.verb = null);
    if(exitDoor) exitDoor.userData.verbNow = null;
    handy = null;
    const u = usable();
    if(u){
      u.on.userData.verb = u.verb;
      if(u.on !== G.focused) handy = { label: u.on.userData.label, verb:u.verb };
    }
    if(!window.NET || !NET.live) return;
    const t0 = performance.now();
    if(t0 - sent < 90) return;
    sent = t0;
    /* the floor rides in the height: a hundred metres a floor, so a
       classmate on SHOOTERS is not drawn standing on CLASSICS */
    NET.pos({ x:+G.pos.x.toFixed(2), z:+G.pos.z.toFixed(2), y:+(lvl*100 + Math.max(0, G.pos.y-1.7)).toFixed(2),
              yaw:+(G.yaw + Math.PI).toFixed(3),
              char:AVATAR.chosen, act:AVATAR.act, at:'arcade' });
  }

  function hud(){
    const n = $('#missionName'); if(n) n.textContent = 'NEON';
    const ot = $('#objTitle'); if(ot) ot.textContent = (lvl+1)+'F · '+FLOORS[lvl].name;
    say();
  }
  function say(){
    const list = $('#objList');
    if(!list || !on) return;
    const n = others.size;
    const html = [
      '<li class="cur">\u{1F579}️ ' + t('Walk up to a cabinet — E to play') + '</li>',
      '<li>' + (n ? '\u{1F465} '+t('{n} here with you',{n}) : '\u{1F464} '+t('Just you up here')) + '</li>',
      '<li>' + t('Lift pads at the back — E to go up or down') + '</li>'
    ].join('');
    if(list.dataset.neonHtml !== html){ list.dataset.neonHtml = html; list.innerHTML = html; }
  }

  function key(e){
    if(!on || play) return false;
    if(e.code==='KeyE'){
      const u = usable();
      if(!u) return false;
      u.act();
      return true;
    }
    return false;
  }

  return { enter, leave, tick, key,
           get active(){ return on; },
           get handy(){ return handy; },
           get playing(){ return play ? { id:play.m.id, mode:play.mode, side:play.side } : null; },
           get cabinets(){ return cabs.map(c=>c.m.id); },
           get floor(){ return lvl; },
           get size(){ return W; },
           cabFront:id=>{ const c = cabs.find(k=>k.m.id===id); return c ? { x:c.front.x, z:c.front.z } : null; },
           /* for tests and the dev console: the pieces that are pure */
           _ground:(x,z,f)=>G.ground && G.ground(x,z,f) };
})();
