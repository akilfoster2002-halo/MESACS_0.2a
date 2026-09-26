/* =====================================================================
   A CHAT ROOM — a place a player owns inside KORO, stood up in the browser
   from what the server says it is (server/chatrooms.js) out of the parts
   koro-godot/data/chatrooms.json lists: a floor, four walls, a ceiling or
   the sky, the lights, and the things in it — furniture to sit on, a
   jukebox, a TV, arcade cabinets, a robot that runs a program made of
   Koro's own blocks, and a portal home.

   IT IS THE SAME ROOM AS THE GODOT GAME'S. Same server, same database, same
   catalogue, same socket room (`cr:<id>`), and — the part that takes care —
   the same presence. koro-godot stands a room on the north pole of a big
   bare ball and reports where you are as a longitude and a latitude on it;
   the browser stands the room flat, because that is what the browser's
   rooms are. So the two numbers are converted at the wire rather than
   anywhere else (`toWire`/`fromWire` below), and a student in Godot and a
   student in a browser walk round each other's furniture.

   WHAT IT IS AND WHAT IS HAPPENING IN IT ARE KEPT APART. `room` is the
   saved room — only its owner changes it, through the editor and a Save the
   server checks. `state` is the live half: which switch is down, which track
   is on, when the robot was set going, the best score on a cabinet. Every
   change goes to the server and comes back to everybody inside, and
   somebody who walks in later is handed the room as it stands.
   ===================================================================== */
