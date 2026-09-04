/* =====================================================================
   NET — sign-in, saved progress, and the free-play socket (presence+chat)
   Guests can still play; they just get no multiplayer and no saved work.
   ===================================================================== */
window.NET = (function(){
  let me=null, ws=null, onPlayers=null, onChat=null, onSys=null;
  let muted=0;
  /* what we are meant to be connected to, so a dropped socket can put itself
     back. A deploy, a sleeping free-tier dyno or a flaky school wifi all end
     the same way — the socket closes — and until now nothing reconnected and
     nothing said so, which reads as "we joined the same server and cannot see
     each other". */
  let want=null, handlers=null, retry=0, retryT=null, gone=false;

  async function api(path, body){
    const r = await fetch('/api'+path, {
      method: body?'POST':'GET',
      headers:{ 'Content-Type':'application/json' },
      credentials:'same-origin',
      body: body?JSON.stringify(body):undefined
    });
    let j={};
    try{ j=await r.json(); }catch(e){ j={ok:false,error:'Server did not answer'}; }
    if(!r.ok||!j.ok) throw new Error(j.error||('Error '+r.status));
    return j;
  }

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

    /* ---- free play socket ---- */
    /* `server` is the room to stand in. The socket opens in no room at all
       and joins on request, so switching rooms costs a message, not a
       reconnect. */
    connect(server, hs){
      if(!me) return false;
      want=server; handlers=hs; retry=0; gone=false;
      clearTimeout(retryT);
      open_();
      return true;
    },
    disconnect(){ want=null; gone=true; clearTimeout(retryT); if(ws){ ws.close(); ws=null; } },
    get live(){ return !!ws && ws.readyState===1; },
    pos(x,z,yaw,char){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'pos',x,z,yaw,char})); },
    say(text){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'chat',text})); },
    join(server){ want=server; if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'join',server})); },
    /* what our objects look like right now, for everyone else in the room */
    objs(payload){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'objs',...payload})); }
  };

  function open_(){
    const hs=handlers||{};
    onPlayers=hs.players; onChat=hs.chat; onSys=hs.sys;
    const proto = location.protocol==='https:'?'wss':'ws';
    let sock;
    try{ sock=new WebSocket(`${proto}://${location.host}/ws`); }
    catch(e){ return later(); }
    ws=sock;
    ws.onopen=()=>{
      if(retry && onSys) onSys(t('Back on the server.'));
      retry=0;
      if(want) ws.send(JSON.stringify({t:'join', server:want}));
    };
    ws.onmessage=e=>{
        let m; try{ m=JSON.parse(e.data); }catch(err){ return; }
        if(m.t==='players'&&onPlayers) onPlayers(m.players.filter(p=>p.id!==me.id));
        if(m.t==='chat'&&onChat) onChat(m);
        if(m.t==='objs'&&handlers.objs) handlers.objs(m);
        if(m.t==='room'&&onChat){
          if(handlers.clear) handlers.clear(true);   // room switch: start on a clean log
          (m.history||[]).forEach(h=>onChat({...h, from:h.display, history:true}));
        }
        if(m.t==='joined'&&onSys) onSys(t('{n} joined',{n:m.display}));
        if(m.t==='left'&&onSys)   onSys(t('{n} left',{n:m.display}));
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
