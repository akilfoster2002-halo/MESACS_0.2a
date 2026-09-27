/* =====================================================================
   SANFRAN — a quest in its own world. ACT 1: THE UNDERGROUND.

   Ren Morikawa is seventeen, brilliant, bored, and fights robots for
   money in warehouses. His brother Daichi studies at the Sanfran
   Institute of Technology and thinks Ren could build something that
   matters. Act 1 is the night that starts: a rainy neon city, Ren's
   bedroom-workshop, the underground market, and two fights — BRUISER,
   and THE TITAN, which you cannot out-muscle and have to out-think.

   IT IS PLAYED, NOT READ. The first cut of this had a line of dialogue
   for every object and a paragraph for every step, and a game that is
   mostly reading is a worse book. So:
     people talk in bubbles over their heads, a few words at a time, and
       the world keeps moving while they do — nobody presses SPACE to
       get to the end of a conversation (every line is in LINES, and a
       test holds each one to seven words);
     where to go is a beacon standing on the place, not a sentence;
     what you get flies into the bag, what you earn pops where you
       earned it, and the keys you need are keycaps, lit when they matter;
     the repair is done with your hands — screws out, the burnt motor
       yanked, the right part chosen by what it visibly does, then a test
       drive that leaves its tyre tracks on the floor so you can see
       which way it veered and fix it;
     the robot is built on a turntable in front of you, part by part,
       and the shop IS the bench;
     and the fights draw their own tips (sfbots.js).

   IT IS LIT, NOT BLACK. Night and neon is the look, but a night scene
   built out of near-black boxes under three point lights is just a black
   screen. Every scene has its own light rig (LOOKS): an environment map
   made from a coloured sky and a few neon panels, so every surface has
   something to reflect; a moon or a work light that casts shadows;
   surfaces painted in mid tones so there is something for the light to
   land on; and its own exposure. All of it is handed back on the way out.

   IT IS ITS OWN WORLD, the way a chat room is: a flat room in game.js's
   engine, entered from a gate on Wano (planet.js use('sanfran')), with
   its own scenes built one at a time — BEDROOM, STREET, MARKET, ARENA.

   THE RPG IS HERE TOO, saved in the progress bag under 'sf': research XP
   and tech levels, five skills that unlock parts (the bench shows the
   lock and which skill opens it), an inventory, credits and reputation.

   CONTROLS: WASD move · mouse look · SPACE jump · E use · I bag.
   In a fight: WASD drive, SPACE hit, SHIFT block, Q dodge, F scan.
   ===================================================================== */
