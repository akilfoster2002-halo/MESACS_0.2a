/* =====================================================================
   ASK — the tutor's panel, inside the editor.

   It lives in the block editor because that is where being stuck
   happens. What it sends with every question is the thing that makes it
   worth asking: the mission, the step of the walkthrough, the blocks on
   the palette, and THE SCRIPT AS IT IS ON SCREEN — written out in the
   same words the blocks are written in, so "your `if` is under the loop
   rather than inside it" is a sentence it can actually say.

   THE SCRIPT IS RENDERED FROM BLOCKS.parts, not from the op names. A
   tutor told `ctrl.if` and `sense.key` would answer in those words, and
   no child has ever seen them — they see `if <key [d] pressed?> then`.
   The indentation is the nesting, which is the half of a Scratch program
   that matters most and the half a flat list would throw away.

   NOTHING IS STORED. The conversation is in this tab and goes when it
   does — same as the room's chat, same as the missions themselves.

   NO KEY ON THE SERVER MEANS NO BUTTON. A school that does not want this,
   or cannot pay for it, deploys with nothing set and never sees it.
   ===================================================================== */
/* NOT `TUTOR`. tutorial.js has owned that name since long before this
   existed and loads after it, so the two quietly overwrote each other and
   the button threw on its first click. */
window.ASK = (function(){
  const $ = s => document.querySelector(s);
  const T = s => (window.t ? t(s) : s);

  let open=false, live=false, asking=false;
  let turns=[];                 // {role:'you'|'tutor', text}
  /* WHERE THE WINDOW IS, and whether it is rolled up. Kept in memory for
     the life of the tab and nowhere else: a child who drags it out of the
     way should find it there when they close and reopen it, and a child
     on the next machine should not inherit where somebody else put it. */
  let placed=null;              // {left, top} once it has been dragged
  let rolled=false;             // minimised to its title bar

  /* ------------------------------------------------ the script, in words
     The same walk the editor and the VM do, which is why it cannot drift
     from what is on screen.

     DRAWN WITH GUIDE BARS, NOT SPACES, and that is not decoration. The
     difference between a working script and the commonest bug in the
     game — a conditional sitting BESIDE the loop instead of inside it —
     used to be two spaces on two lines, and a reader skimming it will
     get that wrong. It did: asked about a robot whose `if` was outside
     the loop, the tutor said the `if` "gets checked again and again",
     which is the opposite of true and exactly the wrong thing to tell a
     child who is stuck on it.

     AN EMPTY MOUTH SAYS SO, for the same reason. A `forever` with
     nothing in it is the shape of that bug, and a blank line does not
     look like anything. */
  const BAR='\u2502 ';
  function write(list, depth, out){
    (list||[]).forEach(bk=>{
      const bd=window.BLOCKS && BLOCKS.of(bk.op);
      if(!bd) return;
      const lead=BAR.repeat(depth);
      out.push(lead + words(bk));
      const wraps = bd.kind==='c' || bd.kind==='c2';
      if(wraps && !(bk.body||[]).length) out.push(BAR.repeat(depth+1)+'(nothing inside it)');
      else if(bk.body) write(bk.body, depth+1, out);
      if(bd.kind==='c2'){
        out.push(lead+'else');
        if(!(bk.body2||[]).length) out.push(BAR.repeat(depth+1)+'(nothing inside it)');
        else write(bk.body2, depth+1, out);
      }
    });
  }
  /* one block, with whatever is sitting in its slots */
  function words(bk){
    const bd=BLOCKS.of(bk.op); if(!bd) return String(bk.op);
    return BLOCKS.parts(bd.label).map(seg=>{
      if(seg[0]!=='%') return seg;
      const v=bk.args[seg[1]];
      if(v && typeof v==='object' && v.op) return '<'+words(v)+'>';
      return '['+String(v==null?'':v)+']';
    }).join('');
  }
  function script(a){
    if(!a || !(a.scripts||[]).length) return '';
    const out=[];
    a.scripts.forEach((sc,i)=>{
      if(i) out.push('');
      out.push(sc.hat ? words(sc.hat) : '(a script with no hat on it)');
      write(sc.body, 1, out);
    });
    return out.join('\n');
  }

  /* What the tutor is told about where they are. Everything here is
     read live — there is no copy of it kept anywhere. */
  function context(){
    const c={};
    try{
      const a = window.CODER && CODER.actorName && window.VM
        ? VM.actorByName(CODER.actorName()) : null;
      c.script = script(a);
      if(window.RING && RING.active && window.STAGES){
        const s=STAGES.byIndex(RING.stage);
        c.stage=s.n+' — '+s.name+' ('+s.teach+')';
        c.goal=s.goal;
        const step=(s.steps||[])[window.COACH ? COACH.index : 0];
        if(step) c.step=String(step.say||'').replace(/<\/?b>/g,'');
        c.world = s.foe==='none' ? 'an empty ring'
                : s.foe==='dummy' ? 'Ambush is standing there as a training dummy'
                : 'Ambush is fighting back';
      }
      const pal=[...document.querySelectorAll('#cPal [data-op]')]
        .map(b=>{ const bd=BLOCKS.of(b.dataset.op); return bd?bd.label:null; })
        .filter(Boolean);
      if(pal.length) c.palette=pal;
    }catch(e){}
    return c;
  }

  /* --------------------------------------------------------- the panel */
  function render(){
    const el=$('#tutor'); if(!el) return;
    el.innerHTML=`
      <div class="tut-head" id="tutGrab">
        <b>${T('ASK')}</b>
        <span class="tut-key">${T('it will not do it for you')}</span>
        <button class="bx" id="tutMin" title="${rolled?T('open it back up'):T('roll it up')}"
          >${rolled?'▣':'▁'}</button>
        <button class="bx" id="tutShut" title="${T('close')}">✕</button>
      </div>
      <div class="tut-log" id="tutLog">${turns.length ? '' :
        `<p class="tut-hello">${T('Stuck? Ask about a block, or about what your robot is doing. '+
         'I can see your script.')}</p>`}</div>
      <form class="tut-ask" id="tutForm">
        <input id="tutIn" maxlength="600" autocomplete="off"
               placeholder="${T('why does my robot only move once?')}">
        <button class="btn small good" id="tutGo" ${asking?'disabled':''}>▸</button>
      </form>`;
    el.classList.toggle('rolled', rolled);
    const log=$('#tutLog');
    turns.forEach(t=>log.appendChild(bubble(t.role, t.text)));
    $('#tutShut').onclick=hide;
    $('#tutMin').onclick=()=>{ rolled=!rolled; render(); };
    grab($('#tutGrab'));
    $('#tutForm').onsubmit=e=>{ e.preventDefault(); send($('#tutIn').value); };
    /* ENTER SENDS IT, said out loud rather than left to the form's own
       implicit submission. That only fires under conditions this box has
       no business depending on — and pressing Enter after typing a
       question is not an advanced move, it is what everybody does. The
       game's global key handler already stands aside for anything with a
       caret in it, so this is the only thing that has to say so. */
    $('#tutIn').onkeydown=e=>{
      /* Asked three ways because keyboards, layouts and the numpad do not
         agree on which of these is filled in. */
      const enter = e.key==='Enter' || e.code==='Enter' ||
                    e.code==='NumpadEnter' || e.keyCode===13;
      if(!enter || e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      send(e.target.value);
    };
    log.scrollTop=log.scrollHeight;
  }
  /* --------------------------------------------- blocks, as blocks
     The tutor writes a block as {{ctrl.if}} and this draws the real
     thing: the same label, the same slots, the same category colour and
     the same shape the palette uses, off the same BLOCKS table. A child
     matching a picture to the palette beats a child matching a word.

     STILL BUILT AS NODES, NEVER AS innerHTML. Everything outside a
     marker is a text node, and the marker itself only ever produces a
     block that BLOCKS.of() recognises — so neither what a child typed
     nor what came back over the network can become markup. A marker
     naming something that is not a block is left as it arrived, because
     the honest thing to show is what was actually said. */
  const MARK=/\{\{\s*(your:)?([a-z]+\.[A-Za-z]+)\s*\}\}/g;
  /* TWO KINDS OF PICTURE, AND THE TUTOR SAYS WHICH.

     A chip was always drawn from the block's DEFAULTS, and that is right
     about half the time. "Go and find {{motion.changeBy}}" means the
     thing on the shelf, and the shelf says `change x by 0.2`; drawing
     their own values there would send a child hunting for a block that
     is not on the palette.

     But "your {{motion.changeBy}}" means the one in their script, and
     there the defaults are a lie. Asked about a script containing
     `change y by -0.2`, the tutor said "your change x by 0.2" — the
     words came from the tutor and the picture came from the palette, and
     they contradicted each other in front of a child who was already
     stuck. Filling every chip from the script instead just moved the
     contradiction: told to add a SECOND one on another axis, the answer
     drew their existing y and -0.2, which reads as an instruction to
     reuse the wrong axis.

     Neither picture is wrong. Which one is wanted is something only the
     sentence knows, so the sentence says: {{op}} is the block as it sits
     on the shelf, {{your:op}} is the one they built. And {{your:op}}
     only reaches into the script when there is NO DOUBT which block is
     meant — exactly one with that op in their whole project. Two of them
     and it draws the shelf version, because a picture of the wrong one
     of two is worse than a picture of neither. */
  function found(op){
    const hits=[];
    const dig=list=>(list||[]).forEach(bk=>{
      if(!bk || typeof bk!=='object') return;
      if(bk.op===op) hits.push(bk);
      Object.keys(bk.args||{}).forEach(k=>{
        const v=bk.args[k];
        if(v && typeof v==='object' && v.op) dig([v]);   // reporters in slots
      });
      dig(bk.body); dig(bk.body2);
    });
    try{
      const a = window.CODER && CODER.actorName && window.VM
        ? VM.actorByName(CODER.actorName()) : null;
      ((a||{}).scripts||[]).forEach(sc=>{ if(sc.hat) dig([sc.hat]); dig(sc.body); });
    }catch(e){}
    return hits;
  }
  /* One block, drawn. `bk` is the student's own if we have it, and the
     nesting comes with it — `key [space] pressed?` sitting in an `if` is
     half of what makes their script recognisable, and a hollow ◇ there
     would be a picture of a block they have already filled in. */
  function draw(bd, bk, depth){
    const el=document.createElement('span');
    el.className='tut-blk cblk k-'+bd.kind;
    el.style.setProperty('--a', BLOCKS.catOf(bd.cat).a);
    el.title=BLOCKS.help(bd.op)||bd.label;
    BLOCKS.parts(bd.label).forEach(seg=>{
      if(seg[0]!=='%'){ el.appendChild(document.createTextNode(seg)); return; }
      const sp=bd.args[seg[1]], v=bk && bk.args ? bk.args[seg[1]] : undefined;
      if(v && typeof v==='object' && v.op && depth<3){
        const inner=BLOCKS.of(v.op);
        if(inner){ el.appendChild(draw(inner, v, depth+1)); return; }
      }
      const slot=document.createElement('i');
      slot.className='cslot';
      slot.textContent =
        (v!==undefined && v!==null && typeof v!=='object') ? String(v)
        : (sp && sp.def!==undefined ? String(sp.def)
        : (sp && sp.type==='bool' ? '\u25c7' : '\u2026'));
      el.appendChild(slot);
    });
    return el;
  }
  function chip(op, theirs){
    const bd=window.BLOCKS && BLOCKS.of(op);
    if(!bd) return null;
    /* Only {{your:op}} reaches into their script, and only when there is
       exactly one block it could mean. Anything else draws the shelf
       version — which is not a fallback so much as the other right
       answer. */
    const hits = theirs ? found(op) : [];
    return draw(bd, hits.length===1 ? hits[0] : null, 0);
  }
  /* the answer, with every marker swapped for the block it names */
  function drawn(text, into){
    let at=0;
    String(text).replace(MARK,(whole, own, op, i)=>{
      const block=chip(op, !!own);
      if(!block) return whole;                 // not a block: leave the words alone
      if(i>at) into.appendChild(document.createTextNode(text.slice(at,i)));
      into.appendChild(block);
      at=i+whole.length;
      return whole;
    });
    if(at<text.length) into.appendChild(document.createTextNode(text.slice(at)));
    return into;
  }

  /* Nodes, never innerHTML: what a child typed is not markup, and
     neither is what came back. */
  function bubble(role, text){
    const d=document.createElement('div');
    d.className='tut-line '+(role==='you'?'you':'tutor');
    if(role==='you') d.textContent=text; else drawn(text, d);
    return d;
  }

  /* ------------------------------------------------- moving it about
     A panel pinned to one corner is a panel that sits on top of whatever
     you are being told to look at. This one is dragged by its title bar.

     IT SWITCHES FROM CORNER-ANCHORED TO POSITIONED ON THE FIRST DRAG.
     Until then it is right/bottom, so it stays in its corner as the
     window resizes; once somebody has put it somewhere, that somewhere
     is a left/top and it stays where it was put.

     AND IT CANNOT BE LOST. Everything is clamped so a piece of the title
     bar is always on screen — a window dragged off the edge with no way
     to reach it again is a window a nine-year-old never gets back. */
  const EDGE=28;                // how much must stay reachable
  function clamp(left, top, el){
    const w=el.offsetWidth||320, h=el.offsetHeight||100;
    return {
      left: Math.max(EDGE-w, Math.min(left, innerWidth-EDGE)),
      top:  Math.max(0,      Math.min(top,  innerHeight-EDGE))
    };
  }
  function put(el, at){
    placed=at;
    el.style.left=at.left+'px';
    el.style.top =at.top+'px';
    el.style.right='auto';
    el.style.bottom='auto';
  }
  function grab(handle){
    if(!handle) return;
    handle.onpointerdown=e=>{
      /* the buttons in the title bar are buttons, not handles */
      if(e.target.closest('button')) return;
      const el=$('#tutor'); if(!el) return;
      const box=el.getBoundingClientRect();
      const dx=e.clientX-box.left, dy=e.clientY-box.top;
      handle.setPointerCapture(e.pointerId);
      el.classList.add('moving');
      const move=ev=>put(el, clamp(ev.clientX-dx, ev.clientY-dy, el));
      const drop=()=>{
        handle.onpointermove=null; handle.onpointerup=null; handle.onpointercancel=null;
        el.classList.remove('moving');
        try{ handle.releasePointerCapture(e.pointerId); }catch(err){}
      };
      handle.onpointermove=move;
      handle.onpointerup=drop;
      handle.onpointercancel=drop;
      e.preventDefault();
    };
  }
  /* A window can be left somewhere that a smaller screen no longer has.
     Checked whenever the page changes size rather than only on a drag. */
  addEventListener('resize',()=>{
    const el=$('#tutor');
    if(el && placed && !el.classList.contains('hidden')) put(el, clamp(placed.left, placed.top, el));
  });

  function show(){
    if(!live) return;
    open=true;
    const el=$('#tutor');
    el.classList.remove('hidden');
    render();
    if(placed) put(el, clamp(placed.left, placed.top, el));
    const i=$('#tutIn'); if(i) i.focus();
  }
  function hide(){ open=false; $('#tutor').classList.add('hidden'); }
  function toggle(){ open?hide():show(); }

  /* ----------------------------------------------------------- asking */
  async function send(q){
    q=String(q||'').trim();
    if(!q || asking) return;
    asking=true;
    turns.push({ role:'you', text:q });
    turns.push({ role:'tutor', text:'…' });
    render();
    const mine=turns[turns.length-1];
    const paint=()=>{
      const log=$('#tutLog'); if(!log) return;
      const rows=log.querySelectorAll('.tut-line');
      const row=rows[rows.length-1];
      if(!row) return;
      /* Redrawn from scratch each time rather than appended to: a marker
         arrives in pieces — "{{ctrl" then ".if}}" — so anything that
         rendered as it went would show half a brace and then replace it.
         Whole-text each repaint is a few nodes and nobody can see it. */
      row.textContent='';
      drawn(mine.text, row);
      log.scrollTop=log.scrollHeight;
    };
    try{
      const r=await fetch('/api/tutor',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          question:q,
          /* the last few turns only, and never the streaming placeholder */
          history:turns.slice(0,-2).slice(-8).map(t=>
            ({ role:t.role==='you'?'user':'assistant', text:t.text })),
          context:context()
        })
      });
      if(!r.ok || !r.body){
        let msg='The tutor could not answer just now.';
        try{ const j=await r.json(); if(j && j.error) msg=j.error; }catch(e){}
        mine.text=msg; paint(); return;
      }
      mine.text='';
      const reader=r.body.getReader(), dec=new TextDecoder();
      let buf='';
      for(;;){
        const { value, done } = await reader.read();
        if(done) break;
        buf+=dec.decode(value,{stream:true});
        /* one SSE frame per blank line */
        let cut;
        while((cut=buf.indexOf('\n\n'))>=0){
          const frame=buf.slice(0,cut); buf=buf.slice(cut+2);
          const kind=(/^event: (\w+)/m.exec(frame)||[])[1];
          const raw =(/^data: (.*)$/m.exec(frame)||[])[1];
          if(!kind || raw===undefined) continue;
          let data; try{ data=JSON.parse(raw); }catch(e){ continue; }
          if(kind==='say'){ mine.text+=data; paint(); }
          else if(kind==='fail'){ mine.text=String(data); paint(); }
        }
      }
      if(!mine.text) mine.text='(no answer came back)';
      paint();
    }catch(e){
      mine.text='The tutor could not be reached.'; paint();
    }finally{
      asking=false;
      const go=$('#tutGo'); if(go) go.disabled=false;
      const i=$('#tutIn'); if(i){ i.value=''; i.focus(); }
    }
  }

  /* Is there one? ASKED ONCE, AND ONLY ONCE.

     The editor's bar is rebuilt on every render and twice a second by
     its own tick, and this used to fetch every single time it was
     called: four requests a second, for as long as the editor was open,
     to ask a question whose answer is decided by an environment variable
     and cannot change while the page is loaded. Thirty children in a
     room made that a hundred and twenty requests a second, for nothing.

     So the request happens once and the answer is kept. What every
     rebuild still needs is the HANDLER put back, because the button
     element itself is new each time — that part is free and synchronous,
     and it runs immediately rather than waiting on the network, so the
     button never flickers away while an answer we already have is being
     re-fetched. */
  let asked=null;
  function wire(){
    const b=$('#tutorBtn');
    if(!b) return;
    b.classList.toggle('hidden', !live);
    b.onclick=toggle;
  }
  function boot(){
    if(asked===null){
      asked = fetch('/api/tutor/on')
        .then(r=>r.json())
        .then(j=>!!(j && j.tutor))
        .catch(()=>false)
        .then(v=>{ live=v; wire(); return v; });
    }
    wire();                       // with whatever is already known
    return asked;
  }
  /* A mission is a fresh room, so it is a fresh conversation too. */
  function clear(){ turns=[]; if(open) render(); }

  return { boot, show, hide, toggle, clear, context, script,
           get live(){ return live; }, get open(){ return open; } };
})();
