/* =====================================================================
   THE OPENING — fifteen seconds in front of Mission 8, and it is about
   Ion.

   IT WAS ABOUT THE GAME FIRST, AND THAT WAS THE WRONG FILM. A planet
   turning in space with five lines about nine worlds tells a student what
   they have bought; it does not make them care about anything. The thing
   they are about to do is walk into a house and find a robot on the
   kitchen floor, and a film has one job here: make the robot matter
   before they meet him.

   SO IT IS A COLD OPEN ON ION. He is on the floor for the whole of it —
   the camera goes round him, comes down to his face, finds the ship
   smoking through the doorway and pulls out to the desert he has to be
   carried across. Nobody is introduced, nothing is explained, and no key
   is mentioned: the walkthrough on the ground does keys, and a film that
   opens with WASD is a manual with music.

   THE LAST LINE IS THE MISSION. "Get him to somebody who can look
   properly" is the whole of Mission 8, and it is said over the only shot
   with a horizon in it, because the answer is two hundred units away.

   HE IS THE REAL ION, off the same glb that lies on the Mechanic's cradle
   four levels later, laid out with the same three-axis Euler layIon uses.
   A stand-in would have been easier and the whole point is that the thing
   on the floor is the thing you pick up.

   SKIPPABLE ON ANY KEY, ONCE A SESSION. A class does not watch it twice.
   ===================================================================== */
