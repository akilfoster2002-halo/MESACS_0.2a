/* =====================================================================
   ARCADE — where a game somebody made stops being theirs alone.

   Everything needed to MAKE a game was already here: blocks.js is the
   language, vm.js runs it, coder.js edits it, and Free Play is the room
   it all happens in. What was missing is the half that makes any of it
   worth doing — somebody else playing it.

   So this file is not an engine. It is a shelf, a way onto it, and a way
   to say what you thought:

     FREE PLAY  →  PUBLISH  →  a cabinet on VOLTA  →  somebody plays it
                                                   →  they rate it
                                                   →  the author reads that

   THREE THINGS IT IS CAREFUL ABOUT.

   A VISITOR NEVER WRITES ON THE AUTHOR. Playing somebody's game runs
   their project in your browser, and their program can spawn clones, move
   objects and set variables — none of which is saved anywhere. VM.adopt
   puts the project in memory and turns saving off; walking out throws the
   lot away. You cannot break a game by playing it.

   EVERY WORD A CHILD WROTE IS RENDERED AS TEXT. Titles, blurbs and notes
   go in with textContent, never innerHTML. The server caps their length;
   this file makes sure they cannot be markup. Both, because either alone
   is one mistake away from a class discovering it.

   AND IT DEGRADES. No database, or signed out, and the arcade says which
   it is rather than showing an empty room and letting a child conclude
   nobody has made anything.
   ===================================================================== */
