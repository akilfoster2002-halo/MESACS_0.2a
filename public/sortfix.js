/* =====================================================================
   THE BELT PANEL — a ladder you can move, and a log that answers back.

   NOTHING IS DRAGGED. A branch moves with an arrow beside it, for the
   same reason shipfix.js places a word with a click: a nine-year-old on a
   trackpad, in a browser, with a 3D world running behind the panel,
   should not be asked to drag anything. Two buttons per line and the
   ladder is in any order you like.

   THE LADDER IS NUMBERED AND THE NUMBERS MATTER. `if` on top, `elif`
   under it, `else` pinned at the bottom — drawn from the order the
   student actually built rather than from the order they were written in,
   so the thing on screen and the thing being run are one ladder.

   THE BELT IS UNDER IT, ALWAYS. Five or six parts, what your ladder does
   with each, and what the Mechanic says should happen. Same two columns
   as the pre-flight's readings and for the same reason: a rule cannot be
   checked by reading it, so the log does the checking and the student
   does the thinking.

   AND ONE SENTENCE ABOUT SHADOWING, WHEN IT IS EARNED. A line that can
   never run is invisible — it is right there, spelled correctly, doing
   nothing — so when the belt disagrees and sorter.js can name a line
   nothing ever reaches, the panel says which line and stops. It is the
   only thing this console volunteers, and it is the one mistake worth
   volunteering about.
   ===================================================================== */
