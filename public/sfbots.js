/* =====================================================================
   SANFRAN — THE ROBOTS. What a combat robot is made of, and how two of
   them fight. The world, the story and the RPG systems are sanfran.js.

   A ROBOT IS SIX PARTS: CORE, FRAME, MOTOR, POWER, WEAPON, CONTROL. Each
   option changes numbers you can feel — a light frame turns fast and
   folds when hit, a heavy one shrugs and crawls — and the build screen
   shows them side by side, because choosing is the engineering.

   A FIGHT IS COMPONENTS, NOT A HEALTH BAR. Core, left motor, right motor,
   armour and weapon each have their own HP. Where a hit lands decides
   what it breaks: the front is armour, the flanks are the motors, the
   back is the core. A robot with a dead left motor pulls left and turns
   badly; with its weapon gone it cannot attack; with its core at zero it
   shuts down. Attacks and dodges make heat and overheating stalls you;
   blocking drains power. Simply attacking is not the best plan — which
   is the lesson the first two fights are built to teach.
   ===================================================================== */
window.SFBOTS = (function(){
  const V = (x,y,z)=>new THREE.Vector3(x,y,z);

  /* ------------------------------------------------------------ the parts
     `need` is an attribute gate {attr:level}; `rep` a reputation gate
     at the market. Every part is also an inventory item (sanfran.js). */
  const PARTS = {
    frame: [
      { id:'frame_light',    name:'Light frame',    armor:40, speed:1.30, turn:1.35, weight:8,  desc:'Aluminium tube. Fast, turns on a coin, folds when hit.' },
      { id:'frame_balanced', name:'Balanced frame', armor:60, speed:1.00, turn:1.00, weight:12, desc:'Steel box section. Nothing special, nothing weak.' },
      { id:'frame_heavy',    name:'Heavy frame',    armor:90, speed:0.78, turn:0.75, weight:18, desc:'Welded plate. Takes a beating, moves like a fridge.' }
    ],
    motor: [
      { id:'motor_micro',  name:'Micro motor',   power:1.00, motorHp:45, heat:1.0, desc:'The one you fixed the delivery bot with. Honest.' },
      { id:'motor_sprint', name:'Sprint motor',  power:1.25, motorHp:35, heat:1.3, desc:'High RPM, low torque, runs hot.' },
      { id:'motor_torque', name:'Torque motor',  power:0.95, motorHp:65, heat:0.8, push:1.5, desc:'Geared down. Wins shoving matches.' }
    ],
    power: [
      { id:'power_aa',     name:'AA battery pack', cap:80,  regen:0,  desc:'Eight AAs taped together. Do not tell Daichi.' },
      { id:'power_liion',  name:'Li-ion cell',     cap:120, regen:2,  desc:'Salvaged from a scooter. Solid.' },
      { id:'power_supercap', name:'Supercapacitor', cap:70, regen:9,  need:{ energy:2 }, desc:'Tiny store, refills fast. Energy 2 to wire safely.' }
    ],
    weapon: [
      { id:'wpn_hammer',  name:'Hammer arm', dmg:13, cd:1.1, reach:2.6, heat:18, weaponHp:45, desc:'Slow, heavy overhead strike.' },
      { id:'wpn_spinner', name:'Spinner',    dmg:6,  cd:0.45, reach:2.2, heat:14, weaponHp:35, desc:'Fast cuts. Builds heat fast.' },
      { id:'wpn_flipper', name:'Flipper',    dmg:5,  cd:0.9, reach:2.4, heat:12, weaponHp:55, knock:9, desc:'Throws them off balance — a stun and a shove.' }
    ],
    control: [
      { id:'ctl_remote', name:'Remote link',     turnBonus:1.0, aim:0,    desc:'A cheap radio link. Does what you tell it, late.' },
      { id:'ctl_gyro',   name:'Gyro stabiliser', turnBonus:1.25, aim:0,   desc:'Holds a line even with a damaged motor.', steady:true },
      { id:'ctl_aim',    name:'Auto-aim chip',   turnBonus:1.0, aim:0.6, need:{ prog:2 }, desc:'Nudges you onto the target. Programming 2 to flash it.' }
    ],
    core: [
      { id:'core_std',    name:'Standard core',   coreHp:100, desc:'A microcontroller and a prayer.' },
      { id:'core_shield', name:'Shielded core',   coreHp:130, need:{ mat:2 }, desc:'Wrapped in aramid. Material Science 2.' }
    ]
  };
  const SLOTS = ['core','frame','motor','power','weapon','control'];
  const find = id => { for(const s of SLOTS){ const p = PARTS[s].find(x=>x.id===id); if(p) return p; } return null; };

  /* A build's numbers, as the build screen shows them and the fight uses. */
  function stats(build){
    const p = s => find(build[s]) || PARTS[s][0];
    const f = p('frame'), m = p('motor'), pw = p('power'), w = p('weapon'), c = p('control'), co = p('core');
    return {
      core: co.coreHp, armor: f.armor + (build.plating ? 30 : 0), motor: m.motorHp, weapon: w.weaponHp,
      speed: 5.2 * f.speed * m.power, turn: 2.6 * f.turn * c.turnBonus, push: (m.push||1) * (f.weight/12),
      weight: f.weight + (build.plating ? 4 : 0), cap: pw.cap, regen: pw.regen, heatMul: m.heat,
      dmg: w.dmg, cd: w.cd, reach: w.reach, wHeat: w.heat, knock: w.knock||0, aim: c.aim, steady: !!c.steady,
      weaponKind: w.id, color: f.id==='frame_light' ? 0x27e8ff : f.id==='frame_heavy' ? 0xff8a3d : 0x3ddc84
    };
  }

  /* ---------------------------------------------------------- the model
     Boxes, but the right boxes: chassis sized by frame, two wheels that
     show their motors, an armour plate on the front, the weapon on top,
     and a status light that goes amber when hot and red when dying. */
  function model(s, scale){
    const g = new THREE.Group(), k = scale || 1;
    const mat = c => new THREE.MeshStandardMaterial({ color:c, roughness:0.5, metalness:0.5 });
    const glowM = c => new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:1.6 });
    const w = (0.9 + s.weight/30)*k, l = (1.2 + s.weight/24)*k, h = 0.5*k + s.weight/60*k;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat(0x2a2e3a)); body.position.y = 0.35*k + h/2; g.add(body);
    const armor = new THREE.Mesh(new THREE.BoxGeometry(w*1.05, h*0.9, 0.15*k), mat(s.color));
    armor.position.set(0, 0.35*k + h/2, l/2 + 0.05*k); g.add(armor);
    const wheels = [];
    [-1,1].forEach(sx=>{
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.35*k, 0.35*k, 0.22*k, 16), mat(0x111111));
      wh.rotation.z = Math.PI/2; wh.position.set(sx*(w/2+0.12*k), 0.35*k, 0); g.add(wh); wheels.push(wh);
    });
    let weapon;
    if(s.weaponKind==='wpn_spinner'){ weapon = new THREE.Mesh(new THREE.CylinderGeometry(0.55*k, 0.55*k, 0.08*k, 3), mat(0xcccccc)); weapon.position.set(0, 0.35*k+h+0.1*k, l*0.25); }
    else if(s.weaponKind==='wpn_flipper'){ weapon = new THREE.Mesh(new THREE.BoxGeometry(w*0.9, 0.08*k, 0.6*k), mat(0xcccccc)); weapon.position.set(0, 0.4*k, l/2+0.3*k); }
    else { weapon = new THREE.Group(); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15*k, 0.15*k, 1.1*k), mat(0x888888)); arm.position.z = 0.55*k; weapon.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45*k, 0.35*k, 0.35*k), mat(0xbbbbbb)); head.position.z = 1.1*k; weapon.add(head);
      weapon.position.set(0, 0.35*k+h, 0); }
    g.add(weapon);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(w*0.5, 0.08*k, 0.05*k), glowM(0x27e8ff));
    eye.position.set(0, 0.35*k + h*0.75, l/2 + 0.14*k); g.add(eye);
    g.userData = { wheels, weapon, eye, armorMesh:armor, body, k };
    return g;
  }

  /* ---------------------------------------------------------- opponents */
  const FOES = {
    bruiser: { name:'BRUISER', build:{ core:'core_std', frame:'frame_heavy', motor:'motor_torque', power:'power_liion', weapon:'wpn_hammer', control:'ctl_remote' },
      scale:1.15, brain:'charger', hpMul:1.0, reward:{ rxp:120, credits:90, rep:1 },
      scan:['Heavy frame, torque motors — it wins any straight push.', 'It telegraphs its charge: its eye flashes white for a moment first.', 'After a charge it needs a second to stop. Its back is exposed then.'] },
    titan: { name:'THE TITAN', build:{ core:'core_shield', frame:'frame_heavy', motor:'motor_torque', power:'power_liion', weapon:'wpn_hammer', control:'ctl_gyro' },
      scale:2.0, brain:'titan', hpMul:2.2, weakRight:true, reward:{ rxp:300, credits:200, rep:2 },
      scan:['Armour on the front is thicker than your whole robot. Hitting it head-on does almost nothing.', 'RIGHT MOTOR: cracked housing, running hot. Damage there counts double.', 'When it sweeps, get out of the arc. When it stomps, dodge the ring.'] }
  };

  /* ================================================================ fight
     One fight at a time. `api` is sanfran.js: it owns the camera, the
     scene group, the HUD and what happens after. */
  let F = null;
  function unit(build, isFoe, foe){
    const s = stats(build), mul = foe ? foe.hpMul : 1;
    const hp = { core:s.core*mul, lmotor:s.motor*mul, rmotor:s.motor*mul, armor:s.armor*mul, weapon:s.weapon*mul };
    return { s, hp, max:Object.assign({}, hp), x:0, z:0, a:0, vx:0, vz:0, heat:0, power:s.cap, cool:0,
      block:false, dodge:0, dodgeCool:0, stun:0, stall:0, swing:0, isFoe, foe, g:null, dead:false, brain:{ t:0, mode:'approach', tele:0 } };
  }
  function start(api, playerBuild, foeId){
    const foe = FOES[foeId];
    const P = unit(playerBuild, false), E = unit(foe.build, true, foe);
    P.x = 0; P.z = 8; P.a = Math.PI; E.x = 0; E.z = -8; E.a = 0;
    P.g = model(P.s, 1); E.g = model(E.s, foe.scale);
    E.g.userData.eye.material.color.setHex(0xff3040); E.g.userData.eye.material.emissive.setHex(0xff3040);
    api.group.add(P.g); api.group.add(E.g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(foe.scale*1.4, foe.scale*1.6, 40), new THREE.MeshBasicMaterial({ color:0xff3040, transparent:true, opacity:0, side:THREE.DoubleSide }));
    ring.rotation.x = -Math.PI/2; ring.position.y = 0.05; api.group.add(ring);
    F = { api, P, E, foe, foeId, keys:{}, t:0, scanned:false, over:null, ring, shock:0, sparks:[], log:[],
          goals:{ move:false, attack:false, dodge:false, block:false, scan:false, rear:false }, weakHits:0 };
    return F;
  }
  const R = 12.5;                                   // the arena's radius
  const angDiff = (a,b)=>Math.atan2(Math.sin(a-b), Math.cos(a-b));
  /* Where a hit from `from` lands on `to`: which component takes it. */
  function where(from, to){
    const ang = Math.atan2(from.x-to.x, from.z-to.z);          // direction to the attacker, world
    const rel = angDiff(ang, to.a);                            // 0 = in front of `to`
    if(Math.abs(rel) < 0.8) return 'front';
    if(Math.abs(rel) > 2.3) return 'rear';
    return rel > 0 ? 'left' : 'right';
  }
  function damage(to, from, amount, side){
    if(to.dodge > 0) return 'dodged';
    let amt = amount;
    if(to.block && side==='front'){ amt *= 0.25; to.power = Math.max(0, to.power - 6); }
    const H = to.hp, weak = to.foe && to.foe.weakRight;
    let hit;
    if(side==='front'){
      if(H.armor > 0){ const into = weak ? amt*0.25 : amt; H.armor = Math.max(0, H.armor - into); hit = 'armor'; if(weak) amt *= 0.1; }
      else { H.core -= amt*0.7; H.weapon = Math.max(0, H.weapon - amt*0.3); hit = 'core'; }
    } else if(side==='left'){ H.lmotor = Math.max(0, H.lmotor - amt); if(H.lmotor<=0) H.core -= amt*0.5; hit = 'lmotor'; }
    else if(side==='right'){ const m = weak ? 2 : 1; H.rmotor = Math.max(0, H.rmotor - amt*m); if(H.rmotor<=0) H.core -= amt*0.6*m; hit = 'rmotor'; if(weak) F.weakHits++; }
    else { H.core -= amt*1.6; hit = 'core'; }
    H.core = Math.max(0, H.core);
    if(H.core <= 0) to.dead = true;
    burst(to, hit==='armor' ? 0x9ab4ff : 0xffc060);
    return hit;
  }
  function burst(u, col){
    for(let i=0;i<14;i++){
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.08), new THREE.MeshBasicMaterial({ color:col }));
      s.position.set(u.x, 1 + Math.random(), u.z); F.api.group.add(s);
      F.sparks.push({ m:s, v:V((Math.random()-0.5)*8, 2+Math.random()*5, (Math.random()-0.5)*8), life:0.6 });
    }
  }
  function attack(u, target){
    if(u.cool > 0 || u.stall > 0 || u.hp.weapon <= 0 || u.stun > 0) return false;
    u.cool = u.s.cd; u.swing = 0.25; u.heat += u.s.wHeat * u.s.heatMul;
    const d = Math.hypot(target.x-u.x, target.z-u.z), facing = Math.abs(angDiff(Math.atan2(target.x-u.x, target.z-u.z), u.a));
    const reach = u.s.reach * (u.isFoe ? u.foe.scale : 1) + (target.isFoe ? target.foe.scale*0.8 : 0.8);
    if(d < reach && facing < 0.9){
      const side = where(u, target);
      const res = damage(target, u, u.s.dmg * (u.isFoe ? 1 : 1), side);
      if(res !== 'dodged' && u.s.knock){ target.stun = 0.6; const k = u.s.knock/(target.s.weight/12); target.vx += Math.sin(u.a)*k; target.vz += Math.cos(u.a)*k; }
      if(!u.isFoe){ F.goals.attack = true; if(side==='rear') F.goals.rear = true; }
      return side;
    }
    if(!u.isFoe) F.goals.attack = true;
    return false;
  }

  /* one unit's movement from its controls: thrust -1..1, turn -1..1 */
  function drive(u, thrust, turn, dt){
    if(u.stall > 0){ thrust = 0; turn *= 0.3; }
    if(u.stun > 0){ thrust *= 0.2; turn *= 0.2; }
    const L = u.hp.lmotor/u.max.lmotor, Rm = u.hp.rmotor/u.max.rmotor;
    const low = u.power <= 0 ? 0.45 : 1;
    // a weak side pulls: steer bias by the difference, unless a gyro holds the line
    const bias = (Rm - L) * (u.s.steady ? 0.3 : 1);
    const eff = Math.max(0.15, (L+Rm)/2);
    u.a += (turn * u.s.turn * (0.4 + 0.6*eff) + bias*thrust*1.2) * dt;
    const sp = thrust * u.s.speed * eff * low;
    u.vx += (Math.sin(u.a)*sp - u.vx) * Math.min(1, dt*4);
    u.vz += (Math.cos(u.a)*sp - u.vz) * Math.min(1, dt*4);
  }
  function physics(u, dt){
    u.x += u.vx*dt; u.z += u.vz*dt;
    const d = Math.hypot(u.x, u.z);
    if(d > R){ u.x *= R/d; u.z *= R/d; u.vx *= -0.3; u.vz *= -0.3; }
    u.cool = Math.max(0, u.cool-dt); u.swing = Math.max(0, u.swing-dt); u.stun = Math.max(0, u.stun-dt);
    u.dodge = Math.max(0, u.dodge-dt); u.dodgeCool = Math.max(0, u.dodgeCool-dt);
    u.heat = Math.max(0, u.heat - 14*dt);
    if(u.heat >= 100 && !u.stall){ u.stall = 2; u.heat = 70; }
    u.stall = Math.max(0, u.stall-dt);
    u.power = Math.min(u.s.cap, u.power + u.s.regen*dt - (u.block ? 4*dt : 0) - 0.4*dt);
    if(u.power < 0) u.power = 0;
    // the model follows
    u.g.position.set(u.x, 0, u.z); u.g.rotation.y = u.a;
    const ud = u.g.userData;
    ud.wheels.forEach((w,i)=>{ w.rotation.x += (Math.hypot(u.vx,u.vz))*dt*3; w.visible = (i ? u.hp.rmotor : u.hp.lmotor) > 0 || true; });
    ud.wheels[0].material.color.setHex(u.hp.lmotor>0 ? 0x111111 : 0x552222);
    ud.wheels[1].material.color.setHex(u.hp.rmotor>0 ? 0x111111 : 0x552222);
    ud.armorMesh.visible = u.hp.armor > 0;
    ud.weapon.visible = u.hp.weapon > 0;
    if(u.s.weaponKind==='wpn_spinner') ud.weapon.rotation.y += dt*(u.swing ? 40 : 8);
    else if(u.s.weaponKind==='wpn_flipper') ud.weapon.rotation.x = u.swing ? -0.9 : 0;
    else ud.weapon.rotation.x = u.swing ? 0.9 : -0.3;
    const eyeCol = u.stall ? 0x555555 : u.dead ? 0x220000 : u.isFoe ? (u.brain.tele>0 ? 0xffffff : 0xff3040) : u.heat>70 ? 0xffb020 : 0x27e8ff;
    ud.eye.material.color.setHex(eyeCol); ud.eye.material.emissive.setHex(eyeCol);
    if(u.dead){ u.g.rotation.z = 0.25; }
  }
  /* separate two robots that overlap, the heavier one winning the shove */
  function collide(a, b){
    const ra = a.isFoe ? a.foe.scale : 1, rb = b.isFoe ? b.foe.scale : 1;
    const dx = b.x-a.x, dz = b.z-a.z, d = Math.hypot(dx, dz) || 0.01, min = 1.1*(ra+rb);
    if(d < min){
      const pa = a.s.push, pb = b.s.push, over = min-d, nx = dx/d, nz = dz/d;
      const wa = pb/(pa+pb), wb = pa/(pa+pb);
      a.x -= nx*over*wa; a.z -= nz*over*wa; b.x += nx*over*wb; b.z += nz*over*wb;
    }
  }

  /* ---------------------------------------------------------- the foes' AI */
  function brain(E, P, dt){
    const B = E.brain;
    B.t -= dt;
    const toP = Math.atan2(P.x-E.x, P.z-E.z), off = angDiff(toP, E.a), d = Math.hypot(P.x-E.x, P.z-E.z);
    if(E.foe.brain==='charger'){
      if(B.mode==='approach'){
        drive(E, d > 4 ? 0.6 : 0.2, Math.sign(off)*Math.min(1, Math.abs(off)*2), dt);
        if(d < 3.4) attack(E, P);
        if(B.t <= 0 && Math.abs(off) < 0.3 && d > 4 && d < 11){ B.mode = 'tele'; B.tele = 0.8; }
      } else if(B.mode==='tele'){
        B.tele -= dt; drive(E, 0, Math.sign(off)*0.4, dt);
        if(B.tele <= 0){ B.mode = 'charge'; B.t = 1.1; }
      } else if(B.mode==='charge'){
        E.vx = Math.sin(E.a)*11; E.vz = Math.cos(E.a)*11; B.t -= 0;
        if(d < 2.4){ const side = where(E, P); damage(P, E, 16, side); B.mode = 'recover'; B.t = 1.4; }
        if(B.t <= 0){ B.mode = 'recover'; B.t = 1.4; }
      } else if(B.mode==='recover'){
        drive(E, 0, 0, dt); E.vx *= 0.9; E.vz *= 0.9;
        if(B.t <= 0){ B.mode = 'approach'; B.t = 2 + Math.random()*2; }
      }
    } else {
      // the Titan: plods toward you, sweeps in front, stomps a shockwave
      if(B.mode==='approach'){
        drive(E, d > 6 ? 0.45 : 0, Math.sign(off)*Math.min(1, Math.abs(off)*1.2), dt);
        if(B.t <= 0){ B.t = 2.4 + Math.random()*1.5; B.mode = (d < 6.5 && Math.abs(off) < 0.9) ? 'sweepT' : 'stompT'; B.tele = 0.9; }
      } else if(B.mode==='sweepT' || B.mode==='stompT'){
        B.tele -= dt; drive(E, 0, 0, dt);
        if(B.tele <= 0){
          if(B.mode==='sweepT'){ E.swing = 0.5; if(d < 7 && Math.abs(off) < 1.1) damage(P, E, 18, where(E, P)); }
          else { F.shock = 0.01; }
          B.mode = 'approach';
        }
      }
    }
  }

  /* ================================================================ tick */
  function tick(dt){
    if(!F) return;
    const { P, E, keys } = F;
    F.t += dt;
    if(!F.over){
      // you
      P.block = !!keys.ShiftLeft || !!keys.ShiftRight;
      let thrust = (keys.KeyW||keys.ArrowUp?1:0) - (keys.KeyS||keys.ArrowDown?1:0);
      let turn = (keys.KeyA||keys.ArrowLeft?1:0) - (keys.KeyD||keys.ArrowRight?1:0);
      if(P.block){ thrust *= 0.3; }
      if(thrust || turn) F.goals.move = true;
      if(P.s.aim){ const off = angDiff(Math.atan2(E.x-P.x, E.z-P.z), P.a); if(Math.abs(off) < 0.8) turn += Math.sign(off)*P.s.aim; }
      drive(P, thrust, turn, dt);
      brain(E, P, dt);
      // the stomp's ring
      if(F.shock > 0){
        F.shock += dt*9;
        F.ring.position.set(E.x, 0.05, E.z); F.ring.scale.setScalar(F.shock/E.foe.scale); F.ring.material.opacity = Math.max(0, 1 - F.shock/12);
        const d = Math.hypot(P.x-E.x, P.z-E.z);
        if(!F.shockHit && Math.abs(d - F.shock) < 0.9){ F.shockHit = true; if(damage(P, E, 14, 'left')!=='dodged') P.stun = 0.7; }
        if(F.shock > 12){ F.shock = 0; F.shockHit = false; F.ring.material.opacity = 0; }
      }
      collide(P, E);
    }
    physics(P, dt); physics(E, dt);
    F.sparks = F.sparks.filter(s=>{ s.life -= dt; s.v.y -= 15*dt; s.m.position.addScaledVector(s.v, dt);
      if(s.life<=0){ F.api.group.remove(s.m); return false; } return true; });
    if(!F.over && (P.dead || E.dead)){ F.over = E.dead ? 'win' : 'lose'; F.api.fightOver(F.over, F); }
    // the camera: behind and above you, looking at the pair
    const cx = (P.x+E.x)/2, cz = (P.z+E.z)/2;
    const cam = F.api.camera;
    const back = V(P.x - Math.sin(P.a)*9, 8.5, P.z - Math.cos(P.a)*9);
    cam.position.lerp(back, Math.min(1, dt*3));
    cam.lookAt(cx, 1, cz);
  }
  function key(e, down){
    if(!F) return false;
    F.keys[e.code] = down;
    if(!down || F.over) return true;
    const P = F.P, E = F.E;
    if(e.code==='Space') attack(P, E);
    if(e.code==='KeyQ' && P.dodgeCool<=0 && P.stall<=0){
      P.dodge = 0.35; P.dodgeCool = 1.1; P.heat += 12*P.s.heatMul;
      const side = (F.keys.KeyD||F.keys.ArrowRight) ? -1 : 1;
      P.vx += Math.cos(P.a)*side*9; P.vz += -Math.sin(P.a)*side*9; F.goals.dodge = true;
    }
    if(e.code==='ShiftLeft' || e.code==='ShiftRight') F.goals.block = true;
    if(e.code==='KeyF'){ F.scanned = true; F.goals.scan = true; F.api.scan(F); }
    return true;
  }
  function stop(){ F = null; }

  return { PARTS, SLOTS, FOES, find, stats, model, start, tick, key, stop, get fight(){ return F; } };
})();
