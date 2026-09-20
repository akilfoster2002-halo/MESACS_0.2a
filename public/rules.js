/* =====================================================================
   RULES — the part of the fight that is NOT up to the student.

   Everything else in this mode is blocks a student wrote and can change.
   This is the other half, and a game needs both: your code decides what
   you do, and something outside your code decides what that costs and
   what it is worth. A game where the player's own program says how much
   damage it does is not a game, it is a wish.

   SO THESE NUMBERS ARE THE REFEREE'S. They are read by the ring every
   tick, they are printed on the pit screen so nobody has to guess, and
   nothing a student writes can move them. A script can `set [health] to
   999` all it likes; the referee owns that number and puts it back on
   the next tick, which is worth finding out and is the fastest lesson
   in here about what "read-only" means.

   WHAT THE STUDENT STILL DECIDES, and it is the whole game: when to
   swing, which swing, whether they can afford it, when to close, when
   to back off and let stamina come back. The referee will not stop them
   throwing a heavy with no stamina — it just will not happen, and the
   half second they spent asking for it is gone. Learning to check
   before you spend is the point.

   ------------------------------------------------------------------
   HOW AN ATTACK ACTUALLY RESOLVES

   A student's code does not deal damage. It raises a flag:

       set [light] to 1        ← "I am throwing a light one"

   and on the next tick the referee sees the flag, lowers it, and then
   decides — in this order, because the order is the balance:

       1. Is there enough stamina? No  → nothing happens at all.
       2. Charge the stamina.            Yes, even if it misses.
       3. Is the other one within reach? No → a miss, and it still cost.
       4. Are they guarding?             Yes → a quarter of the damage.
       5. Take the damage off them.

   Three and four are why a fight is not just who presses fastest.

   No DOM. Node loads this too, because the tests read it.
   ===================================================================== */
