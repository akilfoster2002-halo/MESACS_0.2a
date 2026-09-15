/* =====================================================================
   THE SWARM — Space Invaders with the arrow of authorship turned round.

   In the arcade game you are the last ship and the army is the weather.
   Here you ARE the army, and you never touch it: you write one program,
   and every invader in the formation flies it at once. That single
   inversion is what makes this a loops mission rather than a shooter,
   because the moment one program drives a hundred bodies, the interesting
   question stops being "where do I move" and becomes "how many, and how
   long for" — which are the two questions `repeat` and `forever` answer.

   THE SHIELD IS A NUMBER OF HITS. Every fire() that reaches the fortress
   takes exactly one off, the fortress shows exactly that many segments,
   and the panel says "4 hits left". It used to be damage with a regrow —
   sixteen off, twelve back — which was arithmetic a student had to do to
   know what it would take, and most did not. Nothing grows back now.
   What forces a loop is the BLOCK BUDGET, which was always the real
   enforcer: four fire() blocks do not fit in two.

   THE LADDER IS ABOUT PLACEMENT — what goes inside a loop and what goes
   after it — with nextRow() as the star, because nextRow() inside a loop
   and nextRow() after it build two different shapes, and a shape is
   something you can see. There is no repeat-until and no down(): a
   teacher took them out, and the ladder is simpler for it. Nested loops
   are the final challenge.

     One Row             walked      spawn() inside the loop, fire() after
     Set the Count       practice    repeat 4 { fire() } — the count is the hits
     Build, Then Fire    practice    one loop for spawn(), another for fire()
     A Column            walked      nextRow() INSIDE the loop makes a column
     Two Rows            practice    nextRow() BETWEEN two row loops makes rows
     Infinite Loop       walked      forever — 24 hits, repeat stops at 20
     Which Loop?         practice    count-controlled or infinite? count and choose
     The Listener        walked      an if inside a forever; across()
     Over the Fortress   practice    the same, fortress on the right
     Nested Loops        walked      nextRow() inside the outer loop, outside the inner
     The Big Grid        practice    a 5×5 — set both counts

   INTRODUCED, THEN PRACTISED. A block is walked the first time — the
   console opens itself and the coach rings each thing to press — and
   then, before the next block arrives, there is a stage with the same
   loop, no coach, and a different job to do with it. The practice stages
   carry the same worked answer in this table as the walked ones, but they
   keep it behind the console's Hint button.

   WRONG PLACEMENT GETS ITS OWN SENTENCE. fire() inside the build loop
   breaks the shield before the outline is full: "You fired too early".
   nextRow() in the wrong loop fills the wrong tiles: "look where the
   invaders went". Those two sentences are most of the lesson.

   THE WORDS ARE THE LESSON'S. Row, not rank; count-controlled and
   infinite, which are the slides' own names for the loops; conditional;
   nested, inner and outer. And plain: the goal, then what to do, with the
   numbers in.

   NO BRIEFING BUBBLE. The bubble is for verdicts, and only for verdicts:
   the shield fell, or here is why it did not. Everything else a stage
   needs to say is on the console's card or in the coach's mouth.

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
  /* How many beats without progress count as "this is not going anywhere".
     Beats, not passes of the loop: a loop with two blocks in it goes round
     half as often as one with one, and it is the watching that wears thin,
     not the arithmetic. About eleven seconds — long enough to believe the
     program is working and short enough to still care why it is not. */
  const PATIENCE=45;
  const SKY=0x05060f;

  /* Where the spawn cursor starts. Column 1 rather than 0 so that a rank
     built left to right has somewhere to be before it runs out of board. */
  const X0=1, Y0=0;

  /* ------------------------------------------------------------ stages
     A stage is the palette it hands out, the fortress it puts up, and
     what counts as done. Everything else is the same engine. */
  const STAGES=[
    /* ONE ROW. The budget is three, and eight invaders need eight spawns,
       so the only program that fits is the one with a loop in it — and
       fire() goes AFTER the loop, which the walk rings as its own step,
       because a fire() left inside the loop breaks the shield on the first
       pass with one invader on the board, and that is the first placement
       mistake anybody makes. */
    { id:'rank', name:'One Row', budget:3,
      pal:['spawn','volley','repeat'],
      goal:{ cols:8, rows:1 },
      fort:{ c0:1, c1:9, shield:1 },
      walk:[
        { say:'Make 8 invaders with 3 blocks. Start with <b>repeat</b>.', sel:'#conPalette [data-add="repeat"]',
          done:()=>has('repeat') },
        { say:'Click <b>+</b> until it says <b>8</b>.', sel:'#conScript .cnt[data-act="inc"]',
          done:()=>count('repeat')===8 },
        { say:'Click the <b>repeat</b> block. Now new blocks go <b>inside</b> it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || inside('repeat','spawn') },
        { say:'Add <b>spawn()</b>. It makes one invader in the yellow frame.', sel:'#conPalette [data-add="spawn"]',
          done:()=>inside('repeat','spawn') },
        /* Only true once there IS a spawn to be outside of: a step that can
           come true before its turn is not a step. */
        { say:'Click the <b>repeat</b> block again. Now new blocks go <b>after</b> it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>has('volley') || (inside('repeat','spawn') && !target()) },
        { say:'Add <b>fire()</b> after the loop. Every invader shoots once.', sel:'#conPalette [data-add="volley"]',
          done:()=>has('volley') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'A count-controlled loop',
              text:'<b>repeat 8</b> runs the block inside it 8 times. That makes 8 invaders with 2 blocks instead of 8. <b>fire()</b> goes <b>after</b> the loop, so the whole row shoots together.',
              code:'repeat 8\n  spawn()\nend\nfire()' },
      need:{ alive:8 } },

    /* SET THE COUNT — the first practice. The row is handed over and the
       shield takes four hits, so the only thing the program decides is how
       many times: repeat 4 round fire(). Four fire() blocks do not fit in a
       budget of two; the loop is not the tidy answer, it is the only one. */
    { id:'volley', name:'Set the Count', budget:2, practice:true,
      pal:['volley','repeat'],
      army:{ cols:8, rows:1 },
      fort:{ c0:1, c1:9, shield:4 },
      learn:{ name:'Practice — a count-controlled loop',
              text:'Goal: break the shield. It takes 4 hits, and each <b>fire()</b> is one hit. Put <b>fire()</b> inside a <b>repeat</b> and set the number.',
              code:'repeat 4\n  fire()\nend' } },

    /* BUILD, THEN FIRE — practice, and the first stage that is ABOUT
       placement. A row of six and a shield of three: one loop for spawn()
       and another for fire(), one after the other. A fire() put inside the
       build loop breaks the shield on the third pass with three invaders
       on the board, and the sentence it gets says so. */
    { id:'then', name:'Build, Then Fire', budget:4, practice:true,
      pal:['spawn','volley','repeat'],
      goal:{ cols:6, rows:1 },
      fort:{ c0:1, c1:9, shield:3 },
      learn:{ name:'Practice — what goes in which loop',
              text:'Goal: build a row of 6, then hit the shield 3 times. Use one <b>repeat</b> for <b>spawn()</b> and another <b>repeat</b> for <b>fire()</b>, one after the other. If <b>fire()</b> is inside the spawn loop, it fires before the row is finished.',
              code:'repeat 6\n  spawn()\nend\nrepeat 3\n  fire()\nend' },
      need:{ alive:6 } },

    /* A COLUMN — the walkthrough for nextRow(), and the picture that makes
       placement visible: spawn() then nextRow(), both INSIDE the loop,
       stacks each new invader under the last. The same two blocks with
       nextRow() outside the loop would build a row. The frame on the board
       drops a row every pass, so the verb is watched rather than read. */
    { id:'column', name:'A Column', budget:4,
      pal:['spawn','nextRow','volley','repeat'],
      goal:{ cols:1, rows:3 },
      fort:{ c0:1, c1:9, shield:1 },
      walk:[
        { say:'Make a column of 3. Start with <b>repeat</b> — it already says 3.', sel:'#conPalette [data-add="repeat"]',
          done:()=>has('repeat') },
        { say:'Click the <b>repeat</b> block so new blocks go inside it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || inside('repeat','spawn') },
        { say:'Add <b>spawn()</b>.', sel:'#conPalette [data-add="spawn"]',
          done:()=>inside('repeat','spawn') },
        { say:'Add <b>nextRow()</b> inside the loop too. It moves the frame down, so the next invader goes under this one.', sel:'#conPalette [data-add="nextRow"]',
          done:()=>inside('repeat','nextRow') },
        { say:'Click the <b>repeat</b> block again so new blocks go after it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>has('volley') || (inside('repeat','nextRow') && !target()) },
        { say:'Add <b>fire()</b>.', sel:'#conPalette [data-add="volley"]',
          done:()=>has('volley') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'nextRow() inside the loop',
              text:'<b>spawn()</b> makes an invader in the yellow frame, then moves the frame right. <b>nextRow()</b> moves the frame down to the start of the next row. Both inside the loop: each new invader goes under the last one — a column.',
              code:'repeat 3\n  spawn()\n  nextRow()\nend\nfire()' },
      need:{ alive:3 } },

    /* TWO ROWS — practice: nextRow() BETWEEN two row loops. Inside a loop
       it stacked invaders; between loops it starts a second row. Six blocks
       is exactly enough for that and not for anything written out; a
       nested repeat 2 round the row loop is five, and also right. */
    { id:'ranks', name:'Two Rows', budget:6, practice:true,
      pal:['spawn','nextRow','volley','repeat'],
      goal:{ cols:8, rows:2 },
      fort:{ c0:1, c1:9, shield:1 },
      learn:{ name:'Practice — nextRow() between loops',
              text:'Goal: fill the outline — 2 rows of 8 — then fire. <b>repeat 8</b> with <b>spawn()</b> inside makes one row. Put <b>nextRow()</b> after the first loop, not inside it — inside, it would make a column. Then another row loop, then <b>fire()</b>.',
              code:'repeat 8\n  spawn()\nend\nnextRow()\nrepeat 8\n  spawn()\nend\nfire()' },
      need:{ alive:16 } },

    /* INFINITE LOOP. Slide three is "repeat (N) vs forever — the difference
       is how they stop". The shield takes twenty-four hits and the counter
       on a repeat only goes to twenty: the biggest repeat there is leaves
       four on the bar, and the loop with no number on it does not. */
    { id:'forever', name:'Infinite Loop', budget:2,
      pal:['volley','repeat','forever'],
      army:{ cols:8, rows:1 },
      fort:{ c0:1, c1:9, shield:24 },
      walk:[
        { say:'This shield takes 24 hits, and <b>repeat</b> only goes up to 20. Use <b>forever</b>. It has no number — it never stops.',
          sel:'#conPalette [data-add="forever"]', done:()=>has('forever') },
        { say:'Click the <b>forever</b> block so new blocks go inside it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || inside('forever','volley') },
        { say:'Add <b>fire()</b>.', sel:'#conPalette [data-add="volley"]',
          done:()=>inside('forever','volley') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'An infinite loop',
              text:'<b>repeat</b> is a count-controlled loop: it runs a set number of times, then stops. <b>forever</b> is an infinite loop: it runs until the game ends.',
              code:'forever\n  fire()\nend' } },

    /* WHICH LOOP? — practice for forever, and it is a choice rather than a
       copy: both loops are on the shelf, the shield takes thirty, and a
       student who counts finds out which loop reaches it. */
    { id:'past', name:'Which Loop?', budget:2, practice:true,
      pal:['volley','repeat','forever'],
      army:{ cols:8, rows:1 },
      fort:{ c0:1, c1:9, shield:30 },
      learn:{ name:'Practice — which loop?',
              text:'Goal: break the shield. Count how many hits it takes. If it is more than 20, <b>repeat</b> cannot do it — use <b>forever</b>.',
              code:'forever\n  fire()\nend' } },

    /* THE LISTENER. The golden rule, and the only stage where WHERE you
       put a block matters more than which block it is. across() walks the
       formation to the wall and turns it round by itself, so the swarm
       sweeps back and forth on its own; the only thing the program has to
       get right is asking, every single pass, whether it is over the
       fortress yet.

       missRebuilds is what makes the asking necessary rather than tidy: a
       volley at empty sky hands the fortress its shield back. The swarm
       misses at both walls, and between one wall and the other there are
       six hits — so a program that fires every pass never gets past six,
       and a shield of eight needs the if. The swarm starts against the
       left wall, off the fortress, so an if ABOVE the loop asks once, gets
       no, and the swarm sweeps for ever without a shot. */
    { id:'listen', name:'The Listener', budget:4,
      pal:['across','volley','forever','ifc'],
      army:{ cols:4, rows:1, c0:0 },
      fort:{ c0:4, c1:6, shield:8, missRebuilds:true },
      conds:['over the fortress','at the edge'],
      walk:[
        { say:'Add <b>forever</b>.', sel:'#conPalette [data-add="forever"]',
          done:()=>has('forever') },
        { say:'Click the <b>forever</b> block so new blocks go inside it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || inside('forever','across') },
        { say:'Add <b>across()</b>. It moves all the invaders one step sideways. At the wall they turn around.', sel:'#conPalette [data-add="across"]',
          done:()=>inside('forever','across') },
        { say:'Add <b>if over the fortress</b>. It goes <b>inside</b> the loop, so it checks every time.', sel:'#conPalette [data-add="ifc"]',
          done:()=>inside('forever','ifc') },
        { say:'Click the <b>if</b> block so the next block goes inside it.', sel:'#conScript .blk.rep .blk.rep > .blk-head',
          done:()=>target('if') || deep('volley') },
        { say:'Add <b>fire()</b>. Now they only shoot when they are over the fortress.', sel:'#conPalette [data-add="volley"]',
          done:()=>deep('volley') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'A conditional inside a loop',
              text:'<b>if</b> checks its condition once. Inside a <b>forever</b> loop it checks again every time, so the invaders react as they move. If you fire when nobody is over the fortress, the shield rebuilds.',
              code:'forever\n  across()\n  if over the fortress\n    fire()\n  end\nend' } },

    /* OVER THE FORTRESS — practice for the if: the same board with the
       fortress against the right wall, so the swarm has three misses to
       make before its first hit and seven hits between walls, against a
       shield of nine. A program that fires every pass is stopped by its
       third miss inside six beats; the one that asks first breaks it on
       the second pass. */
    { id:'over', name:'Over the Fortress', budget:4, practice:true,
      pal:['across','volley','forever','ifc'],
      army:{ cols:4, rows:1, c0:0 },
      fort:{ c0:7, c1:10, shield:9, missRebuilds:true },
      conds:['over the fortress','at the edge'],
      learn:{ name:'Practice — a conditional inside the loop',
              text:'Goal: break the shield on the right. The invaders sweep back and forth with <b>across()</b>. Only fire when they are over the fortress — if you fire at nothing, the shield rebuilds. Put the <b>if</b> inside the <b>forever</b> loop.',
              code:'forever\n  across()\n  if over the fortress\n    fire()\n  end\nend' } },

    /* NESTED LOOPS — the final challenge, and the last word on placement.
       A row is a loop; four rows is that loop inside another one, with
       nextRow() inside the OUTER loop and outside the INNER — after each
       row, not after each invader — and fire() outside both. It is last
       because getting INTO the inner loop and back OUT again is the
       hardest thing the console asks of anybody, and by now every rung has
       rehearsed the click. Four rows the way Two Rows built two would be
       twelve blocks; the budget is five. */
    { id:'grid', name:'Nested Loops', budget:5,
      pal:['spawn','nextRow','volley','repeat'],
      goal:{ cols:8, rows:4 },
      fort:{ c0:1, c1:9, shield:1 },
      walk:[
        { say:'You need 4 rows. Start with a <b>repeat</b> for the rows.', sel:'#conPalette [data-add="repeat"]',
          done:()=>has('repeat') },
        { say:'Click <b>+</b> until it says <b>4</b>. One for each row.', sel:'#conScript .cnt[data-act="inc"]',
          done:()=>count('repeat')===4 },
        { say:'Click the <b>repeat 4</b> block so new blocks go inside it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || depth()>=2 },
        { say:'Add another <b>repeat</b> inside it. This one makes a row.', sel:'#conPalette [data-add="repeat"]',
          done:()=>depth()>=2 },
        { say:'Click <b>+</b> until it says <b>8</b>. 8 invaders in a row.', find:()=>inner('.cnt[data-act="inc"]'),
          done:()=>depth()>=2 && innerCount()===8 },
        { say:'Click the <b>repeat 8</b> block so new blocks go inside it.', sel:'#conScript .blk.rep .blk.rep > .blk-head',
          done:()=>target('inner') || deep('spawn') },
        { say:'Add <b>spawn()</b>.', sel:'#conPalette [data-add="spawn"]',
          done:()=>deep('spawn') },
        /* "Back out" is only back out once there is something to be out OF:
           tested on the drop target alone this came true the moment the
           outer loop was first clicked, five steps earlier. */
        { say:'Click the <b>repeat 8</b> block again to get out of it.', sel:'#conScript .blk.rep .blk.rep > .blk-head',
          done:()=>inside('repeat','nextRow') || (deep('spawn') && target('outer')) },
        { say:'Add <b>nextRow()</b>. It goes after each row — inside the outer loop, not the inner one.', sel:'#conPalette [data-add="nextRow"]',
          done:()=>inside('repeat','nextRow') },
        /* the OUTER head is the first .blk.rep in the document */
        { say:'Click the <b>repeat 4</b> block to get out of it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>has('volley') || (inside('repeat','nextRow') && !target()) },
        { say:'Add <b>fire()</b>.', sel:'#conPalette [data-add="volley"]',
          done:()=>has('volley') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'A nested loop',
              text:'A loop inside a loop is a nested loop. The inner loop (<b>repeat 8</b>) makes one row. The outer loop (<b>repeat 4</b>) runs the inner loop 4 times — one row each time. <b>nextRow()</b> goes inside the outer loop, after the inner one.',
              code:'repeat 4\n  repeat 8\n    spawn()\n  end\n  nextRow()\nend\nfire()' },
      need:{ alive:32 } },

    /* THE BIG GRID — practice for the nested loop: a five-by-five, so both
       counts are the student's to set and neither is a number they have
       typed before. */
    { id:'square', name:'The Big Grid', budget:5, practice:true,
      pal:['spawn','nextRow','volley','repeat'],
      goal:{ cols:5, rows:5 },
      fort:{ c0:1, c1:9, shield:1 },
      learn:{ name:'Practice — a nested loop',
              text:'Goal: fill the outline — 5 rows of 5 — then fire. The inner <b>repeat</b> makes one row with <b>spawn()</b>. The outer <b>repeat</b> runs it once per row, with <b>nextRow()</b> after the inner loop. Set both numbers.',
              code:'repeat 5\n  repeat 5\n    spawn()\n  end\n  nextRow()\nend\nfire()' },
      need:{ alive:25 } }
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
  const CONDS_DEFAULT=['over the fortress','at the edge'];

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

  /* THE SHAPE YOU ARE ASKED FOR, drawn on the board before you have written
     a line. "Build two ranks" is a sentence a student has to picture; an
     outline of sixteen invaders standing where they will stand is not.
     Edges rather than a faint solid, because an outline reads as a slot to
     fill and a faint solid reads as an invader that has not loaded. A real
     invader landing on one covers it exactly, which is the whole feedback:
     the outline fills in as the program runs. */
  function ghostMesh(){
    const g=new THREE.Group();
    /* Edges AND a faint fill. A WebGL line is one pixel wide whatever the
       screen, and on a lab monitor with the brightness down one pixel of
       mint on black is nothing; the fill is what makes the slot a shape
       from across the room, and the edges are what make it a shape rather
       than a smudge. */
    const line=new THREE.LineBasicMaterial({ color:0xa8e6cf, transparent:true, opacity:0.6 });
    const fill=new THREE.MeshBasicMaterial({ color:0xa8e6cf, transparent:true, opacity:0.13, depthWrite:false });
    const slot=(w,h,d,x,y)=>{
      const geo=new THREE.BoxGeometry(w,h,d);
      const f=new THREE.Mesh(geo, fill); f.position.set(x,y,0); g.add(f);
      const l=new THREE.LineSegments(new THREE.EdgesGeometry(geo), line); l.position.set(x,y,0); g.add(l);
    };
    slot(1.7,1.0,1.0, 0,0);
    [-0.62,0.62].forEach(x=>slot(0.3,0.55,0.3, x,-0.72));
    return g;
  }
  /* WHERE THE NEXT spawn() GOES. The cursor was a pair of numbers nobody
     could see, which made nextRow() a block you had to take on trust. A
     frame on the tile makes both verbs literal: spawn() fills the frame
     and steps it right, nextRow() drops it to the start of the row below.
     It is the colour of the nextRow block on the shelf, on purpose. */
  function cursorMesh(){
    /* Four bars rather than a line, for the same one-pixel reason. */
    const g=new THREE.Group();
    const mat=new THREE.MeshBasicMaterial({ color:0xffe9a8, transparent:true, opacity:0.9 });
    const W=2.4, H=2.3, T=0.13;
    [[0, H/2, W, T],[0,-H/2, W, T],[-W/2, 0, T, H],[W/2, 0, T, H]].forEach(([x,y,w,h])=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,0.06), mat);
      m.position.set(x,y,0); g.add(m);
    });
    g.position.z=0.9;
    g.userData.mat=mat;
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
    /* THE SHIELD IS THE READOUT, AND IT IS COUNTED RATHER THAN SHADED —
       one segment per hit, exactly. A shield that takes four hits shows
       four bars, and every fire() that lands puts one out; a student who
       can count bars knows what it will take without doing any sums. */
    const segs=[];
    const SEG=Math.max(1, f.shield|0), gap=SEG>1 ? Math.min(0.14, w/SEG*0.12) : 0, sw=(w - gap*(SEG-1))/SEG;
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

  /* The stages that do not build their own army are handed one. It stands
     where the spawn cursor would start unless the stage says otherwise —
     the listener puts it against the far wall, off the fortress, so that an
     `if` asked once at the start is asked from the wrong place. */
  function deploy(){
    const a=L.K.army; if(!a) return;
    const c0 = a.c0===undefined ? X0 : a.c0, r0 = Y0 + (a.r0||0);
    for(let r=0;r<a.rows;r++) for(let c=0;c<a.cols;c++) addInvader(c0+c, r0+r);
  }

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
    placeCursor();
  }
  function doNextRow(){ L.cur.c=X0; L.cur.r++; placeCursor(); }

  /* The outline and the cursor exist only on the stages that build: a
     handed army has nothing to fill in and no cursor to follow. */
  function drawGoal(){
    const g=L.K.goal; if(!g) return;
    L.ghosts=[];
    for(let r=0;r<g.rows;r++) for(let c=0;c<g.cols;c++){
      const m=ghostMesh();
      m.position.set(wx(X0+c), wy(Y0+r), -0.6);   // behind, so a real invader covers it
      group.add(m); L.ghosts.push(m);
    }
    L.cursor=cursorMesh(); group.add(L.cursor);
    placeCursor();
  }
  /* Every slot of the outline has an invader standing in it. Extra invaders
     are fine — a rank of nine still holds a rank of eight — but an invader
     beside the frame instead of under it is not the shape that was asked
     for, however much damage it does. */
  function goalFilled(){
    const g=L.K.goal; if(!g) return true;
    for(let r=0;r<g.rows;r++) for(let c=0;c<g.cols;c++)
      if(!L.inv.some(v=>v.alive && v.c===X0+c && v.r===Y0+r)) return false;
    return true;
  }
  function placeCursor(){
    const m=L && L.cursor; if(!m) return;
    const off = L.cur.c>=COLS || L.cur.r>=ROWS;   // walked off the board: nothing to point at
    m.visible=!off;
    if(!off) m.position.set(wx(L.cur.c), wy(L.cur.r), 0.9);
  }

  /* ACROSS TURNS ITSELF ROUND AT THE WALL. That is the arcade behaviour and
     it is also what makes the last stage about the `if` rather than about
     steering: the sweep is free, so the only thing left to get right is
     when to fire. */
  function doAcross(){
    const s=span(); if(!s) return;
    if((L.dir>0 && s.c1>=COLS-1) || (L.dir<0 && s.c0<=0)) L.dir=-L.dir;
    live().forEach(v=>{ v.c+=L.dir; });
    place();
  }
  /* FIRE. Every invader drops a bolt, and the volley is ONE HIT if any of
     them is over the fortress — not damage per invader, not damage by
     distance, one hit. The shield is a count of volleys, and a student
     reads it as one: "4 hits left" means four fire() blocks that land. */
  function doVolley(){
    const a=live(); if(!a.length) return;
    const f=L.fort;
    let hit=false;
    a.forEach(v=>{
      const over = v.c>=f.c0 && v.c<=f.c1;
      drawBolt(v, over);
      if(over) hit=true;
    });
    if(!hit){
      /* A VOLLEY AT NOTHING. On most stages it is nothing. On the listener
         it is the fortress's breather: the shield comes back whole, and the
         run is stopped after a few of them with a sentence about asking
         first — because a program that fires at every column is the program
         that stage exists to argue with, and it should lose out loud. */
      if(f.missRebuilds && f.shield>0){
        f.shield=f.max; L.missed++;
        say(t('You fired at nothing. The shield rebuilt.'));
      }
      return;
    }
    L.fired++;
    f.shield=Math.max(0, f.shield-1);
    /* PROGRESS IS A NEW LOW — the shield lower than it has been at any
       point this run. After a rebuild the hits that follow are not new
       lows until they pass the old one, which is what lets a program that
       fires at both walls run out of patience. */
    if(f.shield<L.low){ L.low=f.shield; L.idle=0; }
  }

  function drawBolt(v, hits){
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.9,0.18),
      new THREE.MeshBasicMaterial({color:hits?0xffb4a2:0x5a6b85}));
    m.position.set(wx(v.c), wy(v.r)-0.9, 0);
    group.add(m);
    bolts.push({ mesh:m, t:0, x:wx(v.c), y0:wy(v.r)-0.9, y1:wy(L.fort.r)+1.4 });
  }

  /* --------------------------------------------------------- the sensors
     Three questions, and every one of them is about the whole swarm. The
     student is not flying an invader, so a test about one of them would be
     a test about nothing they can see. */
  function test(cond){
    if(!cond || !L) return false;            // forever compiles to a test of nothing
    const f=L.fort, s=span();
    if(cond==='over the fortress') return !!s && live().some(v=>v.c>=f.c0 && v.c<=f.c1);
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
    /* The last walkthrough is over, whatever it was doing — and it is
       stopped FIRST, before this stage hands the console its shelf. Its
       strip lives in the console, which RUN had closed, so it could not
       clear itself; and stopping it takes the rails off, which hands the
       console the OLD stage's shelf — which, done after the new shelf was
       set, left "Set the Count" offering spawn(). */
    if(window.COACH) COACH.stop();

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
    L={ idx, K, inv:[], cur:{c:X0, r:Y0}, dir:1, fort:f, fired:0, missed:0, low:f.max,
        pc:0, steps:[], wait:0, guard:0, idle:0, over:false, lost:false, won:false };

    const fm=fortMesh(f);
    fm.position.set((wx(f.c0)+wx(f.c1))/2, wy(f.r), 0);
    group.add(fm);
    L.fortMesh=fm;
    deploy();
    drawGoal();

    camera();
    CODE.setGrid(COLS, ROWS);
    CODE.setConditions(K.conds||CONDS_DEFAULT, { lead:'if', until:'repeat until' });
    CODE.setPalette(K.pal); CODE.setBudget(K.budget); CODE.clear();
    /* A practice stage carries its worked answer like every other stage,
       and keeps it behind the Hint button — first line, then the whole
       thing, each for a click. The console still opens itself: the point
       of practice is to write the program, not to find the key that opens
       the editor. */
    if(K.learn) CODE.setGuide(K.practice ? Object.assign({ hint:true }, K.learn) : K.learn);
    /* The bubble is for verdicts. A stage opens with nothing to say, so it
       opens with the bubble put away — say() brings it back with the first
       verdict — rather than with an empty pink shape over the button. */
    const bub=document.querySelector('#briefing'); if(bub){ bub.innerHTML=''; bub.classList.add('hidden'); }
    hud();
    if(K.practice){ if(CODE.setMode) CODE.setMode('blocks'); CODE.show(); }
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
    { at:0.0, cap:'This fortress has a shield. Every fire() that lands takes one hit off it.' },
    { at:2.8, cap:'You control the invaders. One program moves all of them.' },
    { at:5.6, cap:'To make 8 invaders you do not need 8 blocks. You need a loop.' },
    { at:8.4, cap:'Write the program. Break the shield.' }
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
  /* THE FILM OWNS THE SCREEN. Space Explorer's film hides the HUD for its
     ten seconds and puts it back after, and this one has to do the same:
     the captions sit along the bottom, and so does the [C] Code Console
     button, so a film that left the HUD up wrote its second line straight
     across the button. What was hidden is written down and restored,
     because a HUD that was already hidden must not be conjured up. */
  let filmHid=[];
  function startFilm(then){
    film={ t:0, shot:-1, then, built:0 };
    const el=filmScreen();
    setTimeout(()=>{ const ti=el.querySelector('#inTitle'); if(ti) ti.classList.add('in-show'); }, 60);
    if(window.CODE) CODE.close();
    filmHid=[];
    ['#hud','#briefing'].forEach(sel=>{
      const e=document.querySelector(sel); if(!e) return;
      if(!e.classList.contains('hidden')) filmHid.push(sel);
      e.classList.add('hidden');
    });
  }
  function endFilm(){
    const was=film; film=null;
    const el=document.querySelector('#intro'); if(el) el.remove();
    filmHid.forEach(sel=>{ const e=document.querySelector(sel); if(e) e.classList.remove('hidden'); });
    filmHid=[];
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
    /* Not guarded on busy. A forever loop has no end on it, so the way to
       try the next idea is to press RUN on top of the last one — and since
       a run starts from a fresh board anyway, there is nothing to protect. */
    if(!on) return;
    const steps=(window.CODE && CODE.script && CODE.script.length)
      ? CODE.compile(CODE.script) : [];
    if(!steps.length){ say(t('Write a program first — press <b>C</b>.')); return; }

    // a fresh run is a fresh board: the formation, the shield and the cursor
    live().forEach(v=>{ group.remove(v.mesh); });
    L.inv=[]; L.cur={c:X0, r:Y0}; L.dir=1; L.fired=0; L.missed=0;
    L.fort.shield=L.fort.max; L.low=L.fort.max;
    bolts.forEach(b=>group.remove(b.mesh)); bolts=[];
    /* A fortress you already blew up has to be standing again before the
       next run, or pressing RUN on a stage you have just beaten plays it
       against an invisible one. The last stage is where this shows: it does
       not advance on its own, so RUN is the obvious next thing to press. */
    boom.forEach(p=>group.remove(p.mesh)); boom=[];
    if(L.fortMesh) L.fortMesh.visible=true;
    deploy();
    placeCursor();

    busy=true;
    L.pc=0; L.steps=steps; L.wait=0; L.guard=0; L.idle=0;
    L.over=false; L.lost=false; L.won=false;
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
    /* Three volleys at empty sky is not bad luck, it is a program with no
       question in it — and by the third rebuild the student has watched
       the bar go back to full twice, which is the argument made. */
    if(L.fort.missRebuilds && L.missed>=3)
      return finish(false, t('You fired 3 times at nothing, and the shield rebuilt each time. Only fire over the fortress: use <b>if over the fortress</b>.'));
    /* Only a stage that was HANDED an army can lose one. */
    if(L.K.army && !live().length && !L.won)
      return finish(false, t('All the invaders are gone.'));
    /* THE BREACH IS THE WIN — on a build stage, only once the outline is
       full. A shield that fell with the outline still open means fire()
       ran before the building was done, and that is a sentence about WHERE
       the fire() block is, which is the lesson. */
    if(breached){
      if(!goalFilled())
        return finish(false, L.pc<L.steps.length
          ? t('You fired too early — the outline is not filled yet. Put <b>fire()</b> after the loop that builds it.')
          : t('The shield is down, but the outline is not filled. Look where the invaders went — check the numbers on your loops, and which loop <b>nextRow()</b> is in.'));
      return finish(true);
    }

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
        if(L.idle>PATIENCE){ L.over=true; return stuck(L.steps[st.back]); }
        if(++L.guard>20000){ L.over=true; return stuck(L.steps[st.back]); }
        continue;
      }
      if(st.name==='__if'){ L.pc = test(st.cond) ? L.pc+1 : st.jump; continue; }
      if(st.name==='__iter' || st.name==='__call'){ L.pc++; continue; }

      if(st.name==='spawn')       doSpawn();
      else if(st.name==='nextRow')doNextRow();
      else if(st.name==='across') doAcross();
      else if(st.name==='volley') doVolley();
      L.pc++;
      L.idle++;                   // a beat that changed nothing is counted; one that did was just zeroed
      hud();
      return;                     // one action block a beat
    }
  }

  /* THE PROGRAM RAN OUT with the shield still up. On a build stage that is
     one of two things and each gets its own sentence: nobody fired, or the
     outline was not filled. On a firing stage it is a count that came up
     short, and the sentence says by how much. */
  function programEnded(){
    L.over=true;
    if(L.K.goal && !L.fired)
      return finish(false, t('Nobody fired. Add <b>fire()</b> after the loop.'));
    if(L.K.goal && !goalFilled())
      return finish(false, t('The outline is not filled. Look where the invaders went — check the numbers on your loops, and which loop <b>nextRow()</b> is in.'));
    return finish(false, L.fort.shield===1
      ? t('Your program ended, but the shield is still up — it needs 1 more hit.')
      : t('Your program ended, but the shield is still up — it needs {n} more hits.',{n:L.fort.shield}));
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
      ? t('Your loop keeps going. Nothing inside it can make <b>{c}</b> true. Which block is missing?',
          { c:t(loop.cond) })
      : t('Your loop keeps going, but nothing changes. Is the important block <b>inside</b> the loop?'));
  }

  function finish(ok, why){
    busy=false;
    if(ok){
      L.won=true;
      blowUp();
      const last=L.idx>=STAGES.length-1;
      say(last ? t('🏅 You broke the shield! 25 invaders from 5 blocks — that is a nested loop.')
               : t('✅ You broke the shield!'));
      if(last && window.PROGRESS) PROGRESS.complete('inv');
      else nextT=setTimeout(()=>{ nextT=null; if(on) start(L.idx+1); }, 1900);
    } else {
      L.lost=true;
      say('💥 '+(why||t('That did not break the shield.'))+' '+t('Press <b>C</b> and try again.'));
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
    // it breathes, but never below half: a cursor you can catch invisible is not a cursor
    if(L.cursor) L.cursor.userData.mat.opacity = 0.75 + 0.25*Math.sin(performance.now()/260);
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
        `<li class="cur">🛡️ ${t('Shield')}: <b>${f.shield}</b> ${t('hits left')}`
        + (f.shield>0 && f.missRebuilds ? ` <small>(${t('rebuilds if you miss')})</small>` : '')
        + `</li>`
        + `<li>👾 ${t('Invaders')}: <b>${live().length}</b>`
        + (L.K.need && L.K.need.alive ? ` / ${L.K.need.alive} ${t('needed')}` : '')
        + `</li>`
        + STAGES.map((s,i)=>
            `<li class="${i===L.idx?'cur':(i<L.idx?'done':'')}">${t(s.name)}`
            + (s.practice ? ` <small>${t('practice')}</small>` : '') + `</li>`).join('');
    }
    // the film has the HUD put away, and a repaint mid-film must not bring it back
    const h=document.querySelector('#hud'); if(h && !film) h.classList.remove('hidden');
    if(window.keyHint) keyHint(`<b>C</b> ${t('write your program')} &nbsp; <b>RUN</b> ${t('runs it')}`);
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
                                     shield:L.fort.shield, missed:L.missed,
                                     pc:L.pc, over:!!L.over, won:!!L.won,
                                     lost:!!L.lost } : null; },
           get active(){ return on; },
           get busy(){ return busy; },
           retry(){ if(L) start(L.idx); },
           count: STAGES.length, STAGES };
})();
