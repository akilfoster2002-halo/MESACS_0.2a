/* =====================================================================
   PHONE — everybody has one. It is where talking happens now.

   Two kinds of conversation live on it:

   TEXTS, to anybody, by username. They go to the server as ordinary
   requests and are kept there, so a text sent to somebody who is not
   signed in is waiting for them when they are — that is the whole point
   of a text. The live site is serverless and cannot hold a socket, so the
   phone asks for news every few seconds; where there IS a socket, the
   server also pushes the text at once (NET hands it to buzz()).

   NEARBY, which is the room chat that used to be the box in the corner:
   whoever is on this server with you, nothing kept, gone when the room
   empties. It is the same CHAT the rest of the game has always talked to —
   show, hide, line, sys, clear, remove — so nothing that says something
   in the room had to change. It just says it into the phone.

   Both are watched: the room chat by the teacher panel as it always was,
   and texts by the teacher's new list of them. The phone says so on every
   screen, because a child should know who can read what they write.
   ===================================================================== */
window.PHONE = (function(){
  const $ = s => document.querySelector(s);
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let built=false, open=false, screen='list', withUser=null;
  let threads=[], unread=0, lastSeenId=0, nearbyOn=false, nearbyNew=0;
  let pollT=null, threadT=null;

  async function api(path, body){
    const r = await fetch('/api'+path, {
      method: body?'POST':'GET', headers:{ 'Content-Type':'application/json' },
      credentials:'same-origin', body: body?JSON.stringify(body):undefined });
    let j={}; try{ j=await r.json(); }catch(e){ j={ ok:false, error:'Server did not answer' }; }
    if(!r.ok || !j.ok) throw new Error(j.error || ('Error '+r.status));
    return j;
  }
  const signedIn = () => !!(window.NET && NET.me);
  const ago = at => {
    const s=Math.max(0,(Date.now()-new Date(at).getTime())/1000);
    if(s<60) return t('now'); if(s<3600) return Math.floor(s/60)+'m';
    if(s<86400) return Math.floor(s/3600)+'h'; return Math.floor(s/86400)+'d';
  };

  /* ------------------------------------------------------------ building */
  function build(){
    if(built) return; built=true;
    const btn=document.createElement('button');
    btn.id='phoneBtn'; btn.className='hidden'; btn.title=t('Phone (T)');
    btn.innerHTML='<span class="ph-ico">📱</span><b class="ph-badge hidden">0</b>';
    btn.onclick=()=>toggle();
    document.body.appendChild(btn);

    const ph=document.createElement('div');
    ph.id='phone'; ph.className='hidden';
    ph.innerHTML=`
      <div class="ph-bar"><span class="ph-time"></span><span class="ph-notch"></span><span>📶 🔋</span></div>
      <div class="ph-screen"></div>
      <form id="chatForm" class="ph-compose hidden">
        <input id="chatIn" maxlength="240" autocomplete="off">
        <button class="ph-send" id="chatSend" aria-label="Send">➤</button>
      </form>
      <div class="ph-foot" id="chatHint"></div>
      <div class="ph-home"><button type="button" class="ph-homebtn" aria-label="Close"></button></div>`;
    document.body.appendChild(ph);
    ph.querySelector('.ph-homebtn').onclick=()=>close();
    $('#chatForm').onsubmit=e=>{ e.preventDefault(); sendTyped(); };
    // typing in the phone is typing, not walking: keep the keys off the game
    ph.addEventListener('keydown', e=>{ if(e.code==='Escape'){ e.preventDefault(); close(); } e.stopPropagation(); });

    const toast=document.createElement('div');
    toast.id='phoneToast'; toast.className='hidden';
    toast.onclick=()=>{ hideToast(); if(toast.dataset.user) openThread(toast.dataset.user); };
    document.body.appendChild(toast);

    setInterval(()=>{ const el=ph.querySelector('.ph-time');
      if(el){ const d=new Date(); el.textContent=d.getHours()+':'+String(d.getMinutes()).padStart(2,'0'); } }, 1000);
  }

  /* ---------------------------------------------------------- showing it */
  function toggle(){ open ? close() : show(); }
  function show(where){
    build();
    open=true;
    $('#phone').classList.remove('hidden');
    if(document.pointerLockElement) document.exitPointerLock();
    if(where==='nearby') openNearby(); else if(screen==='thread' && withUser) openThread(withUser); else list();
  }
  function close(){
    open=false; clearInterval(threadT); threadT=null;
    if($('#phone')) $('#phone').classList.add('hidden');
    const i=$('#chatIn'); if(i) i.blur();
    if(typeof G!=='undefined' && G.running && window.lockPointer){ const v=$('#view'); if(v) lockPointer(v); }
  }
  function compose(on, placeholder){
    const f=$('#chatForm'); f.classList.toggle('hidden', !on);
    if(on){ $('#chatIn').placeholder=placeholder||t('Message'); }
  }
  function foot(txt){ $('#chatHint').textContent=txt; }

  /* The list: Nearby first when you are in a room, then every conversation. */
  async function list(){
    screen='list'; withUser=null; clearInterval(threadT); threadT=null;
    const sc=$('#phone .ph-screen');
    compose(false);
    foot(t('Your teacher can see your messages.'));
    if(!signedIn()){
      sc.innerHTML=`<div class="ph-head"><b>${t('Messages')}</b></div>
        <div class="ph-empty">📱<br>${t('Sign in to text your classmates.')}</div>
        ${nearbyOn ? nearbyRow() : ''}`;
      wireNearby(sc); return;
    }
    sc.innerHTML=`<div class="ph-head"><b>${t('Messages')}</b>
        <button type="button" class="ph-new">✏️ ${t('New')}</button></div>
      ${nearbyOn ? nearbyRow() : ''}<div class="ph-threads"><div class="ph-empty">${t('Loading…')}</div></div>`;
    sc.querySelector('.ph-new').onclick=()=>newMessage();
    wireNearby(sc);
    try{
      threads=(await api('/phone/threads')).threads||[];
    }catch(e){ threads=[]; }
    if(screen!=='list') return;
    const box=sc.querySelector('.ph-threads');
    box.innerHTML = threads.length ? threads.map(th=>`
      <button type="button" class="ph-th${th.unread?' unread':''}" data-u="${esc(th.username)}">
        <span class="ph-av">${esc((th.display||th.username)[0]||'?').toUpperCase()}</span>
        <span class="ph-mid"><b>${esc(th.display)}</b><small>@${esc(th.username)}</small>
          <i>${th.lastMine?t('You')+': ':''}${esc(th.last)}</i></span>
        <span class="ph-meta">${ago(th.at)}${th.unread?`<em>${th.unread}</em>`:''}</span>
      </button>`).join('')
      : `<div class="ph-empty">${t('No messages yet.')}<br>${t('Tap ✏️ New to text somebody by their username.')}</div>`;
    box.querySelectorAll('.ph-th').forEach(b=>b.onclick=()=>openThread(b.dataset.u));
    refreshBadge();
  }
  function nearbyRow(){
    return `<button type="button" class="ph-th ph-nearby${nearbyNew?' unread':''}">
      <span class="ph-av">📡</span>
      <span class="ph-mid"><b>${t('Nearby')}</b><i>${t('Everyone on this server')}</i></span>
      <span class="ph-meta">${nearbyNew?`<em>${nearbyNew}</em>`:''}</span></button>`;
  }
  function wireNearby(sc){ const n=sc.querySelector('.ph-nearby'); if(n) n.onclick=()=>openNearby(); }

  /* A new conversation: who to? Usernames come up as you type. */
  function newMessage(){
    screen='new';
    const sc=$('#phone .ph-screen');
    compose(false);
    sc.innerHTML=`<div class="ph-head"><button type="button" class="ph-back">‹</button><b>${t('New message')}</b></div>
      <label class="ph-to">${t('To:')} <span>@</span><input class="ph-who" maxlength="20" autocomplete="off"
        placeholder="${t('username')}"></label>
      <div class="ph-found"></div><div class="ph-err"></div>`;
    sc.querySelector('.ph-back').onclick=()=>list();
    const inp=sc.querySelector('.ph-who'), found=sc.querySelector('.ph-found');
    let seq=0;
    inp.oninput=async()=>{
      const q=inp.value.trim().toLowerCase(), mine=++seq;
      if(q.length<2){ found.innerHTML=''; return; }
      let people=[]; try{ people=(await api('/phone/find?q='+encodeURIComponent(q))).people||[]; }catch(e){}
      if(mine!==seq) return;
      found.innerHTML=people.map(p=>`<button type="button" class="ph-pick" data-u="${esc(p.username)}">
        <b>${esc(p.display)}</b> <small>@${esc(p.username)}</small></button>`).join('')
        || `<div class="ph-empty small">${t('Nobody with a username starting “{q}”.',{q:esc(q)})}</div>`;
      found.querySelectorAll('.ph-pick').forEach(b=>b.onclick=()=>openThread(b.dataset.u));
    };
    inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); const u=inp.value.trim(); if(u) openThread(u); } };
    setTimeout(()=>inp.focus(), 30);
  }

  /* One conversation. It asks again every few seconds while it is open, so
     a reply turns up without anybody pressing anything. */
  async function openThread(user){
    build();
    if(!open){ open=true; $('#phone').classList.remove('hidden');
               if(document.pointerLockElement) document.exitPointerLock(); }
    user=String(user).toLowerCase().replace(/^@/,'');
    screen='thread'; withUser=user;
    const sc=$('#phone .ph-screen');
    sc.innerHTML=`<div class="ph-head"><button type="button" class="ph-back">‹</button>
      <b class="ph-name">@${esc(user)}</b></div><div class="ph-msgs"></div><div class="ph-err"></div>`;
    sc.querySelector('.ph-back').onclick=()=>list();
    compose(true, t('Text @{u}',{u:user}));
    foot(t('Your teacher can see your messages.'));
    setTimeout(()=>$('#chatIn').focus(), 30);
    await loadThread(true);
    clearInterval(threadT);
    threadT=setInterval(()=>{ if(open && screen==='thread' && withUser===user) loadThread(false); }, 4000);
  }
  async function loadThread(first){
    const user=withUser; if(!user) return;
    const sc=$('#phone .ph-screen'), box=sc.querySelector('.ph-msgs');
    let r;
    try{ r=await api('/phone/thread/'+encodeURIComponent(user)); }
    catch(e){
      if(first && box) box.innerHTML=`<div class="ph-empty">${esc(t(e.message))}</div>`;
      if(first) compose(false);
      return;
    }
    if(withUser!==user || screen!=='thread') return;
    sc.querySelector('.ph-name').innerHTML=`${esc(r.with.display)} <small>@${esc(r.with.username)}</small>`;
    const atBottom = box.scrollTop+box.clientHeight >= box.scrollHeight-20;
    box.innerHTML = r.messages.length ? r.messages.map(m=>`<div class="ph-bub${m.mine?' me':''}">${esc(m.text)}
        <small>${ago(m.at)}</small></div>`).join('')
      : `<div class="ph-empty">${t('Say hello to {n}!',{n:esc(r.with.display)})}</div>`;
    if(first || atBottom) box.scrollTop=box.scrollHeight;
    refreshBadge();
  }

  /* Nearby: the room chat. Kept in the phone's memory only, like it always
     was — and emptied when the room goes. */
  const nearbyLog=[];
  function openNearby(){
    screen='nearby'; withUser=null; nearbyNew=0; clearInterval(threadT); threadT=null;
    const sc=$('#phone .ph-screen');
    sc.innerHTML=`<div class="ph-head"><button type="button" class="ph-back">‹</button>
      <b>📡 ${t('Nearby')}</b></div><div class="ph-msgs ph-room"></div>`;
    sc.querySelector('.ph-back').onclick=()=>list();
    compose(true, t('Say something to everyone here'));
    foot(t('Everyone on this server sees this — and so does your teacher.'));
    paintNearby();
    refreshBadge();
    setTimeout(()=>$('#chatIn').focus(), 30);
  }
  function paintNearby(){
    const box=$('#phone .ph-room'); if(!box) return;
    box.innerHTML=nearbyLog.map(x=>x.sys
      ? `<div class="ph-sys">${esc(x.text)}</div>`
      : `<div class="ph-bub${x.mine?' me':''}" data-id="${x.id||''}"><b>${esc(x.from)}</b> ${esc(x.text)}</div>`).join('');
    box.scrollTop=box.scrollHeight;
  }
  function nearbyPush(x){
    nearbyLog.push(x); while(nearbyLog.length>60) nearbyLog.shift();
    if(open && screen==='nearby') paintNearby();
    else if(!x.sys && !x.history){ nearbyNew++; refreshBadge(); }
  }

  async function sendTyped(){
    const inp=$('#chatIn'), text=inp.value.trim();
    if(!text) return;
    if(screen==='nearby'){
      if(window.NET) NET.say(text);
      inp.value=''; return;
    }
    if(screen!=='thread' || !withUser) return;
    const err=$('#phone .ph-err');
    inp.value='';
    try{
      await api('/phone/send', { to:withUser, text });
      if(err) err.textContent='';
      if(window.beep) beep('pop');
      loadThread(true);
    }catch(e){
      inp.value=text;
      if(err) err.textContent=t(e.message);
    }
  }

  /* ------------------------------------------------------- the badge
     Red count on the phone button for unread texts; a dot for room chat
     you have not looked at. A text that is NEW since the last look also
     slides in at the top of the screen and makes a sound. */
  async function poll(){
    if(!signedIn()) { unread=0; refreshBadge(); return; }
    let r; try{ r=await api('/phone/unread'); }catch(e){ return; }
    const was=unread; unread=r.count||0;
    const l=r.latest;
    if(l && l.id>lastSeenId){
      if(lastSeenId && !(open && screen==='thread' && withUser===l.username)) notify(l.display, l.username, l.text);
      lastSeenId=l.id;
    }
    if(open && screen==='list' && unread!==was) list();
    refreshBadge();
  }
  function refreshBadge(){
    const b=$('#phoneBtn .ph-badge'); if(!b) return;
    if(unread>0){ b.textContent=unread>9?'9+':unread; b.classList.remove('hidden','dot'); }
    else if(nearbyNew>0){ b.textContent=''; b.classList.remove('hidden'); b.classList.add('dot'); }
    else b.classList.add('hidden');
    $('#phoneBtn').classList.toggle('ring', unread>0);
  }
  let toastT=null;
  function notify(display, username, text){
    build();
    const el=$('#phoneToast');
    el.dataset.user=username;
    el.innerHTML=`<span>💬</span><div><b>${esc(display)}</b> <small>@${esc(username)}</small><i>${esc(text)}</i></div>`;
    el.classList.remove('hidden');
    clearTimeout(toastT); toastT=setTimeout(hideToast, 5000);
    if(window.beep) beep('pop');
  }
  function hideToast(){ const el=$('#phoneToast'); if(el) el.classList.add('hidden'); }
  /* A push from the socket: do not wait for the next look. */
  function buzz(){ poll(); if(open && screen==='thread') loadThread(false); }

  /* The phone button is there whenever the game is — signed in or not, a
     guest is told why theirs is quiet. Checked on a timer rather than wired
     into every room change: it is one class toggle. */
  function start(){
    build();
    if(pollT) return;
    pollT=setInterval(()=>{
      const coder=$('#coder');
      /* G is a top-level const in game.js: a global NAME, not a property of
         window, so window.G is always undefined — ask for the name instead */
      const game = typeof G!=='undefined' ? G : null;
      const inGame = !!game && (game.running || open) && !document.querySelector('.screen:not(.hidden)')
                     && !(coder && !coder.classList.contains('hidden'));
      $('#phoneBtn').classList.toggle('hidden', !inGame);
      if(!inGame && open) close();
    }, 500);
    setInterval(poll, 12000);
    setTimeout(poll, 1500);
  }

  /* ------------------------------------------------ the old CHAT, kept
     Same six calls, landing in Nearby. `open` still means "there is a room
     chat to type into", which is what game.js asks before Enter opens it. */
  window.CHAT = {
    show(){ build(); nearbyOn=true; if(open && screen==='list') list(); },
    hide(){ nearbyOn=false; nearbyLog.length=0; nearbyNew=0; refreshBadge();
            if(open && screen==='nearby') list(); },
    focus(){ if(nearbyOn) show('nearby'); },
    line(from, text, id){ nearbyPush({ from, text, id, mine: !!(window.NET && NET.me && from===NET.me.display) }); },
    sys(text){ nearbyPush({ sys:true, text }); },
    clear(quiet){ nearbyLog.length=0; nearbyNew=0;
                  if(!quiet) nearbyPush({ sys:true, text:t('Your teacher cleared the chat.') });
                  else if(open && screen==='nearby') paintNearby(); refreshBadge(); },
    remove(id){ const i=nearbyLog.findIndex(x=>String(x.id)===String(id));
                if(i>=0){ nearbyLog.splice(i,1); if(open && screen==='nearby') paintNearby(); } },
    get open(){ return nearbyOn; }
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  return { show, close, toggle, openThread, buzz, poll,
           get open(){ return open; }, get unread(){ return unread; } };
})();
