/* =====================================================================
   THE OPENING — fifteen seconds in front of the whole game.

   WHAT IT IS FOR. A student presses START and lands on a hillside outside
   a building, with a HUD, a map, a coin counter and nothing anywhere
   saying what any of it is for. intro.js already does this job for one
   mission — ten seconds of a ship running an asteroid field, which is a
   picture of THAT mission rather than of "a coding game" — and the game
   as a whole had nothing. This is the same idea one level up: what the
   world is, why anybody needs you on it, and what you will actually be
   doing, answered while something is happening.

   IT ANSWERS FIVE THINGS IN ORDER, one per cut, because that is the order
   somebody wants them: where am I, what is wrong, what do I do about it,
   how big is this, and what is it called. Nothing here is a mechanic
   explanation — no keys, no buttons. The walkthrough on the ground does
   keys. A film that opens with WASD is a manual with music.

   THE SET IS SENIO, AND IT IS THE REAL ONE. Same radius, same ochre-and-
   green soil, buildings at the longitudes they actually stand at, so the
   ball in the last shot is the ball they are standing on eight seconds
   later. title.js already renders it live behind the menu for exactly
   this reason; this is the same world with a camera that moves.

   SKIPPABLE ON ANY KEY, ONCE A SESSION. A cinematic a class has to sit
   through twice is a cinematic a class learns to hammer through, and a
   teacher restarting a lesson should not have to watch it again. Anybody
   who wants it back gets it from the menu.
   ===================================================================== */
