/* =====================================================================
   THE TRENCH — a submersible in a current, and the first mission in this
   game where the world does not wait for you.

   Every other mission is a fixed tape. The corridor, the wall of rock, the
   drone with the coloured shield: all of them stand still until your
   program moves, and all of them can be solved on paper before you press
   RUN. That is deliberate and it is right for teaching motion and loops.

   It is also why nothing has ever needed a SENSOR. If the chart is drawn
   for you, a program that looks at the world is a program doing work it
   did not have to do.

   So: THE SUB DRIFTS. A current carries it forward whether you have
   written anything or not, and the only thing you control is which way it
   is pointing. That single change is what makes all three of these ideas
   necessary at once rather than three lessons in a row:

     SENSING       'wall ahead' is a fact about where the sub IS, which
                   nobody can know while writing the program, because the
                   sub is somewhere else by then
     CONDITIONALS  so the answer cannot be "turn at the fourth beat". It
                   has to be "turn WHEN there is a wall"
     LOOPS         and when your program ends you stop steering — the
                   current does not. A program that tests once survives one
                   corner. The trench has four.

   That last one is the whole reason this mission exists. In Mission 2 a
   loop saves you typing. Here a loop is the difference between steering
   and having steered.
   ===================================================================== */
window.SUB = (function(){
  const T=7;                          // world units per tile
  const DRIFT=6.0;                    // how fast the current carries you
  const STEP_MS=300;                  // one block of the program
  const TURN_RATE=2.6;                // radians a second the planes can swing
  const LOOK=0.90;                    // how far ahead of itself the sonar reaches, in tiles
  const SEA=0x04121c;

  /* --------------------------------------------------------- the trenches
     '#' rock, '.' water, 'S' where you are dropped, 'B' the beacon. Rows
     read top to bottom, the way you look down on them. */
  const STAGES=[
    /* ALL THREE IDEAS, ON THE SMALLEST TRENCH THERE IS.

       The first draft gave this stage `if` and no loop, so the lesson could
       be one idea at a time the way the rest of the course does it. It was
       unsolvable. A program with no loop runs ONCE, at the moment you press
       RUN, when the sub is still at the drop point and there is no wall for
       eight tiles — the test is false, the program ends, and the current
       takes it into the rock with nobody steering.

       That is not a bug to be fixed, it is what a drifting sub IS. Sensing
       without a loop tests the world once and never again; a loop with
       nothing to sense is a countdown. They arrive together or not at all,
       and pretending otherwise would have meant a stage you cannot pass.
       So the ladder is not one idea at a time here — it is the same shape
       three times, over ground that asks more of it. */
    { id:'bend', name:'The First Bend', budget:4,
      pal:['turn','ifc','until'],
      conds:['wall ahead','at the beacon'],
      learn:{ name:'Test, choose, and keep watching',
              text:'The sub is moving while your program runs. A test that happens once happens before anything has gone wrong.',
              code:'repeat until at the beacon\n  if wall ahead\n    turn 90\n  end\nend' },
      brief:'The current has you and there is <b>one bend</b> ahead. You cannot time it — you do not know where the sub will be. Test for it: <i>if wall ahead → turn 90</i>, and keep testing with <b>repeat until at the beacon</b>.',
      map:[ '###########',
            '#S........#',
            '#########.#',
            '#########.#',
            '#########B#' ] },

    { id:'switchback', name:'The Switchback', budget:5,
      pal:['turn','ifc','until'],
      conds:['wall ahead','at the beacon'],
      learn:{ name:'A program that ends stops steering',
              text:'One test handles one corner. The current keeps going after your last block runs.',
              code:'repeat until at the beacon\n  if wall ahead\n    turn 90\n  end\nend' },
      brief:'<b>Four bends</b> now. A single test steers you round the first one and then your program is over — and the current is not. Keep it watching: put the test inside <b>repeat until at the beacon</b>.',
      /* A SPIRAL, so every corner is the same way round and one `turn 90`
         is the right answer at all three of them. The lesson here is the
         LOOP, not the choice — the choosing is the next trench — so nothing
         about which way to go is allowed to be in question. */
      map:[ '###########',
            '#S........#',
            '#########.#',
            '#B#######.#',
            '#.#######.#',
            '#.........#',
            '###########' ] },

    { id:'narrows', name:'The Narrows', budget:7,
      pal:['turn','ifc','until'],
      conds:['wall ahead','wall left','wall right','at the beacon'],
      /* ASK AGAIN BETWEEN THE TWO ANSWERS. The first version of this
         worked example tested the sides one after the other inside a single
         `if wall ahead`, and it steered the sub into the rock every time:
         the first branch turns, the turn finishes, and the program falls
         through to the second branch — which now reads the sonar from the
         NEW heading, finds the canyon wall alongside, and turns straight
         back into it. Re-asking `wall ahead` between the two is what makes
         a completed turn close the question. */
      learn:{ name:'Two tests, two answers',
              text:'When the way ahead is shut, which way is open is its own question — and once you have turned, the question is answered.',
              code:'repeat until at the beacon\n  if wall ahead\n    if wall left\n      turn 90\n    end\n  end\n  if wall ahead\n    if wall right\n      turn -90\n    end\n  end\nend' },
      brief:'This one bends <b>both ways</b>, so one turn is not always the right turn. Ask a second question: which side is <b>open</b>.',
      /* A STAIRCASE. Every corner shuts the way ahead and opens exactly one
         side, and it is not the same side twice running — so `turn 90` is
         right half the time, which is worse than useless. The question stops
         being "is there a wall" and becomes "which way is out". */
      map:[ '#############',
            '#S....#######',
            '#####.#######',
            '#####.....###',
            '#########.###',
            '#########..B#',
            '#############' ] }
  ];

  let on=false, L=null, busy=false, group=null, sub=null, wasFP=null;
  /* The handle on the "next dive in a moment" pause. Without it, finishing a
     trench and then going anywhere — the menu, another mission, a retry —
     leaves a timer in flight that lands later and drags you into a dive you
     did not choose. It also quietly rewrote every test I ran against this
     mission, which is how it was found. */
  let nextT=null;

  /* ------------------------------------------------------------ reading */
  const rowsOf = m => m;
  const at = (m,c,r) => (r<0||r>=m.length||c<0||c>=m[r].length) ? '#' : m[r][c];
  const isRock = (m,c,r) => at(m,c,r)==='#';
  const tileX = (m,c) => (c-(m[0].length-1)/2)*T;
  const tileZ = (m,r) => (r-(m.length-1)/2)*T;
  /* Which tile a world point is in — the sub moves smoothly, the trench is
     a grid, and this is the only place those two facts meet. */
  const colAt = (m,x) => Math.round(x/T + (m[0].length-1)/2);
  const rowAt = (m,z) => Math.round(z/T + (m.length-1)/2);

  /* ------------------------------------------------------------- build */
  /* --------------------------------------------------------- the reef
     THE GRID IS INVISIBLE. Underneath, a trench is still a rectangle of
     tiles — that is what makes the sonar answerable and the same program
     right every time. On top of it goes something you would swim through:
     rock that is never twice the same height, kelp, coral heads, fish, and
     water thick enough that you cannot see the far wall.

     Nothing in this function changes what the sub can hit. It changes what
     it is like to be down there, which is the whole of the difference
     between a maze and a place. */
  let fish=null, fishAt=[], kelp=null, kelpAt=[], bubbles=null, shafts=null;
  const fM=new THREE.Matrix4(), fQ=new THREE.Quaternion(), fE=new THREE.Euler(),
        fV=new THREE.Vector3(), fS=new THREE.Vector3();

  /* One rock, roughly cut. Six of these knocked about and stacked make a
     reef wall that never repeats. */
  function rockGeo(){
    const g=new THREE.IcosahedronGeometry(1, 0);
    const p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const k=0.72+Math.random()*0.5;
      p.setXYZ(i, p.getX(i)*k*1.25, p.getY(i)*k, p.getZ(i)*k*1.25);
    }
    g.computeVertexNormals();
    return g;
  }
  function fishGeo(){
    /* A body and a tail, five triangles. At the size these are seen a fish
       is a moving silhouette and nothing else — modelling a fin would be
       paying for something nobody can resolve. */
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
       0,0,-0.55,   0.16,0.10,0.10,  -0.16,0.10,0.10,
       0,0,-0.55,  -0.16,0.10,0.10,   0,-0.13,0.10,
       0,0,-0.55,   0,-0.13,0.10,     0.16,0.10,0.10,
       0.16,0.10,0.10, 0,-0.13,0.10, -0.16,0.10,0.10,
       0,0.02,0.10,  0.22,0.20,0.42, -0.22,0.20,0.42 ]),3));
    g.computeVertexNormals();
    return g;
  }

  function build(m){
    const g=new THREE.Group();
    const W=m[0].length, H=m.length;

    /* The seabed, and it is not flat: a plane with its vertices pushed
       about, so the floor reads as sand rather than as the bottom of a box. */
    const fl=new THREE.PlaneGeometry(W*T+90, H*T+90, 40, 40);
    const fp=fl.attributes.position;
    for(let i=0;i<fp.count;i++)
      fp.setZ(i, Math.sin(fp.getX(i)*0.09)*0.9 + Math.cos(fp.getY(i)*0.11)*0.8
                 + Math.random()*0.35);
    fl.computeVertexNormals();
    const floor=new THREE.Mesh(fl, new THREE.MeshLambertMaterial({color:0x1d4152}));
    floor.rotation.x=-Math.PI/2; floor.position.y=-2.6; g.add(floor);

    /* THE WALLS, as one instanced mesh. Six rocks to a tile, stacked and
       turned at random, so a straight run of tiles reads as a reef face —
       and it is still one draw call, which is what a several-year-old
       laptop actually cares about. */
    const put=[];
    for(let r=0;r<H;r++) for(let c=0;c<W;c++){
      if(!isRock(m,c,r)) continue;
      const x=tileX(m,c), z=tileZ(m,r);
      const n=3+((c*7+r*13)%2);
      for(let i=0;i<n;i++){
        const s=1.5+Math.random()*1.5;
        put.push({ x:x+(Math.random()-0.5)*T*0.75,
                   y:-2.4+i*1.15+Math.random()*0.5,
                   z:z+(Math.random()-0.5)*T*0.75,
                   s:s*(1-i*0.06) });
      }
    }
    const rocks=new THREE.InstancedMesh(rockGeo(),
      new THREE.MeshLambertMaterial({color:0x2f5a63}), put.length);
    put.forEach((p,i)=>{
      fQ.setFromEuler(fE.set(Math.random()*6.3, Math.random()*6.3, Math.random()*6.3));
      fM.compose(fV.set(p.x,p.y,p.z), fQ, fS.set(p.s,p.s*0.85,p.s));
      rocks.setMatrixAt(i, fM);
    });
    rocks.instanceMatrix.needsUpdate=true;
    g.add(rocks);

    /* Kelp, rooted along the foot of the walls and swaying. It is the only
       thing down here that shows the current has a direction. */
    const kput=[];
    for(let r=0;r<H;r++) for(let c=0;c<W;c++){
      if(isRock(m,c,r)) continue;
      // the open tiles beside a wall, which is where weed actually grows
      const edge=isRock(m,c-1,r)||isRock(m,c+1,r)||isRock(m,c,r-1)||isRock(m,c,r+1);
      if(!edge || Math.random()>0.55) continue;
      for(let i=0;i<2+(Math.random()*3|0);i++)
        kput.push({ x:tileX(m,c)+(Math.random()-0.5)*T*0.8,
                    z:tileZ(m,r)+(Math.random()-0.5)*T*0.8,
                    h:2.2+Math.random()*2.6, ph:Math.random()*6.3 });
    }
    if(kput.length){
      kelp=new THREE.InstancedMesh(new THREE.ConeGeometry(0.20,1,5,1),
        new THREE.MeshLambertMaterial({color:0x2e6b45, side:THREE.DoubleSide}), kput.length);
      kelpAt=kput;
      g.add(kelp);
    }

    /* Coral heads: a few bright ones, because a reef that is all one
       blue-green is a cave. */
    const CORAL=[0xff8a5c, 0xffd23f, 0xff5c8a, 0xa06bff];
    for(let r=0;r<H;r++) for(let c=0;c<W;c++){
      if(!isRock(m,c,r) || Math.random()>0.28) continue;
      const head=new THREE.Mesh(new THREE.IcosahedronGeometry(0.55+Math.random()*0.5, 0),
        new THREE.MeshLambertMaterial({color:CORAL[(Math.random()*CORAL.length)|0]}));
      head.position.set(tileX(m,c)+(Math.random()-0.5)*T*0.6,
                        -1.6+Math.random()*2.4,
                        tileZ(m,r)+(Math.random()-0.5)*T*0.6);
      g.add(head);
    }

    /* FISH. They keep out of the rock because a fish clipping through a
       reef face is the one thing that would say "this is a grid after all".
       Each one circles a spot it was born at, at its own rate. */
    const open=[];
    for(let r=0;r<H;r++) for(let c=0;c<W;c++) if(!isRock(m,c,r)) open.push([c,r]);
    const N=Math.min(240, open.length*9);
    fishAt=[];
    for(let i=0;i<N;i++){
      const [c,r]=open[(Math.random()*open.length)|0];
      fishAt.push({ hx:tileX(m,c), hz:tileZ(m,r),
                    y:-1.4+Math.random()*4.6,
                    rad:0.7+Math.random()*2.2,
                    ph:Math.random()*6.283,
                    sp:(0.35+Math.random()*0.75)*(Math.random()<0.5?-1:1),
                    sc:0.28+Math.random()*0.34 });
    }
    fish=new THREE.InstancedMesh(fishGeo(),
      new THREE.MeshLambertMaterial({ color:0xffffff, vertexColors:false,
        side:THREE.DoubleSide }), N);
    fish.instanceColor=null;
    const col=new THREE.Color(), SHOAL=[0xffd23f,0xff9a5c,0x8ff0ff,0xc9f5ff,0xff7fb0];
    for(let i=0;i<N;i++){ col.setHex(SHOAL[(Math.random()*SHOAL.length)|0]);
      fish.setColorAt(i, col); }
    if(fish.instanceColor) fish.instanceColor.needsUpdate=true;
    g.add(fish);

    /* Bubbles going up, and shafts of light coming down. Between them they
       are most of what makes a scene read as UNDER something. */
    const bn=180, bp=new Float32Array(bn*3);
    for(let i=0;i<bn;i++){
      bp[i*3]=(Math.random()-0.5)*W*T; bp[i*3+1]=Math.random()*14-2;
      bp[i*3+2]=(Math.random()-0.5)*H*T;
    }
    const bg=new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(bp,3));
    bubbles=new THREE.Points(bg, new THREE.PointsMaterial({
      color:0xdff6ff, size:0.13, transparent:true, opacity:0.55, depthWrite:false }));
    g.add(bubbles);

    shafts=new THREE.Group();
    for(let i=0;i<7;i++){
      const sh=new THREE.Mesh(new THREE.ConeGeometry(2.6+Math.random()*2, 26, 8, 1, true),
        new THREE.MeshBasicMaterial({ color:0x9fe8ff, transparent:true,
          opacity:0.045, depthWrite:false, side:THREE.DoubleSide }));
      sh.position.set((Math.random()-0.5)*W*T*0.8, 12, (Math.random()-0.5)*H*T*0.8);
      sh.rotation.z=(Math.random()-0.5)*0.2;
      shafts.add(sh);
    }
    g.add(shafts);
    return g;
  }
  function buildSub(){
    const g=new THREE.Group();
    const hull=new THREE.Mesh(new THREE.CapsuleGeometry(0.62,1.7,6,12),
      new THREE.MeshLambertMaterial({color:0xffd23f}));
    hull.rotation.x=Math.PI/2; g.add(hull);
    const tower=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.6,0.8),
      new THREE.MeshLambertMaterial({color:0xe0a92e}));
    tower.position.y=0.6; g.add(tower);
    const glass=new THREE.Mesh(new THREE.SphereGeometry(0.42,14,10),
      new THREE.MeshLambertMaterial({color:0x8ff0ff, transparent:true, opacity:0.65}));
    glass.position.z=-1.15; g.add(glass);
    [[-1,0],[1,0]].forEach(([x])=>{
      const fin=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.1,0.5),
        new THREE.MeshLambertMaterial({color:0xe0a92e}));
      fin.position.set(x*0.8,0,1.0); g.add(fin);
    });
    /* A lamp pointing the way it is pointing, because on a dark seabed the
       heading is the one thing you have to be able to read at a glance. */
    const beam=new THREE.Mesh(new THREE.ConeGeometry(1.5,5,14,1,true),
      new THREE.MeshBasicMaterial({color:0x8ff0ff, transparent:true, opacity:0.10,
        side:THREE.DoubleSide, depthWrite:false}));
    beam.rotation.x=-Math.PI/2; beam.position.z=-3.2; g.add(beam);
    g.add(new THREE.PointLight(0xfff0c0, 60, 16, 1.6));
    return g;
  }

  /* ------------------------------------------------------------- start */
  function start(n){
    stop();
    clearTimeout(nextT); nextT=null;
    const idx=Math.max(0, Math.min(STAGES.length-1, n||0));
    const K=STAGES[idx];
    /* WHERE WE GOT TO. Written as the level OPENS, not as it is passed:
       a student who is halfway through this one and runs out of lesson has
       still reached it, and should be handed it again tomorrow rather than
       the one before it. */
    if(window.PROGRESS && PROGRESS.reach) PROGRESS.reach('sub', idx);
    on=true; busy=false;

    G.running=false;
    if(document.pointerLockElement) document.exitPointerLock();
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.selected=null; G.focused=null;
    G.room='sub'; G.hudOwner='mission'; G.missionId='sub';
    G.scene.background=new THREE.Color(SEA);
    /* Fog, and a lot of it. Down here it is the difference between a room
       with rocks in it and somewhere you cannot see the end of. */
    G.scene.fog=new THREE.Fog(SEA, 22, 105);
    G.camera.near=0.3; G.camera.far=400; G.camera.updateProjectionMatrix();
    if(wasFP===null) wasFP=!!G.firstPerson;
    G.firstPerson=false;
    /* The planet's minimap and coin dash follow you into every room that
       does not say otherwise, and they sit exactly where the sonar goes. */
    /* The planet keeps drawing its own map and coin dash twelve times a
       second for as long as it thinks it is running, so it has to be told
       it is not — hiding the panels is not enough on its own. */
    if(window.PLANET && PLANET.active) PLANET.leave();
    ['#mapwrap','#dash','#pmap'].forEach(q=>{
      const e=document.querySelector(q); if(e) e.classList.add('hidden'); });

    const m=K.map;
    group=new THREE.Group(); G.roomGroup.add(group);
    group.add(build(m));
    G.roomGroup.add(new THREE.AmbientLight(0x8fd3ff, 0.42));
    const above=new THREE.DirectionalLight(0xbfe8ff, 0.85);
    above.position.set(6,30,10); G.roomGroup.add(above);

    sub=buildSub(); group.add(sub);
    let sc=1, sr=1;
    for(let r=0;r<m.length;r++) for(let c=0;c<m[r].length;c++) if(at(m,c,r)==='S'){ sc=c; sr=r; }
    /* 0 is north, 90 is east. Every trench in this mission is entered
       heading east, and the first draft dropped the sub facing north — into
       the wall it was standing against. */
    const a0=(K.dir===undefined ? 90 : K.dir)*Math.PI/180;
    L={ idx, K, m, x:tileX(m,sc), z:tileZ(m,sr), a:a0, ta:a0, crashed:false, won:false };
    sub.position.set(L.x, 0, L.z);
    chase(0, true);

    CODE.setGrid(1,1);
    /* 'if wall ahead' rather than 'if target is wall ahead' — the lead words
       belong to the mission, and down here the thing being tested is the
       water in front of you, not a target. */
    CODE.setConditions(K.conds, { lead:'if', until:'repeat until' });
    CODE.setPalette(K.pal); CODE.setBudget(K.budget); CODE.clear();
    if(K.learn) CODE.setGuide(K.learn);
    hud(); say(K.brief);
  }

  /* ---------------------------------------------------- the chase camera
     Behind the sub and a little above it, exactly the way you walk about
     KORO. The first version of this mission looked straight down on the
     whole trench, which made it a board: you could count the tiles to the
     bend and write a program that turned on the fourth beat without ever
     reading a sensor.

     From back here you cannot see round the corner, and that is the point.
     A route you cannot survey is a route you have to react to. */
  /* Back, up and ahead. The first numbers here put the camera at four
     units — which is inside the reef, because the walls are five high and
     the sub starts with its back to one. It sits above the rim now and
     looks along the canyon rather than out of the middle of it. */
  const CAM_BACK=12, CAM_UP=7.5, CAM_AHEAD=11;
  function chase(dt, snap){
    const bx=L.x - Math.sin(L.a)*CAM_BACK, bz=L.z + Math.cos(L.a)*CAM_BACK;
    if(snap) G.camera.position.set(bx, CAM_UP, bz);
    else G.camera.position.lerp(fV.set(bx, CAM_UP, bz), Math.min(1, dt*3.2));
    G.camera.up.set(0,1,0);
    G.camera.lookAt(L.x + Math.sin(L.a)*CAM_AHEAD, 0.4, L.z - Math.cos(L.a)*CAM_AHEAD);
  }

  /* Everything alive, once a frame. None of it touches where the sub can
     go — it is all there so that down here feels like somewhere. */
  function life(dt){
    const now=performance.now()/1000;
    if(fish){
      for(let i=0;i<fishAt.length;i++){
        const f=fishAt[i], a=f.ph + now*f.sp;
        const x=f.hx+Math.cos(a)*f.rad*T*0.32, z=f.hz+Math.sin(a)*f.rad*T*0.32;
        // pointing the way it is going, with a lazy roll on the turn
        fQ.setFromEuler(fE.set(0, Math.atan2(
          Math.cos(a)*f.sp, -Math.sin(a)*f.sp*-1), Math.sin(now*2+f.ph)*0.25, 'YXZ'));
        fM.compose(fV.set(x, f.y+Math.sin(now*1.6+f.ph)*0.22, z), fQ,
                   fS.set(f.sc,f.sc,f.sc));
        fish.setMatrixAt(i, fM);
      }
      fish.instanceMatrix.needsUpdate=true;
    }
    if(kelp){
      for(let i=0;i<kelpAt.length;i++){
        const k=kelpAt[i], sway=Math.sin(now*1.1+k.ph)*0.16;
        fQ.setFromEuler(fE.set(sway, k.ph, sway*0.6));
        fM.compose(fV.set(k.x, -2.4+k.h/2, k.z), fQ, fS.set(1, k.h, 1));
        kelp.setMatrixAt(i, fM);
      }
      kelp.instanceMatrix.needsUpdate=true;
    }
    if(bubbles){
      const p=bubbles.geometry.attributes.position, arr=p.array;
      for(let i=0;i<arr.length;i+=3){
        arr[i+1]+=dt*0.9;
        arr[i]+=Math.sin(now*2+i)*dt*0.15;
        if(arr[i+1]>13) arr[i+1]=-2.4;
      }
      p.needsUpdate=true;
    }
    if(shafts) shafts.children.forEach((sh,i)=>{
      sh.material.opacity=0.030+0.022*(1+Math.sin(now*0.5+i))/2;
    });
  }

  /* ---------------------------------------------------------- the sonar
     A sensor is a question about where the sub IS, which is the whole
     reason it cannot be answered while the program is being written. */
  function probe(turnBy){
    const a=L.a + turnBy;
    const x=L.x + Math.sin(a)*T*LOOK, z=L.z - Math.cos(a)*T*LOOK;
    return isRock(L.m, colAt(L.m,x), rowAt(L.m,z));
  }
  function test(cond){
    if(cond==='wall ahead') return probe(0);
    if(cond==='wall left')  return probe(-Math.PI/2);
    if(cond==='wall right') return probe(Math.PI/2);
    if(cond==='at the beacon') return at(L.m, colAt(L.m,L.x), rowAt(L.m,L.z))==='B';
    return false;
  }

  /* ------------------------------------------------------------- run it */
  function run(){
    if(!on || busy) return;
    const steps=(window.CODE && CODE.script && CODE.script.length)
      ? CODE.compile(CODE.script) : [];
    if(!steps.length){ say(t('Write a program first — press <b>C</b>.')); return; }
    const m=L.m; let sc=1, sr=1;
    for(let r=0;r<m.length;r++) for(let c=0;c<m[r].length;c++) if(at(m,c,r)==='S'){ sc=c; sr=r; }
    const a0=(L.K.dir===undefined ? 90 : L.K.dir)*Math.PI/180;
    L.x=tileX(m,sc); L.z=tileZ(m,sr); L.a=a0; L.ta=a0; L.crashed=false; L.won=false;
    sub.position.set(L.x,0,L.z); sub.rotation.y=a0;
    busy=true; L.pc=0; L.steps=steps; L.wait=0; L.guard=0; L.over=false; L.turning=false;
    say(t('Under way.'));
  }

  /* ------------------------------------------------------- every frame
     THE CURRENT RUNS WHETHER THE PROGRAM DOES OR NOT. This is the single
     line that makes the mission what it is: drift is applied before the
     program is asked for its next block, and it goes on being applied
     after the program has run out of blocks to give. */
  function tick(dt){
    if(!on) return;
    dt=Math.min(dt, 0.05);
    life(dt);
    lamps();
    if(!busy){ chase(dt); return; }
    // the planes swing round to whatever the last turn asked for
    let da=L.ta-L.a; da=Math.atan2(Math.sin(da),Math.cos(da));
    const step=Math.min(Math.abs(da), TURN_RATE*dt);
    L.a += Math.sign(da)*step;

    L.x += Math.sin(L.a)*DRIFT*dt;
    L.z -= Math.cos(L.a)*DRIFT*dt;
    sub.position.set(L.x, Math.sin(performance.now()/900)*0.12, L.z);
    sub.rotation.y=L.a;
    sub.rotation.z=-Math.sign(da)*Math.min(0.35, Math.abs(da));   // it banks

    chase(dt);
    if(isRock(L.m, colAt(L.m,L.x), rowAt(L.m,L.z))) return finish(false);
    if(test('at the beacon')) return finish(true);

    /* The program, one block at a time, while all of the above keeps
       happening. When it runs out we do NOT stop the sub — that is the
       lesson of the second trench. */
    if(L.over) return;
    /* Still swinging: the current carries on, the program waits. */
    if(L.turning){
      let d=L.ta-L.a; d=Math.atan2(Math.sin(d),Math.cos(d));
      if(Math.abs(d)>0.03) return;
      L.turning=false;
    }
    L.wait-=dt*1000;
    if(L.wait>0) return;
    L.wait=STEP_MS;
    for(let n=0;n<64;n++){                    // control blocks cost no time
      if(L.pc>=L.steps.length){ L.over=true; say(t('Program finished. The current has not.')); return; }
      const s=L.steps[L.pc];
      if(s.name==='__until'){ L.pc = test(s.cond) ? s.jump : L.pc+1; continue; }
      if(s.name==='__loop'){ L.pc=s.back; if(++L.guard>9000){ L.over=true; } continue; }
      if(s.name==='__if'){ L.pc = test(s.cond) ? L.pc+1 : s.jump; continue; }
      if(s.name==='__iter' || s.name==='__call'){ L.pc++; continue; }
      if(s.name==='turn'){
        /* A TURN OCCUPIES THE SUB UNTIL IT IS FINISHED. Without this the
           program reads the sonar again a third of the way through the
           manoeuvre, finds the wall still ahead — because it IS still
           ahead, the sub has barely swung — and turns again. One corner
           became two turns, then three, and the sub spiralled into the
           rock. One block, one completed turn. */
        L.ta = L.a + (s.n||90)*Math.PI/180; L.turning=true; L.pc++; return; }
      L.pc++; return;
    }
  }

  function finish(ok){
    busy=false;
    if(ok){
      const last=L.idx>=STAGES.length-1;
      say(last ? t('🏅 Beacon reached. Sensing, choices and a loop, all at once.')
               : t('✅ Beacon reached.'));
      if(last && window.PROGRESS) PROGRESS.complete('sub');
      else nextT=setTimeout(()=>{ nextT=null; if(on) start(L.idx+1); }, 1700);
    } else {
      say('💥 '+t('You hit the rock.')+' '+t('Press <b>C</b> and try again.'));
    }
  }

  /* ------------------------------------------------------- the instruments
     A sub you fly from behind cannot see round its own corner, so it needs
     to be told what it is next to. Three lamps, one per sonar return, lit
     the instant the condition is true.

     This is not a convenience. `if wall ahead` is an abstraction until you
     have watched AHEAD come on a second before you would have hit
     something — and then it is a thing you can see, which is the shortest
     road to a child writing one on purpose. */
  function panel(){
    if(document.querySelector('#sonar')) return;
    const el=document.createElement('div');
    el.id='sonar';
    el.innerHTML=`<b>SONAR</b>
      <i data-k="wall left">LEFT</i><i data-k="wall ahead">AHEAD</i><i data-k="wall right">RIGHT</i>`;
    document.body.appendChild(el);
  }
  function lamps(){
    const el=document.querySelector('#sonar'); if(!el || !L) return;
    el.querySelectorAll('i').forEach(i=>{
      const lit=test(i.getAttribute('data-k'));
      /* Only the tests this trench actually offers are live. A lamp for a
         sensor the mission has not handed you yet is a lamp that teaches
         you to want a block you cannot have. */
      const have=L.K.conds.indexOf(i.getAttribute('data-k'))>=0;
      i.classList.toggle('off', !have);
      i.classList.toggle('on', have && lit);
    });
  }

  /* ---------------------------------------------------------- the HUD */
  function hud(){
    panel();
    const nm=document.querySelector('#missionName');
    if(nm) nm.textContent=t('Dive {n} — {name}',{n:L.idx+1, name:t(L.K.name)});
    const o=document.querySelector('#objList');
    if(o) o.innerHTML=STAGES.map((s,i)=>
      `<li class="${i===L.idx?'cur':(i<L.idx?'done':'')}">${t(s.name)}</li>`).join('');
    const h=document.querySelector('#hud'); if(h) h.classList.remove('hidden');
    if(window.keyHint) keyHint(`<b>C</b> ${t('write your program')} &nbsp; <b>RUN</b> ${t('dives')}`);
  }
  function say(msg){
    const b=document.querySelector('#briefing'); if(!b) return;
    b.classList.remove('hidden'); b.innerHTML=msg;
  }

  function stop(){
    clearTimeout(nextT); nextT=null;
    const sp=document.querySelector('#sonar'); if(sp) sp.remove();
    const mw=document.querySelector('#mapwrap'); if(mw) mw.classList.remove('hidden');
    if(!on) return;
    on=false; busy=false; L=null; group=null; sub=null;
    fish=null; fishAt=[]; kelp=null; kelpAt=[]; bubbles=null; shafts=null;
    G.scene.fog=null;
    if(window.CODE){ CODE.close(); CODE.setGuide(null); CODE.setBudget(0); }
    if(wasFP!==null){ G.firstPerson=wasFP; wasFP=null; }
  }

  return { start, run, tick, update:tick, stop,
           /* Where it is, in the trench's own terms. A sub that crashes is
              the only report this mission gives, and "somewhere in a rock"
              is not enough to tell a bad map from bad steering. */
           get where(){ return L ? { c:colAt(L.m,L.x), r:rowAt(L.m,L.z),
                                     deg:Math.round(L.a*180/Math.PI), pc:L.pc,
                                     over:!!L.over } : null; },
           get active(){ return on; },
           get busy(){ return busy; },
           retry(){ if(L) start(L.idx); },
           count: STAGES.length, STAGES };
})();
