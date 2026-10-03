/* =====================================================================
   TSH — THE RULES. Everything about the quest that is a decision rather
   than a picture, with no THREE and no DOM in it, so it can be read and
   tested on its own (tests/tsh.test.js):

     THE CLOCK      one night, 22:00 to 02:00, run eight times fast
     THE STORYBOARD the scenes, in order, and what sets each one off
     THE KIT        Robin's jewelry: what each piece does, and the grip
     PERCEPTION     how quickly somebody notices you, from what they can see
     HEAT           WFC's attention, 0 to 5, and how it cools
     THE PATHS      A* over the district's walking graph
     THE CHASE      WFC after her across the roofs: missiles, cover, three fights, how heat cools
     THE QUEST      a state machine: which beat you are in and what moves it
     THE TRAIL      what you left behind, and what Maya can know from it
     THE ENDING     which last shot you earned

   THE QUEST IS AUTHORED AT BOTH ENDS AND SYSTEMIC IN THE MIDDLE. The
   table below does not say HOW a beat is finished — sneaking, talking,
   a flash in somebody's face — only which outcomes a beat can end in and
   where each one goes. Two players finish the same beats by different
   roads and the story still holds together, because every road is an
   edge in here.
   ===================================================================== */
window.TSHAI = (function(){

  /* ============================================================ the clock
     Minutes after 22:00. Eight game seconds to the real one: the four
     hours of the night are thirty minutes of play.

     THE CLOCK STARTS NOTHING. It is on the screen to say how late it is;
     no scene waits for a time, no buyer gives up at eleven, no speech
     comes on at half past. Everything in the night happens because Robin
     did something — walked somewhere, picked something, got caught —
     and in the order the storyboard below says. */
  const RATE = 8/60;                         // game minutes per real second
  const AT = {
    wake:       15,       // 22:15 — the buyer calls: is his order ready?
    deal:       30,       // 22:30 — the time on the buyer's message (it is only words: he waits)
    end:        307       // 03:07 — the clock stops here; nothing fails at it (it is what her phone says when she gets in)
  };
  function clock(min){
    // the workshop is before ten: minutes before 22:00 are negative, and read as 21:xx
    const m = Math.max(-120, Math.min(AT.end, min||0)), h = (24 + 22 + Math.floor(m/60)) % 24, mm = ((Math.floor(m) % 60) + 60) % 60;
    return String(h).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
  }

  /* ========================================================== perception
     How fast an observer's awareness of you climbs, per second, from 0
     (unaware) to 1 (sure). Zero if they cannot see you at all. It is
     the product of five plain things:
       · are you in front of them (a cone, with a small circle round
         them where they notice you whichever way they face),
       · how far away you are,
       · how lit you are where you stand,
       · whether you are running (people see movement),
       · whether there is anything between you (the caller's LOS). */
  function perceive(o, t, light, los){
    if(!los) return 0;
    const dx = t.x - o.x, dz = t.z - o.z, d = Math.hypot(dx, dz), dy = Math.abs((t.y||0) - (o.y||0));
    const range = o.range || 20;
    if(d > range) return 0;
    const near = o.near || 3;
    let cone = 1;
    if(d > near){
      const ang = Math.atan2(dx, dz), off = Math.abs(Math.atan2(Math.sin(ang - o.yaw), Math.cos(ang - o.yaw)));
      const half = o.fov || 1.0;
      if(off > half) return 0;
      cone = 1 - 0.5*(off/half);               // the edge of the eye is slower than its middle
    }
    const far = Math.max(0, 1 - d/range);
    const lit = 0.2 + 0.8*Math.min(1.2, Math.max(0, light));
    const moving = t.running ? 1.5 : t.moving ? 1.0 : 0.7;
    const high = dy > 3 ? 0.55 : 1;            // nobody looks up
    return (o.gain || 1) * cone * (0.35 + 0.65*far) * lit * moving * high;
  }
  /* awareness bands, and the word for each */
  const BANDS = [[0.3, 'unaware'], [0.62, 'suspicious'], [0.999, 'investigating'], [Infinity, 'alert']];
  function band(a){ for(const [top, name] of BANDS) if(a < top) return name; return 'alert'; }

  /* ================================================================ heat
     WFC's interest in YU. It never jumps from nothing to everything: a
     crime seen raises it to that crime's weight, a report adds one, and
     it cools one level at a time for every stretch nobody in WFC has
     eyes on you — faster outside the circle they are searching. */
  const CRIMES = {
    flash:      { sev:2, heard:26, label:'a flash-bang on the street' },
    theft:      { sev:1, heard:10, label:'a stolen scooter' },
    scan:       { sev:1, heard:0,  label:'illegal wearables on a drone scan' },
    gate:       { sev:1, heard:0,  label:'the scanner arch' },
    brawl:      { sev:1, heard:14, label:'a fight in the street' },
    evade:      { sev:2, heard:0,  label:'running from WFC' },
    trespass:   { sev:1, heard:0,  label:'the WFC post' },
    gear:       { sev:1, heard:0,  label:'illegal wearables, in use' }
  };
  const HEAT = {
    max: 5,
    coolAfter: h => h <= 2 ? 22 : 34,          // seconds unseen before it drops a level
    coolOutside: 0.45,                          // …and this fraction of that outside the circle
    radius: h => 26 + h*9,                      // the search circle
    reinforce: 3,                               // from here, more officers come out of the post
    checkpoints: 4,                             // from here, the checkpoint is manned whatever the time
    billboards: 5                               // and here the city's screens show YU
  };
  function raise(heat, crime){
    const c = CRIMES[crime]; if(!c) return heat;
    return Math.min(HEAT.max, Math.max(heat, c.sev));
  }
  function report(heat){ return Math.min(3, Math.max(heat + 1, 1)); }   // a tip-line upload
  function cool(heat, unseen, outside){
    if(heat <= 0) return { heat:0, reset:false };
    const need = HEAT.coolAfter(heat) * (outside ? HEAT.coolOutside : 1);
    return unseen >= need ? { heat:heat-1, reset:true } : { heat, reset:false };
  }

  /* =========================================================== the chase
     AFTER THE ALLEY, WFC. The billboard over Neon Avenue reports illegal
     wearables in Dragon Alley, and the squads arrive. From there it is a
     chase, and it TEACHES ITSELF one stage at a time, in the order the
     script has it: run, fight on the move, climb, the shoes, hide, the
     phone — and then everything at once, home.

     THE MISSILES ARE FAIR. Every one is telegraphed: a red line from the
     drone, a lock-on tone, and a ring where it will land, a second and a
     half before it does. It hits the RING, not Robin: moving always saves
     her. In the air the lock follows her until it fires, and then it is
     a straight shot at where she was going — so a dive, or a turn, takes
     her out of it. Never more than two in the air; nobody fires at her
     while she is hidden. A hit knocks her down; two in a row and WFC has
     her (back to the start of the stage, never a game over).

     HIDING IS NOT FAILING. Heat cools while nobody can see her — quickly
     tucked behind cover, more slowly just out of sight — and never below
     what the stage she is on holds it at (nobody calls off a chase while
     it is still teaching you to run from it). */
  const CHASE = {
    stages: [
      { id:'run',    title:'RUN',            how:'Get away from them. SHIFT sprints — east, down Neon Avenue. SPACE at a barrier vaults it.', floor:3 },
      { id:'van',    title:'CORNERED',       how:'A van across the pavement, and they get out of it.', floor:3, fight:1 },
      { id:'wall',   title:'RUN',            how:'North, into the gap between the buildings. If it closes: G, and up the wall.', floor:3 },
      { id:'roofs',  title:'HOLD SPACE',     how:'The shoes are charged. Hold SPACE: roof to roof, east.',               floor:3 },
      { id:'rappel', title:'DROPPED IN',     how:'The gunship puts a team on the roof in front of her.', floor:3, fight:2 },
      { id:'hide',   title:'E — HIDE',       how:'You cannot outrun a gunship. Through the gate, behind the AC unit — and stay on the far side of whatever is looking.', floor:2 },
      { id:'call',   title:'MOM',            how:'Keep the box between you and him.',                                   floor:2 },
      { id:'found',  title:'FOUND',          how:'He came round the box.', floor:2, fight:3 },
      { id:'home',   title:'GET HOME',       how:'Lose them — and land on your own roof with nobody on you.',           floor:0 }
    ],
    missile: { lock:1.5, airLock:1.1, fly:0.45, blast:2.8, live:2, gapGround:[3.4, 5.0], gapAir:[2.2, 3.2], lead:0.6 },
    hits: 2,                 // knockdowns in a row before WFC has her
    hitsForget: 20,          // seconds without a hit and the count starts again
    cool: { cover:5, unseen:9 },
    strafe: { every:[8, 11], rings:5, gap:3.4, step:0.32 }
  };
  const stageAt = id => CHASE.stages.findIndex(s=>s.id === id);
  /* does a blast at `at` reach her at `p`? (both have y) */
  function blastHits(at, p, r){ return Math.hypot(p.x - at.x, (p.y + 0.9) - at.y, p.z - at.z) < (r || CHASE.missile.blast); }
  /* where a lock fires at: a little ahead of where she is going (on the ground), or exactly on her line for the flight time (in the air) */
  function leadPoint(p, v, air){ const t = air ? CHASE.missile.fly : CHASE.missile.lead; return { x:p.x + v.x*t, y:p.y + (air ? v.y*t : 0), z:p.z + v.z*t }; }
  /* the heat in a chase: down a star every `cover` seconds unseen behind cover, every `unseen` seconds out of sight, never below the stage's floor */
  function chaseCool(heat, unseen, inCover, floor){
    if(heat <= (floor||0)) return { heat:Math.max(heat, floor||0), reset:false };
    const need = inCover ? CHASE.cool.cover : CHASE.cool.unseen;
    return unseen >= need ? { heat:heat - 1, reset:true } : { heat, reset:false };
  }

  /* ============================================================ the paths
     A* over the district graph (tshcity.js navGraph). Nodes carry x z y
     and a list of neighbour indices. */
  function nearest(nodes, x, z, y, maxDy){
    let best = -1, bd = Infinity;
    for(let i=0;i<nodes.length;i++){
      const n = nodes[i]; if(maxDy !== undefined && Math.abs(n.y - (y||0)) > maxDy) continue;
      const d = (n.x-x)*(n.x-x) + (n.z-z)*(n.z-z) + (n.y-(y||0))*(n.y-(y||0))*4;
      if(d < bd){ bd = d; best = i; }
    }
    return best;
  }
  function astar(nodes, a, b){
    if(a < 0 || b < 0) return null;
    if(a === b) return [a];
    const h = i => Math.hypot(nodes[i].x-nodes[b].x, nodes[i].z-nodes[b].z) + Math.abs(nodes[i].y-nodes[b].y)*2;
    const g = new Map([[a, 0]]), from = new Map(), open = new Set([a]), f = new Map([[a, h(a)]]);
    let guard = 0;
    while(open.size && guard++ < 4000){
      let cur = -1, cf = Infinity; open.forEach(i=>{ const v = f.get(i); if(v < cf){ cf = v; cur = i; } });
      if(cur === b){ const path = [b]; let k = b; while(from.has(k)){ k = from.get(k); path.unshift(k); } return path; }
      open.delete(cur);
      const nc = nodes[cur];
      for(const j of nc.e){
        const nj = nodes[j];
        const step = Math.hypot(nc.x-nj.x, nc.z-nj.z) + Math.abs(nc.y-nj.y)*2.5;
        const t = g.get(cur) + step;
        if(t < (g.has(j) ? g.get(j) : Infinity)){ from.set(j, cur); g.set(j, t); f.set(j, t + h(j)); open.add(j); }
      }
    }
    return null;
  }

  /* =========================================================== the quest
     Beats and the outcomes that leave them. An outcome not listed for a
     beat does nothing — which is how a stray event from the systems
     (Kai spotting you after the deal is done, say) cannot knock the
     story off its rails. */
  const QUEST = {
    intro:   { goal:'Sell the rings to the buyer. Get paid.', to:{ start:'wake' } },
    wake:    { goal:'', to:{ out:'lesson' } },
    lesson:  { goal:'Get to Dragon Alley — over the roofs.', to:{ done:'deal' } },
    deal:    { goal:'Meet the buyer in Dragon Alley. Get paid.', to:{ fought:'raid', confiscated:'raid' } },
    raid:    { goal:'Get out of Dragon Alley.', to:{ home:'night' } },
    night:   { goal:'', to:{ slept:'end' } },
    /* PART TWO: the screens, the roof, the flat. George's scenes, kept for
       the next chapter — the prologue ends with Maya at the binoculars. */
    news:    { goal:'Get out of Dragon Alley.', to:{ watched:'home' } },
    home:    { goal:'Get home with the money.', to:{ home:'apt' } },
    apt:     { goal:'Somebody is in your flat.', to:{ kaiIn:'escape', out:'out' } },
    escape:  { goal:'Get out.', to:{ caught:'chair', out:'out' } },
    chair:   { goal:'Get free.', to:{ free:'escape2' } },
    escape2: { goal:'Get out before Maya comes back.', to:{ out:'out' } },
    out:     { goal:'Lose them. Get somewhere high.', to:{ high:'end' } },
    end:     { goal:'', to:{} }
  };
  function next(step, outcome){
    const b = QUEST[step]; if(!b) return step;
    return b.to[outcome] || step;
  }
  /* The checkpoints a visit restarts from: the beat is replayed, what
     you did in the beats before it stays done. (drop and robbed were the
     old deal with Kai's dead drop; a night saved in one is back at the deal.) */
  const CHECKPOINT = { intro:'wake', wake:'wake', lesson:'lesson', deal:'deal', drop:'deal', robbed:'deal', raid:'raid', night:'raid', news:'news', home:'home', apt:'apt', escape:'apt',
                       chair:'apt', escape2:'apt', out:'out', end:'end' };

  /* ======================================================= the storyboard
     THE NIGHT, SCENE BY SCENE. Every line anybody speaks belongs to one
     of these, and a scene plays only when the one before it has played
     (`after`: any one of them) and Robin has done the thing that sets it
     off (`on`). Nothing talks out of turn: no speech on a timer, no
     voice from across the city because a clock ticked over, no scene
     from the end of the night before the middle of it. A scene plays
     once; a checkpoint takes back the ones after it.

       id         beat     what sets it off                                    after
     ───────────────────────────────────────────────────────────────────────────── */
  const STORY = [
    { id:'wake',      beat:'wake',   on:'the night starts: the buyer calls; the kit on, out of the window' },
    { id:'lesson',    beat:'lesson', on:'she falls from the window, and the shoes fire',     after:['wake'] },
    { id:'deal',      beat:'deal',   on:'walking up to the buyer in Dragon Alley: no money, his crew, the fight', after:['lesson'] },
    { id:'raid',      beat:'raid',   on:'stepping out of Dragon Alley: the billboard, then WFC', after:['deal'] },
    { id:'mom',       beat:'raid',   on:'hidden on a roof from the gunship, her phone rings', after:['raid'] },
    { id:'sleep',     beat:'night',  on:'on her own roof with nobody on her: in at the window, 3 AM', after:['mom'] },
    { id:'watchers',  beat:'night',  on:'across the street, through Maya\'s binoculars',     after:['sleep'] },
    /* PART TWO, not played in the prologue (see QUEST) */
    { id:'news',      beat:'news',   on:'stepping out of Dragon Alley, the fight behind her', after:['watchers'] },
    { id:'roof',      beat:'news',   on:'the broadcast ends: through Maya\'s binoculars',     after:['news'] },
    { id:'voicemail', beat:'apt',    on:'through her own front door',                        after:['roof'] },
    { id:'maya',      beat:'apt',    on:'the lamp goes on, or a knock at the door',          after:['voicemail'] },
    { id:'kai',       beat:'escape', on:'the talk ends, or Robin ends it',                   after:['maya'] },
    { id:'after',     beat:'out',    on:'out of the door past Kai, still on the floor',      after:['kai'] },
    { id:'chair',     beat:'chair',  on:'Kai gets hold of her in the flat',                  after:['kai'] },
    { id:'end',       beat:'end',    on:'up high, with nobody on her',                       after:['voicemail'] }
  ];
  /* may scene `id` play now, given the scenes that have? */
  function ready(seen, id){
    const s = STORY.find(x=>x.id === id);
    if(!s || (seen||[]).includes(id)) return false;
    return !s.after || s.after.some(a=>(seen||[]).includes(a));
  }
  /* The scenes behind a beat: what a save from before the storyboard, or
     a night resumed in the middle, has already seen. */
  function seenBefore(step){
    const O = ['wake','lesson'];
    const behind = { lesson:['wake'], deal:O, raid:O.concat('deal'), night:O.concat('deal', 'raid', 'mom'), news:O.concat('deal'),
                     home:O.concat('deal','news','roof'), out:O.concat('deal','news','roof','voicemail','maya','kai') };
    ['apt','escape','chair','escape2'].forEach(b=>{ behind[b] = behind.home; });
    behind.end = behind.out;
    return (behind[step] || []).slice();
  }

  /* ============================================================= the kit
     ROBIN MAKES JEWELRY — pretty on a wrist or an ear, and every piece of
     it what WFC calls illicit wearable weaponry. Tonight's kit, in the
     order she finishes it at her bench. `key` is what uses it. */
  const KIT = {
    boots:   { name:'Skyline shoes', key:'SPACE', icon:'👟',
               does:'Her own sneakers, rebuilt: coils in the soles. HOLD SPACE and they take her roof to roof on their own — point where you want to go, even mid-air. Tap SPACE as she lands, when the ring goes gold, for a perfect bound. In the air SHIFT dives, SPACE in a dive pulls up, and SPACE at a wall kicks off it.' },
    cuffs:   { name:'Gecko cuffs',   key:'G', icon:'🦎',
               does:'Grip a building\'s wall and climb it, all the way to the roof — or sprint at a wall and leap onto it. The film tires after about fifteen seconds on a wall and recovers on the ground. WFC who see them in use see illegal wearables.' },
    bangles: { name:'Flash bangles', key:'F', icon:'✋',
               does:'Clap, and anybody facing you sees white for four seconds. Three charges; they come back slowly. Loud — WFC hears it.' },
    studs:   { name:'Static studs',  key:'J', icon:'📡',
               does:'Six seconds of noise: phones stop uploading, drones lose their picture, scanner arches go deaf — and anything of yours that is transmitting shows up.' },
    rings:   { name:'The two rings', key:'',  icon:'💍',
               does:'The buyer\'s. A shield in each, if the wearer knows how. ¥3,000 on delivery.' }
  };
  const KIT_ORDER = ['boots', 'cuffs', 'bangles', 'studs', 'rings'];
  /* THE GRIP. Seconds of hold on a wall, how fast she goes up, down and
     along it, how fast it comes back on the ground, and how fast she
     slides when it gives out. A 15-second hold at 1.5 m/s is 22 metres:
     every roof in the district but the two towers on the outer ring.
     `clip` is how far the climbing animation itself rises in a second
     (animations/WallStuff: 1.33 m a two-second loop); the clip plays at
     up/clip, so her hands keep pace with the wall going past. */
  const GRIP = { hold:15, up:1.5, down:1.9, side:1.2, regen:2.5, slide:4.5, clip:0.67, leap:1.4 };

  /* =========================================================== the trail
     Everything that could lead Maya to your door, and what she knows
     when she gets there. */
  function freshTrail(){
    return { tracker:'none', trackerFound:false, kaiTail:false, kaiSawFace:false, faceVideo:false,
             photo:'up', mayaSawPhoto:false, scouted:false, detained:0, uploads:0 };
  }
  /* How she comes in. An AMBUSH (she is already in the dark when you
     open the door) when she could follow you here; a KNOCK when she had
     to go and find out, and you have a minute to get ready. */
  function arrival(tr){
    if(tr.tracker === 'on') return { how:'ambush', by:'tracker' };
    if(tr.kaiTail) return { how:'ambush', by:'kai' };
    if(tr.faceVideo) return { how:'ambush', by:'video' };
    if(tr.detained) return { how:'knock', by:'record' };
    return { how:'knock', by:'asked' };
  }
  /* Does she know whose daughter you are? Only if you gave it to her. */
  function knowsMother(tr, exposure){
    return !!(tr.mayaSawPhoto || tr.faceVideo || tr.detained || (exposure||0) >= 55);
  }

  /* ========================================================== the ending
     The last shot is whatever you missed. Checked in order: the thing
     that will find you soonest first. */
  function ending(tr, S){
    if(tr.tracker === 'on') return 'tracker';
    if(tr.photo === 'taken' || tr.mayaSawPhoto) return 'photo';
    if(tr.faceVideo || (S && S.exposure >= 60)) return 'billboard';
    return 'clean';
  }
  const STINGS = {
    tracker:   ['The envelope', 'A red light blinks in the lining. On a rooftop across the city, a dot stops moving.'],
    photo:     ['The photo', 'Maya holds your photo up to the light of her tracker.'],
    billboard: ['The screens', 'Every screen on Neon Avenue: WFC · DO YOU KNOW THIS PERSON?'],
    clean:     ['Unknown number', '"Nobody\'s lost me before." — M']
  };

  /* A line for each thing you did, for the card at the end. */
  function summary(S){
    const tr = S.trail, out = [];
    const deal = { fought:'The buyer never meant to pay. His crew came out of the alley — and you left them on the floor of it. Kept the rings; no money.',
                   paid:'Took the cash and vanished, the way you planned.', robbed:'Handed over the rings first — Kai walked.',
                   recovered:'Got your money back off Kai anyway.', dropped:'Left the rings in a dead drop.', retrieved:'Got the envelope out from under Kai\'s nose.',
                   noshow:'Never showed up to the deal.', confiscated:'WFC took the rings before you could sell them.', gaveup:'Let the money go.',
                   stiffed:'Walked off with the cash and the rings. Kai did not take it well.' };
    (S.dealPath||[]).forEach(p=>{ if(deal[p]) out.push(deal[p]); });
    if(S.flags && S.flags.raidHome) out.push('Lost WFC across the roofs — two drones, a gunship, and a phone call from Mom behind an AC unit. "Really good TV."');
    if(tr.scouted) out.push('Spotted Maya watching from her roof.');
    const flat = !(S.flags && S.flags.raidHome);          // the tracker and the photo are the flat's business: Part Two
    if(flat) out.push(tr.tracker==='on' ? (tr.trackerFound ? 'Found the tracker — and kept it on you anyway.' : 'Carried the tracker home without knowing.') : tr.tracker==='crushed' ? 'Found the tracker and crushed it.' :
             tr.tracker==='planted' ? 'Stuck the tracker on a delivery truck.' : tr.tracker==='seized' ? 'The tracker went into a WFC evidence bag with the cash.' :
             tr.tracker==='returned' ? 'Kai took the envelope back — tracker and all.' : 'Never carried a tracker.');
    if(tr.kaiTail) out.push('Kai followed you home.');
    if(tr.uploads) out.push(tr.uploads + (tr.uploads>1 ? ' videos' : ' video') + ' of YU went to the WFC tip line' + (tr.faceVideo ? ' — one with your face in it.' : '.'));
    if(tr.detained) out.push('WFC detained you. Somebody called your mother.');
    const sc = (S.flags && S.flags.scaled) || 0;
    if(sc) out.push('Went up ' + sc + (sc > 1 ? ' walls' : ' wall') + ' on the Gecko cuffs.');
    if(flat) out.push(tr.photo==='pocket' ? 'Took the photo with you.' : tr.photo==='taken' ? 'Maya left with your photo.' : 'Turned the photo face down.');
    out.push('Most heat: ' + '★'.repeat(S.maxHeat||0) + '☆'.repeat(5-(S.maxHeat||0)) + ' · Exposure ' + Math.round(S.exposure||0) + '%');
    return out;
  }

  return { RATE, AT, clock, perceive, band, BANDS, CRIMES, HEAT, raise, report, cool, CHASE, stageAt, blastHits, leadPoint, chaseCool, nearest, astar,
           QUEST, next, CHECKPOINT, STORY, ready, seenBefore, KIT, KIT_ORDER, GRIP, freshTrail, arrival, knowsMother, ending, STINGS, summary };
})();
