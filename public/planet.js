/* =====================================================================
   THE PLANET — a sphere you can walk all the way around.

   Not a dome and not a disc with a curved skirt: an actual ball. Set off
   in a straight line and you come back to where you started from the
   other side. Down always points at the core, so a building on the far
   side is upside down relative to you and perfectly upright to whoever
   is standing next to it.

   HOW IT WORKS, AND WHY IT DOES NOT BREAK THE REST OF THE GAME

   Every other room assumes flat ground: a height function of x and z,
   gravity down -Y, boxes for walls, and step() in game.js doing all of
   it. None of that survives a sphere. So the planet uses none of it —
   step() hands straight over to walk() below, and this module owns
   movement, gravity, collision, the camera and the body while you are
   here. Nothing outside this file changes shape, so every mission that
   already worked still works.

   You are a UNIT DIRECTION from the core, a height above the surface,
   and a FORWARD tangent to the ball. Walking rotates the direction and
   the forward together about the axis (up x move), which is exact
   great-circle travel: no seam to fall down, no pole to break at, and a
   straight line really does come back round. Turning rotates forward
   about up. Both are re-squared every frame so a long walk cannot drift
   out of true.

   Buildings work the same way: each owns a tangent frame, everything in
   it is placed in that frame, and collision runs there too.

   The mission grid still exists behind P, because nobody should ever be
   stuck on a planet because they could not find a door.
   ===================================================================== */
window.PLANET = (function(){
  /* Radius sets how hard the world curves. The horizon from the chase camera
     is roughly sqrt(2*PR*camHeight), so 92 put it 28 metres out and buildings
     rose out of the ground in front of you. At 200 it is past 40 and the
     curve reads as a planet rather than as a hill you are always on top of.
     The cost is the lap: 1257 metres, about three minutes on foot and half
     that in a car. */
  const V   = (x,y,z)=>new THREE.Vector3(x,y,z);

  /* --------------------------------------------------------------- worlds
     There is more than one planet now, so everything that used to be a
     constant about THE world is a property of A world: how big it is, what
     colour its sky and its soil are, how much it heaves, which buildings
     stand on it, and the seed its landscape is generated from.

     Two kinds. The hub is the school — everybody lands on the same one and
     it is the same for everyone. A home planet belongs to one player, is
     generated from their own seed, and is theirs alone: their palette, their
     hills, their name on the sign. That is the whole reason the seed exists.

     Placed in degrees, because "72 degrees round and 6 down" is something
     you can reason about and a raw vector is not. */
  const HUB_BUILDINGS=[
    { id:'missions', name:'MISSION CONTROL', em:'\u{1F680}', lon:0,   lat:7,  w:64, d:46, h:18, door:10,
      wall:0x3a4f8c, roof:0x8fd3ff, blurb:'Every mission, one station each' },
    { id:'workshop', name:'THE WORKSHOP',    em:'\u{1F527}', lon:-19, lat:-6, w:24, d:20, h:11,
      wall:0x4a3f7a, roof:0xcdb4f6, blurb:'Build anything, with your class' },
    { id:'mall',     name:'THE MALL',        em:'\u{1F642}', lon:19,  lat:-6, w:72, d:48, h:15, door:10,
      wall:0x6b4a5e, roof:0xffb4a2, blurb:'Everyone you could be, standing up' },
    { id:'library',  name:'THE LIBRARY',     em:'\u{1F4DA}', lon:0,   lat:-21, w:26, d:20, h:11,
      wall:0x4d6b4a, roof:0xa8e6cf, blurb:'Look up any word in the language' },
    { id:'mechanic', name:'THE MECHANIC',    em:'\u{1F527}', lon:-34, lat:6,  w:40, d:28, h:14, door:9,
      wall:0x5c4636, roof:0xffd8a8, blurb:'Cars and ships, and the coins to buy them' }
  ];

  /* Grass, ochre, violet and ice. A home planet picks one from its seed, so
     two students standing on each other's worlds can tell them apart from
     orbit, never mind from the ground. */
  const BIOMES=[
    { key:'green',  sky:0x070a1a, soil:[[0.13,0.28,0.15],[0.20,0.38,0.18],[0.29,0.44,0.19],
                                       [0.40,0.40,0.20],[0.30,0.22,0.14],[0.31,0.30,0.32]] },
    { key:'ochre',  sky:0x140a06, soil:[[0.36,0.24,0.12],[0.47,0.32,0.15],[0.56,0.40,0.19],
                                       [0.62,0.50,0.26],[0.35,0.25,0.16],[0.38,0.34,0.30]] },
    { key:'violet', sky:0x0a0716, soil:[[0.22,0.15,0.32],[0.31,0.21,0.42],[0.40,0.29,0.50],
                                       [0.48,0.40,0.55],[0.28,0.20,0.30],[0.34,0.32,0.38]] },
    { key:'ice',    sky:0x050d16, soil:[[0.30,0.40,0.46],[0.42,0.53,0.58],[0.55,0.65,0.70],
                                       [0.68,0.75,0.78],[0.34,0.38,0.42],[0.44,0.46,0.50]] }
  ];

  /* WHAT GROWS ON A WORLD, because "a planet with a different sky" is the
     same planet with a filter on it. What actually tells two worlds apart
     from the ground is the things standing up out of it — so that is a
     property of the world too, not a constant in scatter().

     Senio grows wood: trees and boulders, a school field with a wood at the
     edge of it. VOLTA grows glass. Nothing is alive on it; what comes out
     of the ground is lit from inside, which is the only light there is on a
     world whose sky is nearly black. */
  const FLORA={
    wood:{
      trunk:0x6b4a34, leaf:0x4f9457, stone:0x7d7a86, tall:0.45,
      pebble:[0x7d7a86,0x8b8578,0x6e6b74,0x94908a],
      bud:[0xe8d9a0,0xe0a0b8,0xc9b7ea,0xf0e6b4], budGlow:false
    },
    /* Spires and shards. The spire is a tall thin octahedron — four facets a
       side, so it catches the light differently from every angle without
       costing more than the cone it replaces — and it is emissive, because
       on VOLTA it is doing the job the sun does everywhere else. */
    crystal:{
      /* Lifted, because these are the light source and not a decoration
         standing in somebody else's. A saturated pink at full channel is
         already as bright as an emissive material can be asked to go — so
         what makes it shine harder is moving it TOWARDS WHITE, which is
         what a real light does as it gets brighter. */
      trunk:0x3a2a60, leaf:0xff92e4, stone:0x46356e, tall:0.55, glow:true,
      /* Thicker than Senio's woods per square metre, because on a world with
         no grass, no weather and no animals these are the only thing between
         two buildings and the horizon. */
      density:2.4,
      pebble:[0x4a3a72,0x362a55,0x54437e,0x2e2350],
      bud:[0xff9ae8,0xa8f6ff,0xdcc8ff,0xffb8bd], budGlow:true
    }
  };

  /* Names, not numbers. "Planet 4713" is a save slot; "Veskaro" is a place. */
  const SYL_A=['Ve','Ta','Ori','Sol','Ky','Nu','Bra','Mel','Zan','Hal','Pyr','Cel',
               'Dro','Ish','Fen','Ora','Lum','Ras','Ther','Vex'];
  const SYL_B=['ska','dun','mir','vex','tara','lys','morn','doria','beth','var',
               'quel','ondo','rax','stel','nova','heim','ara','tide','fell','ion'];
  function planetName(seed){
    const a=SYL_A[seed % SYL_A.length];
    const b=SYL_B[(seed>>>5) % SYL_B.length];
    return (a+b).toUpperCase();
  }

  /* The player's own number. Kept in PROGRESS so it rides the same bag as
     coins and finished missions, which means it follows the account onto any
     machine — a home planet that changed shape when you logged in from the
     other side of the classroom would not be a home. */
  function homeSeed(){
    if(!window.PROGRESS) return 20250906;
    let n=PROGRESS.get('home_seed', 0);
    if(!n){
      n=(Math.random()*0x7fffffff)|0 || 1;
      PROGRESS.set('home_seed', n);
    }
    return n>>>0;
  }
  function homeWorld(){
    const seed=homeSeed(), bio=BIOMES[seed % BIOMES.length];
    return {
      id:'home', kind:'home', seed,
      name:planetName(seed), sub:'your home planet',
      radius:200, sky:bio.sky, soil:bio.soil, biome:bio.key,
      relief:6.5 + (seed>>>7)%6, ceiling:95,
      buildings:[
        { id:'house', name:planetName(seed)+' HOUSE', em:'\u{1F3E0}', lon:0, lat:2,
          w:26, d:22, h:12, door:8,
          wall:0x4a3f7a, roof:0xcdb4f6, blurb:'Yours. Build whatever you like in it' }
      ],
      pad:{ lon:0, lat:-13 }
    };
  }
  const HUB={
    id:'hub', kind:'hub', seed:0, name:'Senio', sub:'everybody lands here',
    /* Radius sets how hard the world curves. The horizon from the chase camera
       is roughly sqrt(2*PR*camHeight), so 92 put it 28 metres out and buildings
       rose out of the ground in front of you. At 320 it is past fifty and the
       curve reads as a planet rather than a hill you are always on top of. */
    radius:320, sky:0x070a1a, soil:BIOMES[0].soil, biome:'green', relief:9.5,
    /* HOW HIGH YOU MAY FLY, in metres over the ground. A number per world
       rather than one for the game: the whole reason VOLTA is a quarter of
       the size of Senio is that you are meant to be able to see all of it,
       and a ceiling that let you climb higher than the place is wide would
       put you above a marble. Roughly a third of the radius keeps the
       ground reading as ground — buildings still have size, the horizon
       still curves — and it is far enough up to cross the map in one hop. */
    ceiling:120,
    buildings:HUB_BUILDINGS,
    pad:{ lon:-34, lat:-9 }
  };
  /* ------------------------------------------------------- the night world
     VOLTA. Two buildings, and you can see both of them from the pad.

     IT IS SMALL ON PURPOSE, and much smaller than it was. Senio is a school
     with a wood round it and it wants a horizon you cannot see the end of;
     this is a place you fly to for one evening, and the walk between the
     door you came in by and the thing you came for should be forty seconds,
     not four minutes. At a radius of 118 the lap is 741 metres against
     Senio's two thousand, and the ground visibly falls away — which is the
     other half of "small": a world you can tell is a ball by standing on it.

     AND IT IS NOT A RECOLOURED Senio. Its own sky, its own soil, and glass
     coming out of the ground instead of trees — see FLORA. Nothing grows
     here and nothing is alive out on the surface; the only things that move
     are inside THE LOOP. */
  const ARENA_BUILDINGS=[
    { id:'gym',  name:'THE GYM',  em:'\u{1F916}', lon:-27, lat:3, w:36, d:28, h:14, door:9,
      wall:0x2b2340, roof:0xff9aa2, blurb:'Program a mech and fight' },
    /* Named for what is in it. A DJ set is a loop that keeps going round
       with things added and taken away, which is the block a student meets
       in Mission 2 — and here it is a thing you dance to rather than a thing
       you are marked on. */
    { id:'club', name:'THE LOOP', em:'\u{1F3A7}', lon:27, lat:3, w:44, d:36, h:16, door:10,
      wall:0x241a3d, roof:0xff6ad5, blurb:'The floor, and the decks are yours' },
    /* THE ARCADE. Opposite the pad, so it is the first thing you walk
       towards when you land. Games are MADE in Free Play, where the editor
       is; this is where they are played by somebody who did not make them,
       which is the half that was missing. */
    { id:'arcade', name:'THE ARCADE', em:'\u{1F579}', lon:0, lat:26, w:40, d:30, h:15, door:9,
      wall:0x1d2a4a, roof:0x8ff0ff, blurb:'Play what your class has made' }
  ];
  /* Deep indigo up through violet, and never toward green or brown. The
     brightest step is the one the club's own light falls on. */
  const NIGHT_SOIL=[[0.09,0.06,0.18],[0.13,0.08,0.25],[0.18,0.11,0.33],
                    [0.25,0.14,0.41],[0.11,0.07,0.21],[0.15,0.13,0.26]];
  const ARENA_WORLD={
    id:'arena', kind:'arena', seed:7, name:'VOLTA', sub:'the small loud one',
    radius:118, sky:0x08040f, soil:NIGHT_SOIL, biome:'neon', relief:2.4,
    flora:'crystal', night:true, ceiling:48,
    buildings:ARENA_BUILDINGS,
    pad:{ lon:0, lat:-17 }
  };
  /* ======================================================== RYU
     THE WORLD YOU ARRIVE ON.

     Senio is where the course is. This is not that: it is the first ball
     under your feet when you open the game, and the story happens here.

     IT USED TO SET A `cast`, which is to say that landing on it turned
     every player into Robin whoever they had picked in the Mall, and
     turned them back on the way out. The machinery was careful — it never
     wrote to the save bag, so the choice survived — and it was still the
     wrong trade: the one ball where anything happens was the one place a
     student could not be the character they chose, and every line of
     dialogue on it called them by somebody else's name. Robin is on the
     roster now and this world casts nobody.

     SHUTTLE, because you did not fly here. Every other course in the game
     is flown in a ship you had to buy, and a player who arrives on their
     first minute has no ship and no coins to buy one with — so the pad
     that put them down here is the pad that takes them back, and it does
     not ask. Without that this world is a room with the door painted on.

     Ochre, so it cannot be mistaken for Senio at a glance: the two green
     worlds in this game are the hub and whichever home planet the seed
     rolled, and arriving somewhere that looks like the place you already
     know is not arriving anywhere. */
  const RYU_WORLD={
    id:'ryu', kind:'ryu', seed:11, name:'RYU', sub:'the mission with one door',
    radius:240, sky:BIOMES[1].sky, soil:BIOMES[1].soil, biome:'ochre',
    /* AND YOU MAY FLY HERE. See wayOpen(): a mission world is walked, and
       this one has an arena in it that is worth seeing from above.

       THE CEILING HAD TO GO UP WITH IT. Eighty units was headroom for a
       fifty-eight metre tower; the arena's rim is a hundred and twelve
       and the machines in it are ninety-five, so a player who took off to
       look at the fight hit the roof below the top row of the stands. */
    relief:7.5, ceiling:260, flyOk:true, flora:'wood',
    /* AND NO CAST. This world used to set `cast:'w'`, which turned every
       player on it into Robin — the story was written for her and the
       ball simply put her on. It is the wrong trade: a student picks a
       character, wears it for six missions, and then the one ball where
       anything happens takes it off them and puts somebody else's name in
       every line. You arrive as yourself now. Robin is on the roster, so
       anybody who wants to be her can choose to be. */
    /* A MISSION, NOT A WORLD YOU LIVE ON — and that is one word rather
       than four rules, because every rule that follows from it follows
       automatically.

       THERE IS ONE DOOR. RYU is reached from the Ion station on the floor
       of Mission Control and from nowhere else: no course leads here, no
       pad stands here, and signing back in never resumes here. It used to
       have a shuttle pad with a LAUNCH sign on it pointed at Senio, which
       made it a place you could be in two ways and leave in two ways — and
       a story with two front doors is a story a student can walk into
       halfway through.

       `mission` is where LEAVE comes out, and it is the same place every
       other mission in this game comes out: the door of Mission Control.
       Nothing about the way out of Robin's story should be special, and
       everything about it used to be. */
    mission:'hub',
    /* ONE DOOR, AND A ROOM BEHIND IT. Everything else on this ball is
       still ground — see house.js for what is inside. An id `use()` does
       not know is dropped on the floor, so the route below is not
       optional decoration: without it this is a shed with a sign on it. */
    buildings:[
      { id:'ryuhouse', name:'HOME', em:'\u{1F3E0}', lon:0, lat:-2,
        w:28, d:24, h:12, door:9,
        wall:0x4b4030, roof:0xe8c9a0, blurb:'Two rooms. Somebody is not answering' },
      /* THE TOWER, AND IT IS MEANT TO BE JUST VISIBLE. At a radius of 240
         the horizon from head height is about 28 units, and a thing H tall
         is seen from 28 + sqrt(2*240*H).

         IT MOVED, AND IT HAD TO GROW TO STAY WHERE IT WAS. Forty-five
         degrees of longitude is about 190 units from the front door, which
         is a flight rather than a long walk — and a 34-high tower drops
         below the curve at 156, so at 190 the spike on the horizon would
         simply have stopped being there. 58 high shows from 195. Further
         away and exactly as visible: the gap you cannot cross on foot is
         the mission, and being able to SEE what you cannot reach is what
         makes it one. */
      { id:'tower', name:'THE TOWER', em:'\u{1F5FC}', lon:45, lat:4,
        w:16, d:16, h:58, door:8,
        wall:0x3a3550, roof:0x8ff0ff, blurb:'Mr Einstein is up there' }
    ]
    /* AND NO PAD. padSpec() builds one wherever a world declares a spot,
       with a LAUNCH panel on it and a course in the sign — and there is
       nowhere to launch to from here. See `mission` above. */
  };
  const WORLDS = ()=>[HUB, homeWorld(), ARENA_WORLD, RYU_WORLD];
  const worldById = id => id==='home' ? homeWorld()
                        : id==='arena' ? ARENA_WORLD
                        : id==='ryu' ? RYU_WORLD : HUB;

  /* The live world, and the things every other function in this file reads
     off it. They were consts when there was only ever one planet. */
  let W=HUB, PR=W.radius, SKY=W.sky, BUILDINGS=W.buildings;
  let RELIEF=W.relief, SOIL=W.soil.map(c=>({c}));
  function setWorld(w){
    W=w; PR=w.radius; SKY=w.sky;
    /* The pad appends itself to this list when the world is built, so a
       second visit would find last visit's pad still in it — pointing at a
       group that was thrown away with the old room. Drop it and let the
       rebuild put a fresh one back. */
    /* PROPS ARE NOT BUILDINGS and they are not kept. The pad appends
       itself when the world is built and so does the ship, so a second
       visit would find last visit's copies still in the list — pointing at
       groups that were thrown away with the old room, and getting pushed
       again on top. Both are `prop:true` now rather than the pad being
       excluded by name, because the next one of these will be too. */
    BUILDINGS = w.buildings = w.buildings.filter(b=>b.id!=='pad' && !b.prop);
    RELIEF=w.relief; SOIL=w.soil.map(c=>({c}));
    BUILDINGS.forEach(b=>{ b.g=null; b.dir=null; b.frame=null; b.solids=[]; b.decks=[]; });
    lift=null; mechB=null; folk=[];   // the tower went with the world that held it
  }
  /* WHAT MISSION CONTROL OFFERS, WHICH IS NOT EVERYTHING THAT EXISTS.

     This list used to be twelve long — Level 0, Flight School, Escape and
     Missions 1 to 8 — and most of those rooms are built on the OLDER
     block language, the one where `change y by 1` still means up. Putting
     them on the same board as the ring hands a class two languages that
     disagree about which letter points where, and the student who finds
     that out finds it out in the middle of a mission.

     So it offers the two rooms that share one language: the ring, where
     you learn the blocks against something that fights back, and Pong,
     where you build a whole game out of them. The other rooms are still
     in the code and still reachable from the menu; they are just not what
     a student is pointed at from here. Adding one back is a line. */
  const STATIONS=[
    { id:'ring',   em:'\u{1F94A}', name:'The Ring \u2014 NOISY BOY vs AMBUSH', a:'#8fd3ff' },
    /* PONG. The first mission that is a GAME rather than a lesson with a
       robot in it: three objects, every one of them openable, and nothing
       underneath doing the interesting part. */
    { id:'pong',   em:'\u{1F3D3}', name:'PONG \u2014 build the whole game', a:'#ffe9a8' }
  ];

  const dirOf=(lonDeg,latDeg)=>{
    const lo=lonDeg*Math.PI/180, la=latDeg*Math.PI/180;
    return V(Math.cos(la)*Math.sin(lo), Math.sin(la), Math.cos(la)*Math.cos(lo));
  };
  /* A tangent frame at a direction. There is no continuous choice of "north"
     on a sphere, so the reference is picked to dodge the pole it would
     otherwise be undefined at. */
  function frameAt(dir, spin){
    const up=dir.clone().normalize();
    const ref = Math.abs(up.y) > 0.94 ? V(0,0,1) : V(0,1,0);
    let right=new THREE.Vector3().crossVectors(ref, up).normalize();
    let fwd=new THREE.Vector3().crossVectors(up, right).normalize();
    if(spin) fwd.applyAxisAngle(up, spin);
    right=new THREE.Vector3().crossVectors(up, fwd).normalize();
    return { up, fwd, right };
  }
  /* Where you land the first time: out in front of Mission Control's door,
     far enough back to read the sign over it. The door is the +z side of the
     building's own frame, so this steps back along that side rather than
     guessing at a latitude — guessing put you behind the building as often
     as in front, which makes "walk to the door" a hunt. */
  /* Far enough back to see the whole of whatever you are landing in front
     of — and NOT further, because on a small world "far enough back" walks
     you over the horizon. Seventy-four metres is 13 degrees of Senio and 36
     of VOLTA, and at 36 degrees the building you were meant to be looking
     at has gone below the curve. So it is a fraction of the ball, capped at
     the distance Senio has always used. */
  const landingOff = ()=> Math.min(74, PR*0.24);
  function landingSpot(){
    const b=BUILDINGS[0];
    if(!b.frame) return dirOf(b.lon, b.lat-14);
    return b.dir.clone().applyAxisAngle(b.frame.right, landingOff()/PR).normalize();
  }
  /* The tangent at `from` that points along the ground toward `to`. On a
     sphere you cannot subtract two positions and call it a direction — the
     part of `to` that sticks out of the surface has to come off first. */
  function facing(from, to){
    const f=to.clone().sub(from.clone().multiplyScalar(to.dot(from)));
    return f.lengthSq()<1e-9 ? frameAt(from,0).fwd.clone() : f.normalize();
  }
  function stand(g, dir, spin, lift){
    const f=frameAt(dir, spin||0);
    g.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(f.right, f.up, f.fwd));
    g.position.copy(f.up).multiplyScalar(PR + (lift||0));
    return f;
  }

  let on=false, server=null, others=new Map(), crowd=null;
  /* The car you bought, if you have one on. Riding is the whole use of a car
     here — there is nothing to race on a planet, so it is a faster way to
     cross one and a thing to be seen in. */
  let ride=null, rideId=null;
  /* IN THE AIR. Flight is a third way of getting about rather than a mode
     of walking: the keys mean different things, the camera sits somewhere
     else, and gravity is not running. `flying` is the whole of the state —
     everything else it needs is already on `me`, which is what a bird and
     a person on foot genuinely have in common. */
  let flying=false, swimming=false, dome=null;
  /* ABOARD THE E-45. Not a `ride` — a ride is a car, it drives on the
     ground and RIDE_SPEED and the drive camera all belong to it. This is
     the same idea one layer over: the body is detached, a vehicle is posed
     where the body would have been, and the flight that carries it is the
     flight this game already has. */
  let aboard=false, shipRide=null;
  let statues=[];                    // the ones that turn on their plinths
  let aoStats=null;                  // what the ray-traced pass cost, for tuning
  /* You, as the planet sees you. G.pos is derived from this, never the
     other way round. */
  let me={ dir:null, fwd:null, alt:0, vy:0, onGround:true,
           spd:0,        // how fast the car is going, along its own nose
           look:0,       // where you are looking, which is not where it is going
           /* IN THE AIR: airspeed along the nose, how fast you are climbing,
              and how far the body is rolled into the turn. The last one is
              a picture rather than a physics term — nothing is computed
              from it — but a turn without a bank reads as a person being
              dragged sideways rather than flying. */
           air:0, climb:0, bank:0 };
  /* Where you were standing, PER WORLD. Fly home, walk about, fly back, and
     the hub should put you down beside the pad you left from — not at the
     spot you last stood on a different planet. */
  let lastYaw=0, backs={};
  /* AND ON DISK, because `backs` on its own only remembers a session. Sign
     out halfway across Senio and the planet used to forget you entirely: back
     in, and you were standing on the landing pad again with the walk to
     Mission Control still to do. A spot is six numbers and a world's name, so
     it rides in the progress bag with the coins and the finished missions and
     follows the account onto any machine in the lab.

     ONLY THE DIRECTION AND THE HEADING ARE KEPT. How high the ground is under
     you is generated from the world's own seed and comes out the same every
     time, so it is asked for again on arrival rather than trusted from a file
     — which is also what stops a stored altitude from dropping somebody
     through a hill the day the terrain is tuned. */
  const SPOT = id => 'spot_'+id;
  const R4 = v => [Math.round(v.x*1e4)/1e4, Math.round(v.y*1e4)/1e4, Math.round(v.z*1e4)/1e4];
  let spotAt=0, spotWas=null;
  /* `force` is for the doors — leaving the planet writes wherever you are,
     even if you have not moved since the last time. Without it, a step out to
     the pad and straight into the ship would not be worth a write. */
  function rememberSpot(force){
    if(!on || !me.dir || !me.fwd) return;
    backs[W.id]={ dir:me.dir.clone(), fwd:me.fwd.clone() };
    if(!window.PROGRESS || !PROGRESS.set) return;
    /* Standing still is not news. A metre and a half of ground is under the
       resolution of "put me back where I was" and saves a lesson's worth of
       writes from somebody reading the sign outside Mission Control. */
    if(!force && spotWas && spotWas.id===W.id && spotWas.dir.angleTo(me.dir)*PR < 1.5) return;
    spotWas={ id:W.id, dir:me.dir.clone() };
    /* Nothing writes the hub's spot, because nothing reads it — Senio lands
       you at its door however you left it. Still worth saying WHICH ball you
       were on, though, so signing back in does not always drop you here. */
    if(W.kind!=='hub') PROGRESS.set(SPOT(W.id), { d:R4(me.dir), f:R4(me.fwd) });
    /* And WHICH BALL, so signing back in lands you on the one you were on
       rather than always on the hub — unless it is a mission, which is a
       place you were sent and not a place you live. Writing RYU here would
       be the story quietly becoming somebody's home planet. */
    if(!W.mission) PROGRESS.set('world', W.id);
  }
  /* THE BAG IS THE AUTHORITY, and `backs` is only the fallback for somebody
     playing with no storage at all. It has to be that way round: the bag is
     what gets replaced when a different student signs in on the same machine,
     and a session cache consulted first would have walked them out onto the
     last child's spot.

     Anything malformed is simply no spot. A stored position that cannot be
     trusted has to read as a first landing — never as a player left standing
     inside the planet. */
  function savedSpot(id){
    const raw=(window.PROGRESS && PROGRESS.get) ? PROGRESS.get(SPOT(id), null) : null;
    const fallback = backs[id] || null;
    if(!raw || !Array.isArray(raw.d) || !Array.isArray(raw.f)) return fallback;
    if(raw.d.length!==3 || raw.f.length!==3) return fallback;
    const dir=V(+raw.d[0]||0, +raw.d[1]||0, +raw.d[2]||0);
    const fwd=V(+raw.f[0]||0, +raw.f[1]||0, +raw.f[2]||0);
    if(!isFinite(dir.length()) || dir.lengthSq()<1e-6) return fallback;
    dir.normalize();
    /* SQUARE IT UP BEFORE IT IS USED. A heading rounded to four decimals is
       no longer exactly tangent to the ball, and a basis built out of square
       is a body that leans — the same failure the other players' headings had
       to be fixed for further down. */
    fwd.sub(dir.clone().multiplyScalar(fwd.dot(dir)));
    if(!isFinite(fwd.length()) || fwd.lengthSq()<1e-6) return fallback;
    fwd.normalize();
    backs[id]={ dir, fwd };
    return backs[id];
  }
  /* Which world to open on when nobody says. The bag's answer if it names one
     we have, the hub otherwise — a name we do not recognise must never be a
     student who cannot get back into the game. */
  function lastWorld(){
    if(!window.PROGRESS || !PROGRESS.get) return 'hub';
    const id=PROGRESS.get('world','hub');
    const w=WORLDS().find(x=>x.id===id);
    /* A name we do not recognise must never be a student who cannot get
       back into the game — and neither must a mission world, whether it
       got in here before `mission` existed or by some route nobody has
       thought of yet. */
    return (w && !w.mission) ? id : 'hub';
  }
  /* WHERE LEAVE COMES OUT. Nothing for a world you live on: the button
     means "out of whatever room I am in" and you stay on your ball. A
     mission names the world it hands you back to. */
  const leaveTo = () => (W && W.mission) || null;

  const worldPos = extra => me.dir.clone().multiplyScalar(PR + me.alt + (extra||0));

  /* ---------------------------------------------------------------- build */
  /* WHERE TO PUT SOMEBODY DOWN, when the caller knows better than the save
     bag does. Walking out of the house is the case: the room you were in
     is a building on this ball, so you should come out of its door — and
     a student who reached that room from Mission Control has never stood
     on RYU and has no saved spot to be put back at. {lon,lat} in, and it
     outranks the bag for exactly one arrival. */
  /* `again` is the film handing back — see below. It is the difference
     between joining the mission and the mission's own opening returning
     control, and without it the two are the same call. */
  function enter(sv, worldId, at, again){
    /* ================================== THE FILM, BEFORE ANYTHING EXISTS
       It is a cold open on Ion on the kitchen floor, and it has to run
       HERE — before a single line of this function has built anything —
       because the film takes G.roomGroup for its own set and throws it
       away again on the way out. Played from the bottom of enter(), where
       the walkthrough starts, that meant fifteen seconds of Ion followed
       by RYU not existing: the world had been built, replaced by a
       kitchen, and never built again. It also meant the player's own body
       was standing in the middle of the set, because AVATAR hangs that
       off the camera rather than off the room.

       So it plays first and calls enter() back. OPENING.seen makes the
       second call fall straight through, and the mission gets built
       exactly once either way.

       ONLY ON THE WAY IN AND ONLY WHILE THE MISSION IS UNFINISHED. It is
       a cold open, not a recap: somebody flying back to the tower with Ion
       in the hold does not need to be told he is on the floor. */
    /* NO RESTART AND NO FILM HERE ANY MORE. Both used to sit at the top of
       this function, keyed off "arrived at RYU with no spawn point" — and
       the only thing that ever calls enter('ryu') is house.js opening the
       front door, which always passes one. They never ran. Mission 8 is
       joined through startMissionRoom('ion') in game.js, which opens the
       house rather than the planet, and that is where both of them are. */
    server = sv || null;
    // whichever ball we are standing on decides its own size, sky and soil
    setWorld(worldById(worldId || (W?W.id:'hub')));
    COMBAT.reset(); PUZZLE.stop(); NAV.stop(); TUTOR.stop(); RACE.stop();
    if(window.FLIGHT) FLIGHT.stop();
    if(window.MISSIONS) MISSIONS.stop();
    if(window.CODER) CODER.hide();
    if(window.MECH) MECH.stop();
    /* AND THE RIDGE, BEFORE THE ROOM IT STANDS ON IS THROWN AWAY. The
       whole roomGroup is replaced a few lines below, which takes both
       machines with it — but BRAWL would still be holding the groups and
       would skip rebuilding them, so the next world gets a module that
       thinks it has two robots in a scene that no longer exists. */
    if(window.BRAWL) BRAWL.clear();
    specsOff();
    if(window.INVADERS) INVADERS.stop();
    if(window.TRAIL) TRAIL.stop();
    if(window.HOUSE) HOUSE.stop();
    if(window.CLUB) CLUB.stop();
    CODE.close(); CODE.hideTape(); CODE.setGuide(null); CODE.setBudget(0);
    if(window.VM) VM.leave();

    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.selected=null; G.focused=null; G.ceiling=null;
    G.ground=null; G.vel.y=0; G.onGround=true;
    others.clear();
    statues=[]; ada=null; bays=[]; purseFace=null; padShip=null; padB=null;
    mannequins=[]; flies=null; beasts=[]; sparkTex=null; basins=[];
    if(window.ISLANDS) ISLANDS.clear();
    if(window.MEADOW) MEADOW.clear();
    shipBayPanel=null; shipBayModel=null; padPanel=null;
    /* RYU IS MISSION 8 AND THE OTHER BALLS ARE NOT. Three of this
       module's four worlds are places you live on; RYU is a mission with
       one door, and the pause menu reads G.missionId to decide whether to
       offer a way back to level one. Naming it here rather than
       everywhere means the offer follows the player from the house out
       onto the hillside, which is one mission either side of a door. */
    G.room='planet'; G.hudOwner='planet'; G.running=true;
    G.missionId = (W && W.id==='ryu') ? 'ion' : null;
    /* WHO EVERYBODY IS HERE. Before the body is attached below and before
       anybody else is painted into the crowd, so the first frame of this
       world already has the right person standing in it rather than the
       old one for a beat. A world with no cast clears it, which is how
       you turn back into yourself by leaving. */
    if(window.AVATAR) AVATAR.setCast(W.cast || null);
    /* SENIO'S THEME, and only on Senio. It is the hub's music, not the
       game's: the planet the missions are on gets it, and the arena, the
       home planet, the rooms indoors and the run between the planets do
       not. A theme that plays everywhere stops being a theme. */
    if(window.MUSIC) MUSIC.play(W.id==='hub' ? 'hub' : null);
    G.scene.background=new THREE.Color(SKY);
    /* The stars, the neighbour and its ring all sit five hundred metres out
       and the camera stopped seeing at two hundred and twenty, so none of the
       sky this room builds had ever been on screen. */
    G.camera.near=0.3; G.camera.far=1800; G.camera.updateProjectionMatrix();
    // fog would eat the far side of the world, and the far side is the point
    G.scene.fog=null;
    on=true;

    sky();
    sunLight();                    // day or night, before anything is baked
    padSpec(W);                    // in the list before the ground is made
    shipSpec(W);                   // and so is whatever is parked outside
    /* AND THE HOLES BEFORE THAT. A pool's position comes off the island's own
       longitude and radius, so it can be asked for long before there is any
       water — which is the only way the ground can be dug out for it. */
    basins = window.ISLANDS ? ISLANDS.spots({ id:W.id, PR, dirOf, frameAt }) : [];
    seatBasins();                  // and level their rims before anything is dug
    surface();
    /* A PROP DOES NOT GET WALLS. build() makes a building — four walls, a
       roof and a door — and the parked vehicle went through it, so walking
       out of the house put you inside a shed that had grown around it.
       It is a model on a patch of ground; that is all it ever was. */
    BUILDINGS.forEach(b=>{ if(b.id!=='pad' && !b.prop) build(b); });
    launchpad(W);                  // its plate, now that its patch is flat
    shipBuild();                   // and the ship on its own patch
    scatter();                     // after the buildings: it works around them
    cover();                       // and the small stuff after the big stuff
    fireflies();                   // and then the things that are alive
    /* Nothing walks about on VOLTA. It is a rock somebody put two buildings
       on, and the fauna the hub has is the hub's — a herd grazing outside a
       nightclub is a different game. */
    wildlife(W.kind==='arena' ? 0 : W.kind==='home' ? 10 : 18);
    /* AND THE TWO ON THE RIDGE, on RYU only, and only for somebody who has
       the glasses. Five and a half megabytes of robot is not a thing to
       fetch for a player who has not met the Mechanic yet and cannot see
       them — but it is also not a thing to fetch at the moment of the
       reveal, so it is not left until the G press either. Whoever already
       owns them gets them with the world; whoever earns them mid-session
       gets them at the handover, which is a good half minute of dialogue
       and a lift ride before they can be outdoors to look. */
    if(haveSpecs()) brawlBuild();
    /* AND THEN THE SKY. The islands hang over Senio inside the flight
       ceiling, and everything they need to stand themselves up on a sphere
       is handed over rather than reached for — this file owns the world, and
       sky.js should not be keeping a second copy of its radius. */
    if(window.ISLANDS) ISLANDS.build({ id:W.id, group:G.roomGroup, PR, dirOf, frameAt, terrainH, basinRim });
    /* and grass you can walk through, round your feet, on a world that has any */
    if(window.MEADOW) MEADOW.build({ id:W.id, biome:W.biome, group:G.roomGroup, PR, frameAt, terrainH, lushAt });
    G.scene.updateMatrixWorld(true);
    aoStats=bakeAO();              // and then trace the light into all of it
    crowd=new THREE.Group(); G.roomGroup.add(crowd);

    /* SENIO ALWAYS LANDS YOU IN THE SAME PLACE, and that is deliberate rather
       than a missing feature. A hub is somewhere you arrive: the door you are
       being sent to is in front of you, the sign over it is readable, and the
       walk to it is the same walk every time — which is what makes it a place
       a class can be told to go to rather than a place each of them wakes up
       somewhere different in. Being put back wherever you happened to log out
       is right for a world you were exploring and wrong for the one everybody
       starts from: it turns "meet me outside Mission Control" into a hunt for
       whichever hillside you left off on.

       The other worlds keep it. A home planet is yours and a night world is
       somewhere you were part-way through looking at, and on both of those
       being put back where you were is the whole point. */
    const back = at ? null : (W.kind==='hub' ? null : savedSpot(W.id));
    if(at){
      /* Facing whatever is nearest, so you come out looking at something
         rather than at the horizon. */
      me.dir=dirOf(at.lon, at.lat);
      let near=null, nd=1e9;
      BUILDINGS.forEach(b=>{ if(!b.dir) return;
        const d=b.dir.distanceTo(me.dir); if(d>0.001 && d<nd){ nd=d; near=b; } });
      me.fwd = near ? facing(me.dir, near.dir) : frameAt(me.dir,0).fwd.clone();
    }
    else if(back){ me.dir=back.dir.clone(); me.fwd=back.fwd.clone(); }
    else {
      /* Out in front of Mission Control's door, looking straight at it. Not
         "somewhere near it" — the door is on the +z side of the building's
         own frame, so step back along that side and then face the building.
         Spawning at a fixed latitude used to put you behind it as often as
         in front, which makes the first instruction a student ever gets
         ("walk to the door") a hunt. */
      // far enough back that the whole building and its sign are in frame
      me.dir=landingSpot();
      me.fwd=facing(me.dir, BUILDINGS[0].dir);
    }
    me.alt=floorAt(me.dir); me.vy=0; me.onGround=true; me.spd=0; me.look=0;
    /* Every landing is on foot: the dome belonged to the world we left and
       is gone with its room group, and a ceiling is a property of the ball
       you are standing on. */
    flying=false; swimming=false; dome=null; streak=null; me.air=0; me.climb=0; me.bank=0; me.roll=0; me.lean=0;
    /* AND NOT STILL ABOARD. shipRide belonged to the room group that has
       just been thrown away, so `aboard` without it is a flight with
       nothing in it and a body that never comes back. */
    aboard=false; shipRide=null; arrived=false;
    if(window.AVATAR) AVATAR.posture(null);
    // level, not looking at your own feet: the sign is above the door
    lastYaw=G.yaw=0; G.pitch=0.03;
    G.pos.copy(worldPos(EYE));
    ride=null; rideId=null;
    if(window.AVATAR) AVATAR.attach();
    fitRide();
    place(0.016,false,false);
    G.scene.updateMatrixWorld(true);

    document.querySelector('#mapwrap').classList.add('hidden');
    ['#health','#skill','#trigger','#fbeat','#radar'].forEach(s=>{
      const e=document.querySelector(s); if(e) e.classList.add('hidden'); });
    // there is nothing to shoot or double-click out here, so do not offer it
    keysFor();
    hud(); dash(); drawMap();
    connect();
    /* AND NO CHAT WINDOW OVER A STORY. connect() is what puts it up and
       it refuses on a mission world — but the panel is a page element,
       not something this world owns, so one left open by the hub would
       still be sitting over Ion on the kitchen floor. */
    if(solo() && window.CHAT) CHAT.hide();
    /* The walkthrough is about the hub's front door — it points at Mission
       Control and at the stations inside it, neither of which exists on
       another ball. Landing anywhere else is not a first arrival. */
    if(!toured() && W.kind==='hub'){ markToured(); setTimeout(()=>{ if(on) tour(); }, 700); }
    /* AND RYU GETS ITS OWN, every arrival rather than once ever. See
       ionTour: the hub's walkthrough is about which keys move you and is
       worth one showing; this one is about where the next thing is, on a
       ball with four objects and a story between them, and a student who
       comes back to a half-finished mission wants it again. */
    /* The walkthrough. The film, if there is one, has already played and
       gone — see the top of enter(). */
    if(W.id==='ryu') setTimeout(()=>{ if(on) ionTour(); }, 900);
    /* AND SAY WHAT JUST HAPPENED TO YOU. A player who picked Carlos and
       walks out of the shuttle in somebody else's body, with nothing
       anywhere saying why, has not arrived on a planet — they have found a
       bug. One line, once, on the way in. */
    if(W.cast && window.AVATAR){
      /* THROUGH bodyDef, NOT CHARS. Robin is deliberately not on the
         roster — she is the one body only a place can hand you — so
         looking her up in the list of characters you can CHOOSE found
         nothing, and the line read "out here everyone is w". */
      const who=(AVATAR.bodyDef ? AVATAR.bodyDef(W.cast)
                                : AVATAR.CHARS.find(c=>c.id===W.cast) || {}).name || W.cast;
      setTimeout(()=>{ if(on && W.cast) say(t('{p} takes your shape. Out here everyone is <b>{n}</b>.',
                                             {p:W.name, n:who})); }, 900);
    }
    /* On the record from the first frame, so a tab closed on the way in still
       comes back to this planet rather than to the hub. */
    spotAt=performance.now(); rememberSpot(true);
    if(window.updateLeaveBtn) updateLeaveBtn();
    if(window.updateCodeBtn) updateCodeBtn();
    lockPointer(document.querySelector('#view'));
  }

  function sky(){
    const n=2600, pos=new Float32Array(n*3);
    for(let i=0;i<n;i++){
      const th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1), rr=760+Math.random()*300;
      pos[i*3  ]=Math.sin(ph)*Math.cos(th)*rr;
      pos[i*3+1]=Math.cos(ph)*rr;
      pos[i*3+2]=Math.sin(ph)*Math.sin(th)*rr;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const stars=new THREE.Points(g, new THREE.PointsMaterial({
      color:0xdfe8ff, size:1.8, sizeAttenuation:true }));
    stars.userData.sky=true; G.roomGroup.add(stars);
    const neighbour=new THREE.Mesh(new THREE.SphereGeometry(150,48,32),
      new THREE.MeshLambertMaterial({color:W.night ? 0x3a2a5e : 0x7c5cc4}));
    neighbour.position.set(-520,180,-620);
    neighbour.userData.sky=true; G.roomGroup.add(neighbour);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(230,9,10,64),
      new THREE.MeshBasicMaterial({color:0xcdb4f6, transparent:true, opacity:.42}));
    ring.position.copy(neighbour.position); ring.rotation.set(1.15,0.3,0.2);
    ring.userData.sky=true; G.roomGroup.add(ring);
    /* A star, or the far side of one. VOLTA is a night world — it is the
       club planet, the sky is nearly black and the ground is lit by what is
       coming out of it — so the thing up there is small, cold and a long way
       off, and the light it throws (below) is a moon's rather than a sun's.
       Same two meshes; three numbers apart. */
    const NIGHT=!!W.night;
    const sun=new THREE.Mesh(new THREE.SphereGeometry(NIGHT?16:34,24,18),
      new THREE.MeshBasicMaterial({color:NIGHT?0xbfd0ff:0xfff3d0}));
    sun.position.set(420,300,-420);
    sun.userData.sky=true; G.roomGroup.add(sun);
    /* A halo, so the star is a light source rather than a white circle. */
    const halo=new THREE.Mesh(new THREE.SphereGeometry(NIGHT?34:64,24,18),
      new THREE.MeshBasicMaterial({color:NIGHT?0xa8b8ff:0xffe9b0, transparent:true,
                                   opacity:NIGHT?0.12:0.18,
                                   side:THREE.BackSide, depthWrite:false}));
    halo.position.copy(sun.position);
    halo.userData.sky=true; G.roomGroup.add(halo);
  }
  /* The palette the ground is painted from. Not one green: grass that has
     been rained on, grass that has not, the earth under a worn patch, and
     stone where the ground breaks through. Which one you get is decided by a
     SECOND noise field at a different scale from the height — tie colour to
     height alone and every hill is the same colour at the same altitude,
     which is the thing that makes procedural ground look procedural. */
  /* Six bands, lush to bare, and which six depends on the world: SOIL is set
     by setWorld() from the biome. They are all darker than they look on
     paper, because a lit face here is a colour multiplied by rather more
     than one and a palette picked to read well flat comes out bleached the
     moment the sun is on it. */
  function soilT(dir, h){
    const wet=fbm(dir, 2.7, 2);                    // patches, larger than the hills
    const grit=fbm(dir, 21, 2);                    // and a fine speckle over them
    const t = 1.1 + wet*3.0 + h*1.5 + grit*0.9;    // 0 = lush, 5 = stone
    return { t:Math.max(0, Math.min(SOIL.length-1.001, t)), grit };
  }
  function soilAt(dir, h){
    const { t, grit }=soilT(dir, h);
    const i=Math.floor(t), f=t-i;
    const a=SOIL[i].c, b=SOIL[i+1].c;
    // a little extra speckle so no two neighbouring faces are exactly equal
    const n=1+grit*0.06;
    return [ (a[0]+(b[0]-a[0])*f)*n, (a[1]+(b[1]-a[1])*f)*n, (a[2]+(b[2]-a[2])*f)*n ];
  }
  /* Fine detail belongs in a texture, not in geometry. Twenty thousand little
     meshes at half a metre each read as scattered OBJECTS — at this camera
     distance they looked like a lawn of miniature conifers, then like green
     paving slabs. What actually reads as grass is a repeating grain finer
     than anything you would model, multiplied over the vertex colours: the
     mesh keeps saying which field you are standing in, and this says what the
     ground is made of. */
  function grainTexture(){
    const N=256, c=document.createElement('canvas'); c.width=c.height=N;
    const x=c.getContext('2d');
    x.fillStyle='#ffffff'; x.fillRect(0,0,N,N);
    // blades: short strokes, mostly upright, drawn twice at the seam so it tiles
    for(let i=0;i<2600;i++){
      const px=Math.random()*N, py=Math.random()*N;
      const len=2+Math.random()*5, lean=(Math.random()-0.5)*2.2;
      const g=200+Math.random()*55, dark=Math.random()<0.5;
      x.strokeStyle=dark ? `rgba(${g-70},${g-52},${g-78},0.5)`
                         : `rgba(255,255,${g},0.42)`;
      x.lineWidth=0.6+Math.random()*0.9;
      for(const [ox,oy] of [[0,0],[N,0],[0,N],[-N,0],[0,-N]]){
        x.beginPath(); x.moveTo(px+ox,py+oy); x.lineTo(px+ox+lean, py+oy-len); x.stroke();
      }
    }
    // and a fine speckle under them, so flat light still has something to catch
    const img=x.getImageData(0,0,N,N), d=img.data;
    for(let i=0;i<d.length;i+=4){
      const n=(Math.random()-0.5)*26;
      d[i]=Math.max(0,Math.min(255,d[i]+n));
      d[i+1]=Math.max(0,Math.min(255,d[i+1]+n));
      d[i+2]=Math.max(0,Math.min(255,d[i+2]+n));
    }
    x.putImageData(img,0,0);
    const tex=new THREE.CanvasTexture(c);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.colorSpace=THREE.SRGBColorSpace;
    tex.anisotropy=Math.min(8, G.renderer.capabilities.getMaxAnisotropy?
                               G.renderer.capabilities.getMaxAnisotropy():1);
    tex.repeat.set(150, 75);         // about one tile every thirteen metres
    return tex;
  }
  /* THE GRAIN IS A PHOTOGRAPH NOW: a meadow lawn generated with Higgsfield,
     made seamless, and taken down to grey so the vertex colours still say
     which field you are in — green grass on a green soil band would be
     green twice, and on VOLTA's violet it would be wrong. The drawn grain
     above stays as what you see until it arrives.

     GRASS_GAIN is what keeps the planet the same colour. A multiply map can
     only darken, and one bright enough to average out like the drawn grain
     has to clip its light blades to white — which leaves dark blotches on a
     flat field, like lichen. So the photograph keeps its full contrast and
     the material multiplies it back up: measured, the ground comes out
     within one percent of what it was.

     A tile is about four and a half metres. The drawn one was thirteen,
     which was right for strokes a few pixels long and far too big for a
     photograph of blades: they came out the size of reeds.

     NO NORMAL MAP. One was made from the same image and measured: under
     this sky the hemisphere light does nearly all the work and it moved
     the ground by less than a percent, for another half a megabyte. */
  const GRASS_GAIN=1.79;
  let GRASS=null;
  function grassMaps(mat){
    if(!GRASS){
      const tex=new THREE.TextureLoader().load('ground/grass_grain.jpg?v='+(window.ASSETV||'1'), ()=>{
        tex.ready=true;
        if(GRASS.mat) grassOn(GRASS.mat);           // the ball of whichever world is up
      });
      tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
      tex.repeat.set(450, 225);
      tex.colorSpace=THREE.SRGBColorSpace;
      tex.anisotropy=Math.min(8, G.renderer.capabilities.getMaxAnisotropy?
                                 G.renderer.capabilities.getMaxAnisotropy():1);
      GRASS={ tex, mat:null };
    }
    GRASS.mat=mat;
    if(GRASS.tex.ready) grassOn(mat);
  }
  function grassOn(mat){
    mat.map=GRASS.tex; mat.color.setScalar(GRASS_GAIN); mat.needsUpdate=true;
  }
  function surface(){
    /* The ball RECEIVES shadows and casts none. A sphere three hundred metres
       across, dropped into a shadow camera two hundred metres wide, fills the
       depth map with its own back and every shadow in the world becomes the
       shadow of the planet. */
    const SEG_W=256, SEG_H=160;      // ~4 m a face: fine enough to walk over
    const geo=new THREE.SphereGeometry(PR, SEG_W, SEG_H);
    const pos=geo.attributes.position;
    const col=new Float32Array(pos.count*3);
    const d=new THREE.Vector3();
    for(let i=0;i<pos.count;i++){
      d.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const h=terrainH(d);
      pos.setXYZ(i, d.x*(PR+h), d.y*(PR+h), d.z*(PR+h));
      const c=soilAt(d, h/RELIEF);
      col[i*3]=c[0]; col[i*3+1]=c[1]; col[i*3+2]=c[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col,3));
    // recomputed AFTER displacing, or every hill is lit as though it were flat
    geo.computeVertexNormals();
    const soil=new THREE.MeshLambertMaterial({ vertexColors:true, map:grainTexture() });
    grassMaps(soil);
    const ball=new THREE.Mesh(geo, soil);
    ball.userData.flat=true;
    G.roomGroup.add(ball);
    // a pale cap at each pole, so you can tell you have been somewhere
    [1,-1].forEach(s=>{
      const cg=new THREE.SphereGeometry(PR, 64, 32, 0, Math.PI*2, 0, 0.36);
      const cp=cg.attributes.position;
      for(let i=0;i<cp.count;i++){
        d.set(cp.getX(i), cp.getY(i), cp.getZ(i)).normalize();
        if(s<0) d.negate();                         // the cap is turned below
        const r=PR+terrainH(d)+0.12;                // snow lies ON the ground
        cp.setXYZ(i, cp.getX(i)/PR*r, cp.getY(i)/PR*r, cp.getZ(i)/PR*r);
      }
      cg.computeVertexNormals();
      const c=new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ color:0xdfeef0 }));
      c.userData.flat=true;
      if(s<0) c.rotation.x=Math.PI;
      G.roomGroup.add(c);
    });
  }
  /* ----------------------------------------------------------- the ground
     A sphere of one flat green is a diagram of a planet. What makes ground
     read as ground is that it is never level and never one colour, and both
     of those come from the same place: a height field.

     Value noise on the unit sphere — a hash at each lattice corner, smoothly
     interpolated, four octaves each half the size and half the height of the
     one before. No library, no texture, no fetch: the same direction always
     gives the same number on every machine, which is what lets the mesh and
     the player's feet agree without either one asking the other. */
  /* Math.imul, not `*`: a plain multiply of two large integers in JS lands in
     a double, loses its low bits, and the xor that follows then mixes bits
     that were rounded away. The first version of this returned a mean of
     -0.5 instead of 0 with a fifth of the spread it should have had — the
     whole planet came out flat and one colour, and it looked like the terrain
     code was not running at all. */
  function hash3(i,j,k){
    let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1274126177)
          + Math.imul(W.seed|0, 2654435761);      // a different world, a different landscape
    h = Math.imul(h ^ (h>>>13), 1274126177);
    h = Math.imul(h ^ (h>>>16), 2246822519);
    return ((h ^ (h>>>13)) >>> 0) / 4294967295;
  }
  const fade = t => t*t*(3-2*t);
  function vnoise(x,y,z){
    const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
    const xf=fade(x-xi), yf=fade(y-yi), zf=fade(z-zi);
    let n=0;
    for(let dz=0;dz<2;dz++) for(let dy=0;dy<2;dy++) for(let dx=0;dx<2;dx++){
      const w=(dx?xf:1-xf)*(dy?yf:1-yf)*(dz?zf:1-zf);
      n += w*hash3(xi+dx, yi+dy, zi+dz);
    }
    return n*2-1;                                  // -1 .. 1
  }
  function fbm(dir, freq, octaves){
    let a=1, f=freq, sum=0, norm=0;
    for(let i=0;i<octaves;i++){
      sum += a*vnoise(dir.x*f, dir.y*f, dir.z*f);
      norm += a; a*=0.5; f*=2.07;                  // not exactly 2: avoids a grid
    }
    return sum/norm;
  }
  /* One lattice cell at frequency 5.5 is about sixty metres across on a ball
     this size, and the horizon is fifty — so the largest octave is roughly
     one hill per view, which is what you want. RELIEF is per world: a home
     planet heaves more or less than the hub depending on its seed. */

  function rawHeight(dir){
    const h=fbm(dir, 5.5, 4);
    // squared going up, linear coming down: hills stand on a plain instead of
    // the whole world rolling like a swell
    return (h>0 ? h*h*2.2 : h*0.7)*RELIEF;
  }
  /* Every building stands on level ground, and the FLOOR PLATE already knows
     how to meet a sphere at its rim. So rather than teach the plate about
     hills, the hills stop: this is 0 over a building and its apron, 1 out in
     the country, and the height is simply multiplied by it. Under a building
     the ground IS the sphere, exactly as the plate was written to expect. */
  const PAD_FADE=26;
  /* A building's dir is worked out in build(), and the GROUND is generated
     before build() runs. So this used to see b.dir === null on every
     building, skip every one of them, and flatten nothing at all — the pads
     have been silently doing nothing since terrain went in, and the first
     visible sign was a rectangle of grass growing through the showroom
     floor. Work it out here if nobody has yet; it is two trig calls. */
  const dirOfB = b => b.dir || (b.dir = dirOf(b.lon, b.lat));
  function padK(dir){
    let k=1;
    for(const b of BUILDINGS){
      const d=dir.angleTo(dirOfB(b))*PR;
      /* Half the DIAGONAL. Half the width leaves the plate's four corners
         sticking out past the flattened disc, and the hills come up through
         the showroom floor — which is exactly what a patch of grass growing
         inside the Mechanic turned out to be. */
      const flat=Math.hypot(b.w,b.d)/2 + apronOf(b) + 4;
      if(d>=flat+PAD_FADE) continue;
      if(d<=flat) return 0;
      const t=(d-flat)/PAD_FADE;
      k=Math.min(k, t*t*(3-2*t));
    }
    return k;
  }
  /* ------------------------------------------------------------- basins
     WHERE SOMETHING HAS DUG A HOLE. The launch pad flattens the ground it
     stands on; a plunge pool has to do the opposite and sink it, for exactly
     the same reason — water laid ON a hill is a blue disc pasted over grass,
     with its own edge standing proud and whatever the scatter planted before
     it growing up through the middle.

     Carving it HERE rather than in the mesh is what makes it real: terrainH
     is the collision, the shading, the tree planter and the grass, so one
     subtraction moves all of them at once and none of them can disagree
     about where the bank is. The list is filled in before the ground is
     built, from geometry that does not need the ground to exist. */
  let basins=[];
  /* THE RIM IS THE LOWEST POINT ROUND THE EDGE, and finding it is the whole
     job. Simply subtracting a bowl from the hills leaves a crater whose rim
     follows the hillside — high on the uphill side and low on the downhill
     one — and water poured into that runs straight out of the low side. From
     below you see it as a slab of water standing proud of the grass with
     daylight under its edge, which is exactly what it is.

     So the ground inside a basin is eased down to the LOWEST height anywhere
     on its rim before the bowl is dug out of it. That makes the rim level all
     the way round, which is the only shape that holds water. */
  function seatBasins(){
    for(const b of basins){
      const fr=frameAt(b.dir,0);
      let lo=Infinity;
      for(let i=0;i<32;i++){
        const a=i/32*Math.PI*2;
        const head=fr.right.clone().multiplyScalar(Math.cos(a))
                    .add(fr.fwd.clone().multiplyScalar(Math.sin(a))).normalize();
        const axis=new THREE.Vector3().crossVectors(b.dir, head).normalize();
        const d=b.dir.clone().applyAxisAngle(axis, -b.r/PR).normalize();
        lo=Math.min(lo, rawHeight(d));
      }
      b.rim=lo;
    }
  }
  function basinCut(dir, h){
    for(const b of basins){
      if(b.rim===undefined) continue;
      const off=Math.acos(Math.min(1, dir.dot(b.dir)))*PR;
      if(off>=b.r) continue;
      const u=off/b.r, s=1-u*u;
      /* Level first, dig second. The blend hands the ground back to the
         hillside exactly at the rim, so there is no step at the edge. */
      const blend=u*u*(3-2*u);
      const base=b.rim + (h-b.rim)*blend;
      h=Math.min(h, base - b.depth*s*s);
    }
    return h;
  }
  const nearBasin = (dir, k) =>
    basins.some(b => Math.acos(Math.min(1, dir.dot(b.dir)))*PR < b.r*(k||1));
  /* HOW MUCH STANDING GRASS A SPOT HAS, for meadow.js: the two lush soil
     bands are full of it, it thins out through the dry one, and there is
     none on bare earth or stone — nor on a building's plate or its apron,
     nor in a pool. And the soil colour there, so a clump matches the field
     it is standing in. */
  const lushAt = dir => {
    const k=padK(dir);
    if(k<0.25 || nearBasin(dir, 1.15)) return null;
    const h=terrainH(dir)/RELIEF, { t }=soilT(dir, h);
    const amount=(t<2.2 ? 1 : Math.max(0, 3.2-t)) * Math.min(1, (k-0.25)/0.5);
    return amount>0.02 ? { amount, c:soilAt(dir, h) } : null;
  };
  const terrainH = dir => {
    const k=padK(dir);
    const h = k<=0 ? 0 : rawHeight(dir)*k;
    return basinCut(dir, h);
  };
  /* What the water in a basin may stand at: its rim, less a little. */
  const basinRim = dir => {
    for(const b of basins){
      if(b.rim===undefined) continue;
      if(Math.acos(Math.min(1, dir.dot(b.dir)))*PR < b.r) return b.rim;
    }
    return null;
  };

  /* ------------------------------------------------------------- the floor
     A room is flat and the world is not, and that is a real contradiction,
     not a rounding error: across a hall 64 metres wide the ground falls two
     and a half metres away from a flat floor laid over it.  Walk in and you
     walk down into the stone.

     So the floor is its own surface.  Level over the whole room — a room
     should feel like a room the moment you are in it — and then, in a band
     around the outside, it bends down to meet the ground exactly where the
     ground is.  You walk up an apron onto it instead of stepping over a lip,
     and the same function that shapes the mesh decides how high you stand,
     so what you see and what you walk on cannot drift apart. */
  /* The apron is as long as the drop it has to cover, so a shed does not get
     a castle's forecourt: the ground falls away as the square of the distance
     from the middle, so a small building barely leans at all. */
  const apronOf = b => Math.max(3, Math.min(9, b.w/7));
  /* how far outside the room this point is, in metres; 0 anywhere inside */
  function plateOff(b,x,z){
    const ox=Math.max(0, Math.abs(x)-(b.w/2+1)), oz=Math.max(0, Math.abs(z)-(b.d/2+1));
    return Math.hypot(ox,oz);
  }
  /* the height of that surface, in the building's own frame */
  function plateY(b,x,z){
    const k=Math.min(1, plateOff(b,x,z)/apronOf(b)), s=k*k*(3-2*k);
    const p=Math.hypot(x,z);
    return (Math.sqrt(Math.max(0,PR*PR-p*p))-PR)*s;   // 0 inside, the ground at the rim
  }
  function plate(b){
    const A=apronOf(b), W=b.w+2*(1+A), D=b.d+2*(1+A);
    const geo=new THREE.PlaneGeometry(W, D,
      Math.max(14,Math.round(W/2.5)), Math.max(14,Math.round(D/2.5)));
    geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i), z=pos.getZ(i);
      // the very rim sinks in: the ball is drawn as flats, so its surface sits
      // a little under the true sphere between vertices and a rim laid exactly
      // on the sphere would hover over it
      const rim = Math.abs(x)>W/2-0.01 || Math.abs(z)>D/2-0.01;
      pos.setY(i, plateY(b,x,z) - (rim?0.5:0));
    }
    if(geo.computeVertexNormals) geo.computeVertexNormals();
    const m=new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color:0x8b8f9e}));
    /* A HAIR proud of the ball, not under it. At the exact centre of a
       building the sphere and the tangent plane are the same surface, so a
       plate laid at or below zero leaves a couple of centimetres of grass
       showing through the middle of the room and z-fighting where it does.
       Five centimetres of the player's shoe is invisible; a flickering
       rectangle of lawn in a showroom is not. */
    m.position.y=0.05;
    return m;
  }
  /* How far off the ball the floor is where you are standing — which is what
     you stand on, indoors.  Zero out on the grass, so this is the ordinary
     case costing four dot products. */
  const FLOOR_COS=0.975;
  /* How far below a floor you can be and still be standing on it. */
  const DECK_GRIP=0.5;
  /* Where the lid of a building is, and whether you are over it. The roof
     slab is centred at H+0.4 and is 0.8 thick, so its top is H+0.8; the
     overhang is 0.4 proud of the walls on every side. */
  const roofTopOf = b => (b.H===undefined ? (b.h||9) : b.H) + 0.8;
  const onRoofPlan = (b,x,z) =>
    Math.abs(x) <= b.w/2 + 0.4 && Math.abs(z) <= b.d/2 + 0.4;

  /* THE HIGHEST THING UNDER YOU — not the ground under everything.

     This used to answer with the building's FLOOR whenever you were over
     one, which is right on foot, because on foot you got in through the
     door. In the air it is wrong, and it is the whole reason a roof was a
     hologram: fly over the Mall, let go of the throttle, and you sink
     through two hundred square metres of pastel lid and land on the tiles
     underneath it.

     So it takes the altitude you are ACTUALLY at. Over the footprint and
     above the lid, the lid is the floor; anywhere else nothing has changed.
     The tolerance is what lets you settle onto a roof rather than having to
     arrive at exactly its height. */
  function floorAt(dir, alt){
    /* THE ISLANDS ARE ASKED FIRST, because they are over the top of
       everything else: if you are standing on one, what is under the rest of
       you is a hundred metres of air and then a building. They only answer
       for the column above their own crown, so anywhere else this falls
       straight through to the ground. */
    if(window.ISLANDS && alt!==undefined){
      const deck=ISLANDS.floorAt(dir, alt);
      if(deck!==null && deck!==undefined) return deck;
    }
    for(const b of BUILDINGS){
      if(!b.frame || dir.dot(b.dir)<FLOOR_COS) continue;
      const l=local(b, dir.clone().multiplyScalar(PR));
      if(plateOff(b,l.x,l.z)>=apronOf(b)) continue;
      // altitude is measured along the radius, and the floor is not square to it
      const radial = y => (y+PR)/Math.max(0.5, dir.dot(b.dir)) - PR;
      if(alt!==undefined && onRoofPlan(b,l.x,l.z)){
        const top=radial(roofTopOf(b));
        if(alt >= top-0.4) return top;
      }
      /* ------------------------------------------------- FLOORS INSIDE
         A BUILDING USED TO BE ONE STOREY AND A LID. Everything on this
         planet is a room with a floor at zero and a roof you can land on,
         and for a showroom or a library that is the whole truth. The tower
         is fifty-eight units of it, and "Mr Einstein is up there" is a
         sentence about a place the floor system had no way to express.

         So a building may carry `decks`: slabs at a height, each with a
         footprint in the building's own frame. THE HIGHEST ONE YOU ARE AT
         OR ABOVE WINS, which is the same rule the islands answer by and
         for the same reason — what is under you is the nearest thing
         below you, not the ground under everything.

         AND THE LIFT IS JUST A DECK THAT MOVES. Nothing here knows that:
         it reads `d.y` every frame, so a slab whose height changes carries
         whoever is standing on it, because a grounded walker is pinned to
         whatever this returns. That is the entire lift. */
      if(alt!==undefined && b.decks){
        /* MEASURED AT YOUR OWN RADIUS, the way blocked() measures a wall.

           `l` above is the plan position at GROUND radius, which is what
           the roof test wants. A building is a flat box tangent to a ball,
           so going straight up from a point off its centre carries you
           OUTWARD in the box's own axes: at thirty-five units up on a
           radius of two hundred and forty, a spot six metres from the
           middle of the room is seven metres from it. Walls are tested in
           the spread-out frame and floors were tested in the flat one, so
           the two disagreed by over a metre at the top of the tower — you
           could stand on a deck whose edge you had visually walked past,
           and the same spread pushed a lift rider into the back wall on
           the way up. Same frame for both, and they agree at every
           height. */
        const la=local(b, dir.clone().multiplyScalar(PR+alt));
        let best=null;
        for(const d of b.decks){
          if(la.x < d.x1 || la.x > d.x2 || la.z < d.z1 || la.z > d.z2) continue;
          const top=radial(d.y);
          /* DECK_GRIP is the same half-metre of grace the islands give
             you, so you settle onto a deck rather than having to arrive
             at exactly its height — and stepping off one drops you past
             it. It is also the budget the lift's speed is derived from:
             see liftTick(). */
          if(alt >= top-DECK_GRIP && (best===null || top>best)) best=top;
        }
        if(best!==null) return best;
      }
      return radial(plateY(b,l.x,l.z));
    }
    return terrainH(dir);            // out in the country, the ground is the hills
  }

  /* Scattered over the whole ball, each standing on its own normal — on a
     sphere the far side has to be furnished too, or it reads as a backdrop. */
  /* Is this spot standing in the walk from the landing spot to the door? A
     tree in that corridor is the first thing a student ever sees of this
     world, planted squarely in front of the thing they are being told to
     walk to. Distance to the great circle between the two, and only between
     the two — behind you or past the door does not count. */
  function onPath(dir){
    const b=BUILDINGS[0]; if(!b.frame) return false;
    const a=landingSpot();
    const n=new THREE.Vector3().crossVectors(a, b.dir);
    if(n.lengthSq()<1e-9) return false;
    n.normalize();
    const off=Math.asin(Math.min(1,Math.abs(dir.dot(n))))*PR;
    if(off>13) return false;
    const arc=a.angleTo(b.dir);
    return dir.angleTo(a)<arc+0.06 && dir.angleTo(b.dir)<arc+0.06;
  }
  const floraOf = ()=> FLORA[W.flora||'wood'] || FLORA.wood;
  function scatter(){
    const F=floraOf();
    const trunk=new THREE.MeshLambertMaterial({color:F.trunk});
    /* Emissive rather than lit, on a world where nothing is lighting it. A
       Lambert crystal on VOLTA is a black lump with a rim on it. */
    const leaf = F.glow ? new THREE.MeshBasicMaterial({color:F.leaf})
                        : new THREE.MeshLambertMaterial({color:F.leaf});
    const stone=new THREE.MeshLambertMaterial({color:F.stone});
    /* Four times the surface needs more on it, but every tree is two meshes
       and a school laptop pays for each one — so this is a compromise, and
       rocks (one mesh) get the larger share. */
    /* Four hundred over the whole ball rather than eight hundred and twenty.
       A tree every so often is scenery; a tree every few paces is scrub.
       PER UNIT OF SURFACE, though — four hundred spread over VOLTA is seven
       times the density it is on Senio, and a wood you cannot walk through is
       not scenery either. */
    const n=Math.round(400*(F.density||1)*Math.min(1, (PR*PR)/(320*320)));
    for(let i=0;i<n;i++){
      const th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
      const dir=V(Math.sin(ph)*Math.cos(th), Math.cos(ph), Math.sin(ph)*Math.sin(th));
      if(BUILDINGS.some(b=>dir.angleTo(dirOf(b.lon,b.lat))*PR < b.w*1.2)) continue;
      if(nearBasin(dir, 1.15)) continue;      // and not standing in the pool
      if(onPath(dir)) continue;               // and not in the way of the door
      const g=new THREE.Group();
      if(Math.random()<F.tall){
        const h=3+Math.random()*3;
        const t1=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.42,h,6), trunk);
        t1.position.y=h/2; g.add(t1);
        /* A crown or a point. Both are one mesh on top of one stalk; the
           difference between a tree and a spire is which solid it is and
           whether it is lit from outside or from within. */
        const c = F.glow
          ? new THREE.Mesh(new THREE.OctahedronGeometry(1.1+Math.random()*0.7, 0), leaf)
          : new THREE.Mesh(new THREE.IcosahedronGeometry(1.5+Math.random(), 0), leaf);
        if(F.glow) c.scale.set(0.55, 1.9+Math.random(), 0.55);
        c.position.y=h+0.9; g.add(c);
      } else {
        const s=new THREE.Mesh(new THREE.IcosahedronGeometry(0.7+Math.random()*1.2,0), stone);
        s.position.y=0.4; s.rotation.set(Math.random(),Math.random(),Math.random()); g.add(s);
      }
      stand(g, dir, Math.random()*6, terrainH(dir));
      G.roomGroup.add(g);
    }
  }

  /* ---------------------------------------------------------- ground cover
     Trees and boulders give a landscape its shape; what gives it TEXTURE is
     the small stuff underfoot, and there has to be a great deal of it. Twelve
     thousand separate meshes would be twelve thousand draw calls and the end
     of the frame rate, so each kind is one InstancedMesh: one geometry, one
     material, one call, a matrix each.

     Weighted toward the town, because that is where the hours are spent and
     the far side of a planet does not need flowers nobody will stand in. */
  const townDir=()=>{
    const v=V(0,0,0);
    BUILDINGS.forEach(b=>v.add(b.dir||dirOf(b.lon,b.lat)));
    return v.normalize();
  };
  function plant(geo, tints, count, opts){
    const o=opts||{};
    const town=townDir(), fr=frameAt(town,0);
    const mesh=new THREE.InstancedMesh(geo,
      o.glow ? new THREE.MeshBasicMaterial({ vertexColors:false })
             : new THREE.MeshLambertMaterial({ vertexColors:false }), count);
    mesh.castShadow=false; mesh.receiveShadow=true;   // too small to be worth a shadow
    mesh.userData.flat=true;
    const m=new THREE.Matrix4(), q=new THREE.Quaternion(), col=new THREE.Color();
    let n=0, tries=0;
    while(n<count && tries<count*6){
      tries++;
      let dir;
      if(Math.random()<(o.nearTown!==undefined?o.nearTown:0.72)){
        // somewhere in a disc round the town, denser at the middle
        const a=Math.random()*Math.PI*2, r=Math.sqrt(Math.random())*(o.townR||240)/PR;
        const ax=fr.right.clone().multiplyScalar(Math.cos(a))
                 .add(fr.fwd.clone().multiplyScalar(Math.sin(a))).normalize();
        dir=town.clone().applyAxisAngle(ax, r).normalize();
      } else {
        const th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
        dir=V(Math.sin(ph)*Math.cos(th), Math.cos(ph), Math.sin(ph)*Math.sin(th));
      }
      // nothing grows through a floor, or across the walk to the front door
      if(BUILDINGS.some(b=>b.dir && dir.angleTo(b.dir)*PR <
           Math.max(b.w,b.d)/2 + apronOf(b) + 2)) continue;
      /* No onPath() here. That rule exists so a TREE does not stand in the
         middle of the first instruction a student is given, and applying it to
         ankle-high grass shaved a bald thirteen-metre runway up to the gate —
         the one stretch of ground everybody looks at. */
      const f=frameAt(dir, Math.random()*Math.PI*2);
      const sc=(o.min||0.7)+Math.random()*((o.max||1.4)-(o.min||0.7));
      m.makeBasis(f.right, f.up, f.fwd);
      q.setFromRotationMatrix(m);
      m.compose(dir.clone().multiplyScalar(PR + terrainH(dir)), q,
                V(sc, sc*(0.7+Math.random()*0.8), sc));
      mesh.setMatrixAt(n, m);
      const t=tints[(Math.random()*tints.length)|0];
      col.setHex(t); col.offsetHSL(0, 0, (Math.random()-0.5)*0.10);
      mesh.setColorAt(n, col);
      n++;
    }
    mesh.count=n;                       // whatever actually found a spot
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
    G.roomGroup.add(mesh);
    return n;
  }
  /* NO GRASS TUFTS. Three shapes were tried and every one of them failed the
     same way: a half-metre cone at this camera distance is not a blade of
     grass, it is a small conifer, and nine thousand of them is a model
     railway you have to walk through. Grass is the GRAIN in the ground
     texture — a repeating detail finer than anything worth modelling — and
     it always was. Standing objects on top of it only argued with it.

     (What stands up out of it now is meadow.js, and it is not a shape: it
     is a photograph of a clump on two crossed panels, only round your feet,
     pushed over as you walk through it. That is grass; a cone never was.)

     What is left is deliberately thin. A field reads as a field because of
     what it is made of, not because of how much is standing up in it, and
     everything scattered here has to earn its place by being far enough from
     the last one to be seen as a separate thing. */
  function cover(){
    const F=floraOf();
    /* Both counts are for a world the size of Senio. Scaled by area, because
       nine hundred pebbles on a ball a third the width is a gravel pit. */
    const per = k => Math.round(k*Math.min(1, (PR*PR)/(320*320)));
    // pebbles, sparse, so bare ground has something to catch the light
    const peb=new THREE.IcosahedronGeometry(0.24, 0);
    peb.translate(0, 0.12, 0);
    plant(peb, F.pebble, per(900),
          {min:0.7, max:1.9, townR:Math.min(320,PR), nearTown:0.5});
    /* And the occasional thing in flower, so the ground is not only green —
       or on VOLTA, the occasional thing that is lit, so the ground is not
       only dark. Same instanced mesh, one flag apart. */
    const bud=new THREE.IcosahedronGeometry(0.16, 0);
    bud.translate(0, 0.62, 0);
    plant(bud, F.bud, per(420),
          {min:0.8, max:1.4, townR:Math.min(260,PR), nearTown:0.7, glow:F.budGlow});
  }

  /* ------------------------------------------------------- ray-traced light
     A shadow map answers one question — is the sun blocked? — for one light,
     every frame. It cannot answer the other one: how much of the SKY can this
     square inch see at all? That is what darkens the inside corner of a room,
     the strip of grass against a wall, the ground under a tree. No amount of
     shadow mapping produces it, and it is most of what makes a rendered scene
     look like it has been lit rather than coloured in.

     So this traces rays. Actual rays: from each point on the ground and each
     point on a building's floor, a fan of them is fired up into the sky, and
     what fraction come back blocked is baked into that vertex's colour. It
     happens ONCE, when the world is built, because nothing here moves — the
     castle will not walk off its plate — and one second at load buys a
     lighting term that would otherwise cost every frame forever.

     Real-time ray tracing this is not, and on a school laptop it could not
     be. Tracing the rays once and keeping the answer is how this was always
     done before the hardware existed to do it per frame. */
  /* These four numbers are the whole cost. The first pass used fourteen rays
     reaching sixteen metres over a two-hundred-and-thirty-metre town and took
     four and a half seconds, which is four and a half seconds of a child
     staring at nothing. Occlusion is a LOCAL effect — a wall eleven metres
     away is not what darkens a corner — so the reach comes down, the grid
     cell comes down with it, and the bake gets an order of magnitude cheaper
     for a result you cannot tell apart. */
  const AO_RAYS=10, AO_REACH=11, AO_CELL=14;
  /* And only NEAR A BUILDING. Out in a field the answer is "all of it" for
     every vertex, and paying four milliseconds a vertex to be told the sky is
     open is the whole reason the first bake took four and a half seconds. */
  const AO_SKIRT=30;
  /* Casting every ray against every mesh in the world is the naive way and it
     is thousands of times too slow. Occluders go into a coarse grid on the
     sphere first, so a ray only ever asks the handful of things standing near
     where it started. */
  function occluderGrid(cell){
    const grid=new Map(), meshes=[];
    /* Buildings only. A tree does darken the grass under it, but the trees are
       eight hundred groups spread over the whole world and putting them in
       here quadrupled the candidate list in every cell for a shadow nobody
       walks up to and inspects. */
    BUILDINGS.forEach(b=>{ if(!b.g) return; b.g.traverse(m=>{
      if(!m.isMesh || m.isInstancedMesh) return;
      const u=m.userData||{};
      if(u.sky || u.lid) return;              // not the roof, and not the floor
      if(!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      meshes.push(m);
    }); });
    const c=new THREE.Vector3();
    meshes.forEach(m=>{
      m.getWorldPosition(c);
      const bs=m.geometry.boundingSphere;
      // kept on the mesh so a ray can reject it exactly, not just by its cell
      m.userData.aoC=c.clone();
      m.userData.aoR=(bs?bs.radius:1)*Math.max(m.scale.x,m.scale.y,m.scale.z);
      const r=m.userData.aoR+AO_REACH;
      const d=c.clone().normalize();
      const span=Math.ceil(r/cell);
      const key=(a,b)=>a+','+b;
      const ci=Math.round(Math.asin(Math.max(-1,Math.min(1,d.y)))*PR/cell);
      const cj=Math.round(Math.atan2(d.x,d.z)*PR/cell);
      for(let i=-span;i<=span;i++) for(let j=-span;j<=span;j++){
        const k=key(ci+i, cj+j);
        let a=grid.get(k); if(!a){ a=[]; grid.set(k,a); }
        a.push(m);
      }
    });
    return {
      /* The cell is a first cut; this is the second. A cell near the castle
         holds a couple of hundred meshes and most of them are nowhere near
         this particular square metre of grass — the exact sphere test drops
         them for the price of one subtraction each. */
      near(p){
        const d=p.clone().normalize();
        const ci=Math.round(Math.asin(Math.max(-1,Math.min(1,d.y)))*PR/cell);
        const cj=Math.round(Math.atan2(d.x,d.z)*PR/cell);
        const all=grid.get(ci+','+cj);
        if(!all) return EMPTY;
        const out=[];
        for(const m of all){
          const R=m.userData.aoR+AO_REACH;
          if(m.userData.aoC.distanceToSquared(p) < R*R) out.push(m);
        }
        return out;
      },
      count:meshes.length
    };
  }
  const EMPTY=[];
  /* A fan of directions round a normal, weighted the way light arrives:
     more of them near straight up, fewer near the horizon. */
  function hemiRays(n){
    const out=[];
    for(let i=0;i<n;i++){
      const t=(i+0.5)/n;                       // golden-angle spiral: even, no clumps
      const r=Math.sqrt(t), a=i*2.399963;
      out.push([r*Math.cos(a), Math.sqrt(Math.max(0,1-t)), r*Math.sin(a)]);
    }
    return out;
  }
  function bakeAO(){
    const t0=performance.now();
    const grid=occluderGrid(AO_CELL);
    const ray=new THREE.Raycaster(); ray.far=AO_REACH;
    const dirs=hemiRays(AO_RAYS);
    const P=new THREE.Vector3(), N=new THREE.Vector3(), D=new THREE.Vector3();
    let lit=0, samples=0;

    /* how open the sky is above this point: 1 in the open, 0 in a corner */
    function sky(p, up, side, fwd, skipSelf){
      const near=grid.near(p);
      if(!near.length) return 1;            // open country: nothing to trace against
      let clear=0;
      for(const [x,y,z] of dirs){
        D.set(0,0,0).addScaledVector(side,x).addScaledVector(up,y).addScaledVector(fwd,z).normalize();
        ray.set(P.copy(p).addScaledVector(up,0.06), D);
        const hit=ray.intersectObjects(near, false);
        let blocked=false;
        for(const h of hit){ if(h.object!==skipSelf){ blocked=true; break; } }
        if(!blocked) clear++;
      }
      samples++;
      return clear/dirs.length;
    }
    /* Paint it into a mesh's own vertex colours. AO never brightens: it can
       only take light away, and it is floored so a corner goes dim, not black. */
    function paint(mesh, only){
      const g=mesh.geometry, pos=g.attributes.position;
      let col=g.attributes.color;
      if(!col){
        col=new THREE.BufferAttribute(new Float32Array(pos.count*3),3);
        const base=mesh.material.color;
        for(let i=0;i<pos.count;i++) col.setXYZ(i, base.r, base.g, base.b);
        g.setAttribute('color', col);
        mesh.material=mesh.material.clone();
        mesh.material.vertexColors=true;
        mesh.material.color.setRGB(1,1,1);
      }
      const v=new THREE.Vector3(), w=new THREE.Vector3();
      mesh.updateMatrixWorld(true);
      for(let i=0;i<pos.count;i++){
        v.fromBufferAttribute(pos,i);
        w.copy(v).applyMatrix4(mesh.matrixWorld);
        if(only && !only(w)) continue;
        const up=w.clone().normalize();
        const f=frameAt(up,0);
        const k=0.40+0.60*sky(w, up, f.right, f.fwd, mesh);
        lit++;
        col.setXYZ(i, col.getX(i)*k, col.getY(i)*k, col.getZ(i)*k);
      }
      col.needsUpdate=true;
    }

    // the ground, but only the skirt of grass round each building
    const ball=G.roomGroup.children.find(o=>o.isMesh && o.userData.flat &&
      o.geometry.attributes.color);
    if(ball) paint(ball, w => {
      const d=w.clone().normalize();
      return BUILDINGS.some(b => b.dir &&
        d.angleTo(b.dir)*PR < Math.max(b.w,b.d)/2 + apronOf(b) + AO_SKIRT);
    });
    // and every building's floor, where the corners are
    BUILDINGS.forEach(b=>{
      if(!b.g) return;
      const plate=b.g.children.find(o=>o.isMesh && o.geometry.type==='PlaneGeometry');
      if(plate) paint(plate);
    });
    return { ms:Math.round(performance.now()-t0), vertices:lit, rays:samples*AO_RAYS,
             occluders:grid.count };
  }

  function signTexture(text, tint){
    const c=document.createElement('canvas'); c.width=512; c.height=96;
    const x=c.getContext('2d');
    x.fillStyle='rgba(10,16,32,.92)'; x.fillRect(0,0,512,96);
    x.strokeStyle='#'+tint.toString(16).padStart(6,'0');
    x.lineWidth=6; x.strokeRect(3,3,506,90);
    x.fillStyle='#eef3ff'; x.textAlign='center'; x.textBaseline='middle';
    /* Shrink to fit rather than let fillText's maxWidth condense the glyphs:
       "CONTROL DE MISIONES" is half again as long as "MISSION CONTROL". */
    fitFont(x, text, 42, 470);
    x.fillText(text, 256, 52);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
  }
  function panelTex(emoji, label, bg){
    const c=document.createElement('canvas'); c.width=c.height=256;
    const x=c.getContext('2d');
    x.fillStyle=bg; x.fillRect(0,0,256,256);
    x.strokeStyle='rgba(255,255,255,.3)'; x.lineWidth=6; x.strokeRect(5,5,246,246);
    x.textAlign='center';
    x.font='92px system-ui,"Apple Color Emoji","Segoe UI Emoji"';
    x.fillText(emoji,128,130);
    x.fillStyle='#eef3ff'; x.font='bold 24px '+uiFont();
    /* A newline in the label is a break the caller MEANT — the price under
       the name, not wrapped in beside it. Before this, wrapping was purely by
       width and "Clover 340 ◆" came out as one run of words. */
    let y=182;
    String(label).split('\n').forEach(para=>{
      let line='';
      para.split(' ').forEach(w=>{
        if(x.measureText(line+' '+w).width>224 && line){ x.fillText(line,128,y); y+=29; line=w; }
        else line = line ? line+' '+w : w;
      });
      x.fillText(line,128,y); y+=29;
    });
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
  }

  /* --------------------------------------------------------- the buildings
     Everything a building owns lives in the building's own tangent frame —
     its walls, its panels and the boxes that stop you walking through them.
     That is what makes a building on the far side of the world no different
     from one at your feet. */
  /* ------------------------------------------------------- the workshop
     The one hall on Senio with nothing in it. It is where you build things
     with your class, so it is furnished like somewhere things get built:
     benches down both sides with work half-done on them, racks of stock
     against the back wall, and a clear floor in the middle because that is
     where the building actually happens. */
  function workshopRoom(g, b, hw, hd){
    const wood=new THREE.MeshLambertMaterial({color:0x6b4f3a});
    const dark=new THREE.MeshLambertMaterial({color:0x4a3726});
    const steel=new THREE.MeshLambertMaterial({color:0x8a93a8});
    const PARTS=[0xffb4a2,0x8fd3ff,0xa8e6cf,0xcdb4f6,0xffe9a8];
    const add=(geo,mat,x,y,z)=>{ const m=new THREE.Mesh(geo,mat);
                                 m.position.set(x,y,z); g.add(m); return m; };

    [-1,1].forEach(sx=>{
      const x=sx*(hw-2.6);
      for(let i=0;i<3;i++){
        const z=-hd+5 + i*(b.d-10)/2.6;
        // a bench: top, two trestles, and a tool rail behind it
        add(new THREE.BoxGeometry(2.0,0.30,5.0), wood, x, 1.15, z);
        [-1,1].forEach(sz=>add(new THREE.BoxGeometry(0.35,1.0,0.35), dark,
                               x, 0.5, z+sz*2.0));
        add(new THREE.BoxGeometry(0.25,1.5,4.6), steel, x+sx*0.85, 2.1, z);
        /* HALF-BUILT THINGS. A clean bench is furniture; a bench with three
           mismatched blocks on it is somebody's afternoon. */
        for(let k=0;k<3;k++){
          const c=PARTS[(i*3+k)%PARTS.length], h=0.5+((i+k)%3)*0.35;
          add(new THREE.BoxGeometry(0.7,h,0.7), new THREE.MeshLambertMaterial({color:c}),
              x-sx*0.3, 1.3+h/2, z-1.6+k*1.6);
        }
      }
    });

    // stock racks along the back, loaded with the same blocks the benches use
    for(let i=0;i<4;i++){
      const x=-hw+7 + i*(b.w-14)/3, z=-hd+1.9;
      add(new THREE.BoxGeometry(4.0,0.25,1.4), steel, x, 1.5, z);
      add(new THREE.BoxGeometry(4.0,0.25,1.4), steel, x, 3.0, z);
      [-1,1].forEach(sx=>add(new THREE.BoxGeometry(0.3,3.2,1.4), steel, x+sx*1.85, 1.6, z));
      for(let k=0;k<3;k++)
        add(new THREE.BoxGeometry(0.9,0.9,0.9),
            new THREE.MeshLambertMaterial({color:PARTS[(i+k)%PARTS.length]}),
            x-1.2+k*1.2, (k%2?3.6:2.1), z);
    }
  }

  /* ----------------------------------------------------- dressing a shed
     WHAT MAKES A BOX A BUILDING.

     Every one of these was four walls, a floor and a lid. From the air that
     is a coloured rectangle; from the ground it is a wall with a hole in it.
     Nothing below changes the footprint, the doorway or where you may walk —
     it is the parts a real building has that a box does not, and each one is
     doing a specific job:

       a plinth     buildings stand ON something. Sunk into the apron and
                    proud of the walls, so the thing rises out of the ground
                    instead of being set down on top of it.
       pilasters    a corner needs a vertical, or a long wall reads as a
                    plane. These go in the collision, because you can see
                    them and you must not walk through them.
       a cornice    the line that says where wall stops and roof starts.
                    Without it the lid looks balanced rather than carried.
       windows      lit, in rows. This is the one that matters most from the
                    air: a dark rectangle is a crate, and a rectangle with
                    warm windows in it is somewhere with people inside.
       steps        a door you step UP into is a threshold. Flush with the
                    ground, it is a hole.

     All of it is built from four shared materials rather than one per mesh:
     a building is forty-odd extra boxes and forty-odd extra materials would
     be forty-odd extra shader compiles on a machine that has none to spare. */
  function dress(b, g, hw, hd, H, DOOR){
    const stone=new THREE.MeshLambertMaterial({
      color:new THREE.Color(b.wall).multiplyScalar(0.55) });
    const trim =new THREE.MeshLambertMaterial({color:b.roof});
    const sill =new THREE.MeshLambertMaterial({
      color:new THREE.Color(b.roof).multiplyScalar(0.35) });
    /* Basic, not Lambert: a window is a hole with a light behind it, so it
       must not take its brightness from the sun outside. */
    const glass=new THREE.MeshBasicMaterial({color:0xffe4a8});
    const add=(geo,mat,x,y,z)=>{ const m=new THREE.Mesh(geo,mat);
                                 m.position.set(x,y,z); g.add(m); return m; };

    /* THE PLINTH. It reaches well below the floor because the apron slopes
       away on every side — a base that stopped at ground level would show
       its own underside downhill. */
    add(new THREE.BoxGeometry(b.w+2.2, 3.2, b.d+2.2), stone, 0, -1.45, 0);
    add(new THREE.BoxGeometry(b.w+1.4, 0.42, b.d+1.4), trim,  0,  0.21, 0);

    // corner pilasters, and a cap on each so they finish rather than stop
    const PW=Math.min(2.4, Math.max(1.4, b.w*0.05)), PH=H+1.1;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
      const x=sx*hw, z=sz*hd;
      add(new THREE.BoxGeometry(PW,PH,PW), stone, x, PH/2, z);
      add(new THREE.BoxGeometry(PW+0.55,0.55,PW+0.55), trim, x, PH+0.27, z);
      b.solids.push({x1:x-PW/2,x2:x+PW/2,z1:z-PW/2,z2:z+PW/2,y1:0,y2:PH});
    });

    // the cornice, carrying the eaves
    add(new THREE.BoxGeometry(b.w+1.7, 0.75, b.d+1.7), trim, 0, H-0.38, 0);

    /* WINDOWS. One row under about fourteen metres, two above it, which is
       the difference between a shed and a hall. They are three boxes each —
       a recess, a pane and a sill — and they stop short of the corners so
       they never grow out of a pilaster. */
    const rows = H>14 ? 2 : 1;
    const winH = Math.min(3.0, (H-3)/(rows+0.7));
    function window_(x,y,z,wide,along){
      const w = along==='x' ? wide : 0.5, d = along==='x' ? 0.5 : wide;
      add(new THREE.BoxGeometry(w+0.9, winH+0.9, d+0.9), sill,  x, y, z);
      add(new THREE.BoxGeometry(w, winH, d),             glass, x, y, z);
      add(new THREE.BoxGeometry(w+1.2, 0.35, d+1.2),     trim,  x, y-winH/2-0.5, z);
    }
    /* A ROW EVENLY UP THE WALL, not bunched at the bottom. The first version
       started the lowest row at 3.2 and stepped up by the window height,
       which on an eighteen-metre keep put both rows in the bottom half and
       left seven metres of blank blue above them. */
    const yOf = r => H*(rows===1 ? 0.52 : (0.30 + r*0.34));
    for(let r=0;r<rows;r++){
      const y=yOf(r);
      const runX = b.d - PW*2 - 4;
      const nX = Math.max(2, Math.round(runX/7));
      for(let i=0;i<nX;i++){
        const z = -runX/2 + runX*(i+0.5)/nX;
        window_( hw+0.05, y, z, 2.6, 'z');
        window_(-hw-0.05, y, z, 2.6, 'z');
      }
      const runZ = b.w - PW*2 - 4;
      const nZ = Math.max(2, Math.round(runZ/7));
      for(let i=0;i<nZ;i++){
        const x = -runZ/2 + runZ*(i+0.5)/nZ;
        window_(x, y, -hd-0.05, 2.6, 'x');
      }
      /* THE FRONT, WHICH IS THE FACE EVERYBODY ACTUALLY WALKS UP TO. The
         doorway is a nine-metre gap in a wall that can be sixty wide, so
         "only above the door" left the front blank on every building big
         enough to have a front. Anything clear of the opening gets a window;
         only the strip directly over the doorway waits for the height. */
      const DOORHALF=9/2+2.0;
      for(let i=0;i<nZ;i++){
        const x = -runZ/2 + runZ*(i+0.5)/nZ;
        if(Math.abs(x) < DOORHALF && y < DOOR+winH/2+1.0) continue;
        window_(x, y, hd+0.05, 2.6, 'x');
      }
    }

    /* THE THRESHOLD. Three courses stepping down into the apron, and a
       surround so the doorway is framed rather than punched. They are not in
       the collision: the apron already ramps you up to the floor, and a step
       you could walk into is a step that stops you in the doorway. */
    for(let i=0;i<3;i++){
      const out=1.1+i*1.15;
      add(new THREE.BoxGeometry(9+2.4+i*1.4, 0.5, out*2), stone,
          0, -0.25-i*0.5, hd+out);
    }
    [-1,1].forEach(sx=>{
      add(new THREE.BoxGeometry(1.5, DOOR+1.6, 1.5), stone, sx*(9/2+0.75), (DOOR+1.6)/2, hd);
    });
    add(new THREE.BoxGeometry(9+3.0, 1.1, 1.6), trim, 0, DOOR+1.6, hd);
    /* A LAMP EITHER SIDE OF THE DOOR, because the one thing every one of
       these buildings is for is being walked into. */
    [-1,1].forEach(sx=>{
      add(new THREE.BoxGeometry(0.7,0.7,0.7), glass, sx*(9/2+0.75), DOOR+0.3, hd+1.0);
    });
  }

  /* -------------------------------------------------------- the inside
     A GENERIC ROOM, under whatever the building puts in it. Four of these
     halls have their own furniture — the console horseshoe, the wardrobe,
     the showroom, the reading room — and the rest had bare walls and a bare
     floor, which is what a room looks like before anyone moves in.

     This is the part that is the same in all of them: a floor with a border
     rather than one flat colour, a rail round the walls at shoulder height,
     beams overhead, and light coming off the walls instead of out of the
     air. It goes in FIRST, so anything a specific room adds stands on top. */
  function indoors(b, g, hw, hd, H, gap){
    const wood =new THREE.MeshLambertMaterial({color:new THREE.Color(b.wall).multiplyScalar(0.7)});
    const trim =new THREE.MeshLambertMaterial({color:b.roof});
    const warm =new THREE.MeshBasicMaterial({color:0xffe4a8});
    const add=(geo,mat,x,y,z,rot)=>{ const m=new THREE.Mesh(geo,mat);
      m.position.set(x,y,z); if(rot) m.rotation.y=rot; g.add(m); return m; };

    /* A BORDER ON THE FLOOR. Not decoration for its own sake: a room whose
       floor runs edge to edge in one colour has no readable size, and these
       halls are sixty metres across. */
    add(new THREE.BoxGeometry(b.w-2.5, 0.14, b.d-2.5), trim, 0, 0.07, 0);
    add(new THREE.BoxGeometry(b.w-5.5, 0.16, b.d-5.5), wood, 0, 0.09, 0);
    /* and a runner out to the door, so the inlay does not stop in mid-air
       where somebody is about to walk in */
    add(new THREE.BoxGeometry(gap-1.0, 0.15, 3.4), wood, 0, 0.08, hd-1.6);

    /* A RAIL ROUND THE WALLS, AND A SKIRTING UNDER IT — ROUND THE WALLS,
       which is not the same as across the room. The first version ran both
       of them the full width of all four sides, and the front wall of this
       building is a sixty-metre run with a nine-metre HOLE in the middle of
       it: the rail crossed the doorway at chest height and the skirting lay
       over the threshold, so walking into Mission Control meant walking
       through two blue sticks. A wall with a door in it is two walls. */
    const run=[[0,-hd+0.6, b.w-1.6, 1],                 // back
               [-hw+0.6, 0, 1, b.d-1.6],[ hw-0.6, 0, 1, b.d-1.6]];   // sides
    const side=(b.w-gap)/2;                             // the front, either side
    run.push([-(gap/2+side/2), hd-0.6, side-1.2, 1]);
    run.push([ (gap/2+side/2), hd-0.6, side-1.2, 1]);
    run.forEach(([x,z,w,d])=>{
      add(new THREE.BoxGeometry(w===1?0.5:w, 0.5, d===1?0.5:d), trim, x, 3.1, z);
      add(new THREE.BoxGeometry(w===1?0.7:w, 0.7, d===1?0.7:d), wood, x, 0.35, z);
    });

    /* BEAMS. A ceiling you can read the height of is a ceiling; a flat lid
       eighteen metres up is a sky with a colour. */
    const nB=Math.max(3, Math.round(b.d/9));
    for(let i=0;i<nB;i++){
      const z=-hd+ (i+0.5)*(b.d/nB);
      add(new THREE.BoxGeometry(b.w-1.2, 0.8, 1.0), wood, 0, H-1.1, z);
    }

    /* SCONCES, down both long walls. Three point lights, not one per sconce:
       the glowing box is what you SEE, and light enough of them and a lab
       machine starts dropping frames for a difference nobody can name. */
    const nL=Math.max(2, Math.round(b.d/11));
    for(let i=0;i<nL;i++){
      const z=-hd+ (i+0.5)*(b.d/nL);
      [-1,1].forEach(sx=>{
        add(new THREE.BoxGeometry(0.5,1.3,0.5), trim, sx*(hw-0.9), 4.6, z);
        add(new THREE.BoxGeometry(0.8,0.8,0.8), warm, sx*(hw-1.3), 5.4, z);
      });
    }
    const glow=new THREE.PointLight(0xffe0b0, 90, Math.max(b.w,b.d), 1.6);
    glow.position.set(0, H*0.6, 0); g.add(glow);
  }

  function build(b){
    const dir=dirOf(b.lon, b.lat);
    const g=new THREE.Group();
    const f=stand(g, dir, 0);
    G.roomGroup.add(g);
    b.g=g; b.dir=dir; b.frame=f; b.solids=[]; b.decks=[];
    b.H=b.h||9;            // what floorAt() measures the lid from
    g.userData.b=b;

    /* Height is the building's own business now. A hall with six statues in
       it needs a ceiling you notice; a shed does not. */
    const hw=b.w/2, hd=b.d/2, H=b.h||9, DOOR=b.door||6;
    const wall=new THREE.MeshLambertMaterial({color:b.wall});
    // local: +x right, +y up off the surface, +z the way it faces
    const put=(x,z,w,d,h,up0)=>{
      const hh=h||H, base=up0||0;
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,hh,d), wall);
      m.position.set(x, base+hh/2, z); g.add(m);
      b.solids.push({x1:x-w/2, x2:x+w/2, z1:z-d/2, z2:z+d/2, y1:base, y2:base+hh});
    };
    const flr=plate(b); flr.userData.lid=true; g.add(flr);

    put(0,-hd, b.w, 1);
    put(-hw,0, 1, b.d);
    put( hw,0, 1, b.d);
    const gap=9, side=(b.w-gap)/2;
    put(-(gap/2+side/2), hd, side, 1);
    put( (gap/2+side/2), hd, side, 1);
    put(0, hd, gap, 1, H-DOOR, DOOR);        // lintel, above head height

    /* A DARK UNDERSIDE. A roof is a pastel slab so that it reads from the
       air and across a field, and on Senio that is the only way you ever see
       one. VOLTA is small enough that standing thirty metres from a building
       puts your eye well below its eaves — the ground has curved that far in
       thirty metres — and the first thing you saw of the Gym was two hundred
       square metres of the wrong side of its lid. The overhang is trimmed and
       the -y face is painted the shadow it should have been. */
    const lid=new THREE.MeshLambertMaterial({color:b.roof});
    /* A twentieth, and that is not a typo: THREE.Color holds linear values
       and prints sRGB ones, so scaling by 0.05 here comes out around 24% on
       screen. Scaling by "0.22" gave a mid pink. */
    const under=new THREE.MeshLambertMaterial({
      color:new THREE.Color(b.roof).multiplyScalar(0.05) });
    const roof=new THREE.Mesh(new THREE.BoxGeometry(b.w+0.8, 0.8, b.d+0.8),
      [lid, lid, lid, under, lid, lid]);       // +x -x +y -y +z -z
    roof.position.y=H+0.4;
    /* Marked as a lid, which means the ray-traced pass ignores it. A roof
       blocks the sky over the whole room, so counting it turns the entire
       hall floor uniformly dark — physically right for a windowless keep, and
       completely wrong for a room the game lights as though it were daylit.
       What should darken this floor is its WALLS, at the edges. */
    roof.userData.lid=true;
    g.add(roof);

    // a nameplate, not a billboard: it has to sit between the towers rather
    // than across them, and the castle is wider than the sheds are
    const W=Math.min(b.w*0.62, 26), HH=W*(96/512);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(W,HH),
      new THREE.MeshBasicMaterial({map:signTexture(b.em+'  '+t(b.name), b.roof),
                                   transparent:true, side:THREE.DoubleSide}));
    sign.position.set(0, H+1.2+HH/2, hd+0.25); g.add(sign);

    /* EVERY building gets a base, corners, eaves, windows and a threshold,
       and every one gets a floor with a border and light off its walls. The
       rooms that furnish themselves do it on top of this rather than instead
       of it — the Mall was never short of a wardrobe, it was short of a
       skirting board. */
    dress(b, g, hw, hd, H, DOOR);
    indoors(b, g, hw, hd, H, gap);

    if(b.id==='missions'){
      castle(b, g, hw, hd, H, put);
      /* Round the room, not in a rank. Six consoles in a line is a corridor
         you walk past; a horseshoe is a hall you stand in the middle of, and
         every one of them turns to face whoever has just come through the
         gate. Two along the back and two down each side. */
      /* THE MIDDLE OF THE BACK WALL IS THE BEST SEAT IN THE HALL — it is what
         you are looking at the moment you come through the gate, framed by
         the runner on the floor. The newest mission gets it. The Swarm went
         in at the end of the list and so got the last spot in this array,
         which is level with the doorway and turned obliquely towards it: you
         walk straight past it on your way in and have to turn round to find
         out it is there at all. */
      const spots=[
        { x:-13, z:-hd+11, r:0 },           // back wall, facing the door
        { x: 13, z:-hd+11, r:0 },
        { x: hw-8, z: 22, r:-Math.PI/4 },   // beside the gate, on the right
        { x:-hw+8, z: 22, r: Math.PI/4 },   // and one more down the left
        { x:-hw+8, z:-10, r: Math.PI/4 },   // down the left, turned toward the gate
        { x:-hw+8, z:  7, r: Math.PI/4 },
        { x: hw-8, z:-10, r:-Math.PI/4 },   // and down the right
        { x: hw-8, z:  7, r:-Math.PI/4 },
        { x:  0, z:-hd+11, r:0 },           // dead ahead as you walk in
        /* Down the left, turned in towards the middle of the hall. Not the
           back wall: the Swarm has that and taking it away from a mission
           that is already there would move a landmark a class has learnt. */
        { x:-15, z: 14, r: Math.PI/5 },
        /* Down the right, mirroring the one opposite, for Ion. The spots
           array is indexed by station and falls back to the LAST one when
           it runs short, so a station with nowhere of its own is not an
           error — it is two consoles standing inside each other. */
        { x: 15, z: 14, r:-Math.PI/5 },
        /* And the Ring, down the right, in the seventeen metres of floor
           between Mission 4 and Mission 5.

           THIS SPOT IS NARROWER THAN IT LOOKS and it took two goes. A
           station is a console AND a plinth four metres behind it, so a
           spot has to clear its neighbours' plinths as well as their
           consoles — and the first attempt, four metres further back,
           put this console inside Mission 4's plinth. Mission 4's
           console reaches z=-8.2 and Mission 5's plinth starts at z=0.9,
           which leaves this one a window about three metres wide to
           stand in. It is standing in the middle of it. */
        { x: 22, z: 0, r:-Math.PI/4 }
      ];
      /* A statue stands BEHIND its console, and a plinth is four metres square,
         so "behind" has to be somewhere there is four metres of room. Get that
         wrong by half a metre and the plinth grows out through the back of the
         castle, which is what the outside of this building looked like. Keep
         the whole base inside the walls and let the console sit further into
         the hall instead. */
      const PLINTH=2.2;
      const keepIn=(v,half)=>Math.max(-half+1+PLINTH, Math.min(half-1-PLINTH, v));
      STATIONS.forEach((s,i)=>{
        const p=spots[i] || spots[spots.length-1];
        panel(g,b, p.x, p.z, s.em, t(s.name), s.id, '#1b2740', 0.8, p.r);
        statue(g, s.id, keepIn(p.x - Math.sin(p.r)*4.6, hw),
                        keepIn(p.z - Math.cos(p.r)*4.6, hd), p.r);
      });
    } else if(b.id==='gym'){
      gymroom(g, b, hw, hd);
    } else if(b.id==='club'){
      /* The club owns itself — its floor, its crowd, its lights and the
         sound coming out of it are one thing and it is not this file's. All
         it wants from the planet is the tools every interior uses. */
      if(window.CLUB) CLUB.room(g, b, hw, hd, { panel, lam, t });
      else panel(g,b, 0, -hd+3.2, b.em, t(b.blurb), b.id, '#22406b', 0.85, 0);
    } else if(b.id==='workshop'){
      panel(g,b, 0, -hd+3.2, b.em, t(b.blurb), b.id, '#22406b', 0.85, 0);
      workshopRoom(g, b, hw, hd);
    } else if(b.id==='mall'){
      mallroom(g, b, hw, hd);
    } else if(b.id==='mechanic'){
      showroom(g, b, hw, hd);
    } else if(b.id==='tower'){
      towerRoom(g, b, hw, hd);
    } else if(b.id==='library'){
      panel(g,b, -5.5, -hd+3.2, b.em, t(b.blurb), b.id, '#22406b', 0.85, 0);
      reading(g, b, hw, hd, H);
      librarian(g, b, 5.5, -hd+3.6);
    } else panel(g,b, 0, -hd+3.2, b.em, t(b.blurb), b.id, '#22406b', 0.85, 0);
  }

  /* -------------------------------------------------------- living things
     A landscape with weather in it and nothing alive is a diorama. Two
     cheap things fix that, and neither of them needs to be clever:

     FIREFLIES, which are one Points object. Not one mesh each — a thousand
     meshes of one triangle is a thousand draw calls, and the whole effect is
     specks of light you never look at directly. Each one owns a little orbit
     round a home spot and a phase, and the whole cloud is rewritten into one
     buffer every frame.

     ANIMALS, which walk. A handful of them, each with a heading it keeps for
     a while and then changes, moving on great circles exactly the way the
     player does — the same rotate-about-(up × move) that makes going straight
     on come back round. They stand on the terrain, they step round the
     buildings, and their legs move, because a thing that slides across grass
     reads as a bug and a thing that bobs reads as alive. */
  /* Density, not count. Nine hundred spread over a three-hundred-metre disc
     is one every three hundred square metres, which put eight of them inside
     the forty metres you can actually see — a firefly you have to go looking
     for is not an effect, it is a rounding error. Four thousand over a
     smaller circle puts about a hundred and fifty in view. */
  let flies=null, flyHome=null, flyPhase=null, flyT=0;
  // and the texture is thrown away with the room, like everything else here
  /* Four thousand over a hundred and seventy metres of Senio. Both numbers
     are about a DENSITY, so both follow the ball: on VOLTA a 170-metre
     cloud is wider than the planet, and four thousand of them inside it put
     a firefly every few centimetres — which is not a summer evening, it is
     fog. */
  const FLIES_AT=4000, FLY_R_AT=170;
  let FLIES=FLIES_AT, FLY_R=FLY_R_AT;
  /* A point with no texture is a SQUARE, and a field of one-metre white
     squares bobbing over the grass looks like a printing error rather than
     an insect. A soft round falloff is the whole difference. */
  let sparkTex=null;
  function sparkTexture(){
    if(sparkTex) return sparkTex;
    const N=64, c=document.createElement('canvas'); c.width=c.height=N;
    const x=c.getContext('2d');
    const gr=x.createRadialGradient(N/2,N/2,0, N/2,N/2,N/2);
    gr.addColorStop(0,   'rgba(255,255,235,1)');
    gr.addColorStop(0.25,'rgba(255,240,160,0.85)');
    gr.addColorStop(0.6, 'rgba(255,220,110,0.18)');
    gr.addColorStop(1,   'rgba(255,210,90,0)');
    x.fillStyle=gr; x.fillRect(0,0,N,N);
    sparkTex=new THREE.CanvasTexture(c);
    sparkTex.colorSpace=THREE.SRGBColorSpace;
    return sparkTex;
  }
  function fireflies(){
    FLY_R=Math.min(FLY_R_AT, PR*0.55);
    FLIES=Math.round(FLIES_AT*Math.min(1, (FLY_R*FLY_R)/(FLY_R_AT*FLY_R_AT)));
    const town=townDir(), fr=frameAt(town,0);
    const pos=new Float32Array(FLIES*3);
    flyHome=new Array(FLIES);
    flyPhase=new Float32Array(FLIES*3);
    for(let i=0;i<FLIES;i++){
      let dir;
      if(Math.random()<0.75){                       // most of them near the town
        const a=Math.random()*Math.PI*2, r=Math.sqrt(Math.random())*FLY_R/PR;
        const ax=fr.right.clone().multiplyScalar(Math.cos(a))
                 .add(fr.fwd.clone().multiplyScalar(Math.sin(a))).normalize();
        dir=town.clone().applyAxisAngle(ax, r).normalize();
      } else {
        const th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
        dir=V(Math.sin(ph)*Math.cos(th), Math.cos(ph), Math.sin(ph)*Math.sin(th));
      }
      // low: knee to head height over the grass, where you will walk through them
      flyHome[i]={ dir, up:frameAt(dir,0), h:terrainH(dir)+0.4+Math.random()*1.8 };
      flyPhase[i*3  ]=Math.random()*Math.PI*2;
      flyPhase[i*3+1]=0.35+Math.random()*0.9;       // how fast it wanders
      flyPhase[i*3+2]=0.7+Math.random()*1.8;        // how far
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos,3));
    /* Warm on a green world, cold on a violet one. Fireflies over grass and
       whatever the glass on VOLTA is giving off are the same four thousand
       points and the same one draw call; the colour is the whole difference
       and it is the difference between a summer evening and a night out. */
    flies=new THREE.Points(g, new THREE.PointsMaterial({
      color:(W.flora==='crystal') ? 0xdcc4ff : 0xfff0a0,
      size:(W.flora==='crystal') ? 0.78 : 0.62, sizeAttenuation:true, map:sparkTexture(),
      transparent:true, opacity:0.95, depthWrite:false,
      blending:THREE.AdditiveBlending }));
    flies.frustumCulled=false;
    flies.userData.sky=true;                        // a spark casts no shadow
    G.roomGroup.add(flies);
    flyTick(0);
  }
  function flyTick(dt){
    if(!flies) return;
    flyT+=dt;
    const p=flies.geometry.attributes.position, a=p.array;
    for(let i=0;i<FLIES;i++){
      const h=flyHome[i], ph=flyPhase[i*3], sp=flyPhase[i*3+1], rad=flyPhase[i*3+2];
      const tt=flyT*sp+ph;
      // a slow lissajous round the home spot, in that spot's own tangent plane
      const ox=Math.sin(tt)*rad, oz=Math.sin(tt*0.73+1.1)*rad;
      const oy=Math.sin(tt*1.31)*0.5;
      const r=PR+h.h+oy;
      a[i*3  ]=h.dir.x*r + h.up.right.x*ox + h.up.fwd.x*oz;
      a[i*3+1]=h.dir.y*r + h.up.right.y*ox + h.up.fwd.y*oz;
      a[i*3+2]=h.dir.z*r + h.up.right.z*ox + h.up.fwd.z*oz;
    }
    p.needsUpdate=true;
    // they pulse, all slightly out of step, which is most of what says "alive"
    flies.material.opacity=0.55+0.4*Math.abs(Math.sin(flyT*1.6));
  }

  /* --------------------------------------------------------------- beasts */
  const BEASTS=[
    { key:'grazer',  body:0xb08a5e, spot:0x8a6a44, len:1.7, tall:1.05, legs:0.62, speed:1.5, neck:1.0 },
    { key:'hopper',  body:0xd4a6c8, spot:0xb07fa4, len:0.9, tall:0.72, legs:0.42, speed:2.6, neck:0.5 },
    { key:'strider', body:0x7fa8c4, spot:0x5d86a0, len:1.3, tall:1.5,  legs:1.15, speed:2.0, neck:1.5 }
  ];
  let beasts=[];
  function beastModel(k){
    const g=new THREE.Group();
    const skin=lam(k.body), dark=lam(k.spot);
    const body=new THREE.Mesh(new THREE.BoxGeometry(k.len*0.62, k.tall*0.5, k.len), skin);
    body.position.y=k.legs+k.tall*0.25; g.add(body);
    const head=new THREE.Mesh(new THREE.BoxGeometry(k.len*0.42, k.tall*0.38, k.len*0.42), skin);
    head.position.set(0, k.legs+k.tall*0.25+k.neck*0.42, -k.len*0.62); g.add(head);
    const neck=new THREE.Mesh(new THREE.BoxGeometry(k.len*0.26, k.neck*0.6, k.len*0.26), dark);
    neck.position.set(0, k.legs+k.tall*0.25+k.neck*0.18, -k.len*0.44); g.add(neck);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz],i)=>{
      const leg=new THREE.Mesh(new THREE.BoxGeometry(k.len*0.16, k.legs, k.len*0.16), dark);
      leg.geometry.translate(0,-k.legs/2,0);                 // hinge at the top
      leg.position.set(sx*k.len*0.22, k.legs, sz*k.len*0.34);
      leg.userData.phase=i*Math.PI/2;
      g.add(leg);
      (g.userData.legs = g.userData.legs || []).push(leg);
    });
    const tail=new THREE.Mesh(new THREE.BoxGeometry(k.len*0.12, k.len*0.12, k.len*0.5), dark);
    tail.position.set(0, k.legs+k.tall*0.32, k.len*0.6); g.add(tail);
    return g;
  }
  function wildlife(n){
    beasts=[];
    const town=townDir(), fr=frameAt(town,0);
    for(let i=0;i<n;i++){
      const k=BEASTS[i%BEASTS.length];
      const a=Math.random()*Math.PI*2, r=(60+Math.random()*300)/PR;
      const ax=fr.right.clone().multiplyScalar(Math.cos(a))
               .add(fr.fwd.clone().multiplyScalar(Math.sin(a))).normalize();
      const dir=town.clone().applyAxisAngle(ax, r).normalize();
      if(BUILDINGS.some(b=>b.dir && dir.angleTo(b.dir)*PR <
           Math.hypot(b.w,b.d)/2 + 8)) continue;
      const g=beastModel(k);
      G.roomGroup.add(g);
      beasts.push({ k, g, dir, fwd:frameAt(dir, Math.random()*Math.PI*2).fwd,
                    step:0, rest:Math.random()*4, turn:0 });
    }
  }
  function beastTick(dt){
    for(const bs of beasts){
      const up=bs.dir.clone().normalize();
      // keep the heading in the tangent plane; a long walk drifts out of it
      bs.fwd.sub(up.clone().multiplyScalar(bs.fwd.dot(up)));
      if(bs.fwd.lengthSq()<1e-8) bs.fwd.copy(frameAt(up,0).fwd);
      bs.fwd.normalize();

      bs.rest-=dt;
      if(bs.rest<=0){                       // stop, look about, choose a new way
        bs.rest=3+Math.random()*7;
        bs.turn=(Math.random()-0.5)*2.4;
      }
      const walking = bs.rest > 1.6;        // the last stretch of each spell is a pause
      if(bs.turn){ const d=Math.min(Math.abs(bs.turn), 1.3*dt)*Math.sign(bs.turn);
                   bs.fwd.applyAxisAngle(up, d); bs.turn-=d; }
      if(walking){
        const v=bs.k.speed;
        const axis=new THREE.Vector3().crossVectors(up, bs.fwd).normalize();
        const ang=(v*dt)/PR;
        const want=bs.dir.clone().applyAxisAngle(axis, ang).normalize();
        // a building is a thing to walk round, not through
        const hit=BUILDINGS.some(b=>b.dir && want.angleTo(b.dir)*PR <
                    Math.hypot(b.w,b.d)/2 + 5);
        if(hit){ bs.turn=1.6; }
        else { bs.dir.copy(want); bs.fwd.applyAxisAngle(axis, ang); bs.step+=v*dt; }
      }
      /* up × forward, in that order. The other way round is still a perfectly
         valid set of three axes — it is just left-handed, so makeBasis builds
         a REFLECTION rather than a rotation and the animal lies down on its
         side inside its own mirror image. Same order the car and the player
         use, for the same reason. */
      const fwd=bs.fwd.clone(), up2=bs.dir.clone().normalize();
      const right=new THREE.Vector3().crossVectors(up2, fwd).normalize();
      bs.g.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(right, up2, fwd));
      bs.g.position.copy(bs.dir).multiplyScalar(PR + floorAt(bs.dir));
      // legs swing when it moves and hang still when it does not
      (bs.g.userData.legs||[]).forEach(l=>{
        l.rotation.x = walking ? Math.sin(bs.step*2.4 + l.userData.phase)*0.5 : 0;
      });
    }
  }

  /* ------------------------------------------------------------- the mall
     Choosing who you are used to be a grid of thumbnails on a screen. A
     thumbnail of a character is a picture of a decision; the character
     standing in front of you at your own height, turning on a dais, is the
     decision itself. Same argument as the hall of statues in Mission
     Control, and the same machinery: something up on a plinth, a console
     beside it, walk over and press E.

     The screen has not gone — the counter at the back still opens it, and it
     is still where the ships are and where a keyboard can do everything in
     four keys. But it is no longer the FIRST thing that happens when you
     open a door. */
  let mannequins=[];
  /* Round the walls, evenly: seven along the back and the rest up the two
     sides, every one of them turned to face the middle of the room. */
  /* Eighteen people each need a dais four metres across and a console two
     and a half wide in front of them. Cram that into a room the size of a
     classroom and the consoles overlap each other and the person they are
     labelling — which is what the first version did, and it read as one
     continuous wall of price tags. */
  function mallSpots(n, hw, hd){
    const out=[], back=Math.min(n,8);
    /* THE ROW IS AS WIDE AS IT NEEDS TO BE. It used to run the full width
       of the back wall whatever was standing in it, which was right for
       eight and absurd for two: the pair ended up thirty metres apart at
       opposite ends of the hall, which is two people you walk between
       rather than choose between. */
    const span=Math.min((hw-8)*2, (back-1)*9);
    const x0=-span/2, x1=span/2;
    for(let i=0;i<back;i++){
      const t=back===1?0.5:i/(back-1);
      out.push({ x:x0+t*(x1-x0), z:-hd+6, r:0 });
    }
    const rest=n-back, per=Math.max(1,Math.ceil(rest/2)), z0=-hd+14, z1=hd-9;
    for(let i=0;i<rest;i++){
      const side=(i%2)?1:-1, k=(i/2)|0;
      const t=per===1?0.5:k/(per-1);
      out.push({ x:side*(hw-7), z:z0+t*(z1-z0), r:side*(-Math.PI/2) });
    }
    return out;
  }
  /* A dais, not a column. The plinths in Mission Control lift a statue to be
     admired from across a hall; a person you are deciding to BE should be
     standing at your own height, close enough to look in the face. */
  function dais(tint){
    const g=new THREE.Group();
    const st=new THREE.MeshLambertMaterial({color:0x8d93b5});
    const dk=new THREE.MeshLambertMaterial({color:0x545a7d});
    const step=(r,h,y,m)=>{ const c=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.06,h,20), m||st);
      c.position.y=y; g.add(c); };
    step(1.9,0.22,0.11,dk); step(1.7,0.24,0.34); step(1.45,0.22,0.57,dk);
    const band=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,0.1,20),
      new THREE.MeshBasicMaterial({color:tint||0x8fd3ff}));
    band.position.y=0.70; g.add(band);
    const glow=new THREE.Mesh(new THREE.CircleGeometry(1.35,20),
      new THREE.MeshBasicMaterial({color:tint||0x8fd3ff, transparent:true, opacity:0.25}));
    glow.rotation.x=-Math.PI/2; glow.position.y=0.76; g.add(glow);
    return g;
  }
  function wearLabel(it){
    const owned=SHOP.ownsChar(it);
    const on=window.AVATAR && AVATAR.chosen===it.charId;
    return { line: on ? t('WEARING') : owned ? t('YOURS')
                     : (it.price===0 ? t('FREE') : it.price+' ◆'),
             bg: on ? '#1d4030' : owned ? '#22406b' : '#3a2a1b' };
  }
  function mallroom(g, b, hw, hd){
    mannequins=[];
    if(!window.SHOP || !window.AVATAR) return;
    /* Shop lighting: a windowless room under a roof that really does block
       the sun, so the light has to come from in here. */
    [-hd*0.4, hd*0.3].forEach(z=>{
      const tube=new THREE.Mesh(new THREE.BoxGeometry(hw*1.3,0.28,0.8),
        new THREE.MeshBasicMaterial({color:0xffeef6}));
      tube.position.set(0, b.h-1.3, z); g.add(tube);
      const lamp=new THREE.PointLight(0xffe6f0, 300, 58, 1.4);
      lamp.position.set(0, b.h-2, z); g.add(lamp);
    });
    const spill=new THREE.PointLight(0xdfe9ff, 110, 40, 1.5);
    spill.position.set(0, 5, hd-4); g.add(spill);

    const items=SHOP.charItems();
    const spots=mallSpots(items.length, hw, hd);
    items.forEach((it,i)=>{
      const s=spots[i]; if(!s) return;
      const tint=SHOP.ownsChar(it) ? 0xa8e6cf : 0xffe9a8;
      const d=dais(tint); d.position.set(s.x, 0, s.z); g.add(d);
      const stage=new THREE.Group();
      stage.position.set(s.x, 0.78, s.z); stage.rotation.y=s.r;
      g.add(stage);
      /* BESIDE the dais, not in front of it. A console is three metres tall
         and the person it is labelling is under two — stand it between them
         and the viewer and the whole point of a mannequin is gone. */
      const cx=s.x + 3.1*Math.cos(s.r) + 1.7*Math.sin(s.r);
      const cz=s.z - 3.1*Math.sin(s.r) + 1.7*Math.cos(s.r);
      const p=panel(g, b, cx, cz,
        '\u{1F642}', t(it.name)+'\n'+wearLabel(it).line, 'wear:'+it.charId,
        wearLabel(it).bg, 0.5, s.r);
      mannequins.push({ it, p, stage, model:null });
      AVATAR.load(it.charId).then(root=>{
        if(!on || !stage.parent) return;
        stage.add(root);
        const m=mannequins.find(x=>x.stage===stage); if(m) m.model=root;
      }).catch(()=>{});
    });
    /* The counter, off to one side. Straight ahead of the door it was the
       first thing you walked into, which is a fine way to make sure nobody
       ever sees the shop floor. */
    panel(g, b, hw-9, hd-7, '\u{1F4CB}', t('THE COUNTER')+'\n'+t('ships and the full list'),
      'counter', '#2a2013', 0.7, -Math.PI/2);
  }
  function repaintMall(){
    mannequins.forEach(m=>{
      const w=wearLabel(m.it), face=m.p && m.p.userData.glow;
      if(!face) return;
      if(face.material.map) face.material.map.dispose();
      face.material.map=panelTex('\u{1F642}', t(m.it.name)+'\n'+w.line, w.bg);
      face.material.needsUpdate=true;
    });
  }
  function wear(charId){
    if(!window.SHOP || !window.AVATAR) return;
    const it=SHOP.charItems().find(x=>x.charId===charId); if(!it) return;
    if(!SHOP.ownsChar(it)){
      const r=SHOP.buy(it.id, it.price);
      if(r==='poor'){
        say(t('{n} costs {p} ◆. You have {c} ◆.',
              {n:t(it.name), p:it.price, c:WALLET.coins()}));
        return;
      }
      say(t('Bought {n}.',{n:t(it.name)}));
    } else say(t('You are {n} now.',{n:t(it.name)}));
    SHOP.equip(it.id);                    // which calls AVATAR.pick for us
    repaintMall();
  }
  /* The mannequins turn, slowly and all together, the way a shop window
     turns — it is what stops eighteen people standing still reading as
     eighteen corpses. */
  function mallTick(dt){
    mannequins.forEach(m=>{
      m.stage.rotation.y += 0.35*dt;
      if(m.model && window.AVATAR) AVATAR.animate(m.model, dt, 'idle');
    });
  }

  /* --------------------------------------------------------------- the gym
     Two consoles and a floor between them. The floor is the arena you will
     actually fight on, chalked out at the size it is — ten squares by ten —
     so somebody standing in the room has already seen the map their program
     has to cross before they write a line of it.

     Left console: the league, four machines that never get better. Right
     console: whoever else is in the room. Same blocks, same referee; the
     only difference is that one of them is trying to beat you back. */
  function gymroom(g, b, hw, hd){
    const line=new THREE.MeshBasicMaterial({color:0x8fd3ff});
    const mat =new THREE.MeshLambertMaterial({color:0x2e2547});
    const N=10, sq=1.5, half=N*sq/2;
    const floor=new THREE.Mesh(new THREE.BoxGeometry(N*sq+1.2, 0.16, N*sq+1.2), mat);
    floor.position.set(0,0.09,1.5); floor.userData.flat=true; g.add(floor);
    // the grid, drawn rather than modelled: eleven lines each way
    for(let i=0;i<=N;i++){
      const at=-half+i*sq;
      const across=new THREE.Mesh(new THREE.BoxGeometry(N*sq, 0.04, 0.07), line);
      across.position.set(0, 0.18, 1.5+at); across.userData.flat=true; g.add(across);
      const down=new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, N*sq), line);
      down.position.set(at, 0.18, 1.5); down.userData.flat=true; g.add(down);
    }
    // the two starting marks, in the colours the arena itself uses
    [[-half+sq/2,-half+sq/2,0x8fd3ff],[half-sq/2,half-sq/2,0xff9aa2]].forEach(([x,z,c])=>{
      const m=new THREE.Mesh(new THREE.RingGeometry(0.4,0.62,20),
        new THREE.MeshBasicMaterial({color:c, side:THREE.DoubleSide}));
      m.rotation.x=-Math.PI/2; m.position.set(x, 0.2, 1.5+z);
      m.userData.flat=true; g.add(m);
    });
    const lamp=new THREE.PointLight(0xffd8f0, 220, 44, 1.5);
    lamp.position.set(0, b.h-3, 1.5); g.add(lamp);

    /* Three ways to fight, and they are not the same sport. The first two
       are the turn-based league: you write a program, you press RUN, and
       you are a spectator. The third hands you the controls — you drive
       and your code does the punching — so it stands apart on the right
       with its own mark on the floor. */
    panel(g, b, -12, -hd+4.2, '\u{1F916}', t('FIGHT THE LEAGUE'), 'league', '#2a1d3d', 0.75, 0);
    panel(g, b,   0, -hd+4.2, '\u{2694}',  t('FIGHT A PLAYER'),   'pvp',    '#3d1d28', 0.75, 0);
  }

  /* ------------------------------------------------------------- the pad
     A launch pad on every world, and the ship you own standing on it. Walk
     up, press E, and you are on the other planet — the hub if you are home,
     home if you are on the hub.

     Everybody can travel. The Dart is free and everybody has it from the
     first minute, so the pad is never a locked door; buying a better ship
     changes what is parked on the pad and nothing else, which is the same
     bargain every other thing in the shop makes. */
  let padShip=null, padB=null;
  /* Registered BEFORE the ground is generated, because the ground asks
     BUILDINGS which patches of itself to flatten — and a pad that joins the
     list afterwards gets a landing field with a hill through it. */
  /* ------------------------------------------------------------- the ship
     THE E-45, grounded on the patch beside the house. It is not a building
     — it has no door and you do not go inside it — so it follows the
     launchpad: a spec in the list so the map can draw it, and a group
     stood on the sphere afterwards.

     THERE USED TO BE A ROVER HERE and it was a different lesson: twelve
     power cells, wheels against treads, and a route you could not afford.
     The ship is the pre-flight checklist instead — see preflight.js — and
     it is the one Robin actually needs, because Ion has just asked to be
     taken to the Mechanic and the Mechanic is on Senio.

     LOADED, NOT BUILT. The rover was assembled out of whichever parts the
     bench last said it was made of, so its model WAS its spec; the E-45 is
     a model somebody drew, and the thing that changes about it is which of
     its safety rules pass. So the group goes up empty and the mesh is
     dropped into it when it arrives — the ship you can walk up to and
     press E at exists from the first frame, whether or not a megabyte has
     finished coming down the wire. */
  let shipB=null, shipProto=null;
  /* TWO FILES, CUT ALONG THE AUTHOR'S OWN LINE. The E-45 arrived as one
     mesh with two materials in it, and a canopy welded to the hull is not
     a door — so obj2glb emits the faces of each material as its own glb
     (`only=` / `skip=`). Neither piece has moved from where it was drawn,
     so they meet again exactly and nothing has to be aligned here. */
  const HULL_FILE   = () => 'ships/e45-hull.glb?v='   + (window.ASSETV || '1');
  const CANOPY_FILE = () => 'ships/e45-canopy.glb?v=' + (window.ASSETV || '1');
  const SHIP_LEN  = 11;            // nose to tail, in world units
  /* THE HINGE, in the model's own units before it is scaled.

     The canopy is a bubble over the forward half: it runs from the nose at
     z -2.94 back to z 0.10, and the OBJ is drawn +Y up with the nose down
     -Z. So the hinge is its REAR edge — the line across the ship at z
     0.10 — and it swings up and back over the spine, which is what the
     original animation does with it (169 degrees, twice, in the Sketchfab
     clip: open, and then closed again thirteen seconds later).

     One axis and one point, rather than a rig. A rotation about a line is
     what a hinge IS, and a skinned skeleton to express it would be a
     skeleton with one joint in it. */
  const HINGE = { z: 0.10, y: 1.10 };   // the pivot, in model units
  /* WHICH WAY IT SWINGS, found by opening it and looking rather than by
     reasoning about the sign. Positive lifts the forward end of the glass
     up and back off the cockpit — a fighter canopy, hinged at its rear
     edge. 1.0 is about fifty-seven degrees: clear enough to climb into and
     short of the point where it stands up like a sail. */
  const CANOPY_OPEN = 1.0;              // radians
  function shipSpec(w){
    shipB=null; smoke=null;   // the puffs went with the world that held them
    if(!w || w.id!=='ryu') return;
    const spot={ lon:5, lat:-2 };
    shipB={ id:'ship', name:'THE E-45', em:'\u{1F680}', prop:true,
            lon:spot.lon, lat:spot.lat,
            w:14, d:14, h:0, roof:0x8ff0ff, dir:dirOf(spot.lon, spot.lat),
            frame:null, g:null, solids:[] };
    BUILDINGS.push(shipB);
  }
  /* One fetch per session, shared by every group that wants one. */
  function shipModel(){
    if(!shipProto){
      const load = url => new Promise((res,rej)=>
        new THREE.GLTFLoader().load(url, g=>res(g.scene), undefined, rej));
      shipProto = Promise.all([load(HULL_FILE()), load(CANOPY_FILE())])
                         .then(([hull, canopy])=>({ hull, canopy }));
    }
    return shipProto;
  }
  /* WHERE THE SHIP RESTS, which is not the bottom of its bounding box.

     THE E-45 HAS AN AERIAL. A needle of thirty-one vertices — out of
     twelve thousand — hangs below the hull, and Box3 is perfectly correct
     that it is the lowest thing on the model. Sitting the ship on it
     parked her the length of the aerial in the air, hovering beside the
     house with her shadow underneath, and nothing anywhere said why: the
     number was right, it was just a number about the wrong part of the
     ship.

     So ask the hull instead, by throwing away the lowest one per cent of
     her. It is the same argument house.js makes about Ion — the corner a
     shoulder rests on is a face and not a vertex — for the opposite
     shape: there the extreme was a real part of him and the BOX was
     wrong, here the box is honest and the extreme is a whisker. */
  function restOf(o){
    const ys=[], v=new THREE.Vector3();
    o.traverse(m=>{
      if(!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      const pos=m.geometry.attributes.position;
      /* Every fourth vertex. Three thousand samples put the aerial at
         eight of them, which is still well inside the one per cent that
         gets thrown away, and it costs a millisecond once. */
      for(let i=0;i<pos.count;i+=4){ v.fromBufferAttribute(pos,i); m.localToWorld(v); ys.push(v.y); }
    });
    if(!ys.length) return 0;
    ys.sort((a,b)=>a-b);
    return ys[Math.floor(ys.length*0.01)];
  }

  function shipBuild(){
    const b=shipB; if(!b) return;
    const g=new THREE.Group();
    b.g=g;
    b.frame=stand(g, b.dir, 0, terrainH(b.dir));
    G.roomGroup.add(g);
    /* A SOLID AND A HOLDER FIRST, both the size the ship will be, so you
       cannot walk through the spot it is about to occupy and E works the
       moment you reach it. */
    b.solids.push({ x1:-2.2, x2:2.2, z1:-5.5, z2:5.5, y1:0, y2:3.4 });
    /* THE SHIP IS THE THING YOU PRESS E AT. The rover before it had a
       console on a post beside it, like a mission door — and a post has a
       SIDE, so you walked up to a vehicle and the button was somewhere
       else. A vehicle is not a door. Every mesh of it owns the same
       holder, and it can be pressed from wherever you are standing when
       you reach it. */
    const hold=new THREE.Object3D();
    hold.userData={ kind:'machine', label:'THE E-45', enter:'ship' };
    g.add(hold);

    shipModel().then(proto=>{
      if(!on || b.g!==g) return;          // the world moved on while it loaded
      const dress = o => { o.traverse(m=>{ if(!m.isMesh) return;
        m.material=m.material.clone();
        m.material.vertexColors=true;     // it carries its colour in the mesh
        m.frustumCulled=false;
      }); return o; };
      const hull   = dress(proto.hull.clone(true));
      const canopy = dress(proto.canopy.clone(true));

      /* THE HINGE IS A GROUP, and the canopy hangs off it at the offset it
         was drawn at. Move the group and the canopy swings; the group
         itself never moves, so nothing has to be put back. */
      const hinge=new THREE.Group();
      hinge.position.set(0, HINGE.y, HINGE.z);
      canopy.position.set(0, -HINGE.y, -HINGE.z);
      hinge.add(canopy);

      /* ONE FRAME FOR BOTH HALVES, so the scale and the drop that put the
         hull on the tile carry the canopy with them. They were cut out of
         one model and have never moved apart. */
      const o=new THREE.Group();
      o.add(hull); o.add(hinge);

      /* SCALED BY LENGTH, NEVER BY THE BOX. The E-45 has an antenna mast
         standing most of its own height above the hull, so its bounding
         box is two thirds needle — scale that to a sensible height and you
         park a toy. Length is the dimension anybody means by "how big is
         the ship". */
      o.updateMatrixWorld(true);
      const raw=new THREE.Box3().setFromObject(o);
      const len=(raw.max.z-raw.min.z)||1;
      o.scale.setScalar(SHIP_LEN/len);
      o.updateMatrixWorld(true);
      /* Centred over the patch and sat on the ground, measured after the
         scale rather than guessed before it — and the two are measured
         DIFFERENTLY, which is the whole of the paragraph below. */
      const box=new THREE.Box3().setFromObject(o);
      o.position.set(-(box.min.x+box.max.x)/2, -restOf(o), -(box.min.z+box.max.z)/2);
      /* Parked across the doorway rather than pointing at it, so walking
         out of the house you see the length of her. */
      const spin=new THREE.Group();
      spin.add(o); spin.rotation.y=-Math.PI/2;
      g.add(spin);
      o.traverse(m=>{ if(m.isMesh){ m.userData.owner=hold; G.hits.push(m); } });
      b.hinge=hinge;
      /* THE ENGINE HATCH, WHICH IS THE WAY BACK TO THE CHECKS.

         The hull is one object and it can only mean one thing at a time:
         before she is cleared, E on her is the pre-flight; after, E is
         get in — and that is right, because a student who has just been
         told she will fly wants to fly her. It also means the nine rules
         about `and`, `or`, `<` and `<=` vanish from the world the moment
         they are first got right, and the only way back to the one piece
         of boolean practice on this hillside was to restart the mission.
         A returning save was worse: she stood there not smoking, with
         nothing to press and nothing wrong.

         So the checks get their own door. A panel on her flank, lit, next
         to the exhaust that was doing all that smoking, and it opens the
         checklist whether she is cleared or not — as many times as
         anybody wants. The hull still flies her. One object each, one
         meaning each. */
      /* MEASURED ONTO HER FLANK, NOT TYPED ONTO IT. The first one was put
         at x=0 — the middle of the ship — which is not her flank, it is
         her spine, and a panel there is INSIDE the hull. It was never
         visible and never clickable, which is exactly the complaint it
         was written to answer: the checks had no door.

         `o` has just been centred over its patch and sat on the ground, so
         a box taken now is where she actually is, and the panel goes a
         little way outside her widest point at half her height. */
      const hb=new THREE.Box3().setFromObject(o);
      const hatch=new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 1.5, 2.2),
        new THREE.MeshLambertMaterial({ color:0x24455c,
                                        emissive:0x2fa8c4, emissiveIntensity:1.0 }));
      hatch.position.set(hb.max.x + 0.22, Math.min(hb.max.y*0.55, 2.2), 0);
      const hatchHold=new THREE.Group();
      hatchHold.position.copy(hatch.position);
      hatchHold.userData={ kind:'panel', label:t('PRE-FLIGHT'), enter:'preflight' };
      spin.add(hatchHold); spin.add(hatch);
      hatch.userData.owner=hatchHold;
      hatch.userData.verb='E \u2014 pre-flight';
      G.hits.push(hatch);
      /* AND ONE ON EACH SIDE, because she is parked across the doorway and
         which flank you walk up to is decided by which way you left the
         house. One door on the far side is one door nobody finds. */
      const hatch2=hatch.clone();
      hatch2.position.set(hb.min.x - 0.22, hatch.position.y, 0);
      const hold2=new THREE.Group();
      hold2.position.copy(hatch2.position);
      hold2.userData={ kind:'panel', label:t('PRE-FLIGHT'), enter:'preflight' };
      spin.add(hold2); spin.add(hatch2);
      hatch2.userData.owner=hold2;
      hatch2.userData.verb='E \u2014 pre-flight';
      G.hits.push(hatch2);
      /* A LAMP ON IT, so it reads as the one lit thing on a dark hull at
         the distance somebody first sees her from. */
      const hlamp=new THREE.PointLight(0x5fd8ff, 3.2, 9, 1.6);
      hlamp.position.set(0, hatch.position.y+0.6, 0); spin.add(hlamp);
      /* SHE IS SMOKING, and that is the whole brief. A student walks out
         of the house and has to work out, with nobody telling them, which
         of the things on this hillside is the mission — and a parked ship
         looks exactly like a parked ship. So the one that needs something
         doing to it is the one with smoke coming off it.

         OVER THE TAIL, IN HER OWN FRAME. `o` has just been centred over
         the patch and sat on the ground, so in the frame `spin` hands the
         puffs she runs from -SHIP_LEN/2 at the nose to +SHIP_LEN/2 at the
         tail with her belly on y 0 — and the exhaust is the far end of
         that, whatever the mesh happens to measure.

         NOT box.max.y FOR THE HEIGHT. This ship's bounding box is two
         thirds antenna — the same fact restOf() is written about — so the
         top of it is a needle standing most of her height above the hull,
         and smoke pinned there would pour off the mast. */
      smokeBuild(spin, SHIP_LEN);
      /* Open already, if she was cleared on an earlier visit: a ship you
         got into yesterday is not shut this morning. */
      hinge.rotation.x = shipOpen() ? CANOPY_OPEN : 0;
      shipVerb();
      G.scene.updateMatrixWorld(true);
    }).catch(e=>console.warn('PLANET: the E-45 failed to load', e));
  }

  /* HAS SHE BEEN CLEARED? The canopy is the only thing in this world that
     remembers the pre-flight, so it is the only thing that has to ask. */
  /* FILED UNDER THE MISSION, and that prefix is load-bearing. PROGRESS
     .restart(id) forgets every key beginning with `id + '_'`, which is how
     "start over" takes a mission's walkthroughs and films back with it.
     This was called `ship_cleared`, and Mission 8's id is `ion` — so it
     survived a restart, and a student who asked for the beginning got a
     ship that was already cleared: canopy standing open, no smoke, and
     E going straight to the boarding cutscene past a checklist they had
     asked to do again. The brief never played either, because ITS flag is
     under `ion_` and was correctly forgotten, leaving the two halves of
     the same mission disagreeing about whether it had happened. */
  const CLEARED='ion_ship_cleared';
  const shipOpen = () => { try{ return !!(window.PROGRESS && PROGRESS.get(CLEARED,0)); }
                           catch(e){ return false; } };

  /* ===================================================================
     THE SMOKE, WHICH IS THE BRIEF.

     THE MISSION USED TO BE INVISIBLE. She walks out of the house, and on
     the hillside there is a house, a tower on the horizon and a ship —
     and nothing about any of them says which one is the thing to go and
     do. The ship reads as scenery, because a parked ship IS scenery
     nine times out of ten, and the only thing that ever said otherwise
     was a line of briefing text in the corner that a nine-year-old has
     already walked away from.

     So she smokes. It is the one piece of visual language that needs no
     reading at all and no translating — a machine with smoke coming off
     it is a machine with something wrong with it, and every child who
     has ever seen a cartoon knows it. The ship that needs fixing is the
     one that is smoking, and when it stops smoking it is fixed.

     AND IT STOPS ON THE CLEAR, not on a timer and not on the canopy.
     The pre-flight passing is the moment something was actually mended,
     so that is the moment the smoke thins out and goes — over a couple
     of seconds, because smoke that vanishes between two frames was never
     smoke, it was a sprite being switched off.

     EIGHT BOXES AND NO TEXTURE. This is the same trick mecha.js plays on
     a dying core, for the same reason: a puff is a cube with a low
     opacity on it, and eight of them on staggered phases read as a plume
     from twenty metres away, which is the only distance anybody sees
     this from. They are made once, with the ship, because a world that
     starts allocating geometry when you walk round a corner is a world
     that hitches when you walk round a corner.
     =================================================================== */
  /* TWELVE RATHER THAN EIGHT. Eight read as eight cubes; twelve overlap
     enough to read as one column of smoke, and a dozen unlit boxes costs
     nothing anybody can measure. */
  const PUFFS = 12;
  const SMOKE_FADE = 2.2;               // seconds to clear, once she passes
  let smoke=null;                       // the puffs, and how strong they are
  function smokeBuild(parent, len){
    smoke={ puffs:[], strength: shipOpen() ? 0 : 1 };
    for(let i=0;i<PUFFS;i++){
      /* PALE, ON A WORLD WITH NO DAYLIGHT IN IT. Smoke is dark grey
         everywhere except here: RYU's sky is very nearly black, and a
         dark plume against it is a hole in the stars that reads as
         nothing at all — which is what the first version of this was.
         An unlit material over a black background means opacity IS
         brightness, so the puffs are near-white and stay fairly opaque,
         and what makes them dissipate is that they GROW. */
      const puff=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.6,0.6),
        new THREE.MeshBasicMaterial({ color:0xd8d2e0, transparent:true,
                                      opacity:0, depthWrite:false }));
      /* SPREAD ALONG THEIR OWN LIVES, not started together. Eight puffs
         born on the same frame are one puff drawn eight times. */
      puff.userData.t = i/PUFFS;
      puff.userData.seed = i;
      /* TURNED OFF THE AXES, and each one differently. A cube square to
         the camera is unmistakably a cube; the same cube rotated on all
         three axes is a lump, and a column of lumps is smoke. This is the
         whole difference between this reading as a plume and reading as a
         stack of boxes, and it costs one line. */
      puff.rotation.set(i*1.1, i*0.7, i*1.9);
      parent.add(puff);
      smoke.puffs.push(puff);
    }
    smoke.tail = len*0.5;               // where the exhaust is, in her frame
    smokeTick(0);                       // pose them before the first frame
  }
  /* Rising, drifting and growing, the way a puff of smoke does: up off the
     tail, thinning as it goes, and wandering a little on the way so eight
     of them are not one column. */
  function smokeTick(dt){
    if(!smoke) return;
    /* A cleared ship stops smoking, and a ship that was already cleared
       when she was built never starts. */
    const want = shipOpen() ? 0 : 1;
    if(smoke.strength!==want)
      smoke.strength = want > smoke.strength
        ? Math.min(1, smoke.strength + dt/0.4)
        : Math.max(0, smoke.strength - dt/SMOKE_FADE);
    const s=smoke.strength;
    smoke.puffs.forEach(p=>{
      const i=p.userData.seed;
      /* Each on its own clock, so they do not pulse in step. */
      p.userData.t = (p.userData.t + dt*(0.34 + 0.05*i)) % 1;
      const u=p.userData.t;
      p.position.set(Math.sin(u*3.1 + i)*(0.6 + u*1.6),
                     2.2 + u*5.5,
                     smoke.tail - 0.6 + Math.cos(u*2.4 + i)*0.4);
      /* Growing as it climbs. This is what makes it read as smoke rather
         than as a row of boxes — and on a black sky it is the only thing
         that can, because fading is the one tool that does not work. */
      p.scale.setScalar(1.1 + u*3.2);
      /* THINNING, BUT NEVER TO NOTHING while she is broken: from most of
         the way opaque at the tail to about a third of it at the top, so
         the plume has a shape without any of it disappearing into the
         sky. `s` is the whole plume going out when she is mended, which
         is the only thing here that ever reaches zero. */
      p.material.opacity = s * (0.62 - u*0.30);
      p.visible = s > 0.01;
    });
  }
  /* AND OPENING IT IS A THING YOU WATCH. A canopy that is shut in one
     frame and open in the next has not opened, it has cut — and this is
     the moment the mission has been working towards, so it is worth the
     second and a half it takes. */
  let canopyLift=null;
  function canopyOpen(){
    const b=shipB;
    if(!b || !b.hinge) return;
    canopyLift={ from:b.hinge.rotation.x, to:CANOPY_OPEN, t:0, for:1.6, hinge:b.hinge };
  }
  function canopyTick(dt){
    const c=canopyLift; if(!c) return;
    c.t=Math.min(1, c.t + dt/c.for);
    const u=c.t*c.t*(3-2*c.t);
    c.hinge.rotation.x = c.from + (c.to-c.from)*u;
    if(c.t>=1) canopyLift=null;
  }
  /* WHAT THE PROMPT SAYS. One machine, two jobs: you inspect her until the
     checklist passes and you climb into her afterwards. The word has to
     change with the canopy or the prompt is telling you to inspect a ship
     that is standing open waiting for you. */
  function shipVerb(){
    const b=shipB; if(!b || !b.g) return;
    b.g.traverse(o=>{ if(o.userData && o.userData.enter==='ship')
                        o.userData.verb = shipOpen() ? 'E \u2014 get in' : null; });
  }

  /* ===================================================================
     GETTING IN, WHICH IS THE END OF THE MISSION.

     Ion asked to be taken to the Mechanic and the Mechanic is on Senio —
     and nothing flies from RYU to Senio, because RYU is a mission with one
     door and the way to anywhere else is back out through it. So climbing
     in IS leaving: she takes him up, and the mission hands the player back
     where every mission hands them back, which is the floor of Mission
     Control, on the planet the Mechanic is actually on.

     THE SHOTS ARE IN THE SHIP'S OWN FRAME. A cutscene on a sphere cannot
     be written down as three numbers — the ship is two hundred and forty
     units from the middle of the world and "above" is whichever way is out
     — so every camera position here is an offset along the ship's own
     right, up and forward, which stand() worked out when it put her on the
     ground.
     =================================================================== */
  /* ===================================================================
     WHY SHE NEEDS FIXING — asked and answered before anybody is handed a
     blank.

     THE CHECKLIST USED TO ARRIVE OUT OF NOWHERE. You pressed E at a ship
     and a panel came up with fourteen blanks in it and the word FUEL at
     the top, and the only account of why any of that was happening was
     the mission title. A student who does not know what a pre-flight is
     for cannot tell the difference between a puzzle and a chore, and this
     one is nine minutes long.

     So the smoke gets explained by the people standing in front of it.
     Four lines, and they do three things in this order: Robin sees what
     the player has already seen, Ion says what is actually broken, and
     Robin says what she is about to do about it. Nobody recites what an
     operator is — that is the panel's job and the panel is better at it —
     and nobody says the words `and`, `or` or `not` out loud, because the
     whole lesson is meeting them one at a time in a place where only one
     of them will do.

     WHAT IS BROKEN IS THE CHECKLIST, NOT THE ENGINE. This matters more
     than it looks. If the ship is damaged then filling in nine rules is a
     strange way to mend it, and the mission is nonsense dressed as a
     lesson. So the fault is her SAFETY RULES: the E-45 will not start
     because she cannot tell whether she is safe to start, the comparisons
     that decide it have been lost, and putting them back is repairing
     her. That is a true thing about real machines and it is the reason
     the panel is the repair rather than a quiz about it.

     ONCE. It is a scene, and a scene you have watched is a scene that is
     in the way — so the flag is filed under the mission's own name, which
     means "start over" brings it back with everything else.
     =================================================================== */
  const SEEN='ion_shipbrief';
  const briefed = () => { try{ return !!(window.PROGRESS && PROGRESS.get(SEEN,0)); }
                          catch(e){ return false; } };

  /* The camera offsets every shot at the ship is written in. Hers, not the
     world's: she is two hundred and forty units from the middle of a ball
     and "above" is whichever way is out, so a shot here is an offset along
     her own right, up and forward. Shared by the brief and the boarding,
     because they are shots of the same ship from the same three places. */
  function shipShots(b){
    const P0=b.g.position.clone(), F=b.frame;
    const at=(r,u,f)=>P0.clone()
      .add(F.right.clone().multiplyScalar(r))
      .add(F.up.clone().multiplyScalar(u))
      .add(F.fwd.clone().multiplyScalar(f))
      .toArray();
    /* THE SHIP LIES ACROSS THIS FRAME, NOT ALONG IT. She is parked
       broadside to the house — shipBuild() turns her a quarter circle so
       you see her length on the way out of the door — so her nose points
       along the frame's RIGHT and her flank faces its FORWARD. Offsetting
       along `right` to get a side-on shot puts the camera up her exhaust,
       which is the first thing these did. Found by standing the camera at
       each of them and looking. */
    return { at,
      WIDE : { eye:at(0,    5, 14),  at:at(0, 2, 0) },   // her whole length
      CLOSE: { eye:at(4.5,  3, 7.5), at:at(3, 2, 0) },   // the open canopy
      AWAY : { eye:at(-4,   9, 20),  at:at(0, 2, 0) },   // pulling back
      /* AND ONE THE BOARDING NEVER NEEDED: up at the tail, where the
         smoke is. The brief opens on the fault rather than on the ship,
         because the fault is the thing the scene is about — and a wide of
         a parked ship is a postcard. */
      TAIL : { eye:at(-5.5, 3.5, 8), at:at(-4, 4.5, 0) } };
  }

  /* WHAT ION CALLS YOU. Robin's name used to be written into his lines
     because she was who RYU turned you into; you arrive as yourself now,
     so it goes in as a parameter. avatar.js decides what it resolves to. */
  const ME = () => (window.AVATAR && AVATAR.myName) ? AVATAR.myName() : t('you');
  /* ONLY THE PEOPLE WHO ARE NOT YOU. The player's portrait is whoever
     they are wearing and SCENE looks it up itself from `who:'you'` — a
     face pinned here would be a second answer, and it would be Robin's.

     The Mechanic has one now because he has a body: the same thumbnail
     tool that makes a roster face, run over his own model, so the picture
     beside his lines is the man standing in front of you rather than a
     blank panel. */
  const FACES={ Ion:'characters/previews/ion.png',
                'The Mechanic':'characters/previews/mechanic.png',
                /* Off the roster, the way person() casts every other
                   walk-on in this game. She is the first face anybody in
                   the arena has ever shown to somebody from outside it. */
                'The Usher':'characters/previews/character-t.png' };

  /* The four lines, and then the panel. Returns false if there is nothing
     to play them over, so the caller can fall through to the checklist
     rather than leaving the player pressing E at a silent ship. */
  function shipBrief(then){
    const b=shipB;
    if(!b || !b.g || !b.frame || !window.SCENE) return false;
    const S=shipShots(b);
    SCENE.play([
      { shot:S.TAIL,  ease:1.2, who:'you',
        say:t('She is still smoking.') },
      { shot:S.WIDE,  ease:1.1, who:'Ion',
        say:t('She will not start. She cannot tell if she is safe to start.') },
      { shot:S.CLOSE, ease:1.0, who:'Ion',
        /* STILL TRUE, AND NOW THE WHOLE SUBJECT. Her twenty questions are
           about exactly this: at least, at most, under, over, exactly,
           anything but — where one reading stops being allowed. */
        say:t('Her safety rules have lost the part that does the comparing.') },
      { shot:S.CLOSE, who:'you',
        /* IT SAID "NINE RULES, ONE WORD EACH", which was a description of
           the checklist panel this used to open: nine blanks with one
           comparison symbol to drop into each. That panel is gone and the
           line went stale with it — a brief that describes a screen
           nobody is about to see is worse than no brief. */
        say:t('Then I learn them. Twenty, and she tells me when I am wrong.') }
    ], { faces:FACES, end:()=>{
      if(!on) return;
      try{ if(window.PROGRESS) PROGRESS.set(SEEN,1); }catch(e){}
      G.running=true;
      if(then) then();
    }});
    return true;
  }

  function board(){
    const b=shipB;
    if(!b || !b.g || !b.frame) return false;
    /* ONCE ION IS ON THE CRADLE, GETTING IN IS GETTING IN.

       The scene below is the one that takes him to the Mechanic — "thank
       you", "and then we find out who E. is" — and he says it from the
       passenger seat. Played again after he has been handed over it is a
       robot talking to you from two floors up, thanking you for a lift he
       is not on. So the second flight has no film: you climb in and you
       fly, which is what a ship you own is for. */
    if(handed() || !window.SCENE){ embark(); return true; }
    /* The same three places the brief was shot from — she has not moved
       and neither has the house, so a second copy of these offsets would
       be a second set of numbers to keep in step with her. */
    const S=shipShots(b);
    SCENE.play([
      { shot:S.WIDE,  ease:1.2, who:'you', say:t('In you get.') },
      { shot:S.CLOSE, ease:1.1, who:'Ion',   say:t('Thank you, {n}.',{n:ME()}) },
      { shot:S.CLOSE, who:'you', say:t('The Mechanic can look inside you properly.') },
      { shot:S.CLOSE, who:'Ion',   say:t('And then we find out who E. is.') },
      { shot:S.AWAY,  ease:1.6, hold:2.4 }
    ], { faces:FACES, end:()=>{ G.running=true; embark(); }});
    return true;
  }

  /* ===================================================================
     AND THEN SHE IS IN IT.

     The parked ship goes, Robin goes with her — she is inside, not beside
     — and a second copy of the E-45 is posed wherever the player is, nose
     forward. Flying it is the flight this game already has: W to fly, A D
     to turn, SPACE up, SHIFT down. The only new thing is what is on screen
     while you do it.

     A SECOND COPY RATHER THAN THE PARKED ONE MOVED. The one on the ground
     is a BUILDING — it is in BUILDINGS, it owns solids that stop you
     walking through it, and the shadow baker has already traced light into
     it where it stands. Flying that is flying a piece of the scenery, with
     its collision box still sitting over the patch by the house.
     =================================================================== */
  function embark(){
    if(aboard) return;
    aboard=true;
    /* The parked one is gone: she is the one you are flying. Its solids go
       with it, or she takes off through her own collision box. */
    if(shipB){ if(shipB.g) shipB.g.visible=false; shipB.solids.length=0; }
    if(window.AVATAR) AVATAR.detach();         // she is inside it, not beside it
    shipModel().then(proto=>{
      if(!on || !aboard) return;
      const dress = o => { o.traverse(m=>{ if(!m.isMesh) return;
        m.material=m.material.clone(); m.material.vertexColors=true; m.frustumCulled=false; });
        return o; };
      const body=new THREE.Group();
      body.add(dress(proto.hull.clone(true)));
      body.add(dress(proto.canopy.clone(true)));   // shut again, with her in it
      body.updateMatrixWorld(true);
      const raw=new THREE.Box3().setFromObject(body);
      body.scale.setScalar(SHIP_LEN/((raw.max.z-raw.min.z)||1));
      body.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(body);
      body.position.set(-(box.min.x+box.max.x)/2, -(box.min.y+box.max.y)/2,
                        -(box.min.z+box.max.z)/2);
      /* NOSE ALONG +Z, which is the direction place() calls forward for
         everything it poses. The model is drawn nose down -Z, so it is
         turned half a circle here — the same half circle SHOP turns its
         ships through, and for the same reason. */
      const spin=new THREE.Group(); spin.add(body); spin.rotation.y=Math.PI;
      shipRide=new THREE.Group(); shipRide.add(spin);
      G.roomGroup.add(shipRide);
      G.scene.updateMatrixWorld(true);
    }).catch(e=>console.warn('PLANET: the E-45 will not fly', e));
    takeOff();
    say(t('<b>W</b> to fly, <b>A D</b> to turn, <b>SPACE</b> up, <b>SHIFT</b> down. '
        + 'The tower is the tall one.'));
  }

  /* Put her away again — leaving the world, or arriving. */
  /* GETTING OUT, AND THE SHIP IS WHERE YOU LEFT HER.

     embark() hides the parked E-45 and empties her solids, because the
     one you are flying is a second copy and taking off through your own
     collision box is not flying. Nothing ever put her back. So after the
     flight to the tower she did not exist: invisible, walk-through, her
     `dir` still pointing at the patch of dirt outside the house two
     hundred units away, and no way to fly anywhere ever again. A ship you
     can use once is a cutscene with a throttle.

     She is re-parked wherever you got out. Her direction, her tangent
     frame and her solids are all rebuilt from that spot, so she is a
     thing standing on the ground at the tower in exactly the way she was
     a thing standing on the ground at the house. */
  function disembark(){
    aboard=false;
    if(shipRide && shipRide.parent) shipRide.parent.remove(shipRide);
    shipRide=null;
    parkHere();
  }
  /* A few metres to one side of wherever the player is standing, so
     stepping out does not leave you inside her. */
  /* ===================================================================
     GETTING OUT, AT ANY POINT, WHICH THERE WAS NO WAY TO DO.

     Boarding the E-45 was a one-way door. The only thing in the whole
     file that ever called disembark() was arriveTick, which fires within
     thirty units of the tower — so a student who took off and flew
     anywhere else, or who got in and changed their mind, was in the
     cockpit for good. W A S D flew it, SPACE and SHIFT moved it up and
     down, and nothing at all got them out of it. The only way back to
     being a person was to fly at the tower until the game let them go.

     R, WHICH IS THE KEY THE CAR ALREADY USES for exactly this. It is
     "get out of the thing you are in" everywhere else on this planet,
     and a second key for a second vehicle is a second thing to remember.

     IT LANDS FIRST. Stepping out of a ship at sixty units is a fall, and
     land() is what arriveTick has always used — it puts the body back on
     its feet, clears the flying posture and sets the altitude to the
     ground under wherever she has got to. */
  function leaveShip(){
    if(!aboard) return false;
    land();
    disembark();
    if(window.AVATAR) AVATAR.attach();
    keysFor(); dash();
    say(t('Out. She is parked where you left her.'));
    return true;
  }

  function parkHere(){
    const b=shipB;
    if(!b || !b.g) return;
    const F=frameAt(me.dir, 0);
    const off=F.right.clone().multiplyScalar(7/PR);
    b.dir=me.dir.clone().add(off).normalize();
    b.frame=stand(b.g, b.dir, 0, terrainH(b.dir));
    b.g.visible=true;
    b.solids.length=0;
    b.solids.push({ x1:-2.2, x2:2.2, z1:-5.5, z2:5.5, y1:0, y2:3.4 });
    G.scene.updateMatrixWorld(true);
  }

  /* ARRIVING, which is the only thing the flight is for.

     Watched rather than triggered, because there is nothing to press: she
     flies at a tower and at some point she is at it. Thirty units is about
     seven seconds out at cruise and comfortably wider than the tower's own
     footprint, so it fires on the approach rather than on a collision —
     you are told you have arrived while the thing is still growing in the
     window, which is what arriving feels like. */
  const ARRIVE = 30;
  let arrived=false;
  /* ===================================================================
     NOTICING THE SHIP, WHICH IS NOT THE SAME AS BEING TOLD ABOUT IT.

     A student walks out of the house onto a hillside with a spaceship on
     it and, until they press E on it, nothing in the game has said that
     anything is wrong. The smoke is doing the work alone, and smoke is a
     thing you have to look at — walk out facing the other way and the
     first news of the mission is a panel.

     So she says it, to herself, the moment she is close enough to see it:
     one line at forty units and one at eighteen. This is the ONLY place
     in Mission 8 where the player's own head is on screen without a
     cutscene around it, which is exactly why it is the beginning.

     ONCE PER APPROACH AND NOT PER FRAME. `noticed` counts how many of the
     two lines have been said; walking away and coming back does not
     reset it, and the flag is not saved, because a thought is not a
     mission flag — a second session is allowed to have it again. */
  let noticed=0;
  const NOTICE=[
    { at:40, say:()=>t('That is a lot of smoke for a parked ship.') },
    { at:18, say:()=>t('She is not flying anywhere like this. Let us fix her.') }
  ];
  function noticeTick(){
    if(!on || aboard || noticed>=NOTICE.length) return;
    if(!W || W.id!=='ryu') return;
    if(shipOpen()) return;              // already mended: nothing to notice
    const b=BUILDINGS.find(x=>x.id==='ship');
    if(!b || !b.dir) return;
    const d=me.dir.angleTo(b.dir)*PR;
    if(d > NOTICE[noticed].at) return;
    say(NOTICE[noticed].say());
    noticed++;
  }

  function arriveTick(){
    if(!aboard || arrived) return;
    const tower=BUILDINGS.find(b=>b.id==='tower');
    if(!tower || !tower.dir) return;
    if(me.dir.angleTo(tower.dir)*PR > ARRIVE) return;
    arrived=true;
    land();
    disembark();
    if(window.AVATAR) AVATAR.attach();
    /* ARRIVING IS NOT FINISHING ANY MORE. This used to call
       PROGRESS.complete('ion') here, which ended Mission 8 in the car
       park outside the building: Ion asked for somebody who could look
       inside him properly, and the mission paid off before anybody had.
       The workshop on the tower's middle floor is where that happens and
       where the mission now ends — see handOver().

       IT IS STILL A LEVEL, THOUGH, and it was the one stage of this
       mission that wrote nothing down. Flying her across RYU is a third
       of an hour's work and the course had no record that it had
       happened, so a student who stopped here came back to a card that
       said PLAY. */
    if(window.ION) ION.pass('ion_flown');
    say(t('<b>THE TOWER.</b> Walk in — the <b>MECHANIC</b> is up the lift.'));
  }

  function padSpec(w){
    padB=null;
    const spot=w.pad; if(!spot) return;
    const dir=dirOf(spot.lon, spot.lat);
    /* A roof colour and an emoji it will never wear, because the MAP draws
       every building from those two fields and a pad you cannot find on the
       map is a pad you cannot fly home from. */
    padB={ id:'pad', name:'THE PAD', em:'\u{1F6F8}', prop:true, lon:spot.lon, lat:spot.lat,
           w:26, d:26, h:0, roof:0x8ff0ff, dir, frame:null, g:null, solids:[] };
    BUILDINGS.push(padB);
  }
  function launchpad(w){
    const b=padB; if(!b) return;
    const g=new THREE.Group();
    b.g=g;
    b.frame=stand(g, b.dir, 0, terrainH(b.dir));
    G.roomGroup.add(g);
    const flr=plate(b); flr.userData.lid=true; g.add(flr);

    const deck=new THREE.Mesh(new THREE.CylinderGeometry(10,10.6,0.7,32),
      new THREE.MeshLambertMaterial({color:0x54596b}));
    deck.position.y=0.35; deck.userData.flat=true; g.add(deck);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(9.2,0.36,8,48),
      new THREE.MeshBasicMaterial({color:0x8ff0ff}));
    ring.rotation.x=-Math.PI/2; ring.position.y=0.75; g.add(ring);
    // eight lamps round the rim, because a pad at night should be findable
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2, lx=Math.cos(a)*9.2, lz=Math.sin(a)*9.2;
      const post=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.2,2.2,6),
        new THREE.MeshLambertMaterial({color:0x3d4152}));
      post.position.set(lx,1.8,lz); g.add(post);
      const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.34,10,8),
        new THREE.MeshBasicMaterial({color:0x8ff0ff}));
      bulb.position.set(lx,3.1,lz); g.add(bulb);
      b.solids.push({x1:lx-0.4,x2:lx+0.4,z1:lz-0.4,z2:lz+0.4,y1:0,y2:3.4});
    }
    const light=new THREE.PointLight(0x8ff0ff, 220, 40, 1.5);
    light.position.set(0,4,0); g.add(light);

    // your own ship, parked, at a size a person could climb into
    padShip=SHOP && SHOP.model ? SHOP.model() : null;
    if(padShip){
      padShip.position.set(0, 3.1, -1.2);
      padShip.scale.setScalar(2.6);
      g.add(padShip);
      b.solids.push({x1:-3,x2:3,z1:-4.4,z2:2,y1:0,y2:4.4});
    }
    /* ONE COURSE IN THE NAV COMPUTER. There used to be a console per world
       and each one teleported you there. The ship flies for real now, and a
       route is a thing somebody has to survey — so the only one loaded is
       the run out to VOLTA, and the way home from it. The other worlds are
       still in WORLDS(); they are just not on the charts yet. */
    /* The world says where its own pad goes when it cares to. Senio and
       VOLTA are still each other's only surveyed course; RYU's is the way
       back, which is the only route off it. */
    const to = W.course || (W.id==='arena' ? 'hub' : 'arena');
    padPanel=panel(g, b, 0, 9.4, '\u{1F6F8}',
      navLabel(to), 'fly:'+to, (hasShip()||W.shuttle)?'#12304a':'#3a2a1b', 0.78, Math.PI);
  }
  let padPanel=null;
  function navLabel(to){
    const n=worldById(to).name;
    /* The sign on a shuttle pad never says NO SHIP: not owning one is not
       what is standing between you and this particular departure. */
    return (hasShip() || W.shuttle) ? t('LAUNCH')+'\n'+t('COURSE: {n}',{n})
                                    : t('NO SHIP')+'\n'+t('SEE THE MECHANIC');
  }
  /* Leaving a world and arriving at another used to be one call — enter()
     rebuilds everything that makes a world, so a teleport was free. It is
     not free any more on purpose: you fly it. What has to survive either
     way is where you were standing on the world you left, and backs[]
     remembers that. */
  function travel(to){
    const id = to || (W.kind==='home' ? 'hub' : 'home');
    if(id===W.id) return;
    /* NOTHING FLIES OFF A MISSION. There is no pad here to press, so this
       is only reachable by a route nobody has thought of — and the honest
       answer to it is the one the button in the corner already gives,
       rather than a ship that appears because a code path allowed it. */
    if(W.mission){
      say(t('Nothing launches from here. <b>LEAVE</b> takes you back to Mission Control.'));
      return;
    }
    /* A SHUTTLE WORLD LETS YOU OFF. Everywhere else the pad is a thing
       you use your own ship on, and having to buy one is the point. A
       world the game DROPPED you on is the one case where that rule
       strands somebody: no ship, no coins, and the mechanic who sells
       ships is on the planet they cannot get to. The craft that brought
       them is still on the pad. */
    if(!W.shuttle && !hasShip()){
      say(t('You have no ship. <b>THE MECHANIC</b> has one waiting.'));
      return;
    }
    /* A SHUTTLE IS NOT A FLIGHT. CRUISE knows where two planets are —
       Senio and VOLTA — and every other id it is handed comes back as
       Senio, so a run from a third world to Senio would start and end at
       the same point in space: a course of zero length, a heading off a
       vector with no direction in it, and a player left sitting in a ship
       pointed at nothing. The way off a world the game put you on is the
       craft that brought you, and it simply takes you. */
    if(W.shuttle && !hasShip()){
      leave(); enter(server, id);
      say(t('The shuttle sets you down on {n}.',{n:worldById(id).name}));
      return;
    }
    if(!window.CRUISE){                      // the flight failed to load: walk it in
      leave(); enter(server, id);
      say(t('Touched down on {n}.',{n:worldById(id).name}));
      return;
    }
    const back=W.id;
    leave();
    CRUISE.launch(server, id, back);
  }


  /* ===================================================================
     THE TOWER — three floors and the lift that joins them.

     IT WAS FIFTY-EIGHT UNITS OF NOTHING. The tower is placed so that it is
     just visible from the front door and can only be reached by flying,
     and both of those are load-bearing: the gap you cannot cross on foot
     is the mission. Then you land at it, and it is a hollow shell with
     windows. `Mr Einstein is up there` was a sentence about a place the
     game had no way to let anybody go.

     WHY THE MECHANIC LIVES HERE. Ion asks to be taken to the Mechanic.
     There is a Mechanic on Senio and it sells cars — it is a showroom,
     and the person in the story who can "look inside you properly" was
     never in it. Sending a player back to Senio to finish Mission 8 also
     means the mission's last beat happens on a different planet, two
     loading screens after the thing that set it up. So the Mechanic is on
     the tower's middle floor, and Mission 8 begins and ends on RYU.

     THREE STOPS, and they are three because the story has three: you
     arrive, you hand Ion over, and you go up to the person the whole
     thing has been pointing at.

         0    GROUND      where you walk in
        19    THE WORKSHOP  the Mechanic, and Ion's examination
        40    THE TOP     Mr Einstein, and the view

     THE LIFT IS AGAINST THE BACK WALL rather than up the middle. A shaft
     in the centre of a sixteen-metre room leaves four corridors round it
     and no floor; against a wall it leaves one room per storey, which is
     what each of these floors actually needs to be.
     =================================================================== */
  /* ===================================================================
     THE GLASSES, AND WHAT IS ON THE RIDGE WHEN YOU PUT THEM ON.

     The Mechanic spends the whole mission with his hands inside a robot,
     and the one tool he actually needs for that is a pair of glasses that
     show him what a machine is putting out rather than what it looks
     like — an engine's frequency signature, which is how he can tell a
     good hum from a bearing about to go. He lends them to you because
     you asked what he was squinting at.

     THEY ARE NOT A CUTSCENE. Handed over, they stay yours: G puts them on
     and takes them off for the rest of the mission, anywhere on RYU. A
     tool that works exactly once, in the room it was given to you in, is
     a prop with a key binding.

     AND THE PLANET HAS SOMETHING ON IT AT THAT FREQUENCY. Two machines
     the size of the tower, on the ridge, going at each other — see
     brawl.js. Nobody mentions them and nothing points you at them; the
     first time is meant to be you turning round with the glasses on.

     WHY A FLAG AND NOT A VARIABLE. `ion_specs` is under Mission 8's own
     prefix, which is load-bearing: PROGRESS.restart('ion') forgets every
     key beginning with `ion_`, so starting the mission over takes the
     glasses back along with the smoke and the checklist. The same rule
     `ship_cleared` had to be renamed to obey.
     =================================================================== */
  const SPECS='ion_specs';
  const haveSpecs = () => { try{ return !!(window.PROGRESS && PROGRESS.get(SPECS,0)); }
                            catch(e){ return false; } };
  let specsOn=false, specsEl=null;

  /* WHERE IT IS. Out past the tower, and that distance is the whole
     design rather than a number picked to look nice.

     THE BOWL IS A HUNDRED AND THIRTY UNITS OF RADIUS, which is 31 degrees
     of this planet. Put it on the next hill and the stands swallow the
     tower — the Mechanic's building is 118 units from the obvious spot,
     which is INSIDE the cheap seats. So it goes where there is room: 199
     units from the tower and 384 from the house, leaving 70 units of
     clear desert between the outer lip and anything anybody built.

     AND IT MUST NOT REACH THE POLE. A bowl centred at latitude 56 has its
     far rim at latitude 98, which is not a latitude — the lathe wraps it
     back over the top of the world and the stands fold through
     themselves. At 20 the far rim finishes at 51, well short of both the
     pole and the ice cap that starts at 69.

     AND THAT IS ALSO WHY YOU HAVE TO FLY. The ground falls away as
     R*(1-cos(d/R)), so from the tower sixty of the machines' ninety-five
     units are under the curve and what you actually see, the first time
     you put the glasses on outside, is two heads and a shoulder moving
     on the skyline at eleven degrees. That is a question, not a view.
     The answer is a hundred and seventy units away and you own a ship.

     A BODY THIS TALL IS VISIBLE MUCH FURTHER THAN THE GROUND IS. The
     horizon from eye height here is 29 units; the distance at which
     something of height h clears it is sqrt(2*R*h) beyond that, and for
     95 units that is another 213. There is nowhere on RYU you cannot see
     them from, which is the point of making them this big rather than
     merely large. */
  const BRAWL_AT={ lon:91, lat:20 }, BRAWL_TALL=95, BRAWL_GAP=40;
  function brawlBuild(){
    if(!window.BRAWL || !W || W.id!=='ryu') return;
    const C0=dirOf(BRAWL_AT.lon, BRAWL_AT.lat), F0=frameAt(C0, 0);
    /* WHICH WAY THE GATE FACES, which is the way everybody comes from.
       The tower's direction, projected into the arena's own frame and
       turned into the angle brawl.js lays its rings out in. */
    const tb=BUILDINGS.find(x=>x.id==='tower');
    let gateAt=Math.PI;
    if(tb && tb.dir){
      const t=facing(C0, tb.dir);
      gateAt=Math.atan2(t.dot(F0.fwd), t.dot(F0.right));
    }
    const r=BRAWL.build({ parent:G.roomGroup, tall:BRAWL_TALL,
                          gap:BRAWL_GAP, PR, ground:brawlGround(C0, F0),
                          gate:gateAt });
    if(!r || !r.root) return;
    /* THE WHOLE PLACE IS ONE GROUP STOOD ON THE BALL ONCE, and everything
       inside it — nine tiers, the crowd, both machines — is in that
       group's frame. The alternative is placing two thousand objects on a
       sphere individually, which is the same maths done two thousand
       times and wrong in two thousand places. brawl.js does its own
       curvature inside the frame, because at a hundred and forty units
       across, flat is not an approximation, it is a different shape. */
    const C=dirOf(BRAWL_AT.lon, BRAWL_AT.lat);
    const F=frameAt(C, 0);
    r.root.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(F.right, F.up, F.fwd));
    /* AT PR EXACTLY, not at PR+floorAt. brawl.js measures every height
       from the ball's own radius and adds the ground under each vertex
       itself, so lifting the root by the height at the middle as well
       would count the same hill twice. */
    r.root.position.copy(C).multiplyScalar(PR);
    /* AND THE GATE IS A DOOR, which means it is in G.hits like every
       other door on this planet. It is invisible with the glasses off,
       and E on a thing you cannot see is E on nothing — hidden with the
       rest of the arena, because the whole root goes. */
    const door=BRAWL.gate;
    if(door){
      const hold=new THREE.Object3D();
      hold.userData={ kind:'machine', label:t('THE ARENA'), enter:'brawlgate' };
      r.root.add(hold);
      door.userData.owner=hold;
      door.userData.verb='E \u2014 go in';
      G.hits.push(door);
    }
  }
  /* The height of RYU's own ground, anywhere in the arena's frame, asked
     for the way brawl.js thinks: arc distance out and angle round. It
     cannot ask for itself — floorAt and the noise under it live here and
     there is no reason for a second file to hold a copy of this world's
     terrain. */
  function brawlGround(C, F){
    return (d, ph)=>{
      const th=d/PR, s=Math.sin(th), c=Math.cos(th);
      const dir=C.clone().multiplyScalar(c)
        .add(F.right.clone().multiplyScalar(s*Math.cos(ph)))
        .add(F.fwd  .clone().multiplyScalar(s*Math.sin(ph)));
      return floorAt(dir.normalize());
    };
  }

  /* THE OVERLAY. Looking through a pair of these is not the same picture
     with a robot added to it — it is a different instrument, and it has to
     announce itself the moment it goes on or the reveal reads as a bug.
     A cyan cast, a vignette, scan lines, and the readout he actually uses
     them for along the bottom. */
  function specsUI(){
    if(specsEl) return specsEl;
    const d=document.createElement('div');
    d.id='specs';
    /* PLAIN ALPHA, AND NOT A BLEND MODE. The first version screened a cyan
       layer over the scene and multiplied a vignette on top of that, which
       is exactly how you would do it in a compositor and does not work
       here: mix-blend-mode blends an element with its backdrop WITHIN ITS
       OWN STACKING CONTEXT, and this overlay is position-fixed with a
       z-index, which makes it a stacking context. So the two layers
       blended against each other and against nothing else, and what went
       on screen was an opaque turquoise sheet with the game behind it.

       Three transparent layers composited the ordinary way do the whole
       job: scan lines on top, a vignette that closes the picture down to
       a lens, and a flat cyan wash under both. */
    d.style.cssText=
      'position:fixed;inset:0;pointer-events:none;z-index:40;display:none;'
     +'background:'
     +'repeating-linear-gradient(0deg,rgba(0,0,0,0.20) 0 1px,'
     +'rgba(0,0,0,0) 1px 3px),'
     +'radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 34%,'
     +'rgba(0,26,34,0.50) 76%,rgba(0,10,16,0.88) 100%),'
     +'linear-gradient(rgba(0,214,198,0.17),rgba(0,214,198,0.17))';
    const bar=document.createElement('div');
    bar.style.cssText=
      'position:absolute;left:0;right:0;bottom:0;padding:6px 12px;'
     +'font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;'
     +'letter-spacing:.14em;color:#7ffbe6;text-shadow:0 0 6px rgba(0,255,220,.55);'
     +'background:linear-gradient(0deg,rgba(0,20,26,.72),rgba(0,20,26,0))';
    bar.id='specsRead';
    d.appendChild(bar);
    document.body.appendChild(d);
    specsEl=d;
    return d;
  }
  /* The readout is the engine's signature, which is the thing he lent them
     to you for. It moves, because a frozen number on a diagnostic display
     is a photograph of one. */
  /* AND IT POINTS AT THE ARENA, which is the only part of this that is
     not decoration. The bowl is 199 units from the tower: over the
     horizon from the ground, big enough to be worth flying to, and on a
     sphere there is no other way to be told where anything is. A bearing
     and a range is what an instrument would give you, and it turns
     "there is something out there" into a heading — which is the whole
     difference between a rumour and a place.

     RELATIVE TO THE NOSE, not to any fixed direction. There is no compass
     on a ball whose poles are nowhere in particular; what the player has
     is a heading, and what they need is how far to turn it. */
  let specsAt=0;
  function bearingToArena(){
    if(!W || W.id!=='ryu') return null;
    const C=dirOf(BRAWL_AT.lon, BRAWL_AT.lat);
    const arc=me.dir.angleTo(C)*PR;
    const want=facing(me.dir, C);
    const F=frameAt(me.dir, 0);
    const left=new THREE.Vector3().crossVectors(F.up, me.fwd).normalize();
    return { arc, turn:Math.atan2(want.dot(left), want.dot(me.fwd)) };
  }
  function specsTick(dt){
    if(!specsOn || !specsEl) return;
    specsAt+=dt;
    if(specsAt<0.12) return;
    specsAt=0;
    const r=document.querySelector('#specsRead'); if(!r) return;
    const hz=118 + Math.sin(performance.now()/900)*6;
    const n=12, bars=[];
    for(let i=0;i<n;i++){
      const a=Math.abs(Math.sin(performance.now()/420 + i*0.8))*0.8
             +Math.abs(Math.sin(performance.now()/170 + i*2.3))*0.2;
      bars.push('\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588'[Math.min(7,(a*8)|0)]);
    }
    let tail='';
    const b=bearingToArena();
    if(b){
      const deg=Math.round(b.turn*180/Math.PI);
      /* Inside it, a bearing to the middle of the floor you are standing
         on is noise. Say where you are instead. */
      tail = b.arc < (window.BRAWL ? BRAWL.radius : 130)
        ? '   \u25c9 ARENA'
        : '   \u25c9 '+Math.round(b.arc)+'u '
          + (Math.abs(deg)<8 ? 'AHEAD'
             : (deg>0 ? '\u21b0 '+Math.abs(deg)+'\u00b0'
                      : '\u21b1 '+Math.abs(deg)+'\u00b0'));
    }
    r.textContent='E-45 DRIVE  '+hz.toFixed(1)+' Hz  '+bars.join('')+tail+'   [G] OFF';
  }
  /* ARRIVING. Said once per session, when the glasses are on and the
     player is inside the outer lip — because flying two hundred units to
     a thing you found yourself deserves the game to admit you found it,
     and because a student who fell into the bowl without reading the
     bearing should still be told what they are standing in. */
  let greeted=false;
  function arenaGreet(){
    if(greeted || !specsOn || !W || W.id!=='ryu' || !window.BRAWL || !BRAWL.ready) return;
    const C=dirOf(BRAWL_AT.lon, BRAWL_AT.lat);
    if(me.dir.angleTo(C)*PR > BRAWL.radius) return;
    greeted=true;
    say(t('<b>{n} SEATS.</b> Nobody here has ever been seen.',
          {n:BRAWL.seats.toLocaleString()}));
  }

  function specsShow(v){
    if(v && !haveSpecs()) return false;
    /* A NET UNDER BOTH OF THE ABOVE. build() is idempotent, so the cost of
       asking again here is nothing, and it means a save that somehow has
       the flag without having passed through either path still sees a
       fight rather than an empty ridge. */
    if(v) brawlBuild();
    specsOn=!!v;
    specsUI().style.display = specsOn ? 'block' : 'none';
    if(window.BRAWL){ if(specsOn) BRAWL.show(); else BRAWL.hide(); }
    return true;
  }
  /* G, and only where there is anything to see through them. */
  function specsKey(){
    if(!on || !haveSpecs()) return false;
    specsShow(!specsOn);
    say(specsOn ? t('<b>FREQUENCY.</b> Something is on the ridge.')
                : t('Glasses off.'));
    return true;
  }
  function specsOff(){
    specsOn=false;
    if(specsEl) specsEl.style.display='none';
    if(window.BRAWL) BRAWL.hide();
  }

  /* WHERE THE FLOORS ARE, AND IT IS THE WINDOWS THAT DECIDE.

     THE FIRST VERSION TYPED IN 19 AND 40, which looked reasonable against
     a fifty-eight metre tower and was wrong twice: shell() puts this
     building's two rows of windows at 30% and 64% of its height — 17.4
     and 37.1 — so a deck at 19 lays its floor directly ACROSS the glass.
     Both storeys came out as sealed blue boxes, and the top one is a room
     whose entire reason to exist is that you can see out of it.

     So the stops are read off the same formula the walls are built from.
     A deck sits just under its row's sill, which puts three metres of
     window at standing height in front of anybody who steps out of the
     lift. Re-derived per building, so a tower of a different height still
     gets floors with windows in them. */
  function towerStopsFor(b){
    const H=b.h||9;
    const rows = H>14 ? 2 : 1;
    const winH = Math.min(3.0, (H-3)/(rows+0.7));
    const yOf = r => H*(rows===1 ? 0.52 : (0.30 + r*0.34));
    const deck = r => Math.round((yOf(r) - winH/2 - 0.2)*10)/10;
    const names=['THE WORKSHOP','THE TOP'];
    const out=[{ y:0, name:'GROUND' }];
    for(let r=0;r<rows;r++) out.push({ y:deck(r), name:names[r] || 'FLOOR '+(r+1) });
    return out;
  }
  let TOWER_STOPS = [{ y:0, name:'GROUND' }];
  /* The shaft, in the building's own frame. Everything else about a floor
     is "the part of it that is not this". */
  /* THE SHAFT, AND IT IS OFF THE BACK WALL ON PURPOSE.

     It began flat against it, which is where a lift belongs in a real
     building and is wrong in a room that is a flat box tangent to a
     sphere. A rider goes straight UP the radius, and that carries them
     outward in the building's own axes — about fifteen per cent by the
     top floor — so somebody who steps into a car at the back of the room
     arrives a metre deeper into the back wall than they started,
     overlapping a solid and unable to walk in any direction at all. It
     looked perfect: the car drew correctly and the ride worked, and you
     simply could not get out at the other end.

     So the whole car sits well inside the room, where fifteen per cent of
     its distance from the middle is comfortably less than the clearance
     to a wall. The floors tile round it on all four sides rather than
     three. */
  const SHAFT = { x1:-2.2, x2:2.2, z1:-5.6, z2:-1.6 };
  let lift=null;                  // {g, at, to, t, panel}
  let mechB=null;                 // the workshop, once it is standing

  function towerRoom(g, b, hw, hd){
    b.decks=[];
    TOWER_STOPS=towerStopsFor(b);
    const wall=new THREE.MeshLambertMaterial({color:0x2e2a44});
    const deckMat=new THREE.MeshLambertMaterial({color:0x4a4668});
    const trim=new THREE.MeshLambertMaterial({color:0x8ff0ff});

    /* ---- the floors themselves --------------------------------------
       Each storey above the ground is a slab with the shaft cut out of
       it, which as rectangles is the room in front plus the two strips
       either side of the shaft. Drawn AND registered from the same three
       numbers, so what you can see and what you can stand on cannot drift
       apart. */
    const parts = [
      { x1:-hw, x2:hw, z1:SHAFT.z2, z2:hd },                  // in front of it
      { x1:-hw, x2:hw, z1:-hd, z2:SHAFT.z1 },                 // behind it
      { x1:-hw, x2:SHAFT.x1, z1:SHAFT.z1, z2:SHAFT.z2 },      // and either side
      { x1:SHAFT.x2, x2:hw, z1:SHAFT.z1, z2:SHAFT.z2 }
    ];
    TOWER_STOPS.forEach((st,i)=>{
      if(i===0) return;                 // the ground is the building's own plate
      parts.forEach(q=>{
        const w=q.x2-q.x1, d=q.z2-q.z1;
        const slab=new THREE.Mesh(new THREE.BoxGeometry(w,0.4,d), deckMat);
        slab.position.set((q.x1+q.x2)/2, st.y-0.2, (q.z1+q.z2)/2);
        slab.userData.flat=true;
        g.add(slab);
        b.decks.push({ y:st.y, x1:q.x1, x2:q.x2, z1:q.z1, z2:q.z2 });
      });
      /* A RAIL ROUND THE SHAFT OPENING, because a hole in the floor you
         cannot see is a hole you walk into. It is a solid as well as a
         picture: the way down is the lift, not the drop. */
      const bar=new THREE.Mesh(new THREE.BoxGeometry(SHAFT.x2-SHAFT.x1,0.9,0.25), trim);
      bar.position.set(0, st.y+0.45, SHAFT.z2+0.1);
      g.add(bar);
    });

    /* ---- the lift ----------------------------------------------------
       A platform, and a panel standing on it. The platform is a deck like
       any other, so standing on it while it moves is not a special case
       anywhere in the walk loop — floorAt() reads its height every frame
       and a grounded walker is pinned to whatever floorAt says. */
    const car=new THREE.Group();
    const floorSlab=new THREE.Mesh(
      new THREE.BoxGeometry(SHAFT.x2-SHAFT.x1, 0.35, SHAFT.z2-SHAFT.z1), deckMat);
    floorSlab.position.y=-0.175; floorSlab.userData.flat=true; car.add(floorSlab);
    /* Three posts and a roof, so from outside it reads as a cage going up
       the back of the tower rather than a tile sliding through the air. */
    [[SHAFT.x1+0.3,SHAFT.z1+0.3],[SHAFT.x2-0.3,SHAFT.z1+0.3],
     [SHAFT.x1+0.3,SHAFT.z2-0.3],[SHAFT.x2-0.3,SHAFT.z2-0.3]].forEach(([px,pz])=>{
      const post=new THREE.Mesh(new THREE.BoxGeometry(0.22,2.8,0.22), trim);
      post.position.set(px, 1.4, pz-((SHAFT.z1+SHAFT.z2)/2)); car.add(post);
    });
    const lamp=new THREE.PointLight(0xbfe9ff, 90, 26, 1.5);
    lamp.position.set(0, 2.5, 0); car.add(lamp);
    car.position.set(0, 0, (SHAFT.z1+SHAFT.z2)/2);
    g.add(car);
    b.decks.push({ y:0, x1:SHAFT.x1, x2:SHAFT.x2, z1:SHAFT.z1, z2:SHAFT.z2, lift:true });
    const deck=b.decks[b.decks.length-1];

    /* THE ONE BUTTON. It goes to the next stop up and wraps round to the
       ground from the top, so there is no menu, no floor list, and no way
       to be stuck between two storeys — press it again and you are
       somewhere, always. The face says where it is GOING, not where it
       is, because the question anybody has in a lift is the former. */
    const p=panel(g, b, 0, SHAFT.z1+0.7, '↑',
                  t('LIFT')+'\n'+t(TOWER_STOPS[1].name), 'lift', '#1b2740', 0.55, 0);
    car.add(p);
    p.position.set(0, 0, SHAFT.z1+0.7-((SHAFT.z1+SHAFT.z2)/2));
    /* AND ITS SOLID GOES. panel() pushes a box the size of the console so
       you cannot walk through a station — right everywhere else, and
       wrong here twice over: the box would stand in the one square metre
       of floor you have to be standing on to press it, and it would stay
       at ground level for ever while the console it describes rode away
       up the shaft. The car's own walls are what stop you here. */
    b.solids.pop();

    lift={ g:car, deck, at:0, from:0, to:0, t:1, panel:p, b };

    /* ---- what is on each floor -------------------------------------- */
    towerLobby(g, b, hw, hd);
    workshop(g, b, hw, hd, TOWER_STOPS[1].y);
    towerTop(g, b, hw, hd, TOWER_STOPS[2].y);
  }

  /* Where the lift is going next, said on its own face. */
  function liftFace(){
    if(!lift || !lift.panel) return;
    const next=(lift.at+1) % TOWER_STOPS.length;
    const face=lift.panel.userData.glow;
    if(!face) return;
    if(face.material.map) face.material.map.dispose();
    face.material.map=panelTex('↑', t('LIFT')+'\n'+t(TOWER_STOPS[next].name), '#1b2740');
    face.material.needsUpdate=true;
  }
  /* Called by E on the panel. Refuses while it is moving, because a lift
     that changes its mind halfway is a lift that drops you through a
     floor that is no longer under you. */
  function liftGo(){
    if(!lift) return;
    if(lift.t<1){ say(t('It is already moving.')); return; }
    /* AND YOU HAVE TO BE ON IT.

       E works at arm's length — that is what makes it E and not a
       pressure plate — so the button could be pressed from beside the
       shaft, and the deck went up without its passenger. What you saw
       then was the floor name change, a lift disappearing into the
       ceiling, and yourself still in the lobby: the game announcing you
       had arrived somewhere you were not. Worse on the way down, where
       it left and the shaft was then a hole.

       INSIDE THE SHAFT AND ON THE DECK. Both, because the shaft is a
       column three floors tall and standing in it on the ground floor
       while the deck is at the top is not being on the lift either.
       DECK_GRIP is the same half-metre floorAt() uses to decide it is
       carrying you, so this asks exactly the question the ride will go
       on asking every frame afterwards. */
    const tb=BUILDINGS.find(x=>x.id==='tower');
    if(tb && tb.frame){
      const l=local(tb, worldPos(0));
      const onDeck = l.x>SHAFT.x1 && l.x<SHAFT.x2
                  && l.z>SHAFT.z1 && l.z<SHAFT.z2
                  && Math.abs(l.y - TOWER_STOPS[lift.at].y) < DECK_GRIP + 1.4;
      if(!onDeck){ say(t('Step onto the lift first.')); return; }
    }
    lift.from=TOWER_STOPS[lift.at].y;
    lift.at=(lift.at+1) % TOWER_STOPS.length;
    lift.to=TOWER_STOPS[lift.at].y;
    lift.t=0;
    if(window.beep) beep('pop');
    say(t('<b>{n}</b>',{n:t(TOWER_STOPS[lift.at].name)}));
  }
  /* HOW FAST, AND IT IS NOT A MATTER OF TASTE.

     A rider stays on this thing because floorAt() hands them the deck's
     height every frame, and it only does that while they are within
     DECK_GRIP of it — half a metre. So the deck may never climb more than
     half a metre BETWEEN TWO FRAMES, or it steps out from under whoever
     is on it and carries on up empty, leaving them standing on the ground
     floor watching it go.

     The worst frame is the longest one: game.js clamps dt to 0.05, so the
     bound is `peak speed × 0.05 < 0.5`, i.e. under ten units a second at
     the fastest point of the ride. Eased travel peaks at 1.5× its average,
     so holding the average to LIFT_SPEED = 5 puts the peak at 7.5 and the
     worst frame at 0.375 — comfortably inside the grip with room for the
     floors to move without this having to be re-derived.

     THE FIRST VERSION WAS A FIXED FOUR SECONDS scaled by an inverse
     distance, which made SHORT hops the fast ones: fifteen metres went by
     in about a second and a half, peaking near fifteen units a second and
     0.75 of a metre on a slow frame. It worked every time it was tried,
     because it only comes apart on a frame that hitches. */
  const LIFT_SPEED = 5;               // units a second, averaged over the ride
  const LIFT_MIN   = 1.2;             // and never snappier than this
  function liftTick(dt){
    const L=lift; if(!L || L.t>=1) return;
    const far=Math.abs(L.to-L.from);
    const forSecs=Math.max(LIFT_MIN, far/LIFT_SPEED);
    L.t=Math.min(1, L.t + dt/forSecs);
    const u=L.t*L.t*(3-2*L.t);
    const y=L.from + (L.to-L.from)*u;
    L.g.position.y=y;
    L.deck.y=y;                       // what the player is standing on
    if(L.t>=1) liftFace();
  }


  /* A person standing in a room, which on this planet means three things:
     a group at their feet, an invisible box the size of a body so the
     raycast has something to hit from the first frame, and a model that
     turns up later or does not turn up at all. Lifted out of librarian(),
     which did all three inline and is now the second caller rather than
     the only one.

     `y` is the floor they are standing on — the librarian is on the
     ground and did not need one; the Mechanic is nineteen units up. */
  let folk=[];                    // the people standing in the tower
  /* `body` is either a named body — 'mechanic', 'ion' — or a number,
     which picks somebody off the roster who is not the player. A story
     character wants the first: the Mechanic is a man in a tweed suit with
     his own model and his own talking clips, and casting him from whoever
     the student did not choose made him a different person every session. */
  /* `speaks` is the name this person's lines are written under, which is
     NOT the name on their plate: the plate says THE MECHANIC because it
     is a label on a nameplate, and the beats say 'The Mechanic' because
     it is a person talking. Matching one against the other by folding
     case would work until somebody writes a character whose plate and
     dialogue differ by more than that. */
  function person(g, b, x, y, z, who, opens, body, tint, speaks){
    const grp=new THREE.Group();
    grp.position.set(x, y+0.1, z);     // the tenth of a metre a model's feet hang low
    g.add(grp);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(1.5,2.1,1.2),
      new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true,
                                    opacity:0, depthWrite:false }));
    hit.position.set(x, y+1.15, z); g.add(hit);
    hit.userData.owner=grp;
    grp.userData={ kind:'npc', label:who, enter:opens };
    G.hits.push(hit);
    const tag = window.OWN ? OWN.plate(who, tint||0xffe9a8) : null;
    if(tag){ tag.position.set(x, y+2.8, z); tag.scale.set(3.4,0.85,1); g.add(tag); }
    const me_={ g:grp, b, x, y, z, model:null, yaw:0, speaks:speaks||null };
    folk.push(me_);
    if(window.AVATAR){
      const id = typeof body==='string' ? body : AVATAR.other(body||1);
      AVATAR.load(id).then(root=>{
        if(!on || !grp.parent) return;
        grp.add(root); me_.model=root;
      }).catch(()=>{});
    }
    return grp;
  }
  /* BREATHING, AND TURNING TO LOOK AT YOU. A loaded body with nothing
     driving it stands in the T-pose the file was exported in, which is
     not a person, it is a diagram of one — and the whole reason there is
     somebody in this room rather than a console is that Ion asked for a
     PERSON. Same two things the librarian does, for the same reason, and
     now out of one list rather than one variable.

     The floor goes into the distance test. Two of these are twenty-one
     units apart up the same shaft, and without the height the Mechanic
     turns to follow somebody who is standing on the floor above her. */
  function folkTick(dt){
    if(!folk.length || !window.AVATAR) return;
    for(const f of folk){
      if(!f.b || !f.b.frame) continue;
      const l=local(f.b, worldPos(0));
      const near = Math.abs(l.x-f.x)<11 && Math.abs(l.z-f.z)<13
                && Math.abs(l.y-f.y)<4;
      const want = near ? Math.atan2(l.x-f.x, l.z-f.z) : 0;
      let d=want-f.yaw;
      while(d>Math.PI) d-=Math.PI*2; while(d<-Math.PI) d+=Math.PI*2;
      f.yaw += d*Math.min(1, 4*dt);
      f.g.rotation.y=f.yaw;
      /* AND THEY MOVE WHILE THEY TALK. Every character in this game
         delivered every line standing perfectly still, because the only
         thing choosing a clip was whether the body was walking and
         nobody walks in a cutscene. SCENE knows whose line is on screen
         and alternates the two clips by beat, so six lines running are
         not one loop six times. */
      let clip='idle';
      if(f.speaks && window.SCENE && SCENE.speaker===f.speaks){
        const want=SCENE.talkClip;
        if(AVATAR.can && f.model) clip = want;      // rigOf falls back on its own
      }
      if(f.model) AVATAR.animate(f.model, dt, clip);
    }
  }

  /* ---------------------------------------------------------- GROUND
     A lobby, and it is deliberately nearly empty. This is the first room
     of a building the player has just flown two hundred units to reach,
     and the only thing it has to do is make the lift obvious — so the
     lift is lit, everything else is dark, and there is one sign. */
  function towerLobby(g, b, hw, hd){
    const lampMat=new THREE.MeshBasicMaterial({color:0xbfe9ff});
    [-hw+2.5, hw-2.5].forEach(x=>{
      const strip=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.4,hd*1.2), lampMat);
      strip.position.set(x, 5.4, 1); g.add(strip);
      const pl=new THREE.PointLight(0xbfe9ff, 120, 30, 1.5);
      pl.position.set(x, 5, 1); g.add(pl);
    });
    panel(g, b, hw-3.2, hd-3.4, '\u{1F5FC}',
          t('THE TOWER')+'\n'+t('Mr Einstein is at the top'), 'towersign', '#22406b', 0.6, -Math.PI/4);
  }

  /* ------------------------------------------------------- THE WORKSHOP
     WHERE MISSION 8 ACTUALLY ENDS. Ion asked to be taken to somebody who
     could look inside him properly, and this is the room where that
     happens: a cradle with a lamp over it, racks of parts down one wall,
     and the Mechanic standing beside it.

     THE CRADLE IS EMPTY UNTIL HE IS IN IT, which is the only piece of
     state this room has. Before the handover it is a bench with a light
     on; afterwards Ion is lying on it. */
  function workshop(g, b, hw, hd, y){
    const steel=new THREE.MeshLambertMaterial({color:0x5b6478});
    const dark=new THREE.MeshLambertMaterial({color:0x35304a});

    /* the cradle, across the middle of the room */
    const bed=new THREE.Mesh(new THREE.BoxGeometry(5.2,0.4,2.4), steel);
    bed.position.set(-1.5, y+1.0, 2.2); g.add(bed);
    [[-3.6,1.2],[0.6,1.2],[-3.6,3.2],[0.6,3.2]].forEach(([lx,lz])=>{
      const leg=new THREE.Mesh(new THREE.BoxGeometry(0.3,1.0,0.3), dark);
      leg.position.set(lx, y+0.5, lz); g.add(leg);
    });
    b.solids.push({x1:-4.1,x2:1.1,z1:1.0,z2:3.4,y1:y,y2:y+1.3});
    /* the lamp over it, which is what makes it read as a table somebody
       works at rather than a shelf */
    const hood=new THREE.Mesh(new THREE.ConeGeometry(1.1,0.9,14), dark);
    hood.position.set(-1.5, y+3.4, 2.2); g.add(hood);
    const bulb=new THREE.PointLight(0xfff2d8, 150, 20, 1.6);
    bulb.position.set(-1.5, y+2.8, 2.2); g.add(bulb);

    /* parts down the back wall — a workshop with nothing on its shelves
       is an office */
    const bits=[0x8fd3ff,0xffb4a2,0xa8e6cf,0xcdb4f6,0xffe9a8];
    for(let k=0;k<4;k++){
      const shelf=new THREE.Mesh(new THREE.BoxGeometry(hw*0.8,0.18,1.2), dark);
      shelf.position.set(hw-3.2, y+1.2+k*1.1, -1.5);
      shelf.rotation.y=Math.PI/2; g.add(shelf);
      for(let i=0;i<4;i++){
        const it=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), lam(bits[(i+k)%bits.length]));
        it.position.set(hw-3.2, y+1.6+k*1.1, -4.2+i*1.8); g.add(it);
      }
    }
    const fill=new THREE.PointLight(0xdfe9ff, 70, 26, 1.5);
    fill.position.set(0, y+4.5, 0); g.add(fill);

    /* THE MECHANIC. The person, not the shop — and he is what Ion was
       asking for from the moment he was found on the floor. */
    /* WHERE HE ENDS UP LYING, measured to the bench rather than to the
       room. The cradle's top is y+1.2 (its slab is centred at y+1.0 and
       is 0.4 thick); laid on his back a body is about 0.4 through the
       chest, so his origin sits 0.2 above that and his back rests on the
       surface. `x` is his FEET — he extends about 1.8 towards the head
       end — so -2.4 puts the middle of him on the middle of the bench. */
    mechB={ b, y, bed:{x:-2.4, y:y+1.4, z:2.2}, g, ion:null };
    /* BESIDE THE CRADLE, NOT BEHIND IT. He was at z 4.2, which is on the
       far side of a bench two and a half metres deep — so from the lift,
       which is the only direction anybody arrives from, the bench cut him
       off at the neck and the room read as a nameplate floating over a
       table. At the end of it he is in the clear from the door and still
       obviously working at the thing he is standing next to. */
    person(g, b, 3.4, y, 2.2, t('THE MECHANIC'), 'towermech', 'mechanic', 0x8ff0ff,
           'The Mechanic');
  }

  /* ------------------------------------------------------------ THE TOP
     WHERE THE NEXT THING STARTS. Mr Einstein is the name the mission has
     been carrying since Ion said it, and this is the first time anybody
     has been able to get to him.

     AND IT IS NOT A LOOKOUT, THOUGH IT LOOKS LIKE IT SHOULD BE. The floor
     is set just under a row of the tower's own windows, so the room has
     three metres of bright panel at standing height all the way round and
     reads as being high up — but you cannot actually see through them.
     A window in this game is decoration on the outside of a solid wall:
     the pane is a box drawn INSIDE a larger sill box, so the glass is
     never visible from either side, and the wall behind both is whole.
     Making one room see out would mean cutting holes in geometry every
     building on every planet shares. Worth doing one day; it is not what
     a lift and three floors were for. */
  function towerTop(g, b, hw, hd, y){
    const dark=new THREE.MeshLambertMaterial({color:0x35304a});
    /* a desk at the window, with the note on it */
    const desk=new THREE.Mesh(new THREE.BoxGeometry(5.0,0.3,2.0), dark);
    desk.position.set(0, y+1.1, hd-3.0); g.add(desk);
    b.solids.push({x1:-2.5,x2:2.5,z1:hd-4.0,z2:hd-2.0,y1:y,y2:y+1.3});
    const paper=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.04,1.5),
      new THREE.MeshLambertMaterial({color:0xf0ead8}));
    paper.position.set(-1.2, y+1.28, hd-3.0); paper.rotation.y=0.2; g.add(paper);

    const glow=new THREE.PointLight(0xbfe9ff, 110, 28, 1.5);
    glow.position.set(0, y+4.2, 0); g.add(glow);

    person(g, b, 1.4, y, hd-4.6, t('MR EINSTEIN'), 'einstein', 3, 0xffd8a8,
           'Mr Einstein');
  }


  /* ===================================================================
     HANDING ION OVER, WHICH IS THE END OF MISSION 8.

     IT USED TO END ON THE TARMAC. Landing within thirty units of the
     tower called PROGRESS.complete('ion') and said "Mr Einstein is up
     there" — so the mission's last act was arriving outside a building,
     and the thing Ion actually asked for never happened on screen. He
     wanted somebody who could look inside him properly; the player flew
     him two hundred units to get it; and then the mission ended in a car
     park.

     So it ends where it was always going to: on the cradle, with the
     Mechanic looking at him. Landing is now an arrival and says so.

     ONCE. `ion_handed` is under the mission's own prefix, so starting
     over brings this back with the brief and the smoke — the same rule
     the checklist's flag had to be renamed to obey. */
  const HANDED='ion_handed';
  const handed = () => { try{ return !!(window.PROGRESS && PROGRESS.get(HANDED,0)); }
                         catch(e){ return false; } };
  function handOver(){
    if(!mechB){ return; }
    /* ALREADY HANDED OVER? Then what he is owed is the only thing left.
       A student who shuts the belt panel half way through has not undone
       anything and must not be locked out of the rest of the mission — E
       at the Mechanic puts them back on the belt, with the jobs they had
       already passed still passed. */
    if(handed()){
      /* HE STILL SAYS SOMETHING FIRST. This dropped you straight into the
         belt panel with no word from the man standing next to you — which
         is what a student sees on any second visit, and on a save that
         has been through this once it is the ONLY thing they see: a robot
         on a bench, a stranger, and a grid of blanks. Two lines cost
         four seconds and are the difference between a lesson arriving
         because somebody asked for it and a lesson arriving.

         AND THE BELT IS ALWAYS THERE. Passing it once used to close it
         for good; it is one of the three places in Mission 8 where
         anybody practises `and`, `or` and `not`, and the other two are a
         hatch and a robot on a kitchen floor. Somebody who wants another
         go is allowed one. */
      const b=mechB.b, F=b.frame, y=mechB.y, P0=b.g.position.clone();
      const at2=(x,yy,z)=>P0.clone()
        .add(F.right.clone().multiplyScalar(x))
        .add(F.up.clone().multiplyScalar(y+yy))
        .add(F.fwd.clone().multiplyScalar(z))
        .toArray();
      const HIM2={ eye:at2(1.4, 2.6, 5.6), at:at2(3.4, 1.5, 2.2) };
      const done=worked();
      if(!window.SCENE){ theBelt(); return; }
      SCENE.play([
        { shot:HIM2, ease:1.0, who:'The Mechanic',
          say: done ? t('Back for another run at the belt, {n}?',{n:ME()})
                    : t('There you are. The belt is still waiting, {n}.',{n:ME()}) },
        { shot:HIM2, who:'The Mechanic',
          say: done ? t('Good. A rule you can write twice is a rule you know.')
                    : t('One question per arm. Say what it takes.') }
      ], { faces:FACES, end:()=>{ if(on){ G.running=true; theBelt(); } }});
      return;
    }
    if(!window.SCENE){ return; }
    const b=mechB.b, F=b.frame, y=mechB.y;
    const P0=b.g.position.clone();
    const at=(x,yy,z)=>P0.clone()
      .add(F.right.clone().multiplyScalar(x))
      .add(F.up.clone().multiplyScalar(y+yy))
      .add(F.fwd.clone().multiplyScalar(z))
      .toArray();
    const ROOM ={ eye:at(4.5, 3.4, -2), at:at(-1.5, 1.6, 2.2) };
    const BED  ={ eye:at(1.6, 2.4, 5.0), at:at(-1.5, 1.3, 2.2) };
    /* AND ONE ON THE MECHANIC, because he has a body now and it moves
       while he talks. These two shots were framed on the cradle when he
       was a roster character standing on the far side of it, and they put
       him at the edge of frame or out of it — which was no loss while he
       stood still through every line and is most of the point now that he
       does not. He speaks four times in this scene; he is in shot for all
       of them.

       FROM THE FAR SIDE OF THE CRADLE, not from the door. Everybody
       arrives at this room out of the lift, which is behind the camera on
       any shot taken from that side — and a player standing where the
       player naturally stands then fills the frame and the Mechanic talks
       from behind their shoulder. Looking back across the bench puts the
       one person whose position cannot be predicted behind the lens. */
    const HIM  ={ eye:at(1.4, 2.6, 5.6), at:at(3.4, 1.5, 2.2) };
    SCENE.play([
      { shot:ROOM, ease:1.2, who:'you',
        say:t('This is Ion. He was on the floor for a week.') },
      { shot:HIM,  ease:1.0, who:'The Mechanic',
        say:t('Put him down. I will look properly.') },
      { shot:BED,  who:'Ion', say:t('She fixed my legs herself, you know.') },
      { shot:HIM,  who:'The Mechanic',
        say:t('Then she did the hard part. I will do the rest.') },
      /* AND HE WANTS PAYING. Not in coins — Robin has coins and spending
         them would be a menu. He is short-handed and she can write a
         rule, which is the only currency this game actually deals in. */
      { shot:HIM,  ease:1.0, who:'The Mechanic',
        say:t('Not for nothing, though. Work my belt while I do it.') },
      { shot:ROOM, who:'you', say:t('What does it do?') },
      { shot:ROOM, who:'The Mechanic',
        say:t('The arm picks parts off it. You write what it takes.') }
    ], { faces:FACES,
         end:()=>{
           if(!on) return;
           try{ if(window.PROGRESS) PROGRESS.set(HANDED,1); }catch(e){}
           G.running=true;
           layIon();
           theBelt();
         }});
  }

  /* ===================================================================
     THE BELT, WHICH IS WHAT SHE PAYS HIM WITH.

     The mission does not end at the handover any more. He takes Ion and
     asks for a morning's work in return, and the work is a lesson: three
     expressions, each one question the belt's arm asks of every part that
     comes past. boolquiz.js is the whole of it now, and it does not know
     there is a tower around it.

     WHY PAYMENT AND NOT A FAVOUR. A lesson that arrives because somebody
     wants you to learn something is homework. A lesson that arrives
     because a man is holding your friend's chest open and would like a
     hand is a reason, and it is the same five minutes either way.
     =================================================================== */
  const WORKED='ion_belt';
  const worked = () => { try{ return !!(window.PROGRESS && PROGRESS.get(WORKED,0)); }
                         catch(e){ return false; } };
  /* TWENTY QUESTIONS, NOT A BELT.

     This used to be an expression builder: pick a comparison, pick a
     number, pick a joining word, then read a six-row table to find out
     whether the thing you had assembled agreed with a man in a workshop.
     Every part of it was defensible and the whole of it was a cockpit —
     and it assumed the one thing it was supposed to be teaching. Before
     anybody can choose between `and` and `or` they have to know what the
     two words DO, and no amount of tidying the panel fixes that; the
     panel was the wrong question. boolquiz.js asks the right one, in
     English, twenty times. */
  function theBelt(){
    if(!window.BOOLQUIZ){
      /* The lesson is the payment, so if it cannot open there is nothing
         to withhold the repair for. Better a mission that finishes than
         one that cannot. */
      finishIon();
      return;
    }
    say(t('<b>THE BELT.</b> Twenty questions while he works.'));
    BOOLQUIZ.open({ bank:'belt', onDone: (score, total)=>{
      if(!on) return;
      /* LEVEL FOUR, AND THE LAST. mended() finishes the mission itself. */
      if(window.ION) ION.pass(WORKED);
      else try{ if(window.PROGRESS) PROGRESS.set(WORKED,1); }catch(e){}
      /* THE SCORE IS FIRST ATTEMPTS ONLY, and it is not a gate: the quiz
         has already made them get every one of them right before it would
         let them out. This is the difference between "you know this" and
         "you knew this straight away", and it is worth saying once. */
      if(score!==undefined && total)
        say(t('{a} of {b} first time.', { a:score, b:total }));
      mended();
    }});
  }

  /* HE KEEPS HIS SIDE OF IT, and this is where Mission 8 ends. */
  function mended(){
    if(!on || !window.SCENE){ finishIon(); return; }
    const b=mechB && mechB.b;
    if(!b || !b.frame){ finishIon(); return; }
    const y=mechB.y, F=b.frame, P0=b.g.position.clone();
    const at_=(x,yy,z)=>P0.clone()
      .add(F.right.clone().multiplyScalar(x))
      .add(F.up.clone().multiplyScalar(y+yy))
      .add(F.fwd.clone().multiplyScalar(z))
      .toArray();
    const BED ={ eye:at_(1.6, 2.4, 5.0), at:at_(-1.5, 1.3, 2.2) };
    const ROOM={ eye:at_(4.5, 3.4, -2),  at:at_(-1.5, 1.6, 2.2) };
    const HIM ={ eye:at_(1.4, 2.6, 5.6), at:at_(3.4, 1.5, 2.2) };
    /* AND HE LENDS YOU THE GLASSES. Not as a reward for the belt — a
       reward is a thing you are given for having been good — but because
       you asked what he keeps squinting through, which is the question
       anybody watching a man work on an engine actually has.

       WHAT THEY ARE FOR IS TRUE AND IS NOT THE POINT. He really does read
       drive frequencies with them and the readout really does show the
       E-45's. He has simply never turned round while wearing them at this
       hour, and neither has anybody else, so nobody in this tower knows
       what is on the ridge. The player finds that out alone. */
    SCENE.play([
      { shot:BED, ease:1.1, who:'The Mechanic', say:t('Belt is running. Good rules.') },
      { shot:BED, who:'Ion', say:t('{n}? I can feel my hands.',{n:ME()}) },
      { shot:ROOM, ease:1.0, who:'you', say:t('Told you he was worth the trip.') },
      { shot:ROOM, who:'you', say:t('What are those glasses for?') },
      { shot:HIM, ease:1.0, who:'The Mechanic',
        say:t('Frequency. I read a drive by its hum, not its paint.') },
      { shot:HIM, who:'The Mechanic',
        say:t('Borrow them. Your engine has a note I want checking.') },
      { shot:ROOM, who:'you', say:t('And everything else at that frequency?') },
      /* HE IS WRONG, AND HE DOES NOT KNOW HE IS WRONG, which is the only
      way this line can be written. If he says "there is an arena" the
      player is running an errand; if he says nothing the player never
      puts the glasses on outdoors. So he says what a man who has only
      ever used a tool for its job would say, he is confidently
      mistaken, and the ridge is not empty. */
      { shot:HIM, who:'The Mechanic', say:t('Nothing out here. Press G and see.') }
    ], { faces:FACES,
         end:()=>{ if(on){
           try{ if(window.PROGRESS) PROGRESS.set(SPECS,1); }catch(e){}
           brawlBuild();          // while he is still talking, not on the G
           /* finishIon() has the last word, because "Mission 8 complete"
              is the more important of the two things to say and say()
              only holds one. He has already told you which key. */
           G.running=true;
           outsideTower();
           finishIon();
         } }});
  }
  /* AND OUT OF THE TOWER WITH THEM.

     The glasses are handed over on the middle floor of a building whose
     only way down is a lift, and what they are FOR is a hundred and
     seventy units away across the desert. Leaving a student in a workshop
     holding the one thing in the game that needs open sky — with a lift
     ride, a lobby and a door between them and it — is the mission ending
     by asking them to retrace their steps.

     So the scene puts them outside, in front of the tower, with the E-45
     parked where they landed her. Press G and there is something on the
     horizon; get in and fly at it. */
  function outsideTower(){
    const b=BUILDINGS.find(x=>x.id==='tower');
    if(!b || !b.dir){ return; }
    /* Out in front of the door and far enough back to see the building
       they have just walked out of, which is the same offset the tour
       uses to point at a door. */
    const f=frameAt(b.dir, 0);
    me.dir=b.dir.clone()
      .add(f.fwd.clone().multiplyScalar(16/PR))
      .normalize();
    me.alt=floorAt(me.dir); me.vy=0; me.onGround=true;
    me.fwd=facing(me.dir, b.dir);
    /* AND FACING THE ARENA, WHICH IS A WALK AND NOT A FLIGHT.

       This used to park the E-45 beside them and turn them to look at
       her, which staged the wrong thing: the bowl is sixty-nine units
       from this door at its nearest wall, and sixty-nine units is a walk.
       Flying to it means taking off, crossing it, and landing inside a
       structure with no landing ground — and arriving somewhere on foot,
       through a gate, is how you arrive at a place with people in it. */
    me.fwd=facing(me.dir, dirOf(BRAWL_AT.lon, BRAWL_AT.lat));
    G.scene.updateMatrixWorld(true);
  }

  /* ===================================================================
     GOING IN, WHICH IS WHERE MISSION 8 ACTUALLY ENDS.

     The arena was a thing to look at: a bowl on the horizon full of
     people nobody could talk to, with two machines in it. You could fly
     over it and you could stand on the sand, and neither of those is
     arriving somewhere. So there is a gate, and behind the gate is a lift
     to the top tier and somebody at the top of it who is expecting you.

     WHY THE LIFT IS A CAMERA MOVE AND NOT A LIFT. There is a real one in
     the tower, with a deck and a shaft and a rule about how fast it may
     climb without stepping out from under its passenger, and it is worth
     every line it costs because the tower is a building you explore. This
     is the last thirty seconds of the mission: what it has to do is rise,
     arrive, and hand over to a view. A shot does that.

     AND THE PERSON AT THE TOP IS THE POINT. Everybody in this bowl has
     been here the whole time, invisible, because nobody outside had the
     glasses. The first thing the first person to walk in is owed is
     somebody saying hello.
     =================================================================== */
  const ARENA_SEEN='ion_arena';
  function arenaIn(){
    if(!window.BRAWL || !BRAWL.ready || !BRAWL.root) return;
    if(!window.SCENE){ arenaEnd(); return; }
    BRAWL.root.updateMatrixWorld(true);
    /* Three places in the arena's own frame: the gate you are standing
       at, the top of the stands above it, and the middle of the sand. */
    const at=(x,y,z)=>new THREE.Vector3(x,y,z)
      .applyMatrix4(BRAWL.root.matrixWorld).toArray();
    const g=BRAWL.gateLocal || [0,0,BRAWL.radius];
    const k=BRAWL.radius ? (BRAWL.radius+16)/Math.hypot(g[0],g[2]||1) : 1;
    const gx=g[0]*0.92, gz=(g[2]||0)*0.92;
    const rim=BRAWL.rim||112;
    const GATE ={ eye:at(gx*1.10, 6,  gz*1.10), at:at(gx*0.86, 10, gz*0.86) };
    const RISE ={ eye:at(gx*0.99, rim*0.62, gz*0.99), at:at(gx*0.70, rim*0.75, gz*0.70) };
    const TOP  ={ eye:at(gx*0.93, rim+7,  gz*0.93), at:at(0, 34, 0) };
    const FIGHT={ eye:at(gx*0.80, rim+10, gz*0.80), at:at(0, 52, 0) };
    G.running=false;
    SCENE.play([
      { shot:GATE,  ease:1.2, who:'you',   say:t('There is a door. There should not be a door.') },
      { shot:RISE,  ease:2.0, hold:1.2 },
      { shot:TOP,   ease:1.4, who:'The Usher',
        say:t('Welcome, {n}. Mind the step.',{n:ME()}) },
      { shot:TOP,   who:'The Usher',
        say:t('You are wearing the glasses. Not many walk up here.') },
      { shot:TOP,   who:'you',   say:t('How long has this been going on?') },
      { shot:FIGHT, ease:1.8, who:'The Usher',
        say:t('Longer than the tower. Sit anywhere.') },
      { shot:FIGHT, hold:3.2 }
    ], { faces:FACES,
         end:()=>{ if(!on) return;
                   G.running=true;
                   try{ if(window.PROGRESS) PROGRESS.set(ARENA_SEEN,1); }catch(e){}
                   /* left in the back row, which is where the shot ends */
                   arenaSeat();
                   arenaEnd(); }});
  }
  /* WHERE THE FILM PUTS YOU DOWN, and it is on the sand rather than in
     the seat the last shot was taken from.

     Standing in the back row would be the honest continuation of the
     camera, and for about a second it was: the stands are not solid —
     deliberately, because a wall you cannot see is a wall you walk into
     and swear at — so a player left a hundred and twelve units up in the
     air fell straight through twelve tiers of crowd and landed in the
     desert outside the bowl. Welcomed in, and then dropped out of the
     back of the building.

     The sand is the planet's own ground and it is inside, which is the
     part that matters: two machines the size of the tower directly in
     front of you and a thousand people round the rim. */
  function arenaSeat(){
    if(!window.BRAWL || !BRAWL.root) return;
    BRAWL.root.updateMatrixWorld(true);
    const mid=new THREE.Vector3(0,0,0).applyMatrix4(BRAWL.root.matrixWorld);
    const back=new THREE.Vector3(0,0,48).applyMatrix4(BRAWL.root.matrixWorld);
    me.dir=back.clone().normalize();
    me.alt=floorAt(me.dir); me.vy=0; me.onGround=true;
    me.fwd=facing(me.dir, mid.clone().normalize());
    me.look=0.30;
  }

  /* --------------------------------------------------- TO BE CONTINUED
     THE END OF WHAT THERE IS, SAID OUT LOUD. A game that runs out without
     saying so reads as a game that broke: a student standing in a stand
     full of people with nothing left to do assumes they have missed
     something and goes looking for it.

     AND THEN TWO DOORS, because "the end" is not the same as "stop". One
     goes back to Senio, where the other missions are. The other closes
     the card and leaves them exactly where they are, on the top tier,
     with a planet they have every reason to want to look at now. */
  function arenaEnd(){
    let el=document.querySelector('#tbc');
    if(!el){
      el=document.createElement('div');
      el.id='tbc';
      el.style.cssText=
        'position:fixed;inset:0;z-index:80;display:flex;align-items:center;'
       +'justify-content:center;flex-direction:column;gap:22px;'
       +'background:radial-gradient(ellipse at 50% 45%,rgba(4,8,16,.72),rgba(2,4,10,.94));'
       +'font-family:var(--font);opacity:0;transition:opacity .9s ease';
      document.body.appendChild(el);
    }
    el.innerHTML=
      `<div style="font-size:clamp(13px,1.6vw,17px);letter-spacing:.42em;
                   color:#7f9bc4;text-transform:uppercase">${t('Mission 8')}</div>`
    + `<div style="font-size:clamp(28px,6vw,68px);font-weight:bold;color:#ffe9a8;
                   letter-spacing:.06em;text-shadow:0 14px 60px rgba(0,0,0,.8);
                   text-align:center;padding:0 6vw">${t('TO BE CONTINUED')}</div>`
    + `<div style="font-size:clamp(14px,1.9vw,19px);color:#cfe0ff;text-align:center;
                   max-width:34em;padding:0 8vw;line-height:1.6">`
    + `${t('Ion is mended. Nobody knows who E. is yet, and there is a '
         + 'bowl of stone on this planet that has been full the whole time.')}</div>`
    + `<div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:8px">`
    + `<button id="tbcHome" style="padding:13px 26px;border-radius:12px;border:0;
         cursor:pointer;background:#ffd98a;color:#241a05;font:inherit;font-weight:700">`
    + `${t('BACK TO SENIO')}</button>`
    + `<button id="tbcStay" style="padding:13px 26px;border-radius:12px;cursor:pointer;
         background:rgba(15,22,36,.85);border:2px solid #4a5f8a;color:#dfe8ff;
         font:inherit">${t('KEEP EXPLORING RYU')}</button></div>`;
    requestAnimationFrame(()=>{ el.style.opacity='1'; });
    const shut=()=>{ el.style.opacity='0';
                     setTimeout(()=>{ if(el.parentNode) el.remove(); }, 900); };
    const home=document.querySelector('#tbcHome');
    const stay=document.querySelector('#tbcStay');
    if(home) home.onclick=()=>{ shut(); wentTo('mission'); leave();
                                if(window.MENU) MENU.open(); };
    if(stay) stay.onclick=()=>{ shut(); G.running=true;
                                say(t('The glasses are yours. <b>G</b> takes them off.')); };
  }

  function finishIon(){
    try{ if(window.PROGRESS) PROGRESS.complete('ion'); }catch(e){}
    say(t('<b>Mission 8 complete.</b> The lift goes to <b>THE TOP</b>.'));
  }
  /* And he is on the cradle afterwards, because a handover you are told
     about and cannot see is a handover that did not happen. Built here
     rather than with the room: before this beat the bench is empty, and
     an Ion lying on it from the moment you walk in has already been
     handed over. */
  function layIon(){
    if(!mechB || mechB.ion) return;
    /* LYING ON HIS BACK, which is three axes and not one.

       A character model stands up its own +Y, faces its own +Z and holds
       its arms along its own X. Putting it on a table means sending all
       three somewhere new at once: his head along the bench (+X), his
       face at the ceiling (+Y), and his arms across the bench (+Z).

       THE FIRST ATTEMPT TURNED HIM ON ONE AXIS and then spun the model
       inside its wrapper to tidy up the arms, which is two of the three
       and looked from most angles like a fix. It was not: his spine ended
       up across the bench rather than along it, his face pointed at the
       wall, and half of him hung over the edge — a shape that reads as a
       body until you walk round it.

       Three axes at once is one Euler, and this is that Euler: about Z
       first, then about X, both a quarter turn back. Three.js applies the
       default 'XYZ' order as Rx·Ry·Rz — rightmost first — so writing it
       in one call gets the Z turn before the X turn, which is the order
       this needs. Checked by standing the camera at the table and looking
       along it, because the world-axis bounding box of a rotated body on
       a tilted room tells you nothing. */
    const body=new THREE.Group();
    body.position.set(mechB.bed.x, mechB.bed.y, mechB.bed.z);
    body.rotation.set(-Math.PI/2, 0, -Math.PI/2);
    mechB.g.add(body);
    mechB.ion=body;
    /* HIS OWN LOADER, BECAUSE HE IS A PROP. This asked AVATAR for him and
       AVATAR has not got him: bodyDef() falls back to the first character
       for an id it does not know, so what lay on this cradle was Kyle,
       face up, being called Ion by everybody in the room. Nothing threw
       and nothing logged — a body that fails to resolve is meant to be the
       wrong person rather than a hole in the world, and here that rule
       hid a missing model behind a real one.

       HE IS NOT ADDED TO THE ROSTER TO FIX IT. He is a robot that comes
       up to the chest of a person, and AVATAR normalises everything it
       loads to a person's height — which would stand him up as tall as
       anybody else in the game. house.js has loaded him this way all
       along, with this scale; this is the same few lines and the same
       number, and it is the reason both of them have it rather than
       AVATAR. */
    const ION_TALL=1.25;
    new THREE.GLTFLoader().load(
      'characters/models/ion.glb?v='+(window.ASSETV||'1'),
      g=>{
        if(!mechB || mechB.ion!==body) return;
        const root=g.scene;
        root.traverse(o=>{ if(!o.isMesh) return;
          o.frustumCulled=false;
          if(o.geometry.attributes.color){ o.material.vertexColors=true;
                                           o.material.needsUpdate=true; } });
        root.updateMatrixWorld(true);
        const bx=new THREE.Box3().setFromObject(root);
        const h=bx.max.y-bx.min.y;
        if(h>1e-6) root.scale.setScalar(ION_TALL/h);
        body.add(root);
      }, undefined, ()=>{});
  }

  /* MR EINSTEIN, at the top, and he is deliberately not an ending. The
     mission is already paid off downstairs; this is the thread the game
     picks up next — E was in Ion at four in the morning and nobody knows
     who E is yet. He is allowed to not answer. */
  function einstein(){
    if(!window.SCENE){ say(t('He is looking out of the window.')); return; }
    const b=BUILDINGS.find(x=>x.id==='tower');
    if(!b || !b.frame) return;
    const y=TOWER_STOPS[2].y, F=b.frame, P0=b.g.position.clone();
    const at=(x,yy,z)=>P0.clone()
      .add(F.right.clone().multiplyScalar(x))
      .add(F.up.clone().multiplyScalar(y+yy))
      .add(F.fwd.clone().multiplyScalar(z))
      .toArray();
    const HIM  ={ eye:at(-2.2, 2.2, 1.0), at:at(1.4, 1.6, 4.0) };
    const GLASS={ eye:at(-1.0, 2.6, 0.0), at:at(1.4, 2.0, 8.0) };
    SCENE.play([
      { shot:HIM,   ease:1.2, who:'Mr Einstein', say:t('You got here. Good.') },
      { shot:HIM,   who:'you', say:t('Somebody was inside Ion. They signed it E.') },
      { shot:GLASS, ease:1.4, who:'Mr Einstein', say:t('I know. That is why I am up here.') }
    ], { faces:FACES,
         end:()=>{ if(on) G.running=true; }});
  }

  /* --------------------------------------------------------- the mechanic
     The Wardrobe sells cars from a flat shelf of names and prices, which is
     a spreadsheet with a buy button. Nobody buys a car off a spreadsheet.

     So this is a floor with the actual vehicles standing on it. You walk
     down the bays, you look at the thing, and the console beside it is where
     the money changes hands. What you are shown is the SAME model the game
     will hand you afterwards — the ships come out of the one builder in
     SHOP that Space Explorer flies, because a showroom that sells a
     different shape from the one you get is a lie told in three dimensions.

     Everything stays purely cosmetic. A bought car is a faster walk on a
     world with nothing to race and a bought ship is a paint job, so a
     student who never spends a coin is never behind one who does. */
  let bays=[];                      // {id, kind, panel, redraw}
  function bayPanel(g, b, x, z, rot, kind, item){
    const owned = kind==='car' ? SHOP.ownsCar(item) : SHOP.ownsShip(item);
    const on = kind==='car' ? (SHOP.car() && SHOP.car().id===item.id)
                            : (SHOP.ship() && SHOP.ship().id===item.id);
    const line = on ? t('IN USE') : owned ? t('OWNED')
               : (item.price===0 ? t('FREE') : item.price+' ◆');
    const p=panel(g, b, x, z, kind==='car'?'\u{1F697}':'\u{1F680}',
                  t(item.name)+'\n'+line, 'buy:'+item.id,
                  on?'#1d4030':owned?'#22406b':'#3a2a1b', 0.62, rot);
    bays.push({ id:item.id, kind, item, p });
    return p;
  }
  /* After a purchase the plate has to say something different, or the only
     feedback a child gets for spending three hundred coins is a line of text
     that fades in three seconds. */
  function repaintBays(){
    bays.forEach(bay=>{
      const owned = bay.kind==='car' ? SHOP.ownsCar(bay.item) : SHOP.ownsShip(bay.item);
      const on = bay.kind==='car' ? (SHOP.car() && SHOP.car().id===bay.item.id)
                                  : (SHOP.ship() && SHOP.ship().id===bay.item.id);
      const line = on ? t('IN USE') : owned ? t('OWNED')
                 : (bay.item.price===0 ? t('FREE') : bay.item.price+' ◆');
      const face=bay.p.userData.glow;
      if(!face) return;
      if(face.material.map) face.material.map.dispose();
      face.material.map=panelTex(bay.kind==='car'?'\u{1F697}':'\u{1F680}',
        t(bay.item.name)+'\n'+line,
        on?'#1d4030':owned?'#22406b':'#3a2a1b');
      face.material.needsUpdate=true;
    });
  }
  function showroom(g, b, hw, hd){
    bays=[];
    if(!window.SHOP) return;
    /* A roof that really blocks the sun means a workshop with no windows is
       a workshop with no light. Strip lamps down the middle, the way a real
       one is lit, plus a spill inside the door. */
    [-hd*0.45, hd*0.15].forEach(z=>{
      const tube=new THREE.Mesh(new THREE.BoxGeometry(hw*1.2,0.3,0.9),
        new THREE.MeshBasicMaterial({color:0xfff6e0}));
      tube.position.set(0, b.h-1.4, z); g.add(tube);
      const lamp=new THREE.PointLight(0xfff2d8, 300, 54, 1.4);
      lamp.position.set(0, b.h-2, z); g.add(lamp);
    });
    const spill=new THREE.PointLight(0xdfe9ff, 110, 40, 1.5);
    spill.position.set(0, 5, hd-4); g.add(spill);
    const floorPaint=new THREE.MeshLambertMaterial({color:0x3b3128});
    /* Cars down the middle now rather than along the left wall. With the
       ships gone the right-hand half was bare floor, which reads as a room
       that has lost something rather than one built this way. */
    SHOP.CARS.forEach((c,i)=>{
      const x=-2, z=-hd+7+i*6.4;
      const mark=new THREE.Mesh(new THREE.BoxGeometry(6.2,0.08,4.6), floorPaint);
      mark.position.set(x,0.13,z); mark.userData.flat=true; g.add(mark);
      bayPanel(g, b, x-5.4, z, Math.PI/2, 'car', c);
      loadCar(c, g, x, z);
    });
    /* NO SHIPS DOWN THE RIGHT ANY MORE. They were sold twice — here on
       plinths and again in the Mall — and the Mall is where they belong,
       beside the character who flies them. Cars stay, because this is the
       only place that sells them.

       It was never only about tidiness. A ship is a real model now rather
       than five boxes, and five of them turning on plinths were seventy-
       seven thousand triangles standing in a room most of whose visitors
       came to look at a car. */
    shipBay(g, b, hw, hd);
    // and a purse on the wall, so you can see what you have to spend
    const purse=panel(g, b, 0, -hd+3.4, '◆',
      t('YOUR COINS'), 'purse', '#2a2013', 0.7, 0);
    purseFace=purse.userData.glow;
    refreshPurse();
  }
  /* ------------------------------------------------------------ the hangar
     THE SHIP LIVES HERE, and you have to come and get it. The Pad used to
     take you to another planet on its own, which made the other planets
     tabs rather than places — so now the Pad flies a ship, and a ship is
     something you fetch from the garage first.

     It costs nothing. This is not another thing to buy; it is a reason to
     walk somewhere before the sky opens up. */
  const SHIP_KEY='has_ship';
  function hasShip(){
    try{ return !!(window.PROGRESS && PROGRESS.get(SHIP_KEY,0)); }catch(e){ return false; }
  }
  function takeShip(){
    try{ if(window.PROGRESS) PROGRESS.set(SHIP_KEY,1); }catch(e){}
    repaintShipBay();
    if(window.beep) beep('pop');
    say(t('🚀 The ship is yours. It is waiting on <b>THE PAD</b>.'));
  }
  let shipBayPanel=null, shipBayModel=null;
  function shipBay(g, b, hw, hd){
    const x=hw*0.52, z=-hd*0.10;
    // a lit pad, so the corner reads as a hangar rather than as spare floor
    const deck=new THREE.Mesh(new THREE.CylinderGeometry(4.4,4.7,0.5,28),
      new THREE.MeshLambertMaterial({color:0x3f4a63}));
    deck.position.set(x,0.25,z); deck.userData.flat=true; g.add(deck);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(4.0,0.16,8,40),
      new THREE.MeshBasicMaterial({color:0x8ff0ff}));
    ring.rotation.x=-Math.PI/2; ring.position.set(x,0.56,z); g.add(ring);
    const lamp=new THREE.PointLight(0x8ff0ff, 140, 26, 1.6);
    lamp.position.set(x,5,z); g.add(lamp);
    b.solids.push({x1:x-4.7,x2:x+4.7,z1:z-4.7,z2:z+4.7,y1:0,y2:0.75});

    if(window.SHOP && SHOP.model){
      shipBayModel=SHOP.model();
      shipBayModel.position.set(x,3.2,z);
      shipBayModel.scale.setScalar(2.4);
      g.add(shipBayModel);
      shipBayModel.userData.spin=0.35;      // the statues loop turns it
      statues.push(shipBayModel);
    }
    shipBayPanel=panel(g, b, x, z+5.6, '\u{1F680}',
      hasShip() ? t('SHIP')+'\n'+t('YOURS') : t('TAKE THE SHIP')+'\n'+t('FREE'),
      'takeship', hasShip()?'#1d4030':'#12304a', 0.66, 0);
  }
  function repaintShipBay(){
    if(!shipBayPanel) return;
    const face=shipBayPanel.userData.glow; if(!face) return;
    if(face.material.map) face.material.map.dispose();
    face.material.map=panelTex('\u{1F680}',
      hasShip() ? t('SHIP')+'\n'+t('YOURS') : t('TAKE THE SHIP')+'\n'+t('FREE'),
      hasShip()?'#1d4030':'#12304a');
    face.material.needsUpdate=true;
  }

  let purseFace=null;
  function refreshPurse(){
    if(!purseFace || !window.WALLET) return;
    if(purseFace.material.map) purseFace.material.map.dispose();
    purseFace.material.map=panelTex('◆',
      WALLET.coins()+' ◆\n'+t('LV {n}',{n:WALLET.level?WALLET.level():1}), '#2a2013');
    purseFace.material.needsUpdate=true;
  }
  /* A car on its plinth, bigger than the one you drive because you are
     meant to be looking at it. Same builder as the road, so what is on the
     stand is what you get. */
  function loadCar(c, g, x, z){
    if(!window.SHOP) return;
    SHOP.carModel(c.paint, 5.4).then(holder=>{
      if(!on) return;
      holder.position.set(x, 0.17, z);         // the floor mark's top surface
      holder.rotation.y=Math.PI/2;             // side on to whoever walks past
      g.add(holder);
    }).catch(()=>{});
  }
  /* Buying, which is the whole point of the room. Three outcomes and each one
     says which it was: you bought it, you already had it and now you are
     using it, or you cannot afford it and here is how short you are. */
  function purchase(id){
    if(!window.SHOP || !window.WALLET) return;
    const car=SHOP.CARS.find(c=>c.id===id), ship=SHOP.SHIPS.find(s=>s.id===id);
    const item=car||ship; if(!item) return;
    const owned = car ? SHOP.ownsCar(car) : SHOP.ownsShip(ship);
    if(!owned){
      const r=SHOP.buy(item.id, item.price);
      if(r==='poor'){
        say(t('{n} costs {p} ◆. You have {c} ◆.',
              {n:t(item.name), p:item.price, c:WALLET.coins()}));
        return;
      }
      say(t('Bought {n}.',{n:t(item.name)}));
    }
    // equip() toggles a car off if it is already the one you have chosen, so
    // only call it when this is not already the car in use
    const already = car ? (SHOP.car() && SHOP.car().id===id)
                        : (SHOP.ship() && SHOP.ship().id===id);
    if(!already){
      SHOP.equip(id);
      if(owned) say(t('{n} it is.',{n:t(item.name)}));
    }
    if(car) fitRide();
    repaintBays(); refreshPurse();
  }

  /* -------------------------------------------------------- the librarian
     The catalogue was already here: a console you press E at, which opens
     the whole book on everything at once.  That is a filing cabinet, and a
     filing cabinet is what a nine-year-old backs away from.

     So there is somebody behind the desk.  She is not decoration and she is
     not a second door to the same screen — she reads where you have got to
     and names the ONE idea your next mission is built on, then opens the
     book already searched for it.  Ask her again and she moves on to the
     next thing.  A shelf you are pointed at is a shelf you read.  */
  const LIB_NAME='ADA';
  let ada=null, adaTip=0;
  /* The concept behind each mission, so "what should I read?" has an answer
     that depends on where you actually are rather than on a dice roll. */
  const MISSION_IDEA=[
    ['tut',   'Command'],
    ['nav',   'Sequence'],
    ['flight','Coordinate'],
    ['m1',    'Loop'],
    ['m2',    'Condition'],
    ['m3',    'Function']
  ];
  function adaPicks(){
    // the first mission you have not finished — that is the one you need
    if(window.PROGRESS) for(const [id,term] of MISSION_IDEA)
      if(!PROGRESS.isDone(id)) return term;
    // nothing left to unlock: walk her through the rest of the shelves
    const rest=(window.LIBRARY?LIBRARY.IDEAS:[]).map(i=>i.term)
      .filter(x=>!MISSION_IDEA.some(m=>m[1]===x));
    return rest.length ? rest[(adaTip++)%rest.length] : 'Loop';
  }
  function ask(){
    const term=adaPicks();
    const idea=(window.LIBRARY?LIBRARY.IDEAS:[]).find(i=>i.term===term);
    // one sentence, in her voice, and then the shelf she is pointing at
    const line=idea ? idea.what.split('. ')[0]+'.' : '';
    /* The word goes into her mouth and into the search box UNtranslated: the
       shelves are indexed on the English term, and a librarian who names a
       word you cannot then find is worse than one who says nothing. */
    say('\u{1F4DA} <b>'+LIB_NAME+'</b> — \u201C'+t('Read up on {w}.',{w:'<b>'+term+'</b>'})
        +'\u201D<br><small>'+esc(t(line))+'</small>');
    if(window.LIBRARY) LIBRARY.open(term);
  }
  /* A desk says librarian, but standing her BEHIND one puts a metre of oak
     between a nine-year-old and the only person in the building: from the
     door all you could see was the top of a head over a counter. So the desk
     is behind her and she is out in front of it, in the open, the whole of
     her, the way somebody who wants to be asked something stands. */
  function librarian(g, b, x, z){
    const wood=new THREE.MeshLambertMaterial({color:0x6b4a34});
    const top=new THREE.Mesh(new THREE.BoxGeometry(5.6,0.3,1.5), wood);
    top.position.set(x, 0.95, z); g.add(top);
    const front=new THREE.Mesh(new THREE.BoxGeometry(5.6,0.95,0.45),
      new THREE.MeshLambertMaterial({color:0x59402f}));
    front.position.set(x, 0.47, z+0.5); g.add(front);
    b.solids.push({x1:x-2.8, x2:x+2.8, z1:z-0.9, z2:z+0.9, y1:0, y2:1.1});

    const stack=new THREE.Group(); stack.position.set(x-1.9, 1.1, z);
    [0x8fd3ff,0xffb4a2,0xa8e6cf].forEach((c,i)=>{
      const bk=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.16,0.8), lam(c));
      bk.position.set(0, i*0.17, 0); bk.rotation.y=(i-1)*0.12; stack.add(bk);
    });
    g.add(stack);

    const who=new THREE.Group();
    // out in front of the desk, on the door side, and lifted the tenth of a
    // metre the model's feet hang below its own origin
    who.position.set(x, 0.1, z+2.4);
    g.add(who);
    ada={ g:who, b, x, z:z+2.4, model:null, yaw:0 };

    /* You have to be able to point at a person, and the raycast only tests
       the meshes it was handed — a loaded character is a tree of them and
       arrives late besides.  So the thing you actually aim at is a box the
       size of a person, standing there from the first frame whether the
       model has downloaded or not. */
    const hitbox=new THREE.Mesh(new THREE.BoxGeometry(1.5,2.1,1.2),
      new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true,
                                    opacity:0, depthWrite:false }));
    hitbox.position.set(x, 1.15, z+2.4); g.add(hitbox);
    hitbox.userData.owner=who;
    who.userData={ kind:'npc', label:LIB_NAME+' — '+t('the librarian'), enter:'librarian' };
    G.hits.push(hitbox);

    const tag = window.OWN ? OWN.plate(LIB_NAME, 0xffe9a8) : null;
    if(tag){ tag.position.set(x, 2.8, z+2.4); tag.scale.set(3.4,0.85,1); g.add(tag); }

    if(window.AVATAR){
      // never the character the player is wearing: two of you is a bug, not a cast
      AVATAR.load(AVATAR.other()).then(root=>{
        if(!ada || ada.g!==who || !on) return;
        who.add(root); ada.model=root;
      }).catch(()=>{});
    }
  }
  /* shelves down both side walls, because a library with no books in it is a
     room with a search box in it */
  function reading(g, b, hw, hd, H){
    const wood=new THREE.MeshLambertMaterial({color:0x5b4130});
    const spines=[0x8fd3ff,0xffb4a2,0xa8e6cf,0xcdb4f6,0xffe9a8,0xe89fb0];
    /* Spaced to FIT, not spaced to look right and then checked afterwards:
       the third case used to end a metre outside the front wall. */
    [-1,1].forEach(sx=>{
      for(let k=0;k<3;k++){
        const z=-hd+5.5+k*5.5, x=sx*(hw-1.6);
        const cse=new THREE.Mesh(new THREE.BoxGeometry(1.6,4.6,4.6), wood);
        cse.position.set(x, 2.3, z); g.add(cse);
        b.solids.push({x1:x-0.8, x2:x+0.8, z1:z-2.3, z2:z+2.3, y1:0, y2:4.6});
        for(let sh=0; sh<3; sh++) for(let i=0;i<9;i++){
          const bk=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.9+Math.random()*0.5,0.34),
            lam(spines[(i+sh+k)%spines.length]));
          bk.position.set(x-sx*0.85, 1.1+sh*1.45, z-1.9+i*0.46);
          g.add(bk);
        }
      }
    });
  }

  /* ---------------------------------------------------------- the castle
     Mission Control is where the whole course lives, so it should look like
     somewhere worth walking into rather than the same shed as everything
     else: corner towers with spires, a crenellated parapet, a gate arch and
     a banner over it. The walls are still the four boxes the collision knows
     about — all of this stands on top of them. */
  function castle(b, g, hw, hd, H, put){
    const stone=new THREE.MeshLambertMaterial({color:0x4a5f9e});
    const roofM=new THREE.MeshLambertMaterial({color:b.roof});
    const add=(mesh,x,y,z)=>{ mesh.position.set(x,y,z); g.add(mesh); return mesh; };

    // four towers, one on each corner, each with a spire
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
      const x=sx*hw, z=sz*hd, TH=H+6, TR=3.1;
      add(new THREE.Mesh(new THREE.CylinderGeometry(TR,TR+0.5,TH,12), stone), x, TH/2, z);
      // a ring of merlons round the top of each tower
      for(let i=0;i<10;i++){
        const a=i/10*Math.PI*2;
        add(new THREE.Mesh(new THREE.BoxGeometry(1.1,1.5,1.1), stone),
            x+Math.cos(a)*TR, TH+0.75, z+Math.sin(a)*TR);
      }
      add(new THREE.Mesh(new THREE.ConeGeometry(TR+1.2, 5.5, 12), roofM), x, TH+3.9, z);
      // and a pennant on a pole
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,3,6), stone), x, TH+8, z);
      const flag=add(new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.1),
        new THREE.MeshLambertMaterial({color:0x8ff0ff, side:THREE.DoubleSide})),
        x+1.1, TH+8.8, z);
      flag.rotation.y=Math.PI/2;
      G.solids && b.solids.push({x1:x-TR,x2:x+TR,z1:z-TR,z2:z+TR,y1:0,y2:TH});
    });

    // battlements along the tops of the four walls
    const merlon=(x,z)=>add(new THREE.Mesh(new THREE.BoxGeometry(1.4,1.6,1.4), stone), x, H+0.8, z);
    for(let x=-hw+3; x<=hw-3; x+=3){ merlon(x,-hd); merlon(x, hd); }
    for(let z=-hd+3; z<=hd-3; z+=3){ merlon(-hw,z); merlon( hw,z); }

    /* The gate. The doorway is a gap in the front wall; this is the arch over
       it, stepped out of boxes, with a banner hung above. */
    const gap=9;
    for(let i=0;i<4;i++){
      const w=gap+2.4+i*1.6, y=H-6+i*0.55;
      add(new THREE.Mesh(new THREE.BoxGeometry(w,0.55,1.6), stone), 0, y, hd);
    }
    [-1,1].forEach(sx=>{
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.25,H-5.6,10), stone),
          sx*(gap/2+1.3), (H-5.6)/2, hd);
    });
    const banner=add(new THREE.Mesh(new THREE.PlaneGeometry(gap-1, 3.4),
      new THREE.MeshLambertMaterial({map:signTexture('\u{1F680}', b.roof),
                                     transparent:true, side:THREE.DoubleSide})),
      0, H-2.4, hd+0.3);
    banner.rotation.x=0;

    /* A pool of light inside the gate. Sunlight does come through a door, and
       without this the threshold is a hard line between a bright field and a
       black rectangle — which is what a child reads as "you cannot go in". */
    const spill=new THREE.PointLight(0xdfe9ff, 120, 46, 1.5);
    spill.position.set(0, 5, hd-4); g.add(spill);

    // a runner of floor leading in, so the hall has a middle
    const rug=add(new THREE.Mesh(new THREE.BoxGeometry(b.w*0.26, 0.12, b.d-3),
      new THREE.MeshLambertMaterial({color:0x6b4a8f})), 0, 0.15, 0);
    rug.receiveShadow=false;

    /* Braziers down the hall. A room this tall goes flat without something
       bright in it, and a real light each is worth the cost in a room you
       stand still in. */
    [[-hw+4, -hd+8],[hw-4, -hd+8],[-hw+4, hd-10],[hw-4, hd-10]].forEach(([bx,bz])=>{
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.9,4.5,8), stone), bx, 2.25, bz);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.85,12,10),
        new THREE.MeshBasicMaterial({color:0xffd9a0})), bx, 4.9, bz);
      /* Now that the roof really does block the sun, these are not decoration
         any more — they are the only light in the building, and 0.85 candela
         in a hall sixty-four metres across is a match in a cathedral. */
      const lamp=new THREE.PointLight(0xffd9a0, 260, 62, 1.4);
      lamp.position.set(bx, 5.2, bz); g.add(lamp);
    });
  }
  /* ------------------------------------------------------------ statues
     One per mission, standing behind its console: the thing the mission is
     actually about, so you can tell them apart from the door without reading
     six labels. A ship dodging an asteroid, a zombie, a prism. */
  /* A plinth worth standing something on: a stepped base, a fluted column
     with a band in the mission's own colour, a moulded cap, and a disc of
     light under whatever is on top. Three grey boxes was a crate. */
  function plinth(tint){
    const g=new THREE.Group();
    const st=new THREE.MeshLambertMaterial({color:0x7d8cba});
    const dk=new THREE.MeshLambertMaterial({color:0x4a5578});
    const band=new THREE.MeshLambertMaterial({color:tint||0x8fd3ff});
    const box=(w,h,d,y,m)=>{ const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m||st);
      b.position.y=y; g.add(b); return b; };
    box(4.0,0.4,4.0,0.2,dk);            // two steps up to it
    box(3.4,0.4,3.4,0.6);
    box(2.6,0.5,2.6,1.05,dk);
    // the column, with four half-round flutes down its faces
    box(2.1,3.4,2.1,3.0);
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dz])=>{
      const fl=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,3.4,8), dk);
      fl.position.set(dx*1.05, 3.0, dz*1.05); g.add(fl);
    });
    box(2.9,0.35,2.9,4.87,band);        // the colour band, at eye level
    box(3.3,0.45,3.3,5.27);             // and the cap it all stands on
    // a soft disc of light on top, so the statue reads against the wall
    const glow=new THREE.Mesh(new THREE.CircleGeometry(1.5, 20),
      new THREE.MeshBasicMaterial({color:tint||0x8fd3ff, transparent:true, opacity:0.22}));
    glow.rotation.x=-Math.PI/2; glow.position.y=5.51; g.add(glow);
    return g;
  }
  const lam = c => new THREE.MeshLambertMaterial({color:c});
  function lumpyRock(r){
    const geo=new THREE.IcosahedronGeometry(r,0), pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const k=0.75+Math.random()*0.5;
      pos.setXYZ(i, pos.getX(i)*k, pos.getY(i)*k, pos.getZ(i)*k);
    }
    if(geo.computeVertexNormals) geo.computeVertexNormals();
    return new THREE.Mesh(geo, lam(0x8a7f6e));
  }
  function littleShip(){
    const g=new THREE.Group();
    const hull=lam(0xe8ecff), trim=lam(0x8fd3ff);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(0.3,1.1,10), hull);
    nose.rotation.x=-Math.PI/2; nose.position.z=-0.75; g.add(nose);
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.36,1.25), hull); g.add(body);
    [-1,1].forEach(sx=>{
      const wg=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.1,0.6), trim);
      wg.position.set(sx*0.66,-0.04,0.22); wg.rotation.z=sx*0.14; g.add(wg);
    });
    const glow=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6),
      new THREE.MeshBasicMaterial({color:0x8ff0ff}));
    glow.position.z=0.72; g.add(glow);
    return g;
  }
  function statue(parent, id, x, z, rot){
    const g=new THREE.Group();
    const st=STATIONS.find(s=>s.id===id);
    const tint=st ? parseInt(String(st.a).slice(1),16) : 0x8fd3ff;
    g.add(plinth(tint));
    const top=new THREE.Group();
    top.position.y=6.4; top.scale.setScalar(1.75);      // read from across the hall
    g.add(top);

    if(id==='flight'){
      // a ship banking round an asteroid: the whole mission in one shape
      const ship=littleShip(); ship.position.set(-0.65,0.55,0);
      ship.rotation.set(0.15,0.5,-0.5); top.add(ship);
      const rock=lumpyRock(0.95); rock.position.set(0.75,-0.15,0); top.add(rock);
      const r2=lumpyRock(0.4); r2.position.set(0.2,0.95,0.4); top.add(r2);
      top.userData.spin=0.5;
    } else if(id==='m2'){
      const p=new THREE.Mesh(new THREE.OctahedronGeometry(1.05,0), lam(0xcdb4f6));
      p.position.y=0.5; top.add(p);
      top.userData.spin=0.9; top.userData.prism=p;
    } else if(id==='m1'){
      // the looper: a figure caught inside its own loop
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1.15,0.13,8,26), lam(0xa8e6cf));
      ring.rotation.x=Math.PI/2; ring.position.y=0.55; top.add(ring);
      const r2=new THREE.Mesh(new THREE.TorusGeometry(0.85,0.1,8,24), lam(0xa8e6cf));
      r2.position.y=0.55; top.add(r2);
      top.userData.spin=0.7;
    } else if(id==='m3'){
      // off-by-one: a counting frame, one bead adrift
      const bar=lam(0x8b6f4e);
      for(let row=0;row<3;row++){
        const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.2,6), bar);
        rod.rotation.z=Math.PI/2; rod.position.y=0.3+row*0.55; top.add(rod);
        for(let k=0;k<4;k++){
          const bead=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8),
            lam(row===2&&k===3 ? 0xff9aa2 : 0xffb4a2));
          bead.position.set(-0.85+k*0.5 + (row===2&&k===3?0.35:0), 0.3+row*0.55, 0);
          top.add(bead);
        }
      }
    } else if(id==='tut'){
      // level zero: the blocks themselves, stacked
      [[0,0.3,0,0xffe9a8],[0,0.95,0,0xa8e6cf],[0.15,1.6,0,0x8fd3ff]].forEach(([bx,by,bz,c])=>{
        const cube=new THREE.Mesh(new THREE.BoxGeometry(1,0.55,1), lam(c));
        cube.position.set(bx,by,bz); cube.rotation.y=Math.random()*0.4-0.2; top.add(cube);
      });
    }
    if(id==='school'){
      /* A ship above a square of gridlines. The whole mission is "a place
         is two numbers", and a plinth can say that in one shape. */
      const grid=new THREE.Group();
      const line=new THREE.MeshBasicMaterial({color:0x8ff0ff});
      for(let i=0;i<=4;i++){
        const a=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.03,0.035), line);
        a.position.set(0,0,-0.8+i*0.4); grid.add(a);
        const b2=new THREE.Mesh(new THREE.BoxGeometry(0.035,0.03,1.6), line);
        b2.position.set(-0.8+i*0.4,0,0); grid.add(b2);
      }
      grid.position.y=-0.35; top.add(grid);
      if(window.SHOP && SHOP.model){
        const sh=SHOP.model(); sh.scale.setScalar(0.30);
        sh.position.set(-0.1,0.45,0.1); sh.rotation.set(0.2,-Math.PI/2,0);
        top.add(sh);
      }
      top.userData.spin=0.20;
    }
    if(id==='trail'){
      /* A road that forks, and a lens over the fork. One arm mint and one
         peach, because the whole mission is that a condition has two
         answers and only one of them is happening. */
      const stem=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.9,0.26), lam(0x8fd3ff));
      stem.position.y=-0.1; top.add(stem);
      [[-1,0xa8e6cf],[1,0xffb4a2]].forEach(([sx,c])=>{
        const arm=new THREE.Mesh(new THREE.BoxGeometry(0.22,1.05,0.22), lam(c));
        arm.position.set(sx*0.34, 0.75, 0); arm.rotation.z=-sx*0.55; top.add(arm);
        const tip=new THREE.Mesh(new THREE.SphereGeometry(0.16,10,8), lam(c));
        tip.position.set(sx*0.62, 1.2, 0); top.add(tip);
      });
      const lens=new THREE.Mesh(new THREE.TorusGeometry(0.46,0.075,8,26), lam(0xffe9a8));
      lens.position.set(0,1.45,0.35); top.add(lens);
      const glass=new THREE.Mesh(new THREE.CircleGeometry(0.44,22),
        new THREE.MeshLambertMaterial({color:0x8ff0ff, transparent:true, opacity:0.32,
                                       side:THREE.DoubleSide}));
      glass.position.set(0,1.45,0.35); top.add(glass);
      const grip=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.6,8), lam(0xffe9a8));
      grip.position.set(-0.34,1.08,0.35); grip.rotation.z=0.72; top.add(grip);
      top.userData.spin=0.30;
    }
    if(id==='ring'){
      /* The two of them squaring up, in their own plate colours — read off
         robots.js so the statue cannot drift away from the robots it is
         of. Tall and narrow against short and wide is the whole pick, and
         it is a shape you can read from the gate.

         MIND WHERE THE FLOOR IS. `top` hangs at y=6.4 and the plinth's cap
         stops at 5.5, so top-space zero is nearly a metre of fresh air —
         which is why every other statue in here is modelled around a
         NEGATIVE y. Built standing on zero, these two hovered over their
         own plinth like a pair of dropped bricks. FEET is where their feet
         go, and everything is measured up from it. */
      const R=window.ROBOTS;
      const FEET=-0.52;
      [['noisyboy',-0.52,1],['ambush',0.52,-1]].forEach(([rid,px,face])=>{
        const spec=R ? R.get(rid) : null;
        const plate=spec ? parseInt(spec.skin.plate.slice(1),16) : 0x2f3f6b;
        const trim =spec ? parseInt(spec.skin.trim.slice(1),16)  : 0x8fd3ff;
        const tall = rid==='noisyboy';
        const leg=tall?0.40:0.30, body=tall?0.82:0.66,
              wide=tall?0.40:0.56, arm=tall?0.60:0.40;
        const bot=new THREE.Group();
        const put=(w,h,d,x,y,z,c)=>{
          const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), lam(c));
          m.position.set(x,y,z); bot.add(m); return m;
        };
        /* Every piece OVERLAPS the one under it. At this scale a joint
           drawn edge to edge is a visible seam, and a seam on a statue is
           a robot that has come apart. */
        put(wide*0.92, 0.10, wide*0.80, 0, 0.05, 0, trim);          // the feet
        [-1,1].forEach(sx=>put(0.19, leg+0.10, 0.24, sx*wide*0.24, leg/2+0.04, 0, plate));
        put(wide, body, wide*0.72, 0, leg+body/2-0.04, 0, plate);   // the body
        put(wide*0.66, 0.24, wide*0.60, 0, leg+body+0.06, 0, trim); // the head
        [-1,1].forEach(sx=>{
          /* Hands up and forward, because these two are about to fight and
             a robot with its arms by its sides is a robot standing about.
             Tucked INTO the shoulder so the arm never floats off it. */
          const a=put(0.17, arm, 0.17, sx*(wide*0.5-0.02), leg+body*0.66, 0.10, trim);
          a.rotation.x=-0.42;
        });
        bot.position.set(px, FEET, 0);
        bot.rotation.y=face*Math.PI/2;          // facing each other
        top.add(bot);
      });
      top.userData.spin=0.22;                   // it turns, the way a trophy does
    }
    if(id==='sub'){
      /* The submersible on its plinth — a capsule with a tower and a
         glass nose, which is the shape the mission is about. */
      const body=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.28,1.3),
        new THREE.MeshLambertMaterial({color:0xd8dbe6}));
      body.position.y=0.42; top.add(body);
      const deck=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.09,0.8),
        new THREE.MeshLambertMaterial({color:0x2f3a52}));
      deck.position.y=0.60; top.add(deck);
      const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.55,8),
        new THREE.MeshLambertMaterial({color:0x9aa3b8}));
      mast.position.set(0,0.88,-0.34); top.add(mast);
      const dish=new THREE.Mesh(new THREE.SphereGeometry(0.17,12,8,0,6.283,0,1.2),
        new THREE.MeshLambertMaterial({color:0x8ff0ff, side:THREE.DoubleSide}));
      dish.position.set(0,1.16,-0.34); dish.rotation.x=-0.7; top.add(dish);
      const tyre=new THREE.MeshLambertMaterial({color:0x23262f});
      [-1,0,1].forEach(dz=>[-1,1].forEach(dx=>{
        const w=new THREE.Mesh(new THREE.CylinderGeometry(0.21,0.21,0.15,12), tyre);
        w.rotation.z=Math.PI/2; w.position.set(dx*0.51, 0.21, dz*0.47); top.add(w);
      }));
      top.userData.spin=0.22;          // it turns, the way a museum piece does
    }
    g.position.set(x,0,z);
    g.rotation.y=rot||0;
    parent.add(g);
    statues.push(top);
    // and you cannot walk through a statue
    parent.userData.b && parent.userData.b.solids.push(
      {x1:x-2.1, x2:x+2.1, z1:z-2.1, z2:z+2.1, y1:0, y2:6});

    /* Escape and Loops get the real thing — the same rig that chases you in
       the mission, standing still on a plinth. */
    if((id==='nav' || id==='m1') && window.ZOMBIE){
      ZOMBIE.make({ skin: id==='nav' ? 'zombieA' : 'zombieC', height:2.4 })
        .then(z=>{ if(!on) return;
          z.position.y = id==='m1' ? -0.2 : 0;
          top.add(z); ZOMBIE.animate(z,0,'idle');
          if(id==='nav') top.userData.spin=0.25; })
        .catch(()=>{});
    }
    return g;
  }

  function panel(g, b, x, z, emoji, label, opens, bg, scale, rot){
    const p=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(4.4,5.6,0.7),
      new THREE.MeshLambertMaterial({color:0x2a3b5c}));
    body.position.y=2.8; p.add(body);
    const face=new THREE.Mesh(new THREE.PlaneGeometry(3.6,3.6),
      new THREE.MeshLambertMaterial({map:panelTex(emoji,label,bg)}));
    face.position.set(0,3.3,0.37); p.add(face);
    const base=new THREE.Mesh(new THREE.BoxGeometry(5,0.5,1.4),
      new THREE.MeshLambertMaterial({color:0x1b2740}));
    base.position.y=0.25; p.add(base);
    p.position.set(x,0,z); p.scale.setScalar(scale||1);
    p.rotation.y=rot||0;
    g.add(p);
    p.userData={ kind: opens===b.id ? 'door' : 'station', label, enter:opens, glow:face };
    body.userData.owner=p; face.userData.owner=p;
    G.hits.push(body, face);
    const sc=scale||1;
    const across=4.6*sc, thick=1.6*sc;
    // the exact box round a rotated rectangle, so a console at any angle stops you
    const ca=Math.abs(Math.cos(rot||0)), sa=Math.abs(Math.sin(rot||0));
    const w=across*ca+thick*sa, d=across*sa+thick*ca;
    b.solids.push({x1:x-w/2, x2:x+w/2, z1:z-d/2, z2:z+d/2, y1:0, y2:5.8*sc});
    return p;                 // the showroom repaints its own price plates
  }

  /* ------------------------------------------------------------- walking
     step() in game.js hands over to this. Everything here is the planet's
     own physics, because none of the flat-world kind applies on a ball. */
  /* ------------------------------------------------------------- driving

     A car is not a person. A person goes where they look, sideways as
     happily as forwards, and stops the instant you let go. None of that is
     true of a car, and one set of controls for both made the car feel like a
     walking man wearing a car.

       W        throttle. Speed builds; it does not appear.
       S        brake, then reverse once you have stopped.
       A D      STEER — they turn the nose, they do not slide you sideways,
                and they do nothing at a standstill, because a wheel that is
                not rolling cannot point you anywhere.
       mouse    look around WITHOUT steering. Where you are looking and where
                the car is pointing are two different things in a car, and
                that is most of what makes one feel like a car.

     Let go and it coasts down rather than stopping dead. */
  const CAR={ top:26, reverse:-9, accel:20, brake:34, drag:5.5, turn:1.7, grip:7 };
  function drive(dt, up){
    const throttle=(G.keys.KeyW||G.keys.ArrowUp?1:0)-(G.keys.KeyS||G.keys.ArrowDown?1:0);
    const steer=(G.keys.KeyA?1:0)-(G.keys.KeyD?1:0);

    if(throttle>0)      me.spd += CAR.accel*dt;
    else if(throttle<0) me.spd -= (me.spd>0.2 ? CAR.brake : CAR.accel*0.7)*dt;
    else {
      const d=Math.min(Math.abs(me.spd), CAR.drag*dt);   // coasting down
      me.spd -= Math.sign(me.spd)*d;
    }
    me.spd=Math.max(CAR.reverse, Math.min(CAR.top, me.spd));

    /* Steering bites with speed and reverses when reversing, the way a real
       one does — so you cannot spin on the spot, and backing round a corner
       goes the way your hands expect. */
    if(steer && Math.abs(me.spd)>0.15){
      const bite=Math.min(1, Math.abs(me.spd)/CAR.grip);
      me.fwd.applyAxisAngle(up, steer*CAR.turn*bite*Math.sign(me.spd)*dt);
      me.fwd.sub(up.clone().multiplyScalar(me.fwd.dot(up))).normalize();
    }

    let moved=false;
    if(Math.abs(me.spd)>0.01){
      const move=me.fwd.clone().multiplyScalar(Math.sign(me.spd));
      const axis=new THREE.Vector3().crossVectors(up, move).normalize();
      const ang=(Math.abs(me.spd)*dt)/PR;
      const want=me.dir.clone().applyAxisAngle(axis, ang).normalize();
      if(blocked(want)) me.spd=0;                  // into a wall is a full stop
      else { me.dir.copy(want); me.fwd.applyAxisAngle(axis, ang); moved=true;
             G.stats.steps += Math.abs(me.spd)*dt; }
    }
    me.alt=floorAt(me.dir);            // drive up the apron, not through it
    place(dt, moved, Math.abs(me.spd)>CAR.top*0.6);
    // walk() does this every frame; without it here the held blaster keeps
    // whatever state it had when you got in and hangs in the windscreen
    if(window.GUN) GUN.update(dt, moved);
  }

  /* ===================================================================
     FLIGHT

     The three ways of crossing a planet answer three different questions.
     Walking asks which way, driving asks which way and how fast, and this
     one asks which way, how fast, and HOW HIGH — so it is its own function
     rather than a flag inside walk(), where the third question would have
     had to be ignored on every line.

     WHAT THE KEYS DO, and why they are these keys: they are the car's.
     W is go, S is slow, A and D turn, and the mouse looks — a child who
     has driven here already knows three quarters of flying. The two new
     ones are the two flying actually adds: SPACE up, SHIFT down.

     Momentum is the point of "dynamic". Airspeed is chased rather than
     set, so letting go of W leaves you gliding and a turn at speed carries
     you wide. The climb rate is chased the same way, which is what stops
     SPACE reading as a lift button.  */
  const AIR={ top:34, accel:22, drag:6, back:-6,     // metres per second
              turn:1.7, climb:16, rise:26,           // radians and metres per second
              bank:0.62,                             // how far it rolls into a full turn
              roll:3.2,                              // and how quickly it gets there
              floor:1.4 };                           // how close to the ground you may hover
  const ceilingOf = () => (W && W.ceiling) || 100;

  function fly(dt, up){
    /* The mouse turns you, exactly as it does on foot. */
    const dy=G.yaw-lastYaw; lastYaw=G.yaw;
    if(dy) me.fwd.applyAxisAngle(up, dy);

    /* ================================================ THE TURN
       A AND D ARE A CONTROL COLUMN, NOT A TILLER.

       THEY USED TO BE A TILLER. Press A and the heading rotated at
       exactly AIR.turn from that frame on; release it and it stopped
       dead, on the frame. The roll was worked out AFTERWARDS from the
       turn you were already making and eased in over a quarter of a
       second, so the ship leaned into a corner it had finished taking.
       Nothing about that is flying: it is a sprite being spun, with a
       lean painted on late.

       SO THE BANK IS THE CAUSE NOW AND THE TURN IS THE EFFECT, which is
       the right way round and also the only one that feels like anything.
       The stick asks for a roll, the roll takes time to come in and time
       to come out, and the rate she turns at is what that roll is worth.
       Let go and she rolls level, and the turn washes out with it — no
       snap at either end, because there is a physical quantity in between
       that cannot change instantly.

       AND IT NEEDS AIR OVER THE WINGS. `fast` is nothing at a standstill,
       so she cannot pivot on the spot the way she used to — a thing that
       looked wrong precisely because it is. */
    const stick=(G.keys.KeyA||G.keys.ArrowLeft?1:0)-(G.keys.KeyD||G.keys.ArrowRight?1:0);
    const fast=Math.min(1, Math.abs(me.air)/12);
    me.roll += (stick*AIR.bank*fast - me.roll)*Math.min(1, dt*AIR.roll);
    /* Full bank is a full-rate turn; half a bank is rather less than half
       a turn, which is what the sine is for and what makes easing into
       one feel like leaning rather than like a dial being turned. */
    const turnRate=(Math.sin(me.roll)/Math.sin(AIR.bank))*AIR.turn;
    if(turnRate) me.fwd.applyAxisAngle(up, turnRate*dt);
    // keep the heading tangent, or a long flight drifts out of square
    me.fwd.sub(up.clone().multiplyScalar(me.fwd.dot(up)));
    if(me.fwd.lengthSq()<1e-6) me.fwd.copy(frameAt(up,0).fwd);
    me.fwd.normalize();

    const want=(G.keys.KeyW||G.keys.ArrowUp?AIR.top:0)
             + (G.keys.KeyS||G.keys.ArrowDown?AIR.back:0);
    /* Chased, not set. The gap closes fast under power and slowly when you
       let go, which is the difference between a glider and a cursor. */
    const rate = want>me.air ? AIR.accel : AIR.drag;
    me.air += Math.max(-rate*dt, Math.min(rate*dt, want-me.air));
    if(Math.abs(me.air)<0.02) me.air=0;

    const lift=(G.keys.Space?1:0)-(G.keys.ShiftLeft||G.keys.ShiftRight?1:0);
    const wantClimb=lift*AIR.rise;
    me.climb += Math.max(-AIR.climb*dt, Math.min(AIR.climb*dt, wantClimb-me.climb));

    let moved=false;
    if(Math.abs(me.air)>0.01){
      const move=me.fwd.clone().multiplyScalar(Math.sign(me.air));
      const axis=new THREE.Vector3().crossVectors(up, move).normalize();
      /* The arc is longer up here: the same angle covers more ground the
         further you are from the middle of the ball, so the radius the
         speed is divided by has to include the height. Without it you fly
         slower the higher you climb, which nothing explains. */
      const ang=(Math.abs(me.air)*dt)/(PR+me.alt);
      const want=me.dir.clone().applyAxisAngle(axis, ang).normalize();
      /* WALLS STILL EXIST AT ALTITUDE. blocked() already asks the question
         at the height you are actually at — it turns the point into the
         building's own frame and checks the storeys — so flying OVER
         Mission Control is free and flying THROUGH it is not. */
      if(blocked(want)) me.air=0;
      else {
        me.dir.copy(want);
        me.fwd.applyAxisAngle(axis, ang);
        moved=true;
        G.stats.steps += Math.abs(me.air)*dt;
      }
    }

    /* THE CEILING, AND THE GROUND. Both are walls rather than surprises:
       you stop rising and the dome lights up, or you stop falling and are
       standing on your feet again. */
    const floor=floorAt(me.dir, me.alt), roof=floor+ceilingOf();
    me.alt += me.climb*dt;
    if(me.alt>=roof){ me.alt=roof; me.climb=Math.min(0,me.climb); }
    if(me.alt<=floor+AIR.floor){
      me.alt=floor+AIR.floor; me.climb=Math.max(0,me.climb);
      // asking to go down while you are already as low as flight goes is
      // the only thing "land" could possibly mean
      if(lift<0) return land();
    }
    /* AND THE MOUSE LEANS HER WITHOUT FLYING HER. Steering with the mouse
       is aiming rather than banking — it has already turned the heading
       above — so what it adds here is a lean and nothing else, kept apart
       from the roll so the two never fight over one number and the turn
       is never counted twice. It decays fast, because it is a reaction to
       a movement rather than a position a control is being held in. */
    const swing = dt>0 ? Math.max(-1, Math.min(1, (dy/dt)/AIR.turn)) : 0;
    me.lean += (swing*AIR.bank*fast - me.lean)*Math.min(1, dt*8);
    /* What the model is actually drawn rolled to: the aerodynamic state
       plus the cosmetic one. */
    me.bank = me.roll + me.lean;

    dome && domeTick();
    /* HOW HARD THE AIR IS GOING PAST, which is the one number the sound
       needs. Squared inside MUSIC.wind, so a gentle drift is nearly silent
       and the top of the throttle is unmistakable. */
    if(window.MUSIC && MUSIC.wind) MUSIC.wind(Math.abs(me.air)/AIR.top);
    place(dt, moved, false);
    /* AFTER place(), which is what moves the camera. The streaks are built
       around the line from the lens to the character, so a camera one frame
       stale aims them at where she was rather than where she is. */
    streakTick(dt);
    if(window.GUN) GUN.update(dt, moved);
  }

  /* Feet on the ground and the keys back to what they were. */
  function land(){
    flying=false;
    me.air=0; me.climb=0; me.bank=0; me.roll=0; me.lean=0;
    me.alt=floorAt(me.dir, me.alt); me.vy=0; me.onGround=true;
    if(window.AVATAR) AVATAR.posture(null);
    if(dome) dome.visible=false;
    if(streak) streak.line.visible=false;
    if(window.MUSIC && MUSIC.wind) MUSIC.wind(0);
    keysFor(); dash();
    say(t('Down. <b>R</b> for the way you travel.'));
  }
  function takeOff(){
    /* THE SHIP IS NOT THE JETPACK. `aboard` is the mission's own flight and
       it comes through here on purpose; anything else asking to fly on a
       mission world is the player reaching for a way round it. */
    if(!aboard && !wayOpen('fly')){
      say(t('Not here. <b>THE E-45</b> is how you travel on this one.')); return; }
    if(ride) toggleRide();               // you cannot fly a car
    swimming=false;                      // and you can take off out of water
    flying=true;
    me.air=0; me.climb=AIR.rise*0.5; me.bank=0; me.roll=0; me.lean=0; me.onGround=false; me.vy=0;
    me.alt=Math.max(me.alt, floorAt(me.dir, me.alt)+AIR.floor);
    if(window.AVATAR) AVATAR.posture('fly');
    buildDome(); buildStreaks();
    if(window.MUSIC && MUSIC.whoosh) MUSIC.whoosh();
    keysFor(); dash();
    /* A body with no flying clip still flies — it just does it standing
       up, playing whatever it was doing before, which reads as the whole
       feature being broken rather than as one missing file. Say which it
       is. In practice this means a stale model in the cache: bump the
       asset version (npm run bump) and reload. */
    if(window.AVATAR && !AVATAR.can('fly')){
      say(t('Flying — but this character has no flying animation yet.'));
      console.warn('AVATAR: no "fly" clip on '+AVATAR.chosen+
                   ' — the cached model is probably older than the game (npm run bump)');
      return;
    }
    say(t('<b>W</b> to fly, <b>A D</b> to turn, <b>SPACE</b> up, <b>SHIFT</b> down.'));
  }

  /* ================================================== motion streaks
     WHAT SPEED LOOKS LIKE WHEN THERE IS NOTHING TO MEASURE IT AGAINST.

     Flying a hundred metres up over open ground is the one place in this
     game with no near scenery: the planet slides past far below, and at
     any speed at all the screen barely changes. On foot the grass goes
     past your knees and in a car the road does; up here nothing does, so
     thirty-four metres a second and a standstill look identical.

     So the air itself gets drawn. Lines streaming past the camera, spread
     out from a point ahead the way they are in every flying shot ever
     animated — which is not a stylistic nod, it is the actual geometry of
     parallax: things near the axis you are travelling along slide slowly
     and things off to the side tear past. They fan outward as they come
     back, they lengthen with speed, and below a walking pace there are
     none of them at all.

     Kept in the frame around the player rather than in the world. A streak
     is three numbers — how far ahead, which way out, and how far out —
     rebuilt into world space each frame from the current basis, which is
     also the only way this works on a ball: "behind you" is a different
     direction every few steps. */
  const STREAKS=150;
  let streak=null;
  function buildStreaks(){
    if(streak || !G.roomGroup) return;
    const pos=new Float32Array(STREAKS*6);
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const line=new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color:0xdff2ff, transparent:true, opacity:0,
      /* Additive, so they read as light rather than as wire. On a night
         sky they glow; over daylit grass they go pale instead of drawing a
         cage over the landscape, which is what a solid line would do. */
      blending:THREE.AdditiveBlending, depthWrite:false }));
    line.frustumCulled=false;
    line.userData.sky=true;              // nothing to light, nothing to shadow
    const bits=[];
    for(let i=0;i<STREAKS;i++) bits.push(spawn(Math.random()*40-26));
    streak={ line, geo, pos, bits };
    G.roomGroup.add(line);
  }
  const FRONT=46;
  function spawn(d){
    const a=Math.random()*Math.PI*2;
    return { d, cos:Math.cos(a), sin:Math.sin(a),
             /* Squared, so more of them sit near the axis than far out —
                an even spread makes a tunnel with a hole down the middle. */
             r:0.35+Math.pow(Math.random(),2)*2.4,
             len:0.6+Math.random()*0.9 };
  }
  /* WHICH WAY THE STREAKS POINT, and why it is not the way she is going.

     A straight line in 3D projects to a screen line through the vanishing
     point of its DIRECTION — and a direction's vanishing point depends on
     the camera alone. Nothing about where the line sits moves it. So
     streaks drawn along the travel direction converge wherever that
     direction goes on screen, and the flight camera rides five metres
     above the flight axis looking down at it, which puts that point well
     above the character. Moving the bundle down does not help: it lands
     the near ends on her and leaves the far ends converging over her head,
     which is exactly the shape that reads as "coming from somewhere else".

     Drawn along the CAMERA-TO-CHARACTER axis instead, the vanishing point
     is by construction the place the character projects to — so every
     streak, wherever it is in the tube, is a line aimed at her. That is
     also what the effect is in the animation it comes from: speed lines
     radiate from the subject, not from the horizon.

     It costs almost nothing in honesty. The two axes differ by the angle
     the camera is lifted through, which is about twenty degrees, and air
     that rushes past twenty degrees off true is still air rushing past. */
  function streakTick(dt){
    if(!streak) return;
    const fast=Math.min(1, Math.abs(me.air)/AIR.top);
    streak.line.visible = fast>0.06;
    streak.line.material.opacity = 0.55*fast*fast;
    if(!streak.line.visible) return;

    const O=(window.AVATAR && AVATAR.centre) ? AVATAR.centre(streak.at||(streak.at=new THREE.Vector3()))
                                             : worldPos(1.2);
    const A=O.clone().sub(G.camera.position);
    const eye=A.length();
    if(eye<0.5) return;                       // first person: nothing to radiate from
    A.multiplyScalar(1/eye);
    /* A frame across the axis. The surface normal is the reference because
       it is the one direction up here that is never parallel to the line of
       sight — the camera always looks along the ground, never down it. */
    const e1=new THREE.Vector3().crossVectors(A, me.dir).normalize();
    const e2=new THREE.Vector3().crossVectors(A, e1).normalize();

    /* They stream past faster than you are actually going. A streak moving
       at exactly your speed sits still relative to you, which is the one
       thing it must not do. */
    const flow=Math.abs(me.air)*1.3+7;
    const long=2.4+Math.abs(me.air)*0.36;
    /* Recycled just before they reach the lens. A segment straddling the
       camera is a line across the whole screen for one frame. */
    const BACK=-(eye-1.6);
    const P=streak.pos;
    for(let i=0;i<STREAKS;i++){
      const b=streak.bits[i];
      b.d-=flow*dt;
      if(b.d<BACK || b.d>FRONT+14) Object.assign(b, spawn(FRONT*(0.35+Math.random()*0.7)));
      /* THE FAN. The nearer a streak has come, the further out it is —
         which is what parallax does, and what turns a bundle of parallel
         lines into a burst. */
      const r=b.r*(1+Math.max(0,(FRONT-b.d))*0.05);
      const ox=e1.x*b.cos*r+e2.x*b.sin*r;
      const oy=e1.y*b.cos*r+e2.y*b.sin*r;
      const oz=e1.z*b.cos*r+e2.z*b.sin*r;
      const hx=O.x+A.x*b.d+ox, hy=O.y+A.y*b.d+oy, hz=O.z+A.z*b.d+oz;
      const L=long*b.len;
      P[i*6]=hx;            P[i*6+1]=hy;          P[i*6+2]=hz;
      P[i*6+3]=hx+A.x*L;    P[i*6+4]=hy+A.y*L;    P[i*6+5]=hz+A.z*L;
    }
    streak.geo.attributes.position.needsUpdate=true;
    streak.geo.computeBoundingSphere();
  }

  /* THE EDGE OF THE SKY, drawn rather than described. A number in the
     corner tells you there is a ceiling; a surface you can see coming tells
     you where it is. It is a wireframe rather than a wall because the point
     is to read the limit through it, not to have the world go blank. */
  function buildDome(){
    if(dome || !G.roomGroup) return;
    const g=new THREE.SphereGeometry(PR+ceilingOf(), 48, 32);
    dome=new THREE.LineSegments(new THREE.WireframeGeometry(g),
      new THREE.LineBasicMaterial({ color:0x8fd3ff, transparent:true, opacity:0 }));
    dome.userData.sky=true;            // not a thing to light or shadow
    dome.renderOrder=-1;
    G.roomGroup.add(dome);
  }
  /* Fades in over the last stretch of climb, so it is invisible for most of
     a flight and unmistakable at the top of one. */
  function domeTick(){
    if(!dome) return;
    const roof=floorAt(me.dir)+ceilingOf();
    const near=Math.max(0, 1-(roof-me.alt)/28);
    dome.visible = near>0.01;
    dome.material.opacity = 0.42*near*near;
  }

  function walk(dt){
    if(!on || !me.dir) return;
    // hands on the decks, not on the keys: WASD is the grid's while it is up
    if(window.CLUB && CLUB.playing) return;
    const up=me.dir.clone().normalize();
    if(flying) return fly(dt, up);

    /* The mouse steers you on foot, and only turns your head in a car. */
    const dy=G.yaw-lastYaw; lastYaw=G.yaw;
    if(ride){ me.look += dy; return drive(dt, up); }
    if(dy) me.fwd.applyAxisAngle(up, dy);
    if(G.keys.ArrowLeft)  me.fwd.applyAxisAngle(up,  2.0*dt);
    if(G.keys.ArrowRight) me.fwd.applyAxisAngle(up, -2.0*dt);
    // keep the basis square: a long walk would drift out of tangent otherwise
    me.fwd.sub(up.clone().multiplyScalar(me.fwd.dot(up)));
    if(me.fwd.lengthSq()<1e-6) me.fwd.copy(frameAt(up,0).fwd);
    me.fwd.normalize();
    const right=new THREE.Vector3().crossVectors(me.fwd, up).normalize();

    const f =(G.keys.KeyW||G.keys.ArrowUp?1:0)-(G.keys.KeyS||G.keys.ArrowDown?1:0);
    const sd=(G.keys.KeyD?1:0)-(G.keys.KeyA?1:0);
    const running=!!(G.keys.ShiftLeft||G.keys.ShiftRight) && !swimming;
    const spd=swimming ? 3.4 : (running?11:6.5)*(ride?RIDE_SPEED:1);

    let moved=false;
    if(f||sd){
      const ang=(spd*dt)/PR;
      /* Rotating about (up x move) carries the point in the direction of
         `move` and takes the heading with it. That is what makes going
         straight on come back round instead of hitting an edge.

         Try the whole move, then each component on its own. The flat world
         gets sliding along a wall for free because it moves one axis at a
         time; here the move is a single rotation, so without this you walk
         into a wall at an angle and stop dead rather than sliding along it. */
      const tryMove=(vx)=>{
        if(vx.lengthSq()<1e-9) return false;
        const move=vx.clone().normalize();
        const axis=new THREE.Vector3().crossVectors(up, move).normalize();
        const want=me.dir.clone().applyAxisAngle(axis, ang).normalize();
        if(blocked(want)) return false;
        me.dir.copy(want);
        me.fwd.applyAxisAngle(axis, ang);
        return true;
      };
      const full=new THREE.Vector3().addScaledVector(me.fwd,f).addScaledVector(right,sd);
      moved = tryMove(full)
           || (f  ? tryMove(me.fwd.clone().multiplyScalar(f))  : false)
           || (sd ? tryMove(right.clone().multiplyScalar(sd)) : false);
      if(moved) G.stats.steps += spd*dt;
    }
    /* Indoors the ground under you is the building's floor, not the ball —
       and up on the lid it is the lid, which is why the altitude goes in. */
    const floor=floorAt(me.dir, me.alt);

    /* ------------------------------------------------------- swimming
       WATER IS NOT A FLOOR AND IT IS NOT A FALL. The plunge pool is eight
       metres deep, so walking in off the bank used to mean sinking to the
       bottom and standing there with the surface four metres over your head
       — the ground was still the ground and gravity still won.

       So: where there is water, and it is deeper than you are tall, the
       surface becomes what you rest on. You float UP to it if you are
       under, you stop falling, and the body goes horizontal — which is the
       whole read of a person in water rather than a person in a hole.

       The depth test is what stops the edges of a lake behaving like the
       middle of one: ankle-deep water is something you wade through, and
       being put into a swimming pose to cross a puddle is worse than
       nothing. */
    const surf = window.ISLANDS ? ISLANDS.waterAt(me.dir) : null;
    const swimHere = surf!==null && (surf-floor) > 1.6 && me.alt < surf+0.35;
    if(swimHere){
      if(!swimming){ swimming=true; if(window.AVATAR) AVATAR.posture('swim'); }
      /* Eased rather than snapped: you sink a little on the way in and come
         back up, which is most of what entering water looks like. */
      me.alt += (surf-me.alt)*Math.min(1, dt*3.2);
      me.vy=0; me.onGround=false;
    } else {
      if(swimming){ swimming=false; if(window.AVATAR) AVATAR.posture(null); }
      if(me.onGround && G.keys.Space){ me.vy=JUMP; me.onGround=false; }
      /* WALKED OFF AN EDGE. Without this, stepping off a roof does not drop
         you — it teleports you, because a grounded walker is pinned to
         whatever floorAt last said and the answer changed by nine metres
         between one frame and the next. */
      else if(me.onGround && floor < me.alt-0.6){ me.onGround=false; me.vy=0; }
      if(me.onGround) me.alt=floor;
      else {
        me.vy-=GRAV*dt; me.alt+=me.vy*dt;
        if(me.alt<=floor){ me.alt=floor; me.vy=0; me.onGround=true; }
      }
    }
    place(dt, moved, running);
    if(window.GUN) GUN.update(dt, moved);
  }
  /* One car, sized to the world and nose along +Z like everything else that
     stands on this ball. The driver's own and every classmate's come out of
     here, so a car looks the same from inside it and from across the field. */
  function rideModel(id){
    const want = window.SHOP ? SHOP.CARS.find(c=>c.id===id) : null;
    if(!want) return Promise.reject(new Error('no such car'));
    return SHOP.carModel(want.paint);
  }
  /* Put whatever you are riding under you, and take the body away — a
     character standing inside a car reads as a bug rather than a driver,
     which is the same reason the Circuit leaves them in the pits. */
  /* One place that decides where the flown ship is and which way it points,
     so the airborne branch and the on-the-ground branch cannot drift. It
     sits a little above the point the player rotates about, because that
     point is somebody's feet and a ship has no feet. */
  function poseShip(u, f){
    const r=new THREE.Vector3().crossVectors(u, f).normalize();
    shipRide.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    shipRide.position.copy(worldPos(1.2));
  }

  function fitRide(){
    /* Ask the shop whether it is yours, not the wallet. A free car was never
       bought, so it is not in the owned list — checking the wallet directly
       meant the one car everybody starts with was the one car that would not
       load. */
    const c = window.SHOP ? SHOP.car() : null;
    const want = (c && SHOP.ownsCar(c)) ? c : null;
    if((want?want.id:null)===rideId) return;
    rideId = want ? want.id : null;
    if(ride && ride.parent) ride.parent.remove(ride);
    ride=null;
    if(!want){ if(window.AVATAR) AVATAR.attach(); return; }
    rideModel(want.id).then(holder=>{
      if(rideId!==want.id || !on) return;
      ride=holder; G.roomGroup.add(ride);
      if(window.AVATAR) AVATAR.detach();          // you are in it, not beside it
      keysFor();
    }).catch(()=>{ ride=null; rideId=null; });
  }
  const SHIP_BACK=19, SHIP_UP=6;      // the chase camera, for eleven metres of ship
  const RIDE_SPEED=1.9;
  /* Get in and get out, out here, without walking to a menu to do it. R
     summons whichever car you have — the one you own if you have not chosen,
     since everybody starts with one — and R again leaves it behind. */
  /* what the keys do depends on whether you are in the car */
  function keysFor(){
    if(!window.keyHint) return;
    /* ABOARD FIRST, because `flying` is true as well while she is in the
       air — and the flying hints below say "R how you travel", which was
       the only thing on screen while somebody was sealed in a cockpit
       with no way out. */
    if(aboard) keyHint(
      `<b>W</b> ${t('fly')} &nbsp; <b>S</b> ${t('slow')} &nbsp; <b>A D</b> ${t('turn')}
       &nbsp; <b>${t('mouse')}</b> ${t('look')}<br>
       <b>SPACE</b> ${t('up')} &nbsp; <b>SHIFT</b> ${t('down')}
       &nbsp; <b>R</b> ${t('get out')} &nbsp; <b>P</b> ${t('pause')}`);
    else if(ride) keyHint(
      `<b>W</b> ${t('go')} &nbsp; <b>S</b> ${t('brake / reverse')}
       &nbsp; <b>A D</b> ${t('steer')} &nbsp; <b>${t('mouse')}</b> ${t('look around')}<br>
       <b>R</b> ${t('get out')} &nbsp; <b>E</b> ${t('go in')} &nbsp; <b>P</b> ${t('pause')}`);
    else if(flying) keyHint(
      `<b>W</b> ${t('fly')} &nbsp; <b>S</b> ${t('slow')} &nbsp; <b>A D</b> ${t('turn')}
       &nbsp; <b>${t('mouse')}</b> ${t('look')}<br>
       <b>SPACE</b> ${t('up')} &nbsp; <b>SHIFT</b> ${t('down')}
       &nbsp; <b>R</b> ${t('how you travel')} &nbsp; <b>P</b> ${t('pause')}`);
    else keyHint(
      `<b>W A S D</b> ${t('walk')} &nbsp; <b>${t('mouse')}</b> ${t('look')}
       &nbsp; <b>SPACE</b> ${t('jump')}<br>
       <b>E</b> ${t('go in')} &nbsp; <b>R</b> ${t('how you travel')}
       &nbsp; <b>B</b> ${t('who you are')} &nbsp; <b>O</b> ${t('who is here')}
       &nbsp; <b>P</b> ${t('pause')}`);
  }
  /* ===================================================================
     HOW YOU GET ABOUT

     R used to be "get in the car", which is a fine key for a game with a
     car in it and a poor one for a game with a car AND wings. So R asks
     the question instead — and the answer is a row of three, because
     three ways of travelling is a choice and not a toggle you have to
     press twice to get past.

     It reads and behaves like the quick change on B: a strip along the
     bottom, the world still on the glass behind it, arrows and Enter. */
  const WAYS = [
    { id:'foot', em:'\u{1F6B6}', name:'On foot' },
    { id:'car',  em:'\u{1F697}', name:'Drive' },
    { id:'fly',  em:'\u{1F54A}', name:'Fly' }
  ];
  let travelUp=false;
  const carAvailable = () => !!(window.SHOP && SHOP.CARS.some(c=>SHOP.ownsCar(c)));
  /* ON A MISSION YOU GET ABOUT THE WAY THE MISSION SAYS. Robin's car and
     Robin's jetpack are things she owns on her own worlds; inside a story
     they are two ways to be somewhere the story did not put you — over the
     tower before you have a reason to go, or across the ridge on foot in a
     vehicle the mission is not about. The E-45 is the way to travel here
     and she is earned. `foot` always stays: a world you cannot walk on is
     not a world. */
  /* WALKING IS ALWAYS OPEN, AND A MISSION WORLD IS OTHERWISE WALKED.

     The rule is right: a story with a car in it is a story a student
     drives past. But RYU grew a second half — a bowl of stone a hundred
     and thirty units across with a fight in it — and `fly` is the only
     way to see the inside of that from above, or to get back to the
     tower without re-crossing the desert. So a world may say so. The car
     stays shut: there is nowhere on RYU that walking does not reach. */
  const wayOpen = id => id==='foot'
                     || (id==='fly' && !!(W && W.flyOk))
                     || !(W && W.mission);
  const wayNow = () => flying ? 'fly' : ride ? 'car' : 'foot';

  function travelOpen(){
    if(travelUp || !on) return;
    const el=document.querySelector('#travel'); if(!el) return;
    travelUp=true;
    if(document.pointerLockElement) document.exitPointerLock();
    const ttl=document.querySelector('#travelTitle');
    if(ttl) ttl.textContent=t('HOW DO YOU WANT TO GET ABOUT?');
    const row=document.querySelector('#travelRow');
    row.innerHTML='';
    const now=wayNow();
    WAYS.forEach(w=>{
      const open = wayOpen(w.id) && (w.id!=='car' || carAvailable());
      const b=document.createElement('button');
      b.className='waytile'+(w.id===now?' on':'')+(open?'':' locked');
      b.dataset.w=w.id;
      b.setAttribute('aria-pressed', w.id===now?'true':'false');
      b.innerHTML=`<span class="wayem">${w.em}</span><b>${t(w.name)}</b>`;
      b.onclick=()=>travelPick(w.id, open);
      row.appendChild(b);
    });
    travelHint();
    el.classList.remove('hidden');
    const cur=row.querySelector('.waytile.on')||row.firstChild;
    if(cur) cur.focus();
  }
  function travelHint(msg){
    const el=document.querySelector('#travelHint'); if(!el) return;
    el.innerHTML = msg || t('<b>\u2190 \u2192</b> pick &nbsp; <b>R</b> or <b>Esc</b> close');
  }
  function travelClose(){
    if(!travelUp) return;
    travelUp=false;
    const el=document.querySelector('#travel'); if(el) el.classList.add('hidden');
    if(G.running && window.lockPointer){
      const v=document.querySelector('#view'); if(v) lockPointer(v);
    }
  }
  function travelPick(id, open){
    if(!open){
      travelHint(!wayOpen(id) ? t('Not here. <b>THE E-45</b> is how you travel on this one.')
                              : t('No car yet. The Mechanic sells them.'));
      if(window.beep) beep('bad'); return; }
    if(id===wayNow()){ travelClose(); return; }
    if(window.beep) beep('pop');
    if(flying && id!=='fly') land();
    if(id==='car'){ if(!ride) toggleRide(); }
    else if(ride && id!=='car') toggleRide();
    if(id==='fly' && !flying) takeOff();
    travelClose();
  }
  /* Arrows move focus and Enter is the click a button already understands,
     so this only has to move the focus and swallow the keys — left and
     right turn you round a planet everywhere else. */
  function travelKey(e){
    if(!travelUp) return false;
    const k=e.code;
    if(k==='Escape'||k==='KeyR'){ travelClose(); return true; }
    const tiles=[...document.querySelectorAll('#travelRow .waytile')];
    if(!tiles.length) return false;
    if(k==='ArrowLeft'||k==='ArrowRight'){
      const i=Math.max(0, tiles.indexOf(document.activeElement));
      tiles[(i+(k==='ArrowRight'?1:-1)+tiles.length)%tiles.length].focus();
      return true;
    }
    if(k==='ArrowUp'||k==='ArrowDown') return true;
    return false;
  }

  function toggleRide(){
    if(!on || !window.SHOP) return;
    if(!wayOpen('car')){ say(t('Not here. <b>THE E-45</b> is how you travel on this one.')); return; }
    if(rideId){ SHOP.equip(rideId); fitRide(); me.spd=0; me.look=0;
                keysFor(); say(t('Back on foot.')); return; }
    let c=SHOP.car();
    if(!c || !SHOP.ownsCar(c)) c=SHOP.CARS.find(x=>SHOP.ownsCar(x));
    if(!c){ say(t('No car yet. The Mechanic sells them.')); return; }
    SHOP.equip(c.id);
    fitRide();
    me.spd=0; me.look=0;
    keysFor();
    say(t('{n} — <b>W</b> to go, <b>A D</b> to steer, <b>S</b> to brake.',{n:t(c.name)}));
  }

  /* the player, in a building's own frame */
  function local(b, worldPoint){
    const rel=worldPoint.clone().sub(b.frame.up.clone().multiplyScalar(PR));
    return { x:rel.dot(b.frame.right), y:rel.dot(b.frame.up), z:rel.dot(b.frame.fwd) };
  }
  /* Would standing here put us inside a wall? Only buildings anywhere near
     are worth asking, which on a sphere is a cheap angular test. */
  function blocked(dir){
    if(window.ISLANDS && ISLANDS.blocked(dir, me.alt)) return true;
    const p=dir.clone().multiplyScalar(PR + me.alt);
    for(const b of BUILDINGS){
      if(!b.frame || dir.angleTo(b.dir)*PR > b.w+b.d) continue;
      const l=local(b,p), feet=l.y;
      for(const s of b.solids){
        if(feet+2.2 < s.y1 || feet > s.y2-0.6) continue;
        if(l.x+PLAYER_R>s.x1 && l.x-PLAYER_R<s.x2 &&
           l.z+PLAYER_R>s.z1 && l.z-PLAYER_R<s.z2) return true;
      }
    }
    return false;
  }
  /* The camera's own up has to BE the surface normal, or the world rolls
     over as you walk and a child throws the mouse across the room. */
  const CAM_BACK=6.2, CAM_UP=2.6;
  const CAR_BACK=12, CAR_UP=4.4;
  /* HIGHER AND FURTHER BACK THAN ANYTHING ELSE. A flyer lies flat, so the
     camera that works for a walker — just behind the shoulders — is parked
     at the soles of their shoes looking up the length of them. Lifting it
     and pulling it back turns that into the shot every flying game uses:
     the body below you, the ground past it, and the horizon where the
     horizon is. */
  const FLY_BACK=12, FLY_UP=5.4;
  function place(dt, moving, running){
    const up=me.dir.clone().normalize();
    G.pos.copy(worldPos(EYE));
    if(flying && window.AVATAR){
      /* PITCH AND ROLL GO IN THROUGH `up`, not through the heading.
         orient() flattens whatever forward it is handed against the up it
         is handed — which is right, and is what keeps a walker upright on
         a ball — so a nose tilted on its own comes back level. Tilting
         BOTH by the same angle about the same axis pitches the whole body
         and survives that flattening; rolling `up` about the nose after
         that banks it, and leaves the nose where it was.

         Movement never sees any of this. The heading that carries you
         round the planet stays flat on the surface; this is the picture. */
      const right=new THREE.Vector3().crossVectors(me.fwd, up).normalize();
      const nose=Math.max(-0.55, Math.min(0.55, -me.climb/AIR.rise*0.5));
      const u=up.clone().applyAxisAngle(right, nose);
      const f=me.fwd.clone().applyAxisAngle(right, nose);
      u.applyAxisAngle(f, me.bank);
      /* THE SHIP FLIES THE WAY THE FLYER DOES, because it is the same
         flight — the nose drops as you climb and she banks into a turn off
         exactly the numbers that tilt a person. Robin is not posed at all
         while she is aboard: she is inside. */
      if(aboard){ if(shipRide) poseShip(u, f); }
      else AVATAR.orient(worldPos(0), u, f, dt, moving, running, false);
    } else if(aboard && shipRide){
      /* On the ground with her still in it. Level, nose along the heading. */
      const f=me.fwd.clone().sub(up.clone().multiplyScalar(me.fwd.dot(up))).normalize();
      poseShip(up, f);
    } else if(ride){
      const f=me.fwd.clone().sub(up.clone().multiplyScalar(me.fwd.dot(up))).normalize();
      const r=new THREE.Vector3().crossVectors(up, f).normalize();
      /* Local +Z is the nose, exactly as it is for the characters — so +Z
         maps to FORWARD. Negating both axes was still a valid rotation, which
         is why nothing looked broken, but it was the one turned half a circle
         and the car drove everywhere backwards. */
      ride.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, up, f));
      /* No lift any more. SHOP stands a car on its own wheels, so the ground
         is where the ground is — the 0.25 that used to be here was propping
         up a model whose origin was not at its tyres. */
      ride.position.copy(worldPos(0));
    } else if(window.AVATAR){
      AVATAR.orient(worldPos(0), up, me.fwd, dt, moving, running, me.onGround);
    }
    const right=new THREE.Vector3().crossVectors(me.fwd, up).normalize();
    if(G.firstPerson){
      G.camera.position.copy(worldPos(EYE));
      G.camera.up.copy(up);
      const look=me.fwd.clone().applyAxisAngle(right, G.pitch);
      G.camera.lookAt(G.camera.position.clone().addScaledVector(look,10));
      return;
    }
    /* In a car the camera trails the LOOK direction, which the mouse turns
       independently of the nose — so you can watch where you are going round
       a bend, or look at what you are driving past. */
    const camF = ride ? me.fwd.clone().applyAxisAngle(up, me.look) : me.fwd.clone();
    const camR = new THREE.Vector3().crossVectors(camF, up).normalize();
    /* A SHIP IS NOT A PERSON-SHAPED THING. FLY_BACK is set for a body a
       couple of metres long; eleven metres of E-45 at that distance fills
       the screen and you cannot see what you are flying towards. */
    const back = aboard ? SHIP_BACK : flying ? FLY_BACK : ride ? CAR_BACK : CAM_BACK;
    const lift = aboard ? SHIP_UP   : flying ? FLY_UP   : ride ? CAR_UP   : CAM_UP;
    const head=worldPos(aboard ? 2.4 : flying ? 1.2 : ride ? 1.4 : EYE);
    /* LOOK WHERE YOU ARE GOING, not at your own hips. A flyer lies along
       the direction of travel, so a camera aimed at the point they are
       rotating about has them pointing straight away from it and stacked
       into a single foreshortened column — the one shape that reads as
       somebody standing still. Aiming a couple of metres up the track
       puts the body in the lower half of the frame, along the diagonal,
       and the ground it is crossing in the rest. */
    if(flying) head.addScaledVector(camF, 1.6);
    const off=camF.clone().multiplyScalar(-back).addScaledVector(up, lift);
    off.applyAxisAngle(camR, G.pitch);
    G.camera.position.copy(head).add(off);
    G.camera.up.copy(up);
    G.camera.lookAt(head);
  }

  /* ----------------------------------------------------- walking into one */
  function use(id){
    if(!id) return;
    /* Only ever the ids the panels actually carry. Anything else used to fall
       through to startMissionRoom() and build an arena out of a typo. */
    const known = id==='ryuhouse' || id==='ship'
               || id==='arcade' || id==='workshop' || id==='mall' || id==='library'
               || id==='librarian' || id==='purse' || id==='mechanic'
               || id==='lift' || id==='towermech' || id==='einstein' || id==='towersign'
               || id==='launch' || id==='house' || id==='counter'
               || id==='league' || id==='pvp'
               || id==='club' || id==='decks'
               || id.indexOf('wear:')===0
               || id.indexOf('buy:')===0
               || id==='takeship'
               /* THE TWO DOORS MISSION 8 ADDED, and leaving them off this
                  list is why neither of them worked. `use()` refuses any
                  id it has not been told about — which is right, because
                  an unknown id used to fall through to startMissionRoom()
                  and build a room out of a typo — but it refuses SILENTLY,
                  so a door with a nameplate, a verb and a hit box does
                  nothing at all when you press E at it and there is
                  nowhere to look for why.

                  `preflight` is the lit panel on the E-45's flank; the
                  whole of it was reachable and dead. `brawlgate` is the
                  way into the arena. */
               || id==='preflight' || id==='brawlgate'
               || id.indexOf('fly:')===0
               || STATIONS.some(s=>s.id===id);
    if(!known) return;
    /* The Gym is a room you walk into and choose in, like the Mall: these
       two consoles standing either side of the floor are the choice. */
    /* THE LIVE ARENA IS NOT A DOOR ANY MORE. It was a panel on this
       wall, which meant reaching the only part of it that teaches
       anything — the blocks — cost a flight to VOLTA and a walk across
       a room. It is a card on Mission Control now, and the pit is the
       first thing you see. See game.js's `arena`. */
    if(id==='league' || id==='pvp'){
      if(!window.MECH) return;
      if(id==='pvp' && !(window.NET && NET.live)){
        say(t('Fighting a classmate needs the server. The league is next door.'));
        return;
      }
      wentTo('gym'); leave();
      document.querySelector('#hud').classList.remove('hidden');
      return MECH.start({ pvp:id==='pvp' });
    }
    /* The decks do not take you anywhere. You are already standing at
       them — the room is the point — so the set opens over the world the
       way the Library does, and walking is held until you step away. */
    /* The arcade is a shelf, not a room: a gallery is a list of names and
       stars, and cabinets you have to walk between would be a worse way to
       read one. Same shape as the Wardrobe. */
    if(id==='arcade'){
      if(!window.ARCADE) return;
      wentTo('gym'); leave();
      return ARCADE.open();
    }
    if(id==='decks'){ if(window.CLUB) CLUB.take(); return; }
    if(id==='club'){ say(t('The decks are at the back. <b>E</b> to play the set.')); return; }
    if(id==='takeship'){
      if(hasShip()){ say(t('It is already yours — it is on <b>THE PAD</b>.')); return; }
      takeShip(); return;
    }
    if(id.indexOf('fly:')===0){ travel(id.slice(4)); return; }
    if(id==='workshop'){ wentTo('workshop'); leave();
                         return FREE.enter(server||{id:null,name:'Workshop'}, null); }
    // the Mall is a room you walk round, not a screen: only the counter
    // inside it opens the full list, and that is 'counter'
    if(id==='mall'){ say(t('Walk up to anyone. <b>E</b> to wear them.')); return; }
    if(id==='counter'){ wentTo('counter'); leave(); return MENU.chars(); }
    /* The library does not take you anywhere — it opens over the world, so
       you can look a word up and still be standing where you were. */
    /* THE HOUSE ON RYU. `house` was taken — it is the one on your home
       planet, and it opens Free Play — so this one is named for the ball
       it stands on rather than quietly changing what the other one means. */
    if(id==='ryuhouse'){
      if(!window.HOUSE) return;
      wentTo('ryuhouse'); leave();
      document.querySelector('#hud').classList.remove('hidden');
      HOUSE.enter();
      return;
    }
    /* THE PRE-FLIGHT. It does not take you anywhere — you stay on the
       planet, standing beside the ship whose checklist you are filling in,
       and nothing about her is rebuilt when you are done, because nothing
       about her CHANGED. Nine rules got their words back. */
    if(id==='ship'){
      /* CLEARED ALREADY? Then the canopy is standing open and she is
         waiting to be climbed into, and re-opening a checklist that has
         nine ticks on it is the game asking a question it already has the
         answer to. */
      if(shipOpen() && board()) return;
      if(!window.BOOLQUIZ) return;
      /* THE REASON FIRST, THE BLANKS SECOND. The brief plays over the ship
         she is standing at and hands straight on to the panel; if it
         cannot play, or has played already, the panel opens on its own
         and nothing is waited for. */
      if(!briefed() && shipBrief(openFix)) return;
      openFix();
      return;
    }
    /* ------------------------------------------------------- the tower */
    /* The hatch, which is the checklist and nothing else — see shipBuild.
       The brief still plays the first time, wherever it is opened from. */
    if(id==='preflight'){
      if(!window.BOOLQUIZ) return;
      if(!briefed() && shipBrief(openFix)) return;
      openFix();
      return;
    }
    /* `brawlgate` AND NOT `arena`, WHICH IS ALREADY A WORLD. There is a
       mecha arena among this game's balls, so a door called 'arena' is a
       door whose id is also the name of somewhere the travel system can
       fly you. Nothing had gone wrong yet and it is exactly the kind of
       thing that goes wrong once.

       AND IT NEARLY DID. The live arena's own station was written as
       'arena' first, which would have put a console in Mission Control
       whose id was VOLTA. It is `ring`. */
    if(id==='brawlgate'){ arenaIn(); return; }
    if(id==='lift'){ liftGo(); return; }
    if(id==='towersign'){ say(t('The lift is at the back. <b>E</b> on it to go up.')); return; }
    if(id==='towermech'){ handOver(); return; }
    if(id==='einstein'){ einstein(); return; }
    if(id==='library'){ if(window.LIBRARY) LIBRARY.open(); return; }
    // the mechanic has no screen: the room IS the shop, so walking in is it
    if(id==='mechanic'){ say(t('Walk down the bays. <b>E</b> at a price to buy it.')); return; }
    if(id==='librarian'){ ask(); return; }
    if(id==='purse'){
      say(t('{c} ◆ · {x} XP',{c:WALLET.coins(), x:WALLET.xp?WALLET.xp():0}));
      return;
    }
    if(id.indexOf('buy:')===0){ purchase(id.slice(4)); return; }
    if(id.indexOf('wear:')===0){ wear(id.slice(5)); return; }
    if(id==='launch'){ travel(); return; }
    if(id==='house'){ wentTo('house'); leave();
                      return FREE.enter(server||{id:null,name:'Home'}, null); }
    if(!PROGRESS.unlocked(id)){
      say(t('\u{1F512} Finish {m} first',{m:t(MENU.labelOf(PROGRESS.needs(id)))}));
      return;
    }
    wentTo('mission');
    leave();
    document.querySelector('#hud').classList.remove('hidden');
    startMissionRoom(id);
  }

  /* HER SAFETY RULES, TWENTY OF THEM, lifted out of use() so the brief has
     something to hand on to when it finishes.

     THIS WAS A CHECKLIST — nine rules, each with a blank in it, a bank of
     comparison symbols and a table of readings to test your guess
     against. It went the same way the belt did and for the same reason:
     it asked a student to assemble the answer before it had asked them
     whether they knew what "at least" meant. The twenty questions below
     are that, in English.

     A DIFFERENT SUBJECT IN THE SAME SHAPE. The Mechanic's twenty are
     about joining facts together with `and`, `or` and `not`. Hers are
     about where ONE fact stops, which is the other half of every rule on
     this ship and the half no other lesson in the mission touches: at
     least, at most, under, over, exactly, anything but — and the number
     itself, which is the only place any two of those disagree. */
  function openFix(){
    if(!on || !window.BOOLQUIZ) return;
    BOOLQUIZ.open({ bank:'gauges', onDone: (score, total)=>{
        if(!on) return;
        /* LEVEL TWO OF MISSION 8. */
        if(window.ION) ION.pass(CLEARED);
        else try{ if(window.PROGRESS) PROGRESS.set(CLEARED,1); }catch(e){}
        canopyOpen();
        shipVerb();
        /* WHERE THE MECHANIC IS, said in the only terms that are true now.
           This used to say "take the shuttle from the pad", and there is no
           pad: RYU is a mission with one door, and the way to anywhere else
           is back out through it. */
        say(t('Pre-flight clear \u2014 she will fly. The <b>MECHANIC</b> is on Senio; '
            + '<b>LEAVE</b> takes you back to Mission Control.'));
        if(score!==undefined && total) say(t('{a} of {b} first time.', { a:score, b:total }));
      }});
  }
  function say(msg){
    // the tour is already talking, in the same corner — same reason as flight
    if(window.COACH && COACH.running){
      const q=document.querySelector('#briefing'); if(q) q.classList.add('hidden');
      return;
    }
    const b=document.querySelector('#briefing'); if(!b) return;
    b.classList.remove('hidden'); b.innerHTML=msg;
    clearTimeout(say._t);
    say._t=setTimeout(()=>{ if(on) b.innerHTML=t('Walk into a building. <b>E</b> to go in.'); }, 3200);
  }

  /* ------------------------------------------------------------ the class
     Presence carries two numbers and a heading. On a ball those two numbers
     are longitude and latitude rather than x and z: the same two slots, read
     differently, because where you are on a sphere is two angles. */
  /* ================================================ A MISSION IS PLAYED ALONE
     RYU IS A STORY AND STORIES DO NOT HAVE A CROWD IN THEM.

     Every ball in this game shares one presence system, and RYU was in it
     by default: a class of thirty all opening Mission 8 at once were
     thirty people on the same hillside, watching each other walk into the
     same house to find the same robot on the same floor. The one thing
     the cold open is for — you came downstairs and he was on the floor —
     does not survive four other students standing in the kitchen.

     BOTH DIRECTIONS, because either one alone is half a fix. Not drawing
     anybody leaves you broadcasting from inside a story, so you appear on
     THEIR hillside; not broadcasting leaves them drawn on yours.

     WHAT IS NOT SWITCHED OFF is presence itself. wentTo('mission') has
     already told the server this player is in a mission, so the who's-here
     list is right, the chat they left behind is intact, and walking back
     out to Senio puts them in the room again with nothing to reconnect. */
  const solo = () => !!(W && W.mission);

  function connect(){
    if(solo()) return;
    if(!server || !server.id || !window.NET) return;
    NET.connect(server.id, {
      players:list=>paint(list),
      objs:()=>{},
      chat:m=>CHAT.line(m.from, m.text, m.id),
      sys:s=>CHAT.sys(s),
      clear:q=>CHAT.clear(q),
      unsay:id=>CHAT.remove(id)
    });
    CHAT.show();
  }
  function paint(list){
    if(!crowd) return;
    /* A LATE PACKET IS STILL A PACKET. The socket does not stop the moment
       a mission world is entered — it is the hub's connection and it is
       kept on purpose — so this runs on RYU with a list of everybody, and
       without this line it would draw the ones who are also there. */
    if(solo()){
      others.forEach(o=>{ if(o.g && o.g.parent) o.g.parent.remove(o.g); });
      others.clear();
      return;
    }
    const seen=new Set();
    list.forEach(p=>{
      if(window.NET && NET.me && p.id===NET.me.id) return;
      /* Only the people actually out on this ball. Somebody who has walked
         into the Workshop is sending coordinates measured in a room thirty
         metres across; read as a longitude they turn up standing in a field
         they are nowhere near. */
      if(p.at!==W.id) return;
      seen.add(p.id);
      let o=others.get(p.id);
      if(!o){
        const g=new THREE.Group();
        g.add(nameTag(p.display));
        crowd.add(g);
        o={ g, char:null, model:null, dir:dirOf(p.x,p.z), tdir:dirOf(p.x,p.z),
            head:p.yaw||0, thead:p.yaw||0, speed:0, act:null, ride:null, car:null,
            up:+p.y||0, tup:+p.y||0 };
        others.set(p.id,o);
      }
      /* THROUGH THE CAST, not straight off the wire. Everybody keeps
         sending who they actually chose — that is what the Mall and the
         roster are about and it should not be rewritten by a place — and
         each of us decides locally what body that means HERE. On a world
         with a cast the whole field turns into Robin; everywhere else
         bodyOf() hands back exactly what arrived.

         Compared on the RESOLVED body, so somebody who changes character
         behind a cast does not cause a reload that could not change
         anything, and so the crowd redresses itself if a cast ever
         changed under it. */
      const want = p.char && AVATAR.bodyOf(p.char);
      if(want && o.char!==want){
        o.char=want;
        AVATAR.load(want).then(m=>{ if(o.model) o.g.remove(o.model); o.model=m;
                                    m.visible=!o.car; o.g.add(m); })
                         .catch(()=>{});
      }
      /* Somebody who gets into a car has to be SEEN to get into a car. The
         same swap the driver makes — body away, car under them — made from
         the one field their presence carries. */
      const ride = p.ride || null;
      if(o.ride!==ride){
        o.ride=ride;
        if(o.car){ o.g.remove(o.car); o.car=null; }
        if(o.model) o.model.visible=!ride;
        if(ride) rideModel(ride).then(c=>{
          if(o.ride!==ride || !others.has(p.id)) return;
          c.position.set(0,0.25,0); o.car=c; o.g.add(c);
          if(o.model) o.model.visible=false;
        }).catch(()=>{});
      }
      o.tdir=dirOf(p.x,p.z); o.thead=p.yaw||0; o.act=p.act||null; o.tup=+p.y||0;
    });
    for(const [id,o] of others) if(!seen.has(id)){ crowd.remove(o.g); others.delete(id); }
  }
  /* WHICH CLIP SOMEBODY ELSE IS PLAYING.

     Two sources disagree and each is right about something. How fast they
     cross the ground is the honest account of what you can SEE — however
     the network eased them into it, the legs match the movement, and that
     is why walking has always been read off it rather than sent.

     But a jump is not in the movement. You go straight up; the ground you
     cover does not change, so a body watching your speed sees you walk
     off the edge of a roof. Neither is an emote. So those travel, and the
     ground still decides the rest. */
  const GROUND={ idle:1, walk:1, sprint:1 };
  function doing(o){
    if(o.act && !GROUND[o.act]) return o.act;
    return o.speed>9 ? 'sprint' : o.speed>0.4 ? 'walk' : 'idle';
  }
  function nameTag(name){
    const c=document.createElement('canvas'); c.width=256; c.height=64;
    const x=c.getContext('2d');
    x.fillStyle='rgba(29,23,48,.85)'; x.fillRect(0,14,256,36);
    x.fillStyle='#a8e6cf'; x.font='bold 24px '+uiFont(); x.textAlign='center';
    x.fillText(String(name||'').slice(0,16),128,42);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true}));
    s.scale.set(4,1,1); s.position.y=3.2; return s;
  }
  function lonLat(){
    const d=me.dir;
    return { lon:Math.atan2(d.x,d.z)*180/Math.PI,
             lat:Math.asin(Math.max(-1,Math.min(1,d.y)))*180/Math.PI };
  }
  /* Which way we are facing, measured against the frame this spot would build
     for anybody — the one number that means the same thing on both screens. */
  function heading(){
    const f=frameAt(me.dir,0);
    return Math.atan2(me.fwd.dot(f.right), me.fwd.dot(f.fwd));
  }

  let sent=0;
  function tick(dt){
    if(!on) return;
    tourTick(dt);
    canopyTick(dt);
    smokeTick(dt);
    liftTick(dt);
    folkTick(dt);
    if(window.BRAWL) BRAWL.tick(dt);
    specsTick(dt);
    arenaGreet();
    /* AND THE PLAYER'S OWN BODY, while a scene is holding the world still.
       Everything that animates the player runs off walk(), and walk() does
       not run when G.running is false — so through four minutes of
       Mission 8's dialogue the one character who never moved was the one
       the student is playing. */
    if(!G.running && window.SCENE && SCENE.active && window.AVATAR && AVATAR.tickClip)
      AVATAR.tickClip(dt, false, false, true);
    arriveTick();
    noticeTick();
    /* Twelve times a second is plenty for a map and a coin counter, and it
       keeps a canvas redraw off the sixty-frame path. */
    const now=performance.now();
    if(now-mapAt>80){ mapAt=now; drawMap(); dash(); }
    /* WRITE DOWN WHERE WE ARE, now and then. leave() catches every door on
       the planet, but a door is not how a session usually ends — a closed lid
       and a closed tab are, and neither of them calls anything. Ten seconds is
       far less ground than anybody would mind re-walking and far more than a
       write is worth paying for. */
    if(now-spotAt>10000){ spotAt=now; rememberSpot(false); }
    sunAt();
    // the statues turn slowly on their plinths, the way a museum piece does
    statues.forEach(st=>{ if(st.userData.spin) st.rotation.y += st.userData.spin*dt; });
    mallTick(dt);
    /* HOW MUCH OF THE CLUB YOU CAN HEAR, which is the club's business except
       for the one thing only the planet knows: where you are standing. One
       inside the room, falling off to nothing over the twenty metres outside
       the door — so it leaks out onto the ground the way a club does, and is
       silent from the Gym. */
    if(window.CLUB && CLUB.active){
      const cb=BUILDINGS.find(x=>x.id==='club');
      let near=0;
      if(cb && cb.dir){
        const d=me.dir.angleTo(cb.dir)*PR;
        const inner=Math.max(cb.w,cb.d)/2;
        near = d<=inner ? 1 : Math.max(0, 1-(d-inner)/22);
      }
      CLUB.tick(dt, near);
    }
    flyTick(dt); beastTick(dt);
    if(window.ISLANDS) ISLANDS.tick(dt);      // the falls run, and the fish swim
    if(window.MEADOW) MEADOW.tick(dt, me);    // the grass round your feet
    adaTick(dt);
    const k=1-Math.pow(0.0008, Math.min(dt,0.1));
    for(const [,o] of others){
      const was=o.g.position.clone();
      o.dir.lerp(o.tdir,k).normalize();
      /* Their heading is an angle in the frame under THEIR feet, so it has to
         be turned back into a direction there and the whole basis built round
         it. Rotating the nose while keeping the old right-hand vector left the
         matrix out of square, and a body on an out-of-square basis leans — the
         further round the ball they walked, the further over they went. */
      let d=o.thead-o.head; d=Math.atan2(Math.sin(d),Math.cos(d));
      o.head+=d*k;
      const f=frameAt(o.dir,o.head);
      // everyone else stands on the same hills you do — and flies over them
      o.up += (o.tup-o.up)*k;
      o.g.position.copy(o.dir).multiplyScalar(PR + floorAt(o.dir) + o.up);
      o.g.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(f.right, f.up, f.fwd));
      // how fast they are actually crossing the ground, so the legs match it
      const v=was.distanceTo(o.g.position)/Math.max(dt,0.001);
      o.speed += (v-o.speed)*Math.min(1,dt*8);
      if(o.model && !o.ride) AVATAR.animate(o.model, dt, doing(o));
    }
    if(window.NET && NET.live && !solo()){
      const now=performance.now();
      if(now-sent>90){
        sent=now;
        const ll=lonLat();
        /* Not G.yaw: that is how far the mouse has been dragged, which means
           nothing on anybody else's screen. What travels is the heading in the
           frame under our own feet, which rebuilds anywhere on the ball. */
        /* HEIGHT TRAVELS TOO, now that there is any. Two numbers and a
           heading were the whole of where somebody was for as long as
           everybody was on the ground; a flyer sent that way turns up on
           everyone else's screen walking across the field underneath
           themselves. `y` is metres over the ground rather than a radius,
           so it means the same thing on a hill as on a beach. */
        NET.pos({ x:+ll.lon.toFixed(2), z:+ll.lat.toFixed(2), yaw:+heading().toFixed(3),
                  y:+Math.max(0, me.alt-floorAt(me.dir)).toFixed(2),
                  char:AVATAR.chosen, act:AVATAR.act, ride:rideId, at:W.id });
      }
    }
  }

  /* --------------------------------------------------------------- the sun
     A real star over a real ball would leave half the class standing in the
     dark, and a nine-year-old sent to the Library at midnight is a support
     ticket, not a lighting effect. So the sun rides with you: fixed high and
     to one side of wherever you are standing, which keeps every building lit
     the same way from every approach and still throws a long honest shadow.

     The shadow camera is a box seventy metres across, so it has to travel
     with you as well — parked at the origin it would cover a fiftieth of the
     planet and shadows would simply stop at a line on the ground. */
  /* Low, not overhead. A sun at sixty degrees casts a puddle round the foot
     of a tower; at thirty it lays the whole tower across the grass, and it is
     the length of the shadow that tells you how tall the thing is. */
  const SUN_UP=120, SUN_SIDE=150, SUN_FWD=76;
  /* And how BRIGHT it is, which is a property of the world. A directional
     light at 1.62 is midday; on VOLTA it makes a black-skied planet read as
     an overcast afternoon, and it washed out every emissive thing the world
     is actually lit by. A fifth of it, gone cold, is a moon. */
  /* THE WHOLE LIGHT RIG PER WORLD, not just the sun.

     VOLTA is lit by the things growing on it rather than by a star, so the
     numbers that make a hillside look right at noon make a crystal wood
     look like a car park at dusk. It gets a brighter fill, a warmer-lifted
     exposure and a sun that reads as a moon rather than as an absence.

     `exposure` is the one that does the most work. The crystals are
     emissive — nothing lights them, they ARE the light — and an emissive
     surface has no headroom left in its colour, so the only way to make it
     shine harder is to open the film up. The run between the planets
     already does exactly this for the same reason (see cruise.js), so a
     per-place exposure is a road this game has been down before. */
  const DAY  ={ i:1.62, c:0xfff2e0, amb:0.16, hemi:0.46, exposure:1.05 };
  const NIGHT={ i:0.46, c:0xc6d4ff, amb:0.27, hemi:0.60, exposure:1.28 };
  let exposureWas=null;
  function sunLight(){
    const k=W.night ? NIGHT : DAY;
    const s=G.sun;
    if(s){ s.intensity=k.i; s.color.setHex(k.c); }
    if(G.amb)  G.amb.intensity=k.amb;
    if(G.hemi) G.hemi.intensity=k.hemi;
    if(G.renderer){
      if(exposureWas===null) exposureWas=G.renderer.toneMappingExposure;
      G.renderer.toneMappingExposure=k.exposure;
    }
  }
  /* Hand the film and the fill back. Every flat room in the game is lit by
     the same three lights, so a night world that kept its own would make
     the next mission after VOLTA a night mission. */
  function dayAgain(){
    if(G.amb)  G.amb.intensity=DAY.amb;
    if(G.hemi) G.hemi.intensity=DAY.hemi;
    if(G.renderer && exposureWas!==null){
      G.renderer.toneMappingExposure=exposureWas;
      exposureWas=null;
    }
  }
  function sunAt(){
    const s=G.sun; if(!s || !me.dir) return;
    const up=me.dir.clone().normalize();
    const f=frameAt(up,0);
    const here=worldPos(0);
    s.target.position.copy(here);
    s.position.copy(here)
      .addScaledVector(up, SUN_UP)
      .addScaledVector(f.right, SUN_SIDE)
      .addScaledVector(f.fwd, SUN_FWD);
    s.target.updateMatrixWorld();
  }

  /* She faces the door until somebody is in the room, and then she faces
     them.  It is two lines and it is most of what separates somebody
     standing there from a statue of somebody standing there. */
  function adaTick(dt){
    if(!ada) return;
    const l=local(ada.b, worldPos(0));
    const near = Math.abs(l.x-ada.x)<11 && Math.abs(l.z-ada.z)<13;
    const want = near ? Math.atan2(l.x-ada.x, l.z-ada.z) : 0;
    let d=want-ada.yaw;
    d=Math.atan2(Math.sin(d), Math.cos(d));          // the short way round
    ada.yaw += d*Math.min(1, 4*dt);
    ada.g.rotation.y=ada.yaw;
    if(ada.model && window.AVATAR) AVATAR.animate(ada.model, dt, 'idle');
  }

  /* ------------------------------------------------------------ the tour */
  const TOUR_KEY='dq_toured';
  const toured =()=>{ try{ return !!localStorage.getItem(TOUR_KEY); }catch(e){ return false; } };
  const markToured=()=>{ try{ localStorage.setItem(TOUR_KEY,'1'); }catch(e){} };

  const MC=()=>BUILDINGS[0];
  const doorPoint = b => b.g ? b.g.localToWorld(V(0,3,b.d/2+4)) : V(0,0,0);
  const insideOf = b => { if(!b.frame) return false;
    const l=local(b, me.dir.clone().multiplyScalar(PR));
    return Math.abs(l.x)<b.w/2 && Math.abs(l.z)<b.d/2; };
  const metresTo = p => worldPos(0).distanceTo(p);
  const withSize=(v,s)=>({x:v.x,y:v.y,z:v.z,size:s});

  function tour(){
    if(!window.COACH) return;
    // hud() already put a briefing up; the tour talks in the same corner
    const bq=document.querySelector('#briefing'); if(bq) bq.classList.add('hidden');
    const start=me.dir.clone(), yaw0=G.yaw;
    /* Ask the ROOM where its consoles are, rather than repeating the layout
       here. This used to be a hard-coded corner of the old back-wall rank,
       and when the stations moved into a horseshoe the arrow went on
       pointing confidently at an empty patch of floor. Nearest one to the
       player, so the tour points at the one they would walk to. */
    const firstStation=()=>{
      const b=MC(); if(!b.g) return V(0,0,0);
      let best=null, bd=1e9;
      const p=worldPos(0), w=new THREE.Vector3();
      G.hits.forEach(h=>{
        const own=h.userData.owner; if(!own || !own.userData) return;
        if(!STATIONS.some(st=>st.id===own.userData.enter)) return;
        own.getWorldPosition(w);
        const d=w.distanceTo(p);
        if(d<bd){ bd=d; best=w.clone(); }
      });
      return best || b.g.localToWorld(V(0, 2.5, -b.d/2+6));
    };
    COACH.start([
      /* One line each. A child reading six sentences is a child not playing,
         and every one of these is about a key they can press right now. */
      { say:'Hold <b>W</b> to walk.',
        done:()=>me.dir.angleTo(start)*PR > 9 },
      { say:'Move the mouse to look around.',
        done:()=>Math.abs(((G.yaw-yaw0+Math.PI*3)%(Math.PI*2))-Math.PI) > 0.5 },
      { say:'Walk to the ringed door.',
        at:()=>withSize(doorPoint(MC()),3.5),
        done:()=>metresTo(doorPoint(MC())) < 14 },
      { say:'Go inside.',
        at:()=>withSize(doorPoint(MC()),3.5),
        done:()=>insideOf(MC()) },
      { say:'The missions are round the walls. Point at one.',
        at:()=>withSize(firstStation(),2),
        done:()=>!!(G.focused && G.focused.userData && G.focused.userData.enter) },
      { say:'Press <b>E</b> to go in.',
        at:()=>withSize(firstStation(),2),
        done:()=>!on }
    ], {});
  }
  /* ================================================== THE ION WALKTHROUGH
     RYU HAD NONE, AND IT IS THE ONE BALL THAT NEEDED ONE.

     Every other world here is a place: you land, you look round, you walk
     into whatever you like. RYU is a mission with one door and an ORDER —
     mend the robot on the kitchen floor, mend the ship he needs you to
     fly, fly him two hundred units, hand him over — and none of that is
     guessable from a hillside with a house, a spaceship and a tower on
     it. The hub's walkthrough rings Mission Control's door; this one has
     four objects on two hundred units of desert and a story between them.

     IT READS THE SAVE RATHER THAN COUNTING ITS OWN STEPS. Every `done`
     here is the same flag the mission itself is gated on, so a student who
     wanders off, lands somewhere else, or comes back tomorrow is picked up
     at the step they are actually on — and one who has already flown the
     ship is never sent back to the house to look at Ion.

     AND IT RUNS ONCE PER ARRIVAL, not once ever. The hub's tour is about
     which keys walk you forward and is worth exactly one showing; this one
     is about where the next thing is, which is worth having every time you
     come back to a mission you left half done. It ends itself the moment
     the mission is complete. */
  const ionFlag = k => { try{ return !!(window.PROGRESS && PROGRESS.get(k,0)); }
                         catch(e){ return false; } };
  function ionTour(){
    if(!window.COACH || !W || W.id!=='ryu') return;
    if(ionFlag('ion_belt')) return;            // mission finished: nothing to point at
    const bq=document.querySelector('#briefing'); if(bq) bq.classList.add('hidden');

    const B   = id => BUILDINGS.find(b=>b.id===id);
    /* A BUILDING'S DOOR, AND A PROP'S MIDDLE. The house and the tower are
       walked INTO, so the ring goes on the doorway; the E-45 is a model on
       a patch of ground with no door at all, so it goes on the ship. */
    const doorOf = id => { const b=B(id); return b ? doorPoint(b) : V(0,0,0); };
    const spotOf = id => { const b=B(id);
      return (b && b.dir) ? b.dir.clone().multiplyScalar(PR + floorAt(b.dir) + 3) : V(0,0,0); };

    COACH.start([
      /* ONE — ION, who is the reason for all of it. */
      { say:'Ion is on the kitchen floor. Go in.',
        at:()=>withSize(doorOf('ryuhouse'), 4),
        done:()=>ionFlag('ion_fixed') || insideOf(B('ryuhouse')||{}) },
      { say:'Fix his morning questions. <b>and</b>, <b>or</b>, <b>not</b>.',
        done:()=>ionFlag('ion_fixed') },

      /* TWO — THE SHIP, and she is smoking, which is the whole brief. */
      { say:'Your ship is smoking. Walk out to her.',
        at:()=>withSize(spotOf('ship'), 5),
        done:()=>ionFlag('ion_ship_cleared') || metresTo(spotOf('ship')) < 22 },
      { say:'The lit panel on her flank is the pre-flight. <b>E</b>.',
        at:()=>withSize(spotOf('ship'), 4),
        done:()=>ionFlag('ion_ship_cleared') },

      /* THREE — THE FLIGHT. `ion_flown` is set by arriveTick when she puts
         down near the tower, so this one step covers getting in, taking
         off and crossing two hundred units of desert. */
      { say:'<b>E</b> on the ship to get in. <b>SPACE</b> to take off.',
        at:()=>withSize(spotOf('ship'), 4),
        done:()=>ionFlag('ion_flown') || flying },
      { say:'Fly to the tower. It is the tall one.',
        at:()=>withSize(spotOf('tower'), 8),
        done:()=>ionFlag('ion_flown') },

      /* FOUR — THE TOWER, which is three floors and a lift, and the lift
         is the one thing in this building nobody finds on their own. */
      { say:'Walk in. The lift is at the back.',
        at:()=>withSize(doorOf('tower'), 4),
        done:()=>insideOf(B('tower')||{}) || ionFlag('ion_handed') },
      { say:'Stand on the lift and press <b>E</b>.',
        done:()=>ionFlag('ion_handed') || (lift && lift.at>0) },
      /* AND IT STOPS AT THE DOOR OF THE LAST ONE. There used to be a
         tenth step — "answer his twenty questions and he mends Ion" —
         which is a card describing the panel that is open on top of it.
         The walkthrough's job is getting somebody to the lesson; once
         they are in it, it has nothing left to say. */
      { say:'Give Ion to the Mechanic.',
        done:()=>ionFlag('ion_handed') },
      /* AND THE LAST THING THE MISSION ASKS FOR. The glasses put you
         outside the tower facing a bowl of stone you have every reason
         not to understand; the walkthrough says the one thing that turns
         it from scenery into somewhere to go, which is that it has a
         door. */
      { say:'Something is out there. Walk to it.',
        at:()=>{ const C=dirOf(BRAWL_AT.lon, BRAWL_AT.lat);
                 return withSize(C.clone().multiplyScalar(PR+floorAt(C)+40), 12); },
        done:()=>ionFlag('ion_arena')
              || !ionFlag('ion_belt')          // not owed until the belt is done
      }
    ], {});
  }

  function tourTick(dt){ if(window.COACH) COACH.tick(dt); }
  function retour(){ if(window.COACH) COACH.stop(); tour(); }

  /* -------------------------------------------------- the player dashboard
     Who you are, what you are on, what you have. It is the answer to the
     three questions a child asks first and it should not require opening a
     menu to see. */
  function dash(){
    const el=document.querySelector('#dash'); if(!el || !window.WALLET) return;
    el.classList.remove('hidden');
    /* THE FACE IN THE CORNER IS THE BODY YOU ARE IN, not the one you own.
       On a world that casts everybody, the dashboard showing the character
       you picked while a different one walks about underneath it is the
       game disagreeing with itself in the two places a player looks
       first. bodyOf() is the chosen character everywhere else. */
    const me_=AVATAR.bodyDef(AVATAR.bodyOf(AVATAR.chosen));
    const face=document.querySelector('#dFace');
    if(face && me_ && face.getAttribute('src')!==me_.preview) face.src=me_.preview;
    const nm=document.querySelector('#dName');
    if(nm) nm.textContent = me_ ? t(me_.name) : '';
    const rd=document.querySelector('#dRide');
    /* IN THE AIR THE INTERESTING NUMBER IS THE HEIGHT, and it is only
       interesting against the ceiling — "40m" means nothing, "40 of 120"
       is a place in a climb. */
    if(rd) rd.textContent = flying
      ? t('flying \u2014 {a}m of {c}',{ a:Math.round(Math.max(0,me.alt-floorAt(me.dir))),
                                     c:ceilingOf() })
      : ride && SHOP.car() ? t('driving {n}',{n:t(SHOP.car().name)})
      : t('on foot');
    const p=WALLET.progress();
    const lv=document.querySelector('#dLv'); if(lv) lv.textContent=t('Level')+' '+p.level;
    const bar=document.querySelector('#dBar');
    if(bar) bar.style.width=Math.round(100*p.into/p.span)+'%';
    const co=document.querySelector('#dCoins'); if(co) co.textContent=WALLET.coins();
  }

  /* ------------------------------------------------------------- the map

     The whole world on one disc. YOU are the centre, the rim is the far side
     of the planet, and forward is up — so the map turns as you do and you
     never have to work out which way you are holding it.

     Distance is SQUARE-ROOTED rather than linear. Straight proportion is the
     honest projection and it was useless: the four buildings sit inside
     eighty metres of a world that is twelve hundred round, so all of them
     landed in a thumbnail at the centre with the entire disc empty around
     them. The root spreads out what is near you, which is what you are
     navigating by, and still fits the whole planet on. */
  let mapAt=0;
  function drawMap(){
    const c=document.querySelector('#pmapC'); if(!c || !me.dir) return;
    const wrap=document.querySelector('#pmap'); if(wrap) wrap.classList.remove('hidden');
    /* CW and CH, not W and H. `W` is THE WORLD in every other function in
       this file, and calling the canvas width W here shadowed it for the
       whole of this one — so the label at the bottom read t(undefined) and
       came out blank rather than wrong, which is the kind of wrong nobody
       reports. */
    const x=c.getContext('2d'), CW=c.width, CH=c.height, cx=CW/2, cy=CH/2, R=CW/2-8;
    x.clearRect(0,0,CW,CH);

    const up=me.dir.clone().normalize();
    const fwd=me.fwd.clone().sub(up.clone().multiplyScalar(me.fwd.dot(up))).normalize();
    const rt=new THREE.Vector3().crossVectors(fwd, up).normalize();
    const project=(d)=>{
      const th=Math.acos(Math.max(-1,Math.min(1, d.dot(up))));   // 0 at you, PI opposite
      const r=Math.sqrt(th/Math.PI)*R;
      const tan=d.clone().sub(up.clone().multiplyScalar(d.dot(up)));
      if(tan.lengthSq()<1e-9) return {x:cx, y:cy, far:th};
      tan.normalize();
      const a=Math.atan2(tan.dot(rt), tan.dot(fwd));             // 0 straight ahead
      return { x:cx+r*Math.sin(a), y:cy-r*Math.cos(a), far:th };
    };

    x.fillStyle='rgba(10,18,32,.9)';
    x.beginPath(); x.arc(cx,cy,R,0,Math.PI*2); x.fill();
    // the horizon you can actually see, and the halfway line round the world
    x.strokeStyle='rgba(143,240,255,.13)'; x.lineWidth=1;
    x.beginPath(); x.arc(cx,cy,R/2,0,Math.PI*2); x.stroke();
    x.strokeStyle='rgba(143,240,255,.34)'; x.lineWidth=2;
    x.beginPath(); x.arc(cx,cy,R,0,Math.PI*2); x.stroke();

    // your classmates, if anybody is here
    x.fillStyle='#8fd3ff';
    for(const [,o] of others){
      const p=project(o.dir.clone().normalize());
      x.beginPath(); x.arc(p.x,p.y,2.6,0,Math.PI*2); x.fill();
    }

    BUILDINGS.forEach(b=>{
      if(!b.dir) return;
      const p=project(b.dir);
      // things round the curve of the world are drawn faint, not hidden
      x.globalAlpha = p.far>Math.PI/2 ? 0.42 : 1;
      // a pip in the building's own roof colour, so it reads before the emoji
      x.fillStyle='#'+b.roof.toString(16).padStart(6,'0');
      x.beginPath(); x.arc(p.x, p.y, 8.5, 0, Math.PI*2); x.fill();
      x.font='11px system-ui,"Apple Color Emoji","Segoe UI Emoji"';
      x.textAlign='center'; x.textBaseline='middle';
      x.fillText(b.em, p.x, p.y+0.5);
      x.globalAlpha=1;
    });

    // you, pointing the way you are facing, which on this map is always up
    x.fillStyle='#a8e6cf';
    x.beginPath();
    x.moveTo(cx, cy-7); x.lineTo(cx-5, cy+5); x.lineTo(cx+5, cy+5);
    x.closePath(); x.fill();
    /* THE NAME OF THE BALL YOU ARE STANDING ON. It used to be the name of
       the multiplayer lobby, which offline is nothing, so it said HOME
       PLANET — on Senio, and on VOLTA, and on the home planet, all three.
       Every world has had a name of its own since there was more than one
       of them. */
    const nm=document.querySelector('#pmapName');
    if(nm) nm.textContent = t(W.name);
  }

  /* ---------------------------------------------------------------- HUD */
  function hud(){
    const n=document.querySelector('#missionName');
    if(n) n.textContent = t(W.name) + (W.sub ? ' \u2014 '+t(W.sub) : '');
    /* What is on THIS ball. It used to be the hub's four buildings written
       out by hand, which read as a lie the moment you flew anywhere: a
       student standing on the fight world was being told where the Library
       was. The buildings already carry their own name and their own line. */
    const o=document.querySelector('#objList');
    /* AND THE PAD ONLY IF THERE IS ONE. This line was appended
       unconditionally, which was true of every world that had ever had
       this panel — and then RYU stopped having a pad. A mission world with
       one door was telling the player, in the list of what is here, that
       they could fly to another planet from it. The list is what is HERE;
       `W.pad` is whether the pad is. */
    if(o) o.innerHTML = BUILDINGS.filter(b=>b.id!=='pad')
      .map((b,i)=>`<li${i?'':' class="cur"'}>${b.em} ${t(b.name)}${
        b.blurb? ' — '+t(b.blurb) : ''}</li>`)
      .concat(W.pad ? [`<li>\u{1F6F8} ${t('The Pad')} — ${t('fly to another planet')}</li>`] : [])
      .join('');
    say(t('Walk into a building. <b>E</b> to go in.'));
  }

  /* Walking in somewhere is worth saying out loud, and it is the same message
     that takes your body off everybody else's field. */
  const wentTo = where => { if(window.NET && NET.live) NET.place(where); };
  function leave(){
    rememberSpot(true);
    on=false;
    /* You are not in the air any more, wherever you are going. The posture
       is AVATAR's and would otherwise follow you indoors, where it would
       quietly outrank every walk in the building. */
    flying=false; travelClose(); dome=null; streak=null;
    me.air=0; me.climb=0; me.bank=0; me.roll=0; me.lean=0;
    if(window.AVATAR) AVATAR.posture(null);
    /* AND THE GLASSES COME OFF WHEN YOU GO INDOORS. The overlay is fixed
       to the viewport rather than to the world, so it would otherwise go
       on tinting the screen inside the tower — where there is no ridge to
       look at anyway. You still have them: walk back out, press G. */
    specsOff();
    if(window.MUSIC && MUSIC.wind) MUSIC.wind(0);
    if(window.MUSIC) MUSIC.stop();      // whatever you walked into, it is not out here
    if(window.CLUB) CLUB.stop();        // and the club does not follow you off the planet
    // whatever we are walking into, we are not out here any more
    wentTo('inside');
    /* Let the last tour step notice it is done, then take the card away — its
       farewell used to hang about for five seconds over whatever screen you
       had just walked into. */
    if(window.COACH){ COACH.tick(0); COACH.stop(); }
    if(window.CHAT) CHAT.hide();
    const b=document.querySelector('#briefing'); if(b) b.classList.add('hidden');
    others.clear(); crowd=null;
    ['#dash','#pmap'].forEach(q=>{ const e=document.querySelector(q); if(e) e.classList.add('hidden'); });
    G.camera.up.set(0,1,0);        // hand the flat rooms their world back
    // and their clip planes: a flat room is thirty metres across, and a depth
    // buffer stretched to eighteen hundred fights with itself at that size
    G.camera.near=0.1; G.camera.far=220; G.camera.updateProjectionMatrix();
    if(G.sun){ G.sun.position.set(48,96,34); G.sun.target.position.set(0,0,0);
               G.sun.target.updateMatrixWorld();
               // and its daylight, or every flat room after VOLTA is a night room
               G.sun.intensity=DAY.i; G.sun.color.setHex(DAY.c); }
    dayAgain();
  }
  function stop(){ leave(); }

  return { enter, tick, walk, use, stop, leave, tour:retour, fitRide, facing, toggleRide,
           leaveShip, get aboard(){ return aboard; },
           specsKey, get specs(){ return specsOn; }, get hasSpecs(){ return haveSpecs(); },
           travel:travelOpen, travelKey, get travelUp(){ return travelUp; },
           get flying(){ return flying; }, land,
           get riding(){ return !!ride; },
           STATIONS, lonLat, frameAt, dirOf,
           get BUILDINGS(){ return BUILDINGS; },
           get PR(){ return PR; },
           get world(){ return W; },
           get ao(){ return aoStats; },
           /* Forget where I stood — on every ball, on disk as well as in
              this session, or "forget" would last until the next reload. */
           forget(){
             backs={}; spotWas=null;
             if(window.PROGRESS && PROGRESS.set){
               WORLDS().forEach(w=>PROGRESS.set(SPOT(w.id), null));
               PROGRESS.set('world','hub');
             }
           },
           lastWorld, leaveTo,
           get where(){ return me; },
           get active(){ return on; },
           get server(){ return server; } };
})();
