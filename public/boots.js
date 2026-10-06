/* =====================================================================
   ROBIN'S SHOES — how she moves through the city. Not flight: a jump
   strong enough to clear a street, and everything she does in the air
   is about keeping that speed.

     HOLD SPACE → BOUND → LAND → BOUND → … (and DIVE, PULL UP, REBOUND, DASH)

   THE BOUND IS THE HEART OF IT, and it is automatic, the way a web-swing
   is: hold SPACE and the shoes pick the roof you are pointing at (the
   camera, or the keys), solve the arc that lands her on it, and fly her
   there. Every landing with SPACE still held springs straight into the
   next. You steer — point somewhere else, even mid-air, and she bends
   to the roof over there — and you keep the RHYTHM: tap SPACE as her
   feet touch (the shoes and the ring on the roof go gold) and the next
   bound is a perfect one, quicker and further, and the flow builds.
   Let go and she lands and runs on.

   TWO BUTTONS. SPACE is "do the move": held, it is the bound; on the
   ground with no roof in reach it is the super jump, in a dive it is
   the pull-up, against a wall it is the kick-off, and in the open air
   it is the dash. SHIFT is speed: a sprint on the ground, a
   dive in the air. WASD steers relative to the camera, on the ground and
   off it.

   MOMENTUM IS KEPT, NEVER RESET. Velocity carries from the run into the
   jump, from the jump into the dive, and from the dive into whatever
   comes next:
     · the DIVE trades height for speed (more gravity, a push forward);
     · the PULL-UP turns the speed you fell with into speed upwards — how
       much depends on WHEN: pull with the ground (or a roof) coming up
       fast and close and it all comes back and more; pull early and the
       swoop is weak; pull too late and the swoop does not finish before
       you hit. The window is not a beat to hit — it is whether the swoop
       has room, and it comes from how fast you are falling and how far
       there is to fall. The boots glow gold while you are in it;
     · a WALL hit at speed is a launch pad: she plants a foot for a third
       of a second and SPACE kicks her off it, away and up. Press it just
       as she touches (or just before) for a perfect kick;
     · the DASH changes her line in the air without throwing away her
       speed; two of them, back on every landing, kick and perfect pull;
     · a LANDING keeps her running speed; a hard one is a roll, not a
       stop; and SPACE pressed just before the feet touch is a perfect
       landing — straight back up, a little stronger.

   FLOW is how long she has kept it going. Chained moves fill it; standing
   about on the street drains it fast, a roof slowly. Flow makes every
   launch, top speed and steer a little stronger: the reward for never
   touching the ground.

   TECHNIQUES ARE LEARNED, not numbers raised (HAVE):
     early  bound · jump · steer · dive
     mid    pullup · rebound · dash
     late   chain (each kick or pull in a row hits harder)
            slide (SHIFT held into a fast landing keeps the speed)

   THE PHYSICS IS PLAIN DATA (body() and step()) with no THREE and no DOM,
   so tests/boots.test.js can fly it over a fake street. Everything you
   would want to tune is in TUNE, and the debug panel (` — the backquote)
   draws the velocity, the arc she is on, the wall she is touching, and
   lets every number in TUNE be changed while you play.
   ===================================================================== */
