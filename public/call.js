/* =====================================================================
   CALL — voice calls on the phone.

   The server introduces the two phones (server/calls.js) and then gets out
   of the way: the sound goes browser to browser over WebRTC, Opus at 48 kHz,
   so two machines in the same lab hear each other a few milliseconds after
   they speak rather than after a round trip to Render.

   WHAT MAKES IT QUICK, besides not going via the server:
     · 10 ms packets instead of the usual 20 — half the wait before a
       syllable is even sent;
     · the jitter buffer asked to hold as little as it can get away with;
     · forward error correction on, so a lost packet is patched rather than
       waited for;
     · discontinuous transmission off, so the first word after a pause is
       not clipped while the line wakes up.

   ONE CALL AT A TIME, and only to somebody who is online — a call to a
   phone nobody is holding is a text, and the phone already does those.
   ===================================================================== */
window.CALL = (function(){
  const $ = s => document.querySelector(s);
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let c = null;          // the call: {id, role, phase, with, pc, mic, muted, started, pending}
  let built = false, tickT = null, noteT = null;

  /* ------------------------------------------------------------ the bar
     One strip at the top of the screen for every state of a call, so it is
     there whether the phone is open or not — a call that only rings inside
     a closed phone is a call nobody answers. */
  function build(){
    if(built) return; built=true;
    const el=document.createElement('div');
    el.id='callBar'; el.className='hidden';
    el.innerHTML=`<span class="cb-av"></span>
      <div class="cb-mid"><b class="cb-name"></b><small class="cb-state"></small></div>
      <div class="cb-btns">
        <button type="button" class="cb-mute" title="${t('Mute')}">🎙️</button>
        <button type="button" class="cb-yes" title="${t('Answer')}">📞</button>
        <button type="button" class="cb-no" title="${t('Hang up')}">✕</button>
      </div>`;
    el.addEventListener('keydown', e=>e.stopPropagation());
    el.querySelector('.cb-yes').onclick=()=>answer();
    el.querySelector('.cb-no').onclick=()=>hang();
    el.querySelector('.cb-mute').onclick=()=>mute();
    document.body.appendChild(el);
  }
  function paint(){
    build();
    const el=$('#callBar');
    if(!c){ el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.dataset.phase=c.phase;
    el.querySelector('.cb-av').textContent=((c.with.display||c.with.username||'?')[0]||'?').toUpperCase();
    el.querySelector('.cb-name').innerHTML=`${esc(c.with.display||c.with.username)} <small>@${esc(c.with.username)}</small>`;
    el.querySelector('.cb-yes').classList.toggle('hidden', c.phase!=='incoming');
    el.querySelector('.cb-mute').classList.toggle('hidden', c.phase==='incoming');
    el.querySelector('.cb-mute').classList.toggle('on', !!c.muted);
    el.querySelector('.cb-mute').textContent = c.muted ? '🔇' : '🎙️';
    el.querySelector('.cb-no').title = c.phase==='incoming' ? t('Decline') : t('Hang up');
    state();
  }
  function state(txt){
    const s=$('#callBar .cb-state'); if(!s||!c) return;
    if(txt!==undefined){ s.textContent=txt; return; }
    if(c.phase==='dialing')    s.textContent=t('Calling…');
    if(c.phase==='ringing')    s.textContent=t('Ringing…');
    if(c.phase==='incoming')   s.textContent=t('is calling you');
    if(c.phase==='connecting') s.textContent=t('Connecting…');
    if(c.phase==='live'){
      const secs=Math.floor((Date.now()-c.started)/1000);
      s.textContent=`${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`+(c.rtt!=null?` · ${c.rtt} ms`:'')
        +(c.muted?` · ${t('muted')}`:'');
    }
  }
  /* What happened, for a few seconds after the call is gone. */
  function note(name, txt){
    build();
    const el=$('#callBar');
    el.classList.remove('hidden'); el.dataset.phase='over';
    el.querySelector('.cb-av').textContent='📞';
    el.querySelector('.cb-name').textContent=name||'';
    el.querySelector('.cb-state').textContent=txt;
    el.querySelectorAll('.cb-yes,.cb-mute').forEach(b=>b.classList.add('hidden'));
    el.querySelector('.cb-no').classList.add('hidden');
    clearTimeout(noteT);
    noteT=setTimeout(()=>{ if(!c){ el.classList.add('hidden'); el.querySelector('.cb-no').classList.remove('hidden'); } }, 3500);
  }

  /* ------------------------------------------------------------ the tones
     Made here rather than loaded: a ring is two sine waves. */
  let ac=null, toneT=null;
  function tone(kind){
    stopTone();
    if(!kind) return;
    try{ ac = ac || new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
    if(ac.state==='suspended') ac.resume().catch(()=>{});
    const burst=(f1,f2,len,at)=>{
      const g=ac.createGain(); g.gain.value=0; g.connect(ac.destination);
      const t0=ac.currentTime+at;
      g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(.08,t0+.02);
      g.gain.setValueAtTime(.08,t0+len-.03); g.gain.linearRampToValueAtTime(0,t0+len);
      for(const f of [f1,f2]){ const o=ac.createOscillator(); o.frequency.value=f; o.connect(g); o.start(t0); o.stop(t0+len); }
    };
    // incoming: brrring-brrring; ringback: the long tone you hear while it rings there
    const once = kind==='ring' ? ()=>{ burst(880,1320,.35,0); burst(880,1320,.35,.5); }
                               : ()=>{ burst(440,480,1.6,0); };
    once();
    toneT=setInterval(once, kind==='ring' ? 2600 : 4000);
  }
  function stopTone(){ clearInterval(toneT); toneT=null; }

  /* ------------------------------------------------------------ the mic */
  async function mic(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      throw new Error('This browser cannot make calls');
    try{
      return await navigator.mediaDevices.getUserMedia({ audio:{
        echoCancellation:true, noiseSuppression:true, autoGainControl:true,
        channelCount:1, sampleRate:48000, latency:0.01 }, video:false });
    }catch(e){
      throw new Error(e && e.name==='NotAllowedError' ? 'Allow the microphone to make calls' : 'No microphone found');
    }
  }

  /* ------------------------------------------------------------ the line */
  /* Opus, told to be quick: 10 ms frames, FEC on, DTX off, mono. */
  function quick(sdp){
    const m=/a=rtpmap:(\d+) opus\/48000/i.exec(sdp);
    if(!m) return sdp;
    const pt=m[1], want='minptime=10;useinbandfec=1;usedtx=0;stereo=0;sprop-stereo=0';
    const fmtp=new RegExp('a=fmtp:'+pt+' ([^\\r\\n]*)');
    sdp = fmtp.test(sdp)
      ? sdp.replace(fmtp, (all, params)=>{
          const kept=params.split(';').filter(x=>!/^(minptime|useinbandfec|usedtx|stereo|sprop-stereo)=/.test(x.trim()));
          return 'a=fmtp:'+pt+' '+kept.concat(want.split(';')).filter(Boolean).join(';');
        })
      : sdp.replace(m[0], m[0]+'\r\na=fmtp:'+pt+' '+want);
    if(!/a=ptime:/.test(sdp)) sdp=sdp.replace(/(m=audio[^\r\n]*\r\n)/, '$1a=ptime:10\r\n');
    return sdp;
  }
  function line(){
    const pc=new RTCPeerConnection({ iceServers:(window.NET&&NET.ice)||[{urls:'stun:stun.l.google.com:19302'}],
                                     bundlePolicy:'max-bundle', rtcpMuxPolicy:'require' });
    for(const tr of c.mic.getAudioTracks()){
      const sender=pc.addTrack(tr, c.mic);
      try{
        const p=sender.getParameters(); p.encodings=p.encodings&&p.encodings.length?p.encodings:[{}];
        p.encodings.forEach(e=>{ e.priority='high'; e.networkPriority='high'; e.maxBitrate=48000; });
        sender.setParameters(p).catch(()=>{});
      }catch(e){}
    }
    pc.onicecandidate=e=>{ if(e.candidate) sig({ cand:e.candidate.toJSON() }); };
    pc.ontrack=e=>{
      // as little buffering as the network allows (Chrome; ignored elsewhere)
      try{ e.receiver.jitterBufferTarget=0; }catch(err){}
      try{ e.receiver.playoutDelayHint=0; }catch(err){}
      let a=$('#callAudio');
      if(!a){ a=document.createElement('audio'); a.id='callAudio'; a.autoplay=true; a.playsInline=true; document.body.appendChild(a); }
      a.srcObject=e.streams[0] || new MediaStream([e.track]);
      a.play().catch(()=>{});
    };
    pc.onconnectionstatechange=()=>{
      if(!c || c.pc!==pc) return;
      const s=pc.connectionState;
      if(s==='connected' && c.phase!=='live'){
        c.phase='live'; c.started=Date.now(); tone(null); paint();
        clearInterval(tickT); tickT=setInterval(tick, 1000);
      }
      if(s==='failed'){
        const who=c.with.display;
        hang(true);
        note(who, t('Could not connect — this network may be blocking calls.'));
      }
    };
    c.pc=pc; c.pending=[];
    return pc;
  }
  function sig(d){ if(c && c.id) NET.call({ op:'sig', id:c.id, d }); }
  async function onSig(d){
    const pc=c && c.pc; if(!pc || !d) return;
    try{
      if(d.sdp){
        await pc.setRemoteDescription(d.sdp);
        for(const x of c.pending.splice(0)) await pc.addIceCandidate(x).catch(()=>{});
        if(d.sdp.type==='offer'){
          const ans=await pc.createAnswer();
          ans.sdp=quick(ans.sdp);
          await pc.setLocalDescription(ans);
          sig({ sdp:{ type:ans.type, sdp:ans.sdp } });
        }
      } else if(d.cand){
        if(pc.remoteDescription) await pc.addIceCandidate(d.cand).catch(()=>{});
        else c.pending.push(d.cand);
      }
    }catch(e){ console.warn('call:', e); }
  }
  /* How long a word takes to get there and back, from the browser's own count. */
  async function tick(){
    if(!c || !c.pc){ clearInterval(tickT); return; }
    try{
      const st=await c.pc.getStats();
      st.forEach(r=>{ if(r.type==='candidate-pair' && r.nominated && r.state==='succeeded' && r.currentRoundTripTime!=null)
        c.rtt=Math.round(r.currentRoundTripTime*1000); });
    }catch(e){}
    state();
  }

  /* ------------------------------------------------------------ actions */
  async function dial(username){
    username=String(username||'').toLowerCase().replace(/^@/,'');
    if(!username) return;
    if(c) return note(c.with.display, t('You are already on a call'));
    if(!(window.NET && NET.signedIn)) return note('', t('Sign in to make calls.'));
    if(!NET.live) return note('@'+username, t('Join a server to make calls.'));
    c={ id:0, role:'caller', phase:'dialing', with:{ username, display:username }, muted:false };
    paint();
    try{ c.mic=await mic(); }
    catch(e){ const who=c.with.display; c=null; paint(); return note(who, t(e.message)); }
    if(!c) return;
    if(!NET.call({ op:'ring', to:username })){ const who=c.with.display; cleanup(); note(who, t('Lost the server — trying to get back.')); }
  }
  async function answer(){
    if(!c || c.phase!=='incoming') return;
    tone(null);
    c.phase='connecting'; paint();
    try{ c.mic=await mic(); }
    catch(e){ const who=c.with.display; NET.call({ op:'decline', id:c.id }); cleanup(); return note(who, t(e.message)); }
    if(!c) return;
    line();
    NET.call({ op:'answer', id:c.id });
  }
  function hang(quiet){
    if(!c) return;
    if(c.id) NET.call({ op: c.phase==='incoming' ? 'decline' : 'hang', id:c.id });
    const who=c.with.display;
    cleanup();
    if(quiet!==true) note(who, t('Call ended'));
  }
  function mute(){
    if(!c || !c.mic) return;
    c.muted=!c.muted;
    c.mic.getAudioTracks().forEach(tr=>tr.enabled=!c.muted);
    paint();
  }
  function cleanup(){
    tone(null); clearInterval(tickT); tickT=null;
    if(c){
      if(c.pc) try{ c.pc.close(); }catch(e){}
      if(c.mic) c.mic.getTracks().forEach(tr=>tr.stop());
    }
    const a=$('#callAudio'); if(a) a.srcObject=null;
    c=null; paint();
  }

  /* ------------------------------------------------------------ the server */
  const ENDS = { declined:'Declined', missed:'No answer', cancelled:'Missed call', ended:'Call ended',
                 dropped:'Call dropped', muted:'Your teacher muted calls for now', elsewhere:'Answered somewhere else' };
  async function hear(m){
    if(m.op==='lost'){ if(c){ const who=c.with.display; cleanup(); note(who, t('Call dropped')); } return; }
    if(m.op==='fail'){
      if(!c || c.id) return;
      const who=c.with.display; cleanup();
      return note(who, t(m.reason||'Could not place that call', { n:who }));
    }
    if(m.op==='ringing'){
      if(!c || c.id || c.role!=='caller') return;
      c.id=m.id; c.with=m.with; c.phase='ringing'; tone('back'); paint(); return;
    }
    if(m.op==='ring'){
      if(c) return;           // the server would not have rung a busy line; another tab of ours has it
      c={ id:m.id, role:'callee', phase:'incoming', with:m.with, muted:false };
      tone('ring'); paint();
      return;
    }
    if(!c || m.id!==c.id) return;
    if(m.op==='answered' && c.role==='caller'){
      tone(null); c.phase='connecting'; paint();
      const pc=line();
      try{
        const offer=await pc.createOffer();
        offer.sdp=quick(offer.sdp);
        await pc.setLocalDescription(offer);
        sig({ sdp:{ type:offer.type, sdp:offer.sdp } });
      }catch(e){ console.warn('call:', e); hang(); }
      return;
    }
    if(m.op==='sig') return onSig(m.d);
    if(m.op==='end'){
      const who=c.with.display, how=m.how, mine=c.role;
      cleanup();
      if(how==='missed' && mine==='callee') return note(who, t('Missed call'));
      if(how==='cancelled' && m.by==='them') return note(who, t('Missed call'));
      if(how==='ended' && m.by==='them') return note(who, t('{n} hung up', { n:who }));
      if(how!=='ended' || m.by!=='you') note(who, t(ENDS[how]||'Call ended'));
    }
  }

  function start(){
    if(!window.NET) return;
    NET.onCall=m=>{ hear(m); };
    window.addEventListener('beforeunload', ()=>{ if(c) hang(true); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  return { dial, answer, hang, mute, get busy(){ return !!c; }, get phase(){ return c && c.phase; },
           _quick:quick };
})();
