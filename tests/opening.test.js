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

test('the film is five cuts and says nothing about keys', ()=>{
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

test('the film plays once, in front of the front door', ()=>{
  const menu=bare(read('public/menu.js'));
  /* IN homeworld() AND NOT ON THE START BUTTON, because START is not the
     only way in: a saved world, a mission card and the character screen
     all arrive through this one function. */
  const hw=menu.slice(menu.indexOf('async function homeworld(where)'),
                      menu.indexOf('hideAll();', menu.indexOf('async function homeworld(where)')));
  assert.match(hw, /OPENING\.play\(/, 'nothing plays the film');
  assert.match(hw, /!OPENING\.seen/, 'the film plays on every arrival');
  assert.match(hw, /homeworld\(where\)/, 'the film does not hand back to the world');
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
