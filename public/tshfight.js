/* =====================================================================
   TSH · THE FIGHT. Dragon Alley, after the buyer decides not to pay and
   his crew comes out of the alley (tsh.js films the walk-up and the
   walk-off around this; this is the part you play).

   IT TEACHES ITSELF, one move at a time, in the order the script has the
   crew come at her: the first one charges (ATTACK), another swings
   (DODGE), two rush her (COMBO), one gets hold of her (BREAK), one has a
   pipe (PARRY) — then the buyer yells and the rest come, and her
   gauntlets do what they were built for: a POWER punch, and a PULL that
   drags a man across the alley into her fist like a line cast out.

   SLOW, THEN FAST. Every move is taught in a speed ramp: the world drops
   to a crawl at the instant that matters — his fist a foot from her face
   — and waits there for the key, and comes back up to speed as the move
   lands. Every hit lands with a jolt: a few hundredths of a second of
   almost-stop, and the picture shakes, harder the harder she hits.

   CONTROLS, in a fight
     CLICK / K           punch — again and again for the chain: jab, cross, hook, kick
     hold CLICK / K      the gauntlet's POWER punch, on letting go
     G                   the gauntlet's PULL: the nearest one in front, dragged to her
     SPACE               dodge (toward a man: over him; toward a wall: off it, feet first)
     RIGHT-CLICK / R     parry, the instant before a hit; hold it to block
     F                   the bangle's PULSE: everyone close is thrown off her
   ===================================================================== */
