/* =====================================================================
   CLOSET — what you have on, changed where you are standing.

   The other half of the quick change (chars.js): B is WHO you are, and
   from there TAB (or the button) is WHAT you are wearing. Like the quick
   change it sits along the bottom of the screen, so the one thing you are
   trying to look at — you — is not under it: every click puts the thing on
   your actual body out in the world, at once, through the wardrobe
   (wardrobe.js), without reloading anybody. The little turntable on the
   left is you from the FRONT, which the camera behind you never shows.

     tabs        the slots that have anything in them
     the row     everything for that slot: click to put it on, again to take it
                 off; a garment made for somebody else says so and stays shut
     outfits     save what you have on under a name; put a saved one back on
   ===================================================================== */
window.CLOSET = (function(){
  let up = false, tab = null, view = null, raf = 0, last = 0, spin = 0, drag = null;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const body = () => window.AVATAR ? AVATAR.bodyOf(AVATAR.chosen) : 'nia';
  const nameOf = id => { const d = window.AVATAR && AVATAR.bodyDef ? AVATAR.bodyDef(id) : null; return d ? d.name : id; };

  /* ------------------------------------------------- the turntable (you, from the front) */
  function stage(){
    if(view) return view;
    const canvas = $('#closetView'); if(!canvas) return null;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setClearColor(0, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc3b4e6, 1.5));
    const key = new THREE.DirectionalLight(0xfff3f8, 1.5); key.position.set(3, 6, 5);
    const rim = new THREE.DirectionalLight(0x9fb4ff, 0.8); rim.position.set(-4, 3, -4);
    scene.add(key, rim);
    const camera = new THREE.PerspectiveCamera(26, 0.75, 0.1, 40);
    view = { renderer, scene, camera, model:null, who:null };
    return view;
  }
  async function preview(){
    const v = stage(); if(!v) return;
    const who = body();
    if(v.who !== who){
      v.who = who;
      if(v.model){ v.scene.remove(v.model); v.model = null; }
      try{ const m = await AVATAR.load(who); if(v.who !== who) return; v.model = m; v.scene.add(m); AVATAR.animate(m, 0, 'idle'); AVATAR.animate(m, 0.2, 'idle'); }
      catch(e){ return; }
    }
    if(v.model) WARDROBE.put(v.model, who);
  }
  function draw(dt){
    const v = view; if(!v || !v.model) return;
    const c = v.renderer.domElement, w = c.clientWidth || 180, h = c.clientHeight || 240;
    if(c.width !== Math.round(w*v.renderer.getPixelRatio())) v.renderer.setSize(w, h, false);
    AVATAR.animate(v.model, dt, 'idle');
    if(!drag) spin += dt*0.35;
    v.model.rotation.y = spin;
    v.camera.aspect = w/h; v.camera.updateProjectionMatrix();
    v.camera.position.set(0, 1.0, 5.2); v.camera.lookAt(0, 0.95, 0);
    v.renderer.render(v.scene, v.camera);
  }
  function loop(now){
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last)/1000, 0.05); last = now;
    draw(dt);
    if(window.AVATAR && AVATAR.idle) AVATAR.idle(dt);          // and you, out in the world, alive behind the panel
  }

  /* ------------------------------------------------------------- the panel */
  function slotsWithItems(){ return WARDROBE.SLOTS.filter(s=>WARDROBE.itemsIn(s.id).length); }
  function render(){
    const el = $('#closet'); if(!el) return;
    const who = body(), on = WARDROBE.on(who), slots = slotsWithItems();
    if(!tab || !slots.some(s=>s.id === tab)) tab = slots[0] ? slots[0].id : null;
    $('#closetTitle').textContent = 'WHAT IS ' + nameOf(who).toUpperCase() + ' WEARING?';
    $('#closetTabs').innerHTML = slots.map(s=>`<button class="ctab${s.id === tab ? ' on' : ''}" data-tab="${s.id}">${esc(s.name)}${on[s.id] ? '<i></i>' : ''}</button>`).join('');
    const items = tab ? WARDROBE.itemsIn(tab) : [];
    $('#closetRow').innerHTML = items.map(id=>{
      const it = WARDROBE.ITEMS[id], fits = WARDROBE.fits(id, who), has = WARDROBE.owns(id), worn = on[it.slot] === id;
      const why = !fits ? 'Made for ' + (it.bodies || []).map(nameOf).join(', ') : !has ? 'Not yours yet' : '';
      return `<button class="citem${worn ? ' on' : ''}${(fits && has) ? '' : ' locked'}" data-item="${id}" title="${esc(it.about || '')}">
        <b>${esc(it.name)}</b><small>${esc(why || it.about || '')}</small></button>`;
    }).join('') + (tab && on[tab] ? `<button class="citem off" data-off="${tab}"><b>Take it off</b><small>Back to the base layer</small></button>` : '');
    const outfits = WARDROBE.outfits;
    $('#closetFits').innerHTML = Object.keys(outfits).map(n=>`<span class="cfit"><button data-wear="${esc(n)}">${esc(n)}</button><button class="x" data-drop="${esc(n)}" aria-label="Forget ${esc(n)}">✕</button></span>`).join('')
      + `<button class="cfit plain" data-plain="1">Base layer only</button>`
      + `<form id="closetSave"><input id="closetName" maxlength="20" placeholder="Name this outfit" aria-label="Outfit name"><button>Save</button></form>`;
    $('#closetHint').innerHTML = '<b>Tab</b> next shelf &nbsp; <b>click</b> wear / take off &nbsp; <b>drag</b> turn &nbsp; <b>B</b> who you are &nbsp; <b>Esc</b> close';
  }
  function click(e){
    const t = e.target.closest('button'); if(!t) return;
    const who = body();
    if(t.dataset.tab){ tab = t.dataset.tab; render(); return; }
    if(t.dataset.item){
      const id = t.dataset.item, it = WARDROBE.ITEMS[id];
      if(!WARDROBE.fits(id, who) || !WARDROBE.owns(id)){ if(window.beep) beep('bad'); return; }
      if(WARDROBE.on(who)[it.slot] === id) WARDROBE.takeOff(it.slot, who); else WARDROBE.wear(id, who);
      if(window.AVATAR && AVATAR.glanceSelf) AVATAR.glanceSelf(it.slot);       // and looks down at it
      if(window.beep) beep('pop'); return;
    }
    if(t.dataset.off){ WARDROBE.takeOff(t.dataset.off, who); return; }
    if(t.dataset.wear){ WARDROBE.wearOutfit(t.dataset.wear, who); if(window.AVATAR && AVATAR.glanceSelf) AVATAR.glanceSelf('outer'); if(window.beep) beep('pop'); return; }
    if(t.dataset.drop){ WARDROBE.dropOutfit(t.dataset.drop); return; }
    if(t.dataset.plain){ WARDROBE.setOn(who, {}); return; }
  }
  function submit(e){
    if(e.target.id !== 'closetSave') return;
    e.preventDefault();
    const n = ($('#closetName').value || '').trim().slice(0, 20); if(!n) return;
    WARDROBE.saveOutfit(n, body()); if(window.beep) beep('pop');
  }
  function wire(){
    const el = $('#closet'); if(!el || el.dataset.wired) return; el.dataset.wired = '1';
    el.addEventListener('click', click); el.addEventListener('submit', submit);
    const c = $('#closetView');
    c.addEventListener('pointerdown', e=>{ drag = { x:e.clientX, s:spin }; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', e=>{ if(drag) spin = drag.s + (e.clientX - drag.x)*0.012; });
    c.addEventListener('pointerup', ()=>{ drag = null; });
    WARDROBE.onChange(()=>{ if(up){ render(); preview(); } });
  }

  /* ------------------------------------------------------------- open / close */
  function open(){
    if(up) return;
    const el = $('#closet'); if(!el || !window.WARDROBE) return;
    up = true; wire();
    if(document.pointerLockElement) document.exitPointerLock();
    el.classList.remove('hidden');
    render(); preview();
    if(!raf){ last = performance.now(); raf = requestAnimationFrame(loop); }
    const first = el.querySelector('.citem'); if(first) first.focus();
  }
  function close(back){
    if(!up) return;
    up = false;
    const el = $('#closet'); if(el) el.classList.add('hidden');
    if(raf){ cancelAnimationFrame(raf); raf = 0; }
    if(back === 'who' && window.CHARS){ CHARS.quickOpen(); return; }
    if(window.G && G.running && window.lockPointer){ const v = $('#view'); if(v) lockPointer(v); }
  }
  function key(e){
    if(!up) return false;
    const k = e.code;
    if(document.activeElement && document.activeElement.id === 'closetName' && k !== 'Escape') return false;   // typing a name
    if(k === 'Escape'){ close(); return true; }
    if(k === 'KeyB'){ close('who'); return true; }
    if(k === 'Tab'){ const s = slotsWithItems(), i = s.findIndex(x=>x.id === tab); tab = s[(i + (e.shiftKey ? -1 : 1) + s.length) % s.length].id; render(); return true; }
    if(k === 'ArrowLeft' || k === 'ArrowRight'){
      const tiles = [...document.querySelectorAll('#closetRow .citem')]; if(!tiles.length) return true;
      const i = Math.max(0, tiles.indexOf(document.activeElement)), d = k === 'ArrowRight' ? 1 : -1;
      tiles[(i + d + tiles.length) % tiles.length].focus(); return true;
    }
    if(k === 'ArrowUp' || k === 'ArrowDown') return true;
    return false;
  }

  return { open, close, key, get up(){ return up; } };
})();
