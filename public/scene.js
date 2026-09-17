/* =====================================================================
   SCENE — a story told in shots, over a room that is already standing.

   A cutscene in this game is not a video and it is not a separate mode.
   It is the room you are in, looked at from somewhere else, with a line
   of dialogue under it — so nothing has to be built twice and the cut
   back to play is not a cut at all, it is the camera letting go.

   A BEAT is one shot and at most one line:

     { who:'you', say:'Ion? Breakfast?',        'you' is the player, by name
       shot:{ eye:[x,y,z], at:[x,y,z] },   where the camera is, and on what
       ease:0.9,                           seconds to GLIDE there (0 cuts)
       hold:2.2,                           advance on a timer, or
       wait:()=>bool,                      advance when the world says so, or
       free:true,                          give the controls back and play
       on:fn, off:fn }                     fire once, entering and leaving

   WHY IT GLIDES. Cutting is the right verb for ten seconds of film in
   front of a mission — intro.js cuts four times and should. Inside a
   story the camera is standing in for the player's own attention, and
   attention moves; a hard cut to the floor of the next room reads as a
   different scene rather than as noticing something. Every move is eased
   in and out, from wherever the camera actually was, so a beat that
   starts behind the player's shoulder arrives without a seam.

   WHAT IT TAKES OVER. The camera, and only while a beat says so. `shot`
   means SCENE is driving: G.running goes false, step() stops, the player
   is still. `free` hands both back. A beat with neither keeps whatever
   the last one set, which is how a line of dialogue lands over a shot
   already held.

   NOTHING IN HERE KNOWS WHAT A HOUSE IS. The beats are the caller's.
   ===================================================================== */
