/* =====================================================================
   THE LOOP — VOLTA's nightclub, and the decks in it.

   A planet you fly to for one building is a planet with one thing to do
   on it, and the Gym is a thing you do alone with a program. So VOLTA
   got a second door, and behind it the one part of this game that is not
   marked, not unlocked and not a mission: a room with people in it and a
   set you can play.

   IT IS STILL A LOOP, though, and it says so on the sign. What you are
   handed at the decks is sixteen steps that go round for ever with four
   tracks written across them — which is the `repeat` block from Mission
   2, drawn as a grid, with the playhead showing you the thing a loop
   never shows you: where in the body it currently is. Nobody is told
   that. They just watch the bar sweep and put a kick on every fourth
   step, and the next time they meet a loop they have already seen one
   run.

   THREE THINGS THIS ROOM IS CAREFUL ABOUT.

   The sound is SYNTHESISED, not sampled. A club that needs four
   megabytes of audio before it makes a noise is a club that is silent on
   a school connection, and every one of these voices is an oscillator
   and an envelope — the whole kit is under a kilobyte of code and starts
   instantly.

   It respects the mute button. This is played thirty machines to a room
   and the single fastest way to get the game banned is a nightclub that
   cannot be turned off, so the master gain follows MUSIC.muted every
   frame, and the transport keeps running underneath so the floor still
   dances with the sound off.

   And the crowd is DRIVEN BY THE PATTERN, not by a timer. Take the hats
   out and the room settles; put the bass back and it lifts. That
   feedback is the entire reward for touching the grid, and it has to be
   immediate or the grid is a toy nobody presses twice.
   ===================================================================== */
