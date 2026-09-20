/* =====================================================================
   PIT — where you pick which body to write code for.

   One screen, one decision, and then out. It used to hold a little
   block editor of its own; it does not any more, because the ring runs
   the game's real Scratch and a second smaller editor standing in front
   of it was one editor too many.

   TWO DECISIONS: which body, and which mission. The worked examples used
   to be on here too — five cards about punching, in front of a student
   whose next twenty minutes are `change x by`. They belong beside the
   block they are about, so the ring hands them over a step at a time.

   AND NOTHING IS UNLOCKED, because nothing is kept. All five missions are
   on the screen every time. There is no progress to gate them behind and
   nothing to resume: every go opens an empty room at step one.

   WHAT IS LEFT IS WORTH A SCREEN. The two robots are genuinely
   different to write code for — one is tall and covers ground, one is
   short and does not — and picking a body before you write anything is
   the same order Scratch does it in: choose a sprite, then give it
   scripts. The choice is remembered on the account, and changing it
   later changes the COSTUME without touching a single script, because
   the robot in there is one actor and its code belongs to it, not to
   whichever model it happens to be wearing.
   ===================================================================== */
window.PIT = (function(){
  const $ = s => document.querySelector(s);
  const RB = ()=>window.ROBOTS;
  const T  = s => (window.t ? t(s) : s);

  let open=false, onGo=null;

  /* The pick rides in the same bag as coins and finished missions, so it
     follows the account to any machine in the lab. localStorage is the
     fallback for a signed-out browser. */
  function stash(k,v){
    if(window.PROGRESS) PROGRESS.set(k,v);
    try{ localStorage.setItem('dq_'+k, JSON.stringify(v)); }catch(e){}
  }
  function fetch(k,d){
    let v=null;
    if(window.PROGRESS) v=PROGRESS.get(k,null);
    if(v===null||v===undefined){
      try{ v=JSON.parse(localStorage.getItem('dq_'+k)||'null'); }catch(e){ v=null; }
    }
    return (v===null||v===undefined)?d:v;
  }
  /* WHICH MISSION YOU ARE ABOUT TO DO. Not saved and not unlocked —
     nothing in the ring is kept, so there is no progress to gate on and
     nothing to resume. All five are here every time; a student who wants
     the fight can have the fight, and one who wants to do stage one again
     gets an empty room to do it in. */
  let mission=0;
  const missions = () => (window.STAGES ? STAGES.LIST : []);

  function robot(){
    const id=fetch('pit_robot', null);
    return RB().byId(id) ? id : RB().LIST[0].id;
  }
  function pickRobot(id){ if(RB().byId(id)){ stash('pit_robot', id); render(); } }

  function show(opts){
    opts=opts||{};
    onGo=opts.onGo||null;
    open=true;
    if(typeof G!=='undefined') G.running=false;
    if(document.pointerLockElement) document.exitPointerLock();
    if(window.MENU) MENU.hideAll();
    const hud=$('#hud'); if(hud) hud.classList.add('hidden');
    $('#pit').classList.remove('hidden');
    render();
  }
  function hide(){ open=false; $('#pit').classList.add('hidden'); }

  function render(){
    const el=$('#pit'); if(!el) return;
    /* TWO DECISIONS AND A BUTTON. The worked examples used to live here —
       five cards of punch in front of a student whose next twenty minutes
       are `change x by`. They are in the ring now, handed over a step at a
       time by the thing that is teaching them. */
    el.innerHTML=`<div class="pit-wrap">
      <h1>${T('THE PIT')}</h1>
      <div class="pit-sub">${T('Pick a body and a mission. Nothing is saved \u2014 every go is a fresh room.')}</div>
      <div class="pit-pick" id="pitPick"></div>
      <div class="pit-missions" id="pitMissions"></div>
      <div class="pit-rules" id="pitRules"></div>
      <div class="pit-foot">
        <button class="btn ghost small" id="pitBack">\u25c0</button>
        <button class="btn good" id="pitGo">${T('TAKE IT OUT \u25b6')}</button>
        <span class="pit-key" id="pitNote"></span>
      </div></div>`;
    chooser(); missionList(); rules();
    $('#pitBack').onclick=()=>{ hide(); if(window.MENU) MENU.homeworld(); };
    $('#pitGo').onclick =()=>{ hide(); if(onGo) onGo(robot(), [], mission); };
  }

  /* The five, as a row you pick from. Each one says what it teaches in
     three words and nothing else — the teaching itself happens in the
     ring, beside the block it is about. */
  /* ------------------------------------------------------- the rules
     THE OTHER HALF OF THE GAME. A student who has to guess at what a
     punch costs cannot plan one, so the numbers are on the screen — from
     the moment there is a punch to plan. Before that they are noise about
     something that has not happened yet.

     Generated from rules.js rather than typed out, so the screen cannot
     say one thing while the referee does another. */
  const RULES_FROM = 2;                     // mission 3, the first with a punch in it
  function rules(){
    const host=$('#pitRules'); if(!host) return;
    if(mission < RULES_FROM || !window.RULES){ host.innerHTML=''; return; }
    host.innerHTML=`
      <div class="pit-ruleshead"><b>${T('WHAT YOU CANNOT CHANGE')}</b>
        <span class="pit-key">${T('read these, not set them')}</span></div>
      ${RULES.sheet().map(r=>
        `<div><code>${T(r.what)}</code><span>${T(r.says)}</span></div>`).join('')}`;
  }

  function missionList(){
    const host=$('#pitMissions'); if(!host) return;
    host.innerHTML=missions().map((s,i)=>`
      <button class="pit-mis${i===mission?' on':''}" data-m="${i}" style="--a:${s.a}">
        <span class="pit-mis-n">${s.n}</span>
        <span class="pit-mis-em">${s.em}</span>
        <b>${T(s.name)}</b>
        <small>${T(s.teach)}</small>
      </button>`).join('');
    host.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{
      mission=+b.dataset.m; missionList(); rules(); note();
    });
    note();
  }




  /* TAKE A HIT is the one that READS what the others write. Without it
     `guard` and `dodging` are numbers nobody looks at, which is not
     state, it is litter — so the pit says so rather than letting a
     student wonder why blocking does nothing. */
  function note(){
    const el=$('#pitNote'); if(!el) return;
    const s=missions()[mission];
    el.textContent = s ? T(s.goal) : '';
  }

  function chooser(){
    const host=$('#pitPick'); if(!host) return;
    const mine=robot();
    host.innerHTML='';
    RB().LIST.forEach(r=>{
      const card=document.createElement('button');
      card.className='pit-card'+(r.id===mine?' on':'');
      card.style.setProperty('--plate', r.skin.plate);
      card.style.setProperty('--trim',  r.skin.trim);
      card.innerHTML=`
        <div class="pit-cardtop"><span class="pit-em">${r.em}</span>
          <div><b>${r.name}</b><small>${T(r.tag)}</small></div>
          ${r.id===mine?`<span class="pit-tick">✔</span>`:''}</div>
        <p>${T(r.blurb)}</p>
        <div class="pit-bars">
          <div class="pit-bar"><span>${T('HEIGHT')}</span>
            <i><b style="width:${Math.round(r.height/5*100)}%"></b></i>
            <span style="width:42px;text-align:right">${r.height} m</span></div>
        </div>`;
      card.onclick=()=>pickRobot(r.id);
      host.appendChild(card);
    });
  }

  return { show, hide, robot, pickRobot, get open(){ return open; } };
})();
