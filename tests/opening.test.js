/* THE OPENING FILM, AND THE WALKTHROUGH ON RYU.

   Two different answers to the same question — "what am I supposed to be
   doing?" — asked at two different moments. The film answers it before
   anybody has seen anything, in five sentences and no keys. The
   walkthrough answers it on the ground, one object at a time, in keys and
   nothing else. Neither is much use without the other and both were
   missing. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const bare = src => src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

test('the film is five cuts about Ion, and says nothing about keys', ()=>{
  const src=read('public/opening.js');
  const block=src.slice(src.indexOf('const SHOTS = ['), src.indexOf('];', src.indexOf('const SHOTS = [')));
  const caps=[...block.matchAll(/cap:'([^']+)'/g)].map(m=>m[1]);
  assert.ok(caps.length>=5, 'the film has only '+caps.length+' lines');
  for(const c of caps){
    /* NINE WORDS OR FEWER. This is read once, at speed, by somebody who
       has just clicked a button and is waiting to play. */
    const n=c.replace(/<[^>]+>/g,'').split(/\s+/).length;
    assert.ok(n<=10, `"${c}" is ${n} words`);
    /* AND NOT A MANUAL. The walkthrough on the ground does keys; a film
       that opens with WASD is a manual with music. */
    assert.ok(!/\b(WASD|press|click|button|key)\b/i.test(c),
      'the film explains a control: "'+c+'"');
  }
  /* EVERY CUT LANDS ON A LINE, in order, and the last one leaves room. */
  const ats=[...block.matchAll(/at:([0-9.]+)/g)].map(m=>+m[1]);
  assert.strictEqual(ats.length, caps.length, 'a line with no cut, or a cut with no line');
  for(let i=1;i<ats.length;i++)
    assert.ok(ats[i]>ats[i-1], 'the cuts are out of order at '+i);
  const end=+src.match(/const END = ([0-9.]+)/)[1];
  assert.ok(end - ats[ats.length-1] >= 2.0,
    'the last line gets '+(end-ats[ats.length-1]).toFixed(1)+'s, which is not long enough to read it');
  /* IT IS ABOUT HIM, and the last line is the mission. */
  assert.ok(/\bIon\b/.test(caps.join(' ')), 'the film never names Ion');
  assert.match(caps[caps.length-1], /him/i,
    'the closing line is not an instruction about Ion: "'+caps[caps.length-1]+'"');
  /* AND HE IS THE REAL ONE, off the same glb that lies on the cradle four
     levels later. A stand-in would have been easier and the whole point is
     that the thing on the floor is the thing you pick up. */
  assert.match(src, /characters\/models\/ion\.glb/, 'the film uses a stand-in for Ion');
  assert.match(src, /ships\/e45-hull\.glb/, 'the ship in the doorway is not the E-45');
});

