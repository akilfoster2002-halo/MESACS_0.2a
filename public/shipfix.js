/* =====================================================================
   THE E-45'S PRE-FLIGHT PANEL — one question at a time.

   IT USED TO SHOW EVERYTHING AT ONCE. Nine rules down the left, a running
   trace down the right, a step card, a vocabulary line, a refusal line and
   a fourteen-blank counter — all of it on screen while a nine-year-old
   tried to decide between `<` and `<=`. Every one of those was defensible
   on its own and together they were a cockpit. A student looking for where
   to look is not thinking about the question.

   SO THERE IS ONE QUESTION ON THE SCREEN. The system, the rule in one
   short sentence, the rule with its blank in it, the nine words, and the
   three or four readings that decide it. Nothing else. The other eight
   checks are a row of dots.

   AND THE WORDS ARE COUNTED. Every sentence in preflight.js is five to
   nine words; a chip is a symbol and two words; the table headers are two
   words each; the readings answer YES or NO. If a line here needs reading
   twice it is the wrong line.

   ONE CLICK PER ANSWER. The walkthrough already knows which blank is next
   and rings it, so that blank is armed: click a word and it lands there.
   Any blank in the rule on screen can be clicked to take over, and a
   filled blank clicked again empties itself. Nothing is dragged — a
   nine-year-old on a trackpad, in a browser, with a 3D world running
   behind the panel, should not be asked to drag anything.

   A WORD IN THE WRONG KIND OF BLANK IS ANSWERED, NOT REFUSED. These nine
   are three different parts of speech and knowing which is which is most
   of knowing them, so the wrong kind is dimmed before it is clicked and
   explained in one line after. preflight.js writes the line.

   NEXT IS EARNED. The button does not appear until the rule matches every
   reading, so the only way forward is through the question — and arriving
   at it is the moment the check came right, which is worth a button.
   ===================================================================== */
