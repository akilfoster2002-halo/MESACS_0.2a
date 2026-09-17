/* =====================================================================
   THE ARENA — a colosseum nobody on RYU can see, with a crowd in it, and
   two machines the size of the tower fighting on the sand.

   WHAT THE GLASSES ARE ACTUALLY FOR. The Mechanic lends them to you to
   read an engine's frequency signature, which is true and is the smaller
   half of it. The other half is that there is a whole populated place on
   this planet at that frequency — a bowl of stone with nine tiers of
   people in it who came to watch robots fight — and nobody in the tower
   has ever turned round wearing them at the right hour. You find it.

   IT IS A PLACE AND NOT A BACKDROP, which is the entire reason it is out
   past the tower rather than on the next hill. You see something over the
   horizon, you fly to it, and it turns out to be full. A spectacle you
   can see everything of from where you were already standing is scenery;
   one you have to go to is somewhere you went.

   WHY NONE OF IT IS SOLID. Every wall in this game is a box in G.solids,
   and a box you cannot see is a box you walk into and swear at. The stands
   are open to fly through and the sand is the planet's own ground, so
   there is nothing here that can trap somebody who took the glasses off
   at the wrong moment — which they will, because G is a toggle and the
   first thing anybody does with a toggle is press it.

   WHAT THIS FILE OWNS: the bowl, the crowd, the two bodies and the
   choreography. WHAT IT DOES NOT: where on the sphere any of it sits.
   planet.js stands the root group up; everything below is in that group's
   own frame, with the ball's curvature done by hand because the bowl is
   a hundred and forty units across and flat ground is a lie at that size.
   ===================================================================== */