window.OPENING = (function(){
  const $ = s => document.querySelector(s);
  const t_ = (s,p) => (typeof window.t==='function' ? window.t(s,p) : s);

  const R = 110;                  // Senio, at film scale
  const END = 15.4;

  /* One line per cut, and the cut lands ON the line. Nine words or fewer
     each: this is read once, at speed, by somebody who has just clicked a
     button and is waiting to play. */
  const SHOTS = [
    { at:0.0,  cap:'This is Senio. A whole world, and it curves.' },
    { at:2.9,  cap:'Every machine on it runs on code somebody wrote.' },
    { at:5.8,  cap:'Walk in any door and something has stopped working.' },
    { at:8.7,  cap:'Not by hand. You write the rule it follows.' },
    { at:11.6, cap:'Nine worlds. One ship. Start wherever you like.' }
  ];

  let on=false, clock=0, done=null, group=null;
  let ball=null, spin=null, stars=null, ships=[], shot=-1, keyed=null, hidden=[];
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

  /* ----------------------------------------------------------- the world */
  /* Senio's own height field, cut down to what a fifteen-second film can
     show: four octaves of value noise on the unit sphere, the same shape
     planet.js builds the real ball from. It is not the same function — the
     real one lives inside planet.js and is not for export — but it is the
     same KIND of ground, which is what the shot needs. */
  function hash3(i,j,k){
    let h=Math.imul(i,374761393)+Math.imul(j,668265263)+Math.imul(k,1442695041);
    h=Math.imul(h^(h>>>13), 1274126177);
    return ((h^(h>>>16))>>>0)/4294967296;
  }
  function noise(x,y,z){
    const i=Math.floor(x), j=Math.floor(y), k=Math.floor(z);
    const fx=x-i, fy=y-j, fz=z-k;
    const u=fx*fx*(3-2*fx), v=fy*fy*(3-2*fy), w=fz*fz*(3-2*fz);
    const L=(a,b,t)=>a+(b-a)*t;
    return L(L(L(hash3(i,j,k),     hash3(i+1,j,k),     u),
               L(hash3(i,j+1,k),   hash3(i+1,j+1,k),   u), v),
             L(L(hash3(i,j,k+1),   hash3(i+1,j,k+1),   u),
               L(hash3(i,j+1,k+1), hash3(i+1,j+1,k+1), u), v), w);
  }
  const land = d => noise(d.x*2.2+9, d.y*2.2+4, d.z*2.2+7)*0.62
                  + noise(d.x*5.1, d.y*5.1, d.z*5.1)*0.26
                  + noise(d.x*11, d.y*11, d.z*11)*0.12;

  function build(){
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    group=G.roomGroup;
    G.solids=[]; G.hits=[]; G.ground=null; G.ceiling=null;
    G.scene.background=new THREE.Color(0x05060f);
    G.scene.fog=null;                       // a planet in space is not foggy
    G.camera.near=0.3; G.camera.far=4000; G.camera.updateProjectionMatrix();
    G.camera.up.set(0,1,0);

    group.add(new THREE.AmbientLight(0x93a6d8, 0.45));
    const key=new THREE.DirectionalLight(0xfff3e2, 1.6);
    key.position.set(-160, 120, 180); group.add(key);
    const rim=new THREE.DirectionalLight(0x7fe8ff, 0.85);
    rim.position.set(180, -40, -140); group.add(rim);

    /* stars */
    const n=1400, sp=new Float32Array(n*3);
    for(let i=0;i<n;i++){
      const u=Math.random()*2-1, th=Math.random()*Math.PI*2, r=1500+Math.random()*900;
      const s=Math.sqrt(1-u*u);
      sp[i*3]=Math.cos(th)*s*r; sp[i*3+1]=u*r; sp[i*3+2]=Math.sin(th)*s*r;
    }
    const sg=new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp,3));
    stars=new THREE.Points(sg, new THREE.PointsMaterial({ color:0xdfe8ff, size:3.2 }));
    group.add(stars);

    /* THE BALL. `spin` turns; everything standing on it is a child of it,
       so the buildings go round with the ground rather than hovering over
       a rotating texture. */
    spin=new THREE.Group(); group.add(spin);

    const geo=new THREE.SphereGeometry(R, 96, 64);
    const pos=geo.attributes.position, col=new Float32Array(pos.count*3);
    const d=new THREE.Vector3();
    const SOIL=[[0.20,0.30,0.46],[0.62,0.55,0.38],[0.35,0.52,0.30],
                [0.22,0.42,0.26],[0.55,0.50,0.44],[0.82,0.86,0.88]];
    for(let i=0;i<pos.count;i++){
      d.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const h=land(d);
      const rr=R + (h-0.42)*14;
      pos.setXYZ(i, d.x*rr, d.y*rr, d.z*rr);
      /* sea, sand, grass, forest, rock — and snow at the poles, which is
         the one thing that tells you at a glance that it is a globe */
      let c = h<0.40 ? SOIL[0] : h<0.46 ? SOIL[1] : h<0.56 ? SOIL[2]
            : h<0.66 ? SOIL[3] : SOIL[4];
      if(Math.abs(d.y)>0.86) c=SOIL[5];
      const sh=0.86+0.28*h;
      col[i*3]=c[0]*sh; col[i*3+1]=c[1]*sh; col[i*3+2]=c[2]*sh;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col,3));
    geo.computeVertexNormals();
    ball=new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors:true }));
    spin.add(ball);

    /* AN ATMOSPHERE, which is one back-faced shell and does most of the
       work of making a sphere read as a planet rather than as a ball. */
    const air=new THREE.Mesh(new THREE.SphereGeometry(R*1.055, 48, 32),
      new THREE.MeshBasicMaterial({ color:0x7fd8ff, transparent:true, opacity:0.17,
        side:THREE.BackSide, depthWrite:false }));
    spin.add(air);

    /* THE TOWNS. Little blocks with a lit face, stood on the ground and
       pointing away from the core — which is what "upright" means here and
       is the whole reason the third cut works: at the limb they are
       silhouettes standing off the edge of the world, and you can see the
       curve under them. */
    const lit=new THREE.MeshBasicMaterial({ color:0xffdc8a });
    const wall=new THREE.MeshLambertMaterial({ color:0x2e3448 });
    const up=new THREE.Vector3(), fwd=new THREE.Vector3(), rt=new THREE.Vector3();
    const M=new THREE.Matrix4();
    for(let i=0;i<96;i++){
      /* golden-angle spiral: even cover, no clumps, no seam */
      const y=1-(i+0.5)/96*2, r=Math.sqrt(Math.max(0,1-y*y)), th=i*2.39996;
      up.set(Math.cos(th)*r, y, Math.sin(th)*r).normalize();
      const h=land(up);
      if(h<0.44) continue;                       // nobody builds in the sea
      /* TALL AND NARROW, and much more of both than looks right on paper.
         A block four units wide and three high on a ball with a radius of
         a hundred and ten is a speck; at the limb, where these have to do
         their work, it is a dark smudge lying on the edge. Towers read. */
      const tall=6.5+((i*37)%5)*2.6;
      const w=1.6+((i*13)%3)*0.6;
      const b=new THREE.Group();
      const box=new THREE.Mesh(new THREE.BoxGeometry(w, tall, w), wall);
      box.position.y=tall/2; b.add(box);
      const win=new THREE.Mesh(new THREE.BoxGeometry(w*0.62, tall*0.16, w*1.02), lit);
      win.position.y=tall*0.62; b.add(win);
      fwd.set(0,1,0).cross(up); if(fwd.lengthSq()<1e-6) fwd.set(1,0,0);
      fwd.normalize(); rt.crossVectors(up, fwd).normalize();
      M.makeBasis(rt, up, fwd);
      b.quaternion.setFromRotationMatrix(M);
      b.position.copy(up).multiplyScalar(R + (h-0.42)*14 - 0.3);
      spin.add(b);
    }

    /* AND THINGS LEAVING IT. Three, on rising arcs, because the fifth line
       is about nine worlds and one ship and a still planet says neither. */
    ships=[];
    for(let i=0;i<3;i++){
      const s=new THREE.Mesh(new THREE.ConeGeometry(1.5, 6, 6),
        new THREE.MeshBasicMaterial({ color:0xbfe9ff }));
      const trail=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.05,9,6),
        new THREE.MeshBasicMaterial({ color:0x7fe0ff, transparent:true, opacity:0.5 }));
      trail.position.y=-6; s.add(trail);
      s.userData={ phase:i*2.1, lon:i*2.4 };
      group.add(s); ships.push(s);
    }
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
      <div class="in-title" id="inTitle">KORO</div>
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
     to 1 across the cut it belongs to and every position below is a lerp
     on it. Distances are in units of the ball's own radius, so re-sizing
     the planet does not re-frame the film. */
  const lerp=(a,b,k)=>a+(b-a)*k;
  const ease=k=>k*k*(3-2*k);
  function camera(){
    const i=cut(), s=SHOTS[i], next=SHOTS[i+1];
    const len=(next?next.at:END)-s.at;
    const k=ease(Math.max(0, Math.min(1, (clock-s.at)/len)));
    const c=G.camera, look=new THREE.Vector3(0,0,0);

    if(i===0){
      /* WIDE, AND COMING IN. It has to be small enough first that getting
         bigger means something. */
      const d=lerp(R*7.4, R*4.6, k);
      c.position.set(Math.sin(0.5)*d*0.25, R*0.5, d);
    }
    else if(i===1){
      /* ROUND THE SHOULDER, so the ball turns under the camera as well as
         on its own axis and reads as a solid rather than as a disc. */
      const a=lerp(0.35, 1.05, k), d=lerp(R*3.4, R*2.6, k);
      c.position.set(Math.sin(a)*d, R*0.72, Math.cos(a)*d);
    }
    else if(i===2){
      /* ON THE LIMB. The camera sits just off the edge of the world with
         the towns between it and the dark, which is the one shot that says
         "there are places on this and people in them". */
      const a=lerp(1.05, 1.55, k);
      const d=lerp(R*1.95, R*1.62, k);
      c.position.set(Math.sin(a)*d, lerp(R*0.46, R*0.22, k), Math.cos(a)*d);
      look.set(Math.sin(a+0.55)*R*0.80, R*0.05, Math.cos(a+0.55)*R*0.80);
    }
    else if(i===3){
      /* LOW AND CLOSE, skimming the terminator: half the frame is lit
         ground going past and half is space. */
      /* THE FIRST VERSION SAT AT 1.2 RADII and the ball filled the frame
         edge to edge: a flat green wash with two blocks on it, which is
         not a planet, it is a wall. Far enough out that the curve is
         still in shot is the whole difference. */
      const a=lerp(1.55, 2.15, k);
      const d=lerp(R*1.62, R*1.80, k);
      c.position.set(Math.sin(a)*d, lerp(R*0.22, R*0.48, k), Math.cos(a)*d);
      look.set(Math.sin(a+0.7)*R*0.75, 0, Math.cos(a+0.7)*R*0.75);
    }
    else {
      /* AND OUT, WITH THE WHOLE BALL IN FRAME UNDER THE NAME — which the
         first version did not manage, because it set x, y and z from three
         separate lerps and the actual distance from the middle came out at
         one and a half radii rather than the two it was asking for. The
         planet filled the frame while the line under it said "nine
         worlds". A distance is a distance: pick a direction, scale it. */
      const a=2.15, el=lerp(0.24, 0.46, k);
      const d=lerp(R*2.6, R*4.3, k), cl=Math.cos(el);
      c.position.set(Math.sin(a)*cl*d, Math.sin(el)*d, Math.cos(a)*cl*d);
    }
    c.lookAt(look);
  }

  /* --------------------------------------------------------------- frame */
  function tick(dt){
    if(!on) return;
    clock+=dt;
    if(spin) spin.rotation.y += dt*0.045;
    if(stars) stars.rotation.y -= dt*0.004;
    /* the three leaving, on rising arcs away from the ball */
    ships.forEach((s,i)=>{
      const u=(clock*0.16 + s.userData.phase*0.17) % 1;
      const rad=R*(1.02 + u*2.4), lon=s.userData.lon + u*0.9;
      const lat=0.25 + u*0.5;
      const cl=Math.cos(lat);
      s.position.set(Math.sin(lon)*cl*rad, Math.sin(lat)*rad, Math.cos(lon)*cl*rad);
      s.lookAt(s.position.clone().multiplyScalar(1.4));
      s.rotateX(Math.PI/2);
      s.visible = u>0.04;
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
    group=null; ball=null; spin=null; stars=null; ships=[];
    G.camera.up.set(0,1,0);
    const cb=done; done=null;
    setTimeout(()=>{ const e=$('#intro'); if(e && !on) e.remove(); }, 400);
    if(cb) cb();
  }

  return { play, tick, finish,
           get active(){ return on; },
           get seen(){ return played; },
           /* so the menu can offer it again, and the tests can ask */
           get shots(){ return SHOTS; },
           get seconds(){ return END; } };
})();
