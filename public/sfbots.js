/* =====================================================================
   SANFRAN — THE ROBOTS. What a combat robot is made of, and how two of
   them fight. The world, the story and the RPG systems are sanfran.js.

   A ROBOT IS SIX PARTS: CORE, FRAME, MOTOR, POWER, WEAPON, CONTROL. Each
   option changes numbers you can feel — a light frame turns fast and
   folds when hit, a heavy one shrugs and crawls — and the bench shows
   the robot change in front of you as you swap them.

   A FIGHT IS COMPONENTS, NOT A HEALTH BAR. Core, left motor, right motor,
   armour and weapon each have their own HP. Where a hit lands decides
   what it breaks: the front is armour, the flanks are the motors, the
   back is the core. A robot with a dead left motor pulls left and turns
   badly; with its weapon gone it cannot attack; with its core at zero it
   shuts down. Attacks and dodges make heat and overheating stalls you;
   blocking drains power.

   EVERYTHING THE FIGHT WANTS YOU TO KNOW IS DRAWN, NOT WRITTEN. A charge
   paints its lane on the floor before it comes; a sweep paints its arc;
   a stomp pulses at the Titan's feet. A robot that has left its back
   open grows a target on it. A scan puts a marker on the weak motor.
   Hits pop their damage where they land, broken motors smoke, a hot
   robot glows, and the key that answers the moment pulses on the HUD
   (F.cue). Nobody has to read a tip to learn to dodge a charge.
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
      { id:'power_aa',     name:'AA pack',        cap:80,  regen:0,  desc:'Eight AAs taped together. Do not tell Daichi.' },
      { id:'power_liion',  name:'Li-ion cell',    cap:120, regen:2,  desc:'Salvaged from a scooter. Solid.' },
      { id:'power_supercap', name:'Supercap',     cap:70, regen:9,  need:{ energy:2 }, desc:'Tiny store, refills fast. Energy 2 to wire safely.' }
    ],
    weapon: [
      { id:'wpn_hammer',  name:'Hammer',  dmg:13, cd:1.1, reach:2.6, heat:18, weaponHp:45, desc:'Slow, heavy overhead strike.' },
      { id:'wpn_spinner', name:'Spinner', dmg:6,  cd:0.45, reach:2.2, heat:14, weaponHp:35, desc:'Fast cuts. Builds heat fast.' },
      { id:'wpn_flipper', name:'Flipper', dmg:5,  cd:0.9, reach:2.4, heat:12, weaponHp:55, knock:9, desc:'Throws them off balance — a stun and a shove.' }
    ],
    control: [
      { id:'ctl_remote', name:'Remote link', turnBonus:1.0, aim:0,    desc:'A cheap radio link. Does what you tell it, late.' },
      { id:'ctl_gyro',   name:'Gyro',        turnBonus:1.25, aim:0,   desc:'Holds a line even with a damaged motor.', steady:true },
      { id:'ctl_aim',    name:'Auto-aim',    turnBonus:1.0, aim:0.6, need:{ prog:2 }, desc:'Nudges you onto the target. Programming 2 to flash it.' }
    ],
    core: [
      { id:'core_std',    name:'Standard core', coreHp:100, desc:'A microcontroller and a prayer.' },
      { id:'core_shield', name:'Shielded core', coreHp:130, need:{ mat:2 }, desc:'Wrapped in aramid. Material Science 2.' }
    ]
  };
  const SLOTS = ['core','frame','motor','power','weapon','control'];
  const find = id => { for(const s of SLOTS){ const p = PARTS[s].find(x=>x.id===id); if(p) return p; } return null; };

  /* A build's numbers, as the bench shows them and the fight uses. A
     build with no weapon has no weapon — a bare chassis on the bench is
     a bare chassis, not a hammer you never bought. */
  function stats(build){
    const p = s => find(build[s]) || PARTS[s][0];
    const f = p('frame'), m = p('motor'), pw = p('power'), w = p('weapon'), c = p('control'), co = p('core');
    return {
      core: co.coreHp, armor: f.armor + (build.plating ? 30 : 0), motor: m.motorHp, weapon: w.weaponHp,
      speed: 5.2 * f.speed * m.power, turn: 2.6 * f.turn * c.turnBonus, push: (m.push||1) * (f.weight/12),
      weight: f.weight + (build.plating ? 4 : 0), cap: pw.cap, regen: pw.regen, heatMul: m.heat,
      dmg: w.dmg, cd: w.cd, reach: w.reach, wHeat: w.heat, knock: w.knock||0, aim: c.aim, steady: !!c.steady,
      weaponKind: build.weapon ? w.id : null, plating: !!build.plating,
      motorKind: m.id, powerKind: pw.id, controlKind: c.id, coreKind: co.id,
      color: f.id==='frame_light' ? 0x27e8ff : f.id==='frame_heavy' ? 0xff8a3d : 0x3ddc84
    };
  }

  /* ---------------------------------------------------------- the model
     Boxes, but the right boxes: chassis sized by frame, two wheels that
     show their motors, an armour plate on the front, the weapon on top,
     and an eye that goes amber when hot and red when dying. Every part
     you can choose shows: sprint motors wear red hubs, torque motors are
     fat, a supercap glows on the back, a gyro spins on top, an auto-aim
     chip is a little dish.

     wheels[0] is at -x and wheels[1] at +x. Facing +z, a robot's own
     LEFT is +x — so wheels[1] is the left motor and wheels[0] the right,
     which is how where() below names the sides. */
  function model(s, scale){
    const g = new THREE.Group(), k = scale || 1;
    const mat = (c, r, m) => new THREE.MeshStandardMaterial({ color:c, roughness:r===undefined?0.45:r, metalness:m===undefined?0.55:m });
    const glowM = (c, i) => new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:i||1.6 });
    const w = (0.9 + s.weight/30)*k, l = (1.2 + s.weight/24)*k, h = 0.5*k + s.weight/60*k;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat(0x6a7488, 0.5, 0.5)); body.position.y = 0.35*k + h/2; g.add(body);
    body.material.emissive = new THREE.Color(0xff4a10); body.material.emissiveIntensity = 0;
    // a stripe in the frame's colour down each side, so the frame reads from any angle
    [-1,1].forEach(sx=>{ const st = new THREE.Mesh(new THREE.BoxGeometry(0.03*k, h*0.35, l*0.9), glowM(s.color, 0.6)); st.position.set(sx*(w/2+0.01*k), body.position.y, 0); g.add(st); });
    const armor = new THREE.Mesh(new THREE.BoxGeometry(w*1.05, h*0.9, (s.plating ? 0.3 : 0.15)*k), mat(s.color, 0.35, 0.6));
    armor.position.set(0, 0.35*k + h/2, l/2 + (s.plating ? 0.12 : 0.05)*k); g.add(armor);
    if(s.plating){ for(let i=-1;i<=1;i+=2) for(let j=-1;j<=1;j+=2){ const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04*k,0.04*k,0.05*k,8), mat(0xdddddd)); b.rotation.x = Math.PI/2; b.position.set(i*w*0.4, armor.position.y + j*h*0.3, armor.position.z + 0.16*k); g.add(b); } }
    const fat = s.motorKind==='motor_torque' ? 1.45 : 1, hub = s.motorKind==='motor_sprint' ? 0xff3a3a : s.motorKind==='motor_torque' ? 0xffd23d : 0x9aa4b4;
    const wheels = [];
    [-1,1].forEach(sx=>{
      const wh = new THREE.Group();
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.35*k, 0.35*k, 0.22*k*fat, 16), mat(0x22242a, 0.8, 0.1));
      tyre.rotation.z = Math.PI/2; wh.add(tyre);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16*k, 0.16*k, 0.24*k*fat, 8), mat(hub, 0.3, 0.7));
      cap.rotation.z = Math.PI/2; wh.add(cap);
      wh.position.set(sx*(w/2+0.12*k*fat), 0.35*k, 0); g.add(wh); wheels.push(wh);
      wh.userData.tyre = tyre;
    });
    let weapon;
    if(s.weaponKind==='wpn_spinner'){ weapon = new THREE.Mesh(new THREE.CylinderGeometry(0.55*k, 0.55*k, 0.08*k, 3), mat(0xdfe4ee, 0.25, 0.9)); weapon.position.set(0, 0.35*k+h+0.1*k, l*0.25); }
    else if(s.weaponKind==='wpn_flipper'){ weapon = new THREE.Mesh(new THREE.BoxGeometry(w*0.9, 0.08*k, 0.6*k), mat(0xdfe4ee, 0.25, 0.9)); weapon.position.set(0, 0.4*k, l/2+0.3*k); }
    else if(s.weaponKind==='wpn_hammer'){ weapon = new THREE.Group(); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15*k, 0.15*k, 1.1*k), mat(0xaab2c0)); arm.position.z = 0.55*k; weapon.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45*k, 0.35*k, 0.35*k), mat(0xdfe4ee, 0.25, 0.9)); head.position.z = 1.1*k; weapon.add(head);
      weapon.position.set(0, 0.35*k+h, 0); }
    else weapon = new THREE.Group();
    g.add(weapon);
    // what the power and control parts look like
    if(s.powerKind==='power_supercap'){ const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.12*k,0.12*k,w*0.7,12), glowM(0xffd23d, 1.2)); cell.rotation.z = Math.PI/2; cell.position.set(0, 0.35*k+h*0.8, -l/2-0.06*k); g.add(cell); }
    else if(s.powerKind==='power_liion'){ const cell = new THREE.Mesh(new THREE.BoxGeometry(w*0.6, h*0.5, 0.12*k), mat(0x3ddc84, 0.4, 0.3)); cell.position.set(0, 0.35*k+h*0.5, -l/2-0.06*k); g.add(cell); }
    let gyro = null;
    if(s.controlKind==='ctl_gyro'){ gyro = new THREE.Mesh(new THREE.TorusGeometry(0.16*k, 0.03*k, 6, 16), glowM(0x8fd3ff, 1)); gyro.position.set(-w*0.3, 0.35*k+h+0.18*k, -l*0.3); g.add(gyro); }
    else if(s.controlKind==='ctl_aim'){ const dish = new THREE.Mesh(new THREE.ConeGeometry(0.14*k, 0.1*k, 12, 1, true), glowM(0xff3fd0, 1)); dish.rotation.x = Math.PI/2; dish.position.set(w*0.3, 0.35*k+h+0.1*k, l*0.35); g.add(dish); }
    else { const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01*k,0.01*k,0.5*k), mat(0x333333)); ant.position.set(-w*0.35, 0.35*k+h+0.25*k, -l*0.35); g.add(ant); }
    if(s.coreKind==='core_shield'){ const sh = new THREE.Mesh(new THREE.BoxGeometry(w*0.5, 0.06*k, l*0.4), mat(0xc8b060, 0.6, 0.2)); sh.position.set(0, 0.35*k+h+0.03*k, -l*0.1); g.add(sh); }
    const eye = new THREE.Mesh(new THREE.BoxGeometry(w*0.5, 0.08*k, 0.05*k), glowM(0x27e8ff));
    eye.position.set(0, 0.35*k + h*0.75, l/2 + (s.plating ? 0.3 : 0.14)*k); g.add(eye);
    g.userData = { wheels, weapon, eye, armorMesh:armor, body, k, w, l, h, gyro };
    return g;
  }

  /* ---------------------------------------------------------- opponents */
  const FOES = {
    bruiser: { name:'BRUISER', build:{ core:'core_std', frame:'frame_heavy', motor:'motor_torque', power:'power_liion', weapon:'wpn_hammer', control:'ctl_remote' },
      scale:1.15, brain:'charger', hpMul:1.0, reward:{ rxp:120, credits:90, rep:1 } },
    titan: { name:'THE TITAN', build:{ core:'core_shield', frame:'frame_heavy', motor:'motor_torque', power:'power_liion', weapon:'wpn_hammer', control:'ctl_gyro' },
      scale:2.0, brain:'titan', hpMul:2.2, weakRight:true, reward:{ rxp:300, credits:200, rep:2 } }
  };

  /* ================================================================ fight
     One fight at a time. `api` is sanfran.js: it owns the camera, the
     scene group, the HUD and what happens after, and it is told about
     hits (pop) so it can print them where they land. */
  let F = null;
  function unit(build, isFoe, foe){
    const s = stats(build), mul = foe ? foe.hpMul : 1;
    const hp = { core:s.core*mul, lmotor:s.motor*mul, rmotor:s.motor*mul, armor:s.armor*mul, weapon:s.weapon*mul };
    return { s, hp, max:Object.assign({}, hp), x:0, z:0, a:0, vx:0, vz:0, heat:0, power:s.cap, cool:0,
      block:false, dodge:0, dodgeCool:0, stun:0, stall:0, swing:0, isFoe, foe, g:null, dead:false, smokeT:0,
      broke:{}, brain:{ t:1.5, mode:'approach', tele:0 } };
  }
  const flatMat = (c, o) => new THREE.MeshBasicMaterial({ color:c, transparent:true, opacity:o||0, side:THREE.DoubleSide, depthWrite:false });
  function start(api, playerBuild, foeId){
    const foe = FOES[foeId];
    const P = unit(playerBuild, false), E = unit(foe.build, true, foe);
    P.x = 0; P.z = 8; P.a = Math.PI; E.x = 0; E.z = -8; E.a = 0;
    P.g = model(P.s, 1); E.g = model(E.s, foe.scale);
    E.g.userData.eye.material.color.setHex(0xff3040); E.g.userData.eye.material.emissive.setHex(0xff3040);
    api.group.add(P.g); api.group.add(E.g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(foe.scale*1.4, foe.scale*1.6, 40), flatMat(0xff3040));
    ring.rotation.x = -Math.PI/2; ring.position.y = FLOOR + 0.02; api.group.add(ring);
    /* The telegraphs, children of the foe so they turn with it. */
    const ud = E.g.userData;
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(ud.w*1.3, 12), flatMat(0xff3040));
    lane.rotation.x = -Math.PI/2; lane.position.set(0, 0.05, ud.l/2 + 6); E.g.add(lane);
    const arc = new THREE.Mesh(new THREE.CircleGeometry(7, 28, -Math.PI/2 - 1.1, 2.2), flatMat(0xff3040));
    arc.rotation.x = -Math.PI/2; arc.position.y = 0.05; E.g.add(arc);
    // "hit me here": a target on the back, and one on the right motor for the scan
    const target = () => { const t = new THREE.Group();
      const r1 = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 28), flatMat(0xff3040, 0.95)); t.add(r1);
      const r2 = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), flatMat(0xffd23d, 0.95)); t.add(r2);
      t.visible = false; return t; };
    const back = target(); back.scale.setScalar(foe.scale); back.position.set(0, ud.h*0.7 + 0.35*ud.k, -ud.l/2 - 0.08); back.rotation.y = Math.PI; E.g.add(back);
    const weak = target(); weak.scale.setScalar(foe.scale*1.2); const rw = ud.wheels[0].position;
    weak.position.set(rw.x - 0.5*ud.k, rw.y + 0.35*ud.k, rw.z); E.g.add(weak);
    const scanRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 40), flatMat(0x27e8ff));
    scanRing.rotation.x = -Math.PI/2; scanRing.position.y = FLOOR + 0.03; api.group.add(scanRing);
    F = { api, P, E, foe, foeId, keys:{}, t:0, scanned:false, over:null, ring, shock:0, sparks:[], puffs:[], debris:[],
          lane, arc, back, weak, scanRing, scanFx:0, scanT:0, hold:2.6, slow:0, shake:0, cue:null, weakHits:0 };
    return F;
  }
  const R = 12.5;                                   // the arena's radius
  const FLOOR = 0.31;                               // the ring's steel deck, which the robots stand on
  const angDiff = (a,b)=>Math.atan2(Math.sin(a-b), Math.cos(a-b));
  /* Where a hit from `from` lands on `to`: which component takes it. */
  function where(from, to){
    const ang = Math.atan2(from.x-to.x, from.z-to.z);          // direction to the attacker, world
    const rel = angDiff(ang, to.a);                            // 0 = in front of `to`
    if(Math.abs(rel) < 0.8) return 'front';
    if(Math.abs(rel) > 2.3) return 'rear';
    return rel > 0 ? 'left' : 'right';
  }
  const at = (u, y) => V(u.x, (y===undefined ? 1.6*(u.isFoe ? u.foe.scale : 1) : y) + 0.31, u.z);
  function damage(to, from, amount, side){
    if(to.dodge > 0){ pop('MISS', at(to), '#8fd3ff'); return 'dodged'; }
    let amt = amount;
    if(to.block && side==='front'){ amt *= 0.25; to.power = Math.max(0, to.power - 6); }
    const H = to.hp, weak = to.foe && to.foe.weakRight;
    let hit, dealt = 0;
    const cut = (k, n) => { const b = H[k]; H[k] = Math.max(0, H[k] - n); dealt += b - H[k]; };
    if(side==='front'){
      if(H.armor > 0){ cut('armor', weak ? amt*0.25 : amt); hit = 'armor'; }
      else { const b = H.core; H.core -= amt*0.7; dealt += b - Math.max(0,H.core); cut('weapon', amt*0.3); hit = 'core'; }
    } else if(side==='left'){ cut('lmotor', amt); if(H.lmotor<=0){ const b = H.core; H.core -= amt*0.5; dealt += b - Math.max(0,H.core); } hit = 'lmotor'; }
    else if(side==='right'){ const m = weak ? 2 : 1; cut('rmotor', amt*m); if(H.rmotor<=0){ const b = H.core; H.core -= amt*0.6*m; dealt += b - Math.max(0,H.core); } hit = 'rmotor'; if(weak) F.weakHits++; }
    else { const b = H.core; H.core -= amt*1.6; dealt += b - Math.max(0,H.core); hit = 'core'; }
    H.core = Math.max(0, H.core);
    if(H.core <= 0) to.dead = true;
    const big = (weak && side==='right') || side==='rear';
    burst(to, hit==='armor' ? 0x9ab4ff : big ? 0xffd23d : 0xffa040, big ? 26 : 14);
    const n = Math.max(1, Math.round(dealt));
    pop((hit==='armor' && weak ? '🛡 ' : '') + '-' + n + (big && to.isFoe ? '!' : ''), at(to), hit==='armor' ? '#9ab4ff' : big ? '#ffd23d' : '#ff9a5a', big);
    if(big){ F.shake = 0.3; if(F.api.cheer) F.api.cheer(); }
    // what broke, falls off
    if(H.armor <= 0 && !to.broke.armor){ to.broke.armor = true; drop(to, to.g.userData.armorMesh); }
    if(H.weapon <= 0 && !to.broke.weapon){ to.broke.weapon = true; drop(to, to.g.userData.weapon); }
    return hit;
  }
  function pop(text, pos, color, big){ if(F && F.api.pop) F.api.pop(text, pos, color, big); }
  /* A part that breaks comes off and bounces, rather than just vanishing. */
  function drop(u, mesh){
    if(!mesh || !mesh.visible) return;
    const c = mesh.clone(true); mesh.getWorldPosition(c.position); mesh.getWorldQuaternion(c.quaternion);
    F.api.group.add(c); mesh.visible = false;
    F.debris.push({ m:c, v:V((Math.random()-0.5)*4, 5, (Math.random()-0.5)*4), spin:V(Math.random()*6, Math.random()*6, 0), life:3 });
  }
  const sparkGeo = new THREE.BoxGeometry(0.08,0.08,0.08);
  function burst(u, col, n){
    for(let i=0;i<(n||14);i++){
      const s = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color:col }));
      s.position.set(u.x, 1 + Math.random(), u.z); F.api.group.add(s);
      F.sparks.push({ m:s, v:V((Math.random()-0.5)*8, 2+Math.random()*5, (Math.random()-0.5)*8), life:0.6 });
    }
  }
  const puffGeo = new THREE.SphereGeometry(0.18, 6, 5);
  function puff(pos, col){
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color:col||0x555a66, transparent:true, opacity:0.6, depthWrite:false }));
    m.position.copy(pos); F.api.group.add(m);
    F.puffs.push({ m, life:1.2, v:V((Math.random()-0.5)*0.5, 1.4, (Math.random()-0.5)*0.5) });
  }
  function attack(u, target){
    if(u.cool > 0 || u.stall > 0 || u.hp.weapon <= 0 || u.stun > 0) return false;
    u.cool = u.s.cd; u.swing = 0.25; u.heat += u.s.wHeat * u.s.heatMul;
    const d = Math.hypot(target.x-u.x, target.z-u.z), facing = Math.abs(angDiff(Math.atan2(target.x-u.x, target.z-u.z), u.a));
    const reach = u.s.reach * (u.isFoe ? u.foe.scale : 1) + (target.isFoe ? target.foe.scale*0.8 : 0.8);
    if(d < reach && facing < 0.9){
      const side = where(u, target);
      const res = damage(target, u, u.s.dmg, side);
      if(res !== 'dodged' && u.s.knock){ target.stun = 0.6; const k = u.s.knock/(target.s.weight/12); target.vx += Math.sin(u.a)*k; target.vz += Math.cos(u.a)*k; }
      return side;
    }
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
  const tmp = V(0,0,0);
  function physics(u, dt){
    u.x += u.vx*dt; u.z += u.vz*dt;
    const d = Math.hypot(u.x, u.z);
    if(d > R){ u.x *= R/d; u.z *= R/d; u.vx *= -0.3; u.vz *= -0.3; }
    u.cool = Math.max(0, u.cool-dt); u.swing = Math.max(0, u.swing-dt); u.stun = Math.max(0, u.stun-dt);
    u.dodge = Math.max(0, u.dodge-dt); u.dodgeCool = Math.max(0, u.dodgeCool-dt);
    u.heat = Math.max(0, u.heat - 14*dt);
    if(u.heat >= 100 && !u.stall){ u.stall = 2; u.heat = 70; for(let i=0;i<5;i++) puff(at(u, 1.2), 0xdddddd); pop('🔥', at(u), '#ff8a3d', true); }
    u.stall = Math.max(0, u.stall-dt);
    u.power = Math.min(u.s.cap, u.power + u.s.regen*dt - (u.block ? 4*dt : 0) - 0.4*dt);
    if(u.power < 0) u.power = 0;
    // the model follows
    u.g.position.set(u.x, FLOOR, u.z); u.g.rotation.y = u.a;
    const ud = u.g.userData;
    ud.wheels.forEach(w=>{ w.userData.tyre.rotation.y += (Math.hypot(u.vx,u.vz))*dt*3; });
    // wheels[1] is the left motor, wheels[0] the right (see model)
    ud.wheels[1].userData.tyre.material.color.setHex(u.hp.lmotor>0 ? 0x22242a : 0x6a2222);
    ud.wheels[0].userData.tyre.material.color.setHex(u.hp.rmotor>0 ? 0x22242a : 0x6a2222);
    if(ud.gyro) ud.gyro.rotation.y += dt*6;
    // a hot robot glows; a broken motor smokes
    ud.body.material.emissiveIntensity = Math.max(0, (u.heat-35)/65) * 0.9 + (u.stall ? 0.4 : 0);
    u.smokeT -= dt;
    if(u.smokeT <= 0){ u.smokeT = 0.18;
      [[u.hp.lmotor/u.max.lmotor, 1], [u.hp.rmotor/u.max.rmotor, 0]].forEach(([f, i])=>{
        if(f < 0.5){ ud.wheels[i].getWorldPosition(tmp); tmp.y += 0.3*ud.k; puff(tmp, f <= 0 ? 0x2a2a2a : 0x777c88); } }); }
    ud.weapon.visible = u.hp.weapon > 0 && !u.broke.weapon;
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
        if(B.t <= 0 && Math.abs(off) < 0.3 && d > 4 && d < 11){ B.mode = 'tele'; B.tele = 0.9; }
      } else if(B.mode==='tele'){
        B.tele -= dt; drive(E, 0, Math.sign(off)*0.4, dt);
        if(B.tele <= 0){ B.mode = 'charge'; B.t = 1.1; }
      } else if(B.mode==='charge'){
        E.vx = Math.sin(E.a)*11; E.vz = Math.cos(E.a)*11;
        if(d < 2.4){ const side = where(E, P); damage(P, E, 16, side); B.mode = 'recover'; B.t = 1.6; }
        if(B.t <= 0){ B.mode = 'recover'; B.t = 1.6; }
      } else if(B.mode==='recover'){
        drive(E, 0, 0, dt); E.vx *= 0.9; E.vz *= 0.9;
        if(B.t <= 0){ B.mode = 'approach'; B.t = 2 + Math.random()*2; }
      }
    } else {
      // the Titan: plods toward you, sweeps in front, stomps a shockwave
      if(B.mode==='approach'){
        drive(E, d > 6 ? 0.45 : 0, Math.sign(off)*Math.min(1, Math.abs(off)*1.2), dt);
        if(B.t <= 0){ B.t = 2.4 + Math.random()*1.5; B.mode = (d < 6.5 && Math.abs(off) < 0.9) ? 'sweepT' : 'stompT'; B.tele = 1.0; }
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

  /* What the moment is asking for, for the HUD to light the key: dodge
     when something is coming, hit when a back or a weak motor is open,
     scan when the Titan has not been looked at yet. */
  function cueNow(){
    const { P, E } = F, B = E.brain, d = Math.hypot(P.x-E.x, P.z-E.z);
    if(B.mode==='tele' || B.mode==='sweepT' || B.mode==='stompT') return 'dodge';
    if(F.shock > 0 && Math.abs(d - F.shock) < 3.5) return 'dodge';
    const reach = P.s.reach + E.foe.scale*0.8 + 0.6, side = where(P, E);
    if(d < reach && (side==='rear' || (E.foe.weakRight && side==='right'))) return 'hit';
    if(B.mode==='recover' && d < 7) return 'hit';
    if(E.foe.weakRight && !F.scanned) return 'scan';
    return null;
  }

  /* ================================================================ tick */
  function tick(dt){
    if(!F) return;
    if(F.slow > 0){ F.slow -= dt; dt *= 0.3; }
    const { P, E, keys } = F;
    F.t += dt;
    if(F.hold > 0) F.hold -= dt;
    if(!F.over && F.hold <= 0){
      // you
      P.block = !!keys.ShiftLeft || !!keys.ShiftRight;
      let thrust = (keys.KeyW||keys.ArrowUp?1:0) - (keys.KeyS||keys.ArrowDown?1:0);
      let turn = (keys.KeyA||keys.ArrowLeft?1:0) - (keys.KeyD||keys.ArrowRight?1:0);
      if(P.block){ thrust *= 0.3; }
      if(P.s.aim){ const off = angDiff(Math.atan2(E.x-P.x, E.z-P.z), P.a); if(Math.abs(off) < 0.8) turn += Math.sign(off)*P.s.aim; }
      drive(P, thrust, turn, dt);
      brain(E, P, dt);
      // the stomp's ring
      if(F.shock > 0){
        F.shock += dt*9;
        F.ring.position.set(E.x, FLOOR + 0.02, E.z); F.ring.scale.setScalar(F.shock/E.foe.scale); F.ring.material.opacity = Math.max(0, 1 - F.shock/12);
        const d = Math.hypot(P.x-E.x, P.z-E.z);
        if(!F.shockHit && Math.abs(d - F.shock) < 0.9){ F.shockHit = true; if(damage(P, E, 14, 'left')!=='dodged') P.stun = 0.7; }
        if(F.shock > 12){ F.shock = 0; F.shockHit = false; F.ring.material.opacity = 0; }
      }
      collide(P, E);
      F.cue = cueNow();
    } else if(F.over) F.cue = null;
    // the telegraphs: a lane for the charge, an arc for the sweep, a pulse for the stomp
    const B = E.brain, pulse = 0.35 + 0.35*Math.abs(Math.sin(F.t*14));
    F.lane.material.opacity = B.mode==='tele' ? pulse : B.mode==='charge' ? 0.25 : 0;
    F.arc.material.opacity = B.mode==='sweepT' ? 0.15 + 0.5*(1 - Math.min(1, Math.max(0, B.tele))) : 0;
    if(B.mode==='stompT'){ F.ring.position.set(E.x, FLOOR + 0.02, E.z); F.ring.scale.setScalar(1 + 0.3*Math.sin(F.t*18)); F.ring.material.opacity = pulse; }
    else if(F.shock <= 0) F.ring.material.opacity = 0;
    F.back.visible = !F.over && E.foe.brain==='charger' && B.mode==='recover';
    if(F.scanT > 0) F.scanT -= dt;
    F.weak.visible = !F.over && E.foe.weakRight && F.scanT > 0 && E.hp.rmotor > 0;
    [F.back, F.weak].forEach(m=>{ if(m.visible){ m.children[0].scale.setScalar(1 + 0.25*Math.sin(F.t*8)); m.lookAt(F.api.camera.position); } });
    const rt = E.g.userData.wheels[0].userData.tyre.material;       // the cracked motor, lit while it is known
    if(!rt.emissive) rt.emissive = new THREE.Color();
    rt.emissive.setHex(0xff2020); rt.emissiveIntensity = F.weak.visible ? 0.4 + 0.5*Math.abs(Math.sin(F.t*6)) : 0;
    // the scan sweeping out to the foe
    if(F.scanFx > 0){ F.scanFx -= dt; const k = 1 - F.scanFx/0.7;
      F.scanRing.position.set(P.x, FLOOR + 0.03, P.z); F.scanRing.scale.setScalar(1 + k*18); F.scanRing.material.opacity = 0.8*(1-k); }
    else F.scanRing.material.opacity = 0;
    physics(P, dt); physics(E, dt);
    F.sparks = F.sparks.filter(s=>{ s.life -= dt; s.v.y -= 15*dt; s.m.position.addScaledVector(s.v, dt);
      if(s.life<=0){ F.api.group.remove(s.m); s.m.material.dispose(); return false; } return true; });
    F.puffs = F.puffs.filter(p=>{ p.life -= dt; p.m.position.addScaledVector(p.v, dt); p.m.scale.setScalar(1 + (1.2-p.life)*1.6);
      p.m.material.opacity = Math.max(0, p.life/1.2*0.6); if(p.life<=0){ F.api.group.remove(p.m); p.m.material.dispose(); return false; } return true; });
    F.debris = F.debris.filter(b=>{ b.life -= dt; b.v.y -= 15*dt; b.m.position.addScaledVector(b.v, dt);
      if(b.m.position.y < FLOOR + 0.1){ b.m.position.y = FLOOR + 0.1; b.v.y *= -0.35; b.v.x *= 0.7; b.v.z *= 0.7; b.spin.multiplyScalar(0.6); }
      b.m.rotation.x += b.spin.x*dt; b.m.rotation.y += b.spin.y*dt; return true; });
    if(!F.over && (P.dead || E.dead)){ F.over = E.dead ? 'win' : 'lose'; F.slow = 1.2; F.shake = 0.5; F.api.fightOver(F.over, F); }
    // the camera: behind and above you, looking at the pair
    const cx = (P.x+E.x)/2, cz = (P.z+E.z)/2;
    const cam = F.api.camera;
    const back = V(P.x - Math.sin(P.a)*9, 8.5, P.z - Math.cos(P.a)*9);
    cam.position.lerp(back, Math.min(1, dt*3));
    if(F.shake > 0){ F.shake -= dt; const s = F.shake*0.6; cam.position.x += (Math.random()-0.5)*s; cam.position.y += (Math.random()-0.5)*s; }
    cam.lookAt(cx, 1, cz);
  }
  function key(e, down){
    if(!F) return false;
    F.keys[e.code] = down;
    if(!down || F.over || F.hold > 0) return true;
    const P = F.P, E = F.E;
    if(e.code==='Space') attack(P, E);
    if(e.code==='KeyQ' && P.dodgeCool<=0 && P.stall<=0){
      P.dodge = 0.35; P.dodgeCool = 1.1; P.heat += 12*P.s.heatMul;
      const side = (F.keys.KeyD||F.keys.ArrowRight) ? -1 : 1;
      P.vx += Math.cos(P.a)*side*9; P.vz += -Math.sin(P.a)*side*9;
    }
    if(e.code==='KeyF'){ F.scanned = true; F.scanFx = 0.7; F.scanT = F.api.scan ? F.api.scan(F) : 6; }
    return true;
  }
  function stop(){ F = null; }

  return { PARTS, SLOTS, FOES, find, stats, model, start, tick, key, stop, where, get fight(){ return F; } };
})();
