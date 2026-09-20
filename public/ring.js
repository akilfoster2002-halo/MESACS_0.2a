/* =====================================================================
   RING — the robot, on the floor, doing what you told it to.

   One robot. No opponent, no health, no clock. You wrote rules in the
   pit that say which key does what, and this is where you press them and
   watch it happen. Everything else that used to be in here came out with
   the fight, and goes back in on top of this once the feet are right.

   THE BODY IS THE REAL BODY. noisyboy.glb and ambush.glb are rigged
   exports with thirty-three bones and fourteen clips, and they are what
   is on screen — not an approximation of them built out of boxes. They
   are loaded the same way the arena on RYU loads them, for the same
   reasons, and two of those reasons cost somebody a day each:

     NEVER CULLED. A skinned mesh is culled against the bounding box it
     was exported in, and that box is not any pose it is ever in — so a
     body mid-animation leaves it and blinks out at the moment it is
     doing the most interesting thing it does.

     SCALED AND NOT LIFTED. A Mixamo export's mesh is centred on the
     origin with half of it below, but the SKELETON stands on the origin,
     and the two are reconciled by the inverse bind matrices. Where the
     body is DRAWN is where the bones put it. Nudge it up by -box.min.y
     and it floats half its own height above the floor with its shadow
     underneath it.

   ------------------------------------------------------------------
   THE WALK CYCLE IS NOT IN THE FILE YET

   Neither .glb has one: the clips are idle, jab, hook, cross,
   roundhouse, flykick, sweep, block, dodge, hit, floored, getup, roar
   and uppercut, and none of those is a loop you can travel on. So the
   robot currently slides while playing `idle`, which is honest about
   what it is rather than pretending with a dodge hop.

   WHEN A WALK CLIP ARRIVES, it needs no code: put it in the .glb under
   any of the names in WALK_CLIPS below and it will be found and played
   while moving. That is the entire integration. If it is named something
   else, add that name to the list — one line, and it is a list rather
   than an `if` for exactly this reason.
   ===================================================================== */
