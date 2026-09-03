/* =====================================================================
   PUZZLE VAULTS — grid rooms you solve with code, against a clock.
   You do not walk with WASD in here: you write the walk. A block budget
   is the real puzzle — six tiles of corridor and three blocks means the
   answer has to be a loop, not six copies of forward().
   ===================================================================== */
window.PUZZLE = (function(){
  const T=4;                                  // world units per tile
  const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];     // N E S W
  const PAL={floor:0xe4d9ff, wall:0xb9a4e8, pad:0xffd8a8, padOn:0xa8e6cf,
             exit:0x8fd3ff, pit:0x6b5a8f, start:0xffc8dd};

  let P=null, idx=0, busy=false, tiles=[], timer=null, left=0, running=false;
  let runToken=0;            // bumped on build/stop so an in-flight walk aborts

  /* ---------------------------------------------------------- levels */
  const LEVELS=[
    { name:'Straight Shot', budget:3, par:35,
      teach:'Six tiles of corridor — and only <b>3 blocks</b>. Six forward() blocks will not fit. A <b>repeat</b> will.',
      grid:['#########',
            '#S.....X#',
            '#########'], pal:['forward','repeat'] },

    { name:'Around the Corner', budget:6, par:50,
      teach:'Turn as well as walk. Count the tiles before you build — <b>turnRight()</b> costs a block too.',
      grid:['#######',
            '#S....#',
            '#####.#',
            '#####.#',
            '#####X#',
            '#######'], pal:['forward','left','right','repeat'] },

    { name:'The Square', budget:4, par:75,
      teach:'Three corner pads, four equal sides, and only <b>4 blocks</b>. Walking one side is a repeat — walking all four sides is a <b>repeat inside a repeat</b>.',
      grid:['#######',
            '#S...P#',
            '#.###.#',
            '#.###.#',
            '#.###.#',
            '#P...P#',
            '#######'], pal:['forward','left','right','repeat'] },

    { name:'Three Pads', budget:6, par:60,
      teach:'Light all <b>three pads</b> in <b>6 blocks</b>. Walk the top row, turn, then come down the side. Keep clear of the pit.',
      grid:['#########',
            '#S.P..P.#',
            '#######.#',
            '#..O...P#',
            '#########'], pal:['forward','left','right','repeat'] },

    { name:'The Lock', budget:8, par:75,
      teach:'Light the pad, then <b>shoot()</b> the blue lock from beside it, then walk on to the exit. Movement and shooting in one program.',
      grid:['#########',
            '#S..P..L#',
            '#######.#',
            '#......X#',
            '#########'], pal:['forward','left','right','repeat','shoot'] },

    { name:'The Long Way', budget:10, par:110,
      teach:'A staircase of <b>three identical legs</b>: two forward, turn left, two forward, turn right. Put that in <b>define combo</b> and call it inside a <b>repeat</b>.',
      grid:['#########',
            '#######X#',
            '#######.#',
            '#####...#',
            '#####.###',
            '###...###',
            '###.#####',
            '#S..#####',
            '#########'], pal:['forward','left','right','repeat','define','call'] }
  ];

  /* ------------------------------------------------------------ build */
  function tile(x,y,color,h,yOff){
    const m=new THREE.Mesh(new THREE.BoxGeometry(T*0.94,h||0.4,T*0.94),
      new THREE.MeshLambertMaterial({color}));
    m.position.set(x*T,(yOff!==undefined?yOff:0),y*T);
    G.roomGroup.add(m);
    return m;
  }
  function build(n){
    runToken++;
    const L=LEVELS[n];
    P={ n, L, x:0, y:0, dir:1, pads:[], padsLit:0, lock:null, exit:null, opened:false,
        w:L.grid[0].length, h:L.grid.length };
    // launching straight from the menu means there may be no room yet
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    G.roomGroup=new THREE.Group(); G.scene.add(G.roomGroup);
    G.solids=[]; G.hits=[]; tiles=[];
    G.scene.background=new THREE.Color(0xf6efff);
    G.scene.fog=new THREE.Fog(0xf6efff, 70, 220);

    L.grid.forEach((row,y)=>{
      [...row].forEach((c,x)=>{
        if(c==='#'){
          const m=tile(x,y,PAL.wall,5.5,2.75);
          G.solids.push({x1:x*T-T/2,x2:x*T+T/2,z1:y*T-T/2,z2:y*T+T/2});
          return;
        }
        tile(x,y,PAL.floor,0.4,0);
        if(c==='S'){ P.x=x; P.y=y; tile(x,y,PAL.start,0.45,0.03); }
        if(c==='P'){ const m=tile(x,y,PAL.pad,0.55,0.06); P.pads.push({x,y,m,on:false}); }
        if(c==='O'){ const m=tile(x,y,PAL.pit,1.2,-0.7); m.userData.pit={x,y}; }
        if(c==='X'){ const m=tile(x,y,PAL.exit,0.5,0.05); P.exit={x,y,m}; }
        if(c==='L'){
          const m=new THREE.Mesh(new THREE.BoxGeometry(2.2,2.6,2.2),
            new THREE.MeshLambertMaterial({color:0x5ec8ff}));
          m.position.set(x*T,2.4,y*T); G.roomGroup.add(m); G.hits.push(m);
          m.userData.lock=true; P.lock={x,y,m};
        }
      });
    });
    // a soft ceiling-less vault: floor grid reads better with a rim
    G.pos.set(P.x*T, 2.2, P.y*T);
    G.yaw=Math.atan2(-DIRS[P.dir][0], -DIRS[P.dir][1]);
    G.pitch=-0.18;
    G.hudOwner='puzzle';
    if(window.updateLeaveBtn) updateLeaveBtn();
    document.querySelector('#mapwrap').classList.add('hidden');   // no desktop map inside a vault
    CODE.setPalette(L.pal); CODE.setBudget(L.budget); CODE.clear();
    hud(); startClock(L.par*2);
    brief(L.teach);
  }

  /* ------------------------------------------------------------ clock */
  function startClock(secs){
    left=secs; running=true;
    document.querySelector('#ptimer').classList.remove('hidden');
    clearInterval(timer);
    timer=setInterval(()=>{
      if(!running) return;
      left--; paintClock();
      if(left<=0){ clearInterval(timer); outOfTime(); }
    },1000);
    paintClock();
  }
  function paintClock(){
    const c=document.querySelector('#ptClock');
    const m=Math.floor(Math.max(0,left)/60), s=Math.max(0,left)%60;
    c.textContent=m+':'+String(s).padStart(2,'0');
    c.className='clock'+(left<=10?' bad':left<=25?' warn':'');
    document.querySelector('#ptLbl').textContent=t('TIME');
    document.querySelector('#ptSub').textContent=
      t('par {n}s · {b} blocks',{n:P.L.par, b:P.L.budget});
  }
  function stopClock(){ running=false; clearInterval(timer); }
  function outOfTime(){
    stopClock(); busy=false;
    brief(t('⏰ Out of time! Nothing is lost — here we go again.'));
    setTimeout(()=>build(P.n), 1400);
  }

  /* ------------------------------------------------------------- HUD */
  function hud(){
    document.querySelector('#missionName').textContent=
      t('Puzzle {n} — {name}',{n:P.n+1, name:t(P.L.name)});
    const pads=P.pads.length;
    document.querySelector('#objList').innerHTML=
      (P.exit?`<li class="cur">🧩 ${t('Reach the exit')}</li>`
             :`<li class="cur">🧩 ${t('Light every pad')}</li>`) +
      (pads?`<li class="${P.padsLit>=pads?'done':''}">🟢 ${t('Pads lit')}: <b>${P.padsLit}/${pads}</b></li>`:'') +
      (P.lock?`<li class="${P.opened?'done':''}">🔒 ${t('Shoot the lock')}</li>`:'') +
      `<li>📦 ${t('Block budget')}: <b>${P.L.budget}</b></li>`;
  }
  function brief(html){
    const b=document.querySelector('#briefing');
    b.classList.remove('hidden'); b.innerHTML=t(html);
  }

  /* --------------------------------------------------------- running */
  function run(steps){
    if(busy||!P) return;
    busy=true; idx=0;
    const token=runToken;
    (function next(){
      if(!P || token!==runToken){ busy=false; return; }
      if(idx>=steps.length){
        busy=false; CODE.highlight(null); CODE.hideTape();
        if(!won()) brief(t('Program finished, but you are not at the exit yet. Change your blocks and run again.'));
        return;
      }
      const s=steps[idx++];
      if(s.name==='__iter'){ CODE.setIter(s.blockId,s.i,s.n); return setTimeout(next,150); }
      if(s.name==='__if'||s.name==='__call'){ CODE.highlight(s); return setTimeout(next,150); }
      CODE.highlight(s);
      act(s.name, ()=>{ if(won()){ busy=false; return; } setTimeout(next, 60); });
    })();
  }
  function act(name, done){
    if(name==='left'  ){ turn(-1, done); return; }
    if(name==='right' ){ turn( 1, done); return; }
    if(name==='forward'){ step(done); return; }
    if(name==='shoot' ){ shootLock(); setTimeout(done,320); return; }
    done();
  }
  function turn(d, done){
    if(!P) return;
    P.dir=(P.dir+d+4)%4;
    const target=Math.atan2(-DIRS[P.dir][0], -DIRS[P.dir][1]);
    ease(G.yaw, target, 260, v=>G.yaw=v, done);
  }
  function step(done){
    if(!P) return;
    const nx=P.x+DIRS[P.dir][0], ny=P.y+DIRS[P.dir][1];
    const c=cell(nx,ny);
    if(c==='#'){
      bump(); brief(t('💥 You walked into a wall — that is a bug. Count the tiles again.'));
      busy=false; CODE.hideTape(); return;
    }
    if(c==='O'){
      brief(t('🕳️ Into the pit! The run restarts — but your blocks are kept.'));
      busy=false; CODE.hideTape();
      setTimeout(()=>{ resetRun(); },1200); return;
    }
    const fx=G.pos.x, fz=G.pos.z, tx=nx*T, tz=ny*T;
    P.x=nx; P.y=ny;
    ease(0,1,330,k=>{ G.pos.x=fx+(tx-fx)*k; G.pos.z=fz+(tz-fz)*k; }, ()=>{ landed(); done(); });
  }
  function landed(){
    if(!P) return;                         // the vault was left mid-step
    const pad=P.pads.find(p=>p.x===P.x&&p.y===P.y&&!p.on);
    if(pad){ pad.on=true; P.padsLit++; pad.m.material.color.setHex(PAL.padOn);
             if(window.beep) beep('star'); hud(); }
  }
  function shootLock(){
    if(!P || !P.lock) return;
    if(window.GUN) GUN.kick();
    const d=Math.hypot(P.lock.x-P.x, P.lock.y-P.y);
    if(d<=2.5 && P.padsLit>=P.pads.length){
      P.opened=true; P.lock.m.material.color.setHex(0xa8e6cf);
      if(window.beep) beep('star'); hud();
      brief(t('🔓 The lock is open. Get to the exit!'));
    } else if(d>2.5) brief(t('Too far from the lock — walk closer first.'));
    else brief(t('The lock will not budge until every pad is lit.'));
  }
  function cell(x,y){
    if(y<0||y>=P.h||x<0||x>=P.w) return '#';
    return P.L.grid[y][x];
  }
  function bump(){
    const h=document.querySelector('#hurt'); h.classList.add('on');
    setTimeout(()=>h.classList.remove('on'),200);
    if(window.beep) beep('bad');
  }
  function ease(a,b,ms,set,done){
    const t0=performance.now();
    (function f(){
      const k=Math.min(1,(performance.now()-t0)/ms);
      set(a+(b-a)*(k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2));
      if(k<1) requestAnimationFrame(f); else if(done) done();
    })();
  }
  function resetRun(){
    const g=P.L.grid;
    g.forEach((row,y)=>[...row].forEach((c,x)=>{ if(c==='S'){ P.x=x; P.y=y; } }));
    P.dir=1; P.pads.forEach(p=>{ p.on=false; p.m.material.color.setHex(PAL.pad); });
    P.padsLit=0; P.opened=false;
    if(P.lock) P.lock.m.material.color.setHex(0x5ec8ff);
    G.pos.set(P.x*T,2.2,P.y*T);
    G.yaw=Math.atan2(-DIRS[P.dir][0],-DIRS[P.dir][1]);
    hud(); busy=false;
  }

  /* ------------------------------------------------------------- win */
  function won(){
    if(!P) return false;
    if(!P.exit){                                   // pad-only vault
      if(P.padsLit<P.pads.length) return false;
      solved(); return true;
    }
    if(P.x!==P.exit.x||P.y!==P.exit.y) return false;
    if(P.padsLit<P.pads.length) { brief(t('The exit is shut — light every pad first.')); return false; }
    if(P.lock && !P.opened){ brief(t('The exit is locked — shoot the lock.')); return false; }
    solved(); return true;
  }
  function solved(){
    stopClock(); busy=false; CODE.hideTape();
    const used=CODE.countBlocks(), timeUsed=P.L.par*2-left;
    let stars=1;
    if(timeUsed<=P.L.par) stars++;
    if(used<=P.L.budget) stars++;
    let best={}; try{ best=JSON.parse(localStorage.getItem('dq_puzzle')||'{}'); }catch(e){}
    if(!best[P.n]||stars>best[P.n]) { best[P.n]=stars; try{ localStorage.setItem('dq_puzzle',JSON.stringify(best)); }catch(e){} }
    if(window.beep) beep('star');
    const last = P.n>=LEVELS.length-1;
    if(last && window.PROGRESS) PROGRESS.complete('puzzles');
    document.querySelector('#ptimer').classList.add('hidden');
    const nextN = P.n+1;
    showResults({
      title:t('Puzzle solved!'),
      body:`<div class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>`+
           t('{name} — done in {t} seconds with {b} blocks.',{name:t(P.L.name),t:timeUsed,b:used}),
      stats:`<div><b>${t('Time')}</b> ${timeUsed}s (${t('par')} ${P.L.par}s)</div>
       <div><b>${t('Blocks')}</b> ${used}/${P.L.budget}</div>
       <div style="grid-column:1/-1"><b>${t('Your code')}</b><pre style="margin:6px 0 0;color:#8fd3ff">${CODE.toText().join('\n')||'—'}</pre></div>`,
      btnText: last ? t('Back to the menu') : t('Next puzzle ▶'),
      onBtn: last ? null : ()=>{ document.querySelector('#done').classList.add('hidden');
              G.running=true; build(nextN); lockPointer(document.querySelector('#view')); }
    });
    G.running=false;
  }

  /* ---------------------------------------------------------- public */
  return {
    start(n){ G.missionId='puzzles'; build(n||0); },
    run, hud,
    get active(){ return !!P; },
    get busy(){ return busy; },
    stop(){ stopClock(); runToken++; P=null; busy=false;
      document.querySelector('#ptimer').classList.add('hidden');
      document.querySelector('#mapwrap').classList.remove('hidden');
      CODE.setBudget(0); },
    retry(){ if(P) build(P.n); },
    count: LEVELS.length
  };
})();
