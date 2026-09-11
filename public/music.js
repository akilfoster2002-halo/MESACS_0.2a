/* =====================================================================
   MUSIC — the soundtrack.

   The first sound this game has ever made. Ten files call beep() and
   nothing has ever defined it, so everything here is new ground, and two
   things follow from that.

   IT HAS TO BE MUTABLE, and obviously so. This is played in a lab, thirty
   machines to a room, and a soundtrack you cannot find the off switch for
   is a soundtrack a teacher bans on day one. The button sits in the top
   bar next to the language toggle and the choice is remembered.

   AND IT CANNOT ASSUME IT IS ALLOWED TO PLAY. Every browser refuses audio
   until the person has done something — a click, a key — and refuses it
   SILENTLY, as a rejected promise nobody is obliged to catch. By the time
   you are on the planet there has been a START and a sign-in, so it will
   normally be fine; when it is not, this waits for the next thing you do
   and tries again rather than being quietly dead for the whole lesson.
   ===================================================================== */
window.MUSIC = (function(){
  const TRACKS = {
    /* KORO's theme. It plays out on the hub — the planet the missions are
       on — and nowhere else: not on the title, not indoors, not on VOLTA
       and not between them. A theme that follows you everywhere is not a
       theme, it is a hold tone. */
    hub: 'music/ludus-main-theme.mp3'
  };
  const KEY='dq_music';
  const FULL=0.55;            // a soundtrack, not a foreground
  const FADE_IN=1.4, FADE_OUT=0.7;

  let els={}, want=null, playing=null, muted=read(), armed=false, ramp=null;

  function read(){ try{ return localStorage.getItem(KEY)==='off'; }catch(e){ return false; } }
  function save(){ try{ localStorage.setItem(KEY, muted?'off':'on'); }catch(e){} }

  /* Built on first use rather than at load: the title screen is already
     pulling twenty character models down, and four megabytes of music
     racing them is four megabytes the models are not getting. */
  function element(id){
    if(els[id]) return els[id];
    const a=new Audio();
    a.src=TRACKS[id];
    a.loop=true;
    a.preload='auto';
    a.volume=0;
    a.addEventListener('error', ()=>console.warn('music failed to load:', TRACKS[id]));
    return els[id]=a;
  }

  /* One ramp at a time, on rAF rather than a timer, so a fade cannot
     outlive the thing it is fading — walking in and out of a building
     twice in a second used to leave two of these fighting. */
  function fade(a, to, secs, then){
    if(ramp) cancelAnimationFrame(ramp);
    /* A HIDDEN TAB DOES NOT ANIMATE. requestAnimationFrame stops when the
       page is in the background, so a fade started there never finishes and
       never runs the thing waiting on its end — which meant walking indoors
       or muting in a backgrounded tab left the music playing for ever. If
       nobody is looking, skip to the answer. */
    if(document.hidden){ a.volume=Math.max(0, Math.min(1, to)); if(then) then(); return; }
    const from=a.volume, t0=performance.now(), ms=Math.max(1, secs*1000);
    (function step(now){
      const k=Math.min(1, (now-t0)/ms);
      a.volume=Math.max(0, Math.min(1, from+(to-from)*k));
      if(k<1) ramp=requestAnimationFrame(step);
      else { ramp=null; if(then) then(); }
    })(performance.now());
  }

  /* A refused play() is not an error — it is the browser saying "not yet".
     Ask again the next time the person touches anything. */
  function arm(){
    if(armed) return;
    armed=true;
    const go=()=>{
      window.removeEventListener('pointerdown', go, true);
      window.removeEventListener('keydown', go, true);
      armed=false;
      if(want) play(want);
    };
    window.addEventListener('pointerdown', go, true);
    window.addEventListener('keydown', go, true);
  }

  function play(id){
    want=id;
    if(!TRACKS[id]){ stop(); return; }
    if(muted) return;
    const a=element(id);
    if(playing && playing!==a){ const old=playing; fade(old, 0, FADE_OUT, ()=>old.pause()); }
    playing=a;
    const p=a.play();
    if(p && p.catch) p.catch(()=>arm());
    fade(a, FULL, FADE_IN);
  }

  function stop(){
    want=null;
    if(!playing) return;
    const a=playing; playing=null;
    fade(a, 0, FADE_OUT, ()=>{ a.pause(); try{ a.currentTime=0; }catch(e){} });
  }

  function setMuted(on){
    muted=!!on; save(); paint();
    /* MUTE IS NOT A FADE. You press it because you want silence now —
       usually because a teacher just started talking — so it stops dead.
       Fades are for walking through doors. */
    if(muted){
      if(ramp){ cancelAnimationFrame(ramp); ramp=null; }
      if(playing){ playing.pause(); playing.volume=0; }
      // the wind is sound too, and mute means all of it — stopped dead, like the music
      if(offAt){ clearTimeout(offAt); offAt=0; }
      stopWind();
    } else if(want) play(want);
  }

  /* ================================================================ wind
     THE SOUND OF FLYING, MADE RATHER THAN FETCHED.

     Everything above plays a file, and there is no file for this — the
     repo carries one piece of music and adding a rushing-air loop means
     adding a binary to a project whose whole claim is that it runs from a
     plain folder. So this synthesises it.

     That is not a workaround. Wind IS filtered noise: air moving past an
     edge, broadband, with the pitch of it set by how fast. Two seconds of
     white noise through a bandpass that opens up as you speed up is not an
     impression of the sound, it is the sound, and it costs nothing to ship
     and nothing to load.

     It rides the same mute as the music, because a teacher who wants
     silence wants silence and does not care which subsystem is making it. */
  const WIND={ lo:260, hi:1500, top:0.17, ease:0.14 };
  let ctx=null, noise=null, air=null, band=null, level=0, offAt=0;

  function audio(){
    if(ctx) return ctx;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return null;
    try{ ctx=new AC(); }catch(e){ return null; }
    return ctx;
  }
  /* Two seconds of it, looped. Long enough that the loop point is not a
     rhythm you can hear, short enough to build in a frame. */
  function noiseBuffer(c){
    if(noise) return noise;
    const n=Math.floor(c.sampleRate*2);
    noise=c.createBuffer(1, n, c.sampleRate);
    const d=noise.getChannelData(0);
    /* Averaged with the sample before it — white noise is harsh and hissy,
       and one pole of smoothing is the difference between a broken speaker
       and moving air. */
    let last=0;
    for(let i=0;i<n;i++){ const w=Math.random()*2-1; last=(last+w*0.42)/1.42; d[i]=last*1.6; }
    return noise;
  }
  function startWind(){
    const c=audio(); if(!c || air) return;
    if(c.state==='suspended') c.resume().catch(()=>{});
    const src=c.createBufferSource();
    src.buffer=noiseBuffer(c); src.loop=true;
    band=c.createBiquadFilter(); band.type='bandpass'; band.Q.value=0.7;
    band.frequency.value=WIND.lo;
    air=c.createGain(); air.gain.value=0;
    src.connect(band); band.connect(air); air.connect(c.destination);
    src.start();
    air.src=src;
  }
  function stopWind(){
    if(!air) return;
    try{ air.src.stop(); }catch(e){}
    try{ air.disconnect(); band.disconnect(); }catch(e){}
    air=null; band=null;
  }
  /* `x` is how hard the air is going past: 0 standing still, 1 flat out.
     Everything is ramped rather than set — setTargetAtTime is a one-pole
     glide, so a burst of speed opens the filter over a moment instead of
     stepping it, which is the difference between wind and a switch. */
  function wind(x){
    level=Math.max(0, Math.min(1, x||0));
    if(muted || !level){
      if(air){
        air.gain.setTargetAtTime(0, ctx.currentTime, 0.10);
        /* Faded first, then torn down — ON A TIMER, not on the next call.
           The last thing a landing does is ask for silence once and then
           stop asking, so a teardown waiting to be polled waits for ever:
           a noise source looping at zero for the rest of the lesson. */
        if(!offAt) offAt=setTimeout(()=>{ offAt=0; if(!level) stopWind(); }, 700);
      }
      return;
    }
    if(offAt){ clearTimeout(offAt); offAt=0; }
    if(!air) startWind();
    if(!air) return;
    const now=ctx.currentTime;
    air.gain.setTargetAtTime(WIND.top*level*level, now, WIND.ease);
    band.frequency.setTargetAtTime(WIND.lo+(WIND.hi-WIND.lo)*level, now, WIND.ease);
  }
  /* The push off the ground: the same noise, swept up and let go. Short,
     because a take-off is. */
  function whoosh(){
    const c=audio(); if(!c || muted) return;
    if(c.state==='suspended') c.resume().catch(()=>{});
    const src=c.createBufferSource(); src.buffer=noiseBuffer(c);
    const f=c.createBiquadFilter(); f.type='bandpass'; f.Q.value=1.1;
    const g=c.createGain();
    const t=c.currentTime;
    f.frequency.setValueAtTime(180,t); f.frequency.exponentialRampToValueAtTime(1900,t+0.45);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.22,t+0.08);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.6);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t); src.stop(t+0.65);
  }

  /* Two buttons wear this state — the one in the top bar and the one in the
     pause menu — and the pause menu's is rebuilt from scratch every time it
     opens. So painting is one function that finds whichever of them exist
     rather than something the caller has to remember to do. */
  const say = k => (window.t ? t(k) : k);
  function paint(){
    const icon = muted ? '🔇' : '🎵';
    const label = muted ? say('Music off') : say('Music on');
    const bar=document.querySelector('#btnMusic');
    if(bar){ bar.textContent=icon; bar.title=label;
             bar.setAttribute('aria-pressed', String(!muted)); }
    /* The pause menu is read standing still, so it gets words. The top bar
       is glanced at mid-game, so it gets a glyph. */
    const pause=document.querySelector('#pMusic');
    if(pause){ pause.textContent=icon+' '+label;
               pause.setAttribute('aria-pressed', String(!muted)); }
  }
  /* What the pause menu calls when its button is pressed. It rebuilds its
     own markup, so it wires this itself and then asks for a repaint. */
  function toggle(){ setMuted(!muted); if(window.beep) beep('pop'); }

  document.addEventListener('DOMContentLoaded', ()=>{
    const b=document.querySelector('#btnMusic');
    if(b) b.onclick=toggle;
    paint();
  });

  return { play, stop, setMuted, paint, toggle, wind, whoosh,
           get muted(){ return muted; },
           get windy(){ return level; },
           get track(){ return want; },
           /* Whether it is actually SOUNDING, which is not the same as
              whether it was asked to. A browser that refuses audio refuses
              it silently, so this is the only honest answer to "is the
              music on" — and the only way to tell a mute from a block. */
           get sounding(){ return !!(playing && !playing.paused); },
           get volume(){ return playing ? playing.volume : 0; } };
})();
