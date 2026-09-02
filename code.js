/* =====================================================================
   CODE — block-based programming console.
   Students snap blocks together; a repeat block physically wraps the
   blocks inside it, so a loop LOOKS like a loop and there is no way to
   forget an "end". A side panel mirrors the blocks as real code text,
   which is the bridge to Python or JavaScript later.
   No eval() anywhere — blocks compile straight to a step list.
   ===================================================================== */
window.CODE = (function(){

  let script=[];            // nested block tree
  let el, paletteEl, scriptEl, textEl, tape, open=false, onRun=null;
  let dropTarget=null;      // repeat block currently accepting new blocks
  let uid=1;

  const DEF = {
    shoot :{label:'shoot()',  color:'#e0663f', help:'Fire one shot where you are aiming'},
    wait  :{label:'wait()',   color:'#3e8ede', help:'Pause for a moment'},
    repeat:{label:'repeat',   color:'#7c5cff', help:'Do the blocks inside, again and again'}
  };

  /* ------------------------------------------------------------ model */
  function makeBlock(type){
    const b={id:uid++, type};
    if(type==='repeat'){ b.count=3; b.body=[]; }
    return b;
  }
  function addBlock(type){
    const b=makeBlock(type);
    if(dropTarget && dropTarget.type==='repeat') dropTarget.body.push(b);
    else script.push(b);
    if(window.beep) beep('pop');
    draw();
  }
  function removeBlock(id, list){
    list = list || script;
    for(let i=0;i<list.length;i++){
      if(list[i].id===id){ if(dropTarget&&dropTarget.id===id) dropTarget=null; list.splice(i,1); return true; }
      if(list[i].body && removeBlock(id, list[i].body)) return true;
    }
    return false;
  }
  function findBlock(id, list){
    list = list || script;
    for(const b of list){
      if(b.id===id) return b;
      if(b.body){ const f=findBlock(id,b.body); if(f) return f; }
    }
    return null;
  }

  /* ------------------------------------------------- compile + text */
  // turns the block tree into the exact list of steps that will run
  function compile(list, out, guard){
    out=out||[]; guard=guard||{n:0};
    for(const b of list){
      if(guard.n++ > 400) break;
      if(b.type==='repeat'){
        for(let i=0;i<b.count;i++){
          out.push({name:'__iter', blockId:b.id, i:i+1, n:b.count});
          compile(b.body, out, guard);
        }
      } else out.push({name:b.type, blockId:b.id});
    }
    return out;
  }
  function toText(list, depth){
    list=list||script; depth=depth||0;
    const pad='  '.repeat(depth);
    let s=[];
    for(const b of list){
      if(b.type==='repeat'){
        s.push(pad+'repeat '+b.count);
        s=s.concat(toText(b.body, depth+1));
        s.push(pad+'end');
      } else s.push(pad+DEF[b.type].label);
    }
    return s;
  }

  /* --------------------------------------------------------- console */
  function build(){
    el=document.createElement('div'); el.id='console'; el.className='hidden';
    el.innerHTML=`
      <div class="con-card">
        <div class="con-head"><b id="conTitle"></b>
          <button class="btn small ghost" id="conClose">✕</button></div>
        <div class="con-body">
          <div class="con-col">
            <div class="con-lbl" id="conPalLbl"></div>
            <div id="conPalette"></div>
          </div>
          <div class="con-col grow">
            <div class="con-lbl" id="conScriptLbl"></div>
            <div id="conScript"></div>
          </div>
          <div class="con-col">
            <div class="con-lbl" id="conTextLbl"></div>
            <pre id="conText"></pre>
          </div>
        </div>
        <div class="con-foot">
          <span class="con-hint" id="conHint"></span>
          <span>
            <button class="btn small ghost" id="conClear"></button>
            <button class="btn good" id="conRun"></button>
          </span>
        </div>
      </div>`;
    document.body.appendChild(el);
    paletteEl=el.querySelector('#conPalette');
    scriptEl =el.querySelector('#conScript');
    textEl   =el.querySelector('#conText');
    el.querySelector('#conClose').onclick=close;
    el.querySelector('#conClear').onclick=()=>{ script=[]; dropTarget=null; draw(); };
    el.querySelector('#conRun').onclick=run;
    tape=document.createElement('div'); tape.id='tape'; tape.className='hidden';
    document.body.appendChild(tape);
  }

  let palette=['shoot','repeat'];
  function setPalette(list){ palette=list; }

  function blockHTML(b, readonly){
    const d=DEF[b.type];
    if(b.type==='repeat'){
      const isTarget = dropTarget && dropTarget.id===b.id;
      return `<div class="blk rep ${isTarget?'target':''}" data-id="${b.id}" style="--c:${d.color}">
          <div class="blk-head">
            <span class="blk-name">${t('repeat')}</span>
            ${readonly?'':`<button class="cnt" data-act="dec" data-id="${b.id}">−</button>`}
            <span class="cnt-n" data-count="${b.id}">${b.count}</span>
            ${readonly?'':`<button class="cnt" data-act="inc" data-id="${b.id}">+</button>`}
            <span class="blk-times">${t('times')}</span>
            <span class="iter" data-iter="${b.id}"></span>
            ${readonly?'':`<button class="blk-x" data-act="del" data-id="${b.id}">✕</button>`}
          </div>
          <div class="blk-body" data-body="${b.id}">
            ${b.body.map(c=>blockHTML(c,readonly)).join('') ||
              (readonly?'':`<div class="blk-empty">${t('put blocks here')}</div>`)}
          </div>
          <div class="blk-foot"></div>
        </div>`;
    }
    return `<div class="blk" data-id="${b.id}" style="--c:${d.color}">
        <span class="blk-name">${d.label}</span>
        ${readonly?'':`<button class="blk-x" data-act="del" data-id="${b.id}">✕</button>`}
      </div>`;
  }

  function draw(){
    el.querySelector('#conTitle').textContent=t('CODE CONSOLE');
    el.querySelector('#conPalLbl').textContent=t('BLOCKS');
    el.querySelector('#conScriptLbl').textContent=t('YOUR PROGRAM');
    el.querySelector('#conTextLbl').textContent=t('YOUR CODE SAYS');
    el.querySelector('#conClear').textContent=t('Clear');
    el.querySelector('#conRun').textContent=t('▶ RUN');
    el.querySelector('#conHint').textContent = dropTarget
      ? t('New blocks go INSIDE the repeat. Click the repeat again to stop.')
      : t('Click a block to add it. Click a repeat to put blocks inside it.');

    paletteEl.innerHTML=palette.map(type=>{
      const d=DEF[type];
      return `<button class="palblk" data-add="${type}" style="--c:${d.color}">
        <b>${type==='repeat'?t('repeat')+' 3':d.label}</b><small>${t(d.help)}</small></button>`;
    }).join('');
    paletteEl.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addBlock(b.dataset.add));

    scriptEl.innerHTML = script.length ? script.map(b=>blockHTML(b,false)).join('')
      : `<div class="blk-empty big">${t('Your program is empty. Click a block on the left.')}</div>`;
    scriptEl.querySelectorAll('[data-act]').forEach(btn=>{
      btn.onclick=e=>{
        e.stopPropagation();
        const b=findBlock(+btn.dataset.id);
        if(btn.dataset.act==='del') removeBlock(+btn.dataset.id);
        if(btn.dataset.act==='inc' && b) b.count=Math.min(20,b.count+1);
        if(btn.dataset.act==='dec' && b) b.count=Math.max(1,b.count-1);
        draw();
      };
    });
    scriptEl.querySelectorAll('.blk.rep').forEach(node=>{
      node.onclick=e=>{
        e.stopPropagation();
        const b=findBlock(+node.dataset.id);
        dropTarget = (dropTarget && dropTarget.id===b.id) ? null : b;
        draw();
      };
    });
    textEl.textContent=toText().join('\n') || '—';
  }

  function show(pal){
    if(!el) build();
    if(pal) setPalette(pal);
    open=true; el.classList.remove('hidden'); draw();
    if(document.pointerLockElement) document.exitPointerLock();
  }
  function close(){ open=false; if(el) el.classList.add('hidden'); }
  function isOpen(){ return open; }

  function run(){
    const steps=compile(script);
    const real=steps.filter(s=>s.name!=='__iter');
    if(!real.length){
      el.querySelector('#conHint').textContent=t('Add at least one shoot() block first.');
      if(window.beep) beep('bad');
      return;
    }
    close();
    tape.classList.remove('hidden');
    tape.innerHTML=`<div class="tape-lbl">${t('RUNNING')}</div>`+script.map(b=>blockHTML(b,true)).join('');
    if(onRun) onRun(steps, toText());
  }

  /* live highlight while the program runs */
  function highlight(step){
    if(!tape) return;
    tape.querySelectorAll('.blk').forEach(b=>b.classList.remove('on'));
    if(!step) return;
    const node=tape.querySelector(`.blk[data-id="${step.blockId}"]`);
    if(node) node.classList.add('on');
  }
  function setIter(blockId,i,n){
    if(!tape) return;
    const s=tape.querySelector(`[data-iter="${blockId}"]`);
    if(s) s.textContent=`${i}/${n}`;
    const node=tape.querySelector(`.blk[data-id="${blockId}"]`);
    if(node) node.classList.add('on');
  }
  function hideTape(){ if(tape) tape.classList.add('hidden'); }
  function clear(){ script=[]; dropTarget=null; if(el) draw(); }

  return { show, close, isOpen, setPalette, compile, toText, highlight, setIter, hideTape, clear,
           get script(){ return script; },
           set onRun(fn){ onRun=fn; } };
})();
