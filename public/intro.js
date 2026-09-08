/* =====================================================================
   INTRO — ten seconds of film in front of Space Explorer.

   It opens the mission it is about. A ship running an asteroid field is
   not a picture of "a coding game", it is a picture of THIS one: nine
   lanes, a wall of rock every beat, and a program written before the
   engine starts. Put in front of the sign-in it was a nice ten seconds
   about nothing in particular; put here it is the briefing, and every
   line of it is about the thing that starts the moment it ends.

   A student about to fly wants three things: what is coming at me, what
   am I supposed to do about it, and when. So it answers all three while
   something is happening — cut four ways, with one line of the answer
   over each cut.

   WHY FOUR CAMERAS AND NOT ONE. A single locked shot of a ship going
   forward is a screensaver. Cutting — behind it, alongside it, straight
   down the nose of it, then wide with the planet coming up — is what
   makes ten seconds read as an opening rather than as a wait, and every
   cut lands on a new sentence so the words and the pictures change
   together.

   IT IS SKIPPABLE ON ANY KEY, and it plays once a visit rather than on
   every attempt — the legs restart constantly, and a cinematic in front
   of a retry is a cinematic a class learns to hammer through. A student
   who wants it again gets it by coming back to the mission.

   It borrows the game's own renderer and its own scene group, so there
   is no second canvas and nothing to tear down but a group and a
   listener. The ship is the SHIP THE PLAYER OWNS — the same builder the
   shop and the launch pad use — so the thing on screen is theirs before
   they have landed.
   ===================================================================== */
