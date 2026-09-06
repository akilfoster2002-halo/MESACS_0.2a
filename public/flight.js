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
    { id:'first', kind:'fly', stops:2, name:'First Contact', budget:8,
      pal:['addY','addX','coast'],
      learn:{ name:'A move is arithmetic',
              text:'x is your column, y is your row. Change one and you move.',
              code:'change y by 1\ncoast()\nchange x by -1\nchange y by -1' },
      brief:'<b>change y by 1</b> goes up a row, <b>change y by -1</b> goes down. <b>x</b> is across. The sign is the direction.',
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
      pal:['addY','addX','fire'],
      learn:{ name:'The same nine lanes',
              text:'No clock here. fire() hits your own lane.',
              code:'change x by -1\nfire()\nchange y by 1\nfire()' },
      brief:'Four targets, twelve blocks. Move, then <b>fire()</b>.',
      start:{col:1,row:1},
      targets:'X.X/.../X.X' },

    { id:'rhythm', kind:'fly', stops:2, name:'The Rhythm', budget:6,
      pal:['addY','addX','coast','repeat'],
      learn:{ name:'A pattern of rock is a repeat',
              text:'Three walls, over and over. Write them once.',
              code:'repeat 4\n  change y by 1\n  change y by -1\n  coast()\nend' },
      brief:'Twelve walls, <b>six blocks</b>. Find the bit that repeats.',
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
      pal:['addY','addX','fire','repeat'],
      learn:{ name:'A row of targets is a loop',
              text:'Shoot, slide, shoot, slide. That is a repeat.',
              code:'repeat 3\n  fire()\n  change x by 1\nend' },
      brief:'Three targets, <b>four blocks</b>. One at a time needs five.',
      start:{col:0,row:0},
      targets:'.../.../XXX' },

    /* Deep Field lived here: eighteen walls in six blocks, which only fits if
       you put a repeat inside a repeat. Nesting is out of this mission — one
       loop is a big enough idea to be worth its own leg, and a second one
       hidden inside it turned the leg into a puzzle about block budgets
       rather than about motion. The language still has it, and the Library
       still explains it, for anyone who wants it in Free Play. */

    { id:'spin', kind:'fly', stops:3, name:'Hard to Starboard', budget:9,
      pal:['addX','addY','turn','coast'],
      learn:{ name:'An angle is a number too',
              text:'turn +90 and turn -90 add and subtract from which way up you are. Two of the same turn is 180.',
              code:'turn 90\ncoast()\nturn -90\nturn 90' },
      brief:'These are too big to go round — one gap each, cut at an angle. <b>turn +90</b> and <b>turn -90</b> rotate the ship. Line up with the gap. Where you are does not matter here, only which way up you are.',
      start:{col:1,row:1},
      /* Slot walls only. The whole windscreen is rock with one gap through
         it, so x and y are useless and the only number that matters is the
         angle — which is the point of the leg. Angles chosen so the answer is
         a real sum: +90, then +90 again to reach 180, then -90 back. */
      beats:[
        'slot90',   // turn 90
        'slot90',   // coast — still lined up, and worth noticing
        'slot0',    // turn -90  (or +90: both land on a slot that is mod 180)
        'slot90',   // turn 90
        'slot0',    // turn 90   — 180 is the same slot as 0
        'slot0',    // coast
        'slot90',   // turn 90
        'slot0'     // turn 90
      ] },

    { id:'coords', kind:'fly', stops:3, name:'The Coordinate System', budget:8,
      pal:['setX','setY','addX','addY','coast','repeat'],
      learn:{ name:'x is the column, y is the row',
              text:'set x to 2 puts you there. change x by 1 adds to where you are.',
              code:'change x by 2\nchange y by -1\nchange y by -1\nchange x by -2' },
      brief:'<b>set x to 2</b> puts you in column 2 whatever you were. <b>change x by 1</b> adds one to it. Two different sums.',
      start:{col:0,row:2},
      /* One gap per beat, and it only ever moves along ONE axis at a time —
         because one beat runs one block and a block changes one coordinate.
         Written for a program that uses both forms of it: relative arithmetic
         round the outside, then two outright assignments to cut the corner.

            x = x + 2   y = y - 1   y = y - 1   x = x - 2
            y = y + 2   x = 1       y = 0       x = x + 1                  */
      beats:[
        'XX./XXX/XXX',   // x = x + 2  → (2,2)
        'XXX/XX./XXX',   // y = y - 1  → (2,1)
        'XXX/XXX/XX.',   // y = y - 1  → (2,0)
        'XXX/XXX/.XX',   // x = x - 2  → (0,0)
        '.XX/XXX/XXX',   // y = y + 2  → (0,2)
        'X.X/XXX/XXX',   // x = 1      → (1,2)
        'XXX/XXX/X.X',   // y = 0      → (1,0)
        'XXX/XXX/XX.'    // x = x + 1  → (2,0)
      ] },

    { id:'jump', kind:'fly', stops:2, name:'Jump Drive', budget:6,
      pal:['addX','addY','coast','repeat','goTo'],
      learn:{ name:'Absolute beats relative',
              text:'One step cannot cross the field. goTo can.',
              code:'repeat 3\n  goto 0,0\n  goto 2,2\n  goto 2,0\n  goto 0,2\nend' },
      brief:'One gap per wall, always a <b>corner</b>. Four corners, three times, <b>six blocks</b>.',
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
  let shipSpan=3.7;                  // measured off the ship the moment it is built

  /* ---------------------------------------------------------- the chart */
  const clamp=(v,n)=>Math.max(0, Math.min(n-1, v));
  const rowsOf = s => String(s).split('/');

  /* A wall is one of two things.

       '.X./.../XXX'   a MASK: which of the nine lanes are rock. You get past
                       it by being in an open lane, which is arithmetic on x
                       and y.
       'slot90'        a SLOT: one asteroid big enough to fill the windscreen,
                       with a single gap cut through it at that angle. Where
                       you are does not matter — the gap spans the whole
                       field. What matters is whether the SHIP is turned to
                       line up with it, which is arithmetic on an angle. A
                       slot at 0 and one at 180 are the same slot, so the test
                       is mod 180.

     Two kinds of wall, two kinds of number, one rule: every block changes a
     number and every wall checks one. */
  const isSlot = w => String(w).indexOf('slot')===0;
  const slotAngle = w => ((parseInt(String(w).slice(4),10)||0)%180+180)%180;
  const norm = a => ((a%360)+360)%360;
  /* turning 270 degrees one way is 90 the other; roll the short way round */
  const shortWay = (from,to) => { let d=norm(to)-norm(from);
    if(d>180) d-=360; if(d<-180) d+=360; return d; };

  /* rows are written top first, so row 2 is line 0 */
  function blocked(mask, col, row){
    if(isSlot(mask)) return false;               // a slot blocks no lane
    const r=rowsOf(mask)[ROWS-1-row];
    return !!r && r[col]==='X';
  }
  /* Does standing HERE, turned THIS way, get me through that wall? The one
     question the mission is built on, asked in a single place so the runner,
     the radar and the chart checker can never disagree about the answer. */
  function hits(wall, col, row, ang){
    if(wall===null || wall===undefined) return false;
    if(isSlot(wall)) return (norm(ang)%180) !== slotAngle(wall);
    return blocked(wall, col, row);
  }
  /* Is there a way through at all?  Walk every lane you could be in at every
     beat and see whether any survives to the end.  A chart that fails this
     is not hard, it is broken, and it says so in the console the moment the
     stage loads rather than after a child has tried it nine times.

     `mode` says which kind of motion is being tested, because the palette a
     leg hands out decides what "reachable in one beat" even means:

       'step'  one lane, up/down/left/right — neighbours only
       'axis'  x = 2 / y = y + 1 — any lane along ONE axis, because an
               assignment moves one coordinate and a beat only runs one block,
               so a diagonal still costs two beats
       'jump'  goTo(col,row) — both coordinates at once, so anywhere at all

     The gap between those answers is the lesson on the legs that need it: a
     chart flyable under 'jump' and not under 'step' is what makes goTo worth
     having rather than merely nicer. */
  const MODES={
    step:(c,r)=>[[c,r],[c,r+1],[c,r-1],[c-1,r],[c+1,r]],
    axis:(c,r)=>{ const o=[];
      for(let i=0;i<COLS;i++) o.push([i,r]);
      for(let i=0;i<ROWS;i++) o.push([c,i]);
      return o; }
  };
  function solvable(beats, start, mode){
    mode = mode===true ? 'jump' : (mode||'step');
    let live=new Set([start.col+','+start.row]);
    for(let b=0;b<beats.length;b++){
      /* A slot asks about the angle, not the lane, and one turn block always
         reaches any quarter turn — so it never narrows where you can be. It
         is a wall you pass by turning, which this check does not model
         because there is nothing to get wrong about it. */
      if(isSlot(beats[b])) continue;
      const next=new Set();
      if(mode==='jump'){
        for(let c=0;c<COLS;c++) for(let r=0;r<ROWS;r++)
          if(!blocked(beats[b],c,r)) next.add(c+','+r);
      } else {
        const reach=MODES[mode]||MODES.step;
        for(const key of live){
          const [c,r]=key.split(',').map(Number);
          reach(c,r).forEach(([nc,nr])=>{
            if(nc<0||nc>=COLS||nr<0||nr>=ROWS) return;
            if(blocked(beats[b],nc,nr)) return;
            next.add(nc+','+nr);
          });
        }
      }
      if(!next.size) return { ok:false, beat:b+1 };
      live=next;
    }
    return { ok:true };
  }
  /* what the blocks this leg hands out can actually do in one beat */
  function modeOf(pal){
    if(pal.indexOf('goTo')>=0) return 'jump';
    if(pal.some(p=>p==='setX'||p==='setY'||p==='addX'||p==='addY')) return 'axis';
    return 'step';
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
    // whichever ship you have equipped in the Wardrobe — a shape and two
    // colours, since there is no space kit to load models from
    const K=(window.SHOP && SHOP.ship) ? SHOP.ship()
          : { hull:0xe8ecff, trim:0x8fd3ff, wing:1.25, nose:1.5 };
    const hull=new THREE.MeshLambertMaterial({color:K.hull});
    const trim=new THREE.MeshLambertMaterial({color:K.trim});
    const nose=new THREE.Mesh(new THREE.ConeGeometry(0.42,K.nose,10), hull);
    nose.rotation.x=-Math.PI/2; nose.position.z=-(0.25+K.nose/2); g.add(nose);
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.86,0.5,1.7), hull);
    g.add(body);
    [-1,1].forEach(s=>{
      const w=new THREE.Mesh(new THREE.BoxGeometry(K.wing,0.14,0.8), trim);
      w.position.set(s*(K.wing*0.72), -0.06, 0.3); w.rotation.z=s*0.12; g.add(w);
      const f=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.5,0.5), trim);
      f.position.set(s*(K.wing*1.12), 0.2, 0.5); g.add(f);
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
    /* The crosshair box still said "Mission 1 — Space Explorer · E — go in"
       from the station you were looking at a second ago, sitting in the middle
       of the windscreen inviting a key that does nothing here. focusScan only
       runs while G.running, which this mission turns off, so it would have sat
       there for the whole leg. */
    const fx=document.querySelector('#focus');
    if(fx){ fx.classList.add('hidden'); fx.innerHTML=''; }
    G.focused=null; G.selected=null;
    /* And say what the keys ACTUALLY do here. Nothing flies this ship but the
       program, so a legend promising W A S D is a legend promising a frozen
       game. */
    if(window.keyHint) keyHint(
      `<b>C</b> ${t('write your program')} &nbsp; <b>${t('RUN')}</b> ${t('flies it')}<br>
       <b>C</b> ${t('again stops the field')} &nbsp; <b>P</b> ${t('pause')}
       &nbsp; <b>Esc</b> ${t('frees the mouse')}`);

    const beats=K.beats||[];
    if(K.kind==='fly'){
      const mode=modeOf(K.pal);
      const s=solvable(beats, K.start, mode);
      // an unflyable chart is an authoring mistake, and it should say so
      if(!s.ok) console.warn('FLIGHT: stage "'+K.id+'" has no way through at beat '+s.beat);
      /* And a leg that hands out the fancy motion but could be flown with
         plain one-lane steps has not taught anything — it has only mentioned
         it. That is the quieter mistake, so it gets its own warning. */
      if(mode!=='step' && solvable(beats, K.start, 'step').ok)
        console.warn('FLIGHT: stage "'+K.id+'" does not need '+mode+
                     ' motion — one-lane steps fly it too');
    }
    L={ idx, K, kind:K.kind, beats,
        col:K.start.col, row:K.start.row,          // the lane it is heading for
        fromCol:K.start.col, fromRow:K.start.row,  // and the one it is leaving
        ang:0, fromAng:0,                          // and which way up it is
        ease:1,                                    // 0..1 between the two
        beat:0, elapsed:0, rolling:false, done:false, crashed:false, taught:false,
        steps:null, at:0, shipZ:0, shipY:laneY(K.start.row), left:0,
        /* How many times you went back to the console. The first program is
           free — every stop after it is one you are trying to avoid, and a
           loop is what buys you the beats to avoid it. */
        runs:0, gen:0, wasOpen:false, radarKey:'', radarFocus:undefined };

    G.scene.add(starfield());                      // sky, not room: it never moves
    G.roomGroup.add(rails(Math.max(beats.length, 6)));
    /* The ship is built FIRST and measured, because a slot has to be cut to
       fit it. Laying the field first meant guessing a gap width, and the
       guess was 1.66 against a ship 3.67 across — so even lined up perfectly
       it ploughed through the rock instead of flying through the hole. */
    ship=build(); G.roomGroup.add(ship);
    const sb=new THREE.Box3().setFromObject(ship);
    shipSpan=Math.max(sb.max.x-sb.min.x, sb.max.y-sb.min.y);

    if(K.kind==='fly') layRocks(); else layTargets();
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
      if(isSlot(mask)){ laySlot(mask, b); return; }
      for(let c=0;c<COLS;c++) for(let r=0;r<ROWS;r++){
        if(!blocked(mask,c,r)) continue;
        const m=rock(1.05+Math.random()*0.35);
        m.position.set(laneX(c)+(Math.random()-0.5)*0.5,
                       laneY(r)+(Math.random()-0.5)*0.5, beatZ(b));
        G.roomGroup.add(m); rocks.push(m);
      }
    });
  }
  /* One asteroid across the whole windscreen with a single gap cut through
     it. Two slabs either side of the gap, the pair rotated to the slot's
     angle — so the gap is visibly a slot you have to line up with rather
     than a lane you have to find. */
  const SLOT_DEPTH=6;                // deep enough that going through reads as a tunnel
  function laySlot(mask, b){
    const ang=slotAngle(mask);
    const g=new THREE.Group();
    const span=LANE*COLS+3;
    /* Wide enough for the ship AT ANY ANGLE, not just the right one. It turns
       while it flies, so it meets the gap part-way through a rotation, and a
       gap cut to the aligned width would clip it every single time. */
    const gap=shipSpan+1.7, slab=Math.max(2.4,(span-gap)/2);
    const mat=new THREE.MeshLambertMaterial({ color:0x8a7f6e });
    const inner=gap/2, outer=gap/2+slab;
    [-1,1].forEach(sgn=>{
      // rubble rather than a clean brick, so it reads as asteroid — but kept
      // clear of the hole, or the rocks close the gap the slab left open
      const part=new THREE.Group();
      for(let i=0;i<8;i++){
        const rad=0.9+Math.random()*0.7;
        const lo=inner+rad+0.25, hi=Math.max(lo+0.1, outer-rad*0.4);
        const d=lo+Math.random()*(hi-lo);
        const m=rock(rad);
        m.position.set((Math.random()-0.5)*span*0.9, sgn*d,
                       (Math.random()-0.5)*SLOT_DEPTH*0.6);
        part.add(m);
      }
      const core=new THREE.Mesh(new THREE.BoxGeometry(span, slab, SLOT_DEPTH), mat);
      core.position.y=sgn*(gap/2+slab/2);
      part.add(core);
      g.add(part);
    });
    g.rotation.z=ang*Math.PI/180;
    g.position.z=beatZ(b);
    G.roomGroup.add(g);
    rocks.push(g);
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
    if(!L || L.done) return;
    /* RUN always means START OVER. It used to bail out whenever a run was
       already in flight, which is fine until one ends without clearing the
       flag — and then the button is simply dead with nothing on screen to say
       why. Every press bumps a generation instead, and anything still running
       from the last press notices and stops. */
    L.gen=(L.gen||0)+1;
    busy=false;
    bolts.forEach(b=>{ if(b.m && b.m.parent) b.m.parent.remove(b.m); });
    bolts=[];
    L.crashed=false;
    if(L.kind==='gun') return runGun(steps);
    // the flight is not walked step by step: it is flown on a clock, and
    // tick() pulls the next block off as each beat arrives
    busy=true;
    L.runs++;
    L.steps=steps; L.at=0;
    L.beat=0; L.elapsed=0; L.rolling=true;
    /* EVERYTHING the last attempt changed goes back, not just the position.
       The angle is state too, and a ship left rotated by a crash makes the
       same program fly differently the second time — which looks like the
       game cheating rather than like a bug. */
    L.col=L.fromCol=L.K.start.col; L.row=L.fromRow=L.K.start.row;
    L.ang=L.fromAng=0; L.ease=1; L.shipZ=0; L.radarFocus=undefined;
    pull();                                       // the move for beat 1 starts now
    brief(L.runs>1
      ? t('Again from the start. Stops: {n}.',{n:stops()})
      : t('{n} walls ahead. <b>C</b> stops everything.',{n:L.beats.length}));
  }
  const beatMs = () => BEAT_MS * (window.DIFF?DIFF.time():1);
  const stops = () => Math.max(0, (L?L.runs:0) - 1);
  /* cheap fingerprint of the written program, so the radar knows to redraw */
  const progSig = () => (window.CODE && CODE.script)
    ? CODE.countBlocks()+':'+CODE.toText().join(';') : '';

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
  /* One instruction, applied to a lane. Pure, because the radar has to run
     the whole program forward WITHOUT flying it — that is what lets it show
     you where you will be at each wall instead of only where you are now. */
  function applyMove(c, r, a, s){
    if(s.name==='goTo'){ c=clamp(s.col|0, COLS); r=clamp(s.row|0, ROWS); }
    if(s.name==='setX') c=clamp(s.n|0, COLS);
    if(s.name==='setY') r=clamp(s.n|0, ROWS);
    if(s.name==='addX') c=clamp(c+(s.n|0), COLS);
    if(s.name==='addY') r=clamp(r+(s.n|0), ROWS);
    // an angle is a number too, and it wraps rather than clamping
    if(s.name==='turn') a=norm(a+(s.n|0));
    return {c,r,a};
  }
  /* The whole program against the whole field, from the start line. This is
     what lets the radar sit on the wall you are ACTUALLY working on rather
     than always on wall one: walls your program already clears are solved,
     and the first one that is unwritten or hit is your next problem. */
  function runProgram(){
    const out=[];
    let c=L.K.start.col, r=L.K.start.row, a=0, at=0;
    const steps = (window.CODE && CODE.script && CODE.script.length)
          ? CODE.compile(CODE.script) : [];
    for(let w=1; w<=L.beats.length; w++){
      let s=null;
      while(at<steps.length){
        const x=steps[at++];
        if(x.name==='__iter'||x.name==='__if'||x.name==='__call') continue;
        s=x; break;
      }
      if(s){ const m=applyMove(c,r,a,s); c=m.c; r=m.r; a=m.a; }
      out.push({ wall:w, col:c, row:r, ang:a, written:!!s,
                 hit:hits(L.beats[w-1], c, r, a) });
    }
    return out;
  }
  /* which wall you are being asked about right now */
  function focusOf(all){
    for(let i=0;i<all.length;i++) if(!all[i].written || all[i].hit) return i;
    return all.length;                       // every wall written and clear
  }
  /* Run the program forward and say which lane you are in at each of the
     next few walls, and whether that lane is rock. This is the whole answer
     to "how do I know the next wall is clear" — you look, and it tells you. */
  function predict(count){
    const out=[];
    let c, r, a, steps, at;
    if(L.rolling && L.steps){ c=L.col; r=L.row; a=L.ang; steps=L.steps; at=L.at; }
    else {
      c=L.K.start.col; r=L.K.start.row; a=0; at=0;
      steps = (window.CODE && CODE.script && CODE.script.length)
            ? CODE.compile(CODE.script) : [];
    }
    const first = L.rolling ? L.beat+1 : 1;
    for(let k=0;k<count;k++){
      let s=null;
      while(at<steps.length){
        const x=steps[at++];
        if(x.name==='__iter'||x.name==='__if'||x.name==='__call') continue;
        s=x; break;
      }
      if(s){ const m=applyMove(c,r,a,s); c=m.c; r=m.r; a=m.a; }
      const wall=first+k;
      const mask = (wall>=1 && wall<=L.beats.length) ? L.beats[wall-1] : null;
      out.push({ wall, col:c, row:r, ang:a, written:!!s,
                 hit: mask!==null && hits(mask,c,r,a) });
    }
    return out;
  }
  function move(s){
    L.fromCol=L.col; L.fromRow=L.row; L.fromAng=L.ang; L.ease=0;
    const m=applyMove(L.col, L.row, L.ang, s);
    L.col=m.c; L.row=m.r; L.ang=m.a;
    // coast() and fire() move nothing: the wall passes and the lane holds
  }

  /* every frame, whether the console is open or not */
  function tick(dt){
    if(!L) return;
    spin(dt);
    /* Opening the console froze the field. Rebuild the guide right then, so
       the radar you plan against is the one from the beat you stopped at
       rather than whatever it said when the leg began. */
    const open=!!(window.CODE && CODE.isOpen());
    /* The console's copy of the radar has to follow the program too, so it
       is rebuilt whenever a block goes in or comes out — otherwise adding
       up() would leave the picture claiming you are still in the rock. */
    if(open){
      const sig=progSig();
      if(sig!==L.progSig){ L.progSig=sig; if(L.wasOpen) guide(); }
    }
    if(open!==L.wasOpen){
      L.wasOpen=open;
      if(open){ L.progSig=progSig(); guide(); }
    }
    if(window.COACH) COACH.tick(dt);
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
    radarOut();
  }
  /* THE CONSOLE IS THE PAUSE BUTTON.  Press C and the field stops dead where
     it is, so you can look at what is about to hit you and write your way out
     of it — then RUN flies the leg again from the start with the new program.
     Every other mission keeps its world turning while you type; this one must
     not, because reacting to a wall you cannot stop to look at is not a
     lesson, it is a reflex test. */
  function awake(){
    return document.querySelector('#teach').classList.contains('hidden')
        && document.querySelector('#pause').classList.contains('hidden')
        && !(window.CODE && CODE.isOpen());
  }
  function gate(b){
    if(b>L.beats.length) return finish();
    if(hits(L.beats[b-1], L.col, L.row, L.ang)) return crash(b);
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
    /* Roll to the angle you have turned to, plus a lean into the slide. The
       turn is the thing a slot wall is actually measuring, so it has to be
       visible on the ship and not just true in a variable. */
    const a0=L.fromAng, a1=L.fromAng+shortWay(L.fromAng, L.ang);
    ship.rotation.z = -(a0+(a1-a0)*k)*Math.PI/180
                    + (laneX(L.fromCol)-laneX(L.col))*0.22*(1-Math.abs(2*k-1));
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
    const gen=L.gen;
    busy=true;
    restoreTargets();
    L.col=L.fromCol=L.K.start.col; L.row=L.fromRow=L.K.start.row;
    L.ang=L.fromAng=0; L.ease=1;
    fly(0.016,false,false);
    let i=0;
    (function next(){
      // a newer press has taken over, so this chain is finished with
      if(!L || L.done || L.gen!==gen){ busy=false; return; }
      if(i>=steps.length){
        busy=false; CODE.highlight(null); CODE.hideTape();
        if(L.left>0) brief(t('Program finished with {n} target(s) still standing.',{n:L.left}));
        return;
      }
      const s=steps[i++];
      if(s.name==='__iter'){ CODE.setIter(s.blockId,s.i,s.n); return setTimeout(next,90); }
      if(s.name==='__if'||s.name==='__call'){ CODE.highlight(s); return setTimeout(next,90); }
      CODE.highlight(s);
      act(s, ()=>{ if(!L || L.done || L.gen!==gen){ busy=false; return; }
                   setTimeout(next,50); });
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
    bolts.push({ m:b, col:L.col, row:L.row, done, t:0, gen:L.gen });
    if(window.beep) beep('pop');
  }
  function boltsTick(dt){
    for(let i=bolts.length-1;i>=0;i--){
      const b=bolts[i];
      if(!L || b.gen!==L.gen){ finishBolt(i,b); continue; }   // fired last round
      b.m.position.z -= 62*dt; b.t+=dt;
      const hit = rocks.find(m=>m.userData.alive && m.userData.col===b.col
                                                 && m.userData.row===b.row);
      if(hit && b.m.position.z <= hit.position.z+0.9){
        hit.userData.alive=false;
        hit.visible=false;                 // hidden, not removed: Run puts it back
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
    /* Say what actually went wrong. On a slot wall the lane is irrelevant and
       being told to pick a gap is advice you cannot act on. */
    brief(isSlot(L.beats[b-1])
      ? t('💥 Wall {n} — side-on to the gap. Turn to line up with it.',{n:b})
      : t('💥 Wall {n} — you were in the rock. Look at the radar and pick the gap.',{n:b}));
    /* Back to the line, and the console opens itself. Crashing means the
       program was wrong, so the console is exactly where you need to be —
       and being dropped back on the start line with nothing happening is how
       a nine-year-old concludes the game is over. */
    setTimeout(()=>{
      if(!L || !L.crashed) return;
      reset();
      if(window.CODE && !CODE.isOpen()) CODE.show();
    }, 1600);
  }
  /* Back to the start line, in every sense: lane, angle, distance and the
     radar's idea of where you had got to. */
  function reset(){
    if(!L) return;
    L.crashed=false; L.rolling=false; L.beat=0; L.elapsed=0; L.at=0; L.steps=null;
    L.col=L.fromCol=L.K.start.col; L.row=L.fromRow=L.K.start.row;
    L.ang=L.fromAng=0; L.ease=1; L.shipZ=0; L.radarFocus=undefined;
    if(L.kind==='gun') restoreTargets();
    fly(); hud(); beatOut();
  }
  /* The range is a start line too. Targets you shot last time come back and
     the crosshair goes home, or a second Run continues a half-finished round
     and the program you are testing is not the program that gets judged. */
  function restoreTargets(){
    L.left=0;
    rocks.forEach(m=>{
      if(!m.userData || m.userData.col===undefined) return;
      m.userData.alive=true; m.visible=true; L.left++;
    });
  }
  function finish(){
    if(!L || L.done) return;
    L.done=true; L.rolling=false; busy=false;
    CODE.hideTape(); CODE.close(); CODE.setGuide(null);
    if(window.beep) beep('star');
    if(L.idx===0) markWalked();
    if(window.COACH) COACH.stop();
    if(window.WALLET) WALLET.award(t('{n} flown',{n:t(L.K.name)}), 25, 12, 'flight_'+L.K.id);
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
             <div><b>${t('Stops on the last one')}</b> ${stops()}</div>
             <div><b>${t('Blocks on the last one')}</b> ${blocks}</div>`,
      btnText:t('Back to the menu'),
      onBtn:()=>{ document.querySelector('#done').classList.add('hidden');
                  stop(); if(window.MENU) MENU.open(); }
    });
    G.running=false;
  }

  /* ------------------------------------------------- the first leg, walked

     The teach card explains the idea; it does not get anybody's hands on the
     controls. So leg one is walked: open the console, click a block, watch
     the budget, press RUN. Every step is checked from the world — from the
     script that actually exists and the console that is actually open — so
     working ahead of it is fine and skipping it is one click.

     Only the first leg, and only until you have flown it once. By leg two
     you know what a beat is. */
  const WALKED_KEY='dq_flight_walked';
  function walked(){ try{ return !!localStorage.getItem(WALKED_KEY); }catch(e){ return false; } }
  function markWalked(){ try{ localStorage.setItem(WALKED_KEY,'1'); }catch(e){} }

  const scriptLen = () => (window.CODE && CODE.script) ? CODE.countBlocks() : 0;
  const hasOp = op => !!(window.CODE && CODE.script &&
    CODE.script.some(b=>b.type===op));

  function walkFirstLeg(){
    if(!window.COACH) return;
    // the coach is about to say the same thing in the same corner
    const b=document.querySelector('#briefing'); if(b) b.classList.add('hidden');
    /* Every step needs a gate of its OWN. The coach stands just past the last
       step that has already happened, which is what stops it nagging — but it
       means two steps sharing a condition collapse into one, and the first
       draft of this lost the radar explanation the instant any block was
       added. One step, one thing you have to do. */
    COACH.start([
      /* It starts OUT here in the world, looking at the walls, and only then
         sends you into the console — a student who has never seen the field
         has no idea what the console is for. */
      { say:'Those walls are coming at you. The radar top-left shows the next three. Press <b>C</b> to write your program.',
        find:()=>document.querySelector('#codeBtn'),
        done:()=>!!(window.CODE && CODE.isOpen()) },
      { say:'Pink on the radar is a rock in your lane. <b>change y by 1</b> moves you up a row — click it.',
        sel:'#conPalette [data-add="addY"]', done:()=>hasOp('addY') },
      { say:'Next wall is clear. Click <b>coast()</b> to hold.',
        sel:'#conPalette [data-add="coast"]', done:()=>hasOp('coast') },
      { say:'Eight walls, eight blocks. Fill in the rest.',
        sel:'#conBudget', done:()=>scriptLen()>=6 },
      { say:'Press <b>RUN</b>. <b>C</b> freezes the field any time.',
        sel:'#conRun', done:()=>!!(L && L.rolling) }
    ], {});
  }

  /* --------------------------------------------------------------- HUD */
  /* THE RADAR.

     This replaced a strip of numbered cards holding the whole field, which
     nobody could read: twelve identical little grids in a row do not tell
     you which one is about to hit you, and that is the only question you
     ever actually have.

     So it shows three walls and no more — the one you are about to meet
     drawn big, the two behind it smaller and dimmer, so the panel reads as
     depth rather than as a list.  Your own lane is marked on every one of
     them, which is the thing the cards never did: you are not looking up a
     fact about the field, you are looking at whether YOU are in the way.
     Sit in the path of the nearest wall and that cell goes red. */
  function radarHTML(){
    if(!L) return '';
    const cell=(mask,c,r,mc,mr)=>{
      const rock=blocked(mask,c,r);
      const me=(c===mc && r===mr);
      return `<i class="${rock?'rock':''}${me?' me':''}${rock&&me?' hit':''}"></i>`;
    };
    const grid=(mask,mc,mr)=>{
      let out='';
      for(let r=ROWS-1;r>=0;r--) for(let c=0;c<COLS;c++) out+=cell(mask,c,r,mc,mr);
      return out;
    };
    if(L.kind==='gun'){
      return `<div class="radar"><div class="rw big"><b>${t('TARGETS')}</b>
        <div class="rgrid">${grid(L.K.targets,L.col,L.row)}</div></div></div>`;
    }
    /* Each wall shows where YOUR PROGRAM puts you at that wall, with a tick
       if it gets through and a cross if it does not.

       And the cards MOVE. While you are writing, the big one is the first
       wall your program has not solved yet — solve it and it slides off and
       the next problem takes its place. A radar permanently showing walls one
       to three tells you nothing about where you have got to. */
    let p, solved=0, total=L.beats.length, focus;
    if(L.rolling){
      p=predict(3); focus=p[0].wall;
    } else {
      const all=runProgram();
      const i=focusOf(all);
      solved=i; focus=i+1;
      p=[0,1,2].map(k=>all[i+k] || { wall:total+1+k, col:-1, row:-1, hit:false });
    }
    const moved = L.radarFocus!==undefined && L.radarFocus!==focus;
    L.radarFocus=focus;
    const size=['big','mid','far'];
    let out='<div class="radar'+(moved?' advance':'')+'">';
    for(let k=0;k<3;k++){
      const q=p[k];
      if(!q || q.wall>total){
        out+=`<div class="rw ${size[k]} clear"><b>${k?'':t('CLEAR')}</b>
          <div class="rgrid">${grid('.../.../...', -1, -1)}</div></div>`;
        continue;
      }
      const wall=L.beats[q.wall-1];
      /* A slot wall is not a grid of lanes, so drawing one would be a lie.
         It gets the gap it actually is, at the angle it actually is, with
         the ship drawn at the angle YOUR program will have it turned to. */
      const pic = isSlot(wall)
        ? `<div class="rslot" style="--sa:${slotAngle(wall)}deg">
             <i class="rs-gap"></i><b class="rs-ship" style="--pa:${norm(q.ang)}deg"></b>
           </div>`
        : `<div class="rgrid">${grid(wall, q.col, q.row)}</div>`;
      /* A verdict only where there IS one. A wall your program has not
         written a block for gets a dash, not a tick — coasting happens to
         clear a lot of them, and a tick under a wall you have said nothing
         about is a tick you did not earn. Delete the block and the tick goes
         with it, which is the whole point of the mark. */
      const said = q.written || L.rolling;
      const bad  = said && q.hit;
      out+=`<div class="rw ${size[k]}${bad?' warn':''}${said?'':' unsaid'}">
        <b>${k===0?t('NOW'):'+'+k} <small>${q.wall}</small></b>
        ${pic}
        <u class="rmark">${said ? (q.hit?'✕':'✓') : '–'}</u></div>`;
    }
    out+=`<div class="rlegend">${L.rolling ? eta()
            : (solved>=total ? t('All clear — press RUN')
                             : t('{a} of {b} walls done',{a:solved,b:total}))}</div></div>`;
    return out;
  }
  /* seconds until the nearest wall reaches you — the number that decides
     whether you have time to think or need to press C right now */
  function eta(){
    if(!L || !L.rolling) return t('holding');
    const B=beatMs()/1000;
    const left=Math.max(0, (L.beat+1) - L.elapsed/B) * B;
    return t('{s}s to impact',{s:left.toFixed(1)});
  }
  function guide(){
    const K=L.K;
    CODE.setGuide({
      /* Translate the brief BEFORE the radar markup is glued on: the console
         runs t() over whatever it is handed, and "the brief plus a div full
         of radar" is not a string any dictionary has an entry for. */
      brief:t(K.brief)+radarHTML(),
      name:K.learn.name, text:K.learn.text, code:K.learn.code });
  }
  /* The same radar, on the windscreen.  Rebuilt only when something on it
     actually changed — this runs every frame, and re-writing nine cells of
     HTML sixty times a second for a picture that changes once a beat is how
     a smooth mission turns into a slideshow. */
  function radarOut(){
    const el=document.querySelector('#radar'); if(!el) return;
    if(!L || (window.CODE && CODE.isOpen())){ el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const key=[L.kind,L.rolling?L.beat:-1,L.col,L.row,
               Math.round((L.elapsed||0)*10), progSig()].join('|');
    if(key===L.radarKey) return;
    L.radarKey=key;
    el.innerHTML=radarHTML();
  }
  function hud(){
    if(!L) return;
    document.querySelector('#missionName').textContent=
      t('Leg {n} — {name}',{n:L.idx+1, name:t(L.K.name)});
    const legs=STAGES.map((s,i)=>
      `<li class="${i<L.idx?'done':(i===L.idx?'cur':'')}">${i<L.idx?'✔ ':'• '}${
        s.kind==='gun'?'🎯 ':'🪨 '}${t(s.name)}</li>`).join('');
    // stops are the score on a timed leg; the range has no clock to beat
    const tgt=L.K.stops;
    document.querySelector('#objList').innerHTML =
      (tgt===undefined ? '' :
        `<li class="cur">⏸ ${t('Stops')}: <b>${stops()}</b> ${t('of')} <b>${tgt}</b>
          ${stops()>tgt?'⚠':''}</li>`) + legs;
  }
  /* how far through the field the ship is, right now, over the windscreen */
  function beatOut(){
    const el=document.querySelector('#fbeat'); if(!el) return;
    if(!L || L.kind==='gun' || !L.rolling){ el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const b=Math.min(L.beat+1, L.beats.length);
    el.innerHTML=`<div class="fb-lbl">${t('WALL')}</div>
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
        L.kind==='gun'? t('To the range ▶') : t('Look at the field ▶')}</button>
      <div style="font-size:13px;color:var(--muted);margin-top:9px">${t('or press SPACE')}</div>
    </div>`;
    /* The card used to open the console on its way out, so the first thing a
       student ever saw of this mission was a wall of text over a wall of
       blocks. It drops you at the start line now, looking down the field at
       the rocks you are about to be asked about; C opens the console when
       you are ready. */
    el.querySelector('#teachGo').onclick=()=>{
      el.classList.add('hidden');
      if(L && L.idx===0 && !walked() && !L.taught){ L.taught=true; walkFirstLeg(); }
      else brief(t('Press <b>C</b> to write your program.'));
    };
  }
  let mt=null;
  function brief(html){
    /* While the walkthrough is running it is already saying the next thing to
       do, in the same corner. Two boxes of text over each other is how the
       first screenshot of this mission ended up unreadable. A crash still
       gets through, because that one is news. */
    if(window.COACH && COACH.running && String(html).indexOf('💥')<0) return;
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
    if(window.COACH) COACH.stop();
    if(window.keyHint) keyHint(null);
    L=null; busy=false; rocks=[]; bolts=[];
    if(ship && ship.parent) ship.parent.remove(ship);
    ship=null;
    G.ground=null;
    if(wasFP!==null){ G.firstPerson=wasFP; wasFP=null;
                      if(window.GUN) GUN.update(0,false); }
    const fb=document.querySelector('#fbeat'); if(fb) fb.classList.add('hidden');
    const rd=document.querySelector('#radar'); if(rd){ rd.classList.add('hidden'); rd.innerHTML=''; }
    document.querySelector('#mapwrap').classList.remove('hidden');
    CODE.setBudget(0); CODE.setGuide(null); CODE.setGrid(3,3);
  }

  return { start, run, tick, update:tick, stop, solvable, blocked,
           get active(){ return !!L; },
           get busy(){ return busy; },
           retry(){ if(L) start(L.idx); },
           count: STAGES.length, STAGES };
})();
