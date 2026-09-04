/* =====================================================================
   CODER — the editor.

   Click a block in the palette and it lands in the script. Click a slot
   first and the next reporter you pick drops INTO that slot instead, so
   `move (pick random 1 to 10) steps` is two clicks rather than a drag —
   which matters on a lab trackpad, and matches the block console the
   missions already taught them.

   The world keeps running underneath. The green flag is right here, the
   objects are three feet away, and nothing about pressing RUN takes you
   out of the room.
   ===================================================================== */
window.CODER = (function(){
  const $=s=>document.querySelector(s);
  let open=false, actor=null, cat='events', cursor=null, slotTarget=null;

  /* cursor: where the next stack block lands.
     { list:[...], index:n } — the array to splice into, and where. */
  function setActor(a){ actor=a; cursor=null; slotTarget=null; render(); }
  function current(){
    if(!actor) actor=VM.project.actors[0]||null;
    return actor;
  }

  function show(){
    if(open) return;
    open=true;
    if(document.pointerLockElement) document.exitPointerLock();
    $('#coder').classList.remove('hidden');
    $('#objectives').classList.add('hidden');
    current(); render();
  }
  function hide(){ open=false; $('#coder').classList.add('hidden');
                   $('#objectives').classList.remove('hidden'); }
  function toggle(){ open?hide():show(); }

  /* ------------------------------------------------------------- top bar */
  function bar(){
    $('#cBar').innerHTML=`
      <button class="btn small good" id="cFlag">▶ ${t('Run')}</button>
      <button class="btn small ghost" id="cStop">■ ${t('Stop')}</button>
      <span class="chint" id="cHint"></span>
      <span class="bspace"></span>
      <span class="chint">${t('{n} scripts running',{n:VM.threadCount})}</span>
      <button class="btn small ghost" id="cWipe">${t('New project')}</button>
      <button class="btn small ghost" id="cShut">${t('Close')} (B)</button>`;
    $('#cFlag').onclick=()=>{ VM.greenFlag(); render(); };
    $('#cStop').onclick=()=>{ VM.stopAll(); render(); };
    $('#cShut').onclick=hide;
    $('#cWipe').onclick=()=>{ if(confirm(t('Throw away this project and start again?'))){ VM.wipe(); actor=null; render(); } };
    hint();
  }
  function hint(){
    const h=$('#cHint'); if(!h) return;
    h.textContent = slotTarget ? t('Now pick a reporter to drop in the slot.')
                  : cursor     ? t('Blocks land where you clicked.')
                  : t('Click a block to add it to the script.');
  }

  /* ------------------------------------------------------------ objects */
  function objects(){
    const P=VM.project;
    $('#cObj').innerHTML=`<div class="bhead">${t('OBJECTS')}
        <span class="bspace"></span>
        <button class="btn small good" id="cAddObj">+</button></div>
      <div class="cobjs">${P.actors.filter(a=>!a.isClone).map(a=>`
        <button class="cobj${a===actor?' on':''}" data-a="${a.id}">
          <span class="cdot" style="background:${a.colour}"></span>
          <span>${esc(a.name)}</span>
          <small>${(a.scripts||[]).length} ${t('scripts')}</small>
        </button>`).join('')}</div>
      ${actor?`<div class="brow">
        <button class="btn small ghost" id="cRen">${t('Rename')}</button>
        <button class="btn small ghost bad" id="cDelObj">${t('Delete')}</button>
      </div>
      <div class="bnote">${t('at')} ${actor.x.toFixed(1)}, ${actor.y.toFixed(1)}, ${actor.z.toFixed(1)}</div>`:''}
      <div class="bhead2">${t('VARIABLES')}
        <span class="bspace"></span>
        <button class="btn small ghost" id="cAddVar">+</button></div>
      ${Object.keys(P.vars).length||Object.keys(actor&&actor.vars||{}).length
        ? [...Object.entries(P.vars).map(([k,v])=>['',k,v]),
           ...Object.entries((actor&&actor.vars)||{}).map(([k,v])=>['·',k,v])]
            .map(([m,k,v])=>`<div class="cvar"><b>${m}${esc(k)}</b><span>${esc(String(v))}</span></div>`).join('')
        : `<p class="bnote">${t('No variables yet.')}</p>`}
      <div class="bhead2">${t('LISTS')}
        <span class="bspace"></span>
        <button class="btn small ghost" id="cAddList">+</button></div>
      ${Object.keys(P.lists).length
        ? Object.entries(P.lists).map(([k,v])=>`<div class="cvar"><b>${esc(k)}</b><span>${v.length}</span></div>`).join('')
        : `<p class="bnote">${t('No lists yet.')}</p>`}
      <div class="bhead2">${t('MY BLOCKS')}
        <span class="bspace"></span>
        <button class="btn small ghost" id="cAddProc">+</button></div>
      ${P.procs.length
        ? P.procs.map(p=>`<button class="cproc" data-proc="${esc(p.name)}">${esc(p.name)}(${(p.params||[]).join(', ')})</button>`).join('')
        : `<p class="bnote">${t('Define a block to reuse it anywhere.')}</p>`}`;

    $('#cObj').querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>
      setActor(VM.project.actors.find(a=>a.id===+b.dataset.a)));
    $('#cAddObj').onclick=()=>{
      const a=VM.addActor({ name:'object'+(VM.project.actors.length+1),
        x:(Math.random()*8-4), y:1, z:(Math.random()*8-4),
        colour:['#8fd3ff','#a8e6cf','#ffb4a2','#cdb4f6','#ffd8a8'][VM.project.actors.length%5] });
      setActor(a);
    };
    const ren=$('#cRen'); if(ren) ren.onclick=()=>{
      const n=prompt(t('Name this object'),actor.name); if(n){ actor.name=n.slice(0,16); VM.save(); render(); } };
    const del=$('#cDelObj'); if(del) del.onclick=()=>{
      if(VM.project.actors.length<2) return alert(t('Keep at least one object.'));
      VM.delActor(actor); actor=null; render(); };
    $('#cAddVar').onclick=()=>{
      const n=prompt(t('Variable name')); if(!n) return;
      const mine=actor && confirm(t('Just for this object? Cancel makes it shared by everything.'));
      if(mine) actor.vars[n]=0; else VM.project.vars[n]=0;
      VM.save(); render();
    };
    $('#cAddList').onclick=()=>{
      const n=prompt(t('List name')); if(!n) return;
      VM.project.lists[n]=[]; VM.save(); render();
    };
    $('#cAddProc').onclick=()=>{
      const n=prompt(t('Block name'),'my block'); if(!n) return;
      const ps=prompt(t('Inputs, separated by commas (leave blank for none)'),'');
      VM.project.procs.push({ name:n.slice(0,20),
        params:(ps||'').split(',').map(x=>x.trim()).filter(Boolean), body:[] });
      VM.save(); render();
    };
    $('#cObj').querySelectorAll('[data-proc]').forEach(b=>b.onclick=()=>{
      editingProc = editingProc===b.dataset.proc ? null : b.dataset.proc;
      cursor=null; render();
    });
  }
  let editingProc=null;

  /* ------------------------------------------------------------ palette */
  function palette(){
    $('#cPal').innerHTML=`
      <div class="ctabs">${BLOCKS.CATS.map(c=>`
        <button class="ctab${c.id===cat?' on':''}" data-c="${c.id}" style="--a:${c.a}">${t(c.name)}</button>`).join('')}</div>
      <div class="cblocks">${BLOCKS.inCat(cat).map(bd=>
        `<button class="cblk k-${bd.kind}" data-op="${bd.op}" style="--a:${BLOCKS.catOf(bd.cat).a}">${preview(bd)}</button>`
      ).join('')}
      ${cat==='my'&&VM.project.procs.length
        ? VM.project.procs.map(p=>`<button class="cblk k-stack" data-call="${esc(p.name)}" style="--a:#ff9aa2">${esc(p.name)}</button>`).join('')
        : ''}</div>`;
    $('#cPal').querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{ cat=b.dataset.c; palette(); });
    $('#cPal').querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>add(b.dataset.op));
    $('#cPal').querySelectorAll('[data-call]').forEach(b=>b.onclick=()=>add('my.call',b.dataset.call));
  }
  function preview(bd){
    return BLOCKS.parts(bd.label).map(seg=>{
      if(seg[0]!=='%') return esc(seg);
      const k=seg[1], sp=bd.args[k];
      return `<i class="cslot">${sp&&sp.def!==undefined?esc(String(sp.def)):(sp&&sp.type==='bool'?'◇':'…')}</i>`;
    }).join('');
  }

  /* ---------------------------------------------------------- add block */
  function newBlock(op, callName){
    const bd=BLOCKS.of(op); if(!bd) return null;
    const bk={ op, args:{} };
    Object.entries(bd.args).forEach(([k,sp])=>{
      if(sp.type==='var')  bk.args[k]=firstName(VM.project.vars, actor&&actor.vars) || '';
      else if(sp.type==='list') bk.args[k]=Object.keys(VM.project.lists)[0]||'';
      else if(sp.type==='msg')  bk.args[k]=VM.project.msgs[0]||'message1';
      else if(sp.type==='proc') bk.args[k]=callName||(VM.project.procs[0]||{}).name||'';
      else if(sp.type==='bool') bk.args[k]=null;
      else bk.args[k]= sp.def!==undefined ? sp.def : '';
    });
    if(callName){ bk.args.p=callName; bk.args.vals={}; }
    if(bd.kind==='c'||bd.kind==='c2') bk.body=[];
    if(bd.kind==='c2') bk.body2=[];
    return bk;
  }
  const firstName=(...objs)=>{ for(const o of objs){ const k=Object.keys(o||{})[0]; if(k) return k; } return ''; };

  function add(op, callName){
    const bd=BLOCKS.of(op); if(!bd) return;
    const bk=newBlock(op,callName); if(!bk) return;

    if(BLOCKS.isExpr(bd.kind)){
      if(!slotTarget){ flash(t('Click an empty slot first, then pick this.')); return; }
      slotTarget.owner.args[slotTarget.key]=bk;
      slotTarget=null; VM.save(); render(); return;
    }
    if(bd.kind==='hat'){
      const a=current(); if(!a) return;
      a.scripts.push({ id:Date.now()+Math.random(), hat:bk, body:[] });
      cursor=null; VM.save(); render(); return;
    }
    const list = cursor ? cursor.list : defaultList();
    if(!list){ flash(t('Add a WHEN block first — a script needs a start.')); return; }
    const at = cursor ? cursor.index : list.length;
    list.splice(at,0,bk);
    cursor={ list, index:at+1 };
    VM.save(); render();
  }
  function defaultList(){
    if(editingProc){ const p=VM.project.procs.find(x=>x.name===editingProc); return p?p.body:null; }
    const a=current(); if(!a || !a.scripts.length) return null;
    return a.scripts[a.scripts.length-1].body;
  }

  /* --------------------------------------------------------- the script */
  function scripts(){
    const a=current(), el=$('#cScript');
    if(editingProc){
      const p=VM.project.procs.find(x=>x.name===editingProc);
      el.innerHTML=`<div class="bhead">${t('DEFINE')} ${esc(editingProc)}(${(p.params||[]).join(', ')})
          <span class="bspace"></span>
          <button class="btn small ghost" id="cDoneProc">${t('Done')}</button></div>
        <div class="cstack">${renderList(p.body,'p')}</div>`;
      $('#cDoneProc').onclick=()=>{ editingProc=null; cursor=null; render(); };
      wireScript();
      return;
    }
    if(!a){ el.innerHTML=`<p class="bnote">${t('Add an object to write code for.')}</p>`; return; }
    el.innerHTML=`<div class="bhead">${t('SCRIPTS FOR')} ${esc(a.name)}</div>` +
      (a.scripts.length
        ? a.scripts.map((sc,i)=>`
            <div class="cscript" data-sc="${i}">
              <div class="cblk k-hat live" style="--a:${BLOCKS.catOf('events').a}">
                ${renderInline(sc.hat)}
                <button class="bx" data-del-script="${i}">✕</button>
              </div>
              <div class="cstack">${renderList(sc.body, String(i))}</div>
            </div>`).join('')
        : `<p class="bnote">${t('No scripts yet. Pick an Events block to start one.')}</p>`);
    wireScript();
  }
  function renderList(list, path){
    const rows = (list||[]).map((bk,i)=>renderBlock(bk, path+'.'+i)).join('');
    const tail = `<div class="cdrop${isCursor(list,(list||[]).length)?' on':''}" data-drop="${path}|${(list||[]).length}"></div>`;
    return rows + tail;
  }
  function isCursor(list,i){ return cursor && cursor.list===list && cursor.index===i; }
  function renderBlock(bk, path){
    const bd=BLOCKS.of(bk.op); if(!bd) return '';
    const a=BLOCKS.catOf(bd.cat).a;
    let inner='';
    if(bd.kind==='c')  inner=`<div class="cmouth">${renderList(bk.body, path+'.b')}</div>`;
    if(bd.kind==='c2') inner=`<div class="cmouth">${renderList(bk.body, path+'.b')}</div>
      <div class="celse">${t('else')}</div><div class="cmouth">${renderList(bk.body2, path+'.e')}</div>`;
    return `<div class="cwrap">
      <div class="cblk k-${bd.kind} live" style="--a:${a}" data-blk="${path}">
        ${renderInline(bk)}<button class="bx" data-del="${path}">✕</button>
      </div>${inner}</div>`;
  }
  function renderInline(bk){
    const bd=BLOCKS.of(bk.op); if(!bd) return '';
    return BLOCKS.parts(bd.label).map(seg=>{
      if(seg[0]!=='%') return esc(seg);
      const k=seg[1];
      return slotHTML(bk,k,bd.args[k]);
    }).join('');
  }
  function slotHTML(bk,k,sp){
    if(!sp) return '';
    const v=bk.args[k];
    if(v && typeof v==='object' && v.op){                 // a reporter sits in the slot
      const bd=BLOCKS.of(v.op);
      return `<span class="cnest" style="--a:${BLOCKS.catOf(bd.cat).a}">${renderInline(v)}
        <button class="bx" data-clear="${k}">✕</button></span>`;
    }
    const id='s'+Math.random().toString(36).slice(2,8);
    if(sp.type==='bool')
      return `<i class="cslot bool ${isSlot(bk,k)?'on':''}" data-slot="${k}" data-id="${id}">◇</i>`;
    if(sp.type==='pick')
      return `<select class="cin" data-set="${k}">${sp.opts.map(o=>
        `<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
    if(sp.type==='var')
      return `<select class="cin" data-set="${k}">${allVarNames().map(o=>
        `<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')||'<option></option>'}</select>`;
    if(sp.type==='list')
      return `<select class="cin" data-set="${k}">${Object.keys(VM.project.lists).map(o=>
        `<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')||'<option></option>'}</select>`;
    if(sp.type==='msg')
      return `<select class="cin" data-set="${k}">${VM.project.msgs.map(o=>
        `<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}
        <option value="__new">${t('new message…')}</option></select>`;
    if(sp.type==='obj')
      return `<select class="cin" data-set="${k}">
        <option ${v==='player'?'selected':''}>player</option>
        <option ${v==='myself'?'selected':''}>myself</option>
        ${VM.project.actors.filter(x=>!x.isClone).map(x=>
          `<option ${x.name===v?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`;
    if(sp.type==='colour')
      return `<input class="cin ccol" type="color" data-set="${k}" value="${esc(v||'#8fd3ff')}">`;
    // plain value, and clicking it arms it as a slot for a reporter
    return `<input class="cin ${isSlot(bk,k)?'on':''}" data-set="${k}" data-slot="${k}"
                   value="${esc(String(v==null?'':v))}" size="${Math.max(2,String(v==null?'':v).length)}">`;
  }
  const isSlot=(bk,k)=>slotTarget && slotTarget.owner===bk && slotTarget.key===k;
  function allVarNames(){
    return [...Object.keys(VM.project.vars), ...Object.keys((current()||{}).vars||{})];
  }

  /* resolve "0.b.2" into the block and the list holding it */
  function at(path){
    const segs=String(path).split('.');
    const a=current();
    let list, i=0;
    if(segs[0]==='p'){ const p=VM.project.procs.find(x=>x.name===editingProc); list=p?p.body:[]; i=1; }
    else { const sc=a.scripts[+segs[0]]; if(!sc) return null; list=sc.body; i=1; }
    let bk=null;
    for(; i<segs.length; i++){
      const s=segs[i];
      if(s==='b'){ bk=bk; list=bk.body; continue; }
      if(s==='e'){ list=bk.body2; continue; }
      bk=list[+s];
      if(!bk) return null;
    }
    return { list, block:bk, index:list.indexOf(bk) };
  }
  function wireScript(){
    const el=$('#cScript');
    el.querySelectorAll('[data-drop]').forEach(d=>d.onclick=()=>{
      const [path,idx]=d.dataset.drop.split('|');
      const segs=path.split('.');
      let list;
      if(segs[0]==='p'){ const p=VM.project.procs.find(x=>x.name===editingProc); list=p.body; }
      else { const sc=current().scripts[+segs[0]]; list=sc.body; }
      for(let i=1;i<segs.length;i++){
        const s=segs[i];
        if(s==='b'){ list=list.__last.body; continue; }
        if(s==='e'){ list=list.__last.body2; continue; }
        const bk=list[+s]; list.__last=bk;
      }
      cursor={ list, index:+idx }; render();
    });
    el.querySelectorAll('[data-del]').forEach(x=>x.onclick=e=>{
      e.stopPropagation();
      const r=at(x.dataset.del); if(r){ r.list.splice(r.index,1); cursor=null; VM.save(); render(); }
    });
    el.querySelectorAll('[data-del-script]').forEach(x=>x.onclick=e=>{
      e.stopPropagation();
      current().scripts.splice(+x.dataset.delScript,1); cursor=null; VM.save(); render();
    });
    el.querySelectorAll('[data-set]').forEach(inp=>{
      const r=at(inp.closest('[data-blk]')?inp.closest('[data-blk]').dataset.blk:null);
      inp.onchange=()=>{
        const holder = r ? r.block : hatOf(inp);
        if(!holder) return;
        let v=inp.value;
        if(v==='__new'){ const m=prompt(t('New message name'),'message'+(VM.project.msgs.length+1));
                         if(m){ VM.project.msgs.push(m); v=m; } else v=VM.project.msgs[0]; }
        holder.args[inp.dataset.set]=v;
        VM.save(); render();
      };
      if(inp.dataset.slot) inp.onclick=e=>{
        e.stopPropagation();
        const holder = r ? r.block : hatOf(inp);
        slotTarget = (slotTarget&&slotTarget.owner===holder&&slotTarget.key===inp.dataset.slot)
                     ? null : { owner:holder, key:inp.dataset.slot };
        render();
      };
    });
    el.querySelectorAll('[data-slot].bool').forEach(sl=>sl.onclick=e=>{
      e.stopPropagation();
      const holder = at(sl.closest('[data-blk]').dataset.blk).block;
      slotTarget={ owner:holder, key:sl.dataset.slot }; render();
    });
    el.querySelectorAll('[data-clear]').forEach(x=>x.onclick=e=>{
      e.stopPropagation();
      const wrap=x.closest('[data-blk]'); if(!wrap) return;
      const r=at(wrap.dataset.blk); if(!r) return;
      const bd=BLOCKS.of(r.block.op), sp=bd.args[x.dataset.clear];
      r.block.args[x.dataset.clear]= sp && sp.def!==undefined ? sp.def : null;
      VM.save(); render();
    });
  }
  function hatOf(inp){
    const sc=inp.closest('.cscript'); if(!sc) return null;
    return current().scripts[+sc.dataset.sc].hat;
  }

  let flashT=null;
  function flash(msg){
    const h=$('#cHint'); if(!h) return;
    h.textContent=msg; h.classList.add('bad');
    clearTimeout(flashT); flashT=setTimeout(()=>{ h.classList.remove('bad'); hint(); },2400);
  }
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function render(){ if(!open) return; bar(); objects(); palette(); scripts(); }

  /* variable values change as the code runs, so refresh the readout gently */
  let beat=0;
  function tick(dt){
    if(!open) return;
    beat+=dt;
    if(beat>0.4){ beat=0; objects(); bar(); }
  }

  return { show, hide, toggle, render, tick, setActor, get open(){ return open; } };
})();