window.OPENING = (function(){
  const $ = s => document.querySelector(s);
  const t_ = (s,p) => (typeof window.t==='function' ? window.t(s,p) : s);

  const R = 110;                  // Wano, at film scale
  const END = 15.4;

  /* One line per cut, and the cut lands ON the line. Nine words or fewer
     each: this is read once, at speed, by somebody who has just clicked a
     button and is waiting to play. */
  /* One line per cut, and the cut lands ON the line. Nine words or fewer:
     this is read once, at speed, by somebody waiting to play. */
  const SHOTS = [
    { at:0.0,  cap:'You came downstairs and he was on the floor.' },
    { at:2.9,  cap:'Ion has run this house since before you got here.' },
    { at:5.8,  cap:'Somebody opened him up in the night and left.' },
    { at:8.7,  cap:'Nobody here can look inside him properly.' },
    { at:11.6, cap:'Somebody across the desert can. Get him there.' }
  ];



  let on=false, clock=0, done=null, group=null;
  let shot=-1, keyed=null, hidden=[];
  let played=false;

  /* ---------------------------------------------------------------- play */
  function play(after, opts){
    opts=opts||{};
    if(on){ if(after) after(); return; }
    /* ONCE A SESSION unless somebody asks for it by name. `force` is what
       the menu passes when a student chooses to watch it again. */
    if(played && !opts.force){ if(after) after(); return; }
    played=true;
    done=after||null;
    on=true; clock=0; shot=-1;
    G.running=false;
    if(document.pointerLockElement) document.exitPointerLock();
    if(window.MENU && MENU.hideAll) MENU.hideAll();
    if(window.TITLE && TITLE.close) TITLE.close();
    if(window.AVATAR) AVATAR.detach();
    if(window.GUN) GUN.carried(false);
    /* WHAT IS PUT AWAY HAS TO COME BACK — the same rule intro.js learned.
       Hiding #hud hides the key hints and the code-console button with it,
       and handing over to the world without putting them back leaves a
       student playing with no HUD and no way to know C opens anything. */
    hidden=[];
    ['#hud','#briefing','#crosshair','#focus','#dash','#mapwrap'].forEach(sel=>{
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

  /* ----------------------------------------------------------- the set
     A floor, a robot on it, a doorway, and a smoking ship beyond it. Not
     the house from planet.js — that is a room built to be walked around
     in and this is four camera positions — but the same materials and the
     same dark, so walking in afterwards is walking into the film. */
  let ion=null, doorway=null, ship=null, puffs=[], floorMesh=null;

  function build(){
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    group=G.roomGroup;
    G.solids=[]; G.hits=[]; G.ground=null; G.ceiling=null;
    G.scene.background=new THREE.Color(0x0d0b1a);
    G.scene.fog=new THREE.Fog(0x0d0b1a, 60, 340);
    G.camera.near=0.1; G.camera.far=900; G.camera.updateProjectionMatrix();
    G.camera.up.set(0,1,0);

    /* NIGHT, AND ONE LAMP. It is four in the morning in this film and the
       whole of the first three cuts is one pool of light with a robot in
       it — which is the cheapest way to make a small set look like a set
       and the only honest way to light a house nobody has woken up in. */
    group.add(new THREE.AmbientLight(0x38406a, 0.55));
    const lamp=new THREE.PointLight(0xffd9a0, 22, 26, 1.8);
    lamp.position.set(-1.2, 3.6, 0.6); group.add(lamp);
    const cold=new THREE.DirectionalLight(0x86b6ff, 0.5);
    cold.position.set(6, 4, -8); group.add(cold);

    /* THE DESERT FIRST, AND THE KITCHEN ON TOP OF IT. One dark plane did
       for both, which is fine for three cuts indoors and leaves the last
       one — the only shot with a horizon in it, under the only line that
       is an instruction — as a black void with a ship in it. RYU is ochre
       and it is four in the morning; both of those should be visible the
       moment the camera gets outside. */
    const desert=new THREE.Mesh(new THREE.PlaneGeometry(900, 900),
      new THREE.MeshLambertMaterial({ color:0x6b5a3e }));
    desert.rotation.x=-Math.PI/2; desert.position.y=-0.04; group.add(desert);
    /* and a low moon over it, so the horizon is a horizon rather than an
       edge where the ground stops */
    const moon=new THREE.DirectionalLight(0x9fb4ff, 0.9);
    moon.position.set(-40, 18, -120); group.add(moon);

    floorMesh=new THREE.Mesh(new THREE.PlaneGeometry(22, 18),
      new THREE.MeshLambertMaterial({ color:0x3b3446 }));
    floorMesh.rotation.x=-Math.PI/2; floorMesh.position.z=2; group.add(floorMesh);
    const rug=new THREE.Mesh(new THREE.PlaneGeometry(7, 5),
      new THREE.MeshLambertMaterial({ color:0x4a3a52 }));
    rug.rotation.x=-Math.PI/2; rug.position.set(-0.4, 0.01, 0.2); group.add(rug);

    /* THE DOORWAY, and everything past it is outside. Two jambs and a
       lintel: the fourth cut looks through it at the ship, so it only has
       to be a hole in a wall from one direction. */
    doorway=new THREE.Group();
    const wallMat=new THREE.MeshLambertMaterial({ color:0x2a2536 });
    const jamb=(x)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(2.6,5.2,0.5), wallMat);
                      m.position.set(x, 2.6, 0); doorway.add(m); };
    jamb(-3.1); jamb(3.1);
    const lintel=new THREE.Mesh(new THREE.BoxGeometry(8.8,1.4,0.5), wallMat);
    lintel.position.set(0, 4.5, 0); doorway.add(lintel);
    /* AND THE WALL THE DOORWAY IS A HOLE IN. Two jambs and a lintel on
       their own are a door frame standing in the open, with the desert
       running straight past both sides of it — which is what the fourth
       cut showed: a floating rectangle and a horizon behind it. A doorway
       only reads as a doorway when there is something it is a way
       through. */
    [-1, 1].forEach(sx=>{
      const w=new THREE.Mesh(new THREE.BoxGeometry(26, 7.5, 0.5), wallMat);
      w.position.set(sx*17.4, 3.75, 0); doorway.add(w);
    });
    const over=new THREE.Mesh(new THREE.BoxGeometry(8.8, 2.4, 0.5), wallMat);
    over.position.set(0, 6.3, 0); doorway.add(over);
    doorway.position.set(0, 0, -7.5);
    group.add(doorway);

    /* THE SHIP, THROUGH IT. Her own hull, so the thing smoking in the
       doorway is the thing parked on the hillside ten seconds later. */
    ship=new THREE.Group();
    ship.position.set(1.5, 0.2, -30); ship.rotation.y=-0.55;
    group.add(ship);
    new THREE.GLTFLoader().load('ships/e45-hull.glb?v='+(window.ASSETV||'1'), gl=>{
      if(!on) return;
      const o=gl.scene;
      o.traverse(m=>{ if(m.isMesh){ m.frustumCulled=false;
        if(m.geometry.attributes.color){ m.material.vertexColors=true; m.material.needsUpdate=true; } } });
      o.updateMatrixWorld(true);
      const bx=new THREE.Box3().setFromObject(o);
      const len=(bx.max.z-bx.min.z)||1;
      o.scale.setScalar(11/len);
      o.updateMatrixWorld(true);
      const b2=new THREE.Box3().setFromObject(o);
      o.position.set(-(b2.min.x+b2.max.x)/2, -b2.min.y, -(b2.min.z+b2.max.z)/2);
      ship.add(o);
    }, undefined, ()=>{});

    /* AND SHE IS SMOKING, which is the fourth line's whole job. Pale, not
       dark: over a night sky, opacity IS brightness, and the first smoke
       this game ever drew was black and invisible. */
    puffs=[];
    for(let i=0;i<10;i++){
      const m=new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8),
        new THREE.MeshLambertMaterial({ color:0xd8d2e0, transparent:true,
                                        opacity:0.5, depthWrite:false }));
      m.userData={ t:i*0.45 };
      ship.add(m); puffs.push(m);
    }

    /* ION HIMSELF, ON HIS BACK. The same three-axis Euler layIon uses to
       put him on the Mechanic's cradle: about Z first, then about X, both
       a quarter turn back. A model stands up its own +Y and faces its own
       +Z, and laying one down is all three axes at once. */
    ion=new THREE.Group();
    ion.position.set(-0.4, 0.55, 0.2);
    ion.rotation.set(-Math.PI/2, 0, -Math.PI/2);
    group.add(ion);
    new THREE.GLTFLoader().load('characters/models/ion.glb?v='+(window.ASSETV||'1'), gl=>{
      if(!on) return;
      const r=gl.scene;
      r.traverse(o=>{ if(!o.isMesh) return;
        o.frustumCulled=false;
        if(o.geometry.attributes.color){ o.material.vertexColors=true; o.material.needsUpdate=true; } });
      r.updateMatrixWorld(true);
      const bx=new THREE.Box3().setFromObject(r);
      const h=bx.max.y-bx.min.y;
      if(h>1e-6) r.scale.setScalar(1.25/h);
      ion.add(r);
    }, undefined, ()=>{});

    /* THE PANEL SOMEBODY LEFT OPEN, which is the third line. One lit
       rectangle on his chest and a cover lying beside him on the floor. */
    const open_=new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.34),
      new THREE.MeshBasicMaterial({ color:0x6fe8c8 }));
    open_.position.set(-0.3, 0.72, 0.18); group.add(open_);
    const cover=new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.4),
      new THREE.MeshLambertMaterial({ color:0x6a6478 }));
    cover.position.set(0.75, 0.03, 0.55); cover.rotation.y=0.6; group.add(cover);
    const glow=new THREE.PointLight(0x6fe8c8, 3.0, 4, 1.8);
    glow.position.set(-0.3, 1.0, 0.18); group.add(glow);
  }

  /* --------------------------------------------------------------- screen
     The same letterbox, caption and title furniture intro.js uses, because
     it is the same kind of thing and a second look for it would be a
     second look for no reason. */
  function screen(){
    let el=$('#intro');
    if(!el){ el=document.createElement('div'); el.id='intro'; document.body.appendChild(el); }
    el.className='';
    el.innerHTML=`
      <div class="in-bar top"></div>
      <div class="in-bar bottom"></div>
      <div class="in-cap" id="inCap"></div>
      <div class="in-title" id="inTitle">ION</div>
      <button class="in-skip" id="inSkip">${t_('SKIP ▶')}</button>
      <div class="in-fade" id="inFade"></div>`;
    $('#inSkip').onclick=finish;
  }

  const cut = () => { let i=0; while(i+1<SHOTS.length && clock>=SHOTS[i+1].at) i++; return i; };

  function caption(){
    const i=cut();
    if(i===shot) return;
    shot=i;
    const c=$('#inCap'); if(!c) return;
    c.textContent=t_(SHOTS[i].cap);
    c.classList.remove('in-show'); void c.offsetWidth; c.classList.add('in-show');
    /* A BLACK FLASH ON EVERY CUT. One frame of nothing is what makes two
       camera positions read as two shots rather than as a teleport. */
    const f=$('#inFade');
    if(f && i>0){ f.classList.remove('in-flash'); void f.offsetWidth; f.classList.add('in-flash'); }
    /* and the name arrives on the last one */
    const ti=$('#inTitle');
    if(ti && i===SHOTS.length-1) ti.classList.add('in-show');
  }

  /* -------------------------------------------------------- the cameras
     Five setups, each with its own move, so no cut is a still. `k` runs 0
     to 1 across the cut it belongs to and every position is a lerp on it.

     THE FIRST THREE ARE ALL ON HIM and they are the whole of why this is a
     cold open: you are looking at a robot on a floor for nine seconds
     before anything explains itself. Four finds the doorway and five is
     the only shot with a horizon in it, because the answer to the mission
     is two hundred units away. */
  const lerp=(a,b,k)=>a+(b-a)*k;
  const ease=k=>k*k*(3-2*k);
  function camera(){
    const i=cut(), sh=SHOTS[i], next=SHOTS[i+1];
    const len=(next?next.at:END)-sh.at;
    const k=ease(Math.max(0, Math.min(1, (clock-sh.at)/len)));
    const c=G.camera, look=new THREE.Vector3(-0.4, 0.55, 0.2);

    if(i===0){
      /* HIGH AND STRAIGHT DOWN, coming lower. The shot somebody standing
         over him would have, which is the shot the line describes. */
      c.position.set(lerp(-0.2,-0.5,k), lerp(6.4,4.2,k), lerp(1.2,1.9,k));
    }
    else if(i===1){
      /* ROUND HIM, low, so the room arrives behind him. */
      const a=lerp(-0.5, 0.9, k), d=lerp(3.4, 2.7, k);
      c.position.set(-0.4+Math.sin(a)*d, lerp(1.5,1.0,k), 0.2+Math.cos(a)*d);
    }
    else if(i===2){
      /* IN ON THE OPEN PANEL. The closest the film gets to anything. */
      const d=lerp(2.2, 1.15, k);
      c.position.set(-0.3+Math.sin(2.3)*d, lerp(1.35,0.95,k), 0.18+Math.cos(2.3)*d);
      look.set(-0.3, 0.72, 0.18);
    }
    else if(i===3){
      /* PAST HIM AND THROUGH THE DOOR. He is in the bottom of frame and
         the ship is the thing that has arrived in it. */
      c.position.set(lerp(-0.6,-0.3,k), lerp(1.1,1.5,k), lerp(3.0,1.4,k));
      look.set(lerp(-0.4,0.9,k), lerp(0.6,1.9,k), lerp(0.2,-14,k));
    }
    else {
      /* OUTSIDE, WIDE, THE DESERT. The only horizon in the film, under
         the only line that is an instruction. */
      const d=lerp(16, 26, k);
      c.position.set(lerp(2,7,k), lerp(3.2,6.0,k), -30+d);
      look.set(1.5, 2.2, -30);
    }
    c.lookAt(look);
  }

  /* --------------------------------------------------------------- frame */
  function tick(dt){
    if(!on) return;
    clock+=dt;
    /* the smoke off her tail: up, out and away, then round again */
    puffs.forEach(m=>{
      m.userData.t += dt*0.55;
      if(m.userData.t>1) m.userData.t-=1;
      const u=m.userData.t;
      m.position.set(0.3+u*2.4, 1.4+u*8.0, 4.2+u*1.6);
      m.scale.setScalar(0.9+u*4.4);
      m.material.opacity = 0.62*(1-u);
    });
    camera();
    caption();
    if(clock>=END) finish();
  }

  /* ---------------------------------------------------------------- done */
  function finish(){
    if(!on) return;
    on=false;
    removeEventListener('keydown', keyed);
    removeEventListener('mousedown', keyed);
    keyed=null;
    const el=$('#intro'); if(el) el.className='in-out';
    hidden.forEach(sel=>{ const e=$(sel); if(e) e.classList.remove('hidden'); });
    hidden=[];
    if(group && G.roomGroup===group){ G.scene.remove(group); G.roomGroup=null; }
    group=null; ion=null; doorway=null; ship=null; puffs=[]; floorMesh=null;
    G.camera.up.set(0,1,0);
    const cb=done; done=null;
    setTimeout(()=>{ const e=$('#intro'); if(e && !on) e.remove(); }, 400);
    if(cb) cb();
  }

  /* WOUND BACK, for a mission that has just been restarted. `played` is a
     once-a-SESSION guard, which is the right rule for a session and the
     wrong one for a mission somebody has deliberately started again —
     planet.js calls this when it rewinds RYU, so the cold open comes back
     with the smoke and the robot on the floor. */
  function forget(){ if(!on) played=false; }

  return { play, tick, finish, forget,
           get active(){ return on; },
           get seen(){ return played; },
           /* so the menu can offer it again, and the tests can ask */
           get shots(){ return SHOTS; },
           get seconds(){ return END; } };
})();