window.SORTFIX = (function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const say = (s,p) => (window.t ? t(s,p) : s);
  const S = () => window.SORTER;
  const K = () => window.KLOGIC;
  const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  let ui=null, state=null, opts=null, open=false, done=false;
  let at=0;              // which job is on screen
  let armed=null;        // the blank a chip would land in
  let note=null;

  const job = () => S().JOBS[at];

  function dom(){
    if(ui) return ui;
    const css=document.createElement('style');
    css.textContent=`
      #sortfix{position:fixed;inset:0;z-index:70;display:flex;align-items:center;
               justify-content:center;background:#0b0a12ee;
               font:400 15px/1.5 system-ui,sans-serif;color:#eae6f5}
      #sortfix.hidden{display:none}
      .sxwrap{width:min(660px,calc(100vw - 32px));max-height:calc(100vh - 48px);
              background:#15121f;border:2px solid #6b5f8f;border-radius:18px;
              box-shadow:0 24px 70px #000b;display:flex;flex-direction:column;overflow:hidden}
      .sxhead{display:flex;align-items:center;gap:12px;padding:12px 18px;
              background:#1e1930;border-bottom:2px solid #3b3158}
      .sxhead b{font:700 13px/1 ui-monospace,monospace;letter-spacing:.11em;
                text-transform:uppercase;color:#ffd8a8}
      .sxdots{margin-left:auto;display:flex;gap:5px}
      .sxdot{width:9px;height:9px;border-radius:50%;background:#3b3158}
      .sxdot.done{background:#a8e6cf} .sxdot.at{background:#ffd8a8;box-shadow:0 0 0 3px #ffd8a833}

      .sxbody{padding:18px 20px 16px;overflow:auto}
      .sxsys{font:700 12px/1 ui-monospace,monospace;letter-spacing:.14em;
             text-transform:uppercase;color:#a396c4;margin-bottom:7px}
      .sxsays{font-size:19px;line-height:1.45;color:#f4f0ff;margin:0 0 16px}

      /* ---- the ladder ---- */
      .sxrung{display:flex;align-items:center;gap:10px;margin:0 0 7px;
              background:#1b1729;border:2px solid #3b3158;border-radius:12px;
              padding:9px 11px;font:400 17px/1.35 ui-monospace,monospace}
      .sxrung.els{border-style:dashed;color:#b9aed6}
      .sxmv{display:flex;flex-direction:column;gap:3px}
      .sxmv button{width:26px;height:19px;border:0;border-radius:6px;cursor:pointer;
                   background:#3b3158;color:#eae6f5;font:700 11px/1 ui-monospace,monospace}
      .sxmv button:hover{background:#574a7f}
      .sxmv button:disabled{opacity:.25;cursor:default}
      .sxkw{color:#ffb4a2;font-weight:700}
      .sxact{margin-left:auto;font-weight:700;letter-spacing:.06em}
      .sxcond{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
      .sxg{color:#8fd3ff} .sxn{color:#ffd8a8} .sxp{color:#7f74a0}
      .sxslot{min-width:54px;height:32px;border-radius:8px;border:2px dashed #7a6aa8;
              background:#120f1c;color:#a8e6cf;cursor:pointer;
              font:700 16px/1 ui-monospace,monospace;display:inline-flex;
              align-items:center;justify-content:center;padding:0 9px}
      .sxslot.full{border-style:solid;background:#241f38;border-color:#6b5f8f}
      .sxslot:hover{border-color:#a8e6cf}
      .sxslot.armed{outline:3px solid #ffd8a8;outline-offset:2px;
                    animation:sxring 1.4s ease-in-out infinite}
      @keyframes sxring{50%{outline-color:#ffd8a866}}

      /* ---- the chips ---- */
      .sxbank{display:flex;gap:6px;flex-wrap:wrap;margin:13px 0 0}
      .sxc{border:2px solid #4a3f72;background:#241f38;border-radius:9px;
           padding:7px 12px;cursor:pointer;color:#eae6f5;
           font:700 15px/1 ui-monospace,monospace}
      .sxc:hover{border-color:#a8e6cf}
      .sxc.dim{opacity:.26}

      .sxnote{margin:12px 0 0;padding:9px 12px;border-radius:9px;
              background:#3a2230;border:2px solid #ff9aa2;color:#ffd3d8;font-size:14px}
      /* THE SHADOW LINE. Its own colour, because it is not "you got a
         number wrong" — it is "this line cannot ever run", which is a
         different kind of news. */
      .sxdead{margin:12px 0 0;padding:10px 13px;border-radius:10px;
              background:#332a1c;border:2px solid #ffd8a8;color:#ffe9c9;font-size:15px}
      .sxdead b{color:#fff}
      .sxhint{margin:12px 0 0;color:#b9aed6;font-size:14px;text-align:center}

      /* ---- the belt ---- */
      .sxbelt{margin:16px 0 0;border-collapse:collapse;width:100%;
              font:400 15px/1.55 ui-monospace,monospace}
      .sxbelt th{color:#a396c4;font-weight:600;text-align:left;text-transform:uppercase;
                 letter-spacing:.08em;font-size:10.5px;padding:0 10px 5px 0;
                 font-family:system-ui,sans-serif}
      .sxbelt td{padding:4px 10px 4px 0;border-top:1px solid #3b3158}
      .sxbelt tr.r-ok td{color:#a8e6cf}
      .sxbelt tr.r-no td{color:#ff9aa2;font-weight:700}
      .sxbelt tr.r-idle td{color:#6f6590}

      .sxfoot{display:flex;gap:10px;align-items:center;padding:13px 20px;
              background:#120f1c;border-top:2px solid #3b3158}
      .sxbtn{border:0;border-radius:11px;padding:12px 22px;cursor:pointer;
             font:700 14px/1 ui-monospace,monospace;letter-spacing:.08em}
      .sxgo{background:#a8e6cf;color:#0b2a1e;margin-left:auto}
      .sxout{background:#2b2440;color:#d6cfe8}
      .sxgo.gone{display:none}
      .sxbtn:disabled{opacity:.55;cursor:default}`;
    document.head.appendChild(css);

    const el=document.createElement('div');
    el.id='sortfix'; el.className='hidden';
    el.innerHTML=`<div class="sxwrap">
      <div class="sxhead"><b>${say('THE MECHANIC')} · ${say('the belt')}</b>
        <span class="sxdots" id="sxdots"></span></div>
      <div class="sxbody" id="sxbody"></div>
      <div class="sxfoot">
        <button class="sxbtn sxout" id="sxshut">${say('CLOSE')}</button>
        <button class="sxbtn sxgo gone" id="sxgo"></button>
      </div></div>`;
    document.body.appendChild(el);
    ui={ el, body:$('#sxbody',el), dots:$('#sxdots',el),
         go:$('#sxgo',el), shut:$('#sxshut',el) };
    ui.shut.onclick=()=>close();
    ui.go.onclick=()=>forward();
    return ui;
  }

  /* --------------------------------------------------------- drawing
     THE LADDER AS THE STUDENT BUILT IT, not as it was written down. The
     order comes out of the state, the keyword comes out of the position,
     and a condition is drawn off its own tree so what is on screen and
     what KLOGIC walks are one statement. */
  function condHTML(n){
    if(!n) return '';
    if(n.k==='var') return `<span class="sxg">${esc(n.v)}</span>`;
    if(n.k==='not') return `<span class="sxp">not (</span>${condHTML(n.a)}<span class="sxp">)</span>`;
    if(n.k==='and' || n.k==='or')
      return `${condHTML(n.a)} <span class="sxkw">${n.k}</span> ${condHTML(n.b)}`;
    if(n.k==='cmp')
      return slot(n.v,'gauge','sxg') + slot(n.op,'op','') + slot(n.n,'n','sxn');
    return '';
  }
  /* A hole is a button; anything already written is just text. */
  function slot(v, kind, cls){
    if(typeof v==='string' && v[0]==='#'){
      const got=(state.fill||{})[v];
      return `<button class="sxslot ${got?'full':''}${armed===v?' armed':''}"
                data-slot="${esc(v)}" data-kind="${kind}">${got!==undefined&&got!==null&&got!==''?esc(got):'&nbsp;'}</button>`;
    }
    return `<span class="${cls}">${esc(v)}</span>`;
  }

  function ladderHTML(j){
    const order=(state.order||j.branches.map((_,i)=>i));
    const isElse = i => j.branches[i] && j.branches[i].kind==='else';
    const body=order.filter(i=>!isElse(i)), tail=order.filter(isElse);
    const movable = j.kind!=='fill';
    let out='';
    body.forEach((bi,pos)=>{
      const b=j.branches[bi];
      out+=`<div class="sxrung">
        ${movable ? `<span class="sxmv">
          <button data-up="${pos}" ${pos===0?'disabled':''}>&#9650;</button>
          <button data-dn="${pos}" ${pos===body.length-1?'disabled':''}>&#9660;</button>
        </span>` : ''}
        <span class="sxkw">${pos===0?'if':'elif'}</span>
        <span class="sxcond">${condHTML(b.cond)}</span>
        <span class="sxp">:</span>
        <span class="sxact" style="color:${tintOf(b.action)}">${esc(b.action)}</span>
      </div>`;
    });
    tail.forEach(bi=>{
      const b=j.branches[bi];
      out+=`<div class="sxrung els">
        ${movable ? `<span class="sxmv"><button disabled>&#9650;</button><button disabled>&#9660;</button></span>` : ''}
        <span class="sxkw">else</span><span class="sxp">:</span>
        <span class="sxact" style="color:${tintOf(b.action)}">${esc(b.action)}</span>
      </div>`;
    });
    return out;
  }
  const tintOf = id => { const b=S().BINS.find(x=>x.id===id); return b?b.tint:'#eae6f5'; };

  /* THE CHIPS for whichever blank is armed. Only the ones that could go in
     it — a gauge chip in a number blank is not a wrong answer, it is a
     category error, and offering it would be offering nonsense. */
  function bankHTML(j){
    if(!armed) return '';
    const h=S().holes(j).find(x=>x.slot===armed);
    if(!h) return '';
    return `<div class="sxbank">` + h.choices.map(c=>
      `<button class="sxc" data-chip="${esc(c)}">${esc(c)}</button>`).join('') + `</div>`;
  }

  function beltHTML(j){
    const rs=S().rows(j, state);
    const gauges=j.vars;
    return `<table class="sxbelt"><tr>`
      + gauges.map(g=>`<th>${esc(g)}</th>`).join('')
      + `<th>${say('your ladder')}</th><th>${say('should be')}</th></tr>`
      + rs.map(r=>`<tr class="${r.blank?'r-idle':r.ok?'r-ok':'r-no'}">`
        + gauges.map(g=>`<td>${r.part[g]===undefined?'—'
            : (g==='cracked' ? (r.part[g]?say('yes'):say('no')) : r.part[g])}</td>`).join('')
        + `<td>${r.got || '—'}</td>`
        + `<td>${r.want}${r.ok?'  ✓':''}</td></tr>`).join('')
      + `</table>`;
  }

  function dots(){
    const u=dom(), J=S().JOBS;
    u.dots.innerHTML = J.map((j,i)=>
      `<span class="sxdot${S().done(j,stateFor(i))?' done':''}${i===at?' at':''}"></span>`).join('');
  }
  /* Only the job on screen has live state; the others are drawn as
     unfinished unless they have already been passed. */
  let passed={};
  const stateFor = i => i===at ? state : (passed[S().JOBS[i].id] || S().blank(S().JOBS[i]));

  function draw(){
    const u=dom(), j=job();
    if(!j) return;
    const d=S().dead(j, state), m=S().miss(j, state);

    u.body.innerHTML =
      `<div class="sxsys">${esc(j.name)}</div>` +
      `<p class="sxsays">${esc(say(j.says))}</p>` +
      ladderHTML(j) +
      bankHTML(j) +
      (note ? `<div class="sxnote">${esc(note)}</div>` : '') +
      (!note && d ? `<div class="sxdead">${say('Nothing ever reaches')}
          <b>${esc(d.text)} → ${esc(d.action)}</b>. ${say('Something above it catches those first.')}</div>` : '') +
      (!note && !d && m ? `<div class="sxhint">${say('Look at the red line.')}</div>` : '') +
      (!note && !d && !m ? `<div class="sxhint">${esc(say(j.hint))}</div>` : '') +
      beltHTML(j);

    u.body.querySelectorAll('[data-up]').forEach(b=>{
      b.onclick=()=>{ const p=+b.dataset.up; state=S().move(j,state,p,p-1); note=null; draw(); };
    });
    u.body.querySelectorAll('[data-dn]').forEach(b=>{
      b.onclick=()=>{ const p=+b.dataset.dn; state=S().move(j,state,p,p+1); note=null; draw(); };
    });
    u.body.querySelectorAll('[data-slot]').forEach(b=>{
      b.onclick=()=>{
        const k=b.dataset.slot;
        /* A filled blank clicked again empties itself, which is the only
           way back out of an answer you have changed your mind about. */
        if((state.fill||{})[k]!==undefined){
          const f=Object.assign({}, state.fill); delete f[k];
          state=Object.assign({}, state, { fill:f }); armed=k;
        } else armed = armed===k ? null : k;
        note=null; draw();
      };
    });
    u.body.querySelectorAll('[data-chip]').forEach(b=>{
      b.onclick=()=>{ place(b.dataset.chip); };
    });

    const ok=S().done(j, state), last = at===S().JOBS.length-1;
    u.go.classList.toggle('gone', !ok);
    if(ok && !done) u.go.textContent = last ? say('DONE') : say('NEXT →');
    dots();
  }

  function place(chip){
    const j=job();
    if(!armed){ note=say('Click one of the blanks first.'); draw(); return; }
    const h=S().holes(j).find(x=>x.slot===armed);
    if(!h) return;
    /* Numbers arrive as text off a data attribute and have to go back in
       as numbers, or `heat >= "800"` compares a gauge to a string and the
       whole ladder quietly stops meaning anything. */
    const v = h.kind==='n' ? Number(chip) : chip;
    const f=Object.assign({}, state.fill||{}); f[armed]=v;
    state=Object.assign({}, state, { fill:f });
    note=null;
    const rest=S().holes(j).map(x=>x.slot).filter(sl=>(state.fill||{})[sl]===undefined);
    armed = rest[0] || null;
    draw();
  }

  function forward(){
    const J=S().JOBS, j=job();
    if(!S().done(j, state)) return;
    passed[j.id]=state;
    if(at < J.length-1){
      at++; state=S().blank(J[at]); armed=null; note=null;
      draw();
      try{ dom().body.scrollTop=0; }catch(e){}
      return;
    }
    if(done) return;
    done=true;
    const u=dom();
    u.go.disabled=true;
    u.go.textContent=say('PAID');
    setTimeout(()=>{ close(); if(opts && opts.onDone) opts.onDone(); }, 900);
  }

  function openIt(o){
    if(open) return;
    if(!S() || !K()){ console.warn('SORTFIX: sorter.js or logic.js is not loaded'); return; }
    opts=o||{}; open=true; done=false; at=0; armed=null; note=null; passed={};
    state=S().blank(S().JOBS[0]);
    const u=dom();
    u.el.classList.remove('hidden');
    u.go.disabled=false;
    draw();
    try{ u.body.scrollTop=0; }catch(e){}
    if(document.pointerLockElement) document.exitPointerLock();
    G.running=false;
  }

  function close(){
    if(!open) return;
    open=false;
    if(ui) ui.el.classList.add('hidden');
    G.running=true;
  }

  return { open:openIt, close, get active(){ return open; },
           get state(){ return state; }, get at(){ return at; } };
})();
