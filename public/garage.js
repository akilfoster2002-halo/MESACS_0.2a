/* =====================================================================
   THE MECHANIC — the browser's copy of the Godot garage (koro-godot
   building.gd `_garage_model` and friends, kit.gd, talk.gd), so the two
   games have the same shop.

   THE GARAGE IS ONE MODEL (mechanic/garage.glb, built in Higgsfield's 3D
   Jutsu to a reference photo): brick and steel walls, a sawtooth roof,
   trusses and ducts, the mezzanine office, shelving, lockers, pegboards,
   cage lamps and KIT'S GARAGE in neon. It brings its own walls, the way
   Mission Control's temple does, so planet.js skips its box for this
   building. The model's boxes have no UVs: Godot projects its textures
   from the world's axes, and here each triangle is given UVs from its own
   position the same way (boxUV), at the same real-world sizes.

   Then the same furniture: Higgsfield tool chests, a workbench and two
   car lifts, the three posters, and the two mechas on plinths along the
   back wall — VANGUARD and SERAPH, 3,000 coins each. Buy one and X turns
   you into it anywhere outdoors (planet.js).

   AND KIT, the mechanic, at work: she walks a round of jobs — the first
   car, the two mecha plinths, the bench, the tool chests, the third car,
   the lockers — stopping at each to work, with sparks off her hand where
   there is metal. Come close and she turns to you; E talks to her for
   real (server/npc.js, the same guarded conversation Godot has).
   ===================================================================== */
