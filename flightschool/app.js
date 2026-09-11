/* =====================================================================
   The host. Everything the full game does around Flight School, and
   nothing it does anywhere else.

   school.js expects to be inside KORO: a `G` with a scene and a camera in
   it, a frame loop calling tick, a Code Console wired to a run button, a
   C key, and something to tell when the last level is passed. It is not
   modified here — this file is the shape of the hole it fits into, which
   is the only way the standalone site and the game stay the same game.
   ===================================================================== */
(function(){
  'use strict';
  const $ = s => document.querySelector(s);

  /* ------------------------------------------------------------ the G */
  const G = window.G = {
    running:false, room:null, hudOwner:null, missionId:null,
    firstPerson:false, solids:[], hits:[], selected:null, focused:null,
    roomGroup:null, scene:null, camera:null, renderer:null
  };

  const canvas = $('#view');
  G.renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  G.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));  // lab-machine budget
  /* Filmic rather than clipping, and the same exposure as the game — the
     ship is a lit model and it should be the colour it is over there. */
  G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  G.renderer.toneMappingExposure = 1.05;
  G.scene  = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 220);

  /* school.js lights its own board. These are the game's room lights, which
     it is also standing in over there — without them the ship is the right
     shape and the wrong colour. No shadows: the board is flat, so there is
     nothing for them to fall on and they cost a shadow map. */
  G.scene.add(new THREE.AmbientLight(0xdfe6ff, 0.16));
  G.scene.add(new THREE.HemisphereLight(0xbfd8ff, 0xa88c6a, 0.46));
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.62);
  sun.position.set(48, 96, 34);
  G.scene.add(sun);

  function resize(){
    const w = innerWidth, h = innerHeight;
    G.renderer.setSize(w, h, false);
    G.camera.aspect = w / h;
    G.camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  /* --------------------------------------------------------- the HUD */
  /* school.js calls keyHint() to say what the keys do. In the game this is
     a shared line every room writes over; here it has exactly one author. */
  window.keyHint = function(html){
    const el = $('#keys'); if(!el) return;
    el.innerHTML = html || '';
    el.classList.toggle('hidden', !html);
  };

  /* The console button, on the same terms the game gives it: there is a
     mission running, and the console is not already open. */
  let btnState = null;
  function updateCodeBtn(){
    const btn = $('#codeBtn'); if(!btn) return;
    const usable = SCHOOL.active && !CODE.isOpen() && !menuUp();
    if(usable === btnState) return;
    btnState = usable;
    btn.classList.toggle('hidden', !usable);
    btn.classList.toggle('nudge', usable);
    $('#codeBtnTxt').textContent = t('Code Console');
    btn.onclick = () => { CODE.show(); updateCodeBtn(); };
  }
  window.updateCodeBtn = updateCodeBtn;

  const menuUp = () => !$('#fsMenu').classList.contains('hidden')
                    || !$('#fsDone').classList.contains('hidden');

  /* ------------------------------------------------------------ input */
  const typing = e => {
    const n = e.target;
    return n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.isContentEditable);
  };
  addEventListener('keydown', e => {
    if(typing(e)) return;
    if(e.code === 'KeyC' && SCHOOL.active && !CODE.isOpen() && !menuUp()){
      e.preventDefault(); CODE.show(); updateCodeBtn(); return;
    }
    if(e.code === 'Escape' && CODE.isOpen()){ CODE.close(); updateCodeBtn(); return; }
    /* R re-flies the level you are on. On a board where a wrong program
       leaves the ship parked in the wrong place, "put it back" is the most
       common thing anybody wants and it should not be a menu. */
    if(e.code === 'KeyR' && SCHOOL.active && !CODE.isOpen() && !menuUp()){
      e.preventDefault(); SCHOOL.retry();
    }
  });

  /* RUN, in a game with one thing that runs. */
  CODE.onRun = () => { if(SCHOOL.active) SCHOOL.run(); };

  /* ------------------------------------------------------- the finish */
  /* school.js hands the last level to PROGRESS and lets IT decide what
     comes next — in the game, the planet. Without one it falls through to
     "start the next level", and the next level after the last one is the
     last one, forever. So there is one here, and it is the finish card. */
  /* And school.js hands it the level it is OPENING, too, so it can be handed
     back tomorrow. There is no account out here to hang it on, so it hangs on
     the browser — which is the right scope for a site with no sign-in, and is
     where this page already keeps the language. */
  const AT_KEY = 'fs_at';
  window.PROGRESS = {
    complete(){
      try{ localStorage.removeItem(AT_KEY); }catch(e){}   // beaten: replay from one
      setTimeout(()=>{ SCHOOL.stop(); show('#fsDone'); }, 1400);
    },
    reach(id, n){
      const want = Math.max(0, n|0);
      if(want <= PROGRESS.reached()) return;              // only ever forward
      try{ localStorage.setItem(AT_KEY, String(want)); }catch(e){}
      startLabel();
    },
    reached(){
      let n = 0;
      try{ n = +localStorage.getItem(AT_KEY) || 0; }catch(e){}
      return Math.max(0, Math.min(SCHOOL.LEVELS.length - 1, n));
    }
  };
  /* The big green button is the one everybody presses, so it has to say
     honestly which level it is about to open. The list under it is still how
     you go back to an earlier one. */
  function startLabel(){
    const at = PROGRESS.reached(), el = $('#fsStart');
    if(el) el.textContent = at
      ? t('Carry on — level {n} ▶', { n: at + 1 })
      : t('Start at level 1 ▶');
  }

  /* ------------------------------------------------------- the screens */
  function show(sel){
    ['#fsMenu', '#fsDone'].forEach(s =>
      $(s).classList.toggle('hidden', s !== sel));
    $('#hud').classList.toggle('hidden', !!sel);
    updateCodeBtn();
  }
  function play(n){
    show(null);
    SCHOOL.start(n);
    updateCodeBtn();
  }

  function levels(){
    const box = $('#fsLevels');
    box.innerHTML = SCHOOL.LEVELS.map((k, i) =>
      `<button data-n="${i}"><b>${i+1}. ${esc(t(k.name))}</b>
         <span>${esc(t(k.learn.name))}</span></button>`).join('');
    box.querySelectorAll('button').forEach(b =>
      b.onclick = () => play(+b.dataset.n));
  }
  const esc = s => String(s).replace(/[&<>"]/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* ----------------------------------------------------------- wording */
  /* strings.js came along for the ride, so the standalone site speaks both
     languages the lab does. The choice outlives the tab. */
  const COPY = [
    ['#fsTitle', 'FLIGHT SCHOOL'],
    ['#fsTag',   'Coordinates, turns and glides — on a four-quadrant grid.'],
    ['#fsBlurb', 'You write a short program. The ship flies it. Nothing on this board moves until you tell it to.'],
    ['#fsStart', 'Start at level 1 ▶'],
    ['#objTitle','MISSION'],
    ['#fsDoneTitle', 'Flight school passed'],
    ['#fsDoneText',  'Ten levels, all four quadrants, and every Motion block: move, the two turn arrows, point, go to, glide and the coordinates.'],
    ['#fsAgain', 'Back to the levels'],
    ['#fsHome',  '☰ Levels']
  ];
  function words(){
    COPY.forEach(([sel, en]) => { const el = $(sel); if(el) el.textContent = t(en); });
    $('#fsFoot').innerHTML = t('Press <b>C</b> to open the console, <b>RUN</b> to fly it.');
    levels();
    startLabel();                          // after COPY, which writes over it
    if(SCHOOL.active) SCHOOL.retry();      // redraw the board's own labels
    updateCodeBtn();
  }
  function lang(code){
    window.LANG = code;
    try{ localStorage.setItem('fs_lang', code); }catch(e){}
    document.documentElement.lang = code;
    document.querySelectorAll('.langbtn').forEach(b =>
      b.classList.toggle('on', b.dataset.lang === code));
    words();
  }
  document.querySelectorAll('.langbtn').forEach(b =>
    b.onclick = () => lang(b.dataset.lang));

  /* -------------------------------------------------------------- go */
  $('#fsStart').onclick = () => play(PROGRESS.reached());
  $('#fsAgain').onclick = () => { SCHOOL.stop(); show('#fsMenu'); };
  $('#fsHome').onclick  = () => { SCHOOL.stop(); CODE.close(); show('#fsMenu'); };

  let saved = 'en';
  try{ saved = localStorage.getItem('fs_lang') || 'en'; }catch(e){}
  lang(saved === 'es' ? 'es' : 'en');
  show('#fsMenu');

  let last = performance.now();
  (function loop(now){
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if(SCHOOL.active) SCHOOL.tick(dt);
    updateCodeBtn();
    G.renderer.render(G.scene, G.camera);
  })(last);
})();
