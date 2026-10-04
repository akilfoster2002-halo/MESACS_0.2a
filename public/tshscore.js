/* =====================================================================
   TSH — THE SCORE. Everything Robin does on the shoes and the web is worth
   something, and the city is scattered with coins.

   THE CHAIN. A move starts it — a web, a release, a jump in time, a wall
   kick, a somersault off a roof — and every move after it, while she keeps
   off her feet, adds its points. The more DIFFERENT moves in it, the higher
   the multiplier (×1, and a quarter more for each new kind, up to ×5), and
   every second in the air is worth something too. Stand still on the
   ground for a moment and the chain is banked: points × multiplier, as XP.
   Come down in a heap (a swoop into the street) and it is lost.

   XP is kept between nights (its own storage, not the story's checkpoint,
   so going back to a checkpoint never takes it away), and it makes LEVELS:
   each one asks for a little more than the last.

   THE COINS are new every time you go out: a couple of hundred, spun gold,
   on the pavements, on roofs, and hanging in the air over the streets
   where a swing goes past them. Each is worth points in the chain and
   counts on the card. Nothing is bought with them; they are for getting.
   ===================================================================== */
window.TSHSCORE = (function(){
  const POINTS = {
    rope:25, ropeOff:60, releasePerfect:250, webJump:80,
    jump:20, rebound:100, reboundPerfect:220, pull:100, pullPerfect:250, dash:30,
    roll:120, landPerfect:80, coin:50, climb:80
  };
  const LABEL = {
    rope:'WEB', ropeOff:'RELEASE', releasePerfect:'PERFECT RELEASE', webJump:'WEB JUMP',
    jump:'JUMP', rebound:'WALL KICK', reboundPerfect:'PERFECT KICK', pull:'PULL-UP', pullPerfect:'PERFECT PULL',
    dash:'DASH', roll:'SOMERSAULT', landPerfect:'CLEAN LANDING', coin:'COIN', climb:'WALL CLIMB'
  };
  const AIR = 20;                 // points a second in the air, in a chain
  const BANK_AFTER = 0.8;         // s on her feet before a chain is banked
  const level = xp => Math.floor(Math.sqrt(xp/400)) + 1;
  const need = L => 400*(L - 1)*(L - 1);          // XP at which level L starts

  const store = {
    get(k){ try{ return +localStorage.getItem(k) || 0; }catch(e){ return 0; } },
    set(k, v){ try{ localStorage.setItem(k, String(v)); }catch(e){} }
  };
  let xp = store.get('tsh_xp'), coinsGot = store.get('tsh_coins');
  let chain = null, groundT = 0, el = null, on = false, audio = null;
  let coins = [], coinMesh = null, group = null;

  /* --------------------------------------------------------------- the card */
  function build(){
    if(el) return;
    el = document.createElement('div'); el.id = 'tshScore';
    el.innerHTML = `
      <div class="sc-card"><b class="sc-lv">LV 1</b><div class="sc-bar"><i></i></div><span class="sc-xp">0 XP</span><span class="sc-coin">🪙 0</span></div>
      <div class="sc-chain hidden"><div class="sc-head"><em class="sc-mult">×1.0</em><b class="sc-pts">0</b></div><ul></ul></div>
      <div class="sc-bank hidden"></div>`;
    document.body.appendChild(el);
  }
  function fmt(n){ return Math.round(n).toLocaleString(); }
  function paintCard(){
    if(!el) return;
    const L = level(xp), a = need(L), b = need(L + 1);
    el.querySelector('.sc-lv').textContent = 'LV ' + L;
    el.querySelector('.sc-bar i').style.width = Math.min(100, (xp - a)/(b - a)*100).toFixed(1) + '%';
    el.querySelector('.sc-xp').textContent = fmt(xp) + ' XP';
    el.querySelector('.sc-coin').textContent = '🪙 ' + coinsGot;
  }
  function paintChain(){
    if(!el) return;
    const c = el.querySelector('.sc-chain');
    if(!chain){ c.classList.add('hidden'); return; }
    c.classList.remove('hidden');
    el.querySelector('.sc-mult').textContent = '×' + mult().toFixed(2).replace(/0$/, '');
    el.querySelector('.sc-pts').textContent = fmt(chain.points);
    el.querySelector('.sc-chain ul').innerHTML = chain.items.slice(-5).reverse()
      .map((it, i)=>`<li style="opacity:${1 - i*0.17}">${it.label}${it.n > 1 ? ' ×' + it.n : ''} <small>+${fmt(it.pts)}</small></li>`).join('');
  }
  let bankT = null;
  function popup(html, cls){
    const b = el.querySelector('.sc-bank');
    b.className = 'sc-bank ' + (cls||''); b.innerHTML = html;
    void b.offsetWidth; b.classList.add('on');
    clearTimeout(bankT); bankT = setTimeout(()=>b.classList.add('hidden'), 2200);
  }

  /* -------------------------------------------------------------- the chain */
  const mult = () => chain ? Math.min(5, 1 + 0.25*(chain.kinds.size - 1)) : 1;
  function add(kind, label, pts){
    if(!chain) chain = { points:0, items:[], kinds:new Set(), air:0 };
    chain.points += pts; chain.kinds.add(kind);
    const last = chain.items[chain.items.length - 1];
    if(last && last.label === label){ last.n++; last.pts += pts; }
    else chain.items.push({ label, pts, n:1 });
    groundT = 0;
    paintChain();
  }
  function bank(){
    if(!chain) return;
    const total = Math.round(chain.points*mult()), before = level(xp);
    xp += total; store.set('tsh_xp', xp);
    popup(`<b>+${fmt(total)} XP</b><small>${fmt(chain.points)} × ${mult().toFixed(2).replace(/0$/, '')} · ${chain.items.reduce((n, i)=>n + i.n, 0)} moves</small>`, total >= 1000 ? 'big' : '');
    chain = null; paintChain(); paintCard();
    const after = level(xp);
    if(after > before){ setTimeout(()=>{ if(on) popup(`<b>LEVEL ${after}</b><small>keep moving</small>`, 'big level'); }, 1300); chime(true); }
  }
  function lose(){
    if(!chain) return;
    popup(`<b>BAILED</b><small>${fmt(chain.points)} lost</small>`, 'lost');
    chain = null; paintChain();
  }

  /* a move, as the shoes report it (boots.js events, through tsh.js) */
  function trick(e, b){
    if(!on) return;
    let n = e.name, pts = POINTS[n], label = LABEL[n];
    if(n === 'swoopCrash') return lose();
    if(n === 'jumpPerfect' || n === 'jump'){ n = 'jump'; const c = e.combo || 0; pts = POINTS.jump + c*60; label = c ? 'IN TIME ×' + (c + 1) : 'JUMP'; if(!c && !chain) return; }
    if(n === 'ropeOff' && (e.landed || e.wall)) return;
    if(n === 'roll' && (e.impact || 0) < 15) return;
    if(pts === undefined) return;
    add(n, label, pts);
  }

  /* ------------------------------------------------------------- the coins */
  function scatter(W){
    coins = [];
    const N = window.TSHNYC, rnd = (a, b) => a + Math.random()*(b - a);
    const clear = (x, y, z) => !(N && N.solidAt(x, y, z, 0.8)) && !W.solids.some(s=>!s.off && x > s.x1 - 0.8 && x < s.x2 + 0.8 && z > s.z1 - 0.8 && z < s.z2 + 0.8 && y < s.y2 + 0.8 && y > (s.y1 === undefined ? -1 : s.y1) - 0.8);
    const ground = (x, z) => (Math.abs(x) < 112 && Math.abs(z) < 87) || (N && N.landAt(x, z));
    let tries = 0;
    // the pavements and the air over them: most of them within a few hundred metres of the district
    while(coins.length < 170 && tries++ < 6000){
      const a = Math.random()*Math.PI*2, r = Math.pow(Math.random(), 0.7)*650, x = Math.cos(a)*r, z = Math.sin(a)*r;
      if(!ground(x, z)) continue;
      const y = coins.length % 3 === 0 ? rnd(12, 38) : 1.3;              // a third of them where a swing goes
      if(!clear(x, y, z)) continue;
      coins.push({ x, y, z, got:false, spin:Math.random()*6 });
    }
    // the roofs: the district's and Manhattan's
    const roofs = W.roofs.map(r=>({ x1:r.x1, x2:r.x2, z1:r.z1, z2:r.z2, top:r.h }))
      .concat(N ? N.boxes.filter(b=>b.p && b.p.top > 6 && b.p.top < 160 && (b.p.x2 - b.p.x1)*(b.p.z2 - b.p.z1) > 40).map(b=>b.p) : []);
    for(let i=0; i<55 && roofs.length; i++){
      const r = roofs[Math.floor(Math.random()*roofs.length)];
      const x = rnd(r.x1 + 1, r.x2 - 1), z = rnd(r.z1 + 1, r.z2 - 1), y = r.top + 1.3;
      if(Math.hypot(x, z) > 900 || !clear(x, y, z)) continue;
      coins.push({ x, y, z, got:false, spin:Math.random()*6 });
    }
    // drawn as one mesh: a gold disc that spins, bright enough for the bloom to take
    if(coinMesh){ coinMesh.parent && coinMesh.parent.remove(coinMesh); coinMesh.geometry.dispose(); coinMesh.material.dispose(); }
    const g = new THREE.CylinderGeometry(0.55, 0.55, 0.1, 22); g.rotateX(Math.PI/2);
    const m = new THREE.MeshStandardMaterial({ color:0xffc83a, emissive:0xff9a00, emissiveIntensity:1.8, metalness:0.6, roughness:0.3 });
    coinMesh = new THREE.InstancedMesh(g, m, coins.length); coinMesh.frustumCulled = false;
    group.add(coinMesh);
    placeCoins(0);
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function placeCoins(t){
    if(!coinMesh) return;
    for(let i=0;i<coins.length;i++){
      const c = coins[i];
      if(c.got){ _m.makeScale(0, 0, 0); coinMesh.setMatrixAt(i, _m); continue; }
      _q.setFromAxisAngle(_up, t*2.6 + c.spin);
      _p.set(c.x, c.y + Math.sin(t*2 + c.spin)*0.15, c.z); _s.set(1, 1, 1);
      coinMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    coinMesh.instanceMatrix.needsUpdate = true;
  }
  function chime(big){
    const a = audio && audio(); if(!a) return;
    try{
      if(a.state === 'suspended') a.resume();
      const t = a.currentTime;
      (big ? [988, 1319, 1568, 1976] : [1319, 1976]).forEach((f, i)=>{
        const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i*0.07); g.gain.exponentialRampToValueAtTime(0.09, t + i*0.07 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i*0.07 + 0.35);
        o.connect(g); g.connect(a.destination); o.start(t + i*0.07); o.stop(t + i*0.07 + 0.4);
      });
    }catch(e){}
  }

  /* ---------------------------------------------------------------- per frame */
  function tick(dt, t, b, live){
    if(!on) return;
    placeCoins(t);
    if(!b || !live) return;
    // a coin within reach of her middle
    const cx = b.x, cy = b.y + 1.0, cz = b.z;
    for(const c of coins){
      if(c.got) continue;
      const dx = c.x - cx, dy = c.y - cy, dz = c.z - cz;
      if(dx*dx + dy*dy + dz*dz < 2.4*2.4){ c.got = true; coinsGot++; store.set('tsh_coins', coinsGot); add('coin', '🪙 COIN', POINTS.coin); chime(false); paintCard(); }
    }
    // the chain: the air is worth something; the ground, for long enough, banks it
    if(chain){
      if(!b.ground){ chain.air += dt; const before = Math.floor(chain.points); chain.points += AIR*dt; if(Math.floor(chain.points/50) !== Math.floor(before/50)) paintChain(); groundT = 0; }
      else if(b.roll <= 0 && !b.charge){ groundT += dt; if(groundT >= BANK_AFTER) bank(); }
    }
  }
  /* coins near a point, for the radar */
  function near(x, z, r){ return coins.filter(c=>!c.got && Math.abs(c.x - x) < r && Math.abs(c.z - z) < r); }

  function attach(root, W, o){
    build(); on = true; audio = (o && o.audio) || null;
    el.classList.remove('hidden');
    group = new THREE.Group(); group.name = 'coins'; root.add(group);
    chain = null; paintCard(); paintChain();
    // Manhattan arrives after the district: scatter once it is there (or straight away if it never comes)
    const go = ()=>{ if(on && group) scatter(W); };
    if(window.TSHNYC && TSHNYC.loading) TSHNYC.loading.then(go, go); else go();
  }
  function detach(){
    on = false; if(chain) bank();
    if(el) el.classList.add('hidden');
    if(coinMesh){ coinMesh.geometry.dispose(); coinMesh.material.dispose(); coinMesh = null; }
    if(group && group.parent) group.parent.remove(group);
    group = null; coins = [];
  }
  function show(v){ if(el) el.classList.toggle('hidden', !v || !on); }

  return { attach, detach, trick, tick, near, show, POINTS, level,
           get xp(){ return xp; }, get coins(){ return coinsGot; }, get chain(){ return chain; }, get left(){ return coins.filter(c=>!c.got).length; } };
})();
