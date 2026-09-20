/* =====================================================================
   PIT — where a robot is picked and given its orders.

   This is the front door of the whole mode. There is no world to walk
   across to reach it and no building to find: Mission Control hands you
   straight to this screen, because everything that makes the arena worth
   playing is on it.

   TWO THINGS HAPPEN HERE, IN ORDER.

   FIRST YOU PICK A ROBOT, and the two are opposites so that the pick is
   a real one. The bars under each of them are the same bars, so "longer
   arms, thinner plate" is something you can see rather than something
   you have to be told. What you picked is saved, because a student who
   spent a lesson learning NOISY BOY's reach should not have to find him
   again on Friday.

   THEN YOU CLICK A PART OF HIM AND GIVE THAT PART ITS ORDERS. The robot
   on the left is drawn in its pieces and every piece is a button, so
   nobody has to be told which code controls what — you got to that code
   by pressing that arm. The number under each part is how many blocks it
   is carrying, so a robot with an empty left arm looks like one.

   THE EDITOR IS CLICK-TO-BUILD, not drag-and-drop. Every place a block
   can go has a + on it; pressing one says where the next block lands and
   the palette says what may go there. Dragging is lovely when it works
   and miserable on a trackpad in a lab.

   ORDER MATTERS AND THE SCREEN SAYS SO. The first action a part reaches
   is the one it takes, so every row can be moved up and down.

   There is no save button, because there is nothing one could mean: the
   program in front of you IS the program the robot will fight with.
   ===================================================================== */
