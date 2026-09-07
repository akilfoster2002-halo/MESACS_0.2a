/* =====================================================================
   MECHSIM — the referee.

   Two programs, one arena, one seed. Nothing else goes in, and the same
   three always give the same fight: no clock, no Math.random, no floats
   where whole numbers will do, no DOM. That is not tidiness — it is what
   makes every other feature possible. A battle that can be recomputed
   can be replayed, spectated, stepped through backwards, judged by a
   server that never saw the animation, and argued about afterwards with
   the actual numbers in hand.

   IT RUNS THE SAME LANGUAGE AS EVERY OTHER MISSION. The tape it steps
   through is what program.js compiles, so shoot() in an arena is the
   same block as shoot() in the Loop Chamber, and a student arrives
   already able to write one.

   A TURN. Both mechs act at once — there is no first player. Every turn:

     1  energy comes back
     2  each program is stepped until it asks for an action
     3  the action is paid for, or it stalls and says why
     4  shields go up
     5  both mechs move, and settle who got where
     6  pickups are collected
     7  both mechs shoot, at where things ARE now
     8  hazards burn whoever is standing in them
     9  the dead are counted

   Shooting after moving, and both at once, is the rule that makes the
   interesting cases real: two mechs can kill each other on the same
   turn, and a mech can dodge a shot by moving out of the line on the
   very turn it was fired.

   WHAT IT WRITES DOWN. Every turn keeps two things. A frame — the whole
   board, so the replay can jump to turn 12 without replaying 11 — and a
   log of what each program did and why: which block, which test, which
   way that test came out, what it cost, what it hit. Losing is only
   worth anything if you can read why.
   ===================================================================== */
