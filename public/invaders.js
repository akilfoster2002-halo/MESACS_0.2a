/* =====================================================================
   THE SWARM — Space Invaders with the arrow of authorship turned round.

   In the arcade game you are the last ship and the army is the weather.
   Here you ARE the army, and you never touch it: you write one program,
   and every invader in the formation flies it at once. That single
   inversion is what makes this a loops mission rather than a shooter,
   because the moment one program drives a hundred bodies, the interesting
   question stops being "where do I move" and becomes "how many, and how
   long for" — which are the two questions `repeat` and `forever` answer.

   THE LADDER IS THE LESSON, one slide at a time — and the slides go from
   the loop you can count to the loop you cannot, so that is the order
   here. Every rung is one loop and a handful of blocks. Nothing nests
   until the end.

   INTRODUCED, THEN PRACTISED. A block is walked the first time — the
   console opens itself and the coach rings each thing to press — and
   then, before the next block arrives, there is a stage with the same
   loop, no coach, and a different job to do with it. A walkthrough shows
   you where a block goes; only writing it yourself shows you that you
   know. The practice stages carry the same worked answer in this table
   as the walked ones, but they keep it behind the console's Hint button,
   one line at a time, so that asking costs a click and thinking costs
   nothing.

   EVERY BLOCK, NOT JUST EVERY LOOP. A verb that turns up for the first
   time on a practice stage is a block nobody was shown, and "every
   invader fires once" on the shelf is not being shown. So the walked
   stages introduce the verbs the practice after them needs, and the
   coach rings each one — which is why the first stage ends with fire()
   rather than the swarm firing by itself, and why there is a tiny walked
   stage for nextRow() before the two ranks that need it.

     One Row             walked      repeat, spawn(), fire() — count-controlled
     Set the Count       practice    repeat, round fire() — find the count
     Drop a Row          walked      nextRow(): one invader under another
     Two Rows            practice    the row loop twice, with a row between
     Infinite Loop       walked      forever, across() — repeat 20 falls short
     Which Loop?         practice    count-controlled or infinite? count and choose
     Repeat Until        walked      condition-controlled, down(), a reason to stop
     Walk to the Wall    practice    repeat until, with a different condition
     The Listener        walked      a conditional inside an infinite loop
     The Staircase       practice    the same, the arcade's own motion:
                                     down a row at every wall
     Nested Loops        walked      a loop inside a loop — the final

   THE WORDS ARE THE LESSON'S. Row, not rank; count-controlled, infinite
   and condition-controlled, which are the slides' own names for the three
   loops; conditional; nested, inner and outer. A game that teaches the
   vocabulary of computing should use it, and a "rank" is a word from a
   parade ground that a student would have to unlearn.

   NO BRIEFING BUBBLE. Every stage used to open with a paragraph in the
   speech bubble along the bottom — the shield number, the regrow, the
   block budget, the task — and every word of it is already on screen: the
   numbers in the mission panel, the budget on the console, the task on the
   console's card or in the coach's mouth. The bubble is for verdicts now,
   and only for verdicts: the fortress fell, or here is why it did not.

     rank     repeat (N)          eight invaders is two blocks or it is
                                  eight. The budget makes the choice for
                                  you, which is the teacher's line about
                                  ten blocks versus one, made mechanical.
     volley   repeat (N), again   the army is handed over and the shield
                                  grows back between volleys, so one volley
                                  is not enough and four are. The same two
                                  blocks as the rank; the only thing that
                                  changed is the number, which is the whole
                                  of "change the number once".
     forever  forever             the biggest repeat there is counts to
                                  twenty, and this shield takes more than
                                  twenty volleys. A loop that cannot be
                                  counted is the definition of this one.
     until    repeat until        now there IS a sensor, and now stopping
                                  matters: keep descending after the shield
                                  falls and the swarm flies into the wreck.
                                  forever wins the last stage and loses this
                                  one, which is the whole of "the difference
                                  is how they stop".
     listen   if inside forever   the golden rule. An `if` above the loop
                                  asks once, at the start, from the wrong
                                  side of the board, and never fires. Put
                                  the same block one level in and it asks
                                  every pass — and a volley at nothing lets
                                  the fortress rebuild, so asking is not
                                  optional.
     grid     a loop in a loop    the final challenge. A rank is a loop;
                                  four ranks is that loop inside another
                                  one. It is the only rung that nests two
                                  loops, and it is last because getting
                                  INTO the inner one and back OUT again is
                                  the hardest thing the console asks of
                                  anybody. The two rungs before it that put
                                  a container in a container are the
                                  rehearsal for it.

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
    /* ONE RANK. The budget is three, and eight invaders need eight spawns,
       so the only program that fits is the one with a loop in it. This is
       the whole of slide two and it is deliberately the first thing that
       happens: the lesson is not "a loop is neater", it is "a loop is the
       only version of this that you are allowed to write".

       Then fire(). The swarm used to open fire by itself when the program
       ended, which made fire() a block that turned up on the next stage
       with nobody having shown it. Now the first program ends the way the
       film does — write the army, break the fortress — and the walk rings
       the click that steps back OUT of the loop before it, because that is
       the click a first program most often gets wrong. The shield grows
       back the whole eight, so a fire() left INSIDE the loop still only
       wins on the eighth pass, with the eighth invader. */
    { id:'rank', name:'One Row', budget:3,
      pal:['spawn','volley','repeat'],
      goal:{ cols:8, rows:1 },
      fort:{ c0:1, c1:9, shield:8, regrow:8 },
      /* POINTED AT, NOT EXPLAINED. COACH rings the real button and the rails
         narrow the shelf to the one block being asked for, so the words only
         have to NAME the move — the screen already says where.

         The "click the loop" step is not padding. Taking a repeat off the
         shelf does not put you INSIDE it; the next block lands under the
         loop instead of in it, which is the single most common way a first
         program comes out wrong. So it is a step, with the loop itself lit
         up and an empty shelf, because there is nothing else to do here. */
      walk:[
        { say:'Make 8 invaders with 3 blocks. Start with <b>repeat</b>.', sel:'#conPalette [data-add="repeat"]',
          done:()=>has('repeat') },
        { say:'Click <b>+</b> until it says <b>8</b>.', sel:'#conScript .cnt[data-act="inc"]',
          done:()=>count('repeat')===8 },
        { say:'Click the <b>repeat</b> block. Now new blocks go <b>inside</b> it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || inside('repeat','spawn') },
        { say:'Add <b>spawn()</b>. It makes one invader in the yellow frame.', sel:'#conPalette [data-add="spawn"]',
          done:()=>inside('repeat','spawn') },
        /* Only true once there IS a spawn to be outside of — the same rule
           the grid learnt: a step that can come true before its turn is not
           a step. */
        { say:'Click the <b>repeat</b> block again. Now new blocks go <b>after</b> it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>has('volley') || (inside('repeat','spawn') && !target()) },
        { say:'Add <b>fire()</b>. Every invader shoots once.', sel:'#conPalette [data-add="volley"]',
          done:()=>has('volley') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'A count-controlled loop',
              text:'<b>repeat 8</b> runs the block inside it 8 times. That makes 8 invaders with 2 blocks instead of 8. Then <b>fire()</b> makes them all shoot.',
              code:'repeat 8\n  spawn()\nend\nfire()' },
      /* Eight bolts against a shield of eight, and the regrow never gets a
         turn because the breach is checked before it. Seven invaders lose. */
      need:{ alive:8 } },

    /* COUNT THE VOLLEYS — the first practice. The same two blocks as the
       rank with a different verb in the middle, and no coach: the army is
       handed over so the only thing the program decides is HOW MANY TIMES.
       Eight invaders take eight off a shield of twenty that puts four back,
       so one volley does nothing much, three leave it standing, and four
       break it (20, 16, 12, 8, gone) — and the number on the loop is the
       only thing a student ever edits to get from the one to the other.
       This is "change the number once and the whole behaviour changes", as
       a fortress, written by the student rather than pointed at. */
    { id:'volley', name:'Set the Count', budget:2, practice:true,
      pal:['volley','repeat'],
      army:{ cols:8, rows:1 },
      fort:{ c0:1, c1:9, shield:20, regrow:4 },
      learn:{ name:'Practice — a count-controlled loop',
              text:'Goal: break the shield. Put <b>fire()</b> inside a <b>repeat</b>. Each volley takes 8 off the shield, and the shield grows back 4. Pick a number big enough to break it.',
              code:'repeat 4\n  fire()\nend' }, },

    /* DROP A ROW — the walkthrough for nextRow(), and nothing else. Two
       invaders, one under the other, and four blocks with no loop in them,
       because the only thing being shown is what the verb does: spawn()
       fills the frame and steps it right, nextRow() drops the frame to the
       start of the row below. With the cursor on the board that is
       something you watch happen rather than read. The outline is two
       slots stacked, and the stage is only won when both are filled — so
       spawn() spawn() fire(), which puts the second invader beside the
       first instead of under it, breaks the shield and still loses, with a
       sentence about the frame. */
    { id:'row', name:'Drop a Row', budget:4,
      pal:['spawn','nextRow','volley'],
      goal:{ cols:1, rows:2 },
      fort:{ c0:1, c1:9, shield:2, regrow:2 },
      walk:[
        { say:'Add <b>spawn()</b>. It makes one invader in the yellow frame.', sel:'#conPalette [data-add="spawn"]',
          done:()=>has('spawn') },
        { say:'Add <b>nextRow()</b>. It moves the frame down to the next row.', sel:'#conPalette [data-add="nextRow"]',
          done:()=>has('nextRow') },
        { say:'Add <b>spawn()</b> again. This invader goes under the first one.', sel:'#conPalette [data-add="spawn"]',
          done:()=>SCR().filter(b=>b.type==='spawn').length>=2 },
        { say:'Add <b>fire()</b>.', sel:'#conPalette [data-add="volley"]',
          done:()=>has('volley') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'The next row',
              text:'<b>spawn()</b> makes an invader where the yellow frame is, then moves the frame right. <b>nextRow()</b> moves the frame down to the start of the next row.',
              code:'spawn()\nnextRow()\nspawn()\nfire()' },
      need:{ alive:2 } },

    /* TWO RANKS — practice, and the seed of the final. A rank is a loop
       the student has now written twice; this asks for it twice in one
       program with a row dropped between. Six blocks is exactly enough
       for that and not for anything written out, and one rank — even a
       rank of ten, which is what repeat 20 gets you before the board runs
       out — leaves the shield standing. By the grid, "four ranks the way
       you built two" is a sentence about eleven blocks, and the loop round
       the loop is the obvious move rather than a clever one. */
    { id:'ranks', name:'Two Rows', budget:6, practice:true,
      pal:['spawn','nextRow','volley','repeat'],
      goal:{ cols:8, rows:2 },
      fort:{ c0:1, c1:9, shield:12, regrow:5 },
      learn:{ name:'Practice — the same loop twice',
              text:'Goal: fill the outline — 2 rows of 8 — then fire. <b>repeat 8</b> with <b>spawn()</b> inside makes one row. Put <b>nextRow()</b> between the two rows. You have 6 blocks.',
              code:'repeat 8\n  spawn()\nend\nnextRow()\nrepeat 8\n  spawn()\nend\nfire()' },
      need:{ alive:16 } },

    /* NO NUMBER. Slide three is "repeat (N) vs forever — the difference is
       how they stop", and the cleanest way to show a difference is to
       change nothing else. So this is the volley stage again with a shield
       that takes twenty-four volleys, and the counter on a repeat only goes
       to twenty. The biggest repeat there is leaves eight on the bar. The
       loop with no number on it does not. */
    { id:'forever', name:'Infinite Loop', budget:3,
      pal:['across','volley','repeat','forever'],
      army:{ cols:8, rows:1 },
      fort:{ c0:1, c1:9, shield:48, regrow:6 },
      /* across() is introduced here, walked, because the stage after next
         needs it and a verb has to be shown before it is asked for. It is
         not what wins this stage — the shield falls to the volleys — but a
         swarm that keeps sliding while the loop keeps going is the picture
         of a loop with no end, and at the wall it turns round by itself. */
      walk:[
        { say:'This shield needs more than 20 volleys, and <b>repeat</b> only goes up to 20. Use <b>forever</b>. It has no number — it never stops.',
          sel:'#conPalette [data-add="forever"]', done:()=>has('forever') },
        { say:'Click the <b>forever</b> block so new blocks go inside it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || inside('forever','across') },
        { say:'Add <b>across()</b>. It moves all the invaders one step sideways. At the wall they turn around.',
          sel:'#conPalette [data-add="across"]', done:()=>inside('forever','across') },
        { say:'Add <b>fire()</b>.', sel:'#conPalette [data-add="volley"]',
          done:()=>inside('forever','volley') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'An infinite loop',
              text:'<b>repeat</b> is a count-controlled loop: it runs a set number of times, then stops. <b>forever</b> is an infinite loop: it runs until the game ends.',
              code:'forever\n  across()\n  fire()\nend' }, },

    /* PAST COUNTING — practice for forever, and it is a choice rather than
       a copy: both loops are on the shelf, and the brief hands over three
       numbers and asks which. Sixteen take sixteen off a shield of
       ninety-six that puts twelve back — four a volley, twenty-four volleys,
       and the counter stops at twenty. A student who counts finds out; a
       student who tries repeat 20 and reads the bar finds out the same
       thing a few seconds later. */
    { id:'past', name:'Which Loop?', budget:3, practice:true,
      pal:['across','volley','repeat','forever'],
      army:{ cols:8, rows:2 },
      fort:{ c0:1, c1:9, shield:96, regrow:12 },
      learn:{ name:'Practice — which loop?',
              text:'Goal: break the shield. Each volley takes 16 off, and the shield grows back 12. Work out how many volleys you need. If it is more than 20, <b>repeat</b> cannot do it — use <b>forever</b>.',
              code:'forever\n  fire()\nend' }, },

    /* THE SHIELD. The same fight, plus a sensor and a reason to stop.
       Descending is how you get the volleys close enough to bite, and
       descending after the shield is gone flies the swarm into the wreck —
       so forever, which won the last stage, loses this one.

       landAfter: breaking the shield does not end the stage. If it did,
       forever and repeat-until would be the same program here — both
       breach on the same volley and both get frozen at the moment they
       do, which is the opposite of the thing being taught. The fortress
       is taken when your program LETS GO with the shield down, so the
       loop that cannot let go cannot win. */
    { id:'until', name:'Repeat Until', budget:3,
      pal:['volley','descend','until','forever'],
      army:{ cols:8, rows:2 },
      fort:{ c0:1, c1:9, shield:60, regrow:8 },
      conds:['the shield is down','over the fortress','at the edge'],
      landAfter:true,
      walk:[
        { say:'Add <b>repeat until</b>. It keeps going until the shield is down — then it stops.', sel:'#conPalette [data-add="until"]',
          done:()=>has('until') },
        { say:'Click the <b>repeat until</b> block so new blocks go inside it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || inside('until','volley') },
        { say:'Add <b>fire()</b>.', sel:'#conPalette [data-add="volley"]',
          done:()=>inside('until','volley') },
        { say:'Add <b>down()</b>. Closer invaders do more damage.', sel:'#conPalette [data-add="descend"]',
          done:()=>inside('until','descend') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'A condition-controlled loop',
              text:'<b>repeat until the shield is down</b> checks the shield every time, and stops when the shield is gone. <b>forever</b> would keep going down after the shield breaks and crash into the fortress.',
              code:'repeat until the shield is down\n  fire()\n  down()\nend' }, },

    /* WALK TO THE WALL — practice for repeat until, with the slide's own
       analogy made into a board: you do not count the steps to a wall, you
       check for it. The fortress is against the right wall, the swarm
       starts one column in from the left, and `repeat until at the edge`
       round across() walks it there. Then three volleys. Somebody who
       counts the steps instead gets it right at six and wrong at seven —
       the seventh across turns the swarm round, and three volleys from a
       column short leave the shield standing — which is the lesson about
       watching for the signal, delivered by the board rather than by the
       text. The swarm must NOT start against the wall: `at the edge` would
       be true before the first step and the loop would be over before it
       began. */
    { id:'wall', name:'Walk to the Wall', budget:4, practice:true,
      pal:['across','volley','until','repeat'],
      army:{ cols:4, rows:2 },
      fort:{ c0:7, c1:10, shield:20, regrow:2 },
      conds:['at the edge','the shield is down','over the fortress'],
      learn:{ name:'Practice — a condition-controlled loop',
              text:'Goal: break the shield by the right wall. First move the invaders to the wall: put <b>across()</b> inside <b>repeat until at the edge</b>. Then fire 3 times with another loop.',
              code:'repeat until at the edge\n  across()\nend\nrepeat 3\n  fire()\nend' }, },

    /* THE LISTENER. The golden rule, and the only stage where WHERE you
       put a block matters more than which block it is. `across` walks the
       formation to the wall and turns it round by itself, so the swarm
       sweeps back and forth over the fortress on its own; the only thing
       the program has to get right is asking, every single pass, whether
       it is over the target yet.

       missRebuilds is what makes the asking necessary rather than tidy. A
       volley at empty sky used to cost nothing, and then `forever { across
       fire }` won this stage without an `if` in it. Now a miss hands the
       fortress its shield back, and the swarm misses at both walls — so the
       program that fires every pass tops the shield up twice a sweep and
       never gets below six. The fortress sits in the middle and the swarm
       starts at the far left, off it, so an `if` ABOVE the loop asks once,
       gets no, and the swarm sweeps for ever without a shot. */
    { id:'listen', name:'The Listener', budget:4,
      pal:['across','volley','forever','ifc'],
      army:{ cols:4, rows:2, c0:0 },
      fort:{ c0:4, c1:6, shield:30, regrow:0, missRebuilds:true, narrow:true },
      conds:['over the fortress','at the edge','the shield is down'],
      walk:[
        { say:'Add <b>forever</b>.', sel:'#conPalette [data-add="forever"]',
          done:()=>has('forever') },
        { say:'Click the <b>forever</b> block so new blocks go inside it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>target() || inside('forever','across') },
        { say:'Add <b>across()</b>. The invaders move back and forth on their own.', sel:'#conPalette [data-add="across"]',
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
              code:'forever\n  across()\n  if over the fortress\n    fire()\n  end\nend' }, },

    /* THE STAIRCASE — practice for the if, and it is the arcade's own
       motion: across, and down a row at every wall. The same board as the
       listener with a different question in the if and a different block
       inside it, which is what stops it being the listener copied out.
       From where the swarm starts a volley takes off exactly what grows
       back, so a program that never descends never wins; a program that
       descends every pass is in the fortress in five; and a program that
       asks the wrong question — down when over the fortress — flies into
       it inside a sweep. Only the one that asks "at the edge?" every pass
       comes down the stairs. It starts three rows down so the answer takes
       nine seconds rather than twenty. */
    { id:'stairs', name:'The Staircase', budget:5, practice:true,
      pal:['across','volley','descend','forever','ifc'],
      army:{ cols:4, rows:2, c0:0, r0:3 },
      fort:{ c0:4, c1:6, shield:30, regrow:6 },
      conds:['at the edge','over the fortress','the shield is down'],
      learn:{ name:'Practice — a conditional inside the loop',
              text:'Goal: break the shield. From up here the shots are too weak. Move like the real arcade game: <b>across()</b>, and each time the invaders reach a wall, <b>down()</b> one row. Use <b>if at the edge</b> inside a <b>forever</b> loop, and <b>fire()</b> every time.',
              code:'forever\n  across()\n  fire()\n  if at the edge\n    down()\n  end\nend' },
      stuck:'The invaders are too far away — every volley grows straight back. Use <b>down()</b> to move closer.' },

    /* THE GRID — the final challenge. A rank was one loop; four ranks is
       that same loop with another one round it. The fortress is thick
       enough that no single rank can break it, which is what makes the
       second loop the answer rather than a bigger number in the first.

       It is last on purpose. Nothing else in this course nests two loops,
       and the walk through it is the longest here because it has to get the
       student INTO the inner loop and back OUT of it again — the one thing
       the console asks that has no picture on the shelf. By now they have
       stepped into a loop on every rung and into an if inside a loop on the
       one before this, so the click that used to be a mystery is a habit. */
    { id:'grid', name:'Nested Loops', budget:5,
      pal:['spawn','nextRow','volley','repeat'],
      goal:{ cols:8, rows:4 },
      fort:{ c0:1, c1:9, shield:30, regrow:7 },
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
        /* "Back out" is only back out once there is something to be out OF.
           Testing the drop target alone made this step true the moment you
           first clicked INTO the outer loop, five steps earlier — and COACH
           stands past the last step that is already true, so the whole inner
           rank got skipped and the walkthrough built a grid with no rank in
           it. A step that can be true before its own turn is not a step. */
        { say:'Click the <b>repeat 8</b> block again to get out of it.', sel:'#conScript .blk.rep .blk.rep > .blk-head',
          done:()=>inside('repeat','nextRow') || (deep('spawn') && target('outer')) },
        { say:'Add <b>nextRow()</b>. After each row, move down one.', sel:'#conPalette [data-add="nextRow"]',
          done:()=>inside('repeat','nextRow') },
        /* the OUTER head is the first .blk.rep in the document, so this
           selector lands on it and not on the rank inside */
        { say:'Click the <b>repeat 4</b> block to get out of it.', sel:'#conScript .blk.rep > .blk-head',
          done:()=>has('volley') || (inside('repeat','nextRow') && !target()) },
        { say:'Add <b>fire()</b>.', sel:'#conPalette [data-add="volley"]',
          done:()=>has('volley') },
        { say:'', sel:'#conRun', done:()=>busy }
      ],
      learn:{ name:'A nested loop',
              text:'A loop inside a loop is a nested loop. The inner loop (<b>repeat 8</b>) makes one row. The outer loop (<b>repeat 4</b>) runs the inner loop 4 times — one row each time.',
              code:'repeat 4\n  repeat 8\n    spawn()\n  end\n  nextRow()\nend\nfire()' },
      need:{ alive:32 } }
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
      const hits = v.c>=f.c0 && v.c<=f.c1;
      drawBolt(v, hits);
      if(!hits) return;
      /* One damage, plus one more for each row of the gap you have closed,
         capped so that a swarm sitting on top of the fortress is worth
         three bolts rather than nine. */
      const gap=Math.max(0, f.r - v.r);
      dmg += 1 + Math.min(2, Math.max(0, 4-gap));
    });
    if(!dmg){
      /* A VOLLEY AT NOTHING. On most stages it is nothing. On the listener
         it is the fortress's breather: the shield comes back whole, and the
         run is stopped after a few of them with a sentence about asking
         first — because a program that fires at every column is the program
         this stage exists to argue with, and it should lose out loud. */
      if(f.missRebuilds && f.shield>0){
        f.shield=f.max; L.missed++;
        say(t('You fired at nothing. The shield rebuilt.'));
      }
      return;
    }
    L.fired++;
    f.shield -= dmg;
    if(f.shield<=0){ f.shield=0; L.idle=0; return; }    // breached before it can grow
    f.shield=Math.min(f.max, f.shield + f.regrow);
    /* PROGRESS IS A NEW LOW — the shield lower, after the regrow, than it
       has been at any point this run. Not merely "it went down": a swarm
       sweeping at the wrong height takes nine off at the middle of the
       fortress and three at its edge, grows six back each time, and so
       wobbles between twenty-four and thirty for ever — going down every
       other volley and getting nowhere. Only a new low is getting
       somewhere, and a run that has not set one in a while is the loop
       going round for nothing, which is what the patience counter is for. */
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
    if(cond==='the shield is down') return f.shield<=0;
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
    L={ idx, K, inv:[], cur:{c:X0, r:Y0}, dir:1, fort:f, fired:0, missed:0, linger:0, low:f.max,
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
    { at:0.0, cap:'This fortress has a shield. It grows back after every attack.' },
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
    L.inv=[]; L.cur={c:X0, r:Y0}; L.dir=1; L.fired=0; L.missed=0; L.linger=0;
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
    /* A WRECK IS AS SOLID AS A FORTRESS. Checked whether or not the shield
       is down, which is the whole of the shield stage: the loop that never
       stops keeps descending after it has already won and flies into what
       it just broke. */
    if(s && s.r1>=L.fort.r)
      return finish(false, breached
        ? t('The shield was already down, but your loop kept going down and crashed. Use a loop that stops.')
        : t('The invaders crashed into the fortress. Do not go down so far.'));
    /* Three volleys at empty sky is not bad luck, it is a program with no
       question in it — and by the third rebuild the student has watched
       the bar go back to full twice, which is the argument made. */
    if(L.fort.missRebuilds && L.missed>=3)
      return finish(false, t('You fired 3 times at nothing, and the shield rebuilt each time. Only fire over the fortress: use <b>if over the fortress</b>.'));
    /* Only a stage that was HANDED an army can lose one. The build stages
       open with an empty board on purpose — filling it is the exercise — so
       "there is nobody left" is a sentence about the stages that started
       with somebody. */
    if(L.K.army && !live().length && !L.won)
      return finish(false, t('All the invaders are gone.'));
    /* On most stages the breach IS the win. On a stage about stopping it is
       not: the fortress is taken when your program lets go with the shield
       down, and a loop with no way out never lets go. */
    if(breached && !L.K.landAfter){
      if(!goalFilled())
        return finish(false, t('The shield is down, but the outline is not filled. Put the invaders where the outline is.'));
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
        /* THE LOOP THAT WON AND WOULD NOT LET GO. On the stage about
           stopping, a forever that has broken the shield is still firing at
           a wreck — not descending into it, just never finishing — and the
           swarm can fire at rubble for as long as anybody is willing to
           watch. A few passes of that is enough to see what it is. */
        if(L.K.landAfter && L.fort.shield<=0 && ++L.linger>8){
          L.over=true;
          return finish(false, t('The shield is down, but your loop never stops. Use <b>repeat until the shield is down</b>.'));
        }
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
      L.idle++;                   // a beat that changed nothing is counted; one that did was just zeroed
      hud();
      return;                     // one action block a beat
    }
  }

  /* THE PROGRAM RAN OUT with the fortress still standing. What that means
     is the difference between the build stages and the firing ones, and it
     is the lesson in both:

       building   the rank you finished fired once, and whether it broke the
                  shield is a question about how many of them there were —
                  or it never fired at all, which is its own sentence
       firing     the shield is whatever the volleys left it at, and if that
                  is not zero the program was too short — a repeat that
                  counted to the wrong number, or to any number at all on
                  the stage where no number is enough */
  function programEnded(){
    /* LETTING GO IS THE WIN on a stage about stopping. The loop got out, the
       shield is down and the swarm is still flying — which is the sentence
       `repeat until` writes and `forever` cannot. */
    if(L.K.landAfter && L.fort.shield<=0) return finish(true);
    L.over=true;
    /* On a build stage the program is the army and one volley, so what went
       wrong is one of two things and each gets its own sentence: nobody
       fired, or not enough of them did. */
    if(L.K.goal && !L.fired)
      return finish(false, t('Nobody fired. Add <b>fire()</b> at the end.'));
    if(L.K.goal)
      return finish(false, t('{n} invaders is not enough. The shield grew back. Fill the outline.',{n:live().length}));
    return finish(false, t('Your program ended, but the shield is still up. You need more volleys.'));
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
      /* A stage can say what going round for nothing means on ITS board.
         On the staircase the block is inside the loop all right — the
         swarm is simply too far away for a volley to outrun the regrow. */
      : t(L.K.stuck || 'Your loop keeps going, but nothing changes. Is the important block <b>inside</b> the loop?'));
  }

  function finish(ok, why){
    busy=false;
    if(ok){
      L.won=true;
      blowUp();
      const last=L.idx>=STAGES.length-1;
      say(last ? t('🏅 You broke the shield! 32 invaders from 5 blocks — that is a nested loop.')
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
        `<li class="cur">🛡️ ${t('Shield')}: <b>${f.shield}</b> / ${f.max}`
        + (f.shield>0 && f.regrow ? ` <small>(+${f.regrow} ${t('after each volley')})</small>` : '')
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