window.BRAWL = (function(){
  const MODELS = { a:'characters/models/ambush.glb',
                   n:'characters/models/noisyboy.glb' };

  /* ---------------------------------------------------------- THE BOWL
     All in units of ARC LENGTH out from the middle of the sand, because
     that is the only measure that means anything on a ball.

     THE FIRST BOWL CAME OUT FLAT, AND THE PLANET IS WHY. Nine tiers of
     five units climbed forty-five, and the ground under a rim a hundred
     and forty units out falls forty-one — so the stands rose four units
     net and what stood round the sand was a ring of confetti lying on the
     desert. The curve does not reduce a building's height, it CANCELS
     it, and on a ball this small it cancels nearly all of it.

     So the only number that matters is the rim height MINUS
     PR(1-cos(Ro/PR)), and it has to come out at something a person would
     call a wall. A hundred and twelve less thirty-four is seventy-eight,
     which from the middle of the sand is most of the height of the
     machines fighting on it.

     THE SAND IS ONLY JUST BIGGER THAN THE FIGHT, and that is the second
     thing the curve decides. A floor of a hundred and five units put the
     front row eighty from the nearest machine and a hundred and
     twenty-five from the far one, and at that range the planet's own
     bulge hides everything below their waists: from a seat you watched
     two chests. Sixty puts the front row eighty units from a fighter
     with thirteen of him behind the curve — his shins — which is a man
     standing behind a low wall rather than a man cut in half.

     It is still enormous. Two hundred and sixty units across is a sixth
     of RYU's circumference, the stands go up a hundred and twelve, and
     it is holding two ninety-five metre robots. It lives out past
     everything anybody built — see BRAWL_AT in planet.js. */
  const FLOOR = 60;     // the sand: radius, and the two of them fight in it
  const WALL  = 10;     // the podium between the sand and the first tier
  const TIERS = 12;
  const TREAD = 5.5;    // how deep one tier is
  const RISER = 8.5;    // and how much it climbs
  const SEG   = 108;    // segments round — 130 units of radius needs them

  /* ONE EXCHANGE PER ROW. `a` is Ambush, `n` is Noisy Boy, `t` is how long
     to hold before the next row — usually the attacking clip's own length,
     shorter wherever the interesting part of it is over before the clip is.

     BOTH SIDES ARE WRITTEN OUT, including the one standing still. A fight
     choreographed as "attacker plays X, defender reacts" needs a rule for
     what a reaction is, and every such rule gets the timing wrong
     somewhere — Noisy Boy blocking a punch that was never thrown, or
     eating one twice because two rows running were attacks. Two names and
     a duration cannot be wrong about anything: what you read is what is
     on the sand.

     IT IS A ROUND, NOT A STORY. Nobody wins, because it loops, and a loop
     with a knockout in it is a machine that dies every thirty seconds.
     Both of them get floored once and both get up. */
  const ROUND = [
    { a:'idle',       n:'idle',       t:2.0 },   // squaring up
    { a:'jab',        n:'block',      t:0.9 },
    { a:'jab',        n:'block',      t:0.9 },
    { a:'cross',      n:'dodge',      t:2.0 },   // slipped
    { a:'hit',        n:'hook',       t:2.2, boom:'a' },   // countered
    { a:'hit',        n:'cross',      t:2.0, boom:'a' },
    { a:'block',      n:'roundhouse', t:2.1 },   // guard up in time
    { a:'hook',       n:'dodge',      t:2.2 },
    { a:'roundhouse', n:'block',      t:2.1 },
    { a:'flykick',    n:'hit',        t:1.5, boom:'n' },   // lands
    { a:'idle',       n:'getup',      t:2.2 },
    { a:'dodge',      n:'jab',        t:0.9 },
    { a:'dodge',      n:'jab',        t:0.9 },
    { a:'floored',    n:'sweep',      t:2.5, boom:'a' },   // legs taken
    { a:'getup',      n:'roar',       t:2.9 },   // one up, one gloating
    { a:'idle',       n:'idle',       t:1.6 }
  ];

  /* A hit is worth a shudder: the struck machine is knocked back and comes
     home over about a third of a second, which at this scale reads as
     something very heavy being moved slightly. */
  const KNOCK = 0.055;     // as a fraction of its own height
  const SETTLE = 3.4;

  let built=false, shown=false, root=null, PR=240;
  let at=0, left=0, crowd=null, crowdSeed=[];
  const side={ a:null, n:null };

  /* ------------------------------------------------- the ball, by hand
     A point at arc distance `d` from the middle of the sand, `h` above
     the ground, at angle `ph` round. The root sits at radius PR with its
     own +Y pointing straight out of the planet, so the core of the ball
     is at local (0, -PR, 0) and everything else follows from that.

     THIS IS NOT AN OPTIMISATION, IT IS THE DIFFERENCE BETWEEN A BOWL AND
     A DISC. Laid out flat, the outer rim of these stands would finish
     sixty-one units in the air — the ball drops away as PR(1-cos(d/PR))
     and at a hundred and seventy-five units that is not a rounding
     error, it is most of the height of the building.

     AND `h` IS ABOVE THE GROUND, NOT ABOVE THE SPHERE. Those are the same
     thing only on a planet with no hills, and RYU has seven and a half
     units of them: a floor drawn on the bare sphere had the desert coming
     up through the middle of the sand like a mole hill, because the
     terrain under it was higher than the arena was. planet.js hands in
     the height of its own ground at any point in this frame — it is the
     only file that knows the noise function — and the whole bowl is
     built on that instead. The sand undulates a little as a result,
     which a desert floor does. */
  let ground=()=>0;
  function onBall(d, h, ph){
    const th=d/PR, r=PR+ground(d,ph)+h;
    const s=Math.sin(th), c=Math.cos(th);
    return [ r*s*Math.cos(ph), r*c - PR, r*s*Math.sin(ph) ];
  }

  /* The profile of the bowl, as a list of [arc distance, height] going out
     from the middle. A staircase rather than a curve: two samples at every
     step, so the lathe puts a vertical face where a riser is instead of
     smoothing nine tiers into a soup bowl. */
  function profile(){
    const p=[[0,0],[FLOOR,0]];              // the sand, flat
    p.push([FLOOR, WALL]);                  // the podium wall, straight up
    let d=FLOOR, h=WALL;
    for(let k=0;k<TIERS;k++){
      d+=TREAD; p.push([d,h]);              // the tread
      h+=RISER;  p.push([d,h]);             // and the riser at the back of it
    }
    p.push([d+3.5, h]);                     // a lip along the top
    return p;
  }

  function bowl(){
    const P=profile();
    const pos=[], col=[], idx=[];
    const STONE=[0.46,0.50,0.53], SAND=[0.56,0.50,0.40], LIT=[0.24,0.86,0.80];
    for(let i=0;i<P.length;i++){
      const [d,h]=P[i];
      /* The sand is sand, the stands are stone, and every riser's top
         edge catches the light the place is lit by — which is what makes
         nine grey steps read as nine steps from two hundred units away
         rather than as one grey cone. */
      const onSand = d<=FLOOR && h<=0;
      const topEdge = i>2 && h>P[i-1][1];
      const base = onSand ? SAND : STONE;
      for(let j=0;j<=SEG;j++){
        const ph=j/SEG*Math.PI*2;
        const v=onBall(d,h,ph);
        pos.push(v[0],v[1],v[2]);
        /* THE SHADING IS BAKED, because nothing is lighting this. A
           little variation round the ring so the stone is not a flat
           fill, and a climb in brightness with the tier so the bowl
           reads as a bowl from the floor — the near rows nearest the
           sand are in its shadow and the back rows catch the sky. */
        const n=0.92+0.16*Math.abs(Math.sin(j*2.7+i*1.3));
        const up=0.55+0.45*Math.min(1, h/(WALL+TIERS*RISER));
        const c = topEdge ? LIT : base;
        col.push(c[0]*n*up, c[1]*n*up, c[2]*n*up);
      }
    }
    const W=SEG+1;
    for(let i=0;i<P.length-1;i++) for(let j=0;j<SEG;j++){
      const a=i*W+j, b=a+1, c=a+W, e=c+1;
      idx.push(a,c,b, b,c,e);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('color',    new THREE.Float32BufferAttribute(col,3));
    g.setIndex(idx);
    g.computeVertexNormals();
    /* SELF-LIT, AND NOT BECAUSE IT IS EASIER. RYU's sun is one direction
       for the whole planet, and a bowl this wide has most of itself
       pointing away from it — the far stands came out solid black and
       the arena read, from the sand, as an empty desert under a dark
       sky. A light of its own does not fix it either: three.js lights
       are global whatever you parent them to, so anything bright enough
       to reach the far rim also turns RYU's night side to noon.

       So the stands carry their own brightness in the vertex colours,
       which is also what they ought to look like. This is not a building
       anybody is looking AT — it is a building resolved out of a
       frequency by a pair of borrowed glasses, and a thing on an
       instrument glows rather than catching the light. The shading is
       baked in below instead of lit: higher tiers brighter, risers
       lighter than treads. */
    const m=new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors:true, side:THREE.DoubleSide }));
    m.frustumCulled=false;
    return m;
  }

  /* ------------------------------------------------------- THE CROWD
     Nine tiers of people, and there is no version of this where they are
     nine tiers of separate objects: one InstancedMesh is one draw call
     for the lot, and at the distance the nearest of them is ever seen
     from, a person is a coloured upright the height of a doorway.

     THEY ARE WHAT MAKES IT A PLACE. An empty bowl is a ruin — interesting
     for a moment and then over. A full one is a thing that was going on
     before you found it and will still be going on after you leave, which
     is the difference between discovering somewhere and finding a prop. */
  const SHIRTS=[0xc94f4f,0x4f7fc9,0xd6a23c,0x4fb07a,0xa45fc0,0xd97a3f,
                0x50b8c4,0xcf5a92,0xe0d07a,0x7a8ad6];
  function people(){
    const per=[], mats=new THREE.Matrix4(), q=new THREE.Quaternion();
    let d=FLOOR, h=WALL;
    for(let k=0;k<TIERS;k++){
      d+=TREAD;
      /* as many as the ring is long, so the back rows are not sparser
         than the front ones — 2.6 units of bench each */
      const ring=2*Math.PI*PR*Math.sin(d/PR);
      const n=Math.max(40, Math.round(ring/8.6));
      for(let i=0;i<n;i++){
        /* AND NOT EVENLY SPACED. A crowd on a perfect lattice reads as
           tiling; the jitter is what makes it read as people who chose
           where to sit. Deterministic, so the same seat is the same
           person's on every load. */
        const ph=(i+0.5)/n*Math.PI*2 + Math.sin(i*12.9898+k*78.233)*0.012;
        const back=Math.sin(i*4.1+k*2.7)*1.4;         // along the bench
        per.push({ d:d-1.4+back, h:h+0.1, ph, k, i });
      }
      h+=RISER;
    }
    /* A PERSON IS 2.4 UNITS AND THE NEAREST SEAT IS A HUNDRED AWAY, so
       the crowd is drawn at rather more than life size. That is not a
       cheat for the look of it: at true scale one spectator is under half
       a pixel from the sand and the whole bowl reads as empty, which is
       the one thing this place must never read as. */
    const geo=new THREE.BoxGeometry(2.6, 5.6, 2.0);
    geo.translate(0, 2.8, 0);                          // stand it on its feet
    /* Basic for the same reason the stands are — and a crowd is the half
       of this that must never go dark, because a bowl with nobody in it
       is a ruin. */
    const im=new THREE.InstancedMesh(
      geo, new THREE.MeshBasicMaterial({ vertexColors:false }), per.length);
    im.instanceColor=new THREE.InstancedBufferAttribute(
      new Float32Array(per.length*3), 3);
    const up=new THREE.Vector3(), fwd=new THREE.Vector3(), rt=new THREE.Vector3();
    const M=new THREE.Matrix4(), col=new THREE.Color();
    per.forEach((p,i)=>{
      const v=onBall(p.d, p.h, p.ph);
      /* UPRIGHT MEANS AWAY FROM THE CORE, not straight up the page. Two
         hundred units round a ball of this size is fifty degrees of tilt,
         and a crowd that all stood along the world's +Y would be lying
         down by the time the stands reached the far side. */
      up.set(v[0], v[1]+PR, v[2]).normalize();
      /* and every one of them turned to face the sand */
      fwd.set(-Math.cos(p.ph), 0, -Math.sin(p.ph));
      fwd.sub(up.clone().multiplyScalar(fwd.dot(up))).normalize();
      rt.crossVectors(up, fwd).normalize();
      M.makeBasis(rt, up, fwd);
      M.setPosition(v[0], v[1], v[2]);
      im.setMatrixAt(i, M);
      col.setHex(SHIRTS[(p.i*7+p.k*3)%SHIRTS.length]);
      /* dimmer down at the front, for the same reason the stone is */
      col.multiplyScalar(0.62+0.38*(p.k+1)/TIERS);
      im.setColorAt(i, col);
      crowdSeed.push({ ph:p.ph, k:p.k, base:v[1], phase:(p.i*0.7+p.k*1.9)%6.28 });
    });
    im.instanceMatrix.needsUpdate=true;
    if(im.instanceColor) im.instanceColor.needsUpdate=true;
    im.frustumCulled=false;
    im.userData.per=per;
    return im;
  }

  /* ------------------------------------------------------------- a body */
  function load(which, tall, pos, faceX, then){
    const s = side[which] = { group:new THREE.Group(), rig:null, hurt:0, tall:tall };
    s.group.position.set(pos[0], pos[1], pos[2]);
    /* INTO THE BOWL, and not merely positioned as though it were. This
       group was built, placed at (20,0,0) and never parented to anything,
       so both machines fought at the centre of the WORLD — which on a
       planet of radius 240 is 240 units underground, and the arena was a
       full stand watching an empty floor. */
    if(root) root.add(s.group);
    /* Facing along ±X at each other. A character model faces its own +Z,
       so a quarter turn puts that where it is wanted. */
    s.group.rotation.y = faceX>0 ? Math.PI/2 : -Math.PI/2;
    new THREE.GLTFLoader().load(MODELS[which] + '?v=' + (window.ASSETV||'1'), gl=>{
      const r=gl.scene;
      r.traverse(o=>{
        if(!o.isMesh) return;
        /* NEVER CULLED. A skinned mesh is culled against the bounding box
           it was exported in, and that box is not any pose it is ever in —
           a ninety-five metre body throwing a kick leaves it entirely and
           blinks out at the moment it is doing the most interesting thing
           it does. */
        o.frustumCulled=false;
        if(o.geometry.attributes.color){
          o.material.vertexColors=true; o.material.needsUpdate=true;
        }
      });
      r.updateMatrixWorld(true);
      const bx=new THREE.Box3().setFromObject(r);
      const h=bx.max.y-bx.min.y;
      const k=h>1e-6 ? tall/h : 1;
      r.scale.setScalar(k);
      /* SOLES ON THE SAND, BY THE SKIN. The origin of a Mixamo export is
         not its feet, and the gap is invisible at a metre and eleven
         units off the floor at ninety-five. */
      r.position.y = -bx.min.y*k;
      s.foot = r.position.y;
      s.group.add(r);
      s.root=r;
      s.mixer=new THREE.AnimationMixer(r);
      s.clips=gl.animations||[];
      s.cur=null; s.curName=null;
      if(then) then();
    }, undefined, ()=>{ if(then) then(); });
  }

  function play(s, name, fade){
    if(!s || !s.mixer || s.curName===name) return;
    const clip=s.clips.find(c=>c.name===name);
    if(!clip) return;
    const next=s.mixer.clipAction(clip);
    next.reset().setEffectiveWeight(1).fadeIn(fade===undefined?0.22:fade).play();
    if(s.cur) s.cur.fadeOut(fade===undefined?0.22:fade);
    s.cur=next; s.curName=name;
  }

  /* ---------------------------------------------------------------- API */
  function build(opts){
    if(built) return { root, side };
    const o=opts||{};
    PR = o.PR || 240;
    ground = o.ground || (()=>0);
    const tall=o.tall||95;
    const gap =o.gap||40;
    built=true; at=0; left=ROUND[0].t; crowdSeed=[];

    root=new THREE.Group();
    root.visible=false;
    root.add(bowl());
    crowd=people(); root.add(crowd);
    /* ONE LAMP OVER THE SAND, and it is for the FIGHTERS only. The bowl
       and the crowd light themselves (see above); these two are ordinary
       glTF models with ordinary materials, and on the night side of RYU
       they would otherwise be two silhouettes. Its range stops well
       inside the stands so it is not also doing their job badly. */
    const lamp=new THREE.PointLight(0x9fe6ff, 2.6, 150, 1.3);
    lamp.position.set(0, 70, 0); root.add(lamp);
    if(o.parent) o.parent.add(root);

    const started=()=>{ if(!shown) return;
                        const r=ROUND[at];
                        play(side.a, r.a, 0); play(side.n, r.n, 0); };
    /* Either side of the middle, standing on the sand like everything
       else here — through onBall, so each of them is on the ground under
       its own feet rather than on the ground under the middle of the
       arena. Twenty units of desert is a metre of height on this planet
       and a machine with one foot buried is worse than one hovering. */
    load('a', tall, onBall(gap/2, 0, 0),         -1, started);
    load('n', tall, onBall(gap/2, 0, Math.PI),   +1, started);
    return { root, side };
  }

  function step(){
    at=(at+1)%ROUND.length;
    const r=ROUND[at];
    left=r.t;
    play(side.a, r.a); play(side.n, r.n);
    if(r.boom && side[r.boom]) side[r.boom].hurt=1;
  }

  let sway=0;
  function tick(dt){
    if(!built || !shown) return;
    for(const k of ['a','n']){
      const s=side[k];
      if(!s) continue;
      if(s.mixer) s.mixer.update(dt);
      /* THE SHUDDER IS ON THE MODEL AND NOT ON THE GROUP. The group is
         where this machine stands on the sand; inside it, -Z is straight
         back from the opponent, because they were turned to face each
         other and nothing else has moved since. */
      if(s.hurt>0 && s.root){
        s.hurt=Math.max(0, s.hurt - dt*SETTLE);
        s.root.position.z = -KNOCK * s.tall * s.hurt;
      }
    }
    /* AND THE CROWD IS NOT A PHOTOGRAPH. Nothing as expensive as a person
       each: the whole instanced mesh breathes a few centimetres on a slow
       wave whose phase runs round the bowl, which at this distance is a
       stand full of people shifting in their seats. */
    sway+=dt;
    if(crowd) crowd.position.y = Math.sin(sway*1.7)*0.09;
    left-=dt;
    if(left<=0) step();
  }

  function show(){
    if(!built) return;
    shown=true;
    if(root) root.visible=true;
    /* STARTED WHERE IT WAS LEFT, not from the top. The fight is happening
       whether or not anybody has the glasses on; taking them off and
       putting them back on is looking away and looking back, and a round
       that restarted each time would make the arena a television set that
       rewinds when you blink. */
    const r=ROUND[at];
    play(side.a, r.a, 0); play(side.n, r.n, 0);
  }
  function hide(){ shown=false; if(root) root.visible=false; }
  function clear(){
    if(root && root.parent) root.parent.remove(root);
    root=null; crowd=null; crowdSeed=[];
    side.a=null; side.n=null;
    built=false; shown=false; at=0; left=0;
  }

  return { build, tick, show, hide, clear,
           get ready(){ return built; },
           get visible(){ return shown; },
           get groups(){ return side; },
           get root(){ return root; },
           get seats(){ return crowd ? crowd.count : 0; },
           /* how big the place is, for whoever has to stand it somewhere
              that is not already occupied by a building */
           get radius(){ return FLOOR + TIERS*TREAD + 3.5; },
           get rim(){ return WALL + TIERS*RISER; },
           get round(){ return ROUND; },
           get seconds(){ return ROUND.reduce((s,r)=>s+r.t, 0); } };
})();
