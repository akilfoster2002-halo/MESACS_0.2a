/* =====================================================================
   BOUT — the fight. No screen, no clock, no sockets.

   Handed two robots, two sets of orders and what the two drivers are
   holding down, it steps the fight forward and says what happened. It
   runs in a browser for practice and on the server for a real match,
   and it is the SAME file both times, so nobody ever trains against
   rules that turn out not to be the real ones.

   ------------------------------------------------------------------
   THE SPLIT, WHICH IS THE WHOLE GAME

       the driver decides            the code decides
       ─────────────────            ────────────────
       where to stand                punch, heavy, block, dodge, brace
       when to close, when to run    WHEN to do any of them

   You cannot punch. There is no punch key. If your robot is standing
   there doing nothing while it is being hit, that is not bad reflexes,
   it is a bug in your left arm, and it is a bug you can go and read.

   ------------------------------------------------------------------
   THE CONTROLS ARE TWO NUMBERS

   `fwd` closes or opens the distance and `side` circles. That is all a
   driver sends. There is NO AIMING: a robot turns toward whoever it is
   fighting by itself, at a rate its legs pay for.

   But it turns at a RATE, not instantly, and that one decision is what
   keeps the arena worth walking around in. Circle faster than they can
   swing their weight round and for a moment you are at their shoulder,
   where their guard is not and their sensor cannot see. Wreck their
   legs and they cannot follow you at all. So "get behind them" is a
   thing the driver does with two keys, and "hit them while you are
   there" is a thing their code has to have been written to do.

   ------------------------------------------------------------------
   EVERY EXTREMITY IS ITS OWN MACHINE

   Left arm, right arm and legs each hold their own program and each
   run their own state — winding up, holding, recovering — at the same
   time as the others. One arm can be blocking while the other throws a
   heavy, because they were given different orders. That is why the
   orders are per part rather than per robot, and it is the reason to
   look at the robot in the pit and click the bit you mean.

   Parts break separately too. A destroyed arm stops carrying out its
   orders — the program is still there and still right, it just has
   nothing to do it with. Wrecked legs slow you and slow your turn. A
   dead sensor blinds you: every reading about the enemy goes to zero,
   so a program full of IF ENEMY DISTANCE tests goes quiet, and the feed
   says so rather than leaving you to wonder.

   ------------------------------------------------------------------
   THE TRIANGLE

       BLOCK beats PUNCH    — a guard takes most of it, on the arm
       HEAVY beats BLOCK    — it goes through a guard and finds the core
       PUNCH beats HEAVY    — a heavy roots you while it winds up

   Three rules, no dice. A fight comes out the same way twice given the
   same programs and the same driving, which is what makes changing one
   block a thing you can learn from.

   ------------------------------------------------------------------
   AND A HIT WEIGHS SOMETHING

   HITSTOP freezes BOTH robots for a moment on impact — nothing moves,
   nothing thinks, no timer advances. HITSTUN is the victim's alone:
   for a moment their parts take no new orders and their driver has no
   steering. KNOCKBACK throws them, and it grows as their core goes, so
   the last hit of a fight sends them further than the first.

   Those three ideas come from reading SlopArena (MIT, © MPXXV), which
   is a Unity game in C# and shares no code with this one.
   ===================================================================== */
