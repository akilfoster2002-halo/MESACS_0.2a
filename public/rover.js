/* =====================================================================
   THE ROVER — what it is made of, what that costs, and how far it gets.

   Two halves of one mission. FIRST you spend cells on parts, and every
   part you bolt on is a cell you cannot drive with; THEN you program the
   drive on what is left. That is the whole shape of it, and it is why the
   note at the end of Ion's routine matters: E. took the spare cells, so
   there was never going to be enough for both.

   THE BUDGET IS THE LESSON, and it is the Swarm's lesson wearing a
   different coat. There a program had to fit in three blocks; here it has
   to fit in the cells left after the wheels — and a student who writes
   forward() six times instead of `repeat 6` runs out of power in sight of
   the tower. Efficiency stops being a style note the moment it is the
   difference between arriving and not.

   NOTHING IN HERE DRAWS ANYTHING OR KNOWS WHAT A PLANET IS. The catalogue
   is data, the sums are sums, and both are tested under Node. The model is
   built from this by rover-view.js and the console reads it.
   ===================================================================== */
(function(root){

  /* HOW MANY CELLS THERE ARE, and there are not enough. Twelve is chosen
     so that the cheapest workable rover leaves seven or eight to drive
     with, and the greedy one leaves four — which is not enough to reach
     the tower however the program is written. Running out is a thing that
     has to be POSSIBLE or the budget is decoration. */
  const CELLS = 12;

  /* How far away the tower is, in spans. A span is one forward(). */
  const TOWER = 7;

  /* ------------------------------------------------------------- parts
     Three slots, and every slot has to be filled — a rover with no drive
     is not a cheaper rover, it is a crate. What the choices trade is
     always the same thing: cells now against cells later, or against what
     the ground will let you do.

       cost   cells it takes to bolt on
       per    cells each forward() costs once it is on
       climb  whether it can get up the ridge on the direct route */
  const PARTS = {
    drive: {
      name:'Drive', slot:'drive',
      options:[
        { id:'wheels', name:'Wheels', cost:2, per:1, climb:false,
          blurb:'Light and cheap. They will not climb the ridge.' },
        { id:'treads', name:'Treads', cost:4, per:1, climb:true,
          blurb:'Heavy, and they go straight over the ridge.' }
      ]
    },
    battery: {
      name:'Battery', slot:'battery',
      options:[
        { id:'stock', name:'Stock cell', cost:0, per:0, spare:0,
          blurb:'What is already in it. Nothing extra.' },
        { id:'spare', name:'Second cell', cost:3, per:0, spare:4,
          blurb:'Costs 3 to fit and gives 4 back. Worth it only if you drive far.' }
      ]
    },
    sensor: {
      name:'Sensor', slot:'sensor',
      options:[
        { id:'none', name:'No sensor', cost:0, per:0, sees:false,
          blurb:'It cannot tell what is in front of it. You will have to know.' },
        { id:'eye',  name:'Rock sensor', cost:2, per:0, sees:true,
          blurb:'Lets the program ask <b>is there a rock ahead</b>.' }
      ]
    }
  };
  const SLOTS = ['drive','battery','sensor'];

  const optionOf = (slot, id) =>
    (PARTS[slot].options.find(o=>o.id===id) || PARTS[slot].options[0]);

  /* What it comes out of the shed as: the cheapest of everything, which is
     also the one that cannot get there. */
  const bare = () => ({ drive:'wheels', battery:'stock', sensor:'none' });

  function tidy(s){
    s=s||{};
    const out={};
    for(const k of SLOTS) out[k]=optionOf(k, s[k]).id;
    return out;
  }

  /* --------------------------------------------------------------- sums */
  const parts = s => SLOTS.map(k=>optionOf(k, tidy(s)[k]));
  const spent = s => parts(s).reduce((n,o)=>n + (o.cost||0), 0);
  const spare = s => parts(s).reduce((n,o)=>n + (o.spare||0), 0);
  /* What is left to drive on: the cells you started with, less what the
     parts cost, plus whatever a second battery gives back. */
  const power = s => CELLS - spent(s) + spare(s);
  const perStep = s => parts(s).reduce((n,o)=>n + (o.per||0), 0);
  /* The most forward()s this rover could ever make, however clever the
     program is. Nothing to do with how the program is WRITTEN — that is
     the block budget, and it is the console's business. */
  const reach = s => { const p=perStep(s); return p>0 ? Math.floor(power(s)/p) : Infinity; };

  const canClimb = s => !!optionOf('drive', tidy(s).drive).climb;
  const canSee   = s => !!optionOf('sensor', tidy(s).sensor).sees;

  /* ------------------------------------------------------- the two routes
     THE RIDGE IS THE POINT OF THE CHOICE, and the two ways past it are
     hard in different ways rather than one being simply longer.

       OVER   five spans, straight at the tower, and it needs TREADS
              because wheels cannot climb a ridge.
       ROUND  nine spans the long way, flat the whole distance, and it
              goes through the rock field — so it needs a SENSOR, because
              a program that cannot ask what is in front of it cannot
              drive through rocks.

     Which means neither drive is the right answer on its own. Treads cost
     twice what wheels cost and save you the sensor and four spans; wheels
     are cheap and then need both a sensor and a second cell to make the
     distance. The two that work come out at almost the same price by
     completely different routes, and the greedy build — everything bolted
     on — cannot afford to drive anywhere:

       treads + stock + no sensor    4 on parts,  8 to drive,  5 over   ✓
       wheels + spare + sensor       7 on parts,  9 to drive,  9 round  ✓
       wheels + stock + sensor       4 on parts,  8 to drive,  9 round  ✗ short
       wheels + stock + no sensor    2 on parts, 10 to drive,  9 round  ✗ blind
       everything                    9 on parts,  7 to drive,  5 over   ✓ wasteful */
  const ROUTES = {
    over:  { id:'over',  spans:5, needsSensor:false, name:'over the ridge' },
    round: { id:'round', spans:9, needsSensor:true,  name:'round through the rocks' }
  };
  const routeFor = s => canClimb(s) ? ROUTES.over : ROUTES.round;

  /* Can this rover reach the tower AT ALL, before a line of code is
     written? The console says so while the parts are being chosen: finding
     out after the program is written is a waste of an afternoon rather
     than a lesson. */
  function verdict(s){
    const r=routeFor(s), n=reach(s);
    const far   = n >= r.spans;
    const blind = r.needsSensor && !canSee(s);
    return { route:r, reach:n, power:power(s), spent:spent(s),
             far, blind, ok: far && !blind,
             short: Math.max(0, r.spans - n) };
  }

  /* WHAT TO SAY ABOUT A ROVER THAT CANNOT GET THERE — about the rover,
     never about the answer. */
  function why(s){
    const v=verdict(s);
    if(v.ok) return null;
    if(v.blind && !v.far)
      return `Wheels cannot climb the ridge, so it has to go ${v.route.name} — `
           + `and that is ${v.route.spans} spans through rocks it cannot see. `
           + `It has ${v.power} cells, which is ${v.reach}.`;
    if(v.blind)
      return `Wheels cannot climb the ridge, so it has to go ${v.route.name}. `
           + `It has the range, but nothing to see the rocks with.`;
    return `It has ${v.power} cells to drive on, which is ${v.reach} span`
         + `${v.reach===1?'':'s'} — and the way ${v.route.name} is ${v.route.spans}. `
         + (canClimb(s)
            ? 'Fitting less to it would leave more to drive with.'
            : 'Wheels cannot climb the ridge, so it has to go the long way.');
  }

  const API = { CELLS, TOWER, PARTS, SLOTS, ROUTES,
                bare, tidy, optionOf, parts, spent, spare,
                power, perStep, reach, canClimb, canSee,
                routeFor, verdict, why };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.ROVER=API;
})(typeof self!=='undefined' ? self : this);
