/* =====================================================================
   CHARS — who you are, on two surfaces.

   THE MALL is the shop: the whole roster, the ships, the coins you have
   and what they buy. You walk to it, and it takes the screen.

   THE QUICK CHANGE is a strip along the bottom of the game, opened with a
   key, and it does exactly one thing — swap who you are, without going
   anywhere. Walking across a planet to a building to change your shirt is
   fine the first time and a chore every time after, and the character you
   are is the one thing in this game a child fiddles with constantly.

   Both show the characters ALIVE — standing in their idle, not a still
   PNG and not the rest pose. A T-posed thumbnail reads as a model that
   has not finished loading, and a still one tells you nothing about who
   you are about to be.
   ===================================================================== */
window.CHARS = (function(){
  const FREE = 3;                       // all of them, from the first minute
  const PER_MISSION = 0;                // the rest stay shut: set this above zero to
                                        // start handing them out per finished mission

  let view=null, previewing=null, raf=0, last=0;
  let hero=null, heroRaf=0, heroLast=0;

  function unlockedCount(){
    let done=0;
    try{ ['nav','m1','m2','m3'].forEach(id=>{ if(PROGRESS.isDone(id)) done++; }); }catch(e){}
    return Math.min(AVATAR.CHARS.length, FREE + done*PER_MISSION);
  }
  function isUnlocked(i){ return i < unlockedCount(); }

  /* ---------------------------------------------- the little turntable */
  function stage(){
    if(view) return view;
    const canvas=document.querySelector('#charView');
    if(!canvas) return null;
    const renderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));
    const scene=new THREE.Scene();
    // framed so a 1.85-tall character just fills the panel with a little air
    const camera=new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(0, 0.12, 3.7);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc3b4e6, 1.5));
    const key=new THREE.DirectionalLight(0xfff3f8, 1.5); key.position.set(3,6,5);
    const rim=new THREE.DirectionalLight(0x9fb4ff, 0.8);  rim.position.set(-4,3,-4);
    scene.add(key, rim);
    const turntable=new THREE.Group(); scene.add(turntable);
    view={renderer, scene, camera, turntable, current:null};
    return view;
  }
  function size(){
    if(!view) return;
    const c=view.renderer.domElement;
    const w=c.clientWidth||360, h=c.clientHeight||240;
    view.renderer.setSize(w,h,false);
    view.camera.aspect=w/h; view.camera.updateProjectionMatrix();
  }

  async function preview(id){
    const v=stage(); if(!v) return;
    previewing=id;
    let m;
    try{ m=await AVATAR.load(id); }catch(e){ return; }
    if(previewing!==id) return;                 // they moved on while it loaded
    if(v.current) v.turntable.remove(v.current);
    m.position.y=-0.92;                         // stand them on the middle of the frame
    v.turntable.add(m); v.current=m;
    AVATAR.animate(m, 0, 'idle');
    label(id);
  }
  /* which tile wears the tick */
  function mark(id){
    document.querySelectorAll('#charGrid .chrtile').forEach(x=>{
      const on=x.dataset.c===id;
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', on?'true':'false');
    });
  }
  /* the name under the turntable: whose it is, and whether they are yours yet */
  function label(id){
    const nm=document.querySelector('#charName'); if(!nm) return;
    const def=AVATAR.CHARS.find(c=>c.id===id);
    const mine=id===AVATAR.chosen;
    nm.classList.toggle('sel', mine);
    nm.innerHTML = def
      ? `${t(def.name)}<span class="tag">${mine?t('✓ YOUR CHARACTER'):t('click to choose')}</span>`
      : '';
  }
  function loop(now){
    raf=requestAnimationFrame(loop);
    const dt=Math.min((now-last)/1000, 0.05); last=now;
    if(!view) return;
    size();
    view.turntable.rotation.y += dt*0.55;        // slow spin, so you see all of them
    if(view.current) AVATAR.animate(view.current, dt, 'idle');
    view.renderer.render(view.scene, view.camera);
  }
  function play(){ if(!raf){ last=performance.now(); raf=requestAnimationFrame(loop); } }
  function stop(){ if(raf){ cancelAnimationFrame(raf); raf=0; } }

  /* --------------------------------------------------------- the grid */
  function render(){
    const grid=document.querySelector('#charGrid'); if(!grid) return;
    const open=unlockedCount();
    document.querySelector('#cTitle').textContent=t('THE MALL');
    // no promise of more until there is a way to earn them
    document.querySelector('#cHint').textContent =
      t('Change who you are, and spend what you earned. Coins come from missions.');
    document.querySelector('#cGo').textContent=t('Back to the planet ▶');
    purse(); shelves();

    /* The roster is a shop shelf now. The ??? tiles used to be locked with
       no way on earth to earn them, which is a promise the game never kept —
       they have a price on them instead. */
    const items=window.SHOP ? SHOP.charItems() : [];
    grid.innerHTML=AVATAR.CHARS.map((c,i)=>{
      const it=items[i];
      const owned=!it || SHOP.ownsChar(it);
      const on=c.id===AVATAR.chosen;
      const afford=!it || WALLET.coins()>=it.price;
      return `<button class="chrtile${on?' on':''}${owned?'':' buy'}${owned||afford?'':' poor'}"
        data-c="${c.id}" data-buy="${owned?'':it.id}" data-price="${it?it.price:0}"
        aria-pressed="${on?'true':'false'}"
        title="${owned?c.name:t('{n} coins',{n:it.price})}">
        <img src="${c.preview}" alt="" loading="lazy">
        <span class="chrname">${c.name}</span>
        ${owned?'':`<span class="chrprice">${it.price}¤</span>`}</button>`;
    }).join('');

    grid.querySelectorAll('[data-c]').forEach(b=>{
      // looking at one is enough to bring it to life; clicking makes it yours
      b.onmouseenter=()=>preview(b.dataset.c);
      b.onfocus=()=>preview(b.dataset.c);
      b.onclick=()=>{
        const id=b.dataset.c;
        // not yours yet: this click is a purchase, not a change of clothes
        if(b.dataset.buy){
          const r=SHOP.buy(b.dataset.buy, +b.dataset.price);
          if(r==='poor'){ shortfall(+b.dataset.price); return; }
          render();
          if(window.beep) beep('star');
          return;
        }
        AVATAR.pick(id);
        // pick() saves progress, which re-renders this grid out from under us —
        // so mark by id, not by node, or we clear the tile we just lit up
        mark(id);
        label(id);                     // the tick and the name agree straight away
        preview(id);
        if(window.beep) beep('pop');
      };
    });
    preview(AVATAR.chosen);
  }

  /* say how short you are rather than doing nothing, which reads as broken */
  function shortfall(price){
    const el=document.querySelector('#cHint');
    if(!el) return;
    el.textContent=t('That costs {n} and you have {h}. Finish a mission for more.',
                     {n:price, h:WALLET.coins()});
    el.classList.add('warn');
    clearTimeout(shortfall._t);
    shortfall._t=setTimeout(()=>{ el.classList.remove('warn'); render(); }, 2600);
    if(window.beep) beep('bad');
  }
  /* coins, level and the bar towards the next one, over the roster */
  function purse(){
    const el=document.querySelector('#cPurse'); if(!el || !window.WALLET) return;
    const p=WALLET.progress();
    el.innerHTML=`<span class="pz-lv">${t('Level')} <b>${p.level}</b></span>
      <span class="pz-bar"><i style="width:${Math.round(100*p.into/p.span)}%"></i></span>
      <span class="pz-xp">${p.into} / ${p.span} ${t('XP')}</span>
      <span class="pz-co">¤ <b>${WALLET.coins()}</b></span>`;
  }
  /* ---------------------------------------------------------- the shelves
     Ships sit under the roster. CARS DO NOT, any more: the Mechanic sells
     those now, out of a room with the actual vehicles standing in it, and two
     places selling the same car is one place too many — the second one is
     where a child learns that the shop they walked to was pointless.

     A ship is not worn either, but it stays here for now because the thing
     you fly is chosen next to the person who flies it. */
  function shelves(){
    const el=document.querySelector('#cShop'); if(!el || !window.SHOP) return;
    /* A ship is flown, not worn. The tag says what you would actually be
       doing with it, and what one more click does. */
    const card=(o)=>`<button class="shopit${o.on?' on':''}${o.owned?'':' buy'}"
        data-shop="${o.id}" data-price="${o.price}" style="--a:${o.a}">
        <span class="si-swatch"></span>
        <b>${t(o.name)}</b><small>${t(o.blurb||'')}</small>
        <span class="si-tag">${o.owned ? (o.on?t(o.onWord):t(o.offWord)) : o.price+'¤'}</span>
      </button>`;
    const ships=SHOP.SHIPS.map(sh=>card({ id:sh.id, name:sh.name, blurb:sh.blurb,
      price:sh.price, owned:SHOP.ownsShip(sh), on:SHOP.ship().id===sh.id,
      onWord:'FLYING', offWord:'TAP TO FLY',
      a:'#'+sh.hull.toString(16).padStart(6,'0') })).join('');
    el.innerHTML=
      `<div class="shelf"><h4>🚀 ${t('SHIPS')} <small>${t('what you fly in Space Explorer')}</small></h4>
         <div class="shelfrow">${ships}</div></div>
       <div class="shelf ghost"><h4>🏎 ${t('CARS')}
         <small>${t('at the Mechanic, on the planet')}</small></h4></div>`;
    el.querySelectorAll('[data-shop]').forEach(b=>{
      b.onclick=()=>{
        const id=b.dataset.shop, price=+b.dataset.price;
        const owned = SHOP.ownsShip(SHOP.shipById(id));
        if(!owned){
          const r=SHOP.buy(id, price);
          if(r==='poor') return shortfall(price);
          if(window.beep) beep('star');
        } else if(window.beep) beep('pop');
        SHOP.equip(id);
        render();
      };
    });
  }
  /* ------------------------------------------------- driving it by keyboard

     You arrive here from a planet that has your mouse locked, so reaching
     this screen used to mean pressing Escape before you could click
     anything — a step nobody is told about and half the reason it felt
     broken. The pointer is freed on the way in, and the whole screen is
     navigable on the arrow keys without touching the mouse at all.

     Movement is GEOMETRIC rather than by DOM order: from whatever is focused,
     the arrow finds the nearest thing that actually lies in that direction on
     screen. One rule that handles the character grid, both shelves and the
     buttons at the bottom, and it keeps working when a shelf changes length
     or the window is resized. */
  function items(){
    return [...document.querySelectorAll(
      '#chars .chrtile, #chars .shopit, #chars #cBack, #chars #cGo')]
      .filter(el=>!el.disabled && el.offsetParent!==null);
  }
  function move(dir){
    /* Not while the screen is sliding in. The card animates with a transform,
       so every rectangle it reports mid-flight is somewhere the element is not
       — and the arrow lands on whatever happened to be under the distortion. */
    const screen=document.querySelector('#chars');
    if(screen && screen.classList.contains('anim-in')){
      const first=items()[0]; if(first) first.focus();
      return;
    }
    const all=items(); if(!all.length) return;
    const cur=all.indexOf(document.activeElement)>=0 ? document.activeElement : null;
    if(!cur){ all[0].focus(); return; }
    const a=cur.getBoundingClientRect();
    const ax=a.left+a.width/2, ay=a.top+a.height/2;
    let best=null, bestScore=Infinity;
    all.forEach(el=>{
      if(el===cur) return;
      const b=el.getBoundingClientRect();
      const dx=(b.left+b.width/2)-ax, dy=(b.top+b.height/2)-ay;
      // must actually be in the direction asked for
      if(dir==='left'  && dx>-4) return;
      if(dir==='right' && dx< 4) return;
      if(dir==='up'    && dy>-4) return;
      if(dir==='down'  && dy< 4) return;
      /* Distance along the axis you asked for, plus a heavy penalty for
         drifting off it — so right goes to the next tile along and not to
         something nearer but a shelf away. */
      const along=Math.abs(dir==='left'||dir==='right' ? dx : dy);
      const off  =Math.abs(dir==='left'||dir==='right' ? dy : dx);
      const score=along + off*3;
      if(score<bestScore){ bestScore=score; best=el; }
    });
    /* Nothing lies that way — or the layout is in a state where nothing looks
       like it does. Fall back to plain document order, so an arrow always
       moves you somewhere sensible instead of leaving you stuck. */
    if(!best){
      const i=all.indexOf(cur);
      const step=(dir==='right'||dir==='down') ? 1 : -1;
      best=all[Math.max(0, Math.min(all.length-1, i+step))];
      if(best===cur) return;
    }
    best.focus();
    best.scrollIntoView({block:'nearest', inline:'nearest'});
  }
  function onKey(e){
    if(document.querySelector('#chars').classList.contains('hidden')) return;
    const k=e.key;
    const dir = (k==='ArrowLeft')?'left' : (k==='ArrowRight')?'right'
              : (k==='ArrowUp')?'up' : (k==='ArrowDown')?'down' : null;
    if(dir){ e.preventDefault(); e.stopPropagation(); move(dir); return; }
    if(k==='Escape' || k==='Backspace'){
      e.preventDefault(); e.stopPropagation();
      if(window.MENU && MENU.homeworld) MENU.homeworld();
      return;
    }
    // Enter and Space already activate a focused button; keep them off the game
    if(k==='Enter'||k===' ') e.stopPropagation();
  }
  let wired=false;
  function wireKeys(){
    if(wired) return; wired=true;
    // capture, so the game's own hotkeys never see these while we are open
    addEventListener('keydown', onKey, true);
  }

  function open(){
    render(); play(); wireKeys();
    if(document.pointerLockElement) document.exitPointerLock();
    setTimeout(()=>{
      const first=items()[0];
      if(first && !document.querySelector('#chars').classList.contains('hidden')) first.focus();
    }, 60);
  }
  function close(){ stop(); }

  /* ------------------------------------------- the one on the landing */
  function heroStage(){
    if(hero) return hero;
    const canvas=document.querySelector('#heroView');
    if(!canvas) return null;
    const renderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(28, 1, 0.1, 60);
    camera.position.set(0, 0.20, 3.9); camera.lookAt(0, 0.02, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbfe0ff, 1.7));
    const key=new THREE.DirectionalLight(0xfff6e8, 1.6); key.position.set(3,6,5);
    scene.add(key);
    const turntable=new THREE.Group(); scene.add(turntable);
    hero={renderer, scene, camera, turntable, current:null, who:null};
    return hero;
  }
  async function heroShow(){
    const h=heroStage(); if(!h) return;
    if(h.who===AVATAR.chosen) return;
    const want=AVATAR.chosen;
    let m; try{ m=await AVATAR.load(want); }catch(e){ return; }
    if(AVATAR.chosen!==want) return;
    if(h.current) h.turntable.remove(h.current);
    m.position.y=-0.9; h.turntable.add(m); h.current=m; h.who=want;
    AVATAR.animate(m, 0, 'idle');
  }
  function heroLoop(now){
    heroRaf=requestAnimationFrame(heroLoop);
    const dt=Math.min((now-heroLast)/1000, 0.05); heroLast=now;
    if(!hero) return;
    const c=hero.renderer.domElement;
    const w=c.clientWidth||300, ht=c.clientHeight||190;
    hero.renderer.setSize(w,ht,false);
    hero.camera.aspect=w/ht; hero.camera.updateProjectionMatrix();
    hero.turntable.rotation.y = Math.sin(now/2600)*0.5;   // looks around, does not spin
    if(hero.current) AVATAR.animate(hero.current, dt, 'idle');
    hero.renderer.render(hero.scene, hero.camera);
  }
  function heroOpen(){
    heroShow();
    if(!heroRaf){ heroLast=performance.now(); heroRaf=requestAnimationFrame(heroLoop); }
  }
  function heroClose(){ if(heroRaf){ cancelAnimationFrame(heroRaf); heroRaf=0; } }

  /* ================================================== the quick change
     ONE GL CONTEXT FOR THE WHOLE ROW. A canvas each would be a context
     each, and browsers hand out about sixteen before they start throwing
     the oldest away — which on a lab Chromebook means the planet's own
     canvas going white the moment this opens. So the row is real buttons
     doing the hit-testing, focus and screen-reader work, and one canvas
     lying underneath them painting each tile through a scissor rectangle.

     The characters stand side by side in ONE scene, far enough apart not
     to light or overlap each other, and the camera is moved to whichever
     one is being drawn. One scene means one set of lights, which is the
     only reason to prefer it over a scene each. */
  let sw=null;                     // {renderer, scene, camera, models:Map}
  let swOpen=false, swRaf=0, swLast=0, swPick=null;
  const SPACING = 10;              // metres between them in the hidden scene

  function swStage(){
    if(sw) return sw;
    const canvas=document.querySelector('#swapView');
    if(!canvas) return null;
    const renderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear=false;
    const scene=new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc3b4e6, 1.5));
    const key=new THREE.DirectionalLight(0xfff3f8, 1.5); key.position.set(3,6,5);
    const rim=new THREE.DirectionalLight(0x9fb4ff, 0.8);  rim.position.set(-4,3,-4);
    scene.add(key, rim);
    /* Orthographic, because a row of portraits at different distances from
       one perspective camera is a row of people at different sizes. */
    const camera=new THREE.OrthographicCamera(-1,1,1,-1,0.01,60);
    sw={ renderer, scene, camera, models:new Map() };
    return sw;
  }

  /* Every character the roster has, loaded once and kept. Three parses on
     first open and none ever again. */
  function swLoad(){
    const v=swStage(); if(!v) return;
    AVATAR.CHARS.forEach((c,i)=>{
      if(v.models.has(c.id)) return;
      v.models.set(c.id, null);                 // claim the slot before awaiting
      AVATAR.load(c.id).then(m=>{
        /* AT y=0, AND DO NOT MEASURE THE BOX TO FIND THE FEET. The box is
           the REST pose — arms out, body centred on its own origin — and
           the Mixamo clips are all authored with the character standing on
           that origin instead. Offsetting by the rest-pose box lifted
           everybody half a body height the moment the idle started playing
           and cut their heads off the top of the tile. The clip puts the
           feet on the floor; the same thing attach() relies on to stand
           the player on the ground. */
        m.position.set(i*SPACING, 0, 0);
        v.scene.add(m); v.models.set(c.id, m);
        AVATAR.animate(m, 0, 'idle');
      }).catch(()=>v.models.delete(c.id));
    });
  }

  function swTiles(){
    const row=document.querySelector('#swapRow'); if(!row) return;
    const items=window.SHOP ? SHOP.charItems() : [];
    row.querySelectorAll('.swaptile').forEach(n=>n.remove());
    AVATAR.CHARS.forEach((c,i)=>{
      const it=items[i];
      const owned=!it || SHOP.ownsChar(it);
      const on=c.id===AVATAR.chosen;
      const b=document.createElement('button');
      b.className='swaptile'+(on?' on':'')+(owned?'':' locked');
      b.dataset.c=c.id;
      b.setAttribute('aria-pressed', on?'true':'false');
      b.innerHTML=`${t(c.name)}${owned?'':`<span class="price">${it.price}¤</span>`}`;
      b.onclick=()=>swChoose(c.id, owned);
      row.appendChild(b);
    });
    swHint();
  }
  function swHint(msg){
    const el=document.querySelector('#swapHint'); if(!el) return;
    el.innerHTML = msg || t('<b>← →</b> pick &nbsp; <b>B</b> or <b>Esc</b> close');
  }
  function swChoose(id, owned){
    /* THE SHOP STAYS IN THE SHOP. This panel switches between characters
       you already have; buying one is a thing you do at the Mall, with the
       coins and the price list in front of you. Two places selling the
       same character is one place too many. */
    if(!owned){ swHint(t('{n} is for sale at the Mall.',{n:t(nameOf(id))}));
                if(window.beep) beep('bad'); return; }
    AVATAR.pick(id);
    swMark(id);
    swHint();
    if(window.beep) beep('pop');
  }
  const nameOf = id => (AVATAR.CHARS.find(c=>c.id===id)||{}).name || id;
  function swMark(id){
    document.querySelectorAll('#swapRow .swaptile').forEach(n=>{
      const on=n.dataset.c===id;
      n.classList.toggle('on', on);
      n.setAttribute('aria-pressed', on?'true':'false');
    });
  }

  /* Paint each tile through its own scissor rectangle. The canvas is laid
     over the row, so a tile's rectangle IS the viewport to draw it in —
     measured every frame, because the row moves when the window resizes
     and a stale rectangle draws somebody's head in the next slot. */
  function swDraw(dt){
    const v=sw; if(!v) return;
    const row=document.querySelector('#swapRow'); if(!row) return;
    const rb=row.getBoundingClientRect();
    const W=Math.max(1,Math.round(rb.width)), H=Math.max(1,Math.round(rb.height));
    const c=v.renderer.domElement;
    if(c.width!==W*v.renderer.getPixelRatio() || Math.round(parseFloat(c.style.width)||0)!==W){
      v.renderer.setSize(W,H,true);
    }
    v.renderer.clear();
    v.renderer.setScissorTest(true);
    document.querySelectorAll('#swapRow .swaptile').forEach(tile=>{
      const m=v.models.get(tile.dataset.c);
      if(!m) return;
      AVATAR.animate(m, dt, 'idle');
      const tb=tile.getBoundingClientRect();
      const x=tb.left-rb.left, y=rb.bottom-tb.bottom;     // GL counts up from the bottom
      const w=Math.round(tb.width), h=Math.round(tb.height);
      v.renderer.setViewport(x,y,w,h);
      v.renderer.setScissor(x,y,w,h);
      /* Framed head to foot with a little air, and a strip left at the
         bottom for the name to sit over. load() makes everybody exactly
         1.85 tall, so one framing does the whole row and nobody comes out
         bigger than anybody else — which is the point of a row. */
      const VIEW=2.45, EYELINE=0.88, aspect=w/h;
      const cam=v.camera;
      cam.left=-VIEW*aspect/2; cam.right=VIEW*aspect/2;
      cam.top=VIEW/2; cam.bottom=-VIEW/2;
      cam.updateProjectionMatrix();
      cam.position.set(m.position.x, EYELINE, 3.2);
      cam.lookAt(m.position.x, EYELINE, 0);
      v.renderer.render(v.scene, cam);
    });
    v.renderer.setScissorTest(false);
  }
  function swLoop(now){
    swRaf=requestAnimationFrame(swLoop);
    const dt=Math.min((now-swLast)/1000, 0.05); swLast=now;
    swDraw(dt);
    /* And you, out on the planet behind the panel. The world is held still
       while this is up, and whatever normally animates the player is inside
       the part that is being held — so it is this panel's job to keep the
       one character you are actually looking at alive. */
    if(window.AVATAR && AVATAR.idle) AVATAR.idle(dt);
  }

  /* Arrow keys walk the row and Enter is the click a focused button already
     understands, so this only has to move focus — and swallow the arrows,
     or the planet behind turns while the panel is up. */
  function swKey(e){
    if(!swOpen) return false;
    const k=e.code;
    if(k==='Escape'||k==='KeyB'){ quickClose(); return true; }
    const tiles=[...document.querySelectorAll('#swapRow .swaptile')];
    if(!tiles.length) return false;
    if(k==='ArrowLeft'||k==='ArrowRight'){
      const i=Math.max(0, tiles.indexOf(document.activeElement));
      const d=k==='ArrowRight'?1:-1;
      tiles[(i+d+tiles.length)%tiles.length].focus();
      return true;
    }
    if(k==='ArrowUp'||k==='ArrowDown') return true;   // not the planet's to turn
    return false;
  }

  function quickOpen(){
    if(swOpen) return;
    const el=document.querySelector('#swap'); if(!el) return;
    swOpen=true;
    if(document.pointerLockElement) document.exitPointerLock();
    const ttl=document.querySelector('#swapTitle');
    if(ttl) ttl.textContent=t('WHO DO YOU WANT TO BE?');
    swStage(); swLoad(); swTiles();
    el.classList.remove('hidden');
    if(!swRaf){ swLast=performance.now(); swRaf=requestAnimationFrame(swLoop); }
    const cur=[...document.querySelectorAll('#swapRow .swaptile')]
      .find(n=>n.dataset.c===AVATAR.chosen);
    if(cur) cur.focus();
  }
  function quickClose(){
    if(!swOpen) return;
    swOpen=false;
    const el=document.querySelector('#swap'); if(el) el.classList.add('hidden');
    if(swRaf){ cancelAnimationFrame(swRaf); swRaf=0; }
    /* Back to the game, and back to mouse-look — but only if the game is
       what we came from. Opening this over a menu and handing the pointer
       to a canvas nobody is looking at is how a menu stops taking clicks. */
    if(window.G && G.running && window.lockPointer){
      const view=document.querySelector('#view'); if(view) lockPointer(view);
    }
  }
  function quickToggle(){ swOpen ? quickClose() : quickOpen(); }

  return { open, close, render, unlockedCount, isUnlocked, heroOpen, heroClose,
           quickOpen, quickClose, quickToggle, quickKey:swKey,
           get quickUp(){ return swOpen; } };
})();
