/* =====================================================================
   MENU — sign-in, mission select, and the free-play yard with chat.
   This replaces the old Linux-desktop hub: missions are chosen from a
   card grid, and Free Play is the only place other students appear.
   ===================================================================== */
window.MENU = (function(){
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];

  /* One screen hands over to the next with a short cross-fade, so a student
     always sees where they came from and where they landed. */
  const SCREENS=['#start','#chars','#menu'];
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

  const MISSIONS=[
    {id:'tut',   em:'🎮', a:'#ffe9a8', name:'Level 0 — Basics',
     blurb:'Practice. Walk, look, jump, open the console, run a program. Nothing chases you.'},
    {id:'nav',   em:'🧟', a:'#8fd3ff', name:'Escape — Corridors',
     blurb:'Learn to code by getting out alive. It never stops walking.'},
    {id:'m1',    em:'🧟', a:'#a8e6cf', name:'Mission 1 — Loops',
     blurb:'Commands and loops. Beat THE LOOPER with repeat.'},
    {id:'m2',    em:'🔮', a:'#cdb4f6', name:'Mission 2 — Choices',
     blurb:'if / else. PRISM changes colour every two seconds.'},
    {id:'m3',    em:'🧮', a:'#ffb4a2', name:'Mission 3 — Functions',
     blurb:'define combo. OFF-BY-ONE always has one more.'}
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
        ['#inUser','#inPass','#upCode','#upUser','#upName','#upPass','#btnIn','#btnUp']
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
        await NET.register({ classCode:$('#upCode').value.trim(), username:$('#upUser').value.trim(),
                             display:$('#upName').value.trim(), password:$('#upPass').value });
        afterSignIn();
      }catch(err){ authMsg(err.message); }
    };
    const guest=$('#btnGuest'); if(guest) guest.onclick=()=>{ open(); };
    const st=$('#btnStart'); if(st) st.onclick=()=>chars();
    const cb=$('#cBack');    if(cb) cb.onclick=()=>start();
    const cg=$('#cGo');      if(cg) cg.onclick=()=>{ if(window.CHARS) CHARS.close(); open(); };
    const mc=$('#mChar');    if(mc) mc.onclick=()=>chars();
    const out=$('#mOut'); if(out) out.onclick=async()=>{ await NET.logout(); location.reload(); };
    $('#mLang').onclick=()=>setLang(window.LANG==='en'?'es':'en');
  }
  function afterSignIn(){
    const u=NET.me;
    if(u && u.progress) PROGRESS.load(u.progress);
    open();
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
    MISSIONS.forEach(m=>{
      const open_ = PROGRESS.unlocked(m.id);
      const done  = PROGRESS.isDone(m.id);
      const b=document.createElement('button');
      b.className='mis'+(open_?'':' locked')+(done?' done':'');
      b.style.setProperty('--a', m.a||'#8fd3ff');
      // level 0 is practice: it never locks, and finishing it invites a replay
      // rather than closing the door with a COMPLETE stamp
      const tag = !open_ ? '🔒 '+t('Finish {m} first',{m:t(labelOf(PROGRESS.needs(m.id)))})
                : done ? (m.id==='tut' ? '⭐ '+t('PRACTISE AGAIN ▶') : '⭐ '+t('COMPLETE'))
                : t('PLAY ▶');
      b.innerHTML=`<div class="em">${m.em}</div><b>${t(m.name)}</b>
                   <small>${t(m.blurb)}</small><div class="tagrow">${tag}</div>`;
      b.onclick=()=>{ if(!open_) return; launch(m.id); };
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
    return ({tut:'Level 0 — Basics', nav:'Escape — Corridors', m1:'Mission 1 — Loops',
             m2:'Mission 2 — Choices', m3:'Mission 3 — Functions'})[id]||id;
  }

  /* the landing: a name and one button */
  function start(){
    G.running=false;
    CODE.close(); CODE.hideTape(); COMBAT.reset(); PUZZLE.stop(); NAV.stop(); TUTOR.stop();
    NET.disconnect(); CHAT.hide();
    $('#hud').classList.add('hidden');
    $('#done').classList.add('hidden');
    $('#quiz').classList.add('hidden');
    $('#cert').classList.add('hidden');
    $('#downed').classList.add('hidden');
    if(window.CHARS) CHARS.close();
    $('#btnStart').textContent=t('START');
    $('#sTag').textContent=t('THINK. CODE. CREATE.');
    if(document.pointerLockElement) document.exitPointerLock();
    show('#start', ()=>{ if(window.CHARS) CHARS.heroOpen(); });
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
    CODE.close(); CODE.hideTape(); COMBAT.reset(); PUZZLE.stop(); NAV.stop(); TUTOR.stop();
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
    if(id==='free') return FREE.enter();
    startMissionRoom(id);
    lockPointer($('#view'));
  }

  return { open, start, chars, render, renderChars, wireAuth, launch, hideAll };
})();

/* =====================================================================
   FREE PLAY — the one place the class shares a room
   ===================================================================== */
window.FREE = (function(){
  let others=new Map(), group=null;
  function enter(){
    COMBAT.reset(); PUZZLE.stop();
    G.missionId=null; G.arenaTitle='Free Play';
    buildRoom('free');
    group=new THREE.Group(); G.roomGroup.add(group);
    others.clear();
    CHAT.show();
    NET.connect({
      players:list=>paint(list),
      chat:m=>CHAT.line(m.from, m.text, m.id),
      sys:s=>CHAT.sys(s),
      clear:()=>CHAT.clear(),
      unsay:id=>CHAT.remove(id)
    });
    document.querySelector('#objList').innerHTML=
      `<li class="cur">🌐 ${t('Free play — practise anything')}</li>
       <li>${t('Press ENTER to chat')}</li>
       <li>${t('Press P for the pause menu')}</li>`;
    document.querySelector('#missionName').textContent=t('Free Play');
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
  function paint(list){
    if(!group) return;
    const seen=new Set();
    list.forEach(p=>{
      seen.add(p.id);
      let o=others.get(p.id);
      if(!o){
        const g=new THREE.Group();
        g.add(tag(p.display));
        group.add(g); o={g, char:null}; others.set(p.id,o);
      }
      if(p.char && o.char!==p.char){
        o.char=p.char;
        AVATAR.load(p.char).then(m=>{ if(o.model) o.g.remove(o.model); o.model=m; o.g.add(m); })
                           .catch(()=>{});
      }
      o.g.position.set(p.x,0,p.z);
      o.g.rotation.y=p.yaw+Math.PI;
    });
    for(const [id,o] of others) if(!seen.has(id)){ group.remove(o.g); others.delete(id); }
  }
  let last=0;
  function tick(){
    if(G.room!=='free' || !NET.live) return;
    const now=performance.now();
    if(now-last<90) return;
    last=now; NET.pos(+G.pos.x.toFixed(2), +G.pos.z.toFixed(2), +G.yaw.toFixed(2), AVATAR.chosen);
  }
  return { enter, tick, get count(){ return others.size; } };
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
  function clear(){ $('#chatLog').innerHTML=''; sys(t('Your teacher cleared the chat.')); }
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  return { show, hide, focus, line, sys, clear, remove, get open(){ return open; } };
})();
