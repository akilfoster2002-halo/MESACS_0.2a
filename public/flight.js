/* =====================================================================
   SPACEFLIGHT — motion, taught at speed.

   The ship never stops.  It flies forward at a fixed rate through a field
   of rocks laid out on a beat, and the only thing you control is WHICH OF
   NINE LANES you are in when each wall of rock arrives.  One block, one
   beat, one lane.  That is the whole contract, and every idea in the
   course hangs off it:

     up/down/left/right   one lane from wherever you are — RELATIVE motion
     coast()              a beat you deliberately spend not moving, which
                          is what makes timing a thing you can write down
     repeat               a pattern of rock is a pattern of blocks
     repeat in repeat     a pattern of patterns
     goTo(col,row)        one exact lane from anywhere — ABSOLUTE motion,
                          and the stage that needs it is built so that
                          relative steps physically cannot get there in time

   Because the field arrives on a clock, a program is not a list of things
   that happen in order — it is a list of things that happen AT A TIME.
   That is the difference between this and every other mission in the game,
   and it is why the fundamentals of motion land here and not in a maze.

   Between the runs the ship holds still over a gunnery range and you fly
   the same nine lanes with fire() on the end.  Same motion, no clock: a
   break that is still the lesson.

   Nothing here is a reflex test.  The chart is fixed, it is drawn for you
   while you write, and a correct program survives it every single time.
   ===================================================================== */