window.PIT = (function(){
  const $ = s => document.querySelector(s);
  const MC = ()=>window.MECHACODE;
  const RB = ()=>window.ROBOTS;
  const T  = s => (window.t ? t(s) : s);
  const TP = (s,p) => (window.t ? t(s,p) : s);

  let open=false, sel='left_arm', target=null, err=null, onFight=null;
  let uid=1;
  const nid = ()=>'p'+(uid++);
  const LIMIT=24;

  /* ---------------------------------------------------------- storage
     Orders and the robot they belong to ride in the same bag as coins
     and finished missions, so they follow the account to any machine in
     the lab. localStorage is the fallback for a signed-out browser,
     which is the only case that has nowhere better to put them. */
  const KEY = part => 'pit_'+part;
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
  const loadProg = part => { const v=fetch(KEY(part), []); return Array.isArray(v)?v:[]; };
  const saveProg = (part, tree) => stash(KEY(part), tree);

  function robot(){
    const id=fetch('pit_robot', null);
    return RB().byId(id) ? id : RB().LIST[0].id;
  }
  function pickRobot(id){
    if(!RB().byId(id)) return;
    stash('pit_robot', id);
    render();
  }

  /* THE ONE COPY BEING EDITED. The rows below hold references into this
     tree — a dropdown changes `b.ev` on the block itself — so the editor
     has to be looking at the same objects it renders from, not a fresh
     parse each time. One draft, for one part, dropped the moment another
     part is selected. */
  let draft=null, draftFor=null;
  function current(){
    if(draftFor!==sel){ draft=loadProg(sel); draftFor=sel; }
    return draft;
  }
  function commit(){ saveProg(sel, current()); figure(); editor(); }

  /* every part's orders at once, which is what a fight is handed */
  function programs(){
    const out={};
    MC().PARTS.forEach(p=>{ if(p.kind!=='none')
      out[p.id] = (p.id===draftFor && draft) ? draft : loadProg(p.id); });
    return out;
  }
  const blocksIn = part => MC().countBlocks(part===draftFor ? draft : loadProg(part));

  /* ---------------------------------------------------------- the screen */
  function show(opts){
    opts=opts||{};
    onFight=opts.onFight||null;
    open=true;
    if(typeof G!=='undefined') G.running=false;
    if(document.pointerLockElement) document.exitPointerLock();
    if(window.MENU) MENU.hideAll();
    const hud=$('#hud'); if(hud) hud.classList.add('hidden');
    $('#pit').classList.remove('hidden');
    render();
  }
  function hide(){
    open=false; err=null; target=null;
    $('#pit').classList.add('hidden');
  }

  function render(){
    const el=$('#pit'); if(!el) return;
    el.innerHTML=`<div class="pit-wrap">
      <h1>${T('THE PIT')}</h1>
      <div class="pit-sub">${T('You drive it. Your code fights with it. Pick a robot, then click a part to give that part its orders.')}</div>
      <div class="pit-pick" id="pitPick"></div>
      <div class="pit-cols">
        <div class="pit-bot">
          <div class="pit-fig" id="pitFig"></div>
          <div class="pit-key" id="pitKey"></div>
        </div>
        <div class="pit-code" id="pitCode"></div>
      </div>
      <div class="pit-foot">
        <button class="btn ghost small" id="pitBack">◀</button>
        <button class="btn" id="pitSolo">${T('TRAIN ALONE ▶')}</button>
        <button class="btn good" id="pitPvp">${T('FIND AN OPPONENT ▶')}</button>
        <span class="pit-key">${T('Training runs the same fight against a dummy, on this machine.')}</span>
      </div></div>`;
    chooser(); figure(); editor();
    $('#pitBack').onclick=()=>{ hide(); if(window.MENU) MENU.homeworld(); };
    $('#pitSolo').onclick=()=>{ hide(); if(onFight) onFight('solo', robot(), programs()); };
    $('#pitPvp').onclick =()=>{ hide(); if(onFight) onFight('pvp',  robot(), programs()); };
  }

  /* ------------------------------------------------------ the two robots
     Same bars under both of them, drawn from the same numbers the fight
     multiplies by, so the picture cannot drift away from the fighting. */
  function chooser(){
    const host=$('#pitPick'); if(!host) return;
    const mine=robot();
    const BARS=[
      { k:'reach',  l:'REACH'  }, { k:'power', l:'POWER' },
      { k:'armour', l:'PLATE'  }, { k:'speed', l:'SPEED' },
      { k:'swing',  l:'HANDS', flip:true }
    ];
    host.innerHTML='';
    RB().LIST.forEach(r=>{
      const card=document.createElement('button');
      card.className='pit-card'+(r.id===mine?' on':'');
      card.style.setProperty('--plate', r.skin.plate);
      card.style.setProperty('--trim',  r.skin.trim);
      const bars=BARS.map(b=>{
        /* Quick hands are a LOW swing number, so that one bar is read
           the other way up — otherwise the fastest robot would look
           like the worst one. */
        const v=b.flip ? 2-r[b.k] : r[b.k];
        const pc=Math.max(6, Math.min(100, Math.round((v/1.4)*100)));
        return `<div class="pit-bar"><span>${T(b.l)}</span>
                  <i><b style="width:${pc}%"></b></i></div>`;
      }).join('');
      card.innerHTML=`
        <div class="pit-cardtop"><span class="pit-em">${r.em}</span>
          <div><b>${r.name}</b><small>${T(r.tag)}</small></div>
          ${r.id===mine?`<span class="pit-tick">✔</span>`:''}</div>
        <p>${T(r.blurb)}</p>
        <div class="pit-bars">${bars}</div>`;
      card.onclick=()=>pickRobot(r.id);
      host.appendChild(card);
    });
  }

  /* ------------------------------------- the robot, in parts, as buttons */
  function figure(){
    const fig=$('#pitFig'); if(!fig) return;
    const spec=RB().get(robot());
    fig.innerHTML='';
    const slot={ core:'pit-core', left_arm:'pit-larm', right_arm:'pit-rarm',
                 legs:'pit-legs', sensor:'pit-head' };
    const EM={ left_arm:'🦾', right_arm:'🦾', legs:'🦿', sensor:'👁', core:'⚡' };
    MC().PARTS.forEach(p=>{
      const b=document.createElement('button');
      const codeable=p.kind!=='none';
      b.className='pit-part '+slot[p.id]+(sel===p.id?' on':'');
      b.style.setProperty('--trim', spec.skin.trim);
      const n=codeable ? blocksIn(p.id) : 0;
      b.innerHTML=`<div style="font-size:17px">${EM[p.id]||'▣'}</div>
        <b>${T(p.label)}</b>
        <div class="pit-n">${codeable ? (n? TP('{n} blocks',{n}) : T('no orders'))
                                      : T('no orders to give')}</div>
        <div class="pit-hp">${spec.parts[p.id]}</div>`;
      b.onclick=()=>{ sel=p.id; target=null; err=null; draftFor=null; figure(); editor(); };
      fig.appendChild(b);
    });
    $('#pitKey').innerHTML=
      `<b>${T('CORE')}</b> ${T('is your life. At zero you are out.')}<br>
       <b>${T('SENSOR')}</b> ${T('is how your code sees. Wreck theirs and their code goes blind.')}<br>
       <b>${T('LEGS')}</b> ${T('are your speed, how fast you turn, and where a dodge comes from.')}<br>
       <span style="color:var(--star)">${T('The number on each part is how much of it there is.')}</span>`;
  }

  /* ------------------------------------------------------- the editor */
  function editor(){
    const host=$('#pitCode'); if(!host) return;
    const part=MC().partById(sel);
    if(part.kind==='none'){
      host.innerHTML=`<div class="pit-codehead"><b>${T(part.label)}</b></div>
        <div class="pit-empty">${part.id==='core'
          ? T('The core takes no orders. It is the energy you spend and the thing they are trying to destroy.')
          : T('The sensor takes no orders. It is where every reading in every other part comes from — which is why breaking it is worth doing.')}</div>`;
      return;
    }
    const prog=current(), n=MC().countBlocks(prog);
    host.innerHTML=`
      <div class="pit-codehead">
        <b>${T(part.label)}</b>
        <span class="pit-key">${T('the first action it reaches is the one it takes')}</span>
        <span class="pit-budget">${TP('{n} / {m} blocks',{n, m:LIMIT})}</span>
      </div>
      <div class="pit-editor">
        <div class="pit-pal" id="pitPal"></div>
        <div>
          <div class="pit-prog" id="pitProg"></div>
          <div class="pit-err" id="pitErr"></div>
        </div>
      </div>`;
    palette(part);
    tree(prog);
    const e=$('#pitErr'); if(e) e.textContent=err||'';
  }

  /* What can be added, and where it would go. The palette answers the
     second question as much as the first: with nothing selected it can
     only offer a WHEN, because a loose block is one nothing ever asks. */
  function palette(part){
    const pal=$('#pitPal'); if(!pal) return;
    pal.innerHTML='';
    /* The top of the program is the empty path — and an empty array is
       perfectly truthy, so "nothing selected" and "the top selected"
       both have to be asked for by length rather than by existence. */
    const root = !target || !target.length;
    const head=txt=>{ const h=document.createElement('h4'); h.textContent=T(txt); pal.appendChild(h); };
    const blk=(label, help, colour, fn)=>{
      const b=document.createElement('button');
      b.className='pit-blk'; b.style.background=colour;
      b.innerHTML=`${T(label)}${help?`<small>${T(help)}</small>`:''}`;
      b.onclick=fn; pal.appendChild(b);
    };
    if(root){
      head('WHEN — start a new rule');
      MC().EVENTS.forEach(ev=>blk(ev.label, ev.help, '#cdb4f6',
        ()=>add({ id:nid(), type:'when', ev:ev.id, body:[] })));
      const note=document.createElement('div');
      note.className='pit-key';
      note.textContent=T('Press + inside a rule to put a test or an action in it.');
      pal.appendChild(note);
      return;
    }
    head('IF — ask the sensors');
    blk('IF …', 'Only do what is inside when the reading says so.', '#a8e6cf',
      ()=>add({ id:nid(), type:'if', sensor:'enemy_distance', op:'<', n:5, body:[], else:[] }));
    head('DO');
    MC().partActions(part.kind).forEach(a=>{
      const def=MC().ACTIONS[a];
      blk(def.label+'  ('+def.energy+'⚡)', def.help, colourOf(a),
        ()=>add({ id:nid(), type:a }));
    });
  }
  const colourOf = a => a==='block'?'#8fd3ff' : a==='dodge'?'#ffd8a8'
                      : a==='brace'?'#bdb2d8' : a==='heavy'?'#ff9a5c' : '#ffb4a2';

  function add(block){
    const prog=current();
    const list = target ? findList(prog, target) : prog;
    if(!list){ target=null; return editor(); }
    if(MC().countBlocks(prog)+MC().countBlocks([block]) > LIMIT){
      err=TP('That part is full — {m} blocks is the limit.',{m:LIMIT});
      return editor();
    }
    list.push(block);
    err=null;
    commit();
  }
  /* A place to add is remembered as a path — "the body of the second
     block inside the first rule" — rather than as the array itself,
     because the tree is rebuilt from storage on every render. */
  function findList(prog, path){
    let list=prog;
    for(const step of path){
      const b=list[step.i]; if(!b) return null;
      list = step.k==='else' ? (b.else=b.else||[]) : (b.body=b.body||[]);
    }
    return list;
  }
  const samePath=(a,b)=>a&&b&&a.length===b.length&&a.every((s,i)=>s.i===b[i].i&&s.k===b[i].k);

  /* the program, drawn as what it is: rules, tests inside them, actions
     inside those */
  function tree(prog){
    const host=$('#pitProg'); if(!host) return;
    host.innerHTML='';
    if(!prog.length){
      const p=document.createElement('div');
      p.className='pit-empty';
      p.textContent=T('No orders. This part will do nothing at all — start with a WHEN on the left.');
      host.appendChild(p);
    }
    draw(prog, [], host, 0);
    host.appendChild(adder([], T('+ rule')));
  }
  function draw(list, path, host, depth){
    list.forEach((b,i)=>{
      const p=path.concat([{i,k:'body'}]);
      host.appendChild(row(b, list, i, depth));
      if(b.type==='when' || b.type==='if'){
        const kids=document.createElement('div');
        kids.style.marginLeft=(depth?18:14)+'px';
        host.appendChild(kids);
        draw(b.body||[], p, kids, depth+1);
        kids.appendChild(adder(p, b.type==='if' ? T('+ do this') : T('+ inside')));
        if(b.type==='if'){
          const els=document.createElement('div');
          els.className='pit-row';
          els.innerHTML=`<span style="color:var(--muted);font-size:12px;margin-left:${(depth?18:14)}px">${T('ELSE')}</span>`;
          host.appendChild(els);
          const ek=document.createElement('div');
          ek.style.marginLeft=(depth?18:14)+'px';
          host.appendChild(ek);
          draw(b.else||[], path.concat([{i,k:'else'}]), ek, depth+1);
          ek.appendChild(adder(path.concat([{i,k:'else'}]), T('+ otherwise')));
        }
      }
    });
  }
  function adder(path, label){
    const b=document.createElement('button');
    b.className='pit-add'+(samePath(target,path)?' on':'');
    b.textContent=label;
    b.onclick=()=>{ target=samePath(target,path)?null:path; editor(); };
    return b;
  }
  function row(b, list, i, depth){
    const wrap=document.createElement('div');
    wrap.className='pit-row';
    const body=document.createElement('div');
    body.className='pit-body';
    if(b.type==='when'){
      body.style.background='#cdb4f6';
      const ev=MC().EVENTS.find(e=>e.id===b.ev)||MC().EVENTS[0];
      body.innerHTML=`<span>${T('WHEN')}</span>`;
      body.appendChild(pick(MC().EVENTS.map(e=>({v:e.id,l:T(e.label)})), b.ev,
        v=>{ b.ev=v; commit(); }));
      body.title=T(ev.help);
    } else if(b.type==='if'){
      body.style.background='#a8e6cf';
      body.innerHTML=`<span>${T('IF')}</span>`;
      body.appendChild(pick(MC().SENSORS.map(s=>({v:s.id,l:T(s.label)})), b.sensor,
        v=>{ b.sensor=v; commit(); }));
      body.appendChild(pick(MC().OPS.map(o=>({v:o,l:o})), b.op, v=>{ b.op=v; commit(); }));
      const num=document.createElement('input');
      num.type='number'; num.value=b.n; num.style.width='58px';
      num.onchange=()=>{ b.n=Math.max(0, Math.min(999, +num.value||0)); commit(); };
      body.appendChild(num);
    } else {
      const def=MC().ACTIONS[b.type]||{label:b.type};
      body.style.background=colourOf(b.type);
      body.innerHTML=`<span>${T(def.label)}</span>
        <span style="opacity:.65;font-weight:normal">${def.energy}⚡</span>`;
      body.title=T(def.help||'');
    }
    wrap.appendChild(body);
    wrap.appendChild(btn('▲','pit-up', ()=>{ if(i>0){ list.splice(i-1,0,list.splice(i,1)[0]); commit(); } }));
    wrap.appendChild(btn('▼','pit-dn', ()=>{ if(i<list.length-1){ list.splice(i+1,0,list.splice(i,1)[0]); commit(); } }));
    wrap.appendChild(btn('✕','pit-x',  ()=>{ list.splice(i,1); target=null; commit(); }));
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

  return { show, hide, programs, robot, pickRobot, LIMIT,
           get open(){ return open; },
           get part(){ return sel; } };
})();
