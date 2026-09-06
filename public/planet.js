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
      relief:6.5 + (seed>>>7)%6,
      buildings:[
        { id:'house', name:planetName(seed)+' HOUSE', em:'\u{1F3E0}', lon:0, lat:2,
          w:26, d:22, h:12, door:8,
          wall:0x4a3f7a, roof:0xcdb4f6, blurb:'Yours. Build whatever you like in it' }
      ],
      pad:{ lon:0, lat:-13 }
    };
  }
  const HUB={
    id:'hub', kind:'hub', seed:0, name:'KORO', sub:'everybody lands here',
    /* Radius sets how hard the world curves. The horizon from the chase camera
       is roughly sqrt(2*PR*camHeight), so 92 put it 28 metres out and buildings
       rose out of the ground in front of you. At 320 it is past fifty and the
       curve reads as a planet rather than a hill you are always on top of. */
    radius:320, sky:0x070a1a, soil:BIOMES[0].soil, biome:'green', relief:9.5,
    buildings:HUB_BUILDINGS,
    pad:{ lon:-34, lat:-9 }
  };
  const worldById = id => id==='home' ? homeWorld() : HUB;

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
    BUILDINGS = w.buildings = w.buildings.filter(b=>b.id!=='pad');
    RELIEF=w.relief; SOIL=w.soil.map(c=>({c}));
    BUILDINGS.forEach(b=>{ b.g=null; b.dir=null; b.frame=null; b.solids=[]; });
  }
  const STATIONS=[
    { id:'tut',    em:'\u{1F3AE}', name:'Level 0 — Basics',           a:'#ffe9a8' },
    { id:'nav',    em:'\u{1F9DF}', name:'Escape — Corridors',         a:'#8fd3ff' },
    { id:'flight', em:'\u{1F680}', name:'Mission 1 — Space Explorer', a:'#8ff0ff' },
    { id:'m1',     em:'\u{1F9DF}', name:'Mission 2 — Loops',          a:'#a8e6cf' },
    { id:'m2',     em:'\u{1F52E}', name:'Mission 3 — Choices',        a:'#cdb4f6' },
    { id:'m3',     em:'\u{1F9EE}', name:'Mission 4 — Functions',      a:'#ffb4a2' }
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
  // far enough back to see the whole of whatever you are landing in front of
  const LANDING_OFF=74;
  function landingSpot(){
    const b=BUILDINGS[0];
    if(!b.frame) return dirOf(b.lon, b.lat-14);
    return b.dir.clone().applyAxisAngle(b.frame.right, LANDING_OFF/PR).normalize();
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
  let ride=null, rideId=null, carLoader=null;
  let statues=[];                    // the ones that turn on their plinths
  let aoStats=null;                  // what the ray-traced pass cost, for tuning
  /* You, as the planet sees you. G.pos is derived from this, never the
     other way round. */
  let me={ dir:null, fwd:null, alt:0, vy:0, onGround:true,
           spd:0,        // how fast the car is going, along its own nose
           look:0 };     // where you are looking, which is not where it is going
  /* Where you were standing, PER WORLD. Fly home, walk about, fly back, and
     the hub should put you down beside the pad you left from — not at the
     spot you last stood on a different planet. */
  let lastYaw=0, backs={};

  const worldPos = extra => me.dir.clone().multiplyScalar(PR + me.alt + (extra||0));

  /* ---------------------------------------------------------------- build */
  function enter(sv, worldId){
    server = sv || null;
    // whichever ball we are standing on decides its own size, sky and soil
    setWorld(worldById(worldId || (W?W.id:'hub')));
    COMBAT.reset(); PUZZLE.stop(); NAV.stop(); TUTOR.stop(); RACE.stop();
    if(window.FLIGHT) FLIGHT.stop();
    if(window.MISSIONS) MISSIONS.stop();
    if(window.CODER) CODER.hide();
    CODE.close(); CODE.hideTape(); CODE.setGuide(null); CODE.setBudget(0);
    if(window.VM) VM.leave();

    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.selected=null; G.focused=null; G.ceiling=null;
    G.ground=null; G.vel.y=0; G.onGround=true;
    others.clear();
    statues=[]; ada=null; bays=[]; spinners=[]; purseFace=null; padShip=null; padB=null;
    mannequins=[]; flies=null; beasts=[]; sparkTex=null;
    G.room='planet'; G.hudOwner='planet'; G.missionId=null; G.running=true;
    G.scene.background=new THREE.Color(SKY);
    /* The stars, the neighbour and its ring all sit five hundred metres out
       and the camera stopped seeing at two hundred and twenty, so none of the
       sky this room builds had ever been on screen. */
    G.camera.near=0.3; G.camera.far=1800; G.camera.updateProjectionMatrix();
    // fog would eat the far side of the world, and the far side is the point
    G.scene.fog=null;
    on=true;

    sky();
    padSpec(W);                    // in the list before the ground is made
    surface();
    BUILDINGS.forEach(b=>{ if(b.id!=='pad') build(b); });
    launchpad(W);                  // its plate, now that its patch is flat
    scatter();                     // after the buildings: it works around them
    cover();                       // and the small stuff after the big stuff
    fireflies();                   // and then the things that are alive
    wildlife(W.kind==='home' ? 10 : 18);
    G.scene.updateMatrixWorld(true);
    aoStats=bakeAO();              // and then trace the light into all of it
    crowd=new THREE.Group(); G.roomGroup.add(crowd);

    const back=backs[W.id];
    if(back){ me.dir=back.dir.clone(); me.fwd=back.fwd.clone(); }
    else {
      /* First landing: stand out in front of Mission Control's door, looking
         straight at it. Not "somewhere near it" — the door is on the +z side
         of the building's own frame, so step back along that side and then
         face the building. Spawning at a fixed latitude used to put you
         behind it as often as in front, which makes the first instruction a
         student ever gets ("walk to the door") a hunt. */
      // far enough back that the whole building and its sign are in frame
      me.dir=landingSpot();
      me.fwd=facing(me.dir, BUILDINGS[0].dir);
    }
    me.alt=floorAt(me.dir); me.vy=0; me.onGround=true; me.spd=0; me.look=0;
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
    if(!toured()){ markToured(); setTimeout(()=>{ if(on) tour(); }, 700); }
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
      new THREE.MeshLambertMaterial({color:0x7c5cc4}));
    neighbour.position.set(-520,180,-620);
    neighbour.userData.sky=true; G.roomGroup.add(neighbour);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(230,9,10,64),
      new THREE.MeshBasicMaterial({color:0xcdb4f6, transparent:true, opacity:.42}));
    ring.position.copy(neighbour.position); ring.rotation.set(1.15,0.3,0.2);
    ring.userData.sky=true; G.roomGroup.add(ring);
    const sun=new THREE.Mesh(new THREE.SphereGeometry(34,24,18),
      new THREE.MeshBasicMaterial({color:0xfff3d0}));
    sun.position.set(420,300,-420);
    sun.userData.sky=true; G.roomGroup.add(sun);
    /* A halo, so the star is a light source rather than a white circle. */
    const halo=new THREE.Mesh(new THREE.SphereGeometry(64,24,18),
      new THREE.MeshBasicMaterial({color:0xffe9b0, transparent:true, opacity:0.18,
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
  function soilAt(dir, h){
    const wet=fbm(dir, 2.7, 2);                    // patches, larger than the hills
    const grit=fbm(dir, 21, 2);                    // and a fine speckle over them
    let t = 1.1 + wet*3.0 + h*1.5 + grit*0.9;      // 0 = lush, 5 = stone
    t = Math.max(0, Math.min(SOIL.length-1.001, t));
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
    const ball=new THREE.Mesh(geo,
      new THREE.MeshLambertMaterial({ vertexColors:true, map:grainTexture() }));
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
  const terrainH = dir => { const k=padK(dir); return k<=0 ? 0 : rawHeight(dir)*k; };

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
  function floorAt(dir){
    for(const b of BUILDINGS){
      if(!b.frame || dir.dot(b.dir)<FLOOR_COS) continue;
      const l=local(b, dir.clone().multiplyScalar(PR));
      if(plateOff(b,l.x,l.z)>=apronOf(b)) continue;
      // altitude is measured along the radius, and the floor is not square to it
      return (plateY(b,l.x,l.z)+PR)/Math.max(0.5, dir.dot(b.dir)) - PR;
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
  function scatter(){
    const trunk=new THREE.MeshLambertMaterial({color:0x6b4a34});
    const leaf =new THREE.MeshLambertMaterial({color:0x4f9457});
    const stone=new THREE.MeshLambertMaterial({color:0x7d7a86});
    /* Four times the surface needs more on it, but every tree is two meshes
       and a school laptop pays for each one — so this is a compromise, and
       rocks (one mesh) get the larger share. */
    /* Four hundred over the whole ball rather than eight hundred and twenty.
       A tree every so often is scenery; a tree every few paces is scrub. */
    for(let i=0;i<400;i++){
      const th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
      const dir=V(Math.sin(ph)*Math.cos(th), Math.cos(ph), Math.sin(ph)*Math.sin(th));
      if(BUILDINGS.some(b=>dir.angleTo(dirOf(b.lon,b.lat))*PR < b.w*1.2)) continue;
      if(onPath(dir)) continue;               // and not in the way of the door
      const g=new THREE.Group();
      if(Math.random()<0.45){
        const h=3+Math.random()*3;
        const t1=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.42,h,6), trunk);
        t1.position.y=h/2; g.add(t1);
        const c=new THREE.Mesh(new THREE.IcosahedronGeometry(1.5+Math.random(),0), leaf);
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
      new THREE.MeshLambertMaterial({ vertexColors:false }), count);
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

     What is left is deliberately thin. A field reads as a field because of
     what it is made of, not because of how much is standing up in it, and
     everything scattered here has to earn its place by being far enough from
     the last one to be seen as a separate thing. */
  function cover(){
    // pebbles, sparse, so bare ground has something to catch the light
    const peb=new THREE.IcosahedronGeometry(0.24, 0);
    peb.translate(0, 0.12, 0);
    plant(peb, [0x7d7a86,0x8b8578,0x6e6b74,0x94908a], 900,
          {min:0.7, max:1.9, townR:320, nearTown:0.5});
    // and the occasional thing in flower, so the ground is not only green
    const bud=new THREE.IcosahedronGeometry(0.16, 0);
    bud.translate(0, 0.62, 0);
    plant(bud, [0xe8d9a0,0xe0a0b8,0xc9b7ea,0xf0e6b4], 420,
          {min:0.8, max:1.4, townR:260, nearTown:0.7});
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
    x.font='bold 46px "Trebuchet MS",system-ui,sans-serif';
    x.fillText(text, 256, 52, 470);
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
    x.fillStyle='#eef3ff'; x.font='bold 26px "Trebuchet MS",system-ui,sans-serif';
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
  function build(b){
    const dir=dirOf(b.lon, b.lat);
    const g=new THREE.Group();
    const f=stand(g, dir, 0);
    G.roomGroup.add(g);
    b.g=g; b.dir=dir; b.frame=f; b.solids=[];
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

    const roof=new THREE.Mesh(new THREE.BoxGeometry(b.w+2.4, 0.8, b.d+2.4),
      new THREE.MeshLambertMaterial({color:b.roof}));
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

    if(b.id==='missions'){
      castle(b, g, hw, hd, H, put);
      /* Round the room, not in a rank. Six consoles in a line is a corridor
         you walk past; a horseshoe is a hall you stand in the middle of, and
         every one of them turns to face whoever has just come through the
         gate. Two along the back and two down each side. */
      const spots=[
        { x:-13, z:-hd+11, r:0 },           // back wall, facing the door
        { x: 13, z:-hd+11, r:0 },
        { x:-hw+8, z:-10, r: Math.PI/4 },   // down the left, turned toward the gate
        { x:-hw+8, z:  7, r: Math.PI/4 },
        { x: hw-8, z:-10, r:-Math.PI/4 },   // and down the right
        { x: hw-8, z:  7, r:-Math.PI/4 }
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
    } else if(b.id==='mall'){
      mallroom(g, b, hw, hd);
    } else if(b.id==='mechanic'){
      showroom(g, b, hw, hd);
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
  const FLIES=4000, FLY_R=170;
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
    flies=new THREE.Points(g, new THREE.PointsMaterial({
      color:0xfff0a0, size:0.62, sizeAttenuation:true, map:sparkTexture(),
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
    const out=[], back=Math.min(n,8), x0=-hw+8, x1=hw-8;
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
  function padSpec(w){
    padB=null;
    const spot=w.pad; if(!spot) return;
    const dir=dirOf(spot.lon, spot.lat);
    /* A roof colour and an emoji it will never wear, because the MAP draws
       every building from those two fields and a pad you cannot find on the
       map is a pad you cannot fly home from. */
    padB={ id:'pad', name:'THE PAD', em:'\u{1F6F8}', lon:spot.lon, lat:spot.lat,
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
    const to = W.kind==='home' ? HUB : homeWorld();
    panel(g, b, 0, 9.4, '\u{1F6F8}',
      t('FLY TO {n}',{n:to.name}), 'launch', '#12304a', 0.8, Math.PI);
  }
  /* Leaving a world and arriving at another is one call, because everything
     that makes a world — its size, its sky, its soil, its buildings — is
     rebuilt by enter(). What has to survive is where you were standing on
     the one you left, and backs[] is what remembers that. */
  function travel(){
    const to = W.kind==='home' ? 'hub' : 'home';
    const name = to==='hub' ? HUB.name : homeWorld().name;
    leave();
    enter(server, to);
    say(t('Touched down on {n}.',{n:name}));
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
    // cars down the left-hand wall, each on its own painted bay
    SHOP.CARS.forEach((c,i)=>{
      const x=-hw+9, z=-hd+7+i*6.4;
      const mark=new THREE.Mesh(new THREE.BoxGeometry(6.2,0.08,4.6), floorPaint);
      mark.position.set(x,0.13,z); mark.userData.flat=true; g.add(mark);
      bayPanel(g, b, x-5.4, z, Math.PI/2, 'car', c);
      loadCar(c, g, x, z);
    });
    // ships down the right, up on plinths where you can see under them
    SHOP.SHIPS.forEach((sp,i)=>{
      const x=hw-8, z=-hd+6+i*5.0;
      const col=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.9,2.2,10),
        new THREE.MeshLambertMaterial({color:0x6d6152}));
      col.position.set(x,1.1,z); g.add(col);
      const m=SHOP.model(sp);
      m.position.set(x, 3.4, z); m.scale.setScalar(1.5); m.rotation.y=-Math.PI/2;
      g.add(m);
      spinners.push(m);
      bayPanel(g, b, x+5.2, z, -Math.PI/2, 'ship', sp);
    });
    // and a purse on the wall, so you can see what you have to spend
    const purse=panel(g, b, 0, -hd+3.4, '◆',
      t('YOUR COINS'), 'purse', '#2a2013', 0.7, 0);
    purseFace=purse.userData.glow;
    refreshPurse();
  }
  let purseFace=null, spinners=[];
  function refreshPurse(){
    if(!purseFace || !window.WALLET) return;
    if(purseFace.material.map) purseFace.material.map.dispose();
    purseFace.material.map=panelTex('◆',
      WALLET.coins()+' ◆\n'+t('LV {n}',{n:WALLET.level?WALLET.level():1}), '#2a2013');
    purseFace.material.needsUpdate=true;
  }
  let showLoader=null;
  function loadCar(c, g, x, z){
    if(!c.file) return;
    showLoader = showLoader || new THREE.GLTFLoader();
    showLoader.load(c.file, gl=>{
      if(!on) return;
      const root=gl.scene;
      const box=new THREE.Box3().setFromObject(root);
      const len=Math.max(0.001, box.max.z-box.min.z);
      root.scale.setScalar(4.4/len);
      root.position.set(x, 0.1, z);
      root.rotation.y=Math.PI/2;               // side on to whoever walks past
      g.add(root);
    }, undefined, ()=>{});
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
      const id = (AVATAR.chosen==='h') ? 'q' : 'h';
      AVATAR.load(id).then(root=>{
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

  function walk(dt){
    if(!on || !me.dir) return;
    const up=me.dir.clone().normalize();

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
    const running=!!(G.keys.ShiftLeft||G.keys.ShiftRight);
    const spd=(running?11:6.5)*(ride?RIDE_SPEED:1);

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
    // indoors the ground under you is the building's floor, not the ball
    const floor=floorAt(me.dir);
    if(me.onGround && G.keys.Space){ me.vy=JUMP; me.onGround=false; }
    if(me.onGround) me.alt=floor;
    else {
      me.vy-=GRAV*dt; me.alt+=me.vy*dt;
      if(me.alt<=floor){ me.alt=floor; me.vy=0; me.onGround=true; }
    }
    place(dt, moved, running);
    if(window.GUN) GUN.update(dt, moved);
  }
  /* Put whatever you are riding under you, and take the body away — a
     character standing inside a car reads as a bug rather than a driver,
     which is the same reason the Circuit leaves them in the pits. */
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
    carLoader = carLoader || new THREE.GLTFLoader();
    carLoader.load(want.file, g=>{
      if(rideId!==want.id || !on) return;
      const root=g.scene;
      root.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
      const box=new THREE.Box3().setFromObject(root);
      const len=Math.max(0.001, box.max.z-box.min.z);
      root.scale.setScalar(3.4/len);
      const holder=new THREE.Group();
      holder.add(root);
      ride=holder; G.roomGroup.add(ride);
      if(window.AVATAR) AVATAR.detach();          // you are in it, not beside it
      keysFor();
    }, undefined, ()=>{ ride=null; rideId=null; });
  }
  const RIDE_SPEED=1.9;
  /* Get in and get out, out here, without walking to a menu to do it. R
     summons whichever car you have — the one you own if you have not chosen,
     since everybody starts with one — and R again leaves it behind. */
  /* what the keys do depends on whether you are in the car */
  function keysFor(){
    if(!window.keyHint) return;
    if(ride) keyHint(
      `<b>W</b> ${t('go')} &nbsp; <b>S</b> ${t('brake / reverse')}
       &nbsp; <b>A D</b> ${t('steer')} &nbsp; <b>${t('mouse')}</b> ${t('look around')}<br>
       <b>R</b> ${t('get out')} &nbsp; <b>E</b> ${t('go in')} &nbsp; <b>P</b> ${t('pause')}`);
    else keyHint(
      `<b>W A S D</b> ${t('walk')} &nbsp; <b>${t('mouse')}</b> ${t('look')}
       &nbsp; <b>SPACE</b> ${t('jump')}<br>
       <b>E</b> ${t('go in')} &nbsp; <b>R</b> ${t('get in the car')}
       &nbsp; <b>P</b> ${t('pause')}`);
  }
  function toggleRide(){
    if(!on || !window.SHOP) return;
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
  function place(dt, moving, running){
    const up=me.dir.clone().normalize();
    G.pos.copy(worldPos(EYE));
    if(ride){
      const f=me.fwd.clone().sub(up.clone().multiplyScalar(me.fwd.dot(up))).normalize();
      const r=new THREE.Vector3().crossVectors(up, f).normalize();
      /* Local +Z is the nose, exactly as it is for the characters — so +Z
         maps to FORWARD. Negating both axes was still a valid rotation, which
         is why nothing looked broken, but it was the one turned half a circle
         and the car drove everywhere backwards. */
      ride.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, up, f));
      ride.position.copy(worldPos(0.25));
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
    const back = ride ? CAR_BACK : CAM_BACK, lift = ride ? CAR_UP : CAM_UP;
    const head=worldPos(ride ? 1.4 : EYE);
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
    const known = id==='workshop' || id==='mall' || id==='library'
               || id==='librarian' || id==='purse' || id==='mechanic'
               || id==='launch' || id==='house' || id==='counter'
               || id.indexOf('wear:')===0
               || id.indexOf('buy:')===0
               || STATIONS.some(s=>s.id===id);
    if(!known) return;
    if(id==='workshop'){ leave(); return FREE.enter(server||{id:null,name:'Workshop'}, null); }
    // the Mall is a room you walk round, not a screen: only the counter
    // inside it opens the full list, and that is 'counter'
    if(id==='mall'){ say(t('Walk up to anyone. <b>E</b> to wear them.')); return; }
    if(id==='counter'){ leave(); return MENU.chars(); }
    /* The library does not take you anywhere — it opens over the world, so
       you can look a word up and still be standing where you were. */
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
    if(id==='house'){ leave(); return FREE.enter(server||{id:null,name:'Home'}, null); }
    if(!PROGRESS.unlocked(id)){
      say(t('\u{1F512} Finish {m} first',{m:t(MENU.labelOf(PROGRESS.needs(id)))}));
      return;
    }
    leave();
    document.querySelector('#hud').classList.remove('hidden');
    startMissionRoom(id);
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
  function connect(){
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
    const seen=new Set();
    list.forEach(p=>{
      if(window.NET && NET.me && p.id===NET.me.id) return;
      seen.add(p.id);
      let o=others.get(p.id);
      if(!o){
        const g=new THREE.Group();
        g.add(nameTag(p.display));
        crowd.add(g);
        o={ g, char:null, model:null, dir:dirOf(p.x,p.z), tdir:dirOf(p.x,p.z), yaw:p.yaw||0 };
        others.set(p.id,o);
      }
      if(p.char && o.char!==p.char){
        o.char=p.char;
        AVATAR.load(p.char).then(m=>{ if(o.model) o.g.remove(o.model); o.model=m; o.g.add(m); })
                           .catch(()=>{});
      }
      o.tdir=dirOf(p.x,p.z); o.yaw=p.yaw||0;
    });
    for(const [id,o] of others) if(!seen.has(id)){ crowd.remove(o.g); others.delete(id); }
  }
  function nameTag(name){
    const c=document.createElement('canvas'); c.width=256; c.height=64;
    const x=c.getContext('2d');
    x.fillStyle='rgba(29,23,48,.85)'; x.fillRect(0,14,256,36);
    x.fillStyle='#a8e6cf'; x.font='bold 26px "Trebuchet MS",sans-serif'; x.textAlign='center';
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

  let sent=0;
  function tick(dt){
    if(!on) return;
    tourTick(dt);
    /* Twelve times a second is plenty for a map and a coin counter, and it
       keeps a canvas redraw off the sixty-frame path. */
    const now=performance.now();
    if(now-mapAt>80){ mapAt=now; drawMap(); dash(); }
    sunAt();
    // the statues turn slowly on their plinths, the way a museum piece does
    statues.forEach(st=>{ if(st.userData.spin) st.rotation.y += st.userData.spin*dt; });
    spinners.forEach(m=>{ m.rotation.y += 0.55*dt; });
    mallTick(dt);
    flyTick(dt); beastTick(dt);
    adaTick(dt);
    const k=1-Math.pow(0.0008, Math.min(dt,0.1));
    for(const [,o] of others){
      o.dir.lerp(o.tdir,k).normalize();
      const f=frameAt(o.dir,0);
      // everyone else stands on the same hills you do
      o.g.position.copy(o.dir).multiplyScalar(PR + floorAt(o.dir));
      o.g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        f.right, f.up, f.fwd.clone().applyAxisAngle(f.up, o.yaw)));
      if(o.model) AVATAR.animate(o.model, dt, 'idle');
    }
    if(window.NET && NET.live){
      const now=performance.now();
      if(now-sent>90){
        sent=now;
        const ll=lonLat();
        NET.pos(+ll.lon.toFixed(2), +ll.lat.toFixed(2), +G.yaw.toFixed(2), AVATAR.chosen);
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
  function tourTick(dt){ if(window.COACH) COACH.tick(dt); }
  function retour(){ if(window.COACH) COACH.stop(); tour(); }

  /* -------------------------------------------------- the player dashboard
     Who you are, what you are on, what you have. It is the answer to the
     three questions a child asks first and it should not require opening a
     menu to see. */
  function dash(){
    const el=document.querySelector('#dash'); if(!el || !window.WALLET) return;
    el.classList.remove('hidden');
    const me_=AVATAR.CHARS.find(c=>c.id===AVATAR.chosen);
    const face=document.querySelector('#dFace');
    if(face && me_ && face.getAttribute('src')!==me_.preview) face.src=me_.preview;
    const nm=document.querySelector('#dName');
    if(nm) nm.textContent = me_ ? t(me_.name) : '';
    const rd=document.querySelector('#dRide');
    if(rd) rd.textContent = ride && SHOP.car() ? t('driving {n}',{n:t(SHOP.car().name)})
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
    const x=c.getContext('2d'), W=c.width, H=c.height, cx=W/2, cy=H/2, R=W/2-8;
    x.clearRect(0,0,W,H);

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
    const nm=document.querySelector('#pmapName');
    if(nm) nm.textContent = server && server.id ? t(server.name) : t('HOME PLANET');
  }

  /* ---------------------------------------------------------------- HUD */
  function hud(){
    const n=document.querySelector('#missionName');
    if(n) n.textContent = server && server.id ? t(server.name) : t('Home Planet');
    const o=document.querySelector('#objList');
    if(o) o.innerHTML=
      `<li class="cur">\u{1F680} ${t('Mission Control')} — ${t('every mission, one station each')}</li>
       <li>\u{1F527} ${t('The Workshop')} — ${t('build anything, with your class')}</li>
       <li>\u{1F642} ${t('The Mall')} — ${t('spend what you earned')}</li>
       <li>\u{1F4DA} ${t('The Library')} — ${t('look up any word')}</li>`;
    say(t('Walk into a building. <b>E</b> to go in.'));
  }

  function leave(){
    if(on && me.dir) backs[W.id]={ dir:me.dir.clone(), fwd:me.fwd.clone() };
    on=false;
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
               G.sun.target.updateMatrixWorld(); }
  }
  function stop(){ leave(); }

  return { enter, tick, walk, use, stop, leave, tour:retour, fitRide, facing, toggleRide,
           get riding(){ return !!ride; },
           STATIONS, lonLat, frameAt, dirOf,
           get BUILDINGS(){ return BUILDINGS; },
           get PR(){ return PR; },
           get world(){ return W; },
           get ao(){ return aoStats; },
           forget(){ backs={}; },
           get where(){ return me; },
           get active(){ return on; },
           get server(){ return server; } };
})();
