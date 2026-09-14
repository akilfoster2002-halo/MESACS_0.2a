/* =====================================================================
   THE SWARM — Space Invaders with the arrow of authorship turned round.

   In the arcade game you are the last ship and the army is the weather.
   Here you ARE the army, and you never touch it: you write one program,
   and every invader in the formation flies it at once. That single
   inversion is what makes this a loops mission rather than a shooter,
   because the moment one program drives a hundred bodies, the interesting
   question stops being "where do I move" and becomes "how many, and how
   long for" — which are the two questions `repeat` and `forever` answer.

   THE LADDER IS THE LESSON, one slide at a time:

     rank    repeat (N)          eight invaders is two blocks or it is
                                 sixteen. The budget makes the choice for
                                 you, which is the teacher's line about
                                 ten blocks versus one, made mechanical.
     grid    a loop in a loop    a rank is a loop; four ranks is that loop
                                 inside another one. Nothing else in this
                                 course nests, and a grid is the shape
                                 where nesting is the obvious move rather
                                 than a clever one.
     march   forever             the fortress is further than the board is
                                 wide and there is no sensor yet, so there
                                 is no N to count to. A loop that cannot
                                 be counted is the definition of this one.
     shield  repeat until        now there IS a sensor, and now stopping
                                 matters: keep descending after the shield
                                 falls and the swarm flies into the wreck.
                                 forever wins the last stage and loses this
                                 one, which is the whole of "the difference
                                 is how they stop".
     listen  if inside forever   the golden rule, as a boss. An `if` above
                                 the loop asks once, at the start, from the
                                 wrong side of the board, and the swarm
                                 sails over the fortress for ever without
                                 firing a shot. Put the same block one
                                 level in and it asks every pass.

   WHY THE SHIELD REGROWS. It is the rule the drone boss in Mission 1
   already fights by, and it is here for the same reason: it makes the
   loop NECESSARY rather than tidy. A shield that only ever goes down can
   be worn away by a long enough straight-line program, and then every
   loop in this file is a convenience a stubborn student can refuse. A
   shield that grows back faster than any program you are allowed to write
   cannot. It also makes the lesson's second whiteboard bug real: a
   `repeat until the shield is down` whose body never fires is a loop whose
   condition nothing inside it can change, and down here that does not
   hang the tab — it just marches, visibly, for ever, until you notice.

   DAMAGE IS DECIDED WHEN THE BLOCK RUNS, not when the bolt lands. The
   falling bolts are drawn for the look of the thing; the arithmetic
   happens at the instant `fire()` steps, so what the shield number says
   and what the program has done are never a frame apart. A student
   stepping their own code should never have to hold "and two more are
   still in the air" in their head.
   ===================================================================== */
