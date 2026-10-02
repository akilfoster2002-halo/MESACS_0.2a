/* =====================================================================
   TSH — a quest in its own world, from the screenplay TSH V4 by George
   Wang. One night: Robin sells two rings in an alley, walks home under
   her mother's face on every screen, finds a stranger in her flat, and
   ends up laughing on a rooftop with the city lit up in front of her.

   IT IS BUILT THE WAY GTA BUILDS A MISSION, not the way a script is read:
     AUTHORED AT BOTH ENDS — the deal, the flat and the rooftop always
       happen, and the lines in them are George's;
     SYSTEMIC IN THE MIDDLE — how you get from one to the next is yours.
       Drones sweep the streets with scanners; WFC officers walk beats;
       people on the pavement film anything worth filming; Kai has a
       temper and eyes. Nobody reacts to what the game knows, only to
       what they SAW;
     AND THE STORY READS WHAT YOU LEFT BEHIND. The envelope has a tracker
       in it. The photo is on the shelf. Your face might be in somebody's
       phone. Maya finds you by whatever trail you left, knows whatever
       you let her find out, and the last shot of the night is whatever
       you missed. See tshai.js for the rules and the table of beats.

   AND IT IS TOLD IN ORDER. Every line anybody says belongs to a scene on
   the storyboard (tshai.js STORY): a scene plays when the one before it
   has, and when Robin does the thing that sets it off — steps out of the
   alley, opens her own door, turns on the lamp. No clock starts a scene,
   and nothing across the city talks because a timer ran out. Every line
   is recorded, in the voice of whoever says it (tshvoice.js).

   ROBIN IS ROBIN HERE. Everywhere else in KORO you are who you chose;
   this is the one story written about one person's face and name, so it
   casts her (AVATAR.setCast('robin')) on the way in and gives you back
   on the way out.

   THE FILES: tshlook.js (the picture), tshcity.js (the district),
   tshai.js (the rules), and this — the night itself.

   KEYS: WASD move · Shift run · Space jump · E use · H hood & shades ·
         G Gecko cuffs · F flash bangles · J static studs · Q throw · I bag ·
         Tab details · P pause

   THE KIT. Robin makes jewelry that does things, and the night starts at
   her bench finishing tonight's pieces (the workshop) — that is where you
   find out what each one does. See `the kit` below, and KIT in tshai.js.
   ===================================================================== */
