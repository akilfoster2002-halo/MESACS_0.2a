/* =====================================================================
   DIFFICULTY — one dial, read live by everything that can hurt you.

   Four modes, and MEDIUM is exactly the game as tuned: every multiplier
   is 1. So "Medium" is not a compromise setting, it is the real thing,
   and the other three bend it around that centre.

   Nothing here is baked in at spawn time — every value is read at the
   moment it is used, so a student who is drowning can drop to Easy from
   the pause menu and feel it on the very next shot, without restarting
   the stage or losing their program.

   The knobs, and which way is kinder:
     chase   — everything that walks toward you. LOWER is easier.
     fireGap — the wait between enemy shots.      HIGHER is easier.
     dmg     — damage that lands on you.          LOWER is easier.
     bolt    — how fast a bullet crosses to you.  LOWER is easier,
               because a slow bolt is a bolt you can still step out of.
     time    — how much clock a time trial gives you. HIGHER is easier,
               since nothing chases you in a race — the target time is
               the only opponent there is.
   ===================================================================== */
window.DIFF = (function(){
  const LEVELS = [
    { id:'supereasy', name:'Super Easy', em:'🌱', a:'#a8e6cf',
      blurb:'Almost no pressure. For a first ever program.',
      chase:0.50, fireGap:2.20, dmg:0.40, bolt:0.70, time:1.60 },
    { id:'easy',      name:'Easy',       em:'🙂', a:'#8fd3ff',
      blurb:'Room to think, but it is still coming.',
      chase:0.75, fireGap:1.50, dmg:0.70, bolt:0.85, time:1.25 },
    { id:'medium',    name:'Medium',     em:'⚔️', a:'#ffd8a8',
      blurb:'The game as designed. Write fast, write short.',
      chase:1.00, fireGap:1.00, dmg:1.00, bolt:1.00, time:1.00 },
    { id:'hard',      name:'Hard',       em:'🔥', a:'#ff9aa2',
      blurb:'Faster, meaner, and it hits back. Loops only.',
      chase:1.35, fireGap:0.65, dmg:1.40, bolt:1.20, time:0.85 }
  ];
  const DEFAULT = 'medium';

  let current = DEFAULT;
  try{ const s=localStorage.getItem('dq_diff'); if(s && LEVELS.some(l=>l.id===s)) current=s; }catch(e){}

  function level(){ return LEVELS.find(l=>l.id===current) || LEVELS[2]; }
  function set(id){
    if(!LEVELS.some(l=>l.id===id)) return;
    current=id;
    try{ localStorage.setItem('dq_diff',id); }catch(e){}
  }

  return {
    LEVELS,
    get current(){ return current; },
    set, level,
    name(){ return level().name; },
    /* the multipliers, read live at the point of use */
    chase(){   return level().chase;   },
    fireGap(){ return level().fireGap; },
    dmg(){     return level().dmg;     },
    bolt(){    return level().bolt;    },
    time(){    return level().time;    }
  };
})();
