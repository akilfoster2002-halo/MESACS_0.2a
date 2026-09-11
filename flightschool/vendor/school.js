/* GENERATED — copied from public/school.js by tools/build-flightschool.js.
   Edit public/school.js and re-run `npm run build:flightschool`. */
/* =====================================================================
   FLIGHT SCHOOL — the grid, before anything is moving at you.

   Space Explorer teaches motion at speed: nine lanes, a wall of rock every
   beat, and a program that is a list of things happening AT A TIME. That
   is the right lesson and it is the wrong first lesson, because a student
   who has not yet met a coordinate is being asked to do arithmetic on one
   while something is flying at them.

   So this comes first, and nothing here moves until you tell it to.

     LEVEL 1   one command, and the whole board is (0,2) to (4,2)
     LEVEL 2   two axes, so x and y are two different questions
     LEVEL 3   a heading of your own, which position cannot give you
     LEVEL 4   glide: one command, both axes, and you watch it cross
     LEVEL 5   an angle that is not a quarter turn
     LEVEL 6   all of it, over a course

   TWO THINGS THIS BOARD IS CAREFUL ABOUT, both of them taken from the
   worksheet it is built from:

   THE AVATAR STANDS ON A LATTICE POINT, not in a square. (0,2) is where
   two lines cross. A grid of boxes teaches "third box along"; a grid of
   lines teaches a coordinate, and the difference shows up the moment
   somebody meets graph paper.

   AND `change x by` MOVES ALONG X WHATEVER YOU ARE FACING. Position and
   heading are separate facts about the avatar, and keeping them separate
   is what stops "turn" being confused with "move". You turn because the
   goal asks you to face somewhere, not to steer.
   ===================================================================== */