test('the film puts back everything it hides', ()=>{
  /* THE RULE intro.js LEARNED THE HARD WAY. Hiding #hud hides the key
     hints and the code-console button with it, and handing over to the
     world without putting them back leaves a student playing with no HUD
     and no way to know that C opens anything. */
  const src=bare(read('public/opening.js'));
  const hide=src.slice(src.indexOf('hidden=[];'), src.indexOf('build();'));
  assert.match(hide, /hidden\.push\(sel\)/, 'what is hidden is not written down');
  assert.match(hide, /#hud/, 'the HUD is not hidden for the film');
  const fin=src.slice(src.indexOf('function finish()'), src.indexOf('return { play'));
  assert.match(fin, /hidden\.forEach\(sel=>\{ const e=\$\(sel\); if\(e\) e\.classList\.remove\('hidden'\); \}\)/,
    'the film never gives the HUD back');
  /* and it lets go of the listeners it took */
  assert.match(fin, /removeEventListener\('keydown', keyed\)/, 'the skip key stays bound for ever');
  assert.match(fin, /G\.scene\.remove\(group\)/, 'the set is left in the scene');
});

test('the film opens Mission 8, where the mission is actually joined', ()=>{
  /* MISSION 8 IS THE ONE THAT DOES NOT START ON ITS PLANET. Every other
     mission here either builds its own room or lands you on a ball; this
     one opens INSIDE the house, with Ion on the kitchen floor, and RYU is
     somewhere you only reach by walking out of the front door.

     THE FILM AND THE RESTART WERE BOTH IN PLANET.enter(), keyed off
     "arrived at RYU with no spawn point" — and the only call that ever
     reaches RYU is house.js opening that door, which always passes one.
     Neither of them fired once on the route anybody takes. */
  const game=bare(read('public/game.js'));
  const ion=game.slice(game.indexOf("if(id==='ion'){"),
                       game.indexOf("if(id==='ion'){")+700);
  assert.ok(ion.length>60, "startMissionRoom has no 'ion' branch any more");
  assert.match(ion, /PROGRESS\.restart\('ion'\)/, 'joining Mission 8 does not start it over');
  assert.match(ion, /OPENING\.forget\(\)/,
    'the mission rewinds and the cold open does not come back with it');
  assert.match(ion, /OPENING\.play\(go\)/, 'nothing plays the film when the mission is joined');
  assert.match(ion, /!OPENING\.seen/, 'the film plays every time');
  assert.match(ion, /HOUSE\.enter\(\)/, 'the film never hands on to the house');

  /* AND PLANET.enter() MUST NOT TRY TO OWN IT TOO. Two restarts is one
     that fires when a door is used. */
  const planet=bare(read('public/planet.js'));
  const top=planet.slice(planet.indexOf('function enter(sv, worldId, at'),
                         planet.indexOf('server = sv || null;'));
  assert.ok(!/ionRestart\(\)/.test(top),
    'the planet restarts the mission too, which fires when the house door is used');
  assert.ok(!/OPENING\.play\(/.test(top), 'the planet plays the film too');

  const menu=bare(read('public/menu.js'));
  assert.ok(!/OPENING\.play\(/.test(menu), 'the film is still on the hub\u2019s way in');
  const src=bare(read('public/opening.js'));
  assert.match(src, /if\(played && !opts\.force\)/, 'the film cannot be replayed on purpose');
  assert.match(src, /function forget\(\)\{ if\(!on\) played=false; \}/,
    'forget() can wind the film back mid-play, which would restart it under itself');
  const g2=bare(read('public/game.js'));
  assert.match(g2, /OPENING\.active\) OPENING\.tick\(dt\)/, 'the film is never ticked');
  const html=read('public/index.html');
  assert.match(html, /<script src="opening\.js\?v=\d+"><\/script>/, 'opening.js is not on the page');
});

test('RYU has a walkthrough, and it reads the save rather than counting', ()=>{
  /* EVERY OTHER WORLD IS A PLACE. RYU is a mission with one door and an
     ORDER — mend the robot, mend the ship, fly it, hand him over — and
     none of that is guessable from a hillside with a house, a spaceship
     and a tower on it. */
  const planet=bare(read('public/planet.js'));
  assert.match(planet, /function ionTour\(\)/, 'RYU has no walkthrough');
  /* IT STARTS ON EVERY ARRIVAL, film or no film — the film hands back
     into enter(), so this one line covers both a cold open and a student
     who skipped it or has seen it already. */
  assert.match(planet, /if\(W\.id==='ryu'\) setTimeout\(\(\)=>\{ if\(on\) ionTour\(\); \}/,
    'the walkthrough never starts');
  const tour=planet.slice(planet.indexOf('function ionTour()'),
                          planet.indexOf('function tourTick'));
  /* IT IS GATED ON THE MISSION'S OWN FLAGS, so a student who wanders off,
     lands somewhere else or comes back tomorrow is picked up at the step
     they are actually on — and one who has already flown is never sent
     back to the house to look at Ion. */
  for(const flag of ['ion_fixed','ion_ship_cleared','ion_flown','ion_handed','ion_belt'])
    assert.ok(tour.includes(flag), 'the walkthrough never checks '+flag);
  /* AND IT ENDS WHEN THE MISSION DOES. */
  assert.match(tour, /if\(ionFlag\('ion_belt'\)\) return;/,
    'a finished mission still gets pointed at');
  /* Each step has a line, and the ones about a place ring that place. */
  const says=(tour.match(/say:'/g)||[]).length;
  assert.ok(says>=8, 'the walkthrough is only '+says+' steps for four objects');
  /* AND IT STOPS AT THE DOOR OF THE LAST LESSON. A step that describes
     the panel which is open on top of it is two sets of instructions on
     screen at once, one of them about how to reach the other. */
  assert.ok(!/Answer his twenty questions/.test(tour),
    'the walkthrough narrates a panel that is covering it');
  assert.ok((tour.match(/at:\(\)=>withSize/g)||[]).length>=4,
    'the walkthrough points at nothing: no ring, no beacon');
  assert.ok((tour.match(/done:\(\)=>/g)||[]).length===says,
    'a step with no way to finish would stop the walkthrough dead');
});

test('the walkthrough names things that exist on RYU', ()=>{
  /* A ring on a building id that is not on this ball points confidently
     at the middle of the world and never clears. */
  const planet=bare(read('public/planet.js'));
  const tour=planet.slice(planet.indexOf('function ionTour()'),
                          planet.indexOf('function tourTick'));
  const ryu=planet.slice(planet.indexOf("id:'ryu'"), planet.indexOf("id:'ryu'")+4000);
  const have=new Set([...ryu.matchAll(/\{ id:'([a-z0-9]+)'/g)].map(m=>m[1]));
  /* AND THE PROPS, which are not in the world's `buildings` list at all:
     shipSpec and padSpec push theirs into BUILDINGS when the ball is
     built, so the E-45 is a real entry with a real `dir` that simply
     cannot be found by reading the world literal. */
  for(const m of planet.matchAll(/(\w+)=\{ id:'([a-z0-9]+)'[\s\S]{0,400}?BUILDINGS\.push\(\1\)/g))
    have.add(m[2]);
  for(const m of tour.matchAll(/(?:doorOf|spotOf|B)\('([a-z0-9]+)'\)/g))
    assert.ok(have.has(m[1]),
      'the walkthrough points at "'+m[1]+'", which is not on RYU: '+[...have].join(', '));
});

test('no panel calls a translator it has not got', ()=>{
  /* THE BUG THIS IS FOR. boolquiz.js names its translator `say`;
     opening.js names it `t_`. Copying one line of markup from the second
     into the first put a `t_(...)` into the quiz's draw(), which threw
     halfway through building the panel — so a wrong answer did nothing at
     all: no strike-through, no nudge, no redraw. Nothing in the game
     logged it, because the throw was inside a click handler, and the
     symptom was a button that looked fine and was dead.

     Each of these files picks its own short name for t() and then uses it
     forty times. Using the other file's name is a one-character mistake
     that cannot be caught by reading. */
  const FILES=['public/boolquiz.js','public/opening.js','public/sortfix.js',
               'public/ionfix.js','public/shipfix.js'].filter(f=>{
    try{ read(f); return true; }catch(e){ return false; }
  });
  for(const f of FILES){
    const src=bare(read(f));
    /* which short names does this file DEFINE? */
    const defined=new Set(['t']);          // strings.js puts t() on window
    for(const m of src.matchAll(/(?:const|let|var|function)\s+(t_|say|say_)\b/g))
      defined.add(m[1]);
    /* and which does it CALL? */
    const called=new Set();
    for(const m of src.matchAll(/\b(t_|say|say_)\s*\(/g)) called.add(m[1]);
    for(const c of called)
      assert.ok(defined.has(c),
        f+' calls '+c+'() and never defines it \u2014 it will throw the first '
        +'time that line is reached. It defines: '+[...defined].join(', '));
  }
});

test('the restart sits on the join, not on the door', ()=>{
  /* THE WHOLE CARE HERE IS WHICH CALL IS WHICH. PLANET.enter() is how you
     come OUT of the front door, every single time it is used, and a
     restart on that path would delete `ion_fixed` the moment a student
     walked outside having just mended Ion — over and over, for ever.
     startMissionRoom('ion') is the join, and it happens once. */
  const game=bare(read('public/game.js'));
  const house=bare(read('public/house.js'));
  assert.match(house, /PLANET\.enter\(null, 'ryu', OUTSIDE\)/,
    'the house no longer opens onto RYU, so this is not the route any more');
  const planet=bare(read('public/planet.js'));
  assert.ok(!/ionRestart/.test(planet),
    'planet.js still restarts the mission: the door would wipe it mid-play');

  /* WHAT SURVIVES IS THE COMPLETE STAMP, or restarting a mission would
     lock every mission that needed it. */
  const r=game.slice(game.indexOf('restart(id){'), game.indexOf('unlocked(id){'));
  assert.match(r, /delete done\[AT\(id\)\]/, 'restart does not reset the level');
  assert.match(r, /k\.indexOf\(id\+'_'\)===0/, "restart does not clear the mission's own flags");
  assert.ok(!/delete done\[id\]/.test(r),
    'restart deletes the COMPLETE stamp, which would lock the missions after it');

  /* AND EVERY FLAG MISSION 8 KEEPS IS UNDER ITS OWN PREFIX, or the
     restart cannot reach it. */
  for(const f of ['ion_fixed','ion_ship_cleared','ion_flown','ion_handed',
                  'ion_belt','ion_shipbrief','ion_specs'])
    assert.ok(planet.includes(f) || bare(read('public/ion.js')).includes(f),
      f+' is named nowhere: it cannot be a flag this mission files');
  const all=[...planet.matchAll(/'(ion_[a-z_]+)'/g)].map(m=>m[1]);
  for(const f of all)
    assert.match(f, /^ion_/, f+' would survive PROGRESS.restart(\'ion\')');
});

test('the walkthrough card steps aside for a lesson panel', ()=>{
  /* IT SITS IN THE BOTTOM MIDDLE AND POINTS AT THE THING NOW COVERING IT.
     "The lit panel on her flank is the pre-flight" is good advice right
     up until the pre-flight is open, at which point it is a second set of
     instructions competing with the first. */
  const bq=bare(read('public/boolquiz.js'));
  assert.match(bq, /function hideCoach\(off\)/, 'nothing puts the walkthrough card away');
  assert.match(bq, /hideCoach\(true\)/, 'the card is never hidden');
  assert.match(bq, /hideCoach\(false\)/, 'the card is never given back');
  /* ALL THREE PIECES. COACH hangs the card, the ring and the beacon off
     the body separately, and they are one sentence. */
  for(const sel of ['#coachTip','#coachRing','#coachBeacon'])
    assert.ok(bq.includes(sel), 'hideCoach leaves '+sel+' on screen');
  /* HIDDEN, NOT STOPPED. Closing the panel half way through must put the
     card back rather than drop somebody who was following it. */
  assert.ok(!/COACH\.stop\(\)/.test(bq),
    'the panel stops the walkthrough outright, so closing it strands the student');
});
