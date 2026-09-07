/* =====================================================================
   MECH LEAGUE — the arena, and everything that happens round it.

   The rules of a fight are in mechsim.js and the language is the same
   console every other mission uses. This file is only the part you can
   see: a 10 x 10 floor in the middle of nowhere, two machines standing
   on it, and the ability to stop the fight and walk through it a turn at
   a time afterwards.

   THE LOOP THIS MODE EXISTS FOR:

     pick a mech → write a program → deploy → watch → read the log →
     find the turn it went wrong → change one block → fight again

   Nobody drives anything. There is no aiming, no reflex, no button to
   press quickly. Every single thing that happens on that floor happened
   because of a block somebody chose, which is the only reason a fight
   is worth arguing about afterwards.

   THE MATCH IS DECIDED BEFORE ANY OF THIS RUNS. simulate() returns the
   whole battle — every turn, every position, every number — and what
   follows is playback of a result that is already fixed. That is not a
   shortcut; it is what makes the scrubber, the step-backwards button and
   (later) a server that judges the match able to exist at all.
   ===================================================================== */
window.MECH = (function(){
  const $ = s => document.querySelector(s);
  const TILE = 4;                       // world units per grid square
  const SIDE_A='#8fd3ff', SIDE_B='#ff9aa2';   // you, and whoever you are fighting
  const TURN_MS = 520;                  // how long one turn takes to watch
  const EYE = 1.7;

  let on=false, phase='off';
  let A=null;                           // the arena, read
  let match=null;                       // what simulate() gave back
  let world=null, mechMesh=[], crateMesh=[], fx=[];
  let idx=0, playing=false, acc=0, speed=1;
  let you=null, foe=null;               // the two sides of this match
  /* WHICH SIDE YOU ARE. Against the league you are always A. Against
     another student you are whichever mark the server gave you, and that
     is not cosmetic: both browsers have to replay the fight with the sides
     in the order the referee ran them, or the two of them are watching
     different battles. So the frames stay in A,B order everywhere and this
     is the only thing that says which of them is yours. */
  let pvp=false, mySide='A';
  const mine  = ()=> mySide==='A' ? 0 : 1;
  const other = ()=> mySide==='A' ? 1 : 0;
  let orbit=0, orbitH=1;
  /* Nobody is holding anything here. The blaster and the crosshair belong to
     a person standing in a room, and there is no person in this room — so
     they go away on the way in and come back on the way out, exactly the way
     the flight deck puts them away. */
  let wasFP=null;

  /* ------------------------------------------------------- the league
     Four opponents, in order. Each is a mech, a map and a program — and
     the program is the difficulty: nothing about the arena is tuned to
     make a fight easier, the other side just has fewer good ideas.

     Reading them is half the lesson. LOOPER shoots at nothing forever;
     the way to beat it is not to be in front of it. SENTRY never moves,
     so it has to be approached from a side it is not facing. */
  const bk = (()=>{ let n=1000; return (type,extra)=>Object.assign({id:n++,type},extra||{}); })();
  const rep = (n,body)=>bk('repeat',{count:n,body});
  const iff = (c,body)=>bk('ifc',{cond:c,body});
  const until=(c,body)=>bk('until',{cond:c,body});

  const LEAGUE=[
    { id:'dummy', name:'TIN CAN', em:'\u{1F916}', a:'#bdb2d8', chassis:'striker',
      arena:'training', tag:'Round 1',
      blurb:'It walks forward and it never looks up. Anything at all beats it.',
      teach:'Get in front of it and shoot.',
      program:[ bk('forward') ] },

    { id:'looper', name:'THE LOOPER', em:'\u{1F504}', a:'#a8e6cf', chassis:'striker',
      arena:'training', tag:'Round 2',
      blurb:'Spins on the spot and fires. Deadly in front of it, useless everywhere else.',
      teach:'A loop of your own, and a test before you shoot.',
      program:[ rep(4,[ bk('shoot'), bk('right') ]) ] },

    { id:'sentry', name:'SENTRY', em:'\u{1F6E1}', a:'#8fd3ff', chassis:'defender',
      arena:'ruins', tag:'Round 3',
      blurb:'Never moves. Shields when you are close and shoots when you are in front.',
      teach:'Cover, and coming at it from a side it is not watching.',
      program:[ iff('enemy ahead',[ bk('shoot') ]),
                iff('enemy nearby',[ bk('shield') ]),
                bk('right') ] },

    { id:'hunter', name:'THE HUNTER', em:'\u{1F441}', a:'#ffd8a8', chassis:'scout',
      arena:'maze', tag:'Round 4',
      blurb:'Comes looking. Fast, fragile, and it tests before it does anything.',
      teach:'Everything at once — sensors, a loop, and where you stand.',
      program:[ iff('enemy ahead',[ bk('shoot') ]),
                iff('wall ahead',[ bk('right') ]),
                until('enemy detected',[ bk('forward') ]),
                bk('forward') ] }
  ];

  /* what a student starts with, and what the console will be set to */
  const PAL=['forward','back','left','right','shoot','shield','dash','repeat','ifc','until'];
  const DEFAULT_RULES={ blockLimit:20 };

  /* ------------------------------------------------------------ saving
     A program survives leaving the arena, because rewriting it from
     scratch is not the lesson. One slot per opponent: the answer to the
     Hunter is not the answer to the Sentry, and being handed the wrong
     one back is worse than being handed nothing. */
  const slot = id => 'dq_mech_'+id;
  function loadProgram(id){
    try{ const raw=JSON.parse(localStorage.getItem(slot(id))||'null');
         return Array.isArray(raw) ? raw : null; }catch(e){ return null; }
  }
  function saveProgram(id, tree){
    try{ localStorage.setItem(slot(id), JSON.stringify(tree||[])); }catch(e){}
  }

  /* ------------------------------------------------------------- the Gym
     Fighting a classmate is the same arena, the same console and the same
     referee. Three things are different, and only three: the opponent is
     not known when you write your program, the fight is decided by the
     server rather than here, and the floor is fixed in advance.

     THE FLOOR IS FIXED so it can be trained for. A map drawn after both
     programs are in would make every program a guess, and it is chosen
     for being symmetric — turn that board half a circle and it is itself
     with the two marks swapped, so neither side is handed the better
     start. Whoever deploys first is A; on this floor that is a fact both
     replays must agree on rather than an advantage. */
  const GYM_ARENA='energy';
  function stranger(){
    return { id:'pvp', tag:'THE GYM', name:t('A CLASSMATE'), em:'\u{1F464}',
             a:SIDE_B, chassis:'striker', arena:GYM_ARENA, program:[],
             teach:'somebody else’s program',
             blurb:'Whoever deploys next. You do not get to see their program first.' };
  }

  /* ==================================================== the setup screen */
  let opponent=null, chassis='striker';
  function start(opts){
    stop();
    on=true; phase='setup';
    pvp=!!(opts && opts.pvp); mySide='A';
    G.running=false;
    if(window.CHARS) CHARS.heroClose();
    $('#hud').classList.add('hidden');
    /* A teaching card left up from another mission freezes the world —
       frozen() counts it — so the arena would build and then never tick. */
    $('#teach').classList.add('hidden');
    $('#done').classList.add('hidden');
    if(document.pointerLockElement) document.exitPointerLock();
    if(pvp){ opponent=stranger(); pickChassis(); }
    else pickOpponent();
  }
  function pickOpponent(){
    phase='setup';
    $('#mkTitle').textContent=t('THE MECH LEAGUE');
    $('#mkSub').innerHTML=t('Program a machine and send it in without you. '+
      'You cannot help it once it is out there — whatever you wrote is what it does.');
    const grid=$('#mkGrid'); grid.innerHTML='';
    LEAGUE.forEach(o=>{
      const b=document.createElement('button');
      const beat=won(o.id);
      b.className='mis'+(beat?' solved':'');
      b.style.setProperty('--a', o.a);
      b.innerHTML=`<div class="mno">${t(o.tag)}</div>
        <div class="em">${o.em}</div><b>${t(o.name)}</b>
        <div><span class="teach">${t(o.teach)}</span></div>
        <small>${t(o.blurb)}</small>
        <div class="mk-pick"><span>${t('Arena')}: <b>${t(MECHSIM.arenaById(o.arena).name)}</b></span>
          <span>${t('Mech')}: <b>${t(MECHSIM.CHASSIS[o.chassis].name)}</b></span></div>
        <div class="tagrow">${beat? t('BEATEN — FIGHT AGAIN ▶') : t('FIGHT ▶')}</div>`;
      b.onclick=()=>{ opponent=o; pickChassis(); };
      grid.appendChild(b);
    });
    $('#mkBack').onclick=()=>{ stop(); MENU.homeworld(); };
    showSetup();
  }
  function pickChassis(){
    phase='setup';
    $('#mkTitle').textContent=t('PICK YOUR MECH');
    $('#mkSub').innerHTML = pvp
      ? t('Four frames, five numbers each. You are fighting another student on '+
          '{a} — and you will not know which frame they picked until you are both '+
          'standing on it.',{a:t(MECHSIM.arenaById(GYM_ARENA).name)})
      : t('Four frames, five numbers each. None of them is the best one — '+
          'the right one depends on the program you are going to write.');
    const grid=$('#mkGrid'); grid.innerHTML='';
    Object.keys(MECHSIM.CHASSIS).forEach(id=>{
      const c=MECHSIM.CHASSIS[id];
      const b=document.createElement('button');
      b.className='mis'+(chassis===id?' solved':'');
      b.style.setProperty('--a', c.a);
      b.innerHTML=`<div class="em">${c.em}</div><b>${t(c.name)}</b>
        <small>${t(c.blurb)}</small>
        <div class="mk-pick">
          <span>❤ <b>${c.hp}</b></span><span>⚡ <b>${c.energy}</b></span>
          <span>${t('armour')} <b>${c.armour}</b></span>
          <span>${t('hit')} <b>${c.attack}</b></span>
          <span>${t('range')} <b>${c.range}</b></span>
          <span>${t('speed')} <b>${c.move}</b></span>
          <span>${t('sensor')} <b>${c.sensor}</b></span></div>
        <div class="tagrow">${t('DEPLOY THIS ▶')}</div>`;
      b.onclick=()=>{ chassis=id; enterArena(); };
      grid.appendChild(b);
    });
    // in the Gym there is no opponent list behind this, only the way out
    $('#mkBack').onclick = pvp ? ()=>{ stop(); MENU.homeworld(); } : ()=>pickOpponent();
    showSetup();
  }
  function showSetup(){
    if(window.MENU) MENU.hideAll();
    $('#mkSetup').classList.remove('hidden');
    $('#mech').classList.add('hidden');
  }
  const won = id => !!(window.PROGRESS && PROGRESS.get('mech_'+id, false));

  /* ================================================== building the world */
  function enterArena(){
    if(window.MENU) MENU.hideAll();
    $('#mkSetup').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    $('#mech').classList.remove('hidden');
    G.running=true;
    G.hudOwner='mech'; G.missionId='mech'; G.room=null;
    if(window.updateLeaveBtn) updateLeaveBtn();
    $('#mapwrap').classList.add('hidden');
    $('#health').classList.add('hidden');
    $('#skill').classList.add('hidden');
    $('#trigger').classList.add('hidden');
    $('#objectives').classList.add('hidden');
    if(window.AVATAR) AVATAR.detach();
    if(wasFP===null) wasFP=!!G.firstPerson;
    G.firstPerson=false;
    if(window.GUN) GUN.update(0,false);
    $('#crosshair').classList.add('hidden');
    $('#focus').classList.add('hidden');
    /* Empty, it is still a white box sitting over the floor. It comes back
       the moment something actually has to be said. */
    $('#briefing').classList.add('hidden');
    if(window.keyHint) keyHint(
      `<b>C</b> ${t('write your program')} &nbsp; <b>${t('RUN')}</b> ${t('deploys it')}<br>
       <b>←→</b> ${t('turn the camera')} &nbsp; <b>Space</b> ${t('play / pause the replay')}`);

    A=MECHSIM.readArena(MECHSIM.arenaById(opponent.arena));
    build();
    match=null; idx=0; playing=false;
    phase='program';
    show(0);                       // both machines on their marks, before a shot
    paintTop(null);
    $('#mkLog').classList.add('hidden');
    $('#mkBar').classList.add('hidden');
    console_();
  }

  /* the floor, the walls, the crates and the two machines */
  function build(){
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.ceiling=null; G.ground=()=>0;
    world=G.roomGroup;
    G.scene.background=new THREE.Color(0x1a1430);
    G.scene.fog=new THREE.Fog(0x1a1430, 70, 230);

    const w=A.w, h=A.h;
    const base=new THREE.Mesh(new THREE.BoxGeometry(w*TILE+3, 1, h*TILE+3),
      new THREE.MeshLambertMaterial({color:0x2e2547}));
    base.position.y=-0.55; base.userData.flat=true; world.add(base);

    /* One plate per square, two shades in a chequer, so a student can
       count tiles off the floor. A grid you can count is the difference
       between "move forward a bit" and "move forward three". */
    const light=new THREE.MeshLambertMaterial({color:0x3b3059});
    const dark =new THREE.MeshLambertMaterial({color:0x342b50});
    const wallM=new THREE.MeshLambertMaterial({color:0x8f7fc4});
    const hazM =new THREE.MeshLambertMaterial({color:0x7a2a3a, emissive:0x3a0d18});
    const plate=new THREE.BoxGeometry(TILE*0.96, 0.4, TILE*0.96);
    for(let z=0;z<h;z++) for(let x=0;x<w;x++){
      const p=world_(x,z);
      if(A.wall[z][x]){
        const m=new THREE.Mesh(new THREE.BoxGeometry(TILE, TILE*0.9, TILE), wallM);
        m.position.set(p.x, TILE*0.45, p.z); world.add(m);
        continue;
      }
      const m=new THREE.Mesh(plate, A.hazard[z][x] ? hazM : ((x+z)%2 ? light : dark));
      m.position.set(p.x, -0.2, p.z); m.userData.flat=true; world.add(m);
      if(A.hazard[z][x]) m.position.y=-0.16;
    }

    crateMesh=A.crates.map(c=>{
      const g=new THREE.Group();
      const m=new THREE.Mesh(new THREE.BoxGeometry(1.3,1.3,1.3),
        new THREE.MeshLambertMaterial({color:0xffe9a8, emissive:0x4a3c10}));
      g.add(m);
      const p=world_(c.x,c.z); g.position.set(p.x, 1.2, p.z);
      world.add(g);
      return g;
    });

    /* THE SIDES ARE ALWAYS THE SAME TWO COLOURS. Tinting the enemy with
       its own card accent read nicely on the league screen and then put
       two sky-blue machines on the same floor the moment the opponent's
       accent happened to match yours — and "which one is mine" is the
       question the picture exists to answer. Blue is you, everywhere:
       the hull, the ring under it, the panel above it and the ▲ in the
       log. The opponent's branding stays on its card, where it cannot
       be confused with anything. */
    /* Built in A,B order, because that is the order the referee ran them
       and the order every frame is written in. Which of the two is YOURS
       is a separate question, and blue is always the answer. */
    const mineSpec={ side:mySide, chassis, name:t('YOU'), a:SIDE_A };
    const foeSpec ={ side:mySide==='A'?'B':'A', chassis:opponent.chassis,
                     name:t(opponent.name), a:SIDE_B };
    you=mineSpec; foe=foeSpec;
    const bySide=[]; bySide[mine()]=mineSpec; bySide[other()]=foeSpec;
    mechMesh=bySide.map(buildMech);
    mechMesh.forEach(m=>world.add(m));

    /* Lit so the two machines still have their colour. Ambient at .55 with
       a full-strength key washed both hulls to the same white, and which
       mech is yours is the one thing the picture has to say. */
    const key=new THREE.DirectionalLight(0xffffff, 0.72);
    key.position.set(30,60,20); world.add(key);
    world.add(new THREE.AmbientLight(0xb9a8ff, 0.32));

    orbit=Math.PI*0.25; orbitH=1;   // ↑ ↓ raise and lower it from here
    G.scene.updateMatrixWorld(true);
  }

  /* Which way a mech looks before the fight starts — the same sum the
     referee does, so the preview is not standing differently from the
     machine that is about to move. */
  function faceCentre(p){
    const dx=(A.w/2)-p.x, dz=(A.h/2)-p.z;
    return Math.abs(dx)>=Math.abs(dz) ? (dx>0?1:3) : (dz>0?2:0);
  }

  /* Grid square to world. The arena is centred on the origin, so the
     camera can orbit it without knowing how big it is. */
  function world_(x,z){
    return { x:(x-(A.w-1)/2)*TILE, z:(z-(A.h-1)/2)*TILE };
  }

  /* A machine out of boxes. Four silhouettes that read at a glance from
     above — which is the only angle anybody watches this from — because
     "why did the tank lose" needs you to know which one was the tank. */
  function buildMech(spec){
    const c=MECHSIM.CHASSIS[spec.chassis];
    const g=new THREE.Group();
    /* The HULL says whose it is and the SHAPE says what it is. That way
       round because from a camera fifty metres up you read colour before
       silhouette, and the first question watching a fight is always "which
       one is mine". */
    const lit=(hex)=>{
      const col=new THREE.Color(hex);
      /* A little of its own colour emitted as well as reflected. Without
         it every lit face goes to white under the key light and both
         machines end up the same colour from above, which is the one
         thing the picture must never do. */
      return new THREE.MeshLambertMaterial({ color:col,
        emissive:col.clone().multiplyScalar(0.30) });
    };
    const body=lit(spec.a), trim=lit(c.a);
    const box=(w,hh,d,mat)=>new THREE.Mesh(new THREE.BoxGeometry(w,hh,d), mat||body);

    const hull=box(2.0,1.2,2.4); hull.position.y=1.5; g.add(hull);
    const head=box(1.0,0.7,1.0, trim); head.position.set(0,2.5,-0.3); g.add(head);
    // the barrel points -z, which is north, which is dir 0
    const gun=box(0.35,0.35,2.2, trim); gun.position.set(0.55,1.7,-1.6); g.add(gun);

    if(spec.chassis==='tank'){
      hull.scale.set(1.35,0.85,1.1);
      gun.scale.set(1.7,1.7,1.0);
      [-1,1].forEach(s=>{ const tr=box(0.7,0.9,2.8); tr.position.set(s*1.45,0.5,0); g.add(tr); });
    } else if(spec.chassis==='scout'){
      hull.scale.set(0.75,0.9,0.9); hull.position.y=1.9;
      gun.scale.set(0.7,0.7,1.3);
      [-1,1].forEach(s=>{ const leg=box(0.3,1.6,0.3); leg.position.set(s*0.7,0.9,0); g.add(leg); });
      const ant=box(0.14,1.4,0.14, trim); ant.position.set(-0.4,3.2,-0.3); g.add(ant);
    } else if(spec.chassis==='defender'){
      const plate=box(2.6,2.0,0.4, trim); plate.position.set(0,1.6,-1.35); g.add(plate);
      [-1,1].forEach(s=>{ const leg=box(0.55,1.0,0.8); leg.position.set(s*0.9,0.55,0); g.add(leg); });
    } else {
      [-1,1].forEach(s=>{ const sh=box(0.7,0.6,1.0); sh.position.set(s*1.2,2.0,-0.2); g.add(sh); });
      [-1,1].forEach(s=>{ const leg=box(0.45,1.0,0.6); leg.position.set(s*0.6,0.55,0); g.add(leg); });
    }

    /* whose it is, said on the floor rather than on the machine — a ring
       under a mech is readable from directly overhead, a stripe is not */
    const ring=new THREE.Mesh(new THREE.RingGeometry(1.5,2.0,28),
      new THREE.MeshBasicMaterial({color:new THREE.Color(spec.a), transparent:true,
        opacity:0.75, side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2; ring.position.y=0.06; ring.userData.flat=true; g.add(ring);

    const shield=new THREE.Mesh(new THREE.SphereGeometry(2.3,20,14),
      new THREE.MeshBasicMaterial({color:0x8fd3ff, transparent:true, opacity:0.26,
        depthWrite:false}));
    shield.position.y=1.6; shield.visible=false; g.userData.shield=shield; g.add(shield);
    g.userData.spec=spec;
    return g;
  }

  /* ==================================================== the programming */
  function console_(){
    CODE.setPalette(PAL);
    CODE.setBudget(rules().blockLimit);
    CODE.setGrid(A.w, A.h);
    CODE.setConditions(MECHSIM.SENSORS.map(s=>({ id:s.id, a:s.a })), { lead:'if' });
    CODE.setGuide({
      brief: pvp && !match
        ? t('Program your mech, then press RUN to put it in the Gym. '+
            'The fight starts the moment another student deploys theirs.')
        : t('Program your mech, then press RUN to deploy it. '+
            'It runs your program over and over until somebody is destroyed.'),
      name: t(opponent.name)+' — '+t(opponent.teach),
      text: t(opponent.blurb),
      code: null });
    CODE.setAside(t('THE FIGHT'), asideHTML());
    restoreProgram();
    if(!CODE.isOpen()) CODE.show();
  }
  function rules(){ return MECHSIM.makeRules(DEFAULT_RULES); }

  /* Everything you need at your elbow while writing: the map you are
     going to fight on, what each action costs, and what your own frame
     is made of. Somebody who has to remember that shoot costs three is
     spending their attention on the wrong thing. */
  function asideHTML(){
    const R=rules(), c=MECHSIM.CHASSIS[chassis], o=MECHSIM.CHASSIS[opponent.chassis];
    /* Until somebody has deployed against you there is nothing true to say
       about their frame, and printing a plausible guess would be worse than
       printing nothing — a student would write their program against it. */
    const blind = pvp && !match;
    const cell=(x,z)=>{
      if(A.wall[z][x]) return 'w';
      if(A.hazard[z][x]) return 'h';
      if(A.crates.some(k=>k.x===x&&k.z===z)) return 'e';
      if(A.starts[0].x===x&&A.starts[0].z===z) return 'a';
      if(A.starts[1].x===x&&A.starts[1].z===z) return 'b';
      return '';
    };
    let map='';
    for(let z=0;z<A.h;z++) for(let x=0;x<A.w;x++) map+=`<i class="${cell(x,z)}"></i>`;
    const cost=k=>`<span>${k} <b>${R.cost[k]}</b>⚡</span>`;
    return `<div class="mk-prev" style="grid-template-columns:repeat(${A.w},1fr)">${map}</div>
      <div class="mk-stat" style="margin-bottom:8px">
        <b style="color:var(--sky)">■</b> ${t('you')} &nbsp;
        <b style="color:var(--peach)">■</b> ${t(opponent.name)} &nbsp;
        <b style="color:var(--star)">■</b> ${t('energy')} &nbsp;
        <b style="color:var(--bad)">■</b> ${t('hazard')}</div>
      <div class="mk-cost">${['forward','back','shoot','shield','dash'].map(cost).join('')}</div>
      <div class="mk-stat">
        <b>${t(c.name)}</b> — ❤ ${c.hp} · ⚡ ${c.energy} · ${t('armour')} ${c.armour} ·
        ${t('hit')} ${c.attack} · ${t('range')} ${c.range} · ${t('sensor')} ${c.sensor}<br>
        ${blind
          ? `<b>${t('A CLASSMATE')}</b> — ${t('frame and program unknown until you both deploy')}`
          : `<b>${t(opponent.name)}</b> — ${t(o.name)}, ❤ ${o.hp} · ${t('armour')} ${o.armour} ·
             ${t('hit')} ${o.attack} · ${t('range')} ${o.range}`}<br>
        <span style="color:var(--star)">${t('Turns')}: ${rules().maxTurns}</span> ·
        ${t('most armour left wins if nobody is destroyed')}</div>`;
  }
  function restoreProgram(){
    const saved=loadProgram(opponent.id);
    CODE.clear();
    if(saved && saved.length){
      const s=CODE.script;
      s.length=0; saved.forEach(b=>s.push(b));
    }
  }

  /* RUN, from the console. The steps it hands over are thrown away on
     purpose: the referee is given the BLOCKS and compiles them itself,
     which is exactly what the server will do when this is a real match.
     If the two ever disagreed, the fight you watched would not be the
     fight that counted. */
  function run(){
    if(phase!=='program' && phase!=='results') return;
    const tree=JSON.parse(JSON.stringify(CODE.script));
    saveProgram(opponent.id, tree);
    if(pvp) return submit(tree);

    const r=MECHSIM.simulate({
      a:{ name:t('YOU'),        chassis, program:tree },
      b:{ name:t(opponent.name), chassis:opponent.chassis, program:opponent.program },
      arena:opponent.arena, rules:DEFAULT_RULES, seed:seedFor(tree)
    });
    if(!r.ok){
      refuse((r.rejected.find(x=>x.side==='A')||{errors:[]}).errors[0]);
      return;
    }
    match=r; idx=0;
    CODE.close(); CODE.hideTape(); if(CODE.blame) CODE.blame(null);
    countdown();
  }
  /* One place to be told no, whoever said it — the referee in this browser
     or the one on the server. Both hand back the same shape of error, and
     both mean the same thing: this block, this sentence, try again. */
  function refuse(e){
    if(!e) return;
    if(e.blockId!=null && CODE.blame) CODE.blame(e.blockId);
    CODE.show();
    if(window.beep) beep('bad');
    brief('<b>'+t('The referee sent it back.')+'</b> '+t(e.msg));
  }

  /* ------------------------------------------------- deploying at the Gym
     The program goes up and waits there. Nothing is decided in this
     browser: what comes back is the whole match, including the other
     student's program, which is what lets this machine draw the same fight
     theirs is drawing. */
  function submit(tree){
    if(!window.NET || !NET.live){
      brief('<b>'+t('Not connected.')+'</b> '+
            t('The Gym needs the server — sign in and pick a room to fight in.'));
      return;
    }
    const R=rules();
    const v=PROGRAM.validate(tree, { limit:R.blockLimit, maxDepth:R.maxDepth,
      allow:PAL, conds:MECHSIM.SENSORS.map(s=>s.id) });
    if(!v.ok) return refuse(v.errors[0]);        // caught here, before the trip
    NET.mech({ op:'queue', chassis, program:tree });
    phase='waiting';
    CODE.close(); CODE.hideTape(); if(CODE.blame) CODE.blame(null);
    waitCard(t('Your program is in. The fight starts the moment somebody else deploys.'));
  }
  function waitCard(line){
    const el=$('#mkWait'); if(!el) return;
    el.innerHTML=`<div class="card">
      <div class="dots"><i>●</i><i>●</i><i>●</i></div>
      <h3>${t('WAITING FOR AN OPPONENT')}</h3>
      <p>${line}</p>
      <div class="row">
        <button class="btn small" data-a="edit">${t('EDIT CODE')}</button>
        <button class="btn ghost small" data-a="cancel">${t('Leave the queue')}</button>
      </div></div>`;
    el.classList.remove('hidden');
    el.querySelector('[data-a="edit"]').onclick=()=>{ CODE.show(); };
    el.querySelector('[data-a="cancel"]').onclick=()=>{
      if(window.NET) NET.mech({ op:'cancel' });
      hideWait(); phase='program'; console_();
    };
  }
  function hideWait(){ const el=$('#mkWait'); if(el){ el.classList.add('hidden'); el.innerHTML=''; } }

  /* What the server says back. Only ever about the match — the chat lines
     that go with it are worded in net.js like every other room message. */
  function fromServer(m){
    if(!on || !pvp) return;
    if(m.op==='waiting'){ phase='waiting';
      waitCard(t('Your program is in. The fight starts the moment somebody else deploys.'));
      return; }
    if(m.op==='cancelled'){ hideWait(); phase='program'; console_(); return; }
    if(m.op==='rejected'){ hideWait(); phase='program'; refuse((m.errors||[])[0]); return; }
    if(m.op==='error'){ hideWait(); phase='program';
      brief('<b>'+t('The Gym said no.')+'</b> '+t(m.message||'')); return; }
    if(m.op==='match') begin(m);
  }
  /* A match arrives as its inputs, not as a video: two programs, a floor
     and a seed. Running them here gives back the same frames the server
     got, which is what the replay, the log and the scrubber all read. */
  function begin(m){
    hideWait();
    mySide = m.you==='B' ? 'B' : 'A';
    const us=m[mySide], them=m[mySide==='A'?'B':'A'];
    chassis=us.chassis;                      // whatever the server actually ran
    opponent=Object.assign(stranger(), {
      name:them.name, chassis:them.chassis, program:them.program, arena:m.arena,
      teach:'another student', blurb:'You are watching their program, not them.' });
    A=MECHSIM.readArena(MECHSIM.arenaById(m.arena));
    build();                                 // their frame is known now, so redraw it
    const r=MECHSIM.simulate({ a:m.A, b:m.B, arena:m.arena, rules:m.rules, seed:m.seed });
    if(!r.ok){ phase='program';
      refuse((r.rejected.find(x=>x.side===mySide)||{errors:[]}).errors[0]); return; }
    /* The server's verdict is the one on record. These should be the same
       sentence — the same function ran on the same inputs — and if they are
       ever not, the one both students were told is the one shown. */
    if(m.result && r.result.winner!==m.result.winner)
      console.warn('replay disagreed with the referee', r.result, m.result);
    if(m.result) r.result=m.result;
    match=r; idx=0;
    countdown();
  }
  /* The seed is part of the match, so it is written down rather than
     picked fresh every render. Deriving it from the program means the
     same program against the same opponent is the same fight — you
     changed a block and the difference is yours, not the dice's. */
  function seedFor(tree){
    const s=JSON.stringify(tree)+opponent.id+chassis;
    let h=2166136261;
    for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
    return h>>>0;
  }

  /* ------------------------------------------------------------ deploy */
  function countdown(){
    phase='countdown';
    const el=$('#mkCount'); el.classList.remove('hidden');
    const words=['3','2','1'];
    let i=0;
    const tick_=()=>{
      if(!on || phase!=='countdown'){ el.classList.add('hidden'); return; }
      if(i<words.length){
        el.innerHTML=`<div class="big">${words[i]}</div>`;
        if(window.beep) beep('pop');
        i++; setTimeout(tick_, 620);
        return;
      }
      el.innerHTML=`<div class="big" style="font-size:min(12vw,110px)">${t('DEPLOY!')}</div>
                    <div class="sub">${t('nobody can help them now')}</div>`;
      if(window.beep) beep('good');
      setTimeout(()=>{ el.classList.add('hidden'); battle(); }, 780);
    };
    show(0);
    tick_();
  }
  function battle(){
    phase='battle';
    idx=0; acc=0; playing=true; speed=1;
    $('#mkLog').classList.remove('hidden');
    $('#mkBar').classList.remove('hidden');
    show(0);
  }

  /* ==================================================== playing it back */
  function tick(dt){
    /* `on` goes true at the setup screen, before there is an arena to look
       at — and this runs from the main loop, so anything it touches has to
       exist yet. Without the second half of this guard the whole game loop
       throws on A.w every frame from the moment the league is opened. */
    if(!on || !A || !world) return;
    camera(dt);
    crateMesh.forEach((g,i)=>{ g.rotation.y+=dt*1.4; g.children[0].position.y=Math.sin(performance.now()/420+i)*0.16; });
    stepFx(dt);
    if(!match || !playing) { lerp(dt); return; }
    acc+=dt*1000*speed;
    if(acc>=TURN_MS){
      acc=0;
      if(idx < match.frames.length-1) show(idx+1);
      else { playing=false; paintBar(); if(phase==='battle') finish(); }
    }
    lerp(dt);
  }

  /* Jump the whole board to one turn. Everything the replay shows comes
     from the frame, never from re-running anything, which is why the
     scrubber can go backwards as cheaply as forwards. */
  function show(i){
    if(!match){
      mechMesh.forEach((g,k)=>{
        g.userData.at=false;
        place(g, A.starts[k], faceCentre(A.starts[k]), true);
        // in the Gym the other mark is empty until somebody stands on it
        g.visible = !(pvp && k===other());
        g.userData.shield.visible=false;
      });
      return;
    }
    idx=Math.max(0, Math.min(match.frames.length-1, i));
    const f=match.frames[idx];
    f.mechs.forEach((m,k)=>{
      const g=mechMesh[k];
      place(g, m, m.dir, false);
      g.visible=true;
      g.userData.shield.visible=!!m.shield;
      g.userData.dead=!m.alive;
      g.scale.setScalar(m.alive?1:0.72);
      g.traverse(o=>{ if(o.isMesh && o.material && o.material.opacity===undefined) return; });
    });
    crateMesh.forEach((g,k)=>{ g.visible = f.crates[k] && !f.crates[k].taken; });
    if(idx>0) f.events.forEach(spawnFx);
    paintTop(f);
    paintLog();
    paintBar();
  }
  /* Positions are set as a target and eased into, so a turn reads as a
     step rather than a teleport. The truth is still the frame — this only
     changes how long it takes to look like it. */
  function place(g, m, dir, instant){
    const p=world_(m.x, m.z);
    g.userData.to={ x:p.x, z:p.z, yaw:-dir*Math.PI/2 };
    if(instant || !g.userData.at){
      g.position.set(p.x, 0, p.z); g.rotation.y=g.userData.to.yaw;
      g.userData.at=true;
    }
  }
  function lerp(dt){
    mechMesh.forEach(g=>{
      const to=g.userData.to; if(!to) return;
      const k=Math.min(1, dt*9);
      g.position.x += (to.x-g.position.x)*k;
      g.position.z += (to.z-g.position.z)*k;
      let d=to.yaw-g.rotation.y;
      while(d>Math.PI) d-=Math.PI*2;
      while(d<-Math.PI) d+=Math.PI*2;
      g.rotation.y += d*k;
    });
  }

  /* shots, hits and pickups, as things you can see happen */
  function spawnFx(ev){
    if(ev.kind==='shot'){
      const a=world_(ev.from.x,ev.from.z), b=world_(ev.to.x,ev.to.z);
      const len=Math.hypot(b.x-a.x, b.z-a.z)||TILE;
      const m=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,len),
        new THREE.MeshBasicMaterial({color: ev.hit?0xffe9a8:0x6b5f96,
          transparent:true, opacity:0.95}));
      m.position.set((a.x+b.x)/2, 1.7, (a.z+b.z)/2);
      m.rotation.y=Math.atan2(b.x-a.x, b.z-a.z);
      world.add(m); fx.push({ m, life:0.34 });
    }
    if(ev.kind==='hit' || ev.kind==='destroyed' || ev.kind==='collision' || ev.kind==='hazard'){
      const p=world_(ev.x||0, ev.z||0);
      const m=new THREE.Mesh(new THREE.SphereGeometry(1.4,14,10),
        new THREE.MeshBasicMaterial({color:0xff9aa2, transparent:true, opacity:0.8}));
      m.position.set(p.x,1.6,p.z); world.add(m);
      fx.push({ m, life:0.4, grow:true });
    }
    if(ev.kind==='pickup'){
      const p=world_(ev.x,ev.z);
      const m=new THREE.Mesh(new THREE.SphereGeometry(1.0,12,8),
        new THREE.MeshBasicMaterial({color:0xffe9a8, transparent:true, opacity:0.85}));
      m.position.set(p.x,1.2,p.z); world.add(m);
      fx.push({ m, life:0.45, grow:true });
    }
  }
  function stepFx(dt){
    for(let i=fx.length-1;i>=0;i--){
      const f=fx[i];
      f.life-=dt;
      if(f.grow) f.m.scale.multiplyScalar(1+dt*3.2);
      f.m.material.opacity=Math.max(0, f.life*2.2);
      if(f.life<=0){ if(f.m.parent) f.m.parent.remove(f.m); fx.splice(i,1); }
    }
  }
  function clearFx(){ fx.forEach(f=>{ if(f.m.parent) f.m.parent.remove(f.m); }); fx=[]; }

  /* -------------------------------------------------------- the camera
     Overhead and a little to the side, drifting. You are a spectator
     here, not a body in the room, so there is nothing to walk and the
     arrow keys only swing the view round. */
  function camera(dt){
    if(G.keys.ArrowLeft)  orbit -= 1.1*dt;
    if(G.keys.ArrowRight) orbit += 1.1*dt;
    if(G.keys.ArrowUp)    orbitH = Math.min(2.2, orbitH+0.9*dt);
    if(G.keys.ArrowDown)  orbitH = Math.max(0.5, orbitH-0.9*dt);
    if(!G.keys.ArrowLeft && !G.keys.ArrowRight) orbit += dt*0.045;
    /* Far enough out that the whole floor is in shot at once. A battle you
       have to pan around to follow is a battle you cannot read. */
    const span=Math.max(A.w, A.h)*TILE;
    const r=span*0.80, y=span*0.92*orbitH;
    G.camera.position.set(Math.sin(orbit)*r, y, Math.cos(orbit)*r);
    G.camera.up.set(0,1,0);
    G.camera.lookAt(0,0,0);
  }

  /* ===================================================== the two panels */
  function paintTop(f){
    const side=(k, el)=>{
      const spec = k===mine() ? you : foe;
      const c=MECHSIM.CHASSIS[spec.chassis];
      const m=f ? f.mechs[k] : { hp:c.hp, energy:c.energy, alive:true };
      const maxE = match ? match.mechs[k].maxEnergy : c.energy;
      el.innerHTML=`
        <div class="mk-name" style="color:${spec.a}">
          <span>${c.em}</span><span>${spec.name}</span></div>
        <div class="mk-chassis">${t(c.name)}${m.alive?'':' · <span class="mk-dead">'+t('DESTROYED')+'</span>'}</div>
        <div class="mk-meter mk-hp"><i style="width:${Math.max(0,m.hp/c.hp*100)}%"></i></div>
        <div class="mk-meter mk-en"><i style="width:${Math.max(0,m.energy/maxE*100)}%"></i></div>
        <div class="mk-nums"><span>❤ <b>${m.hp}</b>/${c.hp}</span>
          <span>⚡ <b>${m.energy}</b>/${maxE}</span></div>`;
    };
    side(mine(), $('#mkA')); side(other(), $('#mkB'));
    const T=$('#mkTurn');
    T.innerHTML = match
      ? `<div class="n">${idx}</div><div class="l">${t('TURN')} / ${match.result.turns}</div>`
      : `<div class="n">—</div><div class="l">${t('NOT DEPLOYED')}</div>`;
  }

  /* ------------------------------------------------------------ the log
     What each program did this turn and why. A test is shown with the
     answer it gave, because "if enemy ahead → FALSE" is the single most
     useful line a losing student can read. */
  function paintLog(){
    const el=$('#mkLog');
    if(!match || phase==='countdown'){ el.classList.add('hidden'); return; }
    const from=Math.max(0, idx-4);
    let html=`<h4>${t('BATTLE LOG')}</h4>`;
    for(let i=from;i<idx;i++){
      const l=match.log[i];
      html+=`<div class="mk-turn"><div class="mk-tn">${t('TURN')} ${l.turn}</div>`;
      html+=lines(l[mySide],'a', you.name)+lines(l[mySide==='A'?'B':'A'],'b', foe.name);
      html+=`</div>`;
    }
    if(idx===0) html+=`<div class="mk-why">${t('Nothing has happened yet.')}</div>`;
    el.innerHTML=html;
    el.classList.remove('hidden');
  }
  function lines(entries, cls, who){
    return (entries||[]).map(e=>{
      const w=`<span class="who">${cls==='a'?'▲':'▼'}</span>`;
      if(e.kind==='test')
        return `<div class="mk-line ${cls}">${w}<span class="op">${t(e.text)}</span>
          <span class="${e.value?'mk-yes':'mk-no'}">${e.value?'✓ '+t('TRUE'):'✕ '+t('FALSE')}</span></div>`;
      if(e.kind==='iter')
        return `<div class="mk-line ${cls}">${w}<span class="mk-t">${t('repeat')} ${e.i}/${e.n}</span></div>`;
      if(e.kind==='action')
        return `<div class="mk-line ${cls}">${w}<span class="op">${e.text}()</span>
          <span class="mk-t">${e.cost?('−'+e.cost+'⚡'):''}</span></div>`;
      if(e.kind==='stall')
        return `<div class="mk-line ${cls}">${w}<span class="mk-no">${t('nothing happened')}</span></div>
                <div class="mk-why">${t(e.why)}</div>`;
      if(e.kind==='event' && e.text==='hit')
        return `<div class="mk-line ${cls}">${w}<span class="mk-hit">${t('HIT')} −${e.value} ❤</span></div>`;
      if(e.kind==='event' && e.text==='miss')
        return `<div class="mk-line ${cls}">${w}<span class="mk-no">${t('missed')}</span></div>`;
      if(e.kind==='event')
        return `<div class="mk-line ${cls}">${w}<span class="mk-t">${t(e.text)}${e.value?' '+e.value:''}</span></div>`;
      return '';
    }).join('');
  }

  /* ----------------------------------------------------- the transport */
  function paintBar(){
    const el=$('#mkBar');
    if(!match || phase==='countdown'){ el.classList.add('hidden'); return; }
    const last=match.frames.length-1;
    el.innerHTML=`
      <button data-a="first">⏮</button>
      <button data-a="prev">◀ ${t('step')}</button>
      <button data-a="play" class="${playing?'on':''}">${playing?'❚❚':'▶'}</button>
      <button data-a="next">${t('step')} ▶</button>
      <input type="range" min="0" max="${last}" value="${idx}" data-a="scrub">
      <span class="sc">${t('TURN')} ${idx}/${last}</span>
      <button data-a="speed">×${speed}</button>
      <button data-a="edit">${t('EDIT CODE')}</button>`;
    el.classList.remove('hidden');
    el.querySelectorAll('[data-a]').forEach(b=>{
      const act=b.dataset.a;
      if(act==='scrub'){ b.oninput=()=>{ playing=false; clearFx(); show(+b.value); }; return; }
      b.onclick=()=>{
        if(act==='first'){ playing=false; clearFx(); show(0); }
        if(act==='prev'){ playing=false; clearFx(); show(idx-1); }
        if(act==='next'){ playing=false; show(idx+1); }
        if(act==='play'){ playing=!playing; acc=0;
          if(playing && idx>=last) show(0);
          paintBar(); }
        if(act==='speed'){ speed = speed===1?2 : speed===2?4 : 1; paintBar(); }
        if(act==='edit'){ playing=false; phase='program'; console_(); }
      };
    });
  }

  /* ========================================================== the result
     Not "YOU LOST". The turn it went wrong, and the reason, in a sentence
     somebody can act on — then straight back to the blocks. */
  function finish(){
    phase='results';
    const r=match.result, stats=match.stats[mySide];
    const winner = r.winner===mySide;
    /* The league pays; the Gym does not. A rematch is two clicks, so a
       coin for beating a classmate is a coin for pressing RUN twice. */
    if(winner && !pvp && window.PROGRESS){
      const first=!won(opponent.id);
      PROGRESS.set('mech_'+opponent.id, true);
      if(first && window.WALLET)
        WALLET.award(t('{m} beaten',{m:t(opponent.name)}), 90, 45, 'mech_'+opponent.id);
    }
    const row=(k,v)=>`<div><b>${v}</b><span>${t(k)}</span></div>`;
    /* explain() falls back to the verdict when it has nothing sharper to
       say, and printing the same sentence twice reads as a stutter rather
       than as advice. */
    const why=MECHSIM.explain(match,mySide);
    const advice = (why && why!==r.text)
      ? `<p style="color:var(--star)">${t(why)}</p>` : '';
    showResults({
      title: r.winner==='draw' ? t('A DRAW')
           : winner ? t('YOUR MECH WINS') : t('YOUR MECH IS DOWN'),
      body: `<p>${t(r.text)}</p>`+advice,
      stats: row('damage dealt', stats.damageDealt) + row('damage taken', stats.damageTaken)
           + row('shots fired', stats.shots) + row('shots that hit', stats.hits)
           + row('energy used', stats.energyUsed) + row('turns survived', stats.turnsSurvived)
           + row('blocks', PROGRAM.countBlocks(CODE.script)),
      btnText: t('WATCH IT BACK ▶'),
      onBtn: ()=>{ $('#done').classList.add('hidden');
                   playing=false; clearFx(); show(0); paintBar(); }
    });
  }
  function brief(html){
    const b=$('#briefing'); if(!b) return;
    b.classList.remove('hidden'); b.innerHTML=html;
  }

  /* ------------------------------------------------------------- leaving */
  function stop(){
    if(!on){ phase='off'; return; }
    /* Walking out while your program is in the queue takes it with you —
       otherwise the next person to deploy fights an empty chair. */
    if(pvp && phase==='waiting' && window.NET && NET.live) NET.mech({ op:'cancel' });
    on=false; phase='off'; pvp=false; mySide='A';
    hideWait();
    clearFx();
    match=null; mechMesh=[]; crateMesh=[]; world=null;
    $('#mech').classList.add('hidden');
    $('#mkSetup').classList.add('hidden');
    $('#mkLog').classList.add('hidden');
    $('#mkBar').classList.add('hidden');
    $('#mkCount').classList.add('hidden');
    $('#mkWait').classList.add('hidden');
    $('#objectives').classList.remove('hidden');
    $('#crosshair').classList.remove('hidden');
    $('#briefing').classList.remove('hidden');
    if(wasFP!==null){ G.firstPerson=wasFP; wasFP=null;
                      if(window.GUN) GUN.update(0,false); }
    if(window.CODE){ CODE.close(); CODE.hideTape(); CODE.setGuide(null);
                     CODE.setAside(null,null); CODE.setBudget(0);
                     CODE.setConditions(['red','blue']); CODE.setGrid(3,3); }
    if(window.AVATAR) AVATAR.attach();
  }
  /* SPACE plays and pauses, ← → step, while the replay is up and the
     console is not. The same keys the transport shows, so somebody who
     found one has found the other. */
  function key(code){
    if(!on || !match || CODE.isOpen()) return false;
    if(code==='Space'){ playing=!playing; acc=0;
      if(playing && idx>=match.frames.length-1) show(0);
      paintBar(); return true; }
    if(code==='BracketLeft'){ playing=false; clearFx(); show(idx-1); return true; }
    if(code==='BracketRight'){ playing=false; show(idx+1); return true; }
    return false;
  }

  /* Set once, at load. The socket belongs to the planet or to Free Play,
     and the arena is neither — so it says where its own post goes rather
     than hoping whoever opened the connection remembered to pass it on. */
  if(window.NET) NET.onMech = fromServer;

  return { start, stop, tick, run, key, camera, net:fromServer,
           get active(){ return on; },
           get phase(){ return phase; },
           get pvp(){ return pvp; },
           GYM_ARENA, LEAGUE, PAL };
})();