(function(root){

  const RULES = {
    /* ------------------------------------------------------- the body */
    health:100,        // what everybody starts the round on
    stamina:100,       // and what they start it with in the tank

    /* STAMINA COMES BACK ON ITS OWN, which is the one number that makes
       backing off a strategy rather than a surrender. Slow enough that
       you cannot throw heavies forever; fast enough that a student who
       retreats and waits gets a real turn out of it. */
    regen:14,          // stamina a second, up to the cap and no further

    /* ------------------------------------------------------ the moves
       cost is what leaves the tank whether or not it lands. damage is
       what arrives if it does. reach is how near they have to be,
       measured between the two bodies.

       THE HEAVY IS DELIBERATELY BAD VALUE PER POINT OF STAMINA, and it
       took a test to keep it that way: at 45 for 20 it was 0.44 damage
       a point against the light's 0.40, which quietly meant nobody
       should ever jab. At 50 for 19 it is 0.38, and the jab is the
       efficient punch again.

       So what are you paying the extra for? Fewer swings to finish
       somebody, and fewer chances to be interrupted doing it. That it is
       only worth that SOMETIMES is the interesting part, and it is the
       first real trade a student has to reason about. */
    moves:{
      light:{ cost:20, damage:8,  reach:6.5, label:'a light punch' },
      heavy:{ cost:50, damage:19, reach:5.5, label:'a heavy punch' }
    },

    /* A guard is not a wall. It turns a punch into a quarter of a punch,
       which means guarding through a whole fight still loses it. */
    guarded:0.25,

    /* ------------------------------------------------------- the floor
       PHYSICS IS THE REFEREE'S TOO, and it has to be, for a reason that
       took a fight to notice: both worked strategies walk toward the
       other one with a CONSTANT — `change x by 0.3`. That is correct
       right up until the two of them pass THROUGH each other, and from
       then on the same constant walks them apart. Left alone they
       diverged forever, both at full stamina, eighty units apart and
       still running.

       So they cannot pass through each other and they cannot leave the
       floor. A student can still write a strategy that walks the wrong
       way — that is theirs to get wrong — but the world will not let
       the two of them swap sides behind their back. */
    floor:16,          // how far from the middle anybody can get
    apart:2.4,         // and how close two fighters can stand

    /* Where a knockout leaves you, and how long the ring waits before it
       puts both of you back on your marks. */
    knockout:0,
    reset:2.5
  };

  /* The signal variables. A student sets one of these to 1 to ask for a
     swing; the referee lowers it again the moment it has dealt with it.
     They are named after the move so that `set [heavy] to 1` reads as
     what it is. */
  const SIGNALS = Object.keys(RULES.moves);

  /* Everything the referee writes and a student may only read. Listed in
     one place because the ring stamps them back every tick and the pit
     prints them, and those two must not drift apart. */
  const OWNED = ['health','stamina'];

  /* ---------------------------------------------------------- resolve
     Pure: given the attacker's stamina, the gap between the two of them
     and whether the target is guarding, say what happens. No DOM, no
     actors, no VM — which is what lets the tests drive the whole balance
     of the game with plain numbers.

     Returns { ok, why, cost, damage } — `ok` false means nothing landed,
     and `cost` is still charged unless the reason was `no-stamina`. */
  function resolve(move, stamina, gap, guarding){
    const m = RULES.moves[move];
    if(!m) return { ok:false, why:'no-such-move', cost:0, damage:0 };
    if(stamina < m.cost) return { ok:false, why:'no-stamina', cost:0, damage:0 };
    if(gap > m.reach)    return { ok:false, why:'too-far',    cost:m.cost, damage:0 };
    const damage = guarding ? Math.round(m.damage*RULES.guarded) : m.damage;
    return { ok:true, why:guarding?'guarded':'clean', cost:m.cost, damage };
  }

  /* What a second of standing still is worth. Kept here rather than in
     the ring so the tests can ask the question without a clock. */
  const regenerated = (stamina, dt) =>
    Math.min(RULES.stamina, stamina + RULES.regen*dt);

  const clampHealth = h => Math.max(0, Math.min(RULES.health, h));

  /* Where two fighters END UP, given where their own scripts put them.
     Pure, so the tests can ask what happens when both of them walk into
     each other without building a room. */
  function separate(ax, bx){
    const lim=RULES.floor;
    ax=Math.max(-lim, Math.min(lim, ax));
    bx=Math.max(-lim, Math.min(lim, bx));
    const gap=Math.abs(ax-bx);
    if(gap < RULES.apart){
      const push=(RULES.apart-gap)/2, dir=(ax<=bx)?-1:1;
      ax+=push*dir; bx-=push*dir;
      ax=Math.max(-lim, Math.min(lim, ax));
      bx=Math.max(-lim, Math.min(lim, bx));
    }
    return { a:ax, b:bx };
  }

  /* The rules as sentences, for the pit. Written here so the screen
     cannot say one thing while the referee does another. */
  function sheet(){
    const m=RULES.moves;
    return [
      { what:'health', says:'Everybody starts on '+RULES.health+'. At '+RULES.knockout+' the round is over.' },
      { what:'stamina', says:'Starts at '+RULES.stamina+' and comes back '+RULES.regen+' a second, never above '+RULES.stamina+'.' },
      { what:'a light punch', says:'costs '+m.light.cost+' stamina, does '+m.light.damage+' damage, reaches '+m.light.reach+'.' },
      { what:'a heavy punch', says:'costs '+m.heavy.cost+' stamina, does '+m.heavy.damage+' damage, reaches only '+m.heavy.reach+'.' },
      { what:'a guard', says:'turns a punch into '+Math.round(RULES.guarded*100)+'% of a punch. It is not a wall.' },
      { what:'no stamina', says:'a swing you cannot afford does not happen at all — and the time you spent asking is gone.' }
    ];
  }

  const API={ RULES, SIGNALS, OWNED, resolve, regenerated, clampHealth, separate, sheet };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.RULES=API;
})(typeof self!=='undefined' ? self : this);
