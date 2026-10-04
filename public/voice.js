/* =====================================================================
   VOICE — open mics in the room.

   Everybody's mic is on by default, and you hear whoever is standing near
   you: full volume up close, quieter as they walk away, silent past
   HEAR metres. It is what a playground sounds like, which is the point —
   the class can talk without anybody opening anything.

   PEER TO PEER, LIKE A PHONE CALL (call.js). The server only says who has a
   mic on (the `vc` flag in the roster) and passes the handshake between two
   people in the same room; the sound goes straight between their browsers.
   Nobody connects to the whole room: each browser opens a line only to the
   few people close enough to matter, and hangs it up again when they walk
   off, so a lab of thirty is not thirty lines per machine.

   DISTANCE IS IN METRES, and the places do not all send metres: the planet
   sends a longitude and latitude on a ball whose size depends on the world,
   and a chat room the same on a ball of its own. So each place that sends
   something other than plain x/y/z tells this how to read it (place()),
   and two people only hear each other when they are in the same `at`.
   ===================================================================== */
window.VOICE = (function(){
  const NEAR = 3;          // full volume inside this
  const HEAR = 30;         // silent beyond this
  const OPEN = 34;         // open a line to somebody this close…
  const SHUT = 44;         // …and hang it up once they are this far
  const MAX_LINES = 8;     // the nearest eight, however crowded it gets

  const $ = s => document.querySelector(s);
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let want = true;         // the player's own choice: mic on unless they turned it off
  try{ want = localStorage.getItem('koro.voice') !== 'off'; }catch(e){}
  let room = null, on = false, starting = false, denied = '', mic = null;
  let ac = null, out = null, meter = null;
  const peers = new Map();         // their user id -> line
  const places = [];               // (record) -> {x,y,z} metres, or null if not theirs
  let me = null;                   // my own record, from the roster or my last pos

  /* ------------------------------------------------------------ where */
  function place(fn){ places.push(fn); }
  function metres(p){
    if(!p) return null;
    for(const fn of places){ try{ const v=fn(p); if(v) return v; }catch(e){} }
    return { x:+p.x||0, y:+p.y||0, z:+p.z||0 };
  }
  /* 1 at arm's length, 0 at HEAR, falling off like a voice does rather
     than a straight line — most of the drop is in the first few steps. */
  function level(d){
    if(d<=NEAR) return 1;
    if(d>=HEAR) return 0;
    const k=1-(d-NEAR)/(HEAR-NEAR);
    return k*k;
  }

  /* ------------------------------------------------------------ sound */
  function audio(){
    if(ac) return ac;
    try{ ac=new (window.AudioContext||window.webkitAudioContext)({ latencyHint:'interactive' }); }catch(e){ return null; }
    out=ac.createGain(); out.connect(ac.destination);
    return ac;
  }
  // a browser will not play sound until somebody has touched the page
  const wake=()=>{ if(ac && ac.state==='suspended') ac.resume().catch(()=>{}); };
  ['pointerdown','keydown','touchstart'].forEach(e=>window.addEventListener(e, wake, true));

  async function start(){
    if(on || starting || !want || denied || !room || !(window.NET && NET.live)) return;
    starting=true;
    try{
      if(!mic) mic=await navigator.mediaDevices.getUserMedia({ audio:{
        echoCancellation:true, noiseSuppression:true, autoGainControl:true,
        channelCount:1, sampleRate:48000, latency:0.01 }, video:false });
      mic.getAudioTracks().forEach(tr=>tr.enabled=true);
      audio(); wake();
      if(ac && !meter){
        const an=ac.createAnalyser(); an.fftSize=512;
        ac.createMediaStreamSource(mic).connect(an);
        meter={ an, buf:new Uint8Array(an.fftSize) };
      }
      on=true;
      NET.voice({ op:'on' });
    }catch(e){
      denied = e && e.name==='NotAllowedError' ? t('Allow the microphone to talk to people near you') : t('No microphone found');
    }
    starting=false;
    paint();
  }
  function stop(keepMic){
    on=false;
    for(const id of [...peers.keys()]) drop(id, true);
    if(window.NET) NET.voice({ op:'off' });
    if(mic && !keepMic){ mic.getTracks().forEach(tr=>tr.stop()); mic=null; meter=null; }
    paint();
  }

  /* ------------------------------------------------------------ a line */
  function line(id, who){
    const pc=new RTCPeerConnection({ iceServers:(window.NET&&NET.ice)||[{urls:'stun:stun.l.google.com:19302'}],
                                     bundlePolicy:'max-bundle', rtcpMuxPolicy:'require' });
    const L={ id, who:who||'', pc, pending:[], gain:null, el:null, an:null, buf:null, d:Infinity, at:Date.now() };
    for(const tr of mic.getAudioTracks()){
      const sender=pc.addTrack(tr, mic);
      try{
        const p=sender.getParameters(); p.encodings=p.encodings&&p.encodings.length?p.encodings:[{}];
        p.encodings.forEach(e=>{ e.priority='high'; e.networkPriority='high'; e.maxBitrate=32000; });
        sender.setParameters(p).catch(()=>{});
      }catch(e){}
    }
    pc.onicecandidate=e=>{ if(e.candidate) NET.voice({ op:'sig', to:id, d:{ cand:e.candidate.toJSON() } }); };
    pc.ontrack=e=>{
      try{ e.receiver.jitterBufferTarget=0; }catch(err){}
      try{ e.receiver.playoutDelayHint=0; }catch(err){}
      const stream=e.streams[0] || new MediaStream([e.track]);
      /* Chrome only lets a remote stream into the audio graph once
         something is playing it — so an <audio> plays it, muted, and the
         graph is what you hear, at whatever volume the distance says. */
      L.el=document.createElement('audio'); L.el.muted=true; L.el.srcObject=stream; L.el.play().catch(()=>{});
      if(!audio()) return;
      L.gain=ac.createGain(); L.gain.gain.value=0;
      const src=ac.createMediaStreamSource(stream);
      src.connect(L.gain); L.gain.connect(out);
      L.an=ac.createAnalyser(); L.an.fftSize=256; L.buf=new Uint8Array(L.an.fftSize); src.connect(L.an);
      L.src=src;
      loud(L);
    };
    pc.onconnectionstatechange=()=>{
      if(pc.connectionState==='failed' && peers.get(id)===L) drop(id);
    };
    peers.set(id, L);
    return L;
  }
  async function call(id, who){
    const L=line(id, who);
    try{
      const offer=await L.pc.createOffer();
      if(window.CALL && CALL._quick) offer.sdp=CALL._quick(offer.sdp);
      await L.pc.setLocalDescription(offer);
      NET.voice({ op:'sig', to:id, d:{ sdp:{ type:offer.type, sdp:offer.sdp } } });
    }catch(e){ drop(id); }
  }
  function drop(id, quiet){
    const L=peers.get(id); if(!L) return;
    peers.delete(id);
    try{ L.pc.close(); }catch(e){}
    try{ if(L.src) L.src.disconnect(); if(L.gain) L.gain.disconnect(); }catch(e){}
    if(L.el) L.el.srcObject=null;
    if(!quiet && window.NET) NET.voice({ op:'bye', to:id });
  }
  function loud(L){
    if(!L.gain || !ac) return;
    const g = level(L.d) * (window.CALL && CALL.busy ? 0.25 : 1);   // a phone call wins
    L.gain.gain.setTargetAtTime(g, ac.currentTime, 0.12);
  }

  /* ------------------------------------------------------------ the server */
  async function hear(m){
    if(m.op==='denied'){ denied=t(m.reason||'Voice is switched off here.'); stop(); return; }
    if(m.op==='gone'){ drop(m.from!=null?m.from:m.id, true); return; }
    if(!on) return;
    if(m.op==='bye'){ drop(m.from, true); return; }
    if(m.op!=='sig' || !m.d) return;
    let L=peers.get(m.from);
    const d=m.d;
    try{
      if(d.sdp){
        if(d.sdp.type==='offer'){
          // they are the lower id, so they ring; a stale line of ours gives way
          if(L) drop(m.from, true);
          L=line(m.from, nameOf(m.from));
          await L.pc.setRemoteDescription(d.sdp);
          const ans=await L.pc.createAnswer();
          if(window.CALL && CALL._quick) ans.sdp=CALL._quick(ans.sdp);
          await L.pc.setLocalDescription(ans);
          NET.voice({ op:'sig', to:m.from, d:{ sdp:{ type:ans.type, sdp:ans.sdp } } });
        } else if(L){
          await L.pc.setRemoteDescription(d.sdp);
        }
        if(L) for(const x of L.pending.splice(0)) await L.pc.addIceCandidate(x).catch(()=>{});
      } else if(d.cand && L){
        if(L.pc.remoteDescription) await L.pc.addIceCandidate(d.cand).catch(()=>{});
        else L.pending.push(d.cand);
      }
    }catch(e){ console.warn('voice:', e); }
  }

  /* ------------------------------------------------------------ who is near
     Twelve times a second, with everybody's position: who is close enough
     to have a line to, and how loud each of them is. */
  let names=new Map();
  const nameOf=id=>names.get(id)||'';
  function roster(list){
    if(!window.NET || !NET.me) return;
    names=new Map(list.map(p=>[p.id, p.display]));
    const mine=list.find(p=>p.id===NET.me.id);
    if(mine) me=mine;
    if(!on || !me) return;
    const here=metres(me);
    const near=[];
    for(const p of list){
      if(p.id===NET.me.id) continue;
      let d=Infinity;
      if(p.vc && p.at===me.at){
        const there=metres(p);
        if(here && there) d=Math.hypot(here.x-there.x, here.y-there.y, here.z-there.z);
      }
      const L=peers.get(p.id);
      if(L){ L.d=d; L.who=p.display; loud(L); }
      if(d<OPEN) near.push({ p, d });
    }
    // hang up on anybody who walked off, went somewhere else or switched off
    const inRoom=new Set(list.map(p=>p.id));
    // and a line that never came up (they were not listening yet) is tried again
    for(const [id,L] of peers){
      if(!inRoom.has(id) || L.d>SHUT) drop(id);
      else if(L.pc.connectionState!=='connected' && Date.now()-L.at>10000) drop(id, true);
    }
    // ring the nearest few we have no line to; the lower id rings, so two
    // people never ring each other at once
    near.sort((a,b)=>a.d-b.d);
    for(const { p } of near.slice(0, MAX_LINES))
      if(!peers.has(p.id) && NET.me.id<p.id && peers.size<MAX_LINES) call(p.id, p.display);
    paintNear();
  }
  function joined(server){
    for(const id of [...peers.keys()]) drop(id, true);
    room=server; on=false; me=null;
    if(denied && /muted/i.test(denied)) denied='';
    start();
    paint();
  }
  function lost(){ for(const id of [...peers.keys()]) drop(id, true); on=false; room=null; paint(); }
  function retry(){ if(denied){ denied=''; start(); } }

  /* ------------------------------------------------------------ the button
     Beside the phone. Green ring that moves with your voice when the mic is
     live; a line through it when you have turned it off; a warning when the
     browser or the teacher has. M turns it on and off. */
  let built=false;
  function build(){
    if(built) return; built=true;
    const b=document.createElement('button');
    b.id='voiceBtn'; b.className='hidden'; b.type='button';
    b.innerHTML='<span class="vb-ico">🎙️</span>';
    b.onclick=()=>toggle();
    document.body.appendChild(b);
    const n=document.createElement('div'); n.id='voiceNear'; n.className='hidden';
    document.body.appendChild(n);
    window.addEventListener('keydown', e=>{
      if(e.code!=='KeyM' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || (e.target && e.target.isContentEditable)) return;
      if(window.TSH && TSH.active) return;          // M is TSH's own mute
      if(!room) return;
      toggle();
    });
    (function frame(){ requestAnimationFrame(frame); pulse(); })();
  }
  function toggle(){
    if(denied){ denied=''; }
    want=!want;
    try{ localStorage.setItem('koro.voice', want?'on':'off'); }catch(e){}
    if(want) start(); else stop();
    paint();
  }
  function paint(){
    build();
    const b=$('#voiceBtn');
    b.classList.toggle('live', on);
    b.classList.toggle('off', !want);
    b.classList.toggle('bad', !!denied);
    b.querySelector('.vb-ico').textContent = denied ? '🚫' : want ? '🎙️' : '🔇';
    b.title = denied || (want ? t('Your mic is on — people near you can hear you (M to mute)')
                              : t('Your mic is off (M to turn it on)'));
    if(!on) $('#voiceNear').classList.add('hidden');
  }
  function rms(an, buf){
    an.getByteTimeDomainData(buf);
    let s=0; for(let i=0;i<buf.length;i++){ const v=(buf[i]-128)/128; s+=v*v; }
    return Math.sqrt(s/buf.length);
  }
  function pulse(){
    const b=$('#voiceBtn'); if(!b) return;
    // shown wherever the phone is: in the game, not over a menu or the code console
    const ph=$('#phoneBtn');
    b.classList.toggle('hidden', !room || !ph || ph.classList.contains('hidden'));
    if(!on || !meter){ b.style.setProperty('--lvl', 0); return; }
    b.style.setProperty('--lvl', Math.min(1, rms(meter.an, meter.buf)*6).toFixed(2));
    const n=$('#voiceNear');
    n.querySelectorAll('[data-id]').forEach(el=>{
      const L=peers.get(Number(el.dataset.id));
      el.classList.toggle('talking', !!(L && L.an && level(L.d)>0.02 && rms(L.an, L.buf)>0.03));
    });
  }
  // who you can hear right now, nearest first
  let nearKey='';
  function paintNear(){
    const n=$('#voiceNear'); if(!n) return;
    const list=[...peers.values()].filter(L=>L.gain && level(L.d)>0.02).sort((a,b)=>a.d-b.d);
    const key=list.map(L=>L.id).join(',');
    if(key===nearKey) return;
    nearKey=key;
    n.classList.toggle('hidden', !list.length);
    n.innerHTML=list.map(L=>`<span data-id="${L.id}">🔊 ${esc(L.who)}</span>`).join('');
  }

  return { place, roster, hear, joined, lost, retry, toggle,
           get on(){ return on; }, get lines(){ return peers.size; }, _level:level,
           // for tests and the console: who we have a line to, how far, how loud
           _lines:()=>[...peers.values()].map(L=>({ id:L.id, who:L.who, d:+L.d.toFixed(1), state:L.pc.connectionState,
             gain:L.gain?+L.gain.gain.value.toFixed(3):null, sound:L.an?+rms(L.an,L.buf).toFixed(3):null })) };
})();