window.SHIPFIX = (function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const say = (s,p) => (window.t ? t(s,p) : s);
  const P = () => window.PREFLIGHT;
  const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  let ui=null, state=null, opts=null, open=false, done=false;
  let armed=null;        // the blank a word would land in
  let note=null;         // the last refusal, if there is one
  let at=0;              // which check is on screen

  function dom(){
    if(ui) return ui;
    const css=document.createElement('style');
    css.textContent=`
      #shipfix{position:fixed;inset:0;z-index:70;display:flex;align-items:center;
               justify-content:center;background:#070a12ee;
               font:400 15px/1.5 system-ui,sans-serif;color:#e9eefb}
      #shipfix.hidden{display:none}
      /* ONE COLUMN, AND NOT A WIDE ONE. This was 1080 across with two
         columns in it; a single question does not need half a screen, and
         a narrow measure is easier to read. */
      .sfwrap{width:min(600px,calc(100vw - 32px));max-height:calc(100vh - 48px);
              background:#111725;border:2px solid #4d6b8f;border-radius:18px;
              box-shadow:0 24px 70px #000b;display:flex;flex-direction:column;overflow:hidden}

      .sfhead{display:flex;align-items:center;gap:12px;padding:12px 18px;
              background:#162034;border-bottom:2px solid #294061}
      .sfhead b{font:700 13px/1 ui-monospace,monospace;letter-spacing:.11em;
                text-transform:uppercase;color:#8ff0ff}
      /* PROGRESS WITHOUT WORDS. Nine dots beat "3 of 9 filled in", and they
         beat it by five words. */
      .sfdots{margin-left:auto;display:flex;gap:5px}
      .sfdot{width:9px;height:9px;border-radius:50%;background:#294061}
      .sfdot.done{background:#8ff0ff}
      .sfdot.at{background:#ffd8a8;box-shadow:0 0 0 3px #ffd8a833}

      .sfbody{padding:20px 22px 18px;overflow:auto}
      .sfsys{font:700 12px/1 ui-monospace,monospace;letter-spacing:.14em;
             text-transform:uppercase;color:#8ea5c4;margin-bottom:8px}
      .sfsays{font-size:19px;line-height:1.45;color:#f0f5ff;margin:0 0 18px}
      .sfsays b{color:#ffd8a8}

      /* ---- the rule, big, in the middle ---- */
      .sfrule{display:flex;align-items:center;justify-content:center;gap:12px;
              flex-wrap:wrap;background:#0d1626;border:2px solid #294061;
              border-radius:14px;padding:16px 14px;
              font:400 22px/1.4 ui-monospace,monospace;color:#dde7f7}
      .sfrule .g{color:#8fd3ff}
      .sfrule .n{color:#ffd8a8}
      .sfrule .p{color:#7f93b4}
      .sfslot{min-width:62px;height:38px;border-radius:9px;border:2px dashed #5c7fb0;
              background:#0a1120;color:#8ff0ff;cursor:pointer;
              font:700 21px/1 ui-monospace,monospace;display:inline-flex;
              align-items:center;justify-content:center;padding:0 10px}
      .sfslot.full{border-style:solid;background:#1b2740;border-color:#4d6b8f}
      .sfslot.join{color:#ffd8a8} .sfslot.neg{color:#ffb4a2}
      .sfslot:hover{border-color:#8ff0ff}
      .sfslot.armed{outline:3px solid #ffd8a8;outline-offset:2px;
                    animation:sfring 1.4s ease-in-out infinite}
      @keyframes sfring{50%{outline-color:#ffd8a866}}

      /* ---- the nine words ---- */
      .sfbank{display:flex;gap:7px;flex-wrap:wrap;margin:16px 0 0}
      .sfw{flex:1 1 84px;min-width:76px;border:2px solid #2f4665;background:#1b2740;
           border-radius:10px;padding:7px 4px;cursor:pointer;
           display:flex;flex-direction:column;align-items:center;gap:1px;color:#e9eefb}
      .sfw:hover{border-color:#8ff0ff}
      .sfw b{font:700 18px/1.15 ui-monospace,monospace;color:#8ff0ff}
      .sfw i{font-style:normal;font-size:11px;color:#9fb3cf;text-align:center;line-height:1.2}
      .sfw.join b{color:#ffd8a8} .sfw.neg b{color:#ffb4a2}
      .sfw.dim{opacity:.26}

      .sfnote{margin:14px 0 0;padding:9px 12px;border-radius:9px;
              background:#3a2230;border:2px solid #ff9aa2;color:#ffd3d8;font-size:14px}
      .sfmiss{margin:14px 0 0;color:#ffd8a8;font-size:15px;text-align:center}

      /* ---- the readings ---- */
      .sfreads{margin:18px 0 0;border-collapse:collapse;width:100%;
               font:400 15px/1.6 ui-monospace,monospace}
      .sfreads th{color:#8ea5c4;font-weight:600;text-align:left;text-transform:uppercase;
                  letter-spacing:.08em;font-size:10.5px;padding:0 10px 5px 0;
                  font-family:system-ui,sans-serif}
      .sfreads td{padding:4px 10px 4px 0;border-top:1px solid #294061}
      .sfreads tr.r-ok td{color:#a8e6cf}
      .sfreads tr.r-no td{color:#ff9aa2;font-weight:700}
      .sfreads tr.r-idle td{color:#6f7f9c}

      .sffoot{display:flex;gap:10px;align-items:center;padding:14px 22px;
              background:#0d1422;border-top:2px solid #294061}
      .sfbtn{border:0;border-radius:11px;padding:12px 22px;cursor:pointer;
             font:700 14px/1 ui-monospace,monospace;letter-spacing:.08em}
      .sfgo{background:#8ff0ff;color:#08202a;margin-left:auto}
      .sfout{background:#243046;color:#cfdcf0}
      .sfgo.gone{display:none}
      .sfbtn:disabled{opacity:.55;cursor:default}`;
    document.head.appendChild(css);

    const el=document.createElement('div');
    el.id='shipfix'; el.className='hidden';
    el.innerHTML=`<div class="sfwrap">
      <div class="sfhead"><b>E-45 · ${say('pre-flight')}</b>
        <span class="sfdots" id="sfdots"></span></div>
      <div class="sfbody" id="sfbody"></div>
      <div class="sffoot">
        <button class="sfbtn sfout" id="sfshut">${say('CLOSE')}</button>
        <button class="sfbtn sfgo gone" id="sfgo"></button>
      </div></div>`;
    document.body.appendChild(el);
    ui={ el, body:$('#sfbody',el), dots:$('#sfdots',el),
         go:$('#sfgo',el), shut:$('#sfshut',el) };
    ui.shut.onclick=()=>close();
    ui.go.onclick=()=>forward();
    return ui;
  }

  /* ------------------------------------------------------------- drawing */
  const check = () => P().CHECKS[at];

  /* The rule, built off preflight.js's own form tree so the thing on screen
     and the thing being evaluated are one statement. */
  function ruleHTML(c){
    const R=P();
    const cmp = n => `<span class="g">${esc(n.gauge)}</span>`
                   + slot(c.id, R.hole(n.op), 'cmp')
                   + `<span class="n">${n.rhs}</span>`;
    const f=c.form;
    if(f.t==='cmp')  return cmp(f);
    if(f.t==='join') return cmp(f.a) + slot(c.id, R.hole(f.op), 'join') + cmp(f.b);
    if(f.t==='not')  return slot(c.id, R.hole(f.neg), 'neg')
                          + `<span class="p">(</span>` + cmp(f.in) + `<span class="p">)</span>`;
    return '';
  }
  function slot(checkId, name, kind){
    const R=P(), k=R.key(checkId, name), v=state[k];
    return `<button class="sfslot ${kind}${v?' full':''}${armed===k?' armed':''}"
              data-slot="${esc(k)}" data-kind="${kind}">${v?esc(v):'&nbsp;'}</button>`;
  }

  /* THE READINGS. A rule cannot be checked by reading it — that is the
     whole reason this is hard — so the ship's own log sits under it, with
     what the rule does to each line and what it should have done.

     YES AND NO, not PASS and HOLD. Three letters, no jargon, and the same
     two words in both columns so they compare at a glance. */
  function reads(c){
    const R=P(), rows=R.rowsOf(c.id, state);
    return `<table class="sfreads"><tr>`
      + c.gauges.map(g=>`<th>${esc(g)}</th>`).join('')
      + `<th>${say('your rule')}</th><th>${say('should be')}</th></tr>`
      + rows.map(r=>`<tr class="${r.blank?'r-idle':r.ok?'r-ok':'r-no'}">`
        + c.gauges.map(g=>`<td>${r.reading[g]}</td>`).join('')
        + `<td>${r.blank ? '—' : r.got ? say('YES') : say('NO')}</td>`
        + `<td>${r.want ? say('YES') : say('NO')}${r.ok?'  ✓':''}</td></tr>`).join('')
      + `</table>`;
  }

  /* THE NINE WORDS, coloured by part of speech and dimmed when this blank
     cannot take them — which says "wrong kind of word" without spending a
     sentence on it. Dimmed, not disabled: they still answer when clicked,
     and the answer is the sentence about what they are for. */
  function bank(kind){
    return `<div class="sfbank">` + P().WORDS.map(w=>`
      <button class="sfw ${w.kind}${kind && w.kind!==kind ? ' dim' : ''}" data-w="${esc(w.id)}">
        <b>${esc(w.id)}</b><i>${say(w.name)}</i>
      </button>`).join('') + `</div>`;
  }

  function dots(){
    const u=dom(), R=P();
    u.dots.innerHTML = R.CHECKS.map((c,i)=>
      `<span class="sfdot${R.done(c.id,state)?' done':''}${i===at?' at':''}"></span>`).join('');
  }

  function draw(){
    const u=dom(), R=P(), c=check();
    if(!c) return;
    /* The walkthrough answers for the whole board, so it is the guide here
       only while it happens to be pointing at the check on screen. */
    const st=R.step(state), mine = st && st.id===c.id ? st : null;
    if(!armed || !inCheck(armed, c)) armed = mine ? mine.hole : firstSlot(c);
    const kind = armedKind();

    u.body.innerHTML =
      `<div class="sfsys">${esc(c.name)}</div>` +
      `<p class="sfsays">${c.says}</p>` +
      `<div class="sfrule">${ruleHTML(c)}</div>` +
      bank(kind) +
      (note ? `<div class="sfnote">${note}</div>` : '') +
      (!note && mine && mine.miss ? `<div class="sfmiss">${esc(mine.miss)}</div>` : '') +
      reads(c);

    u.body.querySelectorAll('[data-slot]').forEach(b=>{
      b.onclick=()=>{
        const k=b.dataset.slot;
        /* A filled blank clicked again empties itself, which is the only
           way back out of a word you have changed your mind about. */
        if(state[k]){ delete state[k]; armed=k; }
        else armed = armed===k ? null : k;
        note=null; draw();
      };
    });
    u.body.querySelectorAll('[data-w]').forEach(b=>{ b.onclick=()=>place(b.dataset.w); });

    /* NEXT ONLY WHEN IT IS RIGHT. Nothing else gates the question and
       nothing needs to: the button is the gate and the reward at once. */
    const ok=R.done(c.id, state), last = at===R.CHECKS.length-1;
    u.go.classList.toggle('gone', !ok);
    if(ok && !done) u.go.textContent = last ? say('LAUNCH') : say('NEXT →');
    dots();
  }

  const inCheck = (k,c) => P().slotsOf(c).some(sl=>P().key(sl.check, sl.slot)===k);
  const firstSlot = c => { const sl=P().slotsOf(c)[0]; return sl ? P().key(sl.check, sl.slot) : null; };
  function armedKind(){
    if(!armed) return null;
    const sl=P().SLOTS().find(s=>P().key(s.check,s.slot)===armed);
    return sl ? sl.kind : null;
  }

  /* ------------------------------------------------------------- placing */
  function place(wordId){
    const R=P();
    if(!armed){ note=say('Click one of the blanks first.'); draw(); return; }
    const sl=R.SLOTS().find(s=>R.key(s.check,s.slot)===armed);
    if(!sl) return;
    const no=R.refuse(wordId, sl.kind);
    if(no){ note=no; draw(); return; }
    note=null;
    state[armed]=wordId;
    state=R.tidy(state);
    /* On to the next blank IN THIS RULE, so a three-blank question is
       three clicks rather than three clicks and two hunts. */
    const rest=R.slotsOf(check()).map(s=>R.key(s.check,s.slot)).filter(k=>!state[k]);
    armed = rest[0] || null;
    draw();
  }

  /* ---------------------------------------------------------- moving on */
  function forward(){
    const R=P();
    if(!R.done(check().id, state)) return;
    if(at < R.CHECKS.length-1){
      at++; armed=null; note=null;
      draw();
      try{ dom().body.scrollTop=0; }catch(e){}
      return;
    }
    /* THE LAST ONE IS THE RUN. Nine rules against their own logs is what a
       pre-flight IS, and the only way to reach this button is to have
       passed every one — so it cannot fail. Asking preflight.js anyway is
       what keeps the panel from being the thing that decides. */
    const r=R.run(state);
    if(!r.ok || done) return;
    done=true;
    const u=dom();
    u.go.disabled=true;
    u.go.textContent=say('CLEARED');
    setTimeout(()=>{ close(); if(opts && opts.onCleared) opts.onCleared(); }, 900);
  }

  /* ---------------------------------------------------------------- open */
  function openIt(o){
    if(open) return;
    if(!P()){ console.warn('SHIPFIX: preflight.js is not loaded'); return; }
    opts=o||{}; open=true; done=false; armed=null; note=null; at=0;
    state=P().blank();
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
