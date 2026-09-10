/* GENERATED — copied from public/code.js by tools/build-flightschool.js.
   Edit public/code.js and re-run `npm run build:flightschool`. */
/* =====================================================================
   CODE — block-based programming console.
   Students snap blocks together; a repeat block physically wraps the
   blocks inside it, so a loop LOOKS like a loop and there is no way to
   forget an "end". A side panel mirrors the blocks as real code text,
   which is the bridge to Python or JavaScript later.
   No eval() anywhere — blocks compile straight to a step list.
   ===================================================================== */
window.CODE = (function(){

  let script=[];            // nested block tree
  let el, paletteEl, scriptEl, textEl, tape, open=false, onRun=null;
  let guide=null;           // the walkthrough for the skill being taught
  let typed='';             // what the student wrote in Type-it mode
  let mode='blocks';
  try{ mode = localStorage.getItem('dq_codemode')==='text' ? 'text' : 'blocks'; }catch(e){}
  let dropTarget=null;      // repeat block currently accepting new blocks
  let uid=1;

  const DEF = {
    shoot    :{label:'shoot()',      color:'#ffb4a2', help:'Fire one shot where you are aiming'},
    grab     :{label:'grab()',       color:'#ffe9a8', help:'Pick up what you are standing on'},
    shootRed :{label:'shootRed()',   color:'#ff9aa2', help:'Fire a RED bolt — breaks red shields'},
    shootBlue:{label:'shootBlue()',  color:'#8fd3ff', help:'Fire a BLUE bolt — breaks blue shields'},
    wait     :{label:'wait()',       color:'#bdb2d8', help:'Pause for a moment'},
    repeat   :{label:'repeat',       color:'#cdb4f6', help:'Do the blocks inside, again and again'},
    ifc      :{label:'if',           color:'#a8e6cf', help:'Only do the blocks inside IF it is true'},
    call     :{label:'combo()',      color:'#ffe9a8', help:'Run the blocks you put in DEFINE combo'},
    define   :{label:'define combo', color:'#ffd8a8', help:'Teach the gun a move once, then call it'},
    forward  :{label:'forward()',    color:'#a8e6cf', help:'Walk forward one tile'},
    turn     :{label:'turn()',       color:'#8fd3ff', help:'Swing the camera a quarter turn'},
    hold     :{label:'hold()',       color:'#cdb4f6', help:'Keep it there'},
    left     :{label:'turnLeft()',   color:'#8fd3ff', help:'Turn a quarter turn left'},
    right    :{label:'turnRight()',  color:'#8fd3ff', help:'Turn a quarter turn right'},
    gas      :{label:'gas()',        color:'#ffd8a8', help:'Drive on one tile — faster every time in a row'},
    /* The flight deck. There are no direction words here on purpose: a move
       is arithmetic on a coordinate, and turning is arithmetic on an angle. */
    coast    :{label:'coast()',      color:'#bdb2d8', help:'Hold this lane for one wall'},
    turn     :{label:'turn',         color:'#ffd8a8', help:'Rotate the ship a quarter turn'},
    fire     :{label:'fire()',       color:'#ffb4a2', help:'Shoot straight ahead'},
    goTo     :{label:'goTo',         color:'#ffd8a8', help:'Jump to one exact lane, from anywhere'},
    /* Glide is goTo with the time put back in. Same pair of numbers, same
       "from anywhere" — but you watch it cross, so a coordinate stops being
       a place you appear at and becomes a place you go to. */
    glide    :{label:'glide to',     color:'#a8e6cf', help:'Move smoothly to that exact point'},
    /* THE REST OF MOTION.

       `move` walks the way the nose is pointing, which is the one block
       here that reads the heading rather than a coordinate — without it a
       turn is a decoration and everything is arithmetic on x and y.

       Two turn arrows rather than one signed number, because that is what
       is in front of a student in Scratch. The signed `turn` above is the
       same idea written once instead of twice, and is taught after these.

       `point in direction` is to a heading what `set x to` is to a
       coordinate: it does not add, it decides. DEGREES ARE COUNTERCLOCKWISE
       FROM EAST here, so 0 is right and 90 is up — the maths convention the
       rest of this mission is built on, and NOT Scratch's, where 90 is
       right. The help says so, because a number that means one thing in the
       lesson and another in the tool is worse than no block at all. */
    move     :{label:'move',         color:'#8fd3ff', unit:'steps',
               help:'Steps the way the nose is pointing'},
    turnR    :{label:'turn \u21bb',    color:'#ffd8a8', unit:'degrees',
               help:'Turn clockwise by that many degrees'},
    turnL    :{label:'turn \u21ba',    color:'#ffd8a8', unit:'degrees',
               help:'Turn counterclockwise by that many degrees'},
    point    :{label:'point in direction', color:'#ffd8a8',
               help:'Face that heading outright. 0 is East, 90 is North'},
    goRnd    :{label:'go to random position', color:'#cdb4f6',
               help:'Somewhere on the board, and you do not get to know where'},
    pointAt  :{label:'point towards the star', color:'#ffd8a8',
               help:'Turn to face the goal, wherever you are'},
    /* The coordinates. x is the column and y is the row, and the pair of
       verbs is the whole idea:
         set x to 2      put x there, whatever it was   (absolute)
         change x by 1   add to the x you already have  (relative)
       Same two numbers, two different sums — which is a plainer way to say
       absolute against relative than two arrangements of an equals sign. */
    setX     :{label:'set x to',     color:'#ffb4a2', help:'Put the ship in that column, wherever it was'},
    setY     :{label:'set y to',     color:'#a8e6cf', help:'Put the ship in that row, wherever it was'},
    addX     :{label:'change x by',  color:'#ffb4a2', help:'Add to the column you are in. Minus goes left'},
    addY     :{label:'change y by',  color:'#a8e6cf', help:'Add to the row you are in. Minus goes down'},
    /* The mech deck. Four of the seven verbs a mech needs already exist above
       — forward(), turnLeft(), turnRight() and shoot() mean in an arena
       exactly what they mean in a corridor — so only the three it adds are
       here. Reusing them is not a saving; it is the point. A student who
       learned forward() escaping a corridor should not have to learn a second
       word for the same idea to fight with it.

       No energy costs in the help text: what an action costs is a rule of the
       match, set per tournament, and a number written here would be a lie the
       moment somebody changed it. The arena shows the real ones. */
    back     :{label:'back()',       color:'#a8e6cf', help:'Reverse one tile, still facing the same way'},
    shield   :{label:'shield()',     color:'#8fd3ff', help:'Brace. Soaks damage until your next action'},
    dash     :{label:'dash()',       color:'#ffd8a8', help:'Two tiles forward at once — expensive, and it can overshoot'},
    /* The first loop whose length nobody knows when they write it. repeat 5
       is counted out at compile time; this one has to be tested every pass. */
    until    :{label:'repeat until', color:'#cdb4f6', help:'Keep doing the blocks inside until the test comes true'}
  };
  /* The shape of the language — which blocks carry a number, how a tree of
     them compiles, how many blocks it is — lives in program.js, because the
     referee of a PvP match has to compile a submitted program with exactly
     this code and has no screen to do it on. */
  const NUMBLK=PROGRAM.NUMBLK;
  /* how much one press of the counter is worth. An angle steps a quarter
     turn at a time, because a ship that can face 37 degrees is a ship nobody
     can reason about. */
  /* How far one press of a counter moves it. `turn` is a quarter by default
     because the flight only ever asks for quarters — but a mission that
     teaches angles has to be able to say otherwise, so it is settable. */
  const NUMSTEP={ setX:1, setY:1, addX:1, addY:1, turn:90,
                  move:1, turnR:90, turnL:90, point:90 };
  function setTurnStep(deg){
    const st=Math.max(1, Math.min(180, deg|0)) || 90;
    // every block that takes an angle steps by the same amount
    NUMSTEP.turn=NUMSTEP.turnR=NUMSTEP.turnL=NUMSTEP.point=st;
  }
  /* How far goTo is allowed to count. The console does not know how big any
     one mission's grid is, so the mission says. */
  /* THE GRID IS CENTRED ON ZERO. Three lanes are -1, 0 and 1, not 0, 1 and
     2, so the middle lane — the one you start in and come back to — is the
     origin. It also means set and change agree with each other: "set x to
     -1" and "change x by -1" both go left, and a child who has just spent
     three legs learning that minus means left is not then told that minus
     does not exist. */
  let GRID={ col:1, row:1 };
  function setGrid(cols, rows){
    GRID={ col:Math.floor(((cols||3)-1)/2), row:Math.floor(((rows||3)-1)/2) };
  }
  /* Every angle in the language is snapped to whatever this mission's turn
     step is — a quarter until a level says an angle is just a number, and
     then any of them. It used to live inside the `turn` parser; four blocks
     take an angle now. */
  const snapTurn = n => { const st=NUMSTEP.turn||90;
                          return clampN('turn', Math.round(n/st)*st); };
  const clampCol = n => Math.max(-GRID.col, Math.min(GRID.col, n));
  const clampRow = n => Math.max(-GRID.row, Math.min(GRID.row, n));
  /* what the counter on a coordinate block is allowed to reach */
  function numRange(type){
    if(type==='setX') return [-GRID.col, GRID.col];
    if(type==='setY') return [-GRID.row, GRID.row];
    if(type==='addX') return [-2*GRID.col, 2*GRID.col];
    if(type==='addY') return [-2*GRID.row, 2*GRID.row];
    /* Steps go along the heading, so how far one can reach is the DIAGONAL
       of the board rather than a side of it — the same allowance the two
       change blocks get. */
    if(type==='move') return [-2*Math.max(GRID.col,GRID.row), 2*Math.max(GRID.col,GRID.row)];
    if(type==='turn'||type==='turnR'||type==='turnL'||type==='point') return [-180, 180];
    return [0,0];
  }
  const clampN=(type,v)=>{ const [lo,hi]=numRange(type); return Math.max(lo,Math.min(hi,v)); };
  /* zero is not a turn, so the counter steps over it rather than resting on it */
  function bumpN(type, cur, dir){
    const step=NUMSTEP[type]||1;
    let v=clampN(type, cur + dir*step);
    if(type==='turn' && v===0) v=clampN(type, v + dir*step);
    return v;
  }
  /* WHAT AN `if` CAN TEST FOR. A mission hands over its own list, because a
     test only means something against the thing being fought: a boss has a
     shield that is red or blue, a mech has an enemy that is ahead or is not.

     The lead-in is part of it. "if target is red" reads properly in a duel
     with one target; "if target is enemy ahead" does not read at all, so the
     words in front of the dropdown belong to the mission too. Called with a
     plain list — which is what every mission before the arena does — nothing
     changes. */
  let CONDS=['red','blue'], CONDCOL={red:'#ff9aa2',blue:'#8fd3ff'};
  let IFLEAD='if target is', UNTILLEAD='repeat until';
  function setConditions(list, opts){
    opts=opts||{};
    const L = (list&&list.length) ? list : ['red','blue'];
    CONDS = L.map(c=>typeof c==='string' ? c : c.id);
    CONDCOL = {};
    L.forEach(c=>{ if(typeof c!=='string' && c.a) CONDCOL[c.id]=c.a; });
    if(!Object.keys(CONDCOL).length) CONDCOL={red:'#ff9aa2',blue:'#8fd3ff'};
    IFLEAD    = opts.lead  || 'if target is';
    UNTILLEAD = opts.until || 'repeat until';
  }
  const condColour = c => CONDCOL[c] || '#8fd3ff';

  /* ------------------------------------------------------------ model */
  /* WHAT A BLOCK STARTS AT.

     Every block that carries a number needs one, and this used to be a
     chain of ifs — a list somebody had to remember to add to. The four
     Motion blocks were added to NUMBLK and not to that chain, so `move`
     came off the shelf reading "move undefined steps": not an error, not a
     warning, just the word `undefined` in a box in front of a nine-year-old.

     A table with a fallback cannot do that. A block missing from it starts
     at zero, which may be the wrong number but is at least a number.

       x = 2 is a lane number and starts at the middle lane;
       x = x + 2 is a signed step and starts at one, because zero is a
       block that does nothing;
       an angle starts at a quarter turn, except `point in direction`,
       which is a heading rather than an amount and starts facing East. */
  const START={ setX:0, setY:0, addX:1, addY:1, turn:90,
                move:1, turnR:90, turnL:90, point:0 };
  /* The blocks whose number is a number of DEGREES, and which therefore
     snap to the mission's turn step. */
  const ANGLE={ turn:1, turnR:1, turnL:1, point:1 };

  function makeBlock(type){
    const b={id:uid++, type};
    if(type==='repeat'){ b.count=3; b.body=[]; }
    if(type==='ifc'){ b.cond=CONDS[0]; b.body=[]; }
    if(type==='until'){ b.cond=CONDS[0]; b.body=[]; }
    if(type==='define'){ b.body=[]; }
    if(type==='goTo'||type==='glide'){ b.col=0; b.row=0; }   // centre of a centred grid
    if(type==='glide') b.secs=1;
    if(NUMBLK[type]) b.n = START[type]===undefined ? 0 : START[type];
    return b;
  }
  function addBlock(type, n){
    if(budget && countBlocks()>=budget){
      hint(t('Out of blocks. Find a shorter way.'), 'err');
      if(window.beep) beep('bad');
      return;
    }
    const b=makeBlock(type);
    /* A pinned number. A walkthrough that says "click change y by 1" and
       then hands over a block reading 1 when the answer was -1 has taught
       the student to distrust it — so the shelf can carry the value as well
       as the block, and what arrives is what was promised. */
    if(n!==undefined && n!==null && 'n' in b) b.n=n;
    if(dropTarget && dropTarget.body) dropTarget.body.push(b);
    else script.push(b);
    if(window.beep) beep('pop');
    draw();
  }
  function removeBlock(id, list){
    list = list || script;
    for(let i=0;i<list.length;i++){
      if(list[i].id===id){ if(dropTarget&&dropTarget.id===id) dropTarget=null; list.splice(i,1); return true; }
      if(list[i].body && removeBlock(id, list[i].body)) return true;
    }
    return false;
  }
  // which container holds this block? used to step OUT one level
  function findParent(id, list, parent){
    list=list||script; parent=parent===undefined?null:parent;
    for(const b of list){
      if(b.id===id) return parent;
      if(b.body){ const f=findParent(id,b.body,b); if(f!==undefined&&f!==null) return f;
                  if(b.body.some(c=>c.id===id)) return b; }
    }
    return null;
  }
  function findBlock(id, list){
    list = list || script;
    for(const b of list){
      if(b.id===id) return b;
      if(b.body){ const f=findBlock(id,b.body); if(f) return f; }
    }
    return null;
  }

  /* ------------------------------------------------- compile + text */
  /* The tree becomes a flat list of steps in program.js. `script` is passed
     as the root as well as the list, so a call() finds its define wherever
     in the program either of them was written. */
  function compile(list){ return PROGRAM.compile(list||script, { root:script }); }

  function toText(list, depth){
    list=list||script; depth=depth||0;
    const pad='  '.repeat(depth);
    let s=[];
    for(const b of list){
      if(b.type==='repeat'){
        s.push(pad+'repeat '+b.count);
        s=s.concat(toText(b.body, depth+1)); s.push(pad+'end');
      } else if(b.type==='ifc'){
        s.push(pad+IFLEAD+' '+b.cond);
        s=s.concat(toText(b.body, depth+1)); s.push(pad+'end');
      } else if(b.type==='until'){
        s.push(pad+UNTILLEAD+' '+b.cond);
        s=s.concat(toText(b.body, depth+1)); s.push(pad+'end');
      } else if(b.type==='define'){
        s.push(pad+'define combo');
        s=s.concat(toText(b.body, depth+1)); s.push(pad+'end');
      } else if(b.type==='goTo'){
        s.push(pad+'goto '+b.col+','+b.row);
      } else if(b.type==='glide'){
        s.push(pad+'glide '+(b.secs===undefined?1:b.secs)+' secs to '+b.col+','+b.row);
      } else if(b.type==='setX'||b.type==='setY'){
        s.push(pad+'set '+(b.type==='setX'?'x':'y')+' to '+b.n);
      } else if(b.type==='addX'||b.type==='addY'){
        s.push(pad+'change '+(b.type==='addX'?'x':'y')+' by '+b.n);
      } else if(b.type==='turn'){
        s.push(pad+'turn '+b.n);
      } else if(b.type==='move'){
        s.push(pad+'move '+b.n+' steps');
      } else if(b.type==='turnR'){
        s.push(pad+'turn right '+b.n);
      } else if(b.type==='turnL'){
        s.push(pad+'turn left '+b.n);
      } else if(b.type==='point'){
        s.push(pad+'point in direction '+b.n);
      } else s.push(pad+DEF[b.type].label);
    }
    return s;
  }

  /* -------------------------------------------------- typing it out
     The same program, written as words.  Parsing back into the very same
     block tree is what keeps the two halves honest: whatever you type has
     to be something you could have built, and it runs down one code path. */
  const BY_WORD = {};
  Object.keys(DEF).forEach(k=>{
    if(k==='repeat'||k==='ifc'||k==='until'||k==='define'||k==='goTo'
       ||k==='glide'||NUMBLK[k]) return;
    BY_WORD[DEF[k].label.toLowerCase()] = k;
  });
  const palOps = () => palette.map(p => (typeof p==='string') ? p : p.op);
  function allowed(type){ return palOps().indexOf(type) >= 0; }

  /* "if target is red" and "if enemy ahead" are the same line with different
     words in front, so the matcher is built from whatever those words are.
     Escaped, because a mission is allowed to put punctuation in them. */
  function leadRe(lead){
    return new RegExp('^'+String(lead).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' +(.+)$');
  }
  function parse(text){
    const out=[], stack=[], lines=String(text||'').split('\n');
    const put=b=>{ (stack.length ? stack[stack.length-1].body : out).push(b); };
    const bad=(i,msg)=>({ error:{ line:i+1, msg } });

    for(let i=0;i<lines.length;i++){
      const raw=lines[i].trim();
      if(!raw || raw[0]==='#') continue;
      const low=raw.toLowerCase().replace(/\s+/g,' ');

      if(low==='end'){
        if(!stack.length) return bad(i, t('This <b>end</b> has nothing open above it.'));
        stack.pop(); continue;
      }
      let m;
      if((m=low.match(/^repeat +(\d+)$/))){
        if(!allowed('repeat')) return bad(i, t('<b>repeat</b> is not in this mission yet.'));
        const b=makeBlock('repeat'); b.count=Math.max(1,Math.min(20,+m[1]));
        put(b); stack.push(b); continue;
      }
      if((m=low.match(leadRe(UNTILLEAD)))){
        if(!allowed('until')) return bad(i, t('<b>repeat until</b> is not in this mission yet.'));
        if(CONDS.indexOf(m[1])<0)
          return bad(i, t('<b>{w}</b> is not something you can test for here.',{w:m[1]}));
        const b=makeBlock('until'); b.cond=m[1]; put(b); stack.push(b); continue;
      }
      if(low==='repeat') return bad(i, t('<b>repeat</b> needs a number after it, like <b>repeat 3</b>.'));
      if((m=low.match(leadRe(IFLEAD)))){
        if(!allowed('ifc')) return bad(i, t('<b>if</b> is not in this mission yet.'));
        if(CONDS.indexOf(m[1])<0)
          return bad(i, t('<b>{w}</b> is not something you can test for here.',{w:m[1]}));
        const b=makeBlock('ifc'); b.cond=m[1]; put(b); stack.push(b); continue;
      }
      if(low===IFLEAD.toLowerCase() || low==='if')
        return bad(i, t('Write the whole test, like <b>{w}</b>.',{w:IFLEAD+' '+CONDS[0]}));
      /* A COORDINATE CAN BE NEGATIVE. GRID holds a HALF-width — `set x to`
         has always ranged over -GRID.col..GRID.col — and yet the two blocks
         that take a whole coordinate would not read a minus sign and
         clamped the number at zero. On a four-quadrant board that is three
         quarters of the plane you cannot name; in Space Explorer, whose
         goTo is measured from the middle lane, it was half the field. */
      /* Both spellings: Scratch's "glide 2 secs to 3,-1" and the short
         "glide to 3,-1", which is the same block with the seconds left at
         one. Somebody copying the palette should be right, and so should
         somebody who has stopped looking at it. */
      if((m=low.match(/^glide +(\d+) +secs? +to +(-?\d+) *, *(-?\d+)$/))){
        if(!allowed('glide')) return bad(i, t('<b>glide</b> is not in this mission yet.'));
        const b=makeBlock('glide');
        b.secs=Math.max(1,Math.min(9,+m[1]));
        b.col=clampCol(+m[2]); b.row=clampRow(+m[3]);
        put(b); continue;
      }
      if((m=low.match(/^glide +to +(-?\d+) *, *(-?\d+)$/))){
        if(!allowed('glide')) return bad(i, t('<b>glide</b> is not in this mission yet.'));
        const b=makeBlock('glide');
        b.secs=1; b.col=clampCol(+m[1]); b.row=clampRow(+m[2]);
        put(b); continue;
      }
      if((m=low.match(/^goto +(-?\d+) *, *(-?\d+)$/))){
        if(!allowed('goTo')) return bad(i, t('<b>goTo</b> is not in this mission yet.'));
        const b=makeBlock('goTo');
        b.col=clampCol(+m[1]); b.row=clampRow(+m[2]);
        put(b); continue;
      }
      if(low==='goto') return bad(i, t('<b>goTo</b> needs a column and a row, like <b>goto 1,-1</b>.'));
      if((m=low.match(/^change +([xy]) +by +(-?\d+)$/))){
        const type=m[1]==='x'?'addX':'addY';
        if(!allowed(type)) return bad(i, t('<b>{w}</b> is not in this mission yet.',{w:'change '+m[1]+' by'}));
        const b=makeBlock(type); b.n=clampN(type, +m[2]); put(b); continue;
      }
      if((m=low.match(/^set +([xy]) +to +(-?\d+)$/))){
        const type=m[1]==='x'?'setX':'setY';
        if(!allowed(type)) return bad(i, t('<b>{w}</b> is not in this mission yet.',{w:'set '+m[1]+' to'}));
        const b=makeBlock(type); b.n=clampN(type, +m[2]); put(b); continue;
      }
      // the equation forms still read, for anyone who prefers writing them
      if((m=low.match(/^([xy]) *= *\1 *([+-]) *(\d+)$/))){
        const type=m[1]==='x'?'addX':'addY';
        if(!allowed(type)) return bad(i, t('<b>{w}</b> is not in this mission yet.',{w:m[1]+' = '+m[1]+' + 1'}));
        const b=makeBlock(type);
        b.n=clampN(type, (m[2]==='-'?-1:1)*(+m[3]));
        put(b); continue;
      }
      if((m=low.match(/^([xy]) *= *(-?\d+)$/))){
        const type=m[1]==='x'?'setX':'setY';
        if(!allowed(type)) return bad(i, t('<b>{w}</b> is not in this mission yet.',{w:m[1]+' = 1'}));
        const b=makeBlock(type); b.n=clampN(type, +m[2]);
        put(b); continue;
      }
      /* MOVE, THE TWO ARROWS, AND POINTING.

         Scratch writes "move 10 steps" and "turn 15 degrees"; the trailing
         noun is optional here, because a student copying off the palette
         will type it and a student typing from memory will not, and being
         right about which is not the lesson. */
      if((m=low.match(/^move +(-?\d+)( +steps?)?$/))){
        if(!allowed('move')) return bad(i, t('<b>move</b> is not in this mission yet.'));
        const b=makeBlock('move'); b.n=clampN('move', +m[1]); put(b); continue;
      }
      if(low==='move') return bad(i, t('<b>move</b> needs a number, like <b>move 3 steps</b>.'));
      if((m=low.match(/^turn +(right|cw|\u21bb) +(-?\d+)( +deg(rees?)?)?$/))){
        if(!allowed('turnR')) return bad(i, t('<b>turn \u21bb</b> is not in this mission yet.'));
        const b=makeBlock('turnR'); b.n=snapTurn(+m[2]); put(b); continue;
      }
      if((m=low.match(/^turn +(left|ccw|\u21ba) +(-?\d+)( +deg(rees?)?)?$/))){
        if(!allowed('turnL')) return bad(i, t('<b>turn \u21ba</b> is not in this mission yet.'));
        const b=makeBlock('turnL'); b.n=snapTurn(+m[2]); put(b); continue;
      }
      if((m=low.match(/^point +in +direction +(-?\d+)$/))){
        if(!allowed('point')) return bad(i, t('<b>point in direction</b> is not in this mission yet.'));
        const b=makeBlock('point'); b.n=snapTurn(+m[1]); put(b); continue;
      }
      if((m=low.match(/^turn +(-?\d+)$/))){
        if(!allowed('turn')) return bad(i, t('<b>turn</b> is not in this mission yet.'));
        const b=makeBlock('turn');
        /* Snapped to whatever this mission's turn step is, not always to a
           quarter. Rounding every angle to 90 meant a level about 45° could
           not be written down. */
        b.n=snapTurn(+m[1]) || (NUMSTEP.turn||90);
        put(b); continue;
      }
      if(low==='turn') return bad(i, t('<b>turn</b> needs an angle, like <b>turn 90</b>.'));
      if(/^(change|set) +[xy]/.test(low) || /^[xy] *=/.test(low))
        return bad(i, t('Write the whole line, like <b>change x by 1</b> or <b>set x to 2</b>.'));
      if(low==='define combo'){
        if(!allowed('define')) return bad(i, t('<b>define combo</b> is not in this mission yet.'));
        const b=makeBlock('define'); put(b); stack.push(b); continue;
      }
      const type = BY_WORD[low] || BY_WORD[low.replace(/ /g,'')];
      if(!type) return bad(i, t('The console does not know <b>{w}</b>. Click a word on the left.',{w:raw}));
      if(!allowed(type)) return bad(i, t('<b>{w}</b> is not in this mission yet.',{w:DEF[type].label}));
      put(makeBlock(type));
    }
    if(stack.length) return { error:{ line:lines.length,
      msg: t('An <b>end</b> is missing — something is still open.') } };
    return { script:out };
  }

  /* --------------------------------------------------------- console */
  function build(){
    el=document.createElement('div'); el.id='console'; el.className='hidden';
    el.innerHTML=`
      <div class="con-card">
        <div class="con-head"><b id="conTitle"></b>
          <span class="con-mode">
            <button class="modebtn" id="conModeB"></button>
            <button class="modebtn" id="conModeT"></button>
          </span>
          <button class="btn small ghost" id="conClose">✕</button></div>
        <div id="conGuide" class="hidden"></div>
        <!-- where the walkthrough talks while the console is open. A card
             floating over the middle of the screen is a card covering the
             thing it is telling you to click. -->
        <div id="conCoach" class="hidden"></div>
        <div class="con-body">
          <div class="con-col">
            <div class="con-lbl" id="conPalLbl"></div>
            <div id="conPalette"></div>
          </div>
          <div class="con-col grow">
            <div class="con-lbl" id="conScriptLbl"></div>
            <div id="conScript"></div>
            <textarea id="conTA" class="hidden" spellcheck="false" autocapitalize="off"
                      autocomplete="off" autocorrect="off"></textarea>
          </div>
          <div class="con-col">
            <div class="con-lbl" id="conTextLbl"></div>
            <pre id="conText"></pre>
            <div id="conMirror" class="hidden"></div>
            <div id="conAside" class="hidden"></div>
          </div>
        </div>
        <div class="con-foot">
          <span><span class="con-budget hidden" id="conBudget"></span>
          <span class="con-hint" id="conHint"></span></span>
          <span>
            <button class="btn small ghost" id="conClear"></button>
            <button class="btn good" id="conRun"></button>
          </span>
        </div>
      </div>`;
    document.body.appendChild(el);
    paletteEl=el.querySelector('#conPalette');
    scriptEl =el.querySelector('#conScript');
    textEl   =el.querySelector('#conText');
    el.querySelector('#conClose').onclick=close;
    el.querySelector('#conClear').onclick=()=>{ script=[]; typed=''; dropTarget=null; draw(); };
    el.querySelector('#conRun').onclick=run;
    el.querySelector('#conModeB').onclick=()=>setMode('blocks');
    el.querySelector('#conModeT').onclick=()=>setMode('text');
    const ta=el.querySelector('#conTA');
    ta.addEventListener('input',()=>{ typed=ta.value; reflect(); });
    // the console owns the keyboard while you are typing in it
    ta.addEventListener('keydown',e=>{
      e.stopPropagation();
      if(e.key==='Tab'){ e.preventDefault(); insertWord('  ', true); }
    });
    tape=document.createElement('div'); tape.id='tape'; tape.className='hidden';
    document.body.appendChild(tape);
  }

  let palette=['shoot','repeat'];
  let budget=0;
  /* Redraw if the console is already open. Missions set the palette before
     showing the console, so this never mattered — until a walkthrough began
     changing it step by step with the console up, and the narrowing only
     appeared after the student happened to click something else. */
  function setPalette(list){
    /* A palette is a fresh mission, so the turn counter goes back to
       quarters. Otherwise Flight School's forty-fives follow the student
       into Space Explorer, where every turn is a quarter and a 45 is a
       crash — a setting leaking out of the mission that set it. */
    setTurnStep(90);
    const key=v=>JSON.stringify(v);
    const same = palette && list && palette.length===list.length
              && palette.every((x,i)=>key(x)===key(list[i]));
    palette=list;
    if(!same && el && isOpen()) draw();
  }
  function setBudget(n){ budget=n||0; }
  /* ------------------------------------------------------------- the rails
     A walkthrough that only SUGGESTS what to press is a walkthrough a
     nine-year-old walks straight past. While one is running, the console can
     be put on rails: the palette is already cut to the one block being asked
     for, and this shuts the buttons that would take you somewhere else.

     Off by default, and cleared the moment the walkthrough ends, because
     this is a teaching aid and not a way of running the game. */
  /* THE THIRD COLUMN. By default it mirrors your blocks back as text, which
     is what "YOUR CODE SAYS" means. A mission can take it over instead —
     Space Explorer puts the field itself there, because the answer to "what
     do I write" is the wall in front of you and it should be at your elbow
     while you write rather than behind the console. */
  let aside=null;
  function setAside(label, html){
    const had=!!aside, lbl=aside?aside.label:null;
    aside = (html==null) ? null : { label:label||'', html };
    if(!el || !open) return;
    /* Only redraw the WHOLE console when the column changes hands. Once an
       aside is installed, later content goes straight into it — a mission
       updating its panel every time a block moves must not take the palette
       and the script list down and put them back up with it, and anything
       animating inside the column would be wiped mid-flight if it did. */
    if(had && aside && aside.label===lbl){
      const av=el.querySelector('#conAside');
      if(av){ av.innerHTML=aside.html; return; }
    }
    draw();
  }
  const asideEl = () => (el && open && aside) ? el.querySelector('#conAside') : null;
  /* The console lends this strip to the walkthrough while it is open, and
     takes it back the moment it closes — so a step that happens out in the
     world still gets a card on screen to say so. */
  const coachHost = () => (el && open) ? el.querySelector('#conCoach') : null;

  let rails={};
  function setRails(r){ rails=r||{}; if(el) drawRails(); }
  function drawRails(){
    if(!el) return;
    [['run','#conRun'],['clear','#conClear'],
     ['mode','#conModeB'],['mode','#conModeT']].forEach(([k,q])=>{
      const b=el.querySelector(q); if(!b) return;
      const off = rails[k]===false;
      b.disabled=off;
      b.classList.toggle('railed', off);
    });
  }
  function countBlocks(list){ return PROGRAM.countBlocks(list||script); }

  function blockHTML(b, readonly){
    const d=DEF[b.type];
    if(b.type==='ifc' || b.type==='until' || b.type==='define'){
      const isTarget = dropTarget && dropTarget.id===b.id;
      /* if and repeat-until are the same block wearing different words: a
         test, then a body. Only the lead-in tells them apart, which is
         exactly the difference — one asks once, the other keeps asking. */
      const test = (lead)=>`<span class="blk-name">${t(lead)}</span>
           ${readonly?`<span class="cnt-n">${t(b.cond)}</span>`
             :`<button class="cond" data-act="cond" data-id="${b.id}" style="--sw:${condColour(b.cond)}">${t(b.cond)}</button>`}`;
      const head = b.type==='ifc'   ? test(IFLEAD)
                 : b.type==='until' ? test(UNTILLEAD)
                 : `<span class="blk-name">${t('define combo')}</span>`;
      return `<div class="blk rep ${isTarget?'target':''}" data-id="${b.id}" style="--c:${d.color}">
          <div class="blk-head">${head}
            ${readonly?'':`<button class="blk-x" data-act="del" data-id="${b.id}">✕</button>`}</div>
          <div class="blk-body" data-body="${b.id}">${b.body.map(c=>blockHTML(c,readonly)).join('') ||
            (readonly?'':`<div class="blk-empty">${t('put blocks here')}</div>`)}</div>
          <div class="blk-foot"></div>
        </div>`;
    }
    if(b.type==='repeat'){
      const isTarget = dropTarget && dropTarget.id===b.id;
      return `<div class="blk rep ${isTarget?'target':''}" data-id="${b.id}" style="--c:${d.color}">
          <div class="blk-head">
            <span class="blk-name">${t('repeat')}</span>
            ${readonly?'':`<button class="cnt" data-act="dec" data-id="${b.id}">−</button>`}
            <span class="cnt-n" data-count="${b.id}">${b.count}</span>
            ${readonly?'':`<button class="cnt" data-act="inc" data-id="${b.id}">+</button>`}
            <span class="blk-times">${t('times')}</span>
            <span class="iter" data-iter="${b.id}"></span>
            ${readonly?'':`<button class="blk-x" data-act="del" data-id="${b.id}">✕</button>`}
          </div>
          <div class="blk-body" data-body="${b.id}">
            ${b.body.map(c=>blockHTML(c,readonly)).join('') ||
              (readonly?'':`<div class="blk-empty">${t('put blocks here')}</div>`)}
          </div>
          <div class="blk-foot"></div>
        </div>`;
    }
    if(NUMBLK[b.type]){
      /* The number is TYPED. A pair of stepper buttons made "change y by -1"
         render as "y = y + [-] -1 [+]", which is two operators and a widget
         where a child wanted to write minus one. A box you type in says what
         it is. */
      return `<div class="blk num" data-id="${b.id}" style="--c:${d.color}">
          <span class="blk-name">${t(d.label)}</span>
          ${readonly ? `<span class="cnt-n">${b.n}</span>`
            : `<input class="numin" type="text" inputmode="numeric"
                 data-num="${b.id}" value="${b.n}" size="3"
                 aria-label="${t(d.label)}">`}
          ${d.unit ? `<span class="blk-times">${t(d.unit)}</span>` : ''}
          ${readonly?'':`<button class="blk-x" data-act="del" data-id="${b.id}">✕</button>`}
        </div>`;
    }
    if(b.type==='goTo'||b.type==='glide'){
      /* A BOX YOU TYPE IN, not a pair of arrows.

         These were two little steppers on the argument that a child can
         read a lane off the screen and click to it, and that it cannot go
         out of bounds by construction. On a nine-wide four-quadrant board
         that argument stops paying: getting from 0 to -4 is four clicks on
         a button the size of a fingernail, and every other number in this
         language — every `change x by`, every `turn` — is already typed. It
         is also the shape Scratch uses, which is the shape these students
         have open in the other window. Bounds are enforced on the way out
         instead of by construction. */
      const num=(field,val,lead)=>
        (lead?`<span class="blk-times">${lead}</span>`:'')
        + (readonly ? `<span class="cnt-n">${val}</span>`
          : `<input class="numin" type="text" inputmode="numeric"
               data-num="${b.id}" data-field="${field}" value="${val}" size="3"
               aria-label="${t(d.label)} ${lead||field}">`);
      /* Glide carries a THIRD number: how long it takes. goTo does not,
         because goTo is the one that does not take any time — that is the
         whole difference between them and the seconds are where it shows. */
      const secs = b.type!=='glide' ? '' :
        num('secs', b.secs===undefined?1:b.secs) + `<span class="blk-times">${t('secs to')}</span>`;
      return `<div class="blk" data-id="${b.id}" style="--c:${d.color}">
          <span class="blk-name">${b.type==='glide'?t('glide'):d.label}</span>
          ${secs}${num('col', b.col, 'x:')}${num('row', b.row, 'y:')}
          ${readonly?'':`<button class="blk-x" data-act="del" data-id="${b.id}">✕</button>`}
        </div>`;
    }
    return `<div class="blk" data-id="${b.id}" style="--c:${d.color}">
        <span class="blk-name">${d.label}</span>
        ${readonly?'':`<button class="blk-x" data-act="del" data-id="${b.id}">✕</button>`}
      </div>`;
  }

  /* the walkthrough, so the thing you are copying is in front of you while
     you write it instead of behind the console */
  function drawGuide(){
    const g=el.querySelector('#conGuide');
    if(!guide || !(guide.brief||guide.name||guide.text||guide.code)){
      g.classList.add('hidden'); return;
    }
    g.classList.remove('hidden');
    const skill = (guide.name||guide.text)
      ? `<div class="cg-skill"><b>${t(guide.name||'')}</b>${t(guide.text||'')}</div>` : '';
    g.innerHTML=`<div class="con-lbl">${t('WHAT YOU ARE WRITING')}</div>
      <div class="cg-row">
        <div class="cg-txt">
          ${guide.brief ? `<div class="cg-brief">${t(guide.brief)}</div>` : ''}
          ${skill}
        </div>
        ${guide.code ? `<pre class="cg-code">${guide.code}</pre>` : ''}
      </div>`;
  }
  function hint(msg, kind){
    if(!el) return;
    const h=el.querySelector('#conHint');
    h.className='con-hint'+(kind?' '+kind:'');
    h.innerHTML=msg;
  }
  function budgetOut(n){
    if(!el) return;
    const bl=el.querySelector('#conBudget');
    if(!budget){ bl.classList.add('hidden'); return; }
    bl.classList.remove('hidden');
    bl.innerHTML=`${t('Blocks')}: <b class="${n>budget?'over':''}">${n}/${budget}</b>`;
  }

  /* Type-it mode reads what you wrote after every keystroke and shows the
     blocks it would build — so a typo is caught where you made it. */
  function reflect(){
    if(mode!=='text' || !el) return;
    const mirror=el.querySelector('#conMirror');
    const r=parse(typed);
    if(r.error){
      hint(t('Line {n}',{n:r.error.line})+': '+r.error.msg, 'err');
      mirror.innerHTML=`<div class="blk-empty">${t('Fix that line and this fills in.')}</div>`;
      return;
    }
    const n=countBlocks(r.script);
    mirror.innerHTML = r.script.length ? r.script.map(b=>blockHTML(b,true)).join('')
      : `<div class="blk-empty">${t('Nothing yet.')}</div>`;
    budgetOut(n);
    if(budget && n>budget) hint(t('That is {a} blocks — the budget is {b}.',{a:n,b:budget}), 'err');
    else hint(t('{n} instruction(s).',{n}), 'ok');
  }

  function setMode(m){
    if(m===mode) return;
    if(m==='text'){
      typed = toText().join('\n');          // carry the blocks over as words
      mode='text';
    } else {
      const r=parse(typed);                 // and carry the words back as blocks
      if(r.error){
        hint(t('Line {n}',{n:r.error.line})+': '+r.error.msg+' '+
             t('It has to read before it can be blocks.'), 'err');
        if(window.beep) beep('bad');
        return;
      }
      script=r.script; dropTarget=null; mode='blocks';
    }
    try{ localStorage.setItem('dq_codemode', mode); }catch(e){}
    if(!el) return;                       // the console can be set before it is built
    draw();
    if(mode==='text'){ const ta=el.querySelector('#conTA'); ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length); }
  }

  function insertWord(w, literal){
    const ta=el.querySelector('#conTA'); if(!ta) return;
    const a=ta.selectionStart, b=ta.selectionEnd, v=ta.value;
    const before=v.slice(0,a), after=v.slice(b);
    // a word lands on its own line, because that is how the program reads
    const ins = literal ? w : ((before && !/\n$/.test(before)) ? '\n' : '') + w;
    ta.value = before + ins + after;
    typed = ta.value;
    const at=(before+ins).length;
    ta.focus(); ta.setSelectionRange(at, at);
    reflect();
  }
  /* the word bank is the block palette, spelled out */
  function words(){
    const out=[];
    // the word bank speaks in ops; a pinned shelf entry is still just its op
    palOps().forEach(type=>{
      const d=DEF[type]; if(!d) return;
      if(type==='repeat')      out.push({w:'repeat 3', c:d.color});
      else if(type==='ifc')    CONDS.forEach(c=>out.push({w:IFLEAD+' '+c, c:d.color}));
      else if(type==='until')  CONDS.forEach(c=>out.push({w:UNTILLEAD+' '+c, c:d.color}));
      else if(type==='define') out.push({w:'define combo', c:d.color});
      else if(type==='goTo')   out.push({w:'goto 0,0', c:d.color});
      else if(type==='setX')   out.push({w:'set x to 1', c:d.color});
      else if(type==='setY')   out.push({w:'set y to 1', c:d.color});
      else if(type==='addX'){  out.push({w:'change x by 1', c:d.color});
                               out.push({w:'change x by -1', c:d.color}); }
      else if(type==='addY'){  out.push({w:'change y by 1', c:d.color});
                               out.push({w:'change y by -1', c:d.color}); }
      else if(type==='turn'){  out.push({w:'turn 90', c:d.color});
                               out.push({w:'turn -90', c:d.color}); }
      else if(type==='glide'){ out.push({w:'glide 1 secs to 0,0', c:d.color}); }
      else if(type==='move'){  out.push({w:'move 1 steps', c:d.color});
                               out.push({w:'move -1 steps', c:d.color}); }
      else if(type==='turnR'){ out.push({w:'turn right 90', c:d.color}); }
      else if(type==='turnL'){ out.push({w:'turn left 90', c:d.color}); }
      else if(type==='point'){ out.push({w:'point in direction 0', c:d.color});
                               out.push({w:'point in direction 90', c:d.color}); }
      else                     out.push({w:d.label, c:d.color});
    });
    if(palOps().some(p=>p==='repeat'||p==='ifc'||p==='until'||p==='define'))
      out.push({w:'end', c:'#5a4b85'});
    return out;
  }

  function draw(){
    const typing = mode==='text';
    el.querySelector('#conTitle').textContent=t('CODE CONSOLE');
    el.querySelector('#conModeB').textContent=t('Blocks');
    el.querySelector('#conModeT').textContent=t('Type it');
    el.querySelector('#conModeB').classList.toggle('on', !typing);
    el.querySelector('#conModeT').classList.toggle('on', typing);
    el.querySelector('#conPalLbl').textContent    = typing ? t('WORD BANK') : t('BLOCKS');
    el.querySelector('#conScriptLbl').textContent = typing ? t('YOUR CODE')  : t('YOUR PROGRAM');
    /* An aside owns the column outright: label, mirror and all. Leaving
       "YOUR CODE SAYS" sitting above somebody else's panel is how a heading
       ends up describing the thing underneath it and being wrong. */
    const asideOn=!!aside;
    const av=el.querySelector('#conAside');
    av.classList.toggle('hidden', !asideOn);
    if(asideOn) av.innerHTML=aside.html;
    el.querySelector('#conTextLbl').textContent =
      asideOn ? aside.label : (typing ? t('THAT IS THESE BLOCKS') : t('YOUR CODE SAYS'));
    el.querySelector('#conClear').textContent=t('Clear');
    el.querySelector('#conRun').textContent=t('▶ RUN');
    drawRails();
    drawGuide();

    scriptEl.classList.toggle('hidden', typing);
    // an aside has already taken this column; typing mode must not hand it back
    textEl.classList.toggle('hidden', typing || !!aside);
    el.querySelector('#conTA').classList.toggle('hidden', !typing);
    el.querySelector('#conMirror').classList.toggle('hidden', !typing);

    if(typing) drawTyping(); else drawBlocks();
  }

  function drawTyping(){
    paletteEl.className='wordbank';
    paletteEl.innerHTML=words().map(w=>
      `<button class="word" data-w="${w.w}" style="--c:${w.c}">${w.w}</button>`).join('');
    paletteEl.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>insertWord(b.dataset.w));
    const ta=el.querySelector('#conTA');
    ta.value=typed;
    ta.placeholder=t('One instruction per line.');
    reflect();
  }

  function drawBlocks(){
    paletteEl.className='';
    hint(dropTarget
      ? t('Blocks go inside the repeat.')
      : t('Click a block to add it.'));
    budgetOut(countBlocks());

    /* A shelf entry is either a block type or a type WITH the number already
       in it. The second form is what a walkthrough uses to hand somebody the
       answer rather than describing it. */
    paletteEl.innerHTML=palette.map(it=>{
      const type=(typeof it==='string') ? it : it.op;
      const pin =(typeof it==='string') ? null : it.n;
      const d=DEF[type];
      const num = v => (pin===null||pin===undefined) ? v : pin;
      return `<button class="palblk${pin!==null&&pin!==undefined?' pinned':''}"
          data-add="${type}"${pin!==null&&pin!==undefined?` data-n="${pin}"`:''}
          style="--c:${d.color}">
        <b>${type==='repeat'?t('repeat')+' '+num(3)
             :type==='until'?t(UNTILLEAD)+' '+t(CONDS[0])
             :type==='ifc'?t(IFLEAD)+' '+t(CONDS[0])
             :type==='goTo'?t('goTo')+' 0,0'
             :type==='glide'?t('glide to')+' 0,0'
             :type==='addX'?t('change x by')+' '+num(1):type==='addY'?t('change y by')+' '+num(1)
             :type==='setX'?t('set x to')+' '+num(0):type==='setY'?t('set y to')+' '+num(0)
             :type==='turn'?t('turn')+' '+num(90)
             :type==='move'?t('move')+' '+num(1)+' '+t('steps')
             :type==='turnR'?t('turn \u21bb')+' '+num(90)
             :type==='turnL'?t('turn \u21ba')+' '+num(90)
             :type==='point'?t('point in direction')+' '+num(0)
             :t(d.label)}</b>
        <small>${t(d.help)}</small></button>`;
    }).join('');
    paletteEl.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>
      addBlock(b.dataset.add, b.dataset.n===undefined ? undefined : +b.dataset.n));

    scriptEl.innerHTML = script.length ? script.map(b=>blockHTML(b,false)).join('')
      : `<div class="blk-empty big">${t('Click a block on the left.')}</div>`;
    scriptEl.querySelectorAll('[data-act]').forEach(btn=>{
      btn.onclick=e=>{
        e.stopPropagation();
        const b=findBlock(+btn.dataset.id);
        if(btn.dataset.act==='del') removeBlock(+btn.dataset.id);
        if(btn.dataset.act==='inc' && b) b.count=Math.min(20,b.count+1);
        if(btn.dataset.act==='dec' && b) b.count=Math.max(1,b.count-1);
        if(btn.dataset.act==='cond' && b) b.cond = CONDS[(CONDS.indexOf(b.cond)+1)%CONDS.length];

        draw();
      };
    });
    /* The typed numbers. Value goes in on every keystroke so the mission's
       own preview keeps up, but the block is NOT redrawn until you leave the
       box — redrawing mid-word would take the caret away with it. */
    scriptEl.querySelectorAll('input[data-num]').forEach(inp=>{
      /* Which number this box is. Most blocks carry one and call it `n`;
         goTo and glide carry two or three, so the box says which. */
      const field = inp.dataset.field || 'n';
      const fit = (b, v) => {
        if(field==='col')  return clampCol(v);
        if(field==='row')  return clampRow(v);
        if(field==='secs') return Math.max(1, Math.min(9, v));
        return clampN(b.type, v);
      };
      inp.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') inp.blur(); };
      inp.onclick=e=>e.stopPropagation();
      inp.oninput=()=>{
        const b=findBlock(+inp.dataset.num); if(!b) return;
        const v=parseInt(inp.value,10);
        if(!isNaN(v)) b[field]=fit(b, v);          // a lone "-" waits for a digit
        textEl.textContent=toText().join('\n') || '—';
      };
      inp.onblur=()=>{
        const b=findBlock(+inp.dataset.num); if(!b) return;
        let v=parseInt(inp.value,10);
        if(isNaN(v)) v=b[field];
        /* Angles snap to THIS MISSION'S turn step, not always to a quarter.
           It used to be hardcoded to 90 for `turn` alone, so on the level
           that exists to say an angle is just a number, typing 45 into the
           box put 90 back — the one place in the game where the lesson and
           the tool disagreed outright. And the three other blocks that take
           an angle did not snap at all. */
        if(field==='n' && ANGLE[b.type]){
          const st=NUMSTEP[b.type]||90;
          v=Math.round(v/st)*st;
          // zero degrees is a block that does nothing; the smallest turn is one step
          if(v===0 && b.type!=='point') v=st;
        }
        b[field]=fit(b, v);
        draw();
      };
    });
    wireDrag();
    drawBlame();
    scriptEl.querySelectorAll('.blk.rep, .blk.ifc, .blk.define').forEach(node=>{
      node.onclick=e=>{
        e.stopPropagation();
        const b=findBlock(+node.dataset.id);
        // clicking the container you are already inside steps OUT one level,
        // back to the loop that holds it — not all the way to the top
        dropTarget = (dropTarget && dropTarget.id===b.id) ? findParent(b.id) : b;
        draw();
      };
    });
    textEl.textContent=toText().join('\n') || '—';
  }

  /* ------------------------------------------------------------ dragging
     Blocks could only be added to the end and taken away again. That is
     fine for the first program anybody writes and hopeless for the second:
     realising the coast belongs BEFORE the turn meant deleting everything
     after it and typing it again, which teaches that a mistake is expensive
     rather than that order is the whole idea.

     So they drag. Pointer events, not HTML5 drag-and-drop, because that
     does not fire on a touch screen and half of these are used on tablets.
     A copy of the block follows the finger and a line shows the gap it
     would drop into, so the answer to "where will this land" is on screen
     before you let go rather than after.

     A drag begins only after the pointer has actually MOVED. Without that,
     every tap on a repeat block would be a one-pixel drag and the tap that
     is supposed to open it for nesting would be eaten. */
  const DRAG_SLOP=5;
  let drag=null;

  function listOf(id){                    // the array a block lives in
    let found=null;
    (function walk(list){
      for(const b of list){
        if(b.id===id){ found=list; return; }
        if(b.body){ walk(b.body); if(found) return; }
      }
    })(script);
    return found;
  }
  /* Every gap a block could be dropped into, as a screen position. A gap is
     "before this block" for each block in a list, plus "at the end" of it —
     including the inside of every repeat, so a block can be dragged into a
     loop as well as around one. */
  function gaps(){
    const out=[];
    scriptEl.querySelectorAll('[data-body]').forEach(body=>{
      const id=+body.dataset.body;
      const b=findBlock(id);
      if(b && b.body) out.push(...slotsIn(body, b.body));
    });
    out.push(...slotsIn(scriptEl, script));
    return out;
  }
  function slotsIn(container, list){
    const out=[];
    const kids=[...container.children].filter(n=>n.classList.contains('blk'));
    kids.forEach((n,i)=>{
      const r=n.getBoundingClientRect();
      out.push({ list, index:i, y:r.top, x:r.left, w:r.width, node:n, where:'before' });
    });
    const r=container.getBoundingClientRect();
    const last=kids[kids.length-1];
    out.push({ list, index:list.length,
               y:last?last.getBoundingClientRect().bottom:r.top+6,
               x:r.left+8, w:Math.max(60,r.width-16), node:last, where:'after' });
    return out;
  }
  function marker(){
    let m=document.querySelector('#dropLine');
    if(!m){ m=document.createElement('div'); m.id='dropLine'; document.body.appendChild(m); }
    return m;
  }
  function startDrag(b, node, ev){
    const r=node.getBoundingClientRect();
    const ghost=node.cloneNode(true);
    ghost.classList.add('dragging');
    Object.assign(ghost.style, { position:'fixed', left:r.left+'px', top:r.top+'px',
      width:r.width+'px', margin:'0', pointerEvents:'none', zIndex:120 });
    document.body.appendChild(ghost);
    node.classList.add('lifted');
    drag={ b, node, ghost, dx:ev.clientX-r.left, dy:ev.clientY-r.top, slot:null };
  }
  function moveDrag(ev){
    if(!drag) return;
    drag.ghost.style.left=(ev.clientX-drag.dx)+'px';
    drag.ghost.style.top =(ev.clientY-drag.dy)+'px';
    /* Nearest gap to the pointer. Distance, not "is it inside this box",
       because the gap at the end of a list has no box to be inside. */
    let best=null, bd=1e9;
    for(const g of gaps()){
      if(insideDragged(g.node)) continue;      // no dropping a block into itself
      const d=Math.abs(ev.clientY-g.y) + Math.abs(ev.clientX-(g.x+g.w/2))*0.15;
      if(d<bd){ bd=d; best=g; }
    }
    drag.slot=best;
    const m=marker();
    if(best){
      m.style.display='block';
      m.style.left=best.x+'px'; m.style.top=(best.y-2)+'px'; m.style.width=best.w+'px';
    } else m.style.display='none';
  }
  const insideDragged = node =>
    !!(node && drag && drag.node && (node===drag.node || drag.node.contains(node)));
  function endDrag(){
    if(!drag) return;
    const { b, slot }=drag;
    drag.ghost.remove();
    drag.node.classList.remove('lifted');
    const m=document.querySelector('#dropLine'); if(m) m.style.display='none';
    drag=null;
    if(!slot) return draw();
    const from=listOf(b.id); if(!from) return draw();
    const at=from.indexOf(b);
    let to=slot.index;
    from.splice(at,1);
    // taking it out of its own list shifts every later gap in that list back one
    if(from===slot.list && at<to) to--;
    slot.list.splice(Math.max(0,Math.min(to, slot.list.length)), 0, b);
    if(window.beep) beep('pop');
    draw();
  }
  function wireDrag(){
    scriptEl.querySelectorAll('.blk').forEach(node=>{
      node.onpointerdown=ev=>{
        if(ev.button) return;
        // the ✕, the steppers and the number box are controls, not handles
        if(ev.target.closest('button, input')) return;
        /* The innermost block wins. A block inside a repeat is inside the
           repeat's element too, so without this the press starts TWO drags —
           and the outer one, being the loop that contains the thing you are
           holding, rules out every place you could put it down. */
        ev.stopPropagation();
        const b=findBlock(+node.dataset.id); if(!b) return;
        const sx=ev.clientX, sy=ev.clientY;
        let live=false;
        const move=e=>{
          if(!live && Math.hypot(e.clientX-sx, e.clientY-sy) < DRAG_SLOP) return;
          if(!live){ live=true; startDrag(b, node, {clientX:sx, clientY:sy}); }
          e.preventDefault();
          moveDrag(e);
        };
        const up=()=>{
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          if(live) endDrag();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      };
    });
  }

  function show(pal){
    if(!el) build();
    if(pal) setPalette(pal);
    open=true; el.classList.remove('hidden'); draw();
    if(document.pointerLockElement) document.exitPointerLock();
    if(mode==='text'){ const ta=el.querySelector('#conTA'); ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length); }
  }
  function setGuide(g){ guide = g || null; if(el && open) draw(); }
  function close(){ open=false; if(el) el.classList.add('hidden'); }
  function isOpen(){ return open; }

  function run(){
    if(mode==='text'){
      const r=parse(typed);
      if(r.error){
        hint(t('Line {n}',{n:r.error.line})+': '+r.error.msg, 'err');
        if(window.beep) beep('bad');
        return;
      }
      script=r.script; dropTarget=null;
    }
    const steps=compile(script);
    const real=steps.filter(s=>!s.name.startsWith('__'));
    if(!real.length){
      hint(t('Write something first.'), 'err');
      if(window.beep) beep('bad');
      return;
    }
    if(budget && countBlocks()>budget){
      hint(t('That is {a} blocks — the budget is {b}.',{a:countBlocks(),b:budget}), 'err');
      if(window.beep) beep('bad');
      return;
    }
    close();
    tape.classList.remove('hidden');
    tape.innerHTML=`<div class="tape-lbl">${t('RUNNING')}</div>`+script.map(b=>blockHTML(b,true)).join('');
    if(onRun) onRun(steps, toText());
  }

  /* live highlight while the program runs */
  function highlight(step){
    if(!tape) return;
    tape.querySelectorAll('.blk').forEach(b=>b.classList.remove('on'));
    if(!step) return;
    const node=tape.querySelector(`.blk[data-id="${step.blockId}"]`);
    if(node) node.classList.add('on');
  }
  /* THE BLOCK THAT CRASHED YOU. highlight() marks the running tape, which is
     taken down the moment a run ends — so it is no use at all for pointing at
     a mistake afterwards. This marks the block in the program you are about
     to edit, and stays there until the next run. */
  let blamed=null;
  function blame(id){ blamed = (id==null) ? null : id; drawBlame(); }
  function drawBlame(){
    if(!scriptEl) return;
    scriptEl.querySelectorAll('.blk.blame').forEach(n=>n.classList.remove('blame'));
    if(blamed==null) return;
    const n=scriptEl.querySelector(`.blk[data-id="${blamed}"]`);
    if(n) n.classList.add('blame');
  }
  function setIter(blockId,i,n){
    if(!tape) return;
    const s=tape.querySelector(`[data-iter="${blockId}"]`);
    if(s) s.textContent=`${i}/${n}`;
    const node=tape.querySelector(`.blk[data-id="${blockId}"]`);
    if(node) node.classList.add('on');
  }
  function hideTape(){ if(tape) tape.classList.add('hidden'); }
  function clear(){ script=[]; typed=''; dropTarget=null; if(el) draw(); }

  return { show, close, isOpen, setPalette, setBudget, setRails, setAside, asideEl, coachHost, blame,
           setConditions, setGrid, setTurnStep, setGuide, setMode, parse,
           countBlocks, compile, toText, highlight, setIter, hideTape, clear,
           get mode(){ return mode; },
           get script(){ return script; },
           set onRun(fn){ onRun=fn; } };
})();
