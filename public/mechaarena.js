/* =====================================================================
   MECHAARENA — the fight itself, as a function of time and two inputs.

   THE DIVISION THIS WHOLE MODE RESTS ON:

       the player drives            the code fights
       ─────────────────           ────────────────
       walk, run, strafe            punch, heavy, block
       turn, back off               dodge, brace
       where to stand               when to do any of it

   So this is not a replay like the Gym's referee. It is a live
   simulation stepped twenty times a second, fed two things each tick —
   what each player is holding on the keyboard, and what each part's
   program decides when it is asked. Nothing in here is random and
   nothing reads a clock: same inputs, same fight, on the server and in
   the browser both. That is what lets the same file run a real match
   against another student and a practice bout against a dummy.

   COMBAT IS A TRIANGLE, and every corner of it is a thing you can write
   an order about:

       BLOCK    beats  PUNCH   — a raised arm takes a quarter of it
       HEAVY    beats  BLOCK   — it goes through, and the arm pays
       PUNCH    beats  HEAVY   — heavy roots you for half a second

   DODGE steps outside the triangle: nothing lands on a mecha mid-dodge,
   but it costs energy and it is over in a third of a second, so a dodge
   written to fire on the wrong reading is just energy on the floor.

   DAMAGE IS PER PART, and where it lands is a rule rather than a dice
   roll, so a student can plan against it:

       facing them, arm down     → the CORE takes it
       facing them, arm up       → that ARM takes a quarter of it
       facing away               → the CORE takes half again, and the
                                   SENSOR is knocked about

   Which is why flanking is worth doing: it blinds them. And why a
   student who blocks everything ends the round with one arm.
   ===================================================================== */
