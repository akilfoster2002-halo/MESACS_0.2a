/* =====================================================================
   THE E-45'S PRE-FLIGHT PANEL — the screen for preflight.js.

   THE WORDS ARE ON SCREEN THE WHOLE TIME, and that is the lesson rather
   than a convenience. A student who has to remember what `>=` is called
   before they can use it is being tested on recall in the middle of being
   taught reasoning; a student who can see "is at least" written under the
   symbol is being asked the only question that is hard, which is WHICH of
   the nine this rule wants. The bank is the vocabulary list and the
   checklist is the exercise, and they are the same screen.

   ONE CLICK PER ANSWER. The walkthrough already knows which blank is next
   and rings it, so that blank is armed: click a word and it lands there.
   Any other blank can be clicked to take over, and a filled blank clicked
   again empties itself. Nothing is dragged — a nine-year-old on a
   trackpad, in a browser, with a 3D world running behind the panel, should
   not be asked to drag anything.

   A WORD IN THE WRONG KIND OF BLANK IS ANSWERED, NOT REFUSED. Dropping
   `and` between two numbers gets a sentence about what `and` is for, which
   is the part of the vocabulary nobody writes down: these nine words are
   three different parts of speech and knowing which is which is most of
   knowing them. preflight.js writes the sentence; this only shows it.

   IT BUILDS ITS OWN DOM, like ionfix.js, for the same reason: index.html
   is a hundred and fifty thousand characters and nothing else on the page
   draws a checklist.
   ===================================================================== */
