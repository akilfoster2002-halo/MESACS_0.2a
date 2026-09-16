/* THE ROVER — the parts economy, before any of it is drawn.

   Stage one of this mission is a DECISION, and a decision is only a
   decision if the options are genuinely different and at least one of them
   is wrong. That is not a thing to eyeball: it is eight builds, and every
   one of them has to come out where the design says it does. */
const test = require('node:test');
const assert = require('node:assert');
const V = require('../public/rover.js');

const ALL = [];
for(const drive of ['wheels','treads'])
  for(const battery of ['stock','spare'])
    for(const sensor of ['none','eye'])
      ALL.push({ drive, battery, sensor });

const name = s => [s.drive, s.battery, s.sensor].join('+');

test('every build comes out where the design says it does', ()=>{
  const got = {};
  for(const s of ALL){
    const v=V.verdict(s);
    got[name(s)] = v.ok ? 'arrives' : (v.blind ? 'blind' : 'short');
  }
  assert.deepStrictEqual(got, {
    'wheels+stock+none':  'blind',    // cheapest, and it cannot see the rocks
    'wheels+stock+eye':   'short',    // can see them, one span short of the tower
    'wheels+spare+none':  'blind',    // range to spare and still blind
    'wheels+spare+eye':   'arrives',  // the long way round, exactly
    'treads+stock+none':  'arrives',  // over the ridge, nothing wasted
    'treads+stock+eye':   'arrives',  // works, and the sensor was two cells wasted
    'treads+spare+none':  'arrives',
    'treads+spare+eye':   'arrives'   // everything bolted on: works, wasteful
  });
});

test('there is more than one right answer, and they are different answers', ()=>{
  /* A build stage with one solution is a quiz. These two cost nearly the
     same and get there completely differently — one goes over on treads,
     the other buys its way round on wheels. */
  const win = ALL.filter(s=>V.verdict(s).ok);
  assert.ok(win.length >= 2, 'only one build works: that is a quiz, not a decision');
  const routes = new Set(win.map(s=>V.routeFor(s).id));
  assert.strictEqual(routes.size, 2, 'every winning build takes the same route');
});

test('the cheapest build is not the answer', ()=>{
  /* If bolting on the least gets you there, the budget is decoration and
     nobody ever has to think about it. */
  assert.strictEqual(V.verdict(V.bare()).ok, false);
  const cheapest = ALL.slice().sort((a,b)=>V.spent(a)-V.spent(b))[0];
  assert.strictEqual(V.verdict(cheapest).ok, false);
});

test('and neither is the greediest', ()=>{
  /* It does arrive — refusing it outright would be a rule rather than an
     economy — but it pays for it, and the console can say so. */
  const greedy = { drive:'treads', battery:'spare', sensor:'eye' };
  assert.strictEqual(V.spent(greedy), 9);
  const lean = { drive:'treads', battery:'stock', sensor:'none' };
  assert.ok(V.power(lean) > V.power(greedy),
    'the lean build has to end up with more to drive on');
});

test('wheels cannot climb, and the long way needs eyes', ()=>{
  assert.strictEqual(V.canClimb({ drive:'wheels' }), false);
  assert.strictEqual(V.canClimb({ drive:'treads' }), true);
  assert.strictEqual(V.routeFor({ drive:'wheels' }).id, 'round');
  assert.strictEqual(V.routeFor({ drive:'treads' }).id, 'over');
  assert.ok(V.ROUTES.round.needsSensor, 'the rock field has to need a sensor');
  assert.ok(!V.ROUTES.over.needsSensor, 'or both routes want the same part');
  assert.ok(V.ROUTES.round.spans > V.ROUTES.over.spans, 'round has to be further');
});

test('a second cell is only worth it if you are going far', ()=>{
  /* It costs three and gives four, so it is worth one net cell — which is
     nothing on a five-span run and the whole margin on a nine-span one. */
  const cell = V.optionOf('battery','spare');
  assert.ok(cell.spare > cell.cost, 'a battery that gives back less than it costs is never right');
  assert.ok(cell.spare - cell.cost <= 2, 'and one that gives back much more is always right');
});

test('the sums are sums', ()=>{
  const s = { drive:'wheels', battery:'spare', sensor:'eye' };
  assert.strictEqual(V.spent(s), 2+3+2);
  assert.strictEqual(V.power(s), V.CELLS - 7 + 4);
  assert.strictEqual(V.perStep(s), 1, 'only the drive costs power per span');
  assert.strictEqual(V.reach(s), V.power(s));
});

test('nothing a player can click breaks it', ()=>{
  for(const junk of [undefined, null, {}, { drive:'hovercraft', battery:7, sensor:null }]){
    const v = V.verdict(junk);
    assert.strictEqual(typeof v.ok, 'boolean');
    assert.ok(v.route && v.route.spans > 0);
    assert.ok(Number.isFinite(v.power));
  }
  /* An unknown part falls back to the first option rather than to
     undefined, so a saved build from an older catalogue still opens. */
  assert.strictEqual(V.tidy({ drive:'hovercraft' }).drive, 'wheels');
});

