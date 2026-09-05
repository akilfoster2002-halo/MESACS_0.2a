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
  let guide=null;           // the walkthrough for the skill being taught
  let typed='';             // what the student wrote in Type-it mode
  let mode='blocks';
  try{ mode = localStorage.getItem('dq_codemode')==='text' ? 'text' : 'blocks'; }catch(e){}
  let dropTarget=null;      // repeat block currently accepting new blocks
  let uid=1;

  const DEF = {
    shoot    :{label:'shoot()',      color:'#ffb4a2', help:'Fire one shot where you are aiming'},
    grab     :{label:'grab()',       color:'#ffe9a8', help:'Pick up what you are standing on'},
    shootRed :{label:'shootRed()',   color:'#ff9aa2', help:'Fire a RED bolt — breaks red shields'},
    shootBlue:{label:'shootBlue()',  color:'#8fd3ff', help:'Fire a BLUE bolt — breaks blue shields'},
    wait     :{label:'wait()',       color:'#bdb2d8', help:'Pause for a moment'},
    repeat   :{label:'repeat',       color:'#cdb4f6', help:'Do the blocks inside, again and again'},
    ifc      :{label:'if',           color:'#a8e6cf', help:'Only do the blocks inside IF it is true'},
    call     :{label:'combo()',      color:'#ffe9a8', help:'Run the blocks you put in DEFINE combo'},
    define   :{label:'define combo', color:'#ffd8a8', help:'Teach the gun a move once, then call it'},
    forward  :{label:'forward()',    color:'#a8e6cf', help:'Walk forward one tile'},
    turn     :{label:'turn()',       color:'#8fd3ff', help:'Swing the camera a quarter turn'},
    hold     :{label:'hold()',       color:'#cdb4f6', help:'Keep it there'},
    left     :{label:'turnLeft()',   color:'#8fd3ff', help:'Turn a quarter turn left'},
    right    :{label:'turnRight()',  color:'#8fd3ff', help:'Turn a quarter turn right'},
    gas      :{label:'gas()',        color:'#ffd8a8', help:'Drive on one tile — faster every time in a row'},
    /* the flight deck.  up/down/left/right are RELATIVE — one lane from
       wherever you are — and goTo is the absolute one, which is the whole
       point of having both. */
    flyUp    :{label:'up()',         color:'#a8e6cf', help:'Climb one lane'},
    flyDown  :{label:'down()',       color:'#a8e6cf', help:'Drop one lane'},
    flyLeft  :{label:'left()',       color:'#8fd3ff', help:'Slide one lane left'},
    flyRight :{label:'right()',      color:'#8fd3ff', help:'Slide one lane right'},
    coast    :{label:'coast()',      color:'#bdb2d8', help:'Hold this lane for one beat'},
    fire     :{label:'fire()',       color:'#ffb4a2', help:'Shoot straight ahead'},
    goTo     :{label:'goTo',         color:'#ffd8a8', help:'Jump to one exact lane, from anywhere'}
  };
  /* How far goTo is allowed to count. The console does not know how big any
     one mission's grid is, so the mission says. */
  let GRID={ col:2, row:2 };
  function setGrid(cols, rows){ GRID={ col:Math.max(0,(cols||3)-1), row:Math.max(0,(rows||3)-1) }; }
  let CONDS=['red','blue'];
  function setConditions(list){ CONDS=list&&list.length?list:['red','blue']; }

  /* ------------------------------------------------------------ model */
  function makeBlock(type){
    const b={id:uid++, type};
    if(type==='repeat'){ b.count=3; b.body=[]; }
    if(type==='ifc'){ b.cond=CONDS[0]; b.body=[]; }
    if(type==='define'){ b.body=[]; }
    if(type==='goTo'){ b.col=1; b.row=1; }
    return b;
  }
  function addBlock(type){
    if(budget && countBlocks()>=budget){
      hint(t('Block budget full — delete one, or find a shorter way (that is the puzzle).'), 'err');
      if(window.beep) beep('bad');
      return;
    }
    const b=makeBlock(type);
    if(dropTarget && dropTarget.body) dropTarget.body.push(b);
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
  // which container holds this block? used to step OUT one level
  function findParent(id, list, parent){
    list=list||script; parent=parent===undefined?null:parent;
    for(const b of list){
      if(b.id===id) return parent;
      if(b.body){ const f=findParent(id,b.body,b); if(f!==undefined&&f!==null) return f;
                  if(b.body.some(c=>c.id===id)) return b; }
    }
    return null;
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
  function compile(list, out, guard, depth){
    out=out||[]; guard=guard||{n:0}; depth=depth||0;
    for(const b of list){
      if(guard.n++ > 600) break;
      if(b.type==='define') continue;                  // a definition only runs when called
      if(b.type==='repeat'){
        for(let i=0;i<b.count;i++){
          out.push({name:'__iter', blockId:b.id, i:i+1, n:b.count});
          compile(b.body, out, guard, depth);
        }
      } else if(b.type==='ifc'){
        const at=out.length;
        out.push({name:'__if', blockId:b.id, cond:b.cond, jump:0});
        compile(b.body, out, guard, depth);
        out[at].jump=out.length;                       // where to land when the test is false
      } else if(b.type==='call'){
        const def=findDefine();
        if(def && depth<4){
          out.push({name:'__call', blockId:b.id});
          compile(def.body, out, guard, depth+1);
        }
      } else if(b.type==='goTo'){
        out.push({name:'goTo', blockId:b.id, col:b.col, row:b.row});
      } else out.push({name:b.type, blockId:b.id});
    }
    return out;
  }
  function findDefine(list){
    list=list||script;
    for(const b of list){ if(b.type==='define') return b;
      if(b.body){ const f=findDefine(b.body); if(f) return f; } }
    return null;
  }
  function toText(list, depth){
    list=list||script; depth=depth||0;
    const pad='  '.repeat(depth);
    let s=[];
    for(const b of list){
      if(b.type==='repeat'){
        s.push(pad+'repeat '+b.count);
        s=s.concat(toText(b.body, depth+1)); s.push(pad+'end');
      } else if(b.type==='ifc'){
        s.push(pad+'if target is '+b.cond);
        s=s.concat(toText(b.body, depth+1)); s.push(pad+'end');
      } else if(b.type==='define'){
        s.push(pad+'define combo');
        s=s.concat(toText(b.body, depth+1)); s.push(pad+'end');
      } else if(b.type==='goTo'){
        s.push(pad+'goto '+b.col+','+b.row);
      } else s.push(pad+DEF[b.type].label);
    }
    return s;
  }

  /* -------------------------------------------------- typing it out
     The same program, written as words.  Parsing back into the very same
     block tree is what keeps the two halves honest: whatever you type has
     to be something you could have built, and it runs down one code path. */
  const BY_WORD = {};
  Object.keys(DEF).forEach(k=>{
    if(k==='repeat'||k==='ifc'||k==='define'||k==='goTo') return;
    BY_WORD[DEF[k].label.toLowerCase()] = k;
  });
  function allowed(type){ return palette.indexOf(type) >= 0; }

  function parse(text){
    const out=[], stack=[], lines=String(text||'').split('\n');
    const put=b=>{ (stack.length ? stack[stack.length-1].body : out).push(b); };
    const bad=(i,msg)=>({ error:{ line:i+1, msg } });

    for(let i=0;i<lines.length;i++){
      const raw=lines[i].trim();
      if(!raw || raw[0]==='#') continue;
      const low=raw.toLowerCase().replace(/\s+/g,' ');

      if(low==='end'){
        if(!stack.length) return bad(i, t('This <b>end</b> has nothing open above it.'));
        stack.pop(); continue;
      }
      let m;
      if((m=low.match(/^repeat +(\d+)$/))){
        if(!allowed('repeat')) return bad(i, t('<b>repeat</b> is not in this mission yet.'));
        const b=makeBlock('repeat'); b.count=Math.max(1,Math.min(20,+m[1]));
        put(b); stack.push(b); continue;
      }
      if(low==='repeat') return bad(i, t('<b>repeat</b> needs a number after it, like <b>repeat 3</b>.'));
      if((m=low.match(/^if target is (\w+)$/))){
        if(!allowed('ifc')) return bad(i, t('<b>if</b> is not in this mission yet.'));
        if(CONDS.indexOf(m[1])<0)
          return bad(i, t('<b>{w}</b> is not something you can test for here.',{w:m[1]}));
        const b=makeBlock('ifc'); b.cond=m[1]; put(b); stack.push(b); continue;
      }
      if(low==='if') return bad(i, t('Write the whole test, like <b>if target is red</b>.'));
      if((m=low.match(/^goto +(\d+) *, *(\d+)$/))){
        if(!allowed('goTo')) return bad(i, t('<b>goTo</b> is not in this mission yet.'));
        const b=makeBlock('goTo');
        b.col=Math.max(0,Math.min(GRID.col,+m[1]));
        b.row=Math.max(0,Math.min(GRID.row,+m[2]));
        put(b); continue;
      }
      if(low==='goto') return bad(i, t('<b>goTo</b> needs a column and a row, like <b>goto 1,2</b>.'));
      if(low==='define combo'){
        if(!allowed('define')) return bad(i, t('<b>define combo</b> is not in this mission yet.'));
        const b=makeBlock('define'); put(b); stack.push(b); continue;
      }
      const type = BY_WORD[low] || BY_WORD[low.replace(/ /g,'')];
      if(!type) return bad(i, t('The console does not know <b>{w}</b>. Click a word on the left.',{w:raw}));
      if(!allowed(type)) return bad(i, t('<b>{w}</b> is not in this mission yet.',{w:DEF[type].label}));
      put(makeBlock(type));
    }
    if(stack.length) return { error:{ line:lines.length,
      msg: t('An <b>end</b> is missing — something is still open.') } };
    return { script:out };
  }

  /* --------------------------------------------------------- console */
  function build(){
    el=document.createElement('div'); el.id='console'; el.className='hidden';
    el.innerHTML=`
      <div class="con-card">
        <div class="con-head"><b id="conTitle"></b>
          <span class="con-mode">
            <button class="modebtn" id="conModeB"></button>
            <button class="modebtn" id="conModeT"></button>
          </span>
          <button class="btn small ghost" id="conClose">✕</button></div>
        <div id="conGuide" class="hidden"></div>
        <div class="con-body">
          <div class="con-col">
            <div class="con-lbl" id="conPalLbl"></div>
            <div id="conPalette"></div>
          </div>
          <div class="con-col grow">
            <div class="con-lbl" id="conScriptLbl"></div>
            <div id="conScript"></div>
            <textarea id="conTA" class="hidden" spellcheck="false" autocapitalize="off"
                      autocomplete="off" autocorrect="off"></textarea>
          </div>
          <div class="con-col">
            <div class="con-lbl" id="conTextLbl"></div>
            <pre id="conText"></pre>
            <div id="conMirror" class="hidden"></div>
          </div>
        </div>
        <div class="con-foot">
          <span><span class="con-budget hidden" id="conBudget"></span>
          <span class="con-hint" id="conHint"></span></span>
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
    el.querySelector('#conClear').onclick=()=>{ script=[]; typed=''; dropTarget=null; draw(); };
    el.querySelector('#conRun').onclick=run;
    el.querySelector('#conModeB').onclick=()=>setMode('blocks');
    el.querySelector('#conModeT').onclick=()=>setMode('text');
    const ta=el.querySelector('#conTA');
    ta.addEventListener('input',()=>{ typed=ta.value; reflect(); });
    // the console owns the keyboard while you are typing in it
    ta.addEventListener('keydown',e=>{
      e.stopPropagation();
      if(e.key==='Tab'){ e.preventDefault(); insertWord('  ', true); }
    });
    tape=document.createElement('div'); tape.id='tape'; tape.className='hidden';
    document.body.appendChild(tape);
  }

  let palette=['shoot','repeat'];
  let budget=0;
  function setPalette(list){ palette=list; }
  function setBudget(n){ budget=n||0; }
  function countBlocks(list){
    list=list||script; let n=0;
    for(const b of list){ n++; if(b.body) n+=countBlocks(b.body); }
    return n;
  }

  function blockHTML(b, readonly){
    const d=DEF[b.type];
    if(b.type==='ifc' || b.type==='define'){
      const isTarget = dropTarget && dropTarget.id===b.id;
      const head = b.type==='ifc'
        ? `<span class="blk-name">${t('if target is')}</span>
           ${readonly?`<span class="cnt-n">${t(b.cond)}</span>`
             :`<button class="cond" data-act="cond" data-id="${b.id}" style="--sw:${b.cond==='red'?'#ff9aa2':'#8fd3ff'}">${t(b.cond)}</button>`}`
        : `<span class="blk-name">${t('define combo')}</span>`;
      return `<div class="blk rep ${isTarget?'target':''}" data-id="${b.id}" style="--c:${d.color}">
          <div class="blk-head">${head}
            ${readonly?'':`<button class="blk-x" data-act="del" data-id="${b.id}">✕</button>`}</div>
          <div class="blk-body">${b.body.map(c=>blockHTML(c,readonly)).join('') ||
            (readonly?'':`<div class="blk-empty">${t('put blocks here')}</div>`)}</div>
          <div class="blk-foot"></div>
        </div>`;
    }
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
    if(b.type==='goTo'){
      // two little counters rather than a typed number: a nine-year-old can
      // read a lane off the screen and click to it, and it cannot go out of
      // bounds by construction
      const step=(what,val)=>`
        <span class="blk-times">${t(what)}</span>
        ${readonly?'':`<button class="cnt" data-act="${what}-" data-id="${b.id}">−</button>`}
        <span class="cnt-n">${val}</span>
        ${readonly?'':`<button class="cnt" data-act="${what}+" data-id="${b.id}">+</button>`}`;
      return `<div class="blk" data-id="${b.id}" style="--c:${d.color}">
          <span class="blk-name">${t('goTo')}</span>
          ${step('col',b.col)}${step('row',b.row)}
          ${readonly?'':`<button class="blk-x" data-act="del" data-id="${b.id}">✕</button>`}
        </div>`;
    }
    return `<div class="blk" data-id="${b.id}" style="--c:${d.color}">
        <span class="blk-name">${d.label}</span>
        ${readonly?'':`<button class="blk-x" data-act="del" data-id="${b.id}">✕</button>`}
      </div>`;
  }

  /* the walkthrough, so the thing you are copying is in front of you while
     you write it instead of behind the console */
  function drawGuide(){
    const g=el.querySelector('#conGuide');
    if(!guide || !(guide.brief||guide.name||guide.text||guide.code)){
      g.classList.add('hidden'); return;
    }
    g.classList.remove('hidden');
    const skill = (guide.name||guide.text)
      ? `<div class="cg-skill"><b>${t(guide.name||'')}</b>${t(guide.text||'')}</div>` : '';
    g.innerHTML=`<div class="con-lbl">${t('WHAT YOU ARE WRITING')}</div>
      <div class="cg-row">
        <div class="cg-txt">
          ${guide.brief ? `<div class="cg-brief">${t(guide.brief)}</div>` : ''}
          ${skill}
        </div>
        ${guide.code ? `<pre class="cg-code">${guide.code}</pre>` : ''}
      </div>`;
  }
  function hint(msg, kind){
    if(!el) return;
    const h=el.querySelector('#conHint');
    h.className='con-hint'+(kind?' '+kind:'');
    h.innerHTML=msg;
  }
  function budgetOut(n){
    if(!el) return;
    const bl=el.querySelector('#conBudget');
    if(!budget){ bl.classList.add('hidden'); return; }
    bl.classList.remove('hidden');
    bl.innerHTML=`${t('Blocks')}: <b class="${n>budget?'over':''}">${n}/${budget}</b>`;
  }

  /* Type-it mode reads what you wrote after every keystroke and shows the
     blocks it would build — so a typo is caught where you made it. */
  function reflect(){
    if(mode!=='text' || !el) return;
    const mirror=el.querySelector('#conMirror');
    const r=parse(typed);
    if(r.error){
      hint(t('Line {n}',{n:r.error.line})+': '+r.error.msg, 'err');
      mirror.innerHTML=`<div class="blk-empty">${t('Fix that line and this fills in.')}</div>`;
      return;
    }
    const n=countBlocks(r.script);
    mirror.innerHTML = r.script.length ? r.script.map(b=>blockHTML(b,true)).join('')
      : `<div class="blk-empty">${t('Nothing yet.')}</div>`;
    budgetOut(n);
    if(budget && n>budget) hint(t('That is {a} blocks — the budget is {b}.',{a:n,b:budget}), 'err');
    else hint(t('Reads fine — {n} instruction(s).',{n}), 'ok');
  }

  function setMode(m){
    if(m===mode) return;
    if(m==='text'){
      typed = toText().join('\n');          // carry the blocks over as words
      mode='text';
    } else {
      const r=parse(typed);                 // and carry the words back as blocks
      if(r.error){
        hint(t('Line {n}',{n:r.error.line})+': '+r.error.msg+' '+
             t('It has to read before it can be blocks.'), 'err');
        if(window.beep) beep('bad');
        return;
      }
      script=r.script; dropTarget=null; mode='blocks';
    }
    try{ localStorage.setItem('dq_codemode', mode); }catch(e){}
    if(!el) return;                       // the console can be set before it is built
    draw();
    if(mode==='text'){ const ta=el.querySelector('#conTA'); ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length); }
  }

  function insertWord(w, literal){
    const ta=el.querySelector('#conTA'); if(!ta) return;
    const a=ta.selectionStart, b=ta.selectionEnd, v=ta.value;
    const before=v.slice(0,a), after=v.slice(b);
    // a word lands on its own line, because that is how the program reads
    const ins = literal ? w : ((before && !/\n$/.test(before)) ? '\n' : '') + w;
    ta.value = before + ins + after;
    typed = ta.value;
    const at=(before+ins).length;
    ta.focus(); ta.setSelectionRange(at, at);
    reflect();
  }
  /* the word bank is the block palette, spelled out */
  function words(){
    const out=[];
    palette.forEach(type=>{
      const d=DEF[type]; if(!d) return;
      if(type==='repeat')      out.push({w:'repeat 3', c:d.color});
      else if(type==='ifc')    CONDS.forEach(c=>out.push({w:'if target is '+c, c:d.color}));
      else if(type==='define') out.push({w:'define combo', c:d.color});
      else if(type==='goTo')   out.push({w:'goto 1,1', c:d.color});
      else                     out.push({w:d.label, c:d.color});
    });
    if(palette.some(p=>p==='repeat'||p==='ifc'||p==='define'))
      out.push({w:'end', c:'#5a4b85'});
    return out;
  }

  function draw(){
    const typing = mode==='text';
    el.querySelector('#conTitle').textContent=t('CODE CONSOLE');
    el.querySelector('#conModeB').textContent=t('Blocks');
    el.querySelector('#conModeT').textContent=t('Type it');
    el.querySelector('#conModeB').classList.toggle('on', !typing);
    el.querySelector('#conModeT').classList.toggle('on', typing);
    el.querySelector('#conPalLbl').textContent    = typing ? t('WORD BANK') : t('BLOCKS');
    el.querySelector('#conScriptLbl').textContent = typing ? t('YOUR CODE')  : t('YOUR PROGRAM');
    el.querySelector('#conTextLbl').textContent   = typing ? t('THAT IS THESE BLOCKS') : t('YOUR CODE SAYS');
    el.querySelector('#conClear').textContent=t('Clear');
    el.querySelector('#conRun').textContent=t('▶ RUN');
    drawGuide();

    scriptEl.classList.toggle('hidden', typing);
    textEl.classList.toggle('hidden', typing);
    el.querySelector('#conTA').classList.toggle('hidden', !typing);
    el.querySelector('#conMirror').classList.toggle('hidden', !typing);

    if(typing) drawTyping(); else drawBlocks();
  }

  function drawTyping(){
    paletteEl.className='wordbank';
    paletteEl.innerHTML=words().map(w=>
      `<button class="word" data-w="${w.w}" style="--c:${w.c}">${w.w}</button>`).join('');
    paletteEl.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>insertWord(b.dataset.w));
    const ta=el.querySelector('#conTA');
    ta.value=typed;
    ta.placeholder=t('One instruction per line. Click a word on the left to drop it in.');
    reflect();
  }

  function drawBlocks(){
    paletteEl.className='';
    hint(dropTarget
      ? t('New blocks go INSIDE the repeat. Click the repeat again to stop.')
      : t('Click a block to add it. Click a repeat to put blocks inside it.'));
    budgetOut(countBlocks());

    paletteEl.innerHTML=palette.map(type=>{
      const d=DEF[type];
      return `<button class="palblk" data-add="${type}" style="--c:${d.color}">
        <b>${type==='repeat'?t('repeat')+' 3':type==='goTo'?t('goTo')+' 1,1':d.label}</b>
        <small>${t(d.help)}</small></button>`;
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
        if(btn.dataset.act==='cond' && b) b.cond = CONDS[(CONDS.indexOf(b.cond)+1)%CONDS.length];
        if(btn.dataset.act==='col+' && b) b.col=Math.min(GRID.col,b.col+1);
        if(btn.dataset.act==='col-' && b) b.col=Math.max(0,b.col-1);
        if(btn.dataset.act==='row+' && b) b.row=Math.min(GRID.row,b.row+1);
        if(btn.dataset.act==='row-' && b) b.row=Math.max(0,b.row-1);
        draw();
      };
    });
    scriptEl.querySelectorAll('.blk.rep, .blk.ifc, .blk.define').forEach(node=>{
      node.onclick=e=>{
        e.stopPropagation();
        const b=findBlock(+node.dataset.id);
        // clicking the container you are already inside steps OUT one level,
        // back to the loop that holds it — not all the way to the top
        dropTarget = (dropTarget && dropTarget.id===b.id) ? findParent(b.id) : b;
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
    if(mode==='text'){ const ta=el.querySelector('#conTA'); ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length); }
  }
  function setGuide(g){ guide = g || null; if(el && open) draw(); }
  function close(){ open=false; if(el) el.classList.add('hidden'); }
  function isOpen(){ return open; }

  function run(){
    if(mode==='text'){
      const r=parse(typed);
      if(r.error){
        hint(t('Line {n}',{n:r.error.line})+': '+r.error.msg, 'err');
        if(window.beep) beep('bad');
        return;
      }
      script=r.script; dropTarget=null;
    }
    const steps=compile(script);
    const real=steps.filter(s=>!s.name.startsWith('__'));
    if(!real.length){
      hint(t('Write at least one instruction first.'), 'err');
      if(window.beep) beep('bad');
      return;
    }
    if(budget && countBlocks()>budget){
      hint(t('That is {a} blocks — the budget is {b}.',{a:countBlocks(),b:budget}), 'err');
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
  function clear(){ script=[]; typed=''; dropTarget=null; if(el) draw(); }

  return { show, close, isOpen, setPalette, setBudget, setConditions, setGrid, setGuide, setMode, parse,
           countBlocks, compile, toText, highlight, setIter, hideTape, clear,
           get mode(){ return mode; },
           get script(){ return script; },
           set onRun(fn){ onRun=fn; } };
})();
