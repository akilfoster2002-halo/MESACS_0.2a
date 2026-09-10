/* =====================================================================
   THE TRAILER — thirty seconds of KORO, recorded out of KORO.

   Not a screen capture and not a slideshow. This composites three
   things into one 1280x720 canvas and records THAT at thirty frames a
   second:

     the game, drawn straight off its own WebGL canvas — which is only
       legal inside the frame that rendered it, and is why this owns the
       frame clock (see unthrottle);

     the interface, which is DOM — the block console is most of what
       this game IS, and a trailer that cannot show it is a trailer for
       a different product. It goes through an SVG foreignObject with
       the page's own stylesheet inlined, about seventy milliseconds a
       go, so it is snapshotted a few times a second and held between;

     and the words, drawn straight onto the compositor.

   The cut is driven by the RECORDING clock rather than by how long
   anything took to load, so thirty seconds is thirty seconds however
   slow the machine is. Every scene sets itself up during the black of
   the previous one's fade.
   ===================================================================== */
window.PROMO = (function(){
  const W=1280, H=720;
  const sleep = ms => new Promise(r=>setTimeout(r, ms));

  /* ------------------------------------------------------------ paint */
  const FONT='"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
  const INK='#eef3ff', STAR='#ffe9a8', MINT='#a8e6cf', SKY='#8fd3ff';

  function roundRect(x, a, b, w, h, r){
    x.beginPath();
    x.moveTo(a+r, b); x.arcTo(a+w, b, a+w, b+h, r); x.arcTo(a+w, b+h, a, b+h, r);
    x.arcTo(a, b+h, a, b, r); x.arcTo(a, b, a+w, b, r); x.closePath();
  }

  /* A lower third, not a subtitle. It comes in from the left and holds —
     a caption that fades in place reads as a bug on a moving picture. */
  function caption(x, text, sub, k){
    if(k<=0) return;
    const ease = k<1 ? 1-Math.pow(1-k, 3) : 1;
    const pad=34, y=H-146;
    x.save();
    x.globalAlpha=Math.min(1, ease*1.6);
    x.translate((1-ease)*-90, 0);
    x.font='600 42px '+FONT;
    const w=Math.max(x.measureText(text).width,
                     sub ? x.measureText(sub).width*0.72 : 0)+pad*2;
    x.fillStyle='rgba(16,10,30,.80)';
    roundRect(x, 56, y, w, sub?116:78, 18); x.fill();
    x.fillStyle='rgba(255,233,168,.85)';
    x.fillRect(56, y, 5, sub?116:78);
    x.fillStyle=INK; x.textBaseline='top';
    x.fillText(text, 56+pad, y+18);
    if(sub){ x.font='30px '+FONT; x.fillStyle='rgba(238,243,255,.72)';
             x.fillText(sub, 56+pad, y+68); }
    x.restore();
  }

  function card(x, big, small, k){
    x.save();
    x.globalAlpha=k;
    x.fillStyle='#0a0e1c'; x.fillRect(0,0,W,H);
    x.textAlign='center'; x.textBaseline='middle';
    x.fillStyle=INK; x.font='700 118px '+FONT;
    x.fillText(big, W/2, H/2-22);
    if(small){
      x.font='34px '+FONT; x.fillStyle=MINT;
      x.fillText(small, W/2, H/2+62);
    }
    x.textAlign='left';
    x.restore();
  }

  /* --------------------------------------------------- the DOM overlay
     The page's own stylesheet has to travel with the markup — a
     foreignObject gets no CSS from the document it came from — and the
     canvases inside the HUD have to be turned into pictures, because a
     <canvas> serialises as an empty box. */
  let css=null;
  function styles(){
    if(css!==null) return css;
    css=[...document.querySelectorAll('style')].map(s=>s.textContent).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')      // this file's comments are not the page's
      .replace(/\s+/g, ' ');
    return css;
  }
  /* A CLONE MUST NOT POSITION ITSELF. Each node is placed by the wrapper
     below, at the rectangle it occupies on screen — and then its own CSS
     ran again inside that wrapper and moved it a second time, which is why
     the console came out half a screen left of where it lives and the
     briefing box was clipped in half. Everything that could move it is
     turned off, and the size it had is written on. */
  function planted(node){
    const c=frozen(node);
    const r=node.getBoundingClientRect();
    c.setAttribute('style',
      (c.getAttribute('style')||'')
      + ';position:static !important;left:auto !important;top:auto !important'
      + ';right:auto !important;bottom:auto !important;margin:0 !important'
      + ';transform:none !important;inset:auto !important'
      + `;width:${r.width}px !important;height:${r.height}px !important`);
    return c;
  }
  function frozen(node){
    const c=node.cloneNode(true);
    const src=node.querySelectorAll('canvas'), dst=c.querySelectorAll('canvas');
    for(let i=0;i<src.length;i++){
      let url=''; try{ url=src[i].toDataURL(); }catch(e){}
      const img=document.createElement('img');
      img.setAttribute('src', url);
      img.setAttribute('width', src[i].width); img.setAttribute('height', src[i].height);
      img.setAttribute('style', dst[i].getAttribute('style')||'');
      if(dst[i].parentNode) dst[i].parentNode.replaceChild(img, dst[i]);
    }
    // an <img> pointing at a relative path resolves against the data: URL
    c.querySelectorAll('img[src]').forEach(im=>{
      if(!/^data:/.test(im.getAttribute('src'))) im.remove();
    });
    return c;
  }

  let shot=null, shooting=false, want=[];
  async function snap(){
    if(shooting || !want.length){ return; }
    shooting=true;
    try{
      let inner='';
      for(const sel of want){
        const n=document.querySelector(sel);
        if(!n || n.classList.contains('hidden')) continue;
        const r=n.getBoundingClientRect();
        if(r.width<2 || r.height<2) continue;
        const html=new XMLSerializer().serializeToString(planted(n));
        inner += `<div xmlns="http://www.w3.org/1999/xhtml" style="position:absolute;`
              +  `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px">`
              +  html + '</div>';
      }
      if(!inner){ shot=null; shooting=false; return; }
      const vw=innerWidth, vh=innerHeight;
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}">`
        + `<foreignObject width="100%" height="100%">`
        + `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${vw}px;height:${vh}px;position:relative">`
        + `<style>${styles()}</style>${inner}</div></foreignObject></svg>`;
      /* A DATA URL, and it has to be. An SVG loaded from a blob: URL TAINTS
         the canvas it is drawn into — and a tainted canvas cannot be
         captured, so the recorder gets nothing and toBlob throws. The
         percent-encoding was expensive when the whole stylesheet went
         through it uncompressed; styles() strips it once now, and this is
         no longer the thing eating the frame. */
      const img=new Image();
      await new Promise((res,rej)=>{
        img.onload=res; img.onerror=rej;
        img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
      });
      shot=img;
    }catch(e){ shot=null; }
    shooting=false;
  }

  /* ------------------------------------------------- rendering while hidden
     A TAB NOBODY IS LOOKING AT DOES NOT ANIMATE. requestAnimationFrame is
     tied to the compositor, and a browser window behind another window has
     no compositor to be tied to — it drops to a few callbacks a second and
     then to none. Which is correct behaviour and completely fatal here: the
     game's loop, the compositor's loop and therefore the recording all run
     at whatever rate the page is being painted at, and a thirty-second
     trailer recorded at three frames a second is a slideshow.

     A Worker's timer is not throttled. So for the length of a take, and
     only for the length of a take, rAF is a Worker ticking at sixty and
     handing the callbacks the same timestamp they would have had. WebGL
     draws perfectly well with nobody watching; it is only the invitation
     to draw that goes away. */
  let realRaf=null, realCancel=null, realSet=null, realClear=null;
  let rafWorker=null, rafCbs=new Map(), rafSeq=1, timers=new Map(), timerSeq=1;
  function unthrottle(){
    if(realRaf) return;
    realRaf=window.requestAnimationFrame.bind(window);
    realCancel=window.cancelAnimationFrame.bind(window);
    realSet=window.setTimeout.bind(window);
    realClear=window.clearTimeout.bind(window);
    const src='let t=setInterval(()=>postMessage(1),16);'
            + 'onmessage=()=>{clearInterval(t);close();};';
    rafWorker=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));

    window.requestAnimationFrame=fn=>{ const id=rafSeq++; rafCbs.set(id, fn); return id; };
    window.cancelAnimationFrame=id=>{ rafCbs.delete(id); };

    /* AND setTimeout, WHICH IS THE ONE THAT ACTUALLY RUINED THE CUT.

       A background tab clamps timers to about one a second. Every wait in
       the director and in the scene setups is a setTimeout — "hold the
       blocks on screen for a second, then press RUN" — and each of those
       silently became a whole second or more. The trailer's own clock kept
       perfect time while everything it was directing ran at a third speed,
       so the console was still being typed into two scenes after the
       caption had moved on. Nothing about it looked like a timing bug; it
       looked like the game was slow. */
    window.setTimeout=(fn, ms, ...args)=>{
      const id=timerSeq++;
      timers.set(id, { at:performance.now()+(+ms||0), fn, args });
      return id;
    };
    window.clearTimeout=id=>{ timers.delete(id); };

    rafWorker.onmessage=()=>{
      const now=performance.now();
      for(const [id, t] of [...timers]){
        if(t.at<=now){ timers.delete(id);
                       try{ t.fn(...t.args); }catch(e){} }
      }
      const due=[...rafCbs.values()];
      rafCbs.clear();
      for(const fn of due){ try{ fn(now); }catch(e){} }
    };
  }
  function rethrottle(){
    if(!realRaf) return;
    const frames=[...rafCbs.values()], waits=[...timers.values()];
    window.requestAnimationFrame=realRaf;
    window.cancelAnimationFrame=realCancel;
    window.setTimeout=realSet;
    window.clearTimeout=realClear;
    realRaf=realCancel=realSet=realClear=null;
    rafCbs.clear(); timers.clear();
    if(rafWorker){ rafWorker.postMessage('stop'); rafWorker=null; }
    /* Hand back everything still waiting, or the game stops dead: its own
       loop is one of these, and so is every "clear this message in three
       seconds" in the HUD. */
    const now=performance.now();
    frames.forEach(fn=>requestAnimationFrame(fn));
    waits.forEach(t=>setTimeout(()=>{ try{ t.fn(...t.args); }catch(e){} },
                                Math.max(0, t.at-now)));
  }

  /* ------------------------------------------------------ the compositor */
  let comp, x2, raf=null, startedAt=0, cut=null, snapTimer=null;
  let feed=null, sent=0;

  /* THE GAME'S CANVAS HANDS OUT ONE STREAM, NOT ONE PER ASK.
     canvas.captureStream() returns the same MediaStream every time, so
     stopping it at the end of a take stops it for every take after — the
     second recording came back a black rectangle with a live-looking track
     on it. It is taken once and kept. */
  let canvasEl=null;
  const gameCanvas = ()=> canvasEl || (canvasEl=document.querySelector('#view'));

  function drawFrame(now){
    raf=requestAnimationFrame(drawFrame);
    const t=(now-startedAt)/1000;
    x2.fillStyle='#05070f'; x2.fillRect(0,0,W,H);

    /* THE GAME, STRAIGHT OFF ITS OWN CANVAS.

       It used to come across as a live video track, because a WebGL canvas
       without preserveDrawingBuffer is only readable inside the frame that
       drew it — and a separate rAF callback is not that frame. But canvas
       capture is tied to the page being composited, so behind another
       window the track publishes nothing and the trailer records a still.

       Owning the clock fixes the original problem instead: the callbacks
       run in the order they were registered, the game's loop re-registers
       itself before this one does, and so this runs after the render in
       the SAME task — which is exactly when the buffer is readable. */
    const view=gameCanvas();
    if(view && view.width){
      const s=Math.max(W/view.width, H/view.height);
      const dw=view.width*s, dh=view.height*s;
      try{ x2.drawImage(view, (W-dw)/2, (H-dh)/2, dw, dh); }catch(e){}
    }
    /* The interface, held between snapshots — and drawn TWICE. Half the
       panels in this game are a translucent fill over a backdrop blur, and
       an SVG foreignObject has no backdrop filter: the fill comes through
       at its own alpha over bright grass and the words in it stop being
       readable. A second pass squares the transparency, which leaves the
       opaque parts exactly as they were and gives the glass its blur back
       as darkness. */
    if(shot && shot.width){
      const s=Math.max(W/shot.width, H/shot.height);
      const dw=shot.width*s, dh=shot.height*s;
      x2.globalAlpha=1;
      x2.drawImage(shot, (W-dw)/2, (H-dh)/2, dw, dh);
      x2.drawImage(shot, (W-dw)/2, (H-dh)/2, dw, dh);
    }

    const sc=cut && cut.at(t);
    if(sc){
      want = sc.dom || [];
      if(sc.say) caption(x2, sc.say, sc.sub, Math.min(1, (t-sc.from)/0.45));
      /* Fade to black across every join. It is a transition, and it is
         also cover: a scene change here is a mission loading its models,
         and nobody needs to watch that. */
      const FADE=0.22;
      const inK =Math.max(0, 1-(t-sc.from)/FADE);
      const outK=Math.max(0, 1-(sc.to-t)/FADE);
      const k=Math.max(inK, outK);
      if(k>0 && !sc.card){ x2.globalAlpha=k; x2.fillStyle='#05070f';
                           x2.fillRect(0,0,W,H); x2.globalAlpha=1; }
      if(sc.card) card(x2, sc.card, sc.cardSub, 1);
    }

    /* A STEADY THIRTY, not one per browser frame. The recorder timestamps
       what it is given, and the page does not draw at a constant rate — it
       stalls whenever a mission loads its models. Every downstream tool
       then rebuilds the file at a fixed rate and the result is a video
       LONGER than the take: a 11.2-second recording came back as 14.23,
       because a quarter of the frames were missing and each survivor was
       given a thirtieth of a second anyway.

       So the frames are emitted by hand off the clock rather than off the
       paint, and a stall is caught up on afterwards — capped, because
       thirty duplicates in one tick is a freeze rather than a catch-up. */
    if(feed){
      const owed=Math.floor(t*30)-sent;
      for(let i=0;i<Math.min(owed,3);i++){ feed.requestFrame(); sent++; }
      if(owed>3) sent+=owed-3;
    }
  }

  /* ------------------------------------------------------------ record */
  async function record(scenes, opts){
    const o=opts||{};
    const name=o.name||'koro.mp4';
    const sink=o.sink||'http://127.0.0.1:9099';

    comp=document.createElement('canvas'); comp.width=W; comp.height=H;
    x2=comp.getContext('2d');


    /* Total length is the last scene's end, and every scene knows the
       window it owns — so the timeline is one list to read and the cut
       cannot drift. */
    let at=0;
    scenes.forEach(s=>{ s.from=at; at+=s.secs; s.to=at; });
    const total=at;
    cut={ at:t=>scenes.find(s=>t>=s.from && t<s.to) || null };

    const type=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm']
      .find(t=>MediaRecorder.isTypeSupported(t));
    const chunks=[];
    /* captureStream(0) — nothing is published until requestFrame() asks.

       Automatic capture is tied to the page being COMPOSITED, the same as
       requestAnimationFrame, so behind another window it publishes almost
       nothing: a four-second take came back as forty kilobytes of one
       repeated frame. An explicit requestFrame() is a direct instruction
       and does not care whether anybody is looking. Paired with the Worker
       clock above, it is also exactly thirty a second. */
    const stream=comp.captureStream(0);
    feed=stream.getVideoTracks()[0]; sent=0;
    const rec=new MediaRecorder(stream,
      { mimeType:type, videoBitsPerSecond: o.bitrate || 6_000_000 });
    rec.ondataavailable=e=>{ if(e.data && e.data.size) chunks.push(e.data); };

    unthrottle();
    startedAt=performance.now();
    raf=requestAnimationFrame(drawFrame);
    /* setTimeout, not setInterval: only the former is on the Worker clock
       above, and a hidden tab clamps the latter to about once a second. */
    (function again(){ snapTimer=setTimeout(()=>{ snap(); again(); }, 260); })();
    rec.start(250);

    /* THE SCENES RUN ON THE RECORDING'S CLOCK — EACH ON ITS OWN.

       They used to run in a queue, awaited one after another, and a scene's
       setup is not a quick thing: it loads a mission's models, generates a
       planet, waits while a program is typed. The first one overran its
       five-second window by two, and because the next was waiting on it
       rather than on the clock, every scene after it started late by the
       same two seconds and then added its own. By the middle of the
       trailer the picture was a mission behind the caption describing it.

       So every scene is booked against the start, ahead of time, and told
       to begin as the join before it fades. A slow one now loses a second
       of its OWN shot, which is the right thing to lose. */
    const log=[];
    scenes.forEach(s=>{
      if(!s.enter) return;
      setTimeout(()=>{
        Promise.resolve().then(()=>s.enter())
          .catch(e=>log.push(s.id+': '+String(e).slice(0,90)));
      }, Math.max(0, s.from*1000-(s.lead===undefined?520:s.lead)));
    });
    const left=total*1000-(performance.now()-startedAt);
    if(left>0) await sleep(left);

    rec.stop();
    await new Promise(r=>{ rec.onstop=r; });
    cancelAnimationFrame(raf); raf=null;
    rethrottle();
    clearTimeout(snapTimer); snapTimer=null;
    feed=null; shot=null; want=[];

    const blob=new Blob(chunks, { type });
    const res=await fetch(sink+'/save?name='+encodeURIComponent(name),
      { method:'POST', body:blob });
    const out=await res.json();
    return { ...out, seconds:+total.toFixed(1), mime:type, problems:log };
  }

  /* One frame, as a PNG, for looking at. Every fault in here so far has
     been invisible in the code and obvious in a picture. */
  async function frame(sink){
    const blob=await new Promise(r=>comp.toBlob(r,'image/png'));
    await fetch((sink||'http://127.0.0.1:9099')+'/save?dir=tmp&name=frame.png',
      { method:'POST', body:blob });
    return blob.size;
  }

  return { record, snap, frame, get shot(){ return shot; },
           get frames(){ return sent; },
           set want(v){ want=v; } };
})();
