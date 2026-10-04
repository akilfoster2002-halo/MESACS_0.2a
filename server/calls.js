/* =====================================================================
   CALLS — voice, phone to phone.

   THE SERVER NEVER HEARS A WORD. The sound goes browser to browser over
   WebRTC; all this does is introduce the two of them — who is ringing
   whom, did they pick up — and pass along the few kilobytes each browser
   needs to find the other (an offer, an answer, some addresses). Once the
   call connects, the only thing that still comes through here is the
   hang-up.

   That is what makes it fast: a voice that went up to Render and back down
   again would spend most of a lab's latency budget on the trip. Peer to
   peer, two machines on the same school network are a few milliseconds
   apart.

   A CALL IS BETWEEN TWO PEOPLE, NOT TWO TABS. It rings every tab the
   callee has open; the one that answers is bound to the call, and the
   others stop ringing. Close that tab, or the caller's, and the call ends.

   Kept in memory only, like room chat. The teacher's view is a list of who
   called whom, when, and for how long — never what was said, because
   nothing that was said ever reaches this machine.
   ===================================================================== */
const RING_MS = 30000;            // nobody answers: it stops, and is missed
const LOG_KEEP = 200;
const SIG_MAX = 16000;            // an SDP is a few kB; this is not a file transfer

function createCalls({ sockets, sendTo, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }){
  const calls = new Map();        // id -> call
  const log = [];                 // newest last
  let nextId = 1;

  const busy = userId => [...calls.values()].some(c => c.a.id===userId || c.b.id===userId);
  const out = (ws, obj) => { if(ws && ws.readyState===1) ws.send(JSON.stringify(obj)); };

  function record(c, how){
    c.entry.ended = now();
    c.entry.how = how;
    c.entry.secs = c.entry.answered ? Math.round((c.entry.ended - c.entry.answered)/1000) : 0;
  }
  function end(c, how, byId){
    if(!calls.has(c.id)) return;
    calls.delete(c.id);
    clearTimer(c.timer);
    record(c, how);
    // the caller's tab, and whichever of the callee's tabs had it — or all of
    // them, if it was still ringing everywhere
    out(c.a.ws, { t:'call', op:'end', id:c.id, how, by:byId===c.a.id ? 'you' : 'them' });
    if(c.b.ws) out(c.b.ws, { t:'call', op:'end', id:c.id, how, by:byId===c.b.id ? 'you' : 'them' });
    else sendTo(c.b.id, { t:'call', op:'end', id:c.id, how, by:'them' });
  }

  /* p is the socket's live record ({id, username, display, mutedUntil}).
     `who` is the callee as the database has them, already looked up. */
  function ring(ws, p, who){
    const no = reason => out(ws, { t:'call', op:'fail', reason });
    if(!who) return no('Nobody has that username');
    if(who.id===p.id) return no('That is you!');
    if(p.mutedUntil && now()<p.mutedUntil) return no('You are muted right now');
    if(busy(p.id)) return no('You are already on a call');
    if(!sockets(who.id).length) return no('{n} is not online right now');
    if(busy(who.id)) return no('{n} is on another call');
    const id = nextId++;
    const entry = { id, from:p.username, fromDisplay:p.display, to:who.username, toDisplay:who.display,
                    at:now(), answered:0, ended:0, how:'', secs:0 };
    log.push(entry); if(log.length>LOG_KEEP) log.splice(0, log.length-LOG_KEEP);
    const c = { id, entry,
                a:{ id:p.id, ws, username:p.username, display:p.display },
                b:{ id:who.id, ws:null, username:who.username, display:who.display } };
    calls.set(id, c);
    c.timer = setTimer(()=>end(c, 'missed', null), RING_MS);
    out(ws, { t:'call', op:'ringing', id, with:{ username:who.username, display:who.display } });
    sendTo(who.id, { t:'call', op:'ring', id, with:{ username:p.username, display:p.display } });
  }

  function handle(ws, p, m, lookup){
    const op = m && m.op;
    if(op==='ring') return lookup(String(m.to||'')).then(who=>ring(ws, p, who), ()=>
      out(ws, { t:'call', op:'fail', reason:'Could not place that call' }));
    const c = calls.get(Number(m.id));
    if(!c) return;
    const mine = c.a.ws===ws ? 'a' : (c.b.id===p.id && (!c.b.ws || c.b.ws===ws)) ? 'b' : null;
    if(!mine) return;
    if(op==='answer'){
      if(mine!=='b' || c.b.ws) return;
      if(p.mutedUntil && now()<p.mutedUntil){ end(c, 'declined', p.id); return; }
      c.b.ws = ws;
      clearTimer(c.timer);
      c.entry.answered = now();
      out(c.a.ws, { t:'call', op:'answered', id:c.id });
      // their other tabs stop ringing
      for(const s of sockets(c.b.id)) if(s!==ws) out(s, { t:'call', op:'end', id:c.id, how:'elsewhere', by:'you' });
      return;
    }
    if(op==='decline' && mine==='b' && !c.b.ws) return end(c, 'declined', p.id);
    if(op==='hang') return end(c, c.entry.answered ? 'ended' : (mine==='a' ? 'cancelled' : 'declined'), p.id);
    /* THE RELAY. Only once both ends are bound — an offer to a phone that
       is still ringing in three tabs has nowhere to go. */
    if(op==='sig'){
      if(!c.b.ws) return;
      if(JSON.stringify(m.d||null).length > SIG_MAX) return;
      out(mine==='a' ? c.b.ws : c.a.ws, { t:'call', op:'sig', id:c.id, d:m.d });
    }
  }

  /* A tab closed: any call it was part of is over. A callee's tab that was
     only ringing does not end it — they may have another tab open. */
  function gone(ws, p){
    for(const c of [...calls.values()]){
      if(c.a.ws===ws || c.b.ws===ws) end(c, c.entry.answered ? 'dropped' : 'cancelled', p && p.id);
      else if(!c.b.ws && p && c.b.id===p.id && !sockets(p.id).some(s=>s!==ws)) end(c, 'missed', null);
    }
  }
  /* The teacher muted somebody: that is a mute on talking, and a call is talking. */
  function muted(userId){
    for(const c of [...calls.values()]) if(c.a.id===userId || c.b.id===userId) end(c, 'muted', userId);
  }

  return { handle, gone, muted, log:()=>log.slice().reverse(), active:()=>calls.size };
}

module.exports = { createCalls, RING_MS };
