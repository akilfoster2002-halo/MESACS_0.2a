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
      .ifwrap{width:min(940px,calc(100vw - 40px));max-height:calc(100vh - 56px);
              background:#171225;border:2px solid #6b5f8f;border-radius:18px;
              box-shadow:0 24px 70px #000b;display:flex;flex-direction:column;overflow:hidden}
      .ifhead{display:flex;align-items:center;gap:12px;padding:14px 18px;
              background:#1f1833;border-bottom:2px solid #372c56}
      .ifhead img{width:42px;height:42px;border-radius:10px;object-fit:cover;object-position:50% 12%;
                  background:#241d33}
      .ifhead b{font:700 15px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:#8ff0ff}
      .ifhead span{color:#9b8fc4;font-size:13px}
      .ifbody{display:flex;gap:18px;padding:18px;overflow:auto;flex-wrap:wrap}
      .ifcol{flex:1 1 380px;min-width:320px}
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
      #ionfix .bool-side{display:inline-flex;align-items:center;gap:6px;font-size:16px}
      #ionfix .cond.join{font-weight:700;letter-spacing:.06em}
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
      /* SOMEBODY ELSE'S HANDWRITING. Not a block — it is commented out and
         it never ran, and drawing it as a block would say it is part of
         the program. A torn strip of paper taped inside the case. */
      #ionfix .note{margin-top:14px;padding:12px 14px;border-radius:10px;
             background:#2a2118;border:2px dashed #b08a4a;color:#e8c98a;
             font:400 14px/1.6 ui-monospace,monospace;white-space:pre-wrap}
      #ionfix .note-h{color:#b08a4a;font-size:11px;letter-spacing:.1em;
             text-transform:uppercase;margin-bottom:8px;white-space:normal}
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
             <span>${say('His motors will not take a stride longer than 10.')}</span></div>
      </div>
      <div class="ifbody">
        <div class="ifcol"><h3>${say('The program')}</h3>
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

  /* A forever has no notch under it, because nothing put there could ever
     run. The shape is the warning — code.js says so, and it is the whole
     of fault one. */
  function loopHead(s){
    /* THE WORD IS THE CONTROL. A separate little swap icon beside it is a
       thing to find before it is a thing to press; code.js makes the
       condition itself the button for exactly that reason, and a loop that
       is the wrong loop is answered by clicking the loop. */
    const kind = s.loop==='repeat'
      ? `<button class="cond" id="ifloop">${say('repeat')}</button>
         <button class="cnt" id="ifdec">\u2212</button>
         <span class="cnt-n" id="iftimes">${s.times}</span>
         <button class="cnt" id="ifinc">+</button>
         <span class="blk-times">${say('times')}</span>`
      : `<button class="cond" id="ifloop">${say('forever')}</button>`;
    return `<div class="blk rep${s.loop==='forever'?' flat':''}" style="--c:${C.loop}">
        <div class="blk-head">${kind}</div>
        <div class="blk-body">
          <div class="blk num" style="--c:${C.move}">
            <span class="blk-name">${say('move')}</span>
            <input class="numin" id="ifstride" type="text" inputmode="numeric"
                   value="${s.stride}" size="3" aria-label="${say('steps')}">
            <span class="blk-times">${say('steps')}</span>
          </div>
        </div>
        <div class="blk-foot"></div>
      </div>`;
  }

  /* IF AND ELSE AS ONE BLOCK WITH TWO BODIES, which is the shape it has in
     Scratch and in blocks.js. code.js's own `if` has no else — it is a
     console for programs that run once — so this is its head, its body and
     its foot with a second bar between them. */
  /* THE OUTER IF AND THE INNER ONE. Two C-blocks, the second inside the
     first's body, which is what a nested condition IS — and drawing it any
     other way would teach a shape that does not exist. */
  function ifBlock(s){
    return `<div class="blk rep" style="--c:${C.ifc}">
        <div class="blk-head">
          <span class="blk-name">${say('if he')}</span>
          <button class="cond" id="ifwhere">${say(s.where)}</button>
          <span class="blk-times">${say('in the kitchen')}</span>
        </div>
        <div class="blk-body">${boolBlock(s)}</div>
        <div class="blk-head mid"><span class="blk-name">${say('else')}</span></div>
        <div class="blk-body">
          <div class="blk" style="--c:${C.act}">
            <span class="blk-name">${say('say \u201cmy legs will not\u2026\u201d')}</span></div>
        </div>
        <div class="blk-foot"></div>
      </div>`;
  }

  /* THE BOOLEAN. Two questions and the word that joins them, and all three
     are buttons — because which of them is wrong is the thing being
     assessed, and a student has to be able to try the other one. */
  function boolBlock(s){
    return `<div class="blk rep" style="--c:${C.bool}">
        <div class="blk-head">
          <span class="blk-name">${say('if')}</span>
          <span class="bool-side">${say('the pan')}
            <button class="cond" id="ifhot">${say(s.hot)}</button>
            ${say('hot')}</span>
          <button class="cond join" id="ifjoin">${say(s.join)}</button>
          <span class="bool-side">${say('there')}
            <button class="cond" id="ifbatter">${say(s.batter)}</button>
            ${say('batter')}</span>
        </div>
        <div class="blk-body">
          <div class="blk" style="--c:${C.act}">
            <span class="blk-name">${say('make pancakes')}</span></div>
        </div>
        <div class="blk-head mid"><span class="blk-name">${say('else')}</span></div>
        <div class="blk-body">
          <div class="blk" style="--c:${C.act}">
            <span class="blk-name">${say('wait')}</span></div>
        </div>
        <div class="blk-foot"></div>
      </div>`;
  }

  function draw(){
    const u=dom(), s=state;
    u.script.innerHTML = loopHead(s) + ifBlock(s);

    const on_=(id,fn)=>{ const e=$('#'+id,u.el); if(e) e.onclick=fn; };
    const set=(k,v)=>{ state[k]=v; state=R().tidy(state); draw(); };
    const flip=k=>()=>set(k, state[k]==='is' ? 'is not' : 'is');
    on_('ifloop',  ()=>set('loop', s.loop==='repeat' ? 'forever' : 'repeat'));
    on_('ifdec',   ()=>set('times', s.times-1));
    on_('ifinc',   ()=>set('times', s.times+1));
    on_('ifwhere', flip('where'));
    on_('ifhot',   flip('hot'));
    on_('ifbatter',flip('batter'));
    on_('ifjoin',  ()=>set('join', s.join==='and' ? 'or' : 'and'));
    const n=$('#ifstride',u.el);
    if(n){
      /* Typed, like every other number in this language. Read on the way
         out rather than clamped on the way in, or a box you are half way
         through emptying snaps to 0 under your hands. */
      n.oninput=()=>{ const v=n.value.replace(/[^0-9]/g,'');
                      if(v!==n.value) n.value=v;
                      state.stride=+v||0; walk(); };
      n.onchange=()=>set('stride', +n.value||0);
    }
    walk();
  }

  /* ------------------------------------------------------- the walkthrough
     Redrawn on every change, because it is read off the program rather
     than counted: fix the faults in any order and the step that is still
     wrong is the one on screen. Undo a fix and its step comes back. */
  const HOLE = { loop:'ifloop', times:'iftimes', stride:'ifstride',
                 where:'ifwhere', hot:'ifhot', batter:'ifbatter', join:'ifjoin' };

  /* EVERY MORNING, WHILE THEY ARE LOOKING AT THE RULE. A boolean cannot be
     checked by reading it — that is the whole reason it is hard — so the
     four mornings are on screen next to it, with what the rule does to
     each one and what it should have done. It is the arithmetic line of
     the motion step, for a question that has no arithmetic in it. */
  function table(){
    const rows=R().mornings(state);
    return `<table class="morns"><tr>
        <th>${say('pan')}</th><th>${say('batter')}</th>
        <th>${say('he')}</th><th></th></tr>` +
      rows.map(r=>`<tr class="${r.ok?'m-ok':'m-no'}">
        <td>${r.hot?say('hot'):say('cold')}</td>
        <td>${r.batter?say('yes'):say('no')}</td>
        <td>${r.got?say('cooks'):say('waits')}</td>
        <td>${r.ok?'\u2713':say('should {w}',{w:r.want?say('cook'):say('wait')})}</td>
      </tr>`).join('') + '</table>';
  }

  function walk(){
    const u=dom(), st=R().step(state);
    if(!st){
      u.step.className='clear';
      u.step.innerHTML='<span class="no">'+say('All six')+'</span>'+
        say('That is the program. Press <b>RUN</b> and watch him.');
      return;
    }
    u.step.className='';
    u.step.innerHTML='<span class="no">'+
      say('Fault {n} of {m}',{n:st.n,m:st.of})+
      ' \u00b7 <em>'+say(st.topic)+'</em></span>'+
      st.say +
      (st.help ? '<div class="vocab">'+st.help+'</div>' : '') +
      (st.id==='bool' ? table() : '');
    const e=$('#'+HOLE[st.hole], u.el);
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
    /* ================================================ AND THE NOTE
       The last thing in his routine, commented out so it has never run,
       and not in his handwriting. It is shown only now: until the program
       works there is a robot on the floor, and nobody reads footnotes with
       a robot on the floor. Appended to the program rather than to the
       trace, because it is a thing that is IN him. */
       if(r.note){
         const el=document.createElement('div');
         el.className='note';
         el.innerHTML = '<div class="note-h">'+say('\u2026and this, at the end. Commented out. Never run.')+'</div>'
           + r.note.lines.map(l=>'<div>'+esc(l)+'</div>').join('');
         u.script.appendChild(el);
         try{ el.scrollIntoView({ behavior:'smooth', block:'center' }); }catch(e){}
       }
    /* Long enough to read four lines of somebody else's handwriting, and
       then out of the way: the thing they fixed is behind this panel and
       the whole point is watching it get up. */
    setTimeout(()=>{ close(); if(opts && opts.onFixed) opts.onFixed(); },
               r.note ? 4200 : 1100);
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
