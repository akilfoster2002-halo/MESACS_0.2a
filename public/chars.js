/* =====================================================================
   CHARS — the "choose your character" screen.

   Four are yours; the rest are locked and stay locked for now.  Whoever
   you are looking at stands in a little turntable above the grid and plays
   their idle, because a still PNG tells you nothing about who you are
   about to be.
   ===================================================================== */
window.CHARS = (function(){
  const FREE = 4;                       // the four you can play as
  const PER_MISSION = 0;                // the rest stay shut: set this above zero to
                                        // start handing them out per finished mission

  let view=null, previewing=null, raf=0, last=0;
  let hero=null, heroRaf=0, heroLast=0;

  function unlockedCount(){
    let done=0;
    try{ ['nav','m1','m2','m3'].forEach(id=>{ if(PROGRESS.isDone(id)) done++; }); }catch(e){}
    return Math.min(AVATAR.CHARS.length, FREE + done*PER_MISSION);
  }
  function isUnlocked(i){ return i < unlockedCount(); }

  /* ---------------------------------------------- the little turntable */
  function stage(){
    if(view) return view;
    const canvas=document.querySelector('#charView');
    if(!canvas) return null;
    const renderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));
    const scene=new THREE.Scene();
    // framed so a 1.85-tall character just fills the panel with a little air
    const camera=new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(0, 0.12, 3.7);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc3b4e6, 1.5));
    const key=new THREE.DirectionalLight(0xfff3f8, 1.5); key.position.set(3,6,5);
    const rim=new THREE.DirectionalLight(0x9fb4ff, 0.8);  rim.position.set(-4,3,-4);
    scene.add(key, rim);
    const turntable=new THREE.Group(); scene.add(turntable);
    view={renderer, scene, camera, turntable, current:null};
    return view;
  }
  function size(){
    if(!view) return;
    const c=view.renderer.domElement;
    const w=c.clientWidth||360, h=c.clientHeight||240;
    view.renderer.setSize(w,h,false);
    view.camera.aspect=w/h; view.camera.updateProjectionMatrix();
  }

  async function preview(id){
    const v=stage(); if(!v) return;
    previewing=id;
    let m;
    try{ m=await AVATAR.load(id); }catch(e){ return; }
    if(previewing!==id) return;                 // they moved on while it loaded
    if(v.current) v.turntable.remove(v.current);
    m.position.y=-0.92;                         // stand them on the middle of the frame
    v.turntable.add(m); v.current=m;
    AVATAR.animate(m, 0, 'idle');
    const def=AVATAR.CHARS.find(c=>c.id===id);
    const nm=document.querySelector('#charName');
    if(nm) nm.textContent = def ? t(def.name) : '';
  }
  function loop(now){
    raf=requestAnimationFrame(loop);
    const dt=Math.min((now-last)/1000, 0.05); last=now;
    if(!view) return;
    size();
    view.turntable.rotation.y += dt*0.55;        // slow spin, so you see all of them
    if(view.current) AVATAR.animate(view.current, dt, 'idle');
    view.renderer.render(view.scene, view.camera);
  }
  function play(){ if(!raf){ last=performance.now(); raf=requestAnimationFrame(loop); } }
  function stop(){ if(raf){ cancelAnimationFrame(raf); raf=0; } }

  /* --------------------------------------------------------- the grid */
  function render(){
    const grid=document.querySelector('#charGrid'); if(!grid) return;
    const open=unlockedCount();
    document.querySelector('#cTitle').textContent=t('CHOOSE YOUR CHARACTER');
    // no promise of more until there is a way to earn them
    document.querySelector('#cHint').textContent = open < AVATAR.CHARS.length
      ? t('{a} of {b} unlocked. Pick who you play as.',{a:open,b:AVATAR.CHARS.length})
      : t('Everyone is unlocked. Pick your favourite.');
    document.querySelector('#cGo').textContent=t('Continue ▶');

    grid.innerHTML=AVATAR.CHARS.map((c,i)=>{
      const lock=!isUnlocked(i);
      return `<button class="chrtile${c.id===AVATAR.chosen?' on':''}${lock?' lock':''}"
        data-c="${c.id}" ${lock?'disabled':''} title="${lock?t('Locked'):c.name}">
        <img src="${c.preview}" alt="" loading="lazy">
        <span class="chrname">${lock?'???':c.name}</span></button>`;
    }).join('');

    grid.querySelectorAll('[data-c]').forEach(b=>{
      // looking at one is enough to bring it to life; clicking makes it yours
      b.onmouseenter=()=>preview(b.dataset.c);
      b.onfocus=()=>preview(b.dataset.c);
      b.onclick=()=>{
        AVATAR.pick(b.dataset.c);
        grid.querySelectorAll('.chrtile').forEach(x=>x.classList.toggle('on',x===b));
        preview(b.dataset.c);
        if(window.beep) beep('pop');
      };
    });
    preview(AVATAR.chosen);
  }

  function open(){ render(); play(); }
  function close(){ stop(); }

  /* ------------------------------------------- the one on the landing */
  function heroStage(){
    if(hero) return hero;
    const canvas=document.querySelector('#heroView');
    if(!canvas) return null;
    const renderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(28, 1, 0.1, 60);
    camera.position.set(0, 0.20, 3.9); camera.lookAt(0, 0.02, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbfe0ff, 1.7));
    const key=new THREE.DirectionalLight(0xfff6e8, 1.6); key.position.set(3,6,5);
    scene.add(key);
    const turntable=new THREE.Group(); scene.add(turntable);
    hero={renderer, scene, camera, turntable, current:null, who:null};
    return hero;
  }
  async function heroShow(){
    const h=heroStage(); if(!h) return;
    if(h.who===AVATAR.chosen) return;
    const want=AVATAR.chosen;
    let m; try{ m=await AVATAR.load(want); }catch(e){ return; }
    if(AVATAR.chosen!==want) return;
    if(h.current) h.turntable.remove(h.current);
    m.position.y=-0.9; h.turntable.add(m); h.current=m; h.who=want;
    AVATAR.animate(m, 0, 'idle');
  }
  function heroLoop(now){
    heroRaf=requestAnimationFrame(heroLoop);
    const dt=Math.min((now-heroLast)/1000, 0.05); heroLast=now;
    if(!hero) return;
    const c=hero.renderer.domElement;
    const w=c.clientWidth||300, ht=c.clientHeight||190;
    hero.renderer.setSize(w,ht,false);
    hero.camera.aspect=w/ht; hero.camera.updateProjectionMatrix();
    hero.turntable.rotation.y = Math.sin(now/2600)*0.5;   // looks around, does not spin
    if(hero.current) AVATAR.animate(hero.current, dt, 'idle');
    hero.renderer.render(hero.scene, hero.camera);
  }
  function heroOpen(){
    heroShow();
    if(!heroRaf){ heroLast=performance.now(); heroRaf=requestAnimationFrame(heroLoop); }
  }
  function heroClose(){ if(heroRaf){ cancelAnimationFrame(heroRaf); heroRaf=0; } }

  return { open, close, render, unlockedCount, isUnlocked, heroOpen, heroClose };
})();
