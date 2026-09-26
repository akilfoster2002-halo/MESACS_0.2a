/* =====================================================================
   NEON — the arcade in the clouds, from the inside.

   islands.js puts a pavilion on a sky island over Wano with an arch in the
   front of it; planet.js use('neon') walks you through that arch and into
   here. This is the room behind it: a dark two-storey hall with a starry
   black ceiling hung with glowing hexagons, blue trusses, LED stair treads
   up to a mezzanine, and five cabinets on the floor (cabgames.js) that you
   PLAY rather than write. A tall window down the right-hand wall looks out
   at the clouds, because the whole building is in the sky and it would be
   a waste not to say so.

   IT IS A FLAT ROOM IN game.js's ENGINE, the way chatroom.js is: G.solids
   for the walls, G.ground for the floor, the mezzanine and the stairs,
   G.ceiling for the floor above your head when you are under it. The
   mezzanine is a real second storey — you can walk underneath it and up
   onto it — because G.ground and G.ceiling are both told where your feet
   are.

   TWO OF THE CABINETS ARE AGAINST SOMEBODY. VOLLEY and TANK can be played
   against the machine, or against whoever else is standing in NEON: press
   2 at the cabinet and the server (index.js, `t:'arc'`) pairs you with the
   next person to do the same. After that the server only relays — the host
   (side A) simulates and sends the state, the guest sends what it is
   pressing. See NEON.md for why.

   HIGH SCORES are the solo games' best, kept two ways: your own in the
   progress bag (it syncs with your account and needs no server), and the
   class's on the board over the mezzanine (/api/neon/scores), which is the
   reason to be good at SNAKE.
   ===================================================================== */
