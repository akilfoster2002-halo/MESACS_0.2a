/* =====================================================================
   BOUT — one robot on a floor, and what the blocks make it do.

   There is no fight in here. There is no opponent, no damage, no energy
   and no clock: a robot stands on a strip of floor, a program says which
   keys move it which way, and this steps that forward twenty times a
   second. That is deliberately the whole thing — the combat gets built
   back on top of it, and none of it is worth building until the sentence
   "when I press D, it goes right" is true and visible.

   NO SCREEN AND NO KEYBOARD. It is handed the set of keys that are down
   and gives back what it decided and why. That is what lets the tests
   drive it with a plain Set and no browser, and it is what will let a
   server drive it later without changing a line.

   WHAT COMES BACK EVERY TICK is the decision AND the reasoning: which
   rule fired, what it reached, or that nothing matched. The ring prints
   that as it happens, which is the only reason a student can tell the
   difference between "my program is wrong" and "I am pressing the wrong
   key".
   ===================================================================== */
(function(root){

  const CODE   = (typeof require!=='undefined') ? require('./mechacode.js') : root.MECHACODE;
  const ROBOTS = (typeof require!=='undefined') ? require('./robots.js')    : root.ROBOTS;

  /* Every number the floor is run by. A robot's row in robots.js
     multiplies the speed; it never replaces it, so this stays the one
     place movement is tuned from. */
  const RULES = {
    hz:20,          // the tick this is written for
    floor:14,       // how far from the middle you can get, in metres
    walk:5.2,       // metres a second
    turn:9.0        // radians a second it swings round to face where it is going
  };

  const clamp=(v,a,b)=>v<a?a:v>b?b:v;

  class Stage {
    constructor(opts){
      opts=opts||{};
      this.rules=Object.assign({}, RULES, opts.rules||{});
      this.spec=ROBOTS.get(opts.robot);
      this.program=opts.program||[];
      this.t=0;
      this.robot={
        x:0,                    // where it is along the floor
        dir:0,                  // which way it is moving THIS tick: -1, 0, +1
        face:0,                 // which way it is looking: -1 left, +1 right, 0 forward
        yaw:0,                  // and that, as an angle, eased
        moving:false,
        steps:0                 // how many ticks it has actually moved for
      };
    }

    /* One tick. `held` is the keys down right now — a Set from a browser,
       a plain object from a test, either is fine. */
    step(dt, held){
      dt=Math.min(dt||1/this.rules.hz, 0.1);
      this.t+=dt;
      const r=this.robot;

      const d=CODE.decide(this.program, held);
      const act=d.action ? CODE.ACTIONS[d.action.act] : null;
      const axis=act && typeof act.axis==='number' ? act.axis : 0;

      r.dir=axis;
      r.moving=axis!==0;
      if(axis){
        r.x=clamp(r.x + axis*this.rules.walk*this.spec.speed*dt,
                  -this.rules.floor, this.rules.floor);
        r.steps++;
        /* It looks where it is going. Kept as a separate number from
           `dir` because a robot that has stopped should stay facing the
           way it last went rather than snapping back to the front — and
           because when a walk cycle turns up, which way the body is
           pointing is what it will be played along. */
        r.face=axis;
      }
      const want=r.face*Math.PI/2;
      const rate=this.rules.turn*dt;
      r.yaw += clamp(want-r.yaw, -rate, rate);

      return { action:d.action, trace:d.trace, moved:r.moving };
    }

    /* What a screen needs, and nothing it does not. Rounded, because a
       millimetre of a robot's position is not worth a byte. */
    snapshot(){
      const r=this.robot;
      return { t:+this.t.toFixed(2), robot:this.spec.id,
               x:+r.x.toFixed(2), yaw:+r.yaw.toFixed(3),
               dir:r.dir, moving:r.moving, steps:r.steps };
    }
  }

  const API={ RULES, Stage };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.BOUT=API;
})(typeof self!=='undefined' ? self : this);