window.TSH = (function(){
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const $ = s => document.querySelector(s);
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const AI = window.TSHAI, LOOK = window.TSHLOOK, CITY = window.TSHCITY;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b-a)*k;
  const angTo = (ax, az, bx, bz) => Math.atan2(bx-ax, bz-az);
  const angDiff = (a, b) => Math.atan2(Math.sin(a-b), Math.cos(a-b));
  const EYE_ = 1.7;

  /* ============================================================ the words
     George's lines, as he wrote them, in the order the night plays them.
     Where the game lets you change what happened, a line has a variant
     (…Mom, …Bare, …Robbed) — the variants are written to sound like the
     scene they replace, and they are the only lines here that are not
     his. `who` picks the colour and the name on the subtitle. */
  const LINES = {
    open:      [['robin','Let\'s go.']],
    deal1:     [['kai','YU?'], ['robin','Spell it out.'], ['kai','Y, U.'], ['robin','Cash first.'], ['kai','Show me the merchandise.']],
    deal2:     [['robin','I said. Money first.'], ['kai','I\'d change that attitude.'], ['robin','Not making friends here, are we?'], ['kai','A word of advice.']],
    deal3:     [['kai','Shades and hoodies won\'t hide you forever.'], ['robin','Yeah, yeah. Thank you for your business.']],
    deal3Bare: [['kai','No shades. No hood. Bold.'], ['kai','Faces get remembered, kid.'], ['robin','Yeah, yeah. Thank you for your business.']],
    handed:    [['kai','Pleasure doing business.'], ['robin','Hey — the money!'], ['kai','Call it tuition.']],
    walkoff:   [['kai','Hey! Where do you think you\'re going?']],
    dropSent:  [['robin','📱 Mailbox. Dragon Alley. Rings inside. Leave the cash.']],
    dropReply: [['kai','📱 Fine.']],
    news:      [['mom','Those who\'ve doubted us have been proven wrong.'],
                ['mom','Security operations conducted by WFC have suppressed the violence plaguing parts of our city.'],
                ['mom','With illicit wearable weaponry now off the streets,'],
                ['mom','we assure you that the city is a better place—']],
    newsRobin: [['robin','Hi, Mom.']],
    roof:      [['kai','What\'s next?'], ['maya','I told you to take that off on the job.'], ['kai','The world should know who we are.'],
                ['maya','The world is not ready for us. And neither are we.'], ['maya','Before we are, it\'s best to stay invisible.'],
                ['kai','Hiding. Waiting. Lying low. I\'m sick of it all. This is not what you promised, Maya.'],
                ['maya','That, Kai, is why you need more time. And we both know I\'m not the only one who thinks this way.']],
    roofPaid:  [['maya','The merchandise.'], ['kai','A wad of cash for two rings made by a kid.'], ['kai','What\'s all this for?'], ['maya','Put it on.'],
                ['maya','Minimal force, and only on my mark. Are we clear?']],
    roofRobbed:[['maya','The merchandise.'], ['kai','Two rings. Didn\'t cost us a thing.'], ['maya','I told you to pay her. The cash was the point.'],
                ['maya','Put it on.'], ['maya','Minimal force, and only on my mark. Are we clear?']],
    roofStiffed:[['maya','The merchandise.'], ['kai','She took the cash. And kept the rings.'], ['maya','…I like her more every minute.']],
    roofNoShow:[['kai','She never showed.'], ['maya','Then we go to her.']],
    roofScout: [['maya','She looked right at me, you know. Earlier.']],
    trkOn:     [['maya','There you are.']],
    trkPlanted:[['maya','She\'s… on a delivery truck. Doing laps.'], ['kai','Clever.'], ['maya','Very.']],
    trkCrushed:[['maya','Signal\'s dead. She found it.'], ['kai','Told you. No ordinary kid.']],
    tail:      [['maya','📱 Where are you?'], ['kai','📱 Following her.'], ['maya','📱 Don\'t touch her. Not yet.']],
    voicemail: [['counselor','Hey Robin. I\'m still waiting on your decision on a summer internship.'],
                ['counselor','I understand why you might be inclined to take your time, considering, for the lack of a better word, the cushion your family background provides—'],
                ['robin','Oh you prick.']],
    knock:     [['maya','Nobody\'s lost me before, you know.'], ['maya','I had to ask around. Open up, Robin.']],
    apt0:      [['maya','This is quite lovely.']],
    apt1:      [['maya','Forgive my curiosity. Robin, right?'], ['robin','Who are you?'], ['maya','Relax, Robin. I just want to talk.'],
                ['robin','Do not call me that.'], ['maya','Oh. Very spunky. I like you already.']],
    apt2Mom:   [['maya','Considering who your mother is, a coveted internship at the WFC will definitely shut that annoying counselor up.'],
                ['maya','But you don\'t need that, do you?']],
    apt2:      [['maya','A coveted internship would definitely shut that annoying counselor up.'], ['maya','But you don\'t need that, do you?']],
    apt3:      [['maya','I\'m a fan of your work. Actually, I\'ve got one of your toys myself.'], ['robin','What do you want?'],
                ['maya','Your help. But perhaps you should ask yourself that question as well.'],
                ['maya','What do you want to do with your life, Robin? Sit behind a desk your mother picked out for you? Or take a shot at changing the world?'],
                ['robin','Didn\'t know chances like that would turn up unannounced in the middle of the night. Not interested, no thanks.'],
                ['maya','I would take some time to consider if I were you.'],
                ['robin','Okay, first, you\'re not me. Second, you and me, we\'re very different. I don\'t break into other people\'s home and threaten them.'],
                ['maya','You\'re right, Robin. I\'m not you. But I know the situation you\'re in.']],
    apt4Mom:   [['maya','Mommy wouldn\'t be too happy if she found out what you were up to earlier, am I right?']],
    apt4:      [['maya','Somebody out there would pay a lot for the name behind YU. Am I right?']],
    apt5:      [['robin','You need to leave. Now.'],
                ['maya','We\'re not that different, Robin. Making quick cash sure feels good, but there is so much happening in the shadows of our city, beyond what WFC can control.'],
                ['maya','Whether you\'ve realized or not, your talent has led you on a dangerous path alone, and I\'m here to offer you the map.'],
                ['robin','How do I know you\'re not the danger?'], ['maya','Come with me and I\'ll show you.'], ['robin','That\'s supposed to convince me?'],
                ['maya','You\'ll spare me the unpleasant part of this job, and believe me, you don\'t want to go there.'],
                ['robin','You come here, uninvited, dropping threats veiled as compliments, and you think that\'s going to convince me?'],
                ['maya','There are rules that I have to follow.'], ['robin','You chose to follow them.'], ['maya','Not all of us are blessed with choice.'],
                ['robin','Well, I make my own rules.']],
    hands:     [['maya','Hands where I can see them.']],
    callKai:   [['maya','Kai.']],
    dark:      [['maya','Kai!']],
    window:    [['maya','Kai — the window!']],
    after1:    [['kai','She\'s gone.'], ['kai','Where\'s she going?']],
    afterJam:  [['maya','Tracker\'s not working.']],
    afterNone: [['maya','Nothing to follow her with.']],
    after2:    [['kai','I\'ll chase her down.'], ['maya','You won\'t find her.'], ['kai','Did you see her face?'], ['maya','Calm down. Kai.'],
                ['kai','I\'ll wait till she comes back.'], ['maya','Calm. Down.'], ['kai','That little punk. She\'ll pay for this.'],
                ['maya','Stop. This wouldn\'t have happened if you listened to me. Go. You\'re done here.']],
    after3:    [['kai','She got away because I listened to you. I should\'ve just nabbed her in that alley. I\'m done with all this no violence bull crap.'],
                ['maya','What are you gonna do? Go back to working alone? Or beg your father to take you back in?'], ['kai','Take that back.']],
    chair3:    [['kai','Told you. Should\'ve just nabbed her in that alley. I\'m done with all this no violence bull crap.'],
                ['maya','What are you gonna do? Go back to working alone? Or beg your father to take you back in?'], ['kai','Take that back.']],
    barrier:   [['maya','Should\'ve listened to me.']],
    chairLeave:[['maya','Stay put, Robin. I\'ll be right back.']],
    chairCall: [['maya','(on the stairs) …no. She\'s thinking about it.'], ['maya','(on the stairs) Give her a minute.']],
    laugh:     [['robin','(laughs)']],
    /* THE OPENING'S CALL: the buyer, on the phone, and Robin half asleep */
    call:      [['buyer','Hey. You got my order?'], ['robin','Yeah. It\'s ready.']]
  };
  const WHO = { robin:['ROBIN','#ffd9a8'], kai:['KAI','#ff8a6a'], buyer:['THE BUYER','#ff8a6a'], maya:['MAYA','#d0b4ff'], mom:['THE DIRECTOR','#9fd8ff'],
                counselor:['COUNSELOR — VOICEMAIL','#b8c4c0'], wfc:['WFC','#8ff0ff'], vendor:['VENDOR','#ffd070'], buyer:['UNKNOWN NUMBER','#ff8a6a'] };

  /* ============================================================ the save */
  const KEY = 'tsh';
  function fresh(){
    return { v:1, step:'intro', t:8, heat:0, maxHeat:0, exposure:0, cash:0, rings:true, flash:3, can:false,
             kit:{ cuffs:false, bangles:false, studs:false, rings:false },
             trail:AI.freshTrail(), flags:{}, dealPath:[], seen:[], done:false, runs:0, pos:null, cp:null, last:null };
  }
  let S = fresh();
  function load(){
    try{ const raw = window.PROGRESS && PROGRESS.get(KEY, null); if(raw){ const s = JSON.parse(raw); if(s && s.v===1) S = Object.assign(fresh(), s); } }catch(e){ S = fresh(); }
    // a night saved before the storyboard: the scenes behind the beat it was in have played
    if(!Array.isArray(S.seen)) S.seen = AI.seenBefore(S.step);
  }
  function save(){ try{ if(window.PROGRESS) PROGRESS.set(KEY, JSON.stringify(S)); }catch(e){} }
  /* A checkpoint is the whole state at the top of a beat. Leaving and
     coming back replays the beat you were in, with everything before it
     kept — the way a GTA mission restarts at its last checkpoint. */
  function checkpoint(){
    const snap = Object.assign({}, S); delete snap.cp; delete snap.last;
    snap.pos = [G.pos.x, G.pos.y, G.pos.z, G.yaw];
    S.cp = JSON.stringify(snap); save();
  }
  function restore(){
    if(!S.cp || S.done) return false;
    try{ const snap = JSON.parse(S.cp), cp = S.cp, last = S.last, runs = S.runs; S = Object.assign(fresh(), snap); S.cp = cp; S.last = last; S.runs = runs;
         if(!Array.isArray(S.seen)) S.seen = AI.seenBefore(S.step); return true; }
    catch(e){ return false; }
  }

  /* ============================================================== sound
     Made, not loaded: a rain bed, a low city hum, and a handful of
     cues. All of it goes quiet on the way out. */
  let AC = null, bed = null;
  function audio(){
    if(AC) return AC;
    try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ AC = null; }
    return AC;
  }
  function noiseBuf(secs, brown){
    const a = audio(); if(!a) return null;
    const b = a.createBuffer(1, a.sampleRate*secs, a.sampleRate), d = b.getChannelData(0); let last = 0;
    for(let i=0;i<d.length;i++){ const w = Math.random()*2-1; if(brown){ last = (last + 0.02*w)/1.02; d[i] = last*3.5; } else d[i] = w; }
    return b;
  }
  function startBed(){
    const a = audio(); if(!a || bed) return;
    try{
      const rain = a.createBufferSource(); rain.buffer = noiseBuf(3, false); rain.loop = true;
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
      const g = a.createGain(); g.gain.value = 0.0;
      rain.connect(hp); hp.connect(lp); lp.connect(g); g.connect(a.destination); rain.start();
      const hum = a.createBufferSource(); hum.buffer = noiseBuf(4, true); hum.loop = true;
      const hg = a.createGain(); hg.gain.value = 0.0; hum.connect(hg); hg.connect(a.destination); hum.start();
      bed = { rain, hum, g, hg, lp };
      g.gain.setTargetAtTime(0.05, a.currentTime, 1.5); hg.gain.setTargetAtTime(0.07, a.currentTime, 2);
    }catch(e){ bed = null; }
  }
  function muffle(inside){
    if(!bed || !AC) return;
    bed.lp.frequency.setTargetAtTime(inside ? 380 : 1400, AC.currentTime, 0.4);
    bed.g.gain.setTargetAtTime(inside ? 0.025 : 0.05, AC.currentTime, 0.4);
  }
  function stopBed(){
    if(!bed) return;
    try{ bed.rain.stop(); bed.hum.stop(); }catch(e){}
    bed = null;
  }
  /* the cues: a shaped tone or a burst of filtered noise */
  function cue(kind){
    const a = audio(); if(!a) return;
    try{
      if(a.state === 'suspended') a.resume();
      const t = a.currentTime, g = a.createGain(); g.connect(a.destination);
      const tone = (f0, f1, dur, type, vol) => { const o = a.createOscillator(); o.type = type||'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t+dur);
        const gg = a.createGain(); gg.gain.setValueAtTime(vol||0.08, t); gg.gain.exponentialRampToValueAtTime(0.0008, t+dur); o.connect(gg); gg.connect(a.destination); o.start(t); o.stop(t+dur+0.05); };
      const burst = (dur, f, vol, q) => { const s = a.createBufferSource(); s.buffer = noiseBuf(dur, false); const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q||0.7;
        const gg = a.createGain(); gg.gain.setValueAtTime(vol, t); gg.gain.exponentialRampToValueAtTime(0.0008, t+dur); s.connect(bp); bp.connect(gg); gg.connect(a.destination); s.start(t); };
      if(kind==='flash'){ burst(0.5, 3000, 0.5, 0.4); tone(2200, 300, 0.4, 'square', 0.05); }
      else if(kind==='jam'){ tone(200, 1800, 0.5, 'sawtooth', 0.04); tone(1800, 200, 0.5, 'sawtooth', 0.03); }
      else if(kind==='alert'){ tone(520, 780, 0.18, 'square', 0.06); setTimeout(()=>cue('alert2'), 170); }
      else if(kind==='alert2'){ tone(780, 520, 0.18, 'square', 0.06); }
      else if(kind==='sus'){ tone(420, 560, 0.2, 'triangle', 0.05); }
      else if(kind==='heat'){ tone(900, 600, 0.25, 'square', 0.05); setTimeout(()=>{ try{ tone(900, 600, 0.25, 'square', 0.05); }catch(e){} }, 280); }
      else if(kind==='pick'){ tone(700, 1200, 0.12, 'sine', 0.07); }
      else if(kind==='step'){ burst(0.08, 900, 0.05); }
      else if(kind==='kick'){ burst(0.3, 250, 0.4, 0.5); tone(120, 60, 0.3, 'sine', 0.2); }
      else if(kind==='ui'){ tone(900, 900, 0.06, 'sine', 0.04); }
      else if(kind==='scan'){ tone(1500, 1500, 0.05, 'sine', 0.03); }
      else if(kind==='ring'){ [0, 0.13, 0.26, 0.52, 0.65, 0.78].forEach((d, i)=>{ const o = a.createOscillator(), gg = a.createGain(); o.type = 'triangle';
        o.frequency.value = [1319, 1568, 1976, 1319, 1568, 1976][i]; gg.gain.setValueAtTime(0.0001, t + d); gg.gain.exponentialRampToValueAtTime(0.09, t + d + 0.01); gg.gain.exponentialRampToValueAtTime(0.0008, t + d + 0.12);
        o.connect(gg); gg.connect(a.destination); o.start(t + d); o.stop(t + d + 0.14); }); }
      else if(kind==='hangup'){ tone(620, 620, 0.06, 'square', 0.03); burst(0.05, 2500, 0.08); }
      else if(kind==='zip'){ const s_ = a.createBufferSource(); s_.buffer = noiseBuf(0.45, false); const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
        bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(5200, t + 0.4); const gg = a.createGain(); gg.gain.setValueAtTime(0.12, t); gg.gain.exponentialRampToValueAtTime(0.0008, t + 0.42);
        s_.connect(bp); bp.connect(gg); gg.connect(a.destination); s_.start(t); }
      else if(kind==='gear'){ tone(260, 1700, 0.42, 'sawtooth', 0.025); setTimeout(()=>{ try{ tone(1700, 1700, 0.1, 'sine', 0.05); }catch(e){} }, 400); }
      else if(kind==='window'){ burst(0.7, 500, 0.22, 0.5); burst(1.6, 1200, 0.06, 0.3); }
      else if(kind==='phone'){ tone(1320, 1320, 0.12, 'sine', 0.05); setTimeout(()=>{ try{ tone(1760, 1760, 0.12, 'sine', 0.05); }catch(e){} }, 150); }
      else if(kind==='punch'){ burst(0.15, 400, 0.5); tone(1200, 3000, 0.4, 'sine', 0.06); }
      else if(kind==='door'){ burst(0.25, 500, 0.2); }
      else if(kind==='fail'){ tone(300, 120, 0.6, 'sawtooth', 0.05); }
      else if(kind==='win'){ tone(520, 1040, 0.5, 'sine', 0.06); }
    }catch(e){}
  }

  /* ============================================================ the world */
  let on = false, server = null, root = null, W = null, clock = 0, inside = false;
  /* A TIMER BELONGS TO THE NIGHT THAT SET IT. Leave mid-scene and come
     straight back, and the old night's timers used to go off in the new
     one — Maya "leaving" a flat she had just walked into. Each entry is a
     new run; a timer from another run does nothing. */
  let run = 0;
  const later = (f, ms) => { const r = run; return setTimeout(()=>{ if(on && run === r) f(); }, ms); };
  let things = [], mode = null, busy = null;          // mode: 'cut' | 'climb' | 'ride' | 'hide' | 'grab' | 'chair' | 'end'
  const dyn = [];                                      // solids that move (trucks), refreshed each frame

  function enter(sv){
    server = sv || null;
    run++; talkQ = []; sayOver = null; cv = null; dealT = null;
    inside = false;           // a night that was left from inside the flat starts on the street, like any other
    load();
    const resumed = restore();
    if(!resumed){ const runs = S.runs, last = S.last; S = fresh(); S.runs = runs; S.last = last; }
    if(window.MENU && MENU.hideAll) MENU.hideAll();
    on = true; busy = null; mode = null; clock = 0;
    keepRig();
    G.room = 'tsh'; G.hudOwner = 'tsh';
    G.firstPerson = false;
    G.camera.up.set(0,1,0);
    G.camera.near = 0.1; G.camera.far = 1400; G.camera.fov = 70; G.camera.updateProjectionMatrix();
    ['#hud', '#mapwrap', '#briefing'].forEach(q=>{ const e = $(q); if(e) e.classList.add('hidden'); });
    if(window.CHAT) CHAT.hide();
    buildWorld();
    ui();
    if(window.WARDROBE) WARDROBE.cast('robin', kitSlots());          // her kit, before her body arrives, so it arrives dressed
    if(window.AVATAR){ AVATAR.posture(null); AVATAR.setCast('robin'); }
    // where the beat you are in starts
    if(S.step === 'end') S.step = 'out';
    if(S.step === 'intro' || S.step === 'prep'){ S.step = 'wake'; S.t = AI.AT.wake; S.dealPath = []; S.lesson = 0; S.boots = null; }
    if(S.step === 'wake'){ const r = W.room; placePlayer(r.bed.x, r.bed.z, 0); S.seen = S.seen.filter(x=>x !== 'wake'); }
    else if(S.step === 'lesson'){ placePlayer(HOME_ROOF[0], HOME_ROOF[2], Math.PI/2, HOME_ROOF[1] + EYE_); }
    else if(S.pos) placePlayer(S.pos[0], S.pos[2], S.pos[3], S.pos[1]);
    else placePlayer(-86, 8, -Math.PI/2);
    if(S.step === 'apt' || S.step === 'escape' || S.step === 'chair' || S.step === 'escape2'){ S.step = 'apt'; goInside(true); }
    if(window.AVATAR) AVATAR.attach().then(()=>dress());
    G.running = true;
    startBed();
    populate();
    bootsOn();
    if(S.step === 'wake'){ later(()=>{ if(on && S.step === 'wake') scene('wake', opening); }, 300); return; }
    beatStart(true);
    if(S.step === 'lesson'){ mark('wake'); lessonBegin(true); }
    title();
    lockPointer($('#view'));
  }
  /* Everything off, without going anywhere: PLANET.enter() calls this when
     something else takes you out of the city (the pause card's HOME). */
  function stop(){
    if(!on) return;
    cv = null; dealT = null; me.scale = null;
    on = false; mode = null; busy = null;
    save();
    vstop(); stopBed(); clearNpcs(); clearMarks();
    if(window.BOOTS) BOOTS.detach();
    reel = null; staged = null; ringing(false); phoneBig(null); black(false); scoreStop(0.3); me.kit = null; me.kitT = null;
    if(window.WARDROBE) WARDROBE.cast('robin', null);
    if(el) el.classList.add('hidden');
    document.body.classList.remove('tsh-on');
    LOOK.dispose();
    lights.forEach(l=>{ if(l.parent) l.parent.remove(l); }); lights.length = 0;
    if(root && root.parent) root.parent.remove(root);
    root = null; W = null; dyn.length = 0;
    G.scene.background = null; G.scene.fog = null;
    giveRigBack();
    if(window.AVATAR){ AVATAR.setCast(null); AVATAR.posture(null); }
    const h = $('#hud'); if(h) h.classList.remove('hidden');
  }
  function leave(){
    if(!on) return;
    if(S.step !== 'end' && !S.done) S.pos = null;           // the checkpoint keeps its own spot
    stop();
    const sv = (window.NET && window.PLANET) ? PLANET.server : server;
    if(window.PLANET) PLANET.enter(sv, 'hub');
  }

  function buildWorld(){
    if(G.roomGroup) G.scene.remove(G.roomGroup);
    root = new THREE.Group(); G.roomGroup = root; G.scene.add(root);
    G.solids = []; G.hits = []; G.selected = null; G.focused = null;
    G.vel.set(0,0,0); G.onGround = true;
    W = CITY.build(root);
    W.solids.forEach(s=>G.solids.push(s));
    W.checkpoint.solids.forEach(s=>{ s.off = true; });        // switched on by the clock
    G.ground = groundAt; G.ceiling = streetLid;
    applyLook();
    LOOK.init(G.renderer);
    makeLights();
    W.aptGroup.visible = false;
    things = [];
    wireThings();
  }
  /* THE CHASE CAMERA DUCKS. game.js keeps it out of walls; this keeps it
     under what hangs off them. Asked at the lens and twice on the way back
     to Robin's head, so a sign between the two pulls it down as well as a
     sign it is sitting in. Outside only: the flat has a plain ceiling. */
  function streetLid(x, z, fy){
    if(!W || !W.ceilingAt) return Infinity;
    let lid = W.ceilingAt(x, z, fy);
    for(const k of [0.35, 0.7]) lid = Math.min(lid, W.ceilingAt(lerp(x, G.pos.x, k), lerp(z, G.pos.z, k), fy));
    return lid;
  }
  /* THE LENS, LAST. game.js has put the chase camera behind Robin and
     out of the walls; the district is also full of things that are not
     walls — lanterns, awnings, blade signs, stalls, the alley's canopy —
     and a camera parked in one films a lampshade. So just before the
     frame is drawn: if the lens is up against something, or something is
     between it and her, it comes in along the line back to her (and a
     little lower) to the first spot that is clear. It comes in quickly
     and goes back out slowly, so it does not pump.

     game.js eases the camera from wherever it was last frame, so the
     spot it chose is put back before it runs again (chaseBack, from
     tick) — otherwise this would be feeding on its own correction. */
  const chase = { k:1, dy:0, raw:null };
  function chaseBack(){
    if(chase.raw && ((mode === null && G.running) || mode === 'scale')) G.camera.position.copy(chase.raw);
    chase.raw = null;
  }
  function chaseCam(dt){
    const free = (mode === null && G.running) || mode === 'scale';
    if(!free || busy || inside || !W || !W.lens){ chase.k = 1; chase.dy = 0; return; }
    const L = W.lens, cam = G.camera.position, head = V(G.pos.x, G.pos.y + 0.1, G.pos.z);
    chase.raw = cam.clone();
    const off = cam.clone().sub(head);
    const at = (k, dy) => { const p = head.clone().addScaledVector(off, k); p.y = Math.max(head.y + 0.25, p.y + dy*k); return p; };
    const clear = p => !L.near(p.x, p.y, p.z, 0.45) && !L.seg(p.x, p.y, p.z, head.x, head.y, head.z);
    let tk = 1, tdy = 0;
    if(!clear(cam)){
      tk = 0.22; tdy = -1;
      find: for(const k of [0.85, 0.7, 0.55, 0.42, 0.3]) for(const dy of [0, -0.7, -1.4]){ if(clear(at(k, dy))){ tk = k; tdy = dy; break find; } }
    }
    const e = 1 - Math.exp(-dt*(tk < chase.k ? 14 : 2.5));
    chase.k = lerp(chase.k, tk, e); chase.dy = lerp(chase.dy, tdy, e);
    if(chase.k > 0.995 && Math.abs(chase.dy) < 0.01) return;
    cam.copy(at(chase.k, chase.dy));
    const dir = V(-Math.sin(G.yaw), 0, -Math.cos(G.yaw));
    G.camera.lookAt(head.clone().addScaledVector(dir, 6).setY(G.pos.y + Math.sin(G.pitch)*5));
  }
  /* the platforms: the highest one under you that you could have stepped onto */
  function groundAt(x, z, feet){
    let best = 0;
    const lim = (feet === undefined ? 1e9 : feet + 0.7);
    for(const p of W.plats){ if(x >= p.x1 && x <= p.x2 && z >= p.z1 && z <= p.z2 && p.top <= lim && p.top > best) best = p.top; }
    return best;
  }

  /* ---------------------------------------------------------- the light
     Night: a teal moon casting soft shadows round wherever you are, a
     dim teal sky and a black ground in the hemisphere, fog the colour of
     the haze in the reference, and an environment map made of the city's
     own colours so wet things have something to reflect. */
  let rigWas = null, envRT = null;
  function keepRig(){
    if(rigWas) return;
    rigWas = { exp:G.renderer.toneMappingExposure, envI:G.scene.environmentIntensity,
      amb: G.amb && [G.amb.color.getHex(), G.amb.intensity], hemi: G.hemi && [G.hemi.color.getHex(), G.hemi.groundColor.getHex(), G.hemi.intensity],
      sun: G.sun && [G.sun.color.getHex(), G.sun.intensity, G.sun.position.clone(), G.sun.target.position.clone()],
      sc: G.sun && [G.sun.shadow.camera.left, G.sun.shadow.camera.right, G.sun.shadow.camera.top, G.sun.shadow.camera.bottom] };
  }
  function giveRigBack(){
    const w = rigWas; if(!w) return;
    G.renderer.toneMappingExposure = w.exp;
    G.scene.environment = null; G.scene.environmentIntensity = w.envI===undefined ? 1 : w.envI;
    if(G.amb && w.amb){ G.amb.color.setHex(w.amb[0]); G.amb.intensity = w.amb[1]; }
    if(G.hemi && w.hemi){ G.hemi.color.setHex(w.hemi[0]); G.hemi.groundColor.setHex(w.hemi[1]); G.hemi.intensity = w.hemi[2]; }
    if(G.sun && w.sun){ G.sun.color.setHex(w.sun[0]); G.sun.intensity = w.sun[1]; G.sun.position.copy(w.sun[2]); G.sun.target.position.copy(w.sun[3]); G.sun.target.updateMatrixWorld();
      const c = G.sun.shadow.camera; [c.left, c.right, c.top, c.bottom] = w.sc; c.updateProjectionMatrix(); }
    if(envRT){ envRT.dispose(); envRT = null; }
    rigWas = null;
  }
  function applyLook(){
    const fogCol = 0x0b2a26;
    G.scene.background = new THREE.Color(fogCol);
    G.scene.fog = new THREE.FogExp2(fogCol, 0.0155);
    G.amb.color.setHex(0x1f5a50); G.amb.intensity = 0.42;
    G.hemi.color.setHex(0x46b8a4); G.hemi.groundColor.setHex(0x0a1210); G.hemi.intensity = 0.85;
    G.sun.color.setHex(0x7af0dc); G.sun.intensity = 0.7;
    const c = G.sun.shadow.camera; c.left = -45; c.right = 45; c.top = 45; c.bottom = -45; c.updateProjectionMatrix();
    G.renderer.toneMappingExposure = 0.95;
    // the environment: a teal dome, orange lanterns low down, the tubes, the neon
    try{
      const es = new THREE.Scene(), trash = [];
      const sg = new THREE.SphereGeometry(50, 32, 16), P = sg.attributes.position, col = [];
      const top = new THREE.Color(0x0e3a34), hor = new THREE.Color(0x2a7a6c), bot = new THREE.Color(0x050807), cc = new THREE.Color();
      for(let i=0;i<P.count;i++){ const y = P.getY(i)/50; if(y > 0) cc.copy(hor).lerp(top, Math.pow(y, 0.5)); else cc.copy(hor).lerp(bot, Math.pow(-y, 0.4)); col.push(cc.r, cc.g, cc.b); }
      sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const sm = new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.BackSide }); es.add(new THREE.Mesh(sg, sm)); trash.push(sg, sm);
      [[0xff6a2a, 3, 25, 3, 10, 8, 3], [0xff5a1a, 2.5, -20, 2, 25, 6, 3], [0xc8ffe8, 4, 0, 18, 0, 14, 2], [0x38ffd0, 3, -30, 6, -15, 10, 4],
       [0xff3fd0, 2, 30, 8, -25, 8, 4], [0x8fd8ff, 2.5, 5, 10, 35, 12, 5]].forEach(([hex, k, x, y, z, w, h])=>{
        const pg = new THREE.PlaneGeometry(w, h), pm = new THREE.MeshBasicMaterial({ color:new THREE.Color(hex).multiplyScalar(k), side:THREE.DoubleSide });
        const m = new THREE.Mesh(pg, pm); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); trash.push(pg, pm); });
      const pm = new THREE.PMREMGenerator(G.renderer); envRT = pm.fromScene(es, 0.03); pm.dispose(); trash.forEach(t=>t.dispose());
      G.scene.environment = envRT.texture; G.scene.environmentIntensity = 0.6;
    }catch(e){ G.scene.environment = null; }
  }
  /* A DOZEN REAL LIGHTS, borrowed by the nearest of the city's sources
     (tshcity.js keeps the list). Each one fades as it is handed over, so
     walking down a street never looks like somebody flicking switches. */
  const POOL = 10, lights = [];
  let lightT = 0;
  function makeLights(){
    lights.length = 0;
    for(let i=0;i<POOL;i++){ const l = new THREE.PointLight(0xffffff, 0, 10, 2); l.userData = { src:null, want:0 }; root.add(l); lights.push(l); }
  }
  function tickLights(dt){
    lightT -= dt;
    const srcs = inside ? aptSources() : W.lights;
    if(lightT <= 0){
      lightT = 0.25;
      const cx = G.camera.position.x, cz = G.camera.position.z, px = G.pos.x, pz = G.pos.z;
      const score = s => Math.min((s.x-cx)*(s.x-cx) + (s.z-cz)*(s.z-cz), (s.x-px)*(s.x-px) + (s.z-pz)*(s.z-pz)*0.8) / (s.k+4);
      const best = srcs.slice().sort((a, b)=>score(a) - score(b)).slice(0, POOL);
      // keep the lights already on a chosen source; hand the rest over
      const keep = new Set();
      lights.forEach(l=>{ if(l.userData.src && best.includes(l.userData.src)) keep.add(l.userData.src); else l.userData.want = 0; });
      const free = lights.filter(l=>!keep.has(l.userData.src));
      best.filter(s=>!keep.has(s)).forEach(s=>{ const l = free.shift(); if(!l) return; l.userData.next = s; });
    }
    lights.forEach(l=>{
      const u = l.userData;
      if(u.next && l.intensity < 0.05){ const s = u.next; u.src = s; u.next = null; l.position.set(s.x, s.y, s.z); l.color.copy(s.col); l.distance = s.d*1.5; u.want = s.k*(s.mul===undefined ? 1 : s.mul); }
      else if(u.next) u.want = 0;
      else if(u.src) u.want = u.src.k*(u.src.mul===undefined ? 1 : u.src.mul);
      l.intensity += (u.want - l.intensity)*Math.min(1, dt*5);
    });
    // the moon follows you, so its shadows are sharp where you are
    G.sun.position.set(G.pos.x - 28, 60, G.pos.z + 22); G.sun.target.position.set(G.pos.x, 0, G.pos.z); G.sun.target.updateMatrixWorld();
  }
  /* how lit a spot is, 0 (black) to about 1.5 (under a lamp), for who can see you */
  function lightAt(x, y, z){
    if(inside) return apt.lamp || apt.ceiling ? (apt.ceiling ? 1.1 : 0.6) : 0.05;
    let sum = 0.12;                                   // the moon and the haze
    for(const s of W.lights){ const d = Math.hypot(s.x-x, s.y-y, s.z-z); if(d < s.d) sum += s.k*(s.mul===undefined ? 1 : s.mul)*Math.pow(1 - d/s.d, 2)/12; }
    return Math.min(1.5, sum);
  }
  /* can a see b? Buildings (and the flat's walls) in the way, in 3-D. */
  function segT(ax, az, bx, bz, x1, x2, z1, z2){
    let t0 = 0, t1 = 1; const dx = bx-ax, dz = bz-az;
    const clip = (p, q) => { if(p === 0) return q >= 0; const r = q/p; if(p < 0){ if(r > t1) return false; if(r > t0) t0 = r; } else { if(r < t0) return false; if(r < t1) t1 = r; } return true; };
    return (clip(-dx, ax-x1) && clip(dx, x2-ax) && clip(-dz, az-z1) && clip(dz, z2-az) && t0 <= t1) ? [t0, t1] : null;
  }
  function los(ax, ay, az, bx, by, bz){
    for(const s of G.solids){
      if(s.off || s.y2 < 1.2) continue;
      const t = segT(ax, az, bx, bz, s.x1, s.x2, s.z1, s.z2); if(!t) continue;
      const y0 = ay + (by-ay)*t[0], y1 = ay + (by-ay)*t[1];
      if(Math.min(y0, y1) < s.y2 - 0.15 && Math.max(y0, y1) > s.y1) return false;
    }
    return true;
  }

  /* ========================================================== the player */
  const me = { hidden:false, hood:true, dress:null, glowL:null, glowR:null, grip:0, climbing:null, kit:null, kitT:null };
  const HOME_ROOF = [66, 12, 34];                    // a night picked up in the lesson starts on her own roof
  function placePlayer(x, z, yaw, y){
    const top = y !== undefined ? y - EYE_ : groundAt(x, z, 100);
    G.pos.set(x, top + EYE_, z); G.yaw = yaw || 0; G.pitch = -0.05; G.vel.set(0,0,0); G.onGround = true;
    G.camera.position.set(x + Math.sin(G.yaw)*5, top + 4, z + Math.cos(G.yaw)*5);
    G.camera.lookAt(x, top + 1.5, z);
  }
  const feet = () => G.pos.y - EYE_;
  const P = () => ({ x:G.pos.x, y:feet(), z:G.pos.z, moving:!!(G.keys.KeyW||G.keys.KeyS||G.keys.KeyA||G.keys.KeyD||G.keys.ArrowUp||G.keys.ArrowDown),
                     running:!!(G.keys.ShiftLeft||G.keys.ShiftRight) && !!(G.keys.KeyW||G.keys.ArrowUp||G.keys.KeyA||G.keys.KeyD||G.keys.KeyS) });
  function boneOf(model, re){ let b = null; model.traverse(o=>{ if(!b && re.test(o.name||'')) b = o; }); return b; }
  /* things hung off a bone are sized in metres by dividing the body's own scale back out (as avatar.js does for the blaster) */
  function worldK(bone){ const s = new THREE.Vector3(); bone.getWorldScale(s); return 1/(s.x||1); }
  /* HER KIT IS WARDROBE ITEMS (wardrobe.js): the jacket, the Gecko cuffs, the
     shoes, the flash bangle, the pack, the hood and shades — put on her the
     way anything goes on anybody, so what she wears in the story is what the
     closet shows, and the opening's suit-up is the wardrobe putting each
     piece on in turn. The story says WHICH pieces (a cast, so the player's
     own saved outfits are not touched); TSH keeps handles on the ones it
     lights and hides (the cuffs on a wall, the flash charges, the hood). */
  const KIT_ITEMS = { jacket:['outer', 'tech-jacket'], gloves:['hands', 'gecko-cuffs'], shoes:['shoes', 'skyline-shoes'], bracelet:['wrist', 'flash-bangle'], pack:['back', 'roll-top'] };
  function kitSlots(){
    const k = me.kit || KIT_ON, s = {};
    Object.keys(KIT_ITEMS).forEach(p=>{ if(k[p]){ const [slot, id] = KIT_ITEMS[p]; s[slot] = id; } });
    if(me.hood) s.head = 'hood';
    return s;
  }
  function dress(){
    if(!window.WARDROBE) return Promise.resolve();
    const slots = kitSlots(); WARDROBE.cast('robin', slots);
    const model = window.AVATAR && AVATAR.model; if(!model) return Promise.resolve();
    return WARDROBE.put(model, 'robin', slots).then(()=>handles(model));
  }
  function handles(model){
    if(!window.AVATAR || AVATAR.model !== model) return;
    const worn = id => WARDROBE.wornOn(model, id), role = (id, r) => worn(id).filter(o=>o.userData.role === r);
    const cuffs = role('gecko-cuffs', 'cuff'), glows = role('gecko-cuffs', 'glow');
    me.cuffL = cuffs[0] || null; me.cuffR = cuffs[1] || null; me.glowL = glows[0] || null; me.glowR = glows[1] || null;
    me.bangle = worn('flash-bangle')[0] || null; me.bangleLeds = me.bangle ? me.bangle.children.filter(o=>o.userData.role === 'glow') : [];
    me.pack = worn('roll-top')[0] || null; me.dress = worn('hood')[0] || null; me.jacket = worn('tech-jacket')[0] || null;
    cuffGlow(mode === 'scale');
  }
  function setHood(v){
    me.hood = v; dress();
    note(v ? '🧥 Hood up, shades on' : '🧥 Hood down — your face is showing', v ? '' : 'warn');
    cue('ui');
  }

  /* ---------------------------------------------------------- the things
     What E does, where. Each has a place, a reach, a verb and an icon,
     a `when` that decides whether it is there at all, and an act. */
  function thing(x, z, y, verb, act, o){ o = o||{}; const t = { x, z, y, verb, act, r:o.r||1.7, when:o.when, icon:o.icon||'', hold:o.hold||0, tag:o.tag }; things.push(t); return t; }
  function nearestThing(){
    let best = null, bd = Infinity; const fy = feet();
    for(const t of things){
      if(t.when && !t.when()) continue;
      if(t.y !== undefined && Math.abs(fy - t.y) > 1.6) continue;
      const d = Math.hypot(G.pos.x - t.x, G.pos.z - t.z);
      if(d < t.r && d < bd){ bd = d; best = t; }
    }
    return best;
  }
  function wireThings(){
    // ladders, both ends
    W.ladders.forEach(l=>{
      thing(l.bottom[0], l.bottom[1], l.y0, 'Climb up', ()=>climb(l, true), { icon:'🪜', r:1.5 });
      thing(l.top[0], l.top[1], l.y1, 'Climb down', ()=>climb(l, false), { icon:'🪜', r:1.4 });
    });
    // dumpsters: hide
    W.covers.forEach(([x, z, h])=>{ if(h > 1.3) thing(x, z, 0, 'Hide', ()=>hide(x, z), { icon:'🗑', r:1.8, when:()=>!inside }); });
    // cans: something to throw
    W.cans.forEach(([x, z], i)=>{ thing(x, z, 0, 'Pick up a can', ()=>{ S.can = true; S.flags['can'+i] = true; cue('pick'); note('🥫 A can — Q throws it. Somebody will go and look.'); hud(); },
      { icon:'🥫', r:1.2, when:()=>!S.can && !S.flags['can'+i] && !inside }); });
    // the metro
    [['west','harbor'], ['harbor','west']].forEach(([a, b])=>{ const s = W.spots['metro_'+a];
      thing(s[0], s[1], 0, 'Take the metro', ()=>metro(a, b), { icon:'🚇', r:2.4 }); });
    // scooters
    W.scooters.forEach((sc, i)=>{ sc.i = i; sc.thing = thing(sc.x, sc.z, 0, 'Take the scooter', ()=>ride(sc), { icon:'🛴', r:1.8, when:()=>!sc.gone && mode!=='ride' }); });
    // home
    const h = W.spots.home;
    const notYet = () => S.step !== 'home';                       // home is the end of the walk home, not a way out of the deal
    thing(h[0], h[1], 0, 'Go inside', ()=>homeDoor(), { icon:'🚪', r:2.2, when:()=>!inside && !notYet() });
    // the window of the flat, from the fire escape
    const hw = W.spots.homeWindow;
    thing(hw[0], hw[1], hw[2], 'Climb in the window', ()=>homeDoor(true), { icon:'🪟', r:1.8, when:()=>!inside && S.step !== 'out' && S.step !== 'end' && !notYet() });
    wireQuestThings();
  }

  /* ---------------------------------------------------------- climbing
     A ladder takes the keys for a second and a half and carries you up
     it, rung by rung, with the walk playing — then puts you on top,
     stepped back from the edge. */
  function climb(l, up){
    if(mode) return;
    const from = up ? l.bottom : l.top, to = up ? l.top : l.bottom, y0 = up ? l.y0 : l.y1, y1 = up ? l.y1 : l.y0;
    mode = 'climb'; G.running = false;
    me.climbing = { l, t:0, dur:0.5 + Math.abs(y1-y0)*0.16, from, to, y0, y1, face:Math.atan2(-l.nx, -l.nz) };
    G.yaw = me.climbing.face + Math.PI;          // facing the ladder, up or down: facing away put the camera between her and the wall
    cue('step');
    crimeSeen('climb');
  }
  function tickClimb(dt){
    const c = me.climbing; if(!c) return;
    c.t += dt/c.dur;
    const k = Math.min(1, c.t), l = c.l;
    const wx = l.x + l.nx*0.45, wz = l.z + l.nz*0.45;
    let x, z, y;
    if(k < 0.15){ const q = k/0.15; x = lerp(c.from[0], wx, q); z = lerp(c.from[1], wz, q); y = c.y0; }
    else if(k < 0.85){ const q = (k-0.15)/0.7; x = wx; z = wz; y = lerp(c.y0, c.y1, q); }
    else { const q = (k-0.85)/0.15; x = lerp(wx, c.to[0], q); z = lerp(wz, c.to[1], q); y = c.y1; }
    G.pos.set(x, y + EYE_, z);
    if(window.AVATAR){ AVATAR.gait(0, 1); AVATAR.update(dt, k > 0.1 && k < 0.9, false, true); }
    if(typeof thirdPerson === 'function') thirdPerson();
    if(k >= 1){ me.climbing = null; mode = null; G.running = true; G.vel.y = 0; G.onGround = true; }
  }

  /* ============================================================ the kit
     ROBIN MAKES JEWELRY. Pretty on a wrist or an ear, and every piece of
     it what WFC calls illicit wearable weaponry. Tonight's kit is still on
     her bench when the night starts (the workshop, below) — finishing it
     is how you find out what each piece does — and after that it is hers:
       G  Gecko cuffs     up any building's wall to its roof
       F  flash bangles   blind whoever is facing her
       J  static studs    six seconds of noise
          the two rings   the merchandise: a shield in each
     What each piece is and how long the grip holds live in tshai.js
     (KIT, GRIP). Outside the workshop every piece is simply there. */

  /* --------------------------------------------------- the Gecko cuffs
     G, facing a building's wall and close to it: palms on the wall, and
     up. W and S climb, A and D move along it, SPACE lets go. The film
     holds for GRIP.hold seconds and gets them back on the ground; run out
     and she slides down. At the top she pulls herself onto the roof.
     WFC who see it happen see illegal wearables in use, and anybody on
     the pavement with a phone sees something worth filming. */
  const grip = { left:AI.GRIP.hold, seenT:0, wallT:0, wall:null };
  function wallAt(reach){
    const fy = feet(), fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw), x = G.pos.x, z = G.pos.z;
    let best = null, bd = reach || 1.6;
    for(const s of G.solids){
      if(s.off || !s.tag || s.tag.indexOf('bld:') !== 0) continue;
      if(fy > s.y2 - 1.0 || fy < s.y1 - 1) continue;             // on its roof already, or under it
      const alongZ = z > s.z1 + 0.3 && z < s.z2 - 0.3, alongX = x > s.x1 + 0.3 && x < s.x2 - 0.3;
      for(const [nx, nz, d, over] of [[-1, 0, s.x1 - x, alongZ], [1, 0, x - s.x2, alongZ], [0, -1, s.z1 - z, alongX], [0, 1, z - s.z2, alongX]]){
        if(!over || d < -0.2 || d > bd) continue;
        if(-(fx*nx + fz*nz) < 0.5) continue;                     // she has to be facing it
        bd = d; best = { s, nx, nz };
      }
    }
    return best;
  }
  function tryScale(){
    if(mode || busy) return;
    if(inside){ note('🦎 Not in here. Outside, on a building\'s wall.', 'warn'); return; }
    // sprinting at a wall, she leaps onto it from a few steps out
    const run = P().running, w = wallAt() || (run ? wallAt(4.5) : null);
    if(!w){ note('🦎 Face a building\'s wall, close up — or sprint at one — and G grips it.', 'warn'); return; }
    if(grip.left < 1.5){ note('🦎 The film needs a rest — a few seconds on the ground.', 'warn'); cue('fail'); return; }
    const s = w.s, along = w.nx ? 'z' : 'x';
    const lo = (along === 'z' ? s.z1 : s.x1) + 0.4, hi = (along === 'z' ? s.z2 : s.x2) - 0.4;
    me.scale = { s, nx:w.nx, nz:w.nz, along, a:clamp(along === 'z' ? G.pos.z : G.pos.x, lo, hi), lo, hi, y:feet(), top:s.y2, mantle:null, leap:null };
    if(run){ const leap = Math.min(AI.GRIP.leap, s.y2 - 1.4 - feet()); if(leap > 0.3) me.scale.leap = { t:0, x:G.pos.x, z:G.pos.z, y:feet(), up:leap }; }
    mode = 'scale'; G.running = false; G.vel.set(0, 0, 0);
    G.yaw = Math.atan2(w.nx, w.nz);                              // facing the wall
    cue('pick'); grip.seenT = 0.4;
    S.flags.scaled = (S.flags.scaled||0) + 1;
    cuffGlow(true);
    if(!S.flags.scaleTip){ S.flags.scaleTip = true; note('🦎 W climb · S down · A/D along the wall · SPACE let go', 'big'); }
  }
  /* THE BODY ON THE WALL: the climbing clips from animations/WallStuff,
     baked into her model (character-x.glb). The clip plays at the speed
     she is moving — frozen when she hangs still — so her hands keep pace
     with the wall. A model from before the clips were baked walks up it. */
  function wallClip(dt, name, speed){
    if(!window.AVATAR) return;
    if(AVATAR.can && AVATAR.can(name)){ AVATAR.posture(name); AVATAR.update(dt*speed, false, false, true); return; }
    AVATAR.posture(speed ? null : 'jump'); AVATAR.gait(0, 1); AVATAR.update(dt, !!speed, false, true);
  }
  // where she is on the wall: `off` metres out from it (negative is onto the roof)
  function scalePos(sc, off){
    const s = sc.s;
    return [sc.along === 'x' ? sc.a : (sc.nx < 0 ? s.x1 - off : s.x2 + off),
            sc.along === 'z' ? sc.a : (sc.nz < 0 ? s.z1 - off : s.z2 + off)];
  }
  function tickScale(dt){
    const sc = me.scale; if(!sc) return;
    if(sc.leap){                                                   // the run-up: across the ground and up onto the wall
      const l = sc.leap; l.t += dt/1.0;                            // climb_start, trimmed to its run and leap
      const q = Math.min(1, l.t), [wx, wz] = scalePos(sc, 0.5), h = clamp((q - 0.45)/0.55, 0, 1);
      G.pos.set(lerp(l.x, wx, Math.min(1, q/0.6)), l.y + l.up*h*(2 - h) + EYE_, lerp(l.z, wz, Math.min(1, q/0.6)));
      G.yaw = Math.atan2(sc.nx, sc.nz);
      wallClip(dt, 'climb_start', 1);
      if(typeof thirdPerson === 'function') thirdPerson();
      if(q >= 1){ sc.y = l.y + l.up; sc.leap = null; }
      return;
    }
    if(sc.mantle){                                                 // the braced hang, pulled up into a crouch on the roof
      const m = sc.mantle; m.t += dt/1.13;                         // climb_top is 1.13 s
      const q = Math.min(1, m.t), [ix, iz] = scalePos(sc, -0.9), up = Math.min(1, q/0.7), fwd = clamp((q - 0.45)/0.55, 0, 1);
      G.pos.set(lerp(m.x, ix, fwd), lerp(m.y, sc.top, up*(2 - up)) + EYE_, lerp(m.z, iz, fwd));
      wallClip(dt, 'climb_top', 1);
      if(typeof thirdPerson === 'function') thirdPerson();
      if(q >= 1) offWall(null);
      return;
    }
    const k = G.keys, up = k.KeyW || k.ArrowUp, dn = k.KeyS || k.ArrowDown, lf = k.KeyA || k.ArrowLeft, rt = k.KeyD || k.ArrowRight;
    grip.left = Math.max(0, grip.left - dt);
    const slip = grip.left <= 0;
    if(slip && !sc.slipped){ sc.slipped = true; cue('fail'); note('🦎 The film gives out — sliding.', 'warn'); }
    const vy = slip ? -AI.GRIP.slide : (up ? AI.GRIP.up : 0) - (dn ? AI.GRIP.down : 0);
    // along the wall, to her right as she faces it
    const rx = sc.nz, rz = -sc.nx, side = slip ? 0 : ((rt ? 1 : 0) - (lf ? 1 : 0))*AI.GRIP.side*dt;
    sc.a = clamp(sc.a + side*(sc.along === 'x' ? rx : rz), sc.lo, sc.hi);
    sc.y += vy*dt;
    const [bx, bz] = scalePos(sc, 1.0), base = groundAt(bx, bz, sc.y + 0.6);
    if(sc.y <= base){ sc.y = base; if(dn || slip) return offWall(base); }
    if(sc.y >= sc.top - 1.3 && up && !slip){ const [x, z] = scalePos(sc, 0.5); sc.mantle = { t:0, x, y:sc.y, z }; cue('step'); return; }
    const [x, z] = scalePos(sc, 0.5);
    G.pos.set(x, sc.y + EYE_, z);
    G.yaw = Math.atan2(sc.nx, sc.nz);
    const G_ = AI.GRIP;
    if(slip) wallClip(dt, 'climb_down', 1.5);
    else if(vy > 0) wallClip(dt, 'climb_up', G_.up/G_.clip);
    else if(vy < 0) wallClip(dt, 'climb_down', G_.down/G_.clip);
    else wallClip(dt, 'climb_up', side ? 1.6 : 0);                 // along the wall; still, a held pose
    if(typeof thirdPerson === 'function') thirdPerson();
    grip.seenT -= dt; if(grip.seenT <= 0){ grip.seenT = 1; scaleSeen(); }
  }
  /* off the wall: onto the roof (y null), onto the ground (y), or let go (drop) */
  function offWall(y, drop){
    const sc = me.scale; if(!sc) return;
    me.scale = null; mode = null; G.running = true;
    if(window.AVATAR) AVATAR.posture(null);
    cuffGlow(false);
    if(y === null){
      const [x, z] = scalePos(sc, -1.3);
      G.pos.set(x, sc.top + EYE_, z); G.vel.set(0, 0, 0); G.onGround = true;
      if(!S.flags.firstRoof){ S.flags.firstRoof = true; talk([['robin', 'Still holds.']]); note('🦎 Any wall, any roof. Up here nobody looks — and the roofs go round the checkpoint.', 'big'); }
      return;
    }
    const [x, z] = scalePos(sc, 0.95);
    G.pos.set(x, y + EYE_, z);
    G.vel.set(drop ? sc.nx*1.5 : 0, drop ? 2 : 0, drop ? sc.nz*1.5 : 0); G.onGround = !drop;
    letGoOfKeys();
  }
  /* who saw the gear — the cuffs on a wall, the shoes in the air: WFC with eyes on her, a drone with her in its beam, a phone */
  function scaleSeen(){ gearSeen('cuffs'); }
  function gearSeen(what){
    const p = P();
    const wfc = npcs.some(n=>n.kind === 'wfc' && !n.gone && n.stun <= 0 && n.inApt === inside && n.sees) || drones.some(d=>d.inBeam && !d.static);
    if(wfc){
      /* the first time, a warning rather than a star: the drone on Kiln Street
         sweeps right past the fire escape where you learn to climb */
      if(!S.flags.gearSeen){ S.flags.gearSeen = true; if(me.scale) me.scale.grace = true; cue('sus'); note(what === 'boots' ? '👁 WFC nearly saw the shoes. Next time that is heat — to them it is illegal wearables. Bound where nobody is looking.' : '👁 WFC nearly saw the cuffs working. Next time that is heat — to them it is illegal wearables. Climb where nobody is looking.', 'bad'); }
      else if(!(me.scale && me.scale.grace)){ heat(AI.raise(S.heat, 'gear'), AI.CRIMES.gear.label); lastKnown = [p.x, p.z]; }   // the warning lasts the climb it came on
    }
    npcs.forEach(n=>{
      if(n.kind !== 'civ' || n.film || n.gone || n.stun > 0 || Math.hypot(n.x - p.x, n.z - p.z) > 20) return;
      if(canSee(n, p.x, p.y, p.z) && Math.random() < 0.5) startFilm(n);
    });
  }
  /* a crime a witness might care about (the ladders call this; a ladder is nobody's business) */
  function crimeSeen(kind){ if(kind === 'scale') scaleSeen(); }
  function cuffGlow(on_){ [me.cuffL, me.cuffR].forEach(m=>{ if(m){ m.visible = true; m.material.emissiveIntensity = on_ ? 3 : 0.5; } }); }

  /* ========================================================= the opening
     BLACK. A phone ringing — a call, not an alarm. Robin answers it half
     asleep: "Hey. You got my order?" "Yeah. It's ready." She hangs up.

     Then her room, slowly, as she gets up: a sixteen-year-old's mess, and
     all through it the things that say she is unusually good at something
     — sketches of clothes, a sewing machine, circuit boards, tools, a pair
     of sneakers with coils in the soles, a jacket with wiring in its
     seams, gadgets half made, packages taped and labelled for delivery,
     burner phones, cash, the orders on index cards.

     She gets ready. Not a costume: things she made. The jacket, the
     gloves, the shoes, the bracelet — each one wakes up as it goes on.
     The backpack, and the door. And she stops: dinner on the kitchen
     table, still covered, and a note from her mother. For a second she is
     only sixteen, and she knows she should stay. She puts the note back.

     The window. The city comes in. Up onto the sill, a look down, a smile
     — and she jumps, and it is yours: falling, SPACE, and the shoes fire.
     (The lesson, below.)

     It is a FILM, not a cutscene: no line waits for SPACE, the shots run
     on their own, and ENTER skips to the jump. */
  let reel = null;
  function playReel(shots, done){
    if(mode === 'ride') unride(); if(mode === 'hide') unhide();
    mode = 'reel'; G.running = false;
    reel = { shots, i:-1, t:0, base:0, done, shot:null, fired:null, fov:G.camera.fov };
    el.classList.add('cine');
    if(document.pointerLockElement) document.exitPointerLock();
    reelNext();
  }
  function reelNext(){
    const f = reel; if(!f) return;
    const over = f.shot ? Math.max(0, f.t - f.shot.dur) : 0;     // the part of a frame past the cut belongs to the next shot
    if(f.shot) f.base += f.shot.dur;
    f.i++;
    if(f.i >= f.shots.length) return reelEnd(false);
    const s = f.shot = f.shots[f.i]; f.t = over; f.fired = new Set();
    if(s.inside !== undefined) showInside(s.inside);
    if(s.enter) s.enter();
    scoreSync();
    G.camera.fov = s.fov || 50; G.camera.updateProjectionMatrix();
    reelCam();
  }
  function tickReel(dt){
    const f = reel; if(!f || !f.shot) return;
    // with the song playing, the film runs on the song's clock: a slow frame can never put the picture behind the music
    if(scoring() && AC && AC.state === 'running'){ const now = AC.currentTime; if(score.clockAt !== undefined) dt = Math.min(0.25, Math.max(0, now - score.clockAt)); score.clockAt = now; }
    const s = f.shot; f.t += dt;
    (s.beats||[]).forEach(([t, fn], j)=>{ if(f.t >= t && !f.fired.has(j)){ f.fired.add(j); fn(); } });
    if(reel !== f) return;
    if(staged && !s.tick) applyStage();
    if(me.kitT) for(const p in me.kitT) me.kitT[p] += dt;
    kitShow();
    if(s.tick) s.tick(dt, f.t, Math.min(1, f.t/s.dur));
    reelCam();
    if(window.AVATAR) AVATAR.tickClip(dt*(s.anim === undefined ? 1 : s.anim), false, false, true);
    if(s.after) s.after(dt, f.t);
    if(f.t >= s.dur) reelNext();
  }
  /* a shot's camera: a point, a [from, to] pair it moves between, or a function of the shot's progress */
  function reelCam(){
    const f = reel, s = f.shot, k = Math.min(1, f.t/s.dur), e = s.ease === false ? k : k*k*(3 - 2*k);
    const at = v => typeof v === 'function' ? v(k, f.t) : Array.isArray(v[0]) ? v[0].map((a, i)=>lerp(a, v[1][i], e)) : v;
    const c = at(s.cam), l = at(s.look);
    G.camera.position.set(c[0], c[1], c[2]); G.camera.lookAt(l[0], l[1], l[2]);
    if(s.fov2){ G.camera.fov = lerp(s.fov || 50, s.fov2, e); G.camera.updateProjectionMatrix(); }
  }
  function reelEnd(skipped){
    const f = reel; if(!f) return;
    reel = null; score.clockAt = undefined;
    el.classList.remove('cine');
    G.camera.fov = 70; G.camera.updateProjectionMatrix();
    if(mode === 'reel'){ mode = null; G.running = true; }
    letGoOfKeys();
    if(f.done) f.done(skipped);
  }
  function skipReel(){ if(reel) reelEnd(true); }
  function showInside(v){ W.aptGroup.visible = !!v; W.cityGroup.visible = !v; }

  /* ROBIN WHERE THE SHOT NEEDS HER: a clip, a place, a heading (and a tilt) */
  let staged = null;
  function stage(clip, x, y, z, ry, o){
    staged = { clip, x, y, z, ry:ry || 0, o:o || {} };
    G.pos.set(x, y + EYE_, z);
    applyStage();
  }
  /* held every frame: the body can arrive (it loads) after the shot that placed it */
  function applyStage(){
    const s = staged; if(!s || !window.AVATAR) return;
    AVATAR.posture(s.clip);
    const b = AVATAR.body; if(!b) return;
    b.position.set(s.x, s.y, s.z); b.rotation.set(s.o.rx || 0, s.ry, s.o.rz || 0, 'YXZ'); b.visible = true;
  }
  /* she walks from a to b over the shot (the walk clip, her feet on the floor) */
  function walkStage(a, b, k){
    const x = lerp(a[0], b[0], k), z = lerp(a[1], b[1], k);
    stage('walk', x, 0, z, Math.atan2(b[0] - a[0], b[1] - a[1]));
  }
  /* a point relative to a spot on the floor and a heading: d ahead of it, s to its right, at height y */
  function rel(x, z, ry, d, s_, y){ return [x + Math.sin(ry)*d - Math.cos(ry)*s_, y, z + Math.cos(ry)*d + Math.sin(ry)*s_]; }
  /* one of her hands, in the world */
  function handAt(side){
    const bd = window.AVATAR && AVATAR.body, model = bd && bd.children[0]; if(!model) return null;
    const h = boneOf(model, new RegExp(side + 'Hand$')); if(!h) return null;
    model.updateMatrixWorld(true); const p = new THREE.Vector3(); h.getWorldPosition(p); return p;
  }
  /* the middle of her two hands, in the world (what she is holding is there) */
  function handsAt(){
    const bd = window.AVATAR && AVATAR.body, model = bd && bd.children[0]; if(!model) return null;
    const l = boneOf(model, /LeftHand$/), r = boneOf(model, /RightHand$/), h = boneOf(model, /Head$/); if(!l || !r) return null;
    model.updateMatrixWorld(true);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    l.getWorldPosition(a); r.getWorldPosition(b); if(h) h.getWorldPosition(c);
    return { at:a.add(b).multiplyScalar(0.5), head:c };
  }

  /* -------------------------------------------------------- the kit on her
     In the film the pieces go on one at a time, and each one wakes up —
     a flicker, then steady. Everywhere else she has all of it on. */
  const KIT_ON = { jacket:true, gloves:true, shoes:true, bracelet:true, pack:true };
  function kitOn(p){ if(!me.kit) return; me.kit[p] = true; me.kitT[p] = 0; dress(); }
  function kitShow(){
    const t = me.kitT || {};
    const lit = p => (t[p] === undefined || t[p] > 0.75) ? 1 : (Math.random() < 0.5 ? 0.15 + t[p] : 1);
    [me.glowL, me.glowR].forEach(m=>{ if(m && m.material) m.material.opacity = 0.92*lit('gloves'); });
    (me.bangleLeds || []).forEach(m=>{ if(m.material) m.material.opacity = 0.92*lit('bracelet'); });
    if(me.jacket && me.jacket.material) me.jacket.material.emissiveIntensity = 0.35*lit('jacket');
  }

  /* -------------------------------------------------------- the phone
     Her phone, big, in front of the black: who is calling, then the call. */
  let ringT = null;
  function phoneBig(kind){
    const p = el.querySelector('#tshPhoneBig'); if(!p) return;
    if(!kind){ p.classList.remove('on', 'buzz'); return; }
    const lock = (inner) => `<div class="pb-screen"><div class="pb-top"><span>22:15</span><span>▮▮▮ 18%</span></div>${inner}</div>`;
    if(kind === 'call') p.innerHTML = lock(`<div class="pb-caller"><small>incoming call</small><b>UNKNOWN</b><span>mobile</span></div><div class="pb-btns"><i class="no">✕</i><i class="yes">✆</i></div>`);
    if(kind === 'oncall') p.innerHTML = lock(`<div class="pb-caller"><small>00:04</small><b>UNKNOWN</b><span>on call</span></div><div class="pb-btns one"><i class="no">✕</i></div>`);
    p.classList.add('on'); p.classList.toggle('buzz', kind === 'call');
  }
  function ringing(on_){
    clearInterval(ringT); ringT = null;
    if(!on_) return;
    cue('ring'); ringT = setInterval(()=>cue('ring'), 1500);
  }
  function black(v){ const b = el && el.querySelector('#tshBlack'); if(b) b.classList.toggle('on', !!v); }

  /* ------------------------------------------------------- the score
     WEB OF SILENCE (music/Web of Silence.mp3), cut to the film. The song's
     shape does the work and the film is laid over it:
       0:06.5  under the call, low and dull — the phone is louder than it;
       0:15.9  its first hit lands as the lamp comes on and the room appears;
       0:23.5  the full beat, as she gets ready;
       then down to almost nothing at her mother's note (she is only sixteen);
       2:25    the breakdown, from near silence, as the window goes up and the
               city comes in — building through the sill, the look down, the jump;
       2:33.5  the last beat before the drop, HELD while she falls, slow, until
               you press SPACE —
       2:34.4  the drop, on the BOOM of the shoes; and the rest of the song is
               the first roofs.
     Two files: wos-a.mp3 is the song from 0:06.5, wos-b.mp3 from 2:25. Every
     time below is the SONG's. The film keeps its own clock (reel.base + t)
     and the song is pulled back onto it at every cut if they drift apart. */
  const SONG = { a:{ url:'tsh/music/wos-a.mp3', from:6.5 }, b:{ url:'tsh/music/wos-b.mp3', from:145.0 },
                 hit:15.91, hold:[153.50, 154.45], drop:154.40 };
  const score = { buf:{}, loading:{}, a:null, b:null, loop:null, gain:null, lp:null, lights:9.25, jump:80 };
  function scoreLoad(k){
    const a = audio(); if(!a) return Promise.resolve(null);
    if(score.buf[k]) return Promise.resolve(score.buf[k]);
    if(!score.loading[k]) score.loading[k] = fetch(SONG[k].url + '?v=' + (window.ASSETV || '1')).then(r=>r.ok ? r.arrayBuffer() : null)
      .then(b=>b ? new Promise((ok, no)=>a.decodeAudioData(b, ok, no)) : null).then(b=>{ score.buf[k] = b; return b; }).catch(()=>null);
    return score.loading[k];
  }
  /* the one gain and filter everything goes through */
  function scoreBus(){
    const a = audio(); if(!a) return null;
    if(!score.gain){ score.lp = a.createBiquadFilter(); score.lp.type = 'lowpass'; score.lp.frequency.value = 18000;
      score.gain = a.createGain(); score.gain.gain.value = 0; score.lp.connect(score.gain); score.gain.connect(a.destination); }
    return score.lp;
  }
  /* play file k from song time `song`, now (or at audio time `when`), for `dur` seconds (or to its end), looping a span if asked */
  function scoreSrc(k, song, when, dur, loop){
    const a = audio(), buf = score.buf[k], bus = scoreBus(); if(!a || !buf || !bus) return null;
    const src = a.createBufferSource(); src.buffer = buf; src.connect(bus);
    const at = Math.max(0, song - SONG[k].from);
    if(loop){ src.loop = true; src.loopStart = loop[0] - SONG[k].from; src.loopEnd = loop[1] - SONG[k].from; }
    if(dur && !loop) src.start(when || 0, at, dur); else src.start(when || 0, at);
    return { src, k, t0:when || a.currentTime, song0:song };
  }
  function scoreKill(n, secs){ if(!n || !AC) return; try{ n.src.stop(AC.currentTime + (secs || 0)); }catch(e){} }
  function scoreLevel(v, secs, muffled){
    score.want = [v, !!muffled];
    if(!scoreBus() || !AC) return;
    score.gain.gain.setTargetAtTime(v, AC.currentTime, Math.max(0.01, (secs || 0.5)/3));
    score.lp.frequency.setTargetAtTime(muffled ? 650 : 18000, AC.currentTime, Math.max(0.01, (secs || 0.5)/3));
  }
  /* where the song should be, at this moment of the film: the first hit on the lamp */
  const filmNow = () => reel ? reel.base + reel.t : 0;
  const songAt = ft => SONG.hit + (ft - score.lights);
  function scoreStart(){
    const a = audio(); if(!a) return;
    if(a.state === 'suspended') a.resume();
    scoreBus(); scoreLoad('b');
    scoreLoad('a').then(buf=>{ if(!buf || !on || !reel || score.a || score.b) return; score.a = scoreSrc('a', songAt(filmNow())); });
  }
  /* at every cut: if the film and the song have drifted (a slow frame, a late download), the song is put back where the film is */
  function scoreSync(){
    const n = score.a; if(!n || !AC || !reel) return;
    const want = songAt(filmNow()), is = n.song0 + (AC.currentTime - n.t0);
    if(Math.abs(want - is) > 0.3){ scoreKill(n); score.a = scoreSrc('a', want); }
  }
  /* the window: the first half of the song out, the breakdown in — timed so it reaches the held beat as she jumps */
  function scoreBreak(){
    const a = audio(); if(!a) return;
    scoreLoad('b').then(buf=>{
      if(!buf || !on || score.b || score.loop) return;
      const left = Math.max(0.5, score.jump - filmNow()), from = Math.max(SONG.b.from, SONG.hold[0] - left), t = a.currentTime + 0.05;
      const old = score.a; score.a = null;
      if(old){ const g = a.createGain(); g.gain.value = 1; try{ old.src.disconnect(); old.src.connect(g); g.connect(score.lp); g.gain.setTargetAtTime(0, t, 0.08); }catch(e){} scoreKill(old, 0.6); }
      score.b = scoreSrc('b', from, t, SONG.hold[0] - from);
      score.loop = scoreSrc('b', SONG.hold[0], t + (SONG.hold[0] - from), 0, SONG.hold);
    });
  }
  /* falling: the held beat, the filter opening and the level rising while it waits for SPACE */
  function scoreHold(){
    const a = audio(); if(!a) return;
    scoreLoad('b').then(buf=>{
      if(!buf || !on || score.dropped) return;
      if(!score.loop){ scoreKill(score.a); scoreKill(score.b); score.a = score.b = null; score.loop = scoreSrc('b', SONG.hold[0], 0, 0, SONG.hold); }
      const t = a.currentTime;
      score.lp.frequency.cancelScheduledValues(t); score.lp.frequency.setValueAtTime(900, t); score.lp.frequency.exponentialRampToValueAtTime(9000, t + 5);
      score.gain.gain.cancelScheduledValues(t); score.gain.gain.setValueAtTime(Math.max(0.3, score.gain.gain.value), t); score.gain.gain.linearRampToValueAtTime(0.9, t + 5);
    });
  }
  /* BOOM: the drop, now — and the rest of the song for the first roofs */
  function scoreDrop(){
    const a = audio(); if(!a) return;
    score.dropped = true;
    scoreLoad('b').then(buf=>{
      if(!buf || !on) return;
      [score.a, score.b, score.loop].forEach(n=>scoreKill(n)); score.a = score.b = score.loop = null;
      const t = a.currentTime;
      score.lp.frequency.cancelScheduledValues(t); score.lp.frequency.setValueAtTime(18000, t);
      score.gain.gain.cancelScheduledValues(t); score.gain.gain.setValueAtTime(0.85, t); score.gain.gain.setTargetAtTime(0.55, t + 6, 3);
      score.drop = scoreSrc('b', SONG.drop);
    });
  }
  function scoreStop(secs){
    [score.a, score.b, score.loop, score.drop].forEach(n=>scoreKill(n, secs || 0));
    if(score.gain && AC) score.gain.gain.setTargetAtTime(0, AC.currentTime, Math.max(0.01, (secs || 0.3)/3));
    score.a = score.b = score.loop = score.drop = null; score.dropped = false;
  }
  const scoring = () => !!(score.a || score.b || score.loop || score.drop);

  /* --------------------------------------------------------- the reel */
  const SILL = [59.95, 9.0, 34];                     // outside: up on the rail of the fire escape under her window, over Kiln Street
  function opening(){
    const R = W.room, a = W.apt, bed = R.bed;
    const cx = (a.x1 + a.x2)/2, cz = (a.z1 + a.z2)/2;
    showInside(true); inside = true;
    G.scene.fog.density = 0.004; G.scene.background = new THREE.Color(0x020404); muffle(true);
    apt.lamp = false; apt.ceiling = false; aptLights();
    me.hood = false; me.kit = { jacket:false, gloves:false, shoes:false, bracelet:false, pack:false }; me.kitT = {};
    dress();                                            // in her base outfit: what she sleeps in
    W.aptGroup.traverse(o=>{ if(o.userData.boot || o.userData.pack) o.visible = true; });
    if(R.window) R.window.open(false);
    if(R.note) R.note.home();
    black(true);
    scoreStop(); score.dropped = false; scoreLevel(0.22, 0.4, true);
    const sitUp = ()=>stage('wake', bed.x - 0.15, bed.seat || 0.76, bed.z - 0.05, Math.PI/2);      // on the mattress, whatever height the bed's model put it at
    const shoe = R.boots.at, form = R.form.at, pack = R.pack.at, kit = R.kitchen, note = R.note, mom = R.momDoor.at, win = R.window.at;
    const P = R.packing.at, bench = R.bench.at;
    const stop = [cx + 2.4, cz + 0.9], atTable = [kit.at[0] - 0.3, kit.at[2] + 0.95];
    const J = [form[0] + 0.75, form[2] + 0.6], jry = Math.atan2(0.75, 0.6);                // into the jacket, and turned to the room
    const GL = [bench[0] + 0.85, bench[2] + 1.3], gry = Math.atan2(1, 0.55);                // the gloves, by the bench
    const BR = [shoe[0] + 0.7, shoe[2] - 0.4], bry = Math.PI/2;                              // the bracelet, by the window
    const faceTable = Math.atan2(kit.at[0] - atTable[0], kit.at[2] - atTable[1]), faceMom = Math.atan2(mom[0] - atTable[0], mom[2] - atTable[1]);
    const shots = [
      // BLACK. The phone. She answers; the buyer; she hangs up.
      { dur:9.0, fov:40, cam:[bed.x + 1.5, 1.6, bed.z - 1], look:[bed.x, 0.8, bed.z],
        enter:()=>{ sitUp(); later(()=>{ if(reel) phoneBig('call'); }, 600); ringing(true); },
        beats:[[3.2, ()=>{ ringing(false); cue('ui'); phoneBig('oncall'); scoreLevel(0.14, 0.4, true); }], [3.7, ()=>talk('call')], [8.1, ()=>{ cue('hangup'); phoneBig(null); }]] },
      // her room, slowly, as she gets up — the lamp on, the black lifting
      { dur:5.2, fov:50, cam:[[a.x2 - 0.5, 2.5, a.z2 - 0.7], [a.x2 - 1.5, 2.2, a.z2 - 1.3]], look:[[bed.x, 0.9, bed.z], [bed.x - 0.6, 0.9, bed.z - 0.4]],
        enter:()=>{ sitUp(); apt.lamp = true; aptLights(); cue('ui'); later(()=>black(false), 250); scoreLevel(0.8, 0.15, false); caption('INT. ROBIN\'S ROOM — 22:15'); } },
      // the bench: a sewing machine, circuit boards, the tools, a glove half built
      { dur:4.2, fov:42, cam:[[bench[0] + 0.9, 1.75, bench[2] + 1.75], [bench[0] - 0.9, 1.7, bench[2] + 1.65]], look:[[bench[0] + 0.4, 0.98, bench[2] - 0.05], [bench[0] - 1.3, 0.98, bench[2] - 0.05]] },
      // the sketches of clothes, and a jacket on the dress form with wiring in the seams
      { dur:3.6, fov:40, cam:[[form[0] + 2.0, 1.55, form[2] + 1.4], [form[0] + 1.5, 1.5, form[2] + 1.0]], look:[[form[0] - 0.2, 1.4, form[2] - 0.2], [form[0] - 0.3, 1.45, form[2] - 0.3]] },
      // tonight's orders: packages taped and labelled, burner phones, cash, the index cards
      { dur:4.0, fov:44, cam:[[P[0] - 1.45, 1.95, P[2] + 1.3], [P[0] - 1.35, 1.8, P[2] - 1.0]], look:[[P[0], 0.85, P[2] + 0.35], [P[0], 0.85, P[2] - 0.6]] },
      // the sneakers by the window: coils in the soles
      { dur:3.0, fov:34, cam:[[shoe[0] + 1.1, 0.42, shoe[2] - 0.7], [shoe[0] + 0.85, 0.32, shoe[2] - 0.45]], look:[shoe[0], 0.12, shoe[2]] },
      // and her, up
      { dur:3.0, fov:44, cam:[[bed.x + 1.7, 1.55, bed.z - 2.4], [bed.x + 1.4, 1.6, bed.z - 2.1]], look:[bed.x + 0.6, 1.25, bed.z - 1.0],
        enter:()=>stage('idle', bed.x + 0.6, 0, bed.z - 1.15, Math.PI) },
      // THE JACKET, off the form — the seams wake up
      { dur:3.2, fov:42, cam:[[form[0] + 1.9, 1.6, form[2] + 1.6], [form[0] + 1.6, 1.55, form[2] + 1.3]], look:[form[0] + 0.3, 1.3, form[2] + 0.3],
        enter:()=>stage('idle', J[0], 0, J[1], jry + Math.PI),
        beats:[[1.3, ()=>{ R.form.jacket.visible = false; kitOn('jacket'); cue('zip'); }]] },
      { dur:2.2, fov:34, cam:rel(J[0], J[1], jry, 0.95, 0.25, 1.4), look:rel(J[0], J[1], jry, 0, 0, 1.2),
        enter:()=>stage('idle', J[0], 0, J[1], jry), beats:[[0.3, ()=>{ me.kitT.jacket = 0; cue('gear'); }]] },
      // THE GLOVES, at the bench
      { dur:2.8, fov:34, cam:rel(GL[0], GL[1], gry, 0.95, -0.2, 1.4), look:k=>{ const h = handsAt(); return h ? [h.at.x, h.at.y, h.at.z] : rel(GL[0], GL[1], gry, 0.3, 0, 1.1); },
        enter:()=>stage('text', GL[0], 0, GL[1], gry),
        beats:[[0.9, ()=>{ kitOn('gloves'); cue('gear'); }]] },
      // THE SHOES: down on one knee by the window
      { dur:3.2, fov:38, cam:[[shoe[0] + 1.5, 0.6, shoe[2] - 1.1], [shoe[0] + 1.2, 0.5, shoe[2] - 0.8]], look:[shoe[0] + 0.2, 0.3, shoe[2]],
        enter:()=>stage('kneel', shoe[0] + 0.35, 0, shoe[2], -Math.PI/2),
        beats:[[1.5, ()=>{ kitOn('shoes'); shoesOn(); }]] },
      // THE BRACELET
      { dur:2.6, fov:30, cam:rel(BR[0], BR[1], bry, 0.75, 0.35, 1.3), look:k=>{ const h = handAt('Right'); return h ? [h.x, h.y, h.z] : rel(BR[0], BR[1], bry, 0.3, 0.15, 1.1); },
        enter:()=>stage('text', BR[0], 0, BR[1], bry),
        beats:[[0.8, ()=>{ kitOn('bracelet'); cue('gear'); later(()=>cue('pick'), 260); }]] },
      // the backpack, and the door
      { dur:3.0, fov:46, cam:[[pack[0] + 1.2, 1.5, pack[2] - 2.2], [stop[0] - 0.6, 1.55, stop[1] - 2.0]], look:k=>{ const b = AVATAR.body; return b ? [b.position.x, 1.1, b.position.z] : [pack[0], 1, pack[2]]; },
        enter:()=>{ W.aptGroup.traverse(o=>{ if(o.userData.pack) o.visible = false; }); kitOn('pack'); cue('pick'); },
        tick:(dt, t, k)=>walkStage([pack[0] - 0.2, pack[2] - 0.5], stop, Math.min(1, k*1.05)) },
      // she stops
      { dur:2.0, fov:40, cam:[stop[0] + 1.3, 1.5, stop[1] + 1.4], look:[stop[0], 1.4, stop[1]],
        enter:()=>{ stage('idle', stop[0], 0, stop[1], Math.atan2(kit.at[0] - stop[0], kit.at[2] - stop[1])); scoreLevel(0.25, 2, false); } },
      // THE KITCHEN: dinner on the table, still covered, and a note
      { dur:3.4, fov:34, cam:[[kit.at[0] + 0.9, 1.35, kit.at[2] + 1.2], [kit.at[0] + 0.55, 1.2, kit.at[2] + 0.8]], look:[kit.at[0], 0.8, kit.at[2]],
        enter:()=>{ stage('idle', atTable[0], 0, atTable[1], faceTable); scoreLevel(0.06, 2.5, true); } },
      { dur:2.6, fov:34, cam:[kit.at[0] + 0.25, 1.4, kit.at[2] - 0.35], look:[atTable[0], 1.45, atTable[1]] },
      { dur:3.0, fov:24, cam:[note.at[0] - 0.05, note.at[1] + 0.55, note.at[2] + 0.28], look:[note.at[0], note.at[1], note.at[2]], ease:false },
      // she looks toward the rest of the flat: her mother's door, dark
      { dur:2.8, fov:40, cam:[atTable[0] + 0.45, 1.65, atTable[1] + 0.8], look:[mom[0], 1.2, mom[2]],
        enter:()=>stage('idle', atTable[0], 0, atTable[1], faceMom) },
      // she picks the note up. Looks at it.
      { dur:3.6, fov:40, cam:rel(atTable[0], atTable[1], faceTable, 0.85, 0.15, 1.5), look:rel(atTable[0], atTable[1], faceTable, 0.15, 0, 1.3),
        enter:()=>stage('text', atTable[0], 0, atTable[1], faceTable),
        after:()=>{ const h = handsAt(); if(h) note.hold(h.at, h.head); } },
      // and puts it back down
      { dur:2.2, fov:32, cam:[kit.at[0] + 0.6, 1.25, kit.at[2] + 0.55], look:[note.at[0], 0.8, note.at[2]],
        enter:()=>{ note.home(); stage('idle', atTable[0], 0, atTable[1], faceTable); } },
      // THE WINDOW. The city comes in.
      { dur:3.2, fov:44, cam:[win[0] + 2.4, 1.6, win[2] - 1.2], look:[win[0], 1.5, win[2]],
        enter:()=>{ scoreBreak(); scoreLevel(0.95, 1.2, false); },
        tick:(dt, t, k)=>{ if(k < 0.45) walkStage([win[0] + 2.0, win[2] - 0.9], [win[0] + 0.75, win[2]], k/0.45); else stage('idle', win[0] + 0.75, 0, win[2], -Math.PI/2); },
        beats:[[1.7, ()=>{ R.window.open(true); cue('window'); muffle(false); }], [2.5, ()=>{ me.hood = true; dress(); cue('ui'); }]] },
      // up onto the sill
      { dur:2.4, fov:40, cam:[win[0] + 2.2, 0.6, win[2] + 0.6], look:[win[0] + 0.2, 1.6, win[2]],
        enter:()=>stage('kneel', win[0] + 0.32, 1.0, win[2], -Math.PI/2) },
      // OUTSIDE: on the sill, over Kiln Street. A look down.
      { dur:3.0, fov:42, inside:false, cam:[[55.3, 13.4, 30.8], [55.5, 13.1, 31.5]], look:[SILL[0] - 0.2, SILL[1] + 0.5, SILL[2]],
        enter:()=>{ outsideLook(); stage('idle', SILL[0], SILL[1], SILL[2], -Math.PI/2); caption('EXT. KILN STREET — 22:17'); } },
      // and a smile
      { dur:2.2, fov:36, cam:[SILL[0] - 1.7, SILL[1] + 1.65, SILL[2] + 0.45], look:[SILL[0], SILL[1] + 1.5, SILL[2]] },
      // she jumps
      { dur:0.8, fov:56, cam:[56.8, 6.6, 37.6], look:k=>{ const b = AVATAR.body; return b ? [b.position.x, b.position.y + 1, b.position.z] : SILL; },
        enter:()=>{ cue('kick'); },
        tick:(dt, t, k)=>stage('jump', SILL[0] - k*1.6, SILL[1] + Math.sin(k*Math.PI*0.6)*0.7, SILL[2], -Math.PI/2) }
    ];
    score.lights = shots[0].dur + 0.25; score.jump = shots.reduce((t, sh)=>t + sh.dur, 0);
    playReel(shots, skipped=>fallStart(skipped));
    scoreStart();
  }
  /* outside, at night: what the street mode is lit and fogged like */
  function outsideLook(){
    inside = false; showInside(false);
    G.ceiling = streetLid; G.scene.fog.density = 0.0155; G.scene.background = new THREE.Color(0x0b2a26); muffle(false);
    lightT = 0;
  }
  /* the shoes wake up: the coils whine and the soles go bright */
  function shoesOn(){
    const a = audio(); if(a){ try{ const t = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(1400, t + 0.9);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 1.2); }catch(e){} }
    W.aptGroup.traverse(o=>{ if(o.userData.boot) o.visible = false; });
  }

  /* ----------------------------------------------------------- the fall
     GAMEPLAY BEGINS in the air, off her windowsill, falling towards Kiln
     Street — slowly, until you press SPACE. Then the shoes fire: BOOM,
     straight up past the roofs, and the lesson has started. */
  function fallStart(skipped){
    staged = null; reel = null;
    ringing(false); phoneBig(null); black(false); scoreHold();
    me.kit = null; me.kitT = null; me.hood = true; dress();
    if(window.AVATAR) AVATAR.posture(null);
    outsideLook();
    if(W.room && W.room.note) W.room.note.home();
    if(S.step === 'wake') outcome('out');                      // → the lesson
    S.t = AI.AT.wake + 2;
    S.lesson = 0;
    castForBeat();
    // off the sill: out over the rail of the fire escape, falling
    const x = SILL[0] - 1.6, y = SILL[1] + 0.55, z = SILL[2];
    placePlayer(x, z, 0.35, y + EYE_);                 // facing up Kiln Street, the roofs ahead
    G.pitch = -0.2;
    kitShow();
    if(window.BOOTS && BOOTS.B){ BOOTS.sync(); Object.assign(BOOTS.B, { vx:-2, vy:1.2, vz:0, ground:false, state:'air', airT:0.2, cut:true }); }
    lessonBegin(true);
    lockPointer($('#view'));
  }
  /* the fall is slow until she fires the shoes (BOOTS asks, every frame) */
  function slowFall(){ return S.step === 'lesson' && lessonId() === 'fire' && window.BOOTS && BOOTS.B && !BOOTS.B.ground ? 0.22 : 1; }
  function fireShoes(){
    if(!window.BOOTS || !BOOTS.B) return;
    BOOTS.fire();
    scoreDrop();
    LOOK.fx.flash = Math.max(LOOK.fx.flash || 0, 0.6);
    title();
    lessonNext();
  }

  /* ---------------------------------------------------------- the lesson
     THE SHOES, ONE THING AT A TIME, on the way to the deal. Each step is
     finished by doing it — not by reading it — and the shoes do the work:
       1 fire                     SPACE, falling: the shoes go off
       2 hold                     hold SPACE: roof to roof on their own
       3 keep holding             three roofs in a row
       4 point                    pick the roof: north, over the avenue
       5 the rhythm               tap SPACE as she lands, in the gold
       6 Dragon Alley             let go over it and drop in
     ENTER on a step (or P, Skip) moves past it for anybody who already
     knows. The rest — the dive, the pull-up, the wall kick, the dash — are
     switched on at the end, for the roofs after the deal. */
  const LESSON = [
    { id:'fire',   title:'THE SHOES', how:'SPACE — fire them.' },
    { id:'bound',  title:'HOLD SPACE', how:'Hold SPACE. The shoes pick the roof you are facing — the ring — and take you there.', teach:['bound','jump','steer'] },
    { id:'chain',  title:'KEEP HOLDING', how:'Keep it held: every landing springs into the next. Three roofs in a row.' },
    { id:'steer',  title:'POINT', how:'Look where you want to go — the mouse, or A and D, even in the air. North, over Neon Avenue.' },
    { id:'rhythm', title:'THE RHYTHM', how:'Tap SPACE as her feet touch, when the ring goes gold. Perfect bounds go quicker and further. Two in a row.' },
    { id:'alley',  title:'DRAGON ALLEY', how:'The buyer is in Dragon Alley. Let go of SPACE over it and drop in.' }
  ];
  const lesson = { i:0, perfect:0, lands:0, touched:false, goal:null };
  const lessonId = () => (LESSON[lesson.i] || {}).id;
  function lessonBegin(first){
    if(!S.lesson) S.lesson = 0;
    // a night picked up on a roof has nothing to fall from
    if(LESSON[S.lesson] && LESSON[S.lesson].id === 'fire' && !(window.BOOTS && BOOTS.B && !BOOTS.B.ground)) S.lesson = 1;
    lesson.i = S.lesson; lesson.perfect = 0; lesson.lands = 0;
    const have = new Set(S.boots || []);
    LESSON.slice(0, lesson.i + 1).forEach(l=>(l.teach||[]).forEach(t=>have.add(t)));
    if(window.BOOTS && BOOTS.B) BOOTS.teach([...have]);
    S.boots = [...have];
    lessonShow(first);
    if(first && lessonId() !== 'fire') later(()=>{ if(on) checkpoint(); }, 600);
  }
  function lessonShow(big){
    const L = LESSON[lesson.i]; if(!L) return;
    if(L.id === 'steer') lesson.goal = northRoof();
    setObjective(L.title, [L.how, 'ENTER — skip this step']);
    const c = el.querySelector('#tshLesson');
    c.innerHTML = `<small>THE SHOES · ${lesson.i + 1} / ${LESSON.length}</small><b>${esc(L.title)}</b><p>${esc(L.how)}</p>`;
    c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
    c.classList.toggle('big', L.id === 'fire');
    if(big) cue('win');
  }
  function lessonNext(){
    const L = LESSON[lesson.i]; if(!L) return;
    if(L.id !== 'fire'){ cue('win'); note('✓ ' + L.title, 'big'); }
    lesson.i++; S.lesson = lesson.i; lesson.perfect = 0; lesson.lands = 0;
    const N = LESSON[lesson.i];
    if(!N){ lessonDone(); return; }
    (N.teach||[]).forEach(t=>{ if(window.BOOTS) BOOTS.learn(t); });
    S.boots = window.BOOTS && BOOTS.B ? [...BOOTS.B.have] : S.boots;
    save();
    if(L.id === 'fire') lessonShow(false);
    else later(()=>{ if(on && S.step === 'lesson') lessonShow(true); }, 900);
  }
  function lessonDone(){
    el.querySelector('#tshLesson').classList.remove('on');
    if(window.BOOTS) BOOTS.TECH.early.concat(BOOTS.TECH.mid).forEach(t=>BOOTS.learn(t));
    S.boots = window.BOOTS && BOOTS.B ? [...BOOTS.B.have] : S.boots;
    mark('lesson');
    outcome('done');                              // → the deal
    note(lesson.touched ? '👟 The shoes do more: SHIFT in the air dives · SPACE out of a dive pulls up · SPACE at a wall kicks off it.'
                        : 'Not one foot on the street. 👟 And there is more: SHIFT dives · SPACE out of a dive pulls up · SPACE at a wall kicks off.', 'big');
  }
  function lessonSkip(){ if(S.step !== 'lesson') return; if(lessonId() === 'fire') fireShoes(); else lessonNext(); }
  /* the nearest roof across Neon Avenue, for the POINT step's marker */
  function northRoof(){
    let best = null, bd = Infinity;
    W.roofs.forEach(r=>{ if(r.z2 > -9 || r.h > 22 || r.x2 - r.x1 > 30) return; const x = (r.x1 + r.x2)/2, z = (r.z1 + r.z2)/2, d = Math.hypot(x - G.pos.x, z - G.pos.z); if(d < bd){ bd = d; best = [x, z, r.h]; } });
    return best;
  }
  /* what the shoes did, against the step you are on */
  function lessonEvent(e, b){
    if(S.step !== 'lesson') return;
    const id = lessonId(); if(!id) return;
    const landed = e.name === 'boundLand' || ((e.name === 'land' || e.name === 'roll') && b.fromBound);
    if(id === 'bound' && landed && b.y > 3) return lessonNext();
    if(id === 'chain' && e.name === 'boundLand' && e.hops >= 3) return lessonNext();
    if(id === 'steer' && (landed || e.name === 'land' || e.name === 'roll') && b.y > 3 && b.z < -9) return lessonNext();
    if(id === 'rhythm'){
      if(e.name === 'boundPerfect' && ++lesson.perfect >= 2) return lessonNext();
      if(e.name === 'boundLand' && !e.perfect && ++lesson.lands % 4 === 0) note('Watch the ring — the moment it goes gold, tap SPACE.', 'warn');
    }
  }
  function lessonTick(){
    if(S.step !== 'lesson' || !window.BOOTS || !BOOTS.B || mode) return;
    const b = BOOTS.B, L = LESSON[lesson.i]; if(!L) return;
    if(b.ground && b.y < 0.6) lesson.touched = true;
    if(L.id === 'alley'){ const a = W.zones.alley; if(G.pos.x > a.x1 && G.pos.x < a.x2 && G.pos.z > a.z1 && G.pos.z < a.z2) return lessonNext(); }
  }
  function lessonMarker(){
    const L = LESSON[lesson.i]; if(!L) return null;
    if(L.id === 'steer' && lesson.goal) return [lesson.goal[0], lesson.goal[1], lesson.goal[2] + 2, 'Over the avenue'];
    if(L.id === 'alley'){ const s = W.spots.kai; return [s[0], s[1], 2.2, 'Dragon Alley']; }
    return null;
  }

  /* ----------------------------------------------------------- the shoes
     On whenever she is outside and the night is hers to play; off in the
     flat (the ceiling is three metres up) and during films and scenes. */
  function bootsOn(){
    if(!window.BOOTS) return;
    const E = CITY.EDGE;
    BOOTS.attach({
      env:{ solids:G.solids, ground:groundAt, bounds:{ x1:-E.x + 1.5, x2:E.x - 1.5, z1:-E.z + 1.5, z2:E.z - 1.5 },
            roofs:W.roofs.map(r=>({ id:r.id, x1:r.x1, x2:r.x2, z1:r.z1, z2:r.z2, top:r.h })) },
      have:S.boots && S.boots.length ? S.boots : BOOTS.ALL.filter(t=>BOOTS.TECH.late.indexOf(t) < 0),
      hooks:{
        audio:()=>audio(),
        enabled:()=>!inside,
        slow:()=>slowFall(),
        event:(e, b)=>bootEvent(e, b),
        learned:t=>{ S.boots = [...BOOTS.B.have]; save(); if(BOOTS.TECH.late.includes(t)) note('★ New technique: ' + ({ chain:'CHAIN — every kick and pull in a row hits harder', slide:'SLIDE — hold SHIFT into a fast landing and keep the speed' })[t], 'big'); }
      }
    });
  }
  function bootEvent(e, b){
    // the shoes are illegal wearables: WFC that sees one used has something to say about it
    if(['bound', 'boundPerfect', 'jump', 'jumpPerfect', 'rebound', 'reboundPerfect', 'pull', 'pullPerfect', 'dash'].includes(e.name)) gearSeen('boots');
    // the late techniques are learned by doing
    if(b.flow >= 0.6) BOOTS.learn('chain');
    if(e.name === 'roll' && Math.hypot(b.vx, b.vz) > 18) BOOTS.learn('slide');
    lessonEvent(e, b);
  }

  /* ------------------------------------------------------------- hiding */
  let hidAt = null;
  function hide(x, z){
    if(mode) return;
    mode = 'hide'; G.running = false; me.hidden = true; hidAt = [x, z, G.pos.x, G.pos.z];
    if(window.AVATAR && AVATAR.body) AVATAR.body.visible = false;
    cue('door'); note('🗑 Hidden. Nobody can see you in here. E to climb out.');
  }
  function unhide(){
    if(mode !== 'hide') return;
    mode = null; me.hidden = false; G.running = true;
    if(window.AVATAR && AVATAR.body) AVATAR.body.visible = true;
    cue('door');
  }
  function tickHide(){
    // the camera sits over the lid and looks about
    const [x, z] = hidAt;
    G.camera.position.lerp(V(x + Math.sin(G.yaw)*3.5, 2.6, z + Math.cos(G.yaw)*3.5), 0.1);
    G.camera.lookAt(x, 1.2, z);
    if(G.keys.ArrowLeft) G.yaw += 0.03; if(G.keys.ArrowRight) G.yaw -= 0.03;
  }

  /* ------------------------------------------------------------ scooters
     Fast, loud, and somebody's. Taking one in front of anybody is theft;
     nobody chases a scooter nobody saw go. */
  const rideS = { sc:null, spd:0, mesh:null };
  function scooterMesh(){
    const g = new THREE.Group(), m = CITY.M;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 1.2), m.darkMetal); deck.position.y = 0.18; g.add(deck);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1), m.metal); post.position.set(0, 0.72, 0.52); post.rotation.x = -0.18; g.add(post);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55), m.metal); bar.rotation.z = Math.PI/2; bar.position.set(0, 1.25, 0.62); g.add(bar);
    [-0.5, 0.5].forEach(z=>{ const w = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 14), m.tyre); w.rotation.z = Math.PI/2; w.position.set(0, 0.11, z); g.add(w); });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.03), m.bulb); lamp.position.set(0, 1.1, 0.66); g.add(lamp);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 1.1), m.teal); strip.position.y = 0.14; g.add(strip);
    return g;
  }
  function placeScooters(){
    W.scooters.forEach(sc=>{ sc.mesh = scooterMesh(); sc.mesh.position.set(sc.x, 0.15, sc.z); sc.mesh.rotation.y = sc.ry; W.cityGroup.add(sc.mesh); });
  }
  function ride(sc){
    if(mode) return;
    mode = 'ride'; G.running = false; rideS.sc = sc; rideS.spd = 0; sc.gone = true; rideS.mesh = sc.mesh;
    G.yaw = sc.ry + Math.PI;
    if(window.AVATAR) AVATAR.posture('ride');
    crime('theft', sc.x, sc.z);
    note('🛴 W to go, A/D to steer, E to get off.');
  }
  function unride(){
    if(mode !== 'ride') return;
    mode = null; G.running = true; if(window.AVATAR) AVATAR.posture(null);
    const sc = rideS.sc; sc.x = G.pos.x + Math.cos(G.yaw)*0.8; sc.z = G.pos.z - Math.sin(G.yaw)*0.8; sc.ry = G.yaw + Math.PI; sc.gone = false;
    rideS.mesh.position.set(sc.x, groundAt(sc.x, sc.z, 1), sc.z); rideS.mesh.rotation.y = sc.ry;
    if(sc.thing){ sc.thing.x = sc.x; sc.thing.z = sc.z; }            // its E goes where it was left
    rideS.sc = null;
  }
  function tickRide(dt){
    const k = G.keys;
    const want = (k.KeyW||k.ArrowUp ? 15 : 0) - (k.KeyS||k.ArrowDown ? 4 : 0);
    rideS.spd += (want - rideS.spd)*Math.min(1, dt*(want > rideS.spd ? 1.6 : 3));
    const turn = ((k.KeyA||k.ArrowLeft) ? 1 : 0) - ((k.KeyD||k.ArrowRight) ? 1 : 0);
    G.yaw += turn*dt*(1.2 + Math.min(1, Math.abs(rideS.spd)/8)*0.9);
    const dx = -Math.sin(G.yaw)*rideS.spd*dt, dz = -Math.cos(G.yaw)*rideS.spd*dt;
    const f = feet(), nx = G.pos.x + dx, nz = G.pos.z + dz;
    const hit = G.solids.concat(dyn).some(s=>!s.off && f+1 > s.y1 && f < s.y2-0.3 && nx+0.5 > s.x1 && nx-0.5 < s.x2 && nz+0.5 > s.z1 && nz-0.5 < s.z2);
    if(hit){ rideS.spd *= -0.3; cue('kick'); } else { G.pos.x = nx; G.pos.z = nz; }
    const gy = groundAt(G.pos.x, G.pos.z, f);
    G.pos.y = gy + EYE_;
    rideS.mesh.position.set(G.pos.x, gy + 0.02, G.pos.z); rideS.mesh.rotation.y = G.yaw + Math.PI;
    if(window.AVATAR){ AVATAR.update(dt, false, false, true); if(AVATAR.body) AVATAR.body.position.y = gy + 0.2; }
    if(typeof thirdPerson === 'function') thirdPerson();
  }

  /* --------------------------------------------------------- the metro
     Two stations. The gate camera logs faces, and at two stars the gates
     do not open for anybody who looks like YU. */
  function metro(from, to){
    if(mode) return;
    if(S.heat >= 2){ note('🚇 The gates are locked down. WFC is looking for you.', 'bad'); cue('fail'); return; }
    if(!me.hood){ expose(8, 'a metro gate camera logged your face'); }
    fade(()=>{
      const s = W.spots['metro_'+to];
      placePlayer(s[0], s[1] + 1.5, to==='west' ? Math.PI : 0);
      S.t += 4;
      note('🚇 ' + (to==='west' ? 'Neon West' : 'Harbor Lane') + ' — four minutes later.');
    });
  }

  /* ------------------------------------------------------------ gadgets
     F: THE FLASH BANGLES. Clap, and everybody facing you inside nine
     metres is blind for four seconds — Kai, WFC, anybody. It is also the
     loudest thing you can do on a street: everybody who sees it from
     further away has seen a crime.
     J: THE JAMMER. Six seconds of noise: phones stop uploading, drones
     lose their picture, scanner arches go deaf — and anything in your
     own bag that is transmitting shows up.
     Q: A CAN. Thrown, it lands and rattles, and whoever hears it goes to
     look. */
  const gad = { flashCd:0, jam:0, jamCd:0, recharge:0 };
  function flash(){
    if(gad.flashCd > 0 || mode === 'hide' || mode === 'cut' || mode === 'end') return false;
    if(S.flash <= 0){ note('✋ The bangles are empty. They charge back slowly.', 'warn'); cue('fail'); return false; }
    S.flash--; gad.flashCd = 1.0; gad.recharge = 0;
    cue('flash');
    LOOK.fx.flash = 1.0; flashDom();
    const p = P(), c = V(p.x, p.y + 1.2, p.z);
    for(let i=0;i<22;i++) particle(c, { color:0xe8fff8, size:0.06, life:0.5, v:V((Math.random()-0.5)*9, (Math.random()-0.2)*5, (Math.random()-0.5)*9) });
    const hit = npcs.filter(n=>{
      if(n.kind === 'drone'){ return Math.hypot(n.x - p.x, n.z - p.z) < 10; }
      const d = Math.hypot(n.x - p.x, n.z - p.z); if(d > 9 || Math.abs(n.y - p.y) > 3) return false;
      return los(n.x, n.y+1.6, n.z, p.x, p.y+1.2, p.z);
    });
    hit.forEach(n=>stun(n, n.kind==='drone' ? 5 : 4));
    crime('flash', p.x, p.z, hit);
    questEvent('flash', { hit });
    hud();
    return true;
  }
  function jam(){
    if(gad.jamCd > 0 || mode === 'cut' || mode === 'end'){ if(gad.jamCd > 0) note('📡 Jammer recharging…', 'warn'); return; }
    gad.jam = 6; gad.jamCd = 30;
    cue('jam');
    const p = P();
    ring(V(p.x, p.y + 0.1, p.z), 12, 0x8a6aff);
    npcs.forEach(n=>{
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if(n.kind === 'drone' && d < 16){ n.static = 6; n.scan = 0; }
      if(n.film && d < 13){ n.film = null; bark(n, '📵'); }
    });
    if(S.trail.tracker === 'on'){
      S.flags.trackerJam = 60;
      if(!S.trail.trackerFound){ S.trail.trackerFound = true; note('📡 Something in your bag is transmitting. The envelope.', 'big'); cue('alert'); }
    }
    questEvent('jam');
    hud();
  }
  function throwCan(){
    if(!S.can || mode) return;
    S.can = false;
    const p = P(), dir = V(-Math.sin(G.yaw), 0, -Math.cos(G.yaw));
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), CITY.M.metal);
    const from = V(p.x, p.y + 1.5, p.z), to = V(p.x + dir.x*13, 0, p.z + dir.z*13);
    // it stops where it hits a wall
    for(let k=1;k<=13;k++){ const x = p.x + dir.x*k, z = p.z + dir.z*k; if(G.solids.some(s=>!s.off && s.y2 > 1 && x > s.x1 && x < s.x2 && z > s.z1 && z < s.z2)){ to.set(p.x + dir.x*(k-1), 0, p.z + dir.z*(k-1)); break; } }
    to.y = groundAt(to.x, to.z, p.y + 1) + 0.06;
    root.add(m);
    tween(0.7, k=>{ m.position.set(lerp(from.x, to.x, k), lerp(from.y, to.y, k) + Math.sin(k*Math.PI)*2.2, lerp(from.z, to.z, k)); m.rotation.x = k*12; },
      ()=>{ cue('kick'); noise(to.x, to.z, 13, 'can'); setTimeout(()=>{ if(m.parent) m.parent.remove(m); }, 6000); });
    hud();
  }
  function tickGadgets(dt){
    gad.flashCd = Math.max(0, gad.flashCd - dt);
    gad.jam = Math.max(0, gad.jam - dt); gad.jamCd = Math.max(0, gad.jamCd - dt);
    if(S.flags.trackerJam) S.flags.trackerJam = Math.max(0, S.flags.trackerJam - dt);
    if(S.flash < 3){ gad.recharge += dt; if(gad.recharge >= 45){ gad.recharge = 0; S.flash++; note('✋ A flash charge is back.'); hud(); } }
    // the bangles glow with their charge
    const k = S.flash/3, pulse = 0.6 + 0.4*Math.sin(clock*4);
    [me.glowL, me.glowR].forEach(m=>{ if(m){ m.visible = S.flash > 0; m.material.opacity = 0.35 + 0.55*k*pulse; } });
  }

  /* --------------------------------------------------------- the flash
     on screen: a white-out that the eye lets go of over half a second */
  function flashDom(){ const f = el && el.querySelector('.tsh-flash'); if(!f) return; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  let fadeBusy = false;
  function fade(mid, then){
    if(fadeBusy) return; fadeBusy = true;
    const f = el.querySelector('.tsh-fade'); f.classList.add('on');
    const r = run;                         // not later(): a fade has to let go of the screen whatever happens
    setTimeout(()=>{ if(!on || run !== r){ fadeBusy = false; f.classList.remove('on'); return; } try{ mid && mid(); }catch(e){ console.warn(e); }
      setTimeout(()=>{ f.classList.remove('on'); fadeBusy = false; then && then(); }, 120); }, 420);
  }

  /* ------------------------------------------------------ motion & sparks */
  let tweens = [], fx = [];
  function tween(d, f, done){ const t = { t:0, d, f, done }; tweens.push(t); f(0); return t; }
  const pGeo = new THREE.SphereGeometry(1, 6, 4);
  function particle(pos, o){
    const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color:new THREE.Color(o.color).multiplyScalar(o.k||2.5), transparent:true, opacity:o.op||1, depthWrite:false }));
    m.position.copy(pos); m.scale.setScalar(o.size||0.05); root.add(m);
    fx.push({ m, v:o.v || V(0,0,0), life:o.life||1, max:o.life||1, grav:o.grav||0, grow:o.grow||0, op:o.op||1, size:o.size||0.05 });
  }
  function ring(pos, r, col){
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color:new THREE.Color(col).multiplyScalar(3), transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false }));
    m.rotation.x = -Math.PI/2; m.position.copy(pos); root.add(m);
    tween(0.7, k=>{ m.scale.setScalar(0.5 + k*r); m.material.opacity = 0.9*(1-k); }, ()=>{ root && root.remove(m); m.geometry.dispose(); m.material.dispose(); });
  }
  function tickMotion(dt){
    const run = tweens; tweens = [];
    const keep = run.filter(t=>{ t.t += dt/t.d; const k = Math.min(1, t.t); t.f(k); if(k >= 1){ if(t.done) t.done(); return false; } return true; });
    tweens = keep.concat(tweens);
    fx = fx.filter(p=>{ p.life -= dt; p.v.y -= p.grav*dt; p.m.position.addScaledVector(p.v, dt);
      if(p.grow) p.m.scale.setScalar(p.size + (p.max-p.life)*p.grow);
      p.m.material.opacity = p.op*Math.min(1, p.life/p.max*1.5);
      if(p.life <= 0){ if(p.m.parent) p.m.parent.remove(p.m); p.m.material.dispose(); return false; } return true; });
  }
  /* steam from the vents, rising and spreading in the tube light */
  let steamT = 0;
  function tickSteam(dt){
    steamT -= dt; if(steamT > 0 || inside) return; steamT = 0.18;
    W.vents.forEach(v=>{ if(Math.hypot(v[0]-G.pos.x, v[2]-G.pos.z) > 45) return;
      particle(V(v[0] + (Math.random()-0.5)*0.4, v[1], v[2] + (Math.random()-0.5)*0.4), { color:0x9ab8b0, k:0.35, op:0.22, size:0.18, grow:0.9, life:2.6, v:V((Math.random()-0.5)*0.2, 0.6, (Math.random()-0.5)*0.2) }); });
  }
  /* rain: streaks in a box that follows the camera */
  let rain = null;
  function makeRain(){
    const n = 2400, pos = new Float32Array(n*6);
    for(let i=0;i<n;i++){ const x = (Math.random()-0.5)*60, y = Math.random()*24, z = (Math.random()-0.5)*60;
      pos.set([x, y, z, x+0.02, y+0.45, z+0.01], i*6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.LineBasicMaterial({ color:new THREE.Color(0.5, 0.75, 0.72), transparent:true, opacity:0.32, depthWrite:false });
    rain = new THREE.LineSegments(g, m); rain.frustumCulled = false; rain.userData.flat = true; W.cityGroup.add(rain);
    LOOK.hideInMirror.push(rain);
  }
  function tickRain(dt){
    if(!rain) return;
    rain.position.set(G.camera.position.x, 0, G.camera.position.z);
    const A = rain.geometry.attributes.position.array;
    for(let i=0;i<A.length;i+=6){ A[i+1] -= 18*dt; A[i+4] -= 18*dt; if(A[i+1] < 0){ A[i+1] += 24; A[i+4] += 24; } }
    rain.geometry.attributes.position.needsUpdate = true;
  }

  /* ================================================ people and machines
     Everybody who is not you. Each one has a body (a rigged character out
     of AVATAR, or a drone built here), a place, a heading, a state, and —
     if they can notice things — eyes and an awareness from 0 to 1.

     NOBODY IS TOLD WHAT YOU DID. A crime is an event at a place; what
     happens next depends on who could see that place (crime() below). A
     flash in an empty alley is nothing. The same flash in front of a
     noodle stand is six phones in the air. */
  let npcs = [];
  const KIND = {
    civ:    { walk:1.25, run:4.4, eye:{ range:17, fov:1.05, near:2.5, gain:1.0 } },
    wfc:    { walk:1.35, run:5.7, eye:{ range:24, fov:0.95, near:3.5, gain:1.3 } },
    kai:    { walk:1.45, run:6.4, eye:{ range:22, fov:1.0, near:3.5, gain:1.4 } },
    maya:   { walk:1.1,  run:4.0, eye:{ range:14, fov:1.2, near:4.0, gain:1.2 } },
    vendor: { walk:1.1,  run:5.3, eye:{ range:10, fov:1.0, near:2.0, gain:0.6 } }
  };
  function spawn(kind, char, x, z, o){
    o = o||{};
    const g = new THREE.Group(); (o.inApt ? W.aptGroup : W.cityGroup).add(g);
    const y = o.y !== undefined ? o.y : groundAt(x, z, 1);
    const n = { kind, char, g, model:null, x, y, z, yaw:o.yaw||0, state:o.state||'idle', aware:0, band:'unaware', sees:false,
                lastSeen:null, stun:0, path:null, pi:0, goal:null, route:o.route||null, ri:0, wait:0, film:null, flee:0,
                inApt:!!o.inApt, name:o.name||kind, clip:null, barkT:0, repath:0, moving:false, running:false, climb:null,
                def:KIND[kind], perT:Math.random()*0.1, t:0, hat:o.hat, uniform:kind==='wfc', gone:false, tag:o.tag };
    g.position.set(x, y, z); g.rotation.y = n.yaw;
    if(window.AVATAR) AVATAR.load(char).then(m=>{
      if(n.gone || !g.parent) return;
      n.model = m; g.add(m);
      if(n.uniform) uniform(m);
      if(o.phone) phoneProp(n);
    }).catch(()=>{});
    npcs.push(n);
    return n;
  }
  /* WFC's people wear the same thing: navy armour, a helmet, a lit visor.
     The body underneath is a passer-by's; the uniform is what you see. */
  function uniform(m){
    m.traverse(o=>{ if(o.isMesh){ o.material = o.material.clone(); o.material.map = null; o.material.vertexColors = false;
      o.material.color = new THREE.Color(0x1b2536); o.material.roughness = 0.45; o.material.metalness = 0.35; o.material.needsUpdate = true; } });
    const head = boneOf(m, /Head$/);
    if(head){
      m.updateMatrixWorld(true);
      const k = worldK(head), h = new THREE.Group(); h.scale.setScalar(k); head.add(h);
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI*2, 0, Math.PI*0.62), new THREE.MeshStandardMaterial({ color:0x121a26, roughness:0.3, metalness:0.6 }));
      helm.position.set(0, 0.1, 0); h.add(helm);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.05), new THREE.MeshBasicMaterial({ color:new THREE.Color(0.5, 2.6, 2.8) }));
      visor.position.set(0, 0.085, 0.115); h.add(visor);
    }
  }
  function phoneProp(n){
    const hand = n.model && boneOf(n.model, /RightHand$/); if(!hand) return;
    const k = worldK(hand), p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.01), new THREE.MeshBasicMaterial({ color:new THREE.Color(1.5, 2.2, 2.6) }));
    p.scale.setScalar(k); p.position.set(0, 0.1*k, 0.04*k); p.visible = false; hand.add(p); n.phone = p;
  }
  function despawn(n){ n.gone = true; if(n.g.parent) n.g.parent.remove(n.g); npcs = npcs.filter(x=>x!==n); if(n.mark){ n.mark.remove(); n.mark = null; } }
  function clearNpcs(){ npcs.slice().forEach(despawn); npcs = []; drones.length = 0; trucks.length = 0; }
  const find = name => npcs.find(n=>n.name===name);

  /* ------------------------------------------------------------- moving
     Straight at the target when nothing is in the way, along the graph
     when something is; sliding along walls; stopping at roof edges; and
     climbing ladders the graph says are there. */
  function blockedAt(n, x, z){
    const r = 0.35;
    for(const s of G.solids){ if(s.off) continue; if(n.y+1.5 < s.y1 || n.y > s.y2-0.5) continue;
      if(x+r > s.x1 && x-r < s.x2 && z+r > s.z1 && z-r < s.z2) return true; }
    for(const s of dyn){ if(x+r > s.x1 && x-r < s.x2 && z+r > s.z1 && z-r < s.z2) return true; }
    const gy = groundAt(x, z, n.y + 0.5);
    if(gy < n.y - 0.6 && !n.canDrop) return true;                 // an edge
    return false;
  }
  function stepTo(n, tx, tz, spd, dt){
    const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
    if(d < 0.05) return true;
    const s = Math.min(d, spd*dt), ux = dx/d, uz = dz/d;
    let moved = false;
    if(!blockedAt(n, n.x + ux*s, n.z + uz*s)){ n.x += ux*s; n.z += uz*s; moved = true; }
    else if(!blockedAt(n, n.x + ux*s, n.z)){ n.x += ux*s; moved = true; }
    else if(!blockedAt(n, n.x, n.z + uz*s)){ n.z += uz*s; moved = true; }
    if(moved){ n.y = groundAt(n.x, n.z, n.y + 0.5); n.stuck = 0; }
    else n.stuck = (n.stuck||0) + dt;
    const want = Math.atan2(ux, uz); n.yaw += angDiff(want, n.yaw)*Math.min(1, dt*8);
    n.moving = moved; n.running = spd > n.def.walk*1.6;
    return d < 0.5;
  }
  function clearWay(n, tx, ty, tz){
    if(Math.abs(ty - n.y) > 0.7) return false;
    for(const s of G.solids){ if(s.off || s.y2 < n.y + 0.5 || s.y1 > n.y + 1.2) continue;
      if(segT(n.x, n.z, tx, tz, s.x1-0.3, s.x2+0.3, s.z1-0.3, s.z2+0.3)) return false; }
    // and no edge to walk off on the way
    if(n.y > 1){ const k = 6; for(let i=1;i<=k;i++){ const x = lerp(n.x, tx, i/k), z = lerp(n.z, tz, i/k); if(groundAt(x, z, n.y+0.5) < n.y - 0.6) return false; } }
    return true;
  }
  function goTo(n, x, z, y, spd, dt){
    if(n.climb) return tickNpcClimb(n, dt);
    y = y === undefined ? groundAt(x, z, 100) : y;
    if(clearWay(n, x, y, z)){ n.path = null; return stepTo(n, x, z, spd, dt); }
    n.repath -= dt;
    if(!n.path || n.repath <= 0 || (n.goal && Math.hypot(n.goal[0]-x, n.goal[1]-z) > 3)){
      n.repath = 1.2; n.goal = [x, z, y];
      const nodes = W.nav.nodes;
      const a = AI.nearest(nodes, n.x, n.z, n.y, 1.2), b = AI.nearest(nodes, x, z, y, 1.2);
      n.path = AI.astar(nodes, a, b); n.pi = 0;
      if(!n.path){ return stepTo(n, x, z, spd, dt); }
    }
    const nodes = W.nav.nodes;
    if(n.pi >= n.path.length) return stepTo(n, x, z, spd, dt);
    const cur = nodes[n.path[n.pi]], nxt = n.path[n.pi+1] !== undefined ? nodes[n.path[n.pi+1]] : null;
    if(stepTo(n, cur.x, cur.z, spd, dt) || Math.hypot(cur.x-n.x, cur.z-n.z) < 0.7){
      // a ladder between this node and the next: climb it
      if(nxt && cur.ladder && nxt.ladder === cur.ladder && Math.abs(nxt.y - cur.y) > 1){
        const l = cur.ladder;
        n.climb = { t:0, dur:0.6 + Math.abs(nxt.y-cur.y)*0.18, x0:cur.x, z0:cur.z, y0:cur.y, x1:nxt.x, z1:nxt.z, y1:nxt.y, lx:l.x + l.nx*0.45, lz:l.z + l.nz*0.45 };
      }
      n.pi++;
    }
    if(n.stuck > 1.5){ n.stuck = 0; n.repath = 0; n.pi++; }
    return false;
  }
  function tickNpcClimb(n, dt){
    const c = n.climb; c.t += dt/c.dur; const k = Math.min(1, c.t);
    if(k < 0.15){ const q = k/0.15; n.x = lerp(c.x0, c.lx, q); n.z = lerp(c.z0, c.lz, q); n.y = c.y0; }
    else if(k < 0.85){ n.x = c.lx; n.z = c.lz; n.y = lerp(c.y0, c.y1, (k-0.15)/0.7); }
    else { const q = (k-0.85)/0.15; n.x = lerp(c.lx, c.x1, q); n.z = lerp(c.lz, c.z1, q); n.y = c.y1; }
    n.moving = true; n.running = false;
    if(k >= 1) n.climb = null;
    return false;
  }
  function face(n, x, z, dt){ const want = angTo(n.x, n.z, x, z); n.yaw += angDiff(want, n.yaw)*Math.min(1, (dt||0.1)*6); }

  /* ------------------------------------------------------------ the eyes */
  function crowdAround(x, z){ let c = 0; for(const n of npcs) if(n.kind==='civ' && Math.hypot(n.x-x, n.z-z) < 2.6) c++; return c; }
  function canSee(n, x, y, z){
    return los(n.x, n.y + 1.65, n.z, x, y + 1.3, z) || los(n.x, n.y + 1.65, n.z, x, y + 1.75, z);
  }
  function interest(n){
    if(n.kind === 'wfc'){ if(n.state === 'raid' || n.state === 'escort') return 0.2; return S.heat > 0 ? 1.0 : (me.hood && !inside ? 0.28 : 0); }
    if(n.kind === 'kai') return ({ wait:1, search:1.3, stakeout:1.1, hunt:1.35, pursue:1, tail:0.7, walk:0.5, rob:0.45, apt:1.2 })[n.state] || 0;
    if(n.kind === 'maya') return n.state === 'talk' ? 1 : 0;
    return 0;
  }
  function perceive(n, dt){
    if(n.kind === 'civ' && !n.film) { n.sees = false; return; }
    if(n.stun > 0 || n.climb){ n.sees = false; n.aware = Math.max(0, n.aware - 0.2*dt); return; }
    const p = P();
    if(me.hidden || mode === 'talk' || inside !== n.inApt){ n.sees = false; decay(n, dt); return; }
    const light = lightAt(p.x, p.y + 1, p.z) * (crowdAround(p.x, p.z) >= 3 ? 0.45 : 1);
    // in the dark you are a shape at arm's length and nothing further off
    const vis = canSee(n, p.x, p.y, p.z) && !(light < 0.12 && Math.hypot(p.x - n.x, p.z - n.z) > 2.6);
    const rate = AI.perceive({ x:n.x, y:n.y, z:n.z, yaw:n.yaw, range:n.def.eye.range*(n.kind==='kai' && n.state==='stakeout' ? 1.7 : 1), fov:n.def.eye.fov, near:n.def.eye.near, gain:n.def.eye.gain },
                             { x:p.x, y:p.y, z:p.z, running:p.running, moving:p.moving }, light, vis);
    n.sees = rate > 0;
    const want = interest(n);
    if(n.sees){
      n.lastSeen = [p.x, p.z, p.y, clock];
      const cap = (n.kind === 'wfc' && S.heat === 0) ? 0.6 : 1.2;
      n.aware = Math.min(cap, n.aware + rate*want*dt*1.7);
    } else decay(n, dt);
    const b = AI.band(n.aware);
    if(b !== n.band){ const was = n.band; n.band = b; onBand(n, b, was); }
  }
  function decay(n, dt){
    if(!n.lastSeen || clock - n.lastSeen[3] > 2.5) n.aware = Math.max(0, n.aware - 0.11*dt);
    const b = AI.band(n.aware); if(b !== n.band){ const was = n.band; n.band = b; onBand(n, b, was); }
  }
  function onBand(n, b, was){
    if(b === 'suspicious' && was === 'unaware'){ cue('sus');
      if(n.kind === 'wfc' && S.heat === 0 && !n.saidHood){ n.saidHood = true; bark(n, pick(['Hood down, kid.', 'Evening. Where you headed?', 'Keep it moving.'])); } }
    if(b === 'alert') cue('alert');
    questEvent('band', { n, b, was });
  }
  const pick = a => a[Math.floor(Math.random()*a.length)];

  /* ------------------------------------------------------ crimes & noise
     A crime happens at a place. WFC who could see the place raise the
     heat and come; people who could see it get their phones out; Kai
     just gets angrier. */
  function crime(type, x, z, spare){
    spare = spare || [];
    const c = AI.CRIMES[type] || { sev:1, heard:0 };
    let wfcSaw = false;
    npcs.forEach(n=>{
      if(n.gone || spare.includes(n) || n.stun > 0 || n.inApt !== inside) return;
      const d = Math.hypot(n.x - x, n.z - z);
      if(n.kind === 'drone'){ if(d < 24 && !n.static){ wfcSaw = true; n.state = 'track'; } return; }
      const see = d < 26 && canSee(n, x, feet(), z) && (d < 5 || Math.abs(angDiff(angTo(n.x, n.z, x, z), n.yaw)) < 1.4 || d < c.heard);
      const heard = d < c.heard;
      if(n.kind === 'wfc' && (see || heard)){ wfcSaw = true; n.aware = 1.1; n.band = 'alert'; n.lastSeen = [x, z, feet(), clock]; if(n.state !== 'raid' || type==='flash') n.state = 'pursue'; }
      else if(n.kind === 'civ' && (see || (heard && type === 'flash'))){ if(!n.film && d > 3) startFilm(n); else if(d <= 3) n.flee = 4; }
      else if(n.kind === 'kai' && see){ n.aware = 1.1; questEvent('kaiSaw', { n, type }); }
    });
    if(wfcSaw) heat(AI.raise(S.heat, type), c.label);
  }
  function noise(x, z, r, kind){
    npcs.forEach(n=>{
      if(n.gone || n.stun > 0 || n.kind === 'drone' || n.inApt !== inside) return;
      if(Math.hypot(n.x - x, n.z - z) > r) return;
      if(n.kind === 'civ'){ n.look = [x, z, 2]; return; }
      if(['pursue','grab'].includes(n.state)) return;
      n.investigate = [x, z, 7]; n.aware = Math.max(n.aware, 0.65);
      bark(n, n.kind === 'kai' ? 'Huh?' : '…?');
    });
  }
  function startFilm(n){ n.film = { rec:0, up:0, face:false, lost:0 }; bark(n, '📱'); }
  function stun(n, secs){
    n.stun = secs; n.aware = Math.max(n.aware, 0.5);
    if(n.kind === 'civ'){ n.flee = secs + 3; if(n.film) n.film = null; }
    if(n.state === 'grab') n.state = 'pursue';
    bark(n, '✴');
  }
  let heatSeenT = 0, lastKnown = null;
  function heat(h, why){
    const was = S.heat; h = Math.max(0, Math.min(5, h));
    if(h === was) return;
    S.heat = h; S.maxHeat = Math.max(S.maxHeat||0, h);
    if(h > was){ cue('heat'); note('★'.repeat(h) + ' WFC — ' + (why||'they are looking for YU'), 'bad'); heatSeenT = 0; lastKnown = [G.pos.x, G.pos.z]; }
    else note('☆ Heat down — ' + '★'.repeat(h) + '☆'.repeat(5-h));
    onHeat(h, was);
    hud();
  }
  function expose(n, why){
    S.exposure = Math.min(100, (S.exposure||0) + n);
    note('👁 Exposure +' + n + ' — ' + why, 'warn');
    hud();
  }

  /* --------------------------------------------------------- the drones
     Three of them, flying fixed rounds at thirteen metres with a scanner
     beam on the ground in front of them. Stand in a beam a second and it
     reads the wearables on you — which are all illegal. Jammed, or
     flashed, they are blind for a few seconds. */
  const drones = [];
  function droneMesh(){
    const g = new THREE.Group(), m = CITY.M;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.9), m.darkMetal); g.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color:new THREE.Color(0.6, 3, 3) })); eye.position.set(0, -0.18, 0.3); g.add(eye);
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>{ const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.08), m.metal); arm.position.set(a*0.45, 0.05, b*0.45); arm.rotation.y = a*b*Math.PI/4; g.add(arm);
      const rot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 16), new THREE.MeshBasicMaterial({ color:0x88a0a0, transparent:true, opacity:0.35 })); rot.position.set(a*0.72, 0.1, b*0.72); g.add(rot); });
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color:new THREE.Color(4, 0.3, 0.2) })); red.position.set(-0.4, 0.15, 0); g.add(red);
    const blue = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color:new THREE.Color(0.3, 0.8, 4) })); blue.position.set(0.4, 0.15, 0); g.add(blue);
    // the beam: a cone of light, and its footprint
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color:new THREE.Color(0.25, 1.1, 1.0), transparent:true, opacity:0.08, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide }));
    cone.userData.flat = true;
    const foot = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), new THREE.MeshBasicMaterial({ color:new THREE.Color(0.6, 2.6, 2.4), transparent:true, opacity:0.7, depthWrite:false, side:THREE.DoubleSide }));
    foot.rotation.x = -Math.PI/2; foot.userData.flat = true;
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color:new THREE.Color(0.2, 0.9, 0.8), transparent:true, opacity:0.12, depthWrite:false, blending:THREE.AdditiveBlending }));
    fill.rotation.x = -Math.PI/2; fill.userData.flat = true;
    /* no SpotLight of its own: four more lights on every pixel of the city
       is what a lab GPU cannot afford. The beam's glow on the ground is a
       SOURCE the light pool can borrow, like a lantern's. */
    const src = { x:0, y:2.5, z:0, col:new THREE.Color(0x9ff5e8), k:18, d:9, mul:1 };
    return { g, eye, red, blue, cone, foot, fill, src };
  }
  function spawnDrone(route, o){
    const d = droneMesh(), n = { kind:'drone', x:route[0][0], y:13, z:route[0][1], yaw:0, route, ri:1, state:'patrol', static:0, stun:0, scan:0,
      speed:(o&&o.speed)||4.2, hover:(o&&o.hover)||{}, holdT:0, mesh:d, g:d.g, beam:{ x:0, z:0, y:0, r:3.6 }, lostT:0, name:(o&&o.name)||'drone', inApt:false, def:{ eye:{} } };
    W.cityGroup.add(d.g); W.cityGroup.add(d.cone); W.cityGroup.add(d.foot); W.cityGroup.add(d.fill); W.lights.push(d.src);
    LOOK.hideInMirror.push(d.cone, d.foot, d.fill);
    d.g.position.set(n.x, n.y, n.z);
    npcs.push(n); drones.push(n);
    return n;
  }
  function tickDrone(n, dt){
    const d = n.mesh, p = P();
    n.static = Math.max(0, n.static - dt); n.stun = Math.max(0, n.stun - dt);
    const blind = n.static > 0 || n.stun > 0;
    const fast = S.heat >= 4 ? 1.45 : 1;
    let tx, tz;
    if(n.state === 'track' && !blind){ tx = p.x; tz = p.z; }
    else if(n.state === 'search' && lastKnown){ const a = clock*0.6; tx = lastKnown[0] + Math.cos(a)*9; tz = lastKnown[1] + Math.sin(a)*9; n.searchT -= dt; if(n.searchT <= 0) n.state = 'patrol'; }
    else { const w = n.route[n.ri]; tx = w[0]; tz = w[1];
      if(Math.hypot(tx - n.x, tz - n.z) < 1){ if(n.hover[n.ri] && n.holdT <= 0) n.holdT = n.hover[n.ri]; if(n.holdT > 0){ n.holdT -= dt; if(n.holdT <= 0) n.ri = (n.ri+1) % n.route.length; } else n.ri = (n.ri+1) % n.route.length; } }
    const dx = tx - n.x, dz = tz - n.z, dd = Math.hypot(dx, dz);
    if(dd > 0.2){ const s = Math.min(dd, (n.state==='track' ? 7.5 : n.speed)*fast*dt); n.x += dx/dd*s; n.z += dz/dd*s; n.yaw += angDiff(Math.atan2(dx, dz), n.yaw)*Math.min(1, dt*2.5); }
    n.y = 13 + Math.sin(clock*1.3 + n.x)*0.25;
    d.g.position.set(n.x, n.y, n.z); d.g.rotation.y = n.yaw;
    d.red.visible = S.heat > 0 ? (clock*6|0)%2===0 : (clock*1.5|0)%2===0; d.blue.visible = S.heat > 0 ? !d.red.visible : false;
    // the beam lands a few metres ahead, sweeping a little side to side
    const sweep = n.state === 'track' ? 0 : Math.sin(clock*0.9 + n.x*0.1)*0.5;
    const ahead = n.state === 'track' ? 0 : 3.5;
    const bx = n.state === 'track' && !blind ? lerp(n.beam.x || p.x, p.x, Math.min(1, dt*5)) : n.x + Math.sin(n.yaw + sweep)*ahead;
    const bz = n.state === 'track' && !blind ? lerp(n.beam.z || p.z, p.z, Math.min(1, dt*5)) : n.z + Math.cos(n.yaw + sweep)*ahead;
    const by = groundAt(bx, bz, 60);
    n.beam.x = bx; n.beam.z = bz; n.beam.y = by;
    const h = n.y - by, len = Math.hypot(h, Math.hypot(bx-n.x, bz-n.z));
    [d.cone, d.foot, d.fill].forEach(m=>m.visible = !blind);
    d.src.mul = blind ? 0 : (n.state === 'track' ? 1.6 : 1);
    if(!blind){
      d.cone.position.set((n.x+bx)/2, (n.y+by)/2, (n.z+bz)/2);
      d.cone.scale.set(n.beam.r, len, n.beam.r);
      d.cone.lookAt(n.x, n.y, n.z); d.cone.rotateX(-Math.PI/2);
      d.foot.position.set(bx, by + 0.03, bz); d.foot.scale.setScalar(n.beam.r);
      d.fill.position.set(bx, by + 0.025, bz); d.fill.scale.setScalar(n.beam.r);
      const hot = n.state === 'track' || n.scan > 0.05;
      d.foot.material.color.setRGB(hot ? 3 : 0.6, hot ? 0.5 : 2.6, hot ? 0.4 : 2.4);
      d.src.col.setHex(hot ? 0xff6a5a : 0x9ff5e8);
    }
    d.src.x = bx; d.src.y = by + 2.2; d.src.z = bz;
    // is she in it?
    const inBeam = !blind && !me.hidden && mode !== 'talk' && !inside && Math.hypot(p.x - bx, p.z - bz) < n.beam.r && Math.abs(p.y - by) < 2.5;
    if(n.state === 'track'){
      if(inBeam){ n.lostT = 0; lastKnown = [p.x, p.z]; heatSeenT = 0; }
      else { n.lostT += dt; if(n.lostT > 4){ n.state = 'search'; n.searchT = 12; } }
    } else if(inBeam && n.state !== 'track'){
      n.scan += dt/1.1;
      if(Math.floor(n.scan*8) !== Math.floor((n.scan-dt/1.1)*8)) cue('scan');
      if(n.scan >= 1){ n.scan = 0; n.state = 'track'; n.lostT = 0; lastKnown = [p.x, p.z];
        if(gad.jam > 0){ n.static = 3; n.state = 'patrol'; }
        else { crime('scan', p.x, p.z); if(S.heat === 0) heat(1, 'a drone read your wearables'); note('🛸 SCANNED — illegal wearables', 'bad'); } }
    } else n.scan = Math.max(0, n.scan - dt*0.8);
    n.inBeam = inBeam;
  }

  /* ---------------------------------------------------------- the trucks
     Delivery trucks on their rounds, two on the avenue and two on Market
     Street. They stop for people. Walk up beside one with a tracker in
     your hand and it can do the running for you. */
  const trucks = [];
  function truckMesh(col){
    const g = new THREE.Group(), m = CITY.M;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 1.8), new THREE.MeshStandardMaterial({ color:col, roughness:0.4, metalness:0.4 })); cab.position.set(0, 1.25, 2.3); g.add(cab);
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 4.4), new THREE.MeshStandardMaterial({ color:0xd8dcd6, roughness:0.6 })); box.position.set(0, 1.65, -0.9); g.add(box);
    const win = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 0.05), m.glass); win.position.set(0, 1.8, 3.21); g.add(win);
    [[-0.8, 3.22], [0.8, 3.22]].forEach(([x, z])=>{ const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.05), m.bulb); l.position.set(x, 0.85, z); g.add(l); });
    [[-0.9, -3.12], [0.9, -3.12]].forEach(([x, z])=>{ const l = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.05), m.red); l.position.set(x, 0.9, z); g.add(l); });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.25, 4.42), m.teal); stripe.position.set(0, 1.0, -0.9); g.add(stripe);
    [[-1.05, 1.9], [1.05, 1.9], [-1.05, -2.2], [1.05, -2.2]].forEach(([x, z])=>{ const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 14), m.tyre); w.rotation.z = Math.PI/2; w.position.set(x, 0.45, z); g.add(w); });
    return g;
  }
  function spawnTruck(axis, lane, dir, at, col){
    const g = truckMesh(col); W.cityGroup.add(g);
    const t = { g, axis, lane, dir, s:at, spd:9, v:9, solid:{ x1:0, x2:0, z1:0, z2:0, y1:-1, y2:3, tag:'truck' }, tracker:false };
    dyn.push(t.solid); trucks.push(t);
    return t;
  }
  function tickTrucks(dt){
    const p = P();
    trucks.forEach(t=>{
      const x = t.axis==='x' ? t.s : t.lane, z = t.axis==='x' ? t.lane : t.s;
      // brake for anybody in front
      const ahead = (ox, oz) => { const along = t.axis==='x' ? (ox - x)*t.dir : (oz - z)*t.dir, side = t.axis==='x' ? Math.abs(oz - z) : Math.abs(ox - x); return along > 2 && along < 8 && side < 1.7; };
      const block = (p.y < 1 && ahead(p.x, p.z)) || npcs.some(n=>n.kind !== 'drone' && !n.gone && ahead(n.x, n.z)) || trucks.some(o=>o!==t && o.axis===t.axis && o.lane===t.lane && ahead(o.axis==='x' ? o.s : o.lane, o.axis==='x' ? o.lane : o.s));
      t.v += ((block ? 0 : t.spd) - t.v)*Math.min(1, dt*(block ? 4 : 1));
      t.s += t.dir*t.v*dt;
      const lim = t.axis==='x' ? 108 : 83;
      if(t.s > lim) t.s = -lim; if(t.s < -lim) t.s = lim;
      const nx = t.axis==='x' ? t.s : t.lane, nz = t.axis==='x' ? t.lane : t.s;
      t.g.position.set(nx, 0, nz);
      t.g.rotation.y = t.axis==='x' ? (t.dir > 0 ? Math.PI/2 : -Math.PI/2) : (t.dir > 0 ? 0 : Math.PI);
      const hw = t.axis==='x' ? 3.2 : 1.25, hd = t.axis==='x' ? 1.25 : 3.2;
      Object.assign(t.solid, { x1:nx-hw, x2:nx+hw, z1:nz-hd, z2:nz+hd });
      t.x = nx; t.z = nz;
    });
  }

  /* ============================================================ behaviour
     One function a kind. Each frame a person does one thing: flee, film,
     look at a noise, chase, walk their beat, or stand where they stand. */
  function tickNpc(n, dt){
    if(n.kind === 'drone') return tickDrone(n, dt);
    n.t += dt; n.barkT = Math.max(0, n.barkT - dt);
    n.stun = Math.max(0, n.stun - dt);
    n.perT -= dt; if(n.perT <= 0){ n.perT = 0.1; perceive(n, 0.1); }
    n.moving = false; n.running = false; n.clip = null;
    if(n.stun > 0){ n.clip = 'idle'; n.yaw += Math.sin(n.t*9)*dt*2; }
    else if(n.investigate && !['pursue','grab','deal','catch','talk','cut'].includes(n.state) && !n.hold) investigate(n, dt);
    else if(n.kind === 'civ') tickCiv(n, dt);
    else if(n.kind === 'wfc') tickWfc(n, dt);
    else if(n.kind === 'kai') tickKai(n, dt);
    else if(n.kind === 'maya') tickMaya(n, dt);
    else if(n.kind === 'vendor') tickVendor(n, dt);
    n.g.position.set(n.x, n.y, n.z); n.g.rotation.y = n.yaw;
    const far = Math.hypot(n.x - G.camera.position.x, n.z - G.camera.position.z);
    n.g.visible = !n.hidden && n.inApt === inside && far < 95;
    if(n.model && n.g.visible && (far < 60 || (n.t*10|0)%3===0)){
      const clip = n.moving ? (n.running ? 'sprint' : 'walk') : (n.clip || 'idle');
      AVATAR.animate(n.model, far < 60 ? dt : dt*3, clip);
    }
  }
  function investigate(n, dt){
    const iv = n.investigate;
    if(Math.hypot(iv[0]-n.x, iv[1]-n.z) > 1.2 && !iv.arrived){ goTo(n, iv[0], iv[1], undefined, n.def.walk*1.5, dt); return; }
    iv.arrived = true; iv[2] -= dt; n.yaw += Math.sin(n.t*1.4)*dt*1.4; n.clip = 'idle';
    if(iv[2] <= 0) n.investigate = null;
  }
  function bark(n, text){
    if(!n || n.barkT > 0) return; n.barkT = 3;
    bubble(()=>V(n.x, n.y + 2.25, n.z), text, 2.2);
    if(text && /[a-z]/i.test(text) && !n.hidden && !!n.inApt === inside){
      const d = Math.hypot(n.x - G.pos.x, n.z - G.pos.z);
      if(d < 32) voice(n.kind, text, { bark:true, vol:Math.max(0.25, 1 - d/36) });
    }
  }

  /* ---- people on the pavement: they walk from corner to corner, stop
     at a stall, look at a noise, and film anything worth filming. */
  function tickCiv(n, dt){
    if(n.phone) n.phone.visible = !!n.film;
    if(n.flee > 0){ n.flee -= dt; const p = P(), dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz)||1;
      stepTo(n, n.x + dx/d*4, n.z + dz/d*4, n.def.run, dt); return; }
    if(n.film){ tickFilm(n, dt); return; }
    if(n.look){ face(n, n.look[0], n.look[1], dt); n.look[2] -= dt; if(n.look[2] <= 0) n.look = null; n.clip = 'idle'; return; }
    if(n.state === 'stand'){ if(n.faceTo) face(n, n.faceTo[0], n.faceTo[1], dt); n.clip = n.pose || 'idle'; return; }
    if(n.wait > 0){ n.wait -= dt; n.clip = 'idle'; return; }
    if(!n.to || Math.hypot(n.to[0]-n.x, n.to[1]-n.z) < 0.9){
      const nodes = W.nav.nodes, opts = [];
      for(const nd of nodes){ if(nd.y > 0.5) continue; const d = Math.hypot(nd.x-n.x, nd.z-n.z); if(d > 8 && d < 45) opts.push(nd); }
      const nd = opts[Math.floor(Math.random()*opts.length)];
      if(nd) n.to = [nd.x + (Math.random()-0.5)*2, nd.z + (Math.random()-0.5)*2];
      if(Math.random() < 0.35) n.wait = 1 + Math.random()*4;
      return;
    }
    goTo(n, n.to[0], n.to[1], undefined, n.def.walk*(n.brisk||1), dt);
  }
  function tickFilm(n, dt){
    const f = n.film, p = P();
    face(n, p.x, p.z, dt); n.clip = 'idle';
    if(n.sees){ f.lost = 0; if(f.rec < 1.6){ f.rec += dt; if(!me.hood) f.face = true; } }
    else f.lost += dt;
    if(f.rec >= 1.6){
      f.up += dt/5;
      if(f.up >= 1){ n.film = null; uploaded(f); }
    } else if(f.lost > 4){ n.film = null; bark(n, '…lost it'); }
  }
  function uploaded(f){
    S.trail.uploads = (S.trail.uploads||0) + 1;
    heat(AI.report(S.heat), 'a video of YU hit the WFC tip line');
    if(f.face){ S.trail.faceVideo = true; expose(22, 'your face is in the video'); }
    lastKnown = [G.pos.x, G.pos.z];
  }

  /* ---- WFC: a beat, a post, a chase, a search, and home again. They
     only care about you when there is heat on YU — or when they see
     something happen with their own eyes. */
  function tickWfc(n, dt){
    const p = P();
    if(n.sees && S.heat > 0){ heatSeenT = 0; lastKnown = [p.x, p.z]; }
    if(n.sees && S.heat > 0 && n.aware >= 1 && !['pursue','grab','raid','escort'].includes(n.state)){
      n.state = 'pursue'; bark(n, pick(['Stop! WFC!', 'Hold it right there!', 'Suspect on foot!']));
      npcs.forEach(o=>{ if(o!==n && o.kind==='wfc' && !['pursue','grab'].includes(o.state) && Math.hypot(o.x-n.x, o.z-n.z) < 45){ o.investigate = [p.x, p.z, 6]; o.aware = Math.max(o.aware, 0.7); } });
    }
    switch(n.state){
      case 'post': {
        const h = n.home; if(Math.hypot(h[0]-n.x, h[1]-n.z) > 0.6) goTo(n, h[0], h[1], 0, n.def.walk, dt);
        else { n.yaw += angDiff(h[2], n.yaw)*Math.min(1, dt*3); n.clip = 'idle'; }
        break; }
      case 'patrol': {
        const w = n.route[n.ri];
        if(goTo(n, w[0], w[1], undefined, n.def.walk, dt)){ n.ri = (n.ri+1) % n.route.length; }
        break; }
      case 'pursue': {
        if(S.heat === 0 && n.aware < 1){ n.state = 'return'; break; }
        const seen = n.sees || (n.lastSeen && clock - n.lastSeen[3] < 1.2);
        const tx = seen ? p.x : (n.lastSeen ? n.lastSeen[0] : p.x), tz = seen ? p.z : (n.lastSeen ? n.lastSeen[1] : p.z);
        goTo(n, tx, tz, seen ? p.y : undefined, n.def.run, dt);
        if(seen && p.running && !n.evaded && S.heat > 0){ n.evaded = true; crime('evade', p.x, p.z); }
        if(seen && Math.hypot(p.x-n.x, p.z-n.z) < 1.25 && Math.abs(p.y - n.y) < 1 && !mode && !me.hidden) grab(n);
        if(!n.sees && n.lastSeen && clock - n.lastSeen[3] > 4){ n.state = 'search'; n.searchT = 14; n.sp = null; }
        break; }
      case 'search': {
        n.searchT -= dt;
        if(!n.sp || Math.hypot(n.sp[0]-n.x, n.sp[1]-n.z) < 1){ const c = n.lastSeen || lastKnown || [n.x, n.z]; n.sp = [c[0] + (Math.random()-0.5)*18, c[1] + (Math.random()-0.5)*18]; }
        goTo(n, n.sp[0], n.sp[1], undefined, n.def.walk*1.6, dt);
        if(n.searchT <= 0){ n.state = 'return'; n.evaded = false; }
        break; }
      case 'return': {
        const h = n.home || (n.route && n.route[0]) || [n.x, n.z];
        if(goTo(n, h[0], h[1], undefined, n.def.walk, dt)){ n.state = n.base || 'patrol'; n.aware = 0; }
        if(n.leaving && Math.hypot(h[0]-n.x, h[1]-n.z) < 2) despawn(n);
        break; }
      case 'grab': n.clip = 'idle'; face(n, p.x, p.z, dt); break;
      default: n.clip = 'idle';
    }
  }

  /* ---- the vendor under the awning: he minds his stall */
  function tickVendor(n, dt){ face(n, n.x + 3, n.z, dt); n.clip = 'idle'; }

  /* ---- KAI. Late teens, well built, and a temper. His states are the
     deal's states: arriving, waiting, dealing, catching, searching,
     tailing, robbing, staking out the dead drop, and — later — hunting. */
  function tickKai(n, dt){
    const p = P(), d = Math.hypot(p.x-n.x, p.z-n.z);
    switch(n.state){
      case 'walk': {
        const t = n.dest; if(goTo(n, t[0], t[1], t[2], t[3] || n.def.walk, dt)){ n.state = n.after || 'idle'; n.dest = null; if(n.onArrive){ const f = n.onArrive; n.onArrive = null; f(); } }
        break; }
      case 'wait': {
        const k = W.spots.kai;
        if(Math.hypot(k[0]-n.x, k[1]-n.z) > 0.5){ goTo(n, k[0], k[1], 0, n.def.walk, dt); break; }
        if(n.band !== 'unaware' && n.sees) face(n, p.x, p.z, dt); else n.yaw += angDiff(Math.PI + Math.sin(n.t*0.4)*0.6, n.yaw)*Math.min(1, dt*2);
        n.clip = 'idle';
        break; }
      case 'deal': case 'talk': face(n, p.x, p.z, dt); n.clip = n.talking ? 'talk' : 'idle'; break;
      case 'catch': n.clip = 'idle'; break;
      case 'search': {
        n.searchT -= dt; n.yaw += Math.sin(n.t*1.1)*dt*1.8; n.clip = 'idle';
        if(n.sees && n.aware >= 0.62){ n.state = 'tail'; bark(n, 'There you are.'); questEvent('kaiSpot', { n }); }
        else if(n.searchT <= 0) kaiLeave(n);
        break; }
      case 'tail': {
        if(n.sees){ n.tailLost = 0; if(d > 11) goTo(n, p.x, p.z, p.y, d > 20 ? n.def.run*0.8 : n.def.walk*1.3, dt); else { face(n, p.x, p.z, dt); n.clip = 'idle'; } }
        else { n.tailLost = (n.tailLost||0) + dt; if(n.lastSeen) goTo(n, n.lastSeen[0], n.lastSeen[1], n.lastSeen[2], n.def.walk*1.6, dt);
          if(n.tailLost > 9){ bark(n, 'Tch.'); questEvent('kaiLost', { n }); kaiLeave(n); } }
        break; }
      case 'pursue': {
        const seen = n.sees || (n.lastSeen && clock - n.lastSeen[3] < 1.2);
        const tx = seen ? p.x : (n.lastSeen ? n.lastSeen[0] : p.x), tz = seen ? p.z : (n.lastSeen ? n.lastSeen[1] : p.z);
        goTo(n, tx, tz, seen ? p.y : undefined, n.def.run, dt);
        if(seen && d < 1.25 && Math.abs(p.y - n.y) < 1 && !mode && !me.hidden) grab(n);
        if(!n.sees && n.lastSeen && clock - n.lastSeen[3] > 6){ n.state = n.fallback || 'hunt'; bark(n, 'Where\'d she go…'); }
        break; }
      case 'rob': {
        const l = W.ladders.find(l=>l.id==='maya');
        if(goTo(n, l.bottom[0], l.bottom[1], 0, n.def.walk, dt) && !n.climb){ questEvent('kaiGone', { n }); despawn(n); }
        // followed, he walks faster and says so; it takes a flash in the face to make him turn
        if(n.sees && d < 6 && !n.saidFollow){ n.saidFollow = true; bark(n, 'Following me? Go home, kid.'); }
        break; }
      case 'stakeout': {
        const s = n.stake; if(Math.hypot(s[0]-n.x, s[1]-n.z) > 0.6){ goTo(n, s[0], s[1], 0, n.def.walk, dt); break; }
        // he checks his phone every so often: those are the seconds you have
        n.phoneT = (n.phoneT === undefined ? 14 : n.phoneT) - dt;
        if(n.phoneT < 0){ n.distracted = true; n.clip = 'idle'; if(n.phoneT < -5){ n.phoneT = 20 + Math.random()*8; n.distracted = false; } }
        else { n.distracted = false; const m = W.spots.drop; n.yaw += angDiff(angTo(n.x, n.z, m[0], m[1]) + Math.sin(n.t*0.5)*0.3, n.yaw)*Math.min(1, dt*2); n.clip = 'idle'; }
        if(n.sees && n.aware >= 1){ n.state = 'pursue'; n.fallback = 'stakeout'; bark(n, 'Hey! That\'s—'); }
        break; }
      case 'hunt': {
        if(n.sees && n.aware >= 0.62){ n.state = 'pursue'; n.fallback = 'hunt'; bark(n, pick(['There you are!', 'YU!', 'You\'re mine.'])); break; }
        if(!n.sp || Math.hypot(n.sp[0]-n.x, n.sp[1]-n.z) < 1.2 || (n.spT -= dt) < 0){
          const c = n.lastSeen || [G.pos.x, G.pos.z, 0];
          const r = 6 + Math.random()*16, a = Math.random()*Math.PI*2;
          n.sp = [c[0] + Math.cos(a)*r, c[1] + Math.sin(a)*r]; n.spT = 9;
        }
        goTo(n, n.sp[0], n.sp[1], undefined, n.def.walk*1.8, dt);
        break; }
      case 'leave': {
        const t = n.dest || [-60, -48];
        if(goTo(n, t[0], t[1], undefined, n.def.walk*1.2, dt)) despawn(n);
        break; }
      case 'enter': case 'appr': tickKaiApt(n, dt); break;
      case 'grab': n.clip = 'idle'; face(n, p.x, p.z, dt); break;
      case 'offstage': n.hidden = true; break;
      default: n.clip = n.talking ? 'talk' : 'idle';
    }
  }
  function kaiLeave(n){
    if(!n || n.gone) return;
    n.state = 'leave'; n.dest = [-31.15, 20]; n.hidden = false;
    // the trash can he kicks on the way
  }

  /* ---- MAYA. On her roof with binoculars; later, in your flat. */
  function tickMaya(n, dt){
    if(n.state === 'roof'){ n.clip = 'idle'; n.yaw = Math.PI; return; }
    if(n.state === 'hidden'){ n.hidden = true; n.clip = 'idle'; return; }
    if(n.state === 'talk'){ tickMayaApt(n, dt); return; }
    if(n.state === 'walk'){ const t = n.dest; if(goTo(n, t[0], t[1], t[2], n.def.walk, dt)){ n.state = n.after || 'idle'; } return; }
    n.clip = n.talking ? 'talk' : 'idle';
  }

  /* ============================================================ populate
     Who is out tonight, and where — by the clock and by the beat. */
  const CIV = ['nia','theo','zuri','walk-s','walk-t','walk-u','walk-v','walk-x'];
  let dropCan = null;
  function populate(){
    clearNpcs();
    placeScooters();
    makeRain();
    // three drones on their rounds
    spawnDrone([[-96, 0], [96, 0]], { name:'dAve', speed:4.4 });
    spawnDrone([[0, -78], [0, 78]], { name:'dMkt', speed:4.0 });
    spawnDrone([[-41.5, -47], [-41.5, -13], [-60, -8], [-60, -47]], { name:'dAlley', speed:3.4, hover:{ 1:6, 3:4 } });
    spawnDrone([[62, 30], [62, 70], [100, 48], [40, 48]], { name:'dHarbor', speed:3.6, hover:{ 0:4 } });
    // two officers walking beats
    const o1 = spawn('wfc', 'theo', -60, -48, { state:'patrol', route:[[-60,-48],[60,-48],[60,-8],[-8,-8],[-8,-48]], name:'beatN' }); o1.base = 'patrol';
    const o2 = spawn('wfc', 'walk-s', 59, 48, { state:'patrol', route:[[59,48],[59,12],[92,48],[40,48],[20,48]], name:'beatS' }); o2.base = 'patrol';
    // people
    const spots = [[-80,8],[-70,-8],[-30,-8],[-10,8],[15,-8],[25,8],[48,-8],[70,8],[90,-8],[-8,-30],[8,30],[-8,60],[8,-60],[-30,48],[30,-48],[80,48],[-90,48],[-59,20]];
    spots.forEach(([x, z], i)=>{ const c = spawn('civ', CIV[i % CIV.length], x, z, { name:'civ'+i, phone:true }); c.brisk = 0.85 + Math.random()*0.35; });
    // standing about: at the noodle stands, by the metro, outside the club
    [[40, 7.2, 40, 8.6], [41.2, 7.3, 40, 8.6], [-64, -7.2, -64, -8.6], [-65.5, -7.4, -64, -8.6], [-68, 11.5, -70, 8], [72, -6.5, 72, -10]].forEach(([x, z, fx, fz], i)=>{
      const c = spawn('civ', CIV[(i*3+1) % CIV.length], x, z, { name:'stand'+i, state:'stand', phone:true }); c.faceTo = [fx, fz]; if(i===5) c.pose = 'dance'; });
    // the vendor at his stall
    { const v = W.spots.vendor; spawn('vendor', 'walk-v', v[0]-0.2, v[1], { name:'vendor', state:'stand', yaw:Math.PI/2 }); }
    // delivery trucks
    spawnTruck('x', 2.8, 1, -70, 0x2a6a5a); spawnTruck('x', -2.8, -1, 40, 0x6a3a2a);
    spawnTruck('z', -2.8, 1, -50, 0x2a3a6a); spawnTruck('z', 2.8, -1, 30, 0x5a2a4a);
    // the dented can Kai kicks
    dropCan = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.8, 10), CITY.M.metal); dropCan.position.set(-40, 0.4, -24.5); W.cityGroup.add(dropCan);
    // the cast, by beat
    castForBeat();
  }
  function castForBeat(){
    ['kai','maya'].forEach(k=>{ const n = find(k); if(n) despawn(n); });
    if(['lesson','deal','drop','robbed','news'].includes(S.step)){
      const m = W.spots.maya;
      const maya = spawn('maya', 'sable', m[0], m[1], { y:m[2], name:'maya', state:'roof', yaw:Math.PI });
      glint(maya);
    }
    if(S.step === 'deal' || S.step === 'lesson') kaiSchedule();
    if(S.step === 'drop') kaiSchedule();
    if(S.step === 'robbed'){ const k = spawn('kai', 'kofi', -41.5, -30, { name:'kai', state:'rob' }); }
    if(S.step === 'out'){ const h = W.spots.home; const k = spawn('kai', 'kofi', h[0], h[1] + 1, { name:'kai', state:'hunt' }); k.lastSeen = [G.pos.x, G.pos.z, 0, clock]; }
  }
  /* KAI IS ALREADY IN THE ALLEY. The message said 22:30, but nothing in
     the night runs on the clock: he is at the meeting spot when you get
     there, however long the workshop took, and he waits. */
  function kaiSchedule(){
    if(find('kai')) return;
    const s = W.spots.kai;
    const k = spawn('kai', 'kofi', s[0], s[1], { name:'kai', state:'wait', yaw:Math.PI });
    if(S.step === 'drop' || S.flags.dropLeft) kaiToDrop(k);
  }
  function kaiToDrop(k){
    const m = W.spots.drop;
    k.hidden = false;
    k.state = 'walk'; k.dest = [m[0]-0.3, m[1]+0.5, 0]; k.after = 'swap';
    k.onArrive = ()=>{ k.state = 'catch'; later(()=>{ if(!on || k.gone) return; S.flags.dropCash = true; note('📱 Kai: "Done."'); k.state = 'walk'; k.dest = [-43.2, -12.8, 0]; k.after = 'stakeout'; k.stake = [-43.2, -12.8]; }, 3000); };
  }
  /* the glint of Maya's binoculars, from across the avenue */
  let glintMesh = null;
  function glint(maya){
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ color:new THREE.Color(5, 5, 4.2), transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending }));
    m.position.set(maya.x, maya.y + 1.62, maya.z - 0.3); m.userData.flat = true; W.cityGroup.add(m); glintMesh = m;
  }
  function tickGlint(dt){
    const maya = find('maya');
    if(!glintMesh) return;
    glintMesh.visible = !!(maya && maya.state === 'roof' && !inside);
    if(!glintMesh.visible) return;
    glintMesh.lookAt(G.camera.position);
    const k = Math.pow(Math.max(0, Math.sin(clock*0.9)), 12);
    glintMesh.material.opacity = 0.15 + 0.85*k;
    glintMesh.scale.setScalar(0.6 + 2.4*k);
    // looking straight at it, with nothing in the way, is seeing her
    if(!S.trail.scouted && ['deal','drop','robbed','home'].includes(S.step)){
      const cp = G.camera.position, to = glintMesh.position.clone().sub(cp), d = to.length();
      const fwd = V(0, 0, -1).applyQuaternion(G.camera.quaternion);
      if(d < 120 && to.normalize().dot(fwd) > 0.9975 && los(cp.x, cp.y, cp.z, glintMesh.position.x, glintMesh.position.y, glintMesh.position.z)){
        S.flags.scoutT = (S.flags.scoutT||0) + dt;
        if(S.flags.scoutT > 0.4){ S.trail.scouted = true; cue('sus'); note('👀 Somebody on the roof across the avenue. Binoculars — pointed at you.', 'big'); }
      } else S.flags.scoutT = 0;
    }
  }

  /* ============================================================== events
     THE CHECKPOINT FOLLOWS THE STORY. It goes up when the Director has
     finished telling the city what WFC is doing for it (the 'news' scene)
     and stays up while Robin walks home; at four stars it is manned
     whatever is going on. Nothing else in the city happens on a timer. */
  let cpOn = false;
  function tickEvents(dt){
    const want = S.step === 'home' || S.heat >= AI.HEAT.checkpoints;
    if(want !== cpOn) checkpointOnOff(want);
    if(cpOn) tickCheckpoint(dt);
    // the clock stops at two; nothing fails
    S.t = Math.min(AI.AT.end, S.t + dt*AI.RATE*(mode === 'cut' || mode === 'talk' || mode === 'reel' ? 0 : 1));
  }
  function checkpointOnOff(v){
    cpOn = v;
    W.checkpoint.group.visible = v;
    W.checkpoint.solids.forEach(s=>{ s.off = !v; if(v && !G.solids.includes(s)) G.solids.push(s); });
    const L = W.checkpoint.light;
    if(v){ if(!W.lights.includes(W.checkpoint.src)){ W.checkpoint.src = { x:L[0], y:L[1], z:L[2], col:new THREE.Color(L[3]), k:L[4], d:L[5] }; W.lights.push(W.checkpoint.src); }
      [-8, 8].forEach((z, i)=>{ if(!find('cp'+i)){ const g = spawn('wfc', ['walk-t','nia'][i], 31.2, z + (i ? -1.6 : 1.6), { name:'cp'+i, state:'post' }); g.home = [31.2, z + (i ? -1.6 : 1.6), -Math.PI/2]; g.base = 'post'; } });
      if(S.step !== 'home') note('🚧 WFC has closed Neon Avenue at the crossing east of Market Street.'); }
    else { W.lights = W.lights.filter(s=>s!==W.checkpoint.src);
      ['cp0','cp1'].forEach(k=>{ const g = find(k); if(g){ g.state = 'return'; g.leaving = true; g.home = [22, -48]; } }); }
  }
  function tickCheckpoint(dt){
    const p = P();
    W.checkpoint.arches.forEach(a=>{
      const inArch = Math.abs(p.x - a.x) < 0.7 && Math.abs(p.z - a.z) < 1.4 && p.y < 1;
      const red = a.alarm > 0;
      a.alarm = Math.max(0, (a.alarm||0) - dt);
      if(!a.mat){ a.mat = a.beam.material.clone(); a.beam.material = a.mat; }
      a.mat.color.setRGB(red ? 5 : 0.5, red ? 0.4 : 2.5, red ? 0.3 : 2.3);
      a.beam.visible = true;
      if(inArch && !a.cooling){
        a.cooling = true; setTimeout(()=>{ a.cooling = false; }, 3000);
        if(gad.jam > 0){ note('📡 The arch hiccups. Jammed.'); return; }
        a.alarm = 3; cue('alert');
        crime('gate', p.x, p.z);
        if(S.heat < 1) heat(1, 'the scanner arch read your wearables');
      }
    });
  }
  /* ============================================================ the quest
     The beats, from tshai.js's table. `outcome()` is the only way a beat
     ends; `beatStart()` sets up the next one — its goal, its optional
     information, where its marker is — and saves a checkpoint. */
  const INFO = {
    deal:   ['The buyer: Dragon Alley, off Neon Avenue. He is waiting.', 'A WFC drone sweeps the alley about once a minute.',
             'Or leave the rings in the mailbox at the back of the alley — a dead drop.', 'The fire escape in the alley goes up to the roofs.',
             'G — the Gecko cuffs climb any wall. Nobody looks up; WFC who do see illegal wearables.',
             'H — hood and shades. Nobody has seen your face yet.'],
    drop:   ['Kai is watching the mailbox from the far end of the alley.', 'He checks his phone every so often.', 'Q throws a can — people go and look.', 'Hide in a dumpster (E) if he turns round.'],
    robbed: ['Kai is walking back to his crew.', 'Get behind him without being seen: E lifts the envelope.', 'Or a flash (F) makes him drop it.', 'Or let him go.'],
    news:   ['Out of the alley onto Neon Avenue — the street, or over the roofs.', 'Home is 214 Harbor Lane, the south-east corner of the district.'],
    home:   ['Home: 214 Harbor Lane, the south-east corner.', 'WFC has closed Neon Avenue east of Market Street.', 'The metro runs from Neon West to Harbor Lane.',
             'The back lanes and the roofs go round the checkpoint.', 'I — your bag. Check what you are carrying.'],
    apt:    ['The switch by the door kills every light.', 'The window opens onto the fire escape.', 'Your bench has tools on it.', 'The photo is on the shelf by the window.'],
    escape: ['The door, or the window.', 'F — the flash bangles, if there is a charge left.', 'In the dark, nobody sees much.'],
    chair:  ['A and D, again and again — work the tie loose.', 'If you took the cutter from the bench, E cuts it.'],
    escape2:['The window is the quiet way. The door is Maya\'s way.'],
    out:    ['Lose Kai, and any heat.', 'Then get up high: a roof over 16 m. The one next to your building is the tallest near you.', 'Nothing can be ★ when you stop to breathe.']
  };
  function marker(){
    const s = W.spots;
    switch(S.step){
      case 'lesson': return lessonMarker();
      case 'deal': return S.flags.dropLeft ? null : [s.kai[0], s.kai[1], 2.2, 'The buyer'];
      case 'drop': return S.flags.dropCash ? [s.drop[0], s.drop[1], 2, 'The mailbox'] : null;
      case 'robbed': { const k = find('kai'); return k ? [k.x, k.z, k.y + 2.4, 'Kai'] : null; }
      case 'news': return inAlley() ? [s.alleyMouth[0], s.alleyMouth[1], 2.4, 'Neon Avenue'] : null;
      case 'home': return [s.home[0], s.home[1], 2.6, 'Home'];
      case 'out': { const r = nearestHigh(); return r ? [r[0], r[1], r[2] + 1, 'High ground'] : null; }
    }
    return null;
  }
  function nearestHigh(){
    let best = null, bd = Infinity;
    W.roofs.forEach(r=>{ if(!r.high || r.x2 - r.x1 > 60) return; const x = (r.x1+r.x2)/2, z = (r.z1+r.z2)/2, d = Math.hypot(x - G.pos.x, z - G.pos.z); if(d < bd){ bd = d; best = [x, z, r.h]; } });
    return best;
  }
  function outcome(o){
    const nx = AI.next(S.step, o);
    if(nx === S.step) return false;
    if(['paid','robbed','dropped','noshow','confiscated','recovered','retrieved','gaveup','stiffed'].includes(o)) S.dealPath.push(o);
    S.step = nx;
    beatStart(false);
    return true;
  }
  function beatStart(first){
    hud();
    const g = AI.QUEST[S.step];
    setObjective(S.step === 'home' && !S.cash ? 'Get home.' : g ? g.goal : '', INFO[S.step] || []);
    if(['deal','news','home','out'].includes(S.step) && !inside) later(()=>{ if(on) checkpoint(); }, 400);
  }
  /* THE STORYBOARD (tshai.js STORY). `scene()` is how anything in the
     night gets said: it plays only when it is that scene's turn — the one
     before it has played — and only once; a scene asked for out of turn
     does nothing. `mark()` notes a scene whose moment the game itself
     has already decided (Kai through the door, the chair). */
  function scene(id, play){
    if(!AI.ready(S.seen, id)) return false;
    S.seen.push(id);
    play();
    return true;
  }
  function mark(id){ if(!S.seen.includes(id)) S.seen.push(id); }
  function inAlley(){ const a = W.zones.alley; return G.pos.x > a.x1 - 1 && G.pos.x < a.x2 + 1 && G.pos.z > a.z1 - 1 && G.pos.z < a.z2 + 1; }

  /* --------------------------------------------------------- beat by beat */
  let dealT = null;
  function tickQuest(dt){
    const p = P(), kai = find('kai');
    // --- the deal: walk right up to him and he starts it himself (E starts it from a few steps off) ---
    if(S.step === 'deal'){
      if(kai && kai.state === 'wait' && !dealT && S.rings && Math.hypot(p.x - kai.x, p.z - kai.z) < 2.0 && p.y < 1 && !mode) dealBegin(kai);
      if(dealT) tickDeal(dt, kai);
    }
    // --- the dead drop: walk away from the envelope and it is gone ---
    if(S.step === 'drop' && S.flags.dropCash && !inside){
      const m = W.spots.drop;
      if(Math.hypot(p.x - m[0], p.z - m[1]) > 60){ S.flags.dropCash = false; note('You walked away from the money.', 'bad'); outcome('gaveup'); }
    }
    // --- the screens, the binoculars, the roof: as she steps out of the alley with the deal behind her ---
    if(S.step === 'news' && !inside && !mode && !busy && !inAlley()){
      const chased = S.heat > 0 || (kai && !kai.gone && kai.state === 'pursue');
      if(!chased) scene('news', newsScene);
    }
    // --- Kai tailing you home ---
    if(kai && kai.state === 'tail' && S.step === 'home' && kai.sees && Math.hypot(W.spots.home[0]-p.x, W.spots.home[1]-p.z) < 20) S.trail.kaiTail = true;
    // --- the flat ---
    if(inside) tickApt(dt);
    // --- the last beat: somewhere high, nobody on you ---
    if(S.step === 'out' && !mode) tickOut(dt);
  }

  /* THE DEAL, as George wrote it — played, not read. Kai talks; Robin
     answers when you say so; and twice the deal can go another way:
       "Show me the merchandise." — hold out for the money, as Robin does,
         or show him the rings, and watch them go into his pocket;
       the envelope in her hand — toss him the rings, as Robin does, or
         keep them and walk, and have Kai come after her. */
  function dealBegin(kai){
    if(mode) return;
    dealT = { stage:'talk' };
    kai.state = 'deal'; S.flags.dealStarted = true;
    const ok = convo([
      ['kai', 'YU?'],
      { ask:[
        { say:'Spell it out.', hint:'make him say it' },
        { say:'Who\'s asking?', hint:'play it cool', then:[['kai', 'The guy with your money.']] }
      ]},
      ['kai', 'Y, U.'],
      ['robin', 'Cash first.'],
      ['kai', 'Show me the merchandise.'],
      { ask:[
        { say:'I said. Money first.', hint:'don\'t budge' },
        { icon:'💍', does:'Show him the rings.', hint:'let him see them first',
          then:[()=>{ S.rings = false; cue('pick'); note('💍 He takes them out of your hand.', 'bad'); hud(); }, ...LINES.handed], act:()=>ringsTaken(kai), end:true }
      ]},
      ['kai', 'I\'d change that attitude.'],
      ['robin', 'Not making friends here, are we?'],
      ['kai', 'A word of advice.'],
      { wait:1.1, act:()=>envelope(kai) },
      { lines:()=>me.hood ? LINES.deal3.slice(0, 1) : LINES.deal3Bare.slice(0, 2) },
      { ask:[
        { icon:'💍', say:'Yeah, yeah. Thank you for your business.', hint:'toss him the rings', act:()=>{ if(dealT) dealT.stage = 'toss'; tossRings(); } },
        { icon:'🏃', does:'Keep the rings. Walk away with the money.', hint:'he will come after you', act:()=>runWithIt(kai) }
      ]}
    ], { npc:kai });
    if(!ok){ dealT = null; kai.state = 'wait'; S.flags.dealStarted = false; }
    else mark('deal');
  }
  function tickDeal(dt, kai){
    if(!kai || kai.gone){ dealT = null; if(cv) endConvo(); }
  }
  function envelope(kai){
    if(dealT) dealT.stage = 'env';
    // the envelope is thrown, and caught
    const from = V(kai.x, kai.y + 1.4, kai.z), to = V(G.pos.x, feet() + 1.2, G.pos.z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.12), new THREE.MeshStandardMaterial({ color:0xd8c89a, roughness:0.7 })); W.cityGroup.add(m);
    tween(0.55, k=>{ m.position.set(lerp(from.x, to.x, k), lerp(from.y, to.y, k) + Math.sin(k*Math.PI)*0.8, lerp(from.z, to.z, k)); m.rotation.y = k*9; }, ()=>{
      W.cityGroup.remove(m); S.cash = 3000; S.trail.tracker = 'on'; cue('pick'); note('✉ The envelope. It feels about right.'); hud();
      if(!me.hood){ S.trail.kaiSawFace = true; expose(10, 'Kai saw your face'); }
    });
  }
  function tossRings(){
    const kai = find('kai'); if(!kai || !dealT || dealT.stage !== 'toss') return;
    dealT = null; S.rings = false;
    const from = V(G.pos.x, feet() + 1.4, G.pos.z), to = V(kai.x, kai.y + 1.8, kai.z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14), new THREE.MeshStandardMaterial({ color:0x2a2a2a, roughness:0.5 })); W.cityGroup.add(m);
    kai.state = 'catch';
    cue('ui');
    tween(1.9, k=>{ m.position.set(lerp(from.x, to.x, k), lerp(from.y, to.y, k) + Math.sin(k*Math.PI)*7.5, lerp(from.z, to.z, k)); m.rotation.x = k*14; }, ()=>{
      W.cityGroup.remove(m);
      kai.yaw += Math.PI*0.9;                       // he turns round…
      kai.state = 'search'; kai.searchT = 9; kai.aware = 0;
      // …and when you are gone, the can gets it
      later(()=>{ if(!on || kai.gone || kai.state !== 'search' || kai.sees) return; kickCan(kai); }, 1600);
    });
    outcome('paid');
  }
  /* the rings before the money: he pockets them and walks back to his crew */
  function ringsTaken(kai){
    dealT = null; S.rings = false;
    if(kai.gone) return;
    kai.state = 'rob'; kai.aware = 0; kai.band = 'unaware';
    outcome('robbed');
  }
  /* the money and not the rings: a heartbeat while it sinks in, then he runs */
  function runWithIt(kai){
    dealT = null;
    endConvo();
    note('🏃 Run.', 'big');
    bark(kai, '…Hey.');
    later(()=>{ if(!on || kai.gone) return; walkedOff(kai); }, 1000);
  }
  function kickCan(kai){
    if(!dropCan) return;
    cue('kick'); bark(kai, '!!');
    const from = dropCan.position.clone();
    tween(0.6, k=>{ dropCan.position.set(from.x + k*1.6, 0.4 + Math.sin(k*Math.PI)*0.6, from.z + k*0.8); dropCan.rotation.z = k*1.6; dropCan.scale.set(1, 1 - k*0.18, 1 + k*0.1); });
    noise(from.x, from.z, 14, 'kick');
  }
  function walkedOff(kai){
    talk('walkoff');
    kai.state = 'pursue'; kai.fallback = 'hunt'; kai.aware = 1.1;
    S.flags.stiffed = true;
    outcome('stiffed');
  }
  function leaveInMailbox(){
    S.flags.dropLeft = true; S.rings = false; cue('pick');
    mark('drop');
    talk('dropSent', ()=>later(()=>{ if(on) talk('dropReply'); }, 1500));
    outcome('dropped');
    const kai = find('kai'); if(kai && kai.state !== 'offstage') kaiToDrop(kai);
  }
  function takeFromMailbox(){
    S.flags.dropCash = false; S.cash = 3000; S.trail.tracker = 'on'; cue('pick'); note('✉ The envelope. Nobody saw — you think.'); hud();
    outcome('retrieved');
  }
  function liftEnvelope(kai){
    S.cash = 3000; S.trail.tracker = 'on'; S.flags.lifted = true; cue('pick'); note('✉ Lifted. He never felt a thing.'); hud();
    outcome('recovered');
  }
  /* the pieces of the deal that are things you walk up to */
  function wireQuestThings(){
    const m = W.spots.drop;
    thing(m[0], m[1], 0, 'Leave the rings in the mailbox', ()=>leaveInMailbox(), { icon:'📬', r:1.6,
      when:()=>S.step==='deal' && S.rings && !S.flags.dealStarted && !dealT });
    thing(m[0], m[1], 0, 'Take the envelope', ()=>takeFromMailbox(), { icon:'✉', r:1.6, when:()=>S.step==='drop' && S.flags.dropCash });
    const meet = thing(0, 0, 0, 'Talk to the buyer', ()=>{ const k = find('kai'); if(k) dealBegin(k); }, { icon:'💬', r:4, when:()=>{
      const k = find('kai'); if(S.step !== 'deal' || !k || k.state !== 'wait' || dealT || !S.rings) return false; meet.x = k.x; meet.z = k.z; return true; } });
    const lift = thing(0, 0, 0, 'Lift the envelope', ()=>liftEnvelope(find('kai')), { icon:'🤏', r:1.6, when:()=>{
      const k = find('kai'); if(S.step !== 'robbed' || !k || k.state !== 'rob' || k.aware >= 0.62 || k.stun > 0) return false;
      const behind = Math.abs(angDiff(angTo(k.x, k.z, G.pos.x, G.pos.z), k.yaw)) > 2.0; if(!behind) return false;
      lift.x = k.x; lift.z = k.z; return true; } });
    const drop = thing(0, 0, 0, 'Pick up the envelope', ()=>{ S.flags.envDropped = null; liftEnvelope(); }, { icon:'✉', r:1.5, when:()=>{ const e = S.flags.envDropped; if(!e) return false; drop.x = e[0]; drop.z = e[1]; return true; } });
    const plant = thing(0, 0, 0, 'Plant the tracker on the truck', ()=>{ S.trail.tracker = 'planted'; plantOn.tracker = true; cue('pick'); note('📡 The tracker is riding a delivery truck now. Enjoy the tour, whoever you are.', 'big'); hud(); },
      { icon:'📡', r:3.4, when:()=>{ if(!(S.trail.trackerFound && S.trail.tracker === 'on') || inside) return false;
        const t = trucks.find(t=>Math.hypot(t.x - G.pos.x, t.z - G.pos.z) < 4.5); if(!t) return false; plantOn = t; plant.x = t.x; plant.z = t.z; return true; } });
    // the flat
    const s = W.spots, a = W.apt;
    thing(s.lamp[0], s.lamp[1] + 0.9, 0, ()=>apt.lamp ? 'Lamp off' : 'Turn on the lamp', ()=>{ apt.lamp = !apt.lamp; cue('ui'); aptLights(); questEvent('lamp'); }, { icon:'💡', r:1.8, when:()=>inside && !['chair'].includes(S.step) });
    thing(s.aptSwitch[0], s.aptSwitch[1], 0, ()=>(apt.lamp||apt.ceiling) ? 'Kill the lights' : 'Lights on', ()=>{ const off = apt.lamp || apt.ceiling; apt.lamp = !off; apt.ceiling = !off; cue('ui'); aptLights(); if(off) questEvent('dark'); }, { icon:'🔌', r:1.4, when:()=>inside && S.step !== 'chair' });
    thing(s.photo[0], s.photo[1], 0, ()=>S.trail.photo==='up' ? 'Turn the photo face down' : 'Take the photo out of the frame', ()=>{
      if(S.trail.photo === 'up'){ S.trail.photo = 'down'; cue('ui'); note('🖼 Face down. You and your mother, out of sight.'); }
      else { S.trail.photo = 'pocket'; cue('pick'); note('🖼 In your pocket. The frame is empty.'); }
      questEvent('photo'); photoMesh(); }, { icon:'🖼', r:1.5, when:()=>inside && ['up','down'].includes(S.trail.photo) && S.step !== 'chair' });
    thing(s.bench[0], s.bench[1], 0, ()=>!S.flags.cutter ? 'Take the cutter' : 'Take a spare charge', ()=>{
      if(!S.flags.cutter){ S.flags.cutter = true; note('✂ The cutter, in your sleeve.'); } else { S.flags.spare = true; S.flash = Math.min(4, S.flash+1); note('✋ A spare charge for the bangles.'); }
      cue('pick'); questEvent('bench'); hud(); }, { icon:'🧰', r:1.7, when:()=>inside && S.step !== 'chair' && S.step !== 'wake' && (!S.flags.cutter || !S.flags.spare) });
    thing(s.aptWindow[0], s.aptWindow[1], 0, 'Out the window', ()=>aptExit('window'), { icon:'🪟', r:1.6, when:()=>inside && S.step !== 'chair' });
    thing(s.aptDoor[0], s.aptDoor[1], 0, 'Out the door', ()=>aptExit('door'), { icon:'🚪', r:1.6, when:()=>inside && S.step !== 'chair' });
  }
  let plantOn = null;

  /* ------------------------------------------- the screens, and the roof
     THE NEWS (storyboard: 'news', then 'roof'). Robin steps out of Dragon
     Alley with the deal behind her, and every screen on Neon Avenue cuts
     from the adverts to a WFC press briefing: her mother, the Director,
     telling the city that wearables like the ones on Robin's wrists are
     off its streets. The camera finds the nearest screen, then Robin
     under it — and then, MATCH CUT, Robin through a pair of binoculars,
     and the roof those binoculars are on. When it is over the checkpoint
     is up on the avenue: the security operations she was talking about. */
  function newsScene(){
    flushTalk();                                    // nothing from the scene before talks over this one
    screensMode('news', 9999);
    cue('phone');
    const p = V(G.pos.x, feet(), G.pos.z);
    const scr = W.screens.slice().sort((a, b)=>Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    const nx = Math.sin(scr.ry), nz = Math.cos(scr.ry);
    // Robin turns to the screen
    const face_ = angTo(p.x, p.z, scr.x, scr.z); G.yaw = face_ + Math.PI;
    if(window.AVATAR) AVATAR.update(0, false, false, true);          // a cutscene does not turn the body: turn it now
    const rx = p.x + Math.sin(face_)*2.4 + Math.cos(face_)*0.8, rz = p.z + Math.cos(face_)*2.4 - Math.sin(face_)*0.8;
    const shots = [
      { cam:[scr.x + nx*16, 1.7, scr.z + nz*16], look:[scr.x, scr.y, scr.z], cam2:[scr.x + nx*12, 2.2, scr.z + nz*12], lines:LINES.news, act:()=>{ S.flags.speechNow = true; } },
      { cam:[rx, p.y + 1.0, rz], look:[p.x, p.y + 1.6, p.z], cam2:[rx, p.y + 0.9, rz], lines:LINES.newsRobin, act:()=>{ if(window.AVATAR) AVATAR.posture(null); } }
    ];
    roofCut(shots);
  }
  /* MATCH CUT: Robin walking away, through a pair of binoculars — and then
     the roof those binoculars are on. What Maya says there depends on
     what happened in the alley, and what her tracker says. */
  function roofCut(before){
    mark('roof');
    const maya = find('maya'), m = W.spots.maya;
    let kai = find('kai');
    const tailing = kai && kai.state === 'tail';
    // he is on the roof with her for this, unless he is out following you: the one in the street goes
    if(kai && !tailing){ despawn(kai); kai = null; }
    const path = S.dealPath;
    let lines = [];
    if(tailing){ lines = lines.concat(LINES.tail); }
    else {
      lines = lines.concat(LINES.roof);
      if(path.includes('noshow') || path.includes('confiscated')) lines = lines.concat(LINES.roofNoShow);
      else if(path.includes('stiffed')) lines = lines.concat(LINES.roofStiffed);
      else if(path.includes('recovered')) lines = lines.concat([['maya','The merchandise.'], ['kai','Two rings, and—'], ['kai','…where\'s the envelope?'], ['maya','She took it back. Out of your pocket.'], ['maya','Put it on.'], ['maya','Minimal force, and only on my mark. Are we clear?']]);
      else if(path.includes('robbed') || path.includes('gaveup')) lines = lines.concat(LINES.roofRobbed);
      else lines = lines.concat(LINES.roofPaid);
    }
    const tr = S.trail.tracker;
    if(tr === 'on') lines = lines.concat(LINES.trkOn); else if(tr === 'planted') lines = lines.concat(LINES.trkPlanted); else if(tr === 'crushed') lines = lines.concat(LINES.trkCrushed);
    if(S.trail.scouted) lines = lines.concat(LINES.roofScout);
    // a Kai for the scene, if he is not out following you
    let actor = null;
    if(!tailing){ actor = spawn('kai', 'kofi', m[0] + 2.2, m[1] + 2.4, { y:m[2], name:'kaiRoof', state:'cut', yaw:Math.PI*0.8 }); }
    if(maya){ maya.state = 'cut'; }
    const eye = V(m[0], m[2] + 1.62, m[1] - 0.3), me_ = V(G.pos.x, feet() + 1.2, G.pos.z);
    cutscene([
      ...(before || []),
      { cam:[eye.x, eye.y, eye.z], look:[me_.x, me_.y, me_.z], dur:2.8, bino:true, fov:14, act:()=>screensMode('ad', 0) },
      { cam:[m[0] - 4.5, m[2] + 2.4, m[1] + 5], look:[m[0] + 0.8, m[2] + 1.4, m[1] + 0.6], cam2:[m[0] - 3.2, m[2] + 1.9, m[1] + 4.2], lines,
        act:()=>{ if(maya){ maya.yaw = 0.4; } if(actor){ actor.yaw = Math.PI + 0.6; } },
        onLine:(i, who, text)=>{ const sp = who === 'maya' ? maya : who === 'kai' ? actor : null; [maya, actor].forEach(n=>{ if(n) n.talking = n === sp; });
          if(text === 'Put it on.' && maya) later(()=>{ if(on) aura(maya); }, 900); } }
    ], ()=>{
      if(actor) despawn(actor);
      if(maya) despawn(maya);
      if(glintMesh) glintMesh.visible = false;
      outcome('watched');                           // → home; the checkpoint goes up with it
      note('🚧 WFC has closed Neon Avenue east of Market Street.', 'big');
    });
  }
  /* the ring on Maya's hand: her body glows, lightly */
  function aura(n){
    const s = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 14), new THREE.MeshBasicMaterial({ color:new THREE.Color(0.8, 1.6, 2.6), transparent:true, opacity:0.0, depthWrite:false, blending:THREE.AdditiveBlending }));
    s.position.set(n.x, n.y + 1.0, n.z); s.scale.set(0.55, 0.95, 0.55); (n.inApt ? W.aptGroup : W.cityGroup).add(s);
    tween(2.4, k=>{ s.material.opacity = Math.sin(k*Math.PI)*0.35; s.position.set(n.x, n.y + 1.0, n.z); }, ()=>{ s.parent && s.parent.remove(s); });
  }

  /* ================================================================ home */
  function homeDoor(fromWindow){
    if(mode) return;
    if(S.step !== 'home') return;
    const watched = npcs.some(n=>n.kind === 'wfc' && n.sees && S.heat > 0) || drones.some(d=>d.state === 'track' && d.inBeam);
    if(watched){ note('Not with WFC watching you. They\'d see which door.', 'bad'); cue('fail'); return; }
    const kai = find('kai');
    if(kai && kai.state === 'tail' && kai.sees) S.trail.kaiTail = true;
    if(S.heat > 0){ S.heat = 0; note('☆ Inside. The heat stays on the street.'); }
    outcome('home');                                                       // → apt
    if(S.step !== 'apt') return;
    goInside(false, fromWindow);
  }
  const apt = { lamp:false, ceiling:false, mode:null, t:0, maya:null, kai:null, stage:null, sus:0, talked:[], exitVia:null };
  let aptSrc = null;
  function aptSources(){
    if(!aptSrc){ const L = W.aptLights; aptSrc = Object.fromEntries(Object.entries(L).map(([k, v])=>[k, { x:v[0], y:v[1], z:v[2], col:new THREE.Color(v[3]), k:v[4], d:v[5], mul:0 }])); }
    Object.keys(aptSrc).forEach(k=>{ aptSrc[k].mul = k === 'lamp' ? (apt.lamp ? 1 : 0) : k === 'ceiling' ? (apt.ceiling ? 1 : 0) : 1; });
    return Object.values(aptSrc);
  }
  function aptLights(){ lightT = 0; }
  function goInside(resume, fromWindow){
    fade(()=>{
      inside = true;
      W.cityGroup.visible = false; W.aptGroup.visible = true;
      G.ceiling = ()=>W.apt.h; G.scene.fog.density = 0.004;
      G.scene.background = new THREE.Color(0x020404);
      muffle(true);
      const a = W.apt, s = W.spots;
      if(fromWindow) placePlayer(s.aptWindow[0] + 0.6, s.aptWindow[1], -Math.PI/2);
      else placePlayer(s.aptDoor[0], s.aptDoor[1] - 0.8, 0);
      apt.lamp = false; apt.ceiling = false; aptLights();
      photoMesh();
      // she is wearing the shoes, the jacket and the backpack now: they are not where they were in the opening
      W.aptGroup.traverse(o=>{ if(o.userData.boot || o.userData.pack) o.visible = S.step === 'wake'; });
      if(W.room && W.room.form) W.room.form.jacket.visible = S.step === 'wake';
      aptBegin(resume);
    });
  }
  function goOutside(where){
    inside = false;
    W.cityGroup.visible = true; W.aptGroup.visible = false;
    G.ceiling = streetLid; G.scene.fog.density = 0.0155; G.scene.background = new THREE.Color(0x0b2a26);
    muffle(false);
    const s = W.spots;
    if(where === 'window'){ const w = s.homeWindow; placePlayer(w[0] - 0.3, w[1] + 1.2, Math.PI/2, w[2] + EYE_); }
    else placePlayer(s.home[0] - 7, s.home[1] + 3.5, Math.PI/2);
    lightT = 0;
  }
  /* The photo on the shelf: a frame with a picture in it, standing up,
     face down, or empty. */
  let photo = null;
  function photoMesh(){
    if(photo && photo.parent) photo.parent.remove(photo);
    const at = W.photoAt; photo = new THREE.Group(); photo.position.copy(at); W.aptGroup.add(photo);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.22), new THREE.MeshStandardMaterial({ color:0x2a1a10, roughness:0.5 })); photo.add(frame);
    if(S.trail.photo !== 'pocket' && S.trail.photo !== 'taken'){
      const c = LOOK.cv(128, 160), x = c.getContext('2d'); x.fillStyle = '#cfe0d8'; x.fillRect(0,0,128,160);
      x.fillStyle = '#6a8a80'; x.fillRect(0,110,128,50);
      x.fillStyle = '#2a2a2a'; x.beginPath(); x.arc(42, 62, 18, 0, 7); x.fill(); x.fillRect(22, 80, 40, 60);   // the mother
      x.fillStyle = '#e8c890'; x.beginPath(); x.arc(84, 86, 13, 0, 7); x.fill(); x.fillStyle = '#6a3a8a'; x.fillRect(70, 100, 28, 40); // the girl
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.24), new THREE.MeshStandardMaterial({ map:LOOK.tex(c), roughness:0.4 }));
      pic.position.set(0.022, 0, 0); pic.rotation.y = Math.PI/2; photo.add(pic);
    }
    if(S.trail.photo === 'up'){ photo.rotation.z = -0.18; photo.position.y = at.y + 0.02; }
    else if(S.trail.photo === 'down'){ photo.rotation.z = -Math.PI/2; photo.position.y = at.y - 0.12; photo.position.x = at.x + 0.12; }
    else { photo.rotation.z = -0.18; }
  }

  /* THE FLAT. Two ways in for Maya, from tshai.js arrival():
     AMBUSH — she followed you here, and she is already in the dark when
       you open the door. The voicemail plays; she speaks from the corner
       when the lamp goes on.
     KNOCK — she had to find out where you live. The voicemail plays, and
       the lamp in your window is what tells her which flat is yours: a
       few seconds after it goes on, the knock, and her voice through the
       door. Leave it off and she finds the door anyway, in her own time.
     Nothing in here talks over anything else: the voicemail is a scene,
     Maya is the next one, and she waits for it to finish.
     Either way the conversation is George's, you can move all through
     it, and it ends with Kai in the doorway — unless you end it first. */
  function aptBegin(resume){
    const how = AI.arrival(S.trail);
    apt.mode = how.how; apt.t = 0; apt.stage = 'arrive'; apt.sus = 0; apt.exitVia = null;
    S.flags.arrival = how.how; S.flags.arrivalBy = how.by;
    ['mayaApt','kaiApt'].forEach(k=>{ const n = find(k); if(n) despawn(n); });
    const a = W.apt;
    apt.maya = spawn('maya', 'sable', a.x1 + 1.1, a.z1 + 1.3, { inApt:true, name:'mayaApt', state:how.how === 'ambush' ? 'hidden' : 'hidden', yaw:Math.PI*0.75 });
    apt.kai = spawn('kai', 'kofi', W.spots.aptDoor[0], a.z2 + 1.4, { inApt:true, name:'kaiApt', state:'offstage' });
    setObjective(how.how === 'ambush' ? 'Home. Finally.' : 'Home. Lie low.', how.how === 'ambush' ? ['Turn on the lamp (E).'] :
      ['Somebody could come looking. Get ready.', 'Hide the photo. Take what you need from the bench.', 'The switch by the door kills every light.', 'The window opens onto the fire escape.']);
    apt.lampT = 0;
    later(()=>{ if(on && inside) scene('voicemail', ()=>{ phoneCard('Voicemail', 'COUNSELOR'); talk('voicemail'); }); }, resume ? 400 : 1400);
    checkpointApt();
  }
  function checkpointApt(){ later(()=>{ if(on && inside) checkpoint(); }, 300); }
  function tickApt(dt){
    apt.t += dt;
    const maya = apt.maya, kai = apt.kai;
    // she sees the photo if it is standing up and she passes it
    if(maya && !maya.hidden && S.trail.photo === 'up' && Math.hypot(maya.x - W.photoAt.x, maya.z - W.photoAt.z) < 3.4) {
      if(!S.trail.mayaSawPhoto){ S.trail.mayaSawPhoto = true; }
    }
    if(apt.stage === 'arrive'){
      // the voicemail first, always; then whatever brings her in
      const lit = apt.lamp || apt.ceiling;
      apt.lampT = lit ? apt.lampT + dt : 0;
      const heard = S.seen.includes('voicemail') && talkQ.length === 0;
      const ready = heard && (apt.force || (apt.mode === 'ambush' ? (apt.lampT > 1.2 || apt.t > 28) : (apt.lampT > 4 || apt.t > 50)));
      if(ready && scene('maya', ()=>{}) ){
        apt.stage = 'enter';
        if(apt.mode === 'ambush'){ mayaEmerge(); }
        else knockAt();
      }
    }
    if(apt.stage === 'talk'){
      if(maya && maya.sees && apt.benchUse){ apt.benchUse = false; apt.sus += 0.55; talkNow('hands'); }
      if(apt.sus >= 1){ apt.stage = 'kai'; flushTalk(); talk('callKai', ()=>kaiIn()); }
    }
  }
  function mayaEmerge(){
    const m = apt.maya; m.hidden = false; m.state = 'talk';
    if(!me.hood) setHood(true);
    startConversation(LINES.apt0);
  }
  /* THE KNOCK. Her voice through the door — and it is your door, so what
     happens next is up to you. */
  function knockAt(){
    cue('door');
    const d = W.spots.aptDoor;
    const ok = convo([
      ...LINES.knock,
      { ask:()=>[
        { icon:'🚪', does:'Open the door.', hint:'let her say what she came to say', act:()=>{ endConvo(); mayaIn(true); } },
        { icon:'🤫', does:'Say nothing.', hint:'she knows you are in here', then:[['maya', 'Have it your way.']], act:()=>{ endConvo(); cue('door'); mayaIn(true); } },
        ...((apt.lamp || apt.ceiling) ? [{ icon:'🔌', does:'Kill the lights, and wait for her in the dark.', hint:'she walks in blind',
          act:()=>{ endConvo(); apt.lamp = false; apt.ceiling = false; aptLights(); cue('ui'); mayaIn(false); later(()=>{ if(on && inside) questEvent('dark'); }, 700); } }] : []),
        { icon:'🪟', does:'Out the window. Now.', hint:'before she is through the door', act:()=>{ endConvo(); aptExit('window'); } }
      ]}
    ], { look:[d[0], 1.5, d[1]] });
    if(!ok) mayaIn(true);
  }
  function mayaIn(talkTo){
    const maya = apt.maya; if(!on || !inside || !maya) return;
    cue('door'); maya.x = W.spots.aptDoor[0]; maya.z = W.spots.aptDoor[1]; maya.hidden = false; maya.state = 'talk';
    if(talkTo) startConversation();
  }
  /* MAYA'S PITCH, all of George's lines, at your pace. Every time it is
     Robin's turn to speak you can say what she says — or stop talking and
     do something: the switch, the window, the bangles, the cutter on the
     bench. Talk all the way to the end and Maya calls Kai in. */
  function startConversation(opener){
    apt.stage = 'talk';
    setObjective('Somebody is in your flat.', INFO.apt);
    const mom = () => AI.knowsMother(S.trail, S.exposure);
    // every line Robin has becomes her turn
    const turns = lines => lines.map(([who, text])=>who === 'robin' ? { ask:()=>[{ say:text }, ...aptMoves()] } : [who, text]);
    const ok = convo([
      ...(opener || []),
      ...turns(LINES.apt1),
      { lines:()=>LINES[mom() ? 'apt2Mom' : 'apt2'] },
      ()=>{ later(()=>{ if(on && apt.maya) aura(apt.maya); }, 1400); },
      ...turns(LINES.apt3),
      { lines:()=>LINES[mom() ? 'apt4Mom' : 'apt4'] },
      ...turns(LINES.apt5),
      ...LINES.callKai,
      ()=>{ endConvo(); if(!on || !inside) return; apt.stage = 'kai'; kaiIn(); }
    ], { npc:apt.maya });
    if(!ok){ apt.stage = 'kai'; kaiIn(); }
  }
  /* what Robin can do instead of answering */
  function aptMoves(){
    const m = [];
    if(apt.lamp || apt.ceiling) m.push({ icon:'🔌', does:'Lunge for the light switch.', hint:'in the dark nobody sees much', act:moveLights });
    m.push({ icon:'🪟', does:'Go for the window.', hint:'the fire escape — and she will send Kai after you', act:()=>{ endConvo(); aptExit('window'); } });
    if(S.flash > 0) m.push({ icon:'✋', does:'Flash her.', hint:`the bangles · ${S.flash} charge${S.flash > 1 ? 's' : ''} left`, act:()=>{ endConvo(); flash(); } });
    if(!S.flags.cutter) m.push({ icon:'🧰', does:'Palm the cutter off the bench.', hint:'in case this goes badly', act:movePalm, again:true });
    return m;
  }
  function moveLights(){
    endConvo();
    const s = W.spots.aptSwitch;
    fade(()=>{ placePlayer(s[0], s[1] - 0.8, 0); apt.lamp = false; apt.ceiling = false; aptLights(); cue('ui'); }, ()=>{ if(on && inside) questEvent('dark'); });
  }
  function movePalm(){
    S.flags.cutter = true; cue('pick'); hud();
    if(apt.lamp || apt.ceiling){
      apt.sus += 0.55; note('✂ The cutter, up your sleeve. She saw you move.', 'warn');
      return [['maya', 'Hands where I can see them.']];
    }
    note('✂ The cutter, up your sleeve. In the dark she didn\'t see a thing.');
  }
  function tickMayaApt(n, dt){
    const a = W.apt, s = W.spots, p = P();
    if(apt.stage === 'talk' || apt.stage === 'enter'){
      const pts = [[s.suitcase[0], s.suitcase[1]], [a.x1 + 1.3, a.z + 0.2], [s.bench[0] + 0.6, s.bench[1] + 0.3], [a.x + 0.5, a.z + 0.4]];
      n.wp = n.wp || 0; n.wpT = (n.wpT||6) - dt;
      if(n.wpT <= 0){ n.wp = (n.wp + 1) % pts.length; n.wpT = 7 + Math.random()*3; }
      const w = pts[n.wp];
      if(Math.hypot(w[0]-n.x, w[1]-n.z) > 0.4) stepTo(n, w[0], w[1], n.def.walk*0.8, dt);
      else { face(n, p.x, p.z, dt); n.clip = n.talking ? 'talk' : 'idle'; }
    } else { face(n, p.x, p.z, dt); n.clip = 'idle'; }
  }
  function kaiIn(){
    const k = apt.kai; if(!k || !inside) return;
    mark('kai');
    if(S.step === 'apt') outcome('kaiIn');
    apt.stage = 'escape';
    k.hidden = false; k.state = 'enter'; k.enterT = 1.6;
    k.x = W.spots.aptDoor[0]; k.z = W.spots.aptDoor[1] + 0.4; k.y = 0;
    cue('door'); bark(k, 'Evening.');
    setObjective(AI.QUEST.escape.goal, INFO.escape);
  }
  function tickKaiApt(n, dt){
    if(!dt || n.state === 'offstage') return;
    const p = P(), dark = !(apt.lamp || apt.ceiling);
    /* he fills the doorway for a moment before he comes for you: you
       spent the conversation standing still, and this is your second */
    if(n.state === 'enter'){ n.enterT = (n.enterT || 0) - dt; face(n, p.x, p.z, dt); n.clip = 'idle'; if(n.enterT <= 0) n.state = 'appr'; return; }
    if(n.state === 'appr'){
      // in the dark he goes to where he last saw you, slowly
      const tx = dark && n.lastSeen ? n.lastSeen[0] : p.x, tz = dark && n.lastSeen ? n.lastSeen[1] : p.z;
      stepTo(n, tx, tz, dark ? n.def.walk*0.9 : n.def.walk*1.7, dt);
      const d = Math.hypot(p.x - n.x, p.z - n.z);
      if(d < 1.2 && !mode && (!dark || d < 0.9)) grab(n);
    }
  }
  function aptExit(via){
    if(mode) return;
    // you are not getting out of this conversation by leaving before it starts
    if(apt.stage === 'arrive'){ apt.t = 999; apt.lamp = apt.lamp || false;
      if(apt.mode === 'ambush'){ mark('voicemail'); flushTalk(); talk([['maya','Leaving so soon?']]); } else note('Somebody is on the stairs.', 'warn');
      apt.stage = 'arrive'; apt.force = true; return; }
    const kai = apt.kai;
    if(via === 'door' && kai && !kai.hidden && kai.stun <= 0 && Math.hypot(kai.x - G.pos.x, kai.z - G.pos.z) < 3.5){ note('Kai is in the doorway.', 'bad'); if(!mode) grab(kai); return; }
    if(via === 'door' && apt.stage === 'talk'){
      // walking out mid-conversation: Kai is on the stairs
      flushTalk(); apt.stage = 'escape'; kaiIn(); later(()=>{ if(on && inside && !mode && apt.kai) grab(apt.kai); }, 500); return;
    }
    if(S.step === 'chair') return;
    apt.exitVia = via;
    const talking = ['talk','kai','enter','arrive'].includes(apt.stage) && apt.maya && !apt.maya.hidden;
    if(via === 'window' && talking) talkNow('window');
    const stunnedKai = kai && !kai.hidden && kai.stun > 0;
    fade(()=>{
      flushTalk();
      goOutside(via);
      // what the flat looks like behind you: Maya takes the photo if it is there
      if(S.trail.photo !== 'pocket' && apt.maya && !apt.maya.hidden){ S.trail.photo = 'taken'; }
      if(S.step === 'apt' || S.step === 'escape' || S.step === 'escape2'){ S.step = S.step === 'apt' ? 'escape' : S.step; outcome('out'); }
      else if(S.step !== 'out'){ S.step = 'out'; beatStart(false); }
      castForBeat();                      // Kai outside, hunting
      const k2 = find('kai');
      if(k2){ if(via === 'window'){ k2.x = 58; k2.z = 36; k2.state = 'pursue'; k2.fallback = 'hunt'; k2.lastSeen = [G.pos.x, G.pos.z, feet(), clock]; } else { k2.hidden = true; k2.state = 'offstage'; } }
      if(via === 'door' && (stunnedKai || apt.flashed) && !S.flags.chairDone) afterCut();
      else if(k2 && via !== 'window'){ k2.hidden = false; k2.state = 'hunt'; }
    });
  }
  /* THE AFTERMATH, from inside the flat: Kai up off the floor, Maya and
     her tracker, the frame on the shelf, the punch, the barrier, the ring
     under his heel. Then he storms out — onto the street, after you. */
  function afterCut(){
    mark('after');
    const a = W.apt, s = W.spots;
    const maya = apt.maya || spawn('maya', 'sable', a.x - 1, a.z, { inApt:true, name:'mayaApt', state:'talk' });
    const kai = apt.kai || spawn('kai', 'kofi', a.x + 1, a.z + 1, { inApt:true, name:'kaiApt', state:'talk' });
    [maya, kai].forEach(n=>{ n.hidden = false; n.state = 'cut'; n.stun = 0; });
    maya.x = W.photoAt.x + 0.7; maya.z = W.photoAt.z; maya.yaw = -Math.PI/2; kai.x = a.x + 1.4; kai.z = a.z + 1.2; kai.yaw = -2.4;
    let lines = LINES.after1.slice();
    const tr = S.trail.tracker;
    lines = lines.concat(tr === 'on' ? (S.flags.trackerJam > 0 || apt.flashed ? LINES.afterJam : [['maya','Still got her. For now.']]) : LINES.afterNone);
    lines = lines.concat(LINES.after2, LINES.after3);
    const wasIn = inside;
    W.aptGroup.visible = true;
    cutscene([
      { cam:[a.x + 3.5, 1.9, a.z + 2.8], look:[a.x - 1.5, 1.1, a.z - 0.5], cam2:[a.x + 3, 1.7, a.z + 2.2], lines, inside:true,
        onLine:(i, who, text)=>{ [maya, kai].forEach(n=>n.talking = (who === 'maya' ? maya : kai) === n);
          if(text === 'You won\'t find her.') photoMesh(); } },
      { cam:[a.x + 2.2, 1.6, a.z + 1.8], look:[kai.x - 0.5, 1.3, kai.z - 0.5], dur:2.2, inside:true, act:()=>{ punch(kai, maya); } },
      { cam:[a.x + 2.4, 1.5, a.z + 2.0], look:[maya.x, 1.2, maya.z], lines:LINES.barrier, inside:true },
      { cam:[a.x + 1.8, 1.2, a.z + 2.4], look:[kai.x, 0.2, kai.z], dur:2.6, inside:true, act:()=>{ stomp(kai); } }
    ], ()=>{
      W.aptGroup.visible = wasIn;
      despawn(maya); despawn(kai); apt.maya = null; apt.kai = null;
      /* he storms out after you — but that was a whole argument ago, and
         you did not stand on the doorstep listening to it */
      const k = find('kai');
      if(k){ k.hidden = true; k.state = 'offstage';
        later(()=>{ if(!on || k.gone) return; const h = W.spots.home; k.x = h[0]; k.z = h[1] + 1; k.hidden = false; k.state = 'hunt'; k.lastSeen = [h[0], h[1] + 4, 0, clock]; bark(k, 'YU!'); }, 9000); }
      S.flags.afterDone = true;
      setObjective(AI.QUEST.out.goal, INFO.out);
    });
  }
  function punch(kai, maya){
    kai.x = maya.x + 0.9; kai.z = maya.z + 0.4; kai.yaw = angTo(kai.x, kai.z, maya.x, maya.z);
    cue('punch'); aura(maya);
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ color:new THREE.Color(1.2, 2.4, 3.2), transparent:true, opacity:0.6, depthWrite:false, blending:THREE.AdditiveBlending }));
    s.position.set(lerp(kai.x, maya.x, 0.45), 1.45, lerp(kai.z, maya.z, 0.45)); W.aptGroup.add(s);
    tween(0.7, k=>{ s.scale.setScalar(0.3 + k*1.2); s.material.opacity = 0.6*(1-k); }, ()=>W.aptGroup.remove(s));
  }
  function stomp(kai){
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 8, 16), new THREE.MeshBasicMaterial({ color:new THREE.Color(1, 2.2, 2.4) }));
    ring.position.set(kai.x + 0.3, 0.05, kai.z); ring.rotation.x = Math.PI/2; W.aptGroup.add(ring);
    setTimeout(()=>{ cue('kick'); ring.scale.set(1.4, 1.4, 0.3); ring.material.color.setRGB(0.3, 0.5, 0.5); particle(ring.position.clone(), { color:0x8ff0ff, size:0.03, life:0.5, grav:6, v:V(0.5, 1.4, 0.2) }); }, 1200);
    setTimeout(()=>{ if(ring.parent) ring.parent.remove(ring); }, 2600);
  }

  /* ------------------------------------------------------- the struggle
     Somebody has hold of you. F (if the bangles have a charge) and you are
     out of it; otherwise hammer E and hope. Lose, and it is WFC's cell,
     Kai's grip, or a zip-tie to the radiator — the story carries on. */
  let gr = null;
  function grab(n){
    if(mode || !on) return;
    mode = 'grab'; G.running = false;
    gr = { n, t:1.9, mash:0 };
    n.state = 'grab';
    bark(n, n.kind === 'kai' ? pick(['Got you!', 'Not so fast.']) : 'Hold still!');
    cue('alert');
    showGrab(true);
  }
  function tickGrab(dt){
    const n = gr.n;
    gr.t -= dt; gr.mash = Math.max(0, gr.mash - dt*0.32);
    face(n, G.pos.x, G.pos.z, dt*3);
    if(window.AVATAR) AVATAR.update(dt, false, false, true);
    if(typeof thirdPerson === 'function') thirdPerson();
    paintGrab();
    if(gr.mash >= 1) breakFree(false);
    else if(gr.t <= 0) caught();
  }
  function breakFree(flashed){
    const n = gr.n; showGrab(false);
    mode = null; G.running = true;
    n.stun = Math.max(n.stun, flashed ? 4 : 1.6); n.state = n.kind === 'kai' ? (inside ? 'appr' : 'pursue') : 'pursue';
    if(n.kind === 'kai' && inside && flashed) apt.flashed = true;
    const a = angTo(n.x, n.z, G.pos.x, G.pos.z), nx = G.pos.x + Math.sin(a)*1.4, nz = G.pos.z + Math.cos(a)*1.4;
    if(!G.solids.some(s=>!s.off && nx > s.x1 && nx < s.x2 && nz > s.z1 && nz < s.z2 && feet() < s.y2 - 0.5 && feet() + 1.5 > s.y1)){ G.pos.x = nx; G.pos.z = nz; }
    if(n.kind === 'kai' && n.fallback === 'stakeout') n.fallback = 'hunt';
    gr = null;
  }
  function caught(){
    const n = gr.n; showGrab(false); gr = null; mode = null; G.running = true;
    cue('fail');
    if(n.kind === 'wfc') return detained(n);
    if(inside) return chair();
    // Kai on the street: he takes what he came for
    if(S.cash > 0){ S.cash = 0; if(S.trail.tracker === 'on') S.trail.tracker = 'returned'; note('✉ Kai took the envelope. "That\'s for the alley."', 'bad'); if(S.step === 'drop') S.dealPath.push('robbed'); }
    else if(S.rings){ S.rings = false; note('💍 Kai took the rings back. Fair, maybe.', 'bad'); }
    else note('Kai shoves you into the wall and walks off.', 'bad');
    n.state = 'leave'; n.dest = [-60, -48]; n.stun = 0; n.aware = 0;
    if(S.step === 'drop') outcome('robbed');
    hud();
  }
  function detained(n){
    fade(()=>{
      clearChase();
      S.trail.detained = (S.trail.detained||0) + 1;
      if(S.rings && S.step === 'deal'){ S.rings = false; outcome('confiscated'); note('💍 WFC confiscated the rings.', 'bad'); }
      if(S.cash > 0){ S.cash = 0; if(S.trail.tracker === 'on') S.trail.tracker = 'seized'; note('✉ WFC bagged the envelope as evidence.', 'bad'); }
      S.heat = 0; S.t += 25;
      expose(35, 'WFC booked you — and called your mother');
      placePlayer(22, -45.5, Math.PI);
      if(S.step === 'drop') outcome('gaveup');
      hud();
    });
  }
  function clearChase(){ npcs.forEach(o=>{ if(o.kind === 'wfc' && ['pursue','grab','search'].includes(o.state)){ o.state = 'return'; o.aware = 0; } if(o.kind === 'drone'){ o.state = 'patrol'; } }); lastKnown = null; }

  /* ------------------------------------------------------------ the chair
     Caught in your own flat: zip-tied to the radiator pipe by the window.
     What George wrote for after you had gone happens in front of you
     instead — and then Maya steps out to make a call. */
  const ch = { mash:0, last:null };
  function chair(){
    S.step = 'chair'; S.flags.chairDone = true; mark('chair');
    mode = 'chair'; G.running = false; ch.mash = 0; ch.last = null;
    const a = W.apt, s = W.spots;
    placePlayer(a.x1 + 0.5, a.z + 1.2, -Math.PI/2);
    if(S.trail.photo !== 'pocket') S.trail.photo = 'taken';
    photoMesh();
    const maya = apt.maya, kai = apt.kai;
    [maya, kai].forEach(n=>{ if(n){ n.hidden = false; n.state = 'cut'; n.stun = 0; } });
    if(maya){ maya.x = a.x - 0.5; maya.z = a.z - 0.2; }
    if(kai){ kai.x = a.x + 0.6; kai.z = a.z + 0.3; }
    setObjective(AI.QUEST.chair.goal, INFO.chair);
    showChair(true);
    const lines = LINES.chair3.slice();
    talk(lines, ()=>{
      if(!on) return;
      if(kai && maya) punch(kai, maya);
      later(()=>{ if(!on) return; talk('barrier', ()=>{ if(kai){ stomp(kai); later(()=>{ if(on && kai){ cue('door'); despawn(kai); apt.kai = null; const k = find('kai'); if(!k){ const h = W.spots.home; const kk = spawn('kai', 'kofi', h[0], h[1] + 1, { name:'kai', state:'hunt' }); kk.lastSeen = [h[0], h[1], 0, clock]; } } }, 2000); }
        later(()=>{ if(!on) return; talk('chairLeave', ()=>{ if(maya){ cue('door'); despawn(maya); apt.maya = null; } talk('chairCall'); }); }, 3200); }); }, 900);
    });
  }
  function tickChair(dt){
    ch.mash = Math.max(0, ch.mash - dt*0.06);
    if(window.AVATAR) AVATAR.update(dt, false, false, true);
    const a = W.apt;
    G.camera.position.lerp(V(a.x1 + 3.2, 2.0, a.z + 2.6), 0.08); G.camera.lookAt(a.x1 + 0.6, 1.0, a.z + 1.0);
    paintChair();
  }
  function chairKey(e){
    if((e.code === 'KeyA' || e.code === 'KeyD') && e.code !== ch.last){ ch.last = e.code; ch.mash += 0.07; cue('step'); if(ch.mash >= 1) freed(); return true; }
    if(e.code === 'KeyE' && S.flags.cutter){ freed(); return true; }
    return e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'KeyE';
  }
  function freed(){
    mode = null; G.running = true; showChair(false);
    cue('win'); note('Free. Your wrists will remember this.');
    S.step = 'escape2'; beatStart(false);
  }

  /* ========================================================== the ending
     Up high, nobody on you, the heat off: she takes off the mask, and the
     fear turns into something else. */
  let outT = 0;
  function tickOut(dt){
    const r = W.roofs.find(r=>r.high && G.pos.x > r.x1 && G.pos.x < r.x2 && G.pos.z > r.z1 && G.pos.z < r.z2 && Math.abs(feet() - r.h) < 0.6);
    const kai = find('kai');
    const chased = S.heat > 0 || (kai && !kai.gone && (kai.state === 'pursue' || (kai.sees && Math.hypot(kai.x-G.pos.x, kai.z-G.pos.z) < 30)));
    if(r && !chased){ outT += dt; if(outT > 0.6 && outT - dt <= 0.6) note('Catch your breath…'); if(outT > 3.2) ending(r); }
    else outT = 0;
  }
  function ending(r){
    if(mode) return;
    S.step = 'end'; mark('end');
    const tower = W.spots.tower, x = G.pos.x, z = G.pos.z, y = feet();
    const face_ = angTo(x, z, tower[0], tower[1]);
    G.yaw = face_ + Math.PI;                 // the body faces +z; the camera looks -z
    if(me.hood){ me.hood = false; dress(); }
    const bx = x - Math.sin(face_)*3.2, bz = z - Math.cos(face_)*3.2;
    const sx = x + Math.cos(face_)*2.6 + Math.sin(face_)*1.8, sz = z - Math.sin(face_)*2.6 + Math.cos(face_)*1.8;
    const tx = x + Math.sin(face_)*60, tz = z + Math.cos(face_)*60;
    envelopeInHand(S.cash > 0);
    cutscene([
      { cam:[sx, y + 1.7, sz], look:[x, y + 1.45, z], cam2:[sx*0.9 + x*0.1, y + 1.6, sz*0.9 + z*0.1], dur:3.4 },
      { cam:[sx, y + 1.6, sz], look:[x, y + 1.45, z], lines:LINES.laugh, act:()=>{ if(window.AVATAR) AVATAR.emote('talk2'); } },
      { cam:[bx, y + 1.9, bz], look:[tx, y + 8, tz], cam2:[bx - Math.sin(face_)*2.5, y + 3.2, bz - Math.cos(face_)*2.5], dur:6.5 }
    ], ()=>{ blackout(); }, { noSkipEnd:true });
  }
  function envelopeInHand(has){
    const body = AVATAR.body && AVATAR.body.children[0]; if(!body || !has) return;
    const hand = boneOf(body, /RightHand$/); if(!hand) return;
    const k = worldK(hand), m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.015), new THREE.MeshStandardMaterial({ color:0xd8c89a, roughness:0.7 }));
    m.scale.setScalar(k); m.position.set(0, 0.1*k, 0.04*k); hand.add(m);
    if(S.trail.tracker === 'on'){ const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color:new THREE.Color(6, 0.3, 0.2) })); led.position.set(0.06, -0.03, 0.01); m.add(led);
      tweenForever(t=>{ led.visible = (t*1.6|0) % 2 === 0; }); }
  }
  function tweenForever(f){ const t = { t:0, d:1e9, f:k=>f(clock), done:null }; tweens.push(t); }
  function blackout(){
    mode = 'end'; G.running = false;
    const b = el.querySelector('.tsh-black'); b.classList.add('on');
    b.innerHTML = '<div class="tsh-cut">CUT TO BLACK.</div>';
    const sting = AI.ending(S.trail, S), [head, body] = AI.STINGS[sting];
    later(()=>{ if(!on) return; b.innerHTML = `<div class="tsh-sting ${sting}"><i></i><b>${esc(head)}</b><p>${esc(body)}</p></div>`; cue(sting === 'clean' ? 'phone' : 'alert'); }, 2600);
    later(()=>{ if(on) results(sting); }, 8200);
  }
  function results(sting){
    S.done = true; S.runs = (S.runs||0) + 1;
    const lines = AI.summary(S);
    const partTwo = { maya: S.trail.photo === 'taken' || AI.knowsMother(S.trail, S.exposure) ? 'has leverage' : S.flags.arrival === 'knock' ? 'impressed' : 'curious',
                      kai: S.flags.chairDone ? 'caught you once' : 'holds a grudge', exposure:Math.round(S.exposure), sting, tracker:S.trail.tracker,
                      vendor:!!S.flags.helpedVendor, cash:S.cash };
    S.last = { lines, sting, partTwo };
    S.cp = null; S.pos = null;
    save();
    try{ if(window.PROGRESS) PROGRESS.set('tsh_part1', JSON.stringify(partTwo)); }catch(e){}
    let reward = null;
    try{ if(window.WALLET) reward = WALLET.award('TSH — Part One', 180, 120, 'tsh1'); }catch(e){}
    panel('results', `<div class="tsh-res">
        <div class="tsh-res-t">TSH</div><div class="tsh-res-s">PART ONE · WRITTEN BY GEORGE WANG</div>
        <ul>${lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>
        <div class="tsh-res-p"><b>Carried into Part Two</b>
          <span>Maya ${esc(partTwo.maya)}</span><span>Kai ${esc(partTwo.kai)}</span><span>Exposure ${partTwo.exposure}%</span>${partTwo.vendor ? '<span>The vendor owes you</span>' : ''}</div>
        <div class="tsh-res-b"><button data-a="again">↺ Play the night again</button><button data-a="wano">🌏 Back to Wano</button></div>
      </div>`, act=>{
        if(act === 'again'){ closePanel(); const runs = S.runs, last = S.last; S = fresh(); S.runs = runs; S.last = last; save(); stop(); enter(server); }
        if(act === 'wano'){ closePanel(); leave(); }
      }, true);
  }

  /* ----------------------------------------------------- quest events
     The systems say what happened; the story decides whether it matters. */
  function questEvent(name, d){
    if(name === 'flash'){
      const hit = d.hit || [];
      const kai = hit.find(n=>n.kind === 'kai');
      if(kai && kai.state === 'rob' && S.step === 'robbed'){ S.flags.envDropped = [kai.x + 0.6, kai.z]; kai.state = 'pursue'; kai.fallback = 'rob'; note('✉ He dropped the envelope!'); }
      if(kai && kai.inApt) apt.flashed = true;
      if(inside && ['talk','kai'].includes(apt.stage)){ apt.stage = 'escape'; flushTalk(); talkNow('dark'); kaiIn(); }
    }
    if(name === 'dark' && inside && ['talk','enter','kai'].includes(apt.stage) && apt.maya && !apt.maya.hidden){
      apt.stage = 'escape'; flushTalk(); talkNow('dark'); later(()=>{ if(on && inside) kaiIn(); }, 700);
    }
    if(name === 'bench' && inside && apt.stage === 'talk') apt.benchUse = true;
    if(name === 'photo' && inside && apt.maya && !apt.maya.hidden && apt.maya.sees && S.trail.photo !== 'up') S.trail.mayaSawPhoto = true;
    if(name === 'kaiSpot' && S.step === 'home'){ note('👁 Kai spotted you. He\'s following.', 'bad'); }
    if(name === 'kaiLost' && S.trail.kaiTail === false){ note('You lost Kai.'); }
    if(name === 'kaiGone' && S.step === 'robbed'){ note('Kai climbed up to his crew. The money went with him.', 'bad'); outcome('gaveup'); }
  }
  /* PLANET.enter() → TSH.stop(), so the pause card's HOME cannot leave the city running underneath Wano */
  function onHeat(h, was){
    // reinforcements from the post at three stars
    if(h >= AI.HEAT.reinforce && was < AI.HEAT.reinforce && !inside){
      [0, 1].forEach(i=>{ const o = spawn('wfc', ['walk-x','theo'][i], 22 + i*2, -46, { name:'rf'+i, state:'search' }); o.searchT = 30; o.lastSeen = lastKnown ? [lastKnown[0], lastKnown[1], 0, clock] : null; o.home = [22, -48]; o.leaving = true; o.base = 'return'; });
      note('📻 WFC: reinforcements are out of the post.');
    }
    if(h >= AI.HEAT.billboards && was < AI.HEAT.billboards) screensMode('alert', 9999);
    if(h < AI.HEAT.billboards && was >= AI.HEAT.billboards) screensMode('ad', 0);
  }
  function tickHeat(dt){
    heatSeenT += dt;
    if(S.heat > 0){
      const outside = !lastKnown || Math.hypot(G.pos.x - lastKnown[0], G.pos.z - lastKnown[1]) > AI.HEAT.radius(S.heat);
      const r = AI.cool(S.heat, heatSeenT, outside);
      if(r.reset){ heatSeenT = 0; heat(r.heat); if(r.heat === 0) clearChase(); }
    }
  }

  /* ============================================================ the voices
     EVERY SPOKEN LINE IS RECORDED: one ElevenLabs voice for each person
     in the night (tools/tsh-voices.mjs makes them; public/tshvoice.js
     lists what there is and how long each runs). A line is heard the
     moment it is shown — a subtitle coming up, a line of a conversation
     being typed, somebody shouting in the street — and the line before it
     stops. A recording is found by who says the line and exactly what
     they say, so a line edited here goes quiet until it is recorded again
     instead of playing the old words. Texts (📱) are read, not heard. The
     voicemail comes through a phone, the Director through the avenue's
     speakers, Maya on the stairs through a door. */
  const VOX = (window.TSHVOICE && TSHVOICE.lines) || {};
  function vkey(who, text){
    let h = 0x811c9dc5; const s = who + '|' + text;
    for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  const vbuf = new Map();
  function vload(k){
    if(vbuf.has(k)) return vbuf.get(k);
    const a = audio(); if(!a) return Promise.resolve(null);
    const pr = fetch('tsh/voice/' + k + '.mp3').then(r=>r.ok ? r.arrayBuffer() : null)
      .then(b=>b ? new Promise((ok, no)=>a.decodeAudioData(b, ok, no)) : null).catch(()=>null);
    vbuf.set(k, pr); return pr;
  }
  const vlen = (who, text) => VOX[vkey(who, text)] || 0;
  function vprefetch(lines){ (lines||[]).forEach(l=>{ if(Array.isArray(l) && typeof l[1] === 'string' && VOX[vkey(l[0], l[1])]) vload(vkey(l[0], l[1])); }); }
  let vnow = null;
  function vstop(){
    const v = vnow; vnow = null;
    if(!v || !v.src || !AC) return;
    try{ v.g.gain.setTargetAtTime(0, AC.currentTime, 0.03); v.src.stop(AC.currentTime + 0.15); }catch(e){}
  }
  function vfx(who, text){ return who === 'counselor' || who === 'buyer' ? 'phone' : who === 'mom' ? 'screen' : /^\(on the stairs\)/.test(text) ? 'door' : ''; }
  function voice(who, text, o){
    o = o || {};
    if(!o.bark) vstop();
    const k = vkey(who, text); if(!VOX[k]) return;
    const a = audio(); if(!a) return;
    if(a.state === 'suspended') a.resume();
    const mine = { k }; if(!o.bark) vnow = mine;
    vload(k).then(buf=>{
      if(!buf || !on || (!o.bark && vnow !== mine)) return;
      const src = a.createBufferSource(); src.buffer = buf;
      const g = a.createGain(); g.gain.value = o.vol === undefined ? 1 : o.vol;
      let head = src;
      const fx = vfx(who, text);
      if(fx === 'phone' || fx === 'door'){
        const f = a.createBiquadFilter(); f.type = fx === 'phone' ? 'bandpass' : 'lowpass';
        f.frequency.value = fx === 'phone' ? 1500 : 850; f.Q.value = fx === 'phone' ? 0.8 : 0.7; head.connect(f); head = f;
      }
      if(fx === 'screen'){                       // a big speaker on a building: thin, and a slap back off the far side of the avenue
        const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 240; head.connect(hp); head = hp;
        const d = a.createDelay(0.5), e = a.createGain(); d.delayTime.value = 0.14; e.gain.value = 0.25; head.connect(d); d.connect(e); e.connect(g);
      }
      head.connect(g); g.connect(a.destination);
      src.start();
      mine.src = src; mine.g = g;
    });
  }

  /* ============================================================ the talk
     Subtitles, the way a film has them: who is speaking, in their colour,
     at the bottom of the frame. These are the lines you OVERHEAR — the
     Director on the screens, a voicemail, a text, somebody shouting in
     the street — and they run on their own. A cutscene's lines are PACED:
     each one waits for SPACE (or E, or a click), and ENTER skips the
     scene. A conversation Robin is in is not subtitles at all: see
     convo() below. */
  let talkQ = [], sayOver = null;
  function talk(key, done, o){
    const lines = Array.isArray(key) ? key : (LINES[key] || []);
    vprefetch(lines);
    talkQ.push({ lines, i:-1, t:0, done, paced:!!(o && o.paced) });
  }
  function talkNow(key){
    const l = (LINES[key] || [])[0]; if(!l) return;
    sayOver = { who:l[0], text:l[1], t:Math.max(1.2 + l[1].length*0.045, vlen(l[0], l[1]) + 0.3) };
    voice(l[0], l[1]);
    const n = speakerNpc(l[0]); if(n) bark(n, '');
  }
  function flushTalk(){ const q = talkQ; talkQ = []; vstop(); q.forEach(x=>{ if(x.done) x.done(); }); subtitle(null); }
  function skipLine(){ const q = talkQ[0]; if(q){ q.t = 0; q.go = true; } }
  function speakerNpc(who){
    const k = who === 'kai' ? (inside ? apt.kai : find('kai') || find('kaiRoof')) : who === 'maya' ? (inside ? apt.maya : find('maya')) : null;
    return k && !k.gone ? k : null;
  }
  function tickTalk(dt){
    if(sayOver){ sayOver.t -= dt; subtitle(sayOver.who, sayOver.text); if(sayOver.t <= 0){ sayOver = null; subtitle(null); } return; }
    const q = talkQ[0]; if(!q){ subtitle(null); return; }
    if(q.paced && q.i >= 0){ if(!q.go) return; q.go = false; }   // a paced line stays up until you move it on
    else { q.t -= dt; if(q.t > 0) return; }
    q.i++;
    if(q.i >= q.lines.length){ talkQ.shift(); subtitle(null); if(q.done) q.done(); return; }
    const [who, text] = q.lines[q.i];
    const dur = vlen(who, text);
    q.t = dur ? Math.max(1.4, dur + 0.45) : Math.max(1.8, 1.0 + text.length*0.052);
    subtitle(who, text, q.paced);
    voice(who, text);
    [find('kai'), find('maya'), apt.kai, apt.maya, find('kaiRoof')].forEach(n=>{ if(n) n.talking = false; });
    const n = speakerNpc(who); if(n) n.talking = true;
    if(cut && cut.shot && cut.shot.onLine) cut.shot.onLine(q.i, who, text);
  }
  function subtitle(who, text, paced){
    const s = el && el.querySelector('#tshSub'); if(!s) return;
    if(!who){ if(s.dataset.on){ s.dataset.on = ''; s.classList.remove('on'); } return; }
    const key = who + text + (paced ? '·' : ''); if(s.dataset.on === key) return; s.dataset.on = key;
    const [name, col] = WHO[who] || [who.toUpperCase(), '#fff'];
    const phone = who === 'counselor' || who === 'buyer' || (who === 'mom' && !S.flags.speechNow) || text.indexOf('📱') === 0;
    s.innerHTML = `<b style="color:${col}">${phone && who !== 'counselor' ? '📱 ' : ''}${esc(name)}</b><span>${esc(text.replace(/^📱\s*/, ''))}</span>`
      + (paced ? '<em class="tsh-more"><kbd>Space</kbd> next · <kbd>Enter</kbd> skip scene</em>' : '');
    s.classList.add('on');
  }

  /* ========================================================== cutscenes
     A list of shots: where the camera is and what it looks at (and where
     it drifts to), how long, or which lines play over it. Letterboxed. */
  let cut = null;
  function cutscene(shots, done, o){
    if(mode === 'grab' || mode === 'chair') return done && done();
    if(mode === 'ride') unride();
    if(mode === 'hide') unhide();
    mode = 'cut'; G.running = false;
    cut = { shots, i:-1, t:0, done, o:o||{}, shot:null, fov:G.camera.fov };
    el.classList.add('cine');
    nextShot();
  }
  function nextShot(){
    const c = cut; c.i++;
    if(c.i >= c.shots.length) return endCut();
    const s = c.shot = c.shots[c.i]; c.t = 0; c.len = s.dur || 3;
    if(s.act) s.act();
    if(s.lines){ talk(s.lines, ()=>{ if(cut === c && c.shot === s) c.linesDone = true; }, { paced:true }); c.linesDone = false; }
    if(s.inside !== undefined){ W.aptGroup.visible = !!s.inside || inside; W.cityGroup.visible = !s.inside; }
    el.classList.toggle('bino', !!s.bino);
    G.camera.fov = s.fov || c.fov; G.camera.updateProjectionMatrix();
    G.camera.position.set(s.cam[0], s.cam[1], s.cam[2]); G.camera.lookAt(s.look[0], s.look[1], s.look[2]);
  }
  function tickCut(dt){
    const c = cut, s = c.shot; if(!s) return;
    c.t += dt;
    const k = s.lines ? Math.min(1, c.t/12) : Math.min(1, c.t/c.len);
    const from = V(s.cam[0], s.cam[1], s.cam[2]), to = s.cam2 ? V(s.cam2[0], s.cam2[1], s.cam2[2]) : from;
    G.camera.position.copy(from).lerp(to, k*k*(3-2*k));
    G.camera.lookAt(s.look[0], s.look[1], s.look[2]);
    if(window.AVATAR) AVATAR.tickClip(dt, false, false, true);
    if(s.lines ? (c.linesDone && c.t > 0.6) : c.t >= c.len) nextShot();
  }
  function endCut(){
    const c = cut; if(!c) return;
    cut = null;
    el.classList.remove('cine', 'bino');
    G.camera.fov = c.fov; G.camera.updateProjectionMatrix();
    if(inside){ W.aptGroup.visible = true; W.cityGroup.visible = false; } else { W.cityGroup.visible = true; W.aptGroup.visible = false; }
    if(mode === 'cut'){ mode = null; G.running = true; }
    letGoOfKeys();
    if(c.done) c.done();
  }
  function skipCut(){
    if(!cut || cut.o.noSkipEnd && cut.i >= cut.shots.length - 1) return;
    const c = cut;
    for(let i=c.i+1;i<c.shots.length;i++){ const s = c.shots[i]; if(s.act) try{ s.act(); }catch(e){} }
    flushTalk();
    c.i = c.shots.length; endCut();
  }

  /* ======================================================= conversations
     FACE TO FACE, YOU HAVE THE FLOOR. The deal in the alley and Maya in
     the flat used to run as subtitles on a timer while Robin stood about:
     the story read itself out. A conversation now holds the scene — the
     camera finds the two of them, every line waits for SPACE (or E, or a
     click), and at Robin's turns you choose. George's words are always
     the first choice; the others are what Robin could DO instead, and
     each one leads somewhere the night already knows how to go.

     A script is a list of steps:
       ['kai', 'text']          a line; it waits for you
       { ask:[…] | ()=>[…] }    Robin's turn: 1–5, arrows, or a click
       { lines:()=>[…] }        lines decided when they are reached
       { wait:secs, act }       something happens (an envelope in the air)
       fn                       something happens, and on we go; if it
                                returns a list of steps, they play next
     A choice is { say, does, icon, hint, then:[…], act, end }: `say` is
     Robin's line, spoken; `does` is an action, not spoken; `then` plays
     after it; `act` runs last; `end` drops the rest of the script;
     `again` asks the same question once more afterwards. A
     choice that leaves the scene at once (a flash, the window) calls
     endConvo() itself.

     While one runs the clock stands still and nobody's eyes gain on you:
     you cannot run from a drone while you are choosing what to say, so it
     does not get to choose for you. */
  let cv = null;
  function convo(steps, o){
    o = o || {};
    if(cv) endConvo();
    if(mode === 'ride') unride();
    if(mode === 'hide') unhide();
    if(mode) return false;                         // held, tied, or in a cut: not now
    flushTalk(); sayOver = null; subtitle(null);
    mode = 'talk'; G.running = false;
    cv = { steps:steps.slice(), i:-1, o, npc:o.npc || null, look:o.look || null, line:null, ctx:null, ask:null, sel:0, shown:0, hold:0,
           side:1, camP:G.camera.position.clone(), camL:null };
    vprefetch(steps.filter(Array.isArray));
    cv.side = convoSide();
    el.classList.add('talking');
    if(document.pointerLockElement) document.exitPointerLock();
    convoNext();
    return true;
  }
  function convoNext(){
    const c = cv;
    while(cv === c){
      if(c.line) c.ctx = c.line;
      c.i++; c.line = null; c.ask = null;
      if(c.i >= c.steps.length){ endConvo(); return; }
      const s = c.steps[c.i];
      if(typeof s === 'function'){ const more = s(); if(cv === c && Array.isArray(more)) c.steps.splice(c.i + 1, 0, ...more); continue; }
      if(Array.isArray(s)){ convoLine(s[0], s[1]); return; }
      if(s.lines){ c.steps.splice(c.i + 1, 0, ...s.lines()); continue; }
      if(s.ask){
        const list = (typeof s.ask === 'function' ? s.ask() : s.ask).filter(a=>!a.when || a.when());
        if(!list.length) continue;
        c.ask = list; c.sel = 0; c.askAt = clock; paintConvo(); return;
      }
      if(s.wait){ c.hold = s.wait; paintConvo(); if(s.act) s.act(); return; }
    }
  }
  function convoLine(who, text){
    const c = cv;
    c.line = { who, text }; c.shown = 0;
    const dur = vlen(who, text); c.cps = dur ? Math.max(14, text.length/Math.max(0.5, dur*0.85)) : 55;
    voice(who, text);
    [c.npc, find('kai'), apt.maya, apt.kai].forEach(n=>{ if(n) n.talking = false; });
    const n = who === 'robin' ? null : (speakerNpc(who) || c.npc);
    if(n) n.talking = true;
    paintConvo();
  }
  function convoPick(i){
    const c = cv; if(!c || !c.ask) return;
    const o = c.ask[i]; if(!o) return;
    cue('ui');
    const next = [];
    if(o.say) next.push(['robin', o.say]);
    if(o.then) next.push(...o.then);
    if(o.act) next.push(o.act);
    if(o.again) next.push(c.steps[c.i]);                // a side-step: then it is still your turn
    c.steps.splice(c.i + 1, 0, ...next);
    if(o.end) c.steps.length = c.i + 1 + next.length;   // and that is the end of the scene
    c.ask = null; c.ctx = null;
    convoNext();
  }
  function convoAdvance(){
    const c = cv; if(!c) return;
    if(c.ask){ if(clock - c.askAt > 0.4) convoPick(c.sel); return; }
    if(c.hold > 0) return;
    if(c.line && c.shown < c.line.text.length){ c.shown = c.line.text.length; paintText(); return; }
    convoNext();
  }
  function endConvo(){
    const c = cv; if(!c) return;
    cv = null;
    if(el){ el.classList.remove('talking'); const t = el.querySelector('#tshTalk'); t.classList.remove('on'); t.innerHTML = ''; }
    [c.npc, find('kai'), apt.maya, apt.kai].forEach(n=>{ if(n) n.talking = false; });
    if(mode === 'talk'){ mode = null; G.running = true; }
    letGoOfKeys();
    if(!busy && on) lockPointer($('#view'));
    if(c.o.done) c.o.done();
  }
  /* The key that ends a scene is still down when the world starts again:
     SPACE for "next" was also a jump, E for "next" a door. Forget them. */
  function letGoOfKeys(){ if(G.keys) Object.keys(G.keys).forEach(k=>{ G.keys[k] = false; }); }
  function tickConvo(dt){
    const c = cv; if(!c) return;
    if(c.hold > 0){ c.hold -= dt; if(c.hold <= 0){ c.hold = 0; convoNext(); if(cv !== c) return; } }
    if(c.line && c.shown < c.line.text.length){ c.shown = Math.min(c.line.text.length, c.shown + dt*(c.cps||55)); paintText(); }
    // Robin turns to whoever she is talking to, and the camera finds them both
    const n = c.npc && !c.npc.gone && !c.npc.hidden ? c.npc : null;
    const tx = n ? n.x : c.look ? c.look[0] : null, tz = n ? n.z : c.look ? c.look[2] : null;
    if(tx !== null){ const a = angTo(G.pos.x, G.pos.z, tx, tz); G.yaw += angDiff(a + Math.PI, G.yaw)*Math.min(1, dt*6); }
    if(window.AVATAR) AVATAR.update(dt, false, false, true);
    convoCam(dt, n);
  }
  /* THE SHOT: over Robin's shoulder on whoever is talking to her, and
     over theirs on her when it is her line — shot, reverse shot, the way
     every film does two people talking. It glides between the two, stays
     on one side of the line between them, and is kept out of walls and
     under whatever hangs over the alley. */
  function convoEye(c, n, robinTalks, side){
    const fy = feet(), R = V(G.pos.x, fy, G.pos.z);
    const T = n ? V(n.x, n.y, n.z) : c.look ? V(c.look[0], fy, c.look[2]) : R.clone().add(V(-Math.sin(G.yaw), 0, -Math.cos(G.yaw)).multiplyScalar(3));
    const d = V(T.x - R.x, 0, T.z - R.z), dist = Math.max(0.6, d.length()); d.normalize();
    const sv = V(d.z, 0, -d.x).multiplyScalar(side), back = 1.8 + Math.min(1.4, dist*0.2);
    const rh = V(R.x, fy + 1.5, R.z), th = V(T.x, (n ? n.y : fy) + (n ? 1.5 : 1.3), T.z);
    let eye, at;
    if(robinTalks){ eye = th.clone().addScaledVector(d, back).addScaledVector(sv, 0.95); eye.y = th.y + 0.3; at = rh.clone().lerp(th, 0.2); eye = camClear(th, eye); }
    else { eye = rh.clone().addScaledVector(d, -back).addScaledVector(sv, 1.15); eye.y = fy + 1.95; at = th.clone().lerp(rh, 0.25); eye = camClear(rh, eye); }
    at.y -= 0.35;                 // heads in the top half: the words sit in the bottom one
    return { eye, at };
  }
  function convoSide(){
    const c = cv, n = c.npc;
    const a = convoEye(c, n, false, 1).eye, b = convoEye(c, n, false, -1).eye, h = V(G.pos.x, G.pos.y, G.pos.z);
    return a.distanceTo(h) >= b.distanceTo(h) - 0.05 ? 1 : -1;
  }
  function convoCam(dt, n){
    const c = cv, robinTalks = !!(c.line && c.line.who === 'robin' && n);
    const { eye, at } = convoEye(c, n, robinTalks, c.side);
    const k = 1 - Math.exp(-dt*3.2);
    if(!c.camL){ c.camL = G.camera.position.clone().add(V(-Math.sin(G.yaw), 0, -Math.cos(G.yaw)).multiplyScalar(6)); c.camL.y = G.pos.y; }
    // from her shoulder to his is a CUT: a glide between the two goes straight through them both
    if(c.shot !== undefined && c.shot !== robinTalks){ c.camP.copy(eye); c.camL.copy(at); }
    c.shot = robinTalks;
    c.camP.lerp(eye, k);
    c.camL.lerp(at, k);
    G.camera.position.copy(c.camP); G.camera.lookAt(c.camL);
  }
  /* pull a camera back towards `from` until nothing solid is between them */
  function camClear(from, to){
    const p = to.clone();
    for(let i=1;i<=10;i++){
      const k = i/10, x = lerp(from.x, to.x, k), z = lerp(from.z, to.z, k);
      if(G.solids.some(s=>!s.off && (s.y1 === undefined || (p.y > s.y1 && p.y < s.y2)) && x > s.x1 - 0.3 && x < s.x2 + 0.3 && z > s.z1 - 0.3 && z < s.z2 + 0.3)){
        const kk = Math.max(0, (i - 1.6)/10); p.x = lerp(from.x, to.x, kk); p.z = lerp(from.z, to.z, kk); break;
      }
    }
    if(G.ceiling){ const lid = G.ceiling(p.x, p.z, feet()); if(lid < Infinity) p.y = Math.min(p.y, Math.max(feet() + 1.2, lid - 0.35)); }
    // and not with a lantern or a sign against the lens, or between the lens and who it is looking at
    const L = !inside && W && W.lens;
    if(L && (L.near(p.x, p.y, p.z, 0.4) || L.seg(p.x, p.y, p.z, from.x, from.y, from.z))){
      for(const k of [0.8, 0.6, 0.45, 0.3]){ const q = from.clone().lerp(p, k); if(!L.near(q.x, q.y, q.z, 0.4) && !L.seg(q.x, q.y, q.z, from.x, from.y, from.z)) return q; }
      return from.clone().lerp(p, 0.25);
    }
    return p;
  }
  function paintConvo(){
    const c = cv, t = el && el.querySelector('#tshTalk'); if(!c || !t) return;
    const lineHtml = (l, cls) => { const [name, col] = WHO[l.who] || [l.who.toUpperCase(), '#fff'];
      return `<div class="tsh-tk-line ${cls}" style="--c:${col}"><b style="color:${col}">${esc(name)}</b><p>${cls === 'ctx' ? esc(l.text) : '<span class="tsh-tk-t"></span>'}</p>`
        + (cls === 'ctx' ? '' : '<em class="tsh-tk-next"><kbd>Space</kbd> next</em>') + '</div>'; };
    let h = '';
    if(c.line) h += lineHtml(c.line, 'now');
    else if(c.ask && c.ctx) h += lineHtml(c.ctx, 'ctx');
    if(c.ask){
      const moves = c.ask.filter(o=>!o.say).length;
      h += `<div class="tsh-tk-ask${moves >= 3 ? ' grid' : ''}">` + c.ask.map((o, i)=>`<button class="${o.say ? 'say' : 'do'}${i === c.sel ? ' sel' : ''}" data-i="${i}">`
        + `<kbd>${i+1}</kbd>${o.icon ? `<i>${o.icon}</i>` : ''}<span>${o.say ? '“' + esc(o.say) + '”' : esc(o.does)}${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</span></button>`).join('')
        + '</div>';
    }
    t.innerHTML = h; t.classList.toggle('on', !!h);
    paintText();
  }
  function paintText(){
    const c = cv, s = el && el.querySelector('#tshTalk .tsh-tk-t'); if(!c || !c.line || !s) return;
    s.textContent = c.line.text.slice(0, Math.floor(c.shown));
    const nx = el.querySelector('#tshTalk .tsh-tk-next'); if(nx) nx.classList.toggle('on', c.shown >= c.line.text.length);
  }
  function convoSel(i){
    const c = cv; if(!c || !c.ask) return;
    c.sel = (i + c.ask.length) % c.ask.length;
    el.querySelectorAll('#tshTalk .tsh-tk-ask button').forEach((b, k)=>b.classList.toggle('sel', k === c.sel));
  }
  function convoKey(e){
    const c = e.code;
    if(c === 'KeyP' || c === 'Escape'){ pause(); return true; }
    if(cv && cv.ask){
      const m = /^(Digit|Numpad)([1-9])$/.exec(c); if(m){ convoPick(+m[2] - 1); return true; }
      if(c === 'ArrowUp' || c === 'KeyW'){ convoSel(cv.sel - 1); return true; }
      if(c === 'ArrowDown' || c === 'KeyS'){ convoSel(cv.sel + 1); return true; }
    }
    if((c === 'Space' || c === 'Enter' || c === 'NumpadEnter' || c === 'KeyE') && !e.repeat) convoAdvance();
    return true;
  }

  /* ================================================================== UI */
  let el = null, radarMap = null, infoOpen = true;
  function ui(){
    if(!el){
      el = document.createElement('div'); el.id = 'tsh';
      el.innerHTML = `
        <div class="tsh-obj"><small>OBJECTIVE</small><b id="tshGoal"></b><em id="tshDist"></em><ul id="tshInfo"></ul><div class="tsh-tab"><kbd>Tab</kbd> <span id="tshTabTxt">hide details</span></div></div>
        <div class="tsh-top"><div class="tsh-clock" id="tshClock"></div><div class="tsh-heat" id="tshHeat"></div>
          <div class="tsh-expo" title="Exposure: how close anybody is to knowing YU is Robin"><span>👁</span><div><i id="tshExpo"></i></div><em id="tshExpoN"></em></div>
          <div class="tsh-cash" id="tshCash"></div></div>
        <div class="tsh-radar"><canvas id="tshRadar" width="220" height="220"></canvas></div>
        <div class="tsh-gad" id="tshGad"></div>
        <div class="tsh-sub" id="tshSub"></div>
        <div class="tsh-talk" id="tshTalk"></div>
        <div class="tsh-prompt hidden" id="tshPrompt"></div>
        <div class="tsh-layer" id="tshLayer"></div>
        <div class="tsh-notes" id="tshNotes"></div>
        <div class="tsh-scan hidden" id="tshScan"><span>SCANNING</span><div><i></i></div></div>
        <div class="tsh-grab hidden" id="tshGrab"></div>
        <div class="tsh-phone hidden" id="tshPhone"></div>
        <div class="tsh-black" id="tshBlack"></div>
        <div class="tsh-phoneBig" id="tshPhoneBig"></div>
        <div class="tsh-lesson" id="tshLesson"></div>
        <div class="tsh-caption" id="tshCaption"></div>
        <div class="tsh-bar top"></div><div class="tsh-bar bot"></div>
        <div class="tsh-binomask"></div>
        <div class="tsh-panel hidden" id="tshPanel"><div class="tsh-pb"></div></div>
        <div class="tsh-title" id="tshTitle"></div>
        <div class="tsh-flash"></div>
        <div class="tsh-fade"></div>
        <div class="tsh-black"></div>`;
      document.body.appendChild(el);
      el.querySelector('.tsh-pb').addEventListener('click', e=>{ const b = e.target.closest('[data-a]'); if(!b) return; cue('ui'); if(panelCb) panelCb(b.dataset.a); });
      // a conversation answers the mouse: a choice by clicking it, a line by clicking anywhere on it
      const tk = el.querySelector('#tshTalk');
      tk.addEventListener('click', e=>{ if(!cv) return; const b = e.target.closest('[data-i]'); if(b) convoPick(+b.dataset.i); else convoAdvance(); });
      tk.addEventListener('mouseover', e=>{ const b = e.target.closest('[data-i]'); if(b) convoSel(+b.dataset.i); });
      // and a click in the picture moves a scene on, as SPACE does
      addEventListener('mousedown', e=>{
        if(!on || e.button !== 0 || busy) return;
        if(mode === 'cut') skipLine();
        else if(mode === 'talk' && cv && !cv.ask && e.target && e.target.id === 'view') convoAdvance();
      });
    }
    el.classList.remove('hidden', 'cine', 'bino', 'talking');
    el.querySelector('#tshTalk').classList.remove('on'); el.querySelector('#tshTalk').innerHTML = '';
    el.querySelector('#tshGrab').classList.add('hidden'); el.querySelector('#tshPanel').classList.add('hidden');
    el.querySelector('.tsh-fade').classList.remove('on'); fadeBusy = false;
    el.querySelector('.tsh-black').classList.remove('on'); el.querySelector('.tsh-black').innerHTML = '';
    el.querySelector('#tshNotes').innerHTML = '';
    document.body.classList.add('tsh-on');
    radarMap = null;
    hud();
  }
  function setObjective(goal, info){
    if(!el) return;
    const g = el.querySelector('#tshGoal');
    if(g.textContent !== goal){ g.textContent = goal; const o = el.querySelector('.tsh-obj'); o.classList.remove('new'); void o.offsetWidth; o.classList.add('new'); }
    el.querySelector('#tshInfo').innerHTML = (info||[]).map(l=>`<li>${esc(l)}</li>`).join('');
    el.querySelector('.tsh-obj').classList.toggle('closed', !infoOpen);
  }
  function hud(){
    if(!el) return;
    el.querySelector('#tshClock').textContent = AI.clock(S.t);
    el.querySelector('#tshCash').textContent = S.cash ? '¥' + S.cash.toLocaleString() : '';
    el.querySelector('#tshExpo').style.width = Math.round(S.exposure||0) + '%';
    el.querySelector('#tshExpoN').textContent = Math.round(S.exposure||0) + '%';
    const h = el.querySelector('#tshHeat'); let hs = ''; for(let i=1;i<=5;i++) hs += `<i class="${i <= S.heat ? 'on' : ''}">★</i>`; if(h.innerHTML !== hs) h.innerHTML = hs;
    const gd = el.querySelector('#tshGad');
    const pips = n => '●'.repeat(Math.max(0, n)) + '○'.repeat(Math.max(0, 3-n));
    const jamK = gad.jam > 0 ? 'on' : gad.jamCd > 0 ? 'cd' : '';
    const gp = Math.round(grip.left/AI.GRIP.hold*5), gripK = mode === 'scale' ? 'on' : grip.left < AI.GRIP.hold - 0.1 ? 'cd' : '';
    const html = `<span class="${me.hood ? 'on' : 'warn'}"><kbd>H</kbd>🧥<em>${me.hood ? 'hood up' : 'face showing'}</em></span>`
      + `<span class="${gripK}" title="Gecko cuffs"><kbd>G</kbd>🦎<em>${'grip ' + '▮'.repeat(gp) + '▯'.repeat(5 - gp)}</em></span>`
      + `<span class="${S.flash ? '' : 'off'}" title="Flash bangles"><kbd>F</kbd>✋<em>${pips(S.flash)}</em></span>`
      + `<span class="${jamK}" title="Static studs"><kbd>J</kbd>📡<em>${gad.jam > 0 ? 'jamming' : gad.jamCd > 0 ? Math.ceil(gad.jamCd)+'s' : 'ready'}</em></span>`
      + (S.can ? `<span><kbd>Q</kbd>🥫<em>throw</em></span>` : '')
      + `<span><kbd>I</kbd>🎒<em>bag</em></span>`;
    if(gd.dataset.h !== html){ gd.innerHTML = html; gd.dataset.h = html; }
  }
  let hudT = 0;
  function tickHud(dt){
    hudT -= dt; if(hudT <= 0){ hudT = 0.25; hud(); }
    const seen = S.heat > 0 && (npcs.some(n=>n.kind==='wfc' && n.sees) || drones.some(d=>d.state==='track' && d.inBeam));
    el.querySelector('#tshHeat').classList.toggle('seen', seen);
    // where to go
    const mk = mode === 'cut' ? null : marker(), dd = el.querySelector('#tshDist');
    dd.textContent = mk ? Math.round(Math.hypot(mk[0]-G.pos.x, mk[1]-G.pos.z)) + ' m' : '';
    // what E does here — or, facing a building's wall with the cuffs on, what G does
    if((grip.wallT -= dt) <= 0){
      grip.wallT = 0.15; grip.leapTo = false;
      const can_ = !mode && !busy && !inside;
      grip.wall = can_ ? wallAt() : null;
      if(can_ && !grip.wall && P().running){ grip.wall = wallAt(4.5); grip.leapTo = !!grip.wall; }   // sprinting at one: leap
    }
    const pr = el.querySelector('#tshPrompt');
    const n = (mode || busy) ? null : nearestThing();
    if(n){ const v = typeof n.verb === 'function' ? n.verb() : n.verb; const h = `<kbd>E</kbd><span>${n.icon ? n.icon+' ' : ''}${esc(v)}</span>`; if(pr.innerHTML !== h) pr.innerHTML = h; pr.classList.remove('hidden'); }
    else if(mode === 'scale'){ const h = `<kbd>W</kbd><span>🦎 climb</span><kbd>S</kbd><span>down</span><kbd>Space</kbd><span>let go</span>`; if(pr.innerHTML !== h) pr.innerHTML = h; pr.classList.remove('hidden'); }
    else if(!mode && !busy && grip.wall){
      const h = `<kbd>G</kbd><span>🦎 ${grip.leapTo ? 'Leap onto the wall' : 'Scale the wall'} · ${Math.round(grip.wall.s.y2 - feet())} m</span>`; if(pr.innerHTML !== h) pr.innerHTML = h; pr.classList.remove('hidden'); }
    else if(mode === 'hide'){ pr.innerHTML = '<kbd>E</kbd><span>Climb out</span>'; pr.classList.remove('hidden'); }
    else if(mode === 'ride'){ pr.innerHTML = '<kbd>E</kbd><span>Get off</span>'; pr.classList.remove('hidden'); }
    else pr.classList.add('hidden');
    // a drone reading you
    const sc = Math.max(0, ...drones.map(d=>d.scan||0));
    const sb = el.querySelector('#tshScan'); sb.classList.toggle('hidden', sc < 0.02); sb.querySelector('i').style.width = (sc*100) + '%';
  }
  /* ----------------------------------------------------------- the radar
     A round map in the corner that turns with you, GTA's way: the
     district drawn once, then who is near — Kai in red, WFC in blue (and
     flashing when they are after you), phones in yellow, the drones'
     beams, the search circle, and where you are going. */
  function buildRadarMap(){
    const S2 = 2, pad = 10, w = (CITY.EDGE.x*2 + pad*2)*S2, h = (CITY.EDGE.z*2 + pad*2)*S2;
    const c = LOOK.cv(w, h), x = c.getContext('2d');
    const mx = v => (v + CITY.EDGE.x + pad)*S2, mz = v => (v + CITY.EDGE.z + pad)*S2;
    x.fillStyle = '#0a1614'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#2c4a45'; x.fillRect(mx(-CITY.EDGE.x), mz(-10), CITY.EDGE.x*2*S2, 20*S2); x.fillRect(mx(-10), mz(-CITY.EDGE.z), 20*S2, CITY.EDGE.z*2*S2);
    x.fillStyle = '#20373a';
    CITY.LANES.forEach(([ax, a, b])=>{ if(ax==='z') x.fillRect(mx(-CITY.EDGE.x), mz(a), CITY.EDGE.x*2*S2, (b-a)*S2); else x.fillRect(mx(a), mz(-CITY.EDGE.z), (b-a)*S2, CITY.EDGE.z*2*S2); });
    W.roofs.forEach(r=>{ x.fillStyle = r.high ? '#1c2a3a' : '#132220'; x.fillRect(mx(r.x1)+1, mz(r.z1)+1, (r.x2-r.x1)*S2-2, (r.z2-r.z1)*S2-2);
      x.strokeStyle = r.high ? '#6a5aa8' : '#23403c'; x.lineWidth = r.high ? 2 : 1; x.strokeRect(mx(r.x1)+1, mz(r.z1)+1, (r.x2-r.x1)*S2-2, (r.z2-r.z1)*S2-2); });
    x.fillStyle = '#ff6a2a'; x.fillRect(mx(-44), mz(-44), 5*S2, 34*S2);            // Dragon Alley, in lantern orange
    x.globalAlpha = 0.5; x.fillStyle = '#3aaaff'; [[-70,8],[46,50.5]].forEach(([a,b])=>{ x.beginPath(); x.arc(mx(a), mz(b), 5, 0, 7); x.fill(); }); x.globalAlpha = 1;
    radarMap = { c, mx, mz, S2 };
  }
  function radar(){
    const cv_ = el.querySelector('#tshRadar'), x = cv_.getContext('2d'), R = 110;
    if(!radarMap) buildRadarMap();
    x.clearRect(0, 0, 220, 220);
    x.save(); x.beginPath(); x.arc(R, R, R-2, 0, 7); x.clip();
    x.fillStyle = '#050a09'; x.fillRect(0, 0, 220, 220);
    if(inside){
      x.fillStyle = '#8ff0ff'; x.font = 'bold 13px '+(window.uiFont ? uiFont() : 'monospace'); x.textAlign = 'center'; x.fillText('214 HARBOR LANE', R, R+4);
      x.restore(); ringRadar(x, R); return;
    }
    const Z = 1.35/radarMap.S2;                                    // radar px per map px
    x.translate(R, R); x.rotate(G.yaw); x.scale(Z, Z);
    x.translate(-radarMap.mx(G.pos.x), -radarMap.mz(G.pos.z));
    x.drawImage(radarMap.c, 0, 0);
    const M = (px, pz) => [radarMap.mx(px), radarMap.mz(pz)];
    const dot = (px, pz, col, r, ring) => { const [a, b] = M(px, pz); x.beginPath(); x.arc(a, b, (r||3)/Z*0.5, 0, 7); if(ring){ x.strokeStyle = col; x.lineWidth = 1.5/Z*0.5; x.stroke(); } else { x.fillStyle = col; x.fill(); } };
    // the search circle
    if(S.heat > 0 && lastKnown){ const [a, b] = M(lastKnown[0], lastKnown[1]); x.beginPath(); x.arc(a, b, AI.HEAT.radius(S.heat)*radarMap.S2, 0, 7);
      x.fillStyle = (clock*2|0)%2 ? 'rgba(255,60,60,0.12)' : 'rgba(60,120,255,0.12)'; x.fill(); }
    // the high roofs, when you need one
    if(S.step === 'out') W.roofs.forEach(r=>{ if(!r.high || r.x2-r.x1 > 60) return; const [a, b] = M(r.x1, r.z1); x.strokeStyle = '#c8a8ff'; x.lineWidth = 3; x.strokeRect(a, b, (r.x2-r.x1)*radarMap.S2, (r.z2-r.z1)*radarMap.S2); });
    drones.forEach(d=>{ if(d.static > 0 || d.stun > 0) return; const [a, b] = M(d.beam.x, d.beam.z); x.beginPath(); x.arc(a, b, d.beam.r*radarMap.S2, 0, 7);
      x.fillStyle = d.state === 'track' ? 'rgba(255,80,60,0.35)' : 'rgba(80,240,220,0.18)'; x.fill(); dot(d.x, d.z, '#8ff0ff', 4); });
    npcs.forEach(n=>{
      if(n.kind === 'drone' || n.gone || n.inApt || n.hidden) return;
      if(n.kind === 'wfc') dot(n.x, n.z, S.heat > 0 ? ((clock*4|0)%2 ? '#ff4a4a' : '#4a8aff') : '#4a8aff', 5);
      else if(n.kind === 'kai') dot(n.x, n.z, ['pursue','hunt','tail'].includes(n.state) ? '#ff3a2a' : '#ff9a3a', 6);
      else if(n.film) dot(n.x, n.z, '#ffd23d', 5);
      else if(n.kind === 'maya' && S.trail.scouted) dot(n.x, n.z, '#c8a8ff', 5);
      else if(n.kind === 'civ' && Math.hypot(n.x-G.pos.x, n.z-G.pos.z) < 30) dot(n.x, n.z, 'rgba(200,220,215,0.35)', 3);
    });
    trucks.forEach(t=>dot(t.x, t.z, t.tracker ? '#ff4a4a' : 'rgba(200,220,215,0.5)', 4));
    const mk = marker(); if(mk){ const [a, b] = M(mk[0], mk[1]); x.fillStyle = '#ffd23d'; x.beginPath(); x.moveTo(a, b - 9/Z); x.lineTo(a + 7/Z, b); x.lineTo(a, b + 9/Z); x.lineTo(a - 7/Z, b); x.fill(); }
    x.restore();
    // clamp the marker to the rim if it is off the map
    if(mk){ const dx = mk[0] - G.pos.x, dz = mk[1] - G.pos.z, d = Math.hypot(dx, dz)*1.35;
      if(d > R - 10){ const ang = Math.atan2(dx, dz) - G.yaw; const px = R + Math.sin(ang + Math.PI)*-1*(R-10), pz = R - Math.cos(ang + Math.PI)*-1*(R-10);
        x.fillStyle = '#ffd23d'; x.beginPath(); x.arc(R + Math.sin(-ang + Math.PI)*(R-10)*-1, R + Math.cos(-ang + Math.PI)*(R-10), 6, 0, 7); x.fill(); } }
    // you
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(R, R-8); x.lineTo(R+6, R+6); x.lineTo(R, R+3); x.lineTo(R-6, R+6); x.closePath(); x.fill();
    ringRadar(x, R);
  }
  function ringRadar(x, R){
    x.lineWidth = 4; x.strokeStyle = S.heat > 0 ? ((clock*3|0)%2 ? '#ff4a4a' : '#4a8aff') : 'rgba(143,240,220,0.5)'; x.beginPath(); x.arc(R, R, R-3, 0, 7); x.stroke();
  }

  /* -------------------------------------------- over people's heads
     What your shades show you: who has noticed you, and how much. */
  function screenOf(v){ const p = v.clone().project(G.camera); return { x:(p.x+1)/2*innerWidth, y:(1-p.y)/2*innerHeight, ok:p.z < 1 && p.z > -1 }; }
  let bubbles = [];
  function bubble(at, text, secs){
    if(!el || !text) return;
    const d = document.createElement('div'); d.className = 'tsh-bub'; d.textContent = text;
    el.querySelector('#tshLayer').appendChild(d); bubbles.push({ el:d, at, life:secs, max:secs });
  }
  function clearMarks(){ bubbles.forEach(b=>b.el.remove()); bubbles = []; npcs.forEach(n=>{ if(n.mark){ n.mark.remove(); n.mark = null; } }); if(objMark){ objMark.remove(); objMark = null; } }
  let objMark = null;
  function tickMarks(dt){
    const layer = el.querySelector('#tshLayer'), hideAll = mode === 'cut' || mode === 'end' || mode === 'talk';
    bubbles = bubbles.filter(b=>{ b.life -= dt; if(b.life <= 0){ b.el.remove(); return false; }
      const s = screenOf(b.at()); b.el.style.display = s.ok && !hideAll ? '' : 'none'; b.el.style.left = s.x+'px'; b.el.style.top = s.y+'px'; b.el.style.opacity = Math.min(1, b.life*3); return true; });
    npcs.forEach(n=>{
      if(n.kind === 'drone') return;
      let icon = null, cls = '', k = 0;
      if(n.stun > 0) { icon = '✴'; cls = 'stun'; }
      else if(n.film){ icon = '📱'; cls = 'film'; k = n.film.rec < 1.6 ? n.film.rec/1.6*0.5 : 0.5 + n.film.up*0.5; }
      else if(n.kind !== 'civ' && n.band !== 'unaware' && n.aware > 0.05){ const b = n.band; icon = b === 'alert' ? '!' : '?'; cls = b; k = Math.min(1, n.aware); }
      const show = icon && !hideAll && !n.hidden && n.inApt === inside && Math.hypot(n.x-G.pos.x, n.z-G.pos.z) < 60;
      if(!show){ if(n.mark) n.mark.style.display = 'none'; return; }
      if(!n.mark){ n.mark = document.createElement('div'); n.mark.className = 'tsh-mk'; layer.appendChild(n.mark); }
      const s = screenOf(V(n.x, n.y + 2.35, n.z));
      n.mark.style.display = s.ok ? '' : 'none';
      n.mark.style.left = s.x+'px'; n.mark.style.top = s.y+'px';
      const h = `<i style="--k:${(k*360)|0}deg"></i><b>${icon}</b>`;
      if(n.mark.dataset.h !== h){ n.mark.innerHTML = h; n.mark.dataset.h = h; }
      n.mark.className = 'tsh-mk ' + cls;
    });
    // the objective, in the world
    const mk = hideAll ? null : marker();
    if(!objMark){ objMark = document.createElement('div'); objMark.className = 'tsh-om'; layer.appendChild(objMark); }
    if(!mk || inside){ objMark.style.display = 'none'; return; }
    const s = screenOf(V(mk[0], mk[2], mk[1]));
    let x = s.x, y = s.y, off = !s.ok || x < 30 || x > innerWidth-30 || y < 30 || y > innerHeight-30;
    if(!s.ok){ x = innerWidth - x; y = innerHeight - 40; }
    x = clamp(x, 40, innerWidth-40); y = clamp(y, 60, innerHeight-60);
    objMark.style.display = ''; objMark.style.left = x+'px'; objMark.style.top = y+'px';
    objMark.classList.toggle('off', off);
    const d = Math.round(Math.hypot(mk[0]-G.pos.x, mk[1]-G.pos.z));
    const h = `<i></i><span>${esc(mk[3])} · ${d} m</span>`; if(objMark.dataset.h !== h){ objMark.innerHTML = h; objMark.dataset.h = h; }
  }

  /* ------------------------------------------------ notes, cards, panels */
  function note(text, kind){
    if(!el) return;
    const box = el.querySelector('#tshNotes'), d = document.createElement('div');
    d.className = 'tsh-note ' + (kind||''); d.textContent = text; box.prepend(d);
    while(box.children.length > 4) box.lastChild.remove();
    setTimeout(()=>{ d.classList.add('out'); setTimeout(()=>d.remove(), 600); }, kind === 'big' ? 6500 : 4600);
  }
  function phoneCard(title, who){
    const p = el.querySelector('#tshPhone'); cue('phone');
    p.innerHTML = `<small>${esc(title)}</small><b>${esc(who)}</b>`; p.classList.remove('hidden');
    clearTimeout(phoneCard.t); phoneCard.t = setTimeout(()=>p.classList.add('hidden'), 9000);
  }
  let capWas = null;
  function caption(text){
    if(!el || text === capWas) return; capWas = text;
    const c = el.querySelector('#tshCaption'); c.textContent = text; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
  }
  let zoneT = 0;
  function tickZones(dt){
    zoneT -= dt; if(zoneT > 0) return; zoneT = 0.5;
    if(mode === 'cut') return;
    const a = W.zones.alley, y = feet();
    const z = inside ? 'INT. ROBIN\'S ROOM — NIGHT' : y > 5 ? 'EXT. ROOFTOP — NIGHT'
      : (G.pos.x > a.x1 && G.pos.x < a.x2 && G.pos.z > a.z1 && G.pos.z < a.z2) ? 'EXT. ALLEY — NIGHT' : 'EXT. STREET — NIGHT';
    caption(z);
  }
  function title(){
    const t = el.querySelector('#tshTitle');
    t.innerHTML = `<div class="tsh-t1">TSH</div><div class="tsh-t2">WRITTEN BY GEORGE WANG</div><div class="tsh-t3">A KORO QUEST · PART ONE</div>`;
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    setTimeout(()=>{ if(el) el.querySelector('#tshTitle').classList.remove('on'); }, 5200);
  }
  function showGrab(v){ el.querySelector('#tshGrab').classList.toggle('hidden', !v); }
  function paintGrab(){
    if(!gr) return;
    el.querySelector('#tshGrab').innerHTML = `<b>${gr.n.kind === 'kai' ? 'KAI HAS YOU' : 'WFC HAS YOU'}</b>
      <div class="tsh-gk">${S.flash > 0 ? '<span><kbd>F</kbd> flash</span>' : ''}<span><kbd>E</kbd> struggle</span></div>
      <div class="tsh-gm"><i style="width:${Math.round(gr.mash*100)}%"></i></div><div class="tsh-gt"><i style="width:${Math.round(gr.t/1.9*100)}%"></i></div>`;
  }
  function showChair(v){ el.querySelector('#tshGrab').classList.toggle('hidden', !v); }
  function paintChair(){
    el.querySelector('#tshGrab').innerHTML = `<b>ZIP-TIED TO THE RADIATOR</b>
      <div class="tsh-gk"><span><kbd>A</kbd><kbd>D</kbd> work it loose</span>${S.flags.cutter ? '<span><kbd>E</kbd> the cutter</span>' : ''}</div>
      <div class="tsh-gm"><i style="width:${Math.round(ch.mash*100)}%"></i></div>`;
  }
  let panelCb = null;
  function panel(kind, html, cb, keep){
    const p = el.querySelector('#tshPanel'); p.dataset.kind = kind;
    p.querySelector('.tsh-pb').innerHTML = html; p.classList.remove('hidden'); panelCb = cb;
    busy = 'panel'; G.running = false;
    if(document.pointerLockElement) document.exitPointerLock();
  }
  function closePanel(){
    if(!el) return;
    el.querySelector('#tshPanel').classList.add('hidden'); panelCb = null;
    if(busy === 'panel'){ busy = null; letGoOfKeys(); if(!mode){ G.running = true; lockPointer($('#view')); } }
  }
  function bag(){
    const env = S.cash > 0, tr = S.trail;
    const items = [];
    if(S.rings) items.push(['💍', AI.KIT.rings.name, AI.KIT.rings.does, '']);
    items.push([AI.KIT.boots.icon, AI.KIT.boots.name, AI.KIT.boots.does, '']);
    if(env) items.push(['✉', 'Envelope · ¥' + S.cash.toLocaleString(), tr.trackerFound && tr.tracker === 'on' ? 'There is a tracker sewn into the lining.' : 'Cash. It feels about right.',
      tr.tracker === 'on' && !tr.trackerFound ? '<button data-a="lining">Check the lining</button>' : tr.tracker === 'on' ? '<button data-a="crush">Crush the tracker</button><em>or stand beside a delivery truck to plant it</em>' : '']);
    // the jewelry: what each piece does, in Robin's own words for it
    ['cuffs', 'bangles', 'studs'].forEach(p=>{ const k = AI.KIT[p];
      items.push([k.icon, k.name + (k.key ? ` · ${k.key}` : '') + (p === 'bangles' ? ` · ${S.flash} charge${S.flash === 1 ? '' : 's'}` : ''), k.does, '']); });
    items.push(['🧥', 'Hood and shades', me.hood ? 'Up. Nobody sees your face.' : 'Down. Your face is showing.', '']);
    if(S.can) items.push(['🥫', 'A can', 'Q throws it. Whoever hears it goes to look.', '']);
    if(tr.photo === 'pocket') items.push(['🖼', 'The photo', 'You, small, and your mother.', '']);
    panel('bag', `<div class="tsh-bag"><h3>🎒 Robin's bag</h3>${items.map(([i, n, d, a])=>`<div class="tsh-it"><span>${i}</span><div><b>${esc(n)}</b><small>${esc(d)}</small>${a ? '<div class="tsh-act">'+a+'</div>' : ''}</div></div>`).join('')}
      <div class="tsh-close"><button data-a="close">Close <kbd>I</kbd></button></div></div>`, act=>{
        if(act === 'close') return closePanel();
        if(act === 'lining'){ tr.trackerFound = true; cue('alert'); note('📡 A tracker, sewn into the lining. Somebody wants to know where this envelope goes.', 'big'); return bag(); }
        if(act === 'crush'){ tr.tracker = 'crushed'; cue('kick'); note('📡 Crushed under your heel. Let them wonder.'); return bag(); }
      });
  }
  function pause(){
    const q = LOOK.quality;
    panel('pause', `<div class="tsh-bag"><h3>⏸ TSH — ${esc(AI.clock(S.t))}</h3>
      <div class="tsh-keys"><span><kbd>WASD</kbd> move</span><span><kbd>Shift</kbd> run</span><span><kbd>Space</kbd> jump</span><span><kbd>E</kbd> use</span>
        <span><kbd>H</kbd> hood</span><span><kbd>G</kbd> Gecko cuffs</span><span><kbd>F</kbd> flash bangles</span><span><kbd>J</kbd> static studs</span><span><kbd>Q</kbd> throw</span><span><kbd>I</kbd> bag</span><span><kbd>Tab</kbd> details</span></div>
      <div class="tsh-pbtns"><button data-a="resume">▶ Back to the night</button>
        ${S.step === 'lesson' ? '<button data-a="skip">⏭ Skip the lesson — I know the shoes</button>' : ''}
        <button data-a="beat">↺ Restart this beat</button><button data-a="over">↺ Start the night over</button>
        <button data-a="q">Graphics: ${q === 2 ? 'high' : q === 1 ? 'medium' : 'low'}</button><button data-a="wano">🌏 Leave to Wano</button></div>
      <div class="tsh-credit">From the screenplay <b>TSH V4</b> by <b>George Wang</b>.</div></div>`, act=>{
        if(act === 'resume') return closePanel();
        if(act === 'skip'){ closePanel(); while(S.step === 'lesson') lessonNext(); return; }
        if(act === 'q'){ LOOK.quality = (q + 2) % 3; return pause(); }
        if(act === 'beat'){ closePanel(); const cp = S.cp; stop(); S.cp = cp; save(); enter(server); return; }
        if(act === 'over'){ closePanel(); const runs = S.runs, last = S.last; S = fresh(); S.runs = runs; S.last = last; save(); stop(); enter(server); return; }
        if(act === 'wano'){ closePanel(); leave(); }
      });
  }

  /* ----------------------------------------------------------- the screens
     Adverts, until the Director comes on; and at five stars, YU. */
  let scrMode = 'ad', scrT = 0, scrDraw = 0;
  function screensMode(m, secs){ scrMode = m; scrT = secs; S.flags.speechNow = m === 'news'; }
  function tickScreens(dt){
    if(scrT > 0 && scrT < 9000){ scrT -= dt; if(scrT <= 0){ scrMode = S.heat >= 5 ? 'alert' : 'ad'; S.flags.speechNow = false; } }
    scrDraw -= dt; if(scrDraw > 0) return; scrDraw = 0.1;
    W.screens.forEach((s, i)=>{
      if(Math.hypot(s.x - G.pos.x, s.z - G.pos.z) > 140) return;
      const x = s.canvas.getContext('2d'), w = 512, h = 288, t = clock;
      if(scrMode === 'news'){
        const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0a2a4a'); g.addColorStop(1, '#04101c'); x.fillStyle = g; x.fillRect(0,0,w,h);
        x.globalAlpha = 0.25; LOOK.wfcMark(x, w*0.75, h*0.42, 90, '#8ff0ff'); x.globalAlpha = 1;
        x.fillStyle = '#2a3a4a'; x.fillRect(w*0.36, h*0.62, w*0.28, h*0.4);                                   // the podium
        x.fillStyle = '#10161e'; x.beginPath(); x.ellipse(w*0.5, h*0.3, 30, 36, 0, 0, 7); x.fill();           // the Director
        x.beginPath(); x.moveTo(w*0.5-62, h*0.66); x.quadraticCurveTo(w*0.5, h*0.4, w*0.5+62, h*0.66); x.fill();
        x.fillStyle = '#c9d2dc'; x.fillRect(w*0.5-26, h*0.24, 52, 10);                                          // grey at the temples, under the lights
        x.fillStyle = '#8ff0ff'; x.fillRect(0, h*0.78, w, 36); x.fillStyle = '#04101c';
        x.font = 'bold 20px '+(window.uiFont ? uiFont() : 'monospace'); x.textAlign = 'left'; x.fillText('WFC PRESS BRIEFING · THE DIRECTOR', 14, h*0.78 + 24);
        x.fillStyle = '#04101c'; x.fillRect(0, h-26, w, 26); x.fillStyle = '#fff'; x.font = '16px '+(window.uiFont ? uiFont() : 'monospace');
        x.fillText('ILLICIT WEARABLE WEAPONRY OFF THE STREETS · CURFEW ADVISORY IN EFFECT · REPORT UNLICENSED TECH TO THE WFC TIP LINE ·', w - (t*60 % (w*2.2)), h-8);
        x.fillStyle = '#ff3a3a'; x.beginPath(); x.arc(24, 22, 7, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 16px '+(window.uiFont ? uiFont() : 'monospace'); x.fillText('LIVE', 36, 28);
      } else if(scrMode === 'alert'){
        x.fillStyle = (t*2|0)%2 ? '#3a0000' : '#100000'; x.fillRect(0,0,w,h);
        x.fillStyle = '#ff4a4a'; x.font = 'bold 30px '+(window.uiFont ? uiFont() : 'monospace'); x.textAlign = 'center';
        x.fillText('WFC · DO YOU KNOW THIS PERSON?', w/2, 44);
        x.fillStyle = '#000'; x.beginPath(); x.ellipse(w/2, h*0.5, 44, 54, 0, 0, 7); x.fill(); x.fillRect(w/2-80, h*0.62, 160, 90);
        x.fillStyle = '#222'; x.fillRect(w/2-34, h*0.46, 68, 12);
        x.fillStyle = '#fff'; x.font = 'bold 40px '+(window.uiFont ? uiFont() : 'monospace'); x.fillText('"YU"', w/2, h-20);
      } else {
        const b = LOOK.BRANDS[((t/6|0) + i) % LOOK.BRANDS.length];
        const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, b[2]); g.addColorStop(1, b[3]); x.fillStyle = g; x.fillRect(0,0,w,h);
        x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect((t*140 % (w+300)) - 150, 0, 90, h);
        x.fillStyle = 'rgba(8,6,14,0.9)'; x.beginPath(); x.ellipse(w*0.25, h*0.34, 26, 32, 0, 0, 7); x.fill();
        x.beginPath(); x.moveTo(w*0.25-24, h*0.48); x.bezierCurveTo(w*0.25-90, h*0.55, w*0.25-80, h, w*0.25-70, h); x.lineTo(w*0.25+70, h); x.bezierCurveTo(w*0.25+80, h, w*0.25+90, h*0.55, w*0.25+24, h*0.48); x.fill();
        x.fillStyle = '#fff'; x.textAlign = 'left'; x.font = 'bold 64px '+(window.uiFont ? uiFont() : 'monospace'); x.fillText(b[0], w*0.46, h*0.5);
        x.font = 'bold 18px '+(window.uiFont ? uiFont() : 'monospace'); x.fillStyle = b[3]; x.fillText(b[1], w*0.46, h*0.64);
      }
      s.tex.needsUpdate = true;
    });
  }

  /* ============================================================== frame */
  function tick(dt){
    if(!on || !W) return;
    clock += dt;
    chaseBack();
    if(busy === 'panel'){ return; }
    switch(mode){
      case 'reel': tickReel(dt); break;
      case 'cut': tickCut(dt); break;
      case 'talk': tickConvo(dt); break;
      case 'climb': tickClimb(dt); break;
      case 'scale': tickScale(dt); break;
      case 'ride': tickRide(dt); break;
      case 'hide': tickHide(); break;
      case 'grab': tickGrab(dt); break;
      case 'chair': tickChair(dt); break;
      case 'end': if(window.AVATAR) AVATAR.tickClip(dt, false, false, true); break;
    }
    npcs.slice().forEach(n=>{ if(!n.gone) tickNpc(n, dt); });
    tickTrucks(dt);
    if(mode !== 'end'){ tickEvents(dt); tickHeat(dt); tickQuest(dt); }
    if(mode === null && G.onGround) grip.left = Math.min(AI.GRIP.hold, grip.left + dt*AI.GRIP.regen);   // the film recovers on the ground
    tickGadgets(dt); tickLights(dt); tickMotion(dt); tickSteam(dt); tickRain(dt); tickGlint(dt); tickScreens(dt); tickZones(dt);
    W.anims.forEach(f=>f(clock));
    if(W.sky) W.sky.visible = !inside;
    tickTalk(dt); tickHud(dt); tickMarks(dt); radar();
    lessonTick();
    if(W.room && W.room.eq && inside && scoring()) W.room.eq.forEach((b, i)=>{ b.scale.y = 0.4 + Math.abs(Math.sin(clock*(6 + i*1.7) + i))*2.2; });   // the speaker's lights, with the music
    if(window.BOOTS && BOOTS.active) BOOTS.show(!mode && !inside && !busy);
  }
  function render(dt){
    if(window.GUN) GUN.carried(false);
    chaseCam(dt);
    LOOK.render(G.scene, G.camera, dt);
    LOOK.fx.flash = Math.max(0, LOOK.fx.flash - (dt||0.016)*2.2);
  }
  function key(e){
    if(!on) return false;
    const c = e.code;
    if(c === 'KeyB' || c === 'KeyC' || c === 'KeyT') return true;       // no costume changes, rooms or chat mid-heist
    if(busy === 'panel'){ if(c === 'Escape' || c === 'KeyI' || c === 'KeyP'){ const k = el.querySelector('#tshPanel').dataset.kind; if(k !== 'results') closePanel(); } return true; }
    if(mode === 'reel'){ if((c === 'Enter' || c === 'NumpadEnter' || c === 'Escape') && !e.repeat) skipReel(); return true; }
    if(mode === 'talk') return convoKey(e);
    if(!mode && S.step === 'lesson' && (c === 'Enter' || c === 'NumpadEnter') && !e.repeat){ lessonSkip(); return true; }
    if(!mode && S.step === 'lesson' && lessonId() === 'fire' && c === 'Space' && !e.repeat){ fireShoes(); return true; }
    if(mode === 'cut'){ if((c === 'Space' || c === 'KeyE') && !e.repeat) skipLine(); if(c === 'Enter' || c === 'NumpadEnter') skipCut(); return true; }
    if(mode === 'end') return true;
    if(mode === 'grab'){ if(c === 'KeyF'){ if(flash()) breakFree(true); } if(c === 'KeyE'){ gr.mash += 0.13; cue('step'); } return true; }
    if(mode === 'chair') return chairKey(e) || c === 'KeyP';
    if(c === 'KeyP' || c === 'Escape'){ pause(); return true; }
    if(mode === 'hide'){ if(c === 'KeyE') unhide(); return c === 'KeyE'; }
    if(mode === 'ride'){ if(c === 'KeyE') unride(); return c === 'KeyE' || c === 'Space'; }
    if(mode === 'climb') return c === 'KeyE';
    if(mode === 'scale'){
      if(c === 'Space' && !e.repeat){ const sc = me.scale; if(sc && !sc.mantle) offWall(sc.y, true); }
      if(c === 'KeyP' || c === 'Escape') pause();
      return true;
    }
    if(c === 'KeyE'){ const t = nearestThing(); if(t){ t.act(); return true; } return false; }
    if(c === 'KeyF'){ flash(); return true; }
    if(c === 'KeyG'){ tryScale(); return true; }
    if(c === 'KeyJ'){ jam(); return true; }
    if(c === 'KeyH'){ setHood(!me.hood); hud(); return true; }
    if(c === 'KeyQ'){ throwCan(); return true; }
    if(c === 'KeyI'){ bag(); return true; }
    if(c === 'Tab'){ infoOpen = !infoOpen; el.querySelector('.tsh-obj').classList.toggle('closed', !infoOpen); el.querySelector('#tshTabTxt').textContent = infoOpen ? 'hide details' : 'details'; return true; }
    return false;
  }

  return { enter, leave, stop, tick, key, render, LINES,
           get active(){ return on; }, get state(){ return S; }, get mode(){ return mode; }, get inside(){ return inside; },
           /* for tests and the console */
           _npcs:()=>npcs, _world:()=>W, _outcome:outcome, _heat:heat, _flash:flash, _jam:jam, _goInside:goInside,
           _place:(x, z, yaw, y)=>{ placePlayer(x, z, yaw, y); if(typeof thirdPerson === 'function') for(let i=0;i<40;i++) thirdPerson(); },
           _reset:()=>{ S = fresh(); save(); }, _S:()=>S,
           _dbg:{ get apt(){ return apt; }, get dealT(){ return dealT; }, get cut(){ return cut; }, get gr(){ return gr; }, things:()=>things, nearestThing, marker,
                  homeDoor, aptExit, tossRings, dealBegin, leaveInMailbox, takeFromMailbox, newsScene, roofCut, scene, skipCut, chair, freed, ending, grab, caught,
                  detained, questEvent, find, get lastKnown(){ return lastKnown; },
                  get convo(){ return cv; }, convoPick, convoAdvance,
                  opening, fallStart, fireShoes, skipReel, get reel(){ return reel; }, lessonNext, get lesson(){ return lesson; }, get grip(){ return grip; }, tryScale, wallAt, get scale(){ return me.scale; } } };
})();
