/* =====================================================================
   CHAT ROOMS — the list: yours, the ones you were let into, the ones you
   have been in, and anything you can find by name.

   THE SERVER DECIDES EVERYTHING. Who owns a room, who may walk into one,
   how many you may have: every one of those questions is asked of
   server/chatrooms.js and the answer is the server's sentence, shown as it
   was written — it is meant to be read by the person who was refused, and a
   message invented here would only be a worse version of it.

   IT IS A CARD OVER THE MIDDLE, not a strip along the bottom like the quick
   change: you are not choosing between three things you can see, you are
   reading a list and typing a name into it, and the room behind you is not
   the thing you are looking at.
   ===================================================================== */
window.ROOMS = (function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const esc = s=>String(s==null?'':s).replace(/[&<>"]/g,
    c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  let open_ = false, lists = null, busy = false, tab = 'mine', found = null, max = 6;
  let manage = null;                      // the room whose card is open

  /* Every message about a room, wherever you are standing. In a room it is
     the room's business; outside one, the only thing that can still arrive
     is an invitation, and being asked into somebody's room is news on a
     planet as much as in one. */
  function listen(){
    if(!window.NET) return;
    NET.onRoom = m=>{
      if(window.CHATROOM && CHATROOM.active) return CHATROOM.heard(m);
      if(m.t==='crinvite') invited(m);
    };
  }
  function invited(m){
    if(window.CHAT && CHAT.sys)
      CHAT.sys(t('{n} asked you into “{r}” — press C',{ n:m.from, r:m.name }));
    lists = null;                          // the list you were just added to is stale
  }

  function toggle(){ open_ ? close() : open(); }
  async function open(){
    if(open_) return;
    const el = $('#rooms');
    if(!el) return;
    if(!window.NET || !NET.signedIn){
      if(window.CHAT && CHAT.sys) CHAT.sys(t('Sign in to use chat rooms.'));
      return;
    }
    open_ = true;
    manage = null; found = null;
    if(document.pointerLockElement) document.exitPointerLock();
    el.classList.remove('hidden');
    paint();
    await refresh();
  }
  function close(){
    if(!open_) return;
    open_ = false;
    manage = null;
    const el = $('#rooms');
    if(el) el.classList.add('hidden');
    if(G.running && !document.querySelector('.screen:not(.hidden)')) lockPointer($('#view'));
  }

  async function refresh(){
    try{
      const j = await NET.roomLists();
      lists = j; max = j.max || 6;
    }catch(e){ lists = { error:e.message }; }
    paint();
  }

  /* ------------------------------------------------------------- drawing */
  const ACCESS = { private:{ em:'\u{1F512}', word:'Private' },
                   invited:{ em:'\u{1F91D}', word:'Invited' },
                   public :{ em:'\u{1F310}', word:'Public'  } };

  function card(r, verb){
    const a = ACCESS[r.access] || ACCESS.private;
    const who = r.mine || (lists && lists.mine && lists.mine.some(x=>x.id===r.id))
      ? t('yours') : t('by {n}',{ n:esc(r.owner_display || (r.owner&&r.owner.display) || '?') });
    const here = r.players ? '<b class="rm-live">\u{1F465} '+r.players+'</b>' : '';
    const tint = (r.env && r.env.wallColor) || '#5c5470';
    return '<button class="rm-card" data-id="'+r.id+'" data-verb="'+verb+'">'
         + '<span class="rm-swatch" style="background:'+esc(tint)+'"></span>'
         + '<span class="rm-body"><b>'+esc(r.name)+'</b>'
         + '<small>'+a.em+' '+t(a.word)+' · '+who+' '+here+'</small></span></button>';
  }
  function emptyLine(msg){ return '<p class="rm-empty">'+esc(msg)+'</p>'; }

  function paint(){
    const body = $('#roomsBody');
    if(!body) return;
    $('#roomsTitle').textContent = t('CHAT ROOMS');
    if(manage) return paintManage(body);
    if(!lists) return void(body.innerHTML = '<p class="rm-empty">'+t('Asking the server…')+'</p>');
    if(lists.error) return void(body.innerHTML = emptyLine(lists.error));

    const tabs = [['mine', t('Yours')], ['invited', t('Let in')],
                  ['recent', t('Been in')], ['find', t('Find')]];
    let html = '<div class="rm-tabs">' + tabs.map(([k,lbl])=>
      '<button class="rm-tab'+(tab===k?' on':'')+'" data-tab="'+k+'">'+esc(lbl)+'</button>').join('') + '</div>';

    if(tab==='find'){
      html += '<div class="rm-find"><input id="roomQ" maxlength="32" placeholder="'
            + t('a room’s name') + '"><button id="roomGo">'+t('Search')+'</button></div>';
      html += found === null ? emptyLine(t('Public rooms, and your own, by name.'))
            : found.length ? found.map(r=>card(r,'enter')).join('')
            : emptyLine(t('Nothing by that name.'));
    } else {
      const list = lists[tab] || [];
      html += list.length ? list.map(r=>card(r, tab==='mine' ? 'manage' : 'enter')).join('')
            : emptyLine(tab==='mine' ? t('You have not made a room yet.')
              : tab==='invited' ? t('Nobody has asked you into a room.')
              : t('You have not been in anybody’s room yet.'));
      if(tab==='mine'){
        const n = (lists.mine||[]).length;
        html += n < max
          ? '<button class="rm-new" id="roomNew">➕ '+t('Make a room')+'</button>'
            + '<p class="rm-note">'+t('{n} of {m} used',{n, m:max})+'</p>'
          : '<p class="rm-note">'+t('{m} rooms is the limit — delete one to make another.',{m:max})+'</p>';
      }
    }
    /* THE WAY OUT, always. A room is meant to have a portal in it and every
       template starts with one — but its owner may delete it, and a room you
       cannot leave is a room nobody should risk walking into. */
    if(window.CHATROOM && CHATROOM.active)
      html += '<button class="rm-out" id="roomOut">\u{1F6AA} '
            + t('Leave {n}',{ n:esc(CHATROOM.room.name) }) + '</button>';
    html += '<div class="rm-hint">'+t('C or Esc — back to the game')+'</div>';
    body.innerHTML = html;
    wire(body);
  }

  /* One of your rooms, open: rename it, change who may come in, ask
     somebody in, take somebody out, build it, delete it. */
  function paintManage(body){
    const r = manage;
    const members = r.members || [];
    let html = '<button class="rm-back" id="roomBack">← '+t('All rooms')+'</button>';
    html += '<div class="rm-name"><input id="roomName" maxlength="32" value="'+esc(r.name)+'">'
          + '<button id="roomRename">'+t('Rename')+'</button></div>';
    html += '<div class="rm-row"><span>'+t('Who may come in')+'</span><span>'
          + ['private','invited','public'].map(a=>
              '<button class="rm-acc'+(r.access===a?' on':'')+'" data-acc="'+a+'">'
              + ACCESS[a].em+' '+t(ACCESS[a].word)+'</button>').join('') + '</span></div>';
    html += '<p class="rm-note">'+t({
        private:'Yours alone. Nobody else can walk in.',
        invited:'The people on the list below, and you.',
        public :'Anybody signed in can walk in.'
      }[r.access] || '')+'</p>';
    html += '<div class="rm-find"><input id="roomWho" maxlength="24" placeholder="'
          + t('a username') + '"><button id="roomInvite">'+t('Ask them in')+'</button></div>';
    html += members.length
      ? '<ul class="rm-members">' + members.map(m=>
          '<li>'+esc(m.display)+' <small>@'+esc(m.username)+'</small>'
          + '<button class="rm-kick" data-uid="'+m.id+'">'+t('take off')+'</button></li>').join('') + '</ul>'
      : emptyLine(t('Nobody on the list yet.'));
    html += '<div class="rm-acts">'
          + '<button class="rm-go" id="roomEnter">'+t('Go in')+'</button>'
          + '<button class="rm-build" id="roomBuild">\u{1F528} '+t('Build this room')+'</button>'
          + '<button class="rm-del" id="roomDelete">'+t('Delete')+'</button></div>';
    html += '<div class="rm-hint" id="roomSaid"></div>';
    body.innerHTML = html;
    wire(body);
  }
  const said = msg=>{ const el = $('#roomSaid'); if(el) el.textContent = msg || ''; };

  /* ------------------------------------------------------------- wiring */
  function wire(body){
    body.querySelectorAll('.rm-tab').forEach(b=>b.onclick=()=>{ tab = b.dataset.tab; paint(); });
    body.querySelectorAll('.rm-card').forEach(b=>b.onclick=()=>{
      const id = Number(b.dataset.id);
      if(b.dataset.verb==='manage') return openManage(id);
      go(id);
    });
    const nw = $('#roomNew'); if(nw) nw.onclick = () => makeRoom();
    const out = $('#roomOut'); if(out) out.onclick = ()=>{ close(); CHATROOM.leave(); };
    const q = $('#roomQ'), qgo = $('#roomGo');
    if(q){
      q.onkeydown = e=>{ e.stopPropagation(); if(e.key==='Enter') search(q.value); };
      q.onkeyup = e=>e.stopPropagation();
      setTimeout(()=>q.focus(), 30);
    }
    if(qgo) qgo.onclick = ()=>search(q.value);
    const back = $('#roomBack'); if(back) back.onclick = ()=>{ manage = null; paint(); };
    body.querySelectorAll('.rm-acc').forEach(b=>b.onclick=()=>access(b.dataset.acc));
    body.querySelectorAll('.rm-kick').forEach(b=>b.onclick=()=>kick(Number(b.dataset.uid)));
    const nm = $('#roomName');
    if(nm){ nm.onkeydown = e=>{ e.stopPropagation(); if(e.key==='Enter') rename(nm.value); };
            nm.onkeyup = e=>e.stopPropagation(); }
    const rn = $('#roomRename'); if(rn) rn.onclick = ()=>rename($('#roomName').value);
    const who = $('#roomWho');
    if(who){ who.onkeydown = e=>{ e.stopPropagation(); if(e.key==='Enter') invite(who.value); };
             who.onkeyup = e=>e.stopPropagation(); }
    const inv = $('#roomInvite'); if(inv) inv.onclick = ()=>invite($('#roomWho').value);
    const go_ = $('#roomEnter'); if(go_) go_.onclick = ()=>go(manage.id);
    const bld = $('#roomBuild'); if(bld) bld.onclick = ()=>build(manage.id);
    const del = $('#roomDelete'); if(del) del.onclick = ()=>remove(manage.id);
  }

  async function guard(fn, after){
    if(busy) return;
    busy = true;
    try{ const r = await fn(); if(after) after(r); }
    catch(e){ said(e.message); }
    finally{ busy = false; }
  }

  async function openManage(id){
    await guard(()=>NET.roomGet(id), j=>{ manage = j.room; paint(); });
  }
  async function search(q){
    q = String(q||'').trim();
    if(!q){ found = null; return paint(); }
    await guard(()=>NET.roomSearch(q), j=>{ found = j.rooms; paint(); });
  }
  /* MAKING ONE IS A CARD, not a prompt() — the template is the interesting
     choice and a browser prompt cannot show six of them. */
  function makeRoom(){
    const body = $('#roomsBody');
    const TEMPLATES = [
      ['empty', '⬜', t('Empty'), t('Four walls and a way out.')],
      ['bedroom', '\u{1F6CF}', t('Bedroom'), t('A bed, a desk, a lamp, a poster.')],
      ['arcade', '\u{1F579}', t('Arcade'), t('Cabinets, neon and a jukebox.')],
      ['classroom', '\u{1F393}', t('Classroom'), t('Desks in rows and a board.')],
      ['workshop', '\u{1F527}', t('Workshop'), t('A bench, a chest and a robot.')],
      ['space_station', '\u{1F680}', t('Space Station'), t('Glass walls and the stars outside.')]
    ];
    body.innerHTML = '<button class="rm-back" id="roomBack">← '+t('All rooms')+'</button>'
      + '<div class="rm-name"><input id="newName" maxlength="32" placeholder="'
      + t('name your room') + '"></div>'
      + '<div class="rm-tpl">' + TEMPLATES.map(([k,em,name,blurb])=>
          '<button class="rm-t" data-tpl="'+k+'"><b>'+em+' '+esc(name)+'</b><small>'
          + esc(blurb)+'</small></button>').join('') + '</div>'
      + '<p class="rm-note">'+t('It starts private. You choose who comes in afterwards.')+'</p>'
      + '<div class="rm-hint" id="roomSaid"></div>';
    const nm = $('#newName');
    nm.onkeydown = e=>e.stopPropagation();
    nm.onkeyup = e=>e.stopPropagation();
    setTimeout(()=>nm.focus(), 30);
    $('#roomBack').onclick = ()=>{ manage = null; paint(); };
    body.querySelectorAll('.rm-t').forEach(b=>b.onclick=()=>{
      const name = nm.value.trim();
      if(!name){ said(t('Give the room a name first.')); nm.focus(); return; }
      guard(()=>NET.roomCreate(name, 'private', b.dataset.tpl), async j=>{
        lists = null;
        await refresh();
        await openManage(j.room.id);
      });
    });
  }
  async function rename(name){
    await guard(()=>NET.roomRename(manage.id, String(name||'').trim()), j=>{
      manage.name = j.name; lists = null; said(t('Renamed.'));
      if(window.CHATROOM && CHATROOM.active && CHATROOM.room
         && CHATROOM.room.id===manage.id) CHATROOM.refresh();
    });
  }
  async function access(a){
    await guard(()=>NET.roomAccess(manage.id, a), j=>{
      manage.access = j.access; lists = null; paint();
    });
  }
  async function invite(username){
    username = String(username||'').trim().replace(/^@/,'');
    if(!username) return;
    await guard(()=>NET.roomInvite(manage.id, username), j=>{
      manage.members = j.members;
      paint();
      said(j.note || t('Asked in.'));
    });
  }
  async function kick(uid){
    await guard(()=>NET.roomKick(manage.id, uid), j=>{ manage.members = j.members; paint(); });
  }
  /* A DELETE IS ASKED TWICE. It takes a room somebody built away from
     everybody standing in it, and there is no undo anywhere in this game. */
  let armed = 0;
  async function remove(id){
    const btn = $('#roomDelete');
    if(armed !== id){
      armed = id;
      if(btn) btn.textContent = t('Really delete it?');
      said(t('This cannot be undone, and anybody inside is sent out.'));
      setTimeout(()=>{ if(armed===id){ armed = 0; if(btn) btn.textContent = t('Delete'); } }, 5000);
      return;
    }
    armed = 0;
    await guard(()=>NET.roomDelete(id), async ()=>{
      manage = null; lists = null;
      await refresh();
    });
  }
  async function go(id){
    await guard(()=>NET.roomEnter(id), j=>{
      close();
      CHATROOM.enter(j.room, j.server);
    });
  }
  async function build(id){
    await guard(()=>NET.roomEnter(id), async j=>{
      close();
      await CHATROOM.enter(j.room, j.server);
      if(window.ROOMEDIT) ROOMEDIT.open_();
    });
  }

  function key(e){
    if(!open_) return false;
    if(e.code==='Escape' || e.code==='KeyC'){
      /* not while they are typing a name into it */
      const a = document.activeElement;
      if(e.code==='KeyC' && a && a.tagName==='INPUT') return false;
      close();
      return true;
    }
    return false;
  }

  return { open, close, toggle, key, invited, listen, refresh,
           get up(){ return open_; } };
})();

/* The socket's room messages have to be listened for from the moment the
   page has one, not from the moment somebody opens this panel: an invitation
   arrives while you are standing on a planet with nothing open. */
if(window.NET) ROOMS.listen();
