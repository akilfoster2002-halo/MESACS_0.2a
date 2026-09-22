/* =====================================================================
   PONG — the whole game, out of the same blocks.

   The ring teaches one idea at a time against a robot that fights back.
   This is the other half of learning to program: a GAME, small enough to
   hold in your head and complete enough to actually play, built out of
   nothing but the blocks on the shelf.

   THREE OBJECTS AND NOTHING HIDDEN. A ball, the paddle you drive and the
   paddle that plays against you — and every one of them is an ordinary
   object with an ordinary script on it. Click any of the three and you
   are looking at the blocks that make it move. There is no engine
   underneath doing the interesting part: the ball moves because
   `move 3 steps` is in a `forever` loop, and it bounces because somebody
   wrote down what should happen when it touches a paddle.

   WHAT THE ROOM OWNS, and it is deliberately the boring half: the court,
   the camera, the score, and the serve. The referee decides that a ball
   which has gone past a paddle is a point and puts the next one on the
   centre spot — the same division the ring draws between a program that
   ASKS to punch and a referee that decides whether it landed. A student
   cannot set the score, and does not have to write the bit that is not
   about programming.

   ALWAYS THE TOP VIEW. Pong is a flat game and this room does not offer
   the choice the ring does, because there is no version of Pong that is
   better in three dimensions. From up here x runs across the screen and y
   runs up it, which are exactly the two letters in the blocks.

   NOTHING IS KEPT. Same as the ring: every entry is a fresh court and an
   empty script, so "try it and see" costs nothing.
   ===================================================================== */
