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
    } else if(want) play(want);
  }

  function paint(){
    const b=document.querySelector('#btnMusic'); if(!b) return;
    b.textContent = muted ? '🔇' : '🎵';
    b.title = muted ? 'Music off' : 'Music on';
    b.setAttribute('aria-pressed', String(!muted));
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const b=document.querySelector('#btnMusic');
    if(b) b.onclick=()=>{ setMuted(!muted); if(window.beep) beep('pop'); };
    paint();
  });

  return { play, stop, setMuted, paint,
           get muted(){ return muted; },
           get track(){ return want; },
           /* Whether it is actually SOUNDING, which is not the same as
              whether it was asked to. A browser that refuses audio refuses
              it silently, so this is the only honest answer to "is the
              music on" — and the only way to tell a mute from a block. */
           get sounding(){ return !!(playing && !playing.paused); },
           get volume(){ return playing ? playing.volume : 0; } };
})();
