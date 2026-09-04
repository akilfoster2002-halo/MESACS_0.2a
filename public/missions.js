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

    { id:'timing',  n:2, em:'⏱️', a:'#a8e6cf', name:'Wait For It',
      teach:'Timing',      soon:true, cats:['events','motion','control'],
      ops:['event.flag','motion.move','motion.turn','ctrl.wait'] },
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
    active=m; won=false;
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
    active=null; won=false;
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
    const h=a.home||{x:a.x,y:a.y,z:a.z};
    const moved=Math.hypot(a.x-h.x, a.y-h.y, a.z-h.z);
    if(active.done({ moved, actor:a })) win();
  }
  /* the coach runs off the same frame as the mission it belongs to */
  function coach(dt){ if(window.COACH) COACH.tick(dt); }
  function win(){
    if(won||!active) return;
    won=true; record(active.id);
    paint();
    if(window.CHAT && CHAT.open)
      CHAT.sys(t('{n} solved it!',{n: (window.NET&&NET.me)?NET.me.display:t('You')}));
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

  return { LIST, get, start, stop, tick, paint, isDone, slotFor,
           get active(){ return active; }, get won(){ return won; } };
})();