window.PONG = (function(){
  const $ = s => document.querySelector(s);
  const T = s => (window.t ? t(s) : s);

  /* SHORT NAMES, because they are read inside blocks. `touching [Rival]?`
     and `y of [Ball]` are sentences; `touching [Right paddle]?` is a
     block that has run out of room. */
  const BALL='Ball', YOU='You', RIVAL='Rival';
  /* The court, in the LANGUAGE's axes — x across, y up the screen. */
  /* THE COURT, AND WHY THESE NUMBERS. The walls are at 6.5 and the
     walkthrough teaches the bounce as `y position > 6`, so the ball's
     CENTRE turns at 6 and its edge is at 6.4 with the wall drawn at 6.5.
     The number in the block is round, and the bounce looks like it
     happens where the wall is. Both of those matter more than either one
     of them being exact. */
  const COURT={ x:11, y:6 };
  /* THE FOUR NUMBERS THE GAME IS BALANCED ON, and they are only defaults:
     each one ends up in a block, and the whole point of the room is that
     a student can change any of them and watch what it does.

       SPEED        how far the ball travels each frame
       PADDLE.speed how fast your bat climbs — faster than the ball needs
                    to be, or you cannot reach a steep one
       RIVAL_SPEED  how fast the opponent climbs. SLOWER than the ball's
                    steepest rise, which is the only reason it can be
                    beaten at all; raise it and the game gets harder. */
  const PADDLE={ x:9.5, size:2.2, speed:0.4 };
  const SPEED=5;
  const RIVAL_SPEED=0.2;
  /* how many degrees a bat leans the ball per unit away from its middle */
  const LEAN_DEFAULT=20;
  /* HOW FAR A PADDLE REACHES, which is not the room's business any more
     but is still the number the drawing has to respect: `touching` in
     this language is a sphere of (a.size + b.size) * 0.6 around each
     centre, so a bat drawn much longer than that is a bat balls go
     through. See shapeThem(). */
  const REACH = (a,b) => ((a&&a.size||1) + (b&&b.size||1)) * 0.6;
  const BAT_REACH = REACH({size:0.8}, {size:PADDLE.size});

  let on=false, clicker=null;

  /* ------------------------------------------- the language's own axes
     THE ONE PLACE THIS ROOM KNOWS THE ENGINE IS Y-UP. Everything else
     here is written in x and y the way the blocks are, and these two turn
     that into the fields an actor actually carries. Read off BLOCKS.AXES
     rather than spelled out, so this room cannot drift from the language
     it is teaching. */
  const AX = k => (window.BLOCKS ? BLOCKS.AXES.find(a=>a.v===k) : null);
  const rd = (a,k)=>{ const x=AX(k); return (a&&x) ? x.sign*(+a[x.field]||0) : 0; };
  const wr = (a,k,v)=>{ const x=AX(k); if(a&&x) a[x.field]=x.sign*v; };
  const actor = n => (window.VM ? VM.actorByName(n) : null);

  /* ----------------------------------------------------- the palette
     Everything Pong is made of and nothing that would only confuse. The
     pairings that matter here:

       move  ↔  point in direction  ↔  direction
         The ball travels along a heading and bounces by changing it.
         Reflecting needs to READ the heading, so all three or none.

       touching?  ↔  y position
         The two ways the ball finds out it has hit something: a paddle
         it can touch, and a wall that is just a number.

       −  with  >  and  <
         The subtraction is the bounce itself — `180 − direction` is what
         a reflection IS — and the comparisons are how a wall is noticed.

     No variables, on purpose. A ball with a heading needs none, and the
     shortest honest Pong is a better first game than a correct one
     nobody finishes. */
  const PALETTE={
    cats:['events','control','motion','looks','sensing','ops','data'],
    ops:[
      'event.flag','event.key',
      'ctrl.wait','ctrl.repeat','ctrl.forever','ctrl.if','ctrl.ifelse','ctrl.stop',
      'motion.move','motion.turn','motion.face','motion.changeBy','motion.setTo',
      'motion.goto','motion.pos','motion.dir',
      'looks.say',
      'sense.key','sense.touch','sense.posOf',
      /* × is here because the angle a ball leaves a bat at is worked out
         from where on the bat it hit, and that is a multiplication. It is
         the one piece of arithmetic in the game that is really about the
         game. */
      'op.add','op.sub','op.mul','op.lt','op.eq','op.gt','op.and','op.or','op.not',
      /* AND THE SERVE IS RANDOM, which is one block and the difference
         between a game and a demonstration: a ball that leaves the centre
         spot at the same angle every time makes every point the same
         point, and the rival either always reaches it or never does. */
      'op.random',
      /* AND THE SCORE IS A VARIABLE, because the score has to live
         somewhere a program can change and the scoreboard can read. */
      'data.set','data.change','data.get'
    ]
  };
  /* WHAT A BLOCK ARRIVES SET TO, when somebody takes a new one off the
     shelf. The palette's own defaults are written for a language, not for
     this game: `move` arrives at 10, which is a whole square a frame and
     crosses the court in nineteen of them, and `change y by` arrives on
     the x axis, which walks a bat sideways into a wall. Neither is a
     detail — a block that lands behaving nothing like the ones already
     in the script is a change whose effect cannot be read. */
  const SET={
    'motion.move':     { n:SPEED },
    'motion.changeBy': { a:'y', n:PADDLE.speed },
    'motion.setTo':    { a:'y', n:0 },
    'motion.pos':      { a:'y' },
    'motion.goto':     { x:0, y:0, z:1 },
    'sense.posOf':     { a:'y', o:BALL },
    'sense.touch':     { o:BALL },
    'op.random':       { a:40, b:140 },
    'op.mul':          { b:LEAN_DEFAULT },
    'op.add':          { a:90 },
    'op.sub':          { a:180 },
    'op.gt':           { b:COURT.y },
    'op.lt':           { b:-COURT.y },
    'data.change':     { n:1 }
  };

  /* The two the scoreboard watches. Made on the way in rather than by the
     student: naming a variable is a different lesson, and a dropdown with
     nothing in it is a step nobody can complete. */
  const SCORE={ you:'you', rival:'rival' };

  /* ==================================================== the court */
  const GRID={ axis:0x6b5da8, major:0x40356a, minor:0x2b2446 };
  function grid(world, hx, hy){
    const pts=[], col=[], c=new THREE.Color();
    /* the grid is drawn in ENGINE space, so the language's y is walked
       through the same pair as everything else */
    const push=(x1,z1,x2,z2,hex)=>{
      c.setHex(hex);
      pts.push(x1,0.015,z1, x2,0.015,z2);
      col.push(c.r,c.g,c.b, c.r,c.g,c.b);
    };
    const shade = i => i===0 ? GRID.axis : (i%5===0 ? GRID.major : GRID.minor);
    for(let x=-hx;x<=hx;x++) push(x,-hy,x,hy, shade(x));
    for(let z=-hy;z<=hy;z++) push(-hx,z,hx,z, shade(z));
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts,3));
    g.setAttribute('color',    new THREE.Float32BufferAttribute(col,3));
    world.add(new THREE.LineSegments(g,
      new THREE.LineBasicMaterial({ vertexColors:true, transparent:true, opacity:0.8 })));
  }
  function build(){
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.ceiling=null; G.ground=()=>0;
    G.scene.background=new THREE.Color(0x0d0a18);
    G.scene.fog=null;
    const world=G.roomGroup;

    const floor=new THREE.Mesh(new THREE.BoxGeometry(COURT.x*2+2, 1, COURT.y*2+2),
      new THREE.MeshBasicMaterial({color:0x17122b}));
    floor.position.y=-0.5;
    world.add(floor);
    grid(world, COURT.x, COURT.y);

    /* THE LINES THAT MAKE IT A COURT. The two end lines are where a point
       happens and the centre line is where the serve comes from, so all
       three are things the game actually uses rather than decoration. */
    const bar=(x,z,w,d,hex,op)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,0.06,d),
        new THREE.MeshBasicMaterial({color:hex, transparent:true, opacity:op||1}));
      m.position.set(x,0.03,z); world.add(m); return m;
    };
    bar(0,0, 0.12, COURT.y*2, 0x5a4b91, 0.85);                  // the centre line
    bar(-COURT.x,0, 0.16, COURT.y*2, 0x8fd3ff, 0.55);           // your goal line
    bar( COURT.x,0, 0.16, COURT.y*2, 0xffb4a2, 0.55);           // theirs
    /* drawn a ball's radius outside the line, so a ball that turns at 6
       turns with its edge against the paint */
    bar(0,-COURT.y-0.4, COURT.x*2, 0.16, 0x6b5da8, 0.7);
    bar(0, COURT.y+0.4, COURT.x*2, 0.16, 0x6b5da8, 0.7);

    world.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key=new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(0, 40, 10); world.add(key);
  }

  /* ==================================================== the three
     PUT THERE THE WAY THE ROBOT AND THE DUMMY ARE, on every entry, with
     nothing on them. What a student writes is the whole of what they get
     back, and walking out is how you throw it away. */
  function cast(){
    const make=(name, shape, colour, lx, size)=>{
      let a=actor(name);
      if(!a) a=VM.addActor({ name, shape, colour, size });
      a.shape=shape; a.colour=colour; a.size=size;
      a.dir=0; a.tilt=0; a.roll=0; a.visible=true;
      wr(a,'x',lx); wr(a,'y',0); a.y=0.6;
      VM.build(a); VM.setHome(a);
      return a;
    };
    make(YOU,  'cube', '#8fd3ff', -PADDLE.x, PADDLE.size);
    make(RIVAL,'cube', '#ffb4a2',  PADDLE.x, PADDLE.size);
    make(BALL, 'ball', '#ffe9a8',  0,        0.8);
  }
  /* A CUBE IS NOT A PADDLE, so the mesh is stretched into one — but only
     as far as the hitbox can honestly follow.

     `touching` in this language is a SPHERE around each object's centre,
     sized from `size`. Stretch the picture much past that and the game
     starts lying: a ball that visibly hits the end of a long thin bat and
     sails through it is the most infuriating bug a Pong player can be
     handed, and the student cannot fix it because it is not in their
     script. So the paddle is drawn 0.8 x 2.8 around a sphere of reach
     2.05 — a little generous at the tips rather than short, because a
     game for children should be wrong in the forgiving direction. */
  const BAT_LONG = 1.27;                 // the stretch along the paddle
  function shapeThem(){
    const s=(a,x,y,z)=>{ if(a&&a.mesh) a.mesh.scale.set(x,y,z); };
    s(actor(YOU),   0.36, 0.5, BAT_LONG);
    s(actor(RIVAL), 0.36, 0.5, BAT_LONG);
  }

  /* ============================================ what the room does NOT do
     NOTHING. That is the point of this mission.

     There was a referee here. It kept the paddles on the court, noticed a
     ball that had gone past one, counted the score, put the next ball on
     the centre spot, and quietly let go of a paddle a ball had just
     bounced off. All of it was correct and all of it was invisible — and
     a student who opens the Ball, reads every block on it, and still
     cannot find the part that scores a point has not been shown the
     inside of a game. They have been shown the decorations on one.

     So it is all blocks now. The ball serves itself, notices the walls,
     puts itself back on the line, works out its own angle off a bat and
     counts its own points into two variables. The paddles keep
     themselves on the court. Every rule of Pong is on a shelf somewhere,
     and every one of them can be read, changed or broken.

     What is left in here is the stage: a floor, a camera, and a
     scoreboard that shows what the student's own variables say. None of
     those are the game. */
  function stage(){
    const ball=actor(BALL);
    shapeThem();
    /* The three of them stay on the floor. Height is the one axis Pong
       has no use for, and a ball that has been sent up the z axis by a
       stray block is a ball nobody can see — which is a confusing way to
       find out you typed the wrong letter. */
    [actor(YOU), actor(RIVAL), ball].forEach(a=>{ if(a && a.y!==0.6){ a.y=0.6; VM.sync(a); } });
  }

  /* ==================================================== the screen */
  /* THE SCOREBOARD IS A WINDOW ONTO TWO VARIABLES, and it is not allowed
     to be anything else. It does not count anything and cannot: it reads
     `you` and `rival` out of the project and puts them on the screen in
     big letters. Until the student writes the blocks that change them it
     shows nought each, which is the truth. */
  const scoreOf = k => { const v=(window.VM && VM.project.vars) ? VM.project.vars[SCORE[k]] : 0;
                         const n=parseFloat(v); return isFinite(n)?n:0; };
  function board(){
    const el=$('#pongScore'); if(!el) return;
    const a=scoreOf('you'), b=scoreOf('rival');
    el.innerHTML=
      `<span class="pg-you">${T('YOU')} <b>${a}</b></span>`+
      `<span class="pg-mid">${T('your two variables')}</span>`+
      `<span class="pg-them"><b>${b}</b> ${T('RIVAL')}</span>`;
    el.classList.remove('hidden');
  }
  function camera(){
    /* ALWAYS THE STAGE CAMERA. Orthographic, straight down, and not
       offered as a choice: under perspective two objects the same
       distance apart are different distances apart depending where they
       stand, and Pong is a game about exactly that judgement. */
    if(window.VM) G.camera=VM.stageCam(innerWidth/Math.max(1,innerHeight));
  }

  /* ------------------------------------------------- clicking a thing
     THE POINT OF THE WHOLE MISSION IS THAT ALL THREE ARE OPEN. So the
     court is clickable: click the ball and you are editing the ball.
     There is no crosshair up here — the camera is overhead and there is
     nobody to walk — so it is a plain mouse ray through the stage
     camera, against the same aim boxes the 3D rooms point at. */
  function pickAt(ev){
    if(!on || !window.VM || !G.camera) return;
    if(window.CODER && CODER.open) return;      // the editor has its own clicks
    const c=$('#view'); if(!c) return;
    const b=c.getBoundingClientRect();
    const ndc=new THREE.Vector2(
      ((ev.clientX-b.left)/b.width)*2-1, -((ev.clientY-b.top)/b.height)*2+1);
    const ray=new THREE.Raycaster();
    ray.setFromCamera(ndc, G.camera);
    const hit=ray.intersectObjects(G.hits||[], true)[0];
    const a=hit && hit.object.userData ? hit.object.userData.actor : null;
    if(!a) return;
    if(window.CODER){ CODER.setActor(a); CODER.show(); }
  }

  /* ==================================================== in and out */
  /* The same panels the ring puts away, and for the same reason: they
     belong to a body walking about a planet, and there is no body here. */
  const HIDE=['#mapwrap','#health','#skill','#trigger','#objectives',
              '#crosshair','#focus','#briefing','#escHint'];
  function start(){
    stop();
    on=true;

    G.running=true; G.hudOwner='pong'; G.missionId='pong'; G.room=null;
    if(window.updateLeaveBtn) updateLeaveBtn();
    if(window.MENU) MENU.hideAll();
    if(window.AVATAR) AVATAR.detach();
    G.firstPerson=false;
    if(window.GUN) GUN.carried(false);
    HIDE.forEach(s=>{ const e=$(s); if(e) e.classList.add('hidden'); });
    $('#pong').classList.remove('hidden');
    const ob=$('#pongOpen');
    if(ob){ ob.classList.remove('hidden'); ob.onclick=()=>{ if(window.CODER) CODER.toggle(); }; }

    build();
    /* NOTHING IS KEPT, the same as the ring and for the same reason. */
    VM.useScratch();
    VM.enter(G.roomGroup);
    VM.project.actors.slice().forEach(a=>VM.delActor(a));
    cast();
    given();
    camera();
    board();
    legend();
    if(window.CODER){
      /* WITH THE GAME'S OWN NUMBERS ON IT. A student adding a second
         `move` should get one that travels like the one already there,
         not the palette's 10 — a block that arrives wrong by a factor of
         two is a change whose effect nobody can read. */
      CODER.restrict(Object.assign({ defaults:SET }, PALETTE));
      /* OPEN ON THE BALL, which is where the game is. Two of the three
         objects are a dozen blocks about a bat; this one is the whole of
         Pong, and it is the one worth landing on. */
      CODER.setActor(actor(BALL));
    }
    clicker=pickAt;
    const view=$('#view'); if(view) view.addEventListener('pointerdown', clicker);
    if(window.keyHint) keyHint(`<b>C</b> ${T('open the blocks')} · <b>W</b>/<b>S</b> ${T('your paddle')}`);
  }
  /* ================================================ the game, written out
     THE WHOLE THING ARRIVES FINISHED, and that is the mission.

     There is no walkthrough here and nothing to build. Pong is already
     playing when you walk in: press Run and it serves, bounces, keeps
     score and stops when somebody has won. Then you click one of the
     three objects and read the blocks that just did all of that.

     Every rule is in here and none of them are anywhere else. The ball
     serves itself and counts its own points; the bats stop themselves at
     the edge of the court. Nothing in the room decides anything, so
     there is no part of this game that can be looked for and not found.

     Which makes the interesting question not "how do I build it" but
     "what happens if I change this" — and every number in it is a number
     somebody can change. Make the bat steeper, make the rival quicker,
     serve it faster, play first to three. */
  const B=(op,args,body)=>{ const b={ op, args:args||{} }; if(body) b.body=body; return b; };
  const IF=(cond,body)=>B('ctrl.if',{ c:cond }, body);
  const pos=k=>B('motion.pos',{ a:k });
  const yOf=name=>B('sense.posOf',{ a:'y', o:name });
  const centre=()=>B('motion.goto',{ x:0, y:0, z:1 });
  const serve=(lo,hi)=>B('motion.face',{ n:B('op.random',{ a:lo, b:hi }) });
  /* A BAT IS NOT A MIRROR, and this one expression is why the game has
     rallies that end. A mirror hands the ball back at the angle it
     arrived at, so a serve that crosses flat comes back flat for ever and
     neither bat is ever beaten. This sends it where you HIT it: 90 is
     straight across, and every unit away from the middle of the bat
     leans it another 20 degrees. Catch it on the end and it leaves
     steeply enough to beat somebody who is only following it.

     It is also the same answer on every frame the ball is touching, so
     unlike a mirror it never argues with itself. The walls, which really
     are mirrors, need a `set` first for exactly that reason. */
  const LEAN=LEAN_DEFAULT;
  const bat=(name, straight, sign)=>{
    const off=B('op.mul',{ a:B('op.sub',{ a:pos('y'), b:yOf(name) }), b:LEAN });
    return B('motion.face',{ n: sign>0 ? B('op.add',{ a:straight, b:off })
                                       : B('op.sub',{ a:straight, b:off }) });
  };
  const mirror=()=>B('motion.face',{ n:B('op.sub',{ a:180, b:B('motion.dir',{}) }) });
  /* the two blocks that keep a bat on the court, which used to be the
     room's job and were therefore nowhere a student could read them */
  const EDGE=COURT.y-1;
  const onCourt=()=>[
    IF(B('op.gt',{ a:pos('y'), b: EDGE }), [ B('motion.setTo',{ a:'y', n: EDGE }) ]),
    IF(B('op.lt',{ a:pos('y'), b:-EDGE }), [ B('motion.setTo',{ a:'y', n:-EDGE }) ])
  ];
  const onKey=(k,body)=>IF(B('sense.key',{ k }), body);
  const WIN=7;

  function scripts(){
    const out={};
    /* ------------------------------------------------ the bat you drive */
    out[YOU]=[{ hat:B('event.flag'), body:[
      B('motion.goto',{ x:-PADDLE.x, y:0, z:1 }),
      B('ctrl.forever',{},[
        onKey('w',[ B('motion.changeBy',{ a:'y', n: PADDLE.speed }) ]),
        onKey('s',[ B('motion.changeBy',{ a:'y', n:-PADDLE.speed }) ]),
        ...onCourt()
      ]) ]}];
    /* ------------------------------------------------- the one that plays
       Four blocks and it is an opponent: it asks where the ball is,
       compares that with where it is, and moves. It is beatable because
       it is SLOWER than the ball can be made to travel — which is the
       number to change if it is too easy. */
    out[RIVAL]=[{ hat:B('event.flag'), body:[
      B('motion.goto',{ x:PADDLE.x, y:0, z:1 }),
      B('ctrl.forever',{},[
        IF(B('op.gt',{ a:yOf(BALL), b:pos('y') }), [ B('motion.changeBy',{ a:'y', n: RIVAL_SPEED }) ]),
        IF(B('op.lt',{ a:yOf(BALL), b:pos('y') }), [ B('motion.changeBy',{ a:'y', n:-RIVAL_SPEED }) ]),
        ...onCourt()
      ]) ]}];
    /* ----------------------------------------------------------- the ball
       Everything Pong is: serve, travel, bounce off two bats and two
       walls, notice it has gone past somebody, score it, serve again, and
       stop when one of them has won. */
    out[BALL]=[{ hat:B('event.flag'), body:[
      B('data.set',{ v:SCORE.you,   n:0 }),
      B('data.set',{ v:SCORE.rival, n:0 }),
      centre(), serve(40,140),
      B('ctrl.forever',{},[
        B('motion.move',{ n:SPEED }),
        IF(B('sense.touch',{ o:YOU }),   [ bat(YOU,    90,  1) ]),
        IF(B('sense.touch',{ o:RIVAL }), [ bat(RIVAL, 270, -1) ]),
        IF(B('op.gt',{ a:pos('y'), b: COURT.y }),
           [ B('motion.setTo',{ a:'y', n: COURT.y }), mirror() ]),
        IF(B('op.lt',{ a:pos('y'), b:-COURT.y }),
           [ B('motion.setTo',{ a:'y', n:-COURT.y }), mirror() ]),
        IF(B('op.gt',{ a:pos('x'), b: COURT.x+1 }),
           [ B('data.change',{ v:SCORE.you,   n:1 }), centre(), serve(220,320) ]),
        IF(B('op.lt',{ a:pos('x'), b:-COURT.x-1 }),
           [ B('data.change',{ v:SCORE.rival, n:1 }), centre(), serve(40,140) ]),
        IF(B('op.gt',{ a:B('data.get',{ v:SCORE.you }),   b:WIN-1 }),
           [ B('looks.say',{ s:'YOU WIN' }), B('ctrl.stop',{ w:'all' }) ]),
        IF(B('op.gt',{ a:B('data.get',{ v:SCORE.rival }), b:WIN-1 }),
           [ B('looks.say',{ s:'RIVAL WINS' }), B('ctrl.stop',{ w:'all' }) ])
      ]) ]}];
    return out;
  }
  /* Put there the way the bats and the ball themselves are: on every
     entry, the same, and thrown away when you leave. A student who breaks
     it completely gets it back by walking out and walking back in. */
  function given(){
    const all=scripts();
    Object.keys(all).forEach(n=>{
      const a=actor(n);
      if(a) a.scripts=JSON.parse(JSON.stringify(all[n]));
    });
    if(window.VM){ VM.project.vars[SCORE.you]=0; VM.project.vars[SCORE.rival]=0; }
  }
  function legend(){
    const el=$('#pongAxes'); if(!el) return;
    const hex=h=>'#'+h.toString(16).padStart(6,'0');
    el.innerHTML=(window.BLOCKS?BLOCKS.AXES:[]).map(a=>
      `<div class="ring-ax"><i style="background:${hex(a.hue)}"></i>`+
      `<b>${a.v}</b>${T(a.flat||a.say)}</div>`).join('');
    el.classList.remove('hidden');
  }

  function tick(dt){
    if(!on) return;
    if(window.VM) VM.step(dt);
    stage();
    camera();
    if(window.CODER) CODER.tick(dt);
    const coding=!!(window.CODER && CODER.open);
    const mine=$('#pong');
    if(mine) mine.classList.toggle('hidden', coding);
    if(!coding) board();
  }

  function stop(){
    if(!on) return;
    on=false;
    if(window.CODER){
      if(CODER.open) CODER.hide();
      CODER.restrict(null);
    }
    if(window.VM){ VM.stopAll(); VM.leave(); }
    const view=$('#view');
    if(view && clicker) view.removeEventListener('pointerdown', clicker);
    clicker=null;
    $('#pong').classList.add('hidden');
    ['#pongScore','#pongOpen','#pongAxes'].forEach(s=>{
      const e=$(s); if(e) e.classList.add('hidden'); });
    G.hudOwner=null; G.missionId=null;
  }
  function leave(){
    stop();
    if(window.MENU) MENU.homeworld();
  }

  /* ============================================= no walkthrough, on purpose
     There was one, thirty-nine steps long, and it built the ball and the
     opponent a click at a time. It is gone, because the thing this room
     is for is not learning to assemble Pong — it is seeing what a working
     game is made of. A walkthrough puts a card over that and tells you
     which block to press next.

     So the game is finished when you arrive, and the only two things to
     do are the two that matter: play it, and open it. */
  return { start, stop, tick, leave, scripts,
           PALETTE, BALL, YOU, RIVAL, COURT, SCORE,
           get active(){ return on; },
           /* read out of the student's own variables, the same as the
              scoreboard — the walkthrough asks about the score and must
              not be told it by anything the room made up */
           get score(){ return { you:scoreOf('you'), rival:scoreOf('rival') }; } };
})();
