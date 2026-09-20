/* =====================================================================
   PIT — where you pick which body to write code for.

   One screen, one decision, and then out. It used to hold a little
   block editor of its own; it does not any more, because the ring runs
   the game's real Scratch and a second smaller editor standing in front
   of it was one editor too many.

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
  let wanted=new Set();      // templates ticked for this trip in

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
    el.innerHTML=`<div class="pit-wrap">
      <h1>${T('THE PIT')}</h1>
      <div class="pit-sub">${T('Pick a body, and pick anything you want a worked example of. You write the code in the ring \u2014 press C once you are in there.')}</div>
      <div class="pit-pick" id="pitPick"></div>
      <div class="pit-code">
        <div class="pit-codehead"><b>${T('WORKED EXAMPLES')}</b>
          <span class="pit-key">${T('written in the same blocks you have \u2014 take them apart')}</span></div>
        <p class="pit-key">${T('There is no PUNCH block and there is not going to be one. An attack is something you BUILD: a function, a variable, a loop, a test on a sensor and a message to whatever you hit. Tick one and it is written into your project as ordinary blocks \u2014 then change the numbers.')}</p>
        <div class="pit-temps" id="pitTemps"></div>
        <div class="pit-rules" id="pitRules"></div>
        <p class="pit-key" style="margin-top:10px">
          <b style="color:var(--star)">${T('Every one of these is called from inside a forever loop.')}</b>
          ${T('A conditional on its own is checked once, on the frame you pressed Run, and then never again \u2014 so the robot twitches once and stops. The loop is what turns it into a control, and it is the commonest thing to get wrong.')}</p>
      </div>
      <div class="pit-foot">
        <button class="btn ghost small" id="pitBack">◀</button>
        <button class="btn good" id="pitGo">${T('TAKE IT OUT \u25b6')}</button>
        <span class="pit-key" id="pitNote"></span>
      </div></div>`;
    chooser(); temps(); rules();
    $('#pitBack').onclick=()=>{ hide(); if(window.MENU) MENU.homeworld(); };
    $('#pitGo').onclick =()=>{ const add=[...wanted]; wanted.clear();
                               hide(); if(onGo) onGo(robot(), add); };
  }

  /* The worked examples, each with the numbers in it worth changing.
     THE `tune` LIST IS THE POINT OF THE CARD. "Change 0.6 to 2 and watch
     your reach" is a better exercise than any amount of explaining, and
     it is the difference between a student who has a punch and a student
     who knows why it is that long. */
  function temps(){
    const host=$('#pitTemps'); if(!host || !window.TEMPLATES) return;
    host.innerHTML='';
    TEMPLATES.LIST.forEach(t=>{
      const on=wanted.has(t.id);
      const card=document.createElement('button');
      card.className='pit-temp'+(on?' on':'');
      card.innerHTML=`
        <div class="pit-temphead"><span>${t.em}</span><b>${T(t.name)}</b>
          <span class="pit-tick">${on?'\u2714':'+'}</span></div>
        <p>${T(t.blurb)}</p>
        <div class="pit-teach">${T(t.teaches)}</div>
        <div class="pit-tune">${(t.tune||[]).map(x=>
          `<div><code>${x.what}</code><span>${T(x.does)}</span></div>`).join('')}</div>`;
      card.onclick=()=>{ if(wanted.has(t.id)) wanted.delete(t.id); else wanted.add(t.id);
                         temps(); note(); };
      host.appendChild(card);
    });
    note();
  }
  /* ------------------------------------------------------- the rules
     THE OTHER HALF OF THE GAME, and it is on screen because a student
     who has to guess at it cannot plan. Everything here is the
     referee's: their code decides when to swing and whether they can
     afford it, and nothing they write can move these numbers.

     Generated from rules.js rather than typed out, so the screen cannot
     say one thing while the referee does another. */
  function rules(){
    const host=$('#pitRules'); if(!host || !window.RULES) return;
    host.innerHTML=`
      <div class="pit-ruleshead"><b>${T('WHAT YOU CANNOT CHANGE')}</b>
        <span class="pit-key">${T('the referee\u2019s, not yours \u2014 you can read these, not set them')}</span></div>
      ${RULES.sheet().map(r=>
        `<div><code>${T(r.what)}</code><span>${T(r.says)}</span></div>`).join('')}`;
  }

  /* TAKE A HIT is the one that READS what the others write. Without it
     `guard` and `dodging` are numbers nobody looks at, which is not
     state, it is litter — so the pit says so rather than letting a
     student wonder why blocking does nothing. */
  function note(){
    const el=$('#pitNote'); if(!el) return;
    const sets=[...wanted].some(id=>['block','dodge'].indexOf(id)>=0);
    el.innerHTML = (sets && !wanted.has('answer'))
      ? `<b style="color:var(--star)">${T('BLOCK and DODGE only set a variable.')}</b> `+
        T('Add TAKE A HIT as well, or nothing ever reads it and they will look broken.')
      : wanted.size ? T('These are written in as ordinary blocks. Change anything.')
                    : T('You can take nothing and write it all yourself.');
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
