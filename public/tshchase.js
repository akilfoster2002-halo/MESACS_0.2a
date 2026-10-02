/* =====================================================================
   TSH · THE CHASE. Out of Dragon Alley, under the billboard, and WFC
   arrives (tsh.js films that; this is the part you play). The rules —
   the stages, the missiles' timings, how heat cools — are in tshai.js
   (CHASE), so they can be read and tested on their own.

   IT TEACHES ITSELF, a stage at a time, in the order the script has it:
     1 RUN       Neon Avenue, east. SHIFT sprints, SPACE vaults a barrier.
                 The shoes are cold after the fight — this is on foot. The
                 first missile: a red line, a tone, a ring. Get out of it.
     2 CUTOFF    a van brakes across the pavement and two officers get out.
                 RIGHT-CLICK parries the baton, CLICK counters, G pulls the
                 one on his radio across the street into her fist. Then go.
     3 WALL      a WFC barrier drops across the gap between the buildings:
                 a dead end. G, and up the wall on the Gecko cuffs.
     4 ROOFS     the shoes are charged: HOLD SPACE, roof to roof, with the
                 drones firing at her in the air (a dive or a turn takes her
                 out of a lock), a rappel team on the roof, the flash
                 bangles, and a gate to slide under.
     5 HIDE      a gunship. Its searchlight sweeps the roof; E behind the AC
                 unit, and WASD keep the box between her and whatever looks.
                 J blinds a drone's scanner.
     6 CALL      her phone rings — it's Mom. She answers it, still hidden,
                 while an officer walks round the box towards the sound.
     7 HOME      everything at once, no prompts: the gunship strafing the
                 roofs, two drones, officers on the roofs, cover to lose them
                 in. Land on her own roof with nobody on her, and the night
                 is over (tsh.js films the rest).

   Everything here is told what it needs by tsh.js (start(ctx)): the
   world, who is out, and the night's own helpers — heat, notes, lines,
   sounds, the camera's shake. Nothing here keeps any state across a
   restart: a stage is replayed from its start (tsh.js checkpoints it).
   ===================================================================== */
