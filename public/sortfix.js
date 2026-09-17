/* =====================================================================
   THE BELT PANEL — one expression, and a log that answers back.

   ONE QUESTION ON THE SCREEN, which is the same rule shipfix.js is built
   to: the Mechanic's sentence, the expression with its blanks, the words
   that go in them, and the parts the belt has already been judged on.
   Nothing else.

   NOTHING IS DRAGGED AND NOTHING IS ORDERED. A blank is clicked and a
   word is clicked, for the same reason the pre-flight places a word with
   a click — a nine-year-old on a trackpad, in a browser, with a 3D world
   running behind the panel, should not be asked to drag anything.

   THE BELT IS UNDER IT, ALWAYS. Six or seven parts, what your expression
   says about each, and what the Mechanic says. Same two columns as the
   pre-flight's readings and for the same reason: an expression cannot be
   checked by reading it, so the log does the checking and the student
   does the thinking.

   AND WHEN IT COMES APART, THE PIECES ARE SHOWN WORKED. A compound
   expression is the first thing in this game whose answer is not visible
   in any one part of it — `cracked or heat > 900` on a cool cracked part
   is YES because of a word at one end and not the other. So the panel
   takes one wrong part and writes the expression out again with every
   piece replaced by what it actually came out as. It never says which
   word is wrong; that is the student's to find.
   ===================================================================== */