window.SCENE = (function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const say_ = (s,p) => (typeof window.t==='function' ? window.t(s,p) : s);

  let beats=null, at=-1, on=false, ctx=null;
  /* NOT `t`. strings.js puts a global translation function called `t` on
     the page, and a module-level `let t` shadows it for every line in
     this file — so `window.t ? t(s) : s` tested the function and then
     called the number. Renaming it is the fix that cannot come back. */
  let clock=0, glide=0, glideFor=0;
  let fromEye=null, fromAt=null, toEye=null, toAt=null;
  let lookAt=null;                  // where the camera is pointed, tracked
  let held=0, waiter=null, armed=false;
  let ui=null;

  /* Ease in and out. A linear glide starts and stops abruptly, which on a
     camera reads as a shove; this is the same curve the whole industry
     uses for the same reason. */
  const smooth = u => u<=0 ? 0 : u>=1 ? 1 : u*u*(3-2*u);
  const V = a => new THREE.Vector3(a[0], a[1], a[2]);

  /* ------------------------------------------------------------- the DOM
     Built here rather than added to index.html: the bar and the fade are
     this module's own, nothing else draws them, and a page that has not
     loaded a scene should not carry two hidden divs about. */
  function dom(){
    if(ui) return ui;
    const css=document.createElement('style');
    css.textContent=`
      #scfade{position:fixed;inset:0;background:#0a0710;opacity:0;pointer-events:none;
              transition:opacity .45s ease;z-index:60}
      #scfade.on{opacity:1}
      #scbar{position:fixed;left:50%;transform:translateX(-50%);bottom:92px;
             width:min(760px,calc(100vw - 48px));z-index:61;
             display:flex;gap:14px;align-items:flex-end;pointer-events:none}
      #scbar.hidden{display:none}
      #scface{width:74px;height:74px;border-radius:14px;flex:0 0 auto;
              background:#241d33;border:2px solid #6b5f8f;object-fit:cover;
              object-position:50% 12%;box-shadow:0 8px 26px #0008}
      #scface.none{display:none}
      #sctext{flex:1;background:#1b1527ee;border:2px solid #6b5f8f;border-radius:16px;
              padding:13px 17px 15px;box-shadow:0 10px 30px #0009}
      #scwho{font:700 13px/1.1 ui-monospace,monospace;letter-spacing:.09em;
             text-transform:uppercase;color:#ffd8a8;margin-bottom:6px}
      #scsay{font:400 17px/1.45 system-ui,sans-serif;color:#f2ecff}
      #scmore{margin-top:7px;font:600 11px/1 ui-monospace,monospace;color:#9b8fc4;
              letter-spacing:.08em;text-align:right;opacity:0;transition:opacity .2s}
      #scmore.on{opacity:1;animation:scblink 1.1s ease-in-out infinite}
      @keyframes scblink{50%{opacity:.35}}`;
    document.head.appendChild(css);
    const fade=document.createElement('div'); fade.id='scfade';
    const bar=document.createElement('div'); bar.id='scbar'; bar.className='hidden';
    bar.innerHTML=`<img id="scface" alt=""><div id="sctext">
      <div id="scwho"></div><div id="scsay"></div>
      <div id="scmore"></div></div>`;
    document.body.appendChild(fade); document.body.appendChild(bar);
    ui={fade, bar, face:$('#scface',bar), who:$('#scwho',bar),
        text:$('#scsay',bar), more:$('#scmore',bar)};
    return ui;
  }

  /* ============================================== WHO IS SPEAKING
     A BEAT THAT SAYS `who:'you'` MEANS THE PLAYER, and this is the only
     place that knows what that resolves to.

     Every scene in this game used to name the player in the beat itself,
     which was fine for exactly as long as the player was always the same
     person. They are not: they arrive as whoever they picked, under
     whatever name they signed in with, so a scene cannot know what to
     write on the bar when it is authored.

     AND A NAME IS NOT TRANSLATED. `say_` runs every other label through
     the string table, which is right for `The Mechanic` and wrong for
     somebody's username — a student called `Mia` should not have their
     name quietly swapped for the Spanish for Mia. So the sentinel is
     resolved after translation and never through it. */
  const YOU='you';
  const nameOfYou = () => {
    try{ if(window.AVATAR && AVATAR.myName) return AVATAR.myName(); }catch(e){}
    try{ if(window.NET && NET.me && NET.me.display) return NET.me.display; }catch(e){}
    return say_('You');
  };
  const faceOfYou = () => {
    try{ if(window.AVATAR && AVATAR.myFace) return AVATAR.myFace(); }catch(e){}
    return null;
  };

  function line(b){
    const u=dom();
    if(!b.say){ u.bar.classList.add('hidden'); return; }
    u.bar.classList.remove('hidden');
    const mine = b.who===YOU;
    u.who.textContent = mine ? nameOfYou() : (b.who ? say_(b.who) : '');
    u.text.textContent = say_(b.say);
    const face = b.face || (mine ? faceOfYou() : null)
               || (ctx.faces && ctx.faces[b.who]) || null;
    u.face.className = face ? '' : 'none';
    if(face) u.face.src = face;
    /* The prompt only appears on a beat the player has to answer. A beat
       on a timer that also said "press space" would be a lie for as long
       as it took to run out. */
    u.more.textContent = say_('SPACE');
    u.more.classList.toggle('on', !b.hold && !b.wait);
  }

  function fade(onOff){ dom().fade.classList.toggle('on', !!onOff); }

  /* --------------------------------------------------------------- beats */
  function enter(i){
    const prev=beats[at];
    if(prev && prev.off) try{ prev.off(ctx); }catch(e){}
    at=i;
    const b=beats[at];
    if(!b){
      /* HOLD ON TO THE CONTEXT FIRST. stop() clears it, so reading ctx.end
         afterwards is a read off null — and because the guard sat outside
         the try, the whole scene ended and whatever was meant to happen
         next never did, silently. That is how the console stopped
         opening. */
      const fin = ctx && ctx.end;
      stop();
      if(fin) try{ fin(); }catch(e){ console.warn('SCENE: end handler threw', e); }
      return;
    }
    clock=0; held=0; armed=false;

    if(b.on) try{ b.on(ctx); }catch(e){}
    line(b);
    if(b.fade!==undefined) fade(b.fade);

    if(b.shot){
      /* FROM WHEREVER THE CAMERA ACTUALLY IS, not from the last beat's
         shot. The first cinematic beat of a scene starts behind the
         player's shoulder, and a glide that began at the previous
         SCRIPTED position would jump there first. */
      G.running=false;
      fromEye=G.camera.position.clone();
      fromAt =(lookAt||aimOf(G.camera)).clone();
      toEye=V(b.shot.eye); toAt=V(b.shot.at);
      glideFor = b.ease===undefined ? 0.9 : b.ease;
      glide=0;
      if(!glideFor){ G.camera.position.copy(toEye); G.camera.lookAt(toAt); lookAt=toAt.clone(); }
    }
    if(b.free){ toEye=null; lookAt=null; G.running=true; }
    /* A beat that is neither keeps the shot the last one set, which is how
       three lines of dialogue land over one held camera. */
    waiter = b.wait || null;
  }
  /* Where a camera is looking, as a point a little way down its own axis. */
  function aimOf(cam){
    const d=new THREE.Vector3(0,0,-1).applyQuaternion(cam.quaternion);
    return cam.position.clone().add(d.multiplyScalar(6));
  }

  function next(){ if(on) enter(at+1); }

  function tick(dt){
    if(!on) return;
    const b=beats[at]; if(!b) return;
    clock+=dt;

    if(toEye){
      if(glideFor>0 && glide<1){
        glide=Math.min(1, glide + dt/glideFor);
        const u=smooth(glide);
        G.camera.position.lerpVectors(fromEye, toEye, u);
        const l=fromAt.clone().lerp(toAt, u);
        G.camera.lookAt(l); lookAt=l;
      } else {
        G.camera.position.copy(toEye);
        G.camera.lookAt(toAt); lookAt=toAt.clone();
      }
    }

    /* ADVANCE. A held beat runs out, a waiting beat watches the world, and
       anything else waits for the player — but never before its glide has
       landed, or a fast reader skips the shot they were meant to see. */
    if(b.hold){ if(clock>=b.hold) next(); return; }
    if(waiter){ let ok=false; try{ ok=!!waiter(ctx); }catch(e){}
                if(ok) next(); return; }
    armed = !toEye || glide>=1 || clock>0.35;
  }

  /* SPACE, ENTER, E or a click — whichever a nine-year-old reaches for. */
  function key(e){
    if(!on) return false;
    const b=beats[at]; if(!b || b.hold || b.wait || !armed) return false;
    if(e && e.code && !['Space','Enter','KeyE','NumpadEnter'].includes(e.code)) return false;
    next();
    return true;
  }

  function play(list, c){
    stop(true);
    beats=(list||[]).filter(Boolean);
    ctx=c||{};
    if(!beats.length) return;
    on=true; lookAt=null;
    enter(0);
  }

  function stop(quiet){
    if(!on && quiet) { if(ui){ ui.bar.classList.add('hidden'); fade(false); } return; }
    const b=beats && beats[at];
    if(b && b.off) try{ b.off(ctx); }catch(e){}
    on=false; beats=null; at=-1; ctx=null;
    toEye=null; lookAt=null; waiter=null;
    if(ui){ ui.bar.classList.add('hidden'); fade(false); }
  }

  /* ============================================ WHO IS TALKING, OUT LOUD
     A BODY THAT SPEAKS SHOULD MOVE. Every character in this game stood
     perfectly still through every line they had, because the only thing
     driving a clip was whether the body was walking — and nobody walks
     during a cutscene. Four minutes of Mission 8 is people talking to each
     other, and all of it was delivered by statues.

     So the bar says who is speaking and anybody who wants to know can
     ask. This is the only place that knows, because this is the only
     place that has the beat.

     TWO CLIPS, ALTERNATING BY LINE. There are two talking animations and
     the reason to have two is that one, repeated across six consecutive
     lines, is a loop rather than a person. Which one is picked from the
     beat's own index, so the same line always animates the same way and
     two lines running never do. */
  const speakerOf = () => {
    if(!on) return null;
    const b=beats && beats[at];
    return (b && b.say) ? (b.who || null) : null;
  };

  return { play, tick, next, key, stop, fade,
           get active(){ return on; },
           get beat(){ return on ? at : -1; },
           /* The `who` of the line on screen, or null between lines. For
              the player this is the sentinel YOU rather than their name:
              a caller asking "is this me" should not have to know what
              the name resolved to. */
           get speaker(){ return speakerOf(); },
           get YOU(){ return YOU; },
           get playerTalking(){ return speakerOf()===YOU; },
           get talkClip(){ return (at % 2) ? 'talk2' : 'talk'; } };
})();
