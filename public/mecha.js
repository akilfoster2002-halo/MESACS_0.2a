/* =====================================================================
   MECHA — the live arena, as the player sees it.

   Everything decided anywhere else. This file draws a fight and takes
   the two things the player is allowed to decide — where to stand and
   which way to look — and sends them off twenty times a second.

   AGAINST ANOTHER STUDENT the server runs the match and this draws what
   it is sent. AGAINST THE DUMMY the very same simulation runs in this
   browser instead, because mechaarena.js has no idea which machine it is
   on. Practice and a real bout are the same fight with the referee
   standing somewhere else, so a student cannot practise against rules
   that turn out not to be the real ones.

   WHAT IS PREDICTED AND WHAT IS NOT. Your own walking is applied here
   the moment you press the key, or the arena would feel like driving a
   barge over a school wifi connection, and then eased back toward what
   the server says. Nothing else is guessed at: no punch, no block, no
   damage number appears until the server has said it happened, because a
   hit this browser invented and then took away is worse than a hit that
   arrived forty milliseconds late.

   AND THE FEED IS THE POINT. Down the left, as it happens, is your own
   code's reasoning: the event, the reading, which way the test went, and
   what the part did about it. A student who cannot work out why their
   mecha is standing still is a student who has not looked at it yet.
   ===================================================================== */
