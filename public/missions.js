/* =====================================================================
   MISSIONS — the course, as data.

   A mission is not a different game. It is the same shared world, the same
   VM and the same block editor, with three things decided for you: WHICH
   OBJECTS are standing in the room, WHICH BLOCKS you are handed, and WHAT
   COUNTS AS DONE. That is the whole shape of it, and it is why the list
   below can grow one row at a time.

   The course goes: events, then motion, then loops, interaction,
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

    { id:'loops', n:2, em:'🔁', a:'#8fd3ff',
      name:'Round and Round',
      teach:'Loops',
      goal:'Walk all the way round a square and finish where you started.',
      hint:'Four sides and four corners — but you only have to say it once.',
      cats:['events','control','motion'],
      ops:['event.flag','ctrl.repeat','motion.move','motion.turn'],
      /* the lesson is the loop, so the mission hands over the numbers a square
         needs rather than making a nine-year-old derive 360/4 first */
      defaults:{ 'ctrl.repeat':{ n:4 }, 'motion.turn':{ n:90 } },
      objects:[{ name:'Walker', shape:'people/character-f', colour:'#8fd3ff', size:1.7 }],
      /* Three things, because any two of them are easy and wrong: it went a
         real distance, it came home, and it got somewhere in BOTH directions
         on the way. Standing still comes home. A straight line goes far. Out
         and straight back does both — and is not a lap. */
      done:(c)=>{
        const m=c.mem, a=c.actor;
        /* The first side is already walked by the time anything gets to look:
           it happens in the frame that starts the run. So the tally opens at
           however far from home it has got, and the box starts as home-to-here. */
        if(!m.last){
          const h=a.home||{x:a.x,z:a.z};
          m.last={x:a.x,z:a.z}; m.path=c.moved;
          m.box={ x0:Math.min(h.x,a.x), x1:Math.max(h.x,a.x),
                  z0:Math.min(h.z,a.z), z1:Math.max(h.z,a.z) };
          return false;
        }
        m.path += Math.hypot(a.x-m.last.x, a.z-m.last.z);
        m.last={x:a.x,z:a.z};
        m.box.x0=Math.min(m.box.x0,a.x); m.box.x1=Math.max(m.box.x1,a.x);
        m.box.z0=Math.min(m.box.z0,a.z); m.box.z1=Math.max(m.box.z1,a.z);
        return m.path>3 && c.moved<0.6
            && (m.box.x1-m.box.x0)>0.6 && (m.box.z1-m.box.z0)>0.6;
      },
      steps:[
        { say:'Somebody to walk a square. Go over and press E.',
          world:true, done:()=>!!(window.CODER && CODER.open) },
        { say:'Start it the usual way.',
          sel:'#cPal [data-op="event.flag"]', done:c=>hats(c.actor)>0 },
        { say:'Open Control. This is where blocks that repeat other blocks live.',
          sel:'#cPal [data-c="control"]',
          done:()=>!!document.querySelector('#cPal [data-c="control"].on') },
        { say:'Take a repeat. Whatever you put inside it happens four times.',
          sel:'#cPal [data-op="ctrl.repeat"]', done:c=>loops(c.actor)>0 },
        { say:'Click the gap INSIDE the repeat. That is where the repeated blocks go.',
          find:()=>document.querySelector('#cScript .cmouth .cdrop'),
          done:()=>!!document.querySelector('#cScript .cmouth .cdrop.on') },
        { say:'Now Motion, and drop a move in there. That is one side of the square.',
          sel:'#cPal [data-c="motion"]',
          done:()=>!!document.querySelector('#cPal [data-c="motion"].on') },
        { say:'Click move. It lands inside the loop.',
          sel:'#cPal [data-op="motion.move"]', done:c=>inLoop(c.actor,'motion.move') },
        { say:'And a turn under it — that is the corner. Four sides, four corners, said once.',
          sel:'#cPal [data-op="motion.turn"]', done:c=>inLoop(c.actor,'motion.turn') },
        { say:'Press Run and watch it go round.',
          sel:'#cFlag', done:()=>won }
      ] },

    { id:'keys', n:3, em:'🎮', a:'#cdb4f6',
      name:'Take the Controls',
      teach:'Interaction',
      goal:'Drive Kit around with your own keys.',
      hint:'There is no green flag block in here. Your keyboard is what starts it.',
      cats:['events','motion'],
      ops:['event.key','motion.move','motion.turn'],
      objects:[{ name:'Kit', shape:'people/character-k', colour:'#cdb4f6', size:1.7 }],
      /* Nothing in this palette can move Kit except a key press, so moving at
         all is the proof. The mission is made of what it leaves out. */
      done:(c)=>c.moved>1.5,
      steps:[
        { say:'That is Kit. Walk over and press E.',
          world:true, done:()=>!!(window.CODER && CODER.open) },
        { say:'No "when the game starts" this time. Take this — it fires the moment that key goes down.',
          sel:'#cPal [data-op="event.key"]', done:c=>hats(c.actor)>0 },
        { say:'Open Motion and give it something to do when you press.',
          sel:'#cPal [data-c="motion"]',
          done:()=>!!document.querySelector('#cPal [data-c="motion"].on') },
        { say:'One move is enough.',
          sel:'#cPal [data-op="motion.move"]', done:c=>moves(c.actor)>0 },
        { say:'Press Run. That does not move Kit — it just makes the game listen.',
          sel:'#cFlag', done:()=>!!VM.running },
        { say:'Now hold SPACE. Every press is one step.',
          done:()=>won }
      ] },

    { id:'score', n:4, em:'🔢', a:'#ffb4a2',
      name:'Keep Score',
      teach:'Variables',
      goal:'Count to three, then say the number out loud.',
      hint:'score is a box that remembers a number. Put things in it, then read it back out.',
      cats:['events','looks','data'],
      ops:['event.flag','data.set','data.change','data.get','looks.say'],
      objects:[{ name:'Quinn', shape:'people/character-q', colour:'#ffb4a2', size:1.7 }],
      vars:{ score:0 },
      /* The number in the box got to three, and what it is saying is that same
         number — so it counted, and it read the box rather than a typed-in 3. */
      done:(c)=>{
        const v=VM.project.vars.score;
        const said=String(c.actor.saying==null?'':c.actor.saying).trim();
        return typeof v==='number' && v>=3 && said!=='' && Number(said)===v;
      },
      steps:[
        { say:'Quinn is going to count. Walk over and press E.',
          world:true, done:()=>!!(window.CODER && CODER.open) },
        { say:'Start it the usual way.',
          sel:'#cPal [data-op="event.flag"]', done:c=>hats(c.actor)>0 },
        { say:'Open Variables. There is already a box called score — watch its number as you go.',
          sel:'#cPal [data-c="data"]',
          done:()=>!!document.querySelector('#cPal [data-c="data"].on') },
        { say:'Put a zero in the box to begin with, so counting always starts from the same place.',
          sel:'#cPal [data-op="data.set"]', done:c=>count(c.actor,'data.set')>0 },
        { say:'Now click this three times. Each one adds one to what is in the box.',
          sel:'#cPal [data-op="data.change"]', done:c=>count(c.actor,'data.change')>=3 },
        { say:'Open Looks — Quinn is going to say the answer.',
          sel:'#cPal [data-c="looks"]',
          done:()=>!!document.querySelector('#cPal [data-c="looks"].on') },
        { say:'Add a say block.',
          sel:'#cPal [data-op="looks.say"]', done:c=>count(c.actor,'looks.say')>0 },
        { say:'Click the white box in that say block. It lights up, ready for something to drop in.',
          find:()=>document.querySelector('#cScript .cin[data-slot="s"]'),
          done:()=>!!document.querySelector('#cScript .cin.on') },
        { say:'Back to Variables, and click the round score block. It drops into the slot you just armed.',
          sel:'#cPal [data-op="data.get"]', done:c=>saysVar(c.actor) },
        { say:'Press Run. Quinn says whatever ended up in the box.',
          sel:'#cFlag', done:()=>won }
      ] },
    { id:'ifthen',  n:5, em:'❓', a:'#ffc8dd', name:'Only If',
      teach:'Conditionals',soon:true, cats:['events','motion','control','sensing','ops'],
      ops:['event.flag','motion.move','ctrl.if','ctrl.forever','sense.touch','op.gt'] },
    { id:'talk',    n:6, em:'📣', a:'#ffe9a8', name:'Pass It On',
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
  const count = (a,op) => a ? a.scripts.reduce((n,sc)=>n+sc.body.filter(b=>b.op===op).length,0) : 0;
  const loops = a => count(a,'ctrl.repeat');
  const inLoop = (a,op) => !!a && a.scripts.some(sc=>sc.body.some(
        b=>b.op==='ctrl.repeat' && (b.body||[]).some(x=>x.op===op)));
  /* a say block reading the box, rather than a 3 somebody typed in */
  const saysVar = a => !!a && a.scripts.some(sc=>sc.body.some(
        b=>b.op==='looks.say' && b.args && b.args.s && b.args.s.op==='data.get'));

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
    // a project saved before the variable existed still needs it
    if(m.vars) Object.keys(m.vars).forEach(k=>{
      if(!(k in VM.project.vars)) VM.project.vars[k]=m.vars[k]; });
    if(window.CODER){ CODER.restrict({ cats:m.cats, ops:m.ops, defaults:m.defaults, locked:true });
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
    if(m.vars) Object.keys(m.vars).forEach(k=>{ VM.project.vars[k]=m.vars[k]; });
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