window.SORTFIX = (function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const say = (s,p) => (window.t ? t(s,p) : s);
  const S = () => window.SORTER;
  const K = () => window.KLOGIC;
  const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  let ui=null, state=null, opts=null, open=false, done=false;
  let at=0;              // which job is on screen
  let armed=null;        // the blank a word would land in
  let note=null;
  let passed={};

  const job = () => S().JOBS[at];

  function dom(){
    if(ui) return ui;
    const css=document.createElement('style');
    css.textContent=`
      #sortfix{position:fixed;inset:0;z-index:70;display:flex;align-items:center;
               justify-content:center;background:#0b0a12ee;
               font:400 15px/1.5 system-ui,sans-serif;color:#eae6f5}
      #sortfix.hidden{display:none}
      .sxwrap{width:min(620px,calc(100vw - 32px));max-height:calc(100vh - 48px);
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
      .sxsays{font-size:19px;line-height:1.45;color:#f4f0ff;margin:0 0 18px}

      /* ---- the expression, big, in the middle ---- */
      .sxexpr{display:flex;align-items:center;justify-content:center;gap:9px;
              flex-wrap:wrap;background:#1b1729;border:2px solid #3b3158;
              border-radius:14px;padding:17px 14px;
              font:400 21px/1.4 ui-monospace,monospace;color:#e6e0f5}
      .sxg{color:#8fd3ff} .sxn{color:#ffd8a8} .sxp{color:#7f74a0}
      .sxkw{color:#ffb4a2;font-weight:700}
      .sxslot{min-width:56px;height:36px;border-radius:9px;border:2px dashed #7a6aa8;
              background:#120f1c;color:#a8e6cf;cursor:pointer;
              font:700 19px/1 ui-monospace,monospace;display:inline-flex;
              align-items:center;justify-content:center;padding:0 10px}
      .sxslot.full{border-style:solid;background:#241f38;border-color:#6b5f8f}
      .sxslot.join{color:#ffb4a2}
      .sxslot:hover{border-color:#a8e6cf}
      .sxslot.armed{outline:3px solid #ffd8a8;outline-offset:2px;
                    animation:sxring 1.4s ease-in-out infinite}
      @keyframes sxring{50%{outline-color:#ffd8a866}}

      /* ---- the words ---- */
      .sxbank{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 0;justify-content:center}
      /* THE BANK IS THREE NAMED GROUPS. Laid out as a row of columns so
         the three kinds of word are three things and not one long line of
         chips a student has to sort by eye. */
      .sxbanks{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;
               align-items:flex-start;margin:10px 0 2px}
      .sxgroup{display:flex;flex-direction:column;gap:5px;align-items:center;
               padding:6px 10px;border-radius:12px;border:1px solid transparent;
               transition:opacity .18s,border-color .18s}
      .sxgroup.dim{opacity:.38}
      .sxgroup:not(.dim){border-color:#4a3f72;background:#1b1730}
      .sxglabel{font-size:11px;letter-spacing:.12em;text-transform:uppercase;
      .sxhint{font-style:normal;font-size:10px;letter-spacing:.1em;
              text-transform:uppercase;color:#6f6796}
      .sxslot.armed .sxhint{color:#cbbe8a}
                color:#9c93c4}
      .sxc{border:2px solid #4a3f72;background:#241f38;border-radius:9px;
           padding:8px 14px;cursor:pointer;color:#eae6f5;
           font:700 16px/1 ui-monospace,monospace}
      .sxc:hover{border-color:#a8e6cf}
      .sxc.join{color:#ffb4a2}

      .sxnote{margin:12px 0 0;padding:9px 12px;border-radius:9px;
              background:#3a2230;border:2px solid #ff9aa2;color:#ffd3d8;font-size:14px}
      .sxhint{margin:13px 0 0;color:#b9aed6;font-size:14px;text-align:center}

      /* ---- the expression, worked, on the part it gets wrong ---- */
      .sxwork{margin:14px 0 0;padding:11px 13px;border-radius:10px;
              background:#332a1c;border:2px solid #ffd8a8;color:#ffe9c9}
      .sxwork .lead{font-size:13.5px;color:#e8d3ae;margin-bottom:7px}
      .sxwork .row{display:flex;gap:7px;flex-wrap:wrap;align-items:center;
                   font:400 16px/1.7 ui-monospace,monospace}
      .sxpiece{background:#241d10;border:1px solid #6b5a38;border-radius:7px;padding:2px 8px}
      .sxpiece i{font-style:normal;font-weight:700;margin-left:6px}
      .sxyes i{color:#a8e6cf} .sxno i{color:#ff9aa2}
      .sxwork .out{margin-left:auto;font-weight:700}

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
     THE EXPRESSION OFF ITS OWN TREE, so the thing on screen and the thing
     KLOGIC evaluates are one statement. A hole is a button; anything
     already written is text. */
  function exprHTML(n){
    if(!n || typeof n!=='object') return '';
    /* A hole where the joining word goes: the two sides are written and
       what holds them together is the question. */
    if(typeof n.k==='string' && n.k[0]==='#')
      return exprHTML(n.a) + slot(n.k, 'join') + exprHTML(n.b);
    if(n.k==='and' || n.k==='or')
      return exprHTML(n.a) + `<span class="sxkw">${n.k}</span>` + exprHTML(n.b);
    if(n.k==='not')
      return `<span class="sxkw">not</span><span class="sxp">(</span>`
           + exprHTML(n.a) + `<span class="sxp">)</span>`;
    if(n.k==='var') return `<span class="sxg">${esc(n.v)}</span>`;
    if(n.k==='cmp')
      return piece(n.v,'gauge','sxg') + piece(n.op,'op','') + piece(n.n,'n','sxn');
    return '';
  }
  const piece = (v, kind, cls) =>
    (typeof v==='string' && v[0]==='#') ? slot(v, kind)
                                        : `<span class="${cls}">${esc(v)}</span>`;
  /* What each kind of blank is called, in words a nine-year-old has. It
     names the blank AND the group of words that fits it, so the two are
     the same two words in both places. */
  const KIND = { op:'is it',     n:'how much',
                 join:'joined by', gauge:'which dial' };

  /* AN EMPTY BLANK SAYS WHAT IT WANTS. Three dashed boxes in a row are
     three identical dashed boxes: nothing on screen said that the first
     took a comparison, the second a number and the third `and` or `or`,
     so the only way to find out was to click one and watch the word list
     change. The placeholder is the same phrase that heads that word's
     group in the bank below, so the blank and the words that fit it are
     labelled with the same two words. */
  function slot(h, kind){
    const got=(state.fill||{})[h];
    const has = got!==undefined && got!==null && got!=='';
    const hint = KIND[kind] || '';
    return `<button class="sxslot ${kind==='join'?'join':''}${has?' full':''}${armed===h?' armed':''}"
              data-slot="${esc(h)}">${has ? esc(got)
                : (hint ? `<i class="sxhint">${say(hint)}</i>` : '&nbsp;')}</button>`;
  }

  /* THE WORDS for whichever blank is armed, and only the ones that could
     go in it. A gauge offered for a number blank is not a wrong answer,
     it is a category error, and offering it would be offering nonsense. */
  /* EVERY WORD THE JOB WANTS, GROUPED AND NAMED.

     This used to show the choices for the ARMED blank and nothing else,
     which is why the panel was unreadable. A student opened the first job
     and saw `heat ? [ ] [ ] not (cracked)` with three numbers under it —
     200, 400, 900 — and no way to know that one of those blanks wanted a
     comparison and the other wanted `and` or `or`. The list changed shape
     under them as the ring moved, so the two words that are the entire
     lesson of this level were never on screen at the same time.

     THREE NAMED GROUPS, ALWAYS ALL THERE. Which one is live depends on
     the ringed blank; the others stay visible and dimmed, because seeing
     that there IS a choice of joining word is most of knowing you have to
     make one. The names say what kind of thing each group is — a nine
     year old has no word for "operator" and does not need one. */
  function bankHTML(j){
    const hs=S().holes(j);
    if(!hs.length) return '';
    const arm=hs.find(x=>x.slot===armed);
    /* One group per KIND, in the order the blanks appear, with the
       choices merged — two number blanks in one job are one list of
       numbers, not the same list printed twice. */
    const groups=[];
    hs.forEach(h=>{
      let g=groups.find(x=>x.kind===h.kind);
      if(!g){ g={ kind:h.kind, choices:[] }; groups.push(g); }
      h.choices.forEach(c=>{ if(!g.choices.includes(c)) g.choices.push(c); });
    });
    return `<div class="sxbanks">` + groups.map(g=>{
      const live = !arm || arm.kind===g.kind;
      return `<div class="sxgroup${live?'':' dim'}">`
        + `<div class="sxglabel">${say(KIND[g.kind]||g.kind)}</div>`
        + `<div class="sxbank">` + g.choices.map(c=>
            `<button class="sxc ${g.kind==='join'?'join':''}"`
          + ` data-chip="${esc(c)}" data-kind="${esc(g.kind)}">${esc(c)}</button>`
          ).join('') + `</div></div>`;
    }).join('') + `</div>`;
  }

  /* THE EXPRESSION WORKED OUT ON ONE PART. sorter.js decides whether
     there is anything to show and what the pieces came out as; this only
     draws them. */
  function workHTML(j){
    const w=S().why(j, state);
    if(!w) return '';
    const gauges=j.vars.map(g=>`${g} ${w.part[g]===undefined?'?'
        : (g==='cracked' ? (w.part[g]?say('yes'):say('no')) : w.part[g])}`).join(', ');
    const row=w.parts.map(p=>{
      if(p.join) return `<span class="sxkw">${esc(p.join)}</span>`;
      if(p.close) return `<span class="sxp">)</span>`
        + `<i class="${p.value?'sxyes':'sxno'}" style="font-style:normal;font-weight:700">`
        + ` ${p.value?say('YES'):say('NO')}</i>`;
      if(p.open) return `<span class="sxkw">${esc(p.text)}</span><span class="sxp">(</span>`;
      return `<span class="sxpiece ${p.value?'sxyes':'sxno'}">${esc(p.text)}`
           + `<i>${p.value?say('YES'):say('NO')}</i></span>`;
    }).join(' ');
    return `<div class="sxwork">
      <div class="lead">${say('With {g}, your rule says {a}. He says {b}.',
        { g:gauges, a:w.got?say('TAKE'):say('LEAVE'), b:w.want?say('TAKE'):say('LEAVE') })}</div>
      <div class="row">${row}</div></div>`;
  }

  function beltHTML(j){
    const rs=S().rows(j, state), gauges=j.vars;
    return `<table class="sxbelt"><tr>`
      + gauges.map(g=>`<th>${esc(g)}</th>`).join('')
      + `<th>${say('your rule')}</th><th>${say('he says')}</th></tr>`
      + rs.map(r=>`<tr class="${r.blank?'r-idle':r.ok?'r-ok':'r-no'}">`
        + gauges.map(g=>`<td>${r.part[g]===undefined?'—'
            : (g==='cracked' ? (r.part[g]?say('yes'):say('no')) : r.part[g])}</td>`).join('')
        + `<td>${r.got===null ? '—' : (r.got?say('TAKE'):say('LEAVE'))}</td>`
        + `<td>${r.want?say('TAKE'):say('LEAVE')}${r.ok?'  ✓':''}</td></tr>`).join('')
      + `</table>`;
  }

  function dots(){
    const u=dom(), J=S().JOBS;
    u.dots.innerHTML = J.map((j,i)=>
      `<span class="sxdot${passed[j.id]?' done':''}${i===at?' at':''}"></span>`).join('');
  }

  function draw(){
    const u=dom(), j=job();
    if(!j) return;
    const work=workHTML(j);

    u.body.innerHTML =
      `<div class="sxsys">${esc(j.name)}</div>` +
      `<p class="sxsays">${esc(say(j.says))}</p>` +
      `<div class="sxexpr">${exprHTML(j.form)}</div>` +
      bankHTML(j) +
      (note ? `<div class="sxnote">${esc(note)}</div>` : '') +
      (!note && work ? work : '') +
      (!note && !work ? `<div class="sxhint">${esc(say(j.hint))}</div>` : '') +
      beltHTML(j);

    u.body.querySelectorAll('[data-slot]').forEach(b=>{
      b.onclick=()=>{
        const k=b.dataset.slot;
        /* A filled blank clicked again empties itself, which is the only
           way back out of a word you have changed your mind about. */
        if((state.fill||{})[k]!==undefined){
          const f=Object.assign({}, state.fill); delete f[k];
          state=Object.assign({}, state, { fill:f }); armed=k;
        }
        /* AN EMPTY BLANK CLICKED IS AN EMPTY BLANK ARMED, even when it is
           the one already ringed. It used to toggle: place a word, the
           next blank arms itself and starts flashing, and clicking the
           flashing thing — which is the one obvious move — put the word
           list away. Nothing says "click me" like a ring that pulses, and
           nothing is less deserved than being punished for it. */
        else armed = k;
        note=null; draw();
      };
    });
    u.body.querySelectorAll('[data-chip]').forEach(b=>{
      b.onclick=()=>place(b.dataset.chip, b.dataset.kind);
    });

    const ok=S().done(j, state), last = at===S().JOBS.length-1;
    u.go.classList.toggle('gone', !ok);
    if(ok && !done) u.go.textContent = last ? say('DONE') : say('NEXT →');
    dots();
  }

  /* `kind` comes off the chip, because the bank shows all three groups
     now and a word may be clicked while a blank of some other kind is
     ringed. A word knows what kind of blank it belongs in, so it goes to
     one: the ringed blank if that fits, otherwise the first blank of its
     own kind that is still empty, otherwise the first of its kind at all.

     THE ALTERNATIVE WAS TO REFUSE IT, and refusing a click on a word the
     panel is showing you is the panel's fault, not the student's. */
  function place(chip, kind){
    const j=job();
    const hs=S().holes(j);
    let h = armed ? hs.find(x=>x.slot===armed) : null;
    if(kind && (!h || h.kind!==kind)){
      const fill=state.fill||{};
      h = hs.find(x=>x.kind===kind && fill[x.slot]===undefined)
       || hs.find(x=>x.kind===kind)
       || h;
      if(h) armed=h.slot;
    }
    if(!h){ note=say('Click one of the blanks first.'); draw(); return; }
    /* Numbers arrive as text off a data attribute and have to go back in
       as numbers, or `heat < "900"` compares a gauge to a string and the
       whole expression quietly stops meaning anything. */
    const v = h.kind==='n' ? Number(chip) : chip;
    const f=Object.assign({}, state.fill||{}); f[armed]=v;
    state=Object.assign({}, state, { fill:f });
    note=null;
    /* On to the next empty blank, so a three-blank expression is three
       clicks rather than three clicks and two hunts. */
    const rest=S().holes(j).map(x=>x.slot).filter(sl=>(state.fill||{})[sl]===undefined);
    armed = rest[0] || null;
    draw();
  }

  function forward(){
    const J=S().JOBS, j=job();
    if(!S().done(j, state)) return;
    passed[j.id]=true;
    if(at < J.length-1){
      at++; state=S().blank(); armed=null; note=null;
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
    state=S().blank();
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
