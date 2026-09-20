/* =====================================================================
   PIT — where you pick a robot and say what the keys do.

   The front door of the mode, and the whole of it fits on one screen:
   two robots to choose between, and a short list of rules that read

       WHEN [D] IS PRESSED
         STEP RIGHT

   THE PROGRAM IS THE CONTROLS. Nothing in this game is bound to a key
   for you in here — if you do not write a rule, pressing the key does
   nothing, and the ring says so. That is the point of the screen: a
   student who wants to move right has to say so in a block, and the
   first time they press D and the robot goes, they have written a
   program that did something to a body with legs.

   CLICK TO BUILD, not drag and drop. Every rule is a key dropdown and an
   action dropdown, and adding one is a button. Dragging is lovely when
   it works and miserable on a trackpad in a lab.

   ORDER MATTERS AND THE SCREEN SAYS SO. The first rule whose key is held
   is the one that runs, so every row can be moved up and down, and two
   rules on one key get a warning rather than a refusal — it is legal,
   it is just probably not what they meant.

   There is no save button, because there is nothing one could mean: the
   rules in front of you ARE the rules the robot will run.
   ===================================================================== */
window.PIT = (function(){
  const $ = s => document.querySelector(s);
  const MC = ()=>window.MECHACODE;
  const RB = ()=>window.ROBOTS;
  const T  = s => (window.t ? t(s) : s);
  const TP = (s,p) => (window.t ? t(s,p) : s);

  let open=false, err=null, onGo=null;
  let uid=1;
  const nid = ()=>'p'+(uid++);
  const LIMIT=12;

  /* ---------------------------------------------------------- storage
     The rules and the robot ride in the same bag as coins and finished
     missions, so they follow the account to any machine in the lab.
     localStorage is the fallback for a signed-out browser, which is the
     only case with nowhere better to put them. */
  function stash(k, v){
    if(window.PROGRESS) PROGRESS.set(k, v);
    try{ localStorage.setItem('dq_'+k, JSON.stringify(v)); }catch(e){}
  }
  function fetch(k, dflt){
    let v=null;
    if(window.PROGRESS) v=PROGRESS.get(k, null);
    if(v===null || v===undefined){
      try{ v=JSON.parse(localStorage.getItem('dq_'+k)||'null'); }catch(e){ v=null; }
    }
    return (v===null || v===undefined) ? dflt : v;
  }
  function robot(){
    const id=fetch('pit_robot', null);
    return RB().byId(id) ? id : RB().LIST[0].id;
  }
  function pickRobot(id){ if(RB().byId(id)){ stash('pit_robot', id); render(); } }

  /* THE ONE COPY BEING EDITED. The rows below hold references into this
     list — a dropdown changes `r.key` on the rule itself — so the editor
     has to be looking at the same objects it renders from. */
  let draft=null;
  function program(){
    if(!draft){
      const v=fetch('pit_program', null);
      draft = Array.isArray(v) ? v : [];
    }
    return draft;
  }
  function commit(){ stash('pit_program', program()); editor(); }

  /* ---------------------------------------------------------- screen */
  function show(opts){
    opts=opts||{};
    onGo=opts.onGo||null;
    open=true; draft=null; err=null;
    if(typeof G!=='undefined') G.running=false;
    if(document.pointerLockElement) document.exitPointerLock();
    if(window.MENU) MENU.hideAll();
    const hud=$('#hud'); if(hud) hud.classList.add('hidden');
    $('#pit').classList.remove('hidden');
    render();
  }
  function hide(){ open=false; err=null; $('#pit').classList.add('hidden'); }

  function render(){
    const el=$('#pit'); if(!el) return;
    el.innerHTML=`<div class="pit-wrap">
      <h1>${T('THE PIT')}</h1>
      <div class="pit-sub">${T('Pick a robot, then say what its keys do. If you do not write a rule for a key, that key does nothing.')}</div>
      <div class="pit-pick" id="pitPick"></div>
      <div class="pit-code" id="pitCode"></div>
      <div class="pit-foot">
        <button class="btn ghost small" id="pitBack">◀</button>
        <button class="btn good" id="pitGo">${T('TAKE IT OUT ▶')}</button>
        <span class="pit-key">${T('Only the feet are wired up so far — left and right.')}</span>
      </div></div>`;
    chooser(); editor();
    $('#pitBack').onclick=()=>{ hide(); if(window.MENU) MENU.homeworld(); };
    $('#pitGo').onclick =()=>{ hide(); if(onGo) onGo(robot(), program()); };
  }

  /* ------------------------------------------------------ the robots */
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
            <i><b style="width:${Math.round(r.height/5*100)}%"></b></i></div>
          <div class="pit-bar"><span>${T('SPEED')}</span>
            <i><b style="width:${Math.round(r.speed/1.3*100)}%"></b></i></div>
        </div>`;
      card.onclick=()=>pickRobot(r.id);
      host.appendChild(card);
    });
  }

  /* ------------------------------------------------------- the rules */
  function editor(){
    const host=$('#pitCode'); if(!host) return;
    const prog=program();
    const check=MC().validate(prog, { limit:LIMIT });
    host.innerHTML=`
      <div class="pit-codehead">
        <b>${T('THE CONTROLS')}</b>
        <span class="pit-key">${T('the first rule whose key is held is the one that runs')}</span>
        <span class="pit-budget">${TP('{n} / {m} blocks',{n:check.blocks, m:LIMIT})}</span>
      </div>
      <div class="pit-prog" id="pitProg"></div>
      <div class="pit-err" id="pitErr"></div>`;
    rows(prog);
    const e=$('#pitErr');
    if(e){
      const msgs=(err?[{msg:err}]:[]).concat(check.errors||[]);
      e.innerHTML=msgs.map(m=>
        `<div class="${m.warn?'warn':''}">${T(m.msg)}</div>`).join('');
    }
  }

  function rows(prog){
    const host=$('#pitProg'); if(!host) return;
    host.innerHTML='';
    if(!prog.length){
      const p=document.createElement('div');
      p.className='pit-empty';
      p.innerHTML=T('No rules yet. Every key on this robot does nothing until you say otherwise — add one below.');
      host.appendChild(p);
    }
    prog.forEach((r,i)=>host.appendChild(rule(r, prog, i)));

    const add=document.createElement('button');
    add.className='pit-add';
    add.textContent=T('+ when a key is pressed…');
    add.onclick=()=>{
      if(MC().countBlocks(prog)+2 > LIMIT){
        err=TP('That is the limit — {m} blocks.',{m:LIMIT}); return editor();
      }
      err=null;
      /* Opens on a key nothing is using yet, so pressing + twice does not
         silently make a rule that can never run. */
      const taken=new Set(prog.map(x=>x.key));
      const free=MC().KEY_IDS.find(k=>!taken.has(k)) || MC().KEY_IDS[0];
      prog.push({ id:nid(), type:'when', key:free,
                  body:[{ id:nid(), type:MC().ACTION_IDS[0] }] });
      commit();
    };
    host.appendChild(add);
  }

  function rule(r, list, i){
    const wrap=document.createElement('div');
    wrap.className='pit-row';
    const body=document.createElement('div');
    body.className='pit-body';
    body.style.background='#cdb4f6';
    body.innerHTML=`<span>${T('WHEN')}</span>`;
    body.appendChild(pick(MC().KEYS.map(k=>({v:k.id,l:T(k.label)})), r.key,
      v=>{ r.key=v; commit(); }));
    const isp=document.createElement('span');
    isp.textContent=T('IS PRESSED'); body.appendChild(isp);

    const act=(r.body&&r.body[0]) || null;
    const doo=document.createElement('span');
    doo.textContent='→'; doo.style.opacity='.6'; body.appendChild(doo);
    body.appendChild(pick(MC().ACTION_IDS.map(a=>({v:a,l:T(MC().ACTIONS[a].label)})),
      act?act.type:MC().ACTION_IDS[0],
      v=>{ if(act) act.type=v; else r.body=[{id:nid(),type:v}]; commit(); }));

    wrap.appendChild(body);
    wrap.appendChild(btn('▲','pit-up', ()=>{ if(i>0){ list.splice(i-1,0,list.splice(i,1)[0]); commit(); } }));
    wrap.appendChild(btn('▼','pit-dn', ()=>{ if(i<list.length-1){ list.splice(i+1,0,list.splice(i,1)[0]); commit(); } }));
    wrap.appendChild(btn('✕','pit-x',  ()=>{ list.splice(i,1); err=null; commit(); }));
    return wrap;
  }

  function btn(txt, cls, fn){
    const b=document.createElement('button');
    b.className=cls; b.textContent=txt; b.onclick=fn; return b;
  }
  function pick(opts, value, fn){
    const s=document.createElement('select');
    opts.forEach(o=>{
      const e=document.createElement('option');
      e.value=o.v; e.textContent=o.l; if(o.v===value) e.selected=true;
      s.appendChild(e);
    });
    s.onchange=()=>fn(s.value);
    return s;
  }

  return { show, hide, program, robot, pickRobot, LIMIT,
           get open(){ return open; } };
})();
