/* =====================================================================
   MECHMATCH — the Gym's waiting room and its referee.

   Two students never fight each other's browsers. Each one submits a
   PROGRAM, the server holds the first one until a second arrives, and
   then the match is decided HERE, once, by the same pure referee both
   browsers are about to replay. Nobody's machine gets a vote on who won.

   WHY THE SERVER JUDGES. simulate() is a pure function of (programs,
   arena, seed), so a browser handed the same three can redraw the fight
   frame for frame — which is how the replay, the scrubber and the battle
   log keep working with no video streamed anywhere. But a browser can be
   edited and a result it reports cannot be trusted, so the winner on
   record is the one this file computed. The clients get the inputs and
   draw the same fight; the server keeps the verdict.

   ONE FLOOR, KNOWN IN ADVANCE. Every Gym match is fought on the same
   arena, and it is a point-symmetric one: crates, walls and starting
   marks all map onto themselves when the board is turned half a circle,
   so neither mark is the better one to be given. A student writes their
   program knowing exactly the map it will run on — which is the whole
   difference between a program and a guess.

   No DOM, no sockets, no database. It is handed entries and gives back
   either "wait" or a whole match, which is what makes it testable.
   ===================================================================== */
const MECHSIM = require('../public/mechsim.js');
const PROGRAM = require('../public/program.js');

/* The Gym's floor, and the rules of a Gym fight. Both are named here
   rather than sent by the browser: a match whose map or block limit is
   whatever the client asked for is not a match anybody can train for. */
const ARENA = 'energy';
const RULES = { blockLimit:20 };

const CHASSIS = Object.keys(MECHSIM.CHASSIS);
const okChassis = c => CHASSIS.includes(c);

/* Checked before anybody is put in the queue, not after a partner turns
   up: an unplayable program should cost its author a message, never cost
   somebody else their turn at the front of the line. */
function check(program){
  const r = MECHSIM.makeRules(RULES);
  return PROGRAM.validate(program||[], {
    limit:r.blockLimit, maxDepth:r.maxDepth,
    allow:MECHSIM.PALETTE, conds:MECHSIM.SENSORS.map(s=>s.id)
  });
}

class Lobby {
  /* `seed` is injectable so a test can ask for the same fight twice. */
  constructor(opts){
    this.rooms = new Map();          // room id -> the one entry waiting in it
    this.seed  = (opts && opts.seed) || (()=> (Math.random()*0x100000000)>>>0);
  }

  waiting(room){ return this.rooms.get(room) || null; }

  /* Take somebody out of the queue: they cancelled, changed room, or the
     socket dropped. Called with the player id, which is the only thing
     the caller reliably still has. */
  cancel(id){
    for(const [room,e] of this.rooms) if(e.id===id){ this.rooms.delete(room); return true; }
    return false;
  }

  /* A student presses DEPLOY. Either they wait, or there is somebody
     already waiting and this returns the whole fight. */
  add(room, entry){
    if(!room) return { status:'error', message:'You are not in a room.' };
    if(!okChassis(entry.chassis)) return { status:'error', message:'Unknown mech.' };
    if(!Array.isArray(entry.program)) return { status:'error', message:'No program.' };

    const mine = check(entry.program);
    if(!mine.ok) return { status:'rejected', errors:mine.errors };

    const held = this.rooms.get(room);
    /* Pressing DEPLOY twice replaces what you are holding rather than
       matching you against yourself. */
    if(!held || held.id===entry.id){
      this.rooms.set(room, entry);
      return { status:'waiting' };
    }
    this.rooms.delete(room);

    /* First in the queue is side A, which is the mark on the map they
       were told about. On a symmetric floor that is not an advantage;
       it is only a fact both replays have to agree on. */
    const a = { name:held.name,  chassis:held.chassis,  program:held.program },
          b = { name:entry.name, chassis:entry.chassis, program:entry.program };
    const seed = this.seed();
    const r = MECHSIM.simulate({ a, b, arena:ARENA, rules:RULES, seed });

    /* One of them submitted something the referee will not run. It was
       checked on the way in, so this is the belt to that pair of braces —
       and the blameless one goes back to the front of the queue rather
       than being punished for somebody else's program. */
    if(!r.ok){
      const bad = new Set(r.rejected.filter(x=>x.errors.length).map(x=>x.side));
      const back = bad.has('A') && !bad.has('B') ? entry
                 : bad.has('B') && !bad.has('A') ? held : null;
      if(back) this.rooms.set(room, back);
      return { status:'rejected-pair', rejected:r.rejected,
               sides:{ A:held.id, B:entry.id }, requeued:back?back.id:null };
    }

    return { status:'matched', match:{
      seed, arena:ARENA, rules:RULES,
      A:{ id:held.id,  name:held.name,  chassis:held.chassis,  program:held.program },
      B:{ id:entry.id, name:entry.name, chassis:entry.chassis, program:entry.program },
      result:{ winner:r.result.winner, reason:r.result.reason,
               text:r.result.text, turns:r.result.turns }
    }};
  }
}

module.exports = { Lobby, check, ARENA, RULES, CHASSIS };
