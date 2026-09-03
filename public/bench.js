/* =====================================================================
   BENCH — the workbench you build from, without leaving the world.

   Deliberately not a coding mode. The panels dock to the edges, the
   world keeps running behind them, the machine you are writing for is
   three feet away and still turning. Build → Connect → Program → Run →
   Observe happens in one place, and RUN never takes you anywhere.

   Mouse look is released while the bench is open, because you need the
   pointer for the panels — so you place where you CLICK rather than
   where a crosshair happens to point, and the arrow keys still turn you.
   ===================================================================== */
window.BENCH = (function(){
  const $=s=>document.querySelector(s);
  let open=false, armed=null, sel=null, linking=false, editing=null;
  const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();

  /* ------------------------------------------------------------ chrome */
  function show(){
    if(open) return;
    open=true;
    if(document.pointerLockElement) document.exitPointerLock();
    $('#bench').classList.remove('hidden');
    document.querySelector('#objectives').classList.add('hidden');
    render();
  }
  function hide(){
    open=false; armed=null; linking=false;
    $('#bench').classList.add('hidden');
    document.querySelector('#objectives').classList.remove('hidden');
  }
  function toggle(){ open?hide():show(); }

  /* ------------------------------------------------------------ palette */
  function palette(){
    const el=$('#bPal');
    el.innerHTML=`<div class="bhead">${t('PARTS')}</div>` +
      PARTS.CATS.map(c=>`
        <div class="bcat" style="--a:${c.a}">
          <div class="bcatname">${c.em} ${t(c.name)}</div>
          <div class="bgrid">${PARTS.inCat(c.id).map(p=>`
            <button class="btile${armed===p.id?' on':''}" data-p="${p.id}"
                    title="${t(p.help)}" style="--a:${c.a}">
              <span class="bem">${p.em}</span><span>${t(p.name)}</span>
              ${p.live?'':`<i class="binert" title="${t('Places and wires, but does not move yet')}">•</i>`}
            </button>`).join('')}</div>
        </div>`).join('');
    el.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{
      armed = armed===b.dataset.p ? null : b.dataset.p;
      linking=false; palette(); hint();
    });
  }

  /* ---------------------------------------------------------- inspector */
  function inspector(){
    const el=$('#bInsp');
    if(!sel){
      el.innerHTML=`<div class="bhead">${t('PART')}</div>
        <p class="bnote">${t('Click a part in the world to select it.')}</p>`;
      return;
    }
    const d=SANDBOX.def(sel);
    const machine=SANDBOX.machineOf(sel).length;
    const props=Object.keys(sel.props);
    el.innerHTML=`<div class="bhead">${t('PART')}</div>
      <input class="bname" id="bName" value="${esc(sel.name)}" maxlength="20">
      <div class="bnote">${d.em} ${t(d.name)} · ${t('{n} parts in this machine',{n:machine})}</div>
      ${d.live?'':`<div class="bwarn">${t('Places and wires, but does not move yet')}</div>`}
      <div class="bnote">${t(d.help)}</div>
      <div class="bstate">${t('Power')}: <b class="${sel.powered?'yes':'no'}">${sel.powered?t('yes'):t('no')}</b>
        &nbsp; ${t('Output')}: <b>${SANDBOX.outputOf(sel)}</b></div>
      <div class="bhead2">${t('PROPERTIES')}</div>
      ${props.map(k=>propRow(k)).join('') || `<p class="bnote">${t('Nothing to tune.')}</p>`}
      <div class="brow">
        <button class="btn small ghost" id="bLink">${linking?t('Pick a part…'):t('🔗 Connect')}</button>
        <button class="btn small ghost" id="bRot">${t('⟳ Rotate')}</button>
      </div>
      <div class="brow">
        <button class="btn small ghost" id="bDup">${t('Duplicate machine')}</button>
        <button class="btn small ghost" id="bCut">${t('Unwire')}</button>
        <button class="btn small ghost bad" id="bDel">${t('Delete')}</button>
      </div>`;
    $('#bName').onchange=e=>{ SANDBOX.rename(sel,e.target.value); render(); };
    $('#bLink').onclick=()=>{ linking=!linking; armed=null; render(); hint(); };
    $('#bRot').onclick=()=>{ SANDBOX.rotate(sel); render(); };
    $('#bDup').onclick=()=>{ SANDBOX.duplicate(sel); render(); };
    $('#bCut').onclick=()=>{ SANDBOX.unlinkAll(sel); render(); };
    $('#bDel').onclick=()=>{ SANDBOX.remove(sel); sel=null; render(); };
    props.forEach(k=>{
      const i=$('#bp_'+k); if(!i) return;
      i.onchange=e=>{
        const raw=e.target.type==='checkbox' ? e.target.checked
                : (e.target.value!=='' && !isNaN(+e.target.value) ? +e.target.value : e.target.value);
        SANDBOX.setProp(sel,k,raw); render();
      };
    });
  }
  function propRow(k){
    const v=sel.props[k];
    if(k==='reads') return `<label class="bprop"><span>${t(k)}</span>
      <input id="bp_${k}" value="${esc(String(v))}" disabled></label>`;
    if(typeof v==='boolean') return `<label class="bprop"><span>${t(k)}</span>
      <input id="bp_${k}" type="checkbox" ${v?'checked':''}></label>`;
    if(k==='op') return `<label class="bprop"><span>${t(k)}</span>
      <select id="bp_${k}">${['>','<','='].map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join('')}</select></label>`;
    return `<label class="bprop"><span>${t(k)}</span>
      <input id="bp_${k}" value="${esc(String(v))}"></label>`;
  }

  /* ------------------------------------------------------ the programs
     The reason the rest of it exists. WHEN / IF / THEN, in the words the
     spec uses, built out of the parts actually standing in the world. */
  function programs(){
    const el=$('#bProg'), W=SANDBOX.world;
    el.innerHTML=`
      <div class="bhead">${t('BEHAVIOURS')}
        <span class="bspace"></span>
        <button class="btn small ghost" id="bNewFn">${t('+ Reusable')}</button>
        <button class="btn small good" id="bNew">${t('+ Behaviour')}</button>
      </div>
      <div class="bprogs">${
        W.progs.length ? W.progs.map(pr=>progCard(pr)).join('')
        : `<p class="bnote">${t('No behaviour yet. Add one, pick a WHEN, and give it something to do.')}</p>`
      }</div>
      ${W.funcs.length?`<div class="bhead2">${t('REUSABLE')}</div>
        <div class="bprogs">${W.funcs.map((f,i)=>fnCard(f,i)).join('')}</div>`:''}`;
    $('#bNew').onclick=()=>{ SANDBOX.newProgram(); render(); };
    $('#bNewFn').onclick=()=>{
      const n=prompt(t('Name this reusable behaviour'),'combo '+(W.funcs.length+1));
      if(n){ W.funcs.push({name:n.slice(0,20), steps:[]}); SANDBOX.save(); render(); }
    };
    wireProgCards();
  }

  const partOpts = (v)=> `<option value="">${t('choose…')}</option>` +
    SANDBOX.world.parts.map(p=>`<option value="${p.uid}" ${p.uid===v?'selected':''}>${esc(p.name)}</option>`).join('');

  function progCard(pr){
    return `<div class="bcard" data-pr="${pr.id}">
      <div class="bcardtop">
        <input class="bpname" data-f="name" value="${esc(pr.name)}" maxlength="24">
        <label class="bswitch"><input type="checkbox" data-f="enabled" ${pr.enabled?'checked':''}> ${t('on')}</label>
        <button class="bx" data-f="delprog">✕</button>
      </div>
      <div class="bline"><span class="bkw when">WHEN</span>
        <select data-f="whenPart">${partOpts(pr.when.part)}</select>
        <select data-f="whenEvent">${
          [['on',t('turns on')],['off',t('turns off')],
           ['above',t('reads above')],['below',t('reads below')]]
          .map(([v,l])=>`<option value="${v}" ${pr.when.event===v?'selected':''}>${l}</option>`).join('')}</select>
        ${(pr.when.event==='above'||pr.when.event==='below')
          ? `<input class="bnum" data-f="whenValue" value="${esc(String(pr.when.value||0))}">` : ''}
      </div>
      ${pr.ifs.map((c,i)=>`
        <div class="bline"><span class="bkw iff">IF</span>
          <select data-f="ifPart" data-i="${i}">${partOpts(c.part)}</select>
          <select data-f="ifOp" data-i="${i}">${
            [['>','>'],['<','<'],['=','='],['on',t('is on')],['off',t('is off')]]
            .map(([v,l])=>`<option value="${v}" ${c.op===v?'selected':''}>${l}</option>`).join('')}</select>
          ${(c.op==='>'||c.op==='<'||c.op==='=')
            ? `<input class="bnum" data-f="ifValue" data-i="${i}" value="${esc(String(c.value||0))}">`:''}
          <button class="bx" data-f="delif" data-i="${i}">✕</button>
        </div>`).join('')}
      <div class="bline"><span class="bkw then">THEN</span></div>
      ${pr.then.map((s,i)=>stepRow(s,i,'')).join('')}
      <div class="bline badd">
        <button class="btn small ghost" data-f="addif">+ IF</button>
        <button class="btn small ghost" data-f="addset">+ DO</button>
        <button class="btn small ghost" data-f="addwait">+ WAIT</button>
        <button class="btn small ghost" data-f="addrep">+ REPEAT</button>
        ${SANDBOX.world.funcs.length?`<button class="btn small ghost" data-f="addcall">+ CALL</button>`:''}
      </div>
    </div>`;
  }
  function stepRow(s,i,path){
    const key=path+i;
    if(s.do==='wait') return `<div class="bline bstep"><span class="bkw wait">WAIT</span>
      <input class="bnum" data-f="stepMs" data-k="${key}" value="${esc(String(s.ms||1000))}"> ms
      <button class="bx" data-f="delstep" data-k="${key}">✕</button></div>`;
    if(s.do==='call') return `<div class="bline bstep"><span class="bkw call">CALL</span>
      <select data-f="stepName" data-k="${key}">${SANDBOX.world.funcs.map(f=>
        `<option ${f.name===s.name?'selected':''}>${esc(f.name)}</option>`).join('')}</select>
      <button class="bx" data-f="delstep" data-k="${key}">✕</button></div>`;
    if(s.do==='repeat') return `<div class="bline bstep"><span class="bkw rep">REPEAT</span>
      <input class="bnum" data-f="stepTimes" data-k="${key}" value="${esc(String(s.times||2))}"> ×
      <button class="btn small ghost" data-f="addinner" data-k="${key}">+ DO</button>
      <button class="bx" data-f="delstep" data-k="${key}">✕</button>
      <div class="binner">${(s.steps||[]).map((c,j)=>stepRow(c,j,key+'.')).join('')}</div></div>`;
    // the default: set a property on a part
    const p=SANDBOX.byUid(s.part), d=p&&SANDBOX.def(p);
    const settable = d ? PARTS.settable(d) : [];
    return `<div class="bline bstep"><span class="bkw do">DO</span>
      <select data-f="stepPart" data-k="${key}">${partOpts(s.part)}</select>
      <select data-f="stepProp" data-k="${key}">${settable.map(k=>
        `<option ${k===s.prop?'selected':''}>${k}</option>`).join('')}</select>
      <span>=</span>
      <input class="bnum" data-f="stepValue" data-k="${key}" value="${esc(String(s.value===undefined?'true':s.value))}">
      <button class="bx" data-f="delstep" data-k="${key}">✕</button></div>`;
  }
  function fnCard(f,idx){
    return `<div class="bcard" data-fn="${idx}">
      <div class="bcardtop"><b>${esc(f.name)}</b>
        <span class="bspace"></span>
        <button class="btn small ghost" data-f="fnadd">+ DO</button>
        <button class="bx" data-f="delfn">✕</button></div>
      ${(f.steps||[]).map((s,i)=>stepRow(s,i,'f'+idx+'.')).join('')
        || `<p class="bnote">${t('Empty. Add steps, then CALL it from any behaviour.')}</p>`}
    </div>`;
  }

  /* one delegated handler for the whole editor: the cards are rebuilt on
     every change, so per-element listeners would be re-bound constantly */
  function wireProgCards(){
    const el=$('#bProg');
    const prOf = n => SANDBOX.world.progs.find(p=>p.id===+n.closest('[data-pr]').dataset.pr);
    const stepAt = (pr,key)=>{
      const parts=String(key).split('.');
      let list = pr.then, s=null;
      parts.forEach(seg=>{ s=list[+seg]; if(s && s.steps) list=s.steps; });
      return { list, i:+parts[parts.length-1], step:s };
    };
    el.querySelectorAll('[data-f]').forEach(node=>{
      const f=node.dataset.f;
      const ev = (node.tagName==='BUTTON') ? 'onclick' : 'onchange';
      node[ev]=()=>{
        const card=node.closest('[data-pr]');
        const fnCardEl=node.closest('[data-fn]');
        // ---- reusable behaviours
        if(fnCardEl && !card){
          const fn=SANDBOX.world.funcs[+fnCardEl.dataset.fn];
          if(f==='delfn'){ SANDBOX.world.funcs.splice(+fnCardEl.dataset.fn,1); }
          if(f==='fnadd'){ fn.steps.push({do:'set',part:null,prop:'on',value:'true'}); }
          if(f==='stepPart'||f==='stepProp'||f==='stepValue'||f==='stepMs'||f==='delstep'){
            const j=+String(node.dataset.k).split('.').pop();
            if(f==='delstep') fn.steps.splice(j,1);
            else if(f==='stepPart') fn.steps[j].part=+node.value||null;
            else if(f==='stepProp') fn.steps[j].prop=node.value;
            else if(f==='stepValue') fn.steps[j].value=node.value;
            else if(f==='stepMs') fn.steps[j].ms=+node.value||0;
          }
          SANDBOX.save(); render(); return;
        }
        if(!card) return;
        const pr=prOf(node);
        if(f==='name')       pr.name=node.value;
        if(f==='enabled')    pr.enabled=node.checked;
        if(f==='delprog')    SANDBOX.world.progs.splice(SANDBOX.world.progs.indexOf(pr),1);
        if(f==='whenPart')   pr.when.part=+node.value||null;
        if(f==='whenEvent')  pr.when.event=node.value;
        if(f==='whenValue')  pr.when.value=+node.value||0;
        if(f==='addif')      pr.ifs.push({part:null,op:'on',value:0});
        if(f==='delif')      pr.ifs.splice(+node.dataset.i,1);
        if(f==='ifPart')     pr.ifs[+node.dataset.i].part=+node.value||null;
        if(f==='ifOp')       pr.ifs[+node.dataset.i].op=node.value;
        if(f==='ifValue')    pr.ifs[+node.dataset.i].value=+node.value||0;
        if(f==='addset')     pr.then.push({do:'set',part:null,prop:'on',value:'true'});
        if(f==='addwait')    pr.then.push({do:'wait',ms:1000});
        if(f==='addrep')     pr.then.push({do:'repeat',times:2,steps:[]});
        if(f==='addcall')    pr.then.push({do:'call',name:(SANDBOX.world.funcs[0]||{}).name});
        if(f==='addinner'){  const {step}=stepAt(pr,node.dataset.k);
                             if(step) (step.steps=step.steps||[]).push({do:'set',part:null,prop:'on',value:'true'}); }
        if(f==='delstep'){   const {list,i}=stepAt(pr,node.dataset.k); list.splice(i,1); }
        if(f==='stepPart'){  const {list,i}=stepAt(pr,node.dataset.k); list[i].part=+node.value||null; }
        if(f==='stepProp'){  const {list,i}=stepAt(pr,node.dataset.k); list[i].prop=node.value; }
        if(f==='stepValue'){ const {list,i}=stepAt(pr,node.dataset.k); list[i].value=node.value; }
        if(f==='stepMs'){    const {list,i}=stepAt(pr,node.dataset.k); list[i].ms=+node.value||0; }
        if(f==='stepTimes'){ const {list,i}=stepAt(pr,node.dataset.k); list[i].times=+node.value||1; }
        if(f==='stepName'){  const {list,i}=stepAt(pr,node.dataset.k); list[i].name=node.value; }
        SANDBOX.save(); render();
      };
    });
  }

  /* --------------------------------------------------------------- bar */
  function bar(){
    const on=SANDBOX.running;
    $('#bBar').innerHTML=`
      <button class="btn small ${on?'':'good'}" id="bRun">${on?'⏸ '+t('Pause'):'▶ '+t('Run')}</button>
      <span class="bhintbox" id="bHint"></span>
      <span class="bspace"></span>
      <button class="btn small ghost" id="bWipe">${t('Clear world')}</button>
      <button class="btn small ghost" id="bClose">${t('Close')} (B)</button>`;
    $('#bRun').onclick=()=>{ SANDBOX.setRunning(!SANDBOX.running); render(); };
    $('#bClose').onclick=()=>hide();
    $('#bWipe').onclick=()=>{ if(confirm(t('Delete everything you have built?'))){ SANDBOX.wipe(); sel=null; render(); } };
    hint();
  }
  function hint(){
    const h=$('#bHint'); if(!h) return;
    h.textContent = armed  ? t('Click in the world to place it.')
                  : linking? t('Click the part to connect to.')
                  : t('Click a part to select · B closes the bench');
  }
  function render(){ if(!open) return; palette(); inspector(); programs(); bar(); }

  /* ------------------------------------------------------- world clicks */
  function worldClick(e){
    if(!open || !SANDBOX.world) return;
    const r=$('#view').getBoundingClientRect();
    ndc.x = ((e.clientX-r.left)/r.width)*2-1;
    ndc.y = -((e.clientY-r.top)/r.height)*2+1;
    ray.setFromCamera(ndc, G.camera);

    const hit = ray.intersectObjects(G.hits,false)[0];
    const part = hit && hit.object.userData.part;

    if(armed){
      // drop it on whatever is under the pointer, or on the floor
      let x,z,y;
      if(part){ x=part.x; z=part.z; y=part.y+0.9; }
      else {
        const t0=-G.camera.position.y/ray.ray.direction.y;
        if(t0<=0 || !isFinite(t0)) return;
        x=G.camera.position.x+ray.ray.direction.x*t0;
        z=G.camera.position.z+ray.ray.direction.z*t0;
      }
      sel = SANDBOX.place(armed,x,z,y);
      render();
      return;
    }
    if(!part){ sel=null; linking=false; render(); return; }
    if(linking && sel && part!==sel){
      const made=SANDBOX.link(sel,part);
      if(!made) flash(t('Those two do not connect — check the ports.'));
      linking=false; render(); return;
    }
    sel=part; render();
  }
  let flashT=null;
  function flash(msg){
    const h=$('#bHint'); if(!h) return;
    h.textContent=msg; h.classList.add('bad');
    clearTimeout(flashT); flashT=setTimeout(()=>{ h.classList.remove('bad'); hint(); },2200);
  }

  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* the inspector shows live readings, so refresh it gently while open */
  let beat=0;
  function tick(dt){
    if(!open) return;
    beat+=dt;
    if(beat>0.5){ beat=0; inspector(); }
  }

  return { show, hide, toggle, render, tick, worldClick,
           get open(){ return open; } };
})();
