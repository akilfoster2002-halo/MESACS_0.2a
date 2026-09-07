/* =====================================================================
   MECHALOBBY — who is waiting to fight, and the fights that are running.

   The Gym's lobby holds programs and decides a whole match in one go,
   because nobody is at the controls. This one cannot: the players are
   driving. So it holds LIVE matches and steps them twenty times a
   second, feeding each one what its two players are holding down.

   The server is the only place the fight actually happens. Both
   browsers draw what they are sent and send back nothing but WASD and a
   heading — no browser gets a vote on whether a punch landed, and two
   people looking at the same fight are looking at the same numbers
   because there is only one set of them.

   What goes out is a snapshot per tick, plus each player's OWN trace:
   why THEIR parts did what they did. The other side's reasoning is not
   sent, because reading your opponent's program mid-fight is not
   debugging, it is looking at their cards.
   ===================================================================== */
const ARENA = require('../public/mechaarena.js');
const CODE  = require('../public/mechacode.js');

const LIMIT = 24;             // blocks per part
const MAXJSON = 16000;        // a program is small; a novel is not one

/* Every part is checked against what THAT part can do, so an arm cannot
   be handed a dodge by a browser that edited its own palette. */
function checkPrograms(programs){
  const out={}, errors=[];
  CODE.PARTS.forEach(p=>{
    if(p.kind==='none') return;
    const prog = (programs && programs[p.id]) || [];
    if(!Array.isArray(prog)){ errors.push({ part:p.id, msg:'That is not a program.' }); return; }
    const r=CODE.validate(prog, { limit:LIMIT, allow:CODE.partActions(p.kind) });
    if(!r.ok) r.errors.forEach(e=>errors.push(Object.assign({ part:p.id }, e)));
    else out[p.id]=prog;
  });
  return { ok:!errors.length, programs:out, errors };
}

class Arena {
  /* `send` puts a message in front of one user; `room` puts one in front
     of everybody standing in a room. Both are handed in, so none of this
     file knows what a socket is. */
  constructor(io){
    this.io=io||{};
    this.waiting=new Map();     // room -> the one player queued in it
    this.live=[];               // matches being stepped right now
    this.byPlayer=new Map();    // player id -> the match they are in
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

    const held=this.waiting.get(room);
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

  /* ------------------------------------------------------------ fights */
  start(room, a, b){
    const m=new ARENA.Match({
      names:{ A:a.name, B:b.name },
      programs:{ A:a.programs, B:b.programs }
    });
    const live={ room, match:m, sides:{ A:a.id, B:b.id }, names:{ A:a.name, B:b.name },
                 ids:[a.id,b.id], t:0 };
    this.live.push(live);
    this.byPlayer.set(a.id, live);
    this.byPlayer.set(b.id, live);
    [['A',a],['B',b]].forEach(([side,who])=>{
      this.io.send(who.id, { t:'mecha', op:'start', you:side,
        rules:{ radius:ARENA.RULES.radius, roundTime:ARENA.RULES.roundTime,
                rounds:ARENA.RULES.rounds, hz:ARENA.RULES.hz,
                energyMax:ARENA.RULES.energyMax, heatMax:ARENA.RULES.heatMax,
                parts:ARENA.RULES.parts },
        names:live.names, snapshot:m.snapshot() });
    });
    return live;
  }
  /* What a player is holding down. Anything at all from somebody who is
     not in a fight is simply dropped. */
  input(id, input){
    const live=this.byPlayer.get(id); if(!live) return;
    const side = live.sides.A===id ? 'A' : live.sides.B===id ? 'B' : null;
    if(side) live.match.setInput(side, input);
  }
  /* One tick of every fight that is running. Called on a timer by the
     server; nothing in here reads a clock of its own, so a slow tick
     makes the fight slower rather than wrong. */
  tick(dt){
    for(let i=this.live.length-1;i>=0;i--){
      const live=this.live[i];
      const r=live.match.step(dt);
      const snap=live.match.snapshot();
      ['A','B'].forEach(side=>{
        this.io.send(live.sides[side], { t:'mecha', op:'state', s:snap,
          ev:r.events, tr:r.traces[side].filter(l=>l.steps.length) });
      });
      if(live.match.over) this.finish(live, i);
    }
  }
  finish(live, index){
    const m=live.match;
    ['A','B'].forEach(side=>{
      this.io.send(live.sides[side], { t:'mecha', op:'over', you:side,
        result:m.result, rounds:m.log,
        stats:{ A:m.stats('A'), B:m.stats('B') } });
    });
    if(this.io.room) this.io.room(live.room, { t:'bout',
      a:live.names.A, b:live.names.B,
      winner:m.result?m.result.winner:'draw',
      score:m.result?m.result.rounds:{A:0,B:0} });
    this.drop(live, index);
  }
  drop(live, index){
    const i = index===undefined ? this.live.indexOf(live) : index;
    if(i>=0) this.live.splice(i,1);
    live.ids.forEach(id=>this.byPlayer.delete(id));
  }
  /* Somebody's socket went away. Their opponent is standing in an arena
     on their own, so the fight is called there and then rather than
     leaving them swinging at nothing for ninety seconds. */
  leave(id){
    this.cancel(id);
    const live=this.byPlayer.get(id); if(!live) return null;
    const other = live.sides.A===id ? 'B' : 'A';
    this.io.send(live.sides[other], { t:'mecha', op:'forfeit', you:other,
      result:{ winner:other, rounds:{A:0,B:0}, text:'Your opponent left the arena.' },
      stats:{ A:live.match.stats('A'), B:live.match.stats('B') } });
    this.drop(live);
    return other;
  }
  get running(){ return this.live.length; }
}

module.exports = { Arena, checkPrograms, LIMIT };
