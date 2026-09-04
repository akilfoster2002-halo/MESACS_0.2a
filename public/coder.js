/* =====================================================================
   CODER — the editor.

   Two columns, not three. The palette is narrow and fixed; the script is
   the widest thing on screen, because the script is the work. Objects
   live as chips over the scripts they belong to, and Variables and My
   Blocks are palette categories the way they are in Scratch, rather than
   a third column stealing room from the code.

   KEYBOARD. Clicking a block selects it, and from there it behaves like
   a text editor: backspace deletes, ctrl-X / ctrl-C / ctrl-V cut, copy
   and paste, ctrl-D duplicates, the arrow keys walk up and down the
   stack. Building a program should not require the mouse for every
   single act.

   Clicking a SLOT arms it, and the next reporter you pick drops inside —
   two clicks instead of a drag, which is what a lab trackpad wants.
   ===================================================================== */
window.CODER = (function(){
  const $=s=>document.querySelector(s);
  let open=false, actor=null, cat='events';
  let cursor=null;        // where the next stack block lands: {list,index}
  let slotTarget=null;    // an armed slot waiting for a reporter
  let selected=null;      // path of the selected block, for the keyboard
  let clip=null;          // cut/copy buffer
  let drag=null;          // an in-flight drag: see beginDrag
  /* A mission hands you a few blocks and no more. A palette of two blocks is
     a lesson; the whole language at once is a wall. null means the sandbox:
     everything, as before. */
  let only=null;          // { cats:[…], ops:[…], locked:bool }
  let magnify=false;      // the 🔍 tool: click a block to be told what it does
  let editingProc=null;

  function current(){ if(!actor) actor=VM.project.actors.find(a=>!a.isClone)||null; return actor; }
  function setActor(a){ actor=a; cursor=null; slotTarget=null; selected=null; render(); }
  function restrict(spec){
    only = spec||null;
    cat = cats()[0].id;
    /* the project changes with the mission, so let go of the object that was
       being edited — it is about to stop existing, and a chip naming a deleted
       object edits nothing */
    actor=null; cursor=null; selected=null; slotTarget=null;
    render();
  }
  const cats  = () => BLOCKS.CATS.filter(c=>!only || !only.cats || only.cats.indexOf(c.id)>=0);
  const shown = c  => BLOCKS.inCat(c).filter(bd=>!only || !only.ops || only.ops.indexOf(bd.op)>=0);
  /* walk up to a thing and open its code, which is the whole point */
  function openOn(a){ if(!a) return; show(); setActor(a); }

  function show(){
    if(open) return;
    open=true;
    if(document.pointerLockElement) document.exitPointerLock();
    $('#coder').classList.remove('hidden');
    // the sandbox HUD is noise while coding, and the key list is for the game
    $('#objectives').classList.add('hidden');
    $('#keys').classList.add('hidden');
    $('#chat').classList.add('hidden');
    $('#topbar').classList.add('hidden');
    current(); render();
  }
  function hide(){
    open=false; selected=null; slotTarget=null;
    $('#coder').classList.add('hidden'); explainClose(); closePicker();
    $('#objectives').classList.remove('hidden');
    $('#keys').classList.remove('hidden');
    $('#topbar').classList.remove('hidden');
    if(window.CHAT && CHAT.open) $('#chat').classList.remove('hidden');
  }
  function toggle(){ open?hide():show(); }

  /* ------------------------------------------------------------- top bar */
  function bar(){
    $('#cBar').innerHTML=`
      <button class="btn small good" id="cFlag">▶ ${t('Run')}</button>
      <button class="btn small ghost" id="cStop">■ ${t('Stop')}</button>
      <button class="btn small ${magnify?'good':'ghost'}" id="cMag"
              title="${t('Explain a block')}">🔍</button>
      <span class="chint" id="cHint"></span>
      <span class="bspace"></span>
      <span class="chint dim">${t('{n} running',{n:VM.threadCount})}</span>
      ${only&&only.locked?'':`<button class="btn small ghost" id="cWipe">${t('New')}</button>`}
      <button class="btn small ghost" id="cShut">${t('Close')} (C)</button>`;
    $('#cFlag').onclick=()=>{ VM.greenFlag(); render(); };
    $('#cStop').onclick=()=>{ VM.stopAll(); render(); };
    $('#cMag').onclick=()=>{ magnify=!magnify; explainClose(); render(); };
    $('#cShut').onclick=hide;
    const wipe_=$('#cWipe'); if(wipe_) wipe_.onclick=()=>{ if(confirm(t('Throw away this project and start again?'))){
      VM.wipe(); actor=null; selected=null; cursor=null; render(); } };
    hint();
  }
  function hint(){
    const h=$('#cHint'); if(!h) return;
    h.textContent = magnify    ? t('Click any block to find out what it does')
                  : slotTarget ? t('Pick a rounded block to drop in the slot')
                  : selected   ? t('⌫ delete · ⌘X cut · ⌘C copy · ⌘V paste · ⌘D copy again · ↑↓ move')
                  : t('Click a block to add · click one in the script to select it');
  }

  /* ------------------------------------------------------------- palette */
  function palette(){
    const P=VM.project;
    let extra='';
    if(only && only.cats && only.cats.indexOf(cat)<0) cat=cats()[0].id;
    if(cat==='data'){
      extra = (only ? '' : `<div class="cmake">
        <button class="btn small good" id="cAddVar">${t('Make a Variable')}</button>
        <button class="btn small ghost" id="cAddList">${t('Make a List')}</button></div>`)
        + varRows();
    }
    if(cat==='my' && !only){
      extra=`<div class="cmake"><button class="btn small good" id="cAddProc">${t('Make a Block')}</button></div>
        ${P.procs.map(p=>`<div class="cprocrow">
            <button class="cblk k-stack" data-call="${esc(p.name)}" style="--a:#ff9aa2">${esc(p.name)}${
              (p.params||[]).length?' <i class="cslot">'+p.params.map(esc).join('</i> <i class="cslot">')+'</i>':''}</button>
            <button class="bx" data-edit="${esc(p.name)}" title="${t('edit')}">✎</button>
            <button class="bx" data-delproc="${esc(p.name)}">✕</button>
          </div>`).join('')}`;
    }
    $('#cPal').innerHTML=`
      <div class="ctabs">${cats().map(c=>`
        <button class="ctab${c.id===cat?' on':''}" data-c="${c.id}" style="--a:${c.a}">${t(c.name)}</button>`).join('')}</div>
      ${extra}
      <div class="cblocks">${shown(cat).map(bd=>
        `<button class="cblk k-${bd.kind}" data-op="${bd.op}" style="--a:${BLOCKS.catOf(bd.cat).a}">${preview(bd)}</button>`
      ).join('')}</div>`;

    $('#cPal').querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{ cat=b.dataset.c; palette(); });
    $('#cPal').querySelectorAll('[data-op]').forEach(b=>{
      b.onclick=e=>{ if(justDragged) return; if(magnify) return explain(b.dataset.op,b);
        if(e.detail>1) return;                    // the second click of a double-click
        const r=add(b.dataset.op); lastAdd = r ? {...r, at:Date.now()} : null; };
      b.ondblclick=()=>{ if(justDragged||magnify) return; tryOut(b.dataset.op); };
      b.onmousedown=e=>{ if(magnify) return; beginDrag(e,{ src:'palette', op:b.dataset.op,
        isExpr:BLOCKS.isExpr(BLOCKS.of(b.dataset.op).kind),
        html:b.innerHTML, cls:'k-'+BLOCKS.of(b.dataset.op).kind,
        colour:b.style.getPropertyValue('--a') }); };
    });
    $('#cPal').querySelectorAll('[data-call]').forEach(b=>{
      b.onclick=e=>{ if(justDragged) return; if(magnify) return explain('my.call',b);
        if(e.detail>1) return;
        const r=add('my.call',b.dataset.call); lastAdd = r ? {...r, at:Date.now()} : null; };
      b.ondblclick=()=>{ if(justDragged||magnify) return; tryOut('my.call',b.dataset.call); };
      b.onmousedown=e=>{ if(magnify) return;
        beginDrag(e,{ src:'palette', op:'my.call', callName:b.dataset.call,
          isExpr:false, html:b.innerHTML, cls:'k-stack' }); };
    });
    $('#cPal').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{
      editingProc=b.dataset.edit; cursor=null; selected=null; render(); });
    $('#cPal').querySelectorAll('[data-delproc]').forEach(b=>b.onclick=()=>{
      P.procs=P.procs.filter(p=>p.name!==b.dataset.delproc);
      if(editingProc===b.dataset.delproc) editingProc=null;
      VM.save(); render(); });
    const av=$('#cAddVar'); if(av) av.onclick=()=>{
      const n=prompt(t('Variable name')); if(!n) return;
      const mine=current() && confirm(t('Just for this object? Cancel makes it shared by everything.'));
      if(mine) current().vars[n]=0; else P.vars[n]=0;
      VM.save(); render(); };
    const al=$('#cAddList'); if(al) al.onclick=()=>{
      const n=prompt(t('List name')); if(!n) return; P.lists[n]=[]; VM.save(); render(); };
    const ap=$('#cAddProc'); if(ap) ap.onclick=()=>{
      const n=prompt(t('Block name'),'my block'); if(!n) return;
      const ps=prompt(t('Inputs, separated by commas (leave blank for none)'),'');
      P.procs.push({ name:n.slice(0,20),
        params:(ps||'').split(',').map(x=>x.trim()).filter(Boolean), body:[] });
      editingProc=n.slice(0,20); VM.save(); render(); };
  }
  function varRows(){
    const P=VM.project, a=current();
    const rows=[...Object.entries(P.vars).map(([k,v])=>[k,v,false]),
                ...Object.entries((a&&a.vars)||{}).map(([k,v])=>[k,v,true])];
    if(!rows.length) return `<p class="bnote">${t('No variables yet.')}</p>`;
    return rows.map(([k,v,mine])=>`<div class="cvar">
      <b>${mine?'· ':''}${esc(k)}</b><span>${esc(String(v))}</span>
      <button class="bx" data-delvar="${esc(k)}" data-mine="${mine?1:''}">✕</button></div>`).join('')
      + Object.keys(P.lists).map(k=>`<div class="cvar">
          <b>▤ ${esc(k)}</b><span>${(P.lists[k]||[]).length}</span>
          <button class="bx" data-dellist="${esc(k)}">✕</button></div>`).join('');
  }
  function preview(bd){
    return BLOCKS.parts(bd.label).map(seg=>{
      if(seg[0]!=='%') return esc(seg);
      const sp=bd.args[seg[1]];
      return `<i class="cslot">${sp&&sp.def!==undefined?esc(String(sp.def)):(sp&&sp.type==='bool'?'◇':'…')}</i>`;
    }).join('');
  }

  /* ----------------------------------------------------------- add block */
  const firstName=(...objs)=>{ for(const o of objs){ const k=Object.keys(o||{})[0]; if(k) return k; } return ''; };
  function newBlock(op, callName){
    const bd=BLOCKS.of(op); if(!bd) return null;
    const bk={ op, args:{} };
    Object.entries(bd.args).forEach(([k,sp])=>{
      if(sp.type==='var')  bk.args[k]=firstName(VM.project.vars, current()&&current().vars)||'';
      else if(sp.type==='list') bk.args[k]=Object.keys(VM.project.lists)[0]||'';
      else if(sp.type==='msg')  bk.args[k]=VM.project.msgs[0]||'message1';
      else if(sp.type==='proc') bk.args[k]=callName||(VM.project.procs[0]||{}).name||'';
      else if(sp.type==='bool') bk.args[k]=null;
      else bk.args[k]= sp.def!==undefined ? sp.def : '';
    });
    const pre = only && only.defaults && only.defaults[op];
    if(pre) Object.assign(bk.args, pre);
    if(callName){ bk.args.p=callName; bk.args.vals={}; }
    if(bd.kind==='c'||bd.kind==='c2') bk.body=[];
    if(bd.kind==='c2') bk.body2=[];
    return bk;
  }
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
      cursor=null; selected=null; VM.save(); render(); return;
    }
    return insert(bk);
  }
  function insert(bk){
    const list = cursor ? cursor.list : defaultList();
    if(!list){ flash(t('Add a WHEN block first — a script needs a start.')); return; }
    const at_ = cursor ? cursor.index : list.length;
    list.splice(at_,0,bk);
    cursor={ list, index:at_+1 };
    VM.save(); render();
    return { list, bk };
  }
  function defaultList(){
    if(editingProc){ const p=VM.project.procs.find(x=>x.name===editingProc); return p?p.body:null; }
    const a=current(); if(!a || !a.scripts.length) return null;
    return a.scripts[a.scripts.length-1].body;
  }

  /* ------------------------------------------------------------ try it out
     Double-clicking a block in the palette runs it on the spot, on whichever
     object is selected — the fastest way to find out what `turn 15 degrees`
     does is to watch it happen. The first click of that double-click has
     already dropped a copy into the script, so it is taken back out again:
     trying a block is not the same as writing one down. */
  let lastAdd=null;                       // {list, bk, at} — undone by a double-click

  function undoLastAdd(){
    const la=lastAdd; lastAdd=null;
    if(!la || Date.now()-la.at>700) return;
    const i=la.list.indexOf(la.bk);
    if(i<0) return;
    la.list.splice(i,1);
    cursor=null; selected=null; VM.save();
  }
  /* the block's own words, with whatever is sitting in its slots */
  function plain(bk){
    const bd=BLOCKS.of(bk.op); if(!bd) return bk.op;
    return BLOCKS.parts(bd.label).map(seg=>{
      if(seg[0]!=='%') return seg;
      const v=bk.args[seg[1]];
      return (v && typeof v==='object') ? '…' : String(v==null?'':v);
    }).join('');
  }
  function tryOut(op, callName){
    const bd=BLOCKS.of(op); if(!bd) return;
    if(bd.kind==='hat') return;            // a hat starts a script; there is nothing to try
    undoLastAdd();
    const a=current();
    if(!a){ render(); return flash(t('Add an object first.')); }
    const bk=newBlock(op,callName); if(!bk){ render(); return; }
    const r=VM.runBlock(bk,a);
    render();
    if(r && 'value' in r) note(plain(bk)+' → '+String(r.value));
    else if(r) note(plain(bk)+' ✓');
  }

  /* ------------------------------------------------------------- scripts */
  function scripts(){
    const a=current(), el=$('#cScript');
    const chips=`<div class="cchips">${
      VM.project.actors.filter(x=>!x.isClone).map(x=>`
        <button class="cchip${x===a&&!editingProc?' on':''}" data-a="${x.id}">
          <span class="cdot" style="background:${x.colour}"></span>${esc(x.name)}</button>`).join('')}
      ${only&&only.locked?'':'<button class="cchip add" id="cAddObj">+</button>'}
      ${a?`${only&&only.locked?'':`<button class="bx" id="cCos" title="${t('Change costume')}">🎭</button>`}
        <button class="bx" id="cReset" title="${t('Put this object back where it started')}">↺</button>
        ${only&&only.locked?'':`<button class="bx" id="cRen" title="${t('Rename')}">✎</button>
        <button class="bx" id="cDelObj" title="${t('Delete')}">✕</button>`}`:''}
    </div>`;

    if(editingProc){
      const p=VM.project.procs.find(x=>x.name===editingProc);
      el.innerHTML=chips+`<div class="bhead">${t('DEFINE')} ${esc(editingProc)}(${(p.params||[]).join(', ')})
          <span class="bspace"></span>
          <button class="btn small ghost" id="cDoneProc">${t('Done')}</button></div>
        <div class="cstack">${renderList(p.body,'p')}</div>`;
      $('#cDoneProc').onclick=()=>{ editingProc=null; cursor=null; selected=null; render(); };
    } else if(!a){
      el.innerHTML=chips+`<p class="bnote">${t('Add an object to write code for.')}</p>`;
    } else {
      el.innerHTML=chips+(a.scripts.length
        ? a.scripts.map((sc,i)=>`
            <div class="cscript" data-sc="${i}">
              <div class="cblk k-hat live" style="--a:${BLOCKS.catOf('events').a}">
                ${renderInline(sc.hat)}
                <button class="bx" data-del-script="${i}">✕</button>
              </div>
              <div class="cstack">${renderList(sc.body, String(i))}</div>
            </div>`).join('')
        : `<p class="bnote">${t('No scripts yet. Pick an Events block to start one.')}</p>`);
    }
    wireChips(); wireScript();
  }
  function wireChips(){
    $('#cScript').querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{
      editingProc=null; setActor(VM.project.actors.find(x=>x.id===+b.dataset.a)); });
    const add_=$('#cAddObj'); if(add_) add_.onclick=()=>openPicker('new');
    const cos=$('#cCos'); if(cos) cos.onclick=()=>openPicker('change');
    const rst=$('#cReset'); if(rst) rst.onclick=()=>{
      VM.resetActor(current()); render(); };
    const ren=$('#cRen'); if(ren) ren.onclick=()=>{
      const n=prompt(t('Name this object'),current().name);
      if(n){ current().name=n.slice(0,16); VM.save(); render(); } };
    const del=$('#cDelObj'); if(del) del.onclick=()=>{
      if(VM.project.actors.filter(x=>!x.isClone).length<2) return alert(t('Keep at least one object.'));
      VM.delActor(current()); actor=null; render(); };
  }

  /* ------------------------------------------------------------ costumes
     What a new object looks like is the first question anybody asks, so it
     is asked on the way in rather than left to a menu afterwards. The same
     panel re-dresses an object that already exists. */
  let picker=null;                 // { mode:'new'|'change', shelf }

  function openPicker(mode){
    const a=current();
    const worn = (mode==='change' && a) ? String(a.shape||'cube') : 'people/character-a';
    const sh = COSTUMES.SHELVES.find(s=>s.items.some(x=>COSTUMES.id(s.id,x.file)===worn));
    picker={ mode, shelf:(sh?sh.id:'people') };
    drawPicker();
  }
  function closePicker(){ picker=null; const el=$('#cPick'); if(el) el.remove(); }

  function drawPicker(){
    if(!picker) return;
    let el=$('#cPick');
    if(!el){ el=document.createElement('div'); el.id='cPick'; $('#coder').appendChild(el); }
    const sh=COSTUMES.SHELVES.find(s=>s.id===picker.shelf)||COSTUMES.SHELVES[0];
    const worn=picker.mode==='change' && current() ? String(current().shape||'') : '';
    el.innerHTML=`
      <div class="cpwrap">
        <div class="cphead">
          <b>${picker.mode==='new'? t('What is it?') : t('Change costume')}</b>
          <span class="bspace"></span>
          <button class="btn small ghost" id="cPClose">${t('Cancel')}</button>
        </div>
        <div class="cptabs">${COSTUMES.SHELVES.map(s=>
          `<button class="cptab${s.id===sh.id?' on':''}" data-shelf="${s.id}">${t(s.name)}</button>`).join('')}</div>
        <div class="cpgrid">${sh.items.map(x=>{
          const cid=COSTUMES.id(sh.id,x.file), th=COSTUMES.thumbOf(cid);
          return `<button class="cpit${cid===worn?' on':''}" data-cos="${esc(cid)}">
            <span class="cpimg">${th?`<img src="${esc(th)}" alt="" loading="lazy">`
                                   :`<i class="cpshape ${esc(x.file)}"></i>`}</span>
            <span class="cpname">${esc(x.name)}</span></button>`;
        }).join('')}</div>
      </div>`;
    $('#cPClose').onclick=closePicker;
    el.querySelectorAll('[data-shelf]').forEach(b=>b.onclick=()=>{
      picker.shelf=b.dataset.shelf; drawPicker(); });
    el.querySelectorAll('[data-cos]').forEach(b=>b.onclick=()=>wear(b.dataset.cos));
  }
  function wear(cid){
    if(!picker) return;
    if(picker.mode==='new'){
      const n=VM.project.actors.length;
      const a=VM.addActor({ name:COSTUMES.nameOf(cid)+' '+(n+1), shape:cid,
        x:(Math.random()*8-4), y:1, z:(Math.random()*8-4),
        colour:['#8fd3ff','#a8e6cf','#ffb4a2','#cdb4f6','#ffd8a8'][n%5] });
      closePicker(); setActor(a); return;
    }
    VM.dress(current(), cid);
    closePicker(); render();
  }

  function renderList(list, path){
    const rows=(list||[]).map((bk,i)=>renderBlock(bk, path+'.'+i)).join('');
    const n=(list||[]).length;
    return rows + `<div class="cdrop${isCursor(list,n)?' on':''}" data-drop="${path}|${n}"></div>`;
  }
  const isCursor=(list,i)=>cursor && cursor.list===list && cursor.index===i;
  function renderBlock(bk, path){
    const bd=BLOCKS.of(bk.op); if(!bd) return '';
    const a=BLOCKS.catOf(bd.cat).a, sel = selected===path ? ' sel':'';
    let inner='';
    if(bd.kind==='c')  inner=`<div class="cmouth">${renderList(bk.body, path+'.b')}</div>`;
    if(bd.kind==='c2') inner=`<div class="cmouth">${renderList(bk.body, path+'.b')}</div>
      <div class="celse">${t('else')}</div><div class="cmouth">${renderList(bk.body2, path+'.e')}</div>`;
    return `<div class="cwrap">
      <div class="cblk k-${bd.kind} live${sel}" style="--a:${a}" data-blk="${path}">
        ${renderInline(bk)}<button class="bx" data-del="${path}">✕</button>
      </div>${inner}</div>`;
  }
  function renderInline(bk){
    const bd=BLOCKS.of(bk.op); if(!bd) return '';
    return BLOCKS.parts(bd.label).map(seg=>
      seg[0]!=='%' ? esc(seg) : slotHTML(bk,seg[1],bd.args[seg[1]])).join('');
  }
  function slotHTML(bk,k,sp){
    if(!sp) return '';
    const v=bk.args[k];
    if(v && typeof v==='object' && v.op){
      const bd=BLOCKS.of(v.op);
      return `<span class="cnest" style="--a:${BLOCKS.catOf(bd.cat).a}">${renderInline(v)}
        <button class="bx" data-clear="${k}">✕</button></span>`;
    }
    if(sp.type==='bool')
      return `<i class="cslot bool ${isSlot(bk,k)?'on':''}" data-slot="${k}">◇</i>`;
    if(sp.type==='pick')
      return `<select class="cin" data-set="${k}">${sp.opts.map(o=>
        `<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
    if(sp.type==='costume')
      return `<select class="cin" data-set="${k}">${COSTUMES.SHELVES.map(sh=>
        `<optgroup label="${esc(sh.name)}">${sh.items.map(x=>{
          const cid=COSTUMES.id(sh.id,x.file);
          return `<option value="${esc(cid)}" ${cid===v?'selected':''}>${esc(x.name)}</option>`;
        }).join('')}</optgroup>`).join('')}</select>`;
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
      /* `edge` is the room's own walls, and only blocks that can mean it offer it */
      return `<select class="cin" data-set="${k}">
        <option ${v==='player'?'selected':''}>player</option>
        <option ${v==='myself'?'selected':''}>myself</option>
        ${sp.edge?`<option ${v==='edge'?'selected':''}>edge</option>`:''}
        ${VM.project.actors.filter(x=>!x.isClone).map(x=>
          `<option ${x.name===v?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`;
    if(sp.type==='colour')
      return `<input class="cin ccol" type="color" data-set="${k}" value="${esc(v||'#8fd3ff')}">`;
    return `<input class="cin ${isSlot(bk,k)?'on':''}" data-set="${k}" data-slot="${k}"
                   value="${esc(String(v==null?'':v))}" size="${Math.max(2,String(v==null?'':v).length)}">`;
  }
  const isSlot=(bk,k)=>slotTarget && slotTarget.owner===bk && slotTarget.key===k;
  const allVarNames=()=>[...Object.keys(VM.project.vars), ...Object.keys((current()||{}).vars||{})];

  /* resolve "0.b.2" to the list holding the block and its index */
  function at(path){
    if(path==null) return null;
    const segs=String(path).split('.');
    let list, i=1;
    if(segs[0]==='p'){ const p=VM.project.procs.find(x=>x.name===editingProc); if(!p) return null; list=p.body; }
    else { const a=current(); if(!a) return null; const sc=a.scripts[+segs[0]]; if(!sc) return null; list=sc.body; }
    let bk=null;
    for(; i<segs.length; i++){
      const s=segs[i];
      if(s==='b'){ list=bk.body; continue; }
      if(s==='e'){ list=bk.body2; continue; }
      bk=list[+s]; if(!bk) return null;
    }
    return { list, block:bk, index:list.indexOf(bk) };
  }
  function listAt(path){                    // the list a drop-zone path points at
    const segs=String(path).split('.');
    let list;
    if(segs[0]==='p'){ const p=VM.project.procs.find(x=>x.name===editingProc); list=p?p.body:[]; }
    else { const a=current(); const sc=a&&a.scripts[+segs[0]]; list=sc?sc.body:[]; }
    let bk=null;
    for(let i=1;i<segs.length;i++){
      const s=segs[i];
      if(s==='b'){ list=bk.body; continue; }
      if(s==='e'){ list=bk.body2; continue; }
      bk=list[+s]; if(!bk) return list;
    }
    return list;
  }

  function wireScript(){
    const el=$('#cScript');
    el.querySelectorAll('[data-drop]').forEach(d=>d.onclick=e=>{
      e.stopPropagation();
      const [path,idx]=d.dataset.drop.split('|');
      cursor={ list:listAt(path), index:+idx }; selected=null; render();
    });
    // clicking the block body selects it — that is what the keyboard acts on
    el.querySelectorAll('[data-blk]').forEach(node=>{
      node.onclick=e=>{
        if(justDragged) return;
        if(e.target.closest('.cin,.bx,.cslot')) return;
        e.stopPropagation();
        const path=node.dataset.blk, r=at(path);
        if(magnify){ if(r) explain(r.block.op, node); return; }
        selected = selected===path ? null : path;
        if(r) cursor={ list:r.list, index:r.index+1 };
        render();
      };
      node.onmousedown=e=>{
        if(magnify) return;
        if(e.target.closest('.cin,.bx,.cslot,select,input')) return;
        const r=at(node.dataset.blk); if(!r) return;
        beginDrag(e,{ src:'script', path:node.dataset.blk,
          isExpr:false, html:node.innerHTML, cls:'k-stack' });
      };
    });
    el.querySelectorAll('[data-del]').forEach(x=>x.onclick=e=>{
      e.stopPropagation();
      const r=at(x.dataset.del);
      if(r){ r.list.splice(r.index,1); cursor=null; selected=null; VM.save(); render(); }
    });
    el.querySelectorAll('[data-del-script]').forEach(x=>x.onclick=e=>{
      e.stopPropagation();
      current().scripts.splice(+x.dataset.delScript,1);
      cursor=null; selected=null; VM.save(); render();
    });
    el.querySelectorAll('[data-set]').forEach(inp=>{
      const wrap=inp.closest('[data-blk]');
      const holder = wrap ? (at(wrap.dataset.blk)||{}).block : hatOf(inp);
      inp.onchange=()=>{
        if(!holder) return;
        let v=inp.value;
        if(v==='__new'){ const m=prompt(t('New message name'),'message'+(VM.project.msgs.length+1));
                         if(m){ VM.project.msgs.push(m); v=m; } else v=VM.project.msgs[0]; }
        holder.args[inp.dataset.set]=v; VM.save(); render();
      };
      if(inp.dataset.slot) inp.onclick=e=>{
        e.stopPropagation();
        slotTarget = (slotTarget&&slotTarget.owner===holder&&slotTarget.key===inp.dataset.slot)
                     ? null : { owner:holder, key:inp.dataset.slot };
        hint(); markSlots();
      };
    });
    el.querySelectorAll('[data-slot].bool').forEach(sl=>sl.onclick=e=>{
      e.stopPropagation();
      const wrap=sl.closest('[data-blk]'); if(!wrap) return;
      const holder=(at(wrap.dataset.blk)||{}).block; if(!holder) return;
      slotTarget={ owner:holder, key:sl.dataset.slot }; render();
    });
    el.querySelectorAll('[data-clear]').forEach(x=>x.onclick=e=>{
      e.stopPropagation();
      const wrap=x.closest('[data-blk]'); if(!wrap) return;
      const r=at(wrap.dataset.blk); if(!r) return;
      const sp=BLOCKS.of(r.block.op).args[x.dataset.clear];
      r.block.args[x.dataset.clear]= sp && sp.def!==undefined ? sp.def : null;
      VM.save(); render();
    });
  }
  function markSlots(){                     // cheap highlight without a full rebuild
    $('#cScript').querySelectorAll('.cin,[data-slot]').forEach(n=>n.classList.remove('on'));
    if(!slotTarget) return;
    render();
  }
  function hatOf(inp){
    const sc=inp.closest('.cscript'); if(!sc) return null;
    return current().scripts[+sc.dataset.sc].hat;
  }

  /* ------------------------------------------------------- magnifying glass
     A block that has to be guessed at is a block a student will not use. In
     this mode a click explains instead of acting: same blocks, same places,
     nothing added or moved. */
  function explain(op, el){
    const bd=BLOCKS.of(op); if(!bd) return;
    explainClose();
    const cat=BLOCKS.catOf(bd.cat);
    const card=document.createElement('div');
    card.className='cexplain'; card.id='cExplain';
    card.innerHTML=`
      <div class="cxtop" style="--a:${cat.a}">
        <span class="cxcat">${t(cat.name)}</span>
        <button class="bx" id="cxClose">✕</button>
      </div>
      <div class="cblk k-${bd.kind}" style="--a:${cat.a};width:auto">${preview(bd)}</div>
      <p class="cxbody">${esc(BLOCKS.help(op))}</p>
      <div class="cxshape">${esc(shapeNote(bd.kind))}</div>`;
    document.body.appendChild(card);
    const r=el.getBoundingClientRect(), w=300;
    card.style.left = Math.min(window.innerWidth-w-12, Math.max(8, r.left)) + 'px';
    card.style.top  = Math.min(window.innerHeight-190, r.bottom+8) + 'px';
    card.querySelector('#cxClose').onclick=explainClose;
  }
  function explainClose(){ const c=document.querySelector('#cExplain'); if(c) c.remove(); }
  function shapeNote(kind){
    return kind==='hat'    ? t('Starts a script. Nothing can go above it.')
         : kind==='c'      ? t('Wraps other blocks — drop them into its mouth.')
         : kind==='c2'     ? t('Wraps two groups: one for true, one for false.')
         : kind==='cap'    ? t('Ends a script. Nothing can go below it.')
         : kind==='report' ? t('Reports a value. Drop it into a slot instead of typing a number.')
         : kind==='bool'   ? t('Answers yes or no. Fits the diamond slots.')
         : t('Does one thing, then the block below runs.');
  }

  /* ---------------------------------------------------------------- drag
     Scratch is a drag-and-drop language and students arrive expecting that,
     so blocks drag as well as click: out of the palette, and around inside
     the script. A drag only starts once the pointer has actually moved, so
     a plain click still means "append", and the two never fight.

     Reporters drop into SLOTS; everything else drops into the gaps between
     blocks, including the gaps inside a loop's mouth — which is the whole
     point of dragging in the first place. */
  const DRAG_SLOP=4;

  function beginDrag(e, spec){
    if(e.button!==0) return;
    drag = Object.assign({ x0:e.clientX, y0:e.clientY, live:false, ghost:null, hot:null }, spec);
    addEventListener('mousemove', moveDrag, true);
    addEventListener('mouseup', endDrag, true);
  }
  function makeGhost(html, cls){
    const g=document.createElement('div');
    g.className='cghost '+(cls||'');
    g.innerHTML=html;
    document.body.appendChild(g);
    return g;
  }
  function moveDrag(e){
    if(!drag) return;
    if(!drag.live){
      if(Math.hypot(e.clientX-drag.x0, e.clientY-drag.y0) < DRAG_SLOP) return;
      drag.live=true;
      drag.ghost=makeGhost(drag.html, drag.cls);
      document.body.classList.add('cdragging');
    }
    drag.ghost.style.left=(e.clientX+8)+'px';
    drag.ghost.style.top =(e.clientY+8)+'px';
    highlight(e);
    e.preventDefault();
  }
  /* reporters look for slots, statements look for gaps */
  function highlight(e){
    if(drag.hot){ drag.hot.el.classList.remove('hot'); drag.hot=null; }
    const zones = drag.isExpr ? slotZones() : dropZones();
    let best=null, bestD=Infinity;
    zones.forEach(z=>{
      const r=z.el.getBoundingClientRect();
      if(e.clientX < r.left-70 || e.clientX > r.right+70) return;
      const d=Math.abs((r.top+r.bottom)/2 - e.clientY) + Math.abs((r.left+r.right)/2 - e.clientX)*0.15;
      if(d<bestD && d<170){ bestD=d; best=z; }
    });
    if(best){ best.el.classList.add('hot'); drag.hot=best; }
  }
  function dropZones(){
    const out=[];
    $('#cScript').querySelectorAll('[data-drop]').forEach(el=>{
      const [path,idx]=el.dataset.drop.split('|');
      out.push({ el, list:listAt(path), index:+idx });
    });
    return out;
  }
  function slotZones(){
    const out=[];
    $('#cScript').querySelectorAll('[data-slot]').forEach(el=>{
      const wrap=el.closest('[data-blk]');
      const owner = wrap ? (at(wrap.dataset.blk)||{}).block : hatOf(el);
      if(owner) out.push({ el, owner, key:el.dataset.slot });
    });
    return out;
  }
  /* a block may not be dropped inside itself */
  function subtreeLists(bk, acc){
    acc=acc||new Set();
    if(bk.body){ acc.add(bk.body); bk.body.forEach(c=>subtreeLists(c,acc)); }
    if(bk.body2){ acc.add(bk.body2); bk.body2.forEach(c=>subtreeLists(c,acc)); }
    return acc;
  }
  function endDrag(e){
    removeEventListener('mousemove', moveDrag, true);
    removeEventListener('mouseup', endDrag, true);
    const d=drag; drag=null;
    document.body.classList.remove('cdragging');
    if(!d) return;
    if(d.ghost) d.ghost.remove();
    if(!d.live) return;                       // never moved: the click handler has it
    if(d.hot) d.hot.el.classList.remove('hot');
    justDragged=true; setTimeout(()=>{ justDragged=false; }, 0);
    if(!d.hot){ if(d.src==='script') render(); return; }

    if(d.isExpr){
      const bk = d.src==='palette' ? newBlock(d.op,d.callName) : detach(d);
      if(bk) d.hot.owner.args[d.hot.key]=bk;
    } else {
      let bk, target=d.hot;
      if(d.src==='palette') bk=newBlock(d.op,d.callName);
      else {
        const r=at(d.path); if(!r) return;
        if(subtreeLists(r.block).has(target.list)){ render(); flash(t('A block cannot go inside itself.')); return; }
        // removing first can shift the target index within the same list
        const sameList = r.list===target.list;
        const idx = (sameList && r.index < target.index) ? target.index-1 : target.index;
        r.list.splice(r.index,1);
        target={ list:target.list, index:Math.max(0,Math.min(idx,target.list.length)) };
        bk=r.block;
      }
      if(bk) target.list.splice(target.index,0,bk);
    }
    selected=null; cursor=null; VM.save(); render();
  }
  function detach(d){
    const r=at(d.path); if(!r) return null;
    r.list.splice(r.index,1);
    return r.block;
  }
  let justDragged=false;

  /* ------------------------------------------------------------ keyboard
     Once a block is selected the script behaves like a document. Nothing
     here fires while the caret is in a field — typing 10 into a slot must
     not delete the block you are typing into. */
  function keys(e){
    if(!open) return;
    const tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='select'||tag==='textarea'){
      if(e.key==='Escape') e.target.blur();
      return;
    }
    const meta=e.ctrlKey||e.metaKey;
    const r=at(selected);

    if(e.key==='Escape'){ selected=null; slotTarget=null; cursor=null; render(); e.preventDefault(); return; }
    if((e.key==='Backspace'||e.key==='Delete') && r){
      clip=JSON.parse(JSON.stringify(r.block));       // a delete you can undo by pasting
      r.list.splice(r.index,1);
      selected=null; cursor={ list:r.list, index:Math.max(0,r.index) };
      VM.save(); render(); e.preventDefault(); return;
    }
    if(meta && e.key.toLowerCase()==='x' && r){
      clip=JSON.parse(JSON.stringify(r.block));
      r.list.splice(r.index,1);
      selected=null; cursor={ list:r.list, index:Math.max(0,r.index) };
      VM.save(); render(); e.preventDefault(); return;
    }
    if(meta && e.key.toLowerCase()==='c' && r){
      clip=JSON.parse(JSON.stringify(r.block)); flash(t('Copied.')); e.preventDefault(); return;
    }
    if(meta && e.key.toLowerCase()==='v' && clip){
      insert(JSON.parse(JSON.stringify(clip))); e.preventDefault(); return;
    }
    if(meta && e.key.toLowerCase()==='d' && r){
      const copy=JSON.parse(JSON.stringify(r.block));
      r.list.splice(r.index+1,0,copy);
      selected=null; cursor={ list:r.list, index:r.index+2 };
      VM.save(); render(); e.preventDefault(); return;
    }
    if((e.key==='ArrowUp'||e.key==='ArrowDown') && r){
      const next=r.index + (e.key==='ArrowUp'?-1:1);
      if(next>=0 && next<r.list.length){
        const base=selected.split('.'); base[base.length-1]=String(next);
        selected=base.join('.'); render();
      }
      e.preventDefault(); return;
    }
  }

  let flashT=null;
  function flash(msg){
    const h=$('#cHint'); if(!h) return;
    h.textContent=msg; h.classList.add('bad');
    clearTimeout(flashT); flashT=setTimeout(()=>{ h.classList.remove('bad'); hint(); },2000);
  }
  /* flash() is for mistakes and goes red; note() is for news and does not */
  function note(msg){
    const h=$('#cHint'); if(!h) return;
    h.textContent=msg; h.classList.remove('bad');
    clearTimeout(flashT); flashT=setTimeout(()=>hint(), 2600);
  }
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function render(){
    if(!open) return;
    document.querySelector('#coder').classList.toggle('magnify', magnify);
    bar(); palette(); scripts();
  }

  let beat=0;
  function tick(dt){
    if(!open) return;
    beat+=dt;
    if(beat>0.5){ beat=0; bar(); if(cat==='data') palette(); }
  }

  addEventListener('keydown', keys, true);

  return { show, hide, toggle, render, tick, setActor, restrict, openOn,
           get open(){ return open; } };
})();
