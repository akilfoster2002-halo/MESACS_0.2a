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
  const PADDLE={ x:9.5, size:2.2, speed:0.3 };
  const WIN=7;
  /* WHAT `touching` MEANS, borrowed from the VM rather than guessed at:
     it is a sphere of (a.size + b.size) * 0.6 around each centre. The
     room needs the same number to know when to let go of a ball it has
     just been hit by. */
  const REACH = (a,b) => ((a&&a.size||1) + (b&&b.size||1)) * 0.6;

  let on=false, you=0, rival=0, hold=0, lastSide=1, clicker=null;

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
    cats:['events','control','motion','looks','sensing','ops'],
    ops:[
      'event.flag','event.key',
      'ctrl.wait','ctrl.repeat','ctrl.forever','ctrl.if','ctrl.ifelse','ctrl.stop',
      'motion.move','motion.turn','motion.face','motion.changeBy','motion.setTo',
      'motion.goto','motion.pos','motion.dir',
      'looks.say',
      'sense.key','sense.touch','sense.posOf',
      'op.add','op.sub','op.lt','op.eq','op.gt','op.and','op.or','op.not'
    ]
  };

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
  function shapeThem(){
    const s=(a,x,y,z)=>{ if(a&&a.mesh) a.mesh.scale.set(x,y,z); };
    s(actor(YOU),   0.36, 0.5, 1.27);
    s(actor(RIVAL), 0.36, 0.5, 1.27);
  }

  /* ==================================================== the referee
     WHAT A SCRIPT MAY NOT DO. The score is not a variable a program can
     set, the serve is not something a program has to remember, and the
     walls of the court are not something a paddle should have to check
     for itself. All three are the room's, for the same reason health is
     the ring's: a game where your own program says whether you scored is
     not a game. */
  function referee(dt){
    const ball=actor(BALL), me=actor(YOU), them=actor(RIVAL);
    shapeThem();

    /* the paddles stay on their own line, and on the court */
    [[me,-PADDLE.x],[them,PADDLE.x]].forEach(([p,x])=>{
      if(!p) return;
      wr(p,'x',x);
      const lim=COURT.y-0.6;
      const y=rd(p,'y');
      if(y> lim) wr(p,'y', lim);
      if(y<-lim) wr(p,'y',-lim);
      p.y=0.6;
      VM.sync(p);
    });
    if(!ball) return;
    ball.y=0.6;

    /* HELD, BRIEFLY, AFTER A POINT. A ball that reappears already moving
       is a ball nobody saw arrive, and the player who just conceded is
       the one least ready for it. */
    if(hold>0){
      hold-=dt;
      wr(ball,'x',0); wr(ball,'y',0);
      VM.sync(ball);
      if(hold<=0) launch();
      return;
    }
    /* `out` is the way OFF that paddle and into the court: away from the
       left one is +x, away from the right one is -x. */
    clearOf(ball, me, 1);
    clearOf(ball, them, -1);
    clearWall(ball);

    const bx=rd(ball,'x');
    if(bx >  COURT.x+0.6) point(1);
    if(bx < -COURT.x-0.6) point(-1);
    /* AND IT CANNOT LEAVE SIDEWAYS. The walls are the student's to bounce
       off, but a ball that has got past them is a ball nobody can reach
       and a game that has quietly ended — so the court keeps it in even
       when the script has not learnt to yet. */
    const lim=COURT.y+0.5, by=rd(ball,'y');
    if(by> lim) wr(ball,'y', lim);
    if(by<-lim) wr(ball,'y',-lim);
    VM.sync(ball);
  }
  /* LETTING GO OF A PADDLE IT HAS ALREADY BOUNCED OFF.

     A bounce written the natural way — `point in direction (0 −
     direction)` — is correct and, on its own, sticks. The ball is inside
     the paddle's reach for several frames at any sane speed, so it
     mirrors its heading on every one of them: out, back, out, back, and
     it sits there shivering against the bat. Every child who has written
     Pong has met this, and the usual cures are worse than the disease —
     a `wait` that freezes the ball, or a `move 20` that teleports it.

     Two objects not being allowed to occupy the same space is the room's
     job, not the program's, the same as the walls and the score. So once
     the ball is heading AWAY from a paddle it is still touching, the
     court sets it down just clear. It only ever helps a ball that has
     already turned: one still heading into the paddle is left alone, so a
     student who has not written the bounce yet watches it sail straight
     through and concede, which is the honest answer to not having written
     it. */
  function clearOf(ball, pad, out){
    if(!ball || !pad) return;
    const r=REACH(ball,pad);
    const dx=rd(ball,'x')-rd(pad,'x'), dy=rd(ball,'y')-rd(pad,'y');
    if(Math.hypot(dx,dy) >= r) return;
    /* which way is it going? dir is a compass bearing, so the step across
       the court is its sine. */
    const goingOut = Math.sin(ball.dir*Math.PI/180) * out > 0;
    if(!goingOut) return;
    wr(ball,'x', rd(pad,'x') + out*Math.sqrt(Math.max(0.01, r*r - dy*dy)));

    /* WHERE ON THE BAT IT HIT, which is the difference between Pong and
       watching Pong.

       A pure mirror — which is what the student wrote, and is right —
       returns the ball at the angle it arrived at, every time. Against an
       opponent that simply follows the ball, that is a rally which never
       ends: the rival is never asked to travel further than the ball
       does, so it is never beaten, and a game you cannot win is a demo.

       So the court does what a real bat does and the blocks cannot: the
       further from the middle you strike it, the steeper it leaves. Now
       the way to win is to reach the ball EARLY and catch it on the end
       of your paddle, which is a thing to get good at. It is the room's
       to own for the same reason the walls are — it is what the surface
       is shaped like, not what the program decided. */
    /* WHICH WAY "UP" IS, IN BEARINGS. dir is a compass angle: 90 sends
       the ball across the court to the right, and 180 sends it up the
       screen. So a ball leaving to the RIGHT is steered upwards by
       raising its bearing, and one leaving to the LEFT by lowering it —
       which is exactly `out`, the direction it is leaving in. */
    const lean = Math.max(-1, Math.min(1, dy/r)) * 26;
    ball.dir = ball.dir + out*lean;
  }
  /* AND THE SAME FOR THE WALLS, which stick for exactly the same reason.

     `if (y position) > 6 then point in direction (180 − direction)` is
     right, and on its own it shivers: the ball crosses the line, turns,
     and is still past the line on the next frame — so it turns back, and
     again, and sits vibrating along the top of the court. The paddles got
     a let-go; the walls need one too, and it is the same rule. Once the
     ball is heading back towards the middle, the court puts it on the
     line rather than past it, and the student's own condition goes quiet
     by itself. */
  function clearWall(ball){
    const y=rd(ball,'y');
    if(Math.abs(y) <= COURT.y) return;
    /* the step up the screen is minus the cosine of a compass bearing */
    const vy = -Math.cos(ball.dir*Math.PI/180);
    const goingIn = y>0 ? vy<0 : vy>0;
    if(!goingIn) return;
    wr(ball,'y', y>0 ? COURT.y : -COURT.y);
  }
  function point(side){
    if(side>0) you++; else rival++;
    lastSide=side;
    hold = over() ? Infinity : 0.9;
    board();
  }
  const over = () => you>=WIN || rival>=WIN;
  /* SERVED TOWARDS WHOEVER JUST CONCEDED, at an angle rather than flat,
     because a ball travelling exactly along x never meets a wall and the
     bounce a student just wrote would never run. */
  function launch(){
    const ball=actor(BALL); if(!ball) return;
    wr(ball,'x',0); wr(ball,'y',0);
    /* dir is a compass bearing: 90 is across the screen to the right. The
       serve leans up or down by a quarter turn's worth, alternately. */
    const towards = lastSide>0 ? 90 : -90;
    ball.dir = towards + (Math.random()<0.5 ? -32 : 32);
    VM.sync(ball);
  }

  /* ==================================================== the screen */
  function board(){
    const el=$('#pongScore'); if(!el) return;
    const done = over();
    el.classList.toggle('pg-over', done);
    el.innerHTML=
      `<span class="pg-you">${T('YOU')} <b>${you}</b></span>`+
      `<span class="pg-mid">${done
        ? (you>rival?T('YOU WIN'):T('RIVAL WINS'))+' \u00b7 '+T('press Run to play again')
        : T('first to')+' '+WIN}</span>`+
      `<span class="pg-them"><b>${rival}</b> ${T('RIVAL')}</span>`;
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
    on=true; you=0; rival=0; hold=1.2; lastSide=1;

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
      CODER.restrict(PALETTE);
      /* OPEN ON THE RIVAL, which looks arbitrary and is not. COACH stands
         past the LAST step that has already happened, and a step that says
         "click the Ball" is satisfied the instant the Ball is the thing
         being edited — so whichever object this room selects on the way
         in, it skips that object's step. The rival is the one nothing asks
         for until the very end, and its own step waits on the ball being
         finished, so nothing is skipped. */
      CODER.setActor(actor(RIVAL));
    }
    clicker=pickAt;
    const view=$('#view'); if(view) view.addEventListener('pointerdown', clicker);
    if(window.keyHint) keyHint(`<b>C</b> ${T('open the blocks')} · <b>W</b>/<b>S</b> ${T('your paddle')}`);
    walk();
  }
  /* WHAT THE MISSION HANDS YOU, and why it is only one of the three.

     The paddle you drive is a conditional inside a loop watching a key —
     which is the whole of the ring's first mission, and a student who
     arrives here has already built it once. Marching them through it a
     second time would teach nothing and cost ten steps.

     So it arrives written, and the walkthrough opens by asking them to
     CLICK IT AND READ IT. That is not filler: the thing this mission is
     really about is that every object on the screen is made of blocks you
     can open, and the fastest way to say so is to hand somebody a working
     object and let them look inside it.

     The ball and the rival are theirs to write, because those are the two
     ideas that are new here — a thing that moves along a heading and
     bounces, and a thing that watches another object. */
  const B=(op,args,body)=>{ const b={ op, args:args||{} }; if(body) b.body=body; return b; };
  const onKey=(k,body)=>B('ctrl.if',{ c:B('sense.key',{k}) }, body);
  function given(){
    const me=actor(YOU);
    if(me) me.scripts=[{ id:'given', hat:B('event.flag'), body:[
      B('ctrl.forever',{},[
        onKey('w',[ B('motion.changeBy',{a:'y',n: PADDLE.speed}) ]),
        onKey('s',[ B('motion.changeBy',{a:'y',n:-PADDLE.speed}) ])
      ]) ]}];
    const them=actor(RIVAL); if(them) them.scripts=[];
    const ball=actor(BALL);  if(ball)  ball.scripts=[];
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
    referee(dt);
    camera();
    if(window.COACH) COACH.tick(dt);
    if(window.CODER) CODER.tick(dt);
    const coding=!!(window.CODER && CODER.open);
    const mine=$('#pong');
    if(mine) mine.classList.toggle('hidden', coding);
    if(!coding) board();
  }

  function stop(){
    if(!on) return;
    on=false;
    if(window.COACH) COACH.stop();
    if(window.CODER){
      CODER.walking(false);
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

  /* ==================================================== the walkthrough */
  function ctx(){
    return {
      get ball(){ return actor(BALL); },
      get you(){ return actor(YOU); },
      get rival(){ return actor(RIVAL); },
      get actor(){ return null; },        // no beacon: this room is flat
      get score(){ return { you, rival }; },
      host: ()=> (window.CODER && CODER.open) ? CODER.coachHost() : null,
      finish: T('That is a whole game, and every part of it is yours to change.'),
      onStep: onStep
    };
  }
  let seenCats=[], ranOnce=false;
  function walk(){
    if(!window.COACH || !window.PONGSTEPS) return;
    seenCats=[]; ranOnce=false;
    COACH.stop();
    COACH.start(PONGSTEPS.steps(), ctx());
  }
  /* Run opens the whole shelf, exactly as it does in the ring: showing
     one block at a time is how somebody is shown where a block is, not
     how they are kept there. */
  function openShelf(){
    if(ranOnce) return;
    ranOnce=true;
    /* THE WHOLE SHELF, BUT KEEP THE NUMBERS. `narrow(null)` means no
       restriction — and it also throws away the starting values the
       steps hand their blocks, which in this room is half the lesson:
       `move` arriving set to 10 is a ball that crosses the court in
       nineteen frames, and `change y by` arriving on x is a paddle that
       walks into the wall. A spec with no cats and no ops restricts
       nothing and carries them. */
    if(window.CODER)
      CODER.narrow({ defaults:(window.PONGSTEPS||{}).SET });
  }
  function onStep(s){
    if(!window.CODER) return;
    CODER.walking(!!s);
    if(!s){
      seenCats=[];
      if(!ranOnce) CODER.narrow(PALETTE);
      return;
    }
    /* see the comment on run() in pongsteps.js */
    if(s.stopFirst && window.VM && VM.running) VM.stopAll();
    if(s.pal && !ranOnce){
      (s.pal.cats||[]).forEach(c=>{ if(seenCats.indexOf(c)<0) seenCats.push(c); });
      CODER.narrow({ cats:seenCats.slice(), ops:s.pal.ops||[] });
    }
    if(s.tab) CODER.openCat(s.tab);
  }
  let seenRun=-1;
  function watchRun(){
    if(!window.VM) return;
    if(VM.running && seenRun!==VM.runId){
      seenRun=VM.runId;
      openShelf();
      /* PRESSING RUN AFTER A FINISHED GAME STARTS A NEW ONE. Run is
         already the button that means "go", and a second button that
         only appears once in a while is a button nobody finds. */
      if(over()){ you=0; rival=0; hold=1.0; board(); }
    }
  }

  return { start, stop, tick:(dt)=>{ tick(dt); watchRun(); }, leave,
           PALETTE, BALL, YOU, RIVAL, COURT, WIN,
           get active(){ return on; },
           get score(){ return { you, rival }; } };
})();
