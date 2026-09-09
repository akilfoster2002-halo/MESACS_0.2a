/* =====================================================================
   THE SURVEY — a rover you program, and the mission where a loop stops
   being a way to type less.

   Mission 2 teaches `repeat n`: write the action once, run it n times,
   raise the number to do more work. That is the whole of loops in this
   course, and it is only the first rung. Everything here is the rungs
   above it.

     TRAVERSE      repeat n — the recap, and the block budget that makes
                   a loop the only thing that fits
     THE RIDGE     repeat UNTIL. The same program is driven over three
                   plots of different lengths, so a counted loop is right
                   once and wrong twice. This is the first program in the
                   whole game whose length is not known when it is written
     THE PERIMETER a loop inside a loop: four sides, three steps each

   WHY A ROVER. The flight taught motion against a clock, so it had to be
   read at speed. Nothing chases you here. The plot sits still and the
   rover crawls, which is what arithmetic wants — and it is the same
   universe, one planet down from the ship they now fly themselves.

   THE ONE RULE THAT MAKES THE LESSON HONEST. A stage can carry SEVERAL
   PLOTS, and the program you write is driven over all of them, unchanged.
   That is the real reason `repeat until` exists rather than a number: a
   number is a fact about one plot, and a test is a fact about all of them.
   ===================================================================== */