window.SCHOOL = (function(){
  /* FOUR QUADRANTS. The board runs -H..+H on both axes with the origin in
     the middle of it, because that is the axis a student meets everywhere
     after this one and because three quarters of what a coordinate can be
     was missing from a first-quadrant sheet. Every level below is placed in
     terms of H, so widening the board is one number. */
  const H=4;                          // -4..4, so nine lattice points a side
  const N=2*H+1;
  const CELL=2.4;                     // world units between two gridlines
  const STEP_MS=520;                  // one command, slow enough to follow
  const GLIDE_MS=1100;                // and a glide is meant to be watched
  const SKY=0x0a0e1c;

  /* Headings are degrees COUNTERCLOCKWISE FROM EAST, because that is what
     they are in every maths lesson these students will ever sit. So east is
     0, north is 90, and `turn 90` is the counterclockwise button on the
     worksheet. A game that taught the other sign would be teaching a habit
     somebody has to unlearn. */
  const COMPASS={ 0:'East',      45:'North-East', 90:'North',  135:'North-West',
                  180:'West', 225:'South-West', 270:'South', 315:'South-East' };

  /* TEN LEVELS, and the order is the argument.

     One number, then two. Then the minus sign, which is the whole reason
     for a four-quadrant board and the thing a first-quadrant sheet cannot
     teach at all. Then heading, which is not position. Then glide, which is
     both numbers at once. Then a lap of all four quadrants, which is where
     the signs stop being a rule and become a picture. Then an angle that is
     not a corner, then absolute against relative, then everything.

     Every level says what it is FOR in `learn` — that card is on screen
     while the program is being written, so it has to be the idea rather
     than the instructions. */
  const LEVELS=[
    { id:'one', name:'One Command', budget:1, walk:true,
      pal:['addX','addY'],
      start:{x:0,y:0,a:0}, goal:{x:4,y:0},
      learn:{ name:'A coordinate is two numbers',
              text:'x is across, y is up. Change one and you move along that axis.',
              code:'change x by 4' },
      brief:'Use <b>ONE</b> command to get from the origin <b>(0, 0)</b> to the star at <b>(4, 0)</b>. Only <b>x</b> has changed — so only <b>x</b> needs a command.' },

    { id:'both', name:'Both Axes', budget:2,
      pal:['addX','addY'],
      start:{x:0,y:0,a:0}, goal:{x:3,y:2},
      learn:{ name:'Two axes, two commands',
              text:'x and y are separate questions. Answer them one at a time.',
              code:'change x by 3\nchange y by 2' },
      brief:'From <b>(0, 0)</b> to <b>(3, 2)</b>. Both numbers have changed this time, and each one is its own command. <b>Two blocks.</b>' },

    { id:'left', name:'The Other Way', budget:1,
      pal:['addX','addY'],
      start:{x:0,y:0,a:0}, goal:{x:-3,y:0},
      learn:{ name:'A minus sign is a direction',
              text:'Right is more x. Left is less. The number does not change size, only side.',
              code:'change x by -3' },
      brief:'The star is at <b>(-3, 0)</b> — the same distance as last time, the other way. <b>change x by -3</b>. One block.' },

    { id:'third', name:'Down and Left', budget:2,
      pal:['addX','addY'],
      start:{x:2,y:1,a:0}, goal:{x:-2,y:-3},
      learn:{ name:'Both numbers can be negative',
              text:'Down is less y, the same way left is less x. Below and left of the origin, both are.',
              code:'change x by -4\nchange y by -4' },
      brief:'From <b>(2, 1)</b> down to <b>(-2, -3)</b>. Count the squares, not the coordinates — you are moving <b>4</b> along each axis, and both of them backwards.' },

    /* ------------------------------------------------ the heading blocks */
    { id:'face', name:'Which Way You Face', budget:2,
      pal:['addX','addY','turnL','turnR','turn'],
      start:{x:-1,y:-2,a:0}, goal:{x:-1,y:2,face:90},
      learn:{ name:'Where you are is not which way you point',
              text:'Moving along y does not turn you. Turning does not move you. The two arrows are one turn each way — or turn 90 and turn -90, which is the same pair written once.',
              code:'change y by 4\nturn left 90' },
      brief:'Get to <b>(-1, 2)</b> <i>and</i> finish facing <b>North</b>. Moving up the board does not turn the ship — <b>turn ↺</b> goes counterclockwise, <b>turn ↻</b> goes clockwise.' },

    { id:'steps', name:'Point, Then Move', budget:2,
      pal:['point','move','turnL','turnR'],
      start:{x:0,y:0,a:0}, goal:{x:-4,y:0,face:180},
      learn:{ name:'Steps go where the nose goes',
              text:'change x by does not care which way you face. move does — it is the only block here that reads your heading.',
              code:'point in direction 180\nmove 4 steps' },
      brief:'No <b>change x by</b> this time. <b>Point</b> the ship at the star and <b>move</b> — steps go the way the nose is pointing. <b>0</b> is East, <b>90</b> is North, <b>180</b> is West.' },

    /* --------------------------------------------- getting there quickly */
    { id:'goto', name:'There, Or There Slowly', budget:3,
      pal:['goTo','glide','turnR','turnL','move','point'],
      start:{x:-4,y:-4,a:0}, goal:{x:3,y:3,face:270},
      via:[{x:4,y:-4}],
      learn:{ name:'The same two numbers, with and without the time',
              text:'goTo puts you there. glide takes you there, and you can say how many seconds it spends doing it. Then face where you were told to.',
              code:'goto 4,-4\nglide 2 secs to 3,3\nturn right 90' },
      brief:'Touch the <b>ring</b> at <b>(4, -4)</b>, land on the star, and finish facing <b>South</b>. <b>go to</b> arrives instantly; <b>glide</b> crosses in front of you — and the number of <b>secs</b> is how long you get to watch it.' },

    { id:'quads', name:'All Four Quadrants', budget:4,
      pal:['glide','addX','addY'],
      start:{x:0,y:0,a:0}, goal:{x:3,y:-3},
      via:[{x:3,y:3},{x:-3,y:3},{x:-3,y:-3}],
      learn:{ name:'Each quarter has its own pair of signs',
              text:'(+,+) then (-,+) then (-,-) then (+,-). Going round, only one sign changes at a time.',
              code:'glide 1 secs to 3,3\nglide 1 secs to -3,3\nglide 1 secs to -3,-3\nglide 1 secs to 3,-3' },
      brief:'Once round the board: touch all three <b>rings</b> in order and land on the star. Watch what happens to the two signs as you go — <b>only one of them flips at each corner.</b>' },

    { id:'random', name:'Wherever You Land', budget:3,
      pal:['goRnd','setX','setY','addX','addY'],
      start:{x:0,y:0,a:0}, goal:{x:0,y:0},
      learn:{ name:'This is why absolute exists',
              text:'change x by is a step from here, and you do not know where here is. set x to is a place. Only one of them can get you home from nowhere in particular.',
              code:'go to random position\nset x to 0\nset y to 0' },
      brief:'Get thrown somewhere on the board, then come back to the <b>origin</b>. You cannot count the steps — you do not know where you will be. <b>set x to 0</b> and <b>set y to 0</b> do not need to know.' },

    { id:'course', name:'The Course', budget:4,
      turnStep:45,
      pal:['glide','point','pointAt','move','turn','turnL','turnR','setX','setY','addX','addY'],
      start:{x:0,y:0,a:0}, goal:{x:-3,y:0,face:225},
      via:[{x:4,y:-2},{x:1,y:4}],
      learn:{ name:'All of it',
              text:'Two marks on the way, a star to land on, and a heading to finish on — and a turn that is not a corner. 45 is half a quarter.',
              code:'glide 1 secs to 4,-2\nglide 1 secs to 1,4\npoint towards the star\nmove 4 steps' },
      brief:'Touch both <b>rings</b> in order, then take the last leg <b>diagonally</b>: <b>point towards the star</b> turns you to face it from wherever you are, and <b>move</b> walks you down the diagonal. <b>Four blocks.</b>' }
  ];

  let on=false, L=null, busy=false, group=null, ship=null, wasFP=null, anim=null;
  let nextT=null;

  const px = x => x*CELL;             // a coordinate, in world units
  const pz = y => -y*CELL;            // y is UP the board, so it runs -z

  /* ------------------------------------------------------------- board */
  function label(txt, size){
    const c=document.createElement('canvas'); c.width=c.height=64;
    const x=c.getContext('2d');
    x.fillStyle='#cfe3ff'; x.font='bold 40px "Trebuchet MS",sans-serif';
    x.textAlign='center'; x.textBaseline='middle';
    x.fillText(txt,32,34);
    const tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace;
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tx, transparent:true, depthWrite:false}));
    s.scale.set(size||1.5, size||1.5, 1);
    return s;
  }
  function board(){
    const g=new THREE.Group();
    const lo=-H*CELL, hi=H*CELL;

    /* The gridlines, and then the two AXES drawn heavier on top of them.
       On the worksheet the axes are the thing you read the numbers off, so
       they cannot be just two more faint lines — and on a four-quadrant
       board they are not the edge either, they are the middle. */
    const faint=new THREE.LineBasicMaterial({color:0x2f3d5c});
    const pts=[];
    for(let i=-H;i<=H;i++){
      pts.push(px(i),0,pz(-H), px(i),0,pz(H));
      pts.push(px(-H),0,pz(i), px(H),0,pz(i));
    }
    const lg=new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts),3));
    g.add(new THREE.LineSegments(lg, faint));

    const axis=new THREE.MeshBasicMaterial({color:0x8ff0ff});
    const bar=(w,d,x,z)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,0.05,d), axis);
      m.position.set(x,0.01,z); g.add(m); };
    const over=CELL*0.6;                       // how far the axis runs past the last line
    bar(2*hi+over*2, 0.09, 0, 0);              // x, through the origin
    bar(0.09, 2*hi+over*2, 0, 0);              // y, through the origin
    /* Arrowheads at BOTH ends now. A four-quadrant axis that only points
       one way is a first-quadrant axis with extra squares on it. */
    const head=(rot,x,z)=>{ const m=new THREE.Mesh(new THREE.ConeGeometry(0.24,0.6,3), axis);
      m.position.set(x,0.02,z); m.rotation.set(Math.PI/2,0,rot); g.add(m); };
    head(-Math.PI/2, hi+over, 0);              // east
    head( Math.PI/2, lo-over, 0);              // west
    head(0,          0, lo-over);              // north
    head(Math.PI,    0, hi+over);              // south

    /* The numbers. Zero is written ONCE, in the corner of the origin, the
       way it is on paper — a 0 on each axis at the same point is two noughts
       on top of each other. */
    for(let i=-H;i<=H;i++){
      if(i===0) continue;
      const lx=label(String(i), 1.15); lx.position.set(px(i), 0.02, 0.80); g.add(lx);
      const ly=label(String(i), 1.15); ly.position.set(-0.80, 0.02, pz(i)); g.add(ly);
    }
    const z0=label('0', 1.15); z0.position.set(-0.72, 0.02, 0.72); g.add(z0);
    const ax=label('x',1.25); ax.position.set(hi+over, 0.02, 0.86); g.add(ax);
    const ay=label('y',1.25); ay.position.set(-0.86, 0.02, lo-over); g.add(ay);

    /* And the quadrants named, faintly, out at the corners. Nobody is asked
       to learn the numerals — they are there so that "the third quadrant"
       has somewhere to point when a teacher says it. */
    const q=(txt,x,z)=>{ const m=label(txt, 1.6);
      m.material.opacity=0.28; m.material.transparent=true;
      m.position.set(x,0.02,z); g.add(m); };
    const c=hi-CELL*0.55;
    q('I', c, -c); q('II', -c, -c); q('III', -c, c); q('IV', c, c);
    return g;
  }
  /* A five-pointed star, because that is what is on the sheet. */
  function star(){
    const sh=new THREE.Shape();
    for(let i=0;i<10;i++){
      const r=i%2?0.34:0.85, a=Math.PI/2 + i*Math.PI/5;
      const x=Math.cos(a)*r, y=Math.sin(a)*r;
      i ? sh.lineTo(x,y) : sh.moveTo(x,y);
    }
    sh.closePath();
    const m=new THREE.Mesh(new THREE.ShapeGeometry(sh),
      new THREE.MeshBasicMaterial({color:0xffd23f, side:THREE.DoubleSide}));
    m.rotation.x=-Math.PI/2;
    return m;
  }
  function ring(){
    const m=new THREE.Mesh(new THREE.TorusGeometry(0.62,0.09,8,26),
      new THREE.MeshBasicMaterial({color:0xcdb4f6}));
    m.rotation.x=-Math.PI/2;
    return m;
  }
  /* The avatar: the ship you fly everywhere else, seen from above and sat
     in the worksheet's ring so its heading is unmistakable. */
  function avatar(){
    const g=new THREE.Group();
    const r=new THREE.Mesh(new THREE.TorusGeometry(0.86,0.07,8,30),
      new THREE.MeshBasicMaterial({color:0x8fd3ff}));
    r.rotation.x=-Math.PI/2; g.add(r);
    const hull=(window.SHOP && SHOP.model) ? SHOP.model() : null;
    if(hull){
      /* The ship is built nose down -Z and this board is read from above
         with east to the right, so it is turned a quarter and laid flat. */
      hull.scale.setScalar(0.42);
      hull.rotation.y=-Math.PI/2;
      hull.position.y=0.12;
      g.add(hull);
    } else {
      const n=new THREE.Mesh(new THREE.ConeGeometry(0.34,0.9,3),
        new THREE.MeshBasicMaterial({color:0x8fd3ff}));
      n.rotation.set(Math.PI/2,0,-Math.PI/2); g.add(n);
    }
    return g;
  }

  /* ------------------------------------------------------------- start */
  function start(n){
    stop();
    clearTimeout(nextT); nextT=null;
    const idx=Math.max(0, Math.min(LEVELS.length-1, n||0));
    const K=LEVELS[idx];
    /* WHERE WE GOT TO. Written as the level OPENS, not as it is passed:
       a student who is halfway through this one and runs out of lesson has
       still reached it, and should be handed it again tomorrow rather than
       the one before it. */
    if(window.PROGRESS && PROGRESS.reach) PROGRESS.reach('school', idx);
    on=true; busy=false;

    G.running=false;
    if(document.pointerLockElement) document.exitPointerLock();
    if(window.PLANET && PLANET.active) PLANET.leave();
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.selected=null; G.focused=null;
    G.room='school'; G.hudOwner='mission'; G.missionId='school';
    G.scene.background=new THREE.Color(SKY);
    G.scene.fog=null;
    G.camera.near=0.3; G.camera.far=200; G.camera.updateProjectionMatrix();
    if(wasFP===null) wasFP=!!G.firstPerson;
    G.firstPerson=false;
    ['#mapwrap','#dash','#pmap','#health','#skill','#trigger'].forEach(q=>{
      const e=document.querySelector(q); if(e) e.classList.add('hidden'); });
    /* The crosshair box still said "Flight School — Motion · E — go in" from
       the console you were looking at a second ago, sitting over the middle
       of the board offering a key that does nothing here. focusScan only
       runs while G.running, which this mission turns off, so it would have
       sat there for the whole level. */
    const fx=document.querySelector('#focus');
    if(fx){ fx.classList.add('hidden'); fx.innerHTML=''; }
    G.focused=null; G.selected=null;

    group=new THREE.Group(); G.roomGroup.add(group);
    group.add(board());
    G.roomGroup.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key=new THREE.DirectionalLight(0xfff2e0, 0.9); key.position.set(4,14,6);
    G.roomGroup.add(key);

    const st=star(); st.position.set(px(K.goal.x), 0.03, pz(K.goal.y)); group.add(st);
    const rings=(K.via||[]).map(v=>{ const r=ring();
      r.position.set(px(v.x),0.03,pz(v.y)); group.add(r); return r; });

    ship=avatar(); group.add(ship);
    L={ idx, K, x:K.start.x, y:K.start.y, a:K.start.a, rings, hit:[] };
    lay(true);

    /* STRAIGHT DOWN ON IT. Every other mission in this game is played from
       inside; this one is played off a sheet of graph paper, and tilting
       the camera even a little makes reading a coordinate a job of
       perspective rather than of counting. */
    const span=2*H*CELL;
    /* UP IS -Z, NOT +Y. Looking straight down, the camera's up vector is
       parallel to the direction it is looking, which leaves three with no
       way to decide which way round the picture goes — the board came out
       with its x axis off the bottom of the screen. On a board read from
       directly above, screen-up is north, and north here is -z.

       And the whole thing sits a little high, because the brief prints
       across the bottom of the screen and the x axis is the one line a
       student has to read a number off. */
    /* and a little to the right of the board's centre, which pushes the board
       left on screen and out from under the brief in the top corner — the
       star at (4, 2) was landing on the panel's edge. */
    /* A four-quadrant board is twice the width of the first-quadrant one it
       replaces, so the camera comes in rather than the squares getting
       smaller — 1.15 spans puts the whole of it on screen with room for the
       brief, where 1.75 left it a postage stamp in the middle. */
    /* A four-quadrant board is twice the width of the first-quadrant one it
       replaces, so the camera comes in rather than the squares getting
       smaller. Two offsets, both earned by looking at it: to the RIGHT of
       centre, which pushes the board left and out from under the ten-row
       mission panel, and DOWN the board a little (+z is toward the bottom
       here), which lifts it clear of the console button sitting across the
       bottom edge. */
    const eyeX=CELL*1.15, eyeZ=CELL*0.30;
    G.camera.position.set(eyeX, span*1.32, eyeZ);
    G.camera.up.set(0,0,-1);
    G.camera.lookAt(eyeX, 0, eyeZ);

    /* setGrid takes the width of a CENTRED grid and keeps half of it — the
       flight's lanes run -1,0,1 — so it has to be handed twice this board
       plus one to mean "coordinates reach 4". Passing the board's own width
       gave a half-width of 1, and `change x by 4` was quietly clamped to 2:
       the first level of a mission about reading a coordinate, refusing to
       let you write the coordinate. */
    /* setGrid takes the width of a CENTRED grid and keeps half of it, and
       this board IS centred — so its own width is the right number and a
       coordinate reaches H either side of the origin. */
    CODE.setGrid(N, N);
    /* Quarter turns for the levels about facing, forty-fives for the one
       about angles — so a turn is a quarter until the moment the mission
       says an angle is just a number, and then it is any of them. */
    CODE.setPalette(K.pal); CODE.setBudget(K.budget); CODE.clear();
    if(CODE.hideTape) CODE.hideTape();   // the last level's run, still reading out
    // after setPalette, which resets it — see the note there
    if(CODE.setTurnStep) CODE.setTurnStep(K.turnStep || 90);
    /* The idea stays on the card; the worked example goes behind a button.
       This mission SETS a problem, and an answer printed beside the
       question is not a problem anybody solves twice. Every other mission
       leaves its guide as it was — the tutorial and the corridor are
       demonstrations, where copying the thing you are shown IS the
       exercise. One flag apart. */
    if(K.learn) CODE.setGuide(Object.assign({ hint:true }, K.learn));
    hud(); say(t(K.brief));
    // the walkthrough belongs to level one and follows nobody into level two
    if(window.COACH) COACH.stop();
    if(K.walk) coach();
  }

  function lay(snap){
    /* THE HEADING IS NOT NEGATED. Three.js turns +x toward -z as the angle
       grows — (1,0,0) becomes (cos a, 0, -sin a) — and on this board -z is
       up the screen, which is north. So a heading of 90 rendered with -a
       put the nose at +z, and +z is DOWN the screen: the ship faced south
       every time the mission said north, and the two turn directions came
       out backwards with it.

       Nothing about the maths was wrong — `turn 90` really was ninety
       degrees counterclockwise from east, judge() really did compare the
       right numbers, and the level was marked correct while the picture
       showed the opposite. That is what made it hard to see: only the
       drawing was mirrored. */
    const tx=px(L.x), tz=pz(L.y), ta=L.a*Math.PI/180;
    if(snap){ ship.position.set(tx,0.05,tz); ship.rotation.y=ta; }
    L.tx=tx; L.tz=tz; L.ta=ta;
  }

  /* ------------------------------------------------------- the walkthrough
     THE FIRST LEVEL IS WALKED, because a child who has never opened the
     console is not short of instructions — they are short of knowing that
     the instructions are about a thing they can click. So the thing they
     can click lights up, and nothing else is available while it does.

     COACH already does all of this for the flight: it rings the exact
     element, reads progress out of the world rather than out of what it
     just asked for, and hands each step back so the caller can narrow the
     palette to the one block being asked for. */
  /* NOT called walk(): the step runner below is also called walk(), and a
     second function declaration of the same name in the same scope quietly
     replaces the first. The level asked for its walkthrough and got the
     runner instead, with no arguments — which returns on its first line and
     throws nothing. */
  function coach(){
    if(!window.COACH) return;
    /* The console remembers whether you were last writing words or stacking
       blocks, and the walkthrough is written entirely in blocks — it points
       at a shelf that is not on the screen in typing mode. Somebody's first
       minute is not the place to inherit a preference they have never set. */
    if(window.CODE && CODE.setMode) CODE.setMode('blocks');
    const steps=[
      { say:'This is your ship, at the origin <b>(0, 0)</b>. The star is at <b>(4, 0)</b>. Press <b>C</b> to open the console.',
        find:()=>document.querySelector('#codeBtn'),
        done:()=>!!(window.CODE && CODE.isOpen()),
        pal:[], rails:{run:false, clear:false, mode:false} },
      { say:'Only <b>x</b> changed — 0 to 4. Click the glowing <b>change x by</b> block.',
        sel:'#conPalette [data-add="addX"]',
        done:()=>!!(window.CODE && CODE.script && CODE.script.length),
        pal:['addX'], rails:{run:false, clear:false, mode:false} },
      { say:'It says 1, and you need <b>4</b>. Click the number and type <b>4</b>.',
        sel:'#conScript .numin',
        done:()=>!!(window.CODE && CODE.script && CODE.script[0]
                    && CODE.script[0].n===4),
        pal:['addX'], rails:{run:false, clear:false, mode:false} },
      { say:'That is the whole program. Press <b>RUN</b>.',
        sel:'#conRun',
        done:()=>busy || (L && L.x===L.K.goal.x),
        pal:['addX'], rails:{run:true, clear:true, mode:true} }
    ];
    COACH.start(steps, {
      host: ()=> (window.CODE && CODE.coachHost) ? CODE.coachHost() : null,
      onStep(s){
        if(!window.CODE) return;
        if(!s){ CODE.setPalette(L?L.K.pal:['addX','addY']); CODE.setRails({}); return; }
        if(s.pal) CODE.setPalette(s.pal);
        CODE.setRails(s.rails||{});
      }
    });
  }

  /* ------------------------------------------------------------- run it */
  function run(){
    if(!on || busy) return;
    const steps=(window.CODE && CODE.script && CODE.script.length)
      ? CODE.compile(CODE.script) : [];
    if(!steps.length){ say(t('Write a program first — press <b>C</b>.')); return; }
    L.x=L.K.start.x; L.y=L.K.start.y; L.a=L.K.start.a; L.hit=[];
    L.rings.forEach(r=>r.material.color.setHex(0xcdb4f6));
    lay(true); busy=true;
    walk(steps, 0);
  }
  function walk(steps, at){
    if(!on || !busy) return;
    if(at>=steps.length) return judge();
    const s=steps[at];
    const go=(ms)=>move(()=>walk(steps, at+1), ms);
    if(s.name==='addX'){ L.x=clamp(L.x+(s.n|0)); lay(); return go(STEP_MS); }
    if(s.name==='addY'){ L.y=clamp(L.y+(s.n|0)); lay(); return go(STEP_MS); }
    /* The absolute pair. `change x by` is a step from here; `set x to` is a
       place, and on a board with an origin in the middle of it that is a
       different idea rather than a shorthand for the same one. */
    if(s.name==='setX'){ L.x=clamp(s.n|0); lay(); return go(STEP_MS); }
    if(s.name==='setY'){ L.y=clamp(s.n|0); lay(); return go(STEP_MS); }
    if(s.name==='glide'){ L.x=clamp(s.col|0); L.y=clamp(s.row|0); lay();
                          // the seconds on the block are the seconds it takes
                          return go(Math.max(1,(s.secs===undefined?1:s.secs))*GLIDE_MS); }
    if(s.name==='goTo'){ L.x=clamp(s.col|0); L.y=clamp(s.row|0); lay(true); return go(180); }

    /* ------------------------------------------------- heading and steps */
    /* The signed one, and the two arrows. Counterclockwise is positive here,
       so the clockwise arrow subtracts — the arrow carries the sign, which
       is what makes the pair easier to read than one number and a minus. */
    if(s.name==='turn'){  L.a=norm(L.a+(s.n|0)); lay(); return go(STEP_MS); }
    if(s.name==='turnL'){ L.a=norm(L.a+(s.n|0)); lay(); return go(STEP_MS); }
    if(s.name==='turnR'){ L.a=norm(L.a-(s.n|0)); lay(); return go(STEP_MS); }
    if(s.name==='point'){ L.a=norm(s.n|0); lay(); return go(STEP_MS); }
    /* Face the star from wherever you are. atan2 gives the angle
       counterclockwise from east, which is exactly what a heading is here,
       and it is snapped to the turn step so the answer is a heading the
       mission can actually be finished on. */
    if(s.name==='pointAt'){
      const st=(L.K.turnStep||90);
      const d=Math.atan2(L.K.goal.y-L.y, L.K.goal.x-L.x)*180/Math.PI;
      L.a=norm(Math.round(d/st)*st); lay(); return go(STEP_MS);
    }
    /* MOVE IS THE ONE BLOCK THAT READS THE HEADING. Everything else here is
       arithmetic on a coordinate and does not care which way the nose is
       pointing; without this, `turn` is a decoration you do at the end. On a
       lattice a step is the nearest whole square in that direction, so a
       heading of 45 walks the diagonal. */
    if(s.name==='move'){
      const r=L.a*Math.PI/180, n=s.n|0;
      L.x=clamp(L.x+Math.round(Math.cos(r))*n);
      L.y=clamp(L.y+Math.round(Math.sin(r))*n);
      lay(); return go(STEP_MS);
    }
    /* Somewhere on the board, and nobody gets to know where — which is the
       point of it: the block after this one has to work from anywhere. */
    if(s.name==='goRnd'){
      const pick=()=>Math.floor(Math.random()*(2*H+1))-H;
      let nx=L.x, ny=L.y, tries=0;
      while(nx===L.x && ny===L.y && tries++<20){ nx=pick(); ny=pick(); }
      L.x=nx; L.y=ny; lay(); return go(GLIDE_MS);
    }
    return walk(steps, at+1);
  }
  const clamp = v => Math.max(-H, Math.min(H, v));
  const norm  = d => ((d%360)+360)%360;

  function move(then, ms){
    const x0=ship.position.x, z0=ship.position.z, a0=ship.rotation.y;
    let da=L.ta-a0; da=Math.atan2(Math.sin(da),Math.cos(da));
    const t0=performance.now();
    anim={ tick(now){
      const k=Math.min(1,(now-t0)/ms), e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      ship.position.x=x0+(L.tx-x0)*e;
      ship.position.z=z0+(L.tz-z0)*e;
      ship.rotation.y=a0+da*e;
      /* A ring counts as touched while you are passing through it, not only
         where you stop — otherwise a course is a list of places to halt. */
      L.rings.forEach((r,i)=>{
        if(L.hit.indexOf(i)>=0) return;
        if(Math.hypot(ship.position.x-r.position.x, ship.position.z-r.position.z)<0.8){
          L.hit.push(i); r.material.color.setHex(0xa8e6cf);
          if(window.beep) beep('pop');
        }
      });
      if(k>=1){ anim=null; then(); }
    }};
  }

  function judge(){
    busy=false;
    const K=L.K, at=(L.x===K.goal.x && L.y===K.goal.y);
    const facing=(K.goal.face===undefined) || (norm(L.a)===norm(K.goal.face));
    const rings=(K.via||[]).length===L.hit.length;
    if(at && facing && rings){
      const last=L.idx>=LEVELS.length-1;
      say(last ? t('🏅 Flight school passed. Four quadrants, and every block in Motion.')
               : t('✅ On the star.'));
      if(last && window.PROGRESS) PROGRESS.complete('school');
      else nextT=setTimeout(()=>{ nextT=null; if(on) start(L.idx+1); }, 1500);
      return;
    }
    /* Say WHICH of the three it was. "Try again" on a board with a position,
       a heading and two rings on it is three different pieces of news. */
    if(!at) say('❌ '+t('You finished at ({x}, {y}). The star is at ({gx}, {gy}).',
                       {x:L.x, y:L.y, gx:K.goal.x, gy:K.goal.y}));
    else if(!rings) say('❌ '+t('You landed on the star, but missed a ring.'));
    else say('❌ '+t('Right place, wrong way round — you are facing {a}, not {b}.',
                     {a:t(COMPASS[norm(L.a)]||norm(L.a)+'°'),
                      b:t(COMPASS[norm(K.goal.face)]||norm(K.goal.face)+'°')}));
  }

  /* ---------------------------------------------------------- the HUD */
  function hud(){
    const nm=document.querySelector('#missionName');
    if(nm) nm.textContent=t('Level {n} — {name}',{n:L.idx+1, name:t(L.K.name)});
    const o=document.querySelector('#objList');
    if(o) o.innerHTML=LEVELS.map((s,i)=>
      `<li class="${i===L.idx?'cur':(i<L.idx?'done':'')}">${t(s.name)}</li>`).join('');
    const h=document.querySelector('#hud'); if(h) h.classList.remove('hidden');
    if(window.keyHint) keyHint(`<b>C</b> ${t('write your program')} &nbsp; <b>RUN</b> ${t('flies it')}`);
  }
  /* THE BRIEF SITS IN THE CORNER HERE, under the level list, rather than
     across the bottom of the screen where every other mission puts it. On a
     board you read by counting squares, a box in the middle of the screen is
     a box over the squares. */
  function say(msg){
    const b=document.querySelector('#briefing'); if(!b) return;
    b.classList.add('corner');
    /* Sits under the MISSION panel, and that panel is as tall as the list of
       levels in it — so the gap is measured rather than guessed. */
    const panel=document.querySelector('#objectives');
    if(panel){ const r=panel.getBoundingClientRect();
      if(r.height>0) b.style.setProperty('--brief-top', Math.round(r.bottom+12)+'px'); }
    b.classList.remove('hidden'); b.innerHTML=msg;
  }

  function tick(dt){
    if(!on) return;
    if(anim) anim.tick(performance.now());
    if(window.COACH && COACH.tick) COACH.tick(dt);
  }
  function stop(){
    clearTimeout(nextT); nextT=null;
    if(!on) return;
    on=false; busy=false; anim=null; L=null; group=null; ship=null;
    if(window.CODE){ CODE.close(); CODE.setGuide(null); CODE.setBudget(0); }
    const mw=document.querySelector('#mapwrap'); if(mw) mw.classList.remove('hidden');
    const bf=document.querySelector('#briefing'); if(bf) bf.classList.remove('corner');
    if(window.COACH) COACH.stop();
    if(wasFP!==null){ G.firstPerson=wasFP; wasFP=null; }
  }

  return { start, run, tick, update:tick, stop,
           get active(){ return on; },
           get busy(){ return busy; },
           get where(){ return L ? {x:L.x, y:L.y, a:norm(L.a)} : null; },
           retry(){ if(L) start(L.idx); },
           count: LEVELS.length, LEVELS };
})();
