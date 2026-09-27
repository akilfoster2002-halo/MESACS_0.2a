/* =====================================================================
   SANFRAN — a quest in its own world. ACT 1: THE UNDERGROUND.

   Ren Morikawa is seventeen, brilliant, bored, and fights robots for
   money in warehouses. His brother Daichi studies at the Sanfran
   Institute of Technology and thinks Ren could build something that
   matters. Act 1 is the night that starts: a rainy neon city, Ren's
   bedroom-workshop, the underground market, and two fights — BRUISER,
   and THE TITAN, which you cannot out-muscle and have to out-think.

   IT IS ITS OWN WORLD, the way a chat room is: a flat room in game.js's
   engine, entered from a gate on Wano (planet.js use('sanfran')), with
   its own scenes built one at a time — BEDROOM, STREET, MARKET, ARENA.

   THE RPG IS HERE TOO, and everything saves in the progress bag under
   'sf', autosaved at every mission start and finish:
     RESEARCH XP, not monster XP — from repairs, discoveries, fights,
       helping people — and a technology level that grants points;
     FIVE ATTRIBUTES — Engineering, Programming, Material Science,
       Energy, Analysis — that unlock things rather than multiply them
       (Engineering 2 repairs the motor, Programming 2 flashes the aim
       chip, Analysis 2 reads a weakness off a scan);
     AN INVENTORY of components, each with a description, category,
       rarity, weight, value, compatibility and properties;
     ROBOTS built from six parts and fought component by component
       (sfbots.js).

   CONTROLS: WASD move · mouse look · SPACE jump · E interact · I the
   notebook (inventory, Ren, robot) · in a fight WASD drive, SPACE attack,
   SHIFT block, Q dodge, F scan.
   ===================================================================== */
