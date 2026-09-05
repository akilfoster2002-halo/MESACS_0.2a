/* =====================================================================
   MENU — sign-in, mission select, and the free-play yard with chat.
   This replaces the old Linux-desktop hub: missions are chosen from a
   card grid, and Free Play is the only place other students appear.
   ===================================================================== */
window.MENU = (function(){
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];

  /* One screen hands over to the next with a short cross-fade, so a student
     always sees where they came from and where they landed. */
  const SCREENS=['#start','#chars','#auth','#modes','#missions','#servers','#menu'];
  let showing=null;
  function show(sel, after){
    if(showing===sel) return;
    const next=$(sel);
    const prev=showing ? $(showing) : null;
    showing=sel;
    if(prev){
      prev.classList.remove('anim-in');
      prev.classList.add('anim-out');
      setTimeout(()=>{ prev.classList.add('hidden'); prev.classList.remove('anim-out'); }, 260);
    }
    SCREENS.filter(x=>x!==sel).forEach(x=>{ if(x!==showing && $(x)!==prev) $(x).classList.add('hidden'); });
    setTimeout(()=>{
      next.classList.remove('hidden','anim-out');
      next.classList.add('anim-in');
      setTimeout(()=>next.classList.remove('anim-in'), 520);
      if(after) after();
    }, prev?200:0);
  }
  function hideAll(){
    SCREENS.forEach(x=>{ const e=$(x); if(e) e.classList.add('hidden'); });
    showing=null;
    if(window.CHARS){ CHARS.close(); CHARS.heroClose(); }
  }

  /* The cards on the main grid, not the coding missions.
     Circuit — Time Trial is parked: race.js still loads and GAME.start('race')
     still runs it, but it is off the grid until the track is finished.

     `group` is what stops this reading as one undifferentiated pile of seven
     cards. Without it Spaceflight lands in the top row beside Level 0 and
     looks like more warm-up, when it is a mission — it just does not hold a
     number or lock anything behind it. */
  const GROUPS={
    warmup :{ lbl:'WARM UP',        sub:'No pressure, nothing to unlock.' },
    /* Space Explorer is numbered but never locks, so the heading cannot
       promise that the numbers gate each other — the card says which is which. */
    course :{ lbl:'THE MISSIONS',   sub:'One idea each, in order — unless the card says otherwise.' },
    sandbox:{ lbl:'YOUR OWN WORLD', sub:'Every block, no goal but yours.' }
  };
  const TILES=[
    {id:'tut',   g:'warmup',  em:'🎮', a:'#ffe9a8', name:'Level 0 — Basics',
     blurb:'Practice. Walk, look, jump, open the console, run a program. Nothing chases you.'},
    {id:'nav',   g:'course',  em:'🧟', a:'#8fd3ff', name:'Escape — Corridors',
     blurb:'Learn to code by getting out alive. It never stops walking.'},
    {id:'flight',g:'course',  em:'🚀', a:'#8ff0ff', name:'Mission 1 — Space Explorer',
     blurb:'Nine lanes, a wall of rock every beat. Motion, timing, loops — and a gunnery range between runs.'},
    {id:'m1',    g:'course',  em:'🧟', a:'#a8e6cf', name:'Mission 2 — Loops',
     blurb:'Commands and loops. Beat THE LOOPER with repeat.'},
    {id:'m2',    g:'course',  em:'🔮', a:'#cdb4f6', name:'Mission 3 — Choices',
     blurb:'if / else. PRISM changes colour every two seconds.'},
    {id:'m3',    g:'course',  em:'🧮', a:'#ffb4a2', name:'Mission 4 — Functions',
     blurb:'define combo. OFF-BY-ONE always has one more.'},
    {id:'free',  g:'sandbox', em:'🧩', a:'#cdb4f6', name:'Free Play — Code Sandbox',
     blurb:'A 3D world you write. Objects, variables, functions, clones — code anything.'}
  ];

  /* ------------------------------------------------------- auth screen */
  function authMsg(text, good){
    const el=$('#authMsg'); if(!el) return;
    el.textContent=text||''; el.classList.toggle('good',!!good);
  }
  /* The sign-in form is off the landing now.  Everything below still works
     if the markup is put back, and quietly does nothing while it is not. */
  async function wireAuth(){
    if($('#authMsg')){
      const up = await NET.health();
      if(!up){
        authMsg(t('Sign-in is not connected yet — you can still play as a guest.'));
        ['#inUser','#inPass','#upUser','#upName','#upPass','#btnIn','#btnUp']
          .forEach(sel=>{ const el=$(sel); if(el) el.disabled=true; });
      }
    }
    $$('.tab').forEach(b=>b.onclick=()=>{
      $$('.tab').forEach(x=>x.classList.toggle('on',x===b));
      const fi=$('#formIn'), fu=$('#formUp');
      if(fi) fi.classList.toggle('hidden', b.dataset.tab!=='in');
      if(fu) fu.classList.toggle('hidden', b.dataset.tab!=='up');
      authMsg('');
    });
    const formIn=$('#formIn');
    if(formIn) formIn.onsubmit=async e=>{
      e.preventDefault(); authMsg(t('Signing in…'));
      try{
        await NET.login($('#inUser').value.trim(), $('#inPass').value);
        afterSignIn();
      }catch(err){ authMsg(err.message); }
    };
    const formUp=$('#formUp');
    if(formUp) formUp.onsubmit=async e=>{
      e.preventDefault(); authMsg(t('Creating your account…'));
      try{
        await NET.register({ username:$('#upUser').value.trim(),
                             display:$('#upName').value.trim(), password:$('#upPass').value });
        afterSignIn();
      }catch(err){ authMsg(err.message); }
    };
      const guest=$('#btnGuest'); if(guest) guest.onclick=()=>{ homeworld(); };
    const st=$('#btnStart'); if(st) st.onclick=()=>chars();
    const cb=$('#cBack');    if(cb) cb.onclick=()=>start();
    // picking a character is the last screen before the world: Continue lands
    // you on the planet, not on a grid of cards
    const cg=$('#cGo');      if(cg) cg.onclick=()=>{ if(window.CHARS) CHARS.close(); homeworld(); };
    const mc=$('#mChar');    if(mc) mc.onclick=()=>chars();
    const out=$('#mOut');
    if(out) out.onclick=async()=>{
      if(!NET.signedIn) return auth();
      await NET.logout(); location.reload();
    };
    const si=$('#sSignIn'); if(si) si.onclick=()=>auth();
    const ab=$('#aBack');   if(ab) ab.onclick=()=>start();
    $('#mLang').onclick=()=>setLang(window.LANG==='en'?'es':'en');
  }
  function afterSignIn(){
    const u=NET.me;
    if(u && u.progress) PROGRESS.load(u.progress);
    homeworld();          // signing in lands you on the planet, not on a menu
  }

  /* -------------------------------------------------------- the menu */
  function render(){
    const grid=$('#misGrid'); if(!grid) return;
    $('#mTitle').textContent='KORO';
    $('#mWho').textContent = t('Pick who you are. Pick a mission. Write the code that wins it.');
    const out=$('#mOut'); if(out) out.textContent = NET.signedIn ? t('Sign out') : t('Sign in');
    $('#mHint').textContent = t('Finish a mission to unlock the next one.');
    const mc=$('#mChar'); if(mc) mc.textContent='🙂 '+t('Character');
    renderChars();
    renderDiff();
    grid.innerHTML='';
    let group=null;
    TILES.forEach(m=>{
      // a heading whenever the group changes, spanning the whole grid row
      if(m.g && m.g!==group){
        group=m.g;
        const g=GROUPS[group];
        const h=document.createElement('div');
        h.className='misgroup';
        h.innerHTML=`<b>${t(g.lbl)}</b><span>${t(g.sub)}</span>`;
        grid.appendChild(h);
      }
      const needsIn = m.needsAccount && !NET.signedIn;
      const open_ = PROGRESS.unlocked(m.id) && !needsIn;
      const done  = PROGRESS.isDone(m.id);
      const b=document.createElement('button');
      b.className='mis'+(open_?'':' locked')+(done?' done':'');
      b.style.setProperty('--a', m.a||'#8fd3ff');
      // level 0 is practice: it never locks, and finishing it invites a replay
      // rather than closing the door with a COMPLETE stamp
      const tag = needsIn ? '🔒 '+t('Sign in to play together')
                : !open_ ? '🔒 '+t('Finish {m} first',{m:t(labelOf(PROGRESS.needs(m.id)))})
                : done ? (m.id==='tut' ? '⭐ '+t('PRACTISE AGAIN ▶')
                     : m.id==='race' ? '⭐ '+t('BEAT YOUR TIME ▶')
                     : m.id==='flight' ? '⭐ '+t('FLY IT AGAIN ▶') : '⭐ '+t('COMPLETE'))
                // it sits in the course but gates nothing, so it never says
                // "finish X first" and never makes anybody wait for it
                : m.id==='flight' ? t('PLAY ANY TIME ▶') : t('PLAY ▶');
      b.innerHTML=`<div class="em">${m.em}</div><b>${t(m.name)}</b>
                   <small>${t(m.blurb)}</small><div class="tagrow">${tag}</div>`;
      b.onclick=()=>{ if(needsIn) return auth(); if(!open_) return; launch(m.id); };
      grid.appendChild(b);
    });
  }
  // the character grid lives on its own screen now
  function renderChars(){ if(window.CHARS) CHARS.render(); }

  /* The difficulty row. It sits above the missions because it applies to all
     of them — picking it after choosing a mission would read as a per-mission
     setting, which it is not. */
  function renderDiff(){
    const row=$('#diffRow'); if(!row || !window.DIFF) return;
    const lbl=$('#mDiffLbl');
    if(lbl) lbl.textContent=t('DIFFICULTY — APPLIES TO EVERY MISSION');
    row.innerHTML='';
    DIFF.LEVELS.forEach(d=>{
      const b=document.createElement('button');
      b.className='diffbtn'+(d.id===DIFF.current?' on':'');
      b.style.setProperty('--a', d.a);
      b.innerHTML=`<span class="dem">${d.em}</span><b>${t(d.name)}</b><small>${t(d.blurb)}</small>`;
      b.onclick=()=>{ DIFF.set(d.id); renderDiff(); if(window.beep) beep('pop'); };
      row.appendChild(b);
    });
  }
  function labelOf(id){
    return ({tut:'Level 0 — Basics', race:'Circuit — Time Trial', nav:'Escape — Corridors',
             flight:'Mission 1 — Space Explorer', m1:'Mission 2 — Loops',
             m2:'Mission 3 — Choices', m3:'Mission 4 — Functions'})[id]||id;
  }

  /* the landing: a name and one button */
  function start(){
    G.running=false;
    CODE.close(); CODE.hideTape(); COMBAT.reset(); PUZZLE.stop(); NAV.stop(); TUTOR.stop(); RACE.stop(); if(window.FLIGHT) FLIGHT.stop();
    NET.disconnect(); CHAT.hide();
    $('#hud').classList.add('hidden');
    $('#done').classList.add('hidden');
    $('#quiz').classList.add('hidden');
    $('#cert').classList.add('hidden');
    $('#downed').classList.add('hidden');
    if(window.CHARS) CHARS.close();
    $('#btnStart').textContent=t('START');
    $('#sTag').textContent=t('THINK. CODE. CREATE.');
    const si=$('#sSignIn');
    if(si) si.textContent = NET.signedIn ? '👤 '+NET.nameOf() : t('Sign in / Create an account');
    if(document.pointerLockElement) document.exitPointerLock();
    show('#start', ()=>{ if(window.CHARS) CHARS.heroOpen(); });
  }
  /* The server browser. A fixed list, each showing how many people are
     standing in it right now, so a class can agree on one by looking. */
  let serverPoll=null;
  async function servers(){
    G.running=false;
    $('#hud').classList.add('hidden');
    if(window.CHARS) CHARS.heroClose();
    $('#svTitle').textContent=t('PICK A SERVER');
    $('#svSub').textContent=t('Anyone in the same server can see and talk to each other.');
    $('#svBack').textContent='◀';
    $('#svBack').onclick=()=>{ clearInterval(serverPoll); missions(); };
    show('#servers');
    await paintServers();
    clearInterval(serverPoll);
    serverPoll=setInterval(()=>{                     // keep the headcounts honest
      if($('#servers').classList.contains('hidden')) return clearInterval(serverPoll);
      paintServers();
    }, 4000);
  }
  /* ------------------------------------------------- how do you want to code
     The coding world is one world, entered two ways: on your own, or in a room
     with the class. The choice comes first because it changes who is standing
     next to you, not what you can build. */
  let mode='multi', mission=null;
  function modes(){
    G.running=false;
    $('#hud').classList.add('hidden');
    $('#mdTitle').textContent=t('HOW DO YOU WANT TO CODE?');
    $('#mdSub').textContent=t('The same world either way — the difference is who else is in it.');
    $('#mdBack').textContent='◀';
    const grid=$('#mdGrid');
    grid.innerHTML='';
    const card=(id,em,a,name,blurb,note)=>{
      const b=document.createElement('button');
      b.className='mis'; b.style.setProperty('--a',a);
      b.innerHTML=`<div class="em">${em}</div><b>${t(name)}</b><small>${t(blurb)}</small>
                   <div class="tagrow">${t(note)}</div>`;
      b.onclick=()=>{
        mode=id;
        if(id==='solo'){ mission=null; return enterServer(null); }
        // a shared room needs a name to put over your head
        if(!NET.signedIn) return auth();
        missions();
      };
      grid.appendChild(b);
    };
    card('multi','🌐','#a8e6cf','Multiplayer',
         'Walk around a shared world with your class. Everyone sees everyone\u2019s objects run.',
         'CHOOSE ▶');
    card('solo','👤','#cdb4f6','Single Player',
         'The same sandbox, on your own. Build anything, no mission, nobody watching.',
         'OPEN SANDBOX ▶');
    $('#mdBack').onclick=()=>open();
    show('#modes');
  }

  /* --------------------------------------------------------- mission select
     The finished missions are playable, the rest are shown anyway: a student
     should be able to see the road ahead, one idea per stop. */
  function missions(){
    $('#msTitle').textContent=t('PICK A MISSION');
    $('#msSub').textContent=t('Each one opens a few more blocks. Start at the top.');
    $('#msBack').textContent='◀';
    const grid=$('#msGrid'); grid.innerHTML='';
    MISSIONS.LIST.forEach(m=>{
      const b=document.createElement('button');
      const solved=MISSIONS.isDone(m.id);
      b.className='mis'+(m.soon?' soon':'')+(solved?' solved':'');
      b.style.setProperty('--a', m.a||'#8fd3ff');
      b.innerHTML=`<div class="mno">${t('MISSION')} ${m.n}</div>
        <div class="em">${m.em}</div><b>${t(m.name)}</b>
        <div><span class="teach">${t(m.teach)}</span></div>
        <small>${m.goal? t(m.goal) : t('Coming next.')}</small>
        <div class="tagrow">${m.soon? t('SOON') : solved? t('SOLVED — PLAY AGAIN ▶') : t('START ▶')}</div>`;
      if(!m.soon) b.onclick=()=>{ mission=m.id; servers(); };
      grid.appendChild(b);
    });
    const b=document.createElement('button');
    b.className='mis'; b.style.setProperty('--a','#cdb4f6');
    b.innerHTML=`<div class="em">🧩</div><b>${t('Sandbox')}</b>
      <small>${t('No mission and no limits — every block, and anything you want to build.')}</small>
      <div class="tagrow">${t('OPEN ▶')}</div>`;
    b.onclick=()=>{ mission=null; servers(); };
    grid.appendChild(b);
    $('#msBack').onclick=()=>modes();
    show('#missions');
  }

  /* No "is the screen visible" guard here: show() only drops the hidden class
     after its 200ms cross-fade, so the first paint would skip itself. Painting
     into a screen nobody is looking at is harmless; the poll stops on its own. */
  async function paintServers(){
    const row=$('#svGrid'); if(!row) return;
    const list=await NET.servers();
    row.innerHTML='';
    if(!list.length){
      row.innerHTML=`<p class="sub">${t('No servers right now — is the connection up?')}</p>`;
      return;
    }
    list.forEach(sv=>{
      const b=document.createElement('button');
      b.className='mis';
      b.style.setProperty('--a', sv.a||'#8fd3ff');
      const who = sv.count===1 ? t('1 person here') : t('{n} people here',{n:sv.count});
      b.innerHTML=`<div class="em">${sv.em||'🌐'}</div><b>${t(sv.name)}</b>
                   <small>${who}</small><div class="tagrow">${t('JOIN ▶')}</div>`;
      b.onclick=()=>{ clearInterval(serverPoll); enterServer(sv); };
      row.appendChild(b);
    });
  }
  /* THE HOMEWORLD.

     Signing in used to hand you a grid of cards. It hands you a planet now:
     the shared world if you have an account to share it with, and the same
     planet on your own if you are a guest. Nobody chooses a server first —
     you land on one and can move later. */
  let world=null;
  async function homeworld(){
    hideAll();
    $('#hud').classList.remove('hidden');
    G.running=true; G.stats.t0=performance.now();
    if(window.CHARS){ CHARS.close(); CHARS.heroClose(); }
    if(!world && NET.signedIn){
      try{ const list=await NET.servers(); world=(list&&list[0])||null; }catch(e){ world=null; }
    }
    PLANET.enter(NET.signedIn ? world : null);
  }
  function enterServer(sv){
    hideAll();
    $('#hud').classList.remove('hidden');
    G.running=true; G.stats.t0=performance.now();
    FREE.enter(sv, mission);
  }

  /* Sign-in is its own screen, and it is never in the way: START goes
     straight to the game as a guest. An account buys two things — progress
     that follows you to any machine, and Free Play. */
  function auth(){
    G.running=false;
    $('#hud').classList.add('hidden');
    if(window.CHARS) CHARS.heroClose();
    $('#aTitle').textContent=t('SIGN IN');
    $('#aSub').textContent=t('An account saves your progress on any computer and opens Free Play.');
    $('#tabIn').textContent=t('I have an account');
    $('#tabUp').textContent=t('Create an account');
    $('#btnIn').textContent=t('Sign in ▶');
    $('#btnUp').textContent=t('Create my account ▶');
    $('#btnGuest').textContent=t('Play as a guest');
    show('#auth');
  }
  /* who are you playing as */
  function chars(){
    G.running=false;
    $('#hud').classList.add('hidden');
    if(window.CHARS) CHARS.heroClose();
    show('#chars', ()=>{ if(window.CHARS) CHARS.open(); });
  }
  function open(){
    G.running=false;
    CODE.close(); CODE.hideTape(); COMBAT.reset(); PUZZLE.stop(); NAV.stop(); TUTOR.stop(); RACE.stop(); if(window.FLIGHT) FLIGHT.stop();
    NET.disconnect(); CHAT.hide();
    $('#hud').classList.add('hidden');
    $('#done').classList.add('hidden');
    $('#quiz').classList.add('hidden');
    $('#cert').classList.add('hidden');
    $('#downed').classList.add('hidden');
    if(window.CHARS){ CHARS.close(); CHARS.heroClose(); }
    if(document.pointerLockElement) document.exitPointerLock();
    render();
    show('#menu');
  }
  function launch(id){
    hideAll();
    $('#hud').classList.remove('hidden');
    G.running=true; G.stats.t0=performance.now();
    if(id==='free'){
      // on your own, or with the class? Guests have no class to join.
      hideAll(); $('#hud').classList.add('hidden');
      mission=null;
      return modes();
    }
    startMissionRoom(id);
    lockPointer($('#view'));
  }

  return { open, start, chars, auth, servers, modes, missions, render, renderChars,
           wireAuth, launch, hideAll, homeworld, labelOf };
})();

