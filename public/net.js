/* =====================================================================
   NET — sign-in, saved progress, and the free-play socket (presence+chat)
   Guests can still play; they just get no multiplayer and no saved work.
   ===================================================================== */
window.NET = (function(){
  let me=null, ws=null, onPlayers=null, onChat=null, onSys=null;
  let muted=0;

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
    async logout(){ try{ await api('/logout',{}); }catch(e){} me=null; if(ws){ws.close();ws=null;} },
    async saveProgress(p){ if(me) try{ await api('/progress',{progress:p}); }catch(e){} },

    /* ---- free play socket ---- */
    connect(handlers){
      if(!me) return false;
      onPlayers=handlers.players; onChat=handlers.chat; onSys=handlers.sys;
      const proto = location.protocol==='https:'?'wss':'ws';
      ws=new WebSocket(`${proto}://${location.host}/ws`);
      ws.onmessage=e=>{
        let m; try{ m=JSON.parse(e.data); }catch(err){ return; }
        if(m.t==='players'&&onPlayers) onPlayers(m.players.filter(p=>p.id!==me.id));
        if(m.t==='chat'&&onChat) onChat(m);
        if(m.t==='welcome'&&onChat) (m.history||[]).forEach(h=>onChat({...h, from:h.display, history:true}));
        if(m.t==='joined'&&onSys) onSys(t('{n} joined',{n:m.display}));
        if(m.t==='left'&&onSys)   onSys(t('{n} left',{n:m.display}));
        if(m.t==='sys'&&onSys)    onSys(m.text);
        if(m.t==='muted'){ muted=m.until; if(onSys) onSys(m.until>Date.now()
            ? t('Your teacher muted the chat for you.') : t('You can chat again.')); }
        if(m.t==='clear'&&handlers.clear) handlers.clear();
        if(m.t==='unsay'&&handlers.unsay) handlers.unsay(m.id);
      };
      ws.onclose=()=>{ ws=null; };
      return true;
    },
    disconnect(){ if(ws){ ws.close(); ws=null; } },
    get live(){ return !!ws && ws.readyState===1; },
    pos(x,z,yaw,char){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'pos',x,z,yaw,char})); },
    say(text){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({t:'chat',text})); }
  };
})();
