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
  const PR  = 200;                 // the radius of the world
  const SKY = 0x070a1a;
  const V   = (x,y,z)=>new THREE.Vector3(x,y,z);

  /* Placed in degrees, because "72 degrees round and 6 down" is something
     you can reason about and a raw vector is not. */
  const BUILDINGS=[
    { id:'missions', name:'MISSION CONTROL', em:'\u{1F680}', lon:0,   lat:6,  w:34, d:22,
      wall:0x3a4f8c, roof:0x8fd3ff, blurb:'Every mission, one station each' },
    { id:'workshop', name:'THE WORKSHOP',    em:'\u{1F527}', lon:-15, lat:-5, w:20, d:18,
      wall:0x4a3f7a, roof:0xcdb4f6, blurb:'Build anything, with your class' },
    { id:'wardrobe', name:'THE WARDROBE',    em:'\u{1F642}', lon:15,  lat:-5, w:18, d:16,
      wall:0x6b4a5e, roof:0xffb4a2, blurb:'Change who you are, and spend what you earned' },
    { id:'library',  name:'THE LIBRARY',     em:'\u{1F4DA}', lon:0,   lat:-17, w:22, d:18,
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
  const LANDING_OFF=48;
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
    me.alt=0; me.vy=0; me.onGround=true; me.spd=0; me.look=0;
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
    hud();
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

    const hw=b.w/2, hd=b.d/2, H=9, DOOR=6;
    const wall=new THREE.MeshLambertMaterial({color:b.wall});
    // local: +x right, +y up off the surface, +z the way it faces
    const put=(x,z,w,d,h,up0)=>{
      const hh=h||H, base=up0||0;
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,hh,d), wall);
      m.position.set(x, base+hh/2, z); g.add(m);
      b.solids.push({x1:x-w/2, x2:x+w/2, z1:z-d/2, z2:z+d/2, y1:base, y2:base+hh});
    };
    const floor=new THREE.Mesh(new THREE.BoxGeometry(b.w+4, 1, b.d+4),
      new THREE.MeshLambertMaterial({color:0x8b8f9e}));
    floor.position.y=-0.5; g.add(floor);

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

    const W=b.w*0.9, HH=W*(96/512);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(W,HH),
      new THREE.MeshBasicMaterial({map:signTexture(b.em+'  '+t(b.name), b.roof),
                                   transparent:true, side:THREE.DoubleSide}));
    sign.position.set(0, H+1.2+HH/2, hd+0.25); g.add(sign);

    if(b.id==='missions'){
      const span=b.w-9, stepX=STATIONS.length>1 ? span/(STATIONS.length-1) : 0;
      STATIONS.forEach((s,i)=>
        panel(g,b, -span/2+i*stepX, -hd+3.2, s.em, t(s.name), s.id, '#1b2740', 0.62));
    } else panel(g,b, 0, -hd+3.2, b.em, t(b.blurb), b.id, '#22406b', 0.85);
  }
  function panel(g, b, x, z, emoji, label, opens, bg, scale){
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
    g.add(p);
    p.userData={ kind: opens===b.id ? 'door' : 'station', label, enter:opens, glow:face };
    body.userData.owner=p; face.userData.owner=p;
    G.hits.push(body, face);
    const w=4.6*(scale||1), d=1.6*(scale||1);
    b.solids.push({x1:x-w/2, x2:x+w/2, z1:z-d/2, z2:z+d/2, y1:0, y2:5.8*(scale||1)});
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
    if(me.onGround && G.keys.Space){ me.vy=JUMP; me.onGround=false; }
    if(!me.onGround){
      me.vy-=GRAV*dt; me.alt+=me.vy*dt;
      if(me.alt<=0){ me.alt=0; me.vy=0; me.onGround=true; }
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
