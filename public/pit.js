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
      <div class="pit-sub">${T('Pick a body. You write its code in the ring — press C once you are in there.')}</div>
      <div class="pit-pick" id="pitPick"></div>
      <div class="pit-code">
        <div class="pit-codehead"><b>${T('WHAT YOU ARE ABOUT TO WRITE')}</b>
          <span class="pit-key">${T('the same blocks as Free Play, cut down to the ones you need')}</span></div>
        <p class="pit-key">${T('Nothing moves this robot but your own blocks. There are no built-in controls — if you want a key to do something, you have to say so.')}</p>
        <pre class="pit-eg">${T('when ▶ the game starts')}
${T('forever')}
  ${T('if ‹key [right arrow] pressed?› then')}
    ${T('change x by 0.3')}</pre>
        <p class="pit-key">${T('The conditional has to be INSIDE the loop. On its own it is checked once, on the frame you pressed Run, and then never again — so the robot twitches and stops. The forever loop is what turns it into a control.')}</p>
      </div>
      <div class="pit-foot">
        <button class="btn ghost small" id="pitBack">◀</button>
        <button class="btn good" id="pitGo">${T('TAKE IT OUT ▶')}</button>
        <span class="pit-key">${T('Changing robot later keeps every script — it only changes the costume.')}</span>
      </div></div>`;
    chooser();
    $('#pitBack').onclick=()=>{ hide(); if(window.MENU) MENU.homeworld(); };
    $('#pitGo').onclick =()=>{ hide(); if(onGo) onGo(robot()); };
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