window.NEON = (function(){
  const V = (x,y,z)=>new THREE.Vector3(x,y,z);
  const $ = s=>document.querySelector(s);

  /* THE HALL, in metres. The way in is the +z wall, the mezzanine is along
     the back (-z), the stairs up to it run along the left wall and the
     window is the right wall. */
  const W = 28, D = 26, H = 10;
  const MEZZ_Y = 4.2, MEZZ_Z = -5;                 // its height and its front edge
  const STAIR = { x1:-13.6, x2:-10.6, z0:3.5 };    // bottom at z0, top at MEZZ_Z
  const CYAN = 0x27e8ff, PINK = 0xff3fd0, BLUE = 0x3a6bff, GOLD = 0xffc53d;

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
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup = new THREE.Group();
    G.scene.add(G.roomGroup);
    G.solids = []; G.hits = []; G.selected = null; G.focused = null;
    G.vel.y = 0; G.onGround = true;
    group = G.roomGroup;
    cabs = []; clouds = [];

    G.scene.background = new THREE.Color(0x05060f);
    G.scene.fog = null;
    lights();
    shell();
    ceiling();
    mezzanine();
    windowWall();
    CABGAMES.MACHINES.forEach((m, i)=>cabinet(m, i));
    board = scoreBoard();

    G.ground = (x, z, feet)=>{
      const f = feet===undefined ? 0 : feet;
      if(x > STAIR.x1 && x < STAIR.x2 && z < STAIR.z0 && z > MEZZ_Z){
        const h = (STAIR.z0 - z)/(STAIR.z0 - MEZZ_Z)*MEZZ_Y;
        if(f > h - 1.2) return h;
      }
      if(z <= MEZZ_Z && f > MEZZ_Y - 1.2) return MEZZ_Y;
      return 0;
    };
    G.ceiling = (x, z, feet)=>(z < MEZZ_Z && (feet||0) < MEZZ_Y - 1.2) ? MEZZ_Y - 0.25 : H;
  }

  /* The room is lit by itself: a low blue ambient and the neon. The page's
     sun is turned down to a fill, as the chat rooms do. */
  function lights(){
    if(G.sun){ G.sun.intensity = 0.15; G.sun.position.set(4, 20, 6);
               G.sun.target.position.set(0,0,0); G.sun.target.updateMatrixWorld(); }
    let amb = G.scene.children.find(c=>c.isAmbientLight);
    if(!amb){ amb = new THREE.AmbientLight(0xffffff, 0.5); G.scene.add(amb); }
    amb.userData.roomOwned = true;
    amb.color.setHex(0x4a4a8a); amb.intensity = 0.9;
    [[-7, 7, 4, CYAN], [7, 7, 4, PINK], [0, 7, -9, BLUE], [0, 3, 2, 0xffffff]].forEach(([x,y,z,c])=>{
      const l = new THREE.PointLight(c, 18, 26, 1.6);
      l.position.set(x, y, z); group.add(l);
    });
  }

  function shell(){
    // the floor: near-black, with a grid of faint cyan lines let into it
    const fc = document.createElement('canvas'); fc.width = fc.height = 256;
    const fx = fc.getContext('2d');
    fx.fillStyle = '#0a0b16'; fx.fillRect(0,0,256,256);
    fx.strokeStyle = 'rgba(39,232,255,.22)'; fx.lineWidth = 3;
    fx.strokeRect(0,0,256,256);
    const ft = new THREE.CanvasTexture(fc);
    ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(W/2, D/2);
    ft.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({ map:ft, roughness:0.35, metalness:0.2 }));
    floor.rotation.x = -Math.PI/2; group.add(floor);

    const wall = flat(0x12122a);
    box(W, H, 0.4, wall, 0, H/2, -D/2);             // back
    box(0.4, H, D, wall, -W/2, H/2, 0);             // left
    // the front wall, with the doorway in the middle of it
    box(W/2-2.5, H, 0.4, wall, -(W/4+1.25), H/2, D/2);
    box(W/2-2.5, H, 0.4, wall,  (W/4+1.25), H/2, D/2);
    box(5, H-4.2, 0.4, wall, 0, 4.2+(H-4.2)/2, D/2);
    solid(-W/2-1, W/2+1, -D/2-1, -D/2+0.2);
    solid(-W/2-1, -W/2+0.2, -D/2, D/2);
    solid( W/2-0.2, W/2+1, -D/2, D/2);
    solid(-W/2, W/2, D/2-0.2, D/2+1);               // the doorway is E, not a hole

    /* THE WAY OUT: the arch you came in by, lit, and the thing E finds. */
    const arch = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.0),
      new THREE.MeshBasicMaterial({ color:0x9fe8ff, transparent:true, opacity:0.35 }));
    arch.position.set(0, 2.0, D/2-0.25); arch.rotation.y = Math.PI; group.add(arch);
    tube(V(-2.4,0,D/2-0.3), V(-2.4,4.2,D/2-0.3), CYAN, 0.12);
    tube(V( 2.4,0,D/2-0.3), V( 2.4,4.2,D/2-0.3), CYAN, 0.12);
    tube(V(-2.4,4.2,D/2-0.3), V(2.4,4.2,D/2-0.3), CYAN, 0.12);
    const door = new THREE.Group(); door.position.set(0, 0, D/2-0.5); group.add(door);
    door.userData = { roomThing:true, label:'The way out', verb:t('E — back out to the island'),
                      act:()=>leave() };
    arch.userData.owner = door;
    G.hits.push(arch);
    exitDoor = door;

    // neon trim round the whole hall, top and bottom
    const y1 = 0.12, y2 = H - 0.3;
    [[y1, PINK], [y2, CYAN]].forEach(([y, c])=>{
      tube(V(-W/2+0.25, y, -D/2+0.25), V(W/2-0.25, y, -D/2+0.25), c);
      tube(V(-W/2+0.25, y, -D/2+0.25), V(-W/2+0.25, y, D/2-0.25), c);
      tube(V(-W/2+0.25, y, D/2-0.25), V(-2.6, y, D/2-0.25), c);
      tube(V(2.6, y, D/2-0.25), V(W/2-0.25, y, D/2-0.25), c);
    });
    // and the sign over the way in, from the inside
    const s = sign('NEON', '#ff3fd0', 512, 128, 'bold 96px ');
    s.position.set(0, 6.2, D/2-0.3); s.rotation.y = Math.PI; s.scale.set(6, 1.5, 1);
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

  /* THE CEILING: black, full of stars, and hung with a field of hexagon
     panels with glowing edges, the way the reference art has it. */
  function ceiling(){
    box(W, 0.3, D, flat(0x03030a), 0, H, 0);
    const n = 260, pos = new Float32Array(n*3);
    for(let i=0;i<n;i++){
      pos[i*3] = (rand(i)-0.5)*(W-1); pos[i*3+1] = H - 0.2; pos[i*3+2] = (rand(i+999)-0.5)*(D-1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    group.add(new THREE.Points(geo, new THREE.PointsMaterial({ color:0xffffff, size:0.06 })));

    const hexG = new THREE.CylinderGeometry(1.25, 1.25, 0.08, 6);
    const edgeG = new THREE.EdgesGeometry(hexG);
    const panel = new THREE.MeshStandardMaterial({ color:0x0b0d22, roughness:0.6,
      transparent:true, opacity:0.8 });
    for(let r=0;r<5;r++) for(let c=0;c<9;c++){
      if(rand(r*17+c*5) < 0.3) continue;            // gaps, so the stars show
      const x = -W/2 + 2.5 + c*2.9 + (r%2)*1.45, z = -D/2 + 3 + r*2.5*1.8;
      if(x > W/2-1.5) continue;
      const y = H - 0.9 - rand(r*3+c)*1.4;
      const hx = new THREE.Mesh(hexG, panel);
      hx.position.set(x, y, z); group.add(hx);
      const e = new THREE.LineSegments(edgeG,
        new THREE.LineBasicMaterial({ color: rand(r+c*7) < 0.5 ? CYAN : BLUE }));
      e.position.copy(hx.position); group.add(e);
    }
    // blue-lit trusses across the hall
    for(let i=-1;i<=1;i++){
      const z = i*7;
      box(W-0.6, 0.35, 0.35, glow(BLUE, 0.9), 0, H-0.5, z);
      for(let k=-6;k<=6;k++) tube(V(k*2, H-0.5, z-0.15), V(k*2+1, H-0.5, z+0.15), BLUE, 0.05);
    }
  }
  function rand(i){ const s = Math.sin(i*127.1 + 311.7)*43758.5453; return s - Math.floor(s); }

  /* THE MEZZANINE and the LED stairs up to it. The slab is not a solid: the
     engine lets you walk under anything above your head and stand on
     anything G.ground says is there, so a real second storey is a height
     and a ceiling, not a box. The rail along the front is solid at the
     upper level only. */
  function mezzanine(){
    const depth = MEZZ_Z + D/2;
    box(W-0.8, 0.3, depth, flat(0x151631), 0, MEZZ_Y-0.15, -D/2 + depth/2);
    tube(V(-W/2+0.4, MEZZ_Y-0.3, MEZZ_Z), V(W/2-0.4, MEZZ_Y-0.3, MEZZ_Z), PINK, 0.1);
    // the rail: glass with a neon top, from the head of the stairs to the right wall
    const rx1 = STAIR.x2, rx2 = W/2 - 0.3;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(rx2-rx1, 1.0, 0.06),
      new THREE.MeshStandardMaterial({ color:0x88ccff, transparent:true, opacity:0.18 }));
    glass.position.set((rx1+rx2)/2, MEZZ_Y+0.5, MEZZ_Z+0.1); group.add(glass);
    tube(V(rx1, MEZZ_Y+1.0, MEZZ_Z+0.1), V(rx2, MEZZ_Y+1.0, MEZZ_Z+0.1), CYAN, 0.08);
    solid(rx1, rx2, MEZZ_Z-0.1, MEZZ_Z+0.3, MEZZ_Y-0.2, MEZZ_Y+1.2);
    // columns under it
    for(let x=-8; x<=12; x+=5) box(0.4, MEZZ_Y, 0.4, glow(BLUE, 0.4), x, MEZZ_Y/2, MEZZ_Z+0.3);
    for(let x=-8; x<=12; x+=5) solid(x-0.3, x+0.3, MEZZ_Z, MEZZ_Z+0.6, -0.5, MEZZ_Y-0.3);

    // the stairs: treads with a strip of light along each nose
    const steps = 14, run = (STAIR.z0 - MEZZ_Z)/steps, rise = MEZZ_Y/steps;
    const sw = STAIR.x2 - STAIR.x1, sx = (STAIR.x1+STAIR.x2)/2;
    for(let i=0;i<steps;i++){
      const zc = STAIR.z0 - (i+0.5)*run, yt = (i+1)*rise;
      box(sw, 0.12, run, flat(0x191a36), sx, yt-0.06, zc);
      tube(V(STAIR.x1, yt, zc+run/2), V(STAIR.x2, yt, zc+run/2), i%2 ? CYAN : PINK, 0.05);
    }
    // a stringer on the open side, lit
    tube(V(STAIR.x2, 0.1, STAIR.z0), V(STAIR.x2, MEZZ_Y+0.1, MEZZ_Z), CYAN, 0.08);
  }

  /* THE WINDOW: the whole right wall, both storeys, and clouds going past
     outside it. An island in the sky has to show it is one. */
  function windowWall(){
    const sky = document.createElement('canvas'); sky.width = 64; sky.height = 256;
    const sx = sky.getContext('2d');
    const gr = sx.createLinearGradient(0,0,0,256);
    gr.addColorStop(0, '#1a2a6a'); gr.addColorStop(0.6, '#6b5bb8'); gr.addColorStop(1, '#f39ac8');
    sx.fillStyle = gr; sx.fillRect(0,0,64,256);
    const tex = new THREE.CanvasTexture(sky); tex.colorSpace = THREE.SRGBColorSpace;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(D-2, H-1),
      new THREE.MeshBasicMaterial({ map:tex }));
    pane.position.set(W/2+3, H/2, 0); pane.rotation.y = -Math.PI/2; group.add(pane);
    // the frame: mullions, lit
    for(let z=-D/2+1; z<=D/2-1; z+=4) tube(V(W/2-0.15, 0.3, z), V(W/2-0.15, H-0.3, z), BLUE, 0.12);
    tube(V(W/2-0.15, MEZZ_Y, -D/2+1), V(W/2-0.15, MEZZ_Y, D/2-1), BLUE, 0.1);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(D-2, H-1),
      new THREE.MeshStandardMaterial({ color:0x99ccff, transparent:true, opacity:0.08 }));
    glass.position.set(W/2-0.2, H/2, 0); glass.rotation.y = -Math.PI/2; group.add(glass);
    // clouds between the glass and the sky
    const puff = cloudTexture();
    for(let i=0;i<9;i++){
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:puff, transparent:true,
        opacity:0.75, depthWrite:false }));
      const k = 3 + rand(i*9)*4;
      s.scale.set(k*1.8, k, 1);
      s.position.set(W/2 + 1.2 + rand(i)*1.2, 1 + rand(i*3)*(H-2), -D/2 + rand(i*5)*D);
      s.userData.v = 0.4 + rand(i*11)*0.6;
      group.add(s); clouds.push(s);
    }
  }
  function cloudTexture(){
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const x = c.getContext('2d');
    for(let i=0;i<7;i++){
      const g = x.createRadialGradient(20+i*15, 34, 0, 20+i*15, 34, 22);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0,0,128,64);
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* ============================================================ cabinets
     Five in a row across the middle of the floor, screens to the door. The
     screen is the game's own 320x240 buffer on a canvas texture, running
     its attract loop until somebody plays it. */
  function cabinet(m, i){
    const g = new THREE.Group();
    const x = -8 + i*4;
    g.position.set(x, 0, -1.5);
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

    solid(x-0.75, x+0.75, -1.5-0.6, -1.5+0.6, -0.5, 2.4);
    const cab = { m, g, scr, tex, ctx, i, game:null, frame:0 };
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
    x.fillStyle = 'rgba(5,6,15,.55)'; x.fillRect(0, T.H/2-30, T.W, 60);
    T.text(x, cab.m.name, T.W/2, T.H/2-22, 3, cab.m.a, 0.5);
    if(Math.floor(clock*2)%2) T.text(x, 'PRESS E TO PLAY', T.W/2, T.H/2+10, 1, '#fff', 0.5);
    const best = (scores[cab.m.id]||[])[0];
    if(best) T.text(x, 'HI '+best.best+' '+best.display, T.W/2, T.H/2+20, 1, '#ffc53d', 0.5);
    cab.tex.needsUpdate = true;
  }

  /* THE BOARD over the mezzanine: the class's best at each solo machine. */
  function scoreBoard(){
    const c = document.createElement('canvas'); c.width = 1024; c.height = 384;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.75), new THREE.MeshBasicMaterial({ map:tex }));
    m.position.set(0, MEZZ_Y + 3.2, -D/2 + 0.25); group.add(m);
    tube(V(-5.1, MEZZ_Y+1.3, -D/2+0.3), V(5.1, MEZZ_Y+1.3, -D/2+0.3), GOLD, 0.08);
    tube(V(-5.1, MEZZ_Y+5.1, -D/2+0.3), V(5.1, MEZZ_Y+5.1, -D/2+0.3), GOLD, 0.08);
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
    const solo = CABGAMES.MACHINES.filter(m=>m.players===1);
    solo.forEach((m, i)=>{
      const cx = 180 + i*332;
      x.font = 'bold 30px ' + uiFont(); x.fillStyle = m.a; x.fillText(m.name, cx, 118);
      const list = scores[m.id] || [];
      x.font = '26px ' + uiFont();
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
  /* A two-player cabinet asks first: the machine, or somebody here. */
  function choose(){
    play.mode = 'choose';
    const signed = window.NET && NET.signedIn && NET.live;
    foot(signed ? t('1 — against the machine · 2 — against somebody here · Esc — walk away')
                : t('1 — against the machine · Esc — walk away (sign in to play somebody)'));
  }
  function begin(seed, side){
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
        play.mode = 'waiting';
        NET.arc({ op:'queue', game:play.m.id });
        foot(t('Waiting for somebody to come and play… · Esc — stop waiting'));
      }
      return;
    }
    if(play.mode==='waiting' || play.mode==='gone') {
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
      begin(m.seed>>>0, m.you==='B' ? 'B' : 'A');
      return;
    }
    if(m.op==='in' || m.op==='st'){
      if(play.mode==='versus' && play.game && play.game.net && m.d) play.game.net(m.d);
      return;
    }
    if(m.op==='gone' && (play.mode==='versus' || play.mode==='waiting')){
      if(play.game && play.game.over) return;        // they left after it finished
      play.mode = 'gone';
      foot(t('{n} walked away. SPACE — back to the cabinet · Esc — leave it',{n:play.foe||t('They')}));
      return;
    }
    if(m.op==='error'){ foot(String(m.message||'')); play.mode='choose'; }
  }

  function playTick(dt){
    if(!play) return;
    const x = pctx, T = CABGAMES;
    if(play.mode==='choose' || play.mode==='waiting' || play.mode==='gone'){
      x.fillStyle = '#05060f'; x.fillRect(0,0,T.W,T.H);
      T.text(x, play.m.name, T.W/2, 50, 4, play.m.a, 0.5);
      const words = play.mode==='choose' ? ['1  VS THE MACHINE', (window.NET && NET.live) ? '2  VS SOMEBODY HERE' : '']
                  : play.mode==='waiting' ? ['WAITING FOR', 'A PLAYER' + '...'.slice(0, 1+Math.floor(clock*2)%3)]
                  : ['THEY LEFT', 'SPACE TO GO BACK'];
      words.forEach((w, k)=> w && T.text(x, w, T.W/2, 120 + k*22, 2, '#fff', 0.5));
      return;
    }
    const g = play.game;
    if(!g) return;
    const wasOver = g.over;
    g.tick(Math.min(dt, 0.05));
    g.draw(x);
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
    } else if(!wasOver && g.over && play.m.players===1){
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
    let best = null, bd = 2.6;
    cabs.forEach(c=>{
      const d = Math.hypot(G.pos.x-c.g.position.x, G.pos.z-(c.g.position.z+0.9));
      if(d < bd && G.pos.y < 3){ bd = d; best = c; }
    });
    return best;
  }
  function usable(){
    if(play) return null;
    const f = G.focused;
    if(f && f===exitDoor && Math.hypot(G.pos.x, G.pos.z-(D/2)) < 4.5)
      return { on:f, verb:f.userData.verb, act:()=>leave() };
    if(Math.hypot(G.pos.x, G.pos.z-(D/2)) < 3)
      return { on:exitDoor, verb:exitDoor.userData.verb, act:()=>leave() };
    const lookedCab = f && f.userData.cab;
    const c = (lookedCab && Math.hypot(G.pos.x-f.position.x, G.pos.z-f.position.z) < 3.4) ? lookedCab : nearestCab();
    if(!c) return null;
    return { on:c.g, verb: c.m.players===2 ? t('E — play (1 or 2 players)') : t('E — play'),
             act:()=>startPlaying(c) };
  }
  function tick(dt){
    if(!on) return;
    clock += dt;
    smooth(dt);
    clouds.forEach(s=>{
      s.position.z += s.userData.v*dt;
      if(s.position.z > D/2+3) s.position.z = -D/2-3;
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
    NET.pos({ x:+G.pos.x.toFixed(2), z:+G.pos.z.toFixed(2), y:+Math.max(0, G.pos.y-1.7).toFixed(2),
              yaw:+(G.yaw + Math.PI).toFixed(3),
              char:AVATAR.chosen, act:AVATAR.act, at:'arcade' });
  }

  function hud(){
    const n = $('#missionName'); if(n) n.textContent = 'NEON';
    const ot = $('#objTitle'); if(ot) ot.textContent = t('THE ARCADE IN THE CLOUDS');
    say();
  }
  function say(){
    const list = $('#objList');
    if(!list || !on) return;
    const n = others.size;
    const html = [
      '<li class="cur">\u{1F579}️ ' + t('Walk up to a cabinet — E to play') + '</li>',
      '<li>' + (n ? '\u{1F465} '+t('{n} here with you',{n}) : '\u{1F464} '+t('Just you up here')) + '</li>',
      '<li>' + t('VOLLEY and TANK: press 2 to play somebody here') + '</li>'
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
           /* for tests and the dev console: the pieces that are pure */
           _ground:(x,z,f)=>G.ground && G.ground(x,z,f) };
})();
