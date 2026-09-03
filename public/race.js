/* =====================================================================
   CIRCUIT — the time trial.  Nothing chases you here either; the clock
   is the whole opponent.

   The mechanic that makes this a race and not just Escape with a car:
   MOMENTUM.  Every gas() in an unbroken row is quicker than the one
   before it, and any turn drops you back to a standing start.  So a long
   straight taken in one repeat is genuinely fast, and a turn you did not
   need genuinely costs you — which is what racing actually is.

   That also makes the loop pay off twice over.  The block budget says a
   flat program will not fit; the clock says a flat program would be slow
   even if it did.  On the last circuit, 36 blocks written out longhand
   become four blocks nested two deep, and the four-block version is the
   one that wins.

   The lap time is real elapsed time, not a simulated score: each gas()
   is animated for exactly the duration it costs, so the number on the
   HUD is the number the wall clock would give you.
   ===================================================================== */
window.RACE = (function(){
  const T=4;                                   // world units per tile
  const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];      // N E S W
  const BASE_MS=620;                           // one tile from a standing start
  const MAX_MOM=4;                             // and how far momentum can build
  const TURN_MS=300;
  let CORNER=0;                                // corner-piece rotation offset, tuned on screen

  /* ---------------------------------------------------------- circuits */
  const TRACKS=[
    { name:'Warm-Up Lap', laps:1, budget:14, par:9.5,
      learn:{ name:'One repeat per straight',
              text:'Every straight is the same block over and over. Count the tiles in one straight, wrap a repeat round a single gas(), and turn at the end of it.',
              code:'repeat 6\n  gas()\nend\nturnLeft()' },
      brief:'One lap of the oval. Each <b>gas()</b> in a row is faster than the last, and every turn puts you back to a standing start — so take the straights in <b>one repeat</b>, not one block at a time.',
      grid:['#########',
            '#.......#',
            '#.#####.#',
            '#.#####.#',
            '#.#####.#',
            '#S......#',
            '#########'], start:{x:1,z:5,dir:1} },

    { name:'Three Laps', laps:3, budget:14, par:29.0,
      learn:{ name:'A loop inside a loop',
              text:'You already have a lap. A lap repeated three times is that whole program wrapped in one more repeat — a loop with a loop inside it.',
              code:'repeat 3\n  repeat 6\n    gas()\n  end\n  turnLeft()\nend' },
      brief:'Same circuit, <b>three laps</b>, and still only <b>14 blocks</b>. Writing the lap out three times will not fit — put the lap you already wrote <b>inside one more repeat</b>.',
      grid:['#########',
            '#.......#',
            '#.#####.#',
            '#.#####.#',
            '#.#####.#',
            '#S......#',
            '#########'], start:{x:1,z:5,dir:1} },

    { name:'The Square Mile', laps:1, budget:6, par:11.5,
      learn:{ name:'Nesting pays',
              text:'Four identical sides, each eight tiles long. Written out that is thirty-six blocks. Nested it is four — and the four-block one is faster, because it never breaks a straight.',
              code:'repeat 4\n  repeat 8\n    gas()\n  end\n  turnLeft()\nend' },
      brief:'Four sides, all the same length, and a budget of <b>6 blocks</b>. There is exactly one shape that fits: a <b>repeat inside a repeat</b>.',
      /* the ring has to be a true square or the promise in the brief is a lie:
         x runs 1..9 and z runs 1..9, so every side is exactly 8 tiles and
         repeat 4 { repeat 8 { gas() } turnLeft() } lands back on the line */
      grid:['###########',
            '#.........#',
            '#.#######.#',
            '#.#######.#',
            '#.#######.#',
            '#.#######.#',
            '#.#######.#',
            '#.#######.#',
            '#.#######.#',
            '#S........#',
            '###########'], start:{x:1,z:9,dir:1} }
  ];

  /* ------------------------------------------------------- the garage
     Four cars out of the Kenney racing kit. Two are yours from the start;
     the other two are earned on the track rather than handed over, the
     same way the character grid keeps most of its roster behind ???. */
  const CARS=[
    { id:'red',    file:'racing/raceCarRed.glb',    name:'Scarlet',  a:'#ff9aa2', free:true },
    { id:'white',  file:'racing/raceCarWhite.glb',  name:'Chalk',    a:'#e8ecff', free:true },
    { id:'orange', file:'racing/raceCarOrange.glb', name:'Ember',    a:'#ffd8a8',
      needs:'Finish the Circuit' },
    { id:'green',  file:'racing/raceCarGreen.glb',  name:'Clover',   a:'#a8e6cf',
      needs:'Beat a target time' }
  ];
  const CAR_LEN=3.0;                             // how long a car reads, in world units
  const ACE_KEY='dq_race_ace';                   // set the first time a target falls

  function aced(){ try{ return !!localStorage.getItem(ACE_KEY); }catch(e){ return false; } }
  function carUnlocked(c){
    if(c.free) return true;
    if(c.id==='orange') return !!(window.PROGRESS && PROGRESS.isDone('race'));
    if(c.id==='green')  return aced();
    return false;
  }
  let chosenCar='red';
  try{ const s=localStorage.getItem('dq_car'); if(s && CARS.some(c=>c.id===s)) chosenCar=s; }catch(e){}
  function pickCar(id){
    const c=CARS.find(x=>x.id===id);
    if(!c || !carUnlocked(c)) return;
    chosenCar=id;
    try{ localStorage.setItem('dq_car',id); }catch(e){}
  }

  let carLoader=null;
  const carBytes=new Map();
  /* parsed fresh each time from bytes fetched once — same reason avatar.js
     does it: this build of three has no SkeletonUtils and a shared clone
     would hand every car the same transform */
  async function loadCar(id){
    const def=CARS.find(c=>c.id===id) || CARS[0];
    if(!carBytes.has(def.id))
      carBytes.set(def.id, fetch(def.file).then(r=>{
        if(!r.ok) throw new Error('missing '+def.file);
        return r.arrayBuffer();
      }));
    carLoader = carLoader || new THREE.GLTFLoader();
    const buf=await carBytes.get(def.id);
    const g=await new Promise((res,rej)=>carLoader.parse(buf.slice(0),'racing/',res,rej));
    const root=g.scene;
    root.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
    const box=new THREE.Box3().setFromObject(root);
    const len=Math.max(0.001, box.max.z-box.min.z);
    root.scale.setScalar(CAR_LEN/len);
    // the kit names its wheels, so the real ones can turn
    const wheels=[];
    ['wheelBackLeft','wheelBackRight','wheelFrontLeft','wheelFrontRight']
      .forEach(n=>{ const w=root.getObjectByName(n); if(w) wheels.push(w); });
    const holder=new THREE.Group();
    holder.add(root);
    holder.userData.wheels=wheels;
    return holder;
  }

  let L=null, busy=false, kart=null;

  /* -------------------------------------------------------- trackside
     The kit is modelled on a 1×1 grid and stands on y=0, and a tile here
     is T across — so one piece is exactly one tile at scale T, and
     nothing needs measuring by hand. Props are static meshes, so a plain
     clone is safe (unlike the characters, which carry skeletons). */
  const PROPS='racing/';
  const PROP={};
  const ROAD_Y=0.12;                 // road is 0.08 thick, so its surface lands on 0.2
  const GND_Y=0.20;                  // and everything else stands on that surface
  let propLoader=null;

  /* The kit models from a corner, not a centre: a road tile spans x 0..1 and
     z -1..0 about its origin. Rotating that about y would swing the tile off
     its square. So each piece is measured once on load and then hung inside a
     group at minus its own centre — after which position is the tile centre
     and rotation spins in place, for every piece, without a table of
     hand-measured offsets. Y is left alone: these models stand on y=0. */
  async function warm(names){
    propLoader = propLoader || new THREE.GLTFLoader();
    await Promise.all(names.map(n=>{
      if(PROP[n]!==undefined) return null;
      return new Promise(res=>propLoader.load(PROPS+n+'.glb',
        g=>{
          const b=new THREE.Box3().setFromObject(g.scene);
          PROP[n]={ scene:g.scene,
                    cx:(b.min.x+b.max.x)/2,
                    cz:(b.min.z+b.max.z)/2 };
          res();
        },
        undefined,
        ()=>{
          // Do NOT cache the failure. A load cancelled by restarting the
          // circuit mid-fetch would otherwise blank that piece for the rest
          // of the session; leaving the slot empty lets the next start retry.
          console.warn('track piece failed, will retry:',n);
          delete PROP[n]; res();
        }));
    }));
  }
  function place(name, wx, wz, rotY, wy, scale){
    const p=PROP[name]; if(!p) return null;
    const m=p.scene.clone(true);
    m.position.set(-p.cx, 0, -p.cz);          // centre it on its own group
    m.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
    const g=new THREE.Group();
    g.add(m);
    g.scale.setScalar(scale===undefined ? T : scale);
    g.position.set(wx, wy===undefined?GND_Y:wy, wz);
    g.rotation.y=rotY||0;
    G.roomGroup.add(g); return g;
  }
  function tileProp(name, gx, gz, rotY, wy, scale){
    return place(name, gx*T, gz*T, rotY, wy, scale);
  }

  /* ------------------------------------------------------------- build */
  /* if a car will not load, a box still races — better a plain kart than an
     empty track and a mission you cannot play */
  function fallbackKart(){
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.5,2.7),
      new THREE.MeshLambertMaterial({color:0xff9aa2}));
    body.position.y=0.55; g.add(body);
    g.userData.wheels=[];
    return g;
  }

  async function start(n){
    const idx=Math.max(0, Math.min(TRACKS.length-1, n||0));
    const K=TRACKS[idx];
    busy=false;
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.ceiling=null;
    G.ground=()=>0.2;
    G.scene.background=new THREE.Color(0x10233a);
    G.scene.fog=new THREE.Fog(0x10233a, 80, 260);
    G.hudOwner='race'; G.missionId='race'; G.room=null; G.running=true;
    if(window.updateLeaveBtn) updateLeaveBtn();
    document.querySelector('#mapwrap').classList.add('hidden');
    document.querySelector('#health').classList.add('hidden');
    document.querySelector('#skill').classList.add('hidden');
    document.querySelector('#trigger').classList.add('hidden');

    L={ idx, K, grid:K.grid, w:K.grid[0].length, h:K.grid.length,
        gx:K.start.x, gz:K.start.z, dir:K.start.dir,
        mom:1, laps:0, sinceCross:99, tiles:0,
        t0:0, elapsed:0, rolling:false, done:false, crashed:false };

    await warm(['roadStraight','roadCornerSmall','roadStartPositions','fenceStraight','barrierWall',
                'overhead','flagCheckers','grandStand','grandStandCovered',
                'treeLarge','treeSmall','lightPostLarge','pylon','tent']);
    if(!L) return;                                 // left again while it loaded
    buildTrack();

    const p={x:L.gx*T, z:L.gz*T};
    G.pos.set(p.x, 1.9, p.z);
    G.yaw=Math.atan2(-DIRS[L.dir][0],-DIRS[L.dir][1]);
    G.pitch=-0.24; G.vel.y=0; G.onGround=true;   // look down the road, not at the sky

    // the car IS the player here, so the character stays in the pits: the kit
    // has no seated pose, and a figure standing inside an open-wheeler reads
    // as a bug rather than a driver
    if(window.AVATAR) AVATAR.detach();
    await fitCar();

    CODE.setPalette(['gas','left','right','repeat']);
    CODE.setBudget(K.budget); CODE.clear();
    CODE.setGuide({ brief:K.brief, name:K.learn.name, text:K.learn.text, code:K.learn.code });
    hud(); brief(K.brief);
    teach();
  }
  /* swap whichever car is chosen onto the grid, keeping it where the old one
     stood so changing car between circuits does not teleport you */
  async function fitCar(){
    if(kart && kart.parent) kart.parent.remove(kart);
    kart=null;
    let m;
    try{ m=await loadCar(chosenCar); }
    catch(e){ console.warn('car failed to load',e); m=fallbackKart(); }
    if(!L) return;                                // left the mission mid-load
    kart=m; G.roomGroup.add(kart);
    placeKart();
  }
  function placeKart(){
    if(!kart) return;
    kart.position.set(G.pos.x, 0.2, G.pos.z);
    // the kit models nose down +Z, the camera looks down -Z — same half turn
    // the characters need
    kart.rotation.y=G.yaw+Math.PI;
  }

  /* --------------------------------------------------------- the track
     The grid already says where the road runs, so the shape of each tile
     is read back out of it rather than authored twice: two road
     neighbours facing each other is a straight, two at right angles is a
     corner, and the rotation follows from which two. Add a tile to a
     circuit above and the scenery follows it. */
  const isRoad=(x,z)=>{ const c=cell(x,z); return c==='.'||c==='S'; };
  function nbrs(x,z){ return DIRS.map(([dx,dz])=>isRoad(x+dx,z+dz)); }   // N E S W

  function buildTrack(){
    const K=L.K, H=L.h, W=L.w;
    K.grid.forEach((row,z)=>[...row].forEach((c,x)=>{
      if(c==='#'){ fenceEdges(x,z); return; }
      roadTile(x,z,c);
    }));
    scenery();
  }
  function roadTile(gx,gz,c){
    const n=nbrs(gx,gz);
    const [N,E,S,Wd]=n;
    const count=n.filter(Boolean).length;
    if(count===2 && N && S)        tileProp('roadStraight', gx,gz, 0, ROAD_Y);
    else if(count===2 && E && Wd)  tileProp('roadStraight', gx,gz, Math.PI/2, ROAD_Y);
    else if(count===2 && N && E)   tileProp('roadCornerSmall', gx,gz, CORNER, ROAD_Y);
    else if(count===2 && N && Wd)  tileProp('roadCornerSmall', gx,gz, CORNER+Math.PI/2, ROAD_Y);
    else if(count===2 && S && Wd)  tileProp('roadCornerSmall', gx,gz, CORNER+Math.PI, ROAD_Y);
    else if(count===2 && S && E)   tileProp('roadCornerSmall', gx,gz, CORNER-Math.PI/2, ROAD_Y);
    else                           tileProp('roadStraight', gx,gz, 0, ROAD_Y);
    if(c==='S') startFurniture(gx,gz);
  }
  /* The lap has to start on a corner — that is what makes the straights come
     out 6,4,6,4 and keeps "one repeat per straight" honest. But a start line
     painted across a corner looks like a mistake, so the furniture goes on
     the first straight tile ahead instead, which is where a real gantry
     stands anyway. Lap counting still keys off the S tile itself. */
  function startFurniture(gx,gz){
    const [dx,dz]=DIRS[L.K.start.dir];
    const fx=gx+dx, fz=gz+dz;
    const along = dx!==0 ? Math.PI/2 : 0;         // square the line across the road
    tileProp('roadStartPositions', fx,fz, along, ROAD_Y+0.01);
    tileProp('overhead',           fx,fz, along, GND_Y);
    // a checkered flag either side of the gantry, set back off the asphalt
    place('flagCheckers', (fx-dz*0.62)*T, (fz-dx*0.62)*T, 0, GND_Y);
    place('flagCheckers', (fx+dz*0.62)*T, (fz+dx*0.62)*T, 0, GND_Y);
  }
  /* Barriers on every face where a wall tile meets the road — but not the
     same barrier on both sides. The chase camera rides outside the track
     through every corner, so anything tall on the OUTER ring would sit
     between the player and their own car: out there it is a knee-high
     barrier the camera sees straight over. The infield is never between the
     camera and the car, so it gets the tall catch fencing and the depth
     that comes with it. */
  function fenceEdges(gx,gz){
    const outer = gx===0 || gz===0 || gx===L.w-1 || gz===L.h-1;
    DIRS.forEach(([dx,dz])=>{
      if(!isRoad(gx+dx,gz+dz)) return;
      const wx=gx*T+dx*T/2, wz=gz*T+dz*T/2;
      // both pieces lie along X by default: turn them when the edge runs along Z
      place(outer?'barrierWall':'fenceStraight', wx, wz, dx!==0 ? Math.PI/2 : 0, GND_Y);
    });
  }
  /* everything past the barriers — placed off the grid bounds so it fits
     whichever circuit is loaded */
  function scenery(){
    const W=L.w, H=L.h, r=()=>Math.random();
    const out=2.2;                                  // how far outside the wall ring
    // grandstands down the two long sides, facing in
    for(let x=2;x<W-2;x+=3){
      place('grandStandCovered', x*T, -out*T, Math.PI, GND_Y);
      place('grandStand',        x*T, (H-1+out)*T, 0,  GND_Y);
    }
    // floodlights on the corners
    [[0,0],[W-1,0],[0,H-1],[W-1,H-1]].forEach(([x,z],i)=>{
      place('lightPostLarge', (x + (x?1.4:-1.4))*T, (z + (z?1.4:-1.4))*T, i*Math.PI/2, GND_Y);
    });
    // a treeline behind the stands, thinned out so it never reads as a hedge
    for(let x=-2;x<W+2;x+=2){
      if(r()<0.45) place(r()<0.5?'treeLarge':'treeSmall', x*T+r()*T, -(out+1.6)*T-r()*T*2, r()*6, GND_Y);
      if(r()<0.45) place(r()<0.5?'treeLarge':'treeSmall', x*T+r()*T, (H-1+out+1.6)*T+r()*T*2, r()*6, GND_Y);
    }
    // paddock tents at one end, pylons marking the infield
    place('tent', -out*T, 2*T, Math.PI/2, GND_Y);
    place('tent', -out*T, 4*T, Math.PI/2, GND_Y);
    for(let z=2;z<H-2;z+=2) place('pylon', (W/2)*T, z*T, 0, GND_Y);
  }

  /* --------------------------------------------------------- the world */
  function cell(x,z){
    if(z<0||z>=L.h||x<0||x>=L.grid[z].length) return '#';
    return L.grid[z][x];
  }
  function target(){ return L.K.par * (window.DIFF?DIFF.time():1); }
  function bestKey(){ return 'dq_race_best_'+L.idx; }
  function best(){ try{ return +localStorage.getItem(bestKey())||0; }catch(e){ return 0; } }
  function saveBest(secs){
    const b=best();
    if(!b || secs<b){ try{ localStorage.setItem(bestKey(), secs.toFixed(2)); }catch(e){} return true; }
    return false;
  }

  /* ------------------------------------------------------ run a program */
  function run(steps){
    if(busy || !L || L.done) return;
    busy=true; L.crashed=false;
    if(!L.rolling){ L.rolling=true; L.t0=performance.now(); L.elapsed=0; }
    let i=0;
    (function next(){
      if(!L || L.done || L.crashed){ busy=false; return; }
      if(i>=steps.length){
        busy=false; CODE.highlight(null); CODE.hideTape();
        L.rolling=false;
        brief(t('Program finished after {n} of {m} laps. Wrap the lap in a bigger repeat.',
                {n:L.laps, m:L.K.laps}));
        return;
      }
      const s=steps[i++];
      if(s.name==='__iter'){ CODE.setIter(s.blockId,s.i,s.n); return setTimeout(next,80); }
      if(s.name==='__if'||s.name==='__call'){ CODE.highlight(s); return setTimeout(next,80); }
      CODE.highlight(s);
      act(s.name, ()=>{
        if(!L || L.crashed){ busy=false; return; }
        if(L.done){ busy=false; return; }
        setTimeout(next,20);
      });
    })();
  }
  function act(name, done){
    if(name==='left')  return turn(-1,done);
    if(name==='right') return turn( 1,done);
    if(name==='gas')   return drive(done);
    done();
  }
  /* a turn costs its own time AND every bit of speed you had built up */
  function turn(d,done){
    L.dir=(L.dir+d+4)%4; L.mom=1;
    ease(G.yaw, Math.atan2(-DIRS[L.dir][0],-DIRS[L.dir][1]), TURN_MS, v=>{ G.yaw=v; placeKart(); }, done);
  }
  function drive(done){
    const nx=L.gx+DIRS[L.dir][0], nz=L.gz+DIRS[L.dir][1];
    if(cell(nx,nz)==='#'){
      L.crashed=true; busy=false; CODE.hideTape(); L.rolling=false;
      shake();
      brief(t('💥 Into the barrier. Count the tiles on that straight again.'));
      if(window.beep) beep('bad');
      return;
    }
    const dur=BASE_MS/L.mom;
    const fx=G.pos.x, fz=G.pos.z, tx=nx*T, tz=nz*T;
    L.gx=nx; L.gz=nz; L.tiles++; L.sinceCross++;
    const spin=L.mom;
    ease(0,1,dur,k=>{
      G.pos.x=fx+(tx-fx)*k; G.pos.z=fz+(tz-fz)*k;
      placeKart();
      if(kart && kart.userData.wheels) kart.userData.wheels.forEach(w=>{ w.rotation.x -= 0.55*spin; });
    }, ()=>{
      if(L.mom<MAX_MOM) L.mom++;                 // an unbroken straight keeps building
      if(cell(L.gx,L.gz)==='S') crossLine();
      done();
    });
  }
  /* the finish line only counts once you have actually been round */
  function crossLine(){
    if(L.sinceCross < 4) return;
    L.sinceCross=0; L.laps++;
    if(L.laps>=L.K.laps) return finish();
    if(window.beep) beep('star');
    brief(t('Lap {n} of {m}.',{n:L.laps, m:L.K.laps}));
    hud();
  }

  /* ------------------------------------------------------------ finish */
  function finish(){
    if(!L || L.done) return;
    L.done=true; busy=false; L.rolling=false;
    L.elapsed=(performance.now()-L.t0)/1000;
    CODE.hideTape(); CODE.close(); CODE.setGuide(null);
    if(window.beep) beep('star');
    const secs=L.elapsed, tgt=target(), beat=secs<=tgt, record=saveBest(secs);
    if(beat){ try{ localStorage.setItem(ACE_KEY,'1'); }catch(e){} }   // earns Clover
    hud();
    const last = L.idx+1 >= TRACKS.length;
    if(!last){
      brief(t('🏁 {s}s — next circuit…',{s:secs.toFixed(2)}));
      setTimeout(()=>start(L.idx+1), 1600);
      return;
    }
    if(window.PROGRESS) PROGRESS.complete('race');
    showResults({
      title:t('CHEQUERED FLAG'),
      body: beat ? t('Under the target, on a program you can read in one breath. That is what a loop buys you.')
                 : t('Round in one piece. Now cut the blocks down — fewer turns and longer straights is a faster lap.'),
      stats:`<div><b>${t('Your time')}</b> ${secs.toFixed(2)}s</div>
             <div><b>${t('Target')}</b> ${tgt.toFixed(2)}s ${beat?'✅':''}</div>
             <div><b>${t('Best')}</b> ${best()?(+best()).toFixed(2)+'s':'—'} ${record?'🏆':''}</div>
             <div><b>${t('Blocks used')}</b> ${CODE.countBlocks?CODE.countBlocks():'—'}</div>`,
      btnText:t('Take the quiz ▶'),
      onBtn:()=>{ document.querySelector('#done').classList.add('hidden');
                  if(window.QUIZ) QUIZ.start('race'); }
    });
    G.running=false;
  }

  /* --------------------------------------------------------------- HUD */
  function hud(){
    if(!L) return;
    document.querySelector('#missionName').textContent=
      t('Circuit {n} — {name}',{n:L.idx+1, name:t(L.K.name)});
    const b=best();
    document.querySelector('#objList').innerHTML=
      `<li class="cur">⏱ ${t('Time')}: <b><span id="raceClock">0.00</span>s</b></li>
       <li>🏁 ${t('Lap')} <b>${Math.min(L.laps+1,L.K.laps)}</b> ${t('of')} <b>${L.K.laps}</b></li>
       <li>🎯 ${t('Target')}: <b>${target().toFixed(2)}s</b></li>
       <li>🏆 ${t('Best')}: <b>${b?(+b).toFixed(2)+'s':'—'}</b></li>`;
  }
  function tick(dt){
    if(!L) return;
    placeKart();
    if(L.rolling && !L.done){
      L.elapsed=(performance.now()-L.t0)/1000;
      const el=document.querySelector('#raceClock');
      if(el) el.textContent=L.elapsed.toFixed(2);
    }
  }
  function shake(){
    const h=document.querySelector('#hurt');
    h.classList.add('on'); setTimeout(()=>h.classList.remove('on'),300);
  }
  function teach(){
    const el=document.querySelector('#teach');
    el.classList.remove('hidden');
    el.innerHTML=`<div class="teach-card">
      <div class="kicker">${t('CIRCUIT {n}',{n:L.idx+1})} · ${t(L.K.learn.name)}</div>
      <h2>${t(L.K.name)}</h2>
      <p>${t(L.K.brief)}</p>
      <pre>${L.K.learn.code}</pre>
      <div class="why">${t('Every gas() in a row is quicker than the last. A turn puts you back to walking pace.')}</div>
      <div class="p-lbl" style="text-align:left">${t('YOUR CAR')}</div>
      <div class="diffrow" id="garage"></div>
      <button class="btn good" id="teachGo">${t('To the grid ▶')}</button>
      <div style="font-size:13px;color:var(--muted);margin-top:9px">${t('or press SPACE')}</div>
    </div>`;
    garage();
    el.querySelector('#teachGo').onclick=()=>{ el.classList.add('hidden'); CODE.show(); };
  }
  /* the same locked-tile idea the character grid uses: what you have not
     earned yet shows as ??? and says what would earn it */
  function garage(){
    const row=document.querySelector('#garage'); if(!row) return;
    row.innerHTML='';
    CARS.forEach(c=>{
      const open_=carUnlocked(c);
      const b=document.createElement('button');
      b.className='diffbtn'+(c.id===chosenCar&&open_?' on':'')+(open_?'':' lock');
      b.style.setProperty('--a', c.a);
      b.disabled=!open_;
      b.innerHTML=`<span class="dem" style="color:${c.a}">${open_?'🏎':'🔒'}</span>`
        +`<b>${open_?t(c.name):'???'}</b>`
        +(open_?'':`<small>${t(c.needs)}</small>`);
      b.onclick=()=>{ pickCar(c.id); garage(); fitCar(); if(window.beep) beep('pop'); };
      row.appendChild(b);
    });
  }
  let mt=null;
  function brief(html){
    const b=document.querySelector('#briefing');
    b.classList.remove('hidden'); b.innerHTML=t(html);
    clearTimeout(mt);
    mt=setTimeout(()=>{ if(L && !L.done) b.innerHTML=t(L.K.brief); }, 4600);
  }
  function ease(a,b,ms,set,done){
    const t0=performance.now();
    (function f(){
      const k=Math.min(1,(performance.now()-t0)/ms);
      set(a+(b-a)*k);                       // linear: a car at speed does not ease
      if(k<1) setTimeout(f,16); else if(done) done();
    })();
  }

  function stop(){
    L=null; busy=false;
    if(kart && kart.parent) kart.parent.remove(kart);
    kart=null;
    document.querySelector('#mapwrap').classList.remove('hidden');
    CODE.setBudget(0); CODE.setGuide(null);
  }

  return { start, run, tick, update:tick, stop,
           get active(){ return !!L; },
           get busy(){ return busy; },
           retry(){ if(L) start(L.idx); },
           count: TRACKS.length };
})();
