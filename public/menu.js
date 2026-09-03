/* =====================================================================
   MENU — sign-in, mission select, and the free-play yard with chat.
   This replaces the old Linux-desktop hub: missions are chosen from a
   card grid, and Free Play is the only place other students appear.
   ===================================================================== */
window.MENU = (function(){
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];

  const MISSIONS=[
    {id:'range', em:'🎯', name:'Firing Range',  blurb:'Warm up your aim. No code, just targets and a clock.'},
    {id:'m1',    em:'🐛', name:'Mission 1 — Loops',      blurb:'Commands and loops. Beat THE LOOPER with repeat.'},
    {id:'m2',    em:'🔮', name:'Mission 2 — Choices',    blurb:'if / else. PRISM changes colour every two seconds.'},
    {id:'m3',    em:'🧮', name:'Mission 3 — Functions',  blurb:'define combo. OFF-BY-ONE always has one more.'},
    {id:'free',  em:'🌐', name:'Free Play',    blurb:'Your whole class, one room. Practise and chat together.'}
  ];

  /* ------------------------------------------------------- auth screen */
  function authMsg(text, good){
    const el=$('#authMsg'); el.textContent=text||''; el.classList.toggle('good',!!good);
  }
  async function wireAuth(){
    // say plainly when accounts are not connected instead of failing on submit
    const up = await NET.health();
    if(!up){
      $('#authMsg').textContent = t('Sign-in is not connected yet — you can still play as a guest.');
      ['#inUser','#inPass','#upCode','#upUser','#upName','#upPass'].forEach(sel=>{
        const el=$(sel); if(el) el.disabled=true;
      });
      $('#btnIn').disabled=true; $('#btnUp').disabled=true;
    }
    $$('.tab').forEach(b=>b.onclick=()=>{
      $$('.tab').forEach(x=>x.classList.toggle('on',x===b));
      $('#formIn').classList.toggle('hidden', b.dataset.tab!=='in');
      $('#formUp').classList.toggle('hidden', b.dataset.tab!=='up');
      authMsg('');
    });
    $('#formIn').onsubmit=async e=>{
      e.preventDefault(); authMsg(t('Signing in…'));
      try{
        await NET.login($('#inUser').value.trim(), $('#inPass').value);
        afterSignIn();
      }catch(err){ authMsg(err.message); }
    };
    $('#formUp').onsubmit=async e=>{
      e.preventDefault(); authMsg(t('Creating your account…'));
      try{
        await NET.register({ classCode:$('#upCode').value.trim(), username:$('#upUser').value.trim(),
                             display:$('#upName').value.trim(), password:$('#upPass').value });
        afterSignIn();
      }catch(err){ authMsg(err.message); }
    };
    $('#btnGuest').onclick=()=>{ open(); };
    $('#mOut').onclick=async()=>{ await NET.logout(); location.reload(); };
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
    $('#mTitle').textContent=t('Mission: Linux');
    $('#mWho').textContent = NET.signedIn
      ? t('Signed in as {n}',{n:NET.me.display})
      : t('Playing as a guest — progress will not be saved');
    $('#mOut').textContent = NET.signedIn ? t('Sign out') : t('Sign in');
    $('#mHint').textContent = t('Finish a mission to unlock the next one.');
    renderChars();
    grid.innerHTML='';
    MISSIONS.forEach(m=>{
      const open_ = m.id==='free' ? NET.signedIn : PROGRESS.unlocked(m.id);
      const done  = PROGRESS.isDone(m.id);
      const b=document.createElement('button');
      b.className='mis'+(open_?'':' locked')+(done?' done':'');
      const tag = m.id==='free'
        ? (NET.signedIn? t('MULTIPLAYER'): t('SIGN IN TO PLAY'))
        : (!open_ ? '🔒 '+t('Finish {m} first',{m:t(labelOf(PROGRESS.needs(m.id)))})
                  : done ? '⭐ '+t('COMPLETE') : t('READY'));
      b.innerHTML=`<div class="em">${m.em}</div><b>${t(m.name)}</b>
                   <small>${t(m.blurb)}</small><div class="tagrow">${tag}</div>`;
      b.onclick=()=>{ if(!open_) return; launch(m.id); };
      grid.appendChild(b);
    });
  }
  function renderChars(){
    const row=$('#charRow'); if(!row) return;
    $('#charLbl').textContent=t('YOUR CHARACTER');
    $('#charHint').textContent=t('Pick who you play as. Everyone in Free Play sees them.');
    row.innerHTML=AVATAR.CHARS.map(c=>
      `<button class="chr${c.id===AVATAR.chosen?' on':''}" data-c="${c.id}" title="${c.name}">
         <img src="${c.preview}" alt="${c.name}" loading="lazy">
       </button>`).join('');
    row.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{
      AVATAR.pick(b.dataset.c); renderChars();
    });
  }
  function labelOf(id){
    return ({m1:'Mission 1 — Loops', m2:'Mission 2 — Choices',
             m3:'Mission 3 — Functions'})[id]||id;
  }

  function open(){
    G.running=false;
    CODE.close(); CODE.hideTape(); COMBAT.reset(); PUZZLE.stop();
    NET.disconnect(); CHAT.hide();
    $('#hud').classList.add('hidden');
    $('#done').classList.add('hidden');
    $('#downed').classList.add('hidden');
    $('#start').classList.add('hidden');
    $('#menu').classList.remove('hidden');
    if(document.pointerLockElement) document.exitPointerLock();
    render();
  }
  function launch(id){
    $('#menu').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    G.running=true; G.stats.t0=performance.now();
    if(id==='free') return FREE.enter();
    startMissionRoom(id);
    lockPointer($('#view'));
  }

  return { open, render, renderChars, wireAuth, launch };
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
