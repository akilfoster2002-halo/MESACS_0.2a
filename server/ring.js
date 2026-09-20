/* =====================================================================
   RING — who is waiting for a fight, and the fights that are running.

   The server is the only place a fight actually happens. Both browsers
   draw what they are sent and send back nothing but which way the driver
   is leaning. No browser gets a vote on whether a punch landed, and two
   people looking at the same fight are looking at the same numbers
   because there is only one set of them.

   WHAT GOES OUT is a snapshot per tick, plus each player's OWN trace:
   why THEIR parts did what they did. The other side's reasoning is not
   sent, because reading your opponent's program mid-fight is not
   debugging, it is looking at their cards.

   No DOM, no sockets and no database in here. It is handed two ways to
   reach people — one player, or a whole room — and knows nothing else
   about how a message gets anywhere, which is what makes it testable.
   ===================================================================== */
const BOUT   = require('../public/bout.js');
const CODE   = require('../public/mechacode.js');
const ROBOTS = require('../public/robots.js');

const LIMIT   = 24;        // blocks per part
const MAXJSON = 16000;     // a program is small; a novel is not one

/* Every part is checked against what THAT part can do, so an arm cannot
   be handed a dodge by a browser that edited its own palette. Checked on
   the way into the queue rather than when a partner turns up: an
   unplayable program should cost its author a message, never cost
   somebody else their turn at the front of the line. */
function checkPrograms(programs){
  const out={}, errors=[];
  CODE.PARTS.forEach(p=>{
    if(p.kind==='none') return;
    const prog=(programs && programs[p.id]) || [];
    if(!Array.isArray(prog)){ errors.push({ part:p.id, msg:'That is not a program.' }); return; }
    const r=CODE.validate(prog, { limit:LIMIT, allow:CODE.partActions(p.kind) });
    if(!r.ok) r.errors.forEach(e=>errors.push(Object.assign({ part:p.id }, e)));
    else out[p.id]=prog;
  });
  return { ok:!errors.length, programs:out, errors };
}

class Ring {
  constructor(io){
    this.io=io||{};
    this.waiting=new Map();     // room -> the one player queued in it
    this.live=[];               // fights being stepped right now
    this.byPlayer=new Map();    // player id -> the fight they are in
  }

  /* ------------------------------------------------------------ queue */
  join(room, player){
    if(!room) return { status:'error', message:'You are not in a room.' };
    if(this.byPlayer.has(player.id)) return { status:'error', message:'You are already in a fight.' };
    if(JSON.stringify(player.programs||null).length > MAXJSON)
      return { status:'error', message:'That program is too big to send.' };
    const check=checkPrograms(player.programs);
    if(!check.ok) return { status:'rejected', errors:check.errors };
    player.programs=check.programs;
    /* A robot nobody has heard of is the first one on the list rather
       than an error: a typo in a saved name should not stop a fight. */
    player.robot=ROBOTS.get(player.robot).id;

    const held=this.waiting.get(room);
    /* Queueing twice replaces what you are holding rather than matching
       you against yourself. */
    if(!held || held.id===player.id){
      this.waiting.set(room, player);
      return { status:'waiting' };
    }
    this.waiting.delete(room);
    return { status:'matched', match:this.start(room, held, player) };
  }
  cancel(id){
    for(const [room,p] of this.waiting) if(p.id===id){ this.waiting.delete(room); return true; }
    return false;
  }
  waitingIn(room){ return this.waiting.get(room)||null; }

  /* ----------------------------------------------------------- fights */
  start(room, a, b){
    const m=new BOUT.Bout({
      names:{ A:a.name, B:b.name },
      robots:{ A:a.robot, B:b.robot },
      programs:{ A:a.programs, B:b.programs }
    });
    const live={ room, bout:m, sides:{ A:a.id, B:b.id }, names:{ A:a.name, B:b.name },
                 robots:{ A:a.robot, B:b.robot }, ids:[a.id,b.id] };
    this.live.push(live);
    this.byPlayer.set(a.id, live);
    this.byPlayer.set(b.id, live);
    ['A','B'].forEach(side=>{
      this.io.send(live.sides[side], { t:'arena', op:'start', you:side,
        rules:{ radius:BOUT.RULES.radius, time:BOUT.RULES.time, hz:BOUT.RULES.hz,
                energyMax:BOUT.RULES.energyMax },
        names:live.names, robots:live.robots, snapshot:m.snapshot() });
    });
    return live;
  }

  /* Which way a driver is leaning. Anything at all from somebody who is
     not in a fight is simply dropped. */
  input(id, i){
    const live=this.byPlayer.get(id); if(!live) return;
    const side = live.sides.A===id ? 'A' : live.sides.B===id ? 'B' : null;
    if(side) live.bout.setInput(side, i);
  }

  /* One tick of every fight that is running. Called on a timer by the
     server; nothing in here reads a clock of its own, so a slow tick
     makes the fight slower rather than wrong. */
  tick(dt){
    for(let i=this.live.length-1;i>=0;i--){
      const live=this.live[i];
      const r=live.bout.step(dt);
      const snap=live.bout.snapshot();
      ['A','B'].forEach(side=>{
        this.io.send(live.sides[side], { t:'arena', op:'state', s:snap,
          ev:r.events, tr:r.traces[side].filter(l=>l.steps.length) });
      });
      if(live.bout.over) this.finish(live, i);
    }
  }
  finish(live, index){
    const m=live.bout;
    ['A','B'].forEach(side=>{
      this.io.send(live.sides[side], { t:'arena', op:'over', you:side,
        result:m.result, stats:{ A:m.stats('A'), B:m.stats('B') } });
    });
    if(this.io.room) this.io.room(live.room, { t:'ringbout',
      a:live.names.A, b:live.names.B,
      winner:m.result?m.result.winner:'draw',
      core:m.result?m.result.core:{A:0,B:0} });
    this.drop(live, index);
  }
  drop(live, index){
    const i = index===undefined ? this.live.indexOf(live) : index;
    if(i>=0) this.live.splice(i,1);
    live.ids.forEach(id=>this.byPlayer.delete(id));
  }
  /* Somebody's socket went away. Their opponent is standing in a ring on
     their own, so the fight is called there and then rather than leaving
     them swinging at nothing for ninety seconds. */
  leave(id){
    this.cancel(id);
    const live=this.byPlayer.get(id); if(!live) return null;
    const other = live.sides.A===id ? 'B' : 'A';
    this.io.send(live.sides[other], { t:'arena', op:'forfeit', you:other,
      result:{ winner:other, why:'left', core:{A:0,B:0},
               text:'Your opponent left the ring.' },
      stats:{ A:live.bout.stats('A'), B:live.bout.stats('B') } });
    this.drop(live);
    return other;
  }
  get running(){ return this.live.length; }
}

module.exports = { Ring, checkPrograms, LIMIT };