window.SANFRAN = (function(){
  const V = (x,y,z)=>new THREE.Vector3(x,y,z);
  const $ = s=>document.querySelector(s);
  const esc = s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* ============================================================ the items
     Every part in the game. Robot parts come from sfbots.js so the build
     screen and the bag can never disagree about what a part is. */
  const ITEMS = {
    scrap:      { name:'Scrap metal', cat:'Raw materials', rarity:'Common', weight:1.0, value:2, compat:'Frames, plating', props:'Mild steel offcuts', desc:'Everything starts as this.' },
    copper:     { name:'Copper wire', cat:'Raw materials', rarity:'Common', weight:0.2, value:4, compat:'Motors, wiring', props:'Conductive, 18 AWG', desc:'A spool, half used.' },
    aluminium:  { name:'Aluminium',   cat:'Raw materials', rarity:'Common', weight:0.4, value:6, compat:'Light frames', props:'Light, soft, conductive', desc:'Extruded tube, 20 mm.' },
    carbon:     { name:'Carbon fibre',cat:'Raw materials', rarity:'Rare', weight:0.2, value:30, compat:'Frames, armour', props:'Stiff, very light', desc:'A single precious sheet.' },
    plastic:    { name:'Plastic',     cat:'Raw materials', rarity:'Common', weight:0.3, value:1, compat:'Housings', props:'PLA filament', desc:'For the printer.' },
    silicon:    { name:'Silicon wafer', cat:'Raw materials', rarity:'Uncommon', weight:0.1, value:18, compat:'Processors', props:'Semiconductor', desc:'Cracked at one edge.' },
    board:      { name:'Circuit board', cat:'Electronics', rarity:'Common', weight:0.1, value:8, compat:'Any controller', props:'2-layer FR4', desc:'Blank, drilled.' },
    sensor:     { name:'Proximity sensor', cat:'Electronics', rarity:'Uncommon', weight:0.05, value:12, compat:'Controllers', props:'IR, 2 m range', desc:'Sees about as well as a moth.' },
    camera:     { name:'Camera module', cat:'Electronics', rarity:'Uncommon', weight:0.05, value:20, compat:'Controllers, drones', props:'720p, 60 fps', desc:'From a doorbell.' },
    mcu:        { name:'Microcontroller', cat:'Electronics', rarity:'Common', weight:0.02, value:10, compat:'Everything', props:'32-bit, 80 MHz', desc:'The brain of every small thing.' },
    motor_burnt:{ name:'Burnt micro motor', cat:'Electronics', rarity:'Junk', weight:0.1, value:0, compat:'None', props:'Winding shorted', desc:'Smells like a bad decision.' },
    servo:      { name:'Servo', cat:'Electronics', rarity:'Common', weight:0.06, value:9, compat:'Arms, grippers (not drive wheels)', props:'180° rotation, low speed', desc:'Turns to an angle. Does not spin.' },
    wheel:      { name:'Wheel', cat:'Robotics', rarity:'Common', weight:0.2, value:4, compat:'Chassis', props:'60 mm, rubber', desc:'Round.' },
    joint:      { name:'Joint', cat:'Robotics', rarity:'Common', weight:0.1, value:5, compat:'Arms', props:'Ball bearing', desc:'Keeps two things friends.' },
    gripper:    { name:'Gripper', cat:'Robotics', rarity:'Uncommon', weight:0.3, value:16, compat:'Arms', props:'Parallel jaw', desc:'Holds things. Sometimes too hard.' },
    plating:    { name:'Reinforced plating', cat:'Robotics', rarity:'Uncommon', weight:4, value:45, compat:'Any frame (+30 armour)', props:'Hardened steel', desc:'Bolt it on the front. Material Science 2 to heat-treat.' },
    energycell: { name:'Unknown energy cell', cat:'Experimental', rarity:'Unknown', weight:0.3, value:0, compat:'Unknown', props:'Faintly warm. No markings.', desc:'Found taped under your bed. You do not remember putting it there.' },
    invite:     { name:'Bot Night invitation', cat:'Experimental', rarity:'—', weight:0, value:0, compat:'—', props:'Holo card', desc:'BOT NIGHT. MIDNIGHT. WAREHOUSE 17. Knock twice.' }
  };
  SFBOTS.SLOTS.forEach(slot=>SFBOTS.PARTS[slot].forEach(p=>{
    ITEMS[p.id] = { name:p.name, cat:'Robotics', rarity: p.need ? 'Uncommon' : 'Common', weight:(p.weight||1), value:0,
      compat:'Combat robot — '+slot, props:propsOf(p), desc:p.desc, slot };
  }));
  function propsOf(p){
    const bits = [];
    ['armor','speed','turn','power','motorHp','cap','regen','dmg','coreHp'].forEach(k=>{ if(p[k]!==undefined) bits.push(k+' '+p[k]); });
    return bits.join(' · ');
  }
  const ATTRS = [
    ['eng','ENGINEERING','Robot construction, mechanical parts, structure, machines, vehicles.'],
    ['prog','PROGRAMMING','Robot AI, automation, hacking, sensors, logic.'],
    ['mat','MATERIAL SCIENCE','Armour, durability, weight, heat resistance.'],
    ['energy','ENERGY','Batteries, power systems, motors, experimental devices.'],
    ['ana','ANALYSIS','Investigation, scanning, identifying parts, finding weaknesses.']
  ];

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
  function save(why){
    try{ if(window.PROGRESS) PROGRESS.set(KEY, JSON.stringify(S)); }catch(e){}
    if(why) toast('💾 '+why);
  }
  const has = (id, n) => (S.inv[id]||0) >= (n||1);
  function give(id, n){ S.inv[id] = (S.inv[id]||0) + (n||1); }
  function take(id, n){ S.inv[id] = Math.max(0, (S.inv[id]||0) - (n||1)); }
  /* RESEARCH XP. A level every 200·level, each one a point to spend. */
  const need = l => 200*l;
  function rxp(n, why){
    S.rxp += n; toast('+'+n+' RESEARCH XP — '+why);
    while(S.rxp >= need(S.lvl)){ S.rxp -= need(S.lvl); S.lvl++; S.pts++;
      toast('⚙ TECH LEVEL '+S.lvl+' — a point to spend (I → REN)'); }
    hud();
  }
  const attr = k => S.attrs[k]||1;
  const meets = req => !req || Object.keys(req).every(k=>attr(k) >= req[k]);

  /* ============================================================ the story
     Each step: the mission it belongs to and what the HUD asks for. */
  const STEPS = {
    call:    { mission:'PROLOGUE — 2 A.M.', obj:'Look around. Move with WASD, jump with SPACE.' },
    repair:  { mission:'PROLOGUE — 2 A.M.', obj:'Pick up the delivery bot on your desk (E) and fix it.' },
    free:    { mission:'PROLOGUE — 2 A.M.', obj:'Explore your room. Daichi is waiting outside — the door when you are ready.' },
    street:  { mission:'THE CIRCUIT', obj:'Find the underground market. Look for BYTE BAZAAR.' },
    market:  { mission:'THE CIRCUIT', obj:'Buy what you need and build your first combat robot at the bench.' },
    fight1:  { mission:'THE CIRCUIT', obj:'Warehouse 17 — at the east end of the street. Beat BRUISER.' },
    titan:   { mission:'THE CIRCUIT', obj:'Talk to the announcer at Warehouse 17 to challenge THE TITAN.' },
    done:    { mission:'ACT 1 COMPLETE', obj:'The Institute is next. (Act 2 is coming.)' }
  };
  function go(step, why){
    S.step = step; save(why || 'Autosaved');
    hud();
  }

  /* ============================================================ the world */
  let on = false, server = null, group = null, scene = null, clock = 0;
  let things = [];              // interactables: {x,z,r,label,verb,act,y}
  let actors = [];              // ambient movers: {tick(dt)}
  let rain = null, ambient = [], bubble = null, bubbleT = 0;
  let fighting = false, busy = null;        // busy: a panel or dialogue that holds the keys

  function enter(sv){
    server = sv || null;
    load();
    if(window.AVATAR){ AVATAR.posture(null); if(AVATAR.setCast) AVATAR.setCast(null); }
    if(window.MENU && MENU.hideAll) MENU.hideAll();
    on = true;
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
    if(S.step==='call' && !S.flags.called) setTimeout(openingCall, 900);
  }
  function leave(){
    if(!on) return;
    stopFight();
    on = false; busy = null;
    save();
    const o = $('#sf'); if(o) o.classList.add('hidden');
    const h = $('#hud'); if(h) h.classList.remove('hidden');
    G.scene.background = null; G.scene.fog = null;
    const sv = (window.NET && window.PLANET) ? PLANET.server : server;
    if(window.PLANET) PLANET.enter(sv, 'hub');
  }

  /* ---------------------------------------------------------- scene kit */
  const lam = c => new THREE.MeshLambertMaterial({ color:c });
  const std = (c, r, m) => new THREE.MeshStandardMaterial({ color:c, roughness:r===undefined?0.6:r, metalness:m||0 });
  const glowM = (c, k) => new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:k||1.8 });
  function box(w, h, d, mat, x, y, z, solid){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); group.add(m);
    if(solid) G.solids.push({ x1:x-w/2, x2:x+w/2, z1:z-d/2, z2:z+d/2, y1:-0.5, y2:y+h/2 });
    return m;
  }
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
    m.position.set(x, y, z); m.rotation.y = ry||0; group.add(m); return m;
  }
  function thing(x, z, label, verb, act, r, y){ things.push({ x, z, label, verb, act, r:r||1.6, y:y||0 }); }
  function light(c, i, d, x, y, z){ const l = new THREE.PointLight(c, i, d, 1.5); l.position.set(x, y, z); group.add(l); return l; }

  function clearScene(){
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup = new THREE.Group(); G.scene.add(G.roomGroup);
    group = G.roomGroup;
    G.solids = []; G.hits = []; G.selected = null; G.focused = null;
    things = []; actors = []; ambient = []; rain = null;
    G.vel.set(0,0,0); G.onGround = true;
    G.ground = ()=>0; G.ceiling = null;
    let amb = G.scene.children.find(c=>c.isAmbientLight);
    if(!amb){ amb = new THREE.AmbientLight(0xffffff, 0.5); G.scene.add(amb); }
    amb.userData.roomOwned = true;
    if(G.sun){ G.sun.intensity = 0.1; }
    return amb;
  }
  function goScene(id, first, at){
    scene = id; S.scene = id;
    const amb = clearScene();
    ({ bedroom, street, market, arena })[id](amb, at);
    if(window.AVATAR) AVATAR.attach();
    G.scene.updateMatrixWorld(true);
    hud();
    if(!first) save();
  }
  function spawn(x, z, yaw){ G.pos.set(x, 1.7, z); G.yaw = yaw||0; G.pitch = 0; G.vel.set(0,0,0);
    G.camera.position.set(x + Math.sin(G.yaw)*3, 3.5, z + Math.cos(G.yaw)*3); }   // no swing in from the last world
  function walls(W, D, H, mat){
    box(W, H, 0.3, mat, 0, H/2, -D/2, true); box(W, H, 0.3, mat, 0, H/2, D/2, true);
    box(0.3, H, D, mat, -W/2, H/2, 0, true); box(0.3, H, D, mat, W/2, H/2, 0, true);
  }
  /* rain: a box of falling points that follows the camera */
  function makeRain(n, area){
    const pos = new Float32Array(n*3);
    for(let i=0;i<n;i++){ pos[i*3] = (Math.random()-0.5)*area; pos[i*3+1] = Math.random()*20; pos[i*3+2] = (Math.random()-0.5)*area; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color:0x9fc8ff, size:0.07, transparent:true, opacity:0.7 }));
    group.add(pts);
    rain = { pts, area };
  }
  /* people: the game's own rigged cast, walking a path */
  function person(char, path, speed, line, umbrella){
    const g = new THREE.Group(); group.add(g);
    const a = { g, model:null, path, i:0, t:Math.random(), speed, line, said:0 };
    if(window.AVATAR) AVATAR.load(char).then(m=>{ a.model = m; g.add(m); }).catch(()=>{});
    if(umbrella){ const u = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.35, 10, 1, true), std(umbrella, 0.4));
      u.position.y = 2.25; g.add(u); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.8), lam(0x222222)); st.position.y = 1.85; g.add(st); }
    a.tick = dt=>{
      if(path.length > 1){
        const p0 = path[a.i], p1 = path[(a.i+1)%path.length];
        const len = Math.hypot(p1[0]-p0[0], p1[1]-p0[1]);
        a.t += speed*dt/len;
        if(a.t >= 1){ a.t = 0; a.i = (a.i+1)%path.length; }
        const x = p0[0] + (p1[0]-p0[0])*a.t, z = p0[1] + (p1[1]-p0[1])*a.t;
        g.position.set(x, 0, z); g.rotation.y = Math.atan2(p1[0]-p0[0], p1[1]-p0[1]);
        if(a.model) AVATAR.animate(a.model, dt, 'walk');
      } else { g.position.set(path[0][0], 0, path[0][1]); if(a.model) AVATAR.animate(a.model, dt, 'idle'); }
      if(a.line){ a.said -= dt;
        if(a.said <= 0 && Math.hypot(G.pos.x-g.position.x, G.pos.z-g.position.z) < 3.2){ a.said = 14; say(a.line); } }
    };
    actors.push(a);
    return a;
  }

  /* ============================================================ BEDROOM */
  let bot = null;
  function bedroom(amb, at){
    G.scene.background = new THREE.Color(0x05060e); G.scene.fog = null;
    amb.color.setHex(0x5a5a8a); amb.intensity = 0.7;
    const W = 10, D = 8, H = 3.2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0x3a2e28, 0.8)); floor.rotation.x = -Math.PI/2; group.add(floor);
    walls(W, D, H, lam(0x2a3040));
    box(W, 0.2, D, lam(0x20242e), 0, H, 0);
    G.ceiling = ()=>H;
    light(0xffc890, 14, 9, -2, 2.8, 0);           // the desk lamp
    light(0x6a8cff, 8, 8, 4.5, 2, 0);             // the window, neon outside
    // the window: rain on a neon night
    sign(['','',''], 3, 1.8, W/2-0.16, 1.8, 0, -Math.PI/2, { bg:'#1a1040' });
    const city = sign(['さんふらん  SANFRAN', '▮▮ ▮ ▮▮▮  ▮▮'], 2.8, 1.6, W/2-0.14, 1.8, 0, -Math.PI/2, { bg:'#140a30', fg:'#ff5ab4', glow:'#ff5ab4', font:'bold 34px' });
    box(0.1, 1.9, 0.1, lam(0x111111), W/2-0.12, 1.8, 0);
    // bed
    box(2, 0.5, 3.6, lam(0x3a4a7a), -W/2+1.1, 0.25, -D/2+2, true);
    box(2, 0.2, 0.8, lam(0xdddddd), -W/2+1.1, 0.6, -D/2+0.6);
    // desk, computer, the delivery bot
    box(3, 0.1, 1.2, std(0x5a4030), -1.5, 1.0, -D/2+0.8, true);
    [-2.8,-0.2].forEach(x=>box(0.1, 1, 1.1, std(0x3a2a20), x, 0.5, -D/2+0.8));
    const scr = sign(['SCHEMATIC  v14', '> motor_temp: 91°C', '> BOT NIGHT?'], 1.2, 0.7, -2.2, 1.5, -D/2+0.4, 0, { fg:'#3ddc84', font:'bold 30px', align:'left' });
    bot = SFBOTS.model(SFBOTS.stats({ frame:'frame_light', weapon:'wpn_flipper' }), 0.3); bot.userData.weapon.visible = false;
    bot.position.set(-0.8, 1.05, -D/2+0.8); group.add(bot);
    // shelves of broken robots, the printer, the toolbox, posters, photos
    box(0.4, 2.2, 2.6, lam(0x3a3a44), W/2-0.3, 1.1, -D/2+1.6, true);
    for(let i=0;i<3;i++){ const r = SFBOTS.model(SFBOTS.stats({ frame:['frame_light','frame_balanced','frame_heavy'][i] }), 0.25); r.position.set(W/2-0.3, 0.6+i*0.7, -D/2+1.6); r.rotation.y = -Math.PI/2; group.add(r); }
    box(0.9, 0.9, 0.9, lam(0x444c5a), 1.8, 0.45, -D/2+0.6, true);
    box(0.6, 0.05, 0.6, glowM(0xff8a3d, 0.6), 1.8, 0.95, -D/2+0.6);
    box(0.8, 0.4, 0.4, lam(0xb8201c), 3.2, 0.2, -D/2+0.4, true);
    sign(['ROBO', 'RUMBLE', '2031'], 1, 1.4, -W/2+0.16, 1.9, 1.5, Math.PI/2, { bg:'#2a0a1a', fg:'#ffd23d', font:'bold 60px' });
    sign(['SFIT', 'OPEN DAY'], 1, 1.4, 0.5, 2, -D/2+0.16, 0, { bg:'#0a1a2a', fg:'#8fd3ff', font:'bold 60px' });
    sign(['📷'], 0.5, 0.4, 3.5, 1.7, -D/2+0.16, 0, { bg:'#e8dcc0', fg:'#333', font:'80px' });
    box(1.2, 2.1, 0.5, lam(0x2c2a36), -W/2+0.4, 1.05, D/2-1.5, true);   // the closet
    box(0.9, 2.1, 0.1, lam(0x6a4a30), 0, 1.05, D/2-0.1);                // the door
    sign(['🎵'], 0.3, 0.3, -3.3, 1.2, -D/2+0.35, 0, { bg:'#222', font:'140px' });

    // what you can look at
    thing(-2.2, -D/2+1.3, 'Computer', 'E — look', ()=>panelComputer());
    thing(-0.8, -D/2+1.4, 'Delivery bot', S.step==='repair' ? 'E — pick it up' : 'E — look', ()=>{
      if(S.step==='repair') panelRepair();
      else say('Your delivery bot. It drives straight now. Mostly.'); });
    thing(-W/2+1.2, -D/2+2.2, 'Bed', 'E — look', ()=>{
      if(!S.found.underbed){ S.found.underbed = true; give('energycell'); give('invite'); save();
        rxp(40, 'found something under the bed');
        dialog([['REN','...Huh. An energy cell taped to the slats. No markings. Warm.'],['REN','And a holo-card: BOT NIGHT. MIDNIGHT. WAREHOUSE 17. Knock twice.']]); }
      else say('Your bed. You are not using it.'); }, 1.8);
    thing(W/2-0.8, -D/2+1.6, 'Broken robots', 'E — look', ()=>say('Prototype 14. Motor overheated after six minutes. Prototype 9: fell off the desk. Prototype 11: we do not talk about 11.'));
    thing(1.8, -D/2+1.2, '3D printer', 'E — look', ()=>say('Printing a wheel hub. 37% done. It has been 37% done for an hour.'));
    thing(3.2, -D/2+0.9, 'Toolbox', 'E — look', ()=>{ if(!S.found.toolbox){ S.found.toolbox = true; give('copper', 2); give('joint'); save(); rxp(15, 'raided the toolbox'); say('Two spools of copper wire and a spare joint. Yours now. Well — still yours.'); } else say('Screwdrivers, solder, a spoon (why).'); });
    thing(-W/2+0.6, 1.5, 'Poster', 'E — look', ()=>say('ROBO RUMBLE 2031. You were thirteen. You lost in the second round and swore you never would again.'));
    thing(3.5, -D/2+0.7, 'Photograph', 'E — look', ()=>say('You and Daichi beside a robotics trophy. He is holding it. You are pretending not to care.'));
    thing(-3.3, -D/2+0.9, 'Music player', 'E — play', ()=>say('♪ A lo-fi mix Daichi made you. It is called "SLEEP, REN."'));
    thing(0.5, -D/2+0.9, 'Engineering notebook', 'E — read', ()=>say('Your notes. "BUILD → TEST → ADJUST. Repeat until it works or until Daichi confiscates the soldering iron."'));
    thing(W/2-0.6, 0, 'Window', 'E — look', ()=>say('Rain on the glass. Neon down in the street, a delivery drone blinking past. The city never sleeps. Neither do you.'));
    thing(-W/2+0.8, D/2-1.5, 'Closet', 'E — open', ()=>say('Your jacket. Daichi’s old SFIT hoodie, which you "borrowed" two years ago.'));
    thing(0, D/2-0.8, 'Door', 'E — go out', ()=>{
      if(S.step==='call' || S.step==='repair'){ say('Not yet — finish the bot first. Daichi will not let it go.'); return; }
      if(S.step==='free'){ go('street', 'Mission started: THE CIRCUIT'); streetIntro = true; }
      goScene('street', false, 'home'); });
    if(at==='door') spawn(0, D/2-1.4, 0); else spawn(1.5, 1.5, Math.PI*0.9);
  }
  function openingCall(){
    S.flags.called = true;
    dialog([['DAICHI','Ren. You’re still working?'],['REN','Define working.'],['DAICHI','You’re supposed to be asleep.'],
      ['REN','I’m optimizing.'],['DAICHI','You’re soldering a robot at two in the morning.'],['REN','Exactly.'],
      ['DAICHI','Fine. Then finish Mrs. Oda’s delivery bot before it drives into another wall. I’m outside.']], ()=>{
        objective = { moved:false, jumped:false };
      });
  }
  let objective = null, streetIntro = false;

  /* ------------------------------------------------ the repair tutorial
     BUILD → TEST → ADJUST: inspect, open, remove, choose, install, test —
     and the test veers, so you align the wheels and test again. */
  let rep = null;
  function panelRepair(){
    if(!rep) rep = { stage:0, align:0, target:(Math.random()<0.5?-1:1)*(3+Math.floor(Math.random()*4)), tests:0 };
    const R = rep;
    const steps = ['Inspect the motor','Open the robot interface','Remove the motor','Install a replacement','Test it','Adjust and test again'];
    const list = steps.map((s,i)=>`<li class="${i<R.stage?'done':i===R.stage?'cur':''}">${esc(s)}</li>`).join('');
    let body = '';
    if(R.stage===0) body = `<p>The bot's left drive wheel will not turn.</p><button data-a="inspect">🔍 Inspect the motor</button>`;
    if(R.stage===1) body = `<p><b>Micro motor, left drive.</b> Winding is black and it smells like burnt toast — shorted. Needs replacing.</p><button data-a="open">🔧 Open the robot interface</button>`;
    if(R.stage===2) body = `<p>Four screws, one connector. ENGINEERING ${attr('eng')} — you can do this with your eyes shut.</p><button data-a="remove">⚙ Remove the motor</button>`;
    if(R.stage===3) body = `<p>What goes in? Something that spins continuously at drive speed.</p>` +
      ['motor_micro','servo','motor_burnt'].map(id=>`<button data-a="fit:${id}" ${has(id)||id==='motor_burnt'?'':'disabled'}>${esc(ITEMS[id].name)}<small>${esc(ITEMS[id].props)}</small></button>`).join('');
    if(R.stage>=4){
      const off = R.align - R.target, verdict = R.tests===0 ? 'Not tested yet.' : off===0 ? '✅ It drives dead straight.' : `It veers ${off<0?'LEFT':'RIGHT'}${Math.abs(off)>3?' — a lot':''}.`;
      body = `<p>${esc(verdict)}</p>${R.stage===5?`<label>Wheel alignment <input type="range" min="-8" max="8" value="${R.align}" data-a="align"> <b>${R.align>0?'+':''}${R.align}</b></label>`:''}
        <button data-a="test">▶ Test it</button>${off===0 && R.tests>0 ? '<button data-a="finish" class="go">Done</button>' : ''}`;
    }
    panel('REPAIR — MRS. ODA’S DELIVERY BOT', `<ol class="sf-steps">${list}</ol>${body}`, act=>{
      if(act==='inspect'){ R.stage = 1; rxp(10, 'diagnosed a fault'); }
      else if(act==='open') R.stage = 2;
      else if(act==='remove'){ R.stage = 3; give('motor_burnt'); }
      else if(act && act.startsWith('fit:')){
        const id = act.slice(4);
        if(id==='servo'){ toast('A servo turns to an angle — it will not spin a wheel. Wrong part.'); return panelRepair(); }
        if(id==='motor_burnt'){ toast('That is the one you just took out.'); return panelRepair(); }
        take('motor_micro'); R.stage = 4; rxp(20, 'installed the motor');
      }
      else if(act && act.startsWith('align:')){ R.align = +act.slice(6); }
      else if(act==='test'){ R.tests++; if(R.stage===4) R.stage = 5; testDrive(R.align - R.target); closePanel(); return; }
      else if(act==='finish'){ closePanel(); rep = null; rxp(60, 'BUILD → TEST → ADJUST'); give('motor_micro');
        go('free', 'Autosaved');
        dialog([['REN','Straight as a laser. Mrs. Oda gets her groceries.'],['DAICHI','(from outside) Finally. Get your jacket. We’re going somewhere.'],
          ['REN','(a message buzzes on your phone: BOT NIGHT. MIDNIGHT. WAREHOUSE 17.)'],['REN','...We sure are.']]); return; }
      panelRepair();
    });
  }
  /* the bot drives across the floor, curving by how far out it is */
  let drive = null;
  function testDrive(off){
    const start = V(-0.8, 0.02, -2.2);
    bot.position.copy(start); bot.rotation.y = 0;
    drive = { t:0, off };
    say(off===0 ? 'Watch it go…' : 'Here it goes…');
  }

  function panelComputer(){
    panel('REN’S COMPUTER', `
      <h4>Schematics</h4><p>Delivery bot v3 · Prototype 14 (overheats) · "Something with legs??"</p>
      <h4>Notes</h4><p>Motor temp log: 91°C at 6 min. Need better cooling or less ambition. (Less ambition: no.)</p>
      <h4>City map</h4><p>Home — west end of Kōen Street. The market is under the noodle district. Warehouse 17 is the east end, past the docks road.</p>
      <h4>Invitations</h4><p>${S.found.underbed || S.step!=='call' ? 'BOT NIGHT. MIDNIGHT. WAREHOUSE 17. Knock twice.' : '(nothing new)'}</p>
      <h4>Experiments</h4><p>"Wheel alignment: if it veers left, the left wheel is toed in. Adjust right. Test. Adjust. Test."</p>`, null);
    if(!S.found.computer){ S.found.computer = true; rxp(10, 'read your own notes'); }
  }

  /* ============================================================= STREET */
  function street(amb, at){
    G.scene.background = new THREE.Color(0x070714);
    G.scene.fog = new THREE.Fog(0x0a0a1a, 20, 90);
    amb.color.setHex(0x4a4a7a); amb.intensity = 0.8;
    const L = 130;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(L, 9), std(0x15161c, 0.25, 0.4)); road.rotation.x = -Math.PI/2; group.add(road);
    for(let x=-L/2; x<L/2; x+=6) box(3, 0.02, 0.2, glowM(0xffd23d, 0.4), x, 0.01, 0);
    [-1,1].forEach(s=>{ const sw = new THREE.Mesh(new THREE.PlaneGeometry(L, 4), std(0x2a2a34, 0.4, 0.2)); sw.rotation.x = -Math.PI/2; sw.position.set(0, 0.05, s*6.5); group.add(sw); });
    G.ground = ()=>0;
    // the ends of the street
    G.solids.push({ x1:-L/2-2, x2:-L/2, z1:-20, z2:20, y1:-1, y2:30 }, { x1:L/2, x2:L/2+2, z1:-20, z2:20, y1:-1, y2:30 });
    // buildings both sides, lit windows, neon
    const neon = ['ラーメン RAMEN','BYTE BAZAAR ↓','24H ROBO PARTS','KARAOKE','カフェ CAFE','SFIT ← 3 km','PACHINKO','ドローン DRONES','NOODLES','HOTEL SAKURA'];
    const cols = ['#ff3fd0','#27e8ff','#ffd23d','#3ddc84','#ff8a3d','#c86bff'];
    let k = 0;
    for(const side of [-1, 1]) for(let x=-L/2+6; x<L/2-4; x+=13){
      const h = 12 + ((x*7+side*13)%11+11)%11*2, w = 11, d = 8;
      const z = side*(8.5 + d/2);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ map:windows(h), color:0xffffff }));
      wall.position.set(x, h/2, z); group.add(wall);
      G.solids.push({ x1:x-w/2, x2:x+w/2, z1:z-d/2, z2:z+d/2, y1:-1, y2:h });
      const txt = neon[k%neon.length], col = cols[k%cols.length]; k++;
      if(txt.indexOf('BYTE BAZAAR')<0) sign([txt], 5, 1.1, x, 4.5, side*8.4, side>0 ? Math.PI : 0, { w:512, h:112, bg:null, fg:col, glow:col, font:'bold 64px' });
      // awnings
      box(w-1, 0.1, 1.4, std(side>0?0x3a1030:0x10303a), x, 3.2, side*(8.5-0.7));
    }
    // street lights and the only lights that are real
    for(let x=-L/2+10; x<L/2; x+=26){ light(0xffb070, 30, 22, x, 6, -5); light(0xff5ab4, 18, 16, x+13, 5, 5);
      box(0.15, 6, 0.15, lam(0x222222), x, 3, -5.8); box(1.2, 0.15, 0.3, glowM(0xffe0b0, 1.5), x, 6, -5.4); }
    makeRain(2600, 60);
    // HOME — west end, north side
    const homeX = -L/2+8;
    sign(['⌂ HOME'], 2, 0.6, homeX, 3, -8.45, 0, { w:256, h:80, bg:'#101828', fg:'#8fd3ff', font:'bold 48px' });
    box(1.6, 2.6, 0.2, lam(0x6a4a30), homeX, 1.3, -8.4);
    thing(homeX, -7.3, 'Home', 'E — go inside', ()=>goScene('bedroom', false, 'door'));
    // BYTE BAZAAR — a stair down between two shops, south side
    const bzX = 12;
    sign(['BYTE BAZAAR ↓'], 6, 1.3, bzX, 4.8, 8.4, Math.PI, { w:640, h:140, bg:null, fg:'#27e8ff', glow:'#27e8ff', font:'bold 72px' });
    box(3, 0.1, 2, glowM(0x27e8ff, 0.8), bzX, 0.06, 7.6);
    thing(bzX, 7.2, 'BYTE BAZAAR', 'E — go down the stairs', ()=>{
      if(S.step==='street') go('market', 'Found: BYTE BAZAAR');
      goScene('market'); }, 2.2);
    // WAREHOUSE 17 — east end
    const whX = L/2-10;
    sign(['WAREHOUSE 17'], 5, 1, whX, 5, -8.45, 0, { w:512, h:100, bg:'#1a1a1a', fg:'#aaaaaa', font:'bold 60px' });
    box(4, 3.4, 0.25, std(0x3a3a3a, 0.6, 0.7), whX, 1.7, -8.4);
    thing(whX, -7.2, 'Warehouse 17', 'E — knock twice', ()=>{
      const ready = ['fight1','titan','done'].indexOf(S.step)>=0 || (S.step==='market' && builtRobot());
      if(!ready){ say(S.step==='market' || S.step==='street' ? 'A slot slides open. "No bot, no entry." — Build a robot at the Bazaar first.' : 'Nobody answers.'); return; }
      if(S.step==='market') go('fight1', 'Mission: BOT NIGHT');
      goScene('arena'); }, 2.2);
    // TRANSIT — a stop in the middle: fast travel
    sign(['🚊 SANFRAN TRANSIT'], 3, 0.7, -20, 3.2, 6.9, Math.PI, { w:512, h:120, bg:'#0a2a1a', fg:'#3ddc84', font:'bold 52px' });
    box(0.15, 3, 0.15, lam(0x333333), -21.4, 1.5, 6.9); box(0.15, 3, 0.15, lam(0x333333), -18.6, 1.5, 6.9);
    thing(-20, 6, 'Transit stop', 'E — ride', ()=>panelTransit(), 2);
    // the food vendor and the musician
    box(2.4, 1.1, 1, std(0xb8201c), -40, 0.55, 6.2, true); box(2.6, 0.1, 1.4, glowM(0xffd23d, 0.5), -40, 2.4, 6.2);
    sign(['おでん ODEN'], 2.2, 0.5, -40, 2.7, 6.2, Math.PI, { w:400, h:100, bg:null, fg:'#fff', glow:'#ff8a3d', font:'bold 56px' });
    person('theo', [[-40, 5.4]], 0, 'VENDOR: "Oden, hot! Or are you here about the batteries? Everyone is asking about that new battery prototype."');
    thing(-40, 5, 'Oden stand', 'E — talk', ()=>{ if(!S.talked.vendor){ S.talked.vendor = true; rxp(10, 'heard the street gossip'); }
      dialog([['VENDOR','Oden? No? Then what — you look like a kid with a robot problem.'],['REN','I look like a kid with a robot solution.'],
        ['VENDOR','Hah. The Bazaar’s under the noodle shops, east of here. Tell Mama Kiku I sent you. She’ll still overcharge you.']]); });
    person('zuri', [[26, -6]], 0, 'MUSICIAN: ♪ "…a thousand little machines, humming in the rain…" ♪');
    // pedestrians, with umbrellas
    const walkers = [['nia',0xff5ab4,'"Did you hear about the new battery prototype?"'],['sable',0x27e8ff,'"That robot delivery thing keeps crashing."'],
      ['kofi',0xffd23d,'"SFIT’s hosting another demonstration."'],['theo',0x3ddc84,'"My car drove me to the wrong district again."'],
      ['zuri',0xc86bff,'"Bot Night’s tonight, right? Warehouse something."'],['nia',0xff8a3d,null]];
    walkers.forEach((w,i)=>{ const z = (i%2 ? 1 : -1)*(5.8 + (i%3)*0.4), x0 = -50 + i*18;
      person(w[0], [[x0, z],[x0 + (i%2?40:-40), z]], 1.3 + (i%3)*0.2, w[2] ? 'PASSER-BY: '+w[2] : null, w[1]); });
    // traffic: cars and delivery bots
    for(let i=0;i<9;i++){
      const lane = i%2 ? 2 : -2, dir = i%2 ? 1 : -1, car = new THREE.Group();
      const col = [0xff3fd0,0x27e8ff,0xeeeeee,0x222222,0xffd23d][i%5];
      const b = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 1.9), std(col, 0.3, 0.6)); b.position.y = 0.75; car.add(b);
      const t = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.7), std(0x111122, 0.2, 0.8)); t.position.set(-0.2, 1.6, 0); car.add(t);
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 1.6), glowM(0xfff0c0, 2.5)); hl.position.set(2.02, 0.8, 0); car.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 1.6), glowM(0xff2020, 2)); tl.position.set(-2.02, 0.8, 0); car.add(tl);
      car.rotation.y = dir>0 ? 0 : Math.PI; group.add(car);
      const c = { g:car, x:-L/2 + i*15, lane, dir, sp:7 + (i%3)*3 };
      c.tick = dt=>{ c.x += c.dir*c.sp*dt; if(c.x > L/2+5) c.x = -L/2-5; if(c.x < -L/2-5) c.x = L/2+5; c.g.position.set(c.x, 0, c.lane); };
      actors.push(c);
    }
    for(let i=0;i<4;i++){
      const d = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.6), std(0xeeeeee)); b.position.y = 0.35; d.add(b);
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.05), glowM(0x27e8ff)); e.position.set(0, 0.45, 0.31); d.add(e);
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), glowM(0xff8a3d, 1.2)); f.position.set(0, 0.8, -0.2); d.add(f);
      group.add(d);
      const s = i%2 ? 7.4 : -7.4, c = { g:d, x:-40 + i*25, dir:i%2?1:-1 };
      c.tick = dt=>{ c.x += c.dir*1.8*dt; if(Math.abs(c.x) > 60) c.dir *= -1; c.g.position.set(c.x, 0, s); c.g.rotation.y = c.dir>0 ? Math.PI/2 : -Math.PI/2; };
      actors.push(c);
    }
    // a police drone overhead, and delivery drones
    const drone = new THREE.Group(); const db = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), std(0x222233)); drone.add(db);
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.12), glowM(0xff2020, 3)); red.position.set(-0.3, 0.2, 0); drone.add(red);
    const blue = new THREE.Mesh(new THREE.SphereGeometry(0.12), glowM(0x2060ff, 3)); blue.position.set(0.3, 0.2, 0); drone.add(blue);
    group.add(drone);
    actors.push({ tick(dt){ const t = clock*0.15; drone.position.set(Math.sin(t)*50, 11 + Math.sin(clock)*0.5, Math.cos(t*1.3)*4);
      red.visible = Math.floor(clock*4)%2===0; blue.visible = !red.visible; } });
    // where you come in
    if(at==='home') spawn(homeX, -6, Math.PI);
    else if(at==='market') spawn(bzX, 6.2, 0);
    else if(at==='arena') spawn(whX, -6, Math.PI);
    else if(at==='transit') spawn(-20, 5, Math.PI);
    else spawn(homeX, -6, Math.PI);
    if(streetIntro){ streetIntro = false; setTimeout(()=>dialog([['DAICHI','There you are. I’m getting oden — want some?'],['REN','Actually, I’m going to, uh… walk around.'],
      ['DAICHI','At midnight. In the rain.'],['REN','Fresh air.'],['DAICHI','Ren. Stay out of trouble.'],['REN','(the Bazaar first. A robot for Bot Night won’t build itself.)']]), 600); }
  }
  function windows(h){
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const x = c.getContext('2d'); x.fillStyle = '#12121c'; x.fillRect(0,0,64,128);
    for(let r=0;r<16;r++) for(let q=0;q<4;q++){ const on = Math.random() < 0.45;
      x.fillStyle = on ? (Math.random()<0.2 ? '#8fd3ff' : '#ffcf8a') : '#1c1c28'; x.fillRect(4+q*15, 4+r*8, 10, 5); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, h/12);
    return t;
  }
  function panelTransit(){
    const stops = [['home','Kōen St. — home', true], ['market','Noodle district — Byte Bazaar', !!S.found.bazaar || S.step!=='street'], ['arena','Docks road — Warehouse 17', true]];
    panel('SANFRAN TRANSIT', '<p>Fast travel along the line. Doors close in ten seconds.</p>' +
      stops.map(s=>`<button data-a="go:${s[0]}" ${s[2]?'':'disabled'}>🚊 ${esc(s[1])}</button>`).join('') +
      `<p class="sf-dim">The Institute line (SFIT) opens in Act 2.</p><button data-a="wano">🌏 Leave SANFRAN — back to Wano</button>`, act=>{
        if(act==='wano'){ closePanel(); leave(); return; }
        if(!act || !act.startsWith('go:')) return;
        closePanel();
        const to = act.slice(3);
        const where = to==='home' ? 'home' : to==='market' ? 'market' : 'arena';
        goScene('street', false, where);
      });
  }

  /* ============================================================= MARKET */
  const STOCK = [
    ['frame_light', 40], ['frame_heavy', 70], ['motor_sprint', 45], ['motor_torque', 55],
    ['power_liion', 35], ['power_supercap', 60], ['wpn_hammer', 40], ['wpn_spinner', 45], ['wpn_flipper', 40],
    ['ctl_gyro', 50], ['ctl_aim', 65], ['core_shield', 80], ['plating', 60, 1], ['camera', 20], ['sensor', 12], ['carbon', 30, 2]
  ];
  function market(amb){
    G.scene.background = new THREE.Color(0x07050c); G.scene.fog = new THREE.Fog(0x0a0610, 14, 40);
    amb.color.setHex(0x6a4a5a); amb.intensity = 0.8;
    const W = 34, D = 22, H = 5;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0x1c1a20, 0.5, 0.3)); floor.rotation.x = -Math.PI/2; group.add(floor);
    walls(W, D, H, lam(0x241c24)); box(W, 0.3, D, lam(0x120e14), 0, H, 0); G.ceiling = ()=>H;
    // pipes and strings of lanterns
    for(let z=-D/2+3; z<D/2; z+=5) box(W, 0.2, 0.2, std(0x3a3030, 0.4, 0.6), 0, H-0.4, z);
    for(let x=-W/2+3; x<W/2; x+=3){ const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), glowM([0xff3fd0,0xffd23d,0x27e8ff][Math.abs(x)%3|0], 1.5)); l.position.set(x, H-0.9, Math.sin(x)*2); group.add(l); }
    light(0xff6ab4, 24, 22, -8, 4, 0); light(0x27e8ff, 24, 22, 8, 4, 0);
    // stalls
    const stalls = [
      [-11, -7, 'MAMA KIKU — PARTS', '#ffd23d', 'theo', 'shop'],
      [0, -7, 'VOLT & BOLT — POWER', '#27e8ff', 'sable', 'shop'],
      [11, -7, 'CHROME DOC — MECHANIC', '#3ddc84', 'kofi', 'doc'],
      [-11, 6, 'THE WHISPER — INFO', '#c86bff', 'zuri', 'info'],
      [11, 6, 'HACK SHACK', '#ff8a3d', 'nia', 'hacker']
    ];
    stalls.forEach(s=>{
      box(6, 1.1, 1.6, std(0x3a2a24), s[0], 0.55, s[1] + (s[1]<0?1:-1)*0.2, true);
      box(6.4, 0.15, 2.4, glowM(new THREE.Color(s[3]).getHex(), 0.35), s[0], 3.1, s[1]);
      sign([s[2]], 5.6, 0.7, s[0], 3.6, s[1] + (s[1]<0?0.8:-0.8), s[1]<0 ? 0 : Math.PI, { w:720, h:100, bg:'#0c0a10', fg:s[3], glow:s[3], font:'bold 54px' });
      for(let i=0;i<5;i++) box(0.4, 0.3, 0.4, std([0x888888,0xb87333,0x333333][i%3], 0.4, 0.7), s[0]-2+i, 1.25, s[1] + (s[1]<0?1:-1)*0.2);
      person(s[4], [[s[0], s[1] + (s[1]<0?-0.9:0.9)]], 0, null);
      thing(s[0], s[1] + (s[1]<0?1.8:-1.8), s[2], 'E — talk', ()=>stall(s[5], s[2]), 2.4);
    });
    // the build bench, and the way back up
    box(4, 1, 1.6, std(0x5a4a3a), 0, 0.5, 6.5, true); box(4.2, 0.1, 1.8, glowM(0x3ddc84, 0.3), 0, 1.02, 6.5);
    sign(['🛠 BUILD BENCH'], 3, 0.6, 0, 2.4, 6.2, Math.PI, { w:512, h:100, bg:'#0a1a10', fg:'#3ddc84', font:'bold 52px' });
    thing(0, 5.2, 'Build bench', 'E — build a robot', ()=>panelBuild(), 2.2);
    box(3, 0.1, 2, glowM(0x27e8ff, 0.8), -W/2+2.5, 0.06, 0);
    thing(-W/2+2.5, 0, 'Stairs up', 'E — back to the street', ()=>goScene('street', false, 'market'), 2.2);
    // punters milling about
    person('nia', [[-6,0],[6,0]], 1.1, 'PUNTER: "Bot Night odds are up. Nobody’s beaten the Titan in a month."');
    person('kofi', [[4,3],[-8,-2]], 0.9, 'PUNTER: "Chrome Doc fixed my servo with gum. It still works."');
    if(!S.found.bazaar){ S.found.bazaar = true; rxp(30, 'found the underground market'); }
    spawn(-W/2+4, 0, -Math.PI/2);
  }
  function stall(kind, name){
    if(kind==='shop') return panelShop(name);
    if(kind==='doc') return dialog([['CHROME DOC','New face. You fix things?'],['REN','I build things.'],['CHROME DOC','Everyone builds. Fixing is the job. Bring me a burnt motor and I’ll give you copper for it.']], ()=>{
      if(has('motor_burnt')){ take('motor_burnt'); give('copper', 3); rxp(10, 'traded scrap for parts'); save(); toast('Traded the burnt motor for 3 copper wire.'); } });
    if(kind==='info') return dialog([['THE WHISPER','The Titan. Big, slow, armour like a bank vault.'],['THE WHISPER','Hit it in the face and you’re just tickling it.'],
      ['THE WHISPER','But a scanner sees things fists don’t. Press F in the ring and read what it tells you.']], ()=>{ if(!S.talked.whisper){ S.talked.whisper = true; rxp(15, 'bought a rumour'); } });
    if(kind==='hacker') return dialog([['HACK SHACK','Aim chips. Flashed in-house. You’d need to know what a PID loop is.'],
      ['REN', attr('prog')>=2 ? 'Proportional, integral, derivative.' : 'A… PIE loop?'],
      ['HACK SHACK', attr('prog')>=2 ? 'Oh, you’re real. Mama Kiku will sell you one.' : 'Come back when you’ve got PROGRAMMING 2.']]);
  }
  function panelShop(name){
    const rows = STOCK.map(([id, price, repNeed])=>{
      const it = ITEMS[id], part = SFBOTS.find(id);
      const lockRep = repNeed && S.rep < repNeed, lockAttr = part && !meets(part.need) || (id==='plating' && attr('mat')<2);
      const why = lockRep ? `🔒 reputation ${repNeed}` : lockAttr ? '🔒 '+Object.entries((part&&part.need)||{mat:2}).map(([k,v])=>ATTRS.find(a=>a[0]===k)[1]+' '+v).join(', ') : '';
      return `<div class="sf-row"><div><b>${esc(it.name)}</b> <span class="sf-dim">${esc(it.cat)} · ${esc(it.rarity)} · ${it.weight} kg</span><br><small>${esc(it.desc)}</small><br><small class="sf-dim">${esc(it.props)} · fits: ${esc(it.compat)}</small></div>
        <div>${why ? `<span class="sf-lock">${esc(why)}</span>` : `<button data-a="buy:${id}:${price}" ${S.credits<price?'disabled':''}>¥${price}</button>`}${has(id)?`<small class="sf-dim">own ${S.inv[id]}</small>`:''}</div></div>`;
    }).join('');
    panel(name, `<p>You have <b>¥${S.credits}</b> · reputation ${S.rep}</p>${rows}`, act=>{
      if(!act || !act.startsWith('buy:')) return;
      const [, id, p] = act.split(':'); const price = +p;
      if(S.credits < price) return;
      S.credits -= price; give(id); save(); toast('Bought '+ITEMS[id].name);
      if(!S.talked['bought_'+id]){ S.talked['bought_'+id] = true; rxp(5, 'new component'); }
      panelShop(name);
    });
  }

  /* ------------------------------------------------------ the robot build */
  const builtRobot = () => SFBOTS.SLOTS.every(s=>S.robot[s] && has(S.robot[s]));
  function panelBuild(){
    const st = SFBOTS.stats(Object.assign({ plating: !!S.robot.plating && has('plating') }, S.robot));
    const slots = SFBOTS.SLOTS.map(slot=>{
      const opts = SFBOTS.PARTS[slot].filter(p=>has(p.id));
      return `<div class="sf-slot"><b>${slot.toUpperCase()}</b>` + (opts.length ? opts.map(p=>{
        const ok = meets(p.need);
        return `<button data-a="pick:${slot}:${p.id}" class="${S.robot[slot]===p.id?'on':''}" ${ok?'':'disabled'} title="${esc(p.desc)}">${esc(p.name)}${ok?'':' 🔒'}</button>`;
      }).join('') : '<span class="sf-dim">none owned — Mama Kiku sells these</span>') + '</div>';
    }).join('');
    const bar = (label, v, max) => `<div class="sf-stat"><span>${label}</span><i style="width:${Math.min(100, v/max*100)}%"></i><b>${Math.round(v*10)/10}</b></div>`;
    panel('BUILD BENCH — '+(S.robot.name||'UNNAMED BOT'), `
      <p>Six parts. Choose, and watch what changes.</p>${slots}
      ${has('plating') ? `<label><input type="checkbox" data-a="plating" ${S.robot.plating?'checked':''}> Bolt on reinforced plating (+30 armour, +4 kg)</label>` : ''}
      <div class="sf-stats">${bar('CORE HP', st.core, 140)}${bar('ARMOUR', st.armor, 130)}${bar('MOTOR HP', st.motor, 70)}${bar('SPEED', st.speed, 9)}${bar('TURN', st.turn, 5)}${bar('POWER', st.cap, 130)}${bar('DAMAGE', st.dmg, 14)}${bar('WEIGHT', st.weight, 24)}</div>
      <label>Name <input maxlength="18" value="${esc(S.robot.name||'')}" data-a="name" placeholder="PROTOTYPE 15"></label>
      <p class="sf-dim">${builtRobot() ? '✅ Ready to fight. Warehouse 17 is at the east end of the street.' : 'Every slot needs a part.'}</p>`, act=>{
      if(!act) return;
      if(act.startsWith('pick:')){ const [, slot, id] = act.split(':'); S.robot[slot] = id;
        if(builtRobot() && !S.flags.firstBuild){ S.flags.firstBuild = true; rxp(80, 'built your first combat robot'); } save(); }
      if(act.startsWith('plating:')) S.robot.plating = act.slice(8)==='true';
      if(act.startsWith('name:')){ S.robot.name = act.slice(5).slice(0,18); save(); return; }
      panelBuild();
    });
  }

  /* ============================================================== ARENA */
  let arenaCam = null;
  function arena(amb){
    G.scene.background = new THREE.Color(0x050508); G.scene.fog = new THREE.Fog(0x08080c, 20, 60);
    amb.color.setHex(0x5a5a6a); amb.intensity = 0.7;
    const W = 44, D = 44, H = 12;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0x1a1a1e, 0.7, 0.2)); floor.rotation.x = -Math.PI/2; group.add(floor);
    walls(W, D, H, lam(0x2a2a2e)); G.ceiling = ()=>H;
    // the ring: a steel disc with hazard edges, a cage rail round it
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 0.3, 48), std(0x3a3a40, 0.35, 0.8)); ring.position.set(0, 0.15, 0); group.add(ring);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(13, 0.15, 8, 64), glowM(0xffd23d, 1.2)); edge.rotation.x = Math.PI/2; edge.position.set(0, 0.32, 0); group.add(edge);
    for(let i=0;i<24;i++){ const a = i/24*Math.PI*2; box(0.15, 1.8, 0.15, std(0x666666, 0.4, 0.8), Math.sin(a)*13.4, 0.9, Math.cos(a)*13.4); }
    light(0xffffff, 60, 30, 0, 10, 0); light(0xff3040, 20, 24, -10, 5, 8); light(0x27e8ff, 20, 24, 10, 5, 8);
    sign(['⚡ BOT NIGHT ⚡'], 10, 2, 0, 8.5, -D/2+0.2, 0, { w:900, h:180, bg:null, fg:'#ff3fd0', glow:'#ff3fd0', font:'bold 110px' });
    // the crowd
    const cast = ['nia','sable','kofi','theo','zuri'];
    for(let i=0;i<14;i++){ const a = Math.PI*0.2 + i/13*Math.PI*1.6; person(cast[i%5], [[Math.sin(a)*16, -Math.cos(a)*16]], 0, null); }
    // the announcer, and the way out
    person('kofi', [[5, 16]], 0, null);
    thing(5, 15, 'Announcer — "MC VOLT"', 'E — talk', ()=>announcer(), 2.2);
    box(3, 0.1, 2, glowM(0x27e8ff, 0.8), 0, 0.06, D/2-2);
    thing(0, D/2-2, 'Door', 'E — back to the street', ()=>goScene('street', false, 'arena'), 2.2);
    spawn(0, D/2-4, 0);
    arenaCam = null;
    setTimeout(()=>{ if(scene==='arena' && S.step==='fight1' && !S.flags.mcIntro){ S.flags.mcIntro = true; announcer(); } }, 700);
  }
  function announcer(){
    if(S.step==='fight1') return dialog([['MC VOLT','LADIES, GENTS AND ASSORTED MACHINES! A NEW KID!'],['MC VOLT','Your bot vs BRUISER. Two hundred kilos of bad attitude.'],
      ['MC VOLT','Tip, kid: he charges when his eye flashes white. Dodge with Q. Get behind him while he’s stopping.']], ()=>startFight('bruiser'));
    if(S.step==='titan') return dialog([['MC VOLT','The kid beat Bruiser! Feeling lucky?'],['MC VOLT','THE TITAN. Undefeated in thirty-one fights.'],
      ['REN','Everything has a weak point.'],['MC VOLT','Then go find it!']], ()=>startFight('titan'));
    if(S.step==='done') return dialog([['MC VOLT','The Titan-killer! You’re welcome back any night, kid.']]);
    dialog([['MC VOLT','No bot, no fight. Build one at the Bazaar.']]);
  }

  /* ---------------------------------------------------------- fighting */
  function startFight(foeId){
    if(!builtRobot()){ say('Your robot is missing parts — finish it at the build bench.'); return; }
    fighting = true; G.running = false;
    const build = Object.assign({ plating: !!S.robot.plating && has('plating') }, S.robot);
    const F = SFBOTS.start({ group, camera:G.camera, fightOver, scan }, build, foeId);
    // the ring sits at z=-6 in the arena; move the fight there
    $('#sf').classList.add('fight');
    if(document.pointerLockElement) document.exitPointerLock();
    if(window.AVATAR) AVATAR.detach();
    fightHud(true);
    toast(foeId==='bruiser' ? 'WASD drive · SPACE attack · SHIFT block · Q dodge · F scan' : 'Scan first (F). Find the weak point.');
  }
  function scan(F){
    const lines = F.foe.scan.slice(0, attr('ana') >= 2 ? 3 : 2);
    if(attr('ana') < 2 && F.foeId==='titan') lines.push('(Something about one of its motors is off — ANALYSIS 2 would tell you what.)');
    F.log = lines;
    if(!S.talked['scan_'+F.foeId]){ S.talked['scan_'+F.foeId] = true; rxp(25, 'scanned '+F.foe.name); }
  }
  function fightOver(result, F){
    setTimeout(()=>{
      fighting = false; SFBOTS.stop(); fightHud(false);
      $('#sf').classList.remove('fight');
      if(window.AVATAR) AVATAR.attach();
      G.running = true;
      goScene('arena');
      if(result==='win'){
        const r = F.foe.reward; S.credits += r.credits; S.rep += r.rep;
        rxp(r.rxp, 'beat '+F.foe.name);
        const g = F.goals, missed = Object.keys(g).filter(k=>!g[k]);
        if(F.foeId==='bruiser'){
          give('scrap', 4); give('sensor');
          go('titan', 'Mission complete: beat BRUISER');
          dialog([['MC VOLT','BRUISER IS DOWN! The kid’s got something!'],['REN','(Won ¥'+r.credits+'. Reputation up — Mama Kiku will sell you more now.)'],
            ...(missed.length ? [['REN','(Next time: '+missed.map(k=>({move:'move',attack:'attack',dodge:'dodge',block:'block',scan:'scan',rear:'hit it from behind'})[k]).join(', ')+'.)']] : []),
            ['MC VOLT','Want the big one? Talk to me when you’re ready for THE TITAN.']]);
        } else {
          give('carbon'); give('camera');
          go('done', 'Mission complete: THE TITAN');
          endOfAct();
        }
      } else {
        dialog([['MC VOLT','Ohhh, and the kid’s bot is SCRAP!'],['REN','(Rebuild at the Bazaar, or try again — talk to MC Volt.)'],
          ...(F.foeId==='titan' ? [['REN','(Hitting its armour does nothing. Where did the scan say it was weak?)']] : [['REN','(Dodge the white-eyed charge with Q, then hit it from behind.)']])]);
        rxp(20, 'learned from a loss');
      }
    }, 1600);
  }
  function endOfAct(){
    dialog([['MC VOLT','THE TITAN… IS… DOWN!'],['REN','(The crowd goes wild. And then it goes quiet.)'],['DAICHI','Ren.'],
      ['REN','Daichi. I can explain. I won, which I feel is the important part.'],['DAICHI','I watched. You went for its right motor. Every time.'],
      ['REN','It had a cracked housing. It was running hot. Obvious.'],['DAICHI','It wasn’t obvious to anyone else in here.'],
      ['DAICHI','You could actually build something.'],['REN','I just did.'],['DAICHI','No. You built something that breaks.'],
      ['DAICHI','Come to the Institute tomorrow. Just look. That’s all I ask.'],['REN','...Fine. But I’m bringing my robot.']], ()=>{
        panel('ACT 1 — THE UNDERGROUND', `<p class="sf-big">COMPLETE</p>
          <p>Tech level <b>${S.lvl}</b> · Research XP <b>${S.rxp}</b> · ¥${S.credits} · reputation ${S.rep}</p>
          <p>ACT 2 — THE INSTITUTE — is coming next: SFIT, the team, the workshop sandbox and the microbots.</p>
          <p class="sf-dim">Your save is kept. The street, the Bazaar and Bot Night stay open.</p>`, null);
        save('Autosaved — Act 1 complete');
      });
  }

  /* ================================================================== UI
     Minimal and in the corners, as the brief asks: Ren top left, MIKA top
     right (offline until Act 3), the mission bottom left, the tool bottom
     right. Dialogue at the bottom, panels in the middle. */
  let el = null;
  function ui(){
    if(!el){
      el = document.createElement('div'); el.id = 'sf';
      el.innerHTML = `
        <div class="sf-tl"><b>REN</b><div class="sf-bar"><i id="sfHp" style="width:100%"></i></div><small id="sfLvl"></small></div>
        <div class="sf-tr"><b>MIKA</b><small>OFFLINE</small></div>
        <div class="sf-bl"><small id="sfMission"></small><div id="sfObj"></div></div>
        <div class="sf-br"><small>TOOL</small><div id="sfTool">SOLDERING IRON</div><small class="sf-dim">E — interact · I — notebook</small></div>
        <div class="sf-prompt hidden" id="sfPrompt"></div>
        <div class="sf-say hidden" id="sfSay"></div>
        <div class="sf-dlg hidden" id="sfDlg"><b></b><p></p><small>SPACE / E — next</small></div>
        <div class="sf-toasts" id="sfToasts"></div>
        <div class="sf-panel hidden" id="sfPanel"><div class="sf-ph"><b></b><button class="sf-x">✕</button></div><div class="sf-pb"></div></div>
        <div class="sf-fight hidden" id="sfFight"></div>`;
      document.body.appendChild(el);
      el.querySelector('.sf-x').onclick = closePanel;
      const pb = el.querySelector('.sf-pb');
      pb.addEventListener('click', e=>{ const b = e.target.closest('[data-a]'); if(!b || b.tagName==='INPUT') return; if(panelCb) panelCb(b.dataset.a); });
      pb.addEventListener('input', e=>{ const i = e.target; if(!i.dataset.a || !panelCb) return;
        if(i.type==='range'){ const b = i.parentElement.querySelector('b'); if(b) b.textContent = (i.value>0?'+':'')+i.value; return; }
        if(i.type==='checkbox') panelCb(i.dataset.a+':'+i.checked);
        else if(i.dataset.a==='name') panelCb('name:'+i.value); });
      pb.addEventListener('change', e=>{ const i = e.target; if(i.type==='range' && i.dataset.a && panelCb) panelCb(i.dataset.a+':'+i.value); });
      pb.addEventListener('keydown', e=>e.stopPropagation());
    }
    el.classList.remove('hidden');
    hud();
  }
  function hud(){
    if(!el) return;
    const st = STEPS[S.step] || STEPS.call;
    el.querySelector('#sfMission').textContent = st.mission;
    el.querySelector('#sfObj').textContent = st.obj;
    el.querySelector('#sfLvl').textContent = `TECH LV ${S.lvl} · RXP ${S.rxp}/${need(S.lvl)} · ¥${S.credits}`;
    el.querySelector('#sfTool').textContent = fighting ? 'SCANNER (F)' : scene==='market' ? 'WALLET' : 'SOLDERING IRON';
  }
  function toast(msg){
    if(!el) return;
    const d = document.createElement('div'); d.textContent = msg; el.querySelector('#sfToasts').appendChild(d);
    setTimeout(()=>d.remove(), 3600);
  }
  function say(text){
    if(!el) return;
    const s = el.querySelector('#sfSay'); s.textContent = text; s.classList.remove('hidden'); bubbleT = 5;
  }
  /* dialogue: a queue of [who, line]; SPACE or E advances */
  let dlgQ = null, dlgDone = null;
  function dialog(lines, done){
    dlgQ = lines.slice(); dlgDone = done || null; busy = 'dialog'; G.running = fighting ? false : false;
    nextLine();
  }
  function nextLine(){
    const d = el.querySelector('#sfDlg');
    if(!dlgQ || !dlgQ.length){ d.classList.add('hidden'); dlgQ = null; busy = null; if(!fighting) G.running = true;
      const cb = dlgDone; dlgDone = null; if(cb) cb(); return; }
    const [who, line] = dlgQ.shift();
    d.querySelector('b').textContent = who; d.querySelector('p').textContent = line; d.classList.remove('hidden');
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
    if(busy==='panel'){ busy = null; if(!fighting){ G.running = true; lockPointer($('#view')); } }
  }
  /* the notebook: inventory, Ren's attributes, the robot */
  function notebook(tab){
    tab = tab || 'inv';
    const tabs = `<div class="sf-tabs">${[['inv','INVENTORY'],['ren','REN'],['bot','ROBOT']].map(t=>`<button data-a="tab:${t[0]}" class="${tab===t[0]?'on':''}">${t[1]}</button>`).join('')}</div>`;
    let body = '';
    if(tab==='inv'){
      const cats = ['Raw materials','Electronics','Robotics','Experimental'];
      body = cats.map(c=>{
        const items = Object.keys(S.inv).filter(id=>S.inv[id]>0 && ITEMS[id] && ITEMS[id].cat===c);
        return `<h4>${c.toUpperCase()}</h4>` + (items.length ? items.map(id=>{ const it = ITEMS[id];
          return `<div class="sf-row"><div><b>${esc(it.name)}</b> ×${S.inv[id]} <span class="sf-dim">${esc(it.rarity)} · ${it.weight} kg · ¥${it.value}</span><br><small>${esc(it.desc)}</small><br><small class="sf-dim">${esc(it.props)} · fits: ${esc(it.compat)}</small></div></div>`; }).join('') : '<p class="sf-dim">—</p>');
      }).join('');
    } else if(tab==='ren'){
      body = `<p>Tech level <b>${S.lvl}</b> · Research XP ${S.rxp}/${need(S.lvl)} · points to spend: <b>${S.pts}</b></p>` +
        ATTRS.map(a=>`<div class="sf-row"><div><b>${a[1]}</b> ${'▮'.repeat(attr(a[0]))}${'▯'.repeat(Math.max(0,10-attr(a[0])))} <b>${attr(a[0])}</b><br><small class="sf-dim">${esc(a[2])}</small></div>
          <div>${S.pts>0 && attr(a[0])<10 ? `<button data-a="up:${a[0]}">+1</button>` : ''}</div></div>`).join('') +
        `<p class="sf-dim">What they unlock: ENGINEERING 2 repairs motors. PROGRAMMING 2 flashes the auto-aim chip. MATERIAL SCIENCE 2 heat-treats plating and a shielded core. ENERGY 2 wires a supercapacitor. ANALYSIS 2 reads a weakness off a scan.</p>`;
    } else {
      const st = SFBOTS.stats(Object.assign({ plating: !!S.robot.plating && has('plating') }, S.robot));
      body = `<p><b>${esc(S.robot.name||'UNNAMED BOT')}</b> ${builtRobot() ? '— ready' : '— incomplete (build bench at the Bazaar)'}</p>` +
        SFBOTS.SLOTS.map(s=>`<div class="sf-row"><div><b>${s.toUpperCase()}</b></div><div>${esc(S.robot[s] ? ITEMS[S.robot[s]].name : '—')}</div></div>`).join('') +
        `<p class="sf-dim">Core ${st.core} · armour ${st.armor} · motors ${st.motor} each · weapon ${st.weapon} · speed ${st.speed.toFixed(1)} · power ${st.cap}</p>`;
    }
    body += `<p><button data-a="wano">🌏 Leave SANFRAN — back to Wano (progress is saved)</button></p>`;
    panel('REN’S NOTEBOOK', tabs + body, act=>{
      if(!act) return;
      if(act==='wano'){ closePanel(); leave(); return; }
      if(act.startsWith('tab:')) return notebook(act.slice(4));
      if(act.startsWith('up:') && S.pts>0){ S.attrs[act.slice(3)]++; S.pts--; save(); toast(ATTRS.find(a=>a[0]===act.slice(3))[1]+' up'); return notebook('ren'); }
    });
  }
  function fightHud(show){
    const f = el.querySelector('#sfFight');
    f.classList.toggle('hidden', !show);
  }
  function paintFight(){
    const F = SFBOTS.fight; if(!F) return;
    const bars = (u, name) => {
      const row = (k, label) => `<div class="sf-stat"><span>${label}</span><i style="width:${Math.max(0,u.hp[k]/u.max[k]*100)}%"></i></div>`;
      return `<div class="sf-fc"><b>${esc(name)}</b>${row('core','CORE')}${row('armor','ARMOUR')}${row('lmotor','L MOTOR')}${row('rmotor','R MOTOR')}${row('weapon','WEAPON')}
        ${u===F.P ? `<div class="sf-stat heat"><span>HEAT</span><i style="width:${Math.min(100,u.heat)}%"></i></div><div class="sf-stat pow"><span>POWER</span><i style="width:${u.power/u.s.cap*100}%"></i></div>${u.stall?'<em>OVERHEATED</em>':''}` : ''}</div>`;
    };
    const g = F.goals;
    const goals = F.foeId==='bruiser' ? `<div class="sf-goals">${[['move','Move'],['attack','Attack'],['dodge','Dodge (Q)'],['block','Block (SHIFT)'],['scan','Observe (F)'],['rear','Hit it from behind']].map(([k,l])=>`<span class="${g[k]?'ok':''}">${g[k]?'✔':'○'} ${l}</span>`).join('')}</div>` : '';
    el.querySelector('#sfFight').innerHTML = bars(F.P, S.robot.name || 'YOUR BOT') + bars(F.E, F.foe.name) + goals +
      (F.log.length ? `<div class="sf-scan">${F.log.map(l=>'<div>🔍 '+esc(l)+'</div>').join('')}</div>` : '');
  }

  /* ============================================================== frame */
  function nearest(){
    let best = null, bd = Infinity;
    things.forEach(t=>{ const d = Math.hypot(G.pos.x-t.x, G.pos.z-t.z); if(d < t.r && d < bd){ bd = d; best = t; } });
    return best;
  }
  let fightPaintT = 0;
  function tick(dt){
    if(!on) return;
    clock += dt;
    actors.forEach(a=>a.tick(dt));
    if(rain){
      rain.pts.position.set(G.pos.x, 0, G.pos.z);
      const P = rain.pts.geometry.attributes.position, A = P.array;
      for(let i=1;i<A.length;i+=3){ A[i] -= 22*dt; if(A[i] < 0) A[i] += 20; }
      P.needsUpdate = true;
    }
    if(bubbleT > 0){ bubbleT -= dt; if(bubbleT <= 0) el.querySelector('#sfSay').classList.add('hidden'); }
    if(drive){
      drive.t += dt;
      const k = drive.t, curve = drive.off*0.09;
      bot.rotation.y = curve*k;
      bot.position.x = -0.8 + Math.sin(curve*k)*k*0.9/Math.max(0.001, curve*k || 1)*(curve ? curve*k : 0) + (curve ? 0 : 0);
      bot.position.x = -0.8 + (curve ? (1-Math.cos(curve*k))/curve*0.9 : 0);
      bot.position.z = -2.2 + (curve ? Math.sin(curve*k)/curve*0.9 : k*0.9);
      bot.position.y = 0.02;
      if(k > 3.2){ drive = null; setTimeout(()=>{ bot.position.set(-0.8, 1.05, -3.2); bot.rotation.y = 0; panelRepair(); }, 400); }
    }
    if(objective && S.step==='call'){
      if(G.keys.KeyW||G.keys.KeyA||G.keys.KeyS||G.keys.KeyD) objective.moved = true;
      if(!G.onGround) objective.jumped = true;
      if(objective.moved && objective.jumped){ objective = null; rxp(10, 'stretched your legs'); go('repair', 'Autosaved'); }
    }
    if(fighting){
      SFBOTS.tick(dt);
      fightPaintT -= dt; if(fightPaintT <= 0){ fightPaintT = 0.1; paintFight(); }
      return;
    }
    // what E does here
    const pr = el.querySelector('#sfPrompt');
    const n = busy ? null : nearest();
    if(n){ pr.innerHTML = `${esc(n.label)} <b>${esc(typeof n.verb==='function' ? n.verb() : n.verb)}</b>`; pr.classList.remove('hidden'); }
    else pr.classList.add('hidden');
  }
  function key(e){
    if(!on) return false;
    if(fighting && !busy) return SFBOTS.key(e, true);
    if(busy==='dialog'){ if(e.code==='Space' || e.code==='KeyE' || e.code==='Enter'){ nextLine(); } return true; }
    if(busy==='panel'){ if(e.code==='Escape' || e.code==='KeyI'){ closePanel(); } return true; }
    if(e.code==='KeyE'){ const n = nearest(); if(n){ n.act(); return true; } return false; }
    if(e.code==='KeyI'){ notebook(); return true; }
    return false;
  }
  function keyup(e){ if(on && fighting) SFBOTS.key(e, false); }
  addEventListener('keyup', keyup);

  function stopFight(){ if(fighting){ fighting = false; SFBOTS.stop(); fightHud(false); if(el) el.classList.remove('fight'); } }

  return { enter, leave, tick, key,
           get active(){ return on; }, get busy(){ return busy; }, get fighting(){ return fighting; },
           get state(){ return S; }, get scene(){ return scene; },
           /* for tests and the console */
           get _repair(){ return rep; }, _go:goScene, _step:go, _fight:startFight, _give:give, _reset:()=>{ S = fresh(); save(); } };
})();
