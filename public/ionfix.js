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
      .blk{border-radius:9px;padding:9px 12px;margin:0 0 7px;color:#16202b;
           font:600 15px/1.35 system-ui,sans-serif;display:flex;flex-wrap:wrap;
           align-items:center;gap:7px;box-shadow:0 2px 0 #0003}
      .blk.nest{margin-left:22px}
      .blk .lbl{opacity:.85}
      .hole{background:#fffffff0;border:2px solid #16202bcc;border-radius:7px;
            font:700 15px/1 ui-monospace,monospace;color:#16202b;padding:4px 7px;
            min-width:52px;text-align:center}
      select.hole{padding:4px 5px}
      input.hole{width:62px}
      .hole.bad{border-color:#c0392b;box-shadow:0 0 0 3px #c0392b44}
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
        <div class="ifcol"><h3>${say('The program')}</h3><div id="ifscript"></div>
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
    ui={ el, script:$('#ifscript',el), trace:$('#iftrace',el),
         why:$('#ifwhy',el), win:$('#ifwin',el),
         go:$('#ifgo',el), shut:$('#ifclose',el) };
    ui.go.onclick=()=>runIt();
    ui.shut.onclick=()=>close();
    return ui;
  }

  /* ------------------------------------------------------------- drawing */
  const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function block(cat, fallback, nest, inner){
    return `<div class="blk${nest?' nest':''}" style="background:${tint(cat,fallback)}">${inner}</div>`;
  }
  function draw(){
    const u=dom(), s=state, Rt=R();
    u.script.innerHTML =
      block('events','#ffd8a8',false, `<span class="lbl">${say('when ▶ clicked')}</span>`) +
      block('control','#ffb4a2',false,
        `<select class="hole" id="ifloop">
           <option value="forever"${s.loop==='forever'?' selected':''}>${say('forever')}</option>
           <option value="repeat"${s.loop==='repeat'?' selected':''}>${say('repeat')}</option>
         </select>` +
        (s.loop==='repeat'
          ? `<input class="hole" id="iftimes" type="number" min="0" max="${Rt.REPEAT_MAX}" value="${s.times}">
             <span class="lbl">${say('times')}</span>`
          : '')) +
      block('motion','#8fd3ff',true,
        `<span class="lbl">${say('move')}</span>
         <input class="hole" id="ifstride" type="number" min="0" max="${Rt.STRIDE_MAX}" value="${s.stride}">
         <span class="lbl">${say('steps')}</span>`) +
      block('control','#ffb4a2',false,
        `<span class="lbl">${say('if he')}</span>
         <select class="hole" id="iftest">
           <option value="is"${s.test==='is'?' selected':''}>${say('is')}</option>
           <option value="is not"${s.test==='is not'?' selected':''}>${say('is not')}</option>
         </select>
         <span class="lbl">${say('in the kitchen')}</span>`) +
      block('looks','#cdb4f6',true, `<span class="lbl">${say('make breakfast')}</span>`) +
      block('control','#ffb4a2',false, `<span class="lbl">${say('else')}</span>`) +
      block('looks','#cdb4f6',true, `<span class="lbl">${say('say “my legs will not…”')}</span>`);

    const bind=(id,key,num)=>{
      const e=$('#'+id,u.el); if(!e) return;
      e.onchange=()=>{ state[key] = num ? +e.value : e.value;
                       state=R().tidy(state); draw(); };
      if(num) e.oninput=e.onchange;
    };
    bind('ifloop','loop'); bind('iftimes','times',true);
    bind('ifstride','stride',true); bind('iftest','test');
  }

  /* --------------------------------------------------------------- run it */
  function runIt(){
    const u=dom(), r=R().run(state);
    u.trace.innerHTML = r.trace.map(l=>`<div class="${l.kind}">${esc(l.text)}</div>`).join('');
    u.why.textContent = r.ok ? '' : (r.why || '');
    u.win.classList.toggle('hidden', !r.ok);
    if(!r.ok) return;
    u.win.textContent = say('Breakfast. He is up.');
    if(done) return;
    done=true;
    u.go.disabled=true;
    /* A beat to read the last line of the trace, and then out of the way:
       the thing they fixed is lying on the floor behind this panel and
       the whole point is watching it get up. */
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