window.ROVER = (function(){
  const T=4;                          // world units per tile
  const STEP_MS=340;                  // one block, slow enough to read
  const TURN_MS=260;
  const SKY=0x0a1018;

  /* ------------------------------------------------------------ the plots
     A plot is a strip or a square of tiles with a RIDGE at the far end —
     the thing the rover is driving at. `w` and `h` are in tiles. */
  const STAGES=[
    { id:'traverse', name:'Traverse', budget:3,
      pal:['forward','repeat'],
      learn:{ name:'A loop is what fits',
              text:'Twelve tiles, three blocks. Only a repeat is short enough.',
              code:'repeat 12\n  forward()\nend' },
      brief:'Drive the rover to the <b>ridge</b> at the far end. It is twelve tiles away and you have <b>three blocks</b> — so you cannot write forward() twelve times.',
      /* THIRTEEN TILES for a ridge twelve away. From the tile you start on
         there are w-1 moves to the far end, and the first draft of this said
         twelve in the brief over a plot of twelve — so the twelfth forward()
         drove off the end. The brief is the spec; the plot follows it. */
      plots:[ { w:13, h:1, start:{c:0,r:0,d:1} } ] },

    { id:'ridge', name:'The Ridge', budget:3,
      /* `repeat` IS ON THE PALETTE, and it is meant to be. The lesson is
         that a count is right about one plot and wrong about the next, and
         you cannot learn that from a palette that refuses to let you write
         the count. The same argument the Rhythm makes with its block budget:
         let them write the thing that does not fit and watch it not fit. */
      pal:['forward','until','repeat'],
      conds:['at the ridge'],
      learn:{ name:'A loop that counts nothing',
              text:'repeat until keeps going while a test is false. It does not need to know how far.',
              code:'repeat until at the ridge\n  forward()\nend' },
      brief:'Three plots, and the ridge is a different distance on each one. <b>The same program drives all three.</b> A number can only be right about one of them — <b>repeat until</b> is right about all three.',
      plots:[ { w:7,  h:1, start:{c:0,r:0,d:1} },
              { w:12, h:1, start:{c:0,r:0,d:1} },
              { w:9,  h:1, start:{c:0,r:0,d:1} } ] },

    { id:'perimeter', name:'The Perimeter', budget:5,
      pal:['forward','left','sample','repeat'],
      learn:{ name:'A loop inside a loop',
              text:'Four sides. Three steps along each one. That is a repeat inside a repeat.',
              code:'repeat 4\n  repeat 3\n    forward()\n  end\n  sample()\n  turnLeft()\nend' },
      brief:'Survey the <b>edge</b> of the plot: drive each side and take a <b>sample()</b> at every corner. Four sides, three tiles each, <b>five blocks</b> — which only fits if one loop goes inside another.',
      plots:[ { w:4, h:4, start:{c:0,r:0,d:1}, corners:true } ] }
  ];

  /* ------------------------------------------------------------- state */
  let on=false, L=null, busy=false, group=null, rover=null, wasFP=null;
  let anim=null;

  /* which way is which: 0 north, 1 east, 2 south, 3 west */
  const DIRS=[[0,1],[1,0],[0,-1],[-1,0]];
  const tileX = (p,c) => (c-(p.w-1)/2)*T;
  const tileZ = (p,r) => (r-(p.h-1)/2)*T;

  /* ------------------------------------------------------------- build */
  function plotGroup(p, ox){
    const g=new THREE.Group();
    g.position.x=ox;
    const pale=new THREE.MeshLambertMaterial({color:0x6b6257});
    const dark=new THREE.MeshLambertMaterial({color:0x554e47});
    for(let c=0;c<p.w;c++) for(let r=0;r<p.h;r++){
      const t=new THREE.Mesh(new THREE.BoxGeometry(T*0.94, 0.3, T*0.94),
        (c+r)%2 ? pale : dark);
      t.position.set(tileX(p,c), -0.15, tileZ(p,r));
      g.add(t);
    }
    /* THE RIDGE, at the far end and the whole point of the plot: a thing
       you drive AT rather than a number of tiles you drive FOR. */
    const ridge=new THREE.Group();
    for(let r=0;r<p.h;r++){
      const w=new THREE.Mesh(new THREE.BoxGeometry(T*0.5, 2.2, T*0.9),
        new THREE.MeshLambertMaterial({color:0x8a7f6e}));
      w.position.set(tileX(p,p.w-1)+T*0.72, 1.0, tileZ(p,r));
      ridge.add(w);
    }
    g.add(ridge);
    p.g=g;
    return g;
  }
  /* A rover: a slab on six wheels with a mast and a dish, which is enough
     for it to read as a machine that was sent rather than a car. */
  function buildRover(){
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.9,0.55,2.6),
      new THREE.MeshLambertMaterial({color:0xd8dbe6}));
    body.position.y=0.85; g.add(body);
    const deck=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.18,1.6),
      new THREE.MeshLambertMaterial({color:0x2f3a52}));
    deck.position.y=1.2; g.add(deck);
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,1.1,8),
      new THREE.MeshLambertMaterial({color:0x9aa3b8}));
    mast.position.set(0,1.75,-0.7); g.add(mast);
    const dish=new THREE.Mesh(new THREE.SphereGeometry(0.34,12,8,0,6.283,0,1.2),
      new THREE.MeshLambertMaterial({color:0x8ff0ff, side:THREE.DoubleSide}));
    dish.position.set(0,2.3,-0.7); dish.rotation.x=-0.7; g.add(dish);
    const tyre=new THREE.MeshLambertMaterial({color:0x23262f});
    [-1,0,1].forEach(z=>[-1,1].forEach(x=>{
      const w=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.3,12), tyre);
      w.rotation.z=Math.PI/2; w.position.set(x*1.02, 0.42, z*0.95); g.add(w);
    }));
    /* A light on the front, so which way it is pointing is readable from
       the overhead camera this mission is played from. */
    const eye=new THREE.Mesh(new THREE.SphereGeometry(0.16,10,8),
      new THREE.MeshBasicMaterial({color:0xffd23f}));
    eye.position.set(0,1.05,1.35); g.add(eye);
    return g;
  }

  /* --------------------------------------------------------- the camera
     Straight down the plot and well above it. A rover mission is read like
     a board, not flown — you have to see every tile you are about to write
     a program for. */
  function frame(){
    /* EVERY PLOT IN SHOT. On the leg with three of them, that they are
       different lengths is the entire lesson — a camera framed on the first
       one leaves the other two off the side of the screen, and the student
       is asked to believe a fact they cannot see. So the frame is the real
       extent of the ground, whatever is on it. */
    const first=L.plots[0], last=L.plots[L.plots.length-1];
    const x0=first.ox + tileX(first,0) - T;
    const x1=last.ox  + tileX(last,last.w-1) + T;
    const cx=(x0+x1)/2;
    const span=Math.max(x1-x0, 9*T);
    G.camera.position.set(cx, span*0.50, span*0.40);
    G.camera.up.set(0,1,0);
    G.camera.lookAt(cx, 0, 0);
  }

  /* ------------------------------------------------------------- start */
  function start(n){
    stop();
    const idx=Math.max(0, Math.min(STAGES.length-1, n||0));
    const K=STAGES[idx];
    on=true; busy=false;

    G.running=false;
    if(document.pointerLockElement) document.exitPointerLock();
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.selected=null; G.focused=null;
    G.room='rover'; G.hudOwner='mission'; G.missionId='rover';
    G.scene.background=new THREE.Color(SKY);
    G.scene.fog=null;
    G.camera.near=0.3; G.camera.far=900; G.camera.updateProjectionMatrix();
    if(wasFP===null) wasFP=!!G.firstPerson;
    G.firstPerson=false;

    group=new THREE.Group(); G.roomGroup.add(group);
    G.roomGroup.add(new THREE.AmbientLight(0xdfe6ff, 0.55));
    const sun=new THREE.DirectionalLight(0xfff2e0, 1.5); sun.position.set(20,40,18);
    G.roomGroup.add(sun);
    G.roomGroup.add(new THREE.HemisphereLight(0xbfd8ff, 0x6b6257, 0.5));

    /* Every plot at once, side by side, because the point of the leg with
       three of them is that you can SEE they are different lengths before
       you write a line. */
    const plots=K.plots.map(o=>Object.assign({}, o));
    let ox=0;
    plots.forEach((p,i)=>{ p.ox=ox; group.add(plotGroup(p, ox)); ox += (p.w+3)*T; });

    rover=buildRover(); group.add(rover);
    L={ idx, K, plots, plot:0, ox0:plots[0].ox, done:false, sampled:[] };
    place(plots[0], plots[0].start.c, plots[0].start.r, plots[0].start.d, true);
    frame();

    CODE.setGrid(1,1);
    CODE.setConditions(K.conds && K.conds.length ? K.conds : ['at the ridge'],
                       { until:'repeat until' });
    CODE.setPalette(K.pal); CODE.setBudget(K.budget); CODE.clear();
    if(K.learn) CODE.setGuide(K.learn);
    hud();
    say(K.brief);
  }

  function place(p, c, r, d, snap){
    L.c=c; L.r=r; L.d=d;
    const x=p.ox+tileX(p,c), z=tileZ(p,r);
    if(snap){ rover.position.set(x,0,z); rover.rotation.y=d*Math.PI/2; }
    L.tx=x; L.tz=z; L.ty=d*Math.PI/2;
  }

  /* ---------------------------------------------------------- the tests
     The only condition this mission has so far, and it is the whole idea
     of the leg: a fact about the world rather than a number in a program. */
  function test(cond){
    const p=L.plots[L.plot];
    if(cond==='at the ridge') return L.c>=p.w-1;
    return false;
  }

  /* ------------------------------------------------------------- run it */
  function run(){
    if(!on || busy) return;
    const steps=(window.CODE && CODE.script && CODE.script.length)
      ? CODE.compile(CODE.script) : [];
    if(!steps.length){ say(t('Write a program first — press <b>C</b>.')); return; }
    busy=true; L.done=false; L.sampled=[];
    L.plot=0;
    const p=L.plots[0];
    place(p, p.start.c, p.start.r, p.start.d, true);
    drive(steps, 0, 0);
  }

  /* One step at a time, and the whole program again on the next plot. The
     rover is the only thing that moves between them; the program is not
     re-read, which is the point being made. */
  function drive(steps, at, guard){
    if(!on || !busy) return;
    if(guard>4000){ finish(false, t('That loop never ends.')); return; }
    if(at>=steps.length){ nextPlot(steps); return; }
    const s=steps[at];
    const p=L.plots[L.plot];

    if(s.name==='__until'){
      if(test(s.cond)) return drive(steps, s.jump, guard+1);
      return drive(steps, at+1, guard+1);
    }
    if(s.name==='__loop') return drive(steps, s.back, guard+1);
    if(s.name==='__iter' || s.name==='__if' || s.name==='__call')
      return drive(steps, at+1, guard+1);

    if(s.name==='forward'){
      const [dc,dr]=DIRS[L.d];
      const nc=L.c+dc, nr=L.r+dr;
      if(nc<0||nc>=p.w||nr<0||nr>=p.h){
        return finish(false, t('The rover drove off the plot.'));
      }
      place(p, nc, nr, L.d);
      return move(()=>drive(steps, at+1, guard+1), STEP_MS);
    }
    if(s.name==='left' || s.name==='right'){
      L.d=(L.d + (s.name==='right'?1:3))%4;
      L.ty=L.d*Math.PI/2;
      return move(()=>drive(steps, at+1, guard+1), TURN_MS);
    }
    if(s.name==='sample'){
      mark(p, L.c, L.r);
      return move(()=>drive(steps, at+1, guard+1), STEP_MS);
    }
    return drive(steps, at+1, guard+1);
  }

  /* the eased hop between one tile and the next */
  function move(then, ms){
    const x0=rover.position.x, z0=rover.position.z, y0=rover.rotation.y;
    let dy=L.ty-y0; dy=Math.atan2(Math.sin(dy),Math.cos(dy));
    const t0=performance.now();
    anim={ tick(now){
      const k=Math.min(1,(now-t0)/ms), e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      rover.position.x=x0+(L.tx-x0)*e;
      rover.position.z=z0+(L.tz-z0)*e;
      rover.rotation.y=y0+dy*e;
      if(k>=1){ anim=null; then(); }
    }};
  }

  function mark(p, c, r){
    const key=L.plot+':'+c+','+r;
    if(L.sampled.indexOf(key)>=0) return;
    L.sampled.push(key);
    const peg=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.10,1.4,7),
      new THREE.MeshLambertMaterial({color:0xffd23f}));
    peg.position.set(p.ox+tileX(p,c), 0.7, tileZ(p,r));
    group.add(peg);
    const flag=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.32,0.04),
      new THREE.MeshBasicMaterial({color:0x8ff0ff}));
    flag.position.set(p.ox+tileX(p,c)+0.28, 1.28, tileZ(p,r));
    group.add(flag);
  }

  /* ------------------------------------------------- did it survey it? */
  function nextPlot(steps){
    const p=L.plots[L.plot];
    if(!reached(p)){ return finish(false, plotFail(p)); }
    if(L.plot < L.plots.length-1){
      L.plot++;
      const q=L.plots[L.plot];
      place(q, q.start.c, q.start.r, q.start.d, true);
      say(t('Plot {n} surveyed. The same program, the next plot.',{n:L.plot}));
      return setTimeout(()=>drive(steps, 0, 0), 620);
    }
    finish(true);
  }
  function reached(p){
    if(p.corners){
      /* Every corner sampled, which is what a loop inside a loop buys you.
         Sampling the whole edge would pass a single loop round it too. */
      const want=[[0,0],[p.w-1,0],[p.w-1,p.h-1],[0,p.h-1]];
      return want.every(([c,r])=>L.sampled.indexOf(L.plot+':'+c+','+r)>=0);
    }
    return L.c>=p.w-1;
  }
  const plotFail = p => p.corners
    ? t('Not every corner was sampled.')
    : t('The rover stopped {n} tiles short of the ridge.',{n:(p.w-1)-L.c});

  function finish(ok, why){
    busy=false; anim=null;
    if(ok){
      L.done=true;
      const last = L.idx>=STAGES.length-1;
      say(last ? t('🏅 The plot is surveyed. Every rung of the loop.')
               : t('✅ Surveyed. Press <b>RUN</b> again for the next plot.'));
      if(last && window.PROGRESS) PROGRESS.complete('rover');
      else setTimeout(()=>{ if(on) start(L.idx+1); }, 1600);
    } else {
      say('💥 '+why+' '+t('Press <b>C</b> and try again.'));
      const p=L.plots[L.plot=0];
      place(p, p.start.c, p.start.r, p.start.d, true);
    }
  }

  /* ---------------------------------------------------------- the HUD */
  function hud(){
    const nm=document.querySelector('#missionName');
    if(nm) nm.textContent=t('Rover {n} — {name}',{n:L.idx+1, name:t(L.K.name)});
    const o=document.querySelector('#objList');
    if(o) o.innerHTML=STAGES.map((s,i)=>
      `<li class="${i===L.idx?'cur':(i<L.idx?'done':'')}">${t(s.name)}</li>`).join('');
    const h=document.querySelector('#hud'); if(h) h.classList.remove('hidden');
    if(window.keyHint) keyHint(`<b>C</b> ${t('write your program')} &nbsp; <b>RUN</b> ${t('drives it')}`);
  }
  function say(msg){
    const b=document.querySelector('#briefing'); if(!b) return;
    b.classList.remove('hidden'); b.innerHTML=msg;
  }

  function tick(dt){
    if(!on) return;
    if(anim) anim.tick(performance.now());
  }
  function stop(){
    if(!on) return;
    on=false; busy=false; anim=null; L=null; group=null; rover=null;
    if(window.CODE){ CODE.close(); CODE.setGuide(null); CODE.setBudget(0); }
    if(wasFP!==null){ G.firstPerson=wasFP; wasFP=null; }
  }

  return { start, run, tick, update:tick, stop,
           get active(){ return on; },
           get busy(){ return busy; },
           retry(){ if(L) start(L.idx); },
           count: STAGES.length, STAGES };
})();
