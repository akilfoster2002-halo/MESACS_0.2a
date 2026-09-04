/* =====================================================================
   MISSIONS — the course, as data.

   A mission is not a different game. It is the same shared world, the same
   VM and the same block editor, with three things decided for you: WHICH
   OBJECTS are standing in the room, WHICH BLOCKS you are handed, and WHAT
   COUNTS AS DONE. That is the whole shape of it, and it is why the list
   below can grow one row at a time.

   The course goes: events, then motion, then timing, loops, interaction,
   variables, conditionals, and objects talking to each other. Each mission
   opens exactly the blocks its idea needs and not one more — a palette of
   two blocks is a lesson; a palette of sixty is a wall. The rows for the
   missions that are not built yet are listed anyway, because a student
   should be able to see the road, and because it keeps the next one honest.
   ===================================================================== */
window.MISSIONS = (function(){

  const LIST=[
    { id:'ball', n:1, em:'⚪', a:'#ffd8a8',
      name:'Make the Ball Move',
      teach:'Events',
      goal:'Make the ball move when the game starts.',
      hint:'Walk up to the ball and press E. Snap a green block onto the yellow one, then press Run.',
      cats:['events','motion'],
      ops:['event.flag','motion.move'],
      objects:[{ name:'Ball', shape:'ball', colour:'#ffd8a8', size:1.6 }],
      /* moved, at all, because a program said so */
      done:(ctx)=>ctx.moved > 0.5,
      /* The first mission is walked. Each step says what it wants and how it
         knows it happened — from the world, not from the coach's memory, so
         a student who runs ahead is never told to do it again. */
      steps:[
        { say:'That glowing ball is yours. Walk over to it — W A S D to move, the mouse to look.',
          world:true, done:c=>near(c.actor,5) || looking(c.actor) },
        { say:'Now look straight at the ball and press E. That opens the ball\u2019s own code.',
          world:true, done:()=>!!(window.CODER && CODER.open) },
        { say:'These are the ball\u2019s blocks. Click this one — it starts your program when somebody presses Run.',
          sel:'#cPal [data-op="event.flag"]', done:c=>hats(c.actor)>0 },
        { say:'Good. Now open Motion to find something for the ball to actually do.',
          sel:'#cPal [data-c="motion"]',
          done:()=>!!document.querySelector('#cPal [data-c="motion"].on') },
        { say:'Click this. It snaps on underneath, so the ball moves when the game starts.',
          sel:'#cPal [data-op="motion.move"]', done:c=>moves(c.actor)>0 },
        { say:'That is a program. Press Run and watch the ball.',
          sel:'#cFlag', done:()=>won }
      ] },

    { id:'timing', n:2, em:'⏱️', a:'#a8e6cf',
      name:'Wait For It',
      teach:'Timing',
      goal:'Make the car drive, pause, then drive again.',
      hint:'Three blocks this time. A wait in the middle is what makes the pause.',
      cats:['events','motion','control'],
      ops:['event.flag','motion.move','ctrl.wait'],
      objects:[{ name:'Car', shape:'cars/raceCarRed', colour:'#ff9aa2', size:2.2 }],
      /* Judged by watching the car, not by reading the script: it moved, it
         stood still for a beat while the program was still going, then it
         moved again. A student who finds another way to do that has still
         understood the idea, which is the point. */
      done:(c)=>{
        const m=c.mem, a=c.actor;
        if(!m.last){ m.last={x:a.x,z:a.z}; m.still=0; return false; }
        const step=Math.hypot(a.x-m.last.x, a.z-m.last.z);
        m.last={x:a.x,z:a.z};
        if(step>0.002){
          if(m.paused) m.went=true;            // moving again, after the pause
          m.still=0;
        } else if(c.running){
          m.still += c.dt;
          /* A pause only counts once it has already driven somewhere — the
             stillness before the first move is just a script that has not
             started, and `wait` in front of a move is not what was asked for.
             Note the first move cannot be WATCHED happening: it lands in the
             same frame that starts the run. Where it ended up says so instead. */
          if(m.still>0.45 && c.moved>0.5) m.paused=true;
        }
        return !!m.went;
      },
      steps:[
        { say:'A car this time. Walk over and press E to open its code.',
          world:true, done:()=>!!(window.CODER && CODER.open) },
        { say:'Start the same way you did before.',
          sel:'#cPal [data-op="event.flag"]', done:c=>hats(c.actor)>0 },
        { say:'Open Motion and give it a move — that is the driving off part.',
          sel:'#cPal [data-c="motion"]',
          done:()=>!!document.querySelector('#cPal [data-c="motion"].on') },
        { say:'Click move. One is enough for now.',
          sel:'#cPal [data-op="motion.move"]', done:c=>moves(c.actor)>0 },
        { say:'Now Control. This is where waiting lives.',
          sel:'#cPal [data-c="control"]',
          done:()=>!!document.querySelector('#cPal [data-c="control"].on') },
        { say:'Add a wait. It holds the script here for a second before the next line runs.',
          sel:'#cPal [data-op="ctrl.wait"]', done:c=>waits(c.actor)>0 },
        { say:'Back to Motion for one more move, so there is something after the wait.',
          sel:'#cPal [data-c="motion"]', done:c=>moves(c.actor)>1 },
        { say:'Press Run. Watch for the pause in the middle — that is your wait.',
          sel:'#cFlag', done:()=>won }
      ] },
    { id:'loops',   n:3, em:'🔁', a:'#8fd3ff', name:'Round and Round',
      teach:'Loops',       soon:true, cats:['events','motion','control'],
      ops:['event.flag','motion.move','motion.turn','ctrl.repeat','ctrl.forever'] },
    { id:'keys',    n:4, em:'🎮', a:'#cdb4f6', name:'Take the Controls',
      teach:'Interaction', soon:true, cats:['events','motion','control'],
      ops:['event.key','motion.move','motion.turn','ctrl.forever','sense.key'] },
    { id:'score',   n:5, em:'🔢', a:'#ffb4a2', name:'Keep Score',
      teach:'Variables',   soon:true, cats:['events','motion','control','data'],
      ops:['event.flag','motion.move','data.set','data.change','data.get'] },
    { id:'ifthen',  n:6, em:'❓', a:'#ffc8dd', name:'Only If',
      teach:'Conditionals',soon:true, cats:['events','motion','control','sensing','ops'],
      ops:['event.flag','motion.move','ctrl.if','ctrl.forever','sense.touch','op.gt'] },
    { id:'talk',    n:7, em:'📣', a:'#ffe9a8', name:'Pass It On',
      teach:'Messaging',   soon:true, cats:['events','motion','control'],
      ops:['event.flag','event.send','event.recv','motion.move','ctrl.wait'] }
  ];

  const get = id => LIST.find(m=>m.id===id) || null;

  /* what the steps above ask the world about */
  const near = (a,d) => !!a && typeof G!=='undefined' &&
        Math.hypot(G.pos.x-a.x, G.pos.z-a.z) < d;
  const looking = a => !!a && typeof G!=='undefined' && !!G.focused &&
        G.focused.userData && G.focused.userData.actor===a;
  const hats  = a => a ? a.scripts.length : 0;
  const moves = a => a ? a.scripts.reduce((n,sc)=>n+sc.body.filter(b=>b.op==='motion.move').length,0) : 0;
  const waits = a => a ? a.scripts.reduce((n,sc)=>n+sc.body.filter(b=>b.op==='ctrl.wait').length,0) : 0;

  /* what a student has finished, per browser */
  const KEY='dq_missions_done';
  function record(id){
    try{ const d=JSON.parse(localStorage.getItem(KEY)||'{}'); d[id]=true;
         localStorage.setItem(KEY,JSON.stringify(d)); }catch(e){}
  }
  function isDone(id){
    try{ return !!JSON.parse(localStorage.getItem(KEY)||'{}')[id]; }catch(e){ return false; }
  }

  /* ------------------------------------------------------------- running */
  let active=null, won=false;
  /* Some missions are judged over time rather than in one glance — "it moved,
     then it stood still, then it moved again" is three frames apart at least.
     mem is a scratch pad for that, wiped at the start of every run so a second
     Run is judged fresh instead of finishing what the first one started. */
  let mem={}, threadsWere=0;

  /* Classmates share a room, so their objects must not share a spot. The
     golden angle spreads any number of people round a ring without anybody
     having to be told how many there are. */
  function spot(i, seat){
    const t=(seat*2.399963)+i*1.4;                 // 137.5° apart
    const r=7+ (i%2)*1.6;
    return { x:+(Math.cos(t)*r).toFixed(2), z:+(Math.sin(t)*r).toFixed(2) };
  }
  const seatOf = () => (window.NET && NET.me ? (NET.me.id%97) : 0);

  function start(id){
    const m=get(id); if(!m || m.soon) return null;
    active=m; won=false; mem={}; threadsWere=0;
    if(!fits(m)) furnish(m);
    if(window.CODER){ CODER.restrict({ cats:m.cats, ops:m.ops, locked:true });
                      CODER.setActor(VM.project.actors[0]||null); }
    paint();
    /* walked the first time through, and any time the page is blank again —
       a student who wiped their script wants showing, not congratulating */
    const a=VM.project.actors[0];
    if(window.COACH && m.steps && a && !a.scripts.length) COACH.start(m.steps, { actor:a });
    return m;
  }
  /* the room is right if it holds exactly the objects the mission asks for */
  function fits(m){
    const want=m.objects||[];
    const have=VM.project.actors.filter(a=>!a.isClone);
    return have.length===want.length && want.every((o,i)=>have[i] && have[i].shape===o.shape);
  }
  function furnish(m){
    VM.reset();
    (m.objects||[]).forEach((o,i)=>{
      const p=spot(i, seatOf());
      VM.addActor({ name:o.name, shape:o.shape, colour:o.colour,
                    size:o.size||1, x:p.x, y:o.y===undefined?1:o.y, z:p.z, dir:0 });
    });
    VM.save();
  }
  function stop(){
    active=null; won=false; mem={}; threadsWere=0;
    close_();
    if(window.COACH) COACH.stop();
    if(window.VM) VM.useSlot(null);
    if(window.CODER) CODER.restrict(null);
  }
  /* a mission keeps its own project, so the sandbox somebody spent an hour on
     is still there afterwards, exactly as they left it */
  const slotFor = id => 'dq_m_'+id;

  /* Has it happened yet? Measured against where the object was MADE, not
     against the last frame: a run that finishes in a single step is over
     before any watcher gets a second look at it, and nothing but code can
     move a mission object anyway. */
  function tick(dt){
    coach(dt);
    if(!active || won || !active.done) return;
    const a=VM.project.actors[0];
    if(!a) return;
    const live=VM.threadCount;
    if(live>0 && threadsWere===0) mem={};        // a fresh Run is judged fresh
    threadsWere=live;
    const h=a.home||{x:a.x,y:a.y,z:a.z};
    const moved=Math.hypot(a.x-h.x, a.y-h.y, a.z-h.z);
    if(active.done({ moved, actor:a, dt:dt||0.016, running:!!VM.running, mem })) win();
  }
  /* the coach runs off the same frame as the mission it belongs to */
  function coach(dt){ if(window.COACH) COACH.tick(dt); }
  function win(){
    if(won||!active) return;
    won=true; record(active.id);
    paint();
    if(window.CHAT && CHAT.open)
      CHAT.sys(t('{n} solved it!',{n: (window.NET&&NET.me)?NET.me.display:t('You')}));
    offerNext();
  }

  /* the next one that actually exists */
  function nextOf(id){
    const i=LIST.findIndex(m=>m.id===id);
    if(i<0) return null;
    for(let k=i+1;k<LIST.length;k++) if(!LIST[k].soon) return LIST[k];
    return null;
  }

  /* On solving, the course carries on by itself — but after a beat, and with
     a way out. Being yanked out of the room the moment your program worked is
     no reward at all: you want to watch the thing you just made. */
  const WAIT=7;
  let countdown=null;
  function offerNext(){
    const nxt=nextOf(active.id);
    const card=document.createElement('div');
    card.id='nextUp';
    document.body.appendChild(card);
    if(!nxt){
      card.innerHTML=`<div class="nuhead">🎉 ${t('Solved!')}</div>
        <div class="nubody">${t('That is the last mission built so far. The sandbox has every block in it whenever you want a go.')}</div>
        <div class="nurow"><button class="btn small ghost" id="nuStay">${t('Stay here')}</button></div>`;
      document.querySelector('#nuStay').onclick=close_;
      return;
    }
    let left=WAIT;
    const draw=()=>{
      card.innerHTML=`<div class="nuhead">🎉 ${t('Solved!')}</div>
        <div class="nubody">${t('Next')}: <b>${t('Mission {n} — {name}',{n:nxt.n,name:t(nxt.name)})}</b>
          <span class="nuteach">${t(nxt.teach)}</span></div>
        <div class="nubar"><i style="width:${(left/WAIT)*100}%"></i></div>
        <div class="nurow">
          <button class="btn small good" id="nuGo">${t('Go now')} ▶</button>
          <button class="btn small ghost" id="nuStay">${t('Stay here')} (${left})</button>
        </div>`;
      document.querySelector('#nuGo').onclick=()=>{ close_(); go(nxt.id); };
      document.querySelector('#nuStay').onclick=close_;
    };
    draw();
    countdown=setInterval(()=>{
      left--;
      if(left<=0){ close_(); go(nxt.id); return; }
      draw();
    }, 1000);
  }
  function close_(){
    clearInterval(countdown); countdown=null;
    const c=document.querySelector('#nextUp'); if(c) c.remove();
  }
  function go(id){
    close_();
    if(window.CODER) CODER.hide();
    if(window.FREE) FREE.go(id);
  }

  /* the objective panel is the mission's, while it is running */
  function paint(){
    const el=document.querySelector('#objList'); if(!el||!active) return;
    el.innerHTML = won
      ? `<li class="cur">✅ <b>${t('Solved!')}</b></li>
         <li>${esc(t(active.goal))}</li>
         <li>${esc(t('Press Run again to watch it, or go back for the next mission.'))}</li>`
      : `<li class="cur">🎯 ${esc(t(active.goal))}</li>
         <li>${esc(t(active.hint||''))}</li>
         <li>${esc(t('Teaching'))}: <b>${esc(t(active.teach))}</b></li>`;
    const n=document.querySelector('#missionName');
    if(n) n.textContent=t('Mission {n} — {name}',{n:active.n, name:t(active.name)});
  }
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  return { LIST, get, start, stop, tick, paint, isDone, slotFor, nextOf, go,
           get active(){ return active; }, get won(){ return won; } };
})();