window.CHATROOM = (function(){
  const V = (x,y,z)=>new THREE.Vector3(x,y,z);
  const $ = s=>document.querySelector(s);

  /* THE BALL A GODOT CHAT ROOM STANDS ON (koro-godot Worlds.chatroom): two
     kilometres across and flat, with the room at its north pole and the
     room's own axes lined up with the world's. That is the whole of what the
     browser needs to read Godot's numbers, and it is why this constant is
     here rather than anywhere prettier. */
  const BALL = 2000;

  let on = false;
  let room = null, serverId = '', cat = null;
  let group = null, sh = null;                 // the room group and its shell handles
  let objects = [];                            // the saved objects, in order: what Save sends
  let env = {};
  const nodes = new Map();                     // id -> the object's holder
  const state = new Map();                     // id -> live state
  let lightsOn = true, skew = 0, clock = 0;
  let arcade = null;                           // the cabinet you are playing
  let trial = null;                            // a program being tried out in the editor
  const others = new Map();
  let seat = null;                             // what you are sitting on
  let sent = 0, back = null;                   // where to put you when you leave
  let sky = null;
  let handy = null;            // the thing in reach, when the crosshair is on nothing

  const W = ()=> (sh ? sh.W : 20), D = ()=> (sh ? sh.D : 20), H = ()=> (sh ? sh.H : 7);
  const now = ()=> Date.now()/1000 + skew;
  const spec = type => (cat && cat.objects && cat.objects[type]) || null;
  const record = id => objects.find(o=>o.id===id) || null;
  const mine = ()=> !!(room && room.mine);

  /* ------------------------------------------------------------ the wire
     Room metres both ways. The browser walks in plain x/y/z; koro-godot
     reads the same spot as a direction on its ball. Nothing else in either
     game needs to know that the other exists. */
  function toWire(x, y, z){
    const r = Math.hypot(x, BALL+y, z);
    const dir = { x:x/r, y:(BALL+y)/r, z:z/r };
    return { lon: Math.atan2(dir.x, dir.z)*180/Math.PI,
             lat: Math.asin(Math.max(-1,Math.min(1,dir.y)))*180/Math.PI,
             alt: r - BALL };
  }
  function fromWire(lon, lat, alt){
    const lo = lon*Math.PI/180, la = lat*Math.PI/180;
    const r = BALL + (+alt||0);
    return { x: Math.cos(la)*Math.sin(lo)*r,
             y: Math.sin(la)*r - BALL,
             z: Math.cos(la)*Math.cos(lo)*r };
  }

  /* ---------------------------------------------------------- the catalog
     What a room may be made of, asked of the server once. The editor and the
     builder both read it, and it is the same file koro-godot builds from. */
  async function catalog(){
    if(cat) return cat;
    const j = await NET.roomCatalog();
    cat = j.catalog;
    return cat;
  }

  /* ============================================================== arriving */
  async function enter(r, server){
    await catalog();
    if(window.PLANET && PLANET.active){ back = PLANET.lastWorld(); PLANET.leave(); }
    else if(!back) back = 'hub';
    if(window.AVATAR){ AVATAR.posture(null); if(AVATAR.setCast) AVATAR.setCast(null); }
    if(window.CLUB) CLUB.stop();
    room = r; serverId = server || ('cr:'+r.id);
    objects = JSON.parse(JSON.stringify(r.objects||[]));
    env = Object.assign({}, r.env||{});
    on = true;
    /* Whatever full-screen card was up — the title, the mission grid, sign-in
       — is not up any more: you are standing in a room. A card left over the
       top is a black screen with a room behind it. */
    if(window.MENU && MENU.hideAll) MENU.hideAll();
    state.clear();
    lightsOn = true;
    arcade = null; trial = null; seat = null;
    build();
    G.room = 'room';
    G.running = true;
    G.firstPerson = false;
    G.camera.up.set(0,1,0);
    G.camera.near = 0.1; G.camera.far = 400; G.camera.updateProjectionMatrix();
    spawn();
    if(window.AVATAR) AVATAR.attach();
    G.scene.updateMatrixWorld(true);
    $('#hud').classList.remove('hidden');
    /* The desktop minimap belongs to the mission rooms: a chat room is twenty
       metres across with everything in it already on screen, and an empty
       black square in the corner is furniture nobody asked for. */
    const map = $('#mapwrap'); if(map) map.classList.add('hidden');
    hud();
    /* The socket is the game's, not the world's: joining `cr:<id>` is a
       message, not a reconnect, and the chat carries on. */
    if(window.NET && NET.signedIn){
      NET.connect(serverId, {
        players:list=>paint(list),
        objs:()=>{},
        chat:m=>CHAT.line(m.from, m.text, m.id),
        sys:s=>CHAT.sys(s),
        clear:q=>CHAT.clear(q),
        unsay:id=>CHAT.remove(id)
      });
      CHAT.show();
    }
    if(window.ROOMS) ROOMS.close();
    lockPointer($('#view'));
  }

  /* Out of the room, back to the ball you came from. `why` is said there —
     a room you were sent out of owes you the reason. */
  function leave(why){
    if(!on) return;
    on = false;
    stand();
    jukeStop();
    if(window.MUSIC) MUSIC.stop();
    others.forEach(o=>{ if(o.g.parent) o.g.parent.remove(o.g); });
    others.clear();
    nodes.clear();
    if(sky){ G.scene.background = null; sky = null; }
    G.scene.fog = null;
    const to = back || 'hub';
    back = null;
    const sv = (window.NET && window.PLANET) ? PLANET.server : null;
    if(window.PLANET) PLANET.enter(sv, to);
    if(why) toast(why);
  }
  function toast(msg){
    if(window.CHAT && CHAT.sys) CHAT.sys(msg);
  }

  /* Where you come in: in front of the way out, facing into the room — so
     the first thing you see is the room and the first thing behind you is
     the door. */
  function spawn(){
    let best = null;
    for(const [id,h] of nodes){
      if(h.userData.type!=='portal') continue;
      const o = record(id);
      const to = (o && o.props && o.props.to) || '';
      if(to==='' || !best) best = h;
    }
    let at = V(0, 0, D()/2 - 3), face = V(0,0,-1);
    if(best){
      const front = V(0,0,1).applyAxisAngle(V(0,1,0), best.rotation.y);
      at = best.position.clone().add(front.clone().multiplyScalar(5));
      at.y = 0;
      face = front;
    }
    G.pos.set(at.x, 1.7, at.z);
    G.yaw = Math.atan2(-face.x, -face.z);
    G.pitch = 0;
    G.vel.set(0,0,0);
    G.onGround = true;
  }

  /* ============================================================= building */
  function build(){
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup = new THREE.Group();
    G.scene.add(G.roomGroup);
    G.solids = []; G.hits = []; G.selected = null; G.focused = null;
    G.vel.y = 0; G.onGround = true;
    group = G.roomGroup;
    nodes.clear();

    const size = (cat && cat.size) || { w:20, d:20, h:7 };
    sh = ROOMKIT.shell(group, env, size);
    sh.solids.forEach(s=>G.solids.push(s));
    dressSky();
    lights();
    objects.forEach(add);
    /* You stand on the floor, and on anything solid you have climbed onto. */
    G.ground = (x,z)=>{
      let top = 0;
      for(const [,h] of nodes){
        const b = h.userData.foot;
        if(!b) continue;
        if(x>b.x1 && x<b.x2 && z>b.z1 && z<b.z2) top = Math.max(top, b.top);
      }
      return top;
    };
    G.ceiling = env.ceiling===false ? null : ()=>H();
  }

  /* The sky over a room with no lid, and the light the room sits in. */
  function dressSky(){
    const roofed = env.ceiling!==false;
    const mode = ROOMKIT.SKIES.indexOf(String(env.sky||'stars'))<0 ? 'stars' : String(env.sky);
    if(roofed){
      G.scene.background = new THREE.Color(0x0b0d18);
      sky = null;
    } else {
      sky = ROOMKIT.skyTexture(mode);
      G.scene.background = sky;
    }
    G.scene.fog = null;
  }
  /* The page's own sun and ambient belong to whatever room is up. A chat
     room is lit by its lamps, so the sun is turned down to a fill that keeps
     the corners off black, and put back by whoever builds the next room. */
  function lights(){
    const P = sh.preset;
    if(G.sun){ G.sun.intensity = 0.25; G.sun.position.set(6, H()*2, 4);
               G.sun.target.position.set(0,0,0); G.sun.target.updateMatrixWorld(); }
    let amb = G.scene.children.find(c=>c.isAmbientLight);
    if(!amb){ amb = new THREE.AmbientLight(0xffffff, 0.5); G.scene.add(amb); }
    amb.userData.roomOwned = true;
    applyLights();
  }
  function applyLights(){
    const k = lightsOn ? 1 : 0.2;
    sh.lamps.forEach(l=>{ l[0].intensity = l[1]*k; });
    sh.glow.forEach(g=>{ g[0].emissiveIntensity = g[1]*(lightsOn?1:0.05); });
    const amb = G.scene.children.find(c=>c.isAmbientLight);
    if(amb){
      amb.color.setHex(sh.preset.ambient);
      amb.intensity = sh.preset.amb*sh.bright*(lightsOn?1:0.5);
    }
    for(const [,h] of nodes){
      if(h.userData.lamp) h.userData.lamp.visible = lightsOn;
      if(h.userData.type==='light_switch') switchLook(h);
    }
  }

  /* Stand one object up: a holder at its spot and turned its way, holding
     what it looks like (scaled), the box your feet meet, and the box the
     crosshair finds. */
  function add(o){
    const sp = spec(o.type);
    if(!sp) return null;
    if(!o.id) o.id = newId();
    const props = o.props || (o.props = {});
    const s = Number(o.s)||1;
    const holder = new THREE.Group();
    holder.userData.id = o.id;
    holder.userData.type = o.type;
    const v = ROOMKIT.build(o.type, props, sp);
    v.scale.setScalar(s);
    v.name = 'v';
    holder.add(v);
    holder.userData.v = v;
    holder.userData.sit = v.userData.sit ? v.userData.sit*s : 0;
    holder.userData.lamp = v.userData.lamp || null;
    place(holder, o);
    group.add(holder);
    nodes.set(o.id, holder);

    /* the box: the catalog's `solid` if it has one, else what it measures */
    let size, mid;
    if(sp.solid){
      size = V(sp.solid[0]*s, sp.solid[1]*s, sp.solid[2]*s);
      mid = V(0, size.y/2, 0);
    } else {
      const b = new THREE.Box3().setFromObject(v);
      size = b.getSize(new THREE.Vector3()).addScalar(0.1);
      mid = b.getCenter(new THREE.Vector3()).sub(holder.position);
    }
    holder.userData.size = size;
    holder.userData.mid = mid;
    const beh = sp.behavior || '';
    /* A robot walks its program and a portal is a doorway: neither is
       something to bump into. Everything else with a size is furniture. */
    if(sp.solid && beh!=='robot' && beh!=='portal'){
      const half = footprint(holder, size);
      G.solids.push({ x1:half.x1, x2:half.x2, z1:half.z1, z2:half.z2, y1:-0.5, y2:size.y-0.15 });
      holder.userData.foot = { x1:half.x1, x2:half.x2, z1:half.z1, z2:half.z2, top:size.y };
    }
    /* what the crosshair finds, and what it says when it does */
    const pick = new THREE.Mesh(new THREE.BoxGeometry(
        Math.max(0.3,size.x), Math.max(0.3,size.y), Math.max(0.3,size.z)),
      new THREE.MeshBasicMaterial({ visible:false }));
    pick.position.copy(mid);
    pick.userData.owner = holder;
    holder.add(pick);
    holder.userData.pick = pick;
    G.hits.push(pick);
    label(holder);
    behave(holder, o.type);
    if(state.has(o.id)) applyState(o.id, state.get(o.id));
    return holder;
  }
  /* A turned box is not an axis-aligned one, so the footprint is the turned
     box's shadow: wide enough that you never walk through a corner of a
     couch that is standing at forty degrees. */
  function footprint(holder, size){
    const a = holder.rotation.y;
    const w = Math.abs(Math.cos(a))*size.x + Math.abs(Math.sin(a))*size.z;
    const d = Math.abs(Math.sin(a))*size.x + Math.abs(Math.cos(a))*size.z;
    return { x1:holder.position.x-w/2, x2:holder.position.x+w/2,
             z1:holder.position.z-d/2, z2:holder.position.z+d/2 };
  }
  function place(holder, o){
    const p = o.p || [0,0,0];
    holder.position.set(+p[0]||0, +p[1]||0, +p[2]||0);
    holder.rotation.set(0, (Number(o.r)||0)*Math.PI/180, 0);
  }
  function newId(){
    let s = '';
    for(let i=0;i<9;i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*36)];
    return s;
  }
  /* What the crosshair says over a thing. The verb comes from `use()`, so
     the prompt and the key can never say two different things. */
  function label(holder){
    const sp = spec(holder.userData.type) || {};
    holder.userData.label = sp.name || holder.userData.type;
    holder.userData.roomThing = true;
  }

  /* ========================================================= what they do */
  /* Set up once per thing: whatever a behaviour CHANGES is given a material
     of its own, because the kit shares materials between things that look
     alike and one TV going off must not take the others with it. */
  function behave(holder, type){
    const v = holder.userData.v;
    ['screen','panel','nub'].forEach(n=>{
      const m = v.getObjectByName(n);
      if(m && m.material) m.material = m.material.clone();
    });
    const tag = v.getObjectByName('tag');
    if(tag && tag.material) tag.material = tag.material.clone();
    const say = v.getObjectByName('say');
    if(say && say.material) say.material = say.material.clone();
    const txt = v.getObjectByName('text');
    if(txt && txt.material) txt.material = txt.material.clone();
    if(type==='arcade') arcadeScreen(holder, 'PRESS E', 0x0b0d18);
    if(type==='tv') tvLook(holder, true);
  }

  /* WHAT YOU ARE LOOKING AT, OR FAILING THAT WHAT YOU ARE STANDING BY.

     The crosshair is how everything else in this browser is used, so it
     answers first. But the chase camera rides three metres over your head,
     and a light switch at hip height a metre in front of you is a thing you
     physically cannot point at from up there — you would be looking through
     your own chest. So when the crosshair has nothing, the nearest thing
     within arm's reach answers instead, which is how the Godot game has
     always done it (use_near). The two together mean you can pick one
     cabinet out of six by looking at it AND flick the switch you are
     standing against. */
  /* How close you have to be to work something: arm's length plus half of
     however wide the thing is, so a couch is usable from its edge and a
     light switch only from right against the wall. */
  function reachOf(h){
    const sp = spec(h.userData.type) || {};
    if((sp.behavior||'')==='lights') return 2.2;
    const size = h.userData.size || V(1,1,1);
    return 2.4 + Math.max(size.x, size.z)*0.5;
  }
  const reachable = h =>
    Math.hypot(G.pos.x-h.position.x, G.pos.z-h.position.z) <= reachOf(h);
  function nearest(){
    let best = null, bd = Infinity;
    for(const [,h] of nodes){
      const sp = spec(h.userData.type) || {};
      if(!sp.behavior) continue;
      if(sp.behavior==='seat' && seat) continue;
      const d = Math.hypot(G.pos.x-h.position.x, G.pos.z-h.position.z);
      if(d <= reachOf(h) && d < bd){ bd = d; best = h; }
    }
    return best;
  }
  function usable(){
    if(window.ROOMEDIT && ROOMEDIT.open) return null;
    const looked = G.focused && G.focused.userData.roomThing ? G.focused : null;
    const h = (looked && reachable(looked)) ? looked : nearest();
    if(!h) return null;
    const sp = spec(h.userData.type) || {};
    const beh = sp.behavior || '';
    if(!beh) return null;
    const id = h.userData.id;
    const o = record(id) || {};
    const props = o.props || {};
    const st = state.get(id) || {};
    switch(beh){
      case 'seat':
        if(seat) return null;
        return { on:h, verb:t('E — sit down'), act:()=>sit(h) };
      case 'portal': {
        const to = String(props.to||'');
        if(!to) return { on:h, verb:t('E — leave the room'), act:()=>leave() };
        return { on:h, verb:t('E — go to room {n}',{n:to}), act:()=>goTo(to) };
      }
      case 'lights':
        return { on:h, verb: lightsOn ? t('E — lights off') : t('E — lights on'),
                 act:()=>setState('lights', { on:!lightsOn }) };
      case 'jukebox': {
        const tr = Number(st.run)>0 ? Number(st.track) : -1;
        const next = tr + 1;
        return { on:h, verb: next < JUKE.length ? t('E — play {n}',{n:JUKE[next].name}) : t('E — stop the music'),
                 act:()=>setState(id, next < JUKE.length ? { run:1, track:next } : { run:0, track:-1 }) };
      }
      case 'tv': {
        const lit = st.on!==false;
        return { on:h, verb: lit ? t('E — turn the TV off') : t('E — turn the TV on'),
                 act:()=>setState(id, { on:!lit }) };
      }
      case 'arcade': {
        let word = t('E — play');
        if(arcade && arcade.id===id)
          word = { wait:t('wait for green…'), go:t('NOW!'),
                   done:t('E — play again'), early:t('E — play again') }[arcade.stage] || word;
        return { on:h, verb:word, act:()=>arcadePress(id) };
      }
      case 'robot': {
        const running = Number(st.run)>0 && robotLeft(id)>0;
        return { on:h, verb: running ? t('E — stop the robot') : t('E — run the robot’s program'),
                 act:()=>setState(id, running ? { run:0 } : { run:1 }) };
      }
    }
    return null;
  }
  function use(){
    const u = usable();
    if(!u) return false;
    u.act();
    return true;
  }
  /* Sitting is yours alone — nobody else's screen needs to know, and the
     body you are wearing is already reported as `act`. */
  function sit(h){
    seat = h;
    const y = h.userData.sit || 0.5;
    G.pos.set(h.position.x, y + 1.7 - 0.35, h.position.z);
    G.vel.set(0,0,0);
    if(window.AVATAR) AVATAR.posture('ride');
  }
  function stand(){
    if(!seat) return;
    const front = V(0,0,1).applyAxisAngle(V(0,1,0), seat.rotation.y).multiplyScalar(1.2);
    G.pos.set(seat.position.x+front.x, 1.7, seat.position.z+front.z);
    seat = null;
    if(window.AVATAR) AVATAR.posture(null);
  }
  async function goTo(to){
    try{
      const j = await NET.roomEnter(Number(to));
      enter(j.room, j.server);
    }catch(e){ toast(e.message); }
  }

  /* ------------------------------------------------------------ the state */
  function setState(id, s){
    const local = Object.assign({}, s);
    if(local.run && Number(local.run) > 0) local.run = now()*1000;
    applyState(id, local);
    if(window.NET) NET.roomState(id, s);
  }
  /* What the server said. One change, or all of them at once for somebody
     who has just walked in. `now` is the server's clock: everything that
     runs over time is measured from it, so every screen replays a robot
     from the same moment. */
  function heard(m){
    if(!on) return;
    if(m.now) skew = m.now/1000 - Date.now()/1000;
    if(m.t==='cro') applyState(String(m.o||''), m.s && typeof m.s==='object' ? m.s : {});
    else if(m.t==='cro_all') (m.states||[]).forEach(x=>applyState(String(x.o||''), x.s||{}));
    else if(m.t==='crupdate') refresh();
    else if(m.t==='crkick'){ leave(m.reason || t('You are not in that room any more.')); }
    else if(m.t==='crinvite' && window.ROOMS) ROOMS.invited(m);
  }
  function applyState(id, s){
    state.set(id, s);
    if(id==='lights'){ lightsOn = s.on!==false; applyLights(); return; }
    const h = nodes.get(id);
    if(!h) return;
    switch(h.userData.type){
      case 'jukebox': juke(h, s); break;
      case 'tv': tvLook(h, s.on!==false); break;
      case 'arcade': if(!(arcade && arcade.id===id)) arcadeIdle(h); break;
      case 'robot': if(!(Number(s.run)>0)) robotHome(id); break;
    }
  }
  function switchLook(h){
    const nub = h.userData.v.getObjectByName('nub');
    if(nub) nub.position.y = lightsOn ? 0.03 : -0.03;
  }
  function tvLook(h, lit){
    const screen = h.userData.v.getObjectByName('screen');
    const txt = h.userData.v.getObjectByName('text');
    const o = record(h.userData.id) || {};
    const words = String((o.props&&o.props.text)||'');
    if(screen){
      screen.material.color.setHex(lit ? 0x1f3b5c : 0x0b0d18);
      if(screen.material.emissive) screen.material.emissive.setHex(lit ? 0x1f3b5c : 0x000000);
    }
    if(txt) ROOMKIT.relabel(txt, lit ? (words||' ') : ' ', '#ffffff');
  }

  /* WHAT THE JUKEBOX PLAYS — the Godot game's three, by the same names and
     off the same patterns (koro-godot/scripts/chatroom.gd JUKE): Wano's
     theme, and two loops mixed the way THE LOOP mixes its set, sixteen steps
     rendered once into a buffer that goes round.

     EVERYBODY HEARS THE SAME BAR. The server stamps the moment somebody
     pressed play with ITS clock, so the loop is started at how far through
     it that moment now is, rather than from the top. */
  const JUKE = [
    { name:'WANO THEME', music:'hub' },
    { name:'THE LOOP', bpm:124, pat:[
      [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,1,1,0], [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,0]] },
    { name:'SLOW JAM', bpm:86, pat:[
      [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0], [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1], [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0]] }
  ];
  const LINE = [0,0,3,0, 5,0,3,0, 0,0,7,0, 5,3,0,-2];
  let ac = null, playing = null;
  const beats = new Map();
  /* A kick, a clap, a hat and a bass note, written straight into a buffer:
     the same four voices THE LOOP is built from. */
  function render(tr){
    if(beats.has(tr)) return beats.get(tr);
    const rate = ac.sampleRate;
    const per = Math.round(15/JUKE[tr].bpm*rate);      // a sixteenth
    const n = per*16;
    const buf = ac.createBuffer(1, n, rate);
    const mix = buf.getChannelData(0);
    const put = (at, d)=>{ for(let k=0;k<d.length;k++) mix[(at+k)%n] += d[k]; };
    const env = (len, k)=>{ const d=new Float32Array(len);
                            for(let i=0;i<len;i++) d[i]=Math.exp(-i/(rate*k)); return d; };
    const kick = ()=>{ const L=Math.round(rate*0.28), e=env(L,0.09), d=new Float32Array(L);
      for(let i=0;i<L;i++){ const f=120*Math.exp(-i/(rate*0.03))+45;
        d[i]=Math.sin(2*Math.PI*f*i/rate)*e[i]*0.9; } return d; };
    const clap = ()=>{ const L=Math.round(rate*0.16), e=env(L,0.035), d=new Float32Array(L);
      for(let i=0;i<L;i++) d[i]=(Math.random()*2-1)*e[i]*0.5; return d; };
    const hat  = ()=>{ const L=Math.round(rate*0.05), e=env(L,0.012), d=new Float32Array(L);
      for(let i=0;i<L;i++) d[i]=(Math.random()*2-1)*e[i]*0.3; return d; };
    const bass = f=>{ const L=Math.round(rate*0.5), e=env(L,0.16), d=new Float32Array(L);
      for(let i=0;i<L;i++) d[i]=Math.sin(2*Math.PI*f*i/rate)*e[i]*0.45; return d; };
    const kit = [kick(), clap(), hat()];
    for(let ix=0; ix<16; ix++) for(let row=0; row<4; row++){
      if(!JUKE[tr].pat[row][ix]) continue;
      put(ix*per, row<3 ? kit[row] : bass(55*Math.pow(2, LINE[ix]/12)));
    }
    for(let k=0;k<n;k++) mix[k] = Math.max(-1, Math.min(1, mix[k]*0.8));
    beats.set(tr, buf);
    return buf;
  }
  function jukeStop(){
    if(playing){ try{ playing.stop(); }catch(e){} playing = null; }
  }
  function juke(h, s){
    const lit = Number(s.run) > 0;
    const panel = h.userData.v.getObjectByName('panel');
    if(panel && panel.material.emissive)
      panel.material.emissiveIntensity = lit ? 1.4 : 0.15;
    const tag = h.userData.v.getObjectByName('tag');
    const tr = Number(s.track);
    const track = lit ? JUKE[tr] : null;
    if(tag) ROOMKIT.relabel(tag, track ? '\u266a '+track.name : 'JUKEBOX', '#ffe9a8');
    if(!track){ jukeStop(); if(window.MUSIC) MUSIC.stop(); return; }
    if(track.music){ jukeStop(); if(window.MUSIC) MUSIC.play(track.music); return; }
    if(window.MUSIC) MUSIC.stop();
    if(window.MUSIC && MUSIC.muted){ jukeStop(); return; }
    try{
      ac = ac || new (window.AudioContext||window.webkitAudioContext)();
      if(ac.state==='suspended') ac.resume();
      jukeStop();
      const buf = render(tr);
      const src = ac.createBufferSource();
      src.buffer = buf; src.loop = true;
      const g = ac.createGain(); g.gain.value = 0.5;
      src.connect(g); g.connect(ac.destination);
      /* start at how far through the loop the server's moment now is */
      const at = ((now() - Number(s.run)/1000) % buf.duration + buf.duration) % buf.duration;
      src.start(0, at);
      playing = src;
    }catch(e){ /* a browser that refuses audio refuses it silently */ }
  }

  /* REACTION: wait for green, hit E. The fastest in the room is on the
     cabinet for everybody, until somebody beats it. */
  function arcadePress(id){
    const h = nodes.get(id);
    if(!h) return;
    if(!arcade || arcade.id!==id || arcade.stage==='done' || arcade.stage==='early'){
      arcade = { id, stage:'wait', t:0, go:1.4 + Math.random()*2.2 };
      arcadeScreen(h, t('WAIT FOR')+'\n'+t('GREEN…'), 0x5c1020);
      return;
    }
    if(arcade.stage==='wait'){ arcade.stage='early'; arcadeScreen(h, t('TOO SOON!'), 0x5c1020); return; }
    if(arcade.stage==='go'){
      const ms = Math.round((arcade.t - arcade.go)*1000);
      arcade.stage = 'done';
      const st = state.get(id) || {};
      const best = Number(st.best)||0;
      const who = (window.NET && NET.me) ? String(NET.me.display).slice(0,16) : t('you');
      if(!best || ms < best){
        setState(id, { best:ms, who });
        arcadeScreen(h, ms+' ms\n'+t('NEW BEST!'), 0x0e3b2a);
        toast(t('{n} ms — the best in the room.',{n:ms}));
      } else arcadeScreen(h, ms+' ms\n'+t('BEST')+' '+best, 0x1a1f3a);
    }
  }
  function arcadeTick(dt){
    if(!arcade) return;
    const h = nodes.get(arcade.id);
    if(!h){ arcade = null; return; }
    arcade.t += dt;
    if(arcade.stage==='wait' && arcade.t >= arcade.go){
      arcade.stage = 'go';
      arcadeScreen(h, t('NOW!'), 0x1f9d4a);
    }
    if(Math.hypot(G.pos.x-h.position.x, G.pos.z-h.position.z) > 5){ arcadeIdle(h); arcade = null; }
  }
  function arcadeIdle(h){
    const st = state.get(h.userData.id) || {};
    const best = Number(st.best)||0;
    arcadeScreen(h, best ? t('BEST')+' '+best+' ms\n'+String(st.who||'') : t('PRESS E'), 0x0b0d18);
  }
  function arcadeScreen(h, text, hex){
    const screen = h.userData.v.getObjectByName('screen');
    const txt = h.userData.v.getObjectByName('text');
    if(screen){
      screen.material.color.setHex(hex);
      if(screen.material.emissive) screen.material.emissive.setHex(hex);
    }
    if(txt) ROOMKIT.relabel(txt, text, '#a8e6cf');
  }

  /* ============================================================ the robot
     A ROBOT RUNS A PROGRAM MADE OF KORO'S BLOCKS — the same ids and the same
     meanings as public/vm.js: `move 30 steps` is three metres forward, `turn
     z by 90` a quarter turn, and repeat and forever loop what is inside them
     up to their end. It runs from `when ▶ the game starts`.

     THE RUN IS A FUNCTION OF TIME. The program is unrolled once into a
     timeline of glides, turns, waits and speech; where the robot IS is then
     worked out from how long ago the server says it was set going. Every
     screen asks the same question of the same clock, so everybody sees the
     robot in the same place — including somebody who walks in halfway
     through. This is koro-godot/scripts/chatroom.gd's compile() and
     pose_at(), line for line, because the two have to agree. */
  const STEP_M = 0.1;
  const programs = new Map();

  function endOf(body, i){
    let depth = 0;
    for(let k=i+1; k<body.length; k++){
      const op = String(body[k][0]);
      if(op==='ctrl.repeat' || op==='ctrl.forever') depth++;
      else if(op==='ctrl.end'){ if(!depth) return k; depth--; }
    }
    return body.length;
  }
  function unroll(body, from, to, out){
    let i = from;
    while(i < to && out.length < 400){
      const step = body[i];
      const op = String(step[0]);
      if(op==='ctrl.repeat' || op==='ctrl.forever'){
        const e = Math.min(endOf(body, i), to);
        const n = op==='ctrl.forever' ? 1000
                : Math.max(0, Math.min(1000, Math.round(Number(step[1])||0)));
        for(let k=0;k<n;k++){
          const before = out.length;
          unroll(body, i+1, e, out);
          if(out.length>=400 || out.length===before) break;
        }
        i = e + 1;
      } else if(op==='ctrl.end' || op==='event.flag') i++;
      else { out.push(step); i++; }
    }
  }
  function steps(prog){
    const at = (prog||[]).findIndex(s=>Array.isArray(s) && String(s[0])==='event.flag');
    if(at < 0) return [];
    const out = [];
    unroll(prog.slice(at+1), 0, prog.length-at-1, out);
    return out;
  }
  /* The timeline: segments the robot's pose is read off between. Yaw turns
     to the robot's right on `turn z`, and 0 faces away from the door (-z),
     exactly as in the other game. */
  function compile(prog, home, yaw, w, d){
    const segs = [];
    let pos = { x:home.x, z:home.z }, y = yaw, tt = 0;
    const lim = { x:w/2-0.6, z:d/2-0.6 };
    for(const step of steps(prog)){
      const op = String(step[0]);
      const a1 = step.length>1 ? step[1] : null, a2 = step.length>2 ? step[2] : null;
      const seg = { t0:tt, p0:{x:pos.x,z:pos.z}, y0:y, say:'' };
      let dur = 0;
      if(op==='motion.move'){
        const dist = (Number(a1)||0)*STEP_M;
        const to = { x:pos.x + Math.sin(y)*dist, z:pos.z + Math.cos(y)*dist };
        /* a wall stops it: it glides as far as it can and waits out the rest */
        let fr = 1;
        ['x','z'].forEach(ax=>{
          const delta = to[ax]-pos[ax];
          if(Math.abs(delta) > 1e-6){
            if(to[ax] >  lim[ax]) fr = Math.min(fr, ( lim[ax]-pos[ax])/delta);
            if(to[ax] < -lim[ax]) fr = Math.min(fr, (-lim[ax]-pos[ax])/delta);
          }
        });
        fr = Math.max(0, Math.min(1, fr));
        pos = { x:pos.x + (to.x-pos.x)*fr, z:pos.z + (to.z-pos.z)*fr };
        dur = Math.max(0.15, Math.abs(dist)/1.6);
        seg.frac = fr;
      } else if(op==='motion.turn'){
        const n = Number(a2)||0;
        if(String(a1)==='z') y -= n*Math.PI/180;
        dur = Math.max(0.1, Math.abs(n)/200);
      } else if(op==='motion.face'){
        const want = Math.PI - (Number(a1)||0)*Math.PI/180;
        let dy = want - y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        y += dy;
        dur = Math.max(0.1, Math.abs(dy*180/Math.PI)/200);
      } else if(op==='ctrl.wait'){
        dur = Math.max(0, Math.min(60, Number(a1)||0));
      } else if(op==='looks.sayFor'){
        seg.say = String(a1==null?'':a1);
        dur = Math.max(0, Math.min(60, Number(a2)||0));
      }
      seg.t1 = tt + dur; seg.p1 = { x:pos.x, z:pos.z }; seg.y1 = y;
      segs.push(seg);
      tt += dur;
      if(tt > 600) break;
    }
    return { segs, total:tt, home:{x:home.x,z:home.z}, yaw };
  }
  function poseAt(tl, at){
    const segs = tl.segs;
    if(!segs.length) return { p:tl.home, y:tl.yaw, say:'', moving:false };
    if(at >= tl.total){
      const last = segs[segs.length-1];
      return { p:last.p1, y:last.y1, say:'', moving:false };
    }
    for(const s of segs){
      if(at < s.t1){
        const u = Math.max(0, Math.min(1, (at-s.t0)/Math.max(1e-4, s.t1-s.t0)));
        const e = u*u*(3-2*u);
        let p = s.p0;
        if(s.frac!==undefined){
          const k = s.frac > 0 ? Math.max(0, Math.min(1, e/Math.max(1e-4, s.frac))) : 0;
          p = { x:s.p0.x + (s.p1.x-s.p0.x)*k, z:s.p0.z + (s.p1.z-s.p0.z)*k };
        }
        let dy = s.y1 - s.y0;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        return { p, y:s.y0 + dy*e, say:s.say,
                 moving: Math.hypot(s.p1.x-s.p0.x, s.p1.z-s.p0.z) > 0.01 || Math.abs(s.y1-s.y0) > 0.01 };
      }
    }
    const z = segs[segs.length-1];
    return { p:z.p1, y:z.y1, say:'', moving:false };
  }
  function timeline(id){
    const o = record(id);
    if(!o) return { segs:[], total:0, home:{x:0,z:0}, yaw:0 };
    const prog = (o.props && o.props.program) || [];
    const p = o.p || [0,0,0];
    const key = JSON.stringify([prog, p, o.r||0]);
    const had = programs.get(id);
    if(had && had.key===key) return had;
    const tl = compile(prog, { x:+p[0]||0, z:+p[2]||0 }, (Number(o.r)||0)*Math.PI/180, W(), D());
    tl.key = key;
    programs.set(id, tl);
    return tl;
  }
  function robotLeft(id){
    const run = Number((state.get(id)||{}).run)||0;
    if(run <= 0) return 0;
    return timeline(id).total - (now() - run/1000);
  }
  function robotHome(id){
    const h = nodes.get(id);
    if(!h) return;
    const o = record(id);
    if(o) place(h, o);
    const say = h.userData.v.getObjectByName('say');
    if(say) ROOMKIT.relabel(say, ' ', '#ffffff');
  }
  /* Try a program in the editor without telling anybody: the same timeline,
     on this screen alone. */
  function tryProgram(id, prog){
    const o = record(id);
    if(!o) return;
    const p = o.p || [0,0,0];
    trial = { id, t:0, tl:compile(prog, { x:+p[0]||0, z:+p[2]||0 },
                                 (Number(o.r)||0)*Math.PI/180, W(), D()) };
  }
  function robots(dt){
    if(trial){
      trial.t += dt;
      pose(trial.id, trial.tl, trial.t);
      if(trial.t > trial.tl.total + 1.5){ robotHome(trial.id); trial = null; }
    }
    if(window.ROOMEDIT && ROOMEDIT.open) return;
    for(const [id,s] of state){
      const h = nodes.get(id);
      if(!h || h.userData.type!=='robot') continue;
      const run = Number(s.run)||0;
      if(run <= 0) continue;
      pose(id, timeline(id), now() - run/1000);
    }
  }
  function pose(id, tl, at){
    const h = nodes.get(id);
    if(!h) return;
    const ps = poseAt(tl, at);
    const base = (record(id)||{}).p || [0,0,0];
    h.position.set(ps.p.x, (+base[1]||0) + (ps.moving ? Math.abs(Math.sin(clock*18))*0.03 : 0), ps.p.z);
    h.rotation.y = ps.y;
    const say = h.userData.v.getObjectByName('say');
    if(say && say.userData.said!==ps.say){
      say.userData.said = ps.say;
      ROOMKIT.relabel(say, ps.say || ' ', '#ffffff');
    }
  }

  /* ========================================================== the class
     Everybody else in the room, drawn as who they chose. The numbers come
     off the same wire the planets use, read back into room metres. */
  function paint(list){
    if(!on || !group) return;
    const seen = new Set();
    list.forEach(p=>{
      if(window.NET && NET.me && p.id===NET.me.id) return;
      if(p.at!=='chatroom' && p.at!=='room') return;
      seen.add(p.id);
      const at = fromWire(p.x, p.z, p.y);
      let o = others.get(p.id);
      if(!o){
        const g = new THREE.Group();
        g.add(nameTag(p.display));
        group.add(g);
        o = { g, char:null, model:null, x:at.x, y:at.y, z:at.z,
              tx:at.x, ty:at.y, tz:at.z, yaw:0, tyaw:0, speed:0, act:null };
        others.set(p.id, o);
      }
      const want = p.char && AVATAR.bodyOf(p.char);
      if(want && o.char!==want){
        o.char = want;
        AVATAR.load(want).then(m=>{ if(o.model) o.g.remove(o.model); o.model = m; o.g.add(m); })
                         .catch(()=>{});
      }
      o.tx = at.x; o.ty = at.y; o.tz = at.z;
      /* their heading, read back into the yaw this browser turns bodies by
         (avatar.js: the model faces +z and the camera looks -z) */
      o.tyaw = -(Number(p.yaw)||0);
      o.act = p.act || null;
    });
    for(const [id,o] of others) if(!seen.has(id)){ group.remove(o.g); others.delete(id); }
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
  const GROUND = { idle:1, walk:1, sprint:1 };
  function doing(o){
    if(o.act && !GROUND[o.act]) return o.act;
    return o.speed>7 ? 'sprint' : o.speed>0.4 ? 'walk' : 'idle';
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
      if(o.model) AVATAR.animate(o.model, dt, doing(o));
    }
  }

  /* ========================================================== the frame */
  function tick(dt){
    if(!on) return;
    clock += dt;
    if(window.ROOMEDIT && ROOMEDIT.open) ROOMEDIT.tick(dt);
    smooth(dt);
    arcadeTick(dt);
    robots(dt);
    /* the spinning things: a globe on its stand, a portal's swirl */
    for(const [,h] of nodes){
      const spin = h.userData.v.getObjectByName('spin');
      if(spin) spin.rotation.y += dt*0.3;
      if(h.userData.type==='portal'){
        const disc = h.userData.v.getObjectByName('disc');
        if(disc) ROOMKIT.swirl(disc, clock);
        /* A PORTAL STEPS ASIDE FOR THE CAMERA. It stands off a wall and the
           chase camera backs up against that wall — straight through the
           ring, which then fills the screen with light. Close up it fades. */
        const d = G.camera.position.distanceTo(h.position.clone().setY(1.5));
        const k = Math.max(0, Math.min(1, (d-1.1)/1.4));
        if(disc) disc.material.opacity = k;
        const ring = h.userData.v.getObjectByName('ring');
        if(ring){ ring.material.opacity = 0.25 + 0.75*k; ring.material.transparent = true; }
      }
      const say = h.userData.v.getObjectByName('say');
      if(say) say.quaternion.copy(G.camera.quaternion);
    }
    /* sitting keeps you where you sat */
    if(seat){
      G.pos.set(seat.position.x, (seat.userData.sit||0.5) + 1.35, seat.position.z);
      G.vel.set(0,0,0);
    }
    /* WHAT E WOULD DO HERE goes on the thing you are looking at, so the
       crosshair's own box says it — the same box the planet's doors and the
       free-play objects use (game.js focusScan). A room with its own prompt
       in its own corner would be the third place this game says "press E". */
    for(const [,h] of nodes) h.userData.verb = null;
    handy = null;
    if(seat) handy = { label:t('Sitting down'), verb:t('R — stand up') };
    else {
      const u = usable();
      if(u){
        u.on.userData.verb = u.verb;
        /* and when it is not the thing under the crosshair, the prompt has
           to come from somewhere: focusScan asks for this one */
        if(u.on !== G.focused)
          handy = { label:(spec(u.on.userData.type)||{}).name || u.on.userData.type, verb:u.verb };
      }
    }
    say();
    if(!window.NET || !NET.live) return;
    const t0 = performance.now();
    if(t0 - sent < 90) return;
    sent = t0;
    const w = toWire(G.pos.x, G.pos.y - 1.7, G.pos.z);
    /* `chatroom` is what the other game calls this place, and both of us
       filter the roster on it — so it is the word that travels. */
    NET.pos({ x:+w.lon.toFixed(5), z:+w.lat.toFixed(5), y:+Math.max(0,w.alt).toFixed(2),
              yaw:+(Math.PI - G.yaw).toFixed(3),
              char:AVATAR.chosen, act:AVATAR.act, at:'chatroom' });
  }
  /* The room's name and who is in it, in the HUD the rest of the game uses. */
  function hud(){
    const n = $('#missionName'); if(n) n.textContent = room ? room.name : '';
    const ot = $('#objTitle'); if(ot) ot.textContent = t('THE ROOM');
    say();
  }
  function say(){
    const list = $('#objList');
    if(!list || !on) return;
    const who = room && room.owner ? room.owner.display : '';
    const n = others.size;
    const html = [
      '<li class="cur">' + (mine() ? '\u{1F511} '+t('Your room') : '\u{1F3E0} '+t('{n}’s room',{n:esc(who)})) + '</li>',
      '<li>' + (n ? '\u{1F465} '+t('{n} here with you',{n}) : '\u{1F464} '+t('Just you in here')) + '</li>',
      '<li>' + (mine() ? t('C — rooms, and BUILD THIS ROOM · ENTER — chat')
                       : t('C — rooms · ENTER — chat')) + '</li>'
    ].join('');
    if(list.dataset.roomHtml !== html){ list.dataset.roomHtml = html; list.innerHTML = html; }
  }

  /* ====================================================== the owner's verbs
     Each changes the record — what Save sends — and the thing you can see,
     together, so the two can never disagree. */
  function addObject(type, at, r){
    const sp = spec(type);
    if(!sp) return null;
    const o = { id:newId(), type,
                p:[round(at.x), round(Math.max(0,at.y)), round(at.z)],
                r:r||0, s:1, props:JSON.parse(JSON.stringify(sp.props||{})) };
    objects.push(o);
    add(o);
    return o.id;
  }
  const round = v => Math.round(v*100)/100;
  function moveObject(id, p, r, s){
    const o = record(id);
    if(!o) return;
    o.p = [round(Math.max(-W()/2+0.2, Math.min(W()/2-0.2, p.x))),
           round(Math.max(0, Math.min(H()-0.2, p.y))),
           round(Math.max(-D()/2+0.2, Math.min(D()/2-0.2, p.z)))];
    o.r = ((r%360)+360)%360;
    const was = Number(o.s)||1;
    o.s = Math.max(0.2, Math.min(4, s));
    if(Math.abs(was-o.s) > 1e-4) rebuild(id);
    else { const h = nodes.get(id); if(h){ place(h, o); reSolid(); } }
  }
  function setProp(id, key, value){
    const o = record(id);
    if(!o) return;
    (o.props || (o.props={}))[key] = value;
    rebuild(id);
  }
  function rebuild(id){
    const o = record(id);
    const h = nodes.get(id);
    if(h){ group.remove(h); nodes.delete(id); }
    programs.delete(id);
    if(o) add(o);
    reSolid();
  }
  function removeObject(id){
    const h = nodes.get(id);
    if(h){ group.remove(h); nodes.delete(id); }
    const i = objects.findIndex(o=>o.id===id);
    if(i>=0) objects.splice(i,1);
    programs.delete(id);
    reSolid();
  }
  function duplicateObject(id){
    const o = record(id);
    if(!o) return null;
    const c = JSON.parse(JSON.stringify(o));
    c.id = newId();
    c.p = [round(c.p[0]+0.8), c.p[1], round(c.p[2]+0.8)];
    objects.push(c);
    add(c);
    return c.id;
  }
  /* The walls stay; every object's footprint is worked out again, because a
     thing that moved has left its old box standing in the room. */
  function reSolid(){
    G.solids = sh.solids.slice();
    G.hits = [];
    for(const [,h] of nodes){
      const size = h.userData.size;
      const sp = spec(h.userData.type) || {};
      const beh = sp.behavior || '';
      if(sp.solid && beh!=='robot' && beh!=='portal'){
        const f = footprint(h, size);
        G.solids.push({ x1:f.x1, x2:f.x2, z1:f.z1, z2:f.z2, y1:-0.5, y2:size.y-0.15 });
        h.userData.foot = { x1:f.x1, x2:f.x2, z1:f.z1, z2:f.z2, top:size.y };
      }
      if(h.userData.pick) G.hits.push(h.userData.pick);
    }
  }
  function setEnv(e){
    env = Object.assign({}, env, e);
    const keep = new Map(nodes);
    build();
    void keep;
    applyLights();
  }
  const snapshot = ()=>({ env, objects });

  /* The room again, as the server now says it is — after a save, a rename,
     or its owner editing it while you stand in it. What is HAPPENING in it
     carries over: a robot half way through its program does not restart
     because somebody moved a chair. */
  async function refresh(){
    if(!room) return;
    try{
      const j = await NET.roomGet(room.id);
      reload(j.room);
    }catch(e){ /* it may have gone: the server will send us out */ }
  }
  function reload(r){
    if(!on) return;
    const wasSeat = !!seat;
    stand();
    room = r;
    objects = JSON.parse(JSON.stringify(r.objects||[]));
    env = Object.assign({}, r.env||{});
    programs.clear();
    build();
    applyLights();
    for(const [id,s] of state) applyState(id, s);
    hud();
    void wasSeat;
  }

  /* ---------------------------------------------------------------- keys */
  function key(e){
    if(!on) return false;
    if(window.ROOMEDIT && ROOMEDIT.open && ROOMEDIT.key(e)) return true;
    if(e.code==='KeyE'){ if(seat){ stand(); return true; } return use(); }
    if(e.code==='KeyR' && seat){ stand(); return true; }
    return false;
  }

  return { enter, leave, tick, key, use, heard, reload, refresh,
           addObject, moveObject, removeObject, duplicateObject, setProp, setEnv,
           tryProgram, snapshot, spawn,
           get room(){ return room; }, get objects(){ return objects; },
           get env(){ return env; }, get nodes(){ return nodes; },
           get catalog(){ return cat; }, catalogAsync:catalog,
           get size(){ return { w:W(), d:D(), h:H() }; },
           get mine(){ return mine(); },
           get active(){ return on; },
           get handy(){ return handy; },
           toWire, fromWire, compile, poseAt, steps };
})();
