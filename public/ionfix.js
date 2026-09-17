/* =====================================================================
   ION'S CONSOLE — the program he wakes up with, and three holes in it.

   The lesson is READING a program and changing it, which is the other
   half of the skill from writing one and the half a student meets first
   in real life: something in front of you is behaving strangely, and the
   way to find out why is to open it, see what it says, and change the
   answer. The Engineer's Trail makes a whole mission of that; this is the
   five-minute version of it, and it is somebody's breakfast.

   THE BLOCKS ARE THE REAL ONES. Motion is blue, Control is salmon, Events
   are sand — the same three colours blocks.js gives those categories in
   the editor, because a student who meets `repeat` here and `repeat` in
   Free Play should be meeting the same block twice and not two things
   that happen to share a word.

   NOTHING IS MARKED AGAINST AN ANSWER KEY. routine.js runs the program
   and reports what Ion did; this draws that. `repeat 4 [move 10]` and
   `repeat 5 [move 8]` are both forty steps and both open the door.

   IT BUILDS ITS OWN DOM. index.html is a hundred and fifty thousand
   characters and nothing else on the page draws a block.
   ===================================================================== */
window.IONFIX = (function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const say = (s,p) => (window.t ? t(s,p) : s);
  const R = () => window.ROUTINE;

  let ui=null, state=null, opts=null, open=false, done=false;

  /* blocks.js's own category colours, read off it where we can so the two
     cannot drift, and named here so this file still draws if it loads
     first. */
  function tint(cat, fallback){
    try{ const c=BLOCKS.catOf(cat); if(c && c.a) return c.a; }catch(e){}
    return fallback;
  }

  function dom(){
    if(ui) return ui;
    const css=document.createElement('style');
    css.textContent=`
      #ionfix{position:fixed;inset:0;z-index:70;display:flex;align-items:center;
              justify-content:center;background:#0a0710e8;
              font:400 15px/1.5 system-ui,sans-serif;color:#efe9ff}
      #ionfix.hidden{display:none}
      .ifwrap{width:min(1080px,calc(100vw - 40px));max-height:calc(100vh - 56px);
              background:#171225;border:2px solid #6b5f8f;border-radius:18px;
              box-shadow:0 24px 70px #000b;display:flex;flex-direction:column;overflow:hidden}
      .ifhead{display:flex;align-items:center;gap:12px;padding:14px 18px;
              background:#1f1833;border-bottom:2px solid #372c56}
      .ifhead img{width:42px;height:42px;border-radius:10px;object-fit:cover;object-position:50% 12%;
                  background:#241d33}
      .ifhead b{font:700 15px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:#8ff0ff}
      .ifhead span{color:#9b8fc4;font-size:13px}
      .ifbody{display:flex;gap:18px;padding:18px;overflow:auto;flex-wrap:wrap}
      /* THE PROGRAM GETS THE WIDER HALF. Two equal columns is right when
         both hold the same kind of thing; here one holds a nested program
         with two conditions in it and the other holds a list of short
         lines. Split evenly, the trace had room to spare and the rules
         were wrapping three deep. Both still collapse to one column on
         anything narrower than about seven hundred. */
      .ifcol{flex:1 1 340px;min-width:300px}
      .ifcol.wide{flex:1.5 1 460px}
      .ifcol h3{font:700 11px/1 ui-monospace,monospace;letter-spacing:.12em;
                text-transform:uppercase;color:#9b8fc4;margin:0 0 10px}
      #ifstep{background:#241d33;border:2px solid #7a6ab0;border-left-width:6px;
              border-radius:12px;padding:11px 14px;margin:0 0 12px;font-size:14px;
              line-height:1.5;color:#efe9ff}
      #ifstep.clear{border-color:#a8e6cf;color:#cdf3e2}
      #ifstep b{color:#ffd8a8}
      #ifstep > .no{display:block;font:700 10px/1 ui-monospace,monospace;
                  letter-spacing:.14em;text-transform:uppercase;color:#9b8fc4;
                  margin-bottom:5px}
      /* THE BLOCKS THEMSELVES ARE NOT STYLED HERE. .blk, .blk-rep,
         .blk-head, .blk-body, .blk-foot, .cnt, .cnt-n and .numin are all
         global in index.html and belong to code.js; a second set of rules
         for them here would be a second drawing of the same block, drifting
         away from the one every other mission uses. These four are the only
         things this panel adds. */
      #ionfix .blk-head.mid{border-radius:0;margin-left:22px}
      #ionfix .cond{background:rgba(0,0,0,.3);border:none;color:#fff;
             border-radius:8px;padding:4px 10px;font:inherit;font-size:16px;cursor:pointer}
      /* THE BLOCK THE STEP IS ABOUT, ringed. A walkthrough that says "the
         loop" and leaves a student hunting for which control is the loop
         has not pointed at anything. */
      #ionfix .ring{outline:4px solid #ffd8a8;outline-offset:3px;border-radius:9px;
             animation:ifring 1.4s ease-in-out infinite}
      @keyframes ifring{50%{outline-color:#ffd8a866}}
      #ionfix .bool-side{display:inline-flex;align-items:center;gap:6px;font-size:16px;
             white-space:nowrap}
      #ionfix .cond.join{font-weight:700;letter-spacing:.06em}
      /* A CONDITION IS LONGER THAN A LOOP IS, and it has to be allowed to
         fall onto a second line. code.js's heads hold "repeat 4 times" and
         are built never to wrap; these hold two questions and the word
         between them, nested two C-blocks deep, in a column three hundred
         pixels wide once both indents are paid for. Unwrapped, the head ran
         off the right edge of its own block and "else if" broke in half
         around the condition beside it — "else the if pan is hot" is not a
         thing anybody can read a rule out of.

         The notebook's rule builder wraps its heads for the same reason;
         see .nb-rule .tb-br .blk-head in index.html. What is NOT changed
         here is how a block LOOKS: same colour, same radius, same padding,
         same font. It is only allowed to be two lines tall. */
      #ionfix .blk.rep > .blk-head{flex-wrap:wrap;row-gap:5px}
      #ionfix .blk-name{white-space:nowrap}
      /* The vocabulary, under the step that needs it. CODE's palette says
         what every block does; somebody meeting AND for the first time in
         the middle of a repair deserves the same sentence. */
      #ionfix .vocab{margin-top:9px;padding-top:8px;border-top:1px solid #4a3f6b;
             color:#bcb0e0;font-size:13.5px}
      #ionfix .morns{margin-top:10px;border-collapse:collapse;font-size:13px;width:100%}
      #ionfix .morns th{color:#9b8fc4;font-weight:600;text-align:left;
             text-transform:uppercase;letter-spacing:.08em;font-size:10.5px;padding:2px 8px 4px 0}
      #ionfix .morns td{padding:3px 8px 3px 0;border-top:1px solid #372c56}
      #ionfix .morns tr.m-ok td{color:#a8e6cf}
      #ionfix .morns tr.m-no td{color:#ff9aa2;font-weight:700}
      .ifrun{margin-top:6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .ifbtn{border:0;border-radius:11px;padding:11px 20px;cursor:pointer;
             font:700 14px/1 ui-monospace,monospace;letter-spacing:.08em}
      .ifgo{background:#8ff0ff;color:#0b2027}
      .ifout{background:#2a2340;color:#cfc6ea}
      .ifbtn:disabled{opacity:.45;cursor:default}
      .trace{background:#120e1e;border:1px solid #372c56;border-radius:12px;
             padding:12px 14px;min-height:200px;font:400 14px/1.6 ui-monospace,monospace}
      .trace .hat{color:#ffd8a8}
      .trace .loop{color:#ffb4a2}
      .trace .if{color:#ffb4a2}
      .trace .in{color:#8fd3ff;padding-left:18px}
      .trace .good{color:#a8e6cf}
      .trace .bad{color:#ff9aa2}
      .trace .idle{color:#6f6590}
      .ifwhy{margin-top:10px;color:#ffd8a8;font-size:14px;min-height:1.5em}
      .ifwin{margin-top:10px;color:#a8e6cf;font-weight:700}`;
    document.head.appendChild(css);

    const el=document.createElement('div');
    el.id='ionfix'; el.className='hidden';
    el.innerHTML=`<div class="ifwrap">
      <div class="ifhead">
        <img src="characters/previews/ion.png" alt="">
        <div><b>ION · morning routine</b><br>
             <span>${say('{n} questions. Four mornings. Every one has to be right on all of them.',
                          {n:(R().RULES||[]).length})}</span></div>
      </div>
      <div class="ifbody">
        <div class="ifcol wide"><h3>${say('The program')}</h3>
          <div id="ifstep"></div>
          <div id="ifscript"></div>
          <div class="ifrun">
            <button class="ifbtn ifgo" id="ifgo">${say('RUN')}</button>
            <button class="ifbtn ifout" id="ifclose">${say('CLOSE')}</button>
          </div>
        </div>
        <div class="ifcol"><h3>${say('What Ion does')}</h3>
          <div class="trace" id="iftrace"></div>
          <div class="ifwhy" id="ifwhy"></div>
          <div class="ifwin hidden" id="ifwin"></div>
        </div>
      </div></div>`;
    document.body.appendChild(el);
    ui={ el, script:$('#ifscript',el), step:$('#ifstep',el), trace:$('#iftrace',el),
         why:$('#ifwhy',el), win:$('#ifwin',el),
         go:$('#ifgo',el), shut:$('#ifclose',el) };
    ui.go.onclick=()=>runIt();
    ui.shut.onclick=()=>close();
    return ui;
  }

  /* ------------------------------------------------------------- drawing */
  const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* THE CONSOLE'S OWN BLOCKS, not a second drawing of them.

     `.blk`, `.blk-rep`, `.blk-head`, `.blk-body`, `.blk-foot`, `.cnt`,
     `.cnt-n`, `.numin` are all styled globally in index.html, and code.js
     builds exactly this markup for the Swarm, the Trench and Space
     Explorer. Emitting the same thing here means Ion's routine IS a Koro
     program rather than something that resembles one: the C-blocks wrap,
     the notch is under the loop, the counter is the same counter, and a
     student who has done the Swarm recognises the shape before they read
     a word of it.

     `--c` is the block's colour, and the colours are code.js's own for the
     same block: repeat and forever purple, if mint, move blue. */
  const C = { loop:'#cdb4f6', ifc:'#a8e6cf', bool:'#9fe6b4', move:'#8fd3ff', act:'#bdb2d8' };

  /* TWO QUESTIONS, NEITHER ABOVE THE OTHER.

     THIS WAS A LADDER AND THE LADDER WAS THE LESSON. One `if` about the
     kitchen, and inside it an `if` / `else if` / `else` whose ORDER
     decided what he did — a second rule that overlapped the first was not
     wrong so much as unreachable. It taught conditionals, which is not
     what this course teaches any more.

     WHAT IS LEFT IS BETTER FIRST. Take the order away and the two rules
     stop being one thing asked in sequence and become two questions asked
     of the same morning, each with a yes or a no, neither able to hide
     behind the other. Drawn as two blocks side by side in the script
     rather than one block with bars across it, because that shape is the
     claim: these are asked together.

     `which` is a rule's id, and it is the only difference between
     them: the same three controls, the same two facts, asked twice about
     the same four mornings. Drawing them from one function is the point
     rather than a saving — a student who can see that the second question
     is the first one's controls in different positions is most of the way
     to working out what those positions have to be. */
  function boolSide(s, which){
    const r=R().RULES.find(x=>x.id===which);
    return `<span class="bool-side">${say('the pan')}
        <button class="cond" id="if${which}hot">${say(s[r.hot])}</button>
        ${say('hot')}</span>
      <button class="cond join" id="if${which}join">${say(s[r.join])}</button>
      <span class="bool-side">${say('there')}
        <button class="cond" id="if${which}batter">${say(s[r.batter])}</button>
        ${say('batter')}</span>`;
  }

  /* One question and what he does when the answer is yes. A flat block
     with a head and one body: no `else`, no second bar, nothing under it
     that only runs when something else did not. */
  function askBlock(s, which, then_){
    const r=R().RULES.find(x=>x.id===which);
    return `<div class="blk rep" style="--c:${C.bool}">
        <div class="blk-head">
          <span class="blk-name">${say(r.name)}</span>
          ${boolSide(s, which)}
        </div>
        <div class="blk-body">
          <div class="blk" style="--c:${C.act}">
            <span class="blk-name">${say(then_)}</span></div>
        </div>
        <div class="blk-foot"></div>
      </div>`;
  }

  function draw(){
    const u=dom(), s=state;
    /* ONE BLOCK PER QUESTION, OFF THE LIST. These were typed out — two
       calls, two hand-written "what he does" strings — which was fine at
       two and is six chances to pair the wrong verb with the wrong
       question at six. The verb belongs to the rule in routine.js,
       because the rule is the thing that knows what it means. */
    u.script.innerHTML = (R().RULES||[])
      .map(r=>askBlock(s, r.id, r.did)).join('');

    const on_=(id,fn)=>{ const e=$('#'+id,u.el); if(e) e.onclick=fn; };
    const set=(k,v)=>{ state[k]=v; state=R().tidy(state); draw(); };
    const flip=k=>()=>set(k, state[k]==='is' ? 'is not' : 'is');
    const swap=k=>()=>set(k, state[k]==='and' ? 'or' : 'and');
    /* BOTH RULES, OFF THE SAME LIST routine.js KEYS THEM BY. Six controls
       written out by hand here is six chances for `iftellbatter` to be
       wired to `tellHot`, and a swap button that silently changes the
       wrong side of the wrong rule is the worst bug this panel could
       have — the student presses the thing the walkthrough ringed and the
       table answers about something else. */
    R().RULES.forEach(r=>{
      on_('if'+r.id+'hot',    flip(r.hot));
      on_('if'+r.id+'batter', flip(r.batter));
      on_('if'+r.id+'join',   swap(r.join));
    });
    walk();
  }

  /* ------------------------------------------------------- the walkthrough
     Redrawn on every change, because it is read off the program rather
     than counted: fix the faults in any order and the step that is still
     wrong is the one on screen. Undo a fix and its step comes back. */
  /* WHICH CONTROL A STEP IS ABOUT, by the name routine.js calls it. The
     two rules' six entries are built off RULES rather than typed out, for
     the same reason their handlers are: a ring that lands on the other
     rule's control points a student at a block that is not wrong.

     ASKED FOR, NOT BUILT AT LOAD. Every other reference to routine.js in
     this file goes through R() precisely so that the order the two script
     tags happen to be in is not load-bearing, and a map built once at load
     would be the one line in here that is. */
  function holes(){
    /* Nothing but the two questions' six controls now. The loop, the
       stride and the kitchen `if` were the other four, and they went with
       the lesson they belonged to. */
    const h={};
    (R().RULES||[]).forEach(r=>{ h[r.hot]='if'+r.id+'hot';
                                 h[r.batter]='if'+r.id+'batter';
                                 h[r.join]='if'+r.id+'join'; });
    return h;
  }

  /* EVERY MORNING, WHILE THEY ARE LOOKING AT THE RULE. A boolean cannot be
     checked by reading it — that is the whole reason it is hard — so the
     four mornings are on screen next to it, with what the rule does to
     each one and what it should have done. It is the arithmetic line of
     the motion step, for a question that has no arithmetic in it.

     AND IT ANSWERS THE QUESTION THE STEP IS ASKING, which is not always
     the same question. While the first rule is being fixed the only thing
     that matters is whether he COOKS on a morning: the second rule is
     still wrong, so a full table shows red rows that are somebody else's
     fault and a count underneath it that does not match them. It said
     "2 of the four mornings come out wrong" over three red rows, which is
     the console contradicting itself on screen.

     So the cook step gets a cook table — does he, should he — and the
     `else if` step gets the whole thing, by which time the whole thing is
     what the student is responsible for. */
  /* What he OUGHT to do when a question says yes, for the last column of
     that question's table. Read off routine.js's own rule list rather
     than kept here: six questions is six of these, and a second copy of
     them is a second place for them to be wrong. */
  const ought = which => {
    const r=(R().RULES||[]).find(x=>x.id===which);
    return r ? r.did : 'answer yes';
  };
  /* ONE QUESTION AT A TIME WHILE ONE QUESTION IS WHAT THEY OWE.

     While the first is being fixed the only thing that matters is what IT
     answers on a morning: the second is still wrong, so a table of what he
     DOES shows red rows that are somebody else's fault and a count
     underneath that does not match them. So each step gets a table of its
     own question — does it say yes, should it — and once both are right
     the whole thing is what the student is responsible for.

     BOTH COLUMNS COME OUT OF mornings(), which judges each question
     separately for exactly this reason. */
  function table(which){
    /* ALWAYS THE ONE QUESTION'S OWN COLUMN. There used to be a second
       branch here for "no particular question", which drew what he DOES
       across all of them and judged it against whether he ought to cook —
       a reading that only made sense while there were exactly two rules
       and one of them was cooking. With six it is meaningless, and the
       per-question table was always the better one anyway: while a
       question is being fixed, the only thing that matters is what IT
       answers on a morning, and the others being wrong is somebody
       else's row. */
    const rows = R().mornings(state).map(r=>{
      const q=r[which] || { ok:true, got:false, want:false };
      return { hot:r.hot, batter:r.batter, ok:q.ok,
               did:   q.got  ? say('yes') : say('no'),
               ought: q.want ? say('yes') : say('no') };
    });
    return `<table class="morns"><tr>
        <th>${say('pan')}</th><th>${say('batter')}</th>
        <th>${say('he')}</th><th></th></tr>` +
      rows.map(r=>`<tr class="${r.ok?'m-ok':'m-no'}">
        <td>${r.hot?say('hot'):say('cold')}</td>
        <td>${r.batter?say('yes'):say('no')}</td>
        <td>${r.did}</td>
        <td>${r.ok?'\u2713':say('should {w}',{w:r.ought})}</td>
      </tr>`).join('') + '</table>';
  }

  function walk(){
    const u=dom(), st=R().step(state);
    if(!st){
      u.step.className='clear';
      /* NOT A COUNT. It said "All six" when there were six decisions and
         went on saying it when there were nine — a label that has to be
         kept in step with a number nobody remembers it depends on is a
         label that is wrong within a month. */
      u.step.innerHTML='<span class="no">'+say('Nothing left')+'</span>'+
        say('That is the program. Press <b>RUN</b> and watch him.');
      return;
    }
    u.step.className='';
    u.step.innerHTML='<span class="no">'+
      say('Fault {n} of {m}',{n:st.n,m:st.of})+
      ' \u00b7 <em>'+say(st.topic)+'</em></span>'+
      st.say +
      (st.help ? '<div class="vocab">'+st.help+'</div>' : '') +
      /* EVERY STEP IS A QUESTION NOW, so every step gets its question's
         table. This used to name the only two there were. */
      (st.id ? table(st.id) : '');
    const e=$('#'+holes()[st.hole], u.el);
    if(e) e.classList.add('ring');
  }

  function runIt(){
    const u=dom(), r=R().run(state);
    u.trace.innerHTML = r.trace.map(l=>`<div class="${l.kind}">${esc(l.text)}</div>`).join('');
    u.why.innerHTML = r.ok ? '' : (r.why || '');
    u.win.classList.toggle('hidden', !r.ok);
    /* AND SCROLL TO IT. The two columns wrap into one on anything narrower
       than about seven hundred, which puts "what Ion does" below the whole
       program — so pressing RUN and failing looked exactly like pressing
       RUN and nothing happening. The trace is the answer to the button;
       it has to be where the button was. */
    try{ u.trace.scrollIntoView({ behavior:'smooth', block:'center' }); }
    catch(e){ u.trace.scrollIntoView(false); }
    if(!r.ok) return;
    u.win.textContent = say('Breakfast. He is up.');
    if(done) return;
    done=true;
    u.go.disabled=true;
    /* AND OUT OF THE WAY. The console used to hold the screen here for
       five and a half seconds while a student read five commented-out
       lines somebody else had left at the end of his routine — the whole
       reveal of who has been inside him, delivered as a footnote to a
       panel they had already finished with. It is a scene now, and it is
       his, so the only thing left to do here is get off the screen: the
       thing they fixed is behind this panel and the point is watching it
       get up. */
    setTimeout(()=>{ close(); if(opts && opts.onFixed) opts.onFixed(); }, 1100);
  }

  /* ----------------------------------------------------------------- open */
  function openIt(o){
    if(open) return;
    if(!R()){ console.warn('IONFIX: routine.js is not loaded'); return; }
    opts=o||{}; open=true; done=false;
    state=R().broken();
    const u=dom();
    u.el.classList.remove('hidden');
    u.go.disabled=false;
    u.win.classList.add('hidden'); u.win.textContent='';
    u.why.textContent='';
    u.trace.innerHTML=`<div class="idle">${say('Press RUN and watch what he does.')}</div>`;
    draw();
    /* The world keeps running underneath — Ion is still breathing behind
       the panel — but the mouse belongs to the console. */
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
