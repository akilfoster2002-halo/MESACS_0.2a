/* =====================================================================
   COVERT OPS — the heist puzzles.  (global stays PUZZLE so the rest of
   the game keeps calling the same API)

   The rule that makes this a puzzle and not a reflex test:
   THE WORLD MOVES ONE BEAT PER INSTRUCTION. Guards step, lasers blink and
   cameras sweep only when your program runs a block — so wait() is a real
   move, and every layout can be reasoned out on paper before you run it.
   ===================================================================== */
window.PUZZLE = (function(){
  const T=4;
  const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];          // N E S W
  const PAL={floor:0xe4d9ff, wall:0xb9a4e8, exit:0x8fd3ff, loot:0xffe9a8,
             key:0xa8e6cf, door:0xffb4a2, guard:0xff9aa2, laser:0xff6b81,
             cam:0xcdb4f6, safe:0xd8ecff};

  let P=null, busy=false, timer=null, left=0, running=false, runToken=0;

  /* ------------------------------------------------------- operations */
  const OPS=[
    { name:'Front Door', budget:5, par:60,
      brief:'Your first job. Walk in, take the <b>data core</b>, walk out the far door. Nothing is watching yet.',
      learn:'Sequence and repeat',
      pal:['forward','left','right','repeat','grab'],
      grid:['##########',
            '#S...L..X#',
            '##########'] },

    { name:'Night Shift', budget:16, par:80,
      brief:'A guard paces this corridor. He moves <b>one step every time your program runs a block</b> — so <b>wait()</b> is how you let him pass.',
      learn:'Timing with wait()',
      pal:['forward','left','right','repeat','wait','grab'],
      grid:['###########',
            '#S.....L.X#',
            '#.........#',
            '###########'],
      guards:[{path:[[4,1],[5,1],[6,1],[5,1]], sight:1}] },

    { name:'Laser Grid', budget:12, par:95,
      brief:'Beams across the hall switch <b>on for two beats, off for two</b>. Count the beats, then move when the light dies.',
      learn:'Counting beats',
      pal:['forward','left','right','repeat','wait','grab'],
      grid:['#########',
            '#S.....L#',
            '#.......#',
            '#......X#',
            '#########'],
      lasers:[{cells:[[3,1],[3,2],[3,3]], on:2, off:2, phase:0},
              {cells:[[5,1],[5,2],[5,3]], on:2, off:2, phase:2}] },

    { name:'Keycard', budget:12, par:110,
      brief:'The vault door is locked. The <b>keycard</b> is down the side passage, and a camera watches the middle. Fetch, then open.',
      learn:'Order of operations',
      pal:['forward','left','right','repeat','wait','grab'],
      grid:['#########',
            '#S.....K#',
            '#.#####.#',
            '#...D..L#',
            '#.#####.#',
            '#......X#',
            '#########'],
      guards:[{path:[[3,3],[4,3],[5,3],[4,3]], sight:2}] },

    { name:'Blind Spot', budget:18, par:120,
      brief:'Two guards, and you cannot know where they will be. Stop guessing — use <b>if guard ahead</b> and let your program look for itself.',
      learn:'Sensing with if',
      pal:['forward','left','right','repeat','wait','ifc','grab'],
      conds:['guard ahead','wall ahead','clear'],
      grid:['###########',
            '#S.......L#',
            '#.........#',
            '#........X#',
            '###########'],
      guards:[{path:[[4,1],[5,1],[6,1],[5,1]], sight:1},
              {path:[[6,2],[5,2],[4,2],[5,2]], sight:1}] },

    { name:'Three Shifts', budget:18, par:150,
      brief:'Final job — the same building <b>three nights running</b>, and the guards walk a different beat each night. A memorised program cannot work. Write one that <b>looks before it moves</b>: <i>if path clear → forward</i>, <i>if guard ahead → wait</i>.',
      learn:'Code that copes with what it cannot predict',
      pal:['forward','left','right','repeat','wait','ifc','grab'],
      conds:['path clear','guard ahead','loot here'],
      grid:['##########',
            '#S......L#',
            '#........#',
            '#.......X#',
            '##########'],
      shifts:[
        [{path:[[4,1],[5,1],[6,1],[5,1]], sight:1}],
        [{path:[[3,1],[4,1],[5,1],[6,1],[5,1],[4,1]], sight:1}],
        [{path:[[6,1],[5,1],[4,1],[3,1],[4,1],[5,1]], sight:1},
         {path:[[3,2],[4,2],[5,2],[4,2]], sight:1}]
      ] }
  ];

  /* --------------------------------------------------------- building */
  function tile(x,y,color,h,yOff){
    const m=new THREE.Mesh(new THREE.BoxGeometry(T*0.94,h||0.4,T*0.94),
      new THREE.MeshLambertMaterial({color}));
    m.position.set(x*T,(yOff!==undefined?yOff:0),y*T);
    G.roomGroup.add(m); return m;
  }
  function marker(x,y,color,em){
    const g=new THREE.Group();
    const box=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.6,1.6),
      new THREE.MeshLambertMaterial({color}));
    box.position.y=1.4; g.add(box);
    g.position.set(x*T,0,y*T); G.roomGroup.add(g); return g;
  }
  function build(n, mazeIndex){
    runToken++;
    const O=OPS[n];
    const grid = O.grid;
    const shift = O.shifts ? O.shifts[mazeIndex||0] : null;
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[];
    G.scene.background=new THREE.Color(0x151030);
    G.scene.fog=new THREE.Fog(0x151030, 80, 240);

    P={ n, O, grid, mazeIndex:mazeIndex||0, x:0, y:0, dir:1, beat:0,
        loot:[], gotLoot:0, keys:[], hasKey:false, doors:[], exit:null,
        guards:[], lasers:[], caught:false, w:grid[0].length, h:grid.length };

    grid.forEach((row,y)=>{
      [...row].forEach((c,x)=>{
        if(c==='#'){ tile(x,y,PAL.wall,5.5,2.75);
          G.solids.push({x1:x*T-T/2,x2:x*T+T/2,z1:y*T-T/2,z2:y*T+T/2}); return; }
        tile(x,y,PAL.floor,0.4,0);
        if(c==='S'){ P.x=x; P.y=y; tile(x,y,PAL.safe,0.45,0.03); }
        if(c==='X'){ P.exit={x,y,m:tile(x,y,PAL.exit,0.5,0.05)}; }
        if(c==='L'){ P.loot.push({x,y,m:marker(x,y,PAL.loot),taken:false}); }
        if(c==='K'){ P.keys.push({x,y,m:marker(x,y,PAL.key),taken:false}); }
        if(c==='D'){ P.doors.push({x,y,m:tile(x,y,PAL.door,3.4,1.7),open:false}); }
      });
    });
    (shift || O.guards || []).forEach(g=>{
      const mesh=marker(g.path[0][0],g.path[0][1],PAL.guard);
      P.guards.push({...g, i:0, x:g.path[0][0], y:g.path[0][1], mesh, cone:coneFor(mesh)});
    });
    (O.lasers||[]).forEach(l=>{
      const beams=l.cells.map(([x,y])=>{
        const m=new THREE.Mesh(new THREE.BoxGeometry(T*0.5,3.2,T*0.5),
          new THREE.MeshBasicMaterial({color:PAL.laser,transparent:true,opacity:.55}));
        m.position.set(x*T,1.8,y*T); G.roomGroup.add(m); return m;
      });
      P.lasers.push({...l, beams});
    });

    G.pos.set(P.x*T,2.2,P.y*T);
    G.yaw=Math.atan2(-DIRS[P.dir][0],-DIRS[P.dir][1]);
    G.pitch=-0.18;
    G.hudOwner='puzzle';
    if(window.updateLeaveBtn) updateLeaveBtn();
    document.querySelector('#mapwrap').classList.add('hidden');
    if(window.AVATAR) AVATAR.attach();
    CODE.setPalette(O.pal); CODE.setBudget(O.budget);
    CODE.setConditions(O.conds||['wall ahead','guard ahead','clear']);
    if(!mazeIndex) CODE.clear();
    paintWorld(); hud(); startClock(O.par*2);
    briefCard();
  }
  function coneFor(mesh){
    const c=new THREE.Mesh(new THREE.ConeGeometry(1.6,3.2,10,1,true),
      new THREE.MeshBasicMaterial({color:PAL.guard,transparent:true,opacity:.22,side:THREE.DoubleSide}));
    c.rotation.x=Math.PI/2; c.position.set(0,1.4,-2.2);
    mesh.add(c); return c;
  }

  /* ---------------------------------------------------- world state */
  function cell(x,y){
    if(y<0||y>=P.h||x<0||x>=P.w) return '#';
    const c=P.grid[y][x];
    if(c==='D'){ const d=P.doors.find(d=>d.x===x&&d.y===y); return d&&d.open ? '.' : '#'; }
    return c;
  }
  function laserOn(l){ return ((P.beat + l.phase) % (l.on+l.off)) < l.on; }
  function paintWorld(){
    P.lasers.forEach(l=>{ const on=laserOn(l);
      l.beams.forEach(b=>{ b.visible=on; }); });
    P.guards.forEach(g=>{
      g.mesh.position.set(g.x*T,0,g.y*T);
      const nxt=g.path[(g.i+1)%g.path.length];
      const dx=nxt[0]-g.x, dy=nxt[1]-g.y;
      if(dx||dy) g.mesh.rotation.y=Math.atan2(-dx,-dy);
    });
    P.loot.forEach(l=>l.m.visible=!l.taken);
    P.keys.forEach(k=>k.m.visible=!k.taken);
    P.doors.forEach(d=>{ d.m.visible=!d.open; });
  }
  /* one beat: guards step, lasers toggle, then we look for trouble */
  function beat(){
    P.beat++;
    P.guards.forEach(g=>{
      g.i=(g.i+1)%g.path.length;
      g.x=g.path[g.i][0]; g.y=g.path[g.i][1];
    });
    paintWorld();
    return detect();
  }
  function detect(){
    for(const l of P.lasers)
      if(laserOn(l) && l.cells.some(([x,y])=>x===P.x&&y===P.y)) return 'laser';
    for(const g of P.guards){
      if(g.x===P.x&&g.y===P.y) return 'guard';
      const nxt=g.path[(g.i+1)%g.path.length];
      let dx=Math.sign(nxt[0]-g.x), dy=Math.sign(nxt[1]-g.y);
      if(!dx&&!dy) continue;
      for(let s=1;s<=(g.sight||2);s++){
        const cx=g.x+dx*s, cy=g.y+dy*s;
        if(cell(cx,cy)==='#') break;
        if(cx===P.x&&cy===P.y) return 'guard';
      }
    }
    return null;
  }

  /* --------------------------------------------------------- running */
  function run(steps){
    if(busy||!P) return;
    busy=true; P.caught=false;
    let idx=0; const token=runToken;
    (function next(){
      if(!P||token!==runToken){ busy=false; return; }
      if(idx>=steps.length){
        busy=false; CODE.highlight(null); CODE.hideTape();
        if(!won()) msg(t('Program finished — but you are not out with the goods yet.'));
        return;
      }
      const s=steps[idx++];
      if(s.name==='__iter'){ CODE.setIter(s.blockId,s.i,s.n); return setTimeout(next,120); }
      if(s.name==='__if'){
        CODE.highlight(s);
        if(!test(s.cond)) idx=s.jump;
        return setTimeout(next,140);
      }
      if(s.name==='__call'){ CODE.highlight(s); return setTimeout(next,120); }
      CODE.highlight(s);
      act(s.name, ()=>{
        const bad=beat();
        if(bad){ busted(bad); busy=false; return; }
        if(won()){ busy=false; return; }
        setTimeout(next,70);
      });
    })();
  }
  function guardWithin(n){
    for(let s=1;s<=n;s++){
      const cx=P.x+DIRS[P.dir][0]*s, cy=P.y+DIRS[P.dir][1]*s;
      if(cell(cx,cy)==='#') return false;
      if(P.guards.some(g=>g.x===cx&&g.y===cy)) return true;
    }
    return false;
  }
  function test(cond){
    const ax=P.x+DIRS[P.dir][0], ay=P.y+DIRS[P.dir][1];
    if(cond==='loot here')   return P.loot.some(l=>l.x===P.x&&l.y===P.y&&!l.taken)
                                 || P.keys.some(k=>k.x===P.x&&k.y===P.y&&!k.taken);
    if(cond==='path clear')  return cell(ax,ay)!=='#' && !guardWithin(2);
    if(cond==='wall ahead')  return cell(ax,ay)==='#';
    if(cond==='guard ahead') return guardWithin(3);
    if(cond==='clear') return cell(ax,ay)!=='#';
    return false;
  }
  function act(name, done){
    if(name==='left')   { turn(-1,done); return; }
    if(name==='right')  { turn( 1,done); return; }
    if(name==='forward'){ stepFwd(done); return; }
    if(name==='wait')   { setTimeout(done,260); return; }
    if(name==='grab')   { grab(); setTimeout(done,200); return; }
    done();
  }
  function grab(){
    const l=P.loot.find(l=>l.x===P.x&&l.y===P.y&&!l.taken);
    if(l){ l.taken=true; P.gotLoot++; if(window.beep) beep('star');
           msg(t('Data core secured. Now get to the exit.')); hud(); paintWorld(); return; }
    const k=P.keys.find(k=>k.x===P.x&&k.y===P.y&&!k.taken);
    if(k){ k.taken=true; P.hasKey=true; P.doors.forEach(d=>d.open=true);
           if(window.beep) beep('star'); msg(t('Keycard taken — the locked door is open.'));
           hud(); paintWorld(); return; }
    msg(t('Nothing here to grab.'));
  }
  function turn(d,done){
    if(!P) return;
    P.dir=(P.dir+d+4)%4;
    ease(G.yaw, Math.atan2(-DIRS[P.dir][0],-DIRS[P.dir][1]), 220, v=>G.yaw=v, done);
  }
  function stepFwd(done){
    if(!P) return;
    const nx=P.x+DIRS[P.dir][0], ny=P.y+DIRS[P.dir][1];
    if(cell(nx,ny)==='#'){
      const locked=P.doors.some(d=>d.x===nx&&d.y===ny&&!d.open);
      msg(locked ? t('That door is locked — find the keycard.')
                 : t('You walked into a wall. Count the tiles again.'));
      hurt(); busy=false; CODE.hideTape(); return;
    }
    const fx=G.pos.x, fz=G.pos.z, tx=nx*T, tz=ny*T;
    P.x=nx; P.y=ny;
    ease(0,1,300,k=>{ G.pos.x=fx+(tx-fx)*k; G.pos.z=fz+(tz-fz)*k; }, done);
  }
  function busted(kind){
    hurt();
    msg(kind==='laser' ? t('🚨 You crossed a live beam. Alarm!') : t('🚨 A guard spotted you. Alarm!'));
    CODE.hideTape();
    setTimeout(()=>resetRun(), 1300);
  }
  function resetRun(){
    if(!P) return;
    P.grid.forEach((row,y)=>[...row].forEach((c,x)=>{ if(c==='S'){ P.x=x; P.y=y; } }));
    P.dir=1; P.beat=0; P.gotLoot=0; P.hasKey=false;
    P.loot.forEach(l=>l.taken=false); P.keys.forEach(k=>k.taken=false);
    P.doors.forEach(d=>d.open=false);
    P.guards.forEach(g=>{ g.i=0; g.x=g.path[0][0]; g.y=g.path[0][1]; });
    G.pos.set(P.x*T,2.2,P.y*T);
    G.yaw=Math.atan2(-DIRS[P.dir][0],-DIRS[P.dir][1]);
    paintWorld(); hud(); busy=false;
  }

  /* ------------------------------------------------------------ win */
  function won(){
    if(!P||!P.exit) return false;
    if(P.x!==P.exit.x||P.y!==P.exit.y) return false;
    if(P.gotLoot<P.loot.length){ msg(t('Not without the data core.')); return false; }
    // the finale runs the same program against a different patrol each night
    if(P.O.shifts && P.mazeIndex < P.O.shifts.length-1){
      const nextMaze=P.mazeIndex+1;
      msg(t('Night {a} clear. Same program, new patrol…',{a:P.mazeIndex+1}));
      setTimeout(()=>{ const keep=CODE.script.slice(); build(P.n,nextMaze);
        setTimeout(()=>{ CODE.show(); CODE.close(); run(CODE.compile(keep)); }, 900); }, 1200);
      return true;
    }
    solved(); return true;
  }
  function solved(){
    stopClock(); busy=false; CODE.hideTape();
    const used=CODE.countBlocks(), timeUsed=P.O.par*2-left;
    let stars=1;
    if(timeUsed<=P.O.par) stars++;
    if(used<=P.O.budget) stars++;
    try{ const b=JSON.parse(localStorage.getItem('dq_ops')||'{}');
         if(!b[P.n]||stars>b[P.n]){ b[P.n]=stars; localStorage.setItem('dq_ops',JSON.stringify(b)); } }catch(e){}
    if(window.beep) beep('star');
    const last = P.n>=OPS.length-1;
    if(last && window.PROGRESS) PROGRESS.complete('puzzles');
    document.querySelector('#ptimer').classList.add('hidden');
    const nextN=P.n+1;
    showResults({
      title:t('OPERATION COMPLETE'),
      body:`<div class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>`+
           t('{name} — {t} seconds, {b} blocks.',{name:t(P.O.name),t:timeUsed,b:used}),
      stats:`<div><b>${t('Time')}</b> ${timeUsed}s (${t('par')} ${P.O.par}s)</div>
             <div><b>${t('Blocks')}</b> ${used}/${P.O.budget}</div>
             <div style="grid-column:1/-1"><b>${t('Your program')}</b><pre style="margin:6px 0 0;color:#8fd3ff">${CODE.toText().join('\n')||'—'}</pre></div>`,
      btnText: last ? t('Back to the menu') : t('Next operation ▶'),
      onBtn: last ? null : ()=>{ document.querySelector('#done').classList.add('hidden');
              G.running=true; build(nextN); lockPointer(document.querySelector('#view')); }
    });
    G.running=false;
  }

  /* ----------------------------------------------------------- HUD */
  function briefCard(){
    const el=document.querySelector('#teach');
    el.classList.remove('hidden');
    el.innerHTML=`<div class="teach-card">
      <div class="kicker">${t('OPERATION {n}',{n:P.n+1})} · ${t(P.O.learn)}</div>
      <h2>${t(P.O.name)}</h2>
      <p>${t(P.O.brief)}</p>
      <div class="why">${t('The world moves one step every time your program runs a block — so wait() is a move.')}</div>
      <button class="btn good" id="teachGo">${t('Open the console ▶')}</button>
      <div style="font-size:13px;color:var(--muted);margin-top:9px">${t('or press SPACE')}</div>
    </div>`;
    el.querySelector('#teachGo').onclick=()=>{ el.classList.add('hidden'); CODE.show(); };
  }
  function hud(){
    document.querySelector('#missionName').textContent=
      t('Operation {n} — {name}',{n:P.n+1,name:t(P.O.name)});
    const lootLine = P.loot.length
      ? `<li class="${P.gotLoot>=P.loot.length?'done':'cur'}">💾 ${t('Data core')}: <b>${P.gotLoot}/${P.loot.length}</b></li>` : '';
    const keyLine = P.keys.length
      ? `<li class="${P.hasKey?'done':''}">🔑 ${t('Keycard')}</li>` : '';
    document.querySelector('#objList').innerHTML =
      lootLine + keyLine +
      `<li>🚪 ${t('Reach the exit')}</li>` +
      (P.guards.length?`<li>👁️ ${t('Guards move one step per block')}</li>`:'') +
      (P.lasers.length?`<li>🔴 ${t('Beams: 2 beats on, 2 off')}</li>`:'') +
      `<li>📦 ${t('Block budget')}: <b>${P.O.budget}</b></li>`;
  }
  function hurt(){
    const h=document.querySelector('#hurt'); h.classList.add('on');
    setTimeout(()=>h.classList.remove('on'),240);
    if(window.beep) beep('bad');
  }
  let msgT=null;
  function msg(text){
    const b=document.querySelector('#briefing');
    b.classList.remove('hidden'); b.innerHTML=t(text);
    clearTimeout(msgT);
    msgT=setTimeout(()=>{ if(P) b.innerHTML=t(P.O.brief); },2600);
  }
  function ease(a,b,ms,set,done){
    const t0=performance.now();
    (function f(){ const k=Math.min(1,(performance.now()-t0)/ms);
      set(a+(b-a)*(k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2));
      if(k<1) requestAnimationFrame(f); else if(done) done(); })();
  }

  /* --------------------------------------------------------- clock
     The clock is a bonus, never a punishment: run out and you simply do
     not get the speed star. Thinking time should not end a mission. */
  function startClock(secs){
    left=secs; running=true;
    document.querySelector('#ptimer').classList.remove('hidden');
    clearInterval(timer);
    timer=setInterval(()=>{ if(!running) return; left--; paintClock(); if(left<=0){ left=0; paintClock(); } },1000);
    paintClock();
  }
  function paintClock(){
    const c=document.querySelector('#ptClock'); if(!c||!P) return;
    const m=Math.floor(Math.max(0,left)/60), s=Math.max(0,left)%60;
    c.textContent=m+':'+String(s).padStart(2,'0');
    c.className='clock'+(left<=0?'':(left<=25?' warn':''));
    document.querySelector('#ptLbl').textContent = left>0 ? t('SPEED BONUS') : t('NO SPEED BONUS');
    document.querySelector('#ptSub').textContent=t('par {n}s · {b} blocks',{n:P.O.par,b:P.O.budget});
  }
  function stopClock(){ running=false; clearInterval(timer); }

  return {
    start(n){ G.missionId='puzzles'; build(n||0); },
    run, hud,
    get active(){ return !!P; },
    get busy(){ return busy; },
    stop(){ stopClock(); runToken++; P=null; busy=false;
      document.querySelector('#ptimer').classList.add('hidden');
      document.querySelector('#mapwrap').classList.remove('hidden');
      CODE.setBudget(0); CODE.setConditions(['red','blue']); },
    retry(){ if(P) build(P.n); },
    count: OPS.length
  };
})();
