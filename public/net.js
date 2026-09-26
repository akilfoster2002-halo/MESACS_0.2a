/* =====================================================================
   NET — sign-in, saved progress, and the free-play socket (presence+chat)
   Guests can still play; they just get no multiplayer and no saved work.
   ===================================================================== */
window.NET = (function(){
  let me=null, ws=null, onPlayers=null, onChat=null, onSys=null, onMech=null, onMecha=null, onRoom=null;
  let muted=0;
  /* what we are meant to be connected to, so a dropped socket can put itself
     back. A deploy, a sleeping free-tier dyno or a flaky school wifi all end
     the same way — the socket closes — and until now nothing reconnected and
     nothing said so, which reads as "we joined the same server and cannot see
     each other". */
  let want=null, handlers=null, retry=0, retryT=null, gone=false;
  let opening=false;              // a socket is being asked for (open_ awaits its ticket)

  async function api(path, body, method){
    const r = await fetch('/api'+path, {
      method: method || (body?'POST':'GET'),
      headers:{ 'Content-Type':'application/json' },
      credentials:'same-origin',
      body: body?JSON.stringify(body):undefined
    });
    let j={};
    try{ j=await r.json(); }catch(e){ j={ok:false,error:'Server did not answer'}; }
    if(!r.ok||!j.ok) throw new Error(j.error||('Error '+r.status));
    return j;
  }

  /* The server says which KIND of place somebody walked into; the wording is
     picked here so it can be translated like everything else. */
  const WENT = {
    outside :'{n} came back outside',
    workshop:'{n} went into the Workshop',
    house   :'{n} went home',
    counter :'{n} went into the Wardrobe',
    mission :'{n} went into a mission',
    gym     :'{n} went into the Gym',
    arcade  :'{n} went up to NEON',
    space   :'{n} launched'
  };

  const nameOf = ()=> me ? me.display : t('Guest');
  return {
    get me(){ return me; },
    get signedIn(){ return !!me; },
    get muted(){ return muted>Date.now(); },
    nameOf,
    async health(){ try{ return (await api('/health')).db; }catch(e){ return false; } },
    async resume(){ try{ me=(await api('/me')).user; return me; }catch(e){ me=null; return null; } },
    async login(username,password){ me=(await api('/login',{username,password})).user; return me; },
    async register(d){ me=(await api('/register',d)).user; return me; },
    async servers(){ try{ return (await api('/servers')).servers||[]; }catch(e){ return []; } },
    async logout(){ try{ await api('/logout',{}); }catch(e){} me=null;
      want=null; gone=true; clearTimeout(retryT); if(ws){ws.close();ws=null;} },
    async saveProgress(p){ if(me) try{ await api('/progress',{progress:p}); }catch(e){} },

    /* ---- chat rooms ----
       Places a player owns. Everything here is ASKED OF THE SERVER, which
       checks it against the database from your session (server/chatrooms.js):
       the browser never decides who owns a room or who may walk into one, and
       a room it draws is a room the server said you may be in.

       These throw on a refusal, with the server's own sentence — which is
       written to be read by the person who was refused, so the panel shows
       it rather than inventing one of its own. */
    roomCatalog(){ return api('/rooms/catalog'); },
    roomLists(){ return api('/rooms'); },
    roomSearch(q){ return api('/rooms/search?q='+encodeURIComponent(q)); },
    roomCreate(name, access, template){ return api('/rooms',{name,access,template}); },
    roomGet(id){ return api('/rooms/'+id); },
    roomEnter(id){ return api('/rooms/'+id+'/enter',{}); },
    roomSave(id, env, objects){ return api('/rooms/'+id+'/save',{env,objects}); },
    roomRename(id, name){ return api('/rooms/'+id+'/rename',{name}); },
    roomAccess(id, access){ return api('/rooms/'+id+'/access',{access}); },
    roomInvite(id, username){ return api('/rooms/'+id+'/invite',{username}); },
    roomKick(id, userId){ return api('/rooms/'+id+'/remove',{userId}); },
    roomDelete(id){ return api('/rooms/'+id, null, 'DELETE'); },
    /* An object in a chat room changed state here — tell everybody inside.
       The server stamps anything that runs over time with ITS clock and hands
       it back, so every screen replays it from the same moment. */
    roomState(objId, s){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'cro', o:objId, s})); },
    /* Who wants to hear about rooms: the room you are standing in (object
       state, an edit, a way out) and, wherever you are, an invitation. */
    set onRoom(fn){ onRoom=fn; },
    get onRoom(){ return onRoom; },

    /* ---- free play socket ---- */
    /* `server` is the room to stand in. The socket opens in no room at all
       and joins on request, so switching rooms costs a message, not a
       reconnect. */
    connect(server, hs){
      if(!me) return false;
      want=server; handlers=hs; retry=0; gone=false;
      clearTimeout(retryT);
      /* Already in the room? Keep the socket. Opening a second one would leave
         the first live and unread — two of you in the roster, one of them a
         ghost — every time the room is re-entered for a new mission. */
      if(ws && ws.readyState===1){
        onPlayers=hs.players; onChat=hs.chat; onSys=hs.sys;
        if(server) ws.send(JSON.stringify({t:'join', server}));
        return true;
      }
      open_();
      return true;
    },
    disconnect(){ want=null; gone=true; clearTimeout(retryT); if(ws){ ws.close(); ws=null; } },
    get live(){ return !!ws && ws.readyState===1; },
    /* Where we are, what we are wearing, and what we are driving. `at` is the
       place those two numbers are measured in — the planet you are standing
       on, or 'inside' for a room off it. Presence has to carry both or a
       classmate drives past still walking, and somebody who has gone indoors
       is left standing in the field with their indoor coordinates. */
    pos(p){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'pos',...p})); },
    /* one-shot: they have just walked into somewhere, and the room is told */
    place(at){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'place',at})); },
    /* ---- the Gym ----
       A program goes up to the server and either waits there for somebody
       to fight or comes back as a whole match. Answers arrive at onMech,
       which the arena sets when it loads: they have to reach it whether
       the socket was opened by the planet or by Free Play, and the arena
       is neither of those rooms. */
    mech(msg){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'mech',...msg})); },
    set onMech(fn){ onMech=fn; },
    get onMech(){ return onMech; },
    /* The live arena. `input` goes out twenty times a second while a
       fight is running, which is the only chatty message in the game —
       everything else here is somebody pressing a button. */
    mecha(msg){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'mecha',...msg})); },
    set onMecha(fn){ onMecha=fn; },
    get onMecha(){ return onMecha; },
    say(text){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'chat',text})); },
    join(server){ want=server; if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'join',server})); },
    /* what our objects look like right now, for everyone else in the room */
    objs(payload){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'objs',...payload})); }
  };

  /* WHERE THE SOCKET GOES. On the game's own server it is this host, and
     the cookie goes with it. The website on Vercel has no server of its own
     — its /api is the game's server, reached through a rewrite — so there
     the socket goes to that server directly, and since our cookie does not
     travel to another address it says who we are with a one-minute ticket
     instead (server/auth.js), then joins once it is let in. */
  async function open_(){
    if(opening) return;
    opening=true;
    const hs=handlers||{};
    onPlayers=hs.players; onChat=hs.chat; onSys=hs.sys;
    const proto = location.protocol==='https:'?'wss':'ws';
    let url=`${proto}://${location.host}/ws`, ticket=null;
    try{
      const j = await api('/ticket');
      const live = j.live ? new URL(j.live) : null;
      if(live && live.host!==location.host){ url=`${live.protocol==='https:'?'wss':'ws'}://${live.host}/ws`; ticket=j.ticket; }
    }catch(e){}
    opening=false;
    if(gone || !want) return;
    let sock;
    try{ sock=new WebSocket(url); }
    catch(e){ return later(); }
    ws=sock;
    ws.onopen=()=>{
      if(retry && onSys) onSys(t('Back on the server.'));
      retry=0;
      if(ticket) ws.send(JSON.stringify({t:'hello', ticket}));
      else if(want) ws.send(JSON.stringify({t:'join', server:want}));
    };
    ws.onmessage=e=>{
        let m; try{ m=JSON.parse(e.data); }catch(err){ return; }
        if(m.t==='welcome'&&ticket&&want) ws.send(JSON.stringify({t:'join', server:want}));
        if(m.t==='players'&&onPlayers) onPlayers(m.players.filter(p=>p.id!==me.id));
        if(m.t==='chat'&&onChat) onChat(m);
        if(m.t==='dm'&&window.PHONE) PHONE.buzz(m);
        if(m.t==='objs'&&handlers.objs) handlers.objs(m);
        if(m.t==='room'&&onChat){
          if(handlers.clear) handlers.clear(true);   // room switch: start on a clean log
          (m.history||[]).forEach(h=>onChat({...h, from:h.display, history:true}));
        }
        if(m.t==='joined'&&onSys) onSys(t('{n} joined',{n:m.display}));
        if(m.t==='left'&&onSys)   onSys(t('{n} left',{n:m.display}));
        if(m.t==='moved'&&onSys){
          const w=WENT[m.where];
          if(w) onSys(t(w,{n:m.display}));
        }
        /* A fight is news for the whole room, whoever was in it — and it
           arrives with everything needed to watch it, which the arena
           picks up if somebody is standing in there to care. */
        if(m.t==='fought'&&m.watch&&window.MECH&&MECH.offer) MECH.offer(m);
        if(m.t==='fought'&&onSys) onSys(
          m.winner==='draw' ? t('{a} and {b} fought to a draw — {n} turns',
                                {a:m.a,b:m.b,n:m.turns})
          : t('{w} beat {l} in {n} turns',
              {w:m.winner==='A'?m.a:m.b, l:m.winner==='A'?m.b:m.a, n:m.turns}));
        if(m.t==='mech'){
          if(m.op==='open'&&onSys) onSys(t('{n} is waiting for a fight in the Gym',{n:m.name}));
          if(onMech) onMech(m);
        }
        if(m.t==='mecha'){
          if(m.op==='open'&&onSys) onSys(t('{n} is in the Mecha Arena, waiting',{n:m.name}));
          if(onMecha) onMecha(m);
        }
        if(m.t==='bout'&&onSys) onSys(
          m.winner==='draw' ? t('{a} and {b} drew in the Mecha Arena',{a:m.a,b:m.b})
          : t('{w} beat {l} in the Mecha Arena, {x}–{y}',{
              w:m.winner==='A'?m.a:m.b, l:m.winner==='A'?m.b:m.a,
              x:Math.max(m.score.A,m.score.B), y:Math.min(m.score.A,m.score.B) }));
        /* A CHAT ROOM'S FIVE. `cro`/`cro_all` are what is happening in the
           room you are standing in; `crupdate` says its owner changed it
           under you; `crkick` is being sent back out of it; `crinvite`
           arrives wherever you are, because being asked into somebody's room
           is news on a planet as much as in one. */
        if(m.t==='cro'||m.t==='cro_all'||m.t==='crupdate'||m.t==='crkick'||m.t==='crinvite'){
          if(onRoom) onRoom(m);
        }
        if(m.t==='sys'&&onSys)    onSys(m.text);
        if(m.t==='muted'){ muted=m.until; if(onSys) onSys(m.until>Date.now()
            ? t('Your teacher muted the chat for you.') : t('You can chat again.')); }
        if(m.t==='clear'&&handlers.clear) handlers.clear();
        if(m.t==='unsay'&&handlers.unsay) handlers.unsay(m.id);
      };
    ws.onclose=ev=>{
      ws=null;
      if(handlers && handlers.players) handlers.players([]);   // nobody is visible while we are away
      if(gone || !want) return;
      if(ev && ev.code===4001){                                // the server says we are not signed in
        if(onSys) onSys(t('Sign in again to rejoin the server.'));
        return;
      }
      if(!retry && onSys) onSys(t('Lost the server — trying to get back.'));
      later();
    };
  }
  /* back off, but never further than ten seconds: a class waiting to see each
     other again should not be waiting on a minute-long timer */
  function later(){
    ws=null;
    const wait=Math.min(10000, 700*Math.pow(2,Math.min(retry,4)));
    retry++;
    clearTimeout(retryT);
    retryT=setTimeout(()=>{ if(!gone && want) open_(); }, wait);
  }
})();