window.GARAGE = (function(){
  const V = (x,y,z)=>new THREE.Vector3(x,y,z);
  const $ = s=>document.querySelector(s);
  const MECHS = [
    { id:'vanguard', name:'Vanguard', price:3000, file:'wano/mecha.glb' },
    { id:'seraph',   name:'Seraph',   price:3000, file:'wano/seraph.glb' }
  ];
  let loader = null;
  function L(){
    if(!loader){ loader = new THREE.GLTFLoader();
      if(window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder); }
    return loader;
  }
  const url = f => f + '?v=' + (window.ASSETV || '1');
  const texCache = {};
  function tex(name){
    if(!texCache[name]){
      const t = new THREE.TextureLoader().load(url('mechanic/'+name+'.jpg'));
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      texCache[name] = t;
    }
    return texCache[name];
  }
  /* by material name: [texture, metres per tile, tint] — Godot's SURFACES */
  const SURFACES = {
    Concrete_Polished: ['concrete', 6.0, 0x9999a3],
    Brick_Red:         ['brick',    2.4, 0xffffff],
    Steel_Panel_Blue:  ['cladding', 3.0, 0xffffff],
    Steel_Dark:        ['steel',    2.0, 0xffffff],
    Roof_Metal:        ['roofing',  4.0, 0xe6e6f2],
    Shelf_Steel:       ['steel',    1.5, 0xffffff],
    Office_Wall:       ['cladding', 2.0, 0xffe0c0]
  };

  let b = null, g = null, hw = 0, hd = 0, kit = null, mechBays = [], talkOpen = false;

  /* UVs from position, per triangle, on the face's dominant axis — what a
     world-triplanar material does, baked once. */
  function boxUV(geo, size, M){
    geo = geo.index ? geo.toNonIndexed() : geo;
    const P = geo.attributes.position, n = P.count, uv = new Float32Array(n*2);
    const a = V(0,0,0), bb = V(0,0,0), c = V(0,0,0), nrm = V(0,0,0), e1 = V(0,0,0), e2 = V(0,0,0);
    for(let i=0;i<n;i+=3){
      a.fromBufferAttribute(P,i).applyMatrix4(M); bb.fromBufferAttribute(P,i+1).applyMatrix4(M); c.fromBufferAttribute(P,i+2).applyMatrix4(M);
      nrm.crossVectors(e1.subVectors(bb,a), e2.subVectors(c,a));
      const ax = Math.abs(nrm.x), ay = Math.abs(nrm.y), az = Math.abs(nrm.z);
      [a,bb,c].forEach((p,k)=>{
        let u, v;
        if(ay >= ax && ay >= az){ u = p.x; v = p.z; } else if(ax >= az){ u = p.z; v = p.y; } else { u = p.x; v = p.y; }
        uv[(i+k)*2] = u/size; uv[(i+k)*2+1] = v/size;
      });
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geo;
  }

  function solid(x, z, w, d, y1, y2){
    b.solids.push({ x1:x-w/2, x2:x+w/2, z1:z-d/2, z2:z+d/2, y1:y1||0, y2:y2===undefined ? 10 : y2 });
  }

  /* ================================================================ build */
  function build(bld, grp, tools){
    b = bld; g = grp; hw = b.w/2; hd = b.d/2; kit = null; mechBays = [];
    const mine = g;
    L().load(url('mechanic/garage.glb'), gl=>{
      if(g !== mine) return;
      const root = gl.scene;
      root.updateMatrixWorld(true);
      root.traverse(o=>{
        if(!o.isMesh) return;
        const src = Array.isArray(o.material) ? o.material[0] : o.material;
        const spec = src && SURFACES[src.name];
        if(spec){
          o.geometry = boxUV(o.geometry, spec[1], o.matrixWorld);
          o.material = new THREE.MeshLambertMaterial({ map:tex(spec[0]), color:spec[2] });
        } else if(src){
          const glow = src.emissive && (src.emissive.r+src.emissive.g+src.emissive.b) > 0.1;
          o.material = new THREE.MeshLambertMaterial({ color:src.color || 0xffffff, map:src.map || null,
            emissive: glow ? src.emissive : 0x000000, emissiveIntensity: glow ? 0.6 : 0 });
        }
        o.userData.flat = true;
      });
      root.position.y = 0.03;
      g.add(root);
    });
    solids();
    lights();
    posters();
    props();
    mechs(tools);
    loadKit();
  }

  /* What you bump into: the walls, the doorway, the office and its stairs
     (you cannot climb to it in the browser yet, so it is one block), the
     lockers, racks, barrels and crates — Godot's _garage_solid. */
  function solids(){
    solid(0, -hd+0.25, b.w, 0.5); solid(-hw+0.25, 0, 0.5, b.d); solid(hw-0.25, 0, 0.5, b.d);
    const side = (b.w-9)/2;
    [-1,1].forEach(sx=>solid(sx*(4.5+side/2), hd-0.25, side, 0.5));
    solid(0, hd-0.25, 9, 0.5, 9, 10);
    solid(-12.75, -10.75, 13.5, 5.5, 0, 7.2);          // the office block and the deck
    solid(-18.45, -5.0, 2.0, 6.0, 0, 4.2);             // the stairs up to it
    solid(-19.2, 9.6, 0.6, 4.9, 0, 2); solid(-13.9, -13.1, 10.4, 0.8, 0, 2.8); solid(19.05, -10.5, 0.6, 2.9, 0, 1.9);
    [[-16.6,12.9],[17.6,12.2],[17.4,-5.8],[-15.2,-1.2]].forEach(p=>solid(p[0], p[1], 2.64, 2.64, 0, 1.2));
    [[13.3,12.4],[-11.5,12.6],[17.3,4.2]].forEach(p=>solid(p[0], p[1], 2.1, 1.2, 0, 1.6));
  }

  /* The model's lamps are drawn; these light the room (Godot's
     _garage_lights: warm spots in rows, a lamp over each bay, the office
     glow and the neon's orange). */
  /* FOUR LIGHTS, not Godot's fifteen. Every light in a three.js scene is
     paid for by every lit surface in the whole world, garage or not, so
     the warm rows of spots become three broad lamps down the hall and one
     orange throw off the neon. */
  function lights(){
    [-8, 1.5, 10].forEach(z=>{ const l = new THREE.PointLight(0xffd4a0, 260, 30, 1.2); l.position.set(0, 8.5, z); g.add(l); });
    const neon = new THREE.PointLight(0xff7a2a, 70, 12, 1.5); neon.position.set(9.75, 7.2, -12); g.add(neon);
  }

  function posters(){
    [[1, hw-0.56, 4.6, 11.4, -Math.PI/2], [2, -hw+0.56, 4.6, 3.8, Math.PI/2], [3, -2.8, 5.2, -hd+0.56, 0]].forEach(p=>{
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.8),
        new THREE.MeshLambertMaterial({ map:new THREE.TextureLoader().load(url('mechanic/poster'+p[0]+'.jpg'), t=>{ t.colorSpace = THREE.SRGBColorSpace; }) }));
      m.position.set(p[1], p[2], p[3]); m.rotation.y = p[4]; g.add(m);
    });
  }

  /* Loaded, stood on the floor at a given height, turned in a holder —
     Godot's Models.fit_height. */
  function fit(file, height, x, z, rot, then){
    const mine = g;
    L().load(url(file), gl=>{
      if(g !== mine) return;
      const m = gl.scene;
      const box = new THREE.Box3().setFromObject(m), size = box.getSize(V(0,0,0)), c = box.getCenter(V(0,0,0));
      const s = height/Math.max(0.001, size.y);
      const holder = new THREE.Group(); holder.position.set(x, 0, z); holder.rotation.y = rot;
      m.scale.setScalar(s); m.position.set(-c.x*s, -box.min.y*s, -c.z*s);
      holder.add(m); g.add(holder);
      if(then) then(gl, holder, m);
    });
  }
  function props(){
    [['chest',1.5,hw-1.3,8.3,-Math.PI/2],['chest',1.5,hw-1.3,9.9,-Math.PI/2],['chest',1.5,2.2,-hd+1.2,0],
     ['bench',1.9,hw-1.6,-3,-Math.PI/2],
     ['lift',4.8,-2,-7,Math.PI/2],['lift',4.8,-2,5.8,Math.PI/2]].forEach(p=>fit('mechanic/'+p[0]+'.glb', p[1], p[2], p[3], p[4]));
  }

  /* ============================================================== mechas */
  const mechX = i => hw*0.3 + i*7.5;
  const owns = id => !!(window.WALLET && WALLET.has('mech_'+id));
  function chosen(){
    const id = window.PROGRESS && PROGRESS.get('w_mech', null);
    if(id && owns(id)) return id;
    const any = MECHS.find(m=>owns(m.id));
    return any ? any.id : null;
  }
  function mechs(tools){
    MECHS.forEach((m, i)=>{
      const x = mechX(i), z = -hd+3.2;
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.6, 32), new THREE.MeshLambertMaterial({ color:0x3f4a63 }));
      deck.position.set(x, 0.3, z); g.add(deck);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.06, 8, 48), new THREE.MeshBasicMaterial({ color:0xffd766 }));
      ring.rotation.x = Math.PI/2; ring.position.set(x, 0.63, z); g.add(ring);
      solid(x, z, 5.2, 5.2, 0, 0.6);
      fit(m.file, 7, x, z, 0, (gl, holder, model)=>{
        holder.position.y = 0.62;
        if(gl.animations && gl.animations.length){
          const mix = new THREE.AnimationMixer(model);
          const idle = gl.animations.find(a=>/idle/i.test(a.name)) || gl.animations[0];
          mix.clipAction(idle).play();
          mechBays.push({ mix });
        }
      });
      const p = tools.panel(g, b, x, z+4.4, '\u{1F916}', label(m), 'buymech:'+m.id, '#4a3a12', 0.62, 0);
      m.panel = p; m.tools = tools;
    });
  }
  function label(m){
    const t_ = window.t || (s=>s);
    const line = chosen()===m.id ? t_('IN USE — X') : owns(m.id) ? t_('OWNED — E to use') : m.price.toLocaleString()+' ◆';
    return t_(m.name.toUpperCase())+'\n'+line;
  }
  function repaint(){
    MECHS.forEach(m=>{ if(m.panel && m.tools && m.tools.repaint) m.tools.repaint(m.panel, '\u{1F916}', label(m), chosen()===m.id ? '#1d4030' : owns(m.id) ? '#22406b' : '#4a3a12'); });
  }
  /* E at a plinth: buy it, or pick it as the one X turns you into. */
  function buyMech(id, say){
    const m = MECHS.find(k=>k.id===id);
    if(!m || !window.WALLET) return;
    const t_ = window.t || (s=>s);
    if(owns(id)){
      if(window.PROGRESS) PROGRESS.set('w_mech', id);
      say(t_('🤖 {n} is yours. Press <b>X</b> anywhere outdoors to become it.',{ n:m.name }));
    } else if(!WALLET.spend(m.price)){
      say(t_('The {n} is {p} coins — you have {c}. Missions, flying and the arcade all pay.',{ n:m.name, p:m.price.toLocaleString(), c:WALLET.coins() }));
      return;
    } else {
      WALLET.give('mech_'+id);
      if(window.PROGRESS) PROGRESS.set('w_mech', id);
      if(window.beep) beep('win');
      say(t_('🤖 Bought the {n}! Press <b>X</b> anywhere outdoors to become it; X or R to step out.',{ n:m.name }));
    }
    repaint();
  }

  /* ================================================================= kit */
  const JOBS = [
    [-2.0, -4.3, Math.PI, true], [null, 'm0', Math.PI, true], [null, 'm1', Math.PI, true],
    [16.6, -3.0, Math.PI/2, false], [14.5, 3.5, 0, false, true], [16.9, 9.1, Math.PI/2, false],
    [2.4, 5.8, -Math.PI/2, true], [2.4, 9.0, 0, false, true], [-7.0, 9.0, 0, false, true],
    [-17.8, 9.4, -Math.PI/2, false], [-9.5, 2.6, 0, false, true], [-6.0, -3.4, 0, false, true]
  ];
  const jobAt = j => j[0]===null ? V(mechX(j[1]==='m0'?0:1), 0, -hd+6.9) : V(j[0], 0, j[1]);
  function loadKit(){
    fit('mechanic/kit.glb', 1.68, -2, -4.3, Math.PI, (gl, holder, model)=>{
      const mix = new THREE.AnimationMixer(model), acts = {};
      gl.animations.forEach(a=>{ acts[a.name.toLowerCase()] = mix.clipAction(a); });
      let hand = null;
      model.traverse(o=>{ if(o.isBone && /RightHand$/.test(o.name)) hand = o; });
      const hit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.9, 1.2), new THREE.MeshBasicMaterial({ visible:false }));
      hit.position.y = 0.95; holder.add(hit);
      holder.userData = { kind:'npc', label:'Kit — the Mechanic', enter:'kit', verb:'E — talk to Kit' };
      hit.userData.owner = holder; G.hits.push(hit);
      const sparks = [];
      for(let i=0;i<40;i++){
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), new THREE.MeshBasicMaterial({ color:0xffc060 }));
        s.visible = false; g.add(s); sparks.push({ m:s, v:V(0,0,0), life:0 });
      }
      kit = { holder, mix, acts, cur:null, job:0, work:4, heading:Math.PI, hand, sparks };
      play('idle');
    });
  }
  function play(name){
    if(!kit) return;
    const a = kit.acts[name] || kit.acts.idle;
    if(!a || kit.cur===a) return;
    a.reset().play(); if(kit.cur) kit.cur.crossFadeTo(a, 0.3, false); kit.cur = a;
  }
  const lerpAng = (a, b2, k)=>{ let d = b2-a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d*k; };
  function meLocal(){
    if(!window.PLANET || !PLANET.where || !g) return null;
    const me = PLANET.where;
    if(!me.dir) return null;
    return g.worldToLocal(me.dir.clone().multiplyScalar(PLANET.PR + me.alt));
  }
  function tick(dt){
    mechBays.forEach(m=>m.mix.update(dt));
    if(!kit || !g || !g.parent) return;
    const k = kit, h = k.holder;
    const me = meLocal();
    const to = me ? V(me.x-h.position.x, 0, me.z-h.position.z) : null;
    let clip = 'idle', welding = false;
    if(talkOpen || (to && to.length() < 3.2 && Math.abs(me.y) < 3)){
      if(to) k.heading = lerpAng(k.heading, Math.atan2(to.x, to.z), Math.min(1, dt*5));
      clip = talkOpen ? 'talk' : 'idle';
    } else if(k.work > 0){
      const j = JOBS[k.job];
      k.work -= dt; k.heading = lerpAng(k.heading, j[2], Math.min(1, dt*4));
      clip = 'talk2'; welding = j[3];
      if(k.work <= 0) k.job = (k.job+1) % JOBS.length;
    } else {
      const j = JOBS[k.job], goal = jobAt(j), d = goal.clone().sub(h.position); d.y = 0;
      if(d.length() < 0.15){ if(j[4]) k.job = (k.job+1) % JOBS.length; else k.work = 7 + Math.random()*5; }
      else { k.heading = lerpAng(k.heading, Math.atan2(d.x, d.z), Math.min(1, dt*6));
             h.position.addScaledVector(d.normalize(), Math.min(d.length(), 1.25*dt)); clip = 'walk'; }
    }
    h.rotation.y = k.heading;
    play(clip);
    k.mix.update(dt);
    // sparks off her hand, in bursts, while she welds
    const burst = welding && (performance.now()/1000 % 1.6) < 0.9;
    const from = V(0,0,0);
    if(k.hand){ k.hand.getWorldPosition(from); g.worldToLocal(from); } else from.copy(h.position).setY(1.2);
    k.sparks.forEach(s=>{
      if(s.life > 0){ s.life -= dt; s.v.y -= 9.8*dt; s.m.position.addScaledVector(s.v, dt); s.m.visible = s.life > 0; }
      else if(burst && Math.random() < dt*60){ s.life = 0.55; s.m.position.copy(from);
        s.v.set((Math.random()-0.5)*3, 1.5+Math.random()*2.5, (Math.random()-0.5)*3); s.m.visible = true; }
    });
  }
  /* Near enough to talk, for the E key when the crosshair is not on her. */
  function near(){
    if(!kit || !g || !g.parent) return false;
    const me = meLocal();
    return !!me && Math.hypot(me.x-kit.holder.position.x, me.z-kit.holder.position.z) < 3 && Math.abs(me.y) < 3;
  }

  /* ================================================================ talk
     A panel, like Godot's talk.gd: her line, your line, a box to type in.
     What she is told about you is true — your coins, level, what you own —
     so she can say how far you are from a Seraph. */
  let panelEl = null, said = [], busy = false;
  function context(){
    const S = window.SHOP;
    return { coins: window.WALLET ? WALLET.coins() : 0, level: window.WALLET ? WALLET.level() : 1,
      cars: S && S.CARS ? S.CARS.map(c=>({ name:c.name, price:c.price, owned:S.ownsCar(c) })) : [],
      mechas: MECHS.map(m=>({ name:m.name, price:m.price, owned:owns(m.id) })),
      world: 'Wano' };
  }
  function ui(){
    if(panelEl) return panelEl;
    panelEl = document.createElement('div');
    panelEl.id = 'talkBox';
    panelEl.innerHTML = '<div class="tb-head"><b>KIT</b><span>the Mechanic</span><button class="tb-x" aria-label="close">✕</button></div>'
      + '<div class="tb-log"></div><form class="tb-row"><input maxlength="300" placeholder="Ask Kit about cars, mechas, machines…"><button>Send</button></form>';
    document.body.appendChild(panelEl);
    panelEl.querySelector('.tb-x').onclick = close;
    panelEl.querySelector('form').onsubmit = e=>{ e.preventDefault(); send(); };
    panelEl.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.preventDefault(); close(); } e.stopPropagation(); });
    return panelEl;
  }
  function paint(){
    const log = panelEl.querySelector('.tb-log');
    log.innerHTML = '';
    said.forEach(m=>{ const d = document.createElement('div'); d.className = 'tb-'+m.role; d.textContent = m.text; log.appendChild(d); });
    if(busy){ const d = document.createElement('div'); d.className = 'tb-wait'; d.textContent = 'Kit is thinking…'; log.appendChild(d); }
    log.scrollTop = log.scrollHeight;
  }
  function talk(){
    ui(); talkOpen = true;
    if(!said.length) said.push({ role:'npc', text:'Mind the oil. Cars down the bays, mechas at the back, the ship’s in the hangar. What do you need?' });
    panelEl.classList.add('on'); paint();
    if(document.pointerLockElement) document.exitPointerLock();
    setTimeout(()=>panelEl.querySelector('input').focus(), 30);
  }
  function close(){
    if(!panelEl) return;
    talkOpen = false; panelEl.classList.remove('on');
    if(window.lockPointer) lockPointer($('#view'));
  }
  async function send(){
    const input = panelEl.querySelector('input'), text = input.value.trim();
    if(!text || busy) return;
    input.value = '';
    const hist = said.slice(-10);
    said.push({ role:'me', text }); busy = true; paint();
    let answer;
    try{
      const r = await fetch('/api/npc', { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ npc:'mechanic', text, history:hist, context:context() }) });
      const j = await r.json();
      answer = j && j.ok ? String(j.text||'') : '('+String((j && j.error) || 'No answer.')+')';
    }catch(e){ answer = '(She did not hear you — try again.)'; }
    busy = false; said.push({ role:'npc', text:answer }); paint();
    input.focus();
  }

  return { build, tick, buyMech, near, talk, close, chosen, owns, MECHS, repaint,
           get talking(){ return talkOpen; } };
})();