window.TSHCHASE = (function(){
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a)*k;
  const rnd = (a, b) => a + Math.random()*(b - a);
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const EYE = 1.7;
  const AI = () => window.TSHAI, CH = () => window.TSHAI.CHASE;

  /* ------------------------------------------------------------ the route
     Dragon Alley comes out onto Neon Avenue at x -41.5. East along the
     north pavement; the gap between B4 and B5 (x -24…-21) runs north to
     Lantern Lane, and WFC closes it. B5's roof, then east over Market
     Street to B8; B8's roof is where she hides; home is HOME (62…84,
     24…44), across the avenue and Kiln Street. */
  const ROUTE = {
    mouth: [-41.5, -8.5],
    barriers: [[-35.5, -10, -3.6], [-30.5, -10, -3.6]],          // x, z1, z2: concrete, a metre high
    runDone: -29,                                                 // past here, the cutoff
    van: [-19.5, -6.8],
    gap: { x1:-24, x2:-21, z1:-44, z2:-10 },
    barrier: -30,                                                 // the WFC barrier across the gap
    roofEast: { id:'B8', x:[37, 56], z:[-44, -10], h:13 },
    gate: { x:47, z1:-28.4, z2:-25.6 },
    ac: { x:52.5, z:-18, w:2.4, d:1.6, h:1.6 },
    covers: [[78, -14, 11, 2.2, 1.6, 1.5], [66.5, 14, 9, 2.0, 2.0, 2.2], [44, 20, 10, 2.2, 1.6, 1.5], [26, -37, 10, 2.2, 1.6, 1.5]],
    home: { x1:62, x2:84, z1:24, z2:44, h:12, at:[73, 34] }
  };

  let C = null, on = false, clock = 0;
  const st = { i:0, t:0, flags:{} };
  let props = [], missiles = [], vaults = [], covers = [], gun = null, gate = null, wfcBarrier = null;
  let fireT = 4, strafeT = 9, hits = 0, lastHitT = -99, spottedT = -99, freeze = null, coldNoteT = 0;
  const R = { cover:null, act:null, down:0, iframe:0, strikeN:0 };
  const stage = () => CH().stages[st.i] || {};
  const sid = () => stage().id;

  /* ============================================================ the props */
  function M(){ return C.W.M; }
  function mesh(geo, mat, x, y, z, parent){ const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || C.W.cityGroup).add(m); if(!parent) props.push(m); return m; }
  function solid(x1, x2, z1, z2, y1, y2, tag){ const s = { x1, x2, z1, z2, y1, y2, tag:tag || 'raid' }; G.solids.push(s); return s; }
  function unsolid(s){ const i = G.solids.indexOf(s); if(i >= 0) G.solids.splice(i, 1); }
  const glowMat = (r, g, b) => new THREE.MeshBasicMaterial({ color:new THREE.Color(r, g, b) });

  /* a concrete barrier on the pavement: SPACE vaults it */
  function barrier(x, z1, z2){
    mesh(new THREE.BoxGeometry(0.6, 1.0, z2 - z1), M().concrete, x, 0.5, (z1 + z2)/2);
    const tape = mesh(new THREE.BoxGeometry(0.62, 0.12, z2 - z1), glowMat(2.4, 1.6, 0.3), x, 0.82, (z1 + z2)/2);
    const s = solid(x - 0.3, x + 0.3, z1, z2, -1, 1.0, 'raid:barrier');
    vaults.push({ x1:x - 0.3, x2:x + 0.3, z1, z2, top:1.0, s, tape });
  }
  /* WFC's van: navy, a light bar going */
  function van(x, z, ry){
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; C.W.cityGroup.add(g); props.push(g);
    const navy = new THREE.MeshStandardMaterial({ color:0x141c2a, roughness:0.35, metalness:0.5 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.3, 5.6), navy); b.position.y = 1.35; g.add(b);
    const w = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 0.05), M().glass); w.position.set(0, 1.85, 2.81); g.add(w);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.2, 5.62), glowMat(0.5, 2.6, 2.8)); stripe.position.y = 1.1; g.add(stripe);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.3), glowMat(5, 0.3, 0.2)); red.position.set(-0.45, 2.58, 1.6); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.3), glowMat(0.3, 0.8, 5)); blue.position.set(0.45, 2.58, 1.6); g.add(blue);
    [[-1.1, 1.8], [1.1, 1.8], [-1.1, -1.8], [1.1, -1.8]].forEach(([a, c])=>{ const t = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), M().tyre); t.rotation.z = Math.PI/2; t.position.set(a, 0.42, c); g.add(t); });
    const src = { x, y:3, z, col:new THREE.Color(0xff3a3a), k:14, d:12, mul:1 }; C.W.lights.push(src);
    const v = { g, red, blue, src, s:null };
    v.place = (px, pz, pry) => { g.position.set(px, 0, pz); g.rotation.y = pry; src.x = px; src.z = pz;
      const along = Math.abs(Math.sin(pry)) > 0.7, hx = along ? 2.8 : 1.15, hz = along ? 1.15 : 2.8;
      if(v.s) unsolid(v.s); v.s = solid(px - hx, px + hx, pz - hz, pz + hz, -1, 2.5, 'raid:van'); };
    return v;
  }
  /* the barrier WFC drops across the gap: panels, tape, and a lamp */
  function gapBarrier(z){
    const g = new THREE.Group(); C.W.cityGroup.add(g); props.push(g);
    const navy = new THREE.MeshStandardMaterial({ color:0x18202c, roughness:0.4, metalness:0.6 });
    const p = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.4, 0.3), navy); p.position.set(-22.5, 1.7, z); g.add(p);
    [0.8, 2.2].forEach(y=>{ const t = new THREE.Mesh(new THREE.BoxGeometry(3.02, 0.14, 0.32), glowMat(0.5, 2.6, 2.8)); t.position.set(-22.5, y, z); g.add(t); });
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMat(5, 0.3, 0.2)); l.position.set(-22.5, 3.55, z); g.add(l);
    g.position.y = 5;
    return { g, s:null, z };
  }
  /* B8's roof: a chain fence with a rolling gate in it */
  function roofGate(){
    const r = ROUTE.roofEast, x = ROUTE.gate.x, top = r.h;
    const fence = new THREE.MeshStandardMaterial({ color:0x6a726e, roughness:0.5, metalness:0.7, transparent:true, opacity:0.55 });
    [[r.z[0] + 0.4, ROUTE.gate.z1], [ROUTE.gate.z2, r.z[1] - 0.4]].forEach(([a, b])=>{
      mesh(new THREE.BoxGeometry(0.08, 3.2, b - a), fence, x, top + 1.6, (a + b)/2);
      solid(x - 0.15, x + 0.15, a, b, top - 0.5, top + 3.2, 'raid:fence'); });
    const panel = mesh(new THREE.BoxGeometry(0.12, 2.6, ROUTE.gate.z2 - ROUTE.gate.z1), new THREE.MeshStandardMaterial({ color:0x3a4442, roughness:0.4, metalness:0.7 }), x, top + 1.3 + 2.4, (ROUTE.gate.z1 + ROUTE.gate.z2)/2);
    const lamp = mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), glowMat(3, 2, 0.3), x, top + 3.3, ROUTE.gate.z2 + 0.3);
    return { panel, lamp, open:1, closing:false, s:null, top };
  }
  /* something to get behind on a roof: an AC unit */
  function acUnit(x, z, top, w, d, h){
    const box = mesh(new THREE.BoxGeometry(w, h, d), M().ac, x, top + h/2, z);
    const fan = mesh(new THREE.CylinderGeometry(Math.min(w, d)*0.35, Math.min(w, d)*0.35, 0.06, 18), M().darkMetal, x, top + h + 0.03, z);
    const s = solid(x - w/2, x + w/2, z - d/2, z + d/2, top - 0.1, top + h, 'raid:cover');
    const c = { x1:x - w/2, x2:x + w/2, z1:z - d/2, z2:z + d/2, y:top, top:top + h, cx:x, cz:z, s, box, fan };
    covers.push(c);
    C.thing(x, z, top, 'Hide behind it', ()=>enterCover(c), { icon:'🧱', r:Math.max(w, d)/2 + 1.6, when:()=>on && !R.cover });
    return c;
  }
  /* the gunship: a hull, a tail, two rotors, and a searchlight with a pool where it lands */
  function gunship(){
    const g = new THREE.Group(); C.W.cityGroup.add(g); props.push(g);
    const navy = new THREE.MeshStandardMaterial({ color:0x101824, roughness:0.35, metalness:0.6 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 7), navy); g.add(hull);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.6), M().glass); nose.position.set(0, -0.2, 4.0); g.add(nose);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 6), navy); tail.position.set(0, 0.4, -6.2); g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 1.2), navy); fin.position.set(0, 1.1, -8.9); g.add(fin);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.18, 7.02), glowMat(0.5, 2.6, 2.8)); stripe.position.y = -0.4; g.add(stripe);
    const rot = [];
    [[0, 1.5, 0, 6.5], [0, 0.6, -9.3, 1.6]].forEach(([x, y, z, r], i)=>{ const d = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color:0x9ab0b0, transparent:true, opacity:0.18, side:THREE.DoubleSide, depthWrite:false }));
      d.position.set(x, y, z); if(i) d.rotation.y = Math.PI/2; else d.rotation.x = -Math.PI/2; g.add(d); rot.push(d); });
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), glowMat(5, 0.3, 0.2)); red.position.set(-1.7, 0, 0); g.add(red);
    const blue = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), glowMat(0.3, 0.8, 5)); blue.position.set(1.7, 0, 0); g.add(blue);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color:new THREE.Color(1.0, 1.1, 1.0), transparent:true, opacity:0.06, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide }));
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color:new THREE.Color(1.6, 1.7, 1.5), transparent:true, opacity:0.22, depthWrite:false, blending:THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI/2;
    [cone, pool].forEach(m=>{ m.userData.flat = true; C.W.cityGroup.add(m); props.push(m); if(C.LOOK && C.LOOK.hideInMirror) C.LOOK.hideInMirror.push(m); });
    const src = { x:0, y:0, z:0, col:new THREE.Color(0xf0f8ff), k:26, d:12, mul:1 }; C.W.lights.push(src);
    return { g, rot, red, blue, cone, pool, src, x:110, y:40, z:-20, yaw:-Math.PI/2, light:{ x:52, z:-22, y:13, r:5.5 }, state:'arrive', t:0, sweep:0, leave:false };
  }

  /* ============================================================ the stages */
  /* what is on the street before the chase starts — the barriers, the
     cover on the roofs further on, the gate, the two vans — so the film
     that opens it (tsh.js) can drive the vans in */
  let built = false;
  function build(ctx){
    if(built) return;
    C = ctx; built = true; clock = 0;
    props = []; missiles = []; vaults = []; covers = []; gun = null; gate = null; wfcBarrier = null;
    st.flags = {}; st.i = 0; st.brawl = []; st.hunters = []; st.cop = null;
    ROUTE.barriers.forEach(([x, z1, z2])=>barrier(x, z1, z2));
    { const a = ROUTE.ac; acUnit(a.x, a.z, ROUTE.roofEast.h, a.w, a.d, a.h); }
    ROUTE.covers.forEach(([x, z, top, w, d, h])=>acUnit(x, z, top, w, d, h));
    gate = roofGate();
    const v1 = van(-56, -2.8, Math.PI/2), v2 = van(-31, -2.8, -Math.PI/2); v1.place(-56, -2.8, Math.PI/2); v2.place(-31, -2.8, -Math.PI/2);
    st.vans = [v1, v2];
  }
  function start(ctx, from, drone){
    build(ctx); C = ctx; on = true;
    fireT = 3; strafeT = 9; hits = 0; lastHitT = -99; spottedT = -99; freeze = null; coldNoteT = 0;
    R.cover = null; R.act = null; R.down = 0; R.iframe = 0;
    // two drones that are here for her, not on a round (one of them may be the one the film dropped in her face)
    st.hunters = [0, 1].map(i=>{ const d = (i === 0 && drone && !drone.gone) ? drone : C.spawnDrone([[ROUTE.mouth[0] + (i ? 10 : -10), ROUTE.mouth[1] + 6]], { name:'hunt' + i, speed:6 });
      d.hunter = true; d.state = 'track'; d.side = i ? 1 : -1; d.yT = 13; return d; });
    C.heat(Math.max(C.S().heat, 3), 'illegal wearables, Dragon Alley');
    go(from || 0, true);
  }
  function stop(){
    on = false; built = false; if(!C) return;
    missiles.forEach(killMissile); missiles = [];
    rotor(false);
    if(gun){ gun.g.visible = gun.cone.visible = gun.pool.visible = false; gun.src.mul = 0; }
    (st.hunters || []).forEach(d=>{ if(!d.gone) C.despawn(d); }); st.hunters = [];
    if(R.cover) leaveCover(true);
    if(freeze){ freeze = null; G.timeScale = 1; }
    C.card(null);
    // the meshes went with the world (tsh.js rebuilds it on every entry); the solids too
    props = []; vaults = []; covers = []; gun = null; gate = null;
  }
  /* into stage i: its card, its objective, its cast; a checkpoint at the top of every one */
  function go(i, first){
    if(freeze) unslow();
    st.i = i; st.t = 0;
    const s = stage(); if(!s.id) return;
    C.S().raid = { stage:i };
    C.card(s.title, s.how, i + 1, CH().stages.length);
    C.objective(goal(), info());
    const enter = ENTER[s.id]; if(enter) enter(first);
    C.later(()=>{ if(on && st.i === i) C.checkpoint(); }, 500);
  }
  function next(){ if(st.i < CH().stages.length - 1) go(st.i + 1); }
  function goal(){ return ({ run:'Run.', cutoff:'Get past them.', wall:'Up the wall.', roofs:'Over the roofs, east.', hide:'Hide.', call:'Answer it. Quietly.', home:'Get home.' })[sid()] || ''; }
  function info(){
    const s = sid(), out = [];
    if(st.i < AI().stageAt('roofs')) out.push('👟 The shoes are cold after the fight — on foot until they charge.');
    if(s === 'run') out.push('SPACE at a barrier vaults it. A red ring is a missile: get out of it.');
    if(s === 'cutoff') out.push('RIGHT-CLICK (R) parries · CLICK (K) hits · G pulls one to you.');
    if(s === 'wall') out.push('G facing the wall. W climbs. They do not look up much.');
    if(s === 'roofs') out.push('In the air, a lock follows you: SHIFT dives, or turn, and it misses.', 'F — the flash bangles blind everyone facing you.');
    if(s === 'hide' || s === 'call') out.push('Behind cover, WASD move you round it. Keep it between you and them.', 'J blinds a drone\'s scanner for six seconds.');
    if(s === 'home') out.push('Home is the roof over 214 Harbor Lane. Heat cools while nobody can see you — fastest behind cover.', 'Nobody follows you onto your own roof: lose every star first.');
    return out;
  }
  function shoes(cold){ C.boots(cold); }

  const ENTER = {
    run(first){ shoes(true); if(first) C.later(()=>{ if(on) C.talk('raidRun'); }, 1600); },
    cutoff(){
      shoes(true);
      // a van brakes across the pavement ahead, and two of them get out
      const v = van(ROUTE.van[0] + 30, ROUTE.van[1], -Math.PI/2); st.vans.push(v);
      C.cue('skid'); C.tween(0.9, k=>v.place(lerp(ROUTE.van[0] + 30, ROUTE.van[0], 1 - (1 - k)*(1 - k)), ROUTE.van[1], -Math.PI/2 + (1 - k)*0.4), ()=>{ v.place(ROUTE.van[0], ROUTE.van[1], 0); C.cue('door'); });
      const a = C.spawn('wfc', 'walk-t', ROUTE.van[0] - 3, -8.2, { name:'brawlA', state:'brawl' }), b = C.spawn('wfc', 'nia', ROUTE.van[0] - 2.5, -4.8, { name:'brawlB', state:'brawl' });
      a.brawl = { s:'close', t:0 }; b.brawl = { s:'radio', t:0 };
      [a, b].forEach(n=>{ n.aware = 1.1; n.band = 'alert'; n.home = [ROUTE.van[0] - 3, -8]; n.base = 'return'; });
      st.brawl = [a, b]; st.flags.teach = 'parry';
    },
    wall(){
      shoes(true);
      // the gap, and WFC closing the far end of it
      wfcBarrier = gapBarrier(ROUTE.barrier);
      st.flags.barrierDown = false;
    },
    roofs(){
      shoes(false);
      C.talk('raidSpace');
      // a rappel team for B8's roof, dropped when she gets there
      st.flags.rappel = false;
    },
    hide(){
      shoes(false);
      (st.hunters || []).forEach(d=>{ if(!d.gone){ d.state = 'search'; d.searchT = 30; } });
      if(!gun){ ensureGun(); C.talk('raidGun'); }
      gun.state = 'arrive'; gun.leave = false;
      // the stairwell door opens once she is behind something (or after a while, if she is not)
      st.flags.copAt = 9;
      st.flags.hiddenT = 0;
    },
    call(){
      shoes(false);
      ensureGun(); ensureCop();
      C.mark('mom');
      st.flags.ringT = 0; st.flags.answered = false; st.flags.found = false;
      C.ringing(true); C.phoneCard('INCOMING CALL', 'MOM');
      C.talk('momRing');
    },
    home(){
      shoes(false);
      C.ringing(false);
      ensureGun();
      gun.state = 'hunt'; gun.leave = false;
      C.heat(Math.max(C.S().heat, 4), 'the gunship has you');
      strafeT = rnd(...CH().strafe.every);
      // two more on CLUB's roof, the way home
      [[69, -24], [76, -16]].forEach(([x, z], i)=>rappel(x, z, 11, 'rpH' + i));
    }
  };
  function ensureGun(){ if(!gun){ gun = gunship(); rotor(true); } }
  /* an officer climbs out of B8's stairwell and walks the roof, round the AC unit */
  function ensureCop(){
    if(st.cop && !st.cop.gone) return;
    const r = ROUTE.roofEast;
    // out of the stairwell in the far corner, and round the box, east of the gate
    const o = C.spawn('wfc', 'theo', 55, -40, { y:r.h, name:'roofCop', state:'patrol', route:[[55.4, -30], [55.4, -13.4], [50.6, -13.4], [50.6, -22.4], [55.4, -22.4], [55.4, -40]] });
    o.base = 'patrol'; o.home = [55, -40];
    // a searcher with a torch: slower to be sure of what he saw than the ones in the street
    o.def = Object.assign({}, o.def, { eye:{ range:15, fov:0.85, near:2.2, gain:0.75 } });
    st.cop = o;
  }
  /* officers come down out of the sky on a line */
  function rappel(x, z, top, name){
    const n = C.spawn('wfc', ['walk-x', 'walk-s'][name.length % 2], x, z, { y:top + 7, name, state:'pursue' });
    n.aware = 1.1; n.band = 'alert'; n.lastSeen = [G.pos.x, G.pos.z, C.feet(), C.clock()]; n.base = 'search'; n.home = [x, z];
    n.hold = true;
    const line = mesh(new THREE.CylinderGeometry(0.02, 0.02, 7), M().cable, x, top + 3.5, z);
    C.tween(1.3, k=>{ n.y = top + 7*(1 - k); }, ()=>{ n.y = top; n.hold = false; C.cue('step'); C.later(()=>{ if(line.parent) line.parent.remove(line); }, 1200); });
    return n;
  }

  /* ============================================================== a frame */
  function tick(dt){
    if(!on) return;
    clock += dt; st.t += dt;
    const p = C.P(), s = sid(), mode = C.mode();
    R.iframe = Math.max(0, R.iframe - dt);
    if(clock - lastHitT > CH().hitsForget) hits = 0;
    coldNoteT -= dt;
    // anybody with eyes on her (the gunship's light says so itself)
    const cop = C.npcs().find(n=>n.kind === 'wfc' && !n.gone && n.sees), drone = (C.drones() || []).find(d=>d.state === 'track' && d.inBeam);
    if(cop || drone){ spottedT = clock; st.flags.seenBy = cop ? cop.name : drone.name; }
    st.flags.seenNow = clock - spottedT < 0.5;
    // the stage's own business
    const T = TICK[s]; if(T) T(dt, p);
    tickMissiles(dt);
    tickGun(dt, p);
    tickGate(dt);
    if(wfcBarrier && st.flags.barrierDown && !wfcBarrier.s){ wfcBarrier.s = solid(-24, -21, ROUTE.barrier - 0.25, ROUTE.barrier + 0.25, -1, 3.4, 'raid:barrier'); }
    tickVans();
    // somebody with eyes on her in cover, close enough to reach her: out from behind it, and into his hands
    if(R.cover){ const n = C.npcs().find(n=>n.kind === 'wfc' && !n.gone && n.stun <= 0 && n.sees && Math.hypot(n.x - p.x, n.z - p.z) < 1.8 && Math.abs(n.y - p.y) < 1.2);
      if(n && sid() !== 'call'){ leaveCover(); C.grab(n); } }
    // the missiles: whoever has a clear shot, every few seconds
    fireT -= dt;
    if(fireT <= 0 && canFire(p, mode)){ const air = !G.onGround && mode === null; fire(air); fireT = rnd(...(air ? CH().missile.gapAir : CH().missile.gapGround)); }
  }
  const TICK = {
    run(dt, p){
      // the first missile is a lesson: the world slows while the ring is up
      if(!st.flags.firstShot && p.x > -38.5){ st.flags.firstShot = true; const m = fire(false, true); if(m) slowFor('ring', 0.35); C.card('INCOMING', 'A red line, a tone, a ring: a missile. Get out of the ring.', 1, CH().stages.length, true); }
      if(p.x > ROUTE.runDone && p.z > -12 && p.y < 1) next();
    },
    cutoff(dt, p){
      // a lesson waits: the one she parried stays open until she hits him
      if(freeze === 'counter' && st.brawl[0] && !st.brawl[0].gone) st.brawl[0].stun = Math.max(st.brawl[0].stun, 0.4);
      // past them into the gap: the lesson is over whether or not she took it
      if(inGap(p) && p.z < -13){ st.brawl.forEach(n=>{ if(!n.gone){ n.brawl = null; n.state = 'pursue'; } }); next(); return; }
      if(st.flags.teach === 'go' && st.brawl.every(n=>n.gone || n.stun > 0)){ st.flags.teach = 'done'; C.card('DON\'T STAY', 'More are coming. North, into the gap between the buildings.', 2, CH().stages.length); C.objective('Into the gap.', info()); }
    },
    wall(dt, p){
      if(!st.flags.barrierDown && inGap(p) && p.z < -16){ st.flags.barrierDown = true;
        C.cue('clang'); C.shake(0.25, 0.4);
        if(wfcBarrier) C.tween(0.35, k=>{ wfcBarrier.g.position.y = 5*(1 - k*k); });
        C.talk('raidWall');
        // and they come in behind her
        [0, 1, 2].forEach(i=>{ const n = C.spawn('wfc', ['theo', 'walk-u', 'walk-v'][i], -22.5 + (i - 1)*0.8, -9 + i, { name:'gapCop' + i, state:'pursue' }); n.aware = 1.1; n.band = 'alert'; n.lastSeen = [p.x, p.z, p.y, C.clock()]; n.base = 'search'; n.home = [-22.5, -6]; });
      }
      if(mode() === 'scale' && !st.flags.onWall){ st.flags.onWall = true; C.later(()=>{ if(on) C.talk('raidOnWall'); }, 1400); }
      if(p.y > 10 && onRoof(p, 'B5', 'B4')){ C.talk('raidRoof'); next(); }
    },
    roofs(dt, p){
      const r = ROUTE.roofEast;
      if(!st.flags.landed && p.y > 8 && G.onGround && !onRoof(p, 'B5', 'B4')){ st.flags.landed = true; C.talk('raidLanded'); }
      if(!st.flags.rappel && onRoof(p, 'B8')){ st.flags.rappel = true; rappel(41, -20, r.h, 'rpA'); rappel(41.5, -33, r.h, 'rpB'); }
      // the flash, the first time somebody is close enough for it
      if(!st.flags.flashTip && C.npcs().some(n=>n.kind === 'wfc' && !n.gone && n.stun <= 0 && Math.hypot(n.x - p.x, n.z - p.z) < 8 && Math.abs(n.y - p.y) < 2)){
        st.flags.flashTip = true; C.card('F — FLASH BANGLES', 'Everyone facing you sees white for four seconds.', 4, CH().stages.length); }
      // the gate starts down as she comes at it
      if(gate && !gate.closing && onRoof(p, 'B8') && p.x > ROUTE.gate.x - 10 && p.x < ROUTE.gate.x){ gate.closing = true; C.cue('alarm'); }
      if(onRoof(p, 'B8') && p.x > ROUTE.gate.x + 1 && p.y > r.h - 1){ next(); }
    },
    hide(dt, p){
      if(st.flags.copAt !== undefined && (R.cover || st.t > st.flags.copAt)){ st.flags.copAt = undefined; ensureCop(); }
      if(!st.flags.hideTip && R.cover){ st.flags.hideTip = true; C.talk('raidShh'); }
      // tucked in, unseen, the officer gone past: the phone
      const unseen = R.cover && !st.flags.seenNow;
      st.flags.hiddenT = unseen ? st.flags.hiddenT + dt : 0;
      if(st.flags.hiddenT > 6) next();
    },
    call(dt, p){
      const f = st.flags, cop = st.cop;
      if(f.found){ f.foundT += dt; if(f.foundT > 1.4){ unslow(); if(R.cover) leaveCover(); next(); } return; }
      if(!f.answered){
        f.ringT += dt;
        // every ring is a noise, and he goes to look at it
        if(f.ringT > 1.5){ f.ringT = 0; C.noise(p.x, p.z, 14, 'phone'); }
        if(cop && !cop.gone && cop.sees && Math.hypot(cop.x - p.x, cop.z - p.z) < 4){ C.ringing(false); found(); }
        return;
      }
      if(f.callOver && !f.found && (!cop || cop.gone || cop.state !== 'circle')){ f.lateT = (f.lateT || 0) + dt; if(f.lateT > 1.5) found(); }
      // while she talks he walks round the box, towards where the ringing was
      if(cop && !cop.gone && !f.found){
        const c = covers[0];
        if(!cop.circle){ cop.circle = { a:Math.atan2(cop.x - c.cx, cop.z - c.cz), dir:1 }; cop.state = 'circle'; cop.investigate = null; }
        if(cop.sees && Math.hypot(cop.x - p.x, cop.z - p.z) < 6) return found();
      }
    },
    home(dt, p){
      const h = ROUTE.home;
      const onHome = p.x > h.x1 && p.x < h.x2 && p.z > h.z1 && p.z < h.z2 && p.y > h.h - 1 && G.onGround;
      if(onHome && C.mode() === null){
        if(C.S().heat > 0){ if(coldNoteT <= 0){ coldNoteT = 6; C.note('Not with them on you — they\'d see which building. Lose every star first.', 'bad'); } }
        else { on = false; missiles.forEach(killMissile); missiles = []; rotor(false); C.S().flags.raidHome = true; C.done(); }
      }
    }
  };
  /* the officer on B8's roof, during the call: round the box, a step at a time (tsh.js tickWfc → circle) */
  function circle(n, dt){
    const c = covers[0], f = st.flags;
    const rr = Math.max(c.x2 - c.x1, c.z2 - c.z1)/2 + 1.6;
    n.circle.a += n.circle.dir*dt*0.32;
    const tx = c.cx + Math.sin(n.circle.a)*rr, tz = c.cz + Math.cos(n.circle.a)*rr;
    C.goTo(n, tx, tz, c.y, n.def.walk*0.8, dt);
    // once the call is over, he comes round to her side
    if(f.callOver && !f.found){ const pa = Math.atan2(G.pos.x - c.cx, G.pos.z - c.cz); n.circle.dir = angDiff(pa, n.circle.a) > 0 ? 2.4 : -2.4;
      if(Math.abs(angDiff(pa, n.circle.a)) < 0.35){ n.yaw = Math.atan2(G.pos.x - n.x, G.pos.z - n.z); found(); } }
  }
  function answer(){
    const f = st.flags; if(f.answered) return;
    f.answered = true; C.ringing(false); C.cue('ui');
    C.objective('Keep him on the other side of the box.', info());
    C.card('MOM', 'Keep talking. Keep the box between you and him — WASD round it.', 6, CH().stages.length);
    // the call is overheard, not paced: the roof goes on while she talks
    C.talk('momCall1', ()=>{
      if(!on || f.found) return;
      // something goes off two roofs over, and the sirens climb
      boomAt(V(70, 11, -24), true); C.cue('alarm');
      C.talk('momCall2', ()=>{ if(!on || f.found) return; C.talk('momAfter', ()=>{ f.callOver = true; }); });
    });
  }
  /* he has come round the box: she has been seen */
  function found(){
    const f = st.flags; if(f.found) return; f.found = true;
    C.flushTalk(); C.talk('momFound');
    const cop = st.cop; if(cop && !cop.gone){ cop.circle = null; cop.state = 'pursue'; cop.aware = 1.1; cop.band = 'alert'; cop.lastSeen = [G.pos.x, G.pos.z, C.feet(), C.clock()]; C.bark(cop, 'Hold it right there!'); }
    slowFor('found', 0.25);
    C.card('FOUND', 'CLICK — take him down · SPACE — bolt.', 6, CH().stages.length, true);
    st.flags.foundT = 0;
  }
  function inGap(p){ const g = ROUTE.gap; return p.x > g.x1 - 0.2 && p.x < g.x2 + 0.2 && p.z > g.z1 && p.z < g.z2 + 1; }
  function onRoof(p){ const ids = [].slice.call(arguments, 1); return C.W.roofs.some(r=>ids.includes(r.id) && p.x > r.x1 && p.x < r.x2 && p.z > r.z1 && p.z < r.z2 && Math.abs(p.y - r.h) < 2.5); }
  function mode(){ return C.mode(); }
  function tickVans(){ (st.vans || []).forEach(v=>{ const k = (clock*4|0)%2 === 0; v.red.visible = k; v.blue.visible = !k; v.src.col.setHex(k ? 0xff3a3a : 0x3a6aff); }); }

  /* ============================================================ the moves
     On foot she has a few things the shoes do not do: a vault, a slide,
     and her hands. */
  function fwd(){
    const sp = Math.hypot(G.vel.x, G.vel.z);
    return sp > 1.2 ? { x:G.vel.x/sp, z:G.vel.z/sp } : { x:-Math.sin(G.yaw), z:-Math.cos(G.yaw) };
  }
  /* what SPACE would do here, on her feet: a barrier to vault, the gate to slide under */
  function parkour(){
    if(mode() !== null || !G.onGround) return null;
    const p = C.P(), f = fwd();
    for(const v of vaults){
      const cx = clamp(p.x, v.x1, v.x2), cz = clamp(p.z, v.z1, v.z2), d = Math.hypot(cx - p.x, cz - p.z);
      if(d > 1.7 || p.y > 0.8) continue;
      if(((cx - p.x)*f.x + (cz - p.z)*f.z) < -0.1) continue;               // it has to be in front of her
      return { kind:'vault', v };
    }
    if(gate && gate.open > 0.25 && onRoof(p, 'B8')){
      const g = ROUTE.gate, d = ROUTE.gate.x - p.x;
      if(d > 0 && d < 3.2 && p.z > g.z1 - 0.6 && p.z < g.z2 + 0.6 && f.x > 0.3) return { kind:'slide' };
    }
    return null;
  }
  function vault(v){
    const p = C.P(), f = fwd();
    // over the barrier along the way she is going, and on to clear ground beyond it
    const thick = Math.abs(f.x) > Math.abs(f.z) ? (v.x2 - v.x1) : (v.z2 - v.z1);
    const len = thick + 2.2, to = [p.x + f.x*len, p.z + f.z*len];
    act('vault', 0.48, k=>{ G.pos.set(lerp(p.x, to[0], k), p.y + Math.sin(k*Math.PI)*1.25 + EYE, lerp(p.z, to[1], k)); }, 'jump', Math.atan2(f.x, f.z));
    C.cue('swish');
    if(!st.flags.vaulted){ st.flags.vaulted = true; C.note('✓ VAULT', 'big'); }
  }
  function slide(){
    const p = C.P(), len = ROUTE.gate.x - p.x + 3.4;
    act('slide', 0.62, k=>{ G.pos.set(lerp(p.x, p.x + len, k), p.y + EYE, lerp(p.z, clamp(p.z, ROUTE.gate.z1 + 0.5, ROUTE.gate.z2 - 0.5), Math.min(1, k*3))); }, window.AVATAR && AVATAR.can('roll') ? 'roll' : 'kneel', Math.PI/2);
    C.cue('swish'); C.talk('raidGate');
  }
  /* a short move that is hers for a moment: the keys are not */
  function act(name, dur, f, clip, face){
    R.act = { name, t:0, dur, f, clip, face };
    C.setMode('act');
  }
  function tickAct(dt){
    const a = R.act; if(!a) return C.setMode(null);
    a.t += dt; const k = Math.min(1, a.t/a.dur);
    if(a.f) a.f(k);
    if(a.hit && !a.hitDone && a.t >= a.hit){ a.hitDone = true; a.onHit(); }
    pose(dt, a.clip, a.face);
    if(k >= 1){ R.act = null; C.setMode(null); if(window.AVATAR) AVATAR.posture(null); G.vel.set(0, 0, 0); if(window.BOOTS && BOOTS.B) BOOTS.sync(); }
  }
  /* her body, in a move: the clip, facing where she is going */
  function pose(dt, clip, face, ownCam){
    if(!window.AVATAR) return;
    AVATAR.posture(clip || null);
    AVATAR.update(dt, false, false, true);
    const b = AVATAR.body; if(b && face !== undefined) b.rotation.set(0, face, 0);
    if(!ownCam && typeof thirdPerson === 'function') thirdPerson();
  }

  /* -------------------------------------------------------------- hands
     CLICK / K strikes whoever is in front of her and in reach; RIGHT-CLICK
     / R parries a baton that is coming; G (with no wall to climb) pulls
     the nearest one in front across to her. Fight on the move: hit, go. */
  const STRIKES = ['jab', 'cross', 'hook'];
  function officers(){ return C.npcs().filter(n=>n.kind === 'wfc' && !n.gone && !n.hidden && Math.abs(n.y - C.feet()) < 1.5); }
  function inFront(n, reach, cone){
    const p = C.P(), d = Math.hypot(n.x - p.x, n.z - p.z); if(d > reach) return false;
    const a = Math.atan2(n.x - p.x, n.z - p.z), look = Math.atan2(-Math.sin(G.yaw), -Math.cos(G.yaw));
    return d < 1.2 || Math.abs(angDiff(a, look)) < cone;
  }
  function strike(){
    if(mode() !== null) return false;
    const t = officers().filter(n=>inFront(n, 2.5, 1.15)).sort((a, b)=>Math.hypot(a.x - G.pos.x, a.z - G.pos.z) - Math.hypot(b.x - G.pos.x, b.z - G.pos.z))[0];
    const clip = STRIKES[R.strikeN++ % STRIKES.length];
    const face = t ? Math.atan2(t.x - G.pos.x, t.z - G.pos.z) : Math.atan2(-Math.sin(G.yaw), -Math.cos(G.yaw));
    act('strike', 0.45, null, clip, face);
    R.act.hit = 0.17;
    R.act.onHit = ()=>{
      C.cue('swish');
      if(!t || t.gone || Math.hypot(t.x - G.pos.x, t.z - G.pos.z) > 2.8) return;
      const open = t.brawl && t.brawl.s === 'open';
      C.stun(t, open ? 9 : 5); if(t.brawl) t.brawl.s = 'down';
      const a = Math.atan2(t.x - G.pos.x, t.z - G.pos.z); knock(t, Math.sin(a)*1.6, Math.cos(a)*1.6);
      C.cue('punch'); C.shake(open ? 0.3 : 0.16, 0.25);
      C.crime('brawl', G.pos.x, G.pos.z);
      if(st.flags.teach === 'counter' && t === st.brawl[0]){ unslow(); st.flags.teach = 'pull'; C.talk('raidSorry'); C.card('G — PULL', 'The one on his radio. G drags him across the street into your fist.', 2, CH().stages.length, true); slowFor('pull', 0.3); }
      if(st.flags.found){ unslow(); next(); }
    };
    return true;
  }
  function parry(){
    if(mode() !== null) return false;
    const n = officers().find(n=>n.brawl && n.brawl.s === 'wind' && Math.hypot(n.x - G.pos.x, n.z - G.pos.z) < 2.8);
    act('parry', 0.32, null, 'block', n ? Math.atan2(n.x - G.pos.x, n.z - G.pos.z) : undefined);
    if(!n) return true;
    n.brawl.s = 'open'; n.stun = 1.8; C.cue('clang'); C.shake(0.12, 0.2); C.flash(0.2);
    if(st.flags.teach === 'parry'){ unslow(); st.flags.teach = 'counter'; C.card('CLICK — COUNTER', 'He is open. Hit him.', 2, CH().stages.length, true); slowFor('counter', 0.35); }
    return true;
  }
  function pull(){
    if(mode() !== null) return false;
    const p = C.P();
    const t = officers().filter(n=>n.stun <= 0 && inFront(n, 9.5, 0.6) && C.los(p.x, p.y + 1.3, p.z, n.x, n.y + 1.3, n.z)).sort((a, b)=>Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if(!t) return false;
    const from = [t.x, t.z], d = Math.hypot(t.x - p.x, t.z - p.z), to = [p.x + (t.x - p.x)/d*1.1, p.z + (t.z - p.z)/d*1.1];
    t.hold = true; C.cuffGlow(true); C.cue('grab');
    act('pull', 0.36, k=>{ t.x = lerp(from[0], to[0], k*k); t.z = lerp(from[1], to[1], k*k); }, 'hook', Math.atan2(t.x - p.x, t.z - p.z));
    R.act.hit = 0.3; R.act.onHit = ()=>{ t.hold = false; C.stun(t, 6); if(t.brawl) t.brawl.s = 'down'; C.cue('punch'); C.shake(0.3, 0.3); C.cuffGlow(false); C.crime('brawl', p.x, p.z);
      if(st.flags.teach === 'pull'){ unslow(); st.flags.teach = 'go'; } };
    return true;
  }
  function knock(n, dx, dz){ const x0 = n.x, z0 = n.z; C.tween(0.25, k=>{ const x = x0 + dx*k, z = z0 + dz*k; if(!C.blocked(n, x, z)){ n.x = x; n.z = z; } }); }
  /* the two at the van: one comes at her with a baton, one gets on the radio */
  function brawl(n, dt){
    const b = n.brawl, p = C.P(), d = Math.hypot(n.x - p.x, n.z - p.z);
    n.clip = 'idle';
    if(n.stun > 0) return;
    if(b.s === 'down' || b.s === 'open'){ b.s = 'close'; }
    if(b.s === 'radio'){
      C.face(n, p.x, p.z, dt);
      if(st.flags.teach !== 'pull' && st.flags.teach !== 'go' && st.flags.teach !== 'done'){ if(d > 7) C.goTo(n, p.x, p.z, undefined, n.def.walk, dt); return; }
      if(!b.said){ b.said = true; C.bark(n, 'Dispatch, I need—'); }
      if(st.flags.teach === 'go' || st.flags.teach === 'done') b.s = 'close';
      return;
    }
    if(b.s === 'close'){
      if(d > 1.7){ C.goTo(n, p.x, p.z, undefined, n.def.run, dt); return; }
      b.s = 'wind'; b.t = 0.62; C.bark(n, pick(['Down!', 'Hold still!', 'Stop!']));
      if(st.flags.teach === 'parry' && !st.flags.parryShown){ st.flags.parryShown = true; slowFor('parry', 0.08); C.card('RIGHT-CLICK — PARRY', 'The baton. Right-click (or R) the moment before it lands.', 2, CH().stages.length, true); }
    }
    if(b.s === 'wind'){
      C.face(n, p.x, p.z, dt); n.band = 'alert';
      b.t -= dt;
      if(freeze === 'parry' && st.flags.teach === 'parry'){ b.t = Math.max(b.t, 0.12); return; }       // the lesson waits, his baton in the air
      if(b.t > 0) return;
      C.cue('swish');
      if(d < 2.2 && R.iframe <= 0 && mode() !== 'act') hit(n.x, n.z, 'baton');
      b.s = 'recover'; b.t = 0.9;
    }
    if(b.s === 'recover'){ b.t -= dt; if(b.t <= 0) b.s = 'close'; }
  }
  const pick = a => a[Math.floor(Math.random()*a.length)];

  /* ------------------------------------------------------------ knocked down */
  function hit(fx, fz, why){
    if(R.iframe > 0) return;
    if(clock - lastHitT > CH().hitsForget) hits = 0;
    hits++; lastHitT = clock; R.iframe = 1.6;
    C.cue('hurt'); C.shake(0.45, 0.5);
    if(R.cover) leaveCover(true);
    C.dropWall();
    if(hits >= CH().hits){ C.note('WFC has you.', 'bad'); return C.caught(); }
    C.note(why === 'baton' ? '💥 Knocked down. Once more and they have you.' : '💥 Knocked flat. Once more and they have you.', 'bad');
    const p = C.P(), a = Math.atan2(p.x - fx, p.z - fz), y0 = p.y;
    let vy = 3, y = y0, x = p.x, z = p.z;
    act('down', 1.1, k=>{
      const dt = 1/60; vy -= 22*dt; y = Math.max(C.groundAt(x, z, y + 0.5), y + vy*dt);
      const nx = x + Math.sin(a)*3.5*dt*(1 - k), nz = z + Math.cos(a)*3.5*dt*(1 - k);
      if(!C.wallAt(nx, nz, y)){ x = nx; z = nz; }
      G.pos.set(x, y + EYE, z);
    }, 'stagger', a + Math.PI);
  }

  /* =========================================================== the cover
     E at an AC unit: she gets down behind it. WASD move her round it —
     the keys push her the way they would push her walking, and she goes
     along the side she is on that way (round the corner, at a corner). Low behind a box, the
     people who look are looking at the box (tsh.js canSee, crouched).
     E, SPACE, or running out of it, and she is up again. */
  function enterCover(c){
    if(mode() !== null) return;
    const p = C.P();
    R.cover = { c, s:perimS(c, p.x, p.z) };
    C.setMode('cover'); C.me.crouch = true;
    C.cue('step');
    placeCover(0);
    if(!st.flags.coverTip){ st.flags.coverTip = true; C.note('🧱 WASD — move round it · E or SPACE — up and out', 'big'); }
  }
  function leaveCover(quiet){
    const r = R.cover; if(!r) return;
    R.cover = null; C.me.crouch = false;
    if(C.mode() === 'cover') C.setMode(null);
    if(window.AVATAR) AVATAR.posture(null);
    if(window.BOOTS && BOOTS.B) BOOTS.sync();
    if(!quiet) C.cue('step');
  }
  // a point on the rectangle around the box, 0.55 m out, by distance s along it
  function perim(c){ const o = 0.55, x1 = c.x1 - o, x2 = c.x2 + o, z1 = c.z1 - o, z2 = c.z2 + o; return { x1, x2, z1, z2, w:x2 - x1, d:z2 - z1, L:2*(x2 - x1 + z2 - z1) }; }
  function perimAt(c, s){
    const P = perim(c); s = ((s % P.L) + P.L) % P.L;
    if(s < P.w) return [P.x1 + s, P.z1, 0, -1];
    s -= P.w; if(s < P.d) return [P.x2, P.z1 + s, 1, 0];
    s -= P.d; if(s < P.w) return [P.x2 - s, P.z2, 0, 1];
    s -= P.w; return [P.x1, P.z2 - s, -1, 0];
  }
  function perimS(c, x, z){
    let best = 0, bd = Infinity; const P = perim(c);
    for(let s = 0; s < P.L; s += 0.1){ const q = perimAt(c, s), d = Math.hypot(q[0] - x, q[1] - z); if(d < bd){ bd = d; best = s; } }
    return best;
  }
  function placeCover(dt){
    const r = R.cover, c = r.c;
    const k = G.keys, ix = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), iz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    if(ix || iz){
      // the keys, as a push in the world (camera-relative), against the way round the box at this point
      const sy = Math.sin(G.yaw), cy = Math.cos(G.yaw);
      const wx = ix*cy - iz*sy, wz = -ix*sy - iz*cy;
      // along the side she is on, whichever way the keys push her; at a corner, round it the way the push turns her
      const a = perimAt(c, r.s), b = perimAt(c, r.s + 0.05), tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1;
      const rx = a[0] - c.cx, rz = a[1] - c.cz, rl = Math.hypot(rx, rz) || 1, wl = Math.hypot(wx, wz) || 1;
      let along = (wx*tx + wz*tz)/tl/wl;
      if(Math.abs(along) < 0.25) along = (rx*wz - rz*wx)/rl/wl;
      if(Math.abs(along) > 0.2) r.s += Math.sign(along)*1.7*dt;
    }
    const q = perimAt(c, r.s);
    G.pos.set(q[0], c.y + EYE, q[1]);
    r.out = Math.atan2(q[2], q[3]);
    pose(dt, 'kneel', r.out, true);
    // the camera: low, behind her, round the box with the mouse
    const cam = G.camera, hx = q[0], hz = q[1], hy = c.y + 1.1;
    cam.position.lerp(V(hx + Math.sin(G.yaw)*3.6, hy + 1.3, hz + Math.cos(G.yaw)*3.6), 0.2);
    cam.lookAt(hx, hy, hz);
  }
  function tickCover(dt){ if(!R.cover){ C.setMode(null); return; } placeCover(dt); }

  /* =========================================================== the missiles */
  function canFire(p, mode){
    if(freeze || C.me.hidden || R.cover || mode === 'act' || mode === 'grab') return false;
    const s = sid();
    if(s === 'cutoff') return false;
    if(s === 'run' && !st.flags.firstShot) return false;
    if((s === 'hide' || s === 'call') && clock - spottedT > 3) return false;
    return missiles.filter(m=>m.phase !== 'gone').length < CH().missile.live;
  }
  /* who shoots: the nearest hunter drone that can see her, or the gunship */
  function shooter(p){
    const hs = (st.hunters || []).filter(d=>!d.gone && d.static <= 0 && d.stun <= 0 && C.los(d.x, d.y, d.z, p.x, p.y + 1.2, p.z));
    hs.sort((a, b)=>Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    if(hs[0]) return hs[0];
    if(gun && gun.state !== 'gone' && C.los(gun.x, gun.y - 1.5, gun.z, p.x, p.y + 1.2, p.z)) return gun;
    return null;
  }
  function fire(air, lesson){
    const p = C.P(), src = shooter(p) || (lesson && st.hunters && st.hunters[0]);
    if(!src) return null;
    const MS = CH().missile;
    let at;
    const onWall = C.mode() === 'scale';
    if(air || onWall) at = V(p.x, p.y + 0.9, p.z);
    else { const l = AI().leadPoint(p, G.vel, false); at = V(l.x, C.groundAt(l.x, l.z, p.y + 1.2) + 0.9, l.z); }
    const m = makeMissile(src, at, air, air ? MS.airLock : MS.lock, 0, !(air || onWall));
    if(lesson) m.lesson = true;
    if(!st.flags.saidAre && !lesson){ st.flags.saidAre = true; C.later(()=>{ if(on) C.talk('raidAre'); }, 1900); }
    return m;
  }
  function makeMissile(src, at, air, lock, delay, flat){
    if(flat === undefined) flat = !air;
    const ringM = new THREE.MeshBasicMaterial({ color:new THREE.Color(4, 0.4, 0.3), transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false });
    const fillM = new THREE.MeshBasicMaterial({ color:new THREE.Color(3, 0.3, 0.2), transparent:true, opacity:0.22, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending });
    const r = CH().missile.blast;
    const ring = mesh(new THREE.RingGeometry(r*0.92, r, 48), ringM, at.x, at.y, at.z);
    const fill = mesh(new THREE.CircleGeometry(r, 40), fillM, at.x, at.y, at.z);
    if(flat){ ring.rotation.x = fill.rotation.x = -Math.PI/2; ring.position.y = fill.position.y = at.y - 0.84; }
    const laser = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color:new THREE.Color(5, 0.3, 0.2), transparent:true, opacity:0.55, depthWrite:false, blending:THREE.AdditiveBlending }), 0, 0, 0);
    [ring, fill, laser].forEach(o=>{ o.userData.flat = true; o.castShadow = false; });
    const m = { src, at, air, flat, lock, t:-(delay || 0), phase:'lock', ring, fill, laser, beep:0, rocket:null, from:null };
    missiles.push(m);
    return m;
  }
  const srcPos = s => V(s.x, s.y - (s === gun ? 1.6 : 0.2), s.z);
  function tickMissiles(dt){
    const p = C.P();
    missiles = missiles.filter(m=>{
      m.t += dt;
      if(m.t < 0){ [m.ring, m.fill, m.laser].forEach(o=>o.visible = false); return true; }
      if(m.phase === 'lock'){
        [m.ring, m.fill, m.laser].forEach(o=>o.visible = true);
        const k = Math.min(1, m.t/m.lock);
        // in the air the lock follows her until it fires
        if(m.air){ m.at.set(p.x, p.y + 0.9, p.z); m.ring.position.copy(m.at); m.fill.position.copy(m.at); }
        if(!m.flat){ m.ring.lookAt(G.camera.position); m.fill.lookAt(G.camera.position); }
        m.fill.scale.setScalar(Math.max(0.02, k));
        m.ring.material.opacity = 0.5 + 0.5*Math.abs(Math.sin(m.t*(8 + k*20)));
        beam(m.laser, srcPos(m.src), m.at, 0.25 + 0.5*k);
        m.beep -= dt; if(m.beep <= 0){ m.beep = lerp(0.38, 0.06, k); C.cue('lock'); }
        if(k >= 1){
          m.phase = 'fly'; m.t = 0; m.from = srcPos(m.src);
          if(m.air){ const l = AI().leadPoint(p, G.vel, true); m.at.set(l.x, l.y + 0.9, l.z); m.ring.position.copy(m.at); m.fill.position.copy(m.at); }
          m.rocket = mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 8), new THREE.MeshBasicMaterial({ color:new THREE.Color(5, 3, 1.5) }), m.from.x, m.from.y, m.from.z);
          m.laser.visible = false; C.cue('launch');
          if(m.lesson && freeze === 'ring') unslow();
        }
        return true;
      }
      if(m.phase === 'fly'){
        const k = Math.min(1, m.t/CH().missile.fly), pos = m.from.clone().lerp(m.at, k);
        m.rocket.position.copy(pos); m.rocket.lookAt(m.at); m.rocket.rotateX(Math.PI/2);
        if(Math.random() < 0.8) C.particle(pos.clone(), { color:0xff9a4a, k:3, size:0.12, life:0.35, grow:0.6, op:0.8, v:V(0, 0.4, 0) });
        if(k >= 1){ boom(m); killMissile(m); return false; }
        return true;
      }
      return false;
    });
  }
  function beam(o, a, b, op){
    const d = b.clone().sub(a), len = d.length();
    o.position.copy(a).addScaledVector(d, 0.5); o.scale.set(1, len, 1);
    o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    o.material.opacity = op;
  }
  function killMissile(m){ [m.ring, m.fill, m.laser, m.rocket].forEach(o=>{ if(o && o.parent){ o.parent.remove(o); if(o.geometry) o.geometry.dispose(); } }); m.phase = 'gone'; }
  function boom(m){ boomAt(m.at, false); const p = C.P(); if(AI().blastHits(m.at, p) && C.mode() !== 'grab') hit(m.at.x, m.at.z, 'missile'); }
  function boomAt(at, far){
    const p = C.P(), d = Math.hypot(at.x - p.x, at.y - p.y, at.z - p.z);
    C.cue('boom');
    if(d < 30){ C.flash(Math.max(0, 0.4 - d*0.012)); C.shake(Math.max(0.05, 0.6 - d*0.02), 0.45); }
    for(let i = 0; i < (far ? 16 : 26); i++) C.particle(at.clone(), { color:i % 3 ? 0xff7a2a : 0xffd27a, k:4, size:0.14, life:0.55, grow:0.5, v:V(rnd(-7, 7), rnd(1, 8), rnd(-7, 7)), grav:9 });
    for(let i = 0; i < 10; i++) C.particle(at.clone().add(V(rnd(-1, 1), 0.3, rnd(-1, 1))), { color:0x4a4a4a, k:0.4, op:0.35, size:0.5, grow:1.6, life:2.2, v:V(rnd(-0.6, 0.6), rnd(1, 2), rnd(-0.6, 0.6)) });
    C.ring(V(at.x, at.y - 0.8, at.z), 4, 0xff7a3a);
  }

  /* ============================================================ the gunship
     It comes in from the east, hangs over the roofs, and its searchlight
     sweeps for her. In the light with nothing between her and it, she is
     seen. Later, a strafing run: a line of rings across her roof that go
     off one after the other, and a gap in it somewhere. When the heat is
     gone, so is it. */
  function tickGun(dt, p){
    if(!gun) return;
    const g = gun; g.t += dt;
    g.rot.forEach((r, i)=>{ if(i) r.rotation.x += dt*40; else r.rotation.z += dt*30; });
    const blink = (clock*2|0)%2 === 0; g.red.visible = blink; g.blue.visible = !blink;
    const heat = C.S().heat;
    if(sid() === 'home' && heat === 0 && !g.leave){ g.leave = true; C.note('The gunship banks away towards the river.'); }
    // where it wants to be: over the roofs near her (or where it lost her), high, a little off to one side
    let tx, tz, ty;
    if(g.leave){ tx = g.x + 40; tz = g.z + 30; ty = g.y + 6; if(g.x > 160){ g.state = 'gone'; g.g.visible = g.cone.visible = g.pool.visible = false; g.src.mul = 0; rotor(false); return; } }
    else { const lk = C.lastKnown() || [p.x, p.z]; const ofs = sid() === 'hide' || sid() === 'call' ? [12, 10] : [16, -12];
      tx = lk[0] + ofs[0]; tz = lk[1] + ofs[1]; ty = Math.max(30, C.feet() + 22); }
    const k = Math.min(1, dt*(g.state === 'arrive' ? 0.5 : 0.35));
    g.x = lerp(g.x, tx, k); g.z = lerp(g.z, tz, k); g.y = lerp(g.y, ty, k);
    if(Math.hypot(g.x - tx, g.z - tz) < 6) g.state = 'hunt';
    const want = Math.atan2(p.x - g.x, p.z - g.z); g.yaw += angDiff(want, g.yaw)*Math.min(1, dt*0.8);
    g.g.position.set(g.x, g.y + Math.sin(clock*0.9)*0.4, g.z); g.g.rotation.set(0.08, g.yaw, Math.sin(clock*0.6)*0.04);
    rotorLevel(g);
    // the searchlight: a figure-eight over where it thinks she is, onto her when it has her
    const L = g.light, seenNow = clock - spottedT < 1.5;
    const lk = C.lastKnown() || [p.x, p.z];
    g.sweep += dt*0.55;
    const lx = seenNow ? p.x : lk[0] + Math.sin(g.sweep)*9, lz = seenNow ? p.z : lk[1] + Math.sin(g.sweep*2)*5;
    L.x = lerp(L.x, lx, Math.min(1, dt*(seenNow ? 4 : 1.2))); L.z = lerp(L.z, lz, Math.min(1, dt*(seenNow ? 4 : 1.2)));
    L.y = C.groundAt(L.x, L.z, 60);
    const on_ = !g.leave;
    g.cone.visible = g.pool.visible = on_; g.src.mul = on_ ? 1 : 0;
    if(on_){
      const h = g.y - L.y, len = Math.hypot(h, Math.hypot(L.x - g.x, L.z - g.z));
      g.cone.position.set((g.x + L.x)/2, (g.y + L.y)/2, (g.z + L.z)/2); g.cone.scale.set(L.r, len, L.r);
      g.cone.lookAt(g.x, g.y, g.z); g.cone.rotateX(-Math.PI/2);
      g.pool.position.set(L.x, L.y + 0.04, L.z); g.pool.scale.setScalar(L.r);
      g.src.x = L.x; g.src.y = L.y + 3; g.src.z = L.z;
      // in the light, and nothing between her and it: seen
      // a sweep passing over her is not a sighting: the light has to stay on her a moment
      const inPool = Math.hypot(p.x - L.x, p.z - L.z) < L.r && Math.abs(p.y - L.y) < 3;
      const h_ = C.me.crouch ? 0.6 : 1.3;
      const lit = inPool && !C.me.hidden && C.los(g.x, g.y - 1.6, g.z, p.x, p.y + h_, p.z);
      g.dwell = lit ? Math.min(1, (g.dwell || 0) + dt) : Math.max(0, (g.dwell || 0) - dt*2);
      if(g.dwell > (seenNow ? 0 : 0.6)) spotted('light');
    }
    // the strafing run, in the last stage
    if(sid() === 'home' && !g.leave && heat > 0){
      strafeT -= dt;
      if(strafeT <= 0 && !R.cover && !C.me.hidden && clock - spottedT < 4){ strafeT = rnd(...CH().strafe.every); strafe(p); }
    }
  }
  function strafe(p){
    const S_ = CH().strafe, sp = Math.hypot(G.vel.x, G.vel.z);
    // across the way she is going (or any way, standing still)
    const a = sp > 1 ? Math.atan2(G.vel.x, G.vel.z) + Math.PI/2 : Math.random()*Math.PI*2;
    const gapAt = Math.floor(Math.random()*S_.rings);
    for(let i = 0; i < S_.rings; i++){
      if(i === gapAt) continue;
      const o = (i - (S_.rings - 1)/2)*S_.gap, x = p.x + Math.sin(a)*o, z = p.z + Math.cos(a)*o;
      const at = V(x, C.groundAt(x, z, p.y + 1.2) + 0.9, z);
      makeMissile(gun, at, false, CH().missile.lock, i*S_.step);
    }
    C.cue('alarm');
    if(!st.flags.strafeTip){ st.flags.strafeTip = true; C.note('🚁 A strafing run — across the line, not along it.', 'bad'); }
  }
  function spotted(why){
    const p = C.P(), was = spottedT;
    spottedT = clock; st.flags.seenBy = why;
    C.seen(p.x, p.z);
    if(clock - was > 3){
      const s = sid();
      if(s === 'hide' || s === 'call'){ C.heat(Math.max(C.S().heat, 3), 'the gunship\'s searchlight'); }
      C.cue('alert');
      if(!st.flags.lightTip && why === 'light'){ st.flags.lightTip = true; C.note('🔦 The light has you — out of it, or something between you and it.', 'bad'); }
      if(s === 'call' && st.flags.answered) found();
    }
  }

  /* the gate on B8's roof: it rolls down as she comes at it */
  function tickGate(dt){
    if(!gate) return;
    if(gate.closing && gate.open > 0){ gate.open = Math.max(0, gate.open - dt/2.6); }
    const y = gate.top + 1.3 + 2.4*gate.open;
    gate.panel.position.y = y;
    gate.lamp.material.color.setRGB((clock*4|0)%2 && gate.closing ? 5 : 3, (clock*4|0)%2 && gate.closing ? 0.4 : 2, 0.3);
    const bottom = y - 1.3, g = ROUTE.gate;
    if(gate.s) unsolid(gate.s);
    gate.s = bottom < gate.top + 1.5 ? solid(g.x - 0.12, g.x + 0.12, g.z1, g.z2, bottom, bottom + 2.6, 'raid:gate') : null;
  }

  /* ------------------------------------------------------------ the rotor
     A gunship is mostly a sound: filtered noise, chopped by a slow
     oscillator, louder the closer it hangs. */
  let rot = null;
  function rotor(v){
    const a = C && C.audio && C.audio(); if(!a) return;
    if(v && !rot){
      try{
        const src = a.createBufferSource(), n = a.sampleRate*2, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); let l = 0;
        for(let i = 0; i < n; i++){ l = (l + 0.04*(Math.random()*2 - 1))/1.04; d[i] = l*4; }
        src.buffer = b; src.loop = true;
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
        const chop = a.createGain(); chop.gain.value = 0.5;
        const lfo = a.createOscillator(); lfo.frequency.value = 11; const depth = a.createGain(); depth.gain.value = 0.45; lfo.connect(depth); depth.connect(chop.gain);
        const g = a.createGain(); g.gain.value = 0;
        src.connect(lp); lp.connect(chop); chop.connect(g); g.connect(a.destination); src.start(); lfo.start();
        rot = { src, lfo, g };
      }catch(e){ rot = null; }
    }
    if(!v && rot){ try{ rot.g.gain.setTargetAtTime(0, a.currentTime, 0.4); const r = rot; setTimeout(()=>{ try{ r.src.stop(); r.lfo.stop(); }catch(e){} }, 1500); }catch(e){} rot = null; }
  }
  function rotorLevel(g){ if(!rot || !C.audio()) return; const d = Math.hypot(g.x - G.pos.x, g.y - G.pos.y, g.z - G.pos.z); rot.g.gain.setTargetAtTime(Math.max(0, 0.32 - d*0.004), C.audio().currentTime, 0.3); }

  /* ------------------------------------------------------------ slow motion
     A lesson waits in slow motion for its key, as the fight's do. */
  function slowFor(why, k){ freeze = why; G.timeScale = k; }
  function unslow(){ freeze = null; G.timeScale = 1; if(C) C.card(null); }

  /* where the hunters want to be: either side of her and above, or circling where she was */
  function hunterGoal(n){
    const p = C.P();
    if(n.state !== 'track'){ const lk = C.lastKnown() || [p.x, p.z], a = clock*0.35 + n.side*Math.PI; n.searchT = 30; return [lk[0] + Math.cos(a)*16, lk[1] + Math.sin(a)*16, Math.max(16, p.y + 10)]; }
    const sp = Math.hypot(G.vel.x, G.vel.z), hx = sp > 1 ? G.vel.x/sp : -Math.sin(G.yaw), hz = sp > 1 ? G.vel.z/sp : -Math.cos(G.yaw);
    return [p.x - hx*7 + hz*n.side*9, p.z - hz*7 - hx*n.side*9, Math.max(13, p.y + 9)];
  }

  /* ============================================================== keys */
  function key(e){
    if(!on) return false;
    const c = e.code, m = mode();
    if(m === 'act' || m === 'down') return ['Space', 'KeyE', 'KeyG', 'KeyF', 'KeyK', 'KeyR', 'KeyJ', 'KeyQ'].includes(c);
    if(m === 'cover'){
      if((c === 'KeyE' || c === 'Space') && !e.repeat){ if(c === 'Space') G.keys.Space = false; leaveCover(); if(st.flags.found) next(); return true; }
      if(c === 'KeyK' && !e.repeat){ leaveCover(); strike(); return true; }
      if(c === 'KeyJ' || c === 'KeyH' || c === 'KeyI' || c === 'KeyP' || c === 'Escape') return false;          // the studs work from behind a box
      if(c === 'KeyF') return false;
      return ['KeyQ', 'KeyG'].includes(c);
    }
    if(m !== null) return false;
    // the phone: E answers it, wherever she is
    if(c === 'KeyE' && !e.repeat && sid() === 'call' && !st.flags.answered){ answer(); return true; }
    if(c === 'Space' && !e.repeat){
      const pk = parkour();
      if(pk){ G.keys.Space = false; if(pk.kind === 'vault') vault(pk.v); else slide(); return true; }
      if(st.flags.found && sid() === 'call'){ unslow(); next(); return false; }      // bolt: the shoes take it from here
      if(st.i < AI().stageAt('roofs')){ G.keys.Space = false; if(coldNoteT <= 0){ coldNoteT = 4; C.note('👟 The shoes are still cold from the fight.', 'warn'); } return true; }
    }
    if(c === 'KeyK' && !e.repeat){ strike(); return true; }
    if(c === 'KeyR' && !e.repeat){ parry(); return true; }
    if(c === 'KeyG' && !e.repeat && !C.wallNear() && pull()) return true;
    return false;
  }
  function mouse(e){
    if(!on || e.button === undefined) return;
    if(mode() === 'cover' && e.button === 0 && st.flags.found){ leaveCover(); strike(); return; }
    if(mode() !== null) return;
    if(e.button === 0) strike();
    if(e.button === 2){ e.preventDefault && e.preventDefault(); parry(); }
  }
  /* what to show over the keys, here */
  function prompt(){
    if(!on) return null;
    const m = mode();
    if(m === 'cover') return st.flags.found ? '<kbd>Click</kbd><span>take him down</span><kbd>Space</kbd><span>bolt</span>' : '<kbd>WASD</kbd><span>🧱 round it</span><kbd>E</kbd><span>up</span>';
    if(sid() === 'call' && !st.flags.answered) return '<kbd>E</kbd><span>📱 Answer — it\'s loud</span>';
    if(m !== null) return null;
    const pk = parkour();
    if(pk) return pk.kind === 'vault' ? '<kbd>Space</kbd><span>Vault</span>' : '<kbd>Space</kbd><span>Slide under</span>';
    const t = officers().find(n=>inFront(n, 2.5, 1.15));
    if(t) return t.brawl && t.brawl.s === 'wind' ? '<kbd>Right-click</kbd><span>parry</span>' : '<kbd>Click</kbd><span>hit</span>';
    return null;
  }
  function marker(){
    const s = sid();
    if(s === 'run') return [ROUTE.runDone + 1, -8, 2.4, 'East'];
    if(s === 'cutoff') return [-22.5, -14, 2.4, 'Into the gap'];
    if(s === 'wall') return [-17, -25, 12.5, 'The roof'];
    if(s === 'roofs') return [ROUTE.gate.x + 3, (ROUTE.gate.z1 + ROUTE.gate.z2)/2, 14, 'East'];
    if(s === 'hide') return R.cover ? null : [ROUTE.ac.x, ROUTE.ac.z, 15, 'Cover'];
    if(s === 'home') return [ROUTE.home.at[0], ROUTE.home.at[1], 13.5, 'Home'];
    return null;
  }

  function vans(){ return st.vans || []; }
  return { build, vans, start, stop, tick, key, mouse, prompt, marker, brawl, circle, hunterGoal, tickAct, tickCover, ROUTE,
           get on(){ return on; }, get stage(){ return sid(); }, get i(){ return st.i; }, get cover(){ return R.cover; },
           /* for tests and the console */
           _go:go, _fire:fire, _missiles:()=>missiles, _gun:()=>gun, _hits:()=>hits, _st:st, _parkour:parkour, _found:found, _answer:answer, perimAt, perim };
})();