window.ARCADE = (function(){
  const $ = s => document.querySelector(s);
  let games=[], mine=[], now=null, mode=null, busy=false;
  /* THE WORKBENCH. Its own slot, not Free Play's sandbox: the arcade is
     where games are made now, and a child who walks into the arcade to
     carry on with their game should not find whatever they were last
     building in Free Play — nor lose it. Two rooms, two projects. */
  const SLOT='dq_arcade_build';
  /* What is on the bench, so PUBLISH can fill its own form in and a second
     publish updates the cabinet rather than opening another one. */
  let bench=null;
  /* The camera and the room we borrowed, so leaving puts them back. */
  let held=null;

  const api = async (path, body, method) => {
    const r = await fetch('/api'+path, {
      method: method || (body?'POST':'GET'),
      headers:{ 'Content-Type':'application/json' },
      credentials:'same-origin',
      body: body?JSON.stringify(body):undefined
    });
    let j={}; try{ j=await r.json(); }catch(e){}
    if(!r.ok || !j.ok) throw new Error(j.error || ('Error '+r.status));
    return j;
  };
  /* One helper, used everywhere a child's words reach the screen. */
  function text(tag, cls, str){
    const el=document.createElement(tag);
    if(cls) el.className=cls;
    el.textContent = str==null ? '' : String(str);
    return el;
  }
  const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5-Math.round(n));

  /* ------------------------------------------------------------ the shelf */
  function open(){
    mode='shelf';
    $('#arcade').classList.remove('hidden');
    $('#hud').classList.add('hidden');
    if(document.pointerLockElement) document.exitPointerLock();
    G.running=false;
    $('#arTitle').textContent=t('THE ARCADE');
    $('#arSub').textContent=t('Play what your class has made, then tell them what you thought — or make one yourself.');
    $('#arBack').textContent=t('Back to VOLTA ▶');
    const mk=$('#arMake');
    if(mk){
      mk.textContent=t('✚ MAKE A GAME');
      mk.onclick=()=>make(null);
      /* Making one is the half that needs a name to save under. */
      mk.classList.toggle('hidden', !(window.NET && NET.signedIn));
    }
    shelf();
  }
  function close(){
    $('#arcade').classList.add('hidden');
    mode=null;
    if(window.MENU && MENU.homeworld) MENU.homeworld();
  }
  async function shelf(){
    const grid=$('#arGrid');
    grid.innerHTML='';
    grid.appendChild(text('div','arnote', t('Opening the arcade…')));
    try{
      games=(await api('/arcade')).games||[];
    }catch(e){
      grid.innerHTML='';
      grid.appendChild(text('div','arnote',
        (window.NET && NET.signedIn) ? e.message
          : t('Sign in to see what your class has made.')));
      return;
    }
    /* Your own, so you can carry on with them. Failing quietly is right
       here — not being able to list your drafts should not stop you
       playing anybody else's. */
    mine=[];
    if(window.NET && NET.signedIn){
      try{ mine=(await api('/arcade/mine/list')).games||[]; }catch(e){}
    }
    grid.innerHTML='';
    if(mine.length){
      grid.appendChild(text('div','arhead', t('YOURS')));
      mine.forEach(g=>grid.appendChild(cabinet(g, true)));
      if(games.filter(g=>!isMine(g)).length)
        grid.appendChild(text('div','arhead', t('EVERYBODY ELSE')));
    }
    const theirs=games.filter(g=>!isMine(g));
    if(!theirs.length && !mine.length){
      grid.appendChild(text('div','arnote',
        t('Nobody has published a game yet. Press MAKE A GAME and be the first.')));
      return;
    }
    theirs.forEach(g=>grid.appendChild(cabinet(g)));
  }
  const isMine = g => !!(window.NET && NET.me && NET.me.id===g.author_id);
  function cabinet(g, editable){
    const b=document.createElement('button');
    b.className='cab'+(editable?' own':'');
    b.appendChild(text('div','cab-top', g.stage==='flat' ? t('2D') : t('3D')));
    b.appendChild(text('b','', g.title));
    b.appendChild(text('small','', g.blurb));
    b.appendChild(text('div','cab-by', t('by {n}',{n:g.author})));
    const row=document.createElement('div'); row.className='cab-row';
    row.appendChild(text('span','cab-stars', g.votes ? stars(g.stars) : t('not rated yet')));
    row.appendChild(text('span','cab-plays', t('{n} plays',{n:g.plays})));
    b.appendChild(row);
    if(editable){
      /* One card, two answers, decided by what was under the pointer —
         the same shape the mission cards use for START OVER. A nested
         button is not a button a browser will give you. */
      const e=text('span','cab-edit', '✎ '+t('OPEN'));
      e.dataset.edit='1';
      b.appendChild(e);
    }
    b.onclick=ev=>{
      if(editable && ev.target && ev.target.closest && ev.target.closest('[data-edit]'))
        return make(g);
      play(g.id);
    };
    return b;
  }

  /* ------------------------------------------------------- the workbench
     Making a game happens HERE now, in the arcade, rather than in Free
     Play. It is the same editor and the same VM — what changed is which
     door it is behind, which is the one that matters: a cabinet you can
     play and a bench you can build at, in the same room. */
  async function make(g){
    if(!(window.NET && NET.signedIn)) return say(t('Sign in to make a game.'));
    if(busy) return;
    bench = g ? { id:g.id, title:g.title, blurb:g.blurb, stage:g.stage } : null;
    mode='building';
    $('#arcade').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    G.running=true; G.stats.t0=performance.now();
    VM.useSlot(SLOT);
    if(g){
      /* Carrying on with one that is already in the arcade: fetch the
         project rather than trusting the shelf row, which carries only
         what a cabinet needs to show. */
      busy=true;
      try{ const r=await api('/arcade/'+g.id); VM.install(r.game.project, r.game.stage); }
      catch(e){ busy=false; say(e.message); return open(); }
      busy=false;
    }
    buildRoom('free');
    if(!g && !VM.project.actors.length) VM.wipe();
    updateLeaveBtn();
    if(window.CODER) CODER.show ? CODER.show() : null;
    /* No markup in these. say() sets textContent on purpose — everything
       else this file puts on screen was written by a child — so a <b> here
       would be four characters of angle brackets on the briefing card. */
    say(g ? t('{n} — press C to open the blocks, then PUBLISH.',{n:g.title})
          : t('A new game. Press C for the blocks, PUBLISH when it is ready.'));
  }
  /* Leaving the bench goes back to the shelf, not to the planet: you came
     from the arcade and the thing you just made is on it. */
  function leaveBench(){
    if(mode!=='building') return false;
    mode=null;
    if(window.CODER && CODER.hide) CODER.hide();
    if(window.VM) VM.useSlot(null);
    open();
    return true;
  }

  /* ------------------------------------------------------------- playing */
  async function play(id){
    if(busy) return;
    busy=true;
    try{
      const r=await api('/arcade/'+id);
      now=r.game; now.notes=r.notes||[];
    }catch(e){ busy=false; return say(e.message); }
    busy=false;
    api('/arcade/'+id+'/play', {}).catch(()=>{});   // a play is not worth blocking on
    mode='playing';
    $('#arcade').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    /* THEIR project, in memory, with saving off. */
    VM.adopt(now.project, now.stage);
    VM.reframe();
    G.running=true;
    buildRoom('free');
    /* A published game starts itself. Walking into somebody's game and
       having to find a green flag is a step nobody asked for — the whole
       cabinet IS the green flag. */
    setTimeout(()=>{ if(mode==='playing') VM.greenFlag(); }, 120);
    /* THE PLANET'S FURNITURE IS NOT PART OF THEIR GAME. The mission list,
       the minimap and the dashboard all belong to the world you walked out
       of, and left up they read as somebody's game having a HUD it never
       asked for — over a 2D game they cover a quarter of the board. */
    ['#objectives','#mapwrap','#dash','#pmap','#health','#skill','#trigger','#briefing']
      .forEach(q=>{ const e=$(q); if(e) e.classList.add('hidden'); });
    bar();
    if(window.keyHint) keyHint(flat()
      ? `<b>${t('the keys are the game’s')}</b> &nbsp; <b>Esc</b> ${t('finish')}`
      : `<b>W A S D</b> ${t('walk')} &nbsp; <b>${t('mouse')}</b> ${t('look')} &nbsp; <b>Esc</b> ${t('finish')}`);
  }
  const flat = () => !!(now && now.stage==='flat');
  /* The strip along the top while you are in somebody's game: whose it is,
     and the way out. Without it a 2D game is a screen with no explanation
     and no exit. */
  function bar(){
    const el=$('#arBar');
    el.innerHTML='';
    el.appendChild(text('b','', now.title));
    el.appendChild(text('span','ab-by', t('by {n}',{n:now.author})));
    const stop=document.createElement('button');
    stop.className='btn small'; stop.textContent=t('✕ Finish');
    stop.onclick=finish;
    el.appendChild(stop);
    el.classList.remove('hidden');
  }
  /* Leaving. The project goes, the room goes, and the camera we borrowed
     for a flat game is handed back before anything else is drawn with it. */
  function stop(){
    if(mode!=='playing') return;
    mode=null;
    $('#arBar').classList.add('hidden');
    if(window.keyHint) keyHint(null);
    if(window.VM){ VM.stopAll(); VM.leave(); }
    if(held){ G.camera=held; held=null; }
  }
  function finish(){
    const g=now;
    stop();
    G.running=false;
    if(!g) return close();
    /* Rating is offered, never demanded: SKIP is as easy to press as the
       stars, and an author's own game has nothing to ask them. */
    const mine = !!(window.NET && NET.me && NET.me.id===g.author_id);
    if(mine || !(window.NET && NET.signedIn)){ open(); return; }
    rateCard(g);
  }

  /* -------------------------------------------------------- the rating */
  function rateCard(g){
    mode='rating';
    let picked=0;
    const el=$('#arate');
    el.classList.remove('hidden');
    $('#arcade').classList.add('hidden');
    $('#hud').classList.add('hidden');
    $('#arateTitle').textContent=t('What did you think?');
    const name=$('#arateGame'); name.textContent=g.title+' — '+t('by {n}',{n:g.author});
    const row=$('#arateStars'); row.innerHTML='';
    const buttons=[];
    for(let i=1;i<=5;i++){
      const b=document.createElement('button');
      b.className='starbtn'; b.textContent='☆'; b.title=i+'/5';
      b.onclick=()=>{ picked=i; buttons.forEach((x,k)=>{ x.textContent = k<i?'★':'☆';
                        x.classList.toggle('on', k<i); }); send.disabled=false; };
      buttons.push(b); row.appendChild(b);
    }
    const note=$('#arateNote');
    note.value=''; note.placeholder=t('One line, if you want to say why');
    const send=$('#arateSend'); send.textContent=t('Send it ▶'); send.disabled=true;
    $('#arateSkip').textContent=t('Skip');
    $('#arateMsg').textContent='';
    send.onclick=async()=>{
      if(!picked) return;
      send.disabled=true;
      try{ await api('/arcade/'+g.id+'/rate', { stars:picked, note:note.value }); }
      catch(e){ $('#arateMsg').textContent=e.message; send.disabled=false; return; }
      if(window.beep) beep('star');
      closeRate();
    };
    $('#arateSkip').onclick=closeRate;
  }
  function closeRate(){
    $('#arate').classList.add('hidden');
    now=null;
    open();
  }

  /* ----------------------------------------------------------- publishing
     Called from Free Play, which is where the editor is. The project that
     goes up is whatever is in the VM right now — not a copy taken when the
     dialog opened — so what is published is what is on the screen. */
  function publish(){
    if(!(window.NET && NET.signedIn)) return say(t('Sign in to publish a game.'));
    if(!window.VM || !VM.project.actors.length)
      return say(t('There is nothing in this project yet.'));
    if(VM.visiting) return say(t('This one is somebody else’s.'));
    const el=$('#apub');
    el.classList.remove('hidden');
    $('#apubTitle').textContent=t('PUBLISH TO THE ARCADE');
    $('#apubHint').textContent=t('Anyone in the lab can play it and rate it. Publishing again under the same name replaces it.');
    const title=$('#apubName'), blurb=$('#apubBlurb');
    title.placeholder=t('What is it called?');
    blurb.placeholder=t('One line about it');
    /* Filled in from whatever is on the bench, so republishing is pressing
       the button twice rather than retyping the name exactly. */
    if(bench){ title.value=bench.title||''; blurb.value=bench.blurb||''; }
    $('#apubMsg').textContent='';
    /* The stage is a property of the project and is remembered with it, so
       this reads the answer rather than asking again every time. */
    const is2d=$('#apub2d');
    is2d.checked = VM.stage==='flat';
    $('#apub2dLabel').textContent=t('It is a 2D game — play it from above');
    const go=$('#apubGo'); go.textContent=t('Publish ▶'); go.disabled=false;
    $('#apubCancel').textContent=t('Not yet');
    $('#apubCancel').onclick=()=>el.classList.add('hidden');
    go.onclick=async()=>{
      if(!title.value.trim()){ $('#apubMsg').textContent=t('Give your game a name'); return; }
      go.disabled=true;
      VM.stage = is2d.checked ? 'flat' : 'world';
      try{
        /* VM.plain(), never VM.project: a live actor holds its mesh and the
           mesh points back at the actor, so the running project is a cycle
           and cannot be sent anywhere. plain() is the same clean copy the
           editor already writes to storage. */
        const r=await api('/arcade', { title:title.value, blurb:blurb.value,
          stage:VM.stage, project:VM.plain() });
        $('#apubMsg').textContent = r.updated ? t('Updated in the arcade.') : t('It is in the arcade.');
        if(window.beep) beep('star');
        bench={ id:r.id, title:title.value.trim(), blurb:blurb.value.trim(), stage:VM.stage };
        setTimeout(()=>{
          el.classList.add('hidden');
          /* Published from the bench? Then the shelf is where it went, and
             seeing it land there is the whole point of pressing the button. */
          if(mode==='building') leaveBench();
        }, 1100);
      }catch(e){ $('#apubMsg').textContent=e.message; go.disabled=false; }
    };
    setTimeout(()=>title.focus(), 60);
  }

  function say(msg){
    const b=$('#briefing');
    if(!b) return;
    b.classList.remove('hidden'); b.textContent=msg;
    clearTimeout(say._t); say._t=setTimeout(()=>b.classList.add('hidden'), 3200);
  }

  /* Per frame, and only while somebody else's game is on screen. A flat
     game borrows the renderer's camera for as long as it runs. */
  function tick(){
    if(mode!=='playing' || !flat() || !window.VM) return;
    if(!held) held=G.camera;
    G.camera=VM.stageCam(innerWidth/Math.max(1,innerHeight));
  }
  /* Esc gets you out of a game, which is the only key this file owns. */
  function key(e){
    if(mode==='playing' && e.code==='Escape'){ finish(); return true; }
    return false;
  }

  return { open, close, play, publish, make, tick, key, stop,
           leaveBench,
           get playing(){ return mode==='playing'; },
           get building(){ return mode==='building'; },
           get flat(){ return mode==='playing' && flat(); },
           get up(){ return !!mode; } };
})();