window.FLIGHT = (function(){
  const COLS=3, ROWS=3;              // the nine lanes
  const LANE=3.6;                    // world units between lane centres
  const GAP=13;                      // world units between one beat and the next
  const BEAT_MS=900;                 // one beat at Medium, before difficulty
  const GUN_MS=340;                  // a lane change on the range, where there is no clock
  const SKY=0x080b1c;

  /* ------------------------------------------------------------ the course

     A beat is written as three rows, top to bottom, separated by slashes —
     exactly the way it looks through the windscreen.  '.' is open sky and
     'X' is rock.  Every chart is checked for a way through when the stage
     loads, so an impossible wall is a crash at author time, not at play. */
  const STAGES=[
    { id:'first', kind:'fly', name:'First Contact', budget:8,
      pal:['flyUp','flyDown','flyLeft','flyRight','coast'],
      learn:{ name:'One block, one beat',
              text:'The ship flies on whether you write anything or not. Each block you write happens on the next beat — so a program is not just what you do, it is when.',
              code:'up()\ncoast()\nleft()\ndown()' },
      brief:'Nine lanes, and a wall of rock every beat. <b>up() down() left() right()</b> move you one lane; <b>coast()</b> spends a beat staying put. Fly the gaps.',
      start:{col:1,row:1},
      /* Drawn backwards from a path that uses all four directions and a
         coast, then thinned out: enough rock to make the gap the obvious
         way through, not so much that it reads as a wall. Walls come later. */
      beats:[
        '.../.X./.X.',   // up    → col1 row2
        '.../.X./X.X',   // coast → col1 row2
        '.XX/.X./...',   // left  → col0 row2
        'X../.XX/...',   // down  → col0 row1
        '.../X../.XX',   // down  → col0 row0
        '.../.X./X.X',   // right → col1 row0
        '.../..X/XX.',   // right → col2 row0
        '..X/..X/.X.'    // coast → col2 row0
      ] },

    { id:'range', kind:'gun', name:'Gunnery Range', budget:12,
      pal:['flyUp','flyDown','flyLeft','flyRight','fire'],
      learn:{ name:'The same nine lanes',
              text:'No clock out here. The ship holds still, you fly the crosshair around the same nine lanes, and fire() shoots whatever is in the lane you are sitting in.',
              code:'left()\nfire()\nup()\nfire()' },
      brief:'Four targets, twelve blocks. Move into a lane, then <b>fire()</b>. Nothing is coming at you — take your time and count the moves.',
      start:{col:1,row:1},
      targets:'X.X/.../X.X' },

    { id:'rhythm', kind:'fly', name:'The Rhythm', budget:6,
      pal:['flyUp','flyDown','flyLeft','flyRight','coast','repeat'],
      learn:{ name:'A pattern of rock is a repeat',
              text:'The field ahead is the same three beats over and over: a gap on top, a gap in the middle, then a gap in the middle again. Write those three moves once, wrap a repeat round them, and twelve beats fit in four blocks.',
              code:'repeat 4\n  up()\n  down()\n  coast()\nend' },
      brief:'Twelve beats, <b>six blocks</b>. Writing it out flat needs twelve — so find the bit that repeats and put a <b>repeat</b> round it.',
      start:{col:1,row:1},
      /* Three beats, four times over, drawn backwards from the program that
         is meant to fly it: up() puts you on the top row, down() puts you
         back in the middle, coast() holds you there. Each beat blocks the
         two lanes that program is NOT in. */
      beats:[
        '.../.X./.X.',  '.X./.../.X.',  'X.X/.../X.X',
        '.../.X./.X.',  '.X./.../.X.',  'X.X/.../X.X',
        '.../.X./.X.',  '.X./.../.X.',  'X.X/.../X.X',
        '.../.X./.X.',  '.X./.../.X.',  'X.X/.../X.X'
      ] },

    { id:'turret', kind:'gun', name:'Turret Drill', budget:4,
      pal:['flyUp','flyDown','flyLeft','flyRight','fire','repeat'],
      learn:{ name:'A row of targets is a loop',
              text:'Three targets in a line is the same two moves three times: shoot, slide across, shoot, slide across. That is a repeat with two blocks in it.',
              code:'repeat 3\n  fire()\n  right()\nend' },
      brief:'Three targets across the bottom and only <b>four blocks</b>. Shooting them one at a time is five on its own — so <b>repeat</b> the pair instead.',
      start:{col:0,row:0},
      targets:'.../.../XXX' },

    { id:'deep', kind:'fly', name:'Deep Field', budget:6,
      pal:['flyUp','flyDown','flyLeft','flyRight','coast','repeat'],
      learn:{ name:'A loop inside a loop',
              text:'The field repeats twice over: a small pattern that repeats, inside a bigger one that repeats too. A repeat is allowed to hold another repeat — that is how a big field fits in a small program.',
              code:'repeat 3\n  repeat 2\n    left()\n    right()\n  end\n  up()\n  down()\nend' },
      brief:'Eighteen beats, <b>six blocks</b>. One repeat round the whole cycle is seven and will not fit — put a <b>repeat inside a repeat</b> and it comes down to six.',
      start:{col:1,row:1},
      /* Six beats, three times over. The inner pair is left()/right(), which
         parks you at col 0 then col 1; the outer tail is up()/down(). Every
         beat blocks whatever that program is not standing in. */
      beats:[
        '.../.XX/...',  '.../X.X/...',  '.../.XX/...',  '.../X.X/...',
        '.../.X./XXX',  'XXX/X.X/...',
        '.../.XX/...',  '.../X.X/...',  '.../.XX/...',  '.../X.X/...',
        '.../.X./XXX',  'XXX/X.X/...',
        '.../.XX/...',  '.../X.X/...',  '.../.XX/...',  '.../X.X/...',
        '.../.X./XXX',  'XXX/X.X/...'
      ] },

    { id:'jump', kind:'fly', name:'Jump Drive', budget:6,
      pal:['flyUp','flyDown','flyLeft','flyRight','coast','repeat','goTo'],
      learn:{ name:'Absolute beats relative',
              text:'up() and left() move you one lane FROM WHERE YOU ARE. goTo(col,row) puts you in one exact lane whatever lane you were in. When the only gap is diagonally across the field and you have one beat to reach it, a one-lane step cannot get there and goTo can.',
              code:'repeat 3\n  goto 0,0\n  goto 2,2\n  goto 2,0\n  goto 0,2\nend' },
      brief:'One gap per beat and it is always in a <b>corner</b>. A single step cannot cross the field in one beat — <b>goTo</b> can go straight to a lane. Four corners, three times over, <b>six blocks</b>.',
      start:{col:1,row:1},
      /* Every beat has exactly one open lane, and consecutive open lanes are
         never neighbours — so up/down/left/right cannot fly this at all,
         which is the entire argument for goTo. Four corners on a cycle, so
         a repeat still pays on top. */
      beats:[
        'XXX/XXX/.XX',  'XX./XXX/XXX',  'XXX/XXX/XX.',  '.XX/XXX/XXX',
        'XXX/XXX/.XX',  'XX./XXX/XXX',  'XXX/XXX/XX.',  '.XX/XXX/XXX',
        'XXX/XXX/.XX',  'XX./XXX/XXX',  'XXX/XXX/XX.',  '.XX/XXX/XXX'
      ] }
  ];

  let L=null, busy=false, ship=null, rocks=[], bolts=[], wasFP=null;

  /* ---------------------------------------------------------- the chart */
  const rowsOf = s => String(s).split('/');
  /* rows are written top first, so row 2 is line 0 */
  function blocked(mask, col, row){
    const r=rowsOf(mask)[ROWS-1-row];
    return !!r && r[col]==='X';
  }
  /* Is there a way through at all?  Walk every lane you could be in at every
     beat and see whether any survives to the end.  A chart that fails this
     is not hard, it is broken, and it says so in the console the moment the
     stage loads rather than after a child has tried it nine times.

     `jump` says which kind of motion is being tested: false is one lane per
     beat, which is what up/down/left/right can do, and true is anywhere at
     all, which is what goTo can do.  The difference between those two
     answers IS the lesson on the last leg — that chart is built so the first
     one fails and the second one passes. */
  function solvable(beats, start, jump){
    let live=new Set([start.col+','+start.row]);
    for(let b=0;b<beats.length;b++){
      const next=new Set();
      const open=[];
      for(let c=0;c<COLS;c++) for(let r=0;r<ROWS;r++)
        if(!blocked(beats[b],c,r)) open.push([c,r]);
      if(jump){
        open.forEach(([c,r])=>next.add(c+','+r));   // goTo reaches any of them
      } else for(const key of live){
        const [c,r]=key.split(',').map(Number);
        [[c,r],[c,r+1],[c,r-1],[c-1,r],[c+1,r]].forEach(([nc,nr])=>{
          if(nc<0||nc>=COLS||nr<0||nr>=ROWS) return;
          if(blocked(beats[b],nc,nr)) return;
          next.add(nc+','+nr);
        });
      }
      if(!next.size) return { ok:false, beat:b+1 };
      live=next;
    }
    return { ok:true };
  }

  /* --------------------------------------------------------- the world */
  const laneX = c => (c-(COLS-1)/2)*LANE;
  const laneY = r => 6 + (r-(ROWS-1)/2)*LANE;
  const beatZ = b => -b*GAP;

  function starfield(){
    const n=1400, pos=new Float32Array(n*3);
    for(let i=0;i<n;i++){
      pos[i*3  ]=(Math.random()-0.5)*260;
      pos[i*3+1]=(Math.random()-0.5)*180+40;
      pos[i*3+2]=-Math.random()*900;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos,3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color:0xdfe8ff, size:0.5,
                                                          sizeAttenuation:true }));
  }
  /* The lane rails.  Without them the nine lanes are invisible and the whole
     mission becomes a guess — this is the grid the chart is drawn on, made
     out of lines running away to the horizon. */
  function rails(len){
    const pts=[], far=-len*GAP-GAP;
    const xs=[], ys=[];
    for(let i=0;i<=COLS;i++) xs.push(laneX(0)-LANE/2 + i*LANE);
    for(let i=0;i<=ROWS;i++) ys.push(laneY(0)-LANE/2 + i*LANE);
    // the long lines, one at every lane edge
    xs.forEach(x=>ys.forEach(y=>{ pts.push(x,y,GAP, x,y,far); }));
    // and a hoop at every beat, so distance reads as distance
    for(let b=0;b<=len;b++){
      const z=beatZ(b);
      xs.forEach(x=>{ pts.push(x,ys[0],z, x,ys[ys.length-1],z); });
      ys.forEach(y=>{ pts.push(xs[0],y,z, xs[xs.length-1],y,z); });
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts),3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({
      color:0x4d7cff, transparent:true, opacity:0.34 }));
  }
  /* A rock.  An icosahedron with its corners knocked about, so twenty of them
     in a row do not read as twenty of the same ball. */
  function rock(r){
    const g=new THREE.IcosahedronGeometry(r, 0);
    const p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const k=0.78+Math.random()*0.44;
      p.setXYZ(i, p.getX(i)*k, p.getY(i)*k, p.getZ(i)*k);
    }
    if(g.computeVertexNormals) g.computeVertexNormals();
    const m=new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color:0x8a7f6e }));
    m.userData.spin=new THREE.Vector3((Math.random()-0.5)*0.9,
                                      (Math.random()-0.5)*0.9,
                                      (Math.random()-0.5)*0.9);
    return m;
  }
  function target(){
    const g=new THREE.Group();
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,0.16,8,26),
      new THREE.MeshLambertMaterial({color:0xff9aa2}));
    const core=new THREE.Mesh(new THREE.SphereGeometry(0.5,12,10),
      new THREE.MeshBasicMaterial({color:0xffe9a8}));
    g.add(ring, core);
    g.userData.core=core;
    return g;
  }
  /* The ship, out of primitives — there is no space kit in the assets, and a
     blocky little fighter sits with the rest of the game anyway. */
  function build(){
    const g=new THREE.Group();
    const hull=new THREE.MeshLambertMaterial({color:0xe8ecff});
    const trim=new THREE.MeshLambertMaterial({color:0x8fd3ff});
    const nose=new THREE.Mesh(new THREE.ConeGeometry(0.42,1.5,10), hull);
    nose.rotation.x=-Math.PI/2; nose.position.z=-1.0; g.add(nose);
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.86,0.5,1.7), hull);
    g.add(body);
    [-1,1].forEach(s=>{
      const w=new THREE.Mesh(new THREE.BoxGeometry(1.25,0.14,0.8), trim);
      w.position.set(s*0.9, -0.06, 0.3); w.rotation.z=s*0.12; g.add(w);
      const f=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.5,0.5), trim);
      f.position.set(s*1.4, 0.2, 0.5); g.add(f);
    });
    // small, and tucked into the tail: a big one sits between the camera and
    // the ship and is the only thing you can see
    const glow=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8),
      new THREE.MeshBasicMaterial({color:0x8ff0ff, transparent:true, opacity:0.85}));
    glow.position.z=0.92; glow.scale.z=1.7; g.add(glow);
    g.userData.glow=glow;
    return g;
  }

  /* ------------------------------------------------------------- start */
  function start(n){
    const idx=Math.max(0, Math.min(STAGES.length-1, n||0));
    const K=STAGES[idx];
    busy=false; rocks=[]; bolts=[];
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.ceiling=null;
    G.scene.background=new THREE.Color(SKY);
    G.scene.fog=new THREE.Fog(SKY, 90, 320);
    /* G.running stays FALSE on purpose. It is what stops step() from running,
       and step() ends by pointing the camera over a walking player's shoulder
       — which is not the shot this mission needs. Everything the flight needs
       per frame it does itself in tick(), which runs outside that gate. */
    G.hudOwner='flight'; G.missionId='flight'; G.room=null; G.running=false;
    if(window.updateLeaveBtn) updateLeaveBtn();
    ['#mapwrap','#health','#skill','#trigger'].forEach(s=>{
      const e=document.querySelector(s); if(e) e.classList.add('hidden'); });

    const beats=K.beats||[];
    if(K.kind==='fly'){
      const jumps=K.pal.indexOf('goTo')>=0;
      const s=solvable(beats, K.start, jumps);
      // an unflyable chart is an authoring mistake, and it should say so
      if(!s.ok) console.warn('FLIGHT: stage "'+K.id+'" has no way through at beat '+s.beat);
      // and a goTo stage that one-lane steps could also fly is a goTo stage
      // that never teaches anything, which is the quieter mistake
      if(jumps && solvable(beats, K.start, false).ok)
        console.warn('FLIGHT: stage "'+K.id+'" does not need goTo — relative steps fly it too');
    }
    L={ idx, K, kind:K.kind, beats,
        col:K.start.col, row:K.start.row,          // the lane it is heading for
        fromCol:K.start.col, fromRow:K.start.row,  // and the one it is leaving
        ease:1,                                    // 0..1 between the two
        beat:0, elapsed:0, rolling:false, done:false, crashed:false,
        steps:null, at:0, shipZ:0, shipY:laneY(K.start.row), left:0 };

    G.scene.add(starfield());                      // sky, not room: it never moves
    G.roomGroup.add(rails(Math.max(beats.length, 6)));
    if(K.kind==='fly') layRocks(); else layTargets();

    ship=build(); G.roomGroup.add(ship);
    if(window.AVATAR) AVATAR.detach();
    /* The held blaster is a first-person prop and it hangs in the middle of
       the windscreen out here. GUN only re-reads this in step(), which the
       flight does not run, so it is told once and put back on the way out. */
    if(wasFP===null) wasFP=!!G.firstPerson;
    G.firstPerson=false;
    if(window.GUN) GUN.update(0,false);
    G.ground=null;
    G.pos.set(laneX(L.col), laneY(L.row), 0);
    G.yaw=0; G.pitch=0; G.vel.y=0; G.onGround=true;
    fly();

    CODE.setGrid(COLS, ROWS);
    CODE.setPalette(K.pal); CODE.setBudget(K.budget); CODE.clear();
    guide();
    hud(); brief(K.brief);
    teach();
  }

  function layRocks(){
    L.beats.forEach((mask,i)=>{
      const b=i+1;
      for(let c=0;c<COLS;c++) for(let r=0;r<ROWS;r++){
        if(!blocked(mask,c,r)) continue;
        const m=rock(1.05+Math.random()*0.35);
        m.position.set(laneX(c)+(Math.random()-0.5)*0.5,
                       laneY(r)+(Math.random()-0.5)*0.5, beatZ(b));
        G.roomGroup.add(m); rocks.push(m);
      }
    });
  }
  function layTargets(){
    L.left=0;
    for(let c=0;c<COLS;c++) for(let r=0;r<ROWS;r++){
      if(!blocked(L.K.targets,c,r)) continue;
      const m=target();
      m.position.set(laneX(c), laneY(r), beatZ(2));
      m.userData.col=c; m.userData.row=r; m.userData.alive=true;
      G.roomGroup.add(m); rocks.push(m); L.left++;
    }
  }

  /* ------------------------------------------------------- run a program */
  function run(steps){
    if(busy || !L || L.done) return;
    L.crashed=false;
    if(L.kind==='gun') return runGun(steps);
    // the flight is not walked step by step: it is flown on a clock, and
    // tick() pulls the next block off as each beat arrives
    busy=true;
    L.steps=steps; L.at=0;
    L.beat=0; L.elapsed=0; L.rolling=true;
    L.col=L.fromCol=L.K.start.col; L.row=L.fromRow=L.K.start.row; L.ease=1;
    L.shipZ=0;
    pull();                                       // the move for beat 1 starts now
    brief(t('Engines lit. {n} beats ahead.',{n:L.beats.length}));
  }
  const beatMs = () => BEAT_MS * (window.DIFF?DIFF.time():1);

  /* Take the next real instruction off the list.  The markers a repeat leaves
     behind are bookkeeping, not moves, so they light up the tape and cost no
     beat — otherwise a loop would eat the clock it is meant to save. */
  function pull(){
    if(!L || !L.steps) return;
    while(L.at < L.steps.length){
      const s=L.steps[L.at++];
      if(s.name==='__iter'){ CODE.setIter(s.blockId,s.i,s.n); continue; }
      if(s.name==='__if' || s.name==='__call'){ CODE.highlight(s); continue; }
      CODE.highlight(s);
      return move(s);
    }
    CODE.highlight(null);                          // out of program: it coasts on
  }
  function move(s){
    L.fromCol=L.col; L.fromRow=L.row; L.ease=0;
    if(s.name==='flyUp')    L.row=Math.min(ROWS-1, L.row+1);
    if(s.name==='flyDown')  L.row=Math.max(0,      L.row-1);
    if(s.name==='flyLeft')  L.col=Math.max(0,      L.col-1);
    if(s.name==='flyRight') L.col=Math.min(COLS-1, L.col+1);
    if(s.name==='goTo'){
      L.col=Math.max(0,Math.min(COLS-1, s.col|0));
      L.row=Math.max(0,Math.min(ROWS-1, s.row|0));
    }
    // coast() and fire() move nothing: the beat passes and the lane holds
  }

  /* every frame, whether the console is open or not */
  function tick(dt){
    if(!L) return;
    spin(dt);
    if(L.rolling && !L.done && !L.crashed && awake()){
      const B=beatMs()/1000;
      L.elapsed += dt;
      const bp=L.elapsed/B;
      while(L.beat < Math.floor(bp) && L.rolling && !L.crashed){
        L.beat++;
        gate(L.beat);                               // the rocks at this plane
        if(L.rolling && !L.crashed) pull();         // then the move for the next
      }
      L.ease = Math.min(1, bp - Math.floor(bp) === 0 ? 1 : (bp - Math.floor(bp)));
      L.shipZ = -bp*GAP;
      beatOut();
    }
    fly();
    boltsTick(dt);
  }
  /* the world stands still while a card or the pause menu is up, or the beat
     would run out behind a screen the student is reading */
  function awake(){
    return document.querySelector('#teach').classList.contains('hidden')
        && document.querySelector('#pause').classList.contains('hidden');
  }
  function gate(b){
    if(b>L.beats.length) return finish();
    const mask=L.beats[b-1];
    if(blocked(mask, L.col, L.row)) return crash(b);
  }
  /* Place the ship, then the camera behind it.

     The camera only follows PART of the way across a lane change (FOLLOW
     below). Track the ship exactly and the ship would sit dead centre of the
     screen for the whole mission with the field sliding sideways around it,
     which reads as the world dodging rather than you — and the one thing the
     student has to see is their own block moving their own ship. */
  const FOLLOW=0.45;
  const CAM_BACK=10, CAM_UP=1.4, CAM_AHEAD=24;
  function fly(){
    if(!ship || !L) return;
    const k=L.ease<1 ? (L.ease<0.5 ? 2*L.ease*L.ease : 1-Math.pow(-2*L.ease+2,2)/2) : 1;
    const x=laneX(L.fromCol)+(laneX(L.col)-laneX(L.fromCol))*k;
    const y=laneY(L.fromRow)+(laneY(L.row)-laneY(L.fromRow))*k;
    L.shipY=y;
    ship.position.set(x,y,L.shipZ);
    // bank into the slide, and pitch into the climb — it reads as flying
    ship.rotation.z = (laneX(L.fromCol)-laneX(L.col))*0.22*(1-Math.abs(2*k-1));
    ship.rotation.x = (laneY(L.fromRow)-laneY(L.row))*0.12*(1-Math.abs(2*k-1));
    const gl=ship.userData.glow;
    if(gl) gl.scale.z = 1.4 + Math.sin(performance.now()/90)*0.35;

    const mid=laneY(1);
    const cx=x*FOLLOW, cy=mid+(y-mid)*FOLLOW+CAM_UP, cz=L.shipZ+CAM_BACK;
    G.pos.set(x, y, L.shipZ);                     // anything else reading it stays sane
    G.camera.position.set(cx, cy, cz);
    G.camera.rotation.set(0,0,0);
    // aimed a little above the ship, so the ship sits low in frame and the
    // field you are about to fly into gets the rest of the screen
    G.camera.lookAt(x*0.6, mid+(y-mid)*0.6+1.1, L.shipZ-CAM_AHEAD);
  }
  function spin(dt){
    rocks.forEach(m=>{
      const s=m.userData.spin;
      if(!s) return;
      m.rotation.x+=s.x*dt; m.rotation.y+=s.y*dt; m.rotation.z+=s.z*dt;
    });
  }

  /* ------------------------------------------------------ the gunnery range
     No clock out here, so this one IS walked step by step, the way the
     Circuit and Escape are. */
  function runGun(steps){
    busy=true;
    let i=0;
    (function next(){
      if(!L || L.done){ busy=false; return; }
      if(i>=steps.length){
        busy=false; CODE.highlight(null); CODE.hideTape();
        if(L.left>0) brief(t('Program finished with {n} target(s) still standing.',{n:L.left}));
        return;
      }
      const s=steps[i++];
      if(s.name==='__iter'){ CODE.setIter(s.blockId,s.i,s.n); return setTimeout(next,90); }
      if(s.name==='__if'||s.name==='__call'){ CODE.highlight(s); return setTimeout(next,90); }
      CODE.highlight(s);
      act(s, ()=>{ if(!L || L.done){ busy=false; return; } setTimeout(next,50); });
    })();
  }
  function act(s, done){
    if(s.name==='fire') return fire(done);
    const c0=L.col, r0=L.row;
    move(s);
    if(c0===L.col && r0===L.row){ L.ease=1; return setTimeout(done, 120); }
    ease(0,1,GUN_MS, k=>{ L.ease=k; fly(); }, ()=>{ L.ease=1; fly(); done(); });
  }
  function fire(done){
    const b=new THREE.Mesh(new THREE.SphereGeometry(0.26,8,6),
      new THREE.MeshBasicMaterial({color:0x8ff0ff}));
    b.position.copy(ship.position); b.position.z-=1.4;
    G.roomGroup.add(b);
    bolts.push({ m:b, col:L.col, row:L.row, done, t:0 });
    if(window.beep) beep('pop');
  }
  function boltsTick(dt){
    for(let i=bolts.length-1;i>=0;i--){
      const b=bolts[i];
      b.m.position.z -= 62*dt; b.t+=dt;
      const hit = rocks.find(m=>m.userData.alive && m.userData.col===b.col
                                                 && m.userData.row===b.row);
      if(hit && b.m.position.z <= hit.position.z+0.9){
        hit.userData.alive=false;
        G.roomGroup.remove(hit);
        L.left--;
        pop(hit.position);
        finishBolt(i, b);
        if(L.left<=0) finish();
        continue;
      }
      if(b.t>0.9){ finishBolt(i,b); brief(t('That lane was empty — nothing to hit.')); }
    }
  }
  function finishBolt(i, b){
    G.roomGroup.remove(b.m);
    bolts.splice(i,1);
    if(b.done) b.done();
  }
  function pop(at){
    for(let i=0;i<9;i++){
      const p=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.28,0.28),
        new THREE.MeshBasicMaterial({color:i%2?0xffe9a8:0xff9aa2}));
      p.position.copy(at);
      const v=new THREE.Vector3((Math.random()-0.5)*12,(Math.random()-0.5)*12,
                                (Math.random()-0.5)*12);
      G.roomGroup.add(p);
      const t0=performance.now();
      (function f(){
        const k=(performance.now()-t0)/520;
        if(k>=1 || !L){ if(p.parent) p.parent.remove(p); return; }
        p.position.addScaledVector(v, 0.016);
        p.scale.setScalar(1-k);
        setTimeout(f,16);
      })();
    }
    if(window.beep) beep('star');
  }

  /* --------------------------------------------------------- ending it */
  function crash(b){
    if(!L || L.crashed || L.done) return;
    L.crashed=true; L.rolling=false; busy=false;
    CODE.hideTape(); CODE.highlight(null);
    shake();
    if(window.beep) beep('bad');
    // the one fact worth knowing: WHICH beat, so the chart can be re-read
    brief(t('💥 Rock on beat {n}, lane col {c} row {r}. Look at beat {n} on the chart and put yourself somewhere open.',
            {n:b, c:L.col, r:L.row}));
    setTimeout(()=>{ if(L && L.crashed) reset(); }, 1500);
  }
  function reset(){
    if(!L) return;
    L.crashed=false; L.rolling=false; L.beat=0; L.elapsed=0; L.at=0; L.steps=null;
    L.col=L.fromCol=L.K.start.col; L.row=L.fromRow=L.K.start.row;
    L.ease=1; L.shipZ=0;
    fly(); hud(); beatOut();
  }
  function finish(){
    if(!L || L.done) return;
    L.done=true; L.rolling=false; busy=false;
    CODE.hideTape(); CODE.close(); CODE.setGuide(null);
    if(window.beep) beep('star');
    const last = L.idx+1 >= STAGES.length;
    if(!last){
      brief(L.kind==='gun' ? t('🎯 Range clear — next leg…') : t('✅ Field flown — next leg…'));
      setTimeout(()=>{ if(L) start(L.idx+1); }, 1700);
      return;
    }
    if(window.PROGRESS) PROGRESS.complete('flight');
    const blocks = CODE.countBlocks ? CODE.countBlocks() : '—';
    showResults({
      title:t('THE FIELD IS BEHIND YOU'),
      body:t('Nine lanes, a fixed clock, and a program that says not just what to do but when to do it. That is motion — relative, absolute, repeated and timed.'),
      stats:`<div><b>${t('Legs flown')}</b> ${STAGES.length}</div>
             <div><b>${t('Blocks on the last one')}</b> ${blocks}</div>`,
      btnText:t('Back to the menu'),
      onBtn:()=>{ document.querySelector('#done').classList.add('hidden');
                  stop(); if(window.MENU) MENU.open(); }
    });
    G.running=false;
  }

  /* --------------------------------------------------------------- HUD */
  /* The chart, drawn.  You cannot write a program for a field you cannot
     see, so the same nine-lane grid the rocks are laid on is printed beat
     by beat above the palette while you write. */
  function chartHTML(upto){
    if(!L) return '';
    const cells=(mask)=>{
      let out='';
      for(let r=ROWS-1;r>=0;r--){
        for(let c=0;c<COLS;c++)
          out+=`<i class="${blocked(mask,c,r)?'rock':''}"></i>`;
      }
      return out;
    };
    if(L.kind==='gun'){
      return `<div class="chart"><div class="cbeat"><b>${t('TARGETS')}</b>
        <div class="cgrid">${cells(L.K.targets)}</div></div></div>`;
    }
    const n = upto===undefined ? L.beats.length : upto;
    return '<div class="chart">'+L.beats.slice(0,n).map((m,i)=>
      `<div class="cbeat${L.rolling&&L.beat===i+1?' on':''}"><b>${i+1}</b>
        <div class="cgrid">${cells(m)}</div></div>`).join('')+'</div>';
  }
  function guide(){
    const K=L.K;
    CODE.setGuide({
      brief:K.brief+chartHTML(),
      name:K.learn.name, text:K.learn.text, code:K.learn.code });
  }
  function hud(){
    if(!L) return;
    document.querySelector('#missionName').textContent=
      t('Leg {n} — {name}',{n:L.idx+1, name:t(L.K.name)});
    document.querySelector('#objList').innerHTML=STAGES.map((s,i)=>
      `<li class="${i<L.idx?'done':(i===L.idx?'cur':'')}">${i<L.idx?'✔ ':'• '}${
        s.kind==='gun'?'🎯 ':'🪨 '}${t(s.name)}</li>`).join('');
  }
  /* how far through the field the ship is, right now, over the windscreen */
  function beatOut(){
    const el=document.querySelector('#fbeat'); if(!el) return;
    if(!L || L.kind==='gun' || !L.rolling){ el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const b=Math.min(L.beat+1, L.beats.length);
    el.innerHTML=`<div class="fb-lbl">${t('BEAT')}</div>
      <div class="fb-n">${b} <small>/ ${L.beats.length}</small></div>
      <div class="fb-lane">${t('col')} ${L.col} · ${t('row')} ${L.row}</div>`;
  }
  function teach(){
    const el=document.querySelector('#teach');
    el.classList.remove('hidden');
    el.innerHTML=`<div class="teach-card">
      <div class="kicker">${t('LEG {n}',{n:L.idx+1})} · ${t(L.K.learn.name)}</div>
      <h2>${t(L.K.name)}</h2>
      <p>${t(L.K.brief)}</p>
      <pre>${L.K.learn.code}</pre>
      <div class="why">${t(L.K.learn.text)}</div>
      <button class="btn good" id="teachGo">${
        L.kind==='gun'? t('To the range ▶') : t('Launch ▶')}</button>
      <div style="font-size:13px;color:var(--muted);margin-top:9px">${t('or press SPACE')}</div>
    </div>`;
    el.querySelector('#teachGo').onclick=()=>{ el.classList.add('hidden'); CODE.show(); };
  }
  let mt=null;
  function brief(html){
    const b=document.querySelector('#briefing');
    b.classList.remove('hidden'); b.innerHTML=t(html);
    clearTimeout(mt);
    mt=setTimeout(()=>{ if(L && !L.done) b.innerHTML=t(L.K.brief); }, 4600);
  }
  function shake(){
    const h=document.querySelector('#hurt');
    h.classList.add('on'); setTimeout(()=>h.classList.remove('on'),340);
  }
  function ease(a,b,ms,set,done){
    const t0=performance.now();
    (function f(){
      const k=Math.min(1,(performance.now()-t0)/ms);
      set(a+(b-a)*(k<.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2));
      if(k<1) setTimeout(f,16); else if(done) done();
    })();
  }

  function stop(){
    L=null; busy=false; rocks=[]; bolts=[];
    if(ship && ship.parent) ship.parent.remove(ship);
    ship=null;
    G.ground=null;
    if(wasFP!==null){ G.firstPerson=wasFP; wasFP=null;
                      if(window.GUN) GUN.update(0,false); }
    const fb=document.querySelector('#fbeat'); if(fb) fb.classList.add('hidden');
    document.querySelector('#mapwrap').classList.remove('hidden');
    CODE.setBudget(0); CODE.setGuide(null); CODE.setGrid(3,3);
  }

  return { start, run, tick, update:tick, stop, solvable, blocked,
           get active(){ return !!L; },
           get busy(){ return busy; },
           retry(){ if(L) start(L.idx); },
           count: STAGES.length, STAGES };
})();
