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
  const PR  = 320;                 // the radius of the world
  const SKY = 0x070a1a;
  const V   = (x,y,z)=>new THREE.Vector3(x,y,z);

  /* Placed in degrees, because "72 degrees round and 6 down" is something
     you can reason about and a raw vector is not. */
  const BUILDINGS=[
    { id:'missions', name:'MISSION CONTROL', em:'\u{1F680}', lon:0,   lat:7,  w:64, d:46, h:18, door:10,
      wall:0x3a4f8c, roof:0x8fd3ff, blurb:'Every mission, one station each' },
    { id:'workshop', name:'THE WORKSHOP',    em:'\u{1F527}', lon:-19, lat:-6, w:24, d:20, h:11,
      wall:0x4a3f7a, roof:0xcdb4f6, blurb:'Build anything, with your class' },
    { id:'wardrobe', name:'THE WARDROBE',    em:'\u{1F642}', lon:19,  lat:-6, w:22, d:18, h:11,
      wall:0x6b4a5e, roof:0xffb4a2, blurb:'Change who you are, and spend what you earned' },
    { id:'library',  name:'THE LIBRARY',     em:'\u{1F4DA}', lon:0,   lat:-21, w:26, d:20, h:11,
      wall:0x4d6b4a, roof:0xa8e6cf, blurb:'Look up any word in the language' }
  ];
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
  /* You, as the planet sees you. G.pos is derived from this, never the
     other way round. */
  let me={ dir:null, fwd:null, alt:0, vy:0, onGround:true,
           spd:0,        // how fast the car is going, along its own nose
           look:0 };     // where you are looking, which is not where it is going
  let lastYaw=0, back=null;

  const worldPos = extra => me.dir.clone().multiplyScalar(PR + me.alt + (extra||0));

  /* ---------------------------------------------------------------- build */
  function enter(sv){
    server = sv || null;
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
    statues=[];
    G.room='planet'; G.hudOwner='planet'; G.missionId=null; G.running=true;
    G.scene.background=new THREE.Color(SKY);
    // fog would eat the far side of the world, and the far side is the point
    G.scene.fog=null;
    on=true;

    sky(); surface();
    BUILDINGS.forEach(build);
    scatter();                     // after the buildings: it works around them
    crowd=new THREE.Group(); G.roomGroup.add(crowd);

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
    G.roomGroup.add(new THREE.Points(g, new THREE.PointsMaterial({
      color:0xdfe8ff, size:1.8, sizeAttenuation:true })));
    const neighbour=new THREE.Mesh(new THREE.SphereGeometry(150,32,24),
      new THREE.MeshLambertMaterial({color:0x7c5cc4}));
    neighbour.position.set(-520,180,-620); G.roomGroup.add(neighbour);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(230,9,10,48),
      new THREE.MeshBasicMaterial({color:0xcdb4f6, transparent:true, opacity:.42}));
    ring.position.copy(neighbour.position); ring.rotation.set(1.15,0.3,0.2);
    G.roomGroup.add(ring);
    const sun=new THREE.Mesh(new THREE.SphereGeometry(34,20,16),
      new THREE.MeshBasicMaterial({color:0xfff3d0}));
    sun.position.set(420,300,-420); G.roomGroup.add(sun);
  }
  function surface(){
    G.roomGroup.add(new THREE.Mesh(new THREE.SphereGeometry(PR, 96, 64),
      new THREE.MeshLambertMaterial({ color:0x6fae7a })));
    // a pale cap at each pole, so you can tell you have been somewhere
    [1,-1].forEach(s=>{
      const c=new THREE.Mesh(
        new THREE.SphereGeometry(PR+0.15, 48, 24, 0, Math.PI*2, 0, 0.36),
        new THREE.MeshLambertMaterial({ color:0xdfeef0 }));
      if(s<0) c.rotation.x=Math.PI;
      G.roomGroup.add(c);
    });
  }
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
    m.position.y=-0.02;                // under the rug, not fighting it for pixels
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
    return 0;
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
    for(let i=0;i<820;i++){
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
      stand(g, dir, Math.random()*6);
      G.roomGroup.add(g);
    }
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
    let line='', y=182;
    String(label).split(' ').forEach(w=>{
      if(x.measureText(line+' '+w).width>224 && line){ x.fillText(line,128,y); y+=29; line=w; }
      else line = line ? line+' '+w : w;
    });
    x.fillText(line,128,y);
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
    g.add(plate(b));

    put(0,-hd, b.w, 1);
    put(-hw,0, 1, b.d);
    put( hw,0, 1, b.d);
    const gap=9, side=(b.w-gap)/2;
    put(-(gap/2+side/2), hd, side, 1);
    put( (gap/2+side/2), hd, side, 1);
    put(0, hd, gap, 1, H-DOOR, DOOR);        // lintel, above head height

    const roof=new THREE.Mesh(new THREE.BoxGeometry(b.w+2.4, 0.8, b.d+2.4),
      new THREE.MeshLambertMaterial({color:b.roof}));
    roof.position.y=H+0.4; g.add(roof);

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
    } else panel(g,b, 0, -hd+3.2, b.em, t(b.blurb), b.id, '#22406b', 0.85, 0);
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

    // a runner of floor leading in, so the hall has a middle
    const rug=add(new THREE.Mesh(new THREE.BoxGeometry(b.w*0.26, 0.12, b.d-3),
      new THREE.MeshLambertMaterial({color:0x6b4a8f})), 0, 0.07, 0);
    rug.receiveShadow=false;

    /* Braziers down the hall. A room this tall goes flat without something
       bright in it, and a real light each is worth the cost in a room you
       stand still in. */
    [[-hw+4, -hd+8],[hw-4, -hd+8],[-hw+4, hd-10],[hw-4, hd-10]].forEach(([bx,bz])=>{
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.9,4.5,8), stone), bx, 2.25, bz);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.85,12,10),
        new THREE.MeshBasicMaterial({color:0xffd9a0})), bx, 4.9, bz);
      const lamp=new THREE.PointLight(0xffd9a0, 0.85, 34);
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
    if(!c){ say(t('No car yet. The Wardrobe sells them.')); return; }
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
    const known = id==='workshop' || id==='wardrobe' || id==='library'
               || STATIONS.some(s=>s.id===id);
    if(!known) return;
    if(id==='workshop'){ leave(); return FREE.enter(server||{id:null,name:'Workshop'}, null); }
    if(id==='wardrobe'){ leave(); return MENU.chars(); }
    /* The library does not take you anywhere — it opens over the world, so
       you can look a word up and still be standing where you were. */
    if(id==='library'){ if(window.LIBRARY) LIBRARY.open(); return; }
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
    // the statues turn slowly on their plinths, the way a museum piece does
    statues.forEach(st=>{ if(st.userData.spin) st.rotation.y += st.userData.spin*dt; });
    const k=1-Math.pow(0.0008, Math.min(dt,0.1));
    for(const [,o] of others){
      o.dir.lerp(o.tdir,k).normalize();
      const f=frameAt(o.dir,0);
      o.g.position.copy(o.dir).multiplyScalar(PR);
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
    const firstStation=()=>{ const b=MC();
      return b.g ? b.g.localToWorld(V(-(b.w-9)/2, 2.5, -b.d/2+3.2)) : V(0,0,0); };
    COACH.start([
      /* One line each. A child reading six sentences is a child not playing,
         and every one of these is about a key they can press right now. */
      { say:'Hold <b>W</b> to walk.',
        done:()=>me.dir.angleTo(start)*PR > 9 },
      { say:'Mouse to look. <b>A</b> and <b>D</b> to step sideways.',
        done:()=>Math.abs(((G.yaw-yaw0+Math.PI*3)%(Math.PI*2))-Math.PI) > 0.5 },
      { say:'Walk to the ringed door.',
        at:()=>withSize(doorPoint(MC()),3.5),
        done:()=>metresTo(doorPoint(MC())) < 14 },
      { say:'Go inside.',
        at:()=>withSize(doorPoint(MC()),3.5),
        done:()=>insideOf(MC()) },
      { say:'Look at a mission station.',
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
       <li>\u{1F642} ${t('The Wardrobe')} — ${t('spend what you earned')}</li>
       <li>\u{1F4DA} ${t('The Library')} — ${t('look up any word')}</li>`;
    say(t('Walk into a building. <b>E</b> to go in.'));
  }

  function leave(){
    if(on && me.dir) back={ dir:me.dir.clone(), fwd:me.fwd.clone() };
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
  }
  function stop(){ leave(); }

  return { enter, tick, walk, use, stop, leave, tour:retour, fitRide, facing, toggleRide,
           get riding(){ return !!ride; },
           STATIONS, BUILDINGS, PR, lonLat, frameAt, dirOf,
           forget(){ back=null; },
           get where(){ return me; },
           get active(){ return on; },
           get server(){ return server; } };
})();