window.MECHA = (function(){
  const $ = s => document.querySelector(s);
  const MC = ()=>window.MECHACODE, AR = ()=>window.MECHAARENA;

  const SIDE_ME='#8fd3ff', SIDE_YOU='#ff9aa2';
  let on=false, mode=null, phase='off';       // off | waiting | fight | over
  let mySide='A', names={A:'',B:''}, rules=null;
  let world=null, bots={}, fx=[];
  let snap=null;                              // the last thing the server said
  let local=null;                             // the practice match, if there is one
  let pred=null;                              // where we think we are standing
  let sendAt=0, feed=[], over=null, shake=0;
  let wasFP=null;

  /* ------------------------------------------------------------ start */
  function start(kind, programs){
    stop();
    on=true; mode=kind; phase='fight';
    feed=[]; over=null; snap=null; pred=null;
    G.running=true; G.hudOwner='mecha'; G.missionId='mecha'; G.room=null;
    if(window.updateLeaveBtn) updateLeaveBtn();
    if(window.MENU) MENU.hideAll();
    if(window.AVATAR) AVATAR.detach();
    if(wasFP===null) wasFP=!!G.firstPerson;
    G.firstPerson=false;
    /* The blaster belongs to a person walking around a planet. There is
       nobody holding anything in here — you are outside a machine looking
       at it — so it goes away the way the flight deck puts it away. */
    if(window.GUN) GUN.update(0,false);
    ['#mapwrap','#health','#skill','#trigger','#objectives','#crosshair','#focus','#briefing']
      .forEach(s=>{ const e=$(s); if(e) e.classList.add('hidden'); });
    $('#hud').classList.remove('hidden');
    $('#ma').classList.remove('hidden');
    $('#maFeed').classList.remove('hidden');
    $('#maKeys').classList.remove('hidden');
    /* This room's keys are its own, and the last room's are a lie in it:
       walking out of the planet used to leave "E go in · R get in the car"
       sitting under an arena with no doors and no cars. */
    if(window.keyHint) keyHint(
      `<b>W A S D</b> ${t('walk')} &nbsp; <b>${t('mouse')}</b> ${t('turn')}
       &nbsp; <b>Shift</b> ${t('run')}`);
    const esc=$('#escHint'); if(esc) esc.classList.add('hidden');
    $('#maKeys').innerHTML=
      `<b>W A S D</b> ${t('walk')} · <b>${t('mouse')}</b> ${t('turn')} · <b>Shift</b> ${t('run')}<br>
       ${t('your code does the fighting — watch the feed on the left')}`;
    build();

    if(kind==='solo'){
      mySide='A'; names={ A:t('YOU'), B:t('TRAINING DUMMY') };
      rules=AR().RULES;
      local=new (AR().Match)({ names, programs:{ A:programs, B:DUMMY } });
      hud(); big(t('ROUND 1'), t('the dummy hits back'));
    } else {
      mySide='A'; names={ A:t('YOU'), B:t('…') };
      rules=AR().RULES;
      waiting(t('Your mecha is in the arena. The fight starts when another student walks in.'));
      NET.mecha({ op:'queue', programs });
    }
    lockPointer($('#view'));
  }

  /* what the training dummy fights with: enough to punish standing still
     in front of it, little enough that a first program can beat it */
  const bk=(()=>{ let n=9000; return (o)=>Object.assign({id:n++},o); })();
  const DUMMY={
    left_arm:[ bk({ type:'when', ev:'incoming_attack', body:[ bk({type:'block'}) ] }),
               bk({ type:'when', ev:'always', body:[
                 bk({ type:'if', sensor:'enemy_distance', op:'<', n:4,
                      body:[ bk({type:'punch'}) ] }) ] }) ],
    right_arm:[ bk({ type:'when', ev:'always', body:[
                  bk({ type:'if', sensor:'enemy_distance', op:'<', n:3,
                       body:[ bk({type:'punch'}) ] }) ] }) ],
    legs:[]
  };

  function stop(){
    if(!on){ phase='off'; return; }
    if(mode==='pvp' && window.NET && NET.live)
      NET.mecha({ op: phase==='waiting' ? 'cancel' : 'leave' });
    on=false; phase='off'; mode=null; local=null;
    fx=[]; bots={}; world=null; snap=null; over=null;
    $('#ma').classList.add('hidden');
    ['#maFeed','#maKeys','#maSay','#maBig','#maWait'].forEach(s=>$(s).classList.add('hidden'));
    ['#objectives','#crosshair','#briefing'].forEach(s=>{ const e=$(s); if(e) e.classList.remove('hidden'); });
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

    const R=AR().RULES.radius;
    const floor=new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1, 64),
      new THREE.MeshLambertMaterial({color:0x2b2444}));
    floor.position.y=-0.5; floor.userData.flat=true;
    floor.receiveShadow=true;                 // what the mechas stand on
    world.add(floor);
    // a ring of plates, so the floor has a scale you can count in
    for(let i=0;i<24;i++){
      const a=i/24*Math.PI*2;
      const p=new THREE.Mesh(new THREE.BoxGeometry(3.4,0.12,3.4),
        new THREE.MeshLambertMaterial({color: i%2?0x342b50:0x3b3059}));
      p.position.set(Math.sin(a)*(R-3), 0.02, Math.cos(a)*(R-3));
      p.rotation.y=-a; p.userData.flat=true; world.add(p);
    }
    const mid=new THREE.Mesh(new THREE.RingGeometry(R*0.18, R*0.2, 40),
      new THREE.MeshBasicMaterial({color:0x4b3f74, side:THREE.DoubleSide}));
    mid.rotation.x=-Math.PI/2; mid.position.y=0.03; mid.userData.flat=true; world.add(mid);

    // the wall, and lamps on it
    const wall=new THREE.Mesh(new THREE.CylinderGeometry(R+1, R+1, 6, 64, 1, true),
      new THREE.MeshLambertMaterial({color:0x4a3f7a, side:THREE.BackSide}));
    wall.position.y=3; world.add(wall);
    for(let i=0;i<10;i++){
      const a=i/10*Math.PI*2;
      const l=new THREE.Mesh(new THREE.SphereGeometry(0.5,10,8),
        new THREE.MeshBasicMaterial({color:0x8ff0ff}));
      l.position.set(Math.sin(a)*(R+0.4), 5.4, Math.cos(a)*(R+0.4)); world.add(l);
    }
    world.add(new THREE.AmbientLight(0xb9a8ff, 0.38));
    /* A shadow is what puts a thing ON a floor rather than in front of
       one. The box only has to cover the arena, so it can be tight enough
       for the shadows to be sharp — and this is the one room in the game
       where two objects are all that ever cast. */
    const key=new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(16,34,12);
    key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);
    const sc=key.shadow.camera;
    sc.left=-R-4; sc.right=R+4; sc.top=R+4; sc.bottom=-R-4; sc.near=1; sc.far=90;
    sc.updateProjectionMatrix();
    key.shadow.bias=-0.0006; key.shadow.normalBias=0.4;
    world.add(key); world.add(key.target);
    /* And a cold one from the other side, so the shadowed half of a mecha
       is still a colour rather than a hole. */
    const fill=new THREE.DirectionalLight(0x8fa8ff, 0.35);
    fill.position.set(-18,10,-14); world.add(fill);

    bots={ A:mech(mySide==='A'?SIDE_ME:SIDE_YOU), B:mech(mySide==='B'?SIDE_ME:SIDE_YOU) };
    world.add(bots.A.g); world.add(bots.B.g);
    G.scene.updateMatrixWorld(true);
  }

  /* A mecha, out of boxes, with shoulders that actually turn — the punch
     you see is the punch the simulation is running, read off its state. */
  /* A MECHA WITH JOINTS, because everything the simulation knows about it
     should be visible on it.

     The old one was a torso, two legs that never moved and an arm on a
     shoulder pivot. It could show you a punch and nothing else — so a
     student whose left arm had been destroyed, whose legs were wrecked,
     who was mid-block or being thrown across the floor saw the same box
     either way, and had to read all of it off a bar chart.

     Every joint here is driven by state that already exists: shoulders
     and elbows from what each arm is doing, hips and knees from how fast
     the thing is actually travelling, the whole body from hitstun and
     from how much core is left. A destroyed arm hangs and stops being
     part of the fight. Wrecked legs limp. A dying core smokes. None of
     that is decoration — it is the damage model, drawn.

     Boxes throughout, deliberately. This game is Kenney-blocky
     everywhere else, and a smooth mecha would look like it wandered in
     from another game. */
  function mech(colour){
    const g=new THREE.Group();
    const hull=new THREE.MeshLambertMaterial({color:new THREE.Color(colour),
      emissive:new THREE.Color(colour).multiplyScalar(0.20)});
    const dark=new THREE.MeshLambertMaterial({color:0x2a2440});
    const trim=new THREE.MeshLambertMaterial({color:0x4a4370});
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

    // ---- body
    const body=joint(0,0,0);                 // leans and recoils as one piece
    const torso=box(2.1,1.9,1.35); torso.position.y=2.75; body.add(torso);
    const chest=box(1.5,0.6,0.35,trim); chest.position.set(0,3.2,0.72); body.add(chest);
    const vent=box(1.7,0.18,0.2,dark); vent.position.set(0,2.15,0.7); body.add(vent);
    const hipBlock=box(1.5,0.65,1.15,dark); hipBlock.position.y=1.75; body.add(hipBlock);
    const neck=box(0.5,0.3,0.5,dark); neck.position.y=3.8; body.add(neck);
    const head=box(1.05,0.75,0.95,trim); head.position.y=4.2; body.add(head);
    const visor=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.2,0.1),
      new THREE.MeshBasicMaterial({color:0x8ff0ff}));
    visor.position.set(0,4.24,0.5); body.add(visor);

    // ---- arms: shoulder → upper → elbow → forearm → fist
    const arms={};
    [['left_arm',-1],['right_arm',1]].forEach(([id,side])=>{
      const shoulder=joint(side*1.35, 3.35, 0, body);
      const pad=box(0.85,0.7,0.9); pad.position.y=-0.1; shoulder.add(pad);
      const upper=box(0.55,1.15,0.55,trim); upper.position.y=-0.85; shoulder.add(upper);
      const elbow=joint(0,-1.4,0, shoulder);
      const fore=box(0.62,1.15,0.62); fore.position.y=-0.6; elbow.add(fore);
      const fist=box(0.85,0.7,0.9,dark); fist.position.y=-1.35; elbow.add(fist);
      /* The guard is on the ARM that is guarding. A bubble round the whole
         mecha said "blocking" without saying with what, and it sat over
         the one pose worth looking at — the forearm coming up across the
         face. This is a plate on that forearm, so which side is covered
         is a thing you can see and therefore a thing you can walk around. */
      const shield=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.7,0.14),
        new THREE.MeshBasicMaterial({color:0x8fd3ff, transparent:true, opacity:0.34,
          depthWrite:false}));
      shield.position.set(0,-0.75,0.55); shield.visible=false; elbow.add(shield);
      const parts=[pad,upper,fore,fist];
      arms[id]={ shoulder, elbow, shield, sPose:0, ePose:0.25, sWant:0, eWant:0.25,
                 side, gone:false, parts,
                 // what it looked like before it was wrecked: a round ends and
                 // the arm comes back, and it has to come back its own colour
                 mats:parts.map(p=>p.material) };
    });

    // ---- legs: hip → thigh → knee → shin → foot
    const legs=[];
    [-1,1].forEach(side=>{
      const hip=joint(side*0.62, 1.65, 0, body);
      const thigh=box(0.72,1.0,0.8,trim); thigh.position.y=-0.5; hip.add(thigh);
      const knee=joint(0,-1.0,0, hip);
      const shin=box(0.62,0.95,0.7); shin.position.y=-0.5; knee.add(shin);
      const foot=box(0.8,0.32,1.15,dark); foot.position.set(0,-1.05,0.16); knee.add(foot);
      legs.push({ hip, knee, side, hPose:0, kPose:0 });
    });

    // ---- the floor ring that says whose it is, readable from overhead
    const ring=new THREE.Mesh(new THREE.RingGeometry(1.7,2.2,28),
      new THREE.MeshBasicMaterial({color:new THREE.Color(colour), transparent:true,
        opacity:0.7, side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2; ring.position.y=0.05; ring.userData.flat=true; g.add(ring);

    /* Smoke for a core that is nearly gone. Made once and parked, because
       a mecha that starts allocating puffs in the last ten seconds of a
       round is a mecha that stutters exactly when it matters. */
    const smoke=[];
    for(let i=0;i<7;i++){
      const puff=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5),
        new THREE.MeshBasicMaterial({color:0x6b6274, transparent:true, opacity:0}));
      puff.userData.t=i/7; body.add(puff); smoke.push(puff);
    }
    return { g, body, arms, legs, smoke, at:null, walk:0, lean:0, hurt:0 };
  }

  /* ---------------------------------------------------------- posing
     Every number below comes from the snapshot. Nothing here decides
     anything about the fight; it only draws what the fight already is. */
  const ARM_POSE={
    //                 shoulder   elbow      what it reads as
    idle   :{ s: 0.10, e: 0.30 },      // hanging, slightly bent
    wind   :{ s:-0.75, e: 1.55 },      // cocked back, elbow folded
    act    :{ s:-1.45, e: 0.06 },      // thrown, arm straight out
    rec    :{ s:-0.45, e: 0.75 },      // coming back
    block  :{ s:-1.15, e: 1.85 },      // forearm across the face
    windh  :{ s:-1.25, e: 1.75 },      // a heavy winds up further
    acth   :{ s:-1.70, e: 0.02 }       // and lands with everything
  };
  function pose(b, s, dt, mine){
    const hurt = s.st>0;                       // being thrown about
    const stopped = s.fz>0;                    // the world is frozen
    const speed = b.speed||0;

    // ---- arms
    ['left_arm','right_arm'].forEach(id=>{
      const arm=b.arms[id];
      const hp = id==='left_arm' ? s.p.la : s.p.ra;
      const raw = (id==='left_arm' ? s.a.l : s.a.r).split(':');
      const state=raw[0], act=raw[1];
      let key = act==='block' ? 'block'
              : state==='wind' ? (act==='heavy'?'windh':'wind')
              : state==='act'  ? (act==='heavy'?'acth':'act')
              : state==='rec'  ? 'rec' : 'idle';
      if(hp<=0){
        // dead weight: it hangs, and it swings a little as the body moves
        arm.sWant=0.25+Math.sin(b.walk)*0.12; arm.eWant=0.15;
        if(!arm.gone){ arm.gone=true; arm.parts.forEach(p=>p.material=DEAD); }
      } else {
        // three rounds a match, and every round hands the arms back
        if(arm.gone){ arm.gone=false; arm.parts.forEach((p,i)=>p.material=arm.mats[i]); }
        const P=ARM_POSE[key];
        arm.sWant=P.s; arm.eWant=P.e;
        // walking swings the arms that are not doing anything
        if(key==='idle') arm.sWant += Math.sin(b.walk+(arm.side>0?Math.PI:0))*Math.min(0.5,speed*0.07);
      }
      const k=Math.min(1, dt*(stopped?0:22));   // frozen means frozen, here too
      arm.sPose += (arm.sWant-arm.sPose)*k;
      arm.ePose += (arm.eWant-arm.ePose)*k;
      arm.shoulder.rotation.x=arm.sPose;
      arm.elbow.rotation.x=arm.ePose;
      arm.shield.visible = hp>0 && key==='block';
      if(arm.shield.visible)
        arm.shield.material.opacity=0.26+0.12*Math.sin(performance.now()*0.008);
    });

    // ---- legs: a walk cycle driven by how fast it is actually travelling
    if(!stopped) b.walk += dt*(2.2 + speed*1.15);
    const legHp=Math.max(0, s.p.lg)/100;
    const stride=Math.min(0.85, speed*0.12) * (0.45+0.55*legHp);
    b.legs.forEach(L=>{
      const ph=b.walk + (L.side>0?Math.PI:0);
      L.hPose += ((Math.sin(ph)*stride) - L.hPose)*Math.min(1, dt*16);
      // the knee only bends on the back half of the stride, or it looks like wading
      const bend=Math.max(0, -Math.cos(ph))*stride*1.4 + (legHp<0.5?0.25:0);
      L.kPose += (bend - L.kPose)*Math.min(1, dt*16);
      L.hip.rotation.x=L.hPose;
      L.knee.rotation.x=L.kPose;
    });

    // ---- the body: lean into the walk, recoil when hit, sag when dying
    b.hurt += ((hurt?1:0)-b.hurt)*Math.min(1, dt*(hurt?26:6));
    const core=Math.max(0, s.p.co)/200;
    const sag=(1-core)*0.18;
    b.lean += ((Math.min(0.16, speed*0.02) + sag) - b.lean)*Math.min(1, dt*8);
    b.body.rotation.x = b.lean - b.hurt*0.42;
    b.body.rotation.z = Math.sin(b.walk)*0.045 + (b.hurt*0.2*(b.arms.left_arm.side));
    b.body.position.y = Math.abs(Math.sin(b.walk))*0.09 - b.hurt*0.18;

    // ---- smoke, once the core is in trouble
    const smoking = core<0.45;
    b.smoke.forEach((puff,i)=>{
      if(!smoking){ puff.material.opacity=0; return; }
      puff.userData.t=(puff.userData.t+dt*(0.5+0.4*i/7))%1;
      const t=puff.userData.t;
      puff.position.set((i%2?0.5:-0.4)+Math.sin(t*6+i)*0.3, 3.4+t*3.2, -0.3-t*0.4);
      puff.scale.setScalar(0.5+t*1.5);
      puff.material.opacity=(1-core)*0.5*(1-t);
    });

  }
  const DEAD=new THREE.MeshLambertMaterial({color:0x3a3448});

  /* ==================================================== the network side */
  function fromServer(m){
    if(!on && m.op!=='start') return;
    if(m.op==='waiting'){ phase='waiting';
      waiting(t('Your mecha is in the arena. The fight starts when another student walks in.'));
      return; }
    if(m.op==='cancelled'){ leave(); return; }
    if(m.op==='rejected'){
      const e=(m.errors||[])[0];
      leave(t('The referee sent it back: {m}',{m:e?t(e.msg):''}));
      return;
    }
    if(m.op==='error'){ leave(t(m.message||'')); return; }
    if(m.op==='start'){
      mySide=m.you==='B'?'B':'A';
      names=m.names||names; rules=Object.assign({}, AR().RULES, m.rules||{});
      phase='fight';
      hideWait();
      build();                         // colours depend on which side you are
      apply(m.snapshot);
      big(t('ROUND 1'), names[mySide==='A'?'B':'A']);
      return;
    }
    if(m.op==='state'){ apply(m.s); (m.ev||[]).forEach(event); (m.tr||[]).forEach(trace); return; }
    if(m.op==='over' || m.op==='forfeit'){ finish(m.result, m.stats, m.rounds); return; }
  }
  function apply(s){
    if(!s) return;
    snap=s;
    if(!pred) pred={ x:s[mySide].x, z:s[mySide].z };
    else {
      /* Ease our own position back toward the truth rather than snapping
         it: a correction you can see is worse than a centimetre of lie.
         A big gap means something happened that was not walking — a
         shove, a dodge, a new round — and that is worth a snap. */
      const me=s[mySide];
      const gap=Math.hypot(me.x-pred.x, me.z-pred.z);
      if(gap>3){ pred.x=me.x; pred.z=me.z; }
      else { pred.x+=(me.x-pred.x)*0.18; pred.z+=(me.z-pred.z)*0.18; }
    }
    hud();
  }

  /* ================================================== the frame */
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
  function input(){
    const k=G.keys||{};
    return {
      fwd:(k.KeyW||k.ArrowUp?1:0)-(k.KeyS||k.ArrowDown?1:0),
      strafe:(k.KeyD?1:0)-(k.KeyA?1:0),
      yaw:G.yaw,
      run:!!(k.ShiftLeft||k.ShiftRight)
    };
  }
  function send(i, dt){
    const now=performance.now();
    if(now-sendAt < 1000/(rules?rules.hz:20)) return;
    sendAt=now;
    if(window.NET && NET.live) NET.mecha({ op:'input', i:{
      fwd:i.fwd, strafe:i.strafe, yaw:+i.yaw.toFixed(3), run:i.run } });
  }
  /* The practice match, stepped here — same module, same numbers, and a
     dummy that walks at you so there is something to test against. */
  let acc=0;
  function stepLocal(i, dt){
    if(!local) return;
    const hz=AR().RULES.hz;
    acc+=Math.min(dt,0.25);
    while(acc>=1/hz){
      acc-=1/hz;
      local.setInput('A', i);
      local.setInput('B', dummyInput());
      const r=local.step(1/hz);
      r.events.forEach(event);
      r.traces.A.filter(l=>l.steps.length).forEach(trace);
      apply(local.snapshot());
      if(local.over){ finish(local.result,
        { A:local.stats('A'), B:local.stats('B') }, local.log); return; }
    }
  }
  function dummyInput(){
    const a=local.robots.A, b=local.robots.B;
    const yaw=Math.atan2(a.x-b.x, a.z-b.z);
    const d=Math.hypot(a.x-b.x, a.z-b.z);
    return { fwd: d>3.2 ? 1 : 0, yaw, run:false };
  }
  /* Our own walking, applied the instant the key goes down. It is the
     same sum the simulation does, so the correction is normally
     millimetres — and where it is not, the ease in apply() eats it. */
  function walkLocally(i, dt){
    if(!pred || !snap) return;
    const me=snap[mySide];
    /* Frozen or being thrown, the server is not listening to the keys, and
       a browser that keeps walking during a hitstop spends the next tick
       being dragged back to where it actually is. The freeze is on the
       wire for exactly this. */
    if(me.fz>0 || me.st>0) return;
    const busy = /wind:heavy/.test(me.a.l) || /wind:heavy/.test(me.a.r);
    const legs = 0.45+0.55*(me.p.lg/(rules.parts?rules.parts.legs:100));
    let sp=(i.run?AR().RULES.run:AR().RULES.walk)*legs*(busy?0.15:1);
    const len=Math.hypot(i.fwd,i.strafe);
    if(len>0.01){
      const s=Math.sin(i.yaw), c=Math.cos(i.yaw);
      pred.x += (s*i.fwd + c*i.strafe)/len*sp*len*dt;
      pred.z += (c*i.fwd - s*i.strafe)/len*sp*len*dt;
      const R=AR().RULES.radius-AR().RULES.bodyR, d=Math.hypot(pred.x,pred.z);
      if(d>R){ pred.x*=R/d; pred.z*=R/d; }
    }
  }

  /* -------------------------------------------------------- drawing */
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
      /* How fast it is actually crossing the floor, smoothed — the legs
         are driven by this rather than by the keys, so a mecha being
         thrown backwards runs its legs backwards too. */
      const moved=Math.hypot(b.g.position.x-(b.wasX||b.g.position.x),
                             b.g.position.z-(b.wasZ||b.g.position.z));
      b.wasX=b.g.position.x; b.wasZ=b.g.position.z;
      const v=moved/Math.max(dt,0.001);
      b.speed=(b.speed||0)+(v-(b.speed||0))*Math.min(1,dt*9);

      let d=s.yaw-b.g.rotation.y;
      d=Math.atan2(Math.sin(d),Math.cos(d));
      b.g.rotation.y += d*Math.min(1, dt*16);

      pose(b, s, dt, mine);
      // a mecha with nothing left drops where it stands
      b.g.scale.setScalar(s.p.co<=0 ? 0.9 : 1);
    });
  }
  /* Over your own shoulder. The camera follows where you are LOOKING,
     which is the one thing in this mode the player is entirely in charge
     of, so it never fights them for it. */
  function camera(dt){
    if(!snap) return;
    const me=bots[mySide]; if(!me) return;
    const p=me.g.position;
    const s=Math.sin(G.yaw), c=Math.cos(G.yaw);
    /* Over the shoulder rather than straight up the spine. At punching
       range the other mecha is two and a half metres in front of you, and
       a camera on the centre line puts your own back squarely between
       your eyes and the entire fight — so it sits high, wide and looks
       past you at the ground you are both standing on. */
    const back=12, up=7.2, side=2.0, ahead=6;
    G.camera.position.set(p.x - s*back + c*side, up, p.z - c*back - s*side);
    /* THE FLINCH. Hitstop stops the world for a moment; this is what makes
       that stop read as an impact rather than as a dropped frame. Scaled
       by the damage and gone in a third of a second, so a jab caught on a
       guard twitches the lens and a heavy through it hits the lens. */
    if(shake>0){
      const now=performance.now();
      G.camera.position.x += Math.sin(now*0.09)*shake;
      G.camera.position.y += Math.cos(now*0.13)*shake*0.7;
      shake=Math.max(0, shake-(dt||0.016)*4.5);
    }
    G.camera.up.set(0,1,0);
    G.camera.lookAt(p.x + s*ahead, 2.0, p.z + c*ahead);
  }

  /* ------------------------------------------------------------ events */
  function event(e){
    if(e.kind==='hit'){
      const b=bots[e.at]; if(b) hitFx(b.g.position, e.dmg, e.note);
      /* Both of you feel it, and the one taking it feels it more. A hit
         you landed should be worth watching too — half a flinch says
         "that connected" without pretending you were the one hit. */
      const felt=Math.min(1.0, (e.dmg||0)/22) * (e.at===mySide ? 0.9 : 0.45);
      shake=Math.max(shake, felt);
      if(e.at!==mySide) return;
      // taking one is worth saying, because it is usually why a plan died
      line(`<span class="no">${t('HIT')} −${e.dmg} ${t(partName(e.part))}</span>`
           +(e.note?` <span class="why">${t(e.note)}</span>`:''));
    }
    if(e.kind==='broken'){
      const who = e.side===mySide ? t('YOUR') : t('THEIR');
      line(`<span class="no">${who} ${t(partName(e.part))} ${t('IS DESTROYED')}</span>`);
      if(e.side===mySide) say(t('{p} destroyed — the orders in it stop running.',
        {p:t(partName(e.part))}));
    }
    if(e.kind==='dodged' && e.side===mySide) line(`<span class="yes">${t('DODGED IT')}</span>`);
    if(e.kind==='round'){
      const won = e.winner===mySide;
      big(e.winner==='draw' ? t('ROUND DRAWN') : won ? t('ROUND WON') : t('ROUND LOST'),
          e.why==='core' ? t('core destroyed') : t('on the clock'));
    }
    if(e.kind==='newround') setTimeout(()=>big(t('ROUND {n}',{n:e.round}), ''), 1400);
  }
  const partName = p => ({ core:'CORE', left_arm:'LEFT ARM', right_arm:'RIGHT ARM',
                           legs:'LEGS', sensor:'SENSOR' })[p]||p;

  /* The feed: your own code thinking out loud. One line per decision,
     and repeats are counted rather than repeated so a rule that fires
     every tick does not bury the one that fired once. */
  function trace(l){
    const parts={ left_arm:t('LEFT ARM'), right_arm:t('RIGHT ARM'), legs:t('LEGS') };
    const bits=l.steps.map(s=>{
      if(s.kind==='event') return `<span class="ev">${t(MC().say(s))}</span>`;
      if(s.kind==='test') return `${t(MC().say(s))} <span class="${s.yes?'yes':'no'}">${
        s.yes?'✓ '+t('TRUE'):'✕ '+t('FALSE')}</span>`;
      if(s.kind==='action') return `<span class="act">→ ${t(MC().say(s))}</span>`;
      if(s.kind==='stall') return `<span class="why">${t('nothing: ')}${t(s.why)}</span>`;
      return '';
    });
    if(!bits.length) return;
    line(`<b style="color:var(--muted)">${parts[l.part]||l.part}</b> ${bits.join(' ')}`);
  }
  function line(html){
    const last=feed[feed.length-1];
    if(last && last.html===html){ last.n++; }
    else feed.push({ html, n:1 });
    while(feed.length>9) feed.shift();
    const el=$('#maFeed');
    el.innerHTML=`<h4>${t('WHY IT DID THAT')}</h4>`+
      feed.map(f=>`<div class="ma-line">${f.html}${f.n>1?` <span class="why">×${f.n}</span>`:''}</div>`).join('');
  }

  /* ---------------------------------------------------------- the HUD */
  function hud(){
    if(!snap) return;
    const P=[['la','LEFT ARM','left_arm'],['ra','RIGHT ARM','right_arm'],
             ['lg','LEGS','legs'],['sn','SENSOR','sensor'],['co','CORE','core']];
    const side=(which, el, right)=>{
      const s=snap[which]; if(!s) return;
      const max=AR().RULES.parts;
      el.innerHTML=`
        <div class="ma-name" style="color:${which===mySide?SIDE_ME:SIDE_YOU}">${names[which]||which}</div>
        <div class="ma-parts">${P.map(([k,label,id])=>{
          const pct=Math.max(0, s.p[k]/max[id]*100);
          return `<div class="ma-p ${id==='core'?'core':''} ${s.p[k]<=0?'gone':''}">
            <span>${t(label)}</span><div class="b"><i style="width:${pct}%"></i></div></div>`;
        }).join('')}</div>
        <div class="ma-meters">
          <div class="ma-meter ma-en"><i style="width:${s.e}%"></i></div>
          <div class="ma-meter ma-ht"><i style="width:${s.h}%"></i></div>
        </div>`;
    };
    side(mySide, $('#maA'));
    side(mySide==='A'?'B':'A', $('#maB'), true);
    const pips=(w)=>'●'.repeat(w)+'○'.repeat(Math.max(0,Math.ceil(AR().RULES.rounds/2)-w));
    $('#maClock').innerHTML=`<div class="n">${Math.ceil(snap.clock)}</div>
      <div class="l">${t('ROUND')} ${snap.round}</div>
      <div class="pips" style="color:${SIDE_ME}">${pips(snap[mySide].w)}</div>
      <div class="pips" style="color:${SIDE_YOU}">${pips(snap[mySide==='A'?'B':'A'].w)}</div>`;
  }

  /* -------------------------------------------------------- the extras */
  function hitFx(pos, dmg, note){
    /* A spark, not a dome. Growth is compounded per frame, so a sphere
       that looks modest for one frame ends up five times its own size by
       the end of its life whatever the frame rate — the first version of
       this swallowed both mechas. Small, brief, and it grows by half. */
    const big=Math.min(0.85, 0.3+(dmg||0)/40);
    const m=new THREE.Mesh(new THREE.SphereGeometry(big,10,8),
      new THREE.MeshBasicMaterial({color: note==='blocked'?0x8fd3ff:0xffe9a8,
        transparent:true, opacity:0.95}));
    m.position.set(pos.x, 2.6, pos.z); world.add(m);
    fx.push({ m, life: note==='blocked'?0.18:0.26, grow:1.6 });
    // scrap: a few chips thrown off the side that was hit
    if(note!=='blocked') for(let i=0;i<4;i++){
      const c=new THREE.Mesh(new THREE.BoxGeometry(0.17,0.17,0.17),
        new THREE.MeshBasicMaterial({color:0xffd8a8, transparent:true, opacity:0.95}));
      c.position.set(pos.x+(Math.random()-0.5), 2.4+Math.random(), pos.z+(Math.random()-0.5));
      world.add(c);
      fx.push({ m:c, life:0.45, vx:(Math.random()-0.5)*9, vy:2+Math.random()*4,
                vz:(Math.random()-0.5)*9 });
    }
  }
  function stepFx(dt){
    for(let i=fx.length-1;i>=0;i--){
      const f=fx[i]; f.life-=dt;
      if(f.grow) f.m.scale.multiplyScalar(1+dt*f.grow);
      if(f.vx!==undefined){                     // thrown scrap, falling
        f.m.position.x+=f.vx*dt; f.m.position.y+=f.vy*dt; f.m.position.z+=f.vz*dt;
        f.vy-=26*dt;
        f.m.rotation.x+=dt*7; f.m.rotation.y+=dt*5;
      }
      f.m.material.opacity=Math.max(0,f.life*2.4);
      if(f.life<=0){ if(f.m.parent) f.m.parent.remove(f.m); fx.splice(i,1); }
    }
  }
  function big(text, sub){
    const el=$('#maBig');
    el.innerHTML=`<div class="big">${text}</div><div class="sub">${sub||''}</div>`;
    el.classList.remove('hidden');
    clearTimeout(big._t);
    big._t=setTimeout(()=>el.classList.add('hidden'), 1500);
  }
  function say(text){
    const el=$('#maSay'); el.textContent=text; el.classList.remove('hidden');
    clearTimeout(say._t);
    say._t=setTimeout(()=>el.classList.add('hidden'), 3200);
  }
  function waiting(text){
    phase='waiting';
    const el=$('#maWait');
    el.innerHTML=`<div class="card">
      <h3>${t('WAITING FOR AN OPPONENT')}</h3><p>${text}</p>
      <div class="row" style="display:flex;gap:10px;justify-content:center">
        <button class="btn ghost small" data-a="back">${t('Back to the workshop')}</button>
      </div></div>`;
    el.classList.remove('hidden');
    el.querySelector('[data-a="back"]').onclick=()=>leave();
  }
  function hideWait(){ $('#maWait').classList.add('hidden'); }
  function leave(msg){
    stop();
    if(window.WORKSHOP) WORKSHOP.show({ onFight:start });
    if(msg && window.WORKSHOP) setTimeout(()=>{
      const n=$('#mwNote'); if(n) n.textContent=msg; }, 30);
  }

  /* ----------------------------------------------- the analysis screen
     Not a scoreboard. The numbers chosen are the ones that point at a
     line of code: shots that never reached, energy spent on nothing,
     times the arms locked up. */
  function finish(result, stats, rounds){
    phase='over'; over={result, stats};
    hideWait();
    const mine=stats[mySide]||{}, theirs=stats[mySide==='A'?'B':'A']||{};
    const won = result && result.winner===mySide;
    const acc = mine.punches ? Math.round(mine.landed/mine.punches*100) : 0;
    const waste = mine.spent ? Math.round(mine.wasted/mine.spent*100) : 0;
    const row=(k,v)=>`<div><b>${v}</b><span>${t(k)}</span></div>`;
    const advice =
      !mine.punches ? t('Your arms never swung once. Nothing in them ever reached an action — check what the WHEN is waiting for.')
      : acc<25      ? t('You threw {n} and landed {l}. Test the distance before you swing, or you are paying energy for air.',{n:mine.punches,l:mine.landed})
      : mine.overheats>1 ? t('You overheated {n} times. Heat is the price of the big swings — mix in something cheap.',{n:mine.overheats})
      : mine.stalls>20  ? t('Your parts were told to act {n} times with nothing to pay for it. Spend less, or spend it on fewer things.',{n:mine.stalls})
      : theirs.blocked>theirs.taken/4 ? t('They blocked most of what you threw. A heavy punch goes through a guard.')
      : won ? t('It worked. Now think about what it would lose to.')
            : t('Read the feed back: the last thing your code did before the core went is usually the thing to change.');
    showResults({
      title: !result ? t('THE FIGHT IS OVER')
           : result.winner==='draw' ? t('A DRAW')
           : won ? t('YOU WIN') : t('YOU ARE DOWN'),
      body: `<p>${t(result?result.text:'')}</p><p style="color:var(--star)">${advice}</p>`,
      stats: row('punches thrown', mine.punches||0) + row('punches landed', mine.landed||0)
           + row('accuracy', acc+'%') + row('blocks put up', mine.blocks||0)
           + row('dodges', mine.dodges||0) + row('overheats', mine.overheats||0)
           + row('energy wasted', waste+'%')
           + row('damage dealt', mine.dealt||0) + row('damage taken', mine.taken||0),
      btnText: t('BACK TO THE WORKSHOP ▶'),
      onBtn: ()=>{ $('#done').classList.add('hidden'); leave(); }
    });
  }

  if(window.NET) NET.onMecha = fromServer;

  return { start, stop, tick, net:fromServer, leave,
           get active(){ return on; },
           get phase(){ return phase; },
           DUMMY };
})();