window.TSHFIGHT = (function(){
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a)*k;
  const rnd = (a, b) => a + Math.random()*(b - a);
  const angTo = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const EYE = 1.7;

  /* ------------------------------------------------------------ the alley
     Dragon Alley (tshcity.js) is eighteen metres wide, walls at x -49 and -31:
     the fight runs up and down it, between the mouth and the bend. */
  const ARENA = { x1:-48.5, x2:-31.5, z1:-37.5, z2:-13.5 };
  const MEET = { robin:[-41.4, -24.6], buyer:[-41.6, -28.6] };

  /* ------------------------------------------------------------ her moves
     `hit` is how far through the clip the blow lands, `free` when the next
     move may start; `reach` is in metres; `push` shoves, `fly` throws. */
  const MOVE = {
    jab:     { clip:'jab',     speed:1.7, hit:0.40, free:0.62, dmg:1,   reach:1.75, push:0.45, shake:0.05 },
    cross:   { clip:'cross',   speed:2.8, hit:0.30, free:0.48, dmg:1,   reach:1.85, push:0.55, shake:0.06 },
    hook:    { clip:'hook',    speed:2.6, hit:0.31, free:0.50, dmg:1.5, reach:1.85, push:0.8,  shake:0.09 },
    kick:    { clip:'kick',    speed:2.3, hit:0.36, free:0.58, dmg:2,   reach:2.1,  push:1.6,  shake:0.17, down:true },
    power:   { clip:'power',   speed:2.3, hit:0.32, free:0.60, dmg:4,   reach:2.1,  fly:12,    shake:0.45, down:true },
    flykick: { clip:'flykick', speed:1.5, hit:0.46, free:0.80, dmg:3,   reach:2.4,  fly:8,     shake:0.32, down:true },
    counter: { clip:'hook',    speed:2.6, hit:0.31, free:0.50, dmg:3,   reach:1.9,  push:1.2,  shake:0.2,  down:true },
    knee:    { clip:'knee',    speed:2.6, hit:0.27, free:0.46, dmg:1.5, reach:1.6,  push:0.7,  shake:0.1 },
    elbow:   { clip:'elbow',   speed:2.2, hit:0.30, free:0.50, dmg:1.5, reach:1.6,  push:0.9,  shake:0.1 },
    zip:     { clip:'flykick', speed:1.5, hit:0.46, free:0.74, dmg:2,   reach:2.3,  push:1.8,  shake:0.22, down:true },
    spin:    { clip:'spin',    speed:1.3, hit:0.42, free:0.74, dmg:2,   reach:2.3,  push:1.6,  shake:0.26, down:true, area:true },
    sweep:   { clip:'sweep',   speed:2.0, hit:0.36, free:0.60, dmg:1,   reach:2.1,  push:0.6,  shake:0.18, down:true, area:true }
  };
  const CHAIN = ['jab', 'cross', 'hook', 'kick'];
  /* WHAT A CLICK THROWS once she knows how (after the lessons): it depends where he is and what he is doing.
     Close in, a string — a different one each time a combo starts, so no two run the same; every fifth hit
     is a finisher; a man left wide open gets the knee and the elbow; a man across the alley, the flying kick. */
  const STRINGS = [CHAIN, ['jab', 'elbow', 'cross', 'kick'], ['cross', 'hook', 'knee', 'elbow'], ['jab', 'jab', 'hook', 'knee'], ['elbow', 'cross', 'hook', 'kick']];
  const FAR = 4.6, AIM_RANGE = 8;
  /* GETTING OUT OF THE WAY, by the direction held with SPACE (from where the camera looks): A or D, a
     cartwheel that way (her back to you either way: the left hand leads one, the right the other); S, a
     backflip, still facing them; W, a roll forward; nothing held, the sidestep. `go` is how far it takes
     her, `iframe` how long nothing lands on her. A click during one, or just after, comes out of it as a
     sweep along the ground. `wall` is the push off a wall before the flying kick (dodge, below). */
  const EVADE = {
    cartL: { clip:'cartL',    speed:2.6,  go:3.8, iframe:0.5,  travel:0.85 },
    cartR: { clip:'cartR',    speed:2.6,  go:3.8, iframe:0.5,  travel:0.85 },
    flip:  { clip:'bflip',    speed:2.5,  go:3.4, iframe:0.5,  travel:0.8, back:true },
    roll:  { clip:'evroll',   speed:2.2,  go:3.6, iframe:0.45, travel:0.8 },
    wall:  { clip:'wallkick', speed:2.6 },
    vault: { clip:'evflip',   speed:1.7 }
  };

  /* ------------------------------------------------------------ the crew */
  const KIND = {
    buyer: { char:'thug-buyer', hp:6, dmg:0,  windup:0.7,  walk:1.4, run:4.0 },
    big:   { char:'thug-a',     hp:5, dmg:16, windup:0.80, walk:1.2, run:3.6 },
    lean:  { char:'thug-b',     hp:3, dmg:11, windup:0.58, walk:1.6, run:4.5 }
  };

  let ctx = null, on = false, ready = false, el = null, E = [], fx = [], dir = null, nextId = 1;
  const R = {};                                   // Robin, in the fight
  let stopT = 0, stopScale = 0.03;                // hit-stop
  const ramp = { to:1, rate:6 };                  // the speed ramp: G.timeScale eases to `to`, in real time
  const input = { held:false, heldT:0, wantAttack:false, wantPower:false };

  /* ============================================================ the cast */
  function spawn(kind, x, z, o){
    o = o || {};
    const K = KIND[kind];
    const e = { id:nextId++, kind, K, hp:o.hp || K.hp, max:o.hp || K.hp, x, z, y:0, vx:0, vy:0, vz:0, yaw:o.yaw === undefined ? 0 : o.yaw,
                state:o.state || 'idle', t:0, model:null, rig:null, g:new THREE.Group(), weapon:!!o.weapon, grabber:!!o.grabber, cool:rnd(1.2, 2.6),
                clip:null, tell:null, pipe:null, active:!!o.active, tag:o.tag || null, wantRing:rnd(2.5, 3.4), side:Math.random() < 0.5 ? -1 : 1 };
    ctx.group.add(e.g); e.g.position.set(x, 0, z);
    if(o.hidden) e.g.visible = false;
    if(window.AVATAR) AVATAR.load(K.char).then(m=>{
      if(!ready || !e.g.parent){ return; }
      e.model = m; e.rig = m.userData.rig; e.g.add(m);
      if(e.rig && e.rig.add) e.rig.add([], { once:['jab', 'cross', 'hook', 'kick', 'block', 'hit', 'stagger', 'fall', 'getup', 'ko', 'roar'] });
      m.traverse(n=>{ if(n.isMesh) n.castShadow = true; });
      if(o.hat && window.WARDROBE) WARDROBE.put(m, K.char, o.hat);
      if(e.weapon) e.pipe = pipe(m);
      play(e, e.clipWant || (e.state === 'talk' ? 'talk' : e.state === 'idle' || e.state === 'watch' ? 'idle' : 'fight'), 0);
    }).catch(()=>{});
    E.push(e);
    return e;
  }
  function despawnAll(){ E.forEach(e=>{ if(e.g.parent) e.g.parent.remove(e.g); if(e.tell && e.tell.parent) e.tell.parent.remove(e.tell); }); E = []; }
  /* a length of pipe in his right hand */
  function pipe(m){
    let hand = null; m.traverse(o=>{ if(!hand && /RightHand$/.test(o.name || '')) hand = o; }); if(!hand) return null;
    m.updateMatrixWorld(true);
    const s = new THREE.Vector3(); hand.getWorldScale(s);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.85, 8), new THREE.MeshStandardMaterial({ color:0x4a4d4f, roughness:0.45, metalness:0.75 }));
    p.scale.setScalar(1/(s.x || 1)); p.position.set(0, 0.05/(s.x || 1), 0.25/(s.x || 1)); p.rotation.x = Math.PI/2.4;
    hand.add(p);
    return p;
  }
  function play(e, name, fade){ e.clipWant = name; if(!e.rig) return; if(e.clip !== name){ e.clip = name; e.rig.play(name, fade === undefined ? 0.15 : fade); } }
  function hit1(e, name){ e.clipWant = name; if(!e.rig) return 0; e.clip = name; return e.rig.restart(name, 0.06); }
  const standing = e => !['down', 'ko', 'flying', 'getup', 'gone'].includes(e.state) && e.kind !== 'buyer';
  const alive = () => E.filter(standing);

  /* ============================================================ Robin */
  function resetRobin(){
    Object.assign(R, { act:null, t:0, len:0, move:null, target:null, chain:0, chainT:0, buffer:null, hp:100, hurtT:9, iframe:0, parryT:0,
      blocking:false, grabbedBy:null, sinceDodge:9, pulseCd:0, pullCd:0, powerCd:0, combo:0, comboT:0, face:G.yaw - Math.PI, dash:null, hits:0, lastHitT:9, onlyKey:null });
  }
  const P = () => ({ x:G.pos.x, z:G.pos.z, y:G.pos.y - EYE });
  const rig = () => window.AVATAR && AVATAR.model && AVATAR.model.userData.rig;
  function robinClip(name, once){
    if(!window.AVATAR) return 0;
    AVATAR.posture(name);
    const r = rig(); if(!r) return 0;
    return once ? r.restart(name, 0.06) : (r.play(name, 0.12), r.seconds(name));
  }
  /* who she means: the nearest standing one within `range`, nearest her facing first */
  function pickTarget(range, cone){
    const p = P(), look = G.yaw + Math.PI;
    let best = null, bs = Infinity;
    alive().forEach(e=>{
      const d = Math.hypot(e.x - p.x, e.z - p.z); if(d > range) return;
      const a = Math.abs(angDiff(angTo(p.x, p.z, e.x, e.z), look));
      if(cone && a > cone) return;
      const s = d + a*1.6; if(s < bs){ bs = s; best = e; }
    });
    return best;
  }
  /* AIM: where you are pointing — the camera, turned by the mouse, and nudged by the direction you hold (W at
     the one ahead, A at the one on the left, like the stick in Spider-Man) */
  function aimDir(){
    const k = G.keys; let fx = 0, fz = 0;
    if(k.KeyW || k.ArrowUp) fz += 1; if(k.KeyS || k.ArrowDown) fz -= 1; if(k.KeyA || k.ArrowLeft) fx -= 1; if(k.KeyD || k.ArrowRight) fx += 1;
    const look = G.yaw + Math.PI;
    if(!fx && !fz) return look;
    return look + Math.atan2(-fx, fz);
  }
  /* who you are pointing at: the one nearest the line you point along, near ones a little first; he keeps the
     mark until somebody is plainly a better pick, so it does not flicker between two standing side by side */
  function aimScore(e, a){
    if(dir && !dir.free && !e.active) return Infinity;      // while she learns, only the ones the lesson sends at her
    const p = P(), d = Math.hypot(e.x - p.x, e.z - p.z); if(d > AIM_RANGE) return Infinity;
    const off = Math.abs(angDiff(angTo(p.x, p.z, e.x, e.z), a));
    if(off > (d < 2.2 ? Math.PI : 1.05)) return Infinity;           // right next to her, anyone will do
    return off*2.4 + d*0.16;
  }
  function aimTarget(){
    const a = aimDir();
    let best = null, bs = Infinity;
    alive().forEach(e=>{ const s = aimScore(e, a); if(s < bs){ bs = s; best = e; } });
    const cur = R.aim && standing(R.aim) ? R.aim : null, cs = cur ? aimScore(cur, a) : Infinity;
    R.aim = (cur && cs < Infinity && cs <= bs + 0.35) ? cur : best;
    return R.aim;
  }
  /* the mark under his feet */
  let mark = null;
  function markOn(){
    if(mark) return mark;
    mark = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 40), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending }));
    mark.rotation.x = -Math.PI/2; mark.renderOrder = 5;
    return mark;
  }
  function tickMark(real){
    const t = R.act === 'attack' && R.target && standing(R.target) ? R.target : R.aim;
    const m = markOn();
    if(!t || !standing(t) || (dir && dir.freeze)){ if(m.parent) m.parent.remove(m); return; }
    if(m.parent !== ctx.group) ctx.group.add(m);
    m.position.set(t.x, 0.04 + (t.y || 0), t.z);
    R.markT = (R.markT || 0) + real;
    m.scale.setScalar(1 + Math.sin(R.markT*7)*0.06);
    // orange when he is about to swing: that is the one to dodge, or parry
    m.material.color.setHex(t.state === 'windup' ? 0xffa040 : 0xffffff);
  }
  /* which move a click throws at him (see STRINGS) */
  function choose(t){
    if(!dir || !dir.free){                                 // the lessons teach the chain as it is written down
      if(R.chainT > 0 && R.chain > 0 && R.chain < CHAIN.length){ return CHAIN[R.chain++]; }
      R.chain = 1; return 'jab';
    }
    const p = P(), d = t ? Math.hypot(t.x - p.x, t.z - p.z) : 0;
    if(R.outOfEvade){ R.outOfEvade = false; if(!t || d < 3){ R.chain = 0; return 'sweep'; } }
    if(t && d > FAR){ R.chain = 0; return 'zip'; }
    const going = R.chainT > 0 && R.chain > 0;
    if(!going){ R.string = STRINGS[Math.floor(Math.random()*STRINGS.length)]; R.chain = 0; }
    const near = alive().filter(e=>Math.hypot(e.x - p.x, e.z - p.z) < 2.3).length;
    // every fifth hit: a finisher — round on all of them if there are two or more close, else the roundhouse
    if(R.combo > 0 && (R.combo + 1) % 5 === 0){ R.chain = 0; return near >= 2 ? (Math.random() < 0.6 ? 'spin' : 'sweep') : 'kick'; }
    // he is wide open (parried, dodged, pulled in): knee, then elbow
    if(t && t.state === 'stagger' && t.parried && d < 2.2){ const n = R.lastMove === 'knee' ? 'elbow' : 'knee'; R.chain++; return n; }
    const s = R.string || CHAIN, n = s[R.chain % s.length]; R.chain++;
    return n;
  }

  /* ------------------------------------------------------------ moving */
  function walkRobin(dt){
    const k = G.keys; let fx = 0, fz = 0;
    if(k.KeyW || k.ArrowUp) fz += 1; if(k.KeyS || k.ArrowDown) fz -= 1; if(k.KeyA || k.ArrowLeft) fx -= 1; if(k.KeyD || k.ArrowRight) fx += 1;
    if(!fx && !fz) return false;
    const fwd = V(-Math.sin(G.yaw), 0, -Math.cos(G.yaw)), right = V(Math.cos(G.yaw), 0, -Math.sin(G.yaw));
    const d = fwd.multiplyScalar(fz).add(right.multiplyScalar(fx)).normalize();
    const run = k.ShiftLeft || k.ShiftRight, sp = run ? 4.8 : 2.7;
    moveTo(G.pos.x + d.x*sp*dt, G.pos.z + d.z*sp*dt);
    R.face = turnTo(R.face, Math.atan2(d.x, d.z), dt*12);
    robinClip(run ? 'sprint' : 'walk');
    return true;
  }
  function turnTo(a, b, k){ return a + angDiff(b, a)*Math.min(1, k); }
  /* inside the alley, outside anything parked in it */
  function moveTo(x, z){
    const p = clampArena(x, z);
    G.pos.x = p[0]; G.pos.z = p[1];
  }
  function clampArena(x, z, r){
    r = r === undefined ? 0.35 : r;
    x = clamp(x, ARENA.x1, ARENA.x2); z = clamp(z, ARENA.z1, ARENA.z2);
    for(const s of (ctx.blocks || [])){
      if(x > s.x1 - r && x < s.x2 + r && z > s.z1 - r && z < s.z2 + r){
        const dx1 = x - (s.x1 - r), dx2 = (s.x2 + r) - x, dz1 = z - (s.z1 - r), dz2 = (s.z2 + r) - z, m = Math.min(dx1, dx2, dz1, dz2);
        if(m === dx1) x = s.x1 - r; else if(m === dx2) x = s.x2 + r; else if(m === dz1) z = s.z1 - r; else z = s.z2 + r;
      }
    }
    return [x, z];
  }

  /* ------------------------------------------------------------ her actions */
  const name0 = kind => kind === 'power' ? 5.5 : 4.6;
  function attack(kind){
    if(R.act === 'dodge' && R.evade && kind === 'punch'){ R.buffer = kind; return false; }
    if(R.grabbedBy || R.act === 'hurt' || R.act === 'dodge' || R.act === 'vault' || R.act === 'wall') return false;
    if(R.act && R.act !== 'idle'){ const m = MOVE[R.move]; if(m && R.t < R.len*m.free){ R.buffer = kind; return false; } }
    // who: the one a lesson is about, else the one you are aiming at, else whoever is close in front of her
    const t = (R.forceTarget && standing(R.forceTarget)) ? R.forceTarget : (aimTarget() || pickTarget(name0(kind), 1.6));
    let name = kind;
    if(kind === 'punch'){ if(R.evadeEnd !== undefined && !R.outOfEvade){ R.outOfEvade = true; R.evadeEnd = undefined; } name = choose(t); R.chainT = 1.1; }
    const m = MOVE[name];
    R.act = 'attack'; R.move = name; R.lastMove = name; R.t = 0; R.target = t; R.landed = false;
    R.len = robinClip(m.clip, true) || 0.6;
    if(t){
      const p = P(), d = Math.hypot(t.x - p.x, t.z - p.z), a = angTo(p.x, p.z, t.x, t.z);
      R.face = a;
      if(name === 'zip'){
        // across the alley at him, feet first, landing on him as the kick lands
        const go = Math.max(0, d - 1.3);
        R.dash = { x0:p.x, z0:p.z, x1:p.x + Math.sin(a)*go, z1:p.z + Math.cos(a)*go, t:0, len:R.len*m.hit, arc:0.9 };
        R.iframe = Math.max(R.iframe, R.len*m.hit); slowFor(0.4, 0.35);
      }
      // close the gap: a step, or a lunge if he is a few metres off
      else if(d > m.reach - 0.3){ const go = Math.min(d - (m.reach - 0.55), 3.8); R.dash = { x0:p.x, z0:p.z, x1:p.x + Math.sin(a)*go, z1:p.z + Math.cos(a)*go, t:0, len:clamp(go*0.06, 0.08, 0.22) }; }
    }
    ctx.cue(name === 'power' ? 'boom' : 'swish');
    return true;
  }
  function dodge(){
    if(R.grabbedBy || R.act === 'dodge' || R.act === 'vault' || R.act === 'wall') return false;
    const k = G.keys; let fx = 0, fz = 0;
    if(k.KeyW) fz += 1; if(k.KeyS) fz -= 1; if(k.KeyA) fx -= 1; if(k.KeyD) fx += 1;
    const p = P();
    let a;
    if(fx || fz){ const fwd = V(-Math.sin(G.yaw), 0, -Math.cos(G.yaw)), right = V(Math.cos(G.yaw), 0, -Math.sin(G.yaw)); const d = fwd.multiplyScalar(fz).add(right.multiplyScalar(fx)); a = Math.atan2(d.x, d.z); }
    else { const th = threat(); a = th ? angTo(th.x, th.z, p.x, p.z) : R.face + Math.PI; }
    // toward a man, close: over him
    const over = alive().find(e=>{ const d = Math.hypot(e.x - p.x, e.z - p.z); return d < 2.1 && Math.abs(angDiff(angTo(p.x, p.z, e.x, e.z), a)) < 0.6; });
    if(over){
      const b = angTo(p.x, p.z, over.x, over.z), land = clampArena(over.x + Math.sin(b)*1.3, over.z + Math.cos(b)*1.3);
      const vl = robinClip(EVADE.vault.clip, true) || 0.62;
      R.act = 'vault'; R.t = 0; R.len = vl; R.iframe = vl + 0.1; R.dash = { x0:p.x, z0:p.z, x1:land[0], z1:land[1], t:0, len:vl*0.95, arc:1.9 };
      R.face = b; R.sinceDodge = 0; ctx.cue('kick'); slowFor(0.35, 0.5);
      if(over.state !== 'stagger'){ over.state = 'stagger'; over.t = 0; hit1(over, 'stagger'); }
      event('vault'); return true;
    }
    // toward a wall: off it, and onto whoever is nearest
    const wx = p.x + Math.sin(a)*1.2, wz = p.z + Math.cos(a)*1.2;
    const t = pickTarget(9, 3.2);
    if(t && (wx < ARENA.x1 + 0.05 || wx > ARENA.x2 - 0.05)){
      // to the wall, a foot on it, and push off it, turning round in the air (then the flying kick, in tick)
      const w = clampArena(wx, wz); R.dash = { x0:p.x, z0:p.z, x1:w[0], z1:w[1], t:0, len:0.22 };
      R.act = 'wall'; R.t = 0; R.len = Math.min(0.55, (robinClip(EVADE.wall.clip, true) || 0.5)*0.8); R.iframe = 0.9; R.wallTo = t;
      R.face = a; R.sinceDodge = 0; ctx.cue('kick');
      event('wall'); return true;
    }
    // with a direction: a cartwheel to the side, a flip away, a roll forward
    const kind = !(fx || fz) ? null : Math.abs(fx) >= Math.abs(fz) ? (fx < 0 ? 'cartL' : 'cartR') : fz < 0 ? 'flip' : 'roll';
    if(kind){
      const v = EVADE[kind], to = clampArena(p.x + Math.sin(a)*v.go, p.z + Math.cos(a)*v.go);
      const len = robinClip(v.clip, true) || 1;
      R.act = 'dodge'; R.evade = kind; R.t = 0; R.len = len; R.iframe = v.iframe; R.buffer = null;
      R.dash = { x0:p.x, z0:p.z, x1:to[0], z1:to[1], t:0, len:len*v.travel };
      // a cartwheel and a roll go the way she faces (the cartwheel turns her side-on by itself); the backflip goes back
      R.face = v.back ? a + Math.PI : a;
      R.sinceDodge = 0; ctx.cue('swish'); slowFor(0.55, 0.25);
      event('dodge');
      return true;
    }
    const to = clampArena(p.x + Math.sin(a)*2.6, p.z + Math.cos(a)*2.6);
    R.act = 'dodge'; R.evade = null; R.t = 0; R.len = 0.42; R.iframe = 0.42; R.dash = { x0:p.x, z0:p.z, x1:to[0], z1:to[1], t:0, len:0.3 };
    R.sinceDodge = 0; robinClip('dodge', true); ctx.cue('swish');
    event('dodge');
    return true;
  }
  function parry(){
    if(R.grabbedBy) return false;
    R.parryT = 0.32; R.blocking = true;
    if(!R.act || R.act === 'idle'){ R.act = 'block'; R.t = 0; R.len = 0.5; robinClip('block', true); }
    return true;
  }
  /* THE PULSE: the bangle throws everyone near her off */
  function pulse(){
    if(R.pulseCd > 0){ ctx.note('✋ The bangle is still charging.', 'warn'); return false; }
    R.pulseCd = 5;
    const p = P();
    ring(V(p.x, p.y + 0.15, p.z), 3.8, 0x8ff0ff, 0.55, true);
    glow(V(p.x, p.y + 1.1, p.z), 0x8ff0ff, 1.6, 0.4);
    ctx.flash(0.7); ctx.cue('flash'); shake(0.5, 0.45); hitstop(0.09);
    slowFor(0.2, 0.9);
    alive().forEach(e=>{ const d = Math.hypot(e.x - p.x, e.z - p.z); if(d < 3.8){ throwOff(e, angTo(p.x, p.z, e.x, e.z), d < 1.6 ? 11 : 6, 1); } });
    if(R.grabbedBy){ const g = R.grabbedBy; R.grabbedBy = null; R.act = null; throwOff(g, angTo(p.x, p.z, g.x, g.z), 12, 1); }
    robinClip('fight');
    event('pulse');
    return true;
  }
  /* THE PULL: the gauntlet casts a line at one of them and drags him in */
  function pull(){
    if(R.grabbedBy || (R.act && R.act !== 'idle')) return false;
    if(R.pullCd > 0){ ctx.note('🦎 The gauntlet needs a second.', 'warn'); return false; }
    const t = (R.forceTarget && standing(R.forceTarget)) ? R.forceTarget : aimTarget() || pickTarget(15, 0.6) || pickTarget(15, 3.2);
    if(!t){ ctx.note('🦎 Nobody in reach of the line.', 'warn'); return false; }
    const p = P();
    R.pullCd = 1.6; R.act = 'pull'; R.t = 0; R.len = 0.55; R.face = angTo(p.x, p.z, t.x, t.z);
    robinClip('jab', true);
    t.state = 'pulled'; t.t = 0; t.from = [t.x, t.z]; const a = R.face; t.to = clampArena(p.x + Math.sin(a)*1.05, p.z + Math.cos(a)*1.05, 0.2);
    hit1(t, 'stagger');
    tether(t);
    ctx.cue('grab'); slowFor(0.3, 0.55); shake(0.12, 0.2);
    event('pull');
    return true;
  }
  function threat(){ let best = null, bd = Infinity; const p = P(); E.forEach(e=>{ if(e.state !== 'windup') return; const d = Math.hypot(e.x - p.x, e.z - p.z); if(d < bd){ bd = d; best = e; } }); return best || pickTarget(4, 3.2); }

  /* the blow lands (or does not) */
  function land(){
    const m = MOVE[R.move]; R.landed = true;
    const p = P();
    // a kick round in a circle, or a sweep along the ground, takes everyone in reach
    if(m.area){
      const all = alive().filter(e=>Math.hypot(e.x - p.x, e.z - p.z) <= m.reach + 0.3);
      if(!all.length){ ctx.cue('swish'); return; }
      ring(V(p.x, p.y + (R.move === 'sweep' ? 0.12 : 0.9), p.z), m.reach + 0.4, 0xffffff, 0.3, true);
      all.forEach(e=>landOn(e, m, p)); return;
    }
    const t = R.target;
    if(!t || !standing(t)){ return; }
    const d = Math.hypot(t.x - p.x, t.z - p.z);
    if(d > m.reach + 0.45) { ctx.cue('swish'); return; }
    landOn(t, m, p);
  }
  function landOn(t, m, p){
    // the one a lesson is about turns her punches aside until that lesson has happened: you learn the move, not skip it
    if(t.guard && t.guard()){ spark(V(lerp(p.x, t.x, 0.6), p.y + 1.4, lerp(p.z, t.z, 0.6)), 0xffe0a0, 5); ctx.cue('clang'); shake(0.05, 0.1);
      if(t.state !== 'windup'){ t.state = 'stagger'; t.t = 0.3; t.vx = t.vz = 0; hit1(t, 'block'); } return; }
    // the chain: every link that connects hits a little harder
    let dmg = m.dmg * (R.counterReady ? 2 : 1);
    R.counterReady = false;
    t.hp -= dmg; R.hits++; R.combo++; R.comboT = 2.2; R.lastHitT = 0;
    const a = angTo(p.x, p.z, t.x, t.z), at = V(lerp(p.x, t.x, 0.7), p.y + 1.35, lerp(p.z, t.z, 0.7));
    spark(at, R.move === 'power' ? 0x9ff6ff : 0xffffff, R.move === 'power' ? 22 : 9);
    ctx.cue(m.fly ? 'boom' : 'punch');
    const big = m.fly || m.down || t.hp <= 0;
    hitstop(big ? 0.11 : 0.055); shake(m.shake * (t.hp <= 0 ? 1.4 : 1), big ? 0.32 : 0.16); camPunch(big ? 1 : 0.45);
    if(m.fly){ let ta = a;
      // toward the car, if it is close to where she is hitting him anyway
      if(ctx.car){ const ca = angTo(t.x, t.z, ctx.car.x, ctx.car.z); if(Math.abs(angDiff(ca, a)) < 1.1 && Math.hypot(ctx.car.x - t.x, ctx.car.z - t.z) < 11) ta = ca; }
      throwOff(t, ta, m.fly, 1.2); ring(at, 1.6, 0x9ff6ff, 0.35, false, a); slowFor(R.move === 'power' ? 0.12 : 0.25, 0.9); ctx.flash(0.35);
    }
    else if(m.down || t.hp <= 0){ knock(t, a, m.push); if(t.hp <= 0) slowFor(0.35, 0.5); }
    else { t.state = 'stagger'; t.t = 0; t.vx = Math.sin(a)*m.push*3; t.vz = Math.cos(a)*m.push*3; hit1(t, 'hit'); }
    event('hit', { move:R.move, target:t, chain:R.chain });
    combo();
  }
  function knock(e, a, push){
    e.state = 'down'; e.t = 0; e.vx = Math.sin(a)*(push || 1)*3.2; e.vz = Math.cos(a)*(push || 1)*3.2;
    hit1(e, 'fall'); tellOff(e);
    if(e.hp <= 0) event('ko', { target:e });
  }
  function throwOff(e, a, speed, up){
    e.state = 'flying'; e.t = 0; e.vx = Math.sin(a)*speed; e.vz = Math.cos(a)*speed; e.vy = 3.2*(up || 1); e.yaw = a + Math.PI;
    if(e.hp > 0 && e.state !== 'ko') e.hp = Math.max(0, e.hp - 1.5);
    hit1(e, 'fall'); tellOff(e);
    if(e.pipe && e.pipe.parent){ dropPipe(e); }
  }
  /* she is hit */
  function hurt(e, dmg){
    if(R.blocking && R.act === 'block'){ dmg *= 0.2; spark(V(G.pos.x, G.pos.y - 0.3, G.pos.z), 0x9ff6ff, 6); ctx.cue('clang'); shake(0.08, 0.12); R.hp -= dmg; return; }
    R.hp -= dmg; R.hurtT = 0; R.chain = 0; R.chainT = 0; R.combo = 0; R.buffer = null;
    if(R.grabbedBy) return;
    R.act = 'hurt'; R.t = 0; R.len = 0.42; robinClip('hit', true);
    const a = angTo(e.x, e.z, G.pos.x, G.pos.z); R.dash = { x0:G.pos.x, z0:G.pos.z, x1:G.pos.x + Math.sin(a)*0.7, z1:G.pos.z + Math.cos(a)*0.7, t:0, len:0.2 };
    ctx.cue('hurt'); shake(0.28, 0.3); hitstop(0.07); red(0.55);
    if(R.hp <= 0) beaten();
  }
  function beaten(){
    R.act = 'down'; R.t = 0; robinClip('fall', true); slowTo(0.25, 6);
    ctx.later(()=>{ if(!on) return; ctx.fade(()=>{
      R.hp = 100; R.act = null; robinClip('fight');
      const p = MEET.robin; G.pos.x = p[0]; G.pos.z = p[1];
      alive().forEach((e, i)=>{ e.state = 'circle'; e.t = 0; e.cool = 2 + i*0.6; });
      slowTo(1, 4); ctx.note('Back on your feet. They are still here.', 'warn');
    }); }, 1100);
  }

  /* ============================================================ the crew, thinking */
  function tickCrew(dt){
    const p = P();
    // who gets to swing: one at a time while she learns, two once she knows how
    const swingers = E.filter(e=>e.state === 'windup' || e.state === 'approach').length;
    const maxSwing = dir && dir.free ? 2 : 1;
    E.forEach(e=>{
      const held = dir && dir.freeze && dir.freeze.target === e && (e.state === 'windup' || e.state === 'grab');
      if(!held) e.t += dt;                         // the swing a lesson is frozen on hangs there, a foot from her face, until the key
      const d = Math.hypot(e.x - p.x, e.z - p.z), toHer = angTo(e.x, e.z, p.x, p.z);
      switch(e.state){
        case 'idle': case 'talk': case 'watch': {
          // the buyer keeps out of it: back to his corner, and out of her way
          const home = e.home, far = home ? Math.hypot(home[0] - e.x, home[1] - e.z) : 0;
          if(e.state === 'watch' && home && far > 0.3){ step(e, angTo(e.x, e.z, home[0], home[1]), e.K.walk*1.4, dt); play(e, 'walk'); break; }
          e.yaw = turnTo(e.yaw, toHer, dt*4);
          if(e.state === 'watch' && d < 2.2) step(e, toHer + Math.PI, e.K.walk, dt, true);     // give her room
          play(e, e.state === 'talk' ? 'talk' : e.state === 'idle' ? 'idle' : e.kind === 'buyer' ? 'idle' : 'fight'); break;
        }
        case 'circle': {
          // keep a ring round her, drift sideways, wait a turn
          e.yaw = turnTo(e.yaw, toHer, dt*6);
          const off = d - e.wantRing;
          let mx = 0, mz = 0;
          if(Math.abs(off) > 0.35){ const s = Math.sign(off); mx += Math.sin(toHer)*s; mz += Math.cos(toHer)*s; }
          const sa = toHer + Math.PI/2*e.side; mx += Math.sin(sa)*0.45; mz += Math.cos(sa)*0.45;
          if(e.t > rnd(2, 4)){ e.side *= -1; e.t = 0; }
          const moving = Math.hypot(mx, mz) > 0.3;
          if(moving) step(e, Math.atan2(mx, mz), e.K.walk*0.8, dt, true);
          play(e, moving ? (Math.abs(off) > 0.35 ? (off > 0 ? 'walk' : 'walk_back') : (e.side > 0 ? 'walk_left' : 'walk_right')) : 'fight');
          e.cool -= dt;
          if(e.active && e.cool <= 0 && swingers < maxSwing && !(dir && dir.hold) && !R.grabbedBy){ e.state = 'approach'; e.t = 0; }
          break;
        }
        case 'approach': {
          e.yaw = turnTo(e.yaw, toHer, dt*8);
          const reach = e.grabber ? 0.9 : 1.55;
          if(d > reach){ step(e, toHer, d > 3 ? e.K.run : e.K.walk*1.6, dt); play(e, d > 3 ? 'sprint' : 'walk'); }
          if(d <= reach + 0.05){
            if(e.grabber){ grab(e); break; }
            e.state = 'windup'; e.t = 0; e.win = e.weapon ? 0.95 : e.K.windup;
            const len = hit1(e, e.weapon ? 'hook' : (Math.random() < 0.5 ? 'hook' : 'cross'));
            e.strikeAt = Math.min(e.win, len*0.42);
            tellOn(e);
            event('windup', { e });
          }
          if(e.t > 6){ e.state = 'circle'; e.t = 0; e.cool = rnd(1, 2); }
          break;
        }
        case 'windup': {
          e.yaw = turnTo(e.yaw, toHer, dt*(e.t < e.strikeAt*0.6 ? 6 : 1));
          if(e.t >= e.strikeAt){ strike(e); }
          break;
        }
        case 'recover': { if(e.t > 0.6){ e.state = 'circle'; e.t = 0; e.cool = rnd(1.4, 2.8) * (dir && dir.free ? 0.8 : 1.4); } break; }
        case 'stagger': {
          e.x += e.vx*dt; e.z += e.vz*dt; e.vx *= Math.exp(-dt*8); e.vz *= Math.exp(-dt*8);
          if(e.t > (e.parried ? 1.7 : 0.6)){ e.parried = false; e.state = 'circle'; e.t = 0; e.cool = rnd(0.8, 1.8); }
          break;
        }
        case 'pulled': {
          const k = clamp(e.t/0.34, 0, 1), q = k*k;
          e.x = lerp(e.from[0], e.to[0], q); e.z = lerp(e.from[1], e.to[1], q); e.yaw = toHer;
          e.y = Math.sin(k*Math.PI)*0.35;
          if(k >= 1){ e.y = 0; e.state = 'stagger'; e.t = 0; e.vx = e.vz = 0; e.parried = true; shake(0.2, 0.2); hitstop(0.06); spark(V(e.x, 1.2, e.z), 0x8ff0ff, 10); ctx.cue('punch'); }
          break;
        }
        case 'flying': {
          e.x += e.vx*dt; e.z += e.vz*dt; e.y += e.vy*dt; e.vy -= 18*dt;
          const c = crash(e);
          if(c || e.y <= 0){ e.y = Math.max(0, e.y);
            if(c){ shake(c === 'car' ? 0.5 : 0.3, 0.35); hitstop(0.07); ctx.cue('boom'); if(c === 'car'){ carHit(); event('car'); } spark(V(e.x, e.y + 1, e.z), 0xffe0a0, 12); }
            e.state = 'down'; e.t = 0; e.vx *= 0.2; e.vz *= 0.2; }
          break;
        }
        case 'down': {
          e.x += e.vx*dt; e.z += e.vz*dt; e.vx *= Math.exp(-dt*5); e.vz *= Math.exp(-dt*5); e.y = Math.max(0, e.y - dt*4);
          if(e.hp <= 0){ if(e.t > 0.9 && e.clip !== 'ko'){ e.state = 'ko'; hit1(e, 'ko'); if(e.rig) e.rig.update(9); } }
          else if(e.t > 2.4 && !(dir && dir.hold)){ e.state = 'getup'; e.t = 0; hit1(e, 'getup'); }
          break;
        }
        case 'getup': { if(e.t > 1.5){ e.state = 'circle'; e.t = 0; e.cool = rnd(1.5, 3); } break; }
        case 'grab': {
          // he has her from behind: she does not move, he does not let go
          const a = R.face + Math.PI; e.x = G.pos.x + Math.sin(a)*0.55; e.z = G.pos.z + Math.cos(a)*0.55; e.yaw = R.face;
          if(e.t > 3.2 && !(dir && dir.hold)){ R.grabbedBy = null; R.act = null; hurt(e, 14); e.state = 'recover'; e.t = 0; }
          break;
        }
        case 'hesitate': {
          e.yaw = turnTo(e.yaw, toHer, dt*5);
          if(d < 4.6){ step(e, toHer + Math.PI, 0.7, dt, true); play(e, 'walk_back'); } else play(e, 'fight');
          break;
        }
      }
      // apart from each other, in the alley, on the ground
      if(!['flying', 'pulled', 'grab'].includes(e.state)) E.forEach(o=>{ if(o === e || o.state === 'ko' || e.state === 'ko') return; const dx = e.x - o.x, dz = e.z - o.z, dd = Math.hypot(dx, dz); if(dd > 0 && dd < 0.8){ e.x += dx/dd*(0.8 - dd)*0.5; e.z += dz/dd*(0.8 - dd)*0.5; } });
      if(e.state !== 'flying'){ const c = clampArena(e.x, e.z, 0.3); e.x = c[0]; e.z = c[1]; }
      e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw;
      if(e.rig) e.rig.update(held ? 0 : dt);
      if(e.tell) e.tell.position.set(e.x, e.y + 2.3, e.z);
    });
  }
  function step(e, a, sp, dt, keepFacing){ e.x += Math.sin(a)*sp*dt; e.z += Math.cos(a)*sp*dt; if(!keepFacing) e.yaw = turnTo(e.yaw, a, dt*8); }
  function strike(e){
    const p = P(), d = Math.hypot(e.x - p.x, e.z - p.z), a = Math.abs(angDiff(angTo(e.x, e.z, p.x, p.z), e.yaw));
    tellOff(e); e.state = 'recover'; e.t = 0;
    // a swing at where she was a moment ago is a dodge, however far the dodge took her
    if(d > 2.1 || a > 1.0){ ctx.cue('swish'); event('whiff', { e, dodged:R.sinceDodge < 0.9 }); return; }
    if(R.parryT > 0){ parried(e); return; }
    if(R.iframe > 0){ ctx.cue('swish'); event('whiff', { e, dodged:true }); return; }
    hurt(e, e.weapon ? 22 : e.K.dmg);
    event('hurt', { e });
  }
  function parried(e){
    e.state = 'stagger'; e.t = 0; e.parried = true; hit1(e, 'stagger');
    const p = P(), a = angTo(p.x, p.z, e.x, e.z); e.vx = Math.sin(a)*1.8; e.vz = Math.cos(a)*1.8;
    spark(V(lerp(p.x, e.x, 0.45), p.y + 1.5, lerp(p.z, e.z, 0.45)), 0x9ff6ff, 16); ctx.cue('clang');
    hitstop(0.12); shake(0.3, 0.3); slowFor(0.2, 0.8); ctx.flash(0.25);
    R.counterReady = true;
    if(e.pipe && e.pipe.parent) dropPipe(e);
    event('parry', { e });
  }
  function grab(e){
    e.state = 'grab'; e.t = 0; R.grabbedBy = e; R.act = 'grabbed'; R.t = 0; R.chain = 0;
    robinClip('block', true); hit1(e, 'block'); ctx.cue('grab'); shake(0.15, 0.2);
    event('grabbed', { e });
  }
  function dropPipe(e){
    const p = e.pipe; if(!p) return; e.pipe = null; e.weapon = false;
    const w = new THREE.Vector3(); p.getWorldPosition(w); p.parent.remove(p);
    const m = new THREE.Mesh(p.geometry, p.material); m.position.copy(w); ctx.group.add(m);
    let vy = 2.5; const vx = rnd(-1.5, 1.5), vz = rnd(-1.5, 1.5);
    fx.push({ t:0, len:9, step:(dt)=>{ m.position.x += vx*dt; m.position.z += vz*dt; m.position.y = Math.max(0.03, m.position.y + vy*dt); vy -= 14*dt; m.rotation.x += dt*9; if(m.position.y <= 0.03){ vy = 0; m.rotation.set(Math.PI/2, 0, m.rotation.z); } }, end:()=>{} });
  }
  /* what a thrown man hits: the alley's walls, or the car */
  function crash(e){
    if(ctx.car){ const c = ctx.car; if(e.x > c.x1 - 0.2 && e.x < c.x2 + 0.2 && e.z > c.z1 - 0.2 && e.z < c.z2 + 0.2 && e.y < 1.5){ e.x -= e.vx*0.03; e.z -= e.vz*0.03; return 'car'; } }
    if(e.x < ARENA.x1 - 0.1 || e.x > ARENA.x2 + 0.1){ e.x = clamp(e.x, ARENA.x1, ARENA.x2); return 'wall'; }
    return null;
  }
  function carHit(){
    const c = ctx.car; if(!c || !c.mesh) return;
    const m = c.mesh, base = m.position.clone();
    fx.push({ t:0, len:0.6, step:(dt, t)=>{ const k = 1 - t/0.6; m.position.set(base.x + rnd(-0.05, 0.05)*k, base.y + rnd(0, 0.06)*k, base.z + rnd(-0.05, 0.05)*k); m.rotation.z = Math.sin(t*40)*0.03*k; }, end:()=>{ m.position.copy(base); m.rotation.z = 0; } });
    ctx.cue('alarm');
  }

  /* ============================================================ the look of it */
  function tellOn(e){
    if(!e.tell){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:tellTex(), transparent:true, depthTest:false })); s.scale.set(0.32, 0.32, 1); s.renderOrder = 10; e.tell = s; }
    ctx.group.add(e.tell); e.tell.material.color.setRGB(e.weapon ? 1 : 1, e.weapon ? 0.45 : 0.75, 0.3);
  }
  function tellOff(e){ if(e.tell && e.tell.parent) e.tell.parent.remove(e.tell); }
  let tellT = null;
  function tellTex(){
    if(tellT) return tellT;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,0.95)'; x.beginPath(); x.arc(32, 32, 26, 0, 7); x.fill();
    x.fillStyle = '#111'; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.fillText('!', 32, 48);
    tellT = new THREE.CanvasTexture(c); return tellT;
  }
  let dotT = null;
  function dotTex(){ if(dotT) return dotT; const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32); dotT = new THREE.CanvasTexture(c); return dotT; }
  function spark(at, color, n){
    for(let i=0;i<n;i++){
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:dotTex(), color, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
      s.position.copy(at); const sz = rnd(0.06, 0.16); s.scale.set(sz, sz, 1); ctx.group.add(s);
      const v = V(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(2, 6));
      fx.push({ t:0, len:rnd(0.14, 0.3), step:(dt, t, len)=>{ s.position.addScaledVector(v, dt); v.y -= 9*dt; s.material.opacity = 1 - t/len; }, end:()=>ctx.group.remove(s) });
    }
    glow(at, color, 0.45, 0.12);
  }
  function glow(at, color, size, len){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:dotTex(), color, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
    s.position.copy(at); ctx.group.add(s);
    fx.push({ t:0, len, step:(dt, t)=>{ const k = t/len; s.scale.setScalar(size*(0.6 + k*1.4)); s.material.opacity = 1 - k; }, end:()=>ctx.group.remove(s) });
  }
  function ring(at, r, color, len, flat, facing){
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color, transparent:true, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending }));
    m.position.copy(at); if(flat) m.rotation.x = -Math.PI/2; else { m.rotation.y = facing || 0; } ctx.group.add(m);
    fx.push({ t:0, len, step:(dt, t)=>{ const k = t/len; m.scale.setScalar(0.2 + r*k); m.material.opacity = 1 - k; }, end:()=>ctx.group.remove(m) });
  }
  /* the line from her palm to him, while it pulls */
  function tether(e){
    const mat = new THREE.MeshBasicMaterial({ color:0x6ffff0, transparent:true, opacity:0.95, depthWrite:false, blending:THREE.AdditiveBlending });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6, 1, true), mat);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color:0x38ffd0, transparent:true, opacity:0.25, depthWrite:false, blending:THREE.AdditiveBlending }));
    ctx.group.add(core, halo);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), up = V(0, 1, 0);
    fx.push({ t:0, len:0.62, step:(dt, t, len)=>{
      handAt(a); b.set(e.x, e.y + 1.25, e.z);
      const mid = a.clone().add(b).multiplyScalar(0.5), d = b.clone().sub(a), L = d.length();
      [core, halo].forEach(m=>{ m.position.copy(mid); m.scale.set(1, Math.max(0.01, L), 1); m.quaternion.setFromUnitVectors(up, d.clone().normalize()); });
      const k = t/len; mat.opacity = 0.95*(1 - k*k); halo.material.opacity = 0.3*(1 - k);
      if(Math.random() < 0.5) spark(a.clone().lerp(b, Math.random()), 0x6ffff0, 1);
    }, end:()=>{ ctx.group.remove(core); ctx.group.remove(halo); } });
  }
  let handBone = null;
  function handAt(out){
    const m = window.AVATAR && AVATAR.model;
    if(m && (!handBone || !handBone.parent)){ handBone = null; m.traverse(o=>{ if(!handBone && /RightHand$/.test(o.name || '')) handBone = o; }); }
    if(handBone){ handBone.getWorldPosition(out); return out; }
    return out.set(G.pos.x, G.pos.y - 0.4, G.pos.z);
  }
  function tickFx(dt){
    // an effect may make more while it runs (the line throws sparks): those are kept for the next frame, not lost
    // (a lost spark is never stepped and never removed — it hangs in the air at full brightness for good)
    const now = fx; fx = [];
    const live = now.filter(f=>{ f.t += dt; f.step(dt, Math.min(f.t, f.len), f.len); if(f.t >= f.len){ f.end(); return false; } return true; });
    fx = live.concat(fx);
  }

  /* ============================================================ time and the camera */
  function hitstop(sec, scale){ stopT = Math.max(stopT, sec); stopScale = scale || 0.03; }
  function slowTo(to, rate){ ramp.to = to; ramp.rate = rate || 8; }
  /* a dip into slow motion that comes back up by itself */
  let slowTimer = 0, slowBack = 1;
  function slowFor(to, sec){ if(dir && dir.freeze) return; slowTo(to, 14); slowTimer = sec; slowBack = 1; }
  function tickTime(real){
    if(stopT > 0){ stopT -= real; G.timeScale = stopScale; return; }
    if(slowTimer > 0){ slowTimer -= real; if(slowTimer <= 0 && !(dir && dir.freeze)) slowTo(slowBack, 3.2); }
    const cur = G.timeScale === undefined ? 1 : G.timeScale;
    let next = cur + (ramp.to - cur)*(1 - Math.exp(-real*ramp.rate));
    if(Math.abs(next - ramp.to) < 0.004) next = ramp.to;
    G.timeScale = next;
  }
  function shake(amp, len){ ctx.shake(amp, len); }
  /* THE FIGHT'S CAMERA: closer than the walking one (which sits six metres back and makes a punch a
     speck), and high, looking down on her: from shoulder height the man circling behind her stands
     between the lens and her, and from three metres the line to her passes over his head. Kept in the
     middle of the alley, clear of the lanterns on its walls, and under its canopy. */
  /* It keeps her and the one she is on in the picture together: the further off he is, the further back
     it sits, and it looks between the two of them. A hit pushes it in for an instant (a narrower lens). */
  let camOn = false, baseFov = 70;
  const cam = { pull:0, look:null, punch:0 };
  function camPunch(k){ cam.punch = Math.max(cam.punch, k); }
  function fightCam(real){
    const yaw = G.yaw, pitch = G.pitch || 0, feet = G.pos.y - EYE;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const t = R.act === 'attack' && R.target && standing(R.target) ? R.target : (R.aim && standing(R.aim) ? R.aim : null);
    const td = t ? Math.hypot(t.x - G.pos.x, t.z - G.pos.z) : 0;
    cam.pull = lerp(cam.pull, t ? clamp((td - 2)*0.35, 0, 1.6) : 0, 1 - Math.exp(-real*3));
    const back = 3.7 + cam.pull, side = 0.4, up = clamp(3.1 - Math.sin(pitch)*1.2, 2.4, 3.8) + cam.pull*0.35;
    const want = V(G.pos.x - fx*back + rx*side, feet + up, G.pos.z - fz*back + rz*side);
    want.x = clamp(want.x, ARENA.x1 + 0.6, ARENA.x2 - 0.6);
    if(!camOn){ G.camera.position.copy(want); camOn = true; cam.look = null; } else G.camera.position.lerp(want, 1 - Math.exp(-real*10));
    // between her and him, a little nearer her; straight ahead of her when nobody is marked
    const ahead = V(G.pos.x + fx*2.2 + rx*0.2, feet + 0.95 + Math.sin(pitch)*2.2, G.pos.z + fz*2.2 + rz*0.2);
    const look = t ? V(lerp(G.pos.x, t.x, 0.42), feet + 1.05 + Math.sin(pitch)*1.4, lerp(G.pos.z, t.z, 0.42)).lerp(ahead, 0.3) : ahead;
    if(!cam.look) cam.look = look.clone(); else cam.look.lerp(look, 1 - Math.exp(-real*8));
    G.camera.lookAt(cam.look);
    cam.punch = Math.max(0, cam.punch - real*5);
    const fov = baseFov - 7*Math.sin(Math.min(1, cam.punch)*Math.PI/2);
    if(Math.abs(G.camera.fov - fov) > 0.05){ G.camera.fov = fov; G.camera.updateProjectionMatrix(); }
  }
  function red(k){ const r = overlay().querySelector('.tshf-red'); r.style.transition = 'none'; r.style.opacity = k; void r.offsetWidth; r.style.transition = 'opacity .5s'; r.style.opacity = 0; }

  /* ============================================================ the overlay */
  function overlay(){
    if(el) return el;
    el = document.createElement('div'); el.className = 'tshf';
    el.innerHTML = `<div class="tshf-red"></div><div class="tshf-hp"><i></i></div><div class="tshf-combo"></div>
      <div class="tshf-prompt"><kbd></kbd><b></b><small></small></div>
      <div class="tshf-keys">
        <span><kbd>MOUSE</kbd>aim</span><span><kbd>CLICK</kbd>strike</span><span><kbd>HOLD</kbd>power</span><span><kbd>G</kbd>pull</span>
        <span><kbd>SPACE</kbd>dodge</span><span><kbd>+A/D</kbd>cartwheel</span><span><kbd>+S</kbd>flip</span><span><kbd>+W</kbd>roll</span><span><kbd>R</kbd>parry</span><span><kbd>F</kbd>pulse</span></div>`;
    (ctx.root || document.body).appendChild(el);
    return el;
  }
  /* the big prompt in the middle, during a ramp: the key, what it does */
  function prompt(key, what, sub){
    const p = overlay().querySelector('.tshf-prompt');
    if(!key){ p.classList.remove('on'); return; }
    p.querySelector('kbd').textContent = key; p.querySelector('b').textContent = what; p.querySelector('small').textContent = sub || '';
    p.classList.remove('on'); void p.offsetWidth; p.classList.add('on');
  }
  function hud(){
    const o = overlay();
    o.querySelector('.tshf-hp i').style.width = clamp(R.hp, 0, 100) + '%';
    o.querySelector('.tshf-hp').classList.toggle('low', R.hp < 35);
    const c = o.querySelector('.tshf-combo');
    if(R.combo >= 2 && R.comboT > 0){ c.textContent = R.combo + ' HITS'; c.classList.add('on'); } else c.classList.remove('on');
    o.querySelector('.tshf-keys').classList.toggle('on', !!(dir && dir.showKeys));
  }
  function combo(){ const c = overlay().querySelector('.tshf-combo'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }

  /* ============================================================ the lesson
     THE CREW'S ORDER OF BUSINESS, from the script. Each step sets up who
     comes at her and how, says what to press when the moment comes — in a
     speed ramp, frozen until she presses it — and is done when she has. */
  const STEPS = [
    { id:'attack', title:'ATTACK', how:'The first one charges. CLICK (or K) to hit him.',
      enter(){ const e = pick('t1'); e.active = true; e.state = 'approach'; e.t = 0; e.K = Object.assign({}, e.K); e.hp = 1; },
      on:{ windup:(x)=>{ if(x.e.tag === 't1') freeze('CLICK', 'ATTACK', 'hit him first', 'attack', x.e); } },
      done:()=>pick('t1').hp <= 0, after:'fightAttack' },
    { id:'dodge', title:'DODGE', how:'Another one swings. SPACE as the fist comes — you are not there when it lands.',
      enter(){ const e = pick('t2'); e.active = true; e.state = 'approach'; e.t = 0; e.guard = ()=>!dir.dodged; },
      on:{ windup:(x)=>{ if(x.e.tag === 't2' && !dir.dodged) freeze('SPACE', 'DODGE', 'under it', 'dodge', x.e, 0.78); },
           whiff:(x)=>{ if(x.e.tag === 't2' && x.dodged && !dir.dodged){ dir.dodged = true; R.counterReady = true; R.forceTarget = x.e; x.e.state = 'stagger'; x.e.t = 0; x.e.parried = true;
             ctx.say('fightDodge'); ctx.later(()=>{ if(on && dir.id === 'dodge') freeze('CLICK', 'COUNTER', 'he is wide open', 'attack', x.e); }, 900); } } },
      done:()=>pick('t2').hp <= 0 },
    { id:'combo', title:'COMBO', how:'Two rush her. CLICK, CLICK, CLICK, CLICK: jab, cross, hook — the fourth is a kick. Keep the chain going.',
      enter(){ ['t3', 't4'].forEach((t, i)=>{ const e = pick(t); e.active = true; e.state = 'approach'; e.t = 0; e.cool = 3 + i*2; e.K = Object.assign({}, e.K, { windup:1.1 }); }); dir.slowAttackers = true; },
      on:{ windup:(x)=>{ if(!dir.comboShown && (x.e.tag === 't3' || x.e.tag === 't4')){ dir.comboShown = true; freeze('CLICK ×4', 'COMBO', 'jab · cross · hook · kick — keep it going', 'attack', x.e, 0.5); } },
           hit:(x)=>{ if(x.chain >= 2 && !dir.said){ dir.said = true; ctx.say('fightCombo'); }
                      if(x.move === 'kick'){ slowFor(0.25, 0.7); } } },
      done:()=>['t3', 't4'].every(t=>pick(t).hp <= 0) },
    { id:'break', title:'BREAK', how:'One gets hold of her. F — the bangle on her wrist: a pulse.',
      enter(){ const e = pick('t5'); e.active = true; e.grabber = true; e.state = 'approach'; e.t = 0; e.guard = ()=>!dir.broke; },
      on:{ grabbed:(x)=>freeze('F', 'BREAK FREE', 'the bangle', 'pulse', x.e), pulse:()=>{ dir.broke = true; ctx.later(()=>ctx.say('fightBreak'), 600); } },
      done:()=>!R.grabbedBy && pick('t5').state !== 'grab' && pick('t5').state !== 'approach' && dir.t > 2 },
    { id:'parry', title:'PARRY', how:'One has a pipe. RIGHT-CLICK (or R) the instant before it lands: the gauntlet takes it.',
      enter(){ const e = pick('t6'); e.active = true; e.state = 'approach'; e.t = 0; e.guard = ()=>!dir.parried; },
      on:{ windup:(x)=>{ if(x.e.tag === 't6' && !dir.parried) freeze('RIGHT-CLICK', 'PARRY', 'the gauntlet takes it', 'parry', x.e, 0.82); },
           parry:(x)=>{ if(!dir.parried){ dir.parried = true; R.forceTarget = x.e; x.e.hp = Math.min(x.e.hp, 2);
             ctx.later(()=>{ ctx.say('fightParry'); ctx.later(()=>{ if(on && dir.id === 'parry') freeze('CLICK', 'PUT HIM DOWN', '', 'attack', x.e); }, 900); }, 500); } } },
      done:()=>pick('t6').hp <= 0 },
    { id:'more', title:'THE GAUNTLETS · POWER', how:'More of them. HOLD CLICK, then let go: the gauntlet\'s power punch. Put one through the car.',
      enter(){ ctx.say('fightMore'); wave2(); dir.free = true; dir.showKeys = true; },
      on:{ hit:(x)=>{ if(x.move === 'power') dir.powered = true; }, charge:()=>{ if(!dir.chargeSeen){ dir.chargeSeen = true; slowTo(0.45, 6); prompt('LET GO', 'POWER PUNCH', 'when you are ready'); } } },
      done:()=>dir.powered },
    { id:'pull', title:'THE GAUNTLETS · PULL', how:'G — the gauntlet casts a line at the one you are facing and drags him to you. Then hit him.',
      enter(){ const far = alive().sort((a, b)=>dist(b) - dist(a))[0]; if(far) ctx.later(()=>{ if(on && dir.id === 'pull' && !dir.pulled) freeze('G', 'PULL', 'drag him in', 'pull', far); }, 1600); },
      on:{ pull:()=>{ dir.pulled = true; } },
      done:()=>(dir.pulled && dir.t > 1.5) || (!alive().length && dir.t > 2) },
    { id:'free', title:'EVERYTHING', how:'Use all of it. SPACE with A or D: a cartwheel. With S: a flip away. With W: a roll. Click as you land: a sweep. SPACE at one of them: over him; at a wall: off it, feet first.',
      enter(){},
      done:()=>alive().length <= 2 },
    { id:'regret', title:'ONE MORE', how:'He is getting back up.',
      enter(){ const k = E.find(e=>e.state === 'ko' && e.kind !== 'buyer'); if(k){ k.hp = 1; k.state = 'getup'; k.t = 0; hit1(k, 'getup'); dir.reg = k; k.tag = 'reg'; }
        alive().forEach(e=>{ if(e !== dir.reg){ e.active = false; e.state = 'hesitate'; } });
        ctx.later(()=>{ if(!on) return; ctx.say('fightRegret'); ctx.later(()=>{ if(on && dir.reg) freeze('CLICK', 'FINISH IT', '', 'attack', dir.reg); }, 2600); }, 1400); },
      done:()=>!dir.reg || dir.reg.hp <= 0 },
    { id:'last', title:'', how:'',
      enter(){ dir.hold = true; alive().forEach(e=>{ e.active = false; e.state = 'hesitate'; e.t = 0; }); ctx.later(()=>{ if(!on) return; ctx.say('fightLast'); ctx.later(()=>{ if(on) ctx.say('fightGreat', ()=>{ if(on) finish(); }); }, 2600); }, 900); },
      done:()=>false }
  ];
  function pick(tag){ return E.find(e=>e.tag === tag) || { hp:0, state:'gone' }; }
  const dist = e => Math.hypot(e.x - G.pos.x, e.z - G.pos.z);
  /* the second wave: three from the mouth of the alley (both corners and the middle), one from the bend */
  function wave2(){
    [[-34.4, -13.8, 'big', {}], [-46.6, -14.2, 'lean', {}], [-40.4, -13.6, 'lean', { hat:{ face:'shades' } }], [-35.8, -37.0, 'big', {}]].forEach(([x, z, k, o], i)=>{
      const e = spawn(k, x, z, Object.assign({ state:'approach', active:true, tag:'w' + i, yaw:Math.PI }, o));
      e.cool = 1 + i*0.8;
    });
  }
  /* FREEZE: the speed ramp that teaches. The world drops to a crawl and stays there until the key */
  function freeze(key, what, sub, want, target, atFrac){
    // most of the way into his swing, not at the start of it: the fist a foot from her face
    if(atFrac && target && target.state === 'windup' && target.t < target.strikeAt*atFrac){ dir.pending = { key, what, sub, want, target, at:target.strikeAt*atFrac }; return; }
    dir.pending = null;
    dir.freeze = { key, want, target };
    if(target && target.state === 'windup' && want === 'attack') target.t = Math.min(target.t, target.strikeAt*0.3);     // she gets there first
    slowTo(0.035, 9);
    prompt(key, what, sub);
    R.onlyKey = want;
    if(target && want !== 'pulse') R.forceTarget = target;
    ctx.cue('ui');
  }
  /* the key a frozen lesson asks for always works: whatever she was in the middle of gives way to it */
  function clearFor(want){
    if(!dir || !dir.freeze || dir.freeze.want !== want) return;
    if(want === 'pulse') R.pulseCd = 0; if(want === 'pull') R.pullCd = 0;
    if(R.act !== 'grabbed' && R.act !== 'down'){ R.act = null; R.buffer = null; R.dash = null; }
  }
  function unfreeze(){
    if(!dir || !dir.freeze) return;
    dir.freeze = null; R.onlyKey = null; prompt(null);
    slowTo(0.25, 30); slowTimer = 0.45; slowBack = 1;          // a beat of slow motion as it lands, then up to speed
  }
  function event(name, x){
    if(!dir) return;
    const s = STEPS[dir.i];
    if(s && s.on && s.on[name]) s.on[name](x || {});
  }
  function stepTo(i){
    dir.i = i; dir.t = 0; dir.id = STEPS[i].id;
    const s = STEPS[i];
    if(s.title) ctx.lesson(s.title, s.how, i + 1, STEPS.length - 1);
    else ctx.lesson(null);
    s.enter();
  }
  function tickDirector(dt){
    dir.t += dt;
    const pd = dir.pending; if(pd && pd.target.state === 'windup' && pd.target.t >= pd.at){ freeze(pd.key, pd.what, pd.sub, pd.want, pd.target); }
    else if(pd && pd.target.state !== 'windup') dir.pending = null;
    const s = STEPS[dir.i];
    if(s.done() && !dir.freeze){
      if(s.after) ctx.say(s.after);
      ctx.cue('win');
      if(dir.i + 1 < STEPS.length) stepTo(dir.i + 1);
    }
  }

  /* ============================================================ start, tick, keys */
  /* THE CAST, before the fight: the buyer and his crew are in the alley
     from the moment the deal is on, and the film that opens the fight
     moves them about (tsh.js); `pose` keeps them breathing meanwhile.
     c.crew: [{ kind, x, z, yaw, state, tag, hat, weapon, hidden }] */
  function cast(c){
    clear();
    ctx = c; ready = true; E = []; fx = []; nextId = 1;
    (c.crew || []).forEach(m=>spawn(m.kind, m.x, m.z, m));
    return E;
  }
  function pose(dt){
    if(!ready || on) return;
    E.forEach(e=>{ e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.yaw; if(e.rig) e.rig.update(dt); });
    tickFx(dt);
  }
  /* the fight itself, with the crew where the film left them */
  function start(c){
    if(!ready) cast(c); else Object.assign(ctx, c);
    on = true; camOn = false; baseFov = G.camera ? G.camera.fov : 70; cam.punch = 0; cam.pull = 0; R.aim = null;
    resetRobin();
    dir = { i:0, t:0, free:false, showKeys:false };
    overlay().classList.add('on');
    E.forEach(e=>{ e.g.visible = true; if(e.kind !== 'buyer'){ e.state = 'circle'; e.t = 0; e.active = false; } });
    G.timeScale = 1; ramp.to = 1;
    listen(true);
    stepTo(0);
    hud();
  }
  /* the fight over: the ones on the ground stay there (the film after it walks past them) */
  function stop(){
    on = false; listen(false);
    if(el){ el.classList.remove('on'); prompt(null); }
    E.forEach(tellOff);
    if(mark && mark.parent) mark.parent.remove(mark);
    if(G.camera && camOn){ G.camera.fov = baseFov; G.camera.updateProjectionMatrix(); } camOn = false;
    G.timeScale = 1; ramp.to = 1; stopT = 0; slowTimer = 0;
    input.held = false; input.charging = false;
    if(window.AVATAR) AVATAR.posture(null);
    if(ctx && ctx.lesson) ctx.lesson(null);
    if(ctx && ctx.charge) ctx.charge(false);
  }
  /* and gone: the alley empty again */
  function clear(){
    if(on) stop();
    ready = false; despawnAll(); fx.forEach(f=>f.end()); fx = [];
  }
  function finish(){
    const left = E.map(e=>({ kind:e.kind, x:e.x, z:e.z, yaw:e.yaw, state:e.state, tag:e.tag }));
    const cb = ctx.done;
    stop();
    if(cb) cb(left);
  }
  function tick(dt){
    if(!on) return;
    const real = dt/Math.max(0.01, G.timeScale === undefined ? 1 : G.timeScale);
    tickTime(real);
    // her
    R.iframe = Math.max(0, R.iframe - dt); R.parryT = Math.max(0, R.parryT - dt); R.chainT = Math.max(0, R.chainT - dt);
    R.sinceDodge += dt; R.pulseCd = Math.max(0, R.pulseCd - dt); R.pullCd = Math.max(0, R.pullCd - dt); R.comboT = Math.max(0, R.comboT - dt); R.hurtT += dt; R.lastHitT += dt;
    if(R.comboT <= 0) R.combo = 0;
    if(R.evadeEnd !== undefined){ R.evadeEnd += dt; if(R.evadeEnd > 0.35){ R.evadeEnd = undefined; R.outOfEvade = false; } }
    if(R.hurtT > 3 && R.hp < 100) R.hp = Math.min(100, R.hp + dt*6);
    if(input.held){ input.heldT += real; if(input.heldT > 0.38 && !input.charging && (!R.act || R.act === 'idle')){ input.charging = true; robinClip('fight'); ctx.charge(true); event('charge'); } }
    if(R.dash){ const d = R.dash; d.t += dt; const k = clamp(d.t/d.len, 0, 1), e = 1 - (1 - k)*(1 - k);
      const p = clampArena(lerp(d.x0, d.x1, e), lerp(d.z0, d.z1, e)); G.pos.x = p[0]; G.pos.z = p[1];
      G.pos.y = EYE + (ctx.ground ? ctx.ground(G.pos.x, G.pos.z) : 0) + (d.arc ? Math.sin(k*Math.PI)*d.arc : 0);
      if(k >= 1) R.dash = null; }
    else G.pos.y = EYE + (ctx.ground ? ctx.ground(G.pos.x, G.pos.z) : 0);
    if(R.act){
      R.t += dt;
      if(R.act === 'attack'){ const m = MOVE[R.move];
        if(R.target && standing(R.target)) R.face = turnTo(R.face, angTo(G.pos.x, G.pos.z, R.target.x, R.target.z), dt*14);
        if(!R.landed && R.t >= R.len*m.hit) land();
        if(R.t >= R.len*m.free && R.buffer){ const b = R.buffer; R.buffer = null; R.act = null; attack(b); }
        else if(R.t >= R.len*0.9){ R.act = null; R.forceTarget = null; } }
      else if(R.act === 'wall' && R.t >= R.len){ const t = R.wallTo; R.act = null;
        if(t && standing(t)){ R.target = t; const p = P(), a = angTo(p.x, p.z, t.x, t.z), d = Math.hypot(t.x - p.x, t.z - p.z), go = Math.max(0, d - 1.1);
          R.act = 'attack'; R.move = 'flykick'; R.t = 0; R.landed = false; R.face = a; R.len = robinClip('flykick', true) || 0.9;
          R.dash = { x0:p.x, z0:p.z, x1:p.x + Math.sin(a)*go, z1:p.z + Math.cos(a)*go, t:0, len:R.len*MOVE.flykick.hit, arc:1.1 }; slowFor(0.3, 0.6); } }
      else if(R.act === 'dodge' && R.evade && R.t >= R.len*0.82){ const b = R.buffer; R.act = null; R.evade = null; R.buffer = null; R.evadeEnd = 0;
        if(b){ R.outOfEvade = true; attack(b); } }
      else if(R.act !== 'grabbed' && R.act !== 'down' && R.t >= R.len){ R.act = null; R.blocking = false; }
    }
    if(!R.act || R.act === 'idle'){
      const moved = walkRobin(dt);
      if(!moved){ const t = (R.aim && standing(R.aim) && dist(R.aim) < 5) ? R.aim : pickTarget(5); if(t) R.face = turnTo(R.face, angTo(G.pos.x, G.pos.z, t.x, t.z), dt*6); robinClip(input.charging ? 'fight' : 'fight'); }
    }
    if(window.AVATAR){ AVATAR.update(dt, false, false, true); if(AVATAR.body) AVATAR.body.rotation.y = R.face; }
    aimTarget(); tickMark(real);
    fightCam(real);
    // them, the effects, the lesson
    tickCrew(dt);
    tickFx(dt);
    tickDirector(dt);
    hud();
  }

  /* KEYS (from tsh.js while the fight is on). While a lesson is frozen
     on a move, only that move's key moves anything. */
  function key(e){
    if(!on) return false;
    const c = e.code;
    const allow = w => !R.onlyKey || R.onlyKey === w;
    if(c === 'KeyK' && !e.repeat){ press(); return true; }
    if(c === 'Space'){ G.keys.Space = false; if(!e.repeat && allow('dodge')){ clearFor('dodge'); if(dodge() && dir.freeze && dir.freeze.want === 'dodge'){ R.iframe = Math.max(R.iframe, 0.6); unfreeze(); } } return true; }
    if(c === 'KeyR' && !e.repeat){ doParry(); return true; }
    if(c === 'KeyF' && !e.repeat){ if(allow('pulse') && (R.grabbedBy || !R.onlyKey)){ clearFor('pulse'); if(pulse() && dir.freeze && dir.freeze.want === 'pulse') unfreeze(); } return true; }
    if(c === 'KeyG' && !e.repeat){ if(allow('pull')){ clearFor('pull'); if(pull() && dir.freeze && dir.freeze.want === 'pull') unfreeze(); } return true; }
    if(['KeyE', 'KeyQ', 'KeyJ', 'KeyH'].includes(c)) return true;           // no doors, cans or gadgets mid-fight
    return false;
  }
  function doParry(){ if(!R.onlyKey || R.onlyKey === 'parry'){ clearFor('parry'); if(parry() && dir.freeze && dir.freeze.want === 'parry'){ R.parryT = 0.5; unfreeze(); } } }
  function press(){
    input.held = true; input.heldT = 0; input.charging = false;
  }
  function release(){
    if(!input.held) return;
    const charged = input.charging; input.held = false; input.charging = false; ctx.charge(false);
    if(R.onlyKey && R.onlyKey !== 'attack'){ return; }
    if(charged){ prompt(null); clearFor('attack'); if(attack('power') && dir.freeze) unfreeze(); slowFor(0.15, 0.7); return; }
    clearFor('attack');
    if(attack('punch') && dir.freeze && dir.freeze.want === 'attack') unfreeze();
  }
  let handlers = null;
  function listen(yes){
    if(yes && !handlers){
      handlers = {
        down:e=>{ if(!on || (ctx.blocked && ctx.blocked())) return; if(e.button === 0) press(); if(e.button === 2){ e.preventDefault(); doParry(); } },
        up:e=>{ if(!on) return; if(e.button === 0) release(); if(e.button === 2) R.blocking = false; },
        keyup:e=>{ if(!on) return; if(e.code === 'KeyK') release(); if(e.code === 'KeyR') R.blocking = false; },
        menu:e=>{ if(on) e.preventDefault(); }
      };
      addEventListener('mousedown', handlers.down); addEventListener('mouseup', handlers.up); addEventListener('keyup', handlers.keyup); addEventListener('contextmenu', handlers.menu);
    }
    if(!yes && handlers){
      removeEventListener('mousedown', handlers.down); removeEventListener('mouseup', handlers.up); removeEventListener('keyup', handlers.keyup); removeEventListener('contextmenu', handlers.menu);
      handlers = null;
    }
  }

  return { cast, pose, start, stop, clear, tick, key, play, hit1, get on(){ return on; }, get ready(){ return ready; }, crew:()=>E, ARENA, MEET, MOVE, CHAIN, KIND, STEPS,
           /* for tests and the console */
           _E:()=>E, _R:()=>R, _aim:aimTarget, _choose:choose, _stepTo:stepTo, STRINGS, EVADE, _dir:()=>dir, _press:press, _release:release, _dodge:dodge, _parry:doParry, _pulse:pulse, _pull:pull };
})();