window.SHIPFIX = (function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const say = (s,p) => (window.t ? t(s,p) : s);
  const P = () => window.PREFLIGHT;
  const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  let ui=null, state=null, opts=null, open=false, done=false;
  let armed=null;        // the blank a word would land in
  let note=null;         // the last refusal, if there is one
  let at=null;           // which check the walkthrough is on, last time it drew

  function dom(){
    if(ui) return ui;
    const css=document.createElement('style');
    css.textContent=`
      #shipfix{position:fixed;inset:0;z-index:70;display:flex;align-items:center;
               justify-content:center;background:#070a12e8;
               font:400 15px/1.5 system-ui,sans-serif;color:#e9eefb}
      #shipfix.hidden{display:none}
      .sfwrap{width:min(1080px,calc(100vw - 40px));max-height:calc(100vh - 56px);
              background:#111725;border:2px solid #4d6b8f;border-radius:18px;
              box-shadow:0 24px 70px #000b;display:flex;flex-direction:column;overflow:hidden}
      .sfhead{display:flex;align-items:center;gap:12px;padding:14px 18px;
              background:#162034;border-bottom:2px solid #294061}
      .sfhead b{font:700 15px/1 ui-monospace,monospace;letter-spacing:.1em;
                text-transform:uppercase;color:#8ff0ff}
      .sfhead span{color:#8ea5c4;font-size:13px}
      .sfhead .sfcount{margin-left:auto;font:700 13px/1 ui-monospace,monospace;color:#8ea5c4}

      /* ---- the bank: the vocabulary, always visible ---- */
      .sfbank{display:flex;gap:8px;flex-wrap:wrap;padding:12px 18px;
              background:#0d1422;border-bottom:2px solid #294061}
      .sfbank h3{width:100%;font:700 11px/1 ui-monospace,monospace;letter-spacing:.12em;
                 text-transform:uppercase;color:#8ea5c4;margin:0 0 4px}
      .sfw{flex:1 1 92px;min-width:82px;border:2px solid #2f4665;background:#1b2740;
           border-radius:11px;padding:7px 6px;cursor:pointer;
           display:flex;flex-direction:column;align-items:center;gap:2px;color:#e9eefb}
      .sfw:hover{border-color:#8ff0ff}
      .sfw b{font:700 19px/1.1 ui-monospace,monospace;color:#8ff0ff}
      .sfw i{font-style:normal;font-size:11.5px;color:#9fb3cf;text-align:center;line-height:1.25}
      .sfw.cmp b{color:#8ff0ff} .sfw.join b{color:#ffd8a8} .sfw.neg b{color:#ffb4a2}
      .sfw.dim{opacity:.38}

      .sfbody{display:flex;gap:18px;padding:16px 18px;overflow:auto;flex-wrap:wrap}
      .sfcol{flex:1 1 340px;min-width:300px}
      .sfcol.wide{flex:1.55 1 470px}
      .sfcol h3{font:700 11px/1 ui-monospace,monospace;letter-spacing:.12em;
                text-transform:uppercase;color:#8ea5c4;margin:0 0 10px}

      /* ---- the step card ---- */
      #sfstep{background:#1a2338;border:2px solid #5c7fb0;border-left-width:6px;
              border-radius:12px;padding:11px 14px;margin:0 0 12px;font-size:14px;
              line-height:1.5}
      #sfstep.clear{border-color:#a8e6cf;color:#cdf3e2}
      #sfstep b{color:#ffd8a8}
      #sfstep > .no{display:block;font:700 10px/1 ui-monospace,monospace;
                letter-spacing:.14em;text-transform:uppercase;color:#8ea5c4;margin-bottom:5px}
      .sfvocab{margin-top:9px;padding-top:8px;border-top:1px solid #33496b;
               color:#b6c8e2;font-size:13.5px}
      .sfrefuse{margin-top:9px;padding:9px 11px;border-radius:9px;
                background:#3a2230;border:2px solid #ff9aa2;color:#ffd3d8;font-size:13.5px}

      /* ---- the checklist ---- */
      .sfrow{border:2px solid #294061;border-radius:12px;padding:9px 12px;margin:0 0 8px;
             background:#141d2f}
      .sfrow.at{border-color:#ffd8a8;background:#1a2338}
      .sfrow.ok{border-color:#5f9c7f}
      .sfrn{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .sfrn .sys{font:700 11.5px/1 ui-monospace,monospace;letter-spacing:.1em;
                 color:#8ea5c4;min-width:88px}
      .sfrow.ok .sfrn .sys{color:#a8e6cf}
      /* THE GAP IS THE RING'S ROOM. The armed blank wears an outline that
         sits outside its own box, so at the six pixels this started on it
         drew straight over the gauge name to its left and the number to
         its right — "fuel" with a rounded box through the l. */
      .sfrule{display:flex;align-items:center;gap:12px;flex-wrap:wrap;
              font:400 16px/1.5 ui-monospace,monospace;color:#dde7f7}
      .sfrule .g{color:#8fd3ff}
      .sfrule .n{color:#ffd8a8}
      .sfrule .p{color:#7f93b4}
      /* THE BLANK. A dashed box the size of the word that goes in it, so
         the line does not jump sideways when it is filled. */
      .sfslot{min-width:52px;height:30px;border-radius:8px;border:2px dashed #5c7fb0;
              background:#0f1626;color:#8ff0ff;cursor:pointer;
              font:700 16px/1 ui-monospace,monospace;display:inline-flex;
              align-items:center;justify-content:center;padding:0 8px}
      .sfslot.full{border-style:solid;background:#1b2740;border-color:#4d6b8f}
      .sfslot.join{color:#ffd8a8} .sfslot.neg{color:#ffb4a2}
      .sfslot:hover{border-color:#8ff0ff}
      .sfslot.armed{outline:3px solid #ffd8a8;outline-offset:2px;
                    animation:sfring 1.4s ease-in-out infinite}
      @keyframes sfring{50%{outline-color:#ffd8a866}}
      .sftick{margin-left:auto;font:700 14px/1 ui-monospace,monospace;color:#5c7fb0}
      .sfrow.ok .sftick{color:#a8e6cf}
      .sfrow.no .sftick{color:#ff9aa2}

      /* ---- the readings, under the row being worked on ---- */
      .sfreads{margin-top:9px;border-collapse:collapse;font-size:13px;width:100%}
      .sfreads th{color:#8ea5c4;font-weight:600;text-align:left;text-transform:uppercase;
                  letter-spacing:.08em;font-size:10.5px;padding:2px 10px 4px 0}
      .sfreads td{padding:3px 10px 3px 0;border-top:1px solid #294061;
                  font:400 13px/1.5 ui-monospace,monospace}
      .sfreads tr.r-ok td{color:#a8e6cf}
      .sfreads tr.r-no td{color:#ff9aa2;font-weight:700}
      .sfreads tr.r-idle td{color:#6f7f9c}

      .sfrun{margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .sfbtn{border:0;border-radius:11px;padding:11px 20px;cursor:pointer;
             font:700 14px/1 ui-monospace,monospace;letter-spacing:.08em}
      .sfgo{background:#8ff0ff;color:#08202a}
      .sfout{background:#243046;color:#cfdcf0}
      .sfbtn:disabled{opacity:.45;cursor:default}
      .sftrace{background:#0b111d;border:1px solid #294061;border-radius:12px;
               padding:12px 14px;min-height:220px;font:400 13.5px/1.6 ui-monospace,monospace}
      .sftrace .rule{color:#ffd8a8;margin-top:6px}
      .sftrace .good{color:#a8e6cf}
      .sftrace .bad{color:#ff9aa2}
      .sftrace .idle{color:#6f7f9c}
      .sfwhy{margin-top:10px;color:#ffd8a8;font-size:14px;min-height:1.5em}
      .sfwin{margin-top:10px;color:#a8e6cf;font-weight:700}`;
    document.head.appendChild(css);

    const el=document.createElement('div');
    el.id='shipfix'; el.className='hidden';
    el.innerHTML=`<div class="sfwrap">
      <div class="sfhead">
        <div><b>E-45 · pre-flight</b><br>
          <span>${say('Nine safety rules. Somebody took the words out of them.')}</span></div>
        <span class="sfcount" id="sfcount"></span>
      </div>
      <div class="sfbank" id="sfbank"></div>
      <div class="sfbody">
        <div class="sfcol wide"><h3>${say('The checklist')}</h3>
          <div id="sfstep"></div>
          <div id="sflist"></div>
          <div class="sfrun">
            <button class="sfbtn sfgo" id="sfgo">${say('RUN PRE-FLIGHT')}</button>
            <button class="sfbtn sfout" id="sfshut">${say('CLOSE')}</button>
          </div>
        </div>
        <div class="sfcol"><h3>${say('What the gauges did')}</h3>
          <div class="sftrace" id="sftrace"></div>
          <div class="sfwhy" id="sfwhy"></div>
          <div class="sfwin hidden" id="sfwin"></div>
        </div>
      </div></div>`;
    document.body.appendChild(el);
    ui={ el, bank:$('#sfbank',el), list:$('#sflist',el), step:$('#sfstep',el),
         trace:$('#sftrace',el), why:$('#sfwhy',el), win:$('#sfwin',el),
         body:$('.sfbody',el),
         count:$('#sfcount',el), go:$('#sfgo',el), shut:$('#sfshut',el) };
    ui.go.onclick=()=>runIt();
    ui.shut.onclick=()=>close();
    return ui;
  }

  /* ------------------------------------------------------------- drawing */

  /* THE BANK. Nine chips, the symbol over what it is called, coloured by
     part of speech — comparisons cyan, joins sand, `not` salmon — so the
     three kinds are visible before a word of the explanation is read. */
  function bank(){
    const u=dom(), R=P();
    u.bank.innerHTML = `<h3>${say('The words')}</h3>` + R.WORDS.map(w=>`
      <button class="sfw ${w.kind}" data-w="${esc(w.id)}" title="${esc(strip(w.help))}">
        <b>${esc(w.id)}</b><i>${say(w.name)}</i>
      </button>`).join('');
    u.bank.querySelectorAll('[data-w]').forEach(b=>{
      b.onclick=()=>place(b.dataset.w);
    });
  }
  const strip = s => String(s).replace(/<[^>]+>/g,'');

  /* One rule, with its blanks. Built off preflight.js's own form tree so
     the thing on screen and the thing being evaluated are one statement. */
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

  /* The readings, under the row being worked on. A rule cannot be checked
     by reading it — that is the whole reason this is hard — so the log is
     on screen beside it, with what the rule does to each line and what the
     log says should have happened. */
  function reads(c){
    const R=P(), rows=R.rowsOf(c.id, state);
    return `<table class="sfreads"><tr>`
      + c.gauges.map(g=>`<th>${esc(g)}</th>`).join('')
      + `<th>${say('your rule')}</th><th>${say('the log')}</th></tr>`
      + rows.map(r=>`<tr class="${r.blank?'r-idle':r.ok?'r-ok':'r-no'}">`
        + c.gauges.map(g=>`<td>${r.reading[g]}</td>`).join('')
        + `<td>${r.blank ? '—' : r.got ? say('PASS') : say('HOLD')}</td>`
        + `<td>${r.want ? say('PASS') : say('HOLD')}${r.ok?' ✓':''}</td></tr>`).join('')
      + `</table>`;
  }

  function draw(){
    const u=dom(), R=P();
    const st=R.step(state);
    u.count.textContent = say('{n} of {m} filled in', { n:R.filled(state), m:R.total() });

    u.list.innerHTML = R.CHECKS.map(c=>{
      const ok=R.done(c.id, state), at=st && st.id===c.id;
      const rows=R.rowsOf(c.id, state);
      const anyBlank=rows.some(r=>r.blank);
      return `<div class="sfrow${at?' at':''}${ok?' ok':anyBlank?'':' no'}">
          <div class="sfrn">
            <span class="sys">${esc(c.name)}</span>
            <span class="sfrule">${ruleHTML(c)}</span>
            <span class="sftick">${ok?'✓':anyBlank?'·':'✗'}</span>
          </div>
          ${at ? reads(c) : ''}
        </div>`;
    }).join('');

    u.list.querySelectorAll('[data-slot]').forEach(b=>{
      b.onclick=()=>{
        const k=b.dataset.slot;
        /* A filled blank clicked again empties itself, which is the only
           way back out of a word you have changed your mind about. */
        if(state[k]){ delete state[k]; armed=k; }
        else armed = armed===k ? null : k;
        note=null; draw();
      };
    });
    walk(st);

    /* AND BRING THE OPEN ROW WITH IT. Nine checks is more than fits on a
       laptop, and the one being worked on is the only one that has its log
       open under it — so finishing a check and having the next one appear
       somewhere off the bottom of the panel is the walkthrough talking
       about a row that is not on screen. Only when it MOVES: scrolling on
       every redraw would drag the page under a student's hand every time
       they emptied a blank. */
    const now = st ? st.id : null;
    if(now !== at){
      at = now;
      const row=$('.sfrow.at', u.el);
      if(row) try{ row.scrollIntoView({ behavior:'smooth', block:'nearest' }); }catch(e){}
    }
  }

  /* THE WALKTHROUGH, read off the board rather than counted. */
  function walk(st){
    const u=dom();
    if(!st){
      armed=null;
      u.step.className='clear';
      u.step.innerHTML='<span class="no">'+say('Nothing left')+'</span>'+
        say('Every rule matches the log. Press <b>RUN PRE-FLIGHT</b>.');
      bankDim(null);
      return;
    }
    /* ARM THE BLANK THE STEP IS ABOUT, unless the player has picked another
       one. One click per answer for anybody following the walkthrough, and
       no loss of control for anybody who is not. */
    if(!armed || !hasSlot(armed)) armed=st.hole;
    u.step.className='';
    u.step.innerHTML='<span class="no">'+
      say('Check {n} of {m}', { n:st.n, m:st.of })+' · <em>'+esc(st.name)+'</em></span>'+
      st.say +
      '<div class="sfvocab">'+ kindLine(st.kind) +'</div>' +
      (note ? '<div class="sfrefuse">'+note+'</div>' : '');
    bankDim(st.kind);
    /* Redraw only the armed ring, not the whole list — draw() called walk()
       and calling it back would be a loop. */
    const el=$('[data-slot="'+cssq(armed)+'"]', u.el);
    if(el) el.classList.add('armed');
  }
  const cssq = s => String(s).replace(/"/g,'\\"');
  const hasSlot = k => P().SLOTS().some(sl=>P().key(sl.check, sl.slot)===k);

  /* WHAT KIND OF WORD THIS BLANK WANTS, said before it is needed rather
     than only when something is refused. The three kinds are the half of
     this vocabulary nobody writes down. */
  function kindLine(kind){
    if(kind==='join')
      return say('This blank is between two whole questions, so it wants a word that '
               + '<b>joins</b> them: and, or.');
    if(kind==='neg')
      return say('This blank is in front of a whole question, so it wants the word that '
               + '<b>flips</b> it: not.');
    return say('This blank is between two numbers, so it wants a word that '
             + '<b>compares</b> them: &lt; &gt; &lt;= &gt;= == !=');
  }
  /* And the bank says the same thing by going quiet. The wrong-kind chips
     are dimmed rather than disabled: they still answer when clicked, and
     the answer is the sentence about what they are for. */
  function bankDim(kind){
    const u=dom();
    u.bank.querySelectorAll('[data-w]').forEach(b=>{
      const w=P().wordOf(b.dataset.w);
      b.classList.toggle('dim', !!kind && !!w && w.kind!==kind);
    });
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
    /* And on to the next blank, so filling a rule in is one click a word
       rather than one click and then a hunt. */
    armed=null;
    draw();
  }

  /* ----------------------------------------------------------------- run */
  function runIt(){
    const u=dom(), r=P().run(state);
    u.trace.innerHTML = r.lines.map(l=>`<div class="${l.kind}">${esc(l.text)}</div>`).join('');
    u.why.innerHTML = r.ok ? '' : (r.why || '');
    u.win.classList.toggle('hidden', !r.ok);
    try{ u.trace.scrollIntoView({ behavior:'smooth', block:'center' }); }
    catch(e){ u.trace.scrollIntoView(false); }
    if(!r.ok) return;
    u.win.textContent = say('Cleared for launch.');
    if(done) return;
    done=true;
    u.go.disabled=true;
    setTimeout(()=>{ close(); if(opts && opts.onCleared) opts.onCleared(); }, 1100);
  }

  /* ---------------------------------------------------------------- open */
  function openIt(o){
    if(open) return;
    if(!P()){ console.warn('SHIPFIX: preflight.js is not loaded'); return; }
    opts=o||{}; open=true; done=false; armed=null; note=null;
    state=P().blank();
    const u=dom();
    u.el.classList.remove('hidden');
    u.go.disabled=false;
    u.win.classList.add('hidden'); u.win.textContent='';
    u.why.textContent='';
    u.trace.innerHTML=`<div class="idle">${say('Fill the blanks in, then press RUN.')}</div>`;
    /* At the top, every time. A panel reopened where it was last scrolled
       to opens on the middle of a checklist with the instructions off the
       screen above it. */
    at=null; if(u.body) u.body.scrollTop=0;
    bank(); draw();
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
           get state(){ return state; } };
})();
