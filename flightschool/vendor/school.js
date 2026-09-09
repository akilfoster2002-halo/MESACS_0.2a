/* GENERATED — copied from public/school.js by tools/build-flightschool.js.
   Edit public/school.js and re-run `npm run build:flightschool`. */
/* =====================================================================
   FLIGHT SCHOOL — the grid, before anything is moving at you.

   Space Explorer teaches motion at speed: nine lanes, a wall of rock every
   beat, and a program that is a list of things happening AT A TIME. That
   is the right lesson and it is the wrong first lesson, because a student
   who has not yet met a coordinate is being asked to do arithmetic on one
   while something is flying at them.

   So this comes first, and nothing here moves until you tell it to.

     LEVEL 1   one command, and the whole board is (0,2) to (4,2)
     LEVEL 2   two axes, so x and y are two different questions
     LEVEL 3   a heading of your own, which position cannot give you
     LEVEL 4   glide: one command, both axes, and you watch it cross
     LEVEL 5   an angle that is not a quarter turn
     LEVEL 6   all of it, over a course

   TWO THINGS THIS BOARD IS CAREFUL ABOUT, both of them taken from the
   worksheet it is built from:

   THE AVATAR STANDS ON A LATTICE POINT, not in a square. (0,2) is where
   two lines cross. A grid of boxes teaches "third box along"; a grid of
   lines teaches a coordinate, and the difference shows up the moment
   somebody meets graph paper.

   AND `change x by` MOVES ALONG X WHATEVER YOU ARE FACING. Position and
   heading are separate facts about the avatar, and keeping them separate
   is what stops "turn" being confused with "move". You turn because the
   goal asks you to face somewhere, not to steer.
   ===================================================================== */