/* =====================================================================
   FREE PLAY — the one place the class shares a room
   ===================================================================== */
window.FREE = (function(){
  let others=new Map(), group=null;
  let ghosts=new Map();            // ownerId -> Map(objectId -> a copy of their object)
  let room=null;
  function enter(sv, missionId){
    room = sv || { id:null, name:'Workshop' };
    COMBAT.reset(); PUZZLE.stop(); NAV.stop(); TUTOR.stop(); RACE.stop(); if(window.FLIGHT) FLIGHT.stop();
    if(window.MISSIONS) MISSIONS.stop();
    G.missionId=null; G.arenaTitle=t(room.name);
    /* the room is what opens the project, so say which one before building it */
    const def = (missionId && window.MISSIONS) ? MISSIONS.get(missionId) : null;
    VM.useSlot(def && !def.soon ? MISSIONS.slotFor(def.id) : null);
    buildRoom('free');
    /* a mission furnishes the room and hands out its few blocks; without one
       this is the sandbox it has always been */
    const m = def ? MISSIONS.start(missionId) : null;
    group=new THREE.Group(); G.roomGroup.add(group);
    others.clear(); ghosts.clear(); sent.clear(); fullAt=0;
    if(window.OWN) OWN.clear();
    if(room.id) CHAT.show(); else CHAT.hide();
    if(room.id) NET.connect(room.id, {
      players:list=>paint(list),
      objs:m=>applyObjs(m),
      chat:m=>CHAT.line(m.from, m.text, m.id),
      sys:s=>CHAT.sys(s),
      clear:quiet=>CHAT.clear(quiet),   // a room switch is quiet; a teacher's clear is not
      unsay:id=>CHAT.remove(id)
    });
    if(m){
      MISSIONS.paint();
    } else {
      document.querySelector('#objList').innerHTML=
        `<li class="cur">🧩 ${t('Walk up to an object and press E to write its code')}</li>
         <li>${room.id? '🌐 '+t('Server')+': <b>'+t(room.name)+'</b>' : '👤 '+t('Just you')}</li>
         <li>${room.id? t('Press ENTER to chat') : t('Sign in to build alongside your class')}</li>`;
      document.querySelector('#missionName').textContent=t('Code Sandbox');
    }
    lockPointer(document.querySelector('#view'));
  }
  function tag(name){
    const c=document.createElement('canvas'); c.width=256; c.height=64;
    const x=c.getContext('2d');
    x.fillStyle='rgba(29,23,48,.85)'; x.fillRect(0,14,256,36);
    x.fillStyle='#a8e6cf'; x.font='bold 26px "Trebuchet MS",sans-serif'; x.textAlign='center';
    x.fillText(name.slice(0,16),128,42);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true}));
    s.scale.set(4,1,1); s.position.y=3.2; return s;
  }
  /* Presence lands about twelve times a second. Painting it straight onto the
     scene made everybody else move in visible steps, so what arrives is a
     TARGET and the frame loop eases towards it. */
  function paint(list){
    if(!group) return;
    const seen=new Set();
    list.forEach(p=>{
      seen.add(p.id);
      const yaw=p.yaw+Math.PI;
      let o=others.get(p.id);
      if(!o){
        const g=new THREE.Group();
        g.add(tag(p.display));
        g.position.set(p.x,0,p.z); g.rotation.y=yaw;
        group.add(g);
        o={ g, char:null, model:null, tx:p.x, tz:p.z, tyaw:yaw, speed:0, name:p.display };
        others.set(p.id,o);
      }
      o.name=p.display;                 // their objects are labelled from this
      if(p.char && o.char!==p.char){
        o.char=p.char;
        AVATAR.load(p.char).then(m=>{ if(o.model) o.g.remove(o.model); o.model=m; o.g.add(m); })
                           .catch(()=>{});
      }
      o.tx=p.x; o.tz=p.z; o.tyaw=yaw;
    });
    for(const [id,o] of others) if(!seen.has(id)){ group.remove(o.g); others.delete(id); }
    // whoever has left the room takes their objects with them
    for(const [owner,mine] of ghosts) if(!seen.has(owner)){
      for(const [,gh] of mine){ group.remove(gh.g); if(gh.plate) group.remove(gh.plate); }
      ghosts.delete(owner);
    }
  }

  /* ------------------------------------------------------------- objects
     Everybody's objects stand in everybody's room. They are RELAYED, not
     simulated twice: the machine that owns an object runs its scripts and
     says where it ended up, so a program cannot run differently on two
     screens. What arrives is a target, eased into like a player is. */
  function applyObjs(m){
    if(!group || !m || m.from==null || !window.VM) return;
    let mine=ghosts.get(m.from);
    if(!mine){ mine=new Map(); ghosts.set(m.from,mine); }
    const drop=id=>{ const gh=mine.get(id);
      if(gh){ group.remove(gh.g); if(gh.plate) group.remove(gh.plate); mine.delete(id); } };
    if(m.full){
      const keep=new Set((m.set||[]).map(o=>o.i));
      for(const id of [...mine.keys()]) if(!keep.has(id)) drop(id);
    }
    (m.del||[]).forEach(drop);
    (m.set||[]).forEach(o=>{
      const look=o.s+'|'+o.c+'|'+o.sz;
      let gh=mine.get(o.i);
      if(!gh || gh.look!==look){                    // a new object, or a new costume
        if(gh){ group.remove(gh.g); if(gh.plate) group.remove(gh.plate); }
        const g=VM.ghostMesh({ shape:o.s, colour:o.c, size:o.sz });
        g.position.set(o.x,o.y,o.z);
        g.rotation.set(o.tl*Math.PI/180, o.d*Math.PI/180, 0);
        group.add(g);
        gh={ g, look, sz:o.sz||1, plate:null, named:null }; mine.set(o.i,gh);
      }
      gh.sz=o.sz||1;
      gh.owner=m.from;
      gh.tx=o.x; gh.ty=o.y; gh.tz=o.z; gh.tdir=o.d; gh.ttilt=o.tl;
      gh.g.visible = o.v!==0;
    });
  }

  /* Ours, outwards. Only what actually changed goes on the wire — a room full
     of objects standing still costs nothing — with a full picture every few
     seconds so a dropped message cannot leave somebody's room wrong forever.

     This runs even when the world is frozen — typing in the chat, the pause
     menu, the instructions panel. Scripts keep stepping while you type, and
     a mission you have just walked out of is still the picture everybody
     else holds of you until you say otherwise: freeze the sharing and the
     room hands your old mission's objects to the next person who joins. */
  const stamp = a => [a.shape,a.colour,a.x.toFixed(2),a.y.toFixed(2),a.z.toFixed(2),
                      Math.round(a.dir),Math.round(a.tilt),(a.size||1).toFixed(2),
                      a.visible?1:0].join('|');
  let sent=new Map(), sentAt=0, fullAt=0;
  function shareObjects(){
    if(!NET.live || !window.VM) return;
    const now=performance.now();
    if(now-sentAt<200) return;
    sentAt=now;
    const full = now-fullAt>4000;
    if(full){ fullAt=now; sent.clear(); }
    const set=[], keep=new Set();
    VM.project.actors.slice(0,60).forEach(a=>{
      keep.add(a.id);
      const k=stamp(a);
      if(sent.get(a.id)===k) return;
      sent.set(a.id,k);
      set.push({ i:a.id, s:a.shape, c:a.colour,
                 x:+a.x.toFixed(2), y:+a.y.toFixed(2), z:+a.z.toFixed(2),
                 d:Math.round(a.dir), tl:Math.round(a.tilt),
                 sz:+(a.size||1).toFixed(2), v:a.visible?1:0 });
    });
    const del=[];
    for(const id of [...sent.keys()]) if(!keep.has(id)){ del.push(id); sent.delete(id); }
    if(set.length || del.length || full) NET.objs({ full, set, del });
  }

  /* Ease towards the last known spot, a fixed fraction of the remaining gap per
     second so it looks the same on a fast machine and a slow one — except when
     somebody is a room away, where gliding across the floor would be a lie. */
  function smooth(dt){
    const k = 1 - Math.pow(0.0008, Math.min(dt,0.1));
    for(const [,o] of others){
      const dx=o.tx-o.g.position.x, dz=o.tz-o.g.position.z;
      if(Math.hypot(dx,dz) > 12){ o.g.position.set(o.tx,0,o.tz); o.g.rotation.y=o.tyaw; o.speed=0; continue; }
      o.g.position.x += dx*k;
      o.g.position.z += dz*k;
      let d=o.tyaw-o.g.rotation.y;
      d=Math.atan2(Math.sin(d),Math.cos(d));          // turn the short way round
      o.g.rotation.y += d*k;
      // how fast they are actually travelling, smoothed, so the legs match
      const v=Math.hypot(dx,dz)/Math.max(dt,0.001);
      o.speed += (v-o.speed)*Math.min(1,dt*8);
      if(o.model) AVATAR.animate(o.model, dt,
        o.speed>3.2 ? 'sprint' : o.speed>0.35 ? 'walk' : 'idle');
    }
    /* Their objects wear their name.  Four people on the same mission means
       four identical balls on one floor, and the only thing telling them
       apart is this — so it is placed here rather than parented to the
       object, which turns and tilts and would take the label with it. */
    for(const [owner,mine] of ghosts) for(const [,gh] of mine){
      const who=nameOf(owner);
      if(gh.named!==who){
        if(gh.plate) group.remove(gh.plate);
        gh.plate = window.OWN ? OWN.plate(who, OWN.THEIRS) : null;
        if(gh.plate) group.add(gh.plate);
        gh.named=who;
      }
      const p=gh.g.position;
      if(Math.hypot(gh.tx-p.x, gh.ty-p.y, gh.tz-p.z) > 12){
        p.set(gh.tx,gh.ty,gh.tz);
      } else {
        p.x+=(gh.tx-p.x)*k; p.y+=(gh.ty-p.y)*k; p.z+=(gh.tz-p.z)*k;
      }
      const want=gh.tdir*Math.PI/180;
      let d=want-gh.g.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d));
      gh.g.rotation.y += d*k;
      gh.g.rotation.x = gh.ttilt*Math.PI/180;
      if(gh.plate){
        const sz=Math.max(0.6, gh.sz||1);
        gh.plate.position.set(p.x, p.y + sz*0.6 + 0.95, p.z);
        gh.plate.visible = gh.g.visible &&
          (!window.OWN || OWN.dist(p.x,p.z) < OWN.NEAR);
      }
    }
  }
  /* a name may land after the objects it belongs to, so this is asked every
     frame rather than baked in when the object first appears */
  const nameOf = id => { const o=others.get(id); return (o && o.name) || t('Classmate'); };

  let last=0;
  function tick(dt){
    if(G.room!=='free') return;
    smooth(dt||0.016);
    if(!NET.live) return;
    const now=performance.now();
    if(now-last<90) return;
    last=now; NET.pos(+G.pos.x.toFixed(2), +G.pos.z.toFixed(2), +G.yaw.toFixed(2), AVATAR.chosen);
  }
  /* move to another mission without leaving the room or the people in it */
  function go(missionId){ enter(room, missionId); }
  return { enter, go, tick, share:shareObjects, get count(){ return others.size; } };
})();

