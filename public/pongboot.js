/* =====================================================================
   PONG, ON ITS OWN.

   The Pong room was written to sit inside KORO: a planet, a title screen,
   sign-in, Mission Control, and game.js underneath all of it holding the
   renderer, the scene, the camera, the keyboard and the frame loop in a
   global called G.

   None of that is Pong. What Pong actually needs from the engine is a
   canvas, a scene to put a court in, a camera to look through, somewhere
   to read the keyboard from, and something to call PONG.tick sixty times
   a second. That is this file — about a hundred lines standing in for
   forty thousand, so the standalone page can boot straight into the game
   with no account, no database and no server behind it.

   IT IS A SHIM, NOT A FORK. pong.js, vm.js, coder.js and blocks.js are
   the same files the full game loads, unmodified. If the game's Pong
   changes, this page gets the change; there is no second copy of
   anything to keep in step.
   ===================================================================== */
(function(){
  const $ = s => document.querySelector(s);

  /* ------------------------------------------------- what G has to be
     Read off what the three modules actually touch, which is far less
     than game.js provides: pong.js wants the scene, the camera, a group
     to build the court in and the lists the picker uses; vm.js wants the
     keyboard and somewhere to say the player is. Everything else it asks
     for — the avatar, the gun, the menus, the chat — it asks for through
     `window.X &&`, so leaving them undefined is the same as saying no. */
  const G = window.G = {
    renderer:null, scene:null, camera:null, roomGroup:null,
    solids:[], hits:[], ceiling:null, ground:()=>0,
    keys:{}, pos:{ x:0, y:0, z:0 },
    running:false, firstPerson:false,
    room:null, hudOwner:null, missionId:null, focused:null, selected:null
  };

  /* ------------------------------------------- the one borrowed global
     `looks.say` draws a speech bubble on a canvas, and to pick a typeface
     it calls uiFont(), which game.js defines. Without it every `say`
     threw a ReferenceError deep inside the VM — and the scheduler catches
     a throwing script, kills that thread and carries on, so the symptom
     was not an error on screen but the ball falling silent and the game
     refusing to end: `say "YOU WIN"` threw, and the `stop all` on the
     line under it never ran.

     Same definition as the game's, so a bubble looks the same on both. */
  let _face = null;
  window.uiFont = window.uiFont || function uiFont(){
    if(_face === null){
      try{ _face = getComputedStyle(document.documentElement)
                     .getPropertyValue('--font').trim(); }catch(e){ _face = ''; }
      if(!_face) _face = 'ui-monospace,Menlo,Consolas,monospace';
    }
    return _face;
  };

  function boot(){
    const canvas = $('#view');
    G.renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
    G.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    G.scene  = new THREE.Scene();
    /* A perspective camera, immediately replaced: PONG swaps in the VM's
       orthographic stage camera on its first tick, because a flat game is
       played by reading positions off the screen. This one exists so that
       the first frame has something to render through. */
    G.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 400);
    size();
    addEventListener('resize', size);

    /* THE KEYBOARD, WHICH IS THE WHOLE INPUT DEVICE. `key pressed?` reads
       G.keys by event.code, so W and S arrive as KeyW and KeyS. Held keys
       repeat, hence the guard: keydown fires over and over while a key is
       down and a paddle that re-triggered on each repeat would stutter. */
    addEventListener('keydown', e=>{
      if(typing(e.target)) return;
      G.keys[e.code] = true;
      /* the game's own shortcut for the editor, kept */
      if(e.code==='KeyC' && window.CODER){ e.preventDefault(); CODER.toggle(); }
      /* and stop the page scrolling under the court */
      if(['KeyW','KeyS','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup',   e=>{ G.keys[e.code] = false; });
    /* A key held while the tab loses focus is a key that is never let go
       of, and the paddle walks into the wall on its own. */
    addEventListener('blur', ()=>{ for(const k in G.keys) G.keys[k]=false; });

    if(window.VM) VM.useScratch();
    PONG.start();

    let last = performance.now();
    (function frame(now){
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);   // a tab that was
      last = now;                                       // hidden does not
      if(window.PONG && PONG.active) PONG.tick(dt);     // owe us the gap
      if(G.scene && G.camera) G.renderer.render(G.scene, G.camera);
    })(last);
  }
  /* somebody typing a number into a block is not steering a paddle */
  const typing = el => !!(el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' ||
                                 el.tagName==='SELECT' || el.isContentEditable));

  function size(){
    const w = innerWidth, h = innerHeight;
    G.renderer.setSize(w, h, false);
    if(G.camera.isPerspectiveCamera){
      G.camera.aspect = w / Math.max(1, h);
      G.camera.updateProjectionMatrix();
    }
  }

  /* WebGL can fail on a lab machine with no working driver, and a black
     page tells a child nothing. */
  if(!window.THREE){ fail('The 3D library did not load.'); return; }
  try{ boot(); }
  catch(e){ fail(e && e.message ? e.message : String(e)); }

  function fail(why){
    const el = document.createElement('div');
    el.className = 'pong-sorry';
    el.innerHTML = '<b>Pong could not start</b><small>'+
      String(why).replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+
      '</small><small>Try a different browser, or ask a teacher.</small>';
    document.body.appendChild(el);
    console.error('[pong]', why);
  }
})();
