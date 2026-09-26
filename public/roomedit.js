/* =====================================================================
   BUILDING A CHAT ROOM — the owner's side.

   You build it from inside it, standing in it, with the crosshair: pick a
   part, look at the floor, drop it, pick it up again, turn it, and save.
   The Godot editor (koro-godot/scripts/room_editor.gd) flies a camera over
   the room instead; both end in the same place, because what a room IS is a
   list of objects the server checks — so a room built either way opens the
   same in both.

   NOTHING IS SAVED UNTIL YOU SAVE IT. Every verb changes the room in front
   of you and the record that Save sends, together (chatroom.js), so what you
   are looking at is exactly what would be written down. Save posts the lot
   and the server washes it through the catalogue: names cut short, colours
   that are colours, positions inside the room.

   WHAT YOU ARE BUILDING IS NOT LIVE. Other people in the room see the room
   as it was last saved, and see the change the moment you save it — the
   server tells them (`crupdate`) and their copy reloads. So a half-moved
   couch is not something thirty people watch slide about.
   ===================================================================== */
window.ROOMEDIT = (function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const esc = s=>String(s==null?'':s).replace(/[&<>"]/g,
    c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const V = (x,y,z)=>new THREE.Vector3(x,y,z);

  let on = false, picked = null, held = null, tab = 'parts', part = null, dirty = false;
  let saidT = 0;

  const cat = ()=>CHATROOM.catalog;
  const rec = id=>CHATROOM.objects.find(o=>o.id===id) || null;

  function open_(){
    if(on || !CHATROOM.active || !CHATROOM.mine) return;
    on = true; picked = null; held = null; tab = 'parts'; part = null; dirty = false;
    const el = $('#build'); if(el) el.classList.remove('hidden');
    paint();
    say(t('Pick a part, look at the floor, press F to drop it.'));
  }
  function close(){
    if(!on) return;
    on = false; picked = null; held = null;
    const el = $('#build'); if(el) el.classList.add('hidden');
    outline(null);
    if(G.running) lockPointer($('#view'));
  }
  const toggle = ()=> on ? close() : open_();

  /* ------------------------------------------------------------- the rig
     A thin box round whatever is selected, so you can tell which of four
     identical chairs you are about to turn. */
  let ring = null;
  function outline(h){
    if(ring && ring.parent) ring.parent.remove(ring);
    ring = null;
    if(!h) return;
    const size = h.userData.size || V(1,1,1);
    const g = new THREE.BoxGeometry(size.x+0.12, size.y+0.12, size.z+0.12);
    ring = new THREE.LineSegments(new THREE.EdgesGeometry(g),
      new THREE.LineBasicMaterial({ color:0x8ff0ff }));
    ring.position.copy(h.userData.mid || V(0,size.y/2,0));
    ring.userData.flat = true;
    h.add(ring);
  }

  /* Where the crosshair meets the floor, clamped inside the room — the spot
     a part would land on. */
  const rayc = new THREE.Raycaster();
  function aim(){
    const dir = V(0,0,-1).applyQuaternion(G.camera.quaternion);
    const from = G.camera.position;
    const s = CHATROOM.size;
    /* the floor is y = 0; if you are looking up, drop it a few metres ahead
       rather than at infinity */
    let p;
    if(dir.y < -0.05){
      const k = -from.y/dir.y;
      p = from.clone().add(dir.clone().multiplyScalar(Math.min(k, 24)));
    } else {
      p = from.clone().add(dir.clone().multiplyScalar(4));
      p.y = 0;
    }
    p.x = Math.max(-s.w/2+0.4, Math.min(s.w/2-0.4, p.x));
    p.z = Math.max(-s.d/2+0.4, Math.min(s.d/2-0.4, p.z));
    p.y = 0;
    return p;
  }
  /* And what the crosshair is ON, so E picks the right thing up. */
  function under(){
    const dir = V(0,0,-1).applyQuaternion(G.camera.quaternion);
    rayc.set(G.camera.position, dir);
    const hit = rayc.intersectObjects(G.hits, false)[0];
    return hit ? hit.object.userData.owner : null;
  }

  /* --------------------------------------------------------- the verbs */
  function drop(){
    if(!part) return say(t('Pick a part first — the row along the bottom.'));
    const at = aim();
    const id = CHATROOM.addObject(part, at, Math.round(((G.yaw*180/Math.PI)+180)%360));
    if(!id) return;
    mark();
    select(id);
    say(t('{n} dropped. E to pick it up, [ ] to turn it.',
          { n:(cat().objects[part]||{}).name || part }));
  }
  function select(id){
    picked = id;
    outline(id ? CHATROOM.nodes.get(id) : null);
    if(id && tab==='parts') tab = 'thing';
    paint();
  }
  /* PICK UP AND PUT DOWN, rather than a drag: you are holding a mouse that
     is looking around the room, and a drag would be a click that also turns
     your head. Held, a thing follows the crosshair; E again sets it down. */
  function grab(){
    const h = under();
    if(held){ held = null; say(t('Put down.')); mark(); return true; }
    if(h && h.userData.roomThing){
      select(h.userData.id);
      held = h.userData.id;
      say(t('Carrying it. Walk, then E to put it down.'));
      return true;
    }
    if(picked){ held = picked; say(t('Carrying it.')); return true; }
    return false;
  }
  function turn(by){
    const o = picked && rec(picked);
    if(!o) return;
    CHATROOM.moveObject(picked, { x:o.p[0], y:o.p[1], z:o.p[2] }, (Number(o.r)||0)+by, Number(o.s)||1);
    mark();
  }
  function scale(by){
    const o = picked && rec(picked);
    if(!o) return;
    CHATROOM.moveObject(picked, { x:o.p[0], y:o.p[1], z:o.p[2] }, Number(o.r)||0, (Number(o.s)||1)+by);
    outline(CHATROOM.nodes.get(picked));
    mark();
    paint();
  }
  function raise(by){
    const o = picked && rec(picked);
    if(!o) return;
    CHATROOM.moveObject(picked, { x:o.p[0], y:(+o.p[1]||0)+by, z:o.p[2] },
                        Number(o.r)||0, Number(o.s)||1);
    mark();
  }
  function del(){
    if(!picked) return;
    CHATROOM.removeObject(picked);
    picked = null; held = null;
    outline(null);
    mark(); paint();
    say(t('Gone. Save when you are happy with the room.'));
  }
  function dup(){
    if(!picked) return;
    const id = CHATROOM.duplicateObject(picked);
    if(id){ select(id); mark(); say(t('Another one.')); }
  }
  function prop(key, value){
    if(!picked) return;
    CHATROOM.setProp(picked, key, value);
    outline(CHATROOM.nodes.get(picked));
    mark(); paint();
  }
  function mark(){ dirty = true; paint(); }

  async function save(){
    const s = CHATROOM.snapshot();
    const btn = $('#bSave');
    if(btn) btn.disabled = true;
    try{
      const j = await NET.roomSave(CHATROOM.room.id, s.env, s.objects);
      /* the server's version is the real one — it may have cut a name short
         or pulled a couch back inside the wall */
      CHATROOM.reload(j.room);
      picked = null; held = null;
      outline(null);
      dirty = false;
      say(t('Saved. Everybody in here can see it.'));
    }catch(e){ say(e.message); }
    if(btn) btn.disabled = false;
    paint();
  }

  /* --------------------------------------------------------- the panel */
  const CATS = [['furniture', t('Furniture')], ['decor', t('Decor')],
                ['interactive', t('Things that do things')]];
  let catNow = 'furniture';

  function paint(){
    const body = $('#buildBody');
    if(!body || !on) return;
    const tabs = [['parts', t('Parts')], ['thing', t('This thing')],
                  ['room', t('The room')]];
    let html = '<div class="bd-tabs">' + tabs.map(([k,l])=>
      '<button class="bd-tab'+(tab===k?' on':'')+'" data-tab="'+k+'">'+esc(l)+'</button>').join('')
      + '<span class="bd-sp"></span>'
      + '<button class="bd-save'+(dirty?' hot':'')+'" id="bSave">'
      + (dirty ? t('Save changes') : t('Saved')) + '</button>'
      + '<button class="bd-done" id="bDone">'+t('Done')+'</button></div>';
    if(tab==='parts') html += parts();
    else if(tab==='thing') html += thing();
    else html += roomTab();
    html += '<div class="bd-say" id="bSaid"></div>';
    body.innerHTML = html;
    wire(body);
  }
  function parts(){
    const objs = cat().objects;
    const n = CHATROOM.objects.length, max = cat().limits.objects;
    let html = '<div class="bd-cats">' + CATS.map(([k,l])=>
      '<button class="bd-cat'+(catNow===k?' on':'')+'" data-cat="'+k+'">'+esc(l)+'</button>').join('')
      + '<span class="bd-count">'+t('{n} of {m} things',{n, m:max})+'</span></div>';
    html += '<div class="bd-parts">' + Object.keys(objs).filter(k=>objs[k].cat===catNow)
      .map(k=>'<button class="bd-part'+(part===k?' on':'')+'" data-part="'+k+'">'
              + esc(objs[k].name) + '</button>').join('') + '</div>';
    html += '<p class="bd-keys">'+t('F drop · E pick up/put down · [ ] turn · - = size · , . height · Z copy · X delete')+'</p>';
    return html;
  }
  /* The one you have selected: its colour, its words, its picture, and for a
     robot the program it runs. */
  function thing(){
    const o = picked && rec(picked);
    if(!o) return '<p class="bd-empty">'+t('Look at something and press E.')+'</p>';
    const sp = cat().objects[o.type] || {};
    const def = sp.props || {};
    let html = '<div class="bd-head"><b>'+esc(sp.name||o.type)+'</b>'
             + '<small>'+t('size {s}× · turned {r}°',
                 { s:(Number(o.s)||1).toFixed(2), r:Math.round(Number(o.r)||0) })+'</small></div>';
    if('color' in def){
      html += '<div class="bd-row"><span>'+t('Colour')+'</span><span class="bd-pal">'
        + cat().env.palette.map(c=>'<button class="bd-sw'
            + (String(o.props.color).toLowerCase()===c?' on':'')
            + '" data-col="'+c+'" style="background:'+c+'"></button>').join('') + '</span></div>';
    }
    if('text' in def){
      html += '<div class="bd-row"><span>'+t('Words')+'</span>'
        + '<input id="bText" maxlength="'+cat().limits.text+'" value="'+esc(o.props.text||'')+'"></div>';
    }
    if('art' in def){
      html += '<div class="bd-row"><span>'+t('Picture')+'</span><span>'
        + [1,2,3].map(a=>'<button class="bd-pick'+(Number(o.props.art)===a?' on':'')
            + '" data-art="'+a+'">'+a+'</button>').join('') + '</span></div>';
    }
    if('who' in def){
      html += '<div class="bd-row"><span>'+t('Who')+'</span><span>'
        + ['nia','sable','kofi','theo','zuri'].map(w=>'<button class="bd-pick'
            + (String(o.props.who)===w?' on':'')+'" data-who="'+w+'">'
            + esc(w[0].toUpperCase()+w.slice(1))+'</button>').join('') + '</span></div>';
    }
    if('to' in def){
      html += '<div class="bd-row"><span>'+t('Goes to')+'</span>'
        + '<input id="bTo" maxlength="10" placeholder="'+t('a room number, or blank for out')
        + '" value="'+esc(o.props.to||'')+'"></div>'
        + '<p class="bd-note">'+t('Blank is the way out of your room. A number is another room — the server still checks whoever walks through.')+'</p>';
    }
    if('program' in def) html += program(o);
    html += '<div class="bd-acts"><button id="bDup">'+t('Copy')+'</button>'
          + '<button id="bDel" class="bd-del">'+t('Delete')+'</button></div>';
    return html;
  }
  /* THE ROBOT'S PROGRAM — the same blocks as the rest of Koro, by the same
     ids (public/blocks.js), which is why a robot built here runs identically
     in the Godot game. It is a list rather than a canvas: nine block kinds,
     in order, with their numbers. */
  const BLOCK_WORDS = {
    'event.flag':      ()=>t('when ▶ the game starts'),
    'motion.move':     a=>t('move {n} steps',{n:a[0]}),
    'motion.turn':     a=>t('turn {x} by {n}',{x:a[0], n:a[1]}),
    'motion.face':     a=>t('face {n}°',{n:a[0]}),
    'ctrl.wait':       a=>t('wait {n} seconds',{n:a[0]}),
    'ctrl.repeat':     a=>t('repeat {n}',{n:a[0]}),
    'ctrl.forever':    ()=>t('forever'),
    'ctrl.end':        ()=>t('end'),
    'looks.sayFor':    a=>t('say “{s}” for {n} seconds',{s:a[0], n:a[1]})
  };
  function program(o){
    const prog = o.props.program || [];
    let html = '<div class="bd-prog"><b>'+t('Its program')+'</b><ol>';
    prog.forEach((step,i)=>{
      const op = String(step[0]);
      const args = step.slice(1);
      html += '<li><span>'+esc((BLOCK_WORDS[op]||(()=>op))(args))+'</span>'
            + args.map((a,k)=>'<input class="bd-arg" data-i="'+i+'" data-k="'+k+'" value="'
                              + esc(a)+'">').join('')
            + '<button class="bd-x" data-del="'+i+'">✕</button></li>';
    });
    html += '</ol><div class="bd-add">' + Object.keys(cat().blocks).filter(k=>k!=='_')
      .map(k=>'<button class="bd-blk" data-blk="'+k+'">+ '
              + esc((BLOCK_WORDS[k]||(()=>k))(defaults(k)))+'</button>').join('') + '</div>'
      + '<button class="bd-try" id="bTry">▶ '+t('Try it here')+'</button>'
      + '<p class="bd-note">'+t('Only you see the trial. Run it with E once it is saved, and everybody in the room watches the same run.')+'</p></div>';
    return html;
  }
  const defaults = k=>({ 'motion.move':[30], 'motion.turn':['z',90], 'motion.face':[0],
                         'ctrl.wait':[2], 'ctrl.repeat':[4],
                         'looks.sayFor':['Hi!',2] }[k] || []);
  function roomTab(){
    const E = cat().env, e = CHATROOM.env;
    const pick = (key, list, label)=>
      '<div class="bd-row"><span>'+esc(label)+'</span><span>'
      + list.map(v=>'<button class="bd-pick'+(String(e[key])===v?' on':'')+'" data-env="'+key
                    +'" data-val="'+v+'">'+esc(t(v))+'</button>').join('') + '</span></div>';
    const swatch = (key, label)=>
      '<div class="bd-row"><span>'+esc(label)+'</span><span class="bd-pal">'
      + E.palette.map(c=>'<button class="bd-sw'+(String(e[key]).toLowerCase()===c?' on':'')
          + '" data-envcol="'+key+'" data-val="'+c+'" style="background:'+c+'"></button>').join('')
      + '</span></div>';
    return pick('floor', E.floor, t('Floor')) + swatch('floorColor', t('Floor colour'))
         + pick('walls', E.walls, t('Walls')) + swatch('wallColor', t('Wall colour'))
         + '<div class="bd-row"><span>'+t('Ceiling')+'</span><span>'
         + '<button class="bd-pick'+(e.ceiling!==false?' on':'')+'" data-lid="1">'+t('on')+'</button>'
         + '<button class="bd-pick'+(e.ceiling===false?' on':'')+'" data-lid="0">'+t('open to the sky')+'</button>'
         + '</span></div>'
         + (e.ceiling!==false ? swatch('ceilingColor', t('Ceiling colour'))
                              : pick('sky', E.sky, t('Sky')))
         + pick('light', E.light, t('Light')) + swatch('lightColor', t('Light colour'))
         + '<div class="bd-row"><span>'+t('Brightness')+'</span>'
         + '<input id="bBright" type="range" min="0.2" max="2" step="0.1" value="'
         + (Number(e.brightness)||1)+'"></div>';
  }

  function wire(body){
    body.querySelectorAll('.bd-tab').forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; paint(); });
    body.querySelectorAll('.bd-cat').forEach(b=>b.onclick=()=>{ catNow=b.dataset.cat; paint(); });
    body.querySelectorAll('.bd-part').forEach(b=>b.onclick=()=>{
      part = b.dataset.part; paint();
      say(t('{n} chosen — look at the floor and press F.',
            { n:(cat().objects[part]||{}).name || part }));
    });
    const sv = $('#bSave'); if(sv) sv.onclick = save;
    const dn = $('#bDone'); if(dn) dn.onclick = ()=>{
      if(dirty) return say(t('Save first, or your changes go nowhere.'));
      close();
    };
    body.querySelectorAll('.bd-sw').forEach(b=>b.onclick=()=>{
      if(b.dataset.envcol) return env(b.dataset.envcol, b.dataset.val);
      prop('color', b.dataset.col);
    });
    body.querySelectorAll('.bd-pick').forEach(b=>{
      if(b.dataset.env) b.onclick = ()=>env(b.dataset.env, b.dataset.val);
      else if(b.dataset.lid) b.onclick = ()=>env('ceiling', b.dataset.lid==='1');
      else if(b.dataset.art) b.onclick = ()=>prop('art', Number(b.dataset.art));
      else if(b.dataset.who) b.onclick = ()=>prop('who', b.dataset.who);
    });
    const txt = $('#bText');
    if(txt){ txt.onkeydown = e=>e.stopPropagation(); txt.onkeyup = e=>e.stopPropagation();
             txt.onchange = ()=>prop('text', txt.value); }
    const to = $('#bTo');
    if(to){ to.onkeydown = e=>e.stopPropagation(); to.onkeyup = e=>e.stopPropagation();
            to.onchange = ()=>prop('to', to.value.replace(/\D/g,'')); }
    const br = $('#bBright');
    if(br) br.onchange = ()=>env('brightness', Number(br.value));
    const dp = $('#bDup'); if(dp) dp.onclick = dup;
    const dl = $('#bDel'); if(dl) dl.onclick = del;
    body.querySelectorAll('.bd-blk').forEach(b=>b.onclick=()=>addBlock(b.dataset.blk));
    body.querySelectorAll('.bd-x').forEach(b=>b.onclick=()=>delBlock(Number(b.dataset.del)));
    body.querySelectorAll('.bd-arg').forEach(i=>{
      i.onkeydown = e=>e.stopPropagation(); i.onkeyup = e=>e.stopPropagation();
      i.onchange = ()=>setArg(Number(i.dataset.i), Number(i.dataset.k), i.value);
    });
    const tr = $('#bTry');
    if(tr) tr.onclick = ()=>{
      const o = rec(picked);
      if(o) CHATROOM.tryProgram(picked, o.props.program||[]);
      say(t('Watch it. Nobody else can see this one.'));
    };
  }
  function env(key, value){
    const e = {};
    e[key] = value;
    CHATROOM.setEnv(e);
    outline(picked ? CHATROOM.nodes.get(picked) : null);
    mark();
  }
  function progOf(){ const o = rec(picked); return (o && o.props && o.props.program) || null; }
  function addBlock(k){
    const prog = progOf();
    if(!prog) return;
    prop('program', prog.concat([[k].concat(defaults(k))]));
  }
  function delBlock(i){
    const prog = progOf();
    if(!prog) return;
    const out = prog.slice();
    out.splice(i,1);
    prop('program', out);
  }
  function setArg(i, k, v){
    const prog = progOf();
    if(!prog || !prog[i]) return;
    const out = JSON.parse(JSON.stringify(prog));
    const kinds = cat().blocks[String(out[i][0])] || [];
    out[i][k+1] = kinds[k]==='n' ? (Number(v)||0)
                : kinds[k]==='axis' ? (['x','y','z'].includes(v) ? v : 'z')
                : String(v);
    prop('program', out);
  }
  function say(msg){
    const el = $('#bSaid');
    if(el) el.textContent = msg || '';
    saidT = 4;
  }

  /* --------------------------------------------------------- the frame */
  function tick(dt){
    if(!on) return;
    if(saidT > 0 && (saidT -= dt) <= 0){ const el = $('#bSaid'); if(el) el.textContent = ''; }
    if(!held) return;
    const o = rec(held);
    if(!o) { held = null; return; }
    const at = aim();
    CHATROOM.moveObject(held, { x:at.x, y:+o.p[1]||0, z:at.z }, Number(o.r)||0, Number(o.s)||1);
  }

  function key(e){
    if(!on) return false;
    const typing = document.activeElement && document.activeElement.tagName==='INPUT';
    if(e.code==='Escape'){
      if(held){ held = null; say(t('Put down.')); return true; }
      if(dirty){ say(t('Save first, or press Done again to drop the changes.')); dirty = false; paint(); return true; }
      close();
      return true;
    }
    if(typing) return false;
    switch(e.code){
      case 'KeyF': drop(); return true;
      case 'KeyE': return grab();
      case 'KeyX': del(); return true;
      case 'KeyZ': dup(); return true;
      case 'BracketLeft':  turn(-15); return true;
      case 'BracketRight': turn(15);  return true;
      case 'Minus': scale(-0.1); return true;
      case 'Equal': scale(0.1);  return true;
      case 'Comma':  raise(-0.1); return true;
      case 'Period': raise(0.1);  return true;
      case 'Tab': tab = tab==='parts' ? 'thing' : tab==='thing' ? 'room' : 'parts'; paint(); return true;
    }
    return false;
  }

  return { open_, close, toggle, key, tick, paint,
           get open(){ return on; }, get dirty(){ return dirty; } };
})();
