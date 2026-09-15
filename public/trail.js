/* =====================================================================
   THE ENGINEER'S TRAIL — a mystery you solve by reading machines.

   Every other mission in this game asks a student to WRITE a program.
   This one asks them to READ one, which is the other half of the same
   skill and the half nobody is ever taught: a machine in front of you is
   doing something strange, and the only way to find out why is to open
   it, see what it asks, and change the answer.

   So the programming is not the story. A delivery robot that will not
   stop, a gate that opens for nobody, a train that stops at a station
   that closed four years ago and a door whose log is blank are four
   strange things in a district, and `if`, `else`, `or`, `and` and `elif`
   are the tools you take them apart with. Nobody is ever told they are
   in a lesson about conditionals. They are told to find out who did it.

   WHAT IS REUSED, because none of this is a second engine:

     BUILDING   the district is a text floor plan, exactly like the
                infiltration site — one string per row.
     G / step() the same player controller, the same collision, the same
                third-person camera as everywhere else.
     AVATAR     the witnesses are the same rigged characters the player
                could be wearing, walking the same animations.
     G.hits     the same crosshair focus that reads a door on the planet
                reads a machine here, so [E] means what it always meant.
     PROGRESS   the same save bag that carries coins and finished
                missions carries the notebook.
     KLOGIC     the evaluator, which is where the actual thinking is, and
                which has no DOM in it so it can be tested under Node.

   WHAT IS NEW, and built to be used again: a MACHINE is a rule, a set of
   switches, and a mapping from the action it lands on to something that
   happens in the world. Nothing in the inspector below knows what a gate
   is. Point it at a rule about loops or variables and it will draw that
   instead — which is the whole reason it is a table and not a script.
   ===================================================================== */