/* =====================================================================
   CHAT — typed, rate limited on the server, watched by the teacher panel
   ===================================================================== */
window.CHAT = (function(){
  const $=s=>document.querySelector(s);
  let open=false;
  function show(){
    $('#chat').classList.remove('hidden'); open=true;
    $('#chatHint').textContent=t('Enter to type · Esc to close · your teacher can see this chat');
    $('#chatForm').onsubmit=e=>{
      e.preventDefault();
      const v=$('#chatIn').value.trim();
      if(v){ NET.say(v); $('#chatIn').value=''; }
      $('#chatIn').blur(); lockPointer($('#view'));
    };
  }
  function hide(){ $('#chat').classList.add('hidden'); open=false; $('#chatLog').innerHTML=''; }
  function focus(){
    if(!open) return;
    if(document.pointerLockElement) document.exitPointerLock();
    $('#chatIn').focus();
  }
  function line(from,text,id){
    const d=document.createElement('div');
    d.className='m'; if(id) d.dataset.id=id;
    d.innerHTML='<b>'+esc(from)+':</b> '+esc(text);
    push(d);
  }
  function sys(text){
    const d=document.createElement('div'); d.className='sys'; d.textContent=text; push(d);
  }
  function push(d){
    const log=$('#chatLog'); log.appendChild(d);
    while(log.children.length>60) log.removeChild(log.firstChild);
    log.scrollTop=log.scrollHeight;
  }
  function remove(id){ const el=$(`#chatLog .m[data-id="${id}"]`); if(el) el.remove(); }
  function clear(quiet){ $('#chatLog').innerHTML=''; if(!quiet) sys(t('Your teacher cleared the chat.')); }
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  return { show, hide, focus, line, sys, clear, remove, get open(){ return open; } };
})();
