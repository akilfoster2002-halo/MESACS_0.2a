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
  let gate=null, gateHit=null, gateDir=null;
  let beams=[], board=null, boardTex=null, gateAngle=Math.PI;
  let score={a:0,n:0,round:1};
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
      /* WHAT EACH SEAT NEEDS TO MOVE. The wave and the cheer both push a
         spectator along their own UP — which on a ball is a different
         direction for every seat in the bowl — so the direction is worked
         out once, here, and never again.

         `ph` is how far round they are sitting, and it is what makes the
         wave a wave: the crest is a function of angle, so it travels. */
      crowdSeed.push({ x:v[0], y:v[1], z:v[2],
                       ux:up.x, uy:up.y, uz:up.z,
                       ph:p.ph, k:p.k });
    });
    im.instanceMatrix.needsUpdate=true;
    if(im.instanceColor) im.instanceColor.needsUpdate=true;
    im.frustumCulled=false;
    im.userData.per=per;
    return im;
  }

  /* A point on the ball as a Vector3, for anything that wants to look at
     one rather than build geometry out of it. */
  function onBallV(d, h, ph){ const v=onBall(d,h,ph); return new THREE.Vector3(v[0],v[1],v[2]); }

  /* ------------------------------------------------------- THE LIGHTS
     FOUR BEAMS OVER THE SAND, sweeping, and they are the only thing in
     this bowl that changes what anything looks like.

     THE BEAM IS GEOMETRY AND THE LIGHT IS A LIGHT. A spotlight on its own
     is invisible until it lands on something, and everything in here
     except the two machines carries its own brightness — the stands and
     the crowd are unlit on purpose, because RYU's sun is one direction
     for a structure two hundred and sixty units across. So the cone you
     can see is a transparent mesh, and a real light rides inside it to
     put a moving highlight on the fighters, which is the one surface in
     the arena that answers to one. */
  function lights(){
    beams=[];
    const D=FLOOR + TIERS*TREAD*0.55;        // out over the front rows
    const HIGH=WALL + TIERS*RISER + 26;      // above the back row
    for(let i=0;i<4;i++){
      const a0=i*Math.PI/2 + 0.4;
      const from=onBallV(D, HIGH, a0);
      /* A CONE WITH NO BOTTOM AND NO INSIDE. openEnded keeps the flat cap
         off the far end, which otherwise reads as a disc of fog hanging
         over the sand; BackSide would make the beam only visible from
         inside it. Double, so it is a shaft from wherever you are. */
      const len=HIGH+40;
      const geo=new THREE.ConeGeometry(24, len, 20, 1, true);
      geo.translate(0, -len/2, 0);           // hang from the tip
      const beam=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        /* ADDITIVE, AND NOT MERELY TRANSPARENT. A shaft of light does not
           hide what is behind it, it adds to it — and blended the normal
           way at an opacity low enough not to fog the arena, a beam over
           a bright crowd was invisible. Additive at 0.22 reads as light
           against the dark sky and disappears against the stands, which
           is what a real one does. */
        color:0xbfe9ff, transparent:true, opacity:0.22,
        blending:THREE.AdditiveBlending,
        side:THREE.DoubleSide, depthWrite:false }));
      beam.position.copy(from);
      beam.userData={ a0, sp:0.35+i*0.11, off:i*1.7, reach:FLOOR*0.5 };
      /* AND A REAL ONE INSIDE IT. Its range stops inside the sand, so it
         is not quietly lighting the far stands as well. */
      const lamp=new THREE.SpotLight(0xdff2ff, 260, HIGH+70, 0.34, 0.5, 1.4);
      lamp.position.copy(from);
      lamp.target.position.copy(onBallV(FLOOR*0.5, 2, a0));
      root.add(lamp); root.add(lamp.target);
      beam.userData.lamp=lamp;
      root.add(beam); beams.push(beam);
    }
  }

  /* ---------------------------------------------------- THE SCOREBOARD
     WHO IS WINNING, WHICH NOBODY COULD TELL. The fight is a loop of
     sixteen rows and both machines get floored once, so without somewhere
     to put the count it reads as two robots taking turns — which is what
     it is, and a scoreboard is what makes taking turns into a score.

     DRAWN ON A CANVAS rather than built out of boxes. The names are six
     and nine letters and the numbers change; a mesh per glyph is a
     hundred meshes to say "AMBUSH 2". */
  function boardPaint(){
    if(!boardTex) return;
    const c=boardTex.image, g=c.getContext('2d');
    g.fillStyle='#0b1018'; g.fillRect(0,0,c.width,c.height);
    g.fillStyle='#1b2740'; g.fillRect(0,0,c.width,10);
    g.fillRect(0,c.height-10,c.width,10);
    g.textAlign='center'; g.textBaseline='middle';
    g.fillStyle='#7f9bc4'; g.font='bold 34px ui-monospace,Menlo,monospace';
    g.fillText('ROUND '+score.round, c.width/2, 42);
    g.font='bold 62px ui-monospace,Menlo,monospace';
    g.fillStyle='#8fd6ff'; g.textAlign='left';  g.fillText('AMBUSH', 40, 130);
    g.fillStyle='#c9a6ff'; g.textAlign='right'; g.fillText('NOISY BOY', c.width-40, 130);
    g.font='bold 92px ui-monospace,Menlo,monospace';
    g.fillStyle='#ffd98a'; g.textAlign='center';
    g.fillText(score.a+'  –  '+score.n, c.width/2, 132);
    boardTex.needsUpdate=true;
  }
  function scoreboard(){
    const c=document.createElement('canvas'); c.width=1024; c.height=180;
    boardTex=new THREE.CanvasTexture(c);
    const D=FLOOR + TIERS*TREAD + 1.0;
    const H=WALL + TIERS*RISER + 16;
    /* OPPOSITE THE GATE, so the first thing in front of somebody who has
       just walked in and turned round is the score. */
    const a=(typeof gateAngle==='number' ? gateAngle : Math.PI) + Math.PI;
    const at=onBallV(D, H, a);
    board=new THREE.Mesh(new THREE.PlaneGeometry(86, 15),
      new THREE.MeshBasicMaterial({ map:boardTex, side:THREE.DoubleSide }));
    const up=new THREE.Vector3(at.x, at.y+PR, at.z).normalize();
    const fwd=new THREE.Vector3(-Math.cos(a),0,-Math.sin(a));
    fwd.sub(up.clone().multiplyScalar(fwd.dot(up))).normalize();
    const rt=new THREE.Vector3().crossVectors(up, fwd).normalize();
    board.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(rt, up, fwd));
    board.position.copy(at);
    root.add(board);
    boardPaint();
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
      /* SCALED AND NOT LIFTED, WHICH COST ME A BUG.

         There was a line here nudging the model up by -box.min.y, on the
         reasoning that a Mixamo export's origin is not its feet. The box
         says so: the rest vertices of these meshes are centred on the
         origin, half of them below it. The SKELETON is not — it stands on
         the origin, and the two are reconciled by the inverse bind
         matrices, so where the mesh is DRAWN is where the bones put it
         and not where its rest coordinates sit.

         So the lift was half the robot's height of pure error, and at
         ninety-five units that is forty-eight: both machines fought in
         mid-air with their shadows on the sand underneath them. The bind
         box measured them as grounded the whole time, because the box is
         in the space the lift had just corrected.

         AVATAR has scaled every character in this game for months without
         touching position, for exactly this reason. Scale only. */
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

    /* ------------------------------------------------------------ THE GATE
       THE WAY IN, AND IT IS THE ONLY ONE. A bowl a hundred and thirty
       units across with no door is scenery you fly over; a door makes it
       somewhere you arrive at, which is the difference between seeing the
       place and being let into it.

       IT FACES THE TOWER, because that is where everybody comes from.
       planet.js works out the bearing — it is the only file that knows
       where the tower is — and hands it in as an angle in this frame. */
    const gph = (o.gate===undefined) ? Math.PI : o.gate;
    gateAngle = gph;
    gate=new THREE.Group();
    {
      const D=FLOOR + TIERS*TREAD + 2.0;          // just inside the outer lip
      const post=new THREE.MeshBasicMaterial({ color:0x3b4a63 });
      const lamp=new THREE.MeshBasicMaterial({ color:0xffd98a });
      const wide=0.085;                            // radians of arc, each side
      [-wide, wide].forEach(dp=>{
        const v=onBall(D, 0, gph+dp);
        const col=new THREE.Mesh(new THREE.BoxGeometry(5, 26, 5), post);
        col.position.set(v[0], v[1], v[2]);
        /* upright means away from the core, the same as everything else
           standing on this ball */
        const up=new THREE.Vector3(v[0], v[1]+PR, v[2]).normalize();
        const fwd=new THREE.Vector3(-Math.cos(gph),0,-Math.sin(gph));
        fwd.sub(up.clone().multiplyScalar(fwd.dot(up))).normalize();
        const rt=new THREE.Vector3().crossVectors(up, fwd).normalize();
        col.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(rt, up, fwd));
        col.position.copy(new THREE.Vector3(v[0], v[1], v[2])
          .add(up.clone().multiplyScalar(13)));
        gate.add(col);
        const l=new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 3.4), lamp);
        l.position.copy(col.position).add(up.clone().multiplyScalar(15));
        gate.add(l);
      });
      /* AND THE THING YOU PRESS, which is the space between them rather
         than either post: a gate is a gap, and a student walking at a gap
         should not have to find the left-hand pillar. */
      const v=onBall(D, 0, gph);
      const up=new THREE.Vector3(v[0], v[1]+PR, v[2]).normalize();
      const door=new THREE.Mesh(new THREE.BoxGeometry(16, 26, 3),
        new THREE.MeshBasicMaterial({ color:0x123040, transparent:true, opacity:0.42 }));
      door.position.copy(new THREE.Vector3(v[0], v[1], v[2])
        .add(up.clone().multiplyScalar(13)));
      const fwd=new THREE.Vector3(-Math.cos(gph),0,-Math.sin(gph));
      fwd.sub(up.clone().multiplyScalar(fwd.dot(up))).normalize();
      const rt=new THREE.Vector3().crossVectors(up, fwd).normalize();
      door.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(rt, up, fwd));
      gate.add(door);
      gateHit=door;
      gateDir=onBall(D + 16, 0, gph);            // where somebody stands to use it
    }
    root.add(gate);
    lights();
    scoreboard();

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
    const wrapped = at===ROUND.length-1;
    at=(at+1)%ROUND.length;
    const r=ROUND[at];
    left=r.t;
    play(side.a, r.a); play(side.n, r.n);
    if(r.boom && side[r.boom]){
      side[r.boom].hurt=1;
      /* THE POINT GOES TO THE ONE WHO LANDED IT, which is the other one:
         `boom` names who was hit. */
      score[r.boom==='a' ? 'n' : 'a']++;
      cheer=1;                      // and the bowl comes to its feet
      if(board) boardPaint();
    }
    /* A NEW ROUND WHEN THE LOOP COMES ROUND, because a score that only
       ever climbs stops being a score by the third minute. */
    if(wrapped){ score={ a:0, n:0, round:score.round+1 }; if(board) boardPaint(); }
  }

  let sway=0, cheer=0;
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
    /* ------------------------------------------------- AND THE CROWD MOVES
       IT USED TO BE THE WHOLE MESH SLIDING NINE CENTIMETRES, which from
       the stands is a thousand people welded to one plank. They stand up
       one at a time now: a wave whose crest is a function of how far
       round the bowl a seat is, so it travels — and a cheer on every
       landed hit, which is everybody at once.

       WRITTEN STRAIGHT INTO THE INSTANCE MATRIX. A thousand spectators
       recomposed from position, quaternion and scale every frame is a
       thousand matrix multiplies for a number that only ever moves along
       one axis. Their rotation was settled when the bowl was built and
       has not changed since, so the only thing that needs touching is the
       translation — elements 12, 13 and 14 of each sixteen. */
    sway+=dt;
    cheer=Math.max(0, cheer - dt*1.6);
    if(crowd && crowdSeed.length){
      const arr=crowd.instanceMatrix.array;
      /* A FAN IS 5.6 UNITS TALL. Three was a stand-up; six and a half was
         everybody in the bowl leaping three times their own height, which
         is not a crowd, it is a trampoline. */
      const lift=3.0;
      for(let i=0;i<crowdSeed.length;i++){
        const c=crowdSeed[i];
        /* THE WAVE. Only the crest is up: a sine would have two thirds of
           the bowl permanently half-standing, which is a crowd doing
           gymnastics rather than a Mexican wave. */
        const w=Math.sin(sway*1.15 - c.ph*3.0);
        let h = w>0.55 ? (w-0.55)/0.45*lift : 0;
        /* AND THE CHEER, which is everybody, on a hit. The tier number
           staggers it so the bowl does not move as one slab. */
        if(cheer>0) h += cheer*lift*0.9*Math.abs(Math.sin(sway*9 + c.k*0.9));
        const o=i*16;
        arr[o+12]=c.x + c.ux*h;
        arr[o+13]=c.y + c.uy*h;
        arr[o+14]=c.z + c.uz*h;
      }
      crowd.instanceMatrix.needsUpdate=true;
    }
    /* THE SPOTLIGHTS SWEEP, and the beams are what you actually see: the
       lights themselves fall on two machines and nothing else, because
       every other thing in this bowl carries its own brightness. */
    if(beams.length && root){
      for(let i=0;i<beams.length;i++){
        const b=beams[i];
        const a=b.userData.a0 + Math.sin(sway*b.userData.sp + b.userData.off)*0.42;
        const aimLocal=onBallV(b.userData.reach, 2, a);
        /* lookAt() IS IN WORLD SPACE. Every other coordinate in this file
           is in the arena's own frame, and handing one of those to it
           pointed four spotlights at a spot two hundred and forty units
           underground — so what stood over the stands was four narrow
           spikes aimed at the sky. */
        b.lookAt(root.localToWorld(aimLocal.clone()));
        /* and the cone hangs along its own -Y, so a quarter turn puts
           that where lookAt has just put +Z */
        b.rotateX(-Math.PI/2);
        const lamp=b.userData.lamp;
        if(lamp){ lamp.target.position.copy(aimLocal); lamp.target.updateMatrixWorld(); }
      }
    }
    if(board) boardPaint();
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
    root=null; crowd=null; crowdSeed=[]; gate=null; gateHit=null; gateDir=null;
    beams=[]; board=null; boardTex=null; score={a:0,n:0,round:1}; cheer=0;
    side.a=null; side.n=null;
    built=false; shown=false; at=0; left=0;
  }

  return { build, tick, show, hide, clear,
           get ready(){ return built; },
           get visible(){ return shown; },
           get groups(){ return side; },
           get root(){ return root; },
           /* The way in: the slab you press, and the spot outside it that
              a walkthrough can ring and a player can stand on. */
           get gate(){ return gateHit; },
           get gateLocal(){ return gateDir; },
           get seats(){ return crowd ? crowd.count : 0; },
           /* how big the place is, for whoever has to stand it somewhere
              that is not already occupied by a building */
           get radius(){ return FLOOR + TIERS*TREAD + 3.5; },
           get rim(){ return WALL + TIERS*RISER; },
           get round(){ return ROUND; },
           get score(){ return score; },
           get beams(){ return beams.length; },
           get seconds(){ return ROUND.reduce((s,r)=>s+r.t, 0); } };
})();
