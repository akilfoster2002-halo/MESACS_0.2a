/* =====================================================================
   COACH — the walkthrough.

   A mission can hand you two blocks and still leave you standing in a
   field with no idea what to do. So the first mission is walked, step by
   step, with the thing you need to touch actually pointed at: a ring on
   the floor and an arrow over the ball while you are in the world, and a
   ring drawn around the exact button while you are in the editor.

   Every step names what it wants and how it knows it happened. A student
   who works it out on their own is never told to do the thing they have
   already done: progress is read from the world, and the coach catches up.

   ON RAILS. A walkthrough that only SUGGESTS what to press is a
   walkthrough a nine-year-old walks straight past, and then they are lost
   in a mission they were never shown. So a step can also say what is
   POSSIBLE while it is running — the coach hands each step to the caller,
   and the caller narrows the palette to the one block being asked for and
   shuts the buttons that lead anywhere else. The rails come off with the
   last step and never come back; this is how somebody is taught the
   controls, not how the game is played.
   ===================================================================== */
window.COACH = (function(){
  let steps=null, at=0, ctx=null, beacon=null, last=0, done=false, railed=-1;

  function start(list, c){
    stop();
    if(!list || !list.length) return;
    steps=list; ctx=c||{}; at=0; done=false; railed=-1;
    rail();
    paint();
  }
  /* Tell whoever started the walkthrough which step is live, so it can put
     the world into the state that step needs. Only on a CHANGE of step: this
     runs every frame and re-narrowing a palette sixty times a second would
     redraw the console sixty times a second. */
  function rail(){
    if(!ctx || !ctx.onStep || at===railed) return;
    railed=at;
    ctx.onStep(step(), at);
  }
  function stop(){
    if(ctx && ctx.onStep && steps) ctx.onStep(null, -1);   // rails off
    steps=null; at=0; done=false; railed=-1;
    dropBeacon();
    const r=document.querySelector('#coachRing'); if(r) r.remove();
    const p=document.querySelector('#coachTip'); if(p) p.remove();
  }
  const step = () => (steps && at<steps.length) ? steps[at] : null;

  /* A student who works it out on their own must not be told to do the
     thing they have already done, so every step is checked from the world
     rather than from what the coach thinks it just asked for — and skipped
     outright if it is already true. */
  function tick(dt){
    if(!steps || done) return;
    /* Progress is monotonic: find the LAST step that has happened and stand
       just past it. Checking only the next one stops the coach dead when
       somebody works ahead of it — write the whole program in one go and it
       would still be saying "walk to the ball" behind the open editor. */
    for(let k=steps.length-1; k>=at; k--){
      if(steps[k].done && steps[k].done(ctx)){ at=k+1; break; }
    }
    const s=step();
    if(!s){ finish(); return; }
    rail();
    const now=performance.now();
    if(now-last<70) { spin(dt); return; }
    last=now;
    paint(); spin(dt);
  }
  function finish(){
    done=true;
    if(ctx && ctx.onStep) ctx.onStep(null, -1);            // and the rails come off
    dropBeacon();
    const r=document.querySelector('#coachRing'); if(r) r.remove();
    say(t('That is the whole idea: your blocks moved a thing in the world.'), true);
  }

  /* ------------------------------------------------------------ drawing */
  function ring(){
    let r=document.querySelector('#coachRing');
    if(!r){ r=document.createElement('div'); r.id='coachRing'; document.body.appendChild(r); }
    return r;
  }
  function tip(){
    let p=document.querySelector('#coachTip');
    if(!p){
      p=document.createElement('div'); p.id='coachTip';
      document.body.appendChild(p);
    }
    return p;
  }
  function paint(){
    const s=step(); if(!s) return;
    /* some targets are easier to describe than to select — the gap inside a
       loop's mouth, say, whose path depends on what is already in the script */
    const el = s.find ? s.find() : (s.sel ? document.querySelector(s.sel) : null);
    const r=ring();
    if(el){
      const b=el.getBoundingClientRect();
      if(b.width>0){
        r.style.display='block';
        r.style.left=(b.left-7)+'px'; r.style.top=(b.top-7)+'px';
        r.style.width=(b.width+14)+'px'; r.style.height=(b.height+14)+'px';
      } else r.style.display='none';
      say(s.say, false, b);
    } else {
      r.style.display='none';
      say(s.say, false, null);
    }
    /* World steps get a marker on the thing itself. A step can name its own
       target with at() — the planet tour walks you to a building and then to
       a station, which is two different places in one walkthrough, and the
       beacon has to follow. Anything with x/y/z will do. */
    const aim = s.at ? s.at() : (s.world ? ctx.actor : null);
    if(aim) beaconOn(aim); else dropBeacon();
  }
  function say(text, finished, near){
    const p=tip();
    const n = steps ? Math.min(at+1, steps.length) : 0;
    p.className = finished ? 'ok' : '';
    p.innerHTML = `<div class="ctstep">${finished? t('DONE')
        : t('STEP {a} OF {b}',{a:n,b:steps.length})}</div>
      <div class="cttext">${bold(esc(t(text)))}</div>
      ${finished? '' : `<button class="ctskip" id="coachSkip">${t('skip the walkthrough')}</button>`}`;
    const sk=document.querySelector('#coachSkip');
    if(sk) sk.onclick=()=>stop();
    /* sit beside what is being pointed at, and never off the edge */
    if(near && near.width>0){
      const w=232, gap=14;
      let x=near.right+gap, y=near.top-6;
      if(x+w > innerWidth-10) x=Math.max(10, near.left-w-gap);
      y=Math.max(10, Math.min(y, innerHeight-150));
      p.style.left=x+'px'; p.style.top=y+'px';
      p.style.right=''; p.style.bottom=''; p.style.transform='';
    } else {
      p.style.left='50%'; p.style.top=''; p.style.bottom='96px';
      p.style.right=''; p.style.transform='translateX(-50%)';
    }
    if(finished) setTimeout(()=>{ const q=document.querySelector('#coachTip'); if(q) q.remove(); }, 5200);
  }

  /* -------------------------------------------------------- the beacon */
  function beaconOn(a){
    if(beacon && beacon.a===a) return;
    // a fresh {x,y,z} every frame is a different object but the same place
    if(beacon && beacon.a && a && beacon.a.x===a.x && beacon.a.z===a.z
       && beacon.a.y===a.y){ beacon.a=a; return; }
    dropBeacon();
    if(!a || typeof G==='undefined' || !G.roomGroup) return;
    const g=new THREE.Group();
    const mat=()=>new THREE.MeshBasicMaterial({ color:0xffe9a8, transparent:true, opacity:.9 });
    const rad=Math.max(1.2, (a.size||1)*1.6);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(rad,0.075*Math.max(1,rad/1.6),8,44), mat());
    halo.rotation.x=-Math.PI/2; halo.position.y=0.05;
    const arrow=new THREE.Mesh(new THREE.ConeGeometry(0.36,0.85,14), mat());
    arrow.rotation.x=Math.PI;
    g.add(halo); g.add(arrow);
    G.roomGroup.add(g);
    beacon={ g, halo, arrow, a, t:0 };
    place();
  }
  function dropBeacon(){
    if(!beacon) return;
    if(beacon.g.parent) beacon.g.parent.remove(beacon.g);
    beacon=null;
  }
  function place(){
    if(!beacon) return;
    const a=beacon.a;
    beacon.g.position.set(a.x, 0, a.z);
    beacon.arrow.position.y = (a.y||1) + (a.size||1)*0.55 + 0.8 + Math.sin(beacon.t*3)*0.16;
  }
  function spin(dt){
    if(!beacon) return;
    beacon.t += dt||0.016;
    beacon.halo.rotation.z += (dt||0.016)*1.1;
    place();
  }

  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  /* Everything a step says is escaped, because a walkthrough should never be
     a way to put markup on the screen. But the ONE key you are being told to
     press wants to stand out, so <b> is let back through afterwards and
     nothing else is. */
  const bold=s=>s.replace(/&lt;b&gt;/g,'<b>').replace(/&lt;\/b&gt;/g,'</b>');
  return { start, stop, tick, get running(){ return !!steps && !done; },
           /* so the ownership marks can stand aside for the louder pointer */
           get pointingAt(){ return beacon ? beacon.a : null; } };
})();
