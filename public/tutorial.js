/* =====================================================================
   LEVEL 0 — BASICS.  Nothing is chasing you.

   Everything else in KORO asks a student to think about a concept while
   something walks toward them. This one asks for nothing but the hands:
   look, walk, jump, open the console, run a program. It is the only room
   in the game with no threat in it, and that is the whole design — a
   student who has never held W A S D should meet the controls before
   they meet a zombie.

   Five steps, each one ticked off the moment it actually happens, so the
   checklist is a record of what the student did rather than a list of
   things they were told.
   ===================================================================== */
window.TUTOR = (function(){
  const T=4;                                   // world units per tile, same as the corridors
  const W=9, D=9;                              // the plaza, in tiles
  const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];      // N E S W
  const PAL={ floor:0x8d93b4, wall:0x4a4570, walk:0x8fd3ff,
              launch:0xffe9a8, goal:0xa8e6cf, done:0x5f7a5a };

  /* the five things a student does here, in order */
  const STEPS=[
    { id:'look', name:'Look around',
      hint:'Move the <b>mouse</b>, or press <b>←</b> and <b>→</b>, to look around the plaza.' },
    { id:'walk', name:'Walk to the blue pad',
      hint:'Hold <b>W</b> to walk forward. <b>A</b> and <b>D</b> step sideways, <b>S</b> backs up. Get to the <b>blue pad</b>.' },
    { id:'jump', name:'Jump',
      hint:'Press <b>SPACE</b> to jump. Nothing here needs it yet — but the ground is not always flat.' },
    { id:'pad',  name:'Stand on the yellow pad',
      hint:'Walk onto the <b>yellow launch pad</b>. That is where your program starts from.' },
    { id:'run',  name:'Write a program and run it',
      hint:'Press <b>C</b> for the code console. Add <b>four</b> <b>forward()</b> blocks and press <b>RUN</b> to walk to the green door.' }
  ];

  let L=null, busy=false;

  const at=(gx,gz)=>({ x:gx*T, z:gz*T });
  function tile(gx,gz,color,h,yOff){
    const m=new THREE.Mesh(new THREE.BoxGeometry(T*0.96,h||0.4,T*0.96),
      new THREE.MeshLambertMaterial({color}));
    m.position.set(gx*T,(yOff!==undefined?yOff:0),gz*T);
    G.roomGroup.add(m); return m;
  }

  /* ------------------------------------------------------------- build */
  async function start(){
    busy=false;
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; G.ceiling=null;
    G.ground=()=>0.2;                          // the pads are 0.4 thick, so their top is 0.2
    G.scene.background=new THREE.Color(0x1b2740);
    G.scene.fog=new THREE.Fog(0x1b2740, 70, 220);
    G.hudOwner='tut'; G.missionId='tut'; G.room=null; G.running=true;
    if(window.updateLeaveBtn) updateLeaveBtn();
    document.querySelector('#mapwrap').classList.add('hidden');   // no map, it is one room
    document.querySelector('#health').classList.add('hidden');    // and nothing can hurt you
    document.querySelector('#skill').classList.add('hidden');
    document.querySelector('#trigger').classList.add('hidden');

    // spawn off to the side, not on top of the launch pad, or step 4 would
    // tick the instant it became the current step
    L={ step:0, gx:6, gz:7, dir:0, turned:0, lastYaw:0, done:false,
        walkPad:{gx:1,gz:4}, launch:{gx:4,gz:6}, goal:{gx:4,gz:2}, pads:{} };

    // floor, then a low wall all the way round so nobody walks into the void
    for(let x=0;x<W;x++) for(let z=0;z<D;z++){
      const edge = x===0||z===0||x===W-1||z===D-1;
      if(edge){
        tile(x,z,PAL.wall,5.5,2.75);
        G.solids.push({x1:x*T-T/2,x2:x*T+T/2,z1:z*T-T/2,z2:z*T+T/2});
      } else tile(x,z,PAL.floor,0.4,0);
    }
    L.pads.walk   = tile(L.walkPad.gx, L.walkPad.gz, PAL.walk,   0.5, 0.06);
    L.pads.launch = tile(L.launch.gx,  L.launch.gz,  PAL.launch, 0.5, 0.06);
    L.pads.goal   = tile(L.goal.gx,    L.goal.gz,    PAL.goal,   0.5, 0.06);

    const p=at(L.gx,L.gz);
    G.pos.set(p.x, 1.9, p.z);
    G.yaw=0; G.pitch=-0.05; G.vel.y=0; G.onGround=true;
    L.lastYaw=G.yaw;
    if(window.AVATAR) AVATAR.attach();

    CODE.setPalette(['forward','left','right']); CODE.setBudget(6); CODE.clear();
    hud(); brief(STEPS[0].hint);
    teach();
  }

  /* -------------------------------------------------------- the steps */
  function cur(){ return L ? STEPS[L.step] : null; }
  function near(pad, r){
    const p=at(pad.gx,pad.gz);
    return Math.hypot(G.pos.x-p.x, G.pos.z-p.z) < (r||T*0.55);
  }
  function advance(){
    if(!L || L.done) return;
    L.step++;
    if(window.beep) beep('star');
    if(L.step>=STEPS.length) return finish();
    // arriving on the launch pad squares you up, so forward() means what it looks like
    if(cur().id==='run'){
      L.gx=L.launch.gx; L.gz=L.launch.gz; L.dir=0;
      G.yaw=Math.atan2(-DIRS[0][0],-DIRS[0][1]);
    }
    hud(); brief(cur().hint);
    CODE.setGuide({ brief:cur().hint, name:'Commands',
      text:'A command is one instruction. The computer does it once, exactly as written.',
      code:'forward()\nforward()' });
  }

  function tick(dt){
    if(!L || L.done || busy) return;
    const s=cur(); if(!s) return;
    if(s.id==='look'){
      L.turned += Math.abs(G.yaw-L.lastYaw); L.lastYaw=G.yaw;
      if(L.turned>1.2) advance();
    } else if(s.id==='walk'){
      if(near(L.walkPad)) advance();
    } else if(s.id==='jump'){
      if(G.onGround===false) advance();
    } else if(s.id==='pad'){
      if(near(L.launch)) advance();
    }
    // the 'run' step is finished by the program itself, in run()
  }

  /* -------------------------------------------------- running a program */
  function run(steps){
    if(busy || !L || L.done) return;
    if(cur() && cur().id!=='run'){
      brief(t('Finish the step you are on first — the console comes last.'));
      return;
    }
    busy=true;
    let i=0;
    (function next(){
      if(!L || L.done){ busy=false; return; }
      if(i>=steps.length){
        busy=false; CODE.highlight(null); CODE.hideTape();
        if(!won()) brief(t('Program finished — but you are not on the green door yet. Count the pads again.'));
        return;
      }
      const st=steps[i++];
      if(st.name==='__iter'){ CODE.setIter(st.blockId,st.i,st.n); return setTimeout(next,110); }
      if(st.name==='__if'||st.name==='__call'){ CODE.highlight(st); return setTimeout(next,110); }
      CODE.highlight(st);
      act(st.name, ()=>{ if(!L) { busy=false; return; }
                         if(won()){ busy=false; return; }
                         setTimeout(next,60); });
    })();
  }
  function act(name, done){
    if(name==='left')    return turn(-1,done);
    if(name==='right')   return turn( 1,done);
    if(name==='forward') return stepFwd(done);
    done();
  }
  function turn(d,done){
    L.dir=(L.dir+d+4)%4;
    ease(G.yaw, Math.atan2(-DIRS[L.dir][0],-DIRS[L.dir][1]), 200, v=>G.yaw=v, done);
  }
  function stepFwd(done){
    const nx=L.gx+DIRS[L.dir][0], nz=L.gz+DIRS[L.dir][1];
    if(nx<=0||nz<=0||nx>=W-1||nz>=D-1){
      brief(t('That is a wall. Turn first, or use fewer blocks.'));
      busy=false; CODE.hideTape(); return;
    }
    const fx=G.pos.x, fz=G.pos.z, tp=at(nx,nz);
    L.gx=nx; L.gz=nz;
    ease(0,1,300,k=>{ G.pos.x=fx+(tp.x-fx)*k; G.pos.z=fz+(tp.z-fz)*k; }, done);
  }
  function won(){
    if(!L || L.done) return false;
    if(L.gx!==L.goal.gx || L.gz!==L.goal.gz) return false;
    finish();
    return true;
  }

  /* ------------------------------------------------------------ finish */
  function finish(){
    if(!L || L.done) return;
    L.done=true; busy=false;
    CODE.hideTape(); CODE.close(); CODE.setGuide(null);
    if(L.pads.goal) L.pads.goal.material.color.setHex(PAL.done);
    if(window.beep) beep('star');
    if(window.PROGRESS) PROGRESS.complete('tut');
    hud();
    showResults({
      title:t('BASICS DONE'),
      body:t('You looked around, walked, jumped, opened the console and ran a program that moved you. That is every control the rest of the game uses.'),
      stats:`<div><b>${t('Move')}</b> W A S D</div>
             <div><b>${t('Turn')}</b> ${t('mouse or ← →')}</div>
             <div><b>${t('Jump')}</b> SPACE</div>
             <div><b>${t('Console')}</b> C</div>`,
      btnText:t('Back to the menu')
    });
    G.running=false;
  }

  /* --------------------------------------------------------------- HUD */
  function hud(){
    document.querySelector('#missionName').textContent=t('Level 0 — Basics');
    document.querySelector('#objList').innerHTML=STEPS.map((s,i)=>
      `<li class="${i<L.step?'done':(i===L.step?'cur':'')}">${i<L.step?'✔ ':'• '}${t(s.name)}</li>`).join('');
  }
  function teach(){
    const el=document.querySelector('#teach');
    el.classList.remove('hidden');
    el.innerHTML=`<div class="teach-card">
      <div class="kicker">${t('LEVEL 0')}</div>
      <h2>${t('Basics')}</h2>
      <p>${t('Nothing in this room is chasing you. Walk about, get used to the controls, then open the console and run your first program.')}</p>
      <div class="why">${t('Five steps. They tick off on their own as you do them.')}</div>
      <button class="btn good" id="teachGo">${t('Let me try ▶')}</button>
      <div style="font-size:13px;color:var(--muted);margin-top:9px">${t('or press SPACE')}</div>
    </div>`;
    el.querySelector('#teachGo').onclick=()=>{
      el.classList.add('hidden'); lockPointer(document.querySelector('#view'));
    };
  }
  let mt=null;
  function brief(html){
    const b=document.querySelector('#briefing');
    b.classList.remove('hidden'); b.innerHTML=t(html);
    clearTimeout(mt);
    mt=setTimeout(()=>{ if(L && !L.done && cur()) b.innerHTML=t(cur().hint); }, 5200);
  }
  /* same timer-driven easing the corridors use: rAF stops in a hidden tab,
     and a half-finished step would leave the player between two pads */
  function ease(a,b,ms,set,done){
    const t0=performance.now();
    (function f(){
      const k=Math.min(1,(performance.now()-t0)/ms);
      set(a+(b-a)*(k<.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2));
      if(k<1) setTimeout(f,16); else if(done) done();
    })();
  }

  function stop(){
    L=null; busy=false;
    document.querySelector('#mapwrap').classList.remove('hidden');
    CODE.setBudget(0); CODE.setGuide(null);
  }

  return { start, run, tick, update:tick, stop,
           get active(){ return !!L; },
           get busy(){ return busy; },
           retry(){ if(L) start(); } };
})();