(function(root){

  const PROGRAM = (typeof module!=='undefined' && module.exports)
    ? require('./program.js')
    : root.PROGRAM;

  /* N E S W, and z grows southwards — the same convention the race track
     and the flight grid already use, so a heading means one thing in this
     codebase rather than three. */
  const DIRS=[{x:0,z:-1},{x:1,z:0},{x:0,z:1},{x:-1,z:0}];
  const DIRNAME=['north','east','south','west'];

  /* ------------------------------------------------------------ chassis
     Five numbers each, and every one of them has to be a sentence a
     student can say out loud: the scout moves two tiles and dies fast,
     the tank hits like a truck and cannot get out of its own way.

     Extensible on purpose — a sixth chassis is a row here and nothing
     else, because nothing below reads a chassis by name. */
  const CHASSIS={
    tank:{ id:'tank', name:'TANK', em:'\u{1F6E1}', a:'#ffb4a2',
      hp:30, armour:2, energy:12, regen:2, move:1, attack:6, range:3, sensor:3,
      blurb:'Slow, thick, and it hits hardest. Get in close and stay there.' },
    scout:{ id:'scout', name:'SCOUT', em:'\u{1F441}', a:'#8fd3ff',
      hp:16, armour:0, energy:16, regen:3, move:2, attack:3, range:4, sensor:6,
      blurb:'Two tiles a step and it sees the furthest. Made of paper.' },
    striker:{ id:'striker', name:'STRIKER', em:'⚔', a:'#ffd8a8',
      hp:22, armour:1, energy:14, regen:2, move:1, attack:5, range:4, sensor:4,
      blurb:'No weakness worth naming. The one to learn on.' },
    defender:{ id:'defender', name:'DEFENDER', em:'\u{1F6E1}', a:'#a8e6cf',
      hp:26, armour:3, energy:14, regen:2, move:1, attack:3, range:3, sensor:4,
      shieldBonus:2,
      blurb:'Shrugs off two of every hit, and its shield is worth double.' }
  };

  /* -------------------------------------------------------------- rules
     Every number a match runs on, in one object. A tournament, a teacher
     or a difficulty setting overrides what it likes and leaves the rest;
     nothing below reaches past this for a constant. */
  const RULES={
    blockLimit:20,          // how long a program may be
    maxDepth:3,             // loops inside loops inside loops
    maxTurns:60,            // and how long the fight may last
    startEnergy:null,       // null = whatever the chassis says
    regen:null,             // and the same for what comes back each turn
    cost:{ forward:1, back:1, left:0, right:0, shoot:3, shield:2, dash:4 },
    /* Turning is free in energy but never free in time: it still costs the
       turn, which is the only currency that matters when somebody is
       lining a shot up on you. */
    shieldCut:2,            // damage a raised shield soaks
    collideDamage:1,        // walking into each other
    hazardDamage:3,
    energyPickup:6,         // what one crate is worth
    pickupRespawn:8,        // turns before a taken crate comes back
    nearRange:2,            // what "nearby" means
    dashRange:2,
    loopProgram:true,       // a finished program starts again
    stepsPerTurn:200,       // control blocks allowed between two actions
    winBy:'hp'              // how a match that runs out of turns is settled
  };
  function makeRules(over){
    const r=Object.assign({}, RULES, over||{});
    r.cost=Object.assign({}, RULES.cost, (over&&over.cost)||{});
    return r;
  }

  /* the blocks a mech is allowed, and the tests it can make */
  const PALETTE=['forward','back','left','right','shoot','shield','dash','repeat','ifc','until'];
  const SENSORS=[
    { id:'enemy ahead',    a:'#ff9aa2', help:'The enemy is in front of you and in range of your gun.' },
    { id:'enemy nearby',   a:'#ffd8a8', help:'The enemy is within two tiles, any direction.' },
    { id:'wall ahead',     a:'#cdb4f6', help:'The next tile in front of you is a wall or the edge.' },
    { id:'energy nearby',  a:'#a8e6cf', help:'There is an energy crate inside your sensor range.' },
    { id:'enemy detected', a:'#8fd3ff', help:'The enemy is somewhere inside your sensor range.' }
  ];

  /* ------------------------------------------------------------- arenas
     Data, not code. A new map is a new entry — walls, crates, hazards and
     two starting marks, drawn as text so it can be read at a glance and
     edited by somebody who has never opened a 3D editor.

       #  wall        .  floor       E  energy crate
       X  hazard      1  player one  2  player two

     The digit also carries a facing: both mechs start looking at the
     middle of the map, which is decided from where they stand, so a map
     never has to spell it out and can never contradict itself. */
  const ARENAS=[
    { id:'training', name:'TRAINING ARENA', em:'\u{1F3AF}', a:'#a8e6cf',
      blurb:'Open ground, nothing in the way. Learn what the blocks do.',
      /* Both marks on the same row, at opposite ends. Diagonally adjacent
         starts made "enemy nearby" true before anybody had moved and
         "enemy ahead" false for ever, which taught the first thing a
         student meets here that sensors are noise. Down one row they are
         seven tiles apart and looking at each other: walk, and the tests
         come true in the order the blocks read. */
      grid:['##########',
            '#........#',
            '#........#',
            '#........#',
            '#1......2#',
            '#........#',
            '#........#',
            '#........#',
            '#........#',
            '##########'] },

    { id:'ruins', name:'RUINS', em:'\u{1F3DA}', a:'#ffb4a2',
      blurb:'Cover everywhere. A wall between you and a gun is worth more than armour.',
      grid:['##########',
            '#1.......#',
            '#..##.##.#',
            '#..#....E#',
            '#....##..#',
            '#..##....#',
            '#E....#..#',
            '#.##.##..#',
            '#.......2#',
            '##########'] },

    { id:'energy', name:'ENERGY ARENA', em:'⚡', a:'#ffe9a8',
      blurb:'Crates everywhere. Nobody runs dry here — so nobody has an excuse.',
      grid:['##########',
            '#1..E..E.#',
            '#........#',
            '#.E.##.E.#',
            '#...##...#',
            '#...##...#',
            '#.E.##.E.#',
            '#........#',
            '#.E..E..2#',
            '##########'] },

    { id:'maze', name:'MAZE', em:'\u{1F9F1}', a:'#cdb4f6',
      blurb:'Getting there is the whole problem. wall ahead is your only map.',
      grid:['##########',
            '#1.#....E#',
            '#..#.##..#',
            '#.##.##.##',
            '#....#...#',
            '#.##.#.#.#',
            '#.#..#.#.#',
            '#.#.##.#.#',
            '#E.....#2#',
            '##########'] },

    { id:'hazard', name:'HAZARD ARENA', em:'☢', a:'#ff9aa2',
      blurb:'The floor bites. Standing still is a decision here, not a default.',
      grid:['##########',
            '#1.XX...E#',
            '#..XX....#',
            '#........#',
            '#.X.XX.X.#',
            '#.X.XX.X.#',
            '#........#',
            '#....XX..#',
            '#E...XX.2#',
            '##########'] }
  ];
  const arenaById = id => ARENAS.find(a=>a.id===id) || ARENAS[0];

  /* Text into something the simulator can index. Done once per match. */
  function readArena(def){
    const grid=def.grid, h=grid.length, w=grid[0].length;
    const wall=[], hazard=[], crates=[], starts=[null,null];
    for(let z=0;z<h;z++){
      wall.push([]); hazard.push([]);
      for(let x=0;x<w;x++){
        const c=grid[z][x];
        wall[z].push(c==='#');
        hazard[z].push(c==='X');
        if(c==='E') crates.push({ x, z, taken:0 });
        if(c==='1') starts[0]={x,z};
        if(c==='2') starts[1]={x,z};
      }
    }
    if(!starts[0]) starts[0]={x:1,z:1};
    if(!starts[1]) starts[1]={x:w-2,z:h-2};
    return { id:def.id, name:def.name, w, h, wall, hazard, crates, starts };
  }
  /* Both mechs open facing the middle, worked out rather than written
     down, so a map cannot start somebody looking into a wall. */
  function faceCentre(p, A){
    const dx=(A.w/2)-p.x, dz=(A.h/2)-p.z;
    /* >= rather than >, so a dead-heat turns along the map's long axis
       instead of into the wall behind the starting mark. Two mechs on
       opposite corners of a square arena tie exactly, and the tie is
       precisely the case that has to come out facing across the map. */
    return Math.abs(dx)>=Math.abs(dz) ? (dx>0?1:3) : (dz>0?2:0);
  }

  /* ---------------------------------------------------------------- rng
     Seeded, and used only where a choice is genuinely arbitrary — which
     crate comes back first, who is asked first when the order cannot
     matter but has to be decided. Nothing about damage or movement
     touches it: a fight is won by the program, not the dice. */
  function mulberry32(seed){
    let a=(seed>>>0)||1;
    return function(){
      a|=0; a=(a+0x6D2B79F5)|0;
      let t=Math.imul(a^(a>>>15), 1|a);
      t=(t+Math.imul(t^(t>>>7), 61|t))^t;
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }

  /* --------------------------------------------------------- the tape
     One mech's program counter. It walks the compiled steps, doing the
     bookkeeping ones itself — a test, a loop's back-edge — and stopping
     the moment it reaches something the arena has to act on. Everything
     it stepped over is handed back as a trace, which is what the debug
     view reads out.

     `until` is the only loop that can spin without acting, so the walk is
     capped: a program that goes round two hundred times without asking to
     do anything has a bug, and being told that is more use than a hang. */
  function Cursor(steps){
    this.steps=steps; this.pc=0; this.laps=0;
  }
  Cursor.prototype.next=function(sense, rules){
    const trace=[];
    let guard=0;
    while(true){
      if(this.pc>=this.steps.length){
        if(!rules.loopProgram || !this.steps.length)
          return { step:null, trace, done:true };
        this.pc=0; this.laps++;
        trace.push({ kind:'loop', text:'program starts again' });
      }
      if(++guard>rules.stepsPerTurn)
        return { step:null, trace, spin:true };
      const s=this.steps[this.pc];
      if(!s) { this.pc++; continue; }

      if(s.name==='__iter'){
        trace.push({ kind:'iter', blockId:s.blockId, i:s.i, n:s.n,
                     text:'repeat '+s.i+' of '+s.n });
        this.pc++; continue;
      }
      if(s.name==='__call'){
        trace.push({ kind:'call', blockId:s.blockId, text:'combo' });
        this.pc++; continue;
      }
      if(s.name==='__if'){
        const v=!!sense(s.cond);
        trace.push({ kind:'test', blockId:s.blockId, cond:s.cond, value:v,
                     text:'if '+s.cond, lead:'if' });
        this.pc = v ? this.pc+1 : s.jump;
        continue;
      }
      if(s.name==='__until'){
        const v=!!sense(s.cond);
        trace.push({ kind:'test', blockId:s.blockId, cond:s.cond, value:v,
                     text:'repeat until '+s.cond, lead:'until' });
        // true means the loop is finished, so true is the way OUT
        this.pc = v ? s.jump : this.pc+1;
        continue;
      }
      if(s.name==='__loop'){ this.pc=s.back; continue; }

      this.pc++;
      return { step:s, trace };
    }
  };

  /* --------------------------------------------------------------- state */
  function makeMech(side, spec, start, dir, rules){
    const c=CHASSIS[spec.chassis] || CHASSIS.striker;
    const maxE = rules.startEnergy==null ? c.energy : rules.startEnergy;
    return {
      side, name:spec.name||('Player '+side), chassis:c.id,
      x:start.x, z:start.z, dir,
      hp:c.hp, maxHp:c.hp, energy:maxE, maxEnergy:maxE,
      armour:c.armour, attack:c.attack, range:c.range, sensor:c.sensor,
      moveTiles:c.move, shieldBonus:c.shieldBonus||0,
      regen: rules.regen==null ? c.regen : rules.regen,
      shield:false, alive:true,
      stats:{ damageDealt:0, damageTaken:0, shots:0, hits:0, energyUsed:0,
              moves:0, stalls:0, pickups:0, turnsSurvived:0 }
    };
  }

  const inside = (A,x,z) => x>=0 && z>=0 && x<A.w && z<A.h;
  const solid  = (A,x,z) => !inside(A,x,z) || A.wall[z][x];

  /* Line of fire: straight down the facing, out to the gun's range,
     stopped by the first wall. A shot does not curve and does not go
     through anything, which is what makes "get a wall between you and it"
     a real move. */
  function shotPath(A,m,range){
    const d=DIRS[m.dir], out=[];
    for(let i=1;i<=range;i++){
      const x=m.x+d.x*i, z=m.z+d.z*i;
      if(solid(A,x,z)) break;
      out.push({x,z});
    }
    return out;
  }
  const cheb = (a,b) => Math.max(Math.abs(a.x-b.x), Math.abs(a.z-b.z));

  /* ------------------------------------------------------------ sensing
     Answered against the board as it stands at the START of the turn, for
     both mechs, so neither is reading the other's move before making its
     own. Simultaneous has to mean simultaneous or the fight is decided by
     whoever the loop happened to ask first. */
  function sensor(A, me, foe, live){
    return function(cond){
      switch(cond){
        case 'wall ahead': {
          const d=DIRS[me.dir];
          return solid(A, me.x+d.x, me.z+d.z);
        }
        case 'enemy ahead':
          return foe.alive && shotPath(A,me,me.range).some(p=>p.x===foe.x && p.z===foe.z);
        case 'enemy nearby':
          return foe.alive && cheb(me,foe) <= live.rules.nearRange;
        case 'enemy detected':
          return foe.alive && cheb(me,foe) <= me.sensor;
        case 'energy nearby':
          return live.crates.some(c=>!c.taken && cheb(me,c) <= me.sensor);
        default: return false;
      }
    };
  }

  /* ---------------------------------------------------------- the match */
  function simulate(opts){
    opts=opts||{};
    const rules=makeRules(opts.rules);
    const def=typeof opts.arena==='string' ? arenaById(opts.arena)
            : (opts.arena||ARENAS[0]);
    const A=readArena(def);
    const seed=(opts.seed==null ? 1 : opts.seed)>>>0;
    const rng=mulberry32(seed);

    const specs=[opts.a||{}, opts.b||{}];
    const sides=['A','B'];

    /* Validate before anything else. A program that should not be in the
       match must not be in the replay either. */
    const checks=specs.map(sp=>PROGRAM.validate(sp.program||[], {
      limit:rules.blockLimit, maxDepth:rules.maxDepth,
      allow:opts.allow||PALETTE, conds:SENSORS.map(s=>s.id)
    }));
    if(checks.some(c=>!c.ok))
      return { ok:false, seed, arenaId:A.id,
               rejected: checks.map((c,i)=>({ side:sides[i], errors:c.errors })) };

    /* Where they stand and which way they look comes from the map, unless
       the caller says otherwise — a tournament seeding the same pairing
       twice with the sides swapped, or a test that needs two mechs nose to
       nose, both want to say so rather than arrange it by geometry. */
    const mechs=specs.map((sp,i)=>{
      const start = sp.start || A.starts[i];
      const dir   = (sp.dir==null) ? faceCentre(start,A) : (((sp.dir%4)+4)%4);
      return makeMech(sides[i], sp, start, dir, rules);
    });
    const tapes=specs.map(sp=>PROGRAM.compile(sp.program||[], { root:sp.program||[] }));
    const cur=tapes.map(t=>new Cursor(t));
    const live={ rules, crates:A.crates.map(c=>({x:c.x,z:c.z,taken:0})) };

    const frames=[], log=[];
    frames.push(frame(0, mechs, live, []));

    let turn=0, over=null;
    while(turn<rules.maxTurns && !over){
      turn++;
      const entries=[[],[]];
      const events=[];

      /* 1 — energy comes back, up to the tank's size. A trickle rather than
         a refill: enough that nobody is permanently stranded, never enough
         to make the costs stop mattering. A shield only lasts the turn it
         was raised, so it comes down here before anybody acts. */
      mechs.forEach(m=>{
        if(!m.alive) return;
        m.energy=Math.min(m.maxEnergy, m.energy+m.regen);
        m.shield=false;
      });

      /* 2 — ask both programs, against the same board */
      const sense=[ sensor(A, mechs[0], mechs[1], live),
                    sensor(A, mechs[1], mechs[0], live) ];
      const want=[null,null];
      for(let i=0;i<2;i++){
        const m=mechs[i];
        if(!m.alive) continue;
        const r=cur[i].next(sense[i], rules);
        r.trace.forEach(tr=>entries[i].push(Object.assign({kind:tr.kind}, tr)));
        if(r.spin){
          entries[i].push({ kind:'stall', text:'stuck',
            why:'Your repeat-until went round '+rules.stepsPerTurn+
                ' times without ever doing anything. The test inside it never came true.' });
          m.stats.stalls++;
          continue;
        }
        if(!r.step){
          entries[i].push({ kind:'stall', text:'idle',
            why:'Your program ran off the end and there was nothing left to do.' });
          m.stats.stalls++;
          continue;
        }
        /* 3 — pay for it, or say plainly why it did not happen */
        const cost=rules.cost[r.step.name]||0;
        if(cost>m.energy){
          entries[i].push({ kind:'stall', blockId:r.step.blockId, text:r.step.name,
            why:'Your mech tried '+r.step.name.toUpperCase()+', which costs '+cost+
                ' energy, and it had '+m.energy+'.' });
          m.stats.stalls++;
          continue;
        }
        m.energy-=cost; m.stats.energyUsed+=cost;
        want[i]={ act:r.step.name, blockId:r.step.blockId, cost };
        entries[i].push({ kind:'action', blockId:r.step.blockId,
                          text:r.step.name, cost });
      }

      /* 4 — shields */
      for(let i=0;i<2;i++) if(want[i] && want[i].act==='shield'){
        mechs[i].shield=true;
        entries[i].push({ kind:'event', text:'shield up' });
      }

      /* 5 — turning, then moving, both at once */
      for(let i=0;i<2;i++){
        const w=want[i]; if(!w) continue;
        if(w.act==='left')  mechs[i].dir=(mechs[i].dir+3)%4;
        if(w.act==='right') mechs[i].dir=(mechs[i].dir+1)%4;
      }
      resolveMoves(A, mechs, want, live, entries, events, rules);

      /* 6 — crates, picked up by standing on them */
      mechs.forEach((m,i)=>{
        if(!m.alive) return;
        const c=live.crates.find(c=>!c.taken && c.x===m.x && c.z===m.z);
        if(!c) return;
        c.taken=rules.pickupRespawn;
        const got=Math.min(rules.energyPickup, m.maxEnergy-m.energy);
        m.energy+=got; m.stats.pickups++;
        entries[i].push({ kind:'event', text:'picked up energy', value:got });
        events.push({ kind:'pickup', side:m.side, x:m.x, z:m.z, value:got });
      });

      /* 7 — both guns, at where things are NOW */
      resolveShots(A, mechs, want, entries, events, rules);

      /* 8 — the floor */
      mechs.forEach((m,i)=>{
        if(!m.alive || !A.hazard[m.z][m.x]) return;
        hurt(m, rules.hazardDamage);
        m.stats.damageTaken+=rules.hazardDamage;
        entries[i].push({ kind:'event', text:'hazard', value:rules.hazardDamage,
          why:'You ended the turn standing in a hazard tile.' });
        events.push({ kind:'hazard', side:m.side, x:m.x, z:m.z, value:rules.hazardDamage });
      });

      /* crates come back */
      live.crates.forEach(c=>{ if(c.taken>0) c.taken--; });

      /* 9 — who is still standing */
      mechs.forEach(m=>{
        if(m.alive && m.hp<=0){ m.alive=false; m.hp=0;
          events.push({ kind:'destroyed', side:m.side, x:m.x, z:m.z }); }
        if(m.alive) m.stats.turnsSurvived=turn;
      });

      log.push({ turn, A:entries[0], B:entries[1] });
      frames.push(frame(turn, mechs, live, events));

      if(!mechs[0].alive || !mechs[1].alive) over=verdict(mechs, turn, 'destroyed');
    }
    if(!over) over=verdict(mechs, turn, 'time');

    return { ok:true, seed, arenaId:A.id, arena:def, rules,
             mechs:mechs.map(m=>({ side:m.side, name:m.name, chassis:m.chassis,
                                   maxHp:m.maxHp, maxEnergy:m.maxEnergy })),
             frames, log, result:over,
             stats:{ A:mechs[0].stats, B:mechs[1].stats } };
  }

  /* ------------------------------------------------------------- moving
     Both mechs commit to a destination before either arrives, so the
     awkward cases have to be decided rather than fallen into: the same
     tile, and a straight swap. Both are refusals — neither mech gets
     there, and both take the knock. A move that a wall stops short is not
     cancelled: you go as far as you can, which is what a student expects
     from watching it. */
  function resolveMoves(A, mechs, want, live, entries, events, rules){
    /* Everybody has a destination, including whoever is not going
       anywhere: standing still is a claim on a tile, not an absence of
       one, and treating it as an absence is how a mech ends up walking
       through somebody who was simply holding position. */
    const dest=[null,null], moved=[false,false];
    for(let i=0;i<2;i++){
      const m=mechs[i];
      if(!m.alive) continue;
      dest[i]={ x:m.x, z:m.z };
      const w=want[i];
      if(!w) continue;
      let tiles=0, back=false;
      if(w.act==='forward') tiles=m.moveTiles;
      else if(w.act==='back'){ tiles=m.moveTiles; back=true; }
      else if(w.act==='dash') tiles=rules.dashRange;
      if(!tiles) continue;

      const d=DIRS[m.dir], sx=back?-1:1;
      let x=m.x, z=m.z, blocked=false;
      for(let s=0;s<tiles;s++){
        const nx=x+d.x*sx, nz=z+d.z*sx;
        if(solid(A,nx,nz)){ blocked=true; break; }
        x=nx; z=nz;
      }
      if(blocked)
        entries[i].push({ kind:'event', text:'wall',
          why:'A wall stopped you — '+(x===m.x&&z===m.z ? 'you did not move at all.'
                                                        : 'you got part of the way.') });
      dest[i]={ x, z };
      moved[i] = (x!==m.x || z!==m.z);
    }

    const a=dest[0], b=dest[1];
    if(a && b && (moved[0]||moved[1])){
      const sameTile = a.x===b.x && a.z===b.z;
      const swap = moved[0] && moved[1]
                && a.x===mechs[1].x && a.z===mechs[1].z
                && b.x===mechs[0].x && b.z===mechs[0].z;
      if(sameTile || swap){
        if(moved[0] && moved[1]){
          /* Both went for it, so neither gets it and both feel it. */
          for(let i=0;i<2;i++){
            hurt(mechs[i], rules.collideDamage);
            mechs[i].stats.damageTaken+=rules.collideDamage;
            entries[i].push({ kind:'event', text:'collision', value:rules.collideDamage,
              why:sameTile ? 'You both went for the same tile, so neither of you got it.'
                           : 'You tried to walk straight through each other.' });
          }
          events.push({ kind:'collision', x:a.x, z:a.z });
        } else {
          /* One walked into somebody who was standing there. A mech is as
             solid as a wall, and being stopped by one is not an injury. */
          const i = moved[0] ? 0 : 1;
          entries[i].push({ kind:'event', text:'blocked',
            why:'The other mech was standing exactly where you were going.' });
        }
        return;
      }
    }
    for(let i=0;i<2;i++){
      if(!dest[i] || !moved[i]) continue;
      mechs[i].stats.moves++;
      mechs[i].x=dest[i].x; mechs[i].z=dest[i].z;
    }
  }

  /* ------------------------------------------------------------ shooting
     Both shots are worked out from the same board and applied together,
     so two mechs really can destroy each other on the same turn. Damage
     is attack, less armour, less a raised shield — floored at one, so a
     hit is always worth something and a defender is never invincible. */
  function resolveShots(A, mechs, want, entries, events, rules){
    const hits=[];
    for(let i=0;i<2;i++){
      const m=mechs[i], w=want[i], foe=mechs[1-i];
      if(!m.alive || !w || w.act!=='shoot') continue;
      m.stats.shots++;
      const path=shotPath(A,m,m.range);
      const hit=foe.alive && path.some(p=>p.x===foe.x && p.z===foe.z);
      if(!hit){
        entries[i].push({ kind:'event', text:'miss', blockId:w.blockId,
          why:'Nothing was in front of you within '+m.range+' tiles when the shot went off.' });
        events.push({ kind:'shot', side:m.side, from:{x:m.x,z:m.z},
                      to:path.length?path[path.length-1]:{x:m.x,z:m.z}, hit:false });
        continue;
      }
      const soak = foe.armour + (foe.shield ? rules.shieldCut + foe.shieldBonus : 0);
      const dmg  = Math.max(1, m.attack - soak);
      hits.push({ i, dmg, from:{x:m.x,z:m.z}, to:{x:foe.x,z:foe.z} });
      entries[i].push({ kind:'event', text:'hit', blockId:w.blockId, value:dmg,
        why: foe.shield ? 'You hit a raised shield, so it soaked '+(rules.shieldCut+foe.shieldBonus)+'.'
                        : 'A clean hit through '+foe.armour+' armour.' });
    }
    hits.forEach(h=>{
      const m=mechs[h.i], foe=mechs[1-h.i];
      hurt(foe, h.dmg);
      m.stats.hits++; m.stats.damageDealt+=h.dmg; foe.stats.damageTaken+=h.dmg;
      entries[1-h.i].push({ kind:'event', text:'took damage', value:h.dmg,
        why:'The other mech had a clear line on you.' });
      events.push({ kind:'shot', side:m.side, from:h.from, to:h.to, hit:true, dmg:h.dmg });
    });
  }
  const hurt = (m,n) => { m.hp=Math.max(0, m.hp-n); };

  /* ------------------------------------------------------------- verdict */
  function verdict(mechs, turn, how){
    const [a,b]=mechs;
    if(!a.alive && !b.alive)
      return { winner:'draw', reason:'mutual', turns:turn,
               text:'Both mechs were destroyed on the same turn.' };
    if(!b.alive) return { winner:'A', reason:'destroyed', turns:turn,
               text:a.name+' destroyed '+b.name+'.' };
    if(!a.alive) return { winner:'B', reason:'destroyed', turns:turn,
               text:b.name+' destroyed '+a.name+'.' };
    if(how==='time'){
      if(a.hp!==b.hp){
        const w = a.hp>b.hp ? 'A':'B';
        return { winner:w, reason:'hp', turns:turn,
                 text:'Time ran out. '+(w==='A'?a:b).name+' had more armour left ('+
                      Math.max(a.hp,b.hp)+' to '+Math.min(a.hp,b.hp)+').' };
      }
      if(a.stats.damageDealt!==b.stats.damageDealt){
        const w = a.stats.damageDealt>b.stats.damageDealt ? 'A':'B';
        return { winner:w, reason:'damage', turns:turn,
                 text:'Time ran out level on armour, so it went to damage dealt.' };
      }
      return { winner:'draw', reason:'time', turns:turn,
               text:'Time ran out and nothing separated them.' };
    }
    return { winner:'draw', reason:'unknown', turns:turn, text:'The match ended.' };
  }

  /* One board, whole, so a replay can jump anywhere without replaying */
  function frame(turn, mechs, live, events){
    return { turn,
      mechs: mechs.map(m=>({ side:m.side, x:m.x, z:m.z, dir:m.dir, hp:m.hp,
                             energy:m.energy, shield:m.shield, alive:m.alive })),
      crates: live.crates.map(c=>({ x:c.x, z:c.z, taken:c.taken })),
      events: events.slice() };
  }

  /* --------------------------------------------------------- explaining
     "YOU LOST" teaches nobody anything. This reads the log back and finds
     the thing that actually went wrong, in the order that matters: what
     killed you beats what merely annoyed you. */
  function explain(match, side){
    if(!match || !match.ok) return '';
    const mine=[]; match.log.forEach(l=>l[side].forEach(e=>mine.push({ turn:l.turn, e })));
    const first = pred => mine.find(x=>pred(x.e));

    const broke=first(e=>e.kind==='stall' && /energy/.test(e.why||''));
    if(broke) return 'TURN '+broke.turn+': '+broke.e.why;
    const spun=first(e=>e.kind==='stall' && /round/.test(e.why||''));
    if(spun) return 'TURN '+spun.turn+': '+spun.e.why;
    const idle=first(e=>e.kind==='stall' && /ran off the end/.test(e.why||''));
    if(idle && !match.rules.loopProgram) return 'TURN '+idle.turn+': '+idle.e.why;

    const st=match.stats[side];
    if(st.shots && !st.hits)
      return 'You fired '+st.shots+' times and hit nothing. Test for '+
             '"enemy ahead" before you shoot, rather than shooting and hoping.';
    if(!st.shots)
      return 'You never fired a shot. A program that only moves cannot win a fight.';
    if(st.stalls>match.result.turns/3)
      return 'Your mech stood still for '+st.stalls+' of '+match.result.turns+
             ' turns. Most of your program was waiting rather than doing.';
    return match.result.text;
  }

  const API={ CHASSIS, ARENAS, SENSORS, PALETTE, RULES, DIRS, DIRNAME,
              makeRules, arenaById, readArena, simulate, explain, mulberry32 };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.MECHSIM=API;
})(typeof self!=='undefined' ? self : this);