(function(root){

  const MECHACODE = (typeof module!=='undefined' && module.exports)
    ? require('./mechacode.js') : root.MECHACODE;

  /* Every number a match is played by, in one place, because the console
     prints these at the student and they have to be the same numbers. */
  const RULES = {
    hz:20,                    // the tick the whole thing is stepped at
    radius:20,                // the floor, in metres
    rounds:3, roundTime:90,   // best of three, ninety seconds each
    bodyR:1.3,                // how wide a mecha is
    walk:6.4, run:9.2,        // metres a second, on good legs
    energyMax:100, regen:6,   // energy a second, back
    heatMax:100, cool:4.5,    // heat a second, gone
    overheat:2.6,             // seconds locked out when it hits the top
    sensorRange:14,           // how far the sensor sees
    parts:{ left_arm:100, right_arm:100, legs:100, sensor:100, core:200 }
  };

  /* What each action costs, how long it takes, and what it does. The
     timings are the balance: a punch is half a second end to end and a
     heavy is a whole one, which is the only reason throwing a heavy at
     the wrong moment is a mistake. */
  const MOVES = {
    punch:{ wind:0.20, rec:0.30, reach:3.8, dmg:9,  arm:true },
    heavy:{ wind:0.45, rec:0.55, reach:4.1, dmg:22, arm:true, roots:true, legs:10 },
    block:{ wind:0.00, hold:0.70, rec:0.15, arm:true },
    dodge:{ wind:0.00, dur:0.30, rec:0.35, speed:15 },
    brace:{ wind:0.00, dur:0.50, rec:0.10 }
  };
  const COST = MECHACODE.ACTIONS;   // energy and heat live with the blocks

  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const norm=a=>{ while(a>Math.PI) a-=Math.PI*2; while(a<-Math.PI) a+=Math.PI*2; return a; };

  /* ------------------------------------------------------------ a mecha */
  function makeRobot(side, name, programs, angle){
    const r={
      side, name: name||side,
      x:Math.sin(angle)*(RULES.radius-5), z:Math.cos(angle)*(RULES.radius-5),
      yaw:norm(angle+Math.PI),          // both of them looking at the middle
      vx:0, vz:0,
      parts:Object.assign({}, RULES.parts),
      energy:RULES.energyMax, heat:0, lock:0,
      programs:programs||{},
      arms:{ left_arm:limb(), right_arm:limb() },
      legs:limb(),
      hitT:0,                            // how long since something landed
      stats:zeroStats(),
      wins:0
    };
    return r;
  }
  const limb = ()=>({ state:'idle', act:null, t:0, why:'' });
  const zeroStats = ()=>({ punches:0, landed:0, blocks:0, blocked:0, dodges:0,
                           heavies:0, stalls:0, overheats:0, spent:0, wasted:0,
                           dealt:0, taken:0 });

  const maxEnergy = r => Math.max(40, Math.round(RULES.energyMax * r.parts.core/RULES.parts.core));
  const legFactor = r => 0.45 + 0.55*(r.parts.legs/RULES.parts.legs);
  const blind     = r => r.parts.sensor<=0;

  /* ---------------------------------------------------------- the match */
  class Match {
    constructor(opts){
      opts=opts||{};
      this.rules=Object.assign({}, RULES, opts.rules||{});
      this.names=opts.names||{ A:'A', B:'B' };
      this.programs=opts.programs||{ A:{}, B:{} };
      this.round=0; this.over=false; this.result=null;
      this.t=0; this.clock=0;
      this.log=[];                    // what happened, for the analysis screen
      this.robots={};
      this.input={ A:blankInput(), B:blankInput() };
      this.startRound();
    }
    /* Everything resets between rounds — including the damage. A round
       that carried it would be one long fight with a bell in the middle,
       and the point of three of them is three chances to try a plan. */
    startRound(){
      this.round++;
      this.clock=this.rules.roundTime;
      this.roundOver=null;
      const A=makeRobot('A', this.names.A, this.programs.A, 0);
      const B=makeRobot('B', this.names.B, this.programs.B, Math.PI);
      if(this.robots.A){ A.wins=this.robots.A.wins; B.wins=this.robots.B.wins; }
      A.first=B.first=true;            // the WHEN ROUND STARTS event, once
      this.robots={A,B};
    }
    /* What the player is holding down. Clamped here rather than trusted:
       this arrives over a socket from a machine we do not control. */
    setInput(side, i){
      const s=this.input[side]; if(!s || !i) return;
      s.fwd=clamp(+i.fwd||0,-1,1);
      s.strafe=clamp(+i.strafe||0,-1,1);
      s.yaw=isFinite(+i.yaw) ? norm(+i.yaw) : s.yaw;
      s.run=!!i.run;
    }

    /* ------------------------------------------------------- one tick */
    step(dt){
      dt=Math.min(dt||1/this.rules.hz, 0.1);
      if(this.over) return { events:[], traces:{A:[],B:[]} };
      const events=[], traces={A:[],B:[]};
      const A=this.robots.A, B=this.robots.B;

      this.t+=dt; this.clock-=dt;
      [ [A,B], [B,A] ].forEach(([me,foe])=>{
        resources(me, dt);
        drive(me, this.input[me.side], dt, this.rules);
      });
      separate(A,B,this.rules);
      /* Sensors for BOTH before either of them acts, so neither is
         reading a world the other has already changed this tick. */
      const sense={ A:sensors(A,B,this.rules), B:sensors(B,A,this.rules) };
      [ [A,B], [B,A] ].forEach(([me,foe])=>{
        think(me, sense[me.side], traces[me.side]);
        act(me, foe, dt, events, this.rules);
      });
      A.first=B.first=false;

      // did that end it?
      const dead = r => r.parts.core<=0;
      if(dead(A)||dead(B)||this.clock<=0) this.endRound(events);
      return { events, traces };
    }

    endRound(events){
      const A=this.robots.A, B=this.robots.B;
      const aDead=A.parts.core<=0, bDead=B.parts.core<=0;
      let win = aDead&&bDead ? 'draw'
              : aDead ? 'B' : bDead ? 'A'
              : A.parts.core>B.parts.core ? 'A'
              : B.parts.core>A.parts.core ? 'B' : 'draw';
      if(win==='A') A.wins++; else if(win==='B') B.wins++;
      const why = (aDead||bDead) ? 'core' : 'time';
      events.push({ kind:'round', round:this.round, winner:win, why });
      this.log.push({ round:this.round, winner:win, why,
                      core:{ A:Math.max(0,A.parts.core), B:Math.max(0,B.parts.core) },
                      stats:{ A:Object.assign({},A.stats), B:Object.assign({},B.stats) } });
      const need=Math.ceil(this.rules.rounds/2);
      if(A.wins>=need || B.wins>=need || this.round>=this.rules.rounds){
        this.over=true;
        const w = A.wins>B.wins ? 'A' : B.wins>A.wins ? 'B' : 'draw';
        this.result={ winner:w, rounds:{ A:A.wins, B:B.wins },
                      text: w==='draw' ? 'Three rounds and nothing between them.'
                          : (w==='A'?this.names.A:this.names.B)+' takes it '+
                            Math.max(A.wins,B.wins)+'–'+Math.min(A.wins,B.wins)+'.' };
        events.push({ kind:'over', winner:w });
      } else {
        this.startRound();
        events.push({ kind:'newround', round:this.round });
      }
    }

    /* What goes on the wire. Rounded, because a millimetre of a mecha's
       position is not worth a byte and both ends have to agree anyway. */
    snapshot(){
      const one=r=>({
        x:+r.x.toFixed(2), z:+r.z.toFixed(2), yaw:+r.yaw.toFixed(3),
        e:Math.round(r.energy), h:Math.round(r.heat), lock:+r.lock.toFixed(2),
        p:{ la:Math.max(0,Math.round(r.parts.left_arm)), ra:Math.max(0,Math.round(r.parts.right_arm)),
            lg:Math.max(0,Math.round(r.parts.legs)),     sn:Math.max(0,Math.round(r.parts.sensor)),
            co:Math.max(0,Math.round(r.parts.core)) },
        a:{ l:r.arms.left_arm.state+':'+(r.arms.left_arm.act||''),
            r:r.arms.right_arm.state+':'+(r.arms.right_arm.act||''),
            g:r.legs.state+':'+(r.legs.act||'') },
        w:r.wins
      });
      return { t:+this.t.toFixed(2), round:this.round, clock:Math.max(0,+this.clock.toFixed(1)),
               A:one(this.robots.A), B:one(this.robots.B),
               over:this.over, result:this.result };
    }
    /* The numbers the analysis screen reads back afterwards. */
    stats(side){ return Object.assign({}, this.robots[side].stats); }
  }
  const blankInput = ()=>({ fwd:0, strafe:0, yaw:0, run:false });

  /* -------------------------------------------------------- resources */
  function resources(r, dt){
    const max=maxEnergy(r);
    r.energy=Math.min(max, r.energy + RULES.regen*dt);
    r.heat=Math.max(0, r.heat - RULES.cool*dt);
    if(r.lock>0){ r.lock=Math.max(0, r.lock-dt); }
    r.hitT+=dt;
  }

  /* ------------------------------------------------------------ moving
     The player's half. Nothing here consults a program: this is the
     student's hands on the keys, and the only things that change it are
     their own legs being wrecked, a dodge being under way, or a heavy
     punch having rooted them where they stand. */
  function drive(r, input, dt, rules){
    r.px=r.x; r.pz=r.z;              // where we were, for the contact below
    r.yaw=input.yaw;
    let speed=(input.run ? rules.run : rules.walk)*legFactor(r);
    const rooted = r.arms.left_arm.rooted || r.arms.right_arm.rooted;
    if(rooted) speed*=0.15;
    if(r.legs.state==='act' && r.legs.act==='brace') speed*=0.5;

    let vx=0, vz=0;
    if(r.legs.state==='act' && r.legs.act==='dodge'){
      // a dodge goes where the legs were told to go, not where you steer
      vx=r.legs.dx*MOVES.dodge.speed; vz=r.legs.dz*MOVES.dodge.speed;
    } else {
      const s=Math.sin(r.yaw), c=Math.cos(r.yaw);
      const f=input.fwd, st=input.strafe;
      const len=Math.hypot(f,st)||1;
      vx=(s*f + c*st)/len*speed*Math.hypot(f,st);
      vz=(c*f - s*st)/len*speed*Math.hypot(f,st);
    }
    r.x+=vx*dt; r.z+=vz*dt; r.vx=vx; r.vz=vz;

    // the wall of the arena, which nobody gets to walk through
    const d=Math.hypot(r.x,r.z), lim=rules.radius-rules.bodyR;
    if(d>lim){ const k=lim/d; r.x*=k; r.z*=k; }
  }
  /* Two mechas cannot stand in the same square metre — and, less
     obviously, they cannot end up on the wrong sides of each other.

     Pushing them apart along the line between them is not enough on its
     own. Two players walking straight into each other are held at arm's
     length by that push, but the line between them is never exactly
     square to the way they are walking, so they grind sideways a little
     more each tick until they slip past — and then the push, still
     working along that line, drives them apart on the far side. Head-on
     they walked THROUGH each other and out the other side.

     So the sides are checked: if the vector between them reversed over
     this tick, they went through, and both are put back where they were
     standing. Walking into somebody is walking into a wall. */
  function separate(a, b, rules){
    let dx=b.x-a.x, dz=b.z-a.z;
    const ox=b.px-a.px, oz=b.pz-a.pz;
    if(dx*ox + dz*oz <= 0){
      a.x=a.px; a.z=a.pz; b.x=b.px; b.z=b.pz;
      dx=ox; dz=oz;
    }
    const d=Math.hypot(dx,dz), min=rules.bodyR*2;
    if(d>=min || d<1e-4) return;
    const push=(min-d)/2, nx=dx/d, nz=dz/d;
    a.x-=nx*push; a.z-=nz*push;
    b.x+=nx*push; b.z+=nz*push;
  }

  /* ----------------------------------------------------------- sensing
     What the code is allowed to know. A wrecked sensor is not a penalty
     bolted on the side — it is this function lying, which is exactly
     what a broken sensor does. */
  function sensors(me, foe, rules){
    const dx=foe.x-me.x, dz=foe.z-me.z;
    const dist=Math.hypot(dx,dz);
    const dead=blind(me);
    const coarse=me.parts.sensor < rules.parts.sensor*0.5;
    const seen = !dead && dist<=rules.sensorRange;

    // are they looking at me? their nose against the line between us
    const toMe=Math.atan2(-dx,-dz);
    const facing=Math.abs(norm(toMe-foe.yaw))<0.9 ? 1 : 0;

    // is a fist on its way? their arm in windup, in reach, pointed here
    let incoming=false;
    ['left_arm','right_arm'].forEach(k=>{
      const l=foe.arms[k];
      if(l.state!=='wind') return;
      const m=MOVES[l.act]; if(!m) return;
      if(dist<=m.reach+1.2 && Math.abs(norm(Math.atan2(dx,dz)-foe.yaw+Math.PI))<1.1) incoming=true;
    });

    const num = v => coarse ? Math.round(v) : v;
    const read={
      enemy_distance: seen ? num(dist) : 99,
      enemy_health:   seen ? num(foe.parts.core/rules.parts.core*100) : 0,
      my_health:      me.parts.core/rules.parts.core*100,
      my_energy:      me.energy,
      my_heat:        me.heat,
      enemy_facing:   seen ? facing : 0
    };
    return { read, dist, seen, toFoe:Math.atan2(dx,dz),
      events:{
        start:!!me.first,
        enemy_detected: seen,
        incoming_attack: seen && incoming,
        hit: me.hitT<0.4,
        health_low: read.my_health<33,
        energy_low: me.energy<15
      } };
  }

  /* ------------------------------------------------------- the orders
     Every part that holds a program and is free to act gets asked. A
     part that is busy is not asked at all — which is why a program full
     of good ideas can still do nothing while the arm is recovering, and
     why the trace says "busy" rather than staying silent about it. */
  function think(r, s, out){
    ['left_arm','right_arm'].forEach(id=>{
      const limbState=r.arms[id];
      const line={ part:id, steps:[] };
      if(r.parts[id]<=0){ line.steps.push({kind:'stall', why:'that arm is destroyed'}); out.push(line); return; }
      if(r.lock>0){ line.steps.push({kind:'stall', why:'overheated'}); out.push(line); return; }
      if(limbState.state!=='idle'){ return; }          // busy: nothing to say
      const d=MECHACODE.decide(r.programs[id]||[], s);
      line.steps=d.trace;
      if(d.action) begin(r, id, d.action, line);
      out.push(line);
    });
    const line={ part:'legs', steps:[] };
    if(r.legs.state==='idle' && r.lock<=0 && r.parts.legs>0){
      const d=MECHACODE.decide(r.programs.legs||[], s);
      line.steps=d.trace;
      if(d.action) begin(r, 'legs', d.action, line, s);
      out.push(line);
    } else if(r.parts.legs<=0 && (r.programs.legs||[]).length){
      line.steps.push({kind:'stall', why:'the legs are wrecked'});
      out.push(line);
    }
  }
  /* Paying for an action is where most "why did nothing happen" lives,
     so every refusal writes down its reason in the same trace the
     student is already reading. */
  function begin(r, id, action, line, s){
    const kind=action.act, m=MOVES[kind], def=COST[kind];
    if(!m || !def) return;
    if(def.part==='arm' && id==='legs') return;
    if(def.part==='legs' && id!=='legs') return;
    if(r.energy<def.energy){
      line.steps.push({ kind:'stall', why:'not enough energy for '+def.label });
      r.stats.stalls++; return;
    }
    r.energy-=def.energy; r.heat+=def.heat; r.stats.spent+=def.energy;
    /* Heat is not a second thing to be refused for. It is allowed to run
       all the way to the top, and the top is where the arms lock: a
       student who wrote a program that never stops swinging finds out by
       standing there useless for two and a half seconds, which is a
       lesson, where "that action was declined" is a shrug. */
    if(r.heat>=RULES.heatMax){
      r.heat=RULES.heatMax; r.lock=RULES.overheat; r.stats.overheats++;
    }

    const limbState = id==='legs' ? r.legs : r.arms[id];
    limbState.act=kind; limbState.t=0; limbState.done=false;
    limbState.state = m.wind>0 ? 'wind' : 'act';
    limbState.rooted = !!m.roots;
    if(kind==='punch') r.stats.punches++;
    if(kind==='heavy'){ r.stats.punches++; r.stats.heavies++; }
    if(kind==='block') r.stats.blocks++;
    if(kind==='dodge'){
      r.stats.dodges++;
      /* Sideways, away from where they are — a dodge that went where the
         player happened to be leaning would be a dodge into the punch
         half the time. */
      const away=(s && s.toFoe!=null) ? s.toFoe+Math.PI/2 : r.yaw+Math.PI/2;
      limbState.dx=Math.sin(away); limbState.dz=Math.cos(away);
    }
  }

  /* --------------------------------------------------- carrying it out
     The state machine each limb walks through, and the one moment in it
     that touches the other mecha: the end of a windup. */
  function act(r, foe, dt, events, rules){
    ['left_arm','right_arm'].forEach(id=>{
      const l=r.arms[id], m=MOVES[l.act];
      if(l.state==='idle' || !m) return;
      l.t+=dt;
      if(l.state==='wind' && l.t>=m.wind){
        l.state='act'; l.t=0;
        land(r, foe, id, l.act, events, rules);       // the fist arrives here
        if(l.act!=='block'){ l.state='rec'; l.rooted=false; }
      } else if(l.state==='act'){
        if(l.act==='block' && l.t>=m.hold){ l.state='rec'; l.t=0; }
        else if(l.act!=='block'){ l.state='rec'; l.t=0; }
      } else if(l.state==='rec' && l.t>=m.rec){
        l.state='idle'; l.act=null; l.rooted=false; l.t=0;
      }
    });
    const g=r.legs, gm=MOVES[g.act];
    if(g.state!=='idle' && gm){
      g.t+=dt;
      if(g.state==='act' && g.t>=(gm.dur||0)){ g.state='rec'; g.t=0; }
      else if(g.state==='rec' && g.t>=gm.rec){ g.state='idle'; g.act=null; g.t=0; }
    }
  }

  /* ------------------------------------------------------------ impact
     Where a punch goes is a rule, not a dice roll, and the rule is the
     one printed at the top of this file. */
  function land(me, foe, armId, kind, events, rules){
    const m=MOVES[kind];
    if(!m || kind==='block') return;
    const dx=foe.x-me.x, dz=foe.z-me.z;
    const dist=Math.hypot(dx,dz);
    const off=Math.abs(norm(Math.atan2(dx,dz)-me.yaw));
    const reached = dist<=m.reach+rules.bodyR && off<0.9;
    if(!reached){
      me.stats.wasted+=COST[kind].energy;
      events.push({ kind:'miss', side:me.side, act:kind });
      return;
    }
    // mid-dodge, nothing touches them
    if(foe.legs.state==='act' && foe.legs.act==='dodge'){
      me.stats.wasted+=COST[kind].energy;
      events.push({ kind:'dodged', side:foe.side, from:me.side });
      return;
    }
    /* Their back is turned: it lands on the core, harder, and rattles
       the sensor. Flanking is worth doing because it blinds them. */
    const facingMe = Math.abs(norm(Math.atan2(-dx,-dz)-foe.yaw))<1.0;
    let part='core', dmg=m.dmg, note='';
    if(!facingMe){
      dmg=Math.round(dmg*1.5);
      hurt(foe,'sensor',6,events,me.side);
      note='from behind';
    } else {
      // the arm on the side the punch came from is the one that can stop it
      const guard = armId==='left_arm' ? 'right_arm' : 'left_arm';
      const g=foe.arms[guard];
      const up = foe.parts[guard]>0 && (g.state==='act'||g.state==='wind') && g.act==='block';
      if(up && kind==='punch'){ part=guard; dmg=Math.round(m.dmg*0.25); note='blocked'; foe.stats.blocked++; }
      else if(up && kind==='heavy'){
        // a heavy goes through a guard, and the arm pays for stopping half
        hurt(foe, guard, Math.round(m.dmg*0.5), events, me.side);
        dmg=Math.round(m.dmg*0.5); note='through the guard';
      }
    }
    if(kind==='heavy') hurt(foe,'legs',m.legs,events,me.side);
    hurt(foe, part, dmg, events, me.side);
    me.stats.landed++; me.stats.dealt+=dmg; foe.stats.taken+=dmg;
    foe.hitT=0;
    events.push({ kind:'hit', side:me.side, at:foe.side, act:kind, part, dmg, note,
                  x:+foe.x.toFixed(2), z:+foe.z.toFixed(2) });
  }
  function hurt(r, part, dmg, events, from){
    if(r.parts[part]<=0) return;
    const was=r.parts[part];
    r.parts[part]=Math.max(0, r.parts[part]-dmg);
    if(was>0 && r.parts[part]<=0)
      events.push({ kind:'broken', side:r.side, part, from });
  }

  const API={ Match, RULES, MOVES, makeRobot, maxEnergy, sensors };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.MECHAARENA=API;
})(typeof self!=='undefined' ? self : this);