window.INTRO = (function(){
  const $ = s => document.querySelector(s);

  /* `t` is the game's translator everywhere else in this codebase, so the
     clock is not allowed to be called that in here — shadowing it turned
     one button label into a crash. */
  let on=false, clock=0, done=null, group=null;
  let ship=null, rocks=[], hero=null, koro=null, stars=null, streaks=[];
  let shot=-1, keyed=null, hidden=[];

  /* Each cut, when it lands, and what is said over it. Two and a half
     seconds is about as long as one line of this can hold. */
  const FLIGHT_SHOTS=[
    { at:0.0,  cap:'Nine lanes. A wall of rock across every one of them but one.' },
    { at:2.6,  cap:'You do not fly it. You write the moves first — blocks, not typing.' },
    { at:5.2,  cap:'Then RUN, and the clock takes over. One block, one wall.' },
    { at:7.8,  cap:'Miss, and you are back on the start line. Change a block, go again.' }
  ];
  let SHOTS=FLIGHT_SHOTS, TITLE='SPACE EXPLORER';
  const END=10.6;
  const seen={};

  /* `opts.id` is what "once" is counted against, so a second film later on
     is not silenced by this one having played. */
  function play(after, opts){
    if(on) return;
    opts=opts||{};
    if(opts.id){
      if(seen[opts.id]){ if(after) after(); return; }
      seen[opts.id]=true;
    }
    SHOTS=opts.shots||FLIGHT_SHOTS;
    TITLE=opts.title||'SPACE EXPLORER';
    done=after||null;
    on=true; clock=0; shot=-1;
    G.running=false;
    if(document.pointerLockElement) document.exitPointerLock();
    if(window.MENU) MENU.hideAll();
    if(window.AVATAR) AVATAR.detach();
    if(window.GUN) GUN.update(0,false);
    /* WHAT IS PUT AWAY HAS TO COME BACK. The film hides the HUD so ten
       seconds of space is not shot through a health bar — and hiding #hud
       hides everything inside it, which is the key hints, the Esc line and
       the [C] Code Console button. Handing over to a mission without
       putting them back left the student flying the whole leg with no HUD
       at all and no way to see that C brings the console up. So the state
       of each one is written down here and restored on the way out. */
    hidden=[];
    ['#hud','#briefing','#crosshair','#focus'].forEach(sel=>{
      const e=$(sel); if(!e) return;
      if(!e.classList.contains('hidden')) hidden.push(sel);
      e.classList.add('hidden');
    });
    build();
    screen();
    keyed=e=>{ if(e.type==='keydown' && e.repeat) return; finish(); };
    addEventListener('keydown', keyed);
    addEventListener('mousedown', keyed);
  }

  /* ------------------------------------------------------------ the set */
  function build(){
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    group=G.roomGroup;
    G.solids=[]; G.hits=[]; G.ground=null; G.ceiling=null;
    G.scene.background=new THREE.Color(0x05060f);
    G.scene.fog=new THREE.Fog(0x05060f, 60, 260);
    G.camera.near=0.3; G.camera.far=1400; G.camera.updateProjectionMatrix();
    G.camera.up.set(0,1,0);

    group.add(new THREE.AmbientLight(0x8fa8ff, 0.35));
    const key=new THREE.DirectionalLight(0xfff2e0, 1.5);
    key.position.set(-30,40,20); group.add(key);
    const rim=new THREE.DirectionalLight(0x8ff0ff, 0.9);
    rim.position.set(40,-10,-40); group.add(rim);
    /* And one from dead ahead. The third cut looks the ship in the face, and
       with every light behind it that shot was a silhouette of something you
       could not identify. */
    const nose=new THREE.DirectionalLight(0xdfe8ff, 0.7);
    nose.position.set(-6,6,-40); nose.intensity=1.15; group.add(nose);

    // stars, thick enough to read as speed when they slide past
    const n=900, pos=new Float32Array(n*3);
    for(let i=0;i<n;i++){
      pos[i*3  ]=(Math.random()-0.5)*900;
      pos[i*3+1]=(Math.random()-0.5)*600;
      pos[i*3+2]=-Math.random()*1200;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos,3));
    stars=new THREE.Points(g, new THREE.PointsMaterial({ color:0xdfe8ff, size:2.0, fog:false }));
    stars.userData.sky=true; group.add(stars);

    /* KORO, a long way off and coming up. It is the hub's own colours, so
       the ball they are about to stand on is the ball in the last shot. */
    koro=new THREE.Group();
    /* Out of the fog. The fog is there to fade the asteroid field into the
       dark a couple of hundred metres out, and KORO is half a kilometre
       further than that — so the last shot's whole point was being painted
       the same colour as the sky it was in front of. */
    const ball=new THREE.Mesh(new THREE.SphereGeometry(120,48,32),
      new THREE.MeshLambertMaterial({color:0x39834a, fog:false}));
    koro.add(ball);
    const halo=new THREE.Mesh(new THREE.SphereGeometry(126,32,24),
      new THREE.MeshBasicMaterial({color:0x8ff0ff, transparent:true, opacity:0.16,
        side:THREE.BackSide, depthWrite:false, fog:false}));
    koro.add(halo);
    koro.position.set(38,-74,-640);
    koro.visible=false;
    group.add(koro);

    // the ship they own, at a size that reads against a rock
    ship=(window.SHOP && SHOP.model) ? SHOP.model() : new THREE.Group();
    ship.scale.setScalar(2.9);
    group.add(ship);

    /* The field. Rocks are recycled rather than made: sixty of them tumbling
       past forever costs nothing, and a field that runs out mid-shot is a
       field the last cut cannot use. */
    rocks=[];
    const rockMat=[0x8b8299,0x9a8677,0x7d7a8f].map(c=>
      new THREE.MeshLambertMaterial({color:c, flatShading:true}));
    for(let i=0;i<64;i++){
      const r=1.2+Math.random()*4.2;
      const m=new THREE.Mesh(new THREE.DodecahedronGeometry(r,0),
        rockMat[i%rockMat.length]);
      m.scale.set(1, 0.75+Math.random()*0.5, 0.8+Math.random()*0.6);
      place(m, true);
      m.userData.spin={ x:(Math.random()-0.5)*1.4, y:(Math.random()-0.5)*1.4,
                        z:(Math.random()-0.5)*1.0 };
      group.add(m); rocks.push(m);
    }
    /* One rock is not in the field: it is a stunt. It waits off-camera and
       comes past the lens on the third cut, which is the only moment in
       ten seconds where the speed is felt rather than watched. */
    hero=new THREE.Mesh(new THREE.DodecahedronGeometry(7.5,0), rockMat[1]);
    hero.position.set(60,10,-260);
    hero.userData.spin={x:0.5,y:0.35,z:0.2};
    group.add(hero);

    // speed lines, a few long thin boxes streaking with the field
    streaks=[];
    for(let i=0;i<26;i++){
      const s=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,10+Math.random()*26),
        new THREE.MeshBasicMaterial({color:0x9fd8ff, transparent:true, opacity:0.35}));
      place(s, true, 90);
      group.add(s); streaks.push(s);
    }
    G.scene.updateMatrixWorld(true);
  }
  /* Somewhere in a tube around the flight path, far enough out that the
     ship is not permanently inside a rock. */
  function place(m, anywhere, spread){
    const a=Math.random()*Math.PI*2, r=(spread?18:14)+Math.random()*(spread||46);
    m.position.set(Math.cos(a)*r, Math.sin(a)*r*0.6, anywhere ? -Math.random()*420 : -420);
  }

  /* --------------------------------------------------------- the screen */
  function screen(){
    let el=$('#intro');
    if(!el){
      el=document.createElement('div');
      el.id='intro';
      document.body.appendChild(el);
    }
    el.className='';
    el.innerHTML=`
      <div class="in-bar top"></div>
      <div class="in-bar bottom"></div>
      <div class="in-cap" id="inCap"></div>
      <div class="in-title" id="inTitle">${t_(TITLE)}</div>
      <button class="in-skip" id="inSkip">${t_('SKIP ▶')}</button>
      <div class="in-fade" id="inFade"></div>`;
    $('#inSkip').onclick=finish;
  }

  /* ------------------------------------------------------------- a frame */
  function tick(dt){
    if(!on) return;
    clock+=dt;
    field(dt);
    fly(dt);
    camera();
    caption();
    if(clock>=END) finish();
  }
  /* the field goes past; anything that reaches the camera goes to the back */
  function field(dt){
    const v=62*dt;
    rocks.forEach(m=>{
      m.position.z += v;
      const s=m.userData.spin;
      m.rotation.x+=s.x*dt; m.rotation.y+=s.y*dt; m.rotation.z+=s.z*dt;
      /* Recycled before it reaches the widest camera. The last cut pulls
         back past z=30, and a rock allowed to run to 40 slid through the
         lens as an unlit black wedge across the corner of the shot. */
      if(m.position.z>26) place(m,false);
    });
    streaks.forEach(m=>{ m.position.z += v*2.4; if(m.position.z>26) place(m,false,90); });
    if(stars) stars.position.z = (stars.position.z + v*0.12) % 300;
    koro.rotation.y += dt*0.05;
    // the planet comes up on the last cut, so it is arriving rather than parked
    /* KORO belongs to the last cut and only to it. Taking it out of the fog
       so it could be seen at all also meant it could be seen from the first
       frame, sitting behind the ship for the whole film and giving away the
       one thing the closing shot has to reveal. It arrives on the cut, and
       the black flash on the cut is what covers its arrival. */
    koro.visible = clock >= SHOTS[SHOTS.length-1].at - 0.05;
    koro.position.z = -640 + Math.max(0, clock-SHOTS[SHOTS.length-1].at)*75;
  }
  /* The ship weaves a little and banks into the weave, which is the whole
     difference between flying and being dragged along on a wire. */
  function fly(dt){
    const x=Math.sin(clock*0.9)*3.4, y=Math.sin(clock*0.62+1)*1.3;
    ship.position.set(x, y, 0);
    ship.rotation.z = -Math.cos(clock*0.9)*0.42;
    /* No half-turn here. SHOP builds its ships with the nose already on -Z
       — the same way every character and every car in this game faces +Z —
       so turning it round pointed the tail down the corridor and flew the
       whole opening backwards. */
    ship.rotation.y = Math.cos(clock*0.9)*0.10;
    ship.rotation.x = Math.sin(clock*0.62+1)*0.06;
    if(ship.userData.glow) ship.userData.glow.scale.z = 1.4+Math.sin(clock*22)*0.5;
    // the stunt rock, only for the third cut
    hero.position.set(30-clock*9, 12-clock*2.2, -260 + (clock-5.2)*150);
    hero.rotation.x+=dt*0.5; hero.rotation.y+=dt*0.35;
  }

  /* --------------------------------------------------------- the cameras
     Four setups, each with its own move so no cut is a still. */
  function camera(){
    const i=cut();
    const s=SHOTS[i], next=SHOTS[i+1];
    const len=(next?next.at:END)-s.at;
    const k=Math.max(0, Math.min(1, (clock-s.at)/len));     // 0→1 across this cut
    const p=ship.position;
    if(i===0){
      // behind the shoulder, easing in and up as the field opens out
      G.camera.position.set(p.x*0.4, p.y+2.2+k*1.2, 15-k*3.5);
      G.camera.lookAt(p.x, p.y, -30);
    } else if(i===1){
      // alongside, tracking, the ship crossing frame right to left
      G.camera.position.set(15-k*3.5, p.y+1.6, -7+k*11);
      G.camera.lookAt(p.x, p.y, -2);
    } else if(i===2){
      // down the nose, close, coming at the lens
      G.camera.position.set(p.x*0.6, p.y+0.6, -16+k*5);
      G.camera.lookAt(p.x, p.y, 0);
    } else {
      // wide, pulling up and away, the planet arriving under the nose
      const e=ease(k);
      G.camera.position.set(p.x*0.3 - 4 - e*10, p.y+3+e*9, 16+e*16);
      G.camera.lookAt(p.x*0.5, p.y-e*7, -60-e*120);
    }
    // a little life in the lens, more of it the closer the camera is
    const shake=(i===2?0.05:0.018);
    G.camera.position.x += Math.sin(clock*31)*shake;
    G.camera.position.y += Math.cos(clock*27)*shake;
  }
  const ease = k => k<0.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2;
  function cut(){
    let i=0;
    for(let j=0;j<SHOTS.length;j++) if(clock>=SHOTS[j].at) i=j;
    return i;
  }

  /* the words, and a black flash on every cut so it reads as an edit */
  function caption(){
    const i=cut();
    if(i!==shot){
      shot=i;
      const cap=$('#inCap'), fade=$('#inFade');
      if(cap){
        cap.textContent=t_(SHOTS[i].cap);
        cap.classList.remove('in-show');
        void cap.offsetWidth;                 // restart the fade
        cap.classList.add('in-show');
      }
      if(fade){
        fade.classList.remove('in-flash');
        void fade.offsetWidth;
        fade.classList.add('in-flash');
      }
    }
    const title=$('#inTitle');
    if(title) title.classList.toggle('in-show', clock>END-2.6);
  }
  const t_ = s => (window.t ? window.t(s) : s);

  /* ------------------------------------------------------------- the end */
  function finish(){
    if(!on) return;
    on=false;
    removeEventListener('keydown', keyed);
    removeEventListener('mousedown', keyed);
    keyed=null;
    const el=$('#intro');
    if(el){
      el.className='in-out';                 // fade the whole thing to black
      setTimeout(()=>{ if(!on && el.parentNode) el.remove(); }, 620);
    }
    group=null; ship=null; rocks=[]; streaks=[]; koro=null; stars=null;
    // back to how the screen was before the film, and THEN into the mission,
    // so whatever it wants hidden it hides itself
    hidden.forEach(sel=>{ const e=$(sel); if(e) e.classList.remove('hidden'); });
    hidden=[];
    const go=done; done=null;
    if(go) go();
  }

  return { play, tick, skip:finish, get active(){ return on; }, END, FLIGHT_SHOTS };
})();