window.SCHOOL = (function(){
  const N=5;                          // 0..4 on both axes, exactly the sheet
  const CELL=3.4;                     // world units between two gridlines
  const STEP_MS=520;                  // one command, slow enough to follow
  const GLIDE_MS=1100;                // and a glide is meant to be watched
  const SKY=0x0a0e1c;

  /* Headings are degrees COUNTERCLOCKWISE FROM EAST, because that is what
     they are in every maths lesson these students will ever sit. So east is
     0, north is 90, and `turn 90` is the counterclockwise button on the
     worksheet. A game that taught the other sign would be teaching a habit
     somebody has to unlearn. */
  const COMPASS={ 0:'East', 90:'North', 180:'West', 270:'South' };

  const LEVELS=[
    { id:'one', name:'One Command', budget:1, walk:true,
      pal:['addX','addY'],
      start:{x:0,y:2,a:0}, goal:{x:4,y:2},
      learn:{ name:'A coordinate is two numbers',
              text:'x is across, y is up. Change one and you move along that axis.',
              code:'change x by 4' },
      brief:'Use <b>ONE</b> command to get from <b>(0, 2)</b> to the star at <b>(4, 2)</b>. Only <b>x</b> has changed — so only <b>x</b> needs a command.' },

    { id:'both', name:'Both Axes', budget:2,
      pal:['addX','addY'],
      start:{x:0,y:0,a:0}, goal:{x:3,y:4},
      learn:{ name:'Two axes, two commands',
              text:'x and y are separate questions. Answer them one at a time.',
              code:'change x by 3\nchange y by 4' },
      brief:'From <b>(0, 0)</b> to <b>(3, 4)</b>. Both numbers have changed this time, and each one is its own command. <b>Two blocks.</b>' },

    { id:'face', name:'Which Way You Face', budget:3,
      pal:['addX','addY','turn'],
      start:{x:1,y:0,a:0}, goal:{x:1,y:3,face:90},
      learn:{ name:'Where you are is not which way you point',
              text:'Moving along y does not turn you. Turning does not move you.',
              code:'change y by 3\nturn 90' },
      brief:'Get to <b>(1, 3)</b> <i>and</i> finish facing <b>North</b>. Moving up the board does not turn the ship — <b>turn 90</b> is counterclockwise, <b>turn -90</b> is clockwise.' },

    { id:'glide', name:'Glide', budget:1,
      pal:['glide','addX','addY'],
      start:{x:0,y:0,a:0}, goal:{x:4,y:4},
      learn:{ name:'One command, both axes',
              text:'glide goes to a point rather than adding to where you are — and you watch it cross.',
              code:'glide to 4,4' },
      brief:'From <b>(0, 0)</b> to <b>(4, 4)</b> in <b>ONE</b> block. <b>change x by</b> adds to where you are; <b>glide to</b> goes to the point itself — both numbers at once.' },

    { id:'angle', name:'An Angle That Is Not A Corner', budget:2,
      turnStep:45,
      pal:['glide','turn','addX','addY'],
      start:{x:0,y:4,a:0}, goal:{x:3,y:1,face:45},
      learn:{ name:'Any angle is a number',
              text:'A turn does not have to be a quarter. 45 is half of one.',
              code:'glide to 3,1\nturn 45' },
      brief:'Land on <b>(3, 1)</b> pointing <b>halfway between East and North</b> — that is <b>45°</b>. A turn is just a number of degrees counterclockwise.' },

    { id:'course', name:'The Course', budget:6,
      turnStep:45,
      pal:['glide','turn','addX','addY'],
      start:{x:0,y:0,a:0}, goal:{x:4,y:3,face:180},
      via:[{x:4,y:0},{x:2,y:2}],
      learn:{ name:'All of it',
              text:'Two marks to touch on the way, a point to land on, and a heading to finish on.',
              code:'glide to 4,0\nglide to 2,2\nglide to 4,3\nturn 180' },
      brief:'Touch both <b>rings</b> in order, land on the star at <b>(4, 3)</b>, and finish facing <b>West</b>. <b>Six blocks.</b>' }
  ];

  let on=false, L=null, busy=false, group=null, ship=null, wasFP=null, anim=null;
  let nextT=null;

  const px = x => (x-(N-1)/2)*CELL;   // a coordinate, in world units
  const pz = y => -(y-(N-1)/2)*CELL;  // y is UP the board, so it runs -z

  /* ------------------------------------------------------------- board */
  function label(txt, size){
    const c=document.createElement('canvas'); c.width=c.height=64;
    const x=c.getContext('2d');
    x.fillStyle='#cfe3ff'; x.font='bold 40px "Trebuchet MS",sans-serif';
    x.textAlign='center'; x.textBaseline='middle';
    x.fillText(txt,32,34);
    const tx=new THREE.CanvasTexture(c); tx.colorSpace=THREE.SRGBColorSpace;
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tx, transparent:true, depthWrite:false}));
    s.scale.set(size||1.5, size||1.5, 1);
    return s;
  }
  function board(){
    const g=new THREE.Group();
    const lo=-(N-1)/2*CELL, hi=(N-1)/2*CELL;

    /* The gridlines, and then the two AXES drawn heavier on top of them.
       On the worksheet the axes are the thing you read the numbers off, so
       they cannot be just two more faint lines. */
    const faint=new THREE.LineBasicMaterial({color:0x2f3d5c});
    const pts=[];
    for(let i=0;i<N;i++){
      pts.push(px(i),0,pz(0), px(i),0,pz(N-1));
      pts.push(px(0),0,pz(i), px(N-1),0,pz(i));
    }
    const lg=new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts),3));
    g.add(new THREE.LineSegments(lg, faint));

    const axis=new THREE.MeshBasicMaterial({color:0x8ff0ff});
    const bar=(w,d,x,z)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,0.05,d), axis);
      m.position.set(x,0.01,z); g.add(m); };
    bar((N-1)*CELL+CELL*0.6, 0.10, px(0)+((N-1)*CELL+CELL*0.6)/2-CELL*0.3, pz(0));
    bar(0.10, (N-1)*CELL+CELL*0.6, px(0), pz(0)-((N-1)*CELL+CELL*0.6)/2+CELL*0.3);
    // arrowheads, so the axes read as axes and not as a border
    const head=(rot,x,z)=>{ const m=new THREE.Mesh(new THREE.ConeGeometry(0.28,0.7,3), axis);
      m.position.set(x,0.02,z); m.rotation.set(Math.PI/2,0,rot); g.add(m); };
    head(-Math.PI/2, hi+CELL*0.42, pz(0));
    head(0, px(0), lo-CELL*0.42);

    // the numbers, 0..4 down the x axis and up the y
    for(let i=0;i<N;i++){
      const lx=label(String(i)); lx.position.set(px(i), 0.02, pz(0)+0.95); g.add(lx);
      if(i>0){ const ly=label(String(i)); ly.position.set(px(0)-0.95, 0.02, pz(i)); g.add(ly); }
    }
    const ax=label('x',1.4); ax.position.set(hi+CELL*0.42, 0.02, pz(0)+0.95); g.add(ax);
    const ay=label('y',1.4); ay.position.set(px(0)-0.95, 0.02, lo-CELL*0.42); g.add(ay);
    return g;
  }
  /* A five-pointed star, because that is what is on the sheet. */
  function star(){
    const sh=new THREE.Shape();
    for(let i=0;i<10;i++){
      const r=i%2?0.34:0.85, a=Math.PI/2 + i*Math.PI/5;
      const x=Math.cos(a)*r, y=Math.sin(a)*r;
      i ? sh.lineTo(x,y) : sh.moveTo(x,y);
    }
    sh.closePath();
    const m=new THREE.Mesh(new THREE.ShapeGeometry(sh),
      new THREE.MeshBasicMaterial({color:0xffd23f, side:THREE.DoubleSide}));
    m.rotation.x=-Math.PI/2;
    return m;
  }
  function ring(){
    const m=new THREE.Mesh(new THREE.TorusGeometry(0.62,0.09,8,26),
      new THREE.MeshBasicMaterial({color:0xcdb4f6}));
    m.rotation.x=-Math.PI/2;
    return m;
  }
  /* The avatar: the ship you fly everywhere else, seen from above and sat
     in the worksheet's ring so its heading is unmistakable. */
  function avatar(){
    const g=new THREE.Group();
    const r=new THREE.Mesh(new THREE.TorusGeometry(0.86,0.07,8,30),
      new THREE.MeshBasicMaterial({color:0x8fd3ff}));
    r.rotation.x=-Math.PI/2; g.add(r);
    const hull=(window.SHOP && SHOP.model) ? SHOP.model() : null;
    if(hull){
      /* The ship is built nose down -Z and this board is read from above
         with east to the right, so it is turned a quarter and laid flat. */
      hull.scale.setScalar(0.42);
      hull.rotation.y=-Math.PI/2;
      hull.position.y=0.12;
      g.add(hull);
    } else {
      const n=new THREE.Mesh(new THREE.ConeGeometry(0.34,0.9,3),
        new THREE.MeshBasicMaterial({color:0x8fd3ff}));
      n.rotation.set(Math.PI/2,0,-Math.PI/2); g.add(n);
    }
    return g;
  }

  /* ------------------------------------------------------------- start */
  function start(n){
    stop();
    clearTimeout(nextT); nextT=null;
    const idx=Math.max(0, Math.min(LEVELS.length-1, n||0));
    const K=LEVELS[idx];
    on=true; busy=false;

    G.running=false;
    if(document.pointerLockElement) document.exitPointerLock();
    if(window.PLANET && PLANET.active) PLANET.leave();
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.selected=null; G.focused=null;
    G.room='school'; G.hudOwner='mission'; G.missionId='school';
    G.scene.background=new THREE.Color(SKY);
    G.scene.fog=null;
    G.camera.near=0.3; G.camera.far=200; G.camera.updateProjectionMatrix();
    if(wasFP===null) wasFP=!!G.firstPerson;
    G.firstPerson=false;
    ['#mapwrap','#dash','#pmap','#health','#skill','#trigger'].forEach(q=>{
      const e=document.querySelector(q); if(e) e.classList.add('hidden'); });
    /* The crosshair box still said "Flight School — Motion · E — go in" from
       the console you were looking at a second ago, sitting over the middle
       of the board offering a key that does nothing here. focusScan only
       runs while G.running, which this mission turns off, so it would have
       sat there for the whole level. */
    const fx=document.querySelector('#focus');
    if(fx){ fx.classList.add('hidden'); fx.innerHTML=''; }
    G.focused=null; G.selected=null;

    group=new THREE.Group(); G.roomGroup.add(group);
    group.add(board());
    G.roomGroup.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key=new THREE.DirectionalLight(0xfff2e0, 0.9); key.position.set(4,14,6);
    G.roomGroup.add(key);

    const st=star(); st.position.set(px(K.goal.x), 0.03, pz(K.goal.y)); group.add(st);
    const rings=(K.via||[]).map(v=>{ const r=ring();
      r.position.set(px(v.x),0.03,pz(v.y)); group.add(r); return r; });

    ship=avatar(); group.add(ship);
    L={ idx, K, x:K.start.x, y:K.start.y, a:K.start.a, rings, hit:[] };
    lay(true);

    /* STRAIGHT DOWN ON IT. Every other mission in this game is played from
       inside; this one is played off a sheet of graph paper, and tilting
       the camera even a little makes reading a coordinate a job of
       perspective rather than of counting. */
    const span=(N-1)*CELL;
    /* UP IS -Z, NOT +Y. Looking straight down, the camera's up vector is
       parallel to the direction it is looking, which leaves three with no
       way to decide which way round the picture goes — the board came out
       with its x axis off the bottom of the screen. On a board read from
       directly above, screen-up is north, and north here is -z.

       And the whole thing sits a little high, because the brief prints
       across the bottom of the screen and the x axis is the one line a
       student has to read a number off. */
    /* and a little to the right of the board's centre, which pushes the board
       left on screen and out from under the brief in the top corner — the
       star at (4, 2) was landing on the panel's edge. */
    G.camera.position.set(CELL*0.6, span*1.75, -1.1);
    G.camera.up.set(0,0,-1);
    G.camera.lookAt(CELL*0.6,0,-1.1);

    /* setGrid takes the width of a CENTRED grid and keeps half of it — the
       flight's lanes run -1,0,1 — so it has to be handed twice this board
       plus one to mean "coordinates reach 4". Passing the board's own width
       gave a half-width of 1, and `change x by 4` was quietly clamped to 2:
       the first level of a mission about reading a coordinate, refusing to
       let you write the coordinate. */
    CODE.setGrid(N*2-1, N*2-1);
    /* Quarter turns for the levels about facing, forty-fives for the one
       about angles — so a turn is a quarter until the moment the mission
       says an angle is just a number, and then it is any of them. */
    CODE.setPalette(K.pal); CODE.setBudget(K.budget); CODE.clear();
    if(CODE.hideTape) CODE.hideTape();   // the last level's run, still reading out
    // after setPalette, which resets it — see the note there
    if(CODE.setTurnStep) CODE.setTurnStep(K.turnStep || 90);
    if(K.learn) CODE.setGuide(K.learn);
    hud(); say(t(K.brief));
    // the walkthrough belongs to level one and follows nobody into level two
    if(window.COACH) COACH.stop();
    if(K.walk) coach();
  }

  function lay(snap){
    const tx=px(L.x), tz=pz(L.y), ta=L.a*Math.PI/180;
    if(snap){ ship.position.set(tx,0.05,tz); ship.rotation.y=-ta; }
    L.tx=tx; L.tz=tz; L.ta=-ta;
  }

  /* ------------------------------------------------------- the walkthrough
     THE FIRST LEVEL IS WALKED, because a child who has never opened the
     console is not short of instructions — they are short of knowing that
     the instructions are about a thing they can click. So the thing they
     can click lights up, and nothing else is available while it does.

     COACH already does all of this for the flight: it rings the exact
     element, reads progress out of the world rather than out of what it
     just asked for, and hands each step back so the caller can narrow the
     palette to the one block being asked for. */
  /* NOT called walk(): the step runner below is also called walk(), and a
     second function declaration of the same name in the same scope quietly
     replaces the first. The level asked for its walkthrough and got the
     runner instead, with no arguments — which returns on its first line and
     throws nothing. */
  function coach(){
    if(!window.COACH) return;
    /* The console remembers whether you were last writing words or stacking
       blocks, and the walkthrough is written entirely in blocks — it points
       at a shelf that is not on the screen in typing mode. Somebody's first
       minute is not the place to inherit a preference they have never set. */
    if(window.CODE && CODE.setMode) CODE.setMode('blocks');
    const steps=[
      { say:'This is your ship, at <b>(0, 2)</b>. The star is at <b>(4, 2)</b>. Press <b>C</b> to open the console.',
        find:()=>document.querySelector('#codeBtn'),
        done:()=>!!(window.CODE && CODE.isOpen()),
        pal:[], rails:{run:false, clear:false, mode:false} },
      { say:'Only <b>x</b> changed — 0 to 4. Click the glowing <b>change x by</b> block.',
        sel:'#conPalette [data-add="addX"]',
        done:()=>!!(window.CODE && CODE.script && CODE.script.length),
        pal:['addX'], rails:{run:false, clear:false, mode:false} },
      { say:'It says 1, and you need <b>4</b>. Click the number and type <b>4</b>.',
        sel:'#conScript .numin',
        done:()=>!!(window.CODE && CODE.script && CODE.script[0]
                    && CODE.script[0].n===4),
        pal:['addX'], rails:{run:false, clear:false, mode:false} },
      { say:'That is the whole program. Press <b>RUN</b>.',
        sel:'#conRun',
        done:()=>busy || (L && L.x===L.K.goal.x),
        pal:['addX'], rails:{run:true, clear:true, mode:true} }
    ];
    COACH.start(steps, {
      host: ()=> (window.CODE && CODE.coachHost) ? CODE.coachHost() : null,
      onStep(s){
        if(!window.CODE) return;
        if(!s){ CODE.setPalette(L?L.K.pal:['addX','addY']); CODE.setRails({}); return; }
        if(s.pal) CODE.setPalette(s.pal);
        CODE.setRails(s.rails||{});
      }
    });
  }

  /* ------------------------------------------------------------- run it */
  function run(){
    if(!on || busy) return;
    const steps=(window.CODE && CODE.script && CODE.script.length)
      ? CODE.compile(CODE.script) : [];
    if(!steps.length){ say(t('Write a program first — press <b>C</b>.')); return; }
    L.x=L.K.start.x; L.y=L.K.start.y; L.a=L.K.start.a; L.hit=[];
    L.rings.forEach(r=>r.material.color.setHex(0xcdb4f6));
    lay(true); busy=true;
    walk(steps, 0);
  }
  function walk(steps, at){
    if(!on || !busy) return;
    if(at>=steps.length) return judge();
    const s=steps[at];
    const go=(ms)=>move(()=>walk(steps, at+1), ms);
    if(s.name==='addX'){ L.x=clamp(L.x+(s.n|0)); lay(); return go(STEP_MS); }
    if(s.name==='addY'){ L.y=clamp(L.y+(s.n|0)); lay(); return go(STEP_MS); }
    if(s.name==='glide'){ L.x=clamp(s.col|0); L.y=clamp(s.row|0); lay(); return go(GLIDE_MS); }
    if(s.name==='turn'){ L.a=norm(L.a+(s.n|0)); lay(); return go(STEP_MS); }
    return walk(steps, at+1);
  }
  const clamp = v => Math.max(0, Math.min(N-1, v));
  const norm  = d => ((d%360)+360)%360;

  function move(then, ms){
    const x0=ship.position.x, z0=ship.position.z, a0=ship.rotation.y;
    let da=L.ta-a0; da=Math.atan2(Math.sin(da),Math.cos(da));
    const t0=performance.now();
    anim={ tick(now){
      const k=Math.min(1,(now-t0)/ms), e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      ship.position.x=x0+(L.tx-x0)*e;
      ship.position.z=z0+(L.tz-z0)*e;
      ship.rotation.y=a0+da*e;
      /* A ring counts as touched while you are passing through it, not only
         where you stop — otherwise a course is a list of places to halt. */
      L.rings.forEach((r,i)=>{
        if(L.hit.indexOf(i)>=0) return;
        if(Math.hypot(ship.position.x-r.position.x, ship.position.z-r.position.z)<0.8){
          L.hit.push(i); r.material.color.setHex(0xa8e6cf);
          if(window.beep) beep('pop');
        }
      });
      if(k>=1){ anim=null; then(); }
    }};
  }

  function judge(){
    busy=false;
    const K=L.K, at=(L.x===K.goal.x && L.y===K.goal.y);
    const facing=(K.goal.face===undefined) || (norm(L.a)===norm(K.goal.face));
    const rings=(K.via||[]).length===L.hit.length;
    if(at && facing && rings){
      const last=L.idx>=LEVELS.length-1;
      say(last ? t('🏅 Flight school passed. Coordinates, turns and glides.')
               : t('✅ On the star.'));
      if(last && window.PROGRESS) PROGRESS.complete('school');
      else nextT=setTimeout(()=>{ nextT=null; if(on) start(L.idx+1); }, 1500);
      return;
    }
    /* Say WHICH of the three it was. "Try again" on a board with a position,
       a heading and two rings on it is three different pieces of news. */
    if(!at) say('❌ '+t('You finished at ({x}, {y}). The star is at ({gx}, {gy}).',
                       {x:L.x, y:L.y, gx:K.goal.x, gy:K.goal.y}));
    else if(!rings) say('❌ '+t('You landed on the star, but missed a ring.'));
    else say('❌ '+t('Right place, wrong way round — you are facing {a}, not {b}.',
                     {a:t(COMPASS[norm(L.a)]||norm(L.a)+'°'),
                      b:t(COMPASS[norm(K.goal.face)]||norm(K.goal.face)+'°')}));
  }

  /* ---------------------------------------------------------- the HUD */
  function hud(){
    const nm=document.querySelector('#missionName');
    if(nm) nm.textContent=t('Level {n} — {name}',{n:L.idx+1, name:t(L.K.name)});
    const o=document.querySelector('#objList');
    if(o) o.innerHTML=LEVELS.map((s,i)=>
      `<li class="${i===L.idx?'cur':(i<L.idx?'done':'')}">${t(s.name)}</li>`).join('');
    const h=document.querySelector('#hud'); if(h) h.classList.remove('hidden');
    if(window.keyHint) keyHint(`<b>C</b> ${t('write your program')} &nbsp; <b>RUN</b> ${t('flies it')}`);
  }
  /* THE BRIEF SITS IN THE CORNER HERE, under the level list, rather than
     across the bottom of the screen where every other mission puts it. On a
     board you read by counting squares, a box in the middle of the screen is
     a box over the squares. */
  function say(msg){
    const b=document.querySelector('#briefing'); if(!b) return;
    b.classList.add('corner');
    /* Sits under the MISSION panel, and that panel is as tall as the list of
       levels in it — so the gap is measured rather than guessed. */
    const panel=document.querySelector('#objectives');
    if(panel){ const r=panel.getBoundingClientRect();
      if(r.height>0) b.style.setProperty('--brief-top', Math.round(r.bottom+12)+'px'); }
    b.classList.remove('hidden'); b.innerHTML=msg;
  }

  function tick(dt){
    if(!on) return;
    if(anim) anim.tick(performance.now());
    if(window.COACH && COACH.tick) COACH.tick(dt);
  }
  function stop(){
    clearTimeout(nextT); nextT=null;
    if(!on) return;
    on=false; busy=false; anim=null; L=null; group=null; ship=null;
    if(window.CODE){ CODE.close(); CODE.setGuide(null); CODE.setBudget(0); }
    const mw=document.querySelector('#mapwrap'); if(mw) mw.classList.remove('hidden');
    const bf=document.querySelector('#briefing'); if(bf) bf.classList.remove('corner');
    if(window.COACH) COACH.stop();
    if(wasFP!==null){ G.firstPerson=wasFP; wasFP=null; }
  }

  return { start, run, tick, update:tick, stop,
           get active(){ return on; },
           get busy(){ return busy; },
           get where(){ return L ? {x:L.x, y:L.y, a:norm(L.a)} : null; },
           retry(){ if(L) start(L.idx); },
           count: LEVELS.length, LEVELS };
})();
