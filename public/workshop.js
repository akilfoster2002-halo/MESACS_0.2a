/* =====================================================================
   WORKSHOP — where a mecha is given its orders, one part at a time.

   The whole point of the screen is the thing on the left: a robot drawn
   in its parts, each of them a button. You click an arm and the arm's
   orders open beside it. Nobody has to be told which code controls what,
   because you got to that code by pressing that arm — and the number
   under each part is how many blocks it is carrying, so a robot with an
   empty left arm looks like a robot with an empty left arm.

   THE EDITOR IS CLICK-TO-BUILD, not drag-and-drop. Every place a block
   can go has a + on it; pressing one says where the next block lands and
   the palette says what may go there. Dragging is lovely when it works
   and miserable on a trackpad in a lab, and the shape of this language —
   a rule, a test inside it, an action inside that — is a shape you can
   see in an indent.

   ORDER MATTERS AND THE SCREEN SAYS SO. The first action a part reaches
   is the one it takes, so every row can be moved up and down, and the
   editor says out loud that the first one wins.
   ===================================================================== */
window.WORKSHOP = (function(){
  const $ = s => document.querySelector(s);
  const MC = ()=>window.MECHACODE;

  let open=false, sel='left_arm', target=null, err=null, onFight=null;
  let uid=1;
  const nid = ()=>'b'+(uid++);

  /* ---------------------------------------------------------- storage
     Programs live in the same bag as coins and finished missions, which
     means they follow the account to any machine in the lab — a student
     who wrote a good left arm on Monday has it on Friday, on a different
     computer, without having to remember anything. */
  const KEY = part => 'mecha_'+part;
  function load(part){
    let v=null;
    if(window.PROGRESS) v=PROGRESS.get(KEY(part), null);
    if(!Array.isArray(v)){
      try{ v=JSON.parse(localStorage.getItem('dq_'+KEY(part))||'null'); }catch(e){ v=null; }
    }
    return Array.isArray(v) ? v : [];
  }
  /* THE ONE COPY BEING EDITED. The rows below hold references into this
     tree — a dropdown changes `b.ev` on the block itself — so the editor
     has to be looking at the same objects it renders from, not a fresh
     parse each time. One draft, for one part, dropped the moment another
     part is selected. */
  let draft=null, draftFor=null;
  function current(){
    if(draftFor!==sel){ draft=load(sel); draftFor=sel; }
    return draft;
  }
  function commit(){
    save(sel, current());
    figure(); editor();
  }
  function save(part, tree){
    if(window.PROGRESS) PROGRESS.set(KEY(part), tree);
    try{ localStorage.setItem('dq_'+KEY(part), JSON.stringify(tree)); }catch(e){}
  }
  /* every part's orders at once, which is what a match is handed */
  function programs(){
    const out={};
    MC().PARTS.forEach(p=>{ if(p.kind!=='none')
      out[p.id] = (p.id===draftFor && draft) ? draft : load(p.id); });
    return out;
  }
  const blocksIn = part => MC().countBlocks(part===draftFor ? draft : load(part));
  const LIMIT=24;

  /* ---------------------------------------------------------- the screen */
  function show(opts){
    opts=opts||{};
    onFight=opts.onFight||null;
    open=true;
    G.running=false;
    if(document.pointerLockElement) document.exitPointerLock();
    if(window.MENU) MENU.hideAll();
    $('#hud').classList.add('hidden');
    $('#mw').classList.remove('hidden');
    render();
  }
  function hide(){
    open=false; err=null; target=null;
    $('#mw').classList.add('hidden');
  }

  function render(){
    const el=$('#mw');
    el.innerHTML=`<div class="mw-wrap">
      <h1>${t('MECHA WORKSHOP')}</h1>
      <div class="mw-sub">${t('You drive it. Your code fights with it. Click a part to give that part its orders.')}</div>
      <div class="mw-cols">
        <div class="mw-bot">
          <div class="mw-fig" id="mwFig"></div>
          <div class="mw-key" id="mwKey"></div>
        </div>
        <div class="mw-code" id="mwCode"></div>
      </div>
      <div class="mw-foot">
        <button class="btn ghost small" id="mwBack">◀</button>
        <button class="btn" id="mwTest">${t('TEST ALONE ▶')}</button>
        <button class="btn good" id="mwFight">${t('FIND AN OPPONENT ▶')}</button>
        <span class="mw-key" id="mwNote"></span>
      </div></div>`;
    figure(); editor();
    $('#mwBack').onclick=()=>{ hide(); if(window.MENU) MENU.homeworld(); };
    $('#mwTest').onclick =()=>{ hide(); if(onFight) onFight('solo', programs()); };
    $('#mwFight').onclick=()=>{ hide(); if(onFight) onFight('pvp', programs()); };
    $('#mwNote').textContent =
      t('Test alone against a training dummy, or find another student to fight.');
  }

  /* the robot, in parts, each of them a button */
  function figure(){
    const fig=$('#mwFig'); if(!fig) return;
    fig.innerHTML='';
    const slot={ core:'mw-core', left_arm:'mw-larm', right_arm:'mw-rarm',
                 legs:'mw-legs', sensor:'mw-head' };
    const EM={ left_arm:'🦾', right_arm:'🦾', legs:'🦿', sensor:'👁', core:'⚡' };
    MC().PARTS.forEach(p=>{
      const b=document.createElement('button');
      const codeable=p.kind!=='none';
      b.className='mw-part '+slot[p.id]+(sel===p.id?' on':'');
      const n=codeable ? blocksIn(p.id) : 0;
      b.innerHTML=`<div style="font-size:17px">${EM[p.id]||'▣'}</div>
        <b>${t(p.label)}</b>
        <div class="mw-n">${codeable ? (n? t('{n} blocks',{n}) : t('no orders')) : t('no orders to give')}</div>
        <div class="mw-bar"><i style="width:100%"></i></div>`;
      b.onclick=()=>{ sel=p.id; target=null; err=null; draftFor=null; figure(); editor(); };
      fig.appendChild(b);
    });
    $('#mwKey').innerHTML=
      `<b>${t('CORE')}</b> ${t('is your life. At zero you are out.')}<br>
       <b>${t('SENSOR')}</b> ${t('is how your code sees. Wreck it and their code goes blind.')}<br>
       <b>${t('LEGS')}</b> ${t('are your speed, and where a dodge comes from.')}`;
  }

  /* ------------------------------------------------------- the editor */
  function editor(){
    const host=$('#mwCode'); if(!host) return;
    const part=MC().partById(sel);
    if(part.kind==='none'){
      host.innerHTML=`<div class="mw-codehead"><b>${t(part.label)}</b></div>
        <div class="mw-empty">${part.id==='core'
          ? t('The core takes no orders. It is the energy you spend and the thing they are trying to destroy.')
          : t('The sensor takes no orders. It is what every reading in every other part comes from — which is why breaking it is worth doing.')}</div>`;
      return;
    }
    const prog=current(), n=MC().countBlocks(prog);
    host.innerHTML=`
      <div class="mw-codehead">
        <b>${t(part.label)}</b>
        <span class="mw-key">${t('the first action it reaches is the one it takes')}</span>
        <span class="mw-budget">${t('{n} / {m} blocks',{n, m:LIMIT})}</span>
      </div>
      <div class="mw-editor">
        <div class="mw-pal" id="mwPal"></div>
        <div>
          <div class="mw-prog" id="mwProg"></div>
          <div class="mw-err" id="mwErr"></div>
        </div>
      </div>`;
    palette(part);
    tree(prog);
    const e=$('#mwErr'); if(e) e.textContent=err||'';
  }

  /* What can be added, and where it would go. The palette answers the
     second question as much as the first: with nothing selected it can
     only offer a WHEN, because a loose block is one nothing ever asks. */
  function palette(part){
    const pal=$('#mwPal'); if(!pal) return;
    pal.innerHTML='';
    /* The top of the program is the empty path — and an empty array is
       perfectly truthy, so "nothing selected" and "the top selected"
       both have to be asked for by length rather than by existence. */
    const root = !target || !target.length;
    const head=(txt)=>{ const h=document.createElement('h4'); h.textContent=t(txt); pal.appendChild(h); };
    const blk=(label, help, colour, fn)=>{
      const b=document.createElement('button');
      b.className='mw-blk'; b.style.background=colour;
      b.innerHTML=`${t(label)}${help?`<small>${t(help)}</small>`:''}`;
      b.onclick=fn; pal.appendChild(b);
    };
    if(root){
      head('WHEN — start a new rule');
      MC().EVENTS.forEach(ev=>blk(ev.label, ev.help, '#cdb4f6',
        ()=>add({ id:nid(), type:'when', ev:ev.id, body:[] })));
      const note=document.createElement('div');
      note.className='mw-key';
      note.textContent=t('Press + inside a rule to put a test or an action in it.');
      pal.appendChild(note);
      return;
    }
    head('IF — ask the sensors');
    blk('IF …', 'Only do what is inside when the reading says so.', '#a8e6cf',
      ()=>add({ id:nid(), type:'if', sensor:'enemy_distance', op:'<', n:5, body:[], else:[] }));
    head('DO');
    MC().partActions(part.kind).forEach(a=>{
      const def=MC().ACTIONS[a];
      blk(def.label+'  ('+def.energy+'⚡ '+def.heat+'🔥)', def.help,
        a==='block'?'#8fd3ff' : a==='dodge'?'#ffd8a8' : a==='brace'?'#bdb2d8' : '#ffb4a2',
        ()=>add({ id:nid(), type:a }));
    });
  }
  function add(block){
    const prog=current();
    const list = target ? findList(prog, target) : prog;
    if(!list) { target=null; return editor(); }
    if(MC().countBlocks(prog)+MC().countBlocks([block]) > LIMIT){
      err=t('That part is full — {m} blocks is the limit.',{m:LIMIT});
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
  function samePath(a,b){
    return a&&b&&a.length===b.length&&a.every((s,i)=>s.i===b[i].i&&s.k===b[i].k);
  }

  /* the program, drawn as what it is: rules, tests inside them, actions
     inside those */
  function tree(prog){
    const host=$('#mwProg'); if(!host) return;
    host.innerHTML='';
    if(!prog.length){
      const p=document.createElement('div');
      p.className='mw-empty';
      p.textContent=t('No orders. This part will do nothing at all — start with a WHEN on the left.');
      host.appendChild(p);
    }
    draw(prog, [], host, 0);
    host.appendChild(adder([], t('+ rule')));
  }
  function draw(list, path, host, depth){
    list.forEach((b,i)=>{
      const p=path.concat([{i,k:'body'}]);
      host.appendChild(row(b, list, i, path, depth));
      if(b.type==='when' || b.type==='if'){
        const kids=document.createElement('div');
        kids.style.marginLeft=(depth?18:14)+'px';
        host.appendChild(kids);
        draw(b.body||[], p, kids, depth+1);
        kids.appendChild(adder(p, b.type==='if' ? t('+ do this') : t('+ inside')));
        if(b.type==='if'){
          const els=document.createElement('div');
          els.className='mw-row';
          els.innerHTML=`<span style="color:var(--muted);font-size:12px;margin-left:${(depth?18:14)}px">${t('ELSE')}</span>`;
          host.appendChild(els);
          const ek=document.createElement('div');
          ek.style.marginLeft=(depth?18:14)+'px';
          host.appendChild(ek);
          draw(b.else||[], path.concat([{i,k:'else'}]), ek, depth+1);
          ek.appendChild(adder(path.concat([{i,k:'else'}]), t('+ otherwise')));
        }
      }
    });
  }
  function adder(path, label){
    const b=document.createElement('button');
    b.className='mw-add'+(samePath(target,path)?' on':'');
    b.textContent=label;
    b.onclick=()=>{ target=samePath(target,path)?null:path; editor(); };
    return b;
  }
  function row(b, list, i, path, depth){
    const wrap=document.createElement('div');
    wrap.className='mw-row';
    const body=document.createElement('div');
    body.className='mw-body';
    if(b.type==='when'){
      body.style.background='#cdb4f6';
      const ev=MC().EVENTS.find(e=>e.id===b.ev)||MC().EVENTS[0];
      body.innerHTML=`<span>${t('WHEN')}</span>`;
      body.appendChild(pick(MC().EVENTS.map(e=>({v:e.id,l:t(e.label)})), b.ev,
        v=>{ b.ev=v; commit(); }));
      body.title=t(ev.help);
    } else if(b.type==='if'){
      body.style.background='#a8e6cf';
      body.innerHTML=`<span>${t('IF')}</span>`;
      body.appendChild(pick(MC().SENSORS.map(s=>({v:s.id,l:t(s.label)})), b.sensor,
        v=>{ b.sensor=v; commit(); }));
      body.appendChild(pick(MC().OPS.map(o=>({v:o,l:o})), b.op, v=>{ b.op=v; commit(); }));
      const num=document.createElement('input');
      num.type='number'; num.value=b.n; num.style.width='58px';
      num.onchange=()=>{ b.n=Math.max(0, Math.min(999, +num.value||0)); commit(); };
      body.appendChild(num);
    } else {
      const def=MC().ACTIONS[b.type]||{label:b.type};
      body.style.background = b.type==='block'?'#8fd3ff' : b.type==='dodge'?'#ffd8a8'
                            : b.type==='brace'?'#bdb2d8' : '#ffb4a2';
      body.innerHTML=`<span>${t(def.label)}</span>
        <span style="opacity:.65;font-weight:normal">${def.energy}⚡ ${def.heat}🔥</span>`;
      body.title=t(def.help||'');
    }
    wrap.appendChild(body);
    wrap.appendChild(btn('▲','mw-up', ()=>{ if(i>0){ list.splice(i-1,0,list.splice(i,1)[0]); commit(); } }));
    wrap.appendChild(btn('▼','mw-dn', ()=>{ if(i<list.length-1){ list.splice(i+1,0,list.splice(i,1)[0]); commit(); } }));
    wrap.appendChild(btn('✕','mw-x',  ()=>{ list.splice(i,1); target=null; commit(); }));
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
  /* Every edit writes straight through. There is no save button because
     there is nothing one could mean: the program in front of you IS the
     program the mecha will fight with. */

  return { show, hide, programs, load, save, LIMIT,
           get open(){ return open; },
           get part(){ return sel; } };
})();