window.CLUB = (function(){
  const V = (x,y,z)=>new THREE.Vector3(x,y,z);
  const say = k => (window.t ? t(k) : k);

  /* ------------------------------------------------------------ the kit
     Four voices, in the order they sit on the grid. The names are the
     names a nine-year-old would use, because the row labels are these. */
  const TRACKS=[
    { id:'kick', name:'KICK', c:'#ff6ad5' },
    { id:'clap', name:'CLAP', c:'#8ff0ff' },
    { id:'hat',  name:'HAT',  c:'#ffe9a8' },
    { id:'bass', name:'BASS', c:'#a8e6cf' }
  ];
  const STEPS=16;

  /* The set everybody walks in on. Four-on-the-floor, a clap on the
     backbeat, hats off the beat and a bassline that moves — a pattern
     that is already a groove, so the first thing you do at the decks is
     change something rather than build something out of silence. */
  const OPENING=[
    [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,1,1,0],
    [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,0]
  ];
  /* Two bars of a minor line, one note per step. Semitones off the root,
     so the shape survives whatever the root is set to. */
  const LINE=[0,0,3,0, 5,0,3,0, 0,0,7,0, 5,3,0,-2];
  const ROOT=55;                        // A1: low enough to feel, high enough to hear

  let pat=OPENING.map(r=>r.slice());
  let bpm=124, playing=false, on=false;
  let step=0, energy=0.55, filter=1, dropAt=-9;

  /* ------------------------------------------------------------- audio */
  let ac=null, master=null, lp=null, noise=null, timer=null, nextAt=0, sched=0;
  const LOOKAHEAD=0.12, TICK=25;

  function boot(){
    if(ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    try{ ac=new AC(); }catch(e){ return null; }
    master=ac.createGain(); master.gain.value=0;
    /* One filter across the whole kit, which is what a DJ actually has a
       knob for: closing it does not mute anything, it takes the top off
       everything at once and that is the sound of a build. */
    lp=ac.createBiquadFilter(); lp.type='lowpass';
    lp.frequency.value=18000; lp.Q.value=0.9;
    lp.connect(master); master.connect(ac.destination);

    const n=ac.sampleRate|0;
    noise=ac.createBuffer(1, n, ac.sampleRate);
    const d=noise.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
    return ac;
  }
  /* Browsers refuse audio until somebody has done something, and refuse it
     silently. By VOLTA there has been a START, a sign-in and a landing, so
     this is nearly always already fine — and when it is not, the next key
     or click in the room tries again rather than leaving the club mute for
     the whole visit. */
  function wake(){
    if(!ac) return;
    if(ac.state==='suspended') ac.resume().catch(()=>{});
  }
  const env=(g, at, peak, hold, fall)=>{
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at+0.004);
    g.gain.setValueAtTime(peak, at+0.004+(hold||0));
    g.gain.exponentialRampToValueAtTime(0.0001, at+0.004+(hold||0)+fall);
  };
  function burst(at, dur, type, freq, q, peak){
    const s=ac.createBufferSource(); s.buffer=noise;
    s.loop=true; s.playbackRate.value=1;
    const f=ac.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q;
    const g=ac.createGain();
    s.connect(f); f.connect(g); g.connect(lp);
    env(g, at, peak, 0, dur);
    s.start(at); s.stop(at+dur+0.05);
  }
  function voice(id, at, ix){
    if(id==='kick'){
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='sine';
      o.frequency.setValueAtTime(150, at);
      o.frequency.exponentialRampToValueAtTime(46, at+0.11);
      env(g, at, 0.95, 0.012, 0.24);
      o.connect(g); g.connect(lp); o.start(at); o.stop(at+0.4);
      return;
    }
    if(id==='clap'){ burst(at, 0.17, 'bandpass', 1500, 1.2, 0.55); return; }
    if(id==='hat'){  burst(at, 0.045,'highpass', 7200, 0.7, 0.30); return; }
    if(id==='bass'){
      /* The step being SCHEDULED, which is not `step` — that is still the
         one you can currently hear, and it is set after these are booked.
         Reading it here played the whole bassline one sixteenth behind its
         own pattern: every note right, every note late. */
      const semi=LINE[ix % LINE.length];
      const hz=ROOT*Math.pow(2, semi/12);
      const o=ac.createOscillator(), g=ac.createGain(), f=ac.createBiquadFilter();
      o.type='sawtooth'; o.frequency.setValueAtTime(hz, at);
      f.type='lowpass'; f.Q.value=6;
      /* The filter opens with the room. A bassline that sounds the same
         whether four voices are running or one is a bassline nobody
         notices they have turned on. */
      f.frequency.setValueAtTime(220+900*energy, at);
      f.frequency.exponentialRampToValueAtTime(160, at+0.2);
      env(g, at, 0.42, 0.02, 0.2);
      o.connect(f); f.connect(g); g.connect(lp); o.start(at); o.stop(at+0.35);
    }
  }

  /* A sixteenth is a quarter of a beat, and a beat is 60/bpm. The whole
     transport is this one number. */
  const stepSecs = ()=> 15/bpm;

  /* SCHEDULE AHEAD, DRAW BEHIND. Audio has to be booked before it is
     needed or it arrives late and audibly wrong; the room only has to be
     right now. So this books notes into the future and remembers WHEN each
     one lands, and the frame loop reads the clock to decide what the floor
     is doing. */
  let beatAt=0, beatIx=0;
  function pump(){
    if(!ac) return;
    /* A BACKGROUNDED TAB THROTTLES setInterval to about once a second, so
       coming back to the tab finds the clock eight steps ahead of the
       schedule — and the loop below would then book all eight at once,
       clamped to now, which is a machine gun rather than a bar. If we have
       fallen behind by more than a step, give up on catching up and start
       again from here. */
    if(nextAt < ac.currentTime - stepSecs()) nextAt=ac.currentTime+0.02;
    while(nextAt < ac.currentTime + LOOKAHEAD){
      const at=Math.max(nextAt, ac.currentTime+0.01);
      const ix=sched;
      TRACKS.forEach((tr,r)=>{ if(pat[r][ix]) voice(tr.id, at, ix); });
      if(sched%4===0){ beatAt=at; beatIx=(beatIx+1)|0; }
      step=sched;
      sched=(sched+1)%STEPS;
      nextAt += stepSecs();
    }
  }
  let dead=false;
  function startAudio(){
    if(dead) return;
    if(!boot()){ dead=true; return; }   // no WebAudio here; stop asking
    wake();
    if(timer) return;
    nextAt=ac.currentTime+0.08; sched=0;
    timer=setInterval(pump, TICK);
  }
  function stopAudio(){
    if(timer){ clearInterval(timer); timer=null; }
    if(master) master.gain.value=0;
  }

  /* ------------------------------------------------------------- the room */
  let group=null, tiles=null, tileCol=null, beams=[], dancers=[], booth=null, dj=null;
  let bldg=null, deckLight=null, panelFace=null;
  const DANCERS=10;
  /* The whole roster, alternating. It used to be Kyle and Mia and eight
     out of the Kenney kit, danced by hand because the kit has no dance in
     it — and the hand-danced ones were the reason the six-named-bones path
     below exists. The kit is gone; both of these have a real dance clip,
     so the floor is ten people actually dancing rather than two dancing
     and eight being posed. The fallback stays for any model that turns up
     without one. */
  const CAST=['s','t'];

  function room(g, b, hw, hd, api){
    stop();
    on=true; bldg=b;
    group=new THREE.Group(); g.add(group);
    const lam = api.lam;

    /* Dark. Everything in here that you can see is something that is
       giving light off, which is what makes the beams read as beams. */
    group.add(new THREE.AmbientLight(0x30204a, 0.34));

    /* --- the floor, which is the instrument's other display --------------
       Sixty-four tiles, one InstancedMesh, one draw call, and a colour per
       tile rewritten every frame. Sixty-four separate meshes would be
       sixty-four draw calls for a thing that is only ever a grid of
       colours. */
    const N=8, sq=2.2, half=N*sq/2, FZ=1.5;
    const geo=new THREE.BoxGeometry(sq*0.92, 0.14, sq*0.92);
    tiles=new THREE.InstancedMesh(geo,
      new THREE.MeshBasicMaterial({ vertexColors:false }), N*N);
    tiles.userData.flat=true; tiles.userData.sky=true;
    const m=new THREE.Matrix4();
    for(let i=0;i<N*N;i++){
      const x=-half+sq/2+(i%N)*sq, z=FZ-half+sq/2+((i/N)|0)*sq;
      m.makeTranslation(x, 0.12, z);
      tiles.setMatrixAt(i, m);
      tiles.setColorAt(i, new THREE.Color(0x1a1030));
    }
    tiles.instanceMatrix.needsUpdate=true;
    group.add(tiles);
    tileCol=new THREE.Color();

    // the surround, so the lit floor has an edge rather than fading into soil
    const rim=new THREE.Mesh(new THREE.BoxGeometry(N*sq+1.4, 0.2, N*sq+1.4),
      lam(0x160e26));
    rim.position.set(0, 0.06, FZ); rim.userData.flat=true; group.add(rim);

    /* --- the booth ------------------------------------------------------- */
    booth=new THREE.Group();
    booth.position.set(0, 0, -hd+5.2);
    group.add(booth);
    const stage=new THREE.Mesh(new THREE.BoxGeometry(13, 1.1, 5.4), lam(0x2a1c48));
    stage.position.y=0.55; booth.add(stage);
    b.solids.push({ x1:-6.5, x2:6.5, z1:-hd+2.5, z2:-hd+7.9, y1:0, y2:1.1 });
    const desk=new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.9, 2.2), lam(0x120c22));
    desk.position.set(0, 1.55, 0.5); booth.add(desk);
    // two platters and a mixer between them: the shape everybody recognises
    [-2.9, 2.9].forEach((x,i)=>{
      const plate=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,0.16,24),
        new THREE.MeshBasicMaterial({color:i?0x8ff0ff:0xff6ad5}));
      plate.position.set(x, 2.06, 0.5); booth.add(plate);
      const spindle=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.3,8),
        new THREE.MeshBasicMaterial({color:0xeef3ff}));
      spindle.position.set(x, 2.2, 0.5); booth.add(spindle);
      plate.userData.spin=i?-2.4:2.4;                    // they counter-rotate
    });
    const mixer=new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 1.6), lam(0x241a3d));
    mixer.position.set(0, 2.06, 0.5); booth.add(mixer);
    // and the light over the desk, which is the only warm thing in the room
    deckLight=new THREE.PointLight(0xff6ad5, 42, 22, 1.7);
    deckLight.position.set(0, 4.4, -hd+5.2); group.add(deckLight);

    /* --- the stacks, the truss and the beams ----------------------------- */
    [-hw+4.2, hw-4.2].forEach(x=>{
      const box=new THREE.Mesh(new THREE.BoxGeometry(3.2, 7.2, 2.6), lam(0x160e26));
      box.position.set(x, 3.6, -hd+6); group.add(box);
      b.solids.push({ x1:x-1.6, x2:x+1.6, z1:-hd+4.7, z2:-hd+7.3, y1:0, y2:7.2 });
      [1.6, 3.4, 5.2].forEach(y=>{
        const cone=new THREE.Mesh(new THREE.CircleGeometry(0.95, 18),
          new THREE.MeshBasicMaterial({color:0x0d0818}));
        cone.position.set(x, y, -hd+7.32); group.add(cone);
      });
    });
    const truss=new THREE.Mesh(new THREE.BoxGeometry(N*sq+4, 0.3, 0.3), lam(0x3a2a5e));
    truss.position.set(0, b.h-1.6, FZ); group.add(truss);

    /* Four beams, hung off the truss, sweeping. A cone with an additive
       material and no depth write is a shaft of light for the price of one
       transparent mesh — and open at the bottom, so it does not read as a
       solid the moment somebody dances through it. */
    beams=[];
    [-6.6,-2.2,2.2,6.6].forEach((x,i)=>{
      const h=b.h-2.4;
      /* NARROW AND FAINT. Four additive cones two and a half metres wide,
         all overlapping over the same eight-metre floor, add up to white —
         which is a fog machine in daylight, not four beams. Half the width
         and a third of the opacity keeps them separable, and separable is
         the whole point: one beam per track, so you can see which voice you
         just turned on. */
      const cone=new THREE.Mesh(new THREE.ConeGeometry(1.35, h, 14, 1, true),
        new THREE.MeshBasicMaterial({ transparent:true, opacity:0.05,
          depthWrite:false, side:THREE.DoubleSide,
          blending:THREE.AdditiveBlending }));
      cone.material.color.set(TRACKS[i].c);
      cone.position.set(x, b.h-1.7-h/2, FZ);
      cone.userData.sky=true;
      const pivot=new THREE.Group();
      pivot.position.set(x, b.h-1.7, FZ);
      cone.position.set(0, -h/2, 0);
      pivot.add(cone); group.add(pivot);
      beams.push({ pivot, cone, i, phase:i*1.7 });
    });

    /* --- somebody already playing ---------------------------------------- */
    /* AN EMPTY BOOTH IS A CLOSED CLUB. The decks are yours the moment you
       press E, but until somebody does, a set is coming out of a room with
       nobody in it. So there is a resident, and when you take over she does
       not leave — you play alongside her, which is a thing DJs actually do
       and saves inventing a way for a character to walk off a stage. */
    dj={ holder:new THREE.Group(), model:null, bones:null, phase:0.8 };
    dj.holder.position.set(-0.2, 1.29, -hd+4.4);
    group.add(dj.holder);
    /* She used to be a kit character, chosen because the hands-on-the-decks
       pose is built out of six named bones and only the kit has them. With
       the kit gone she is whichever of the two the player is not, and the
       pose has to come from the clip she does have — so if there are no
       bones to reach for, she dances instead of standing in her bind pose,
       which is what "no bones and no clip" looked like. */
    if(window.AVATAR) AVATAR.load(AVATAR.other()).then(root=>{
      if(!on || !dj || !dj.holder.parent) return;
      dj.holder.add(root); dj.model=root;
      dj.bones=bonesOf(root);
      const rig=root.userData && root.userData.rig;
      dj.real=!!(rig && rig.has('dance')) && !dj.bones.armL;
    }).catch(()=>{});

    /* --- the way in ------------------------------------------------------ */
    /* Beside the booth rather than in front of it: a console standing in the
       middle of the stage is a console standing in front of the decks it is
       telling you about. */
    const p=api.panel(g, b, 7.6, -hd+7.6, '\u{1F3B9}',
      say('THE DECKS')+'\n'+say('play the set'), 'decks', '#3a1436', 0.72, -0.5);
    panelFace = p && p.userData ? p.userData.glow : null;

    crowd(b, hw, hd, FZ, half);
  }

  /* The six things a kit character can move, and where they started. Every
     pose below is an OFFSET from the rest, so nothing here has to know what
     any particular model's arms hang at. */
  function bonesOf(root){
    const b={
      torso: root.getObjectByName('torso'),
      armL:  root.getObjectByName('arm-left'),
      armR:  root.getObjectByName('arm-right'),
      head:  root.getObjectByName('head'),
      legL:  root.getObjectByName('leg-left'),
      legR:  root.getObjectByName('leg-right')
    };
    for(const k in b){ const o=b[k]; if(o) o.userData.rest=o.rotation.clone(); }
    return b;
  }

  /* --------------------------------------------------------- the dancers */
  function crowd(b, hw, hd, FZ, half){
    dancers=[];
    if(!window.AVATAR) return;
    for(let i=0;i<DANCERS;i++){
      /* Round the floor, not on a grid. A ring with the radius jittered
         leaves the middle open — which is where the light lands and where a
         player who walks in has somewhere to stand. */
      const a=(i/DANCERS)*Math.PI*2 + Math.random()*0.4;
      const r=half*(0.42+Math.random()*0.5);
      const x=Math.cos(a)*r, z=FZ+Math.sin(a)*r*0.86;
      const holder=new THREE.Group();
      holder.position.set(x, 0.19, z);
      // they face roughly at the booth, give or take somebody's own business
      holder.rotation.y=Math.atan2(x-0, z-(-hd+5.2)) + Math.PI + (Math.random()-0.5)*0.7;
      group.add(holder);
      const d={ holder, model:null, rig:null, real:false, bones:null,
                phase:Math.random()*Math.PI*2,
                style:(Math.random()*3)|0,
                lift:0.9+Math.random()*0.5 };
      dancers.push(d);
      AVATAR.load(CAST[i%CAST.length]).then(root=>{
        if(!on || !holder.parent) return;
        holder.add(root);
        d.model=root;
        const rig=root.userData && root.userData.rig;
        d.real=!!(rig && rig.has('dance'));
        /* No dance clip, six named bones. Hold whatever the bind pose is and
           move the bones by hand — a kit character with its arms up and its
           hips going is dancing as far as anybody in a dark room is
           concerned. */
        if(!d.real) d.bones=bonesOf(root);
      }).catch(()=>{});
    }
  }

  /* ------------------------------------------------------------- the beat
     Everything the room does is a function of two numbers: how far through
     the current beat we are, and how loud the pattern is. */
  let t0=0, look=0, near=0;
  function tick(dt, howNear){
    if(!on) return;
    t0+=dt;
    /* Eased, not snapped: walking through the door should sound like walking
       through a door. */
    const want=(howNear===undefined) ? 1 : howNear;
    near += (want-near)*Math.min(1, dt*3.5);
    /* The transport only runs while somebody can hear it. A scheduler
       booking sixteen notes a bar into a silent gain for the whole time
       you are on the planet is a scheduler burning a school laptop's
       battery on a room you are not in. */
    if(near>0.02 && !timer) startAudio();
    else if(near<=0.02 && timer) stopAudio();
    density(dt);

    /* Where we are between one beat and the next, from the AUDIO clock when
       there is one — a beat drawn off requestAnimationFrame and heard off
       the sample clock drift apart within seconds, and a floor that flashes
       just after the kick is worse than a floor that does not flash. */
    let ph;
    if(ac && timer){
      ph=(ac.currentTime-beatAt)/(stepSecs()*4);
      ph=Math.max(0, Math.min(1, ph));
    } else {
      look += dt*(bpm/60);
      ph=look%1;
    }
    const punch=Math.pow(1-ph, 2.2);                 // a hit that decays
    const since=t0-dropAt;
    const dropHit=Math.max(0, 1-since/2.2);          // and the drop, fading

    /* THE MUTE BUTTON IS THE MUTE BUTTON. Read live, every frame, so a
       teacher pressing it mid-set gets silence on the next frame and not
       when the current note finishes. The floor keeps dancing: the room is
       still doing what the pattern says, you just cannot hear it. */
    if(master) master.gain.value =
      (window.MUSIC && MUSIC.muted) ? 0 : 0.30*(0.55+0.45*energy)*near;
    if(lp) lp.frequency.value = 240 + filter*filter*17000;

    floor(ph, punch, dropHit);
    lights(dt, punch, dropHit);
    steps(dt, punch, dropHit);
    if(playing) paint();
  }

  /* SHE IS WORKING, not dancing. Everybody on the floor has their arms in
     the air; the person behind the decks has one hand down on a platter and
     the other on the mixer, and nods. That difference is the only thing
     that says which of the twelve people in this room is running it. */
  function resident(dt, punch, dropHit){
    if(!dj || !dj.model) return;
    /* No bones to pose, but a dance to play. She is behind the decks rather
       than on the floor, so she is slowed down and does not jump — a
       resident bouncing as hard as the crowd is a resident who has stopped
       running the room. */
    if(dj.real && window.AVATAR){
      AVATAR.animate(dj.model, dt*(0.55+0.45*energy), 'dance');
      dj.holder.position.y = 1.29 + dropHit*Math.abs(Math.sin(t0*7))*0.22;
      return;
    }
    if(!dj.bones) return;
    const bn=dj.bones;
    const ph=t0*(0.5+0.75*energy)*Math.PI*2*0.9 + dj.phase;
    const rest=o=>o && o.userData.rest;
    dj.holder.position.y = 1.29 + Math.abs(Math.sin(ph))*0.06*(0.5+energy)
                         + dropHit*Math.abs(Math.sin(t0*7))*0.30;
    if(rest(bn.armL) && rest(bn.armR)){
      const l=bn.armL.userData.rest, r=bn.armR.userData.rest;
      /* On the drop both hands come up, because that is the one moment a DJ
         is not touching anything. */
      if(dropHit>0.15){
        const u=2.1+Math.sin(t0*9)*0.35;
        bn.armL.rotation.set(l.x, l.y, l.z+u);
        bn.armR.rotation.set(r.x, r.y, r.z-u);
      } else {
        bn.armL.rotation.set(l.x-1.15+Math.sin(ph)*0.12, l.y, l.z+0.34);
        bn.armR.rotation.set(r.x-1.05+Math.sin(ph*2)*0.20, r.y, r.z-0.30);
      }
    }
    if(rest(bn.head)){
      const h=bn.head.userData.rest;
      bn.head.rotation.set(h.x+punch*0.30*(0.4+energy), h.y+Math.sin(ph*0.4)*0.18, h.z);
    }
    if(rest(bn.torso)){
      const tr=bn.torso.userData.rest;
      bn.torso.rotation.set(tr.x+Math.sin(ph*2)*0.06, tr.y+Math.sin(ph)*0.10, tr.z);
    }
  }

  /* How loud the pattern is, 0..1, smoothed so a single tap does not slam
     the whole room. Voices are not equal: a kick carries the floor and a
     hat decorates it, so they are weighted the way they are heard. */
  const WEIGHT=[0.42, 0.22, 0.12, 0.24];
  function density(dt){
    let want=0;
    TRACKS.forEach((tr,r)=>{
      let n=0; for(let i=0;i<STEPS;i++) n+=pat[r][i];
      want += WEIGHT[r]*Math.min(1, n/5);
    });
    /* Per SECOND, not per frame. A fixed fraction each frame settles twice
       as slowly on a machine drawing thirty as on one drawing sixty, which
       means the room reacts to the same tap at two different speeds
       depending on the laptop. */
    energy += (want-energy)*(1-Math.pow(0.02, Math.min(dt,0.1)));
  }

  function floor(ph, punch, dropHit){
    if(!tiles) return;
    const N=8;
    for(let i=0;i<N*N;i++){
      const cx=(i%N)-3.5, cz=((i/N)|0)-3.5;
      const rad=Math.hypot(cx,cz)/5;
      /* A ring travelling out from the middle on every beat, which is the
         one pattern that reads as "the floor is doing this because of the
         music" rather than as tiles blinking. */
      const wave=Math.max(0, 1-Math.abs(rad-ph*1.25)*3.4);
      const base=0.035+0.06*energy;
      const lit=base + wave*(0.20+0.26*energy) + punch*0.05*energy + dropHit*0.34;
      /* The drop does NOT change the colour. Shifting the hue on top of the
         brightness turned the floor lime for two seconds — a different room,
         not the same room hit harder. It gets brighter and it strobes; that
         is what a drop is. */
      /* A DRIFT, NOT A CYCLE. At 0.03 a second the floor went right round
         the wheel in half a minute — through the greens and yellows, which
         is a different room rather than the same room later. A twentieth of
         that stays in the violets it is lit by. */
      const hue=(0.86 - rad*0.22 + t0*0.0015) % 1;
      /* Capped WELL below white. A dance floor is the brightest thing in the
         room and still the darkest thing in the game — every value above
         about a half comes back as a pastel once the tone mapping has had
         it, and eight rows of pastel is a bathroom. */
      tileCol.setHSL((hue+1)%1, 0.92, Math.min(0.46, lit));
      tiles.setColorAt(i, tileCol);
    }
    if(tiles.instanceColor) tiles.instanceColor.needsUpdate=true;
  }

  function lights(dt, punch, dropHit){
    beams.forEach(bm=>{
      /* Sweeping, and each one on its own phase — four beams locked
         together is one wide beam. On the drop they stop sweeping and
         strobe, because that is what the moment is. */
      const sw=dropHit>0.05 ? 0 : 1;
      bm.pivot.rotation.z=Math.sin(t0*0.9+bm.phase)*0.55*sw;
      bm.pivot.rotation.x=Math.cos(t0*0.7+bm.phase)*0.30*sw;
      const live=pat[bm.i].some(v=>v);
      const strobe=dropHit>0.05 ? (Math.sin(t0*38)>0 ? 1 : 0.1) : 1;
      bm.cone.material.opacity =
        (live ? 0.045+0.075*punch*(0.4+energy) : 0.010) * strobe + dropHit*0.05;
    });
    if(deckLight) deckLight.intensity = 34 + 30*punch*energy + 90*dropHit;
  }

  function steps(dt, punch, dropHit){
    if(booth) booth.children.forEach(c=>{
      if(c.userData.spin) c.rotation.y += c.userData.spin*dt;
    });
    resident(dt, punch, dropHit);
    dancers.forEach(d=>{
      if(!d.model) return;
      const sp=0.55+0.9*energy;
      const beat=punch*(0.55+0.75*energy)*d.lift;
      if(d.real && window.AVATAR){
        /* The two who can actually dance do. The clip carries its own
           timing, so all this adds is a hop on the drop. */
        AVATAR.animate(d.model, dt*(0.75+0.6*energy), 'dance');
        d.holder.position.y = 0.19 + dropHit*Math.abs(Math.sin(t0*7))*0.55;
        return;
      }
      /* NO CLIP AT ALL for these. `idle` animates the same six bones this is
         about to write to, and a mixer running underneath overwrites every
         one of them on the next update — the arms went up and came straight
         back down, sixty times a second, which reads as nothing happening.
         Nothing plays, so the bind pose stands still and this is the only
         thing moving it. */
      const bn=d.bones; if(!bn) return;
      const ph=t0*sp*Math.PI*2*0.9 + d.phase;
      const bob=Math.abs(Math.sin(ph))*0.16*(0.5+energy);
      d.holder.position.y = 0.19 + bob + dropHit*Math.abs(Math.sin(t0*7))*0.5;
      d.holder.rotation.z = Math.sin(ph*0.5)*0.07*(0.3+energy);
      const rest=o=>o && o.userData.rest;
      /* Three ways to dance, so ten people are not one person copied. Arms
         up, arms out, or hands going — and the legs step under all three. */
      if(bn.armL && rest(bn.armL)){
        const a=bn.armL.userData.rest, bR=bn.armR.userData.rest;
        if(d.style===0){                                   // both hands up
          const u=2.2+Math.sin(ph)*0.5*(0.3+energy);
          bn.armL.rotation.set(a.x, a.y, a.z+u);
          bn.armR.rotation.set(bR.x, bR.y, bR.z-u);
        } else if(d.style===1){                            // out, and swinging
          const u=0.9+Math.sin(ph)*0.7;
          bn.armL.rotation.set(a.x-Math.sin(ph)*0.8, a.y, a.z+u);
          bn.armR.rotation.set(bR.x+Math.sin(ph)*0.8, bR.y, bR.z-u);
        } else {                                           // pumping, off-beat
          const u=Math.sin(ph*2)*1.1;
          bn.armL.rotation.set(a.x+u, a.y, a.z+1.5);
          bn.armR.rotation.set(bR.x-u, bR.y, bR.z-1.5);
        }
      }
      if(bn.torso && rest(bn.torso)){
        const r=bn.torso.userData.rest;
        bn.torso.rotation.set(r.x+Math.sin(ph*2)*0.10, r.y+Math.sin(ph)*0.22, r.z);
      }
      if(bn.head && rest(bn.head)){
        const r=bn.head.userData.rest;
        bn.head.rotation.set(r.x+beat*0.22, r.y+Math.sin(ph*0.5)*0.25, r.z);
      }
      if(bn.legL && rest(bn.legL)){
        const l=bn.legL.userData.rest, rr=bn.legR.userData.rest;
        const k=Math.sin(ph)*0.45*(0.3+energy);
        bn.legL.rotation.set(l.x+k, l.y, l.z);
        bn.legR.rotation.set(rr.x-k, rr.y, rr.z);
      }
    });
  }

  /* ------------------------------------------------------- taking the decks */
  function take(){
    if(!on || playing) return;         // E at the decks twice is still one set
    /* The mouse is the instrument here. It is captured for looking around
       the moment you click the world, and a grid you cannot click is not a
       grid — so it is handed back, the same way the Code Console takes it. */
    if(document.pointerLockElement) document.exitPointerLock();
    startAudio();
    playing=true;
    build();
    const el=document.querySelector('#deck');
    if(el) el.classList.remove('hidden');
    const hint=document.querySelector('#escHint');
    if(hint) hint.classList.add('hidden');
    paint();
  }
  function leaveDecks(){
    playing=false;
    const el=document.querySelector('#deck');
    if(el) el.classList.add('hidden');
    const hint=document.querySelector('#escHint');
    if(hint) hint.classList.remove('hidden');
  }

  let cur={ r:0, c:0 };
  function build(){
    const el=document.querySelector('#deck'); if(!el) return;
    el.innerHTML=`
      <div class="dk-head">
        <b>\u{1F3A7} ${say('THE LOOP')}</b>
        <span class="dk-bpm">
          <button class="dk-b" id="dkSlow">−</button>
          <i id="dkBpm">124</i><small>BPM</small>
          <button class="dk-b" id="dkFast">+</button>
        </span>
        <button class="btn small ghost" id="dkOut">${say('step away')}</button>
      </div>
      <div class="dk-grid" id="dkGrid"></div>
      <div class="dk-foot">
        <label class="dk-flt">${say('FILTER')}
          <input type="range" id="dkFilter" min="0" max="100" value="100"></label>
        <div class="dk-crowd"><span>${say('THE FLOOR')}</span>
          <i><b id="dkMeter"></b></i></div>
        <button class="btn good" id="dkDrop">${say('DROP')} <kbd>D</kbd></button>
      </div>
      <div class="dk-tip">${say('Click a square, or <b>1-4</b> pick a row, <b>← →</b> move, <b>space</b> toggle. Every sixteen steps it comes round again — that is the loop.')}</div>`;

    const grid=el.querySelector('#dkGrid');
    grid.innerHTML=TRACKS.map((tr,r)=>
      `<div class="dk-name" style="--c:${tr.c}">${say(tr.name)}</div>` +
      pat[r].map((v,c)=>
        `<button class="dk-cell${v?' on':''}" data-r="${r}" data-c="${c}"
                 style="--c:${tr.c}"></button>`).join('')
    ).join('');
    grid.querySelectorAll('.dk-cell').forEach(btn=>{
      btn.onclick=()=>{
        const r=+btn.dataset.r, c=+btn.dataset.c;
        pat[r][c]=pat[r][c]?0:1;
        cur={r,c};
        wake(); paint();
      };
    });
    el.querySelector('#dkOut').onclick=leaveDecks;
    el.querySelector('#dkDrop').onclick=drop;
    el.querySelector('#dkSlow').onclick=()=>setBpm(bpm-4);
    el.querySelector('#dkFast').onclick=()=>setBpm(bpm+4);
    el.querySelector('#dkFilter').oninput=e=>{ filter=(+e.target.value)/100; wake(); };
  }
  function setBpm(v){ bpm=Math.max(88, Math.min(160, v)); paint(); }
  function drop(){ dropAt=t0; wake(); }

  /* The playhead is the only thing redrawn at frame rate, and it is one
     class on one column — rewriting sixty-four buttons sixty times a second
     to move a highlight is how a grid becomes a stutter. */
  let litCol=-1;
  function paint(){
    const el=document.querySelector('#deck'); if(!el) return;
    const b=el.querySelector('#dkBpm'); if(b) b.textContent=bpm;
    const m=el.querySelector('#dkMeter');
    /* The weights add to one, so energy IS the percentage. It used to be
       multiplied by 1.6 "to fill the bar", which filled the bar — the meter
       read 100% from the moment you walked in and never moved again. */
    if(m) m.style.width=Math.round(Math.max(0,Math.min(1,energy))*100)+'%';
    if(step!==litCol){
      el.querySelectorAll('.dk-cell.at').forEach(n=>n.classList.remove('at'));
      el.querySelectorAll(`.dk-cell[data-c="${step}"]`).forEach(n=>n.classList.add('at'));
      litCol=step;
    }
    el.querySelectorAll('.dk-cell').forEach(n=>{
      const r=+n.dataset.r, c=+n.dataset.c;
      n.classList.toggle('on', !!pat[r][c]);
      n.classList.toggle('cur', r===cur.r && c===cur.c);
    });
  }

  /* Keys, for the same reason every other panel in this game has them: a
     mouse is a slow instrument and this one is meant to be played. */
  function key(e){
    if(!playing) return false;
    wake();
    const k=e.code;
    if(k==='Escape'){ leaveDecks(); return true; }
    if(k>='Digit1' && k<='Digit4'){ cur.r=+k.slice(5)-1; paint(); return true; }
    if(k==='ArrowLeft'){  cur.c=(cur.c+STEPS-1)%STEPS; paint(); return true; }
    if(k==='ArrowRight'){ cur.c=(cur.c+1)%STEPS; paint(); return true; }
    if(k==='ArrowUp'){    cur.r=(cur.r+TRACKS.length-1)%TRACKS.length; paint(); return true; }
    if(k==='ArrowDown'){  cur.r=(cur.r+1)%TRACKS.length; paint(); return true; }
    if(k==='Space'){ pat[cur.r][cur.c]=pat[cur.r][cur.c]?0:1; paint(); return true; }
    if(k==='KeyD'){ drop(); return true; }
    if(k==='KeyF'){ filter=filter>0.5?0.22:1;
                    const f=document.querySelector('#dkFilter');
                    if(f) f.value=Math.round(filter*100);
                    return true; }
    if(k==='BracketLeft'){  setBpm(bpm-4); return true; }
    if(k==='BracketRight'){ setBpm(bpm+4); return true; }
    return false;
  }

  function stop(){
    leaveDecks();
    stopAudio();
    on=false; near=0; group=null; tiles=null; beams=[]; dancers=[]; booth=null; dj=null;
    bldg=null; deckLight=null; panelFace=null; litCol=-1;
  }

  return { room, tick, take, key, stop,
           /* Whether it is SOUNDING, which is not whether it was asked to.
              A browser that refuses audio refuses it silently — same reason
              MUSIC answers this question. */
           get sounding(){ return !!(ac && ac.state==='running' && timer
                                     && master && master.gain.value>0.001); },
           get playing(){ return playing; },
           get active(){ return on; },
           get energy(){ return energy; },
           TRACKS, STEPS };
})();
