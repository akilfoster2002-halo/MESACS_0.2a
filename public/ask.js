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

  /* ------------------------------------------------ the script, in words
     Indented, so the shape is visible. This is the same walk the editor
     and the VM do, which is why it cannot drift from what is on screen. */
  function write(list, depth, out){
    (list||[]).forEach(bk=>{
      const bd=window.BLOCKS && BLOCKS.of(bk.op);
      if(!bd) return;
      out.push('  '.repeat(depth) + words(bk));
      if(bk.body)  write(bk.body,  depth+1, out);
      if(bk.body2){ out.push('  '.repeat(depth)+'else'); write(bk.body2, depth+1, out); }
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
      <div class="tut-head">
        <b>${T('ASK')}</b>
        <span class="tut-key">${T('it will not do it for you')}</span>
        <button class="bx" id="tutShut">✕</button>
      </div>
      <div class="tut-log" id="tutLog">${turns.length ? '' :
        `<p class="tut-hello">${T('Stuck? Ask about a block, or about what your robot is doing. '+
         'I can see your script.')}</p>`}</div>
      <form class="tut-ask" id="tutForm">
        <input id="tutIn" maxlength="600" autocomplete="off"
               placeholder="${T('why does my robot only move once?')}">
        <button class="btn small good" id="tutGo" ${asking?'disabled':''}>▸</button>
      </form>`;
    const log=$('#tutLog');
    turns.forEach(t=>log.appendChild(bubble(t.role, t.text)));
    $('#tutShut').onclick=hide;
    $('#tutForm').onsubmit=e=>{ e.preventDefault(); send($('#tutIn').value); };
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
  const MARK=/\{\{\s*([a-z]+\.[A-Za-z]+)\s*\}\}/g;
  function chip(op){
    const bd=window.BLOCKS && BLOCKS.of(op);
    if(!bd) return null;
    const el=document.createElement('span');
    el.className='tut-blk cblk k-'+bd.kind;
    el.style.setProperty('--a', BLOCKS.catOf(bd.cat).a);
    el.title=BLOCKS.help(op)||bd.label;
    BLOCKS.parts(bd.label).forEach(seg=>{
      if(seg[0]!=='%'){ el.appendChild(document.createTextNode(seg)); return; }
      const sp=bd.args[seg[1]], slot=document.createElement('i');
      slot.className='cslot';
      slot.textContent = sp && sp.def!==undefined ? String(sp.def)
                       : (sp && sp.type==='bool' ? '◇' : '…');
      el.appendChild(slot);
    });
    return el;
  }
  /* the answer, with every marker swapped for the block it names */
  function drawn(text, into){
    let at=0;
    String(text).replace(MARK,(whole, op, i)=>{
      const block=chip(op);
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

  function show(){
    if(!live) return;
    open=true;
    $('#tutor').classList.remove('hidden');
    render();
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

  /* Is there one? Asked once, and the button only exists if there is. */
  async function boot(){
    try{
      const r=await fetch('/api/tutor/on');
      const j=await r.json();
      live=!!(j && j.tutor);
    }catch(e){ live=false; }
    const b=$('#tutorBtn');
    if(b){ b.classList.toggle('hidden', !live); b.onclick=toggle; }
    return live;
  }
  /* A mission is a fresh room, so it is a fresh conversation too. */
  function clear(){ turns=[]; if(open) render(); }

  return { boot, show, hide, toggle, clear, context, script,
           get live(){ return live; }, get open(){ return open; } };
})();
