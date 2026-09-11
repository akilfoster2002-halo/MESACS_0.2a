/* =====================================================================
   WHO — who else is in here.

   The multiplayer pitch of this game is that your class is in the world
   with you, and until now the only way to find out whether that was true
   was to walk around looking. The server has always known: every open
   socket carries the room it joined and the door it last walked through.
   This is that list, with a face on it.

   IT IS A STRIP ALONG THE BOTTOM, like the quick change and the way you
   travel, and for the same reason — you are asking a question about the
   world while standing in it, and a panel across the middle covers the
   thing you are asking about.

   IT POLLS, and only while it is open. A push would be tidier and this
   is a list somebody glances at for four seconds; a socket message per
   join and leave, delivered to thirty browsers whether or not anybody is
   looking, is more machinery than the question deserves.

   AND IT IS HONEST WHEN IT IS EMPTY. "Nobody else is here" and "the
   server is not answering" are different facts, and a child who reads the
   second as the first concludes their class has gone home.
   ===================================================================== */
window.WHO = (function(){
  const $ = s => document.querySelector(s);
  let open_=false, timer=0, last=null;

  function text(tag, cls, str){
    const el=document.createElement(tag);
    if(cls) el.className=cls;
    el.textContent = str==null ? '' : String(str);
    return el;
  }
  /* What somebody is doing, in words. The server sends the name of the
     kind of place rather than the place, so this is a lookup and not a
     sentence built out of ids. */
  const DOING = { outside:'outside', workshop:'in the Workshop', house:'at home',
                  counter:'in the Mall', mission:'in a mission', gym:'in the Gym',
                  space:'flying between planets' };
  const doing = p => p.riding ? t('driving')
                   : p.where  ? t(DOING[p.where] || p.where)
                   : t('just arrived');

  function toggle(){ open_ ? close() : open(); }
  function open(){
    if(open_) return;
    const el=$('#who'); if(!el) return;
    open_=true;
    if(document.pointerLockElement) document.exitPointerLock();
    $('#whoTitle').textContent=t('WHO IS HERE');
    el.classList.remove('hidden');
    paint(last);              // whatever we knew a moment ago, so it is never blank
    refresh();
    timer=setInterval(refresh, 3000);
  }
  function close(){
    if(!open_) return;
    open_=false;
    clearInterval(timer); timer=0;
    const el=$('#who'); if(el) el.classList.add('hidden');
    if(window.G && G.running && window.lockPointer){
      const v=$('#view'); if(v) lockPointer(v);
    }
  }

  async function refresh(){
    if(!open_) return;
    if(!(window.NET && NET.signedIn)) return paint(null, t('Sign in to see who else is here.'));
    try{
      const r=await fetch('/api/who',{ credentials:'same-origin' });
      const j=await r.json();
      if(!r.ok || !j.ok) throw new Error(j.error||('Error '+r.status));
      last=j; if(open_) paint(j);
    }catch(e){
      if(open_) paint(last, t('Cannot reach the server right now.'));
    }
  }

  function paint(data, problem){
    const row=$('#whoRow'), foot=$('#whoHint');
    if(!row) return;
    row.innerHTML='';
    if(problem && !data){ row.appendChild(text('div','whonote', problem)); foot.textContent=''; return; }
    if(!data){ row.appendChild(text('div','whonote', t('Looking…'))); foot.textContent=''; return; }

    /* Rooms nobody is in are left out. A wall of six empty rooms is a
       worse answer to "who is here" than a short list. */
    const busy = data.rooms.filter(r=>r.people.length);
    if(data.lobby && data.lobby.length)
      busy.push({ id:'lobby', name:t('Just signed in'), em:'\u{1F6AA}', a:'#9aa4b8',
                  people:data.lobby });
    if(!busy.length){
      row.appendChild(text('div','whonote',
        t('Nobody else is here yet. Free Play is where everyone meets.')));
    }
    busy.forEach(r=>{
      const box=document.createElement('div');
      box.className='whoroom';
      box.style.setProperty('--a', r.a||'#8fd3ff');
      const head=document.createElement('div'); head.className='whohead';
      head.appendChild(text('span','whoem', r.em||''));
      head.appendChild(text('b','', t(r.name)));
      head.appendChild(text('span','whocount', r.people.length));
      box.appendChild(head);
      r.people.forEach(p=>{
        const line=document.createElement('div');
        line.className='whoperson'+(p.you?' you':'');
        const face=AVATAR.CHARS.find(c=>c.id===p.char);
        if(face){
          const img=document.createElement('img');
          img.src=face.preview; img.alt=''; img.loading='lazy';
          line.appendChild(img);
        }
        const col=document.createElement('div'); col.className='whonames';
        col.appendChild(text('span','whoname', p.display + (p.you ? ' ('+t('you')+')' : '')));
        col.appendChild(text('span','whodoing', doing(p)));
        line.appendChild(col);
        box.appendChild(line);
      });
      row.appendChild(box);
    });
    foot.textContent = problem ? problem
      : t('{n} online &nbsp;·&nbsp; O or Esc closes',{n:data.total}).replace(/&nbsp;/g,' ');
  }

  /* Esc and O close it; nothing else in here wants the keyboard. */
  function key(e){
    if(!open_) return false;
    if(e.code==='Escape' || e.code==='KeyO'){ close(); return true; }
    return false;
  }

  return { open, close, toggle, key, get up(){ return open_; } };
})();