window.SANFRAN = (function(){
  const V = (x,y,z)=>new THREE.Vector3(x,y,z);
  const $ = s=>document.querySelector(s);
  const esc = s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* ============================================================ the words
     Every line anybody says, in one place. Seven words at most — a test
     holds them to it — because a bubble is read at a glance or not at all.
     Speakers: ren (you), daichi, mc, whisper, doc; a line with 📱 in it is
     on the phone and floats at the top of the screen. */
  const LINES = {
    call:     [['daichi','📱 Still up? Fix Mrs. Oda’s bot.'], ['daichi','📱 I’m outside.'], ['ren','On it.']],
    fixed:    [['ren','Straight as a laser.'], ['daichi','📱 Finally. Come on out.']],
    bed:      [['ren','Bot Night… tonight?']],
    doorShut: [['ren','Bot first.']],
    street:   [['daichi','Oden? My treat.'], ['ren','Gonna walk around.'], ['daichi','Stay out of trouble.']],
    noBot:    [['warehouse','🤖❓']],
    built:    [['ren','Ready to fight.']],
    tipBruiser:[['whisper','Dodge the charge. Hit its back.']],
    tipTitan: [['whisper','Scan it. Right motor’s cracked.']],
    doc:      [['doc','Burnt motors? I trade.']],
    docTrade: [['doc','Deal.']],
    mcHello:  [['mc','A NEW KID!']],
    mcBruiser:[['mc','Your bot versus… BRUISER!']],
    mcTitan:  [['mc','THE TITAN! Undefeated!']],
    mcAgain:  [['mc','Rematch? The crowd loves it!']],
    win1:     [['mc','BRUISER IS DOWN!'], ['ren','The Titan’s next.']],
    lose:     [['mc','SCRAP! Fix up. Try again.']],
    ending:   [['daichi','You hit its weak motor. Every time.'], ['ren','Obvious.'],
               ['daichi','You could build something real.'], ['daichi','Come to the Institute tomorrow.'],
               ['ren','…Fine. I’m bringing my robot.']]
  };
  const INK = { ren:'#27e8ff', daichi:'#3ddc84', mc:'#ff3fd0', whisper:'#c86bff', doc:'#3ddc84', warehouse:'#aab4c8' };

  /* ============================================================ the items
     A name and an icon — the bag is a grid of icons, not a catalogue. */
  const ITEMS = {
    scrap:{ name:'Scrap', icon:'🔩' }, copper:{ name:'Copper', icon:'🧵' }, aluminium:{ name:'Aluminium', icon:'🥫' },
    carbon:{ name:'Carbon fibre', icon:'⬛' }, silicon:{ name:'Silicon', icon:'💠' }, board:{ name:'Circuit board', icon:'📟' },
    sensor:{ name:'Sensor', icon:'📡' }, camera:{ name:'Camera', icon:'📷' }, mcu:{ name:'Chip', icon:'🧠' },
    motor_burnt:{ name:'Burnt motor', icon:'🔥' }, servo:{ name:'Servo', icon:'🎚' }, wheel:{ name:'Wheel', icon:'⚫' },
    joint:{ name:'Joint', icon:'🔗' }, plating:{ name:'Plating', icon:'🛡' },
    energycell:{ name:'Strange cell', icon:'🔋' }, invite:{ name:'Bot Night card', icon:'🎟' }
  };
  const SLOT_ICON = { core:'💠', frame:'🧱', motor:'⚙', power:'🔋', weapon:'🔨', control:'🎮', plating:'🛡' };
  const WEAPON_ICON = { wpn_hammer:'🔨', wpn_spinner:'🌀', wpn_flipper:'⤴' };
  SFBOTS.SLOTS.forEach(slot=>SFBOTS.PARTS[slot].forEach(p=>{
    ITEMS[p.id] = { name:p.name, icon: WEAPON_ICON[p.id] || SLOT_ICON[slot], slot };
  }));
  /* Five skills, each an icon. They unlock parts, and the bench's lock
     shows the icon and the level that opens it. */
  const ATTRS = [['eng','🔧','ENG'], ['prog','💻','CODE'], ['mat','🧪','MAT'], ['energy','⚡','POWER'], ['ana','🔍','SCAN']];
  const ATTR_ICON = Object.fromEntries(ATTRS.map(a=>[a[0], a[1]]));

  /* ============================================================= the save */
  const KEY = 'sf';
  function fresh(){
    return { v:1, act:1, step:'call', scene:'bedroom', rxp:0, lvl:1, pts:0,
      attrs:{ eng:2, prog:1, mat:1, energy:1, ana:1 }, credits:60, rep:0,
      inv:{ scrap:6, copper:2, board:1, mcu:1, servo:1, motor_burnt:0, wheel:2, motor_micro:1, frame_balanced:1, power_aa:1, core_std:1, ctl_remote:1 },
      robot:{}, flags:{}, found:{}, talked:{} };
  }
  let S = fresh();
  function load(){
    try{ const raw = window.PROGRESS && PROGRESS.get(KEY, null); if(raw){ const s = JSON.parse(raw); if(s && s.v===1) S = Object.assign(fresh(), s); } }catch(e){ S = fresh(); }
  }
  function save(show){
    try{ if(window.PROGRESS) PROGRESS.set(KEY, JSON.stringify(S)); }catch(e){}
    if(show && el){ const s = el.querySelector('#sfSave'); s.classList.remove('on'); void s.offsetWidth; s.classList.add('on'); }
  }
  const has = (id, n) => (S.inv[id]||0) >= (n||1);
  function give(id, n){ S.inv[id] = (S.inv[id]||0) + (n||1); }
  function take(id, n){ S.inv[id] = Math.max(0, (S.inv[id]||0) - (n||1)); }
  /* RESEARCH XP. A level every 200·level, each one a point to spend. */
  const need = l => 200*l;
  function rxp(n, from){
    S.rxp += n;
    pop('+'+n+' XP', from || head(), '#3ddc84');
    while(S.rxp >= need(S.lvl)){ S.rxp -= need(S.lvl); S.lvl++; S.pts++; banner('LEVEL '+S.lvl+'!', 1.6, 'lvl'); }
    hud();
  }
  const attr = k => S.attrs[k]||1;
  const meets = req => !req || Object.keys(req).every(k=>attr(k) >= req[k]);

  /* ============================================================ the story
     Each step is a goal — an icon and three words — and a place. The
     place is where the beacon stands; if it is in another scene the
     beacon stands on the way out towards it. */
  const GOALS = {
    call:   ['🔧','Fix the bot',    'bedroom','bot'],
    repair: ['🔧','Fix the bot',    'bedroom','bot'],
    free:   ['🚪','Head out',       'bedroom','door'],
    street: ['🛒','Find the Bazaar','street','bazaar'],
    market: ['🛠','Build a robot',  'market','bench'],
    fight1: ['🥊','Beat BRUISER',   'arena','pad'],
    titan:  ['👑','Beat THE TITAN', 'arena','pad'],
    done:   ['⭐','Act 1 complete', null, null]
  };
  const EXIT  = { bedroom:'door', market:'stairs', arena:'exit' };    // the way out to the street
  const ENTRY = { bedroom:'home', market:'bazaar', arena:'warehouse' }; // and where each is from it
  function goal(){
    const g = GOALS[S.step] || GOALS.repair;
    let sc = g[2], spot = g[3];
    if(S.step==='market' && builtRobot()){ sc = 'arena'; spot = 'pad'; }
    return { icon:g[0], text: S.step==='market' && builtRobot() ? 'Go to Warehouse 17' : g[1], scene:sc, spot };
  }
  function goalSpot(){
    const g = goal(); if(!g.scene) return null;
    if(scene===g.scene) return spots[g.spot] || null;
    if(scene==='street') return spots[ENTRY[g.scene]] || null;
    return spots[EXIT[scene]] || null;
  }
  function go(step){
    S.step = step; save(true);
    hud();
  }

  /* ============================================================ the world */
  let on = false, server = null, group = null, scene = null, clock = 0;
  let things = [];              // what E does: {x,z,r,verb,act,when,hold}
  let actors = [];              // anything that moves on its own: {tick(dt)}
  let cast = {};                // who is who in this scene, for bubbles
  let spots = {};               // named places, for the beacon
  let pickups = [], tweens = [], fx = [];
  let rain = null;
  let fighting = false, busy = null, mode = null;   // busy: 'panel' | 'mode'
  let streetIntro = false;

  function enter(sv){
    server = sv || null;
    load();
    if(window.AVATAR){ AVATAR.posture(null); if(AVATAR.setCast) AVATAR.setCast(null); }
    if(window.MENU && MENU.hideAll) MENU.hideAll();
    on = true;
    keepRig();
    ui();
    G.room = 'sanfran';
    G.running = true;
    G.firstPerson = false;
    G.camera.up.set(0,1,0);
    G.camera.near = 0.1; G.camera.far = 500; G.camera.updateProjectionMatrix();
    const h = $('#hud'); if(h) h.classList.add('hidden');
    const map = $('#mapwrap'); if(map) map.classList.add('hidden');
    if(window.NET && NET.signedIn && server){
      NET.connect(server, { players:()=>{}, objs:()=>{}, chat:m=>CHAT.line(m.from, m.text, m.id),
        sys:s=>CHAT.sys(s), clear:q=>CHAT.clear(q), unsay:id=>CHAT.remove(id) });
    }
    goScene(S.scene || 'bedroom', true);
    lockPointer($('#view'));
    keys([['WASD','🚶'],['SPACE','⤒'],['E','✋'],['I','🎒']], 7);
    if(S.step==='call' && !S.flags.called){ S.flags.called = true; setTimeout(()=>{ if(on) talk('call', ()=>{ if(S.step==='call') go('repair'); }); }, 900); }
  }
  function leave(){
    if(!on) return;
    stopFight(); exitMode();
    on = false; busy = null;
    flushTalk();
    save();
    const o = $('#sf'); if(o) o.classList.add('hidden');
    const h = $('#hud'); if(h) h.classList.remove('hidden');
    G.scene.background = null; G.scene.fog = null;
    giveRigBack();
    const sv = (window.NET && window.PLANET) ? PLANET.server : server;
    if(window.PLANET) PLANET.enter(sv, 'hub');
  }

  /* ============================================================ the light
     One rig per scene. `env` is the sky a surface sees when it reflects:
     a gradient and a few bright panels — the lamp, the neon, the stadium
     light — made into an environment map once per visit. `sun` is the one
     light that casts shadows (a moon on the street, a work light in the
     arena); indoors the walls and ceiling are marked flat so it reaches
     the floor and the furniture throws shadows on it. */
  const LOOKS = {
    bedroom:{ bg:0x1c1a33, fog:null, amb:[0xb8b0ff,0.3], hemi:[0xc8d0ff,0x8a6a50,0.8], sun:[0xa8b8ff,1.1,[14,11,4]], exp:1.3, envI:0.9,
      env:{ top:0x5a5a9a, hor:0x9a7aa8, bot:0x4a3a34, pads:[[0xffc890,3,-6,3,-3,6,4],[0xff5ab4,2.5,20,5,0,8,6],[0x8aa8ff,2,0,20,0,10,10]] } },
    street:{ bg:0x2e2866, fog:[0x342a6a,28,120], amb:[0xa098ff,0.25], hemi:[0x9098ff,0x4a3450,0.9], sun:[0xb0bcff,0.8,[-30,50,25]], exp:1.35, envI:1.0,
      env:{ top:0x2e2a6a, hor:0x8a4aa0, bot:0x221a30, pads:[[0xff3fd0,3,30,4,20,20,6],[0x27e8ff,3,-30,4,-20,20,6],[0xffb070,2.4,0,4,40,16,5],[0xffb070,2,0,4,-40,16,5]] } },
    market:{ bg:0x2a1a28, fog:[0x3a2436,18,60], amb:[0xffc0d0,0.3], hemi:[0xffd8c0,0x5a3a4a,0.85], sun:[0xffd8b0,0.7,[5,20,3]], exp:1.3, envI:0.95,
      env:{ top:0x7a5a6a, hor:0xa0606e, bot:0x3a2a30, pads:[[0xffb060,3,0,10,0,10,10],[0xff3fd0,2.5,-20,3,0,10,5],[0x27e8ff,2.5,20,3,0,10,5]] } },
    arena:{ bg:0x1a1a26, fog:[0x22222e,30,85], amb:[0xdde0ff,0.25], hemi:[0xe0e8ff,0x4a4650,0.75], sun:[0xffffff,1.6,[6,30,8]], exp:1.2, envI:0.9,
      env:{ top:0x4a4a5a, hor:0x7a7a8a, bot:0x2a2a30, pads:[[0xffffff,4,0,25,0,12,12],[0xff3040,2,-25,5,10,10,5],[0x27e8ff,2,25,5,10,10,5]] } }
  };
  let rigWas = null;
  const envs = {};
  function keepRig(){
    if(rigWas) return;
    rigWas = { exp:G.renderer.toneMappingExposure, envI:G.scene.environmentIntensity,
      amb: G.amb && [G.amb.color.getHex(), G.amb.intensity],
      hemi: G.hemi && [G.hemi.color.getHex(), G.hemi.groundColor.getHex(), G.hemi.intensity],
      sun: G.sun && [G.sun.color.getHex(), G.sun.intensity, G.sun.position.clone(), G.sun.target.position.clone()] };
  }
  function giveRigBack(){
    const w = rigWas; if(!w) return;
    G.renderer.toneMappingExposure = w.exp;
    G.scene.environment = null; G.scene.environmentIntensity = w.envI===undefined ? 1 : w.envI;
    if(G.amb && w.amb){ G.amb.color.setHex(w.amb[0]); G.amb.intensity = w.amb[1]; }
    if(G.hemi && w.hemi){ G.hemi.color.setHex(w.hemi[0]); G.hemi.groundColor.setHex(w.hemi[1]); G.hemi.intensity = w.hemi[2]; }
    if(G.sun && w.sun){ G.sun.color.setHex(w.sun[0]); G.sun.intensity = w.sun[1]; G.sun.position.copy(w.sun[2]); G.sun.target.position.copy(w.sun[3]); G.sun.target.updateMatrixWorld(); }
    Object.keys(envs).forEach(k=>{ envs[k].dispose(); delete envs[k]; });
    rigWas = null;
  }
  function envFor(id){
    if(envs[id]) return envs[id].texture;
    const e = LOOKS[id].env, es = new THREE.Scene(), trash = [];
    const geo = new THREE.SphereGeometry(50, 32, 16), P = geo.attributes.position, col = [];
    const top = new THREE.Color(e.top), hor = new THREE.Color(e.hor), bot = new THREE.Color(e.bot), c = new THREE.Color();
    for(let i=0;i<P.count;i++){ const y = P.getY(i)/50;
      if(y > 0) c.copy(hor).lerp(top, Math.pow(y, 0.6)); else c.copy(hor).lerp(bot, Math.pow(-y, 0.6));
      col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const skyM = new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.BackSide });
    es.add(new THREE.Mesh(geo, skyM)); trash.push(geo, skyM);
    e.pads.forEach(([hex, k, x, y, z, w, h])=>{
      const pg = new THREE.PlaneGeometry(w, h), pm = new THREE.MeshBasicMaterial({ color:new THREE.Color(hex).multiplyScalar(k), side:THREE.DoubleSide });
      const m = new THREE.Mesh(pg, pm); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); trash.push(pg, pm);
    });
    const pm = new THREE.PMREMGenerator(G.renderer);
    envs[id] = pm.fromScene(es, 0.04);
    pm.dispose(); trash.forEach(t=>t.dispose());
    return envs[id].texture;
  }
  function applyLook(id){
    const L = LOOKS[id];
    G.scene.background = new THREE.Color(L.bg);
    G.scene.fog = L.fog ? new THREE.Fog(L.fog[0], L.fog[1], L.fog[2]) : null;
    if(G.amb){ G.amb.color.setHex(L.amb[0]); G.amb.intensity = L.amb[1]; G.amb.userData.roomOwned = true; }
    if(G.hemi){ G.hemi.color.setHex(L.hemi[0]); G.hemi.groundColor.setHex(L.hemi[1]); G.hemi.intensity = L.hemi[2]; }
    if(G.sun){ G.sun.color.setHex(L.sun[0]); G.sun.intensity = L.sun[1]; G.sun.position.set(L.sun[2][0], L.sun[2][1], L.sun[2][2]);
      G.sun.target.position.set(0,0,0); G.sun.target.updateMatrixWorld(); }
    G.renderer.toneMappingExposure = L.exp;
    try{ G.scene.environment = envFor(id); G.scene.environmentIntensity = L.envI; }catch(e){ G.scene.environment = null; }
  }

  /* ---------------------------------------------------------- scene kit */
  const std = (c, r, m) => new THREE.MeshStandardMaterial({ color:c, roughness:r===undefined?0.6:r, metalness:m||0 });
  const glowM = (c, k) => new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:k||1.8 });
  function box(w, h, d, mat, x, y, z, solid){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); group.add(m);
    if(solid) G.solids.push({ x1:x-w/2, x2:x+w/2, z1:z-d/2, z2:z+d/2, y1:-0.5, y2:y+h/2 });
    return m;
  }
  const flat = m => { m.userData.flat = true; return m; };    // lets the sun through (see shade() in game.js)
  function textTex(lines, opts){
    const o = Object.assign({ w:512, h:256, bg:'#0b0d18', fg:'#e8f4ff', font:'bold 40px', glow:null, align:'center' }, opts||{});
    const c = document.createElement('canvas'); c.width = o.w; c.height = o.h;
    const x = c.getContext('2d');
    if(o.bg){ x.fillStyle = o.bg; x.fillRect(0,0,o.w,o.h); }
    x.font = o.font+' '+uiFont(); x.textAlign = o.align; x.textBaseline = 'middle'; x.fillStyle = o.fg;
    if(o.glow){ x.shadowColor = o.glow; x.shadowBlur = 20; }
    const L = [].concat(lines), step = o.h/(L.length+1);
    L.forEach((l,i)=>x.fillText(l, o.align==='center' ? o.w/2 : 20, step*(i+1)));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function sign(lines, w, h, x, y, z, ry, opts){
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map:textTex(lines, opts), transparent:!!(opts&&opts.bg===null), side:THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry||0; m.userData.flat = true; group.add(m); return m;
  }
  function thing(x, z, verb, act, o){ o = o||{}; const t = { x, z, verb, act, r:o.r||1.6, when:o.when, hold:o.hold||0, icon:o.icon||'' }; things.push(t); return t; }
  function light(c, i, d, x, y, z){ const l = new THREE.PointLight(c, i, d, 1.5); l.position.set(x, y, z); group.add(l); return l; }

  function clearScene(){
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup = new THREE.Group(); G.scene.add(G.roomGroup);
    group = G.roomGroup;
    G.solids = []; G.hits = []; G.selected = null; G.focused = null;
    things = []; actors = []; cast = {}; spots = {}; pickups = []; tweens = []; fx = []; rain = null; turntable = null; crowd = []; fightQueued = false;
    G.vel.set(0,0,0); G.onGround = true;
    G.ground = ()=>0; G.ceiling = null;
    clearLayer();
    makeBeacon();
  }
  function goScene(id, first, at){
    exitMode();
    flushTalk();
    scene = id; S.scene = id;
    clearScene();
    applyLook(id);
    ({ bedroom, street, market, arena })[id](at);
    if(window.AVATAR) AVATAR.attach();
    G.scene.updateMatrixWorld(true);
    hud();
    if(!first) save();
  }
  /* Between scenes: a quick dip to black, so a door is a door and not a cut. */
  let travelling = false;
  function travel(id, at, then){
    if(travelling) return;
    travelling = true;
    const f = el.querySelector('#sfFade'); f.classList.add('on');
    setTimeout(()=>{ if(!on){ travelling = false; return; }
      goScene(id, false, at); if(then) then();
      setTimeout(()=>{ f.classList.remove('on'); travelling = false; }, 60); }, 280);
  }
  function spawn(x, z, yaw){
    G.pos.set(x, 1.7, z); G.yaw = yaw||0; G.pitch = 0; G.vel.set(0,0,0);
    const lid = G.ceiling ? G.ceiling() - 0.5 : 3.5;                 // not in the ceiling
    G.camera.position.set(x + Math.sin(G.yaw)*3, Math.min(3.5, lid), z + Math.cos(G.yaw)*3);
    G.camera.lookAt(x, 1.5, z);
  }
  /* Thick, and thick outwards: the chase camera finds a wall by sampling
     the line behind you at intervals, and a 30 cm wall fits between two
     samples — the camera went through it and the room was a black screen. */
  function walls(W, D, H, mat){
    const T = 1.2, o = T/2 - 0.15;
    [box(W+2*T, H, T, mat, 0, H/2, -D/2-o, true), box(W+2*T, H, T, mat, 0, H/2, D/2+o, true),
     box(T, H, D, mat, -W/2-o, H/2, 0, true), box(T, H, D, mat, W/2+o, H/2, 0, true)].forEach(flat);
  }
  /* rain: a box of falling streaks that follows the camera */
  function makeRain(n, area){
    const pos = new Float32Array(n*3);
    for(let i=0;i<n;i++){ pos[i*3] = (Math.random()-0.5)*area; pos[i*3+1] = Math.random()*20; pos[i*3+2] = (Math.random()-0.5)*area; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color:0xb8d8ff, size:0.07, transparent:true, opacity:0.7 }));
    group.add(pts);
    rain = { pts, area };
  }
  /* people: the game's own rigged cast. They walk a loop, walk somewhere
     and stop, or stand — and a standing one turns to look at you. Some
     say something now and then, in pictures. */
  function person(char, x, z, o){
    o = o||{};
    const g = new THREE.Group(); g.position.set(x, 0, z); if(o.face!==undefined) g.rotation.y = o.face; group.add(g);
    const a = { g, model:null, path:o.path||null, i:0, t:Math.random(), speed:o.speed||1.3, to:null, done:null,
                emoji:o.emoji||null, said:2+Math.random()*6, hop:0, watch:o.watch!==false, tall:2.35 };
    if(window.AVATAR) AVATAR.load(char).then(m=>{ if(g.parent){ a.model = m; g.add(m); } }).catch(()=>{});
    if(o.umbrella){ const u = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.35, 10, 1, true), std(o.umbrella, 0.4));
      u.position.y = 2.25; g.add(u); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.8), std(0x333333)); st.position.y = 1.85; g.add(st); a.tall = 2.7; }
    a.walkTo = (tx, tz, done)=>{ a.path = null; a.to = [tx, tz]; a.done = done||null; };
    a.tick = dt=>{
      let moving = false;
      if(a.to){
        const dx = a.to[0]-g.position.x, dz = a.to[1]-g.position.z, d = Math.hypot(dx, dz);
        if(d < 0.08){ a.to = null; const cb = a.done; a.done = null; if(cb) cb(); }
        else { const s = Math.min(d, 1.7*dt); g.position.x += dx/d*s; g.position.z += dz/d*s; g.rotation.y = Math.atan2(dx, dz); moving = true; }
      } else if(a.path && a.path.length > 1){
        const p0 = a.path[a.i], p1 = a.path[(a.i+1)%a.path.length];
        const len = Math.hypot(p1[0]-p0[0], p1[1]-p0[1]) || 1;
        a.t += a.speed*dt/len;
        if(a.t >= 1){ a.t = 0; a.i = (a.i+1)%a.path.length; }
        g.position.x = p0[0] + (p1[0]-p0[0])*a.t; g.position.z = p0[1] + (p1[1]-p0[1])*a.t;
        g.rotation.y = Math.atan2(p1[0]-p0[0], p1[1]-p0[1]); moving = true;
      } else if(a.watch){
        const dx = G.pos.x-g.position.x, dz = G.pos.z-g.position.z;
        if(dx*dx + dz*dz < 36){ const want = Math.atan2(dx, dz), d = Math.atan2(Math.sin(want-g.rotation.y), Math.cos(want-g.rotation.y)); g.rotation.y += d*Math.min(1, dt*4); }
      }
      if(a.hop > 0){ a.hop -= dt; g.position.y = Math.abs(Math.sin(a.hop*11))*0.4; } else g.position.y = 0;
      if(a.model) AVATAR.animate(a.model, dt, moving ? 'walk' : 'idle');
      if(a.emoji){ a.said -= dt;
        if(a.said <= 0 && Math.hypot(G.pos.x-g.position.x, G.pos.z-g.position.z) < 7){
          a.said = 7 + Math.random()*6; bubble(()=>V(g.position.x, a.tall, g.position.z), a.emoji[Math.floor(Math.random()*a.emoji.length)], 2.2, '#8fd3ff'); } }
    };
    actors.push(a);
    return a;
  }

  /* ------------------------------------------------------------- motion
     A tween runs a function from 0 to 1 over a time; fx are particles
     (smoke, sparks, confetti) that live a little and fall or rise. */
  const ease = t => t<0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
  function tween(d, f, done){ const t = { t:0, d, f, done }; tweens.push(t); f(0); return t; }
  const arc = (a, b, k, hgt) => V(a.x + (b.x-a.x)*k, a.y + (b.y-a.y)*k + Math.sin(k*Math.PI)*(hgt||0), a.z + (b.z-a.z)*k);
  const bitGeo = new THREE.BoxGeometry(1,1,1), ballGeo = new THREE.SphereGeometry(1, 8, 6);
  function particle(pos, o){
    const m = new THREE.Mesh(o.ball ? ballGeo : bitGeo, new THREE.MeshBasicMaterial({ color:o.color, transparent:true, opacity:o.op||1, depthWrite:false }));
    m.position.copy(pos); m.scale.setScalar(o.size||0.05); group.add(m);
    fx.push({ m, v:o.v || V(0,0,0), life:o.life||1, max:o.life||1, grav:o.grav||0, grow:o.grow||0, op:o.op||1, size:o.size||0.05 });
  }
  function smoke(pos, dark){ particle(pos, { ball:true, color: dark ? 0x3a3a40 : 0x9a9aa8, op:0.55, size:0.05, grow:0.12, life:1.4,
    v:V((Math.random()-0.5)*0.15, 0.45, (Math.random()-0.5)*0.15) }); }
  function sparks(pos, col, n){ for(let i=0;i<(n||12);i++) particle(pos, { color:col||0xffc060, size:0.025, life:0.5, grav:9,
    v:V((Math.random()-0.5)*3, 1+Math.random()*2.5, (Math.random()-0.5)*3) }); }
  function confetti(pos, n){ const cols = [0xff3fd0,0x27e8ff,0xffd23d,0x3ddc84,0xff8a3d];
    for(let i=0;i<(n||40);i++) particle(pos, { color:cols[i%5], size:0.06, life:1.6, grav:5,
      v:V((Math.random()-0.5)*4, 3+Math.random()*3, (Math.random()-0.5)*4) }); }
  function tickMotion(dt){
    // a tween that finishes often starts the next one: those land in the fresh list
    const run = tweens; tweens = [];
    const keep = run.filter(t=>{ t.t += dt/t.d; const k = Math.min(1, t.t); t.f(k);
      if(k >= 1){ if(t.done) t.done(); return false; } return true; });
    tweens = keep.concat(tweens);
    fx = fx.filter(p=>{ p.life -= dt; p.v.y -= p.grav*dt; p.m.position.addScaledVector(p.v, dt);
      if(p.grow) p.m.scale.setScalar(p.size + (p.max-p.life)*p.grow);
      p.m.material.opacity = p.op * Math.min(1, p.life/p.max*1.5);
      if(p.life <= 0){ group.remove(p.m); p.m.material.dispose(); return false; } return true; });
  }

  /* ------------------------------------------------------------ beacon
     Where to go is a light standing on the place: a beam you can see over
     the rooftops and a turning diamond at the height of the thing. */
  let beacon = null;
  function makeBeacon(){
    const b = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 40, 16, 1, true),
      new THREE.MeshBasicMaterial({ color:0xffd23d, transparent:true, opacity:0.2, depthWrite:false, blending:THREE.AdditiveBlending, fog:false, side:THREE.DoubleSide }));
    beam.position.y = 20; b.add(beam);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color:0xffd23d, fog:false }));
    b.add(gem);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), new THREE.MeshBasicMaterial({ color:0xffd23d, transparent:true, opacity:0.6, side:THREE.DoubleSide, depthWrite:false }));
    ring.rotation.x = -Math.PI/2; ring.position.y = 0.04; b.add(ring);
    b.userData = { beam, gem, ring }; b.visible = false; beacon = b;
    group.add(b);
  }
  function tickBeacon(){
    const t = mode || fighting ? null : goalSpot();
    if(!beacon) return;
    beacon.visible = !!t;
    if(!t) return;
    const u = beacon.userData;
    beacon.position.set(t[0], 0, t[1]);
    u.gem.position.y = (t[2]||2.2) + Math.sin(clock*3)*0.12; u.gem.rotation.y = clock*2;
    const s = 1 + 0.15*Math.sin(clock*4); u.ring.scale.set(s, s, s);
    u.beam.visible = scene!=='bedroom';       // indoors the ring and the gem are enough
  }

  /* ============================================================ BEDROOM
     Ren's room at 2 a.m.: the desk with Mrs. Oda's delivery bot on it,
     smoking. Everything you can use does something you can watch. */
  let dbot = null, bedDoor = null;
  function deliveryBot(){
    const g = new THREE.Group();
    // an open tray, so with the lid off you can see what is inside it
    const shell = std(0xeae4d6, 0.45), body = new THREE.Group(); g.add(body);
    [[0.5,0.03,0.6, 0,0.095,0], [0.5,0.24,0.03, 0,0.2,0.285], [0.5,0.24,0.03, 0,0.2,-0.285], [0.03,0.24,0.6, 0.235,0.2,0], [0.03,0.24,0.6, -0.235,0.2,0]]
      .forEach(([w,h,d,x,y,z])=>{ const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), shell); m.position.set(x,y,z); body.add(m); });
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.2), std(0x2a8a4a, 0.5)); board.position.set(0.08, 0.12, -0.1); body.add(board);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.06), std(0x222222, 0.4)); chip.position.set(0.08, 0.14, -0.1); body.add(chip);
    const batt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.16), std(0x3a6ad8, 0.4)); batt.position.set(0.1, 0.15, 0.14); body.add(batt);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.05, 0.61), std(0xff8a3d, 0.5)); stripe.position.y = 0.14; g.add(stripe);
    const lid = new THREE.Group(); lid.position.set(0, 0.33, 0); g.add(lid);
    const lidM = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.035, 0.62), std(0xff8a3d, 0.45)); lid.add(lidM);
    const screws = [];
    [[-0.21,-0.26],[0.21,-0.26],[-0.21,0.26],[0.21,0.26]].forEach(([x,z])=>{
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 8), glowM(0xd8e4ff, 0.5)); s.position.set(x, 0.03, z); lid.add(s);
      s.userData.home = s.position.clone(); screws.push(s); });
    const wheels = [];
    [-1,1].forEach(sx=>{ const w = new THREE.Group(); w.position.set(sx*0.29, 0.1, 0.08);
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16), std(0x222226, 0.8)); tyre.rotation.z = Math.PI/2; w.add(tyre);
      const hub = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.03, 0.15), std(0xffd23d, 0.4)); w.add(hub);
      w.userData.tyre = tyre; w.userData.hub = hub; g.add(w); wheels.push(w); });
    const caster = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std(0x333333)); caster.position.set(0, 0.05, -0.22); g.add(caster);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), new THREE.MeshStandardMaterial({ color:0x2a2420, emissive:0xff3a10, emissiveIntensity:0.6, roughness:0.9 }));
    motor.rotation.z = Math.PI/2; motor.position.set(-0.15, 0.17, 0.08); g.add(motor);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.02), glowM(0xff3040, 1.6)); eye.position.set(0, 0.24, 0.31); g.add(eye);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4), std(0x444444)); mast.position.set(0.18, 0.55, -0.22); g.add(mast);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.09), new THREE.MeshStandardMaterial({ color:0xff3fd0, emissive:0xff3fd0, emissiveIntensity:0.6, side:THREE.DoubleSide }));
    flag.position.set(0.25, 0.7, -0.22); g.add(flag);
    g.userData = { body, lid, screws, wheels, motor, eye, flag };
    return g;
  }
  function bedroom(at){
    const W = 10, D = 8, H = 3.2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0x8a6446, 0.7)); floor.rotation.x = -Math.PI/2; group.add(floor);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), std(0x3a5a9a, 0.9)); rug.rotation.x = -Math.PI/2; rug.position.set(0.8, 0.01, 0.6); group.add(rug);
    walls(W, D, H, std(0x5d6a8a, 0.85));
    flat(box(W, 0.2, D, std(0x4e5670, 0.9), 0, H+0.1, 0));
    G.ceiling = ()=>H;
    light(0xffc890, 12, 8, -2.1, 1.85, -3.1);     // the desk lamp
    light(0xff5ab4, 10, 9, 4.3, 1.9, 0);          // the neon outside the window
    // a lamp you can see: arm and shade on the desk
    box(0.05, 0.9, 0.05, std(0x333333), -2.4, 1.5, -3.5); const shade = box(0.35, 0.2, 0.35, glowM(0xffc890, 1.1), -2.2, 2.0, -3.3);
    shade.userData.flat = true;
    // the window: a neon city that flickers
    const win = sign(['さんふらん  SANFRAN', '▮▮ ▮ ▮▮▮  ▮▮'], 2.8, 1.6, W/2-0.14, 1.8, 0, -Math.PI/2, { bg:'#241050', fg:'#ff5ab4', glow:'#ff5ab4', font:'bold 34px' });
    actors.push({ tick(){ const k = 0.85 + 0.15*Math.sin(clock*7)*Math.sin(clock*2.3); win.material.color.setScalar(k); } });
    box(0.1, 1.9, 0.1, std(0x222222), W/2-0.12, 1.8, 0);
    // bed, with the mattress on its own so it can lift
    box(2, 0.35, 3.6, std(0x6a4a34, 0.7), -W/2+1.1, 0.175, -D/2+2, true);
    const mattress = new THREE.Group(); mattress.position.set(-W/2+1.1, 0.35, -D/2+2); group.add(mattress);
    const mat1 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 3.5), std(0x4a6ab8, 0.9)); mat1.position.y = 0.11; mattress.add(mat1);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.6), std(0xeeeeee, 0.9)); pillow.position.set(0, 0.3, -1.3); mattress.add(pillow);
    // desk and the delivery bot on it
    box(3, 0.1, 1.2, std(0x9a6a48, 0.55), -1.5, 1.0, -D/2+0.8, true);
    [-2.8,-0.2].forEach(x=>box(0.1, 1, 1.1, std(0x6a4a34), x, 0.5, -D/2+0.8));
    const screen = codeScreen(); screen.position.set(-2.2, 1.5, -D/2+0.35); group.add(screen);
    if(['call','repair'].indexOf(S.step) >= 0){
      dbot = deliveryBot(); dbot.position.set(-0.8, 1.05, -D/2+0.8); dbot.rotation.y = Math.PI; group.add(dbot);
      rep = null;
      actors.push({ tick(dt){ if(!dbot || !dbot.userData.burnt) return; dbot.userData.smokeT = (dbot.userData.smokeT||0) - dt;
        const m = dbot.userData.motor; m.material.emissiveIntensity = 0.3 + 0.5*Math.abs(Math.sin(clock*5));
        if(dbot.userData.smokeT <= 0){ dbot.userData.smokeT = 0.5; const p = V(); m.getWorldPosition(p); p.y += 0.1; smoke(p, true); } } });
      dbot.userData.burnt = true;
    } else dbot = null;
    spots.bot = [-0.8, -D/2+0.8, 1.9];
    // shelves of broken robots, the printer, the toolbox, posters
    box(0.4, 2.2, 2.6, std(0x5a5a6a), W/2-0.3, 1.1, -D/2+1.6, true);
    for(let i=0;i<3;i++){ const r = SFBOTS.model(SFBOTS.stats({ frame:['frame_light','frame_balanced','frame_heavy'][i] }), 0.25); r.position.set(W/2-0.3, 0.6+i*0.7, -D/2+1.6); r.rotation.y = -Math.PI/2; group.add(r); }
    const printer = box(0.9, 0.9, 0.9, std(0x7a8496, 0.5), 1.8, 0.45, -D/2+0.6, true);
    const bed3d = box(0.6, 0.05, 0.6, glowM(0xff8a3d, 0.5), 1.8, 0.95, -D/2+0.6);
    const head3d = box(0.12, 0.08, 0.12, std(0xdddddd, 0.3, 0.6), 1.8, 1.3, -D/2+0.6);
    const tool = box(0.8, 0.4, 0.4, std(0xc82a24, 0.5), 3.2, 0.2, -D/2+0.4, true);
    const toolLid = new THREE.Group(); toolLid.position.set(3.2, 0.4, -D/2+0.2); group.add(toolLid);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, 0.42), std(0xd83a30, 0.5)); tl.position.z = 0.2; toolLid.add(tl);
    sign(['ROBO', 'RUMBLE', '2031'], 1, 1.4, -W/2+0.16, 1.9, 1.5, Math.PI/2, { bg:'#2a0a1a', fg:'#ffd23d', font:'bold 60px' });
    sign(['SFIT', 'OPEN DAY'], 1, 1.4, 0.5, 2, -D/2+0.16, 0, { bg:'#0a1a2a', fg:'#8fd3ff', font:'bold 60px' });
    box(1.2, 2.1, 0.5, std(0x6a5a7a, 0.8), -W/2+0.4, 1.05, D/2-1.5, true);   // the closet
    const door = bedDoor = new THREE.Group(); door.position.set(-0.45, 0, D/2-0.1); group.add(door);
    const dm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.08), std(0x8a5a3a, 0.6)); dm.position.set(0.45, 1.05, 0); door.add(dm);
    const doorLight = box(0.12, 0.12, 0.05, glowM(0xff3040, 2), 0.6, 2.3, D/2-0.16);
    spots.door = [0, D/2-0.6, 2.4];

    // what you can use
    thing(-0.8, -D/2+1.6, 'Fix', ()=>startRepair(), { when:()=>dbot && (S.step==='repair' || S.step==='call'), icon:'🔧' });
    thing(-W/2+1.2, -D/2+2.2, 'Look under', ()=>{
      S.found.underbed = true; save();
      tween(0.5, k=>{ mattress.position.y = 0.35 + Math.sin(k*Math.PI)*0.45; mattress.rotation.z = Math.sin(k*Math.PI)*0.25; });
      const from = V(-W/2+1.2, 0.4, -D/2+2.2);
      setTimeout(()=>{ collect('energycell', 1, from); setTimeout(()=>collect('invite', 1, from), 250); rxp(40, from); talk('bed'); }, 300);
    }, { r:1.9, when:()=>!S.found.underbed, icon:'🛏' });
    thing(3.2, -D/2+1.0, 'Open', ()=>{
      S.found.toolbox = true; save();
      tween(0.4, k=>{ toolLid.rotation.x = -k*1.6; });
      const from = V(3.2, 0.6, -D/2+0.5);
      setTimeout(()=>{ collect('copper', 2, from); setTimeout(()=>collect('joint', 1, from), 200); rxp(15, from); }, 350);
    }, { when:()=>!S.found.toolbox, icon:'🧰' });
    thing(1.8, -D/2+1.3, 'Print', ()=>{
      S.found.printer = true; save();
      tween(1.6, k=>{ head3d.position.x = 1.8 + Math.sin(k*Math.PI*8)*0.22; head3d.position.z = -D/2+0.6 + Math.cos(k*Math.PI*6)*0.2;
        bed3d.material.emissiveIntensity = 0.5 + k*1.5; }, ()=>{
        const p = V(1.8, 1.0, -D/2+0.6); sparks(p, 0xff8a3d, 10); collect('wheel', 1, p); rxp(10, p); bed3d.material.emissiveIntensity = 0.5; });
    }, { when:()=>!S.found.printer, icon:'🖨' });
    thing(0, D/2-0.9, 'Go out', ()=>{
      if(S.step==='call' || S.step==='repair'){ doorLight.material.emissiveIntensity = 5; setTimeout(()=>doorLight.material.emissiveIntensity = 2, 250); talk('doorShut'); return; }
      tween(0.3, k=>{ door.rotation.y = -k*1.3; });
      if(S.step==='free'){ go('street'); streetIntro = true; }
      setTimeout(()=>travel('street', 'home'), 200);
    }, { icon:'🚪' });
    actors.push({ tick(){ const open = !(S.step==='call' || S.step==='repair'); const c = open ? 0x3ddc84 : 0xff3040;
      if(doorLight.material.color.getHex()!==c){ doorLight.material.color.setHex(c); doorLight.material.emissive.setHex(c); } } });
    if(at==='door') spawn(0, D/2-1.4, 0); else spawn(1.5, 1.2, Math.PI*0.9);
  }
  /* The computer on the desk: somebody's code scrolling past. */
  function codeScreen(){
    const c = document.createElement('canvas'); c.width = 256; c.height = 144;
    const x = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.68), new THREE.MeshBasicMaterial({ map:tex }));
    const rows = ['motor.l  ▮▮▮▮▮▯▯ 91°C', 'if temp > 85:', '   throttle(0.6)', 'align += 1', 'test()', 'veer: LEFT', 'BOT NIGHT ?', 'while True:', '   drive()', '0x3F 0xA2 0x19'];
    let t = 0, off = 0;
    const draw = ()=>{ x.fillStyle = '#081410'; x.fillRect(0,0,256,144); x.font = '15px '+uiFont();
      for(let i=0;i<8;i++){ const r = rows[(i+off)%rows.length]; x.fillStyle = r.indexOf('°')>0 || r.indexOf('LEFT')>0 ? '#ff8a3d' : '#3ddc84'; x.fillText(r, 10, 18+i*17); }
      tex.needsUpdate = true; };
    draw();
    actors.push({ tick(dt){ t += dt; if(t > 0.6){ t = 0; off++; draw(); } } });
    return m;
  }

  /* ------------------------------------------------ the repair, by hand
     BUILD → TEST → ADJUST, without a word of it on the screen:
       screws  — E four times, and four screws spin out;
       yank    — E, and the smoking motor comes out;
       pick    — three parts float in front of you: one spins, one only
                 swings back and forth, one smokes. Put the wrong one in
                 and the bot shows you why;
       test    — the bot drives across the floor and leaves its tracks.
                 It veers. ← → turns the wheels, E runs it again, and
                 every run's tracks stay on the floor to compare. */
  let rep = null;
  const DESK = V(-0.8, 1.05, -3.2);
  const START = V(0, 0, -1.8), PAD = V(0, 0, 2.8);
  function startRepair(){
    if(!dbot || mode) return;
    if(!rep) rep = { stage:'screws', out:0, align:0, target:(Math.random()<0.5?-1:1)*(3+Math.floor(Math.random()*4)), runs:0, sel:0, cands:null, lock:false, trails:[] };
    enterMode({ name:'repair', key:repairKey, tick:repairTick, exit:()=>{ if(window.AVATAR) AVATAR.attach(); } });
    if(window.AVATAR) AVATAR.detach();
    if(rep.stage==='test') camTest(); else camDesk();
    if(rep.stage==='pick' && !rep.cands) makeCands();
    repairKeys();
  }
  const camDesk = () => camTo(V(-0.8, 1.9, -2.05), V(-0.8, 1.15, -3.2));
  const camTest = () => camTo(V(1.1, 2.9, -3.55), V(0, 0, 1.0));
  function repairKeys(){
    const R = rep; if(!R) return;
    if(R.stage==='screws') keys([['E','🪛 '+'●'.repeat(4-R.out)+'○'.repeat(R.out)], ['ESC','✕']]);
    else if(R.stage==='yank') keys([['E','✊'], ['ESC','✕']]);
    else if(R.stage==='pick') keys([['←',''],['→','👆'],['E','⚙'], ['ESC','✕']]);
    else if(R.stage==='test') keys([['←',''],['→','🛞'],['E','▶'], ['ESC','✕']], 0, gauge());
  }
  /* the wheels' toe, drawn as a needle */
  function gauge(){ return `<span class="sf-gauge"><i style="transform:rotate(${rep.align*9}deg)"></i></span>`; }
  function repairKey(e){
    const R = rep; if(!R) return true;
    if(e.code==='Escape'){ if(!R.lock) exitMode(); return true; }
    if(R.lock) return true;
    const left = e.code==='ArrowLeft' || e.code==='KeyA', right = e.code==='ArrowRight' || e.code==='KeyD', use = e.code==='KeyE' || e.code==='Space' || e.code==='Enter';
    const B = dbot.userData;
    if(R.stage==='screws' && use){
      const s = B.screws[R.out++]; const from = s.position.clone(), to = V(0.5 + from.x*0.35, -0.31, from.z*0.6);
      tween(0.5, k=>{ s.rotation.y = k*18; s.position.copy(k < 0.5 ? V(from.x, from.y + k*0.3, from.z) : arc(V(from.x, from.y+0.15, from.z), to, (k-0.5)*2, 0.15)); });
      const w = V(); s.getWorldPosition(w); sparks(w, 0xd8e4ff, 4);
      if(R.out >= 4){ R.lock = true;
        setTimeout(()=>{ const a = B.lid.position.clone();
          tween(0.6, k=>{ B.lid.position.copy(arc(a, V(0.95, 0.02, 0), ease(k), 0.3)); B.lid.rotation.z = -k*0.12; }, ()=>{ R.stage = 'yank'; R.lock = false; repairKeys(); }); }, 450); }
      repairKeys(); return true;
    }
    if(R.stage==='yank' && use){
      R.lock = true; B.burnt = false;
      const m = B.motor, a = m.position.clone();
      tween(0.6, k=>{ m.position.copy(arc(a, V(1.4, 0.05, 0.05), ease(k), 0.35)); m.rotation.x = k*3; },
        ()=>{ group.attach(m);        // it stays on the desk when the bot goes to the floor
          const p = V(); m.getWorldPosition(p); for(let i=0;i<3;i++) smoke(p, true); give('motor_burnt'); rxp(10, p);
          R.stage = 'pick'; R.lock = false; makeCands(); repairKeys(); });
      return true;
    }
    if(R.stage==='pick'){
      if(left || right){ R.sel = (R.sel + (right ? 1 : 2)) % 3; return true; }
      if(use){ tryPart(R.cands[R.sel]); return true; }
    }
    if(R.stage==='test'){
      if(left || right){ R.align = Math.max(-8, Math.min(8, R.align + (right ? 1 : -1)));
        B.wheels.forEach(w=>w.rotation.y = -R.align*0.07); repairKeys(); return true; }
      if(use){ testRun(); return true; }
    }
    return true;
  }
  /* Three parts in a row in front of the bot. Each shows what it does:
     the motor spins, the servo only swings to an angle and back, the
     burnt one smokes. */
  function makeCands(){
    const R = rep, kinds = ['motor','servo','burnt'].sort(()=>Math.random()-0.5);
    R.cands = kinds.map((kind, i)=>{
      const g = new THREE.Group(); g.position.set(DESK.x - 0.45 + i*0.45, 1.6, -2.62); group.add(g);
      if(kind==='servo'){
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.06), std(0x2a6ad8, 0.4)); g.add(b);
        const horn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.13), std(0xffffff, 0.3)); horn.position.set(0, 0.045, 0); g.add(horn);
        g.userData.spin = horn; g.userData.servo = true;
      } else {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 14), kind==='burnt' ? new THREE.MeshStandardMaterial({ color:0x2a2420, emissive:0xff3a10, emissiveIntensity:0.3, roughness:0.9 }) : std(0xc0c8d4, 0.3, 0.8));
        c.rotation.z = Math.PI/2; g.add(c);
        if(kind==='motor'){ const band = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 14), std(0xd8843a, 0.4, 0.8)); band.rotation.z = Math.PI/2; g.add(band); }
        const shaft = new THREE.Group(); shaft.position.x = 0.075; g.add(shaft);
        const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05), std(0xeeeeee, 0.2, 0.9)); sh.rotation.z = Math.PI/2; shaft.add(sh);
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.012), glowM(kind==='motor' ? 0x3ddc84 : 0x552222, 1)); fin.position.x = 0.02; shaft.add(fin);
        g.userData.spin = kind==='motor' ? shaft : null;
      }
      g.userData.kind = kind; g.userData.home = g.position.clone();
      return g;
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 28), new THREE.MeshBasicMaterial({ color:0x27e8ff }));
    ring.rotation.x = Math.PI/2; group.add(ring); R.ring = ring;
  }
  function tryPart(c){
    const R = rep, B = dbot.userData; R.lock = true;
    const slot = V(); dbot.localToWorld(slot.set(-0.15, 0.17, 0.08));
    const home = c.userData.home.clone();
    tween(0.4, k=>c.position.copy(arc(home, slot, ease(k), 0.12)), ()=>{
      if(c.userData.kind==='motor'){
        take('motor_micro'); rxp(20, slot); pop('✔', slot, '#3ddc84', true); sparks(slot, 0x3ddc84, 14);
        c.userData.spin = null; dbot.attach(c);   // it is the bot's motor now, and goes where the bot goes
        B.eye.material.color.setHex(0x3ddc84); B.eye.material.emissive.setHex(0x3ddc84);
        R.cands.forEach(o=>{ if(o!==c) tween(0.3, k=>o.scale.setScalar(1-k), ()=>group.remove(o)); });
        group.remove(R.ring); R.ring = null;
        // the lid goes back on and the screws spin home
        const a = B.lid.position.clone();
        tween(0.5, k=>{ B.lid.position.copy(arc(a, V(0, 0.33, 0), ease(k), 0.2)); B.lid.rotation.z = -0.12*(1-k); }, ()=>{
          B.screws.forEach((s, i)=>{ const f = s.position.clone(); tween(0.35 + i*0.08, k=>{ s.position.copy(arc(f, s.userData.home, ease(k), 0.1)); s.rotation.y = -k*14; }); });
          setTimeout(()=>{ R.stage = 'test'; R.lock = false; R.cands = null; hopToFloor(); }, 800);
        });
      } else {
        pop('✖', slot, '#ff3040', true);
        B.eye.material.emissiveIntensity = 5;
        if(c.userData.kind==='servo'){ const w = B.wheels[0].userData.tyre;
          tween(0.8, k=>{ w.rotation.x = Math.sin(k*Math.PI*4)*0.5; c.userData.spin.rotation.y = Math.sin(k*Math.PI*4)*1.2; }); }
        else { sparks(slot, 0xffc060, 18); for(let i=0;i<4;i++) smoke(slot, true); }
        setTimeout(()=>{ B.eye.material.emissiveIntensity = 1.6;
          tween(0.4, k=>c.position.copy(arc(slot, home, ease(k), 0.12)), ()=>{ R.lock = false; }); }, 850);
      }
    });
  }
  function hopToFloor(){
    const R = rep; R.lock = true;
    camTest();
    const a = dbot.position.clone();
    tween(0.9, k=>{ dbot.position.copy(arc(a, START, ease(k), 0.6)); dbot.rotation.y = Math.PI*(1-k); }, ()=>{
      dbot.rotation.y = 0; R.lock = false; repairKeys();
      if(!R.pad){ const pad = new THREE.Group(); pad.position.copy(PAD); group.add(pad);
        const r = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.5, 32), new THREE.MeshBasicMaterial({ color:0xffd23d, side:THREE.DoubleSide }));
        r.rotation.x = -Math.PI/2; r.position.y = 0.02; pad.add(r);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8), std(0xdddddd)); pole.position.set(0.5, 0.4, 0); pad.add(pole);
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), new THREE.MeshBasicMaterial({ map:textTex(['🏁'], { w:128, h:96, bg:'#ffffff', font:'64px' }), side:THREE.DoubleSide }));
        fl.position.set(0.64, 0.7, 0); pad.add(fl); R.pad = pad; R.padRing = r; }
    });
  }
  /* The run: a steady speed and a turn that is how far the wheels are
     out. Off is alignment minus the fault; zero drives dead straight. */
  const TRAIL = [0x27e8ff, 0xff3fd0, 0xffd23d, 0x3ddc84, 0xff8a3d, 0xc86bff];
  let drive = null;
  function testRun(){
    const R = rep; R.lock = true;
    R.trails.forEach(t=>t.forEach(d=>d.material.opacity = 0.3));
    const dots = []; R.trails.push(dots);
    drive = { s:0, th:0, x:START.x, z:START.z, off:R.align - R.target, col:TRAIL[R.runs++ % TRAIL.length], dots, next:0 };
    dbot.position.copy(START); dbot.rotation.y = 0;
  }
  const dotGeo = new THREE.CircleGeometry(0.035, 10);
  function repairTick(dt){
    const R = rep; if(!R) return;
    if(R.ring && R.cands){ const c = R.cands[R.sel]; R.ring.position.set(c.position.x, c.position.y - 0.09, c.position.z); R.ring.rotation.z += dt*2; }
    if(R.cands) R.cands.forEach(c=>{ const s = c.userData.spin; if(!s) { if(c.userData.kind==='burnt' && Math.random() < dt*1.2) smoke(c.position, true); return; }
      if(c.userData.servo){ if(!R.lock) s.rotation.y = Math.sin(clock*2)*1.3; } else s.rotation.x += dt*30; });
    if(R.padRing) R.padRing.material.color.setHex(drive || R.stage!=='test' ? 0xffd23d : (Math.floor(clock*3)%2 ? 0xffd23d : 0xffe890));
    if(drive){
      const d = drive, step = 1.3*dt;
      d.s += step; d.th += -d.off*0.07*step;
      d.x += Math.sin(d.th)*step; d.z += Math.cos(d.th)*step;
      dbot.position.set(d.x, 0, d.z); dbot.rotation.y = d.th;
      dbot.userData.wheels.forEach(w=>w.userData.tyre.rotation.x += step*10);
      if(d.s >= d.next){ d.next += 0.1;
        const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color:d.col, transparent:true, opacity:0.95, depthWrite:false }));
        dot.rotation.x = -Math.PI/2; dot.position.set(d.x, 0.015, d.z); group.add(dot); d.dots.push(dot); }
      const out = Math.abs(d.x) > 4.5 || d.z > 3.7 || d.z < -3.7;
      if(d.s >= 4.6 || out){
        drive = null;
        const hit = Math.hypot(d.x-PAD.x, d.z-PAD.z) < 0.5;
        if(hit) return repairDone();
        pop('✖', V(d.x, 0.6, d.z), '#ff3040', true);
        setTimeout(()=>{ const a = dbot.position.clone(), th = dbot.rotation.y;
          tween(0.7, k=>{ dbot.position.copy(arc(a, START, ease(k), 0.4)); dbot.rotation.y = th*(1-k); }, ()=>{ R.lock = false; repairKeys(); }); }, 650);
      }
    }
  }
  function repairDone(){
    const R = rep;
    R.padRing.material.color.setHex(0x3ddc84);
    confetti(V(PAD.x, 0.3, PAD.z), 50);
    banner('✔', 1.2, 'ok');
    rxp(60, V(PAD.x, 1, PAD.z));
    give('motor_micro');
    // and off it goes to Mrs. Oda, out of the door
    setTimeout(()=>{
      const a = dbot.position.clone(), door = V(0, 0, 4.4);
      if(bedDoor) tween(0.4, k=>{ bedDoor.rotation.y = -k*1.3; });
      tween(1.6, k=>{ dbot.position.copy(a.clone().lerp(door, k)); dbot.userData.wheels.forEach(w=>w.userData.tyre.rotation.x += 0.3); }, ()=>{
        group.remove(dbot); dbot = null;
        if(bedDoor) tween(0.4, k=>{ bedDoor.rotation.y = -1.3*(1-k); });
        if(R.pad) group.remove(R.pad); R.trails.forEach(t=>t.forEach(d=>group.remove(d)));
        rep = null; exitMode(); go('free'); talk('fixed');
      });
    }, 900);
  }

  /* ============================================================= STREET */
  const L = 130;
  function street(at){
    const road = new THREE.Mesh(new THREE.PlaneGeometry(L, 9), std(0x3c3f4c, 0.3, 0.3)); road.rotation.x = -Math.PI/2; group.add(road);
    for(let x=-L/2; x<L/2; x+=6) box(3, 0.02, 0.2, glowM(0xffd23d, 0.6), x, 0.01, 0);
    [-1,1].forEach(s=>{ const sw = new THREE.Mesh(new THREE.PlaneGeometry(L, 4), std(0x6a6a7a, 0.55)); sw.rotation.x = -Math.PI/2; sw.position.set(0, 0.05, s*6.5); group.add(sw);
      box(L, 0.12, 0.25, std(0x8a8a96, 0.5), 0, 0.06, s*4.55); });
    G.ground = ()=>0;
    G.solids.push({ x1:-L/2-2, x2:-L/2, z1:-20, z2:20, y1:-1, y2:30 }, { x1:L/2, x2:L/2+2, z1:-20, z2:20, y1:-1, y2:30 });
    // buildings both sides: painted facades with glowing windows, neon, awnings
    const neon = ['ラーメン RAMEN','','24H ROBO PARTS','KARAOKE','カフェ CAFE','SFIT ← 3 km','PACHINKO','ドローン DRONES','NOODLES','HOTEL SAKURA'];
    const cols = ['#ff3fd0','#27e8ff','#ffd23d','#3ddc84','#ff8a3d','#c86bff'];
    const paints = ['#5a5f82','#6a5a7a','#4f6a7e','#6e6268','#5a6a72'];
    let k = 0;
    for(const side of [-1, 1]) for(let x=-L/2+6; x<L/2-4; x+=13){
      const h = 12 + ((x*7+side*13)%11+11)%11*2, w = 11, d = 8;
      const z = side*(8.5 + d/2);
      const f = facade(h, paints[k%paints.length]);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map:f.map, emissiveMap:f.glow, emissive:0xffffff, emissiveIntensity:0.8, roughness:0.8 }));
      wall.position.set(x, h/2, z); group.add(wall);
      G.solids.push({ x1:x-w/2, x2:x+w/2, z1:z-d/2, z2:z+d/2, y1:-1, y2:h });
      const txt = neon[k%neon.length], col = cols[k%cols.length]; k++;
      const door = side<0 && (Math.abs(x-(-L/2+8)) < 7 || Math.abs(x-(L/2-10)) < 7);   // home, Warehouse 17: their own signs
      if(txt && !door) sign([txt], 5, 1.1, x, 4.5, side*8.4, side>0 ? Math.PI : 0, { w:512, h:112, bg:null, fg:col, glow:col, font:'bold 64px' });
      if(!door) box(w-1, 0.1, 1.0, glowM(new THREE.Color(col).getHex(), 0.25), x, 3.7, side*(8.5-0.5));
    }
    // street lights: amber on one side, pink on the other
    for(let x=-L/2+10; x<L/2; x+=32){ light(0xffb070, 34, 24, x, 6, -5); light(0xff5ab4, 22, 18, x+16, 5, 5);
      box(0.15, 6, 0.15, std(0x333340), x, 3, -5.8); box(1.2, 0.15, 0.3, glowM(0xffe0b0, 2), x, 6, -5.4); }
    makeRain(2600, 60);
    // HOME — west end, north side
    const homeX = -L/2+8;
    sign(['⌂ HOME'], 2, 0.6, homeX, 3, -8.45, 0, { w:256, h:80, bg:'#101828', fg:'#8fd3ff', font:'bold 48px' });
    box(1.6, 2.6, 0.2, std(0x8a5a3a), homeX, 1.3, -8.4);
    spots.home = [homeX, -7.6, 2.8];
    thing(homeX, -7.3, 'Go home', ()=>travel('bedroom', 'door'), { icon:'⌂' });
    // BYTE BAZAAR — a glowing stair down, south side
    const bzX = 12;
    sign(['BYTE BAZAAR ↓'], 6, 1.3, bzX, 4.8, 8.4, Math.PI, { w:640, h:140, bg:null, fg:'#27e8ff', glow:'#27e8ff', font:'bold 72px' });
    box(3, 0.1, 2, glowM(0x27e8ff, 1.2), bzX, 0.06, 7.6);
    spots.bazaar = [bzX, 7.4, 2.8];
    thing(bzX, 7.2, 'Go down', ()=>{ if(S.step==='street') go('market'); travel('market'); }, { r:2.2, icon:'🛒' });
    // WAREHOUSE 17 — east end, with doors that slide
    const whX = L/2-10;
    sign(['WAREHOUSE 17'], 5, 1, whX, 5, -8.45, 0, { w:512, h:100, bg:'#1a1a1a', fg:'#dddddd', font:'bold 60px' });
    const dl = box(2, 3.4, 0.25, std(0x7a7a80, 0.5, 0.6), whX-1, 1.7, -8.4), dr = box(2, 3.4, 0.25, std(0x7a7a80, 0.5, 0.6), whX+1, 1.7, -8.4);
    const slot = box(0.8, 0.14, 0.05, glowM(0xff3040, 1.5), whX, 2.4, -8.26);
    spots.warehouse = [whX, -7.6, 3.2];
    thing(whX, -7.2, 'Knock', ()=>{
      const ready = ['fight1','titan','done'].indexOf(S.step)>=0 || (S.step==='market' && builtRobot());
      if(!ready){ slot.material.emissiveIntensity = 5; setTimeout(()=>slot.material.emissiveIntensity = 1.5, 400); talk('noBot'); return; }
      if(S.step==='market') go('fight1');
      slot.material.color.setHex(0x3ddc84); slot.material.emissive.setHex(0x3ddc84);
      tween(0.6, k=>{ dl.position.x = whX-1 - k*1.9; dr.position.x = whX+1 + k*1.9; }, ()=>travel('arena'));
    }, { r:2.2, icon:'✊' });
    // TRANSIT — a stop in the middle: fast travel
    sign(['🚊 TRANSIT'], 3, 0.7, -20, 3.2, 6.9, Math.PI, { w:512, h:120, bg:'#0a2a1a', fg:'#3ddc84', font:'bold 60px' });
    box(0.15, 3, 0.15, std(0x444450), -21.4, 1.5, 6.9); box(0.15, 3, 0.15, std(0x444450), -18.6, 1.5, 6.9);
    box(3, 0.08, 1.2, glowM(0x3ddc84, 0.5), -20, 3.05, 6.4);
    thing(-20, 6, 'Ride', ()=>panelTransit(), { r:2, icon:'🚊' });
    // the oden stand, and Daichi
    box(2.4, 1.1, 1, std(0xd8302a, 0.5), -40, 0.55, 6.2, true); box(2.6, 0.1, 1.4, glowM(0xffd23d, 0.7), -40, 2.4, 6.2);
    sign(['おでん ODEN'], 2.2, 0.5, -40, 2.7, 6.2, Math.PI, { w:400, h:100, bg:null, fg:'#fff', glow:'#ff8a3d', font:'bold 56px' });
    person('kofi', -40, 6.9, { face:Math.PI, emoji:['🍢','🔥','♨️'] });
    actors.push({ t:0, tick(dt){ this.t -= dt; if(this.t <= 0){ this.t = 0.5; smoke(V(-40 + (Math.random()-0.5)*1.5, 1.2, 6.2)); } } });
    if(['street','market','fight1','titan'].indexOf(S.step) >= 0){
      if(streetIntro){
        streetIntro = false;
        cast.daichi = person('theo', homeX+2, -6.2, { umbrella:0x27e8ff });
        setTimeout(()=>talk('street', ()=>{ if(cast.daichi) cast.daichi.walkTo(-40, 5.2, ()=>{ if(cast.daichi) cast.daichi.g.rotation.y = 0; }); }), 500);
      } else cast.daichi = person('theo', -40, 5.2, { umbrella:0x27e8ff, emoji:['🍢','😋','👀'] });
    }
    person('zuri', 26, -6, { face:0, emoji:['♪','♫','🎸'] });
    // people with umbrellas, who say things in pictures
    const walkers = [['nia',0xff5ab4,['☔','🔋❓']], ['sable',0x27e8ff,['🤖💥','📦']], ['kofi',0xffd23d,['🏫','🎓']],
                     ['theo',0x3ddc84,['🚗💫','😩']], ['zuri',0xc86bff,['🥊','🤖🤖']], ['nia',0xff8a3d,null]];
    walkers.forEach((w,i)=>{ const z = (i%2 ? 1 : -1)*(5.8 + (i%3)*0.4), x0 = -50 + i*18;
      person(w[0], x0, z, { path:[[x0, z],[x0 + (i%2?40:-40), z]], speed:1.3 + (i%3)*0.2, umbrella:w[1], emoji:w[2] }); });
    // traffic: cars and delivery bots
    for(let i=0;i<9;i++){
      const lane = i%2 ? 2 : -2, dir = i%2 ? 1 : -1, car = new THREE.Group();
      const col = [0xff3fd0,0x27e8ff,0xeeeeee,0x6a6a7a,0xffd23d][i%5];
      const b = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 1.9), std(col, 0.3, 0.5)); b.position.y = 0.75; car.add(b);
      const t = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.7), std(0x222233, 0.15, 0.8)); t.position.set(-0.2, 1.6, 0); car.add(t);
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 1.6), glowM(0xfff0c0, 2.5)); hl.position.set(2.02, 0.8, 0); car.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 1.6), glowM(0xff2020, 2)); tl.position.set(-2.02, 0.8, 0); car.add(tl);
      car.rotation.y = dir>0 ? 0 : Math.PI; group.add(car);
      const c = { g:car, x:-L/2 + i*15, lane, dir, sp:7 + (i%3)*3 };
      c.tick = dt=>{ c.x += c.dir*c.sp*dt; if(c.x > L/2+5) c.x = -L/2-5; if(c.x < -L/2-5) c.x = L/2+5; c.g.position.set(c.x, 0, c.lane); };
      actors.push(c);
    }
    // a police drone overhead
    const drone = new THREE.Group(); drone.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), std(0x444455)));
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.12), glowM(0xff2020, 3)); red.position.set(-0.3, 0.2, 0); drone.add(red);
    const blue = new THREE.Mesh(new THREE.SphereGeometry(0.12), glowM(0x2060ff, 3)); blue.position.set(0.3, 0.2, 0); drone.add(blue);
    group.add(drone);
    actors.push({ tick(){ const t = clock*0.15; drone.position.set(Math.sin(t)*50, 11 + Math.sin(clock)*0.5, Math.cos(t*1.3)*4);
      red.visible = Math.floor(clock*4)%2===0; blue.visible = !red.visible; } });
    // jobs: delivery bots stuck against walls. Hold E and they are fixed and away.
    [[-30, -1], [3, 1], [34, -1]].forEach(([x, side], i)=>stuckBot('job'+i, x, side));
    // things lying about worth picking up
    [['pk0','scrap',2,-52,5.6], ['pk1','copper',1,-8,-6.8], ['pk2','aluminium',1,20,6.4], ['pk3','silicon',1,40,-6.2], ['pk4','sensor',1,-26,-6], ['pk5','scrap',3,50,6.8]]
      .forEach(p=>pickup(p[0], p[1], p[2], p[3], p[4]));
    // where you come in
    // facing along the street, so the camera is behind you on the pavement and not in a shop
    const EAST = -Math.PI/2, WEST = Math.PI/2;
    if(at==='market') spawn(bzX, 5.6, EAST);
    else if(at==='arena') spawn(whX, -5.6, WEST);
    else if(at==='transit') spawn(-20, 4.8, EAST);
    else spawn(homeX, -5.6, EAST);
  }
  /* A facade: a painted wall with a grid of windows, and a second canvas
     with only the lit windows in it, so they glow whatever the light. */
  function facade(h, paint){
    const mk = () => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; return c; };
    const a = mk(), b = mk(), x = a.getContext('2d'), y = b.getContext('2d');
    x.fillStyle = paint; x.fillRect(0,0,64,128); y.fillStyle = '#000'; y.fillRect(0,0,64,128);
    for(let r=0;r<16;r++) for(let q=0;q<4;q++){ const lit = Math.random() < 0.5, px = 4+q*15, py = 4+r*8;
      x.fillStyle = '#2a2c3a'; x.fillRect(px-1, py-1, 12, 7);
      const c = lit ? (Math.random()<0.25 ? '#8fd3ff' : Math.random()<0.2 ? '#ff9ad8' : '#ffcf8a') : '#343648';
      x.fillStyle = c; x.fillRect(px, py, 10, 5);
      if(lit){ y.fillStyle = c; y.fillRect(px, py, 10, 5); } }
    const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, h/12); return t; };
    return { map:tex(a), glow:tex(b) };
  }
  function stuckBot(id, x, side){
    const b = deliveryBot(), U = b.userData; b.scale.setScalar(1.6);
    const wallZ = side*7.9, z0 = side*7.1;
    b.position.set(x, 0, z0); b.rotation.y = side>0 ? 0 : Math.PI; group.add(b);
    U.motor.material.emissiveIntensity = 0; U.lid.children[0].material.color.setHex([0x27e8ff,0xff3fd0,0x3ddc84][Math.abs(Math.round(x))%3]);
    const done = !!S.found[id];
    const bot = { t:Math.random(), fixed:done, x, dir:1 };
    const eye = c => { U.eye.material.color.setHex(c); U.eye.material.emissive.setHex(c); };
    eye(done ? 0x3ddc84 : 0xff3040);
    bot.tick = dt=>{
      if(!bot.fixed){
        // bump, bump, bump against the wall
        bot.t += dt*2.2; const k = (bot.t%1);
        b.position.z = z0 + side*(k < 0.5 ? k*2*0.5 : (1-k)*2*0.5);
        if(k > 0.48 && k < 0.52 && !bot.hit){ bot.hit = true; sparks(V(x, 0.5, wallZ - side*0.1), 0xffc060, 5); } else if(k > 0.6) bot.hit = false;
      } else {
        // off on its rounds along the pavement
        b.position.z += (side*5.6 - b.position.z)*Math.min(1, dt*2);
        bot.x += bot.dir*1.6*dt; if(Math.abs(bot.x - x) > 12) bot.dir *= -1;
        b.position.x = bot.x; b.rotation.y = bot.dir>0 ? Math.PI/2 : -Math.PI/2;
        U.wheels.forEach(w=>w.userData.tyre.rotation.x += dt*10);
      }
    };
    actors.push(bot);
    if(!done) thing(x, z0 - side*1.2, 'Hold to fix', ()=>{
      bot.fixed = true; S.found[id] = true; S.credits += 10; save(true);
      eye(0x3ddc84); const p = V(x, 1, z0); sparks(p, 0x3ddc84, 16); pop('✔', p, '#3ddc84', true); rxp(15, p); fly('¥', p);
      tween(0.4, k=>b.position.y = Math.sin(k*Math.PI)*0.5);
    }, { hold:1.1, when:()=>!bot.fixed, icon:'🔧' });
  }
  /* Something on the ground worth having: walk over it. */
  function pickup(id, item, n, x, z){
    if(S.found[id]) return;
    const g = new THREE.Group(); g.position.set(x, 0, z); group.add(g);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), glowM(0x27e8ff, 1.4)); gem.position.y = 0.6; g.add(gem);
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 24), new THREE.MeshBasicMaterial({ color:0x27e8ff, transparent:true, opacity:0.5, side:THREE.DoubleSide, depthWrite:false }));
    disc.rotation.x = -Math.PI/2; disc.position.y = 0.06; g.add(disc);
    pickups.push({ id, item, n, g, gem });
  }
  function tickPickups(){
    pickups = pickups.filter(p=>{
      p.gem.rotation.y = clock*2; p.gem.position.y = 0.6 + Math.sin(clock*3 + p.g.position.x)*0.1;
      if(Math.hypot(G.pos.x-p.g.position.x, G.pos.z-p.g.position.z) < 1.3){
        S.found[p.id] = true; collect(p.item, p.n, p.g.position.clone().setY(0.6)); group.remove(p.g); save(); return false; }
      return true; });
  }
  function panelTransit(){
    const stops = [['home','⌂'], ['market','🛒'], ['arena','🥊']];
    panel('🚊', '<div class="sf-big-btns">' + stops.map(s=>`<button data-a="go:${s[0]}">${s[1]}</button>`).join('') +
      `<button data-a="wano">🌏</button></div>`, act=>{
        if(act==='wano'){ closePanel(); leave(); return; }
        if(!act || !act.startsWith('go:')) return;
        closePanel();
        travel('street', act.slice(3));
      });
  }

  /* ============================================================= MARKET */
  const PRICE = { frame_light:40, frame_heavy:70, motor_sprint:45, motor_torque:55, power_liion:35, power_supercap:60,
                  wpn_hammer:40, wpn_spinner:45, wpn_flipper:40, ctl_gyro:50, ctl_aim:65, core_shield:80, plating:60 };
  const REPNEED = { plating:1 };
  function market(){
    const W = 34, D = 22, H = 5;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0x6a6070, 0.55, 0.1)); floor.rotation.x = -Math.PI/2; group.add(floor);
    walls(W, D, H, std(0x8a5a5a, 0.85)); flat(box(W, 0.3, D, std(0x5a4a5a, 0.9), 0, H+0.15, 0)); G.ceiling = ()=>H;
    // pipes and strings of lanterns
    for(let z=-D/2+3; z<D/2; z+=5) flat(box(W, 0.2, 0.2, std(0x8a7a70, 0.4, 0.6), 0, H-0.4, z));
    for(let x=-W/2+3; x<W/2; x+=3){ const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), glowM([0xff3fd0,0xffd23d,0x27e8ff][Math.abs(x)%3|0], 2)); l.position.set(x, H-0.9, Math.sin(x)*2); l.userData.flat = true; group.add(l); }
    light(0xff6ab4, 28, 22, -8, 4, 0); light(0x27e8ff, 28, 22, 8, 4, 0);
    // stalls
    const stalls = [
      [-11, -7, 'MAMA KIKU · PARTS', '#ffd23d', 'theo', 'kiku'],
      [0, -7, 'VOLT & BOLT', '#27e8ff', 'sable', null],
      [11, -7, 'CHROME DOC', '#3ddc84', 'kofi', 'doc'],
      [-11, 6, 'THE WHISPER', '#c86bff', 'zuri', 'whisper'],
      [11, 6, 'HACK SHACK', '#ff8a3d', 'nia', null]
    ];
    stalls.forEach(s=>{
      const f = s[1]<0 ? 1 : -1;
      box(6, 1.1, 1.6, std(0x9a6a4a, 0.6), s[0], 0.55, s[1] + f*0.2, true);
      box(6.4, 0.15, 2.4, glowM(new THREE.Color(s[3]).getHex(), 0.5), s[0], 3.1, s[1]);
      sign([s[2]], 5.6, 0.7, s[0], 3.6, s[1] + f*0.8, s[1]<0 ? 0 : Math.PI, { w:720, h:100, bg:'#0c0a10', fg:s[3], glow:s[3], font:'bold 54px' });
      for(let i=0;i<5;i++) box(0.4, 0.3, 0.4, std([0xb0b8c4,0xd8843a,0x5a5a6a][i%3], 0.4, 0.7), s[0]-2+i, 1.25, s[1] + f*0.2);
      const a = person(s[4], s[0], s[1] - f*0.9, { face: s[1]<0 ? 0 : Math.PI });
      if(s[5]) cast[s[5]] = a;
    });
    // Hack Shack solders all night
    actors.push({ t:0, tick(dt){ this.t -= dt; if(this.t <= 0){ this.t = 0.4 + Math.random()*0.6; sparks(V(11 + (Math.random()-0.5)*2, 1.45, 5.8), 0xffe090, 6); } } });
    thing(11, -5.2, 'Trade', ()=>{
      if(!has('motor_burnt')){ talk('doc'); return; }
      take('motor_burnt'); pop('🔥', head(), '#ff8a3d'); talk('docTrade');
      const p = V(11, 1.4, -7.4); setTimeout(()=>{ collect('copper', 3, p); rxp(10, p); }, 400);
    }, { r:2.4, icon:'🔧' });
    thing(-11, 4.2, 'Listen', ()=>whisper(), { r:2.4, icon:'👂' });
    thing(-11, -5.2, 'Shop', ()=>startBench(), { r:2.4, icon:'🛒' });
    // the build bench: the robot on a turntable under a work light
    box(4, 1, 1.6, std(0x8a7a6a, 0.6), 0, 0.5, 6.5, true); box(4.2, 0.1, 1.8, glowM(0x3ddc84, 0.4), 0, 1.02, 6.5);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 32), std(0x9aa0aa, 0.35, 0.7)); table.position.set(0, 1.1, 6.5); group.add(table);
    const lamp = new THREE.SpotLight(0xffffff, 40, 10, 0.6, 0.4, 1.5); lamp.position.set(0, 4.6, 5.2); lamp.target.position.set(0, 1, 6.5); group.add(lamp); group.add(lamp.target);
    sign(['🛠 BUILD BENCH'], 3, 0.6, 0, 2.9, 7.3, Math.PI, { w:512, h:100, bg:'#0a1a10', fg:'#3ddc84', font:'bold 52px' });
    turntable = { table, model:null, y:1.14 };
    autoFill();
    showRobot(benchBuild());
    actors.push({ tick(dt){ if(turntable && turntable.model) turntable.model.rotation.y += dt*0.6; } });
    spots.bench = [0, 6.5, 2.5];
    thing(0, 5.0, 'Build', ()=>startBench(), { r:2.2, icon:'🛠' });
    box(3, 0.1, 2, glowM(0x27e8ff, 1), -W/2+2.5, 0.06, 0);
    spots.stairs = [-W/2+2.5, 0, 2.6];
    thing(-W/2+2.5, 0, 'Up', ()=>travel('street', 'market'), { r:2.2, icon:'⬆' });
    // punters milling about
    person('nia', -6, 0, { path:[[-6,0],[6,0]], speed:1.1, emoji:['🤑','🥊','👑❓'] });
    person('kofi', 4, 3, { path:[[4,3],[-8,-2]], speed:0.9, emoji:['🔧','⚙'] });
    if(!S.found.bazaar){ S.found.bazaar = true; rxp(30, V(-W/2+4, 2.2, 0)); }
    spawn(-W/2+5, 0, -Math.PI/2);
  }
  /* THE WHISPER sells information, and information here is a picture: a
     hologram of the next opponent turning over the table, with the place
     to hit it lit up. */
  function whisper(){
    const foe = (S.step==='titan' || S.step==='done') ? 'titan' : 'bruiser';
    const F = SFBOTS.FOES[foe], m = SFBOTS.model(SFBOTS.stats(F.build), 0.7);
    const holo = new THREE.MeshBasicMaterial({ color:0x6fe0ff, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false });
    const hot = new THREE.MeshBasicMaterial({ color:0xff3040, transparent:true, opacity:0.9 });
    m.traverse(o=>{ if(o.isMesh) o.material = holo; });
    const U = m.userData;
    if(foe==='titan') U.wheels[0].traverse(o=>{ if(o.isMesh) o.material = hot; });
    else { const t = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.3, 24), hot); t.position.set(0, U.h*0.6 + 0.25, -U.l/2 - 0.08); t.rotation.y = Math.PI; m.add(t); }
    m.position.set(-11, 1.9, 5.3); group.add(m);
    tween(9, k=>{ m.rotation.y = k*Math.PI*4; hot.opacity = 0.5 + 0.5*Math.abs(Math.sin(k*40)); holo.opacity = k > 0.9 ? 0.5*(1-k)*10 : 0.5; }, ()=>group.remove(m));
    talk(foe==='titan' ? 'tipTitan' : 'tipBruiser');
    if(!S.talked['tip_'+foe]){ S.talked['tip_'+foe] = true; rxp(15, V(-11, 2, 5.7)); }
  }

  /* ------------------------------------------------------ the bench
     THE SHOP IS THE BENCH. ↑↓ picks a slot, ←→ swaps the part, and the
     robot on the turntable changes in front of you. A part you own goes
     straight on; one you do not shows its price, and E buys it. A part a
     skill has not unlocked yet shows a lock and the skill's icon. */
  let turntable = null;
  const BENCH = ['frame','motor','power','weapon','control','core','plating'];
  const builtRobot = () => SFBOTS.SLOTS.every(s=>S.robot[s] && has(S.robot[s]));
  const owned = (slot, id) => slot==='plating' ? (!id || has('plating')) : !!id && has(id);
  const options = slot => slot==='plating' ? [null, 'plating'] : SFBOTS.PARTS[slot].map(p=>p.id);
  function lockOf(id){
    if(!id) return null;
    const p = SFBOTS.find(id), req = p ? p.need : id==='plating' ? { mat:2 } : null;
    if(req) for(const k in req) if(attr(k) < req[k]) return ATTR_ICON[k] + req[k];
    if(REPNEED[id] && S.rep < REPNEED[id]) return '👑' + REPNEED[id];
    return null;
  }
  function benchBuild(over){
    const b = Object.assign({}, S.robot, { plating: !!S.robot.plating && has('plating') });
    if(over){ if(over.slot==='plating') b.plating = !!over.id; else b[over.slot] = over.id; }
    // a slot never filled is shown empty — except the frame, which there is always one of
    SFBOTS.SLOTS.forEach(s=>{ if(s!=='weapon' && !b[s]) b[s] = SFBOTS.PARTS[s].find(p=>has(p.id)) ? SFBOTS.PARTS[s].find(p=>has(p.id)).id : undefined; });
    return b;
  }
  function showRobot(build, bounce){
    if(!turntable) return;
    const ry = turntable.model ? turntable.model.rotation.y : 0;
    if(turntable.model) group.remove(turntable.model);
    const m = SFBOTS.model(SFBOTS.stats(build), 0.6); m.position.set(0, turntable.y, 6.5); m.rotation.y = ry; group.add(m);
    turntable.model = m;
    if(bounce){ tween(0.35, k=>m.scale.setScalar(0.85 + 0.15*Math.sin(k*Math.PI/2) + Math.sin(k*Math.PI)*0.08)); sparks(V(0, 1.6, 6.5), 0x8fd3ff, 8); }
  }
  let bench = null;
  function autoFill(){
    SFBOTS.SLOTS.forEach(s=>{ if(!S.robot[s] || !has(S.robot[s])){ const p = SFBOTS.PARTS[s].find(p=>has(p.id) && !lockOf(p.id)); if(p) S.robot[s] = p.id; } });
  }
  function startBench(){
    if(mode) return;
    autoFill();
    bench = { row:0, pick:null };
    enterMode({ name:'bench', key:benchKey, tick:()=>{}, exit:()=>{ bench = null; el.querySelector('#sfBench').classList.add('hidden'); showRobot(benchBuild()); if(window.AVATAR) AVATAR.attach(); } });
    if(window.AVATAR) AVATAR.detach();
    if(document.pointerLockElement) document.exitPointerLock();
    camTo(V(-0.6, 2.25, 4.3), V(0.75, 1.3, 6.5));
    keys([['↑↓','🧩'],['←→','🔄'],['E','¥'],['ESC','✕']]);
    paintBench();
  }
  const cur = slot => slot==='plating' ? (S.robot.plating && has('plating') ? 'plating' : null) : S.robot[slot];
  function benchKey(e){
    if(!bench) return true;
    const slot = BENCH[bench.row];
    if(e.code==='Escape' || e.code==='KeyQ' || e.code==='KeyI'){ exitMode(); return true; }
    if(e.code==='ArrowUp' || e.code==='KeyW' || e.code==='ArrowDown' || e.code==='KeyS'){
      bench.row = (bench.row + (e.code==='ArrowUp' || e.code==='KeyW' ? BENCH.length-1 : 1)) % BENCH.length; bench.pick = null;
      showRobot(benchBuild()); paintBench(); return true; }
    if(e.code==='ArrowLeft' || e.code==='KeyA' || e.code==='ArrowRight' || e.code==='KeyD'){
      const o = options(slot), now = bench.pick ? bench.pick.id : cur(slot);
      const i = (o.indexOf(now) + (e.code==='ArrowRight' || e.code==='KeyD' ? 1 : o.length-1)) % o.length;
      choose(slot, o[i]); return true; }
    if(e.code==='KeyE' || e.code==='Enter' || e.code==='Space'){ if(bench.pick) buy(slot, bench.pick.id); return true; }
    return true;
  }
  function choose(slot, id){
    if(owned(slot, id) && !lockOf(id)){ equip(slot, id); bench.pick = null; }
    else bench.pick = { slot, id };
    showRobot(benchBuild(bench.pick), true); paintBench();
  }
  function equip(slot, id){
    if(slot==='plating') S.robot.plating = !!id; else S.robot[slot] = id;
    save();
    if(builtRobot() && !S.flags.firstBuild){ S.flags.firstBuild = true; rxp(80, V(0, 2, 6.5)); talk('built'); confetti(V(0, 1.6, 6.5), 30); hud(); }
  }
  function buy(slot, id){
    const price = PRICE[id] || 0;
    if(lockOf(id)){ pop('🔒', V(0, 2, 6.5), '#ff8a8a', true); return; }
    if(S.credits < price){ pop('¥ ✖', V(0, 2, 6.5), '#ff8a8a', true); return; }
    S.credits -= price; give(id); pop('-¥'+price, V(0, 2.1, 6.5), '#ffd23d', true);
    if(!S.talked['bought_'+id]){ S.talked['bought_'+id] = true; rxp(5, V(0, 1.8, 6.5)); }
    equip(slot, id); bench.pick = null;
    showRobot(benchBuild(), true); paintBench(); hud();
  }
  function paintBench(){
    const b = el.querySelector('#sfBench'); b.classList.remove('hidden');
    const now = SFBOTS.stats(benchBuild()), then = SFBOTS.stats(benchBuild(bench.pick));
    const rows = BENCH.map((slot, i)=>{
      const on = i===bench.row, id = on && bench.pick ? bench.pick.id : cur(slot);
      const name = id ? ITEMS[id].name : '—';
      const icon = slot==='weapon' && id ? ITEMS[id].icon : SLOT_ICON[slot];
      let tag = '';
      if(on && bench.pick){ const lk = lockOf(id); tag = lk ? `<em class="lock">🔒 ${lk}</em>` : `<em class="${S.credits >= (PRICE[id]||0) ? 'buy' : 'poor'}"><kbd>E</kbd> ¥${PRICE[id]||0}</em>`; }
      else if(!id && slot!=='plating') tag = '<em class="need">❗</em>';
      return `<div class="sf-brow${on?' on':''}" data-row="${i}"><span class="i">${icon}</span><b>${esc(name)}</b>${on ? '<span class="arr">◀ ▶</span>' : ''}${tag}</div>`;
    }).join('');
    const bar = (icon, a, c, max) => { const w1 = Math.min(100, a/max*100), w2 = Math.min(100, c/max*100);
      return `<div class="sf-bstat"><span>${icon}</span><div><i style="width:${w1}%"></i>${w2!==w1 ? `<u class="${w2>w1?'up':'dn'}" style="left:${Math.min(w1,w2)}%;width:${Math.abs(w2-w1)}%"></u>` : ''}</div></div>`; };
    b.innerHTML = `<div class="sf-bhead">🤖 <b>¥${S.credits}</b></div>${rows}
      <div class="sf-bstats">${bar('💨', now.speed, then.speed, 9)}${bar('🛡', now.armor, then.armor, 130)}${bar('❤', now.core, then.core, 140)}${bar('💥', now.weaponKind ? now.dmg/now.cd : 0, then.weaponKind ? then.dmg/then.cd : 0, 16)}${bar('⚡', now.cap, then.cap, 130)}</div>`;
    b.querySelectorAll('.sf-brow').forEach(r=>r.onclick = ()=>{ bench.row = +r.dataset.row; bench.pick = null; showRobot(benchBuild()); paintBench(); });
  }

  /* ============================================================== ARENA */
  let crowd = [], fightGroup = null, fightQueued = false;
  function arena(at){
    const W = 44, D = 44, H = 12;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0x5a5a64, 0.7)); floor.rotation.x = -Math.PI/2; group.add(floor);
    walls(W, D, H, std(0x5a5a6a, 0.8)); G.ceiling = ()=>H;
    // the ring: a steel disc with hazard edges, a cage rail round it
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 0.3, 48), std(0x8a909c, 0.35, 0.6)); ring.position.set(0, 0.15, 0); group.add(ring);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(13, 0.15, 8, 64), glowM(0xffd23d, 1.4)); edge.rotation.x = Math.PI/2; edge.position.set(0, 0.32, 0); edge.userData.flat = true; group.add(edge);
    for(let i=0;i<24;i++){ const a = i/24*Math.PI*2; box(0.15, 1.8, 0.15, std(0xaab0bb, 0.4, 0.8), Math.sin(a)*13.4, 0.9, Math.cos(a)*13.4); }
    // gantry lights, hung where you can see them
    for(let i=0;i<4;i++){ const a = i/4*Math.PI*2 + Math.PI/4; box(1.4, 0.3, 0.6, glowM(0xffffff, 2.5), Math.sin(a)*9, 10.5, Math.cos(a)*9); }
    light(0xff3040, 24, 26, -12, 5, 8); light(0x27e8ff, 24, 26, 12, 5, 8);
    sign(['⚡ BOT NIGHT ⚡'], 10, 2, 0, 8.5, -D/2+0.2, 0, { w:900, h:180, bg:null, fg:'#ff3fd0', glow:'#ff3fd0', font:'bold 110px' });
    // the crowd, who jump when something good happens
    const who = ['nia','sable','kofi','theo','zuri'];
    crowd = [];
    for(let i=0;i<14;i++){ const a = Math.PI*0.2 + i/13*Math.PI*1.6;
      crowd.push(person(who[i%5], Math.sin(a)*16, -Math.cos(a)*16, { face: Math.atan2(-Math.sin(a), Math.cos(a)), watch:false })); }
    // MC Volt, the pad you fight from, and the way out
    cast.mc = person('kofi', 4, 15.5, { face:Math.PI, emoji:['🎤','⚡','🔥'] });
    const pad = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.2, 36), new THREE.MeshBasicMaterial({ color:0xff3fd0, side:THREE.DoubleSide }));
    pad.rotation.x = -Math.PI/2; pad.position.set(0, 0.34, 13.8); group.add(pad);
    spots.pad = [0, 13.8, 2.6];
    thing(0, 14.2, 'Fight', ()=>{
      if(fightQueued) return;              // one intro, one fight, however often E is pressed
      const foe = S.step==='fight1' ? 'bruiser' : 'titan';
      fightQueued = true;
      talk(S.step==='fight1' ? 'mcBruiser' : S.step==='titan' ? 'mcTitan' : 'mcAgain', ()=>{ fightQueued = false; startFight(foe); });
    }, { r:2.2, when:()=>!fightQueued && ['fight1','titan','done'].indexOf(S.step)>=0, icon:'🥊' });
    box(3, 0.1, 2, glowM(0x27e8ff, 1), 0, 0.06, D/2-2);
    spots.exit = [0, D/2-2, 2.6];
    thing(0, D/2-2, 'Out', ()=>travel('street', 'arena'), { r:2.2, icon:'🚪' });
    spawn(0, D/2-5, 0);
    if(at!=='ring' && S.step==='fight1' && !S.flags.mcIntro){ S.flags.mcIntro = true; setTimeout(()=>{ if(scene==='arena') talk('mcHello'); }, 700); }
  }
  function cheer(){ crowd.forEach((c, i)=>{ c.hop = 0.5 + (i%3)*0.12; }); }

  /* ---------------------------------------------------------- fighting */
  function startFight(foeId){
    if(!builtRobot() || fighting || scene!=='arena') return;
    fighting = true; G.running = false;
    fightGroup = new THREE.Group(); group.add(fightGroup);
    const build = Object.assign({ plating: !!S.robot.plating && has('plating') }, S.robot);
    SFBOTS.start({ group:fightGroup, camera:G.camera, fightOver, scan, pop, cheer }, build, foeId);
    el.classList.add('fight');
    if(document.pointerLockElement) document.exitPointerLock();
    if(window.AVATAR) AVATAR.detach();
    el.querySelector('#sfFight').classList.remove('hidden');
    counted = -1;
  }
  /* A scan puts a marker on the weak motor. With SCAN 2 it stays up the
     whole fight; with less it fades after a few seconds and needs another. */
  function scan(F){
    if(!S.talked['scan_'+F.foeId]){ S.talked['scan_'+F.foeId] = true; rxp(25, V(F.E.x, 3, F.E.z)); }
    return attr('ana') >= 2 ? 999 : 6;
  }
  function fightOver(result, F){
    banner(result==='win' ? 'K.O.!' : 'WRECKED', 1.6, result==='win' ? 'go' : 'bad');
    if(result==='win'){ cheer(); confetti(V(F.E.x, 2, F.E.z), 60); }
    setTimeout(()=>{
      stopFight();
      G.running = true;
      spawn(0, 15.2, 0);
      if(window.AVATAR) AVATAR.attach();
      if(result==='win'){
        const r = F.foe.reward, again = F.foeId==='titan' && S.step==='done';
        const cash = again ? 40 : r.credits;
        S.credits += cash; if(!again) S.rep += r.rep;
        const from = V(0, 2, 12);
        for(let i=0;i<6;i++) setTimeout(()=>fly('¥', from), i*90);
        pop('+¥'+cash, from, '#ffd23d', true);
        rxp(again ? 30 : r.rxp, V(0, 3, 12));
        if(F.foeId==='bruiser'){
          collect('scrap', 4, from); collect('sensor', 1, from);
          go('titan'); talk('win1');
        } else if(!again){
          collect('carbon', 1, from); collect('camera', 1, from);
          go('done'); ending();
        }
      } else {
        talk('lose');
        rxp(20, head());
      }
      hud();
    }, 2000);
  }
  /* The end of the act: Daichi comes down out of the crowd. */
  function ending(){
    const d = cast.daichi = person('theo', -9, 17, { umbrella:0x27e8ff });
    d.walkTo(-1.6, 14.4, ()=>{ d.g.rotation.y = Math.atan2(G.pos.x-d.g.position.x, G.pos.z-d.g.position.z);
      talk('ending', ()=>{
        panel('', `<div class="sf-end"><small>ACT 1</small><b>COMPLETE</b>
          <div class="sf-end-row"><span>⭐ ${S.lvl}</span><span>¥${S.credits}</span><span>👑 ${S.rep}</span></div>
          <small class="sf-dim">ACT 2 · THE INSTITUTE · SOON</small>
          <div class="sf-big-btns"><button data-a="stay">▶</button><button data-a="wano">🌏</button></div></div>`, act=>{
            if(act==='stay') closePanel(); if(act==='wano'){ closePanel(); leave(); } });
        save(true);
      }); });
  }

  /* ================================================================== UI */
  let el = null;
  function ui(){
    if(!el){
      el = document.createElement('div'); el.id = 'sf';
      el.innerHTML = `
        <div class="sf-me"><b id="sfLv"></b><div class="sf-bar"><i id="sfXp"></i></div><span id="sfCash"></span><span id="sfRep"></span><span class="sf-save" id="sfSave">💾</span></div>
        <div class="sf-goal"><span id="sfGoalI"></span><b id="sfGoalT"></b><small id="sfGoalD"></small></div>
        <button class="sf-bag" id="sfBag">🎒<kbd>I</kbd><em id="sfPts" class="hidden">+</em></button>
        <div class="sf-layer" id="sfLayer"></div>
        <div class="sf-prompt hidden" id="sfPrompt"></div>
        <div class="sf-keys hidden" id="sfKeys"></div>
        <div class="sf-banner hidden" id="sfBanner"></div>
        <div class="sf-panel hidden" id="sfPanel"><div class="sf-ph"><b></b><button class="sf-x">✕</button></div><div class="sf-pb"></div></div>
        <div class="sf-fight hidden" id="sfFight"></div>
        <div class="sf-bench hidden" id="sfBench"></div>
        <div class="sf-fade" id="sfFade"></div>`;
      document.body.appendChild(el);
      el.querySelector('.sf-x').onclick = closePanel;
      el.querySelector('#sfBag').onclick = ()=>{ if(!mode && !fighting) bag(); };
      el.querySelector('.sf-pb').addEventListener('click', e=>{ const b = e.target.closest('[data-a]'); if(!b) return; if(panelCb) panelCb(b.dataset.a); });
    }
    el.classList.remove('hidden');
    hud();
  }
  function hud(){
    if(!el) return;
    const g = goal();
    el.querySelector('#sfGoalI').textContent = g.icon;
    el.querySelector('#sfGoalT').textContent = g.text;
    el.querySelector('#sfLv').textContent = 'LV '+S.lvl;
    el.querySelector('#sfXp').style.width = Math.min(100, S.rxp/need(S.lvl)*100)+'%';
    el.querySelector('#sfCash').textContent = '¥'+S.credits;
    el.querySelector('#sfRep').textContent = S.rep ? '👑'+S.rep : '';
    el.querySelector('#sfPts').classList.toggle('hidden', !S.pts);
  }
  const head = () => V(G.pos.x, 2.4, G.pos.z);
  function screenOf(v){
    const p = v.clone().project(G.camera);
    return { x:(p.x+1)/2*innerWidth, y:(1-p.y)/2*innerHeight, ok: p.z < 1 && p.z > -1 };
  }
  /* ------------------------------------------ bubbles, pops and flyers
     All three live in one layer and are placed from the world every
     frame, so a bubble stays over the head that said it. */
  let marks = [];
  function clearLayer(){ marks.forEach(m=>m.el.remove()); marks = []; }
  function bubble(at, text, secs, ink){
    const d = document.createElement('div'); d.className = 'sf-bub' + (at ? '' : ' phone'); d.textContent = text;
    d.style.borderColor = ink || '#8fd3ff';
    el.querySelector('#sfLayer').appendChild(d);
    marks.push({ el:d, at, life:secs, max:secs, kind:'bub' });
  }
  function pop(text, pos, color, big){
    if(!el) return;
    const d = document.createElement('div'); d.className = 'sf-pop' + (big ? ' big' : ''); d.textContent = text; d.style.color = color || '#fff';
    el.querySelector('#sfLayer').appendChild(d);
    const p = pos.clone(); marks.push({ el:d, at:()=>p, life:1.1, max:1.1, kind:'pop' });
  }
  function fly(icon, from){
    if(!el) return;
    const s = screenOf(from), d = document.createElement('div'); d.className = 'sf-fly'; d.textContent = icon;
    d.style.left = s.x+'px'; d.style.top = s.y+'px';
    el.querySelector('#sfLayer').appendChild(d);
    const bagR = el.querySelector('#sfBag').getBoundingClientRect();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ d.style.left = (bagR.left+bagR.width/2)+'px'; d.style.top = (bagR.top+bagR.height/2)+'px'; d.style.transform = 'translate(-50%,-50%) scale(.6)'; }));
    setTimeout(()=>{ d.remove(); const b = el.querySelector('#sfBag'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }, 750);
  }
  /* Something goes into the bag: it flies there, and a count pops. */
  function collect(id, n, from){
    give(id, n); save();
    const it = ITEMS[id] || { icon:'📦' };
    for(let i=0;i<Math.min(n||1, 3);i++) setTimeout(()=>fly(it.icon, from), i*120);
    pop(it.icon+(n>1 ? ' ×'+n : ''), from, '#e8f4ff');
  }
  function tickLayer(dt){
    marks = marks.filter(m=>{
      m.life -= dt;
      if(m.life <= 0){ m.el.remove(); return false; }
      const k = 1 - m.life/m.max;
      if(!m.at){ m.el.style.left = '50%'; m.el.style.top = '14%'; }
      else { const s = screenOf(m.at()); m.el.style.display = s.ok ? '' : 'none';
        m.el.style.left = s.x+'px'; m.el.style.top = (s.y - (m.kind==='pop' ? k*60 : 0))+'px'; }
      m.el.style.opacity = m.kind==='pop' ? Math.min(1, m.life*2) : Math.min(1, m.life*4, k*8);
      return true; });
  }
  /* A conversation is a queue of bubbles that play themselves out while
     you keep moving. `done` runs after the last one. */
  let talkQ = [];
  function talk(key, done){ talkQ.push({ lines:LINES[key]||[], i:-1, t:0, done }); }
  function speakerAt(who){
    if(who==='ren') return head;
    const a = cast[who]; if(a) return ()=>V(a.g.position.x, a.tall, a.g.position.z);
    if(spots[who]) return ()=>V(spots[who][0], spots[who][2]||2.6, spots[who][1]);
    return null;
  }
  function tickTalk(dt){
    const q = talkQ[0]; if(!q) return;
    q.t -= dt;
    if(q.t > 0) return;
    q.i++;
    if(q.i >= q.lines.length){ talkQ.shift(); if(q.done) q.done(); return; }
    const [who, text] = q.lines[q.i], secs = 1.1 + text.length*0.055;
    bubble(text.indexOf('📱')===0 ? null : speakerAt(who), text, secs, INK[who]);
    q.t = secs + 0.1;
  }
  function flushTalk(){ const q = talkQ; talkQ = []; q.forEach(x=>{ if(x.done) x.done(); }); }
  /* Keycaps along the bottom: the keys that matter now, with pictures. */
  let keysT = 0;
  function keys(list, secs, extra){
    const k = el.querySelector('#sfKeys');
    k.innerHTML = list.map(([key, icon])=>`<span class="k" data-k="${esc(key)}"><kbd>${esc(key)}</kbd>${icon ? '<i>'+esc(icon)+'</i>' : ''}</span>`).join('') + (extra||'');
    k.classList.remove('hidden'); keysT = secs || 0;
  }
  function hideKeys(){ el.querySelector('#sfKeys').classList.add('hidden'); keysT = 0; }
  let bannerT = null;
  function banner(text, secs, cls){
    const b = el.querySelector('#sfBanner'); b.className = 'sf-banner ' + (cls||''); b.textContent = text;
    void b.offsetWidth; b.classList.add('show');
    clearTimeout(bannerT); bannerT = setTimeout(()=>b.classList.add('hidden'), (secs||1.2)*1000);
  }
  let panelCb = null;
  function panel(title, html, cb){
    const p = el.querySelector('#sfPanel');
    p.querySelector('.sf-ph b').textContent = title; p.querySelector('.sf-pb').innerHTML = html;
    p.classList.remove('hidden'); panelCb = cb; busy = 'panel'; G.running = false;
    if(document.pointerLockElement) document.exitPointerLock();
  }
  function closePanel(){
    if(!el) return;
    el.querySelector('#sfPanel').classList.add('hidden'); panelCb = null;
    if(busy==='panel'){ busy = null; if(!fighting && !mode){ G.running = true; lockPointer($('#view')); } }
  }
  /* The bag: what you have, as icons; and your skills, as pips. */
  function bag(tab){
    tab = tab || 'inv';
    const tabs = `<div class="sf-tabs">${[['inv','🎒'],['ren','⚙'+(S.pts ? ' +'+S.pts : '')]].map(t=>`<button data-a="tab:${t[0]}" class="${tab===t[0]?'on':''}">${t[1]}</button>`).join('')}</div>`;
    let body = '';
    if(tab==='inv'){
      const ids = Object.keys(S.inv).filter(id=>S.inv[id]>0 && ITEMS[id]);
      body = `<div class="sf-grid">${ids.map(id=>`<div class="sf-cell${S.robot[ITEMS[id].slot]===id ? ' on' : ''}" title="${esc(ITEMS[id].name)}"><span>${ITEMS[id].icon}</span><b>×${S.inv[id]}</b><small>${esc(ITEMS[id].name)}</small></div>`).join('')}</div>`;
    } else {
      body = `<div class="sf-skills">` + ATTRS.map(a=>`<div class="sf-skill"><span>${a[1]}</span><b>${a[2]}</b><i>${'●'.repeat(attr(a[0]))}${'○'.repeat(Math.max(0,5-attr(a[0])))}</i>
          ${S.pts>0 && attr(a[0])<10 ? `<button data-a="up:${a[0]}">+</button>` : ''}</div>`).join('') + `</div>`;
    }
    body += `<div class="sf-big-btns small"><button data-a="wano" title="Wano">🌏</button></div>`;
    panel('LV '+S.lvl, tabs + body, act=>{
      if(!act) return;
      if(act==='wano'){ closePanel(); leave(); return; }
      if(act.startsWith('tab:')) return bag(act.slice(4));
      if(act.startsWith('up:') && S.pts>0){ S.attrs[act.slice(3)]++; S.pts--; save(true); hud(); return bag('ren'); }
    });
  }
  function paintFight(){
    const F = SFBOTS.fight; if(!F) return;
    const card = (u, name) => {
      const row = (k, icon) => `<div class="sf-fs"><span>${icon}</span><div><i style="width:${Math.max(0,u.hp[k]/u.max[k]*100)}%"></i></div></div>`;
      return `<div class="sf-fc${u===F.P ? ' me' : ''}"><b>${esc(name)}</b>${row('core','❤')}${row('armor','🛡')}${row('lmotor','⚙L')}${row('rmotor','⚙R')}${row('weapon','🔨')}
        ${u===F.P ? `<div class="sf-fs heat"><span>🔥</span><div><i style="width:${Math.min(100,u.heat)}%"></i></div></div><div class="sf-fs pow"><span>⚡</span><div><i style="width:${u.power/u.s.cap*100}%"></i></div></div>` : ''}</div>`;
    };
    el.querySelector('#sfFight').innerHTML = card(F.P, 'YOU') + card(F.E, F.foe.name);
    const want = [['WASD','🚗'],['SPACE','👊'],['SHIFT','🛡'],['Q','💨'],['F','🔍']];
    const k = el.querySelector('#sfKeys');
    if(k.dataset.fight !== '1'){ keys(want); k.dataset.fight = '1'; }
    const hot = { dodge:'Q', hit:'SPACE', scan:'F' }[F.cue];
    k.querySelectorAll('.k').forEach(s=>s.classList.toggle('hot', s.dataset.k===hot));
  }

  /* ============================================================ modes
     A mode takes the keys and the camera: the repair, the bench. */
  let camWant = null, camLook = null, camLookNow = null;
  function camTo(pos, look){ camWant = pos; camLook = look; if(!camLookNow) camLookNow = look.clone(); }
  function enterMode(m){ mode = m; busy = 'mode'; G.running = false; hidePrompt(); }
  function exitMode(){
    if(!mode) return;
    const m = mode; mode = null; busy = null; camWant = null; camLookNow = null;
    if(m.exit) m.exit();
    if(el){ hideKeys(); const k = el.querySelector('#sfKeys'); k.dataset.fight = ''; }
    if(!fighting){ G.running = true; }
  }
  function hidePrompt(){ if(el) el.querySelector('#sfPrompt').classList.add('hidden'); }

  /* ============================================================== frame */
  function nearest(){
    let best = null, bd = Infinity;
    things.forEach(t=>{ if(t.when && !t.when()) return; const d = Math.hypot(G.pos.x-t.x, G.pos.z-t.z); if(d < t.r && d < bd){ bd = d; best = t; } });
    return best;
  }
  let fightPaintT = 0, holdT = 0, holdOn = null, counted = -1;
  /* 3, 2, 1, FIGHT — on the fight's own clock, so the word and the
     moment the robots can move are the same moment. */
  function countdown(){
    const F = SFBOTS.fight; if(!F) return;
    const i = F.hold > 1.7 ? 0 : F.hold > 0.85 ? 1 : F.hold > 0 ? 2 : 3;
    if(i === counted || counted >= 3) return;
    counted = i; banner(['3','2','1','FIGHT!'][i], 0.6, i===3 ? 'go' : 'count');
  }
  function tick(dt){
    if(!on) return;
    clock += dt;
    actors.forEach(a=>a.tick(dt));
    tickMotion(dt);
    tickTalk(dt);
    tickLayer(dt);
    tickBeacon();
    if(rain){
      rain.pts.position.set(G.pos.x, 0, G.pos.z);
      const P = rain.pts.geometry.attributes.position, A = P.array;
      for(let i=1;i<A.length;i+=3){ A[i] -= 22*dt; if(A[i] < 0) A[i] += 20; }
      P.needsUpdate = true;
    }
    if(keysT > 0){ keysT -= dt; if(keysT <= 0) hideKeys(); }
    if(fighting){
      SFBOTS.tick(dt);
      countdown();
      fightPaintT -= dt; if(fightPaintT <= 0){ fightPaintT = 0.1; paintFight(); }
      return;
    }
    if(mode){
      mode.tick(dt);
      if(camWant){ G.camera.position.lerp(camWant, Math.min(1, dt*4)); camLookNow.lerp(camLook, Math.min(1, dt*4)); G.camera.lookAt(camLookNow); }
      return;
    }
    tickPickups();
    // the goal, and how far it is
    const t = goalSpot(), gd = el.querySelector('#sfGoalD');
    gd.textContent = t ? Math.round(Math.hypot(G.pos.x-t[0], G.pos.z-t[1]))+' m' : '';
    // what E does here
    const pr = el.querySelector('#sfPrompt');
    const n = busy ? null : nearest();
    if(n){
      const verb = typeof n.verb==='function' ? n.verb() : n.verb;
      if(n.hold){
        if(G.keys.KeyE && holdOn===n){ holdT += dt; if(holdT >= n.hold){ holdT = -99; n.act(); } }
        else if(!G.keys.KeyE){ holdT = 0; holdOn = n; }
      }
      const ring = n.hold && holdT > 0 ? ` style="background:conic-gradient(#ffd23d ${holdT/n.hold*360}deg, #1a2238 0)"` : '';
      pr.innerHTML = `<kbd${ring}>E</kbd><span>${n.icon ? n.icon+' ' : ''}${esc(verb)}</span>`; pr.classList.remove('hidden');
    }
    else { pr.classList.add('hidden'); holdT = 0; holdOn = null; }
  }
  function key(e){
    if(!on) return false;
    if(fighting && !busy) return SFBOTS.key(e, true);
    if(busy==='mode' && mode) return mode.key(e);
    if(busy==='panel'){ if(e.code==='Escape' || e.code==='KeyI'){ closePanel(); } return true; }
    if(e.code==='KeyE'){ const n = nearest(); if(n){ if(!n.hold) n.act(); return true; } return false; }
    if(e.code==='KeyI'){ bag(); return true; }
    return false;
  }
  function keyup(e){ if(on && fighting) SFBOTS.key(e, false); }
  addEventListener('keyup', keyup);

  function stopFight(){
    if(!fighting) return;
    fighting = false; SFBOTS.stop();
    if(fightGroup && group) group.remove(fightGroup); fightGroup = null;
    if(el){ el.classList.remove('fight'); el.querySelector('#sfFight').classList.add('hidden'); hideKeys(); el.querySelector('#sfKeys').dataset.fight = ''; }
  }

  return { enter, leave, tick, key, LINES,
           get active(){ return on; }, get busy(){ return busy; }, get fighting(){ return fighting; }, get mode(){ return mode && mode.name; },
           get state(){ return S; }, get scene(){ return scene; },
           /* for tests and the console */
           get _repair(){ return rep; }, _go:goScene, _step:go, _fight:startFight, _give:give, _bench:startBench, _repairStart:startRepair,
           _reset:()=>{ S = fresh(); save(); } };
})();