window.BOOTS = (function(){
  /* ============================================================== tuning
     Metres, seconds. Change these here, live in the debug panel, or from
     the console (BOOTS.TUNE.jumpUp = 24). */
  const TUNE = {
    // THE CHARGED JUMP (technique 'charge'): hold SPACE on the ground and let go — the longer the hold, the higher
    chargeTime: 0.75,        // s of holding to reach full height
    jumpMin: 10,             // m/s up for a tap…
    jumpMax: 22,             // …and for a full charge
    chargeCrouch: 0.75,      // share of her run speed while she crouches to charge: a running leap keeps its run-up
    // …and IN TIME: SPACE pressed again as her feet touch is the next tier up, higher each time
    combo: [1, 1.22, 1.45, 1.72],   // vertical speed × this, tier by tier
    comboWindow: 0.3,        // s after touching down a press still counts as in time (and perfectLanding before it)
    /* THE LEAP. With W held, a charged jump goes forward as well as up — further the longer the hold and the
       higher the tier of the rhythm — and off a big one she SOARS: her speed holds her up, so a leap off one
       roof carries her across the street to the next. The keys steer her in the air; SHIFT dives out of it. */
    leapMin: 1.5,            // m/s forward for a tap…
    leapMax: 4,              // …and for a full charge: a nudge — the jump is UP, and the keys only lean it
    leapTier: 0.15,          // and this much more for each tier of the rhythm
    leapUp: 1,               // a leap goes this much of a jump's height (all of it)
    chargeCarry: 0.75,       // share of her run carried into a charged jump
    // IN THE AIR, the charged jump's own handling: the keys lean her, they do not throw her
    jAirAccel: 9,            // m/s² the keys push
    jAirMax: 11,             // m/s the keys can push her to (her own momentum can be more)
    jAirTurn: 2.2,           // rad/s the keys bend her line
    jAirSettle: 1.1,         // 1/s her drift dies away with no keys held — she stays where you put her
    soarFrom: 0.35,          // a charge at least this full (or any jump in time) is a leap she soars off
    soarTime: 1.0,           // s she soars off a full leap (a tap of one, about half)
    hangTime: 0.42,          // s of lighter gravity at the top of a leap…
    hangGravity: 0.45,       // …this much of it
    flyTime: 1.8,            // (the soar's own clock is set by the leap)
    flyGravity: 0.4,         // gravity × this at the start of the soar, back to full by its end…
    flyLift: 0.35,           // …and, falling, up to this much more taken off by her speed
    flyLiftSpeed: 30,        // m/s at which the lift is full
    // on the ground
    runSpeed: 9,             // m/s, walking pace in the boots
    sprintSpeed: 15,         // m/s with SHIFT
    groundAccel: 48,         // m/s² towards the speed you want
    groundTurn: 12,          // rad/s the run turns towards the keys
    groundKeep: 1.6,         // how fast speed above a run decays after a landing (1/s): low keeps momentum
    stopDecel: 34,           // m/s² with no keys held
    // the super jump
    jumpUp: 21,              // m/s straight up
    jumpCarry: 1.0,          // share of the run carried into the jump
    jumpFwd: 5,              // m/s added along the keys
    jumpHoldGravity: 0.58,   // gravity while SPACE is held and she is rising: hold for height
    jumpCut: 0.55,           // let go early and the rise is cut to this
    jumpBuffer: 0.12,        // s a press is remembered before she can use it
    coyote: 0.1,             // s after running off an edge she can still jump
    // the bound: SPACE held, roof to roof
    boundGravity: 27,        // m/s² on a bound (the arc is solved for it)
    boundLift: 2.6,          // m the arc clears the higher end by…
    boundArc: 0.15,          // …and this much more per metre it covers
    boundMin: 7,             // m: a roof nearer than this is a step, not a bound
    boundReach: 34,          // m at most from a standstill…
    boundReachFlow: 16,      // …and this much further at full flow
    boundIdeal: 15,          // m she likes to go from a standstill…
    boundIdealSpeed: 0.6,    // …and this much further per m/s she arrives with
    boundCone: 0.8,          // rad either side of where you point that still counts
    boundUp: 15,             // m higher she can bound (more needs a wall)
    boundDown: 40,           // m lower
    boundInset: 1.8,         // m in from a roof's edge she will land
    boundHoming: 10,         // how hard the shoes hold the line to the roof (1/s)
    boundPlant: 0.12,        // s her feet are down between bounds
    boundPerfect: 0.2,       // s before touchdown a press is perfect…
    boundLate: 0.08,         // …or just after it
    boundPerfectBonus: 1.15, // a perfect bound is this much quicker, and reaches further
    boundFlowGravity: 0.35,  // flow makes every arc quicker: gravity × (1 + this × flow)
    boundRetarget: 0.35,     // rad off her line before the keys pick a new roof in mid-air
    ignite: 30,              // m/s straight up when the shoes first fire
    // the air
    gravity: 30,             // m/s²
    maxFall: 40,             // m/s without a dive
    airAccel: 15,            // m/s² the keys push
    airTurn: 2.4,            // rad/s the keys bend her line
    airBrake: 9,             // m/s² holding back
    airDrag: 0.03,           // 1/s
    maxAirSpeed: 24,         // the keys cannot push past this (momentum can)
    maxSpeed: 64,            // nothing goes past this
    // the dive
    diveGravity: 2.3,        // gravity multiplied, in a dive
    diveFwd: 13,             // m/s² forward along her line
    maxDive: 58,             // m/s
    diveTurn: 1.2,           // rad/s of steering left in a dive
    // the pull-up: falling turned into rising
    pullMinDive: 0.22,       // s of dive before it can pull
    pullBase: 8,             // m/s of lift for free
    pullEfficiency: 0.66,    // share of the fall turned upwards
    pullForward: 0.3,        // share of the fall turned forwards
    swoopTime: 0.18,         // s the swoop takes: she is still going down for half of it
    perfectSlack: 0.32,      // s of room above the bare minimum that still counts as perfect
    perfectPull: 1.25,       // multiplier for a perfect pull
    earlyFloor: 0.55,        // the weakest an early pull gets
    maxRise: 46,             // m/s upwards, at most
    // the wall
    reboundMin: 7,           // m/s into a wall before it is a launch pad, not a bump
    reboundGrace: 0.34,      // s a planted foot waits for SPACE
    reboundPush: 10,         // m/s away from the wall
    reboundKeepN: 0.45,      // share of the speed into the wall sent back out
    reboundKeepT: 0.9,       // share of the speed along the wall kept
    reboundUp: 15,           // m/s upwards
    reboundUpFromSpeed: 0.3, // and this much of the speed she came in with
    perfectRebound: 0.12,    // s either side of contact that is perfect
    perfectReboundBonus: 1.3,
    wallSlideGravity: 0.35,  // gravity while sliding down a wall
    // the dash
    dashSpeed: 22,           // m/s, at least, along the keys
    dashCharges: 2,
    dashCooldown: 0.45,      // s between dashes
    dashTime: 0.2,           // s of low gravity
    dashUp: 3,               // m/s of lift
    dashKeep: 0.2,           // how much of her old direction survives
    // landing
    rollImpact: 24,          // m/s down that turns a landing into a roll
    somersaultImpact: 15,    // m/s down (about 4 m of fall) that is a somersault, with the charged jump
    somersaultTime: 1.0,     // s the somersault is on screen
    somersaultPush: 7,       // m/s forward she rolls at least
    rollTime: 0.34,
    landKeep: 0.94,          // horizontal speed kept on touching down
    perfectLanding: 0.15,    // s before touchdown a press counts
    perfectLandingBonus: 1.12,
    slideKeep: 0.5,          // groundKeep while sliding (late technique)
    // flow
    flowGround: 0.6,         // per second lost standing on the street
    flowRoof: 0.12,          // per second lost standing on a roof
    flowAir: 0.03,           // per second gained flying fast
    flowPower: 0.25,         // launches × (1 + this × flow)
    flowSpeed: 0.3,          // top speeds × (1 + this × flow)
    flowControl: 0.35,       // steering × (1 + this × flow)
    chainBonus: 0.08,        // each kick or pull in a row, with CHAIN learned
    // the camera
    camDist: 6.2, camDistFast: 9.5, camLift: 2.3, camFov: 70, camFovFast: 90, camFollow: 2.6
  };
  const DEFAULTS = JSON.parse(JSON.stringify(TUNE));
  const GAINS = { bound:0.05, boundPerfect:0.16, jump:0.04, pull:0.1, pullPerfect:0.2, rebound:0.1, reboundPerfect:0.18, dash:0.03, landPerfect:0.12, roll:0.02 };
  /* the shoes are 'bound' again — SPACE held flies her roof to roof, to the roof the ring is on. 'charge'
     (hold, crouch, let go) is still here for anybody given it, but nothing teaches it. */
  const TECH = { early:['bound','jump','steer','dive'], mid:['pullup','rebound','dash'], late:['chain','slide'] };
  const ALL = TECH.early.concat(TECH.mid, TECH.late);
  const LEGACY = ['bound','jump','steer','dive'].concat(TECH.mid, TECH.late);   // the shoes as they were: SPACE held flies roof to roof

  const R = 0.42, TALL = 1.8;                              // her radius and height, metres
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b-a)*k;
  const hyp = Math.hypot;

  /* ================================================================ body
     Everything about her motion, as numbers. `y` is the soles of her feet. */
  function body(o){
    return Object.assign({ x:0, y:0, z:0, vx:0, vy:0, vz:0, ground:true, heading:0, state:'ground',
      coyote:0, jumpBuf:9, jumpHeld:false, cut:true, airT:0, diveT:0, swoop:null, wall:null, slideWall:null,
      dashT:0, dashCD:0, charges:TUNE.dashCharges, roll:0, sliding:false, flow:0, chain:0,
      bound:null, plant:0, landT:9, hops:0, aimT:0, charge:null, combo:0, fromCharge:false, hang:0, fly:0, flyMax:0,
      have:new Set(ALL), events:[], last:{}, gold:false }, o||{});
  }
  const hspeed = b => hyp(b.vx, b.vz);
  const speed = b => hyp(b.vx, b.vy, b.vz);
  const flowK = (b, k) => 1 + TUNE[k]*b.flow;

  /* THE WORLD, as the body asks it: the highest floor under a point that
     is no higher than a step above the feet, and the solid boxes (x1 x2 z1
     z2 y1 y2) that walls are made of. */
  function floorAt(env, x, z, feet){ return env.ground ? env.ground(x, z, feet) : 0; }
  function blocks(s, feet){ return !(s.off) && !(s.y1 !== undefined && (feet + TALL < s.y1 || feet > s.y2 - 0.5)); }
  function overlapping(env, x, z, feet){
    for(const s of env.solids){ if(blocks(s, feet) && x + R > s.x1 && x - R < s.x2 && z + R > s.z1 && z - R < s.z2) return s; }
    return null;
  }
  /* metres to the first wall along (dx dz), up to `max` */
  function wallAhead(env, b, dx, dz, max){
    const d = hyp(dx, dz); if(d < 1e-6) return Infinity;
    const ux = dx/d, uz = dz/d;
    let best = Infinity;
    for(const s of env.solids){
      if(!blocks(s, b.y)) continue;
      let t0 = 0, t1 = max;
      const slab = (o, u, a1, a2) => { a1 -= R; a2 += R;
        if(Math.abs(u) < 1e-9) return o > a1 && o < a2;
        let ta = (a1 - o)/u, tb = (a2 - o)/u; if(ta > tb){ const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); return t0 <= t1; };
      if(slab(b.x, ux, s.x1, s.x2) && slab(b.z, uz, s.z1, s.z2) && t0 < best) best = t0;
    }
    return best;
  }
  /* seconds until the feet meet the floor under her, at the gravity she is under */
  function timeToGround(env, b, g){
    if(b.vy >= 0 && !g) return Infinity;
    const alt = b.y - floorAt(env, b.x, b.z, b.y);
    if(alt <= 0) return 0;
    const v = -b.vy;                              // falling speed, positive down
    const gg = g || TUNE.gravity;
    return (-v + Math.sqrt(v*v + 2*gg*alt))/gg;
  }
  /* WHERE SHE IS GOING, with nobody touching the keys: for the debug arc and the hints */
  function predict(env, b, secs, n){
    const p = { x:b.x, y:b.y, z:b.z, vx:b.vx, vy:b.vy, vz:b.vz }, out = [], h = secs/n;
    const g = TUNE.gravity*(b.state === 'dive' ? TUNE.diveGravity : 1);
    for(let i=0;i<n;i++){
      p.vy -= g*h; p.x += p.vx*h; p.y += p.vy*h; p.z += p.vz*h; out.push([p.x, p.y, p.z]);
      if(p.y < floorAt(env, p.x, p.z, p.y + 1)) break;
    }
    return out;
  }

  /* ================================================================ step
     One frame. `inp`: { x, z } the keys (right, forward), yaw (the
     camera's), jump (SPACE held), jumpEdge (pressed this frame), shift. */
  function step(b, inp, dt, env){
    b.events = [];
    if(inp.jumpEdge) b.jumpBuf = 0; else b.jumpBuf += dt;
    if(!inp.jump && b.jumpHeld && !b.cut && b.vy > 0 && b.state === 'air'){ b.vy *= TUNE.jumpCut; b.cut = true; }
    b.jumpHeld = !!inp.jump;
    const wish = wishDir(inp);
    if(b.ground){ b.landT += dt; if(b.landT > 0.4) b.hops = 0; }
    decide(b, inp, wish, env);
    // the charge: crouched while SPACE is held, up on its release (or off an edge, inside the coyote time)
    if(b.charge){
      if(inp.jump && (b.ground || b.coyote > 0)) b.charge.t += dt;
      else if(b.ground || b.coyote > 0) chargeJump(b, wish);
      else b.charge = null;
    }
    steerBound(b, inp, wish, dt, env);
    const n = Math.max(1, Math.min(10, Math.ceil(speed(b)*dt/0.4)));
    for(let i=0;i<n;i++) sub(b, inp, wish, dt/n, env);
    flowTick(b, inp, dt);
    if(b.dashCD > 0) b.dashCD -= dt;
    // the gold: a press right now would be perfect — a pull out of this dive, or the next bound
    b.gold = (b.state === 'dive' && b.diveT >= TUNE.pullMinDive && pullQuality(b, env).kind === 'perfect')
          || (!!b.bound && boundLeft(b) <= TUNE.boundPerfect);
    return b.events;
  }
  function wishDir(inp){
    const f = clamp(inp.z||0, -1, 1), r = clamp(inp.x||0, -1, 1);
    if(!f && !r) return null;
    const s = Math.sin(inp.yaw||0), c = Math.cos(inp.yaw||0);
    const x = -s*f + c*r, z = -c*f - s*r, d = hyp(x, z);
    return { x:x/d, z:z/d, back: f < 0 && !r };
  }
  function emit(b, name, data){ b.events.push(Object.assign({ name }, data||{})); }
  function addFlow(b, k){ b.flow = clamp(b.flow + (GAINS[k]||0), 0, 1); }

  /* ------------------------------------------------- the button decides */
  function decide(b, inp, wish, env){
    const fresh = b.jumpBuf === 0, buffered = b.jumpBuf <= TUNE.jumpBuffer;
    if(b.swoop) return;
    // THE CHARGED JUMP: a press on the ground starts the crouch; letting go is the jump (step(), above)
    if(b.have.has('charge') && (b.ground || b.coyote > 0) && !b.charge && buffered){
      const inTime = b.ground && b.fromCharge && b.landT <= TUNE.comboWindow;
      if(b.roll > TUNE.rollTime - 0.08 && !inTime) return;      // the first instant of a roll is all knees — unless the jump is in time: it wins
      if(inTime){ b.roll = 0; b.last.rollT = 0; }
      b.charge = { t:0, combo: inTime ? Math.min(b.combo + 1, TUNE.combo.length - 1) : 0 };
      b.jumpBuf = 9; emit(b, 'charge', { combo:b.charge.combo });
      return;
    }
    if(b.charge) return;
    // the wall: SPACE while a foot is planted is the kick
    if(b.wall){
      // pressed in the first instant of the foot touching: perfect (pressed just before is handled where she touches)
      if(buffered){ rebound(b, wish, b.wall.t <= TUNE.perfectRebound); b.jumpBuf = 9; }
      return;
    }
    if(b.slideWall && fresh && b.have.has('rebound')){ b.wall = Object.assign({}, b.slideWall, { t:TUNE.reboundGrace, weak:true }); rebound(b, wish, false); b.jumpBuf = 9; return; }
    // the ground with a roof in reach: the bound — on a press, or with SPACE still held once her feet have planted
    if((b.ground || b.coyote > 0) && b.have.has('bound') && b.plant <= 0 && (buffered || inp.jump) && !(b.roll > TUNE.rollTime - 0.08)){
      const late = b.ground && fresh && b.landT <= TUNE.boundLate && b.fromBound;      // pressed just after her feet touched: still perfect
      if(tryBound(b, inp, wish, env, late)){ b.jumpBuf = 9; return; }
    }
    // the ground (or a moment after leaving it) with nowhere to bound to: the super jump
    if((b.ground || b.coyote > 0) && buffered && b.have.has('jump')){
      if(b.roll > 0 && b.roll > TUNE.rollTime - 0.08) return;       // the first instant of a roll is all knees
      superJump(b, wish, 1, 'jump'); b.jumpBuf = 9; return;
    }
    if(b.ground || !fresh) return;
    // on a bound the press is kept for the landing (a perfect one, if it is close enough)
    if(b.bound) return;
    // a dive with some speed in it: the pull-up
    if(b.state === 'dive' && b.diveT >= TUNE.pullMinDive && b.vy < -6 && b.have.has('pullup')){ pullUp(b, env); b.jumpBuf = 9; return; }
    // the ground or a wall about to arrive: keep the press for them (a perfect landing, a perfect kick)
    const g = TUNE.gravity*(b.state === 'dive' ? TUNE.diveGravity : 1);
    if(b.vy < 0 && timeToGround(env, b, g) <= TUNE.perfectLanding) return;
    const hs = hspeed(b);
    if(hs > TUNE.reboundMin && wallAhead(env, b, b.vx, b.vz, hs*TUNE.perfectRebound + 0.3) < Infinity) return;
    // the open air: the dash
    if(b.have.has('dash') && b.charges > 0 && b.dashCD <= 0 && b.airT > 0.15) dash(b, wish);
  }

  function chargeJump(b, wish){
    const c = b.charge; b.charge = null;
    const q = clamp(c.t/TUNE.chargeTime, 0, 1);
    b.vy = lerp(TUNE.jumpMin, TUNE.jumpMax, q)*TUNE.combo[c.combo]*flowK(b, 'flowPower');
    b.vx *= TUNE.chargeCarry; b.vz *= TUNE.chargeCarry;
    // THE LEAP: with the keys held she goes that way too, harder the fuller the charge and the higher the tier
    if(wish){ const f = lerp(TUNE.leapMin, TUNE.leapMax, q)*(1 + TUNE.leapTier*c.combo); b.vx += wish.x*f; b.vz += wish.z*f; }
    // …and off a real one she soars
    const leap = !!wish && (q >= TUNE.soarFrom || c.combo > 0);     // a leap goes somewhere: straight up is a jump
    if(leap) b.vy *= TUNE.leapUp;                                    // and trades a little of its height for the distance
    if(leap){ b.flyMax = b.fly = TUNE.soarTime*(0.5 + 0.5*q + 0.2*c.combo); b.hang = TUNE.hangTime; b.charges = TUNE.dashCharges; }
    b.last.leapT = leap && q > 0.7 && wish ? 0.5 : 0;               // a full running leap: the dive off the edge
    b.last.flipT = c.combo >= 2 ? 0.9 : 0;                          // high in the rhythm: a flip
    b.ground = false; b.coyote = 0; b.cut = true; b.roll = 0; b.sliding = false; b.state = 'air'; b.airT = 0; b.diveT = 0;
    b.slideWall = null; b.shiftLatch = true;
    b.combo = c.combo; b.fromCharge = true;
    addFlow(b, c.combo ? 'landPerfect' : 'jump');
    b.last.jump = b.vy; b.last.charge = q;
    emit(b, c.combo ? 'jumpPerfect' : 'jump', { vy:b.vy, charge:q, combo:c.combo, leap });
  }
  function superJump(b, wish, k, why){
    const p = flowK(b, 'flowPower')*k;
    b.vy = TUNE.jumpUp*p;
    b.vx *= TUNE.jumpCarry; b.vz *= TUNE.jumpCarry;
    if(wish){ b.vx += wish.x*TUNE.jumpFwd; b.vz += wish.z*TUNE.jumpFwd; }
    b.ground = false; b.coyote = 0; b.cut = false; b.roll = 0; b.sliding = false; b.state = 'air'; b.airT = 0; b.diveT = 0;
    b.slideWall = null; b.shiftLatch = true;
    addFlow(b, 'jump');
    b.last.jump = b.vy;
    emit(b, why || 'jump', { vy:b.vy });
  }

  /* ================================================================ the bound
     WHERE TO: the roof most in line with where she is pointed, at a
     comfortable distance — further the faster she is going and the more
     flow she has — that she can reach and whose arc nothing is in the
     way of. A landing point on it is a spot on her line, a little in from
     the edge, clear of the clutter. */
  const boundG = (b, perfect) => TUNE.boundGravity*(1 + TUNE.boundFlowGravity*b.flow)*(perfect ? TUNE.boundPerfectBonus : 1);
  function roofUnder(env, b){
    for(const r of env.roofs || []) if(b.x > r.x1 - 0.5 && b.x < r.x2 + 0.5 && b.z > r.z1 - 0.5 && b.z < r.z2 + 0.5 && Math.abs(b.y - r.top) < 1) return r;
    return null;
  }
  /* seconds until she comes down through height y1 under gravity g (null: she never gets that high) */
  function landIn(b, y1, g){
    const disc = b.vy*b.vy + 2*g*(b.y - y1);
    return disc < 0 ? null : (b.vy + Math.sqrt(disc))/g;
  }
  function boundLeft(b){ const t = b.bound ? landIn(b, b.bound.y, b.bound.g) : null; return t === null ? Infinity : t; }
  /* the arc from where she stands to c: up over the higher end, then down onto it */
  function arcTo(b, c, g, extra){
    const h = hyp(c.x - b.x, c.z - b.z);
    const top = Math.max(b.y, c.y) + TUNE.boundLift + h*TUNE.boundArc + (extra || 0);
    const vy = Math.sqrt(2*g*(top - b.y)), T = vy/g + Math.sqrt(2*Math.max(0.01, top - c.y)/g);
    return { vy, vx:(c.x - b.x)/T, vz:(c.z - b.z)/T, T, top };
  }
  function arcClear(env, b, a, g){
    for(let i=1;i<=18;i++){
      const t = a.T*i/19, x = b.x + a.vx*t, z = b.z + a.vz*t, y = b.y + a.vy*t - 0.5*g*t*t;
      if(overlapping(env, x, z, y)) return false;
    }
    return true;
  }
  function findTarget(b, env, dir, o){
    o = o || {};
    const roofs = env.roofs; if(!roofs || !roofs.length || !dir) return null;
    const hs = hspeed(b), g = boundG(b, o.perfect);
    const reach = TUNE.boundReach + TUNE.boundReachFlow*b.flow + (o.perfect ? 6 : 0);
    const ideal = clamp(TUNE.boundIdeal + hs*TUNE.boundIdealSpeed + b.flow*8 + (o.perfect ? 4 : 0), TUNE.boundMin + 2, reach - 2);
    const here = b.ground ? roofUnder(env, b) : null;
    const cands = [];
    for(const r of roofs){
      if(r === here) continue;
      const dy = r.top - b.y;
      if(dy > TUNE.boundUp || dy < -TUNE.boundDown) continue;
      // the spot: walk her line out and keep the point of the roof (in from its edges) closest to it
      const mx = Math.min(TUNE.boundInset, (r.x2 - r.x1)/2 - 0.2), mz = Math.min(TUNE.boundInset, (r.z2 - r.z1)/2 - 0.2);
      let pick = null, pd = Infinity;
      for(let s_=TUNE.boundMin; s_<=reach; s_+=1){
        const qx = b.x + dir.x*s_, qz = b.z + dir.z*s_;
        const cx = clamp(qx, r.x1 + mx, r.x2 - mx), cz = clamp(qz, r.z1 + mz, r.z2 - mz);
        const dev = hyp(cx - qx, cz - qz) + Math.abs(s_ - ideal)*0.06;
        if(dev < pd){ pd = dev; pick = { x:cx, z:cz }; }
      }
      if(!pick) continue;
      const d = hyp(pick.x - b.x, pick.z - b.z); if(d < TUNE.boundMin || d > reach) continue;
      const ang = Math.acos(clamp((dir.x*(pick.x - b.x) + dir.z*(pick.z - b.z))/d, -1, 1));
      if(ang > TUNE.boundCone) continue;
      const score = ang*1.6 + Math.abs(d - ideal)/ideal*0.7 + (dy < 0 ? -dy/30 : dy/15)*0.5;
      cands.push({ r, x:pick.x, y:r.top, z:pick.z, d, score });
    }
    cands.sort((a, b_)=>a.score - b_.score);
    for(const c of cands.slice(0, 6)){
      // the spot itself has to be clear (a water tank, a vent): try either side of it along her line
      let spot = null;
      for(const k of [0, 1.6, -1.6, 3]){ const x = c.x + dir.x*k, z = c.z + dir.z*k;
        if(x > c.r.x1 + 0.4 && x < c.r.x2 - 0.4 && z > c.r.z1 + 0.4 && z < c.r.z2 - 0.4 && !overlapping(env, x, z, c.y + 0.05) && floorAt(env, x, z, c.y + 0.1) >= c.y - 0.05){ spot = { x, z }; break; } }
      if(!spot) continue;
      const t = { roof:c.r, x:spot.x, y:c.y, z:spot.z, d:hyp(spot.x - b.x, spot.z - b.z) };
      if(o.air){
        // already in the air: her rise is what it is; only the line across bends
        const tl = landIn(b, t.y, g); if(tl === null || tl < 0.3) continue;
        const vh = t.d/tl; if(vh > Math.max(hs*1.5 + 6, 16) || vh > TUNE.maxSpeed) continue;
        const a = { vy:b.vy, vx:(t.x - b.x)/tl, vz:(t.z - b.z)/tl, T:tl };
        if(!arcClear(env, b, a, g)) continue;
        t.arc = a; t.g = g; return t;
      }
      for(const extra of [0, 5]){
        const a = arcTo(b, t, g, extra);
        if(arcClear(env, b, a, g)){ t.arc = a; t.g = g; return t; }
      }
    }
    return null;
  }
  /* where she is pointed: the keys if they are held, the camera if not (in the air, her own line) */
  function aimDir(b, inp, wish, air){
    if(wish && !wish.back) return wish;
    const hs = hspeed(b);
    if(air && hs > 4) return { x:b.vx/hs, z:b.vz/hs };
    return { x:-Math.sin(inp.yaw || 0), z:-Math.cos(inp.yaw || 0) };
  }
  function tryBound(b, inp, wish, env, perfect){
    const t = findTarget(b, env, aimDir(b, inp, wish, false), { perfect });
    if(!t) return false;
    launchBound(b, t, perfect);
    return true;
  }
  function launchBound(b, t, perfect){
    const a = t.arc;
    b.vx = a.vx; b.vz = a.vz; b.vy = a.vy;
    b.ground = false; b.coyote = 0; b.cut = true; b.roll = 0; b.sliding = false; b.state = 'bound'; b.airT = 0; b.diveT = 0;
    b.slideWall = null; b.shiftLatch = true; b.plant = 0;
    b.bound = { x:t.x, y:t.y, z:t.z, roof:t.roof, g:t.g, perfect:!!perfect };
    b.hops++;
    addFlow(b, perfect ? 'boundPerfect' : 'bound');
    b.last.bound = { d:t.d, T:a.T, perfect:!!perfect, roof:t.roof && t.roof.id };
    emit(b, perfect ? 'boundPerfect' : 'bound', { d:t.d, x:t.x, y:t.y, z:t.z, T:a.T, roof:t.roof && t.roof.id });
  }
  /* IN THE AIR, SPACE held: point somewhere else and she bends to the roof over
     there; falling free (off a kick, a pull, the first burn of the shoes) and
     she catches the line to the nearest roof she can still make. */
  function steerBound(b, inp, wish, dt, env){
    if(b.ground || b.swoop || b.wall || !b.have.has('bound')) return;
    b.aimT -= dt; if(b.aimT > 0) return;
    b.aimT = 0.1;
    const hs = hspeed(b), line = hs > 2 ? { x:b.vx/hs, z:b.vz/hs } : null;
    if(b.bound){
      if(!wish || wish.back || !line || !b.have.has('steer')) return;
      const off = Math.acos(clamp(wish.x*line.x + wish.z*line.z, -1, 1));
      if(off < TUNE.boundRetarget) return;
      const t = findTarget(b, env, wish, { air:true });
      if(!t || t.roof === b.bound.roof) return;
      b.bound = { x:t.x, y:t.y, z:t.z, roof:t.roof, g:t.g, perfect:b.bound.perfect };
      emit(b, 'boundTurn', { roof:t.roof && t.roof.id });
      return;
    }
    if(!inp.jump || b.state === 'dive' || b.dashT > 0 || b.airT < 0.3 || b.vy > 4) return;
    const t = findTarget(b, env, aimDir(b, inp, wish, true), { air:true });
    if(!t) return;
    b.state = 'bound'; b.diveT = 0;
    b.bound = { x:t.x, y:t.y, z:t.z, roof:t.roof, g:t.g, perfect:false };
    emit(b, 'boundCatch', { roof:t.roof && t.roof.id });
  }
  /* THE FIRST BURN: the shoes, fired for the first time, in the air — straight up, hard */
  function ignite(b, inp){
    const yaw = inp ? inp.yaw || 0 : 0;
    b.vy = TUNE.ignite; b.vx = b.vx*0.5 - Math.sin(yaw)*6; b.vz = b.vz*0.5 - Math.cos(yaw)*6;
    b.ground = false; b.state = 'air'; b.bound = null; b.swoop = null; b.wall = null; b.slideWall = null;
    b.cut = true; b.airT = 0; b.diveT = 0; b.shiftLatch = true; b.aimT = 0.35;
    addFlow(b, 'boundPerfect');
    emit(b, 'ignite', { vy:b.vy });
  }

  /* the pull-up: how good it is, decided by whether the swoop has room */
  function pullQuality(b, env){
    const E = Math.max(0, -b.vy);
    const alt = b.y - floorAt(env, b.x, b.z, b.y);
    // the swoop carries her down about half its length before she is rising
    const need = E*TUNE.swoopTime*0.5 + 0.4;
    const spare = (alt - need)/Math.max(E, 1);          // seconds of room above what the swoop needs
    // and a wall in front works the same as the ground below
    const ahead = wallAhead(env, b, b.vx, b.vz, 60), hs = hspeed(b);
    const wallSpare = hs > 4 ? (ahead - hs*TUNE.swoopTime*0.5)/hs : Infinity;
    const s = Math.min(spare, wallSpare);
    if(s < 0) return { kind:'late', q:0.8, spare:s, E };
    if(s <= TUNE.perfectSlack) return { kind:'perfect', q:TUNE.perfectPull, spare:s, E };
    return { kind:'early', q:Math.max(TUNE.earlyFloor, 1 - (s - TUNE.perfectSlack)*0.35), spare:s, E };
  }
  function pullUp(b, env){
    const pq = pullQuality(b, env), E = pq.E;
    const chain = b.have.has('chain') ? 1 + TUNE.chainBonus*b.chain : 1;
    const up = clamp(TUNE.pullBase + E*TUNE.pullEfficiency*pq.q*flowK(b, 'flowPower')*chain, 0, TUNE.maxRise);
    const hs = hspeed(b), fwd = hs + E*TUNE.pullForward*pq.q;
    const hx = hs > 0.5 ? b.vx/hs : -Math.sin(b.heading), hz = hs > 0.5 ? b.vz/hs : -Math.cos(b.heading);
    b.swoop = { t:0, vy0:b.vy, up, h0:hs, h1:Math.min(fwd, TUNE.maxSpeed), hx, hz, kind:pq.kind };
    b.state = 'swoop';
    b.last.pull = { kind:pq.kind, q:pq.q, up, E, spare:pq.spare };
    if(pq.kind === 'perfect'){ addFlow(b, 'pullPerfect'); b.charges = Math.min(TUNE.dashCharges, b.charges + 1); }
    else addFlow(b, 'pull');
    b.chain++;
    emit(b, pq.kind === 'perfect' ? 'pullPerfect' : 'pull', pq);
  }

  function rebound(b, wish, perfect){
    const w = b.wall, n = w.n, vin = w.vin;
    const into = Math.max(0, -(vin.x*n.x + vin.z*n.z));               // speed she hit the wall with
    const tx = vin.x + n.x*into, tz = vin.z + n.z*into;                // along the wall
    const chain = b.have.has('chain') ? 1 + TUNE.chainBonus*b.chain : 1;
    const k = (perfect ? TUNE.perfectReboundBonus : 1)*(w.weak ? 0.6 : 1)*flowK(b, 'flowPower')*chain;
    const out = (TUNE.reboundPush + into*TUNE.reboundKeepN)*k;
    let vx = n.x*out + tx*TUNE.reboundKeepT, vz = n.z*out + tz*TUNE.reboundKeepT;
    // the keys may lean the kick, a little
    if(wish){ vx += wish.x*3; vz += wish.z*3; }
    b.vx = vx; b.vz = vz;
    b.vy = clamp((TUNE.reboundUp + hyp(vin.x, vin.z)*TUNE.reboundUpFromSpeed)*k, 0, TUNE.maxRise);
    b.wall = null; b.slideWall = null; b.state = 'air'; b.airT = 0.2; b.diveT = 0; b.cut = true;
    b.charges = TUNE.dashCharges;
    b.chain++;
    addFlow(b, perfect ? 'reboundPerfect' : 'rebound');
    b.last.rebound = { perfect:!!perfect, into, vy:b.vy, out };
    emit(b, perfect ? 'reboundPerfect' : 'rebound', { perfect:!!perfect, n });
  }

  function dash(b, wish){
    const hs = hspeed(b);
    let dx = wish ? wish.x : (hs > 0.5 ? b.vx/hs : -Math.sin(b.heading)), dz = wish ? wish.z : (hs > 0.5 ? b.vz/hs : -Math.cos(b.heading));
    if(hs > 0.5){ dx = dx*(1 - TUNE.dashKeep) + b.vx/hs*TUNE.dashKeep; dz = dz*(1 - TUNE.dashKeep) + b.vz/hs*TUNE.dashKeep; }
    const d = hyp(dx, dz) || 1, sp = Math.min(TUNE.maxSpeed, Math.max(TUNE.dashSpeed*flowK(b, 'flowSpeed'), hs*1.04));
    b.vx = dx/d*sp; b.vz = dz/d*sp;
    b.vy = Math.max(b.vy*0.25, TUNE.dashUp);
    b.dashT = TUNE.dashTime; b.dashCD = TUNE.dashCooldown; b.charges--;
    b.state = 'air'; b.diveT = 0;
    addFlow(b, 'dash');
    emit(b, 'dash', { charges:b.charges });
  }

  /* ------------------------------------------------------- one substep */
  function sub(b, inp, wish, h, env){
    if(b.ground) groundMove(b, inp, wish, h);
    else airMove(b, inp, wish, h, env);
    // across: one axis at a time, so a wall stops one and not the other
    const hitX = moveAxis(b, 'x', b.vx*h, env), hitZ = moveAxis(b, 'z', b.vz*h, env);
    [hitX, hitZ].forEach(hit=>{ if(hit) touchWall(b, hit, env); });
    // up and down
    const feet0 = b.y;
    if(!b.ground){
      b.y += b.vy*h;
      // a ceiling: something whose underside she rises into
      if(b.vy > 0){ for(const s of env.solids){ if(s.off || s.y1 === undefined || s.y1 < feet0 + TALL - 0.05 || s.y1 > b.y + TALL) continue;
        if(b.x + R > s.x1 && b.x - R < s.x2 && b.z + R > s.z1 && b.z - R < s.z2){ b.y = s.y1 - TALL; b.vy = 0; break; } } }
      const floor = floorAt(env, b.x, b.z, feet0);
      if(b.y <= floor) land(b, floor, inp, wish, env);
    } else {
      const floor = floorAt(env, b.x, b.z, b.y);
      if(floor < b.y - 0.6){ b.ground = false; b.state = 'air'; b.coyote = TUNE.coyote; b.vy = 0; b.airT = 0; b.cut = true; b.shiftLatch = !!inp.shift; b.fromCharge = false; }
      else b.y = floor > b.y ? lerp(b.y, floor, Math.min(1, h*16)) : floor;
    }
    // the edge of the world is a wall too
    if(env.bounds){ const B = env.bounds;
      if(b.x < B.x1){ b.x = B.x1; b.vx = Math.abs(b.vx)*0.3; } if(b.x > B.x2){ b.x = B.x2; b.vx = -Math.abs(b.vx)*0.3; }
      if(b.z < B.z1){ b.z = B.z1; b.vz = Math.abs(b.vz)*0.3; } if(b.z > B.z2){ b.z = B.z2; b.vz = -Math.abs(b.vz)*0.3; } }
  }

  function groundMove(b, inp, wish, h){
    if(b.roll > 0) b.roll -= h;
    if(b.plant > 0) b.plant -= h;
    if(b.coyote > 0) b.coyote -= h;
    const target = (inp.shift ? TUNE.sprintSpeed : TUNE.runSpeed)*flowK(b, 'flowSpeed')*(b.charge ? TUNE.chargeCrouch : 1);   // crouched to jump, she creeps
    const hs = hspeed(b);
    b.sliding = !!(b.sliding && inp.shift && hs > TUNE.runSpeed && b.have.has('slide'));
    if(wish){
      // turn the run towards the keys; anything over the run speed fades rather than stops
      let hx = hs > 0.3 ? b.vx/hs : wish.x, hz = hs > 0.3 ? b.vz/hs : wish.z;
      const a = Math.atan2(hx, hz), w = Math.atan2(wish.x, wish.z);
      let d = Math.atan2(Math.sin(w - a), Math.cos(w - a));
      const turn = TUNE.groundTurn*h*(b.sliding ? 0.25 : 1);
      const na = a + clamp(d, -turn, turn);
      let sp = hs;
      if(sp < target) sp = Math.min(target, sp + TUNE.groundAccel*h);
      else sp = target + (sp - target)*Math.exp(-(b.sliding ? TUNE.slideKeep : TUNE.groundKeep)*h);
      if(Math.abs(d) > 2.4 && hs < target*1.2) sp = Math.max(0, sp - TUNE.groundAccel*h*2);   // reversing: stop first
      b.vx = Math.sin(na)*sp; b.vz = Math.cos(na)*sp;
    } else {
      const brake = b.last.rollT > 0 ? 4 : (hs > TUNE.sprintSpeed ? TUNE.stopDecel*0.5 : TUNE.stopDecel);   // mid-somersault she rolls on
      const sp = Math.max(0, hs - brake*h);
      if(hs > 1e-4){ b.vx *= sp/hs; b.vz *= sp/hs; }
    }
    b.vy = 0;
  }

  function airMove(b, inp, wish, h, env){
    b.airT += h;
    if(b.coyote > 0) b.coyote -= h;
    // the swoop: from falling to rising, through the bottom of the curve
    if(b.swoop){
      const s = b.swoop; s.t += h;
      const k = clamp(s.t/TUNE.swoopTime, 0, 1), e = k*k*(3 - 2*k);
      b.vy = lerp(s.vy0, s.up, e);
      const hs = lerp(s.h0, s.h1, e); b.vx = s.hx*hs; b.vz = s.hz*hs;
      capSpeed(b);
      if(k >= 1){ b.swoop = null; b.state = 'air'; b.diveT = 0; b.cut = true; b.airT = 0.2; }
      return;
    }
    // on a bound: the arc is the shoes' — gravity of their own, and the line held to the roof
    if(b.bound){
      if(!inp.shift) b.shiftLatch = false;
      if(inp.shift && !b.shiftLatch && b.have.has('dive') && b.airT > 0.12){ b.bound = null; b.state = 'air'; }       // SHIFT lets go of it: a dive, below
      else {
        const bd = b.bound;
        b.vy -= bd.g*h;
        const tl = landIn(b, bd.y, bd.g);
        if(tl === null){ b.bound = null; b.state = 'air'; return; }                     // knocked off it: she is on her own
        const t = Math.max(tl, h*2), k = 1 - Math.exp(-TUNE.boundHoming*h);
        b.vx = lerp(b.vx, (bd.x - b.x)/t, k); b.vz = lerp(b.vz, (bd.z - b.z)/t, k);
        const hs = hspeed(b); if(hs > TUNE.maxSpeed){ b.vx *= TUNE.maxSpeed/hs; b.vz *= TUNE.maxSpeed/hs; }
        return;
      }
    }
    // a foot on a wall: it holds her for a moment, then she slides
    if(b.wall){
      b.wall.t += h;
      b.vy = Math.max(b.vy - TUNE.gravity*TUNE.wallSlideGravity*h, -4);
      if(b.wall.t >= TUNE.reboundGrace){ b.slideWall = b.wall; b.wall = null; b.state = 'slide'; }
      return;
    }
    // a wall she is sliding down is only there while she is touching it
    if(b.slideWall){ const n = b.slideWall.n; if(!overlapping(env, b.x - n.x*0.08, b.z - n.z*0.08, b.y)) b.slideWall = null; }
    // SHIFT still held from the sprint is not a dive: it has to be let go and pressed again
    if(!inp.shift) b.shiftLatch = false;
    const diving = inp.shift && !b.shiftLatch && b.have.has('dive') && b.airT > 0.12;
    if(diving && b.state !== 'dive'){ b.state = 'dive'; b.diveT = 0; emit(b, 'dive'); }
    if(!diving && b.state === 'dive'){ b.state = 'air'; }
    if(b.state === 'dive') b.diveT += h;
    // gravity, and what changes it
    let g = TUNE.gravity;
    if(b.state === 'dive') g *= TUNE.diveGravity;
    else if(b.hang > 0){ b.hang -= h; if(Math.abs(b.vy) < 6) g *= TUNE.hangGravity; }        // the top of a release: she hangs there
    if(b.fly > 0 && b.state !== 'dive'){                         // flying off the web: carried by her speed, and settling into the fall
      b.fly -= h;
      const k = clamp(b.fly/(b.flyMax || TUNE.flyTime), 0, 1);
      let gk = lerp(1, TUNE.flyGravity, k);
      if(b.vy < 0) gk *= 1 - TUNE.flyLift*clamp(hspeed(b)/TUNE.flyLiftSpeed, 0, 1)*k;
      g *= gk;
    }
    else if(b.vy > 0 && b.jumpHeld && !b.cut) g *= TUNE.jumpHoldGravity;
    if(b.dashT > 0){ b.dashT -= h; g *= 0.2; }
    if(b.slideWall){ g *= TUNE.wallSlideGravity; }
    b.vy -= g*h;
    b.vy = Math.max(b.vy, -(b.state === 'dive' ? TUNE.maxDive : TUNE.maxFall));
    if(b.slideWall) b.vy = Math.max(b.vy, -9);
    // the dive pushes her along her line
    let hs = hspeed(b);
    let hx = hs > 0.3 ? b.vx/hs : -Math.sin(b.heading), hz = hs > 0.3 ? b.vz/hs : -Math.cos(b.heading);
    if(b.state === 'dive'){ hs = Math.min(TUNE.maxDive, hs + TUNE.diveFwd*h); }
    // the keys: bend the line, push along it, hold back to brake
    const gentle = b.have.has('charge') && b.state !== 'dive';
    if(wish && b.have.has('steer')){
      const ctl = flowK(b, 'flowControl');
      if(wish.back){ hs = Math.max(0, hs - TUNE.airBrake*h); }
      else {
        const a = Math.atan2(hx, hz), w = Math.atan2(wish.x, wish.z);
        const d = Math.atan2(Math.sin(w - a), Math.cos(w - a));
        const turn = (b.state === 'dive' ? TUNE.diveTurn : gentle ? TUNE.jAirTurn : TUNE.airTurn)*ctl*h*(hs < 6 ? 3 : 1);
        const na = a + clamp(d, -turn, turn); hx = Math.sin(na); hz = Math.cos(na);
        const cap = (gentle ? TUNE.jAirMax : TUNE.maxAirSpeed)*flowK(b, 'flowSpeed');
        if(hs < cap) hs = Math.min(cap, hs + (gentle ? TUNE.jAirAccel : TUNE.airAccel)*ctl*h*Math.max(0, Math.cos(d)));
      }
    }
    hs *= Math.exp(-TUNE.airDrag*h);
    if(gentle && !wish && !b.wall && !b.swoop) hs *= Math.exp(-TUNE.jAirSettle*h);     // no keys: her drift settles
    hs = Math.min(hs, TUNE.maxSpeed);
    b.vx = hx*hs; b.vz = hz*hs;
    capSpeed(b);
  }
  /* nothing — not a dive, not a pull, not a kick — goes faster than maxSpeed */
  function capSpeed(b){
    const s = speed(b); if(s <= TUNE.maxSpeed) return;
    const k = TUNE.maxSpeed/s; b.vx *= k; b.vy *= k; b.vz *= k;
  }

  function moveAxis(b, axis, d, env){
    if(!d) return null;
    const nx = axis === 'x' ? b.x + d : b.x, nz = axis === 'z' ? b.z + d : b.z;
    const s = overlapping(env, nx, nz, b.y);
    if(!s){ b[axis] += d; return null; }
    // stand against its face
    if(axis === 'x') b.x = d > 0 ? Math.min(b.x, s.x1 - R - 1e-3) : Math.max(b.x, s.x2 + R + 1e-3);
    else b.z = d > 0 ? Math.min(b.z, s.z1 - R - 1e-3) : Math.max(b.z, s.z2 + R + 1e-3);
    return { s, n: axis === 'x' ? { x:d > 0 ? -1 : 1, z:0 } : { x:0, z:d > 0 ? -1 : 1 } };
  }

  /* a wall, met at speed in the air, is something to kick off */
  function touchWall(b, hit, env){
    const n = hit.n, into = -(b.vx*n.x + b.vz*n.z);
    if(b.bound && hit.s.y2 - b.y > 0.3){ b.bound = null; b.state = 'air'; }
    const tall = hit.s.y2 - b.y > 1.2;
    if(!b.ground && !b.wall && !b.swoop && tall && into >= TUNE.reboundMin && b.have.has('rebound')){
      b.wall = { n, vin:{ x:b.vx, z:b.vz }, vy:b.vy, t:0, s:hit.s };
      if(b.jumpBuf <= TUNE.perfectRebound) b.wall.pressAt = 0;     // pressed just before she touched: perfect
      b.state = 'wall'; b.diveT = 0;
      b.vx -= n.x*(b.vx*n.x + b.vz*n.z); b.vz -= n.z*(b.vx*n.x + b.vz*n.z);
      b.vx *= 0.15; b.vz *= 0.15;
      b.vy = Math.max(b.vy*0.3, -2);
      emit(b, 'wallHit', { into });
      if(b.wall.pressAt === 0){ rebound(b, null, true); b.jumpBuf = 9; }
      return;
    }
    if(!b.ground && !b.wall && tall && b.have.has('rebound') && !b.swoop) b.slideWall = { n, vin:{ x:b.vx, z:b.vz }, vy:b.vy, t:0, s:hit.s };
    // otherwise she just stops going that way
    const vn = b.vx*n.x + b.vz*n.z; if(vn < 0){ b.vx -= n.x*vn; b.vz -= n.z*vn; }
  }

  function land(b, floor, inp, wish, env){
    const impact = -b.vy, hs = hspeed(b), bounded = !!b.bound;
    b.fly = 0;
    b.y = floor; b.vy = 0; b.ground = true; b.state = 'ground'; b.bound = null; b.landT = 0;
    b.charges = TUNE.dashCharges; b.wall = null; b.slideWall = null; b.diveT = 0;
    if(b.swoop){ b.swoop = null; b.flow *= 0.6; b.chain = 0; emit(b, 'swoopCrash', { impact }); }
    b.vx *= TUNE.landKeep; b.vz *= TUNE.landKeep;
    b.last.land = { impact, hs };
    // off a bound: pressed in the gold, straight into a perfect one; SPACE still held, a beat on her feet and on
    b.fromBound = bounded;
    if(bounded && b.have.has('bound')){
      if(b.jumpBuf <= TUNE.boundPerfect){
        b.jumpBuf = 9;
        emit(b, 'boundLand', { perfect:true, hops:b.hops, impact });
        if(tryBound(b, inp, wish, env, true)) return;
        superJump(b, wish, TUNE.perfectLandingBonus, 'jumpPerfect'); return;
      }
      if(inp.jump){ b.plant = TUNE.boundPlant; emit(b, 'boundLand', { perfect:false, hops:b.hops, impact }); return; }
      // let go: the bound's speed was the shoes'; she touches down at a run, not off the far side of the roof
      const k = Math.min(1, TUNE.runSpeed*1.3/Math.max(hs, 0.01)); b.vx *= k; b.vz *= k;
    }
    // CHARGED, IN TIME: SPACE pressed just before her feet touch is the next tier — a crouch if it is still held, a jump if it was a tap
    if(b.have.has('charge')){
      if(b.jumpBuf <= TUNE.perfectLanding){
        b.jumpBuf = 9;
        const tier = b.fromCharge ? Math.min(b.combo + 1, TUNE.combo.length - 1) : 0;
        emit(b, 'landPerfect', { impact, combo:tier });
        b.charge = { t:0, combo:tier };
        if(!inp.jump) chargeJump(b, wish);
        return;
      }
      /* DOWN FROM A HEIGHT: A SOMERSAULT. Anything more than a few metres is taken with a forward roll — the
         whole of it, not the first knee of it — and she comes up running; if she came straight down, the roll
         carries her a few steps forward anyway. */
      if(impact > TUNE.somersaultImpact){
        if(hs < TUNE.somersaultPush){ const f = b.faceY !== undefined ? b.faceY : (b.heading || 0), k = hs > 0.5 ? 1/hs : 0;
          const dx = hs > 0.5 ? b.vx*k : Math.sin(f), dz = hs > 0.5 ? b.vz*k : Math.cos(f); b.vx = dx*TUNE.somersaultPush; b.vz = dz*TUNE.somersaultPush; }
        b.roll = TUNE.rollTime; b.last.rollT = TUNE.somersaultTime; addFlow(b, 'roll'); emit(b, 'roll', { impact, somersault:true }); return;
      }
      emit(b, 'land', { impact });
      return;
    }
    if(b.jumpBuf <= TUNE.perfectLanding && b.have.has('jump')){
      addFlow(b, 'landPerfect');
      emit(b, 'landPerfect', { impact });
      b.jumpBuf = 9;
      if(b.have.has('bound') && tryBound(b, inp, wish, env, true)) return;
      superJump(b, wish, TUNE.perfectLandingBonus, 'jumpPerfect');
      return;
    }
    b.chain = 0;
    if(inp.shift && hs > TUNE.runSpeed && b.have.has('slide')){ b.sliding = true; emit(b, 'slide', { hs }); return; }
    if(impact > TUNE.rollImpact || (impact > 14 && hs > 16)){ b.roll = TUNE.rollTime; addFlow(b, 'roll'); emit(b, 'roll', { impact }); }
    else emit(b, 'land', { impact });
  }

  function flowTick(b, inp, dt){
    if(b.ground){
      const street = b.y < 0.6, moving = hspeed(b) > 6;
      b.flow = Math.max(0, b.flow - (street ? TUNE.flowGround : moving ? TUNE.flowRoof*0.3 : TUNE.flowRoof)*dt);
    } else if(speed(b) > 14) b.flow = Math.min(1, b.flow + TUNE.flowAir*dt);
    if(hspeed(b) > 0.5) b.heading = Math.atan2(-b.vx, -b.vz);       // the way the camera yaw counts: forward is -sin, -cos
  }

  /* ============================================================ in game
     The part with a picture: the body above driven by the keys, a camera
     that tells you how fast you are going, glowing boots, a trail, a few
     sounds, and the debug view. A place switches it on with attach() and
     off with detach(); game.js hands its step to G.mover while it is on. */
  let on = false, B = null, env = null, hooks = {}, dbg = false;
  const fx = { glow:[], trail:null, trailPts:[], line:null, arrow:null, nArrow:null, group:null, target:null };
  let camP = null, camL = null, fovNow = 70, punch = 0, yawSet = null, mouseIdle = 0, lastEdge = false, previewT = 0, shown = true;
  function attach(o){
    o = o || {};
    env = o.env; hooks = o.hooks || {};
    B = body({ x:G.pos.x, y:G.pos.y - 1.7, z:G.pos.z, have:new Set(o.have || ALL), heading:G.yaw });
    B.ground = true;
    on = true; camP = null;
    G.mover = moverStep;
    hud(true);
    return B;
  }
  function detach(){
    on = false; if(G.mover === moverStep) G.mover = null;
    clearFx(); hud(false); wind(0);
  }
  function teach(list){ if(B) B.have = new Set(list); }
  /* the shoes fire for the first time (the opening): the step's events are handled here, as moverStep would */
  function fire(){ if(!B) return; B.events = []; ignite(B, { yaw:G.yaw }); B.events.forEach(e=>react(e)); B.events = []; }
  function learn(t){ if(B && !B.have.has(t)){ B.have.add(t); if(hooks.learned) hooks.learned(t); } }
  /* somebody moved her (a door, a cutscene): the body follows */
  function sync(){ if(!B) return; B.x = G.pos.x; B.z = G.pos.z; B.y = G.pos.y - 1.7; B.vx = B.vy = B.vz = 0; B.ground = true; B.state = 'ground'; B.wall = B.slideWall = B.swoop = null; camP = null; }
  function stop(){ if(B){ B.vx = B.vz = 0; if(B.vy > 0) B.vy = 0; } }
  function moverStep(dt){
    if(!on || !B) return false;
    if(hooks.slow) dt *= hooks.slow();                // a moment the place wants in slow motion (the first fall)
    // somewhere the boots are off (a flat with a ceiling three metres up): the plain walk has her
    if(hooks.enabled && !hooks.enabled()){ B.off = true; return false; }
    if(B.off){ B.off = false; sync(); }
    // somebody else moved the player since last frame (a door, a ladder, a cutscene): believe them
    if(Math.abs(B.x - G.pos.x) > 0.05 || Math.abs(B.z - G.pos.z) > 0.05 || Math.abs(B.y + 1.7 - G.pos.y) > 0.05) sync();
    const k = G.keys, edge = !!k.Space && !lastEdge; lastEdge = !!k.Space;
    const inp = { z:(k.KeyW||k.ArrowUp ? 1 : 0) - (k.KeyS||k.ArrowDown ? 1 : 0), x:(k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0),
      yaw:G.yaw, jump:!!k.Space, jumpEdge:edge, shift:!!(k.ShiftLeft||k.ShiftRight) };
    if(k.ArrowLeft) G.yaw += 2*dt; if(k.ArrowRight) G.yaw -= 2*dt;
    if(hooks.input) hooks.input(inp);
    const evs = step(B, inp, dt, env);
    // standing (or planted): where SPACE would take her, for the ring on that roof
    previewT -= dt;
    if(B.ground && B.have.has('bound') && previewT <= 0){ previewT = 0.12; B.preview = findTarget(B, env, aimDir(B, inp, wishDir(inp), false), {}); }
    if(!B.ground) B.preview = null;
    G.pos.set(B.x, B.y + 1.7, B.z); G.vel.set(B.vx, B.vy, B.vz); G.onGround = B.ground;
    evs.forEach(e=>react(e));
    animate(dt, inp);
    camera(dt);
    tickFx(dt);
    hudTick();
    if(hooks.step) hooks.step(B, evs, dt);
    return true;
  }

  /* ------------------------------------------------------------ the body */
  function animate(dt, inp){
    if(!window.AVATAR) return;
    const moving = B.ground && hspeed(B) > 0.6;
    let post = null;
    const can = n => AVATAR.can && AVATAR.can(n);
    if(B.last.flipT > 0) post = can('web_flip') ? 'web_flip' : can('flip') ? 'flip' : 'jump';          // high in the rhythm: a flip
    else if(B.last.leapT > 0) post = can('web_start') ? 'web_start' : 'jump';                         // off the edge: the leap
    else if(B.last.hardT > 0) post = 'hard_land';
    else if(B.fly > 0 && !B.ground && speed(B) > 12 && B.state !== 'dive') post = can('fly') ? 'fly' : 'jump';    // soaring
    else if(B.bound) post = B.bound.perfect && B.airT < 0.55 && AVATAR.can('flip') ? 'flip' : 'jump';
    else if(B.roll > 0 || B.last.rollT > 0) post = AVATAR.can('roll') ? 'roll' : AVATAR.can('flip') ? 'flip' : 'jump';
    else if(B.swoop || (B.last.reboundT > 0)) post = AVATAR.can('flip') ? 'flip' : 'jump';
    else if(B.state === 'dive' || B.dashT > 0) post = AVATAR.can('fly') ? 'fly' : 'jump';
    else if(B.wall || B.slideWall) post = 'jump';
    if(B.last.reboundT > 0) B.last.reboundT -= dt;
    if(B.last.leapT > 0) B.last.leapT -= dt;
    if(B.last.flipT > 0) B.last.flipT -= dt;
    if(B.last.hardT > 0) B.last.hardT -= dt;
    if(B.last.rollT > 0) B.last.rollT -= dt;
    AVATAR.posture(post);
    AVATAR.gait(0, 1);
    AVATAR.update(dt, moving, hspeed(B) > TUNE.runSpeed + 1, B.ground);
    AVATAR.posture(null);
    const bd = AVATAR.body; if(!bd) return;
    // she faces where she is going, not where the camera looks
    const face = B.wall ? Math.atan2(-B.wall.n.x, -B.wall.n.z) : hspeed(B) > 0.6 ? Math.atan2(B.vx, B.vz) : (B.faceY !== undefined ? B.faceY : G.yaw + Math.PI);
    B.faceY = face;
    // and leans into the dive
    const flying = B.fly > 0 && !B.ground && B.state !== 'dive' && !(B.last.flipT > 0) && !(B.last.leapT > 0) && speed(B) > 12;
    const pitch = flying ? clamp(Math.atan2(-B.vy, hspeed(B) + 1)*0.85, -0.7, 1.0) : B.state === 'dive' ? clamp(Math.atan2(-B.vy, hspeed(B) + 1)*0.9, 0, 1.3) : B.dashT > 0 ? 0.5 : B.bound && B.vy < 0 ? clamp(-B.vy*0.018, 0, 0.35) : 0;
    bd.rotation.order = 'YXZ';
    bd.rotation.set(lerp(bd.rotation.x || 0, pitch, Math.min(1, dt*8)), face, 0);
  }

  /* ---------------------------------------------------------- the camera
     Back further and wider the faster she goes; up when she launches;
     above and looking down the line in a dive; a little kick on a perfect
     move. With the mouse left alone it swings round behind her line, so
     where she is going is always on screen. */
  function camera(dt){
    if(hooks.camera === false) return;
    const sp01 = clamp((speed(B) - 8)/42, 0, 1);
    if(yawSet !== null && Math.abs(G.yaw - yawSet) > 1e-4) mouseIdle = 0; else mouseIdle += dt;
    if(!B.ground && hspeed(B) > 10 && mouseIdle > (B.fly > 0 ? 0.3 : B.bound ? 0.35 : 0.6) && !B.wall){
      const want = Math.atan2(-B.vx, -B.vz), d = Math.atan2(Math.sin(want - G.yaw), Math.cos(want - G.yaw));
      G.yaw += d*Math.min(1, dt*TUNE.camFollow*(0.5 + sp01));
    }
    yawSet = G.yaw;
    const fx_ = -Math.sin(G.yaw), fz_ = -Math.cos(G.yaw);
    const dist = lerp(TUNE.camDist, TUNE.camDistFast, sp01) + punch*1.5;
    const lift = TUNE.camLift + (B.vy > 10 ? 1.0 : 0) + (B.state === 'dive' ? 2.2 : 0) - Math.sin(G.pitch||0)*3;
    const head = new THREE.Vector3(B.x, B.y + 1.6, B.z);
    let want = new THREE.Vector3(B.x - fx_*dist + Math.cos(G.yaw)*0.5, B.y + 1.6 + lift, B.z - fz_*dist - Math.sin(G.yaw)*0.5);
    want = clearOf(head, want);
    const look = new THREE.Vector3(B.x + B.vx*0.16 + fx_*4, B.y + 1.4 + B.vy*0.1 + (B.state === 'dive' ? -2.5 : 0) + Math.sin(G.pitch||0)*4, B.z + B.vz*0.16 + fz_*4);
    if(B.bound) look.lerp(new THREE.Vector3(B.bound.x, B.bound.y + 1.2, B.bound.z), 0.28);
    if(!camP){ camP = want.clone(); camL = look.clone(); }
    const k = 1 - Math.exp(-dt*(B.ground ? 9 : 7));
    camP.lerp(want, k); camL.lerp(look, 1 - Math.exp(-dt*10));
    G.camera.position.copy(camP); G.camera.lookAt(camL);
    punch = Math.max(0, punch - dt*2.2);
    const fov = lerp(TUNE.camFov, TUNE.camFovFast, sp01) + punch*10;
    fovNow = lerp(fovNow, fov, 1 - Math.exp(-dt*5));
    if(Math.abs(G.camera.fov - fovNow) > 0.05){ G.camera.fov = fovNow; G.camera.updateProjectionMatrix(); }
  }
  /* pull the camera in front of any building between it and her */
  function clearOf(from, to){
    let k = 1;
    for(const s of env.solids){
      if(s.off || (s.y2 - (s.y1||0)) < 3) continue;
      for(let i=1;i<=12;i++){
        const t = i/12, x = lerp(from.x, to.x, t), y = lerp(from.y, to.y, t), z = lerp(from.z, to.z, t);
        if(x > s.x1 - 0.3 && x < s.x2 + 0.3 && z > s.z1 - 0.3 && z < s.z2 + 0.3 && y > (s.y1||0) && y < s.y2 + 0.4){ k = Math.min(k, Math.max(0.12, t - 0.1)); break; }
      }
    }
    return from.clone().lerp(to, k);
  }

  /* --------------------------------------------- what each move feels like */
  function react(e){
    const n = e.name;
    if(n === 'jump' || n === 'jumpPerfect'){ sfx('jump'); ring(); punch = Math.max(punch, n === 'jumpPerfect' ? 0.8 : 0.35); }
    if(n === 'bound'){ sfx('jump'); ring(); punch = Math.max(punch, 0.3); }
    if(n === 'boundPerfect'){ sfx('perfect'); sfx('jump'); ring(); punch = Math.max(punch, 0.75); flashTrail(); }
    if(n === 'boundLand' && !e.perfect) sfx('land', 0.3);
    if(n === 'boundTurn' || n === 'boundCatch') sfx('dash');
    if(n === 'ignite'){ sfx('boom'); ring(); setTimeout(()=>{ if(on) ring(); }, 90); punch = 1.4; flashTrail(); }
    if(n === 'pullPerfect'){ sfx('perfect'); punch = 1; flashTrail(); }
    if(n === 'pull'){ sfx('jump'); punch = Math.max(punch, 0.4); }
    if(n === 'rebound' || n === 'reboundPerfect'){ sfx(n === 'reboundPerfect' ? 'perfect' : 'kick'); punch = n === 'reboundPerfect' ? 1 : 0.5; B.last.reboundT = 0.45; if(n === 'reboundPerfect') flashTrail(); }
    if(n === 'dash') sfx('dash');
    if((n === 'jump' || n === 'jumpPerfect') && e.leap) sfx('whoosh', 0.4 + 0.3*(e.charge || 0));
    if(n === 'land' || n === 'roll' || n === 'swoopCrash') sfx('land', clamp((e.impact||0)/40, 0.2, 1));
    if(n === 'landPerfect'){ sfx('perfect'); }
    if(WORDS[n]) say(WORDS[n]);
    if(hooks.event) hooks.event(e, B);
  }

  /* ------------------------------------------------------------- sounds */
  let AC = null, windNode = null;
  function ac(){ if(AC) return AC; AC = hooks.audio ? hooks.audio() : null; return AC; }
  function noise(a, secs){ const b = a.createBuffer(1, a.sampleRate*secs, a.sampleRate), d = b.getChannelData(0); for(let i=0;i<d.length;i++) d[i] = Math.random()*2 - 1; return b; }
  function sfx(kind, vol){
    const a = ac(); if(!a) return;
    try{
      if(a.state === 'suspended') a.resume();
      const t = a.currentTime, g = a.createGain(); g.connect(a.destination);
      const sweep = (f0, f1, dur, v, q) => { const s = a.createBufferSource(); s.buffer = noise(a, dur); const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q||1.2;
        f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); const gg = a.createGain(); gg.gain.setValueAtTime(v, t); gg.gain.exponentialRampToValueAtTime(0.001, t + dur);
        s.connect(f); f.connect(gg); gg.connect(a.destination); s.start(t); };
      const tone = (f0, f1, dur, v, type) => { const o = a.createOscillator(); o.type = type||'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const gg = a.createGain(); gg.gain.setValueAtTime(v, t); gg.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(gg); gg.connect(a.destination); o.start(t); o.stop(t + dur + 0.05); };
      if(kind === 'jump'){ sweep(300, 2400, 0.35, 0.22); tone(90, 50, 0.25, 0.25); }
      if(kind === 'kick'){ tone(140, 60, 0.18, 0.3); sweep(500, 2000, 0.25, 0.16); }
      if(kind === 'dash'){ sweep(1800, 600, 0.22, 0.18, 2); }
      if(kind === 'land'){ tone(110, 45, 0.2, 0.3*(vol||0.5)); sweep(800, 200, 0.15, 0.12*(vol||0.5)); }
      if(kind === 'perfect'){ tone(880, 1320, 0.28, 0.08, 'triangle'); tone(1320, 1760, 0.4, 0.05, 'sine'); sweep(400, 3000, 0.4, 0.2); }
      if(kind === 'gold'){ tone(1560, 1560, 0.06, 0.035, 'sine'); }
      if(kind === 'whoosh'){ sweep(400, 1800, 0.45, 0.22*(vol||1), 0.7); }
      if(kind === 'boom'){ tone(70, 28, 0.9, 0.55); tone(140, 40, 0.5, 0.3, 'sawtooth'); sweep(200, 4000, 0.7, 0.35, 0.8); sweep(3000, 300, 1.2, 0.18); }
    }catch(e){}
  }
  function wind(v){
    const a = ac(); if(!a) return;
    try{
      if(!windNode && v > 0){ const s = a.createBufferSource(); s.buffer = noise(a, 3); s.loop = true; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
        const g = a.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(a.destination); s.start(); windNode = { s, f, g }; }
      if(windNode){ windNode.g.gain.setTargetAtTime(v*0.16, a.currentTime, 0.15); windNode.f.frequency.setTargetAtTime(500 + v*1400, a.currentTime, 0.2);
        if(v <= 0 && !on){ try{ windNode.s.stop(a.currentTime + 0.5); }catch(e){} windNode = null; } }
    }catch(e){}
  }

  /* ----------------------------------------------------------- the light
     The boots glow (brighter with flow, gold in the perfect window), a
     trail streams from them at speed, and a ring of dust on every launch. */
  function fxGroup(){
    if(fx.group && fx.group.parent) return fx.group;
    fx.group = new THREE.Group(); fx.group.name = 'boots-fx'; G.scene.add(fx.group);
    const N = 48, pos = new Float32Array(N*3), col = new Float32Array(N*3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    fx.trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors:true, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false }));
    fx.trail.frustumCulled = false; fx.trail.userData.flat = true; fx.group.add(fx.trail);
    fx.trailPts = [];
    return fx.group;
  }
  function bootGlow(){
    const bd = window.AVATAR && AVATAR.body; if(!bd) return;
    const model = bd.children[0]; if(!model) return;
    if(fx.glow.length && fx.glow[0].parent) return;
    fx.glow = [];
    ['Left', 'Right'].forEach(side=>{
      let foot = null; model.traverse(o=>{ if(!foot && new RegExp(side + 'Foot$').test(o.name||'')) foot = o; });
      if(!foot) return;
      const s = new THREE.Vector3(); foot.getWorldScale(s); const k = 1/(s.x||1);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color:new THREE.Color(0.4, 1.8, 2.2), transparent:true, opacity:0.85, depthWrite:false, blending:THREE.AdditiveBlending }));
      m.scale.setScalar(k); m.position.set(0, 0.04*k, 0); m.userData.flat = true; foot.add(m); fx.glow.push(m);
    });
  }
  let goldWas = false, flashT = 0;
  function flashTrail(){ flashT = 0.6; }
  function tickFx(dt){
    fxGroup(); bootGlow();
    const sp = speed(B), gold = B.gold;
    if(gold && !goldWas) sfx('gold');
    goldWas = gold;
    flashT = Math.max(0, flashT - dt);
    const glowCol = gold || flashT > 0 ? [2.6, 1.9, 0.5] : [0.4 + B.flow*1.2, 1.6 + B.flow*0.6, 2.2];
    fx.glow.forEach(m=>{ m.material.color.setRGB(glowCol[0], glowCol[1], glowCol[2]); m.scale.setScalar((m.userData.k0 || (m.userData.k0 = m.scale.x))*(1 + B.flow*0.8 + (gold ? 0.8 : 0))); });
    // the trail: where her feet were, fading
    const pts = fx.trailPts;
    pts.unshift([B.x, B.y + 0.15, B.z]); if(pts.length > 48) pts.pop();
    const P = fx.trail.geometry.attributes.position, C = fx.trail.geometry.attributes.color;
    const show = sp > 13 || flashT > 0;
    for(let i=0;i<48;i++){
      const p = pts[Math.min(i, pts.length - 1)], f = show ? Math.pow(1 - i/48, 1.5)*clamp((sp - 10)/30, 0.25, 1) : 0;
      P.setXYZ(i, p[0], p[1], p[2]);
      C.setXYZ(i, glowCol[0]*f*0.6, glowCol[1]*f*0.6, glowCol[2]*f*0.6);
    }
    P.needsUpdate = true; C.needsUpdate = true;
    wind(B.ground ? 0 : clamp((sp - 10)/45, 0, 1));
    targetRing(dt);
    if(dbg) drawDebug();
  }
  /* THE ROOF SHE IS GOING TO: a ring on it — faint while she stands (that is where SPACE goes),
     bright on the way, gold when a press would be perfect */
  let ringT = 0;
  function targetRing(dt){
    const g = fxGroup();
    if(!fx.target){
      const m = new THREE.Group();
      const ringM = new THREE.MeshBasicMaterial({ color:new THREE.Color(0.5, 1.9, 1.7), transparent:true, opacity:0.8, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending });
      const r1 = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 40), ringM); r1.rotation.x = -Math.PI/2; m.add(r1);
      const r2 = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 20), ringM); r2.rotation.x = -Math.PI/2; m.add(r2);
      m.traverse(o=>{ o.userData.flat = true; }); m.userData.mat = ringM; g.add(m); fx.target = m;
    }
    const t = B.bound || B.preview, m = fx.target;
    m.visible = !!t && shown;
    if(!m.visible) return;
    ringT += dt;
    m.position.set(t.x, t.y + 0.06, t.z);
    const gold = !!B.gold, mat = m.userData.mat;
    if(gold) mat.color.setRGB(2.6, 1.9, 0.5); else mat.color.setRGB(0.5, 1.9, 1.7);
    mat.opacity = B.bound ? 0.9 : 0.35 + Math.sin(ringT*4)*0.1;
    m.scale.setScalar(B.bound ? 1 + Math.max(0, boundLeft(B) - 0.2)*0.8 : 1);
  }
  function ring(){
    const g = fxGroup();
    const m = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.7, 28), new THREE.MeshBasicMaterial({ color:new THREE.Color(0.6, 1.6, 1.9), transparent:true, opacity:0.7, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI/2; m.position.set(B.x, B.y + 0.05, B.z); m.userData.flat = true; g.add(m);
    const t0 = performance.now();
    (function grow(){ const k = (performance.now() - t0)/450; if(k >= 1 || !m.parent){ g.remove(m); m.geometry.dispose(); m.material.dispose(); return; }
      m.scale.setScalar(1 + k*5); m.material.opacity = 0.7*(1 - k); requestAnimationFrame(grow); })();
  }
  function clearFx(){
    if(fx.group && fx.group.parent) fx.group.parent.remove(fx.group);
    fx.group = null; fx.trail = null; fx.line = null; fx.arrow = null; fx.nArrow = null; fx.target = null;
    fx.glow.forEach(m=>{ if(m.parent) m.parent.remove(m); }); fx.glow = [];
  }

  /* ------------------------------------------------------------- the HUD
     Two pips for the dashes, a thin arc of flow, and the word for a
     perfect move when it happens. That is all. */
  let hudEl = null, msgT = 0;
  function hud(show){
    if(!hudEl){
      hudEl = document.createElement('div'); hudEl.id = 'bootsHud';
      hudEl.innerHTML = '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" class="bk"/><circle cx="32" cy="32" r="26" class="fl"/></svg><div class="pips"></div><div class="msg"></div>';
      document.body.appendChild(hudEl);
      const st = document.createElement('style');
      st.textContent = '#bootsHud{position:fixed;left:50%;bottom:118px;transform:translateX(-50%);width:64px;height:64px;pointer-events:none;z-index:40;opacity:.9}'
        + '#bootsHud.hidden{display:none}#bootsHud svg{width:64px;height:64px;transform:rotate(-90deg)}'
        + '#bootsHud .bk{fill:none;stroke:rgba(255,255,255,.12);stroke-width:4}#bootsHud .fl{fill:none;stroke:#7ff0e0;stroke-width:4;stroke-linecap:round;stroke-dasharray:163.4;stroke-dashoffset:163.4;transition:stroke .2s}'
        + '#bootsHud.gold .fl{stroke:#ffd23d}#bootsHud .pips{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:5px}'
        + '#bootsHud .pips i{width:8px;height:8px;border-radius:50%;background:#7ff0e0;box-shadow:0 0 8px #7ff0e0}#bootsHud .pips i.off{background:rgba(255,255,255,.18);box-shadow:none}'
        + '#bootsHud .msg{position:absolute;left:50%;top:-30px;transform:translateX(-50%);white-space:nowrap;font:800 15px/1 var(--ui-font,monospace);letter-spacing:.14em;color:#ffd23d;text-shadow:0 0 12px rgba(255,210,61,.7);opacity:0;transition:opacity .2s}'
        + '#bootsHud .msg.on{opacity:1}'
        + '#bootsDbg{position:fixed;right:12px;top:110px;width:300px;max-height:70vh;overflow:auto;background:rgba(5,10,12,.88);color:#cfe;font:11px/1.35 monospace;padding:10px;border:1px solid #2a5;border-radius:6px;z-index:60;pointer-events:auto}'
        + '#bootsDbg b{color:#7ff0e0}#bootsDbg .row{display:flex;justify-content:space-between;gap:6px}#bootsDbg input{width:64px;background:#011;color:#ffd;border:1px solid #244;font:11px monospace}'
        + '#bootsDbg button{margin:6px 6px 0 0;background:#123;color:#cfe;border:1px solid #2a5;font:11px monospace;cursor:pointer}';
      document.head.appendChild(st);
    }
    hudEl.classList.toggle('hidden', !show);
    if(!show && dbgEl) dbgEl.classList.add('hidden');
  }
  function show(v){ shown = !!v; if(hudEl) hudEl.classList.toggle('hidden', !v); }
  function say(text){ if(!hudEl) return; const m = hudEl.querySelector('.msg'); m.textContent = text; m.classList.add('on'); msgT = 1.1; }
  function hudTick(){
    if(!hudEl) return;
    hudEl.querySelector('.fl').style.strokeDashoffset = (163.4*(1 - B.flow)).toFixed(1);
    hudEl.classList.toggle('gold', !!B.gold);
    const pips = hudEl.querySelector('.pips'), want = TUNE.dashCharges, h = Array.from({ length:want }, (_, i)=>`<i class="${i < B.charges ? '' : 'off'}"></i>`).join('');
    if(pips.innerHTML !== h) pips.innerHTML = h;
    if(msgT > 0){ msgT -= 1/60; if(msgT <= 0) hudEl.querySelector('.msg').classList.remove('on'); }
  }
  // the words for the good ones
  const WORDS = { pullPerfect:'PERFECT PULL', reboundPerfect:'PERFECT KICK', landPerfect:'CLEAN LANDING', boundPerfect:'PERFECT', };

  /* ------------------------------------------------------------ the debug */
  let dbgEl = null;
  function debug(v){
    dbg = v === undefined ? !dbg : !!v;
    if(!dbgEl){
      dbgEl = document.createElement('div'); dbgEl.id = 'bootsDbg'; document.body.appendChild(dbgEl);
      dbgEl.addEventListener('input', e=>{ const k = e.target.dataset.k; if(k){ const v = parseFloat(e.target.value); if(!isNaN(v)) TUNE[k] = v; } });
      dbgEl.addEventListener('click', e=>{ const a = e.target.dataset.a;
        if(a === 'copy'){ const s = JSON.stringify(TUNE, null, 1); try{ navigator.clipboard.writeText(s); }catch(_){} console.log('BOOTS.TUNE =', s); }
        if(a === 'reset'){ Object.assign(TUNE, DEFAULTS); dbgEl.dataset.built = ''; }
        if(a === 'all'){ ALL.forEach(t=>learn(t)); } });
    }
    dbgEl.classList.toggle('hidden', !dbg);
    if(!dbg && fx.line){ fx.line.visible = false; if(fx.arrow) fx.arrow.visible = false; if(fx.nArrow) fx.nArrow.visible = false; }
  }
  function drawDebug(){
    if(!dbgEl.dataset.built){
      dbgEl.dataset.built = '1';
      dbgEl.innerHTML = '<div class="live"></div><hr><b>TUNE</b>' + Object.keys(TUNE).map(k=>`<div class="row"><span>${k}</span><input data-k="${k}" value="${TUNE[k]}"></div>`).join('')
        + '<button data-a="copy">copy values</button><button data-a="reset">defaults</button><button data-a="all">learn all</button>';
    }
    const pq = !B.ground && B.vy < 0 ? pullQuality(B, env) : null;
    const g = TUNE.gravity*(B.state === 'dive' ? TUNE.diveGravity : 1);
    dbgEl.querySelector('.live').innerHTML = [
      ['state', B.state + (B.swoop ? ' (swoop)' : '') + (B.roll > 0 ? ' (roll)' : '') + (B.sliding ? ' (slide)' : '') + (B.plant > 0 ? ' (plant)' : '')],
      ['bound', B.bound ? `→ ${B.bound.roof ? B.bound.roof.id : '?'} in ${boundLeft(B).toFixed(2)} s${B.bound.perfect ? ' · perfect' : ''} · hops ${B.hops}` : B.preview ? `next: ${B.preview.roof.id} ${B.preview.d.toFixed(1)} m` : '—'],
      ['speed', speed(B).toFixed(1) + ' m/s  · across ' + hspeed(B).toFixed(1)],
      ['velocity', `${B.vx.toFixed(1)}, ${B.vy.toFixed(1)}, ${B.vz.toFixed(1)}`],
      ['grounded', B.ground ? 'yes' + (B.y < 0.6 ? ' (street)' : ' (roof ' + B.y.toFixed(1) + ' m)') : 'no · up ' + (B.y - floorAt(env, B.x, B.z, B.y)).toFixed(1) + ' m'],
      ['wall', B.wall ? `planted ${B.wall.t.toFixed(2)}s · n ${B.wall.n.x},${B.wall.n.z}` : B.slideWall ? 'sliding' : '—'],
      ['dive', B.state === 'dive' ? B.diveT.toFixed(2) + ' s' : '—'],
      ['pull now', pq ? `${pq.kind} · q ${pq.q.toFixed(2)} · spare ${pq.spare.toFixed(2)} s` : '—'],
      ['to ground', !B.ground && B.vy < 0 ? timeToGround(env, B, g).toFixed(2) + ' s' : '—'],
      ['last pull', B.last.pull ? `${B.last.pull.kind} · up ${B.last.pull.up.toFixed(1)}` : '—'],
      ['last kick', B.last.rebound ? `${B.last.rebound.perfect ? 'perfect' : 'ok'} · up ${B.last.rebound.vy.toFixed(1)}` : '—'],
      ['dashes', B.charges + (B.dashCD > 0 ? ' (cool ' + B.dashCD.toFixed(2) + ')' : '')],
      ['flow', B.flow.toFixed(2) + ' · chain ' + B.chain],
      ['jump force', (TUNE.jumpUp*flowK(B, 'flowPower')).toFixed(1) + ' m/s' + (B.last.jump ? ' (last ' + B.last.jump.toFixed(1) + ')' : '')],
      ['knows', [...B.have].join(' ')]
    ].map(([k, v])=>`<div class="row"><b>${k}</b><span>${v}</span></div>`).join('');
    const grp = fxGroup();
    if(!fx.line){
      fx.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length:60 }, ()=>new THREE.Vector3())), new THREE.LineBasicMaterial({ color:0xffd23d, depthTest:false, transparent:true, opacity:0.9 }));
      fx.line.frustumCulled = false; fx.line.userData.flat = true; fx.line.renderOrder = 999; grp.add(fx.line);
      fx.arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, 0x38ffd0); grp.add(fx.arrow);
      fx.nArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 2, 0xff4a4a); grp.add(fx.nArrow);
    }
    const pts = B.ground ? [] : predict(env, B, 3, 60), P = fx.line.geometry.attributes.position;
    for(let i=0;i<60;i++){ const p = pts[Math.min(i, pts.length - 1)] || [B.x, B.y, B.z]; P.setXYZ(i, p[0], p[1] + 0.9, p[2]); }
    P.needsUpdate = true; fx.line.visible = !B.ground;
    const v = new THREE.Vector3(B.vx, B.vy, B.vz), len = v.length();
    fx.arrow.visible = len > 0.5; if(len > 0.5){ fx.arrow.position.set(B.x, B.y + 1, B.z); fx.arrow.setDirection(v.normalize()); fx.arrow.setLength(Math.min(12, len*0.25), 0.5, 0.3); }
    const w = B.wall || B.slideWall; fx.nArrow.visible = !!w;
    if(w){ fx.nArrow.position.set(B.x, B.y + 1, B.z); fx.nArrow.setDirection(new THREE.Vector3(w.n.x, 0, w.n.z)); }
  }
  addEventListener('keydown', e=>{ if(on && e.code === 'Backquote'){ debug(); e.preventDefault(); } });

  return { TUNE, DEFAULTS, TECH, ALL, body, step, predict, pullQuality, timeToGround, wallAhead, findTarget, ignite, landIn,
           attach, detach, sync, stop, teach, learn, fire, debug, say, show, WORDS, LEGACY,
           get active(){ return on; }, get B(){ return B; }, get env(){ return env; } };
})();
