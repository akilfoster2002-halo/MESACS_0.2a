/* =====================================================================
   RING — the fight, as the player sees it.

   Nothing is decided here. This file draws a fight, and takes the two
   things the player is allowed to decide — close or open the distance,
   and which way to circle — and sends them off twenty times a second.

   FOUR KEYS AND NOTHING ELSE.

       W / ↑   close the distance          A / ←   circle left
       S / ↓   open it                     D / →   circle right
                        Shift  run

   There is no mouse, no pointer lock and no aiming. Your robot turns to
   face whoever it is fighting by itself. That is not a shortcut, it is
   the point: every key you take away from the driver is a decision that
   has to be written down in a block instead, and the blocks are the
   lesson. A student fighting the camera is a student not reading the
   feed.

   THE CAMERA IS A BROADCAST CAMERA. It sits behind your robot on the
   line between the two of them and looks down that line, so both of you
   are always in the picture and the distance between you — the one thing
   every sensor in the language is about — is the thing the screen is
   mostly showing.

   AGAINST ANOTHER STUDENT the server runs the fight and this draws what
   it is sent. ALONE the very same bout runs in this browser, because
   bout.js has no idea which machine it is on.

   WHAT IS PREDICTED AND WHAT IS NOT. Your own walking is applied here
   the moment you press the key, or the arena would feel like driving a
   barge over school wifi, and then eased back toward what the server
   says. Nothing else is guessed at: no punch, no block and no damage
   number appears until the server has said it happened, because a hit
   this browser invented and then took away is worse than a hit that
   arrived forty milliseconds late.

   AND THE FEED IS THE POINT. Down the left, as it happens, is your own
   code's reasoning: the event that fired, the reading it took, which way
   the test went, and what the part did about it. "Why didn't my robot
   punch?" is a question this screen has already answered.
   ===================================================================== */