test('why() talks about the rover and never about the answer', ()=>{
  assert.strictEqual(V.why({ drive:'treads', battery:'stock', sensor:'none' }), null,
    'a build that works has nothing to explain');
  const blind = V.why({ drive:'wheels', battery:'stock', sensor:'none' });
  assert.match(blind, /rock|see/i, 'the blind build should be told what it cannot do');
  const short = V.why({ drive:'wheels', battery:'stock', sensor:'eye' });
  assert.match(short, /\b8\b/, 'the short build should be told what it has');
  assert.match(short, /\b9\b/, 'and what it needs');
  for(const s of [{drive:'wheels',battery:'stock',sensor:'none'},
                  {drive:'wheels',battery:'stock',sensor:'eye'}])
    assert.ok(!/treads|second cell/i.test(V.why(s)),
      'why() names the part to buy: that is the answer, not the diagnosis');
});

/* --------------------------------------------------------- the model */
test('the rover you can see IS the rover you built', ()=>{
  /* A build stage whose result you cannot look at is a form. model() has
     to branch on every slot, or a student swaps the wheels and watches
     nothing happen. It needs a DOM to run, so this reads the source — the
     property being protected is that each choice reaches the geometry. */
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname,'..','public/garage.js'),'utf8');
  const model = src.slice(src.indexOf('function model('), src.indexOf('let ui=null'));
  for(const [slot, a, b] of [['drive',"'treads'",'wheels'],
                             ['battery',"'spare'",'second cell'],
                             ['sensor',"'eye'",'mast']])
    assert.ok(model.includes('s.'+slot+'==='+a),
      `model() never looks at ${slot}: the ${b} would never appear`);
  /* And it is built from the spec rather than from a saved default, so the
     bench can preview a build before it is bolted on. */
  assert.match(model, /V\(\)\.tidy\(spec/, 'model() ignores the spec it was handed');
});

test('the bench refuses to bolt on a rover that cannot get there', ()=>{
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname,'..','public/garage.js'),'utf8');
  assert.match(src, /u\.go\.disabled = !v\.ok/, 'the button is not tied to the verdict');
  assert.match(src, /if\(!R\.verdict\(state\)\.ok\) return;/,
    'bolt() would save a build that cannot reach the tower');
});

/* ------------------------------------------------- the rover in the world */
test('the rover is a prop, not a building', ()=>{
  /* IT GREW WALLS. Everything in BUILDINGS goes through build(), which
     makes a building — four walls, a roof and a door — so pushing the
     rover into that list wrapped a shed around the vehicle. Walking out of
     the house put Robin inside it, looking at the back of a wall. */
  const fs = require('fs');
  const path = require('path');
  const planet = fs.readFileSync(path.join(__dirname,'..','public/planet.js'),'utf8');
  assert.match(planet, /id:'rover'[\s\S]{0,80}prop:true/,
    'the rover does not mark itself a prop');
  assert.match(planet, /if\(b\.id!=='pad' && !b\.prop\) build\(b\)/,
    'build() still runs over props');
  /* And props are not kept between visits, or every arrival pushes another
     copy onto a list that already has last visit's. */
  assert.match(planet, /filter\(b=>b\.id!=='pad' && !b\.prop\)/,
    'props survive setWorld and accumulate');
});

test('you press E at the rover itself, not at a post beside it', ()=>{
  /* A console on a post has a SIDE: at +2.6 it is behind the vehicle, at
     -2.6 it is behind you, and either way you walk up to a rover and the
     button is somewhere else. A vehicle is not a door. */
  const fs = require('fs');
  const path = require('path');
  const planet = fs.readFileSync(path.join(__dirname,'..','public/planet.js'),'utf8');
  assert.match(planet, /hold\.userData=\{ kind:'machine', label:'THE ROVER', enter:'rover' \}/,
    'the rover has no hit owner, so nothing focuses it');
  assert.match(planet, /m\.traverse\(o=>\{ if\(o\.isMesh\)\{ o\.userData\.owner=hold; G\.hits\.push\(o\); \} \}\)/,
    'the model is not registered as something you can look at');
});

test('the house has a door onto the planet, and it lands clear of itself', ()=>{
  const fs = require('fs');
  const path = require('path');
  const house = fs.readFileSync(path.join(__dirname,'..','public/house.js'),'utf8');
  assert.match(house, /function outside\(\)/, 'there is no way out of the house');
  assert.match(house, /PLANET\.enter\(null, 'ryu', OUTSIDE\)/,
    'leaving does not put you on RYU at a named spot');
  const m = house.match(/const OUTSIDE = \{ lon:([\d.]+), lat:(-?[\d.]+) \}/);
  assert.ok(m, 'the landing spot is gone');
  /* The house is 28 wide on lon 0 at a radius of 240: half-width 14 units
     is 3.34 degrees. The chase camera then sits 5.6 units behind you, and
     on a planet nothing pulls it out of a wall — so the spot has to clear
     the building by more than the camera's own arm. */
  const lon = +m[1];
  const units = lon * Math.PI/180 * 240;
  assert.ok(units > 14 + 5.6,
    `the door comes out ${units.toFixed(1)} units from the house centre; `+
    'the wall is at 14 and the camera trails 5.6 behind');
  assert.match(fs.readFileSync(path.join(__dirname,'..','public/game.js'),'utf8'),
    /HOUSE\.active && HOUSE\.outside && HOUSE\.outside\(\)/,
    'LEAVE does not use the front door');
});