(function(root){

  const CODE   = (typeof require!=='undefined') ? require('./mechacode.js') : root.MECHACODE;
  const ROBOTS = (typeof require!=='undefined') ? require('./robots.js')    : root.ROBOTS;

  /* ------------------------------------------------------------ rules
     Every number a fight is played by, in one place, so balancing is
     editing this block and running the tests rather than reading a
     thousand lines looking for where a 9 came from. A robot's row in
     robots.js multiplies these; it never replaces them. */
  const RULES = {
    hz:20,                    // the tick the whole thing is stepped at
    radius:18,                // the floor, in metres
    time:90,                  // one fight, ninety seconds, no bell
    bodyR:1.25,               // how wide a robot is
    walk:6.0, run:8.6,        // metres a second, on good legs
    turn:3.2,                 // radians a second a robot swings round to face you
    energyMax:100, regen:7,   // energy a second, back
    sensorRange:14,           // how far the sensor sees
    behind:2.2,               // radians of arc that counts as "looking at you"

    /* The feel. See the header — these three are the difference between
       two robots subtracting numbers from each other and a fight. */
    stop:{ punch:0.10, heavy:0.20, blocked:0.05 },
    stun:{ punch:0.22, heavy:0.42, blocked:0.10 },
    kb:{ punch:{ base:6,  growth:5  },
         heavy:{ base:15, growth:10 },
         blocked:{ base:3, growth:0 } },
    kbDrag:5.5,               // how fast a shove bleeds off, per second
    braceKb:0.35              // what is left of a shove if you planted your feet
  };

  /* What each action takes and what it does. The TIMINGS are the
     balance: a punch is under half a second end to end and a heavy is a
     whole one, which is the only reason throwing a heavy at the wrong
     moment is a mistake rather than free damage. `reach` is measured
     from the edge of one robot to the edge of the other, not centre to
     centre, so a wide robot does not get reach for being wide. */
  const MOVES = {
    punch:{ limb:'arm',  wind:0.18, rec:0.28, reach:1.60, dmg:9  },
    heavy:{ limb:'arm',  wind:0.45, rec:0.55, reach:1.40, dmg:22, roots:true },
    block:{ limb:'arm',  wind:0.00, hold:0.70, rec:0.15 },
    dodge:{ limb:'legs', wind:0.00, dur:0.30, rec:0.35, speed:14 },
    brace:{ limb:'legs', wind:0.00, dur:0.50, rec:0.10 }
  };
  const COST = CODE.ACTIONS;          // energy lives with the blocks
  const LIMBS = ['left_arm','right_arm','legs'];

  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const norm=a=>{ while(a>Math.PI) a-=Math.PI*2; while(a<-Math.PI) a+=Math.PI*2; return a; };

  /* ------------------------------------------------------------ a robot */
  function make(side, name, specId, programs, angle){
    const spec=ROBOTS.get(specId);
    const r={
      side, name, spec, specId:spec.id,
      x:Math.cos(angle)*6, z:Math.sin(angle)*6,
      yaw:norm(angle+Math.PI),          // both of them start looking inward
      vx:0, vz:0,                       // knockback only; walking is applied straight
      energy:RULES.energyMax*spec.energy,
      stop:0, stun:0, first:true,
      parts:{}, limb:{}, programs:programs||{},
      hurt:0,                           // counts down; the WHEN HIT event
      stats:{ punches:0, landed:0, blocks:0, dodges:0, stalls:0,
              dealt:0, taken:0, blocked:0, spent:0, wasted:0 }
    };
    Object.keys(spec.parts).forEach(p=>{ r.parts[p]=spec.parts[p]; });
    LIMBS.forEach(l=>{ r.limb[l]={ act:null, phase:null, t:0, blockId:null }; });
    r.R = RULES.bodyR * (0.85 + 0.3*(spec.rig.chest||1));
    return r;
  }
  const maxEnergy = r => RULES.energyMax * r.spec.energy;
  const legs      = r => 0.45 + 0.55*(r.parts.legs/r.spec.parts.legs);
  const blind     = r => r.parts.sensor<=0;
  const dead      = r => r.parts.core<=0;
  const broken    = (r,l) => r.parts[l]!==undefined && r.parts[l]<=0;

  /* Is `foe` looking at `me`? Used for flanking, and read by the
     ENEMY FACING ME sensor, so the thing a student can write code about
     is exactly the thing the damage rule uses. */
  function facing(foe, me){
    const want=Math.atan2(me.z-foe.z, me.x-foe.x);
    return Math.abs(norm(want-foe.yaw)) < RULES.behind/2;
  }
  const gapBetween = (a,b) => Math.max(0, Math.hypot(a.x-b.x, a.z-b.z) - a.R - b.R);

  /* ---------------------------------------------------------- the bout */
  class Bout {
    constructor(opts){
      opts=opts||{};
      this.rules=Object.assign({}, RULES, opts.rules||{});
      this.names=opts.names||{ A:'A', B:'B' };
      this.robots_=opts.robots||{ A:'noisyboy', B:'ambush' };
      this.programs=opts.programs||{ A:{}, B:{} };
      this.t=0; this.clock=this.rules.time;
      this.over=false; this.result=null;
      this.input={ A:{fwd:0,side:0,run:false}, B:{fwd:0,side:0,run:false} };
      this.robots={
        A: make('A', this.names.A, this.robots_.A, this.programs.A, 0),
        B: make('B', this.names.B, this.robots_.B, this.programs.B, Math.PI)
      };
    }

    /* What the driver is holding down. Clamped rather than trusted:
       this arrives over a socket from a machine we do not control, and
       a client that sends fwd:900 is a client asking to be clamped. */
    setInput(side, i){
      const s=this.input[side]; if(!s || !i) return;
      s.fwd  = clamp(+i.fwd  || 0, -1, 1);
      s.side = clamp(+i.side || 0, -1, 1);
      s.run  = !!i.run;
    }

    /* --------------------------------------------------------- a tick */
    step(dt){
      dt=Math.min(dt||1/this.rules.hz, 0.1);
      if(this.over) return { events:[], traces:{A:[],B:[]} };
      const events=[], traces={A:[],B:[]};
      const A=this.robots.A, B=this.robots.B;

      this.t+=dt; this.clock-=dt;

      /* Frozen means frozen. No energy back, no limb advancing, no
         order asked, nothing moved. The one thing that keeps running is
         the fight clock, because a fight you could extend by landing
         punches would be a fight decided by who punched most. */
      [[A,B],[B,A]].forEach(([me,foe])=>{
        if(me.stop>0){ me.stop=Math.max(0,me.stop-dt); return; }
        me.stun=Math.max(0,me.stun-dt);
        me.hurt=Math.max(0,me.hurt-dt);
        me.energy=Math.min(maxEnergy(me), me.energy + this.rules.regen*dt);
        this.drive(me, foe, this.input[me.side], dt);
      });
      this.separate(A,B);

      /* Both sensors read BEFORE either acts, so neither is looking at
         a world the other has already changed this tick. */
      const sense={ A:this.sense(A,B), B:this.sense(B,A) };
      [[A,B],[B,A]].forEach(([me,foe])=>{
        if(me.stop>0) return;
        this.think(me, sense[me.side], traces[me.side]);
        this.advance(me, foe, dt, events);
      });
      A.first=B.first=false;

      if(dead(A)||dead(B)||this.clock<=0) this.finish(events);
      return { events, traces };
    }

    /* ------------------------------------------------------- driving
       The driver's two numbers, plus the turn that happens by itself.
       `fwd` is toward the enemy and `side` is round them, so the keys
       mean the same thing wherever on the floor you are standing —
       which is the point of taking the aiming away. */
    drive(me, foe, i, dt){
      const rooted = LIMBS.some(l=>{
        const b=me.limb[l];
        return b.act && MOVES[b.act].roots && b.phase!=='rec';
      });

      /* Turning toward them is free and automatic, but it is not
         instant, and bad legs make it slower. */
      const want=Math.atan2(foe.z-me.z, foe.x-me.x);
      const rate=this.rules.turn*legs(me)*dt;
      me.yaw = norm(me.yaw + clamp(norm(want-me.yaw), -rate, rate));

      const d=me.limb.legs;
      if(d.act==='dodge' && d.phase==='act'){
        /* A dodge is the legs moving you, not the driver. It goes the
           way you were already leaning, or sideways if you were not
           leaning anywhere, because a dodge into nothing is a dodge
           that was never worth the energy. */
        const dir = d.dir || 1;
        const sx=Math.cos(me.yaw+Math.PI/2)*dir, sz=Math.sin(me.yaw+Math.PI/2)*dir;
        me.x+=sx*MOVES.dodge.speed*dt; me.z+=sz*MOVES.dodge.speed*dt;
      } else if(!rooted && me.stun<=0 && !dead(me)){
        const sp=(i.run?this.rules.run:this.rules.walk)*legs(me)*me.spec.speed;
        const fx=Math.cos(me.yaw), fz=Math.sin(me.yaw);
        const rx=Math.cos(me.yaw+Math.PI/2), rz=Math.sin(me.yaw+Math.PI/2);
        const braced = me.limb.legs.act==='brace' && me.limb.legs.phase==='act';
        const mul = braced ? 0.35 : 1;
        me.x += (fx*i.fwd + rx*i.side)*sp*mul*dt;
        me.z += (fz*i.fwd + rz*i.side)*sp*mul*dt;
      }

      // whatever is left of a shove
      me.x+=me.vx*dt; me.z+=me.vz*dt;
      const drag=Math.max(0, 1-this.rules.kbDrag*dt);
      me.vx*=drag; me.vz*=drag;

      // nobody leaves the floor
      const d2=Math.hypot(me.x,me.z), lim=this.rules.radius-me.R;
      if(d2>lim){ const k=lim/d2; me.x*=k; me.z*=k; me.vx*=0.3; me.vz*=0.3; }
    }

    /* Two robots are solid. Pushed apart evenly, except that a heavier
       one gives less ground — which is how AMBUSH walks people down. */
    separate(a,b){
      const dx=b.x-a.x, dz=b.z-a.z;
      let d=Math.hypot(dx,dz); const min=a.R+b.R;
      if(d>=min) return;
      if(d<0.0001){ d=0.0001; }
      const push=(min-d), ux=dx/d, uz=dz/d;
      const wa=b.spec.bulk/(a.spec.bulk+b.spec.bulk);
      a.x-=ux*push*wa;     a.z-=uz*push*wa;
      b.x+=ux*push*(1-wa); b.z+=uz*push*(1-wa);
    }

    /* ------------------------------------------------------- sensors
       What one robot can see this instant, in the shape mechacode
       reads. A blind robot sees nothing ABOUT THE ENEMY and everything
       about itself, which is the honest version of a broken camera. */
    sense(me, foe){
      const see = !blind(me) && gapBetween(me,foe)<=this.rules.sensorRange;
      const dist=Math.hypot(me.x-foe.x, me.z-foe.z);
      const winding = LIMBS.some(l=>{
        const b=foe.limb[l];
        return b.act && MOVES[b.act].limb==='arm' && MOVES[b.act].dmg && b.phase==='wind';
      });
      return {
        events:{
          start:me.first,
          enemy_detected:see,
          incoming_attack:see && winding && dist < 6,
          hit:me.hurt>0,
          health_low:me.parts.core < me.spec.parts.core/3,
          energy_low:me.energy < maxEnergy(me)*0.2
        },
        read:{
          enemy_distance:see ? dist : 0,
          enemy_health:see ? foe.parts.core : 0,
          enemy_facing:see ? (facing(foe,me)?1:0) : 0,
          my_health:me.parts.core,
          my_energy:me.energy
        },
        blind:!see
      };
    }

    /* ---------------------------------------------------- the orders
       Every limb that is still attached and not already busy is asked
       one question: given what you can see, what do you do? At most one
       action comes back, and the steps that led to it come back with
       it, because "why didn't it punch?" is the question this whole
       thing exists to answer on screen. */
    think(me, s, out){
      if(me.stun>0 || dead(me)) return;
      LIMBS.forEach(l=>{
        const b=me.limb[l];
        if(b.act) return;                           // still busy with the last one
        const prog=me.programs[l]||[];
        if(!prog.length) return;
        if(broken(me,l)){
          out.push({ part:l, steps:[{ kind:'stall', why:'This part is destroyed.' }] });
          return;
        }
        const d=CODE.decide(prog, s);
        const steps=d.trace.slice();
        if(d.action){
          const act=d.action.act, cost=(COST[act]||{}).energy||0;
          if(MOVES[act].limb==='arm' && l==='legs') return;   // cannot happen; validate blocks it
          if(me.energy<cost){
            me.stats.stalls++;
            steps.push({ kind:'stall', why:'Not enough energy for '+(COST[act]||{}).label+'.' });
          } else {
            me.energy-=cost; me.stats.spent+=cost;
            b.act=act; b.phase=MOVES[act].wind ? 'wind' : 'act';
            b.t=MOVES[act].wind || MOVES[act].hold || MOVES[act].dur || 0;
            if(MOVES[act].limb==='arm' && MOVES[act].dmg) b.t*=me.spec.swing;
            b.blockId=d.action.blockId; b.hit=false;
            if(act==='dodge'){ b.dir = this.input[me.side].side>=0 ? 1 : -1; me.stats.dodges++; }
            if(act==='block') me.stats.blocks++;
            if(MOVES[act].dmg) me.stats.punches++;
          }
        } else if(s.blind && prog.length){
          steps.push({ kind:'stall', why:'Sensor is down — nothing can be seen.' });
        }
        if(steps.length) out.push({ part:l, steps });
      });
    }

    /* ------------------------------------------- carrying them out
       A limb walks its own little state machine. An arm swinging looks
       for the enemy exactly once, at the end of its wind-up, which is
       what makes WHEN the swing started matter. */
    advance(me, foe, dt, events){
      LIMBS.forEach(l=>{
        const b=me.limb[l]; if(!b.act) return;
        const m=MOVES[b.act];
        b.t-=dt;
        if(b.t>0) return;
        if(b.phase==='wind'){
          if(m.dmg && !b.hit){ b.hit=true; this.land(me, foe, l, b, events); }
          b.phase='rec'; b.t=m.rec*(m.dmg?me.spec.swing:1);
        } else if(b.phase==='act'){
          b.phase='rec'; b.t=m.rec;
        } else {
          b.act=null; b.phase=null; b.t=0; b.blockId=null;
        }
      });
    }

    /* --------------------------------------------------- does it land
       One swing, one answer. Reach is edge to edge, the guard is read
       off the other robot's arms, and the damage goes to a PART by rule
       rather than to a health bar by dice. */
    land(me, foe, limb, b, events){
      const m=MOVES[b.act];
      const gap=gapBetween(me,foe);
      const reach=m.reach*me.spec.reach;
      if(gap>reach){
        me.stats.wasted += (COST[b.act]||{}).energy||0;
        events.push({ kind:'miss', side:me.side, limb, act:b.act });
        return;
      }
      // are they mid-dodge? then it goes past them
      const d=foe.limb.legs;
      if(d.act==='dodge' && d.phase==='act'){
        me.stats.wasted += (COST[b.act]||{}).energy||0;
        events.push({ kind:'miss', side:me.side, limb, act:b.act, why:'dodged' });
        return;
      }

      const behind = !facing(foe, me);
      const guard = ['left_arm','right_arm'].find(a=>
        foe.limb[a].act==='block' && foe.limb[a].phase!=='rec' && !broken(foe,a)) || null;

      let dmg=m.dmg*me.spec.power, part='core', note='clean';
      if(behind){
        /* From behind, the plate is not there and neither is the
           camera. Flanking blinds them, which is what makes circling
           worth the two keys it costs. */
        dmg*=1.5; note='behind';
        foe.parts.sensor=Math.max(0, foe.parts.sensor-dmg*0.4);
      } else if(guard && b.act==='punch'){
        part=guard; dmg*=0.25; note='blocked'; foe.stats.blocked++;
      } else if(guard && b.act==='heavy'){
        note='through';                       // a heavy goes through a guard
      }
      dmg=Math.round(dmg/foe.spec.armour);

      foe.parts[part]=Math.max(0, foe.parts[part]-dmg);
      me.stats.landed++; me.stats.dealt+=dmg; foe.stats.taken+=dmg;
      foe.hurt=0.25;

      /* The three that make it weigh something. */
      const key = note==='blocked' ? 'blocked' : b.act;
      const lost = 1 - foe.parts.core/foe.spec.parts.core;
      me.stop=foe.stop=this.rules.stop[key];
      foe.stun=Math.max(foe.stun, this.rules.stun[key]);
      let kb=this.rules.kb[key].base + this.rules.kb[key].growth*lost;
      if(foe.limb.legs.act==='brace' && foe.limb.legs.phase==='act') kb*=this.rules.braceKb;
      kb/=foe.spec.bulk;
      const ux=(foe.x-me.x)||0.001, uz=(foe.z-me.z)||0, n=Math.hypot(ux,uz);
      foe.vx+=ux/n*kb; foe.vz+=uz/n*kb;

      events.push({ kind:'hit', side:me.side, limb, act:b.act, part, note,
                    dmg, stop:me.stop, x:foe.x, z:foe.z });
    }

    /* ---------------------------------------------------------- the end
       One fight. No rounds and no bell: the way to get another go at it
       is to walk back to the pit, change a block and come back, which
       is the loop this whole mode is for. */
    finish(events){
      const A=this.robots.A, B=this.robots.B;
      const aDead=dead(A), bDead=dead(B);
      const w = aDead&&bDead ? 'draw'
              : aDead ? 'B' : bDead ? 'A'
              : A.parts.core>B.parts.core ? 'A'
              : B.parts.core>A.parts.core ? 'B' : 'draw';
      this.over=true;
      const why = (aDead||bDead) ? 'core' : 'time';
      this.result={ winner:w, why,
        core:{ A:Math.max(0,Math.round(A.parts.core)), B:Math.max(0,Math.round(B.parts.core)) },
        text: w==='draw' ? 'Ninety seconds and nothing between them.'
            : why==='core' ? (w==='A'?A.name:B.name)+' is the only one still standing.'
            : (w==='A'?A.name:B.name)+' finishes with more core left.' };
      events.push({ kind:'over', winner:w });
    }

    /* What goes on the wire. Rounded, because a millimetre of a robot's
       position is not worth a byte and both ends have to agree anyway. */
    snapshot(){
      const one=r=>({
        r:r.specId,
        x:+r.x.toFixed(2), z:+r.z.toFixed(2), yaw:+r.yaw.toFixed(3),
        vx:+r.vx.toFixed(2), vz:+r.vz.toFixed(2),
        e:Math.round(r.energy), fz:+r.stop.toFixed(2), st:+r.stun.toFixed(2),
        p:{ la:Math.max(0,Math.round(r.parts.left_arm)),
            ra:Math.max(0,Math.round(r.parts.right_arm)),
            lg:Math.max(0,Math.round(r.parts.legs)),
            sn:Math.max(0,Math.round(r.parts.sensor)),
            co:Math.max(0,Math.round(r.parts.core)) },
        l:LIMBS.reduce((o,l)=>{ const b=r.limb[l];
            o[l]=b.act?{a:b.act,ph:b.phase,t:+b.t.toFixed(2)}:null; return o; },{})
      });
      return { t:+this.t.toFixed(2), clock:Math.max(0,+this.clock.toFixed(1)),
               A:one(this.robots.A), B:one(this.robots.B) };
    }
    stats(side){ return Object.assign({}, this.robots[side].stats); }
  }

  const API={ RULES, MOVES, LIMBS, Bout, make, facing, gapBetween };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.BOUT=API;
})(typeof self!=='undefined' ? self : this);
