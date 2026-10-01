/* =====================================================================
   HEALTH ON WANO — out in the open world, not only in the missions.

   A hundred points, the same bar the missions use (#health), and three
   things that take them away:
     A FALL. Landing hard hurts, by how fast you hit the ground: a jump is
       nothing, a roof is a bruise, a sky island is the end. Flying down and
       landing in water are not falls.
     THE SEA. Under the surface you are holding your breath (a second bar
       under the first). It lasts about twenty seconds; when it is gone the
       water starts to cost health until you come up, and at the top it
       fills again.
     SHARKS. A reef shark or a hammerhead that passes close enough bites,
       and then has to come round again before it can bite again.

   NOTHING HEALS ON ITS OWN. Health comes back from orbs: soft green lights
   hung round Wano, a few in the town, some out on the hills, two on the
   reef for a diver who stayed down too long. Through one is thirty-five
   points back, and it is gone for a minute.

   AT ZERO you lose every coin you are carrying and wake in front of
   Mission Control with a full bar. Everything else (level, what you own,
   what you have finished, what you have found) is kept.

   planet.js calls: build(ctx) when Wano is built, tick(dt, me) every frame
   on Wano, landed(speed) when a fall ends on the ground, and clear() when
   you leave. ctx.respawn() is what puts you back at the door.
   ===================================================================== */
