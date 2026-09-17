/* =====================================================================
   MISSION 8 — ION, and the four levels inside it.

   IT WAS ALWAYS ONE MISSION AND IT NEVER HAD LEVELS. `ion` is a single
   entry in the course, a single card in the menu and a single COMPLETE
   stamp, and inside it a student does four separate things across two
   worlds and three consoles: they mend Ion's morning routine on the floor
   of his kitchen, they fill in the E-45's pre-flight, they fly her two
   hundred units to the tower, and they write the rules for the
   Mechanic's belt.

   Every other mission in this course says which level you are on. This
   one said PLAY, and then PLAY again after forty minutes of work, because
   nothing was counting. Its progress existed — five flags scattered
   across house.js and planet.js, each doing its own job perfectly — and
   no one place could answer "how far in is this student".

   SO THE LEVELS ARE THE FLAGS THAT ALREADY EXIST. Not a second record of
   the same facts kept alongside them: a list, in order, of the flag each
   stage already writes. There is nothing here to fall out of step with,
   because there is nothing here that is not already true.

   WHICH IS WHY THIS IS A LIST AND NOT A COUNTER. A counter would have to
   be incremented at four call sites and would be wrong the first time
   somebody finished a stage twice, or skipped one, or started over. The
   level you are ON is derived: the first stage that is not finished.

   NOTHING IN HERE RUNS A LEVEL. house.js owns the first, planet.js owns
   the other three, and both of them go on owning them. This only knows
   what they are called and in what order.
   ===================================================================== */
window.ION = (function(){

  /* The mission's own id in the course. Everything filed under `ion_` is
     forgotten by PROGRESS.restart('ion'), which is why every flag below
     carries that prefix and why one of them had to be renamed to get it. */
  const MISSION = 'ion';

  /* ---------------------------------------------------------- the levels
     IN THE ORDER THEY HAPPEN, because "the level you got to" is a
     position in a sequence and not a set of ticks. Each one names the
     flag its own stage writes when it is finished. */
  const LEVELS = [
    { key:'ion_fixed',        name:'Ion’s console',
      blurb:'Twenty questions about less than, at least and exactly' },
    { key:'ion_ship_cleared', name:'The pre-flight',
      blurb:'Twenty of her safety rules, and where each one stops' },
    { key:'ion_flown',        name:'The tower',
      blurb:'Fly the E-45 across RYU with Ion aboard' },
    { key:'ion_belt',         name:'The belt',
      blurb:'The Mechanic’s price: twenty questions on the belt' }
  ];

  const got = k => { try{ return !!(window.PROGRESS && PROGRESS.get(k,0)); }
                     catch(e){ return false; } };

  /* WHICH LEVEL YOU ARE ON: the first one not finished, counted from zero
     the way every other mission counts. Four means the mission is done.

     IT STOPS AT THE FIRST GAP rather than counting ticks. A student who
     has somehow finished the third and not the second is not three levels
     in — they are two levels in with something odd in their save bag, and
     the honest answer is the one that sends them back to what they have
     not done. */
  function at(){
    let i=0;
    while(i<LEVELS.length && got(LEVELS[i].key)) i++;
    return i;
  }
  const finished = () => at() >= LEVELS.length;

  /* TELL PROGRESS, so the card can say which level it is about to hand
     you and the pause menu can offer a way back to the first.

     reach() only ever moves forward, so calling this more often than
     necessary is free and calling it after a stage that was already done
     changes nothing. Every stage calls it as it finishes. */
  function sync(){
    try{ if(window.PROGRESS && PROGRESS.reach) PROGRESS.reach(MISSION, at()); }
    catch(e){}
  }

  /* A stage finished: write its flag and tell the course. The stages
     could set their own flags and call sync() themselves — most of them
     did before this existed — but one door in means the flag name and the
     level list cannot drift apart. */
  function pass(key){
    try{ if(window.PROGRESS) PROGRESS.set(key, 1); }catch(e){}
    sync();
  }

  return { MISSION, LEVELS, at, sync, pass, finished,
           get count(){ return LEVELS.length; },
           /* What the level you are on is called, for anything that wants
              to say it out loud. */
           nameAt(i){ const l=LEVELS[i===undefined ? at() : i]; return l ? l.name : null; } };
})();