window.RING = (function(){
  const $ = s => document.querySelector(s);
  const BT = ()=>window.BOUT, MC = ()=>window.MECHACODE, RB = ()=>window.ROBOTS;
  const T  = s => (window.t ? t(s) : s);

  /* The first of these that exists in the model is what gets played
     while the robot is travelling. None of them exist today. */
  const WALK_CLIPS = ['walk','Walk','walking','strafe','Strafe','run','Run'];
  const IDLE_CLIP  = 'idle';

  let on=false, phase='off';
  let spec=null, program=[], stage=null;
  let world=null, body=null, mixer=null, clips=[], cur=null, curName=null;
  let feed=[], lastSaid=null, wasFP=null, camX=0;

  /* ------------------------------------------------------------ start */
  function start(robotId, prog){
    stop();
    on=true; phase='live';
    feed=[]; lastSaid=null; camX=0;
    spec=RB().get(robotId);
    program=prog||[];
    stage=new (BT().Stage)({ robot:spec.id, program });

    G.running=true; G.hudOwner='ring'; G.missionId='ring'; G.room=null;
    if(window.updateLeaveBtn) updateLeaveBtn();
    if(window.MENU) MENU.hideAll();
    if(window.AVATAR) AVATAR.detach();
    if(wasFP===null) wasFP=!!G.firstPerson;
    G.firstPerson=false;
    if(window.GUN) GUN.carried(false);
    ['#mapwrap','#health','#skill','#trigger','#objectives','#crosshair','#focus','#briefing']
      .forEach(s=>{ const e=$(s); if(e) e.classList.add('hidden'); });
    $('#hud').classList.remove('hidden');
    $('#ring').classList.remove('hidden');
    $('#ringFeed').classList.remove('hidden');
    $('#ringKeys').classList.remove('hidden');

    /* THE BINDINGS GO IN THE ENGINE'S HINT BAR AND NOWHERE ELSE. Putting
       them here as well printed the same sentence twice, once over the
       other, which is a mistake I have now made in this file twice.
       What is left in the middle of the screen is the one thing the hint
       bar has no room for and a student with no rules badly needs. */
    if(window.keyHint) keyHint(keyLine());
    const esc=$('#escHint'); if(esc) esc.classList.add('hidden');
    const bare=!(program||[]).some(r=>r && r.type==='when' && (r.body||[]).length);
    const mid=$('#ringKeys');
    mid.innerHTML = bare
      ? `<b>${T('This robot has no rules yet.')}</b><br>${T('Nothing you press will do anything until you go back and write one.')}`
      : '';
    mid.classList.toggle('hidden', !bare);

    build();
    load();
    hud();
  }

  /* The hint bar says what YOUR PROGRAM does, not what the game does,
     because in here those are not the same thing and the whole point is
     that you decided. A robot with no rules says so. */
  function keyLine(){
    const rules=(program||[]).filter(r=>r && r.type==='when' && (r.body||[]).length);
    if(!rules.length) return T('no keys are programmed');
    return rules.map(r=>{
      const a=MC().ACTIONS[(r.body[0]||{}).type];
      return `<b>${MC().keyLabel(r.key)}</b> ${a?T(a.label):''}`;
    }).join(' &nbsp;·&nbsp; ');
  }

  function stop(){
    if(!on){ phase='off'; return; }
    on=false; phase='off';
    stage=null; body=null; mixer=null; clips=[]; cur=null; curName=null; world=null;
    $('#ring').classList.add('hidden');
    ['#ringFeed','#ringKeys']
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
    G.scene.fog=new THREE.Fog(0x120e22, 50, 170);
    G.camera.near=0.3; G.camera.far=400; G.camera.updateProjectionMatrix();
    G.camera.up.set(0,1,0);

    const F=BT().RULES.floor;
    const floor=new THREE.Mesh(new THREE.BoxGeometry(F*2+8, 1, 22),
      new THREE.MeshLambertMaterial({color:0x2b2444}));
    floor.position.y=-0.5; floor.userData.flat=true;
    floor.receiveShadow=true;
    world.add(floor);

    /* A stripe every two metres. The robot moves at a speed in metres a
       second, and a floor with nothing on it gives a student no way at
       all to see that — with stripes, "it went four along" is a thing
       you can count rather than a thing you have to be told. */
    for(let i=-F; i<=F; i+=2){
      const lit=i===0;
      const m=new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 20),
        new THREE.MeshBasicMaterial({color: lit?0x8ff0ff:0x3b3059}));
      m.position.set(i, 0.02, 0); m.userData.flat=true; world.add(m);
    }
    /* And the edges, so the end of the floor is somewhere rather than a
       place the robot silently stops. */
    [-1,1].forEach(s=>{
      const w=new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 20),
        new THREE.MeshLambertMaterial({color:0x4a3f7a}));
      w.position.set(s*(F+1.5), 0.8, 0); world.add(w);
    });

    world.add(new THREE.AmbientLight(0xb9a8ff, 0.42));
    const key=new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(10, 26, 16);
    key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);
    const sc=key.shadow.camera;
    sc.left=-F-6; sc.right=F+6; sc.top=18; sc.bottom=-18; sc.near=1; sc.far=70;
    sc.updateProjectionMatrix();
    key.shadow.bias=-0.0006; key.shadow.normalBias=0.4;
    world.add(key); world.add(key.target);
    const fill=new THREE.DirectionalLight(0x8fa8ff, 0.4);
    fill.position.set(-14, 9, -12); world.add(fill);

    G.scene.updateMatrixWorld(true);
  }

  /* ------------------------------------------------------- the body */
  function load(){
    const holder=new THREE.Group();
    world.add(holder);
    body=holder;
    new THREE.GLTFLoader().load(spec.model + '?v=' + (window.ASSETV||'1'), gl=>{
      if(!on) return;                       // they left while it was loading
      const r=gl.scene;
      r.traverse(o=>{
        if(!o.isMesh) return;
        o.frustumCulled=false;              // see the header
        o.castShadow=true;
        if(o.geometry.attributes.color){
          o.material.vertexColors=true; o.material.needsUpdate=true;
        }
      });
      r.updateMatrixWorld(true);
      const bx=new THREE.Box3().setFromObject(r);
      const h=bx.max.y-bx.min.y;
      r.scale.setScalar(h>1e-6 ? spec.height/h : 1);   // scale only — never lift
      holder.add(r);
      mixer=new THREE.AnimationMixer(r);
      clips=gl.animations||[];
      play(IDLE_CLIP, 0);
      hud();
    }, undefined, ()=>{
      /* A model that will not load is not a silent robot. Say it on the
         feed, where everything else about this screen is said. */
      line('stall', T('The robot model could not be loaded.'));
    });
  }

  function play(name, fade){
    if(!mixer || curName===name) return;
    const clip=clips.find(c=>c.name===name);
    if(!clip) return;
    const next=mixer.clipAction(clip);
    next.reset().setEffectiveWeight(1).fadeIn(fade===undefined?0.18:fade).play();
    if(cur) cur.fadeOut(fade===undefined?0.18:fade);
    cur=next; curName=name;
  }
  /* The one place the missing walk cycle is handled. The moment a clip
     with one of these names exists in the .glb, this starts returning it
     and the robot walks instead of sliding. Nothing else changes. */
  const walkClip = () => WALK_CLIPS.find(n=>clips.some(c=>c.name===n)) || null;

  /* ------------------------------------------------------------- tick */
  function tick(dt){
    if(!on || !world || !stage) return;
    /* G.keys is already keyed by KeyboardEvent.code, which is exactly
       what a rule stores, so the program reads the keyboard directly
       with nothing translating in between. */
    const r=stage.step(dt, G.keys||{});
    say(r.trace);

    const s=stage.snapshot();
    if(body){
      body.position.x=s.x;
      body.rotation.y=s.yaw;
    }
    const w=walkClip();
    play(s.moving && w ? w : IDLE_CLIP);
    if(mixer) mixer.update(dt);

    camera(dt, s);
    hud(s);
  }

  /* Side on, and it drifts after the robot rather than locking to it: a
     camera welded to a moving thing makes the thing look still, and the
     whole point of this screen is seeing that it moved. The stripes stay
     put, so the movement reads against them. */
  function camera(dt, s){
    camX += (s.x - camX) * Math.min(1, dt*2.2);
    G.camera.position.set(camX*0.55, 4.6, 12.5);
    G.camera.up.set(0,1,0);
    G.camera.lookAt(camX*0.85, 2.3, 0);
  }

  /* --------------------------------------------------------- the feed
     Only when the reasoning CHANGES. At twenty ticks a second a held key
     is the same sentence two hundred times a minute, and a feed that
     repeats itself is one nobody reads. */
  function say(trace){
    const said=(trace||[]).map(MC().say).filter(Boolean).join(' → ');
    if(said===lastSaid) return;
    lastSaid=said;
    if(!said) return;
    const kind=(trace.find(s=>s.kind==='stall') ? 'stall'
              : trace.find(s=>s.kind==='action') ? 'act' : 'ev');
    line(kind, said);
  }
  function line(cls, text){
    if(!text) return;
    feed.push({cls, text});
    if(feed.length>12) feed.shift();
    const host=$('#ringFeed'); if(!host) return;
    host.innerHTML=feed.map(f=>`<div class="ring-line ${f.cls}">${f.text}</div>`).join('');
  }

  /* ---------------------------------------------------------- the HUD
     Which robot, where it is standing, and how many rules it is running.
     Position is on screen because the floor is marked in metres and a
     number you can check against the stripes is a number that teaches. */
  function hud(s){
    const el=$('#ringA'); if(!el || !spec) return;
    const rules=(program||[]).filter(r=>r && r.type==='when').length;
    const at=s ? s.x.toFixed(1) : '0.0';
    el.innerHTML=`<div class="ring-name"><b>${spec.name}</b>
        <small>${rules} ${T(rules===1?'rule':'rules')}</small></div>
      <div class="ring-p"><span>${T('POSITION')}</span>
        <i><b style="width:${Math.round((s?s.x:0)/BT().RULES.floor*50+50)}%"></b></i>
        <span style="width:44px;text-align:right">${at} m</span></div>`;
  }

  function leave(msg){
    stop();
    if(window.PIT) PIT.show({ onGo:start });
    /* window.say, explicitly: there is a say() in this file too, and it
       takes a trace rather than a sentence. */
    if(msg && window.say) window.say(msg);
  }

  return { start, stop, tick, leave,
           get active(){ return on; },
           get phase(){ return phase; } };
})();