window.INVADERS = (function(){

  const COLS=11, ROWS=9;          // the board, in tiles
  const T=3.0;                    // world units per tile
  const STEP_MS=240;              // one action block
  const BOLT_MS=260;              // how long a bolt is drawn falling
  /* How many passes of a loop count as "this is not going anywhere". About
     twenty seconds of watching at one action a beat, which is long enough to
     believe the program is working and short enough to still care why it is
     not. */
  const PATIENCE=45;
  const SKY=0x05060f;

  /* Where the spawn cursor starts. Column 1 rather than 0 so that a rank
     built left to right has somewhere to be before it runs out of board. */
  const X0=1, Y0=0;

  /* ------------------------------------------------------------ stages
     A stage is the palette it hands out, the fortress it puts up, and
     what counts as done. Everything else is the same engine. */
  const STAGES=[
    /* ONE RANK. The budget is two, and eight invaders need eight spawns,
       so the only program that fits is the one with a loop in it. This is
       the whole of slide two and it is deliberately the first thing that
       happens: the lesson is not "a loop is neater", it is "a loop is the
       only version of this that you are allowed to write". */
    { id:'rank', name:'One Rank', budget:2,
      pal:['spawn','repeat'],
      autoVolley:true,
      fort:{ c0:1, c1:9, shield:8, regrow:3 },
      /* POINTED AT, NOT EXPLAINED. COACH rings the real button and the rails
         narrow the shelf to the one block being asked for, so the words only
         have to NAME the move — the screen already says where.

         The "click the loop" step is not padding. Taking a repeat off the
         shelf does not put you INSIDE it; the next block lands under the
         loop instead of in it, which is the single most common way a first
         program comes out wrong. So it is a step, with the loop itself lit
         up and an empty shelf, because there is nothing else to do here. */
      walk:[
        { say:'Eight invaders. You have <b>two blocks</b>.', sel:'#conPalette [data-add="repeat"]',
          done:()=>has('repeat') },
        { say:'Make it <b>8</b>.', sel:'#conScript .cnt[data-act="inc"]',
          done:()=>count('repeat')===8 },
        { say:'Click the loop to get <b>inside</b> it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || inside('repeat','spawn') },
        { say:'', sel:'#conPalette [data-add="spawn"]',
          done:()=>inside('repeat','spawn') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'Eight invaders, two blocks',
              text:'Both put eight on the board. Only one of them changes by editing a single number.',
              code:'repeat 8\n  spawn()\nend' },
      brief:'Shield <b>8</b>, and it grows back. You need <b>eight invaders</b> — in <b>2 blocks</b>.',
      /* Eight bolts against a shield of eight, and the regrow never gets a
         turn because the breach is checked before it. Seven invaders lose. */
      need:{ alive:8 } },

    /* THE GRID. A rank was one loop; four ranks is that same loop with
       another one round it. The fortress is thick enough that no single
       rank can break it, which is what makes the second loop the answer
       rather than a bigger number in the first. */
    { id:'grid', name:'The Grid', budget:4,
      pal:['spawn','nextRow','repeat'],
      autoVolley:true,
      fort:{ c0:1, c1:9, shield:30, regrow:7 },
      walk:[
        { say:'A rank was one loop. Four ranks is <b>two</b>.', sel:'#conPalette [data-add="repeat"]',
          done:()=>has('repeat') },
        { say:'<b>4</b> — one per rank.', sel:'#conScript .cnt[data-act="inc"]',
          done:()=>count('repeat')===4 },
        { say:'Get <b>inside</b> it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || depth()>=2 },
        { say:'The rank you already know — <b>inside</b> this one.', sel:'#conPalette [data-add="repeat"]',
          done:()=>depth()>=2 },
        { say:'<b>8</b> across.', find:()=>inner('.cnt[data-act="inc"]'),
          done:()=>depth()>=2 && innerCount()===8 },
        { say:'Inside the <b>inner</b> one now.', sel:'#conScript .blk.rep .blk.rep > .blk-head',
          done:()=>target('inner') || deep('spawn') },
        { say:'', sel:'#conPalette [data-add="spawn"]',
          done:()=>deep('spawn') },
        /* "Back out" is only back out once there is something to be out OF.
           Testing the drop target alone made this step true the moment you
           first clicked INTO the outer loop, five steps earlier — and COACH
           stands past the last step that is already true, so the whole inner
           rank got skipped and the walkthrough built a grid with no rank in
           it. A step that can be true before its own turn is not a step. */
        { say:'Click it again to step back <b>out</b>.', sel:'#conScript .blk.rep .blk.rep > .blk-head',
          done:()=>inside('repeat','nextRow') || (deep('spawn') && target('outer')) },
        { say:'Drop a row, then round again.', sel:'#conPalette [data-add="nextRow"]',
          done:()=>inside('repeat','nextRow') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'A loop inside a loop',
              text:'The inside loop builds a rank. The outside one does it four times.',
              code:'repeat 4\n  repeat 8\n    spawn()\n  end\n  nextRow()\nend' },
      brief:'Shield <b>30</b>, <b>+7</b> a volley. One rank cannot dent it. Build <b>four</b>.',
      need:{ alive:32 } },

    /* THE MARCH. The fortress is off the right-hand edge of the board, so
       there is no number to count to — not because the number is hidden
       but because the swarm is pushed back whenever it stops advancing,
       and a program that ends stops advancing. The only loop that outlasts
       that is the one with no end on it. */
    { id:'march', name:'The Long March', budget:3,
      pal:['across','volley','forever','repeat'],
      army:{ cols:8, rows:3 },
      fort:{ c0:7, c1:9, shield:26, regrow:4, far:true },
      walk:[
        { say:'No number reaches it. This loop has none.', sel:'#conPalette [data-add="forever"]',
          done:()=>has('forever') },
        { say:'Get <b>inside</b> it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || inside('forever','across') },
        { say:'', sel:'#conPalette [data-add="across"]',
          done:()=>inside('forever','across') },
        { say:'', sel:'#conPalette [data-add="volley"]',
          done:()=>inside('forever','volley') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'A loop you cannot count',
              text:'No number to count to. <b>forever</b> runs until the mission ends.',
              code:'forever\n  across()\n  fire()\nend' },
      brief:'The fortress is <b>off the board</b>. A program that ends stops advancing.',
      need:{ fort:true } },

    /* THE SHIELD. The same fight, plus a sensor and a reason to stop.
       Descending is how you get the volleys close enough to bite, and
       descending after the shield is gone flies the swarm into the wreck —
       so forever, which won the last stage, loses this one. */
    { id:'shield', name:'Break the Shield', budget:4,
      pal:['volley','descend','until','repeat'],
      army:{ cols:8, rows:2 },
      fort:{ c0:1, c1:9, shield:44, regrow:5 },
      conds:['the shield is down','over the fortress','at the edge'],
      /* THE TWO THINGS THAT MAKE THIS STAGE ABOUT STOPPING.

         landAfter: breaking the shield does not end the stage. If it did,
         forever and repeat-until would be the same program here — both
         breach on the same volley and both get frozen at the moment they
         do, which is the opposite of the thing being taught. The fortress
         is taken when your program LETS GO with the shield down, so the
         loop that cannot let go cannot win.

         returnFire: while the shield is up they shoot back, one invader a
         volley. It is what stops the answer being a number somebody worked
         out on paper: fewer invaders is less damage next volley, so the
         count compounds rather than dividing, and asking is very much
         easier than arithmetic. It is also why overshooting costs
         something even before the wreck does. */
      landAfter:true, returnFire:1,
      walk:[
        { say:'This one <b>stops</b>. That is the difference.', sel:'#conPalette [data-add="until"]',
          done:()=>has('until') },
        { say:'Get <b>inside</b> it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || inside('until','volley') },
        { say:'', sel:'#conPalette [data-add="volley"]',
          done:()=>inside('until','volley') },
        { say:'Closer bites harder.', sel:'#conPalette [data-add="descend"]',
          done:()=>inside('until','descend') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'A loop that knows when to stop',
              text:'<b>forever</b> never stops — and here that flies the swarm into the wreck.',
              code:'repeat until the shield is down\n  fire()\n  down()\nend' },
      brief:'Closer volleys bite harder. But <b>stop</b> the moment the shield falls.',
      need:{ fort:true } },

    /* THE LISTENER. The golden rule, and the only stage where WHERE you
       put a block matters more than which block it is. `across` walks the
       formation to the wall and turns it round by itself, so the swarm
       sweeps back and forth over the fortress on its own; the only thing
       the program has to get right is asking, every single pass, whether
       it is over the target yet. */
    { id:'listen', name:'The Listener', budget:5,
      pal:['across','volley','forever','ifc'],
      army:{ cols:4, rows:2 },
      fort:{ c0:4, c1:6, shield:30, regrow:3, narrow:true },
      conds:['over the fortress','at the edge','the shield is down'],
      walk:[
        { say:'', sel:'#conPalette [data-add="forever"]',
          done:()=>has('forever') },
        { say:'Get <b>inside</b> it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || inside('forever','across') },
        { say:'It sweeps and turns by itself.', sel:'#conPalette [data-add="across"]',
          done:()=>inside('forever','across') },
        { say:'Ask <b>inside</b> the loop, not above it.', sel:'#conPalette [data-add="ifc"]',
          done:()=>inside('forever','ifc') },
        { say:'Now inside the <b>if</b>.', sel:'#conScript .blk.rep .blk.rep > .blk-head',
          done:()=>target('if') || deep('volley') },
        { say:'', sel:'#conPalette [data-add="volley"]',
          done:()=>deep('volley') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'A question worth asking twice goes inside the loop',
              text:'Above the loop it is asked once. <b>Inside</b>, it is asked every pass.',
              code:'forever\n  across()\n  if over the fortress\n    fire()\n  end\nend' },
      brief:'Fortress in the <b>middle</b>. <b>across()</b> turns at the walls by itself.',
      need:{ fort:true } }
  ];

  /* ------------------------------------------- what the walkthrough reads
     Every step above says how it knows it has happened, and all of them ask
     the SCRIPT rather than remembering what was just clicked. A student who
     builds the whole program before the coach has finished pointing at the
     first block is not walked through anything twice — COACH skips to the
     last step that is already true, and these are what it asks. */
  const SCR = () => (window.CODE && CODE.script) ? CODE.script : [];
  function each(list, fn, d){
    d=d||0;
    (list||[]).forEach(b=>{ fn(b,d); if(b.body) each(b.body, fn, d+1); });
  }
  function has(type){ let f=false; each(SCR(), b=>{ if(b.type===type) f=true; }); return f; }
  function firstOf(type){ let r=null; each(SCR(), b=>{ if(!r && b.type===type) r=b; }); return r; }
  /* the number on the OUTERMOST repeat, which is the one a step is asking for */
  function count(type){ const b=firstOf(type); return b ? b.count : 0; }
  /* the number on the DEEPEST one, for the rank inside the grid */
  /* THE NUMBER ON A REPEAT THAT IS ACTUALLY INSIDE ANOTHER ONE — and the
     "actually" is the whole fix. This used to return the deepest repeat's
     count whatever its depth, so with a single loop on the page it answered
     with THAT loop: a student who put 8 into the first repeat instead of 4
     satisfied the step that waits for the inner rank, and the coach jumped
     four ahead to "inside the inner one now" when there was no inner one and
     one block on the page. A step that can come true before its own turn is
     not a step. */
  function innerCount(){
    let best=null;
    each(SCR(), (b,d)=>{ if(b.type==='repeat' && d>0 && (!best || d>best.d)) best={b,d}; });
    return best ? best.b.count : 0;
  }
  function inside(outer, op){
    let f=false;
    each(SCR(), b=>{ if(b.type===outer && (b.body||[]).some(x=>x.type===op)) f=true; });
    return f;
  }
  /* two containers down: spawn in the inner rank, fire in the if */
  function deep(op){ let f=false; each(SCR(), (b,d)=>{ if(b.type===op && d>=2) f=true; }); return f; }
  function depth(){ return window.PROGRAM ? PROGRAM.depthOf(SCR()) : 0; }
  /* The innermost C-block on screen — where the next block would land. Read
     off the DOM because "which loop is open" is the console's state, not the
     program's. */
  function inner(sub){
    const all=[...document.querySelectorAll('#conScript .blk.rep')];
    const el=all[all.length-1];
    return el ? (sub ? el.querySelector(sub) : el) : null;
  }
  function target(kind){
    const el=document.querySelector('#conScript .blk.rep.target');
    if(!el) return false;
    const all=[...document.querySelectorAll('#conScript .blk.rep')];
    if(kind==='outer') return all[0]===el;
    if(kind==='inner') return all[all.length-1]===el && all.length>1;
    if(kind==='if')    return /^if\b/.test(el.textContent.trim());
    return true;
  }

  /* ------------------------------------------------------------- state */
  let on=false, busy=false, L=null, group=null, wasFP=null, nextT=null;
  let bolts=[], stars=null, boom=[];
  const CONDS_DEFAULT=['the shield is down','over the fortress','at the edge'];

  /* tile → world. Row 0 is the top of the board, which is where a swarm
     starts and is also how the stage data reads on the page. */
  const wx = c => (c-(COLS-1)/2)*T;
  const wy = r => (ROWS-1-r)*T + 2.0;

  /* ------------------------------------------------------------- build */
  function invaderMesh(tint){
    /* Three boxes. At this size an invader is a silhouette and nothing
       else, so the budget goes on the shape reading clearly from the
       front rather than on any detail you would have to lean in for. */
    const g=new THREE.Group();
    const body=new THREE.MeshLambertMaterial({color:tint});
    const eye =new THREE.MeshLambertMaterial({color:0x05060f});
    const hull=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.0,1.0), body);
    g.add(hull);
    [-0.45,0.45].forEach(x=>{
      const e=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.3), eye);
      e.position.set(x,0.12,0.52); g.add(e);
    });
    // the two legs that make it read as an invader rather than a brick
    [-0.62,0.62].forEach(x=>{
      const lgm=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.55,0.3), body);
      lgm.position.set(x,-0.72,0); g.add(lgm);
    });
    return g;
  }

  function fortMesh(f){
    const g=new THREE.Group();
    const w=(f.c1-f.c0+1)*T;
    const stone=new THREE.MeshLambertMaterial({color:0x6b4a5e});
    const base=new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, 2.2), stone);
    base.position.y=-0.2; g.add(base);
    // battlements, so the thing you are shooting at has a top edge
    for(let x=-w/2+0.9; x<=w/2-0.9; x+=1.8){
      const m=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.9,2.2), stone);
      m.position.set(x, 1.55, 0); g.add(m);
    }
    /* THE SHIELD IS THE READOUT, AND IT IS COUNTED RATHER THAN SHADED.

       It began as one translucent pane whose opacity was the shield number,
       and at a quarter strength that is a faint smear you cannot read and
       cannot compare to the faint smear it was a volley ago. The boss of
       Mission 1 has an eight-part shield for the same reason: SEGMENTS CAN
       BE COUNTED. A student who can see three blocks go out and two come
       back has watched the regrow happen, and watching the regrow happen is
       the entire argument for writing a loop. */
    const segs=[];
    const SEG=12, gap=0.14, sw=(w - gap*(SEG-1))/SEG;
    for(let i=0;i<SEG;i++){
      const m=new THREE.Mesh(new THREE.BoxGeometry(sw, 0.62, 0.4),
        new THREE.MeshBasicMaterial({color:0x8fd3ff}));
      m.position.set(-w/2 + sw/2 + i*(sw+gap), 2.7, 1.3);
      g.add(m); segs.push(m);
    }
    g.userData.segs=segs;
    return g;
  }

  function starfield(){
    const N=900, p=new Float32Array(N*3);
    for(let i=0;i<N;i++){
      p[i*3  ]=(Math.random()-0.5)*240;
      p[i*3+1]=(Math.random()-0.5)*160;
      p[i*3+2]=-40-Math.random()*160;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p,3));
    return new THREE.Points(g, new THREE.PointsMaterial({color:0xbfd0ff, size:0.5}));
  }

  /* ------------------------------------------------------------ the army */
  function addInvader(c, r){
    if(c<0 || c>=COLS || r<0 || r>=ROWS) return null;
    if(L.inv.some(v=>v.alive && v.c===c && v.r===r)) return null;   // one to a tile
    const m=invaderMesh(L.K.tint||0xa8e6cf);
    m.position.set(wx(c), wy(r), 0);
    group.add(m);
    const v={ c, r, mesh:m, alive:true };
    L.inv.push(v);
    L.idle=0;                          // somebody new is progress
    return v;
  }
  const live = () => L.inv.filter(v=>v.alive);

  /* Where the formation is, as a box. across() and the edge test are both
     about the whole swarm rather than any one invader in it. */
  function span(){
    const a=live();
    if(!a.length) return null;
    return { c0:Math.min(...a.map(v=>v.c)), c1:Math.max(...a.map(v=>v.c)),
             r0:Math.min(...a.map(v=>v.r)), r1:Math.max(...a.map(v=>v.r)) };
  }

  function place(){
    const a=live();
    a.forEach(v=>{ v.mesh.position.set(wx(v.c), wy(v.r), 0); });
  }

  /* ------------------------------------------------------------ actions */
  function doSpawn(){
    if(L.cur.c>=COLS){ return; }          // off the right-hand edge: nothing to do
    addInvader(L.cur.c, L.cur.r);
    L.cur.c++;
  }
  function doNextRow(){ L.cur.c=X0; L.cur.r++; }

  /* ACROSS TURNS ITSELF ROUND AT THE WALL. That is the arcade behaviour and
     it is also what makes the last stage about the `if` rather than about
     steering: the sweep is free, so the only thing left to get right is
     when to fire. */
  function doAcross(){
    const s=span(); if(!s) return;
    if(L.K.fort.far){
      /* The march stage has no wall to turn at — the fortress is off the
         board to the right, and the swarm is walking towards it. */
      L.travel++;
      return;
    }
    if((L.dir>0 && s.c1>=COLS-1) || (L.dir<0 && s.c0<=0)) L.dir=-L.dir;
    live().forEach(v=>{ v.c+=L.dir; });
    place();
  }
  function doDescend(){
    live().forEach(v=>{ v.r++; });
    place();
  }

  /* FIRE. Every invader alive drops one bolt straight down, and a bolt
     counts if the fortress is under the column it fell in. Bolts from
     closer in hit harder, which is what makes descending worth the risk in
     the shield stage — and is the only place in this file where a number
     depends on where the swarm is standing. */
  function doVolley(){
    const a=live(); if(!a.length) return;
    const f=L.fort;
    let dmg=0;
    a.forEach(v=>{
      const hits = L.K.fort.far ? (L.travel>=L.needTravel) : (v.c>=f.c0 && v.c<=f.c1);
      drawBolt(v, hits);
      if(!hits) return;
      /* One damage, plus one more for each row of the gap you have closed,
         capped so that a swarm sitting on top of the fortress is worth
         three bolts rather than nine. */
      const gap=Math.max(0, f.r - v.r);
      dmg += 1 + Math.min(2, Math.max(0, 4-gap));
    });
    if(!dmg) return;
    L.idle=0;                          // and so is a shield that moved
    f.shield -= dmg;
    L.fired++;
    if(f.shield<=0){ f.shield=0; return; }    // breached before it can grow
    f.shield=Math.min(f.max, f.shield + f.regrow);
    /* They shoot back, and it is the front rank that pays — the invaders
       nearest the guns. Only while the shield is up: a wreck does not
       return fire, so the cost of a wasted volley after the breach is the
       wreck itself rather than another one of yours. */
    if(L.K.returnFire){
      const a2=live();
      for(let k=0;k<L.K.returnFire && a2.length;k++){
        let worst=a2[0];
        a2.forEach(v=>{ if(v.r>worst.r) worst=v; });
        worst.alive=false; group.remove(worst.mesh);
        a2.splice(a2.indexOf(worst),1);
      }
    }
  }

  function drawBolt(v, hits){
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.9,0.18),
      new THREE.MeshBasicMaterial({color:hits?0xffb4a2:0x5a6b85}));
    m.position.set(wx(v.c), wy(v.r)-0.9, 0);
    group.add(m);
    bolts.push({ mesh:m, t:0, x:wx(v.c), y0:wy(v.r)-0.9,
                 y1: L.K.fort.far ? -6 : wy(L.fort.r)+1.4 });
  }

  /* --------------------------------------------------------- the sensors
     Three questions, and every one of them is about the whole swarm. The
     student is not flying an invader, so a test about one of them would be
     a test about nothing they can see. */
  function test(cond){
    if(!cond || !L) return false;            // forever compiles to a test of nothing
    const f=L.fort, s=span();
    if(cond==='the shield is down') return f.shield<=0;
    if(cond==='over the fortress'){
      if(L.K.fort.far) return L.travel>=L.needTravel;
      return !!s && live().some(v=>v.c>=f.c0 && v.c<=f.c1);
    }
    if(cond==='at the edge') return !!s && (s.c0<=0 || s.c1>=COLS-1);
    return false;
  }

  /* ------------------------------------------------------------- start */
  function start(n){
    clearTimeout(nextT); nextT=null;
    const idx=Math.max(0, Math.min(STAGES.length-1, n||0));
    const K=STAGES[idx];
    if(window.PROGRESS && PROGRESS.reach) PROGRESS.reach('inv', idx);
    on=true; busy=false;

    G.running=false;
    if(document.pointerLockElement) document.exitPointerLock();
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.selected=null; G.focused=null;
    G.room='inv'; G.hudOwner='mission'; G.missionId='inv';
    G.scene.background=new THREE.Color(SKY);
    G.scene.fog=null;
    G.camera.near=0.3; G.camera.far=600; G.camera.updateProjectionMatrix();
    if(wasFP===null) wasFP=!!G.firstPerson;
    G.firstPerson=false;
    if(window.PLANET && PLANET.active) PLANET.leave();
    /* EVERYTHING THAT BELONGS TO A BODY GOES AWAY. This is a board you look
       at from outside it — there is nobody standing here, so a crosshair in
       the middle of the sky and a blaster in the corner are furniture from a
       different game. The gun hides itself off G.firstPerson, but only when
       something asks it to, and the frame loop hands straight over to this
       mission before it ever does. */
    ['#mapwrap','#dash','#pmap','#crosshair','#focus','#health','#skill','#trigger']
      .forEach(q=>{ const e=document.querySelector(q); if(e) e.classList.add('hidden'); });
    G.focused=null; G.selected=null;
    if(window.GUN) GUN.carried(false);

    group=new THREE.Group(); G.roomGroup.add(group);
    bolts=[]; boom=[];
    stars=starfield(); G.roomGroup.add(stars);
    G.roomGroup.add(new THREE.AmbientLight(0x9fb6ff, 0.55));
    const key=new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(4,18,14); G.roomGroup.add(key);

    const f=Object.assign({ r:ROWS-1 }, K.fort);
    f.max=f.shield;
    L={ idx, K, inv:[], cur:{c:X0, r:Y0}, dir:1, fort:f,
        travel:0, needTravel:12, fired:0,
        pc:0, steps:[], wait:0, guard:0, idle:0, over:false, lost:false, won:false };

    const fm=fortMesh(f);
    /* The far fortress is drawn off the right of the board, small, so that
       "it is out past the edge" is something you can see rather than
       something the briefing claims. */
    if(f.far) fm.position.set(wx(COLS-1)+T*4.5, wy(f.r), -14);
    else fm.position.set((wx(f.c0)+wx(f.c1))/2, wy(f.r), 0);
    group.add(fm);
    L.fortMesh=fm;

    // the stages that do not build their own army are handed one
    if(K.army) for(let r=0;r<K.army.rows;r++)
      for(let c=0;c<K.army.cols;c++) addInvader(X0+c, Y0+r);

    camera();
    CODE.setGrid(COLS, ROWS);
    CODE.setConditions(K.conds||CONDS_DEFAULT, { lead:'if', until:'repeat until' });
    CODE.setPalette(K.pal); CODE.setBudget(K.budget); CODE.clear();
    if(K.learn) CODE.setGuide(K.learn);
    hud(); say(t(K.brief));
    /* A NEW STAGE IS WALKED, AND ONLY EVER ONCE. Every level here introduces
       a loop the one before it did not have, and being handed a palette with
       a block you have never seen on it is not an introduction. So the first
       time a stage opens, the console opens with it and the coach points at
       the blocks in the order they go together — and the moment it has been
       walked, that is remembered against the save, so coming back to a level
       you have already done hands you the palette and gets out of the way. */
    /* THE FILM FIRST, THEN THE WALKTHROUGH. Once ever, and only on the way
       into the first stage: a student who already knows what this is does not
       want ten seconds of being told again. */
    const seenFilm = !!(window.PROGRESS && PROGRESS.get && PROGRESS.get('inv_film'));
    const walkIt = ()=>{ if(K.walk && window.COACH && !taught(K.id)) teach(K); };
    if(idx===0 && !seenFilm && !film) startFilm(walkIt);
    else walkIt();
  }

  /* ------------------------------------------------------------- the film
     TEN SECONDS OF THE GAME PLAYING ITSELF, once, the first time anybody
     opens the mission. Space Explorer has one and it is the reason a student
     knows what that mission WANTS before they have pressed anything — a
     briefing tells you the rules and a film tells you the point.

     It is not a cutscene shot somewhere else. Every frame of it is the real
     board doing the real thing: the fortress is the fortress, the invaders
     are spawned by the same spawn() the student is about to write, and the
     shield is the shield. A film made of the actual game cannot drift from
     the game, and there is nothing in it a player is about to find out was
     only a picture.

     The letterbox, the caption and the SKIP button are the ones intro.js
     already owns, so the two films look like the same film. */
  const FILM=[
    { at:0.0, cap:'A fortress, and a shield that grows back faster than one shot can chip it.' },
    { at:2.8, cap:'You are not the ship. You are the swarm — and the whole swarm flies one program.' },
    { at:5.6, cap:'So eight invaders is not eight blocks. It is a loop.' },
    { at:8.4, cap:'Write the army. Break the fortress.' }
  ];
  const FILM_END=11.4;
  let film=null;

  function filmScreen(){
    let el=document.querySelector('#intro');
    if(!el){ el=document.createElement('div'); el.id='intro'; document.body.appendChild(el); }
    el.className='';
    el.innerHTML=
      '<div class="in-bar top"></div><div class="in-bar bottom"></div>'+
      '<div class="in-cap" id="inCap"></div>'+
      '<div class="in-title" id="inTitle">'+t('THE SWARM')+'</div>'+
      '<button class="in-skip" id="inSkip">'+t('SKIP ▶')+'</button>';
    el.querySelector('#inSkip').onclick=()=>endFilm();
    return el;
  }
  function startFilm(then){
    film={ t:0, shot:-1, then, built:0 };
    const el=filmScreen();
    setTimeout(()=>{ const ti=el.querySelector('#inTitle'); if(ti) ti.classList.add('in-show'); }, 60);
    if(window.CODE) CODE.close();
    const b=document.querySelector('#briefing'); if(b) b.classList.add('hidden');
  }
  function endFilm(){
    const was=film; film=null;
    const el=document.querySelector('#intro'); if(el) el.remove();
    const b=document.querySelector('#briefing'); if(b) b.classList.remove('hidden');
    if(window.PROGRESS && PROGRESS.set) PROGRESS.set('inv_film', 1);
    if(was && was.then) was.then();
  }
  /* The film's own clock. It spawns a rank the way the student will, marches
     it, fires, and lets the fortress go — on the real board, so what they
     watch is what they are about to build. */
  function filmTick(dt){
    film.t+=dt;
    const el=document.querySelector('#intro');
    let i=-1;
    for(let j=0;j<FILM.length;j++) if(film.t>=FILM[j].at) i=j;
    if(i>=0 && i!==film.shot){
      film.shot=i;
      const cap=el && el.querySelector('#inCap');
      if(cap){ cap.textContent=t(FILM[i].cap); cap.classList.remove('in-show');
               void cap.offsetWidth; cap.classList.add('in-show'); }
      const ti=el && el.querySelector('#inTitle');
      if(ti && i>0) ti.classList.remove('in-show');
    }
    // the rank builds itself across the second caption
    if(film.t>2.8 && film.built<8 && film.t > 2.8 + film.built*0.30){
      doSpawn(); film.built++;
    }
    // and fires on the third
    if(film.t>6.4 && !film.fired){ film.fired=true; doVolley(); hud(); }
    if(film.t>7.4 && !film.broke){
      film.broke=true;
      L.fort.shield=0; blowUp(); hud();
    }
    if(film.t>=FILM_END) endFilm();
  }

  const TKEY = id => 'inv_walk_'+id;
  const taught = id => !!(window.PROGRESS && PROGRESS.get && PROGRESS.get(TKEY(id)));
  function teach(K){
    /* The console remembers whether you were last typing or stacking, and a
       walkthrough written in blocks points at a shelf that is not on screen
       in typing mode. */
    if(CODE.setMode) CODE.setMode('blocks');
    CODE.show();
    COACH.start(K.walk, {
      host: ()=> (window.CODE && CODE.coachHost) ? CODE.coachHost() : null,
      /* THE WHOLE SHELF STAYS OUT. An earlier version narrowed the palette to
         the one block each step was asking for, on the theory that the ringed
         button should also be the only button. In front of a child it read as
         the game being broken: you look down at BLOCKS and the column is
         EMPTY, on a screen whose entire job is offering you blocks. The coach
         rings what to press next; it does not need to take everything else
         away to do it, and a student who wants to get ahead of it should be
         able to. */
      onStep(s){
        if(!window.CODE) return;
        CODE.setPalette(K.pal);
        CODE.setRails({});
        if(!s && window.PROGRESS && PROGRESS.set) PROGRESS.set(TKEY(K.id), 1);
      }
    });
  }

  /* A board is looked at, not stood in. Straight on and a little above, far
     enough back that the whole formation and the fortress are in frame at
     once — you are writing a program about the shape of the thing, so the
     shape has to be on screen all the time. */
  function camera(){
    G.camera.up.set(0,1,0);
    G.camera.position.set(0, wy(ROWS/2)+2, 44);
    G.camera.lookAt(0, wy(ROWS/2)-1, 0);
  }

  /* --------------------------------------------------------------- run */
  function run(){
    if(!on || busy) return;
    const steps=(window.CODE && CODE.script && CODE.script.length)
      ? CODE.compile(CODE.script) : [];
    if(!steps.length){ say(t('Write a program first — press <b>C</b>.')); return; }

    // a fresh run is a fresh board: the formation, the shield and the cursor
    live().forEach(v=>{ group.remove(v.mesh); });
    L.inv=[]; L.cur={c:X0, r:Y0}; L.dir=1; L.travel=0; L.fired=0;
    L.fort.shield=L.fort.max;
    bolts.forEach(b=>group.remove(b.mesh)); bolts=[];
    /* A fortress you already blew up has to be standing again before the
       next run, or pressing RUN on a stage you have just beaten plays it
       against an invisible one. The last stage is where this shows: it does
       not advance on its own, so RUN is the obvious next thing to press. */
    boom.forEach(p=>group.remove(p.mesh)); boom=[];
    if(L.fortMesh) L.fortMesh.visible=true;
    if(L.K.army) for(let r=0;r<L.K.army.rows;r++)
      for(let c=0;c<L.K.army.cols;c++) addInvader(X0+c, Y0+r);

    busy=true;
    L.pc=0; L.steps=steps; L.wait=0; L.guard=0; L.idle=0;
    L.over=false; L.lost=false; L.won=false;
    say(t('The swarm has its orders.'));
  }

  /* ------------------------------------------------------------- frame */
  function tick(dt){
    if(!on) return;
    dt=Math.min(dt, 0.05);
    if(film){ filmTick(dt); flyBolts(dt); shine(); return; }
    // the walkthrough runs off the same frame as the mission it belongs to
    if(window.COACH) COACH.tick(dt);
    if(stars) stars.rotation.z += dt*0.006;
    flyBolts(dt);
    shine();
    if(!busy) return;

    /* WIN AND LOSE ARE CHECKED BEFORE THE NEXT BLOCK, so the last thing
       that happened is the thing the message is about — and LOSING IS
       CHECKED FIRST, because a swarm that flew into the fortress on the
       same beat it broke the shield did not win. */
    const breached = L.fort.shield<=0;
    const s=span();
    /* A WRECK IS AS SOLID AS A FORTRESS. Checked whether or not the shield
       is down, which is the whole of the shield stage: the loop that never
       stops keeps descending after it has already won and flies into what
       it just broke. */
    if(s && !L.K.fort.far && s.r1>=L.fort.r)
      return finish(false, breached
        ? t('The shield was down — and the swarm kept descending into the wreck.')
        : t('The swarm flew into the fortress.'));
    /* Only a stage that was HANDED an army can lose one. The build stages
       open with an empty board on purpose — filling it is the exercise — so
       "there is nobody left" is a sentence about the stages that started
       with somebody. */
    if(L.K.army && !live().length && !L.won)
      return finish(false, t('The swarm is gone.'));
    /* On most stages the breach IS the win. On a stage about stopping it is
       not: the fortress is taken when your program lets go with the shield
       down, and a loop with no way out never lets go. */
    if(breached && !L.K.landAfter) return finish(true);

    L.wait-=dt*1000;
    if(L.wait>0) return;
    L.wait=STEP_MS;

    for(let n=0;n<128;n++){
      if(L.pc>=L.steps.length) return programEnded();
      const st=L.steps[L.pc];
      /* Control blocks cost no time — a loop that spent a beat on its own
         bookkeeping would make a program with a loop in it visibly slower
         than the same program written out, which is the opposite of the
         thing being taught. */
      if(st.name==='__until'){ L.pc = test(st.cond) ? st.jump : L.pc+1; continue; }
      if(st.name==='__loop'){
        L.pc=st.back;
        /* A LOOP THAT IS GOING ROUND AND CHANGING NOTHING is the shape of
           both bugs in the lesson: an `if` left above the `forever` never
           fires, and a `repeat until` whose body cannot move its own test
           never comes out. Neither is a crash, and neither will stop on its
           own — so what catches them is progress rather than time. If the
           shield has not moved and nobody new has appeared in this many
           passes, the swarm is not losing, it is doing nothing, and saying
           so is worth more than letting a child watch it for a minute.

           The big count below is the backstop that keeps an empty forever
           from locking the tab; this is the one that teaches. */
        if(++L.idle>PATIENCE){ L.over=true; return stuck(L.steps[st.back]); }
        if(++L.guard>20000){ L.over=true; return stuck(L.steps[st.back]); }
        continue;
      }
      if(st.name==='__if'){ L.pc = test(st.cond) ? L.pc+1 : st.jump; continue; }
      if(st.name==='__iter' || st.name==='__call'){ L.pc++; continue; }

      if(st.name==='spawn')       doSpawn();
      else if(st.name==='nextRow')doNextRow();
      else if(st.name==='across') doAcross();
      else if(st.name==='descend')doDescend();
      else if(st.name==='volley') doVolley();
      L.pc++;
      hud();
      return;                     // one action block a beat
    }
  }

  /* THE PROGRAM RAN OUT. What happens next is the difference between the
     build stages and the march ones, and it is the lesson in both:

       building   the rank you finished opens fire, and whether it breaks
                  the shield is a question about how many of them there are
       marching   nothing keeps the swarm going, so it loses ground — which
                  is why a program with an end on it cannot win that stage */
  function programEnded(){
    /* LETTING GO IS THE WIN on a stage about stopping. The loop got out, the
       shield is down and the swarm is still flying — which is the sentence
       `repeat until` writes and `forever` cannot. */
    if(L.K.landAfter && L.fort.shield<=0) return finish(true);
    if(L.K.autoVolley && !L.fired){
      doVolley(); hud();
      if(L.fort.shield<=0) return finish(true);
      const n=live().length;
      return finish(false, t('{n} invaders is not enough — the shield grew back.',{n}));
    }
    if(L.K.fort.far && L.travel>0){
      L.travel=Math.max(0, L.travel-3);
      hud();
    }
    L.over=true;
    return finish(false, t('Your program ended. The fortress did not.'));
  }

  /* BOTH WHITEBOARD BUGS COME OUT HERE, and they are not the same bug, so
     they must not get the same sentence. The loop that trapped us says
     which one it is: a `repeat until` has a test that nothing inside it can
     make true, and a `forever` has no test at all — its problem is that the
     block which was supposed to do the work is sitting outside it, being
     asked once. Neither is a crash. Both are programs that are still
     running, and in both cases the useful thing to hand back is the
     question a teacher would ask next. */
  function stuck(loop){
    finish(false, (loop && loop.cond)
      ? t('That loop is still going round. Nothing inside it changes <b>{c}</b> — what would have to happen for that to come true?',
          { c:t(loop.cond) })
      : t('The swarm has gone round and round and nothing has changed. Is the block that was meant to do something <b>inside</b> the loop?'));
  }

  function finish(ok, why){
    busy=false;
    if(ok){
      L.won=true;
      blowUp();
      const last=L.idx>=STAGES.length-1;
      say(last ? t('🏅 The fortress is down. Counted, watched and never-ending — all three loops.')
               : t('✅ The fortress is down.'));
      if(last && window.PROGRESS) PROGRESS.complete('inv');
      else nextT=setTimeout(()=>{ nextT=null; if(on) start(L.idx+1); }, 1900);
    } else {
      L.lost=true;
      say('💥 '+(why||t('That did not break it.'))+' '+t('Press <b>C</b> and try again.'));
    }
    hud();
  }

  /* ------------------------------------------------------------ effects */
  function flyBolts(dt){
    for(let i=bolts.length-1;i>=0;i--){
      const b=bolts[i];
      b.t += dt*1000;
      const k=Math.min(1, b.t/BOLT_MS);
      b.mesh.position.y = b.y0 + (b.y1-b.y0)*k;
      if(k>=1){ group.remove(b.mesh); bolts.splice(i,1); }
    }
    for(let i=boom.length-1;i>=0;i--){
      const p=boom[i];
      p.t+=dt;
      p.mesh.position.addScaledVector(p.v, dt*14);
      p.mesh.material.opacity=Math.max(0, 1-p.t/1.1);
      if(p.t>1.1){ group.remove(p.mesh); boom.splice(i,1); }
    }
  }
  /* How many segments are still lit, and what colour the lit ones are. The
     colour is the same three-step the HP bars use elsewhere, so "it has gone
     red" means here what it means everywhere else in this game. A shield
     with anything at all left keeps ONE segment lit: rounding the last
     sliver down would put the fortress at zero bars while it is still
     standing, which reads as a bug rather than as nearly-won. */
  function shine(){
    if(!L || !L.fortMesh) return;
    const segs=L.fortMesh.userData.segs; if(!segs) return;
    const k=L.fort.max ? Math.max(0, L.fort.shield/L.fort.max) : 0;
    const lit=L.fort.shield>0 ? Math.max(1, Math.ceil(k*segs.length)) : 0;
    const on_=k>0.55 ? 0x8fd3ff : k>0.25 ? 0xffd8a8 : 0xff9aa2;
    segs.forEach((m,i)=>{
      const live_=i<lit;
      m.material.color.setHex(live_ ? on_ : 0x241d38);
      m.scale.y = live_ ? 1 : 0.35;        // a spent segment sinks as well as dims
    });
  }
  function blowUp(){
    if(!L || !L.fortMesh) return;
    for(let i=0;i<40;i++){
      const m=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5),
        new THREE.MeshBasicMaterial({color:i%2?0xffd8a8:0xff9aa2, transparent:true}));
      m.position.copy(L.fortMesh.position);
      group.add(m);
      boom.push({ mesh:m, t:0, v:new THREE.Vector3(
        (Math.random()-0.5)*2, Math.random()*1.4, (Math.random()-0.5)*2).normalize() });
    }
    L.fortMesh.visible=false;
  }

  /* --------------------------------------------------------------- HUD */
  function hud(){
    const nm=document.querySelector('#missionName');
    if(nm && L) nm.textContent=t('Swarm {n} — {name}',{n:L.idx+1, name:t(L.K.name)});
    const o=document.querySelector('#objList');
    if(o && L){
      const f=L.fort;
      o.innerHTML=
        `<li class="cur">🛡️ ${t('Shield')}: <b>${f.shield}</b> / ${f.max}`
        + (f.shield>0 && f.regrow ? ` <small>(+${f.regrow} ${t('a volley')})</small>` : '')
        + `</li>`
        + `<li>👾 ${t('Swarm')}: <b>${live().length}</b>`
        + (L.K.need && L.K.need.alive ? ` / ${L.K.need.alive} ${t('needed')}` : '')
        + `</li>`
        + STAGES.map((s,i)=>
            `<li class="${i===L.idx?'cur':(i<L.idx?'done':'')}">${t(s.name)}</li>`).join('');
    }
    const h=document.querySelector('#hud'); if(h) h.classList.remove('hidden');
    if(window.keyHint) keyHint(`<b>C</b> ${t('write your program')} &nbsp; <b>RUN</b> ${t('launches the swarm')}`);
  }
  function say(msg){
    const b=document.querySelector('#briefing'); if(!b) return;
    b.classList.remove('hidden'); b.innerHTML=msg;
  }

  function stop(){
    clearTimeout(nextT); nextT=null;
    const mw=document.querySelector('#mapwrap'); if(mw) mw.classList.remove('hidden');
    // give the body back whatever it walks around with
    ['#crosshair','#focus'].forEach(q=>{
      const e=document.querySelector(q); if(e) e.classList.remove('hidden'); });
    if(!on) return;
    if(film) endFilm();
    on=false; busy=false; L=null; group=null; stars=null;
    bolts=[]; boom=[];
    if(window.COACH) COACH.stop();
    if(window.CODE){ CODE.close(); CODE.setGuide(null); CODE.setBudget(0); CODE.setRails({}); }
    if(wasFP!==null){ G.firstPerson=wasFP; wasFP=null; }
  }

  return { start, run, tick, update:tick, stop,
           /* What the board actually holds, in the board's own terms — the
              same reason the trench reports where the sub is: a stage that
              cannot be won is told apart from a program that cannot win by
              looking at the numbers, not at the screen. */
           get where(){ return L ? { stage:L.K.id, alive:live().length,
                                     shield:L.fort.shield, travel:L.travel,
                                     pc:L.pc, over:!!L.over, won:!!L.won,
                                     lost:!!L.lost } : null; },
           get active(){ return on; },
           get busy(){ return busy; },
           retry(){ if(L) start(L.idx); },
           count: STAGES.length, STAGES };
})();
