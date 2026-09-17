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

test('the film opens Mission 8, and hands on to the walkthrough', ()=>{
  /* IT WAS IN FRONT OF THE HUB AND ABOUT THE GAME, which tells a student
     what they have bought and does not make them care about anything. The
     thing they are about to do is walk into a house and find a robot on
     the kitchen floor. */
  const planet=bare(read('public/planet.js'));
  /* AT THE TOP OF enter(), BEFORE ANYTHING IS BUILT. The film takes
     G.roomGroup for its own set and throws it away again on the way out,
     so played from the bottom of enter() it left fifteen seconds of Ion
     followed by RYU not existing — built, replaced by a kitchen, and
     never built again. It also put the player's own body in the middle of
     the set, because AVATAR hangs that off the camera and not the room. */
  const top=planet.slice(planet.indexOf('function enter(sv, worldId, at'),
                         planet.indexOf('server = sv || null;'));
  assert.match(top, /OPENING\.play\(/, 'nothing plays the film on the way into RYU');
  assert.match(top, /!OPENING\.seen/, 'the film plays on every arrival');
  assert.match(top, /enter\(sv, worldId, at, true\)/,
    'the film never hands back, so the world it replaced is never rebuilt');
  assert.match(top, /worldId==='ryu'/, 'the film plays on every world');
  /* AND NOT AS A RECAP. Somebody flying back with Ion in the hold does
     not need to be told he is on the floor. */
  assert.match(top, /!ionFlag\('ion_belt'\)/,
    'a finished mission still gets the cold open');
  const menu=bare(read('public/menu.js'));
  assert.ok(!/OPENING\.play\(/.test(menu), 'the film is still on the hub\u2019s way in');
  const src=bare(read('public/opening.js'));
  assert.match(src, /if\(played && !opts\.force\)/, 'the film cannot be replayed on purpose');
  const game=bare(read('public/game.js'));
  assert.match(game, /OPENING\.active\) OPENING\.tick\(dt\)/, 'the film is never ticked');
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

test('joining Mission 8 starts Mission 8, and a door does not', ()=>{
  /* THERE IS NO HALF-FINISHED RYU ANY MORE. Somebody who cleared the
     pre-flight a week ago came back to a ship with nothing wrong with it,
     no smoke, no brief and no boolean anywhere, and no way to guess that
     the game thought they had already done it. */
  const planet=bare(read('public/planet.js'));
  const top=planet.slice(planet.indexOf('function enter(sv, worldId, at, again)'),
                         planet.indexOf('server = sv || null;'));
  assert.ok(top.length>60, 'enter() no longer takes the arguments this depends on');
  assert.match(top, /if\(worldId==='ryu' && !at && !again\) ionRestart\(\);/,
    'joining RYU does not start it over');

  /* AND `at` IS THE TEST BECAUSE A DOOR IS NOT A JOIN. house.js calls
     enter() with a spawn point every single time the door is used, so a
     restart on that path would delete `ion_fixed` the moment a student
     walked outside having just mended Ion — over and over, for ever. */
  const house=bare(read('public/house.js'));
  assert.match(house, /PLANET\.enter\(null, 'ryu', OUTSIDE\)/,
    'the house no longer names a spawn point, so a restart cannot be told from a join');
  const menu=bare(read('public/menu.js'));
  assert.match(menu, /PLANET\.enter\([^)]*\|\| PLANET\.lastWorld\(\)\)/,
    'the menu now passes a spawn point too, which makes joining look like a door');

  /* AND `again` IS LOAD-BEARING. The film hands back by calling enter()
     again with the same arguments, and a menu arrival has no spawn point
     — so without a way to tell the two apart the hand-back looked exactly
     like a fresh join: restart, which forgets the film, which plays it
     again, which hands back, for ever. */
  assert.match(top, /OPENING\.play\(\(\)=>enter\(sv, worldId, at, true\)\)/,
    'the film hands back without marking itself: this is an infinite loop');

  /* WHAT SURVIVES IS THE COMPLETE STAMP, or restarting a mission would
     lock every mission that needed it. */
  const game=bare(read('public/game.js'));
  const r=game.slice(game.indexOf('restart(id){'), game.indexOf('unlocked(id){'));
  assert.match(r, /delete done\[AT\(id\)\]/, 'restart does not reset the level');
  assert.match(r, /k\.indexOf\(id\+'_'\)===0/, "restart does not clear the mission's own flags");
  assert.ok(!/delete done\[id\]/.test(r),
    'restart deletes the COMPLETE stamp, which would lock the missions after it');

  /* AND THE FILM IS PART OF THE PLAYTHROUGH. OPENING keeps a
     once-a-session flag, which is right for a session and wrong for a
     mission that has just been rewound. */
  assert.match(planet, /function ionRestart\(\)/, 'there is no restart to call');
  const rr=planet.slice(planet.indexOf('function ionRestart()'),
                        planet.indexOf('function ionTour()'));
  assert.match(rr, /PROGRESS\.restart\('ion'\)/, 'ionRestart does not restart anything');
  assert.match(rr, /OPENING\.forget\(\)/,
    'the mission rewinds and the cold open does not come back with it');
  const op=bare(read('public/opening.js'));
  assert.match(op, /function forget\(\)\{ if\(!on\) played=false; \}/,
    'forget() can wind the film back mid-play, which would restart it under itself');
});