window.HEALTH = (function(){
  const MAX = 100, BREATH = 20, ORB_HEAL = 35, ORB_BACK = 60;
  const SAFE_LAND = 13;                 // m/s you can land at for free (a jump lands at ~9)
  let hp = MAX, breath = BREATH, on = false, ctx = null, dead = false;
  let orbs = [], group = null, biteCool = 0, drownT = 0, t = 0;
  const $ = s => document.querySelector(s);
  const V = (x,y,z) => new THREE.Vector3(x||0, y||0, z||0);

  /* -------------------------------------------------------- the bars */
  function bars(){
    let b = $('#breath');
    if(!b){
      const h = $('#health'); if(!h) return;
      b = document.createElement('div'); b.id = 'breath'; b.className = 'hidden';
      b.innerHTML = '<div class="hp-top"><span>BREATH</span><span id="brNum">20</span></div><div class="brBar"><div id="brFill"></div></div>';
      h.appendChild(b);
      if(!$('#healthStyle')){
        const st = document.createElement('style'); st.id = 'healthStyle';
        st.textContent = '#breath{margin-top:8px}#breath .brBar{height:8px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden}'
          + '#brFill{height:100%;width:100%;background:linear-gradient(90deg,#4ad7ff,#bff3ff);transition:width .15s}#brFill.low{background:linear-gradient(90deg,#ff6a5c,#ffb0a4)}';
        document.head.appendChild(st);
      }
    }
  }
  function draw(){
    const f = $('#hpFill'), n = $('#hpNum'), l = $('#hpLbl');
    if(f){ f.style.width = (hp/MAX*100)+'%'; f.classList.toggle('low', hp <= 35); }
    if(n) n.textContent = Math.round(hp);
    if(l) l.textContent = 'HEALTH';
    const b = $('#breath'), bf = $('#brFill'), bn = $('#brNum');
    if(b) b.classList.toggle('hidden', breath >= BREATH - 0.01);
    if(bf){ bf.style.width = (breath/BREATH*100)+'%'; bf.classList.toggle('low', breath < 5); }
    if(bn) bn.textContent = Math.ceil(breath);
  }
  function flash(){ const h = $('#hurt'); if(!h) return; h.classList.add('on'); setTimeout(()=>h.classList.remove('on'), 220); }
  function say(msg){ if(window.PLANET && PLANET.say) PLANET.say(msg); else if(window.toast) toast(msg); }

  /* ------------------------------------------------------- the damage */
  // nothing hurts while this is set: the TikTok rig films the real game and drops people out of the sky on purpose
  let immortal = false;
  function hurt(n, why){
    if(!on || dead || immortal) return;
    n = Math.max(1, Math.round(n));
    hp = Math.max(0, hp - n);
    draw(); flash();
    if(window.beep) beep('bad');
    if(hp <= 0) die(why);
  }
  function heal(n){
    hp = Math.min(MAX, hp + n); draw();
    if(window.beep) beep('good');
  }
  function die(why){
    dead = true;
    const lost = window.WALLET ? WALLET.coins() : 0;
    if(lost > 0 && window.WALLET) WALLET.spend(lost);
    const black = $('#fade') || (()=>{ const d = document.createElement('div'); d.id = 'fade';
      d.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;transition:opacity .6s;pointer-events:none;z-index:9000';
      document.body.appendChild(d); return d; })();
    black.style.opacity = '1';
    setTimeout(()=>{
      if(ctx && ctx.respawn) ctx.respawn();
      hp = MAX; breath = BREATH; dead = false; draw();
      black.style.opacity = '0';
      say((why ? why + ' · ' : '') + (lost > 0 ? `You lost all ${lost} coins.` : 'You woke up at Mission Control.'));
    }, 900);
  }

  /* A fall ends on the ground at `speed` m/s (downward). */
  function landed(speed){
    if(!on || speed <= SAFE_LAND) return;
    hurt(Math.pow(speed - SAFE_LAND, 1.5) * 1.6, speed > 30 ? 'That was a long way down' : null);
  }

  /* ------------------------------------------------------- the orbs */
  const ORBS = [   // [lon, lat], or { sea:[x, z] } for a spot on the reef (ocean.js map metres)
    [3, 9], [-8, 2], [12, -4], [-22, -2], [24, 6], [-14, 14], [8, 20], [-30, 10], [30, -8], [0, -26],
    [18, 16], [-36, -8], { sea:[0.56, 0.1] }, { sea:[0.45, -0.2] },
  ];
  function buildOrbs(){
    const geo = new THREE.SphereGeometry(0.45, 20, 14);
    const core = new THREE.MeshBasicMaterial({ color:0x7dffb0 });
    const halo = new THREE.MeshBasicMaterial({ color:0x3cff8a, transparent:true, opacity:0.28, depthWrite:false });
    const cross = new THREE.MeshBasicMaterial({ color:0xffffff });
    for(const s of ORBS){
      let dir, alt;
      if(s.sea){
        if(!window.OCEAN || !OCEAN.active) continue;
        const O = OCEAN, R = O.R, tn = O._plan ? O._plan().town : { x:-1, z:0 };
        const x = tn.x*R*s.sea[0] - tn.z*R*s.sea[1], z = tn.z*R*s.sea[0] + tn.x*R*s.sea[1];
        dir = O.toDir(x, z); alt = O.bedAt(x, z) + 1.6;
      } else {
        dir = ctx.dirOf(s[0], s[1]); alt = ctx.floorAt(dir) + 1.3;
      }
      const g = new THREE.Group();
      const c = new THREE.Mesh(geo, core); g.add(c);
      const h = new THREE.Mesh(geo, halo); h.scale.setScalar(1.9); g.add(h);
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.12), cross), bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), cross);
      bar1.position.z = bar2.position.z = 0.43; g.add(bar1, bar2);
      const up = dir.clone().normalize();
      g.position.copy(up).multiplyScalar(ctx.PR + alt);
      g.quaternion.setFromUnitVectors(V(0, 1, 0), up);
      group.add(g);
      orbs.push({ g, up, base:alt, back:0 });
    }
  }

  /* -------------------------------------------------------- the frame */
  const _p = V(), _m = new THREE.Matrix4(), _s = V();
  function tick(dt, me){
    if(!on || !me || !me.dir) return;
    t += dt;
    const pos = _p.copy(me.dir).normalize().multiplyScalar(ctx.PR + me.alt + 0.9);
    // breath: down while your head is under the sea, back up at the top
    if(me.under){
      breath = Math.max(0, breath - dt);
      if(breath <= 0){ drownT += dt; if(drownT >= 1){ drownT = 0; hurt(8, 'You ran out of air'); } }
    } else { breath = Math.min(BREATH, breath + dt * 6); drownT = 0; }
    // sharks bite what swims close
    biteCool = Math.max(0, biteCool - dt);
    if(me.inSea && biteCool <= 0 && window.SEALIFE && SEALIFE._kinds){
      for(const k of SEALIFE._kinds){
        if(k.id !== 'reefshark' && k.id !== 'hammerhead') continue;
        for(let i=0;i<k.mesh.count;i++){
          k.mesh.getMatrixAt(i, _m); _s.setFromMatrixPosition(_m);
          if(_s.distanceToSquared(pos) < (k.id === 'hammerhead' ? 3.2 : 2.4) ** 2){
            hurt(k.id === 'hammerhead' ? 22 : 15, k.id === 'hammerhead' ? 'A hammerhead bit you' : 'A reef shark bit you');
            biteCool = 1.6; break;
          }
        }
        if(biteCool > 0) break;
      }
    }
    // the orbs: bob, glow, and heal what passes through them
    for(const o of orbs){
      if(o.back > 0){ o.back -= dt; o.g.visible = o.back <= 0; continue; }
      const k = Math.sin(t*2 + o.base) * 0.15;
      o.g.position.copy(o.up).multiplyScalar(ctx.PR + o.base + k);
      o.g.rotateY(dt * 1.2);
      if(hp < MAX && o.g.position.distanceToSquared(pos) < 2.1 * 2.1){
        heal(ORB_HEAL); o.back = ORB_BACK; o.g.visible = false;
      }
    }
    if(Math.floor(t*4) !== Math.floor((t-dt)*4)) draw();
  }

  function build(c){
    clear();
    ctx = c; on = true; dead = false;
    group = new THREE.Group(); group.name = 'health-orbs'; c.group.add(group);
    buildOrbs();
    bars();
    const h = $('#health'); if(h) h.classList.remove('hidden');
    draw();
  }
  function clear(){
    on = false;
    if(group && group.parent) group.parent.remove(group);
    group = null; orbs = [];
    const h = $('#health'); if(h) h.classList.add('hidden');
    const b = $('#breath'); if(b) b.classList.add('hidden');
  }

  return { build, tick, landed, clear, hurt, heal,
           get hp(){ return hp; }, get breath(){ return breath; }, get active(){ return on; },
           get immortal(){ return immortal; }, set immortal(v){ immortal = !!v; }, MAX, BREATH };
})();