window.TRAIL = (function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const K = () => window.KLOGIC;
  /* Read off the kit rather than copied from it: everything here is laid
     out in tiles and converted exactly once, and two constants that have
     to agree are two constants that eventually do not. */
  const U = (window.BUILDING && BUILDING.UNIT) || 4;
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g,
    c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  /* Same signature as t(), because half the sentences in a mission have a
     number in them and a say() that quietly dropped the second argument
     printed "{n} of {m} clues filed" on the screen. */
  const say = (s,p) => (window.t ? t(s,p) : s);

  /* ------------------------------------------------------- the district
     One string per row, and the markers are read out of it before it is
     handed to BUILDING — so the map you read here is the map that gets
     built, rather than a list of coordinates that has to be kept in step
     with it by hand. Anything that is not BUILDING's own vocabulary is a
     marker, and becomes plain floor on the way through.

        1  robot dock        e  bay 14 sensor     f  bay 17 post
        p  bay 17 counter    2  gate console      q  loading stub
        3  transit console   k  tool tag          4  door console
        5  engineer terminal a b c d  the four witnesses               */
  const PLAN = [
    '###################################',
    '#........#..............#.....#...#',
    '#.1......#...e......f...#.....#.q.#',
    '#........D...........p..D...2.#...#',
    '#........#..............#.........#',
    '#.....a..#..............#.b...#...#',
    '#........#..............#.....#...#',
    '####D###########D##########D#######',
    '#.................................#',
    '#...............S.................#',
    '#.................................#',
    '####D#############D################',
    '#........#########.#####..........#',
    '#.3......#########.#####..........#',
    '#........#.............#..........#',
    '#........D.............D..........#',
    '#.....c..#.............#......k...#',
    '#........#######.#######..........#',
    '################D##################',
    '         #.............#........#  ',
    '         #...d.......4.D...5....#  ',
    '         #.............#........#  ',
    '         ########################  '
  ];
  const MARKS = '123456789abcdefghijklmnopqrstuvwxyz';
  const plain = () => PLAN.map(r=>r.replace(/[1-9a-z]/g,'.'));
  function markers(){
    const out={};
    PLAN.forEach((row,z)=>[...row].forEach((c,x)=>{
      if(MARKS.indexOf(c)>=0) out[c]={ x, z };
    }));
    return out;
  }
  /* tile → world. Everything in this file is placed in tiles and asks
     for metres exactly once, here, because a mission laid out in two
     units is a mission with a bug in it. */
  const wx = x => x*U, wz = z => z*U;

  /* ------------------------------------------------------------- zones
     Where each part of the mystery lives, for the map and for the
     waypoint that walks a lost student to the next thing. */
  const ZONES=[
    { id:'depot',   name:'THE DEPOT',            x:4.5, z:3.5 },
    { id:'yard',    name:'LOADING BAYS',         x:16,  z:3.5 },
    { id:'gate',    name:'PERIMETER GATE 3',     x:28,  z:3.5 },
    { id:'street',  name:'SERVICE ROAD',         x:17,  z:9 },
    { id:'transit', name:'TRANSIT PLATFORM',     x:4.5, z:14.5 },
    { id:'line',    name:'THE LOOP LINE',        x:16,  z:15 },
    { id:'old',     name:'THE OLD YARD',         x:28.5,z:14.5 },
    { id:'maint',   name:'MAINTENANCE',          x:16,  z:20 },
    /* It has no name on any map in the district, which is the point of
       it. The notebook prints a ? until the door it is behind is open. */
    { id:'eng',     name:'THE ENGINEER’S ROOM', x:27.5,z:20 }
  ];

  /* ----------------------------------------------------------- objects
     The props that are not machines: things to find, and things that
     only stand there so that a bay looks like a bay. Every one of the
     findable ones files something — nothing here is a button that does
     nothing. */
  const FINDS=[
    { id:'counter', at:'p', em:'\u{1F4CB}', name:'BAY 17 TRIP COUNTER',
      body:'TRIPS LOGGED SINCE THE 14th: <b>1,206</b><br>ITEMS SIGNED FOR: <b>0</b><br>'+
           'The bay itself is empty, and has been for two years.',
      clue:'bay17' },
    { id:'crate', at:'1', em:'\u{1F4E6}', name:'THE CRATE',
      need:'crate_home',
      locked:'KR-9 is carrying it, and KR-9 is not stopping. Find out what would make it stop.',
      body:'Sealed with a maintenance tie, not a depot seal. No consignment number, no signature, '+
           'and a scuff on every corner from 1,206 round trips.',
      clue:'crate' },
    { id:'stub', at:'q', em:'\u{1F9FE}', name:'LOADING STUB',
      body:'One line, torn off a pad and left on the rail:<br>'+
           '<b>OUTBOUND · the 14th · 02:20 · authorised M-4471</b>',
      clue:'manifest' },
    { id:'tag', at:'k', em:'\u{1F3F7}', name:'TOOL TAG, AT THE END OF A DRAG MARK',
      body:'The dust is scored in a straight line from the platform edge to the wall. '+
           'At the end of it, face down: a maintenance tool tag.',
      clue:'tag' }
  ];

  /* ------------------------------------------- what an action does here
     The one place the world and the rules are joined. A machine's rule
     produces the NAME of an action; this says what that name does to the
     district, and what the machine looks like afterwards. Add a machine
     and you add rows here, and nothing else in the file changes. */
  const ACTIONS={
    'mark_delivered()':   { status:'ACTIVE',  world:'sensorOn',
      line:'The pad lights. The sensor tells KR-9 the package is down.' },
    'return_to_station()':{ status:'ACTIVE',  world:'robotHome',
      line:'KR-9 turns round, comes home, and sets the crate down on its dock.' },
    'continue_delivery()':{ status:'ACTIVE',  world:'robotOut',
      line:'KR-9 sets off for Bay 17 again. It has done this 1,206 times.' },
    'open_gate()':        { status:'UNLOCKED',world:'gateOpen',
      line:'The barrier drops. The loading side is open.' },
    'deny_entry()':       { status:'LOCKED',  world:'gateShut',
      line:'The barrier stays down and the post flashes red.' },
    'stop_at_station()':  { status:'ACTIVE',  world:'carStops',
      line:'Car 2 leaves the loop, runs to the old yard and opens its doors.' },
    'continue_route()':   { status:'IDLE',    world:'carRuns',
      line:'Car 2 runs straight past the old platform. The shutter stays down.' },
    'unlock()':           { status:'UNLOCKED',world:'doorOpen',
      line:'The door opens. Nothing is written to the log.' },
    'unlock_and_log()':   { status:'UNLOCKED',world:'doorOpenLogged',
      line:'The door opens — and the log takes a name and a time.' },
    'request_confirmation()':{ status:'ALERT', world:'doorAsk',
      line:'It asks a supervisor for confirmation. At this hour, nobody answers.' },
    'remain_locked()':    { status:'LOCKED',  world:'doorShut',
      line:'Nothing happens. The door stays shut.' },
    'one_operator()':     { status:'ALERT',   world:'crossOk',
      line:'Four overrides. One code. The terminal prints a crew.' },
    'partial_trail()':    { status:'IDLE',    world:null,
      line:'Not enough. A trail with a gap in it names nobody.' },
    'no_trail()':         { status:'IDLE',    world:null,
      line:'Nothing to cross-reference. Go and read the machines.' }
  };
  const LAMP={ IDLE:0x5a4b85, ACTIVE:0x8fd3ff, UNLOCKED:0xa8e6cf,
               LOCKED:0xffd8a8, ALERT:0xff9aa2, ERROR:0xff9aa2 };

  /* ------------------------------------------------------- the mission */
  const STAGES=[
    { id:'arrive', obj:'Investigate the unusual machine behaviour around Koro.',
      hint:'Four machines in this district are behaving strangely. Start with the one that is moving.',
      at:'depot', done:s=>!!s.clues.robot_rule || !!s.clues.sensor_rule },
    { id:'robot', obj:'Find out why the delivery robot never finishes its round.',
      hint:'Look at what it asks itself, and give it the other answer.',
      at:'robot', done:s=>!!s.flags.crate_home },
    { id:'crate', obj:'Open what the robot has been carrying.',
      hint:'It set it down on its dock in the depot.',
      at:'1', done:s=>!!s.clues.crate },
    { id:'gate', obj:'Find out why the perimeter gate opened for somebody with no badge.',
      hint:'Two conditions, and only one of them has to be true. Work out which pair opens it.',
      at:'2', done:s=>!!s.clues.manifest },
    { id:'transit', obj:'Find out why a transit car stops at a station that closed.',
      hint:'This one needs BOTH of its conditions. That is what makes the stop deliberate.',
      at:'3', done:s=>!!s.flags.car_berthed },
    { id:'station', obj:'Search the old yard.',
      hint:'Something heavy was dragged along that platform.',
      at:'k', done:s=>!!s.clues.tag },
    { id:'door', obj:'Get the maintenance door open — and find out why the log for the 14th is blank.',
      hint:'Four branches, and it only ever answers the first one that is true. Try moving a line.',
      at:'4', done:s=>!!s.clues.order_matters && !!s.flags.door_open },
    { id:'terminal', obj:'Find the engineer’s terminal.',
      hint:'Through the door the maintenance machine was holding shut.',
      at:'5', done:s=>!!s.clues.note },
    { id:'cross', obj:'Cross-reference the four overrides.',
      hint:'The terminal needs all four. Run a test on every machine that has a log.',
      at:'5', done:s=>!!s.flags.crossref },
    { id:'night', obj:'Put the night of the 14th in order.',
      hint:'Every machine prints the time it acted. Read them off.',
      at:'5', done:s=>!!s.flags.timeline },
    { id:'name', obj:'Name who was responsible.',
      hint:'An override is issued to a crew, not to a person. Somebody keeps the roster.',
      at:'5', done:s=>!!s.flags.named }
  ];

  /* ------------------------------------------------------------- state
     One bag, saved in the same place as everything else, so a lesson that
     ends halfway through picks up where it stopped on another machine. */
  const SAVE='trail_save';
  let S=null, L=null, on=false, panel=null, noteUp=false, raf=null;

  function blank(){
    return { stage:0, clues:{}, flags:{}, tests:{}, order:null, tries:0, lessons:{} };
  }
  function load(){
    let d=null;
    try{ d = window.PROGRESS ? PROGRESS.get(SAVE, null) : null; }catch(e){ d=null; }
    S = (d && typeof d==='object') ? Object.assign(blank(), d) : blank();
    S.clues=S.clues||{}; S.flags=S.flags||{}; S.tests=S.tests||{}; S.lessons=S.lessons||{};
    /* A CASE YOU HAVE SOLVED OPENS AS A NEW CASE. The bag is cleared here,
       on the way IN, rather than at the end — the debrief is still reading
       it when the mission finishes, and somebody who closes that card and
       walks back round the district should find it as they left it rather
       than reset under their feet. */
    if(S.flags.finished) S = blank();
    return S;
  }
  function save(){
    if(window.PROGRESS) PROGRESS.set(SAVE, S);
    if(window.PROGRESS && PROGRESS.reach) PROGRESS.reach('trail', S.stage);
  }

  /* Filing something. Everything a player learns goes through here and
     nowhere else, which is why the notebook, the objectives and the
     terminal's readings can never be out of step with each other. */
  function file(id, quiet){
    if(!id || S.clues[id]) return false;
    const c=K().CLUES[id]; if(!c) return false;
    S.clues[id]=true;
    save();
    if(!quiet){ toast(c.head); sound('file'); }
    paintNote();
    advance();
    return true;
  }
  const has = id => !!S.clues[id];
  function flag(id, v){
    if(S.flags[id]===(v===undefined?true:v)) return;
    S.flags[id] = v===undefined ? true : v;
    save(); advance();
  }
  /* which of the six ideas a student has actually USED, for the debrief */
  function used(k){ if(!S.lessons[k]){ S.lessons[k]=true; save(); } }

  const stage = () => STAGES[Math.min(S.stage, STAGES.length-1)];
  function advance(){
    let moved=false;
    while(S.stage < STAGES.length && STAGES[S.stage].done(S)){ S.stage++; moved=true; }
    if(moved){ save(); sound('step'); }
    paintObj();
    if(S.stage>=STAGES.length && !S.flags.finished) finish();
  }

  /* =================================================================
     BUILDING THE DISTRICT
     ================================================================= */
  async function start(){
    stop(true);
    load();
    COMBAT.reset(); PUZZLE.stop(); NAV.stop(); TUTOR.stop(); RACE.stop();
    if(window.FLIGHT) FLIGHT.stop(); if(window.MECH) MECH.stop();
    if(window.MECHA) MECHA.stop(); if(window.WORKSHOP) WORKSHOP.hide();
    if(window.INVADERS) INVADERS.stop(); if(window.SUB) SUB.stop();
    if(window.SCHOOL) SCHOOL.stop(); if(window.CLUB) CLUB.stop();
    if(window.MISSIONS) MISSIONS.stop();
    if(window.CODE){ CODE.close(); CODE.hideTape(); }
    if(window.MUSIC) MUSIC.play(null);

    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.selected=null; G.focused=null;
    G.camera.up.set(0,1,0);
    G.camera.near=0.1; G.camera.far=260; G.camera.updateProjectionMatrix();
    /* A district at two in the morning: cold, lit from inside, and far
       enough into the haze that the end of the street is a suggestion.
       Not horror — the lamps are on and the signs are legible. */
    G.scene.background=new THREE.Color(0x0b1120);
    G.scene.fog=new THREE.Fog(0x0b1120, 46, 172);
    if(G.sun){ G.sun.intensity=0.30; G.sun.color.setHex(0xa8bcff);
               G.sun.position.set(60,110,-40);
               G.sun.target.position.set(70,0,40); G.sun.target.updateMatrixWorld(); }
    if(G.amb)  G.amb.intensity=0.20;
    if(G.hemi){ G.hemi.intensity=0.34; G.hemi.color.setHex(0x93a8ff);
                G.hemi.groundColor.setHex(0x242034); }
    G.renderer.toneMappingExposure=1.16;

    G.room='trail'; G.hudOwner='trail'; G.missionId=null; G.running=true;
    G.firstPerson=false;
    on=true;

    const m=markers();
    const built=await BUILDING.build(plain(), G.roomGroup);
    if(!on) return;                      // somebody left while the kit loaded
    L={ built, marks:m, spots:[], machines:{}, people:[], finds:{},
        robot:null, car:null, bars:{}, lamps:{}, near:null, t:0, ping:0, waypoint:null };
    G.solids=built.solids.slice();
    G.ground=built.heightAt; G.ceiling=built.ceilingAt;
    G.vel.y=0; G.onGround=true;

    const sp=built.spots.spawn;
    G.pos.set(sp.x*U, sp.y+1.7, sp.z*U); G.yaw=Math.PI; G.pitch=0.02;
    if(window.AVATAR) AVATAR.attach();

    ground();
    pad();
    signs();
    machines();
    barriers();
    robot();
    car();
    finds();
    await people();
    if(!on) return;

    G.scene.updateMatrixWorld(true);
    $('#mapwrap').classList.remove('hidden');
    $('#mapTitle').textContent=say('DISTRICT MAP');
    legend();
    ['#health','#skill','#trigger','#fbeat','#radar','#ptimer','#dash','#pmap']
      .forEach(s=>{ const e=$(s); if(e) e.classList.add('hidden'); });
    $('#objTitle').textContent=say('THE ENGINEER’S TRAIL');
    $('#missionName').textContent=say('Koro service district · 02:00');
    if(window.updateLeaveBtn) updateLeaveBtn();
    if(window.updateCodeBtn) updateCodeBtn();
    noteButton();
    ambience(true);
    advance(); paintObj(); paintNote();
    brief(S.stage===0
      ? say('Something in this district does not add up. Walk up to a machine and press <b>E</b>.')
      : say('Back on the trail. <b>N</b> opens your notebook.'));
    lockPointer($('#view'));
  }

  function stop(quiet){
    if(!on && !L && !quiet) return;
    on=false;
    closePanel(true); hideNote();
    ambience(false);
    if(L && L.waypoint && L.waypoint.g.parent) L.waypoint.g.parent.remove(L.waypoint.g);
    L=null;
    const nb=$('#btnNote'); if(nb) nb.classList.add('hidden');
    const up=$('#usePrompt'); if(up) up.classList.add('hidden');
    const b=$('#briefing'); if(b) b.classList.add('hidden');
    /* Hand the shared HUD back the way we found it. Nobody else owns these
       two headings, so a mission that renames them and walks out leaves the
       planet calling itself THE ENGINEER'S TRAIL. */
    const ot=$('#objTitle'); if(ot) ot.textContent=say('MISSION');
    const mt=$('#mapTitle'); if(mt) mt.textContent=say('DESKTOP MAP');
    const lg=$('#maplegend'); if(lg) lg.textContent='';
    /* Hand the room name back. Level 0 leaves it null for the same reason:
       a mission that builds its own room and then leaves its name behind
       has the next room drawing this one's map. */
    if(G.room==='trail') G.room=null;
    if(G.renderer) G.renderer.toneMappingExposure=1.05;
    if(G.sun){ G.sun.intensity=1.62; G.sun.color.setHex(0xfff2e0);
               G.sun.position.set(48,96,34);
               G.sun.target.position.set(0,0,0); G.sun.target.updateMatrixWorld(); }
    if(G.amb) G.amb.intensity=0.16;
    if(G.hemi){ G.hemi.intensity=0.46; G.hemi.color.setHex(0xbfd8ff);
                G.hemi.groundColor.setHex(0xa88c6a); }
  }

  /* ------------------------------------------------------------- the set
     Everything below draws; none of it decides anything. */
  const lam = c => new THREE.MeshLambertMaterial({color:c});
  const glowMat = c => new THREE.MeshBasicMaterial({color:c});

  function solid(x,z,w,d,h){
    G.solids.push({ x1:x-w/2, x2:x+w/2, z1:z-d/2, z2:z+d/2, y1:0, y2:h||3 });
  }
  /* A hit target the crosshair can actually find. The kit models arrive
     late and are a tree of meshes besides, so what you aim at is always a
     plain invisible box that has been standing there since frame one —
     the same trick the librarian on Senio uses. */
  function target(group, x, y, z, w, h, d, data, parent){
    const box=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
      new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true,
                                    opacity:0, depthWrite:false }));
    box.position.set(x,y,z);
    box.userData.owner=group;
    (parent||G.roomGroup).add(box);
    G.hits.push(box);
    group.userData=Object.assign({ trail:true }, data);
    L.spots.push(Object.assign({ x, z, group }, data));
    return box;
  }

  /* A sign you can read from across a yard. Canvas, in the interface face,
     because every other sign in this game is drawn the same way. */
  function signTex(lines, tint, sub){
    const c=document.createElement('canvas'); c.width=512; c.height=160;
    const x=c.getContext('2d');
    const font = getComputedStyle(document.documentElement)
                   .getPropertyValue('--font').trim() || 'monospace';
    x.fillStyle='rgba(10,16,30,.92)'; x.fillRect(0,0,512,160);
    x.strokeStyle=tint; x.lineWidth=7; x.strokeRect(5,5,502,150);
    x.fillStyle=tint; x.textAlign='center'; x.textBaseline='middle';
    let size=54;
    x.font='bold '+size+'px '+font;
    while(x.measureText(lines).width>452 && size>18){ size-=3; x.font='bold '+size+'px '+font; }
    x.fillText(lines, 256, sub?64:80);
    if(sub){ x.font='26px '+font; x.fillStyle='#bdb2d8'; x.fillText(sub, 256, 116); }
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
  }
  function emojiTex(em, bg){
    const c=document.createElement('canvas'); c.width=c.height=256;
    const x=c.getContext('2d');
    x.fillStyle=bg||'#101a2e'; x.fillRect(0,0,256,256);
    x.strokeStyle='rgba(143,211,255,.55)'; x.lineWidth=8; x.strokeRect(6,6,244,244);
    x.textAlign='center'; x.textBaseline='middle';
    x.font='132px system-ui,"Apple Color Emoji","Segoe UI Emoji"';
    x.fillText(em, 128, 136);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
  }
  function sign(x,z,text,tint,sub,rot,scale){
    const s=scale||1;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(6.4*s,2*s),
      new THREE.MeshBasicMaterial({map:signTex(text,tint,sub), transparent:true,
                                   side:THREE.DoubleSide}));
    m.position.set(x, 3.4*s, z); m.rotation.y=rot||0;
    m.userData.flat=true;
    G.roomGroup.add(m);
    return m;
  }

  /* The ground under the whole site, so the fog has something to sit on
     and the district reads as a place with an outside rather than a
     diagram floating in the dark. */
  function ground(){
    const w=PLAN[0].length*U, d=PLAN.length*U;
    const g=new THREE.Mesh(new THREE.PlaneGeometry(w+120, d+120),
      lam(0x161d30));
    g.rotation.x=-Math.PI/2; g.position.set(w/2-U/2, -0.32, d/2-U/2);
    g.userData.flat=true;
    G.roomGroup.add(g);
  }

  /* The weight plate under Bay 14 — the thing the sensor is actually
     looking at, so "the condition changed" is something on the floor. */
  function pad(){
    const x=wx(13), z=wz(3);
    const p=new THREE.Mesh(new THREE.BoxGeometry(3.4,0.12,3.4), lam(0x2b3350));
    p.position.set(x, 0.07, z); p.userData.flat=true; G.roomGroup.add(p);
    const lit=new THREE.Mesh(new THREE.BoxGeometry(3.0,0.16,3.0), glowMat(0x394264));
    lit.position.set(x, 0.10, z); lit.userData.flat=true; G.roomGroup.add(lit);
    L.pad=lit;
  }
  function padLight(on_){
    if(L && L.pad) L.pad.material.color.setHex(on_ ? 0xa8e6cf : 0x394264);
  }
  function signs(){
    const M=L.marks;
    sign(wx(13), wz(1)-1.6, say('BAY 14'), '#a8e6cf', say('pad · no signal'), 0, 0.85);
    sign(wx(20), wz(1)-1.6, say('BAY 17'), '#ffd8a8', say('empty · 2 years'), 0, 0.85);
    sign(wx(4),  wz(1)-1.6, say('DEPOT'), '#8fd3ff', null, 0, 0.9);
    sign(wx(27), wz(1)-1.6, say('PERIMETER GATE 3'), '#8fd3ff', say('badge readers only'), 0, 0.8);
    sign(wx(4),  wz(12)-1.6, say('LOOP LINE · PLATFORM 1'), '#8fd3ff', null, 0, 0.75);
    sign(wx(28.5), wz(12)-1.6, say('THE OLD YARD'), '#ff9aa2', say('closed · 4 years'), 0, 0.8);
    sign(wx(16), wz(19)-1.6, say('MAINTENANCE'), '#cdb4f6', null, 0, 0.85);
    // the bay 17 post the robot turns round at
    if(M.f){
      const post=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,3.2,8), lam(0x8b93ad));
      post.position.set(wx(M.f.x), 1.6, wz(M.f.z)); G.roomGroup.add(post);
      const num=new THREE.Mesh(new THREE.BoxGeometry(1.3,1.0,0.12), lam(0xffd8a8));
      num.position.set(wx(M.f.x), 3.1, wz(M.f.z)); G.roomGroup.add(num);
    }
  }

  /* ---------------------------------------------------- the consoles
     A Koro diagnostic post: a plinth, an angled screen, and a lamp on
     top that says what the machine thinks it is doing. The lamp is the
     whole point — a machine whose state you can read from across a yard
     is a machine you can form a theory about before you open it. */
  function post(x, z, mac, rot){
    const g=new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y=rot||0;
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.9,1.1,0.4,10), lam(0x232c46));
    base.position.y=0.2; g.add(base);
    const col=new THREE.Mesh(new THREE.BoxGeometry(0.7,2.0,0.7), lam(0x2e3a5c));
    col.position.y=1.2; g.add(col);
    const head=new THREE.Mesh(new THREE.BoxGeometry(2.0,1.4,0.5), lam(0x2a3b5c));
    head.position.set(0,2.5,0); head.rotation.x=-0.28; g.add(head);
    const face=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.1),
      new THREE.MeshBasicMaterial({map:emojiTex(mac.em)}));
    face.position.set(0,2.55,0.29); face.rotation.x=-0.28; g.add(face);
    /* THE STATE IS PAINTED, NOT LIT. A point light per console would be the
       obvious way to make a lamp glow, and six of them on top of the nine
       this kit hangs over its own rooms is fifteen lights every Lambert
       fragment in the district pays for — on a lab machine that is the
       difference between a district and a slideshow. Both of these are
       MeshBasicMaterial, which is lit by nothing and therefore reads the
       same from any angle and at any distance: a bulb on the mast, and a
       collar round the screen so the state is legible from across a yard
       rather than only from in front of it. */
    const collar=new THREE.Mesh(new THREE.PlaneGeometry(2.0,1.4), glowMat(LAMP.IDLE));
    collar.position.set(0,2.55,0.27); collar.rotation.x=-0.28; g.add(collar);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.3,12,10), glowMat(LAMP.IDLE));
    bulb.position.set(0,3.42,0); g.add(bulb);
    G.roomGroup.add(g);
    solid(x,z,2.1,1.4,3.6);
    L.lamps[mac.id]={ bulb, collar };
    return g;
  }
  function machines(){
    const M=L.marks, KL=K();
    const put=(mark, id, rot)=>{
      const mac=KL.machine(id); if(!mac || !M[mark]) return;
      const x=wx(M[mark].x), z=wz(M[mark].z);
      const g=post(x,z,mac,rot);
      target(g, x, 2.2, z, 2.4, 3.6, 1.8,
             { kind:'machine', id, label:say(mac.name), enter:'machine:'+id });
      L.machines[id]={ g, x, z, mac, state:{}, status:'IDLE', rule:null };
      setStatus(id, savedStatus(id));
    };
    put('e','sensor',  0);
    put('2','gate',   -Math.PI/2);
    put('3','transit', 0);
    put('4','door',   -Math.PI/2);
    put('5','terminal',-Math.PI/2);
  }
  /* A machine that was left open stays open. Coming back tomorrow to a
     gate you had already got through and finding it shut again is the
     save file telling a student their work did not count. */
  function savedStatus(id){
    if(id==='gate')     return S.flags.gate_open ? 'UNLOCKED' : 'LOCKED';
    if(id==='door')     return S.flags.door_open ? 'UNLOCKED' : 'LOCKED';
    if(id==='transit')  return S.flags.car_berthed ? 'ACTIVE' : 'IDLE';
    if(id==='terminal') return S.flags.crossref ? 'ALERT' : 'IDLE';
    return 'IDLE';
  }
  function setStatus(id, st){
    const m=L.machines[id]; if(!m) return;
    m.status=st;
    const lamp=L.lamps[id]; if(!lamp) return;
    const c=LAMP[st]===undefined ? LAMP.IDLE : LAMP[st];
    lamp.tint=c;
    lamp.bulb.material.color.setHex(c);
    if(lamp.collar) lamp.collar.material.color.setHex(c).multiplyScalar(0.55);
  }

  /* ------------------------------------------------------- the barriers
     Three doors that a rule decides. Each is a slab that drops into the
     floor when its machine says so, and each carries a solid that goes
     with it — an open gate you cannot walk through is worse than a
     locked one, because it lies. */
  function bar(id, x, z, w, d, tint){
    const g=new THREE.Group(); g.position.set(x,0,z);
    const slab=new THREE.Mesh(new THREE.BoxGeometry(w,3.2,d), lam(0x3b3059));
    slab.position.y=1.6; g.add(slab);
    /* Hazard banding, PROUD of the slab rather than sunk into it: at
       0.94 of the slab's own width the stripes were inside it and the
       barrier read as a plain dark rectangle from the one direction you
       ever walk at it from. */
    for(let i=-1;i<=1;i++){
      const st=new THREE.Mesh(new THREE.BoxGeometry(w+0.10,0.34,d*0.92), lam(tint));
      st.position.set(0, 1.0+i*0.85, 0); g.add(st);
    }
    G.roomGroup.add(g);
    const sd={ x1:x-w/2, x2:x+w/2, z1:z-d/2, z2:z+d/2, y1:0, y2:3.2 };
    G.solids.push(sd);
    L.bars[id]={ g, sd, open:false, want:0, k:0, tint };
    return g;
  }
  function barriers(){
    const M=L.marks;
    bar('gate',  wx(30), wz(4),  1.2, 3.8, 0xffd8a8);
    bar('plat',  wx(23), wz(15), 1.2, 3.8, 0x8fd3ff);
    bar('eng',   wx(23), wz(20), 1.2, 3.8, 0xcdb4f6);
    if(S.flags.gate_open) openBar('gate', true);
    if(S.flags.car_berthed) openBar('plat', true);
    if(S.flags.door_open) openBar('eng', true);
  }
  /* Opening is animated, but the COLLISION changes at once: a slab that
     is half way down is either passable or it is not, and "not until the
     animation finishes" is a quarter of a second of a player walking
     into something they can see is open. */
  function openBar(id, instant){
    const b=L.bars[id]; if(!b || b.open) return;
    b.open=true; b.want=1;
    if(instant){ b.k=1; b.g.position.y=-3.4; }
    const i=G.solids.indexOf(b.sd);
    if(i>=0) G.solids.splice(i,1);
    if(!instant) sound('open');
  }
  /* A BARRIER NEVER CLOSES ON SOMEBODY. Every one of these is worked from
     a console on the near side, so in this district you cannot shut
     yourself in — but a slab that re-appears around a player standing in
     the gap would wedge them there, and that is a bug worth being unable
     to write rather than one worth not having written. */
  function shutBar(id){
    const b=L.bars[id]; if(!b || !b.open) return;
    const r=1.2;
    if(G.pos.x+r>b.sd.x1 && G.pos.x-r<b.sd.x2 &&
       G.pos.z+r>b.sd.z1 && G.pos.z-r<b.sd.z2){
      brief(say('It tries to close and stops \u2014 you are standing in the gap.'));
      return;
    }
    b.open=false; b.want=0;
    if(G.solids.indexOf(b.sd)<0) G.solids.push(b.sd);
  }

  /* --------------------------------------------------------- KR-9
     The robot is the first thing anybody sees and it has to read as
     STUCK rather than broken: it drives its round at a perfectly steady
     pace, turns round at an empty bay, and comes back, for ever. */
  const ROUTE=[[2,2],[7,2],[8.4,3],[11,3],[19,3],[20,2]];
  function robot(){
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.0,2.1), lam(0xd8dbe6));
    body.position.y=0.85; g.add(body);
    const deck=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.16,1.4), lam(0x2f3a52));
    deck.position.y=1.36; g.add(deck);
    const eye=new THREE.Mesh(new THREE.SphereGeometry(0.19,12,10), glowMat(0x8ff0ff));
    eye.position.set(0,1.12,-1.02); g.add(eye);
    const tyre=lam(0x23262f);
    [-1,1].forEach(sx=>[-1,1].forEach(sz=>{
      const w=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.22,12), tyre);
      w.rotation.z=Math.PI/2; w.position.set(sx*0.8, 0.34, sz*0.72); g.add(w);
    }));
    const crate=new THREE.Group();
    const box=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.9,1.1), lam(0x8b6f4e));
    box.position.y=0.45; crate.add(box);
    const tie=new THREE.Mesh(new THREE.BoxGeometry(1.16,0.12,1.16), lam(0xffd8a8));
    tie.position.y=0.62; crate.add(tie);
    crate.position.y=1.44; g.add(crate);
    G.roomGroup.add(g);

    const home=S.flags.crate_home;
    L.robot={ g, crate, eye, i:0, k:0, dir:1, hold:0,
              mode: home?'home':'round', parked:home };
    if(home){
      g.position.set(wx(ROUTE[0][0]), 0, wz(ROUTE[0][1]));
      g.rotation.y=Math.PI;
      dropCrate();
    } else place(0);
    target(g, 0, 1.1, 0, 2.2, 2.4, 2.6,
           { kind:'machine', id:'robot', label:say('DELIVERY ROBOT KR-9'),
             enter:'machine:robot', moving:true }, g);
    L.machines.robot={ g, x:0, z:0, mac:K().machine('robot'), state:{},
                       status: home?'ACTIVE':'ALERT', rule:null };
    /* No collar: KR-9's eye is already its status light, and robotTick
       repaints it from what it is actually doing. */
    L.lamps.robot={ bulb:eye, collar:null };
    setStatus('robot', home?'ACTIVE':'ALERT');
  }
  /* The crate comes off the robot and on to the dock, and becomes a thing
     you can walk up to — which is the payoff for the whole if/else. */
  function dropCrate(){
    const r=L.robot; if(!r || !r.crate || r.crate.parent!==r.g) return;
    const p=new THREE.Vector3(); r.crate.getWorldPosition(p);
    r.g.remove(r.crate);
    G.roomGroup.add(r.crate);
    r.crate.position.set(wx(ROUTE[0][0])+1.9, 0.1, wz(ROUTE[0][1]));
    const f=FINDS.find(x=>x.id==='crate');
    if(f) findTarget(f, r.crate.position.x, r.crate.position.z);
  }
  function place(k){
    const r=L.robot, seg=ROUTE.length-1;
    const t=Math.max(0, Math.min(1, k))*seg;
    const i=Math.min(seg-1, Math.floor(t)), f=t-i;
    const a=ROUTE[i], b=ROUTE[i+1];
    const x=wx(a[0]+(b[0]-a[0])*f), z=wz(a[1]+(b[1]-a[1])*f);
    r.g.position.set(x, 0, z);
    r.g.rotation.y=Math.atan2(-(wx(b[0])-wx(a[0])), -(wz(b[1])-wz(a[1])))+Math.PI;
  }

  /* ------------------------------------------------------------- car 2 */
  function car(){
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(9.2,2.6,2.6), lam(0xc9d2ea));
    body.position.y=1.7; g.add(body);
    const skirt=new THREE.Mesh(new THREE.BoxGeometry(9.0,0.5,2.7), lam(0x2f3a52));
    skirt.position.y=0.45; g.add(skirt);
    for(let i=-3;i<=3;i++){
      const w=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.9), glowMat(0x8ff0ff));
      w.position.set(i*1.2, 1.9, 1.32); g.add(w);
      const w2=w.clone(); w2.position.z=-1.32; w2.rotation.y=Math.PI; g.add(w2);
    }
    const lampM=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,8), glowMat(0xffe9a8));
    lampM.position.set(4.7,1.8,0); g.add(lampM);
    G.roomGroup.add(g);
    const berth=S.flags.car_berthed;
    L.car={ g, x: berth?21.4:11.4, want: berth?21.4:11.4, dir:1, hold:0,
            mode: berth?'berthed':'loop', lamp:lampM };
    g.position.set(wx(L.car.x), 0, wz(15));
  }

  /* ------------------------------------------------------- the findings */
  function findTarget(f, x, z){
    const g=new THREE.Group(); g.position.set(x,0,z);
    G.roomGroup.add(g);
    target(g, x, 1.0, z, 2.0, 2.2, 2.0,
           { kind:'find', id:f.id, label:say(f.name), enter:'find:'+f.id });
    L.finds[f.id]=g;
    return g;
  }
  function finds(){
    FINDS.forEach(f=>{
      if(f.id==='crate') return;                   // it arrives with the robot
      const M=L.marks[f.at]; if(!M) return;
      const x=wx(M.x), z=wz(M.z);
      const g=new THREE.Group(); g.position.set(x,0,z);
      if(f.id==='counter'){
        const p=new THREE.Mesh(new THREE.BoxGeometry(0.7,2.2,0.5), lam(0x2e3a5c));
        p.position.y=1.1; g.add(p);
        const scr=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.6), glowMat(0xffd8a8));
        scr.position.set(0,1.9,0.27); g.add(scr);
      } else if(f.id==='stub'){
        const r=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.06,1.0), lam(0xf4f0ff));
        r.position.y=0.9; r.rotation.z=0.08; g.add(r);
        const rail=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.14,0.14), lam(0x8b93ad));
        rail.position.y=0.84; g.add(rail);
      } else if(f.id==='tag'){
        const drag=new THREE.Mesh(new THREE.PlaneGeometry(7.5,1.1),
          new THREE.MeshBasicMaterial({color:0x2b3350, transparent:true, opacity:0.85}));
        drag.rotation.x=-Math.PI/2; drag.position.set(-3.4, 0.06, 0);
        drag.userData.flat=true; g.add(drag);
        const tg=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.05,0.8), lam(0xff9aa2));
        tg.position.y=0.1; tg.rotation.y=0.5; g.add(tg);
      }
      G.roomGroup.add(g);
      target(g, x, 1.0, z, 2.0, 2.2, 2.0,
             { kind:'find', id:f.id, label:say(f.name), enter:'find:'+f.id });
      L.finds[f.id]=g;
    });
  }

  /* -------------------------------------------------------- the witnesses
     Real bodies out of the same cast the player could be wearing, standing
     where their job would put them, with a plate over their head. */
  async function people(){
    const KL=K();
    for(const p of KL.PEOPLE){
      const mk=L.marks[{depot:'a', gate:'b', transit:'c', maint:'d'}[p.at]];
      if(!mk) continue;
      const x=wx(mk.x), z=wz(mk.z);
      const g=new THREE.Group(); g.position.set(x, 0.1, z);
      g.rotation.y=Math.PI;
      G.roomGroup.add(g);
      target(g, x, 1.15, z, 1.6, 2.2, 1.4,
             { kind:'npc', id:p.id, label:say(p.name), enter:'person:'+p.id });
      if(window.OWN){
        const tag=OWN.plate(p.name.split(' ')[0], p.tint);
        if(tag){ tag.position.set(x, 2.9, z); tag.scale.set(4.0,1.0,1); G.roomGroup.add(tag); }
      }
      L.people.push({ p, g, model:null, x, z });
    }
    if(!window.AVATAR) return;
    /* Never the character the player is wearing for the first of them, and
       a different one each after that: four witnesses who are all you is
       not a cast. */
    const ids=AVATAR.CHARS.map(c=>c.id).filter(id=>id!==AVATAR.chosen);
    for(let i=0;i<L.people.length;i++){
      const who=ids.length ? ids[i%ids.length] : AVATAR.other();
      try{
        const root=await AVATAR.load(who);
        if(!on || !L) return;
        L.people[i].g.add(root);
        L.people[i].model=root;
      }catch(e){}
    }
  }

  /* =================================================================
     THE FRAME — animation always, interaction only when the world is live
     ================================================================= */
  function tick(dt){
    if(!on || !L) return;
    L.t += dt;
    barsTick(dt);
    robotTick(dt);
    carTick(dt);
    peopleTick(dt);
    lampTick(dt);
    if(!frozen()) { prompt_(); waypoint(); }
  }
  function frozen(){
    return !!panel || noteUp || !$('#pause').classList.contains('hidden');
  }

  function barsTick(dt){
    for(const id in L.bars){
      const b=L.bars[id];
      if(Math.abs(b.k-b.want)<0.001) continue;
      b.k += (b.want-b.k)*Math.min(1, dt*4.2);
      b.g.position.y = -3.4*b.k;
    }
  }
  const ROUND_T=11;            // seconds for one leg of KR-9's round
  function robotTick(dt){
    const r=L.robot; if(!r) return;
    r.eye.material.color.setHex(r.mode==='round' ? 0xff9aa2 : 0x8ff0ff);
    if(r.mode==='round'){
      r.k += (dt/ROUND_T)*r.dir;
      if(r.k>=1){ r.k=1; r.hold+=dt; if(r.hold>1.4){ r.hold=0; r.dir=-1; } }
      else if(r.k<=0){ r.k=0; r.hold+=dt; if(r.hold>1.4){ r.hold=0; r.dir=1; } }
      place(r.k);
    } else if(r.mode==='home'){
      if(r.k>0){ r.k=Math.max(0, r.k-(dt/ROUND_T)*1.7); place(r.k); }
      else if(!r.parked){
        r.parked=true;
        r.g.rotation.y=Math.PI;
        dropCrate();
        flag('crate_home');
        brief(say('KR-9 is on its dock, and whatever it has been carrying is on the floor beside it.'));
        sound('good');
      }
    }
  }
  const CAR_HOME=11.4, CAR_END=21.4;
  function carTick(dt){
    const c=L.car; if(!c) return;
    const speed=7.5;
    if(c.mode==='berthed'){ c.want=CAR_END; }
    else if(c.mode==='run'){
      // one pass down the line and back, without stopping
      if(c.dir>0 && c.x>=CAR_END-0.05) c.dir=-1;
      if(c.dir<0 && c.x<=CAR_HOME+0.05){ c.dir=1; c.mode='loop'; }
      c.want = c.dir>0 ? CAR_END : CAR_HOME;
    } else c.want=CAR_HOME;
    const d=c.want-c.x;
    if(Math.abs(d)>0.02) c.x += Math.sign(d)*Math.min(Math.abs(d), speed*dt/U);
    else if(c.mode==='berthed' && !S.flags.car_berthed){
      flag('car_berthed'); openBar('plat');
      brief(say('Car 2 is standing at the old platform with its doors open. The shutter is up.'));
    }
    c.g.position.x=wx(c.x);
    c.lamp.material.color.setHex(c.mode==='berthed' ? 0xa8e6cf : 0xffe9a8);
  }
  /* A witness turns to whoever has walked up to them, from about the
     distance you would look up from what you were doing. Somebody who
     answers questions with their back to you is scenery. */
  function peopleTick(dt){
    L.people.forEach(w=>{
      const dx=G.pos.x-w.x, dz=G.pos.z-w.z;
      if(dx*dx+dz*dz < 100){
        const want=Math.atan2(dx,dz)+Math.PI;
        let d=want-w.g.rotation.y;
        d=Math.atan2(Math.sin(d), Math.cos(d));
        w.g.rotation.y += d*Math.min(1, dt*3.4);
      }
      if(window.AVATAR && w.model) AVATAR.animate(w.model, dt, 'idle');
    });
  }
  /* Machines breathe. A lamp that is simply on reads as a painted dot; one
     that pulses reads as something running — and with no light to dim,
     the pulse is the bulb itself growing and shrinking, which carries
     further across a dark yard than a brightness change would. */
  function lampTick(dt){
    const b=1+Math.sin(L.t*2.1)*0.16;
    for(const id in L.lamps){
      const l=L.lamps[id];
      if(!l.collar) continue;                      // KR-9's eye does its own thing
      const st=(L.machines[id]||{}).status||'IDLE';
      l.bulb.scale.setScalar(st==='IDLE' ? 1 : b);
    }
  }

  /* ---------------------------------------------------- what is in reach
     The crosshair first, because looking at a thing and pressing the key
     is how every other interaction in this game works — and a short
     proximity fallback after it, because a nine-year-old standing on top
     of a console and looking over it should still be offered the console. */
  /* REACH is how close you have to be standing; AIM is how far the
     crosshair can claim something from. Aiming is allowed to be longer
     than standing — you point at a thing across a yard and walk to it —
     but not unlimited: without a cap, standing at one console and
     glancing past it at another put the wrong machine under [E]. */
  const REACH=4.6, AIM=9;
  function inReach(){
    const f=G.focused;
    if(f && f.userData && f.userData.trail){
      const w=new THREE.Vector3(); f.getWorldPosition(w);
      if(Math.hypot(w.x-G.pos.x, w.z-G.pos.z) <= AIM) return f.userData;
    }
    let best=null, bd=REACH;
    const w=new THREE.Vector3();
    L.spots.forEach(s=>{
      s.group.getWorldPosition(w);
      const d=Math.hypot(w.x-G.pos.x, w.z-G.pos.z);
      if(d<bd){ bd=d; best=s; }
    });
    return best;
  }
  function prompt_(){
    const u=inReach();
    L.near=u||null;
    const p=$('#usePrompt'); if(!p) return;
    p.classList.toggle('hidden', !u);
    if(!u) return;
    const word = u.kind==='npc' ? say('talk to {n}',{n:u.label})
               : u.kind==='find' ? say('examine {n}',{n:u.label})
               : say('inspect {n}',{n:u.label});
    p.innerHTML='<kbd>E</kbd> '+esc(word);
  }

  /* A ring on the ground under whatever the objective is about. The
     walkthrough on Senio draws one of these; this one is permanent,
     because an investigation is not a walkthrough — it never tells you
     the answer, it only says which way the next question is. */
  function waypoint(){
    const st=stage(), aim=aimOf(st);
    if(!aim){ if(L.waypoint) L.waypoint.g.visible=false; return; }
    if(!L.waypoint){
      const g=new THREE.Group();
      const m=()=>new THREE.MeshBasicMaterial({color:0xffe9a8, transparent:true, opacity:0.75});
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1.8,0.09,8,40), m());
      ring.rotation.x=-Math.PI/2; ring.position.y=0.08; g.add(ring);
      const dart=new THREE.Mesh(new THREE.ConeGeometry(0.4,0.95,12), m());
      dart.rotation.x=Math.PI; g.add(dart);
      g.userData.flat=true;
      G.roomGroup.add(g);
      L.waypoint={ g, ring, dart };
    }
    const w=L.waypoint;
    w.g.visible=true;
    w.g.position.set(aim.x, 0, aim.z);
    w.ring.rotation.z += 0.02;
    w.dart.position.y = 3.3 + Math.sin(L.t*2.6)*0.22;
    // faded once you are standing on it: a marker over your own feet is noise
    const d=Math.hypot(aim.x-G.pos.x, aim.z-G.pos.z);
    const a=Math.max(0, Math.min(0.8, (d-3)/9));
    w.ring.material.opacity=a; w.dart.material.opacity=a;
  }
  function aimOf(st){
    if(!st || !st.at) return null;
    if(st.at==='robot') return L.robot ? { x:L.robot.g.position.x, z:L.robot.g.position.z } : null;
    const zone=ZONES.find(z=>z.id===st.at);
    if(zone) return { x:wx(zone.x), z:wz(zone.z) };
    const mk=L.marks[st.at];
    return mk ? { x:wx(mk.x), z:wz(mk.z) } : null;
  }

  /* =================================================================
     INPUT
     ================================================================= */
  function key(e){
    if(!on) return false;
    if(e.code==='Escape'){
      if(panel){ closePanel(); return true; }
      if(noteUp){ hideNote(); return true; }
      return false;
    }
    if(e.code==='KeyN'){ noteUp ? hideNote() : showNote(); return true; }
    if(e.code==='KeyE'){
      if(panel || noteUp) return true;
      use(); return true;
    }
    return false;
  }
  function use(){
    if(!L || !L.near) return;
    const u=L.near;
    if(u.kind==='machine') openMachine(u.id);
    else if(u.kind==='npc') openPerson(u.id);
    else if(u.kind==='find') openFind(u.id);
  }

  /* =================================================================
     THE MACHINE INSPECTOR

     Nothing in here knows what a gate is. It is handed a rule, a set of
     switches and a place to put the answer, and everything it draws is
     generated from those — which is why the same panel can show a bare
     `if`, a four-branch ladder and a cross-reference of four Booleans
     without a single special case between them.
     ================================================================= */
  function host(){
    let el=$('#insp');
    if(!el){ el=document.createElement('div'); el.id='insp'; document.body.appendChild(el); }
    return el;
  }
  function openPanel(kind, id){
    panel={ kind, id, tab:null, out:null, order:null, picked:null };
    if(document.pointerLockElement) document.exitPointerLock();
    host().classList.remove('hidden');
    const p=$('#usePrompt'); if(p) p.classList.add('hidden');
    sound('open2');
  }
  function closePanel(quiet){
    panel=null;
    const el=$('#insp');
    if(el){ el.classList.add('hidden'); el.innerHTML=''; }
    if(!quiet) sound('close');
  }

  function openMachine(id){
    const m=L.machines[id]; if(!m) return;
    const mac=m.mac;
    openPanel('machine', id);
    panel.tab = id==='terminal' ? 'rule' : null;
    // the rule the player is looking at: their reordered copy, if they made one
    m.rule = m.rule || cloneRule(mac.rule);
    // the switches remember what they were left on
    K().ruleNames(m.rule).forEach(n=>{ if(m.state[n]===undefined) m.state[n]=false; });
    if(mac.locked) readings(m);
    file(({sensor:'sensor_rule', robot:'robot_rule', gate:'gate_rule',
           transit:'transit_rule', door:'door_rule', terminal:'note'})[id]);
    used(mac.concept);
    drawMachine();
  }
  const cloneRule = r => ({ branches: r.branches.map(b=>Object.assign({}, b)) });
  /* The terminal does not have switches. Its readings come off the
     notebook, because a cross-reference is only as true as the evidence
     under it — and that is the point being made. */
  function readings(m){
    const KL=K();
    Object.keys(KL.CLUES).forEach(k=>{
      const c=KL.CLUES[k];
      if(c.sets) m.state[c.sets] = !!S.clues[k];
    });
  }

  function drawMachine(){
    const m=L.machines[panel.id], mac=m.mac, KL=K();
    const src=KL.source(m.rule);
    const out=panel.out;
    const ran = out ? out.trace.find(x=>x.ran) : null;
    const tabs = panel.id==='terminal' ? termTabs() : '';

    let body='';
    if(panel.id==='terminal' && panel.tab!=='rule'){
      body = panel.tab==='night' ? nightPane() : namePane();
    } else {
      /* ONE PICTURE OF THE RULE, NOT TWO. This printed the rule as source
         and then drew a condition/true/false diagram of the same rule
         underneath it — the condition twice, both actions twice, ninety
         words on screen before a nine-year-old could press anything. The
         source IS that diagram. All the diagram added was a mark saying
         which way each test went, so that is all it adds now, on the line
         it belongs to. */
      body = `
      ${mac.lead ? `<p class="mi-lead">${esc(say(mac.lead))}</p>` : ''}
      <section class="mi-sec">
        <h4>${say('WHAT IT DECIDES')}</h4>
        ${ladder(m, out)}
      </section>
      ${switchPane(m, mac)}
      ${resultPane(m, out, ran)}
      ${logPane(mac)}
      ${historyPane(m)}`;
    }

    host().innerHTML=`
      <div class="mi-card">
        <header class="mi-head">
          <span class="mi-em">${mac.em}</span>
          <div class="mi-id"><b>${esc(say(mac.name))}</b>
            <span>${esc(say(mac.sub||''))}</span></div>
          <span class="mi-chip ${m.status.toLowerCase()}">${say(m.status)}</span>
          <button class="mi-x" id="miX" title="${say('Close')}">✕</button>
        </header>
        ${tabs}
        <div class="mi-body">${body}</div>
      </div>`;
    wireMachine(m, mac);
  }

  function switchPane(m, mac){
    if(mac.locked){
      const KL=K();
      return `<section class="mi-sec">
        <h4>${say('WHAT THE TERMINAL CAN READ')}</h4>
        <div class="mi-reads">${mac.vars.map(v=>`
          <div class="mi-read ${m.state[v.v]?'on':''}">
            <i></i><code>${esc(v.v)}</code>
            <b>${m.state[v.v]?'TRUE':'FALSE'}</b>
            <small>${esc(say(v.hint||''))} — ${
              m.state[v.v]?say('in your notebook'):say('not found yet')}</small>
          </div>`).join('')}</div>
        <p class="mi-note">${say('Not switches \u2014 what you have found. It cannot read evidence you have not got.')}</p>
        <div class="mi-run">
          <button class="btn good" id="miRun">\u25B6 ${say('CROSS-REFERENCE')}</button>
        </div>
      </section>`;
    }
    return `<section class="mi-sec">
      <h4>${say('SET THE READINGS')}</h4>
      <div class="mi-sw">${mac.vars.map(v=>`
        <div class="mi-swrow">
          <div class="mi-swid"><code>${esc(v.v)}</code>
            ${v.hint?`<small>${esc(say(v.hint))}</small>`:''}</div>
          <div class="mi-tf">
            <button class="tf${m.state[v.v]?' on':''}" data-set="${v.v}" data-val="1">TRUE</button>
            <button class="tf${m.state[v.v]?'':' off'}" data-set="${v.v}" data-val="0">FALSE</button>
          </div>
        </div>`).join('')}</div>
      <div class="mi-run">
        <button class="btn good" id="miRun">▶ ${say('RUN TEST')}</button>
        ${mac.vars.length<=3 ? `<button class="btn small ghost" id="miAll">${
          panel.table ? say('hide the table') : say('every combination')}</button>` : ''}
      </div>
      ${panel.table ? tablePane(m) : ''}
    </section>`;
  }

  /* The rule, as the source it is, with one mark per line saying which way
     that test went. It is the only way to show what elif really does — a
     branch under a true one is not false, it was never asked — and for a
     plain if/else it is equally the condition, the true side and the false
     side, which is why nothing draws those a second time any more. */
  function ladder(m, out){
    const KL=K(), br=m.rule.branches, can=!!m.mac.swap;
    const rows=br.map((b,i)=>{
      const tr=out ? out.trace[i] : null;
      const cls = !tr ? '' : tr.ran ? 'ran' : tr.tested ? 'no' : 'skip';
      /* NEVER ASKED is the whole lesson and it must not be spent on the
         wrong row. A branch with a condition that was skipped really was
         never asked — that is why moving a line changes the answer. An
         else has no test to ask, so when it is skipped it was simply not
         reached, and saying otherwise teaches the distinction wrong. */
      const mark = !tr ? ''
                 : tr.ran ? (b.kind==='else' ? say('run') : 'TRUE')
                 : tr.tested ? 'FALSE'
                 : b.kind==='else' ? say('not reached') : say('never asked');
      const movable = can && b.kind!=='else';
      const head = b.kind==='else' ? '<i>else</i>:'
                 : `<i>${b.kind}</i> ${esc(KL.text(b.cond))}:`;
      return `<li class="lrow ${cls}">
        <code class="lsrc">${head}</code>
        <span class="lmark">${mark}</span>
        <code class="lact">${esc(b.action)}</code>
        ${movable?`<span class="lmv">
          <button data-mv="${i}" data-dir="-1" ${i===0?'disabled':''} title="${say('move up')}">▲</button>
          <button data-mv="${i}" data-dir="1" ${i>=br.length-2?'disabled':''} title="${say('move down')}">▼</button>
        </span>`:''}
      </li>`;
    }).join('');
    /* the nudge goes away once it has been taken: an instruction that is
       still on the screen after you have followed it reads as a failure */
    const askIt = can && !has('order_matters');
    return `<ol class="lad">${rows}</ol>
      ${askIt?`<p class="mi-note">${esc(say(m.mac.swap.ask))}</p>`:''}`;
  }

  function tablePane(m){
    const KL=K(), tb=KL.table(m.rule);
    return `<div class="mi-tbl"><table>
      <thead><tr>${tb.vars.map(v=>`<th>${esc(v)}</th>`).join('')}
        <th>${say('it does')}</th></tr></thead>
      <tbody>${tb.rows.map(r=>`<tr>
        ${tb.vars.map(v=>`<td class="${r.state[v]?'t':'f'}">${r.state[v]?'TRUE':'FALSE'}</td>`).join('')}
        <td><code>${esc(r.action||say('nothing'))}</code></td></tr>`).join('')}</tbody>
    </table></div>`;
  }

  /* Only once there is one. A RESULT heading over a paragraph telling you
     to press the button directly above it is furniture, and it was the
     third thing on the panel. The branch notes live HERE rather than beside
     every branch for ever: what a machine WOULD do is the rule, which is
     already on screen; what it just DID is news. */
  function resultPane(m, out, ran){
    if(!out) return '';
    const act=ACTIONS[out.action]||null;
    const note = out.note || (out.action ? '' : m.mac.falls);
    return `<section class="mi-sec">
      <h4>${say('RESULT')}</h4>
      <div class="mi-res ${out.action?'':'none'}">
        <code>${esc(out.action||say('nothing happens'))}</code>
        ${note?`<p>${esc(say(note))}</p>`:''}
        ${act&&act.line?`<p class="mi-world">▸ ${esc(say(act.line))}</p>`:''}
      </div>
    </section>`;
  }
  function logPane(mac){
    if(!mac.log || !S.tests[mac.id]) return '';
    return `<section class="mi-sec">
      <h4>${say('DIAGNOSTIC LOG')}</h4>
      <pre class="mi-log">${esc(say(mac.log))}</pre>
    </section>`;
  }
  function historyPane(m){
    const h=m.history||[];
    if(!h.length) return '';
    return `<section class="mi-sec">
      <h4>${say('TESTS YOU HAVE RUN')} <span class="mi-n">${h.length}</span></h4>
      <ul class="mi-hist">${h.slice(-6).reverse().map(r=>`<li>
        ${r.vars.map(v=>`<i class="${v.on?'t':'f'}">${esc(v.n)}</i>`).join('')}
        <b>→</b> <code>${esc(r.act||say('nothing'))}</code></li>`).join('')}</ul>
    </section>`;
  }

  function wireMachine(m, mac){
    const el=host();
    const x=el.querySelector('#miX'); if(x) x.onclick=()=>closePanel();
    el.querySelectorAll('[data-set]').forEach(b=>b.onclick=()=>{
      m.state[b.dataset.set] = b.dataset.val==='1';
      sound('tick'); drawMachine();
    });
    const run=el.querySelector('#miRun'); if(run) run.onclick=()=>runTest(m, mac);
    const all=el.querySelector('#miAll'); if(all) all.onclick=()=>{
      panel.table=!panel.table; sound('tick'); drawMachine(); };
    el.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{
      const i=+b.dataset.mv, d=+b.dataset.dir;
      m.rule=K().reorder(m.rule, i, i+d);
      panel.out=null;
      sound('tick'); drawMachine();
    });
    el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
      panel.tab=b.dataset.tab; sound('tick'); drawMachine(); });
    wireNight(el); wireName(el);
  }

  /* --------------------------------------------------------- RUN TEST
     The one moment the whole mission turns on: a rule, the readings a
     student chose, an answer, and then the district doing it. */
  function runTest(m, mac){
    const KL=K();
    if(mac.locked) readings(m);
    const out=KL.run(m.rule, m.state);
    panel.out=out;
    m.history=m.history||[];
    m.history.push({ vars: mac.vars.map(v=>({ n:v.v, on:!!m.state[v.v] })),
                     act: out.action });
    if(!S.tests[mac.id]){ S.tests[mac.id]=0; }
    S.tests[mac.id]++;
    save();
    used(mac.concept);
    apply(mac, out, m);
    sound(out.action ? 'run' : 'dead');
    drawMachine();
  }

  /* What a result does to the district, and what it files. */
  function apply(mac, out, m){
    const act=ACTIONS[out.action];
    if(act) setStatus(mac.id, act.status);
    const w=act ? act.world : null;
    if(w==='robotHome'){ L.robot.mode='home'; }
    if(w==='robotOut'){ L.robot.mode='round'; L.robot.parked=false; }
    if(w==='gateOpen'){ openBar('gate'); flag('gate_open'); }
    if(w==='gateShut'){ shutBar('gate'); flag('gate_open', false); }
    if(w==='carStops'){ L.car.mode='berthed'; }
    if(w==='carRuns'){
      if(L.car.mode==='berthed'){ shutBar('plat'); flag('car_berthed', false); }
      L.car.mode='run'; L.car.dir=1;
    }
    if(w==='doorOpen' || w==='doorOpenLogged'){ openBar('eng'); flag('door_open'); }
    if(w==='doorShut' || w==='doorAsk'){ shutBar('eng'); flag('door_open', false); }
    /* THE TWO DEPOT MACHINES ARE WIRED TOGETHER, because they are wired
       together in the story: the sensor is what answers the robot's
       question, and a student who makes the sensor fire and then walks
       twenty metres to KR-9 has followed a signal from one machine to
       another rather than flipped a switch twice. */
    if(w==='sensorOn'){
      padLight(true);
      const r=L.machines.robot;
      if(r && !r.state.package_delivered){
        r.state.package_delivered=true;
        brief(say('The pad is lit. KR-9 has been told the package is down — go and run <b>its</b> test.'));
      }
    }
    if(mac.id==='sensor' && !out.action) padLight(false);
    if(w==='crossOk') flag('crossref');

    /* the override each machine prints once it has been run */
    const code={ robot:'code_depot', gate:'code_gate',
                 transit:'code_transit', door:'code_door' }[mac.id];
    if(code) file(code);

    /* THE ORDER LESSON. unlock_and_log() can only fire while emergency is
       also true if a line has been moved — so this is not a guess about
       what the player did, it is the thing itself happening. */
    if(out.action==='unlock_and_log()' && m.state.emergency){
      if(file('order_matters')) brief(say(mac.swap ? mac.swap.found : ''));
    }
    advance();
  }

  /* =================================================================
     THE WITNESSES
     ================================================================= */
  function openPerson(id){
    const p=K().person(id); if(!p) return;
    openPanel('person', id);
    panel.said=null;
    drawPerson();
  }
  function drawPerson(){
    const p=K().person(panel.id);
    const open=p.lines.filter(l=>!l.need || has(l.need));
    const shut=p.lines.filter(l=>l.need && !has(l.need));
    const said=panel.said ? p.lines.find(l=>l.id===panel.said) : null;
    host().innerHTML=`
      <div class="mi-card">
        <header class="mi-head">
          <span class="mi-em">${p.em}</span>
          <div class="mi-id"><b>${esc(say(p.name))}</b><span>${esc(say(p.role))}</span></div>
          <button class="mi-x" id="miX">✕</button>
        </header>
        <div class="mi-body">
          <p class="dl-say">“${esc(say(p.intro))}”</p>
          ${said?`<div class="dl-ans">
            <div class="dl-q">${esc(say(said.q))}</div>
            <p>“${esc(say(said.a))}”</p></div>`:''}
          <section class="mi-sec">
            <h4>${say('ASK ABOUT')}</h4>
            <div class="dl-qs">${open.map(l=>`
              <button class="dl-b${S.flags['q_'+l.id]?' done':''}" data-ask="${l.id}">
                ${esc(say(l.q))}</button>`).join('')
              || `<p class="mi-note">${say('Nothing to ask yet. Go and read a machine, then come back.')}</p>`}
            </div>
            ${shut.length?`<p class="mi-note">${say('{n} more question(s) will make sense once you have found more.',{n:shut.length})}</p>`:''}
          </section>
        </div>
      </div>`;
    const el=host();
    el.querySelector('#miX').onclick=()=>closePanel();
    el.querySelectorAll('[data-ask]').forEach(b=>b.onclick=()=>{
      const l=p.lines.find(x=>x.id===b.dataset.ask);
      panel.said=l.id;
      flag('q_'+l.id);
      if(l.clue) file(l.clue);
      sound('talk');
      drawPerson();
    });
  }

  /* =================================================================
     THINGS YOU PICK UP
     ================================================================= */
  function openFind(id){
    const f=FINDS.find(x=>x.id===id); if(!f) return;
    openPanel('find', id);
    const locked = f.need && !S.flags[f.need];
    if(!locked && f.clue) file(f.clue);
    host().innerHTML=`
      <div class="mi-card">
        <header class="mi-head">
          <span class="mi-em">${f.em}</span>
          <div class="mi-id"><b>${esc(say(f.name))}</b>
            <span>${locked?say('out of reach'):say('added to your notebook')}</span></div>
          <button class="mi-x" id="miX">✕</button>
        </header>
        <div class="mi-body">
          <p class="fi-body">${locked ? esc(say(f.locked)) : say(f.body)}</p>
        </div>
      </div>`;
    host().querySelector('#miX').onclick=()=>closePanel();
  }

  /* =================================================================
     THE TERMINAL'S OTHER TWO JOBS — the night, and the name
     ================================================================= */
  function termTabs(){
    const tabs=[['rule', say('CROSS-REFERENCE')]];
    if(S.flags.crossref) tabs.push(['night', say('THE NIGHT')]);
    if(S.flags.timeline) tabs.push(['name',  say('NAME THEM')]);
    if(tabs.length<2) return '';
    return `<nav class="mi-tabs">${tabs.map(([k,n])=>
      `<button data-tab="${k}" class="${panel.tab===k?'on':''}">${n}</button>`).join('')}</nav>`;
  }
  function order(){
    if(!panel.order){
      panel.order = (S.order && S.order.length===4) ? S.order.slice()
                  : K().ORDER.slice().reverse();
    }
    return panel.order;
  }
  function nightPane(){
    const KL=K(), ord=order();
    return `
      <p class="mi-lead">${say('Four machines acted that night, and every one of them printed the time it did. Put them in the order they happened.')}</p>
      <ol class="tl">${ord.map((id,i)=>{
        const e=KL.TIMELINE.find(x=>x.id===id), m=KL.machine(id);
        return `<li class="tlrow">
          <span class="tlem">${m.em}</span>
          <div class="tltx"><b>${esc(say(m.name))}</b><span>${esc(say(e.what))}</span></div>
          <span class="tlmv">
            <button data-tl="${i}" data-dir="-1" ${i===0?'disabled':''}>▲</button>
            <button data-tl="${i}" data-dir="1" ${i===ord.length-1?'disabled':''}>▼</button>
          </span></li>`;
      }).join('')}</ol>
      <div class="mi-run"><button class="btn good" id="tlGo">${say('CONFIRM THE ORDER')}</button></div>
      ${panel.tlMsg?`<p class="mi-note ${panel.tlOk?'good':''}">${esc(panel.tlMsg)}</p>`:''}
      ${S.flags.timeline?`<div class="tl-done">${KL.TIMELINE.map(e=>{
        const m=KL.machine(e.id);
        return `<div class="tl-row"><b>${esc(e.at)}</b> ${m.em} ${esc(say(e.what))}</div>`;
      }).join('')}</div>`:''}`;
  }
  function wireNight(el){
    el.querySelectorAll('[data-tl]').forEach(b=>b.onclick=()=>{
      const i=+b.dataset.tl, d=+b.dataset.dir, o=order();
      if(i+d<0 || i+d>=o.length) return;
      const t=o[i]; o[i]=o[i+d]; o[i+d]=t;
      panel.tlMsg=null; sound('tick'); drawMachine();
    });
    const go=el.querySelector('#tlGo');
    if(go) go.onclick=()=>{
      const KL=K(), o=order(), right=KL.ORDER;
      const n=o.filter((id,i)=>id===right[i]).length;
      S.order=o.slice(); save();
      if(n===4){
        panel.tlOk=true;
        panel.tlMsg=say('That is the night. 02:02, 02:14, 02:31, 02:48.');
        /* left on this tab rather than thrown onto the next one: the four
           times lining up is the thing that was just earned, and a screen
           that jumps away from it is a screen that hides the answer */
        flag('timeline'); sound('good');
      } else {
        panel.tlOk=false;
        panel.tlMsg=say('{n} of the 4 are in the right place. Every machine prints its own time — go and read them off.',{n});
        sound('dead');
      }
      drawMachine();
    };
  }

  function namePane(){
    const KL=K();
    if(!has('roster')){
      return `<p class="mi-lead">${say('Every one of the four overrides carries the same code: <b>M-4471 · MAINT CREW 4</b>.')}</p>
        <p class="mi-note">${say('An override is issued to a CREW, not to a person. You cannot put a name to a crew code from here — somebody in this district keeps the roster.')}</p>
        <div class="mi-run"><button class="btn small ghost" id="miWho">${say('who keeps the roster?')}</button></div>
        ${panel.rost?`<p class="mi-note">${say('The maintenance technician, in the room next door.')}</p>`:''}`;
    }
    const picked=panel.picked ? KL.SUSPECTS.find(s=>s.id===panel.picked) : null;
    return `<p class="mi-lead">${say('Four overrides, one code, one crew, one night. Name them.')}</p>
      <div class="sus">${KL.SUSPECTS.map(s=>`
        <button class="susb${panel.picked===s.id?' on':''}${
          S.flags.named && s.right?' right':''}" data-sus="${s.id}">
          <b>${esc(say(s.name))}</b><small>${esc(say(s.role))}</small></button>`).join('')}</div>
      ${picked?`<div class="sus-why ${picked.right?'yes':'no'}">
        <b>${picked.right?say('That is the one.'):say('Not this one.')}</b>
        <p>${esc(say(picked.why))}</p></div>`:''}
      ${picked&&!picked.right&&!S.flags.named
        ? `<p class="mi-note">${say('A theory that turns out wrong is still how you get to the right one. Try another.')}</p>`:''}
      ${picked&&picked.right&&!S.flags.named
        ? `<div class="mi-run"><button class="btn good" id="miAcc">${say('FILE THE CASE')}</button></div>`:''}`;
  }
  function wireName(el){
    const who=el.querySelector('#miWho');
    if(who) who.onclick=()=>{ panel.rost=true; sound('tick'); drawMachine(); };
    el.querySelectorAll('[data-sus]').forEach(b=>b.onclick=()=>{
      panel.picked=b.dataset.sus;
      const s=K().SUSPECTS.find(x=>x.id===panel.picked);
      if(!s.right){ S.tries=(S.tries||0)+1; save(); sound('dead'); }
      else sound('good');
      drawMachine();
    });
    const acc=el.querySelector('#miAcc');
    if(acc) acc.onclick=()=>{ flag('named'); closePanel(); };
  }

  /* =================================================================
     THE NOTEBOOK
     ================================================================= */
  const TABS=[['rules', 'CODE RULES'], ['evidence','EVIDENCE'],
              ['people','PEOPLE'], ['places','PLACES'], ['theory','WHERE I AM']];
  let noteTab='rules';
  function noteHost(){
    let el=$('#tnote');
    if(!el){ el=document.createElement('div'); el.id='tnote'; document.body.appendChild(el); }
    return el;
  }
  function showNote(){
    if(!on) return;
    noteUp=true;
    if(document.pointerLockElement) document.exitPointerLock();
    noteHost().classList.remove('hidden');
    const p=$('#usePrompt'); if(p) p.classList.add('hidden');
    sound('open2');
    paintNote();
  }
  function hideNote(){
    noteUp=false;
    const el=$('#tnote'); if(el){ el.classList.add('hidden'); el.innerHTML=''; }
  }
  function paintNote(){
    if(!noteUp) return;
    const KL=K();
    const ids=Object.keys(S.clues).filter(k=>KL.CLUES[k]);
    const body = noteTab==='places' ? placesPane()
               : noteTab==='theory' ? theoryPane()
               : ids.filter(k=>KL.CLUES[k].tab===noteTab).map(k=>{
                   const c=KL.CLUES[k];
                   return `<li><b>${esc(say(c.head))}</b><p>${say(c.body)}</p></li>`;
                 }).join('') || `<li class="nb-none">${say('Nothing filed here yet.')}</li>`;
    noteHost().innerHTML=`
      <div class="nb-card">
        <header class="nb-head">
          <b>${say('NOTEBOOK')}</b>
          <span>${say('{n} of {m} filed',{n:ids.length, m:Object.keys(KL.CLUES).length})}</span>
          <button class="mi-x" id="nbX">✕</button>
        </header>
        <nav class="nb-tabs">${TABS.map(([k,n])=>
          `<button data-nb="${k}" class="${noteTab===k?'on':''}">${say(n)}</button>`).join('')}</nav>
        <ul class="nb-list">${body}</ul>
      </div>`;
    const el=noteHost();
    el.querySelector('#nbX').onclick=()=>hideNote();
    el.querySelectorAll('[data-nb]').forEach(b=>b.onclick=()=>{
      noteTab=b.dataset.nb; sound('tick'); paintNote(); });
  }
  function placesPane(){
    const seen=id=>{
      if(id==='old')   return !!S.flags.car_berthed;
      if(id==='eng')   return !!S.flags.door_open;
      return true;
    };
    return ZONES.filter(z=>z.id!=='street'&&z.id!=='line'&&z.id!=='yard')
      .map(z=>`<li><b>${seen(z.id)?esc(say(z.name)):'— ?'}</b>
        <p>${seen(z.id)?say('On the map.'):say('You have not been in here yet.')}</p></li>`).join('');
  }
  function theoryPane(){
    /* Past the last stage there is no "right now" — and printing the last
       objective as though it were still open told a student who had just
       finished the mission to go and finish it. */
    const over=S.stage>=STAGES.length;
    const done=STAGES.slice(0, Math.min(S.stage, STAGES.length));
    const head = over
      ? `<li><b>${say('CASE CLOSED')}</b><p>${esc(say('Every machine in this district was doing exactly what it was told. Somebody told it.'))}</p></li>`
      : (st=>`<li><b>${say('RIGHT NOW')}</b><p>${esc(say(st.obj))}</p>
          <p class="nb-hint">${esc(say(st.hint))}</p></li>`)(stage());
    return head
      + done.map(s=>`<li class="nb-done"><b>✓ ${esc(say(s.obj))}</b></li>`).reverse().join('');
  }
  function noteButton(){
    let b=$('#btnNote');
    if(!b){
      b=document.createElement('button');
      b.id='btnNote'; b.className='btn small ghost';
      b.title=say('Notebook (N)');
      const bar=$('#topbar');
      if(bar) bar.insertBefore(b, bar.firstChild);
      else document.body.appendChild(b);
    }
    b.textContent='\u{1F4D3}';
    b.classList.remove('hidden');
    b.onclick=()=>{ noteUp?hideNote():showNote(); };
  }

  /* =================================================================
     THE OBJECTIVE PANEL, THE MAP, AND THE LITTLE THINGS
     ================================================================= */
  function paintObj(){
    const o=$('#objList'); if(!o) return;
    if(S.stage>=STAGES.length){
      o.innerHTML=`<li class="cur">✅ <b>${say('CASE CLOSED')}</b></li>`;
      return;
    }
    const st=stage();
    o.innerHTML=`<li class="cur">\u{1F50E} ${esc(say(st.obj))}</li>
      <li>${esc(say(st.hint))}</li>
      <li>${say('{n} of {m} clues filed',{n:Object.keys(S.clues).length,
                                          m:Object.keys(K().CLUES).length})}
        · <kbd>N</kbd> ${say('notebook')}</li>`;
  }
  function legend(){
    const el=$('#maplegend'); if(!el) return;
    el.innerHTML=`<span><i style="background:#8fd3ff"></i>${say('machine')}</span>
      <span><i style="background:#ffd8a8"></i>${say('witness')}</span>
      <span><i style="background:#a8e6cf"></i>${say('you')}</span>`;
  }
  function map(){
    if(!on || !L) return;
    const c=$('#map'); if(!c) return;
    const x=c.getContext('2d');
    const W=PLAN[0].length, H=PLAN.length;
    const sc=Math.min((c.width-4)/W, (c.height-4)/H);
    const ox=(c.width-W*sc)/2, oy=(c.height-H*sc)/2;
    x.clearRect(0,0,c.width,c.height);
    x.fillStyle='#0b1120'; x.fillRect(0,0,c.width,c.height);
    for(let z=0;z<H;z++) for(let i=0;i<PLAN[z].length;i++){
      const ch=PLAN[z][i];
      if(ch===' ') continue;
      x.fillStyle = ch==='#' ? '#28325a' : '#161f38';
      x.fillRect(ox+i*sc, oy+z*sc, sc, sc);
    }
    // the machines, the people, and the way out of the room you are in
    const pip=(tx,tz,col)=>{ x.fillStyle=col;
      x.beginPath(); x.arc(ox+(tx+0.5)*sc, oy+(tz+0.5)*sc, Math.max(1.6,sc*0.38), 0, 6.283); x.fill(); };
    L.spots.forEach(s=>{
      const w=new THREE.Vector3(); s.group.getWorldPosition(w);
      pip(w.x/U, w.z/U, s.kind==='npc' ? '#ffd8a8'
                       : s.kind==='find' ? '#cdb4f6' : '#8fd3ff');
    });
    // the objective
    const aim=aimOf(stage());
    if(aim){
      x.strokeStyle='#ffe9a8'; x.lineWidth=2;
      x.beginPath(); x.arc(ox+(aim.x/U+0.5)*sc, oy+(aim.z/U+0.5)*sc, sc*0.9, 0, 6.283); x.stroke();
    }
    // you, pointing where you look
    const px=ox+(G.pos.x/U+0.5)*sc, pz=oy+(G.pos.z/U+0.5)*sc;
    x.save(); x.translate(px,pz); x.rotate(-G.yaw+Math.PI);
    x.fillStyle='#a8e6cf';
    x.beginPath(); x.moveTo(0,-5); x.lineTo(-4,4); x.lineTo(4,4); x.closePath(); x.fill();
    x.restore();
  }

  function brief(html){
    const b=$('#briefing'); if(!b) return;
    b.classList.remove('hidden'); b.innerHTML=html;
    clearTimeout(brief._t);
    brief._t=setTimeout(()=>{ if(on) b.classList.add('hidden'); }, 6000);
  }
  /* A clue filing itself is worth one line and no interruption. */
  function toast(head){
    let el=$('#tToast');
    if(!el){ el=document.createElement('div'); el.id='tToast'; document.body.appendChild(el); }
    el.innerHTML=`<b>\u{1F4D3} ${say('FILED')}</b> ${esc(say(head))}`;
    el.classList.add('on');
    clearTimeout(toast._t);
    toast._t=setTimeout(()=>el.classList.remove('on'), 2600);
  }

  /* =================================================================
     THE END
     ================================================================= */
  function finish(){
    flag('finished');
    if(window.PROGRESS) PROGRESS.complete('trail');
    const KL=K();
    const learnt=KL.LESSONS.filter(l=>S.lessons[l.k]);
    const rows=(learnt.length?learnt:KL.LESSONS).map(l=>{
      const m=KL.machine(l.on);
      return `<div class="db-row"><b>${m.em} ${esc(say(l.head))}</b>
        <span>${esc(say(l.body))}</span></div>`;
    }).join('');
    if(window.showResults) showResults({
      title: say('“MACHINES DON’T MAKE RANDOM DECISIONS. THEY FOLLOW RULES.”'),
      body: say('Ilana Vey could not make anybody listen, so she taught four machines to keep saying it until somebody read them. You read them. <b>Change the condition. Change the outcome.</b>'),
      stats: `<div class="db" style="grid-column:1/-1">
        <div class="db-h">${say('WHAT YOU ACTUALLY USED')}</div>${rows}
        <div class="db-h">${say('THE NIGHT OF THE 14th')}</div>
        ${KL.TIMELINE.map(e=>{ const m=KL.machine(e.id);
          return `<div class="db-row"><b>${esc(e.at)} ${m.em}</b><span>${esc(say(e.what))}</span></div>`;
        }).join('')}
        <div class="db-h">${say('FILED AGAINST')}</div>
        <div class="db-row"><b>${esc(KL.SUSPECTS.find(s=>s.right).name)}</b>
          <span>${esc(say(KL.SUSPECTS.find(s=>s.right).why))}</span></div>
      </div>`,
      btnText: say('Back to Koro'),
      onBtn: ()=>{ $('#done').classList.add('hidden');
                   if(window.returnToDesktop) returnToDesktop(); }
    });
    G.running=false;
    sound('win');
  }

  /* =================================================================
     ATMOSPHERE — made rather than fetched, the way the wind is.

     A district at two in the morning has a floor of sound to it: a
     transformer somewhere, and something metal a long way off. Two
     detuned oscillators through a low filter IS that, it costs nothing
     to ship, and it rides the same mute as everything else because a
     teacher who wants silence wants silence.
     ================================================================= */
  let AC=null, bed=null;
  function audio(){
    if(AC) return AC;
    const A=window.AudioContext||window.webkitAudioContext;
    if(!A) return null;
    try{ AC=new A(); }catch(e){ return null; }
    return AC;
  }
  const muted = () => !!(window.MUSIC && MUSIC.muted);
  function ambience(want){
    if(!want){ if(bed){ try{ bed.stop(); }catch(e){} bed=null; } return; }
    if(muted() || bed) return;
    const c=audio(); if(!c) return;
    if(c.state==='suspended') c.resume().catch(()=>{});
    const g=c.createGain(); g.gain.value=0;
    const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=180; f.Q.value=0.8;
    const a=c.createOscillator(), b=c.createOscillator();
    a.type='triangle'; a.frequency.value=54.5;
    b.type='sine';     b.frequency.value=55.4;      // a beat, not a chord
    a.connect(f); b.connect(f); f.connect(g); g.connect(c.destination);
    a.start(); b.start();
    g.gain.setTargetAtTime(0.035, c.currentTime, 1.6);
    bed={ stop(){ g.gain.setTargetAtTime(0, c.currentTime, 0.4);
                  setTimeout(()=>{ try{ a.stop(); b.stop(); }catch(e){} }, 900); } };
  }
  const BLIP={ tick:[660,0.05,'square',0.035], open2:[420,0.12,'sine',0.05],
               close:[300,0.10,'sine',0.04],  run:[540,0.16,'triangle',0.06],
               good:[780,0.26,'triangle',0.07], dead:[150,0.22,'sawtooth',0.045],
               file:[900,0.10,'sine',0.05],   step:[620,0.14,'sine',0.05],
               talk:[380,0.09,'sine',0.04],   open:[220,0.45,'sawtooth',0.05],
               win:[520,0.55,'triangle',0.08] };
  function sound(k){
    const spec=BLIP[k]; if(!spec || muted()) return;
    const c=audio(); if(!c) return;
    if(c.state==='suspended') c.resume().catch(()=>{});
    const [f,d,type,vol]=spec;
    const o=c.createOscillator(), g=c.createGain();
    o.type=type; o.frequency.setValueAtTime(f, c.currentTime);
    if(k==='good'||k==='win') o.frequency.exponentialRampToValueAtTime(f*1.5, c.currentTime+d);
    if(k==='dead'||k==='open') o.frequency.exponentialRampToValueAtTime(f*0.55, c.currentTime+d);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+d);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime+d+0.02);
  }

  return { start, stop, tick, map, key, use,
           get active(){ return on; },
           get busy(){ return !!panel || noteUp; },
           /* so a test — or a teacher — can look at the case without
              having to play it, and so the module is inspectable */
           get state(){ return S; },
           PLAN, ZONES, FINDS, STAGES, ACTIONS };
})();