window.RING = (function(){
  const $ = s => document.querySelector(s);
  const BT = ()=>window.BOUT, MC = ()=>window.MECHACODE, RB = ()=>window.ROBOTS;
  const T  = s => (window.t ? t(s) : s);
  const TP = (s,p) => (window.t ? t(s,p) : s);

  let on=false, mode=null, phase='off';        // off | waiting | fight | over
  let mySide='A', names={A:'',B:''}, specs={A:'noisyboy',B:'ambush'};
  let world=null, bots={}, fx=[];
  let snap=null;                               // the last thing the server said
  let local=null;                              // the practice fight, if there is one
  let pred=null;                               // where we think we are standing
  let sendAt=0, feed=[], over=null, shake=0, wasFP=null, acc=0;

  const OTHER = s => s==='A' ? 'B' : 'A';

  /* ------------------------------------------------------------ start */
  function start(kind, myRobot, programs){
    stop();
    on=true; mode=kind; phase='fight';
    feed=[]; over=null; snap=null; pred=null; acc=0;
    G.running=true; G.hudOwner='ring'; G.missionId='ring'; G.room=null;
    if(window.updateLeaveBtn) updateLeaveBtn();
    if(window.MENU) MENU.hideAll();
    if(window.AVATAR) AVATAR.detach();
    if(wasFP===null) wasFP=!!G.firstPerson;
    G.firstPerson=false;
    /* The blaster belongs to a person walking round a planet. There is
       nobody holding anything in here — you are outside a machine looking
       at it — so it goes away. */
    if(window.GUN) GUN.carried(false);
    ['#mapwrap','#health','#skill','#trigger','#objectives','#crosshair','#focus','#briefing']
      .forEach(s=>{ const e=$(s); if(e) e.classList.add('hidden'); });
    $('#hud').classList.remove('hidden');
    $('#ring').classList.remove('hidden');
    $('#ringFeed').classList.remove('hidden');
    $('#ringKeys').classList.remove('hidden');
    /* This room's keys are its own, and the last room's are a lie in it. */
    const keys = `<b>W A S D</b> ${T('move')} · <b>Shift</b> ${T('run')} · `+
                 `<b>${T('no aiming — it faces them by itself')}</b>`;
    if(window.keyHint) keyHint(keys);
    const esc=$('#escHint'); if(esc) esc.classList.add('hidden');
    /* The keys go in the engine's own hint bar and NOWHERE ELSE — both
       at once is the same sentence printed twice on top of itself. What
       is left here is the thing the hint bar has no room to say. */
    $('#ringKeys').innerHTML =
      T('your code does the fighting — watch the feed on the left');

    if(kind==='solo'){
      mySide='A';
      names={ A:T('YOU'), B:T('SPARRING PARTNER') };
      specs={ A:myRobot, B:otherThan(myRobot) };
      build();
      local=new (BT().Bout)({ names, robots:specs,
                              programs:{ A:programs, B:DUMMY } });
      apply(local.snapshot());
      big(T('FIGHT'), T('it hits back'));
    } else {
      mySide='A';
      names={ A:T('YOU'), B:T('…') };
      specs={ A:myRobot, B:otherThan(myRobot) };
      build();
      waiting(T('Your robot is in the ring. The fight starts when another student walks in.'));
      if(window.NET) NET.arena({ op:'queue', robot:myRobot, programs });
    }
  }
  /* The sparring partner is the one you did NOT pick, so training is
     always against the other silhouette rather than against yourself. */
  const otherThan = id => (RB().LIST.find(r=>r.id!==id) || RB().LIST[0]).id;

  /* What the sparring partner fights with: enough to punish standing
     still in front of it, little enough that a first program beats it. */
  const bk=(()=>{ let n=9000; return o=>Object.assign({id:'d'+(n++)}, o); })();
  const DUMMY={
    left_arm:[ bk({ type:'when', ev:'incoming_attack', body:[ bk({type:'block'}) ] }),
               bk({ type:'when', ev:'always', body:[
                 bk({ type:'if', sensor:'enemy_distance', op:'<', n:4,
                      body:[ bk({type:'punch'}) ] }) ] }) ],
    right_arm:[ bk({ type:'when', ev:'always', body:[
                  bk({ type:'if', sensor:'enemy_distance', op:'<', n:3,
                       body:[ bk({type:'punch'}) ] }) ] }) ],
    legs:[ bk({ type:'when', ev:'hit', body:[ bk({type:'brace'}) ] }) ]
  };

  function stop(){
    if(!on){ phase='off'; return; }
    if(mode==='pvp' && window.NET && NET.live)
      NET.arena({ op: phase==='waiting' ? 'cancel' : 'leave' });
    on=false; phase='off'; mode=null; local=null;
    fx=[]; bots={}; world=null; snap=null; over=null; pred=null;
    $('#ring').classList.add('hidden');
    ['#ringFeed','#ringKeys','#ringBig','#ringWait']
      .forEach(s=>{ const e=$(s); if(e) e.classList.add('hidden'); });
    ['#objectives','#crosshair','#briefing']
      .forEach(s=>{ const e=$(s); if(e) e.classList.remove('hidden'); });
    if(wasFP!==null){ G.firstPerson=wasFP; wasFP=null; }
    if(window.keyHint) keyHint(null);
    if(window.AVATAR) AVATAR.attach();
  }

  /* ================================================== building the room */
  function build(){
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.ceiling=null; G.ground=()=>0;
    world=G.roomGroup;
    G.scene.background=new THREE.Color(0x120e22);
    G.scene.fog=new THREE.Fog(0x120e22, 40, 140);
    G.camera.near=0.3; G.camera.far=400; G.camera.updateProjectionMatrix();
    G.camera.up.set(0,1,0);

    const R=BT().RULES.radius;
    const floor=new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1, 64),
      new THREE.MeshLambertMaterial({color:0x2b2444}));
    floor.position.y=-0.5; floor.userData.flat=true;
    floor.receiveShadow=true;
    world.add(floor);
    /* A ring of plates, so the floor has a scale you can count in — which
       is what turns "IF ENEMY DISTANCE < 5" into a distance you can see
       rather than a number you have to guess at. */
    for(let i=0;i<24;i++){
      const a=i/24*Math.PI*2;
      const p=new THREE.Mesh(new THREE.BoxGeometry(3.2,0.12,3.2),
        new THREE.MeshLambertMaterial({color: i%2?0x342b50:0x3b3059}));
      p.position.set(Math.sin(a)*(R-3), 0.02, Math.cos(a)*(R-3));
      p.rotation.y=-a; p.userData.flat=true; world.add(p);
    }
    const mid=new THREE.Mesh(new THREE.RingGeometry(R*0.18, R*0.2, 40),
      new THREE.MeshBasicMaterial({color:0x4b3f74, side:THREE.DoubleSide}));
    mid.rotation.x=-Math.PI/2; mid.position.y=0.03; mid.userData.flat=true; world.add(mid);

    const wall=new THREE.Mesh(new THREE.CylinderGeometry(R+1, R+1, 6, 64, 1, true),
      new THREE.MeshLambertMaterial({color:0x4a3f7a, side:THREE.BackSide}));
    wall.position.y=3; world.add(wall);
    for(let i=0;i<12;i++){
      const a=i/12*Math.PI*2;
      const l=new THREE.Mesh(new THREE.SphereGeometry(0.5,10,8),
        new THREE.MeshBasicMaterial({color:0x8ff0ff}));
      l.position.set(Math.sin(a)*(R+0.4), 5.4, Math.cos(a)*(R+0.4)); world.add(l);
    }
    world.add(new THREE.AmbientLight(0xb9a8ff, 0.38));
    /* Two robots are all that ever cast in here, so the shadow box can be
       tight enough for the shadows to be sharp. A shadow is what puts a
       thing ON a floor rather than in front of one. */
    const key=new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(16,34,12);
    key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);
    const sc=key.shadow.camera;
    sc.left=-R-4; sc.right=R+4; sc.top=R+4; sc.bottom=-R-4; sc.near=1; sc.far=90;
    sc.updateProjectionMatrix();
    key.shadow.bias=-0.0006; key.shadow.normalBias=0.4;
    world.add(key); world.add(key.target);
    const fill=new THREE.DirectionalLight(0x8fa8ff, 0.35);
    fill.position.set(-18,10,-14); world.add(fill);

    bots={ A:rig(RB().get(specs.A), mySide==='A'),
           B:rig(RB().get(specs.B), mySide==='B') };
    world.add(bots.A.g); world.add(bots.B.g);
    G.scene.updateMatrixWorld(true);
  }

  /* ------------------------------------------------------------- the rig
     A robot built out of its OWN row in robots.js — the proportions and
     the plate colours both. NOISY BOY is tall with long arms and AMBUSH
     is squat with short ones because those are the numbers the fight is
     using for reach, not because somebody drew them that way.

     Every joint below is driven by state the simulation already has.
     Shoulders and elbows come from what each arm is doing, hips and
     knees from how fast the thing is really crossing the floor, and the
     whole body from hitstun and from how much core is left. A destroyed
     arm hangs grey. Wrecked legs shorten the stride. A dying core
     smokes. None of that is decoration — it is the damage model, drawn.

     Boxes throughout, deliberately. The rest of this game is blocky and
     a smooth robot would look like it wandered in from another one. */
  function rig(spec, mine){
    const g=new THREE.Group();
    const R=spec.rig, S=spec.skin;
    const hull=new THREE.MeshLambertMaterial({color:new THREE.Color(S.plate),
      emissive:new THREE.Color(S.plate).multiplyScalar(0.18)});
    const dark=new THREE.MeshLambertMaterial({color:new THREE.Color(S.joint)});
    const trim=new THREE.MeshLambertMaterial({color:new THREE.Color(S.trim)
      .lerp(new THREE.Color(S.plate), 0.55)});
    const box=(w,h,d,m)=>{
      const x=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m||hull);
      x.castShadow=true; return x;
    };
    /* A pivot is a joint: an empty at the point the limb turns about,
       with the limb hung underneath it. Rotating the pivot swings
       everything below, which is the whole trick. */
    const joint=(x,y,z,parent)=>{
      const j=new THREE.Group(); j.position.set(x,y,z); (parent||g).add(j); return j;
    };

    const hipY = R.leg + 0.25;                 // where the legs meet the body
    const chestY = hipY + R.height*0.22;
    const headY = R.height - R.head;

    // ---- body
    const body=joint(0,0,0);
    const torso=box(R.shoulder*1.35, R.height*0.34, R.chest);
    torso.position.y=chestY; body.add(torso);
    const plate=box(R.shoulder*0.95, R.height*0.11, 0.3, trim);
    plate.position.set(0, chestY+R.height*0.08, R.chest*0.55); body.add(plate);
    const hipBlock=box(R.shoulder*0.95, 0.6, R.chest*0.85, dark);
    hipBlock.position.y=hipY; body.add(hipBlock);
    const neck=box(0.45,0.3,0.45,dark); neck.position.y=headY-R.head*0.7; body.add(neck);
    const head=box(R.head*2.4, R.head*1.7, R.head*2.1, trim);
    head.position.y=headY; body.add(head);
    /* The visor is the SENSOR. It goes out when the sensor does, which is
       the only warning a driver gets that their code has gone blind. */
    const visor=new THREE.Mesh(new THREE.BoxGeometry(R.head*1.6, 0.2, 0.1),
      new THREE.MeshBasicMaterial({color:new THREE.Color(S.glow)}));
    visor.position.set(0, headY, R.head*1.1); body.add(visor);

    // ---- arms: shoulder → upper → elbow → forearm → fist
    const arms={};
    [['left_arm',-1],['right_arm',1]].forEach(([id,side])=>{
      const shoulder=joint(side*R.shoulder*0.72, chestY+R.height*0.09, 0, body);
      const pad=box(0.8,0.65,0.85); pad.position.y=-0.1; shoulder.add(pad);
      const upper=box(0.52, R.arm*0.52, 0.52, trim);
      upper.position.y=-R.arm*0.3; shoulder.add(upper);
      const elbow=joint(0, -R.arm*0.56, 0, shoulder);
      const fore=box(0.58, R.arm*0.46, 0.58); fore.position.y=-R.arm*0.24; elbow.add(fore);
      const fist=box(0.8,0.66,0.85,dark); fist.position.y=-R.arm*0.5; elbow.add(fist);
      /* The guard is on the ARM that is guarding, not a bubble round the
         whole robot. Which side is covered is a thing you can see and
         therefore a thing you can walk around. */
      const shield=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.6,0.14),
        new THREE.MeshBasicMaterial({color:new THREE.Color(S.glow), transparent:true,
          opacity:0.34, depthWrite:false}));
      shield.position.set(0,-R.arm*0.32,0.55); shield.visible=false; elbow.add(shield);
      const parts=[pad,upper,fore,fist];
      arms[id]={ shoulder, elbow, shield, side, gone:false, parts,
                 sPose:0.10, ePose:0.30,
                 mats:parts.map(p=>p.material) };
    });

    // ---- legs: hip → thigh → knee → shin → foot
    const legs=[];
    [-1,1].forEach(side=>{
      const hip=joint(side*R.shoulder*0.33, hipY-0.2, 0, body);
      const thigh=box(0.68, R.leg*0.5, 0.74, trim);
      thigh.position.y=-R.leg*0.26; hip.add(thigh);
      const knee=joint(0, -R.leg*0.52, 0, hip);
      const shin=box(0.6, R.leg*0.46, 0.66); shin.position.y=-R.leg*0.25; knee.add(shin);
      const foot=box(0.78,0.3,1.05,dark); foot.position.set(0,-R.leg*0.5,0.16); knee.add(foot);
      legs.push({ hip, knee, side, hPose:0, kPose:0 });
    });

    /* The ring on the floor says whose robot this is, readable from
       overhead where the bodies all look alike. */
    const ring=new THREE.Mesh(new THREE.RingGeometry(1.6,2.1,28),
      new THREE.MeshBasicMaterial({color:new THREE.Color(mine?0x8fd3ff:0xff9aa2),
        transparent:true, opacity:0.7, side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2; ring.position.y=0.05; ring.userData.flat=true; g.add(ring);

    /* Smoke for a core that is nearly gone. Made once and parked, because
       a robot that starts allocating puffs in the last ten seconds is a
       robot that stutters exactly when it matters. */
    const smoke=[];
    for(let i=0;i<7;i++){
      const puff=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5),
        new THREE.MeshBasicMaterial({color:0x6b6274, transparent:true, opacity:0}));
      puff.userData.t=i/7; body.add(puff); smoke.push(puff);
    }
    return { g, body, arms, legs, smoke, spec, chestY, headY,
             at:null, walk:0, speed:0, lean:0 };
  }

  /* ---------------------------------------------------------- posing
     Every number below comes from the snapshot. Nothing here decides
     anything about the fight; it only draws what the fight already is. */
  const ARM_POSE={
    //                shoulder  elbow        what it reads as
    idle  :{ s: 0.10, e: 0.30 },      // hanging, slightly bent
    wind  :{ s:-0.75, e: 1.55 },      // cocked back, elbow folded
    rec   :{ s:-0.45, e: 0.75 },      // coming back
    block :{ s:-1.15, e: 1.85 },      // forearm across the face
    windh :{ s:-1.25, e: 1.75 },      // a heavy winds up further
    thrown:{ s:-1.45, e: 0.06 },      // arm straight out
    dead  :{ s: 0.05, e: 0.10 }       // hanging, and not coming back
  };
  function pose(b, s, dt){
    const stopped = s.fz>0;
    const hurt    = s.st>0;
    const step = Math.min(1, dt*(stopped?2:14));

    // ---- arms
    ['left_arm','right_arm'].forEach(id=>{
      const a=b.arms[id];
      const hp = id==='left_arm' ? s.p.la : s.p.ra;
      const gone = hp<=0;
      if(gone!==a.gone){
        a.gone=gone;
        a.parts.forEach((p,i)=>{ p.material = gone
          ? (a.deadMat = a.deadMat || new THREE.MeshLambertMaterial({color:0x4a4654}))
          : a.mats[i]; });
      }
      const act=s.l[id];
      let want=ARM_POSE.idle;
      if(gone) want=ARM_POSE.dead;
      else if(act){
        if(act.a==='block') want=ARM_POSE.block;
        else if(act.ph==='wind') want = act.a==='heavy' ? ARM_POSE.windh : ARM_POSE.wind;
        else if(act.ph==='rec') want=ARM_POSE.rec;
        else want=ARM_POSE.thrown;
      }
      a.sPose += (want.s-a.sPose)*step;
      a.ePose += (want.e-a.ePose)*step;
      a.shoulder.rotation.x=a.sPose;
      a.elbow.rotation.x=a.ePose;
      a.shield.visible = !gone && !!act && act.a==='block';
    });

    // ---- legs, off how fast it is REALLY crossing the floor
    const hurtLegs = s.p.lg/b.spec.parts.legs;
    const stride = 0.55*(0.45+0.55*hurtLegs);
    if(!stopped) b.walk += b.speed*dt*1.5;
    b.legs.forEach((l,i)=>{
      const ph=b.walk + (i?Math.PI:0);
      const swing=Math.min(1, b.speed/6)*stride;
      l.hPose += (Math.sin(ph)*swing - l.hPose)*step;
      /* Wrecked legs never straighten. A limp is a reading you can take
         off the other robot from across the arena. */
      const bent=0.2+0.7*(1-hurtLegs);
      l.kPose += ((bent + Math.max(0,-Math.cos(ph))*swing*0.8) - l.kPose)*step;
      l.hip.rotation.x=l.hPose;
      l.knee.rotation.x=l.kPose;
    });

    // ---- the whole body: it sags as the core goes, and flinches when hit
    const core=s.p.co/b.spec.parts.core;
    const want = (hurt?0.26:0) + (1-core)*0.18;
    b.lean += (want-b.lean)*step;
    b.body.rotation.x=b.lean;
    b.body.position.y = -(1-core)*0.15;

    // ---- the visor goes out with the sensor
    const vis=b.body.children.find(c=>c.material && c.material.isMeshBasicMaterial);
    if(vis) vis.material.opacity = s.p.sn>0 ? 1 : 0.15,
            vis.material.transparent = s.p.sn<=0;

    // ---- smoke, once the core is under half
    const smoking = core<0.5 ? (0.5-core)*2 : 0;
    b.smoke.forEach(p=>{
      p.userData.t=(p.userData.t + dt*0.55)%1;
      const k=p.userData.t;
      p.position.set(Math.sin(k*11)*0.5, b.chestY + k*2.6, Math.cos(k*7)*0.4);
      p.material.opacity = smoking*(1-k)*0.5;
      p.scale.setScalar(0.5+k*1.6);
    });
  }

  /* ------------------------------------------------------------- input
     Two numbers and a flag. That is the entire control surface, and the
     reason there is nothing else here is the reason the blocks matter. */
  function input(){
    const k=G.keys||{};
    return {
      fwd:  (k.KeyW||k.ArrowUp   ?1:0) - (k.KeyS||k.ArrowDown ?1:0),
      side: (k.KeyD||k.ArrowRight?1:0) - (k.KeyA||k.ArrowLeft ?1:0),
      run:  !!(k.ShiftLeft||k.ShiftRight)
    };
  }

  function tick(dt){
    if(!on || !world) return;
    if(phase==='fight'){
      const i=input();
      if(mode==='solo') stepLocal(i, dt);
      else send(i, dt);
      walkLocally(i, dt);
    }
    draw(dt);
    stepFx(dt);
    camera(dt);
  }

  function send(i, dt){
    const now=performance.now();
    const hz=BT().RULES.hz;
    if(now-sendAt < 1000/hz) return;
    sendAt=now;
    if(window.NET && NET.live) NET.arena({ op:'input', i:i });
  }

  /* The practice fight, stepped here — same module, same numbers, and a
     partner that walks at you so there is something to test against. */
  function stepLocal(i, dt){
    if(!local) return;
    const hz=BT().RULES.hz;
    acc+=Math.min(dt,0.25);
    while(acc>=1/hz){
      acc-=1/hz;
      local.setInput('A', i);
      local.setInput('B', dummyInput());
      const r=local.step(1/hz);
      r.events.forEach(event);
      r.traces.A.filter(l=>l.steps.length).forEach(trace);
      apply(local.snapshot());
      if(local.over){
        finish(local.result, { A:local.stats('A'), B:local.stats('B') });
        return;
      }
    }
  }
  /* The partner walks in and keeps walking in. It does not circle,
     because a first fight should be winnable by walking backwards, and
     working out that you CAN walk backwards is the first thing a driver
     ever learns in here. */
  function dummyInput(){
    if(!local) return { fwd:0, side:0 };
    const A=local.robots.A, B=local.robots.B;
    const d=Math.hypot(A.x-B.x, A.z-B.z);
    return { fwd: d>3.4 ? 1 : 0, side:0, run:d>8 };
  }

  /* --------------------------------------------------- from the server */
  function fromServer(m){
    if(!m) return;
    if(m.op==='start'){
      phase='fight'; hideWait();
      mySide=m.you; names=m.names||names;
      specs=m.robots||specs;
      build();
      apply(m.snapshot);
      big(T('FIGHT'), names[OTHER(mySide)]);
      return;
    }
    if(!on) return;
    if(m.op==='state'){
      apply(m.s);
      (m.ev||[]).forEach(event);
      (m.tr||[]).forEach(trace);
      return;
    }
    if(m.op==='over' || m.op==='forfeit'){
      if(m.you) mySide=m.you;
      finish(m.result, m.stats||{A:{},B:{}});
      return;
    }
    if(m.op==='waiting'){ phase='waiting'; return; }
    if(m.op==='cancelled'){ leave(); return; }
    if(m.op==='rejected'){
      leave(T('The ring would not take that program.'));
      return;
    }
    if(m.op==='error'){ leave(m.message||T('The ring said no.')); return; }
  }

  function apply(s){
    if(!s) return;
    snap=s;
    /* Ease our own guess back toward the truth rather than snapping to
       it, so a late packet is a drift and not a teleport. */
    const mine=s[mySide];
    if(!pred) pred={ x:mine.x, z:mine.z };
    else {
      pred.x += (mine.x-pred.x)*0.22;
      pred.z += (mine.z-pred.z)*0.22;
    }
    hud();
  }

  /* Your own walking, applied the instant you press the key. Only the
     walking: nothing about a punch, a block or a damage number is ever
     guessed at here. */
  function walkLocally(i, dt){
    if(!snap || !pred) return;
    const me=snap[mySide], you=snap[OTHER(mySide)];
    if(me.st>0 || me.fz>0 || me.p.co<=0) return;
    const R=BT().RULES, spec=RB().get(specs[mySide]);
    const legFactor=0.45+0.55*(me.p.lg/spec.parts.legs);
    const sp=(i.run?R.run:R.walk)*legFactor*spec.speed;
    const yaw=Math.atan2(you.z-me.z, you.x-me.x);
    const fx=Math.cos(yaw), fz=Math.sin(yaw);
    const rx=Math.cos(yaw+Math.PI/2), rz=Math.sin(yaw+Math.PI/2);
    pred.x += (fx*i.fwd + rx*i.side)*sp*dt;
    pred.z += (fz*i.fwd + rz*i.side)*sp*dt;
    const d=Math.hypot(pred.x,pred.z), lim=R.radius-R.bodyR;
    if(d>lim){ pred.x*=lim/d; pred.z*=lim/d; }
  }

  function draw(dt){
    if(!snap) return;
    ['A','B'].forEach(side=>{
      const b=bots[side], s=snap[side]; if(!b||!s) return;
      const mine=side===mySide;
      const x = mine&&pred ? pred.x : s.x, z = mine&&pred ? pred.z : s.z;
      if(!b.at){ b.g.position.set(x,0,z); b.at=true; }
      else {
        const k=Math.min(1, dt*(mine?24:14));
        b.g.position.x += (x-b.g.position.x)*k;
        b.g.position.z += (z-b.g.position.z)*k;
      }
      /* How fast it is really crossing the floor, smoothed — the legs are
         driven by this rather than by the keys, so a robot being thrown
         backwards runs its legs backwards too. */
      const moved=Math.hypot(b.g.position.x-(b.wasX||b.g.position.x),
                             b.g.position.z-(b.wasZ||b.g.position.z));
      b.wasX=b.g.position.x; b.wasZ=b.g.position.z;
      const v=moved/Math.max(dt,0.001);
      b.speed=(b.speed||0)+(v-(b.speed||0))*Math.min(1,dt*9);

      let d=s.yaw-b.g.rotation.y;
      d=Math.atan2(Math.sin(d),Math.cos(d));
      b.g.rotation.y += d*Math.min(1, dt*16);

      pose(b, s, dt);
      b.g.scale.setScalar(s.p.co<=0 ? 0.9 : 1);
    });
  }

  /* ------------------------------------------------------- the camera
     Behind your robot, on the line between the two of you, looking down
     it. No mouse touches this, so it can never be pointing the wrong way
     — and the distance between the two robots, which every sensor in the
     language is about, is what the screen is mostly showing. */
  function camera(dt){
    if(!snap) return;
    const me=bots[mySide], you=bots[OTHER(mySide)];
    if(!me||!you) return;
    const p=me.g.position, q=you.g.position;
    const mx=(p.x+q.x)/2, mz=(p.z+q.z)/2;
    const d=Math.hypot(q.x-p.x, q.z-p.z)||1;
    /* OFF THE AXIS, NOT ON IT. A camera parked straight behind your own
       robot puts your own robot squarely between the lens and the only
       other thing in the arena — at punching range the fight happens
       entirely behind your own shoulders. So it swings a third of a
       right angle off the line between the two of you and frames the
       MIDDLE of them: your robot is one side of the picture, theirs is
       the other, and the gap between them — which is what every sensor
       in the language is about — is the thing in the centre. */
    const ang=Math.atan2(q.z-p.z, q.x-p.x) + 0.62;
    const back=11+Math.min(10, d*0.55), up=7.0+d*0.16;
    G.camera.position.set(mx - Math.cos(ang)*back, up, mz - Math.sin(ang)*back);
    /* THE FLINCH. Hitstop stops the world for a moment; this is what
       makes that stop read as an impact rather than a dropped frame. */
    if(shake>0){
      const now=performance.now();
      G.camera.position.x += Math.sin(now*0.09)*shake;
      G.camera.position.y += Math.cos(now*0.13)*shake*0.7;
      shake=Math.max(0, shake-(dt||0.016)*4.5);
    }
    G.camera.up.set(0,1,0);
    G.camera.lookAt(mx, 2.4, mz);
  }

  /* ------------------------------------------------------------ events */
  function event(e){
    if(e.kind==='hit'){
      hitFx({x:e.x, y:2.4, z:e.z}, e.dmg, e.note);
      shake=Math.min(0.9, (e.stop||0.1)*3 + e.dmg*0.012);
      return;
    }
    if(e.kind==='over' && mode!=='solo'){ /* the server sends the summary */ }
  }

  /* ------------------------------------------------- the feed, in words
     One line per part per decision, said the way the block says it, so
     what is on the screen and what is in the editor are the same words. */
  function trace(l){
    if(!l || !l.steps || !l.steps.length) return;
    const part=(MC().partById(l.part)||{label:l.part}).label;
    l.steps.forEach(s=>{
      const cls = s.kind==='event' ? 'ev' : s.kind==='test' ? 'test'
                : s.kind==='action' ? 'act' : 'stall';
      line(cls, part, MC().say(s));
    });
  }
  function line(cls, part, text){
    if(!text) return;
    feed.push({cls, part, text});
    if(feed.length>14) feed.shift();
    const host=$('#ringFeed'); if(!host) return;
    host.innerHTML=feed.map(f=>
      `<div class="ring-line ${f.cls}"><span class="ring-part">${f.part}</span>${f.text}</div>`
    ).join('');
  }

  /* ---------------------------------------------------------- the HUD */
  function hud(){
    if(!snap) return;
    const PARTS=[['la','LEFT ARM','left_arm'],['ra','RIGHT ARM','right_arm'],
                 ['lg','LEGS','legs'],['sn','SENSOR','sensor'],['co','CORE','core']];
    ['A','B'].forEach(side=>{
      const el=$(side==='A'?'#ringA':'#ringB'); if(!el) return;
      const s=snap[side], spec=RB().get(specs[side]||s.r);
      const rows=PARTS.map(([k,label,id])=>{
        const pc=Math.max(0, Math.round(s.p[k]/spec.parts[id]*100));
        const cls=(id==='core'?'core ':'')+(pc<=0?'gone':pc<34?'low':'');
        return `<div class="ring-p ${cls}"><span>${T(label)}</span>
                  <i><b style="width:${pc}%"></b></i></div>`;
      }).join('');
      const e=Math.round(s.e);
      el.innerHTML=`<div class="ring-name">
          <b>${names[side]||side}</b>
          <small>${spec.name} · ${e}⚡</small>
        </div><div class="ring-parts">${rows}</div>`;
    });
    const c=$('#ringClock');
    if(c) c.innerHTML=Math.ceil(snap.clock)+`<small>${T('SECONDS')}</small>`;
  }

  /* --------------------------------------------------------- the extras */
  function hitFx(pos, dmg, note){
    if(!world) return;
    const colour = note==='blocked' ? 0x8fd3ff : note==='behind' ? 0xffd8a8 : 0xff9aa2;
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.6,0.6),
      new THREE.MeshBasicMaterial({color:colour, transparent:true, opacity:0.95}));
    m.position.set(pos.x, pos.y, pos.z);
    world.add(m);
    fx.push({ m, t:0, life:0.45, up:1.6+dmg*0.03 });
  }
  function stepFx(dt){
    for(let i=fx.length-1;i>=0;i--){
      const f=fx[i]; f.t+=dt;
      const k=f.t/f.life;
      f.m.position.y += f.up*dt;
      f.m.material.opacity=Math.max(0, 0.95*(1-k));
      f.m.scale.setScalar(1+k*2.2);
      if(f.t>=f.life){ world.remove(f.m); fx.splice(i,1); }
    }
  }
  function big(text, sub){
    const el=$('#ringBig'); if(!el) return;
    el.innerHTML=text+(sub?`<small>${sub}</small>`:'');
    el.classList.remove('hidden');
    setTimeout(()=>{ const e=$('#ringBig'); if(e) e.classList.add('hidden'); }, 1600);
  }
  function waiting(text){
    phase='waiting';
    const el=$('#ringWait'); if(!el) return;
    el.innerHTML=text+`<br><br><button class="btn ghost small" id="ringCancel">${T('◀ BACK TO THE PIT')}</button>`;
    el.classList.remove('hidden');
    el.style.pointerEvents='auto';
    const b=$('#ringCancel'); if(b) b.onclick=()=>leave();
  }
  function hideWait(){ const e=$('#ringWait'); if(e) e.classList.add('hidden'); }

  function leave(msg){
    stop();
    if(window.PIT) PIT.show({ onFight:start });
    if(msg && window.say) say(msg);
  }

  /* ------------------------------------------------------- the results
     Numbers, and then one sentence about what to change. A scoreboard a
     student cannot act on is a scoreboard that teaches nothing. */
  function finish(result, stats){
    phase='over'; over={result, stats};
    hideWait();
    const mine=stats[mySide]||{}, theirs=stats[OTHER(mySide)]||{};
    const won = result && result.winner===mySide;
    const acc = mine.punches ? Math.round(mine.landed/mine.punches*100) : 0;
    const waste = mine.spent ? Math.round((mine.wasted||0)/mine.spent*100) : 0;
    const row=(k,v)=>`<div><b>${v}</b><span>${T(k)}</span></div>`;
    const advice =
      !mine.punches ? T('Your arms never swung once. Nothing in them ever reached an action — check what the WHEN is waiting for.')
      : acc<25      ? TP('You threw {n} and landed {l}. Test the distance before you swing, or you are paying energy for air.',{n:mine.punches,l:mine.landed})
      : (mine.stalls||0)>20 ? TP('Your parts were told to act {n} times with nothing to pay for it. Spend less, or spend it on fewer things.',{n:mine.stalls})
      : (theirs.blocked||0) > (theirs.taken||0)/4 ? T('They blocked most of what you threw. A heavy punch goes through a guard.')
      : (mine.dodges||0)===0 && (mine.taken||0)>60 ? T('You never dodged once. WHEN ATTACKED is the event, and the legs are where a dodge comes from.')
      : won ? T('It worked. Now think about what it would lose to.')
            : T('Read the feed back: the last thing your code did before the core went is usually the thing to change.');
    const show = window.showResults;
    if(!show){ leave(); return; }
    show({
      title: !result ? T('THE FIGHT IS OVER')
           : result.winner==='draw' ? T('A DRAW')
           : won ? T('YOU WIN') : T('YOU ARE DOWN'),
      body: `<p>${result?T(result.text):''}</p><p style="color:var(--star)">${advice}</p>`,
      stats: row('punches thrown', mine.punches||0) + row('punches landed', mine.landed||0)
           + row('accuracy', acc+'%') + row('blocks put up', mine.blocks||0)
           + row('dodges', mine.dodges||0) + row('energy wasted', waste+'%')
           + row('damage dealt', mine.dealt||0) + row('damage taken', mine.taken||0),
      btnText: T('BACK TO THE PIT ▶'),
      onBtn: ()=>{ const d=$('#done'); if(d) d.classList.add('hidden'); leave(); }
    });
  }

  if(window.NET) NET.onArena = fromServer;

  return { start, stop, tick, net:fromServer, leave, DUMMY,
           get active(){ return on; },
           get phase(){ return phase; } };
})();
